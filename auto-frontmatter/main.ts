import {
	App,
	Editor,
	Menu,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	setIcon,
	TAbstractFile,
	TFile,
	TFolder,
} from "obsidian";

interface AutoFrontmatterSettings {
	authorMode?: string;
	authorCustom?: string;
	authorName?: string;
	aiApiKey: string;
	aiApiUrl: string;
	aiModelName: string;
	aiSummaryEnabled: boolean;
	aiSummaryPrompt: string;
	deviceBindings: DeviceAuthorBinding[];
	emptyFieldHighlight: boolean;
	folderDefaults: FolderDefaultRule[];
	showFolderCheckmark: boolean;
}

interface SummaryService {
	generateSummary(document: SummaryDocument): Promise<string>;
}

interface SummaryDocument {
	title: string;
	frontmatter: string;
	content: string;
}

interface DeviceAuthorBinding {
	uuid: string;
	author: string;
}

interface FolderDefaultRule {
	folder: string;
	field: FolderDefaultField;
	value: string;
	createdBy?: string;
	createdAt?: string;
	modifiedBy?: string;
	modifiedAt?: string;
	fields?: Array<{
		field: FolderDefaultField;
		value: string;
	}>;
}

const MAX_SUMMARY_CONTENT_LENGTH = 16000;
const AI_SUMMARY_SCHEDULER_CHECK_MS = 60 * 1000;
const AI_SUMMARY_REQUEST_DELAY_MS = 2000;
const MIN_SUMMARY_BODY_LENGTH = 50;
const RULES_PER_PAGE = 6;
const OLD_AI_SUMMARY_PROMPT = `你是一位专业的文档摘要助手。请对以下文档内容生成一段简洁的摘要。

要求：
1. 一段话概括，不超过 100 字
2. 提炼核心主题、关键结论或主要决策
3. 不要出现"本文"、"这篇文档"等指代词，直接陈述内容
4. 如果文档包含图片描述或代码片段，侧重总结其意图而非细节
5. 使用与原文一致的语言（中文文档用中文，英文文档用英文）

文档内容：
{content}`;
const PREVIOUS_AI_SUMMARY_PROMPT = `你是一位专业的文档摘要助手。请根据以下文档的标题、属性和正文内容，生成一段简洁的中文摘要。

要求：
1. 一段话概括，30 到 140 字之间
2. 提炼核心主题、关键结论或主要决策
3. 不要出现"本文"、"这篇文档"等指代词，直接陈述内容
4. 如果文档包含图片描述或代码片段，侧重总结其意图而非细节
5. 无论原文是什么语言，一律使用中文输出

文档标题：
{title}

文档属性：
{frontmatter}

文档正文：
{content}`;
const DEFAULT_AI_SUMMARY_PROMPT = `请为以下内容写一段摘要。

规则：
1. 30 到 140 字，一段话，不换行
2. 用中文写
3. 以内容本身的口吻概括，像是这段内容的开头导语
4. 直接陈述核心信息：做了什么、解决了什么、得出了什么结论
5. 禁止使用「本文」「该文档」「这篇笔记」「作者」等指代词
6. 禁止使用「介绍了」「阐述了」「描述了」「讨论了」「探讨了」这类元叙述动词
7. 如果内容是会议纪要，提炼关键决策和待办
8. 如果内容是技术方案，提炼目标、方案要点和核心约束
9. 如果内容很短或信息密度低，摘要可以短于 30 字，但不要注水

好的摘要示例：
- 「通过拆分首屏加载资源并引入骨架屏，将小月亮冷启动时间从 3.2s 降至 1.1s，同时修复了 iOS 端白屏闪烁问题。」
- 「确认 Q3 增长目标为 DAU 翻倍，主要路径为红包裂变 + 内容社区冷启动，预算上限 50 万。」
- 「梳理了 Owlen 推荐算法从协同过滤迁移到双塔模型的技术路径，重点解决冷启动场景下的召回率问题。」

差的摘要示例（禁止）：
- ✗「本文介绍了一种优化冷启动的方法...」（元叙述 + 指代词）
- ✗「该文档讨论了关于增长目标的相关内容...」（模糊 + 指代词）
- ✗「这是一篇关于推荐算法的技术文档...」（废话）

---
标题：{title}

属性：
{frontmatter}

正文：
{content}`;

const DEFAULT_SETTINGS: AutoFrontmatterSettings = {
	aiApiKey: "",
	aiApiUrl: "https://api.stepfun.com/step_plan/v1",
	aiModelName: "step-3.7-flash",
	aiSummaryEnabled: true,
	aiSummaryPrompt: DEFAULT_AI_SUMMARY_PROMPT,
	deviceBindings: [],
	emptyFieldHighlight: true,
	folderDefaults: [],
	showFolderCheckmark: false,
};

const AUTHOR_OPTIONS = [
	"陈晓琦",
	"董恒文",
	"刘一锋",
	"王亚军",
	"杨硕",
	"周正飞",
	"庄靖宇",
	"自定义",
] as const;
const CUSTOM_AUTHOR_MODE = "自定义";

const REQUIRED_FIELDS = ["项目", "类型", "作者", "摘要", "创建时间", "最后更新"] as const;
type RequiredField = (typeof REQUIRED_FIELDS)[number];
const HIGHLIGHT_FIELDS = ["项目", "类型", "作者", "创建时间", "最后更新"] as const;
type HighlightField = (typeof HIGHLIGHT_FIELDS)[number];
const FOLDER_DEFAULT_FIELDS = ["项目", "类型"] as const;
type FolderDefaultField = (typeof FOLDER_DEFAULT_FIELDS)[number];
type FolderDefaultValues = Partial<Record<FolderDefaultField, string>>;
const SETTING_TABS = ["通用", "文件夹规则", "AI摘要", "扫描仓库", "设备绑定", "版本更新"] as const;
type SettingTabId = (typeof SETTING_TABS)[number];
const GITHUB_REPO_API = "https://api.github.com/repos/liuyifeng92/obsidian-plugins/contents/auto-frontmatter";
type AISummaryTaskType = "completion";
const LEGACY_FIELD_RENAMES = {
	created: "创建时间",
	updated: "最后更新",
} as const;
type LegacyField = keyof typeof LEGACY_FIELD_RENAMES;

export default class AutoFrontmatterPlugin extends Plugin {
	settings: AutoFrontmatterSettings;
	currentDeviceUuid = "";
	settingTab: AutoFrontmatterSettingTab | null = null;
	private updateTimer: number | null = null;
	private updateFilePath: string | null = null;
	private createTimers = new Set<number>();
	private highlightTimer: number | null = null;
	private highlightInterval: number | null = null;
	private highlightFilePath: string | null = null;
	private folderCheckmarkTimer: number | null = null;
	private aiButtonTimer: number | null = null;
	private aiSummaryAbortController: AbortController | null = null;
	private aiSummaryCompletionRunning = false;
	private lastAISummaryScheduleSlot = "";

	async onload() {
		await this.loadSettings();

		this.settingTab = new AutoFrontmatterSettingTab(this.app, this);
		this.addSettingTab(this.settingTab);

		this.registerEvent(
			this.app.vault.on("create", (file) => {
				this.handleCreate(file);
			}),
		);

		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				this.handleRename(file, oldPath);
			}),
		);

		this.registerEvent(
			this.app.workspace.on("file-menu", (menu: Menu, file: TAbstractFile) => {
				this.handleFileMenu(menu, file);
			}),
		);

		this.registerEvent(
			this.app.workspace.on("editor-change", (_editor: Editor, view: MarkdownView) => {
				this.scheduleUpdatedFieldRefresh(view.file);
			}),
		);

		this.registerEvent(
			this.app.workspace.on("active-leaf-change", () => {
				this.scheduleEmptyFieldHighlightCheck();
				this.scheduleAISummaryButtonRefresh();
			}),
		);

		this.registerEvent(
			this.app.workspace.on("layout-change", () => {
				this.scheduleEmptyFieldHighlightCheck();
				this.scheduleAISummaryButtonRefresh();
				this.scheduleFolderCheckmarkRefresh();
			}),
		);

		this.registerInterval(window.setInterval(() => {
			this.checkAISummarySchedule();
		}, AI_SUMMARY_SCHEDULER_CHECK_MS));

		this.scheduleEmptyFieldHighlightCheck();
		this.scheduleAISummaryButtonRefresh();
		this.scheduleFolderCheckmarkRefresh();
	}

	onunload() {
		this.clearUpdateTimer();
		this.clearHighlightTimers();
		this.clearEmptyFieldHighlights();
		this.clearAISummaryButtonTimer();
		this.clearAISummaryButtons();
		this.abortAISummaryStream();
		this.clearFolderCheckmarkTimer();
		this.clearFolderCheckmarks();
		for (const timer of this.createTimers) {
			window.clearTimeout(timer);
		}
		this.createTimers.clear();
	}

	async loadSettings() {
		this.currentDeviceUuid = getDeviceUuid();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		this.migrateAuthorSettings();
		this.ensureCurrentDeviceBinding();
		this.migrateFolderDefaultRules();
		this.migrateAISummaryPrompt();
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.scheduleFolderCheckmarkRefresh();
	}

	refreshSettingsTab() {
		this.settingTab?.display();
	}

	refreshEmptyFieldHighlights() {
		this.scheduleEmptyFieldHighlightCheck();
	}

	refreshFolderCheckmarks() {
		this.applyFolderCheckmarks();
	}

	async generateSummaryForFile(file: TFile) {
		if (!this.settings.aiSummaryEnabled || !this.settings.aiApiKey.trim()) {
			return;
		}

		try {
			const content = await this.app.vault.read(file);
			const summaryDocument = getSummaryDocument(file, content, 1);
			if (!summaryDocument) {
				return;
			}

			const summary = await new AISummaryService(this.settings).generateSummary(summaryDocument);
			if (!summary) {
				return;
			}

			const next = writeSummaryToContent(
				content,
				file,
				summary,
				this.getFolderDefaultValues(file),
				this.buildFrontmatter.bind(this),
			);
			if (next !== null) {
				await this.app.vault.modify(file, next);
				this.triggerMetadataChanged(file);
			}
		} catch (error) {
			new Notice(`AI 摘要生成失败：${getErrorMessage(error)}`);
		}
	}

	async generateSummaryForMetadataButton(
		file: TFile,
		onDelta: (delta: string) => void,
		signal: AbortSignal,
	): Promise<string> {
		if (!this.settings.aiSummaryEnabled) {
			new Notice("请先开启 AI 自动摘要");
			return "";
		}
		if (!this.settings.aiApiKey.trim()) {
			new Notice("请先填写 AI 摘要 API Key");
			return "";
		}

		const content = await this.app.vault.read(file);
		const summaryDocument = getSummaryDocument(file, content, 1);
		if (!summaryDocument) {
			throw new Error("文档内容为空，无法生成摘要");
		}

		let summary = "";
		try {
			summary = await new AISummaryService(this.settings).generateSummary(summaryDocument);
		} catch (error) {
			if (signal.aborted) {
				return "";
			}
			throw error;
		}
		if (!summary) {
			throw new Error("AI 摘要返回为空");
		}

		const next = writeSummaryToContent(
			content,
			file,
			summary,
			this.getFolderDefaultValues(file),
			this.buildFrontmatter.bind(this),
		);
		if (next !== null) {
			await this.app.vault.modify(file, next);
		}
		return summary;
	}

	async scanAISummaryCandidates(task: AISummaryTaskType, showNotice: boolean): Promise<AISummaryCandidate[]> {
		const author = this.getAISummaryAuthorForTask(showNotice);
		if (!author) {
			return [];
		}

		return await this.getAISummaryCompletionCandidates(author);
	}

	async executeAISummaryQueue(
		task: AISummaryTaskType,
		candidates: AISummaryCandidate[],
		showNotice: boolean,
		onProgress?: () => void,
	): Promise<number> {
		if (this.isAISummaryTaskRunning(task)) {
			if (showNotice) {
				new Notice("AI 摘要正在执行中");
			}
			return 0;
		}

		if (!this.getAISummaryAuthorForTask(showNotice)) {
			return 0;
		}

		return await this.processAISummaryQueue(task, candidates, showNotice, onProgress);
	}

	isAISummaryTaskRunning(task: AISummaryTaskType): boolean {
		return this.aiSummaryCompletionRunning;
	}

	private checkAISummarySchedule() {
		const now = new Date();
		const minute = now.getMinutes();
		if (minute !== 0 && minute !== 30) {
			return;
		}

		const slot = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${minute}`;
		if (slot === this.lastAISummaryScheduleSlot) {
			return;
		}

		this.lastAISummaryScheduleSlot = slot;
		void this.runScheduledAISummaryTasks();
	}

	private async runScheduledAISummaryTasks() {
		await this.runScheduledAISummaryTask("completion");
	}

	private async runScheduledAISummaryTask(task: AISummaryTaskType) {
		if (this.isAISummaryTaskRunning(task)) {
			return;
		}

		const candidates = await this.scanAISummaryCandidates(task, false);
		if (candidates.length === 0) {
			return;
		}

		await this.processAISummaryQueue(task, candidates, false);
	}

	private getAISummaryAuthorForTask(showNotice: boolean): string {
		if (!this.settings.aiSummaryEnabled) {
			if (showNotice) {
				new Notice("请先开启 AI 自动摘要");
			}
			return "";
		}
		if (!this.settings.aiApiKey.trim()) {
			if (showNotice) {
				new Notice("请先填写 AI 摘要 API Key");
			}
			return "";
		}

		const author = this.getCurrentAuthorName();
		if (!author) {
			if (showNotice) {
				new Notice("请先在「设备绑定」中绑定本机设备");
			}
			return "";
		}

		return author;
	}

	private async processAISummaryQueue(
		task: AISummaryTaskType,
		candidates: AISummaryCandidate[],
		showNotice: boolean,
		onProgress?: () => void,
	): Promise<number> {
		this.setAISummaryTaskRunning(task, true);
		let processedCount = 0;
		let consecutiveFailures = 0;

		try {
			const service = new AISummaryService(this.settings);
			for (let index = 0; index < candidates.length; index++) {
				const candidate = candidates[index];
				try {
					const summary = await service.generateSummary(candidate.document);
					if (!summary) {
						if (index < candidates.length - 1) {
							await delay(AI_SUMMARY_REQUEST_DELAY_MS);
						}
						continue;
					}

					const next = writeSummaryToContent(
						candidate.content,
						candidate.file,
						summary,
						this.getFolderDefaultValues(candidate.file),
						this.buildFrontmatter.bind(this),
					);
					if (next !== null) {
						await this.app.vault.modify(candidate.file, next);
						this.triggerMetadataChanged(candidate.file);
						processedCount++;
						candidate.done = true;
						onProgress?.();
					}
					consecutiveFailures = 0;
				} catch (_error) {
					consecutiveFailures++;
					if (consecutiveFailures >= 3) {
						new Notice("AI 摘要服务异常，已暂停本次任务");
						return processedCount;
					}
				}

				if (index < candidates.length - 1) {
					await delay(AI_SUMMARY_REQUEST_DELAY_MS);
				}
			}

			if (showNotice) {
				new Notice(
					processedCount > 0
						? `AI 摘要：本次处理 ${processedCount} 篇文档`
						: "AI 摘要：暂无需要处理的文档",
				);
			}

			return processedCount;
		} finally {
			this.setAISummaryTaskRunning(task, false);
		}
	}

	private setAISummaryTaskRunning(task: AISummaryTaskType, isRunning: boolean) {
		this.aiSummaryCompletionRunning = isRunning;
	}

	private async getAISummaryCompletionCandidates(author: string): Promise<AISummaryCandidate[]> {
		const candidates: AISummaryCandidate[] = [];
		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
			if (!frontmatterAuthorContains(frontmatter["作者"], author) || !isEmptyFrontmatterValue(frontmatter["摘要"])) {
				continue;
			}

			const content = await this.app.vault.cachedRead(file);
			const document = getSummaryDocument(file, content, MIN_SUMMARY_BODY_LENGTH);
			if (!document) {
				continue;
			}

			candidates.push({ file, content, document });
		}

		return candidates;
	}

	private triggerMetadataChanged(file: TFile) {
		(this.app.metadataCache as { trigger: (name: string, file: TFile) => void }).trigger("changed", file);
	}

	getAuthorName(): string {
		return this.settings.deviceBindings.find((binding) => binding.uuid === this.currentDeviceUuid)?.author ?? "";
	}

	ensureDeviceBound(): boolean {
		if (this.getCurrentAuthorName()) {
			return true;
		}

		new Notice("请先在「设备绑定」中绑定本机设备");
		return false;
	}

	getCurrentAuthorName(): string {
		return this.settings.deviceBindings.find((binding) => {
			return binding.uuid === this.currentDeviceUuid && binding.author;
		})?.author ?? "";
	}

	buildFrontmatter(created: string, defaults: FolderDefaultValues = {}): string {
		return [
			"---",
			`项目: ${defaults["项目"] ?? ""}`,
			"类型:",
			`  - ${formatYamlScalar(defaults["类型"] ?? "")}`,
			"作者:",
			`  - ${formatYamlScalar(this.getAuthorName())}`,
			"摘要: ",
			`创建时间: ${created}`,
			`最后更新: ${created}`,
			"---",
			"",
		].join("\n");
	}

	private handleCreate(file: TAbstractFile) {
		if (!(file instanceof TFile) || file.extension !== "md") {
			return;
		}

		const timer = window.setTimeout(async () => {
			this.createTimers.delete(timer);

			const content = await this.app.vault.read(file);
			if (content.trim().length > 0 || hasFrontmatter(content)) {
				return;
			}

			const created = formatLocalDate(new Date(file.stat.ctime));
			await this.app.vault.modify(file, this.buildFrontmatter(created, this.getFolderDefaultValues(file)));
		}, 250);

		this.createTimers.add(timer);
	}

	private async handleRename(file: TAbstractFile, oldPath: string) {
		if (!(file instanceof TFile) || file.extension !== "md") {
			return;
		}

		if (getFileFolder(file.path) === getFileFolder(oldPath)) {
			return;
		}

		const defaults = this.getFolderDefaultValues(file);
		if (Object.keys(defaults).length === 0) {
			return;
		}

		await this.app.vault.process(file, (content) => {
			const next = fillEmptyFolderDefaults(content, defaults);
			return next ?? content;
		});
	}

	private handleFileMenu(menu: Menu, file: TAbstractFile) {
		if (!(file instanceof TFolder)) {
			return;
		}

		menu.addItem((item) => {
			item.setTitle("设置属性匹配规则").onClick(() => {
				new FolderRuleModal(this.app, this, file.path).open();
			});
		});
	}

	getFolderDefaultValues(file: TFile): FolderDefaultValues {
		const values: FolderDefaultValues = {};
		const depths: Partial<Record<FolderDefaultField, number>> = {};
		const fileFolder = getFileFolder(file.path);

		for (const rule of this.settings.folderDefaults) {
			if (!rule.value || !folderMatches(fileFolder, rule.folder)) {
				continue;
			}

			const depth = getFolderDepth(rule.folder);
			if (depth >= (depths[rule.field] ?? -1)) {
				values[rule.field] = rule.value;
				depths[rule.field] = depth;
			}
		}

		return values;
	}

	createFolderRule(folder = "", field: FolderDefaultField = "项目", value = ""): FolderDefaultRule {
		const now = formatLocalDate(new Date());
		const author = this.getCurrentAuthorName();
		return {
			folder,
			field,
			value,
			createdBy: author,
			createdAt: now,
			modifiedBy: author,
			modifiedAt: now,
		};
	}

	touchFolderRule(rule: FolderDefaultRule) {
		rule.modifiedBy = this.getCurrentAuthorName();
		rule.modifiedAt = formatLocalDate(new Date());
	}

	async upsertFolderRule(folder: string, field: FolderDefaultField, value: string) {
		const existing = this.settings.folderDefaults.find((rule) => {
			return rule.folder === folder && rule.field === field;
		});

		if (existing) {
			existing.value = value;
			this.touchFolderRule(existing);
		} else {
			this.settings.folderDefaults.push(this.createFolderRule(folder, field, value));
		}

		await this.saveSettings();
	}

	private migrateAuthorSettings() {
		if (this.settings.deviceBindings.length > 0) {
			return;
		}

		const author = getLegacyAuthorName(this.settings);
		if (author) {
			this.settings.deviceBindings.push({
				uuid: this.currentDeviceUuid,
				author,
			});
		}
	}

	private ensureCurrentDeviceBinding() {
		if (this.settings.deviceBindings.length > 0) {
			return;
		}

		this.settings.deviceBindings.push({
			uuid: this.currentDeviceUuid,
			author: "",
		});
	}

	private migrateFolderDefaultRules() {
		const rules: FolderDefaultRule[] = [];
		for (const rule of this.settings.folderDefaults) {
			if (rule.fields) {
				for (const fieldSetting of rule.fields) {
					rules.push({
						folder: rule.folder,
						field: fieldSetting.field,
						value: fieldSetting.value,
						createdBy: rule.createdBy,
						createdAt: rule.createdAt,
						modifiedBy: rule.modifiedBy,
						modifiedAt: rule.modifiedAt,
					});
				}
			} else {
				rules.push(rule);
			}
		}
		this.settings.folderDefaults = rules;
	}

	private migrateAISummaryPrompt() {
		if (
			this.settings.aiSummaryPrompt === OLD_AI_SUMMARY_PROMPT ||
			this.settings.aiSummaryPrompt === PREVIOUS_AI_SUMMARY_PROMPT
		) {
			this.settings.aiSummaryPrompt = DEFAULT_AI_SUMMARY_PROMPT;
		}
	}

	async checkForUpdate(): Promise<{ hasUpdate: boolean; version: string; error?: string }> {
		try {
			const response = await fetch(`${GITHUB_REPO_API}/manifest.json`, {
				headers: {
					Accept: "application/vnd.github.v3.raw",
				},
			});

			if (response.status === 404) {
				return { hasUpdate: false, version: "", error: "not_found" };
			}
			if (!response.ok) {
				return { hasUpdate: false, version: "", error: `请求失败：${response.status}` };
			}

			const remoteManifest = await response.json() as { version?: string };
			const remoteVersion = remoteManifest.version ?? "";
			if (!remoteVersion) {
				return { hasUpdate: false, version: "", error: "远端版本号无效" };
			}

			const currentVersion = this.manifest.version;
			const hasUpdate = this.compareVersions(remoteVersion, currentVersion) > 0;
			return { hasUpdate, version: remoteVersion };
		} catch (error) {
			return { hasUpdate: false, version: "", error: getErrorMessage(error) };
		}
	}

	async performUpdate(version: string, onProgress?: (step: number, total: number) => void): Promise<void> {
		const files = ["main.js", "manifest.json", "styles.css"] as const;
		const contents: Record<string, string> = {};

		for (let index = 0; index < files.length; index++) {
			const file = files[index];
			const response = await fetch(`${GITHUB_REPO_API}/${file}`, {
				headers: {
					Accept: "application/vnd.github.v3.raw",
				},
			});
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

		const pluginId = this.manifest.id;
		const app = this.app;
		new Notice(`更新完成（${version}），正在重载插件...`);

		window.setTimeout(async () => {
			try {
				// unloadPlugin 会卸载并释放旧 JS
				// loadPlugin 会重新从磁盘读取 main.js
				// @ts-ignore — 内部 API
				await app.plugins.unloadPlugin(pluginId);
				await new Promise((resolve) => window.setTimeout(resolve, 500));
				// @ts-ignore — 内部 API
				await app.plugins.loadPlugin(pluginId);
				// loadPlugin 只加载不启用，需要再 enable
				// @ts-ignore — 内部 API
				await app.plugins.enablePlugin(pluginId);
				await new Promise((resolve) => window.setTimeout(resolve, 500));
				// @ts-ignore — 内部 API
				app.setting.open();
				// @ts-ignore — 内部 API
				app.setting.openTabById(pluginId);
			} catch (e) {
				new Notice("自动重载失败，请点击已安装插件页的「重新加载插件」按钮");
			}
		}, 100);
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

	private scheduleUpdatedFieldRefresh(file: TFile | null) {
		this.clearUpdateTimer();

		if (!file || file.extension !== "md") {
			return;
		}

		this.updateFilePath = file.path;
		this.updateTimer = window.setTimeout(() => {
			const activeFile = this.app.workspace.getActiveFile();
			if (!activeFile || activeFile.path !== this.updateFilePath) {
				this.clearUpdateTimer();
				return;
			}

			const path = this.updateFilePath;
			this.clearUpdateTimer();
			this.refreshUpdatedField(path);
		}, 5000);
	}

	private clearUpdateTimer() {
		if (this.updateTimer !== null) {
			window.clearTimeout(this.updateTimer);
			this.updateTimer = null;
		}
		this.updateFilePath = null;
	}

	private async refreshUpdatedField(path: string) {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) {
			return;
		}

		await this.app.vault.process(file, (content) => {
			const next = updateFrontmatterUpdated(content, formatLocalDate(new Date()));
			return next ?? content;
		});
	}

	private scheduleEmptyFieldHighlightCheck() {
		if (this.highlightTimer !== null) {
			window.clearTimeout(this.highlightTimer);
			this.highlightTimer = null;
		}

		const activeFile = this.app.workspace.getActiveFile();
		const activePath = activeFile?.path ?? null;
		if (this.highlightFilePath !== activePath) {
			this.clearEmptyFieldHighlights();
			this.clearHighlightInterval();
			this.highlightFilePath = activePath;
		}

		if (
			!this.settings.emptyFieldHighlight ||
			!activeFile ||
			activeFile.extension !== "md"
		) {
			this.clearHighlightInterval();
			this.clearEmptyFieldHighlights();
			return;
		}

		this.highlightTimer = window.setTimeout(() => {
			this.highlightTimer = null;
			this.applyEmptyFieldHighlights();
			this.ensureHighlightInterval();
		}, 300);
	}

	private scheduleFolderCheckmarkRefresh() {
		this.clearFolderCheckmarkTimer();
		this.folderCheckmarkTimer = window.setTimeout(() => {
			this.folderCheckmarkTimer = null;
			this.applyFolderCheckmarks();
		}, 0);
	}

	private clearFolderCheckmarkTimer() {
		if (this.folderCheckmarkTimer !== null) {
			window.clearTimeout(this.folderCheckmarkTimer);
			this.folderCheckmarkTimer = null;
		}
	}

	private applyFolderCheckmarks() {
		this.clearFolderCheckmarks();
		if (!this.settings.showFolderCheckmark) {
			return;
		}

		const ruleFolders = new Set(
			this.settings.folderDefaults
				.map((rule) => rule.folder)
				.filter((folder) => folder.length > 0),
		);
		if (ruleFolders.size === 0) {
			return;
		}

		const folderTitles = document.querySelectorAll<HTMLElement>(".nav-folder-title");
		for (const titleEl of Array.from(folderTitles)) {
			const folderPath =
				titleEl.getAttribute("data-path") ??
				titleEl.closest(".nav-folder")?.getAttribute("data-path") ??
				"";
			if (!ruleFolders.has(folderPath)) {
				continue;
			}

			titleEl.createSpan({
				cls: "frontmatter-folder-check",
				text: "✓",
			});
		}
	}

	private clearFolderCheckmarks() {
		document.querySelectorAll(".frontmatter-folder-check").forEach((el) => {
			el.remove();
		});
	}

	private ensureHighlightInterval() {
		if (this.highlightInterval !== null) {
			return;
		}

		this.highlightInterval = window.setInterval(() => {
			this.applyEmptyFieldHighlights();
		}, 2000);
	}

	private clearHighlightTimers() {
		if (this.highlightTimer !== null) {
			window.clearTimeout(this.highlightTimer);
			this.highlightTimer = null;
		}
		this.clearHighlightInterval();
	}

	private clearHighlightInterval() {
		if (this.highlightInterval !== null) {
			window.clearInterval(this.highlightInterval);
			this.highlightInterval = null;
		}
	}

	private applyEmptyFieldHighlights() {
		const activeFile = this.app.workspace.getActiveFile();
		if (
			!this.settings.emptyFieldHighlight ||
			!activeFile ||
			activeFile.extension !== "md"
		) {
			this.clearHighlightInterval();
			this.clearEmptyFieldHighlights();
			return;
		}

		const frontmatter = this.app.metadataCache.getFileCache(activeFile)?.frontmatter ?? {};
		const emptyFields = new Set(
			HIGHLIGHT_FIELDS.filter((field) => isEmptyFrontmatterValue(frontmatter[field])),
		);
		this.updateEmptyFieldHighlights(emptyFields);
	}

	private updateEmptyFieldHighlights(emptyFields: Set<HighlightField>) {
		const containers = document.querySelectorAll<HTMLElement>(".metadata-container");
		for (const container of Array.from(containers)) {
			Array.from(container.querySelectorAll(".frontmatter-empty-highlight")).forEach((el) => {
				removeEmptyHighlightClasses(el);
			});

			const emptyRows = Array.from(emptyFields)
				.map((field) => findMetadataRow(container, field))
				.filter((row): row is HTMLElement => row !== null)
				.sort((a, b) => getDocumentOrder(a, b));

			for (let index = 0; index < emptyRows.length; index++) {
				emptyRows[index].classList.add(
					"frontmatter-empty-highlight",
					`frontmatter-empty-${(index % HIGHLIGHT_FIELDS.length) + 1}`,
				);
			}
		}
	}

	private clearEmptyFieldHighlights() {
		document.querySelectorAll(".frontmatter-empty-highlight").forEach((el) => {
			removeEmptyHighlightClasses(el);
		});
	}

	private scheduleAISummaryButtonRefresh() {
		this.clearAISummaryButtonTimer();
		this.abortAISummaryStream();
		this.aiButtonTimer = window.setTimeout(() => {
			this.aiButtonTimer = null;
			this.addAISummaryButton();
		}, 300);
	}

	private scheduleDelayedAISummaryButtonRefresh() {
		this.clearAISummaryButtonTimer();
		this.aiButtonTimer = window.setTimeout(() => {
			this.aiButtonTimer = null;
			this.addAISummaryButton();
		}, 1000);
	}

	private clearAISummaryButtonTimer() {
		if (this.aiButtonTimer !== null) {
			window.clearTimeout(this.aiButtonTimer);
			this.aiButtonTimer = null;
		}
	}

	private clearAISummaryButtons() {
		document.querySelectorAll(".frontmatter-ai-summary-btn, .frontmatter-ai-summary-confirm").forEach((el) => {
			el.remove();
		});
		document.querySelectorAll(".frontmatter-ai-summary-row").forEach((el) => {
			const row = el as HTMLElement & {
				frontmatterAiFocusHandler?: EventListener;
				frontmatterAiBlurHandler?: EventListener;
			};
			const valueEl = findMetadataValueContainer(row);
			if (valueEl && row.frontmatterAiFocusHandler) {
				valueEl.removeEventListener("focusin", row.frontmatterAiFocusHandler);
			}
			if (valueEl && row.frontmatterAiBlurHandler) {
				valueEl.removeEventListener("focusout", row.frontmatterAiBlurHandler);
			}
			delete row.frontmatterAiFocusHandler;
			delete row.frontmatterAiBlurHandler;
		});
		document.querySelectorAll(".frontmatter-ai-summary-row").forEach((el) => {
			el.classList.remove("frontmatter-ai-summary-row");
		});
		document.querySelectorAll(".frontmatter-ai-summary-loading").forEach((el) => {
			el.classList.remove("frontmatter-ai-summary-loading");
		});
	}

	private abortAISummaryStream() {
		this.aiSummaryAbortController?.abort();
		this.aiSummaryAbortController = null;
	}

	private addAISummaryButton() {
		this.applyAISummaryButtons();
	}

	private applyAISummaryButtons() {
		this.clearAISummaryButtons();
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile || activeFile.extension !== "md") {
			return;
		}

		const containers = document.querySelectorAll<HTMLElement>(".metadata-container");
		for (const container of Array.from(containers)) {
			const row = findMetadataRow(container, "摘要");
			if (
				!row ||
				!row.isConnected ||
				!document.contains(row) ||
				row.querySelector(".frontmatter-ai-summary-btn, .frontmatter-ai-summary-confirm")
			) {
				continue;
			}

			console.log("[AI摘要] 摘要行 DOM:", row.outerHTML);
			row.addClass("frontmatter-ai-summary-row");
			const valueEl = findMetadataValueContainer(row);
			const summary = normalizeFrontmatterScalar(
				this.app.metadataCache.getFileCache(activeFile)?.frontmatter?.["摘要"],
			);
			if (!summary) {
				this.showAISummaryButton(row, activeFile, "full");
			} else if (valueEl) {
				const rowWithHandlers = row as HTMLElement & {
					frontmatterAiFocusHandler?: EventListener;
					frontmatterAiBlurHandler?: EventListener;
				};
				let hideTimer: number | null = null;
				rowWithHandlers.frontmatterAiFocusHandler = () => {
					if (hideTimer !== null) {
						window.clearTimeout(hideTimer);
						hideTimer = null;
					}
					this.showAISummaryButton(row, activeFile, "icon");
				};
				rowWithHandlers.frontmatterAiBlurHandler = () => {
					if (hideTimer !== null) {
						window.clearTimeout(hideTimer);
					}
					hideTimer = window.setTimeout(() => {
						if (!row.querySelector(".frontmatter-ai-summary-confirm")) {
							this.hideAISummaryButton(row);
						}
					}, 200);
				};
				valueEl.addEventListener("focusin", rowWithHandlers.frontmatterAiFocusHandler);
				valueEl.addEventListener("focusout", rowWithHandlers.frontmatterAiBlurHandler);
			}
		}
	}

	private showAISummaryButton(row: HTMLElement, file: TFile, variant: "full" | "icon") {
		if (row.querySelector(".frontmatter-ai-summary-btn, .frontmatter-ai-summary-confirm")) {
			return;
		}

		const button = row.createEl("button", {
			cls: `frontmatter-ai-summary-btn is-${variant}`,
			attr: { "aria-label": "AI 生成摘要" },
		});
		setIcon(button, "sparkles");
		if (variant === "full") {
			button.createSpan({ text: "AI摘要" });
		}
		button.onclick = (event) => {
			event.preventDefault();
			event.stopPropagation();
			this.showAISummaryConfirm(row, file, button);
		};
	}

	private hideAISummaryButton(row: HTMLElement) {
		row.querySelector(".frontmatter-ai-summary-btn")?.remove();
	}

	private showAISummaryConfirm(row: HTMLElement, file: TFile, button: HTMLElement) {
		button.remove();
		row.querySelector(".frontmatter-ai-summary-confirm")?.remove();
		const oldSummary = normalizeFrontmatterScalar(
			this.app.metadataCache.getFileCache(file)?.frontmatter?.["摘要"],
		);
		const confirmEl = row.createSpan({ cls: "frontmatter-ai-summary-confirm" });
		confirmEl.createSpan({
			cls: "frontmatter-ai-summary-confirm-text",
			text: oldSummary ? "✨ AI 更新？" : "✨ AI 生成？",
		});
		const acceptButton = confirmEl.createEl("button", { cls: "frontmatter-ai-summary-confirm-icon" });
		setIcon(acceptButton, "check");
		const cancelButton = confirmEl.createEl("button", { cls: "frontmatter-ai-summary-confirm-icon" });
		setIcon(cancelButton, "x");

		cancelButton.onclick = (event) => {
			event.preventDefault();
			event.stopPropagation();
			confirmEl.remove();
			this.applyAISummaryButtons();
		};
		acceptButton.onclick = (event) => {
			event.preventDefault();
			event.stopPropagation();
			void this.runMetadataAISummary(file, row, confirmEl);
		};
	}

	private async runMetadataAISummary(file: TFile, row: HTMLElement, confirmEl: HTMLElement) {
		const valueEl = findMetadataValueContainer(row) ?? row;
		const originalValue = valueEl.textContent ?? "";
		confirmEl.remove();
		this.abortAISummaryStream();
		const controller = new AbortController();
		this.aiSummaryAbortController = controller;
		let streamedText = "";
		let finalText = originalValue;
		let didSucceed = false;
		let fallbackDotsTimer: number | null = window.setInterval(() => {
			if (streamedText) {
				return;
			}
			valueEl.textContent = valueEl.textContent === "···" ? "·" : `${valueEl.textContent}·`;
		}, 350);
		valueEl.empty();
		valueEl.addClass("frontmatter-ai-summary-loading");
		valueEl.setText("|");

		try {
			const summary = await this.generateSummaryForMetadataButton(file, (delta) => {
				if (!delta) {
					return;
				}
				streamedText += delta;
				valueEl.setText(`${streamedText}|`);
				}, controller.signal);
				if (fallbackDotsTimer !== null) {
					window.clearInterval(fallbackDotsTimer);
					fallbackDotsTimer = null;
				}
				finalText = summary || streamedText;
				didSucceed = Boolean(finalText);
			} catch (error) {
				if (!controller.signal.aborted) {
					new Notice(`AI 摘要生成失败：${getErrorMessage(error)}`);
				}
			} finally {
					try {
						if (fallbackDotsTimer !== null) {
							window.clearInterval(fallbackDotsTimer);
						}
						if (this.aiSummaryAbortController === controller) {
							this.aiSummaryAbortController = null;
						}
						if (didSucceed) {
							new Notice("AI 摘要生成成功");
							this.scheduleDelayedAISummaryButtonRefresh();
							return;
						}

						valueEl.removeClass("frontmatter-ai-summary-loading");
						valueEl.setText(originalValue);
						this.scheduleAISummaryButtonRefresh();
					} catch (cleanupError) {
						console.error("[auto-frontmatter] AI summary cleanup failed", cleanupError);
					}
			}
		}
	}

class FolderRuleModal extends Modal {
	private field: FolderDefaultField | "" = "";
	private value = "";
	private isCustomValue = false;
	private customValueInputEl: HTMLInputElement | null = null;
	private customValueBlurHandler: ((event: FocusEvent) => void) | null = null;
	private customValueKeydownHandler: ((event: KeyboardEvent) => void) | null = null;
	private submitButtonEl: HTMLButtonElement | null = null;

	constructor(
		app: App,
		private plugin: AutoFrontmatterPlugin,
		private folder: string,
	) {
		super(app);
		this.field = this.getInitialField();
		this.value = this.findExistingValue(this.field);
	}

	onOpen() {
		this.render();
	}

	onClose() {
		this.cleanupCustomValueInput();
		this.submitButtonEl = null;
		this.contentEl.empty();
	}

	private render() {
		const { contentEl } = this;
		this.cleanupCustomValueInput();
		contentEl.empty();
		contentEl.createEl("h2", { text: "设置属性匹配规则" });
		const inheritedRules = getAncestorRules(this.folder, this.plugin.settings.folderDefaults);
		for (const rule of inheritedRules) {
			contentEl.createDiv({
				cls: "auto-frontmatter-modal-inherited-rule",
				text: `↑ 继承自 ${rule.folder} → ${rule.field}: ${rule.value}`,
			});
		}

		new Setting(contentEl)
			.setName("文件夹")
			.setDesc(this.folder || "/");

		new Setting(contentEl)
			.setName("字段")
			.addDropdown((dropdown) => {
				dropdown.addOption("", "未配置");
				for (const field of FOLDER_DEFAULT_FIELDS) {
					dropdown.addOption(field, field);
				}

				dropdown.setValue(this.field).onChange((value) => {
					this.field = value as FolderDefaultField | "";
					this.value = this.findExistingValue(this.field);
					this.isCustomValue = false;
					this.updateSubmitState();
					this.render();
				});
				toggleModalSelectPlaceholder(dropdown.selectEl, !this.field);
			});

		const candidates = this.field ? getFrontmatterFieldCandidates(this.app, this.field) : [];
		const values = this.value && !candidates.includes(this.value) ? [...candidates, this.value] : candidates;
		const valueSetting = new Setting(contentEl).setName("填写");
		valueSetting.controlEl.addClass("auto-frontmatter-modal-value-control");
		valueSetting.controlEl.empty();
		const selectEl = valueSetting.controlEl.createEl("select", {
			cls: "dropdown auto-frontmatter-modal-custom-select",
		});
		selectEl.createEl("option", {
			value: "",
			text: "未配置",
		});
		for (const value of values) {
			selectEl.createEl("option", {
				value,
				text: value,
			});
		}
		selectEl.createEl("option", {
			value: "__new__",
			text: "自定义",
		});
		selectEl.disabled = !this.field;
		selectEl.value = this.isCustomValue ? "__new__" : this.value || "";
		toggleModalSelectPlaceholder(selectEl, !selectEl.value);
		selectEl.addEventListener("change", () => {
			toggleModalSelectPlaceholder(selectEl, !selectEl.value);
			if (!selectEl.value) {
				this.isCustomValue = false;
				this.value = "";
				this.updateSubmitState();
				this.render();
				return;
			}
			if (selectEl.value === "__new__") {
				this.isCustomValue = true;
			} else {
				this.isCustomValue = false;
				this.value = selectEl.value;
			}
			this.updateSubmitState();
			this.render();
		});

		if (this.isCustomValue) {
			const inputEl = valueSetting.controlEl.createEl("input", {
				cls: "auto-frontmatter-modal-custom-input",
				type: "text",
				value: this.value,
			});
			inputEl.placeholder = "填入信息";
			inputEl.addEventListener("input", () => {
				this.value = inputEl.value;
				this.updateSubmitState();
			});
			inputEl.addEventListener("change", () => {
				this.value = inputEl.value;
				this.updateSubmitState();
			});

			this.customValueInputEl = inputEl;
			this.customValueBlurHandler = () => {
				this.value = inputEl.value;
				this.updateSubmitState();
			};
			this.customValueKeydownHandler = (event) => {
				if (event.key === "Enter") {
					event.preventDefault();
					this.value = inputEl.value;
					this.updateSubmitState();
					inputEl.blur();
				}
			};
			inputEl.addEventListener("blur", this.customValueBlurHandler);
			inputEl.addEventListener("keydown", this.customValueKeydownHandler);
			window.setTimeout(() => inputEl.focus(), 0);
		}

		const actionsEl = contentEl.createDiv({ cls: "auto-frontmatter-modal-actions" });
		new Setting(actionsEl)
			.addButton((button) => {
				button.setButtonText("取消").onClick(() => {
					this.close();
				});
			})
			.addButton((button) => {
				this.submitButtonEl = button.buttonEl;
				button
					.setButtonText("提交")
					.setCta()
					.onClick(async () => {
					if (!this.plugin.ensureDeviceBound()) {
						return;
					}

					await this.plugin.upsertFolderRule(this.folder, this.field as FolderDefaultField, this.value);
					this.plugin.refreshSettingsTab();
					new Notice(`规则已保存（${this.plugin.getCurrentAuthorName()}）`);
					this.close();
				});
			});
		this.updateSubmitState();
	}

	private findExistingValue(field: FolderDefaultField | ""): string {
		if (!field) {
			return "";
		}
		return this.plugin.settings.folderDefaults.find((rule) => {
			return rule.folder === this.folder && rule.field === field;
		})?.value ?? "";
	}

	private getInitialField(): FolderDefaultField {
		const ownFields = new Set(
			this.plugin.settings.folderDefaults
				.filter((rule) => rule.folder === this.folder)
				.map((rule) => rule.field),
		);
		const inheritedFields = new Set(
			getAncestorRules(this.folder, this.plugin.settings.folderDefaults).map((rule) => rule.field),
		);

		if (ownFields.has("项目") && !ownFields.has("类型")) {
			return "类型";
		}
		if (ownFields.has("类型") && !ownFields.has("项目")) {
			return "项目";
		}
		if (inheritedFields.has("项目") && !inheritedFields.has("类型")) {
			return "类型";
		}
		return "项目";
	}

	private cleanupCustomValueInput() {
		if (this.customValueInputEl && this.customValueBlurHandler) {
			this.customValueInputEl.removeEventListener("blur", this.customValueBlurHandler);
		}
		if (this.customValueInputEl && this.customValueKeydownHandler) {
			this.customValueInputEl.removeEventListener("keydown", this.customValueKeydownHandler);
		}
		this.customValueInputEl = null;
		this.customValueBlurHandler = null;
		this.customValueKeydownHandler = null;
	}

	private updateSubmitState() {
		if (!this.submitButtonEl) {
			return;
		}

		const hasField = Boolean(this.field);
		const hasValue = this.isCustomValue
			? (this.customValueInputEl?.value ?? this.value).trim().length > 0
			: this.value.trim().length > 0;

		this.submitButtonEl.disabled = !(hasField && hasValue);
	}
}

class AISummaryService implements SummaryService {
	constructor(private settings: AutoFrontmatterSettings) {}

	async generateSummary(document: SummaryDocument): Promise<string> {
		return await this.callAI(this.buildPrompt(document));
	}

	async callAI(promptContent: string): Promise<string> {
		const apiKey = this.settings.aiApiKey.trim();
		if (!apiKey) {
			throw new Error("API Key 为空");
		}

		const apiUrl = this.settings.aiApiUrl.replace(/\/+$/, "");
		const url = `${apiUrl}/chat/completions`;

		console.log("[AI摘要] 请求 URL:", url);
		console.log("[AI摘要] 模型:", this.settings.aiModelName);

		const body = {
			model: this.settings.aiModelName,
			messages: [
				{
					role: "system",
					content: "直接输出摘要，不要有任何其他内容。",
				},
				{ role: "user", content: promptContent },
			],
			reasoning_effort: "low",
			reasoning_format: "deepseek-style",
			max_tokens: 1024,
		};

		console.log("[AI摘要] 请求 body:", JSON.stringify(body, null, 2).substring(0, 500));

		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Authorization": `Bearer ${apiKey}`,
			},
			body: JSON.stringify(body),
		});

		console.log("[AI摘要] 响应 status:", response.status, response.statusText);

		if (!response.ok) {
			const errorText = await response.text();
			console.log("[AI摘要] 错误响应:", errorText.substring(0, 500));
			throw new Error(`API 请求失败 (${response.status}): ${errorText.substring(0, 200)}`);
		}

		const data = await response.json() as ChatCompletionResponse;
		console.log("[AI摘要] 完整响应:", JSON.stringify(data, null, 2));

		if (data.error) {
			throw new Error(data.error.message || JSON.stringify(data.error));
		}

		const message = data.choices?.[0]?.message;
		if (!message) {
			throw new Error("响应中无 choices[0].message，完整响应已打印到控制台");
		}

			console.log("[AI摘要] message.content:", JSON.stringify(message.content));
			console.log("[AI摘要] message.reasoning_content:", JSON.stringify(message.reasoning_content)?.substring(0, 200));
			console.log("[AI摘要] message.reasoning:", JSON.stringify(message.reasoning)?.substring(0, 200));

		let summary = message.content?.trim();
		if (!summary) {
			throw new Error("模型未生成摘要（content 为空），请打开开发者工具查看完整响应");
		}

		summary = summary
			.replace(/^[\"「」"']+|[\"「」"']+$/g, "")
			.replace(/^(摘要[:：]\s*)/i, "")
			.trim();

		if (!summary) {
			throw new Error("AI 摘要返回为空");
		}

		return summary;
	}

	private buildPrompt(document: SummaryDocument): string {
		return replacePromptToken(
			replacePromptToken(
				replacePromptToken(this.settings.aiSummaryPrompt, "{title}", document.title),
				"{frontmatter}",
				document.frontmatter,
			),
			"{content}",
			document.content,
		);
	}
}

class AutoFrontmatterSettingTab extends PluginSettingTab {
	plugin: AutoFrontmatterPlugin;
	private activeTab: SettingTabId = "通用";
	private bindingCurrentDevice = false;
	private bindingCurrentDeviceCustom = false;
	private scanResults: ScanResult[] = [];
	private hasScanned = false;
	private isScanning = false;
	private isExecuting = false;
	private processedCount = 0;
	private unmatchedFolders: UnmatchedFolderResult[] = [];
	private hasScannedUnmatchedFolders = false;
	private isScanningUnmatchedFolders = false;
	private activeInlineEditorCleanup: (() => void) | null = null;
	private aiApiKeyVisible = false;
	private aiSummaryCompletionResults: AISummaryCandidate[] = [];
	private hasScannedAISummaryCompletion = false;
	private isScanningAISummaryCompletion = false;
	private isExecutingAISummaryCompletion = false;
	private processedAISummaryCompletionCount = 0;
	private currentRulePage = 0;
	private isCheckingUpdate = false;
	private isUpdating = false;
	private updateProgress = 0;
	private updateResultMessage = "";
	private latestVersion = "";

	constructor(app: App, plugin: AutoFrontmatterPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		this.closeActiveInlineEditor();
		containerEl.empty();

		this.renderTabs(containerEl);
		const contentEl = containerEl.createDiv({
			cls: "auto-frontmatter-tab-content",
			attr: { "data-auto-frontmatter-active-tab": this.activeTab },
		});
		if (this.activeTab === "通用") {
			this.renderGeneralSettings(contentEl);
		} else if (this.activeTab === "文件夹规则") {
			this.renderFolderDefaultRules(contentEl);
		} else if (this.activeTab === "扫描仓库") {
			this.renderScanSection(contentEl);
		} else if (this.activeTab === "设备绑定") {
			this.renderDeviceBindings(contentEl);
		} else if (this.activeTab === "版本更新") {
			this.renderAboutSection(contentEl);
		} else {
			this.renderAISummarySettings(contentEl);
		}
	}

	private renderTabs(containerEl: HTMLElement) {
		const tabsEl = containerEl.createDiv({ cls: "auto-frontmatter-tabs" });
		for (const tab of SETTING_TABS) {
			const tabEl = tabsEl.createEl("button", {
				cls: `auto-frontmatter-tab${this.activeTab === tab ? " is-active" : ""}`,
				text: tab,
			});
			tabEl.onclick = () => {
				this.activeTab = tab;
				this.display();
			};
		}
	}

	private renderGeneralSettings(containerEl: HTMLElement) {
		this.renderRequiredFieldsInfo(containerEl);

		const highlightSettingEl = containerEl.createDiv({ cls: "auto-frontmatter-highlight-setting" });
		new Setting(highlightSettingEl)
			.setName("空属性高亮提醒")
			.setDesc("打开文件时高亮提醒必需属性中的空值。")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.emptyFieldHighlight)
					.onChange(async (value) => {
						if (!this.plugin.ensureDeviceBound()) {
							this.display();
							return;
						}
						this.plugin.settings.emptyFieldHighlight = value;
						await this.plugin.saveSettings();
						this.plugin.refreshEmptyFieldHighlights();
					}),
			);
	}

	private renderAISummarySettings(containerEl: HTMLElement) {
		const introEl = containerEl.createDiv({ cls: "auto-frontmatter-ai-summary-intro" });
		new Setting(introEl)
			.setName("AI 自动摘要")
			.setDesc("开启后，将使用 AI 对文档内容进行摘要总结，自动填入「摘要」字段。")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.aiSummaryEnabled)
					.onChange(async (value) => {
						this.plugin.settings.aiSummaryEnabled = value;
						await this.plugin.saveSettings();
					}),
			);

		containerEl.createEl("h3", { text: "模型配置" });
		new Setting(containerEl)
			.setName("API 地址")
			.addText((text) => {
				text
					.setValue(this.plugin.settings.aiApiUrl)
					.onChange(async (value) => {
						this.plugin.settings.aiApiUrl = value;
						await this.plugin.saveSettings();
					});
				text.inputEl.placeholder = "https://api.stepfun.com/step_plan/v1";
			});

		new Setting(containerEl)
			.setName("模型名称")
			.addText((text) => {
				text
					.setValue(this.plugin.settings.aiModelName)
					.onChange(async (value) => {
						this.plugin.settings.aiModelName = value;
						await this.plugin.saveSettings();
					});
				text.inputEl.placeholder = "step-3.7-flash";
			});

		const apiKeySetting = new Setting(containerEl).setName("API Key");
		apiKeySetting.controlEl.addClass("auto-frontmatter-ai-api-key-control");
		apiKeySetting.addText((text) => {
			text.setValue(this.plugin.settings.aiApiKey).onChange(async (value) => {
				this.plugin.settings.aiApiKey = value;
				await this.plugin.saveSettings();
			});
			text.inputEl.type = this.aiApiKeyVisible ? "text" : "password";
			text.inputEl.placeholder = "sk-xxxx";
		});
		apiKeySetting.addButton((button) => {
			button.setTooltip(this.aiApiKeyVisible ? "隐藏 API Key" : "显示 API Key").onClick(() => {
				this.aiApiKeyVisible = !this.aiApiKeyVisible;
				this.display();
			});
			setIcon(button.buttonEl, this.aiApiKeyVisible ? "eye-off" : "eye");
		});

			const statusEl = containerEl.createDiv({ cls: "auto-frontmatter-ai-status" });
			this.renderAISummaryTaskSection(statusEl, {
				task: "completion",
				title: "摘要补全",
				description: "为「摘要」为空且作者为本机绑定作者的文档生成 AI 摘要。",
				autoText: "自动触发：每 30 分钟",
				emptyText: "点击扫描查看需要补全摘要的文档。",
				countText: "篇文档需要补全摘要",
			});

		const promptHeaderEl = containerEl.createDiv({ cls: "auto-frontmatter-ai-prompt-header" });
		promptHeaderEl.createEl("h3", { text: "摘要 Prompt" });
		new Setting(promptHeaderEl).addButton((button) => {
			button.setButtonText("恢复默认").onClick(async () => {
				this.plugin.settings.aiSummaryPrompt = DEFAULT_AI_SUMMARY_PROMPT;
				await this.plugin.saveSettings();
				this.display();
			});
		});

		const promptEl = containerEl.createEl("textarea", {
			cls: "auto-frontmatter-ai-prompt-textarea",
		});
		promptEl.value = this.plugin.settings.aiSummaryPrompt;
		promptEl.addEventListener("change", async () => {
			this.plugin.settings.aiSummaryPrompt = promptEl.value;
			await this.plugin.saveSettings();
		});
	}

	private renderAISummaryTaskSection(
		containerEl: HTMLElement,
		options: {
			task: AISummaryTaskType;
			title: string;
			description: string;
			autoText: string;
			emptyText: string;
			countText: string;
		},
	) {
		const taskEl = containerEl.createDiv({ cls: "auto-frontmatter-ai-task-section" });
		taskEl.createEl("h3", { text: options.title });
		taskEl.createDiv({ cls: "auto-frontmatter-ai-task-description", text: options.description });
		const headerEl = taskEl.createDiv({ cls: "auto-frontmatter-ai-task-header" });
		headerEl.createDiv({ cls: "auto-frontmatter-ai-task-auto", text: options.autoText });
		const scanActionEl = headerEl.createDiv({ cls: "auto-frontmatter-ai-task-action" });
		new Setting(scanActionEl).addButton((button) => {
			const isScanning = this.getAISummaryTaskState(options.task).isScanning;
			button
				.setButtonText(isScanning ? "扫描中..." : "扫描")
				.setDisabled(isScanning || this.getAISummaryTaskState(options.task).isExecuting)
				.onClick(async () => {
					await this.scanAISummaryTask(options.task);
				});
		});

		const resultEl = taskEl.createDiv({ cls: "auto-frontmatter-ai-results" });
		const state = this.getAISummaryTaskState(options.task);
		if (!state.hasScanned) {
			resultEl.createDiv({ cls: "auto-frontmatter-ai-empty", text: options.emptyText });
			return;
		}

		if (state.results.length === 0) {
			resultEl.createDiv({ cls: "auto-frontmatter-ai-empty", text: "暂无需要处理的文档。" });
			return;
		}

		resultEl.createDiv({
			cls: "auto-frontmatter-ai-count",
			text: `共发现 ${state.results.length} ${options.countText}`,
		});
		const listEl = resultEl.createDiv({ cls: "auto-frontmatter-ai-list" });
		for (const result of state.results) {
			const itemEl = listEl.createDiv({ cls: "auto-frontmatter-ai-item" });
			const contentEl = itemEl.createDiv({ cls: "auto-frontmatter-ai-item-content" });
			const nameEl = contentEl.createDiv({ cls: "auto-frontmatter-ai-name" });
			nameEl.createSpan({ text: result.file.name });
			if (result.done) {
				nameEl.createSpan({ cls: "auto-frontmatter-ai-done", text: " ✓" });
			}
			contentEl.createDiv({ cls: "auto-frontmatter-ai-path", text: result.file.path });
			const openButton = itemEl.createEl("button", {
				cls: "auto-frontmatter-ai-open",
				attr: { "aria-label": "打开文件" },
			});
			setIcon(openButton, "external-link");
			openButton.onclick = async () => {
				await this.app.workspace.openLinkText(result.file.path, "", false);
			};
		}

		const statusText =
			state.processedCount === state.results.length && !state.isExecuting
				? `完成，已处理 ${state.processedCount} 篇`
				: "";
		new Setting(resultEl)
			.setDesc(statusText)
			.addButton((button) => {
				button
					.setButtonText(state.isExecuting ? "执行中..." : "执行")
					.setCta()
					.setDisabled(state.isExecuting || this.plugin.isAISummaryTaskRunning(options.task))
					.onClick(async () => {
						await this.executeAISummaryTask(options.task);
					});
			});
	}

	private getAISummaryTaskState(task: AISummaryTaskType): AISummaryTaskUiState {
		return {
			results: this.aiSummaryCompletionResults,
			hasScanned: this.hasScannedAISummaryCompletion,
			isScanning: this.isScanningAISummaryCompletion,
			isExecuting: this.isExecutingAISummaryCompletion,
			processedCount: this.processedAISummaryCompletionCount,
		};
	}

	private setAISummaryTaskResults(task: AISummaryTaskType, results: AISummaryCandidate[]) {
		this.aiSummaryCompletionResults = results;
	}

	private setAISummaryTaskScanning(task: AISummaryTaskType, value: boolean) {
		this.isScanningAISummaryCompletion = value;
	}

	private setAISummaryTaskScanned(task: AISummaryTaskType, value: boolean) {
		this.hasScannedAISummaryCompletion = value;
	}

	private setAISummaryTaskExecuting(task: AISummaryTaskType, value: boolean) {
		this.isExecutingAISummaryCompletion = value;
	}

	private setAISummaryTaskProcessedCount(task: AISummaryTaskType, value: number) {
		this.processedAISummaryCompletionCount = value;
	}

	private async scanAISummaryTask(task: AISummaryTaskType) {
		this.setAISummaryTaskScanned(task, true);
		this.setAISummaryTaskScanning(task, true);
		this.setAISummaryTaskResults(task, []);
		this.setAISummaryTaskProcessedCount(task, 0);
		this.display();

		const results = await this.plugin.scanAISummaryCandidates(task, true);
		this.setAISummaryTaskResults(task, results);
		this.setAISummaryTaskScanning(task, false);
		this.display();
	}

	private async executeAISummaryTask(task: AISummaryTaskType) {
		const state = this.getAISummaryTaskState(task);
		if (state.results.length === 0) {
			new Notice("AI 摘要：暂无需要处理的文档");
			return;
		}

		this.setAISummaryTaskExecuting(task, true);
		this.setAISummaryTaskProcessedCount(task, 0);
		for (const result of state.results) {
			result.done = false;
		}
		this.display();

		try {
			const processedCount = await this.plugin.executeAISummaryQueue(task, state.results, true, () => {
				this.setAISummaryTaskProcessedCount(task, this.getAISummaryTaskState(task).processedCount + 1);
				this.display();
			});
			this.setAISummaryTaskProcessedCount(task, processedCount);
		} finally {
			this.setAISummaryTaskExecuting(task, false);
			this.display();
		}
	}

	private renderRequiredFieldsInfo(containerEl: HTMLElement) {
		const sectionEl = containerEl.createDiv({ cls: "auto-frontmatter-required-fields" });
		sectionEl.createEl("h2", { text: "默认文件属性字段" });
		sectionEl.createEl("p", {
			text: "以下字段会在新建文档时自动写入，并在扫描仓库时补全检查。",
		});

		const table = sectionEl.createEl("table");
		const thead = table.createEl("thead");
		const headerRow = thead.createEl("tr");
		for (const header of ["字段", "说明", "填写方式"]) {
			headerRow.createEl("th", { text: header });
		}

		const tbody = table.createEl("tbody");
		for (const row of [
			["项目", "文档所属项目", "文件夹规则自动填写，或手动填写"],
			["类型", "文档类型", "文件夹规则自动填写，或手动填写"],
			["作者", "文档创建者", "根据设备自动识别"],
			["摘要", "文档内容摘要", "手动填写 / AI 自动生成"],
			["创建时间", "文档创建时间", "自动获取"],
			["最后更新", "最后一次编辑时间", "自动更新"],
		]) {
			const tr = tbody.createEl("tr");
			for (const cell of row) {
				tr.createEl("td", { text: cell });
			}
		}
	}

	private renderDeviceBindings(containerEl: HTMLElement) {
		this.renderCurrentDeviceStatus(containerEl);
		this.renderBoundDeviceList(containerEl);
	}

	private renderCurrentDeviceStatus(containerEl: HTMLElement) {
		const currentBinding = this.getCurrentDeviceBinding();
		const statusEl = containerEl.createDiv({ cls: "auto-frontmatter-current-device-card" });
		statusEl.createDiv({ cls: "auto-frontmatter-current-device-title", text: "本机设备" });
		statusEl.createDiv({
			cls: "auto-frontmatter-current-device-line",
			text: `UUID：${maskDeviceUuid(this.plugin.currentDeviceUuid)}`,
		});

		if (currentBinding?.author) {
			statusEl.createDiv({
				cls: "auto-frontmatter-current-device-line",
				text: `状态：✅ 已绑定 — ${currentBinding.author}`,
			});
			return;
		}

		statusEl.createDiv({
			cls: "auto-frontmatter-current-device-line",
			text: "状态：⚠️ 未绑定",
		});

		const actionEl = statusEl.createDiv({ cls: "auto-frontmatter-current-device-action" });
		if (this.bindingCurrentDevice) {
			if (this.bindingCurrentDeviceCustom) {
				new Setting(actionEl).addText((text) => {
					const confirm = async () => {
						await this.bindCurrentDevice(text.getValue());
					};

					text.setPlaceholder("自定义作者");
					text.inputEl.onblur = confirm;
					text.inputEl.onkeydown = (event) => {
						if (event.key === "Enter") {
							event.preventDefault();
							confirm();
						}
					};
					window.setTimeout(() => text.inputEl.focus(), 0);
				});
			} else {
				new Setting(actionEl).addDropdown((dropdown) => {
					dropdown.addOption("", "（请选择）");
					for (const option of AUTHOR_OPTIONS) {
						dropdown.addOption(option, option);
					}

					dropdown.onChange(async (value) => {
						if (value === CUSTOM_AUTHOR_MODE) {
							this.bindingCurrentDeviceCustom = true;
							this.display();
						} else if (value) {
							await this.bindCurrentDevice(value);
						}
					});
				});
			}
		} else {
			new Setting(actionEl).addButton((button) => {
				button.setButtonText("绑定本机").setCta().onClick(() => {
					this.bindingCurrentDevice = true;
					this.bindingCurrentDeviceCustom = false;
					this.display();
				});
			});
		}
	}

	private renderBoundDeviceList(containerEl: HTMLElement) {
		containerEl.createEl("h2", { text: "所有已绑定设备" });
		const listEl = containerEl.createDiv({ cls: "auto-frontmatter-bound-device-list" });
		const bindings = this.plugin.settings.deviceBindings.filter((binding) => binding.uuid && binding.author);
		if (bindings.length === 0) {
			listEl.createDiv({ cls: "auto-frontmatter-bound-device-empty", text: "暂无已绑定设备" });
			return;
		}

		for (const binding of bindings) {
			const rowEl = listEl.createDiv({ cls: "auto-frontmatter-bound-device-row" });
			rowEl.createDiv({
				cls: "auto-frontmatter-bound-device-uuid",
				text: maskDeviceUuid(binding.uuid),
			});
			const authorEl = rowEl.createDiv({ cls: "auto-frontmatter-bound-device-author" });
			authorEl.createSpan({ text: binding.author });
			if (binding.uuid === this.plugin.currentDeviceUuid) {
				authorEl.createSpan({ cls: "auto-frontmatter-device-local", text: "（本机）" });
			}
		}
	}

	private renderAboutSection(containerEl: HTMLElement) {
		containerEl.createEl("h2", { text: "auto-frontmatter" });
		containerEl.createDiv({
			cls: "auto-frontmatter-about-version",
			text: `当前版本：${this.plugin.manifest.version}`,
		});

		const actionEl = containerEl.createDiv({ cls: "auto-frontmatter-about-action" });
		const checkButton = actionEl.createEl("button", {
			cls: "mod-cta auto-frontmatter-about-check-btn",
			text: this.isCheckingUpdate ? "检查中..." : "检查更新",
		});
		checkButton.disabled = this.isCheckingUpdate || this.isUpdating;
		checkButton.onclick = async () => {
			this.isCheckingUpdate = true;
			this.updateResultMessage = "";
			this.latestVersion = "";
			this.display();

			const result = await this.plugin.checkForUpdate();
			this.isCheckingUpdate = false;

			if (result.error === "not_found") {
				new Notice("未找到远端仓库，请检查网络");
				this.updateResultMessage = "未找到远端仓库，请检查网络";
			} else if (result.error) {
				new Notice(result.error);
				this.updateResultMessage = result.error;
			} else if (result.hasUpdate) {
				this.latestVersion = result.version;
				this.updateResultMessage = `🔄 发现新版本：${result.version}（当前 ${this.plugin.manifest.version}）`;
			} else {
				this.updateResultMessage = `✅ 当前已是最新版本（${this.plugin.manifest.version}）`;
			}
			this.display();
		};

		if (this.updateResultMessage) {
			const resultEl = containerEl.createDiv({ cls: "auto-frontmatter-about-result" });
			resultEl.createDiv({ text: this.updateResultMessage });

			if (this.latestVersion) {
				const updateButton = resultEl.createEl("button", {
					cls: "mod-cta auto-frontmatter-about-update-btn",
					text: this.isUpdating ? `更新中...（${this.updateProgress}/3）` : "立即更新",
				});
				updateButton.disabled = this.isUpdating;
				updateButton.onclick = async () => {
					this.isUpdating = true;
					this.updateProgress = 0;
					this.display();

					try {
						await this.plugin.performUpdate(this.latestVersion, (step, total) => {
							this.updateProgress = step;
							this.display();
						});
						this.isUpdating = false;
						this.latestVersion = "";
						this.updateResultMessage = "";
					} catch (error) {
						this.isUpdating = false;
						new Notice(`更新失败：${getErrorMessage(error)}`);
						this.updateResultMessage = `更新失败：${getErrorMessage(error)}`;
					}
					this.display();
				};
			}
		}
	}

	private getCurrentDeviceBinding(): DeviceAuthorBinding | undefined {
		return this.plugin.settings.deviceBindings.find((binding) => {
			return binding.uuid === this.plugin.currentDeviceUuid;
		});
	}

	private async bindCurrentDevice(author: string) {
		const trimmed = author.trim();
		if (!trimmed) {
			return;
		}

		let binding = this.getCurrentDeviceBinding();
		if (!binding) {
			binding = {
				uuid: this.plugin.currentDeviceUuid,
				author: trimmed,
			};
			this.plugin.settings.deviceBindings.push(binding);
		} else {
			binding.author = trimmed;
		}

		this.bindingCurrentDevice = false;
		this.bindingCurrentDeviceCustom = false;
			await this.plugin.saveSettings();
			this.display();
	}

	private renderFolderDefaultRules(folderRuleTabContent: HTMLElement) {
		folderRuleTabContent.addClass("auto-frontmatter-folder-rules-tab");
		const sectionEl = folderRuleTabContent.createDiv({ cls: "auto-frontmatter-folder-rules-section" });
		const headerEl = sectionEl.createDiv({ cls: "auto-frontmatter-folder-rules-header" });
		const headerTopEl = headerEl.createDiv({ cls: "auto-frontmatter-folder-rules-header-top" });
		headerTopEl.createEl("h2", { text: "文件夹内文档属性匹配规则" });
		const addRuleEl = headerTopEl.createDiv({ cls: "auto-frontmatter-folder-rules-add-action" });
		new Setting(addRuleEl).addButton((button) => {
			button.setButtonText("添加规则").setCta().onClick(async () => {
				if (!this.plugin.ensureDeviceBound()) {
					return;
				}
				this.plugin.settings.folderDefaults.push(this.plugin.createFolderRule());
				await this.plugin.saveSettings();
				this.currentRulePage = Math.max(0, Math.ceil(this.plugin.settings.folderDefaults.length / RULES_PER_PAGE) - 1);
				this.display();
			});
		});
		headerEl.createEl("p", {
			cls: "auto-frontmatter-folder-rules-subtitle",
			text: "拖入规则文件夹内的所有md文件，默认的文件属性字段会跟随匹配规则走",
		});
		headerEl.createEl("p", {
			cls: "auto-frontmatter-folder-rules-note",
			text: '当前仅支持设置"项目""类型"字段',
		});

		const folders = getVaultFolders(this.app);
		this.renderRuleCarousel(sectionEl, folders);

		sectionEl.createDiv({ cls: "auto-frontmatter-section-divider" });

		const checkmarkSettingEl = sectionEl.createDiv({ cls: "auto-frontmatter-folder-checkmark-setting" });
		new Setting(checkmarkSettingEl)
			.setName("在文件列表中标记已配规则的文件夹")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.showFolderCheckmark)
					.onChange(async (value) => {
						if (!this.plugin.ensureDeviceBound()) {
							this.display();
							return;
						}
						this.plugin.settings.showFolderCheckmark = value;
						await this.plugin.saveSettings();
						this.plugin.refreshFolderCheckmarks();
					});
			});

		sectionEl.createDiv({ cls: "auto-frontmatter-section-divider" });

		this.renderUnmatchedFolderSection(sectionEl);
	}

	private renderRuleCarousel(folderRuleSectionEl: HTMLElement, folders: string[]) {
		const ruleCount = this.plugin.settings.folderDefaults.length;
		const pageCount = Math.max(1, Math.ceil(ruleCount / RULES_PER_PAGE));
		this.currentRulePage = clamp(this.currentRulePage, 0, pageCount - 1);

		const carouselEl = folderRuleSectionEl.createDiv({ cls: "auto-frontmatter-rule-carousel" });
		const viewportEl = carouselEl.createDiv({ cls: "auto-frontmatter-rule-carousel-viewport" });
		const hasMultiplePages = pageCount > 1;

		if (hasMultiplePages) {
			this.renderRulePageButton(viewportEl, "left", this.currentRulePage === 0, () => {
				this.currentRulePage = Math.max(0, this.currentRulePage - 1);
				this.display();
			});
		}

		const ruleGridEl = viewportEl.createDiv({ cls: "auto-frontmatter-rule-grid" });
		const pageStart = this.currentRulePage * RULES_PER_PAGE;
		const pageRules = this.plugin.settings.folderDefaults.slice(pageStart, pageStart + RULES_PER_PAGE);

		if (ruleCount === 0) {
			ruleGridEl.createDiv({
				cls: "auto-frontmatter-rule-empty",
				text: "暂无规则",
			});
		} else {
			for (let pageIndex = 0; pageIndex < pageRules.length; pageIndex++) {
				this.renderRuleCard(ruleGridEl, pageRules[pageIndex], pageStart + pageIndex, folders);
			}
		}

		if (hasMultiplePages) {
			this.renderRulePageButton(viewportEl, "right", this.currentRulePage === pageCount - 1, () => {
				this.currentRulePage = Math.min(pageCount - 1, this.currentRulePage + 1);
				this.display();
			});

			const dotsEl = carouselEl.createDiv({ cls: "auto-frontmatter-rule-dots" });
			for (let page = 0; page < pageCount; page++) {
				const dotEl = dotsEl.createEl("button", {
					cls: `auto-frontmatter-rule-dot${page === this.currentRulePage ? " is-active" : ""}`,
					attr: { "aria-label": `跳转到第 ${page + 1} 页` },
				});
				dotEl.onclick = () => {
					this.currentRulePage = page;
					this.display();
				};
			}
		}
	}

	private renderRulePageButton(
		ruleCarouselViewportEl: HTMLElement,
		direction: "left" | "right",
		disabled: boolean,
		onClick: () => void,
	) {
		const buttonEl = ruleCarouselViewportEl.createEl("button", {
			cls: `auto-frontmatter-rule-nav is-${direction}${disabled ? " is-disabled" : ""}`,
			attr: { "aria-label": direction === "left" ? "上一页" : "下一页" },
		});
		setIcon(buttonEl, direction === "left" ? "chevron-left" : "chevron-right");
		buttonEl.disabled = disabled;
		buttonEl.onclick = onClick;
	}

	private renderRuleCard(
		ruleGridEl: HTMLElement,
		rule: FolderDefaultRule,
		ruleIndex: number,
		folders: string[],
	) {
		const ruleCard = ruleGridEl.createDiv({ cls: "auto-frontmatter-rule-card" });
		const topRow = ruleCard.createDiv({ cls: "auto-frontmatter-rule-top-row" });
		topRow.createSpan({
			cls: "auto-frontmatter-rule-title",
			text: `规则 ${ruleIndex + 1}`,
		});

		const deleteButton = topRow.createEl("button", {
			cls: "auto-frontmatter-rule-delete",
			attr: { "aria-label": "删除规则" },
		});
		setIcon(deleteButton, "trash-2");
		deleteButton.onclick = async () => {
			if (!this.plugin.ensureDeviceBound()) {
				return;
			}
			this.plugin.settings.folderDefaults.splice(ruleIndex, 1);
			await this.plugin.saveSettings();
			const pageCount = Math.max(1, Math.ceil(this.plugin.settings.folderDefaults.length / RULES_PER_PAGE));
			this.currentRulePage = clamp(this.currentRulePage, 0, pageCount - 1);
			this.display();
		};

		const folderRowEl = ruleCard.createDiv({ cls: "auto-frontmatter-rule-folder-row" });
		folderRowEl.createSpan({ cls: "auto-frontmatter-rule-folder-icon", text: "📁" });
		this.renderRuleInlineFolderEditor(folderRowEl, rule, folders);

		const valueRowEl = ruleCard.createDiv({ cls: "auto-frontmatter-rule-value-row" });
		this.renderRuleInlineFieldEditor(valueRowEl, rule);
		valueRowEl.createSpan({ cls: "auto-frontmatter-rule-arrow", text: "→" });
		this.renderRuleInlineValueEditor(valueRowEl, rule);

		const auditEl = ruleCard.createDiv({ cls: "auto-frontmatter-rule-audit" });
		if (!rule.createdBy || !rule.createdAt) {
			auditEl.setText("创建信息不可追溯");
		} else {
			auditEl.createDiv({ text: `由 ${rule.createdBy}` });
			auditEl.createDiv({ text: formatAuditTime(rule.createdAt) });
		}
	}

	private renderRuleInlineFolderEditor(
		containerEl: HTMLElement,
		rule: FolderDefaultRule,
		folders: string[],
	) {
		this.createInlineRuleVariable(containerEl, formatRuleInlineValue(rule.folder), (spanEl) => {
			this.openInlineRuleSelectEditor(
				spanEl,
				rule,
				rule.folder,
				folders.map((folder) => ({
					value: folder,
					label: formatFolderOptionLabel(folder),
				})),
				async (value) => {
					rule.folder = value;
				},
			);
		});
	}

	private renderRuleInlineFieldEditor(containerEl: HTMLElement, rule: FolderDefaultRule) {
		this.createInlineRuleVariable(containerEl, formatRuleInlineValue(rule.field), (spanEl) => {
			this.openInlineRuleSelectEditor(
				spanEl,
				rule,
				rule.field,
				FOLDER_DEFAULT_FIELDS.map((field) => ({ value: field, label: field })),
				async (value) => {
					rule.field = value as FolderDefaultField;
					rule.value = "";
				},
			);
		});
	}

	private renderRuleInlineValueEditor(containerEl: HTMLElement, rule: FolderDefaultRule) {
		this.createInlineRuleVariable(containerEl, formatRuleInlineValue(rule.value), (spanEl) => {
			const candidates = getFrontmatterFieldCandidates(this.app, rule.field);
			const values =
				rule.value && !candidates.includes(rule.value) ? [...candidates, rule.value] : candidates;
			this.openInlineRuleSelectEditor(
				spanEl,
				rule,
				rule.value,
				[
					...values.map((value) => ({ value, label: value })),
					{ value: "__new__", label: "自定义" },
				],
				async (value) => {
					if (value === "__new__") {
						this.openInlineRuleInputEditor(spanEl, rule, rule.value, async (nextValue) => {
							rule.value = nextValue;
						});
						return "defer";
					}
					rule.value = value;
				},
			);
		});
	}

	private createInlineRuleVariable(
		containerEl: HTMLElement,
		text: string,
		onClick: (spanEl: HTMLSpanElement) => void,
	) {
		const spanEl = containerEl.createEl("span", {
			cls: "auto-frontmatter-rule-inline-value",
			text,
		});
		spanEl.tabIndex = 0;
		spanEl.addEventListener("click", (event) => {
			event.stopPropagation();
			onClick(spanEl);
		});
		spanEl.addEventListener("keydown", (event) => {
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				onClick(spanEl);
			}
		});
	}

	private openInlineRuleSelectEditor(
		containerEl: HTMLElement,
		rule: FolderDefaultRule,
		currentValue: string,
		options: Array<{ value: string; label: string }>,
		onCommit: (value: string) => Promise<void | "defer">,
	) {
		this.closeActiveInlineEditor();
		const overlayEl = containerEl.createDiv({ cls: "auto-frontmatter-rule-inline-editor" });
		const selectEl = overlayEl.createEl("select", {
			cls: "dropdown auto-frontmatter-rule-inline-select",
		});
		for (const option of options) {
			const optionEl = selectEl.createEl("option", {
				value: option.value,
				text: option.label,
			});
			if (option.value === "__new__") {
				optionEl.selected = currentValue.length === 0;
			}
		}
		if (currentValue && options.some((option) => option.value === currentValue)) {
			selectEl.value = currentValue;
		}

		const closeDropdown = this.createInlineDropdownCloser(overlayEl);

		selectEl.addEventListener("change", async () => {
			const selectedValue = selectEl.value;
			closeDropdown();
			if (selectedValue === "__new__") {
				const result = await onCommit(selectedValue);
				if (result !== "defer") {
					closeDropdown();
				}
				return;
			}
			await this.saveInlineRuleChange(rule, async () => {
				await onCommit(selectedValue);
			});
		});
		selectEl.addEventListener("blur", () => {
			window.setTimeout(() => {
				closeDropdown();
			}, 100);
		});

		window.setTimeout(() => {
			selectEl.focus();
			const pickerEl = selectEl as HTMLSelectElement & { showPicker?: () => void };
			try {
				if (pickerEl.showPicker) {
					pickerEl.showPicker();
				} else {
					selectEl.click();
				}
			} catch (_error) {
				selectEl.click();
			}
		}, 0);
	}

	private openInlineRuleInputEditor(
		containerEl: HTMLElement,
		rule: FolderDefaultRule,
		currentValue: string,
		onCommit: (value: string) => Promise<void>,
	) {
		this.closeActiveInlineEditor();
		const overlayEl = containerEl.createDiv({ cls: "auto-frontmatter-rule-inline-editor" });
		const inputEl = overlayEl.createEl("input", {
			cls: "auto-frontmatter-rule-inline-input",
			type: "text",
			value: currentValue,
		});

		const closeDropdown = this.createInlineDropdownCloser(overlayEl);
		const finalize = async () => {
			if (closeDropdown()) {
				await this.saveInlineRuleChange(rule, async () => {
					await onCommit(inputEl.value);
				});
			}
		};

		inputEl.addEventListener("blur", () => {
			window.setTimeout(() => {
				void closeDropdown();
			}, 100);
		});
		inputEl.addEventListener("keydown", (event) => {
			if (event.key === "Enter") {
				event.preventDefault();
				void finalize();
			}
			if (event.key === "Escape") {
				event.preventDefault();
				closeDropdown();
			}
		});

		window.setTimeout(() => {
			inputEl.focus();
			inputEl.select();
		}, 0);
	}

	private createInlineDropdownCloser(overlayEl: HTMLElement) {
		let closed = false;
		const closeDropdown = () => {
			if (closed) {
				return false;
			}
			closed = true;
			overlayEl.querySelectorAll("select, input").forEach((el) => el.remove());
			if (overlayEl.isConnected) {
				overlayEl.remove();
			}
			if (this.activeInlineEditorCleanup === closeDropdown) {
				this.activeInlineEditorCleanup = null;
			}
			return true;
		};
		this.activeInlineEditorCleanup = closeDropdown;
		return closeDropdown;
	}

	private async saveInlineRuleChange(rule: FolderDefaultRule, update: () => Promise<void>) {
		if (!this.plugin.ensureDeviceBound()) {
			this.display();
			return;
		}
		await update();
		this.plugin.touchFolderRule(rule);
		await this.plugin.saveSettings();
		this.display();
	}

	private closeActiveInlineEditor() {
		this.activeInlineEditorCleanup?.();
		this.activeInlineEditorCleanup = null;
	}

	private renderUnmatchedFolderSection(containerEl: HTMLElement) {
		const sectionEl = containerEl.createDiv({ cls: "auto-frontmatter-unmatched-section" });
		const headerEl = sectionEl.createDiv({ cls: "auto-frontmatter-unmatched-header" });
		headerEl.createEl("h3", { text: "无匹配规则的文件夹" });
		const actionEl = headerEl.createDiv({ cls: "auto-frontmatter-unmatched-action" });
		new Setting(actionEl).addButton((button) => {
			button
				.setButtonText(this.isScanningUnmatchedFolders ? "扫描中..." : "扫描")
				.setDisabled(this.isScanningUnmatchedFolders)
				.onClick(async () => {
					await this.scanUnmatchedFolders();
				});
		});
		sectionEl.createEl("p", {
			cls: "auto-frontmatter-unmatched-subtitle",
			text: "以下文件夹尚未设置任何属性匹配规则。",
		});

		const resultEl = sectionEl.createDiv({ cls: "auto-frontmatter-unmatched-results" });
		if (!this.hasScannedUnmatchedFolders) {
			resultEl.createDiv({
				cls: "auto-frontmatter-unmatched-empty",
				text: "点击扫描查看未配置的文件夹。",
			});
			return;
		}

		if (this.unmatchedFolders.length === 0) {
			resultEl.createDiv({
				cls: "auto-frontmatter-unmatched-empty",
				text: "所有文件夹均已配置规则。",
			});
			return;
		}

		const listEl = resultEl.createDiv({ cls: "auto-frontmatter-unmatched-list" });
		for (const folder of this.unmatchedFolders) {
			const itemEl = listEl.createDiv({ cls: "auto-frontmatter-unmatched-item" });
			const contentEl = itemEl.createDiv({ cls: "auto-frontmatter-unmatched-content" });
			contentEl.createDiv({
				cls: "auto-frontmatter-unmatched-path",
				text: folder.path,
			});
			contentEl.createDiv({
				cls: folder.inheritedRules.length
					? "auto-frontmatter-unmatched-hint is-inherited"
					: "auto-frontmatter-unmatched-hint is-empty",
				text:
					folder.inheritedRules.length > 0
						? `↑ 父级规则：${folder.inheritedRules
								.map((rule) => `${rule.folder} → ${rule.field}: ${rule.value}`)
								.join("，")}`
						: "无任何父级规则",
			});

			const buttonEl = itemEl.createDiv({ cls: "auto-frontmatter-unmatched-button" });
			new Setting(buttonEl).addButton((button) => {
				button.setButtonText("设置").onClick(() => {
					new FolderRuleModal(this.app, this.plugin, folder.path).open();
				});
			});
		}
	}

	private renderScanSection(containerEl: HTMLElement) {
		containerEl.createEl("h2", { text: "扫描仓库" });

		new Setting(containerEl)
			.setName("扫描仓库")
			.setDesc("找出需要补全属性的 Markdown 文件。")
			.addButton((button) => {
				button
					.setButtonText(this.isScanning ? "扫描中..." : "扫描")
					.setDisabled(this.isScanning || this.isExecuting)
					.onClick(async () => {
						if (!this.plugin.ensureDeviceBound()) {
							return;
						}
						await this.scanVault();
					});
			});

		if (!this.hasScanned) {
			return;
		}

		const resultEl = containerEl.createDiv({ cls: "auto-frontmatter-scan-results" });
		if (this.scanResults.length === 0) {
			resultEl.createDiv({
				cls: "auto-frontmatter-scan-empty",
				text: "所有文件均已包含属性 ✓",
			});
			return;
		}

		resultEl.createDiv({
			cls: "auto-frontmatter-scan-count",
			text: `共发现 ${this.scanResults.length} 个文件需要补全属性`,
		});

		const listEl = resultEl.createDiv({ cls: "auto-frontmatter-scan-list" });
		for (const result of this.scanResults) {
			const itemEl = listEl.createDiv({ cls: "auto-frontmatter-scan-item" });
			const title = result.done ? `${result.file.name} ✓` : result.file.name;
			const titleEl = itemEl.createDiv({ cls: "auto-frontmatter-scan-name", text: title });
			titleEl.createSpan({
				cls: "auto-frontmatter-scan-missing",
				text: ` ${formatScanReason(result)}`,
			});
			itemEl.createDiv({ cls: "auto-frontmatter-scan-path", text: result.file.path });
		}

		const statusText =
			this.processedCount === this.scanResults.length && !this.isExecuting
				? `完成，已处理 ${this.processedCount} 个文件`
				: "";

		new Setting(resultEl)
			.setDesc(statusText)
			.addButton((button) => {
				button
					.setButtonText(this.isExecuting ? "执行中..." : "执行")
					.setCta()
					.setDisabled(this.isExecuting)
					.onClick(async () => {
						if (!this.plugin.ensureDeviceBound()) {
							return;
						}
						await this.executeScanResults();
					});
			});
	}

	private async scanVault() {
		this.isScanning = true;
		this.hasScanned = true;
		this.scanResults = [];
		this.processedCount = 0;
		this.display();

		const results: ScanResult[] = [];
		const files = this.app.vault.getMarkdownFiles();

		for (let index = 0; index < files.length; index++) {
			const file = files[index];
			const content = await this.app.vault.cachedRead(file);
			const defaults = this.plugin.getFolderDefaultValues(file);
			const status = getFrontmatterStatus(content, defaults);
			if (
				status.missingFields.length > 0 ||
				status.orderNeedsFix ||
				status.renameFields.length > 0 ||
				status.defaultFields.length > 0
			) {
				results.push({
					file,
					missingFields: status.missingFields,
					orderNeedsFix: status.orderNeedsFix,
					renameFields: status.renameFields,
					defaultFields: status.defaultFields,
					done: false,
				});
			}

			if (index % 25 === 24) {
				await yieldToUi();
			}
		}

		this.scanResults = results;
		this.isScanning = false;
		this.display();
	}

	private async scanUnmatchedFolders() {
		this.hasScannedUnmatchedFolders = true;
		this.isScanningUnmatchedFolders = true;
		this.unmatchedFolders = [];
		this.display();

		const folders = getVaultFolders(this.app).filter((folder) => shouldIncludeRuleFolder(folder));
		const directRuleFolders = new Set(
			this.plugin.settings.folderDefaults
				.map((rule) => rule.folder)
				.filter((folder) => shouldIncludeRuleFolder(folder)),
		);

		this.unmatchedFolders = folders
			.filter((folder) => !directRuleFolders.has(folder))
			.map((folder) => ({
				path: folder,
				inheritedRules: getAncestorRules(folder, this.plugin.settings.folderDefaults),
			}))
			.sort((a, b) => a.path.localeCompare(b.path));

		this.isScanningUnmatchedFolders = false;
		this.display();
	}

	private async executeScanResults() {
		this.isExecuting = true;
		this.processedCount = 0;
		this.display();

		for (let index = 0; index < this.scanResults.length; index++) {
			const result = this.scanResults[index];
			const content = await this.app.vault.read(result.file);
			const defaults = this.plugin.getFolderDefaultValues(result.file);
			const status = getFrontmatterStatus(content, defaults);
			const next = buildContentWithOrderedFields(
				content,
				result.file,
				status,
				"",
				defaults,
				this.plugin.buildFrontmatter.bind(this.plugin),
			);
			if (next !== null) {
				await this.app.vault.modify(result.file, next);
			}

			result.missingFields = status.missingFields;
			result.orderNeedsFix = status.orderNeedsFix;
			result.renameFields = status.renameFields;
			result.defaultFields = status.defaultFields;
			result.done = true;
			this.processedCount++;

			if (index % 10 === 9 || index === this.scanResults.length - 1) {
				this.display();
				await yieldToUi();
			}
		}

		this.isExecuting = false;
		this.display();
	}
}

interface ScanResult {
	file: TFile;
	missingFields: RequiredField[];
	orderNeedsFix: boolean;
	renameFields: LegacyRename[];
	defaultFields: FolderDefaultField[];
	done: boolean;
}

interface UnmatchedFolderResult {
	path: string;
	inheritedRules: FolderDefaultRule[];
}

interface AISummaryCandidate {
	file: TFile;
	content: string;
	document: SummaryDocument;
	done?: boolean;
}

interface AISummaryTaskUiState {
	results: AISummaryCandidate[];
	hasScanned: boolean;
	isScanning: boolean;
	isExecuting: boolean;
	processedCount: number;
}

interface ChatCompletionResponse {
	error?: {
		message?: string;
	};
	choices?: Array<{
			message?: {
				content?: string;
				reasoning_content?: string;
				reasoning?: string;
			};
		}>;
	}

interface FrontmatterStatus {
	missingFields: RequiredField[];
	orderNeedsFix: boolean;
	renameFields: LegacyRename[];
	defaultFields: FolderDefaultField[];
}

interface FrontmatterBlock {
	key: string | null;
	lines: string[];
}

interface LegacyRename {
	from: LegacyField;
	to: RequiredField;
}

function hasFrontmatter(content: string): boolean {
	return content.startsWith("---");
}

function getFrontmatterStatus(content: string, defaults: FolderDefaultValues = {}): FrontmatterStatus {
	const frontmatter = parseFrontmatter(content);
	if (frontmatter === null) {
		return {
			missingFields: [...REQUIRED_FIELDS],
			orderNeedsFix: false,
			renameFields: [],
			defaultFields: [],
		};
	}

	const blocks = parseFrontmatterBlocks(frontmatter.body);
	const renameFields = getLegacyRenames(blocks);
	const migratedBlocks = migrateLegacyBlocks(blocks);
	const missingFields = REQUIRED_FIELDS.filter((field) => !hasFrontmatterBlock(migratedBlocks, field));
	const defaultFields = FOLDER_DEFAULT_FIELDS.filter((field) => {
		return defaults[field] !== undefined && frontmatterFieldIsEmpty(migratedBlocks, field);
	});
	return {
		missingFields,
		orderNeedsFix: !requiredFieldsAreInRelativeOrder(migratedBlocks),
		renameFields,
		defaultFields,
	};
}

function buildContentWithOrderedFields(
	content: string,
	file: TFile,
	status: FrontmatterStatus,
	authorName: string,
	defaults: FolderDefaultValues,
	buildFullFrontmatter: (created: string, defaults?: FolderDefaultValues) => string,
): string | null {
	if (
		status.missingFields.length === 0 &&
		!status.orderNeedsFix &&
		status.renameFields.length === 0 &&
		status.defaultFields.length === 0
	) {
		return null;
	}

	const created = formatLocalDate(new Date(file.stat.ctime));
	const frontmatter = parseFrontmatter(content);
	if (frontmatter === null) {
		return buildFullFrontmatter(created, defaults) + content;
	}

	const migratedBody = migrateLegacyFrontmatterBody(frontmatter.body);
	const body = status.orderNeedsFix
		? buildReorderedFrontmatterBody(migratedBody, created, authorName, defaults)
		: buildFrontmatterBodyWithMissingFields(
				migratedBody,
				status.missingFields,
				status.defaultFields,
				created,
				authorName,
				defaults,
			);
	const suffix = content.slice(frontmatter.end);
	const separator = suffix.startsWith("\n") ? "" : "\n";
	return `---\n${body}${separator}${suffix}`;
}

function buildFrontmatterBodyWithMissingFields(
	frontmatterBody: string,
	missingFields: RequiredField[],
	defaultFields: FolderDefaultField[],
	fileCreated: string,
	authorName: string,
	defaults: FolderDefaultValues,
): string {
	const blocks = parseFrontmatterBlocks(frontmatterBody);
	const lines: string[] = [];
	const inserted = new Set<RequiredField>();
	const createdForUpdated = getExistingCreatedValue(blocks) ?? fileCreated;

	for (const block of blocks) {
		if (isRequiredField(block.key)) {
			for (const field of missingFields) {
				if (!inserted.has(field) && getRequiredFieldIndex(field) < getRequiredFieldIndex(block.key)) {
					const created = field === "最后更新" ? createdForUpdated : fileCreated;
					lines.push(...buildRequiredFieldLines(field, undefined, created, authorName, defaults));
					inserted.add(field);
				}
			}
		}

		lines.push(...buildBlockLinesWithDefault(block, defaultFields, defaults));
	}

	for (const field of missingFields) {
		if (!inserted.has(field)) {
			const created = field === "最后更新" ? createdForUpdated : fileCreated;
			lines.push(...buildRequiredFieldLines(field, undefined, created, authorName, defaults));
		}
	}

	return lines.join("\n");
}

function getExistingCreatedValue(blocks: FrontmatterBlock[]): string | null {
	for (const block of blocks) {
		if (block.key === "创建时间") {
			return getBlockScalar(block);
		}
	}

	return null;
}

function buildBlockLinesWithDefault(
	block: FrontmatterBlock,
	defaultFields: FolderDefaultField[],
	defaults: FolderDefaultValues,
): string[] {
	if (block.key === "项目" && defaultFields.includes("项目")) {
		return [formatScalarField("项目", defaults["项目"] ?? "")];
	}
	if (block.key === "类型" && defaultFields.includes("类型")) {
		return ["类型:", ...formatListValue(undefined, defaults["类型"] ?? "")];
	}
	return block.lines;
}

function fillEmptyFolderDefaults(content: string, defaults: FolderDefaultValues): string | null {
	const frontmatter = parseFrontmatter(content);
	if (frontmatter === null) {
		return null;
	}

	const body = migrateLegacyFrontmatterBody(frontmatter.body);
	const blocks = parseFrontmatterBlocks(body);
	const defaultFields = FOLDER_DEFAULT_FIELDS.filter((field) => {
		return defaults[field] !== undefined && frontmatterFieldIsEmpty(blocks, field);
	});
	if (defaultFields.length === 0) {
		return null;
	}

	const lines = blocks.flatMap((block) => buildBlockLinesWithDefault(block, defaultFields, defaults));
	const suffix = content.slice(frontmatter.end);
	const separator = suffix.startsWith("\n") ? "" : "\n";
	return `---\n${lines.join("\n")}${separator}${suffix}`;
}

function frontmatterFieldIsEmpty(blocks: FrontmatterBlock[], field: FolderDefaultField): boolean {
	const block = blocks.find((item) => item.key === field);
	if (!block) {
		return false;
	}

	if (field === "项目") {
		return getBlockScalar(block) === null;
	}

	const listValues = getBlockListValues(block);
	if (listValues.length > 0) {
		return listValues.every((value) => value.length === 0);
	}

	return getBlockScalar(block) === null;
}

function buildReorderedFrontmatterBody(
	frontmatterBody: string,
	fileCreated: string,
	authorName: string,
	defaults: FolderDefaultValues,
): string {
	const blocks = parseFrontmatterBlocks(frontmatterBody);
	const requiredBlocks = new Map<RequiredField, FrontmatterBlock>();
	const customBlocks: FrontmatterBlock[] = [];

	for (const block of blocks) {
		if (isRequiredField(block.key)) {
			if (!requiredBlocks.has(block.key)) {
				requiredBlocks.set(block.key, block);
			} else {
				customBlocks.push(block);
			}
		} else if (block.lines.length > 0) {
			customBlocks.push(block);
		}
	}

	const existingCreated = getBlockScalar(requiredBlocks.get("创建时间"));
	const created = existingCreated || fileCreated;
	const lines: string[] = [];

	lines.push(...buildRequiredFieldLines("项目", requiredBlocks.get("项目"), fileCreated, authorName, defaults));
	lines.push(...buildRequiredFieldLines("类型", requiredBlocks.get("类型"), fileCreated, authorName, defaults));
	lines.push(...customBlocks.flatMap((block) => block.lines));
	lines.push(...buildRequiredFieldLines("作者", requiredBlocks.get("作者"), fileCreated, authorName, defaults));
	lines.push(...buildRequiredFieldLines("摘要", requiredBlocks.get("摘要"), fileCreated, authorName, defaults));
	lines.push(...buildRequiredFieldLines("创建时间", requiredBlocks.get("创建时间"), fileCreated, authorName, defaults));
	lines.push(...buildRequiredFieldLines("最后更新", requiredBlocks.get("最后更新"), created, authorName, defaults));
	return lines.join("\n");
}

function buildRequiredFieldLines(
	field: RequiredField,
	block: FrontmatterBlock | undefined,
	fileCreated: string,
	authorName: string,
	defaults: FolderDefaultValues = {},
): string[] {
	if (field === "项目") {
		return [formatScalarField("项目", getBlockScalar(block) ?? defaults["项目"] ?? "")];
	}
	if (field === "类型") {
		return ["类型:", ...formatListValue(block, defaults["类型"] ?? "")];
	}
	if (field === "作者") {
		return ["作者:", ...formatListValue(block, authorName)];
	}
	if (field === "摘要") {
		return [formatScalarField("摘要", getBlockScalar(block) ?? "")];
	}
	if (field === "创建时间") {
		return [`创建时间: ${getBlockScalar(block) || fileCreated}`];
	}
	return [`最后更新: ${getBlockScalar(block) || fileCreated}`];
}

function getLegacyRenames(blocks: FrontmatterBlock[]): LegacyRename[] {
	const renames: LegacyRename[] = [];
	for (const legacyField of Object.keys(LEGACY_FIELD_RENAMES) as LegacyField[]) {
		if (hasAnyFrontmatterBlock(blocks, legacyField)) {
			renames.push({
				from: legacyField,
				to: LEGACY_FIELD_RENAMES[legacyField],
			});
		}
	}
	return renames;
}

function migrateLegacyFrontmatterBody(frontmatterBody: string): string {
	return migrateLegacyBlocks(parseFrontmatterBlocks(frontmatterBody))
		.flatMap((block) => block.lines)
		.join("\n");
}

function migrateLegacyBlocks(blocks: FrontmatterBlock[]): FrontmatterBlock[] {
	const hasNewField = new Set<RequiredField>();
	for (const block of blocks) {
		if (isRequiredField(block.key)) {
			hasNewField.add(block.key);
		}
	}

	const migrated: FrontmatterBlock[] = [];
	for (const block of blocks) {
		if (isLegacyField(block.key)) {
			const newKey = LEGACY_FIELD_RENAMES[block.key];
			if (hasNewField.has(newKey)) {
				continue;
			}

			hasNewField.add(newKey);
			migrated.push({
				key: newKey,
				lines: renameBlockFirstLine(block.lines, newKey),
			});
		} else {
			migrated.push(block);
		}
	}

	return migrated;
}

function renameBlockFirstLine(lines: string[], key: RequiredField): string[] {
	if (lines.length === 0) {
		return [];
	}

	const colon = lines[0].indexOf(":");
	const firstLine = colon === -1 ? `${key}:` : `${key}${lines[0].slice(colon)}`;
	return [firstLine, ...lines.slice(1)];
}

function parseFrontmatterBlocks(frontmatter: string): FrontmatterBlock[] {
	const blocks: FrontmatterBlock[] = [];
	const lines = frontmatter.split("\n").filter((line, index, all) => {
		return index < all.length - 1 || line.length > 0;
	});

	for (const line of lines) {
		const key = getTopLevelKey(line);
		if (key !== null || blocks.length === 0) {
			blocks.push({ key, lines: [line] });
		} else {
			blocks[blocks.length - 1].lines.push(line);
		}
	}

	return blocks;
}

function getTopLevelKey(line: string): string | null {
	if (/^\s/.test(line)) {
		return null;
	}

	const match = /^([^:#][^:]*):/.exec(line);
	return match ? match[1].trim() : null;
}

function hasFrontmatterBlock(blocks: FrontmatterBlock[], field: RequiredField): boolean {
	return blocks.some((block) => block.key === field);
}

function hasAnyFrontmatterBlock(blocks: FrontmatterBlock[], field: string): boolean {
	return blocks.some((block) => block.key === field);
}

function requiredFieldsAreInRelativeOrder(blocks: FrontmatterBlock[]): boolean {
	let lastIndex = -1;
	for (const block of blocks) {
		if (!isRequiredField(block.key)) {
			continue;
		}

		const index = getRequiredFieldIndex(block.key);
		if (index < lastIndex) {
			return false;
		}
		lastIndex = index;
	}

	return true;
}

function getRequiredFieldIndex(field: RequiredField): number {
	return REQUIRED_FIELDS.indexOf(field);
}

function isRequiredField(key: string | null): key is RequiredField {
	return key !== null && (REQUIRED_FIELDS as readonly string[]).includes(key);
}

function isLegacyField(key: string | null): key is LegacyField {
	return key !== null && Object.prototype.hasOwnProperty.call(LEGACY_FIELD_RENAMES, key);
}

function getBlockScalar(block: FrontmatterBlock | undefined): string | null {
	if (!block) {
		return null;
	}

	const firstLine = block.lines[0];
	const colon = firstLine.indexOf(":");
	if (colon === -1) {
		return null;
	}

	const value = firstLine.slice(colon + 1).trim();
	return value.length > 0 ? value : null;
}

function formatScalarField(field: RequiredField, value: string): string {
	return value ? `${field}: ${value}` : `${field}: `;
}

function formatListValue(block: FrontmatterBlock | undefined, defaultValue: string): string[] {
	const values = getBlockListValues(block);
	if (values.length > 0) {
		return values.map((value) => `  - ${formatYamlScalar(value)}`);
	}

	const scalar = getBlockScalar(block);
	const value = scalar ?? defaultValue;
	return [`  - ${formatYamlScalar(value)}`];
}

function getBlockListValues(block: FrontmatterBlock | undefined): string[] {
	if (!block || block.lines.length <= 1) {
		return [];
	}

	const values: string[] = [];
	for (const line of block.lines.slice(1)) {
		const match = /^\s*-\s*(.*)$/.exec(line);
		if (match) {
			values.push(match[1].trim());
		}
	}
	return values;
}

function parseFrontmatter(content: string): { body: string; end: number } | null {
	if (!content.startsWith("---\n")) {
		return null;
	}

	let lineStart = 4;
	while (lineStart <= content.length) {
		const lineEnd = content.indexOf("\n", lineStart);
		const line = content.slice(lineStart, lineEnd === -1 ? content.length : lineEnd);
		if (line.trim() === "---") {
			const end = lineStart === 4 ? 4 : lineStart - 1;
			return {
				body: content.slice(4, end),
				end,
			};
		}

		if (lineEnd === -1) {
			break;
		}
		lineStart = lineEnd + 1;
	}

	return null;
}

function getSummaryDocument(file: TFile, content: string, minBodyLength: number): SummaryDocument | null {
	const frontmatter = parseFrontmatter(content);
	const body = getBodyWithoutFrontmatter(content, frontmatter);
	const trimmed = body.trim();
	if (trimmed.length < minBodyLength) {
		return null;
	}

	return {
		title: file.basename,
		frontmatter: frontmatter?.body.trim() ?? "",
		content: trimmed.slice(0, MAX_SUMMARY_CONTENT_LENGTH),
	};
}

function getBodyWithoutFrontmatter(
	content: string,
	frontmatter: { body: string; end: number } | null,
): string {
	if (frontmatter === null) {
		return content;
	}

	return content.slice(frontmatter.end).replace(/^\n?---\n?/, "");
}

function writeSummaryToContent(
	content: string,
	file: TFile,
	summary: string,
	defaults: FolderDefaultValues,
	buildFullFrontmatter: (created: string, defaults?: FolderDefaultValues) => string,
): string | null {
	const created = formatLocalDate(new Date(file.stat.ctime));
	const source = parseFrontmatter(content) === null ? buildFullFrontmatter(created, defaults) + content : content;
	const frontmatter = parseFrontmatter(source);
	if (frontmatter === null) {
		return null;
	}

	let body = migrateLegacyFrontmatterBody(frontmatter.body);
	if (!hasFrontmatterBlock(parseFrontmatterBlocks(body), "摘要")) {
		body = buildFrontmatterBodyWithMissingFields(body, ["摘要"], [], created, "", defaults);
	}

	const nextBody = replaceSummaryField(body, normalizeSummary(summary));
	const suffix = source.slice(frontmatter.end);
	const separator = suffix.startsWith("\n") ? "" : "\n";
	return `---\n${nextBody}${separator}${suffix}`;
}

function replaceSummaryField(frontmatterBody: string, summary: string): string {
	let replaced = false;
	const blocks = parseFrontmatterBlocks(frontmatterBody);
	const lines = blocks.flatMap((block) => {
		if (block.key === "摘要" && !replaced) {
			replaced = true;
			return [formatScalarField("摘要", summary)];
		}

		return block.lines;
	});
	return lines.join("\n");
}

function normalizeSummary(summary: string): string {
	return summary.replace(/\s+/g, " ").trim();
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function frontmatterAuthorContains(value: unknown, author: string): boolean {
	return normalizeCandidateValues(value).includes(author);
}

function normalizeFrontmatterScalar(value: unknown): string {
	if (typeof value === "string") {
		return value.trim();
	}
	if (value === null || value === undefined) {
		return "";
	}
	if (Array.isArray(value)) {
		return value
			.map((item) => normalizeFrontmatterScalar(item))
			.find((item) => item.length > 0) ?? "";
	}
	return String(value).trim();
}

function replacePromptToken(prompt: string, token: string, value: string): string {
	return prompt.split(token).join(value);
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => {
		window.setTimeout(resolve, ms);
	});
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

function formatScanReason(result: ScanResult): string {
	const reasons: string[] = [];
	for (const rename of result.renameFields) {
		reasons.push(`字段需重命名：${rename.from} → ${rename.to}`);
	}
	if (result.missingFields.length > 0) {
		reasons.push(`缺少：${result.missingFields.join(", ")}`);
	}
	if (result.defaultFields.length > 0) {
		reasons.push(`默认值补全：${result.defaultFields.join(", ")}`);
	}
	if (result.orderNeedsFix) {
		reasons.push("字段顺序需调整");
	}
	return reasons.join("；");
}

function findMetadataRow(container: HTMLElement, field: RequiredField): HTMLElement | null {
	const dataRow = container.querySelector<HTMLElement>(`[data-property-key="${field}"]`);
	if (dataRow !== null) {
		return (dataRow.closest(".metadata-property") as HTMLElement | null) ?? dataRow;
	}

	const propertyRows = container.querySelectorAll<HTMLElement>(".metadata-property");
	for (const row of Array.from(propertyRows)) {
		if (rowContainsFieldLabel(row, field)) {
			return row;
		}
	}

	const elements = container.querySelectorAll<HTMLElement>("*");
	for (const el of Array.from(elements)) {
		if (getElementLabel(el) === field) {
			return (el.closest(".metadata-property") as HTMLElement | null) ?? el.parentElement ?? el;
		}
	}

	return null;
}

function findMetadataValueContainer(row: HTMLElement): HTMLElement | null {
	return row.querySelector<HTMLElement>(
		".metadata-property-value, .metadata-property-value-input, .metadata-property-value-container",
	);
}

function removeEmptyHighlightClasses(el: Element) {
	el.classList.remove(
		"frontmatter-empty-highlight",
		"frontmatter-empty-1",
		"frontmatter-empty-2",
		"frontmatter-empty-3",
		"frontmatter-empty-4",
		"frontmatter-empty-5",
		"frontmatter-empty-6",
	);
}

function getDocumentOrder(a: HTMLElement, b: HTMLElement): number {
	if (a === b) {
		return 0;
	}

	const position = a.compareDocumentPosition(b);
	return position & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
}

function rowContainsFieldLabel(row: HTMLElement, field: RequiredField): boolean {
	if (getElementLabel(row) === field) {
		return true;
	}

	const labelElements = row.querySelectorAll<HTMLElement>(
		".metadata-property-key, .metadata-property-key-input, [aria-label], [title]",
	);
	for (const el of Array.from(labelElements)) {
		if (getElementLabel(el) === field) {
			return true;
		}
	}

	return false;
}

function getElementLabel(el: HTMLElement): string {
	if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
		return el.value.trim();
	}

	return (
		el.getAttribute("data-property-key") ??
		el.getAttribute("aria-label") ??
		el.getAttribute("title") ??
		el.textContent ??
		""
	).trim();
}

function isEmptyFrontmatterValue(value: unknown): boolean {
	if (value === null || value === undefined) {
		return true;
	}
	if (typeof value === "string") {
		return value.trim().length === 0;
	}
	if (Array.isArray(value)) {
		return value.length === 0 || value.every((item) => isEmptyFrontmatterValue(item));
	}

	return false;
}

function getVaultFolders(app: App): string[] {
	const folders = app.vault
		.getAllLoadedFiles()
		.filter((file): file is TFolder => file instanceof TFolder)
		.map((folder) => folder.path)
		.sort((a, b) => a.localeCompare(b));

	return ["", ...folders.filter((folder) => folder.length > 0)];
}

function shouldIncludeRuleFolder(folder: string): boolean {
	return folder.length > 0 && folder !== ".obsidian" && !folder.startsWith(".obsidian/");
}

function formatFolderOptionLabel(folder: string): string {
	if (folder === "") {
		return "/";
	}

	const depth = getFolderDepth(folder) - 1;
	const name = folder.split("/").pop() ?? folder;
	return `${"\u00A0\u00A0\u00A0\u00A0".repeat(depth)}${name}`;
}

function formatRuleInlineValue(value: string): string {
	return value.trim().length > 0 ? value : "______";
}

function toggleModalSelectPlaceholder(selectEl: HTMLSelectElement, isPlaceholder: boolean) {
	selectEl.classList.toggle("is-placeholder", isPlaceholder);
}

function getAncestorRules(folder: string, rules: FolderDefaultRule[]): FolderDefaultRule[] {
	return rules
		.filter((rule) => {
			return rule.value && shouldIncludeRuleFolder(rule.folder) && rule.folder !== folder && folderMatches(folder, rule.folder);
		})
		.sort((a, b) => {
			const depthDiff = getFolderDepth(b.folder) - getFolderDepth(a.folder);
			if (depthDiff !== 0) {
				return depthDiff;
			}
			return a.folder.localeCompare(b.folder) || a.field.localeCompare(b.field);
		});
}

function formatRuleAudit(rule: FolderDefaultRule): string {
	if (!rule.createdBy || !rule.createdAt) {
		return "创建信息不可追溯";
	}

	const created = `由 ${rule.createdBy} 创建于 ${formatAuditTime(rule.createdAt)}`;
	if (
		!rule.modifiedBy ||
		!rule.modifiedAt ||
		(rule.modifiedBy === rule.createdBy && rule.modifiedAt === rule.createdAt)
	) {
		return created;
	}

	return `${created} · ${rule.modifiedBy} 最后修改于 ${formatAuditTime(rule.modifiedAt)}`;
}

function formatAuditTime(value: string): string {
	return value.replace("T", " ").slice(0, 16);
}

function getDeviceUuid(): string {
	try {
		if (process.platform === "darwin") {
			const output = require("child_process")
				.execSync("ioreg -rd1 -c IOPlatformExpertDevice")
				.toString();
			const match = /"IOPlatformUUID"\s*=\s*"([^"]+)"/.exec(output);
			if (match) {
				return match[1];
			}
		}

		if (process.platform === "win32") {
			const output = require("child_process").execSync("wmic csproduct get UUID").toString();
			const uuid = output
				.split(/\r?\n/)
				.map((line: string) => line.trim())
				.find((line: string) => line && line.toLowerCase() !== "uuid");
			if (uuid) {
				return uuid;
			}
		}
	} catch {
		// Fall back to hostname below.
	}

	return require("os").hostname();
}

function getLegacyAuthorName(settings: AutoFrontmatterSettings): string {
	if (settings.authorMode === CUSTOM_AUTHOR_MODE) {
		return settings.authorCustom ?? "";
	}
	return settings.authorMode || settings.authorName || "";
}

function maskDeviceUuid(uuid: string): string {
	const parts = uuid.split("-");
	if (parts.length !== 5) {
		return uuid;
	}

	const last = parts[4];
	return `${parts[0]}-****-****-****-********${last.slice(-4)}`;
}

function getFrontmatterFieldCandidates(app: App, field: FolderDefaultField): string[] {
	const values = new Set<string>();
	for (const file of app.vault.getMarkdownFiles()) {
		const value = app.metadataCache.getFileCache(file)?.frontmatter?.[field];
		for (const item of normalizeCandidateValues(value)) {
			values.add(item);
		}
	}

	return Array.from(values).sort((a, b) => a.localeCompare(b));
}

function normalizeCandidateValues(value: unknown): string[] {
	if (typeof value === "string") {
		const trimmed = value.trim();
		return trimmed ? [trimmed] : [];
	}
	if (Array.isArray(value)) {
		return value.flatMap((item) => normalizeCandidateValues(item));
	}
	if (value === null || value === undefined) {
		return [];
	}
	return [String(value)];
}

function getFileFolder(path: string): string {
	const slash = path.lastIndexOf("/");
	return slash === -1 ? "" : path.slice(0, slash);
}

function folderMatches(fileFolder: string, ruleFolder: string): boolean {
	return ruleFolder === "" || fileFolder === ruleFolder || fileFolder.startsWith(`${ruleFolder}/`);
}

function getFolderDepth(folder: string): number {
	return folder === "" ? 0 : folder.split("/").length;
}

function updateFrontmatterUpdated(content: string, updated: string): string | null {
	if (!content.startsWith("---\n")) {
		return null;
	}

	const end = content.indexOf("\n---", 4);
	if (end === -1) {
		return null;
	}

	const frontmatter = content.slice(0, end + 1);
	const updatedLine = /^最后更新:\s*.*$/m;
	if (!updatedLine.test(frontmatter)) {
		return null;
	}

	const nextFrontmatter = frontmatter.replace(updatedLine, `最后更新: ${updated}`);
	return nextFrontmatter + content.slice(end + 1);
}

function formatLocalDate(date: Date): string {
	const year = date.getFullYear();
	const month = pad(date.getMonth() + 1);
	const day = pad(date.getDate());
	const hour = pad(date.getHours());
	const minute = pad(date.getMinutes());
	const second = pad(date.getSeconds());
	return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

function pad(value: number): string {
	return value.toString().padStart(2, "0");
}

function formatYamlScalar(value: string): string {
	if (!value) {
		return "";
	}

	return JSON.stringify(value);
}

function yieldToUi(): Promise<void> {
	return new Promise((resolve) => {
		window.setTimeout(resolve, 0);
	});
}
