import { App, Modal, Notice, setIcon } from "obsidian";

export function renderHtmlPreview(
  container: HTMLElement,
  source: string,
  app: App
): void {
  container.addClass("html-preview-container");

  const toolbar = container.createEl("div", { cls: "html-preview-toolbar" });

  const codeButton = toolbar.createEl("button", {
    cls: "html-preview-tool-button",
  });
  setIcon(codeButton, "code");
  codeButton.setAttribute("aria-label", "View source");

  const maximizeButton = toolbar.createEl("button", {
    cls: "html-preview-tool-button",
  });
  setIcon(maximizeButton, "maximize");
  maximizeButton.setAttribute("aria-label", "Open fullscreen preview");

  const deleteButton = toolbar.createEl("button", {
    cls: "html-preview-tool-button",
  });
  setIcon(deleteButton, "trash-2");
  deleteButton.setAttribute("aria-label", "Delete HTML preview");

  const frameWrapper = container.createEl("div", {
    cls: "html-preview-frame-wrapper",
  });

  const iframe = frameWrapper.createEl("iframe", {
    cls: "html-preview-iframe",
  });
  iframe.hide();

  const errorEl = frameWrapper.createEl("div", { cls: "html-preview-error" });
  errorEl.hide();

  const resizeHandle = container.createEl("div", {
    cls: "html-preview-resize-handle",
    attr: { "aria-label": "Resize preview" },
  });

  const trimmedSource = source.trim();
  let loadHtml: () => Promise<string>;

  if (trimmedSource.startsWith("path:")) {
    const filePath = trimmedSource.slice(5).trim();
    loadHtml = async () => {
      try {
        return await app.vault.adapter.read(filePath);
      } catch (error) {
        if (filePath.startsWith(".html-embeds/")) {
          const fallbackPath = filePath.replace(/^\.html-embeds\//, "html-embeds/");
          try {
            return await app.vault.adapter.read(fallbackPath);
          } catch {
            throw new Error(`HTML 文件未找到：${filePath}`);
          }
        }
        throw new Error(`HTML 文件未找到：${filePath}`);
      }
    };
  } else {
    loadHtml = async () => trimmedSource;
  }

  loadHtml()
    .then(html => {
      iframe.srcdoc = html;
      iframe.setAttribute("sandbox", "allow-same-origin allow-scripts");
      iframe.show();

      codeButton.addEventListener("click", async () => {
        try {
          const currentHtml = await loadHtml();
          openHtmlSourceModal(app, currentHtml);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          new Notice(message);
        }
      });

      maximizeButton.addEventListener("click", async () => {
        try {
          const currentHtml = await loadHtml();
          openHtmlPreviewModal(app, currentHtml);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          new Notice(message);
        }
      });

      deleteButton.addEventListener("click", () => {
        showDeleteConfirmPopover(deleteButton, async () => {
          await deleteHtmlPreviewBlock(app, source);
        });
      });
    })
    .catch(error => {
      const message = error instanceof Error ? error.message : String(error);
      errorEl.setText(message);
      errorEl.show();
    });

  setupResizeHandle(resizeHandle, container);
}

export function scanAndRenderHtmlPreviews(root: HTMLElement, app: App): void {
  const codeBlocks = root.querySelectorAll("pre > code.language-html-preview");
  codeBlocks.forEach(code => {
    const pre = code.parentElement as HTMLPreElement;
    const source = code.textContent || "";
    const container = document.createElement("div");
    renderHtmlPreview(container, source, app);
    pre.replaceWith(container);
  });
}

function setupResizeHandle(handle: HTMLElement, container: HTMLElement) {
  const MIN_HEIGHT = 150;

  function startResize(clientY: number) {
    const rect = container.getBoundingClientRect();
    const startHeight = rect.height;
    let rafId: number | null = null;
    let pendingY: number | null = null;

    const overlay = document.createElement("div");
    overlay.addClass("html-preview-resize-overlay");
    container.appendChild(overlay);

    document.body.style.cursor = "ns-resize";
    container.addClass("html-preview-resizing");

    function updateHeight(moveY: number) {
      const dy = moveY - clientY;
      const newHeight = Math.max(MIN_HEIGHT, startHeight + dy);
      container.style.height = `${newHeight}px`;
    }

    function onPointerMove(moveEvent: PointerEvent) {
      pendingY = moveEvent.clientY;
      if (rafId === null) {
        rafId = window.requestAnimationFrame(() => {
          if (pendingY !== null) {
            updateHeight(pendingY);
            pendingY = null;
          }
          rafId = null;
        });
      }
    }

    function onPointerUp() {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (pendingY !== null) {
        updateHeight(pendingY);
        pendingY = null;
      }
      overlay.remove();
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.body.style.cursor = "";
      container.removeClass("html-preview-resizing");
    }

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
  }

  handle.addEventListener("pointerdown", event => {
    event.preventDefault();
    startResize(event.clientY);
  });
}

function showDeleteConfirmPopover(
  button: HTMLElement,
  onConfirm: () => void | Promise<void>
) {
  document.querySelector(".html-preview-delete-popover")?.remove();

  const popover = document.createElement("div");
  popover.addClass("html-preview-delete-popover");

  popover.createEl("div", {
    cls: "html-preview-delete-message",
    text: "删除此 HTML 预览？",
  });

  const buttons = popover.createEl("div", {
    cls: "html-preview-delete-buttons",
  });

  const cancelButton = buttons.createEl("button", {
    cls: "html-preview-delete-cancel",
    text: "取消",
  });

  const confirmButton = buttons.createEl("button", {
    cls: "html-preview-delete-confirm mod-warning",
    text: "确认删除",
  });

  document.body.appendChild(popover);

  const rect = button.getBoundingClientRect();
  popover.style.left = `${rect.left}px`;
  popover.style.top = `${rect.bottom + 4}px`;

  const closePopover = () => popover.remove();

  function outsideClickHandler(event: MouseEvent) {
    const target = event.target as Node;
    if (!popover.contains(target) && !button.contains(target)) {
      closePopover();
    } else {
      document.addEventListener("click", outsideClickHandler, { once: true });
    }
  }

  window.setTimeout(() => {
    document.addEventListener("click", outsideClickHandler, { once: true });
  }, 0);

  cancelButton.addEventListener("click", closePopover);

  confirmButton.addEventListener("click", async () => {
    closePopover();
    await onConfirm();
  });
}

async function deleteHtmlPreviewBlock(app: App, source: string): Promise<void> {
  const activeFile = app.workspace.getActiveFile();
  if (!activeFile) {
    new Notice("未找到当前文件");
    return;
  }

  try {
    const content = await app.vault.read(activeFile);
    const trimmedSource = source.trim();

    const escapedSource = escapeRegExp(trimmedSource);
    const codeBlockRegex = new RegExp(
      "`{3,}\\s*html-preview\\s*\\n" + escapedSource + "\\n`{3,}\\s*\\n?",
      "g"
    );
    const newContent = content.replace(codeBlockRegex, "");

    if (newContent === content) {
      new Notice("未找到要删除的 HTML 预览代码块");
      return;
    }

    let sourceFileDeleted = false;

    if (trimmedSource.startsWith("path:")) {
      const filePath = trimmedSource.slice(5).trim();
      let referenceCount = 0;

      for (const mdFile of app.vault.getMarkdownFiles()) {
        const mdContent = await app.vault.read(mdFile);
        const matches = mdContent.match(
          new RegExp("path:" + escapeRegExp(filePath), "g")
        );
        if (matches) {
          referenceCount += matches.length;
        }
      }

      if (referenceCount <= 1) {
        try {
          await app.vault.adapter.remove(filePath);
          sourceFileDeleted = true;
        } catch (error) {
          console.error("Failed to remove HTML source file:", error);
        }
      }
    }

    await app.vault.modify(activeFile, newContent);

    if (sourceFileDeleted) {
      new Notice("已删除 HTML 预览");
    } else if (trimmedSource.startsWith("path:")) {
      new Notice("已删除 HTML 预览（源文件保留，仍有其他引用）");
    } else {
      new Notice("已删除 HTML 预览");
    }
  } catch (error) {
    console.error("Failed to delete HTML preview:", error);
    new Notice("删除 HTML 预览失败");
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function openHtmlSourceModal(app: App, source: string) {
  class HtmlSourceModal extends Modal {
    source: string;

    constructor(app: App, source: string) {
      super(app);
      this.source = source;
    }

    onOpen() {
      this.modalEl.addClass("html-preview-modal");

      const { contentEl } = this;
      contentEl.empty();

      const pre = contentEl.createEl("pre", { cls: "html-preview-source" });
      const code = pre.createEl("code");
      code.setText(this.source);
    }

    onClose() {
      const { contentEl } = this;
      contentEl.empty();
    }
  }

  new HtmlSourceModal(app, source).open();
}

function openHtmlPreviewModal(app: App, source: string) {
  class HtmlPreviewModal extends Modal {
    source: string;

    constructor(app: App, source: string) {
      super(app);
      this.source = source;
    }

    onOpen() {
      this.modalEl.addClass("html-preview-modal");

      const { contentEl } = this;
      contentEl.empty();

      const iframe = contentEl.createEl("iframe", {
        cls: "html-preview-modal-iframe",
      });
      iframe.srcdoc = this.source;
      iframe.setAttribute("sandbox", "allow-same-origin allow-scripts");
    }

    onClose() {
      const { contentEl } = this;
      contentEl.empty();
    }
  }

  new HtmlPreviewModal(app, source).open();
}
