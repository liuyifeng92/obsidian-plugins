import { App, setIcon } from "obsidian";
import { AggregatedResult, DashboardCombination, LayoutRenderer, NoteEntry, RenderOptions } from "../types";
import { appendTag, formatDate, getFieldValue, hexToRgb, loadSummary } from "./dashboard-helpers";
import { renderFieldDistribution } from "./dashboard-field-renderer";

interface HeatmapDay {
	date: Date;
	dateKey: string;
	count: number;
	entries: NoteEntry[];
}

interface HeatmapWeek {
	days: (HeatmapDay | null)[];
}

export class DashboardRenderer implements LayoutRenderer {
	render(container: HTMLElement, result: AggregatedResult, options: RenderOptions): void {
		container.empty();

		const { plugin, app, searchKeyword, openNote } = options;
		const dateFields = plugin.settings.dateFields;
		const allFields = Object.keys(result);
		const nonDateFields = allFields.filter((field) => !dateFields.includes(field));

		if (allFields.length === 0) {
			renderEmpty(container, "未配置汇总字段，请在设置中添加。");
			return;
		}

		const flattened = flattenResult(result);
		const uniqueFiles = new Set(flattened.map((entry) => entry.path));
		const frontmatterFiles = new Set(flattened.map((entry) => entry.path));

		// 介绍区副标题
		const intro = container.createDiv("kd-dashboard-intro");
		intro.createEl("p", { cls: "kd-dashboard-subtitle", text: "洞察知识沉淀趋势，掌握内容生产与结构分布" });

		// 1) 日期热力图 + 2) 字段分布：共享一个 wrapper，使两者底框宽度一致
		const sectionsWrapper = container.createDiv("home-dashboard-sections-wrapper");

		const dateFieldsWithData = allFields.filter((field) => dateFields.includes(field));
		if (dateFieldsWithData.length > 0) {
			const section = sectionsWrapper.createDiv("home-dashboard-section");
			renderHeatmap(section, result, dateFieldsWithData, searchKeyword, openNote, app, plugin.settings.heatmapColor);
		}

		if (nonDateFields.length > 0) {
			const section = sectionsWrapper.createDiv("home-dashboard-section kd-field-section");
			renderFieldDistribution(section, result, plugin.settings.fieldAliases, app, openNote, plugin.settings.fieldDistributionColor);
		}

		// 4) 数据组合卡片区
		const combinations = plugin.settings.dashboardCombinations || [];
		if (combinations.length > 0) {
			const section = container.createDiv("home-dashboard-section");
			section.createEl("h2", { cls: "home-dashboard-section-title", text: "数据组合" });
			renderCombinationCards(section, combinations, result, searchKeyword, openNote, plugin.settings.fieldAliases);
		}

		if (uniqueFiles.size === 0) {
			renderEmpty(container, "未找到任何匹配笔记。");
		}
	}
}

function renderMetric(container: HTMLElement, label: string, value: string): void {
	const item = container.createDiv("kd-metric-item");
	item.createDiv("kd-metric-value").setText(value);
	item.createDiv("kd-metric-label").setText(label);
}

function countRecentDateNotes(result: AggregatedResult, dateFields: string[], days: number): number {
	const cutoff = new Date();
	cutoff.setHours(0, 0, 0, 0);
	cutoff.setDate(cutoff.getDate() - days + 1);

	const paths = new Set<string>();
	for (const field of dateFields) {
		const groups = result[field];
		if (!groups) {
			continue;
		}
		for (const groupKey of Object.keys(groups)) {
			const date = parseIsoDate(groupKey);
			if (!date || date < cutoff) {
				continue;
			}
			for (const entry of groups[groupKey]) {
				paths.add(entry.path);
			}
		}
	}
	return paths.size;
}

function renderHeatmap(
	container: HTMLElement,
	result: AggregatedResult,
	dateFields: string[],
	searchKeyword: string,
	openNote: (file: NoteEntry["file"]) => void,
	app: App,
	heatmapColor: string
): void {
	const currentYear = new Date().getFullYear();
	let selectedYear = currentYear;
	let selectedAuthor = "";

	// 作者列表：从 result["作者"] 聚合，并建立 path -> authors 映射
	const authorGroups = result["作者"] ?? {};
	const authorNames = Object.keys(authorGroups).sort((a, b) => a.localeCompare(b, "zh-CN"));
	const pathToAuthors = new Map<string, string[]>();
	for (const [author, entries] of Object.entries(authorGroups)) {
		for (const entry of entries) {
			if (!pathToAuthors.has(entry.path)) {
				pathToAuthors.set(entry.path, []);
			}
			pathToAuthors.get(entry.path)!.push(author);
		}
	}

	// 标题行：左侧标题 + 右侧能力者/年份选择
	const header = container.createDiv("home-dashboard-section-header");
	header.createEl("h2", { cls: "home-dashboard-section-title", text: "日期热力图" });

	const controls = header.createDiv("home-dashboard-heatmap-controls");

	const authorSelect = controls.createEl("select", { cls: "home-dashboard-year-select" });
	authorSelect.createEl("option", { text: "全员", value: "" });
	for (const name of authorNames) {
		authorSelect.createEl("option", { text: name, value: name });
	}

	const yearSelect = controls.createEl("select", { cls: "home-dashboard-year-select" });
	for (let y = currentYear - 5; y <= currentYear + 1; y++) {
		const option = yearSelect.createEl("option", { text: `${y}年`, value: String(y) });
		if (y === selectedYear) {
			option.selected = true;
		}
	}

	const heatmapContainer = container.createDiv("home-dashboard-heatmap-container");

	const renderContent = () => {
		heatmapContainer.empty();

		const startDate = new Date(selectedYear, 0, 1);
		const endDate = new Date(selectedYear, 11, 31);
		startDate.setHours(0, 0, 0, 0);
		endDate.setHours(0, 0, 0, 0);

		const dayMap = new Map<string, HeatmapDay>();
		for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
			const key = formatDateKey(d);
			dayMap.set(key, { date: new Date(d), dateKey: key, count: 0, entries: [] });
		}

		for (const field of dateFields) {
			const groups = result[field];
			if (!groups) {
				continue;
			}
			for (const groupKey of Object.keys(groups)) {
				const date = parseIsoDate(groupKey);
				if (!date || date.getFullYear() !== selectedYear) {
					continue;
				}
				const key = formatDateKey(date);
				const day = dayMap.get(key);
				if (!day) {
					continue;
				}
				for (const entry of groups[groupKey]) {
					if (!entryMatches(entry, searchKeyword)) {
						continue;
					}
					if (selectedAuthor) {
						const authors = pathToAuthors.get(entry.path) ?? [];
						if (!authors.includes(selectedAuthor)) {
							continue;
						}
					}
					day.entries.push(entry);
					day.count++;
				}
			}
		}

		const wrapper = heatmapContainer.createDiv("home-dashboard-heatmap-scroll");

		// 星期标签列
		const weekdayCol = wrapper.createDiv("home-dashboard-heatmap-weekdays");
		const weekdays = ["一", "二", "三", "四", "五", "六", "日"];
		for (let i = 0; i < 7; i++) {
			const label = weekdayCol.createDiv("home-dashboard-heatmap-weekday-label");
			label.setText(i % 2 === 0 ? weekdays[i] : "");
		}

		const heatmap = wrapper.createDiv("home-dashboard-heatmap");
		heatmap.style.display = "flex";
		heatmap.style.flexDirection = "row";
		heatmap.style.gap = "4px";

		const weeks = buildHeatmapWeeks(startDate, endDate, dayMap);
		let isFirstWeek = true;
		for (const week of weeks) {
			const isMonthStart = week.days.some((day) => day?.date.getDate() === 1);
			if (isMonthStart && !isFirstWeek) {
				const spacer = heatmap.createDiv();
				spacer.style.width = "4px";
				spacer.style.flexShrink = "0";
			}
			isFirstWeek = false;

			const weekEl = heatmap.createDiv();
			weekEl.style.display = "flex";
			weekEl.style.flexDirection = "column";
			weekEl.style.gap = "4px";

			const monthLabel = weekEl.createDiv("home-dashboard-heatmap-month-label");
			const firstDayOfMonth = week.days.find((day) => day?.date.getDate() === 1);
			if (firstDayOfMonth) {
				monthLabel.setText(`${firstDayOfMonth.date.getMonth() + 1}月`);
			}

			for (const day of week.days) {
				if (!day) {
					weekEl.createDiv("home-dashboard-heatmap-cell-placeholder");
					continue;
				}

				const level = getHeatmapLevel(day.count);
				const cell = weekEl.createDiv("home-dashboard-heatmap-cell");
				cell.style.backgroundColor = getHeatmapColor(level, heatmapColor);
				cell.setAttr("aria-label", `${day.dateKey}: ${day.count} 条笔记`);

				if (day.entries.length > 0) {
					let tooltip: HTMLElement | null = null;
					cell.addEventListener("mouseenter", () => {
						tooltip = showDayTooltip(cell, day);
					});
					cell.addEventListener("mouseleave", () => {
						if (tooltip) {
							tooltip.remove();
							tooltip = null;
						}
					});
					cell.addEventListener("click", () => {
						showDayModal(day, app, openNote);
					});
				}
			}
		}
	};

	authorSelect.addEventListener("change", () => {
		selectedAuthor = authorSelect.value;
		renderContent();
	});

	yearSelect.addEventListener("change", () => {
		selectedYear = Number(yearSelect.value);
		renderContent();
	});

	renderContent();
}

function getHeatmapLevel(count: number): number {
	if (count === 0) {
		return 0;
	}
	if (count <= 3) {
		return 1;
	}
	if (count <= 6) {
		return 2;
	}
	if (count <= 12) {
		return 3;
	}
	if (count <= 20) {
		return 4;
	}
	return 5;
}

function getHeatmapColor(level: number, heatmapColor: string): string {
	if (level === 0) {
		return "";
	}
	const rgb = hexToRgb(heatmapColor);
	if (!rgb) {
		return "";
	}
	const alpha = level * 0.2;
	return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function buildHeatmapWeeks(startDate: Date, endDate: Date, dayMap: Map<string, HeatmapDay>): HeatmapWeek[] {
	const weeks: HeatmapWeek[] = [];
	const current = new Date(startDate);

	// 调整到周一
	const dayOfWeek = current.getDay() || 7;
	if (dayOfWeek !== 1) {
		current.setDate(current.getDate() - (dayOfWeek - 1));
	}

	// 结束日推到周日，补齐最后一列
	const lastDayOfWeek = endDate.getDay() || 7;
	const loopEnd = new Date(endDate);
	if (lastDayOfWeek !== 7) {
		loopEnd.setDate(loopEnd.getDate() + (7 - lastDayOfWeek));
	}

	while (current <= loopEnd) {
		const week: HeatmapWeek = { days: [] };
		let hasValidDay = false;
		for (let i = 0; i < 7; i++) {
			if (current < startDate || current > endDate) {
				week.days.push(null);
			} else {
				const key = formatDateKey(current);
				const day = dayMap.get(key) ?? { date: new Date(current), dateKey: key, count: 0, entries: [] };
				week.days.push(day);
				hasValidDay = true;
			}
			current.setDate(current.getDate() + 1);
		}
		if (hasValidDay) {
			weeks.push(week);
		}
	}

	return weeks;
}

function showDayTooltip(cell: HTMLElement, day: HeatmapDay): HTMLElement {
	const rect = cell.getBoundingClientRect();
	const tooltip = document.body.createDiv("home-dashboard-heatmap-tooltip");
	tooltip.style.position = "fixed";
	tooltip.style.left = `${rect.left + rect.width / 2}px`;
	tooltip.style.top = `${rect.top - 8}px`;
	tooltip.style.transform = "translate(-50%, -100%)";

	tooltip.createDiv().setText(day.dateKey);
	tooltip.createDiv().setText(`${day.count} 条笔记`);

	document.body.appendChild(tooltip);

	requestAnimationFrame(() => {
		const tooltipRect = tooltip.getBoundingClientRect();
		if (tooltipRect.top < 8) {
			tooltip.style.top = `${rect.bottom + 8}px`;
			tooltip.style.transform = "translate(-50%, 0)";
		}
	});

	return tooltip;
}

function showDayModal(
	day: HeatmapDay,
	app: App,
	openNote: (file: NoteEntry["file"]) => void
): void {
	const overlay = document.body.createDiv("home-dashboard-modal-overlay");
	const modal = document.body.createDiv("home-dashboard-modal");

	const header = modal.createDiv("home-dashboard-modal-header");
	const titleRow = header.createDiv("home-dashboard-modal-title-row");
	titleRow.createEl("h3", { cls: "home-dashboard-modal-title", text: `${day.dateKey} 的笔记` });
	const sortButton = titleRow.createEl("button", { cls: "home-dashboard-modal-sort-button", title: "切换排序" });
	setIcon(sortButton, "arrow-down-narrow-wide");

	const closeButton = header.createEl("button", { cls: "home-dashboard-modal-close", text: "✕" });

	const body = modal.createDiv("home-dashboard-modal-body");

	const seen = new Set<string>();
	const uniqueEntries: NoteEntry[] = [];
	for (const entry of day.entries) {
		if (seen.has(entry.path)) {
			continue;
		}
		seen.add(entry.path);
		uniqueEntries.push(entry);
	}

	let isDesc = true;

	const renderList = () => {
		body.empty();

		if (uniqueEntries.length === 0) {
			body.createDiv("home-dashboard-modal-empty").setText("当天没有笔记。");
			return;
		}

		const sorted = [...uniqueEntries].sort((a, b) => {
			const timeA = a.file.stat.ctime;
			const timeB = b.file.stat.ctime;
			return isDesc ? timeB - timeA : timeA - timeB;
		});

		const list = body.createEl("ul", { cls: "home-dashboard-modal-list" });
		for (const entry of sorted) {
			const item = list.createEl("li", { cls: "home-dashboard-modal-item" });

			const itemHeader = item.createDiv("home-dashboard-modal-item-header");
			const titleLink = itemHeader.createEl("span", { cls: "home-dashboard-modal-item-title", text: entry.basename });
			titleLink.addEventListener("click", () => {
				closeModal();
				openNote(entry.file);
			});

			const tagsEl = itemHeader.createDiv("home-dashboard-modal-item-tags");
			appendTag(tagsEl, "项目", getFieldValue(entry, app, ["项目"]));
			appendTag(tagsEl, "类型", getFieldValue(entry, app, ["类型"]));
			appendTag(tagsEl, "作者", getFieldValue(entry, app, ["作者"]));
			appendTag(tagsEl, "创建", formatDate(new Date(entry.file.stat.ctime)));

			const summary = loadSummary(entry, app);
			if (summary) {
				const summaryEl = item.createDiv("home-dashboard-modal-item-summary");
				summaryEl.setText(summary);
			}
		}
	};

	sortButton.addEventListener("click", () => {
		isDesc = !isDesc;
		setIcon(sortButton, isDesc ? "arrow-down-narrow-wide" : "arrow-up-narrow-wide");
		renderList();
	});

	renderList();

	document.body.appendChild(overlay);
	document.body.appendChild(modal);

	const closeModal = () => {
		overlay.remove();
		modal.remove();
		document.removeEventListener("keydown", handleKeydown);
	};

	const handleKeydown = (event: KeyboardEvent) => {
		if (event.key === "Escape") {
			closeModal();
		}
	};

	overlay.addEventListener("click", closeModal);
	closeButton.addEventListener("click", closeModal);
	document.addEventListener("keydown", handleKeydown);
}

function renderCombinationCards(
	container: HTMLElement,
	combinations: DashboardCombination[],
	result: AggregatedResult,
	searchKeyword: string,
	openNote: (file: NoteEntry["file"]) => void,
	aliases: Record<string, string>
): void {
	const grid = container.createDiv("home-dashboard-combo-grid");

	for (const combination of combinations) {
		const matched = matchCombination(combination, result, searchKeyword);
		const card = grid.createDiv("home-dashboard-combo-card");

		const header = card.createDiv();
		header.style.display = "flex";
		header.style.justifyContent = "space-between";
		header.style.alignItems = "center";
		header.style.marginBottom = "6px";
		const nameEl = header.createDiv("home-dashboard-combo-name");
		nameEl.style.marginBottom = "0";
		nameEl.setText(combination.name);
		header.createDiv("home-dashboard-combo-count").setText(`${matched.length} 条`);

		const rulesEl = card.createDiv("home-dashboard-combo-rules");
		for (let i = 0; i < combination.rules.length; i++) {
			const rule = combination.rules[i];
			const tag = rulesEl.createSpan();
			tag.style.display = "inline-block";
			tag.style.padding = "2px 6px";
			tag.style.borderRadius = "4px";
			tag.style.backgroundColor = "var(--background-primary-alt)";
			tag.style.marginRight = "4px";
			tag.setText(`${getFieldLabel(rule.field, aliases)} = ${rule.value}`);
		}

		const entriesEl = card.createDiv("home-dashboard-combo-entries");
		const list = entriesEl.createEl("ul", { cls: "home-dashboard-item-list" });
		for (const entry of matched.slice(0, 10)) {
			const item = list.createEl("li", { cls: "home-dashboard-item" });
			const link = item.createEl("span", { text: entry.basename, cls: "home-dashboard-item-link" });
			link.addEventListener("click", () => openNote(entry.file));
		}

		if (matched.length > 10) {
			card.createDiv("home-dashboard-combo-more").setText(`还有 ${matched.length - 10} 条笔记`);
		}
	}
}

function matchCombination(
	combination: DashboardCombination,
	result: AggregatedResult,
	searchKeyword: string
): NoteEntry[] {
	const rules = combination.rules;
	if (rules.length === 0) {
		return [];
	}

	const firstField = result[rules[0].field];
	if (!firstField) {
		return [];
	}

	let candidates = firstField[rules[0].value] || [];
	for (let i = 1; i < rules.length; i++) {
		const { field, value } = rules[i];
		const groups = result[field];
		if (!groups) {
			return [];
		}
		const matchedEntries = groups[value] || [];
		const matchedPaths = new Set(matchedEntries.map((entry) => entry.path));
		candidates = candidates.filter((entry) => matchedPaths.has(entry.path));
	}

	const seen = new Set<string>();
	const unique: NoteEntry[] = [];
	for (const entry of candidates) {
		if (!entryMatches(entry, searchKeyword)) {
			continue;
		}
		if (seen.has(entry.path)) {
			continue;
		}
		seen.add(entry.path);
		unique.push(entry);
	}

	return unique.sort((a, b) => a.basename.localeCompare(b.basename));
}

function flattenResult(result: AggregatedResult): NoteEntry[] {
	const entries: NoteEntry[] = [];
	for (const field of Object.keys(result)) {
		for (const groupKey of Object.keys(result[field])) {
			entries.push(...result[field][groupKey]);
		}
	}
	return entries;
}

function parseIsoDate(value: string): Date | null {
	const normalized = value.replace(/[\/\.]/g, "-").trim();
	if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
		return null;
	}
	const date = new Date(`${normalized}T00:00:00`);
	return isNaN(date.getTime()) ? null : date;
}

function formatDateKey(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function entryMatches(entry: NoteEntry, keyword: string): boolean {
	if (!keyword) {
		return true;
	}
	const lower = keyword.toLowerCase();
	return (
		entry.basename.toLowerCase().includes(lower) ||
		entry.path.toLowerCase().includes(lower) ||
		entry.value.toLowerCase().includes(lower)
	);
}

function getFieldLabel(field: string, aliases: Record<string, string>): string {
	return aliases[field] || field;
}

function renderEmpty(container: HTMLElement, message: string): void {
	container.empty();
	container.createDiv("home-dashboard-empty").setText(message);
}
