import { describe, expect, it } from "vitest";
import {
	parseMarkerLine,
	parseTables,
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
