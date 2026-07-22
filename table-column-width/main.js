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

// src/marker.ts
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
function parseHeaders(headerLine) {
  const trimmed = headerLine.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}
function parseTables(source) {
  const lines = source.split("\n");
  const tables = [];
  let inFence = false;
  let current = null;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith("```")) {
      inFence = !inFence;
      current = null;
      continue;
    }
    if (inFence || !trimmed.startsWith("|")) {
      current = null;
      continue;
    }
    if (current) continue;
    const widths = i > 0 ? parseMarkerLine(lines[i - 1]) : null;
    const headers = parseHeaders(trimmed);
    current = {
      startLine: i,
      colCount: headers.length,
      headers,
      markerLine: widths ? i - 1 : null,
      widths
    };
    tables.push(current);
  }
  return tables;
}
function upsertMarker(source, tableIndex, widths) {
  const table = parseTables(source)[tableIndex];
  if (!table || table.colCount !== widths.length) return null;
  const lines = source.split("\n");
  const marker = serializeMarkerLine(widths);
  if (table.markerLine !== null) {
    lines[table.markerLine] = marker;
  } else {
    lines.splice(table.startLine, 0, marker);
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
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
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
    lines[curr.markerLine] = serializeMarkerLine(
      reconcileWidths(prev.headers, curr.headers, prev.widths)
    );
    changed = true;
  }
  return changed ? lines.join("\n") : source;
}

// main.ts
var FROZEN_CLASS = "tcw-frozen";
var SCROLL_CLASS = "tcw-scroll";
var HANDLES_CLASS = "tcw-handles";
var HANDLE_CLASS = "tcw-handle";
var MIN_COL_WIDTH = 40;
var TableColumnWidthPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.observer = null;
    // 笔记路径 → 源码中解析出的表格及标记行，重渲染时据此恢复宽度
    this.markers = /* @__PURE__ */ new Map();
  }
  onload() {
    this.app.workspace.onLayoutReady(() => {
      void this.refreshMarkers(this.app.workspace.getActiveFile()).then(() => {
        this.freezeAll();
        this.startObserver();
      });
    });
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        void this.refreshMarkers(this.app.workspace.getActiveFile()).then(
          () => this.freezeAll()
        );
      })
    );
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file instanceof import_obsidian.TFile && file.extension === "md") {
          void this.reconcileAndRefresh(file);
        }
      })
    );
  }
  onunload() {
    this.observer?.disconnect();
  }
  async refreshMarkers(file) {
    if (!file || file.extension !== "md") return;
    this.markers.set(file.path, parseTables(await this.app.vault.read(file)));
  }
  // 表头比对的装配层：缓存中有旧表头时，编辑触发重算宽度并写回标记行。
  // 先读后比对、有变化才写，避免 process 无差别写文件造成 modify 循环；
  // 写回会再触发一次 modify，但此时表头与缓存一致、比对无改动，循环自然终止
  async reconcileAndRefresh(file) {
    const cached = this.markers.get(file.path);
    if (!cached) return this.refreshMarkers(file);
    const data = await this.app.vault.read(file);
    if (reconcileMarkers(data, cached) === data) {
      this.markers.set(file.path, parseTables(data));
      return;
    }
    const next = await this.app.vault.process(
      file,
      (current) => reconcileMarkers(current, cached)
    );
    this.markers.set(file.path, parseTables(next));
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
    document.querySelectorAll(".markdown-preview-view table").forEach((table) => {
      if (table instanceof HTMLTableElement) this.freezeTable(table);
    });
  }
  freezeTable(table) {
    if (table.classList.contains(FROZEN_CLASS)) return;
    if (!table.closest(".markdown-preview-view")) return;
    if (table.closest(".block-language-dataview, .block-language-dataviewjs, .dataview")) return;
    if (table.closest(`.${SCROLL_CLASS}`)) return;
    const firstRow = table.rows[0];
    if (!firstRow) return;
    const colCount = firstRow.cells.length;
    if (colCount === 0) return;
    const eligible = this.isMarkerEligible(table);
    const view = eligible ? this.viewForTable(table) : null;
    let widths = null;
    if (view?.file) {
      const entry = this.markers.get(view.file.path)?.[this.tableIndex(table)];
      if (entry?.widths && entry.widths.length === colCount) widths = entry.widths;
    }
    if (!widths) {
      widths = Array.from(firstRow.cells).map((cell) => cell.offsetWidth);
      if (widths.some((w) => w <= 0)) return;
    }
    this.applyFixedLayout(table, widths);
    if (view && !import_obsidian.Platform.isMobile) this.attachHandles(view, table, widths);
  }
  applyFixedLayout(table, widths) {
    const total = widths.reduce((sum, w) => sum + w, 0);
    const colgroup = document.createElement("colgroup");
    for (const w of widths) {
      const col = document.createElement("col");
      col.style.width = `${w}px`;
      colgroup.appendChild(col);
    }
    table.insertBefore(colgroup, table.firstChild);
    table.style.width = `${total}px`;
    table.classList.add(FROZEN_CLASS);
    const wrapper = document.createElement("div");
    wrapper.className = SCROLL_CLASS;
    table.parentElement?.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  }
  // 与 parseTables 的识别范围保持一致：
  // 嵌入笔记和 callout 内的表格只做内存冻结，不参与标记行匹配
  isMarkerEligible(table) {
    if (table.closest(".block-language-dataview, .block-language-dataviewjs, .dataview")) return false;
    if (table.closest(".markdown-embed, .callout")) return false;
    return true;
  }
  // 表格在其预览中的序号（只数标记行匹配的表格），与 parseTables 的顺序一一对应
  tableIndex(table) {
    const preview = table.closest(".markdown-preview-view");
    if (!preview) return -1;
    let index = 0;
    for (const candidate of Array.from(preview.querySelectorAll("table"))) {
      if (candidate === table) return index;
      if (this.isMarkerEligible(candidate)) index++;
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
    this.layoutHandles(handles, widths);
    wrapper.appendChild(overlay);
  }
  layoutHandles(handles, widths) {
    let right = 0;
    for (let i = 0; i < handles.length; i++) {
      right += widths[i];
      handles[i].style.left = `${right}px`;
    }
  }
  // 拖动过程中只改 DOM/CSS，不触发文件写入；松开鼠标才一次写入标记行
  startDrag(e, view, table, widths, colIndex, handles) {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = widths[colIndex];
    const cols = table.querySelectorAll("col");
    const onMove = (ev) => {
      const next = Math.max(MIN_COL_WIDTH, Math.round(startWidth + ev.clientX - startX));
      if (next === widths[colIndex]) return;
      widths[colIndex] = next;
      cols[colIndex].style.width = `${next}px`;
      table.style.width = `${widths.reduce((sum, w) => sum + w, 0)}px`;
      this.layoutHandles(handles, widths);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      void this.persistWidths(view, table, [...widths]);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }
  // 把整表当前宽度写入标记行：已有则替换，首次拖动的历史表格在此刻落盘冻结
  async persistWidths(view, table, widths) {
    const file = view.file;
    if (!file) return;
    const index = this.tableIndex(table);
    if (index < 0) return;
    const next = await this.app.vault.process(
      file,
      (data) => upsertMarker(data, index, widths) ?? data
    );
    this.markers.set(file.path, parseTables(next));
  }
};
