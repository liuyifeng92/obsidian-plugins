"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const obsidian_1 = require("obsidian");
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
const DEFAULT_SETTINGS = {
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
];
const CUSTOM_AUTHOR_MODE = "自定义";
const REQUIRED_FIELDS = ["项目", "类型", "作者", "摘要", "创建时间", "最后更新"];
const HIGHLIGHT_FIELDS = ["项目", "类型", "作者", "创建时间", "最后更新"];
const FOLDER_DEFAULT_FIELDS = ["项目", "类型"];
const SETTING_TABS = ["通用", "文件夹规则", "AI摘要", "扫描仓库", "设备绑定", "版本更新"];
const GITHUB_REPO_API = "https://api.github.com/repos/liuyifeng92/obsidian-plugins/contents/auto-frontmatter";
const LEGACY_FIELD_RENAMES = {
    created: "创建时间",
    updated: "最后更新",
};
class AutoFrontmatterPlugin extends obsidian_1.Plugin {
    constructor() {
        super(...arguments);
        this.currentDeviceUuid = "";
        this.settingTab = null;
        this.updateTimer = null;
        this.updateFilePath = null;
        this.createTimers = new Set();
        this.highlightTimer = null;
        this.highlightInterval = null;
        this.highlightFilePath = null;
        this.folderCheckmarkTimer = null;
        this.aiButtonTimer = null;
        this.aiSummaryAbortController = null;
        this.aiSummaryCompletionRunning = false;
        this.lastAISummaryScheduleSlot = "";
    }
    async onload() {
        await this.loadSettings();
        this.settingTab = new AutoFrontmatterSettingTab(this.app, this);
        this.addSettingTab(this.settingTab);
        this.registerEvent(this.app.vault.on("create", (file) => {
            this.handleCreate(file);
        }));
        this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
            this.handleRename(file, oldPath);
        }));
        this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => {
            this.handleFileMenu(menu, file);
        }));
        this.registerEvent(this.app.workspace.on("editor-change", (_editor, view) => {
            this.scheduleUpdatedFieldRefresh(view.file);
        }));
        this.registerEvent(this.app.workspace.on("active-leaf-change", () => {
            this.scheduleEmptyFieldHighlightCheck();
            this.scheduleAISummaryButtonRefresh();
        }));
        this.registerEvent(this.app.workspace.on("layout-change", () => {
            this.scheduleEmptyFieldHighlightCheck();
            this.scheduleAISummaryButtonRefresh();
            this.scheduleFolderCheckmarkRefresh();
        }));
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
    async generateSummaryForFile(file) {
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
            const next = writeSummaryToContent(content, file, summary, this.getFolderDefaultValues(file), this.buildFrontmatter.bind(this));
            if (next !== null) {
                await this.app.vault.modify(file, next);
                this.triggerMetadataChanged(file);
            }
        }
        catch (error) {
            new obsidian_1.Notice(`AI 摘要生成失败：${getErrorMessage(error)}`);
        }
    }
    async generateSummaryForMetadataButton(file, onDelta, signal) {
        if (!this.settings.aiSummaryEnabled) {
            new obsidian_1.Notice("请先开启 AI 自动摘要");
            return "";
        }
        if (!this.settings.aiApiKey.trim()) {
            new obsidian_1.Notice("请先填写 AI 摘要 API Key");
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
        }
        catch (error) {
            if (signal.aborted) {
                return "";
            }
            throw error;
        }
        if (!summary) {
            throw new Error("AI 摘要返回为空");
        }
        const next = writeSummaryToContent(content, file, summary, this.getFolderDefaultValues(file), this.buildFrontmatter.bind(this));
        if (next !== null) {
            await this.app.vault.modify(file, next);
        }
        return summary;
    }
    async scanAISummaryCandidates(task, showNotice) {
        const author = this.getAISummaryAuthorForTask(showNotice);
        if (!author) {
            return [];
        }
        return await this.getAISummaryCompletionCandidates(author);
    }
    async executeAISummaryQueue(task, candidates, showNotice, onProgress) {
        if (this.isAISummaryTaskRunning(task)) {
            if (showNotice) {
                new obsidian_1.Notice("AI 摘要正在执行中");
            }
            return 0;
        }
        if (!this.getAISummaryAuthorForTask(showNotice)) {
            return 0;
        }
        return await this.processAISummaryQueue(task, candidates, showNotice, onProgress);
    }
    isAISummaryTaskRunning(task) {
        return this.aiSummaryCompletionRunning;
    }
    checkAISummarySchedule() {
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
    async runScheduledAISummaryTasks() {
        await this.runScheduledAISummaryTask("completion");
    }
    async runScheduledAISummaryTask(task) {
        if (this.isAISummaryTaskRunning(task)) {
            return;
        }
        const candidates = await this.scanAISummaryCandidates(task, false);
        if (candidates.length === 0) {
            return;
        }
        await this.processAISummaryQueue(task, candidates, false);
    }
    getAISummaryAuthorForTask(showNotice) {
        if (!this.settings.aiSummaryEnabled) {
            if (showNotice) {
                new obsidian_1.Notice("请先开启 AI 自动摘要");
            }
            return "";
        }
        if (!this.settings.aiApiKey.trim()) {
            if (showNotice) {
                new obsidian_1.Notice("请先填写 AI 摘要 API Key");
            }
            return "";
        }
        const author = this.getCurrentAuthorName();
        if (!author) {
            if (showNotice) {
                new obsidian_1.Notice("请先在「设备绑定」中绑定本机设备");
            }
            return "";
        }
        return author;
    }
    async processAISummaryQueue(task, candidates, showNotice, onProgress) {
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
                    const next = writeSummaryToContent(candidate.content, candidate.file, summary, this.getFolderDefaultValues(candidate.file), this.buildFrontmatter.bind(this));
                    if (next !== null) {
                        await this.app.vault.modify(candidate.file, next);
                        this.triggerMetadataChanged(candidate.file);
                        processedCount++;
                        candidate.done = true;
                        onProgress?.();
                    }
                    consecutiveFailures = 0;
                }
                catch (_error) {
                    consecutiveFailures++;
                    if (consecutiveFailures >= 3) {
                        new obsidian_1.Notice("AI 摘要服务异常，已暂停本次任务");
                        return processedCount;
                    }
                }
                if (index < candidates.length - 1) {
                    await delay(AI_SUMMARY_REQUEST_DELAY_MS);
                }
            }
            if (showNotice) {
                new obsidian_1.Notice(processedCount > 0
                    ? `AI 摘要：本次处理 ${processedCount} 篇文档`
                    : "AI 摘要：暂无需要处理的文档");
            }
            return processedCount;
        }
        finally {
            this.setAISummaryTaskRunning(task, false);
        }
    }
    setAISummaryTaskRunning(task, isRunning) {
        this.aiSummaryCompletionRunning = isRunning;
    }
    async getAISummaryCompletionCandidates(author) {
        const candidates = [];
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
    triggerMetadataChanged(file) {
        this.app.metadataCache.trigger("changed", file);
    }
    getAuthorName() {
        return this.settings.deviceBindings.find((binding) => binding.uuid === this.currentDeviceUuid)?.author ?? "";
    }
    ensureDeviceBound() {
        if (this.getCurrentAuthorName()) {
            return true;
        }
        new obsidian_1.Notice("请先在「设备绑定」中绑定本机设备");
        return false;
    }
    getCurrentAuthorName() {
        return this.settings.deviceBindings.find((binding) => {
            return binding.uuid === this.currentDeviceUuid && binding.author;
        })?.author ?? "";
    }
    buildFrontmatter(created, defaults = {}) {
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
    handleCreate(file) {
        if (!(file instanceof obsidian_1.TFile) || file.extension !== "md") {
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
    async handleRename(file, oldPath) {
        if (!(file instanceof obsidian_1.TFile) || file.extension !== "md") {
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
    handleFileMenu(menu, file) {
        if (!(file instanceof obsidian_1.TFolder)) {
            return;
        }
        menu.addItem((item) => {
            item.setTitle("设置属性匹配规则").onClick(() => {
                new FolderRuleModal(this.app, this, file.path).open();
            });
        });
    }
    getFolderDefaultValues(file) {
        const values = {};
        const depths = {};
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
    createFolderRule(folder = "", field = "项目", value = "") {
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
    touchFolderRule(rule) {
        rule.modifiedBy = this.getCurrentAuthorName();
        rule.modifiedAt = formatLocalDate(new Date());
    }
    async upsertFolderRule(folder, field, value) {
        const existing = this.settings.folderDefaults.find((rule) => {
            return rule.folder === folder && rule.field === field;
        });
        if (existing) {
            existing.value = value;
            this.touchFolderRule(existing);
        }
        else {
            this.settings.folderDefaults.push(this.createFolderRule(folder, field, value));
        }
        await this.saveSettings();
    }
    migrateAuthorSettings() {
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
    ensureCurrentDeviceBinding() {
        if (this.settings.deviceBindings.length > 0) {
            return;
        }
        this.settings.deviceBindings.push({
            uuid: this.currentDeviceUuid,
            author: "",
        });
    }
    migrateFolderDefaultRules() {
        const rules = [];
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
            }
            else {
                rules.push(rule);
            }
        }
        this.settings.folderDefaults = rules;
    }
    migrateAISummaryPrompt() {
        if (this.settings.aiSummaryPrompt === OLD_AI_SUMMARY_PROMPT ||
            this.settings.aiSummaryPrompt === PREVIOUS_AI_SUMMARY_PROMPT) {
            this.settings.aiSummaryPrompt = DEFAULT_AI_SUMMARY_PROMPT;
        }
    }
    async checkForUpdate() {
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
            const remoteManifest = await response.json();
            const remoteVersion = remoteManifest.version ?? "";
            if (!remoteVersion) {
                return { hasUpdate: false, version: "", error: "远端版本号无效" };
            }
            const currentVersion = this.manifest.version;
            const hasUpdate = this.compareVersions(remoteVersion, currentVersion) > 0;
            return { hasUpdate, version: remoteVersion };
        }
        catch (error) {
            return { hasUpdate: false, version: "", error: getErrorMessage(error) };
        }
    }
    async performUpdate(version, onProgress) {
        const files = ["main.js", "manifest.json", "styles.css"];
        const contents = {};
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
        new obsidian_1.Notice(`更新完成（${version}），正在重载...`);
        window.setTimeout(() => {
            // @ts-ignore — 内部 API
            this.app.commands.executeCommandById("app:reload");
        }, 1000);
    }
    compareVersions(v1, v2) {
        const parseVersion = (version) => {
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
            if (a > b)
                return 1;
            if (a < b)
                return -1;
        }
        return 0;
    }
    scheduleUpdatedFieldRefresh(file) {
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
    clearUpdateTimer() {
        if (this.updateTimer !== null) {
            window.clearTimeout(this.updateTimer);
            this.updateTimer = null;
        }
        this.updateFilePath = null;
    }
    async refreshUpdatedField(path) {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (!(file instanceof obsidian_1.TFile)) {
            return;
        }
        await this.app.vault.process(file, (content) => {
            const next = updateFrontmatterUpdated(content, formatLocalDate(new Date()));
            return next ?? content;
        });
    }
    scheduleEmptyFieldHighlightCheck() {
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
        if (!this.settings.emptyFieldHighlight ||
            !activeFile ||
            activeFile.extension !== "md") {
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
    scheduleFolderCheckmarkRefresh() {
        this.clearFolderCheckmarkTimer();
        this.folderCheckmarkTimer = window.setTimeout(() => {
            this.folderCheckmarkTimer = null;
            this.applyFolderCheckmarks();
        }, 0);
    }
    clearFolderCheckmarkTimer() {
        if (this.folderCheckmarkTimer !== null) {
            window.clearTimeout(this.folderCheckmarkTimer);
            this.folderCheckmarkTimer = null;
        }
    }
    applyFolderCheckmarks() {
        this.clearFolderCheckmarks();
        if (!this.settings.showFolderCheckmark) {
            return;
        }
        const ruleFolders = new Set(this.settings.folderDefaults
            .map((rule) => rule.folder)
            .filter((folder) => folder.length > 0));
        if (ruleFolders.size === 0) {
            return;
        }
        const folderTitles = document.querySelectorAll(".nav-folder-title");
        for (const titleEl of Array.from(folderTitles)) {
            const folderPath = titleEl.getAttribute("data-path") ??
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
    clearFolderCheckmarks() {
        document.querySelectorAll(".frontmatter-folder-check").forEach((el) => {
            el.remove();
        });
    }
    ensureHighlightInterval() {
        if (this.highlightInterval !== null) {
            return;
        }
        this.highlightInterval = window.setInterval(() => {
            this.applyEmptyFieldHighlights();
        }, 2000);
    }
    clearHighlightTimers() {
        if (this.highlightTimer !== null) {
            window.clearTimeout(this.highlightTimer);
            this.highlightTimer = null;
        }
        this.clearHighlightInterval();
    }
    clearHighlightInterval() {
        if (this.highlightInterval !== null) {
            window.clearInterval(this.highlightInterval);
            this.highlightInterval = null;
        }
    }
    applyEmptyFieldHighlights() {
        const activeFile = this.app.workspace.getActiveFile();
        if (!this.settings.emptyFieldHighlight ||
            !activeFile ||
            activeFile.extension !== "md") {
            this.clearHighlightInterval();
            this.clearEmptyFieldHighlights();
            return;
        }
        const frontmatter = this.app.metadataCache.getFileCache(activeFile)?.frontmatter ?? {};
        const emptyFields = new Set(HIGHLIGHT_FIELDS.filter((field) => isEmptyFrontmatterValue(frontmatter[field])));
        this.updateEmptyFieldHighlights(emptyFields);
    }
    updateEmptyFieldHighlights(emptyFields) {
        const containers = document.querySelectorAll(".metadata-container");
        for (const container of Array.from(containers)) {
            Array.from(container.querySelectorAll(".frontmatter-empty-highlight")).forEach((el) => {
                removeEmptyHighlightClasses(el);
            });
            const emptyRows = Array.from(emptyFields)
                .map((field) => findMetadataRow(container, field))
                .filter((row) => row !== null)
                .sort((a, b) => getDocumentOrder(a, b));
            for (let index = 0; index < emptyRows.length; index++) {
                emptyRows[index].classList.add("frontmatter-empty-highlight", `frontmatter-empty-${(index % HIGHLIGHT_FIELDS.length) + 1}`);
            }
        }
    }
    clearEmptyFieldHighlights() {
        document.querySelectorAll(".frontmatter-empty-highlight").forEach((el) => {
            removeEmptyHighlightClasses(el);
        });
    }
    scheduleAISummaryButtonRefresh() {
        this.clearAISummaryButtonTimer();
        this.abortAISummaryStream();
        this.aiButtonTimer = window.setTimeout(() => {
            this.aiButtonTimer = null;
            this.addAISummaryButton();
        }, 300);
    }
    scheduleDelayedAISummaryButtonRefresh() {
        this.clearAISummaryButtonTimer();
        this.aiButtonTimer = window.setTimeout(() => {
            this.aiButtonTimer = null;
            this.addAISummaryButton();
        }, 1000);
    }
    clearAISummaryButtonTimer() {
        if (this.aiButtonTimer !== null) {
            window.clearTimeout(this.aiButtonTimer);
            this.aiButtonTimer = null;
        }
    }
    clearAISummaryButtons() {
        document.querySelectorAll(".frontmatter-ai-summary-btn, .frontmatter-ai-summary-confirm").forEach((el) => {
            el.remove();
        });
        document.querySelectorAll(".frontmatter-ai-summary-row").forEach((el) => {
            const row = el;
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
    abortAISummaryStream() {
        this.aiSummaryAbortController?.abort();
        this.aiSummaryAbortController = null;
    }
    addAISummaryButton() {
        this.applyAISummaryButtons();
    }
    applyAISummaryButtons() {
        this.clearAISummaryButtons();
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile || activeFile.extension !== "md") {
            return;
        }
        const containers = document.querySelectorAll(".metadata-container");
        for (const container of Array.from(containers)) {
            const row = findMetadataRow(container, "摘要");
            if (!row ||
                !row.isConnected ||
                !document.contains(row) ||
                row.querySelector(".frontmatter-ai-summary-btn, .frontmatter-ai-summary-confirm")) {
                continue;
            }
            console.log("[AI摘要] 摘要行 DOM:", row.outerHTML);
            row.addClass("frontmatter-ai-summary-row");
            const valueEl = findMetadataValueContainer(row);
            const summary = normalizeFrontmatterScalar(this.app.metadataCache.getFileCache(activeFile)?.frontmatter?.["摘要"]);
            if (!summary) {
                this.showAISummaryButton(row, activeFile, "full");
            }
            else if (valueEl) {
                const rowWithHandlers = row;
                let hideTimer = null;
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
    showAISummaryButton(row, file, variant) {
        if (row.querySelector(".frontmatter-ai-summary-btn, .frontmatter-ai-summary-confirm")) {
            return;
        }
        const button = row.createEl("button", {
            cls: `frontmatter-ai-summary-btn is-${variant}`,
            attr: { "aria-label": "AI 生成摘要" },
        });
        (0, obsidian_1.setIcon)(button, "sparkles");
        if (variant === "full") {
            button.createSpan({ text: "AI摘要" });
        }
        button.onclick = (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.showAISummaryConfirm(row, file, button);
        };
    }
    hideAISummaryButton(row) {
        row.querySelector(".frontmatter-ai-summary-btn")?.remove();
    }
    showAISummaryConfirm(row, file, button) {
        button.remove();
        row.querySelector(".frontmatter-ai-summary-confirm")?.remove();
        const oldSummary = normalizeFrontmatterScalar(this.app.metadataCache.getFileCache(file)?.frontmatter?.["摘要"]);
        const confirmEl = row.createSpan({ cls: "frontmatter-ai-summary-confirm" });
        confirmEl.createSpan({
            cls: "frontmatter-ai-summary-confirm-text",
            text: oldSummary ? "✨ AI 更新？" : "✨ AI 生成？",
        });
        const acceptButton = confirmEl.createEl("button", { cls: "frontmatter-ai-summary-confirm-icon" });
        (0, obsidian_1.setIcon)(acceptButton, "check");
        const cancelButton = confirmEl.createEl("button", { cls: "frontmatter-ai-summary-confirm-icon" });
        (0, obsidian_1.setIcon)(cancelButton, "x");
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
    async runMetadataAISummary(file, row, confirmEl) {
        const valueEl = findMetadataValueContainer(row) ?? row;
        const originalValue = valueEl.textContent ?? "";
        confirmEl.remove();
        this.abortAISummaryStream();
        const controller = new AbortController();
        this.aiSummaryAbortController = controller;
        let streamedText = "";
        let finalText = originalValue;
        let didSucceed = false;
        let fallbackDotsTimer = window.setInterval(() => {
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
        }
        catch (error) {
            if (!controller.signal.aborted) {
                new obsidian_1.Notice(`AI 摘要生成失败：${getErrorMessage(error)}`);
            }
        }
        finally {
            try {
                if (fallbackDotsTimer !== null) {
                    window.clearInterval(fallbackDotsTimer);
                }
                if (this.aiSummaryAbortController === controller) {
                    this.aiSummaryAbortController = null;
                }
                if (didSucceed) {
                    new obsidian_1.Notice("AI 摘要生成成功");
                    this.scheduleDelayedAISummaryButtonRefresh();
                    return;
                }
                valueEl.removeClass("frontmatter-ai-summary-loading");
                valueEl.setText(originalValue);
                this.scheduleAISummaryButtonRefresh();
            }
            catch (cleanupError) {
                console.error("[auto-frontmatter] AI summary cleanup failed", cleanupError);
            }
        }
    }
}
exports.default = AutoFrontmatterPlugin;
class FolderRuleModal extends obsidian_1.Modal {
    constructor(app, plugin, folder) {
        super(app);
        this.plugin = plugin;
        this.folder = folder;
        this.field = "";
        this.value = "";
        this.isCustomValue = false;
        this.customValueInputEl = null;
        this.customValueBlurHandler = null;
        this.customValueKeydownHandler = null;
        this.submitButtonEl = null;
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
    render() {
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
        new obsidian_1.Setting(contentEl)
            .setName("文件夹")
            .setDesc(this.folder || "/");
        new obsidian_1.Setting(contentEl)
            .setName("字段")
            .addDropdown((dropdown) => {
            dropdown.addOption("", "未配置");
            for (const field of FOLDER_DEFAULT_FIELDS) {
                dropdown.addOption(field, field);
            }
            dropdown.setValue(this.field).onChange((value) => {
                this.field = value;
                this.value = this.findExistingValue(this.field);
                this.isCustomValue = false;
                this.updateSubmitState();
                this.render();
            });
            toggleModalSelectPlaceholder(dropdown.selectEl, !this.field);
        });
        const candidates = this.field ? getFrontmatterFieldCandidates(this.app, this.field) : [];
        const values = this.value && !candidates.includes(this.value) ? [...candidates, this.value] : candidates;
        const valueSetting = new obsidian_1.Setting(contentEl).setName("填写");
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
            }
            else {
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
        new obsidian_1.Setting(actionsEl)
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
                await this.plugin.upsertFolderRule(this.folder, this.field, this.value);
                this.plugin.refreshSettingsTab();
                new obsidian_1.Notice(`规则已保存（${this.plugin.getCurrentAuthorName()}）`);
                this.close();
            });
        });
        this.updateSubmitState();
    }
    findExistingValue(field) {
        if (!field) {
            return "";
        }
        return this.plugin.settings.folderDefaults.find((rule) => {
            return rule.folder === this.folder && rule.field === field;
        })?.value ?? "";
    }
    getInitialField() {
        const ownFields = new Set(this.plugin.settings.folderDefaults
            .filter((rule) => rule.folder === this.folder)
            .map((rule) => rule.field));
        const inheritedFields = new Set(getAncestorRules(this.folder, this.plugin.settings.folderDefaults).map((rule) => rule.field));
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
    cleanupCustomValueInput() {
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
    updateSubmitState() {
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
class AISummaryService {
    constructor(settings) {
        this.settings = settings;
    }
    async generateSummary(document) {
        return await this.callAI(this.buildPrompt(document));
    }
    async callAI(promptContent) {
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
        const data = await response.json();
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
    buildPrompt(document) {
        return replacePromptToken(replacePromptToken(replacePromptToken(this.settings.aiSummaryPrompt, "{title}", document.title), "{frontmatter}", document.frontmatter), "{content}", document.content);
    }
}
class AutoFrontmatterSettingTab extends obsidian_1.PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.activeTab = "通用";
        this.bindingCurrentDevice = false;
        this.bindingCurrentDeviceCustom = false;
        this.scanResults = [];
        this.hasScanned = false;
        this.isScanning = false;
        this.isExecuting = false;
        this.processedCount = 0;
        this.unmatchedFolders = [];
        this.hasScannedUnmatchedFolders = false;
        this.isScanningUnmatchedFolders = false;
        this.activeInlineEditorCleanup = null;
        this.aiApiKeyVisible = false;
        this.aiSummaryCompletionResults = [];
        this.hasScannedAISummaryCompletion = false;
        this.isScanningAISummaryCompletion = false;
        this.isExecutingAISummaryCompletion = false;
        this.processedAISummaryCompletionCount = 0;
        this.currentRulePage = 0;
        this.isCheckingUpdate = false;
        this.isUpdating = false;
        this.updateProgress = 0;
        this.updateResultMessage = "";
        this.latestVersion = "";
        this.plugin = plugin;
    }
    display() {
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
        }
        else if (this.activeTab === "文件夹规则") {
            this.renderFolderDefaultRules(contentEl);
        }
        else if (this.activeTab === "扫描仓库") {
            this.renderScanSection(contentEl);
        }
        else if (this.activeTab === "设备绑定") {
            this.renderDeviceBindings(contentEl);
        }
        else if (this.activeTab === "版本更新") {
            this.renderAboutSection(contentEl);
        }
        else {
            this.renderAISummarySettings(contentEl);
        }
    }
    renderTabs(containerEl) {
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
    renderGeneralSettings(containerEl) {
        this.renderRequiredFieldsInfo(containerEl);
        const highlightSettingEl = containerEl.createDiv({ cls: "auto-frontmatter-highlight-setting" });
        new obsidian_1.Setting(highlightSettingEl)
            .setName("空属性高亮提醒")
            .setDesc("打开文件时高亮提醒必需属性中的空值。")
            .addToggle((toggle) => toggle
            .setValue(this.plugin.settings.emptyFieldHighlight)
            .onChange(async (value) => {
            if (!this.plugin.ensureDeviceBound()) {
                this.display();
                return;
            }
            this.plugin.settings.emptyFieldHighlight = value;
            await this.plugin.saveSettings();
            this.plugin.refreshEmptyFieldHighlights();
        }));
    }
    renderAISummarySettings(containerEl) {
        const introEl = containerEl.createDiv({ cls: "auto-frontmatter-ai-summary-intro" });
        new obsidian_1.Setting(introEl)
            .setName("AI 自动摘要")
            .setDesc("开启后，将使用 AI 对文档内容进行摘要总结，自动填入「摘要」字段。")
            .addToggle((toggle) => toggle
            .setValue(this.plugin.settings.aiSummaryEnabled)
            .onChange(async (value) => {
            this.plugin.settings.aiSummaryEnabled = value;
            await this.plugin.saveSettings();
        }));
        containerEl.createEl("h3", { text: "模型配置" });
        new obsidian_1.Setting(containerEl)
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
        new obsidian_1.Setting(containerEl)
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
        const apiKeySetting = new obsidian_1.Setting(containerEl).setName("API Key");
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
            (0, obsidian_1.setIcon)(button.buttonEl, this.aiApiKeyVisible ? "eye-off" : "eye");
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
        new obsidian_1.Setting(promptHeaderEl).addButton((button) => {
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
    renderAISummaryTaskSection(containerEl, options) {
        const taskEl = containerEl.createDiv({ cls: "auto-frontmatter-ai-task-section" });
        taskEl.createEl("h3", { text: options.title });
        taskEl.createDiv({ cls: "auto-frontmatter-ai-task-description", text: options.description });
        const headerEl = taskEl.createDiv({ cls: "auto-frontmatter-ai-task-header" });
        headerEl.createDiv({ cls: "auto-frontmatter-ai-task-auto", text: options.autoText });
        const scanActionEl = headerEl.createDiv({ cls: "auto-frontmatter-ai-task-action" });
        new obsidian_1.Setting(scanActionEl).addButton((button) => {
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
            (0, obsidian_1.setIcon)(openButton, "external-link");
            openButton.onclick = async () => {
                await this.app.workspace.openLinkText(result.file.path, "", false);
            };
        }
        const statusText = state.processedCount === state.results.length && !state.isExecuting
            ? `完成，已处理 ${state.processedCount} 篇`
            : "";
        new obsidian_1.Setting(resultEl)
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
    getAISummaryTaskState(task) {
        return {
            results: this.aiSummaryCompletionResults,
            hasScanned: this.hasScannedAISummaryCompletion,
            isScanning: this.isScanningAISummaryCompletion,
            isExecuting: this.isExecutingAISummaryCompletion,
            processedCount: this.processedAISummaryCompletionCount,
        };
    }
    setAISummaryTaskResults(task, results) {
        this.aiSummaryCompletionResults = results;
    }
    setAISummaryTaskScanning(task, value) {
        this.isScanningAISummaryCompletion = value;
    }
    setAISummaryTaskScanned(task, value) {
        this.hasScannedAISummaryCompletion = value;
    }
    setAISummaryTaskExecuting(task, value) {
        this.isExecutingAISummaryCompletion = value;
    }
    setAISummaryTaskProcessedCount(task, value) {
        this.processedAISummaryCompletionCount = value;
    }
    async scanAISummaryTask(task) {
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
    async executeAISummaryTask(task) {
        const state = this.getAISummaryTaskState(task);
        if (state.results.length === 0) {
            new obsidian_1.Notice("AI 摘要：暂无需要处理的文档");
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
        }
        finally {
            this.setAISummaryTaskExecuting(task, false);
            this.display();
        }
    }
    renderRequiredFieldsInfo(containerEl) {
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
    renderDeviceBindings(containerEl) {
        this.renderCurrentDeviceStatus(containerEl);
        this.renderBoundDeviceList(containerEl);
    }
    renderCurrentDeviceStatus(containerEl) {
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
                new obsidian_1.Setting(actionEl).addText((text) => {
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
            }
            else {
                new obsidian_1.Setting(actionEl).addDropdown((dropdown) => {
                    dropdown.addOption("", "（请选择）");
                    for (const option of AUTHOR_OPTIONS) {
                        dropdown.addOption(option, option);
                    }
                    dropdown.onChange(async (value) => {
                        if (value === CUSTOM_AUTHOR_MODE) {
                            this.bindingCurrentDeviceCustom = true;
                            this.display();
                        }
                        else if (value) {
                            await this.bindCurrentDevice(value);
                        }
                    });
                });
            }
        }
        else {
            new obsidian_1.Setting(actionEl).addButton((button) => {
                button.setButtonText("绑定本机").setCta().onClick(() => {
                    this.bindingCurrentDevice = true;
                    this.bindingCurrentDeviceCustom = false;
                    this.display();
                });
            });
        }
    }
    renderBoundDeviceList(containerEl) {
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
    renderAboutSection(containerEl) {
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
                new obsidian_1.Notice("未找到远端仓库，请检查网络");
                this.updateResultMessage = "未找到远端仓库，请检查网络";
            }
            else if (result.error) {
                new obsidian_1.Notice(result.error);
                this.updateResultMessage = result.error;
            }
            else if (result.hasUpdate) {
                this.latestVersion = result.version;
                this.updateResultMessage = `🔄 发现新版本：${result.version}（当前 ${this.plugin.manifest.version}）`;
            }
            else {
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
                    }
                    catch (error) {
                        this.isUpdating = false;
                        new obsidian_1.Notice(`更新失败：${getErrorMessage(error)}`);
                        this.updateResultMessage = `更新失败：${getErrorMessage(error)}`;
                    }
                    this.display();
                };
            }
        }
    }
    getCurrentDeviceBinding() {
        return this.plugin.settings.deviceBindings.find((binding) => {
            return binding.uuid === this.plugin.currentDeviceUuid;
        });
    }
    async bindCurrentDevice(author) {
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
        }
        else {
            binding.author = trimmed;
        }
        this.bindingCurrentDevice = false;
        this.bindingCurrentDeviceCustom = false;
        await this.plugin.saveSettings();
        this.display();
    }
    renderFolderDefaultRules(folderRuleTabContent) {
        folderRuleTabContent.addClass("auto-frontmatter-folder-rules-tab");
        const sectionEl = folderRuleTabContent.createDiv({ cls: "auto-frontmatter-folder-rules-section" });
        const headerEl = sectionEl.createDiv({ cls: "auto-frontmatter-folder-rules-header" });
        const headerTopEl = headerEl.createDiv({ cls: "auto-frontmatter-folder-rules-header-top" });
        headerTopEl.createEl("h2", { text: "文件夹内文档属性匹配规则" });
        const addRuleEl = headerTopEl.createDiv({ cls: "auto-frontmatter-folder-rules-add-action" });
        new obsidian_1.Setting(addRuleEl).addButton((button) => {
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
        new obsidian_1.Setting(checkmarkSettingEl)
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
    renderRuleCarousel(folderRuleSectionEl, folders) {
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
        }
        else {
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
    renderRulePageButton(ruleCarouselViewportEl, direction, disabled, onClick) {
        const buttonEl = ruleCarouselViewportEl.createEl("button", {
            cls: `auto-frontmatter-rule-nav is-${direction}${disabled ? " is-disabled" : ""}`,
            attr: { "aria-label": direction === "left" ? "上一页" : "下一页" },
        });
        (0, obsidian_1.setIcon)(buttonEl, direction === "left" ? "chevron-left" : "chevron-right");
        buttonEl.disabled = disabled;
        buttonEl.onclick = onClick;
    }
    renderRuleCard(ruleGridEl, rule, ruleIndex, folders) {
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
        (0, obsidian_1.setIcon)(deleteButton, "trash-2");
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
        }
        else {
            auditEl.createDiv({ text: `由 ${rule.createdBy}` });
            auditEl.createDiv({ text: formatAuditTime(rule.createdAt) });
        }
    }
    renderRuleInlineFolderEditor(containerEl, rule, folders) {
        this.createInlineRuleVariable(containerEl, formatRuleInlineValue(rule.folder), (spanEl) => {
            this.openInlineRuleSelectEditor(spanEl, rule, rule.folder, folders.map((folder) => ({
                value: folder,
                label: formatFolderOptionLabel(folder),
            })), async (value) => {
                rule.folder = value;
            });
        });
    }
    renderRuleInlineFieldEditor(containerEl, rule) {
        this.createInlineRuleVariable(containerEl, formatRuleInlineValue(rule.field), (spanEl) => {
            this.openInlineRuleSelectEditor(spanEl, rule, rule.field, FOLDER_DEFAULT_FIELDS.map((field) => ({ value: field, label: field })), async (value) => {
                rule.field = value;
                rule.value = "";
            });
        });
    }
    renderRuleInlineValueEditor(containerEl, rule) {
        this.createInlineRuleVariable(containerEl, formatRuleInlineValue(rule.value), (spanEl) => {
            const candidates = getFrontmatterFieldCandidates(this.app, rule.field);
            const values = rule.value && !candidates.includes(rule.value) ? [...candidates, rule.value] : candidates;
            this.openInlineRuleSelectEditor(spanEl, rule, rule.value, [
                ...values.map((value) => ({ value, label: value })),
                { value: "__new__", label: "自定义" },
            ], async (value) => {
                if (value === "__new__") {
                    this.openInlineRuleInputEditor(spanEl, rule, rule.value, async (nextValue) => {
                        rule.value = nextValue;
                    });
                    return "defer";
                }
                rule.value = value;
            });
        });
    }
    createInlineRuleVariable(containerEl, text, onClick) {
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
    openInlineRuleSelectEditor(containerEl, rule, currentValue, options, onCommit) {
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
            const pickerEl = selectEl;
            try {
                if (pickerEl.showPicker) {
                    pickerEl.showPicker();
                }
                else {
                    selectEl.click();
                }
            }
            catch (_error) {
                selectEl.click();
            }
        }, 0);
    }
    openInlineRuleInputEditor(containerEl, rule, currentValue, onCommit) {
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
    createInlineDropdownCloser(overlayEl) {
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
    async saveInlineRuleChange(rule, update) {
        if (!this.plugin.ensureDeviceBound()) {
            this.display();
            return;
        }
        await update();
        this.plugin.touchFolderRule(rule);
        await this.plugin.saveSettings();
        this.display();
    }
    closeActiveInlineEditor() {
        this.activeInlineEditorCleanup?.();
        this.activeInlineEditorCleanup = null;
    }
    renderUnmatchedFolderSection(containerEl) {
        const sectionEl = containerEl.createDiv({ cls: "auto-frontmatter-unmatched-section" });
        const headerEl = sectionEl.createDiv({ cls: "auto-frontmatter-unmatched-header" });
        headerEl.createEl("h3", { text: "无匹配规则的文件夹" });
        const actionEl = headerEl.createDiv({ cls: "auto-frontmatter-unmatched-action" });
        new obsidian_1.Setting(actionEl).addButton((button) => {
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
                text: folder.inheritedRules.length > 0
                    ? `↑ 父级规则：${folder.inheritedRules
                        .map((rule) => `${rule.folder} → ${rule.field}: ${rule.value}`)
                        .join("，")}`
                    : "无任何父级规则",
            });
            const buttonEl = itemEl.createDiv({ cls: "auto-frontmatter-unmatched-button" });
            new obsidian_1.Setting(buttonEl).addButton((button) => {
                button.setButtonText("设置").onClick(() => {
                    new FolderRuleModal(this.app, this.plugin, folder.path).open();
                });
            });
        }
    }
    renderScanSection(containerEl) {
        containerEl.createEl("h2", { text: "扫描仓库" });
        new obsidian_1.Setting(containerEl)
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
        const statusText = this.processedCount === this.scanResults.length && !this.isExecuting
            ? `完成，已处理 ${this.processedCount} 个文件`
            : "";
        new obsidian_1.Setting(resultEl)
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
    async scanVault() {
        this.isScanning = true;
        this.hasScanned = true;
        this.scanResults = [];
        this.processedCount = 0;
        this.display();
        const results = [];
        const files = this.app.vault.getMarkdownFiles();
        for (let index = 0; index < files.length; index++) {
            const file = files[index];
            const content = await this.app.vault.cachedRead(file);
            const defaults = this.plugin.getFolderDefaultValues(file);
            const status = getFrontmatterStatus(content, defaults);
            if (status.missingFields.length > 0 ||
                status.orderNeedsFix ||
                status.renameFields.length > 0 ||
                status.defaultFields.length > 0) {
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
    async scanUnmatchedFolders() {
        this.hasScannedUnmatchedFolders = true;
        this.isScanningUnmatchedFolders = true;
        this.unmatchedFolders = [];
        this.display();
        const folders = getVaultFolders(this.app).filter((folder) => shouldIncludeRuleFolder(folder));
        const directRuleFolders = new Set(this.plugin.settings.folderDefaults
            .map((rule) => rule.folder)
            .filter((folder) => shouldIncludeRuleFolder(folder)));
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
    async executeScanResults() {
        this.isExecuting = true;
        this.processedCount = 0;
        this.display();
        for (let index = 0; index < this.scanResults.length; index++) {
            const result = this.scanResults[index];
            const content = await this.app.vault.read(result.file);
            const defaults = this.plugin.getFolderDefaultValues(result.file);
            const status = getFrontmatterStatus(content, defaults);
            const next = buildContentWithOrderedFields(content, result.file, status, "", defaults, this.plugin.buildFrontmatter.bind(this.plugin));
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
function hasFrontmatter(content) {
    return content.startsWith("---");
}
function getFrontmatterStatus(content, defaults = {}) {
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
function buildContentWithOrderedFields(content, file, status, authorName, defaults, buildFullFrontmatter) {
    if (status.missingFields.length === 0 &&
        !status.orderNeedsFix &&
        status.renameFields.length === 0 &&
        status.defaultFields.length === 0) {
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
        : buildFrontmatterBodyWithMissingFields(migratedBody, status.missingFields, status.defaultFields, created, authorName, defaults);
    const suffix = content.slice(frontmatter.end);
    const separator = suffix.startsWith("\n") ? "" : "\n";
    return `---\n${body}${separator}${suffix}`;
}
function buildFrontmatterBodyWithMissingFields(frontmatterBody, missingFields, defaultFields, fileCreated, authorName, defaults) {
    const blocks = parseFrontmatterBlocks(frontmatterBody);
    const lines = [];
    const inserted = new Set();
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
function getExistingCreatedValue(blocks) {
    for (const block of blocks) {
        if (block.key === "创建时间") {
            return getBlockScalar(block);
        }
    }
    return null;
}
function buildBlockLinesWithDefault(block, defaultFields, defaults) {
    if (block.key === "项目" && defaultFields.includes("项目")) {
        return [formatScalarField("项目", defaults["项目"] ?? "")];
    }
    if (block.key === "类型" && defaultFields.includes("类型")) {
        return ["类型:", ...formatListValue(undefined, defaults["类型"] ?? "")];
    }
    return block.lines;
}
function fillEmptyFolderDefaults(content, defaults) {
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
function frontmatterFieldIsEmpty(blocks, field) {
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
function buildReorderedFrontmatterBody(frontmatterBody, fileCreated, authorName, defaults) {
    const blocks = parseFrontmatterBlocks(frontmatterBody);
    const requiredBlocks = new Map();
    const customBlocks = [];
    for (const block of blocks) {
        if (isRequiredField(block.key)) {
            if (!requiredBlocks.has(block.key)) {
                requiredBlocks.set(block.key, block);
            }
            else {
                customBlocks.push(block);
            }
        }
        else if (block.lines.length > 0) {
            customBlocks.push(block);
        }
    }
    const existingCreated = getBlockScalar(requiredBlocks.get("创建时间"));
    const created = existingCreated || fileCreated;
    const lines = [];
    lines.push(...buildRequiredFieldLines("项目", requiredBlocks.get("项目"), fileCreated, authorName, defaults));
    lines.push(...buildRequiredFieldLines("类型", requiredBlocks.get("类型"), fileCreated, authorName, defaults));
    lines.push(...customBlocks.flatMap((block) => block.lines));
    lines.push(...buildRequiredFieldLines("作者", requiredBlocks.get("作者"), fileCreated, authorName, defaults));
    lines.push(...buildRequiredFieldLines("摘要", requiredBlocks.get("摘要"), fileCreated, authorName, defaults));
    lines.push(...buildRequiredFieldLines("创建时间", requiredBlocks.get("创建时间"), fileCreated, authorName, defaults));
    lines.push(...buildRequiredFieldLines("最后更新", requiredBlocks.get("最后更新"), created, authorName, defaults));
    return lines.join("\n");
}
function buildRequiredFieldLines(field, block, fileCreated, authorName, defaults = {}) {
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
function getLegacyRenames(blocks) {
    const renames = [];
    for (const legacyField of Object.keys(LEGACY_FIELD_RENAMES)) {
        if (hasAnyFrontmatterBlock(blocks, legacyField)) {
            renames.push({
                from: legacyField,
                to: LEGACY_FIELD_RENAMES[legacyField],
            });
        }
    }
    return renames;
}
function migrateLegacyFrontmatterBody(frontmatterBody) {
    return migrateLegacyBlocks(parseFrontmatterBlocks(frontmatterBody))
        .flatMap((block) => block.lines)
        .join("\n");
}
function migrateLegacyBlocks(blocks) {
    const hasNewField = new Set();
    for (const block of blocks) {
        if (isRequiredField(block.key)) {
            hasNewField.add(block.key);
        }
    }
    const migrated = [];
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
        }
        else {
            migrated.push(block);
        }
    }
    return migrated;
}
function renameBlockFirstLine(lines, key) {
    if (lines.length === 0) {
        return [];
    }
    const colon = lines[0].indexOf(":");
    const firstLine = colon === -1 ? `${key}:` : `${key}${lines[0].slice(colon)}`;
    return [firstLine, ...lines.slice(1)];
}
function parseFrontmatterBlocks(frontmatter) {
    const blocks = [];
    const lines = frontmatter.split("\n").filter((line, index, all) => {
        return index < all.length - 1 || line.length > 0;
    });
    for (const line of lines) {
        const key = getTopLevelKey(line);
        if (key !== null || blocks.length === 0) {
            blocks.push({ key, lines: [line] });
        }
        else {
            blocks[blocks.length - 1].lines.push(line);
        }
    }
    return blocks;
}
function getTopLevelKey(line) {
    if (/^\s/.test(line)) {
        return null;
    }
    const match = /^([^:#][^:]*):/.exec(line);
    return match ? match[1].trim() : null;
}
function hasFrontmatterBlock(blocks, field) {
    return blocks.some((block) => block.key === field);
}
function hasAnyFrontmatterBlock(blocks, field) {
    return blocks.some((block) => block.key === field);
}
function requiredFieldsAreInRelativeOrder(blocks) {
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
function getRequiredFieldIndex(field) {
    return REQUIRED_FIELDS.indexOf(field);
}
function isRequiredField(key) {
    return key !== null && REQUIRED_FIELDS.includes(key);
}
function isLegacyField(key) {
    return key !== null && Object.prototype.hasOwnProperty.call(LEGACY_FIELD_RENAMES, key);
}
function getBlockScalar(block) {
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
function formatScalarField(field, value) {
    return value ? `${field}: ${value}` : `${field}: `;
}
function formatListValue(block, defaultValue) {
    const values = getBlockListValues(block);
    if (values.length > 0) {
        return values.map((value) => `  - ${formatYamlScalar(value)}`);
    }
    const scalar = getBlockScalar(block);
    const value = scalar ?? defaultValue;
    return [`  - ${formatYamlScalar(value)}`];
}
function getBlockListValues(block) {
    if (!block || block.lines.length <= 1) {
        return [];
    }
    const values = [];
    for (const line of block.lines.slice(1)) {
        const match = /^\s*-\s*(.*)$/.exec(line);
        if (match) {
            values.push(match[1].trim());
        }
    }
    return values;
}
function parseFrontmatter(content) {
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
function getSummaryDocument(file, content, minBodyLength) {
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
function getBodyWithoutFrontmatter(content, frontmatter) {
    if (frontmatter === null) {
        return content;
    }
    return content.slice(frontmatter.end).replace(/^\n?---\n?/, "");
}
function writeSummaryToContent(content, file, summary, defaults, buildFullFrontmatter) {
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
function replaceSummaryField(frontmatterBody, summary) {
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
function normalizeSummary(summary) {
    return summary.replace(/\s+/g, " ").trim();
}
function getErrorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
function frontmatterAuthorContains(value, author) {
    return normalizeCandidateValues(value).includes(author);
}
function normalizeFrontmatterScalar(value) {
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
function replacePromptToken(prompt, token, value) {
    return prompt.split(token).join(value);
}
function delay(ms) {
    return new Promise((resolve) => {
        window.setTimeout(resolve, ms);
    });
}
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
function formatScanReason(result) {
    const reasons = [];
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
function findMetadataRow(container, field) {
    const dataRow = container.querySelector(`[data-property-key="${field}"]`);
    if (dataRow !== null) {
        return dataRow.closest(".metadata-property") ?? dataRow;
    }
    const propertyRows = container.querySelectorAll(".metadata-property");
    for (const row of Array.from(propertyRows)) {
        if (rowContainsFieldLabel(row, field)) {
            return row;
        }
    }
    const elements = container.querySelectorAll("*");
    for (const el of Array.from(elements)) {
        if (getElementLabel(el) === field) {
            return el.closest(".metadata-property") ?? el.parentElement ?? el;
        }
    }
    return null;
}
function findMetadataValueContainer(row) {
    return row.querySelector(".metadata-property-value, .metadata-property-value-input, .metadata-property-value-container");
}
function removeEmptyHighlightClasses(el) {
    el.classList.remove("frontmatter-empty-highlight", "frontmatter-empty-1", "frontmatter-empty-2", "frontmatter-empty-3", "frontmatter-empty-4", "frontmatter-empty-5", "frontmatter-empty-6");
}
function getDocumentOrder(a, b) {
    if (a === b) {
        return 0;
    }
    const position = a.compareDocumentPosition(b);
    return position & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
}
function rowContainsFieldLabel(row, field) {
    if (getElementLabel(row) === field) {
        return true;
    }
    const labelElements = row.querySelectorAll(".metadata-property-key, .metadata-property-key-input, [aria-label], [title]");
    for (const el of Array.from(labelElements)) {
        if (getElementLabel(el) === field) {
            return true;
        }
    }
    return false;
}
function getElementLabel(el) {
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        return el.value.trim();
    }
    return (el.getAttribute("data-property-key") ??
        el.getAttribute("aria-label") ??
        el.getAttribute("title") ??
        el.textContent ??
        "").trim();
}
function isEmptyFrontmatterValue(value) {
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
function getVaultFolders(app) {
    const folders = app.vault
        .getAllLoadedFiles()
        .filter((file) => file instanceof obsidian_1.TFolder)
        .map((folder) => folder.path)
        .sort((a, b) => a.localeCompare(b));
    return ["", ...folders.filter((folder) => folder.length > 0)];
}
function shouldIncludeRuleFolder(folder) {
    return folder.length > 0 && folder !== ".obsidian" && !folder.startsWith(".obsidian/");
}
function formatFolderOptionLabel(folder) {
    if (folder === "") {
        return "/";
    }
    const depth = getFolderDepth(folder) - 1;
    const name = folder.split("/").pop() ?? folder;
    return `${"\u00A0\u00A0\u00A0\u00A0".repeat(depth)}${name}`;
}
function formatRuleInlineValue(value) {
    return value.trim().length > 0 ? value : "______";
}
function toggleModalSelectPlaceholder(selectEl, isPlaceholder) {
    selectEl.classList.toggle("is-placeholder", isPlaceholder);
}
function getAncestorRules(folder, rules) {
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
function formatRuleAudit(rule) {
    if (!rule.createdBy || !rule.createdAt) {
        return "创建信息不可追溯";
    }
    const created = `由 ${rule.createdBy} 创建于 ${formatAuditTime(rule.createdAt)}`;
    if (!rule.modifiedBy ||
        !rule.modifiedAt ||
        (rule.modifiedBy === rule.createdBy && rule.modifiedAt === rule.createdAt)) {
        return created;
    }
    return `${created} · ${rule.modifiedBy} 最后修改于 ${formatAuditTime(rule.modifiedAt)}`;
}
function formatAuditTime(value) {
    return value.replace("T", " ").slice(0, 16);
}
function getDeviceUuid() {
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
                .map((line) => line.trim())
                .find((line) => line && line.toLowerCase() !== "uuid");
            if (uuid) {
                return uuid;
            }
        }
    }
    catch {
        // Fall back to hostname below.
    }
    return require("os").hostname();
}
function getLegacyAuthorName(settings) {
    if (settings.authorMode === CUSTOM_AUTHOR_MODE) {
        return settings.authorCustom ?? "";
    }
    return settings.authorMode || settings.authorName || "";
}
function maskDeviceUuid(uuid) {
    const parts = uuid.split("-");
    if (parts.length !== 5) {
        return uuid;
    }
    const last = parts[4];
    return `${parts[0]}-****-****-****-********${last.slice(-4)}`;
}
function getFrontmatterFieldCandidates(app, field) {
    const values = new Set();
    for (const file of app.vault.getMarkdownFiles()) {
        const value = app.metadataCache.getFileCache(file)?.frontmatter?.[field];
        for (const item of normalizeCandidateValues(value)) {
            values.add(item);
        }
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b));
}
function normalizeCandidateValues(value) {
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
function getFileFolder(path) {
    const slash = path.lastIndexOf("/");
    return slash === -1 ? "" : path.slice(0, slash);
}
function folderMatches(fileFolder, ruleFolder) {
    return ruleFolder === "" || fileFolder === ruleFolder || fileFolder.startsWith(`${ruleFolder}/`);
}
function getFolderDepth(folder) {
    return folder === "" ? 0 : folder.split("/").length;
}
function updateFrontmatterUpdated(content, updated) {
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
function formatLocalDate(date) {
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hour = pad(date.getHours());
    const minute = pad(date.getMinutes());
    const second = pad(date.getSeconds());
    return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}
function pad(value) {
    return value.toString().padStart(2, "0");
}
function formatYamlScalar(value) {
    if (!value) {
        return "";
    }
    return JSON.stringify(value);
}
function yieldToUi() {
    return new Promise((resolve) => {
        window.setTimeout(resolve, 0);
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm1haW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSx1Q0Fja0I7QUE4Q2xCLE1BQU0sMEJBQTBCLEdBQUcsS0FBSyxDQUFDO0FBQ3pDLE1BQU0sNkJBQTZCLEdBQUcsRUFBRSxHQUFHLElBQUksQ0FBQztBQUNoRCxNQUFNLDJCQUEyQixHQUFHLElBQUksQ0FBQztBQUN6QyxNQUFNLHVCQUF1QixHQUFHLEVBQUUsQ0FBQztBQUNuQyxNQUFNLGNBQWMsR0FBRyxDQUFDLENBQUM7QUFDekIsTUFBTSxxQkFBcUIsR0FBRzs7Ozs7Ozs7OztVQVVwQixDQUFDO0FBQ1gsTUFBTSwwQkFBMEIsR0FBRzs7Ozs7Ozs7Ozs7Ozs7OztVQWdCekIsQ0FBQztBQUNYLE1BQU0seUJBQXlCLEdBQUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztVQThCeEIsQ0FBQztBQUVYLE1BQU0sZ0JBQWdCLEdBQTRCO0lBQ2pELFFBQVEsRUFBRSxFQUFFO0lBQ1osUUFBUSxFQUFFLHNDQUFzQztJQUNoRCxXQUFXLEVBQUUsZ0JBQWdCO0lBQzdCLGdCQUFnQixFQUFFLElBQUk7SUFDdEIsZUFBZSxFQUFFLHlCQUF5QjtJQUMxQyxjQUFjLEVBQUUsRUFBRTtJQUNsQixtQkFBbUIsRUFBRSxJQUFJO0lBQ3pCLGNBQWMsRUFBRSxFQUFFO0lBQ2xCLG1CQUFtQixFQUFFLEtBQUs7Q0FDMUIsQ0FBQztBQUVGLE1BQU0sY0FBYyxHQUFHO0lBQ3RCLEtBQUs7SUFDTCxLQUFLO0lBQ0wsS0FBSztJQUNMLEtBQUs7SUFDTCxJQUFJO0lBQ0osS0FBSztJQUNMLEtBQUs7SUFDTCxLQUFLO0NBQ0ksQ0FBQztBQUNYLE1BQU0sa0JBQWtCLEdBQUcsS0FBSyxDQUFDO0FBRWpDLE1BQU0sZUFBZSxHQUFHLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxNQUFNLENBQVUsQ0FB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RSxDQUFDLENBQUMsQ0FBQztJQUMvQixDQUFDLENBQUMsQ0FBQztBQUNKLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge1xuXHRBcHAsXG5cdEVkaXRvcixcblx0TWVudSxcblx0TWFya2Rvd25WaWV3LFxuXHRNb2RhbCxcblx0Tm90aWNlLFxuXHRQbHVnaW4sXG5cdFBsdWdpblNldHRpbmdUYWIsXG5cdFNldHRpbmcsXG5cdHNldEljb24sXG5cdFRBYnN0cmFjdEZpbGUsXG5cdFRGaWxlLFxuXHRURm9sZGVyLFxufSBmcm9tIFwib2JzaWRpYW5cIjtcblxuaW50ZXJmYWNlIEF1dG9Gcm9udG1hdHRlclNldHRpbmdzIHtcblx0YXV0aG9yTW9kZT86IHN0cmluZztcblx0YXV0aG9yQ3VzdG9tPzogc3RyaW5nO1xuXHRhdXRob3JOYW1lPzogc3RyaW5nO1xuXHRhaUFwaUtleTogc3RyaW5nO1xuXHRhaUFwaVVybDogc3RyaW5nO1xuXHRhaU1vZGVsTmFtZTogc3RyaW5nO1xuXHRhaVN1bW1hcnlFbmFibGVkOiBib29sZWFuO1xuXHRhaVN1bW1hcnlQcm9tcHQ6IHN0cmluZztcblx0ZGV2aWNlQmluZGluZ3M6IERldmljZUF1dGhvckJpbmRpbmdbXTtcblx0ZW1wdHlGaWVsZEhpZ2hsaWdodDogYm9vbGVhbjtcblx0Zm9sZGVyRGVmYXVsdHM6IEZvbGRlckRlZmF1bHRSdWxlW107XG5cdHNob3dGb2xkZXJDaGVja21hcms6IGJvb2xlYW47XG59XG5cbmludGVyZmFjZSBTdW1tYXJ5U2VydmljZSB7XG5cdGdlbmVyYXRlU3VtbWFyeShkb2N1bWVudDogU3VtbWFyeURvY3VtZW50KTogUHJvbWlzZTxzdHJpbmc+O1xufVxuXG5pbnRlcmZhY2UgU3VtbWFyeURvY3VtZW50IHtcblx0dGl0bGU6IHN0cmluZztcblx0ZnJvbnRtYXR0ZXI6IHN0cmluZztcblx0Y29udGVudDogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgRGV2aWNlQXV0aG9yQmluZGluZyB7XG5cdHV1aWQ6IHN0cmluZztcblx0YXV0aG9yOiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBGb2xkZXJEZWZhdWx0UnVsZSB7XG5cdGZvbGRlcjogc3RyaW5nO1xuXHRmaWVsZDogRm9sZGVyRGVmYXVsdEZpZWxkO1xuXHR2YWx1ZTogc3RyaW5nO1xuXHRjcmVhdGVkQnk/OiBzdHJpbmc7XG5cdGNyZWF0ZWRBdD86IHN0cmluZztcblx0bW9kaWZpZWRCeT86IHN0cmluZztcblx0bW9kaWZpZWRBdD86IHN0cmluZztcblx0ZmllbGRzPzogQXJyYXk8e1xuXHRcdGZpZWxkOiBGb2xkZXJEZWZhdWx0RmllbGQ7XG5cdFx0dmFsdWU6IHN0cmluZztcblx0fT47XG59XG5cbmNvbnN0IE1BWF9TVU1NQVJZX0NPTlRFTlRfTEVOR1RIID0gMTYwMDA7XG5jb25zdCBBSV9TVU1NQVJZX1NDSEVEVUxFUl9DSEVDS19NUyA9IDYwICogMTAwMDtcbmNvbnN0IEFJX1NVTU1BUllfUkVRVUVTVF9ERUxBWV9NUyA9IDIwMDA7XG5jb25zdCBNSU5fU1VNTUFSWV9CT0RZX0xFTkdUSCA9IDUwO1xuY29uc3QgUlVMRVNfUEVSX1BBR0UgPSA2O1xuY29uc3QgT0xEX0FJX1NVTU1BUllfUFJPTVBUID0gYOS9oOaYr+S4gOS9jeS4k+S4mueahOaWh+aho+aRmOimgeWKqeaJi+OAguivt+WvueS7peS4i+aWh+aho+WGheWuueeUn+aIkOS4gOauteeugOa0geeahOaRmOimgeOAglxuXG7opoHmsYLvvJpcbjEuIOS4gOauteivneamguaLrO+8jOS4jei2hei/hyAxMDAg5a2XXG4yLiDmj5DngrzmoLjlv4PkuLvpopjjgIHlhbPplK7nu5PorrrmiJbkuLvopoHlhrPnrZZcbjMuIOS4jeimgeWHuueOsFwi5pys5paHXCLjgIFcIui/meevh+aWh+aho1wi562J5oyH5Luj6K+N77yM55u05o6l6ZmI6L+w5YaF5a65XG40LiDlpoLmnpzmlofmoaPljIXlkKvlm77niYfmj4/ov7DmiJbku6PnoIHniYfmrrXvvIzkvqfph43mgLvnu5PlhbbmhI/lm77ogIzpnZ7nu4boioJcbjUuIOS9v+eUqOS4juWOn+aWh+S4gOiHtOeahOivreiogO+8iOS4reaWh+aWh+aho+eUqOS4reaWh++8jOiLseaWh+aWh+aho+eUqOiLseaWh++8iVxuXG7mlofmoaPlhoXlrrnvvJpcbntjb250ZW50fWA7XG5jb25zdCBQUkVWSU9VU19BSV9TVU1NQVJZX1BST01QVCA9IGDkvaDmmK/kuIDkvY3kuJPkuJrnmoTmlofmoaPmkZjopoHliqnmiYvjgILor7fmoLnmja7ku6XkuIvmlofmoaPnmoTmoIfpopjjgIHlsZ7mgKflkozmraPmloflhoXlrrnvvIznlJ/miJDkuIDmrrXnroDmtIHnmoTkuK3mlofmkZjopoHjgIJcblxu6KaB5rGC77yaXG4xLiDkuIDmrrXor53mpoLmi6zvvIwzMCDliLAgMTQwIOWtl+S5i+mXtFxuMi4g5o+Q54K85qC45b+D5Li76aKY44CB5YWz6ZSu57uT6K665oiW5Li76KaB5Yaz562WXG4zLiDkuI3opoHlh7rnjrBcIuacrOaWh1wi44CBXCLov5nnr4fmlofmoaNcIuetieaMh+S7o+ivje+8jOebtOaOpemZiOi/sOWGheWuuVxuNC4g5aaC5p6c5paH5qGj5YyF5ZCr5Zu+54mH5o+P6L+w5oiW5Luj56CB54mH5q6177yM5L6n6YeN5oC757uT5YW25oSP5Zu+6ICM6Z2e57uG6IqCXG41LiDml6Dorrrljp/mlofmmK/ku4DkuYjor63oqIDvvIzkuIDlvovkvb/nlKjkuK3mlofovpPlh7pcblxu5paH5qGj5qCH6aKY77yaXG57dGl0bGV9XG5cbuaWh+aho+WxnuaAp++8mlxue2Zyb250bWF0dGVyfVxuXG7mlofmoaPmraPmlofvvJpcbntjb250ZW50fWA7XG5jb25zdCBERUZBVUxUX0FJX1NVTU1BUllfUFJPTVBUID0gYOivt+S4uuS7peS4i+WGheWuueWGmeS4gOauteaRmOimgeOAglxuXG7op4TliJnvvJpcbjEuIDMwIOWIsCAxNDAg5a2X77yM5LiA5q616K+d77yM5LiN5o2i6KGMXG4yLiDnlKjkuK3mloflhplcbjMuIOS7peWGheWuueacrOi6q+eahOWPo+WQu+amguaLrO+8jOWDj+aYr+i/meauteWGheWuueeahOW8gOWktOWvvOivrVxuNC4g55u05o6l6ZmI6L+w5qC45b+D5L+h5oGv77ya5YGa5LqG5LuA5LmI44CB6Kej5Yaz5LqG5LuA5LmI44CB5b6X5Ye65LqG5LuA5LmI57uT6K66XG41LiDnpoHmraLkvb/nlKjjgIzmnKzmlofjgI3jgIzor6XmlofmoaPjgI3jgIzov5nnr4fnrJTorrDjgI3jgIzkvZzogIXjgI3nrYnmjIfku6Por41cbjYuIOemgeatouS9v+eUqOOAjOS7i+e7jeS6huOAjeOAjOmYkOi/sOS6huOAjeOAjOaPj+i/sOS6huOAjeOAjOiuqOiuuuS6huOAjeOAjOaOouiuqOS6huOAjei/meexu+WFg+WPmei/sOWKqOivjVxuNy4g5aaC5p6c5YaF5a655piv5Lya6K6u57qq6KaB77yM5o+Q54K85YWz6ZSu5Yaz562W5ZKM5b6F5YqeXG44LiDlpoLmnpzlhoXlrrnmmK/mioDmnK/mlrnmoYjvvIzmj5Dngrznm67moIfjgIHmlrnmoYjopoHngrnlkozmoLjlv4PnuqbmnZ9cbjkuIOWmguaenOWGheWuueW+iOefreaIluS/oeaBr+WvhuW6puS9ju+8jOaRmOimgeWPr+S7peefreS6jiAzMCDlrZfvvIzkvYbkuI3opoHms6jmsLRcblxu5aW955qE5pGY6KaB56S65L6L77yaXG4tIOOAjOmAmui/h+aLhuWIhummluWxj+WKoOi9vei1hOa6kOW5tuW8leWFpemqqOaetuWxj++8jOWwhuWwj+aciOS6ruWGt+WQr+WKqOaXtumXtOS7jiAzLjJzIOmZjeiHsyAxLjFz77yM5ZCM5pe25L+u5aSN5LqGIGlPUyDnq6/nmb3lsY/pl6rng4Hpl67popjjgILjgI1cbi0g44CM56Gu6K6kIFEzIOWinumVv+ebruagh+S4uiBEQVUg57+75YCN77yM5Li76KaB6Lev5b6E5Li657qi5YyF6KOC5Y+YICsg5YaF5a6556S+5Yy65Ya35ZCv5Yqo77yM6aKE566X5LiK6ZmQIDUwIOS4h+OAguOAjVxuLSDjgIzmorPnkIbkuoYgT3dsZW4g5o6o6I2Q566X5rOV5LuO5Y2P5ZCM6L+H5ruk6L+B56e75Yiw5Y+M5aGU5qih5Z6L55qE5oqA5pyv6Lev5b6E77yM6YeN54K56Kej5Yaz5Ya35ZCv5Yqo5Zy65pmv5LiL55qE5Y+s5Zue546H6Zeu6aKY44CC44CNXG5cbuW3rueahOaRmOimgeekuuS+i++8iOemgeatou+8ie+8mlxuLSDinJfjgIzmnKzmlofku4vnu43kuobkuIDnp43kvJjljJblhrflkK/liqjnmoTmlrnms5UuLi7jgI3vvIjlhYPlj5nov7AgKyDmjIfku6Por43vvIlcbi0g4pyX44CM6K+l5paH5qGj6K6o6K665LqG5YWz5LqO5aKe6ZW/55uu5qCH55qE55u45YWz5YaF5a65Li4u44CN77yI5qih57OKICsg5oyH5Luj6K+N77yJXG4tIOKcl+OAjOi/meaYr+S4gOevh+WFs+S6juaOqOiNkOeul+azleeahOaKgOacr+aWh+ahoy4uLuOAje+8iOW6n+ivne+8iVxuXG4tLS1cbuagh+mimO+8mnt0aXRsZX1cblxu5bGe5oCn77yaXG57ZnJvbnRtYXR0ZXJ9XG5cbuato+aWh++8mlxue2NvbnRlbnR9YDtcblxuY29uc3QgREVGQVVMVF9TRVRUSU5HUzogQXV0b0Zyb250bWF0dGVyU2V0dGluZ3MgPSB7XG5cdGFpQXBpS2V5OiBcIlwiLFxuXHRhaUFwaVVybDogXCJodHRwczovL2FwaS5zdGVwZnVuLmNvbS9zdGVwX3BsYW4vdjFcIixcblx0YWlNb2RlbE5hbWU6IFwic3RlcC0zLjctZmxhc2hcIixcblx0YWlTdW1tYXJ5RW5hYmxlZDogdHJ1ZSxcblx0YWlTdW1tYXJ5UHJvbXB0OiBERUZBVUxUX0FJX1NVTU1BUllfUFJPTVBULFxuXHRkZXZpY2VCaW5kaW5nczogW10sXG5cdGVtcHR5RmllbGRIaWdobGlnaHQ6IHRydWUsXG5cdGZvbGRlckRlZmF1bHRzOiBbXSxcblx0c2hvd0ZvbGRlckNoZWNrbWFyazogZmFsc2UsXG59O1xuXG5jb25zdCBBVVRIT1JfT1BUSU9OUyA9IFtcblx0XCLpmYjmmZPnkKZcIixcblx0XCLokaPmgZLmlodcIixcblx0XCLliJjkuIDplItcIixcblx0XCLnjovkuprlhptcIixcblx0XCLmnajnoZVcIixcblx0XCLlkajmraPpo55cIixcblx0XCLluoTpnZblrodcIixcblx0XCLoh6rlrprkuYlcIixcbl0gYXMgY29uc3Q7XG5jb25zdCBDVVNUT01fQVVUSE9SX01PREUgPSBcIuiHquWumuS5iVwiO1xuXG5jb25zdCBSRVFVSVJFRF9GSUVMRFMgPSBbXCLpobnnm65cIiwgXCLnsbvlnotcIiwgXCLkvZzogIVcIiwgXCLmkZjopoFcIiwgXCLliJvlu7rml7bpl7RcIiwgXCLmnIDlkI7mm7TmlrBcIl0gYXMgY29uc3Q7XG50eXBlIFJlcXVpcmVkRmllbGQgPSAodHlwZW9mIFJFUVVJUkVEX0ZJRUxEUylbbnVtYmVyXTtcbmNvbnN0IEhJR0hMSUdIVF9GSUVMRFMgPSBbXCLpobnnm65cIiwgXCLnsbvlnotcIiwgXCLkvZzogIVcIiwgXCLliJvlu7rml7bpl7RcIiwgXCLmnIDlkI7mm7TmlrBcIl0gYXMgY29uc3Q7XG50eXBlIEhpZ2hsaWdodEZpZWxkID0gKHR5cGVvZiBISUdITElHSFRfRklFTERTKVtudW1iZXJdO1xuY29uc3QgRk9MREVSX0RFRkFVTFRfRklFTERTID0gW1wi6aG555uuXCIsIFwi57G75Z6LXCJdIGFzIGNvbnN0O1xudHlwZSBGb2xkZXJEZWZhdWx0RmllbGQgPSAodHlwZW9mIEZPTERFUl9ERUZBVUxUX0ZJRUxEUylbbnVtYmVyXTtcbnR5cGUgRm9sZGVyRGVmYXVsdFZhbHVlcyA9IFBhcnRpYWw8UmVjb3JkPEZvbGRlckRlZmF1bHRGaWVsZCwgc3RyaW5nPj47XG5jb25zdCBTRVRUSU5HX1RBQlMgPSBbXCLpgJrnlKhcIiwgXCLmlofku7blpLnop4TliJlcIiwgXCJBSeaRmOimgVwiLCBcIuaJq+aPj+S7k+W6k1wiLCBcIuiuvuWkh+e7keWumlwiLCBcIueJiOacrOabtOaWsFwiXSBhcyBjb25zdDtcbnR5cGUgU2V0dGluZ1RhYklkID0gKHR5cGVvZiBTRVRUSU5HX1RBQlMpW251bWJlcl07XG5jb25zdCBHSVRIVUJfUkVQT19BUEkgPSBcImh0dHBzOi8vYXBpLmdpdGh1Yi5jb20vcmVwb3MvbGl1eWlmZW5nOTIvb2JzaWRpYW4tcGx1Z2lucy9jb250ZW50cy9hdXRvLWZyb250bWF0dGVyXCI7XG50eXBlIEFJU3VtbWFyeVRhc2tUeXBlID0gXCJjb21wbGV0aW9uXCI7XG5jb25zdCBMRUdBQ1lfRklFTERfUkVOQU1FUyA9IHtcblx0Y3JlYXRlZDogXCLliJvlu7rml7bpl7RcIixcblx0dXBkYXRlZDogXCLmnIDlkI7mm7TmlrBcIixcbn0gYXMgY29uc3Q7XG50eXBlIExlZ2FjeUZpZWxkID0ga2V5b2YgdHlwZW9mIExFR0FDWV9GSUVMRF9SRU5BTUVTO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBBdXRvRnJvbnRtYXR0ZXJQbHVnaW4gZXh0ZW5kcyBQbHVnaW4ge1xuXHRzZXR0aW5nczogQXV0b0Zyb250bWF0dGVyU2V0dGluZ3M7XG5cdGN1cnJlbnREZXZpY2VVdWlkID0gXCJcIjtcblx0c2V0dGluZ1RhYjogQXV0b0Zyb250bWF0dGVyU2V0dGluZ1RhYiB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIHVwZGF0ZVRpbWVyOiBudW1iZXIgfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSB1cGRhdGVGaWxlUGF0aDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG5cdHByaXZhdGUgY3JlYXRlVGltZXJzID0gbmV3IFNldDxudW1iZXI+KCk7XG5cdHByaXZhdGUgaGlnaGxpZ2h0VGltZXI6IG51bWJlciB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIGhpZ2hsaWdodEludGVydmFsOiBudW1iZXIgfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSBoaWdobGlnaHRGaWxlUGF0aDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG5cdHByaXZhdGUgZm9sZGVyQ2hlY2ttYXJrVGltZXI6IG51bWJlciB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIGFpQnV0dG9uVGltZXI6IG51bWJlciB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIGFpU3VtbWFyeUFib3J0Q29udHJvbGxlcjogQWJvcnRDb250cm9sbGVyIHwgbnVsbCA9IG51bGw7XG5cdHByaXZhdGUgYWlTdW1tYXJ5Q29tcGxldGlvblJ1bm5pbmcgPSBmYWxzZTtcblx0cHJpdmF0ZSBsYXN0QUlTdW1tYXJ5U2NoZWR1bGVTbG90ID0gXCJcIjtcblxuXHRhc3luYyBvbmxvYWQoKSB7XG5cdFx0YXdhaXQgdGhpcy5sb2FkU2V0dGluZ3MoKTtcblxuXHRcdHRoaXMuc2V0dGluZ1RhYiA9IG5ldyBBdXRvRnJvbnRtYXR0ZXJTZXR0aW5nVGFiKHRoaXMuYXBwLCB0aGlzKTtcblx0XHR0aGlzLmFkZFNldHRpbmdUYWIodGhpcy5zZXR0aW5nVGFiKTtcblxuXHRcdHRoaXMucmVnaXN0ZXJFdmVudChcblx0XHRcdHRoaXMuYXBwLnZhdWx0Lm9uKFwiY3JlYXRlXCIsIChmaWxlKSA9PiB7XG5cdFx0XHRcdHRoaXMuaGFuZGxlQ3JlYXRlKGZpbGUpO1xuXHRcdFx0fSksXG5cdFx0KTtcblxuXHRcdHRoaXMucmVnaXN0ZXJFdmVudChcblx0XHRcdHRoaXMuYXBwLnZhdWx0Lm9uKFwicmVuYW1lXCIsIChmaWxlLCBvbGRQYXRoKSA9PiB7XG5cdFx0XHRcdHRoaXMuaGFuZGxlUmVuYW1lKGZpbGUsIG9sZFBhdGgpO1xuXHRcdFx0fSksXG5cdFx0KTtcblxuXHRcdHRoaXMucmVnaXN0ZXJFdmVudChcblx0XHRcdHRoaXMuYXBwLndvcmtzcGFjZS5vbihcImZpbGUtbWVudVwiLCAobWVudTogTWVudSwgZmlsZTogVEFic3RyYWN0RmlsZSkgPT4ge1xuXHRcdFx0XHR0aGlzLmhhbmRsZUZpbGVNZW51KG1lbnUsIGZpbGUpO1xuXHRcdFx0fSksXG5cdFx0KTtcblxuXHRcdHRoaXMucmVnaXN0ZXJFdmVudChcblx0XHRcdHRoaXMuYXBwLndvcmtzcGFjZS5vbihcImVkaXRvci1jaGFuZ2VcIiwgKF9lZGl0b3I6IEVkaXRvciwgdmlldzogTWFya2Rvd25WaWV3KSA9PiB7XG5cdFx0XHRcdHRoaXMuc2NoZWR1bGVVcGRhdGVkRmllbGRSZWZyZXNoKHZpZXcuZmlsZSk7XG5cdFx0XHR9KSxcblx0XHQpO1xuXG5cdFx0dGhpcy5yZWdpc3RlckV2ZW50KFxuXHRcdFx0dGhpcy5hcHAud29ya3NwYWNlLm9uKFwiYWN0aXZlLWxlYWYtY2hhbmdlXCIsICgpID0+IHtcblx0XHRcdFx0dGhpcy5zY2hlZHVsZUVtcHR5RmllbGRIaWdobGlnaHRDaGVjaygpO1xuXHRcdFx0XHR0aGlzLnNjaGVkdWxlQUlTdW1tYXJ5QnV0dG9uUmVmcmVzaCgpO1xuXHRcdFx0fSksXG5cdFx0KTtcblxuXHRcdHRoaXMucmVnaXN0ZXJFdmVudChcblx0XHRcdHRoaXMuYXBwLndvcmtzcGFjZS5vbihcImxheW91dC1jaGFuZ2VcIiwgKCkgPT4ge1xuXHRcdFx0XHR0aGlzLnNjaGVkdWxlRW1wdHlGaWVsZEhpZ2hsaWdodENoZWNrKCk7XG5cdFx0XHRcdHRoaXMuc2NoZWR1bGVBSVN1bW1hcnlCdXR0b25SZWZyZXNoKCk7XG5cdFx0XHRcdHRoaXMuc2NoZWR1bGVGb2xkZXJDaGVja21hcmtSZWZyZXNoKCk7XG5cdFx0XHR9KSxcblx0XHQpO1xuXG5cdFx0dGhpcy5yZWdpc3RlckludGVydmFsKHdpbmRvdy5zZXRJbnRlcnZhbCgoKSA9PiB7XG5cdFx0XHR0aGlzLmNoZWNrQUlTdW1tYXJ5U2NoZWR1bGUoKTtcblx0XHR9LCBBSV9TVU1NQVJZX1NDSEVEVUxFUl9DSEVDS19NUykpO1xuXG5cdFx0dGhpcy5zY2hlZHVsZUVtcHR5RmllbGRIaWdobGlnaHRDaGVjaygpO1xuXHRcdHRoaXMuc2NoZWR1bGVBSVN1bW1hcnlCdXR0b25SZWZyZXNoKCk7XG5cdFx0dGhpcy5zY2hlZHVsZUZvbGRlckNoZWNrbWFya1JlZnJlc2goKTtcblx0fVxuXG5cdG9udW5sb2FkKCkge1xuXHRcdHRoaXMuY2xlYXJVcGRhdGVUaW1lcigpO1xuXHRcdHRoaXMuY2xlYXJIaWdobGlnaHRUaW1lcnMoKTtcblx0XHR0aGlzLmNsZWFyRW1wdHlGaWVsZEhpZ2hsaWdodHMoKTtcblx0XHR0aGlzLmNsZWFyQUlTdW1tYXJ5QnV0dG9uVGltZXIoKTtcblx0XHR0aGlzLmNsZWFyQUlTdW1tYXJ5QnV0dG9ucygpO1xuXHRcdHRoaXMuYWJvcnRBSVN1bW1hcnlTdHJlYW0oKTtcblx0XHR0aGlzLmNsZWFyRm9sZGVyQ2hlY2ttYXJrVGltZXIoKTtcblx0XHR0aGlzLmNsZWFyRm9sZGVyQ2hlY2ttYXJrcygpO1xuXHRcdGZvciAoY29uc3QgdGltZXIgb2YgdGhpcy5jcmVhdGVUaW1lcnMpIHtcblx0XHRcdHdpbmRvdy5jbGVhclRpbWVvdXQodGltZXIpO1xuXHRcdH1cblx0XHR0aGlzLmNyZWF0ZVRpbWVycy5jbGVhcigpO1xuXHR9XG5cblx0YXN5bmMgbG9hZFNldHRpbmdzKCkge1xuXHRcdHRoaXMuY3VycmVudERldmljZVV1aWQgPSBnZXREZXZpY2VVdWlkKCk7XG5cdFx0dGhpcy5zZXR0aW5ncyA9IE9iamVjdC5hc3NpZ24oe30sIERFRkFVTFRfU0VUVElOR1MsIGF3YWl0IHRoaXMubG9hZERhdGEoKSk7XG5cdFx0dGhpcy5taWdyYXRlQXV0aG9yU2V0dGluZ3MoKTtcblx0XHR0aGlzLmVuc3VyZUN1cnJlbnREZXZpY2VCaW5kaW5nKCk7XG5cdFx0dGhpcy5taWdyYXRlRm9sZGVyRGVmYXVsdFJ1bGVzKCk7XG5cdFx0dGhpcy5taWdyYXRlQUlTdW1tYXJ5UHJvbXB0KCk7XG5cdH1cblxuXHRhc3luYyBzYXZlU2V0dGluZ3MoKSB7XG5cdFx0YXdhaXQgdGhpcy5zYXZlRGF0YSh0aGlzLnNldHRpbmdzKTtcblx0XHR0aGlzLnNjaGVkdWxlRm9sZGVyQ2hlY2ttYXJrUmVmcmVzaCgpO1xuXHR9XG5cblx0cmVmcmVzaFNldHRpbmdzVGFiKCkge1xuXHRcdHRoaXMuc2V0dGluZ1RhYj8uZGlzcGxheSgpO1xuXHR9XG5cblx0cmVmcmVzaEVtcHR5RmllbGRIaWdobGlnaHRzKCkge1xuXHRcdHRoaXMuc2NoZWR1bGVFbXB0eUZpZWxkSGlnaGxpZ2h0Q2hlY2soKTtcblx0fVxuXG5cdHJlZnJlc2hGb2xkZXJDaGVja21hcmtzKCkge1xuXHRcdHRoaXMuYXBwbHlGb2xkZXJDaGVja21hcmtzKCk7XG5cdH1cblxuXHRhc3luYyBnZW5lcmF0ZVN1bW1hcnlGb3JGaWxlKGZpbGU6IFRGaWxlKSB7XG5cdFx0aWYgKCF0aGlzLnNldHRpbmdzLmFpU3VtbWFyeUVuYWJsZWQgfHwgIXRoaXMuc2V0dGluZ3MuYWlBcGlLZXkudHJpbSgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGNvbnRlbnQgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5yZWFkKGZpbGUpO1xuXHRcdFx0Y29uc3Qgc3VtbWFyeURvY3VtZW50ID0gZ2V0U3VtbWFyeURvY3VtZW50KGZpbGUsIGNvbnRlbnQsIDEpO1xuXHRcdFx0aWYgKCFzdW1tYXJ5RG9jdW1lbnQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBzdW1tYXJ5ID0gYXdhaXQgbmV3IEFJU3VtbWFyeVNlcnZpY2UodGhpcy5zZXR0aW5ncykuZ2VuZXJhdGVTdW1tYXJ5KHN1bW1hcnlEb2N1bWVudCk7XG5cdFx0XHRpZiAoIXN1bW1hcnkpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBuZXh0ID0gd3JpdGVTdW1tYXJ5VG9Db250ZW50KFxuXHRcdFx0XHRjb250ZW50LFxuXHRcdFx0XHRmaWxlLFxuXHRcdFx0XHRzdW1tYXJ5LFxuXHRcdFx0XHR0aGlzLmdldEZvbGRlckRlZmF1bHRWYWx1ZXMoZmlsZSksXG5cdFx0XHRcdHRoaXMuYnVpbGRGcm9udG1hdHRlci5iaW5kKHRoaXMpLFxuXHRcdFx0KTtcblx0XHRcdGlmIChuZXh0ICE9PSBudWxsKSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuYXBwLnZhdWx0Lm1vZGlmeShmaWxlLCBuZXh0KTtcblx0XHRcdFx0dGhpcy50cmlnZ2VyTWV0YWRhdGFDaGFuZ2VkKGZpbGUpO1xuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRuZXcgTm90aWNlKGBBSSDmkZjopoHnlJ/miJDlpLHotKXvvJoke2dldEVycm9yTWVzc2FnZShlcnJvcil9YCk7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgZ2VuZXJhdGVTdW1tYXJ5Rm9yTWV0YWRhdGFCdXR0b24oXG5cdFx0ZmlsZTogVEZpbGUsXG5cdFx0b25EZWx0YTogKGRlbHRhOiBzdHJpbmcpID0+IHZvaWQsXG5cdFx0c2lnbmFsOiBBYm9ydFNpZ25hbCxcblx0KTogUHJvbWlzZTxzdHJpbmc+IHtcblx0XHRpZiAoIXRoaXMuc2V0dGluZ3MuYWlTdW1tYXJ5RW5hYmxlZCkge1xuXHRcdFx0bmV3IE5vdGljZShcIuivt+WFiOW8gOWQryBBSSDoh6rliqjmkZjopoFcIik7XG5cdFx0XHRyZXR1cm4gXCJcIjtcblx0XHR9XG5cdFx0aWYgKCF0aGlzLnNldHRpbmdzLmFpQXBpS2V5LnRyaW0oKSkge1xuXHRcdFx0bmV3IE5vdGljZShcIuivt+WFiOWhq+WGmSBBSSDmkZjopoEgQVBJIEtleVwiKTtcblx0XHRcdHJldHVybiBcIlwiO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNvbnRlbnQgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5yZWFkKGZpbGUpO1xuXHRcdGNvbnN0IHN1bW1hcnlEb2N1bWVudCA9IGdldFN1bW1hcnlEb2N1bWVudChmaWxlLCBjb250ZW50LCAxKTtcblx0XHRpZiAoIXN1bW1hcnlEb2N1bWVudCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwi5paH5qGj5YaF5a655Li656m677yM5peg5rOV55Sf5oiQ5pGY6KaBXCIpO1xuXHRcdH1cblxuXHRcdGxldCBzdW1tYXJ5ID0gXCJcIjtcblx0XHR0cnkge1xuXHRcdFx0c3VtbWFyeSA9IGF3YWl0IG5ldyBBSVN1bW1hcnlTZXJ2aWNlKHRoaXMuc2V0dGluZ3MpLmdlbmVyYXRlU3VtbWFyeShzdW1tYXJ5RG9jdW1lbnQpO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRpZiAoc2lnbmFsLmFib3J0ZWQpIHtcblx0XHRcdFx0cmV0dXJuIFwiXCI7XG5cdFx0XHR9XG5cdFx0XHR0aHJvdyBlcnJvcjtcblx0XHR9XG5cdFx0aWYgKCFzdW1tYXJ5KSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJBSSDmkZjopoHov5Tlm57kuLrnqbpcIik7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbmV4dCA9IHdyaXRlU3VtbWFyeVRvQ29udGVudChcblx0XHRcdGNvbnRlbnQsXG5cdFx0XHRmaWxlLFxuXHRcdFx0c3VtbWFyeSxcblx0XHRcdHRoaXMuZ2V0Rm9sZGVyRGVmYXVsdFZhbHVlcyhmaWxlKSxcblx0XHRcdHRoaXMuYnVpbGRGcm9udG1hdHRlci5iaW5kKHRoaXMpLFxuXHRcdCk7XG5cdFx0aWYgKG5leHQgIT09IG51bGwpIHtcblx0XHRcdGF3YWl0IHRoaXMuYXBwLnZhdWx0Lm1vZGlmeShmaWxlLCBuZXh0KTtcblx0XHR9XG5cdFx0cmV0dXJuIHN1bW1hcnk7XG5cdH1cblxuXHRhc3luYyBzY2FuQUlTdW1tYXJ5Q2FuZGlkYXRlcyh0YXNrOiBBSVN1bW1hcnlUYXNrVHlwZSwgc2hvd05vdGljZTogYm9vbGVhbik6IFByb21pc2U8QUlTdW1tYXJ5Q2FuZGlkYXRlW10+IHtcblx0XHRjb25zdCBhdXRob3IgPSB0aGlzLmdldEFJU3VtbWFyeUF1dGhvckZvclRhc2soc2hvd05vdGljZSk7XG5cdFx0aWYgKCFhdXRob3IpIHtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cblx0XHRyZXR1cm4gYXdhaXQgdGhpcy5nZXRBSVN1bW1hcnlDb21wbGV0aW9uQ2FuZGlkYXRlcyhhdXRob3IpO1xuXHR9XG5cblx0YXN5bmMgZXhlY3V0ZUFJU3VtbWFyeVF1ZXVlKFxuXHRcdHRhc2s6IEFJU3VtbWFyeVRhc2tUeXBlLFxuXHRcdGNhbmRpZGF0ZXM6IEFJU3VtbWFyeUNhbmRpZGF0ZVtdLFxuXHRcdHNob3dOb3RpY2U6IGJvb2xlYW4sXG5cdFx0b25Qcm9ncmVzcz86ICgpID0+IHZvaWQsXG5cdCk6IFByb21pc2U8bnVtYmVyPiB7XG5cdFx0aWYgKHRoaXMuaXNBSVN1bW1hcnlUYXNrUnVubmluZyh0YXNrKSkge1xuXHRcdFx0aWYgKHNob3dOb3RpY2UpIHtcblx0XHRcdFx0bmV3IE5vdGljZShcIkFJIOaRmOimgeato+WcqOaJp+ihjOS4rVwiKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiAwO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy5nZXRBSVN1bW1hcnlBdXRob3JGb3JUYXNrKHNob3dOb3RpY2UpKSB7XG5cdFx0XHRyZXR1cm4gMDtcblx0XHR9XG5cblx0XHRyZXR1cm4gYXdhaXQgdGhpcy5wcm9jZXNzQUlTdW1tYXJ5UXVldWUodGFzaywgY2FuZGlkYXRlcywgc2hvd05vdGljZSwgb25Qcm9ncmVzcyk7XG5cdH1cblxuXHRpc0FJU3VtbWFyeVRhc2tSdW5uaW5nKHRhc2s6IEFJU3VtbWFyeVRhc2tUeXBlKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuYWlTdW1tYXJ5Q29tcGxldGlvblJ1bm5pbmc7XG5cdH1cblxuXHRwcml2YXRlIGNoZWNrQUlTdW1tYXJ5U2NoZWR1bGUoKSB7XG5cdFx0Y29uc3Qgbm93ID0gbmV3IERhdGUoKTtcblx0XHRjb25zdCBtaW51dGUgPSBub3cuZ2V0TWludXRlcygpO1xuXHRcdGlmIChtaW51dGUgIT09IDAgJiYgbWludXRlICE9PSAzMCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHNsb3QgPSBgJHtub3cuZ2V0RnVsbFllYXIoKX0tJHtub3cuZ2V0TW9udGgoKX0tJHtub3cuZ2V0RGF0ZSgpfS0ke25vdy5nZXRIb3VycygpfS0ke21pbnV0ZX1gO1xuXHRcdGlmIChzbG90ID09PSB0aGlzLmxhc3RBSVN1bW1hcnlTY2hlZHVsZVNsb3QpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLmxhc3RBSVN1bW1hcnlTY2hlZHVsZVNsb3QgPSBzbG90O1xuXHRcdHZvaWQgdGhpcy5ydW5TY2hlZHVsZWRBSVN1bW1hcnlUYXNrcygpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBydW5TY2hlZHVsZWRBSVN1bW1hcnlUYXNrcygpIHtcblx0XHRhd2FpdCB0aGlzLnJ1blNjaGVkdWxlZEFJU3VtbWFyeVRhc2soXCJjb21wbGV0aW9uXCIpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBydW5TY2hlZHVsZWRBSVN1bW1hcnlUYXNrKHRhc2s6IEFJU3VtbWFyeVRhc2tUeXBlKSB7XG5cdFx0aWYgKHRoaXMuaXNBSVN1bW1hcnlUYXNrUnVubmluZyh0YXNrKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNhbmRpZGF0ZXMgPSBhd2FpdCB0aGlzLnNjYW5BSVN1bW1hcnlDYW5kaWRhdGVzKHRhc2ssIGZhbHNlKTtcblx0XHRpZiAoY2FuZGlkYXRlcy5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRhd2FpdCB0aGlzLnByb2Nlc3NBSVN1bW1hcnlRdWV1ZSh0YXNrLCBjYW5kaWRhdGVzLCBmYWxzZSk7XG5cdH1cblxuXHRwcml2YXRlIGdldEFJU3VtbWFyeUF1dGhvckZvclRhc2soc2hvd05vdGljZTogYm9vbGVhbik6IHN0cmluZyB7XG5cdFx0aWYgKCF0aGlzLnNldHRpbmdzLmFpU3VtbWFyeUVuYWJsZWQpIHtcblx0XHRcdGlmIChzaG93Tm90aWNlKSB7XG5cdFx0XHRcdG5ldyBOb3RpY2UoXCLor7flhYjlvIDlkK8gQUkg6Ieq5Yqo5pGY6KaBXCIpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIFwiXCI7XG5cdFx0fVxuXHRcdGlmICghdGhpcy5zZXR0aW5ncy5haUFwaUtleS50cmltKCkpIHtcblx0XHRcdGlmIChzaG93Tm90aWNlKSB7XG5cdFx0XHRcdG5ldyBOb3RpY2UoXCLor7flhYjloavlhpkgQUkg5pGY6KaBIEFQSSBLZXlcIik7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gXCJcIjtcblx0XHR9XG5cblx0XHRjb25zdCBhdXRob3IgPSB0aGlzLmdldEN1cnJlbnRBdXRob3JOYW1lKCk7XG5cdFx0aWYgKCFhdXRob3IpIHtcblx0XHRcdGlmIChzaG93Tm90aWNlKSB7XG5cdFx0XHRcdG5ldyBOb3RpY2UoXCLor7flhYjlnKjjgIzorr7lpIfnu5HlrprjgI3kuK3nu5HlrprmnKzmnLrorr7lpIdcIik7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gXCJcIjtcblx0XHR9XG5cblx0XHRyZXR1cm4gYXV0aG9yO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBwcm9jZXNzQUlTdW1tYXJ5UXVldWUoXG5cdFx0dGFzazogQUlTdW1tYXJ5VGFza1R5cGUsXG5cdFx0Y2FuZGlkYXRlczogQUlTdW1tYXJ5Q2FuZGlkYXRlW10sXG5cdFx0c2hvd05vdGljZTogYm9vbGVhbixcblx0XHRvblByb2dyZXNzPzogKCkgPT4gdm9pZCxcblx0KTogUHJvbWlzZTxudW1iZXI+IHtcblx0XHR0aGlzLnNldEFJU3VtbWFyeVRhc2tSdW5uaW5nKHRhc2ssIHRydWUpO1xuXHRcdGxldCBwcm9jZXNzZWRDb3VudCA9IDA7XG5cdFx0bGV0IGNvbnNlY3V0aXZlRmFpbHVyZXMgPSAwO1xuXG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHNlcnZpY2UgPSBuZXcgQUlTdW1tYXJ5U2VydmljZSh0aGlzLnNldHRpbmdzKTtcblx0XHRcdGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCBjYW5kaWRhdGVzLmxlbmd0aDsgaW5kZXgrKykge1xuXHRcdFx0XHRjb25zdCBjYW5kaWRhdGUgPSBjYW5kaWRhdGVzW2luZGV4XTtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRjb25zdCBzdW1tYXJ5ID0gYXdhaXQgc2VydmljZS5nZW5lcmF0ZVN1bW1hcnkoY2FuZGlkYXRlLmRvY3VtZW50KTtcblx0XHRcdFx0XHRpZiAoIXN1bW1hcnkpIHtcblx0XHRcdFx0XHRcdGlmIChpbmRleCA8IGNhbmRpZGF0ZXMubGVuZ3RoIC0gMSkge1xuXHRcdFx0XHRcdFx0XHRhd2FpdCBkZWxheShBSV9TVU1NQVJZX1JFUVVFU1RfREVMQVlfTVMpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Y29uc3QgbmV4dCA9IHdyaXRlU3VtbWFyeVRvQ29udGVudChcblx0XHRcdFx0XHRcdGNhbmRpZGF0ZS5jb250ZW50LFxuXHRcdFx0XHRcdFx0Y2FuZGlkYXRlLmZpbGUsXG5cdFx0XHRcdFx0XHRzdW1tYXJ5LFxuXHRcdFx0XHRcdFx0dGhpcy5nZXRGb2xkZXJEZWZhdWx0VmFsdWVzKGNhbmRpZGF0ZS5maWxlKSxcblx0XHRcdFx0XHRcdHRoaXMuYnVpbGRGcm9udG1hdHRlci5iaW5kKHRoaXMpLFxuXHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0aWYgKG5leHQgIT09IG51bGwpIHtcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMuYXBwLnZhdWx0Lm1vZGlmeShjYW5kaWRhdGUuZmlsZSwgbmV4dCk7XG5cdFx0XHRcdFx0XHR0aGlzLnRyaWdnZXJNZXRhZGF0YUNoYW5nZWQoY2FuZGlkYXRlLmZpbGUpO1xuXHRcdFx0XHRcdFx0cHJvY2Vzc2VkQ291bnQrKztcblx0XHRcdFx0XHRcdGNhbmRpZGF0ZS5kb25lID0gdHJ1ZTtcblx0XHRcdFx0XHRcdG9uUHJvZ3Jlc3M/LigpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRjb25zZWN1dGl2ZUZhaWx1cmVzID0gMDtcblx0XHRcdFx0fSBjYXRjaCAoX2Vycm9yKSB7XG5cdFx0XHRcdFx0Y29uc2VjdXRpdmVGYWlsdXJlcysrO1xuXHRcdFx0XHRcdGlmIChjb25zZWN1dGl2ZUZhaWx1cmVzID49IDMpIHtcblx0XHRcdFx0XHRcdG5ldyBOb3RpY2UoXCJBSSDmkZjopoHmnI3liqHlvILluLjvvIzlt7LmmoLlgZzmnKzmrKHku7vliqFcIik7XG5cdFx0XHRcdFx0XHRyZXR1cm4gcHJvY2Vzc2VkQ291bnQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGluZGV4IDwgY2FuZGlkYXRlcy5sZW5ndGggLSAxKSB7XG5cdFx0XHRcdFx0YXdhaXQgZGVsYXkoQUlfU1VNTUFSWV9SRVFVRVNUX0RFTEFZX01TKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAoc2hvd05vdGljZSkge1xuXHRcdFx0XHRuZXcgTm90aWNlKFxuXHRcdFx0XHRcdHByb2Nlc3NlZENvdW50ID4gMFxuXHRcdFx0XHRcdFx0PyBgQUkg5pGY6KaB77ya5pys5qyh5aSE55CGICR7cHJvY2Vzc2VkQ291bnR9IOevh+aWh+aho2Bcblx0XHRcdFx0XHRcdDogXCJBSSDmkZjopoHvvJrmmoLml6DpnIDopoHlpITnkIbnmoTmlofmoaNcIixcblx0XHRcdFx0KTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHByb2Nlc3NlZENvdW50O1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHR0aGlzLnNldEFJU3VtbWFyeVRhc2tSdW5uaW5nKHRhc2ssIGZhbHNlKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHNldEFJU3VtbWFyeVRhc2tSdW5uaW5nKHRhc2s6IEFJU3VtbWFyeVRhc2tUeXBlLCBpc1J1bm5pbmc6IGJvb2xlYW4pIHtcblx0XHR0aGlzLmFpU3VtbWFyeUNvbXBsZXRpb25SdW5uaW5nID0gaXNSdW5uaW5nO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBnZXRBSVN1bW1hcnlDb21wbGV0aW9uQ2FuZGlkYXRlcyhhdXRob3I6IHN0cmluZyk6IFByb21pc2U8QUlTdW1tYXJ5Q2FuZGlkYXRlW10+IHtcblx0XHRjb25zdCBjYW5kaWRhdGVzOiBBSVN1bW1hcnlDYW5kaWRhdGVbXSA9IFtdO1xuXHRcdGNvbnN0IGZpbGVzID0gdGhpcy5hcHAudmF1bHQuZ2V0TWFya2Rvd25GaWxlcygpO1xuXG5cdFx0Zm9yIChjb25zdCBmaWxlIG9mIGZpbGVzKSB7XG5cdFx0XHRjb25zdCBmcm9udG1hdHRlciA9IHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKGZpbGUpPy5mcm9udG1hdHRlciA/PyB7fTtcblx0XHRcdGlmICghZnJvbnRtYXR0ZXJBdXRob3JDb250YWlucyhmcm9udG1hdHRlcltcIuS9nOiAhVwiXSwgYXV0aG9yKSB8fCAhaXNFbXB0eUZyb250bWF0dGVyVmFsdWUoZnJvbnRtYXR0ZXJbXCLmkZjopoFcIl0pKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQuY2FjaGVkUmVhZChmaWxlKTtcblx0XHRcdGNvbnN0IGRvY3VtZW50ID0gZ2V0U3VtbWFyeURvY3VtZW50KGZpbGUsIGNvbnRlbnQsIE1JTl9TVU1NQVJZX0JPRFlfTEVOR1RIKTtcblx0XHRcdGlmICghZG9jdW1lbnQpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGNhbmRpZGF0ZXMucHVzaCh7IGZpbGUsIGNvbnRlbnQsIGRvY3VtZW50IH0pO1xuXHRcdH1cblxuXHRcdHJldHVybiBjYW5kaWRhdGVzO1xuXHR9XG5cblx0cHJpdmF0ZSB0cmlnZ2VyTWV0YWRhdGFDaGFuZ2VkKGZpbGU6IFRGaWxlKSB7XG5cdFx0KHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUgYXMgeyB0cmlnZ2VyOiAobmFtZTogc3RyaW5nLCBmaWxlOiBURmlsZSkgPT4gdm9pZCB9KS50cmlnZ2VyKFwiY2hhbmdlZFwiLCBmaWxlKTtcblx0fVxuXG5cdGdldEF1dGhvck5hbWUoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5zZXR0aW5ncy5kZXZpY2VCaW5kaW5ncy5maW5kKChiaW5kaW5nKSA9PiBiaW5kaW5nLnV1aWQgPT09IHRoaXMuY3VycmVudERldmljZVV1aWQpPy5hdXRob3IgPz8gXCJcIjtcblx0fVxuXG5cdGVuc3VyZURldmljZUJvdW5kKCk6IGJvb2xlYW4ge1xuXHRcdGlmICh0aGlzLmdldEN1cnJlbnRBdXRob3JOYW1lKCkpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdG5ldyBOb3RpY2UoXCLor7flhYjlnKjjgIzorr7lpIfnu5HlrprjgI3kuK3nu5HlrprmnKzmnLrorr7lpIdcIik7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0Z2V0Q3VycmVudEF1dGhvck5hbWUoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5zZXR0aW5ncy5kZXZpY2VCaW5kaW5ncy5maW5kKChiaW5kaW5nKSA9PiB7XG5cdFx0XHRyZXR1cm4gYmluZGluZy51dWlkID09PSB0aGlzLmN1cnJlbnREZXZpY2VVdWlkICYmIGJpbmRpbmcuYXV0aG9yO1xuXHRcdH0pPy5hdXRob3IgPz8gXCJcIjtcblx0fVxuXG5cdGJ1aWxkRnJvbnRtYXR0ZXIoY3JlYXRlZDogc3RyaW5nLCBkZWZhdWx0czogRm9sZGVyRGVmYXVsdFZhbHVlcyA9IHt9KTogc3RyaW5nIHtcblx0XHRyZXR1cm4gW1xuXHRcdFx0XCItLS1cIixcblx0XHRcdGDpobnnm646ICR7ZGVmYXVsdHNbXCLpobnnm65cIl0gPz8gXCJcIn1gLFxuXHRcdFx0XCLnsbvlnos6XCIsXG5cdFx0XHRgICAtICR7Zm9ybWF0WWFtbFNjYWxhcihkZWZhdWx0c1tcIuexu+Wei1wiXSA/PyBcIlwiKX1gLFxuXHRcdFx0XCLkvZzogIU6XCIsXG5cdFx0XHRgICAtICR7Zm9ybWF0WWFtbFNjYWxhcih0aGlzLmdldEF1dGhvck5hbWUoKSl9YCxcblx0XHRcdFwi5pGY6KaBOiBcIixcblx0XHRcdGDliJvlu7rml7bpl7Q6ICR7Y3JlYXRlZH1gLFxuXHRcdFx0YOacgOWQjuabtOaWsDogJHtjcmVhdGVkfWAsXG5cdFx0XHRcIi0tLVwiLFxuXHRcdFx0XCJcIixcblx0XHRdLmpvaW4oXCJcXG5cIik7XG5cdH1cblxuXHRwcml2YXRlIGhhbmRsZUNyZWF0ZShmaWxlOiBUQWJzdHJhY3RGaWxlKSB7XG5cdFx0aWYgKCEoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSB8fCBmaWxlLmV4dGVuc2lvbiAhPT0gXCJtZFwiKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgdGltZXIgPSB3aW5kb3cuc2V0VGltZW91dChhc3luYyAoKSA9PiB7XG5cdFx0XHR0aGlzLmNyZWF0ZVRpbWVycy5kZWxldGUodGltZXIpO1xuXG5cdFx0XHRjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZChmaWxlKTtcblx0XHRcdGlmIChjb250ZW50LnRyaW0oKS5sZW5ndGggPiAwIHx8IGhhc0Zyb250bWF0dGVyKGNvbnRlbnQpKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgY3JlYXRlZCA9IGZvcm1hdExvY2FsRGF0ZShuZXcgRGF0ZShmaWxlLnN0YXQuY3RpbWUpKTtcblx0XHRcdGF3YWl0IHRoaXMuYXBwLnZhdWx0Lm1vZGlmeShmaWxlLCB0aGlzLmJ1aWxkRnJvbnRtYXR0ZXIoY3JlYXRlZCwgdGhpcy5nZXRGb2xkZXJEZWZhdWx0VmFsdWVzKGZpbGUpKSk7XG5cdFx0fSwgMjUwKTtcblxuXHRcdHRoaXMuY3JlYXRlVGltZXJzLmFkZCh0aW1lcik7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGhhbmRsZVJlbmFtZShmaWxlOiBUQWJzdHJhY3RGaWxlLCBvbGRQYXRoOiBzdHJpbmcpIHtcblx0XHRpZiAoIShmaWxlIGluc3RhbmNlb2YgVEZpbGUpIHx8IGZpbGUuZXh0ZW5zaW9uICE9PSBcIm1kXCIpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoZ2V0RmlsZUZvbGRlcihmaWxlLnBhdGgpID09PSBnZXRGaWxlRm9sZGVyKG9sZFBhdGgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgZGVmYXVsdHMgPSB0aGlzLmdldEZvbGRlckRlZmF1bHRWYWx1ZXMoZmlsZSk7XG5cdFx0aWYgKE9iamVjdC5rZXlzKGRlZmF1bHRzKS5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRhd2FpdCB0aGlzLmFwcC52YXVsdC5wcm9jZXNzKGZpbGUsIChjb250ZW50KSA9PiB7XG5cdFx0XHRjb25zdCBuZXh0ID0gZmlsbEVtcHR5Rm9sZGVyRGVmYXVsdHMoY29udGVudCwgZGVmYXVsdHMpO1xuXHRcdFx0cmV0dXJuIG5leHQgPz8gY29udGVudDtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgaGFuZGxlRmlsZU1lbnUobWVudTogTWVudSwgZmlsZTogVEFic3RyYWN0RmlsZSkge1xuXHRcdGlmICghKGZpbGUgaW5zdGFuY2VvZiBURm9sZGVyKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdG1lbnUuYWRkSXRlbSgoaXRlbSkgPT4ge1xuXHRcdFx0aXRlbS5zZXRUaXRsZShcIuiuvue9ruWxnuaAp+WMuemFjeinhOWImVwiKS5vbkNsaWNrKCgpID0+IHtcblx0XHRcdFx0bmV3IEZvbGRlclJ1bGVNb2RhbCh0aGlzLmFwcCwgdGhpcywgZmlsZS5wYXRoKS5vcGVuKCk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fVxuXG5cdGdldEZvbGRlckRlZmF1bHRWYWx1ZXMoZmlsZTogVEZpbGUpOiBGb2xkZXJEZWZhdWx0VmFsdWVzIHtcblx0XHRjb25zdCB2YWx1ZXM6IEZvbGRlckRlZmF1bHRWYWx1ZXMgPSB7fTtcblx0XHRjb25zdCBkZXB0aHM6IFBhcnRpYWw8UmVjb3JkPEZvbGRlckRlZmF1bHRGaWVsZCwgbnVtYmVyPj4gPSB7fTtcblx0XHRjb25zdCBmaWxlRm9sZGVyID0gZ2V0RmlsZUZvbGRlcihmaWxlLnBhdGgpO1xuXG5cdFx0Zm9yIChjb25zdCBydWxlIG9mIHRoaXMuc2V0dGluZ3MuZm9sZGVyRGVmYXVsdHMpIHtcblx0XHRcdGlmICghcnVsZS52YWx1ZSB8fCAhZm9sZGVyTWF0Y2hlcyhmaWxlRm9sZGVyLCBydWxlLmZvbGRlcikpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGRlcHRoID0gZ2V0Rm9sZGVyRGVwdGgocnVsZS5mb2xkZXIpO1xuXHRcdFx0aWYgKGRlcHRoID49IChkZXB0aHNbcnVsZS5maWVsZF0gPz8gLTEpKSB7XG5cdFx0XHRcdHZhbHVlc1tydWxlLmZpZWxkXSA9IHJ1bGUudmFsdWU7XG5cdFx0XHRcdGRlcHRoc1tydWxlLmZpZWxkXSA9IGRlcHRoO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB2YWx1ZXM7XG5cdH1cblxuXHRjcmVhdGVGb2xkZXJSdWxlKGZvbGRlciA9IFwiXCIsIGZpZWxkOiBGb2xkZXJEZWZhdWx0RmllbGQgPSBcIumhueebrlwiLCB2YWx1ZSA9IFwiXCIpOiBGb2xkZXJEZWZhdWx0UnVsZSB7XG5cdFx0Y29uc3Qgbm93ID0gZm9ybWF0TG9jYWxEYXRlKG5ldyBEYXRlKCkpO1xuXHRcdGNvbnN0IGF1dGhvciA9IHRoaXMuZ2V0Q3VycmVudEF1dGhvck5hbWUoKTtcblx0XHRyZXR1cm4ge1xuXHRcdFx0Zm9sZGVyLFxuXHRcdFx0ZmllbGQsXG5cdFx0XHR2YWx1ZSxcblx0XHRcdGNyZWF0ZWRCeTogYXV0aG9yLFxuXHRcdFx0Y3JlYXRlZEF0OiBub3csXG5cdFx0XHRtb2RpZmllZEJ5OiBhdXRob3IsXG5cdFx0XHRtb2RpZmllZEF0OiBub3csXG5cdFx0fTtcblx0fVxuXG5cdHRvdWNoRm9sZGVyUnVsZShydWxlOiBGb2xkZXJEZWZhdWx0UnVsZSkge1xuXHRcdHJ1bGUubW9kaWZpZWRCeSA9IHRoaXMuZ2V0Q3VycmVudEF1dGhvck5hbWUoKTtcblx0XHRydWxlLm1vZGlmaWVkQXQgPSBmb3JtYXRMb2NhbERhdGUobmV3IERhdGUoKSk7XG5cdH1cblxuXHRhc3luYyB1cHNlcnRGb2xkZXJSdWxlKGZvbGRlcjogc3RyaW5nLCBmaWVsZDogRm9sZGVyRGVmYXVsdEZpZWxkLCB2YWx1ZTogc3RyaW5nKSB7XG5cdFx0Y29uc3QgZXhpc3RpbmcgPSB0aGlzLnNldHRpbmdzLmZvbGRlckRlZmF1bHRzLmZpbmQoKHJ1bGUpID0+IHtcblx0XHRcdHJldHVybiBydWxlLmZvbGRlciA9PT0gZm9sZGVyICYmIHJ1bGUuZmllbGQgPT09IGZpZWxkO1xuXHRcdH0pO1xuXG5cdFx0aWYgKGV4aXN0aW5nKSB7XG5cdFx0XHRleGlzdGluZy52YWx1ZSA9IHZhbHVlO1xuXHRcdFx0dGhpcy50b3VjaEZvbGRlclJ1bGUoZXhpc3RpbmcpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnNldHRpbmdzLmZvbGRlckRlZmF1bHRzLnB1c2godGhpcy5jcmVhdGVGb2xkZXJSdWxlKGZvbGRlciwgZmllbGQsIHZhbHVlKSk7XG5cdFx0fVxuXG5cdFx0YXdhaXQgdGhpcy5zYXZlU2V0dGluZ3MoKTtcblx0fVxuXG5cdHByaXZhdGUgbWlncmF0ZUF1dGhvclNldHRpbmdzKCkge1xuXHRcdGlmICh0aGlzLnNldHRpbmdzLmRldmljZUJpbmRpbmdzLmxlbmd0aCA+IDApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBhdXRob3IgPSBnZXRMZWdhY3lBdXRob3JOYW1lKHRoaXMuc2V0dGluZ3MpO1xuXHRcdGlmIChhdXRob3IpIHtcblx0XHRcdHRoaXMuc2V0dGluZ3MuZGV2aWNlQmluZGluZ3MucHVzaCh7XG5cdFx0XHRcdHV1aWQ6IHRoaXMuY3VycmVudERldmljZVV1aWQsXG5cdFx0XHRcdGF1dGhvcixcblx0XHRcdH0pO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZW5zdXJlQ3VycmVudERldmljZUJpbmRpbmcoKSB7XG5cdFx0aWYgKHRoaXMuc2V0dGluZ3MuZGV2aWNlQmluZGluZ3MubGVuZ3RoID4gMCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuc2V0dGluZ3MuZGV2aWNlQmluZGluZ3MucHVzaCh7XG5cdFx0XHR1dWlkOiB0aGlzLmN1cnJlbnREZXZpY2VVdWlkLFxuXHRcdFx0YXV0aG9yOiBcIlwiLFxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBtaWdyYXRlRm9sZGVyRGVmYXVsdFJ1bGVzKCkge1xuXHRcdGNvbnN0IHJ1bGVzOiBGb2xkZXJEZWZhdWx0UnVsZVtdID0gW107XG5cdFx0Zm9yIChjb25zdCBydWxlIG9mIHRoaXMuc2V0dGluZ3MuZm9sZGVyRGVmYXVsdHMpIHtcblx0XHRcdGlmIChydWxlLmZpZWxkcykge1xuXHRcdFx0XHRmb3IgKGNvbnN0IGZpZWxkU2V0dGluZyBvZiBydWxlLmZpZWxkcykge1xuXHRcdFx0XHRcdHJ1bGVzLnB1c2goe1xuXHRcdFx0XHRcdFx0Zm9sZGVyOiBydWxlLmZvbGRlcixcblx0XHRcdFx0XHRcdGZpZWxkOiBmaWVsZFNldHRpbmcuZmllbGQsXG5cdFx0XHRcdFx0XHR2YWx1ZTogZmllbGRTZXR0aW5nLnZhbHVlLFxuXHRcdFx0XHRcdFx0Y3JlYXRlZEJ5OiBydWxlLmNyZWF0ZWRCeSxcblx0XHRcdFx0XHRcdGNyZWF0ZWRBdDogcnVsZS5jcmVhdGVkQXQsXG5cdFx0XHRcdFx0XHRtb2RpZmllZEJ5OiBydWxlLm1vZGlmaWVkQnksXG5cdFx0XHRcdFx0XHRtb2RpZmllZEF0OiBydWxlLm1vZGlmaWVkQXQsXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJ1bGVzLnB1c2gocnVsZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHRoaXMuc2V0dGluZ3MuZm9sZGVyRGVmYXVsdHMgPSBydWxlcztcblx0fVxuXG5cdHByaXZhdGUgbWlncmF0ZUFJU3VtbWFyeVByb21wdCgpIHtcblx0XHRpZiAoXG5cdFx0XHR0aGlzLnNldHRpbmdzLmFpU3VtbWFyeVByb21wdCA9PT0gT0xEX0FJX1NVTU1BUllfUFJPTVBUIHx8XG5cdFx0XHR0aGlzLnNldHRpbmdzLmFpU3VtbWFyeVByb21wdCA9PT0gUFJFVklPVVNfQUlfU1VNTUFSWV9QUk9NUFRcblx0XHQpIHtcblx0XHRcdHRoaXMuc2V0dGluZ3MuYWlTdW1tYXJ5UHJvbXB0ID0gREVGQVVMVF9BSV9TVU1NQVJZX1BST01QVDtcblx0XHR9XG5cdH1cblxuXHRhc3luYyBjaGVja0ZvclVwZGF0ZSgpOiBQcm9taXNlPHsgaGFzVXBkYXRlOiBib29sZWFuOyB2ZXJzaW9uOiBzdHJpbmc7IGVycm9yPzogc3RyaW5nIH0+IHtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChgJHtHSVRIVUJfUkVQT19BUEl9L21hbmlmZXN0Lmpzb25gLCB7XG5cdFx0XHRcdGhlYWRlcnM6IHtcblx0XHRcdFx0XHRBY2NlcHQ6IFwiYXBwbGljYXRpb24vdm5kLmdpdGh1Yi52My5yYXdcIixcblx0XHRcdFx0fSxcblx0XHRcdH0pO1xuXG5cdFx0XHRpZiAocmVzcG9uc2Uuc3RhdHVzID09PSA0MDQpIHtcblx0XHRcdFx0cmV0dXJuIHsgaGFzVXBkYXRlOiBmYWxzZSwgdmVyc2lvbjogXCJcIiwgZXJyb3I6IFwibm90X2ZvdW5kXCIgfTtcblx0XHRcdH1cblx0XHRcdGlmICghcmVzcG9uc2Uub2spIHtcblx0XHRcdFx0cmV0dXJuIHsgaGFzVXBkYXRlOiBmYWxzZSwgdmVyc2lvbjogXCJcIiwgZXJyb3I6IGDor7fmsYLlpLHotKXvvJoke3Jlc3BvbnNlLnN0YXR1c31gIH07XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHJlbW90ZU1hbmlmZXN0ID0gYXdhaXQgcmVzcG9uc2UuanNvbigpIGFzIHsgdmVyc2lvbj86IHN0cmluZyB9O1xuXHRcdFx0Y29uc3QgcmVtb3RlVmVyc2lvbiA9IHJlbW90ZU1hbmlmZXN0LnZlcnNpb24gPz8gXCJcIjtcblx0XHRcdGlmICghcmVtb3RlVmVyc2lvbikge1xuXHRcdFx0XHRyZXR1cm4geyBoYXNVcGRhdGU6IGZhbHNlLCB2ZXJzaW9uOiBcIlwiLCBlcnJvcjogXCLov5znq6/niYjmnKzlj7fml6DmlYhcIiB9O1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBjdXJyZW50VmVyc2lvbiA9IHRoaXMubWFuaWZlc3QudmVyc2lvbjtcblx0XHRcdGNvbnN0IGhhc1VwZGF0ZSA9IHRoaXMuY29tcGFyZVZlcnNpb25zKHJlbW90ZVZlcnNpb24sIGN1cnJlbnRWZXJzaW9uKSA+IDA7XG5cdFx0XHRyZXR1cm4geyBoYXNVcGRhdGUsIHZlcnNpb246IHJlbW90ZVZlcnNpb24gfTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0cmV0dXJuIHsgaGFzVXBkYXRlOiBmYWxzZSwgdmVyc2lvbjogXCJcIiwgZXJyb3I6IGdldEVycm9yTWVzc2FnZShlcnJvcikgfTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyBwZXJmb3JtVXBkYXRlKHZlcnNpb246IHN0cmluZywgb25Qcm9ncmVzcz86IChzdGVwOiBudW1iZXIsIHRvdGFsOiBudW1iZXIpID0+IHZvaWQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBmaWxlcyA9IFtcIm1haW4uanNcIiwgXCJtYW5pZmVzdC5qc29uXCIsIFwic3R5bGVzLmNzc1wiXSBhcyBjb25zdDtcblx0XHRjb25zdCBjb250ZW50czogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9O1xuXG5cdFx0Zm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IGZpbGVzLmxlbmd0aDsgaW5kZXgrKykge1xuXHRcdFx0Y29uc3QgZmlsZSA9IGZpbGVzW2luZGV4XTtcblx0XHRcdGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goYCR7R0lUSFVCX1JFUE9fQVBJfS8ke2ZpbGV9YCwge1xuXHRcdFx0XHRoZWFkZXJzOiB7XG5cdFx0XHRcdFx0QWNjZXB0OiBcImFwcGxpY2F0aW9uL3ZuZC5naXRodWIudjMucmF3XCIsXG5cdFx0XHRcdH0sXG5cdFx0XHR9KTtcblx0XHRcdGlmICghcmVzcG9uc2Uub2spIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGDkuIvovb0gJHtmaWxlfSDlpLHotKXvvJoke3Jlc3BvbnNlLnN0YXR1c31gKTtcblx0XHRcdH1cblx0XHRcdGNvbnRlbnRzW2ZpbGVdID0gYXdhaXQgcmVzcG9uc2UudGV4dCgpO1xuXHRcdFx0b25Qcm9ncmVzcz8uKGluZGV4ICsgMSwgZmlsZXMubGVuZ3RoKTtcblx0XHR9XG5cblx0XHRjb25zdCBwbHVnaW5EaXIgPSB0aGlzLm1hbmlmZXN0LmRpcjtcblx0XHRpZiAoIXBsdWdpbkRpcikge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwi5peg5rOV6I635Y+W5o+S5Lu255uu5b2VXCIpO1xuXHRcdH1cblxuXHRcdGF3YWl0IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIud3JpdGUoYCR7cGx1Z2luRGlyfS9tYWluLmpzYCwgY29udGVudHNbXCJtYWluLmpzXCJdKTtcblx0XHRhd2FpdCB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLndyaXRlKGAke3BsdWdpbkRpcn0vbWFuaWZlc3QuanNvbmAsIGNvbnRlbnRzW1wibWFuaWZlc3QuanNvblwiXSk7XG5cdFx0YXdhaXQgdGhpcy5hcHAudmF1bHQuYWRhcHRlci53cml0ZShgJHtwbHVnaW5EaXJ9L3N0eWxlcy5jc3NgLCBjb250ZW50c1tcInN0eWxlcy5jc3NcIl0pO1xuXG5cdFx0bmV3IE5vdGljZShg5pu05paw5a6M5oiQ77yIJHt2ZXJzaW9ufe+8ie+8jOato+WcqOmHjei9vS4uLmApO1xuXG5cdFx0d2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0Ly8gQHRzLWlnbm9yZSDigJQg5YaF6YOoIEFQSVxuXHRcdFx0dGhpcy5hcHAuY29tbWFuZHMuZXhlY3V0ZUNvbW1hbmRCeUlkKFwiYXBwOnJlbG9hZFwiKTtcblx0XHR9LCAxMDAwKTtcblx0fVxuXG5cdHByaXZhdGUgY29tcGFyZVZlcnNpb25zKHYxOiBzdHJpbmcsIHYyOiBzdHJpbmcpOiBudW1iZXIge1xuXHRcdGNvbnN0IHBhcnNlVmVyc2lvbiA9ICh2ZXJzaW9uOiBzdHJpbmcpOiBudW1iZXJbXSA9PiB7XG5cdFx0XHRyZXR1cm4gdmVyc2lvblxuXHRcdFx0XHQucmVwbGFjZSgvXnYvLCBcIlwiKVxuXHRcdFx0XHQuc3BsaXQoXCIuXCIpXG5cdFx0XHRcdC5tYXAoKHBhcnQpID0+IHtcblx0XHRcdFx0XHRjb25zdCBtYXRjaCA9IC9eXFxkKy8uZXhlYyhwYXJ0KTtcblx0XHRcdFx0XHRyZXR1cm4gbWF0Y2ggPyBwYXJzZUludChtYXRjaFswXSwgMTApIDogMDtcblx0XHRcdFx0fSk7XG5cdFx0fTtcblxuXHRcdGNvbnN0IHBhcnRzMSA9IHBhcnNlVmVyc2lvbih2MSk7XG5cdFx0Y29uc3QgcGFydHMyID0gcGFyc2VWZXJzaW9uKHYyKTtcblx0XHRjb25zdCBtYXhMZW5ndGggPSBNYXRoLm1heChwYXJ0czEubGVuZ3RoLCBwYXJ0czIubGVuZ3RoKTtcblxuXHRcdGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCBtYXhMZW5ndGg7IGluZGV4KyspIHtcblx0XHRcdGNvbnN0IGEgPSBwYXJ0czFbaW5kZXhdID8/IDA7XG5cdFx0XHRjb25zdCBiID0gcGFydHMyW2luZGV4XSA/PyAwO1xuXHRcdFx0aWYgKGEgPiBiKSByZXR1cm4gMTtcblx0XHRcdGlmIChhIDwgYikgcmV0dXJuIC0xO1xuXHRcdH1cblx0XHRyZXR1cm4gMDtcblx0fVxuXG5cdHByaXZhdGUgc2NoZWR1bGVVcGRhdGVkRmllbGRSZWZyZXNoKGZpbGU6IFRGaWxlIHwgbnVsbCkge1xuXHRcdHRoaXMuY2xlYXJVcGRhdGVUaW1lcigpO1xuXG5cdFx0aWYgKCFmaWxlIHx8IGZpbGUuZXh0ZW5zaW9uICE9PSBcIm1kXCIpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLnVwZGF0ZUZpbGVQYXRoID0gZmlsZS5wYXRoO1xuXHRcdHRoaXMudXBkYXRlVGltZXIgPSB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHRjb25zdCBhY3RpdmVGaWxlID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKTtcblx0XHRcdGlmICghYWN0aXZlRmlsZSB8fCBhY3RpdmVGaWxlLnBhdGggIT09IHRoaXMudXBkYXRlRmlsZVBhdGgpIHtcblx0XHRcdFx0dGhpcy5jbGVhclVwZGF0ZVRpbWVyKCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgcGF0aCA9IHRoaXMudXBkYXRlRmlsZVBhdGg7XG5cdFx0XHR0aGlzLmNsZWFyVXBkYXRlVGltZXIoKTtcblx0XHRcdHRoaXMucmVmcmVzaFVwZGF0ZWRGaWVsZChwYXRoKTtcblx0XHR9LCA1MDAwKTtcblx0fVxuXG5cdHByaXZhdGUgY2xlYXJVcGRhdGVUaW1lcigpIHtcblx0XHRpZiAodGhpcy51cGRhdGVUaW1lciAhPT0gbnVsbCkge1xuXHRcdFx0d2luZG93LmNsZWFyVGltZW91dCh0aGlzLnVwZGF0ZVRpbWVyKTtcblx0XHRcdHRoaXMudXBkYXRlVGltZXIgPSBudWxsO1xuXHRcdH1cblx0XHR0aGlzLnVwZGF0ZUZpbGVQYXRoID0gbnVsbDtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcmVmcmVzaFVwZGF0ZWRGaWVsZChwYXRoOiBzdHJpbmcpIHtcblx0XHRjb25zdCBmaWxlID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKHBhdGgpO1xuXHRcdGlmICghKGZpbGUgaW5zdGFuY2VvZiBURmlsZSkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRhd2FpdCB0aGlzLmFwcC52YXVsdC5wcm9jZXNzKGZpbGUsIChjb250ZW50KSA9PiB7XG5cdFx0XHRjb25zdCBuZXh0ID0gdXBkYXRlRnJvbnRtYXR0ZXJVcGRhdGVkKGNvbnRlbnQsIGZvcm1hdExvY2FsRGF0ZShuZXcgRGF0ZSgpKSk7XG5cdFx0XHRyZXR1cm4gbmV4dCA/PyBjb250ZW50O1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBzY2hlZHVsZUVtcHR5RmllbGRIaWdobGlnaHRDaGVjaygpIHtcblx0XHRpZiAodGhpcy5oaWdobGlnaHRUaW1lciAhPT0gbnVsbCkge1xuXHRcdFx0d2luZG93LmNsZWFyVGltZW91dCh0aGlzLmhpZ2hsaWdodFRpbWVyKTtcblx0XHRcdHRoaXMuaGlnaGxpZ2h0VGltZXIgPSBudWxsO1xuXHRcdH1cblxuXHRcdGNvbnN0IGFjdGl2ZUZpbGUgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlRmlsZSgpO1xuXHRcdGNvbnN0IGFjdGl2ZVBhdGggPSBhY3RpdmVGaWxlPy5wYXRoID8/IG51bGw7XG5cdFx0aWYgKHRoaXMuaGlnaGxpZ2h0RmlsZVBhdGggIT09IGFjdGl2ZVBhdGgpIHtcblx0XHRcdHRoaXMuY2xlYXJFbXB0eUZpZWxkSGlnaGxpZ2h0cygpO1xuXHRcdFx0dGhpcy5jbGVhckhpZ2hsaWdodEludGVydmFsKCk7XG5cdFx0XHR0aGlzLmhpZ2hsaWdodEZpbGVQYXRoID0gYWN0aXZlUGF0aDtcblx0XHR9XG5cblx0XHRpZiAoXG5cdFx0XHQhdGhpcy5zZXR0aW5ncy5lbXB0eUZpZWxkSGlnaGxpZ2h0IHx8XG5cdFx0XHQhYWN0aXZlRmlsZSB8fFxuXHRcdFx0YWN0aXZlRmlsZS5leHRlbnNpb24gIT09IFwibWRcIlxuXHRcdCkge1xuXHRcdFx0dGhpcy5jbGVhckhpZ2hsaWdodEludGVydmFsKCk7XG5cdFx0XHR0aGlzLmNsZWFyRW1wdHlGaWVsZEhpZ2hsaWdodHMoKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLmhpZ2hsaWdodFRpbWVyID0gd2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0dGhpcy5oaWdobGlnaHRUaW1lciA9IG51bGw7XG5cdFx0XHR0aGlzLmFwcGx5RW1wdHlGaWVsZEhpZ2hsaWdodHMoKTtcblx0XHRcdHRoaXMuZW5zdXJlSGlnaGxpZ2h0SW50ZXJ2YWwoKTtcblx0XHR9LCAzMDApO1xuXHR9XG5cblx0cHJpdmF0ZSBzY2hlZHVsZUZvbGRlckNoZWNrbWFya1JlZnJlc2goKSB7XG5cdFx0dGhpcy5jbGVhckZvbGRlckNoZWNrbWFya1RpbWVyKCk7XG5cdFx0dGhpcy5mb2xkZXJDaGVja21hcmtUaW1lciA9IHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdHRoaXMuZm9sZGVyQ2hlY2ttYXJrVGltZXIgPSBudWxsO1xuXHRcdFx0dGhpcy5hcHBseUZvbGRlckNoZWNrbWFya3MoKTtcblx0XHR9LCAwKTtcblx0fVxuXG5cdHByaXZhdGUgY2xlYXJGb2xkZXJDaGVja21hcmtUaW1lcigpIHtcblx0XHRpZiAodGhpcy5mb2xkZXJDaGVja21hcmtUaW1lciAhPT0gbnVsbCkge1xuXHRcdFx0d2luZG93LmNsZWFyVGltZW91dCh0aGlzLmZvbGRlckNoZWNrbWFya1RpbWVyKTtcblx0XHRcdHRoaXMuZm9sZGVyQ2hlY2ttYXJrVGltZXIgPSBudWxsO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXBwbHlGb2xkZXJDaGVja21hcmtzKCkge1xuXHRcdHRoaXMuY2xlYXJGb2xkZXJDaGVja21hcmtzKCk7XG5cdFx0aWYgKCF0aGlzLnNldHRpbmdzLnNob3dGb2xkZXJDaGVja21hcmspIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBydWxlRm9sZGVycyA9IG5ldyBTZXQoXG5cdFx0XHR0aGlzLnNldHRpbmdzLmZvbGRlckRlZmF1bHRzXG5cdFx0XHRcdC5tYXAoKHJ1bGUpID0+IHJ1bGUuZm9sZGVyKVxuXHRcdFx0XHQuZmlsdGVyKChmb2xkZXIpID0+IGZvbGRlci5sZW5ndGggPiAwKSxcblx0XHQpO1xuXHRcdGlmIChydWxlRm9sZGVycy5zaXplID09PSAwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgZm9sZGVyVGl0bGVzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbDxIVE1MRWxlbWVudD4oXCIubmF2LWZvbGRlci10aXRsZVwiKTtcblx0XHRmb3IgKGNvbnN0IHRpdGxlRWwgb2YgQXJyYXkuZnJvbShmb2xkZXJUaXRsZXMpKSB7XG5cdFx0XHRjb25zdCBmb2xkZXJQYXRoID1cblx0XHRcdFx0dGl0bGVFbC5nZXRBdHRyaWJ1dGUoXCJkYXRhLXBhdGhcIikgPz9cblx0XHRcdFx0dGl0bGVFbC5jbG9zZXN0KFwiLm5hdi1mb2xkZXJcIik/LmdldEF0dHJpYnV0ZShcImRhdGEtcGF0aFwiKSA/P1xuXHRcdFx0XHRcIlwiO1xuXHRcdFx0aWYgKCFydWxlRm9sZGVycy5oYXMoZm9sZGVyUGF0aCkpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdHRpdGxlRWwuY3JlYXRlU3Bhbih7XG5cdFx0XHRcdGNsczogXCJmcm9udG1hdHRlci1mb2xkZXItY2hlY2tcIixcblx0XHRcdFx0dGV4dDogXCLinJNcIixcblx0XHRcdH0pO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgY2xlYXJGb2xkZXJDaGVja21hcmtzKCkge1xuXHRcdGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCIuZnJvbnRtYXR0ZXItZm9sZGVyLWNoZWNrXCIpLmZvckVhY2goKGVsKSA9PiB7XG5cdFx0XHRlbC5yZW1vdmUoKTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgZW5zdXJlSGlnaGxpZ2h0SW50ZXJ2YWwoKSB7XG5cdFx0aWYgKHRoaXMuaGlnaGxpZ2h0SW50ZXJ2YWwgIT09IG51bGwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLmhpZ2hsaWdodEludGVydmFsID0gd2luZG93LnNldEludGVydmFsKCgpID0+IHtcblx0XHRcdHRoaXMuYXBwbHlFbXB0eUZpZWxkSGlnaGxpZ2h0cygpO1xuXHRcdH0sIDIwMDApO1xuXHR9XG5cblx0cHJpdmF0ZSBjbGVhckhpZ2hsaWdodFRpbWVycygpIHtcblx0XHRpZiAodGhpcy5oaWdobGlnaHRUaW1lciAhPT0gbnVsbCkge1xuXHRcdFx0d2luZG93LmNsZWFyVGltZW91dCh0aGlzLmhpZ2hsaWdodFRpbWVyKTtcblx0XHRcdHRoaXMuaGlnaGxpZ2h0VGltZXIgPSBudWxsO1xuXHRcdH1cblx0XHR0aGlzLmNsZWFySGlnaGxpZ2h0SW50ZXJ2YWwoKTtcblx0fVxuXG5cdHByaXZhdGUgY2xlYXJIaWdobGlnaHRJbnRlcnZhbCgpIHtcblx0XHRpZiAodGhpcy5oaWdobGlnaHRJbnRlcnZhbCAhPT0gbnVsbCkge1xuXHRcdFx0d2luZG93LmNsZWFySW50ZXJ2YWwodGhpcy5oaWdobGlnaHRJbnRlcnZhbCk7XG5cdFx0XHR0aGlzLmhpZ2hsaWdodEludGVydmFsID0gbnVsbDtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFwcGx5RW1wdHlGaWVsZEhpZ2hsaWdodHMoKSB7XG5cdFx0Y29uc3QgYWN0aXZlRmlsZSA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVGaWxlKCk7XG5cdFx0aWYgKFxuXHRcdFx0IXRoaXMuc2V0dGluZ3MuZW1wdHlGaWVsZEhpZ2hsaWdodCB8fFxuXHRcdFx0IWFjdGl2ZUZpbGUgfHxcblx0XHRcdGFjdGl2ZUZpbGUuZXh0ZW5zaW9uICE9PSBcIm1kXCJcblx0XHQpIHtcblx0XHRcdHRoaXMuY2xlYXJIaWdobGlnaHRJbnRlcnZhbCgpO1xuXHRcdFx0dGhpcy5jbGVhckVtcHR5RmllbGRIaWdobGlnaHRzKCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgZnJvbnRtYXR0ZXIgPSB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShhY3RpdmVGaWxlKT8uZnJvbnRtYXR0ZXIgPz8ge307XG5cdFx0Y29uc3QgZW1wdHlGaWVsZHMgPSBuZXcgU2V0KFxuXHRcdFx0SElHSExJR0hUX0ZJRUxEUy5maWx0ZXIoKGZpZWxkKSA9PiBpc0VtcHR5RnJvbnRtYXR0ZXJWYWx1ZShmcm9udG1hdHRlcltmaWVsZF0pKSxcblx0XHQpO1xuXHRcdHRoaXMudXBkYXRlRW1wdHlGaWVsZEhpZ2hsaWdodHMoZW1wdHlGaWVsZHMpO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVFbXB0eUZpZWxkSGlnaGxpZ2h0cyhlbXB0eUZpZWxkczogU2V0PEhpZ2hsaWdodEZpZWxkPikge1xuXHRcdGNvbnN0IGNvbnRhaW5lcnMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50PihcIi5tZXRhZGF0YS1jb250YWluZXJcIik7XG5cdFx0Zm9yIChjb25zdCBjb250YWluZXIgb2YgQXJyYXkuZnJvbShjb250YWluZXJzKSkge1xuXHRcdFx0QXJyYXkuZnJvbShjb250YWluZXIucXVlcnlTZWxlY3RvckFsbChcIi5mcm9udG1hdHRlci1lbXB0eS1oaWdobGlnaHRcIikpLmZvckVhY2goKGVsKSA9PiB7XG5cdFx0XHRcdHJlbW92ZUVtcHR5SGlnaGxpZ2h0Q2xhc3NlcyhlbCk7XG5cdFx0XHR9KTtcblxuXHRcdFx0Y29uc3QgZW1wdHlSb3dzID0gQXJyYXkuZnJvbShlbXB0eUZpZWxkcylcblx0XHRcdFx0Lm1hcCgoZmllbGQpID0+IGZpbmRNZXRhZGF0YVJvdyhjb250YWluZXIsIGZpZWxkKSlcblx0XHRcdFx0LmZpbHRlcigocm93KTogcm93IGlzIEhUTUxFbGVtZW50ID0+IHJvdyAhPT0gbnVsbClcblx0XHRcdFx0LnNvcnQoKGEsIGIpID0+IGdldERvY3VtZW50T3JkZXIoYSwgYikpO1xuXG5cdFx0XHRmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgZW1wdHlSb3dzLmxlbmd0aDsgaW5kZXgrKykge1xuXHRcdFx0XHRlbXB0eVJvd3NbaW5kZXhdLmNsYXNzTGlzdC5hZGQoXG5cdFx0XHRcdFx0XCJmcm9udG1hdHRlci1lbXB0eS1oaWdobGlnaHRcIixcblx0XHRcdFx0XHRgZnJvbnRtYXR0ZXItZW1wdHktJHsoaW5kZXggJSBISUdITElHSFRfRklFTERTLmxlbmd0aCkgKyAxfWAsXG5cdFx0XHRcdCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBjbGVhckVtcHR5RmllbGRIaWdobGlnaHRzKCkge1xuXHRcdGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCIuZnJvbnRtYXR0ZXItZW1wdHktaGlnaGxpZ2h0XCIpLmZvckVhY2goKGVsKSA9PiB7XG5cdFx0XHRyZW1vdmVFbXB0eUhpZ2hsaWdodENsYXNzZXMoZWwpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBzY2hlZHVsZUFJU3VtbWFyeUJ1dHRvblJlZnJlc2goKSB7XG5cdFx0dGhpcy5jbGVhckFJU3VtbWFyeUJ1dHRvblRpbWVyKCk7XG5cdFx0dGhpcy5hYm9ydEFJU3VtbWFyeVN0cmVhbSgpO1xuXHRcdHRoaXMuYWlCdXR0b25UaW1lciA9IHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdHRoaXMuYWlCdXR0b25UaW1lciA9IG51bGw7XG5cdFx0XHR0aGlzLmFkZEFJU3VtbWFyeUJ1dHRvbigpO1xuXHRcdH0sIDMwMCk7XG5cdH1cblxuXHRwcml2YXRlIHNjaGVkdWxlRGVsYXllZEFJU3VtbWFyeUJ1dHRvblJlZnJlc2goKSB7XG5cdFx0dGhpcy5jbGVhckFJU3VtbWFyeUJ1dHRvblRpbWVyKCk7XG5cdFx0dGhpcy5haUJ1dHRvblRpbWVyID0gd2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0dGhpcy5haUJ1dHRvblRpbWVyID0gbnVsbDtcblx0XHRcdHRoaXMuYWRkQUlTdW1tYXJ5QnV0dG9uKCk7XG5cdFx0fSwgMTAwMCk7XG5cdH1cblxuXHRwcml2YXRlIGNsZWFyQUlTdW1tYXJ5QnV0dG9uVGltZXIoKSB7XG5cdFx0aWYgKHRoaXMuYWlCdXR0b25UaW1lciAhPT0gbnVsbCkge1xuXHRcdFx0d2luZG93LmNsZWFyVGltZW91dCh0aGlzLmFpQnV0dG9uVGltZXIpO1xuXHRcdFx0dGhpcy5haUJ1dHRvblRpbWVyID0gbnVsbDtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGNsZWFyQUlTdW1tYXJ5QnV0dG9ucygpIHtcblx0XHRkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiLmZyb250bWF0dGVyLWFpLXN1bW1hcnktYnRuLCAuZnJvbnRtYXR0ZXItYWktc3VtbWFyeS1jb25maXJtXCIpLmZvckVhY2goKGVsKSA9PiB7XG5cdFx0XHRlbC5yZW1vdmUoKTtcblx0XHR9KTtcblx0XHRkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiLmZyb250bWF0dGVyLWFpLXN1bW1hcnktcm93XCIpLmZvckVhY2goKGVsKSA9PiB7XG5cdFx0XHRjb25zdCByb3cgPSBlbCBhcyBIVE1MRWxlbWVudCAmIHtcblx0XHRcdFx0ZnJvbnRtYXR0ZXJBaUZvY3VzSGFuZGxlcj86IEV2ZW50TGlzdGVuZXI7XG5cdFx0XHRcdGZyb250bWF0dGVyQWlCbHVySGFuZGxlcj86IEV2ZW50TGlzdGVuZXI7XG5cdFx0XHR9O1xuXHRcdFx0Y29uc3QgdmFsdWVFbCA9IGZpbmRNZXRhZGF0YVZhbHVlQ29udGFpbmVyKHJvdyk7XG5cdFx0XHRpZiAodmFsdWVFbCAmJiByb3cuZnJvbnRtYXR0ZXJBaUZvY3VzSGFuZGxlcikge1xuXHRcdFx0XHR2YWx1ZUVsLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJmb2N1c2luXCIsIHJvdy5mcm9udG1hdHRlckFpRm9jdXNIYW5kbGVyKTtcblx0XHRcdH1cblx0XHRcdGlmICh2YWx1ZUVsICYmIHJvdy5mcm9udG1hdHRlckFpQmx1ckhhbmRsZXIpIHtcblx0XHRcdFx0dmFsdWVFbC5yZW1vdmVFdmVudExpc3RlbmVyKFwiZm9jdXNvdXRcIiwgcm93LmZyb250bWF0dGVyQWlCbHVySGFuZGxlcik7XG5cdFx0XHR9XG5cdFx0XHRkZWxldGUgcm93LmZyb250bWF0dGVyQWlGb2N1c0hhbmRsZXI7XG5cdFx0XHRkZWxldGUgcm93LmZyb250bWF0dGVyQWlCbHVySGFuZGxlcjtcblx0XHR9KTtcblx0XHRkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiLmZyb250bWF0dGVyLWFpLXN1bW1hcnktcm93XCIpLmZvckVhY2goKGVsKSA9PiB7XG5cdFx0XHRlbC5jbGFzc0xpc3QucmVtb3ZlKFwiZnJvbnRtYXR0ZXItYWktc3VtbWFyeS1yb3dcIik7XG5cdFx0fSk7XG5cdFx0ZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChcIi5mcm9udG1hdHRlci1haS1zdW1tYXJ5LWxvYWRpbmdcIikuZm9yRWFjaCgoZWwpID0+IHtcblx0XHRcdGVsLmNsYXNzTGlzdC5yZW1vdmUoXCJmcm9udG1hdHRlci1haS1zdW1tYXJ5LWxvYWRpbmdcIik7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGFib3J0QUlTdW1tYXJ5U3RyZWFtKCkge1xuXHRcdHRoaXMuYWlTdW1tYXJ5QWJvcnRDb250cm9sbGVyPy5hYm9ydCgpO1xuXHRcdHRoaXMuYWlTdW1tYXJ5QWJvcnRDb250cm9sbGVyID0gbnVsbDtcblx0fVxuXG5cdHByaXZhdGUgYWRkQUlTdW1tYXJ5QnV0dG9uKCkge1xuXHRcdHRoaXMuYXBwbHlBSVN1bW1hcnlCdXR0b25zKCk7XG5cdH1cblxuXHRwcml2YXRlIGFwcGx5QUlTdW1tYXJ5QnV0dG9ucygpIHtcblx0XHR0aGlzLmNsZWFyQUlTdW1tYXJ5QnV0dG9ucygpO1xuXHRcdGNvbnN0IGFjdGl2ZUZpbGUgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlRmlsZSgpO1xuXHRcdGlmICghYWN0aXZlRmlsZSB8fCBhY3RpdmVGaWxlLmV4dGVuc2lvbiAhPT0gXCJtZFwiKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgY29udGFpbmVycyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTEVsZW1lbnQ+KFwiLm1ldGFkYXRhLWNvbnRhaW5lclwiKTtcblx0XHRmb3IgKGNvbnN0IGNvbnRhaW5lciBvZiBBcnJheS5mcm9tKGNvbnRhaW5lcnMpKSB7XG5cdFx0XHRjb25zdCByb3cgPSBmaW5kTWV0YWRhdGFSb3coY29udGFpbmVyLCBcIuaRmOimgVwiKTtcblx0XHRcdGlmIChcblx0XHRcdFx0IXJvdyB8fFxuXHRcdFx0XHQhcm93LmlzQ29ubmVjdGVkIHx8XG5cdFx0XHRcdCFkb2N1bWVudC5jb250YWlucyhyb3cpIHx8XG5cdFx0XHRcdHJvdy5xdWVyeVNlbGVjdG9yKFwiLmZyb250bWF0dGVyLWFpLXN1bW1hcnktYnRuLCAuZnJvbnRtYXR0ZXItYWktc3VtbWFyeS1jb25maXJtXCIpXG5cdFx0XHQpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnNvbGUubG9nKFwiW0FJ5pGY6KaBXSDmkZjopoHooYwgRE9NOlwiLCByb3cub3V0ZXJIVE1MKTtcblx0XHRcdHJvdy5hZGRDbGFzcyhcImZyb250bWF0dGVyLWFpLXN1bW1hcnktcm93XCIpO1xuXHRcdFx0Y29uc3QgdmFsdWVFbCA9IGZpbmRNZXRhZGF0YVZhbHVlQ29udGFpbmVyKHJvdyk7XG5cdFx0XHRjb25zdCBzdW1tYXJ5ID0gbm9ybWFsaXplRnJvbnRtYXR0ZXJTY2FsYXIoXG5cdFx0XHRcdHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKGFjdGl2ZUZpbGUpPy5mcm9udG1hdHRlcj8uW1wi5pGY6KaBXCJdLFxuXHRcdFx0KTtcblx0XHRcdGlmICghc3VtbWFyeSkge1xuXHRcdFx0XHR0aGlzLnNob3dBSVN1bW1hcnlCdXR0b24ocm93LCBhY3RpdmVGaWxlLCBcImZ1bGxcIik7XG5cdFx0XHR9IGVsc2UgaWYgKHZhbHVlRWwpIHtcblx0XHRcdFx0Y29uc3Qgcm93V2l0aEhhbmRsZXJzID0gcm93IGFzIEhUTUxFbGVtZW50ICYge1xuXHRcdFx0XHRcdGZyb250bWF0dGVyQWlGb2N1c0hhbmRsZXI/OiBFdmVudExpc3RlbmVyO1xuXHRcdFx0XHRcdGZyb250bWF0dGVyQWlCbHVySGFuZGxlcj86IEV2ZW50TGlzdGVuZXI7XG5cdFx0XHRcdH07XG5cdFx0XHRcdGxldCBoaWRlVGltZXI6IG51bWJlciB8IG51bGwgPSBudWxsO1xuXHRcdFx0XHRyb3dXaXRoSGFuZGxlcnMuZnJvbnRtYXR0ZXJBaUZvY3VzSGFuZGxlciA9ICgpID0+IHtcblx0XHRcdFx0XHRpZiAoaGlkZVRpbWVyICE9PSBudWxsKSB7XG5cdFx0XHRcdFx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0KGhpZGVUaW1lcik7XG5cdFx0XHRcdFx0XHRoaWRlVGltZXIgPSBudWxsO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR0aGlzLnNob3dBSVN1bW1hcnlCdXR0b24ocm93LCBhY3RpdmVGaWxlLCBcImljb25cIik7XG5cdFx0XHRcdH07XG5cdFx0XHRcdHJvd1dpdGhIYW5kbGVycy5mcm9udG1hdHRlckFpQmx1ckhhbmRsZXIgPSAoKSA9PiB7XG5cdFx0XHRcdFx0aWYgKGhpZGVUaW1lciAhPT0gbnVsbCkge1xuXHRcdFx0XHRcdFx0d2luZG93LmNsZWFyVGltZW91dChoaWRlVGltZXIpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRoaWRlVGltZXIgPSB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHRcdFx0XHRpZiAoIXJvdy5xdWVyeVNlbGVjdG9yKFwiLmZyb250bWF0dGVyLWFpLXN1bW1hcnktY29uZmlybVwiKSkge1xuXHRcdFx0XHRcdFx0XHR0aGlzLmhpZGVBSVN1bW1hcnlCdXR0b24ocm93KTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9LCAyMDApO1xuXHRcdFx0XHR9O1xuXHRcdFx0XHR2YWx1ZUVsLmFkZEV2ZW50TGlzdGVuZXIoXCJmb2N1c2luXCIsIHJvd1dpdGhIYW5kbGVycy5mcm9udG1hdHRlckFpRm9jdXNIYW5kbGVyKTtcblx0XHRcdFx0dmFsdWVFbC5hZGRFdmVudExpc3RlbmVyKFwiZm9jdXNvdXRcIiwgcm93V2l0aEhhbmRsZXJzLmZyb250bWF0dGVyQWlCbHVySGFuZGxlcik7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBzaG93QUlTdW1tYXJ5QnV0dG9uKHJvdzogSFRNTEVsZW1lbnQsIGZpbGU6IFRGaWxlLCB2YXJpYW50OiBcImZ1bGxcIiB8IFwiaWNvblwiKSB7XG5cdFx0aWYgKHJvdy5xdWVyeVNlbGVjdG9yKFwiLmZyb250bWF0dGVyLWFpLXN1bW1hcnktYnRuLCAuZnJvbnRtYXR0ZXItYWktc3VtbWFyeS1jb25maXJtXCIpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgYnV0dG9uID0gcm93LmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcblx0XHRcdGNsczogYGZyb250bWF0dGVyLWFpLXN1bW1hcnktYnRuIGlzLSR7dmFyaWFudH1gLFxuXHRcdFx0YXR0cjogeyBcImFyaWEtbGFiZWxcIjogXCJBSSDnlJ/miJDmkZjopoFcIiB9LFxuXHRcdH0pO1xuXHRcdHNldEljb24oYnV0dG9uLCBcInNwYXJrbGVzXCIpO1xuXHRcdGlmICh2YXJpYW50ID09PSBcImZ1bGxcIikge1xuXHRcdFx0YnV0dG9uLmNyZWF0ZVNwYW4oeyB0ZXh0OiBcIkFJ5pGY6KaBXCIgfSk7XG5cdFx0fVxuXHRcdGJ1dHRvbi5vbmNsaWNrID0gKGV2ZW50KSA9PiB7XG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0ZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0XHR0aGlzLnNob3dBSVN1bW1hcnlDb25maXJtKHJvdywgZmlsZSwgYnV0dG9uKTtcblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBoaWRlQUlTdW1tYXJ5QnV0dG9uKHJvdzogSFRNTEVsZW1lbnQpIHtcblx0XHRyb3cucXVlcnlTZWxlY3RvcihcIi5mcm9udG1hdHRlci1haS1zdW1tYXJ5LWJ0blwiKT8ucmVtb3ZlKCk7XG5cdH1cblxuXHRwcml2YXRlIHNob3dBSVN1bW1hcnlDb25maXJtKHJvdzogSFRNTEVsZW1lbnQsIGZpbGU6IFRGaWxlLCBidXR0b246IEhUTUxFbGVtZW50KSB7XG5cdFx0YnV0dG9uLnJlbW92ZSgpO1xuXHRcdHJvdy5xdWVyeVNlbGVjdG9yKFwiLmZyb250bWF0dGVyLWFpLXN1bW1hcnktY29uZmlybVwiKT8ucmVtb3ZlKCk7XG5cdFx0Y29uc3Qgb2xkU3VtbWFyeSA9IG5vcm1hbGl6ZUZyb250bWF0dGVyU2NhbGFyKFxuXHRcdFx0dGhpcy5hcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoZmlsZSk/LmZyb250bWF0dGVyPy5bXCLmkZjopoFcIl0sXG5cdFx0KTtcblx0XHRjb25zdCBjb25maXJtRWwgPSByb3cuY3JlYXRlU3Bhbih7IGNsczogXCJmcm9udG1hdHRlci1haS1zdW1tYXJ5LWNvbmZpcm1cIiB9KTtcblx0XHRjb25maXJtRWwuY3JlYXRlU3Bhbih7XG5cdFx0XHRjbHM6IFwiZnJvbnRtYXR0ZXItYWktc3VtbWFyeS1jb25maXJtLXRleHRcIixcblx0XHRcdHRleHQ6IG9sZFN1bW1hcnkgPyBcIuKcqCBBSSDmm7TmlrDvvJ9cIiA6IFwi4pyoIEFJIOeUn+aIkO+8n1wiLFxuXHRcdH0pO1xuXHRcdGNvbnN0IGFjY2VwdEJ1dHRvbiA9IGNvbmZpcm1FbC5jcmVhdGVFbChcImJ1dHRvblwiLCB7IGNsczogXCJmcm9udG1hdHRlci1haS1zdW1tYXJ5LWNvbmZpcm0taWNvblwiIH0pO1xuXHRcdHNldEljb24oYWNjZXB0QnV0dG9uLCBcImNoZWNrXCIpO1xuXHRcdGNvbnN0IGNhbmNlbEJ1dHRvbiA9IGNvbmZpcm1FbC5jcmVhdGVFbChcImJ1dHRvblwiLCB7IGNsczogXCJmcm9udG1hdHRlci1haS1zdW1tYXJ5LWNvbmZpcm0taWNvblwiIH0pO1xuXHRcdHNldEljb24oY2FuY2VsQnV0dG9uLCBcInhcIik7XG5cblx0XHRjYW5jZWxCdXR0b24ub25jbGljayA9IChldmVudCkgPT4ge1xuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0Y29uZmlybUVsLnJlbW92ZSgpO1xuXHRcdFx0dGhpcy5hcHBseUFJU3VtbWFyeUJ1dHRvbnMoKTtcblx0XHR9O1xuXHRcdGFjY2VwdEJ1dHRvbi5vbmNsaWNrID0gKGV2ZW50KSA9PiB7XG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0ZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0XHR2b2lkIHRoaXMucnVuTWV0YWRhdGFBSVN1bW1hcnkoZmlsZSwgcm93LCBjb25maXJtRWwpO1xuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHJ1bk1ldGFkYXRhQUlTdW1tYXJ5KGZpbGU6IFRGaWxlLCByb3c6IEhUTUxFbGVtZW50LCBjb25maXJtRWw6IEhUTUxFbGVtZW50KSB7XG5cdFx0Y29uc3QgdmFsdWVFbCA9IGZpbmRNZXRhZGF0YVZhbHVlQ29udGFpbmVyKHJvdykgPz8gcm93O1xuXHRcdGNvbnN0IG9yaWdpbmFsVmFsdWUgPSB2YWx1ZUVsLnRleHRDb250ZW50ID8/IFwiXCI7XG5cdFx0Y29uZmlybUVsLnJlbW92ZSgpO1xuXHRcdHRoaXMuYWJvcnRBSVN1bW1hcnlTdHJlYW0oKTtcblx0XHRjb25zdCBjb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuXHRcdHRoaXMuYWlTdW1tYXJ5QWJvcnRDb250cm9sbGVyID0gY29udHJvbGxlcjtcblx0XHRsZXQgc3RyZWFtZWRUZXh0ID0gXCJcIjtcblx0XHRsZXQgZmluYWxUZXh0ID0gb3JpZ2luYWxWYWx1ZTtcblx0XHRsZXQgZGlkU3VjY2VlZCA9IGZhbHNlO1xuXHRcdGxldCBmYWxsYmFja0RvdHNUaW1lcjogbnVtYmVyIHwgbnVsbCA9IHdpbmRvdy5zZXRJbnRlcnZhbCgoKSA9PiB7XG5cdFx0XHRpZiAoc3RyZWFtZWRUZXh0KSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHZhbHVlRWwudGV4dENvbnRlbnQgPSB2YWx1ZUVsLnRleHRDb250ZW50ID09PSBcIsK3wrfCt1wiID8gXCLCt1wiIDogYCR7dmFsdWVFbC50ZXh0Q29udGVudH3Ct2A7XG5cdFx0fSwgMzUwKTtcblx0XHR2YWx1ZUVsLmVtcHR5KCk7XG5cdFx0dmFsdWVFbC5hZGRDbGFzcyhcImZyb250bWF0dGVyLWFpLXN1bW1hcnktbG9hZGluZ1wiKTtcblx0XHR2YWx1ZUVsLnNldFRleHQoXCJ8XCIpO1xuXG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHN1bW1hcnkgPSBhd2FpdCB0aGlzLmdlbmVyYXRlU3VtbWFyeUZvck1ldGFkYXRhQnV0dG9uKGZpbGUsIChkZWx0YSkgPT4ge1xuXHRcdFx0XHRpZiAoIWRlbHRhKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHN0cmVhbWVkVGV4dCArPSBkZWx0YTtcblx0XHRcdFx0dmFsdWVFbC5zZXRUZXh0KGAke3N0cmVhbWVkVGV4dH18YCk7XG5cdFx0XHRcdH0sIGNvbnRyb2xsZXIuc2lnbmFsKTtcblx0XHRcdFx0aWYgKGZhbGxiYWNrRG90c1RpbWVyICE9PSBudWxsKSB7XG5cdFx0XHRcdFx0d2luZG93LmNsZWFySW50ZXJ2YWwoZmFsbGJhY2tEb3RzVGltZXIpO1xuXHRcdFx0XHRcdGZhbGxiYWNrRG90c1RpbWVyID0gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0XHRmaW5hbFRleHQgPSBzdW1tYXJ5IHx8IHN0cmVhbWVkVGV4dDtcblx0XHRcdFx0ZGlkU3VjY2VlZCA9IEJvb2xlYW4oZmluYWxUZXh0KTtcblx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdGlmICghY29udHJvbGxlci5zaWduYWwuYWJvcnRlZCkge1xuXHRcdFx0XHRcdG5ldyBOb3RpY2UoYEFJIOaRmOimgeeUn+aIkOWksei0pe+8miR7Z2V0RXJyb3JNZXNzYWdlKGVycm9yKX1gKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBmaW5hbGx5IHtcblx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0aWYgKGZhbGxiYWNrRG90c1RpbWVyICE9PSBudWxsKSB7XG5cdFx0XHRcdFx0XHRcdHdpbmRvdy5jbGVhckludGVydmFsKGZhbGxiYWNrRG90c1RpbWVyKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmICh0aGlzLmFpU3VtbWFyeUFib3J0Q29udHJvbGxlciA9PT0gY29udHJvbGxlcikge1xuXHRcdFx0XHRcdFx0XHR0aGlzLmFpU3VtbWFyeUFib3J0Q29udHJvbGxlciA9IG51bGw7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRpZiAoZGlkU3VjY2VlZCkge1xuXHRcdFx0XHRcdFx0XHRuZXcgTm90aWNlKFwiQUkg5pGY6KaB55Sf5oiQ5oiQ5YqfXCIpO1xuXHRcdFx0XHRcdFx0XHR0aGlzLnNjaGVkdWxlRGVsYXllZEFJU3VtbWFyeUJ1dHRvblJlZnJlc2goKTtcblx0XHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHR2YWx1ZUVsLnJlbW92ZUNsYXNzKFwiZnJvbnRtYXR0ZXItYWktc3VtbWFyeS1sb2FkaW5nXCIpO1xuXHRcdFx0XHRcdFx0dmFsdWVFbC5zZXRUZXh0KG9yaWdpbmFsVmFsdWUpO1xuXHRcdFx0XHRcdFx0dGhpcy5zY2hlZHVsZUFJU3VtbWFyeUJ1dHRvblJlZnJlc2goKTtcblx0XHRcdFx0XHR9IGNhdGNoIChjbGVhbnVwRXJyb3IpIHtcblx0XHRcdFx0XHRcdGNvbnNvbGUuZXJyb3IoXCJbYXV0by1mcm9udG1hdHRlcl0gQUkgc3VtbWFyeSBjbGVhbnVwIGZhaWxlZFwiLCBjbGVhbnVwRXJyb3IpO1xuXHRcdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuY2xhc3MgRm9sZGVyUnVsZU1vZGFsIGV4dGVuZHMgTW9kYWwge1xuXHRwcml2YXRlIGZpZWxkOiBGb2xkZXJEZWZhdWx0RmllbGQgfCBcIlwiID0gXCJcIjtcblx0cHJpdmF0ZSB2YWx1ZSA9IFwiXCI7XG5cdHByaXZhdGUgaXNDdXN0b21WYWx1ZSA9IGZhbHNlO1xuXHRwcml2YXRlIGN1c3RvbVZhbHVlSW5wdXRFbDogSFRNTElucHV0RWxlbWVudCB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIGN1c3RvbVZhbHVlQmx1ckhhbmRsZXI6ICgoZXZlbnQ6IEZvY3VzRXZlbnQpID0+IHZvaWQpIHwgbnVsbCA9IG51bGw7XG5cdHByaXZhdGUgY3VzdG9tVmFsdWVLZXlkb3duSGFuZGxlcjogKChldmVudDogS2V5Ym9hcmRFdmVudCkgPT4gdm9pZCkgfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSBzdWJtaXRCdXR0b25FbDogSFRNTEJ1dHRvbkVsZW1lbnQgfCBudWxsID0gbnVsbDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRhcHA6IEFwcCxcblx0XHRwcml2YXRlIHBsdWdpbjogQXV0b0Zyb250bWF0dGVyUGx1Z2luLFxuXHRcdHByaXZhdGUgZm9sZGVyOiBzdHJpbmcsXG5cdCkge1xuXHRcdHN1cGVyKGFwcCk7XG5cdFx0dGhpcy5maWVsZCA9IHRoaXMuZ2V0SW5pdGlhbEZpZWxkKCk7XG5cdFx0dGhpcy52YWx1ZSA9IHRoaXMuZmluZEV4aXN0aW5nVmFsdWUodGhpcy5maWVsZCk7XG5cdH1cblxuXHRvbk9wZW4oKSB7XG5cdFx0dGhpcy5yZW5kZXIoKTtcblx0fVxuXG5cdG9uQ2xvc2UoKSB7XG5cdFx0dGhpcy5jbGVhbnVwQ3VzdG9tVmFsdWVJbnB1dCgpO1xuXHRcdHRoaXMuc3VibWl0QnV0dG9uRWwgPSBudWxsO1xuXHRcdHRoaXMuY29udGVudEVsLmVtcHR5KCk7XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlcigpIHtcblx0XHRjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcblx0XHR0aGlzLmNsZWFudXBDdXN0b21WYWx1ZUlucHV0KCk7XG5cdFx0Y29udGVudEVsLmVtcHR5KCk7XG5cdFx0Y29udGVudEVsLmNyZWF0ZUVsKFwiaDJcIiwgeyB0ZXh0OiBcIuiuvue9ruWxnuaAp+WMuemFjeinhOWImVwiIH0pO1xuXHRcdGNvbnN0IGluaGVyaXRlZFJ1bGVzID0gZ2V0QW5jZXN0b3JSdWxlcyh0aGlzLmZvbGRlciwgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZm9sZGVyRGVmYXVsdHMpO1xuXHRcdGZvciAoY29uc3QgcnVsZSBvZiBpbmhlcml0ZWRSdWxlcykge1xuXHRcdFx0Y29udGVudEVsLmNyZWF0ZURpdih7XG5cdFx0XHRcdGNsczogXCJhdXRvLWZyb250bWF0dGVyLW1vZGFsLWluaGVyaXRlZC1ydWxlXCIsXG5cdFx0XHRcdHRleHQ6IGDihpEg57un5om/6IeqICR7cnVsZS5mb2xkZXJ9IOKGkiAke3J1bGUuZmllbGR9OiAke3J1bGUudmFsdWV9YCxcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcblx0XHRcdC5zZXROYW1lKFwi5paH5Lu25aS5XCIpXG5cdFx0XHQuc2V0RGVzYyh0aGlzLmZvbGRlciB8fCBcIi9cIik7XG5cblx0XHRuZXcgU2V0dGluZyhjb250ZW50RWwpXG5cdFx0XHQuc2V0TmFtZShcIuWtl+autVwiKVxuXHRcdFx0LmFkZERyb3Bkb3duKChkcm9wZG93bikgPT4ge1xuXHRcdFx0XHRkcm9wZG93bi5hZGRPcHRpb24oXCJcIiwgXCLmnKrphY3nva5cIik7XG5cdFx0XHRcdGZvciAoY29uc3QgZmllbGQgb2YgRk9MREVSX0RFRkFVTFRfRklFTERTKSB7XG5cdFx0XHRcdFx0ZHJvcGRvd24uYWRkT3B0aW9uKGZpZWxkLCBmaWVsZCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRkcm9wZG93bi5zZXRWYWx1ZSh0aGlzLmZpZWxkKS5vbkNoYW5nZSgodmFsdWUpID0+IHtcblx0XHRcdFx0XHR0aGlzLmZpZWxkID0gdmFsdWUgYXMgRm9sZGVyRGVmYXVsdEZpZWxkIHwgXCJcIjtcblx0XHRcdFx0XHR0aGlzLnZhbHVlID0gdGhpcy5maW5kRXhpc3RpbmdWYWx1ZSh0aGlzLmZpZWxkKTtcblx0XHRcdFx0XHR0aGlzLmlzQ3VzdG9tVmFsdWUgPSBmYWxzZTtcblx0XHRcdFx0XHR0aGlzLnVwZGF0ZVN1Ym1pdFN0YXRlKCk7XG5cdFx0XHRcdFx0dGhpcy5yZW5kZXIoKTtcblx0XHRcdFx0fSk7XG5cdFx0XHRcdHRvZ2dsZU1vZGFsU2VsZWN0UGxhY2Vob2xkZXIoZHJvcGRvd24uc2VsZWN0RWwsICF0aGlzLmZpZWxkKTtcblx0XHRcdH0pO1xuXG5cdFx0Y29uc3QgY2FuZGlkYXRlcyA9IHRoaXMuZmllbGQgPyBnZXRGcm9udG1hdHRlckZpZWxkQ2FuZGlkYXRlcyh0aGlzLmFwcCwgdGhpcy5maWVsZCkgOiBbXTtcblx0XHRjb25zdCB2YWx1ZXMgPSB0aGlzLnZhbHVlICYmICFjYW5kaWRhdGVzLmluY2x1ZGVzKHRoaXMudmFsdWUpID8gWy4uLmNhbmRpZGF0ZXMsIHRoaXMudmFsdWVdIDogY2FuZGlkYXRlcztcblx0XHRjb25zdCB2YWx1ZVNldHRpbmcgPSBuZXcgU2V0dGluZyhjb250ZW50RWwpLnNldE5hbWUoXCLloavlhplcIik7XG5cdFx0dmFsdWVTZXR0aW5nLmNvbnRyb2xFbC5hZGRDbGFzcyhcImF1dG8tZnJvbnRtYXR0ZXItbW9kYWwtdmFsdWUtY29udHJvbFwiKTtcblx0XHR2YWx1ZVNldHRpbmcuY29udHJvbEVsLmVtcHR5KCk7XG5cdFx0Y29uc3Qgc2VsZWN0RWwgPSB2YWx1ZVNldHRpbmcuY29udHJvbEVsLmNyZWF0ZUVsKFwic2VsZWN0XCIsIHtcblx0XHRcdGNsczogXCJkcm9wZG93biBhdXRvLWZyb250bWF0dGVyLW1vZGFsLWN1c3RvbS1zZWxlY3RcIixcblx0XHR9KTtcblx0XHRzZWxlY3RFbC5jcmVhdGVFbChcIm9wdGlvblwiLCB7XG5cdFx0XHR2YWx1ZTogXCJcIixcblx0XHRcdHRleHQ6IFwi5pyq6YWN572uXCIsXG5cdFx0fSk7XG5cdFx0Zm9yIChjb25zdCB2YWx1ZSBvZiB2YWx1ZXMpIHtcblx0XHRcdHNlbGVjdEVsLmNyZWF0ZUVsKFwib3B0aW9uXCIsIHtcblx0XHRcdFx0dmFsdWUsXG5cdFx0XHRcdHRleHQ6IHZhbHVlLFxuXHRcdFx0fSk7XG5cdFx0fVxuXHRcdHNlbGVjdEVsLmNyZWF0ZUVsKFwib3B0aW9uXCIsIHtcblx0XHRcdHZhbHVlOiBcIl9fbmV3X19cIixcblx0XHRcdHRleHQ6IFwi6Ieq5a6a5LmJXCIsXG5cdFx0fSk7XG5cdFx0c2VsZWN0RWwuZGlzYWJsZWQgPSAhdGhpcy5maWVsZDtcblx0XHRzZWxlY3RFbC52YWx1ZSA9IHRoaXMuaXNDdXN0b21WYWx1ZSA/IFwiX19uZXdfX1wiIDogdGhpcy52YWx1ZSB8fCBcIlwiO1xuXHRcdHRvZ2dsZU1vZGFsU2VsZWN0UGxhY2Vob2xkZXIoc2VsZWN0RWwsICFzZWxlY3RFbC52YWx1ZSk7XG5cdFx0c2VsZWN0RWwuYWRkRXZlbnRMaXN0ZW5lcihcImNoYW5nZVwiLCAoKSA9PiB7XG5cdFx0XHR0b2dnbGVNb2RhbFNlbGVjdFBsYWNlaG9sZGVyKHNlbGVjdEVsLCAhc2VsZWN0RWwudmFsdWUpO1xuXHRcdFx0aWYgKCFzZWxlY3RFbC52YWx1ZSkge1xuXHRcdFx0XHR0aGlzLmlzQ3VzdG9tVmFsdWUgPSBmYWxzZTtcblx0XHRcdFx0dGhpcy52YWx1ZSA9IFwiXCI7XG5cdFx0XHRcdHRoaXMudXBkYXRlU3VibWl0U3RhdGUoKTtcblx0XHRcdFx0dGhpcy5yZW5kZXIoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHNlbGVjdEVsLnZhbHVlID09PSBcIl9fbmV3X19cIikge1xuXHRcdFx0XHR0aGlzLmlzQ3VzdG9tVmFsdWUgPSB0cnVlO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5pc0N1c3RvbVZhbHVlID0gZmFsc2U7XG5cdFx0XHRcdHRoaXMudmFsdWUgPSBzZWxlY3RFbC52YWx1ZTtcblx0XHRcdH1cblx0XHRcdHRoaXMudXBkYXRlU3VibWl0U3RhdGUoKTtcblx0XHRcdHRoaXMucmVuZGVyKCk7XG5cdFx0fSk7XG5cblx0XHRpZiAodGhpcy5pc0N1c3RvbVZhbHVlKSB7XG5cdFx0XHRjb25zdCBpbnB1dEVsID0gdmFsdWVTZXR0aW5nLmNvbnRyb2xFbC5jcmVhdGVFbChcImlucHV0XCIsIHtcblx0XHRcdFx0Y2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItbW9kYWwtY3VzdG9tLWlucHV0XCIsXG5cdFx0XHRcdHR5cGU6IFwidGV4dFwiLFxuXHRcdFx0XHR2YWx1ZTogdGhpcy52YWx1ZSxcblx0XHRcdH0pO1xuXHRcdFx0aW5wdXRFbC5wbGFjZWhvbGRlciA9IFwi5aGr5YWl5L+h5oGvXCI7XG5cdFx0XHRpbnB1dEVsLmFkZEV2ZW50TGlzdGVuZXIoXCJpbnB1dFwiLCAoKSA9PiB7XG5cdFx0XHRcdHRoaXMudmFsdWUgPSBpbnB1dEVsLnZhbHVlO1xuXHRcdFx0XHR0aGlzLnVwZGF0ZVN1Ym1pdFN0YXRlKCk7XG5cdFx0XHR9KTtcblx0XHRcdGlucHV0RWwuYWRkRXZlbnRMaXN0ZW5lcihcImNoYW5nZVwiLCAoKSA9PiB7XG5cdFx0XHRcdHRoaXMudmFsdWUgPSBpbnB1dEVsLnZhbHVlO1xuXHRcdFx0XHR0aGlzLnVwZGF0ZVN1Ym1pdFN0YXRlKCk7XG5cdFx0XHR9KTtcblxuXHRcdFx0dGhpcy5jdXN0b21WYWx1ZUlucHV0RWwgPSBpbnB1dEVsO1xuXHRcdFx0dGhpcy5jdXN0b21WYWx1ZUJsdXJIYW5kbGVyID0gKCkgPT4ge1xuXHRcdFx0XHR0aGlzLnZhbHVlID0gaW5wdXRFbC52YWx1ZTtcblx0XHRcdFx0dGhpcy51cGRhdGVTdWJtaXRTdGF0ZSgpO1xuXHRcdFx0fTtcblx0XHRcdHRoaXMuY3VzdG9tVmFsdWVLZXlkb3duSGFuZGxlciA9IChldmVudCkgPT4ge1xuXHRcdFx0XHRpZiAoZXZlbnQua2V5ID09PSBcIkVudGVyXCIpIHtcblx0XHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRcdHRoaXMudmFsdWUgPSBpbnB1dEVsLnZhbHVlO1xuXHRcdFx0XHRcdHRoaXMudXBkYXRlU3VibWl0U3RhdGUoKTtcblx0XHRcdFx0XHRpbnB1dEVsLmJsdXIoKTtcblx0XHRcdFx0fVxuXHRcdFx0fTtcblx0XHRcdGlucHV0RWwuYWRkRXZlbnRMaXN0ZW5lcihcImJsdXJcIiwgdGhpcy5jdXN0b21WYWx1ZUJsdXJIYW5kbGVyKTtcblx0XHRcdGlucHV0RWwuYWRkRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwgdGhpcy5jdXN0b21WYWx1ZUtleWRvd25IYW5kbGVyKTtcblx0XHRcdHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IGlucHV0RWwuZm9jdXMoKSwgMCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgYWN0aW9uc0VsID0gY29udGVudEVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLW1vZGFsLWFjdGlvbnNcIiB9KTtcblx0XHRuZXcgU2V0dGluZyhhY3Rpb25zRWwpXG5cdFx0XHQuYWRkQnV0dG9uKChidXR0b24pID0+IHtcblx0XHRcdFx0YnV0dG9uLnNldEJ1dHRvblRleHQoXCLlj5bmtohcIikub25DbGljaygoKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5jbG9zZSgpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pXG5cdFx0XHQuYWRkQnV0dG9uKChidXR0b24pID0+IHtcblx0XHRcdFx0dGhpcy5zdWJtaXRCdXR0b25FbCA9IGJ1dHRvbi5idXR0b25FbDtcblx0XHRcdFx0YnV0dG9uXG5cdFx0XHRcdFx0LnNldEJ1dHRvblRleHQoXCLmj5DkuqRcIilcblx0XHRcdFx0XHQuc2V0Q3RhKClcblx0XHRcdFx0XHQub25DbGljayhhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0aWYgKCF0aGlzLnBsdWdpbi5lbnN1cmVEZXZpY2VCb3VuZCgpKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5wbHVnaW4udXBzZXJ0Rm9sZGVyUnVsZSh0aGlzLmZvbGRlciwgdGhpcy5maWVsZCBhcyBGb2xkZXJEZWZhdWx0RmllbGQsIHRoaXMudmFsdWUpO1xuXHRcdFx0XHRcdHRoaXMucGx1Z2luLnJlZnJlc2hTZXR0aW5nc1RhYigpO1xuXHRcdFx0XHRcdG5ldyBOb3RpY2UoYOinhOWImeW3suS/neWtmO+8iCR7dGhpcy5wbHVnaW4uZ2V0Q3VycmVudEF1dGhvck5hbWUoKX3vvIlgKTtcblx0XHRcdFx0XHR0aGlzLmNsb3NlKCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0dGhpcy51cGRhdGVTdWJtaXRTdGF0ZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBmaW5kRXhpc3RpbmdWYWx1ZShmaWVsZDogRm9sZGVyRGVmYXVsdEZpZWxkIHwgXCJcIik6IHN0cmluZyB7XG5cdFx0aWYgKCFmaWVsZCkge1xuXHRcdFx0cmV0dXJuIFwiXCI7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLnBsdWdpbi5zZXR0aW5ncy5mb2xkZXJEZWZhdWx0cy5maW5kKChydWxlKSA9PiB7XG5cdFx0XHRyZXR1cm4gcnVsZS5mb2xkZXIgPT09IHRoaXMuZm9sZGVyICYmIHJ1bGUuZmllbGQgPT09IGZpZWxkO1xuXHRcdH0pPy52YWx1ZSA/PyBcIlwiO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRJbml0aWFsRmllbGQoKTogRm9sZGVyRGVmYXVsdEZpZWxkIHtcblx0XHRjb25zdCBvd25GaWVsZHMgPSBuZXcgU2V0KFxuXHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MuZm9sZGVyRGVmYXVsdHNcblx0XHRcdFx0LmZpbHRlcigocnVsZSkgPT4gcnVsZS5mb2xkZXIgPT09IHRoaXMuZm9sZGVyKVxuXHRcdFx0XHQubWFwKChydWxlKSA9PiBydWxlLmZpZWxkKSxcblx0XHQpO1xuXHRcdGNvbnN0IGluaGVyaXRlZEZpZWxkcyA9IG5ldyBTZXQoXG5cdFx0XHRnZXRBbmNlc3RvclJ1bGVzKHRoaXMuZm9sZGVyLCB0aGlzLnBsdWdpbi5zZXR0aW5ncy5mb2xkZXJEZWZhdWx0cykubWFwKChydWxlKSA9PiBydWxlLmZpZWxkKSxcblx0XHQpO1xuXG5cdFx0aWYgKG93bkZpZWxkcy5oYXMoXCLpobnnm65cIikgJiYgIW93bkZpZWxkcy5oYXMoXCLnsbvlnotcIikpIHtcblx0XHRcdHJldHVybiBcIuexu+Wei1wiO1xuXHRcdH1cblx0XHRpZiAob3duRmllbGRzLmhhcyhcIuexu+Wei1wiKSAmJiAhb3duRmllbGRzLmhhcyhcIumhueebrlwiKSkge1xuXHRcdFx0cmV0dXJuIFwi6aG555uuXCI7XG5cdFx0fVxuXHRcdGlmIChpbmhlcml0ZWRGaWVsZHMuaGFzKFwi6aG555uuXCIpICYmICFpbmhlcml0ZWRGaWVsZHMuaGFzKFwi57G75Z6LXCIpKSB7XG5cdFx0XHRyZXR1cm4gXCLnsbvlnotcIjtcblx0XHR9XG5cdFx0cmV0dXJuIFwi6aG555uuXCI7XG5cdH1cblxuXHRwcml2YXRlIGNsZWFudXBDdXN0b21WYWx1ZUlucHV0KCkge1xuXHRcdGlmICh0aGlzLmN1c3RvbVZhbHVlSW5wdXRFbCAmJiB0aGlzLmN1c3RvbVZhbHVlQmx1ckhhbmRsZXIpIHtcblx0XHRcdHRoaXMuY3VzdG9tVmFsdWVJbnB1dEVsLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJibHVyXCIsIHRoaXMuY3VzdG9tVmFsdWVCbHVySGFuZGxlcik7XG5cdFx0fVxuXHRcdGlmICh0aGlzLmN1c3RvbVZhbHVlSW5wdXRFbCAmJiB0aGlzLmN1c3RvbVZhbHVlS2V5ZG93bkhhbmRsZXIpIHtcblx0XHRcdHRoaXMuY3VzdG9tVmFsdWVJbnB1dEVsLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsIHRoaXMuY3VzdG9tVmFsdWVLZXlkb3duSGFuZGxlcik7XG5cdFx0fVxuXHRcdHRoaXMuY3VzdG9tVmFsdWVJbnB1dEVsID0gbnVsbDtcblx0XHR0aGlzLmN1c3RvbVZhbHVlQmx1ckhhbmRsZXIgPSBudWxsO1xuXHRcdHRoaXMuY3VzdG9tVmFsdWVLZXlkb3duSGFuZGxlciA9IG51bGw7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZVN1Ym1pdFN0YXRlKCkge1xuXHRcdGlmICghdGhpcy5zdWJtaXRCdXR0b25FbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGhhc0ZpZWxkID0gQm9vbGVhbih0aGlzLmZpZWxkKTtcblx0XHRjb25zdCBoYXNWYWx1ZSA9IHRoaXMuaXNDdXN0b21WYWx1ZVxuXHRcdFx0PyAodGhpcy5jdXN0b21WYWx1ZUlucHV0RWw/LnZhbHVlID8/IHRoaXMudmFsdWUpLnRyaW0oKS5sZW5ndGggPiAwXG5cdFx0XHQ6IHRoaXMudmFsdWUudHJpbSgpLmxlbmd0aCA+IDA7XG5cblx0XHR0aGlzLnN1Ym1pdEJ1dHRvbkVsLmRpc2FibGVkID0gIShoYXNGaWVsZCAmJiBoYXNWYWx1ZSk7XG5cdH1cbn1cblxuY2xhc3MgQUlTdW1tYXJ5U2VydmljZSBpbXBsZW1lbnRzIFN1bW1hcnlTZXJ2aWNlIHtcblx0Y29uc3RydWN0b3IocHJpdmF0ZSBzZXR0aW5nczogQXV0b0Zyb250bWF0dGVyU2V0dGluZ3MpIHt9XG5cblx0YXN5bmMgZ2VuZXJhdGVTdW1tYXJ5KGRvY3VtZW50OiBTdW1tYXJ5RG9jdW1lbnQpOiBQcm9taXNlPHN0cmluZz4ge1xuXHRcdHJldHVybiBhd2FpdCB0aGlzLmNhbGxBSSh0aGlzLmJ1aWxkUHJvbXB0KGRvY3VtZW50KSk7XG5cdH1cblxuXHRhc3luYyBjYWxsQUkocHJvbXB0Q29udGVudDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcblx0XHRjb25zdCBhcGlLZXkgPSB0aGlzLnNldHRpbmdzLmFpQXBpS2V5LnRyaW0oKTtcblx0XHRpZiAoIWFwaUtleSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiQVBJIEtleSDkuLrnqbpcIik7XG5cdFx0fVxuXG5cdFx0Y29uc3QgYXBpVXJsID0gdGhpcy5zZXR0aW5ncy5haUFwaVVybC5yZXBsYWNlKC9cXC8rJC8sIFwiXCIpO1xuXHRcdGNvbnN0IHVybCA9IGAke2FwaVVybH0vY2hhdC9jb21wbGV0aW9uc2A7XG5cblx0XHRjb25zb2xlLmxvZyhcIltBSeaRmOimgV0g6K+35rGCIFVSTDpcIiwgdXJsKTtcblx0XHRjb25zb2xlLmxvZyhcIltBSeaRmOimgV0g5qih5Z6LOlwiLCB0aGlzLnNldHRpbmdzLmFpTW9kZWxOYW1lKTtcblxuXHRcdGNvbnN0IGJvZHkgPSB7XG5cdFx0XHRtb2RlbDogdGhpcy5zZXR0aW5ncy5haU1vZGVsTmFtZSxcblx0XHRcdG1lc3NhZ2VzOiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRyb2xlOiBcInN5c3RlbVwiLFxuXHRcdFx0XHRcdGNvbnRlbnQ6IFwi55u05o6l6L6T5Ye65pGY6KaB77yM5LiN6KaB5pyJ5Lu75L2V5YW25LuW5YaF5a6544CCXCIsXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHsgcm9sZTogXCJ1c2VyXCIsIGNvbnRlbnQ6IHByb21wdENvbnRlbnQgfSxcblx0XHRcdF0sXG5cdFx0XHRyZWFzb25pbmdfZWZmb3J0OiBcImxvd1wiLFxuXHRcdFx0cmVhc29uaW5nX2Zvcm1hdDogXCJkZWVwc2Vlay1zdHlsZVwiLFxuXHRcdFx0bWF4X3Rva2VuczogMTAyNCxcblx0XHR9O1xuXG5cdFx0Y29uc29sZS5sb2coXCJbQUnmkZjopoFdIOivt+axgiBib2R5OlwiLCBKU09OLnN0cmluZ2lmeShib2R5LCBudWxsLCAyKS5zdWJzdHJpbmcoMCwgNTAwKSk7XG5cblx0XHRjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKHVybCwge1xuXHRcdFx0bWV0aG9kOiBcIlBPU1RcIixcblx0XHRcdGhlYWRlcnM6IHtcblx0XHRcdFx0XCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG5cdFx0XHRcdFwiQXV0aG9yaXphdGlvblwiOiBgQmVhcmVyICR7YXBpS2V5fWAsXG5cdFx0XHR9LFxuXHRcdFx0Ym9keTogSlNPTi5zdHJpbmdpZnkoYm9keSksXG5cdFx0fSk7XG5cblx0XHRjb25zb2xlLmxvZyhcIltBSeaRmOimgV0g5ZON5bqUIHN0YXR1czpcIiwgcmVzcG9uc2Uuc3RhdHVzLCByZXNwb25zZS5zdGF0dXNUZXh0KTtcblxuXHRcdGlmICghcmVzcG9uc2Uub2spIHtcblx0XHRcdGNvbnN0IGVycm9yVGV4dCA9IGF3YWl0IHJlc3BvbnNlLnRleHQoKTtcblx0XHRcdGNvbnNvbGUubG9nKFwiW0FJ5pGY6KaBXSDplJnor6/lk43lupQ6XCIsIGVycm9yVGV4dC5zdWJzdHJpbmcoMCwgNTAwKSk7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYEFQSSDor7fmsYLlpLHotKUgKCR7cmVzcG9uc2Uuc3RhdHVzfSk6ICR7ZXJyb3JUZXh0LnN1YnN0cmluZygwLCAyMDApfWApO1xuXHRcdH1cblxuXHRcdGNvbnN0IGRhdGEgPSBhd2FpdCByZXNwb25zZS5qc29uKCkgYXMgQ2hhdENvbXBsZXRpb25SZXNwb25zZTtcblx0XHRjb25zb2xlLmxvZyhcIltBSeaRmOimgV0g5a6M5pW05ZON5bqUOlwiLCBKU09OLnN0cmluZ2lmeShkYXRhLCBudWxsLCAyKSk7XG5cblx0XHRpZiAoZGF0YS5lcnJvcikge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGRhdGEuZXJyb3IubWVzc2FnZSB8fCBKU09OLnN0cmluZ2lmeShkYXRhLmVycm9yKSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbWVzc2FnZSA9IGRhdGEuY2hvaWNlcz8uWzBdPy5tZXNzYWdlO1xuXHRcdGlmICghbWVzc2FnZSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwi5ZON5bqU5Lit5pegIGNob2ljZXNbMF0ubWVzc2FnZe+8jOWujOaVtOWTjeW6lOW3suaJk+WNsOWIsOaOp+WItuWPsFwiKTtcblx0XHR9XG5cblx0XHRcdGNvbnNvbGUubG9nKFwiW0FJ5pGY6KaBXSBtZXNzYWdlLmNvbnRlbnQ6XCIsIEpTT04uc3RyaW5naWZ5KG1lc3NhZ2UuY29udGVudCkpO1xuXHRcdFx0Y29uc29sZS5sb2coXCJbQUnmkZjopoFdIG1lc3NhZ2UucmVhc29uaW5nX2NvbnRlbnQ6XCIsIEpTT04uc3RyaW5naWZ5KG1lc3NhZ2UucmVhc29uaW5nX2NvbnRlbnQpPy5zdWJzdHJpbmcoMCwgMjAwKSk7XG5cdFx0XHRjb25zb2xlLmxvZyhcIltBSeaRmOimgV0gbWVzc2FnZS5yZWFzb25pbmc6XCIsIEpTT04uc3RyaW5naWZ5KG1lc3NhZ2UucmVhc29uaW5nKT8uc3Vic3RyaW5nKDAsIDIwMCkpO1xuXG5cdFx0bGV0IHN1bW1hcnkgPSBtZXNzYWdlLmNvbnRlbnQ/LnRyaW0oKTtcblx0XHRpZiAoIXN1bW1hcnkpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihcIuaooeWei+acqueUn+aIkOaRmOimge+8iGNvbnRlbnQg5Li656m677yJ77yM6K+35omT5byA5byA5Y+R6ICF5bel5YW35p+l55yL5a6M5pW05ZON5bqUXCIpO1xuXHRcdH1cblxuXHRcdHN1bW1hcnkgPSBzdW1tYXJ5XG5cdFx0XHQucmVwbGFjZSgvXltcXFwi44CM44CNXCInXSt8W1xcXCLjgIzjgI1cIiddKyQvZywgXCJcIilcblx0XHRcdC5yZXBsYWNlKC9eKOaRmOimgVs677yaXVxccyopL2ksIFwiXCIpXG5cdFx0XHQudHJpbSgpO1xuXG5cdFx0aWYgKCFzdW1tYXJ5KSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJBSSDmkZjopoHov5Tlm57kuLrnqbpcIik7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHN1bW1hcnk7XG5cdH1cblxuXHRwcml2YXRlIGJ1aWxkUHJvbXB0KGRvY3VtZW50OiBTdW1tYXJ5RG9jdW1lbnQpOiBzdHJpbmcge1xuXHRcdHJldHVybiByZXBsYWNlUHJvbXB0VG9rZW4oXG5cdFx0XHRyZXBsYWNlUHJvbXB0VG9rZW4oXG5cdFx0XHRcdHJlcGxhY2VQcm9tcHRUb2tlbih0aGlzLnNldHRpbmdzLmFpU3VtbWFyeVByb21wdCwgXCJ7dGl0bGV9XCIsIGRvY3VtZW50LnRpdGxlKSxcblx0XHRcdFx0XCJ7ZnJvbnRtYXR0ZXJ9XCIsXG5cdFx0XHRcdGRvY3VtZW50LmZyb250bWF0dGVyLFxuXHRcdFx0KSxcblx0XHRcdFwie2NvbnRlbnR9XCIsXG5cdFx0XHRkb2N1bWVudC5jb250ZW50LFxuXHRcdCk7XG5cdH1cbn1cblxuY2xhc3MgQXV0b0Zyb250bWF0dGVyU2V0dGluZ1RhYiBleHRlbmRzIFBsdWdpblNldHRpbmdUYWIge1xuXHRwbHVnaW46IEF1dG9Gcm9udG1hdHRlclBsdWdpbjtcblx0cHJpdmF0ZSBhY3RpdmVUYWI6IFNldHRpbmdUYWJJZCA9IFwi6YCa55SoXCI7XG5cdHByaXZhdGUgYmluZGluZ0N1cnJlbnREZXZpY2UgPSBmYWxzZTtcblx0cHJpdmF0ZSBiaW5kaW5nQ3VycmVudERldmljZUN1c3RvbSA9IGZhbHNlO1xuXHRwcml2YXRlIHNjYW5SZXN1bHRzOiBTY2FuUmVzdWx0W10gPSBbXTtcblx0cHJpdmF0ZSBoYXNTY2FubmVkID0gZmFsc2U7XG5cdHByaXZhdGUgaXNTY2FubmluZyA9IGZhbHNlO1xuXHRwcml2YXRlIGlzRXhlY3V0aW5nID0gZmFsc2U7XG5cdHByaXZhdGUgcHJvY2Vzc2VkQ291bnQgPSAwO1xuXHRwcml2YXRlIHVubWF0Y2hlZEZvbGRlcnM6IFVubWF0Y2hlZEZvbGRlclJlc3VsdFtdID0gW107XG5cdHByaXZhdGUgaGFzU2Nhbm5lZFVubWF0Y2hlZEZvbGRlcnMgPSBmYWxzZTtcblx0cHJpdmF0ZSBpc1NjYW5uaW5nVW5tYXRjaGVkRm9sZGVycyA9IGZhbHNlO1xuXHRwcml2YXRlIGFjdGl2ZUlubGluZUVkaXRvckNsZWFudXA6ICgoKSA9PiB2b2lkKSB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIGFpQXBpS2V5VmlzaWJsZSA9IGZhbHNlO1xuXHRwcml2YXRlIGFpU3VtbWFyeUNvbXBsZXRpb25SZXN1bHRzOiBBSVN1bW1hcnlDYW5kaWRhdGVbXSA9IFtdO1xuXHRwcml2YXRlIGhhc1NjYW5uZWRBSVN1bW1hcnlDb21wbGV0aW9uID0gZmFsc2U7XG5cdHByaXZhdGUgaXNTY2FubmluZ0FJU3VtbWFyeUNvbXBsZXRpb24gPSBmYWxzZTtcblx0cHJpdmF0ZSBpc0V4ZWN1dGluZ0FJU3VtbWFyeUNvbXBsZXRpb24gPSBmYWxzZTtcblx0cHJpdmF0ZSBwcm9jZXNzZWRBSVN1bW1hcnlDb21wbGV0aW9uQ291bnQgPSAwO1xuXHRwcml2YXRlIGN1cnJlbnRSdWxlUGFnZSA9IDA7XG5cdHByaXZhdGUgaXNDaGVja2luZ1VwZGF0ZSA9IGZhbHNlO1xuXHRwcml2YXRlIGlzVXBkYXRpbmcgPSBmYWxzZTtcblx0cHJpdmF0ZSB1cGRhdGVQcm9ncmVzcyA9IDA7XG5cdHByaXZhdGUgdXBkYXRlUmVzdWx0TWVzc2FnZSA9IFwiXCI7XG5cdHByaXZhdGUgbGF0ZXN0VmVyc2lvbiA9IFwiXCI7XG5cblx0Y29uc3RydWN0b3IoYXBwOiBBcHAsIHBsdWdpbjogQXV0b0Zyb250bWF0dGVyUGx1Z2luKSB7XG5cdFx0c3VwZXIoYXBwLCBwbHVnaW4pO1xuXHRcdHRoaXMucGx1Z2luID0gcGx1Z2luO1xuXHR9XG5cblx0ZGlzcGxheSgpOiB2b2lkIHtcblx0XHRjb25zdCB7IGNvbnRhaW5lckVsIH0gPSB0aGlzO1xuXHRcdHRoaXMuY2xvc2VBY3RpdmVJbmxpbmVFZGl0b3IoKTtcblx0XHRjb250YWluZXJFbC5lbXB0eSgpO1xuXG5cdFx0dGhpcy5yZW5kZXJUYWJzKGNvbnRhaW5lckVsKTtcblx0XHRjb25zdCBjb250ZW50RWwgPSBjb250YWluZXJFbC5jcmVhdGVEaXYoe1xuXHRcdFx0Y2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItdGFiLWNvbnRlbnRcIixcblx0XHRcdGF0dHI6IHsgXCJkYXRhLWF1dG8tZnJvbnRtYXR0ZXItYWN0aXZlLXRhYlwiOiB0aGlzLmFjdGl2ZVRhYiB9LFxuXHRcdH0pO1xuXHRcdGlmICh0aGlzLmFjdGl2ZVRhYiA9PT0gXCLpgJrnlKhcIikge1xuXHRcdFx0dGhpcy5yZW5kZXJHZW5lcmFsU2V0dGluZ3MoY29udGVudEVsKTtcblx0XHR9IGVsc2UgaWYgKHRoaXMuYWN0aXZlVGFiID09PSBcIuaWh+S7tuWkueinhOWImVwiKSB7XG5cdFx0XHR0aGlzLnJlbmRlckZvbGRlckRlZmF1bHRSdWxlcyhjb250ZW50RWwpO1xuXHRcdH0gZWxzZSBpZiAodGhpcy5hY3RpdmVUYWIgPT09IFwi5omr5o+P5LuT5bqTXCIpIHtcblx0XHRcdHRoaXMucmVuZGVyU2NhblNlY3Rpb24oY29udGVudEVsKTtcblx0XHR9IGVsc2UgaWYgKHRoaXMuYWN0aXZlVGFiID09PSBcIuiuvuWkh+e7keWumlwiKSB7XG5cdFx0XHR0aGlzLnJlbmRlckRldmljZUJpbmRpbmdzKGNvbnRlbnRFbCk7XG5cdFx0fSBlbHNlIGlmICh0aGlzLmFjdGl2ZVRhYiA9PT0gXCLniYjmnKzmm7TmlrBcIikge1xuXHRcdFx0dGhpcy5yZW5kZXJBYm91dFNlY3Rpb24oY29udGVudEVsKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5yZW5kZXJBSVN1bW1hcnlTZXR0aW5ncyhjb250ZW50RWwpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyVGFicyhjb250YWluZXJFbDogSFRNTEVsZW1lbnQpIHtcblx0XHRjb25zdCB0YWJzRWwgPSBjb250YWluZXJFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci10YWJzXCIgfSk7XG5cdFx0Zm9yIChjb25zdCB0YWIgb2YgU0VUVElOR19UQUJTKSB7XG5cdFx0XHRjb25zdCB0YWJFbCA9IHRhYnNFbC5jcmVhdGVFbChcImJ1dHRvblwiLCB7XG5cdFx0XHRcdGNsczogYGF1dG8tZnJvbnRtYXR0ZXItdGFiJHt0aGlzLmFjdGl2ZVRhYiA9PT0gdGFiID8gXCIgaXMtYWN0aXZlXCIgOiBcIlwifWAsXG5cdFx0XHRcdHRleHQ6IHRhYixcblx0XHRcdH0pO1xuXHRcdFx0dGFiRWwub25jbGljayA9ICgpID0+IHtcblx0XHRcdFx0dGhpcy5hY3RpdmVUYWIgPSB0YWI7XG5cdFx0XHRcdHRoaXMuZGlzcGxheSgpO1xuXHRcdFx0fTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlckdlbmVyYWxTZXR0aW5ncyhjb250YWluZXJFbDogSFRNTEVsZW1lbnQpIHtcblx0XHR0aGlzLnJlbmRlclJlcXVpcmVkRmllbGRzSW5mbyhjb250YWluZXJFbCk7XG5cblx0XHRjb25zdCBoaWdobGlnaHRTZXR0aW5nRWwgPSBjb250YWluZXJFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1oaWdobGlnaHQtc2V0dGluZ1wiIH0pO1xuXHRcdG5ldyBTZXR0aW5nKGhpZ2hsaWdodFNldHRpbmdFbClcblx0XHRcdC5zZXROYW1lKFwi56m65bGe5oCn6auY5Lqu5o+Q6YaSXCIpXG5cdFx0XHQuc2V0RGVzYyhcIuaJk+W8gOaWh+S7tuaXtumrmOS6ruaPkOmGkuW/hemcgOWxnuaAp+S4reeahOepuuWAvOOAglwiKVxuXHRcdFx0LmFkZFRvZ2dsZSgodG9nZ2xlKSA9PlxuXHRcdFx0XHR0b2dnbGVcblx0XHRcdFx0XHQuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuZW1wdHlGaWVsZEhpZ2hsaWdodClcblx0XHRcdFx0XHQub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0XHRpZiAoIXRoaXMucGx1Z2luLmVuc3VyZURldmljZUJvdW5kKCkpIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5kaXNwbGF5KCk7XG5cdFx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLmVtcHR5RmllbGRIaWdobGlnaHQgPSB2YWx1ZTtcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4ucmVmcmVzaEVtcHR5RmllbGRIaWdobGlnaHRzKCk7XG5cdFx0XHRcdFx0fSksXG5cdFx0XHQpO1xuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJBSVN1bW1hcnlTZXR0aW5ncyhjb250YWluZXJFbDogSFRNTEVsZW1lbnQpIHtcblx0XHRjb25zdCBpbnRyb0VsID0gY29udGFpbmVyRWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItYWktc3VtbWFyeS1pbnRyb1wiIH0pO1xuXHRcdG5ldyBTZXR0aW5nKGludHJvRWwpXG5cdFx0XHQuc2V0TmFtZShcIkFJIOiHquWKqOaRmOimgVwiKVxuXHRcdFx0LnNldERlc2MoXCLlvIDlkK/lkI7vvIzlsIbkvb/nlKggQUkg5a+55paH5qGj5YaF5a656L+b6KGM5pGY6KaB5oC757uT77yM6Ieq5Yqo5aGr5YWl44CM5pGY6KaB44CN5a2X5q6144CCXCIpXG5cdFx0XHQuYWRkVG9nZ2xlKCh0b2dnbGUpID0+XG5cdFx0XHRcdHRvZ2dsZVxuXHRcdFx0XHRcdC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5haVN1bW1hcnlFbmFibGVkKVxuXHRcdFx0XHRcdC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcblx0XHRcdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLmFpU3VtbWFyeUVuYWJsZWQgPSB2YWx1ZTtcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdFx0XHRcdH0pLFxuXHRcdFx0KTtcblxuXHRcdGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwiaDNcIiwgeyB0ZXh0OiBcIuaooeWei+mFjee9rlwiIH0pO1xuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LnNldE5hbWUoXCJBUEkg5Zyw5Z2AXCIpXG5cdFx0XHQuYWRkVGV4dCgodGV4dCkgPT4ge1xuXHRcdFx0XHR0ZXh0XG5cdFx0XHRcdFx0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmFpQXBpVXJsKVxuXHRcdFx0XHRcdC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcblx0XHRcdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLmFpQXBpVXJsID0gdmFsdWU7XG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0dGV4dC5pbnB1dEVsLnBsYWNlaG9sZGVyID0gXCJodHRwczovL2FwaS5zdGVwZnVuLmNvbS9zdGVwX3BsYW4vdjFcIjtcblx0XHRcdH0pO1xuXG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHQuc2V0TmFtZShcIuaooeWei+WQjeensFwiKVxuXHRcdFx0LmFkZFRleHQoKHRleHQpID0+IHtcblx0XHRcdFx0dGV4dFxuXHRcdFx0XHRcdC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5haU1vZGVsTmFtZSlcblx0XHRcdFx0XHQub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5haU1vZGVsTmFtZSA9IHZhbHVlO1xuXHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdHRleHQuaW5wdXRFbC5wbGFjZWhvbGRlciA9IFwic3RlcC0zLjctZmxhc2hcIjtcblx0XHRcdH0pO1xuXG5cdFx0Y29uc3QgYXBpS2V5U2V0dGluZyA9IG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiQVBJIEtleVwiKTtcblx0XHRhcGlLZXlTZXR0aW5nLmNvbnRyb2xFbC5hZGRDbGFzcyhcImF1dG8tZnJvbnRtYXR0ZXItYWktYXBpLWtleS1jb250cm9sXCIpO1xuXHRcdGFwaUtleVNldHRpbmcuYWRkVGV4dCgodGV4dCkgPT4ge1xuXHRcdFx0dGV4dC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5haUFwaUtleSkub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG5cdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLmFpQXBpS2V5ID0gdmFsdWU7XG5cdFx0XHRcdGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXh0LmlucHV0RWwudHlwZSA9IHRoaXMuYWlBcGlLZXlWaXNpYmxlID8gXCJ0ZXh0XCIgOiBcInBhc3N3b3JkXCI7XG5cdFx0XHR0ZXh0LmlucHV0RWwucGxhY2Vob2xkZXIgPSBcInNrLXh4eHhcIjtcblx0XHR9KTtcblx0XHRhcGlLZXlTZXR0aW5nLmFkZEJ1dHRvbigoYnV0dG9uKSA9PiB7XG5cdFx0XHRidXR0b24uc2V0VG9vbHRpcCh0aGlzLmFpQXBpS2V5VmlzaWJsZSA/IFwi6ZqQ6JePIEFQSSBLZXlcIiA6IFwi5pi+56S6IEFQSSBLZXlcIikub25DbGljaygoKSA9PiB7XG5cdFx0XHRcdHRoaXMuYWlBcGlLZXlWaXNpYmxlID0gIXRoaXMuYWlBcGlLZXlWaXNpYmxlO1xuXHRcdFx0XHR0aGlzLmRpc3BsYXkoKTtcblx0XHRcdH0pO1xuXHRcdFx0c2V0SWNvbihidXR0b24uYnV0dG9uRWwsIHRoaXMuYWlBcGlLZXlWaXNpYmxlID8gXCJleWUtb2ZmXCIgOiBcImV5ZVwiKTtcblx0XHR9KTtcblxuXHRcdFx0Y29uc3Qgc3RhdHVzRWwgPSBjb250YWluZXJFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1haS1zdGF0dXNcIiB9KTtcblx0XHRcdHRoaXMucmVuZGVyQUlTdW1tYXJ5VGFza1NlY3Rpb24oc3RhdHVzRWwsIHtcblx0XHRcdFx0dGFzazogXCJjb21wbGV0aW9uXCIsXG5cdFx0XHRcdHRpdGxlOiBcIuaRmOimgeihpeWFqFwiLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogXCLkuLrjgIzmkZjopoHjgI3kuLrnqbrkuJTkvZzogIXkuLrmnKzmnLrnu5HlrprkvZzogIXnmoTmlofmoaPnlJ/miJAgQUkg5pGY6KaB44CCXCIsXG5cdFx0XHRcdGF1dG9UZXh0OiBcIuiHquWKqOinpuWPke+8muavjyAzMCDliIbpkp9cIixcblx0XHRcdFx0ZW1wdHlUZXh0OiBcIueCueWHu+aJq+aPj+afpeeci+mcgOimgeihpeWFqOaRmOimgeeahOaWh+aho+OAglwiLFxuXHRcdFx0XHRjb3VudFRleHQ6IFwi56+H5paH5qGj6ZyA6KaB6KGl5YWo5pGY6KaBXCIsXG5cdFx0XHR9KTtcblxuXHRcdGNvbnN0IHByb21wdEhlYWRlckVsID0gY29udGFpbmVyRWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItYWktcHJvbXB0LWhlYWRlclwiIH0pO1xuXHRcdHByb21wdEhlYWRlckVsLmNyZWF0ZUVsKFwiaDNcIiwgeyB0ZXh0OiBcIuaRmOimgSBQcm9tcHRcIiB9KTtcblx0XHRuZXcgU2V0dGluZyhwcm9tcHRIZWFkZXJFbCkuYWRkQnV0dG9uKChidXR0b24pID0+IHtcblx0XHRcdGJ1dHRvbi5zZXRCdXR0b25UZXh0KFwi5oGi5aSN6buY6K6kXCIpLm9uQ2xpY2soYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5haVN1bW1hcnlQcm9tcHQgPSBERUZBVUxUX0FJX1NVTU1BUllfUFJPTVBUO1xuXHRcdFx0XHRhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0dGhpcy5kaXNwbGF5KCk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblxuXHRcdGNvbnN0IHByb21wdEVsID0gY29udGFpbmVyRWwuY3JlYXRlRWwoXCJ0ZXh0YXJlYVwiLCB7XG5cdFx0XHRjbHM6IFwiYXV0by1mcm9udG1hdHRlci1haS1wcm9tcHQtdGV4dGFyZWFcIixcblx0XHR9KTtcblx0XHRwcm9tcHRFbC52YWx1ZSA9IHRoaXMucGx1Z2luLnNldHRpbmdzLmFpU3VtbWFyeVByb21wdDtcblx0XHRwcm9tcHRFbC5hZGRFdmVudExpc3RlbmVyKFwiY2hhbmdlXCIsIGFzeW5jICgpID0+IHtcblx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLmFpU3VtbWFyeVByb21wdCA9IHByb21wdEVsLnZhbHVlO1xuXHRcdFx0YXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlckFJU3VtbWFyeVRhc2tTZWN0aW9uKFxuXHRcdGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCxcblx0XHRvcHRpb25zOiB7XG5cdFx0XHR0YXNrOiBBSVN1bW1hcnlUYXNrVHlwZTtcblx0XHRcdHRpdGxlOiBzdHJpbmc7XG5cdFx0XHRkZXNjcmlwdGlvbjogc3RyaW5nO1xuXHRcdFx0YXV0b1RleHQ6IHN0cmluZztcblx0XHRcdGVtcHR5VGV4dDogc3RyaW5nO1xuXHRcdFx0Y291bnRUZXh0OiBzdHJpbmc7XG5cdFx0fSxcblx0KSB7XG5cdFx0Y29uc3QgdGFza0VsID0gY29udGFpbmVyRWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItYWktdGFzay1zZWN0aW9uXCIgfSk7XG5cdFx0dGFza0VsLmNyZWF0ZUVsKFwiaDNcIiwgeyB0ZXh0OiBvcHRpb25zLnRpdGxlIH0pO1xuXHRcdHRhc2tFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1haS10YXNrLWRlc2NyaXB0aW9uXCIsIHRleHQ6IG9wdGlvbnMuZGVzY3JpcHRpb24gfSk7XG5cdFx0Y29uc3QgaGVhZGVyRWwgPSB0YXNrRWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItYWktdGFzay1oZWFkZXJcIiB9KTtcblx0XHRoZWFkZXJFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1haS10YXNrLWF1dG9cIiwgdGV4dDogb3B0aW9ucy5hdXRvVGV4dCB9KTtcblx0XHRjb25zdCBzY2FuQWN0aW9uRWwgPSBoZWFkZXJFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1haS10YXNrLWFjdGlvblwiIH0pO1xuXHRcdG5ldyBTZXR0aW5nKHNjYW5BY3Rpb25FbCkuYWRkQnV0dG9uKChidXR0b24pID0+IHtcblx0XHRcdGNvbnN0IGlzU2Nhbm5pbmcgPSB0aGlzLmdldEFJU3VtbWFyeVRhc2tTdGF0ZShvcHRpb25zLnRhc2spLmlzU2Nhbm5pbmc7XG5cdFx0XHRidXR0b25cblx0XHRcdFx0LnNldEJ1dHRvblRleHQoaXNTY2FubmluZyA/IFwi5omr5o+P5LitLi4uXCIgOiBcIuaJq+aPj1wiKVxuXHRcdFx0XHQuc2V0RGlzYWJsZWQoaXNTY2FubmluZyB8fCB0aGlzLmdldEFJU3VtbWFyeVRhc2tTdGF0ZShvcHRpb25zLnRhc2spLmlzRXhlY3V0aW5nKVxuXHRcdFx0XHQub25DbGljayhhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5zY2FuQUlTdW1tYXJ5VGFzayhvcHRpb25zLnRhc2spO1xuXHRcdFx0XHR9KTtcblx0XHR9KTtcblxuXHRcdGNvbnN0IHJlc3VsdEVsID0gdGFza0VsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLWFpLXJlc3VsdHNcIiB9KTtcblx0XHRjb25zdCBzdGF0ZSA9IHRoaXMuZ2V0QUlTdW1tYXJ5VGFza1N0YXRlKG9wdGlvbnMudGFzayk7XG5cdFx0aWYgKCFzdGF0ZS5oYXNTY2FubmVkKSB7XG5cdFx0XHRyZXN1bHRFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1haS1lbXB0eVwiLCB0ZXh0OiBvcHRpb25zLmVtcHR5VGV4dCB9KTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoc3RhdGUucmVzdWx0cy5sZW5ndGggPT09IDApIHtcblx0XHRcdHJlc3VsdEVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLWFpLWVtcHR5XCIsIHRleHQ6IFwi5pqC5peg6ZyA6KaB5aSE55CG55qE5paH5qGj44CCXCIgfSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0cmVzdWx0RWwuY3JlYXRlRGl2KHtcblx0XHRcdGNsczogXCJhdXRvLWZyb250bWF0dGVyLWFpLWNvdW50XCIsXG5cdFx0XHR0ZXh0OiBg5YWx5Y+R546wICR7c3RhdGUucmVzdWx0cy5sZW5ndGh9ICR7b3B0aW9ucy5jb3VudFRleHR9YCxcblx0XHR9KTtcblx0XHRjb25zdCBsaXN0RWwgPSByZXN1bHRFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1haS1saXN0XCIgfSk7XG5cdFx0Zm9yIChjb25zdCByZXN1bHQgb2Ygc3RhdGUucmVzdWx0cykge1xuXHRcdFx0Y29uc3QgaXRlbUVsID0gbGlzdEVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLWFpLWl0ZW1cIiB9KTtcblx0XHRcdGNvbnN0IGNvbnRlbnRFbCA9IGl0ZW1FbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1haS1pdGVtLWNvbnRlbnRcIiB9KTtcblx0XHRcdGNvbnN0IG5hbWVFbCA9IGNvbnRlbnRFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1haS1uYW1lXCIgfSk7XG5cdFx0XHRuYW1lRWwuY3JlYXRlU3Bhbih7IHRleHQ6IHJlc3VsdC5maWxlLm5hbWUgfSk7XG5cdFx0XHRpZiAocmVzdWx0LmRvbmUpIHtcblx0XHRcdFx0bmFtZUVsLmNyZWF0ZVNwYW4oeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1haS1kb25lXCIsIHRleHQ6IFwiIOKck1wiIH0pO1xuXHRcdFx0fVxuXHRcdFx0Y29udGVudEVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLWFpLXBhdGhcIiwgdGV4dDogcmVzdWx0LmZpbGUucGF0aCB9KTtcblx0XHRcdGNvbnN0IG9wZW5CdXR0b24gPSBpdGVtRWwuY3JlYXRlRWwoXCJidXR0b25cIiwge1xuXHRcdFx0XHRjbHM6IFwiYXV0by1mcm9udG1hdHRlci1haS1vcGVuXCIsXG5cdFx0XHRcdGF0dHI6IHsgXCJhcmlhLWxhYmVsXCI6IFwi5omT5byA5paH5Lu2XCIgfSxcblx0XHRcdH0pO1xuXHRcdFx0c2V0SWNvbihvcGVuQnV0dG9uLCBcImV4dGVybmFsLWxpbmtcIik7XG5cdFx0XHRvcGVuQnV0dG9uLm9uY2xpY2sgPSBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuYXBwLndvcmtzcGFjZS5vcGVuTGlua1RleHQocmVzdWx0LmZpbGUucGF0aCwgXCJcIiwgZmFsc2UpO1xuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRjb25zdCBzdGF0dXNUZXh0ID1cblx0XHRcdHN0YXRlLnByb2Nlc3NlZENvdW50ID09PSBzdGF0ZS5yZXN1bHRzLmxlbmd0aCAmJiAhc3RhdGUuaXNFeGVjdXRpbmdcblx0XHRcdFx0PyBg5a6M5oiQ77yM5bey5aSE55CGICR7c3RhdGUucHJvY2Vzc2VkQ291bnR9IOevh2Bcblx0XHRcdFx0OiBcIlwiO1xuXHRcdG5ldyBTZXR0aW5nKHJlc3VsdEVsKVxuXHRcdFx0LnNldERlc2Moc3RhdHVzVGV4dClcblx0XHRcdC5hZGRCdXR0b24oKGJ1dHRvbikgPT4ge1xuXHRcdFx0XHRidXR0b25cblx0XHRcdFx0XHQuc2V0QnV0dG9uVGV4dChzdGF0ZS5pc0V4ZWN1dGluZyA/IFwi5omn6KGM5LitLi4uXCIgOiBcIuaJp+ihjFwiKVxuXHRcdFx0XHRcdC5zZXRDdGEoKVxuXHRcdFx0XHRcdC5zZXREaXNhYmxlZChzdGF0ZS5pc0V4ZWN1dGluZyB8fCB0aGlzLnBsdWdpbi5pc0FJU3VtbWFyeVRhc2tSdW5uaW5nKG9wdGlvbnMudGFzaykpXG5cdFx0XHRcdFx0Lm9uQ2xpY2soYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5leGVjdXRlQUlTdW1tYXJ5VGFzayhvcHRpb25zLnRhc2spO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGdldEFJU3VtbWFyeVRhc2tTdGF0ZSh0YXNrOiBBSVN1bW1hcnlUYXNrVHlwZSk6IEFJU3VtbWFyeVRhc2tVaVN0YXRlIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0cmVzdWx0czogdGhpcy5haVN1bW1hcnlDb21wbGV0aW9uUmVzdWx0cyxcblx0XHRcdGhhc1NjYW5uZWQ6IHRoaXMuaGFzU2Nhbm5lZEFJU3VtbWFyeUNvbXBsZXRpb24sXG5cdFx0XHRpc1NjYW5uaW5nOiB0aGlzLmlzU2Nhbm5pbmdBSVN1bW1hcnlDb21wbGV0aW9uLFxuXHRcdFx0aXNFeGVjdXRpbmc6IHRoaXMuaXNFeGVjdXRpbmdBSVN1bW1hcnlDb21wbGV0aW9uLFxuXHRcdFx0cHJvY2Vzc2VkQ291bnQ6IHRoaXMucHJvY2Vzc2VkQUlTdW1tYXJ5Q29tcGxldGlvbkNvdW50LFxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIHNldEFJU3VtbWFyeVRhc2tSZXN1bHRzKHRhc2s6IEFJU3VtbWFyeVRhc2tUeXBlLCByZXN1bHRzOiBBSVN1bW1hcnlDYW5kaWRhdGVbXSkge1xuXHRcdHRoaXMuYWlTdW1tYXJ5Q29tcGxldGlvblJlc3VsdHMgPSByZXN1bHRzO1xuXHR9XG5cblx0cHJpdmF0ZSBzZXRBSVN1bW1hcnlUYXNrU2Nhbm5pbmcodGFzazogQUlTdW1tYXJ5VGFza1R5cGUsIHZhbHVlOiBib29sZWFuKSB7XG5cdFx0dGhpcy5pc1NjYW5uaW5nQUlTdW1tYXJ5Q29tcGxldGlvbiA9IHZhbHVlO1xuXHR9XG5cblx0cHJpdmF0ZSBzZXRBSVN1bW1hcnlUYXNrU2Nhbm5lZCh0YXNrOiBBSVN1bW1hcnlUYXNrVHlwZSwgdmFsdWU6IGJvb2xlYW4pIHtcblx0XHR0aGlzLmhhc1NjYW5uZWRBSVN1bW1hcnlDb21wbGV0aW9uID0gdmFsdWU7XG5cdH1cblxuXHRwcml2YXRlIHNldEFJU3VtbWFyeVRhc2tFeGVjdXRpbmcodGFzazogQUlTdW1tYXJ5VGFza1R5cGUsIHZhbHVlOiBib29sZWFuKSB7XG5cdFx0dGhpcy5pc0V4ZWN1dGluZ0FJU3VtbWFyeUNvbXBsZXRpb24gPSB2YWx1ZTtcblx0fVxuXG5cdHByaXZhdGUgc2V0QUlTdW1tYXJ5VGFza1Byb2Nlc3NlZENvdW50KHRhc2s6IEFJU3VtbWFyeVRhc2tUeXBlLCB2YWx1ZTogbnVtYmVyKSB7XG5cdFx0dGhpcy5wcm9jZXNzZWRBSVN1bW1hcnlDb21wbGV0aW9uQ291bnQgPSB2YWx1ZTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgc2NhbkFJU3VtbWFyeVRhc2sodGFzazogQUlTdW1tYXJ5VGFza1R5cGUpIHtcblx0XHR0aGlzLnNldEFJU3VtbWFyeVRhc2tTY2FubmVkKHRhc2ssIHRydWUpO1xuXHRcdHRoaXMuc2V0QUlTdW1tYXJ5VGFza1NjYW5uaW5nKHRhc2ssIHRydWUpO1xuXHRcdHRoaXMuc2V0QUlTdW1tYXJ5VGFza1Jlc3VsdHModGFzaywgW10pO1xuXHRcdHRoaXMuc2V0QUlTdW1tYXJ5VGFza1Byb2Nlc3NlZENvdW50KHRhc2ssIDApO1xuXHRcdHRoaXMuZGlzcGxheSgpO1xuXG5cdFx0Y29uc3QgcmVzdWx0cyA9IGF3YWl0IHRoaXMucGx1Z2luLnNjYW5BSVN1bW1hcnlDYW5kaWRhdGVzKHRhc2ssIHRydWUpO1xuXHRcdHRoaXMuc2V0QUlTdW1tYXJ5VGFza1Jlc3VsdHModGFzaywgcmVzdWx0cyk7XG5cdFx0dGhpcy5zZXRBSVN1bW1hcnlUYXNrU2Nhbm5pbmcodGFzaywgZmFsc2UpO1xuXHRcdHRoaXMuZGlzcGxheSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBleGVjdXRlQUlTdW1tYXJ5VGFzayh0YXNrOiBBSVN1bW1hcnlUYXNrVHlwZSkge1xuXHRcdGNvbnN0IHN0YXRlID0gdGhpcy5nZXRBSVN1bW1hcnlUYXNrU3RhdGUodGFzayk7XG5cdFx0aWYgKHN0YXRlLnJlc3VsdHMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRuZXcgTm90aWNlKFwiQUkg5pGY6KaB77ya5pqC5peg6ZyA6KaB5aSE55CG55qE5paH5qGjXCIpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuc2V0QUlTdW1tYXJ5VGFza0V4ZWN1dGluZyh0YXNrLCB0cnVlKTtcblx0XHR0aGlzLnNldEFJU3VtbWFyeVRhc2tQcm9jZXNzZWRDb3VudCh0YXNrLCAwKTtcblx0XHRmb3IgKGNvbnN0IHJlc3VsdCBvZiBzdGF0ZS5yZXN1bHRzKSB7XG5cdFx0XHRyZXN1bHQuZG9uZSA9IGZhbHNlO1xuXHRcdH1cblx0XHR0aGlzLmRpc3BsYXkoKTtcblxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBwcm9jZXNzZWRDb3VudCA9IGF3YWl0IHRoaXMucGx1Z2luLmV4ZWN1dGVBSVN1bW1hcnlRdWV1ZSh0YXNrLCBzdGF0ZS5yZXN1bHRzLCB0cnVlLCAoKSA9PiB7XG5cdFx0XHRcdHRoaXMuc2V0QUlTdW1tYXJ5VGFza1Byb2Nlc3NlZENvdW50KHRhc2ssIHRoaXMuZ2V0QUlTdW1tYXJ5VGFza1N0YXRlKHRhc2spLnByb2Nlc3NlZENvdW50ICsgMSk7XG5cdFx0XHRcdHRoaXMuZGlzcGxheSgpO1xuXHRcdFx0fSk7XG5cdFx0XHR0aGlzLnNldEFJU3VtbWFyeVRhc2tQcm9jZXNzZWRDb3VudCh0YXNrLCBwcm9jZXNzZWRDb3VudCk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHRoaXMuc2V0QUlTdW1tYXJ5VGFza0V4ZWN1dGluZyh0YXNrLCBmYWxzZSk7XG5cdFx0XHR0aGlzLmRpc3BsYXkoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlclJlcXVpcmVkRmllbGRzSW5mbyhjb250YWluZXJFbDogSFRNTEVsZW1lbnQpIHtcblx0XHRjb25zdCBzZWN0aW9uRWwgPSBjb250YWluZXJFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1yZXF1aXJlZC1maWVsZHNcIiB9KTtcblx0XHRzZWN0aW9uRWwuY3JlYXRlRWwoXCJoMlwiLCB7IHRleHQ6IFwi6buY6K6k5paH5Lu25bGe5oCn5a2X5q61XCIgfSk7XG5cdFx0c2VjdGlvbkVsLmNyZWF0ZUVsKFwicFwiLCB7XG5cdFx0XHR0ZXh0OiBcIuS7peS4i+Wtl+auteS8muWcqOaWsOW7uuaWh+aho+aXtuiHquWKqOWGmeWFpe+8jOW5tuWcqOaJq+aPj+S7k+W6k+aXtuihpeWFqOajgOafpeOAglwiLFxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgdGFibGUgPSBzZWN0aW9uRWwuY3JlYXRlRWwoXCJ0YWJsZVwiKTtcblx0XHRjb25zdCB0aGVhZCA9IHRhYmxlLmNyZWF0ZUVsKFwidGhlYWRcIik7XG5cdFx0Y29uc3QgaGVhZGVyUm93ID0gdGhlYWQuY3JlYXRlRWwoXCJ0clwiKTtcblx0XHRmb3IgKGNvbnN0IGhlYWRlciBvZiBbXCLlrZfmrrVcIiwgXCLor7TmmI5cIiwgXCLloavlhpnmlrnlvI9cIl0pIHtcblx0XHRcdGhlYWRlclJvdy5jcmVhdGVFbChcInRoXCIsIHsgdGV4dDogaGVhZGVyIH0pO1xuXHRcdH1cblxuXHRcdGNvbnN0IHRib2R5ID0gdGFibGUuY3JlYXRlRWwoXCJ0Ym9keVwiKTtcblx0XHRmb3IgKGNvbnN0IHJvdyBvZiBbXG5cdFx0XHRbXCLpobnnm65cIiwgXCLmlofmoaPmiYDlsZ7pobnnm65cIiwgXCLmlofku7blpLnop4TliJnoh6rliqjloavlhpnvvIzmiJbmiYvliqjloavlhplcIl0sXG5cdFx0XHRbXCLnsbvlnotcIiwgXCLmlofmoaPnsbvlnotcIiwgXCLmlofku7blpLnop4TliJnoh6rliqjloavlhpnvvIzmiJbmiYvliqjloavlhplcIl0sXG5cdFx0XHRbXCLkvZzogIVcIiwgXCLmlofmoaPliJvlu7rogIVcIiwgXCLmoLnmja7orr7lpIfoh6rliqjor4bliKtcIl0sXG5cdFx0XHRbXCLmkZjopoFcIiwgXCLmlofmoaPlhoXlrrnmkZjopoFcIiwgXCLmiYvliqjloavlhpkgLyBBSSDoh6rliqjnlJ/miJBcIl0sXG5cdFx0XHRbXCLliJvlu7rml7bpl7RcIiwgXCLmlofmoaPliJvlu7rml7bpl7RcIiwgXCLoh6rliqjojrflj5ZcIl0sXG5cdFx0XHRbXCLmnIDlkI7mm7TmlrBcIiwgXCLmnIDlkI7kuIDmrKHnvJbovpHml7bpl7RcIiwgXCLoh6rliqjmm7TmlrBcIl0sXG5cdFx0XSkge1xuXHRcdFx0Y29uc3QgdHIgPSB0Ym9keS5jcmVhdGVFbChcInRyXCIpO1xuXHRcdFx0Zm9yIChjb25zdCBjZWxsIG9mIHJvdykge1xuXHRcdFx0XHR0ci5jcmVhdGVFbChcInRkXCIsIHsgdGV4dDogY2VsbCB9KTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlckRldmljZUJpbmRpbmdzKGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCkge1xuXHRcdHRoaXMucmVuZGVyQ3VycmVudERldmljZVN0YXR1cyhjb250YWluZXJFbCk7XG5cdFx0dGhpcy5yZW5kZXJCb3VuZERldmljZUxpc3QoY29udGFpbmVyRWwpO1xuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJDdXJyZW50RGV2aWNlU3RhdHVzKGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCkge1xuXHRcdGNvbnN0IGN1cnJlbnRCaW5kaW5nID0gdGhpcy5nZXRDdXJyZW50RGV2aWNlQmluZGluZygpO1xuXHRcdGNvbnN0IHN0YXR1c0VsID0gY29udGFpbmVyRWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItY3VycmVudC1kZXZpY2UtY2FyZFwiIH0pO1xuXHRcdHN0YXR1c0VsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLWN1cnJlbnQtZGV2aWNlLXRpdGxlXCIsIHRleHQ6IFwi5pys5py66K6+5aSHXCIgfSk7XG5cdFx0c3RhdHVzRWwuY3JlYXRlRGl2KHtcblx0XHRcdGNsczogXCJhdXRvLWZyb250bWF0dGVyLWN1cnJlbnQtZGV2aWNlLWxpbmVcIixcblx0XHRcdHRleHQ6IGBVVUlE77yaJHttYXNrRGV2aWNlVXVpZCh0aGlzLnBsdWdpbi5jdXJyZW50RGV2aWNlVXVpZCl9YCxcblx0XHR9KTtcblxuXHRcdGlmIChjdXJyZW50QmluZGluZz8uYXV0aG9yKSB7XG5cdFx0XHRzdGF0dXNFbC5jcmVhdGVEaXYoe1xuXHRcdFx0XHRjbHM6IFwiYXV0by1mcm9udG1hdHRlci1jdXJyZW50LWRldmljZS1saW5lXCIsXG5cdFx0XHRcdHRleHQ6IGDnirbmgIHvvJrinIUg5bey57uR5a6aIOKAlCAke2N1cnJlbnRCaW5kaW5nLmF1dGhvcn1gLFxuXHRcdFx0fSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0c3RhdHVzRWwuY3JlYXRlRGl2KHtcblx0XHRcdGNsczogXCJhdXRvLWZyb250bWF0dGVyLWN1cnJlbnQtZGV2aWNlLWxpbmVcIixcblx0XHRcdHRleHQ6IFwi54q25oCB77ya4pqg77iPIOacque7keWumlwiLFxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgYWN0aW9uRWwgPSBzdGF0dXNFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1jdXJyZW50LWRldmljZS1hY3Rpb25cIiB9KTtcblx0XHRpZiAodGhpcy5iaW5kaW5nQ3VycmVudERldmljZSkge1xuXHRcdFx0aWYgKHRoaXMuYmluZGluZ0N1cnJlbnREZXZpY2VDdXN0b20pIHtcblx0XHRcdFx0bmV3IFNldHRpbmcoYWN0aW9uRWwpLmFkZFRleHQoKHRleHQpID0+IHtcblx0XHRcdFx0XHRjb25zdCBjb25maXJtID0gYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5iaW5kQ3VycmVudERldmljZSh0ZXh0LmdldFZhbHVlKCkpO1xuXHRcdFx0XHRcdH07XG5cblx0XHRcdFx0XHR0ZXh0LnNldFBsYWNlaG9sZGVyKFwi6Ieq5a6a5LmJ5L2c6ICFXCIpO1xuXHRcdFx0XHRcdHRleHQuaW5wdXRFbC5vbmJsdXIgPSBjb25maXJtO1xuXHRcdFx0XHRcdHRleHQuaW5wdXRFbC5vbmtleWRvd24gPSAoZXZlbnQpID0+IHtcblx0XHRcdFx0XHRcdGlmIChldmVudC5rZXkgPT09IFwiRW50ZXJcIikge1xuXHRcdFx0XHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRcdFx0XHRjb25maXJtKCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0XHR3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB0ZXh0LmlucHV0RWwuZm9jdXMoKSwgMCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bmV3IFNldHRpbmcoYWN0aW9uRWwpLmFkZERyb3Bkb3duKChkcm9wZG93bikgPT4ge1xuXHRcdFx0XHRcdGRyb3Bkb3duLmFkZE9wdGlvbihcIlwiLCBcIu+8iOivt+mAieaLqe+8iVwiKTtcblx0XHRcdFx0XHRmb3IgKGNvbnN0IG9wdGlvbiBvZiBBVVRIT1JfT1BUSU9OUykge1xuXHRcdFx0XHRcdFx0ZHJvcGRvd24uYWRkT3B0aW9uKG9wdGlvbiwgb3B0aW9uKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRkcm9wZG93bi5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcblx0XHRcdFx0XHRcdGlmICh2YWx1ZSA9PT0gQ1VTVE9NX0FVVEhPUl9NT0RFKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuYmluZGluZ0N1cnJlbnREZXZpY2VDdXN0b20gPSB0cnVlO1xuXHRcdFx0XHRcdFx0XHR0aGlzLmRpc3BsYXkoKTtcblx0XHRcdFx0XHRcdH0gZWxzZSBpZiAodmFsdWUpIHtcblx0XHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5iaW5kQ3VycmVudERldmljZSh2YWx1ZSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRuZXcgU2V0dGluZyhhY3Rpb25FbCkuYWRkQnV0dG9uKChidXR0b24pID0+IHtcblx0XHRcdFx0YnV0dG9uLnNldEJ1dHRvblRleHQoXCLnu5HlrprmnKzmnLpcIikuc2V0Q3RhKCkub25DbGljaygoKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5iaW5kaW5nQ3VycmVudERldmljZSA9IHRydWU7XG5cdFx0XHRcdFx0dGhpcy5iaW5kaW5nQ3VycmVudERldmljZUN1c3RvbSA9IGZhbHNlO1xuXHRcdFx0XHRcdHRoaXMuZGlzcGxheSgpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyQm91bmREZXZpY2VMaXN0KGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCkge1xuXHRcdGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwiaDJcIiwgeyB0ZXh0OiBcIuaJgOacieW3sue7keWumuiuvuWkh1wiIH0pO1xuXHRcdGNvbnN0IGxpc3RFbCA9IGNvbnRhaW5lckVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLWJvdW5kLWRldmljZS1saXN0XCIgfSk7XG5cdFx0Y29uc3QgYmluZGluZ3MgPSB0aGlzLnBsdWdpbi5zZXR0aW5ncy5kZXZpY2VCaW5kaW5ncy5maWx0ZXIoKGJpbmRpbmcpID0+IGJpbmRpbmcudXVpZCAmJiBiaW5kaW5nLmF1dGhvcik7XG5cdFx0aWYgKGJpbmRpbmdzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0bGlzdEVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLWJvdW5kLWRldmljZS1lbXB0eVwiLCB0ZXh0OiBcIuaaguaXoOW3sue7keWumuiuvuWkh1wiIH0pO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGZvciAoY29uc3QgYmluZGluZyBvZiBiaW5kaW5ncykge1xuXHRcdFx0Y29uc3Qgcm93RWwgPSBsaXN0RWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItYm91bmQtZGV2aWNlLXJvd1wiIH0pO1xuXHRcdFx0cm93RWwuY3JlYXRlRGl2KHtcblx0XHRcdFx0Y2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItYm91bmQtZGV2aWNlLXV1aWRcIixcblx0XHRcdFx0dGV4dDogbWFza0RldmljZVV1aWQoYmluZGluZy51dWlkKSxcblx0XHRcdH0pO1xuXHRcdFx0Y29uc3QgYXV0aG9yRWwgPSByb3dFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1ib3VuZC1kZXZpY2UtYXV0aG9yXCIgfSk7XG5cdFx0XHRhdXRob3JFbC5jcmVhdGVTcGFuKHsgdGV4dDogYmluZGluZy5hdXRob3IgfSk7XG5cdFx0XHRpZiAoYmluZGluZy51dWlkID09PSB0aGlzLnBsdWdpbi5jdXJyZW50RGV2aWNlVXVpZCkge1xuXHRcdFx0XHRhdXRob3JFbC5jcmVhdGVTcGFuKHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItZGV2aWNlLWxvY2FsXCIsIHRleHQ6IFwi77yI5pys5py677yJXCIgfSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJBYm91dFNlY3Rpb24oY29udGFpbmVyRWw6IEhUTUxFbGVtZW50KSB7XG5cdFx0Y29udGFpbmVyRWwuY3JlYXRlRWwoXCJoMlwiLCB7IHRleHQ6IFwiYXV0by1mcm9udG1hdHRlclwiIH0pO1xuXHRcdGNvbnRhaW5lckVsLmNyZWF0ZURpdih7XG5cdFx0XHRjbHM6IFwiYXV0by1mcm9udG1hdHRlci1hYm91dC12ZXJzaW9uXCIsXG5cdFx0XHR0ZXh0OiBg5b2T5YmN54mI5pys77yaJHt0aGlzLnBsdWdpbi5tYW5pZmVzdC52ZXJzaW9ufWAsXG5cdFx0fSk7XG5cblx0XHRjb25zdCBhY3Rpb25FbCA9IGNvbnRhaW5lckVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLWFib3V0LWFjdGlvblwiIH0pO1xuXHRcdGNvbnN0IGNoZWNrQnV0dG9uID0gYWN0aW9uRWwuY3JlYXRlRWwoXCJidXR0b25cIiwge1xuXHRcdFx0Y2xzOiBcIm1vZC1jdGEgYXV0by1mcm9udG1hdHRlci1hYm91dC1jaGVjay1idG5cIixcblx0XHRcdHRleHQ6IHRoaXMuaXNDaGVja2luZ1VwZGF0ZSA/IFwi5qOA5p+l5LitLi4uXCIgOiBcIuajgOafpeabtOaWsFwiLFxuXHRcdH0pO1xuXHRcdGNoZWNrQnV0dG9uLmRpc2FibGVkID0gdGhpcy5pc0NoZWNraW5nVXBkYXRlIHx8IHRoaXMuaXNVcGRhdGluZztcblx0XHRjaGVja0J1dHRvbi5vbmNsaWNrID0gYXN5bmMgKCkgPT4ge1xuXHRcdFx0dGhpcy5pc0NoZWNraW5nVXBkYXRlID0gdHJ1ZTtcblx0XHRcdHRoaXMudXBkYXRlUmVzdWx0TWVzc2FnZSA9IFwiXCI7XG5cdFx0XHR0aGlzLmxhdGVzdFZlcnNpb24gPSBcIlwiO1xuXHRcdFx0dGhpcy5kaXNwbGF5KCk7XG5cblx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMucGx1Z2luLmNoZWNrRm9yVXBkYXRlKCk7XG5cdFx0XHR0aGlzLmlzQ2hlY2tpbmdVcGRhdGUgPSBmYWxzZTtcblxuXHRcdFx0aWYgKHJlc3VsdC5lcnJvciA9PT0gXCJub3RfZm91bmRcIikge1xuXHRcdFx0XHRuZXcgTm90aWNlKFwi5pyq5om+5Yiw6L+c56uv5LuT5bqT77yM6K+35qOA5p+l572R57ucXCIpO1xuXHRcdFx0XHR0aGlzLnVwZGF0ZVJlc3VsdE1lc3NhZ2UgPSBcIuacquaJvuWIsOi/nOerr+S7k+W6k++8jOivt+ajgOafpee9kee7nFwiO1xuXHRcdFx0fSBlbHNlIGlmIChyZXN1bHQuZXJyb3IpIHtcblx0XHRcdFx0bmV3IE5vdGljZShyZXN1bHQuZXJyb3IpO1xuXHRcdFx0XHR0aGlzLnVwZGF0ZVJlc3VsdE1lc3NhZ2UgPSByZXN1bHQuZXJyb3I7XG5cdFx0XHR9IGVsc2UgaWYgKHJlc3VsdC5oYXNVcGRhdGUpIHtcblx0XHRcdFx0dGhpcy5sYXRlc3RWZXJzaW9uID0gcmVzdWx0LnZlcnNpb247XG5cdFx0XHRcdHRoaXMudXBkYXRlUmVzdWx0TWVzc2FnZSA9IGDwn5SEIOWPkeeOsOaWsOeJiOacrO+8miR7cmVzdWx0LnZlcnNpb25977yI5b2T5YmNICR7dGhpcy5wbHVnaW4ubWFuaWZlc3QudmVyc2lvbn3vvIlgO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy51cGRhdGVSZXN1bHRNZXNzYWdlID0gYOKchSDlvZPliY3lt7LmmK/mnIDmlrDniYjmnKzvvIgke3RoaXMucGx1Z2luLm1hbmlmZXN0LnZlcnNpb25977yJYDtcblx0XHRcdH1cblx0XHRcdHRoaXMuZGlzcGxheSgpO1xuXHRcdH07XG5cblx0XHRpZiAodGhpcy51cGRhdGVSZXN1bHRNZXNzYWdlKSB7XG5cdFx0XHRjb25zdCByZXN1bHRFbCA9IGNvbnRhaW5lckVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLWFib3V0LXJlc3VsdFwiIH0pO1xuXHRcdFx0cmVzdWx0RWwuY3JlYXRlRGl2KHsgdGV4dDogdGhpcy51cGRhdGVSZXN1bHRNZXNzYWdlIH0pO1xuXG5cdFx0XHRpZiAodGhpcy5sYXRlc3RWZXJzaW9uKSB7XG5cdFx0XHRcdGNvbnN0IHVwZGF0ZUJ1dHRvbiA9IHJlc3VsdEVsLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcblx0XHRcdFx0XHRjbHM6IFwibW9kLWN0YSBhdXRvLWZyb250bWF0dGVyLWFib3V0LXVwZGF0ZS1idG5cIixcblx0XHRcdFx0XHR0ZXh0OiB0aGlzLmlzVXBkYXRpbmcgPyBg5pu05paw5LitLi4u77yIJHt0aGlzLnVwZGF0ZVByb2dyZXNzfS8z77yJYCA6IFwi56uL5Y2z5pu05pawXCIsXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHR1cGRhdGVCdXR0b24uZGlzYWJsZWQgPSB0aGlzLmlzVXBkYXRpbmc7XG5cdFx0XHRcdHVwZGF0ZUJ1dHRvbi5vbmNsaWNrID0gYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdHRoaXMuaXNVcGRhdGluZyA9IHRydWU7XG5cdFx0XHRcdFx0dGhpcy51cGRhdGVQcm9ncmVzcyA9IDA7XG5cdFx0XHRcdFx0dGhpcy5kaXNwbGF5KCk7XG5cblx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5wbHVnaW4ucGVyZm9ybVVwZGF0ZSh0aGlzLmxhdGVzdFZlcnNpb24sIChzdGVwLCB0b3RhbCkgPT4ge1xuXHRcdFx0XHRcdFx0XHR0aGlzLnVwZGF0ZVByb2dyZXNzID0gc3RlcDtcblx0XHRcdFx0XHRcdFx0dGhpcy5kaXNwbGF5KCk7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdHRoaXMuaXNVcGRhdGluZyA9IGZhbHNlO1xuXHRcdFx0XHRcdFx0dGhpcy5sYXRlc3RWZXJzaW9uID0gXCJcIjtcblx0XHRcdFx0XHRcdHRoaXMudXBkYXRlUmVzdWx0TWVzc2FnZSA9IFwiXCI7XG5cdFx0XHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0XHRcdHRoaXMuaXNVcGRhdGluZyA9IGZhbHNlO1xuXHRcdFx0XHRcdFx0bmV3IE5vdGljZShg5pu05paw5aSx6LSl77yaJHtnZXRFcnJvck1lc3NhZ2UoZXJyb3IpfWApO1xuXHRcdFx0XHRcdFx0dGhpcy51cGRhdGVSZXN1bHRNZXNzYWdlID0gYOabtOaWsOWksei0pe+8miR7Z2V0RXJyb3JNZXNzYWdlKGVycm9yKX1gO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR0aGlzLmRpc3BsYXkoKTtcblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGdldEN1cnJlbnREZXZpY2VCaW5kaW5nKCk6IERldmljZUF1dGhvckJpbmRpbmcgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLnBsdWdpbi5zZXR0aW5ncy5kZXZpY2VCaW5kaW5ncy5maW5kKChiaW5kaW5nKSA9PiB7XG5cdFx0XHRyZXR1cm4gYmluZGluZy51dWlkID09PSB0aGlzLnBsdWdpbi5jdXJyZW50RGV2aWNlVXVpZDtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgYmluZEN1cnJlbnREZXZpY2UoYXV0aG9yOiBzdHJpbmcpIHtcblx0XHRjb25zdCB0cmltbWVkID0gYXV0aG9yLnRyaW0oKTtcblx0XHRpZiAoIXRyaW1tZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRsZXQgYmluZGluZyA9IHRoaXMuZ2V0Q3VycmVudERldmljZUJpbmRpbmcoKTtcblx0XHRpZiAoIWJpbmRpbmcpIHtcblx0XHRcdGJpbmRpbmcgPSB7XG5cdFx0XHRcdHV1aWQ6IHRoaXMucGx1Z2luLmN1cnJlbnREZXZpY2VVdWlkLFxuXHRcdFx0XHRhdXRob3I6IHRyaW1tZWQsXG5cdFx0XHR9O1xuXHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MuZGV2aWNlQmluZGluZ3MucHVzaChiaW5kaW5nKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0YmluZGluZy5hdXRob3IgPSB0cmltbWVkO1xuXHRcdH1cblxuXHRcdHRoaXMuYmluZGluZ0N1cnJlbnREZXZpY2UgPSBmYWxzZTtcblx0XHR0aGlzLmJpbmRpbmdDdXJyZW50RGV2aWNlQ3VzdG9tID0gZmFsc2U7XG5cdFx0XHRhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdHRoaXMuZGlzcGxheSgpO1xuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJGb2xkZXJEZWZhdWx0UnVsZXMoZm9sZGVyUnVsZVRhYkNvbnRlbnQ6IEhUTUxFbGVtZW50KSB7XG5cdFx0Zm9sZGVyUnVsZVRhYkNvbnRlbnQuYWRkQ2xhc3MoXCJhdXRvLWZyb250bWF0dGVyLWZvbGRlci1ydWxlcy10YWJcIik7XG5cdFx0Y29uc3Qgc2VjdGlvbkVsID0gZm9sZGVyUnVsZVRhYkNvbnRlbnQuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItZm9sZGVyLXJ1bGVzLXNlY3Rpb25cIiB9KTtcblx0XHRjb25zdCBoZWFkZXJFbCA9IHNlY3Rpb25FbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1mb2xkZXItcnVsZXMtaGVhZGVyXCIgfSk7XG5cdFx0Y29uc3QgaGVhZGVyVG9wRWwgPSBoZWFkZXJFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1mb2xkZXItcnVsZXMtaGVhZGVyLXRvcFwiIH0pO1xuXHRcdGhlYWRlclRvcEVsLmNyZWF0ZUVsKFwiaDJcIiwgeyB0ZXh0OiBcIuaWh+S7tuWkueWGheaWh+aho+WxnuaAp+WMuemFjeinhOWImVwiIH0pO1xuXHRcdGNvbnN0IGFkZFJ1bGVFbCA9IGhlYWRlclRvcEVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLWZvbGRlci1ydWxlcy1hZGQtYWN0aW9uXCIgfSk7XG5cdFx0bmV3IFNldHRpbmcoYWRkUnVsZUVsKS5hZGRCdXR0b24oKGJ1dHRvbikgPT4ge1xuXHRcdFx0YnV0dG9uLnNldEJ1dHRvblRleHQoXCLmt7vliqDop4TliJlcIikuc2V0Q3RhKCkub25DbGljayhhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGlmICghdGhpcy5wbHVnaW4uZW5zdXJlRGV2aWNlQm91bmQoKSkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5mb2xkZXJEZWZhdWx0cy5wdXNoKHRoaXMucGx1Z2luLmNyZWF0ZUZvbGRlclJ1bGUoKSk7XG5cdFx0XHRcdGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdFx0XHR0aGlzLmN1cnJlbnRSdWxlUGFnZSA9IE1hdGgubWF4KDAsIE1hdGguY2VpbCh0aGlzLnBsdWdpbi5zZXR0aW5ncy5mb2xkZXJEZWZhdWx0cy5sZW5ndGggLyBSVUxFU19QRVJfUEFHRSkgLSAxKTtcblx0XHRcdFx0dGhpcy5kaXNwbGF5KCk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0XHRoZWFkZXJFbC5jcmVhdGVFbChcInBcIiwge1xuXHRcdFx0Y2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItZm9sZGVyLXJ1bGVzLXN1YnRpdGxlXCIsXG5cdFx0XHR0ZXh0OiBcIuaLluWFpeinhOWImeaWh+S7tuWkueWGheeahOaJgOaciW1k5paH5Lu277yM6buY6K6k55qE5paH5Lu25bGe5oCn5a2X5q615Lya6Lef6ZqP5Yy56YWN6KeE5YiZ6LWwXCIsXG5cdFx0fSk7XG5cdFx0aGVhZGVyRWwuY3JlYXRlRWwoXCJwXCIsIHtcblx0XHRcdGNsczogXCJhdXRvLWZyb250bWF0dGVyLWZvbGRlci1ydWxlcy1ub3RlXCIsXG5cdFx0XHR0ZXh0OiAn5b2T5YmN5LuF5pSv5oyB6K6+572uXCLpobnnm65cIlwi57G75Z6LXCLlrZfmrrUnLFxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgZm9sZGVycyA9IGdldFZhdWx0Rm9sZGVycyh0aGlzLmFwcCk7XG5cdFx0dGhpcy5yZW5kZXJSdWxlQ2Fyb3VzZWwoc2VjdGlvbkVsLCBmb2xkZXJzKTtcblxuXHRcdHNlY3Rpb25FbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1zZWN0aW9uLWRpdmlkZXJcIiB9KTtcblxuXHRcdGNvbnN0IGNoZWNrbWFya1NldHRpbmdFbCA9IHNlY3Rpb25FbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1mb2xkZXItY2hlY2ttYXJrLXNldHRpbmdcIiB9KTtcblx0XHRuZXcgU2V0dGluZyhjaGVja21hcmtTZXR0aW5nRWwpXG5cdFx0XHQuc2V0TmFtZShcIuWcqOaWh+S7tuWIl+ihqOS4reagh+iusOW3sumFjeinhOWImeeahOaWh+S7tuWkuVwiKVxuXHRcdFx0LmFkZFRvZ2dsZSgodG9nZ2xlKSA9PiB7XG5cdFx0XHRcdHRvZ2dsZVxuXHRcdFx0XHRcdC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5zaG93Rm9sZGVyQ2hlY2ttYXJrKVxuXHRcdFx0XHRcdC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcblx0XHRcdFx0XHRcdGlmICghdGhpcy5wbHVnaW4uZW5zdXJlRGV2aWNlQm91bmQoKSkge1xuXHRcdFx0XHRcdFx0XHR0aGlzLmRpc3BsYXkoKTtcblx0XHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3Muc2hvd0ZvbGRlckNoZWNrbWFyayA9IHZhbHVlO1xuXHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5yZWZyZXNoRm9sZGVyQ2hlY2ttYXJrcygpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cblx0XHRzZWN0aW9uRWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItc2VjdGlvbi1kaXZpZGVyXCIgfSk7XG5cblx0XHR0aGlzLnJlbmRlclVubWF0Y2hlZEZvbGRlclNlY3Rpb24oc2VjdGlvbkVsKTtcblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyUnVsZUNhcm91c2VsKGZvbGRlclJ1bGVTZWN0aW9uRWw6IEhUTUxFbGVtZW50LCBmb2xkZXJzOiBzdHJpbmdbXSkge1xuXHRcdGNvbnN0IHJ1bGVDb3VudCA9IHRoaXMucGx1Z2luLnNldHRpbmdzLmZvbGRlckRlZmF1bHRzLmxlbmd0aDtcblx0XHRjb25zdCBwYWdlQ291bnQgPSBNYXRoLm1heCgxLCBNYXRoLmNlaWwocnVsZUNvdW50IC8gUlVMRVNfUEVSX1BBR0UpKTtcblx0XHR0aGlzLmN1cnJlbnRSdWxlUGFnZSA9IGNsYW1wKHRoaXMuY3VycmVudFJ1bGVQYWdlLCAwLCBwYWdlQ291bnQgLSAxKTtcblxuXHRcdGNvbnN0IGNhcm91c2VsRWwgPSBmb2xkZXJSdWxlU2VjdGlvbkVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLXJ1bGUtY2Fyb3VzZWxcIiB9KTtcblx0XHRjb25zdCB2aWV3cG9ydEVsID0gY2Fyb3VzZWxFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1ydWxlLWNhcm91c2VsLXZpZXdwb3J0XCIgfSk7XG5cdFx0Y29uc3QgaGFzTXVsdGlwbGVQYWdlcyA9IHBhZ2VDb3VudCA+IDE7XG5cblx0XHRpZiAoaGFzTXVsdGlwbGVQYWdlcykge1xuXHRcdFx0dGhpcy5yZW5kZXJSdWxlUGFnZUJ1dHRvbih2aWV3cG9ydEVsLCBcImxlZnRcIiwgdGhpcy5jdXJyZW50UnVsZVBhZ2UgPT09IDAsICgpID0+IHtcblx0XHRcdFx0dGhpcy5jdXJyZW50UnVsZVBhZ2UgPSBNYXRoLm1heCgwLCB0aGlzLmN1cnJlbnRSdWxlUGFnZSAtIDEpO1xuXHRcdFx0XHR0aGlzLmRpc3BsYXkoKTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJ1bGVHcmlkRWwgPSB2aWV3cG9ydEVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLXJ1bGUtZ3JpZFwiIH0pO1xuXHRcdGNvbnN0IHBhZ2VTdGFydCA9IHRoaXMuY3VycmVudFJ1bGVQYWdlICogUlVMRVNfUEVSX1BBR0U7XG5cdFx0Y29uc3QgcGFnZVJ1bGVzID0gdGhpcy5wbHVnaW4uc2V0dGluZ3MuZm9sZGVyRGVmYXVsdHMuc2xpY2UocGFnZVN0YXJ0LCBwYWdlU3RhcnQgKyBSVUxFU19QRVJfUEFHRSk7XG5cblx0XHRpZiAocnVsZUNvdW50ID09PSAwKSB7XG5cdFx0XHRydWxlR3JpZEVsLmNyZWF0ZURpdih7XG5cdFx0XHRcdGNsczogXCJhdXRvLWZyb250bWF0dGVyLXJ1bGUtZW1wdHlcIixcblx0XHRcdFx0dGV4dDogXCLmmoLml6Dop4TliJlcIixcblx0XHRcdH0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRmb3IgKGxldCBwYWdlSW5kZXggPSAwOyBwYWdlSW5kZXggPCBwYWdlUnVsZXMubGVuZ3RoOyBwYWdlSW5kZXgrKykge1xuXHRcdFx0XHR0aGlzLnJlbmRlclJ1bGVDYXJkKHJ1bGVHcmlkRWwsIHBhZ2VSdWxlc1twYWdlSW5kZXhdLCBwYWdlU3RhcnQgKyBwYWdlSW5kZXgsIGZvbGRlcnMpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChoYXNNdWx0aXBsZVBhZ2VzKSB7XG5cdFx0XHR0aGlzLnJlbmRlclJ1bGVQYWdlQnV0dG9uKHZpZXdwb3J0RWwsIFwicmlnaHRcIiwgdGhpcy5jdXJyZW50UnVsZVBhZ2UgPT09IHBhZ2VDb3VudCAtIDEsICgpID0+IHtcblx0XHRcdFx0dGhpcy5jdXJyZW50UnVsZVBhZ2UgPSBNYXRoLm1pbihwYWdlQ291bnQgLSAxLCB0aGlzLmN1cnJlbnRSdWxlUGFnZSArIDEpO1xuXHRcdFx0XHR0aGlzLmRpc3BsYXkoKTtcblx0XHRcdH0pO1xuXG5cdFx0XHRjb25zdCBkb3RzRWwgPSBjYXJvdXNlbEVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLXJ1bGUtZG90c1wiIH0pO1xuXHRcdFx0Zm9yIChsZXQgcGFnZSA9IDA7IHBhZ2UgPCBwYWdlQ291bnQ7IHBhZ2UrKykge1xuXHRcdFx0XHRjb25zdCBkb3RFbCA9IGRvdHNFbC5jcmVhdGVFbChcImJ1dHRvblwiLCB7XG5cdFx0XHRcdFx0Y2xzOiBgYXV0by1mcm9udG1hdHRlci1ydWxlLWRvdCR7cGFnZSA9PT0gdGhpcy5jdXJyZW50UnVsZVBhZ2UgPyBcIiBpcy1hY3RpdmVcIiA6IFwiXCJ9YCxcblx0XHRcdFx0XHRhdHRyOiB7IFwiYXJpYS1sYWJlbFwiOiBg6Lez6L2s5Yiw56ysICR7cGFnZSArIDF9IOmhtWAgfSxcblx0XHRcdFx0fSk7XG5cdFx0XHRcdGRvdEVsLm9uY2xpY2sgPSAoKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5jdXJyZW50UnVsZVBhZ2UgPSBwYWdlO1xuXHRcdFx0XHRcdHRoaXMuZGlzcGxheSgpO1xuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyUnVsZVBhZ2VCdXR0b24oXG5cdFx0cnVsZUNhcm91c2VsVmlld3BvcnRFbDogSFRNTEVsZW1lbnQsXG5cdFx0ZGlyZWN0aW9uOiBcImxlZnRcIiB8IFwicmlnaHRcIixcblx0XHRkaXNhYmxlZDogYm9vbGVhbixcblx0XHRvbkNsaWNrOiAoKSA9PiB2b2lkLFxuXHQpIHtcblx0XHRjb25zdCBidXR0b25FbCA9IHJ1bGVDYXJvdXNlbFZpZXdwb3J0RWwuY3JlYXRlRWwoXCJidXR0b25cIiwge1xuXHRcdFx0Y2xzOiBgYXV0by1mcm9udG1hdHRlci1ydWxlLW5hdiBpcy0ke2RpcmVjdGlvbn0ke2Rpc2FibGVkID8gXCIgaXMtZGlzYWJsZWRcIiA6IFwiXCJ9YCxcblx0XHRcdGF0dHI6IHsgXCJhcmlhLWxhYmVsXCI6IGRpcmVjdGlvbiA9PT0gXCJsZWZ0XCIgPyBcIuS4iuS4gOmhtVwiIDogXCLkuIvkuIDpobVcIiB9LFxuXHRcdH0pO1xuXHRcdHNldEljb24oYnV0dG9uRWwsIGRpcmVjdGlvbiA9PT0gXCJsZWZ0XCIgPyBcImNoZXZyb24tbGVmdFwiIDogXCJjaGV2cm9uLXJpZ2h0XCIpO1xuXHRcdGJ1dHRvbkVsLmRpc2FibGVkID0gZGlzYWJsZWQ7XG5cdFx0YnV0dG9uRWwub25jbGljayA9IG9uQ2xpY2s7XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlclJ1bGVDYXJkKFxuXHRcdHJ1bGVHcmlkRWw6IEhUTUxFbGVtZW50LFxuXHRcdHJ1bGU6IEZvbGRlckRlZmF1bHRSdWxlLFxuXHRcdHJ1bGVJbmRleDogbnVtYmVyLFxuXHRcdGZvbGRlcnM6IHN0cmluZ1tdLFxuXHQpIHtcblx0XHRjb25zdCBydWxlQ2FyZCA9IHJ1bGVHcmlkRWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItcnVsZS1jYXJkXCIgfSk7XG5cdFx0Y29uc3QgdG9wUm93ID0gcnVsZUNhcmQuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItcnVsZS10b3Atcm93XCIgfSk7XG5cdFx0dG9wUm93LmNyZWF0ZVNwYW4oe1xuXHRcdFx0Y2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItcnVsZS10aXRsZVwiLFxuXHRcdFx0dGV4dDogYOinhOWImSAke3J1bGVJbmRleCArIDF9YCxcblx0XHR9KTtcblxuXHRcdGNvbnN0IGRlbGV0ZUJ1dHRvbiA9IHRvcFJvdy5jcmVhdGVFbChcImJ1dHRvblwiLCB7XG5cdFx0XHRjbHM6IFwiYXV0by1mcm9udG1hdHRlci1ydWxlLWRlbGV0ZVwiLFxuXHRcdFx0YXR0cjogeyBcImFyaWEtbGFiZWxcIjogXCLliKDpmaTop4TliJlcIiB9LFxuXHRcdH0pO1xuXHRcdHNldEljb24oZGVsZXRlQnV0dG9uLCBcInRyYXNoLTJcIik7XG5cdFx0ZGVsZXRlQnV0dG9uLm9uY2xpY2sgPSBhc3luYyAoKSA9PiB7XG5cdFx0XHRpZiAoIXRoaXMucGx1Z2luLmVuc3VyZURldmljZUJvdW5kKCkpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MuZm9sZGVyRGVmYXVsdHMuc3BsaWNlKHJ1bGVJbmRleCwgMSk7XG5cdFx0XHRhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdGNvbnN0IHBhZ2VDb3VudCA9IE1hdGgubWF4KDEsIE1hdGguY2VpbCh0aGlzLnBsdWdpbi5zZXR0aW5ncy5mb2xkZXJEZWZhdWx0cy5sZW5ndGggLyBSVUxFU19QRVJfUEFHRSkpO1xuXHRcdFx0dGhpcy5jdXJyZW50UnVsZVBhZ2UgPSBjbGFtcCh0aGlzLmN1cnJlbnRSdWxlUGFnZSwgMCwgcGFnZUNvdW50IC0gMSk7XG5cdFx0XHR0aGlzLmRpc3BsYXkoKTtcblx0XHR9O1xuXG5cdFx0Y29uc3QgZm9sZGVyUm93RWwgPSBydWxlQ2FyZC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1ydWxlLWZvbGRlci1yb3dcIiB9KTtcblx0XHRmb2xkZXJSb3dFbC5jcmVhdGVTcGFuKHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItcnVsZS1mb2xkZXItaWNvblwiLCB0ZXh0OiBcIvCfk4FcIiB9KTtcblx0XHR0aGlzLnJlbmRlclJ1bGVJbmxpbmVGb2xkZXJFZGl0b3IoZm9sZGVyUm93RWwsIHJ1bGUsIGZvbGRlcnMpO1xuXG5cdFx0Y29uc3QgdmFsdWVSb3dFbCA9IHJ1bGVDYXJkLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLXJ1bGUtdmFsdWUtcm93XCIgfSk7XG5cdFx0dGhpcy5yZW5kZXJSdWxlSW5saW5lRmllbGRFZGl0b3IodmFsdWVSb3dFbCwgcnVsZSk7XG5cdFx0dmFsdWVSb3dFbC5jcmVhdGVTcGFuKHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItcnVsZS1hcnJvd1wiLCB0ZXh0OiBcIuKGklwiIH0pO1xuXHRcdHRoaXMucmVuZGVyUnVsZUlubGluZVZhbHVlRWRpdG9yKHZhbHVlUm93RWwsIHJ1bGUpO1xuXG5cdFx0Y29uc3QgYXVkaXRFbCA9IHJ1bGVDYXJkLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLXJ1bGUtYXVkaXRcIiB9KTtcblx0XHRpZiAoIXJ1bGUuY3JlYXRlZEJ5IHx8ICFydWxlLmNyZWF0ZWRBdCkge1xuXHRcdFx0YXVkaXRFbC5zZXRUZXh0KFwi5Yib5bu65L+h5oGv5LiN5Y+v6L+95rqvXCIpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRhdWRpdEVsLmNyZWF0ZURpdih7IHRleHQ6IGDnlLEgJHtydWxlLmNyZWF0ZWRCeX1gIH0pO1xuXHRcdFx0YXVkaXRFbC5jcmVhdGVEaXYoeyB0ZXh0OiBmb3JtYXRBdWRpdFRpbWUocnVsZS5jcmVhdGVkQXQpIH0pO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyUnVsZUlubGluZUZvbGRlckVkaXRvcihcblx0XHRjb250YWluZXJFbDogSFRNTEVsZW1lbnQsXG5cdFx0cnVsZTogRm9sZGVyRGVmYXVsdFJ1bGUsXG5cdFx0Zm9sZGVyczogc3RyaW5nW10sXG5cdCkge1xuXHRcdHRoaXMuY3JlYXRlSW5saW5lUnVsZVZhcmlhYmxlKGNvbnRhaW5lckVsLCBmb3JtYXRSdWxlSW5saW5lVmFsdWUocnVsZS5mb2xkZXIpLCAoc3BhbkVsKSA9PiB7XG5cdFx0XHR0aGlzLm9wZW5JbmxpbmVSdWxlU2VsZWN0RWRpdG9yKFxuXHRcdFx0XHRzcGFuRWwsXG5cdFx0XHRcdHJ1bGUsXG5cdFx0XHRcdHJ1bGUuZm9sZGVyLFxuXHRcdFx0XHRmb2xkZXJzLm1hcCgoZm9sZGVyKSA9PiAoe1xuXHRcdFx0XHRcdHZhbHVlOiBmb2xkZXIsXG5cdFx0XHRcdFx0bGFiZWw6IGZvcm1hdEZvbGRlck9wdGlvbkxhYmVsKGZvbGRlciksXG5cdFx0XHRcdH0pKSxcblx0XHRcdFx0YXN5bmMgKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0cnVsZS5mb2xkZXIgPSB2YWx1ZTtcblx0XHRcdFx0fSxcblx0XHRcdCk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlclJ1bGVJbmxpbmVGaWVsZEVkaXRvcihjb250YWluZXJFbDogSFRNTEVsZW1lbnQsIHJ1bGU6IEZvbGRlckRlZmF1bHRSdWxlKSB7XG5cdFx0dGhpcy5jcmVhdGVJbmxpbmVSdWxlVmFyaWFibGUoY29udGFpbmVyRWwsIGZvcm1hdFJ1bGVJbmxpbmVWYWx1ZShydWxlLmZpZWxkKSwgKHNwYW5FbCkgPT4ge1xuXHRcdFx0dGhpcy5vcGVuSW5saW5lUnVsZVNlbGVjdEVkaXRvcihcblx0XHRcdFx0c3BhbkVsLFxuXHRcdFx0XHRydWxlLFxuXHRcdFx0XHRydWxlLmZpZWxkLFxuXHRcdFx0XHRGT0xERVJfREVGQVVMVF9GSUVMRFMubWFwKChmaWVsZCkgPT4gKHsgdmFsdWU6IGZpZWxkLCBsYWJlbDogZmllbGQgfSkpLFxuXHRcdFx0XHRhc3luYyAodmFsdWUpID0+IHtcblx0XHRcdFx0XHRydWxlLmZpZWxkID0gdmFsdWUgYXMgRm9sZGVyRGVmYXVsdEZpZWxkO1xuXHRcdFx0XHRcdHJ1bGUudmFsdWUgPSBcIlwiO1xuXHRcdFx0XHR9LFxuXHRcdFx0KTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyUnVsZUlubGluZVZhbHVlRWRpdG9yKGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCwgcnVsZTogRm9sZGVyRGVmYXVsdFJ1bGUpIHtcblx0XHR0aGlzLmNyZWF0ZUlubGluZVJ1bGVWYXJpYWJsZShjb250YWluZXJFbCwgZm9ybWF0UnVsZUlubGluZVZhbHVlKHJ1bGUudmFsdWUpLCAoc3BhbkVsKSA9PiB7XG5cdFx0XHRjb25zdCBjYW5kaWRhdGVzID0gZ2V0RnJvbnRtYXR0ZXJGaWVsZENhbmRpZGF0ZXModGhpcy5hcHAsIHJ1bGUuZmllbGQpO1xuXHRcdFx0Y29uc3QgdmFsdWVzID1cblx0XHRcdFx0cnVsZS52YWx1ZSAmJiAhY2FuZGlkYXRlcy5pbmNsdWRlcyhydWxlLnZhbHVlKSA/IFsuLi5jYW5kaWRhdGVzLCBydWxlLnZhbHVlXSA6IGNhbmRpZGF0ZXM7XG5cdFx0XHR0aGlzLm9wZW5JbmxpbmVSdWxlU2VsZWN0RWRpdG9yKFxuXHRcdFx0XHRzcGFuRWwsXG5cdFx0XHRcdHJ1bGUsXG5cdFx0XHRcdHJ1bGUudmFsdWUsXG5cdFx0XHRcdFtcblx0XHRcdFx0XHQuLi52YWx1ZXMubWFwKCh2YWx1ZSkgPT4gKHsgdmFsdWUsIGxhYmVsOiB2YWx1ZSB9KSksXG5cdFx0XHRcdFx0eyB2YWx1ZTogXCJfX25ld19fXCIsIGxhYmVsOiBcIuiHquWumuS5iVwiIH0sXG5cdFx0XHRcdF0sXG5cdFx0XHRcdGFzeW5jICh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdGlmICh2YWx1ZSA9PT0gXCJfX25ld19fXCIpIHtcblx0XHRcdFx0XHRcdHRoaXMub3BlbklubGluZVJ1bGVJbnB1dEVkaXRvcihzcGFuRWwsIHJ1bGUsIHJ1bGUudmFsdWUsIGFzeW5jIChuZXh0VmFsdWUpID0+IHtcblx0XHRcdFx0XHRcdFx0cnVsZS52YWx1ZSA9IG5leHRWYWx1ZTtcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0cmV0dXJuIFwiZGVmZXJcIjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cnVsZS52YWx1ZSA9IHZhbHVlO1xuXHRcdFx0XHR9LFxuXHRcdFx0KTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlSW5saW5lUnVsZVZhcmlhYmxlKFxuXHRcdGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCxcblx0XHR0ZXh0OiBzdHJpbmcsXG5cdFx0b25DbGljazogKHNwYW5FbDogSFRNTFNwYW5FbGVtZW50KSA9PiB2b2lkLFxuXHQpIHtcblx0XHRjb25zdCBzcGFuRWwgPSBjb250YWluZXJFbC5jcmVhdGVFbChcInNwYW5cIiwge1xuXHRcdFx0Y2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItcnVsZS1pbmxpbmUtdmFsdWVcIixcblx0XHRcdHRleHQsXG5cdFx0fSk7XG5cdFx0c3BhbkVsLnRhYkluZGV4ID0gMDtcblx0XHRzcGFuRWwuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChldmVudCkgPT4ge1xuXHRcdFx0ZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0XHRvbkNsaWNrKHNwYW5FbCk7XG5cdFx0fSk7XG5cdFx0c3BhbkVsLmFkZEV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsIChldmVudCkgPT4ge1xuXHRcdFx0aWYgKGV2ZW50LmtleSA9PT0gXCJFbnRlclwiIHx8IGV2ZW50LmtleSA9PT0gXCIgXCIpIHtcblx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0b25DbGljayhzcGFuRWwpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBvcGVuSW5saW5lUnVsZVNlbGVjdEVkaXRvcihcblx0XHRjb250YWluZXJFbDogSFRNTEVsZW1lbnQsXG5cdFx0cnVsZTogRm9sZGVyRGVmYXVsdFJ1bGUsXG5cdFx0Y3VycmVudFZhbHVlOiBzdHJpbmcsXG5cdFx0b3B0aW9uczogQXJyYXk8eyB2YWx1ZTogc3RyaW5nOyBsYWJlbDogc3RyaW5nIH0+LFxuXHRcdG9uQ29tbWl0OiAodmFsdWU6IHN0cmluZykgPT4gUHJvbWlzZTx2b2lkIHwgXCJkZWZlclwiPixcblx0KSB7XG5cdFx0dGhpcy5jbG9zZUFjdGl2ZUlubGluZUVkaXRvcigpO1xuXHRcdGNvbnN0IG92ZXJsYXlFbCA9IGNvbnRhaW5lckVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLXJ1bGUtaW5saW5lLWVkaXRvclwiIH0pO1xuXHRcdGNvbnN0IHNlbGVjdEVsID0gb3ZlcmxheUVsLmNyZWF0ZUVsKFwic2VsZWN0XCIsIHtcblx0XHRcdGNsczogXCJkcm9wZG93biBhdXRvLWZyb250bWF0dGVyLXJ1bGUtaW5saW5lLXNlbGVjdFwiLFxuXHRcdH0pO1xuXHRcdGZvciAoY29uc3Qgb3B0aW9uIG9mIG9wdGlvbnMpIHtcblx0XHRcdGNvbnN0IG9wdGlvbkVsID0gc2VsZWN0RWwuY3JlYXRlRWwoXCJvcHRpb25cIiwge1xuXHRcdFx0XHR2YWx1ZTogb3B0aW9uLnZhbHVlLFxuXHRcdFx0XHR0ZXh0OiBvcHRpb24ubGFiZWwsXG5cdFx0XHR9KTtcblx0XHRcdGlmIChvcHRpb24udmFsdWUgPT09IFwiX19uZXdfX1wiKSB7XG5cdFx0XHRcdG9wdGlvbkVsLnNlbGVjdGVkID0gY3VycmVudFZhbHVlLmxlbmd0aCA9PT0gMDtcblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKGN1cnJlbnRWYWx1ZSAmJiBvcHRpb25zLnNvbWUoKG9wdGlvbikgPT4gb3B0aW9uLnZhbHVlID09PSBjdXJyZW50VmFsdWUpKSB7XG5cdFx0XHRzZWxlY3RFbC52YWx1ZSA9IGN1cnJlbnRWYWx1ZTtcblx0XHR9XG5cblx0XHRjb25zdCBjbG9zZURyb3Bkb3duID0gdGhpcy5jcmVhdGVJbmxpbmVEcm9wZG93bkNsb3NlcihvdmVybGF5RWwpO1xuXG5cdFx0c2VsZWN0RWwuYWRkRXZlbnRMaXN0ZW5lcihcImNoYW5nZVwiLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBzZWxlY3RlZFZhbHVlID0gc2VsZWN0RWwudmFsdWU7XG5cdFx0XHRjbG9zZURyb3Bkb3duKCk7XG5cdFx0XHRpZiAoc2VsZWN0ZWRWYWx1ZSA9PT0gXCJfX25ld19fXCIpIHtcblx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgb25Db21taXQoc2VsZWN0ZWRWYWx1ZSk7XG5cdFx0XHRcdGlmIChyZXN1bHQgIT09IFwiZGVmZXJcIikge1xuXHRcdFx0XHRcdGNsb3NlRHJvcGRvd24oKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRhd2FpdCB0aGlzLnNhdmVJbmxpbmVSdWxlQ2hhbmdlKHJ1bGUsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0YXdhaXQgb25Db21taXQoc2VsZWN0ZWRWYWx1ZSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0XHRzZWxlY3RFbC5hZGRFdmVudExpc3RlbmVyKFwiYmx1clwiLCAoKSA9PiB7XG5cdFx0XHR3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHRcdGNsb3NlRHJvcGRvd24oKTtcblx0XHRcdH0sIDEwMCk7XG5cdFx0fSk7XG5cblx0XHR3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHRzZWxlY3RFbC5mb2N1cygpO1xuXHRcdFx0Y29uc3QgcGlja2VyRWwgPSBzZWxlY3RFbCBhcyBIVE1MU2VsZWN0RWxlbWVudCAmIHsgc2hvd1BpY2tlcj86ICgpID0+IHZvaWQgfTtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGlmIChwaWNrZXJFbC5zaG93UGlja2VyKSB7XG5cdFx0XHRcdFx0cGlja2VyRWwuc2hvd1BpY2tlcigpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHNlbGVjdEVsLmNsaWNrKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0gY2F0Y2ggKF9lcnJvcikge1xuXHRcdFx0XHRzZWxlY3RFbC5jbGljaygpO1xuXHRcdFx0fVxuXHRcdH0sIDApO1xuXHR9XG5cblx0cHJpdmF0ZSBvcGVuSW5saW5lUnVsZUlucHV0RWRpdG9yKFxuXHRcdGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCxcblx0XHRydWxlOiBGb2xkZXJEZWZhdWx0UnVsZSxcblx0XHRjdXJyZW50VmFsdWU6IHN0cmluZyxcblx0XHRvbkNvbW1pdDogKHZhbHVlOiBzdHJpbmcpID0+IFByb21pc2U8dm9pZD4sXG5cdCkge1xuXHRcdHRoaXMuY2xvc2VBY3RpdmVJbmxpbmVFZGl0b3IoKTtcblx0XHRjb25zdCBvdmVybGF5RWwgPSBjb250YWluZXJFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1ydWxlLWlubGluZS1lZGl0b3JcIiB9KTtcblx0XHRjb25zdCBpbnB1dEVsID0gb3ZlcmxheUVsLmNyZWF0ZUVsKFwiaW5wdXRcIiwge1xuXHRcdFx0Y2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItcnVsZS1pbmxpbmUtaW5wdXRcIixcblx0XHRcdHR5cGU6IFwidGV4dFwiLFxuXHRcdFx0dmFsdWU6IGN1cnJlbnRWYWx1ZSxcblx0XHR9KTtcblxuXHRcdGNvbnN0IGNsb3NlRHJvcGRvd24gPSB0aGlzLmNyZWF0ZUlubGluZURyb3Bkb3duQ2xvc2VyKG92ZXJsYXlFbCk7XG5cdFx0Y29uc3QgZmluYWxpemUgPSBhc3luYyAoKSA9PiB7XG5cdFx0XHRpZiAoY2xvc2VEcm9wZG93bigpKSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuc2F2ZUlubGluZVJ1bGVDaGFuZ2UocnVsZSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdGF3YWl0IG9uQ29tbWl0KGlucHV0RWwudmFsdWUpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0aW5wdXRFbC5hZGRFdmVudExpc3RlbmVyKFwiYmx1clwiLCAoKSA9PiB7XG5cdFx0XHR3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHRcdHZvaWQgY2xvc2VEcm9wZG93bigpO1xuXHRcdFx0fSwgMTAwKTtcblx0XHR9KTtcblx0XHRpbnB1dEVsLmFkZEV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsIChldmVudCkgPT4ge1xuXHRcdFx0aWYgKGV2ZW50LmtleSA9PT0gXCJFbnRlclwiKSB7XG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdHZvaWQgZmluYWxpemUoKTtcblx0XHRcdH1cblx0XHRcdGlmIChldmVudC5rZXkgPT09IFwiRXNjYXBlXCIpIHtcblx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0Y2xvc2VEcm9wZG93bigpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0d2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0aW5wdXRFbC5mb2N1cygpO1xuXHRcdFx0aW5wdXRFbC5zZWxlY3QoKTtcblx0XHR9LCAwKTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlSW5saW5lRHJvcGRvd25DbG9zZXIob3ZlcmxheUVsOiBIVE1MRWxlbWVudCkge1xuXHRcdGxldCBjbG9zZWQgPSBmYWxzZTtcblx0XHRjb25zdCBjbG9zZURyb3Bkb3duID0gKCkgPT4ge1xuXHRcdFx0aWYgKGNsb3NlZCkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRjbG9zZWQgPSB0cnVlO1xuXHRcdFx0b3ZlcmxheUVsLnF1ZXJ5U2VsZWN0b3JBbGwoXCJzZWxlY3QsIGlucHV0XCIpLmZvckVhY2goKGVsKSA9PiBlbC5yZW1vdmUoKSk7XG5cdFx0XHRpZiAob3ZlcmxheUVsLmlzQ29ubmVjdGVkKSB7XG5cdFx0XHRcdG92ZXJsYXlFbC5yZW1vdmUoKTtcblx0XHRcdH1cblx0XHRcdGlmICh0aGlzLmFjdGl2ZUlubGluZUVkaXRvckNsZWFudXAgPT09IGNsb3NlRHJvcGRvd24pIHtcblx0XHRcdFx0dGhpcy5hY3RpdmVJbmxpbmVFZGl0b3JDbGVhbnVwID0gbnVsbDtcblx0XHRcdH1cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH07XG5cdFx0dGhpcy5hY3RpdmVJbmxpbmVFZGl0b3JDbGVhbnVwID0gY2xvc2VEcm9wZG93bjtcblx0XHRyZXR1cm4gY2xvc2VEcm9wZG93bjtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgc2F2ZUlubGluZVJ1bGVDaGFuZ2UocnVsZTogRm9sZGVyRGVmYXVsdFJ1bGUsIHVwZGF0ZTogKCkgPT4gUHJvbWlzZTx2b2lkPikge1xuXHRcdGlmICghdGhpcy5wbHVnaW4uZW5zdXJlRGV2aWNlQm91bmQoKSkge1xuXHRcdFx0dGhpcy5kaXNwbGF5KCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGF3YWl0IHVwZGF0ZSgpO1xuXHRcdHRoaXMucGx1Z2luLnRvdWNoRm9sZGVyUnVsZShydWxlKTtcblx0XHRhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHR0aGlzLmRpc3BsYXkoKTtcblx0fVxuXG5cdHByaXZhdGUgY2xvc2VBY3RpdmVJbmxpbmVFZGl0b3IoKSB7XG5cdFx0dGhpcy5hY3RpdmVJbmxpbmVFZGl0b3JDbGVhbnVwPy4oKTtcblx0XHR0aGlzLmFjdGl2ZUlubGluZUVkaXRvckNsZWFudXAgPSBudWxsO1xuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJVbm1hdGNoZWRGb2xkZXJTZWN0aW9uKGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCkge1xuXHRcdGNvbnN0IHNlY3Rpb25FbCA9IGNvbnRhaW5lckVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLXVubWF0Y2hlZC1zZWN0aW9uXCIgfSk7XG5cdFx0Y29uc3QgaGVhZGVyRWwgPSBzZWN0aW9uRWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItdW5tYXRjaGVkLWhlYWRlclwiIH0pO1xuXHRcdGhlYWRlckVsLmNyZWF0ZUVsKFwiaDNcIiwgeyB0ZXh0OiBcIuaXoOWMuemFjeinhOWImeeahOaWh+S7tuWkuVwiIH0pO1xuXHRcdGNvbnN0IGFjdGlvbkVsID0gaGVhZGVyRWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItdW5tYXRjaGVkLWFjdGlvblwiIH0pO1xuXHRcdG5ldyBTZXR0aW5nKGFjdGlvbkVsKS5hZGRCdXR0b24oKGJ1dHRvbikgPT4ge1xuXHRcdFx0YnV0dG9uXG5cdFx0XHRcdC5zZXRCdXR0b25UZXh0KHRoaXMuaXNTY2FubmluZ1VubWF0Y2hlZEZvbGRlcnMgPyBcIuaJq+aPj+S4rS4uLlwiIDogXCLmiavmj49cIilcblx0XHRcdFx0LnNldERpc2FibGVkKHRoaXMuaXNTY2FubmluZ1VubWF0Y2hlZEZvbGRlcnMpXG5cdFx0XHRcdC5vbkNsaWNrKGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLnNjYW5Vbm1hdGNoZWRGb2xkZXJzKCk7XG5cdFx0XHRcdH0pO1xuXHRcdH0pO1xuXHRcdHNlY3Rpb25FbC5jcmVhdGVFbChcInBcIiwge1xuXHRcdFx0Y2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItdW5tYXRjaGVkLXN1YnRpdGxlXCIsXG5cdFx0XHR0ZXh0OiBcIuS7peS4i+aWh+S7tuWkueWwmuacquiuvue9ruS7u+S9leWxnuaAp+WMuemFjeinhOWImeOAglwiLFxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgcmVzdWx0RWwgPSBzZWN0aW9uRWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItdW5tYXRjaGVkLXJlc3VsdHNcIiB9KTtcblx0XHRpZiAoIXRoaXMuaGFzU2Nhbm5lZFVubWF0Y2hlZEZvbGRlcnMpIHtcblx0XHRcdHJlc3VsdEVsLmNyZWF0ZURpdih7XG5cdFx0XHRcdGNsczogXCJhdXRvLWZyb250bWF0dGVyLXVubWF0Y2hlZC1lbXB0eVwiLFxuXHRcdFx0XHR0ZXh0OiBcIueCueWHu+aJq+aPj+afpeeci+acqumFjee9rueahOaWh+S7tuWkueOAglwiLFxuXHRcdFx0fSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMudW5tYXRjaGVkRm9sZGVycy5sZW5ndGggPT09IDApIHtcblx0XHRcdHJlc3VsdEVsLmNyZWF0ZURpdih7XG5cdFx0XHRcdGNsczogXCJhdXRvLWZyb250bWF0dGVyLXVubWF0Y2hlZC1lbXB0eVwiLFxuXHRcdFx0XHR0ZXh0OiBcIuaJgOacieaWh+S7tuWkueWdh+W3sumFjee9ruinhOWImeOAglwiLFxuXHRcdFx0fSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgbGlzdEVsID0gcmVzdWx0RWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItdW5tYXRjaGVkLWxpc3RcIiB9KTtcblx0XHRmb3IgKGNvbnN0IGZvbGRlciBvZiB0aGlzLnVubWF0Y2hlZEZvbGRlcnMpIHtcblx0XHRcdGNvbnN0IGl0ZW1FbCA9IGxpc3RFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci11bm1hdGNoZWQtaXRlbVwiIH0pO1xuXHRcdFx0Y29uc3QgY29udGVudEVsID0gaXRlbUVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLXVubWF0Y2hlZC1jb250ZW50XCIgfSk7XG5cdFx0XHRjb250ZW50RWwuY3JlYXRlRGl2KHtcblx0XHRcdFx0Y2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItdW5tYXRjaGVkLXBhdGhcIixcblx0XHRcdFx0dGV4dDogZm9sZGVyLnBhdGgsXG5cdFx0XHR9KTtcblx0XHRcdGNvbnRlbnRFbC5jcmVhdGVEaXYoe1xuXHRcdFx0XHRjbHM6IGZvbGRlci5pbmhlcml0ZWRSdWxlcy5sZW5ndGhcblx0XHRcdFx0XHQ/IFwiYXV0by1mcm9udG1hdHRlci11bm1hdGNoZWQtaGludCBpcy1pbmhlcml0ZWRcIlxuXHRcdFx0XHRcdDogXCJhdXRvLWZyb250bWF0dGVyLXVubWF0Y2hlZC1oaW50IGlzLWVtcHR5XCIsXG5cdFx0XHRcdHRleHQ6XG5cdFx0XHRcdFx0Zm9sZGVyLmluaGVyaXRlZFJ1bGVzLmxlbmd0aCA+IDBcblx0XHRcdFx0XHRcdD8gYOKGkSDniLbnuqfop4TliJnvvJoke2ZvbGRlci5pbmhlcml0ZWRSdWxlc1xuXHRcdFx0XHRcdFx0XHRcdC5tYXAoKHJ1bGUpID0+IGAke3J1bGUuZm9sZGVyfSDihpIgJHtydWxlLmZpZWxkfTogJHtydWxlLnZhbHVlfWApXG5cdFx0XHRcdFx0XHRcdFx0LmpvaW4oXCLvvIxcIil9YFxuXHRcdFx0XHRcdFx0OiBcIuaXoOS7u+S9leeItue6p+inhOWImVwiLFxuXHRcdFx0fSk7XG5cblx0XHRcdGNvbnN0IGJ1dHRvbkVsID0gaXRlbUVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLXVubWF0Y2hlZC1idXR0b25cIiB9KTtcblx0XHRcdG5ldyBTZXR0aW5nKGJ1dHRvbkVsKS5hZGRCdXR0b24oKGJ1dHRvbikgPT4ge1xuXHRcdFx0XHRidXR0b24uc2V0QnV0dG9uVGV4dChcIuiuvue9rlwiKS5vbkNsaWNrKCgpID0+IHtcblx0XHRcdFx0XHRuZXcgRm9sZGVyUnVsZU1vZGFsKHRoaXMuYXBwLCB0aGlzLnBsdWdpbiwgZm9sZGVyLnBhdGgpLm9wZW4oKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlclNjYW5TZWN0aW9uKGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCkge1xuXHRcdGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwiaDJcIiwgeyB0ZXh0OiBcIuaJq+aPj+S7k+W6k1wiIH0pO1xuXG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHQuc2V0TmFtZShcIuaJq+aPj+S7k+W6k1wiKVxuXHRcdFx0LnNldERlc2MoXCLmib7lh7rpnIDopoHooaXlhajlsZ7mgKfnmoQgTWFya2Rvd24g5paH5Lu244CCXCIpXG5cdFx0XHQuYWRkQnV0dG9uKChidXR0b24pID0+IHtcblx0XHRcdFx0YnV0dG9uXG5cdFx0XHRcdFx0LnNldEJ1dHRvblRleHQodGhpcy5pc1NjYW5uaW5nID8gXCLmiavmj4/kuK0uLi5cIiA6IFwi5omr5o+PXCIpXG5cdFx0XHRcdFx0LnNldERpc2FibGVkKHRoaXMuaXNTY2FubmluZyB8fCB0aGlzLmlzRXhlY3V0aW5nKVxuXHRcdFx0XHRcdC5vbkNsaWNrKGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRcdGlmICghdGhpcy5wbHVnaW4uZW5zdXJlRGV2aWNlQm91bmQoKSkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLnNjYW5WYXVsdCgpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cblx0XHRpZiAoIXRoaXMuaGFzU2Nhbm5lZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlc3VsdEVsID0gY29udGFpbmVyRWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItc2Nhbi1yZXN1bHRzXCIgfSk7XG5cdFx0aWYgKHRoaXMuc2NhblJlc3VsdHMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXN1bHRFbC5jcmVhdGVEaXYoe1xuXHRcdFx0XHRjbHM6IFwiYXV0by1mcm9udG1hdHRlci1zY2FuLWVtcHR5XCIsXG5cdFx0XHRcdHRleHQ6IFwi5omA5pyJ5paH5Lu25Z2H5bey5YyF5ZCr5bGe5oCnIOKck1wiLFxuXHRcdFx0fSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0cmVzdWx0RWwuY3JlYXRlRGl2KHtcblx0XHRcdGNsczogXCJhdXRvLWZyb250bWF0dGVyLXNjYW4tY291bnRcIixcblx0XHRcdHRleHQ6IGDlhbHlj5HnjrAgJHt0aGlzLnNjYW5SZXN1bHRzLmxlbmd0aH0g5Liq5paH5Lu26ZyA6KaB6KGl5YWo5bGe5oCnYCxcblx0XHR9KTtcblxuXHRcdGNvbnN0IGxpc3RFbCA9IHJlc3VsdEVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLXNjYW4tbGlzdFwiIH0pO1xuXHRcdGZvciAoY29uc3QgcmVzdWx0IG9mIHRoaXMuc2NhblJlc3VsdHMpIHtcblx0XHRcdGNvbnN0IGl0ZW1FbCA9IGxpc3RFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1zY2FuLWl0ZW1cIiB9KTtcblx0XHRcdGNvbnN0IHRpdGxlID0gcmVzdWx0LmRvbmUgPyBgJHtyZXN1bHQuZmlsZS5uYW1lfSDinJNgIDogcmVzdWx0LmZpbGUubmFtZTtcblx0XHRcdGNvbnN0IHRpdGxlRWwgPSBpdGVtRWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItc2Nhbi1uYW1lXCIsIHRleHQ6IHRpdGxlIH0pO1xuXHRcdFx0dGl0bGVFbC5jcmVhdGVTcGFuKHtcblx0XHRcdFx0Y2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItc2Nhbi1taXNzaW5nXCIsXG5cdFx0XHRcdHRleHQ6IGAgJHtmb3JtYXRTY2FuUmVhc29uKHJlc3VsdCl9YCxcblx0XHRcdH0pO1xuXHRcdFx0aXRlbUVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLXNjYW4tcGF0aFwiLCB0ZXh0OiByZXN1bHQuZmlsZS5wYXRoIH0pO1xuXHRcdH1cblxuXHRcdGNvbnN0IHN0YXR1c1RleHQgPVxuXHRcdFx0dGhpcy5wcm9jZXNzZWRDb3VudCA9PT0gdGhpcy5zY2FuUmVzdWx0cy5sZW5ndGggJiYgIXRoaXMuaXNFeGVjdXRpbmdcblx0XHRcdFx0PyBg5a6M5oiQ77yM5bey5aSE55CGICR7dGhpcy5wcm9jZXNzZWRDb3VudH0g5Liq5paH5Lu2YFxuXHRcdFx0XHQ6IFwiXCI7XG5cblx0XHRuZXcgU2V0dGluZyhyZXN1bHRFbClcblx0XHRcdC5zZXREZXNjKHN0YXR1c1RleHQpXG5cdFx0XHQuYWRkQnV0dG9uKChidXR0b24pID0+IHtcblx0XHRcdFx0YnV0dG9uXG5cdFx0XHRcdFx0LnNldEJ1dHRvblRleHQodGhpcy5pc0V4ZWN1dGluZyA/IFwi5omn6KGM5LitLi4uXCIgOiBcIuaJp+ihjFwiKVxuXHRcdFx0XHRcdC5zZXRDdGEoKVxuXHRcdFx0XHRcdC5zZXREaXNhYmxlZCh0aGlzLmlzRXhlY3V0aW5nKVxuXHRcdFx0XHRcdC5vbkNsaWNrKGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRcdGlmICghdGhpcy5wbHVnaW4uZW5zdXJlRGV2aWNlQm91bmQoKSkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLmV4ZWN1dGVTY2FuUmVzdWx0cygpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHNjYW5WYXVsdCgpIHtcblx0XHR0aGlzLmlzU2Nhbm5pbmcgPSB0cnVlO1xuXHRcdHRoaXMuaGFzU2Nhbm5lZCA9IHRydWU7XG5cdFx0dGhpcy5zY2FuUmVzdWx0cyA9IFtdO1xuXHRcdHRoaXMucHJvY2Vzc2VkQ291bnQgPSAwO1xuXHRcdHRoaXMuZGlzcGxheSgpO1xuXG5cdFx0Y29uc3QgcmVzdWx0czogU2NhblJlc3VsdFtdID0gW107XG5cdFx0Y29uc3QgZmlsZXMgPSB0aGlzLmFwcC52YXVsdC5nZXRNYXJrZG93bkZpbGVzKCk7XG5cblx0XHRmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgZmlsZXMubGVuZ3RoOyBpbmRleCsrKSB7XG5cdFx0XHRjb25zdCBmaWxlID0gZmlsZXNbaW5kZXhdO1xuXHRcdFx0Y29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LmNhY2hlZFJlYWQoZmlsZSk7XG5cdFx0XHRjb25zdCBkZWZhdWx0cyA9IHRoaXMucGx1Z2luLmdldEZvbGRlckRlZmF1bHRWYWx1ZXMoZmlsZSk7XG5cdFx0XHRjb25zdCBzdGF0dXMgPSBnZXRGcm9udG1hdHRlclN0YXR1cyhjb250ZW50LCBkZWZhdWx0cyk7XG5cdFx0XHRpZiAoXG5cdFx0XHRcdHN0YXR1cy5taXNzaW5nRmllbGRzLmxlbmd0aCA+IDAgfHxcblx0XHRcdFx0c3RhdHVzLm9yZGVyTmVlZHNGaXggfHxcblx0XHRcdFx0c3RhdHVzLnJlbmFtZUZpZWxkcy5sZW5ndGggPiAwIHx8XG5cdFx0XHRcdHN0YXR1cy5kZWZhdWx0RmllbGRzLmxlbmd0aCA+IDBcblx0XHRcdCkge1xuXHRcdFx0XHRyZXN1bHRzLnB1c2goe1xuXHRcdFx0XHRcdGZpbGUsXG5cdFx0XHRcdFx0bWlzc2luZ0ZpZWxkczogc3RhdHVzLm1pc3NpbmdGaWVsZHMsXG5cdFx0XHRcdFx0b3JkZXJOZWVkc0ZpeDogc3RhdHVzLm9yZGVyTmVlZHNGaXgsXG5cdFx0XHRcdFx0cmVuYW1lRmllbGRzOiBzdGF0dXMucmVuYW1lRmllbGRzLFxuXHRcdFx0XHRcdGRlZmF1bHRGaWVsZHM6IHN0YXR1cy5kZWZhdWx0RmllbGRzLFxuXHRcdFx0XHRcdGRvbmU6IGZhbHNlLFxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGluZGV4ICUgMjUgPT09IDI0KSB7XG5cdFx0XHRcdGF3YWl0IHlpZWxkVG9VaSgpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuc2NhblJlc3VsdHMgPSByZXN1bHRzO1xuXHRcdHRoaXMuaXNTY2FubmluZyA9IGZhbHNlO1xuXHRcdHRoaXMuZGlzcGxheSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBzY2FuVW5tYXRjaGVkRm9sZGVycygpIHtcblx0XHR0aGlzLmhhc1NjYW5uZWRVbm1hdGNoZWRGb2xkZXJzID0gdHJ1ZTtcblx0XHR0aGlzLmlzU2Nhbm5pbmdVbm1hdGNoZWRGb2xkZXJzID0gdHJ1ZTtcblx0XHR0aGlzLnVubWF0Y2hlZEZvbGRlcnMgPSBbXTtcblx0XHR0aGlzLmRpc3BsYXkoKTtcblxuXHRcdGNvbnN0IGZvbGRlcnMgPSBnZXRWYXVsdEZvbGRlcnModGhpcy5hcHApLmZpbHRlcigoZm9sZGVyKSA9PiBzaG91bGRJbmNsdWRlUnVsZUZvbGRlcihmb2xkZXIpKTtcblx0XHRjb25zdCBkaXJlY3RSdWxlRm9sZGVycyA9IG5ldyBTZXQoXG5cdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5mb2xkZXJEZWZhdWx0c1xuXHRcdFx0XHQubWFwKChydWxlKSA9PiBydWxlLmZvbGRlcilcblx0XHRcdFx0LmZpbHRlcigoZm9sZGVyKSA9PiBzaG91bGRJbmNsdWRlUnVsZUZvbGRlcihmb2xkZXIpKSxcblx0XHQpO1xuXG5cdFx0dGhpcy51bm1hdGNoZWRGb2xkZXJzID0gZm9sZGVyc1xuXHRcdFx0LmZpbHRlcigoZm9sZGVyKSA9PiAhZGlyZWN0UnVsZUZvbGRlcnMuaGFzKGZvbGRlcikpXG5cdFx0XHQubWFwKChmb2xkZXIpID0+ICh7XG5cdFx0XHRcdHBhdGg6IGZvbGRlcixcblx0XHRcdFx0aW5oZXJpdGVkUnVsZXM6IGdldEFuY2VzdG9yUnVsZXMoZm9sZGVyLCB0aGlzLnBsdWdpbi5zZXR0aW5ncy5mb2xkZXJEZWZhdWx0cyksXG5cdFx0XHR9KSlcblx0XHRcdC5zb3J0KChhLCBiKSA9PiBhLnBhdGgubG9jYWxlQ29tcGFyZShiLnBhdGgpKTtcblxuXHRcdHRoaXMuaXNTY2FubmluZ1VubWF0Y2hlZEZvbGRlcnMgPSBmYWxzZTtcblx0XHR0aGlzLmRpc3BsYXkoKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZXhlY3V0ZVNjYW5SZXN1bHRzKCkge1xuXHRcdHRoaXMuaXNFeGVjdXRpbmcgPSB0cnVlO1xuXHRcdHRoaXMucHJvY2Vzc2VkQ291bnQgPSAwO1xuXHRcdHRoaXMuZGlzcGxheSgpO1xuXG5cdFx0Zm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHRoaXMuc2NhblJlc3VsdHMubGVuZ3RoOyBpbmRleCsrKSB7XG5cdFx0XHRjb25zdCByZXN1bHQgPSB0aGlzLnNjYW5SZXN1bHRzW2luZGV4XTtcblx0XHRcdGNvbnN0IGNvbnRlbnQgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5yZWFkKHJlc3VsdC5maWxlKTtcblx0XHRcdGNvbnN0IGRlZmF1bHRzID0gdGhpcy5wbHVnaW4uZ2V0Rm9sZGVyRGVmYXVsdFZhbHVlcyhyZXN1bHQuZmlsZSk7XG5cdFx0XHRjb25zdCBzdGF0dXMgPSBnZXRGcm9udG1hdHRlclN0YXR1cyhjb250ZW50LCBkZWZhdWx0cyk7XG5cdFx0XHRjb25zdCBuZXh0ID0gYnVpbGRDb250ZW50V2l0aE9yZGVyZWRGaWVsZHMoXG5cdFx0XHRcdGNvbnRlbnQsXG5cdFx0XHRcdHJlc3VsdC5maWxlLFxuXHRcdFx0XHRzdGF0dXMsXG5cdFx0XHRcdFwiXCIsXG5cdFx0XHRcdGRlZmF1bHRzLFxuXHRcdFx0XHR0aGlzLnBsdWdpbi5idWlsZEZyb250bWF0dGVyLmJpbmQodGhpcy5wbHVnaW4pLFxuXHRcdFx0KTtcblx0XHRcdGlmIChuZXh0ICE9PSBudWxsKSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuYXBwLnZhdWx0Lm1vZGlmeShyZXN1bHQuZmlsZSwgbmV4dCk7XG5cdFx0XHR9XG5cblx0XHRcdHJlc3VsdC5taXNzaW5nRmllbGRzID0gc3RhdHVzLm1pc3NpbmdGaWVsZHM7XG5cdFx0XHRyZXN1bHQub3JkZXJOZWVkc0ZpeCA9IHN0YXR1cy5vcmRlck5lZWRzRml4O1xuXHRcdFx0cmVzdWx0LnJlbmFtZUZpZWxkcyA9IHN0YXR1cy5yZW5hbWVGaWVsZHM7XG5cdFx0XHRyZXN1bHQuZGVmYXVsdEZpZWxkcyA9IHN0YXR1cy5kZWZhdWx0RmllbGRzO1xuXHRcdFx0cmVzdWx0LmRvbmUgPSB0cnVlO1xuXHRcdFx0dGhpcy5wcm9jZXNzZWRDb3VudCsrO1xuXG5cdFx0XHRpZiAoaW5kZXggJSAxMCA9PT0gOSB8fCBpbmRleCA9PT0gdGhpcy5zY2FuUmVzdWx0cy5sZW5ndGggLSAxKSB7XG5cdFx0XHRcdHRoaXMuZGlzcGxheSgpO1xuXHRcdFx0XHRhd2FpdCB5aWVsZFRvVWkoKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLmlzRXhlY3V0aW5nID0gZmFsc2U7XG5cdFx0dGhpcy5kaXNwbGF5KCk7XG5cdH1cbn1cblxuaW50ZXJmYWNlIFNjYW5SZXN1bHQge1xuXHRmaWxlOiBURmlsZTtcblx0bWlzc2luZ0ZpZWxkczogUmVxdWlyZWRGaWVsZFtdO1xuXHRvcmRlck5lZWRzRml4OiBib29sZWFuO1xuXHRyZW5hbWVGaWVsZHM6IExlZ2FjeVJlbmFtZVtdO1xuXHRkZWZhdWx0RmllbGRzOiBGb2xkZXJEZWZhdWx0RmllbGRbXTtcblx0ZG9uZTogYm9vbGVhbjtcbn1cblxuaW50ZXJmYWNlIFVubWF0Y2hlZEZvbGRlclJlc3VsdCB7XG5cdHBhdGg6IHN0cmluZztcblx0aW5oZXJpdGVkUnVsZXM6IEZvbGRlckRlZmF1bHRSdWxlW107XG59XG5cbmludGVyZmFjZSBBSVN1bW1hcnlDYW5kaWRhdGUge1xuXHRmaWxlOiBURmlsZTtcblx0Y29udGVudDogc3RyaW5nO1xuXHRkb2N1bWVudDogU3VtbWFyeURvY3VtZW50O1xuXHRkb25lPzogYm9vbGVhbjtcbn1cblxuaW50ZXJmYWNlIEFJU3VtbWFyeVRhc2tVaVN0YXRlIHtcblx0cmVzdWx0czogQUlTdW1tYXJ5Q2FuZGlkYXRlW107XG5cdGhhc1NjYW5uZWQ6IGJvb2xlYW47XG5cdGlzU2Nhbm5pbmc6IGJvb2xlYW47XG5cdGlzRXhlY3V0aW5nOiBib29sZWFuO1xuXHRwcm9jZXNzZWRDb3VudDogbnVtYmVyO1xufVxuXG5pbnRlcmZhY2UgQ2hhdENvbXBsZXRpb25SZXNwb25zZSB7XG5cdGVycm9yPzoge1xuXHRcdG1lc3NhZ2U/OiBzdHJpbmc7XG5cdH07XG5cdGNob2ljZXM/OiBBcnJheTx7XG5cdFx0XHRtZXNzYWdlPzoge1xuXHRcdFx0XHRjb250ZW50Pzogc3RyaW5nO1xuXHRcdFx0XHRyZWFzb25pbmdfY29udGVudD86IHN0cmluZztcblx0XHRcdFx0cmVhc29uaW5nPzogc3RyaW5nO1xuXHRcdFx0fTtcblx0XHR9Pjtcblx0fVxuXG5pbnRlcmZhY2UgRnJvbnRtYXR0ZXJTdGF0dXMge1xuXHRtaXNzaW5nRmllbGRzOiBSZXF1aXJlZEZpZWxkW107XG5cdG9yZGVyTmVlZHNGaXg6IGJvb2xlYW47XG5cdHJlbmFtZUZpZWxkczogTGVnYWN5UmVuYW1lW107XG5cdGRlZmF1bHRGaWVsZHM6IEZvbGRlckRlZmF1bHRGaWVsZFtdO1xufVxuXG5pbnRlcmZhY2UgRnJvbnRtYXR0ZXJCbG9jayB7XG5cdGtleTogc3RyaW5nIHwgbnVsbDtcblx0bGluZXM6IHN0cmluZ1tdO1xufVxuXG5pbnRlcmZhY2UgTGVnYWN5UmVuYW1lIHtcblx0ZnJvbTogTGVnYWN5RmllbGQ7XG5cdHRvOiBSZXF1aXJlZEZpZWxkO1xufVxuXG5mdW5jdGlvbiBoYXNGcm9udG1hdHRlcihjb250ZW50OiBzdHJpbmcpOiBib29sZWFuIHtcblx0cmV0dXJuIGNvbnRlbnQuc3RhcnRzV2l0aChcIi0tLVwiKTtcbn1cblxuZnVuY3Rpb24gZ2V0RnJvbnRtYXR0ZXJTdGF0dXMoY29udGVudDogc3RyaW5nLCBkZWZhdWx0czogRm9sZGVyRGVmYXVsdFZhbHVlcyA9IHt9KTogRnJvbnRtYXR0ZXJTdGF0dXMge1xuXHRjb25zdCBmcm9udG1hdHRlciA9IHBhcnNlRnJvbnRtYXR0ZXIoY29udGVudCk7XG5cdGlmIChmcm9udG1hdHRlciA9PT0gbnVsbCkge1xuXHRcdHJldHVybiB7XG5cdFx0XHRtaXNzaW5nRmllbGRzOiBbLi4uUkVRVUlSRURfRklFTERTXSxcblx0XHRcdG9yZGVyTmVlZHNGaXg6IGZhbHNlLFxuXHRcdFx0cmVuYW1lRmllbGRzOiBbXSxcblx0XHRcdGRlZmF1bHRGaWVsZHM6IFtdLFxuXHRcdH07XG5cdH1cblxuXHRjb25zdCBibG9ja3MgPSBwYXJzZUZyb250bWF0dGVyQmxvY2tzKGZyb250bWF0dGVyLmJvZHkpO1xuXHRjb25zdCByZW5hbWVGaWVsZHMgPSBnZXRMZWdhY3lSZW5hbWVzKGJsb2Nrcyk7XG5cdGNvbnN0IG1pZ3JhdGVkQmxvY2tzID0gbWlncmF0ZUxlZ2FjeUJsb2NrcyhibG9ja3MpO1xuXHRjb25zdCBtaXNzaW5nRmllbGRzID0gUkVRVUlSRURfRklFTERTLmZpbHRlcigoZmllbGQpID0+ICFoYXNGcm9udG1hdHRlckJsb2NrKG1pZ3JhdGVkQmxvY2tzLCBmaWVsZCkpO1xuXHRjb25zdCBkZWZhdWx0RmllbGRzID0gRk9MREVSX0RFRkFVTFRfRklFTERTLmZpbHRlcigoZmllbGQpID0+IHtcblx0XHRyZXR1cm4gZGVmYXVsdHNbZmllbGRdICE9PSB1bmRlZmluZWQgJiYgZnJvbnRtYXR0ZXJGaWVsZElzRW1wdHkobWlncmF0ZWRCbG9ja3MsIGZpZWxkKTtcblx0fSk7XG5cdHJldHVybiB7XG5cdFx0bWlzc2luZ0ZpZWxkcyxcblx0XHRvcmRlck5lZWRzRml4OiAhcmVxdWlyZWRGaWVsZHNBcmVJblJlbGF0aXZlT3JkZXIobWlncmF0ZWRCbG9ja3MpLFxuXHRcdHJlbmFtZUZpZWxkcyxcblx0XHRkZWZhdWx0RmllbGRzLFxuXHR9O1xufVxuXG5mdW5jdGlvbiBidWlsZENvbnRlbnRXaXRoT3JkZXJlZEZpZWxkcyhcblx0Y29udGVudDogc3RyaW5nLFxuXHRmaWxlOiBURmlsZSxcblx0c3RhdHVzOiBGcm9udG1hdHRlclN0YXR1cyxcblx0YXV0aG9yTmFtZTogc3RyaW5nLFxuXHRkZWZhdWx0czogRm9sZGVyRGVmYXVsdFZhbHVlcyxcblx0YnVpbGRGdWxsRnJvbnRtYXR0ZXI6IChjcmVhdGVkOiBzdHJpbmcsIGRlZmF1bHRzPzogRm9sZGVyRGVmYXVsdFZhbHVlcykgPT4gc3RyaW5nLFxuKTogc3RyaW5nIHwgbnVsbCB7XG5cdGlmIChcblx0XHRzdGF0dXMubWlzc2luZ0ZpZWxkcy5sZW5ndGggPT09IDAgJiZcblx0XHQhc3RhdHVzLm9yZGVyTmVlZHNGaXggJiZcblx0XHRzdGF0dXMucmVuYW1lRmllbGRzLmxlbmd0aCA9PT0gMCAmJlxuXHRcdHN0YXR1cy5kZWZhdWx0RmllbGRzLmxlbmd0aCA9PT0gMFxuXHQpIHtcblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdGNvbnN0IGNyZWF0ZWQgPSBmb3JtYXRMb2NhbERhdGUobmV3IERhdGUoZmlsZS5zdGF0LmN0aW1lKSk7XG5cdGNvbnN0IGZyb250bWF0dGVyID0gcGFyc2VGcm9udG1hdHRlcihjb250ZW50KTtcblx0aWYgKGZyb250bWF0dGVyID09PSBudWxsKSB7XG5cdFx0cmV0dXJuIGJ1aWxkRnVsbEZyb250bWF0dGVyKGNyZWF0ZWQsIGRlZmF1bHRzKSArIGNvbnRlbnQ7XG5cdH1cblxuXHRjb25zdCBtaWdyYXRlZEJvZHkgPSBtaWdyYXRlTGVnYWN5RnJvbnRtYXR0ZXJCb2R5KGZyb250bWF0dGVyLmJvZHkpO1xuXHRjb25zdCBib2R5ID0gc3RhdHVzLm9yZGVyTmVlZHNGaXhcblx0XHQ/IGJ1aWxkUmVvcmRlcmVkRnJvbnRtYXR0ZXJCb2R5KG1pZ3JhdGVkQm9keSwgY3JlYXRlZCwgYXV0aG9yTmFtZSwgZGVmYXVsdHMpXG5cdFx0OiBidWlsZEZyb250bWF0dGVyQm9keVdpdGhNaXNzaW5nRmllbGRzKFxuXHRcdFx0XHRtaWdyYXRlZEJvZHksXG5cdFx0XHRcdHN0YXR1cy5taXNzaW5nRmllbGRzLFxuXHRcdFx0XHRzdGF0dXMuZGVmYXVsdEZpZWxkcyxcblx0XHRcdFx0Y3JlYXRlZCxcblx0XHRcdFx0YXV0aG9yTmFtZSxcblx0XHRcdFx0ZGVmYXVsdHMsXG5cdFx0XHQpO1xuXHRjb25zdCBzdWZmaXggPSBjb250ZW50LnNsaWNlKGZyb250bWF0dGVyLmVuZCk7XG5cdGNvbnN0IHNlcGFyYXRvciA9IHN1ZmZpeC5zdGFydHNXaXRoKFwiXFxuXCIpID8gXCJcIiA6IFwiXFxuXCI7XG5cdHJldHVybiBgLS0tXFxuJHtib2R5fSR7c2VwYXJhdG9yfSR7c3VmZml4fWA7XG59XG5cbmZ1bmN0aW9uIGJ1aWxkRnJvbnRtYXR0ZXJCb2R5V2l0aE1pc3NpbmdGaWVsZHMoXG5cdGZyb250bWF0dGVyQm9keTogc3RyaW5nLFxuXHRtaXNzaW5nRmllbGRzOiBSZXF1aXJlZEZpZWxkW10sXG5cdGRlZmF1bHRGaWVsZHM6IEZvbGRlckRlZmF1bHRGaWVsZFtdLFxuXHRmaWxlQ3JlYXRlZDogc3RyaW5nLFxuXHRhdXRob3JOYW1lOiBzdHJpbmcsXG5cdGRlZmF1bHRzOiBGb2xkZXJEZWZhdWx0VmFsdWVzLFxuKTogc3RyaW5nIHtcblx0Y29uc3QgYmxvY2tzID0gcGFyc2VGcm9udG1hdHRlckJsb2Nrcyhmcm9udG1hdHRlckJvZHkpO1xuXHRjb25zdCBsaW5lczogc3RyaW5nW10gPSBbXTtcblx0Y29uc3QgaW5zZXJ0ZWQgPSBuZXcgU2V0PFJlcXVpcmVkRmllbGQ+KCk7XG5cdGNvbnN0IGNyZWF0ZWRGb3JVcGRhdGVkID0gZ2V0RXhpc3RpbmdDcmVhdGVkVmFsdWUoYmxvY2tzKSA/PyBmaWxlQ3JlYXRlZDtcblxuXHRmb3IgKGNvbnN0IGJsb2NrIG9mIGJsb2Nrcykge1xuXHRcdGlmIChpc1JlcXVpcmVkRmllbGQoYmxvY2sua2V5KSkge1xuXHRcdFx0Zm9yIChjb25zdCBmaWVsZCBvZiBtaXNzaW5nRmllbGRzKSB7XG5cdFx0XHRcdGlmICghaW5zZXJ0ZWQuaGFzKGZpZWxkKSAmJiBnZXRSZXF1aXJlZEZpZWxkSW5kZXgoZmllbGQpIDwgZ2V0UmVxdWlyZWRGaWVsZEluZGV4KGJsb2NrLmtleSkpIHtcblx0XHRcdFx0XHRjb25zdCBjcmVhdGVkID0gZmllbGQgPT09IFwi5pyA5ZCO5pu05pawXCIgPyBjcmVhdGVkRm9yVXBkYXRlZCA6IGZpbGVDcmVhdGVkO1xuXHRcdFx0XHRcdGxpbmVzLnB1c2goLi4uYnVpbGRSZXF1aXJlZEZpZWxkTGluZXMoZmllbGQsIHVuZGVmaW5lZCwgY3JlYXRlZCwgYXV0aG9yTmFtZSwgZGVmYXVsdHMpKTtcblx0XHRcdFx0XHRpbnNlcnRlZC5hZGQoZmllbGQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0bGluZXMucHVzaCguLi5idWlsZEJsb2NrTGluZXNXaXRoRGVmYXVsdChibG9jaywgZGVmYXVsdEZpZWxkcywgZGVmYXVsdHMpKTtcblx0fVxuXG5cdGZvciAoY29uc3QgZmllbGQgb2YgbWlzc2luZ0ZpZWxkcykge1xuXHRcdGlmICghaW5zZXJ0ZWQuaGFzKGZpZWxkKSkge1xuXHRcdFx0Y29uc3QgY3JlYXRlZCA9IGZpZWxkID09PSBcIuacgOWQjuabtOaWsFwiID8gY3JlYXRlZEZvclVwZGF0ZWQgOiBmaWxlQ3JlYXRlZDtcblx0XHRcdGxpbmVzLnB1c2goLi4uYnVpbGRSZXF1aXJlZEZpZWxkTGluZXMoZmllbGQsIHVuZGVmaW5lZCwgY3JlYXRlZCwgYXV0aG9yTmFtZSwgZGVmYXVsdHMpKTtcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gbGluZXMuam9pbihcIlxcblwiKTtcbn1cblxuZnVuY3Rpb24gZ2V0RXhpc3RpbmdDcmVhdGVkVmFsdWUoYmxvY2tzOiBGcm9udG1hdHRlckJsb2NrW10pOiBzdHJpbmcgfCBudWxsIHtcblx0Zm9yIChjb25zdCBibG9jayBvZiBibG9ja3MpIHtcblx0XHRpZiAoYmxvY2sua2V5ID09PSBcIuWIm+W7uuaXtumXtFwiKSB7XG5cdFx0XHRyZXR1cm4gZ2V0QmxvY2tTY2FsYXIoYmxvY2spO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBidWlsZEJsb2NrTGluZXNXaXRoRGVmYXVsdChcblx0YmxvY2s6IEZyb250bWF0dGVyQmxvY2ssXG5cdGRlZmF1bHRGaWVsZHM6IEZvbGRlckRlZmF1bHRGaWVsZFtdLFxuXHRkZWZhdWx0czogRm9sZGVyRGVmYXVsdFZhbHVlcyxcbik6IHN0cmluZ1tdIHtcblx0aWYgKGJsb2NrLmtleSA9PT0gXCLpobnnm65cIiAmJiBkZWZhdWx0RmllbGRzLmluY2x1ZGVzKFwi6aG555uuXCIpKSB7XG5cdFx0cmV0dXJuIFtmb3JtYXRTY2FsYXJGaWVsZChcIumhueebrlwiLCBkZWZhdWx0c1tcIumhueebrlwiXSA/PyBcIlwiKV07XG5cdH1cblx0aWYgKGJsb2NrLmtleSA9PT0gXCLnsbvlnotcIiAmJiBkZWZhdWx0RmllbGRzLmluY2x1ZGVzKFwi57G75Z6LXCIpKSB7XG5cdFx0cmV0dXJuIFtcIuexu+WeizpcIiwgLi4uZm9ybWF0TGlzdFZhbHVlKHVuZGVmaW5lZCwgZGVmYXVsdHNbXCLnsbvlnotcIl0gPz8gXCJcIildO1xuXHR9XG5cdHJldHVybiBibG9jay5saW5lcztcbn1cblxuZnVuY3Rpb24gZmlsbEVtcHR5Rm9sZGVyRGVmYXVsdHMoY29udGVudDogc3RyaW5nLCBkZWZhdWx0czogRm9sZGVyRGVmYXVsdFZhbHVlcyk6IHN0cmluZyB8IG51bGwge1xuXHRjb25zdCBmcm9udG1hdHRlciA9IHBhcnNlRnJvbnRtYXR0ZXIoY29udGVudCk7XG5cdGlmIChmcm9udG1hdHRlciA9PT0gbnVsbCkge1xuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0Y29uc3QgYm9keSA9IG1pZ3JhdGVMZWdhY3lGcm9udG1hdHRlckJvZHkoZnJvbnRtYXR0ZXIuYm9keSk7XG5cdGNvbnN0IGJsb2NrcyA9IHBhcnNlRnJvbnRtYXR0ZXJCbG9ja3MoYm9keSk7XG5cdGNvbnN0IGRlZmF1bHRGaWVsZHMgPSBGT0xERVJfREVGQVVMVF9GSUVMRFMuZmlsdGVyKChmaWVsZCkgPT4ge1xuXHRcdHJldHVybiBkZWZhdWx0c1tmaWVsZF0gIT09IHVuZGVmaW5lZCAmJiBmcm9udG1hdHRlckZpZWxkSXNFbXB0eShibG9ja3MsIGZpZWxkKTtcblx0fSk7XG5cdGlmIChkZWZhdWx0RmllbGRzLmxlbmd0aCA9PT0gMCkge1xuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0Y29uc3QgbGluZXMgPSBibG9ja3MuZmxhdE1hcCgoYmxvY2spID0+IGJ1aWxkQmxvY2tMaW5lc1dpdGhEZWZhdWx0KGJsb2NrLCBkZWZhdWx0RmllbGRzLCBkZWZhdWx0cykpO1xuXHRjb25zdCBzdWZmaXggPSBjb250ZW50LnNsaWNlKGZyb250bWF0dGVyLmVuZCk7XG5cdGNvbnN0IHNlcGFyYXRvciA9IHN1ZmZpeC5zdGFydHNXaXRoKFwiXFxuXCIpID8gXCJcIiA6IFwiXFxuXCI7XG5cdHJldHVybiBgLS0tXFxuJHtsaW5lcy5qb2luKFwiXFxuXCIpfSR7c2VwYXJhdG9yfSR7c3VmZml4fWA7XG59XG5cbmZ1bmN0aW9uIGZyb250bWF0dGVyRmllbGRJc0VtcHR5KGJsb2NrczogRnJvbnRtYXR0ZXJCbG9ja1tdLCBmaWVsZDogRm9sZGVyRGVmYXVsdEZpZWxkKTogYm9vbGVhbiB7XG5cdGNvbnN0IGJsb2NrID0gYmxvY2tzLmZpbmQoKGl0ZW0pID0+IGl0ZW0ua2V5ID09PSBmaWVsZCk7XG5cdGlmICghYmxvY2spIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRpZiAoZmllbGQgPT09IFwi6aG555uuXCIpIHtcblx0XHRyZXR1cm4gZ2V0QmxvY2tTY2FsYXIoYmxvY2spID09PSBudWxsO1xuXHR9XG5cblx0Y29uc3QgbGlzdFZhbHVlcyA9IGdldEJsb2NrTGlzdFZhbHVlcyhibG9jayk7XG5cdGlmIChsaXN0VmFsdWVzLmxlbmd0aCA+IDApIHtcblx0XHRyZXR1cm4gbGlzdFZhbHVlcy5ldmVyeSgodmFsdWUpID0+IHZhbHVlLmxlbmd0aCA9PT0gMCk7XG5cdH1cblxuXHRyZXR1cm4gZ2V0QmxvY2tTY2FsYXIoYmxvY2spID09PSBudWxsO1xufVxuXG5mdW5jdGlvbiBidWlsZFJlb3JkZXJlZEZyb250bWF0dGVyQm9keShcblx0ZnJvbnRtYXR0ZXJCb2R5OiBzdHJpbmcsXG5cdGZpbGVDcmVhdGVkOiBzdHJpbmcsXG5cdGF1dGhvck5hbWU6IHN0cmluZyxcblx0ZGVmYXVsdHM6IEZvbGRlckRlZmF1bHRWYWx1ZXMsXG4pOiBzdHJpbmcge1xuXHRjb25zdCBibG9ja3MgPSBwYXJzZUZyb250bWF0dGVyQmxvY2tzKGZyb250bWF0dGVyQm9keSk7XG5cdGNvbnN0IHJlcXVpcmVkQmxvY2tzID0gbmV3IE1hcDxSZXF1aXJlZEZpZWxkLCBGcm9udG1hdHRlckJsb2NrPigpO1xuXHRjb25zdCBjdXN0b21CbG9ja3M6IEZyb250bWF0dGVyQmxvY2tbXSA9IFtdO1xuXG5cdGZvciAoY29uc3QgYmxvY2sgb2YgYmxvY2tzKSB7XG5cdFx0aWYgKGlzUmVxdWlyZWRGaWVsZChibG9jay5rZXkpKSB7XG5cdFx0XHRpZiAoIXJlcXVpcmVkQmxvY2tzLmhhcyhibG9jay5rZXkpKSB7XG5cdFx0XHRcdHJlcXVpcmVkQmxvY2tzLnNldChibG9jay5rZXksIGJsb2NrKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGN1c3RvbUJsb2Nrcy5wdXNoKGJsb2NrKTtcblx0XHRcdH1cblx0XHR9IGVsc2UgaWYgKGJsb2NrLmxpbmVzLmxlbmd0aCA+IDApIHtcblx0XHRcdGN1c3RvbUJsb2Nrcy5wdXNoKGJsb2NrKTtcblx0XHR9XG5cdH1cblxuXHRjb25zdCBleGlzdGluZ0NyZWF0ZWQgPSBnZXRCbG9ja1NjYWxhcihyZXF1aXJlZEJsb2Nrcy5nZXQoXCLliJvlu7rml7bpl7RcIikpO1xuXHRjb25zdCBjcmVhdGVkID0gZXhpc3RpbmdDcmVhdGVkIHx8IGZpbGVDcmVhdGVkO1xuXHRjb25zdCBsaW5lczogc3RyaW5nW10gPSBbXTtcblxuXHRsaW5lcy5wdXNoKC4uLmJ1aWxkUmVxdWlyZWRGaWVsZExpbmVzKFwi6aG555uuXCIsIHJlcXVpcmVkQmxvY2tzLmdldChcIumhueebrlwiKSwgZmlsZUNyZWF0ZWQsIGF1dGhvck5hbWUsIGRlZmF1bHRzKSk7XG5cdGxpbmVzLnB1c2goLi4uYnVpbGRSZXF1aXJlZEZpZWxkTGluZXMoXCLnsbvlnotcIiwgcmVxdWlyZWRCbG9ja3MuZ2V0KFwi57G75Z6LXCIpLCBmaWxlQ3JlYXRlZCwgYXV0aG9yTmFtZSwgZGVmYXVsdHMpKTtcblx0bGluZXMucHVzaCguLi5jdXN0b21CbG9ja3MuZmxhdE1hcCgoYmxvY2spID0+IGJsb2NrLmxpbmVzKSk7XG5cdGxpbmVzLnB1c2goLi4uYnVpbGRSZXF1aXJlZEZpZWxkTGluZXMoXCLkvZzogIVcIiwgcmVxdWlyZWRCbG9ja3MuZ2V0KFwi5L2c6ICFXCIpLCBmaWxlQ3JlYXRlZCwgYXV0aG9yTmFtZSwgZGVmYXVsdHMpKTtcblx0bGluZXMucHVzaCguLi5idWlsZFJlcXVpcmVkRmllbGRMaW5lcyhcIuaRmOimgVwiLCByZXF1aXJlZEJsb2Nrcy5nZXQoXCLmkZjopoFcIiksIGZpbGVDcmVhdGVkLCBhdXRob3JOYW1lLCBkZWZhdWx0cykpO1xuXHRsaW5lcy5wdXNoKC4uLmJ1aWxkUmVxdWlyZWRGaWVsZExpbmVzKFwi5Yib5bu65pe26Ze0XCIsIHJlcXVpcmVkQmxvY2tzLmdldChcIuWIm+W7uuaXtumXtFwiKSwgZmlsZUNyZWF0ZWQsIGF1dGhvck5hbWUsIGRlZmF1bHRzKSk7XG5cdGxpbmVzLnB1c2goLi4uYnVpbGRSZXF1aXJlZEZpZWxkTGluZXMoXCLmnIDlkI7mm7TmlrBcIiwgcmVxdWlyZWRCbG9ja3MuZ2V0KFwi5pyA5ZCO5pu05pawXCIpLCBjcmVhdGVkLCBhdXRob3JOYW1lLCBkZWZhdWx0cykpO1xuXHRyZXR1cm4gbGluZXMuam9pbihcIlxcblwiKTtcbn1cblxuZnVuY3Rpb24gYnVpbGRSZXF1aXJlZEZpZWxkTGluZXMoXG5cdGZpZWxkOiBSZXF1aXJlZEZpZWxkLFxuXHRibG9jazogRnJvbnRtYXR0ZXJCbG9jayB8IHVuZGVmaW5lZCxcblx0ZmlsZUNyZWF0ZWQ6IHN0cmluZyxcblx0YXV0aG9yTmFtZTogc3RyaW5nLFxuXHRkZWZhdWx0czogRm9sZGVyRGVmYXVsdFZhbHVlcyA9IHt9LFxuKTogc3RyaW5nW10ge1xuXHRpZiAoZmllbGQgPT09IFwi6aG555uuXCIpIHtcblx0XHRyZXR1cm4gW2Zvcm1hdFNjYWxhckZpZWxkKFwi6aG555uuXCIsIGdldEJsb2NrU2NhbGFyKGJsb2NrKSA/PyBkZWZhdWx0c1tcIumhueebrlwiXSA/PyBcIlwiKV07XG5cdH1cblx0aWYgKGZpZWxkID09PSBcIuexu+Wei1wiKSB7XG5cdFx0cmV0dXJuIFtcIuexu+WeizpcIiwgLi4uZm9ybWF0TGlzdFZhbHVlKGJsb2NrLCBkZWZhdWx0c1tcIuexu+Wei1wiXSA/PyBcIlwiKV07XG5cdH1cblx0aWYgKGZpZWxkID09PSBcIuS9nOiAhVwiKSB7XG5cdFx0cmV0dXJuIFtcIuS9nOiAhTpcIiwgLi4uZm9ybWF0TGlzdFZhbHVlKGJsb2NrLCBhdXRob3JOYW1lKV07XG5cdH1cblx0aWYgKGZpZWxkID09PSBcIuaRmOimgVwiKSB7XG5cdFx0cmV0dXJuIFtmb3JtYXRTY2FsYXJGaWVsZChcIuaRmOimgVwiLCBnZXRCbG9ja1NjYWxhcihibG9jaykgPz8gXCJcIildO1xuXHR9XG5cdGlmIChmaWVsZCA9PT0gXCLliJvlu7rml7bpl7RcIikge1xuXHRcdHJldHVybiBbYOWIm+W7uuaXtumXtDogJHtnZXRCbG9ja1NjYWxhcihibG9jaykgfHwgZmlsZUNyZWF0ZWR9YF07XG5cdH1cblx0cmV0dXJuIFtg5pyA5ZCO5pu05pawOiAke2dldEJsb2NrU2NhbGFyKGJsb2NrKSB8fCBmaWxlQ3JlYXRlZH1gXTtcbn1cblxuZnVuY3Rpb24gZ2V0TGVnYWN5UmVuYW1lcyhibG9ja3M6IEZyb250bWF0dGVyQmxvY2tbXSk6IExlZ2FjeVJlbmFtZVtdIHtcblx0Y29uc3QgcmVuYW1lczogTGVnYWN5UmVuYW1lW10gPSBbXTtcblx0Zm9yIChjb25zdCBsZWdhY3lGaWVsZCBvZiBPYmplY3Qua2V5cyhMRUdBQ1lfRklFTERfUkVOQU1FUykgYXMgTGVnYWN5RmllbGRbXSkge1xuXHRcdGlmIChoYXNBbnlGcm9udG1hdHRlckJsb2NrKGJsb2NrcywgbGVnYWN5RmllbGQpKSB7XG5cdFx0XHRyZW5hbWVzLnB1c2goe1xuXHRcdFx0XHRmcm9tOiBsZWdhY3lGaWVsZCxcblx0XHRcdFx0dG86IExFR0FDWV9GSUVMRF9SRU5BTUVTW2xlZ2FjeUZpZWxkXSxcblx0XHRcdH0pO1xuXHRcdH1cblx0fVxuXHRyZXR1cm4gcmVuYW1lcztcbn1cblxuZnVuY3Rpb24gbWlncmF0ZUxlZ2FjeUZyb250bWF0dGVyQm9keShmcm9udG1hdHRlckJvZHk6IHN0cmluZyk6IHN0cmluZyB7XG5cdHJldHVybiBtaWdyYXRlTGVnYWN5QmxvY2tzKHBhcnNlRnJvbnRtYXR0ZXJCbG9ja3MoZnJvbnRtYXR0ZXJCb2R5KSlcblx0XHQuZmxhdE1hcCgoYmxvY2spID0+IGJsb2NrLmxpbmVzKVxuXHRcdC5qb2luKFwiXFxuXCIpO1xufVxuXG5mdW5jdGlvbiBtaWdyYXRlTGVnYWN5QmxvY2tzKGJsb2NrczogRnJvbnRtYXR0ZXJCbG9ja1tdKTogRnJvbnRtYXR0ZXJCbG9ja1tdIHtcblx0Y29uc3QgaGFzTmV3RmllbGQgPSBuZXcgU2V0PFJlcXVpcmVkRmllbGQ+KCk7XG5cdGZvciAoY29uc3QgYmxvY2sgb2YgYmxvY2tzKSB7XG5cdFx0aWYgKGlzUmVxdWlyZWRGaWVsZChibG9jay5rZXkpKSB7XG5cdFx0XHRoYXNOZXdGaWVsZC5hZGQoYmxvY2sua2V5KTtcblx0XHR9XG5cdH1cblxuXHRjb25zdCBtaWdyYXRlZDogRnJvbnRtYXR0ZXJCbG9ja1tdID0gW107XG5cdGZvciAoY29uc3QgYmxvY2sgb2YgYmxvY2tzKSB7XG5cdFx0aWYgKGlzTGVnYWN5RmllbGQoYmxvY2sua2V5KSkge1xuXHRcdFx0Y29uc3QgbmV3S2V5ID0gTEVHQUNZX0ZJRUxEX1JFTkFNRVNbYmxvY2sua2V5XTtcblx0XHRcdGlmIChoYXNOZXdGaWVsZC5oYXMobmV3S2V5KSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0aGFzTmV3RmllbGQuYWRkKG5ld0tleSk7XG5cdFx0XHRtaWdyYXRlZC5wdXNoKHtcblx0XHRcdFx0a2V5OiBuZXdLZXksXG5cdFx0XHRcdGxpbmVzOiByZW5hbWVCbG9ja0ZpcnN0TGluZShibG9jay5saW5lcywgbmV3S2V5KSxcblx0XHRcdH0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRtaWdyYXRlZC5wdXNoKGJsb2NrKTtcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gbWlncmF0ZWQ7XG59XG5cbmZ1bmN0aW9uIHJlbmFtZUJsb2NrRmlyc3RMaW5lKGxpbmVzOiBzdHJpbmdbXSwga2V5OiBSZXF1aXJlZEZpZWxkKTogc3RyaW5nW10ge1xuXHRpZiAobGluZXMubGVuZ3RoID09PSAwKSB7XG5cdFx0cmV0dXJuIFtdO1xuXHR9XG5cblx0Y29uc3QgY29sb24gPSBsaW5lc1swXS5pbmRleE9mKFwiOlwiKTtcblx0Y29uc3QgZmlyc3RMaW5lID0gY29sb24gPT09IC0xID8gYCR7a2V5fTpgIDogYCR7a2V5fSR7bGluZXNbMF0uc2xpY2UoY29sb24pfWA7XG5cdHJldHVybiBbZmlyc3RMaW5lLCAuLi5saW5lcy5zbGljZSgxKV07XG59XG5cbmZ1bmN0aW9uIHBhcnNlRnJvbnRtYXR0ZXJCbG9ja3MoZnJvbnRtYXR0ZXI6IHN0cmluZyk6IEZyb250bWF0dGVyQmxvY2tbXSB7XG5cdGNvbnN0IGJsb2NrczogRnJvbnRtYXR0ZXJCbG9ja1tdID0gW107XG5cdGNvbnN0IGxpbmVzID0gZnJvbnRtYXR0ZXIuc3BsaXQoXCJcXG5cIikuZmlsdGVyKChsaW5lLCBpbmRleCwgYWxsKSA9PiB7XG5cdFx0cmV0dXJuIGluZGV4IDwgYWxsLmxlbmd0aCAtIDEgfHwgbGluZS5sZW5ndGggPiAwO1xuXHR9KTtcblxuXHRmb3IgKGNvbnN0IGxpbmUgb2YgbGluZXMpIHtcblx0XHRjb25zdCBrZXkgPSBnZXRUb3BMZXZlbEtleShsaW5lKTtcblx0XHRpZiAoa2V5ICE9PSBudWxsIHx8IGJsb2Nrcy5sZW5ndGggPT09IDApIHtcblx0XHRcdGJsb2Nrcy5wdXNoKHsga2V5LCBsaW5lczogW2xpbmVdIH0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRibG9ja3NbYmxvY2tzLmxlbmd0aCAtIDFdLmxpbmVzLnB1c2gobGluZSk7XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIGJsb2Nrcztcbn1cblxuZnVuY3Rpb24gZ2V0VG9wTGV2ZWxLZXkobGluZTogc3RyaW5nKTogc3RyaW5nIHwgbnVsbCB7XG5cdGlmICgvXlxccy8udGVzdChsaW5lKSkge1xuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0Y29uc3QgbWF0Y2ggPSAvXihbXjojXVteOl0qKTovLmV4ZWMobGluZSk7XG5cdHJldHVybiBtYXRjaCA/IG1hdGNoWzFdLnRyaW0oKSA6IG51bGw7XG59XG5cbmZ1bmN0aW9uIGhhc0Zyb250bWF0dGVyQmxvY2soYmxvY2tzOiBGcm9udG1hdHRlckJsb2NrW10sIGZpZWxkOiBSZXF1aXJlZEZpZWxkKTogYm9vbGVhbiB7XG5cdHJldHVybiBibG9ja3Muc29tZSgoYmxvY2spID0+IGJsb2NrLmtleSA9PT0gZmllbGQpO1xufVxuXG5mdW5jdGlvbiBoYXNBbnlGcm9udG1hdHRlckJsb2NrKGJsb2NrczogRnJvbnRtYXR0ZXJCbG9ja1tdLCBmaWVsZDogc3RyaW5nKTogYm9vbGVhbiB7XG5cdHJldHVybiBibG9ja3Muc29tZSgoYmxvY2spID0+IGJsb2NrLmtleSA9PT0gZmllbGQpO1xufVxuXG5mdW5jdGlvbiByZXF1aXJlZEZpZWxkc0FyZUluUmVsYXRpdmVPcmRlcihibG9ja3M6IEZyb250bWF0dGVyQmxvY2tbXSk6IGJvb2xlYW4ge1xuXHRsZXQgbGFzdEluZGV4ID0gLTE7XG5cdGZvciAoY29uc3QgYmxvY2sgb2YgYmxvY2tzKSB7XG5cdFx0aWYgKCFpc1JlcXVpcmVkRmllbGQoYmxvY2sua2V5KSkge1xuXHRcdFx0Y29udGludWU7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaW5kZXggPSBnZXRSZXF1aXJlZEZpZWxkSW5kZXgoYmxvY2sua2V5KTtcblx0XHRpZiAoaW5kZXggPCBsYXN0SW5kZXgpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0bGFzdEluZGV4ID0gaW5kZXg7XG5cdH1cblxuXHRyZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gZ2V0UmVxdWlyZWRGaWVsZEluZGV4KGZpZWxkOiBSZXF1aXJlZEZpZWxkKTogbnVtYmVyIHtcblx0cmV0dXJuIFJFUVVJUkVEX0ZJRUxEUy5pbmRleE9mKGZpZWxkKTtcbn1cblxuZnVuY3Rpb24gaXNSZXF1aXJlZEZpZWxkKGtleTogc3RyaW5nIHwgbnVsbCk6IGtleSBpcyBSZXF1aXJlZEZpZWxkIHtcblx0cmV0dXJuIGtleSAhPT0gbnVsbCAmJiAoUkVRVUlSRURfRklFTERTIGFzIHJlYWRvbmx5IHN0cmluZ1tdKS5pbmNsdWRlcyhrZXkpO1xufVxuXG5mdW5jdGlvbiBpc0xlZ2FjeUZpZWxkKGtleTogc3RyaW5nIHwgbnVsbCk6IGtleSBpcyBMZWdhY3lGaWVsZCB7XG5cdHJldHVybiBrZXkgIT09IG51bGwgJiYgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKExFR0FDWV9GSUVMRF9SRU5BTUVTLCBrZXkpO1xufVxuXG5mdW5jdGlvbiBnZXRCbG9ja1NjYWxhcihibG9jazogRnJvbnRtYXR0ZXJCbG9jayB8IHVuZGVmaW5lZCk6IHN0cmluZyB8IG51bGwge1xuXHRpZiAoIWJsb2NrKSB7XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRjb25zdCBmaXJzdExpbmUgPSBibG9jay5saW5lc1swXTtcblx0Y29uc3QgY29sb24gPSBmaXJzdExpbmUuaW5kZXhPZihcIjpcIik7XG5cdGlmIChjb2xvbiA9PT0gLTEpIHtcblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdGNvbnN0IHZhbHVlID0gZmlyc3RMaW5lLnNsaWNlKGNvbG9uICsgMSkudHJpbSgpO1xuXHRyZXR1cm4gdmFsdWUubGVuZ3RoID4gMCA/IHZhbHVlIDogbnVsbDtcbn1cblxuZnVuY3Rpb24gZm9ybWF0U2NhbGFyRmllbGQoZmllbGQ6IFJlcXVpcmVkRmllbGQsIHZhbHVlOiBzdHJpbmcpOiBzdHJpbmcge1xuXHRyZXR1cm4gdmFsdWUgPyBgJHtmaWVsZH06ICR7dmFsdWV9YCA6IGAke2ZpZWxkfTogYDtcbn1cblxuZnVuY3Rpb24gZm9ybWF0TGlzdFZhbHVlKGJsb2NrOiBGcm9udG1hdHRlckJsb2NrIHwgdW5kZWZpbmVkLCBkZWZhdWx0VmFsdWU6IHN0cmluZyk6IHN0cmluZ1tdIHtcblx0Y29uc3QgdmFsdWVzID0gZ2V0QmxvY2tMaXN0VmFsdWVzKGJsb2NrKTtcblx0aWYgKHZhbHVlcy5sZW5ndGggPiAwKSB7XG5cdFx0cmV0dXJuIHZhbHVlcy5tYXAoKHZhbHVlKSA9PiBgICAtICR7Zm9ybWF0WWFtbFNjYWxhcih2YWx1ZSl9YCk7XG5cdH1cblxuXHRjb25zdCBzY2FsYXIgPSBnZXRCbG9ja1NjYWxhcihibG9jayk7XG5cdGNvbnN0IHZhbHVlID0gc2NhbGFyID8/IGRlZmF1bHRWYWx1ZTtcblx0cmV0dXJuIFtgICAtICR7Zm9ybWF0WWFtbFNjYWxhcih2YWx1ZSl9YF07XG59XG5cbmZ1bmN0aW9uIGdldEJsb2NrTGlzdFZhbHVlcyhibG9jazogRnJvbnRtYXR0ZXJCbG9jayB8IHVuZGVmaW5lZCk6IHN0cmluZ1tdIHtcblx0aWYgKCFibG9jayB8fCBibG9jay5saW5lcy5sZW5ndGggPD0gMSkge1xuXHRcdHJldHVybiBbXTtcblx0fVxuXG5cdGNvbnN0IHZhbHVlczogc3RyaW5nW10gPSBbXTtcblx0Zm9yIChjb25zdCBsaW5lIG9mIGJsb2NrLmxpbmVzLnNsaWNlKDEpKSB7XG5cdFx0Y29uc3QgbWF0Y2ggPSAvXlxccyotXFxzKiguKikkLy5leGVjKGxpbmUpO1xuXHRcdGlmIChtYXRjaCkge1xuXHRcdFx0dmFsdWVzLnB1c2gobWF0Y2hbMV0udHJpbSgpKTtcblx0XHR9XG5cdH1cblx0cmV0dXJuIHZhbHVlcztcbn1cblxuZnVuY3Rpb24gcGFyc2VGcm9udG1hdHRlcihjb250ZW50OiBzdHJpbmcpOiB7IGJvZHk6IHN0cmluZzsgZW5kOiBudW1iZXIgfSB8IG51bGwge1xuXHRpZiAoIWNvbnRlbnQuc3RhcnRzV2l0aChcIi0tLVxcblwiKSkge1xuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0bGV0IGxpbmVTdGFydCA9IDQ7XG5cdHdoaWxlIChsaW5lU3RhcnQgPD0gY29udGVudC5sZW5ndGgpIHtcblx0XHRjb25zdCBsaW5lRW5kID0gY29udGVudC5pbmRleE9mKFwiXFxuXCIsIGxpbmVTdGFydCk7XG5cdFx0Y29uc3QgbGluZSA9IGNvbnRlbnQuc2xpY2UobGluZVN0YXJ0LCBsaW5lRW5kID09PSAtMSA/IGNvbnRlbnQubGVuZ3RoIDogbGluZUVuZCk7XG5cdFx0aWYgKGxpbmUudHJpbSgpID09PSBcIi0tLVwiKSB7XG5cdFx0XHRjb25zdCBlbmQgPSBsaW5lU3RhcnQgPT09IDQgPyA0IDogbGluZVN0YXJ0IC0gMTtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGJvZHk6IGNvbnRlbnQuc2xpY2UoNCwgZW5kKSxcblx0XHRcdFx0ZW5kLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAobGluZUVuZCA9PT0gLTEpIHtcblx0XHRcdGJyZWFrO1xuXHRcdH1cblx0XHRsaW5lU3RhcnQgPSBsaW5lRW5kICsgMTtcblx0fVxuXG5cdHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBnZXRTdW1tYXJ5RG9jdW1lbnQoZmlsZTogVEZpbGUsIGNvbnRlbnQ6IHN0cmluZywgbWluQm9keUxlbmd0aDogbnVtYmVyKTogU3VtbWFyeURvY3VtZW50IHwgbnVsbCB7XG5cdGNvbnN0IGZyb250bWF0dGVyID0gcGFyc2VGcm9udG1hdHRlcihjb250ZW50KTtcblx0Y29uc3QgYm9keSA9IGdldEJvZHlXaXRob3V0RnJvbnRtYXR0ZXIoY29udGVudCwgZnJvbnRtYXR0ZXIpO1xuXHRjb25zdCB0cmltbWVkID0gYm9keS50cmltKCk7XG5cdGlmICh0cmltbWVkLmxlbmd0aCA8IG1pbkJvZHlMZW5ndGgpIHtcblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdHJldHVybiB7XG5cdFx0dGl0bGU6IGZpbGUuYmFzZW5hbWUsXG5cdFx0ZnJvbnRtYXR0ZXI6IGZyb250bWF0dGVyPy5ib2R5LnRyaW0oKSA/PyBcIlwiLFxuXHRcdGNvbnRlbnQ6IHRyaW1tZWQuc2xpY2UoMCwgTUFYX1NVTU1BUllfQ09OVEVOVF9MRU5HVEgpLFxuXHR9O1xufVxuXG5mdW5jdGlvbiBnZXRCb2R5V2l0aG91dEZyb250bWF0dGVyKFxuXHRjb250ZW50OiBzdHJpbmcsXG5cdGZyb250bWF0dGVyOiB7IGJvZHk6IHN0cmluZzsgZW5kOiBudW1iZXIgfSB8IG51bGwsXG4pOiBzdHJpbmcge1xuXHRpZiAoZnJvbnRtYXR0ZXIgPT09IG51bGwpIHtcblx0XHRyZXR1cm4gY29udGVudDtcblx0fVxuXG5cdHJldHVybiBjb250ZW50LnNsaWNlKGZyb250bWF0dGVyLmVuZCkucmVwbGFjZSgvXlxcbj8tLS1cXG4/LywgXCJcIik7XG59XG5cbmZ1bmN0aW9uIHdyaXRlU3VtbWFyeVRvQ29udGVudChcblx0Y29udGVudDogc3RyaW5nLFxuXHRmaWxlOiBURmlsZSxcblx0c3VtbWFyeTogc3RyaW5nLFxuXHRkZWZhdWx0czogRm9sZGVyRGVmYXVsdFZhbHVlcyxcblx0YnVpbGRGdWxsRnJvbnRtYXR0ZXI6IChjcmVhdGVkOiBzdHJpbmcsIGRlZmF1bHRzPzogRm9sZGVyRGVmYXVsdFZhbHVlcykgPT4gc3RyaW5nLFxuKTogc3RyaW5nIHwgbnVsbCB7XG5cdGNvbnN0IGNyZWF0ZWQgPSBmb3JtYXRMb2NhbERhdGUobmV3IERhdGUoZmlsZS5zdGF0LmN0aW1lKSk7XG5cdGNvbnN0IHNvdXJjZSA9IHBhcnNlRnJvbnRtYXR0ZXIoY29udGVudCkgPT09IG51bGwgPyBidWlsZEZ1bGxGcm9udG1hdHRlcihjcmVhdGVkLCBkZWZhdWx0cykgKyBjb250ZW50IDogY29udGVudDtcblx0Y29uc3QgZnJvbnRtYXR0ZXIgPSBwYXJzZUZyb250bWF0dGVyKHNvdXJjZSk7XG5cdGlmIChmcm9udG1hdHRlciA9PT0gbnVsbCkge1xuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0bGV0IGJvZHkgPSBtaWdyYXRlTGVnYWN5RnJvbnRtYXR0ZXJCb2R5KGZyb250bWF0dGVyLmJvZHkpO1xuXHRpZiAoIWhhc0Zyb250bWF0dGVyQmxvY2socGFyc2VGcm9udG1hdHRlckJsb2Nrcyhib2R5KSwgXCLmkZjopoFcIikpIHtcblx0XHRib2R5ID0gYnVpbGRGcm9udG1hdHRlckJvZHlXaXRoTWlzc2luZ0ZpZWxkcyhib2R5LCBbXCLmkZjopoFcIl0sIFtdLCBjcmVhdGVkLCBcIlwiLCBkZWZhdWx0cyk7XG5cdH1cblxuXHRjb25zdCBuZXh0Qm9keSA9IHJlcGxhY2VTdW1tYXJ5RmllbGQoYm9keSwgbm9ybWFsaXplU3VtbWFyeShzdW1tYXJ5KSk7XG5cdGNvbnN0IHN1ZmZpeCA9IHNvdXJjZS5zbGljZShmcm9udG1hdHRlci5lbmQpO1xuXHRjb25zdCBzZXBhcmF0b3IgPSBzdWZmaXguc3RhcnRzV2l0aChcIlxcblwiKSA/IFwiXCIgOiBcIlxcblwiO1xuXHRyZXR1cm4gYC0tLVxcbiR7bmV4dEJvZHl9JHtzZXBhcmF0b3J9JHtzdWZmaXh9YDtcbn1cblxuZnVuY3Rpb24gcmVwbGFjZVN1bW1hcnlGaWVsZChmcm9udG1hdHRlckJvZHk6IHN0cmluZywgc3VtbWFyeTogc3RyaW5nKTogc3RyaW5nIHtcblx0bGV0IHJlcGxhY2VkID0gZmFsc2U7XG5cdGNvbnN0IGJsb2NrcyA9IHBhcnNlRnJvbnRtYXR0ZXJCbG9ja3MoZnJvbnRtYXR0ZXJCb2R5KTtcblx0Y29uc3QgbGluZXMgPSBibG9ja3MuZmxhdE1hcCgoYmxvY2spID0+IHtcblx0XHRpZiAoYmxvY2sua2V5ID09PSBcIuaRmOimgVwiICYmICFyZXBsYWNlZCkge1xuXHRcdFx0cmVwbGFjZWQgPSB0cnVlO1xuXHRcdFx0cmV0dXJuIFtmb3JtYXRTY2FsYXJGaWVsZChcIuaRmOimgVwiLCBzdW1tYXJ5KV07XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGJsb2NrLmxpbmVzO1xuXHR9KTtcblx0cmV0dXJuIGxpbmVzLmpvaW4oXCJcXG5cIik7XG59XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZVN1bW1hcnkoc3VtbWFyeTogc3RyaW5nKTogc3RyaW5nIHtcblx0cmV0dXJuIHN1bW1hcnkucmVwbGFjZSgvXFxzKy9nLCBcIiBcIikudHJpbSgpO1xufVxuXG5mdW5jdGlvbiBnZXRFcnJvck1lc3NhZ2UoZXJyb3I6IHVua25vd24pOiBzdHJpbmcge1xuXHRyZXR1cm4gZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpO1xufVxuXG5mdW5jdGlvbiBmcm9udG1hdHRlckF1dGhvckNvbnRhaW5zKHZhbHVlOiB1bmtub3duLCBhdXRob3I6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRyZXR1cm4gbm9ybWFsaXplQ2FuZGlkYXRlVmFsdWVzKHZhbHVlKS5pbmNsdWRlcyhhdXRob3IpO1xufVxuXG5mdW5jdGlvbiBub3JtYWxpemVGcm9udG1hdHRlclNjYWxhcih2YWx1ZTogdW5rbm93bik6IHN0cmluZyB7XG5cdGlmICh0eXBlb2YgdmFsdWUgPT09IFwic3RyaW5nXCIpIHtcblx0XHRyZXR1cm4gdmFsdWUudHJpbSgpO1xuXHR9XG5cdGlmICh2YWx1ZSA9PT0gbnVsbCB8fCB2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0cmV0dXJuIFwiXCI7XG5cdH1cblx0aWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG5cdFx0cmV0dXJuIHZhbHVlXG5cdFx0XHQubWFwKChpdGVtKSA9PiBub3JtYWxpemVGcm9udG1hdHRlclNjYWxhcihpdGVtKSlcblx0XHRcdC5maW5kKChpdGVtKSA9PiBpdGVtLmxlbmd0aCA+IDApID8/IFwiXCI7XG5cdH1cblx0cmV0dXJuIFN0cmluZyh2YWx1ZSkudHJpbSgpO1xufVxuXG5mdW5jdGlvbiByZXBsYWNlUHJvbXB0VG9rZW4ocHJvbXB0OiBzdHJpbmcsIHRva2VuOiBzdHJpbmcsIHZhbHVlOiBzdHJpbmcpOiBzdHJpbmcge1xuXHRyZXR1cm4gcHJvbXB0LnNwbGl0KHRva2VuKS5qb2luKHZhbHVlKTtcbn1cblxuZnVuY3Rpb24gZGVsYXkobXM6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuXHRyZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcblx0XHR3aW5kb3cuc2V0VGltZW91dChyZXNvbHZlLCBtcyk7XG5cdH0pO1xufVxuXG5mdW5jdGlvbiBjbGFtcCh2YWx1ZTogbnVtYmVyLCBtaW46IG51bWJlciwgbWF4OiBudW1iZXIpOiBudW1iZXIge1xuXHRyZXR1cm4gTWF0aC5taW4oTWF0aC5tYXgodmFsdWUsIG1pbiksIG1heCk7XG59XG5cbmZ1bmN0aW9uIGZvcm1hdFNjYW5SZWFzb24ocmVzdWx0OiBTY2FuUmVzdWx0KTogc3RyaW5nIHtcblx0Y29uc3QgcmVhc29uczogc3RyaW5nW10gPSBbXTtcblx0Zm9yIChjb25zdCByZW5hbWUgb2YgcmVzdWx0LnJlbmFtZUZpZWxkcykge1xuXHRcdHJlYXNvbnMucHVzaChg5a2X5q616ZyA6YeN5ZG95ZCN77yaJHtyZW5hbWUuZnJvbX0g4oaSICR7cmVuYW1lLnRvfWApO1xuXHR9XG5cdGlmIChyZXN1bHQubWlzc2luZ0ZpZWxkcy5sZW5ndGggPiAwKSB7XG5cdFx0cmVhc29ucy5wdXNoKGDnvLrlsJHvvJoke3Jlc3VsdC5taXNzaW5nRmllbGRzLmpvaW4oXCIsIFwiKX1gKTtcblx0fVxuXHRpZiAocmVzdWx0LmRlZmF1bHRGaWVsZHMubGVuZ3RoID4gMCkge1xuXHRcdHJlYXNvbnMucHVzaChg6buY6K6k5YC86KGl5YWo77yaJHtyZXN1bHQuZGVmYXVsdEZpZWxkcy5qb2luKFwiLCBcIil9YCk7XG5cdH1cblx0aWYgKHJlc3VsdC5vcmRlck5lZWRzRml4KSB7XG5cdFx0cmVhc29ucy5wdXNoKFwi5a2X5q616aG65bqP6ZyA6LCD5pW0XCIpO1xuXHR9XG5cdHJldHVybiByZWFzb25zLmpvaW4oXCLvvJtcIik7XG59XG5cbmZ1bmN0aW9uIGZpbmRNZXRhZGF0YVJvdyhjb250YWluZXI6IEhUTUxFbGVtZW50LCBmaWVsZDogUmVxdWlyZWRGaWVsZCk6IEhUTUxFbGVtZW50IHwgbnVsbCB7XG5cdGNvbnN0IGRhdGFSb3cgPSBjb250YWluZXIucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oYFtkYXRhLXByb3BlcnR5LWtleT1cIiR7ZmllbGR9XCJdYCk7XG5cdGlmIChkYXRhUm93ICE9PSBudWxsKSB7XG5cdFx0cmV0dXJuIChkYXRhUm93LmNsb3Nlc3QoXCIubWV0YWRhdGEtcHJvcGVydHlcIikgYXMgSFRNTEVsZW1lbnQgfCBudWxsKSA/PyBkYXRhUm93O1xuXHR9XG5cblx0Y29uc3QgcHJvcGVydHlSb3dzID0gY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTEVsZW1lbnQ+KFwiLm1ldGFkYXRhLXByb3BlcnR5XCIpO1xuXHRmb3IgKGNvbnN0IHJvdyBvZiBBcnJheS5mcm9tKHByb3BlcnR5Um93cykpIHtcblx0XHRpZiAocm93Q29udGFpbnNGaWVsZExhYmVsKHJvdywgZmllbGQpKSB7XG5cdFx0XHRyZXR1cm4gcm93O1xuXHRcdH1cblx0fVxuXG5cdGNvbnN0IGVsZW1lbnRzID0gY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTEVsZW1lbnQ+KFwiKlwiKTtcblx0Zm9yIChjb25zdCBlbCBvZiBBcnJheS5mcm9tKGVsZW1lbnRzKSkge1xuXHRcdGlmIChnZXRFbGVtZW50TGFiZWwoZWwpID09PSBmaWVsZCkge1xuXHRcdFx0cmV0dXJuIChlbC5jbG9zZXN0KFwiLm1ldGFkYXRhLXByb3BlcnR5XCIpIGFzIEhUTUxFbGVtZW50IHwgbnVsbCkgPz8gZWwucGFyZW50RWxlbWVudCA/PyBlbDtcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gZmluZE1ldGFkYXRhVmFsdWVDb250YWluZXIocm93OiBIVE1MRWxlbWVudCk6IEhUTUxFbGVtZW50IHwgbnVsbCB7XG5cdHJldHVybiByb3cucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oXG5cdFx0XCIubWV0YWRhdGEtcHJvcGVydHktdmFsdWUsIC5tZXRhZGF0YS1wcm9wZXJ0eS12YWx1ZS1pbnB1dCwgLm1ldGFkYXRhLXByb3BlcnR5LXZhbHVlLWNvbnRhaW5lclwiLFxuXHQpO1xufVxuXG5mdW5jdGlvbiByZW1vdmVFbXB0eUhpZ2hsaWdodENsYXNzZXMoZWw6IEVsZW1lbnQpIHtcblx0ZWwuY2xhc3NMaXN0LnJlbW92ZShcblx0XHRcImZyb250bWF0dGVyLWVtcHR5LWhpZ2hsaWdodFwiLFxuXHRcdFwiZnJvbnRtYXR0ZXItZW1wdHktMVwiLFxuXHRcdFwiZnJvbnRtYXR0ZXItZW1wdHktMlwiLFxuXHRcdFwiZnJvbnRtYXR0ZXItZW1wdHktM1wiLFxuXHRcdFwiZnJvbnRtYXR0ZXItZW1wdHktNFwiLFxuXHRcdFwiZnJvbnRtYXR0ZXItZW1wdHktNVwiLFxuXHRcdFwiZnJvbnRtYXR0ZXItZW1wdHktNlwiLFxuXHQpO1xufVxuXG5mdW5jdGlvbiBnZXREb2N1bWVudE9yZGVyKGE6IEhUTUxFbGVtZW50LCBiOiBIVE1MRWxlbWVudCk6IG51bWJlciB7XG5cdGlmIChhID09PSBiKSB7XG5cdFx0cmV0dXJuIDA7XG5cdH1cblxuXHRjb25zdCBwb3NpdGlvbiA9IGEuY29tcGFyZURvY3VtZW50UG9zaXRpb24oYik7XG5cdHJldHVybiBwb3NpdGlvbiAmIE5vZGUuRE9DVU1FTlRfUE9TSVRJT05fRk9MTE9XSU5HID8gLTEgOiAxO1xufVxuXG5mdW5jdGlvbiByb3dDb250YWluc0ZpZWxkTGFiZWwocm93OiBIVE1MRWxlbWVudCwgZmllbGQ6IFJlcXVpcmVkRmllbGQpOiBib29sZWFuIHtcblx0aWYgKGdldEVsZW1lbnRMYWJlbChyb3cpID09PSBmaWVsZCkge1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0Y29uc3QgbGFiZWxFbGVtZW50cyA9IHJvdy5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50Pihcblx0XHRcIi5tZXRhZGF0YS1wcm9wZXJ0eS1rZXksIC5tZXRhZGF0YS1wcm9wZXJ0eS1rZXktaW5wdXQsIFthcmlhLWxhYmVsXSwgW3RpdGxlXVwiLFxuXHQpO1xuXHRmb3IgKGNvbnN0IGVsIG9mIEFycmF5LmZyb20obGFiZWxFbGVtZW50cykpIHtcblx0XHRpZiAoZ2V0RWxlbWVudExhYmVsKGVsKSA9PT0gZmllbGQpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiBmYWxzZTtcbn1cblxuZnVuY3Rpb24gZ2V0RWxlbWVudExhYmVsKGVsOiBIVE1MRWxlbWVudCk6IHN0cmluZyB7XG5cdGlmIChlbCBpbnN0YW5jZW9mIEhUTUxJbnB1dEVsZW1lbnQgfHwgZWwgaW5zdGFuY2VvZiBIVE1MVGV4dEFyZWFFbGVtZW50KSB7XG5cdFx0cmV0dXJuIGVsLnZhbHVlLnRyaW0oKTtcblx0fVxuXG5cdHJldHVybiAoXG5cdFx0ZWwuZ2V0QXR0cmlidXRlKFwiZGF0YS1wcm9wZXJ0eS1rZXlcIikgPz9cblx0XHRlbC5nZXRBdHRyaWJ1dGUoXCJhcmlhLWxhYmVsXCIpID8/XG5cdFx0ZWwuZ2V0QXR0cmlidXRlKFwidGl0bGVcIikgPz9cblx0XHRlbC50ZXh0Q29udGVudCA/P1xuXHRcdFwiXCJcblx0KS50cmltKCk7XG59XG5cbmZ1bmN0aW9uIGlzRW1wdHlGcm9udG1hdHRlclZhbHVlKHZhbHVlOiB1bmtub3duKTogYm9vbGVhbiB7XG5cdGlmICh2YWx1ZSA9PT0gbnVsbCB8fCB2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblx0aWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJzdHJpbmdcIikge1xuXHRcdHJldHVybiB2YWx1ZS50cmltKCkubGVuZ3RoID09PSAwO1xuXHR9XG5cdGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuXHRcdHJldHVybiB2YWx1ZS5sZW5ndGggPT09IDAgfHwgdmFsdWUuZXZlcnkoKGl0ZW0pID0+IGlzRW1wdHlGcm9udG1hdHRlclZhbHVlKGl0ZW0pKTtcblx0fVxuXG5cdHJldHVybiBmYWxzZTtcbn1cblxuZnVuY3Rpb24gZ2V0VmF1bHRGb2xkZXJzKGFwcDogQXBwKTogc3RyaW5nW10ge1xuXHRjb25zdCBmb2xkZXJzID0gYXBwLnZhdWx0XG5cdFx0LmdldEFsbExvYWRlZEZpbGVzKClcblx0XHQuZmlsdGVyKChmaWxlKTogZmlsZSBpcyBURm9sZGVyID0+IGZpbGUgaW5zdGFuY2VvZiBURm9sZGVyKVxuXHRcdC5tYXAoKGZvbGRlcikgPT4gZm9sZGVyLnBhdGgpXG5cdFx0LnNvcnQoKGEsIGIpID0+IGEubG9jYWxlQ29tcGFyZShiKSk7XG5cblx0cmV0dXJuIFtcIlwiLCAuLi5mb2xkZXJzLmZpbHRlcigoZm9sZGVyKSA9PiBmb2xkZXIubGVuZ3RoID4gMCldO1xufVxuXG5mdW5jdGlvbiBzaG91bGRJbmNsdWRlUnVsZUZvbGRlcihmb2xkZXI6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRyZXR1cm4gZm9sZGVyLmxlbmd0aCA+IDAgJiYgZm9sZGVyICE9PSBcIi5vYnNpZGlhblwiICYmICFmb2xkZXIuc3RhcnRzV2l0aChcIi5vYnNpZGlhbi9cIik7XG59XG5cbmZ1bmN0aW9uIGZvcm1hdEZvbGRlck9wdGlvbkxhYmVsKGZvbGRlcjogc3RyaW5nKTogc3RyaW5nIHtcblx0aWYgKGZvbGRlciA9PT0gXCJcIikge1xuXHRcdHJldHVybiBcIi9cIjtcblx0fVxuXG5cdGNvbnN0IGRlcHRoID0gZ2V0Rm9sZGVyRGVwdGgoZm9sZGVyKSAtIDE7XG5cdGNvbnN0IG5hbWUgPSBmb2xkZXIuc3BsaXQoXCIvXCIpLnBvcCgpID8/IGZvbGRlcjtcblx0cmV0dXJuIGAke1wiXFx1MDBBMFxcdTAwQTBcXHUwMEEwXFx1MDBBMFwiLnJlcGVhdChkZXB0aCl9JHtuYW1lfWA7XG59XG5cbmZ1bmN0aW9uIGZvcm1hdFJ1bGVJbmxpbmVWYWx1ZSh2YWx1ZTogc3RyaW5nKTogc3RyaW5nIHtcblx0cmV0dXJuIHZhbHVlLnRyaW0oKS5sZW5ndGggPiAwID8gdmFsdWUgOiBcIl9fX19fX1wiO1xufVxuXG5mdW5jdGlvbiB0b2dnbGVNb2RhbFNlbGVjdFBsYWNlaG9sZGVyKHNlbGVjdEVsOiBIVE1MU2VsZWN0RWxlbWVudCwgaXNQbGFjZWhvbGRlcjogYm9vbGVhbikge1xuXHRzZWxlY3RFbC5jbGFzc0xpc3QudG9nZ2xlKFwiaXMtcGxhY2Vob2xkZXJcIiwgaXNQbGFjZWhvbGRlcik7XG59XG5cbmZ1bmN0aW9uIGdldEFuY2VzdG9yUnVsZXMoZm9sZGVyOiBzdHJpbmcsIHJ1bGVzOiBGb2xkZXJEZWZhdWx0UnVsZVtdKTogRm9sZGVyRGVmYXVsdFJ1bGVbXSB7XG5cdHJldHVybiBydWxlc1xuXHRcdC5maWx0ZXIoKHJ1bGUpID0+IHtcblx0XHRcdHJldHVybiBydWxlLnZhbHVlICYmIHNob3VsZEluY2x1ZGVSdWxlRm9sZGVyKHJ1bGUuZm9sZGVyKSAmJiBydWxlLmZvbGRlciAhPT0gZm9sZGVyICYmIGZvbGRlck1hdGNoZXMoZm9sZGVyLCBydWxlLmZvbGRlcik7XG5cdFx0fSlcblx0XHQuc29ydCgoYSwgYikgPT4ge1xuXHRcdFx0Y29uc3QgZGVwdGhEaWZmID0gZ2V0Rm9sZGVyRGVwdGgoYi5mb2xkZXIpIC0gZ2V0Rm9sZGVyRGVwdGgoYS5mb2xkZXIpO1xuXHRcdFx0aWYgKGRlcHRoRGlmZiAhPT0gMCkge1xuXHRcdFx0XHRyZXR1cm4gZGVwdGhEaWZmO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGEuZm9sZGVyLmxvY2FsZUNvbXBhcmUoYi5mb2xkZXIpIHx8IGEuZmllbGQubG9jYWxlQ29tcGFyZShiLmZpZWxkKTtcblx0XHR9KTtcbn1cblxuZnVuY3Rpb24gZm9ybWF0UnVsZUF1ZGl0KHJ1bGU6IEZvbGRlckRlZmF1bHRSdWxlKTogc3RyaW5nIHtcblx0aWYgKCFydWxlLmNyZWF0ZWRCeSB8fCAhcnVsZS5jcmVhdGVkQXQpIHtcblx0XHRyZXR1cm4gXCLliJvlu7rkv6Hmga/kuI3lj6/ov73muq9cIjtcblx0fVxuXG5cdGNvbnN0IGNyZWF0ZWQgPSBg55SxICR7cnVsZS5jcmVhdGVkQnl9IOWIm+W7uuS6jiAke2Zvcm1hdEF1ZGl0VGltZShydWxlLmNyZWF0ZWRBdCl9YDtcblx0aWYgKFxuXHRcdCFydWxlLm1vZGlmaWVkQnkgfHxcblx0XHQhcnVsZS5tb2RpZmllZEF0IHx8XG5cdFx0KHJ1bGUubW9kaWZpZWRCeSA9PT0gcnVsZS5jcmVhdGVkQnkgJiYgcnVsZS5tb2RpZmllZEF0ID09PSBydWxlLmNyZWF0ZWRBdClcblx0KSB7XG5cdFx0cmV0dXJuIGNyZWF0ZWQ7XG5cdH1cblxuXHRyZXR1cm4gYCR7Y3JlYXRlZH0gwrcgJHtydWxlLm1vZGlmaWVkQnl9IOacgOWQjuS/ruaUueS6jiAke2Zvcm1hdEF1ZGl0VGltZShydWxlLm1vZGlmaWVkQXQpfWA7XG59XG5cbmZ1bmN0aW9uIGZvcm1hdEF1ZGl0VGltZSh2YWx1ZTogc3RyaW5nKTogc3RyaW5nIHtcblx0cmV0dXJuIHZhbHVlLnJlcGxhY2UoXCJUXCIsIFwiIFwiKS5zbGljZSgwLCAxNik7XG59XG5cbmZ1bmN0aW9uIGdldERldmljZVV1aWQoKTogc3RyaW5nIHtcblx0dHJ5IHtcblx0XHRpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gXCJkYXJ3aW5cIikge1xuXHRcdFx0Y29uc3Qgb3V0cHV0ID0gcmVxdWlyZShcImNoaWxkX3Byb2Nlc3NcIilcblx0XHRcdFx0LmV4ZWNTeW5jKFwiaW9yZWcgLXJkMSAtYyBJT1BsYXRmb3JtRXhwZXJ0RGV2aWNlXCIpXG5cdFx0XHRcdC50b1N0cmluZygpO1xuXHRcdFx0Y29uc3QgbWF0Y2ggPSAvXCJJT1BsYXRmb3JtVVVJRFwiXFxzKj1cXHMqXCIoW15cIl0rKVwiLy5leGVjKG91dHB1dCk7XG5cdFx0XHRpZiAobWF0Y2gpIHtcblx0XHRcdFx0cmV0dXJuIG1hdGNoWzFdO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSBcIndpbjMyXCIpIHtcblx0XHRcdGNvbnN0IG91dHB1dCA9IHJlcXVpcmUoXCJjaGlsZF9wcm9jZXNzXCIpLmV4ZWNTeW5jKFwid21pYyBjc3Byb2R1Y3QgZ2V0IFVVSURcIikudG9TdHJpbmcoKTtcblx0XHRcdGNvbnN0IHV1aWQgPSBvdXRwdXRcblx0XHRcdFx0LnNwbGl0KC9cXHI/XFxuLylcblx0XHRcdFx0Lm1hcCgobGluZTogc3RyaW5nKSA9PiBsaW5lLnRyaW0oKSlcblx0XHRcdFx0LmZpbmQoKGxpbmU6IHN0cmluZykgPT4gbGluZSAmJiBsaW5lLnRvTG93ZXJDYXNlKCkgIT09IFwidXVpZFwiKTtcblx0XHRcdGlmICh1dWlkKSB7XG5cdFx0XHRcdHJldHVybiB1dWlkO1xuXHRcdFx0fVxuXHRcdH1cblx0fSBjYXRjaCB7XG5cdFx0Ly8gRmFsbCBiYWNrIHRvIGhvc3RuYW1lIGJlbG93LlxuXHR9XG5cblx0cmV0dXJuIHJlcXVpcmUoXCJvc1wiKS5ob3N0bmFtZSgpO1xufVxuXG5mdW5jdGlvbiBnZXRMZWdhY3lBdXRob3JOYW1lKHNldHRpbmdzOiBBdXRvRnJvbnRtYXR0ZXJTZXR0aW5ncyk6IHN0cmluZyB7XG5cdGlmIChzZXR0aW5ncy5hdXRob3JNb2RlID09PSBDVVNUT01fQVVUSE9SX01PREUpIHtcblx0XHRyZXR1cm4gc2V0dGluZ3MuYXV0aG9yQ3VzdG9tID8/IFwiXCI7XG5cdH1cblx0cmV0dXJuIHNldHRpbmdzLmF1dGhvck1vZGUgfHwgc2V0dGluZ3MuYXV0aG9yTmFtZSB8fCBcIlwiO1xufVxuXG5mdW5jdGlvbiBtYXNrRGV2aWNlVXVpZCh1dWlkOiBzdHJpbmcpOiBzdHJpbmcge1xuXHRjb25zdCBwYXJ0cyA9IHV1aWQuc3BsaXQoXCItXCIpO1xuXHRpZiAocGFydHMubGVuZ3RoICE9PSA1KSB7XG5cdFx0cmV0dXJuIHV1aWQ7XG5cdH1cblxuXHRjb25zdCBsYXN0ID0gcGFydHNbNF07XG5cdHJldHVybiBgJHtwYXJ0c1swXX0tKioqKi0qKioqLSoqKiotKioqKioqKioke2xhc3Quc2xpY2UoLTQpfWA7XG59XG5cbmZ1bmN0aW9uIGdldEZyb250bWF0dGVyRmllbGRDYW5kaWRhdGVzKGFwcDogQXBwLCBmaWVsZDogRm9sZGVyRGVmYXVsdEZpZWxkKTogc3RyaW5nW10ge1xuXHRjb25zdCB2YWx1ZXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcblx0Zm9yIChjb25zdCBmaWxlIG9mIGFwcC52YXVsdC5nZXRNYXJrZG93bkZpbGVzKCkpIHtcblx0XHRjb25zdCB2YWx1ZSA9IGFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShmaWxlKT8uZnJvbnRtYXR0ZXI/LltmaWVsZF07XG5cdFx0Zm9yIChjb25zdCBpdGVtIG9mIG5vcm1hbGl6ZUNhbmRpZGF0ZVZhbHVlcyh2YWx1ZSkpIHtcblx0XHRcdHZhbHVlcy5hZGQoaXRlbSk7XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIEFycmF5LmZyb20odmFsdWVzKS5zb3J0KChhLCBiKSA9PiBhLmxvY2FsZUNvbXBhcmUoYikpO1xufVxuXG5mdW5jdGlvbiBub3JtYWxpemVDYW5kaWRhdGVWYWx1ZXModmFsdWU6IHVua25vd24pOiBzdHJpbmdbXSB7XG5cdGlmICh0eXBlb2YgdmFsdWUgPT09IFwic3RyaW5nXCIpIHtcblx0XHRjb25zdCB0cmltbWVkID0gdmFsdWUudHJpbSgpO1xuXHRcdHJldHVybiB0cmltbWVkID8gW3RyaW1tZWRdIDogW107XG5cdH1cblx0aWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG5cdFx0cmV0dXJuIHZhbHVlLmZsYXRNYXAoKGl0ZW0pID0+IG5vcm1hbGl6ZUNhbmRpZGF0ZVZhbHVlcyhpdGVtKSk7XG5cdH1cblx0aWYgKHZhbHVlID09PSBudWxsIHx8IHZhbHVlID09PSB1bmRlZmluZWQpIHtcblx0XHRyZXR1cm4gW107XG5cdH1cblx0cmV0dXJuIFtTdHJpbmcodmFsdWUpXTtcbn1cblxuZnVuY3Rpb24gZ2V0RmlsZUZvbGRlcihwYXRoOiBzdHJpbmcpOiBzdHJpbmcge1xuXHRjb25zdCBzbGFzaCA9IHBhdGgubGFzdEluZGV4T2YoXCIvXCIpO1xuXHRyZXR1cm4gc2xhc2ggPT09IC0xID8gXCJcIiA6IHBhdGguc2xpY2UoMCwgc2xhc2gpO1xufVxuXG5mdW5jdGlvbiBmb2xkZXJNYXRjaGVzKGZpbGVGb2xkZXI6IHN0cmluZywgcnVsZUZvbGRlcjogc3RyaW5nKTogYm9vbGVhbiB7XG5cdHJldHVybiBydWxlRm9sZGVyID09PSBcIlwiIHx8IGZpbGVGb2xkZXIgPT09IHJ1bGVGb2xkZXIgfHwgZmlsZUZvbGRlci5zdGFydHNXaXRoKGAke3J1bGVGb2xkZXJ9L2ApO1xufVxuXG5mdW5jdGlvbiBnZXRGb2xkZXJEZXB0aChmb2xkZXI6IHN0cmluZyk6IG51bWJlciB7XG5cdHJldHVybiBmb2xkZXIgPT09IFwiXCIgPyAwIDogZm9sZGVyLnNwbGl0KFwiL1wiKS5sZW5ndGg7XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZUZyb250bWF0dGVyVXBkYXRlZChjb250ZW50OiBzdHJpbmcsIHVwZGF0ZWQ6IHN0cmluZyk6IHN0cmluZyB8IG51bGwge1xuXHRpZiAoIWNvbnRlbnQuc3RhcnRzV2l0aChcIi0tLVxcblwiKSkge1xuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0Y29uc3QgZW5kID0gY29udGVudC5pbmRleE9mKFwiXFxuLS0tXCIsIDQpO1xuXHRpZiAoZW5kID09PSAtMSkge1xuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0Y29uc3QgZnJvbnRtYXR0ZXIgPSBjb250ZW50LnNsaWNlKDAsIGVuZCArIDEpO1xuXHRjb25zdCB1cGRhdGVkTGluZSA9IC9e5pyA5ZCO5pu05pawOlxccyouKiQvbTtcblx0aWYgKCF1cGRhdGVkTGluZS50ZXN0KGZyb250bWF0dGVyKSkge1xuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0Y29uc3QgbmV4dEZyb250bWF0dGVyID0gZnJvbnRtYXR0ZXIucmVwbGFjZSh1cGRhdGVkTGluZSwgYOacgOWQjuabtOaWsDogJHt1cGRhdGVkfWApO1xuXHRyZXR1cm4gbmV4dEZyb250bWF0dGVyICsgY29udGVudC5zbGljZShlbmQgKyAxKTtcbn1cblxuZnVuY3Rpb24gZm9ybWF0TG9jYWxEYXRlKGRhdGU6IERhdGUpOiBzdHJpbmcge1xuXHRjb25zdCB5ZWFyID0gZGF0ZS5nZXRGdWxsWWVhcigpO1xuXHRjb25zdCBtb250aCA9IHBhZChkYXRlLmdldE1vbnRoKCkgKyAxKTtcblx0Y29uc3QgZGF5ID0gcGFkKGRhdGUuZ2V0RGF0ZSgpKTtcblx0Y29uc3QgaG91ciA9IHBhZChkYXRlLmdldEhvdXJzKCkpO1xuXHRjb25zdCBtaW51dGUgPSBwYWQoZGF0ZS5nZXRNaW51dGVzKCkpO1xuXHRjb25zdCBzZWNvbmQgPSBwYWQoZGF0ZS5nZXRTZWNvbmRzKCkpO1xuXHRyZXR1cm4gYCR7eWVhcn0tJHttb250aH0tJHtkYXl9VCR7aG91cn06JHttaW51dGV9OiR7c2Vjb25kfWA7XG59XG5cbmZ1bmN0aW9uIHBhZCh2YWx1ZTogbnVtYmVyKTogc3RyaW5nIHtcblx0cmV0dXJuIHZhbHVlLnRvU3RyaW5nKCkucGFkU3RhcnQoMiwgXCIwXCIpO1xufVxuXG5mdW5jdGlvbiBmb3JtYXRZYW1sU2NhbGFyKHZhbHVlOiBzdHJpbmcpOiBzdHJpbmcge1xuXHRpZiAoIXZhbHVlKSB7XG5cdFx0cmV0dXJuIFwiXCI7XG5cdH1cblxuXHRyZXR1cm4gSlNPTi5zdHJpbmdpZnkodmFsdWUpO1xufVxuXG5mdW5jdGlvbiB5aWVsZFRvVWkoKTogUHJvbWlzZTx2b2lkPiB7XG5cdHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuXHRcdHdpbmRvdy5zZXRUaW1lb3V0KHJlc29sdmUsIDApO1xuXHR9KTtcbn1cbiJdfQ==