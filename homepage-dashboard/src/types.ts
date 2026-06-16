import { TFile } from "obsidian";

export type DashboardLayout = "dashboard" | "list" | "card" | "table" | "calendar";

export const LAYOUT_OPTIONS: { value: DashboardLayout; label: string }[] = [
	{ value: "dashboard", label: "看板" },
	{ value: "list", label: "列表" },
	{ value: "card", label: "卡片" },
	{ value: "table", label: "表格" },
	{ value: "calendar", label: "日历" },
];

export interface NoteEntry {
	file: TFile;
	path: string;
	basename: string;
	value: string;
}

export interface AggregatedResult {
	[field: string]: {
		[groupKey: string]: NoteEntry[];
	};
}

export interface DashboardCombinationRule {
	field: string;
	value: string;
}

export interface DashboardCombination {
	name: string;
	rules: DashboardCombinationRule[];
}

export interface HomeDashboardSettings {
	homeViewTitle: string;
	aggregatedFields: string[];
	fieldAliases: Record<string, string>;
	dateFields: string[];
	dashboardCombinations: DashboardCombination[];
	autoUpdate: boolean;
	heatmapColor: string;
	fieldDistributionColor: string;
}

export interface HomeDashboardPluginLike {
	settings: HomeDashboardSettings;
	saveSettings(): Promise<void>;
	app: import("obsidian").App;
	manifest: { version: string; id: string; dir?: string };
	checkForUpdate(): Promise<{ hasUpdate: boolean; version: string; error?: string }>;
	performUpdate(version: string, onProgress?: (step: number, total: number) => void): Promise<void>;
}

export interface RenderOptions {
	plugin: HomeDashboardPluginLike;
	app: import("obsidian").App;
	layout: DashboardLayout;
	searchKeyword: string;
	openNote: (file: TFile) => void;
}

export interface LayoutRenderer {
	render(container: HTMLElement, result: AggregatedResult, options: RenderOptions): void;
}
