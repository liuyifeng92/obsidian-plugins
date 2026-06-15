import { Notice, Plugin } from "obsidian";
import { HomeDashboardSettings } from "./src/types";
import { DEFAULT_SETTINGS, HomeDashboardSettingTab } from "./src/settings/settings";
import { HomeDashboardView, VIEW_TYPE_HOME_DASHBOARD } from "./src/view/HomeDashboardView";

const GITHUB_RAW_BASE = "https://raw.githubusercontent.com/liuyifeng92/obsidian-plugins/main/homepage-dashboard";

export default class HomeDashboardPlugin extends Plugin {
	settings: HomeDashboardSettings;
	private autoUpdateCheckTimer: number | null = null;
	private pendingAutoReloadTimer: number | null = null;
	private pendingAutoReloadVersion = "";

	async onload(): Promise<void> {
		await this.loadSettings();

		// 注册自定义视图
		this.registerView(
			VIEW_TYPE_HOME_DASHBOARD,
			(leaf) => new HomeDashboardView(leaf, this)
		);

		// 打开主页命令
		this.addCommand({
			id: "open-home-dashboard",
			name: "打开主页",
			callback: () => this.openHomeDashboard(),
		});

		// 设置页
		this.addSettingTab(new HomeDashboardSettingTab(this.app, this));

		// 自动检查更新
		this.scheduleAutoUpdateCheck();

		// 如果 ribbon 可用，添加左侧图标
		this.addRibbonIcon("layout-dashboard", "打开主页", () => {
			this.openHomeDashboard();
		});

		// 自动刷新：监听笔记元数据变更与增删改，防抖刷新当前主页视图
		this.registerEvent(
			this.app.metadataCache.on("changed", () => this.debouncedRefresh())
		);
		this.registerEvent(
			this.app.vault.on("create", () => this.debouncedRefresh())
		);
		this.registerEvent(
			this.app.vault.on("delete", () => this.debouncedRefresh())
		);
		this.registerEvent(
			this.app.vault.on("rename", () => this.debouncedRefresh())
		);
	}

	onunload(): void {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_HOME_DASHBOARD);
		this.clearAutoUpdateCheckTimer();
		this.clearPendingAutoReloadTimer();
	}

	private debouncedRefresh = debounce(() => {
		void this.refreshOpenViews();
	}, 300);

	private async refreshOpenViews(): Promise<void> {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_HOME_DASHBOARD);
		await Promise.all(
			leaves.map(async (leaf) => {
				const view = leaf.view;
				if (view instanceof HomeDashboardView) {
					await view.render().catch((error) => {
						console.error("Home dashboard refresh failed:", error);
					});
				}
			})
		);
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	async openHomeDashboard(): Promise<void> {
		const { workspace } = this.app;

		// 如果已有主页视图，则激活它
		const existingLeaves = workspace.getLeavesOfType(VIEW_TYPE_HOME_DASHBOARD);
		if (existingLeaves.length > 0) {
			workspace.revealLeaf(existingLeaves[0]);
			return;
		}

		// 否则在主区域创建新的 leaf
		const leaf = workspace.getLeaf(true);
		await leaf.setViewState({
			type: VIEW_TYPE_HOME_DASHBOARD,
			active: true,
		});
	}

	async checkForUpdate(): Promise<{ hasUpdate: boolean; version: string; error?: string }> {
		try {
			const response = await fetch(`${GITHUB_RAW_BASE}/manifest.json`);

			if (response.status === 404) {
				return { hasUpdate: false, version: "", error: "not_found" };
			}
			if (!response.ok) {
				return { hasUpdate: false, version: "", error: `请求失败：${response.status}` };
			}

			const remoteManifest = (await response.json()) as { version?: string };
			const remoteVersion = remoteManifest.version ?? "";
			if (!remoteVersion) {
				return { hasUpdate: false, version: "", error: "远端版本号无效" };
			}

			const currentVersion = this.manifest.version;
			const hasUpdate = this.compareVersions(remoteVersion, currentVersion) > 0;
			return { hasUpdate, version: remoteVersion };
		} catch (error) {
			return { hasUpdate: false, version: "", error: String(error) };
		}
	}

	async performUpdate(version: string, onProgress?: (step: number, total: number) => void): Promise<void> {
		await this.downloadAndWriteUpdateFiles(version, onProgress);
		await this.reloadPlugin(version, false);
	}

	private async downloadAndWriteUpdateFiles(
		version: string,
		onProgress?: (step: number, total: number) => void,
	): Promise<void> {
		const files = ["main.js", "manifest.json", "styles.css"] as const;
		const contents: Record<string, string> = {};

		for (let index = 0; index < files.length; index++) {
			const file = files[index];
			const response = await fetch(`${GITHUB_RAW_BASE}/${file}`);
			if (!response.ok) {
				throw new Error(`下载 ${file} 失败：${response.status}`);
			}
			contents[file] = await response.text();
			onProgress?.(index + 1, files.length);
		}

		const pluginDir = this.manifest.dir;
		if (!pluginDir) {
			throw new Error("无法获取插件目录");
		}

		await this.app.vault.adapter.write(`${pluginDir}/main.js`, contents["main.js"]);
		await this.app.vault.adapter.write(`${pluginDir}/manifest.json`, contents["manifest.json"]);
		await this.app.vault.adapter.write(`${pluginDir}/styles.css`, contents["styles.css"]);
	}

	private async reloadPlugin(version: string, auto = false): Promise<void> {
		const pluginId = this.manifest.id;
		const app = this.app;

		if (auto) {
			// @ts-ignore — 内部 API
			const setting = app.setting;
			if (setting && setting.activeTab?.id === pluginId) {
				this.pendingAutoReloadVersion = version;
				this.watchPendingAutoReload();
				return;
			}
		}

		new Notice(auto ? `发现新版本（${version}），正在自动更新...` : `更新完成（${version}），正在重载插件...`);

		window.setTimeout(async () => {
			try {
				// @ts-ignore — 内部 API
				await app.plugins.unloadPlugin(pluginId);
				// @ts-ignore — 内部 API
				delete app.plugins.manifests[pluginId];

				await new Promise((resolve) => window.setTimeout(resolve, 300));

				// @ts-ignore — 内部 API
				await app.plugins.loadManifests();

				await new Promise((resolve) => window.setTimeout(resolve, 300));

				// @ts-ignore — 内部 API
				await app.plugins.loadPlugin(pluginId);
				// @ts-ignore — 内部 API
				await app.plugins.enablePlugin(pluginId);

				await new Promise((resolve) => window.setTimeout(resolve, 500));

				// @ts-ignore — 内部 API
				app.setting.open();
				// @ts-ignore — 内部 API
				app.setting.openTabById(pluginId);

				new Notice(auto ? `插件已自动更新到 ${version}` : `插件已重载到 ${version}`);
			} catch (e) {
				console.error("[homepage-dashboard] 重载失败:", e);
				new Notice("自动重载失败，请点击已安装插件页的「重新加载插件」按钮");
			}
		}, 100);
	}

	private watchPendingAutoReload() {
		this.clearPendingAutoReloadTimer();
		this.pendingAutoReloadTimer = window.setInterval(() => {
			const pluginId = this.manifest.id;
			// @ts-ignore — 内部 API
			const setting = this.app.setting;
			if (!setting || setting.activeTab?.id !== pluginId) {
				this.clearPendingAutoReloadTimer();
				const version = this.pendingAutoReloadVersion;
				this.pendingAutoReloadVersion = "";
				if (version) {
					void this.reloadPlugin(version, true);
				}
			}
		}, 1000);
	}

	private clearAutoUpdateCheckTimer() {
		if (this.autoUpdateCheckTimer !== null) {
			window.clearTimeout(this.autoUpdateCheckTimer);
			this.autoUpdateCheckTimer = null;
		}
	}

	private clearPendingAutoReloadTimer() {
		if (this.pendingAutoReloadTimer !== null) {
			window.clearInterval(this.pendingAutoReloadTimer);
			this.pendingAutoReloadTimer = null;
		}
	}

	private scheduleAutoUpdateCheck() {
		this.clearAutoUpdateCheckTimer();
		this.autoUpdateCheckTimer = window.setTimeout(() => {
			void this.runAutoUpdateCheck();
			this.registerInterval(
				window.setInterval(() => {
					void this.runAutoUpdateCheck();
				}, 60 * 60 * 1000),
			);
		}, 30 * 1000);
	}

	private async runAutoUpdateCheck() {
		if (!this.settings.autoUpdate) {
			return;
		}

		const result = await this.checkForUpdate();
		if (result.error || !result.hasUpdate) {
			return;
		}

		void this.performAutoUpdate(result.version);
	}

	private async performAutoUpdate(version: string): Promise<void> {
		try {
			new Notice(`发现新版本 ${version}，正在自动更新...`);
			await this.downloadAndWriteUpdateFiles(version);
			await this.reloadPlugin(version, true);
		} catch (error) {
			console.error("[homepage-dashboard] 自动更新失败:", error);
		}
	}

	private compareVersions(v1: string, v2: string): number {
		const parseVersion = (version: string): number[] => {
			return version
				.replace(/^v/, "")
				.split(".")
				.map((part) => {
					const match = /^\d+/.exec(part);
					return match ? parseInt(match[0], 10) : 0;
				});
		};

		const parts1 = parseVersion(v1);
		const parts2 = parseVersion(v2);
		const maxLength = Math.max(parts1.length, parts2.length);

		for (let index = 0; index < maxLength; index++) {
			const a = parts1[index] ?? 0;
			const b = parts2[index] ?? 0;
			if (a > b) return 1;
			if (a < b) return -1;
		}
		return 0;
	}
}

function debounce<T extends (...args: unknown[]) => unknown>(
	fn: T,
	wait: number
): (...args: Parameters<T>) => void {
	let timer: ReturnType<typeof setTimeout> | null = null;
	return (...args) => {
		if (timer !== null) {
			clearTimeout(timer);
		}
		timer = setTimeout(() => {
			fn(...args);
			timer = null;
		}, wait);
	};
}
