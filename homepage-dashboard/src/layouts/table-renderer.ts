import { AggregatedResult, LayoutRenderer, NoteEntry, RenderOptions } from "../types";

export class TableRenderer implements LayoutRenderer {
	render(container: HTMLElement, result: AggregatedResult, options: RenderOptions): void {
		container.empty();

		const { plugin, searchKeyword, openNote } = options;
		const fields = getSortedFields(result, plugin.settings.fieldOrder);

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

			const table = section.createEl("table", { cls: "home-dashboard-table" });
			const thead = table.createEl("thead");
			const headerRow = thead.createEl("tr");
			headerRow.createEl("th").setText("分组");
			headerRow.createEl("th").setText("笔记");

			const tbody = table.createEl("tbody");
			for (const { key, entries } of filteredGroups) {
				const row = tbody.createEl("tr");
				row.createEl("td", { cls: "home-dashboard-table-group" }).setText(key);

				const notesCell = row.createEl("td", { cls: "home-dashboard-table-notes" });
				for (let i = 0; i < entries.length; i++) {
					const entry = entries[i];
					const linkEl = notesCell.createEl("span", { text: entry.basename, cls: "home-dashboard-item-link" });
					linkEl.addEventListener("click", () => openNote(entry.file));
					if (i < entries.length - 1) {
						notesCell.appendText("、");
					}
				}
			}
		}

		if (!hasAnyData) {
			renderEmpty(container, "未找到任何匹配笔记。");
		}
	}
}

function getSortedFields(result: AggregatedResult, fieldOrder: string[]): string[] {
	const allFields = Object.keys(result);
	const ordered = fieldOrder.filter((field) => allFields.includes(field));
	const remaining = allFields.filter((field) => !ordered.includes(field));
	return [...ordered, ...remaining.sort((a, b) => a.localeCompare(b))];
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
