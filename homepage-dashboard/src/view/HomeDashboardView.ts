import { ItemView, WorkspaceLeaf, TFile } from "obsidian";
import { HomeDashboardPluginLike, DashboardLayout, AggregatedResult, RenderOptions, LAYOUT_OPTIONS } from "../types";
import { NoteAggregator } from "../aggregator/note-aggregator";
import { RENDERERS } from "../layouts/index";

export const VIEW_TYPE_HOME_DASHBOARD = "home-dashboard";

export class HomeDashboardView extends ItemView {
	plugin: HomeDashboardPluginLike;
	container: HTMLElement | null = null;
	aggregator: NoteAggregator;
	searchKeyword: string = "";
	currentLayout: DashboardLayout;
	private cssChangeTimer: number | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: HomeDashboardPluginLike) {
		super(leaf);
		this.plugin = plugin;
		this.aggregator = new NoteAggregator(
			this.app,
			plugin.settings.aggregatedFields,
			plugin.settings.dateFields,
			plugin.settings.excludedProjects,
			plugin.settings.excludedTypes
		);
		this.currentLayout = "dashboard";
	}

	getViewType(): string {
		return VIEW_TYPE_HOME_DASHBOARD;
	}

	getDisplayText(): string {
		return this.plugin.settings.homeViewTitle;
	}

	getIcon(): string {
		return "gauge";
	}

	async onOpen(): Promise<void> {
		this.container = this.contentEl.createDiv("home-dashboard-container");
		await this.render();

		this.registerEvent(
			this.app.workspace.on("css-change", () => {
				if (this.cssChangeTimer !== null) {
					window.clearTimeout(this.cssChangeTimer);
				}
				this.cssChangeTimer = window.setTimeout(() => {
					this.cssChangeTimer = null;
					void this.render();
				}, 150);
			})
		);
	}

	async onClose(): Promise<void> {
		if (this.cssChangeTimer !== null) {
			window.clearTimeout(this.cssChangeTimer);
			this.cssChangeTimer = null;
		}
		this.contentEl.empty();
		this.container = null;
		this.clearOrphanedTooltips();
	}

	async render(): Promise<void> {
		if (!this.container) {
			return;
		}

		this.clearOrphanedTooltips();
		this.container.empty();
		this.renderHeader();

		const loadingEl = this.container.createDiv("home-dashboard-loading");
		loadingEl.setText("正在汇总数据...");

		try {
			this.aggregator = new NoteAggregator(
				this.app,
				this.plugin.settings.aggregatedFields,
				this.plugin.settings.dateFields,
				this.plugin.settings.excludedProjects,
				this.plugin.settings.excludedTypes
			);
			const result = await this.aggregator.aggregate();

			loadingEl.remove();
			this.renderResult(result);
		} catch (error) {
			loadingEl.remove();
			const errorEl = this.container.createDiv("home-dashboard-error");
			errorEl.setText(`汇总失败：${error instanceof Error ? error.message : String(error)}`);
		}
	}

	private renderHeader(): void {
		if (!this.container) {
			return;
		}

		const header = this.container.createDiv("home-dashboard-header");
		header.createEl("h1", {
			text: this.plugin.settings.homeViewTitle,
			cls: "home-dashboard-title",
		});

		const actions = header.createDiv("home-dashboard-actions");

		const searchInput = actions.createEl("input", {
			type: "text",
			placeholder: "搜索分组或笔记...",
			cls: "home-dashboard-search",
		});
		searchInput.value = this.searchKeyword;
		searchInput.addEventListener("input", (event) => {
			this.searchKeyword = (event.target as HTMLInputElement).value.trim().toLowerCase();
			this.render();
		});

		const layoutSwitcher = actions.createDiv("home-dashboard-layout-switcher");
		for (const option of LAYOUT_OPTIONS) {
			const button = layoutSwitcher.createEl("button", {
				text: option.label,
				cls: `home-dashboard-layout-button ${option.value === this.currentLayout ? "is-active" : ""}`,
			});
			button.addEventListener("click", () => {
				this.currentLayout = option.value;
				this.render();
			});
		}

		const refreshButton = actions.createEl("button", { text: "刷新" });
		refreshButton.addEventListener("click", () => this.render());
	}

	private renderResult(result: AggregatedResult): void {
		if (!this.container) {
			return;
		}

		const fields = this.getSortedFields(result);
		if (fields.length === 0) {
			this.container.createDiv("home-dashboard-empty").setText("未配置汇总字段，请在设置中添加。");
			return;
		}

		const filteredResult = this.filterResult(result, fields);
		const renderer = RENDERERS[this.currentLayout] ?? RENDERERS.list;
		const options: RenderOptions = {
			plugin: this.plugin,
			app: this.app,
			layout: this.currentLayout,
			searchKeyword: this.searchKeyword,
			openNote: (file) => this.openNote(file),
		};
		renderer.render(this.container, filteredResult, options);
	}

	private getSortedFields(result: AggregatedResult): string[] {
		return Object.keys(result).filter((field) => field);
	}

	private filterResult(result: AggregatedResult, fields: string[]): AggregatedResult {
		const keyword = this.searchKeyword.toLowerCase();
		if (!keyword) {
			return result;
		}

		const filtered: AggregatedResult = {};
		for (const field of fields) {
			filtered[field] = {};
			const groups = result[field] || {};
			for (const groupKey of Object.keys(groups)) {
				const groupMatches = groupKey.toLowerCase().includes(keyword);
				const entries = groupMatches
					? groups[groupKey]
					: groups[groupKey].filter((entry) => entry.basename.toLowerCase().includes(keyword));
				if (entries.length > 0) {
					filtered[field][groupKey] = entries;
				}
			}
		}
		return filtered;
	}

	private openNote(file: TFile): void {
		this.app.workspace.getLeaf().openFile(file);
	}

	private clearOrphanedTooltips(): void {
		document.querySelectorAll(".home-dashboard-heatmap-tooltip").forEach((el) => el.remove());
	}
}
