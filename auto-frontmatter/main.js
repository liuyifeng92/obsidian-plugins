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
const GITHUB_RAW_BASE = "https://raw.githubusercontent.com/liuyifeng92/obsidian-plugins/main/auto-frontmatter";
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
            const response = await fetch(`${GITHUB_RAW_BASE}/manifest.json`);
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
        const pluginId = this.manifest.id;
        const app = this.app;
        new obsidian_1.Notice(`更新完成（${version}），正在重载插件...`);
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
            }
            catch (e) {
                new obsidian_1.Notice("自动重载失败，请点击已安装插件页的「重新加载插件」按钮");
            }
        }, 100);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm1haW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSx1Q0Fja0I7QUE4Q2xCLE1BQU0sMEJBQTBCLEdBQUcsS0FBSyxDQUFDO0FBQ3pDLE1BQU0sNkJBQTZCLEdBQUcsRUFBRSxHQUFHLElBQUksQ0FBQztBQUNoRCxNQUFNLDJCQUEyQixHQUFHLElBQUksQ0FBQztBQUN6QyxNQUFNLHVCQUF1QixHQUFHLEVBQUUsQ0FBQztBQUNuQyxNQUFNLGNBQWMsR0FBRyxDQUFDLENBQUM7QUFDekIsTUFBTSxxQkFBcUIsR0FBRzs7Ozs7Ozs7OztVQVVwQixDQUFDO0FBQ1gsTUFBTSwwQkFBMEIsR0FBRzs7Ozs7Ozs7Ozs7Ozs7OztVQWdCekIsQ0FBQztBQUNYLE1BQU0seUJBQXlCLEdBQUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztVQThCeEIsQ0FBQztBQUVYLE1BQU0sZ0JBQWdCLEdBQTRCO0lBQ2pELFFBQVEsRUFBRSxFQUFFO0lBQ1osUUFBUSxFQUFFLHNDQUFzQztJQUNoRCxXQUFXLEVBQUUsZ0JBQWdCO0lBQzdCLGdCQUFnQixFQUFFLElBQUk7SUFDdEIsZUFBZSxFQUFFLHlCQUF5QjtJQUMxQyxjQUFjLEVBQUUsRUFBRTtJQUNsQixtQkFBbUIsRUFBRSxJQUFJO0lBQ3pCLGNBQWMsRUFBRSxFQUFFO0lBQ2xCLG1CQUFtQixFQUFFLEtBQUs7Q0FDMUIsQ0FBQztBQUVGLE1BQU0sY0FBYyxHQUFHO0lBQ3RCLEtBQUs7SUFDTCxLQUFLO0lBQ0wsS0FBSztJQUNMLEtBQUs7SUFDTCxJQUFJO0lBQ0osS0FBSztJQUNMLEtBQUs7SUFDTCxLQUFLO0NBQ0ksQ0FBQztBQUNYLE1BQU0sa0JBQWtCLEdBQUcsS0FBSyxDQUFDO0FBRWpDLE1BQU0sZUFBZSxHQUFHLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxNQUFNLENBQVUsQ0FB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SUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7SUFDbEMsTUFBTSxNQUFNLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDO0lBQ3RDLE1BQU0sTUFBTSxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQztJQUN0QyxPQUFPLEdBQUcsSUFBSSxJQUFJLEtBQUssSUFBSSxHQUFHLElBQUksSUFBSSxJQUFJLE1BQU0sSUFBSSxNQUFNLEVBQUUsQ0FBQztBQUM5RCxDQUFDO0FBRUQsU0FBUyxHQUFHLENBQUMsS0FBYTtJQUN6QixPQUFPLEtBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBQzFDLENBQUM7QUFFRCxTQUFTLGdCQUFnQixDQUFDLEtBQWE7SUFDdEMsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQ1osT0FBTyxFQUFFLENBQUM7SUFDWCxDQUFDO0lBRUQsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQzlCLENBQUM7QUFFRCxTQUFTLFNBQVM7SUFDakIsT0FBTyxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxFQUFFO1FBQzlCLE1BQU0sQ0FBQyxVQUFVLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQy9CLENBQUMsQ0FBQyxDQUFDO0FBQ0osQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7XG5cdEFwcCxcblx0RWRpdG9yLFxuXHRNZW51LFxuXHRNYXJrZG93blZpZXcsXG5cdE1vZGFsLFxuXHROb3RpY2UsXG5cdFBsdWdpbixcblx0UGx1Z2luU2V0dGluZ1RhYixcblx0U2V0dGluZyxcblx0c2V0SWNvbixcblx0VEFic3RyYWN0RmlsZSxcblx0VEZpbGUsXG5cdFRGb2xkZXIsXG59IGZyb20gXCJvYnNpZGlhblwiO1xuXG5pbnRlcmZhY2UgQXV0b0Zyb250bWF0dGVyU2V0dGluZ3Mge1xuXHRhdXRob3JNb2RlPzogc3RyaW5nO1xuXHRhdXRob3JDdXN0b20/OiBzdHJpbmc7XG5cdGF1dGhvck5hbWU/OiBzdHJpbmc7XG5cdGFpQXBpS2V5OiBzdHJpbmc7XG5cdGFpQXBpVXJsOiBzdHJpbmc7XG5cdGFpTW9kZWxOYW1lOiBzdHJpbmc7XG5cdGFpU3VtbWFyeUVuYWJsZWQ6IGJvb2xlYW47XG5cdGFpU3VtbWFyeVByb21wdDogc3RyaW5nO1xuXHRkZXZpY2VCaW5kaW5nczogRGV2aWNlQXV0aG9yQmluZGluZ1tdO1xuXHRlbXB0eUZpZWxkSGlnaGxpZ2h0OiBib29sZWFuO1xuXHRmb2xkZXJEZWZhdWx0czogRm9sZGVyRGVmYXVsdFJ1bGVbXTtcblx0c2hvd0ZvbGRlckNoZWNrbWFyazogYm9vbGVhbjtcbn1cblxuaW50ZXJmYWNlIFN1bW1hcnlTZXJ2aWNlIHtcblx0Z2VuZXJhdGVTdW1tYXJ5KGRvY3VtZW50OiBTdW1tYXJ5RG9jdW1lbnQpOiBQcm9taXNlPHN0cmluZz47XG59XG5cbmludGVyZmFjZSBTdW1tYXJ5RG9jdW1lbnQge1xuXHR0aXRsZTogc3RyaW5nO1xuXHRmcm9udG1hdHRlcjogc3RyaW5nO1xuXHRjb250ZW50OiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBEZXZpY2VBdXRob3JCaW5kaW5nIHtcblx0dXVpZDogc3RyaW5nO1xuXHRhdXRob3I6IHN0cmluZztcbn1cblxuaW50ZXJmYWNlIEZvbGRlckRlZmF1bHRSdWxlIHtcblx0Zm9sZGVyOiBzdHJpbmc7XG5cdGZpZWxkOiBGb2xkZXJEZWZhdWx0RmllbGQ7XG5cdHZhbHVlOiBzdHJpbmc7XG5cdGNyZWF0ZWRCeT86IHN0cmluZztcblx0Y3JlYXRlZEF0Pzogc3RyaW5nO1xuXHRtb2RpZmllZEJ5Pzogc3RyaW5nO1xuXHRtb2RpZmllZEF0Pzogc3RyaW5nO1xuXHRmaWVsZHM/OiBBcnJheTx7XG5cdFx0ZmllbGQ6IEZvbGRlckRlZmF1bHRGaWVsZDtcblx0XHR2YWx1ZTogc3RyaW5nO1xuXHR9Pjtcbn1cblxuY29uc3QgTUFYX1NVTU1BUllfQ09OVEVOVF9MRU5HVEggPSAxNjAwMDtcbmNvbnN0IEFJX1NVTU1BUllfU0NIRURVTEVSX0NIRUNLX01TID0gNjAgKiAxMDAwO1xuY29uc3QgQUlfU1VNTUFSWV9SRVFVRVNUX0RFTEFZX01TID0gMjAwMDtcbmNvbnN0IE1JTl9TVU1NQVJZX0JPRFlfTEVOR1RIID0gNTA7XG5jb25zdCBSVUxFU19QRVJfUEFHRSA9IDY7XG5jb25zdCBPTERfQUlfU1VNTUFSWV9QUk9NUFQgPSBg5L2g5piv5LiA5L2N5LiT5Lia55qE5paH5qGj5pGY6KaB5Yqp5omL44CC6K+35a+55Lul5LiL5paH5qGj5YaF5a6555Sf5oiQ5LiA5q61566A5rSB55qE5pGY6KaB44CCXG5cbuimgeaxgu+8mlxuMS4g5LiA5q616K+d5qaC5ous77yM5LiN6LaF6L+HIDEwMCDlrZdcbjIuIOaPkOeCvOaguOW/g+S4u+mimOOAgeWFs+mUrue7k+iuuuaIluS4u+imgeWGs+etllxuMy4g5LiN6KaB5Ye6546wXCLmnKzmlodcIuOAgVwi6L+Z56+H5paH5qGjXCLnrYnmjIfku6Por43vvIznm7TmjqXpmYjov7DlhoXlrrlcbjQuIOWmguaenOaWh+aho+WMheWQq+WbvueJh+aPj+i/sOaIluS7o+eggeeJh+aute+8jOS+p+mHjeaAu+e7k+WFtuaEj+WbvuiAjOmdnue7huiKglxuNS4g5L2/55So5LiO5Y6f5paH5LiA6Ie055qE6K+t6KiA77yI5Lit5paH5paH5qGj55So5Lit5paH77yM6Iux5paH5paH5qGj55So6Iux5paH77yJXG5cbuaWh+aho+WGheWuue+8mlxue2NvbnRlbnR9YDtcbmNvbnN0IFBSRVZJT1VTX0FJX1NVTU1BUllfUFJPTVBUID0gYOS9oOaYr+S4gOS9jeS4k+S4mueahOaWh+aho+aRmOimgeWKqeaJi+OAguivt+agueaNruS7peS4i+aWh+aho+eahOagh+mimOOAgeWxnuaAp+WSjOato+aWh+WGheWuue+8jOeUn+aIkOS4gOauteeugOa0geeahOS4reaWh+aRmOimgeOAglxuXG7opoHmsYLvvJpcbjEuIOS4gOauteivneamguaLrO+8jDMwIOWIsCAxNDAg5a2X5LmL6Ze0XG4yLiDmj5DngrzmoLjlv4PkuLvpopjjgIHlhbPplK7nu5PorrrmiJbkuLvopoHlhrPnrZZcbjMuIOS4jeimgeWHuueOsFwi5pys5paHXCLjgIFcIui/meevh+aWh+aho1wi562J5oyH5Luj6K+N77yM55u05o6l6ZmI6L+w5YaF5a65XG40LiDlpoLmnpzmlofmoaPljIXlkKvlm77niYfmj4/ov7DmiJbku6PnoIHniYfmrrXvvIzkvqfph43mgLvnu5PlhbbmhI/lm77ogIzpnZ7nu4boioJcbjUuIOaXoOiuuuWOn+aWh+aYr+S7gOS5iOivreiogO+8jOS4gOW+i+S9v+eUqOS4reaWh+i+k+WHulxuXG7mlofmoaPmoIfpopjvvJpcbnt0aXRsZX1cblxu5paH5qGj5bGe5oCn77yaXG57ZnJvbnRtYXR0ZXJ9XG5cbuaWh+aho+ato+aWh++8mlxue2NvbnRlbnR9YDtcbmNvbnN0IERFRkFVTFRfQUlfU1VNTUFSWV9QUk9NUFQgPSBg6K+35Li65Lul5LiL5YaF5a655YaZ5LiA5q615pGY6KaB44CCXG5cbuinhOWIme+8mlxuMS4gMzAg5YiwIDE0MCDlrZfvvIzkuIDmrrXor53vvIzkuI3mjaLooYxcbjIuIOeUqOS4reaWh+WGmVxuMy4g5Lul5YaF5a655pys6Lqr55qE5Y+j5ZC75qaC5ous77yM5YOP5piv6L+Z5q615YaF5a6555qE5byA5aS05a+86K+tXG40LiDnm7TmjqXpmYjov7DmoLjlv4Pkv6Hmga/vvJrlgZrkuobku4DkuYjjgIHop6PlhrPkuobku4DkuYjjgIHlvpflh7rkuobku4DkuYjnu5PorrpcbjUuIOemgeatouS9v+eUqOOAjOacrOaWh+OAjeOAjOivpeaWh+aho+OAjeOAjOi/meevh+eslOiusOOAjeOAjOS9nOiAheOAjeetieaMh+S7o+ivjVxuNi4g56aB5q2i5L2/55So44CM5LuL57uN5LqG44CN44CM6ZiQ6L+w5LqG44CN44CM5o+P6L+w5LqG44CN44CM6K6o6K665LqG44CN44CM5o6i6K6o5LqG44CN6L+Z57G75YWD5Y+Z6L+w5Yqo6K+NXG43LiDlpoLmnpzlhoXlrrnmmK/kvJrorq7nuqropoHvvIzmj5DngrzlhbPplK7lhrPnrZblkozlvoXlip5cbjguIOWmguaenOWGheWuueaYr+aKgOacr+aWueahiO+8jOaPkOeCvOebruagh+OAgeaWueahiOimgeeCueWSjOaguOW/g+e6puadn1xuOS4g5aaC5p6c5YaF5a655b6I55+t5oiW5L+h5oGv5a+G5bqm5L2O77yM5pGY6KaB5Y+v5Lul55+t5LqOIDMwIOWtl++8jOS9huS4jeimgeazqOawtFxuXG7lpb3nmoTmkZjopoHnpLrkvovvvJpcbi0g44CM6YCa6L+H5ouG5YiG6aaW5bGP5Yqg6L296LWE5rqQ5bm25byV5YWl6aqo5p625bGP77yM5bCG5bCP5pyI5Lqu5Ya35ZCv5Yqo5pe26Ze05LuOIDMuMnMg6ZmN6IezIDEuMXPvvIzlkIzml7bkv67lpI3kuoYgaU9TIOerr+eZveWxj+mXqueDgemXrumimOOAguOAjVxuLSDjgIznoa7orqQgUTMg5aKe6ZW/55uu5qCH5Li6IERBVSDnv7vlgI3vvIzkuLvopoHot6/lvoTkuLrnuqLljIXoo4Llj5ggKyDlhoXlrrnnpL7ljLrlhrflkK/liqjvvIzpooTnrpfkuIrpmZAgNTAg5LiH44CC44CNXG4tIOOAjOais+eQhuS6hiBPd2xlbiDmjqjojZDnrpfms5Xku47ljY/lkIzov4fmu6Tov4Hnp7vliLDlj4zloZTmqKHlnovnmoTmioDmnK/ot6/lvoTvvIzph43ngrnop6PlhrPlhrflkK/liqjlnLrmma/kuIvnmoTlj6zlm57njofpl67popjjgILjgI1cblxu5beu55qE5pGY6KaB56S65L6L77yI56aB5q2i77yJ77yaXG4tIOKcl+OAjOacrOaWh+S7i+e7jeS6huS4gOenjeS8mOWMluWGt+WQr+WKqOeahOaWueazlS4uLuOAje+8iOWFg+WPmei/sCArIOaMh+S7o+ivje+8iVxuLSDinJfjgIzor6XmlofmoaPorqjorrrkuoblhbPkuo7lop7plb/nm67moIfnmoTnm7jlhbPlhoXlrrkuLi7jgI3vvIjmqKHns4ogKyDmjIfku6Por43vvIlcbi0g4pyX44CM6L+Z5piv5LiA56+H5YWz5LqO5o6o6I2Q566X5rOV55qE5oqA5pyv5paH5qGjLi4u44CN77yI5bqf6K+d77yJXG5cbi0tLVxu5qCH6aKY77yae3RpdGxlfVxuXG7lsZ7mgKfvvJpcbntmcm9udG1hdHRlcn1cblxu5q2j5paH77yaXG57Y29udGVudH1gO1xuXG5jb25zdCBERUZBVUxUX1NFVFRJTkdTOiBBdXRvRnJvbnRtYXR0ZXJTZXR0aW5ncyA9IHtcblx0YWlBcGlLZXk6IFwiXCIsXG5cdGFpQXBpVXJsOiBcImh0dHBzOi8vYXBpLnN0ZXBmdW4uY29tL3N0ZXBfcGxhbi92MVwiLFxuXHRhaU1vZGVsTmFtZTogXCJzdGVwLTMuNy1mbGFzaFwiLFxuXHRhaVN1bW1hcnlFbmFibGVkOiB0cnVlLFxuXHRhaVN1bW1hcnlQcm9tcHQ6IERFRkFVTFRfQUlfU1VNTUFSWV9QUk9NUFQsXG5cdGRldmljZUJpbmRpbmdzOiBbXSxcblx0ZW1wdHlGaWVsZEhpZ2hsaWdodDogdHJ1ZSxcblx0Zm9sZGVyRGVmYXVsdHM6IFtdLFxuXHRzaG93Rm9sZGVyQ2hlY2ttYXJrOiBmYWxzZSxcbn07XG5cbmNvbnN0IEFVVEhPUl9PUFRJT05TID0gW1xuXHRcIumZiOaZk+eQplwiLFxuXHRcIuiRo+aBkuaWh1wiLFxuXHRcIuWImOS4gOmUi1wiLFxuXHRcIueOi+S6muWGm1wiLFxuXHRcIuadqOehlVwiLFxuXHRcIuWRqOato+mjnlwiLFxuXHRcIuW6hOmdluWuh1wiLFxuXHRcIuiHquWumuS5iVwiLFxuXSBhcyBjb25zdDtcbmNvbnN0IENVU1RPTV9BVVRIT1JfTU9ERSA9IFwi6Ieq5a6a5LmJXCI7XG5cbmNvbnN0IFJFUVVJUkVEX0ZJRUxEUyA9IFtcIumhueebrlwiLCBcIuexu+Wei1wiLCBcIuS9nOiAhVwiLCBcIuaRmOimgVwiLCBcIuWIm+W7uuaXtumXtFwiLCBcIuacgOWQjuabtOaWsFwiXSBhcyBjb25zdDtcbnR5cGUgUmVxdWlyZWRGaWVsZCA9ICh0eXBlb2YgUkVRVUlSRURfRklFTERTKVtudW1iZXJdO1xuY29uc3QgSElHSExJR0hUX0ZJRUxEUyA9IFtcIumhueebrlwiLCBcIuexu+Wei1wiLCBcIuS9nOiAhVwiLCBcIuWIm+W7uuaXtumXtFwiLCBcIuacgOWQjuabtOaWsFwiXSBhcyBjb25zdDtcbnR5cGUgSGlnaGxpZ2h0RmllbGQgPSAodHlwZW9mIEhJR0hMSUdIVF9GSUVMRFMpW251bWJlcl07XG5jb25zdCBGT0xERVJfREVGQVVMVF9GSUVMRFMgPSBbXCLpobnnm65cIiwgXCLnsbvlnotcIl0gYXMgY29uc3Q7XG50eXBlIEZvbGRlckRlZmF1bHRGaWVsZCA9ICh0eXBlb2YgRk9MREVSX0RFRkFVTFRfRklFTERTKVtudW1iZXJdO1xudHlwZSBGb2xkZXJEZWZhdWx0VmFsdWVzID0gUGFydGlhbDxSZWNvcmQ8Rm9sZGVyRGVmYXVsdEZpZWxkLCBzdHJpbmc+PjtcbmNvbnN0IFNFVFRJTkdfVEFCUyA9IFtcIumAmueUqFwiLCBcIuaWh+S7tuWkueinhOWImVwiLCBcIkFJ5pGY6KaBXCIsIFwi5omr5o+P5LuT5bqTXCIsIFwi6K6+5aSH57uR5a6aXCIsIFwi54mI5pys5pu05pawXCJdIGFzIGNvbnN0O1xudHlwZSBTZXR0aW5nVGFiSWQgPSAodHlwZW9mIFNFVFRJTkdfVEFCUylbbnVtYmVyXTtcbmNvbnN0IEdJVEhVQl9SQVdfQkFTRSA9IFwiaHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL2xpdXlpZmVuZzkyL29ic2lkaWFuLXBsdWdpbnMvbWFpbi9hdXRvLWZyb250bWF0dGVyXCI7XG50eXBlIEFJU3VtbWFyeVRhc2tUeXBlID0gXCJjb21wbGV0aW9uXCI7XG5jb25zdCBMRUdBQ1lfRklFTERfUkVOQU1FUyA9IHtcblx0Y3JlYXRlZDogXCLliJvlu7rml7bpl7RcIixcblx0dXBkYXRlZDogXCLmnIDlkI7mm7TmlrBcIixcbn0gYXMgY29uc3Q7XG50eXBlIExlZ2FjeUZpZWxkID0ga2V5b2YgdHlwZW9mIExFR0FDWV9GSUVMRF9SRU5BTUVTO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBBdXRvRnJvbnRtYXR0ZXJQbHVnaW4gZXh0ZW5kcyBQbHVnaW4ge1xuXHRzZXR0aW5nczogQXV0b0Zyb250bWF0dGVyU2V0dGluZ3M7XG5cdGN1cnJlbnREZXZpY2VVdWlkID0gXCJcIjtcblx0c2V0dGluZ1RhYjogQXV0b0Zyb250bWF0dGVyU2V0dGluZ1RhYiB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIHVwZGF0ZVRpbWVyOiBudW1iZXIgfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSB1cGRhdGVGaWxlUGF0aDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG5cdHByaXZhdGUgY3JlYXRlVGltZXJzID0gbmV3IFNldDxudW1iZXI+KCk7XG5cdHByaXZhdGUgaGlnaGxpZ2h0VGltZXI6IG51bWJlciB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIGhpZ2hsaWdodEludGVydmFsOiBudW1iZXIgfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSBoaWdobGlnaHRGaWxlUGF0aDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG5cdHByaXZhdGUgZm9sZGVyQ2hlY2ttYXJrVGltZXI6IG51bWJlciB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIGFpQnV0dG9uVGltZXI6IG51bWJlciB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIGFpU3VtbWFyeUFib3J0Q29udHJvbGxlcjogQWJvcnRDb250cm9sbGVyIHwgbnVsbCA9IG51bGw7XG5cdHByaXZhdGUgYWlTdW1tYXJ5Q29tcGxldGlvblJ1bm5pbmcgPSBmYWxzZTtcblx0cHJpdmF0ZSBsYXN0QUlTdW1tYXJ5U2NoZWR1bGVTbG90ID0gXCJcIjtcblxuXHRhc3luYyBvbmxvYWQoKSB7XG5cdFx0YXdhaXQgdGhpcy5sb2FkU2V0dGluZ3MoKTtcblxuXHRcdHRoaXMuc2V0dGluZ1RhYiA9IG5ldyBBdXRvRnJvbnRtYXR0ZXJTZXR0aW5nVGFiKHRoaXMuYXBwLCB0aGlzKTtcblx0XHR0aGlzLmFkZFNldHRpbmdUYWIodGhpcy5zZXR0aW5nVGFiKTtcblxuXHRcdHRoaXMucmVnaXN0ZXJFdmVudChcblx0XHRcdHRoaXMuYXBwLnZhdWx0Lm9uKFwiY3JlYXRlXCIsIChmaWxlKSA9PiB7XG5cdFx0XHRcdHRoaXMuaGFuZGxlQ3JlYXRlKGZpbGUpO1xuXHRcdFx0fSksXG5cdFx0KTtcblxuXHRcdHRoaXMucmVnaXN0ZXJFdmVudChcblx0XHRcdHRoaXMuYXBwLnZhdWx0Lm9uKFwicmVuYW1lXCIsIChmaWxlLCBvbGRQYXRoKSA9PiB7XG5cdFx0XHRcdHRoaXMuaGFuZGxlUmVuYW1lKGZpbGUsIG9sZFBhdGgpO1xuXHRcdFx0fSksXG5cdFx0KTtcblxuXHRcdHRoaXMucmVnaXN0ZXJFdmVudChcblx0XHRcdHRoaXMuYXBwLndvcmtzcGFjZS5vbihcImZpbGUtbWVudVwiLCAobWVudTogTWVudSwgZmlsZTogVEFic3RyYWN0RmlsZSkgPT4ge1xuXHRcdFx0XHR0aGlzLmhhbmRsZUZpbGVNZW51KG1lbnUsIGZpbGUpO1xuXHRcdFx0fSksXG5cdFx0KTtcblxuXHRcdHRoaXMucmVnaXN0ZXJFdmVudChcblx0XHRcdHRoaXMuYXBwLndvcmtzcGFjZS5vbihcImVkaXRvci1jaGFuZ2VcIiwgKF9lZGl0b3I6IEVkaXRvciwgdmlldzogTWFya2Rvd25WaWV3KSA9PiB7XG5cdFx0XHRcdHRoaXMuc2NoZWR1bGVVcGRhdGVkRmllbGRSZWZyZXNoKHZpZXcuZmlsZSk7XG5cdFx0XHR9KSxcblx0XHQpO1xuXG5cdFx0dGhpcy5yZWdpc3RlckV2ZW50KFxuXHRcdFx0dGhpcy5hcHAud29ya3NwYWNlLm9uKFwiYWN0aXZlLWxlYWYtY2hhbmdlXCIsICgpID0+IHtcblx0XHRcdFx0dGhpcy5zY2hlZHVsZUVtcHR5RmllbGRIaWdobGlnaHRDaGVjaygpO1xuXHRcdFx0XHR0aGlzLnNjaGVkdWxlQUlTdW1tYXJ5QnV0dG9uUmVmcmVzaCgpO1xuXHRcdFx0fSksXG5cdFx0KTtcblxuXHRcdHRoaXMucmVnaXN0ZXJFdmVudChcblx0XHRcdHRoaXMuYXBwLndvcmtzcGFjZS5vbihcImxheW91dC1jaGFuZ2VcIiwgKCkgPT4ge1xuXHRcdFx0XHR0aGlzLnNjaGVkdWxlRW1wdHlGaWVsZEhpZ2hsaWdodENoZWNrKCk7XG5cdFx0XHRcdHRoaXMuc2NoZWR1bGVBSVN1bW1hcnlCdXR0b25SZWZyZXNoKCk7XG5cdFx0XHRcdHRoaXMuc2NoZWR1bGVGb2xkZXJDaGVja21hcmtSZWZyZXNoKCk7XG5cdFx0XHR9KSxcblx0XHQpO1xuXG5cdFx0dGhpcy5yZWdpc3RlckludGVydmFsKHdpbmRvdy5zZXRJbnRlcnZhbCgoKSA9PiB7XG5cdFx0XHR0aGlzLmNoZWNrQUlTdW1tYXJ5U2NoZWR1bGUoKTtcblx0XHR9LCBBSV9TVU1NQVJZX1NDSEVEVUxFUl9DSEVDS19NUykpO1xuXG5cdFx0dGhpcy5zY2hlZHVsZUVtcHR5RmllbGRIaWdobGlnaHRDaGVjaygpO1xuXHRcdHRoaXMuc2NoZWR1bGVBSVN1bW1hcnlCdXR0b25SZWZyZXNoKCk7XG5cdFx0dGhpcy5zY2hlZHVsZUZvbGRlckNoZWNrbWFya1JlZnJlc2goKTtcblx0fVxuXG5cdG9udW5sb2FkKCkge1xuXHRcdHRoaXMuY2xlYXJVcGRhdGVUaW1lcigpO1xuXHRcdHRoaXMuY2xlYXJIaWdobGlnaHRUaW1lcnMoKTtcblx0XHR0aGlzLmNsZWFyRW1wdHlGaWVsZEhpZ2hsaWdodHMoKTtcblx0XHR0aGlzLmNsZWFyQUlTdW1tYXJ5QnV0dG9uVGltZXIoKTtcblx0XHR0aGlzLmNsZWFyQUlTdW1tYXJ5QnV0dG9ucygpO1xuXHRcdHRoaXMuYWJvcnRBSVN1bW1hcnlTdHJlYW0oKTtcblx0XHR0aGlzLmNsZWFyRm9sZGVyQ2hlY2ttYXJrVGltZXIoKTtcblx0XHR0aGlzLmNsZWFyRm9sZGVyQ2hlY2ttYXJrcygpO1xuXHRcdGZvciAoY29uc3QgdGltZXIgb2YgdGhpcy5jcmVhdGVUaW1lcnMpIHtcblx0XHRcdHdpbmRvdy5jbGVhclRpbWVvdXQodGltZXIpO1xuXHRcdH1cblx0XHR0aGlzLmNyZWF0ZVRpbWVycy5jbGVhcigpO1xuXHR9XG5cblx0YXN5bmMgbG9hZFNldHRpbmdzKCkge1xuXHRcdHRoaXMuY3VycmVudERldmljZVV1aWQgPSBnZXREZXZpY2VVdWlkKCk7XG5cdFx0dGhpcy5zZXR0aW5ncyA9IE9iamVjdC5hc3NpZ24oe30sIERFRkFVTFRfU0VUVElOR1MsIGF3YWl0IHRoaXMubG9hZERhdGEoKSk7XG5cdFx0dGhpcy5taWdyYXRlQXV0aG9yU2V0dGluZ3MoKTtcblx0XHR0aGlzLmVuc3VyZUN1cnJlbnREZXZpY2VCaW5kaW5nKCk7XG5cdFx0dGhpcy5taWdyYXRlRm9sZGVyRGVmYXVsdFJ1bGVzKCk7XG5cdFx0dGhpcy5taWdyYXRlQUlTdW1tYXJ5UHJvbXB0KCk7XG5cdH1cblxuXHRhc3luYyBzYXZlU2V0dGluZ3MoKSB7XG5cdFx0YXdhaXQgdGhpcy5zYXZlRGF0YSh0aGlzLnNldHRpbmdzKTtcblx0XHR0aGlzLnNjaGVkdWxlRm9sZGVyQ2hlY2ttYXJrUmVmcmVzaCgpO1xuXHR9XG5cblx0cmVmcmVzaFNldHRpbmdzVGFiKCkge1xuXHRcdHRoaXMuc2V0dGluZ1RhYj8uZGlzcGxheSgpO1xuXHR9XG5cblx0cmVmcmVzaEVtcHR5RmllbGRIaWdobGlnaHRzKCkge1xuXHRcdHRoaXMuc2NoZWR1bGVFbXB0eUZpZWxkSGlnaGxpZ2h0Q2hlY2soKTtcblx0fVxuXG5cdHJlZnJlc2hGb2xkZXJDaGVja21hcmtzKCkge1xuXHRcdHRoaXMuYXBwbHlGb2xkZXJDaGVja21hcmtzKCk7XG5cdH1cblxuXHRhc3luYyBnZW5lcmF0ZVN1bW1hcnlGb3JGaWxlKGZpbGU6IFRGaWxlKSB7XG5cdFx0aWYgKCF0aGlzLnNldHRpbmdzLmFpU3VtbWFyeUVuYWJsZWQgfHwgIXRoaXMuc2V0dGluZ3MuYWlBcGlLZXkudHJpbSgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGNvbnRlbnQgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5yZWFkKGZpbGUpO1xuXHRcdFx0Y29uc3Qgc3VtbWFyeURvY3VtZW50ID0gZ2V0U3VtbWFyeURvY3VtZW50KGZpbGUsIGNvbnRlbnQsIDEpO1xuXHRcdFx0aWYgKCFzdW1tYXJ5RG9jdW1lbnQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBzdW1tYXJ5ID0gYXdhaXQgbmV3IEFJU3VtbWFyeVNlcnZpY2UodGhpcy5zZXR0aW5ncykuZ2VuZXJhdGVTdW1tYXJ5KHN1bW1hcnlEb2N1bWVudCk7XG5cdFx0XHRpZiAoIXN1bW1hcnkpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBuZXh0ID0gd3JpdGVTdW1tYXJ5VG9Db250ZW50KFxuXHRcdFx0XHRjb250ZW50LFxuXHRcdFx0XHRmaWxlLFxuXHRcdFx0XHRzdW1tYXJ5LFxuXHRcdFx0XHR0aGlzLmdldEZvbGRlckRlZmF1bHRWYWx1ZXMoZmlsZSksXG5cdFx0XHRcdHRoaXMuYnVpbGRGcm9udG1hdHRlci5iaW5kKHRoaXMpLFxuXHRcdFx0KTtcblx0XHRcdGlmIChuZXh0ICE9PSBudWxsKSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuYXBwLnZhdWx0Lm1vZGlmeShmaWxlLCBuZXh0KTtcblx0XHRcdFx0dGhpcy50cmlnZ2VyTWV0YWRhdGFDaGFuZ2VkKGZpbGUpO1xuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRuZXcgTm90aWNlKGBBSSDmkZjopoHnlJ/miJDlpLHotKXvvJoke2dldEVycm9yTWVzc2FnZShlcnJvcil9YCk7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgZ2VuZXJhdGVTdW1tYXJ5Rm9yTWV0YWRhdGFCdXR0b24oXG5cdFx0ZmlsZTogVEZpbGUsXG5cdFx0b25EZWx0YTogKGRlbHRhOiBzdHJpbmcpID0+IHZvaWQsXG5cdFx0c2lnbmFsOiBBYm9ydFNpZ25hbCxcblx0KTogUHJvbWlzZTxzdHJpbmc+IHtcblx0XHRpZiAoIXRoaXMuc2V0dGluZ3MuYWlTdW1tYXJ5RW5hYmxlZCkge1xuXHRcdFx0bmV3IE5vdGljZShcIuivt+WFiOW8gOWQryBBSSDoh6rliqjmkZjopoFcIik7XG5cdFx0XHRyZXR1cm4gXCJcIjtcblx0XHR9XG5cdFx0aWYgKCF0aGlzLnNldHRpbmdzLmFpQXBpS2V5LnRyaW0oKSkge1xuXHRcdFx0bmV3IE5vdGljZShcIuivt+WFiOWhq+WGmSBBSSDmkZjopoEgQVBJIEtleVwiKTtcblx0XHRcdHJldHVybiBcIlwiO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNvbnRlbnQgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5yZWFkKGZpbGUpO1xuXHRcdGNvbnN0IHN1bW1hcnlEb2N1bWVudCA9IGdldFN1bW1hcnlEb2N1bWVudChmaWxlLCBjb250ZW50LCAxKTtcblx0XHRpZiAoIXN1bW1hcnlEb2N1bWVudCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwi5paH5qGj5YaF5a655Li656m677yM5peg5rOV55Sf5oiQ5pGY6KaBXCIpO1xuXHRcdH1cblxuXHRcdGxldCBzdW1tYXJ5ID0gXCJcIjtcblx0XHR0cnkge1xuXHRcdFx0c3VtbWFyeSA9IGF3YWl0IG5ldyBBSVN1bW1hcnlTZXJ2aWNlKHRoaXMuc2V0dGluZ3MpLmdlbmVyYXRlU3VtbWFyeShzdW1tYXJ5RG9jdW1lbnQpO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRpZiAoc2lnbmFsLmFib3J0ZWQpIHtcblx0XHRcdFx0cmV0dXJuIFwiXCI7XG5cdFx0XHR9XG5cdFx0XHR0aHJvdyBlcnJvcjtcblx0XHR9XG5cdFx0aWYgKCFzdW1tYXJ5KSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJBSSDmkZjopoHov5Tlm57kuLrnqbpcIik7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbmV4dCA9IHdyaXRlU3VtbWFyeVRvQ29udGVudChcblx0XHRcdGNvbnRlbnQsXG5cdFx0XHRmaWxlLFxuXHRcdFx0c3VtbWFyeSxcblx0XHRcdHRoaXMuZ2V0Rm9sZGVyRGVmYXVsdFZhbHVlcyhmaWxlKSxcblx0XHRcdHRoaXMuYnVpbGRGcm9udG1hdHRlci5iaW5kKHRoaXMpLFxuXHRcdCk7XG5cdFx0aWYgKG5leHQgIT09IG51bGwpIHtcblx0XHRcdGF3YWl0IHRoaXMuYXBwLnZhdWx0Lm1vZGlmeShmaWxlLCBuZXh0KTtcblx0XHR9XG5cdFx0cmV0dXJuIHN1bW1hcnk7XG5cdH1cblxuXHRhc3luYyBzY2FuQUlTdW1tYXJ5Q2FuZGlkYXRlcyh0YXNrOiBBSVN1bW1hcnlUYXNrVHlwZSwgc2hvd05vdGljZTogYm9vbGVhbik6IFByb21pc2U8QUlTdW1tYXJ5Q2FuZGlkYXRlW10+IHtcblx0XHRjb25zdCBhdXRob3IgPSB0aGlzLmdldEFJU3VtbWFyeUF1dGhvckZvclRhc2soc2hvd05vdGljZSk7XG5cdFx0aWYgKCFhdXRob3IpIHtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cblx0XHRyZXR1cm4gYXdhaXQgdGhpcy5nZXRBSVN1bW1hcnlDb21wbGV0aW9uQ2FuZGlkYXRlcyhhdXRob3IpO1xuXHR9XG5cblx0YXN5bmMgZXhlY3V0ZUFJU3VtbWFyeVF1ZXVlKFxuXHRcdHRhc2s6IEFJU3VtbWFyeVRhc2tUeXBlLFxuXHRcdGNhbmRpZGF0ZXM6IEFJU3VtbWFyeUNhbmRpZGF0ZVtdLFxuXHRcdHNob3dOb3RpY2U6IGJvb2xlYW4sXG5cdFx0b25Qcm9ncmVzcz86ICgpID0+IHZvaWQsXG5cdCk6IFByb21pc2U8bnVtYmVyPiB7XG5cdFx0aWYgKHRoaXMuaXNBSVN1bW1hcnlUYXNrUnVubmluZyh0YXNrKSkge1xuXHRcdFx0aWYgKHNob3dOb3RpY2UpIHtcblx0XHRcdFx0bmV3IE5vdGljZShcIkFJIOaRmOimgeato+WcqOaJp+ihjOS4rVwiKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiAwO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy5nZXRBSVN1bW1hcnlBdXRob3JGb3JUYXNrKHNob3dOb3RpY2UpKSB7XG5cdFx0XHRyZXR1cm4gMDtcblx0XHR9XG5cblx0XHRyZXR1cm4gYXdhaXQgdGhpcy5wcm9jZXNzQUlTdW1tYXJ5UXVldWUodGFzaywgY2FuZGlkYXRlcywgc2hvd05vdGljZSwgb25Qcm9ncmVzcyk7XG5cdH1cblxuXHRpc0FJU3VtbWFyeVRhc2tSdW5uaW5nKHRhc2s6IEFJU3VtbWFyeVRhc2tUeXBlKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuYWlTdW1tYXJ5Q29tcGxldGlvblJ1bm5pbmc7XG5cdH1cblxuXHRwcml2YXRlIGNoZWNrQUlTdW1tYXJ5U2NoZWR1bGUoKSB7XG5cdFx0Y29uc3Qgbm93ID0gbmV3IERhdGUoKTtcblx0XHRjb25zdCBtaW51dGUgPSBub3cuZ2V0TWludXRlcygpO1xuXHRcdGlmIChtaW51dGUgIT09IDAgJiYgbWludXRlICE9PSAzMCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHNsb3QgPSBgJHtub3cuZ2V0RnVsbFllYXIoKX0tJHtub3cuZ2V0TW9udGgoKX0tJHtub3cuZ2V0RGF0ZSgpfS0ke25vdy5nZXRIb3VycygpfS0ke21pbnV0ZX1gO1xuXHRcdGlmIChzbG90ID09PSB0aGlzLmxhc3RBSVN1bW1hcnlTY2hlZHVsZVNsb3QpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLmxhc3RBSVN1bW1hcnlTY2hlZHVsZVNsb3QgPSBzbG90O1xuXHRcdHZvaWQgdGhpcy5ydW5TY2hlZHVsZWRBSVN1bW1hcnlUYXNrcygpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBydW5TY2hlZHVsZWRBSVN1bW1hcnlUYXNrcygpIHtcblx0XHRhd2FpdCB0aGlzLnJ1blNjaGVkdWxlZEFJU3VtbWFyeVRhc2soXCJjb21wbGV0aW9uXCIpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBydW5TY2hlZHVsZWRBSVN1bW1hcnlUYXNrKHRhc2s6IEFJU3VtbWFyeVRhc2tUeXBlKSB7XG5cdFx0aWYgKHRoaXMuaXNBSVN1bW1hcnlUYXNrUnVubmluZyh0YXNrKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNhbmRpZGF0ZXMgPSBhd2FpdCB0aGlzLnNjYW5BSVN1bW1hcnlDYW5kaWRhdGVzKHRhc2ssIGZhbHNlKTtcblx0XHRpZiAoY2FuZGlkYXRlcy5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRhd2FpdCB0aGlzLnByb2Nlc3NBSVN1bW1hcnlRdWV1ZSh0YXNrLCBjYW5kaWRhdGVzLCBmYWxzZSk7XG5cdH1cblxuXHRwcml2YXRlIGdldEFJU3VtbWFyeUF1dGhvckZvclRhc2soc2hvd05vdGljZTogYm9vbGVhbik6IHN0cmluZyB7XG5cdFx0aWYgKCF0aGlzLnNldHRpbmdzLmFpU3VtbWFyeUVuYWJsZWQpIHtcblx0XHRcdGlmIChzaG93Tm90aWNlKSB7XG5cdFx0XHRcdG5ldyBOb3RpY2UoXCLor7flhYjlvIDlkK8gQUkg6Ieq5Yqo5pGY6KaBXCIpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIFwiXCI7XG5cdFx0fVxuXHRcdGlmICghdGhpcy5zZXR0aW5ncy5haUFwaUtleS50cmltKCkpIHtcblx0XHRcdGlmIChzaG93Tm90aWNlKSB7XG5cdFx0XHRcdG5ldyBOb3RpY2UoXCLor7flhYjloavlhpkgQUkg5pGY6KaBIEFQSSBLZXlcIik7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gXCJcIjtcblx0XHR9XG5cblx0XHRjb25zdCBhdXRob3IgPSB0aGlzLmdldEN1cnJlbnRBdXRob3JOYW1lKCk7XG5cdFx0aWYgKCFhdXRob3IpIHtcblx0XHRcdGlmIChzaG93Tm90aWNlKSB7XG5cdFx0XHRcdG5ldyBOb3RpY2UoXCLor7flhYjlnKjjgIzorr7lpIfnu5HlrprjgI3kuK3nu5HlrprmnKzmnLrorr7lpIdcIik7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gXCJcIjtcblx0XHR9XG5cblx0XHRyZXR1cm4gYXV0aG9yO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBwcm9jZXNzQUlTdW1tYXJ5UXVldWUoXG5cdFx0dGFzazogQUlTdW1tYXJ5VGFza1R5cGUsXG5cdFx0Y2FuZGlkYXRlczogQUlTdW1tYXJ5Q2FuZGlkYXRlW10sXG5cdFx0c2hvd05vdGljZTogYm9vbGVhbixcblx0XHRvblByb2dyZXNzPzogKCkgPT4gdm9pZCxcblx0KTogUHJvbWlzZTxudW1iZXI+IHtcblx0XHR0aGlzLnNldEFJU3VtbWFyeVRhc2tSdW5uaW5nKHRhc2ssIHRydWUpO1xuXHRcdGxldCBwcm9jZXNzZWRDb3VudCA9IDA7XG5cdFx0bGV0IGNvbnNlY3V0aXZlRmFpbHVyZXMgPSAwO1xuXG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHNlcnZpY2UgPSBuZXcgQUlTdW1tYXJ5U2VydmljZSh0aGlzLnNldHRpbmdzKTtcblx0XHRcdGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCBjYW5kaWRhdGVzLmxlbmd0aDsgaW5kZXgrKykge1xuXHRcdFx0XHRjb25zdCBjYW5kaWRhdGUgPSBjYW5kaWRhdGVzW2luZGV4XTtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRjb25zdCBzdW1tYXJ5ID0gYXdhaXQgc2VydmljZS5nZW5lcmF0ZVN1bW1hcnkoY2FuZGlkYXRlLmRvY3VtZW50KTtcblx0XHRcdFx0XHRpZiAoIXN1bW1hcnkpIHtcblx0XHRcdFx0XHRcdGlmIChpbmRleCA8IGNhbmRpZGF0ZXMubGVuZ3RoIC0gMSkge1xuXHRcdFx0XHRcdFx0XHRhd2FpdCBkZWxheShBSV9TVU1NQVJZX1JFUVVFU1RfREVMQVlfTVMpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Y29uc3QgbmV4dCA9IHdyaXRlU3VtbWFyeVRvQ29udGVudChcblx0XHRcdFx0XHRcdGNhbmRpZGF0ZS5jb250ZW50LFxuXHRcdFx0XHRcdFx0Y2FuZGlkYXRlLmZpbGUsXG5cdFx0XHRcdFx0XHRzdW1tYXJ5LFxuXHRcdFx0XHRcdFx0dGhpcy5nZXRGb2xkZXJEZWZhdWx0VmFsdWVzKGNhbmRpZGF0ZS5maWxlKSxcblx0XHRcdFx0XHRcdHRoaXMuYnVpbGRGcm9udG1hdHRlci5iaW5kKHRoaXMpLFxuXHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0aWYgKG5leHQgIT09IG51bGwpIHtcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMuYXBwLnZhdWx0Lm1vZGlmeShjYW5kaWRhdGUuZmlsZSwgbmV4dCk7XG5cdFx0XHRcdFx0XHR0aGlzLnRyaWdnZXJNZXRhZGF0YUNoYW5nZWQoY2FuZGlkYXRlLmZpbGUpO1xuXHRcdFx0XHRcdFx0cHJvY2Vzc2VkQ291bnQrKztcblx0XHRcdFx0XHRcdGNhbmRpZGF0ZS5kb25lID0gdHJ1ZTtcblx0XHRcdFx0XHRcdG9uUHJvZ3Jlc3M/LigpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRjb25zZWN1dGl2ZUZhaWx1cmVzID0gMDtcblx0XHRcdFx0fSBjYXRjaCAoX2Vycm9yKSB7XG5cdFx0XHRcdFx0Y29uc2VjdXRpdmVGYWlsdXJlcysrO1xuXHRcdFx0XHRcdGlmIChjb25zZWN1dGl2ZUZhaWx1cmVzID49IDMpIHtcblx0XHRcdFx0XHRcdG5ldyBOb3RpY2UoXCJBSSDmkZjopoHmnI3liqHlvILluLjvvIzlt7LmmoLlgZzmnKzmrKHku7vliqFcIik7XG5cdFx0XHRcdFx0XHRyZXR1cm4gcHJvY2Vzc2VkQ291bnQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGluZGV4IDwgY2FuZGlkYXRlcy5sZW5ndGggLSAxKSB7XG5cdFx0XHRcdFx0YXdhaXQgZGVsYXkoQUlfU1VNTUFSWV9SRVFVRVNUX0RFTEFZX01TKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAoc2hvd05vdGljZSkge1xuXHRcdFx0XHRuZXcgTm90aWNlKFxuXHRcdFx0XHRcdHByb2Nlc3NlZENvdW50ID4gMFxuXHRcdFx0XHRcdFx0PyBgQUkg5pGY6KaB77ya5pys5qyh5aSE55CGICR7cHJvY2Vzc2VkQ291bnR9IOevh+aWh+aho2Bcblx0XHRcdFx0XHRcdDogXCJBSSDmkZjopoHvvJrmmoLml6DpnIDopoHlpITnkIbnmoTmlofmoaNcIixcblx0XHRcdFx0KTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHByb2Nlc3NlZENvdW50O1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHR0aGlzLnNldEFJU3VtbWFyeVRhc2tSdW5uaW5nKHRhc2ssIGZhbHNlKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHNldEFJU3VtbWFyeVRhc2tSdW5uaW5nKHRhc2s6IEFJU3VtbWFyeVRhc2tUeXBlLCBpc1J1bm5pbmc6IGJvb2xlYW4pIHtcblx0XHR0aGlzLmFpU3VtbWFyeUNvbXBsZXRpb25SdW5uaW5nID0gaXNSdW5uaW5nO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBnZXRBSVN1bW1hcnlDb21wbGV0aW9uQ2FuZGlkYXRlcyhhdXRob3I6IHN0cmluZyk6IFByb21pc2U8QUlTdW1tYXJ5Q2FuZGlkYXRlW10+IHtcblx0XHRjb25zdCBjYW5kaWRhdGVzOiBBSVN1bW1hcnlDYW5kaWRhdGVbXSA9IFtdO1xuXHRcdGNvbnN0IGZpbGVzID0gdGhpcy5hcHAudmF1bHQuZ2V0TWFya2Rvd25GaWxlcygpO1xuXG5cdFx0Zm9yIChjb25zdCBmaWxlIG9mIGZpbGVzKSB7XG5cdFx0XHRjb25zdCBmcm9udG1hdHRlciA9IHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKGZpbGUpPy5mcm9udG1hdHRlciA/PyB7fTtcblx0XHRcdGlmICghZnJvbnRtYXR0ZXJBdXRob3JDb250YWlucyhmcm9udG1hdHRlcltcIuS9nOiAhVwiXSwgYXV0aG9yKSB8fCAhaXNFbXB0eUZyb250bWF0dGVyVmFsdWUoZnJvbnRtYXR0ZXJbXCLmkZjopoFcIl0pKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQuY2FjaGVkUmVhZChmaWxlKTtcblx0XHRcdGNvbnN0IGRvY3VtZW50ID0gZ2V0U3VtbWFyeURvY3VtZW50KGZpbGUsIGNvbnRlbnQsIE1JTl9TVU1NQVJZX0JPRFlfTEVOR1RIKTtcblx0XHRcdGlmICghZG9jdW1lbnQpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGNhbmRpZGF0ZXMucHVzaCh7IGZpbGUsIGNvbnRlbnQsIGRvY3VtZW50IH0pO1xuXHRcdH1cblxuXHRcdHJldHVybiBjYW5kaWRhdGVzO1xuXHR9XG5cblx0cHJpdmF0ZSB0cmlnZ2VyTWV0YWRhdGFDaGFuZ2VkKGZpbGU6IFRGaWxlKSB7XG5cdFx0KHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUgYXMgeyB0cmlnZ2VyOiAobmFtZTogc3RyaW5nLCBmaWxlOiBURmlsZSkgPT4gdm9pZCB9KS50cmlnZ2VyKFwiY2hhbmdlZFwiLCBmaWxlKTtcblx0fVxuXG5cdGdldEF1dGhvck5hbWUoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5zZXR0aW5ncy5kZXZpY2VCaW5kaW5ncy5maW5kKChiaW5kaW5nKSA9PiBiaW5kaW5nLnV1aWQgPT09IHRoaXMuY3VycmVudERldmljZVV1aWQpPy5hdXRob3IgPz8gXCJcIjtcblx0fVxuXG5cdGVuc3VyZURldmljZUJvdW5kKCk6IGJvb2xlYW4ge1xuXHRcdGlmICh0aGlzLmdldEN1cnJlbnRBdXRob3JOYW1lKCkpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdG5ldyBOb3RpY2UoXCLor7flhYjlnKjjgIzorr7lpIfnu5HlrprjgI3kuK3nu5HlrprmnKzmnLrorr7lpIdcIik7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0Z2V0Q3VycmVudEF1dGhvck5hbWUoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5zZXR0aW5ncy5kZXZpY2VCaW5kaW5ncy5maW5kKChiaW5kaW5nKSA9PiB7XG5cdFx0XHRyZXR1cm4gYmluZGluZy51dWlkID09PSB0aGlzLmN1cnJlbnREZXZpY2VVdWlkICYmIGJpbmRpbmcuYXV0aG9yO1xuXHRcdH0pPy5hdXRob3IgPz8gXCJcIjtcblx0fVxuXG5cdGJ1aWxkRnJvbnRtYXR0ZXIoY3JlYXRlZDogc3RyaW5nLCBkZWZhdWx0czogRm9sZGVyRGVmYXVsdFZhbHVlcyA9IHt9KTogc3RyaW5nIHtcblx0XHRyZXR1cm4gW1xuXHRcdFx0XCItLS1cIixcblx0XHRcdGDpobnnm646ICR7ZGVmYXVsdHNbXCLpobnnm65cIl0gPz8gXCJcIn1gLFxuXHRcdFx0XCLnsbvlnos6XCIsXG5cdFx0XHRgICAtICR7Zm9ybWF0WWFtbFNjYWxhcihkZWZhdWx0c1tcIuexu+Wei1wiXSA/PyBcIlwiKX1gLFxuXHRcdFx0XCLkvZzogIU6XCIsXG5cdFx0XHRgICAtICR7Zm9ybWF0WWFtbFNjYWxhcih0aGlzLmdldEF1dGhvck5hbWUoKSl9YCxcblx0XHRcdFwi5pGY6KaBOiBcIixcblx0XHRcdGDliJvlu7rml7bpl7Q6ICR7Y3JlYXRlZH1gLFxuXHRcdFx0YOacgOWQjuabtOaWsDogJHtjcmVhdGVkfWAsXG5cdFx0XHRcIi0tLVwiLFxuXHRcdFx0XCJcIixcblx0XHRdLmpvaW4oXCJcXG5cIik7XG5cdH1cblxuXHRwcml2YXRlIGhhbmRsZUNyZWF0ZShmaWxlOiBUQWJzdHJhY3RGaWxlKSB7XG5cdFx0aWYgKCEoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSB8fCBmaWxlLmV4dGVuc2lvbiAhPT0gXCJtZFwiKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgdGltZXIgPSB3aW5kb3cuc2V0VGltZW91dChhc3luYyAoKSA9PiB7XG5cdFx0XHR0aGlzLmNyZWF0ZVRpbWVycy5kZWxldGUodGltZXIpO1xuXG5cdFx0XHRjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZChmaWxlKTtcblx0XHRcdGlmIChjb250ZW50LnRyaW0oKS5sZW5ndGggPiAwIHx8IGhhc0Zyb250bWF0dGVyKGNvbnRlbnQpKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgY3JlYXRlZCA9IGZvcm1hdExvY2FsRGF0ZShuZXcgRGF0ZShmaWxlLnN0YXQuY3RpbWUpKTtcblx0XHRcdGF3YWl0IHRoaXMuYXBwLnZhdWx0Lm1vZGlmeShmaWxlLCB0aGlzLmJ1aWxkRnJvbnRtYXR0ZXIoY3JlYXRlZCwgdGhpcy5nZXRGb2xkZXJEZWZhdWx0VmFsdWVzKGZpbGUpKSk7XG5cdFx0fSwgMjUwKTtcblxuXHRcdHRoaXMuY3JlYXRlVGltZXJzLmFkZCh0aW1lcik7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGhhbmRsZVJlbmFtZShmaWxlOiBUQWJzdHJhY3RGaWxlLCBvbGRQYXRoOiBzdHJpbmcpIHtcblx0XHRpZiAoIShmaWxlIGluc3RhbmNlb2YgVEZpbGUpIHx8IGZpbGUuZXh0ZW5zaW9uICE9PSBcIm1kXCIpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoZ2V0RmlsZUZvbGRlcihmaWxlLnBhdGgpID09PSBnZXRGaWxlRm9sZGVyKG9sZFBhdGgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgZGVmYXVsdHMgPSB0aGlzLmdldEZvbGRlckRlZmF1bHRWYWx1ZXMoZmlsZSk7XG5cdFx0aWYgKE9iamVjdC5rZXlzKGRlZmF1bHRzKS5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRhd2FpdCB0aGlzLmFwcC52YXVsdC5wcm9jZXNzKGZpbGUsIChjb250ZW50KSA9PiB7XG5cdFx0XHRjb25zdCBuZXh0ID0gZmlsbEVtcHR5Rm9sZGVyRGVmYXVsdHMoY29udGVudCwgZGVmYXVsdHMpO1xuXHRcdFx0cmV0dXJuIG5leHQgPz8gY29udGVudDtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgaGFuZGxlRmlsZU1lbnUobWVudTogTWVudSwgZmlsZTogVEFic3RyYWN0RmlsZSkge1xuXHRcdGlmICghKGZpbGUgaW5zdGFuY2VvZiBURm9sZGVyKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdG1lbnUuYWRkSXRlbSgoaXRlbSkgPT4ge1xuXHRcdFx0aXRlbS5zZXRUaXRsZShcIuiuvue9ruWxnuaAp+WMuemFjeinhOWImVwiKS5vbkNsaWNrKCgpID0+IHtcblx0XHRcdFx0bmV3IEZvbGRlclJ1bGVNb2RhbCh0aGlzLmFwcCwgdGhpcywgZmlsZS5wYXRoKS5vcGVuKCk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fVxuXG5cdGdldEZvbGRlckRlZmF1bHRWYWx1ZXMoZmlsZTogVEZpbGUpOiBGb2xkZXJEZWZhdWx0VmFsdWVzIHtcblx0XHRjb25zdCB2YWx1ZXM6IEZvbGRlckRlZmF1bHRWYWx1ZXMgPSB7fTtcblx0XHRjb25zdCBkZXB0aHM6IFBhcnRpYWw8UmVjb3JkPEZvbGRlckRlZmF1bHRGaWVsZCwgbnVtYmVyPj4gPSB7fTtcblx0XHRjb25zdCBmaWxlRm9sZGVyID0gZ2V0RmlsZUZvbGRlcihmaWxlLnBhdGgpO1xuXG5cdFx0Zm9yIChjb25zdCBydWxlIG9mIHRoaXMuc2V0dGluZ3MuZm9sZGVyRGVmYXVsdHMpIHtcblx0XHRcdGlmICghcnVsZS52YWx1ZSB8fCAhZm9sZGVyTWF0Y2hlcyhmaWxlRm9sZGVyLCBydWxlLmZvbGRlcikpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGRlcHRoID0gZ2V0Rm9sZGVyRGVwdGgocnVsZS5mb2xkZXIpO1xuXHRcdFx0aWYgKGRlcHRoID49IChkZXB0aHNbcnVsZS5maWVsZF0gPz8gLTEpKSB7XG5cdFx0XHRcdHZhbHVlc1tydWxlLmZpZWxkXSA9IHJ1bGUudmFsdWU7XG5cdFx0XHRcdGRlcHRoc1tydWxlLmZpZWxkXSA9IGRlcHRoO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB2YWx1ZXM7XG5cdH1cblxuXHRjcmVhdGVGb2xkZXJSdWxlKGZvbGRlciA9IFwiXCIsIGZpZWxkOiBGb2xkZXJEZWZhdWx0RmllbGQgPSBcIumhueebrlwiLCB2YWx1ZSA9IFwiXCIpOiBGb2xkZXJEZWZhdWx0UnVsZSB7XG5cdFx0Y29uc3Qgbm93ID0gZm9ybWF0TG9jYWxEYXRlKG5ldyBEYXRlKCkpO1xuXHRcdGNvbnN0IGF1dGhvciA9IHRoaXMuZ2V0Q3VycmVudEF1dGhvck5hbWUoKTtcblx0XHRyZXR1cm4ge1xuXHRcdFx0Zm9sZGVyLFxuXHRcdFx0ZmllbGQsXG5cdFx0XHR2YWx1ZSxcblx0XHRcdGNyZWF0ZWRCeTogYXV0aG9yLFxuXHRcdFx0Y3JlYXRlZEF0OiBub3csXG5cdFx0XHRtb2RpZmllZEJ5OiBhdXRob3IsXG5cdFx0XHRtb2RpZmllZEF0OiBub3csXG5cdFx0fTtcblx0fVxuXG5cdHRvdWNoRm9sZGVyUnVsZShydWxlOiBGb2xkZXJEZWZhdWx0UnVsZSkge1xuXHRcdHJ1bGUubW9kaWZpZWRCeSA9IHRoaXMuZ2V0Q3VycmVudEF1dGhvck5hbWUoKTtcblx0XHRydWxlLm1vZGlmaWVkQXQgPSBmb3JtYXRMb2NhbERhdGUobmV3IERhdGUoKSk7XG5cdH1cblxuXHRhc3luYyB1cHNlcnRGb2xkZXJSdWxlKGZvbGRlcjogc3RyaW5nLCBmaWVsZDogRm9sZGVyRGVmYXVsdEZpZWxkLCB2YWx1ZTogc3RyaW5nKSB7XG5cdFx0Y29uc3QgZXhpc3RpbmcgPSB0aGlzLnNldHRpbmdzLmZvbGRlckRlZmF1bHRzLmZpbmQoKHJ1bGUpID0+IHtcblx0XHRcdHJldHVybiBydWxlLmZvbGRlciA9PT0gZm9sZGVyICYmIHJ1bGUuZmllbGQgPT09IGZpZWxkO1xuXHRcdH0pO1xuXG5cdFx0aWYgKGV4aXN0aW5nKSB7XG5cdFx0XHRleGlzdGluZy52YWx1ZSA9IHZhbHVlO1xuXHRcdFx0dGhpcy50b3VjaEZvbGRlclJ1bGUoZXhpc3RpbmcpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnNldHRpbmdzLmZvbGRlckRlZmF1bHRzLnB1c2godGhpcy5jcmVhdGVGb2xkZXJSdWxlKGZvbGRlciwgZmllbGQsIHZhbHVlKSk7XG5cdFx0fVxuXG5cdFx0YXdhaXQgdGhpcy5zYXZlU2V0dGluZ3MoKTtcblx0fVxuXG5cdHByaXZhdGUgbWlncmF0ZUF1dGhvclNldHRpbmdzKCkge1xuXHRcdGlmICh0aGlzLnNldHRpbmdzLmRldmljZUJpbmRpbmdzLmxlbmd0aCA+IDApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBhdXRob3IgPSBnZXRMZWdhY3lBdXRob3JOYW1lKHRoaXMuc2V0dGluZ3MpO1xuXHRcdGlmIChhdXRob3IpIHtcblx0XHRcdHRoaXMuc2V0dGluZ3MuZGV2aWNlQmluZGluZ3MucHVzaCh7XG5cdFx0XHRcdHV1aWQ6IHRoaXMuY3VycmVudERldmljZVV1aWQsXG5cdFx0XHRcdGF1dGhvcixcblx0XHRcdH0pO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZW5zdXJlQ3VycmVudERldmljZUJpbmRpbmcoKSB7XG5cdFx0aWYgKHRoaXMuc2V0dGluZ3MuZGV2aWNlQmluZGluZ3MubGVuZ3RoID4gMCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuc2V0dGluZ3MuZGV2aWNlQmluZGluZ3MucHVzaCh7XG5cdFx0XHR1dWlkOiB0aGlzLmN1cnJlbnREZXZpY2VVdWlkLFxuXHRcdFx0YXV0aG9yOiBcIlwiLFxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBtaWdyYXRlRm9sZGVyRGVmYXVsdFJ1bGVzKCkge1xuXHRcdGNvbnN0IHJ1bGVzOiBGb2xkZXJEZWZhdWx0UnVsZVtdID0gW107XG5cdFx0Zm9yIChjb25zdCBydWxlIG9mIHRoaXMuc2V0dGluZ3MuZm9sZGVyRGVmYXVsdHMpIHtcblx0XHRcdGlmIChydWxlLmZpZWxkcykge1xuXHRcdFx0XHRmb3IgKGNvbnN0IGZpZWxkU2V0dGluZyBvZiBydWxlLmZpZWxkcykge1xuXHRcdFx0XHRcdHJ1bGVzLnB1c2goe1xuXHRcdFx0XHRcdFx0Zm9sZGVyOiBydWxlLmZvbGRlcixcblx0XHRcdFx0XHRcdGZpZWxkOiBmaWVsZFNldHRpbmcuZmllbGQsXG5cdFx0XHRcdFx0XHR2YWx1ZTogZmllbGRTZXR0aW5nLnZhbHVlLFxuXHRcdFx0XHRcdFx0Y3JlYXRlZEJ5OiBydWxlLmNyZWF0ZWRCeSxcblx0XHRcdFx0XHRcdGNyZWF0ZWRBdDogcnVsZS5jcmVhdGVkQXQsXG5cdFx0XHRcdFx0XHRtb2RpZmllZEJ5OiBydWxlLm1vZGlmaWVkQnksXG5cdFx0XHRcdFx0XHRtb2RpZmllZEF0OiBydWxlLm1vZGlmaWVkQXQsXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJ1bGVzLnB1c2gocnVsZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHRoaXMuc2V0dGluZ3MuZm9sZGVyRGVmYXVsdHMgPSBydWxlcztcblx0fVxuXG5cdHByaXZhdGUgbWlncmF0ZUFJU3VtbWFyeVByb21wdCgpIHtcblx0XHRpZiAoXG5cdFx0XHR0aGlzLnNldHRpbmdzLmFpU3VtbWFyeVByb21wdCA9PT0gT0xEX0FJX1NVTU1BUllfUFJPTVBUIHx8XG5cdFx0XHR0aGlzLnNldHRpbmdzLmFpU3VtbWFyeVByb21wdCA9PT0gUFJFVklPVVNfQUlfU1VNTUFSWV9QUk9NUFRcblx0XHQpIHtcblx0XHRcdHRoaXMuc2V0dGluZ3MuYWlTdW1tYXJ5UHJvbXB0ID0gREVGQVVMVF9BSV9TVU1NQVJZX1BST01QVDtcblx0XHR9XG5cdH1cblxuXHRhc3luYyBjaGVja0ZvclVwZGF0ZSgpOiBQcm9taXNlPHsgaGFzVXBkYXRlOiBib29sZWFuOyB2ZXJzaW9uOiBzdHJpbmc7IGVycm9yPzogc3RyaW5nIH0+IHtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChgJHtHSVRIVUJfUkFXX0JBU0V9L21hbmlmZXN0Lmpzb25gKTtcblxuXHRcdFx0aWYgKHJlc3BvbnNlLnN0YXR1cyA9PT0gNDA0KSB7XG5cdFx0XHRcdHJldHVybiB7IGhhc1VwZGF0ZTogZmFsc2UsIHZlcnNpb246IFwiXCIsIGVycm9yOiBcIm5vdF9mb3VuZFwiIH07XG5cdFx0XHR9XG5cdFx0XHRpZiAoIXJlc3BvbnNlLm9rKSB7XG5cdFx0XHRcdHJldHVybiB7IGhhc1VwZGF0ZTogZmFsc2UsIHZlcnNpb246IFwiXCIsIGVycm9yOiBg6K+35rGC5aSx6LSl77yaJHtyZXNwb25zZS5zdGF0dXN9YCB9O1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCByZW1vdGVNYW5pZmVzdCA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKSBhcyB7IHZlcnNpb24/OiBzdHJpbmcgfTtcblx0XHRcdGNvbnN0IHJlbW90ZVZlcnNpb24gPSByZW1vdGVNYW5pZmVzdC52ZXJzaW9uID8/IFwiXCI7XG5cdFx0XHRpZiAoIXJlbW90ZVZlcnNpb24pIHtcblx0XHRcdFx0cmV0dXJuIHsgaGFzVXBkYXRlOiBmYWxzZSwgdmVyc2lvbjogXCJcIiwgZXJyb3I6IFwi6L+c56uv54mI5pys5Y+35peg5pWIXCIgfTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgY3VycmVudFZlcnNpb24gPSB0aGlzLm1hbmlmZXN0LnZlcnNpb247XG5cdFx0XHRjb25zdCBoYXNVcGRhdGUgPSB0aGlzLmNvbXBhcmVWZXJzaW9ucyhyZW1vdGVWZXJzaW9uLCBjdXJyZW50VmVyc2lvbikgPiAwO1xuXHRcdFx0cmV0dXJuIHsgaGFzVXBkYXRlLCB2ZXJzaW9uOiByZW1vdGVWZXJzaW9uIH07XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdHJldHVybiB7IGhhc1VwZGF0ZTogZmFsc2UsIHZlcnNpb246IFwiXCIsIGVycm9yOiBnZXRFcnJvck1lc3NhZ2UoZXJyb3IpIH07XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgcGVyZm9ybVVwZGF0ZSh2ZXJzaW9uOiBzdHJpbmcsIG9uUHJvZ3Jlc3M/OiAoc3RlcDogbnVtYmVyLCB0b3RhbDogbnVtYmVyKSA9PiB2b2lkKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZmlsZXMgPSBbXCJtYWluLmpzXCIsIFwibWFuaWZlc3QuanNvblwiLCBcInN0eWxlcy5jc3NcIl0gYXMgY29uc3Q7XG5cdFx0Y29uc3QgY29udGVudHM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fTtcblxuXHRcdGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCBmaWxlcy5sZW5ndGg7IGluZGV4KyspIHtcblx0XHRcdGNvbnN0IGZpbGUgPSBmaWxlc1tpbmRleF07XG5cdFx0XHRjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKGAke0dJVEhVQl9SQVdfQkFTRX0vJHtmaWxlfWApO1xuXHRcdFx0aWYgKCFyZXNwb25zZS5vaykge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYOS4i+i9vSAke2ZpbGV9IOWksei0pe+8miR7cmVzcG9uc2Uuc3RhdHVzfWApO1xuXHRcdFx0fVxuXHRcdFx0Y29udGVudHNbZmlsZV0gPSBhd2FpdCByZXNwb25zZS50ZXh0KCk7XG5cdFx0XHRvblByb2dyZXNzPy4oaW5kZXggKyAxLCBmaWxlcy5sZW5ndGgpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHBsdWdpbkRpciA9IHRoaXMubWFuaWZlc3QuZGlyO1xuXHRcdGlmICghcGx1Z2luRGlyKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCLml6Dms5Xojrflj5bmj5Lku7bnm67lvZVcIik7XG5cdFx0fVxuXG5cdFx0YXdhaXQgdGhpcy5hcHAudmF1bHQuYWRhcHRlci53cml0ZShgJHtwbHVnaW5EaXJ9L21haW4uanNgLCBjb250ZW50c1tcIm1haW4uanNcIl0pO1xuXHRcdGF3YWl0IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIud3JpdGUoYCR7cGx1Z2luRGlyfS9tYW5pZmVzdC5qc29uYCwgY29udGVudHNbXCJtYW5pZmVzdC5qc29uXCJdKTtcblx0XHRhd2FpdCB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLndyaXRlKGAke3BsdWdpbkRpcn0vc3R5bGVzLmNzc2AsIGNvbnRlbnRzW1wic3R5bGVzLmNzc1wiXSk7XG5cblx0XHRjb25zdCBwbHVnaW5JZCA9IHRoaXMubWFuaWZlc3QuaWQ7XG5cdFx0Y29uc3QgYXBwID0gdGhpcy5hcHA7XG5cdFx0bmV3IE5vdGljZShg5pu05paw5a6M5oiQ77yIJHt2ZXJzaW9ufe+8ie+8jOato+WcqOmHjei9veaPkuS7ti4uLmApO1xuXG5cdFx0d2luZG93LnNldFRpbWVvdXQoYXN5bmMgKCkgPT4ge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Ly8gdW5sb2FkUGx1Z2luIOS8muWNuOi9veW5tumHiuaUvuaXpyBKU1xuXHRcdFx0XHQvLyBsb2FkUGx1Z2luIOS8mumHjeaWsOS7juejgeebmOivu+WPliBtYWluLmpzXG5cdFx0XHRcdC8vIEB0cy1pZ25vcmUg4oCUIOWGhemDqCBBUElcblx0XHRcdFx0YXdhaXQgYXBwLnBsdWdpbnMudW5sb2FkUGx1Z2luKHBsdWdpbklkKTtcblx0XHRcdFx0YXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHdpbmRvdy5zZXRUaW1lb3V0KHJlc29sdmUsIDUwMCkpO1xuXHRcdFx0XHQvLyBAdHMtaWdub3JlIOKAlCDlhoXpg6ggQVBJXG5cdFx0XHRcdGF3YWl0IGFwcC5wbHVnaW5zLmxvYWRQbHVnaW4ocGx1Z2luSWQpO1xuXHRcdFx0XHQvLyBsb2FkUGx1Z2luIOWPquWKoOi9veS4jeWQr+eUqO+8jOmcgOimgeWGjSBlbmFibGVcblx0XHRcdFx0Ly8gQHRzLWlnbm9yZSDigJQg5YaF6YOoIEFQSVxuXHRcdFx0XHRhd2FpdCBhcHAucGx1Z2lucy5lbmFibGVQbHVnaW4ocGx1Z2luSWQpO1xuXHRcdFx0XHRhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4gd2luZG93LnNldFRpbWVvdXQocmVzb2x2ZSwgNTAwKSk7XG5cdFx0XHRcdC8vIEB0cy1pZ25vcmUg4oCUIOWGhemDqCBBUElcblx0XHRcdFx0YXBwLnNldHRpbmcub3BlbigpO1xuXHRcdFx0XHQvLyBAdHMtaWdub3JlIOKAlCDlhoXpg6ggQVBJXG5cdFx0XHRcdGFwcC5zZXR0aW5nLm9wZW5UYWJCeUlkKHBsdWdpbklkKTtcblx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0bmV3IE5vdGljZShcIuiHquWKqOmHjei9veWksei0pe+8jOivt+eCueWHu+W3suWuieijheaPkuS7tumhteeahOOAjOmHjeaWsOWKoOi9veaPkuS7tuOAjeaMiemSrlwiKTtcblx0XHRcdH1cblx0XHR9LCAxMDApO1xuXHR9XG5cblx0cHJpdmF0ZSBjb21wYXJlVmVyc2lvbnModjE6IHN0cmluZywgdjI6IHN0cmluZyk6IG51bWJlciB7XG5cdFx0Y29uc3QgcGFyc2VWZXJzaW9uID0gKHZlcnNpb246IHN0cmluZyk6IG51bWJlcltdID0+IHtcblx0XHRcdHJldHVybiB2ZXJzaW9uXG5cdFx0XHRcdC5yZXBsYWNlKC9edi8sIFwiXCIpXG5cdFx0XHRcdC5zcGxpdChcIi5cIilcblx0XHRcdFx0Lm1hcCgocGFydCkgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IG1hdGNoID0gL15cXGQrLy5leGVjKHBhcnQpO1xuXHRcdFx0XHRcdHJldHVybiBtYXRjaCA/IHBhcnNlSW50KG1hdGNoWzBdLCAxMCkgOiAwO1xuXHRcdFx0XHR9KTtcblx0XHR9O1xuXG5cdFx0Y29uc3QgcGFydHMxID0gcGFyc2VWZXJzaW9uKHYxKTtcblx0XHRjb25zdCBwYXJ0czIgPSBwYXJzZVZlcnNpb24odjIpO1xuXHRcdGNvbnN0IG1heExlbmd0aCA9IE1hdGgubWF4KHBhcnRzMS5sZW5ndGgsIHBhcnRzMi5sZW5ndGgpO1xuXG5cdFx0Zm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IG1heExlbmd0aDsgaW5kZXgrKykge1xuXHRcdFx0Y29uc3QgYSA9IHBhcnRzMVtpbmRleF0gPz8gMDtcblx0XHRcdGNvbnN0IGIgPSBwYXJ0czJbaW5kZXhdID8/IDA7XG5cdFx0XHRpZiAoYSA+IGIpIHJldHVybiAxO1xuXHRcdFx0aWYgKGEgPCBiKSByZXR1cm4gLTE7XG5cdFx0fVxuXHRcdHJldHVybiAwO1xuXHR9XG5cblx0cHJpdmF0ZSBzY2hlZHVsZVVwZGF0ZWRGaWVsZFJlZnJlc2goZmlsZTogVEZpbGUgfCBudWxsKSB7XG5cdFx0dGhpcy5jbGVhclVwZGF0ZVRpbWVyKCk7XG5cblx0XHRpZiAoIWZpbGUgfHwgZmlsZS5leHRlbnNpb24gIT09IFwibWRcIikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMudXBkYXRlRmlsZVBhdGggPSBmaWxlLnBhdGg7XG5cdFx0dGhpcy51cGRhdGVUaW1lciA9IHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdGNvbnN0IGFjdGl2ZUZpbGUgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlRmlsZSgpO1xuXHRcdFx0aWYgKCFhY3RpdmVGaWxlIHx8IGFjdGl2ZUZpbGUucGF0aCAhPT0gdGhpcy51cGRhdGVGaWxlUGF0aCkge1xuXHRcdFx0XHR0aGlzLmNsZWFyVXBkYXRlVGltZXIoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBwYXRoID0gdGhpcy51cGRhdGVGaWxlUGF0aDtcblx0XHRcdHRoaXMuY2xlYXJVcGRhdGVUaW1lcigpO1xuXHRcdFx0dGhpcy5yZWZyZXNoVXBkYXRlZEZpZWxkKHBhdGgpO1xuXHRcdH0sIDUwMDApO1xuXHR9XG5cblx0cHJpdmF0ZSBjbGVhclVwZGF0ZVRpbWVyKCkge1xuXHRcdGlmICh0aGlzLnVwZGF0ZVRpbWVyICE9PSBudWxsKSB7XG5cdFx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMudXBkYXRlVGltZXIpO1xuXHRcdFx0dGhpcy51cGRhdGVUaW1lciA9IG51bGw7XG5cdFx0fVxuXHRcdHRoaXMudXBkYXRlRmlsZVBhdGggPSBudWxsO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyByZWZyZXNoVXBkYXRlZEZpZWxkKHBhdGg6IHN0cmluZykge1xuXHRcdGNvbnN0IGZpbGUgPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgocGF0aCk7XG5cdFx0aWYgKCEoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGF3YWl0IHRoaXMuYXBwLnZhdWx0LnByb2Nlc3MoZmlsZSwgKGNvbnRlbnQpID0+IHtcblx0XHRcdGNvbnN0IG5leHQgPSB1cGRhdGVGcm9udG1hdHRlclVwZGF0ZWQoY29udGVudCwgZm9ybWF0TG9jYWxEYXRlKG5ldyBEYXRlKCkpKTtcblx0XHRcdHJldHVybiBuZXh0ID8/IGNvbnRlbnQ7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIHNjaGVkdWxlRW1wdHlGaWVsZEhpZ2hsaWdodENoZWNrKCkge1xuXHRcdGlmICh0aGlzLmhpZ2hsaWdodFRpbWVyICE9PSBudWxsKSB7XG5cdFx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMuaGlnaGxpZ2h0VGltZXIpO1xuXHRcdFx0dGhpcy5oaWdobGlnaHRUaW1lciA9IG51bGw7XG5cdFx0fVxuXG5cdFx0Y29uc3QgYWN0aXZlRmlsZSA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVGaWxlKCk7XG5cdFx0Y29uc3QgYWN0aXZlUGF0aCA9IGFjdGl2ZUZpbGU/LnBhdGggPz8gbnVsbDtcblx0XHRpZiAodGhpcy5oaWdobGlnaHRGaWxlUGF0aCAhPT0gYWN0aXZlUGF0aCkge1xuXHRcdFx0dGhpcy5jbGVhckVtcHR5RmllbGRIaWdobGlnaHRzKCk7XG5cdFx0XHR0aGlzLmNsZWFySGlnaGxpZ2h0SW50ZXJ2YWwoKTtcblx0XHRcdHRoaXMuaGlnaGxpZ2h0RmlsZVBhdGggPSBhY3RpdmVQYXRoO1xuXHRcdH1cblxuXHRcdGlmIChcblx0XHRcdCF0aGlzLnNldHRpbmdzLmVtcHR5RmllbGRIaWdobGlnaHQgfHxcblx0XHRcdCFhY3RpdmVGaWxlIHx8XG5cdFx0XHRhY3RpdmVGaWxlLmV4dGVuc2lvbiAhPT0gXCJtZFwiXG5cdFx0KSB7XG5cdFx0XHR0aGlzLmNsZWFySGlnaGxpZ2h0SW50ZXJ2YWwoKTtcblx0XHRcdHRoaXMuY2xlYXJFbXB0eUZpZWxkSGlnaGxpZ2h0cygpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuaGlnaGxpZ2h0VGltZXIgPSB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHR0aGlzLmhpZ2hsaWdodFRpbWVyID0gbnVsbDtcblx0XHRcdHRoaXMuYXBwbHlFbXB0eUZpZWxkSGlnaGxpZ2h0cygpO1xuXHRcdFx0dGhpcy5lbnN1cmVIaWdobGlnaHRJbnRlcnZhbCgpO1xuXHRcdH0sIDMwMCk7XG5cdH1cblxuXHRwcml2YXRlIHNjaGVkdWxlRm9sZGVyQ2hlY2ttYXJrUmVmcmVzaCgpIHtcblx0XHR0aGlzLmNsZWFyRm9sZGVyQ2hlY2ttYXJrVGltZXIoKTtcblx0XHR0aGlzLmZvbGRlckNoZWNrbWFya1RpbWVyID0gd2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0dGhpcy5mb2xkZXJDaGVja21hcmtUaW1lciA9IG51bGw7XG5cdFx0XHR0aGlzLmFwcGx5Rm9sZGVyQ2hlY2ttYXJrcygpO1xuXHRcdH0sIDApO1xuXHR9XG5cblx0cHJpdmF0ZSBjbGVhckZvbGRlckNoZWNrbWFya1RpbWVyKCkge1xuXHRcdGlmICh0aGlzLmZvbGRlckNoZWNrbWFya1RpbWVyICE9PSBudWxsKSB7XG5cdFx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMuZm9sZGVyQ2hlY2ttYXJrVGltZXIpO1xuXHRcdFx0dGhpcy5mb2xkZXJDaGVja21hcmtUaW1lciA9IG51bGw7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhcHBseUZvbGRlckNoZWNrbWFya3MoKSB7XG5cdFx0dGhpcy5jbGVhckZvbGRlckNoZWNrbWFya3MoKTtcblx0XHRpZiAoIXRoaXMuc2V0dGluZ3Muc2hvd0ZvbGRlckNoZWNrbWFyaykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJ1bGVGb2xkZXJzID0gbmV3IFNldChcblx0XHRcdHRoaXMuc2V0dGluZ3MuZm9sZGVyRGVmYXVsdHNcblx0XHRcdFx0Lm1hcCgocnVsZSkgPT4gcnVsZS5mb2xkZXIpXG5cdFx0XHRcdC5maWx0ZXIoKGZvbGRlcikgPT4gZm9sZGVyLmxlbmd0aCA+IDApLFxuXHRcdCk7XG5cdFx0aWYgKHJ1bGVGb2xkZXJzLnNpemUgPT09IDApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBmb2xkZXJUaXRsZXMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50PihcIi5uYXYtZm9sZGVyLXRpdGxlXCIpO1xuXHRcdGZvciAoY29uc3QgdGl0bGVFbCBvZiBBcnJheS5mcm9tKGZvbGRlclRpdGxlcykpIHtcblx0XHRcdGNvbnN0IGZvbGRlclBhdGggPVxuXHRcdFx0XHR0aXRsZUVsLmdldEF0dHJpYnV0ZShcImRhdGEtcGF0aFwiKSA/P1xuXHRcdFx0XHR0aXRsZUVsLmNsb3Nlc3QoXCIubmF2LWZvbGRlclwiKT8uZ2V0QXR0cmlidXRlKFwiZGF0YS1wYXRoXCIpID8/XG5cdFx0XHRcdFwiXCI7XG5cdFx0XHRpZiAoIXJ1bGVGb2xkZXJzLmhhcyhmb2xkZXJQYXRoKSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0dGl0bGVFbC5jcmVhdGVTcGFuKHtcblx0XHRcdFx0Y2xzOiBcImZyb250bWF0dGVyLWZvbGRlci1jaGVja1wiLFxuXHRcdFx0XHR0ZXh0OiBcIuKck1wiLFxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBjbGVhckZvbGRlckNoZWNrbWFya3MoKSB7XG5cdFx0ZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChcIi5mcm9udG1hdHRlci1mb2xkZXItY2hlY2tcIikuZm9yRWFjaCgoZWwpID0+IHtcblx0XHRcdGVsLnJlbW92ZSgpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBlbnN1cmVIaWdobGlnaHRJbnRlcnZhbCgpIHtcblx0XHRpZiAodGhpcy5oaWdobGlnaHRJbnRlcnZhbCAhPT0gbnVsbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuaGlnaGxpZ2h0SW50ZXJ2YWwgPSB3aW5kb3cuc2V0SW50ZXJ2YWwoKCkgPT4ge1xuXHRcdFx0dGhpcy5hcHBseUVtcHR5RmllbGRIaWdobGlnaHRzKCk7XG5cdFx0fSwgMjAwMCk7XG5cdH1cblxuXHRwcml2YXRlIGNsZWFySGlnaGxpZ2h0VGltZXJzKCkge1xuXHRcdGlmICh0aGlzLmhpZ2hsaWdodFRpbWVyICE9PSBudWxsKSB7XG5cdFx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMuaGlnaGxpZ2h0VGltZXIpO1xuXHRcdFx0dGhpcy5oaWdobGlnaHRUaW1lciA9IG51bGw7XG5cdFx0fVxuXHRcdHRoaXMuY2xlYXJIaWdobGlnaHRJbnRlcnZhbCgpO1xuXHR9XG5cblx0cHJpdmF0ZSBjbGVhckhpZ2hsaWdodEludGVydmFsKCkge1xuXHRcdGlmICh0aGlzLmhpZ2hsaWdodEludGVydmFsICE9PSBudWxsKSB7XG5cdFx0XHR3aW5kb3cuY2xlYXJJbnRlcnZhbCh0aGlzLmhpZ2hsaWdodEludGVydmFsKTtcblx0XHRcdHRoaXMuaGlnaGxpZ2h0SW50ZXJ2YWwgPSBudWxsO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXBwbHlFbXB0eUZpZWxkSGlnaGxpZ2h0cygpIHtcblx0XHRjb25zdCBhY3RpdmVGaWxlID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKTtcblx0XHRpZiAoXG5cdFx0XHQhdGhpcy5zZXR0aW5ncy5lbXB0eUZpZWxkSGlnaGxpZ2h0IHx8XG5cdFx0XHQhYWN0aXZlRmlsZSB8fFxuXHRcdFx0YWN0aXZlRmlsZS5leHRlbnNpb24gIT09IFwibWRcIlxuXHRcdCkge1xuXHRcdFx0dGhpcy5jbGVhckhpZ2hsaWdodEludGVydmFsKCk7XG5cdFx0XHR0aGlzLmNsZWFyRW1wdHlGaWVsZEhpZ2hsaWdodHMoKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBmcm9udG1hdHRlciA9IHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKGFjdGl2ZUZpbGUpPy5mcm9udG1hdHRlciA/PyB7fTtcblx0XHRjb25zdCBlbXB0eUZpZWxkcyA9IG5ldyBTZXQoXG5cdFx0XHRISUdITElHSFRfRklFTERTLmZpbHRlcigoZmllbGQpID0+IGlzRW1wdHlGcm9udG1hdHRlclZhbHVlKGZyb250bWF0dGVyW2ZpZWxkXSkpLFxuXHRcdCk7XG5cdFx0dGhpcy51cGRhdGVFbXB0eUZpZWxkSGlnaGxpZ2h0cyhlbXB0eUZpZWxkcyk7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZUVtcHR5RmllbGRIaWdobGlnaHRzKGVtcHR5RmllbGRzOiBTZXQ8SGlnaGxpZ2h0RmllbGQ+KSB7XG5cdFx0Y29uc3QgY29udGFpbmVycyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTEVsZW1lbnQ+KFwiLm1ldGFkYXRhLWNvbnRhaW5lclwiKTtcblx0XHRmb3IgKGNvbnN0IGNvbnRhaW5lciBvZiBBcnJheS5mcm9tKGNvbnRhaW5lcnMpKSB7XG5cdFx0XHRBcnJheS5mcm9tKGNvbnRhaW5lci5xdWVyeVNlbGVjdG9yQWxsKFwiLmZyb250bWF0dGVyLWVtcHR5LWhpZ2hsaWdodFwiKSkuZm9yRWFjaCgoZWwpID0+IHtcblx0XHRcdFx0cmVtb3ZlRW1wdHlIaWdobGlnaHRDbGFzc2VzKGVsKTtcblx0XHRcdH0pO1xuXG5cdFx0XHRjb25zdCBlbXB0eVJvd3MgPSBBcnJheS5mcm9tKGVtcHR5RmllbGRzKVxuXHRcdFx0XHQubWFwKChmaWVsZCkgPT4gZmluZE1ldGFkYXRhUm93KGNvbnRhaW5lciwgZmllbGQpKVxuXHRcdFx0XHQuZmlsdGVyKChyb3cpOiByb3cgaXMgSFRNTEVsZW1lbnQgPT4gcm93ICE9PSBudWxsKVxuXHRcdFx0XHQuc29ydCgoYSwgYikgPT4gZ2V0RG9jdW1lbnRPcmRlcihhLCBiKSk7XG5cblx0XHRcdGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCBlbXB0eVJvd3MubGVuZ3RoOyBpbmRleCsrKSB7XG5cdFx0XHRcdGVtcHR5Um93c1tpbmRleF0uY2xhc3NMaXN0LmFkZChcblx0XHRcdFx0XHRcImZyb250bWF0dGVyLWVtcHR5LWhpZ2hsaWdodFwiLFxuXHRcdFx0XHRcdGBmcm9udG1hdHRlci1lbXB0eS0keyhpbmRleCAlIEhJR0hMSUdIVF9GSUVMRFMubGVuZ3RoKSArIDF9YCxcblx0XHRcdFx0KTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGNsZWFyRW1wdHlGaWVsZEhpZ2hsaWdodHMoKSB7XG5cdFx0ZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChcIi5mcm9udG1hdHRlci1lbXB0eS1oaWdobGlnaHRcIikuZm9yRWFjaCgoZWwpID0+IHtcblx0XHRcdHJlbW92ZUVtcHR5SGlnaGxpZ2h0Q2xhc3NlcyhlbCk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIHNjaGVkdWxlQUlTdW1tYXJ5QnV0dG9uUmVmcmVzaCgpIHtcblx0XHR0aGlzLmNsZWFyQUlTdW1tYXJ5QnV0dG9uVGltZXIoKTtcblx0XHR0aGlzLmFib3J0QUlTdW1tYXJ5U3RyZWFtKCk7XG5cdFx0dGhpcy5haUJ1dHRvblRpbWVyID0gd2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0dGhpcy5haUJ1dHRvblRpbWVyID0gbnVsbDtcblx0XHRcdHRoaXMuYWRkQUlTdW1tYXJ5QnV0dG9uKCk7XG5cdFx0fSwgMzAwKTtcblx0fVxuXG5cdHByaXZhdGUgc2NoZWR1bGVEZWxheWVkQUlTdW1tYXJ5QnV0dG9uUmVmcmVzaCgpIHtcblx0XHR0aGlzLmNsZWFyQUlTdW1tYXJ5QnV0dG9uVGltZXIoKTtcblx0XHR0aGlzLmFpQnV0dG9uVGltZXIgPSB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHR0aGlzLmFpQnV0dG9uVGltZXIgPSBudWxsO1xuXHRcdFx0dGhpcy5hZGRBSVN1bW1hcnlCdXR0b24oKTtcblx0XHR9LCAxMDAwKTtcblx0fVxuXG5cdHByaXZhdGUgY2xlYXJBSVN1bW1hcnlCdXR0b25UaW1lcigpIHtcblx0XHRpZiAodGhpcy5haUJ1dHRvblRpbWVyICE9PSBudWxsKSB7XG5cdFx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMuYWlCdXR0b25UaW1lcik7XG5cdFx0XHR0aGlzLmFpQnV0dG9uVGltZXIgPSBudWxsO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgY2xlYXJBSVN1bW1hcnlCdXR0b25zKCkge1xuXHRcdGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCIuZnJvbnRtYXR0ZXItYWktc3VtbWFyeS1idG4sIC5mcm9udG1hdHRlci1haS1zdW1tYXJ5LWNvbmZpcm1cIikuZm9yRWFjaCgoZWwpID0+IHtcblx0XHRcdGVsLnJlbW92ZSgpO1xuXHRcdH0pO1xuXHRcdGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCIuZnJvbnRtYXR0ZXItYWktc3VtbWFyeS1yb3dcIikuZm9yRWFjaCgoZWwpID0+IHtcblx0XHRcdGNvbnN0IHJvdyA9IGVsIGFzIEhUTUxFbGVtZW50ICYge1xuXHRcdFx0XHRmcm9udG1hdHRlckFpRm9jdXNIYW5kbGVyPzogRXZlbnRMaXN0ZW5lcjtcblx0XHRcdFx0ZnJvbnRtYXR0ZXJBaUJsdXJIYW5kbGVyPzogRXZlbnRMaXN0ZW5lcjtcblx0XHRcdH07XG5cdFx0XHRjb25zdCB2YWx1ZUVsID0gZmluZE1ldGFkYXRhVmFsdWVDb250YWluZXIocm93KTtcblx0XHRcdGlmICh2YWx1ZUVsICYmIHJvdy5mcm9udG1hdHRlckFpRm9jdXNIYW5kbGVyKSB7XG5cdFx0XHRcdHZhbHVlRWwucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImZvY3VzaW5cIiwgcm93LmZyb250bWF0dGVyQWlGb2N1c0hhbmRsZXIpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHZhbHVlRWwgJiYgcm93LmZyb250bWF0dGVyQWlCbHVySGFuZGxlcikge1xuXHRcdFx0XHR2YWx1ZUVsLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJmb2N1c291dFwiLCByb3cuZnJvbnRtYXR0ZXJBaUJsdXJIYW5kbGVyKTtcblx0XHRcdH1cblx0XHRcdGRlbGV0ZSByb3cuZnJvbnRtYXR0ZXJBaUZvY3VzSGFuZGxlcjtcblx0XHRcdGRlbGV0ZSByb3cuZnJvbnRtYXR0ZXJBaUJsdXJIYW5kbGVyO1xuXHRcdH0pO1xuXHRcdGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCIuZnJvbnRtYXR0ZXItYWktc3VtbWFyeS1yb3dcIikuZm9yRWFjaCgoZWwpID0+IHtcblx0XHRcdGVsLmNsYXNzTGlzdC5yZW1vdmUoXCJmcm9udG1hdHRlci1haS1zdW1tYXJ5LXJvd1wiKTtcblx0XHR9KTtcblx0XHRkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiLmZyb250bWF0dGVyLWFpLXN1bW1hcnktbG9hZGluZ1wiKS5mb3JFYWNoKChlbCkgPT4ge1xuXHRcdFx0ZWwuY2xhc3NMaXN0LnJlbW92ZShcImZyb250bWF0dGVyLWFpLXN1bW1hcnktbG9hZGluZ1wiKTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgYWJvcnRBSVN1bW1hcnlTdHJlYW0oKSB7XG5cdFx0dGhpcy5haVN1bW1hcnlBYm9ydENvbnRyb2xsZXI/LmFib3J0KCk7XG5cdFx0dGhpcy5haVN1bW1hcnlBYm9ydENvbnRyb2xsZXIgPSBudWxsO1xuXHR9XG5cblx0cHJpdmF0ZSBhZGRBSVN1bW1hcnlCdXR0b24oKSB7XG5cdFx0dGhpcy5hcHBseUFJU3VtbWFyeUJ1dHRvbnMoKTtcblx0fVxuXG5cdHByaXZhdGUgYXBwbHlBSVN1bW1hcnlCdXR0b25zKCkge1xuXHRcdHRoaXMuY2xlYXJBSVN1bW1hcnlCdXR0b25zKCk7XG5cdFx0Y29uc3QgYWN0aXZlRmlsZSA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVGaWxlKCk7XG5cdFx0aWYgKCFhY3RpdmVGaWxlIHx8IGFjdGl2ZUZpbGUuZXh0ZW5zaW9uICE9PSBcIm1kXCIpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBjb250YWluZXJzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbDxIVE1MRWxlbWVudD4oXCIubWV0YWRhdGEtY29udGFpbmVyXCIpO1xuXHRcdGZvciAoY29uc3QgY29udGFpbmVyIG9mIEFycmF5LmZyb20oY29udGFpbmVycykpIHtcblx0XHRcdGNvbnN0IHJvdyA9IGZpbmRNZXRhZGF0YVJvdyhjb250YWluZXIsIFwi5pGY6KaBXCIpO1xuXHRcdFx0aWYgKFxuXHRcdFx0XHQhcm93IHx8XG5cdFx0XHRcdCFyb3cuaXNDb25uZWN0ZWQgfHxcblx0XHRcdFx0IWRvY3VtZW50LmNvbnRhaW5zKHJvdykgfHxcblx0XHRcdFx0cm93LnF1ZXJ5U2VsZWN0b3IoXCIuZnJvbnRtYXR0ZXItYWktc3VtbWFyeS1idG4sIC5mcm9udG1hdHRlci1haS1zdW1tYXJ5LWNvbmZpcm1cIilcblx0XHRcdCkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc29sZS5sb2coXCJbQUnmkZjopoFdIOaRmOimgeihjCBET006XCIsIHJvdy5vdXRlckhUTUwpO1xuXHRcdFx0cm93LmFkZENsYXNzKFwiZnJvbnRtYXR0ZXItYWktc3VtbWFyeS1yb3dcIik7XG5cdFx0XHRjb25zdCB2YWx1ZUVsID0gZmluZE1ldGFkYXRhVmFsdWVDb250YWluZXIocm93KTtcblx0XHRcdGNvbnN0IHN1bW1hcnkgPSBub3JtYWxpemVGcm9udG1hdHRlclNjYWxhcihcblx0XHRcdFx0dGhpcy5hcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoYWN0aXZlRmlsZSk/LmZyb250bWF0dGVyPy5bXCLmkZjopoFcIl0sXG5cdFx0XHQpO1xuXHRcdFx0aWYgKCFzdW1tYXJ5KSB7XG5cdFx0XHRcdHRoaXMuc2hvd0FJU3VtbWFyeUJ1dHRvbihyb3csIGFjdGl2ZUZpbGUsIFwiZnVsbFwiKTtcblx0XHRcdH0gZWxzZSBpZiAodmFsdWVFbCkge1xuXHRcdFx0XHRjb25zdCByb3dXaXRoSGFuZGxlcnMgPSByb3cgYXMgSFRNTEVsZW1lbnQgJiB7XG5cdFx0XHRcdFx0ZnJvbnRtYXR0ZXJBaUZvY3VzSGFuZGxlcj86IEV2ZW50TGlzdGVuZXI7XG5cdFx0XHRcdFx0ZnJvbnRtYXR0ZXJBaUJsdXJIYW5kbGVyPzogRXZlbnRMaXN0ZW5lcjtcblx0XHRcdFx0fTtcblx0XHRcdFx0bGV0IGhpZGVUaW1lcjogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG5cdFx0XHRcdHJvd1dpdGhIYW5kbGVycy5mcm9udG1hdHRlckFpRm9jdXNIYW5kbGVyID0gKCkgPT4ge1xuXHRcdFx0XHRcdGlmIChoaWRlVGltZXIgIT09IG51bGwpIHtcblx0XHRcdFx0XHRcdHdpbmRvdy5jbGVhclRpbWVvdXQoaGlkZVRpbWVyKTtcblx0XHRcdFx0XHRcdGhpZGVUaW1lciA9IG51bGw7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHRoaXMuc2hvd0FJU3VtbWFyeUJ1dHRvbihyb3csIGFjdGl2ZUZpbGUsIFwiaWNvblwiKTtcblx0XHRcdFx0fTtcblx0XHRcdFx0cm93V2l0aEhhbmRsZXJzLmZyb250bWF0dGVyQWlCbHVySGFuZGxlciA9ICgpID0+IHtcblx0XHRcdFx0XHRpZiAoaGlkZVRpbWVyICE9PSBudWxsKSB7XG5cdFx0XHRcdFx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0KGhpZGVUaW1lcik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGhpZGVUaW1lciA9IHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdFx0XHRcdGlmICghcm93LnF1ZXJ5U2VsZWN0b3IoXCIuZnJvbnRtYXR0ZXItYWktc3VtbWFyeS1jb25maXJtXCIpKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuaGlkZUFJU3VtbWFyeUJ1dHRvbihyb3cpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0sIDIwMCk7XG5cdFx0XHRcdH07XG5cdFx0XHRcdHZhbHVlRWwuYWRkRXZlbnRMaXN0ZW5lcihcImZvY3VzaW5cIiwgcm93V2l0aEhhbmRsZXJzLmZyb250bWF0dGVyQWlGb2N1c0hhbmRsZXIpO1xuXHRcdFx0XHR2YWx1ZUVsLmFkZEV2ZW50TGlzdGVuZXIoXCJmb2N1c291dFwiLCByb3dXaXRoSGFuZGxlcnMuZnJvbnRtYXR0ZXJBaUJsdXJIYW5kbGVyKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHNob3dBSVN1bW1hcnlCdXR0b24ocm93OiBIVE1MRWxlbWVudCwgZmlsZTogVEZpbGUsIHZhcmlhbnQ6IFwiZnVsbFwiIHwgXCJpY29uXCIpIHtcblx0XHRpZiAocm93LnF1ZXJ5U2VsZWN0b3IoXCIuZnJvbnRtYXR0ZXItYWktc3VtbWFyeS1idG4sIC5mcm9udG1hdHRlci1haS1zdW1tYXJ5LWNvbmZpcm1cIikpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBidXR0b24gPSByb3cuY3JlYXRlRWwoXCJidXR0b25cIiwge1xuXHRcdFx0Y2xzOiBgZnJvbnRtYXR0ZXItYWktc3VtbWFyeS1idG4gaXMtJHt2YXJpYW50fWAsXG5cdFx0XHRhdHRyOiB7IFwiYXJpYS1sYWJlbFwiOiBcIkFJIOeUn+aIkOaRmOimgVwiIH0sXG5cdFx0fSk7XG5cdFx0c2V0SWNvbihidXR0b24sIFwic3BhcmtsZXNcIik7XG5cdFx0aWYgKHZhcmlhbnQgPT09IFwiZnVsbFwiKSB7XG5cdFx0XHRidXR0b24uY3JlYXRlU3Bhbih7IHRleHQ6IFwiQUnmkZjopoFcIiB9KTtcblx0XHR9XG5cdFx0YnV0dG9uLm9uY2xpY2sgPSAoZXZlbnQpID0+IHtcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdHRoaXMuc2hvd0FJU3VtbWFyeUNvbmZpcm0ocm93LCBmaWxlLCBidXR0b24pO1xuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIGhpZGVBSVN1bW1hcnlCdXR0b24ocm93OiBIVE1MRWxlbWVudCkge1xuXHRcdHJvdy5xdWVyeVNlbGVjdG9yKFwiLmZyb250bWF0dGVyLWFpLXN1bW1hcnktYnRuXCIpPy5yZW1vdmUoKTtcblx0fVxuXG5cdHByaXZhdGUgc2hvd0FJU3VtbWFyeUNvbmZpcm0ocm93OiBIVE1MRWxlbWVudCwgZmlsZTogVEZpbGUsIGJ1dHRvbjogSFRNTEVsZW1lbnQpIHtcblx0XHRidXR0b24ucmVtb3ZlKCk7XG5cdFx0cm93LnF1ZXJ5U2VsZWN0b3IoXCIuZnJvbnRtYXR0ZXItYWktc3VtbWFyeS1jb25maXJtXCIpPy5yZW1vdmUoKTtcblx0XHRjb25zdCBvbGRTdW1tYXJ5ID0gbm9ybWFsaXplRnJvbnRtYXR0ZXJTY2FsYXIoXG5cdFx0XHR0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShmaWxlKT8uZnJvbnRtYXR0ZXI/LltcIuaRmOimgVwiXSxcblx0XHQpO1xuXHRcdGNvbnN0IGNvbmZpcm1FbCA9IHJvdy5jcmVhdGVTcGFuKHsgY2xzOiBcImZyb250bWF0dGVyLWFpLXN1bW1hcnktY29uZmlybVwiIH0pO1xuXHRcdGNvbmZpcm1FbC5jcmVhdGVTcGFuKHtcblx0XHRcdGNsczogXCJmcm9udG1hdHRlci1haS1zdW1tYXJ5LWNvbmZpcm0tdGV4dFwiLFxuXHRcdFx0dGV4dDogb2xkU3VtbWFyeSA/IFwi4pyoIEFJIOabtOaWsO+8n1wiIDogXCLinKggQUkg55Sf5oiQ77yfXCIsXG5cdFx0fSk7XG5cdFx0Y29uc3QgYWNjZXB0QnV0dG9uID0gY29uZmlybUVsLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgY2xzOiBcImZyb250bWF0dGVyLWFpLXN1bW1hcnktY29uZmlybS1pY29uXCIgfSk7XG5cdFx0c2V0SWNvbihhY2NlcHRCdXR0b24sIFwiY2hlY2tcIik7XG5cdFx0Y29uc3QgY2FuY2VsQnV0dG9uID0gY29uZmlybUVsLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgY2xzOiBcImZyb250bWF0dGVyLWFpLXN1bW1hcnktY29uZmlybS1pY29uXCIgfSk7XG5cdFx0c2V0SWNvbihjYW5jZWxCdXR0b24sIFwieFwiKTtcblxuXHRcdGNhbmNlbEJ1dHRvbi5vbmNsaWNrID0gKGV2ZW50KSA9PiB7XG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0ZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0XHRjb25maXJtRWwucmVtb3ZlKCk7XG5cdFx0XHR0aGlzLmFwcGx5QUlTdW1tYXJ5QnV0dG9ucygpO1xuXHRcdH07XG5cdFx0YWNjZXB0QnV0dG9uLm9uY2xpY2sgPSAoZXZlbnQpID0+IHtcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdHZvaWQgdGhpcy5ydW5NZXRhZGF0YUFJU3VtbWFyeShmaWxlLCByb3csIGNvbmZpcm1FbCk7XG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcnVuTWV0YWRhdGFBSVN1bW1hcnkoZmlsZTogVEZpbGUsIHJvdzogSFRNTEVsZW1lbnQsIGNvbmZpcm1FbDogSFRNTEVsZW1lbnQpIHtcblx0XHRjb25zdCB2YWx1ZUVsID0gZmluZE1ldGFkYXRhVmFsdWVDb250YWluZXIocm93KSA/PyByb3c7XG5cdFx0Y29uc3Qgb3JpZ2luYWxWYWx1ZSA9IHZhbHVlRWwudGV4dENvbnRlbnQgPz8gXCJcIjtcblx0XHRjb25maXJtRWwucmVtb3ZlKCk7XG5cdFx0dGhpcy5hYm9ydEFJU3VtbWFyeVN0cmVhbSgpO1xuXHRcdGNvbnN0IGNvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG5cdFx0dGhpcy5haVN1bW1hcnlBYm9ydENvbnRyb2xsZXIgPSBjb250cm9sbGVyO1xuXHRcdGxldCBzdHJlYW1lZFRleHQgPSBcIlwiO1xuXHRcdGxldCBmaW5hbFRleHQgPSBvcmlnaW5hbFZhbHVlO1xuXHRcdGxldCBkaWRTdWNjZWVkID0gZmFsc2U7XG5cdFx0bGV0IGZhbGxiYWNrRG90c1RpbWVyOiBudW1iZXIgfCBudWxsID0gd2luZG93LnNldEludGVydmFsKCgpID0+IHtcblx0XHRcdGlmIChzdHJlYW1lZFRleHQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0dmFsdWVFbC50ZXh0Q29udGVudCA9IHZhbHVlRWwudGV4dENvbnRlbnQgPT09IFwiwrfCt8K3XCIgPyBcIsK3XCIgOiBgJHt2YWx1ZUVsLnRleHRDb250ZW50fcK3YDtcblx0XHR9LCAzNTApO1xuXHRcdHZhbHVlRWwuZW1wdHkoKTtcblx0XHR2YWx1ZUVsLmFkZENsYXNzKFwiZnJvbnRtYXR0ZXItYWktc3VtbWFyeS1sb2FkaW5nXCIpO1xuXHRcdHZhbHVlRWwuc2V0VGV4dChcInxcIik7XG5cblx0XHR0cnkge1xuXHRcdFx0Y29uc3Qgc3VtbWFyeSA9IGF3YWl0IHRoaXMuZ2VuZXJhdGVTdW1tYXJ5Rm9yTWV0YWRhdGFCdXR0b24oZmlsZSwgKGRlbHRhKSA9PiB7XG5cdFx0XHRcdGlmICghZGVsdGEpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0c3RyZWFtZWRUZXh0ICs9IGRlbHRhO1xuXHRcdFx0XHR2YWx1ZUVsLnNldFRleHQoYCR7c3RyZWFtZWRUZXh0fXxgKTtcblx0XHRcdFx0fSwgY29udHJvbGxlci5zaWduYWwpO1xuXHRcdFx0XHRpZiAoZmFsbGJhY2tEb3RzVGltZXIgIT09IG51bGwpIHtcblx0XHRcdFx0XHR3aW5kb3cuY2xlYXJJbnRlcnZhbChmYWxsYmFja0RvdHNUaW1lcik7XG5cdFx0XHRcdFx0ZmFsbGJhY2tEb3RzVGltZXIgPSBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGZpbmFsVGV4dCA9IHN1bW1hcnkgfHwgc3RyZWFtZWRUZXh0O1xuXHRcdFx0XHRkaWRTdWNjZWVkID0gQm9vbGVhbihmaW5hbFRleHQpO1xuXHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0aWYgKCFjb250cm9sbGVyLnNpZ25hbC5hYm9ydGVkKSB7XG5cdFx0XHRcdFx0bmV3IE5vdGljZShgQUkg5pGY6KaB55Sf5oiQ5aSx6LSl77yaJHtnZXRFcnJvck1lc3NhZ2UoZXJyb3IpfWApO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGZpbmFsbHkge1xuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRpZiAoZmFsbGJhY2tEb3RzVGltZXIgIT09IG51bGwpIHtcblx0XHRcdFx0XHRcdFx0d2luZG93LmNsZWFySW50ZXJ2YWwoZmFsbGJhY2tEb3RzVGltZXIpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aWYgKHRoaXMuYWlTdW1tYXJ5QWJvcnRDb250cm9sbGVyID09PSBjb250cm9sbGVyKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuYWlTdW1tYXJ5QWJvcnRDb250cm9sbGVyID0gbnVsbDtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmIChkaWRTdWNjZWVkKSB7XG5cdFx0XHRcdFx0XHRcdG5ldyBOb3RpY2UoXCJBSSDmkZjopoHnlJ/miJDmiJDlip9cIik7XG5cdFx0XHRcdFx0XHRcdHRoaXMuc2NoZWR1bGVEZWxheWVkQUlTdW1tYXJ5QnV0dG9uUmVmcmVzaCgpO1xuXHRcdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdHZhbHVlRWwucmVtb3ZlQ2xhc3MoXCJmcm9udG1hdHRlci1haS1zdW1tYXJ5LWxvYWRpbmdcIik7XG5cdFx0XHRcdFx0XHR2YWx1ZUVsLnNldFRleHQob3JpZ2luYWxWYWx1ZSk7XG5cdFx0XHRcdFx0XHR0aGlzLnNjaGVkdWxlQUlTdW1tYXJ5QnV0dG9uUmVmcmVzaCgpO1xuXHRcdFx0XHRcdH0gY2F0Y2ggKGNsZWFudXBFcnJvcikge1xuXHRcdFx0XHRcdFx0Y29uc29sZS5lcnJvcihcIlthdXRvLWZyb250bWF0dGVyXSBBSSBzdW1tYXJ5IGNsZWFudXAgZmFpbGVkXCIsIGNsZWFudXBFcnJvcik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5jbGFzcyBGb2xkZXJSdWxlTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG5cdHByaXZhdGUgZmllbGQ6IEZvbGRlckRlZmF1bHRGaWVsZCB8IFwiXCIgPSBcIlwiO1xuXHRwcml2YXRlIHZhbHVlID0gXCJcIjtcblx0cHJpdmF0ZSBpc0N1c3RvbVZhbHVlID0gZmFsc2U7XG5cdHByaXZhdGUgY3VzdG9tVmFsdWVJbnB1dEVsOiBIVE1MSW5wdXRFbGVtZW50IHwgbnVsbCA9IG51bGw7XG5cdHByaXZhdGUgY3VzdG9tVmFsdWVCbHVySGFuZGxlcjogKChldmVudDogRm9jdXNFdmVudCkgPT4gdm9pZCkgfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSBjdXN0b21WYWx1ZUtleWRvd25IYW5kbGVyOiAoKGV2ZW50OiBLZXlib2FyZEV2ZW50KSA9PiB2b2lkKSB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIHN1Ym1pdEJ1dHRvbkVsOiBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGwgPSBudWxsO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGFwcDogQXBwLFxuXHRcdHByaXZhdGUgcGx1Z2luOiBBdXRvRnJvbnRtYXR0ZXJQbHVnaW4sXG5cdFx0cHJpdmF0ZSBmb2xkZXI6IHN0cmluZyxcblx0KSB7XG5cdFx0c3VwZXIoYXBwKTtcblx0XHR0aGlzLmZpZWxkID0gdGhpcy5nZXRJbml0aWFsRmllbGQoKTtcblx0XHR0aGlzLnZhbHVlID0gdGhpcy5maW5kRXhpc3RpbmdWYWx1ZSh0aGlzLmZpZWxkKTtcblx0fVxuXG5cdG9uT3BlbigpIHtcblx0XHR0aGlzLnJlbmRlcigpO1xuXHR9XG5cblx0b25DbG9zZSgpIHtcblx0XHR0aGlzLmNsZWFudXBDdXN0b21WYWx1ZUlucHV0KCk7XG5cdFx0dGhpcy5zdWJtaXRCdXR0b25FbCA9IG51bGw7XG5cdFx0dGhpcy5jb250ZW50RWwuZW1wdHkoKTtcblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyKCkge1xuXHRcdGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuXHRcdHRoaXMuY2xlYW51cEN1c3RvbVZhbHVlSW5wdXQoKTtcblx0XHRjb250ZW50RWwuZW1wdHkoKTtcblx0XHRjb250ZW50RWwuY3JlYXRlRWwoXCJoMlwiLCB7IHRleHQ6IFwi6K6+572u5bGe5oCn5Yy56YWN6KeE5YiZXCIgfSk7XG5cdFx0Y29uc3QgaW5oZXJpdGVkUnVsZXMgPSBnZXRBbmNlc3RvclJ1bGVzKHRoaXMuZm9sZGVyLCB0aGlzLnBsdWdpbi5zZXR0aW5ncy5mb2xkZXJEZWZhdWx0cyk7XG5cdFx0Zm9yIChjb25zdCBydWxlIG9mIGluaGVyaXRlZFJ1bGVzKSB7XG5cdFx0XHRjb250ZW50RWwuY3JlYXRlRGl2KHtcblx0XHRcdFx0Y2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItbW9kYWwtaW5oZXJpdGVkLXJ1bGVcIixcblx0XHRcdFx0dGV4dDogYOKGkSDnu6fmib/oh6ogJHtydWxlLmZvbGRlcn0g4oaSICR7cnVsZS5maWVsZH06ICR7cnVsZS52YWx1ZX1gLFxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0bmV3IFNldHRpbmcoY29udGVudEVsKVxuXHRcdFx0LnNldE5hbWUoXCLmlofku7blpLlcIilcblx0XHRcdC5zZXREZXNjKHRoaXMuZm9sZGVyIHx8IFwiL1wiKTtcblxuXHRcdG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcblx0XHRcdC5zZXROYW1lKFwi5a2X5q61XCIpXG5cdFx0XHQuYWRkRHJvcGRvd24oKGRyb3Bkb3duKSA9PiB7XG5cdFx0XHRcdGRyb3Bkb3duLmFkZE9wdGlvbihcIlwiLCBcIuacqumFjee9rlwiKTtcblx0XHRcdFx0Zm9yIChjb25zdCBmaWVsZCBvZiBGT0xERVJfREVGQVVMVF9GSUVMRFMpIHtcblx0XHRcdFx0XHRkcm9wZG93bi5hZGRPcHRpb24oZmllbGQsIGZpZWxkKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGRyb3Bkb3duLnNldFZhbHVlKHRoaXMuZmllbGQpLm9uQ2hhbmdlKCh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdHRoaXMuZmllbGQgPSB2YWx1ZSBhcyBGb2xkZXJEZWZhdWx0RmllbGQgfCBcIlwiO1xuXHRcdFx0XHRcdHRoaXMudmFsdWUgPSB0aGlzLmZpbmRFeGlzdGluZ1ZhbHVlKHRoaXMuZmllbGQpO1xuXHRcdFx0XHRcdHRoaXMuaXNDdXN0b21WYWx1ZSA9IGZhbHNlO1xuXHRcdFx0XHRcdHRoaXMudXBkYXRlU3VibWl0U3RhdGUoKTtcblx0XHRcdFx0XHR0aGlzLnJlbmRlcigpO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0dG9nZ2xlTW9kYWxTZWxlY3RQbGFjZWhvbGRlcihkcm9wZG93bi5zZWxlY3RFbCwgIXRoaXMuZmllbGQpO1xuXHRcdFx0fSk7XG5cblx0XHRjb25zdCBjYW5kaWRhdGVzID0gdGhpcy5maWVsZCA/IGdldEZyb250bWF0dGVyRmllbGRDYW5kaWRhdGVzKHRoaXMuYXBwLCB0aGlzLmZpZWxkKSA6IFtdO1xuXHRcdGNvbnN0IHZhbHVlcyA9IHRoaXMudmFsdWUgJiYgIWNhbmRpZGF0ZXMuaW5jbHVkZXModGhpcy52YWx1ZSkgPyBbLi4uY2FuZGlkYXRlcywgdGhpcy52YWx1ZV0gOiBjYW5kaWRhdGVzO1xuXHRcdGNvbnN0IHZhbHVlU2V0dGluZyA9IG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZShcIuWhq+WGmVwiKTtcblx0XHR2YWx1ZVNldHRpbmcuY29udHJvbEVsLmFkZENsYXNzKFwiYXV0by1mcm9udG1hdHRlci1tb2RhbC12YWx1ZS1jb250cm9sXCIpO1xuXHRcdHZhbHVlU2V0dGluZy5jb250cm9sRWwuZW1wdHkoKTtcblx0XHRjb25zdCBzZWxlY3RFbCA9IHZhbHVlU2V0dGluZy5jb250cm9sRWwuY3JlYXRlRWwoXCJzZWxlY3RcIiwge1xuXHRcdFx0Y2xzOiBcImRyb3Bkb3duIGF1dG8tZnJvbnRtYXR0ZXItbW9kYWwtY3VzdG9tLXNlbGVjdFwiLFxuXHRcdH0pO1xuXHRcdHNlbGVjdEVsLmNyZWF0ZUVsKFwib3B0aW9uXCIsIHtcblx0XHRcdHZhbHVlOiBcIlwiLFxuXHRcdFx0dGV4dDogXCLmnKrphY3nva5cIixcblx0XHR9KTtcblx0XHRmb3IgKGNvbnN0IHZhbHVlIG9mIHZhbHVlcykge1xuXHRcdFx0c2VsZWN0RWwuY3JlYXRlRWwoXCJvcHRpb25cIiwge1xuXHRcdFx0XHR2YWx1ZSxcblx0XHRcdFx0dGV4dDogdmFsdWUsXG5cdFx0XHR9KTtcblx0XHR9XG5cdFx0c2VsZWN0RWwuY3JlYXRlRWwoXCJvcHRpb25cIiwge1xuXHRcdFx0dmFsdWU6IFwiX19uZXdfX1wiLFxuXHRcdFx0dGV4dDogXCLoh6rlrprkuYlcIixcblx0XHR9KTtcblx0XHRzZWxlY3RFbC5kaXNhYmxlZCA9ICF0aGlzLmZpZWxkO1xuXHRcdHNlbGVjdEVsLnZhbHVlID0gdGhpcy5pc0N1c3RvbVZhbHVlID8gXCJfX25ld19fXCIgOiB0aGlzLnZhbHVlIHx8IFwiXCI7XG5cdFx0dG9nZ2xlTW9kYWxTZWxlY3RQbGFjZWhvbGRlcihzZWxlY3RFbCwgIXNlbGVjdEVsLnZhbHVlKTtcblx0XHRzZWxlY3RFbC5hZGRFdmVudExpc3RlbmVyKFwiY2hhbmdlXCIsICgpID0+IHtcblx0XHRcdHRvZ2dsZU1vZGFsU2VsZWN0UGxhY2Vob2xkZXIoc2VsZWN0RWwsICFzZWxlY3RFbC52YWx1ZSk7XG5cdFx0XHRpZiAoIXNlbGVjdEVsLnZhbHVlKSB7XG5cdFx0XHRcdHRoaXMuaXNDdXN0b21WYWx1ZSA9IGZhbHNlO1xuXHRcdFx0XHR0aGlzLnZhbHVlID0gXCJcIjtcblx0XHRcdFx0dGhpcy51cGRhdGVTdWJtaXRTdGF0ZSgpO1xuXHRcdFx0XHR0aGlzLnJlbmRlcigpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoc2VsZWN0RWwudmFsdWUgPT09IFwiX19uZXdfX1wiKSB7XG5cdFx0XHRcdHRoaXMuaXNDdXN0b21WYWx1ZSA9IHRydWU7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLmlzQ3VzdG9tVmFsdWUgPSBmYWxzZTtcblx0XHRcdFx0dGhpcy52YWx1ZSA9IHNlbGVjdEVsLnZhbHVlO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy51cGRhdGVTdWJtaXRTdGF0ZSgpO1xuXHRcdFx0dGhpcy5yZW5kZXIoKTtcblx0XHR9KTtcblxuXHRcdGlmICh0aGlzLmlzQ3VzdG9tVmFsdWUpIHtcblx0XHRcdGNvbnN0IGlucHV0RWwgPSB2YWx1ZVNldHRpbmcuY29udHJvbEVsLmNyZWF0ZUVsKFwiaW5wdXRcIiwge1xuXHRcdFx0XHRjbHM6IFwiYXV0by1mcm9udG1hdHRlci1tb2RhbC1jdXN0b20taW5wdXRcIixcblx0XHRcdFx0dHlwZTogXCJ0ZXh0XCIsXG5cdFx0XHRcdHZhbHVlOiB0aGlzLnZhbHVlLFxuXHRcdFx0fSk7XG5cdFx0XHRpbnB1dEVsLnBsYWNlaG9sZGVyID0gXCLloavlhaXkv6Hmga9cIjtcblx0XHRcdGlucHV0RWwuYWRkRXZlbnRMaXN0ZW5lcihcImlucHV0XCIsICgpID0+IHtcblx0XHRcdFx0dGhpcy52YWx1ZSA9IGlucHV0RWwudmFsdWU7XG5cdFx0XHRcdHRoaXMudXBkYXRlU3VibWl0U3RhdGUoKTtcblx0XHRcdH0pO1xuXHRcdFx0aW5wdXRFbC5hZGRFdmVudExpc3RlbmVyKFwiY2hhbmdlXCIsICgpID0+IHtcblx0XHRcdFx0dGhpcy52YWx1ZSA9IGlucHV0RWwudmFsdWU7XG5cdFx0XHRcdHRoaXMudXBkYXRlU3VibWl0U3RhdGUoKTtcblx0XHRcdH0pO1xuXG5cdFx0XHR0aGlzLmN1c3RvbVZhbHVlSW5wdXRFbCA9IGlucHV0RWw7XG5cdFx0XHR0aGlzLmN1c3RvbVZhbHVlQmx1ckhhbmRsZXIgPSAoKSA9PiB7XG5cdFx0XHRcdHRoaXMudmFsdWUgPSBpbnB1dEVsLnZhbHVlO1xuXHRcdFx0XHR0aGlzLnVwZGF0ZVN1Ym1pdFN0YXRlKCk7XG5cdFx0XHR9O1xuXHRcdFx0dGhpcy5jdXN0b21WYWx1ZUtleWRvd25IYW5kbGVyID0gKGV2ZW50KSA9PiB7XG5cdFx0XHRcdGlmIChldmVudC5rZXkgPT09IFwiRW50ZXJcIikge1xuXHRcdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdFx0dGhpcy52YWx1ZSA9IGlucHV0RWwudmFsdWU7XG5cdFx0XHRcdFx0dGhpcy51cGRhdGVTdWJtaXRTdGF0ZSgpO1xuXHRcdFx0XHRcdGlucHV0RWwuYmx1cigpO1xuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXHRcdFx0aW5wdXRFbC5hZGRFdmVudExpc3RlbmVyKFwiYmx1clwiLCB0aGlzLmN1c3RvbVZhbHVlQmx1ckhhbmRsZXIpO1xuXHRcdFx0aW5wdXRFbC5hZGRFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCB0aGlzLmN1c3RvbVZhbHVlS2V5ZG93bkhhbmRsZXIpO1xuXHRcdFx0d2luZG93LnNldFRpbWVvdXQoKCkgPT4gaW5wdXRFbC5mb2N1cygpLCAwKTtcblx0XHR9XG5cblx0XHRjb25zdCBhY3Rpb25zRWwgPSBjb250ZW50RWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItbW9kYWwtYWN0aW9uc1wiIH0pO1xuXHRcdG5ldyBTZXR0aW5nKGFjdGlvbnNFbClcblx0XHRcdC5hZGRCdXR0b24oKGJ1dHRvbikgPT4ge1xuXHRcdFx0XHRidXR0b24uc2V0QnV0dG9uVGV4dChcIuWPlua2iFwiKS5vbkNsaWNrKCgpID0+IHtcblx0XHRcdFx0XHR0aGlzLmNsb3NlKCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSlcblx0XHRcdC5hZGRCdXR0b24oKGJ1dHRvbikgPT4ge1xuXHRcdFx0XHR0aGlzLnN1Ym1pdEJ1dHRvbkVsID0gYnV0dG9uLmJ1dHRvbkVsO1xuXHRcdFx0XHRidXR0b25cblx0XHRcdFx0XHQuc2V0QnV0dG9uVGV4dChcIuaPkOS6pFwiKVxuXHRcdFx0XHRcdC5zZXRDdGEoKVxuXHRcdFx0XHRcdC5vbkNsaWNrKGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRpZiAoIXRoaXMucGx1Z2luLmVuc3VyZURldmljZUJvdW5kKCkpIHtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRhd2FpdCB0aGlzLnBsdWdpbi51cHNlcnRGb2xkZXJSdWxlKHRoaXMuZm9sZGVyLCB0aGlzLmZpZWxkIGFzIEZvbGRlckRlZmF1bHRGaWVsZCwgdGhpcy52YWx1ZSk7XG5cdFx0XHRcdFx0dGhpcy5wbHVnaW4ucmVmcmVzaFNldHRpbmdzVGFiKCk7XG5cdFx0XHRcdFx0bmV3IE5vdGljZShg6KeE5YiZ5bey5L+d5a2Y77yIJHt0aGlzLnBsdWdpbi5nZXRDdXJyZW50QXV0aG9yTmFtZSgpfe+8iWApO1xuXHRcdFx0XHRcdHRoaXMuY2xvc2UoKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR0aGlzLnVwZGF0ZVN1Ym1pdFN0YXRlKCk7XG5cdH1cblxuXHRwcml2YXRlIGZpbmRFeGlzdGluZ1ZhbHVlKGZpZWxkOiBGb2xkZXJEZWZhdWx0RmllbGQgfCBcIlwiKTogc3RyaW5nIHtcblx0XHRpZiAoIWZpZWxkKSB7XG5cdFx0XHRyZXR1cm4gXCJcIjtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMucGx1Z2luLnNldHRpbmdzLmZvbGRlckRlZmF1bHRzLmZpbmQoKHJ1bGUpID0+IHtcblx0XHRcdHJldHVybiBydWxlLmZvbGRlciA9PT0gdGhpcy5mb2xkZXIgJiYgcnVsZS5maWVsZCA9PT0gZmllbGQ7XG5cdFx0fSk/LnZhbHVlID8/IFwiXCI7XG5cdH1cblxuXHRwcml2YXRlIGdldEluaXRpYWxGaWVsZCgpOiBGb2xkZXJEZWZhdWx0RmllbGQge1xuXHRcdGNvbnN0IG93bkZpZWxkcyA9IG5ldyBTZXQoXG5cdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5mb2xkZXJEZWZhdWx0c1xuXHRcdFx0XHQuZmlsdGVyKChydWxlKSA9PiBydWxlLmZvbGRlciA9PT0gdGhpcy5mb2xkZXIpXG5cdFx0XHRcdC5tYXAoKHJ1bGUpID0+IHJ1bGUuZmllbGQpLFxuXHRcdCk7XG5cdFx0Y29uc3QgaW5oZXJpdGVkRmllbGRzID0gbmV3IFNldChcblx0XHRcdGdldEFuY2VzdG9yUnVsZXModGhpcy5mb2xkZXIsIHRoaXMucGx1Z2luLnNldHRpbmdzLmZvbGRlckRlZmF1bHRzKS5tYXAoKHJ1bGUpID0+IHJ1bGUuZmllbGQpLFxuXHRcdCk7XG5cblx0XHRpZiAob3duRmllbGRzLmhhcyhcIumhueebrlwiKSAmJiAhb3duRmllbGRzLmhhcyhcIuexu+Wei1wiKSkge1xuXHRcdFx0cmV0dXJuIFwi57G75Z6LXCI7XG5cdFx0fVxuXHRcdGlmIChvd25GaWVsZHMuaGFzKFwi57G75Z6LXCIpICYmICFvd25GaWVsZHMuaGFzKFwi6aG555uuXCIpKSB7XG5cdFx0XHRyZXR1cm4gXCLpobnnm65cIjtcblx0XHR9XG5cdFx0aWYgKGluaGVyaXRlZEZpZWxkcy5oYXMoXCLpobnnm65cIikgJiYgIWluaGVyaXRlZEZpZWxkcy5oYXMoXCLnsbvlnotcIikpIHtcblx0XHRcdHJldHVybiBcIuexu+Wei1wiO1xuXHRcdH1cblx0XHRyZXR1cm4gXCLpobnnm65cIjtcblx0fVxuXG5cdHByaXZhdGUgY2xlYW51cEN1c3RvbVZhbHVlSW5wdXQoKSB7XG5cdFx0aWYgKHRoaXMuY3VzdG9tVmFsdWVJbnB1dEVsICYmIHRoaXMuY3VzdG9tVmFsdWVCbHVySGFuZGxlcikge1xuXHRcdFx0dGhpcy5jdXN0b21WYWx1ZUlucHV0RWwucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImJsdXJcIiwgdGhpcy5jdXN0b21WYWx1ZUJsdXJIYW5kbGVyKTtcblx0XHR9XG5cdFx0aWYgKHRoaXMuY3VzdG9tVmFsdWVJbnB1dEVsICYmIHRoaXMuY3VzdG9tVmFsdWVLZXlkb3duSGFuZGxlcikge1xuXHRcdFx0dGhpcy5jdXN0b21WYWx1ZUlucHV0RWwucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwgdGhpcy5jdXN0b21WYWx1ZUtleWRvd25IYW5kbGVyKTtcblx0XHR9XG5cdFx0dGhpcy5jdXN0b21WYWx1ZUlucHV0RWwgPSBudWxsO1xuXHRcdHRoaXMuY3VzdG9tVmFsdWVCbHVySGFuZGxlciA9IG51bGw7XG5cdFx0dGhpcy5jdXN0b21WYWx1ZUtleWRvd25IYW5kbGVyID0gbnVsbDtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlU3VibWl0U3RhdGUoKSB7XG5cdFx0aWYgKCF0aGlzLnN1Ym1pdEJ1dHRvbkVsKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgaGFzRmllbGQgPSBCb29sZWFuKHRoaXMuZmllbGQpO1xuXHRcdGNvbnN0IGhhc1ZhbHVlID0gdGhpcy5pc0N1c3RvbVZhbHVlXG5cdFx0XHQ/ICh0aGlzLmN1c3RvbVZhbHVlSW5wdXRFbD8udmFsdWUgPz8gdGhpcy52YWx1ZSkudHJpbSgpLmxlbmd0aCA+IDBcblx0XHRcdDogdGhpcy52YWx1ZS50cmltKCkubGVuZ3RoID4gMDtcblxuXHRcdHRoaXMuc3VibWl0QnV0dG9uRWwuZGlzYWJsZWQgPSAhKGhhc0ZpZWxkICYmIGhhc1ZhbHVlKTtcblx0fVxufVxuXG5jbGFzcyBBSVN1bW1hcnlTZXJ2aWNlIGltcGxlbWVudHMgU3VtbWFyeVNlcnZpY2Uge1xuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIHNldHRpbmdzOiBBdXRvRnJvbnRtYXR0ZXJTZXR0aW5ncykge31cblxuXHRhc3luYyBnZW5lcmF0ZVN1bW1hcnkoZG9jdW1lbnQ6IFN1bW1hcnlEb2N1bWVudCk6IFByb21pc2U8c3RyaW5nPiB7XG5cdFx0cmV0dXJuIGF3YWl0IHRoaXMuY2FsbEFJKHRoaXMuYnVpbGRQcm9tcHQoZG9jdW1lbnQpKTtcblx0fVxuXG5cdGFzeW5jIGNhbGxBSShwcm9tcHRDb250ZW50OiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4ge1xuXHRcdGNvbnN0IGFwaUtleSA9IHRoaXMuc2V0dGluZ3MuYWlBcGlLZXkudHJpbSgpO1xuXHRcdGlmICghYXBpS2V5KSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJBUEkgS2V5IOS4uuepulwiKTtcblx0XHR9XG5cblx0XHRjb25zdCBhcGlVcmwgPSB0aGlzLnNldHRpbmdzLmFpQXBpVXJsLnJlcGxhY2UoL1xcLyskLywgXCJcIik7XG5cdFx0Y29uc3QgdXJsID0gYCR7YXBpVXJsfS9jaGF0L2NvbXBsZXRpb25zYDtcblxuXHRcdGNvbnNvbGUubG9nKFwiW0FJ5pGY6KaBXSDor7fmsYIgVVJMOlwiLCB1cmwpO1xuXHRcdGNvbnNvbGUubG9nKFwiW0FJ5pGY6KaBXSDmqKHlnos6XCIsIHRoaXMuc2V0dGluZ3MuYWlNb2RlbE5hbWUpO1xuXG5cdFx0Y29uc3QgYm9keSA9IHtcblx0XHRcdG1vZGVsOiB0aGlzLnNldHRpbmdzLmFpTW9kZWxOYW1lLFxuXHRcdFx0bWVzc2FnZXM6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHJvbGU6IFwic3lzdGVtXCIsXG5cdFx0XHRcdFx0Y29udGVudDogXCLnm7TmjqXovpPlh7rmkZjopoHvvIzkuI3opoHmnInku7vkvZXlhbbku5blhoXlrrnjgIJcIixcblx0XHRcdFx0fSxcblx0XHRcdFx0eyByb2xlOiBcInVzZXJcIiwgY29udGVudDogcHJvbXB0Q29udGVudCB9LFxuXHRcdFx0XSxcblx0XHRcdHJlYXNvbmluZ19lZmZvcnQ6IFwibG93XCIsXG5cdFx0XHRyZWFzb25pbmdfZm9ybWF0OiBcImRlZXBzZWVrLXN0eWxlXCIsXG5cdFx0XHRtYXhfdG9rZW5zOiAxMDI0LFxuXHRcdH07XG5cblx0XHRjb25zb2xlLmxvZyhcIltBSeaRmOimgV0g6K+35rGCIGJvZHk6XCIsIEpTT04uc3RyaW5naWZ5KGJvZHksIG51bGwsIDIpLnN1YnN0cmluZygwLCA1MDApKTtcblxuXHRcdGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2godXJsLCB7XG5cdFx0XHRtZXRob2Q6IFwiUE9TVFwiLFxuXHRcdFx0aGVhZGVyczoge1xuXHRcdFx0XHRcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIixcblx0XHRcdFx0XCJBdXRob3JpemF0aW9uXCI6IGBCZWFyZXIgJHthcGlLZXl9YCxcblx0XHRcdH0sXG5cdFx0XHRib2R5OiBKU09OLnN0cmluZ2lmeShib2R5KSxcblx0XHR9KTtcblxuXHRcdGNvbnNvbGUubG9nKFwiW0FJ5pGY6KaBXSDlk43lupQgc3RhdHVzOlwiLCByZXNwb25zZS5zdGF0dXMsIHJlc3BvbnNlLnN0YXR1c1RleHQpO1xuXG5cdFx0aWYgKCFyZXNwb25zZS5vaykge1xuXHRcdFx0Y29uc3QgZXJyb3JUZXh0ID0gYXdhaXQgcmVzcG9uc2UudGV4dCgpO1xuXHRcdFx0Y29uc29sZS5sb2coXCJbQUnmkZjopoFdIOmUmeivr+WTjeW6lDpcIiwgZXJyb3JUZXh0LnN1YnN0cmluZygwLCA1MDApKTtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgQVBJIOivt+axguWksei0pSAoJHtyZXNwb25zZS5zdGF0dXN9KTogJHtlcnJvclRleHQuc3Vic3RyaW5nKDAsIDIwMCl9YCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZGF0YSA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKSBhcyBDaGF0Q29tcGxldGlvblJlc3BvbnNlO1xuXHRcdGNvbnNvbGUubG9nKFwiW0FJ5pGY6KaBXSDlrozmlbTlk43lupQ6XCIsIEpTT04uc3RyaW5naWZ5KGRhdGEsIG51bGwsIDIpKTtcblxuXHRcdGlmIChkYXRhLmVycm9yKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoZGF0YS5lcnJvci5tZXNzYWdlIHx8IEpTT04uc3RyaW5naWZ5KGRhdGEuZXJyb3IpKTtcblx0XHR9XG5cblx0XHRjb25zdCBtZXNzYWdlID0gZGF0YS5jaG9pY2VzPy5bMF0/Lm1lc3NhZ2U7XG5cdFx0aWYgKCFtZXNzYWdlKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCLlk43lupTkuK3ml6AgY2hvaWNlc1swXS5tZXNzYWdl77yM5a6M5pW05ZON5bqU5bey5omT5Y2w5Yiw5o6n5Yi25Y+wXCIpO1xuXHRcdH1cblxuXHRcdFx0Y29uc29sZS5sb2coXCJbQUnmkZjopoFdIG1lc3NhZ2UuY29udGVudDpcIiwgSlNPTi5zdHJpbmdpZnkobWVzc2FnZS5jb250ZW50KSk7XG5cdFx0XHRjb25zb2xlLmxvZyhcIltBSeaRmOimgV0gbWVzc2FnZS5yZWFzb25pbmdfY29udGVudDpcIiwgSlNPTi5zdHJpbmdpZnkobWVzc2FnZS5yZWFzb25pbmdfY29udGVudCk/LnN1YnN0cmluZygwLCAyMDApKTtcblx0XHRcdGNvbnNvbGUubG9nKFwiW0FJ5pGY6KaBXSBtZXNzYWdlLnJlYXNvbmluZzpcIiwgSlNPTi5zdHJpbmdpZnkobWVzc2FnZS5yZWFzb25pbmcpPy5zdWJzdHJpbmcoMCwgMjAwKSk7XG5cblx0XHRsZXQgc3VtbWFyeSA9IG1lc3NhZ2UuY29udGVudD8udHJpbSgpO1xuXHRcdGlmICghc3VtbWFyeSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwi5qih5Z6L5pyq55Sf5oiQ5pGY6KaB77yIY29udGVudCDkuLrnqbrvvInvvIzor7fmiZPlvIDlvIDlj5HogIXlt6Xlhbfmn6XnnIvlrozmlbTlk43lupRcIik7XG5cdFx0fVxuXG5cdFx0c3VtbWFyeSA9IHN1bW1hcnlcblx0XHRcdC5yZXBsYWNlKC9eW1xcXCLjgIzjgI1cIiddK3xbXFxcIuOAjOOAjVwiJ10rJC9nLCBcIlwiKVxuXHRcdFx0LnJlcGxhY2UoL14o5pGY6KaBWzrvvJpdXFxzKikvaSwgXCJcIilcblx0XHRcdC50cmltKCk7XG5cblx0XHRpZiAoIXN1bW1hcnkpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihcIkFJIOaRmOimgei/lOWbnuS4uuepulwiKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gc3VtbWFyeTtcblx0fVxuXG5cdHByaXZhdGUgYnVpbGRQcm9tcHQoZG9jdW1lbnQ6IFN1bW1hcnlEb2N1bWVudCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHJlcGxhY2VQcm9tcHRUb2tlbihcblx0XHRcdHJlcGxhY2VQcm9tcHRUb2tlbihcblx0XHRcdFx0cmVwbGFjZVByb21wdFRva2VuKHRoaXMuc2V0dGluZ3MuYWlTdW1tYXJ5UHJvbXB0LCBcInt0aXRsZX1cIiwgZG9jdW1lbnQudGl0bGUpLFxuXHRcdFx0XHRcIntmcm9udG1hdHRlcn1cIixcblx0XHRcdFx0ZG9jdW1lbnQuZnJvbnRtYXR0ZXIsXG5cdFx0XHQpLFxuXHRcdFx0XCJ7Y29udGVudH1cIixcblx0XHRcdGRvY3VtZW50LmNvbnRlbnQsXG5cdFx0KTtcblx0fVxufVxuXG5jbGFzcyBBdXRvRnJvbnRtYXR0ZXJTZXR0aW5nVGFiIGV4dGVuZHMgUGx1Z2luU2V0dGluZ1RhYiB7XG5cdHBsdWdpbjogQXV0b0Zyb250bWF0dGVyUGx1Z2luO1xuXHRwcml2YXRlIGFjdGl2ZVRhYjogU2V0dGluZ1RhYklkID0gXCLpgJrnlKhcIjtcblx0cHJpdmF0ZSBiaW5kaW5nQ3VycmVudERldmljZSA9IGZhbHNlO1xuXHRwcml2YXRlIGJpbmRpbmdDdXJyZW50RGV2aWNlQ3VzdG9tID0gZmFsc2U7XG5cdHByaXZhdGUgc2NhblJlc3VsdHM6IFNjYW5SZXN1bHRbXSA9IFtdO1xuXHRwcml2YXRlIGhhc1NjYW5uZWQgPSBmYWxzZTtcblx0cHJpdmF0ZSBpc1NjYW5uaW5nID0gZmFsc2U7XG5cdHByaXZhdGUgaXNFeGVjdXRpbmcgPSBmYWxzZTtcblx0cHJpdmF0ZSBwcm9jZXNzZWRDb3VudCA9IDA7XG5cdHByaXZhdGUgdW5tYXRjaGVkRm9sZGVyczogVW5tYXRjaGVkRm9sZGVyUmVzdWx0W10gPSBbXTtcblx0cHJpdmF0ZSBoYXNTY2FubmVkVW5tYXRjaGVkRm9sZGVycyA9IGZhbHNlO1xuXHRwcml2YXRlIGlzU2Nhbm5pbmdVbm1hdGNoZWRGb2xkZXJzID0gZmFsc2U7XG5cdHByaXZhdGUgYWN0aXZlSW5saW5lRWRpdG9yQ2xlYW51cDogKCgpID0+IHZvaWQpIHwgbnVsbCA9IG51bGw7XG5cdHByaXZhdGUgYWlBcGlLZXlWaXNpYmxlID0gZmFsc2U7XG5cdHByaXZhdGUgYWlTdW1tYXJ5Q29tcGxldGlvblJlc3VsdHM6IEFJU3VtbWFyeUNhbmRpZGF0ZVtdID0gW107XG5cdHByaXZhdGUgaGFzU2Nhbm5lZEFJU3VtbWFyeUNvbXBsZXRpb24gPSBmYWxzZTtcblx0cHJpdmF0ZSBpc1NjYW5uaW5nQUlTdW1tYXJ5Q29tcGxldGlvbiA9IGZhbHNlO1xuXHRwcml2YXRlIGlzRXhlY3V0aW5nQUlTdW1tYXJ5Q29tcGxldGlvbiA9IGZhbHNlO1xuXHRwcml2YXRlIHByb2Nlc3NlZEFJU3VtbWFyeUNvbXBsZXRpb25Db3VudCA9IDA7XG5cdHByaXZhdGUgY3VycmVudFJ1bGVQYWdlID0gMDtcblx0cHJpdmF0ZSBpc0NoZWNraW5nVXBkYXRlID0gZmFsc2U7XG5cdHByaXZhdGUgaXNVcGRhdGluZyA9IGZhbHNlO1xuXHRwcml2YXRlIHVwZGF0ZVByb2dyZXNzID0gMDtcblx0cHJpdmF0ZSB1cGRhdGVSZXN1bHRNZXNzYWdlID0gXCJcIjtcblx0cHJpdmF0ZSBsYXRlc3RWZXJzaW9uID0gXCJcIjtcblxuXHRjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcGx1Z2luOiBBdXRvRnJvbnRtYXR0ZXJQbHVnaW4pIHtcblx0XHRzdXBlcihhcHAsIHBsdWdpbik7XG5cdFx0dGhpcy5wbHVnaW4gPSBwbHVnaW47XG5cdH1cblxuXHRkaXNwbGF5KCk6IHZvaWQge1xuXHRcdGNvbnN0IHsgY29udGFpbmVyRWwgfSA9IHRoaXM7XG5cdFx0dGhpcy5jbG9zZUFjdGl2ZUlubGluZUVkaXRvcigpO1xuXHRcdGNvbnRhaW5lckVsLmVtcHR5KCk7XG5cblx0XHR0aGlzLnJlbmRlclRhYnMoY29udGFpbmVyRWwpO1xuXHRcdGNvbnN0IGNvbnRlbnRFbCA9IGNvbnRhaW5lckVsLmNyZWF0ZURpdih7XG5cdFx0XHRjbHM6IFwiYXV0by1mcm9udG1hdHRlci10YWItY29udGVudFwiLFxuXHRcdFx0YXR0cjogeyBcImRhdGEtYXV0by1mcm9udG1hdHRlci1hY3RpdmUtdGFiXCI6IHRoaXMuYWN0aXZlVGFiIH0sXG5cdFx0fSk7XG5cdFx0aWYgKHRoaXMuYWN0aXZlVGFiID09PSBcIumAmueUqFwiKSB7XG5cdFx0XHR0aGlzLnJlbmRlckdlbmVyYWxTZXR0aW5ncyhjb250ZW50RWwpO1xuXHRcdH0gZWxzZSBpZiAodGhpcy5hY3RpdmVUYWIgPT09IFwi5paH5Lu25aS56KeE5YiZXCIpIHtcblx0XHRcdHRoaXMucmVuZGVyRm9sZGVyRGVmYXVsdFJ1bGVzKGNvbnRlbnRFbCk7XG5cdFx0fSBlbHNlIGlmICh0aGlzLmFjdGl2ZVRhYiA9PT0gXCLmiavmj4/ku5PlupNcIikge1xuXHRcdFx0dGhpcy5yZW5kZXJTY2FuU2VjdGlvbihjb250ZW50RWwpO1xuXHRcdH0gZWxzZSBpZiAodGhpcy5hY3RpdmVUYWIgPT09IFwi6K6+5aSH57uR5a6aXCIpIHtcblx0XHRcdHRoaXMucmVuZGVyRGV2aWNlQmluZGluZ3MoY29udGVudEVsKTtcblx0XHR9IGVsc2UgaWYgKHRoaXMuYWN0aXZlVGFiID09PSBcIueJiOacrOabtOaWsFwiKSB7XG5cdFx0XHR0aGlzLnJlbmRlckFib3V0U2VjdGlvbihjb250ZW50RWwpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnJlbmRlckFJU3VtbWFyeVNldHRpbmdzKGNvbnRlbnRFbCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJUYWJzKGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCkge1xuXHRcdGNvbnN0IHRhYnNFbCA9IGNvbnRhaW5lckVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLXRhYnNcIiB9KTtcblx0XHRmb3IgKGNvbnN0IHRhYiBvZiBTRVRUSU5HX1RBQlMpIHtcblx0XHRcdGNvbnN0IHRhYkVsID0gdGFic0VsLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcblx0XHRcdFx0Y2xzOiBgYXV0by1mcm9udG1hdHRlci10YWIke3RoaXMuYWN0aXZlVGFiID09PSB0YWIgPyBcIiBpcy1hY3RpdmVcIiA6IFwiXCJ9YCxcblx0XHRcdFx0dGV4dDogdGFiLFxuXHRcdFx0fSk7XG5cdFx0XHR0YWJFbC5vbmNsaWNrID0gKCkgPT4ge1xuXHRcdFx0XHR0aGlzLmFjdGl2ZVRhYiA9IHRhYjtcblx0XHRcdFx0dGhpcy5kaXNwbGF5KCk7XG5cdFx0XHR9O1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyR2VuZXJhbFNldHRpbmdzKGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCkge1xuXHRcdHRoaXMucmVuZGVyUmVxdWlyZWRGaWVsZHNJbmZvKGNvbnRhaW5lckVsKTtcblxuXHRcdGNvbnN0IGhpZ2hsaWdodFNldHRpbmdFbCA9IGNvbnRhaW5lckVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLWhpZ2hsaWdodC1zZXR0aW5nXCIgfSk7XG5cdFx0bmV3IFNldHRpbmcoaGlnaGxpZ2h0U2V0dGluZ0VsKVxuXHRcdFx0LnNldE5hbWUoXCLnqbrlsZ7mgKfpq5jkuq7mj5DphpJcIilcblx0XHRcdC5zZXREZXNjKFwi5omT5byA5paH5Lu25pe26auY5Lqu5o+Q6YaS5b+F6ZyA5bGe5oCn5Lit55qE56m65YC844CCXCIpXG5cdFx0XHQuYWRkVG9nZ2xlKCh0b2dnbGUpID0+XG5cdFx0XHRcdHRvZ2dsZVxuXHRcdFx0XHRcdC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5lbXB0eUZpZWxkSGlnaGxpZ2h0KVxuXHRcdFx0XHRcdC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcblx0XHRcdFx0XHRcdGlmICghdGhpcy5wbHVnaW4uZW5zdXJlRGV2aWNlQm91bmQoKSkge1xuXHRcdFx0XHRcdFx0XHR0aGlzLmRpc3BsYXkoKTtcblx0XHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MuZW1wdHlGaWVsZEhpZ2hsaWdodCA9IHZhbHVlO1xuXHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5yZWZyZXNoRW1wdHlGaWVsZEhpZ2hsaWdodHMoKTtcblx0XHRcdFx0XHR9KSxcblx0XHRcdCk7XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlckFJU3VtbWFyeVNldHRpbmdzKGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCkge1xuXHRcdGNvbnN0IGludHJvRWwgPSBjb250YWluZXJFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1haS1zdW1tYXJ5LWludHJvXCIgfSk7XG5cdFx0bmV3IFNldHRpbmcoaW50cm9FbClcblx0XHRcdC5zZXROYW1lKFwiQUkg6Ieq5Yqo5pGY6KaBXCIpXG5cdFx0XHQuc2V0RGVzYyhcIuW8gOWQr+WQju+8jOWwhuS9v+eUqCBBSSDlr7nmlofmoaPlhoXlrrnov5vooYzmkZjopoHmgLvnu5PvvIzoh6rliqjloavlhaXjgIzmkZjopoHjgI3lrZfmrrXjgIJcIilcblx0XHRcdC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT5cblx0XHRcdFx0dG9nZ2xlXG5cdFx0XHRcdFx0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmFpU3VtbWFyeUVuYWJsZWQpXG5cdFx0XHRcdFx0Lm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MuYWlTdW1tYXJ5RW5hYmxlZCA9IHZhbHVlO1xuXHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdFx0fSksXG5cdFx0XHQpO1xuXG5cdFx0Y29udGFpbmVyRWwuY3JlYXRlRWwoXCJoM1wiLCB7IHRleHQ6IFwi5qih5Z6L6YWN572uXCIgfSk7XG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHQuc2V0TmFtZShcIkFQSSDlnLDlnYBcIilcblx0XHRcdC5hZGRUZXh0KCh0ZXh0KSA9PiB7XG5cdFx0XHRcdHRleHRcblx0XHRcdFx0XHQuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuYWlBcGlVcmwpXG5cdFx0XHRcdFx0Lm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MuYWlBcGlVcmwgPSB2YWx1ZTtcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR0ZXh0LmlucHV0RWwucGxhY2Vob2xkZXIgPSBcImh0dHBzOi8vYXBpLnN0ZXBmdW4uY29tL3N0ZXBfcGxhbi92MVwiO1xuXHRcdFx0fSk7XG5cblx0XHRuZXcgU2V0dGluZyhjb250YWluZXJFbClcblx0XHRcdC5zZXROYW1lKFwi5qih5Z6L5ZCN56ewXCIpXG5cdFx0XHQuYWRkVGV4dCgodGV4dCkgPT4ge1xuXHRcdFx0XHR0ZXh0XG5cdFx0XHRcdFx0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmFpTW9kZWxOYW1lKVxuXHRcdFx0XHRcdC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcblx0XHRcdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLmFpTW9kZWxOYW1lID0gdmFsdWU7XG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0dGV4dC5pbnB1dEVsLnBsYWNlaG9sZGVyID0gXCJzdGVwLTMuNy1mbGFzaFwiO1xuXHRcdFx0fSk7XG5cblx0XHRjb25zdCBhcGlLZXlTZXR0aW5nID0gbmV3IFNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJBUEkgS2V5XCIpO1xuXHRcdGFwaUtleVNldHRpbmcuY29udHJvbEVsLmFkZENsYXNzKFwiYXV0by1mcm9udG1hdHRlci1haS1hcGkta2V5LWNvbnRyb2xcIik7XG5cdFx0YXBpS2V5U2V0dGluZy5hZGRUZXh0KCh0ZXh0KSA9PiB7XG5cdFx0XHR0ZXh0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmFpQXBpS2V5KS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcblx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MuYWlBcGlLZXkgPSB2YWx1ZTtcblx0XHRcdFx0YXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHR9KTtcblx0XHRcdHRleHQuaW5wdXRFbC50eXBlID0gdGhpcy5haUFwaUtleVZpc2libGUgPyBcInRleHRcIiA6IFwicGFzc3dvcmRcIjtcblx0XHRcdHRleHQuaW5wdXRFbC5wbGFjZWhvbGRlciA9IFwic2steHh4eFwiO1xuXHRcdH0pO1xuXHRcdGFwaUtleVNldHRpbmcuYWRkQnV0dG9uKChidXR0b24pID0+IHtcblx0XHRcdGJ1dHRvbi5zZXRUb29sdGlwKHRoaXMuYWlBcGlLZXlWaXNpYmxlID8gXCLpmpDol48gQVBJIEtleVwiIDogXCLmmL7npLogQVBJIEtleVwiKS5vbkNsaWNrKCgpID0+IHtcblx0XHRcdFx0dGhpcy5haUFwaUtleVZpc2libGUgPSAhdGhpcy5haUFwaUtleVZpc2libGU7XG5cdFx0XHRcdHRoaXMuZGlzcGxheSgpO1xuXHRcdFx0fSk7XG5cdFx0XHRzZXRJY29uKGJ1dHRvbi5idXR0b25FbCwgdGhpcy5haUFwaUtleVZpc2libGUgPyBcImV5ZS1vZmZcIiA6IFwiZXllXCIpO1xuXHRcdH0pO1xuXG5cdFx0XHRjb25zdCBzdGF0dXNFbCA9IGNvbnRhaW5lckVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLWFpLXN0YXR1c1wiIH0pO1xuXHRcdFx0dGhpcy5yZW5kZXJBSVN1bW1hcnlUYXNrU2VjdGlvbihzdGF0dXNFbCwge1xuXHRcdFx0XHR0YXNrOiBcImNvbXBsZXRpb25cIixcblx0XHRcdFx0dGl0bGU6IFwi5pGY6KaB6KGl5YWoXCIsXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBcIuS4uuOAjOaRmOimgeOAjeS4uuepuuS4lOS9nOiAheS4uuacrOacuue7keWumuS9nOiAheeahOaWh+aho+eUn+aIkCBBSSDmkZjopoHjgIJcIixcblx0XHRcdFx0YXV0b1RleHQ6IFwi6Ieq5Yqo6Kem5Y+R77ya5q+PIDMwIOWIhumSn1wiLFxuXHRcdFx0XHRlbXB0eVRleHQ6IFwi54K55Ye75omr5o+P5p+l55yL6ZyA6KaB6KGl5YWo5pGY6KaB55qE5paH5qGj44CCXCIsXG5cdFx0XHRcdGNvdW50VGV4dDogXCLnr4fmlofmoaPpnIDopoHooaXlhajmkZjopoFcIixcblx0XHRcdH0pO1xuXG5cdFx0Y29uc3QgcHJvbXB0SGVhZGVyRWwgPSBjb250YWluZXJFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1haS1wcm9tcHQtaGVhZGVyXCIgfSk7XG5cdFx0cHJvbXB0SGVhZGVyRWwuY3JlYXRlRWwoXCJoM1wiLCB7IHRleHQ6IFwi5pGY6KaBIFByb21wdFwiIH0pO1xuXHRcdG5ldyBTZXR0aW5nKHByb21wdEhlYWRlckVsKS5hZGRCdXR0b24oKGJ1dHRvbikgPT4ge1xuXHRcdFx0YnV0dG9uLnNldEJ1dHRvblRleHQoXCLmgaLlpI3pu5jorqRcIikub25DbGljayhhc3luYyAoKSA9PiB7XG5cdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLmFpU3VtbWFyeVByb21wdCA9IERFRkFVTFRfQUlfU1VNTUFSWV9QUk9NUFQ7XG5cdFx0XHRcdGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdFx0XHR0aGlzLmRpc3BsYXkoKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXG5cdFx0Y29uc3QgcHJvbXB0RWwgPSBjb250YWluZXJFbC5jcmVhdGVFbChcInRleHRhcmVhXCIsIHtcblx0XHRcdGNsczogXCJhdXRvLWZyb250bWF0dGVyLWFpLXByb21wdC10ZXh0YXJlYVwiLFxuXHRcdH0pO1xuXHRcdHByb21wdEVsLnZhbHVlID0gdGhpcy5wbHVnaW4uc2V0dGluZ3MuYWlTdW1tYXJ5UHJvbXB0O1xuXHRcdHByb21wdEVsLmFkZEV2ZW50TGlzdGVuZXIoXCJjaGFuZ2VcIiwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MuYWlTdW1tYXJ5UHJvbXB0ID0gcHJvbXB0RWwudmFsdWU7XG5cdFx0XHRhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyQUlTdW1tYXJ5VGFza1NlY3Rpb24oXG5cdFx0Y29udGFpbmVyRWw6IEhUTUxFbGVtZW50LFxuXHRcdG9wdGlvbnM6IHtcblx0XHRcdHRhc2s6IEFJU3VtbWFyeVRhc2tUeXBlO1xuXHRcdFx0dGl0bGU6IHN0cmluZztcblx0XHRcdGRlc2NyaXB0aW9uOiBzdHJpbmc7XG5cdFx0XHRhdXRvVGV4dDogc3RyaW5nO1xuXHRcdFx0ZW1wdHlUZXh0OiBzdHJpbmc7XG5cdFx0XHRjb3VudFRleHQ6IHN0cmluZztcblx0XHR9LFxuXHQpIHtcblx0XHRjb25zdCB0YXNrRWwgPSBjb250YWluZXJFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1haS10YXNrLXNlY3Rpb25cIiB9KTtcblx0XHR0YXNrRWwuY3JlYXRlRWwoXCJoM1wiLCB7IHRleHQ6IG9wdGlvbnMudGl0bGUgfSk7XG5cdFx0dGFza0VsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLWFpLXRhc2stZGVzY3JpcHRpb25cIiwgdGV4dDogb3B0aW9ucy5kZXNjcmlwdGlvbiB9KTtcblx0XHRjb25zdCBoZWFkZXJFbCA9IHRhc2tFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1haS10YXNrLWhlYWRlclwiIH0pO1xuXHRcdGhlYWRlckVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLWFpLXRhc2stYXV0b1wiLCB0ZXh0OiBvcHRpb25zLmF1dG9UZXh0IH0pO1xuXHRcdGNvbnN0IHNjYW5BY3Rpb25FbCA9IGhlYWRlckVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLWFpLXRhc2stYWN0aW9uXCIgfSk7XG5cdFx0bmV3IFNldHRpbmcoc2NhbkFjdGlvbkVsKS5hZGRCdXR0b24oKGJ1dHRvbikgPT4ge1xuXHRcdFx0Y29uc3QgaXNTY2FubmluZyA9IHRoaXMuZ2V0QUlTdW1tYXJ5VGFza1N0YXRlKG9wdGlvbnMudGFzaykuaXNTY2FubmluZztcblx0XHRcdGJ1dHRvblxuXHRcdFx0XHQuc2V0QnV0dG9uVGV4dChpc1NjYW5uaW5nID8gXCLmiavmj4/kuK0uLi5cIiA6IFwi5omr5o+PXCIpXG5cdFx0XHRcdC5zZXREaXNhYmxlZChpc1NjYW5uaW5nIHx8IHRoaXMuZ2V0QUlTdW1tYXJ5VGFza1N0YXRlKG9wdGlvbnMudGFzaykuaXNFeGVjdXRpbmcpXG5cdFx0XHRcdC5vbkNsaWNrKGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLnNjYW5BSVN1bW1hcnlUYXNrKG9wdGlvbnMudGFzayk7XG5cdFx0XHRcdH0pO1xuXHRcdH0pO1xuXG5cdFx0Y29uc3QgcmVzdWx0RWwgPSB0YXNrRWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItYWktcmVzdWx0c1wiIH0pO1xuXHRcdGNvbnN0IHN0YXRlID0gdGhpcy5nZXRBSVN1bW1hcnlUYXNrU3RhdGUob3B0aW9ucy50YXNrKTtcblx0XHRpZiAoIXN0YXRlLmhhc1NjYW5uZWQpIHtcblx0XHRcdHJlc3VsdEVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLWFpLWVtcHR5XCIsIHRleHQ6IG9wdGlvbnMuZW1wdHlUZXh0IH0pO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmIChzdGF0ZS5yZXN1bHRzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmVzdWx0RWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItYWktZW1wdHlcIiwgdGV4dDogXCLmmoLml6DpnIDopoHlpITnkIbnmoTmlofmoaPjgIJcIiB9KTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRyZXN1bHRFbC5jcmVhdGVEaXYoe1xuXHRcdFx0Y2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItYWktY291bnRcIixcblx0XHRcdHRleHQ6IGDlhbHlj5HnjrAgJHtzdGF0ZS5yZXN1bHRzLmxlbmd0aH0gJHtvcHRpb25zLmNvdW50VGV4dH1gLFxuXHRcdH0pO1xuXHRcdGNvbnN0IGxpc3RFbCA9IHJlc3VsdEVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLWFpLWxpc3RcIiB9KTtcblx0XHRmb3IgKGNvbnN0IHJlc3VsdCBvZiBzdGF0ZS5yZXN1bHRzKSB7XG5cdFx0XHRjb25zdCBpdGVtRWwgPSBsaXN0RWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItYWktaXRlbVwiIH0pO1xuXHRcdFx0Y29uc3QgY29udGVudEVsID0gaXRlbUVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLWFpLWl0ZW0tY29udGVudFwiIH0pO1xuXHRcdFx0Y29uc3QgbmFtZUVsID0gY29udGVudEVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLWFpLW5hbWVcIiB9KTtcblx0XHRcdG5hbWVFbC5jcmVhdGVTcGFuKHsgdGV4dDogcmVzdWx0LmZpbGUubmFtZSB9KTtcblx0XHRcdGlmIChyZXN1bHQuZG9uZSkge1xuXHRcdFx0XHRuYW1lRWwuY3JlYXRlU3Bhbih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLWFpLWRvbmVcIiwgdGV4dDogXCIg4pyTXCIgfSk7XG5cdFx0XHR9XG5cdFx0XHRjb250ZW50RWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItYWktcGF0aFwiLCB0ZXh0OiByZXN1bHQuZmlsZS5wYXRoIH0pO1xuXHRcdFx0Y29uc3Qgb3BlbkJ1dHRvbiA9IGl0ZW1FbC5jcmVhdGVFbChcImJ1dHRvblwiLCB7XG5cdFx0XHRcdGNsczogXCJhdXRvLWZyb250bWF0dGVyLWFpLW9wZW5cIixcblx0XHRcdFx0YXR0cjogeyBcImFyaWEtbGFiZWxcIjogXCLmiZPlvIDmlofku7ZcIiB9LFxuXHRcdFx0fSk7XG5cdFx0XHRzZXRJY29uKG9wZW5CdXR0b24sIFwiZXh0ZXJuYWwtbGlua1wiKTtcblx0XHRcdG9wZW5CdXR0b24ub25jbGljayA9IGFzeW5jICgpID0+IHtcblx0XHRcdFx0YXdhaXQgdGhpcy5hcHAud29ya3NwYWNlLm9wZW5MaW5rVGV4dChyZXN1bHQuZmlsZS5wYXRoLCBcIlwiLCBmYWxzZSk7XG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGNvbnN0IHN0YXR1c1RleHQgPVxuXHRcdFx0c3RhdGUucHJvY2Vzc2VkQ291bnQgPT09IHN0YXRlLnJlc3VsdHMubGVuZ3RoICYmICFzdGF0ZS5pc0V4ZWN1dGluZ1xuXHRcdFx0XHQ/IGDlrozmiJDvvIzlt7LlpITnkIYgJHtzdGF0ZS5wcm9jZXNzZWRDb3VudH0g56+HYFxuXHRcdFx0XHQ6IFwiXCI7XG5cdFx0bmV3IFNldHRpbmcocmVzdWx0RWwpXG5cdFx0XHQuc2V0RGVzYyhzdGF0dXNUZXh0KVxuXHRcdFx0LmFkZEJ1dHRvbigoYnV0dG9uKSA9PiB7XG5cdFx0XHRcdGJ1dHRvblxuXHRcdFx0XHRcdC5zZXRCdXR0b25UZXh0KHN0YXRlLmlzRXhlY3V0aW5nID8gXCLmiafooYzkuK0uLi5cIiA6IFwi5omn6KGMXCIpXG5cdFx0XHRcdFx0LnNldEN0YSgpXG5cdFx0XHRcdFx0LnNldERpc2FibGVkKHN0YXRlLmlzRXhlY3V0aW5nIHx8IHRoaXMucGx1Z2luLmlzQUlTdW1tYXJ5VGFza1J1bm5pbmcob3B0aW9ucy50YXNrKSlcblx0XHRcdFx0XHQub25DbGljayhhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLmV4ZWN1dGVBSVN1bW1hcnlUYXNrKG9wdGlvbnMudGFzayk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0QUlTdW1tYXJ5VGFza1N0YXRlKHRhc2s6IEFJU3VtbWFyeVRhc2tUeXBlKTogQUlTdW1tYXJ5VGFza1VpU3RhdGUge1xuXHRcdHJldHVybiB7XG5cdFx0XHRyZXN1bHRzOiB0aGlzLmFpU3VtbWFyeUNvbXBsZXRpb25SZXN1bHRzLFxuXHRcdFx0aGFzU2Nhbm5lZDogdGhpcy5oYXNTY2FubmVkQUlTdW1tYXJ5Q29tcGxldGlvbixcblx0XHRcdGlzU2Nhbm5pbmc6IHRoaXMuaXNTY2FubmluZ0FJU3VtbWFyeUNvbXBsZXRpb24sXG5cdFx0XHRpc0V4ZWN1dGluZzogdGhpcy5pc0V4ZWN1dGluZ0FJU3VtbWFyeUNvbXBsZXRpb24sXG5cdFx0XHRwcm9jZXNzZWRDb3VudDogdGhpcy5wcm9jZXNzZWRBSVN1bW1hcnlDb21wbGV0aW9uQ291bnQsXG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgc2V0QUlTdW1tYXJ5VGFza1Jlc3VsdHModGFzazogQUlTdW1tYXJ5VGFza1R5cGUsIHJlc3VsdHM6IEFJU3VtbWFyeUNhbmRpZGF0ZVtdKSB7XG5cdFx0dGhpcy5haVN1bW1hcnlDb21wbGV0aW9uUmVzdWx0cyA9IHJlc3VsdHM7XG5cdH1cblxuXHRwcml2YXRlIHNldEFJU3VtbWFyeVRhc2tTY2FubmluZyh0YXNrOiBBSVN1bW1hcnlUYXNrVHlwZSwgdmFsdWU6IGJvb2xlYW4pIHtcblx0XHR0aGlzLmlzU2Nhbm5pbmdBSVN1bW1hcnlDb21wbGV0aW9uID0gdmFsdWU7XG5cdH1cblxuXHRwcml2YXRlIHNldEFJU3VtbWFyeVRhc2tTY2FubmVkKHRhc2s6IEFJU3VtbWFyeVRhc2tUeXBlLCB2YWx1ZTogYm9vbGVhbikge1xuXHRcdHRoaXMuaGFzU2Nhbm5lZEFJU3VtbWFyeUNvbXBsZXRpb24gPSB2YWx1ZTtcblx0fVxuXG5cdHByaXZhdGUgc2V0QUlTdW1tYXJ5VGFza0V4ZWN1dGluZyh0YXNrOiBBSVN1bW1hcnlUYXNrVHlwZSwgdmFsdWU6IGJvb2xlYW4pIHtcblx0XHR0aGlzLmlzRXhlY3V0aW5nQUlTdW1tYXJ5Q29tcGxldGlvbiA9IHZhbHVlO1xuXHR9XG5cblx0cHJpdmF0ZSBzZXRBSVN1bW1hcnlUYXNrUHJvY2Vzc2VkQ291bnQodGFzazogQUlTdW1tYXJ5VGFza1R5cGUsIHZhbHVlOiBudW1iZXIpIHtcblx0XHR0aGlzLnByb2Nlc3NlZEFJU3VtbWFyeUNvbXBsZXRpb25Db3VudCA9IHZhbHVlO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBzY2FuQUlTdW1tYXJ5VGFzayh0YXNrOiBBSVN1bW1hcnlUYXNrVHlwZSkge1xuXHRcdHRoaXMuc2V0QUlTdW1tYXJ5VGFza1NjYW5uZWQodGFzaywgdHJ1ZSk7XG5cdFx0dGhpcy5zZXRBSVN1bW1hcnlUYXNrU2Nhbm5pbmcodGFzaywgdHJ1ZSk7XG5cdFx0dGhpcy5zZXRBSVN1bW1hcnlUYXNrUmVzdWx0cyh0YXNrLCBbXSk7XG5cdFx0dGhpcy5zZXRBSVN1bW1hcnlUYXNrUHJvY2Vzc2VkQ291bnQodGFzaywgMCk7XG5cdFx0dGhpcy5kaXNwbGF5KCk7XG5cblx0XHRjb25zdCByZXN1bHRzID0gYXdhaXQgdGhpcy5wbHVnaW4uc2NhbkFJU3VtbWFyeUNhbmRpZGF0ZXModGFzaywgdHJ1ZSk7XG5cdFx0dGhpcy5zZXRBSVN1bW1hcnlUYXNrUmVzdWx0cyh0YXNrLCByZXN1bHRzKTtcblx0XHR0aGlzLnNldEFJU3VtbWFyeVRhc2tTY2FubmluZyh0YXNrLCBmYWxzZSk7XG5cdFx0dGhpcy5kaXNwbGF5KCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGV4ZWN1dGVBSVN1bW1hcnlUYXNrKHRhc2s6IEFJU3VtbWFyeVRhc2tUeXBlKSB7XG5cdFx0Y29uc3Qgc3RhdGUgPSB0aGlzLmdldEFJU3VtbWFyeVRhc2tTdGF0ZSh0YXNrKTtcblx0XHRpZiAoc3RhdGUucmVzdWx0cy5sZW5ndGggPT09IDApIHtcblx0XHRcdG5ldyBOb3RpY2UoXCJBSSDmkZjopoHvvJrmmoLml6DpnIDopoHlpITnkIbnmoTmlofmoaNcIik7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5zZXRBSVN1bW1hcnlUYXNrRXhlY3V0aW5nKHRhc2ssIHRydWUpO1xuXHRcdHRoaXMuc2V0QUlTdW1tYXJ5VGFza1Byb2Nlc3NlZENvdW50KHRhc2ssIDApO1xuXHRcdGZvciAoY29uc3QgcmVzdWx0IG9mIHN0YXRlLnJlc3VsdHMpIHtcblx0XHRcdHJlc3VsdC5kb25lID0gZmFsc2U7XG5cdFx0fVxuXHRcdHRoaXMuZGlzcGxheSgpO1xuXG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHByb2Nlc3NlZENvdW50ID0gYXdhaXQgdGhpcy5wbHVnaW4uZXhlY3V0ZUFJU3VtbWFyeVF1ZXVlKHRhc2ssIHN0YXRlLnJlc3VsdHMsIHRydWUsICgpID0+IHtcblx0XHRcdFx0dGhpcy5zZXRBSVN1bW1hcnlUYXNrUHJvY2Vzc2VkQ291bnQodGFzaywgdGhpcy5nZXRBSVN1bW1hcnlUYXNrU3RhdGUodGFzaykucHJvY2Vzc2VkQ291bnQgKyAxKTtcblx0XHRcdFx0dGhpcy5kaXNwbGF5KCk7XG5cdFx0XHR9KTtcblx0XHRcdHRoaXMuc2V0QUlTdW1tYXJ5VGFza1Byb2Nlc3NlZENvdW50KHRhc2ssIHByb2Nlc3NlZENvdW50KTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0dGhpcy5zZXRBSVN1bW1hcnlUYXNrRXhlY3V0aW5nKHRhc2ssIGZhbHNlKTtcblx0XHRcdHRoaXMuZGlzcGxheSgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyUmVxdWlyZWRGaWVsZHNJbmZvKGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCkge1xuXHRcdGNvbnN0IHNlY3Rpb25FbCA9IGNvbnRhaW5lckVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLXJlcXVpcmVkLWZpZWxkc1wiIH0pO1xuXHRcdHNlY3Rpb25FbC5jcmVhdGVFbChcImgyXCIsIHsgdGV4dDogXCLpu5jorqTmlofku7blsZ7mgKflrZfmrrVcIiB9KTtcblx0XHRzZWN0aW9uRWwuY3JlYXRlRWwoXCJwXCIsIHtcblx0XHRcdHRleHQ6IFwi5Lul5LiL5a2X5q615Lya5Zyo5paw5bu65paH5qGj5pe26Ieq5Yqo5YaZ5YWl77yM5bm25Zyo5omr5o+P5LuT5bqT5pe26KGl5YWo5qOA5p+l44CCXCIsXG5cdFx0fSk7XG5cblx0XHRjb25zdCB0YWJsZSA9IHNlY3Rpb25FbC5jcmVhdGVFbChcInRhYmxlXCIpO1xuXHRcdGNvbnN0IHRoZWFkID0gdGFibGUuY3JlYXRlRWwoXCJ0aGVhZFwiKTtcblx0XHRjb25zdCBoZWFkZXJSb3cgPSB0aGVhZC5jcmVhdGVFbChcInRyXCIpO1xuXHRcdGZvciAoY29uc3QgaGVhZGVyIG9mIFtcIuWtl+autVwiLCBcIuivtOaYjlwiLCBcIuWhq+WGmeaWueW8j1wiXSkge1xuXHRcdFx0aGVhZGVyUm93LmNyZWF0ZUVsKFwidGhcIiwgeyB0ZXh0OiBoZWFkZXIgfSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdGJvZHkgPSB0YWJsZS5jcmVhdGVFbChcInRib2R5XCIpO1xuXHRcdGZvciAoY29uc3Qgcm93IG9mIFtcblx0XHRcdFtcIumhueebrlwiLCBcIuaWh+aho+aJgOWxnumhueebrlwiLCBcIuaWh+S7tuWkueinhOWImeiHquWKqOWhq+WGme+8jOaIluaJi+WKqOWhq+WGmVwiXSxcblx0XHRcdFtcIuexu+Wei1wiLCBcIuaWh+aho+exu+Wei1wiLCBcIuaWh+S7tuWkueinhOWImeiHquWKqOWhq+WGme+8jOaIluaJi+WKqOWhq+WGmVwiXSxcblx0XHRcdFtcIuS9nOiAhVwiLCBcIuaWh+aho+WIm+W7uuiAhVwiLCBcIuagueaNruiuvuWkh+iHquWKqOivhuWIq1wiXSxcblx0XHRcdFtcIuaRmOimgVwiLCBcIuaWh+aho+WGheWuueaRmOimgVwiLCBcIuaJi+WKqOWhq+WGmSAvIEFJIOiHquWKqOeUn+aIkFwiXSxcblx0XHRcdFtcIuWIm+W7uuaXtumXtFwiLCBcIuaWh+aho+WIm+W7uuaXtumXtFwiLCBcIuiHquWKqOiOt+WPllwiXSxcblx0XHRcdFtcIuacgOWQjuabtOaWsFwiLCBcIuacgOWQjuS4gOasoee8lui+keaXtumXtFwiLCBcIuiHquWKqOabtOaWsFwiXSxcblx0XHRdKSB7XG5cdFx0XHRjb25zdCB0ciA9IHRib2R5LmNyZWF0ZUVsKFwidHJcIik7XG5cdFx0XHRmb3IgKGNvbnN0IGNlbGwgb2Ygcm93KSB7XG5cdFx0XHRcdHRyLmNyZWF0ZUVsKFwidGRcIiwgeyB0ZXh0OiBjZWxsIH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyRGV2aWNlQmluZGluZ3MoY29udGFpbmVyRWw6IEhUTUxFbGVtZW50KSB7XG5cdFx0dGhpcy5yZW5kZXJDdXJyZW50RGV2aWNlU3RhdHVzKGNvbnRhaW5lckVsKTtcblx0XHR0aGlzLnJlbmRlckJvdW5kRGV2aWNlTGlzdChjb250YWluZXJFbCk7XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlckN1cnJlbnREZXZpY2VTdGF0dXMoY29udGFpbmVyRWw6IEhUTUxFbGVtZW50KSB7XG5cdFx0Y29uc3QgY3VycmVudEJpbmRpbmcgPSB0aGlzLmdldEN1cnJlbnREZXZpY2VCaW5kaW5nKCk7XG5cdFx0Y29uc3Qgc3RhdHVzRWwgPSBjb250YWluZXJFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1jdXJyZW50LWRldmljZS1jYXJkXCIgfSk7XG5cdFx0c3RhdHVzRWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItY3VycmVudC1kZXZpY2UtdGl0bGVcIiwgdGV4dDogXCLmnKzmnLrorr7lpIdcIiB9KTtcblx0XHRzdGF0dXNFbC5jcmVhdGVEaXYoe1xuXHRcdFx0Y2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItY3VycmVudC1kZXZpY2UtbGluZVwiLFxuXHRcdFx0dGV4dDogYFVVSUTvvJoke21hc2tEZXZpY2VVdWlkKHRoaXMucGx1Z2luLmN1cnJlbnREZXZpY2VVdWlkKX1gLFxuXHRcdH0pO1xuXG5cdFx0aWYgKGN1cnJlbnRCaW5kaW5nPy5hdXRob3IpIHtcblx0XHRcdHN0YXR1c0VsLmNyZWF0ZURpdih7XG5cdFx0XHRcdGNsczogXCJhdXRvLWZyb250bWF0dGVyLWN1cnJlbnQtZGV2aWNlLWxpbmVcIixcblx0XHRcdFx0dGV4dDogYOeKtuaAge+8muKchSDlt7Lnu5Hlrpog4oCUICR7Y3VycmVudEJpbmRpbmcuYXV0aG9yfWAsXG5cdFx0XHR9KTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRzdGF0dXNFbC5jcmVhdGVEaXYoe1xuXHRcdFx0Y2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItY3VycmVudC1kZXZpY2UtbGluZVwiLFxuXHRcdFx0dGV4dDogXCLnirbmgIHvvJrimqDvuI8g5pyq57uR5a6aXCIsXG5cdFx0fSk7XG5cblx0XHRjb25zdCBhY3Rpb25FbCA9IHN0YXR1c0VsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLWN1cnJlbnQtZGV2aWNlLWFjdGlvblwiIH0pO1xuXHRcdGlmICh0aGlzLmJpbmRpbmdDdXJyZW50RGV2aWNlKSB7XG5cdFx0XHRpZiAodGhpcy5iaW5kaW5nQ3VycmVudERldmljZUN1c3RvbSkge1xuXHRcdFx0XHRuZXcgU2V0dGluZyhhY3Rpb25FbCkuYWRkVGV4dCgodGV4dCkgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IGNvbmZpcm0gPSBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLmJpbmRDdXJyZW50RGV2aWNlKHRleHQuZ2V0VmFsdWUoKSk7XG5cdFx0XHRcdFx0fTtcblxuXHRcdFx0XHRcdHRleHQuc2V0UGxhY2Vob2xkZXIoXCLoh6rlrprkuYnkvZzogIVcIik7XG5cdFx0XHRcdFx0dGV4dC5pbnB1dEVsLm9uYmx1ciA9IGNvbmZpcm07XG5cdFx0XHRcdFx0dGV4dC5pbnB1dEVsLm9ua2V5ZG93biA9IChldmVudCkgPT4ge1xuXHRcdFx0XHRcdFx0aWYgKGV2ZW50LmtleSA9PT0gXCJFbnRlclwiKSB7XG5cdFx0XHRcdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdFx0XHRcdGNvbmZpcm0oKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHRleHQuaW5wdXRFbC5mb2N1cygpLCAwKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRuZXcgU2V0dGluZyhhY3Rpb25FbCkuYWRkRHJvcGRvd24oKGRyb3Bkb3duKSA9PiB7XG5cdFx0XHRcdFx0ZHJvcGRvd24uYWRkT3B0aW9uKFwiXCIsIFwi77yI6K+36YCJ5oup77yJXCIpO1xuXHRcdFx0XHRcdGZvciAoY29uc3Qgb3B0aW9uIG9mIEFVVEhPUl9PUFRJT05TKSB7XG5cdFx0XHRcdFx0XHRkcm9wZG93bi5hZGRPcHRpb24ob3B0aW9uLCBvcHRpb24pO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGRyb3Bkb3duLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdFx0aWYgKHZhbHVlID09PSBDVVNUT01fQVVUSE9SX01PREUpIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5iaW5kaW5nQ3VycmVudERldmljZUN1c3RvbSA9IHRydWU7XG5cdFx0XHRcdFx0XHRcdHRoaXMuZGlzcGxheSgpO1xuXHRcdFx0XHRcdFx0fSBlbHNlIGlmICh2YWx1ZSkge1xuXHRcdFx0XHRcdFx0XHRhd2FpdCB0aGlzLmJpbmRDdXJyZW50RGV2aWNlKHZhbHVlKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdG5ldyBTZXR0aW5nKGFjdGlvbkVsKS5hZGRCdXR0b24oKGJ1dHRvbikgPT4ge1xuXHRcdFx0XHRidXR0b24uc2V0QnV0dG9uVGV4dChcIue7keWumuacrOaculwiKS5zZXRDdGEoKS5vbkNsaWNrKCgpID0+IHtcblx0XHRcdFx0XHR0aGlzLmJpbmRpbmdDdXJyZW50RGV2aWNlID0gdHJ1ZTtcblx0XHRcdFx0XHR0aGlzLmJpbmRpbmdDdXJyZW50RGV2aWNlQ3VzdG9tID0gZmFsc2U7XG5cdFx0XHRcdFx0dGhpcy5kaXNwbGF5KCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJCb3VuZERldmljZUxpc3QoY29udGFpbmVyRWw6IEhUTUxFbGVtZW50KSB7XG5cdFx0Y29udGFpbmVyRWwuY3JlYXRlRWwoXCJoMlwiLCB7IHRleHQ6IFwi5omA5pyJ5bey57uR5a6a6K6+5aSHXCIgfSk7XG5cdFx0Y29uc3QgbGlzdEVsID0gY29udGFpbmVyRWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItYm91bmQtZGV2aWNlLWxpc3RcIiB9KTtcblx0XHRjb25zdCBiaW5kaW5ncyA9IHRoaXMucGx1Z2luLnNldHRpbmdzLmRldmljZUJpbmRpbmdzLmZpbHRlcigoYmluZGluZykgPT4gYmluZGluZy51dWlkICYmIGJpbmRpbmcuYXV0aG9yKTtcblx0XHRpZiAoYmluZGluZ3MubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRsaXN0RWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItYm91bmQtZGV2aWNlLWVtcHR5XCIsIHRleHQ6IFwi5pqC5peg5bey57uR5a6a6K6+5aSHXCIgfSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Zm9yIChjb25zdCBiaW5kaW5nIG9mIGJpbmRpbmdzKSB7XG5cdFx0XHRjb25zdCByb3dFbCA9IGxpc3RFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1ib3VuZC1kZXZpY2Utcm93XCIgfSk7XG5cdFx0XHRyb3dFbC5jcmVhdGVEaXYoe1xuXHRcdFx0XHRjbHM6IFwiYXV0by1mcm9udG1hdHRlci1ib3VuZC1kZXZpY2UtdXVpZFwiLFxuXHRcdFx0XHR0ZXh0OiBtYXNrRGV2aWNlVXVpZChiaW5kaW5nLnV1aWQpLFxuXHRcdFx0fSk7XG5cdFx0XHRjb25zdCBhdXRob3JFbCA9IHJvd0VsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLWJvdW5kLWRldmljZS1hdXRob3JcIiB9KTtcblx0XHRcdGF1dGhvckVsLmNyZWF0ZVNwYW4oeyB0ZXh0OiBiaW5kaW5nLmF1dGhvciB9KTtcblx0XHRcdGlmIChiaW5kaW5nLnV1aWQgPT09IHRoaXMucGx1Z2luLmN1cnJlbnREZXZpY2VVdWlkKSB7XG5cdFx0XHRcdGF1dGhvckVsLmNyZWF0ZVNwYW4oeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1kZXZpY2UtbG9jYWxcIiwgdGV4dDogXCLvvIjmnKzmnLrvvIlcIiB9KTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlckFib3V0U2VjdGlvbihjb250YWluZXJFbDogSFRNTEVsZW1lbnQpIHtcblx0XHRjb250YWluZXJFbC5jcmVhdGVFbChcImgyXCIsIHsgdGV4dDogXCJhdXRvLWZyb250bWF0dGVyXCIgfSk7XG5cdFx0Y29udGFpbmVyRWwuY3JlYXRlRGl2KHtcblx0XHRcdGNsczogXCJhdXRvLWZyb250bWF0dGVyLWFib3V0LXZlcnNpb25cIixcblx0XHRcdHRleHQ6IGDlvZPliY3niYjmnKzvvJoke3RoaXMucGx1Z2luLm1hbmlmZXN0LnZlcnNpb259YCxcblx0XHR9KTtcblxuXHRcdGNvbnN0IGFjdGlvbkVsID0gY29udGFpbmVyRWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItYWJvdXQtYWN0aW9uXCIgfSk7XG5cdFx0Y29uc3QgY2hlY2tCdXR0b24gPSBhY3Rpb25FbC5jcmVhdGVFbChcImJ1dHRvblwiLCB7XG5cdFx0XHRjbHM6IFwibW9kLWN0YSBhdXRvLWZyb250bWF0dGVyLWFib3V0LWNoZWNrLWJ0blwiLFxuXHRcdFx0dGV4dDogdGhpcy5pc0NoZWNraW5nVXBkYXRlID8gXCLmo4Dmn6XkuK0uLi5cIiA6IFwi5qOA5p+l5pu05pawXCIsXG5cdFx0fSk7XG5cdFx0Y2hlY2tCdXR0b24uZGlzYWJsZWQgPSB0aGlzLmlzQ2hlY2tpbmdVcGRhdGUgfHwgdGhpcy5pc1VwZGF0aW5nO1xuXHRcdGNoZWNrQnV0dG9uLm9uY2xpY2sgPSBhc3luYyAoKSA9PiB7XG5cdFx0XHR0aGlzLmlzQ2hlY2tpbmdVcGRhdGUgPSB0cnVlO1xuXHRcdFx0dGhpcy51cGRhdGVSZXN1bHRNZXNzYWdlID0gXCJcIjtcblx0XHRcdHRoaXMubGF0ZXN0VmVyc2lvbiA9IFwiXCI7XG5cdFx0XHR0aGlzLmRpc3BsYXkoKTtcblxuXHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5wbHVnaW4uY2hlY2tGb3JVcGRhdGUoKTtcblx0XHRcdHRoaXMuaXNDaGVja2luZ1VwZGF0ZSA9IGZhbHNlO1xuXG5cdFx0XHRpZiAocmVzdWx0LmVycm9yID09PSBcIm5vdF9mb3VuZFwiKSB7XG5cdFx0XHRcdG5ldyBOb3RpY2UoXCLmnKrmib7liLDov5znq6/ku5PlupPvvIzor7fmo4Dmn6XnvZHnu5xcIik7XG5cdFx0XHRcdHRoaXMudXBkYXRlUmVzdWx0TWVzc2FnZSA9IFwi5pyq5om+5Yiw6L+c56uv5LuT5bqT77yM6K+35qOA5p+l572R57ucXCI7XG5cdFx0XHR9IGVsc2UgaWYgKHJlc3VsdC5lcnJvcikge1xuXHRcdFx0XHRuZXcgTm90aWNlKHJlc3VsdC5lcnJvcik7XG5cdFx0XHRcdHRoaXMudXBkYXRlUmVzdWx0TWVzc2FnZSA9IHJlc3VsdC5lcnJvcjtcblx0XHRcdH0gZWxzZSBpZiAocmVzdWx0Lmhhc1VwZGF0ZSkge1xuXHRcdFx0XHR0aGlzLmxhdGVzdFZlcnNpb24gPSByZXN1bHQudmVyc2lvbjtcblx0XHRcdFx0dGhpcy51cGRhdGVSZXN1bHRNZXNzYWdlID0gYPCflIQg5Y+R546w5paw54mI5pys77yaJHtyZXN1bHQudmVyc2lvbn3vvIjlvZPliY0gJHt0aGlzLnBsdWdpbi5tYW5pZmVzdC52ZXJzaW9ufe+8iWA7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLnVwZGF0ZVJlc3VsdE1lc3NhZ2UgPSBg4pyFIOW9k+WJjeW3suaYr+acgOaWsOeJiOacrO+8iCR7dGhpcy5wbHVnaW4ubWFuaWZlc3QudmVyc2lvbn3vvIlgO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5kaXNwbGF5KCk7XG5cdFx0fTtcblxuXHRcdGlmICh0aGlzLnVwZGF0ZVJlc3VsdE1lc3NhZ2UpIHtcblx0XHRcdGNvbnN0IHJlc3VsdEVsID0gY29udGFpbmVyRWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItYWJvdXQtcmVzdWx0XCIgfSk7XG5cdFx0XHRyZXN1bHRFbC5jcmVhdGVEaXYoeyB0ZXh0OiB0aGlzLnVwZGF0ZVJlc3VsdE1lc3NhZ2UgfSk7XG5cblx0XHRcdGlmICh0aGlzLmxhdGVzdFZlcnNpb24pIHtcblx0XHRcdFx0Y29uc3QgdXBkYXRlQnV0dG9uID0gcmVzdWx0RWwuY3JlYXRlRWwoXCJidXR0b25cIiwge1xuXHRcdFx0XHRcdGNsczogXCJtb2QtY3RhIGF1dG8tZnJvbnRtYXR0ZXItYWJvdXQtdXBkYXRlLWJ0blwiLFxuXHRcdFx0XHRcdHRleHQ6IHRoaXMuaXNVcGRhdGluZyA/IGDmm7TmlrDkuK0uLi7vvIgke3RoaXMudXBkYXRlUHJvZ3Jlc3N9LzPvvIlgIDogXCLnq4vljbPmm7TmlrBcIixcblx0XHRcdFx0fSk7XG5cdFx0XHRcdHVwZGF0ZUJ1dHRvbi5kaXNhYmxlZCA9IHRoaXMuaXNVcGRhdGluZztcblx0XHRcdFx0dXBkYXRlQnV0dG9uLm9uY2xpY2sgPSBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5pc1VwZGF0aW5nID0gdHJ1ZTtcblx0XHRcdFx0XHR0aGlzLnVwZGF0ZVByb2dyZXNzID0gMDtcblx0XHRcdFx0XHR0aGlzLmRpc3BsYXkoKTtcblxuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLnBsdWdpbi5wZXJmb3JtVXBkYXRlKHRoaXMubGF0ZXN0VmVyc2lvbiwgKHN0ZXAsIHRvdGFsKSA9PiB7XG5cdFx0XHRcdFx0XHRcdHRoaXMudXBkYXRlUHJvZ3Jlc3MgPSBzdGVwO1xuXHRcdFx0XHRcdFx0XHR0aGlzLmRpc3BsYXkoKTtcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0dGhpcy5pc1VwZGF0aW5nID0gZmFsc2U7XG5cdFx0XHRcdFx0XHR0aGlzLmxhdGVzdFZlcnNpb24gPSBcIlwiO1xuXHRcdFx0XHRcdFx0dGhpcy51cGRhdGVSZXN1bHRNZXNzYWdlID0gXCJcIjtcblx0XHRcdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRcdFx0dGhpcy5pc1VwZGF0aW5nID0gZmFsc2U7XG5cdFx0XHRcdFx0XHRuZXcgTm90aWNlKGDmm7TmlrDlpLHotKXvvJoke2dldEVycm9yTWVzc2FnZShlcnJvcil9YCk7XG5cdFx0XHRcdFx0XHR0aGlzLnVwZGF0ZVJlc3VsdE1lc3NhZ2UgPSBg5pu05paw5aSx6LSl77yaJHtnZXRFcnJvck1lc3NhZ2UoZXJyb3IpfWA7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHRoaXMuZGlzcGxheSgpO1xuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZ2V0Q3VycmVudERldmljZUJpbmRpbmcoKTogRGV2aWNlQXV0aG9yQmluZGluZyB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMucGx1Z2luLnNldHRpbmdzLmRldmljZUJpbmRpbmdzLmZpbmQoKGJpbmRpbmcpID0+IHtcblx0XHRcdHJldHVybiBiaW5kaW5nLnV1aWQgPT09IHRoaXMucGx1Z2luLmN1cnJlbnREZXZpY2VVdWlkO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBiaW5kQ3VycmVudERldmljZShhdXRob3I6IHN0cmluZykge1xuXHRcdGNvbnN0IHRyaW1tZWQgPSBhdXRob3IudHJpbSgpO1xuXHRcdGlmICghdHJpbW1lZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGxldCBiaW5kaW5nID0gdGhpcy5nZXRDdXJyZW50RGV2aWNlQmluZGluZygpO1xuXHRcdGlmICghYmluZGluZykge1xuXHRcdFx0YmluZGluZyA9IHtcblx0XHRcdFx0dXVpZDogdGhpcy5wbHVnaW4uY3VycmVudERldmljZVV1aWQsXG5cdFx0XHRcdGF1dGhvcjogdHJpbW1lZCxcblx0XHRcdH07XG5cdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5kZXZpY2VCaW5kaW5ncy5wdXNoKGJpbmRpbmcpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRiaW5kaW5nLmF1dGhvciA9IHRyaW1tZWQ7XG5cdFx0fVxuXG5cdFx0dGhpcy5iaW5kaW5nQ3VycmVudERldmljZSA9IGZhbHNlO1xuXHRcdHRoaXMuYmluZGluZ0N1cnJlbnREZXZpY2VDdXN0b20gPSBmYWxzZTtcblx0XHRcdGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdFx0dGhpcy5kaXNwbGF5KCk7XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlckZvbGRlckRlZmF1bHRSdWxlcyhmb2xkZXJSdWxlVGFiQ29udGVudDogSFRNTEVsZW1lbnQpIHtcblx0XHRmb2xkZXJSdWxlVGFiQ29udGVudC5hZGRDbGFzcyhcImF1dG8tZnJvbnRtYXR0ZXItZm9sZGVyLXJ1bGVzLXRhYlwiKTtcblx0XHRjb25zdCBzZWN0aW9uRWwgPSBmb2xkZXJSdWxlVGFiQ29udGVudC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1mb2xkZXItcnVsZXMtc2VjdGlvblwiIH0pO1xuXHRcdGNvbnN0IGhlYWRlckVsID0gc2VjdGlvbkVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLWZvbGRlci1ydWxlcy1oZWFkZXJcIiB9KTtcblx0XHRjb25zdCBoZWFkZXJUb3BFbCA9IGhlYWRlckVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLWZvbGRlci1ydWxlcy1oZWFkZXItdG9wXCIgfSk7XG5cdFx0aGVhZGVyVG9wRWwuY3JlYXRlRWwoXCJoMlwiLCB7IHRleHQ6IFwi5paH5Lu25aS55YaF5paH5qGj5bGe5oCn5Yy56YWN6KeE5YiZXCIgfSk7XG5cdFx0Y29uc3QgYWRkUnVsZUVsID0gaGVhZGVyVG9wRWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItZm9sZGVyLXJ1bGVzLWFkZC1hY3Rpb25cIiB9KTtcblx0XHRuZXcgU2V0dGluZyhhZGRSdWxlRWwpLmFkZEJ1dHRvbigoYnV0dG9uKSA9PiB7XG5cdFx0XHRidXR0b24uc2V0QnV0dG9uVGV4dChcIua3u+WKoOinhOWImVwiKS5zZXRDdGEoKS5vbkNsaWNrKGFzeW5jICgpID0+IHtcblx0XHRcdFx0aWYgKCF0aGlzLnBsdWdpbi5lbnN1cmVEZXZpY2VCb3VuZCgpKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLmZvbGRlckRlZmF1bHRzLnB1c2godGhpcy5wbHVnaW4uY3JlYXRlRm9sZGVyUnVsZSgpKTtcblx0XHRcdFx0YXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdHRoaXMuY3VycmVudFJ1bGVQYWdlID0gTWF0aC5tYXgoMCwgTWF0aC5jZWlsKHRoaXMucGx1Z2luLnNldHRpbmdzLmZvbGRlckRlZmF1bHRzLmxlbmd0aCAvIFJVTEVTX1BFUl9QQUdFKSAtIDEpO1xuXHRcdFx0XHR0aGlzLmRpc3BsYXkoKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHRcdGhlYWRlckVsLmNyZWF0ZUVsKFwicFwiLCB7XG5cdFx0XHRjbHM6IFwiYXV0by1mcm9udG1hdHRlci1mb2xkZXItcnVsZXMtc3VidGl0bGVcIixcblx0XHRcdHRleHQ6IFwi5ouW5YWl6KeE5YiZ5paH5Lu25aS55YaF55qE5omA5pyJbWTmlofku7bvvIzpu5jorqTnmoTmlofku7blsZ7mgKflrZfmrrXkvJrot5/pmo/ljLnphY3op4TliJnotbBcIixcblx0XHR9KTtcblx0XHRoZWFkZXJFbC5jcmVhdGVFbChcInBcIiwge1xuXHRcdFx0Y2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItZm9sZGVyLXJ1bGVzLW5vdGVcIixcblx0XHRcdHRleHQ6ICflvZPliY3ku4XmlK/mjIHorr7nva5cIumhueebrlwiXCLnsbvlnotcIuWtl+autScsXG5cdFx0fSk7XG5cblx0XHRjb25zdCBmb2xkZXJzID0gZ2V0VmF1bHRGb2xkZXJzKHRoaXMuYXBwKTtcblx0XHR0aGlzLnJlbmRlclJ1bGVDYXJvdXNlbChzZWN0aW9uRWwsIGZvbGRlcnMpO1xuXG5cdFx0c2VjdGlvbkVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLXNlY3Rpb24tZGl2aWRlclwiIH0pO1xuXG5cdFx0Y29uc3QgY2hlY2ttYXJrU2V0dGluZ0VsID0gc2VjdGlvbkVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLWZvbGRlci1jaGVja21hcmstc2V0dGluZ1wiIH0pO1xuXHRcdG5ldyBTZXR0aW5nKGNoZWNrbWFya1NldHRpbmdFbClcblx0XHRcdC5zZXROYW1lKFwi5Zyo5paH5Lu25YiX6KGo5Lit5qCH6K6w5bey6YWN6KeE5YiZ55qE5paH5Lu25aS5XCIpXG5cdFx0XHQuYWRkVG9nZ2xlKCh0b2dnbGUpID0+IHtcblx0XHRcdFx0dG9nZ2xlXG5cdFx0XHRcdFx0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLnNob3dGb2xkZXJDaGVja21hcmspXG5cdFx0XHRcdFx0Lm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdFx0aWYgKCF0aGlzLnBsdWdpbi5lbnN1cmVEZXZpY2VCb3VuZCgpKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuZGlzcGxheSgpO1xuXHRcdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5zaG93Rm9sZGVyQ2hlY2ttYXJrID0gdmFsdWU7XG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0XHRcdHRoaXMucGx1Z2luLnJlZnJlc2hGb2xkZXJDaGVja21hcmtzKCk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblxuXHRcdHNlY3Rpb25FbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1zZWN0aW9uLWRpdmlkZXJcIiB9KTtcblxuXHRcdHRoaXMucmVuZGVyVW5tYXRjaGVkRm9sZGVyU2VjdGlvbihzZWN0aW9uRWwpO1xuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJSdWxlQ2Fyb3VzZWwoZm9sZGVyUnVsZVNlY3Rpb25FbDogSFRNTEVsZW1lbnQsIGZvbGRlcnM6IHN0cmluZ1tdKSB7XG5cdFx0Y29uc3QgcnVsZUNvdW50ID0gdGhpcy5wbHVnaW4uc2V0dGluZ3MuZm9sZGVyRGVmYXVsdHMubGVuZ3RoO1xuXHRcdGNvbnN0IHBhZ2VDb3VudCA9IE1hdGgubWF4KDEsIE1hdGguY2VpbChydWxlQ291bnQgLyBSVUxFU19QRVJfUEFHRSkpO1xuXHRcdHRoaXMuY3VycmVudFJ1bGVQYWdlID0gY2xhbXAodGhpcy5jdXJyZW50UnVsZVBhZ2UsIDAsIHBhZ2VDb3VudCAtIDEpO1xuXG5cdFx0Y29uc3QgY2Fyb3VzZWxFbCA9IGZvbGRlclJ1bGVTZWN0aW9uRWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItcnVsZS1jYXJvdXNlbFwiIH0pO1xuXHRcdGNvbnN0IHZpZXdwb3J0RWwgPSBjYXJvdXNlbEVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLXJ1bGUtY2Fyb3VzZWwtdmlld3BvcnRcIiB9KTtcblx0XHRjb25zdCBoYXNNdWx0aXBsZVBhZ2VzID0gcGFnZUNvdW50ID4gMTtcblxuXHRcdGlmIChoYXNNdWx0aXBsZVBhZ2VzKSB7XG5cdFx0XHR0aGlzLnJlbmRlclJ1bGVQYWdlQnV0dG9uKHZpZXdwb3J0RWwsIFwibGVmdFwiLCB0aGlzLmN1cnJlbnRSdWxlUGFnZSA9PT0gMCwgKCkgPT4ge1xuXHRcdFx0XHR0aGlzLmN1cnJlbnRSdWxlUGFnZSA9IE1hdGgubWF4KDAsIHRoaXMuY3VycmVudFJ1bGVQYWdlIC0gMSk7XG5cdFx0XHRcdHRoaXMuZGlzcGxheSgpO1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcnVsZUdyaWRFbCA9IHZpZXdwb3J0RWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItcnVsZS1ncmlkXCIgfSk7XG5cdFx0Y29uc3QgcGFnZVN0YXJ0ID0gdGhpcy5jdXJyZW50UnVsZVBhZ2UgKiBSVUxFU19QRVJfUEFHRTtcblx0XHRjb25zdCBwYWdlUnVsZXMgPSB0aGlzLnBsdWdpbi5zZXR0aW5ncy5mb2xkZXJEZWZhdWx0cy5zbGljZShwYWdlU3RhcnQsIHBhZ2VTdGFydCArIFJVTEVTX1BFUl9QQUdFKTtcblxuXHRcdGlmIChydWxlQ291bnQgPT09IDApIHtcblx0XHRcdHJ1bGVHcmlkRWwuY3JlYXRlRGl2KHtcblx0XHRcdFx0Y2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItcnVsZS1lbXB0eVwiLFxuXHRcdFx0XHR0ZXh0OiBcIuaaguaXoOinhOWImVwiLFxuXHRcdFx0fSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGZvciAobGV0IHBhZ2VJbmRleCA9IDA7IHBhZ2VJbmRleCA8IHBhZ2VSdWxlcy5sZW5ndGg7IHBhZ2VJbmRleCsrKSB7XG5cdFx0XHRcdHRoaXMucmVuZGVyUnVsZUNhcmQocnVsZUdyaWRFbCwgcGFnZVJ1bGVzW3BhZ2VJbmRleF0sIHBhZ2VTdGFydCArIHBhZ2VJbmRleCwgZm9sZGVycyk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKGhhc011bHRpcGxlUGFnZXMpIHtcblx0XHRcdHRoaXMucmVuZGVyUnVsZVBhZ2VCdXR0b24odmlld3BvcnRFbCwgXCJyaWdodFwiLCB0aGlzLmN1cnJlbnRSdWxlUGFnZSA9PT0gcGFnZUNvdW50IC0gMSwgKCkgPT4ge1xuXHRcdFx0XHR0aGlzLmN1cnJlbnRSdWxlUGFnZSA9IE1hdGgubWluKHBhZ2VDb3VudCAtIDEsIHRoaXMuY3VycmVudFJ1bGVQYWdlICsgMSk7XG5cdFx0XHRcdHRoaXMuZGlzcGxheSgpO1xuXHRcdFx0fSk7XG5cblx0XHRcdGNvbnN0IGRvdHNFbCA9IGNhcm91c2VsRWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItcnVsZS1kb3RzXCIgfSk7XG5cdFx0XHRmb3IgKGxldCBwYWdlID0gMDsgcGFnZSA8IHBhZ2VDb3VudDsgcGFnZSsrKSB7XG5cdFx0XHRcdGNvbnN0IGRvdEVsID0gZG90c0VsLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcblx0XHRcdFx0XHRjbHM6IGBhdXRvLWZyb250bWF0dGVyLXJ1bGUtZG90JHtwYWdlID09PSB0aGlzLmN1cnJlbnRSdWxlUGFnZSA/IFwiIGlzLWFjdGl2ZVwiIDogXCJcIn1gLFxuXHRcdFx0XHRcdGF0dHI6IHsgXCJhcmlhLWxhYmVsXCI6IGDot7PovazliLDnrKwgJHtwYWdlICsgMX0g6aG1YCB9LFxuXHRcdFx0XHR9KTtcblx0XHRcdFx0ZG90RWwub25jbGljayA9ICgpID0+IHtcblx0XHRcdFx0XHR0aGlzLmN1cnJlbnRSdWxlUGFnZSA9IHBhZ2U7XG5cdFx0XHRcdFx0dGhpcy5kaXNwbGF5KCk7XG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJSdWxlUGFnZUJ1dHRvbihcblx0XHRydWxlQ2Fyb3VzZWxWaWV3cG9ydEVsOiBIVE1MRWxlbWVudCxcblx0XHRkaXJlY3Rpb246IFwibGVmdFwiIHwgXCJyaWdodFwiLFxuXHRcdGRpc2FibGVkOiBib29sZWFuLFxuXHRcdG9uQ2xpY2s6ICgpID0+IHZvaWQsXG5cdCkge1xuXHRcdGNvbnN0IGJ1dHRvbkVsID0gcnVsZUNhcm91c2VsVmlld3BvcnRFbC5jcmVhdGVFbChcImJ1dHRvblwiLCB7XG5cdFx0XHRjbHM6IGBhdXRvLWZyb250bWF0dGVyLXJ1bGUtbmF2IGlzLSR7ZGlyZWN0aW9ufSR7ZGlzYWJsZWQgPyBcIiBpcy1kaXNhYmxlZFwiIDogXCJcIn1gLFxuXHRcdFx0YXR0cjogeyBcImFyaWEtbGFiZWxcIjogZGlyZWN0aW9uID09PSBcImxlZnRcIiA/IFwi5LiK5LiA6aG1XCIgOiBcIuS4i+S4gOmhtVwiIH0sXG5cdFx0fSk7XG5cdFx0c2V0SWNvbihidXR0b25FbCwgZGlyZWN0aW9uID09PSBcImxlZnRcIiA/IFwiY2hldnJvbi1sZWZ0XCIgOiBcImNoZXZyb24tcmlnaHRcIik7XG5cdFx0YnV0dG9uRWwuZGlzYWJsZWQgPSBkaXNhYmxlZDtcblx0XHRidXR0b25FbC5vbmNsaWNrID0gb25DbGljaztcblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyUnVsZUNhcmQoXG5cdFx0cnVsZUdyaWRFbDogSFRNTEVsZW1lbnQsXG5cdFx0cnVsZTogRm9sZGVyRGVmYXVsdFJ1bGUsXG5cdFx0cnVsZUluZGV4OiBudW1iZXIsXG5cdFx0Zm9sZGVyczogc3RyaW5nW10sXG5cdCkge1xuXHRcdGNvbnN0IHJ1bGVDYXJkID0gcnVsZUdyaWRFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1ydWxlLWNhcmRcIiB9KTtcblx0XHRjb25zdCB0b3BSb3cgPSBydWxlQ2FyZC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1ydWxlLXRvcC1yb3dcIiB9KTtcblx0XHR0b3BSb3cuY3JlYXRlU3Bhbih7XG5cdFx0XHRjbHM6IFwiYXV0by1mcm9udG1hdHRlci1ydWxlLXRpdGxlXCIsXG5cdFx0XHR0ZXh0OiBg6KeE5YiZICR7cnVsZUluZGV4ICsgMX1gLFxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgZGVsZXRlQnV0dG9uID0gdG9wUm93LmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcblx0XHRcdGNsczogXCJhdXRvLWZyb250bWF0dGVyLXJ1bGUtZGVsZXRlXCIsXG5cdFx0XHRhdHRyOiB7IFwiYXJpYS1sYWJlbFwiOiBcIuWIoOmZpOinhOWImVwiIH0sXG5cdFx0fSk7XG5cdFx0c2V0SWNvbihkZWxldGVCdXR0b24sIFwidHJhc2gtMlwiKTtcblx0XHRkZWxldGVCdXR0b24ub25jbGljayA9IGFzeW5jICgpID0+IHtcblx0XHRcdGlmICghdGhpcy5wbHVnaW4uZW5zdXJlRGV2aWNlQm91bmQoKSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5mb2xkZXJEZWZhdWx0cy5zcGxpY2UocnVsZUluZGV4LCAxKTtcblx0XHRcdGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdFx0Y29uc3QgcGFnZUNvdW50ID0gTWF0aC5tYXgoMSwgTWF0aC5jZWlsKHRoaXMucGx1Z2luLnNldHRpbmdzLmZvbGRlckRlZmF1bHRzLmxlbmd0aCAvIFJVTEVTX1BFUl9QQUdFKSk7XG5cdFx0XHR0aGlzLmN1cnJlbnRSdWxlUGFnZSA9IGNsYW1wKHRoaXMuY3VycmVudFJ1bGVQYWdlLCAwLCBwYWdlQ291bnQgLSAxKTtcblx0XHRcdHRoaXMuZGlzcGxheSgpO1xuXHRcdH07XG5cblx0XHRjb25zdCBmb2xkZXJSb3dFbCA9IHJ1bGVDYXJkLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLXJ1bGUtZm9sZGVyLXJvd1wiIH0pO1xuXHRcdGZvbGRlclJvd0VsLmNyZWF0ZVNwYW4oeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1ydWxlLWZvbGRlci1pY29uXCIsIHRleHQ6IFwi8J+TgVwiIH0pO1xuXHRcdHRoaXMucmVuZGVyUnVsZUlubGluZUZvbGRlckVkaXRvcihmb2xkZXJSb3dFbCwgcnVsZSwgZm9sZGVycyk7XG5cblx0XHRjb25zdCB2YWx1ZVJvd0VsID0gcnVsZUNhcmQuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItcnVsZS12YWx1ZS1yb3dcIiB9KTtcblx0XHR0aGlzLnJlbmRlclJ1bGVJbmxpbmVGaWVsZEVkaXRvcih2YWx1ZVJvd0VsLCBydWxlKTtcblx0XHR2YWx1ZVJvd0VsLmNyZWF0ZVNwYW4oeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1ydWxlLWFycm93XCIsIHRleHQ6IFwi4oaSXCIgfSk7XG5cdFx0dGhpcy5yZW5kZXJSdWxlSW5saW5lVmFsdWVFZGl0b3IodmFsdWVSb3dFbCwgcnVsZSk7XG5cblx0XHRjb25zdCBhdWRpdEVsID0gcnVsZUNhcmQuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItcnVsZS1hdWRpdFwiIH0pO1xuXHRcdGlmICghcnVsZS5jcmVhdGVkQnkgfHwgIXJ1bGUuY3JlYXRlZEF0KSB7XG5cdFx0XHRhdWRpdEVsLnNldFRleHQoXCLliJvlu7rkv6Hmga/kuI3lj6/ov73muq9cIik7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGF1ZGl0RWwuY3JlYXRlRGl2KHsgdGV4dDogYOeUsSAke3J1bGUuY3JlYXRlZEJ5fWAgfSk7XG5cdFx0XHRhdWRpdEVsLmNyZWF0ZURpdih7IHRleHQ6IGZvcm1hdEF1ZGl0VGltZShydWxlLmNyZWF0ZWRBdCkgfSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJSdWxlSW5saW5lRm9sZGVyRWRpdG9yKFxuXHRcdGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCxcblx0XHRydWxlOiBGb2xkZXJEZWZhdWx0UnVsZSxcblx0XHRmb2xkZXJzOiBzdHJpbmdbXSxcblx0KSB7XG5cdFx0dGhpcy5jcmVhdGVJbmxpbmVSdWxlVmFyaWFibGUoY29udGFpbmVyRWwsIGZvcm1hdFJ1bGVJbmxpbmVWYWx1ZShydWxlLmZvbGRlciksIChzcGFuRWwpID0+IHtcblx0XHRcdHRoaXMub3BlbklubGluZVJ1bGVTZWxlY3RFZGl0b3IoXG5cdFx0XHRcdHNwYW5FbCxcblx0XHRcdFx0cnVsZSxcblx0XHRcdFx0cnVsZS5mb2xkZXIsXG5cdFx0XHRcdGZvbGRlcnMubWFwKChmb2xkZXIpID0+ICh7XG5cdFx0XHRcdFx0dmFsdWU6IGZvbGRlcixcblx0XHRcdFx0XHRsYWJlbDogZm9ybWF0Rm9sZGVyT3B0aW9uTGFiZWwoZm9sZGVyKSxcblx0XHRcdFx0fSkpLFxuXHRcdFx0XHRhc3luYyAodmFsdWUpID0+IHtcblx0XHRcdFx0XHRydWxlLmZvbGRlciA9IHZhbHVlO1xuXHRcdFx0XHR9LFxuXHRcdFx0KTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyUnVsZUlubGluZUZpZWxkRWRpdG9yKGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCwgcnVsZTogRm9sZGVyRGVmYXVsdFJ1bGUpIHtcblx0XHR0aGlzLmNyZWF0ZUlubGluZVJ1bGVWYXJpYWJsZShjb250YWluZXJFbCwgZm9ybWF0UnVsZUlubGluZVZhbHVlKHJ1bGUuZmllbGQpLCAoc3BhbkVsKSA9PiB7XG5cdFx0XHR0aGlzLm9wZW5JbmxpbmVSdWxlU2VsZWN0RWRpdG9yKFxuXHRcdFx0XHRzcGFuRWwsXG5cdFx0XHRcdHJ1bGUsXG5cdFx0XHRcdHJ1bGUuZmllbGQsXG5cdFx0XHRcdEZPTERFUl9ERUZBVUxUX0ZJRUxEUy5tYXAoKGZpZWxkKSA9PiAoeyB2YWx1ZTogZmllbGQsIGxhYmVsOiBmaWVsZCB9KSksXG5cdFx0XHRcdGFzeW5jICh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdHJ1bGUuZmllbGQgPSB2YWx1ZSBhcyBGb2xkZXJEZWZhdWx0RmllbGQ7XG5cdFx0XHRcdFx0cnVsZS52YWx1ZSA9IFwiXCI7XG5cdFx0XHRcdH0sXG5cdFx0XHQpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJSdWxlSW5saW5lVmFsdWVFZGl0b3IoY29udGFpbmVyRWw6IEhUTUxFbGVtZW50LCBydWxlOiBGb2xkZXJEZWZhdWx0UnVsZSkge1xuXHRcdHRoaXMuY3JlYXRlSW5saW5lUnVsZVZhcmlhYmxlKGNvbnRhaW5lckVsLCBmb3JtYXRSdWxlSW5saW5lVmFsdWUocnVsZS52YWx1ZSksIChzcGFuRWwpID0+IHtcblx0XHRcdGNvbnN0IGNhbmRpZGF0ZXMgPSBnZXRGcm9udG1hdHRlckZpZWxkQ2FuZGlkYXRlcyh0aGlzLmFwcCwgcnVsZS5maWVsZCk7XG5cdFx0XHRjb25zdCB2YWx1ZXMgPVxuXHRcdFx0XHRydWxlLnZhbHVlICYmICFjYW5kaWRhdGVzLmluY2x1ZGVzKHJ1bGUudmFsdWUpID8gWy4uLmNhbmRpZGF0ZXMsIHJ1bGUudmFsdWVdIDogY2FuZGlkYXRlcztcblx0XHRcdHRoaXMub3BlbklubGluZVJ1bGVTZWxlY3RFZGl0b3IoXG5cdFx0XHRcdHNwYW5FbCxcblx0XHRcdFx0cnVsZSxcblx0XHRcdFx0cnVsZS52YWx1ZSxcblx0XHRcdFx0W1xuXHRcdFx0XHRcdC4uLnZhbHVlcy5tYXAoKHZhbHVlKSA9PiAoeyB2YWx1ZSwgbGFiZWw6IHZhbHVlIH0pKSxcblx0XHRcdFx0XHR7IHZhbHVlOiBcIl9fbmV3X19cIiwgbGFiZWw6IFwi6Ieq5a6a5LmJXCIgfSxcblx0XHRcdFx0XSxcblx0XHRcdFx0YXN5bmMgKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0aWYgKHZhbHVlID09PSBcIl9fbmV3X19cIikge1xuXHRcdFx0XHRcdFx0dGhpcy5vcGVuSW5saW5lUnVsZUlucHV0RWRpdG9yKHNwYW5FbCwgcnVsZSwgcnVsZS52YWx1ZSwgYXN5bmMgKG5leHRWYWx1ZSkgPT4ge1xuXHRcdFx0XHRcdFx0XHRydWxlLnZhbHVlID0gbmV4dFZhbHVlO1xuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHRyZXR1cm4gXCJkZWZlclwiO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRydWxlLnZhbHVlID0gdmFsdWU7XG5cdFx0XHRcdH0sXG5cdFx0XHQpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVJbmxpbmVSdWxlVmFyaWFibGUoXG5cdFx0Y29udGFpbmVyRWw6IEhUTUxFbGVtZW50LFxuXHRcdHRleHQ6IHN0cmluZyxcblx0XHRvbkNsaWNrOiAoc3BhbkVsOiBIVE1MU3BhbkVsZW1lbnQpID0+IHZvaWQsXG5cdCkge1xuXHRcdGNvbnN0IHNwYW5FbCA9IGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwic3BhblwiLCB7XG5cdFx0XHRjbHM6IFwiYXV0by1mcm9udG1hdHRlci1ydWxlLWlubGluZS12YWx1ZVwiLFxuXHRcdFx0dGV4dCxcblx0XHR9KTtcblx0XHRzcGFuRWwudGFiSW5kZXggPSAwO1xuXHRcdHNwYW5FbC5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKGV2ZW50KSA9PiB7XG5cdFx0XHRldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdG9uQ2xpY2soc3BhbkVsKTtcblx0XHR9KTtcblx0XHRzcGFuRWwuYWRkRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwgKGV2ZW50KSA9PiB7XG5cdFx0XHRpZiAoZXZlbnQua2V5ID09PSBcIkVudGVyXCIgfHwgZXZlbnQua2V5ID09PSBcIiBcIikge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRvbkNsaWNrKHNwYW5FbCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIG9wZW5JbmxpbmVSdWxlU2VsZWN0RWRpdG9yKFxuXHRcdGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCxcblx0XHRydWxlOiBGb2xkZXJEZWZhdWx0UnVsZSxcblx0XHRjdXJyZW50VmFsdWU6IHN0cmluZyxcblx0XHRvcHRpb25zOiBBcnJheTx7IHZhbHVlOiBzdHJpbmc7IGxhYmVsOiBzdHJpbmcgfT4sXG5cdFx0b25Db21taXQ6ICh2YWx1ZTogc3RyaW5nKSA9PiBQcm9taXNlPHZvaWQgfCBcImRlZmVyXCI+LFxuXHQpIHtcblx0XHR0aGlzLmNsb3NlQWN0aXZlSW5saW5lRWRpdG9yKCk7XG5cdFx0Y29uc3Qgb3ZlcmxheUVsID0gY29udGFpbmVyRWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItcnVsZS1pbmxpbmUtZWRpdG9yXCIgfSk7XG5cdFx0Y29uc3Qgc2VsZWN0RWwgPSBvdmVybGF5RWwuY3JlYXRlRWwoXCJzZWxlY3RcIiwge1xuXHRcdFx0Y2xzOiBcImRyb3Bkb3duIGF1dG8tZnJvbnRtYXR0ZXItcnVsZS1pbmxpbmUtc2VsZWN0XCIsXG5cdFx0fSk7XG5cdFx0Zm9yIChjb25zdCBvcHRpb24gb2Ygb3B0aW9ucykge1xuXHRcdFx0Y29uc3Qgb3B0aW9uRWwgPSBzZWxlY3RFbC5jcmVhdGVFbChcIm9wdGlvblwiLCB7XG5cdFx0XHRcdHZhbHVlOiBvcHRpb24udmFsdWUsXG5cdFx0XHRcdHRleHQ6IG9wdGlvbi5sYWJlbCxcblx0XHRcdH0pO1xuXHRcdFx0aWYgKG9wdGlvbi52YWx1ZSA9PT0gXCJfX25ld19fXCIpIHtcblx0XHRcdFx0b3B0aW9uRWwuc2VsZWN0ZWQgPSBjdXJyZW50VmFsdWUubGVuZ3RoID09PSAwO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAoY3VycmVudFZhbHVlICYmIG9wdGlvbnMuc29tZSgob3B0aW9uKSA9PiBvcHRpb24udmFsdWUgPT09IGN1cnJlbnRWYWx1ZSkpIHtcblx0XHRcdHNlbGVjdEVsLnZhbHVlID0gY3VycmVudFZhbHVlO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNsb3NlRHJvcGRvd24gPSB0aGlzLmNyZWF0ZUlubGluZURyb3Bkb3duQ2xvc2VyKG92ZXJsYXlFbCk7XG5cblx0XHRzZWxlY3RFbC5hZGRFdmVudExpc3RlbmVyKFwiY2hhbmdlXCIsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IHNlbGVjdGVkVmFsdWUgPSBzZWxlY3RFbC52YWx1ZTtcblx0XHRcdGNsb3NlRHJvcGRvd24oKTtcblx0XHRcdGlmIChzZWxlY3RlZFZhbHVlID09PSBcIl9fbmV3X19cIikge1xuXHRcdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCBvbkNvbW1pdChzZWxlY3RlZFZhbHVlKTtcblx0XHRcdFx0aWYgKHJlc3VsdCAhPT0gXCJkZWZlclwiKSB7XG5cdFx0XHRcdFx0Y2xvc2VEcm9wZG93bigpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGF3YWl0IHRoaXMuc2F2ZUlubGluZVJ1bGVDaGFuZ2UocnVsZSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRhd2FpdCBvbkNvbW1pdChzZWxlY3RlZFZhbHVlKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHRcdHNlbGVjdEVsLmFkZEV2ZW50TGlzdGVuZXIoXCJibHVyXCIsICgpID0+IHtcblx0XHRcdHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdFx0Y2xvc2VEcm9wZG93bigpO1xuXHRcdFx0fSwgMTAwKTtcblx0XHR9KTtcblxuXHRcdHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdHNlbGVjdEVsLmZvY3VzKCk7XG5cdFx0XHRjb25zdCBwaWNrZXJFbCA9IHNlbGVjdEVsIGFzIEhUTUxTZWxlY3RFbGVtZW50ICYgeyBzaG93UGlja2VyPzogKCkgPT4gdm9pZCB9O1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0aWYgKHBpY2tlckVsLnNob3dQaWNrZXIpIHtcblx0XHRcdFx0XHRwaWNrZXJFbC5zaG93UGlja2VyKCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0c2VsZWN0RWwuY2xpY2soKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBjYXRjaCAoX2Vycm9yKSB7XG5cdFx0XHRcdHNlbGVjdEVsLmNsaWNrKCk7XG5cdFx0XHR9XG5cdFx0fSwgMCk7XG5cdH1cblxuXHRwcml2YXRlIG9wZW5JbmxpbmVSdWxlSW5wdXRFZGl0b3IoXG5cdFx0Y29udGFpbmVyRWw6IEhUTUxFbGVtZW50LFxuXHRcdHJ1bGU6IEZvbGRlckRlZmF1bHRSdWxlLFxuXHRcdGN1cnJlbnRWYWx1ZTogc3RyaW5nLFxuXHRcdG9uQ29tbWl0OiAodmFsdWU6IHN0cmluZykgPT4gUHJvbWlzZTx2b2lkPixcblx0KSB7XG5cdFx0dGhpcy5jbG9zZUFjdGl2ZUlubGluZUVkaXRvcigpO1xuXHRcdGNvbnN0IG92ZXJsYXlFbCA9IGNvbnRhaW5lckVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLXJ1bGUtaW5saW5lLWVkaXRvclwiIH0pO1xuXHRcdGNvbnN0IGlucHV0RWwgPSBvdmVybGF5RWwuY3JlYXRlRWwoXCJpbnB1dFwiLCB7XG5cdFx0XHRjbHM6IFwiYXV0by1mcm9udG1hdHRlci1ydWxlLWlubGluZS1pbnB1dFwiLFxuXHRcdFx0dHlwZTogXCJ0ZXh0XCIsXG5cdFx0XHR2YWx1ZTogY3VycmVudFZhbHVlLFxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgY2xvc2VEcm9wZG93biA9IHRoaXMuY3JlYXRlSW5saW5lRHJvcGRvd25DbG9zZXIob3ZlcmxheUVsKTtcblx0XHRjb25zdCBmaW5hbGl6ZSA9IGFzeW5jICgpID0+IHtcblx0XHRcdGlmIChjbG9zZURyb3Bkb3duKCkpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5zYXZlSW5saW5lUnVsZUNoYW5nZShydWxlLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0YXdhaXQgb25Db21taXQoaW5wdXRFbC52YWx1ZSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRpbnB1dEVsLmFkZEV2ZW50TGlzdGVuZXIoXCJibHVyXCIsICgpID0+IHtcblx0XHRcdHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdFx0dm9pZCBjbG9zZURyb3Bkb3duKCk7XG5cdFx0XHR9LCAxMDApO1xuXHRcdH0pO1xuXHRcdGlucHV0RWwuYWRkRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwgKGV2ZW50KSA9PiB7XG5cdFx0XHRpZiAoZXZlbnQua2V5ID09PSBcIkVudGVyXCIpIHtcblx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0dm9pZCBmaW5hbGl6ZSgpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGV2ZW50LmtleSA9PT0gXCJFc2NhcGVcIikge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRjbG9zZURyb3Bkb3duKCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHR3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHRpbnB1dEVsLmZvY3VzKCk7XG5cdFx0XHRpbnB1dEVsLnNlbGVjdCgpO1xuXHRcdH0sIDApO1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVJbmxpbmVEcm9wZG93bkNsb3NlcihvdmVybGF5RWw6IEhUTUxFbGVtZW50KSB7XG5cdFx0bGV0IGNsb3NlZCA9IGZhbHNlO1xuXHRcdGNvbnN0IGNsb3NlRHJvcGRvd24gPSAoKSA9PiB7XG5cdFx0XHRpZiAoY2xvc2VkKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGNsb3NlZCA9IHRydWU7XG5cdFx0XHRvdmVybGF5RWwucXVlcnlTZWxlY3RvckFsbChcInNlbGVjdCwgaW5wdXRcIikuZm9yRWFjaCgoZWwpID0+IGVsLnJlbW92ZSgpKTtcblx0XHRcdGlmIChvdmVybGF5RWwuaXNDb25uZWN0ZWQpIHtcblx0XHRcdFx0b3ZlcmxheUVsLnJlbW92ZSgpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHRoaXMuYWN0aXZlSW5saW5lRWRpdG9yQ2xlYW51cCA9PT0gY2xvc2VEcm9wZG93bikge1xuXHRcdFx0XHR0aGlzLmFjdGl2ZUlubGluZUVkaXRvckNsZWFudXAgPSBudWxsO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fTtcblx0XHR0aGlzLmFjdGl2ZUlubGluZUVkaXRvckNsZWFudXAgPSBjbG9zZURyb3Bkb3duO1xuXHRcdHJldHVybiBjbG9zZURyb3Bkb3duO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBzYXZlSW5saW5lUnVsZUNoYW5nZShydWxlOiBGb2xkZXJEZWZhdWx0UnVsZSwgdXBkYXRlOiAoKSA9PiBQcm9taXNlPHZvaWQ+KSB7XG5cdFx0aWYgKCF0aGlzLnBsdWdpbi5lbnN1cmVEZXZpY2VCb3VuZCgpKSB7XG5cdFx0XHR0aGlzLmRpc3BsYXkoKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0YXdhaXQgdXBkYXRlKCk7XG5cdFx0dGhpcy5wbHVnaW4udG91Y2hGb2xkZXJSdWxlKHJ1bGUpO1xuXHRcdGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdHRoaXMuZGlzcGxheSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBjbG9zZUFjdGl2ZUlubGluZUVkaXRvcigpIHtcblx0XHR0aGlzLmFjdGl2ZUlubGluZUVkaXRvckNsZWFudXA/LigpO1xuXHRcdHRoaXMuYWN0aXZlSW5saW5lRWRpdG9yQ2xlYW51cCA9IG51bGw7XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlclVubWF0Y2hlZEZvbGRlclNlY3Rpb24oY29udGFpbmVyRWw6IEhUTUxFbGVtZW50KSB7XG5cdFx0Y29uc3Qgc2VjdGlvbkVsID0gY29udGFpbmVyRWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItdW5tYXRjaGVkLXNlY3Rpb25cIiB9KTtcblx0XHRjb25zdCBoZWFkZXJFbCA9IHNlY3Rpb25FbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci11bm1hdGNoZWQtaGVhZGVyXCIgfSk7XG5cdFx0aGVhZGVyRWwuY3JlYXRlRWwoXCJoM1wiLCB7IHRleHQ6IFwi5peg5Yy56YWN6KeE5YiZ55qE5paH5Lu25aS5XCIgfSk7XG5cdFx0Y29uc3QgYWN0aW9uRWwgPSBoZWFkZXJFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci11bm1hdGNoZWQtYWN0aW9uXCIgfSk7XG5cdFx0bmV3IFNldHRpbmcoYWN0aW9uRWwpLmFkZEJ1dHRvbigoYnV0dG9uKSA9PiB7XG5cdFx0XHRidXR0b25cblx0XHRcdFx0LnNldEJ1dHRvblRleHQodGhpcy5pc1NjYW5uaW5nVW5tYXRjaGVkRm9sZGVycyA/IFwi5omr5o+P5LitLi4uXCIgOiBcIuaJq+aPj1wiKVxuXHRcdFx0XHQuc2V0RGlzYWJsZWQodGhpcy5pc1NjYW5uaW5nVW5tYXRjaGVkRm9sZGVycylcblx0XHRcdFx0Lm9uQ2xpY2soYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMuc2NhblVubWF0Y2hlZEZvbGRlcnMoKTtcblx0XHRcdFx0fSk7XG5cdFx0fSk7XG5cdFx0c2VjdGlvbkVsLmNyZWF0ZUVsKFwicFwiLCB7XG5cdFx0XHRjbHM6IFwiYXV0by1mcm9udG1hdHRlci11bm1hdGNoZWQtc3VidGl0bGVcIixcblx0XHRcdHRleHQ6IFwi5Lul5LiL5paH5Lu25aS55bCa5pyq6K6+572u5Lu75L2V5bGe5oCn5Yy56YWN6KeE5YiZ44CCXCIsXG5cdFx0fSk7XG5cblx0XHRjb25zdCByZXN1bHRFbCA9IHNlY3Rpb25FbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci11bm1hdGNoZWQtcmVzdWx0c1wiIH0pO1xuXHRcdGlmICghdGhpcy5oYXNTY2FubmVkVW5tYXRjaGVkRm9sZGVycykge1xuXHRcdFx0cmVzdWx0RWwuY3JlYXRlRGl2KHtcblx0XHRcdFx0Y2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItdW5tYXRjaGVkLWVtcHR5XCIsXG5cdFx0XHRcdHRleHQ6IFwi54K55Ye75omr5o+P5p+l55yL5pyq6YWN572u55qE5paH5Lu25aS544CCXCIsXG5cdFx0XHR9KTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAodGhpcy51bm1hdGNoZWRGb2xkZXJzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmVzdWx0RWwuY3JlYXRlRGl2KHtcblx0XHRcdFx0Y2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItdW5tYXRjaGVkLWVtcHR5XCIsXG5cdFx0XHRcdHRleHQ6IFwi5omA5pyJ5paH5Lu25aS55Z2H5bey6YWN572u6KeE5YiZ44CCXCIsXG5cdFx0XHR9KTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBsaXN0RWwgPSByZXN1bHRFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci11bm1hdGNoZWQtbGlzdFwiIH0pO1xuXHRcdGZvciAoY29uc3QgZm9sZGVyIG9mIHRoaXMudW5tYXRjaGVkRm9sZGVycykge1xuXHRcdFx0Y29uc3QgaXRlbUVsID0gbGlzdEVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLXVubWF0Y2hlZC1pdGVtXCIgfSk7XG5cdFx0XHRjb25zdCBjb250ZW50RWwgPSBpdGVtRWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItdW5tYXRjaGVkLWNvbnRlbnRcIiB9KTtcblx0XHRcdGNvbnRlbnRFbC5jcmVhdGVEaXYoe1xuXHRcdFx0XHRjbHM6IFwiYXV0by1mcm9udG1hdHRlci11bm1hdGNoZWQtcGF0aFwiLFxuXHRcdFx0XHR0ZXh0OiBmb2xkZXIucGF0aCxcblx0XHRcdH0pO1xuXHRcdFx0Y29udGVudEVsLmNyZWF0ZURpdih7XG5cdFx0XHRcdGNsczogZm9sZGVyLmluaGVyaXRlZFJ1bGVzLmxlbmd0aFxuXHRcdFx0XHRcdD8gXCJhdXRvLWZyb250bWF0dGVyLXVubWF0Y2hlZC1oaW50IGlzLWluaGVyaXRlZFwiXG5cdFx0XHRcdFx0OiBcImF1dG8tZnJvbnRtYXR0ZXItdW5tYXRjaGVkLWhpbnQgaXMtZW1wdHlcIixcblx0XHRcdFx0dGV4dDpcblx0XHRcdFx0XHRmb2xkZXIuaW5oZXJpdGVkUnVsZXMubGVuZ3RoID4gMFxuXHRcdFx0XHRcdFx0PyBg4oaRIOeItue6p+inhOWIme+8miR7Zm9sZGVyLmluaGVyaXRlZFJ1bGVzXG5cdFx0XHRcdFx0XHRcdFx0Lm1hcCgocnVsZSkgPT4gYCR7cnVsZS5mb2xkZXJ9IOKGkiAke3J1bGUuZmllbGR9OiAke3J1bGUudmFsdWV9YClcblx0XHRcdFx0XHRcdFx0XHQuam9pbihcIu+8jFwiKX1gXG5cdFx0XHRcdFx0XHQ6IFwi5peg5Lu75L2V54i257qn6KeE5YiZXCIsXG5cdFx0XHR9KTtcblxuXHRcdFx0Y29uc3QgYnV0dG9uRWwgPSBpdGVtRWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItdW5tYXRjaGVkLWJ1dHRvblwiIH0pO1xuXHRcdFx0bmV3IFNldHRpbmcoYnV0dG9uRWwpLmFkZEJ1dHRvbigoYnV0dG9uKSA9PiB7XG5cdFx0XHRcdGJ1dHRvbi5zZXRCdXR0b25UZXh0KFwi6K6+572uXCIpLm9uQ2xpY2soKCkgPT4ge1xuXHRcdFx0XHRcdG5ldyBGb2xkZXJSdWxlTW9kYWwodGhpcy5hcHAsIHRoaXMucGx1Z2luLCBmb2xkZXIucGF0aCkub3BlbigpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyU2NhblNlY3Rpb24oY29udGFpbmVyRWw6IEhUTUxFbGVtZW50KSB7XG5cdFx0Y29udGFpbmVyRWwuY3JlYXRlRWwoXCJoMlwiLCB7IHRleHQ6IFwi5omr5o+P5LuT5bqTXCIgfSk7XG5cblx0XHRuZXcgU2V0dGluZyhjb250YWluZXJFbClcblx0XHRcdC5zZXROYW1lKFwi5omr5o+P5LuT5bqTXCIpXG5cdFx0XHQuc2V0RGVzYyhcIuaJvuWHuumcgOimgeihpeWFqOWxnuaAp+eahCBNYXJrZG93biDmlofku7bjgIJcIilcblx0XHRcdC5hZGRCdXR0b24oKGJ1dHRvbikgPT4ge1xuXHRcdFx0XHRidXR0b25cblx0XHRcdFx0XHQuc2V0QnV0dG9uVGV4dCh0aGlzLmlzU2Nhbm5pbmcgPyBcIuaJq+aPj+S4rS4uLlwiIDogXCLmiavmj49cIilcblx0XHRcdFx0XHQuc2V0RGlzYWJsZWQodGhpcy5pc1NjYW5uaW5nIHx8IHRoaXMuaXNFeGVjdXRpbmcpXG5cdFx0XHRcdFx0Lm9uQ2xpY2soYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdFx0aWYgKCF0aGlzLnBsdWdpbi5lbnN1cmVEZXZpY2VCb3VuZCgpKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMuc2NhblZhdWx0KCk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblxuXHRcdGlmICghdGhpcy5oYXNTY2FubmVkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVzdWx0RWwgPSBjb250YWluZXJFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1zY2FuLXJlc3VsdHNcIiB9KTtcblx0XHRpZiAodGhpcy5zY2FuUmVzdWx0cy5sZW5ndGggPT09IDApIHtcblx0XHRcdHJlc3VsdEVsLmNyZWF0ZURpdih7XG5cdFx0XHRcdGNsczogXCJhdXRvLWZyb250bWF0dGVyLXNjYW4tZW1wdHlcIixcblx0XHRcdFx0dGV4dDogXCLmiYDmnInmlofku7blnYflt7LljIXlkKvlsZ7mgKcg4pyTXCIsXG5cdFx0XHR9KTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRyZXN1bHRFbC5jcmVhdGVEaXYoe1xuXHRcdFx0Y2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItc2Nhbi1jb3VudFwiLFxuXHRcdFx0dGV4dDogYOWFseWPkeeOsCAke3RoaXMuc2NhblJlc3VsdHMubGVuZ3RofSDkuKrmlofku7bpnIDopoHooaXlhajlsZ7mgKdgLFxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgbGlzdEVsID0gcmVzdWx0RWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItc2Nhbi1saXN0XCIgfSk7XG5cdFx0Zm9yIChjb25zdCByZXN1bHQgb2YgdGhpcy5zY2FuUmVzdWx0cykge1xuXHRcdFx0Y29uc3QgaXRlbUVsID0gbGlzdEVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLXNjYW4taXRlbVwiIH0pO1xuXHRcdFx0Y29uc3QgdGl0bGUgPSByZXN1bHQuZG9uZSA/IGAke3Jlc3VsdC5maWxlLm5hbWV9IOKck2AgOiByZXN1bHQuZmlsZS5uYW1lO1xuXHRcdFx0Y29uc3QgdGl0bGVFbCA9IGl0ZW1FbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1zY2FuLW5hbWVcIiwgdGV4dDogdGl0bGUgfSk7XG5cdFx0XHR0aXRsZUVsLmNyZWF0ZVNwYW4oe1xuXHRcdFx0XHRjbHM6IFwiYXV0by1mcm9udG1hdHRlci1zY2FuLW1pc3NpbmdcIixcblx0XHRcdFx0dGV4dDogYCAke2Zvcm1hdFNjYW5SZWFzb24ocmVzdWx0KX1gLFxuXHRcdFx0fSk7XG5cdFx0XHRpdGVtRWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItc2Nhbi1wYXRoXCIsIHRleHQ6IHJlc3VsdC5maWxlLnBhdGggfSk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc3RhdHVzVGV4dCA9XG5cdFx0XHR0aGlzLnByb2Nlc3NlZENvdW50ID09PSB0aGlzLnNjYW5SZXN1bHRzLmxlbmd0aCAmJiAhdGhpcy5pc0V4ZWN1dGluZ1xuXHRcdFx0XHQ/IGDlrozmiJDvvIzlt7LlpITnkIYgJHt0aGlzLnByb2Nlc3NlZENvdW50fSDkuKrmlofku7ZgXG5cdFx0XHRcdDogXCJcIjtcblxuXHRcdG5ldyBTZXR0aW5nKHJlc3VsdEVsKVxuXHRcdFx0LnNldERlc2Moc3RhdHVzVGV4dClcblx0XHRcdC5hZGRCdXR0b24oKGJ1dHRvbikgPT4ge1xuXHRcdFx0XHRidXR0b25cblx0XHRcdFx0XHQuc2V0QnV0dG9uVGV4dCh0aGlzLmlzRXhlY3V0aW5nID8gXCLmiafooYzkuK0uLi5cIiA6IFwi5omn6KGMXCIpXG5cdFx0XHRcdFx0LnNldEN0YSgpXG5cdFx0XHRcdFx0LnNldERpc2FibGVkKHRoaXMuaXNFeGVjdXRpbmcpXG5cdFx0XHRcdFx0Lm9uQ2xpY2soYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdFx0aWYgKCF0aGlzLnBsdWdpbi5lbnN1cmVEZXZpY2VCb3VuZCgpKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMuZXhlY3V0ZVNjYW5SZXN1bHRzKCk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgc2NhblZhdWx0KCkge1xuXHRcdHRoaXMuaXNTY2FubmluZyA9IHRydWU7XG5cdFx0dGhpcy5oYXNTY2FubmVkID0gdHJ1ZTtcblx0XHR0aGlzLnNjYW5SZXN1bHRzID0gW107XG5cdFx0dGhpcy5wcm9jZXNzZWRDb3VudCA9IDA7XG5cdFx0dGhpcy5kaXNwbGF5KCk7XG5cblx0XHRjb25zdCByZXN1bHRzOiBTY2FuUmVzdWx0W10gPSBbXTtcblx0XHRjb25zdCBmaWxlcyA9IHRoaXMuYXBwLnZhdWx0LmdldE1hcmtkb3duRmlsZXMoKTtcblxuXHRcdGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCBmaWxlcy5sZW5ndGg7IGluZGV4KyspIHtcblx0XHRcdGNvbnN0IGZpbGUgPSBmaWxlc1tpbmRleF07XG5cdFx0XHRjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQuY2FjaGVkUmVhZChmaWxlKTtcblx0XHRcdGNvbnN0IGRlZmF1bHRzID0gdGhpcy5wbHVnaW4uZ2V0Rm9sZGVyRGVmYXVsdFZhbHVlcyhmaWxlKTtcblx0XHRcdGNvbnN0IHN0YXR1cyA9IGdldEZyb250bWF0dGVyU3RhdHVzKGNvbnRlbnQsIGRlZmF1bHRzKTtcblx0XHRcdGlmIChcblx0XHRcdFx0c3RhdHVzLm1pc3NpbmdGaWVsZHMubGVuZ3RoID4gMCB8fFxuXHRcdFx0XHRzdGF0dXMub3JkZXJOZWVkc0ZpeCB8fFxuXHRcdFx0XHRzdGF0dXMucmVuYW1lRmllbGRzLmxlbmd0aCA+IDAgfHxcblx0XHRcdFx0c3RhdHVzLmRlZmF1bHRGaWVsZHMubGVuZ3RoID4gMFxuXHRcdFx0KSB7XG5cdFx0XHRcdHJlc3VsdHMucHVzaCh7XG5cdFx0XHRcdFx0ZmlsZSxcblx0XHRcdFx0XHRtaXNzaW5nRmllbGRzOiBzdGF0dXMubWlzc2luZ0ZpZWxkcyxcblx0XHRcdFx0XHRvcmRlck5lZWRzRml4OiBzdGF0dXMub3JkZXJOZWVkc0ZpeCxcblx0XHRcdFx0XHRyZW5hbWVGaWVsZHM6IHN0YXR1cy5yZW5hbWVGaWVsZHMsXG5cdFx0XHRcdFx0ZGVmYXVsdEZpZWxkczogc3RhdHVzLmRlZmF1bHRGaWVsZHMsXG5cdFx0XHRcdFx0ZG9uZTogZmFsc2UsXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoaW5kZXggJSAyNSA9PT0gMjQpIHtcblx0XHRcdFx0YXdhaXQgeWllbGRUb1VpKCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5zY2FuUmVzdWx0cyA9IHJlc3VsdHM7XG5cdFx0dGhpcy5pc1NjYW5uaW5nID0gZmFsc2U7XG5cdFx0dGhpcy5kaXNwbGF5KCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHNjYW5Vbm1hdGNoZWRGb2xkZXJzKCkge1xuXHRcdHRoaXMuaGFzU2Nhbm5lZFVubWF0Y2hlZEZvbGRlcnMgPSB0cnVlO1xuXHRcdHRoaXMuaXNTY2FubmluZ1VubWF0Y2hlZEZvbGRlcnMgPSB0cnVlO1xuXHRcdHRoaXMudW5tYXRjaGVkRm9sZGVycyA9IFtdO1xuXHRcdHRoaXMuZGlzcGxheSgpO1xuXG5cdFx0Y29uc3QgZm9sZGVycyA9IGdldFZhdWx0Rm9sZGVycyh0aGlzLmFwcCkuZmlsdGVyKChmb2xkZXIpID0+IHNob3VsZEluY2x1ZGVSdWxlRm9sZGVyKGZvbGRlcikpO1xuXHRcdGNvbnN0IGRpcmVjdFJ1bGVGb2xkZXJzID0gbmV3IFNldChcblx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLmZvbGRlckRlZmF1bHRzXG5cdFx0XHRcdC5tYXAoKHJ1bGUpID0+IHJ1bGUuZm9sZGVyKVxuXHRcdFx0XHQuZmlsdGVyKChmb2xkZXIpID0+IHNob3VsZEluY2x1ZGVSdWxlRm9sZGVyKGZvbGRlcikpLFxuXHRcdCk7XG5cblx0XHR0aGlzLnVubWF0Y2hlZEZvbGRlcnMgPSBmb2xkZXJzXG5cdFx0XHQuZmlsdGVyKChmb2xkZXIpID0+ICFkaXJlY3RSdWxlRm9sZGVycy5oYXMoZm9sZGVyKSlcblx0XHRcdC5tYXAoKGZvbGRlcikgPT4gKHtcblx0XHRcdFx0cGF0aDogZm9sZGVyLFxuXHRcdFx0XHRpbmhlcml0ZWRSdWxlczogZ2V0QW5jZXN0b3JSdWxlcyhmb2xkZXIsIHRoaXMucGx1Z2luLnNldHRpbmdzLmZvbGRlckRlZmF1bHRzKSxcblx0XHRcdH0pKVxuXHRcdFx0LnNvcnQoKGEsIGIpID0+IGEucGF0aC5sb2NhbGVDb21wYXJlKGIucGF0aCkpO1xuXG5cdFx0dGhpcy5pc1NjYW5uaW5nVW5tYXRjaGVkRm9sZGVycyA9IGZhbHNlO1xuXHRcdHRoaXMuZGlzcGxheSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBleGVjdXRlU2NhblJlc3VsdHMoKSB7XG5cdFx0dGhpcy5pc0V4ZWN1dGluZyA9IHRydWU7XG5cdFx0dGhpcy5wcm9jZXNzZWRDb3VudCA9IDA7XG5cdFx0dGhpcy5kaXNwbGF5KCk7XG5cblx0XHRmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgdGhpcy5zY2FuUmVzdWx0cy5sZW5ndGg7IGluZGV4KyspIHtcblx0XHRcdGNvbnN0IHJlc3VsdCA9IHRoaXMuc2NhblJlc3VsdHNbaW5kZXhdO1xuXHRcdFx0Y29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQocmVzdWx0LmZpbGUpO1xuXHRcdFx0Y29uc3QgZGVmYXVsdHMgPSB0aGlzLnBsdWdpbi5nZXRGb2xkZXJEZWZhdWx0VmFsdWVzKHJlc3VsdC5maWxlKTtcblx0XHRcdGNvbnN0IHN0YXR1cyA9IGdldEZyb250bWF0dGVyU3RhdHVzKGNvbnRlbnQsIGRlZmF1bHRzKTtcblx0XHRcdGNvbnN0IG5leHQgPSBidWlsZENvbnRlbnRXaXRoT3JkZXJlZEZpZWxkcyhcblx0XHRcdFx0Y29udGVudCxcblx0XHRcdFx0cmVzdWx0LmZpbGUsXG5cdFx0XHRcdHN0YXR1cyxcblx0XHRcdFx0XCJcIixcblx0XHRcdFx0ZGVmYXVsdHMsXG5cdFx0XHRcdHRoaXMucGx1Z2luLmJ1aWxkRnJvbnRtYXR0ZXIuYmluZCh0aGlzLnBsdWdpbiksXG5cdFx0XHQpO1xuXHRcdFx0aWYgKG5leHQgIT09IG51bGwpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5hcHAudmF1bHQubW9kaWZ5KHJlc3VsdC5maWxlLCBuZXh0KTtcblx0XHRcdH1cblxuXHRcdFx0cmVzdWx0Lm1pc3NpbmdGaWVsZHMgPSBzdGF0dXMubWlzc2luZ0ZpZWxkcztcblx0XHRcdHJlc3VsdC5vcmRlck5lZWRzRml4ID0gc3RhdHVzLm9yZGVyTmVlZHNGaXg7XG5cdFx0XHRyZXN1bHQucmVuYW1lRmllbGRzID0gc3RhdHVzLnJlbmFtZUZpZWxkcztcblx0XHRcdHJlc3VsdC5kZWZhdWx0RmllbGRzID0gc3RhdHVzLmRlZmF1bHRGaWVsZHM7XG5cdFx0XHRyZXN1bHQuZG9uZSA9IHRydWU7XG5cdFx0XHR0aGlzLnByb2Nlc3NlZENvdW50Kys7XG5cblx0XHRcdGlmIChpbmRleCAlIDEwID09PSA5IHx8IGluZGV4ID09PSB0aGlzLnNjYW5SZXN1bHRzLmxlbmd0aCAtIDEpIHtcblx0XHRcdFx0dGhpcy5kaXNwbGF5KCk7XG5cdFx0XHRcdGF3YWl0IHlpZWxkVG9VaSgpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuaXNFeGVjdXRpbmcgPSBmYWxzZTtcblx0XHR0aGlzLmRpc3BsYXkoKTtcblx0fVxufVxuXG5pbnRlcmZhY2UgU2NhblJlc3VsdCB7XG5cdGZpbGU6IFRGaWxlO1xuXHRtaXNzaW5nRmllbGRzOiBSZXF1aXJlZEZpZWxkW107XG5cdG9yZGVyTmVlZHNGaXg6IGJvb2xlYW47XG5cdHJlbmFtZUZpZWxkczogTGVnYWN5UmVuYW1lW107XG5cdGRlZmF1bHRGaWVsZHM6IEZvbGRlckRlZmF1bHRGaWVsZFtdO1xuXHRkb25lOiBib29sZWFuO1xufVxuXG5pbnRlcmZhY2UgVW5tYXRjaGVkRm9sZGVyUmVzdWx0IHtcblx0cGF0aDogc3RyaW5nO1xuXHRpbmhlcml0ZWRSdWxlczogRm9sZGVyRGVmYXVsdFJ1bGVbXTtcbn1cblxuaW50ZXJmYWNlIEFJU3VtbWFyeUNhbmRpZGF0ZSB7XG5cdGZpbGU6IFRGaWxlO1xuXHRjb250ZW50OiBzdHJpbmc7XG5cdGRvY3VtZW50OiBTdW1tYXJ5RG9jdW1lbnQ7XG5cdGRvbmU/OiBib29sZWFuO1xufVxuXG5pbnRlcmZhY2UgQUlTdW1tYXJ5VGFza1VpU3RhdGUge1xuXHRyZXN1bHRzOiBBSVN1bW1hcnlDYW5kaWRhdGVbXTtcblx0aGFzU2Nhbm5lZDogYm9vbGVhbjtcblx0aXNTY2FubmluZzogYm9vbGVhbjtcblx0aXNFeGVjdXRpbmc6IGJvb2xlYW47XG5cdHByb2Nlc3NlZENvdW50OiBudW1iZXI7XG59XG5cbmludGVyZmFjZSBDaGF0Q29tcGxldGlvblJlc3BvbnNlIHtcblx0ZXJyb3I/OiB7XG5cdFx0bWVzc2FnZT86IHN0cmluZztcblx0fTtcblx0Y2hvaWNlcz86IEFycmF5PHtcblx0XHRcdG1lc3NhZ2U/OiB7XG5cdFx0XHRcdGNvbnRlbnQ/OiBzdHJpbmc7XG5cdFx0XHRcdHJlYXNvbmluZ19jb250ZW50Pzogc3RyaW5nO1xuXHRcdFx0XHRyZWFzb25pbmc/OiBzdHJpbmc7XG5cdFx0XHR9O1xuXHRcdH0+O1xuXHR9XG5cbmludGVyZmFjZSBGcm9udG1hdHRlclN0YXR1cyB7XG5cdG1pc3NpbmdGaWVsZHM6IFJlcXVpcmVkRmllbGRbXTtcblx0b3JkZXJOZWVkc0ZpeDogYm9vbGVhbjtcblx0cmVuYW1lRmllbGRzOiBMZWdhY3lSZW5hbWVbXTtcblx0ZGVmYXVsdEZpZWxkczogRm9sZGVyRGVmYXVsdEZpZWxkW107XG59XG5cbmludGVyZmFjZSBGcm9udG1hdHRlckJsb2NrIHtcblx0a2V5OiBzdHJpbmcgfCBudWxsO1xuXHRsaW5lczogc3RyaW5nW107XG59XG5cbmludGVyZmFjZSBMZWdhY3lSZW5hbWUge1xuXHRmcm9tOiBMZWdhY3lGaWVsZDtcblx0dG86IFJlcXVpcmVkRmllbGQ7XG59XG5cbmZ1bmN0aW9uIGhhc0Zyb250bWF0dGVyKGNvbnRlbnQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRyZXR1cm4gY29udGVudC5zdGFydHNXaXRoKFwiLS0tXCIpO1xufVxuXG5mdW5jdGlvbiBnZXRGcm9udG1hdHRlclN0YXR1cyhjb250ZW50OiBzdHJpbmcsIGRlZmF1bHRzOiBGb2xkZXJEZWZhdWx0VmFsdWVzID0ge30pOiBGcm9udG1hdHRlclN0YXR1cyB7XG5cdGNvbnN0IGZyb250bWF0dGVyID0gcGFyc2VGcm9udG1hdHRlcihjb250ZW50KTtcblx0aWYgKGZyb250bWF0dGVyID09PSBudWxsKSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdG1pc3NpbmdGaWVsZHM6IFsuLi5SRVFVSVJFRF9GSUVMRFNdLFxuXHRcdFx0b3JkZXJOZWVkc0ZpeDogZmFsc2UsXG5cdFx0XHRyZW5hbWVGaWVsZHM6IFtdLFxuXHRcdFx0ZGVmYXVsdEZpZWxkczogW10sXG5cdFx0fTtcblx0fVxuXG5cdGNvbnN0IGJsb2NrcyA9IHBhcnNlRnJvbnRtYXR0ZXJCbG9ja3MoZnJvbnRtYXR0ZXIuYm9keSk7XG5cdGNvbnN0IHJlbmFtZUZpZWxkcyA9IGdldExlZ2FjeVJlbmFtZXMoYmxvY2tzKTtcblx0Y29uc3QgbWlncmF0ZWRCbG9ja3MgPSBtaWdyYXRlTGVnYWN5QmxvY2tzKGJsb2Nrcyk7XG5cdGNvbnN0IG1pc3NpbmdGaWVsZHMgPSBSRVFVSVJFRF9GSUVMRFMuZmlsdGVyKChmaWVsZCkgPT4gIWhhc0Zyb250bWF0dGVyQmxvY2sobWlncmF0ZWRCbG9ja3MsIGZpZWxkKSk7XG5cdGNvbnN0IGRlZmF1bHRGaWVsZHMgPSBGT0xERVJfREVGQVVMVF9GSUVMRFMuZmlsdGVyKChmaWVsZCkgPT4ge1xuXHRcdHJldHVybiBkZWZhdWx0c1tmaWVsZF0gIT09IHVuZGVmaW5lZCAmJiBmcm9udG1hdHRlckZpZWxkSXNFbXB0eShtaWdyYXRlZEJsb2NrcywgZmllbGQpO1xuXHR9KTtcblx0cmV0dXJuIHtcblx0XHRtaXNzaW5nRmllbGRzLFxuXHRcdG9yZGVyTmVlZHNGaXg6ICFyZXF1aXJlZEZpZWxkc0FyZUluUmVsYXRpdmVPcmRlcihtaWdyYXRlZEJsb2NrcyksXG5cdFx0cmVuYW1lRmllbGRzLFxuXHRcdGRlZmF1bHRGaWVsZHMsXG5cdH07XG59XG5cbmZ1bmN0aW9uIGJ1aWxkQ29udGVudFdpdGhPcmRlcmVkRmllbGRzKFxuXHRjb250ZW50OiBzdHJpbmcsXG5cdGZpbGU6IFRGaWxlLFxuXHRzdGF0dXM6IEZyb250bWF0dGVyU3RhdHVzLFxuXHRhdXRob3JOYW1lOiBzdHJpbmcsXG5cdGRlZmF1bHRzOiBGb2xkZXJEZWZhdWx0VmFsdWVzLFxuXHRidWlsZEZ1bGxGcm9udG1hdHRlcjogKGNyZWF0ZWQ6IHN0cmluZywgZGVmYXVsdHM/OiBGb2xkZXJEZWZhdWx0VmFsdWVzKSA9PiBzdHJpbmcsXG4pOiBzdHJpbmcgfCBudWxsIHtcblx0aWYgKFxuXHRcdHN0YXR1cy5taXNzaW5nRmllbGRzLmxlbmd0aCA9PT0gMCAmJlxuXHRcdCFzdGF0dXMub3JkZXJOZWVkc0ZpeCAmJlxuXHRcdHN0YXR1cy5yZW5hbWVGaWVsZHMubGVuZ3RoID09PSAwICYmXG5cdFx0c3RhdHVzLmRlZmF1bHRGaWVsZHMubGVuZ3RoID09PSAwXG5cdCkge1xuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0Y29uc3QgY3JlYXRlZCA9IGZvcm1hdExvY2FsRGF0ZShuZXcgRGF0ZShmaWxlLnN0YXQuY3RpbWUpKTtcblx0Y29uc3QgZnJvbnRtYXR0ZXIgPSBwYXJzZUZyb250bWF0dGVyKGNvbnRlbnQpO1xuXHRpZiAoZnJvbnRtYXR0ZXIgPT09IG51bGwpIHtcblx0XHRyZXR1cm4gYnVpbGRGdWxsRnJvbnRtYXR0ZXIoY3JlYXRlZCwgZGVmYXVsdHMpICsgY29udGVudDtcblx0fVxuXG5cdGNvbnN0IG1pZ3JhdGVkQm9keSA9IG1pZ3JhdGVMZWdhY3lGcm9udG1hdHRlckJvZHkoZnJvbnRtYXR0ZXIuYm9keSk7XG5cdGNvbnN0IGJvZHkgPSBzdGF0dXMub3JkZXJOZWVkc0ZpeFxuXHRcdD8gYnVpbGRSZW9yZGVyZWRGcm9udG1hdHRlckJvZHkobWlncmF0ZWRCb2R5LCBjcmVhdGVkLCBhdXRob3JOYW1lLCBkZWZhdWx0cylcblx0XHQ6IGJ1aWxkRnJvbnRtYXR0ZXJCb2R5V2l0aE1pc3NpbmdGaWVsZHMoXG5cdFx0XHRcdG1pZ3JhdGVkQm9keSxcblx0XHRcdFx0c3RhdHVzLm1pc3NpbmdGaWVsZHMsXG5cdFx0XHRcdHN0YXR1cy5kZWZhdWx0RmllbGRzLFxuXHRcdFx0XHRjcmVhdGVkLFxuXHRcdFx0XHRhdXRob3JOYW1lLFxuXHRcdFx0XHRkZWZhdWx0cyxcblx0XHRcdCk7XG5cdGNvbnN0IHN1ZmZpeCA9IGNvbnRlbnQuc2xpY2UoZnJvbnRtYXR0ZXIuZW5kKTtcblx0Y29uc3Qgc2VwYXJhdG9yID0gc3VmZml4LnN0YXJ0c1dpdGgoXCJcXG5cIikgPyBcIlwiIDogXCJcXG5cIjtcblx0cmV0dXJuIGAtLS1cXG4ke2JvZHl9JHtzZXBhcmF0b3J9JHtzdWZmaXh9YDtcbn1cblxuZnVuY3Rpb24gYnVpbGRGcm9udG1hdHRlckJvZHlXaXRoTWlzc2luZ0ZpZWxkcyhcblx0ZnJvbnRtYXR0ZXJCb2R5OiBzdHJpbmcsXG5cdG1pc3NpbmdGaWVsZHM6IFJlcXVpcmVkRmllbGRbXSxcblx0ZGVmYXVsdEZpZWxkczogRm9sZGVyRGVmYXVsdEZpZWxkW10sXG5cdGZpbGVDcmVhdGVkOiBzdHJpbmcsXG5cdGF1dGhvck5hbWU6IHN0cmluZyxcblx0ZGVmYXVsdHM6IEZvbGRlckRlZmF1bHRWYWx1ZXMsXG4pOiBzdHJpbmcge1xuXHRjb25zdCBibG9ja3MgPSBwYXJzZUZyb250bWF0dGVyQmxvY2tzKGZyb250bWF0dGVyQm9keSk7XG5cdGNvbnN0IGxpbmVzOiBzdHJpbmdbXSA9IFtdO1xuXHRjb25zdCBpbnNlcnRlZCA9IG5ldyBTZXQ8UmVxdWlyZWRGaWVsZD4oKTtcblx0Y29uc3QgY3JlYXRlZEZvclVwZGF0ZWQgPSBnZXRFeGlzdGluZ0NyZWF0ZWRWYWx1ZShibG9ja3MpID8/IGZpbGVDcmVhdGVkO1xuXG5cdGZvciAoY29uc3QgYmxvY2sgb2YgYmxvY2tzKSB7XG5cdFx0aWYgKGlzUmVxdWlyZWRGaWVsZChibG9jay5rZXkpKSB7XG5cdFx0XHRmb3IgKGNvbnN0IGZpZWxkIG9mIG1pc3NpbmdGaWVsZHMpIHtcblx0XHRcdFx0aWYgKCFpbnNlcnRlZC5oYXMoZmllbGQpICYmIGdldFJlcXVpcmVkRmllbGRJbmRleChmaWVsZCkgPCBnZXRSZXF1aXJlZEZpZWxkSW5kZXgoYmxvY2sua2V5KSkge1xuXHRcdFx0XHRcdGNvbnN0IGNyZWF0ZWQgPSBmaWVsZCA9PT0gXCLmnIDlkI7mm7TmlrBcIiA/IGNyZWF0ZWRGb3JVcGRhdGVkIDogZmlsZUNyZWF0ZWQ7XG5cdFx0XHRcdFx0bGluZXMucHVzaCguLi5idWlsZFJlcXVpcmVkRmllbGRMaW5lcyhmaWVsZCwgdW5kZWZpbmVkLCBjcmVhdGVkLCBhdXRob3JOYW1lLCBkZWZhdWx0cykpO1xuXHRcdFx0XHRcdGluc2VydGVkLmFkZChmaWVsZCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRsaW5lcy5wdXNoKC4uLmJ1aWxkQmxvY2tMaW5lc1dpdGhEZWZhdWx0KGJsb2NrLCBkZWZhdWx0RmllbGRzLCBkZWZhdWx0cykpO1xuXHR9XG5cblx0Zm9yIChjb25zdCBmaWVsZCBvZiBtaXNzaW5nRmllbGRzKSB7XG5cdFx0aWYgKCFpbnNlcnRlZC5oYXMoZmllbGQpKSB7XG5cdFx0XHRjb25zdCBjcmVhdGVkID0gZmllbGQgPT09IFwi5pyA5ZCO5pu05pawXCIgPyBjcmVhdGVkRm9yVXBkYXRlZCA6IGZpbGVDcmVhdGVkO1xuXHRcdFx0bGluZXMucHVzaCguLi5idWlsZFJlcXVpcmVkRmllbGRMaW5lcyhmaWVsZCwgdW5kZWZpbmVkLCBjcmVhdGVkLCBhdXRob3JOYW1lLCBkZWZhdWx0cykpO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiBsaW5lcy5qb2luKFwiXFxuXCIpO1xufVxuXG5mdW5jdGlvbiBnZXRFeGlzdGluZ0NyZWF0ZWRWYWx1ZShibG9ja3M6IEZyb250bWF0dGVyQmxvY2tbXSk6IHN0cmluZyB8IG51bGwge1xuXHRmb3IgKGNvbnN0IGJsb2NrIG9mIGJsb2Nrcykge1xuXHRcdGlmIChibG9jay5rZXkgPT09IFwi5Yib5bu65pe26Ze0XCIpIHtcblx0XHRcdHJldHVybiBnZXRCbG9ja1NjYWxhcihibG9jayk7XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIGJ1aWxkQmxvY2tMaW5lc1dpdGhEZWZhdWx0KFxuXHRibG9jazogRnJvbnRtYXR0ZXJCbG9jayxcblx0ZGVmYXVsdEZpZWxkczogRm9sZGVyRGVmYXVsdEZpZWxkW10sXG5cdGRlZmF1bHRzOiBGb2xkZXJEZWZhdWx0VmFsdWVzLFxuKTogc3RyaW5nW10ge1xuXHRpZiAoYmxvY2sua2V5ID09PSBcIumhueebrlwiICYmIGRlZmF1bHRGaWVsZHMuaW5jbHVkZXMoXCLpobnnm65cIikpIHtcblx0XHRyZXR1cm4gW2Zvcm1hdFNjYWxhckZpZWxkKFwi6aG555uuXCIsIGRlZmF1bHRzW1wi6aG555uuXCJdID8/IFwiXCIpXTtcblx0fVxuXHRpZiAoYmxvY2sua2V5ID09PSBcIuexu+Wei1wiICYmIGRlZmF1bHRGaWVsZHMuaW5jbHVkZXMoXCLnsbvlnotcIikpIHtcblx0XHRyZXR1cm4gW1wi57G75Z6LOlwiLCAuLi5mb3JtYXRMaXN0VmFsdWUodW5kZWZpbmVkLCBkZWZhdWx0c1tcIuexu+Wei1wiXSA/PyBcIlwiKV07XG5cdH1cblx0cmV0dXJuIGJsb2NrLmxpbmVzO1xufVxuXG5mdW5jdGlvbiBmaWxsRW1wdHlGb2xkZXJEZWZhdWx0cyhjb250ZW50OiBzdHJpbmcsIGRlZmF1bHRzOiBGb2xkZXJEZWZhdWx0VmFsdWVzKTogc3RyaW5nIHwgbnVsbCB7XG5cdGNvbnN0IGZyb250bWF0dGVyID0gcGFyc2VGcm9udG1hdHRlcihjb250ZW50KTtcblx0aWYgKGZyb250bWF0dGVyID09PSBudWxsKSB7XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRjb25zdCBib2R5ID0gbWlncmF0ZUxlZ2FjeUZyb250bWF0dGVyQm9keShmcm9udG1hdHRlci5ib2R5KTtcblx0Y29uc3QgYmxvY2tzID0gcGFyc2VGcm9udG1hdHRlckJsb2Nrcyhib2R5KTtcblx0Y29uc3QgZGVmYXVsdEZpZWxkcyA9IEZPTERFUl9ERUZBVUxUX0ZJRUxEUy5maWx0ZXIoKGZpZWxkKSA9PiB7XG5cdFx0cmV0dXJuIGRlZmF1bHRzW2ZpZWxkXSAhPT0gdW5kZWZpbmVkICYmIGZyb250bWF0dGVyRmllbGRJc0VtcHR5KGJsb2NrcywgZmllbGQpO1xuXHR9KTtcblx0aWYgKGRlZmF1bHRGaWVsZHMubGVuZ3RoID09PSAwKSB7XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRjb25zdCBsaW5lcyA9IGJsb2Nrcy5mbGF0TWFwKChibG9jaykgPT4gYnVpbGRCbG9ja0xpbmVzV2l0aERlZmF1bHQoYmxvY2ssIGRlZmF1bHRGaWVsZHMsIGRlZmF1bHRzKSk7XG5cdGNvbnN0IHN1ZmZpeCA9IGNvbnRlbnQuc2xpY2UoZnJvbnRtYXR0ZXIuZW5kKTtcblx0Y29uc3Qgc2VwYXJhdG9yID0gc3VmZml4LnN0YXJ0c1dpdGgoXCJcXG5cIikgPyBcIlwiIDogXCJcXG5cIjtcblx0cmV0dXJuIGAtLS1cXG4ke2xpbmVzLmpvaW4oXCJcXG5cIil9JHtzZXBhcmF0b3J9JHtzdWZmaXh9YDtcbn1cblxuZnVuY3Rpb24gZnJvbnRtYXR0ZXJGaWVsZElzRW1wdHkoYmxvY2tzOiBGcm9udG1hdHRlckJsb2NrW10sIGZpZWxkOiBGb2xkZXJEZWZhdWx0RmllbGQpOiBib29sZWFuIHtcblx0Y29uc3QgYmxvY2sgPSBibG9ja3MuZmluZCgoaXRlbSkgPT4gaXRlbS5rZXkgPT09IGZpZWxkKTtcblx0aWYgKCFibG9jaykge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdGlmIChmaWVsZCA9PT0gXCLpobnnm65cIikge1xuXHRcdHJldHVybiBnZXRCbG9ja1NjYWxhcihibG9jaykgPT09IG51bGw7XG5cdH1cblxuXHRjb25zdCBsaXN0VmFsdWVzID0gZ2V0QmxvY2tMaXN0VmFsdWVzKGJsb2NrKTtcblx0aWYgKGxpc3RWYWx1ZXMubGVuZ3RoID4gMCkge1xuXHRcdHJldHVybiBsaXN0VmFsdWVzLmV2ZXJ5KCh2YWx1ZSkgPT4gdmFsdWUubGVuZ3RoID09PSAwKTtcblx0fVxuXG5cdHJldHVybiBnZXRCbG9ja1NjYWxhcihibG9jaykgPT09IG51bGw7XG59XG5cbmZ1bmN0aW9uIGJ1aWxkUmVvcmRlcmVkRnJvbnRtYXR0ZXJCb2R5KFxuXHRmcm9udG1hdHRlckJvZHk6IHN0cmluZyxcblx0ZmlsZUNyZWF0ZWQ6IHN0cmluZyxcblx0YXV0aG9yTmFtZTogc3RyaW5nLFxuXHRkZWZhdWx0czogRm9sZGVyRGVmYXVsdFZhbHVlcyxcbik6IHN0cmluZyB7XG5cdGNvbnN0IGJsb2NrcyA9IHBhcnNlRnJvbnRtYXR0ZXJCbG9ja3MoZnJvbnRtYXR0ZXJCb2R5KTtcblx0Y29uc3QgcmVxdWlyZWRCbG9ja3MgPSBuZXcgTWFwPFJlcXVpcmVkRmllbGQsIEZyb250bWF0dGVyQmxvY2s+KCk7XG5cdGNvbnN0IGN1c3RvbUJsb2NrczogRnJvbnRtYXR0ZXJCbG9ja1tdID0gW107XG5cblx0Zm9yIChjb25zdCBibG9jayBvZiBibG9ja3MpIHtcblx0XHRpZiAoaXNSZXF1aXJlZEZpZWxkKGJsb2NrLmtleSkpIHtcblx0XHRcdGlmICghcmVxdWlyZWRCbG9ja3MuaGFzKGJsb2NrLmtleSkpIHtcblx0XHRcdFx0cmVxdWlyZWRCbG9ja3Muc2V0KGJsb2NrLmtleSwgYmxvY2spO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y3VzdG9tQmxvY2tzLnB1c2goYmxvY2spO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSBpZiAoYmxvY2subGluZXMubGVuZ3RoID4gMCkge1xuXHRcdFx0Y3VzdG9tQmxvY2tzLnB1c2goYmxvY2spO1xuXHRcdH1cblx0fVxuXG5cdGNvbnN0IGV4aXN0aW5nQ3JlYXRlZCA9IGdldEJsb2NrU2NhbGFyKHJlcXVpcmVkQmxvY2tzLmdldChcIuWIm+W7uuaXtumXtFwiKSk7XG5cdGNvbnN0IGNyZWF0ZWQgPSBleGlzdGluZ0NyZWF0ZWQgfHwgZmlsZUNyZWF0ZWQ7XG5cdGNvbnN0IGxpbmVzOiBzdHJpbmdbXSA9IFtdO1xuXG5cdGxpbmVzLnB1c2goLi4uYnVpbGRSZXF1aXJlZEZpZWxkTGluZXMoXCLpobnnm65cIiwgcmVxdWlyZWRCbG9ja3MuZ2V0KFwi6aG555uuXCIpLCBmaWxlQ3JlYXRlZCwgYXV0aG9yTmFtZSwgZGVmYXVsdHMpKTtcblx0bGluZXMucHVzaCguLi5idWlsZFJlcXVpcmVkRmllbGRMaW5lcyhcIuexu+Wei1wiLCByZXF1aXJlZEJsb2Nrcy5nZXQoXCLnsbvlnotcIiksIGZpbGVDcmVhdGVkLCBhdXRob3JOYW1lLCBkZWZhdWx0cykpO1xuXHRsaW5lcy5wdXNoKC4uLmN1c3RvbUJsb2Nrcy5mbGF0TWFwKChibG9jaykgPT4gYmxvY2subGluZXMpKTtcblx0bGluZXMucHVzaCguLi5idWlsZFJlcXVpcmVkRmllbGRMaW5lcyhcIuS9nOiAhVwiLCByZXF1aXJlZEJsb2Nrcy5nZXQoXCLkvZzogIVcIiksIGZpbGVDcmVhdGVkLCBhdXRob3JOYW1lLCBkZWZhdWx0cykpO1xuXHRsaW5lcy5wdXNoKC4uLmJ1aWxkUmVxdWlyZWRGaWVsZExpbmVzKFwi5pGY6KaBXCIsIHJlcXVpcmVkQmxvY2tzLmdldChcIuaRmOimgVwiKSwgZmlsZUNyZWF0ZWQsIGF1dGhvck5hbWUsIGRlZmF1bHRzKSk7XG5cdGxpbmVzLnB1c2goLi4uYnVpbGRSZXF1aXJlZEZpZWxkTGluZXMoXCLliJvlu7rml7bpl7RcIiwgcmVxdWlyZWRCbG9ja3MuZ2V0KFwi5Yib5bu65pe26Ze0XCIpLCBmaWxlQ3JlYXRlZCwgYXV0aG9yTmFtZSwgZGVmYXVsdHMpKTtcblx0bGluZXMucHVzaCguLi5idWlsZFJlcXVpcmVkRmllbGRMaW5lcyhcIuacgOWQjuabtOaWsFwiLCByZXF1aXJlZEJsb2Nrcy5nZXQoXCLmnIDlkI7mm7TmlrBcIiksIGNyZWF0ZWQsIGF1dGhvck5hbWUsIGRlZmF1bHRzKSk7XG5cdHJldHVybiBsaW5lcy5qb2luKFwiXFxuXCIpO1xufVxuXG5mdW5jdGlvbiBidWlsZFJlcXVpcmVkRmllbGRMaW5lcyhcblx0ZmllbGQ6IFJlcXVpcmVkRmllbGQsXG5cdGJsb2NrOiBGcm9udG1hdHRlckJsb2NrIHwgdW5kZWZpbmVkLFxuXHRmaWxlQ3JlYXRlZDogc3RyaW5nLFxuXHRhdXRob3JOYW1lOiBzdHJpbmcsXG5cdGRlZmF1bHRzOiBGb2xkZXJEZWZhdWx0VmFsdWVzID0ge30sXG4pOiBzdHJpbmdbXSB7XG5cdGlmIChmaWVsZCA9PT0gXCLpobnnm65cIikge1xuXHRcdHJldHVybiBbZm9ybWF0U2NhbGFyRmllbGQoXCLpobnnm65cIiwgZ2V0QmxvY2tTY2FsYXIoYmxvY2spID8/IGRlZmF1bHRzW1wi6aG555uuXCJdID8/IFwiXCIpXTtcblx0fVxuXHRpZiAoZmllbGQgPT09IFwi57G75Z6LXCIpIHtcblx0XHRyZXR1cm4gW1wi57G75Z6LOlwiLCAuLi5mb3JtYXRMaXN0VmFsdWUoYmxvY2ssIGRlZmF1bHRzW1wi57G75Z6LXCJdID8/IFwiXCIpXTtcblx0fVxuXHRpZiAoZmllbGQgPT09IFwi5L2c6ICFXCIpIHtcblx0XHRyZXR1cm4gW1wi5L2c6ICFOlwiLCAuLi5mb3JtYXRMaXN0VmFsdWUoYmxvY2ssIGF1dGhvck5hbWUpXTtcblx0fVxuXHRpZiAoZmllbGQgPT09IFwi5pGY6KaBXCIpIHtcblx0XHRyZXR1cm4gW2Zvcm1hdFNjYWxhckZpZWxkKFwi5pGY6KaBXCIsIGdldEJsb2NrU2NhbGFyKGJsb2NrKSA/PyBcIlwiKV07XG5cdH1cblx0aWYgKGZpZWxkID09PSBcIuWIm+W7uuaXtumXtFwiKSB7XG5cdFx0cmV0dXJuIFtg5Yib5bu65pe26Ze0OiAke2dldEJsb2NrU2NhbGFyKGJsb2NrKSB8fCBmaWxlQ3JlYXRlZH1gXTtcblx0fVxuXHRyZXR1cm4gW2DmnIDlkI7mm7TmlrA6ICR7Z2V0QmxvY2tTY2FsYXIoYmxvY2spIHx8IGZpbGVDcmVhdGVkfWBdO1xufVxuXG5mdW5jdGlvbiBnZXRMZWdhY3lSZW5hbWVzKGJsb2NrczogRnJvbnRtYXR0ZXJCbG9ja1tdKTogTGVnYWN5UmVuYW1lW10ge1xuXHRjb25zdCByZW5hbWVzOiBMZWdhY3lSZW5hbWVbXSA9IFtdO1xuXHRmb3IgKGNvbnN0IGxlZ2FjeUZpZWxkIG9mIE9iamVjdC5rZXlzKExFR0FDWV9GSUVMRF9SRU5BTUVTKSBhcyBMZWdhY3lGaWVsZFtdKSB7XG5cdFx0aWYgKGhhc0FueUZyb250bWF0dGVyQmxvY2soYmxvY2tzLCBsZWdhY3lGaWVsZCkpIHtcblx0XHRcdHJlbmFtZXMucHVzaCh7XG5cdFx0XHRcdGZyb206IGxlZ2FjeUZpZWxkLFxuXHRcdFx0XHR0bzogTEVHQUNZX0ZJRUxEX1JFTkFNRVNbbGVnYWN5RmllbGRdLFxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cdHJldHVybiByZW5hbWVzO1xufVxuXG5mdW5jdGlvbiBtaWdyYXRlTGVnYWN5RnJvbnRtYXR0ZXJCb2R5KGZyb250bWF0dGVyQm9keTogc3RyaW5nKTogc3RyaW5nIHtcblx0cmV0dXJuIG1pZ3JhdGVMZWdhY3lCbG9ja3MocGFyc2VGcm9udG1hdHRlckJsb2Nrcyhmcm9udG1hdHRlckJvZHkpKVxuXHRcdC5mbGF0TWFwKChibG9jaykgPT4gYmxvY2subGluZXMpXG5cdFx0LmpvaW4oXCJcXG5cIik7XG59XG5cbmZ1bmN0aW9uIG1pZ3JhdGVMZWdhY3lCbG9ja3MoYmxvY2tzOiBGcm9udG1hdHRlckJsb2NrW10pOiBGcm9udG1hdHRlckJsb2NrW10ge1xuXHRjb25zdCBoYXNOZXdGaWVsZCA9IG5ldyBTZXQ8UmVxdWlyZWRGaWVsZD4oKTtcblx0Zm9yIChjb25zdCBibG9jayBvZiBibG9ja3MpIHtcblx0XHRpZiAoaXNSZXF1aXJlZEZpZWxkKGJsb2NrLmtleSkpIHtcblx0XHRcdGhhc05ld0ZpZWxkLmFkZChibG9jay5rZXkpO1xuXHRcdH1cblx0fVxuXG5cdGNvbnN0IG1pZ3JhdGVkOiBGcm9udG1hdHRlckJsb2NrW10gPSBbXTtcblx0Zm9yIChjb25zdCBibG9jayBvZiBibG9ja3MpIHtcblx0XHRpZiAoaXNMZWdhY3lGaWVsZChibG9jay5rZXkpKSB7XG5cdFx0XHRjb25zdCBuZXdLZXkgPSBMRUdBQ1lfRklFTERfUkVOQU1FU1tibG9jay5rZXldO1xuXHRcdFx0aWYgKGhhc05ld0ZpZWxkLmhhcyhuZXdLZXkpKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRoYXNOZXdGaWVsZC5hZGQobmV3S2V5KTtcblx0XHRcdG1pZ3JhdGVkLnB1c2goe1xuXHRcdFx0XHRrZXk6IG5ld0tleSxcblx0XHRcdFx0bGluZXM6IHJlbmFtZUJsb2NrRmlyc3RMaW5lKGJsb2NrLmxpbmVzLCBuZXdLZXkpLFxuXHRcdFx0fSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdG1pZ3JhdGVkLnB1c2goYmxvY2spO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiBtaWdyYXRlZDtcbn1cblxuZnVuY3Rpb24gcmVuYW1lQmxvY2tGaXJzdExpbmUobGluZXM6IHN0cmluZ1tdLCBrZXk6IFJlcXVpcmVkRmllbGQpOiBzdHJpbmdbXSB7XG5cdGlmIChsaW5lcy5sZW5ndGggPT09IDApIHtcblx0XHRyZXR1cm4gW107XG5cdH1cblxuXHRjb25zdCBjb2xvbiA9IGxpbmVzWzBdLmluZGV4T2YoXCI6XCIpO1xuXHRjb25zdCBmaXJzdExpbmUgPSBjb2xvbiA9PT0gLTEgPyBgJHtrZXl9OmAgOiBgJHtrZXl9JHtsaW5lc1swXS5zbGljZShjb2xvbil9YDtcblx0cmV0dXJuIFtmaXJzdExpbmUsIC4uLmxpbmVzLnNsaWNlKDEpXTtcbn1cblxuZnVuY3Rpb24gcGFyc2VGcm9udG1hdHRlckJsb2Nrcyhmcm9udG1hdHRlcjogc3RyaW5nKTogRnJvbnRtYXR0ZXJCbG9ja1tdIHtcblx0Y29uc3QgYmxvY2tzOiBGcm9udG1hdHRlckJsb2NrW10gPSBbXTtcblx0Y29uc3QgbGluZXMgPSBmcm9udG1hdHRlci5zcGxpdChcIlxcblwiKS5maWx0ZXIoKGxpbmUsIGluZGV4LCBhbGwpID0+IHtcblx0XHRyZXR1cm4gaW5kZXggPCBhbGwubGVuZ3RoIC0gMSB8fCBsaW5lLmxlbmd0aCA+IDA7XG5cdH0pO1xuXG5cdGZvciAoY29uc3QgbGluZSBvZiBsaW5lcykge1xuXHRcdGNvbnN0IGtleSA9IGdldFRvcExldmVsS2V5KGxpbmUpO1xuXHRcdGlmIChrZXkgIT09IG51bGwgfHwgYmxvY2tzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0YmxvY2tzLnB1c2goeyBrZXksIGxpbmVzOiBbbGluZV0gfSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGJsb2Nrc1tibG9ja3MubGVuZ3RoIC0gMV0ubGluZXMucHVzaChsaW5lKTtcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gYmxvY2tzO1xufVxuXG5mdW5jdGlvbiBnZXRUb3BMZXZlbEtleShsaW5lOiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcblx0aWYgKC9eXFxzLy50ZXN0KGxpbmUpKSB7XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRjb25zdCBtYXRjaCA9IC9eKFteOiNdW146XSopOi8uZXhlYyhsaW5lKTtcblx0cmV0dXJuIG1hdGNoID8gbWF0Y2hbMV0udHJpbSgpIDogbnVsbDtcbn1cblxuZnVuY3Rpb24gaGFzRnJvbnRtYXR0ZXJCbG9jayhibG9ja3M6IEZyb250bWF0dGVyQmxvY2tbXSwgZmllbGQ6IFJlcXVpcmVkRmllbGQpOiBib29sZWFuIHtcblx0cmV0dXJuIGJsb2Nrcy5zb21lKChibG9jaykgPT4gYmxvY2sua2V5ID09PSBmaWVsZCk7XG59XG5cbmZ1bmN0aW9uIGhhc0FueUZyb250bWF0dGVyQmxvY2soYmxvY2tzOiBGcm9udG1hdHRlckJsb2NrW10sIGZpZWxkOiBzdHJpbmcpOiBib29sZWFuIHtcblx0cmV0dXJuIGJsb2Nrcy5zb21lKChibG9jaykgPT4gYmxvY2sua2V5ID09PSBmaWVsZCk7XG59XG5cbmZ1bmN0aW9uIHJlcXVpcmVkRmllbGRzQXJlSW5SZWxhdGl2ZU9yZGVyKGJsb2NrczogRnJvbnRtYXR0ZXJCbG9ja1tdKTogYm9vbGVhbiB7XG5cdGxldCBsYXN0SW5kZXggPSAtMTtcblx0Zm9yIChjb25zdCBibG9jayBvZiBibG9ja3MpIHtcblx0XHRpZiAoIWlzUmVxdWlyZWRGaWVsZChibG9jay5rZXkpKSB7XG5cdFx0XHRjb250aW51ZTtcblx0XHR9XG5cblx0XHRjb25zdCBpbmRleCA9IGdldFJlcXVpcmVkRmllbGRJbmRleChibG9jay5rZXkpO1xuXHRcdGlmIChpbmRleCA8IGxhc3RJbmRleCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRsYXN0SW5kZXggPSBpbmRleDtcblx0fVxuXG5cdHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBnZXRSZXF1aXJlZEZpZWxkSW5kZXgoZmllbGQ6IFJlcXVpcmVkRmllbGQpOiBudW1iZXIge1xuXHRyZXR1cm4gUkVRVUlSRURfRklFTERTLmluZGV4T2YoZmllbGQpO1xufVxuXG5mdW5jdGlvbiBpc1JlcXVpcmVkRmllbGQoa2V5OiBzdHJpbmcgfCBudWxsKToga2V5IGlzIFJlcXVpcmVkRmllbGQge1xuXHRyZXR1cm4ga2V5ICE9PSBudWxsICYmIChSRVFVSVJFRF9GSUVMRFMgYXMgcmVhZG9ubHkgc3RyaW5nW10pLmluY2x1ZGVzKGtleSk7XG59XG5cbmZ1bmN0aW9uIGlzTGVnYWN5RmllbGQoa2V5OiBzdHJpbmcgfCBudWxsKToga2V5IGlzIExlZ2FjeUZpZWxkIHtcblx0cmV0dXJuIGtleSAhPT0gbnVsbCAmJiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoTEVHQUNZX0ZJRUxEX1JFTkFNRVMsIGtleSk7XG59XG5cbmZ1bmN0aW9uIGdldEJsb2NrU2NhbGFyKGJsb2NrOiBGcm9udG1hdHRlckJsb2NrIHwgdW5kZWZpbmVkKTogc3RyaW5nIHwgbnVsbCB7XG5cdGlmICghYmxvY2spIHtcblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdGNvbnN0IGZpcnN0TGluZSA9IGJsb2NrLmxpbmVzWzBdO1xuXHRjb25zdCBjb2xvbiA9IGZpcnN0TGluZS5pbmRleE9mKFwiOlwiKTtcblx0aWYgKGNvbG9uID09PSAtMSkge1xuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0Y29uc3QgdmFsdWUgPSBmaXJzdExpbmUuc2xpY2UoY29sb24gKyAxKS50cmltKCk7XG5cdHJldHVybiB2YWx1ZS5sZW5ndGggPiAwID8gdmFsdWUgOiBudWxsO1xufVxuXG5mdW5jdGlvbiBmb3JtYXRTY2FsYXJGaWVsZChmaWVsZDogUmVxdWlyZWRGaWVsZCwgdmFsdWU6IHN0cmluZyk6IHN0cmluZyB7XG5cdHJldHVybiB2YWx1ZSA/IGAke2ZpZWxkfTogJHt2YWx1ZX1gIDogYCR7ZmllbGR9OiBgO1xufVxuXG5mdW5jdGlvbiBmb3JtYXRMaXN0VmFsdWUoYmxvY2s6IEZyb250bWF0dGVyQmxvY2sgfCB1bmRlZmluZWQsIGRlZmF1bHRWYWx1ZTogc3RyaW5nKTogc3RyaW5nW10ge1xuXHRjb25zdCB2YWx1ZXMgPSBnZXRCbG9ja0xpc3RWYWx1ZXMoYmxvY2spO1xuXHRpZiAodmFsdWVzLmxlbmd0aCA+IDApIHtcblx0XHRyZXR1cm4gdmFsdWVzLm1hcCgodmFsdWUpID0+IGAgIC0gJHtmb3JtYXRZYW1sU2NhbGFyKHZhbHVlKX1gKTtcblx0fVxuXG5cdGNvbnN0IHNjYWxhciA9IGdldEJsb2NrU2NhbGFyKGJsb2NrKTtcblx0Y29uc3QgdmFsdWUgPSBzY2FsYXIgPz8gZGVmYXVsdFZhbHVlO1xuXHRyZXR1cm4gW2AgIC0gJHtmb3JtYXRZYW1sU2NhbGFyKHZhbHVlKX1gXTtcbn1cblxuZnVuY3Rpb24gZ2V0QmxvY2tMaXN0VmFsdWVzKGJsb2NrOiBGcm9udG1hdHRlckJsb2NrIHwgdW5kZWZpbmVkKTogc3RyaW5nW10ge1xuXHRpZiAoIWJsb2NrIHx8IGJsb2NrLmxpbmVzLmxlbmd0aCA8PSAxKSB7XG5cdFx0cmV0dXJuIFtdO1xuXHR9XG5cblx0Y29uc3QgdmFsdWVzOiBzdHJpbmdbXSA9IFtdO1xuXHRmb3IgKGNvbnN0IGxpbmUgb2YgYmxvY2subGluZXMuc2xpY2UoMSkpIHtcblx0XHRjb25zdCBtYXRjaCA9IC9eXFxzKi1cXHMqKC4qKSQvLmV4ZWMobGluZSk7XG5cdFx0aWYgKG1hdGNoKSB7XG5cdFx0XHR2YWx1ZXMucHVzaChtYXRjaFsxXS50cmltKCkpO1xuXHRcdH1cblx0fVxuXHRyZXR1cm4gdmFsdWVzO1xufVxuXG5mdW5jdGlvbiBwYXJzZUZyb250bWF0dGVyKGNvbnRlbnQ6IHN0cmluZyk6IHsgYm9keTogc3RyaW5nOyBlbmQ6IG51bWJlciB9IHwgbnVsbCB7XG5cdGlmICghY29udGVudC5zdGFydHNXaXRoKFwiLS0tXFxuXCIpKSB7XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRsZXQgbGluZVN0YXJ0ID0gNDtcblx0d2hpbGUgKGxpbmVTdGFydCA8PSBjb250ZW50Lmxlbmd0aCkge1xuXHRcdGNvbnN0IGxpbmVFbmQgPSBjb250ZW50LmluZGV4T2YoXCJcXG5cIiwgbGluZVN0YXJ0KTtcblx0XHRjb25zdCBsaW5lID0gY29udGVudC5zbGljZShsaW5lU3RhcnQsIGxpbmVFbmQgPT09IC0xID8gY29udGVudC5sZW5ndGggOiBsaW5lRW5kKTtcblx0XHRpZiAobGluZS50cmltKCkgPT09IFwiLS0tXCIpIHtcblx0XHRcdGNvbnN0IGVuZCA9IGxpbmVTdGFydCA9PT0gNCA/IDQgOiBsaW5lU3RhcnQgLSAxO1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0Ym9keTogY29udGVudC5zbGljZSg0LCBlbmQpLFxuXHRcdFx0XHRlbmQsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmIChsaW5lRW5kID09PSAtMSkge1xuXHRcdFx0YnJlYWs7XG5cdFx0fVxuXHRcdGxpbmVTdGFydCA9IGxpbmVFbmQgKyAxO1xuXHR9XG5cblx0cmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIGdldFN1bW1hcnlEb2N1bWVudChmaWxlOiBURmlsZSwgY29udGVudDogc3RyaW5nLCBtaW5Cb2R5TGVuZ3RoOiBudW1iZXIpOiBTdW1tYXJ5RG9jdW1lbnQgfCBudWxsIHtcblx0Y29uc3QgZnJvbnRtYXR0ZXIgPSBwYXJzZUZyb250bWF0dGVyKGNvbnRlbnQpO1xuXHRjb25zdCBib2R5ID0gZ2V0Qm9keVdpdGhvdXRGcm9udG1hdHRlcihjb250ZW50LCBmcm9udG1hdHRlcik7XG5cdGNvbnN0IHRyaW1tZWQgPSBib2R5LnRyaW0oKTtcblx0aWYgKHRyaW1tZWQubGVuZ3RoIDwgbWluQm9keUxlbmd0aCkge1xuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0cmV0dXJuIHtcblx0XHR0aXRsZTogZmlsZS5iYXNlbmFtZSxcblx0XHRmcm9udG1hdHRlcjogZnJvbnRtYXR0ZXI/LmJvZHkudHJpbSgpID8/IFwiXCIsXG5cdFx0Y29udGVudDogdHJpbW1lZC5zbGljZSgwLCBNQVhfU1VNTUFSWV9DT05URU5UX0xFTkdUSCksXG5cdH07XG59XG5cbmZ1bmN0aW9uIGdldEJvZHlXaXRob3V0RnJvbnRtYXR0ZXIoXG5cdGNvbnRlbnQ6IHN0cmluZyxcblx0ZnJvbnRtYXR0ZXI6IHsgYm9keTogc3RyaW5nOyBlbmQ6IG51bWJlciB9IHwgbnVsbCxcbik6IHN0cmluZyB7XG5cdGlmIChmcm9udG1hdHRlciA9PT0gbnVsbCkge1xuXHRcdHJldHVybiBjb250ZW50O1xuXHR9XG5cblx0cmV0dXJuIGNvbnRlbnQuc2xpY2UoZnJvbnRtYXR0ZXIuZW5kKS5yZXBsYWNlKC9eXFxuPy0tLVxcbj8vLCBcIlwiKTtcbn1cblxuZnVuY3Rpb24gd3JpdGVTdW1tYXJ5VG9Db250ZW50KFxuXHRjb250ZW50OiBzdHJpbmcsXG5cdGZpbGU6IFRGaWxlLFxuXHRzdW1tYXJ5OiBzdHJpbmcsXG5cdGRlZmF1bHRzOiBGb2xkZXJEZWZhdWx0VmFsdWVzLFxuXHRidWlsZEZ1bGxGcm9udG1hdHRlcjogKGNyZWF0ZWQ6IHN0cmluZywgZGVmYXVsdHM/OiBGb2xkZXJEZWZhdWx0VmFsdWVzKSA9PiBzdHJpbmcsXG4pOiBzdHJpbmcgfCBudWxsIHtcblx0Y29uc3QgY3JlYXRlZCA9IGZvcm1hdExvY2FsRGF0ZShuZXcgRGF0ZShmaWxlLnN0YXQuY3RpbWUpKTtcblx0Y29uc3Qgc291cmNlID0gcGFyc2VGcm9udG1hdHRlcihjb250ZW50KSA9PT0gbnVsbCA/IGJ1aWxkRnVsbEZyb250bWF0dGVyKGNyZWF0ZWQsIGRlZmF1bHRzKSArIGNvbnRlbnQgOiBjb250ZW50O1xuXHRjb25zdCBmcm9udG1hdHRlciA9IHBhcnNlRnJvbnRtYXR0ZXIoc291cmNlKTtcblx0aWYgKGZyb250bWF0dGVyID09PSBudWxsKSB7XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRsZXQgYm9keSA9IG1pZ3JhdGVMZWdhY3lGcm9udG1hdHRlckJvZHkoZnJvbnRtYXR0ZXIuYm9keSk7XG5cdGlmICghaGFzRnJvbnRtYXR0ZXJCbG9jayhwYXJzZUZyb250bWF0dGVyQmxvY2tzKGJvZHkpLCBcIuaRmOimgVwiKSkge1xuXHRcdGJvZHkgPSBidWlsZEZyb250bWF0dGVyQm9keVdpdGhNaXNzaW5nRmllbGRzKGJvZHksIFtcIuaRmOimgVwiXSwgW10sIGNyZWF0ZWQsIFwiXCIsIGRlZmF1bHRzKTtcblx0fVxuXG5cdGNvbnN0IG5leHRCb2R5ID0gcmVwbGFjZVN1bW1hcnlGaWVsZChib2R5LCBub3JtYWxpemVTdW1tYXJ5KHN1bW1hcnkpKTtcblx0Y29uc3Qgc3VmZml4ID0gc291cmNlLnNsaWNlKGZyb250bWF0dGVyLmVuZCk7XG5cdGNvbnN0IHNlcGFyYXRvciA9IHN1ZmZpeC5zdGFydHNXaXRoKFwiXFxuXCIpID8gXCJcIiA6IFwiXFxuXCI7XG5cdHJldHVybiBgLS0tXFxuJHtuZXh0Qm9keX0ke3NlcGFyYXRvcn0ke3N1ZmZpeH1gO1xufVxuXG5mdW5jdGlvbiByZXBsYWNlU3VtbWFyeUZpZWxkKGZyb250bWF0dGVyQm9keTogc3RyaW5nLCBzdW1tYXJ5OiBzdHJpbmcpOiBzdHJpbmcge1xuXHRsZXQgcmVwbGFjZWQgPSBmYWxzZTtcblx0Y29uc3QgYmxvY2tzID0gcGFyc2VGcm9udG1hdHRlckJsb2Nrcyhmcm9udG1hdHRlckJvZHkpO1xuXHRjb25zdCBsaW5lcyA9IGJsb2Nrcy5mbGF0TWFwKChibG9jaykgPT4ge1xuXHRcdGlmIChibG9jay5rZXkgPT09IFwi5pGY6KaBXCIgJiYgIXJlcGxhY2VkKSB7XG5cdFx0XHRyZXBsYWNlZCA9IHRydWU7XG5cdFx0XHRyZXR1cm4gW2Zvcm1hdFNjYWxhckZpZWxkKFwi5pGY6KaBXCIsIHN1bW1hcnkpXTtcblx0XHR9XG5cblx0XHRyZXR1cm4gYmxvY2subGluZXM7XG5cdH0pO1xuXHRyZXR1cm4gbGluZXMuam9pbihcIlxcblwiKTtcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplU3VtbWFyeShzdW1tYXJ5OiBzdHJpbmcpOiBzdHJpbmcge1xuXHRyZXR1cm4gc3VtbWFyeS5yZXBsYWNlKC9cXHMrL2csIFwiIFwiKS50cmltKCk7XG59XG5cbmZ1bmN0aW9uIGdldEVycm9yTWVzc2FnZShlcnJvcjogdW5rbm93bik6IHN0cmluZyB7XG5cdHJldHVybiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcik7XG59XG5cbmZ1bmN0aW9uIGZyb250bWF0dGVyQXV0aG9yQ29udGFpbnModmFsdWU6IHVua25vd24sIGF1dGhvcjogc3RyaW5nKTogYm9vbGVhbiB7XG5cdHJldHVybiBub3JtYWxpemVDYW5kaWRhdGVWYWx1ZXModmFsdWUpLmluY2x1ZGVzKGF1dGhvcik7XG59XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZUZyb250bWF0dGVyU2NhbGFyKHZhbHVlOiB1bmtub3duKTogc3RyaW5nIHtcblx0aWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJzdHJpbmdcIikge1xuXHRcdHJldHVybiB2YWx1ZS50cmltKCk7XG5cdH1cblx0aWYgKHZhbHVlID09PSBudWxsIHx8IHZhbHVlID09PSB1bmRlZmluZWQpIHtcblx0XHRyZXR1cm4gXCJcIjtcblx0fVxuXHRpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcblx0XHRyZXR1cm4gdmFsdWVcblx0XHRcdC5tYXAoKGl0ZW0pID0+IG5vcm1hbGl6ZUZyb250bWF0dGVyU2NhbGFyKGl0ZW0pKVxuXHRcdFx0LmZpbmQoKGl0ZW0pID0+IGl0ZW0ubGVuZ3RoID4gMCkgPz8gXCJcIjtcblx0fVxuXHRyZXR1cm4gU3RyaW5nKHZhbHVlKS50cmltKCk7XG59XG5cbmZ1bmN0aW9uIHJlcGxhY2VQcm9tcHRUb2tlbihwcm9tcHQ6IHN0cmluZywgdG9rZW46IHN0cmluZywgdmFsdWU6IHN0cmluZyk6IHN0cmluZyB7XG5cdHJldHVybiBwcm9tcHQuc3BsaXQodG9rZW4pLmpvaW4odmFsdWUpO1xufVxuXG5mdW5jdGlvbiBkZWxheShtczogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XG5cdHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuXHRcdHdpbmRvdy5zZXRUaW1lb3V0KHJlc29sdmUsIG1zKTtcblx0fSk7XG59XG5cbmZ1bmN0aW9uIGNsYW1wKHZhbHVlOiBudW1iZXIsIG1pbjogbnVtYmVyLCBtYXg6IG51bWJlcik6IG51bWJlciB7XG5cdHJldHVybiBNYXRoLm1pbihNYXRoLm1heCh2YWx1ZSwgbWluKSwgbWF4KTtcbn1cblxuZnVuY3Rpb24gZm9ybWF0U2NhblJlYXNvbihyZXN1bHQ6IFNjYW5SZXN1bHQpOiBzdHJpbmcge1xuXHRjb25zdCByZWFzb25zOiBzdHJpbmdbXSA9IFtdO1xuXHRmb3IgKGNvbnN0IHJlbmFtZSBvZiByZXN1bHQucmVuYW1lRmllbGRzKSB7XG5cdFx0cmVhc29ucy5wdXNoKGDlrZfmrrXpnIDph43lkb3lkI3vvJoke3JlbmFtZS5mcm9tfSDihpIgJHtyZW5hbWUudG99YCk7XG5cdH1cblx0aWYgKHJlc3VsdC5taXNzaW5nRmllbGRzLmxlbmd0aCA+IDApIHtcblx0XHRyZWFzb25zLnB1c2goYOe8uuWwke+8miR7cmVzdWx0Lm1pc3NpbmdGaWVsZHMuam9pbihcIiwgXCIpfWApO1xuXHR9XG5cdGlmIChyZXN1bHQuZGVmYXVsdEZpZWxkcy5sZW5ndGggPiAwKSB7XG5cdFx0cmVhc29ucy5wdXNoKGDpu5jorqTlgLzooaXlhajvvJoke3Jlc3VsdC5kZWZhdWx0RmllbGRzLmpvaW4oXCIsIFwiKX1gKTtcblx0fVxuXHRpZiAocmVzdWx0Lm9yZGVyTmVlZHNGaXgpIHtcblx0XHRyZWFzb25zLnB1c2goXCLlrZfmrrXpobrluo/pnIDosIPmlbRcIik7XG5cdH1cblx0cmV0dXJuIHJlYXNvbnMuam9pbihcIu+8m1wiKTtcbn1cblxuZnVuY3Rpb24gZmluZE1ldGFkYXRhUm93KGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsIGZpZWxkOiBSZXF1aXJlZEZpZWxkKTogSFRNTEVsZW1lbnQgfCBudWxsIHtcblx0Y29uc3QgZGF0YVJvdyA9IGNvbnRhaW5lci5xdWVyeVNlbGVjdG9yPEhUTUxFbGVtZW50PihgW2RhdGEtcHJvcGVydHkta2V5PVwiJHtmaWVsZH1cIl1gKTtcblx0aWYgKGRhdGFSb3cgIT09IG51bGwpIHtcblx0XHRyZXR1cm4gKGRhdGFSb3cuY2xvc2VzdChcIi5tZXRhZGF0YS1wcm9wZXJ0eVwiKSBhcyBIVE1MRWxlbWVudCB8IG51bGwpID8/IGRhdGFSb3c7XG5cdH1cblxuXHRjb25zdCBwcm9wZXJ0eVJvd3MgPSBjb250YWluZXIucXVlcnlTZWxlY3RvckFsbDxIVE1MRWxlbWVudD4oXCIubWV0YWRhdGEtcHJvcGVydHlcIik7XG5cdGZvciAoY29uc3Qgcm93IG9mIEFycmF5LmZyb20ocHJvcGVydHlSb3dzKSkge1xuXHRcdGlmIChyb3dDb250YWluc0ZpZWxkTGFiZWwocm93LCBmaWVsZCkpIHtcblx0XHRcdHJldHVybiByb3c7XG5cdFx0fVxuXHR9XG5cblx0Y29uc3QgZWxlbWVudHMgPSBjb250YWluZXIucXVlcnlTZWxlY3RvckFsbDxIVE1MRWxlbWVudD4oXCIqXCIpO1xuXHRmb3IgKGNvbnN0IGVsIG9mIEFycmF5LmZyb20oZWxlbWVudHMpKSB7XG5cdFx0aWYgKGdldEVsZW1lbnRMYWJlbChlbCkgPT09IGZpZWxkKSB7XG5cdFx0XHRyZXR1cm4gKGVsLmNsb3Nlc3QoXCIubWV0YWRhdGEtcHJvcGVydHlcIikgYXMgSFRNTEVsZW1lbnQgfCBudWxsKSA/PyBlbC5wYXJlbnRFbGVtZW50ID8/IGVsO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBmaW5kTWV0YWRhdGFWYWx1ZUNvbnRhaW5lcihyb3c6IEhUTUxFbGVtZW50KTogSFRNTEVsZW1lbnQgfCBudWxsIHtcblx0cmV0dXJuIHJvdy5xdWVyeVNlbGVjdG9yPEhUTUxFbGVtZW50Pihcblx0XHRcIi5tZXRhZGF0YS1wcm9wZXJ0eS12YWx1ZSwgLm1ldGFkYXRhLXByb3BlcnR5LXZhbHVlLWlucHV0LCAubWV0YWRhdGEtcHJvcGVydHktdmFsdWUtY29udGFpbmVyXCIsXG5cdCk7XG59XG5cbmZ1bmN0aW9uIHJlbW92ZUVtcHR5SGlnaGxpZ2h0Q2xhc3NlcyhlbDogRWxlbWVudCkge1xuXHRlbC5jbGFzc0xpc3QucmVtb3ZlKFxuXHRcdFwiZnJvbnRtYXR0ZXItZW1wdHktaGlnaGxpZ2h0XCIsXG5cdFx0XCJmcm9udG1hdHRlci1lbXB0eS0xXCIsXG5cdFx0XCJmcm9udG1hdHRlci1lbXB0eS0yXCIsXG5cdFx0XCJmcm9udG1hdHRlci1lbXB0eS0zXCIsXG5cdFx0XCJmcm9udG1hdHRlci1lbXB0eS00XCIsXG5cdFx0XCJmcm9udG1hdHRlci1lbXB0eS01XCIsXG5cdFx0XCJmcm9udG1hdHRlci1lbXB0eS02XCIsXG5cdCk7XG59XG5cbmZ1bmN0aW9uIGdldERvY3VtZW50T3JkZXIoYTogSFRNTEVsZW1lbnQsIGI6IEhUTUxFbGVtZW50KTogbnVtYmVyIHtcblx0aWYgKGEgPT09IGIpIHtcblx0XHRyZXR1cm4gMDtcblx0fVxuXG5cdGNvbnN0IHBvc2l0aW9uID0gYS5jb21wYXJlRG9jdW1lbnRQb3NpdGlvbihiKTtcblx0cmV0dXJuIHBvc2l0aW9uICYgTm9kZS5ET0NVTUVOVF9QT1NJVElPTl9GT0xMT1dJTkcgPyAtMSA6IDE7XG59XG5cbmZ1bmN0aW9uIHJvd0NvbnRhaW5zRmllbGRMYWJlbChyb3c6IEhUTUxFbGVtZW50LCBmaWVsZDogUmVxdWlyZWRGaWVsZCk6IGJvb2xlYW4ge1xuXHRpZiAoZ2V0RWxlbWVudExhYmVsKHJvdykgPT09IGZpZWxkKSB7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRjb25zdCBsYWJlbEVsZW1lbnRzID0gcm93LnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTEVsZW1lbnQ+KFxuXHRcdFwiLm1ldGFkYXRhLXByb3BlcnR5LWtleSwgLm1ldGFkYXRhLXByb3BlcnR5LWtleS1pbnB1dCwgW2FyaWEtbGFiZWxdLCBbdGl0bGVdXCIsXG5cdCk7XG5cdGZvciAoY29uc3QgZWwgb2YgQXJyYXkuZnJvbShsYWJlbEVsZW1lbnRzKSkge1xuXHRcdGlmIChnZXRFbGVtZW50TGFiZWwoZWwpID09PSBmaWVsZCkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIGZhbHNlO1xufVxuXG5mdW5jdGlvbiBnZXRFbGVtZW50TGFiZWwoZWw6IEhUTUxFbGVtZW50KTogc3RyaW5nIHtcblx0aWYgKGVsIGluc3RhbmNlb2YgSFRNTElucHV0RWxlbWVudCB8fCBlbCBpbnN0YW5jZW9mIEhUTUxUZXh0QXJlYUVsZW1lbnQpIHtcblx0XHRyZXR1cm4gZWwudmFsdWUudHJpbSgpO1xuXHR9XG5cblx0cmV0dXJuIChcblx0XHRlbC5nZXRBdHRyaWJ1dGUoXCJkYXRhLXByb3BlcnR5LWtleVwiKSA/P1xuXHRcdGVsLmdldEF0dHJpYnV0ZShcImFyaWEtbGFiZWxcIikgPz9cblx0XHRlbC5nZXRBdHRyaWJ1dGUoXCJ0aXRsZVwiKSA/P1xuXHRcdGVsLnRleHRDb250ZW50ID8/XG5cdFx0XCJcIlxuXHQpLnRyaW0oKTtcbn1cblxuZnVuY3Rpb24gaXNFbXB0eUZyb250bWF0dGVyVmFsdWUodmFsdWU6IHVua25vd24pOiBib29sZWFuIHtcblx0aWYgKHZhbHVlID09PSBudWxsIHx8IHZhbHVlID09PSB1bmRlZmluZWQpIHtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXHRpZiAodHlwZW9mIHZhbHVlID09PSBcInN0cmluZ1wiKSB7XG5cdFx0cmV0dXJuIHZhbHVlLnRyaW0oKS5sZW5ndGggPT09IDA7XG5cdH1cblx0aWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG5cdFx0cmV0dXJuIHZhbHVlLmxlbmd0aCA9PT0gMCB8fCB2YWx1ZS5ldmVyeSgoaXRlbSkgPT4gaXNFbXB0eUZyb250bWF0dGVyVmFsdWUoaXRlbSkpO1xuXHR9XG5cblx0cmV0dXJuIGZhbHNlO1xufVxuXG5mdW5jdGlvbiBnZXRWYXVsdEZvbGRlcnMoYXBwOiBBcHApOiBzdHJpbmdbXSB7XG5cdGNvbnN0IGZvbGRlcnMgPSBhcHAudmF1bHRcblx0XHQuZ2V0QWxsTG9hZGVkRmlsZXMoKVxuXHRcdC5maWx0ZXIoKGZpbGUpOiBmaWxlIGlzIFRGb2xkZXIgPT4gZmlsZSBpbnN0YW5jZW9mIFRGb2xkZXIpXG5cdFx0Lm1hcCgoZm9sZGVyKSA9PiBmb2xkZXIucGF0aClcblx0XHQuc29ydCgoYSwgYikgPT4gYS5sb2NhbGVDb21wYXJlKGIpKTtcblxuXHRyZXR1cm4gW1wiXCIsIC4uLmZvbGRlcnMuZmlsdGVyKChmb2xkZXIpID0+IGZvbGRlci5sZW5ndGggPiAwKV07XG59XG5cbmZ1bmN0aW9uIHNob3VsZEluY2x1ZGVSdWxlRm9sZGVyKGZvbGRlcjogc3RyaW5nKTogYm9vbGVhbiB7XG5cdHJldHVybiBmb2xkZXIubGVuZ3RoID4gMCAmJiBmb2xkZXIgIT09IFwiLm9ic2lkaWFuXCIgJiYgIWZvbGRlci5zdGFydHNXaXRoKFwiLm9ic2lkaWFuL1wiKTtcbn1cblxuZnVuY3Rpb24gZm9ybWF0Rm9sZGVyT3B0aW9uTGFiZWwoZm9sZGVyOiBzdHJpbmcpOiBzdHJpbmcge1xuXHRpZiAoZm9sZGVyID09PSBcIlwiKSB7XG5cdFx0cmV0dXJuIFwiL1wiO1xuXHR9XG5cblx0Y29uc3QgZGVwdGggPSBnZXRGb2xkZXJEZXB0aChmb2xkZXIpIC0gMTtcblx0Y29uc3QgbmFtZSA9IGZvbGRlci5zcGxpdChcIi9cIikucG9wKCkgPz8gZm9sZGVyO1xuXHRyZXR1cm4gYCR7XCJcXHUwMEEwXFx1MDBBMFxcdTAwQTBcXHUwMEEwXCIucmVwZWF0KGRlcHRoKX0ke25hbWV9YDtcbn1cblxuZnVuY3Rpb24gZm9ybWF0UnVsZUlubGluZVZhbHVlKHZhbHVlOiBzdHJpbmcpOiBzdHJpbmcge1xuXHRyZXR1cm4gdmFsdWUudHJpbSgpLmxlbmd0aCA+IDAgPyB2YWx1ZSA6IFwiX19fX19fXCI7XG59XG5cbmZ1bmN0aW9uIHRvZ2dsZU1vZGFsU2VsZWN0UGxhY2Vob2xkZXIoc2VsZWN0RWw6IEhUTUxTZWxlY3RFbGVtZW50LCBpc1BsYWNlaG9sZGVyOiBib29sZWFuKSB7XG5cdHNlbGVjdEVsLmNsYXNzTGlzdC50b2dnbGUoXCJpcy1wbGFjZWhvbGRlclwiLCBpc1BsYWNlaG9sZGVyKTtcbn1cblxuZnVuY3Rpb24gZ2V0QW5jZXN0b3JSdWxlcyhmb2xkZXI6IHN0cmluZywgcnVsZXM6IEZvbGRlckRlZmF1bHRSdWxlW10pOiBGb2xkZXJEZWZhdWx0UnVsZVtdIHtcblx0cmV0dXJuIHJ1bGVzXG5cdFx0LmZpbHRlcigocnVsZSkgPT4ge1xuXHRcdFx0cmV0dXJuIHJ1bGUudmFsdWUgJiYgc2hvdWxkSW5jbHVkZVJ1bGVGb2xkZXIocnVsZS5mb2xkZXIpICYmIHJ1bGUuZm9sZGVyICE9PSBmb2xkZXIgJiYgZm9sZGVyTWF0Y2hlcyhmb2xkZXIsIHJ1bGUuZm9sZGVyKTtcblx0XHR9KVxuXHRcdC5zb3J0KChhLCBiKSA9PiB7XG5cdFx0XHRjb25zdCBkZXB0aERpZmYgPSBnZXRGb2xkZXJEZXB0aChiLmZvbGRlcikgLSBnZXRGb2xkZXJEZXB0aChhLmZvbGRlcik7XG5cdFx0XHRpZiAoZGVwdGhEaWZmICE9PSAwKSB7XG5cdFx0XHRcdHJldHVybiBkZXB0aERpZmY7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gYS5mb2xkZXIubG9jYWxlQ29tcGFyZShiLmZvbGRlcikgfHwgYS5maWVsZC5sb2NhbGVDb21wYXJlKGIuZmllbGQpO1xuXHRcdH0pO1xufVxuXG5mdW5jdGlvbiBmb3JtYXRSdWxlQXVkaXQocnVsZTogRm9sZGVyRGVmYXVsdFJ1bGUpOiBzdHJpbmcge1xuXHRpZiAoIXJ1bGUuY3JlYXRlZEJ5IHx8ICFydWxlLmNyZWF0ZWRBdCkge1xuXHRcdHJldHVybiBcIuWIm+W7uuS/oeaBr+S4jeWPr+i/vea6r1wiO1xuXHR9XG5cblx0Y29uc3QgY3JlYXRlZCA9IGDnlLEgJHtydWxlLmNyZWF0ZWRCeX0g5Yib5bu65LqOICR7Zm9ybWF0QXVkaXRUaW1lKHJ1bGUuY3JlYXRlZEF0KX1gO1xuXHRpZiAoXG5cdFx0IXJ1bGUubW9kaWZpZWRCeSB8fFxuXHRcdCFydWxlLm1vZGlmaWVkQXQgfHxcblx0XHQocnVsZS5tb2RpZmllZEJ5ID09PSBydWxlLmNyZWF0ZWRCeSAmJiBydWxlLm1vZGlmaWVkQXQgPT09IHJ1bGUuY3JlYXRlZEF0KVxuXHQpIHtcblx0XHRyZXR1cm4gY3JlYXRlZDtcblx0fVxuXG5cdHJldHVybiBgJHtjcmVhdGVkfSDCtyAke3J1bGUubW9kaWZpZWRCeX0g5pyA5ZCO5L+u5pS55LqOICR7Zm9ybWF0QXVkaXRUaW1lKHJ1bGUubW9kaWZpZWRBdCl9YDtcbn1cblxuZnVuY3Rpb24gZm9ybWF0QXVkaXRUaW1lKHZhbHVlOiBzdHJpbmcpOiBzdHJpbmcge1xuXHRyZXR1cm4gdmFsdWUucmVwbGFjZShcIlRcIiwgXCIgXCIpLnNsaWNlKDAsIDE2KTtcbn1cblxuZnVuY3Rpb24gZ2V0RGV2aWNlVXVpZCgpOiBzdHJpbmcge1xuXHR0cnkge1xuXHRcdGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSBcImRhcndpblwiKSB7XG5cdFx0XHRjb25zdCBvdXRwdXQgPSByZXF1aXJlKFwiY2hpbGRfcHJvY2Vzc1wiKVxuXHRcdFx0XHQuZXhlY1N5bmMoXCJpb3JlZyAtcmQxIC1jIElPUGxhdGZvcm1FeHBlcnREZXZpY2VcIilcblx0XHRcdFx0LnRvU3RyaW5nKCk7XG5cdFx0XHRjb25zdCBtYXRjaCA9IC9cIklPUGxhdGZvcm1VVUlEXCJcXHMqPVxccypcIihbXlwiXSspXCIvLmV4ZWMob3V0cHV0KTtcblx0XHRcdGlmIChtYXRjaCkge1xuXHRcdFx0XHRyZXR1cm4gbWF0Y2hbMV07XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHByb2Nlc3MucGxhdGZvcm0gPT09IFwid2luMzJcIikge1xuXHRcdFx0Y29uc3Qgb3V0cHV0ID0gcmVxdWlyZShcImNoaWxkX3Byb2Nlc3NcIikuZXhlY1N5bmMoXCJ3bWljIGNzcHJvZHVjdCBnZXQgVVVJRFwiKS50b1N0cmluZygpO1xuXHRcdFx0Y29uc3QgdXVpZCA9IG91dHB1dFxuXHRcdFx0XHQuc3BsaXQoL1xccj9cXG4vKVxuXHRcdFx0XHQubWFwKChsaW5lOiBzdHJpbmcpID0+IGxpbmUudHJpbSgpKVxuXHRcdFx0XHQuZmluZCgobGluZTogc3RyaW5nKSA9PiBsaW5lICYmIGxpbmUudG9Mb3dlckNhc2UoKSAhPT0gXCJ1dWlkXCIpO1xuXHRcdFx0aWYgKHV1aWQpIHtcblx0XHRcdFx0cmV0dXJuIHV1aWQ7XG5cdFx0XHR9XG5cdFx0fVxuXHR9IGNhdGNoIHtcblx0XHQvLyBGYWxsIGJhY2sgdG8gaG9zdG5hbWUgYmVsb3cuXG5cdH1cblxuXHRyZXR1cm4gcmVxdWlyZShcIm9zXCIpLmhvc3RuYW1lKCk7XG59XG5cbmZ1bmN0aW9uIGdldExlZ2FjeUF1dGhvck5hbWUoc2V0dGluZ3M6IEF1dG9Gcm9udG1hdHRlclNldHRpbmdzKTogc3RyaW5nIHtcblx0aWYgKHNldHRpbmdzLmF1dGhvck1vZGUgPT09IENVU1RPTV9BVVRIT1JfTU9ERSkge1xuXHRcdHJldHVybiBzZXR0aW5ncy5hdXRob3JDdXN0b20gPz8gXCJcIjtcblx0fVxuXHRyZXR1cm4gc2V0dGluZ3MuYXV0aG9yTW9kZSB8fCBzZXR0aW5ncy5hdXRob3JOYW1lIHx8IFwiXCI7XG59XG5cbmZ1bmN0aW9uIG1hc2tEZXZpY2VVdWlkKHV1aWQ6IHN0cmluZyk6IHN0cmluZyB7XG5cdGNvbnN0IHBhcnRzID0gdXVpZC5zcGxpdChcIi1cIik7XG5cdGlmIChwYXJ0cy5sZW5ndGggIT09IDUpIHtcblx0XHRyZXR1cm4gdXVpZDtcblx0fVxuXG5cdGNvbnN0IGxhc3QgPSBwYXJ0c1s0XTtcblx0cmV0dXJuIGAke3BhcnRzWzBdfS0qKioqLSoqKiotKioqKi0qKioqKioqKiR7bGFzdC5zbGljZSgtNCl9YDtcbn1cblxuZnVuY3Rpb24gZ2V0RnJvbnRtYXR0ZXJGaWVsZENhbmRpZGF0ZXMoYXBwOiBBcHAsIGZpZWxkOiBGb2xkZXJEZWZhdWx0RmllbGQpOiBzdHJpbmdbXSB7XG5cdGNvbnN0IHZhbHVlcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXHRmb3IgKGNvbnN0IGZpbGUgb2YgYXBwLnZhdWx0LmdldE1hcmtkb3duRmlsZXMoKSkge1xuXHRcdGNvbnN0IHZhbHVlID0gYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKGZpbGUpPy5mcm9udG1hdHRlcj8uW2ZpZWxkXTtcblx0XHRmb3IgKGNvbnN0IGl0ZW0gb2Ygbm9ybWFsaXplQ2FuZGlkYXRlVmFsdWVzKHZhbHVlKSkge1xuXHRcdFx0dmFsdWVzLmFkZChpdGVtKTtcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gQXJyYXkuZnJvbSh2YWx1ZXMpLnNvcnQoKGEsIGIpID0+IGEubG9jYWxlQ29tcGFyZShiKSk7XG59XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZUNhbmRpZGF0ZVZhbHVlcyh2YWx1ZTogdW5rbm93bik6IHN0cmluZ1tdIHtcblx0aWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJzdHJpbmdcIikge1xuXHRcdGNvbnN0IHRyaW1tZWQgPSB2YWx1ZS50cmltKCk7XG5cdFx0cmV0dXJuIHRyaW1tZWQgPyBbdHJpbW1lZF0gOiBbXTtcblx0fVxuXHRpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcblx0XHRyZXR1cm4gdmFsdWUuZmxhdE1hcCgoaXRlbSkgPT4gbm9ybWFsaXplQ2FuZGlkYXRlVmFsdWVzKGl0ZW0pKTtcblx0fVxuXHRpZiAodmFsdWUgPT09IG51bGwgfHwgdmFsdWUgPT09IHVuZGVmaW5lZCkge1xuXHRcdHJldHVybiBbXTtcblx0fVxuXHRyZXR1cm4gW1N0cmluZyh2YWx1ZSldO1xufVxuXG5mdW5jdGlvbiBnZXRGaWxlRm9sZGVyKHBhdGg6IHN0cmluZyk6IHN0cmluZyB7XG5cdGNvbnN0IHNsYXNoID0gcGF0aC5sYXN0SW5kZXhPZihcIi9cIik7XG5cdHJldHVybiBzbGFzaCA9PT0gLTEgPyBcIlwiIDogcGF0aC5zbGljZSgwLCBzbGFzaCk7XG59XG5cbmZ1bmN0aW9uIGZvbGRlck1hdGNoZXMoZmlsZUZvbGRlcjogc3RyaW5nLCBydWxlRm9sZGVyOiBzdHJpbmcpOiBib29sZWFuIHtcblx0cmV0dXJuIHJ1bGVGb2xkZXIgPT09IFwiXCIgfHwgZmlsZUZvbGRlciA9PT0gcnVsZUZvbGRlciB8fCBmaWxlRm9sZGVyLnN0YXJ0c1dpdGgoYCR7cnVsZUZvbGRlcn0vYCk7XG59XG5cbmZ1bmN0aW9uIGdldEZvbGRlckRlcHRoKGZvbGRlcjogc3RyaW5nKTogbnVtYmVyIHtcblx0cmV0dXJuIGZvbGRlciA9PT0gXCJcIiA/IDAgOiBmb2xkZXIuc3BsaXQoXCIvXCIpLmxlbmd0aDtcbn1cblxuZnVuY3Rpb24gdXBkYXRlRnJvbnRtYXR0ZXJVcGRhdGVkKGNvbnRlbnQ6IHN0cmluZywgdXBkYXRlZDogc3RyaW5nKTogc3RyaW5nIHwgbnVsbCB7XG5cdGlmICghY29udGVudC5zdGFydHNXaXRoKFwiLS0tXFxuXCIpKSB7XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRjb25zdCBlbmQgPSBjb250ZW50LmluZGV4T2YoXCJcXG4tLS1cIiwgNCk7XG5cdGlmIChlbmQgPT09IC0xKSB7XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRjb25zdCBmcm9udG1hdHRlciA9IGNvbnRlbnQuc2xpY2UoMCwgZW5kICsgMSk7XG5cdGNvbnN0IHVwZGF0ZWRMaW5lID0gL17mnIDlkI7mm7TmlrA6XFxzKi4qJC9tO1xuXHRpZiAoIXVwZGF0ZWRMaW5lLnRlc3QoZnJvbnRtYXR0ZXIpKSB7XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRjb25zdCBuZXh0RnJvbnRtYXR0ZXIgPSBmcm9udG1hdHRlci5yZXBsYWNlKHVwZGF0ZWRMaW5lLCBg5pyA5ZCO5pu05pawOiAke3VwZGF0ZWR9YCk7XG5cdHJldHVybiBuZXh0RnJvbnRtYXR0ZXIgKyBjb250ZW50LnNsaWNlKGVuZCArIDEpO1xufVxuXG5mdW5jdGlvbiBmb3JtYXRMb2NhbERhdGUoZGF0ZTogRGF0ZSk6IHN0cmluZyB7XG5cdGNvbnN0IHllYXIgPSBkYXRlLmdldEZ1bGxZZWFyKCk7XG5cdGNvbnN0IG1vbnRoID0gcGFkKGRhdGUuZ2V0TW9udGgoKSArIDEpO1xuXHRjb25zdCBkYXkgPSBwYWQoZGF0ZS5nZXREYXRlKCkpO1xuXHRjb25zdCBob3VyID0gcGFkKGRhdGUuZ2V0SG91cnMoKSk7XG5cdGNvbnN0IG1pbnV0ZSA9IHBhZChkYXRlLmdldE1pbnV0ZXMoKSk7XG5cdGNvbnN0IHNlY29uZCA9IHBhZChkYXRlLmdldFNlY29uZHMoKSk7XG5cdHJldHVybiBgJHt5ZWFyfS0ke21vbnRofS0ke2RheX1UJHtob3VyfToke21pbnV0ZX06JHtzZWNvbmR9YDtcbn1cblxuZnVuY3Rpb24gcGFkKHZhbHVlOiBudW1iZXIpOiBzdHJpbmcge1xuXHRyZXR1cm4gdmFsdWUudG9TdHJpbmcoKS5wYWRTdGFydCgyLCBcIjBcIik7XG59XG5cbmZ1bmN0aW9uIGZvcm1hdFlhbWxTY2FsYXIodmFsdWU6IHN0cmluZyk6IHN0cmluZyB7XG5cdGlmICghdmFsdWUpIHtcblx0XHRyZXR1cm4gXCJcIjtcblx0fVxuXG5cdHJldHVybiBKU09OLnN0cmluZ2lmeSh2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIHlpZWxkVG9VaSgpOiBQcm9taXNlPHZvaWQ+IHtcblx0cmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG5cdFx0d2luZG93LnNldFRpbWVvdXQocmVzb2x2ZSwgMCk7XG5cdH0pO1xufVxuIl19