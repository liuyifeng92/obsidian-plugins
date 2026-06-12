import { describe, expect, it, vi } from "vitest";
import imageAutoUploadPlugin from "../src/main";

const plugin = Object.create(imageAutoUploadPlugin.prototype);

describe("root asset cleanup", () => {
  it("should replace root asset links in markdown", () => {
    const file = { name: "test file.mp4", path: "test file.mp4" };
    const url = "https://cos.example.com/test%20file.mp4";
    const content = [
      "![[test file.mp4]]",
      "![[test file.mp4|alt]]",
      "![](test file.mp4)",
      "![alt](test file.mp4)",
      "![alt](./test file.mp4)",
      "![[path/test file.mp4]]",
      "![other](other.mp4)",
    ].join("\n");

    const result = plugin.replaceAssetLinks(content, file, url);

    expect(result.replaced).toBe(6);
    expect(result.content).toBe(
      [
        '<video src="https://cos.example.com/test%20file.mp4" controls width="300"></video>',
        '<video src="https://cos.example.com/test%20file.mp4" controls width="300"></video>',
        '<video src="https://cos.example.com/test%20file.mp4" controls width="300"></video>',
        '<video src="https://cos.example.com/test%20file.mp4" controls width="300"></video>',
        '<video src="https://cos.example.com/test%20file.mp4" controls width="300"></video>',
        '<video src="https://cos.example.com/test%20file.mp4" controls width="300"></video>',
        "![other](other.mp4)",
      ].join("\n")
    );
  });

  it("should replace bare root asset filenames", () => {
    const file = {
      name: "7D6551F3-EF28-469F-9BFD-7188AEE60A81.png",
      path: "7D6551F3-EF28-469F-9BFD-7188AEE60A81.png",
    };
    const url =
      "https://cos.example.com/7D6551F3-EF28-469F-9BFD-7188AEE60A81.png";
    const content = [
      "7D6551F3-EF28-469F-9BFD-7188AEE60A81.png",
      "![[7D6551F3-EF28-469F-9BFD-7188AEE60A81.png]]",
      "![alt](7D6551F3-EF28-469F-9BFD-7188AEE60A81.png)",
      "https://example.com/7D6551F3-EF28-469F-9BFD-7188AEE60A81.png",
    ].join("\n");

    const result = plugin.replaceAssetLinks(content, file, url);

    expect(result.replaced).toBe(3);
    expect(result.content).toBe(
      [
        "![7D6551F3-EF28-469F-9BFD-7188AEE60A81.png](https://cos.example.com/7D6551F3-EF28-469F-9BFD-7188AEE60A81.png)",
        "![7D6551F3-EF28-469F-9BFD-7188AEE60A81.png](https://cos.example.com/7D6551F3-EF28-469F-9BFD-7188AEE60A81.png)",
        "![alt](https://cos.example.com/7D6551F3-EF28-469F-9BFD-7188AEE60A81.png)",
        "https://example.com/7D6551F3-EF28-469F-9BFD-7188AEE60A81.png",
      ].join("\n")
    );
  });

  it("should replace bare filenames with spaces and Chinese characters", () => {
    const file = { name: "中文 文件.png", path: "中文 文件.png" };
    const url = "https://cos.example.com/%E4%B8%AD%E6%96%87%20%E6%96%87%E4%BB%B6.png";

    const result = plugin.replaceAssetLinks(`前后文字 中文 文件.png 结束`, file, url);

    expect(result.replaced).toBe(1);
    expect(result.content).toBe(
      `前后文字 ![中文 文件.png](${url}) 结束`
    );
  });

  it("should not replace bare filenames outside the asset extension list", () => {
    const file = { name: "note.txt", path: "note.txt" };
    const url = "https://cos.example.com/note.txt";

    const result = plugin.replaceAssetLinks("note.txt", file, url);

    expect(result.replaced).toBe(0);
    expect(result.content).toBe("note.txt");
  });

  it("should upload, modify markdown, then delete the local root asset", async () => {
    const testFile = { name: "test.mp4", path: "test.mp4" };
    const noteFile = { name: "note.md", path: "note.md", extension: "md" };
    const events: string[] = [];
    const plugin = Object.create(imageAutoUploadPlugin.prototype);

    plugin.app = {
      vault: {
        adapter: {
          getBasePath: () => "/vault",
        },
        getFiles: () => [testFile, noteFile],
        getMarkdownFiles: () => [noteFile],
        read: vi.fn(async () => "![[test.mp4]]"),
        modify: vi.fn(async (_file, content) => {
          events.push(`modify:${content}`);
        }),
        delete: vi.fn(async () => {
          events.push("delete");
        }),
      },
    };
    plugin.uploader = {
      uploadFiles: vi.fn(async () => {
        events.push("upload");
        return {
          success: true,
          result: ["https://cos.example.com/test.mp4"],
        };
      }),
    };

    await plugin.cleanupRootAssets();

    expect(plugin.app.vault.modify).toHaveBeenCalledWith(
      noteFile,
      '<video src="https://cos.example.com/test.mp4" controls width="300"></video>'
    );
    expect(plugin.app.vault.delete).toHaveBeenCalledWith(testFile);
    expect(events).toEqual([
      "upload",
      'modify:<video src="https://cos.example.com/test.mp4" controls width="300"></video>',
      "delete",
    ]);
  });

  it("should replace root audio asset links with audio html", () => {
    const file = { name: "clip.mp3", path: "clip.mp3" };
    const url = "https://cos.example.com/clip.mp3";

    const result = plugin.replaceAssetLinks("![[clip.mp3]]", file, url);

    expect(result.replaced).toBe(1);
    expect(result.content).toBe(
      '<audio src="https://cos.example.com/clip.mp3" controls></audio>'
    );
  });

  it("should upload, modify markdown, then delete a local root image", async () => {
    const testFile = { name: "test.png", path: "test.png" };
    const noteFile = { name: "note.md", path: "note.md", extension: "md" };
    const events: string[] = [];
    const plugin = Object.create(imageAutoUploadPlugin.prototype);

    plugin.app = {
      vault: {
        adapter: {
          getBasePath: () => "/vault",
        },
        getFiles: () => [testFile, noteFile],
        getMarkdownFiles: () => [noteFile],
        read: vi.fn(async () => "![[test.png]]"),
        modify: vi.fn(async (_file, content) => {
          events.push(`modify:${content}`);
        }),
        delete: vi.fn(async () => {
          events.push("delete");
        }),
      },
    };
    plugin.uploader = {
      uploadFiles: vi.fn(async () => {
        events.push("upload");
        return {
          success: true,
          result: ["https://cos.example.com/test.png"],
        };
      }),
    };

    await plugin.cleanupRootAssets();

    expect(plugin.app.vault.modify).toHaveBeenCalledWith(
      noteFile,
      "![test.png](https://cos.example.com/test.png)"
    );
    expect(plugin.app.vault.delete).toHaveBeenCalledWith(testFile);
    expect(events).toEqual([
      "upload",
      "modify:![test.png](https://cos.example.com/test.png)",
      "delete",
    ]);
  });

  it("should replace references in canvas and html files", async () => {
    const testFile = { name: "test.png", path: "test.png" };
    const canvasFile = {
      name: "board.canvas",
      path: "board.canvas",
      extension: "canvas",
    };
    const htmlFile = {
      name: "page.html",
      path: "page.html",
      extension: "html",
    };
    const plugin = Object.create(imageAutoUploadPlugin.prototype);

    plugin.app = {
      vault: {
        adapter: {
          getBasePath: () => "/vault",
        },
        getFiles: () => [testFile, canvasFile, htmlFile],
        read: vi.fn(async file => {
          if (file.extension === "canvas") {
            return '{"nodes":[{"id":"a","type":"file","file":"test.png"},{"id":"b","type":"file","file":"other.png"}]}';
          }

          return "<img src=\"test.png\">";
        }),
        modify: vi.fn(),
        delete: vi.fn(),
      },
    };
    plugin.uploader = {
      uploadFiles: vi.fn(async () => ({
        success: true,
        result: ["https://cos.example.com/test.png"],
      })),
    };

    const result = await plugin.cleanupRootAssets();

    expect(plugin.app.vault.modify).toHaveBeenCalledWith(
      canvasFile,
      [
        "{",
        "\t\"nodes\": [",
        "\t\t{",
        "\t\t\t\"id\": \"a\",",
        "\t\t\t\"type\": \"link\",",
        "\t\t\t\"url\": \"https://cos.example.com/test.png\"",
        "\t\t},",
        "\t\t{",
        "\t\t\t\"id\": \"b\",",
        "\t\t\t\"type\": \"file\",",
        "\t\t\t\"file\": \"other.png\"",
        "\t\t}",
        "\t]",
        "}",
      ].join("\n")
    );
    expect(plugin.app.vault.modify).toHaveBeenCalledWith(
      htmlFile,
      "<img src=\"![test.png](https://cos.example.com/test.png)\">"
    );
    expect(plugin.app.vault.delete).toHaveBeenCalledWith(testFile);
    expect(result.replaced).toBe(2);
    expect(result.deleted).toBe(1);
  });

  it("should skip invalid canvas JSON without crashing", () => {
    const file = { name: "test.png", path: "test.png" };
    const result = plugin.replaceCanvasAssetLinks(
      "{ invalid json",
      file,
      "https://cos.example.com/test.png"
    );

    expect(result).toEqual({
      content: "{ invalid json",
      replaced: 0,
    });
  });

  it("should keep the local file when upload succeeds but no references are found", async () => {
    const testFile = { name: "unused.png", path: "unused.png" };
    const noteFile = { name: "note.md", path: "note.md", extension: "md" };
    const plugin = Object.create(imageAutoUploadPlugin.prototype);

    plugin.app = {
      vault: {
        adapter: {
          getBasePath: () => "/vault",
        },
        getFiles: () => [testFile, noteFile],
        getMarkdownFiles: () => [noteFile],
        read: vi.fn(async () => "no local file reference"),
        modify: vi.fn(),
        delete: vi.fn(),
      },
    };
    plugin.uploader = {
      uploadFiles: vi.fn(async () => ({
        success: true,
        result: ["https://cos.example.com/unused.png"],
      })),
    };

    const result = await plugin.cleanupRootAssets();

    expect(plugin.app.vault.modify).not.toHaveBeenCalled();
    expect(plugin.app.vault.delete).not.toHaveBeenCalled();
    expect(result).toEqual({
      scanned: 1,
      uploaded: 1,
      replaced: 0,
      deleted: 0,
      failed: ["unused.png: 上传成功，但没有在笔记文件中找到引用，已保留本地文件"],
    });
  });
});
