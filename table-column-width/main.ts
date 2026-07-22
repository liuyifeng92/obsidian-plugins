import { MarkdownView, Platform, Plugin, TFile } from "obsidian";
import {
	Decoration,
	DecorationSet,
	EditorView,
	ViewPlugin,
	ViewUpdate,
} from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import {
	parseMarkerLine,
	parseTables,
	reconcileMarkers,
	upsertMarker,
	SourceTable,
} from "./src/marker";

const FROZEN_CLASS = "tcw-frozen";
const SCROLL_CLASS = "tcw-scroll";
const HANDLES_CLASS = "tcw-handles";
const HANDLE_CLASS = "tcw-handle";
const MIN_COL_WIDTH = 40;
const MARKER_LINE_CLASS = "tcw-marker-line";

// Live Preview 下标记行是可见文本（行内 span 带 cm-comment 类），CSS 无法按
// 文本内容选择，改用 ViewPlugin 给匹配标记行的整行加类，再由 CSS 隐藏
const markerLineDeco = Decoration.line({ class: MARKER_LINE_CLASS });

function buildMarkerLineDecos(view: EditorView): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	for (const { from, to } of view.visibleRanges) {
		let pos = from;
		while (pos <= to) {
			const line = view.state.doc.lineAt(pos);
			if (parseMarkerLine(line.text) !== null) {
				builder.add(line.from, line.from, markerLineDeco);
			}
			pos = line.to + 1;
		}
	}
	return builder.finish();
}

const hideMarkerLines = ViewPlugin.fromClass(
	class {
		decorations: DecorationSet;
		constructor(view: EditorView) {
			this.decorations = buildMarkerLineDecos(view);
		}
		update(update: ViewUpdate): void {
			if (update.docChanged || update.viewportChanged) {
				this.decorations = buildMarkerLineDecos(update.view);
			}
		}
	},
	{ decorations: (v) => v.decorations }
);

export default class TableColumnWidthPlugin extends Plugin {
	private observer: MutationObserver | null = null;
	// 笔记路径 → 源码中解析出的表格及标记行，重渲染时据此恢复宽度
	private markers = new Map<string, SourceTable[]>();

	onload(): void {
		// Live Preview 中隐藏标记行（光标行除外，仍可编辑删除）
		this.registerEditorExtension(hideMarkerLines);
		this.app.workspace.onLayoutReady(() => {
			// 先加载标记行缓存再冻结，保证首屏就按标记行恢复
			void this.refreshMarkers(this.app.workspace.getActiveFile()).then(() => {
				this.freezeAll();
				this.startObserver();
			});
		});
		// 后台标签页中的表格渲染时容器可能没有布局（宽度为 0）会被跳过，
		// 切换回该标签页时补一次扫描
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", () => {
				void this.refreshMarkers(this.app.workspace.getActiveFile()).then(() =>
					this.freezeAll()
				);
			})
		);
		// 用户编辑笔记后：先做表头比对（结构变化时自动维护标记行），
		// 再刷新缓存；Obsidian 随后重渲染，MutationObserver 冻结新表格时
		// 读到的就是最新标记。删除标记行也在此被缓存刷新感知
		this.registerEvent(
			this.app.vault.on("modify", (file) => {
				if (file instanceof TFile && file.extension === "md") {
					void this.reconcileAndRefresh(file);
				}
			})
		);
	}

	onunload(): void {
		this.observer?.disconnect();
	}

	private async refreshMarkers(file: TFile | null): Promise<void> {
		if (!file || file.extension !== "md") return;
		this.markers.set(file.path, parseTables(await this.app.vault.read(file)));
	}

	// 表头比对的装配层：缓存中有旧表头时，编辑触发重算宽度并写回标记行。
	// 先读后比对、有变化才写，避免 process 无差别写文件造成 modify 循环；
	// 写回会再触发一次 modify，但此时表头与缓存一致、比对无改动，循环自然终止
	private async reconcileAndRefresh(file: TFile): Promise<void> {
		const cached = this.markers.get(file.path);
		if (!cached) return this.refreshMarkers(file);
		const data = await this.app.vault.read(file);
		if (reconcileMarkers(data, cached) === data) {
			this.markers.set(file.path, parseTables(data));
			return;
		}
		const next = await this.app.vault.process(file, (current) =>
			reconcileMarkers(current, cached)
		);
		this.markers.set(file.path, parseTables(next));
	}

	// 用 MutationObserver 而不是 MarkdownPostProcessor：
	// 回调是微任务，在 DOM 插入之后、浏览器绘制之前执行，
	// 「测量 auto 宽度 → 应用固定布局」在同一帧内完成，无视觉跳变
	private startObserver(): void {
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

	private freezeAll(): void {
		document
			.querySelectorAll(".markdown-preview-view table, .cm-content table")
			.forEach((table) => {
				if (table instanceof HTMLTableElement) this.freezeTable(table);
			});
	}

	private freezeTable(table: HTMLTableElement): void {
		if (table.classList.contains(FROZEN_CLASS)) return;
		// 阅读模式表格与 Live Preview 表格（.cm-table-widget 内）都处理；
		// 纯源码模式没有渲染的表格，自然不涉及
		if (!table.closest(".markdown-preview-view") && !table.closest(".cm-content")) return;
		// Dataview 等插件渲染的动态表格不受影响
		if (table.closest(".block-language-dataview, .block-language-dataviewjs, .dataview")) return;
		if (table.closest(`.${SCROLL_CLASS}`)) return;

		const firstRow = table.rows[0];
		if (!firstRow) return;
		const colCount = firstRow.cells.length;
		if (colCount === 0) return;

		// 已落盘的表格优先按标记行恢复宽度；其余趁 auto 布局测量实际宽度（懒冻结的显示半边）
		const eligible = this.isMarkerEligible(table);
		const view = eligible ? this.viewForTable(table) : null;
		let widths: number[] | null = null;
		if (view?.file) {
			const entry = this.markers.get(view.file.path)?.[this.tableIndex(table)];
			if (entry?.widths && entry.widths.length === colCount) widths = entry.widths;
		}
		if (!widths) {
			// 趁表格仍是 auto 布局时测量每列实际宽度
			// （auto 布局下同列所有单元格宽度一致，读首行即可）
			widths = Array.from(firstRow.cells).map((cell) => cell.offsetWidth);
			if (widths.some((w) => w <= 0)) return;
		}
		this.applyFixedLayout(table, widths);

		// 拖动手柄仅桌面端提供；移动端只应用已存宽度
		if (view && !Platform.isMobile) this.attachHandles(view, table, widths);
	}

	private applyFixedLayout(table: HTMLTableElement, widths: number[]): void {
		const total = widths.reduce((sum, w) => sum + w, 0);

		const colgroup = document.createElement("colgroup");
		for (const w of widths) {
			const col = document.createElement("col");
			col.style.width = `${w}px`;
			colgroup.appendChild(col);
		}
		table.insertBefore(colgroup, table.firstChild);
		// fixed 布局下 Chrome 会把 auto 宽度的表格拉满容器，
		// 显式设置总宽，窄表格才能保持实际宽度左对齐不拉伸
		table.style.width = `${total}px`;
		table.classList.add(FROZEN_CLASS);

		// 包一层滚动容器：总宽超出笔记区域时横向滚动
		const wrapper = document.createElement("div");
		wrapper.className = SCROLL_CLASS;
		table.parentElement?.insertBefore(wrapper, table);
		wrapper.appendChild(table);
	}

	// 与 parseTables 的识别范围保持一致：
	// 嵌入笔记和 callout 内的表格只做内存冻结，不参与标记行匹配
	private isMarkerEligible(table: HTMLTableElement): boolean {
		if (table.closest(".block-language-dataview, .block-language-dataviewjs, .dataview")) return false;
		// .callout / .cm-callout 分别覆盖阅读模式与 Live Preview 的 callout 渲染
		if (table.closest(".markdown-embed, .callout, .cm-callout")) return false;
		return true;
	}

	// 表格在其视图中的序号（只数标记行匹配的表格），与 parseTables 的顺序一一对应
	private tableIndex(table: HTMLTableElement): number {
		const preview = table.closest(".markdown-preview-view");
		if (preview) {
			let index = 0;
			for (const candidate of Array.from(preview.querySelectorAll("table"))) {
				if (candidate === table) return index;
				if (this.isMarkerEligible(candidate)) index++;
			}
			return -1;
		}
		const content = table.closest(".cm-content");
		if (content && table.closest(".cm-table-widget")) {
			return this.livePreviewIndex(table, content);
		}
		return -1;
	}

	// Live Preview 的序号：按文档序遍历 .cm-content 的子元素，渲染的表格
	// 小部件与「光标所在表格展开成的原始行组」各占一个序号。漏数原始行组
	// 会使光标在某表格内时其后所有表格的序号错位
	private livePreviewIndex(table: HTMLTableElement, content: Element): number {
		let index = 0;
		let prevRaw = false;
		for (const child of Array.from(content.children)) {
			const isRawTableLine =
				child.classList.contains("HyperMD-table-line") &&
				!child.classList.contains("HyperMD-codeblock") &&
				!child.classList.contains("HyperMD-quote");
			if (isRawTableLine) {
				if (!prevRaw) index++; // 连续原始表格行 = 一张表
				prevRaw = true;
				continue;
			}
			prevRaw = false;
			for (const candidate of Array.from(child.querySelectorAll("table"))) {
				if (!(candidate instanceof HTMLTableElement)) continue;
				if (!this.isMarkerEligible(candidate)) continue;
				if (candidate === table) return index;
				index++;
			}
		}
		return -1;
	}

	private viewForTable(table: HTMLTableElement): MarkdownView | null {
		for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
			const view = leaf.view;
			if (view instanceof MarkdownView && view.containerEl.contains(table)) return view;
		}
		return null;
	}

	// 在每列右边缘放一个拖动手柄，跟随表格在滚动容器内一起滚动
	private attachHandles(view: MarkdownView, table: HTMLTableElement, widths: number[]): void {
		const wrapper = table.parentElement;
		if (!wrapper) return;
		const overlay = document.createElement("div");
		overlay.className = HANDLES_CLASS;
		overlay.style.left = `${table.offsetLeft}px`;
		overlay.style.top = `${table.offsetTop}px`;
		overlay.style.height = `${table.offsetHeight}px`;
		const handles: HTMLElement[] = [];
		for (let i = 0; i < widths.length; i++) {
			const handle = document.createElement("div");
			handle.className = HANDLE_CLASS;
			handle.addEventListener("mousedown", (e) =>
				this.startDrag(e, view, table, widths, i, handles)
			);
			overlay.appendChild(handle);
			handles.push(handle);
		}
		this.layoutHandles(handles, widths);
		wrapper.appendChild(overlay);
	}

	private layoutHandles(handles: HTMLElement[], widths: number[]): void {
		let right = 0;
		for (let i = 0; i < handles.length; i++) {
			right += widths[i];
			handles[i].style.left = `${right}px`;
		}
	}

	// 拖动过程中只改 DOM/CSS，不触发文件写入；松开鼠标才一次写入标记行
	private startDrag(
		e: MouseEvent,
		view: MarkdownView,
		table: HTMLTableElement,
		widths: number[],
		colIndex: number,
		handles: HTMLElement[]
	): void {
		e.preventDefault();
		// Live Preview 中阻止 CM6 接管 mousedown（移动光标/选中小部件）
		e.stopPropagation();
		const startX = e.clientX;
		const startWidth = widths[colIndex];
		const cols = table.querySelectorAll("col");

		const onMove = (ev: MouseEvent) => {
			const next = Math.max(MIN_COL_WIDTH, Math.round(startWidth + ev.clientX - startX));
			if (next === widths[colIndex]) return;
			widths[colIndex] = next;
			(cols[colIndex] as HTMLElement).style.width = `${next}px`;
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
	private async persistWidths(
		view: MarkdownView,
		table: HTMLTableElement,
		widths: number[]
	): Promise<void> {
		const file = view.file;
		if (!file) return;
		const index = this.tableIndex(table);
		if (index < 0) return;
		const next = await this.app.vault.process(
			file,
			(data) => upsertMarker(data, index, widths) ?? data
		);
		// 立即同步内存缓存，避免重渲染早于 modify 事件的刷新而读到旧标记
		this.markers.set(file.path, parseTables(next));
	}
}
