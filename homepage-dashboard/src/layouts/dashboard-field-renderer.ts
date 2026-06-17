import { App, setIcon, setTooltip } from "obsidian";
import { AggregatedResult, NoteEntry } from "../types";
import { appendTag, formatDate, getFieldValue, hexToRgb, loadSummary } from "./dashboard-helpers";

interface FieldStat {
	key: string;
	total: number;
	weeklyNew: number;
	totalItems: NoteEntry[];
	weeklyItems: NoteEntry[];
}

interface DistributionEntry {
	key: string;
	count: number;
	items: NoteEntry[];
	actualCount?: number;
}

function mergeSmallEntries(entries: DistributionEntry[], threshold: number, otherLabel: string): DistributionEntry[] {
	const big = entries.filter((e) => e.count >= threshold);
	const small = entries.filter((e) => e.count < threshold);
	if (small.length === 0) return big;

	const other: DistributionEntry = {
		key: otherLabel,
		count: small.reduce((sum, e) => sum + e.count, 0),
		items: small.flatMap((e) => e.items),
	};
	return [...big, other].sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

const RANK_RED_OPACITIES = [1, 0.8, 0.8, 0.6, 0.6, 0.4, 0.4, 0.2, 0.2];
let currentBaseRed = "242, 48, 48";

function getRankColor(index: number, baseRed: string): string {
	const opacity = RANK_RED_OPACITIES[index];
	return opacity === undefined ? "var(--kd-ink)" : `rgba(${baseRed}, ${opacity})`;
}

// 累计沉淀类型（矩形树图）层级较多，使用 10% 为档位、最低 10% 的透明度梯度
function getTreemapRankColor(index: number, baseRed: string): string {
	const opacity = Math.max(0.1, 1 - index * 0.1);
	return `rgba(${baseRed}, ${opacity})`;
}

export function renderFieldDistribution(
	container: HTMLElement,
	result: AggregatedResult,
	aliases: Record<string, string>,
	app: App,
	openNote: (file: NoteEntry["file"]) => void,
	fieldColor: string
): void {
	const rgb = hexToRgb(fieldColor);
	currentBaseRed = rgb ? `${rgb.r}, ${rgb.g}, ${rgb.b}` : "242, 48, 48";
	container.style.setProperty("--kd-field-red", fieldColor);

	const authorGroups = result["作者"] ?? {};
	const projectGroups = result["项目"] ?? {};
	const typeGroups = result["类型"] ?? {};
	const authorStats = computeFieldStats(authorGroups, app);
	const projectStats = computeFieldStats(projectGroups, app);
	const typeStats = computeFieldStats(typeGroups, app);

	container.createEl("h2", { cls: "kd-field-section-title", text: "沉淀排行" });

	const tabsRoot = container.createDiv("kd-field-tabs");
	const tabsBar = tabsRoot.createDiv("kd-field-tabs-bar");
	const weeklyTab = tabsBar.createEl("span", { cls: "kd-field-tab is-active", text: "本周动态" });
	const totalTab = tabsBar.createEl("span", { cls: "kd-field-tab", text: "历史全局" });

	const tabsBody = tabsRoot.createDiv("kd-field-tabs-body");
	const weeklyPanel = tabsBody.createDiv("kd-field-tab-panel is-active");
	weeklyPanel.dataset.tab = "weekly";
	const totalPanel = tabsBody.createDiv("kd-field-tab-panel");
	totalPanel.dataset.tab = "total";

	const weeklyColumns = weeklyPanel.createDiv("kd-field-panel-columns");

	const weeklyProjects = projectStats.filter((s) => s.weeklyNew > 0).map((s) => ({ key: s.key, count: s.weeklyNew, items: s.weeklyItems }));
	const weeklyTypesRaw = typeStats.filter((s) => s.weeklyNew > 0).map((s) => ({ key: s.key, count: s.weeklyNew, items: s.weeklyItems }));
	const weeklyTypes = mergeSmallEntries(weeklyTypesRaw, 1, "其他");
	const weeklyAuthors = authorStats.filter((s) => s.weeklyNew > 0).map((s) => ({ key: s.key, count: s.weeklyNew, items: s.weeklyItems }));

	if (weeklyProjects.length === 0) {
		createColumn(weeklyColumns, "项目").createDiv("kd-field-empty").setText("让项目更强");
	} else {
		renderMiniStatCards(createColumn(weeklyColumns, "项目"), weeklyProjects, app, openNote);
	}

	if (weeklyTypesRaw.length === 0) {
		createColumn(weeklyColumns, "类型").createDiv("kd-field-empty").setText("让AI更好工作");
	} else {
		renderStackedRatioBar(createColumn(weeklyColumns, "类型"), weeklyTypes, app, openNote);
	}

	if (weeklyAuthors.length === 0) {
		createColumn(weeklyColumns, "作者").createDiv("kd-field-empty").setText("抢占首位");
	} else {
		renderLollipopChart(createColumn(weeklyColumns, "作者"), weeklyAuthors, app, openNote, undefined, true);
	}

	let totalRendered = false;
	const renderTotal = (): void => {
		if (totalRendered) return;
		totalRendered = true;
		totalPanel.empty();

		const totalLayout = totalPanel.createDiv("kd-field-panel-cumulative");
		const cumulativeRow = totalLayout.createDiv("kd-field-panel-columns");

		renderBubbleDistribution(
			createCumulativeColumn(cumulativeRow, "项目", "kd-cumulative-bubble"),
			projectStats.map((s) => ({ key: s.key, count: s.total, items: s.totalItems })),
			app,
			openNote
		);
		renderTreemap(
			createCumulativeColumn(cumulativeRow, "类型", "kd-cumulative-treemap"),
			mergeSmallEntries(
				typeStats.map((s) => ({ key: s.key, count: s.total, items: s.totalItems })),
				10,
				"其他"
			),
			app,
			openNote
		);
		renderLollipopChart(
			createColumn(cumulativeRow, "作者"),
			authorStats.map((s) => ({ key: s.key, count: s.total, items: s.totalItems })),
			app,
			openNote,
			undefined,
			true
		);
	};

	let activeTab: "weekly" | "total" = "weekly";

	const switchTab = (tab: "weekly" | "total") => {
		if (tab === activeTab) return;
		activeTab = tab;

		if (tab === "total") {
			renderTotal();
		}

		weeklyTab.classList.toggle("is-active", tab === "weekly");
		totalTab.classList.toggle("is-active", tab === "total");
		weeklyPanel.classList.toggle("is-active", tab === "weekly");
		totalPanel.classList.toggle("is-active", tab === "total");
	};

	weeklyTab.addEventListener("click", () => switchTab("weekly"));
	totalTab.addEventListener("click", () => switchTab("total"));
}

function createColumn(container: HTMLElement, title: string): HTMLElement {
	const column = container.createDiv("kd-field-column");
	column.createEl("h4", { cls: "kd-field-column-title", text: title });
	return column;
}

function createCumulativeColumn(container: HTMLElement, title: string, extraCls: string): HTMLElement {
	const column = container.createDiv(`kd-cumulative-cell ${extraCls}`);
	column.createEl("h4", { cls: "kd-field-column-title", text: title });
	return column;
}

function renderLollipopChart(
	container: HTMLElement,
	entries: DistributionEntry[],
	app: App,
	openNote: (file: NoteEntry["file"]) => void,
	columnTitle?: string,
	showCrownForFirst?: boolean
): void {
	if (entries.length === 0) {
		container.createDiv("kd-field-empty").setText("暂无数据");
		return;
	}

	const sorted = entries.slice().sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
	const maxCount = Math.max(...sorted.map((e) => e.count));
	const chart = container.createDiv("kd-lollipop-chart");

	for (let i = 0; i < sorted.length; i++) {
		const entry = sorted[i];
		const color = getRankColor(i, currentBaseRed);
		const row = chart.createDiv("kd-lollipop-row");

		const label = row.createDiv("kd-lollipop-label");
		label.setText(showCrownForFirst && i === 0 ? `${entry.key} 👑` : entry.key);

		const track = row.createDiv("kd-lollipop-track");

		const widthPct = maxCount === 0 ? 0 : (entry.count / maxCount) * 100;

		const fill = track.createDiv("kd-lollipop-fill");
		fill.style.width = `${widthPct}%`;
		fill.style.backgroundColor = color;

		const value = row.createDiv("kd-lollipop-value");
		value.setText(String(entry.count));

		row.addEventListener("click", () => {
			showFieldModal(`${columnTitle || "作者"} · ${entry.key}`, entry.items, app, openNote);
		});
	}

	// 轻量棒棒糖图：不显示底部刻度，依靠数字与条形长度即可阅读
}

function renderMiniStatCards(
	container: HTMLElement,
	entries: DistributionEntry[],
	app: App,
	openNote: (file: NoteEntry["file"]) => void
): void {
	if (entries.length === 0) {
		container.createDiv("kd-field-empty").setText("暂无数据");
		return;
	}

	const grid = container.createDiv("kd-mini-cards-grid");
	const sorted = entries.slice().sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
	const n = sorted.length;
	const k = Math.max(1, n - 3);
	const topRow = sorted.slice(0, k);
	const bottomRow = sorted.slice(k);

	renderMiniCardsRow(grid, topRow, n, 0, app, openNote, "kd-mini-cards-row--top");
	if (bottomRow.length > 0) {
		renderMiniCardsRow(grid, bottomRow, n, k, app, openNote, "kd-mini-cards-row--bottom");
	}
}

function renderMiniCardsRow(
	grid: HTMLElement,
	rowEntries: DistributionEntry[],
	totalCount: number,
	startIndex: number,
	app: App,
	openNote: (file: NoteEntry["file"]) => void,
	rowClass: string
): void {
	const row = grid.createDiv(`kd-mini-cards-row ${rowClass}`);

	for (let j = 0; j < rowEntries.length; j++) {
		const entry = rowEntries[j];
		const globalIndex = startIndex + j;
		const color = getRankColor(globalIndex, currentBaseRed);
		const weight = totalCount - globalIndex + 1;

		const card = row.createDiv("kd-mini-card");
		card.style.backgroundColor = color;
		card.style.flexGrow = String(weight);
		card.style.flexShrink = "0";
		card.style.flexBasis = "0";

		const label = card.createDiv("kd-mini-card-label");
		label.setText(entry.key);

		const value = card.createDiv("kd-mini-card-value");
		value.setText(String(entry.count));

		card.addEventListener("click", () => {
			showFieldModal(`项目 · ${entry.key}`, entry.items, app, openNote);
		});
	}
}

function renderStackedRatioBar(
	container: HTMLElement,
	entries: DistributionEntry[],
	app: App,
	openNote: (file: NoteEntry["file"]) => void
): void {
	if (entries.length === 0) {
		container.createDiv("kd-field-empty").setText("暂无数据");
		return;
	}

	const sorted = entries.slice().sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
	const total = sorted.reduce((sum, e) => sum + e.count, 0);
	const chart = container.createDiv("kd-stacked-ratio-chart");

	const bar = chart.createDiv("kd-stacked-bar");

	for (let i = 0; i < sorted.length; i++) {
		const entry = sorted[i];
		const pct = total === 0 ? 0 : entry.count / total;
		const segment = bar.createDiv("kd-stacked-bar-segment");
		segment.style.width = `${pct * 100}%`;
		segment.style.backgroundColor = getRankColor(i, currentBaseRed);
		segment.addEventListener("click", () => {
			showFieldModal(`类型 · ${entry.key}`, entry.items, app, openNote);
		});
	}

	const legend = chart.createDiv("kd-stacked-legend");

	for (let i = 0; i < sorted.length; i++) {
		const entry = sorted[i];
		const pct = total === 0 ? 0 : (entry.count / total) * 100;
		const item = legend.createDiv("kd-legend-item");

		const swatch = item.createDiv("kd-legend-swatch");
		swatch.style.width = "10px";
		swatch.style.height = "10px";
		swatch.style.backgroundColor = getRankColor(i, currentBaseRed);

		const label = item.createDiv("kd-legend-label");
		label.setText(entry.key);
		label.style.overflow = "hidden";
		label.style.textOverflow = "ellipsis";

		const count = item.createDiv("kd-legend-count");
		count.setText(String(entry.count));

		const pctEl = item.createDiv("kd-legend-pct");
		pctEl.setText(`${pct.toFixed(0)}%`);

		item.addEventListener("click", () => {
			showFieldModal(`类型 · ${entry.key}`, entry.items, app, openNote);
		});
	}
}

interface PlacedCircle {
	x: number;
	y: number;
	r: number;
	entry: DistributionEntry;
	color: string;
}

function renderBubbleDistribution(
	container: HTMLElement,
	entries: DistributionEntry[],
	app: App,
	openNote: (file: NoteEntry["file"]) => void
): void {
	if (entries.length === 0) {
		container.createDiv("kd-field-empty").setText("暂无数据");
		return;
	}

	const sorted = entries.slice().sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
	const display = sorted.slice(0, 5);
	const maxCount = display[0].count || 1;
	const viewW = 220;
	const viewH = 220;
	const padding = 8;
	const maxRadius = 55;
	const minRadius = 22;
	const centerX = viewW / 2;
	const centerY = viewH / 2;

	const radii = display.map((entry) => Math.max(minRadius, Math.sqrt(entry.count / maxCount) * maxRadius));

	const circles: PlacedCircle[] = display.map((entry, i) => {
		const r = radii[i];
		if (i === 0) {
			return { entry, r, x: centerX, y: centerY, color: getRankColor(i, currentBaseRed) };
		}
		const angle = ((i - 1) / Math.max(1, display.length - 1)) * Math.PI * 2;
		const distance = r + radii[0] + padding * 2;
		return {
			entry,
			r,
			x: centerX + Math.cos(angle) * distance,
			y: centerY + Math.sin(angle) * distance,
			color: getRankColor(i, currentBaseRed),
		};
	});

	layoutBubbles(circles, viewW, viewH, padding);

	const wrapper = container.createDiv("kd-bubble-chart");
	wrapper.style.position = "relative";
	wrapper.style.width = "100%";

	const svg = wrapper.createSvg("svg", { cls: "kd-bubble-svg", attr: { viewBox: `0 0 ${viewW} ${viewH}` } });

	for (const circle of circles) {
		const g = svg.createSvg("g", { cls: "kd-bubble-group" });
		const c = g.createSvg("circle", {
			cls: "kd-bubble-circle",
			attr: { cx: circle.x, cy: circle.y, r: circle.r },
		});
		c.style.fill = circle.color;
		c.style.fillOpacity = "1";

		const label = g.createSvg("text", {
			cls: "kd-bubble-label",
			attr: { x: circle.x, y: circle.y, "text-anchor": "middle", "dominant-baseline": "middle" },
		});
		label.setText(circle.entry.key);

		const PADDING_RATIO = 0.20;
		const padding = circle.r * 2 * PADDING_RATIO;
		const maxTextWidth = circle.r * 2 - padding * 2;
		let fontSize = Math.min(12, Math.max(4, circle.r * 0.36));
		label.style.fontSize = `${fontSize}px`;

		for (let attempt = 0; attempt < 10; attempt++) {
			const width = label.getComputedTextLength();
			if (width <= maxTextWidth || fontSize <= 4) {
				break;
			}
			fontSize = Math.max(4, fontSize * (maxTextWidth / width));
			label.style.fontSize = `${fontSize}px`;
		}
	}

	circles.forEach((circle, index) => {
		const hit = wrapper.createDiv("kd-bubble-hit");
		hit.style.left = `${((circle.x - circle.r) / viewW) * 100}%`;
		hit.style.top = `${((circle.y - circle.r) / viewH) * 100}%`;
		hit.style.width = `${((circle.r * 2) / viewW) * 100}%`;
		hit.style.aspectRatio = "1 / 1";
		setTooltip(hit, `${circle.entry.key}: ${circle.entry.count}`, { placement: "top", delay: 0 });

		hit.addEventListener("mouseenter", () => {
			svg.querySelectorAll(".kd-bubble-circle")[index]?.addClass("is-hovered");
		});
		hit.addEventListener("mouseleave", () => {
			svg.querySelectorAll(".kd-bubble-circle")[index]?.removeClass("is-hovered");
		});

		hit.addEventListener("click", () => {
			showFieldModal(`项目 · ${circle.entry.key}`, circle.entry.items, app, openNote);
		});
	});
}

function layoutBubbles(circles: PlacedCircle[], viewW: number, viewH: number, padding: number): void {
	const centerX = viewW / 2;
	const centerY = viewH / 2;
	const iterations = 400;

	for (let step = 0; step < iterations; step++) {
		let moved = false;

		for (let i = 0; i < circles.length; i++) {
			for (let j = i + 1; j < circles.length; j++) {
				const a = circles[i];
				const b = circles[j];
				const dx = b.x - a.x;
				const dy = b.y - a.y;
				const dist = Math.sqrt(dx * dx + dy * dy) || 1;
				const minDist = a.r + b.r + padding;

				if (dist < minDist) {
					const overlap = (minDist - dist) / 2;
					const nx = dx / dist;
					const ny = dy / dist;
					a.x -= nx * overlap;
					a.y -= ny * overlap;
					b.x += nx * overlap;
					b.y += ny * overlap;
					moved = true;
				}
			}
		}

		for (const c of circles) {
			const minX = c.r + padding;
			const maxX = viewW - c.r - padding;
			const minY = c.r + padding;
			const maxY = viewH - c.r - padding;

			if (c.x < minX) {
				c.x = minX;
				moved = true;
			} else if (c.x > maxX) {
				c.x = maxX;
				moved = true;
			}
			if (c.y < minY) {
				c.y = minY;
				moved = true;
			} else if (c.y > maxY) {
				c.y = maxY;
				moved = true;
			}
		}

		for (const c of circles) {
			c.x += (centerX - c.x) * 0.03;
			c.y += (centerY - c.y) * 0.03;
		}

		if (!moved && step > 50) {
			break;
		}
	}
}

function renderTreemap(
	container: HTMLElement,
	entries: DistributionEntry[],
	app: App,
	openNote: (file: NoteEntry["file"]) => void
): void {
	if (entries.length === 0) {
		container.createDiv("kd-field-empty").setText("暂无数据");
		return;
	}

	const sorted = entries
		.filter((e) => e.count > 0)
		.slice()
		.sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));

	if (sorted.length === 0) {
		container.createDiv("kd-field-empty").setText("暂无数据");
		return;
	}

	const layoutEntries: DistributionEntry[] = [];
	let otherEntry: DistributionEntry | undefined;

	for (const entry of sorted) {
		if (entry.key === "其他") {
			otherEntry = entry;
		} else {
			layoutEntries.push(entry);
		}
	}

	if (otherEntry) {
		layoutEntries.push({
			...otherEntry,
			count: 10,
			actualCount: otherEntry.count,
		});
	}

	const total = layoutEntries.reduce((sum, e) => sum + e.count, 0);
	const wrapper = container.createDiv("kd-treemap");
	renderTreemapGroup(wrapper, layoutEntries, total, 0, total, { w: 100, h: 100 }, true, app, openNote);
}

interface TreemapRect {
	w: number;
	h: number;
}

const TREEMAP_ASPECT_LIMIT = 1.5;

function renderTreemapGroup(
	container: HTMLElement,
	items: DistributionEntry[],
	groupTotal: number,
	colorStart: number,
	globalTotal: number,
	rect: TreemapRect,
	preferredHorizontal: boolean,
	app: App,
	openNote: (file: NoteEntry["file"]) => void
): void {
	if (items.length === 1) {
		renderTreemapCell(container, items[0], colorStart, globalTotal, app, openNote);
		return;
	}

	const mid = Math.ceil(items.length / 2);
	const groupA = items.slice(0, mid);
	const groupB = items.slice(mid);
	const totalA = groupA.reduce((sum, item) => sum + item.count, 0);
	const totalB = groupB.reduce((sum, item) => sum + item.count, 0);

	const aspect = rect.w / rect.h;
	let horizontal = preferredHorizontal;
	if (aspect > TREEMAP_ASPECT_LIMIT) {
		horizontal = true;
	} else if (aspect < 1 / TREEMAP_ASPECT_LIMIT) {
		horizontal = false;
	}

	container.style.flexDirection = horizontal ? "row" : "column";

	const ratioA = groupTotal === 0 ? 0 : totalA / groupTotal;
	let rectA: TreemapRect;
	let rectB: TreemapRect;
	if (horizontal) {
		rectA = { w: rect.w * ratioA, h: rect.h };
		rectB = { w: rect.w * (1 - ratioA), h: rect.h };
	} else {
		rectA = { w: rect.w, h: rect.h * ratioA };
		rectB = { w: rect.w, h: rect.h * (1 - ratioA) };
	}

	const elA = container.createDiv("kd-treemap-group");
	elA.style.flex = String(totalA);
	renderTreemapGroup(elA, groupA, totalA, colorStart, globalTotal, rectA, !horizontal, app, openNote);

	const elB = container.createDiv("kd-treemap-group");
	elB.style.flex = String(totalB);
	renderTreemapGroup(elB, groupB, totalB, colorStart + groupA.length, globalTotal, rectB, !horizontal, app, openNote);
}

function renderTreemapCell(
	container: HTMLElement,
	entry: DistributionEntry,
	colorIndex: number,
	globalTotal: number,
	app: App,
	openNote: (file: NoteEntry["file"]) => void
): HTMLElement {
	const cell = container.createDiv("kd-treemap-cell");
	cell.style.backgroundColor = getTreemapRankColor(colorIndex, currentBaseRed);

	const label = cell.createDiv("kd-treemap-label");
	label.style.wordBreak = "break-word";
	label.style.lineHeight = "1.25";

	const share = globalTotal === 0 ? 0 : (entry.count / globalTotal) * 100;
	if (entry.key === "其他" || share >= 2) {
		label.setText(entry.key);
	} else {
		label.style.display = "none";
	}

	const displayCount = entry.actualCount ?? entry.count;
	setTooltip(cell, `${entry.key}: ${displayCount}`, { placement: "top", delay: 0 });

	cell.addEventListener("click", () => {
		showFieldModal(`类型 · ${entry.key}`, entry.items, app, openNote);
	});

	return cell;
}

function computeFieldStats(groups: Record<string, NoteEntry[]>, app: App): FieldStat[] {
	const { start, end } = getCurrentWeekRange();
	return Object.entries(groups).map(([key, items]) => {
		const weeklyItems = items.filter((entry) => {
			const created = getCreatedTime(entry, app);
			return created !== null && created >= start.getTime() && created <= end.getTime();
		});
		return { key, total: items.length, weeklyNew: weeklyItems.length, totalItems: items, weeklyItems };
	});
}

function getCreatedTime(entry: NoteEntry, app: App): number | null {
	const cache = app.metadataCache.getFileCache(entry.file);
	const rawCreated = cache?.frontmatter?.["创建时间"];
	const date = parseDateValue(rawCreated);
	if (date) {
		return date.getTime();
	}
	return entry.file.stat.ctime;
}

function parseDateValue(raw: unknown): Date | null {
	if (raw === undefined || raw === null || raw === "") {
		return null;
	}
	const str = String(raw).trim();
	if (!str) {
		return null;
	}

	const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}):(\d{2}))?/);
	if (isoMatch) {
		const [, year, month, day, hour = "00", minute = "00", second = "00"] = isoMatch;
		const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
		return isNaN(date.getTime()) ? null : date;
	}

	const timestamp = Date.parse(str);
	return Number.isNaN(timestamp) ? null : new Date(timestamp);
}

function getCurrentWeekRange(): { start: Date; end: Date } {
	const now = new Date();
	const dayOfWeek = now.getDay() || 7;
	const start = new Date(now);
	start.setDate(now.getDate() - dayOfWeek + 1);
	start.setHours(0, 0, 0, 0);
	const end = new Date(start);
	end.setDate(start.getDate() + 6);
	end.setHours(23, 59, 59, 999);
	return { start, end };
}

function showFieldModal(
	title: string,
	entries: NoteEntry[],
	app: App,
	openNote: (file: NoteEntry["file"]) => void
): void {
	const overlay = document.body.createDiv("home-dashboard-modal-overlay");
	const modal = document.body.createDiv("home-dashboard-modal");

	const header = modal.createDiv("home-dashboard-modal-header");
	const titleRow = header.createDiv("home-dashboard-modal-title-row");
	titleRow.createEl("h3", { cls: "home-dashboard-modal-title", text: title });
	const sortButton = titleRow.createEl("button", { cls: "home-dashboard-modal-sort-button", title: "切换排序" });
	setIcon(sortButton, "arrow-down-narrow-wide");

	const closeButton = header.createEl("button", { cls: "home-dashboard-modal-close", text: "✕" });

	const body = modal.createDiv("home-dashboard-modal-body");

	const seen = new Set<string>();
	const uniqueEntries: NoteEntry[] = [];
	for (const entry of entries) {
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
			body.createDiv("home-dashboard-modal-empty").setText("没有匹配的笔记。");
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
