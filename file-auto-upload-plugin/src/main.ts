import {
  MarkdownView,
  Plugin,
  FileSystemAdapter,
  Editor,
  Menu,
  MenuItem,
  TFile,
  normalizePath,
  Notice,
  addIcon,
  MarkdownFileInfo,
} from "obsidian";
import { resolve, relative, join, basename, dirname } from "path-browserify";
import { existsSync, unlink } from "fs";
import fixPath from "fix-path";

import { isAssetTypeAnAsset, arrayToObject, getEmbedMarkdown } from "./utils";
import { downloadAllImageFiles } from "./download";
import { PicGoUploader, PicGoCoreUploader } from "./uploader";
import { PicGoDeleter } from "./deleter";
import Helper from "./helper";
import { t } from "./lang/helpers";

import { SettingTab, PluginSettings, DEFAULT_SETTINGS } from "./setting";

interface Image {
  path: string;
  name: string;
  source: string;
}

interface CleanupRootAssetsResult {
  scanned: number;
  uploaded: number;
  replaced: number;
  deleted: number;
  failed: string[];
}

export default class imageAutoUploadPlugin extends Plugin {
  settings: PluginSettings;
  helper: Helper;
  editor: Editor;
  picGoUploader: PicGoUploader;
  picGoDeleter: PicGoDeleter;
  picGoCoreUploader: PicGoCoreUploader;
  uploader: PicGoUploader | PicGoCoreUploader;

  async loadSettings() {
    this.settings = Object.assign(DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  onunload() {}

  async onload() {
    await this.loadSettings();

    this.helper = new Helper(this.app);
    this.picGoUploader = new PicGoUploader(this.settings, this);
    this.picGoDeleter = new PicGoDeleter(this);
    this.picGoCoreUploader = new PicGoCoreUploader(this.settings, this);

    if (this.settings.uploader === "PicGo") {
      this.uploader = this.picGoUploader;
    } else if (this.settings.uploader === "PicGo-Core") {
      this.uploader = this.picGoCoreUploader;
      if (this.settings.fixPath) {
        fixPath();
      }
    } else {
      new Notice("unknown uploader");
    }

    addIcon(
      "upload",
      `<svg t="1636630783429" class="icon" viewBox="0 0 100 100" version="1.1" p-id="4649" xmlns="http://www.w3.org/2000/svg">
      <path d="M 71.638 35.336 L 79.408 35.336 C 83.7 35.336 87.178 38.662 87.178 42.765 L 87.178 84.864 C 87.178 88.969 83.7 92.295 79.408 92.295 L 17.249 92.295 C 12.957 92.295 9.479 88.969 9.479 84.864 L 9.479 42.765 C 9.479 38.662 12.957 35.336 17.249 35.336 L 25.019 35.336 L 25.019 42.765 L 17.249 42.765 L 17.249 84.864 L 79.408 84.864 L 79.408 42.765 L 71.638 42.765 L 71.638 35.336 Z M 49.014 10.179 L 67.326 27.688 L 61.835 32.942 L 52.849 24.352 L 52.849 59.731 L 45.078 59.731 L 45.078 24.455 L 36.194 32.947 L 30.702 27.692 L 49.012 10.181 Z" p-id="4650" fill="#8a8a8a"></path>
    </svg>`
    );

    this.addSettingTab(new SettingTab(this.app, this));

    this.addCommand({
      id: "Upload all images",
      name: "Upload all images",
      checkCallback: (checking: boolean) => {
        let leaf = this.app.workspace.activeLeaf;
        if (leaf) {
          if (!checking) {
            this.uploadAllFile();
          }
          return true;
        }
        return false;
      },
    });
    this.addCommand({
      id: "Download all images",
      name: "Download all images",
      checkCallback: (checking: boolean) => {
        let leaf = this.app.workspace.activeLeaf;
        if (leaf) {
          if (!checking) {
            downloadAllImageFiles(this);
          }
          return true;
        }
        return false;
      },
    });

    this.setupPasteHandler();
    this.registerFileMenu();
    this.registerInterval(
      window.setInterval(() => {
        if (this.settings.autoCleanupRoot) {
          this.cleanupRootAssets().catch(error => {
            console.error("Auto cleanup root assets failed: ", error);
          });
        }
      }, 30 * 60 * 1000)
    );

    this.registerSelection();
  }

  registerSelection() {
    this.registerEvent(
      this.app.workspace.on(
        "editor-menu",
        (menu: Menu, editor: Editor, info: MarkdownView | MarkdownFileInfo) => {
          if (this.app.workspace.getLeavesOfType("markdown").length === 0) {
            return;
          }
          const selection = editor.getSelection();
          if (selection) {
            const markdownRegex = /!\[.*\]\((.*)\)/g;
            const markdownMatch = markdownRegex.exec(selection);
            if (markdownMatch && markdownMatch.length > 1) {
              const markdownUrl = markdownMatch[1];
              if (
                this.settings.uploadedImages.find(
                  (item: { imgUrl: string }) => item.imgUrl === markdownUrl
                )
              ) {
                this.addMenu(menu, markdownUrl, editor);
              }
            }
          }
        }
      )
    );
  }

  addMenu = (menu: Menu, imgPath: string, editor: Editor) => {
    menu.addItem((item: MenuItem) =>
      item
        .setIcon("trash-2")
        .setTitle(t("Delete image using PicList"))
        .onClick(async () => {
          try {
            const selectedItem = this.settings.uploadedImages.find(
              (item: { imgUrl: string }) => item.imgUrl === imgPath
            );
            if (selectedItem) {
              const res = await this.picGoDeleter.deleteImage([selectedItem]);
              if (res.success) {
                new Notice(t("Delete successfully"));
                const selection = editor.getSelection();
                if (selection) {
                  editor.replaceSelection("");
                }
                this.settings.uploadedImages =
                  this.settings.uploadedImages.filter(
                    (item: { imgUrl: string }) => item.imgUrl !== imgPath
                  );
                this.saveSettings();
              } else {
                new Notice(t("Delete failed"));
              }
            }
          } catch {
            new Notice(t("Error, could not delete"));
          }
        })
    );
  };

  registerFileMenu() {
    this.registerEvent(
      this.app.workspace.on(
        "file-menu",
        (menu: Menu, file: TFile, source: string, leaf) => {
          if (source === "canvas-menu") return false;
          if (!isAssetTypeAnAsset(file.path)) return false;

          menu.addItem((item: MenuItem) => {
            item
              .setTitle("Upload")
              .setIcon("upload")
              .onClick(() => {
                if (!(file instanceof TFile)) {
                  return false;
                }
                this.fileMenuUpload(file);
              });
          });
        }
      )
    );
  }

  fileMenuUpload(file: TFile) {
    let content = this.helper.getValue();

    const basePath = (
      this.app.vault.adapter as FileSystemAdapter
    ).getBasePath();
    let imageList: Image[] = [];
    const fileArray = this.helper.getAllFiles();

    for (const match of fileArray) {
      const imageName = match.name;
      const encodedUri = match.path;

      const fileName = basename(decodeURI(encodedUri));

      if (file && file.name === fileName) {
        const abstractImageFile = join(basePath, file.path);

        if (isAssetTypeAnAsset(abstractImageFile)) {
          imageList.push({
            path: abstractImageFile,
            name: imageName,
            source: match.source,
          });
        }
      }
    }

    if (imageList.length === 0) {
      new Notice(t("Can not find image file"));
      return;
    }

    this.uploader.uploadFiles(imageList.map(item => item.path)).then(res => {
      if (res.success) {
        let uploadUrlList = res.result;
        imageList.map(item => {
          const uploadImage = uploadUrlList.shift();
          let name = this.handleName(item.name);

          content = content.replaceAll(
            item.source,
            getEmbedMarkdown(item.name, uploadImage, name)
          );
        });
        this.helper.setValue(content);

        if (this.settings.deleteSource) {
          imageList.map(image => {
            if (!image.path.startsWith("http")) {
              unlink(image.path, () => {});
            }
          });
        }
      } else {
        new Notice("Upload error");
      }
    });
  }

  filterFile(fileArray: Image[]) {
    const imageList: Image[] = [];

    for (const match of fileArray) {
      if (match.path.startsWith("http")) {
        if (this.settings.workOnNetWork) {
          if (
            !this.helper.hasBlackDomain(
              match.path,
              this.settings.newWorkBlackDomains
            )
          ) {
            imageList.push({
              path: match.path,
              name: match.name,
              source: match.source,
            });
          }
        }
      } else {
        imageList.push({
          path: match.path,
          name: match.name,
          source: match.source,
        });
      }
    }

    return imageList;
  }
  getFile(fileName: string, fileMap: any) {
    if (!fileMap) {
      fileMap = arrayToObject(this.app.vault.getFiles(), "name");
    }
    return fileMap[fileName];
  }

  async cleanupRootAssets(): Promise<CleanupRootAssetsResult> {
    const result: CleanupRootAssetsResult = {
      scanned: 0,
      uploaded: 0,
      replaced: 0,
      deleted: 0,
      failed: [],
    };
    const basePath = (
      this.app.vault.adapter as FileSystemAdapter
    ).getBasePath();
    const rootAssets = this.app.vault
      .getFiles()
      .filter(file => file.path === file.name && isAssetTypeAnAsset(file.path));
    result.scanned = rootAssets.length;

    for (const file of rootAssets) {
      try {
        const uploadResult = await this.uploader.uploadFiles([
          join(basePath, file.path),
        ]);

        if (
          !uploadResult.success ||
          !uploadResult.result ||
          uploadResult.result.length === 0
        ) {
          result.failed.push(`${file.name}: 上传失败 ${uploadResult.msg || ""}`.trim());
          continue;
        }

        result.uploaded++;
        const uploadUrl = this.getUploadUrl(uploadResult.result[0]);
        console.log("Auto cleanup root asset uploaded URL: ", uploadUrl);

        if (!uploadUrl) {
          result.failed.push(`${file.name}: 上传成功但没有拿到远程 URL`);
          continue;
        }

        const replaced = await this.replaceRootAssetLinks(file, uploadUrl);

        if (replaced === 0) {
          result.failed.push(`${file.name}: 上传成功，但没有在笔记文件中找到引用，已保留本地文件`);
          continue;
        }

        result.replaced += replaced;
        await this.app.vault.delete(file);
        result.deleted++;
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        result.failed.push(`${file.name}: ${reason}`);
      }
    }

    return result;
  }

  async cleanupRootAssetsWithNotice() {
    const result = await this.cleanupRootAssets();

    if (result.scanned === 0) {
      new Notice("根目录清理：没有找到需要上传的图片或音视频文件。");
      return;
    }

    const summary = `根目录清理完成：扫描 ${result.scanned} 个，上传 ${result.uploaded} 个，替换 ${result.replaced} 处，删除 ${result.deleted} 个。`;

    if (result.failed.length === 0) {
      new Notice(summary);
      return;
    }

    new Notice(`${summary}\n未完成：${result.failed.slice(0, 3).join("；")}`);
  }

  getUploadUrl(result: any) {
    if (typeof result === "string") {
      return result;
    }

    if (result && typeof result === "object") {
      return result.imgUrl || result.url || result.path || "";
    }

    return "";
  }

  async replaceRootAssetLinks(file: TFile, url: string) {
    let replaced = 0;

    for (const noteFile of this.app.vault.getFiles().filter(this.isReferenceFile)) {
      const content = await this.app.vault.read(noteFile);
      const result = noteFile.extension === "canvas"
        ? this.replaceCanvasAssetLinks(content, file, url)
        : this.replaceAssetLinks(content, file, url);

      if (result.content !== content) {
        await this.app.vault.modify(noteFile, result.content);
        replaced += result.replaced;
      }
    }

    return replaced;
  }

  isReferenceFile(file: TFile) {
    return ["md", "canvas", "html"].includes(file.extension);
  }

  isSameRootAsset(target: string, file: TFile) {
    let path = target.trim();

    if (path.startsWith("<") && path.endsWith(">")) {
      path = path.slice(1, -1);
    }
    if (
      (path.startsWith('"') && path.endsWith('"')) ||
      (path.startsWith("'") && path.endsWith("'"))
    ) {
      path = path.slice(1, -1);
    }

    path = path.split("#")[0].split("?")[0];

    try {
      path = decodeURI(path);
    } catch {
      return false;
    }

    if (/^[a-z][a-z0-9+.-]*:/i.test(path)) {
      return false;
    }

    const normalizedPath = normalizePath(path);

    return normalizedPath === file.path || basename(normalizedPath) === file.name;
  }

  replaceCanvasAssetLinks(content: string, file: TFile, url: string) {
    let data;

    try {
      data = JSON.parse(content);
    } catch {
      return {
        content,
        replaced: 0,
      };
    }

    if (!Array.isArray(data.nodes)) {
      return {
        content,
        replaced: 0,
      };
    }

    let replaced = 0;

    data.nodes.forEach((node: any) => {
      if (
        node &&
        node.type === "file" &&
        typeof node.file === "string" &&
        this.isSameRootAsset(node.file, file)
      ) {
        node.type = "link";
        node.url = url;
        delete node.file;
        replaced++;
      }
    });

    return {
      content: replaced > 0 ? JSON.stringify(data, null, "\t") : content,
      replaced,
    };
  }

  replaceAssetLinks(content: string, file: TFile, url: string) {
    const escapeRegExp = (value: string) => {
      return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    };

    const wikilinkRegex = /!\[\[([^\]]+)\]\]/g;
    const markdownImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let replaced = 0;
    const replacements: string[] = [];

    const newContent = content
      .replace(wikilinkRegex, (source, target) => {
        const path = target.split("|")[0];
        const alt = target.split("|")[1] || file.name;

        if (!this.isSameRootAsset(path, file)) {
          return source;
        }

        replaced++;
        replacements.push(getEmbedMarkdown(file.name, url, alt));
        return `\u0000ROOT_ASSET_${replacements.length - 1}\u0000`;
      })
      .replace(markdownImageRegex, (source, alt, target) => {
        if (!this.isSameRootAsset(target, file)) {
          return source;
        }

        replaced++;
        replacements.push(getEmbedMarkdown(file.name, url, alt));
        return `\u0000ROOT_ASSET_${replacements.length - 1}\u0000`;
      })
      .replace(new RegExp(escapeRegExp(file.name), "g"), (source, offset, fullContent) => {
        if (!isAssetTypeAnAsset(file.name)) {
          return source;
        }

        const before = offset > 0 ? fullContent[offset - 1] : "";
        const after = fullContent[offset + source.length] || "";

        if (/[\p{L}\p{N}_\[\(\/\\.\-]/u.test(before)) {
          return source;
        }
        if (/[\p{L}\p{N}_\]\)\|\/\\.\-]/u.test(after)) {
          return source;
        }

        replaced++;
        return getEmbedMarkdown(file.name, url);
      })
      .replace(/\u0000ROOT_ASSET_(\d+)\u0000/g, (source, index) => {
        return replacements[Number(index)] || source;
      });

    return {
      content: newContent,
      replaced,
    };
  }

  // uploda all file
  uploadAllFile() {
    let content = this.helper.getValue();

    const basePath = (
      this.app.vault.adapter as FileSystemAdapter
    ).getBasePath();
    const activeFile = this.app.workspace.getActiveFile();
    const fileMap = arrayToObject(this.app.vault.getFiles(), "name");
    const filePathMap = arrayToObject(this.app.vault.getFiles(), "path");
    let imageList: Image[] = [];
    const fileArray = this.filterFile(this.helper.getAllFiles());

    for (const match of fileArray) {
      const imageName = match.name;
      const encodedUri = match.path;

      if (encodedUri.startsWith("http")) {
        imageList.push({
          path: match.path,
          name: imageName,
          source: match.source,
        });
      } else {
        const fileName = basename(decodeURI(encodedUri));
        let file;
        // 绝对路径
        if (filePathMap[decodeURI(encodedUri)]) {
          file = filePathMap[decodeURI(encodedUri)];
        }

        // 相对路径
        if (
          (!file && decodeURI(encodedUri).startsWith("./")) ||
          decodeURI(encodedUri).startsWith("../")
        ) {
          const filePath = resolve(
            join(basePath, dirname(activeFile.path)),
            decodeURI(encodedUri)
          );

          if (existsSync(filePath)) {
            const path = normalizePath(
              relative(
                normalizePath(basePath),
                normalizePath(
                  resolve(
                    join(basePath, dirname(activeFile.path)),
                    decodeURI(encodedUri)
                  )
                )
              )
            );

            file = filePathMap[path];
          }
        }
        // 尽可能短路径
        if (!file) {
          file = this.getFile(fileName, fileMap);
        }

        if (file) {
          const abstractImageFile = join(basePath, file.path);

          if (isAssetTypeAnAsset(abstractImageFile)) {
            imageList.push({
              path: abstractImageFile,
              name: imageName,
              source: match.source,
            });
          }
        }
      }
    }

    if (imageList.length === 0) {
      new Notice(t("Can not find image file"));
      return;
    } else {
      new Notice(`共找到${imageList.length}个图像文件，开始上传`);
    }

    this.uploader.uploadFiles(imageList.map(item => item.path)).then(res => {
      if (res.success) {
        let uploadUrlList = res.result;

        if (imageList.length !== uploadUrlList.length) {
          new Notice(
            t("Warning: upload files is different of reciver files from api")
          );
        }

        imageList.map(item => {
          const uploadImage = uploadUrlList.shift();

          let name = this.handleName(item.name);
          content = content.replaceAll(
            item.source,
            getEmbedMarkdown(item.name, uploadImage, name)
          );
        });
        const currentFile = this.app.workspace.getActiveFile();
        if (activeFile.path !== currentFile.path) {
          new Notice(t("File has been changedd, upload failure"));
          return;
        }
        this.helper.setValue(content);

        if (this.settings.deleteSource) {
          imageList.map(image => {
            if (!image.path.startsWith("http")) {
              unlink(image.path, () => {});
            }
          });
        }
      } else {
        new Notice("Upload error");
      }
    });
  }

  setupPasteHandler() {
    this.registerEvent(
      this.app.workspace.on(
        "editor-paste",
        (evt: ClipboardEvent, editor: Editor, markdownView: MarkdownView) => {
          const allowUpload = this.helper.getFrontmatterValue(
            "image-auto-upload",
            this.settings.uploadByClipSwitch
          );

          let files = evt.clipboardData.files;
          if (!allowUpload) {
            return;
          }

          // 剪贴板内容有md格式的图片时
          if (this.settings.workOnNetWork) {
            const clipboardValue = evt.clipboardData.getData("text/plain");
            const imageList = this.helper
              .getImageLink(clipboardValue)
              .filter(image => image.path.startsWith("http"))
              .filter(
                image =>
                  !this.helper.hasBlackDomain(
                    image.path,
                    this.settings.newWorkBlackDomains
                  )
              );

            if (imageList.length !== 0) {
              this.uploader
                .uploadFiles(imageList.map(item => item.path))
                .then(res => {
                  let value = this.helper.getValue();
                  if (res.success) {
                    let uploadUrlList = res.result;
                    imageList.map(item => {
                      const uploadImage = uploadUrlList.shift();
                      let name = this.handleName(item.name);

                      value = value.replaceAll(
                        item.source,
                        getEmbedMarkdown(item.name, uploadImage, name)
                      );
                    });
                    this.helper.setValue(value);
                  } else {
                    new Notice("Upload error");
                  }
                });
            }
          }

          // 剪贴板中是图片时进行上传
          if (this.canUpload(evt.clipboardData)) {
            this.uploadFileAndEmbedImgurImage(
              editor,
              async (editor: Editor, pasteId: string) => {
                let res: any;
                res = await this.uploader.uploadFileByClipboard(
                  evt.clipboardData.files
                );

                if (res.code !== 0) {
                  this.handleFailedUpload(editor, pasteId, res.msg);
                  return;
                }
                const url = res.data;

                return url;
              },
              evt.clipboardData
            ).catch();
            evt.preventDefault();
          }
        }
      )
    );
    this.registerEvent(
      this.app.workspace.on(
        "editor-drop",
        async (evt: DragEvent, editor: Editor, markdownView: MarkdownView) => {
          // when ctrl key is pressed, do not upload image, because it is used to set local file
          if (evt.ctrlKey) {
            return;
          }
          const allowUpload = this.helper.getFrontmatterValue(
            "image-auto-upload",
            this.settings.uploadByClipSwitch
          );
          let files = evt.dataTransfer.files;

          if (!allowUpload) {
            return;
          }

          if (
            files.length !== 0 &&
            (files[0].type.startsWith("image") ||
              files[0].type.startsWith("video") ||
              files[0].type.startsWith("audio"))
          ) {
            let sendFiles: Array<string> = [];
            let files = evt.dataTransfer.files;
            Array.from(files).forEach((item, index) => {
              if (item.path) {
                sendFiles.push(item.path);
              } else {
                const { webUtils } = require("electron");
                const path = webUtils.getPathForFile(item);
                sendFiles.push(path);
              }
            });
            evt.preventDefault();

            const data = await this.uploader.uploadFiles(sendFiles);

            if (data.success) {
              data.result.map((value: string, index: number) => {
                let pasteId = (Math.random() + 1).toString(36).substr(2, 5);
                this.insertTemporaryText(editor, pasteId);
                this.embedMarkDownImage(
                  editor,
                  pasteId,
                  value,
                  files[index].name
                );
              });
            } else {
              new Notice("Upload error");
            }
          }
        }
      )
    );
  }

  canUpload(clipboardData: DataTransfer) {
    this.settings.applyImage;
    const files = clipboardData.files;
    const text = clipboardData.getData("text");

    const hasImageFile =
      files.length !== 0 &&
      (files[0].type.startsWith("image") ||
        files[0].type.startsWith("video") ||
        files[0].type.startsWith("audio"));
    if (hasImageFile) {
      if (!!text) {
        return this.settings.applyImage;
      } else {
        return true;
      }
    } else {
      return false;
    }
  }

  async uploadFileAndEmbedImgurImage(
    editor: Editor,
    callback: Function,
    clipboardData: DataTransfer
  ) {
    let pasteId = (Math.random() + 1).toString(36).substr(2, 5);
    this.insertTemporaryText(editor, pasteId);
    const name = clipboardData.files[0].name;

    try {
      const url = await callback(editor, pasteId);
      this.embedMarkDownImage(editor, pasteId, url, name);
    } catch (e) {
      this.handleFailedUpload(editor, pasteId, e);
    }
  }

  insertTemporaryText(editor: Editor, pasteId: string) {
    let progressText = imageAutoUploadPlugin.progressTextFor(pasteId);
    editor.replaceSelection(progressText + "\n");
  }

  private static progressTextFor(id: string) {
    return `![Uploading file...${id}]()`;
  }

  embedMarkDownImage(
    editor: Editor,
    pasteId: string,
    imageUrl: any,
    name: string = ""
  ) {
    let progressText = imageAutoUploadPlugin.progressTextFor(pasteId);
    const imageName = this.handleName(name);

    let markDownImage = getEmbedMarkdown(name, imageUrl, imageName);

    imageAutoUploadPlugin.replaceFirstOccurrence(
      editor,
      progressText,
      markDownImage
    );
  }

  handleFailedUpload(editor: Editor, pasteId: string, reason: any) {
    new Notice(reason);
    console.error("Failed request: ", reason);
    let progressText = imageAutoUploadPlugin.progressTextFor(pasteId);
    imageAutoUploadPlugin.replaceFirstOccurrence(
      editor,
      progressText,
      "⚠️upload failed, check dev console"
    );
  }

  handleName(name: string) {
    const imageSizeSuffix = this.settings.imageSizeSuffix || "";

    if (this.settings.imageDesc === "origin") {
      return `${name}${imageSizeSuffix}`;
    } else if (this.settings.imageDesc === "none") {
      return "";
    } else if (this.settings.imageDesc === "removeDefault") {
      if (name === "image.png") {
        return "";
      } else {
        return `${name}${imageSizeSuffix}`;
      }
    } else {
      return `${name}${imageSizeSuffix}`;
    }
  }

  static replaceFirstOccurrence(
    editor: Editor,
    target: string,
    replacement: string
  ) {
    let lines = editor.getValue().split("\n");
    for (let i = 0; i < lines.length; i++) {
      let ch = lines[i].indexOf(target);
      if (ch != -1) {
        let from = { line: i, ch: ch };
        let to = { line: i, ch: ch + target.length };
        editor.replaceRange(replacement, from, to);
        break;
      }
    }
  }
}
