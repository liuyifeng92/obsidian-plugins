import { Plugin } from "obsidian";

const FROZEN_CLASS = "tcw-frozen";
const SCROLL_CLASS = "tcw-scroll";

export default class TableColumnWidthPlugin extends Plugin {
	private observer: MutationObserver | null = null;

	onload(): void {
		this.app.workspace.onLayoutReady(() => {
			this.freezeAll();
			this.startObserver();
		});
		// 后台标签页中的表格渲染时容器可能没有布局（宽度为 0）会被跳过，
		// 切换回该标签页时补一次扫描
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", () => this.freezeAll())
		);
	}

	onunload(): void {
		this.observer?.disconnect();
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
		document.querySelectorAll(".markdown-preview-view table").forEach((table) => {
			if (table instanceof HTMLTableElement) this.freezeTable(table);
		});
	}

	// 懒冻结的显示半边：只在内存中冻结，不写标记行、不改动笔记文件
	private freezeTable(table: HTMLTableElement): void {
		if (table.classList.contains(FROZEN_CLASS)) return;
		// 只处理阅读模式渲染的表格（排除编辑模式 CM6 小部件等）
		if (!table.closest(".markdown-preview-view")) return;
		// Dataview 等插件渲染的动态表格不受影响
		if (table.closest(".block-language-dataview, .block-language-dataviewjs, .dataview")) return;
		if (table.closest(`.${SCROLL_CLASS}`)) return;

		const firstRow = table.rows[0];
		if (!firstRow) return;

		// 趁表格仍是 auto 布局时测量每列实际宽度
		// （auto 布局下同列所有单元格宽度一致，读首行即可）
		const widths = Array.from(firstRow.cells).map((cell) => cell.offsetWidth);
		if (widths.length === 0 || widths.some((w) => w <= 0)) return;
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
}
