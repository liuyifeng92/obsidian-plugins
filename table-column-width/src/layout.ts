export interface BleedLayout {
	marginLeft: number;
	paddingLeft: number;
	width: number;
}

export function setFixedWidth(element: HTMLElement, width: number): void {
	element.style.setProperty("width", `${width}px`, "important");
}

export function calculateBleedLayout(
	paneLeft: number,
	paneRight: number,
	contentLeft: number
): BleedLayout {
	const leftInset = Math.max(0, contentLeft - paneLeft);
	return {
		marginLeft: leftInset === 0 ? 0 : -leftInset,
		paddingLeft: leftInset,
		width: Math.max(0, paneRight - paneLeft),
	};
}
