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

	container.createEl("h2", { cls: "kd-field-section-title", text: "字段分布" });

	const wrapper = container.createDiv("kd-field-panels");

	const weeklyPanel = createPanel(wrapper, "本周沉淀");
	weeklyPanel.addClass("kd-field-panel--weekly");
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
		createColumn(weeklyColumns, "能力者").createDiv("kd-field-empty").setText("抢占首位");
	} else {
		renderLollipopChart(createColumn(weeklyColumns, "能力者"), weeklyAuthors, app, openNote);
	}

	const totalPanel = createPanel(wrapper, "累计沉淀");
	totalPanel.addClass("kd-field-panel--cumulative");

	const totalLayout = totalPanel.createDiv("kd-field-panel-cumulative");
	const cumulativeRow = totalLayout.createDiv("kd-cumulative-row");

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
		createCumulativeColumn(cumulativeRow, "能力者", "kd-cumulative-lollipop"),
		authorStats.map((s) => ({ key: s.key, count: s.total, items: s.totalItems })),
		app,
		openNote
	);
}

function createPanel(wrapper: HTMLElement, title: string): HTMLElement {
	const panel = wrapper.createDiv("kd-field-panel");
	panel.createEl("h3", { cls: "kd-field-panel-title", text: title });
	return panel;
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
	columnTitle?: string
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
		label.setText(entry.key);

		const track = row.createDiv("kd-lollipop-track");

		const widthPct = maxCount === 0 ? 0 : (entry.count / maxCount) * 100;

		const fill = track.createDiv("kd-lollipop-fill");
		fill.style.width = `${widthPct}%`;
		fill.style.backgroundColor = color;

		const value = row.createDiv("kd-lollipop-value");
		value.setText(String(entry.count));

		row.addEventListener("click", () => {
			showFieldModal(`${columnTitle || "能力者"} · ${entry.key}`, entry.items, app, openNote);
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

	for (let i = 0; i < sorted.length; i++) {
		const entry = sorted[i];
		const color = getRankColor(i, currentBaseRed);
		const card = grid.createDiv("kd-mini-card");
		card.style.backgroundColor = color;
		card.style.borderColor = "var(--kd-ink)";

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
	const maxCount = sorted[0].count;
	const maxRadius = 65;
	const viewW = 260;
	const viewH = 220;
	const padding = 8;
	const placed: PlacedCircle[] = [];

	for (let i = 0; i < sorted.length; i++) {
		const entry = sorted[i];
		const r = maxCount === 0 ? 0 : Math.sqrt(entry.count / maxCount) * maxRadius;
		let x = viewW / 2;
		let y = viewH / 2;

		if (i === 0) {
			x = 90;
			y = 105;
		} else if (i === 1) {
			x = 190;
			y = 155;
		} else if (i === 2) {
			x = 200;
			y = 70;
		} else {
			const centroid = placed.reduce(
				(acc, c) => {
					acc.x += c.x;
					acc.y += c.y;
					return acc;
				},
				{ x: 0, y: 0 }
			);
			centroid.x /= placed.length;
			centroid.y /= placed.length;

			let placedSuccessfully = false;
			for (let revolutions = 0; revolutions < 12 && !placedSuccessfully; revolutions++) {
				const angleStep = Math.PI / 10;
				const radiusStep = 5;
				for (let step = 0; step < 80; step++) {
					const angle = step * angleStep;
					const distance = revolutions * 35 + step * radiusStep;
					x = centroid.x + Math.cos(angle) * distance;
					y = centroid.y + Math.sin(angle) * distance;

					if (x - r < padding || x + r > viewW - padding || y - r < padding || y + r > viewH - padding) {
						continue;
					}

					const overlaps = placed.some((c) => {
						const dx = c.x - x;
						const dy = c.y - y;
						return Math.sqrt(dx * dx + dy * dy) < c.r + r + padding;
					});

					if (!overlaps) {
						placedSuccessfully = true;
						break;
					}
				}
			}
		}

		placed.push({ x, y, r, entry, color: getRankColor(i, currentBaseRed) });
	}

	const wrapper = container.createDiv("kd-bubble-chart");
	wrapper.style.position = "relative";
	wrapper.style.width = "100%";

	const svg = wrapper.createSvg("svg", { cls: "kd-bubble-svg", attr: { viewBox: `0 0 ${viewW} ${viewH}` } });

	for (const circle of placed) {
		const g = svg.createSvg("g", { cls: "kd-bubble-group" });
		const c = g.createSvg("circle", {
			cls: "kd-bubble-circle",
			attr: { cx: circle.x, cy: circle.y, r: circle.r },
		});
		c.style.fill = circle.color;
		c.style.fillOpacity = "1";

		if (circle.r >= 24) {
			const label = g.createSvg("text", {
				cls: "kd-bubble-label",
				attr: { x: circle.x, y: circle.y, "text-anchor": "middle", "dominant-baseline": "middle" },
			});
			label.setText(circle.entry.key);
			if (circle.r >= 45) {
				label.style.fontSize = "0.92rem";
			} else if (circle.r >= 32) {
				label.style.fontSize = "0.78rem";
			} else {
				label.style.fontSize = "0.68rem";
			}
		}
	}

	placed.forEach((circle, index) => {
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

interface TreemapRect {
	x: number;
	y: number;
	w: number;
	h: number;
	entry: DistributionEntry;
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
	const total = sorted.reduce((sum, e) => sum + e.count, 0);
	const width = 100;
	const height = 100;
	const rects = buildTreemapRects(sorted, total, 0, 0, width, height, 0);

	const wrapper = container.createDiv("kd-treemap");
	wrapper.style.position = "relative";
	wrapper.style.width = "100%";
	wrapper.style.minHeight = "260px";

	for (let i = 0; i < rects.length; i++) {
		const rect = rects[i];
		const cell = wrapper.createDiv("kd-treemap-cell");
		cell.style.position = "absolute";
		cell.style.left = `${rect.x}%`;
		cell.style.top = `${rect.y}%`;
		cell.style.width = `${rect.w}%`;
		cell.style.height = `${rect.h}%`;
		// 按面积排名使用红色深浅梯度（累计沉淀类型层级较多，使用 10% 档位）
		const color = getTreemapRankColor(i, currentBaseRed);
		cell.style.backgroundColor = color;
		cell.style.overflow = "hidden";
		cell.style.display = "flex";
		cell.style.alignItems = "flex-start";
		cell.style.justifyContent = "flex-start";
		cell.style.padding = "6px 8px";
		cell.style.boxSizing = "border-box";

		const label = cell.createDiv("kd-treemap-label");
		label.style.wordBreak = "break-word";
		label.style.lineHeight = "1.25";

		// 默认只显示类型名称，不显示数量；数量通过 hover tooltip 展示
		const showName = rect.w >= 10 && rect.h >= 8;
		if (showName) {
			label.setText(rect.entry.key);
		} else {
			label.style.display = "none";
		}

		setTooltip(cell, `${rect.entry.key}: ${rect.entry.count}`, { placement: "top", delay: 0 });

		cell.addEventListener("click", () => {
			showFieldModal(`类型 · ${rect.entry.key}`, rect.entry.items, app, openNote);
		});
	}
}

function buildTreemapRects(
	entries: DistributionEntry[],
	total: number,
	x: number,
	y: number,
	w: number,
	h: number,
	colorIndex: number
): TreemapRect[] {
	if (entries.length === 0) return [];
	if (entries.length === 1) {
		return [{ x, y, w, h, entry: entries[0] }];
	}

	let bestIndex = 1;
	let bestDiff = Infinity;
	let runningSum = 0;
	let bestSum = 0;

	for (let i = 0; i < entries.length - 1; i++) {
		runningSum += entries[i].count;
		const diff = Math.abs(runningSum / total - 0.5);
		if (diff < bestDiff) {
			bestDiff = diff;
			bestIndex = i + 1;
			bestSum = runningSum;
		}
	}

	const group1 = entries.slice(0, bestIndex);
	const group2 = entries.slice(bestIndex);
	const sum1 = bestSum;
	const sum2 = total - sum1;

	if (w >= h) {
		const w1 = w * (sum1 / total);
		return [
			...buildTreemapRects(group1, sum1, x, y, w1, h, colorIndex),
			...buildTreemapRects(group2, sum2, x + w1, y, w - w1, h, colorIndex + group1.length),
		];
	} else {
		const h1 = h * (sum1 / total);
		return [
			...buildTreemapRects(group1, sum1, x, y, w, h1, colorIndex),
			...buildTreemapRects(group2, sum2, x, y + h1, w, h - h1, colorIndex + group1.length),
		];
	}
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
