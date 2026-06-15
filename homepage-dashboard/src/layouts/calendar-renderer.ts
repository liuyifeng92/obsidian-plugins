import { AggregatedResult, LayoutRenderer, NoteEntry, RenderOptions } from "../types";

interface MonthBucket {
	year: number;
	monthIndex: number;
	days: Map<number, NoteEntry[]>;
}

export class CalendarRenderer implements LayoutRenderer {
	render(container: HTMLElement, result: AggregatedResult, options: RenderOptions): void {
		container.empty();

		const { plugin, searchKeyword, openNote } = options;
		const dateFields = plugin.settings.dateFields;
		const fields = getSortedFields(result, plugin.settings.fieldOrder).filter((field) =>
			dateFields.includes(field)
		);

		if (fields.length === 0) {
			renderEmpty(container, "未配置日期字段，无法使用日历布局。");
			return;
		}

		let hasAnyData = false;

		for (const field of fields) {
			const groups = result[field] || {};
			const monthBuckets = buildMonthBuckets(groups, searchKeyword);

			if (monthBuckets.length === 0) {
				continue;
			}

			hasAnyData = true;

			const section = container.createDiv("home-dashboard-section");
			const title = section.createEl("h2", { cls: "home-dashboard-section-title" });
			title.setText(getFieldLabel(field, plugin.settings.fieldAliases));
			title.createSpan({ cls: "home-dashboard-field-count" }).setText(`(${monthBuckets.length} 个月)`);

			for (const bucket of monthBuckets) {
				renderMonth(section, bucket, openNote);
			}
		}

		if (!hasAnyData) {
			renderEmpty(container, "未找到任何匹配笔记。");
		}
	}
}

function buildMonthBuckets(
	groups: Record<string, NoteEntry[]>,
	searchKeyword: string
): MonthBucket[] {
	const buckets = new Map<string, MonthBucket>();

	for (const groupKey of Object.keys(groups)) {
		const date = parseDate(groupKey);
		if (!date) {
			continue;
		}

		const year = date.getFullYear();
		const monthIndex = date.getMonth();
		const day = date.getDate();
		const monthKey = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;

		if (!buckets.has(monthKey)) {
			buckets.set(monthKey, { year, monthIndex, days: new Map() });
		}

		const bucket = buckets.get(monthKey)!;
		const entries = groups[groupKey].filter((entry) => entryMatches(entry, searchKeyword));

		if (entries.length === 0) {
			continue;
		}

		if (!bucket.days.has(day)) {
			bucket.days.set(day, []);
		}

		bucket.days.get(day)!.push(...entries);
	}

	for (const bucket of buckets.values()) {
		for (const dayEntries of bucket.days.values()) {
			dayEntries.sort((a, b) => a.basename.localeCompare(b.basename));
		}
	}

	return Array.from(buckets.values()).sort((a, b) => {
		if (a.year !== b.year) {
			return a.year - b.year;
		}
		return a.monthIndex - b.monthIndex;
	});
}

function renderMonth(container: HTMLElement, bucket: MonthBucket, openNote: (file: NoteEntry["file"]) => void): void {
	const monthEl = container.createDiv("home-dashboard-calendar-month");
	monthEl.createDiv("home-dashboard-calendar-month-title").setText(
		`${bucket.year}年${bucket.monthIndex + 1}月`
	);

	const grid = monthEl.createDiv("home-dashboard-calendar-grid");

	const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
	for (const weekday of weekdays) {
		grid.createDiv("home-dashboard-calendar-weekday").setText(weekday);
	}

	const startWeekday = new Date(bucket.year, bucket.monthIndex, 1).getDay();
	const totalDays = daysInMonth(bucket.year, bucket.monthIndex);

	for (let i = 0; i < startWeekday; i++) {
		grid.createDiv("home-dashboard-calendar-day home-dashboard-calendar-day-empty");
	}

	for (let day = 1; day <= totalDays; day++) {
		const dayEl = grid.createDiv("home-dashboard-calendar-day");
		dayEl.createDiv("home-dashboard-calendar-day-number").setText(String(day));

		const entries = bucket.days.get(day);
		if (entries && entries.length > 0) {
			dayEl.addClass("has-events");
			const entriesEl = dayEl.createDiv("home-dashboard-calendar-day-entries");
			for (const entry of entries) {
				const linkEl = entriesEl.createEl("span", {
					text: entry.basename,
					cls: "home-dashboard-item-link",
				});
				linkEl.addEventListener("click", () => openNote(entry.file));
			}
		}
	}
}

function parseDate(value: string): Date | null {
	const normalized = value.replace(/[\/\.]/g, "-").trim();

	if (/^\d{4}-\d{2}$/.test(normalized)) {
		const date = new Date(`${normalized}-01T00:00:00`);
		return isNaN(date.getTime()) ? null : date;
	}

	if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
		const date = new Date(`${normalized}T00:00:00`);
		return isNaN(date.getTime()) ? null : date;
	}

	const date = new Date(value);
	return isNaN(date.getTime()) ? null : date;
}

function daysInMonth(year: number, monthIndex: number): number {
	return new Date(year, monthIndex + 1, 0).getDate();
}

function getSortedFields(result: AggregatedResult, fieldOrder: string[]): string[] {
	const allFields = Object.keys(result);
	const ordered = fieldOrder.filter((field) => allFields.includes(field));
	const remaining = allFields.filter((field) => !ordered.includes(field));
	return [...ordered, ...remaining.sort((a, b) => a.localeCompare(b))];
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
