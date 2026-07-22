// 标记行（Marker Line）纯逻辑：解析 / 序列化 / 定位笔记源码中的表格。
// 不依赖 obsidian API 与 DOM，可单独被 vitest 测试。

export interface SourceTable {
	/** 表格首行（表头）在源码中的行号（0 起） */
	startLine: number;
	/** 表头列数 */
	colCount: number;
	/** 表头各列文本（trim 后），表头比对 diff 的输入 */
	headers: string[];
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

// 解析表头行：去掉首尾竖线后按 | 切分并 trim
export function parseHeaders(headerLine: string): string[] {
	const trimmed = headerLine.trim().replace(/^\|/, "").replace(/\|$/, "");
	return trimmed.split("|").map((cell) => cell.trim());
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
		const headers = parseHeaders(trimmed);
		current = {
			startLine: i,
			colCount: headers.length,
			headers,
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

/** 表头比对时新插入/改名列的默认宽度 */
export const DEFAULT_COL_WIDTH = 120;

// 表头文本序列的 LCS 匹配对（旧列序号, 新列序号），按位置对齐，
// 重复表头、空表头不需要单名查找也能正确对应
function lcsPairs(oldSeq: string[], newSeq: string[]): Array<[number, number]> {
	const m = oldSeq.length;
	const n = newSeq.length;
	const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
	for (let i = m - 1; i >= 0; i--) {
		for (let j = n - 1; j >= 0; j--) {
			dp[i][j] =
				oldSeq[i] === newSeq[j]
					? dp[i + 1][j + 1] + 1
					: Math.max(dp[i + 1][j], dp[i][j + 1]);
		}
	}
	const pairs: Array<[number, number]> = [];
	let i = 0;
	let j = 0;
	while (i < m && j < n) {
		if (oldSeq[i] === newSeq[j]) {
			pairs.push([i, j]);
			i++;
			j++;
		} else if (dp[i + 1][j] >= dp[i][j + 1]) {
			i++;
		} else {
			j++;
		}
	}
	return pairs;
}

// 表头比对核心：用新旧表头序列 diff 出保留的列，保留列维持原宽度，
// 新增/改名的列（改名 = 删一列加一列）补默认宽度
export function reconcileWidths(
	oldHeaders: string[],
	newHeaders: string[],
	oldWidths: number[]
): number[] {
	const kept = new Map<number, number>(); // 新列序号 → 保留的原宽度
	for (const [oldIndex, newIndex] of lcsPairs(oldHeaders, newHeaders)) {
		if (oldIndex < oldWidths.length) kept.set(newIndex, oldWidths[oldIndex]);
	}
	return newHeaders.map((_, i) => kept.get(i) ?? DEFAULT_COL_WIDTH);
}

// 编辑导致表头变化后自动维护标记行：按 startLine 对应缓存中的旧表格，
// 表头序列不同则重算宽度并原位更新标记行。
// 表格增删导致行号偏移时不做猜测，返回原文；无标记行的表格不生成标记行。
export function reconcileMarkers(source: string, cached: SourceTable[]): string {
	const byStartLine = new Map(cached.map((t) => [t.startLine, t]));
	const lines = source.split("\n");
	let changed = false;
	for (const curr of parseTables(source)) {
		const prev = byStartLine.get(curr.startLine);
		if (!prev?.widths || curr.markerLine === null) continue;
		const unchanged =
			prev.headers.length === curr.headers.length &&
			prev.headers.every((h, i) => h === curr.headers[i]);
		if (unchanged) continue;
		lines[curr.markerLine] = serializeMarkerLine(
			reconcileWidths(prev.headers, curr.headers, prev.widths)
		);
		changed = true;
	}
	return changed ? lines.join("\n") : source;
}
