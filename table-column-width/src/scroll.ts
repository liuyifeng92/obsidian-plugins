export function preserveScrollTop(target: HTMLElement | null, update: () => void): void {
	const scrollTop = target?.scrollTop;
	update();
	if (!target || scrollTop === undefined) return;
	target.scrollTop = scrollTop;
	requestAnimationFrame(() => {
		if (target.isConnected) target.scrollTop = scrollTop;
	});
}
