import { App, Modal, Notice, PluginSettingTab, Setting, TFile } from "obsidian";
import { DashboardCombination, HomeDashboardPluginLike, HomeDashboardSettings } from "../types";

const SETTING_TABS = ["通用", "字段配置", "数据组合", "版本更新"] as const;
type SettingTabId = (typeof SETTING_TABS)[number];

export const DEFAULT_SETTINGS: HomeDashboardSettings = {
	homeViewTitle: "FutureLAB",
	aggregatedFields: ["作者", "创建时间", "项目", "类型"],
	fieldAliases: {},
	dateFields: ["创建时间"],
	dashboardCombinations: [],
	autoUpdate: true,
	heatmapColor: "#28B80F",
	fieldDistributionColor: "#B01111",
	autoOpenOnStartup: true,
};

export class HomeDashboardSettingTab extends PluginSettingTab {
	plugin: HomeDashboardPluginLike;
	private isCheckingUpdate = false;
	private isUpdating = false;
	private updateProgress = 0;
	private updateResultMessage = "";
	private latestVersion = "";
	private activeTab: SettingTabId = "通用";

	constructor(app: App, plugin: HomeDashboardPluginLike) {
		super(app, plugin as any);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		this.renderTabs(containerEl);

		const contentEl = containerEl.createDiv({ cls: "home-dashboard-tab-content" });
		switch (this.activeTab) {
			case "通用":
				this.renderGeneralSettings(contentEl);
				break;
			case "字段配置":
				this.renderFieldConfig(contentEl);
				break;
			case "数据组合":
				this.renderCombinationsSection(contentEl);
				break;
			case "版本更新":
				this.renderVersionUpdateSection(contentEl);
				break;
		}
	}

	private renderTabs(containerEl: HTMLElement): void {
		const tabsEl = containerEl.createDiv({ cls: "home-dashboard-tabs" });
		for (const tabId of SETTING_TABS) {
			const button = tabsEl.createEl("button", {
				cls: `home-dashboard-tab ${tabId === this.activeTab ? "is-active" : ""}`,
				text: tabId,
			});
			button.onclick = () => {
				this.activeTab = tabId;
				this.display();
			};
		}
	}

	private renderGeneralSettings(contentEl: HTMLElement): void {
		new Setting(contentEl)
			.setName("自动打开 Dashboard")
			.setDesc("每次启动 Obsidian 或每天首次切回时自动进入 Dashboard。")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.autoOpenOnStartup).onChange(async (value) => {
					this.plugin.settings.autoOpenOnStartup = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(contentEl)
			.setName("主页标题")
			.setDesc("自定义主页视图的标题")
			.addText((text) =>
				text
					.setPlaceholder("主页")
					.setValue(this.plugin.settings.homeViewTitle)
					.onChange(async (value) => {
						this.plugin.settings.homeViewTitle = value || "主页";
						await this.plugin.saveSettings();
					})
			);

		new Setting(contentEl)
			.setName("热力图颜色")
			.setDesc("日期热力图方块的基础颜色")
			.addColorPicker((color) =>
				color
					.setValue(this.plugin.settings.heatmapColor)
					.onChange(async (value) => {
						this.plugin.settings.heatmapColor = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(contentEl)
			.setName("字段分布主色")
			.setDesc("字段分布图表（能力者、项目、类型）中使用的主色")
			.addColorPicker((color) =>
				color
					.setValue(this.plugin.settings.fieldDistributionColor)
					.onChange(async (value) => {
						this.plugin.settings.fieldDistributionColor = value;
						await this.plugin.saveSettings();
					})
			);
	}

	private renderFieldConfig(contentEl: HTMLElement): void {
		new Setting(contentEl)
			.setName("汇总字段")
			.setDesc("输入需要汇总的 YAML frontmatter 字段名，用英文逗号分隔（如 date, author, project, type）")
			.addTextArea((text) => {
				text
					.setPlaceholder("date, author, project, type")
					.setValue(this.plugin.settings.aggregatedFields.join(", "))
					.onChange(async (value) => {
						this.plugin.settings.aggregatedFields = parseCommaList(value);
						await this.plugin.saveSettings();
					});
				text.inputEl.rows = 3;
			});

		new Setting(contentEl)
			.setName("字段别名")
			.setDesc("每行一个映射，格式：字段名=显示名（如 date=日期）。未配置的字段将显示原字段名。")
			.addTextArea((text) => {
				text
					.setPlaceholder("date=日期\nauthor=作者")
					.setValue(formatRecord(this.plugin.settings.fieldAliases))
					.onChange(async (value) => {
						this.plugin.settings.fieldAliases = parseRecord(value);
						await this.plugin.saveSettings();
					});
				text.inputEl.rows = 5;
			});

		new Setting(contentEl)
			.setName("日期字段")
			.setDesc("哪些字段需要按年/月聚合？每行一个字段名（通常包含 date）")
			.addTextArea((text) => {
				text
					.setPlaceholder("date")
					.setValue(this.plugin.settings.dateFields.join("\n"))
					.onChange(async (value) => {
						this.plugin.settings.dateFields = parseLineList(value);
						await this.plugin.saveSettings();
					});
				text.inputEl.rows = 3;
			});

		this.renderScanSection(contentEl);
	}

	private renderVersionUpdateSection(containerEl: HTMLElement): void {
		containerEl.createEl("h2", { text: "版本更新" });
		containerEl.createEl("h3", { text: "homepage-dashboard" });
		containerEl.createDiv({
			cls: "auto-frontmatter-about-version",
			text: `当前版本：${this.plugin.manifest.version}`,
		});

		const actionEl = containerEl.createDiv({ cls: "auto-frontmatter-about-action" });
		const checkButton = actionEl.createEl("button", {
			cls: "mod-cta auto-frontmatter-about-check-btn",
			text: this.isCheckingUpdate ? "检查中..." : "检查更新",
		});
		checkButton.disabled = this.isCheckingUpdate || this.isUpdating;
		checkButton.onclick = async () => {
			this.isCheckingUpdate = true;
			this.updateResultMessage = "";
			this.latestVersion = "";
			this.display();

			const result = await this.plugin.checkForUpdate();
			this.isCheckingUpdate = false;

			if (result.error === "not_found") {
				new Notice("未找到远端仓库，请检查网络");
				this.updateResultMessage = "未找到远端仓库，请检查网络";
			} else if (result.error) {
				new Notice(result.error);
				this.updateResultMessage = result.error;
			} else if (result.hasUpdate) {
				this.latestVersion = result.version;
				this.updateResultMessage = `🔄 发现新版本：${result.version}（当前 ${this.plugin.manifest.version}）`;
			} else {
				this.updateResultMessage = `✅ 当前已是最新版本（${this.plugin.manifest.version}）`;
			}
			this.display();
		};

		if (this.updateResultMessage) {
			const resultEl = containerEl.createDiv({ cls: "auto-frontmatter-about-result" });
			resultEl.createDiv({ text: this.updateResultMessage });

			if (this.latestVersion) {
				const updateButton = resultEl.createEl("button", {
					cls: "mod-cta auto-frontmatter-about-update-btn",
					text: this.isUpdating ? `更新中...（${this.updateProgress}/3）` : "立即更新",
				});
				updateButton.disabled = this.isUpdating;
				updateButton.onclick = async () => {
					this.isUpdating = true;
					this.updateProgress = 0;
					this.display();

					try {
						await this.plugin.performUpdate(this.latestVersion, (step, total) => {
							this.updateProgress = step;
							this.display();
						});
						this.isUpdating = false;
						this.latestVersion = "";
						this.updateResultMessage = "";
					} catch (error) {
						this.isUpdating = false;
						new Notice(`更新失败：${error}`);
						this.updateResultMessage = `更新失败：${error}`;
					}
					this.display();
				};
			}
		}

		containerEl.createEl("h3", { text: "自动更新", cls: "auto-frontmatter-about-config-title" });
		new Setting(containerEl)
			.setName("自动检查更新")
			.setDesc("每 60 分钟自动检查并更新到最新版本。")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.autoUpdate).onChange(async (value) => {
					this.plugin.settings.autoUpdate = value;
					await this.plugin.saveSettings();
				}),
			);
	}

	private renderScanSection(containerEl: HTMLElement): void {
		const scanContainer = containerEl.createEl("div");
		scanContainer.style.marginBottom = "var(--size-4-3)";

		const header = scanContainer.createEl("div");
		header.style.display = "flex";
		header.style.justifyContent = "space-between";
		header.style.alignItems = "center";
		header.style.marginBottom = "var(--size-4-2)";

		const title = header.createEl("h3", { text: "扫描仓库字段" });
		title.style.margin = "0";

		const resultContainer = scanContainer.createEl("div");
		resultContainer.style.display = "flex";
		resultContainer.style.flexWrap = "wrap";
		resultContainer.style.gap = "var(--size-4-2)";

		const scanButton = header.createEl("button", { text: "扫描字段" });
		scanButton.addClass("mod-cta");
		scanButton.onclick = async () => {
			scanButton.setText("扫描中...");
			scanButton.disabled = true;

			const results = await this.scanFields();

			scanButton.setText("扫描字段");
			scanButton.disabled = false;
			resultContainer.empty();

			if (results.length === 0) {
				resultContainer.createEl("span", {
					text: "未找到任何 frontmatter 字段。",
					cls: "home-dashboard-scan-empty",
				});
				return;
			}

			for (const { field, files } of results) {
				const isSelected = this.plugin.settings.aggregatedFields.includes(field);
				const item = resultContainer.createEl("div", {
					cls: "home-dashboard-scan-item",
				});

				const tag = item.createEl("button", {
					text: field,
					cls: `home-dashboard-scan-tag ${isSelected ? "is-selected" : ""}`,
				});
				tag.disabled = isSelected;
				tag.title = isSelected ? "已添加到汇总字段" : "点击添加到汇总字段";
				tag.onclick = async () => {
					if (!this.plugin.settings.aggregatedFields.includes(field)) {
						this.plugin.settings.aggregatedFields.push(field);
						await this.plugin.saveSettings();
						this.display();
					}
				};

				if (files.length > 0) {
					const sourceBtn = item.createEl("button", {
						text: String(files.length),
						cls: "home-dashboard-scan-source-btn",
					});
					sourceBtn.title = "查看来源文件";
					sourceBtn.onclick = (e) => {
						e.stopPropagation();
						new FieldSourceModal(this.app, field, files).open();
					};
				}
			}
		};
	}

	private async scanFields(): Promise<{ field: string; files: string[] }[]> {
		const fieldMap = new Map<string, Set<string>>();
		const files = this.app.vault.getMarkdownFiles();
		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (cache?.frontmatter) {
				for (const key of Object.keys(cache.frontmatter)) {
					if (!fieldMap.has(key)) {
						fieldMap.set(key, new Set());
					}
					fieldMap.get(key)!.add(file.path);
				}
			}
		}
		return Array.from(fieldMap.entries())
			.map(([field, fileSet]) => ({ field, files: Array.from(fileSet).sort() }))
			.sort((a, b) => a.field.localeCompare(b.field));
	}

	private renderCombinationsSection(containerEl: HTMLElement): void {
		containerEl.createEl("h3", { text: "数据组合" });

		const descEl = containerEl.createEl("p", {
			text: "配置多组组合规则。每组组合包含一个名称和多个「字段=值」规则，用于在看板中筛选和展示数据。",
		});
		descEl.style.color = "var(--text-muted)";
		descEl.style.fontSize = "var(--font-smaller)";
		descEl.style.marginBottom = "var(--size-4-3)";

		const listContainer = containerEl.createEl("div");
		listContainer.style.display = "flex";
		listContainer.style.flexDirection = "column";
		listContainer.style.gap = "var(--size-4-3)";

		const renderList = (): void => {
			listContainer.empty();

			this.plugin.settings.dashboardCombinations.forEach((combination, combinationIndex) => {
				const card = listContainer.createEl("div");
				card.style.border = "1px solid var(--background-modifier-border)";
				card.style.borderRadius = "var(--radius-s)";
				card.style.padding = "var(--size-4-3)";
				card.style.backgroundColor = "var(--background-primary-alt)";

				// 组合名称行
				const nameRow = card.createEl("div");
				nameRow.style.display = "flex";
				nameRow.style.gap = "var(--size-4-2)";
				nameRow.style.alignItems = "center";
				nameRow.style.marginBottom = "var(--size-4-3)";

				const nameLabel = nameRow.createEl("label", { text: "组合名称" });
				nameLabel.style.fontWeight = "var(--font-semibold)";
				nameLabel.style.color = "var(--text-normal)";
				nameLabel.style.minWidth = "80px";

				const nameInput = nameRow.createEl("input");
				nameInput.type = "text";
				nameInput.placeholder = "例如：最近更新";
				nameInput.value = combination.name;
				nameInput.style.flex = "1";
				nameInput.style.padding = "var(--size-4-1) var(--size-4-2)";
				nameInput.style.border = "1px solid var(--background-modifier-border)";
				nameInput.style.borderRadius = "var(--radius-s)";
				nameInput.style.backgroundColor = "var(--background-primary)";
				nameInput.style.color = "var(--text-normal)";
				nameInput.onchange = async () => {
					this.plugin.settings.dashboardCombinations[combinationIndex].name = nameInput.value;
					await this.plugin.saveSettings();
				};

				const removeCombinationBtn = nameRow.createEl("button", { text: "删除组合" });
				removeCombinationBtn.addClass("mod-warning");
				removeCombinationBtn.onclick = async () => {
					this.plugin.settings.dashboardCombinations.splice(combinationIndex, 1);
					await this.plugin.saveSettings();
					renderList();
				};

				// 规则标题
				const rulesLabel = card.createEl("div", { text: "规则" });
				rulesLabel.style.fontWeight = "var(--font-semibold)";
				rulesLabel.style.color = "var(--text-normal)";
				rulesLabel.style.marginBottom = "var(--size-4-2)";

				// 规则列表
				const rulesContainer = card.createEl("div");
				rulesContainer.style.display = "flex";
				rulesContainer.style.flexDirection = "column";
				rulesContainer.style.gap = "var(--size-4-2)";
				rulesContainer.style.marginBottom = "var(--size-4-3)";

				combination.rules.forEach((rule, ruleIndex) => {
					const ruleRow = rulesContainer.createEl("div");
					ruleRow.style.display = "flex";
					ruleRow.style.gap = "var(--size-4-2)";
					ruleRow.style.alignItems = "center";

					const fieldInput = ruleRow.createEl("input");
					fieldInput.type = "text";
					fieldInput.placeholder = "字段";
					fieldInput.value = rule.field;
					fieldInput.style.flex = "1";
					fieldInput.style.padding = "var(--size-4-1) var(--size-4-2)";
					fieldInput.style.border = "1px solid var(--background-modifier-border)";
					fieldInput.style.borderRadius = "var(--radius-s)";
					fieldInput.style.backgroundColor = "var(--background-primary)";
					fieldInput.style.color = "var(--text-normal)";
					fieldInput.onchange = async () => {
						this.plugin.settings.dashboardCombinations[combinationIndex].rules[ruleIndex].field = fieldInput.value;
						await this.plugin.saveSettings();
					};

					const equalsLabel = ruleRow.createEl("span", { text: "=" });
					equalsLabel.style.color = "var(--text-muted)";
					equalsLabel.style.fontWeight = "var(--font-semibold)";

					const valueInput = ruleRow.createEl("input");
					valueInput.type = "text";
					valueInput.placeholder = "值";
					valueInput.value = rule.value;
					valueInput.style.flex = "1";
					valueInput.style.padding = "var(--size-4-1) var(--size-4-2)";
					valueInput.style.border = "1px solid var(--background-modifier-border)";
					valueInput.style.borderRadius = "var(--radius-s)";
					valueInput.style.backgroundColor = "var(--background-primary)";
					valueInput.style.color = "var(--text-normal)";
					valueInput.onchange = async () => {
						this.plugin.settings.dashboardCombinations[combinationIndex].rules[ruleIndex].value = valueInput.value;
						await this.plugin.saveSettings();
					};

					const removeRuleBtn = ruleRow.createEl("button", { text: "删除" });
					removeRuleBtn.addClass("mod-warning");
					removeRuleBtn.onclick = async () => {
						this.plugin.settings.dashboardCombinations[combinationIndex].rules.splice(ruleIndex, 1);
						await this.plugin.saveSettings();
						renderList();
					};
				});

				const addRuleBtn = card.createEl("button", { text: "+ 添加规则" });
				addRuleBtn.addClass("mod-cta");
				addRuleBtn.onclick = async () => {
					this.plugin.settings.dashboardCombinations[combinationIndex].rules.push({ field: "", value: "" });
					await this.plugin.saveSettings();
					renderList();
				};
			});
		};

		renderList();

		const addCombinationBtn = containerEl.createEl("button", { text: "+ 添加组合" });
		addCombinationBtn.addClass("mod-cta");
		addCombinationBtn.style.marginTop = "var(--size-4-2)";
		addCombinationBtn.onclick = async () => {
			const newCombination: DashboardCombination = {
				name: "",
				rules: [{ field: "", value: "" }],
			};
			this.plugin.settings.dashboardCombinations.push(newCombination);
			await this.plugin.saveSettings();
			renderList();
		};
	}
}

function parseCommaList(value: string): string[] {
	return value
		.split(",")
		.map((item) => item.trim())
		.filter((item) => item.length > 0);
}

function parseLineList(value: string): string[] {
	return value
		.split("\n")
		.map((item) => item.trim())
		.filter((item) => item.length > 0);
}

function parseRecord(value: string): Record<string, string> {
	const result: Record<string, string> = {};
	for (const line of value.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		const separatorIndex = trimmed.indexOf("=");
		if (separatorIndex === -1) continue;
		const key = trimmed.substring(0, separatorIndex).trim();
		const val = trimmed.substring(separatorIndex + 1).trim();
		if (key) {
			result[key] = val || key;
		}
	}
	return result;
}

function formatRecord(record: Record<string, string>): string {
	return Object.entries(record)
		.map(([key, value]) => `${key}=${value}`)
		.join("\n");
}

class FieldSourceModal extends Modal {
	private field: string;
	private files: string[];

	constructor(app: App, field: string, files: string[]) {
		super(app);
		this.field = field;
		this.files = files;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: `字段 "${this.field}" 的来源文件` });

		const desc = contentEl.createEl("p", {
			text: `共 ${this.files.length} 个文件包含此字段：`,
			cls: "home-dashboard-scan-modal-desc",
		});
		desc.style.color = "var(--text-muted)";
		desc.style.fontSize = "var(--font-smaller)";

		const list = contentEl.createEl("ul", { cls: "home-dashboard-scan-source-list" });
		for (const path of this.files) {
			const li = list.createEl("li", { cls: "home-dashboard-scan-source-item" });
			const link = li.createEl("a", {
				text: path,
				href: "#",
				cls: "home-dashboard-scan-source-link",
			});
			link.onclick = (e: MouseEvent) => {
				e.preventDefault();
				const file = this.app.vault.getAbstractFileByPath(path);
				if (file instanceof TFile) {
					this.app.workspace.getLeaf().openFile(file);
					this.close();
				}
			};
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
