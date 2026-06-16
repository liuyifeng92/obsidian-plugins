import { AggregatedResult, LayoutRenderer, NoteEntry, RenderOptions } from "../types";

export class CardRenderer implements LayoutRenderer {
	render(container: HTMLElement, result: AggregatedResult, options: RenderOptions): void {
		container.empty();

		const { plugin, searchKeyword, openNote } = options;
		const fields = Object.keys(result);

		if (fields.length === 0) {
			renderEmpty(container, "未配置汇总字段，请在设置中添加。");
			return;
		}

		let hasAnyData = false;

		for (const field of fields) {
			const groups = result[field] || {};
			const filteredGroups = getSortedGroupKeys(groups)
				.map((key) => ({ key, entries: groups[key].filter((entry) => entryMatches(entry, searchKeyword)) }))
				.filter((group) => group.entries.length > 0);

			if (filteredGroups.length === 0) {
				continue;
			}

			hasAnyData = true;

			const section = container.createDiv("home-dashboard-section");
			const title = section.createEl("h2", { cls: "home-dashboard-section-title" });
			title.setText(getFieldLabel(field, plugin.settings.fieldAliases));
			title.createSpan({ cls: "home-dashboard-field-count" }).setText(`(${filteredGroups.length} 个分组)`);

			const grid = section.createDiv("home-dashboard-card-grid");

			for (const { key, entries } of filteredGroups) {
				const card = grid.createDiv("home-dashboard-card");
				const header = card.createDiv("home-dashboard-card-header");
				header.createDiv("home-dashboard-card-title").setText(key);
				header.createDiv("home-dashboard-card-count").setText(`${entries.length} 条`);

				const body = card.createDiv("home-dashboard-card-body");
				const listEl = body.createEl("ul", { cls: "home-dashboard-item-list" });
				for (const entry of entries) {
					const itemEl = listEl.createEl("li", { cls: "home-dashboard-item" });
					const linkEl = itemEl.createEl("span", { text: entry.basename, cls: "home-dashboard-item-link" });
					linkEl.addEventListener("click", () => openNote(entry.file));
				}
			}
		}

		if (!hasAnyData) {
			renderEmpty(container, "未找到任何匹配笔记。");
		}
	}
}

function getSortedGroupKeys(groups: Record<string, NoteEntry[]>): string[] {
	return Object.keys(groups).sort((a, b) => a.localeCompare(b));
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
