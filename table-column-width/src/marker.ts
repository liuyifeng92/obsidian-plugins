// 标记行（Marker Line）纯逻辑：解析 / 序列化 / 定位笔记源码中的表格。
// 不依赖 obsidian API 与 DOM，可单独被 vitest 测试。

export interface SourceTable {
	/** 表格首行（表头）在源码中的行号（0 起） */
	startLine: number;
	/** 表头列数 */
	colCount: number;
	/** 表头各列文本（trim 后），表头比对 diff 的输入 */
	headers: string[];
	/** 表格上方标记行的行号；无标记行时为 null */
	markerLine: number | null;
	/** 标记行解析出的各列像素宽度；无标记行或非法时为 null */
	widths: number[] | null;
}

export interface TextChange {
	from: number;
	to: number;
	text: string;
}

// 计算单段最小文本变更，供编辑器事务保留选区与小部件状态。
export function minimalTextChange(before: string, after: string): TextChange {
	let from = 0;
	while (from < before.length && from < after.length && before[from] === after[from]) from++;

	let beforeEnd = before.length;
	let afterEnd = after.length;
	while (
		beforeEnd > from &&
		afterEnd > from &&
		before[beforeEnd - 1] === after[afterEnd - 1]
	) {
		beforeEnd--;
		afterEnd--;
	}
	return { from, to: beforeEnd, text: after.slice(from, afterEnd) };
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

function isEscaped(line: string, index: number): boolean {
	let slashes = 0;
	for (let i = index - 1; i >= 0 && line[i] === "\\"; i--) slashes++;
	return slashes % 2 === 1;
}

function splitTableRow(line: string): string[] | null {
	let row = line.trim();
	let hasSeparator = false;
	for (let i = 0; i < row.length; i++) {
		if (row[i] === "|" && !isEscaped(row, i)) hasSeparator = true;
	}
	if (!hasSeparator) return null;
	if (row.startsWith("|")) row = row.slice(1);
	if (row.endsWith("|") && !isEscaped(row, row.length - 1)) row = row.slice(0, -1);

	const cells: string[] = [];
	let cell = "";
	for (let i = 0; i < row.length; i++) {
		if (row[i] === "|" && !isEscaped(row, i)) {
			cells.push(cell.trim());
			cell = "";
		} else {
			cell += row[i];
		}
	}
	cells.push(cell.trim());
	return cells;
}

function splitContainerPrefix(line: string): { prefix: string; content: string } {
	const prefix = line.match(/^(\s*(?:>\s*)*)/)?.[1] ?? "";
	return { prefix, content: line.slice(prefix.length) };
}

function sameContainer(a: string, b: string): boolean {
	return a.replace(/\s/g, "") === b.replace(/\s/g, "");
}

function blankContainerLine(prefix: string): string {
	return prefix.includes(">") ? prefix.trimEnd() : "";
}

// 解析表头行：首尾竖线可选，转义竖线保留在单元格内
export function parseHeaders(headerLine: string): string[] {
	return splitTableRow(headerLine) ?? [];
}

// 扫描笔记源码，按顺序列出所有 markdown 表格。
// 只有「表头 + 同列数分隔行」才计为表格；代码围栏内跳过。
export function parseTables(source: string): SourceTable[] {
	const lines = source.split("\n");
	const tables: SourceTable[] = [];
	let fence: { char: string; length: number } | null = null;

	for (let i = 0; i < lines.length; i++) {
		const { prefix, content } = splitContainerPrefix(lines[i]);
		const trimmed = content.trim();
		const fenceMatch = trimmed.match(/^(`{3,}|~{3,})/);
		if (fenceMatch) {
			const marker = fenceMatch[1];
			if (!fence) {
				fence = { char: marker[0], length: marker.length };
			} else if (marker[0] === fence.char && marker.length >= fence.length) {
				fence = null;
			}
			continue;
		}
		if (fence || i + 1 >= lines.length) continue;

		const headers = splitTableRow(trimmed);
		const next = splitContainerPrefix(lines[i + 1]);
		const delimiters = prefix === next.prefix ? splitTableRow(next.content) : null;
		if (
			!headers ||
			!delimiters ||
			headers.length !== delimiters.length ||
			!delimiters.every((cell) => /^:?-{3,}:?$/.test(cell))
		) {
			continue;
		}

		let markerLine = i - 1;
		const previous = markerLine >= 0 ? splitContainerPrefix(lines[markerLine]) : null;
		if (previous && previous.content.trim() === "" && sameContainer(previous.prefix, prefix)) {
			markerLine--;
		}
		const marker = markerLine >= 0 ? splitContainerPrefix(lines[markerLine]) : null;
		const widths = marker && sameContainer(marker.prefix, prefix) ? parseMarkerLine(marker.content) : null;
		tables.push({
			startLine: i,
			colCount: headers.length,
			headers,
			markerLine: widths ? markerLine : null,
			widths,
		});
		i++; // 分隔行不可能另起一张表
	}
	return tables;
}

// Obsidian Live Preview 需要 HTML 标记与表头之间有空行；旧格式在加载时迁移。
export function normalizeMarkerSpacing(source: string): string {
	const lines = source.split("\n");
	const immediate = parseTables(source).filter(
		(table) => table.markerLine !== null && table.startLine === table.markerLine + 1
	);
	for (let i = immediate.length - 1; i >= 0; i--) {
		const table = immediate[i];
		const { prefix } = splitContainerPrefix(lines[table.startLine]);
		lines.splice(table.startLine, 0, blankContainerLine(prefix));
	}
	return immediate.length > 0 ? lines.join("\n") : source;
}

// 把 widths 写入第 tableIndex 张表格的标记行：有则原位替换，无则插入到表格上方并留空行。
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
		const { prefix } = splitContainerPrefix(lines[table.markerLine]);
		lines[table.markerLine] = `${prefix}${marker}`;
		if (table.startLine === table.markerLine + 1) {
			const tablePrefix = splitContainerPrefix(lines[table.startLine]).prefix;
			lines.splice(table.startLine, 0, blankContainerLine(tablePrefix));
		}
	} else {
		const { prefix } = splitContainerPrefix(lines[table.startLine]);
		lines.splice(table.startLine, 0, `${prefix}${marker}`, blankContainerLine(prefix));
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
		} else if (dp[i + 1][j] > dp[i][j + 1]) {
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
		const { prefix } = splitContainerPrefix(lines[curr.markerLine]);
		lines[curr.markerLine] = `${prefix}${serializeMarkerLine(
			reconcileWidths(prev.headers, curr.headers, prev.widths)
		)}`;
		changed = true;
	}
	return changed ? lines.join("\n") : source;
}
