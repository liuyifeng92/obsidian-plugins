import { describe, expect, it } from "vitest";
import {
	parseMarkerLine,
	parseTables,
	reconcileMarkers,
	reconcileWidths,
	serializeMarkerLine,
	upsertMarker,
} from "../src/marker";

describe("parseMarkerLine", () => {
	it("解析合法标记行", () => {
		expect(parseMarkerLine("<!-- colwidths: 120,96,180 -->")).toEqual([120, 96, 180]);
	});

	it("容忍多余空白", () => {
		expect(parseMarkerLine("  <!--  colwidths:  120 , 96  -->  ")).toEqual([120, 96]);
	});

	it("非法或缺失标记行返回 null", () => {
		expect(parseMarkerLine("")).toBeNull();
		expect(parseMarkerLine("| a | b |")).toBeNull();
		expect(parseMarkerLine("<!-- colwidths: -->")).toBeNull();
		expect(parseMarkerLine("<!-- colwidths: abc -->")).toBeNull();
		expect(parseMarkerLine("<!-- colwidths: 120, -->")).toBeNull();
		expect(parseMarkerLine("<!-- colwidths: 0,96 -->")).toBeNull();
		expect(parseMarkerLine("<!-- colwidths: -5,96 -->")).toBeNull();
		expect(parseMarkerLine("<!-- colwidths: 12.5,96 -->")).toBeNull();
		// 缺少结尾的注释标记
		expect(parseMarkerLine("<!-- colwidths: 120,96")).toBeNull();
	});
});

describe("serializeMarkerLine", () => {
	it("序列化为规范格式", () => {
		expect(serializeMarkerLine([120, 96, 180])).toBe("<!-- colwidths: 120,96,180 -->");
	});

	it("与 parseMarkerLine 往返一致", () => {
		const widths = [40, 120, 333];
		expect(parseMarkerLine(serializeMarkerLine(widths))).toEqual(widths);
	});
});

describe("parseTables", () => {
	const source = [
		"前文",
		"<!-- colwidths: 100,200 -->",
		"| a | b |",
		"|---|---|",
		"| 1 | 2 |",
		"",
		"| c | d | e |",
		"|---|---|---|",
		"",
		"```",
		"| 不是表格 |",
		"```",
	].join("\n");

	it("识别表格位置、列数与上方标记行", () => {
		const tables = parseTables(source);
		expect(tables).toHaveLength(2);

		expect(tables[0].startLine).toBe(2);
		expect(tables[0].colCount).toBe(2);
		expect(tables[0].markerLine).toBe(1);
		expect(tables[0].widths).toEqual([100, 200]);

		// 无标记行的表格
		expect(tables[1].startLine).toBe(6);
		expect(tables[1].colCount).toBe(3);
		expect(tables[1].markerLine).toBeNull();
		expect(tables[1].widths).toBeNull();
	});

	it("跳过代码围栏中的 | 行", () => {
		expect(parseTables(source).every((t) => t.colCount > 1)).toBe(true);
	});
});

describe("upsertMarker", () => {
	it("无标记行表格首次拖动：在表格正上方插入标记行", () => {
		const source = ["前文", "| a | b |", "|---|---|"].join("\n");
		const result = upsertMarker(source, 0, [120, 96]);
		expect(result).toBe(
			["前文", "<!-- colwidths: 120,96 -->", "| a | b |", "|---|---|"].join("\n")
		);
	});

	it("已有标记行：原位替换", () => {
		const source = [
			"<!-- colwidths: 100,200 -->",
			"| a | b |",
			"|---|---|",
		].join("\n");
		const result = upsertMarker(source, 0, [150, 80]);
		expect(result).toBe(
			["<!-- colwidths: 150,80 -->", "| a | b |", "|---|---|"].join("\n")
		);
	});

	it("列数与表格不一致或表格不存在时返回 null", () => {
		const source = "| a | b |\n|---|---|";
		expect(upsertMarker(source, 0, [1, 2, 3])).toBeNull();
		expect(upsertMarker(source, 1, [1, 2])).toBeNull();
	});
});

describe("reconcileWidths", () => {
	it("中间插入一列：新列补默认 120，其余列宽度不变", () => {
		expect(reconcileWidths(["a", "b", "c"], ["a", "b", "x", "c"], [120, 96, 180])).toEqual([
			120, 96, 120, 180,
		]);
	});

	it("删除一列：移除对应位置的宽度", () => {
		expect(reconcileWidths(["a", "b", "c"], ["a", "c"], [120, 96, 180])).toEqual([120, 180]);
	});

	it("表头改名视为删一列加一列：仅该列恢复默认，其余不错位", () => {
		expect(reconcileWidths(["a", "b", "c"], ["a", "x", "c"], [120, 96, 180])).toEqual([
			120, 120, 180,
		]);
	});

	it("重复表头按序列位置对齐", () => {
		expect(reconcileWidths(["a", "a", "b"], ["a", "a", "a", "b"], [1, 2, 3])).toEqual([
			1, 2, 120, 3,
		]);
	});

	it("空表头按序列位置对齐", () => {
		expect(reconcileWidths(["", "b"], ["", "", "b"], [10, 20])).toEqual([10, 120, 20]);
	});
});

describe("reconcileMarkers", () => {
	it("表头插入列后原位更新标记行", () => {
		const before = [
			"<!-- colwidths: 120,96,180 -->",
			"| a | b | c |",
			"|---|---|---|",
		].join("\n");
		const after = [
			"<!-- colwidths: 120,96,180 -->",
			"| a | b | x | c |",
			"|---|---|---|---|",
		].join("\n");
		expect(reconcileMarkers(after, parseTables(before))).toBe(
			[
				"<!-- colwidths: 120,96,120,180 -->",
				"| a | b | x | c |",
				"|---|---|---|---|",
			].join("\n")
		);
	});

	it("表头未变化时不改动源码", () => {
		const source = [
			"<!-- colwidths: 120,96 -->",
			"| a | b |",
			"|---|---|",
		].join("\n");
		expect(reconcileMarkers(source, parseTables(source))).toBe(source);
	});

	it("无标记行的表格不生成标记行", () => {
		const before = "| a | b |\n|---|---|";
		const after = "| a | b | c |\n|---|---|---|";
		expect(reconcileMarkers(after, parseTables(before))).toBe(after);
	});

	it("表格增删导致行号偏移时不做猜测，返回原文", () => {
		const before = [
			"<!-- colwidths: 120,96 -->",
			"| a | b |",
			"|---|---|",
		].join("\n");
		// 上方新增内容使表格下移，startLine 对不上 → 放弃维护
		const after = ["新插入的一行", ...before.split("\n")].join("\n").replace("| a | b |", "| a | b | c |");
		expect(reconcileMarkers(after, parseTables(before))).toBe(after);
	});
});
