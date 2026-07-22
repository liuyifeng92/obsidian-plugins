// 标记行（Marker Line）纯逻辑：解析 / 序列化 / 定位笔记源码中的表格。
// 不依赖 obsidian API 与 DOM，可单独被 vitest 测试。

export interface SourceTable {
	/** 表格首行（表头）在源码中的行号（0 起） */
	startLine: number;
	/** 表头列数 */
	colCount: number;
	/** 表格正上方标记行的行号；无标记行时为 null */
	markerLine: number | null;
	/** 标记行解析出的各列像素宽度；无标记行或非法时为 null */
	widths: number[] | null;
}

// 规范格式：<!-- colwidths: 120,96,180 -->
export function serializeMarkerLine(widths: number[]): string {
	return `<!-- colwidths: ${widths.join(",")} -->`;
}

// 只接受正整数像素宽度；任何一段非法（空、非数字、非正整数）都视为无标记行
export function parseMarkerLine(line: string): number[] | null {
	const match = line.trim().match(/^<!--\s*colwidths:\s*(.*?)\s*-->$/);
	if (!match) return null;
	const parts = match[1].split(",").map((part) => part.trim());
	if (parts.some((part) => part === "")) return null;
	const widths = parts.map((part) => Number(part));
	if (widths.some((w) => !Number.isInteger(w) || w <= 0)) return null;
	return widths;
}

// 统计表头行的列数：去掉首尾竖线后按 | 切分
function countColumns(headerLine: string): number {
	const trimmed = headerLine.trim().replace(/^\|/, "").replace(/\|$/, "");
	return trimmed.split("|").length;
}

// 扫描笔记源码，按顺序列出所有 markdown 表格。
// 连续的 | 开头行视为同一张表；代码围栏内的 | 行跳过；
// callout 内的表格（> | ...）不识别，与 DOM 层跳过 .callout 内表格保持一致。
export function parseTables(source: string): SourceTable[] {
	const lines = source.split("\n");
	const tables: SourceTable[] = [];
	let inFence = false;
	let current: SourceTable | null = null;

	for (let i = 0; i < lines.length; i++) {
		const trimmed = lines[i].trim();
		if (trimmed.startsWith("```")) {
			inFence = !inFence;
			current = null;
			continue;
		}
		if (inFence || !trimmed.startsWith("|")) {
			current = null;
			continue;
		}
		if (current) continue; // 表格的后续行

		const widths = i > 0 ? parseMarkerLine(lines[i - 1]) : null;
		current = {
			startLine: i,
			colCount: countColumns(trimmed),
			markerLine: widths ? i - 1 : null,
			widths,
		};
		tables.push(current);
	}
	return tables;
}

// 把 widths 写入第 tableIndex 张表格的标记行：有则原位替换，无则插入到表格正上方。
// 表格不存在或列数与 widths 不一致（结构已变化）时返回 null，调用方放弃写入。
export function upsertMarker(
	source: string,
	tableIndex: number,
	widths: number[]
): string | null {
	const table = parseTables(source)[tableIndex];
	if (!table || table.colCount !== widths.length) return null;
	const lines = source.split("\n");
	const marker = serializeMarkerLine(widths);
	if (table.markerLine !== null) {
		lines[table.markerLine] = marker;
	} else {
		lines.splice(table.startLine, 0, marker);
	}
	return lines.join("\n");
}
