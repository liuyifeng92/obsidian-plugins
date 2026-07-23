import { describe, expect, it, vi } from "vitest";
import { preserveScrollTop } from "../src/scroll";

describe("preserveScrollTop", () => {
	it("keeps the page position through the editor update and its next layout frame", () => {
		const callbacks: FrameRequestCallback[] = [];
		vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
			callbacks.push(callback);
			return 1;
		});
		const target = { scrollTop: 480, isConnected: true } as HTMLElement;

		preserveScrollTop(target, () => {
			target.scrollTop = 0;
		});

		expect(target.scrollTop).toBe(480);
		target.scrollTop = 0;
		callbacks[0](0);
		expect(target.scrollTop).toBe(480);
	});

	it("still runs the update when no scrolling element is available", () => {
		const update = vi.fn();

		preserveScrollTop(null, update);

		expect(update).toHaveBeenCalledOnce();
	});
});
