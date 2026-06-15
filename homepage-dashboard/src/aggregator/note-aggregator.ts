import { App, TFile } from "obsidian";
import { NoteEntry, AggregatedResult, DashboardCombination } from "../types";

export type { NoteEntry, AggregatedResult, DashboardCombination } from "../types";

export class NoteAggregator {
	app: App;
	fields: string[];
	dateFields: string[];

	constructor(app: App, fields: string[], dateFields: string[] = []) {
		this.app = app;
		// Dashboard 视图固定需要「作者」「项目」「类型」字段
		this.fields = Array.from(new Set([...fields, "作者", "项目", "类型"]));
		this.dateFields = dateFields;
	}

	async aggregate(): Promise<AggregatedResult> {
		const result: AggregatedResult = {};
		const files = this.app.vault.getMarkdownFiles();

		for (const field of this.fields) {
			result[field] = {};
		}

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache || !cache.frontmatter) {
				continue;
			}

			for (const field of this.fields) {
				const rawValue = cache.frontmatter[field];
				if (rawValue === undefined || rawValue === null || rawValue === "") {
					continue;
				}

				const values = this.normalizeValue(rawValue);
				const isDateField = this.dateFields.includes(field);

				for (const value of values) {
					const groupKeys = isDateField
						? this.parseDateGroups(value) ?? [value]
						: [value];

					for (const groupKey of groupKeys) {
						if (!result[field][groupKey]) {
							result[field][groupKey] = [];
						}
						result[field][groupKey].push({
							file,
							path: file.path,
							basename: file.basename,
							value,
						});
					}
				}
			}
		}

		// 对每个分组按文件路径排序
		for (const field of this.fields) {
			for (const groupKey of Object.keys(result[field])) {
				result[field][groupKey].sort((a, b) => a.basename.localeCompare(b.basename));
			}
		}

		return result;
	}

	private normalizeValue(raw: unknown): string[] {
		if (Array.isArray(raw)) {
			return raw
				.map((item) => String(item).trim())
				.filter((item) => item.length > 0);
		}

		const str = String(raw).trim();
		if (!str) {
			return [];
		}

		// 支持逗号分隔的多值
		return str
			.split(",")
			.map((item) => item.trim())
			.filter((item) => item.length > 0);
	}

	/**
	 * 解析日期值，返回 [YYYY, YYYY-MM, YYYY-MM-DD] 形式的分组键。
	 * 若无法解析为有效日期，则返回 null，调用方会回退到按原值分组。
	 */
	private parseDateGroups(raw: unknown): string[] | null {
		const str = String(raw).trim();
		if (!str) {
			return null;
		}

		// 优先匹配 ISO-like 日期格式：YYYY、YYYY-MM、YYYY-MM-DD（后可接时间）
		const isoMatch = str.match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?(?:[T ].*)?$/);
		if (isoMatch) {
			const year = isoMatch[1];
			const month = isoMatch[2];
			const day = isoMatch[3];

			// 简单校验年月日范围
			if (month && (Number(month) < 1 || Number(month) > 12)) {
				return null;
			}
			if (day && (Number(day) < 1 || Number(day) > 31)) {
				return null;
			}

			const groups: string[] = [year];
			if (month) {
				groups.push(`${year}-${month}`);
			}
			if (day) {
				groups.push(`${year}-${month}-${day}`);
			}
			return groups;
		}

		// 兜底：尝试用 Date.parse 解析其他常见格式（如 YYYY/MM/DD、MM/DD/YYYY 等）
		const timestamp = Date.parse(str);
		if (!Number.isNaN(timestamp)) {
			const date = new Date(timestamp);
			const year = String(date.getFullYear());
			const month = String(date.getMonth() + 1).padStart(2, "0");
			const day = String(date.getDate()).padStart(2, "0");
			return [year, `${year}-${month}`, `${year}-${month}-${day}`];
		}

		return null;
	}

	/**
	 * 判断一条 NoteEntry 是否满足某组组合规则。
	 * 组合规则的所有规则必须同时满足（AND 关系）。
	 */
	matchCombination(entry: NoteEntry, combination: DashboardCombination): boolean {
		const cache = this.app.metadataCache.getFileCache(entry.file);
		if (!cache || !cache.frontmatter) {
			return false;
		}

		return combination.rules.every((rule) => {
			const rawValue = cache.frontmatter![rule.field];
			if (rawValue === undefined || rawValue === null || rawValue === "") {
				return false;
			}
			const values = this.normalizeValue(rawValue);
			return values.includes(rule.value);
		});
	}
}
