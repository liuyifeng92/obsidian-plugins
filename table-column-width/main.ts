import {
	App,
	MarkdownView,
	Notice,
	Platform,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
} from "obsidian";
import {
	Decoration,
	DecorationSet,
	EditorView,
	ViewPlugin,
	ViewUpdate,
} from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import {
	minimalTextChange,
	normalizeMarkerSpacing,
	parseMarkerLine,
	parseTables,
	reconcileMarkers,
	upsertMarker,
	SourceTable,
} from "./src/marker";
import { calculateBleedLayout } from "./src/layout";
import { compareVersions } from "./src/update";

const FROZEN_CLASS = "tcw-frozen";
const SCROLL_CLASS = "tcw-scroll";
const HANDLES_CLASS = "tcw-handles";
const HANDLE_CLASS = "tcw-handle";
const COLGROUP_CLASS = "tcw-colgroup";
const MIN_COL_WIDTH = 40;
const MARKER_LINE_CLASS = "tcw-marker-line";
const MARKER_SPACER_LINE_CLASS = "tcw-marker-spacer-line";
const GITHUB_RAW_BASE =
	"https://raw.githubusercontent.com/liuyifeng92/obsidian-plugins/main/table-column-width";

interface TableColumnWidthSettings {
	autoUpdate: boolean;
}

const DEFAULT_SETTINGS: TableColumnWidthSettings = {
	autoUpdate: true,
};

// Live Preview 下标记行是可见文本（行内 span 带 cm-comment 类），CSS 无法按
// 文本内容选择，改用 ViewPlugin 给匹配标记行的整行加类，再由 CSS 隐藏
const markerLineDeco = Decoration.line({ class: MARKER_LINE_CLASS });
const markerSpacerLineDeco = Decoration.line({ class: MARKER_SPACER_LINE_CLASS });

function markerText(line: string): string {
	return line.replace(/^\s*(?:>\s*)*/, "");
}

function buildMarkerLineDecos(view: EditorView): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	for (const { from, to } of view.visibleRanges) {
		let pos = from;
		while (pos <= to) {
			const line = view.state.doc.lineAt(pos);
			const text = markerText(line.text);
			if (parseMarkerLine(text) !== null) {
				builder.add(line.from, line.from, markerLineDeco);
			} else if (
				text.trim() === "" &&
				line.number > 1 &&
				parseMarkerLine(markerText(view.state.doc.line(line.number - 1).text)) !== null
			) {
				builder.add(line.from, line.from, markerSpacerLineDeco);
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
	settings: TableColumnWidthSettings = DEFAULT_SETTINGS;
	private observer: MutationObserver | null = null;
	// 笔记路径 → 源码中解析出的表格及标记行，重渲染时据此恢复宽度
	private markers = new Map<string, SourceTable[]>();
	// 用户手动删除标记行后，本会话内保持该表格的原生 auto 布局
	private nativeTables = new Map<string, Set<number>>();
	private stopActiveDrag: (() => void) | null = null;
	private autoUpdateCheckTimer: number | null = null;
	private pendingAutoReloadTimer: number | null = null;
	private pendingAutoReloadVersion = "";

	async onload(): Promise<void> {
		await this.loadSettings();
		this.addSettingTab(new TableColumnWidthSettingTab(this.app, this));
		// Live Preview 中隐藏标记行（光标行除外，仍可编辑删除）
		this.registerEditorExtension(hideMarkerLines);
		this.app.workspace.onLayoutReady(() => {
			// OTA 重载时先清掉上一实例遗留的 DOM，再加载所有分栏的标记。
			this.restoreAllTables();
			void this.refreshVisibleMarkers().then(() => {
				this.freezeAll();
				this.layoutAllScrollAreas();
				this.startObserver();
			});
		});
		// 后台标签页中的表格渲染时容器可能没有布局（宽度为 0）会被跳过，
		// 切换回该标签页时补一次扫描
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
		this.scheduleAutoUpdateCheck();
	}

	onunload(): void {
		this.observer?.disconnect();
		this.stopActiveDrag?.();
		this.restoreAllTables();
		this.clearAutoUpdateCheckTimer();
		this.clearPendingAutoReloadTimer();
	}

	private async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private async refreshVisibleMarkers(): Promise<void> {
		const files = new Map<string, TFile>();
		for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
			const view = leaf.view;
			if (view instanceof MarkdownView && view.file) files.set(view.file.path, view.file);
		}
		await Promise.all(Array.from(files.values(), (file) => this.refreshMarkers(file)));
	}

	private async refreshMarkers(file: TFile | null): Promise<void> {
		if (!file || file.extension !== "md") return;
		const data = await this.app.vault.read(file);
		const normalized = normalizeMarkerSpacing(data);
		const next =
			normalized === data
				? data
				: await this.app.vault.process(file, (current) => normalizeMarkerSpacing(current));
		this.markers.set(file.path, parseTables(next));
	}

	// 表头比对的装配层：缓存中有旧表头时，编辑触发重算宽度并写回标记行。
	// 先读后比对、有变化才写，避免 process 无差别写文件造成 modify 循环；
	// 写回会再触发一次 modify，但此时表头与缓存一致、比对无改动，循环自然终止
	private async reconcileAndRefresh(file: TFile): Promise<void> {
		const cached = this.markers.get(file.path);
		if (!cached) return this.refreshMarkers(file);
		const data = await this.app.vault.read(file);
		const reconciled = reconcileMarkers(data, cached);
		let next = data;
		if (reconciled !== data) {
			next = await this.app.vault.process(file, (current) => reconcileMarkers(current, cached));
		}
		const parsed = parseTables(next);
		const native = this.nativeTables.get(file.path) ?? new Set<number>();
		const removed = new Set<number>();
		for (let i = 0; i < Math.max(cached.length, parsed.length); i++) {
			const sameHeaders =
				cached[i]?.headers.length === parsed[i]?.headers.length &&
				cached[i]?.headers.every((header, col) => header === parsed[i]?.headers[col]);
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
		if (!this.isNativeMarkdownTable(table)) return;
		if (table.closest(`.${SCROLL_CLASS}`)) return;

		const firstRow = table.rows[0];
		if (!firstRow) return;
		const colCount = firstRow.cells.length;
		if (colCount === 0) return;

		// 已落盘的表格优先按标记行恢复宽度；其余趁 auto 布局测量实际宽度（懒冻结的显示半边）
		const view = this.viewForTable(table);
		if (!view?.file) return;
		const index = this.tableIndex(table);
		if (index < 0 || this.nativeTables.get(view.file.path)?.has(index)) return;
		let widths: number[] | null = null;
		const entry = this.markers.get(view.file.path)?.[index];
		if (entry?.widths && entry.widths.length === colCount) widths = entry.widths;
		if (!widths) {
			// 趁表格仍是 auto 布局时测量每列实际宽度
			// （auto 布局下同列所有单元格宽度一致，读首行即可）
			widths = Array.from(firstRow.cells).map((cell) => cell.offsetWidth);
			if (widths.some((w) => w <= 0)) return;
		}
		this.applyFixedLayout(view, table, widths);

		// 拖动手柄仅桌面端提供；移动端只应用已存宽度
		if (view && !Platform.isMobile) this.attachHandles(view, table, widths);
	}

	private applyFixedLayout(
		view: MarkdownView,
		table: HTMLTableElement,
		widths: number[]
	): void {
		const total = widths.reduce((sum, w) => sum + w, 0);

		const colgroup = document.createElement("colgroup");
		colgroup.className = COLGROUP_CLASS;
		for (const w of widths) {
			const col = document.createElement("col");
			col.style.width = `${w}px`;
			colgroup.appendChild(col);
		}
		table.insertBefore(colgroup, table.firstChild);
		// fixed 布局下 Chrome 会把 auto 宽度的表格拉满容器，
		// 显式设置总宽，窄表格才能保持实际宽度左对齐不拉伸
		table.dataset.tcwOriginalWidth = table.style.width;
		table.style.width = `${total}px`;
		table.classList.add(FROZEN_CLASS);

		// 包一层滚动容器：总宽超出笔记区域时横向滚动
		const wrapper = document.createElement("div");
		wrapper.className = SCROLL_CLASS;
		table.parentElement?.insertBefore(wrapper, table);
		wrapper.appendChild(table);
		this.layoutScrollArea(view, wrapper, table);
		wrapper.scrollLeft = 0;
	}

	private layoutScrollArea(
		view: MarkdownView,
		wrapper: HTMLElement,
		table: HTMLTableElement
	): void {
		const content = wrapper.parentElement;
		const pane = table.closest(".markdown-source-view, .markdown-preview-view");
		if (!content || !pane || !view.containerEl.contains(pane)) return;
		const paneRect = pane.getBoundingClientRect();
		const contentRect = content.getBoundingClientRect();
		const layout = calculateBleedLayout(paneRect.left, paneRect.right, contentRect.left);
		wrapper.style.marginLeft = `${layout.marginLeft}px`;
		wrapper.style.paddingLeft = `${layout.paddingLeft}px`;
		wrapper.style.width = `${layout.width}px`;
	}

	private layoutAllScrollAreas(): void {
		document.querySelectorAll(`.${SCROLL_CLASS}`).forEach((element) => {
			if (!(element instanceof HTMLElement)) return;
			const table = element.querySelector(":scope > table");
			if (!(table instanceof HTMLTableElement)) return;
			const view = this.viewForTable(table);
			if (view) this.layoutScrollArea(view, element, table);
		});
	}

	private restoreTable(table: HTMLTableElement): void {
		const wrapper = table.parentElement;
		if (wrapper?.classList.contains(SCROLL_CLASS)) {
			wrapper.querySelector(`.${HANDLES_CLASS}`)?.remove();
			wrapper.parentElement?.insertBefore(table, wrapper);
			wrapper.remove();
		}
		table.querySelector(":scope > colgroup")?.remove();
		table.classList.remove(FROZEN_CLASS);
		if (table.dataset.tcwOriginalWidth !== undefined) {
			table.style.width = table.dataset.tcwOriginalWidth;
			delete table.dataset.tcwOriginalWidth;
		} else {
			table.style.removeProperty("width");
		}
	}

	private restoreAllTables(): void {
		document.querySelectorAll(`table.${FROZEN_CLASS}`).forEach((table) => {
			if (table instanceof HTMLTableElement) this.restoreTable(table);
		});
	}

	private restoreTables(path: string, indices: Set<number>): void {
		for (const table of Array.from(document.querySelectorAll(`table.${FROZEN_CLASS}`))) {
			if (!(table instanceof HTMLTableElement)) continue;
			const view = this.viewForTable(table);
			if (view?.file?.path !== path) continue;
			if (indices.has(this.tableIndex(table))) this.restoreTable(table);
		}
	}

	// 只接受 Obsidian 原生 Markdown 渲染容器，从源头排除 Canvas、嵌入和插件动态表格。
	private isNativeMarkdownTable(table: HTMLTableElement): boolean {
		if (table.closest(".canvas, .canvas-node, .canvas-node-content, .markdown-embed")) return false;
		if (table.closest('[class*="block-language-"], .dataview')) return false;
		if (table.closest(".cm-content")) {
			return (
				table.closest(".cm-table-widget") !== null ||
				(table.closest(".cm-callout") !== null && table.closest(".el-table") !== null)
			);
		}
		return table.closest(".markdown-preview-view") !== null && table.closest(".el-table") !== null;
	}

	// 表格在其视图中的序号（只数标记行匹配的表格），与 parseTables 的顺序一一对应
	private tableIndex(table: HTMLTableElement): number {
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
	private livePreviewIndex(table: HTMLTableElement, content: Element): number {
		let index = 0;
		let prevRaw = false;
		for (const child of Array.from(content.children)) {
			const isRawTableLine =
				child.classList.contains("HyperMD-table-line") &&
				!child.classList.contains("HyperMD-codeblock");
			if (isRawTableLine) {
				if (!prevRaw) index++; // 连续原始表格行 = 一张表
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
		this.stopActiveDrag?.();

		const onMove = (ev: MouseEvent) => {
			const next = Math.max(MIN_COL_WIDTH, Math.round(startWidth + ev.clientX - startX));
			if (next === widths[colIndex]) return;
			widths[colIndex] = next;
			(cols[colIndex] as HTMLElement).style.width = `${next}px`;
			table.style.width = `${widths.reduce((sum, w) => sum + w, 0)}px`;
			this.layoutHandles(handles, widths);
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
	private async persistWidths(
		view: MarkdownView,
		table: HTMLTableElement,
		widths: number[]
	): Promise<void> {
		const file = view.file;
		if (!file) return;
		const index = this.tableIndex(table);
		if (index < 0) return;
		const data = view.editor.getValue();
		const next = upsertMarker(data, index, widths);
		if (!next || next === data) return;
		const change = minimalTextChange(data, next);
		view.editor.transaction(
			{
				changes: [
					{
						from: view.editor.offsetToPos(change.from),
						to: view.editor.offsetToPos(change.to),
						text: change.text,
					},
				],
			},
			"table-column-width"
		);
		// 立即同步内存缓存，避免重渲染早于 modify 事件的刷新而读到旧标记
		this.markers.set(file.path, parseTables(next));
		this.nativeTables.get(file.path)?.delete(index);
	}

	async checkForUpdate(): Promise<{ hasUpdate: boolean; version: string; error?: string }> {
		try {
			const response = await fetch(`${GITHUB_RAW_BASE}/manifest.json`);
			if (response.status === 404) {
				return { hasUpdate: false, version: "", error: "not_found" };
			}
			if (!response.ok) {
				return { hasUpdate: false, version: "", error: `请求失败：${response.status}` };
			}

			const remoteManifest = (await response.json()) as { version?: string };
			const remoteVersion = remoteManifest.version ?? "";
			if (!remoteVersion) {
				return { hasUpdate: false, version: "", error: "远端版本号无效" };
			}
			return {
				hasUpdate: compareVersions(remoteVersion, this.manifest.version) > 0,
				version: remoteVersion,
			};
		} catch (error) {
			return { hasUpdate: false, version: "", error: String(error) };
		}
	}

	async performUpdate(
		version: string,
		onProgress?: (step: number, total: number) => void
	): Promise<void> {
		await this.downloadAndWriteUpdateFiles(onProgress);
		await this.reloadPlugin(version, false);
	}

	private async downloadAndWriteUpdateFiles(
		onProgress?: (step: number, total: number) => void
	): Promise<void> {
		const files = ["main.js", "manifest.json", "styles.css"] as const;
		const contents: Record<string, string> = {};
		for (let index = 0; index < files.length; index++) {
			const file = files[index];
			const response = await fetch(`${GITHUB_RAW_BASE}/${file}`);
			if (!response.ok) throw new Error(`下载 ${file} 失败：${response.status}`);
			contents[file] = await response.text();
			onProgress?.(index + 1, files.length);
		}

		const pluginDir = this.manifest.dir;
		if (!pluginDir) throw new Error("无法获取插件目录");
		await this.app.vault.adapter.write(`${pluginDir}/main.js`, contents["main.js"]);
		await this.app.vault.adapter.write(`${pluginDir}/manifest.json`, contents["manifest.json"]);
		await this.app.vault.adapter.write(`${pluginDir}/styles.css`, contents["styles.css"]);
	}

	private async reloadPlugin(version: string, auto: boolean): Promise<void> {
		const pluginId = this.manifest.id;
		const app = this.app;
		if (auto) {
			// @ts-ignore — Obsidian 内部 API
			const setting = app.setting;
			if (setting && setting.activeTab?.id === pluginId) {
				this.pendingAutoReloadVersion = version;
				this.watchPendingAutoReload();
				return;
			}
		}

		new Notice(auto ? `发现新版本（${version}），正在自动更新...` : `更新完成（${version}），正在重载插件...`);
		window.setTimeout(async () => {
			try {
				// @ts-ignore — Obsidian 内部 API
				await app.plugins.unloadPlugin(pluginId);
				// @ts-ignore — Obsidian 内部 API
				delete app.plugins.manifests[pluginId];
				await new Promise((resolve) => window.setTimeout(resolve, 300));
				// @ts-ignore — Obsidian 内部 API
				await app.plugins.loadManifests();
				await new Promise((resolve) => window.setTimeout(resolve, 300));
				// @ts-ignore — Obsidian 内部 API
				await app.plugins.loadPlugin(pluginId);
				// @ts-ignore — Obsidian 内部 API
				await app.plugins.enablePlugin(pluginId);
				await new Promise((resolve) => window.setTimeout(resolve, 500));
				// @ts-ignore — Obsidian 内部 API
				app.setting.open();
				// @ts-ignore — Obsidian 内部 API
				app.setting.openTabById(pluginId);
				new Notice(auto ? `插件已自动更新到 ${version}` : `插件已重载到 ${version}`);
			} catch (error) {
				console.error("[table-column-width] 重载失败:", error);
				new Notice("自动重载失败，请重启 Obsidian");
			}
		}, 100);
	}

	private watchPendingAutoReload(): void {
		this.clearPendingAutoReloadTimer();
		this.pendingAutoReloadTimer = window.setInterval(() => {
			// @ts-ignore — Obsidian 内部 API
			const setting = this.app.setting;
			if (!setting || setting.activeTab?.id !== this.manifest.id) {
				this.clearPendingAutoReloadTimer();
				const version = this.pendingAutoReloadVersion;
				this.pendingAutoReloadVersion = "";
				if (version) void this.reloadPlugin(version, true);
			}
		}, 1000);
	}

	private clearAutoUpdateCheckTimer(): void {
		if (this.autoUpdateCheckTimer !== null) {
			window.clearTimeout(this.autoUpdateCheckTimer);
			this.autoUpdateCheckTimer = null;
		}
	}

	private clearPendingAutoReloadTimer(): void {
		if (this.pendingAutoReloadTimer !== null) {
			window.clearInterval(this.pendingAutoReloadTimer);
			this.pendingAutoReloadTimer = null;
		}
	}

	private scheduleAutoUpdateCheck(): void {
		this.clearAutoUpdateCheckTimer();
		this.autoUpdateCheckTimer = window.setTimeout(() => {
			void this.runAutoUpdateCheck();
			this.registerInterval(
				window.setInterval(() => void this.runAutoUpdateCheck(), 60 * 60 * 1000)
			);
		}, 30 * 1000);
	}

	private async runAutoUpdateCheck(): Promise<void> {
		if (!this.settings.autoUpdate) return;
		const result = await this.checkForUpdate();
		if (result.error || !result.hasUpdate) return;
		try {
			new Notice(`发现新版本 ${result.version}，正在自动更新...`);
			await this.downloadAndWriteUpdateFiles();
			await this.reloadPlugin(result.version, true);
		} catch (error) {
			console.error("[table-column-width] 自动更新失败:", error);
		}
	}
}

class TableColumnWidthSettingTab extends PluginSettingTab {
	private isChecking = false;
	private isUpdating = false;
	private progress = 0;
	private latestVersion = "";
	private resultMessage = "";

	constructor(app: App, private plugin: TableColumnWidthPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h2", { text: "版本更新" });

		new Setting(containerEl)
			.setName("自动检查更新")
			.setDesc("启动 30 秒后检查，之后每 60 分钟自动检查并更新。")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.autoUpdate).onChange(async (value) => {
					this.plugin.settings.autoUpdate = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("当前版本")
			.setDesc(this.plugin.manifest.version)
			.addButton((button) => {
				button
					.setCta()
					.setButtonText(this.isChecking ? "检查中..." : "检查更新")
					.setDisabled(this.isChecking || this.isUpdating)
					.onClick(() => void this.checkForUpdate());
			});

		if (!this.resultMessage) return;
		const result = new Setting(containerEl).setName(this.resultMessage);
		if (this.latestVersion) {
			result.addButton((button) => {
				button
					.setCta()
					.setButtonText(this.isUpdating ? `更新中... （${this.progress}/3）` : "立即更新")
					.setDisabled(this.isUpdating)
					.onClick(() => void this.updateNow());
			});
		}
	}

	private async checkForUpdate(): Promise<void> {
		this.isChecking = true;
		this.latestVersion = "";
		this.resultMessage = "";
		this.display();
		const result = await this.plugin.checkForUpdate();
		this.isChecking = false;
		if (result.error === "not_found") {
			this.resultMessage = "未找到远端仓库，请检查网络";
		} else if (result.error) {
			this.resultMessage = result.error;
		} else if (result.hasUpdate) {
			this.latestVersion = result.version;
			this.resultMessage = `发现新版本 ${result.version}`;
		} else {
			this.resultMessage = `当前已是最新版本（${this.plugin.manifest.version}）`;
		}
		this.display();
	}

	private async updateNow(): Promise<void> {
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
			this.resultMessage = `更新失败：${String(error)}`;
			new Notice(this.resultMessage);
			this.display();
		}
	}
}
