import { describe, expect, it, vi } from "vitest";
import { calculateBleedLayout, setFixedWidth } from "../src/layout";

describe("calculateBleedLayout", () => {
	it("容器覆盖当前 Markdown 分栏，表格起点保持正文对齐", () => {
		expect(calculateBleedLayout(100, 1100, 300)).toEqual({
			marginLeft: -200,
			paddingLeft: 200,
			width: 1000,
		});
	});

	it("正文起点不会被扩展到分栏左边界之外", () => {
		expect(calculateBleedLayout(100, 800, 80)).toEqual({
			marginLeft: 0,
			paddingLeft: 0,
			width: 700,
		});
	});
});

describe("setFixedWidth", () => {
	it("覆盖主题强制的全宽表格规则", () => {
		const setProperty = vi.fn();
		const element = { style: { setProperty } } as unknown as HTMLElement;

		setFixedWidth(element, 500);

		expect(setProperty).toHaveBeenCalledWith("width", "500px", "important");
	});
});
