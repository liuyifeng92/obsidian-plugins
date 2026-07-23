var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => TableColumnWidthPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var import_view = require("@codemirror/view");
var import_state = require("@codemirror/state");

// src/marker.ts
function minimalTextChange(before, after) {
  let from = 0;
  while (from < before.length && from < after.length && before[from] === after[from]) from++;
  let beforeEnd = before.length;
  let afterEnd = after.length;
  while (beforeEnd > from && afterEnd > from && before[beforeEnd - 1] === after[afterEnd - 1]) {
    beforeEnd--;
    afterEnd--;
  }
  return { from, to: beforeEnd, text: after.slice(from, afterEnd) };
}
function serializeMarkerLine(widths) {
  return `<!-- colwidths: ${widths.join(",")} -->`;
}
function parseMarkerLine(line) {
  const match = line.trim().match(/^<!--\s*colwidths:\s*(.*?)\s*-->$/);
  if (!match) return null;
  const parts = match[1].split(",").map((part) => part.trim());
  if (parts.some((part) => part === "")) return null;
  const widths = parts.map((part) => Number(part));
  if (widths.some((w) => !Number.isInteger(w) || w <= 0)) return null;
  return widths;
}
function isEscaped(line, index) {
  let slashes = 0;
  for (let i = index - 1; i >= 0 && line[i] === "\\"; i--) slashes++;
  return slashes % 2 === 1;
}
function splitTableRow(line) {
  let row = line.trim();
  let hasSeparator = false;
  for (let i = 0; i < row.length; i++) {
    if (row[i] === "|" && !isEscaped(row, i)) hasSeparator = true;
  }
  if (!hasSeparator) return null;
  if (row.startsWith("|")) row = row.slice(1);
  if (row.endsWith("|") && !isEscaped(row, row.length - 1)) row = row.slice(0, -1);
  const cells = [];
  let cell = "";
  for (let i = 0; i < row.length; i++) {
    if (row[i] === "|" && !isEscaped(row, i)) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += row[i];
    }
  }
  cells.push(cell.trim());
  return cells;
}
function splitContainerPrefix(line) {
  const prefix = line.match(/^(\s*(?:>\s*)*)/)?.[1] ?? "";
  return { prefix, content: line.slice(prefix.length) };
}
function sameContainer(a, b) {
  return a.replace(/\s/g, "") === b.replace(/\s/g, "");
}
function blankContainerLine(prefix) {
  return prefix.includes(">") ? prefix.trimEnd() : "";
}
function parseTables(source) {
  const lines = source.split("\n");
  const tables = [];
  let fence = null;
  for (let i = 0; i < lines.length; i++) {
    const { prefix, content } = splitContainerPrefix(lines[i]);
    const trimmed = content.trim();
    const fenceMatch = trimmed.match(/^(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker2 = fenceMatch[1];
      if (!fence) {
        fence = { char: marker2[0], length: marker2.length };
      } else if (marker2[0] === fence.char && marker2.length >= fence.length) {
        fence = null;
      }
      continue;
    }
    if (fence || i + 1 >= lines.length) continue;
    const headers = splitTableRow(trimmed);
    const next = splitContainerPrefix(lines[i + 1]);
    const delimiters = prefix === next.prefix ? splitTableRow(next.content) : null;
    if (!headers || !delimiters || headers.length !== delimiters.length || !delimiters.every((cell) => /^:?-{3,}:?$/.test(cell))) {
      continue;
    }
    let markerLine = i - 1;
    const previous = markerLine >= 0 ? splitContainerPrefix(lines[markerLine]) : null;
    if (previous && previous.content.trim() === "" && sameContainer(previous.prefix, prefix)) {
      markerLine--;
    }
    const marker = markerLine >= 0 ? splitContainerPrefix(lines[markerLine]) : null;
    const widths = marker && sameContainer(marker.prefix, prefix) ? parseMarkerLine(marker.content) : null;
    tables.push({
      startLine: i,
      colCount: headers.length,
      headers,
      markerLine: widths ? markerLine : null,
      widths
    });
    i++;
  }
  return tables;
}
function normalizeMarkerSpacing(source) {
  const lines = source.split("\n");
  const immediate = parseTables(source).filter(
    (table) => table.markerLine !== null && table.startLine === table.markerLine + 1
  );
  for (let i = immediate.length - 1; i >= 0; i--) {
    const table = immediate[i];
    const { prefix } = splitContainerPrefix(lines[table.startLine]);
    lines.splice(table.startLine, 0, blankContainerLine(prefix));
  }
  return immediate.length > 0 ? lines.join("\n") : source;
}
function upsertMarker(source, tableIndex, widths) {
  const table = parseTables(source)[tableIndex];
  if (!table || table.colCount !== widths.length) return null;
  const lines = source.split("\n");
  const marker = serializeMarkerLine(widths);
  if (table.markerLine !== null) {
    const { prefix } = splitContainerPrefix(lines[table.markerLine]);
    lines[table.markerLine] = `${prefix}${marker}`;
    if (table.startLine === table.markerLine + 1) {
      const tablePrefix = splitContainerPrefix(lines[table.startLine]).prefix;
      lines.splice(table.startLine, 0, blankContainerLine(tablePrefix));
    }
  } else {
    const { prefix } = splitContainerPrefix(lines[table.startLine]);
    lines.splice(table.startLine, 0, `${prefix}${marker}`, blankContainerLine(prefix));
  }
  return lines.join("\n");
}
var DEFAULT_COL_WIDTH = 120;
function lcsPairs(oldSeq, newSeq) {
  const m = oldSeq.length;
  const n = newSeq.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i2 = m - 1; i2 >= 0; i2--) {
    for (let j2 = n - 1; j2 >= 0; j2--) {
      dp[i2][j2] = oldSeq[i2] === newSeq[j2] ? dp[i2 + 1][j2 + 1] + 1 : Math.max(dp[i2 + 1][j2], dp[i2][j2 + 1]);
    }
  }
  const pairs = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (oldSeq[i] === newSeq[j]) {
      pairs.push([i, j]);
      i++;
      j++;
    } else if (dp[i + 1][j] > dp[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }
  return pairs;
}
function reconcileWidths(oldHeaders, newHeaders, oldWidths) {
  const kept = /* @__PURE__ */ new Map();
  for (const [oldIndex, newIndex] of lcsPairs(oldHeaders, newHeaders)) {
    if (oldIndex < oldWidths.length) kept.set(newIndex, oldWidths[oldIndex]);
  }
  return newHeaders.map((_, i) => kept.get(i) ?? DEFAULT_COL_WIDTH);
}
function reconcileMarkers(source, cached) {
  const byStartLine = new Map(cached.map((t) => [t.startLine, t]));
  const lines = source.split("\n");
  let changed = false;
  for (const curr of parseTables(source)) {
    const prev = byStartLine.get(curr.startLine);
    if (!prev?.widths || curr.markerLine === null) continue;
    const unchanged = prev.headers.length === curr.headers.length && prev.headers.every((h, i) => h === curr.headers[i]);
    if (unchanged) continue;
    const { prefix } = splitContainerPrefix(lines[curr.markerLine]);
    lines[curr.markerLine] = `${prefix}${serializeMarkerLine(
      reconcileWidths(prev.headers, curr.headers, prev.widths)
    )}`;
    changed = true;
  }
  return changed ? lines.join("\n") : source;
}

// src/layout.ts
function calculateBleedLayout(paneLeft, paneRight, contentLeft) {
  const leftInset = Math.max(0, contentLeft - paneLeft);
  return {
    marginLeft: leftInset === 0 ? 0 : -leftInset,
    paddingLeft: leftInset,
    width: Math.max(0, paneRight - paneLeft)
  };
}

// src/scroll.ts
function preserveScrollTop(target, update) {
  const scrollTop = target?.scrollTop;
  update();
  if (!target || scrollTop === void 0) return;
  target.scrollTop = scrollTop;
  requestAnimationFrame(() => {
    if (target.isConnected) target.scrollTop = scrollTop;
  });
}

// src/update.ts
function compareVersions(v1, v2) {
  const parseVersion = (version) => version.replace(/^v/, "").split(/[+-]/, 1)[0].split(".").map((part) => {
    const match = /^\d+/.exec(part);
    return match ? parseInt(match[0], 10) : 0;
  });
  const parts1 = parseVersion(v1);
  const parts2 = parseVersion(v2);
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const difference = (parts1[i] ?? 0) - (parts2[i] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

// main.ts
var FROZEN_CLASS = "tcw-frozen";
var SCROLL_CLASS = "tcw-scroll";
var HANDLES_CLASS = "tcw-handles";
var HANDLE_CLASS = "tcw-handle";
var COLGROUP_CLASS = "tcw-colgroup";
var MIN_COL_WIDTH = 40;
var MARKER_LINE_CLASS = "tcw-marker-line";
var MARKER_SPACER_LINE_CLASS = "tcw-marker-spacer-line";
var GITHUB_RAW_BASE = "https://raw.githubusercontent.com/liuyifeng92/obsidian-plugins/main/table-column-width";
var DEFAULT_SETTINGS = {
  autoUpdate: true
};
var markerLineDeco = import_view.Decoration.line({ class: MARKER_LINE_CLASS });
var markerSpacerLineDeco = import_view.Decoration.line({ class: MARKER_SPACER_LINE_CLASS });
function markerText(line) {
  return line.replace(/^\s*(?:>\s*)*/, "");
}
function buildMarkerLineDecos(view) {
  const builder = new import_state.RangeSetBuilder();
  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = view.state.doc.lineAt(pos);
      const text = markerText(line.text);
      if (parseMarkerLine(text) !== null) {
        builder.add(line.from, line.from, markerLineDeco);
      } else if (text.trim() === "" && line.number > 1 && parseMarkerLine(markerText(view.state.doc.line(line.number - 1).text)) !== null) {
        builder.add(line.from, line.from, markerSpacerLineDeco);
      }
      pos = line.to + 1;
    }
  }
  return builder.finish();
}
var hideMarkerLines = import_view.ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.decorations = buildMarkerLineDecos(view);
    }
    update(update) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildMarkerLineDecos(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations }
);
var TableColumnWidthPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
    this.observer = null;
    // 笔记路径 → 源码中解析出的表格及标记行，重渲染时据此恢复宽度
    this.markers = /* @__PURE__ */ new Map();
    // 用户手动删除标记行后，本会话内保持该表格的原生 auto 布局
    this.nativeTables = /* @__PURE__ */ new Map();
    this.stopActiveDrag = null;
    this.autoUpdateCheckTimer = null;
    this.pendingAutoReloadTimer = null;
    this.pendingAutoReloadVersion = "";
  }
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new TableColumnWidthSettingTab(this.app, this));
    this.registerEditorExtension(hideMarkerLines);
    this.app.workspace.onLayoutReady(() => {
      this.restoreAllTables();
      void this.refreshVisibleMarkers().then(() => {
        this.freezeAll();
        this.layoutAllScrollAreas();
        this.startObserver();
      });
    });
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        void this.refreshVisibleMarkers().then(() => {
          this.freezeAll();
          this.layoutAllScrollAreas();
        });
      })
    );
    this.registerEvent(
      this.app.workspace.on("resize", () => this.layoutAllScrollAreas())
    );
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file instanceof import_obsidian.TFile && file.extension === "md") {
          void this.reconcileAndRefresh(file);
        }
      })
    );
    this.scheduleAutoUpdateCheck();
  }
  onunload() {
    this.observer?.disconnect();
    this.stopActiveDrag?.();
    this.restoreAllTables();
    this.clearAutoUpdateCheckTimer();
    this.clearPendingAutoReloadTimer();
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  async refreshVisibleMarkers() {
    const files = /* @__PURE__ */ new Map();
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (view instanceof import_obsidian.MarkdownView && view.file) files.set(view.file.path, view.file);
    }
    await Promise.all(Array.from(files.values(), (file) => this.refreshMarkers(file)));
  }
  async refreshMarkers(file) {
    if (!file || file.extension !== "md") return;
    const data = await this.app.vault.read(file);
    const normalized = normalizeMarkerSpacing(data);
    const next = normalized === data ? data : await this.app.vault.process(file, (current) => normalizeMarkerSpacing(current));
    this.markers.set(file.path, parseTables(next));
  }
  // 表头比对的装配层：缓存中有旧表头时，编辑触发重算宽度并写回标记行。
  // 先读后比对、有变化才写，避免 process 无差别写文件造成 modify 循环；
  // 写回会再触发一次 modify，但此时表头与缓存一致、比对无改动，循环自然终止
  async reconcileAndRefresh(file) {
    const cached = this.markers.get(file.path);
    if (!cached) return this.refreshMarkers(file);
    const data = await this.app.vault.read(file);
    const reconciled = reconcileMarkers(data, cached);
    let next = data;
    if (reconciled !== data) {
      next = await this.app.vault.process(file, (current) => reconcileMarkers(current, cached));
    }
    const parsed = parseTables(next);
    const native = this.nativeTables.get(file.path) ?? /* @__PURE__ */ new Set();
    const removed = /* @__PURE__ */ new Set();
    for (let i = 0; i < Math.max(cached.length, parsed.length); i++) {
      const sameHeaders = cached[i]?.headers.length === parsed[i]?.headers.length && cached[i]?.headers.every((header, col) => header === parsed[i]?.headers[col]);
      if (sameHeaders && cached[i]?.widths && !parsed[i]?.widths) {
        native.add(i);
        removed.add(i);
      } else if (parsed[i]?.widths) {
        native.delete(i);
      }
    }
    if (native.size > 0) this.nativeTables.set(file.path, native);
    else this.nativeTables.delete(file.path);
    this.markers.set(file.path, parsed);
    if (removed.size > 0) this.restoreTables(file.path, removed);
    this.freezeAll();
  }
  // 用 MutationObserver 而不是 MarkdownPostProcessor：
  // 回调是微任务，在 DOM 插入之后、浏览器绘制之前执行，
  // 「测量 auto 宽度 → 应用固定布局」在同一帧内完成，无视觉跳变
  startObserver() {
    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLTableElement) {
            this.freezeTable(node);
          } else if (node instanceof HTMLElement) {
            node.querySelectorAll("table").forEach((table) => this.freezeTable(table));
          }
        });
      }
    });
    this.observer.observe(document.body, { childList: true, subtree: true });
    this.register(() => this.observer?.disconnect());
  }
  freezeAll() {
    document.querySelectorAll(".markdown-preview-view table, .cm-content table").forEach((table) => {
      if (table instanceof HTMLTableElement) this.freezeTable(table);
    });
  }
  freezeTable(table) {
    if (table.classList.contains(FROZEN_CLASS)) return;
    if (!this.isNativeMarkdownTable(table)) return;
    const firstRow = table.rows[0];
    if (!firstRow) return;
    const colCount = firstRow.cells.length;
    if (colCount === 0) return;
    const view = this.viewForTable(table);
    if (!view?.file) return;
    const index = this.tableIndex(table);
    if (index < 0 || this.nativeTables.get(view.file.path)?.has(index)) return;
    let widths = null;
    const entry = this.markers.get(view.file.path)?.[index];
    if (entry?.widths && entry.widths.length === colCount) widths = entry.widths;
    if (!widths) {
      widths = Array.from(firstRow.cells).map((cell) => cell.offsetWidth);
      if (widths.some((w) => w <= 0)) return;
    }
    this.applyFixedLayout(view, table, widths);
    if (view && !import_obsidian.Platform.isMobile) this.attachHandles(view, table, widths);
  }
  applyFixedLayout(view, table, widths) {
    const total = widths.reduce((sum, w) => sum + w, 0);
    const colgroup = document.createElement("colgroup");
    colgroup.className = COLGROUP_CLASS;
    for (const w of widths) {
      const col = document.createElement("col");
      col.style.width = `${w}px`;
      colgroup.appendChild(col);
    }
    table.insertBefore(colgroup, table.firstChild);
    table.dataset.tcwOriginalWidth = table.style.width;
    table.style.width = `${total}px`;
    if (table.parentElement?.classList.contains("table-wrapper")) {
      table.parentElement.style.width = `${total}px`;
    }
    table.classList.add(FROZEN_CLASS);
    const livePreviewHost = table.closest(".cm-table-widget");
    if (livePreviewHost instanceof HTMLElement) {
      livePreviewHost.querySelectorAll(`.${HANDLES_CLASS}`).forEach((element) => element.remove());
      livePreviewHost.classList.add(SCROLL_CLASS);
      this.layoutScrollArea(view, livePreviewHost, table);
      livePreviewHost.scrollLeft = 0;
      return;
    }
    const wrapper = document.createElement("div");
    wrapper.className = SCROLL_CLASS;
    table.parentElement?.insertBefore(wrapper, table);
    wrapper.appendChild(table);
    this.layoutScrollArea(view, wrapper, table);
    wrapper.scrollLeft = 0;
  }
  layoutScrollArea(view, wrapper, table) {
    const content = wrapper.parentElement;
    const pane = table.closest(".markdown-source-view, .markdown-preview-view");
    if (!content || !pane || !view.containerEl.contains(pane)) return;
    const isLivePreview = wrapper.classList.contains("cm-table-widget");
    const scrollLeft = wrapper.scrollLeft;
    if (isLivePreview) {
      wrapper.scrollLeft = 0;
      wrapper.style.removeProperty("margin-left");
      wrapper.style.removeProperty("padding-left");
      wrapper.style.removeProperty("width");
    }
    const paneRect = pane.getBoundingClientRect();
    const contentLeft = isLivePreview ? table.getBoundingClientRect().left : content.getBoundingClientRect().left;
    const layout = calculateBleedLayout(paneRect.left, paneRect.right, contentLeft);
    wrapper.style.setProperty(
      "margin-left",
      `${layout.marginLeft}px`,
      isLivePreview ? "important" : ""
    );
    wrapper.style.paddingLeft = `${layout.paddingLeft}px`;
    wrapper.style.width = `${layout.width}px`;
    if (isLivePreview) wrapper.scrollLeft = scrollLeft;
  }
  layoutAllScrollAreas() {
    document.querySelectorAll(`.${SCROLL_CLASS}`).forEach((element) => {
      if (!(element instanceof HTMLElement)) return;
      const table = element.querySelector(`table.${FROZEN_CLASS}`);
      if (!(table instanceof HTMLTableElement)) return;
      const view = this.viewForTable(table);
      if (view) this.layoutScrollArea(view, element, table);
    });
  }
  restoreTable(table) {
    const scrollArea = table.closest(`.${SCROLL_CLASS}`);
    scrollArea?.querySelector(`.${HANDLES_CLASS}`)?.remove();
    if (scrollArea instanceof HTMLElement && scrollArea === table.parentElement) {
      scrollArea.parentElement?.insertBefore(table, scrollArea);
      scrollArea.remove();
    } else if (scrollArea instanceof HTMLElement) {
      scrollArea.classList.remove(SCROLL_CLASS);
      scrollArea.style.removeProperty("margin-left");
      scrollArea.style.removeProperty("padding-left");
      scrollArea.style.removeProperty("width");
      if (table.parentElement?.classList.contains("table-wrapper")) {
        table.parentElement.style.removeProperty("width");
      }
    }
    table.querySelector(":scope > colgroup")?.remove();
    table.classList.remove(FROZEN_CLASS);
    if (table.dataset.tcwOriginalWidth !== void 0) {
      table.style.width = table.dataset.tcwOriginalWidth;
      delete table.dataset.tcwOriginalWidth;
    } else {
      table.style.removeProperty("width");
    }
  }
  restoreAllTables() {
    document.querySelectorAll(`table.${FROZEN_CLASS}`).forEach((table) => {
      if (table instanceof HTMLTableElement) this.restoreTable(table);
    });
  }
  restoreTables(path, indices) {
    for (const table of Array.from(document.querySelectorAll(`table.${FROZEN_CLASS}`))) {
      if (!(table instanceof HTMLTableElement)) continue;
      const view = this.viewForTable(table);
      if (view?.file?.path !== path) continue;
      if (indices.has(this.tableIndex(table))) this.restoreTable(table);
    }
  }
  // 只接受 Obsidian 原生 Markdown 渲染容器，从源头排除 Canvas、嵌入和插件动态表格。
  isNativeMarkdownTable(table) {
    if (table.closest(".canvas, .canvas-node, .canvas-node-content, .markdown-embed")) return false;
    if (table.closest('[class*="block-language-"], .dataview')) return false;
    if (table.closest(".cm-content")) {
      return table.closest(".cm-table-widget") !== null || table.closest(".cm-callout") !== null && table.closest(".el-table") !== null;
    }
    return table.closest(".markdown-preview-view") !== null && table.closest(".el-table") !== null;
  }
  // 表格在其视图中的序号（只数标记行匹配的表格），与 parseTables 的顺序一一对应
  tableIndex(table) {
    const preview = table.closest(".markdown-preview-view");
    if (preview) {
      let index = 0;
      for (const candidate of Array.from(preview.querySelectorAll("table"))) {
        if (candidate === table) return index;
        if (candidate instanceof HTMLTableElement && this.isNativeMarkdownTable(candidate)) index++;
      }
      return -1;
    }
    const content = table.closest(".cm-content");
    if (content && table.closest(".cm-table-widget, .cm-callout")) {
      return this.livePreviewIndex(table, content);
    }
    return -1;
  }
  // Live Preview 的序号：按文档序遍历 .cm-content 的子元素，渲染的表格
  // 小部件与「光标所在表格展开成的原始行组」各占一个序号。漏数原始行组
  // 会使光标在某表格内时其后所有表格的序号错位
  livePreviewIndex(table, content) {
    let index = 0;
    let prevRaw = false;
    for (const child of Array.from(content.children)) {
      const isRawTableLine = child.classList.contains("HyperMD-table-line") && !child.classList.contains("HyperMD-codeblock");
      if (isRawTableLine) {
        if (!prevRaw) index++;
        prevRaw = true;
        continue;
      }
      prevRaw = false;
      for (const candidate of Array.from(child.querySelectorAll("table"))) {
        if (!(candidate instanceof HTMLTableElement)) continue;
        if (!this.isNativeMarkdownTable(candidate)) continue;
        if (candidate === table) return index;
        index++;
      }
    }
    return -1;
  }
  viewForTable(table) {
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (view instanceof import_obsidian.MarkdownView && view.containerEl.contains(table)) return view;
    }
    return null;
  }
  // 在每列右边缘放一个拖动手柄，跟随表格在滚动容器内一起滚动
  attachHandles(view, table, widths) {
    const wrapper = table.parentElement;
    if (!wrapper) return;
    const overlay = document.createElement("div");
    overlay.className = HANDLES_CLASS;
    overlay.style.left = `${table.offsetLeft}px`;
    overlay.style.top = `${table.offsetTop}px`;
    overlay.style.height = `${table.offsetHeight}px`;
    const handles = [];
    for (let i = 0; i < widths.length; i++) {
      const handle = document.createElement("div");
      handle.className = HANDLE_CLASS;
      handle.addEventListener(
        "mousedown",
        (e) => this.startDrag(e, view, table, widths, i, handles)
      );
      overlay.appendChild(handle);
      handles.push(handle);
    }
    this.layoutHandles(table, handles);
    wrapper.appendChild(overlay);
  }
  layoutHandles(table, handles) {
    const cells = table.rows[0]?.cells;
    if (!cells) return;
    const tableLeft = table.getBoundingClientRect().left;
    for (let i = 0; i < handles.length; i++) {
      const cell = cells[i];
      if (cell) handles[i].style.left = `${cell.getBoundingClientRect().right - tableLeft}px`;
    }
  }
  // 拖动过程中只改 DOM/CSS，不触发文件写入；松开鼠标才一次写入标记行
  startDrag(e, view, table, widths, colIndex, handles) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = widths[colIndex];
    const cols = table.querySelectorAll("col");
    this.stopActiveDrag?.();
    const onMove = (ev) => {
      const next = Math.max(MIN_COL_WIDTH, Math.round(startWidth + ev.clientX - startX));
      if (next === widths[colIndex]) return;
      widths[colIndex] = next;
      cols[colIndex].style.width = `${next}px`;
      const total = widths.reduce((sum, w) => sum + w, 0);
      table.style.width = `${total}px`;
      if (table.parentElement?.classList.contains("table-wrapper")) {
        table.parentElement.style.width = `${total}px`;
      }
      this.layoutHandles(table, handles);
    };
    const cleanup = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (this.stopActiveDrag === cleanup) this.stopActiveDrag = null;
    };
    const onUp = () => {
      cleanup();
      if (widths[colIndex] !== startWidth) {
        void this.persistWidths(view, table, [...widths]);
      }
    };
    this.stopActiveDrag = cleanup;
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }
  // 把整表当前宽度写入标记行：已有则替换，首次拖动的历史表格在此刻落盘冻结
  async persistWidths(view, table, widths) {
    const file = view.file;
    if (!file) return;
    const index = this.tableIndex(table);
    if (index < 0) return;
    const data = view.editor.getValue();
    const next = upsertMarker(data, index, widths);
    if (!next || next === data) return;
    const change = minimalTextChange(data, next);
    const sourceScroller = table.closest(".markdown-source-view")?.querySelector(".cm-scroller");
    const scrollTarget = sourceScroller instanceof HTMLElement ? sourceScroller : table.closest(".markdown-preview-view");
    preserveScrollTop(
      scrollTarget,
      () => view.editor.transaction(
        {
          changes: [
            {
              from: view.editor.offsetToPos(change.from),
              to: view.editor.offsetToPos(change.to),
              text: change.text
            }
          ]
        },
        "table-column-width"
      )
    );
    this.markers.set(file.path, parseTables(next));
    this.nativeTables.get(file.path)?.delete(index);
  }
  async checkForUpdate() {
    try {
      const response = await fetch(`${GITHUB_RAW_BASE}/manifest.json`);
      if (response.status === 404) {
        return { hasUpdate: false, version: "", error: "not_found" };
      }
      if (!response.ok) {
        return { hasUpdate: false, version: "", error: `\u8BF7\u6C42\u5931\u8D25\uFF1A${response.status}` };
      }
      const remoteManifest = await response.json();
      const remoteVersion = remoteManifest.version ?? "";
      if (!remoteVersion) {
        return { hasUpdate: false, version: "", error: "\u8FDC\u7AEF\u7248\u672C\u53F7\u65E0\u6548" };
      }
      return {
        hasUpdate: compareVersions(remoteVersion, this.manifest.version) > 0,
        version: remoteVersion
      };
    } catch (error) {
      return { hasUpdate: false, version: "", error: String(error) };
    }
  }
  async performUpdate(version, onProgress) {
    await this.downloadAndWriteUpdateFiles(onProgress);
    await this.reloadPlugin(version, false);
  }
  async downloadAndWriteUpdateFiles(onProgress) {
    const files = ["main.js", "manifest.json", "styles.css"];
    const contents = {};
    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      const response = await fetch(`${GITHUB_RAW_BASE}/${file}`);
      if (!response.ok) throw new Error(`\u4E0B\u8F7D ${file} \u5931\u8D25\uFF1A${response.status}`);
      contents[file] = await response.text();
      onProgress?.(index + 1, files.length);
    }
    const pluginDir = this.manifest.dir;
    if (!pluginDir) throw new Error("\u65E0\u6CD5\u83B7\u53D6\u63D2\u4EF6\u76EE\u5F55");
    await this.app.vault.adapter.write(`${pluginDir}/main.js`, contents["main.js"]);
    await this.app.vault.adapter.write(`${pluginDir}/manifest.json`, contents["manifest.json"]);
    await this.app.vault.adapter.write(`${pluginDir}/styles.css`, contents["styles.css"]);
  }
  async reloadPlugin(version, auto) {
    const pluginId = this.manifest.id;
    const app = this.app;
    if (auto) {
      const setting = app.setting;
      if (setting && setting.activeTab?.id === pluginId) {
        this.pendingAutoReloadVersion = version;
        this.watchPendingAutoReload();
        return;
      }
    }
    new import_obsidian.Notice(auto ? `\u53D1\u73B0\u65B0\u7248\u672C\uFF08${version}\uFF09\uFF0C\u6B63\u5728\u81EA\u52A8\u66F4\u65B0...` : `\u66F4\u65B0\u5B8C\u6210\uFF08${version}\uFF09\uFF0C\u6B63\u5728\u91CD\u8F7D\u63D2\u4EF6...`);
    window.setTimeout(async () => {
      try {
        await app.plugins.unloadPlugin(pluginId);
        delete app.plugins.manifests[pluginId];
        await new Promise((resolve) => window.setTimeout(resolve, 300));
        await app.plugins.loadManifests();
        await new Promise((resolve) => window.setTimeout(resolve, 300));
        await app.plugins.loadPlugin(pluginId);
        await app.plugins.enablePlugin(pluginId);
        await new Promise((resolve) => window.setTimeout(resolve, 500));
        app.setting.open();
        app.setting.openTabById(pluginId);
        new import_obsidian.Notice(auto ? `\u63D2\u4EF6\u5DF2\u81EA\u52A8\u66F4\u65B0\u5230 ${version}` : `\u63D2\u4EF6\u5DF2\u91CD\u8F7D\u5230 ${version}`);
      } catch (error) {
        console.error("[table-column-width] \u91CD\u8F7D\u5931\u8D25:", error);
        new import_obsidian.Notice("\u81EA\u52A8\u91CD\u8F7D\u5931\u8D25\uFF0C\u8BF7\u91CD\u542F Obsidian");
      }
    }, 100);
  }
  watchPendingAutoReload() {
    this.clearPendingAutoReloadTimer();
    this.pendingAutoReloadTimer = window.setInterval(() => {
      const setting = this.app.setting;
      if (!setting || setting.activeTab?.id !== this.manifest.id) {
        this.clearPendingAutoReloadTimer();
        const version = this.pendingAutoReloadVersion;
        this.pendingAutoReloadVersion = "";
        if (version) void this.reloadPlugin(version, true);
      }
    }, 1e3);
  }
  clearAutoUpdateCheckTimer() {
    if (this.autoUpdateCheckTimer !== null) {
      window.clearTimeout(this.autoUpdateCheckTimer);
      this.autoUpdateCheckTimer = null;
    }
  }
  clearPendingAutoReloadTimer() {
    if (this.pendingAutoReloadTimer !== null) {
      window.clearInterval(this.pendingAutoReloadTimer);
      this.pendingAutoReloadTimer = null;
    }
  }
  scheduleAutoUpdateCheck() {
    this.clearAutoUpdateCheckTimer();
    this.autoUpdateCheckTimer = window.setTimeout(() => {
      void this.runAutoUpdateCheck();
      this.registerInterval(
        window.setInterval(() => void this.runAutoUpdateCheck(), 60 * 60 * 1e3)
      );
    }, 30 * 1e3);
  }
  async runAutoUpdateCheck() {
    if (!this.settings.autoUpdate) return;
    const result = await this.checkForUpdate();
    if (result.error || !result.hasUpdate) return;
    try {
      new import_obsidian.Notice(`\u53D1\u73B0\u65B0\u7248\u672C ${result.version}\uFF0C\u6B63\u5728\u81EA\u52A8\u66F4\u65B0...`);
      await this.downloadAndWriteUpdateFiles();
      await this.reloadPlugin(result.version, true);
    } catch (error) {
      console.error("[table-column-width] \u81EA\u52A8\u66F4\u65B0\u5931\u8D25:", error);
    }
  }
};
var TableColumnWidthSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.isChecking = false;
    this.isUpdating = false;
    this.progress = 0;
    this.latestVersion = "";
    this.resultMessage = "";
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "\u7248\u672C\u66F4\u65B0" });
    new import_obsidian.Setting(containerEl).setName("\u81EA\u52A8\u68C0\u67E5\u66F4\u65B0").setDesc("\u542F\u52A8 30 \u79D2\u540E\u68C0\u67E5\uFF0C\u4E4B\u540E\u6BCF 60 \u5206\u949F\u81EA\u52A8\u68C0\u67E5\u5E76\u66F4\u65B0\u3002").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.autoUpdate).onChange(async (value) => {
        this.plugin.settings.autoUpdate = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("\u5F53\u524D\u7248\u672C").setDesc(this.plugin.manifest.version).addButton((button) => {
      button.setCta().setButtonText(this.isChecking ? "\u68C0\u67E5\u4E2D..." : "\u68C0\u67E5\u66F4\u65B0").setDisabled(this.isChecking || this.isUpdating).onClick(() => void this.checkForUpdate());
    });
    if (!this.resultMessage) return;
    const result = new import_obsidian.Setting(containerEl).setName(this.resultMessage);
    if (this.latestVersion) {
      result.addButton((button) => {
        button.setCta().setButtonText(this.isUpdating ? `\u66F4\u65B0\u4E2D... \uFF08${this.progress}/3\uFF09` : "\u7ACB\u5373\u66F4\u65B0").setDisabled(this.isUpdating).onClick(() => void this.updateNow());
      });
    }
  }
  async checkForUpdate() {
    this.isChecking = true;
    this.latestVersion = "";
    this.resultMessage = "";
    this.display();
    const result = await this.plugin.checkForUpdate();
    this.isChecking = false;
    if (result.error === "not_found") {
      this.resultMessage = "\u672A\u627E\u5230\u8FDC\u7AEF\u4ED3\u5E93\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC";
    } else if (result.error) {
      this.resultMessage = result.error;
    } else if (result.hasUpdate) {
      this.latestVersion = result.version;
      this.resultMessage = `\u53D1\u73B0\u65B0\u7248\u672C ${result.version}`;
    } else {
      this.resultMessage = `\u5F53\u524D\u5DF2\u662F\u6700\u65B0\u7248\u672C\uFF08${this.plugin.manifest.version}\uFF09`;
    }
    this.display();
  }
  async updateNow() {
    this.isUpdating = true;
    this.progress = 0;
    this.display();
    try {
      await this.plugin.performUpdate(this.latestVersion, (step) => {
        this.progress = step;
        this.display();
      });
    } catch (error) {
      this.isUpdating = false;
      this.resultMessage = `\u66F4\u65B0\u5931\u8D25\uFF1A${String(error)}`;
      new import_obsidian.Notice(this.resultMessage);
      this.display();
    }
  }
};
