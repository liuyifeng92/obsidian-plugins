import { App } from "obsidian";
import { NoteEntry } from "../types";

export function appendTag(container: HTMLElement, label: string, value: string): void {
	if (!value) {
		return;
	}
	const tag = container.createSpan("home-dashboard-modal-item-tag");
	tag.setText(`${label}: ${value}`);
}

export function getFieldValue(entry: NoteEntry, app: App, fields: string[]): string {
	const cache = app.metadataCache.getFileCache(entry.file);
	if (!cache?.frontmatter) {
		return "";
	}
	for (const field of fields) {
		const value = cache.frontmatter[field];
		if (value !== undefined && value !== null && value !== "") {
			const text = String(value).trim();
			if (text) {
				return text;
			}
		}
	}
	return "";
}

export function formatDate(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

export function loadSummary(entry: NoteEntry, app: App): string {
	const cache = app.metadataCache.getFileCache(entry.file);
	if (!cache?.frontmatter) {
		return "";
	}

	const summaryFields = ["summary", "abstract", "description", "excerpt", "摘要", "简介"];
	for (const field of summaryFields) {
		const value = cache.frontmatter[field];
		if (value !== undefined && value !== null && value !== "") {
			const text = String(value).trim();
			if (text) {
				return text.length > 200 ? text.slice(0, 200) + "..." : text;
			}
		}
	}

	return "";
}
