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
                // 1. 卸载插件
                // @ts-ignore — 内部 API
                await app.plugins.unloadPlugin(pluginId);
                // 2. 清除内存中的旧 manifest 缓存
                // @ts-ignore — 内部 API
                delete app.plugins.manifests[pluginId];
                await new Promise((resolve) => window.setTimeout(resolve, 300));
                // 3. 重新读取磁盘上的 manifest
                // @ts-ignore — 内部 API
                await app.plugins.loadManifests();
                await new Promise((resolve) => window.setTimeout(resolve, 300));
                // 4. 重新加载并启用插件
                // @ts-ignore — 内部 API
                await app.plugins.loadPlugin(pluginId);
                // @ts-ignore — 内部 API
                await app.plugins.enablePlugin(pluginId);
                await new Promise((resolve) => window.setTimeout(resolve, 500));
                // 5. 打开设置页
                // @ts-ignore — 内部 API
                app.setting.open();
                // @ts-ignore — 内部 API
                app.setting.openTabById(pluginId);
                new obsidian_1.Notice(`插件已重载到 ${version}`);
            }
            catch (e) {
                console.error("[auto-frontmatter] 重载失败:", e);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm1haW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSx1Q0Fja0I7QUE4Q2xCLE1BQU0sMEJBQTBCLEdBQUcsS0FBSyxDQUFDO0FBQ3pDLE1BQU0sNkJBQTZCLEdBQUcsRUFBRSxHQUFHLElBQUksQ0FBQztBQUNoRCxNQUFNLDJCQUEyQixHQUFHLElBQUksQ0FBQztBQUN6QyxNQUFNLHVCQUF1QixHQUFHLEVBQUUsQ0FBQztBQUNuQyxNQUFNLGNBQWMsR0FBRyxDQUFDLENBQUM7QUFDekIsTUFBTSxxQkFBcUIsR0FBRzs7Ozs7Ozs7OztVQVVwQixDQUFDO0FBQ1gsTUFBTSwwQkFBMEIsR0FBRzs7Ozs7Ozs7Ozs7Ozs7OztVQWdCekIsQ0FBQztBQUNYLE1BQU0seUJBQXlCLEdBQUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztVQThCeEIsQ0FBQztBQUVYLE1BQU0sZ0JBQWdCLEdBQTRCO0lBQ2pELFFBQVEsRUFBRSxFQUFFO0lBQ1osUUFBUSxFQUFFLHNDQUFzQztJQUNoRCxXQUFXLEVBQUUsZ0JBQWdCO0lBQzdCLGdCQUFnQixFQUFFLElBQUk7SUFDdEIsZUFBZSxFQUFFLHlCQUF5QjtJQUMxQyxjQUFjLEVBQUUsRUFBRTtJQUNsQixtQkFBbUIsRUFBRSxJQUFJO0lBQ3pCLGNBQWMsRUFBRSxFQUFFO0lBQ2xCLG1CQUFtQixFQUFFLEtBQUs7Q0FDMUIsQ0FBQztBQUVGLE1BQU0sY0FBYyxHQUFHO0lBQ3RCLEtBQUs7SUFDTCxLQUFLO0lBQ0wsS0FBSztJQUNMLEtBQUs7SUFDTCxJQUFJO0lBQ0osS0FBSztJQUNMLEtBQUs7SUFDTCxLQUFLO0NBQ0ksQ0FBQztBQUNYLE1BQU0sa0JBQWtCLEdBQUcsS0FBSyxDQUFDO0FBRWpDLE1BQU0sZUFBZSxHQUFHLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxNQUFNLENBQVUsQ0FB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LEVBQUUsRUFBRTtRQUM5QixNQUFNLENBQUMsVUFBVSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQztJQUMvQixDQUFDLENBQUMsQ0FBQztBQUNKLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge1xuXHRBcHAsXG5cdEVkaXRvcixcblx0TWVudSxcblx0TWFya2Rvd25WaWV3LFxuXHRNb2RhbCxcblx0Tm90aWNlLFxuXHRQbHVnaW4sXG5cdFBsdWdpblNldHRpbmdUYWIsXG5cdFNldHRpbmcsXG5cdHNldEljb24sXG5cdFRBYnN0cmFjdEZpbGUsXG5cdFRGaWxlLFxuXHRURm9sZGVyLFxufSBmcm9tIFwib2JzaWRpYW5cIjtcblxuaW50ZXJmYWNlIEF1dG9Gcm9udG1hdHRlclNldHRpbmdzIHtcblx0YXV0aG9yTW9kZT86IHN0cmluZztcblx0YXV0aG9yQ3VzdG9tPzogc3RyaW5nO1xuXHRhdXRob3JOYW1lPzogc3RyaW5nO1xuXHRhaUFwaUtleTogc3RyaW5nO1xuXHRhaUFwaVVybDogc3RyaW5nO1xuXHRhaU1vZGVsTmFtZTogc3RyaW5nO1xuXHRhaVN1bW1hcnlFbmFibGVkOiBib29sZWFuO1xuXHRhaVN1bW1hcnlQcm9tcHQ6IHN0cmluZztcblx0ZGV2aWNlQmluZGluZ3M6IERldmljZUF1dGhvckJpbmRpbmdbXTtcblx0ZW1wdHlGaWVsZEhpZ2hsaWdodDogYm9vbGVhbjtcblx0Zm9sZGVyRGVmYXVsdHM6IEZvbGRlckRlZmF1bHRSdWxlW107XG5cdHNob3dGb2xkZXJDaGVja21hcms6IGJvb2xlYW47XG59XG5cbmludGVyZmFjZSBTdW1tYXJ5U2VydmljZSB7XG5cdGdlbmVyYXRlU3VtbWFyeShkb2N1bWVudDogU3VtbWFyeURvY3VtZW50KTogUHJvbWlzZTxzdHJpbmc+O1xufVxuXG5pbnRlcmZhY2UgU3VtbWFyeURvY3VtZW50IHtcblx0dGl0bGU6IHN0cmluZztcblx0ZnJvbnRtYXR0ZXI6IHN0cmluZztcblx0Y29udGVudDogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgRGV2aWNlQXV0aG9yQmluZGluZyB7XG5cdHV1aWQ6IHN0cmluZztcblx0YXV0aG9yOiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBGb2xkZXJEZWZhdWx0UnVsZSB7XG5cdGZvbGRlcjogc3RyaW5nO1xuXHRmaWVsZDogRm9sZGVyRGVmYXVsdEZpZWxkO1xuXHR2YWx1ZTogc3RyaW5nO1xuXHRjcmVhdGVkQnk/OiBzdHJpbmc7XG5cdGNyZWF0ZWRBdD86IHN0cmluZztcblx0bW9kaWZpZWRCeT86IHN0cmluZztcblx0bW9kaWZpZWRBdD86IHN0cmluZztcblx0ZmllbGRzPzogQXJyYXk8e1xuXHRcdGZpZWxkOiBGb2xkZXJEZWZhdWx0RmllbGQ7XG5cdFx0dmFsdWU6IHN0cmluZztcblx0fT47XG59XG5cbmNvbnN0IE1BWF9TVU1NQVJZX0NPTlRFTlRfTEVOR1RIID0gMTYwMDA7XG5jb25zdCBBSV9TVU1NQVJZX1NDSEVEVUxFUl9DSEVDS19NUyA9IDYwICogMTAwMDtcbmNvbnN0IEFJX1NVTU1BUllfUkVRVUVTVF9ERUxBWV9NUyA9IDIwMDA7XG5jb25zdCBNSU5fU1VNTUFSWV9CT0RZX0xFTkdUSCA9IDUwO1xuY29uc3QgUlVMRVNfUEVSX1BBR0UgPSA2O1xuY29uc3QgT0xEX0FJX1NVTU1BUllfUFJPTVBUID0gYOS9oOaYr+S4gOS9jeS4k+S4mueahOaWh+aho+aRmOimgeWKqeaJi+OAguivt+WvueS7peS4i+aWh+aho+WGheWuueeUn+aIkOS4gOauteeugOa0geeahOaRmOimgeOAglxuXG7opoHmsYLvvJpcbjEuIOS4gOauteivneamguaLrO+8jOS4jei2hei/hyAxMDAg5a2XXG4yLiDmj5DngrzmoLjlv4PkuLvpopjjgIHlhbPplK7nu5PorrrmiJbkuLvopoHlhrPnrZZcbjMuIOS4jeimgeWHuueOsFwi5pys5paHXCLjgIFcIui/meevh+aWh+aho1wi562J5oyH5Luj6K+N77yM55u05o6l6ZmI6L+w5YaF5a65XG40LiDlpoLmnpzmlofmoaPljIXlkKvlm77niYfmj4/ov7DmiJbku6PnoIHniYfmrrXvvIzkvqfph43mgLvnu5PlhbbmhI/lm77ogIzpnZ7nu4boioJcbjUuIOS9v+eUqOS4juWOn+aWh+S4gOiHtOeahOivreiogO+8iOS4reaWh+aWh+aho+eUqOS4reaWh++8jOiLseaWh+aWh+aho+eUqOiLseaWh++8iVxuXG7mlofmoaPlhoXlrrnvvJpcbntjb250ZW50fWA7XG5jb25zdCBQUkVWSU9VU19BSV9TVU1NQVJZX1BST01QVCA9IGDkvaDmmK/kuIDkvY3kuJPkuJrnmoTmlofmoaPmkZjopoHliqnmiYvjgILor7fmoLnmja7ku6XkuIvmlofmoaPnmoTmoIfpopjjgIHlsZ7mgKflkozmraPmloflhoXlrrnvvIznlJ/miJDkuIDmrrXnroDmtIHnmoTkuK3mlofmkZjopoHjgIJcblxu6KaB5rGC77yaXG4xLiDkuIDmrrXor53mpoLmi6zvvIwzMCDliLAgMTQwIOWtl+S5i+mXtFxuMi4g5o+Q54K85qC45b+D5Li76aKY44CB5YWz6ZSu57uT6K665oiW5Li76KaB5Yaz562WXG4zLiDkuI3opoHlh7rnjrBcIuacrOaWh1wi44CBXCLov5nnr4fmlofmoaNcIuetieaMh+S7o+ivje+8jOebtOaOpemZiOi/sOWGheWuuVxuNC4g5aaC5p6c5paH5qGj5YyF5ZCr5Zu+54mH5o+P6L+w5oiW5Luj56CB54mH5q6177yM5L6n6YeN5oC757uT5YW25oSP5Zu+6ICM6Z2e57uG6IqCXG41LiDml6Dorrrljp/mlofmmK/ku4DkuYjor63oqIDvvIzkuIDlvovkvb/nlKjkuK3mlofovpPlh7pcblxu5paH5qGj5qCH6aKY77yaXG57dGl0bGV9XG5cbuaWh+aho+WxnuaAp++8mlxue2Zyb250bWF0dGVyfVxuXG7mlofmoaPmraPmlofvvJpcbntjb250ZW50fWA7XG5jb25zdCBERUZBVUxUX0FJX1NVTU1BUllfUFJPTVBUID0gYOivt+S4uuS7peS4i+WGheWuueWGmeS4gOauteaRmOimgeOAglxuXG7op4TliJnvvJpcbjEuIDMwIOWIsCAxNDAg5a2X77yM5LiA5q616K+d77yM5LiN5o2i6KGMXG4yLiDnlKjkuK3mloflhplcbjMuIOS7peWGheWuueacrOi6q+eahOWPo+WQu+amguaLrO+8jOWDj+aYr+i/meauteWGheWuueeahOW8gOWktOWvvOivrVxuNC4g55u05o6l6ZmI6L+w5qC45b+D5L+h5oGv77ya5YGa5LqG5LuA5LmI44CB6Kej5Yaz5LqG5LuA5LmI44CB5b6X5Ye65LqG5LuA5LmI57uT6K66XG41LiDnpoHmraLkvb/nlKjjgIzmnKzmlofjgI3jgIzor6XmlofmoaPjgI3jgIzov5nnr4fnrJTorrDjgI3jgIzkvZzogIXjgI3nrYnmjIfku6Por41cbjYuIOemgeatouS9v+eUqOOAjOS7i+e7jeS6huOAjeOAjOmYkOi/sOS6huOAjeOAjOaPj+i/sOS6huOAjeOAjOiuqOiuuuS6huOAjeOAjOaOouiuqOS6huOAjei/meexu+WFg+WPmei/sOWKqOivjVxuNy4g5aaC5p6c5YaF5a655piv5Lya6K6u57qq6KaB77yM5o+Q54K85YWz6ZSu5Yaz562W5ZKM5b6F5YqeXG44LiDlpoLmnpzlhoXlrrnmmK/mioDmnK/mlrnmoYjvvIzmj5Dngrznm67moIfjgIHmlrnmoYjopoHngrnlkozmoLjlv4PnuqbmnZ9cbjkuIOWmguaenOWGheWuueW+iOefreaIluS/oeaBr+WvhuW6puS9ju+8jOaRmOimgeWPr+S7peefreS6jiAzMCDlrZfvvIzkvYbkuI3opoHms6jmsLRcblxu5aW955qE5pGY6KaB56S65L6L77yaXG4tIOOAjOmAmui/h+aLhuWIhummluWxj+WKoOi9vei1hOa6kOW5tuW8leWFpemqqOaetuWxj++8jOWwhuWwj+aciOS6ruWGt+WQr+WKqOaXtumXtOS7jiAzLjJzIOmZjeiHsyAxLjFz77yM5ZCM5pe25L+u5aSN5LqGIGlPUyDnq6/nmb3lsY/pl6rng4Hpl67popjjgILjgI1cbi0g44CM56Gu6K6kIFEzIOWinumVv+ebruagh+S4uiBEQVUg57+75YCN77yM5Li76KaB6Lev5b6E5Li657qi5YyF6KOC5Y+YICsg5YaF5a6556S+5Yy65Ya35ZCv5Yqo77yM6aKE566X5LiK6ZmQIDUwIOS4h+OAguOAjVxuLSDjgIzmorPnkIbkuoYgT3dsZW4g5o6o6I2Q566X5rOV5LuO5Y2P5ZCM6L+H5ruk6L+B56e75Yiw5Y+M5aGU5qih5Z6L55qE5oqA5pyv6Lev5b6E77yM6YeN54K56Kej5Yaz5Ya35ZCv5Yqo5Zy65pmv5LiL55qE5Y+s5Zue546H6Zeu6aKY44CC44CNXG5cbuW3rueahOaRmOimgeekuuS+i++8iOemgeatou+8ie+8mlxuLSDinJfjgIzmnKzmlofku4vnu43kuobkuIDnp43kvJjljJblhrflkK/liqjnmoTmlrnms5UuLi7jgI3vvIjlhYPlj5nov7AgKyDmjIfku6Por43vvIlcbi0g4pyX44CM6K+l5paH5qGj6K6o6K665LqG5YWz5LqO5aKe6ZW/55uu5qCH55qE55u45YWz5YaF5a65Li4u44CN77yI5qih57OKICsg5oyH5Luj6K+N77yJXG4tIOKcl+OAjOi/meaYr+S4gOevh+WFs+S6juaOqOiNkOeul+azleeahOaKgOacr+aWh+ahoy4uLuOAje+8iOW6n+ivne+8iVxuXG4tLS1cbuagh+mimO+8mnt0aXRsZX1cblxu5bGe5oCn77yaXG57ZnJvbnRtYXR0ZXJ9XG5cbuato+aWh++8mlxue2NvbnRlbnR9YDtcblxuY29uc3QgREVGQVVMVF9TRVRUSU5HUzogQXV0b0Zyb250bWF0dGVyU2V0dGluZ3MgPSB7XG5cdGFpQXBpS2V5OiBcIlwiLFxuXHRhaUFwaVVybDogXCJodHRwczovL2FwaS5zdGVwZnVuLmNvbS9zdGVwX3BsYW4vdjFcIixcblx0YWlNb2RlbE5hbWU6IFwic3RlcC0zLjctZmxhc2hcIixcblx0YWlTdW1tYXJ5RW5hYmxlZDogdHJ1ZSxcblx0YWlTdW1tYXJ5UHJvbXB0OiBERUZBVUxUX0FJX1NVTU1BUllfUFJPTVBULFxuXHRkZXZpY2VCaW5kaW5nczogW10sXG5cdGVtcHR5RmllbGRIaWdobGlnaHQ6IHRydWUsXG5cdGZvbGRlckRlZmF1bHRzOiBbXSxcblx0c2hvd0ZvbGRlckNoZWNrbWFyazogZmFsc2UsXG59O1xuXG5jb25zdCBBVVRIT1JfT1BUSU9OUyA9IFtcblx0XCLpmYjmmZPnkKZcIixcblx0XCLokaPmgZLmlodcIixcblx0XCLliJjkuIDplItcIixcblx0XCLnjovkuprlhptcIixcblx0XCLmnajnoZVcIixcblx0XCLlkajmraPpo55cIixcblx0XCLluoTpnZblrodcIixcblx0XCLoh6rlrprkuYlcIixcbl0gYXMgY29uc3Q7XG5jb25zdCBDVVNUT01fQVVUSE9SX01PREUgPSBcIuiHquWumuS5iVwiO1xuXG5jb25zdCBSRVFVSVJFRF9GSUVMRFMgPSBbXCLpobnnm65cIiwgXCLnsbvlnotcIiwgXCLkvZzogIVcIiwgXCLmkZjopoFcIiwgXCLliJvlu7rml7bpl7RcIiwgXCLmnIDlkI7mm7TmlrBcIl0gYXMgY29uc3Q7XG50eXBlIFJlcXVpcmVkRmllbGQgPSAodHlwZW9mIFJFUVVJUkVEX0ZJRUxEUylbbnVtYmVyXTtcbmNvbnN0IEhJR0hMSUdIVF9GSUVMRFMgPSBbXCLpobnnm65cIiwgXCLnsbvlnotcIiwgXCLkvZzogIVcIiwgXCLliJvlu7rml7bpl7RcIiwgXCLmnIDlkI7mm7TmlrBcIl0gYXMgY29uc3Q7XG50eXBlIEhpZ2hsaWdodEZpZWxkID0gKHR5cGVvZiBISUdITElHSFRfRklFTERTKVtudW1iZXJdO1xuY29uc3QgRk9MREVSX0RFRkFVTFRfRklFTERTID0gW1wi6aG555uuXCIsIFwi57G75Z6LXCJdIGFzIGNvbnN0O1xudHlwZSBGb2xkZXJEZWZhdWx0RmllbGQgPSAodHlwZW9mIEZPTERFUl9ERUZBVUxUX0ZJRUxEUylbbnVtYmVyXTtcbnR5cGUgRm9sZGVyRGVmYXVsdFZhbHVlcyA9IFBhcnRpYWw8UmVjb3JkPEZvbGRlckRlZmF1bHRGaWVsZCwgc3RyaW5nPj47XG5jb25zdCBTRVRUSU5HX1RBQlMgPSBbXCLpgJrnlKhcIiwgXCLmlofku7blpLnop4TliJlcIiwgXCJBSeaRmOimgVwiLCBcIuaJq+aPj+S7k+W6k1wiLCBcIuiuvuWkh+e7keWumlwiLCBcIueJiOacrOabtOaWsFwiXSBhcyBjb25zdDtcbnR5cGUgU2V0dGluZ1RhYklkID0gKHR5cGVvZiBTRVRUSU5HX1RBQlMpW251bWJlcl07XG5jb25zdCBHSVRIVUJfUkFXX0JBU0UgPSBcImh0dHBzOi8vcmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbS9saXV5aWZlbmc5Mi9vYnNpZGlhbi1wbHVnaW5zL21haW4vYXV0by1mcm9udG1hdHRlclwiO1xudHlwZSBBSVN1bW1hcnlUYXNrVHlwZSA9IFwiY29tcGxldGlvblwiO1xuY29uc3QgTEVHQUNZX0ZJRUxEX1JFTkFNRVMgPSB7XG5cdGNyZWF0ZWQ6IFwi5Yib5bu65pe26Ze0XCIsXG5cdHVwZGF0ZWQ6IFwi5pyA5ZCO5pu05pawXCIsXG59IGFzIGNvbnN0O1xudHlwZSBMZWdhY3lGaWVsZCA9IGtleW9mIHR5cGVvZiBMRUdBQ1lfRklFTERfUkVOQU1FUztcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgQXV0b0Zyb250bWF0dGVyUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcblx0c2V0dGluZ3M6IEF1dG9Gcm9udG1hdHRlclNldHRpbmdzO1xuXHRjdXJyZW50RGV2aWNlVXVpZCA9IFwiXCI7XG5cdHNldHRpbmdUYWI6IEF1dG9Gcm9udG1hdHRlclNldHRpbmdUYWIgfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSB1cGRhdGVUaW1lcjogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG5cdHByaXZhdGUgdXBkYXRlRmlsZVBhdGg6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIGNyZWF0ZVRpbWVycyA9IG5ldyBTZXQ8bnVtYmVyPigpO1xuXHRwcml2YXRlIGhpZ2hsaWdodFRpbWVyOiBudW1iZXIgfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSBoaWdobGlnaHRJbnRlcnZhbDogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG5cdHByaXZhdGUgaGlnaGxpZ2h0RmlsZVBhdGg6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIGZvbGRlckNoZWNrbWFya1RpbWVyOiBudW1iZXIgfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSBhaUJ1dHRvblRpbWVyOiBudW1iZXIgfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSBhaVN1bW1hcnlBYm9ydENvbnRyb2xsZXI6IEFib3J0Q29udHJvbGxlciB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIGFpU3VtbWFyeUNvbXBsZXRpb25SdW5uaW5nID0gZmFsc2U7XG5cdHByaXZhdGUgbGFzdEFJU3VtbWFyeVNjaGVkdWxlU2xvdCA9IFwiXCI7XG5cblx0YXN5bmMgb25sb2FkKCkge1xuXHRcdGF3YWl0IHRoaXMubG9hZFNldHRpbmdzKCk7XG5cblx0XHR0aGlzLnNldHRpbmdUYWIgPSBuZXcgQXV0b0Zyb250bWF0dGVyU2V0dGluZ1RhYih0aGlzLmFwcCwgdGhpcyk7XG5cdFx0dGhpcy5hZGRTZXR0aW5nVGFiKHRoaXMuc2V0dGluZ1RhYik7XG5cblx0XHR0aGlzLnJlZ2lzdGVyRXZlbnQoXG5cdFx0XHR0aGlzLmFwcC52YXVsdC5vbihcImNyZWF0ZVwiLCAoZmlsZSkgPT4ge1xuXHRcdFx0XHR0aGlzLmhhbmRsZUNyZWF0ZShmaWxlKTtcblx0XHRcdH0pLFxuXHRcdCk7XG5cblx0XHR0aGlzLnJlZ2lzdGVyRXZlbnQoXG5cdFx0XHR0aGlzLmFwcC52YXVsdC5vbihcInJlbmFtZVwiLCAoZmlsZSwgb2xkUGF0aCkgPT4ge1xuXHRcdFx0XHR0aGlzLmhhbmRsZVJlbmFtZShmaWxlLCBvbGRQYXRoKTtcblx0XHRcdH0pLFxuXHRcdCk7XG5cblx0XHR0aGlzLnJlZ2lzdGVyRXZlbnQoXG5cdFx0XHR0aGlzLmFwcC53b3Jrc3BhY2Uub24oXCJmaWxlLW1lbnVcIiwgKG1lbnU6IE1lbnUsIGZpbGU6IFRBYnN0cmFjdEZpbGUpID0+IHtcblx0XHRcdFx0dGhpcy5oYW5kbGVGaWxlTWVudShtZW51LCBmaWxlKTtcblx0XHRcdH0pLFxuXHRcdCk7XG5cblx0XHR0aGlzLnJlZ2lzdGVyRXZlbnQoXG5cdFx0XHR0aGlzLmFwcC53b3Jrc3BhY2Uub24oXCJlZGl0b3ItY2hhbmdlXCIsIChfZWRpdG9yOiBFZGl0b3IsIHZpZXc6IE1hcmtkb3duVmlldykgPT4ge1xuXHRcdFx0XHR0aGlzLnNjaGVkdWxlVXBkYXRlZEZpZWxkUmVmcmVzaCh2aWV3LmZpbGUpO1xuXHRcdFx0fSksXG5cdFx0KTtcblxuXHRcdHRoaXMucmVnaXN0ZXJFdmVudChcblx0XHRcdHRoaXMuYXBwLndvcmtzcGFjZS5vbihcImFjdGl2ZS1sZWFmLWNoYW5nZVwiLCAoKSA9PiB7XG5cdFx0XHRcdHRoaXMuc2NoZWR1bGVFbXB0eUZpZWxkSGlnaGxpZ2h0Q2hlY2soKTtcblx0XHRcdFx0dGhpcy5zY2hlZHVsZUFJU3VtbWFyeUJ1dHRvblJlZnJlc2goKTtcblx0XHRcdH0pLFxuXHRcdCk7XG5cblx0XHR0aGlzLnJlZ2lzdGVyRXZlbnQoXG5cdFx0XHR0aGlzLmFwcC53b3Jrc3BhY2Uub24oXCJsYXlvdXQtY2hhbmdlXCIsICgpID0+IHtcblx0XHRcdFx0dGhpcy5zY2hlZHVsZUVtcHR5RmllbGRIaWdobGlnaHRDaGVjaygpO1xuXHRcdFx0XHR0aGlzLnNjaGVkdWxlQUlTdW1tYXJ5QnV0dG9uUmVmcmVzaCgpO1xuXHRcdFx0XHR0aGlzLnNjaGVkdWxlRm9sZGVyQ2hlY2ttYXJrUmVmcmVzaCgpO1xuXHRcdFx0fSksXG5cdFx0KTtcblxuXHRcdHRoaXMucmVnaXN0ZXJJbnRlcnZhbCh3aW5kb3cuc2V0SW50ZXJ2YWwoKCkgPT4ge1xuXHRcdFx0dGhpcy5jaGVja0FJU3VtbWFyeVNjaGVkdWxlKCk7XG5cdFx0fSwgQUlfU1VNTUFSWV9TQ0hFRFVMRVJfQ0hFQ0tfTVMpKTtcblxuXHRcdHRoaXMuc2NoZWR1bGVFbXB0eUZpZWxkSGlnaGxpZ2h0Q2hlY2soKTtcblx0XHR0aGlzLnNjaGVkdWxlQUlTdW1tYXJ5QnV0dG9uUmVmcmVzaCgpO1xuXHRcdHRoaXMuc2NoZWR1bGVGb2xkZXJDaGVja21hcmtSZWZyZXNoKCk7XG5cdH1cblxuXHRvbnVubG9hZCgpIHtcblx0XHR0aGlzLmNsZWFyVXBkYXRlVGltZXIoKTtcblx0XHR0aGlzLmNsZWFySGlnaGxpZ2h0VGltZXJzKCk7XG5cdFx0dGhpcy5jbGVhckVtcHR5RmllbGRIaWdobGlnaHRzKCk7XG5cdFx0dGhpcy5jbGVhckFJU3VtbWFyeUJ1dHRvblRpbWVyKCk7XG5cdFx0dGhpcy5jbGVhckFJU3VtbWFyeUJ1dHRvbnMoKTtcblx0XHR0aGlzLmFib3J0QUlTdW1tYXJ5U3RyZWFtKCk7XG5cdFx0dGhpcy5jbGVhckZvbGRlckNoZWNrbWFya1RpbWVyKCk7XG5cdFx0dGhpcy5jbGVhckZvbGRlckNoZWNrbWFya3MoKTtcblx0XHRmb3IgKGNvbnN0IHRpbWVyIG9mIHRoaXMuY3JlYXRlVGltZXJzKSB7XG5cdFx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0KHRpbWVyKTtcblx0XHR9XG5cdFx0dGhpcy5jcmVhdGVUaW1lcnMuY2xlYXIoKTtcblx0fVxuXG5cdGFzeW5jIGxvYWRTZXR0aW5ncygpIHtcblx0XHR0aGlzLmN1cnJlbnREZXZpY2VVdWlkID0gZ2V0RGV2aWNlVXVpZCgpO1xuXHRcdHRoaXMuc2V0dGluZ3MgPSBPYmplY3QuYXNzaWduKHt9LCBERUZBVUxUX1NFVFRJTkdTLCBhd2FpdCB0aGlzLmxvYWREYXRhKCkpO1xuXHRcdHRoaXMubWlncmF0ZUF1dGhvclNldHRpbmdzKCk7XG5cdFx0dGhpcy5lbnN1cmVDdXJyZW50RGV2aWNlQmluZGluZygpO1xuXHRcdHRoaXMubWlncmF0ZUZvbGRlckRlZmF1bHRSdWxlcygpO1xuXHRcdHRoaXMubWlncmF0ZUFJU3VtbWFyeVByb21wdCgpO1xuXHR9XG5cblx0YXN5bmMgc2F2ZVNldHRpbmdzKCkge1xuXHRcdGF3YWl0IHRoaXMuc2F2ZURhdGEodGhpcy5zZXR0aW5ncyk7XG5cdFx0dGhpcy5zY2hlZHVsZUZvbGRlckNoZWNrbWFya1JlZnJlc2goKTtcblx0fVxuXG5cdHJlZnJlc2hTZXR0aW5nc1RhYigpIHtcblx0XHR0aGlzLnNldHRpbmdUYWI/LmRpc3BsYXkoKTtcblx0fVxuXG5cdHJlZnJlc2hFbXB0eUZpZWxkSGlnaGxpZ2h0cygpIHtcblx0XHR0aGlzLnNjaGVkdWxlRW1wdHlGaWVsZEhpZ2hsaWdodENoZWNrKCk7XG5cdH1cblxuXHRyZWZyZXNoRm9sZGVyQ2hlY2ttYXJrcygpIHtcblx0XHR0aGlzLmFwcGx5Rm9sZGVyQ2hlY2ttYXJrcygpO1xuXHR9XG5cblx0YXN5bmMgZ2VuZXJhdGVTdW1tYXJ5Rm9yRmlsZShmaWxlOiBURmlsZSkge1xuXHRcdGlmICghdGhpcy5zZXR0aW5ncy5haVN1bW1hcnlFbmFibGVkIHx8ICF0aGlzLnNldHRpbmdzLmFpQXBpS2V5LnRyaW0oKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZChmaWxlKTtcblx0XHRcdGNvbnN0IHN1bW1hcnlEb2N1bWVudCA9IGdldFN1bW1hcnlEb2N1bWVudChmaWxlLCBjb250ZW50LCAxKTtcblx0XHRcdGlmICghc3VtbWFyeURvY3VtZW50KSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3Qgc3VtbWFyeSA9IGF3YWl0IG5ldyBBSVN1bW1hcnlTZXJ2aWNlKHRoaXMuc2V0dGluZ3MpLmdlbmVyYXRlU3VtbWFyeShzdW1tYXJ5RG9jdW1lbnQpO1xuXHRcdFx0aWYgKCFzdW1tYXJ5KSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgbmV4dCA9IHdyaXRlU3VtbWFyeVRvQ29udGVudChcblx0XHRcdFx0Y29udGVudCxcblx0XHRcdFx0ZmlsZSxcblx0XHRcdFx0c3VtbWFyeSxcblx0XHRcdFx0dGhpcy5nZXRGb2xkZXJEZWZhdWx0VmFsdWVzKGZpbGUpLFxuXHRcdFx0XHR0aGlzLmJ1aWxkRnJvbnRtYXR0ZXIuYmluZCh0aGlzKSxcblx0XHRcdCk7XG5cdFx0XHRpZiAobmV4dCAhPT0gbnVsbCkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLmFwcC52YXVsdC5tb2RpZnkoZmlsZSwgbmV4dCk7XG5cdFx0XHRcdHRoaXMudHJpZ2dlck1ldGFkYXRhQ2hhbmdlZChmaWxlKTtcblx0XHRcdH1cblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0bmV3IE5vdGljZShgQUkg5pGY6KaB55Sf5oiQ5aSx6LSl77yaJHtnZXRFcnJvck1lc3NhZ2UoZXJyb3IpfWApO1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jIGdlbmVyYXRlU3VtbWFyeUZvck1ldGFkYXRhQnV0dG9uKFxuXHRcdGZpbGU6IFRGaWxlLFxuXHRcdG9uRGVsdGE6IChkZWx0YTogc3RyaW5nKSA9PiB2b2lkLFxuXHRcdHNpZ25hbDogQWJvcnRTaWduYWwsXG5cdCk6IFByb21pc2U8c3RyaW5nPiB7XG5cdFx0aWYgKCF0aGlzLnNldHRpbmdzLmFpU3VtbWFyeUVuYWJsZWQpIHtcblx0XHRcdG5ldyBOb3RpY2UoXCLor7flhYjlvIDlkK8gQUkg6Ieq5Yqo5pGY6KaBXCIpO1xuXHRcdFx0cmV0dXJuIFwiXCI7XG5cdFx0fVxuXHRcdGlmICghdGhpcy5zZXR0aW5ncy5haUFwaUtleS50cmltKCkpIHtcblx0XHRcdG5ldyBOb3RpY2UoXCLor7flhYjloavlhpkgQUkg5pGY6KaBIEFQSSBLZXlcIik7XG5cdFx0XHRyZXR1cm4gXCJcIjtcblx0XHR9XG5cblx0XHRjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZChmaWxlKTtcblx0XHRjb25zdCBzdW1tYXJ5RG9jdW1lbnQgPSBnZXRTdW1tYXJ5RG9jdW1lbnQoZmlsZSwgY29udGVudCwgMSk7XG5cdFx0aWYgKCFzdW1tYXJ5RG9jdW1lbnQpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihcIuaWh+aho+WGheWuueS4uuepuu+8jOaXoOazleeUn+aIkOaRmOimgVwiKTtcblx0XHR9XG5cblx0XHRsZXQgc3VtbWFyeSA9IFwiXCI7XG5cdFx0dHJ5IHtcblx0XHRcdHN1bW1hcnkgPSBhd2FpdCBuZXcgQUlTdW1tYXJ5U2VydmljZSh0aGlzLnNldHRpbmdzKS5nZW5lcmF0ZVN1bW1hcnkoc3VtbWFyeURvY3VtZW50KTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0aWYgKHNpZ25hbC5hYm9ydGVkKSB7XG5cdFx0XHRcdHJldHVybiBcIlwiO1xuXHRcdFx0fVxuXHRcdFx0dGhyb3cgZXJyb3I7XG5cdFx0fVxuXHRcdGlmICghc3VtbWFyeSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiQUkg5pGY6KaB6L+U5Zue5Li656m6XCIpO1xuXHRcdH1cblxuXHRcdGNvbnN0IG5leHQgPSB3cml0ZVN1bW1hcnlUb0NvbnRlbnQoXG5cdFx0XHRjb250ZW50LFxuXHRcdFx0ZmlsZSxcblx0XHRcdHN1bW1hcnksXG5cdFx0XHR0aGlzLmdldEZvbGRlckRlZmF1bHRWYWx1ZXMoZmlsZSksXG5cdFx0XHR0aGlzLmJ1aWxkRnJvbnRtYXR0ZXIuYmluZCh0aGlzKSxcblx0XHQpO1xuXHRcdGlmIChuZXh0ICE9PSBudWxsKSB7XG5cdFx0XHRhd2FpdCB0aGlzLmFwcC52YXVsdC5tb2RpZnkoZmlsZSwgbmV4dCk7XG5cdFx0fVxuXHRcdHJldHVybiBzdW1tYXJ5O1xuXHR9XG5cblx0YXN5bmMgc2NhbkFJU3VtbWFyeUNhbmRpZGF0ZXModGFzazogQUlTdW1tYXJ5VGFza1R5cGUsIHNob3dOb3RpY2U6IGJvb2xlYW4pOiBQcm9taXNlPEFJU3VtbWFyeUNhbmRpZGF0ZVtdPiB7XG5cdFx0Y29uc3QgYXV0aG9yID0gdGhpcy5nZXRBSVN1bW1hcnlBdXRob3JGb3JUYXNrKHNob3dOb3RpY2UpO1xuXHRcdGlmICghYXV0aG9yKSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGF3YWl0IHRoaXMuZ2V0QUlTdW1tYXJ5Q29tcGxldGlvbkNhbmRpZGF0ZXMoYXV0aG9yKTtcblx0fVxuXG5cdGFzeW5jIGV4ZWN1dGVBSVN1bW1hcnlRdWV1ZShcblx0XHR0YXNrOiBBSVN1bW1hcnlUYXNrVHlwZSxcblx0XHRjYW5kaWRhdGVzOiBBSVN1bW1hcnlDYW5kaWRhdGVbXSxcblx0XHRzaG93Tm90aWNlOiBib29sZWFuLFxuXHRcdG9uUHJvZ3Jlc3M/OiAoKSA9PiB2b2lkLFxuXHQpOiBQcm9taXNlPG51bWJlcj4ge1xuXHRcdGlmICh0aGlzLmlzQUlTdW1tYXJ5VGFza1J1bm5pbmcodGFzaykpIHtcblx0XHRcdGlmIChzaG93Tm90aWNlKSB7XG5cdFx0XHRcdG5ldyBOb3RpY2UoXCJBSSDmkZjopoHmraPlnKjmiafooYzkuK1cIik7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gMDtcblx0XHR9XG5cblx0XHRpZiAoIXRoaXMuZ2V0QUlTdW1tYXJ5QXV0aG9yRm9yVGFzayhzaG93Tm90aWNlKSkge1xuXHRcdFx0cmV0dXJuIDA7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGF3YWl0IHRoaXMucHJvY2Vzc0FJU3VtbWFyeVF1ZXVlKHRhc2ssIGNhbmRpZGF0ZXMsIHNob3dOb3RpY2UsIG9uUHJvZ3Jlc3MpO1xuXHR9XG5cblx0aXNBSVN1bW1hcnlUYXNrUnVubmluZyh0YXNrOiBBSVN1bW1hcnlUYXNrVHlwZSk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLmFpU3VtbWFyeUNvbXBsZXRpb25SdW5uaW5nO1xuXHR9XG5cblx0cHJpdmF0ZSBjaGVja0FJU3VtbWFyeVNjaGVkdWxlKCkge1xuXHRcdGNvbnN0IG5vdyA9IG5ldyBEYXRlKCk7XG5cdFx0Y29uc3QgbWludXRlID0gbm93LmdldE1pbnV0ZXMoKTtcblx0XHRpZiAobWludXRlICE9PSAwICYmIG1pbnV0ZSAhPT0gMzApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBzbG90ID0gYCR7bm93LmdldEZ1bGxZZWFyKCl9LSR7bm93LmdldE1vbnRoKCl9LSR7bm93LmdldERhdGUoKX0tJHtub3cuZ2V0SG91cnMoKX0tJHttaW51dGV9YDtcblx0XHRpZiAoc2xvdCA9PT0gdGhpcy5sYXN0QUlTdW1tYXJ5U2NoZWR1bGVTbG90KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5sYXN0QUlTdW1tYXJ5U2NoZWR1bGVTbG90ID0gc2xvdDtcblx0XHR2b2lkIHRoaXMucnVuU2NoZWR1bGVkQUlTdW1tYXJ5VGFza3MoKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcnVuU2NoZWR1bGVkQUlTdW1tYXJ5VGFza3MoKSB7XG5cdFx0YXdhaXQgdGhpcy5ydW5TY2hlZHVsZWRBSVN1bW1hcnlUYXNrKFwiY29tcGxldGlvblwiKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcnVuU2NoZWR1bGVkQUlTdW1tYXJ5VGFzayh0YXNrOiBBSVN1bW1hcnlUYXNrVHlwZSkge1xuXHRcdGlmICh0aGlzLmlzQUlTdW1tYXJ5VGFza1J1bm5pbmcodGFzaykpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBjYW5kaWRhdGVzID0gYXdhaXQgdGhpcy5zY2FuQUlTdW1tYXJ5Q2FuZGlkYXRlcyh0YXNrLCBmYWxzZSk7XG5cdFx0aWYgKGNhbmRpZGF0ZXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0YXdhaXQgdGhpcy5wcm9jZXNzQUlTdW1tYXJ5UXVldWUodGFzaywgY2FuZGlkYXRlcywgZmFsc2UpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRBSVN1bW1hcnlBdXRob3JGb3JUYXNrKHNob3dOb3RpY2U6IGJvb2xlYW4pOiBzdHJpbmcge1xuXHRcdGlmICghdGhpcy5zZXR0aW5ncy5haVN1bW1hcnlFbmFibGVkKSB7XG5cdFx0XHRpZiAoc2hvd05vdGljZSkge1xuXHRcdFx0XHRuZXcgTm90aWNlKFwi6K+35YWI5byA5ZCvIEFJIOiHquWKqOaRmOimgVwiKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBcIlwiO1xuXHRcdH1cblx0XHRpZiAoIXRoaXMuc2V0dGluZ3MuYWlBcGlLZXkudHJpbSgpKSB7XG5cdFx0XHRpZiAoc2hvd05vdGljZSkge1xuXHRcdFx0XHRuZXcgTm90aWNlKFwi6K+35YWI5aGr5YaZIEFJIOaRmOimgSBBUEkgS2V5XCIpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIFwiXCI7XG5cdFx0fVxuXG5cdFx0Y29uc3QgYXV0aG9yID0gdGhpcy5nZXRDdXJyZW50QXV0aG9yTmFtZSgpO1xuXHRcdGlmICghYXV0aG9yKSB7XG5cdFx0XHRpZiAoc2hvd05vdGljZSkge1xuXHRcdFx0XHRuZXcgTm90aWNlKFwi6K+35YWI5Zyo44CM6K6+5aSH57uR5a6a44CN5Lit57uR5a6a5pys5py66K6+5aSHXCIpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIFwiXCI7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGF1dGhvcjtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcHJvY2Vzc0FJU3VtbWFyeVF1ZXVlKFxuXHRcdHRhc2s6IEFJU3VtbWFyeVRhc2tUeXBlLFxuXHRcdGNhbmRpZGF0ZXM6IEFJU3VtbWFyeUNhbmRpZGF0ZVtdLFxuXHRcdHNob3dOb3RpY2U6IGJvb2xlYW4sXG5cdFx0b25Qcm9ncmVzcz86ICgpID0+IHZvaWQsXG5cdCk6IFByb21pc2U8bnVtYmVyPiB7XG5cdFx0dGhpcy5zZXRBSVN1bW1hcnlUYXNrUnVubmluZyh0YXNrLCB0cnVlKTtcblx0XHRsZXQgcHJvY2Vzc2VkQ291bnQgPSAwO1xuXHRcdGxldCBjb25zZWN1dGl2ZUZhaWx1cmVzID0gMDtcblxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBzZXJ2aWNlID0gbmV3IEFJU3VtbWFyeVNlcnZpY2UodGhpcy5zZXR0aW5ncyk7XG5cdFx0XHRmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgY2FuZGlkYXRlcy5sZW5ndGg7IGluZGV4KyspIHtcblx0XHRcdFx0Y29uc3QgY2FuZGlkYXRlID0gY2FuZGlkYXRlc1tpbmRleF07XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0Y29uc3Qgc3VtbWFyeSA9IGF3YWl0IHNlcnZpY2UuZ2VuZXJhdGVTdW1tYXJ5KGNhbmRpZGF0ZS5kb2N1bWVudCk7XG5cdFx0XHRcdFx0aWYgKCFzdW1tYXJ5KSB7XG5cdFx0XHRcdFx0XHRpZiAoaW5kZXggPCBjYW5kaWRhdGVzLmxlbmd0aCAtIDEpIHtcblx0XHRcdFx0XHRcdFx0YXdhaXQgZGVsYXkoQUlfU1VNTUFSWV9SRVFVRVNUX0RFTEFZX01TKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGNvbnN0IG5leHQgPSB3cml0ZVN1bW1hcnlUb0NvbnRlbnQoXG5cdFx0XHRcdFx0XHRjYW5kaWRhdGUuY29udGVudCxcblx0XHRcdFx0XHRcdGNhbmRpZGF0ZS5maWxlLFxuXHRcdFx0XHRcdFx0c3VtbWFyeSxcblx0XHRcdFx0XHRcdHRoaXMuZ2V0Rm9sZGVyRGVmYXVsdFZhbHVlcyhjYW5kaWRhdGUuZmlsZSksXG5cdFx0XHRcdFx0XHR0aGlzLmJ1aWxkRnJvbnRtYXR0ZXIuYmluZCh0aGlzKSxcblx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdGlmIChuZXh0ICE9PSBudWxsKSB7XG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLmFwcC52YXVsdC5tb2RpZnkoY2FuZGlkYXRlLmZpbGUsIG5leHQpO1xuXHRcdFx0XHRcdFx0dGhpcy50cmlnZ2VyTWV0YWRhdGFDaGFuZ2VkKGNhbmRpZGF0ZS5maWxlKTtcblx0XHRcdFx0XHRcdHByb2Nlc3NlZENvdW50Kys7XG5cdFx0XHRcdFx0XHRjYW5kaWRhdGUuZG9uZSA9IHRydWU7XG5cdFx0XHRcdFx0XHRvblByb2dyZXNzPy4oKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Y29uc2VjdXRpdmVGYWlsdXJlcyA9IDA7XG5cdFx0XHRcdH0gY2F0Y2ggKF9lcnJvcikge1xuXHRcdFx0XHRcdGNvbnNlY3V0aXZlRmFpbHVyZXMrKztcblx0XHRcdFx0XHRpZiAoY29uc2VjdXRpdmVGYWlsdXJlcyA+PSAzKSB7XG5cdFx0XHRcdFx0XHRuZXcgTm90aWNlKFwiQUkg5pGY6KaB5pyN5Yqh5byC5bi477yM5bey5pqC5YGc5pys5qyh5Lu75YqhXCIpO1xuXHRcdFx0XHRcdFx0cmV0dXJuIHByb2Nlc3NlZENvdW50O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChpbmRleCA8IGNhbmRpZGF0ZXMubGVuZ3RoIC0gMSkge1xuXHRcdFx0XHRcdGF3YWl0IGRlbGF5KEFJX1NVTU1BUllfUkVRVUVTVF9ERUxBWV9NUyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKHNob3dOb3RpY2UpIHtcblx0XHRcdFx0bmV3IE5vdGljZShcblx0XHRcdFx0XHRwcm9jZXNzZWRDb3VudCA+IDBcblx0XHRcdFx0XHRcdD8gYEFJIOaRmOimge+8muacrOasoeWkhOeQhiAke3Byb2Nlc3NlZENvdW50fSDnr4fmlofmoaNgXG5cdFx0XHRcdFx0XHQ6IFwiQUkg5pGY6KaB77ya5pqC5peg6ZyA6KaB5aSE55CG55qE5paH5qGjXCIsXG5cdFx0XHRcdCk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBwcm9jZXNzZWRDb3VudDtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0dGhpcy5zZXRBSVN1bW1hcnlUYXNrUnVubmluZyh0YXNrLCBmYWxzZSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBzZXRBSVN1bW1hcnlUYXNrUnVubmluZyh0YXNrOiBBSVN1bW1hcnlUYXNrVHlwZSwgaXNSdW5uaW5nOiBib29sZWFuKSB7XG5cdFx0dGhpcy5haVN1bW1hcnlDb21wbGV0aW9uUnVubmluZyA9IGlzUnVubmluZztcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZ2V0QUlTdW1tYXJ5Q29tcGxldGlvbkNhbmRpZGF0ZXMoYXV0aG9yOiBzdHJpbmcpOiBQcm9taXNlPEFJU3VtbWFyeUNhbmRpZGF0ZVtdPiB7XG5cdFx0Y29uc3QgY2FuZGlkYXRlczogQUlTdW1tYXJ5Q2FuZGlkYXRlW10gPSBbXTtcblx0XHRjb25zdCBmaWxlcyA9IHRoaXMuYXBwLnZhdWx0LmdldE1hcmtkb3duRmlsZXMoKTtcblxuXHRcdGZvciAoY29uc3QgZmlsZSBvZiBmaWxlcykge1xuXHRcdFx0Y29uc3QgZnJvbnRtYXR0ZXIgPSB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShmaWxlKT8uZnJvbnRtYXR0ZXIgPz8ge307XG5cdFx0XHRpZiAoIWZyb250bWF0dGVyQXV0aG9yQ29udGFpbnMoZnJvbnRtYXR0ZXJbXCLkvZzogIVcIl0sIGF1dGhvcikgfHwgIWlzRW1wdHlGcm9udG1hdHRlclZhbHVlKGZyb250bWF0dGVyW1wi5pGY6KaBXCJdKSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LmNhY2hlZFJlYWQoZmlsZSk7XG5cdFx0XHRjb25zdCBkb2N1bWVudCA9IGdldFN1bW1hcnlEb2N1bWVudChmaWxlLCBjb250ZW50LCBNSU5fU1VNTUFSWV9CT0RZX0xFTkdUSCk7XG5cdFx0XHRpZiAoIWRvY3VtZW50KSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRjYW5kaWRhdGVzLnB1c2goeyBmaWxlLCBjb250ZW50LCBkb2N1bWVudCB9KTtcblx0XHR9XG5cblx0XHRyZXR1cm4gY2FuZGlkYXRlcztcblx0fVxuXG5cdHByaXZhdGUgdHJpZ2dlck1ldGFkYXRhQ2hhbmdlZChmaWxlOiBURmlsZSkge1xuXHRcdCh0aGlzLmFwcC5tZXRhZGF0YUNhY2hlIGFzIHsgdHJpZ2dlcjogKG5hbWU6IHN0cmluZywgZmlsZTogVEZpbGUpID0+IHZvaWQgfSkudHJpZ2dlcihcImNoYW5nZWRcIiwgZmlsZSk7XG5cdH1cblxuXHRnZXRBdXRob3JOYW1lKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuc2V0dGluZ3MuZGV2aWNlQmluZGluZ3MuZmluZCgoYmluZGluZykgPT4gYmluZGluZy51dWlkID09PSB0aGlzLmN1cnJlbnREZXZpY2VVdWlkKT8uYXV0aG9yID8/IFwiXCI7XG5cdH1cblxuXHRlbnN1cmVEZXZpY2VCb3VuZCgpOiBib29sZWFuIHtcblx0XHRpZiAodGhpcy5nZXRDdXJyZW50QXV0aG9yTmFtZSgpKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRuZXcgTm90aWNlKFwi6K+35YWI5Zyo44CM6K6+5aSH57uR5a6a44CN5Lit57uR5a6a5pys5py66K6+5aSHXCIpO1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdGdldEN1cnJlbnRBdXRob3JOYW1lKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuc2V0dGluZ3MuZGV2aWNlQmluZGluZ3MuZmluZCgoYmluZGluZykgPT4ge1xuXHRcdFx0cmV0dXJuIGJpbmRpbmcudXVpZCA9PT0gdGhpcy5jdXJyZW50RGV2aWNlVXVpZCAmJiBiaW5kaW5nLmF1dGhvcjtcblx0XHR9KT8uYXV0aG9yID8/IFwiXCI7XG5cdH1cblxuXHRidWlsZEZyb250bWF0dGVyKGNyZWF0ZWQ6IHN0cmluZywgZGVmYXVsdHM6IEZvbGRlckRlZmF1bHRWYWx1ZXMgPSB7fSk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIFtcblx0XHRcdFwiLS0tXCIsXG5cdFx0XHRg6aG555uuOiAke2RlZmF1bHRzW1wi6aG555uuXCJdID8/IFwiXCJ9YCxcblx0XHRcdFwi57G75Z6LOlwiLFxuXHRcdFx0YCAgLSAke2Zvcm1hdFlhbWxTY2FsYXIoZGVmYXVsdHNbXCLnsbvlnotcIl0gPz8gXCJcIil9YCxcblx0XHRcdFwi5L2c6ICFOlwiLFxuXHRcdFx0YCAgLSAke2Zvcm1hdFlhbWxTY2FsYXIodGhpcy5nZXRBdXRob3JOYW1lKCkpfWAsXG5cdFx0XHRcIuaRmOimgTogXCIsXG5cdFx0XHRg5Yib5bu65pe26Ze0OiAke2NyZWF0ZWR9YCxcblx0XHRcdGDmnIDlkI7mm7TmlrA6ICR7Y3JlYXRlZH1gLFxuXHRcdFx0XCItLS1cIixcblx0XHRcdFwiXCIsXG5cdFx0XS5qb2luKFwiXFxuXCIpO1xuXHR9XG5cblx0cHJpdmF0ZSBoYW5kbGVDcmVhdGUoZmlsZTogVEFic3RyYWN0RmlsZSkge1xuXHRcdGlmICghKGZpbGUgaW5zdGFuY2VvZiBURmlsZSkgfHwgZmlsZS5leHRlbnNpb24gIT09IFwibWRcIikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHRpbWVyID0gd2luZG93LnNldFRpbWVvdXQoYXN5bmMgKCkgPT4ge1xuXHRcdFx0dGhpcy5jcmVhdGVUaW1lcnMuZGVsZXRlKHRpbWVyKTtcblxuXHRcdFx0Y29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQoZmlsZSk7XG5cdFx0XHRpZiAoY29udGVudC50cmltKCkubGVuZ3RoID4gMCB8fCBoYXNGcm9udG1hdHRlcihjb250ZW50KSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGNyZWF0ZWQgPSBmb3JtYXRMb2NhbERhdGUobmV3IERhdGUoZmlsZS5zdGF0LmN0aW1lKSk7XG5cdFx0XHRhd2FpdCB0aGlzLmFwcC52YXVsdC5tb2RpZnkoZmlsZSwgdGhpcy5idWlsZEZyb250bWF0dGVyKGNyZWF0ZWQsIHRoaXMuZ2V0Rm9sZGVyRGVmYXVsdFZhbHVlcyhmaWxlKSkpO1xuXHRcdH0sIDI1MCk7XG5cblx0XHR0aGlzLmNyZWF0ZVRpbWVycy5hZGQodGltZXIpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBoYW5kbGVSZW5hbWUoZmlsZTogVEFic3RyYWN0RmlsZSwgb2xkUGF0aDogc3RyaW5nKSB7XG5cdFx0aWYgKCEoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSB8fCBmaWxlLmV4dGVuc2lvbiAhPT0gXCJtZFwiKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKGdldEZpbGVGb2xkZXIoZmlsZS5wYXRoKSA9PT0gZ2V0RmlsZUZvbGRlcihvbGRQYXRoKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGRlZmF1bHRzID0gdGhpcy5nZXRGb2xkZXJEZWZhdWx0VmFsdWVzKGZpbGUpO1xuXHRcdGlmIChPYmplY3Qua2V5cyhkZWZhdWx0cykubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0YXdhaXQgdGhpcy5hcHAudmF1bHQucHJvY2VzcyhmaWxlLCAoY29udGVudCkgPT4ge1xuXHRcdFx0Y29uc3QgbmV4dCA9IGZpbGxFbXB0eUZvbGRlckRlZmF1bHRzKGNvbnRlbnQsIGRlZmF1bHRzKTtcblx0XHRcdHJldHVybiBuZXh0ID8/IGNvbnRlbnQ7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGhhbmRsZUZpbGVNZW51KG1lbnU6IE1lbnUsIGZpbGU6IFRBYnN0cmFjdEZpbGUpIHtcblx0XHRpZiAoIShmaWxlIGluc3RhbmNlb2YgVEZvbGRlcikpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRtZW51LmFkZEl0ZW0oKGl0ZW0pID0+IHtcblx0XHRcdGl0ZW0uc2V0VGl0bGUoXCLorr7nva7lsZ7mgKfljLnphY3op4TliJlcIikub25DbGljaygoKSA9PiB7XG5cdFx0XHRcdG5ldyBGb2xkZXJSdWxlTW9kYWwodGhpcy5hcHAsIHRoaXMsIGZpbGUucGF0aCkub3BlbigpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH1cblxuXHRnZXRGb2xkZXJEZWZhdWx0VmFsdWVzKGZpbGU6IFRGaWxlKTogRm9sZGVyRGVmYXVsdFZhbHVlcyB7XG5cdFx0Y29uc3QgdmFsdWVzOiBGb2xkZXJEZWZhdWx0VmFsdWVzID0ge307XG5cdFx0Y29uc3QgZGVwdGhzOiBQYXJ0aWFsPFJlY29yZDxGb2xkZXJEZWZhdWx0RmllbGQsIG51bWJlcj4+ID0ge307XG5cdFx0Y29uc3QgZmlsZUZvbGRlciA9IGdldEZpbGVGb2xkZXIoZmlsZS5wYXRoKTtcblxuXHRcdGZvciAoY29uc3QgcnVsZSBvZiB0aGlzLnNldHRpbmdzLmZvbGRlckRlZmF1bHRzKSB7XG5cdFx0XHRpZiAoIXJ1bGUudmFsdWUgfHwgIWZvbGRlck1hdGNoZXMoZmlsZUZvbGRlciwgcnVsZS5mb2xkZXIpKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBkZXB0aCA9IGdldEZvbGRlckRlcHRoKHJ1bGUuZm9sZGVyKTtcblx0XHRcdGlmIChkZXB0aCA+PSAoZGVwdGhzW3J1bGUuZmllbGRdID8/IC0xKSkge1xuXHRcdFx0XHR2YWx1ZXNbcnVsZS5maWVsZF0gPSBydWxlLnZhbHVlO1xuXHRcdFx0XHRkZXB0aHNbcnVsZS5maWVsZF0gPSBkZXB0aDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdmFsdWVzO1xuXHR9XG5cblx0Y3JlYXRlRm9sZGVyUnVsZShmb2xkZXIgPSBcIlwiLCBmaWVsZDogRm9sZGVyRGVmYXVsdEZpZWxkID0gXCLpobnnm65cIiwgdmFsdWUgPSBcIlwiKTogRm9sZGVyRGVmYXVsdFJ1bGUge1xuXHRcdGNvbnN0IG5vdyA9IGZvcm1hdExvY2FsRGF0ZShuZXcgRGF0ZSgpKTtcblx0XHRjb25zdCBhdXRob3IgPSB0aGlzLmdldEN1cnJlbnRBdXRob3JOYW1lKCk7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGZvbGRlcixcblx0XHRcdGZpZWxkLFxuXHRcdFx0dmFsdWUsXG5cdFx0XHRjcmVhdGVkQnk6IGF1dGhvcixcblx0XHRcdGNyZWF0ZWRBdDogbm93LFxuXHRcdFx0bW9kaWZpZWRCeTogYXV0aG9yLFxuXHRcdFx0bW9kaWZpZWRBdDogbm93LFxuXHRcdH07XG5cdH1cblxuXHR0b3VjaEZvbGRlclJ1bGUocnVsZTogRm9sZGVyRGVmYXVsdFJ1bGUpIHtcblx0XHRydWxlLm1vZGlmaWVkQnkgPSB0aGlzLmdldEN1cnJlbnRBdXRob3JOYW1lKCk7XG5cdFx0cnVsZS5tb2RpZmllZEF0ID0gZm9ybWF0TG9jYWxEYXRlKG5ldyBEYXRlKCkpO1xuXHR9XG5cblx0YXN5bmMgdXBzZXJ0Rm9sZGVyUnVsZShmb2xkZXI6IHN0cmluZywgZmllbGQ6IEZvbGRlckRlZmF1bHRGaWVsZCwgdmFsdWU6IHN0cmluZykge1xuXHRcdGNvbnN0IGV4aXN0aW5nID0gdGhpcy5zZXR0aW5ncy5mb2xkZXJEZWZhdWx0cy5maW5kKChydWxlKSA9PiB7XG5cdFx0XHRyZXR1cm4gcnVsZS5mb2xkZXIgPT09IGZvbGRlciAmJiBydWxlLmZpZWxkID09PSBmaWVsZDtcblx0XHR9KTtcblxuXHRcdGlmIChleGlzdGluZykge1xuXHRcdFx0ZXhpc3RpbmcudmFsdWUgPSB2YWx1ZTtcblx0XHRcdHRoaXMudG91Y2hGb2xkZXJSdWxlKGV4aXN0aW5nKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5zZXR0aW5ncy5mb2xkZXJEZWZhdWx0cy5wdXNoKHRoaXMuY3JlYXRlRm9sZGVyUnVsZShmb2xkZXIsIGZpZWxkLCB2YWx1ZSkpO1xuXHRcdH1cblxuXHRcdGF3YWl0IHRoaXMuc2F2ZVNldHRpbmdzKCk7XG5cdH1cblxuXHRwcml2YXRlIG1pZ3JhdGVBdXRob3JTZXR0aW5ncygpIHtcblx0XHRpZiAodGhpcy5zZXR0aW5ncy5kZXZpY2VCaW5kaW5ncy5sZW5ndGggPiAwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgYXV0aG9yID0gZ2V0TGVnYWN5QXV0aG9yTmFtZSh0aGlzLnNldHRpbmdzKTtcblx0XHRpZiAoYXV0aG9yKSB7XG5cdFx0XHR0aGlzLnNldHRpbmdzLmRldmljZUJpbmRpbmdzLnB1c2goe1xuXHRcdFx0XHR1dWlkOiB0aGlzLmN1cnJlbnREZXZpY2VVdWlkLFxuXHRcdFx0XHRhdXRob3IsXG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGVuc3VyZUN1cnJlbnREZXZpY2VCaW5kaW5nKCkge1xuXHRcdGlmICh0aGlzLnNldHRpbmdzLmRldmljZUJpbmRpbmdzLmxlbmd0aCA+IDApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLnNldHRpbmdzLmRldmljZUJpbmRpbmdzLnB1c2goe1xuXHRcdFx0dXVpZDogdGhpcy5jdXJyZW50RGV2aWNlVXVpZCxcblx0XHRcdGF1dGhvcjogXCJcIixcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgbWlncmF0ZUZvbGRlckRlZmF1bHRSdWxlcygpIHtcblx0XHRjb25zdCBydWxlczogRm9sZGVyRGVmYXVsdFJ1bGVbXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgcnVsZSBvZiB0aGlzLnNldHRpbmdzLmZvbGRlckRlZmF1bHRzKSB7XG5cdFx0XHRpZiAocnVsZS5maWVsZHMpIHtcblx0XHRcdFx0Zm9yIChjb25zdCBmaWVsZFNldHRpbmcgb2YgcnVsZS5maWVsZHMpIHtcblx0XHRcdFx0XHRydWxlcy5wdXNoKHtcblx0XHRcdFx0XHRcdGZvbGRlcjogcnVsZS5mb2xkZXIsXG5cdFx0XHRcdFx0XHRmaWVsZDogZmllbGRTZXR0aW5nLmZpZWxkLFxuXHRcdFx0XHRcdFx0dmFsdWU6IGZpZWxkU2V0dGluZy52YWx1ZSxcblx0XHRcdFx0XHRcdGNyZWF0ZWRCeTogcnVsZS5jcmVhdGVkQnksXG5cdFx0XHRcdFx0XHRjcmVhdGVkQXQ6IHJ1bGUuY3JlYXRlZEF0LFxuXHRcdFx0XHRcdFx0bW9kaWZpZWRCeTogcnVsZS5tb2RpZmllZEJ5LFxuXHRcdFx0XHRcdFx0bW9kaWZpZWRBdDogcnVsZS5tb2RpZmllZEF0LFxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRydWxlcy5wdXNoKHJ1bGUpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHR0aGlzLnNldHRpbmdzLmZvbGRlckRlZmF1bHRzID0gcnVsZXM7XG5cdH1cblxuXHRwcml2YXRlIG1pZ3JhdGVBSVN1bW1hcnlQcm9tcHQoKSB7XG5cdFx0aWYgKFxuXHRcdFx0dGhpcy5zZXR0aW5ncy5haVN1bW1hcnlQcm9tcHQgPT09IE9MRF9BSV9TVU1NQVJZX1BST01QVCB8fFxuXHRcdFx0dGhpcy5zZXR0aW5ncy5haVN1bW1hcnlQcm9tcHQgPT09IFBSRVZJT1VTX0FJX1NVTU1BUllfUFJPTVBUXG5cdFx0KSB7XG5cdFx0XHR0aGlzLnNldHRpbmdzLmFpU3VtbWFyeVByb21wdCA9IERFRkFVTFRfQUlfU1VNTUFSWV9QUk9NUFQ7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgY2hlY2tGb3JVcGRhdGUoKTogUHJvbWlzZTx7IGhhc1VwZGF0ZTogYm9vbGVhbjsgdmVyc2lvbjogc3RyaW5nOyBlcnJvcj86IHN0cmluZyB9PiB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goYCR7R0lUSFVCX1JBV19CQVNFfS9tYW5pZmVzdC5qc29uYCk7XG5cblx0XHRcdGlmIChyZXNwb25zZS5zdGF0dXMgPT09IDQwNCkge1xuXHRcdFx0XHRyZXR1cm4geyBoYXNVcGRhdGU6IGZhbHNlLCB2ZXJzaW9uOiBcIlwiLCBlcnJvcjogXCJub3RfZm91bmRcIiB9O1xuXHRcdFx0fVxuXHRcdFx0aWYgKCFyZXNwb25zZS5vaykge1xuXHRcdFx0XHRyZXR1cm4geyBoYXNVcGRhdGU6IGZhbHNlLCB2ZXJzaW9uOiBcIlwiLCBlcnJvcjogYOivt+axguWksei0pe+8miR7cmVzcG9uc2Uuc3RhdHVzfWAgfTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgcmVtb3RlTWFuaWZlc3QgPSBhd2FpdCByZXNwb25zZS5qc29uKCkgYXMgeyB2ZXJzaW9uPzogc3RyaW5nIH07XG5cdFx0XHRjb25zdCByZW1vdGVWZXJzaW9uID0gcmVtb3RlTWFuaWZlc3QudmVyc2lvbiA/PyBcIlwiO1xuXHRcdFx0aWYgKCFyZW1vdGVWZXJzaW9uKSB7XG5cdFx0XHRcdHJldHVybiB7IGhhc1VwZGF0ZTogZmFsc2UsIHZlcnNpb246IFwiXCIsIGVycm9yOiBcIui/nOerr+eJiOacrOWPt+aXoOaViFwiIH07XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGN1cnJlbnRWZXJzaW9uID0gdGhpcy5tYW5pZmVzdC52ZXJzaW9uO1xuXHRcdFx0Y29uc3QgaGFzVXBkYXRlID0gdGhpcy5jb21wYXJlVmVyc2lvbnMocmVtb3RlVmVyc2lvbiwgY3VycmVudFZlcnNpb24pID4gMDtcblx0XHRcdHJldHVybiB7IGhhc1VwZGF0ZSwgdmVyc2lvbjogcmVtb3RlVmVyc2lvbiB9O1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRyZXR1cm4geyBoYXNVcGRhdGU6IGZhbHNlLCB2ZXJzaW9uOiBcIlwiLCBlcnJvcjogZ2V0RXJyb3JNZXNzYWdlKGVycm9yKSB9O1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jIHBlcmZvcm1VcGRhdGUodmVyc2lvbjogc3RyaW5nLCBvblByb2dyZXNzPzogKHN0ZXA6IG51bWJlciwgdG90YWw6IG51bWJlcikgPT4gdm9pZCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGZpbGVzID0gW1wibWFpbi5qc1wiLCBcIm1hbmlmZXN0Lmpzb25cIiwgXCJzdHlsZXMuY3NzXCJdIGFzIGNvbnN0O1xuXHRcdGNvbnN0IGNvbnRlbnRzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge307XG5cblx0XHRmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgZmlsZXMubGVuZ3RoOyBpbmRleCsrKSB7XG5cdFx0XHRjb25zdCBmaWxlID0gZmlsZXNbaW5kZXhdO1xuXHRcdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChgJHtHSVRIVUJfUkFXX0JBU0V9LyR7ZmlsZX1gKTtcblx0XHRcdGlmICghcmVzcG9uc2Uub2spIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGDkuIvovb0gJHtmaWxlfSDlpLHotKXvvJoke3Jlc3BvbnNlLnN0YXR1c31gKTtcblx0XHRcdH1cblx0XHRcdGNvbnRlbnRzW2ZpbGVdID0gYXdhaXQgcmVzcG9uc2UudGV4dCgpO1xuXHRcdFx0b25Qcm9ncmVzcz8uKGluZGV4ICsgMSwgZmlsZXMubGVuZ3RoKTtcblx0XHR9XG5cblx0XHRjb25zdCBwbHVnaW5EaXIgPSB0aGlzLm1hbmlmZXN0LmRpcjtcblx0XHRpZiAoIXBsdWdpbkRpcikge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwi5peg5rOV6I635Y+W5o+S5Lu255uu5b2VXCIpO1xuXHRcdH1cblxuXHRcdGF3YWl0IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIud3JpdGUoYCR7cGx1Z2luRGlyfS9tYWluLmpzYCwgY29udGVudHNbXCJtYWluLmpzXCJdKTtcblx0XHRhd2FpdCB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLndyaXRlKGAke3BsdWdpbkRpcn0vbWFuaWZlc3QuanNvbmAsIGNvbnRlbnRzW1wibWFuaWZlc3QuanNvblwiXSk7XG5cdFx0YXdhaXQgdGhpcy5hcHAudmF1bHQuYWRhcHRlci53cml0ZShgJHtwbHVnaW5EaXJ9L3N0eWxlcy5jc3NgLCBjb250ZW50c1tcInN0eWxlcy5jc3NcIl0pO1xuXG5cdFx0Y29uc3QgcGx1Z2luSWQgPSB0aGlzLm1hbmlmZXN0LmlkO1xuXHRcdGNvbnN0IGFwcCA9IHRoaXMuYXBwO1xuXHRcdG5ldyBOb3RpY2UoYOabtOaWsOWujOaIkO+8iCR7dmVyc2lvbn3vvInvvIzmraPlnKjph43ovb3mj5Lku7YuLi5gKTtcblxuXHRcdHdpbmRvdy5zZXRUaW1lb3V0KGFzeW5jICgpID0+IHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdC8vIDEuIOWNuOi9veaPkuS7tlxuXHRcdFx0XHQvLyBAdHMtaWdub3JlIOKAlCDlhoXpg6ggQVBJXG5cdFx0XHRcdGF3YWl0IGFwcC5wbHVnaW5zLnVubG9hZFBsdWdpbihwbHVnaW5JZCk7XG5cblx0XHRcdFx0Ly8gMi4g5riF6Zmk5YaF5a2Y5Lit55qE5penIG1hbmlmZXN0IOe8k+WtmFxuXHRcdFx0XHQvLyBAdHMtaWdub3JlIOKAlCDlhoXpg6ggQVBJXG5cdFx0XHRcdGRlbGV0ZSBhcHAucGx1Z2lucy5tYW5pZmVzdHNbcGx1Z2luSWRdO1xuXG5cdFx0XHRcdGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB3aW5kb3cuc2V0VGltZW91dChyZXNvbHZlLCAzMDApKTtcblxuXHRcdFx0XHQvLyAzLiDph43mlrDor7vlj5bno4Hnm5jkuIrnmoQgbWFuaWZlc3Rcblx0XHRcdFx0Ly8gQHRzLWlnbm9yZSDigJQg5YaF6YOoIEFQSVxuXHRcdFx0XHRhd2FpdCBhcHAucGx1Z2lucy5sb2FkTWFuaWZlc3RzKCk7XG5cblx0XHRcdFx0YXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHdpbmRvdy5zZXRUaW1lb3V0KHJlc29sdmUsIDMwMCkpO1xuXG5cdFx0XHRcdC8vIDQuIOmHjeaWsOWKoOi9veW5tuWQr+eUqOaPkuS7tlxuXHRcdFx0XHQvLyBAdHMtaWdub3JlIOKAlCDlhoXpg6ggQVBJXG5cdFx0XHRcdGF3YWl0IGFwcC5wbHVnaW5zLmxvYWRQbHVnaW4ocGx1Z2luSWQpO1xuXHRcdFx0XHQvLyBAdHMtaWdub3JlIOKAlCDlhoXpg6ggQVBJXG5cdFx0XHRcdGF3YWl0IGFwcC5wbHVnaW5zLmVuYWJsZVBsdWdpbihwbHVnaW5JZCk7XG5cblx0XHRcdFx0YXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHdpbmRvdy5zZXRUaW1lb3V0KHJlc29sdmUsIDUwMCkpO1xuXG5cdFx0XHRcdC8vIDUuIOaJk+W8gOiuvue9rumhtVxuXHRcdFx0XHQvLyBAdHMtaWdub3JlIOKAlCDlhoXpg6ggQVBJXG5cdFx0XHRcdGFwcC5zZXR0aW5nLm9wZW4oKTtcblx0XHRcdFx0Ly8gQHRzLWlnbm9yZSDigJQg5YaF6YOoIEFQSVxuXHRcdFx0XHRhcHAuc2V0dGluZy5vcGVuVGFiQnlJZChwbHVnaW5JZCk7XG5cblx0XHRcdFx0bmV3IE5vdGljZShg5o+S5Lu25bey6YeN6L295YiwICR7dmVyc2lvbn1gKTtcblx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0Y29uc29sZS5lcnJvcihcIlthdXRvLWZyb250bWF0dGVyXSDph43ovb3lpLHotKU6XCIsIGUpO1xuXHRcdFx0XHRuZXcgTm90aWNlKFwi6Ieq5Yqo6YeN6L295aSx6LSl77yM6K+354K55Ye75bey5a6J6KOF5o+S5Lu26aG155qE44CM6YeN5paw5Yqg6L295o+S5Lu244CN5oyJ6ZKuXCIpO1xuXHRcdFx0fVxuXHRcdH0sIDEwMCk7XG5cdH1cblxuXHRwcml2YXRlIGNvbXBhcmVWZXJzaW9ucyh2MTogc3RyaW5nLCB2Mjogc3RyaW5nKTogbnVtYmVyIHtcblx0XHRjb25zdCBwYXJzZVZlcnNpb24gPSAodmVyc2lvbjogc3RyaW5nKTogbnVtYmVyW10gPT4ge1xuXHRcdFx0cmV0dXJuIHZlcnNpb25cblx0XHRcdFx0LnJlcGxhY2UoL152LywgXCJcIilcblx0XHRcdFx0LnNwbGl0KFwiLlwiKVxuXHRcdFx0XHQubWFwKChwYXJ0KSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgbWF0Y2ggPSAvXlxcZCsvLmV4ZWMocGFydCk7XG5cdFx0XHRcdFx0cmV0dXJuIG1hdGNoID8gcGFyc2VJbnQobWF0Y2hbMF0sIDEwKSA6IDA7XG5cdFx0XHRcdH0pO1xuXHRcdH07XG5cblx0XHRjb25zdCBwYXJ0czEgPSBwYXJzZVZlcnNpb24odjEpO1xuXHRcdGNvbnN0IHBhcnRzMiA9IHBhcnNlVmVyc2lvbih2Mik7XG5cdFx0Y29uc3QgbWF4TGVuZ3RoID0gTWF0aC5tYXgocGFydHMxLmxlbmd0aCwgcGFydHMyLmxlbmd0aCk7XG5cblx0XHRmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgbWF4TGVuZ3RoOyBpbmRleCsrKSB7XG5cdFx0XHRjb25zdCBhID0gcGFydHMxW2luZGV4XSA/PyAwO1xuXHRcdFx0Y29uc3QgYiA9IHBhcnRzMltpbmRleF0gPz8gMDtcblx0XHRcdGlmIChhID4gYikgcmV0dXJuIDE7XG5cdFx0XHRpZiAoYSA8IGIpIHJldHVybiAtMTtcblx0XHR9XG5cdFx0cmV0dXJuIDA7XG5cdH1cblxuXHRwcml2YXRlIHNjaGVkdWxlVXBkYXRlZEZpZWxkUmVmcmVzaChmaWxlOiBURmlsZSB8IG51bGwpIHtcblx0XHR0aGlzLmNsZWFyVXBkYXRlVGltZXIoKTtcblxuXHRcdGlmICghZmlsZSB8fCBmaWxlLmV4dGVuc2lvbiAhPT0gXCJtZFwiKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy51cGRhdGVGaWxlUGF0aCA9IGZpbGUucGF0aDtcblx0XHR0aGlzLnVwZGF0ZVRpbWVyID0gd2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0Y29uc3QgYWN0aXZlRmlsZSA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVGaWxlKCk7XG5cdFx0XHRpZiAoIWFjdGl2ZUZpbGUgfHwgYWN0aXZlRmlsZS5wYXRoICE9PSB0aGlzLnVwZGF0ZUZpbGVQYXRoKSB7XG5cdFx0XHRcdHRoaXMuY2xlYXJVcGRhdGVUaW1lcigpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHBhdGggPSB0aGlzLnVwZGF0ZUZpbGVQYXRoO1xuXHRcdFx0dGhpcy5jbGVhclVwZGF0ZVRpbWVyKCk7XG5cdFx0XHR0aGlzLnJlZnJlc2hVcGRhdGVkRmllbGQocGF0aCk7XG5cdFx0fSwgNTAwMCk7XG5cdH1cblxuXHRwcml2YXRlIGNsZWFyVXBkYXRlVGltZXIoKSB7XG5cdFx0aWYgKHRoaXMudXBkYXRlVGltZXIgIT09IG51bGwpIHtcblx0XHRcdHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy51cGRhdGVUaW1lcik7XG5cdFx0XHR0aGlzLnVwZGF0ZVRpbWVyID0gbnVsbDtcblx0XHR9XG5cdFx0dGhpcy51cGRhdGVGaWxlUGF0aCA9IG51bGw7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHJlZnJlc2hVcGRhdGVkRmllbGQocGF0aDogc3RyaW5nKSB7XG5cdFx0Y29uc3QgZmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChwYXRoKTtcblx0XHRpZiAoIShmaWxlIGluc3RhbmNlb2YgVEZpbGUpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0YXdhaXQgdGhpcy5hcHAudmF1bHQucHJvY2VzcyhmaWxlLCAoY29udGVudCkgPT4ge1xuXHRcdFx0Y29uc3QgbmV4dCA9IHVwZGF0ZUZyb250bWF0dGVyVXBkYXRlZChjb250ZW50LCBmb3JtYXRMb2NhbERhdGUobmV3IERhdGUoKSkpO1xuXHRcdFx0cmV0dXJuIG5leHQgPz8gY29udGVudDtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgc2NoZWR1bGVFbXB0eUZpZWxkSGlnaGxpZ2h0Q2hlY2soKSB7XG5cdFx0aWYgKHRoaXMuaGlnaGxpZ2h0VGltZXIgIT09IG51bGwpIHtcblx0XHRcdHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy5oaWdobGlnaHRUaW1lcik7XG5cdFx0XHR0aGlzLmhpZ2hsaWdodFRpbWVyID0gbnVsbDtcblx0XHR9XG5cblx0XHRjb25zdCBhY3RpdmVGaWxlID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKTtcblx0XHRjb25zdCBhY3RpdmVQYXRoID0gYWN0aXZlRmlsZT8ucGF0aCA/PyBudWxsO1xuXHRcdGlmICh0aGlzLmhpZ2hsaWdodEZpbGVQYXRoICE9PSBhY3RpdmVQYXRoKSB7XG5cdFx0XHR0aGlzLmNsZWFyRW1wdHlGaWVsZEhpZ2hsaWdodHMoKTtcblx0XHRcdHRoaXMuY2xlYXJIaWdobGlnaHRJbnRlcnZhbCgpO1xuXHRcdFx0dGhpcy5oaWdobGlnaHRGaWxlUGF0aCA9IGFjdGl2ZVBhdGg7XG5cdFx0fVxuXG5cdFx0aWYgKFxuXHRcdFx0IXRoaXMuc2V0dGluZ3MuZW1wdHlGaWVsZEhpZ2hsaWdodCB8fFxuXHRcdFx0IWFjdGl2ZUZpbGUgfHxcblx0XHRcdGFjdGl2ZUZpbGUuZXh0ZW5zaW9uICE9PSBcIm1kXCJcblx0XHQpIHtcblx0XHRcdHRoaXMuY2xlYXJIaWdobGlnaHRJbnRlcnZhbCgpO1xuXHRcdFx0dGhpcy5jbGVhckVtcHR5RmllbGRIaWdobGlnaHRzKCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5oaWdobGlnaHRUaW1lciA9IHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdHRoaXMuaGlnaGxpZ2h0VGltZXIgPSBudWxsO1xuXHRcdFx0dGhpcy5hcHBseUVtcHR5RmllbGRIaWdobGlnaHRzKCk7XG5cdFx0XHR0aGlzLmVuc3VyZUhpZ2hsaWdodEludGVydmFsKCk7XG5cdFx0fSwgMzAwKTtcblx0fVxuXG5cdHByaXZhdGUgc2NoZWR1bGVGb2xkZXJDaGVja21hcmtSZWZyZXNoKCkge1xuXHRcdHRoaXMuY2xlYXJGb2xkZXJDaGVja21hcmtUaW1lcigpO1xuXHRcdHRoaXMuZm9sZGVyQ2hlY2ttYXJrVGltZXIgPSB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHR0aGlzLmZvbGRlckNoZWNrbWFya1RpbWVyID0gbnVsbDtcblx0XHRcdHRoaXMuYXBwbHlGb2xkZXJDaGVja21hcmtzKCk7XG5cdFx0fSwgMCk7XG5cdH1cblxuXHRwcml2YXRlIGNsZWFyRm9sZGVyQ2hlY2ttYXJrVGltZXIoKSB7XG5cdFx0aWYgKHRoaXMuZm9sZGVyQ2hlY2ttYXJrVGltZXIgIT09IG51bGwpIHtcblx0XHRcdHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy5mb2xkZXJDaGVja21hcmtUaW1lcik7XG5cdFx0XHR0aGlzLmZvbGRlckNoZWNrbWFya1RpbWVyID0gbnVsbDtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFwcGx5Rm9sZGVyQ2hlY2ttYXJrcygpIHtcblx0XHR0aGlzLmNsZWFyRm9sZGVyQ2hlY2ttYXJrcygpO1xuXHRcdGlmICghdGhpcy5zZXR0aW5ncy5zaG93Rm9sZGVyQ2hlY2ttYXJrKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgcnVsZUZvbGRlcnMgPSBuZXcgU2V0KFxuXHRcdFx0dGhpcy5zZXR0aW5ncy5mb2xkZXJEZWZhdWx0c1xuXHRcdFx0XHQubWFwKChydWxlKSA9PiBydWxlLmZvbGRlcilcblx0XHRcdFx0LmZpbHRlcigoZm9sZGVyKSA9PiBmb2xkZXIubGVuZ3RoID4gMCksXG5cdFx0KTtcblx0XHRpZiAocnVsZUZvbGRlcnMuc2l6ZSA9PT0gMCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGZvbGRlclRpdGxlcyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTEVsZW1lbnQ+KFwiLm5hdi1mb2xkZXItdGl0bGVcIik7XG5cdFx0Zm9yIChjb25zdCB0aXRsZUVsIG9mIEFycmF5LmZyb20oZm9sZGVyVGl0bGVzKSkge1xuXHRcdFx0Y29uc3QgZm9sZGVyUGF0aCA9XG5cdFx0XHRcdHRpdGxlRWwuZ2V0QXR0cmlidXRlKFwiZGF0YS1wYXRoXCIpID8/XG5cdFx0XHRcdHRpdGxlRWwuY2xvc2VzdChcIi5uYXYtZm9sZGVyXCIpPy5nZXRBdHRyaWJ1dGUoXCJkYXRhLXBhdGhcIikgPz9cblx0XHRcdFx0XCJcIjtcblx0XHRcdGlmICghcnVsZUZvbGRlcnMuaGFzKGZvbGRlclBhdGgpKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHR0aXRsZUVsLmNyZWF0ZVNwYW4oe1xuXHRcdFx0XHRjbHM6IFwiZnJvbnRtYXR0ZXItZm9sZGVyLWNoZWNrXCIsXG5cdFx0XHRcdHRleHQ6IFwi4pyTXCIsXG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGNsZWFyRm9sZGVyQ2hlY2ttYXJrcygpIHtcblx0XHRkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiLmZyb250bWF0dGVyLWZvbGRlci1jaGVja1wiKS5mb3JFYWNoKChlbCkgPT4ge1xuXHRcdFx0ZWwucmVtb3ZlKCk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGVuc3VyZUhpZ2hsaWdodEludGVydmFsKCkge1xuXHRcdGlmICh0aGlzLmhpZ2hsaWdodEludGVydmFsICE9PSBudWxsKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5oaWdobGlnaHRJbnRlcnZhbCA9IHdpbmRvdy5zZXRJbnRlcnZhbCgoKSA9PiB7XG5cdFx0XHR0aGlzLmFwcGx5RW1wdHlGaWVsZEhpZ2hsaWdodHMoKTtcblx0XHR9LCAyMDAwKTtcblx0fVxuXG5cdHByaXZhdGUgY2xlYXJIaWdobGlnaHRUaW1lcnMoKSB7XG5cdFx0aWYgKHRoaXMuaGlnaGxpZ2h0VGltZXIgIT09IG51bGwpIHtcblx0XHRcdHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy5oaWdobGlnaHRUaW1lcik7XG5cdFx0XHR0aGlzLmhpZ2hsaWdodFRpbWVyID0gbnVsbDtcblx0XHR9XG5cdFx0dGhpcy5jbGVhckhpZ2hsaWdodEludGVydmFsKCk7XG5cdH1cblxuXHRwcml2YXRlIGNsZWFySGlnaGxpZ2h0SW50ZXJ2YWwoKSB7XG5cdFx0aWYgKHRoaXMuaGlnaGxpZ2h0SW50ZXJ2YWwgIT09IG51bGwpIHtcblx0XHRcdHdpbmRvdy5jbGVhckludGVydmFsKHRoaXMuaGlnaGxpZ2h0SW50ZXJ2YWwpO1xuXHRcdFx0dGhpcy5oaWdobGlnaHRJbnRlcnZhbCA9IG51bGw7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhcHBseUVtcHR5RmllbGRIaWdobGlnaHRzKCkge1xuXHRcdGNvbnN0IGFjdGl2ZUZpbGUgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlRmlsZSgpO1xuXHRcdGlmIChcblx0XHRcdCF0aGlzLnNldHRpbmdzLmVtcHR5RmllbGRIaWdobGlnaHQgfHxcblx0XHRcdCFhY3RpdmVGaWxlIHx8XG5cdFx0XHRhY3RpdmVGaWxlLmV4dGVuc2lvbiAhPT0gXCJtZFwiXG5cdFx0KSB7XG5cdFx0XHR0aGlzLmNsZWFySGlnaGxpZ2h0SW50ZXJ2YWwoKTtcblx0XHRcdHRoaXMuY2xlYXJFbXB0eUZpZWxkSGlnaGxpZ2h0cygpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGZyb250bWF0dGVyID0gdGhpcy5hcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoYWN0aXZlRmlsZSk/LmZyb250bWF0dGVyID8/IHt9O1xuXHRcdGNvbnN0IGVtcHR5RmllbGRzID0gbmV3IFNldChcblx0XHRcdEhJR0hMSUdIVF9GSUVMRFMuZmlsdGVyKChmaWVsZCkgPT4gaXNFbXB0eUZyb250bWF0dGVyVmFsdWUoZnJvbnRtYXR0ZXJbZmllbGRdKSksXG5cdFx0KTtcblx0XHR0aGlzLnVwZGF0ZUVtcHR5RmllbGRIaWdobGlnaHRzKGVtcHR5RmllbGRzKTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlRW1wdHlGaWVsZEhpZ2hsaWdodHMoZW1wdHlGaWVsZHM6IFNldDxIaWdobGlnaHRGaWVsZD4pIHtcblx0XHRjb25zdCBjb250YWluZXJzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbDxIVE1MRWxlbWVudD4oXCIubWV0YWRhdGEtY29udGFpbmVyXCIpO1xuXHRcdGZvciAoY29uc3QgY29udGFpbmVyIG9mIEFycmF5LmZyb20oY29udGFpbmVycykpIHtcblx0XHRcdEFycmF5LmZyb20oY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3JBbGwoXCIuZnJvbnRtYXR0ZXItZW1wdHktaGlnaGxpZ2h0XCIpKS5mb3JFYWNoKChlbCkgPT4ge1xuXHRcdFx0XHRyZW1vdmVFbXB0eUhpZ2hsaWdodENsYXNzZXMoZWwpO1xuXHRcdFx0fSk7XG5cblx0XHRcdGNvbnN0IGVtcHR5Um93cyA9IEFycmF5LmZyb20oZW1wdHlGaWVsZHMpXG5cdFx0XHRcdC5tYXAoKGZpZWxkKSA9PiBmaW5kTWV0YWRhdGFSb3coY29udGFpbmVyLCBmaWVsZCkpXG5cdFx0XHRcdC5maWx0ZXIoKHJvdyk6IHJvdyBpcyBIVE1MRWxlbWVudCA9PiByb3cgIT09IG51bGwpXG5cdFx0XHRcdC5zb3J0KChhLCBiKSA9PiBnZXREb2N1bWVudE9yZGVyKGEsIGIpKTtcblxuXHRcdFx0Zm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IGVtcHR5Um93cy5sZW5ndGg7IGluZGV4KyspIHtcblx0XHRcdFx0ZW1wdHlSb3dzW2luZGV4XS5jbGFzc0xpc3QuYWRkKFxuXHRcdFx0XHRcdFwiZnJvbnRtYXR0ZXItZW1wdHktaGlnaGxpZ2h0XCIsXG5cdFx0XHRcdFx0YGZyb250bWF0dGVyLWVtcHR5LSR7KGluZGV4ICUgSElHSExJR0hUX0ZJRUxEUy5sZW5ndGgpICsgMX1gLFxuXHRcdFx0XHQpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgY2xlYXJFbXB0eUZpZWxkSGlnaGxpZ2h0cygpIHtcblx0XHRkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiLmZyb250bWF0dGVyLWVtcHR5LWhpZ2hsaWdodFwiKS5mb3JFYWNoKChlbCkgPT4ge1xuXHRcdFx0cmVtb3ZlRW1wdHlIaWdobGlnaHRDbGFzc2VzKGVsKTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgc2NoZWR1bGVBSVN1bW1hcnlCdXR0b25SZWZyZXNoKCkge1xuXHRcdHRoaXMuY2xlYXJBSVN1bW1hcnlCdXR0b25UaW1lcigpO1xuXHRcdHRoaXMuYWJvcnRBSVN1bW1hcnlTdHJlYW0oKTtcblx0XHR0aGlzLmFpQnV0dG9uVGltZXIgPSB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHR0aGlzLmFpQnV0dG9uVGltZXIgPSBudWxsO1xuXHRcdFx0dGhpcy5hZGRBSVN1bW1hcnlCdXR0b24oKTtcblx0XHR9LCAzMDApO1xuXHR9XG5cblx0cHJpdmF0ZSBzY2hlZHVsZURlbGF5ZWRBSVN1bW1hcnlCdXR0b25SZWZyZXNoKCkge1xuXHRcdHRoaXMuY2xlYXJBSVN1bW1hcnlCdXR0b25UaW1lcigpO1xuXHRcdHRoaXMuYWlCdXR0b25UaW1lciA9IHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdHRoaXMuYWlCdXR0b25UaW1lciA9IG51bGw7XG5cdFx0XHR0aGlzLmFkZEFJU3VtbWFyeUJ1dHRvbigpO1xuXHRcdH0sIDEwMDApO1xuXHR9XG5cblx0cHJpdmF0ZSBjbGVhckFJU3VtbWFyeUJ1dHRvblRpbWVyKCkge1xuXHRcdGlmICh0aGlzLmFpQnV0dG9uVGltZXIgIT09IG51bGwpIHtcblx0XHRcdHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy5haUJ1dHRvblRpbWVyKTtcblx0XHRcdHRoaXMuYWlCdXR0b25UaW1lciA9IG51bGw7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBjbGVhckFJU3VtbWFyeUJ1dHRvbnMoKSB7XG5cdFx0ZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChcIi5mcm9udG1hdHRlci1haS1zdW1tYXJ5LWJ0biwgLmZyb250bWF0dGVyLWFpLXN1bW1hcnktY29uZmlybVwiKS5mb3JFYWNoKChlbCkgPT4ge1xuXHRcdFx0ZWwucmVtb3ZlKCk7XG5cdFx0fSk7XG5cdFx0ZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChcIi5mcm9udG1hdHRlci1haS1zdW1tYXJ5LXJvd1wiKS5mb3JFYWNoKChlbCkgPT4ge1xuXHRcdFx0Y29uc3Qgcm93ID0gZWwgYXMgSFRNTEVsZW1lbnQgJiB7XG5cdFx0XHRcdGZyb250bWF0dGVyQWlGb2N1c0hhbmRsZXI/OiBFdmVudExpc3RlbmVyO1xuXHRcdFx0XHRmcm9udG1hdHRlckFpQmx1ckhhbmRsZXI/OiBFdmVudExpc3RlbmVyO1xuXHRcdFx0fTtcblx0XHRcdGNvbnN0IHZhbHVlRWwgPSBmaW5kTWV0YWRhdGFWYWx1ZUNvbnRhaW5lcihyb3cpO1xuXHRcdFx0aWYgKHZhbHVlRWwgJiYgcm93LmZyb250bWF0dGVyQWlGb2N1c0hhbmRsZXIpIHtcblx0XHRcdFx0dmFsdWVFbC5yZW1vdmVFdmVudExpc3RlbmVyKFwiZm9jdXNpblwiLCByb3cuZnJvbnRtYXR0ZXJBaUZvY3VzSGFuZGxlcik7XG5cdFx0XHR9XG5cdFx0XHRpZiAodmFsdWVFbCAmJiByb3cuZnJvbnRtYXR0ZXJBaUJsdXJIYW5kbGVyKSB7XG5cdFx0XHRcdHZhbHVlRWwucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImZvY3Vzb3V0XCIsIHJvdy5mcm9udG1hdHRlckFpQmx1ckhhbmRsZXIpO1xuXHRcdFx0fVxuXHRcdFx0ZGVsZXRlIHJvdy5mcm9udG1hdHRlckFpRm9jdXNIYW5kbGVyO1xuXHRcdFx0ZGVsZXRlIHJvdy5mcm9udG1hdHRlckFpQmx1ckhhbmRsZXI7XG5cdFx0fSk7XG5cdFx0ZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChcIi5mcm9udG1hdHRlci1haS1zdW1tYXJ5LXJvd1wiKS5mb3JFYWNoKChlbCkgPT4ge1xuXHRcdFx0ZWwuY2xhc3NMaXN0LnJlbW92ZShcImZyb250bWF0dGVyLWFpLXN1bW1hcnktcm93XCIpO1xuXHRcdH0pO1xuXHRcdGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCIuZnJvbnRtYXR0ZXItYWktc3VtbWFyeS1sb2FkaW5nXCIpLmZvckVhY2goKGVsKSA9PiB7XG5cdFx0XHRlbC5jbGFzc0xpc3QucmVtb3ZlKFwiZnJvbnRtYXR0ZXItYWktc3VtbWFyeS1sb2FkaW5nXCIpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhYm9ydEFJU3VtbWFyeVN0cmVhbSgpIHtcblx0XHR0aGlzLmFpU3VtbWFyeUFib3J0Q29udHJvbGxlcj8uYWJvcnQoKTtcblx0XHR0aGlzLmFpU3VtbWFyeUFib3J0Q29udHJvbGxlciA9IG51bGw7XG5cdH1cblxuXHRwcml2YXRlIGFkZEFJU3VtbWFyeUJ1dHRvbigpIHtcblx0XHR0aGlzLmFwcGx5QUlTdW1tYXJ5QnV0dG9ucygpO1xuXHR9XG5cblx0cHJpdmF0ZSBhcHBseUFJU3VtbWFyeUJ1dHRvbnMoKSB7XG5cdFx0dGhpcy5jbGVhckFJU3VtbWFyeUJ1dHRvbnMoKTtcblx0XHRjb25zdCBhY3RpdmVGaWxlID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKTtcblx0XHRpZiAoIWFjdGl2ZUZpbGUgfHwgYWN0aXZlRmlsZS5leHRlbnNpb24gIT09IFwibWRcIikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNvbnRhaW5lcnMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50PihcIi5tZXRhZGF0YS1jb250YWluZXJcIik7XG5cdFx0Zm9yIChjb25zdCBjb250YWluZXIgb2YgQXJyYXkuZnJvbShjb250YWluZXJzKSkge1xuXHRcdFx0Y29uc3Qgcm93ID0gZmluZE1ldGFkYXRhUm93KGNvbnRhaW5lciwgXCLmkZjopoFcIik7XG5cdFx0XHRpZiAoXG5cdFx0XHRcdCFyb3cgfHxcblx0XHRcdFx0IXJvdy5pc0Nvbm5lY3RlZCB8fFxuXHRcdFx0XHQhZG9jdW1lbnQuY29udGFpbnMocm93KSB8fFxuXHRcdFx0XHRyb3cucXVlcnlTZWxlY3RvcihcIi5mcm9udG1hdHRlci1haS1zdW1tYXJ5LWJ0biwgLmZyb250bWF0dGVyLWFpLXN1bW1hcnktY29uZmlybVwiKVxuXHRcdFx0KSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zb2xlLmxvZyhcIltBSeaRmOimgV0g5pGY6KaB6KGMIERPTTpcIiwgcm93Lm91dGVySFRNTCk7XG5cdFx0XHRyb3cuYWRkQ2xhc3MoXCJmcm9udG1hdHRlci1haS1zdW1tYXJ5LXJvd1wiKTtcblx0XHRcdGNvbnN0IHZhbHVlRWwgPSBmaW5kTWV0YWRhdGFWYWx1ZUNvbnRhaW5lcihyb3cpO1xuXHRcdFx0Y29uc3Qgc3VtbWFyeSA9IG5vcm1hbGl6ZUZyb250bWF0dGVyU2NhbGFyKFxuXHRcdFx0XHR0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShhY3RpdmVGaWxlKT8uZnJvbnRtYXR0ZXI/LltcIuaRmOimgVwiXSxcblx0XHRcdCk7XG5cdFx0XHRpZiAoIXN1bW1hcnkpIHtcblx0XHRcdFx0dGhpcy5zaG93QUlTdW1tYXJ5QnV0dG9uKHJvdywgYWN0aXZlRmlsZSwgXCJmdWxsXCIpO1xuXHRcdFx0fSBlbHNlIGlmICh2YWx1ZUVsKSB7XG5cdFx0XHRcdGNvbnN0IHJvd1dpdGhIYW5kbGVycyA9IHJvdyBhcyBIVE1MRWxlbWVudCAmIHtcblx0XHRcdFx0XHRmcm9udG1hdHRlckFpRm9jdXNIYW5kbGVyPzogRXZlbnRMaXN0ZW5lcjtcblx0XHRcdFx0XHRmcm9udG1hdHRlckFpQmx1ckhhbmRsZXI/OiBFdmVudExpc3RlbmVyO1xuXHRcdFx0XHR9O1xuXHRcdFx0XHRsZXQgaGlkZVRpbWVyOiBudW1iZXIgfCBudWxsID0gbnVsbDtcblx0XHRcdFx0cm93V2l0aEhhbmRsZXJzLmZyb250bWF0dGVyQWlGb2N1c0hhbmRsZXIgPSAoKSA9PiB7XG5cdFx0XHRcdFx0aWYgKGhpZGVUaW1lciAhPT0gbnVsbCkge1xuXHRcdFx0XHRcdFx0d2luZG93LmNsZWFyVGltZW91dChoaWRlVGltZXIpO1xuXHRcdFx0XHRcdFx0aGlkZVRpbWVyID0gbnVsbDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0dGhpcy5zaG93QUlTdW1tYXJ5QnV0dG9uKHJvdywgYWN0aXZlRmlsZSwgXCJpY29uXCIpO1xuXHRcdFx0XHR9O1xuXHRcdFx0XHRyb3dXaXRoSGFuZGxlcnMuZnJvbnRtYXR0ZXJBaUJsdXJIYW5kbGVyID0gKCkgPT4ge1xuXHRcdFx0XHRcdGlmIChoaWRlVGltZXIgIT09IG51bGwpIHtcblx0XHRcdFx0XHRcdHdpbmRvdy5jbGVhclRpbWVvdXQoaGlkZVRpbWVyKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aGlkZVRpbWVyID0gd2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHRcdFx0aWYgKCFyb3cucXVlcnlTZWxlY3RvcihcIi5mcm9udG1hdHRlci1haS1zdW1tYXJ5LWNvbmZpcm1cIikpIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5oaWRlQUlTdW1tYXJ5QnV0dG9uKHJvdyk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSwgMjAwKTtcblx0XHRcdFx0fTtcblx0XHRcdFx0dmFsdWVFbC5hZGRFdmVudExpc3RlbmVyKFwiZm9jdXNpblwiLCByb3dXaXRoSGFuZGxlcnMuZnJvbnRtYXR0ZXJBaUZvY3VzSGFuZGxlcik7XG5cdFx0XHRcdHZhbHVlRWwuYWRkRXZlbnRMaXN0ZW5lcihcImZvY3Vzb3V0XCIsIHJvd1dpdGhIYW5kbGVycy5mcm9udG1hdHRlckFpQmx1ckhhbmRsZXIpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgc2hvd0FJU3VtbWFyeUJ1dHRvbihyb3c6IEhUTUxFbGVtZW50LCBmaWxlOiBURmlsZSwgdmFyaWFudDogXCJmdWxsXCIgfCBcImljb25cIikge1xuXHRcdGlmIChyb3cucXVlcnlTZWxlY3RvcihcIi5mcm9udG1hdHRlci1haS1zdW1tYXJ5LWJ0biwgLmZyb250bWF0dGVyLWFpLXN1bW1hcnktY29uZmlybVwiKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGJ1dHRvbiA9IHJvdy5jcmVhdGVFbChcImJ1dHRvblwiLCB7XG5cdFx0XHRjbHM6IGBmcm9udG1hdHRlci1haS1zdW1tYXJ5LWJ0biBpcy0ke3ZhcmlhbnR9YCxcblx0XHRcdGF0dHI6IHsgXCJhcmlhLWxhYmVsXCI6IFwiQUkg55Sf5oiQ5pGY6KaBXCIgfSxcblx0XHR9KTtcblx0XHRzZXRJY29uKGJ1dHRvbiwgXCJzcGFya2xlc1wiKTtcblx0XHRpZiAodmFyaWFudCA9PT0gXCJmdWxsXCIpIHtcblx0XHRcdGJ1dHRvbi5jcmVhdGVTcGFuKHsgdGV4dDogXCJBSeaRmOimgVwiIH0pO1xuXHRcdH1cblx0XHRidXR0b24ub25jbGljayA9IChldmVudCkgPT4ge1xuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0dGhpcy5zaG93QUlTdW1tYXJ5Q29uZmlybShyb3csIGZpbGUsIGJ1dHRvbik7XG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgaGlkZUFJU3VtbWFyeUJ1dHRvbihyb3c6IEhUTUxFbGVtZW50KSB7XG5cdFx0cm93LnF1ZXJ5U2VsZWN0b3IoXCIuZnJvbnRtYXR0ZXItYWktc3VtbWFyeS1idG5cIik/LnJlbW92ZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBzaG93QUlTdW1tYXJ5Q29uZmlybShyb3c6IEhUTUxFbGVtZW50LCBmaWxlOiBURmlsZSwgYnV0dG9uOiBIVE1MRWxlbWVudCkge1xuXHRcdGJ1dHRvbi5yZW1vdmUoKTtcblx0XHRyb3cucXVlcnlTZWxlY3RvcihcIi5mcm9udG1hdHRlci1haS1zdW1tYXJ5LWNvbmZpcm1cIik/LnJlbW92ZSgpO1xuXHRcdGNvbnN0IG9sZFN1bW1hcnkgPSBub3JtYWxpemVGcm9udG1hdHRlclNjYWxhcihcblx0XHRcdHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKGZpbGUpPy5mcm9udG1hdHRlcj8uW1wi5pGY6KaBXCJdLFxuXHRcdCk7XG5cdFx0Y29uc3QgY29uZmlybUVsID0gcm93LmNyZWF0ZVNwYW4oeyBjbHM6IFwiZnJvbnRtYXR0ZXItYWktc3VtbWFyeS1jb25maXJtXCIgfSk7XG5cdFx0Y29uZmlybUVsLmNyZWF0ZVNwYW4oe1xuXHRcdFx0Y2xzOiBcImZyb250bWF0dGVyLWFpLXN1bW1hcnktY29uZmlybS10ZXh0XCIsXG5cdFx0XHR0ZXh0OiBvbGRTdW1tYXJ5ID8gXCLinKggQUkg5pu05paw77yfXCIgOiBcIuKcqCBBSSDnlJ/miJDvvJ9cIixcblx0XHR9KTtcblx0XHRjb25zdCBhY2NlcHRCdXR0b24gPSBjb25maXJtRWwuY3JlYXRlRWwoXCJidXR0b25cIiwgeyBjbHM6IFwiZnJvbnRtYXR0ZXItYWktc3VtbWFyeS1jb25maXJtLWljb25cIiB9KTtcblx0XHRzZXRJY29uKGFjY2VwdEJ1dHRvbiwgXCJjaGVja1wiKTtcblx0XHRjb25zdCBjYW5jZWxCdXR0b24gPSBjb25maXJtRWwuY3JlYXRlRWwoXCJidXR0b25cIiwgeyBjbHM6IFwiZnJvbnRtYXR0ZXItYWktc3VtbWFyeS1jb25maXJtLWljb25cIiB9KTtcblx0XHRzZXRJY29uKGNhbmNlbEJ1dHRvbiwgXCJ4XCIpO1xuXG5cdFx0Y2FuY2VsQnV0dG9uLm9uY2xpY2sgPSAoZXZlbnQpID0+IHtcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdGNvbmZpcm1FbC5yZW1vdmUoKTtcblx0XHRcdHRoaXMuYXBwbHlBSVN1bW1hcnlCdXR0b25zKCk7XG5cdFx0fTtcblx0XHRhY2NlcHRCdXR0b24ub25jbGljayA9IChldmVudCkgPT4ge1xuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0dm9pZCB0aGlzLnJ1bk1ldGFkYXRhQUlTdW1tYXJ5KGZpbGUsIHJvdywgY29uZmlybUVsKTtcblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBydW5NZXRhZGF0YUFJU3VtbWFyeShmaWxlOiBURmlsZSwgcm93OiBIVE1MRWxlbWVudCwgY29uZmlybUVsOiBIVE1MRWxlbWVudCkge1xuXHRcdGNvbnN0IHZhbHVlRWwgPSBmaW5kTWV0YWRhdGFWYWx1ZUNvbnRhaW5lcihyb3cpID8/IHJvdztcblx0XHRjb25zdCBvcmlnaW5hbFZhbHVlID0gdmFsdWVFbC50ZXh0Q29udGVudCA/PyBcIlwiO1xuXHRcdGNvbmZpcm1FbC5yZW1vdmUoKTtcblx0XHR0aGlzLmFib3J0QUlTdW1tYXJ5U3RyZWFtKCk7XG5cdFx0Y29uc3QgY29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcblx0XHR0aGlzLmFpU3VtbWFyeUFib3J0Q29udHJvbGxlciA9IGNvbnRyb2xsZXI7XG5cdFx0bGV0IHN0cmVhbWVkVGV4dCA9IFwiXCI7XG5cdFx0bGV0IGZpbmFsVGV4dCA9IG9yaWdpbmFsVmFsdWU7XG5cdFx0bGV0IGRpZFN1Y2NlZWQgPSBmYWxzZTtcblx0XHRsZXQgZmFsbGJhY2tEb3RzVGltZXI6IG51bWJlciB8IG51bGwgPSB3aW5kb3cuc2V0SW50ZXJ2YWwoKCkgPT4ge1xuXHRcdFx0aWYgKHN0cmVhbWVkVGV4dCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR2YWx1ZUVsLnRleHRDb250ZW50ID0gdmFsdWVFbC50ZXh0Q29udGVudCA9PT0gXCLCt8K3wrdcIiA/IFwiwrdcIiA6IGAke3ZhbHVlRWwudGV4dENvbnRlbnR9wrdgO1xuXHRcdH0sIDM1MCk7XG5cdFx0dmFsdWVFbC5lbXB0eSgpO1xuXHRcdHZhbHVlRWwuYWRkQ2xhc3MoXCJmcm9udG1hdHRlci1haS1zdW1tYXJ5LWxvYWRpbmdcIik7XG5cdFx0dmFsdWVFbC5zZXRUZXh0KFwifFwiKTtcblxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBzdW1tYXJ5ID0gYXdhaXQgdGhpcy5nZW5lcmF0ZVN1bW1hcnlGb3JNZXRhZGF0YUJ1dHRvbihmaWxlLCAoZGVsdGEpID0+IHtcblx0XHRcdFx0aWYgKCFkZWx0YSkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRzdHJlYW1lZFRleHQgKz0gZGVsdGE7XG5cdFx0XHRcdHZhbHVlRWwuc2V0VGV4dChgJHtzdHJlYW1lZFRleHR9fGApO1xuXHRcdFx0XHR9LCBjb250cm9sbGVyLnNpZ25hbCk7XG5cdFx0XHRcdGlmIChmYWxsYmFja0RvdHNUaW1lciAhPT0gbnVsbCkge1xuXHRcdFx0XHRcdHdpbmRvdy5jbGVhckludGVydmFsKGZhbGxiYWNrRG90c1RpbWVyKTtcblx0XHRcdFx0XHRmYWxsYmFja0RvdHNUaW1lciA9IG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdFx0ZmluYWxUZXh0ID0gc3VtbWFyeSB8fCBzdHJlYW1lZFRleHQ7XG5cdFx0XHRcdGRpZFN1Y2NlZWQgPSBCb29sZWFuKGZpbmFsVGV4dCk7XG5cdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRpZiAoIWNvbnRyb2xsZXIuc2lnbmFsLmFib3J0ZWQpIHtcblx0XHRcdFx0XHRuZXcgTm90aWNlKGBBSSDmkZjopoHnlJ/miJDlpLHotKXvvJoke2dldEVycm9yTWVzc2FnZShlcnJvcil9YCk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZmluYWxseSB7XG5cdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdGlmIChmYWxsYmFja0RvdHNUaW1lciAhPT0gbnVsbCkge1xuXHRcdFx0XHRcdFx0XHR3aW5kb3cuY2xlYXJJbnRlcnZhbChmYWxsYmFja0RvdHNUaW1lcik7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRpZiAodGhpcy5haVN1bW1hcnlBYm9ydENvbnRyb2xsZXIgPT09IGNvbnRyb2xsZXIpIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5haVN1bW1hcnlBYm9ydENvbnRyb2xsZXIgPSBudWxsO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aWYgKGRpZFN1Y2NlZWQpIHtcblx0XHRcdFx0XHRcdFx0bmV3IE5vdGljZShcIkFJIOaRmOimgeeUn+aIkOaIkOWKn1wiKTtcblx0XHRcdFx0XHRcdFx0dGhpcy5zY2hlZHVsZURlbGF5ZWRBSVN1bW1hcnlCdXR0b25SZWZyZXNoKCk7XG5cdFx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0dmFsdWVFbC5yZW1vdmVDbGFzcyhcImZyb250bWF0dGVyLWFpLXN1bW1hcnktbG9hZGluZ1wiKTtcblx0XHRcdFx0XHRcdHZhbHVlRWwuc2V0VGV4dChvcmlnaW5hbFZhbHVlKTtcblx0XHRcdFx0XHRcdHRoaXMuc2NoZWR1bGVBSVN1bW1hcnlCdXR0b25SZWZyZXNoKCk7XG5cdFx0XHRcdFx0fSBjYXRjaCAoY2xlYW51cEVycm9yKSB7XG5cdFx0XHRcdFx0XHRjb25zb2xlLmVycm9yKFwiW2F1dG8tZnJvbnRtYXR0ZXJdIEFJIHN1bW1hcnkgY2xlYW51cCBmYWlsZWRcIiwgY2xlYW51cEVycm9yKTtcblx0XHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cbmNsYXNzIEZvbGRlclJ1bGVNb2RhbCBleHRlbmRzIE1vZGFsIHtcblx0cHJpdmF0ZSBmaWVsZDogRm9sZGVyRGVmYXVsdEZpZWxkIHwgXCJcIiA9IFwiXCI7XG5cdHByaXZhdGUgdmFsdWUgPSBcIlwiO1xuXHRwcml2YXRlIGlzQ3VzdG9tVmFsdWUgPSBmYWxzZTtcblx0cHJpdmF0ZSBjdXN0b21WYWx1ZUlucHV0RWw6IEhUTUxJbnB1dEVsZW1lbnQgfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSBjdXN0b21WYWx1ZUJsdXJIYW5kbGVyOiAoKGV2ZW50OiBGb2N1c0V2ZW50KSA9PiB2b2lkKSB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIGN1c3RvbVZhbHVlS2V5ZG93bkhhbmRsZXI6ICgoZXZlbnQ6IEtleWJvYXJkRXZlbnQpID0+IHZvaWQpIHwgbnVsbCA9IG51bGw7XG5cdHByaXZhdGUgc3VibWl0QnV0dG9uRWw6IEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbCA9IG51bGw7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0YXBwOiBBcHAsXG5cdFx0cHJpdmF0ZSBwbHVnaW46IEF1dG9Gcm9udG1hdHRlclBsdWdpbixcblx0XHRwcml2YXRlIGZvbGRlcjogc3RyaW5nLFxuXHQpIHtcblx0XHRzdXBlcihhcHApO1xuXHRcdHRoaXMuZmllbGQgPSB0aGlzLmdldEluaXRpYWxGaWVsZCgpO1xuXHRcdHRoaXMudmFsdWUgPSB0aGlzLmZpbmRFeGlzdGluZ1ZhbHVlKHRoaXMuZmllbGQpO1xuXHR9XG5cblx0b25PcGVuKCkge1xuXHRcdHRoaXMucmVuZGVyKCk7XG5cdH1cblxuXHRvbkNsb3NlKCkge1xuXHRcdHRoaXMuY2xlYW51cEN1c3RvbVZhbHVlSW5wdXQoKTtcblx0XHR0aGlzLnN1Ym1pdEJ1dHRvbkVsID0gbnVsbDtcblx0XHR0aGlzLmNvbnRlbnRFbC5lbXB0eSgpO1xuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXIoKSB7XG5cdFx0Y29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG5cdFx0dGhpcy5jbGVhbnVwQ3VzdG9tVmFsdWVJbnB1dCgpO1xuXHRcdGNvbnRlbnRFbC5lbXB0eSgpO1xuXHRcdGNvbnRlbnRFbC5jcmVhdGVFbChcImgyXCIsIHsgdGV4dDogXCLorr7nva7lsZ7mgKfljLnphY3op4TliJlcIiB9KTtcblx0XHRjb25zdCBpbmhlcml0ZWRSdWxlcyA9IGdldEFuY2VzdG9yUnVsZXModGhpcy5mb2xkZXIsIHRoaXMucGx1Z2luLnNldHRpbmdzLmZvbGRlckRlZmF1bHRzKTtcblx0XHRmb3IgKGNvbnN0IHJ1bGUgb2YgaW5oZXJpdGVkUnVsZXMpIHtcblx0XHRcdGNvbnRlbnRFbC5jcmVhdGVEaXYoe1xuXHRcdFx0XHRjbHM6IFwiYXV0by1mcm9udG1hdHRlci1tb2RhbC1pbmhlcml0ZWQtcnVsZVwiLFxuXHRcdFx0XHR0ZXh0OiBg4oaRIOe7p+aJv+iHqiAke3J1bGUuZm9sZGVyfSDihpIgJHtydWxlLmZpZWxkfTogJHtydWxlLnZhbHVlfWAsXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRuZXcgU2V0dGluZyhjb250ZW50RWwpXG5cdFx0XHQuc2V0TmFtZShcIuaWh+S7tuWkuVwiKVxuXHRcdFx0LnNldERlc2ModGhpcy5mb2xkZXIgfHwgXCIvXCIpO1xuXG5cdFx0bmV3IFNldHRpbmcoY29udGVudEVsKVxuXHRcdFx0LnNldE5hbWUoXCLlrZfmrrVcIilcblx0XHRcdC5hZGREcm9wZG93bigoZHJvcGRvd24pID0+IHtcblx0XHRcdFx0ZHJvcGRvd24uYWRkT3B0aW9uKFwiXCIsIFwi5pyq6YWN572uXCIpO1xuXHRcdFx0XHRmb3IgKGNvbnN0IGZpZWxkIG9mIEZPTERFUl9ERUZBVUxUX0ZJRUxEUykge1xuXHRcdFx0XHRcdGRyb3Bkb3duLmFkZE9wdGlvbihmaWVsZCwgZmllbGQpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0ZHJvcGRvd24uc2V0VmFsdWUodGhpcy5maWVsZCkub25DaGFuZ2UoKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5maWVsZCA9IHZhbHVlIGFzIEZvbGRlckRlZmF1bHRGaWVsZCB8IFwiXCI7XG5cdFx0XHRcdFx0dGhpcy52YWx1ZSA9IHRoaXMuZmluZEV4aXN0aW5nVmFsdWUodGhpcy5maWVsZCk7XG5cdFx0XHRcdFx0dGhpcy5pc0N1c3RvbVZhbHVlID0gZmFsc2U7XG5cdFx0XHRcdFx0dGhpcy51cGRhdGVTdWJtaXRTdGF0ZSgpO1xuXHRcdFx0XHRcdHRoaXMucmVuZGVyKCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHR0b2dnbGVNb2RhbFNlbGVjdFBsYWNlaG9sZGVyKGRyb3Bkb3duLnNlbGVjdEVsLCAhdGhpcy5maWVsZCk7XG5cdFx0XHR9KTtcblxuXHRcdGNvbnN0IGNhbmRpZGF0ZXMgPSB0aGlzLmZpZWxkID8gZ2V0RnJvbnRtYXR0ZXJGaWVsZENhbmRpZGF0ZXModGhpcy5hcHAsIHRoaXMuZmllbGQpIDogW107XG5cdFx0Y29uc3QgdmFsdWVzID0gdGhpcy52YWx1ZSAmJiAhY2FuZGlkYXRlcy5pbmNsdWRlcyh0aGlzLnZhbHVlKSA/IFsuLi5jYW5kaWRhdGVzLCB0aGlzLnZhbHVlXSA6IGNhbmRpZGF0ZXM7XG5cdFx0Y29uc3QgdmFsdWVTZXR0aW5nID0gbmV3IFNldHRpbmcoY29udGVudEVsKS5zZXROYW1lKFwi5aGr5YaZXCIpO1xuXHRcdHZhbHVlU2V0dGluZy5jb250cm9sRWwuYWRkQ2xhc3MoXCJhdXRvLWZyb250bWF0dGVyLW1vZGFsLXZhbHVlLWNvbnRyb2xcIik7XG5cdFx0dmFsdWVTZXR0aW5nLmNvbnRyb2xFbC5lbXB0eSgpO1xuXHRcdGNvbnN0IHNlbGVjdEVsID0gdmFsdWVTZXR0aW5nLmNvbnRyb2xFbC5jcmVhdGVFbChcInNlbGVjdFwiLCB7XG5cdFx0XHRjbHM6IFwiZHJvcGRvd24gYXV0by1mcm9udG1hdHRlci1tb2RhbC1jdXN0b20tc2VsZWN0XCIsXG5cdFx0fSk7XG5cdFx0c2VsZWN0RWwuY3JlYXRlRWwoXCJvcHRpb25cIiwge1xuXHRcdFx0dmFsdWU6IFwiXCIsXG5cdFx0XHR0ZXh0OiBcIuacqumFjee9rlwiLFxuXHRcdH0pO1xuXHRcdGZvciAoY29uc3QgdmFsdWUgb2YgdmFsdWVzKSB7XG5cdFx0XHRzZWxlY3RFbC5jcmVhdGVFbChcIm9wdGlvblwiLCB7XG5cdFx0XHRcdHZhbHVlLFxuXHRcdFx0XHR0ZXh0OiB2YWx1ZSxcblx0XHRcdH0pO1xuXHRcdH1cblx0XHRzZWxlY3RFbC5jcmVhdGVFbChcIm9wdGlvblwiLCB7XG5cdFx0XHR2YWx1ZTogXCJfX25ld19fXCIsXG5cdFx0XHR0ZXh0OiBcIuiHquWumuS5iVwiLFxuXHRcdH0pO1xuXHRcdHNlbGVjdEVsLmRpc2FibGVkID0gIXRoaXMuZmllbGQ7XG5cdFx0c2VsZWN0RWwudmFsdWUgPSB0aGlzLmlzQ3VzdG9tVmFsdWUgPyBcIl9fbmV3X19cIiA6IHRoaXMudmFsdWUgfHwgXCJcIjtcblx0XHR0b2dnbGVNb2RhbFNlbGVjdFBsYWNlaG9sZGVyKHNlbGVjdEVsLCAhc2VsZWN0RWwudmFsdWUpO1xuXHRcdHNlbGVjdEVsLmFkZEV2ZW50TGlzdGVuZXIoXCJjaGFuZ2VcIiwgKCkgPT4ge1xuXHRcdFx0dG9nZ2xlTW9kYWxTZWxlY3RQbGFjZWhvbGRlcihzZWxlY3RFbCwgIXNlbGVjdEVsLnZhbHVlKTtcblx0XHRcdGlmICghc2VsZWN0RWwudmFsdWUpIHtcblx0XHRcdFx0dGhpcy5pc0N1c3RvbVZhbHVlID0gZmFsc2U7XG5cdFx0XHRcdHRoaXMudmFsdWUgPSBcIlwiO1xuXHRcdFx0XHR0aGlzLnVwZGF0ZVN1Ym1pdFN0YXRlKCk7XG5cdFx0XHRcdHRoaXMucmVuZGVyKCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmIChzZWxlY3RFbC52YWx1ZSA9PT0gXCJfX25ld19fXCIpIHtcblx0XHRcdFx0dGhpcy5pc0N1c3RvbVZhbHVlID0gdHJ1ZTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuaXNDdXN0b21WYWx1ZSA9IGZhbHNlO1xuXHRcdFx0XHR0aGlzLnZhbHVlID0gc2VsZWN0RWwudmFsdWU7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLnVwZGF0ZVN1Ym1pdFN0YXRlKCk7XG5cdFx0XHR0aGlzLnJlbmRlcigpO1xuXHRcdH0pO1xuXG5cdFx0aWYgKHRoaXMuaXNDdXN0b21WYWx1ZSkge1xuXHRcdFx0Y29uc3QgaW5wdXRFbCA9IHZhbHVlU2V0dGluZy5jb250cm9sRWwuY3JlYXRlRWwoXCJpbnB1dFwiLCB7XG5cdFx0XHRcdGNsczogXCJhdXRvLWZyb250bWF0dGVyLW1vZGFsLWN1c3RvbS1pbnB1dFwiLFxuXHRcdFx0XHR0eXBlOiBcInRleHRcIixcblx0XHRcdFx0dmFsdWU6IHRoaXMudmFsdWUsXG5cdFx0XHR9KTtcblx0XHRcdGlucHV0RWwucGxhY2Vob2xkZXIgPSBcIuWhq+WFpeS/oeaBr1wiO1xuXHRcdFx0aW5wdXRFbC5hZGRFdmVudExpc3RlbmVyKFwiaW5wdXRcIiwgKCkgPT4ge1xuXHRcdFx0XHR0aGlzLnZhbHVlID0gaW5wdXRFbC52YWx1ZTtcblx0XHRcdFx0dGhpcy51cGRhdGVTdWJtaXRTdGF0ZSgpO1xuXHRcdFx0fSk7XG5cdFx0XHRpbnB1dEVsLmFkZEV2ZW50TGlzdGVuZXIoXCJjaGFuZ2VcIiwgKCkgPT4ge1xuXHRcdFx0XHR0aGlzLnZhbHVlID0gaW5wdXRFbC52YWx1ZTtcblx0XHRcdFx0dGhpcy51cGRhdGVTdWJtaXRTdGF0ZSgpO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRoaXMuY3VzdG9tVmFsdWVJbnB1dEVsID0gaW5wdXRFbDtcblx0XHRcdHRoaXMuY3VzdG9tVmFsdWVCbHVySGFuZGxlciA9ICgpID0+IHtcblx0XHRcdFx0dGhpcy52YWx1ZSA9IGlucHV0RWwudmFsdWU7XG5cdFx0XHRcdHRoaXMudXBkYXRlU3VibWl0U3RhdGUoKTtcblx0XHRcdH07XG5cdFx0XHR0aGlzLmN1c3RvbVZhbHVlS2V5ZG93bkhhbmRsZXIgPSAoZXZlbnQpID0+IHtcblx0XHRcdFx0aWYgKGV2ZW50LmtleSA9PT0gXCJFbnRlclwiKSB7XG5cdFx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0XHR0aGlzLnZhbHVlID0gaW5wdXRFbC52YWx1ZTtcblx0XHRcdFx0XHR0aGlzLnVwZGF0ZVN1Ym1pdFN0YXRlKCk7XG5cdFx0XHRcdFx0aW5wdXRFbC5ibHVyKCk7XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0XHRpbnB1dEVsLmFkZEV2ZW50TGlzdGVuZXIoXCJibHVyXCIsIHRoaXMuY3VzdG9tVmFsdWVCbHVySGFuZGxlcik7XG5cdFx0XHRpbnB1dEVsLmFkZEV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsIHRoaXMuY3VzdG9tVmFsdWVLZXlkb3duSGFuZGxlcik7XG5cdFx0XHR3aW5kb3cuc2V0VGltZW91dCgoKSA9PiBpbnB1dEVsLmZvY3VzKCksIDApO1xuXHRcdH1cblxuXHRcdGNvbnN0IGFjdGlvbnNFbCA9IGNvbnRlbnRFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1tb2RhbC1hY3Rpb25zXCIgfSk7XG5cdFx0bmV3IFNldHRpbmcoYWN0aW9uc0VsKVxuXHRcdFx0LmFkZEJ1dHRvbigoYnV0dG9uKSA9PiB7XG5cdFx0XHRcdGJ1dHRvbi5zZXRCdXR0b25UZXh0KFwi5Y+W5raIXCIpLm9uQ2xpY2soKCkgPT4ge1xuXHRcdFx0XHRcdHRoaXMuY2xvc2UoKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KVxuXHRcdFx0LmFkZEJ1dHRvbigoYnV0dG9uKSA9PiB7XG5cdFx0XHRcdHRoaXMuc3VibWl0QnV0dG9uRWwgPSBidXR0b24uYnV0dG9uRWw7XG5cdFx0XHRcdGJ1dHRvblxuXHRcdFx0XHRcdC5zZXRCdXR0b25UZXh0KFwi5o+Q5LqkXCIpXG5cdFx0XHRcdFx0LnNldEN0YSgpXG5cdFx0XHRcdFx0Lm9uQ2xpY2soYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdGlmICghdGhpcy5wbHVnaW4uZW5zdXJlRGV2aWNlQm91bmQoKSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGF3YWl0IHRoaXMucGx1Z2luLnVwc2VydEZvbGRlclJ1bGUodGhpcy5mb2xkZXIsIHRoaXMuZmllbGQgYXMgRm9sZGVyRGVmYXVsdEZpZWxkLCB0aGlzLnZhbHVlKTtcblx0XHRcdFx0XHR0aGlzLnBsdWdpbi5yZWZyZXNoU2V0dGluZ3NUYWIoKTtcblx0XHRcdFx0XHRuZXcgTm90aWNlKGDop4TliJnlt7Lkv53lrZjvvIgke3RoaXMucGx1Z2luLmdldEN1cnJlbnRBdXRob3JOYW1lKCl977yJYCk7XG5cdFx0XHRcdFx0dGhpcy5jbG9zZSgpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdHRoaXMudXBkYXRlU3VibWl0U3RhdGUoKTtcblx0fVxuXG5cdHByaXZhdGUgZmluZEV4aXN0aW5nVmFsdWUoZmllbGQ6IEZvbGRlckRlZmF1bHRGaWVsZCB8IFwiXCIpOiBzdHJpbmcge1xuXHRcdGlmICghZmllbGQpIHtcblx0XHRcdHJldHVybiBcIlwiO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5wbHVnaW4uc2V0dGluZ3MuZm9sZGVyRGVmYXVsdHMuZmluZCgocnVsZSkgPT4ge1xuXHRcdFx0cmV0dXJuIHJ1bGUuZm9sZGVyID09PSB0aGlzLmZvbGRlciAmJiBydWxlLmZpZWxkID09PSBmaWVsZDtcblx0XHR9KT8udmFsdWUgPz8gXCJcIjtcblx0fVxuXG5cdHByaXZhdGUgZ2V0SW5pdGlhbEZpZWxkKCk6IEZvbGRlckRlZmF1bHRGaWVsZCB7XG5cdFx0Y29uc3Qgb3duRmllbGRzID0gbmV3IFNldChcblx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLmZvbGRlckRlZmF1bHRzXG5cdFx0XHRcdC5maWx0ZXIoKHJ1bGUpID0+IHJ1bGUuZm9sZGVyID09PSB0aGlzLmZvbGRlcilcblx0XHRcdFx0Lm1hcCgocnVsZSkgPT4gcnVsZS5maWVsZCksXG5cdFx0KTtcblx0XHRjb25zdCBpbmhlcml0ZWRGaWVsZHMgPSBuZXcgU2V0KFxuXHRcdFx0Z2V0QW5jZXN0b3JSdWxlcyh0aGlzLmZvbGRlciwgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZm9sZGVyRGVmYXVsdHMpLm1hcCgocnVsZSkgPT4gcnVsZS5maWVsZCksXG5cdFx0KTtcblxuXHRcdGlmIChvd25GaWVsZHMuaGFzKFwi6aG555uuXCIpICYmICFvd25GaWVsZHMuaGFzKFwi57G75Z6LXCIpKSB7XG5cdFx0XHRyZXR1cm4gXCLnsbvlnotcIjtcblx0XHR9XG5cdFx0aWYgKG93bkZpZWxkcy5oYXMoXCLnsbvlnotcIikgJiYgIW93bkZpZWxkcy5oYXMoXCLpobnnm65cIikpIHtcblx0XHRcdHJldHVybiBcIumhueebrlwiO1xuXHRcdH1cblx0XHRpZiAoaW5oZXJpdGVkRmllbGRzLmhhcyhcIumhueebrlwiKSAmJiAhaW5oZXJpdGVkRmllbGRzLmhhcyhcIuexu+Wei1wiKSkge1xuXHRcdFx0cmV0dXJuIFwi57G75Z6LXCI7XG5cdFx0fVxuXHRcdHJldHVybiBcIumhueebrlwiO1xuXHR9XG5cblx0cHJpdmF0ZSBjbGVhbnVwQ3VzdG9tVmFsdWVJbnB1dCgpIHtcblx0XHRpZiAodGhpcy5jdXN0b21WYWx1ZUlucHV0RWwgJiYgdGhpcy5jdXN0b21WYWx1ZUJsdXJIYW5kbGVyKSB7XG5cdFx0XHR0aGlzLmN1c3RvbVZhbHVlSW5wdXRFbC5yZW1vdmVFdmVudExpc3RlbmVyKFwiYmx1clwiLCB0aGlzLmN1c3RvbVZhbHVlQmx1ckhhbmRsZXIpO1xuXHRcdH1cblx0XHRpZiAodGhpcy5jdXN0b21WYWx1ZUlucHV0RWwgJiYgdGhpcy5jdXN0b21WYWx1ZUtleWRvd25IYW5kbGVyKSB7XG5cdFx0XHR0aGlzLmN1c3RvbVZhbHVlSW5wdXRFbC5yZW1vdmVFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCB0aGlzLmN1c3RvbVZhbHVlS2V5ZG93bkhhbmRsZXIpO1xuXHRcdH1cblx0XHR0aGlzLmN1c3RvbVZhbHVlSW5wdXRFbCA9IG51bGw7XG5cdFx0dGhpcy5jdXN0b21WYWx1ZUJsdXJIYW5kbGVyID0gbnVsbDtcblx0XHR0aGlzLmN1c3RvbVZhbHVlS2V5ZG93bkhhbmRsZXIgPSBudWxsO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVTdWJtaXRTdGF0ZSgpIHtcblx0XHRpZiAoIXRoaXMuc3VibWl0QnV0dG9uRWwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBoYXNGaWVsZCA9IEJvb2xlYW4odGhpcy5maWVsZCk7XG5cdFx0Y29uc3QgaGFzVmFsdWUgPSB0aGlzLmlzQ3VzdG9tVmFsdWVcblx0XHRcdD8gKHRoaXMuY3VzdG9tVmFsdWVJbnB1dEVsPy52YWx1ZSA/PyB0aGlzLnZhbHVlKS50cmltKCkubGVuZ3RoID4gMFxuXHRcdFx0OiB0aGlzLnZhbHVlLnRyaW0oKS5sZW5ndGggPiAwO1xuXG5cdFx0dGhpcy5zdWJtaXRCdXR0b25FbC5kaXNhYmxlZCA9ICEoaGFzRmllbGQgJiYgaGFzVmFsdWUpO1xuXHR9XG59XG5cbmNsYXNzIEFJU3VtbWFyeVNlcnZpY2UgaW1wbGVtZW50cyBTdW1tYXJ5U2VydmljZSB7XG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgc2V0dGluZ3M6IEF1dG9Gcm9udG1hdHRlclNldHRpbmdzKSB7fVxuXG5cdGFzeW5jIGdlbmVyYXRlU3VtbWFyeShkb2N1bWVudDogU3VtbWFyeURvY3VtZW50KTogUHJvbWlzZTxzdHJpbmc+IHtcblx0XHRyZXR1cm4gYXdhaXQgdGhpcy5jYWxsQUkodGhpcy5idWlsZFByb21wdChkb2N1bWVudCkpO1xuXHR9XG5cblx0YXN5bmMgY2FsbEFJKHByb21wdENvbnRlbnQ6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG5cdFx0Y29uc3QgYXBpS2V5ID0gdGhpcy5zZXR0aW5ncy5haUFwaUtleS50cmltKCk7XG5cdFx0aWYgKCFhcGlLZXkpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihcIkFQSSBLZXkg5Li656m6XCIpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGFwaVVybCA9IHRoaXMuc2V0dGluZ3MuYWlBcGlVcmwucmVwbGFjZSgvXFwvKyQvLCBcIlwiKTtcblx0XHRjb25zdCB1cmwgPSBgJHthcGlVcmx9L2NoYXQvY29tcGxldGlvbnNgO1xuXG5cdFx0Y29uc29sZS5sb2coXCJbQUnmkZjopoFdIOivt+axgiBVUkw6XCIsIHVybCk7XG5cdFx0Y29uc29sZS5sb2coXCJbQUnmkZjopoFdIOaooeWeizpcIiwgdGhpcy5zZXR0aW5ncy5haU1vZGVsTmFtZSk7XG5cblx0XHRjb25zdCBib2R5ID0ge1xuXHRcdFx0bW9kZWw6IHRoaXMuc2V0dGluZ3MuYWlNb2RlbE5hbWUsXG5cdFx0XHRtZXNzYWdlczogW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0cm9sZTogXCJzeXN0ZW1cIixcblx0XHRcdFx0XHRjb250ZW50OiBcIuebtOaOpei+k+WHuuaRmOimge+8jOS4jeimgeacieS7u+S9leWFtuS7luWGheWuueOAglwiLFxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7IHJvbGU6IFwidXNlclwiLCBjb250ZW50OiBwcm9tcHRDb250ZW50IH0sXG5cdFx0XHRdLFxuXHRcdFx0cmVhc29uaW5nX2VmZm9ydDogXCJsb3dcIixcblx0XHRcdHJlYXNvbmluZ19mb3JtYXQ6IFwiZGVlcHNlZWstc3R5bGVcIixcblx0XHRcdG1heF90b2tlbnM6IDEwMjQsXG5cdFx0fTtcblxuXHRcdGNvbnNvbGUubG9nKFwiW0FJ5pGY6KaBXSDor7fmsYIgYm9keTpcIiwgSlNPTi5zdHJpbmdpZnkoYm9keSwgbnVsbCwgMikuc3Vic3RyaW5nKDAsIDUwMCkpO1xuXG5cdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCh1cmwsIHtcblx0XHRcdG1ldGhvZDogXCJQT1NUXCIsXG5cdFx0XHRoZWFkZXJzOiB7XG5cdFx0XHRcdFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiLFxuXHRcdFx0XHRcIkF1dGhvcml6YXRpb25cIjogYEJlYXJlciAke2FwaUtleX1gLFxuXHRcdFx0fSxcblx0XHRcdGJvZHk6IEpTT04uc3RyaW5naWZ5KGJvZHkpLFxuXHRcdH0pO1xuXG5cdFx0Y29uc29sZS5sb2coXCJbQUnmkZjopoFdIOWTjeW6lCBzdGF0dXM6XCIsIHJlc3BvbnNlLnN0YXR1cywgcmVzcG9uc2Uuc3RhdHVzVGV4dCk7XG5cblx0XHRpZiAoIXJlc3BvbnNlLm9rKSB7XG5cdFx0XHRjb25zdCBlcnJvclRleHQgPSBhd2FpdCByZXNwb25zZS50ZXh0KCk7XG5cdFx0XHRjb25zb2xlLmxvZyhcIltBSeaRmOimgV0g6ZSZ6K+v5ZON5bqUOlwiLCBlcnJvclRleHQuc3Vic3RyaW5nKDAsIDUwMCkpO1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBBUEkg6K+35rGC5aSx6LSlICgke3Jlc3BvbnNlLnN0YXR1c30pOiAke2Vycm9yVGV4dC5zdWJzdHJpbmcoMCwgMjAwKX1gKTtcblx0XHR9XG5cblx0XHRjb25zdCBkYXRhID0gYXdhaXQgcmVzcG9uc2UuanNvbigpIGFzIENoYXRDb21wbGV0aW9uUmVzcG9uc2U7XG5cdFx0Y29uc29sZS5sb2coXCJbQUnmkZjopoFdIOWujOaVtOWTjeW6lDpcIiwgSlNPTi5zdHJpbmdpZnkoZGF0YSwgbnVsbCwgMikpO1xuXG5cdFx0aWYgKGRhdGEuZXJyb3IpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihkYXRhLmVycm9yLm1lc3NhZ2UgfHwgSlNPTi5zdHJpbmdpZnkoZGF0YS5lcnJvcikpO1xuXHRcdH1cblxuXHRcdGNvbnN0IG1lc3NhZ2UgPSBkYXRhLmNob2ljZXM/LlswXT8ubWVzc2FnZTtcblx0XHRpZiAoIW1lc3NhZ2UpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihcIuWTjeW6lOS4reaXoCBjaG9pY2VzWzBdLm1lc3NhZ2XvvIzlrozmlbTlk43lupTlt7LmiZPljbDliLDmjqfliLblj7BcIik7XG5cdFx0fVxuXG5cdFx0XHRjb25zb2xlLmxvZyhcIltBSeaRmOimgV0gbWVzc2FnZS5jb250ZW50OlwiLCBKU09OLnN0cmluZ2lmeShtZXNzYWdlLmNvbnRlbnQpKTtcblx0XHRcdGNvbnNvbGUubG9nKFwiW0FJ5pGY6KaBXSBtZXNzYWdlLnJlYXNvbmluZ19jb250ZW50OlwiLCBKU09OLnN0cmluZ2lmeShtZXNzYWdlLnJlYXNvbmluZ19jb250ZW50KT8uc3Vic3RyaW5nKDAsIDIwMCkpO1xuXHRcdFx0Y29uc29sZS5sb2coXCJbQUnmkZjopoFdIG1lc3NhZ2UucmVhc29uaW5nOlwiLCBKU09OLnN0cmluZ2lmeShtZXNzYWdlLnJlYXNvbmluZyk/LnN1YnN0cmluZygwLCAyMDApKTtcblxuXHRcdGxldCBzdW1tYXJ5ID0gbWVzc2FnZS5jb250ZW50Py50cmltKCk7XG5cdFx0aWYgKCFzdW1tYXJ5KSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCLmqKHlnovmnKrnlJ/miJDmkZjopoHvvIhjb250ZW50IOS4uuepuu+8ie+8jOivt+aJk+W8gOW8gOWPkeiAheW3peWFt+afpeeci+WujOaVtOWTjeW6lFwiKTtcblx0XHR9XG5cblx0XHRzdW1tYXJ5ID0gc3VtbWFyeVxuXHRcdFx0LnJlcGxhY2UoL15bXFxcIuOAjOOAjVwiJ10rfFtcXFwi44CM44CNXCInXSskL2csIFwiXCIpXG5cdFx0XHQucmVwbGFjZSgvXijmkZjopoFbOu+8ml1cXHMqKS9pLCBcIlwiKVxuXHRcdFx0LnRyaW0oKTtcblxuXHRcdGlmICghc3VtbWFyeSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiQUkg5pGY6KaB6L+U5Zue5Li656m6XCIpO1xuXHRcdH1cblxuXHRcdHJldHVybiBzdW1tYXJ5O1xuXHR9XG5cblx0cHJpdmF0ZSBidWlsZFByb21wdChkb2N1bWVudDogU3VtbWFyeURvY3VtZW50KTogc3RyaW5nIHtcblx0XHRyZXR1cm4gcmVwbGFjZVByb21wdFRva2VuKFxuXHRcdFx0cmVwbGFjZVByb21wdFRva2VuKFxuXHRcdFx0XHRyZXBsYWNlUHJvbXB0VG9rZW4odGhpcy5zZXR0aW5ncy5haVN1bW1hcnlQcm9tcHQsIFwie3RpdGxlfVwiLCBkb2N1bWVudC50aXRsZSksXG5cdFx0XHRcdFwie2Zyb250bWF0dGVyfVwiLFxuXHRcdFx0XHRkb2N1bWVudC5mcm9udG1hdHRlcixcblx0XHRcdCksXG5cdFx0XHRcIntjb250ZW50fVwiLFxuXHRcdFx0ZG9jdW1lbnQuY29udGVudCxcblx0XHQpO1xuXHR9XG59XG5cbmNsYXNzIEF1dG9Gcm9udG1hdHRlclNldHRpbmdUYWIgZXh0ZW5kcyBQbHVnaW5TZXR0aW5nVGFiIHtcblx0cGx1Z2luOiBBdXRvRnJvbnRtYXR0ZXJQbHVnaW47XG5cdHByaXZhdGUgYWN0aXZlVGFiOiBTZXR0aW5nVGFiSWQgPSBcIumAmueUqFwiO1xuXHRwcml2YXRlIGJpbmRpbmdDdXJyZW50RGV2aWNlID0gZmFsc2U7XG5cdHByaXZhdGUgYmluZGluZ0N1cnJlbnREZXZpY2VDdXN0b20gPSBmYWxzZTtcblx0cHJpdmF0ZSBzY2FuUmVzdWx0czogU2NhblJlc3VsdFtdID0gW107XG5cdHByaXZhdGUgaGFzU2Nhbm5lZCA9IGZhbHNlO1xuXHRwcml2YXRlIGlzU2Nhbm5pbmcgPSBmYWxzZTtcblx0cHJpdmF0ZSBpc0V4ZWN1dGluZyA9IGZhbHNlO1xuXHRwcml2YXRlIHByb2Nlc3NlZENvdW50ID0gMDtcblx0cHJpdmF0ZSB1bm1hdGNoZWRGb2xkZXJzOiBVbm1hdGNoZWRGb2xkZXJSZXN1bHRbXSA9IFtdO1xuXHRwcml2YXRlIGhhc1NjYW5uZWRVbm1hdGNoZWRGb2xkZXJzID0gZmFsc2U7XG5cdHByaXZhdGUgaXNTY2FubmluZ1VubWF0Y2hlZEZvbGRlcnMgPSBmYWxzZTtcblx0cHJpdmF0ZSBhY3RpdmVJbmxpbmVFZGl0b3JDbGVhbnVwOiAoKCkgPT4gdm9pZCkgfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSBhaUFwaUtleVZpc2libGUgPSBmYWxzZTtcblx0cHJpdmF0ZSBhaVN1bW1hcnlDb21wbGV0aW9uUmVzdWx0czogQUlTdW1tYXJ5Q2FuZGlkYXRlW10gPSBbXTtcblx0cHJpdmF0ZSBoYXNTY2FubmVkQUlTdW1tYXJ5Q29tcGxldGlvbiA9IGZhbHNlO1xuXHRwcml2YXRlIGlzU2Nhbm5pbmdBSVN1bW1hcnlDb21wbGV0aW9uID0gZmFsc2U7XG5cdHByaXZhdGUgaXNFeGVjdXRpbmdBSVN1bW1hcnlDb21wbGV0aW9uID0gZmFsc2U7XG5cdHByaXZhdGUgcHJvY2Vzc2VkQUlTdW1tYXJ5Q29tcGxldGlvbkNvdW50ID0gMDtcblx0cHJpdmF0ZSBjdXJyZW50UnVsZVBhZ2UgPSAwO1xuXHRwcml2YXRlIGlzQ2hlY2tpbmdVcGRhdGUgPSBmYWxzZTtcblx0cHJpdmF0ZSBpc1VwZGF0aW5nID0gZmFsc2U7XG5cdHByaXZhdGUgdXBkYXRlUHJvZ3Jlc3MgPSAwO1xuXHRwcml2YXRlIHVwZGF0ZVJlc3VsdE1lc3NhZ2UgPSBcIlwiO1xuXHRwcml2YXRlIGxhdGVzdFZlcnNpb24gPSBcIlwiO1xuXG5cdGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwbHVnaW46IEF1dG9Gcm9udG1hdHRlclBsdWdpbikge1xuXHRcdHN1cGVyKGFwcCwgcGx1Z2luKTtcblx0XHR0aGlzLnBsdWdpbiA9IHBsdWdpbjtcblx0fVxuXG5cdGRpc3BsYXkoKTogdm9pZCB7XG5cdFx0Y29uc3QgeyBjb250YWluZXJFbCB9ID0gdGhpcztcblx0XHR0aGlzLmNsb3NlQWN0aXZlSW5saW5lRWRpdG9yKCk7XG5cdFx0Y29udGFpbmVyRWwuZW1wdHkoKTtcblxuXHRcdHRoaXMucmVuZGVyVGFicyhjb250YWluZXJFbCk7XG5cdFx0Y29uc3QgY29udGVudEVsID0gY29udGFpbmVyRWwuY3JlYXRlRGl2KHtcblx0XHRcdGNsczogXCJhdXRvLWZyb250bWF0dGVyLXRhYi1jb250ZW50XCIsXG5cdFx0XHRhdHRyOiB7IFwiZGF0YS1hdXRvLWZyb250bWF0dGVyLWFjdGl2ZS10YWJcIjogdGhpcy5hY3RpdmVUYWIgfSxcblx0XHR9KTtcblx0XHRpZiAodGhpcy5hY3RpdmVUYWIgPT09IFwi6YCa55SoXCIpIHtcblx0XHRcdHRoaXMucmVuZGVyR2VuZXJhbFNldHRpbmdzKGNvbnRlbnRFbCk7XG5cdFx0fSBlbHNlIGlmICh0aGlzLmFjdGl2ZVRhYiA9PT0gXCLmlofku7blpLnop4TliJlcIikge1xuXHRcdFx0dGhpcy5yZW5kZXJGb2xkZXJEZWZhdWx0UnVsZXMoY29udGVudEVsKTtcblx0XHR9IGVsc2UgaWYgKHRoaXMuYWN0aXZlVGFiID09PSBcIuaJq+aPj+S7k+W6k1wiKSB7XG5cdFx0XHR0aGlzLnJlbmRlclNjYW5TZWN0aW9uKGNvbnRlbnRFbCk7XG5cdFx0fSBlbHNlIGlmICh0aGlzLmFjdGl2ZVRhYiA9PT0gXCLorr7lpIfnu5HlrppcIikge1xuXHRcdFx0dGhpcy5yZW5kZXJEZXZpY2VCaW5kaW5ncyhjb250ZW50RWwpO1xuXHRcdH0gZWxzZSBpZiAodGhpcy5hY3RpdmVUYWIgPT09IFwi54mI5pys5pu05pawXCIpIHtcblx0XHRcdHRoaXMucmVuZGVyQWJvdXRTZWN0aW9uKGNvbnRlbnRFbCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMucmVuZGVyQUlTdW1tYXJ5U2V0dGluZ3MoY29udGVudEVsKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlclRhYnMoY29udGFpbmVyRWw6IEhUTUxFbGVtZW50KSB7XG5cdFx0Y29uc3QgdGFic0VsID0gY29udGFpbmVyRWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItdGFic1wiIH0pO1xuXHRcdGZvciAoY29uc3QgdGFiIG9mIFNFVFRJTkdfVEFCUykge1xuXHRcdFx0Y29uc3QgdGFiRWwgPSB0YWJzRWwuY3JlYXRlRWwoXCJidXR0b25cIiwge1xuXHRcdFx0XHRjbHM6IGBhdXRvLWZyb250bWF0dGVyLXRhYiR7dGhpcy5hY3RpdmVUYWIgPT09IHRhYiA/IFwiIGlzLWFjdGl2ZVwiIDogXCJcIn1gLFxuXHRcdFx0XHR0ZXh0OiB0YWIsXG5cdFx0XHR9KTtcblx0XHRcdHRhYkVsLm9uY2xpY2sgPSAoKSA9PiB7XG5cdFx0XHRcdHRoaXMuYWN0aXZlVGFiID0gdGFiO1xuXHRcdFx0XHR0aGlzLmRpc3BsYXkoKTtcblx0XHRcdH07XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJHZW5lcmFsU2V0dGluZ3MoY29udGFpbmVyRWw6IEhUTUxFbGVtZW50KSB7XG5cdFx0dGhpcy5yZW5kZXJSZXF1aXJlZEZpZWxkc0luZm8oY29udGFpbmVyRWwpO1xuXG5cdFx0Y29uc3QgaGlnaGxpZ2h0U2V0dGluZ0VsID0gY29udGFpbmVyRWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItaGlnaGxpZ2h0LXNldHRpbmdcIiB9KTtcblx0XHRuZXcgU2V0dGluZyhoaWdobGlnaHRTZXR0aW5nRWwpXG5cdFx0XHQuc2V0TmFtZShcIuepuuWxnuaAp+mrmOS6ruaPkOmGklwiKVxuXHRcdFx0LnNldERlc2MoXCLmiZPlvIDmlofku7bml7bpq5jkuq7mj5DphpLlv4XpnIDlsZ7mgKfkuK3nmoTnqbrlgLzjgIJcIilcblx0XHRcdC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT5cblx0XHRcdFx0dG9nZ2xlXG5cdFx0XHRcdFx0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmVtcHR5RmllbGRIaWdobGlnaHQpXG5cdFx0XHRcdFx0Lm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdFx0aWYgKCF0aGlzLnBsdWdpbi5lbnN1cmVEZXZpY2VCb3VuZCgpKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuZGlzcGxheSgpO1xuXHRcdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5lbXB0eUZpZWxkSGlnaGxpZ2h0ID0gdmFsdWU7XG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0XHRcdHRoaXMucGx1Z2luLnJlZnJlc2hFbXB0eUZpZWxkSGlnaGxpZ2h0cygpO1xuXHRcdFx0XHRcdH0pLFxuXHRcdFx0KTtcblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyQUlTdW1tYXJ5U2V0dGluZ3MoY29udGFpbmVyRWw6IEhUTUxFbGVtZW50KSB7XG5cdFx0Y29uc3QgaW50cm9FbCA9IGNvbnRhaW5lckVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLWFpLXN1bW1hcnktaW50cm9cIiB9KTtcblx0XHRuZXcgU2V0dGluZyhpbnRyb0VsKVxuXHRcdFx0LnNldE5hbWUoXCJBSSDoh6rliqjmkZjopoFcIilcblx0XHRcdC5zZXREZXNjKFwi5byA5ZCv5ZCO77yM5bCG5L2/55SoIEFJIOWvueaWh+aho+WGheWuuei/m+ihjOaRmOimgeaAu+e7k++8jOiHquWKqOWhq+WFpeOAjOaRmOimgeOAjeWtl+auteOAglwiKVxuXHRcdFx0LmFkZFRvZ2dsZSgodG9nZ2xlKSA9PlxuXHRcdFx0XHR0b2dnbGVcblx0XHRcdFx0XHQuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuYWlTdW1tYXJ5RW5hYmxlZClcblx0XHRcdFx0XHQub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5haVN1bW1hcnlFbmFibGVkID0gdmFsdWU7XG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0XHR9KSxcblx0XHRcdCk7XG5cblx0XHRjb250YWluZXJFbC5jcmVhdGVFbChcImgzXCIsIHsgdGV4dDogXCLmqKHlnovphY3nva5cIiB9KTtcblx0XHRuZXcgU2V0dGluZyhjb250YWluZXJFbClcblx0XHRcdC5zZXROYW1lKFwiQVBJIOWcsOWdgFwiKVxuXHRcdFx0LmFkZFRleHQoKHRleHQpID0+IHtcblx0XHRcdFx0dGV4dFxuXHRcdFx0XHRcdC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5haUFwaVVybClcblx0XHRcdFx0XHQub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5haUFwaVVybCA9IHZhbHVlO1xuXHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdHRleHQuaW5wdXRFbC5wbGFjZWhvbGRlciA9IFwiaHR0cHM6Ly9hcGkuc3RlcGZ1bi5jb20vc3RlcF9wbGFuL3YxXCI7XG5cdFx0XHR9KTtcblxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LnNldE5hbWUoXCLmqKHlnovlkI3np7BcIilcblx0XHRcdC5hZGRUZXh0KCh0ZXh0KSA9PiB7XG5cdFx0XHRcdHRleHRcblx0XHRcdFx0XHQuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuYWlNb2RlbE5hbWUpXG5cdFx0XHRcdFx0Lm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MuYWlNb2RlbE5hbWUgPSB2YWx1ZTtcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR0ZXh0LmlucHV0RWwucGxhY2Vob2xkZXIgPSBcInN0ZXAtMy43LWZsYXNoXCI7XG5cdFx0XHR9KTtcblxuXHRcdGNvbnN0IGFwaUtleVNldHRpbmcgPSBuZXcgU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcIkFQSSBLZXlcIik7XG5cdFx0YXBpS2V5U2V0dGluZy5jb250cm9sRWwuYWRkQ2xhc3MoXCJhdXRvLWZyb250bWF0dGVyLWFpLWFwaS1rZXktY29udHJvbFwiKTtcblx0XHRhcGlLZXlTZXR0aW5nLmFkZFRleHQoKHRleHQpID0+IHtcblx0XHRcdHRleHQuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuYWlBcGlLZXkpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuXHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5haUFwaUtleSA9IHZhbHVlO1xuXHRcdFx0XHRhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdH0pO1xuXHRcdFx0dGV4dC5pbnB1dEVsLnR5cGUgPSB0aGlzLmFpQXBpS2V5VmlzaWJsZSA/IFwidGV4dFwiIDogXCJwYXNzd29yZFwiO1xuXHRcdFx0dGV4dC5pbnB1dEVsLnBsYWNlaG9sZGVyID0gXCJzay14eHh4XCI7XG5cdFx0fSk7XG5cdFx0YXBpS2V5U2V0dGluZy5hZGRCdXR0b24oKGJ1dHRvbikgPT4ge1xuXHRcdFx0YnV0dG9uLnNldFRvb2x0aXAodGhpcy5haUFwaUtleVZpc2libGUgPyBcIumakOiXjyBBUEkgS2V5XCIgOiBcIuaYvuekuiBBUEkgS2V5XCIpLm9uQ2xpY2soKCkgPT4ge1xuXHRcdFx0XHR0aGlzLmFpQXBpS2V5VmlzaWJsZSA9ICF0aGlzLmFpQXBpS2V5VmlzaWJsZTtcblx0XHRcdFx0dGhpcy5kaXNwbGF5KCk7XG5cdFx0XHR9KTtcblx0XHRcdHNldEljb24oYnV0dG9uLmJ1dHRvbkVsLCB0aGlzLmFpQXBpS2V5VmlzaWJsZSA/IFwiZXllLW9mZlwiIDogXCJleWVcIik7XG5cdFx0fSk7XG5cblx0XHRcdGNvbnN0IHN0YXR1c0VsID0gY29udGFpbmVyRWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItYWktc3RhdHVzXCIgfSk7XG5cdFx0XHR0aGlzLnJlbmRlckFJU3VtbWFyeVRhc2tTZWN0aW9uKHN0YXR1c0VsLCB7XG5cdFx0XHRcdHRhc2s6IFwiY29tcGxldGlvblwiLFxuXHRcdFx0XHR0aXRsZTogXCLmkZjopoHooaXlhahcIixcblx0XHRcdFx0ZGVzY3JpcHRpb246IFwi5Li644CM5pGY6KaB44CN5Li656m65LiU5L2c6ICF5Li65pys5py657uR5a6a5L2c6ICF55qE5paH5qGj55Sf5oiQIEFJIOaRmOimgeOAglwiLFxuXHRcdFx0XHRhdXRvVGV4dDogXCLoh6rliqjop6blj5HvvJrmr48gMzAg5YiG6ZKfXCIsXG5cdFx0XHRcdGVtcHR5VGV4dDogXCLngrnlh7vmiavmj4/mn6XnnIvpnIDopoHooaXlhajmkZjopoHnmoTmlofmoaPjgIJcIixcblx0XHRcdFx0Y291bnRUZXh0OiBcIuevh+aWh+aho+mcgOimgeihpeWFqOaRmOimgVwiLFxuXHRcdFx0fSk7XG5cblx0XHRjb25zdCBwcm9tcHRIZWFkZXJFbCA9IGNvbnRhaW5lckVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLWFpLXByb21wdC1oZWFkZXJcIiB9KTtcblx0XHRwcm9tcHRIZWFkZXJFbC5jcmVhdGVFbChcImgzXCIsIHsgdGV4dDogXCLmkZjopoEgUHJvbXB0XCIgfSk7XG5cdFx0bmV3IFNldHRpbmcocHJvbXB0SGVhZGVyRWwpLmFkZEJ1dHRvbigoYnV0dG9uKSA9PiB7XG5cdFx0XHRidXR0b24uc2V0QnV0dG9uVGV4dChcIuaBouWkjem7mOiupFwiKS5vbkNsaWNrKGFzeW5jICgpID0+IHtcblx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MuYWlTdW1tYXJ5UHJvbXB0ID0gREVGQVVMVF9BSV9TVU1NQVJZX1BST01QVDtcblx0XHRcdFx0YXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdHRoaXMuZGlzcGxheSgpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0XHRjb25zdCBwcm9tcHRFbCA9IGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwidGV4dGFyZWFcIiwge1xuXHRcdFx0Y2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItYWktcHJvbXB0LXRleHRhcmVhXCIsXG5cdFx0fSk7XG5cdFx0cHJvbXB0RWwudmFsdWUgPSB0aGlzLnBsdWdpbi5zZXR0aW5ncy5haVN1bW1hcnlQcm9tcHQ7XG5cdFx0cHJvbXB0RWwuYWRkRXZlbnRMaXN0ZW5lcihcImNoYW5nZVwiLCBhc3luYyAoKSA9PiB7XG5cdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5haVN1bW1hcnlQcm9tcHQgPSBwcm9tcHRFbC52YWx1ZTtcblx0XHRcdGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJBSVN1bW1hcnlUYXNrU2VjdGlvbihcblx0XHRjb250YWluZXJFbDogSFRNTEVsZW1lbnQsXG5cdFx0b3B0aW9uczoge1xuXHRcdFx0dGFzazogQUlTdW1tYXJ5VGFza1R5cGU7XG5cdFx0XHR0aXRsZTogc3RyaW5nO1xuXHRcdFx0ZGVzY3JpcHRpb246IHN0cmluZztcblx0XHRcdGF1dG9UZXh0OiBzdHJpbmc7XG5cdFx0XHRlbXB0eVRleHQ6IHN0cmluZztcblx0XHRcdGNvdW50VGV4dDogc3RyaW5nO1xuXHRcdH0sXG5cdCkge1xuXHRcdGNvbnN0IHRhc2tFbCA9IGNvbnRhaW5lckVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLWFpLXRhc2stc2VjdGlvblwiIH0pO1xuXHRcdHRhc2tFbC5jcmVhdGVFbChcImgzXCIsIHsgdGV4dDogb3B0aW9ucy50aXRsZSB9KTtcblx0XHR0YXNrRWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItYWktdGFzay1kZXNjcmlwdGlvblwiLCB0ZXh0OiBvcHRpb25zLmRlc2NyaXB0aW9uIH0pO1xuXHRcdGNvbnN0IGhlYWRlckVsID0gdGFza0VsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLWFpLXRhc2staGVhZGVyXCIgfSk7XG5cdFx0aGVhZGVyRWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItYWktdGFzay1hdXRvXCIsIHRleHQ6IG9wdGlvbnMuYXV0b1RleHQgfSk7XG5cdFx0Y29uc3Qgc2NhbkFjdGlvbkVsID0gaGVhZGVyRWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItYWktdGFzay1hY3Rpb25cIiB9KTtcblx0XHRuZXcgU2V0dGluZyhzY2FuQWN0aW9uRWwpLmFkZEJ1dHRvbigoYnV0dG9uKSA9PiB7XG5cdFx0XHRjb25zdCBpc1NjYW5uaW5nID0gdGhpcy5nZXRBSVN1bW1hcnlUYXNrU3RhdGUob3B0aW9ucy50YXNrKS5pc1NjYW5uaW5nO1xuXHRcdFx0YnV0dG9uXG5cdFx0XHRcdC5zZXRCdXR0b25UZXh0KGlzU2Nhbm5pbmcgPyBcIuaJq+aPj+S4rS4uLlwiIDogXCLmiavmj49cIilcblx0XHRcdFx0LnNldERpc2FibGVkKGlzU2Nhbm5pbmcgfHwgdGhpcy5nZXRBSVN1bW1hcnlUYXNrU3RhdGUob3B0aW9ucy50YXNrKS5pc0V4ZWN1dGluZylcblx0XHRcdFx0Lm9uQ2xpY2soYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMuc2NhbkFJU3VtbWFyeVRhc2sob3B0aW9ucy50YXNrKTtcblx0XHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0XHRjb25zdCByZXN1bHRFbCA9IHRhc2tFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1haS1yZXN1bHRzXCIgfSk7XG5cdFx0Y29uc3Qgc3RhdGUgPSB0aGlzLmdldEFJU3VtbWFyeVRhc2tTdGF0ZShvcHRpb25zLnRhc2spO1xuXHRcdGlmICghc3RhdGUuaGFzU2Nhbm5lZCkge1xuXHRcdFx0cmVzdWx0RWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItYWktZW1wdHlcIiwgdGV4dDogb3B0aW9ucy5lbXB0eVRleHQgfSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHN0YXRlLnJlc3VsdHMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXN1bHRFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1haS1lbXB0eVwiLCB0ZXh0OiBcIuaaguaXoOmcgOimgeWkhOeQhueahOaWh+aho+OAglwiIH0pO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHJlc3VsdEVsLmNyZWF0ZURpdih7XG5cdFx0XHRjbHM6IFwiYXV0by1mcm9udG1hdHRlci1haS1jb3VudFwiLFxuXHRcdFx0dGV4dDogYOWFseWPkeeOsCAke3N0YXRlLnJlc3VsdHMubGVuZ3RofSAke29wdGlvbnMuY291bnRUZXh0fWAsXG5cdFx0fSk7XG5cdFx0Y29uc3QgbGlzdEVsID0gcmVzdWx0RWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItYWktbGlzdFwiIH0pO1xuXHRcdGZvciAoY29uc3QgcmVzdWx0IG9mIHN0YXRlLnJlc3VsdHMpIHtcblx0XHRcdGNvbnN0IGl0ZW1FbCA9IGxpc3RFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1haS1pdGVtXCIgfSk7XG5cdFx0XHRjb25zdCBjb250ZW50RWwgPSBpdGVtRWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItYWktaXRlbS1jb250ZW50XCIgfSk7XG5cdFx0XHRjb25zdCBuYW1lRWwgPSBjb250ZW50RWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItYWktbmFtZVwiIH0pO1xuXHRcdFx0bmFtZUVsLmNyZWF0ZVNwYW4oeyB0ZXh0OiByZXN1bHQuZmlsZS5uYW1lIH0pO1xuXHRcdFx0aWYgKHJlc3VsdC5kb25lKSB7XG5cdFx0XHRcdG5hbWVFbC5jcmVhdGVTcGFuKHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItYWktZG9uZVwiLCB0ZXh0OiBcIiDinJNcIiB9KTtcblx0XHRcdH1cblx0XHRcdGNvbnRlbnRFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1haS1wYXRoXCIsIHRleHQ6IHJlc3VsdC5maWxlLnBhdGggfSk7XG5cdFx0XHRjb25zdCBvcGVuQnV0dG9uID0gaXRlbUVsLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcblx0XHRcdFx0Y2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItYWktb3BlblwiLFxuXHRcdFx0XHRhdHRyOiB7IFwiYXJpYS1sYWJlbFwiOiBcIuaJk+W8gOaWh+S7tlwiIH0sXG5cdFx0XHR9KTtcblx0XHRcdHNldEljb24ob3BlbkJ1dHRvbiwgXCJleHRlcm5hbC1saW5rXCIpO1xuXHRcdFx0b3BlbkJ1dHRvbi5vbmNsaWNrID0gYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRhd2FpdCB0aGlzLmFwcC53b3Jrc3BhY2Uub3BlbkxpbmtUZXh0KHJlc3VsdC5maWxlLnBhdGgsIFwiXCIsIGZhbHNlKTtcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc3RhdHVzVGV4dCA9XG5cdFx0XHRzdGF0ZS5wcm9jZXNzZWRDb3VudCA9PT0gc3RhdGUucmVzdWx0cy5sZW5ndGggJiYgIXN0YXRlLmlzRXhlY3V0aW5nXG5cdFx0XHRcdD8gYOWujOaIkO+8jOW3suWkhOeQhiAke3N0YXRlLnByb2Nlc3NlZENvdW50fSDnr4dgXG5cdFx0XHRcdDogXCJcIjtcblx0XHRuZXcgU2V0dGluZyhyZXN1bHRFbClcblx0XHRcdC5zZXREZXNjKHN0YXR1c1RleHQpXG5cdFx0XHQuYWRkQnV0dG9uKChidXR0b24pID0+IHtcblx0XHRcdFx0YnV0dG9uXG5cdFx0XHRcdFx0LnNldEJ1dHRvblRleHQoc3RhdGUuaXNFeGVjdXRpbmcgPyBcIuaJp+ihjOS4rS4uLlwiIDogXCLmiafooYxcIilcblx0XHRcdFx0XHQuc2V0Q3RhKClcblx0XHRcdFx0XHQuc2V0RGlzYWJsZWQoc3RhdGUuaXNFeGVjdXRpbmcgfHwgdGhpcy5wbHVnaW4uaXNBSVN1bW1hcnlUYXNrUnVubmluZyhvcHRpb25zLnRhc2spKVxuXHRcdFx0XHRcdC5vbkNsaWNrKGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMuZXhlY3V0ZUFJU3VtbWFyeVRhc2sob3B0aW9ucy50YXNrKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRBSVN1bW1hcnlUYXNrU3RhdGUodGFzazogQUlTdW1tYXJ5VGFza1R5cGUpOiBBSVN1bW1hcnlUYXNrVWlTdGF0ZSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHJlc3VsdHM6IHRoaXMuYWlTdW1tYXJ5Q29tcGxldGlvblJlc3VsdHMsXG5cdFx0XHRoYXNTY2FubmVkOiB0aGlzLmhhc1NjYW5uZWRBSVN1bW1hcnlDb21wbGV0aW9uLFxuXHRcdFx0aXNTY2FubmluZzogdGhpcy5pc1NjYW5uaW5nQUlTdW1tYXJ5Q29tcGxldGlvbixcblx0XHRcdGlzRXhlY3V0aW5nOiB0aGlzLmlzRXhlY3V0aW5nQUlTdW1tYXJ5Q29tcGxldGlvbixcblx0XHRcdHByb2Nlc3NlZENvdW50OiB0aGlzLnByb2Nlc3NlZEFJU3VtbWFyeUNvbXBsZXRpb25Db3VudCxcblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBzZXRBSVN1bW1hcnlUYXNrUmVzdWx0cyh0YXNrOiBBSVN1bW1hcnlUYXNrVHlwZSwgcmVzdWx0czogQUlTdW1tYXJ5Q2FuZGlkYXRlW10pIHtcblx0XHR0aGlzLmFpU3VtbWFyeUNvbXBsZXRpb25SZXN1bHRzID0gcmVzdWx0cztcblx0fVxuXG5cdHByaXZhdGUgc2V0QUlTdW1tYXJ5VGFza1NjYW5uaW5nKHRhc2s6IEFJU3VtbWFyeVRhc2tUeXBlLCB2YWx1ZTogYm9vbGVhbikge1xuXHRcdHRoaXMuaXNTY2FubmluZ0FJU3VtbWFyeUNvbXBsZXRpb24gPSB2YWx1ZTtcblx0fVxuXG5cdHByaXZhdGUgc2V0QUlTdW1tYXJ5VGFza1NjYW5uZWQodGFzazogQUlTdW1tYXJ5VGFza1R5cGUsIHZhbHVlOiBib29sZWFuKSB7XG5cdFx0dGhpcy5oYXNTY2FubmVkQUlTdW1tYXJ5Q29tcGxldGlvbiA9IHZhbHVlO1xuXHR9XG5cblx0cHJpdmF0ZSBzZXRBSVN1bW1hcnlUYXNrRXhlY3V0aW5nKHRhc2s6IEFJU3VtbWFyeVRhc2tUeXBlLCB2YWx1ZTogYm9vbGVhbikge1xuXHRcdHRoaXMuaXNFeGVjdXRpbmdBSVN1bW1hcnlDb21wbGV0aW9uID0gdmFsdWU7XG5cdH1cblxuXHRwcml2YXRlIHNldEFJU3VtbWFyeVRhc2tQcm9jZXNzZWRDb3VudCh0YXNrOiBBSVN1bW1hcnlUYXNrVHlwZSwgdmFsdWU6IG51bWJlcikge1xuXHRcdHRoaXMucHJvY2Vzc2VkQUlTdW1tYXJ5Q29tcGxldGlvbkNvdW50ID0gdmFsdWU7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHNjYW5BSVN1bW1hcnlUYXNrKHRhc2s6IEFJU3VtbWFyeVRhc2tUeXBlKSB7XG5cdFx0dGhpcy5zZXRBSVN1bW1hcnlUYXNrU2Nhbm5lZCh0YXNrLCB0cnVlKTtcblx0XHR0aGlzLnNldEFJU3VtbWFyeVRhc2tTY2FubmluZyh0YXNrLCB0cnVlKTtcblx0XHR0aGlzLnNldEFJU3VtbWFyeVRhc2tSZXN1bHRzKHRhc2ssIFtdKTtcblx0XHR0aGlzLnNldEFJU3VtbWFyeVRhc2tQcm9jZXNzZWRDb3VudCh0YXNrLCAwKTtcblx0XHR0aGlzLmRpc3BsYXkoKTtcblxuXHRcdGNvbnN0IHJlc3VsdHMgPSBhd2FpdCB0aGlzLnBsdWdpbi5zY2FuQUlTdW1tYXJ5Q2FuZGlkYXRlcyh0YXNrLCB0cnVlKTtcblx0XHR0aGlzLnNldEFJU3VtbWFyeVRhc2tSZXN1bHRzKHRhc2ssIHJlc3VsdHMpO1xuXHRcdHRoaXMuc2V0QUlTdW1tYXJ5VGFza1NjYW5uaW5nKHRhc2ssIGZhbHNlKTtcblx0XHR0aGlzLmRpc3BsYXkoKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZXhlY3V0ZUFJU3VtbWFyeVRhc2sodGFzazogQUlTdW1tYXJ5VGFza1R5cGUpIHtcblx0XHRjb25zdCBzdGF0ZSA9IHRoaXMuZ2V0QUlTdW1tYXJ5VGFza1N0YXRlKHRhc2spO1xuXHRcdGlmIChzdGF0ZS5yZXN1bHRzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0bmV3IE5vdGljZShcIkFJIOaRmOimge+8muaaguaXoOmcgOimgeWkhOeQhueahOaWh+aho1wiKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLnNldEFJU3VtbWFyeVRhc2tFeGVjdXRpbmcodGFzaywgdHJ1ZSk7XG5cdFx0dGhpcy5zZXRBSVN1bW1hcnlUYXNrUHJvY2Vzc2VkQ291bnQodGFzaywgMCk7XG5cdFx0Zm9yIChjb25zdCByZXN1bHQgb2Ygc3RhdGUucmVzdWx0cykge1xuXHRcdFx0cmVzdWx0LmRvbmUgPSBmYWxzZTtcblx0XHR9XG5cdFx0dGhpcy5kaXNwbGF5KCk7XG5cblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgcHJvY2Vzc2VkQ291bnQgPSBhd2FpdCB0aGlzLnBsdWdpbi5leGVjdXRlQUlTdW1tYXJ5UXVldWUodGFzaywgc3RhdGUucmVzdWx0cywgdHJ1ZSwgKCkgPT4ge1xuXHRcdFx0XHR0aGlzLnNldEFJU3VtbWFyeVRhc2tQcm9jZXNzZWRDb3VudCh0YXNrLCB0aGlzLmdldEFJU3VtbWFyeVRhc2tTdGF0ZSh0YXNrKS5wcm9jZXNzZWRDb3VudCArIDEpO1xuXHRcdFx0XHR0aGlzLmRpc3BsYXkoKTtcblx0XHRcdH0pO1xuXHRcdFx0dGhpcy5zZXRBSVN1bW1hcnlUYXNrUHJvY2Vzc2VkQ291bnQodGFzaywgcHJvY2Vzc2VkQ291bnQpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHR0aGlzLnNldEFJU3VtbWFyeVRhc2tFeGVjdXRpbmcodGFzaywgZmFsc2UpO1xuXHRcdFx0dGhpcy5kaXNwbGF5KCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJSZXF1aXJlZEZpZWxkc0luZm8oY29udGFpbmVyRWw6IEhUTUxFbGVtZW50KSB7XG5cdFx0Y29uc3Qgc2VjdGlvbkVsID0gY29udGFpbmVyRWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItcmVxdWlyZWQtZmllbGRzXCIgfSk7XG5cdFx0c2VjdGlvbkVsLmNyZWF0ZUVsKFwiaDJcIiwgeyB0ZXh0OiBcIum7mOiupOaWh+S7tuWxnuaAp+Wtl+autVwiIH0pO1xuXHRcdHNlY3Rpb25FbC5jcmVhdGVFbChcInBcIiwge1xuXHRcdFx0dGV4dDogXCLku6XkuIvlrZfmrrXkvJrlnKjmlrDlu7rmlofmoaPml7boh6rliqjlhpnlhaXvvIzlubblnKjmiavmj4/ku5PlupPml7booaXlhajmo4Dmn6XjgIJcIixcblx0XHR9KTtcblxuXHRcdGNvbnN0IHRhYmxlID0gc2VjdGlvbkVsLmNyZWF0ZUVsKFwidGFibGVcIik7XG5cdFx0Y29uc3QgdGhlYWQgPSB0YWJsZS5jcmVhdGVFbChcInRoZWFkXCIpO1xuXHRcdGNvbnN0IGhlYWRlclJvdyA9IHRoZWFkLmNyZWF0ZUVsKFwidHJcIik7XG5cdFx0Zm9yIChjb25zdCBoZWFkZXIgb2YgW1wi5a2X5q61XCIsIFwi6K+05piOXCIsIFwi5aGr5YaZ5pa55byPXCJdKSB7XG5cdFx0XHRoZWFkZXJSb3cuY3JlYXRlRWwoXCJ0aFwiLCB7IHRleHQ6IGhlYWRlciB9KTtcblx0XHR9XG5cblx0XHRjb25zdCB0Ym9keSA9IHRhYmxlLmNyZWF0ZUVsKFwidGJvZHlcIik7XG5cdFx0Zm9yIChjb25zdCByb3cgb2YgW1xuXHRcdFx0W1wi6aG555uuXCIsIFwi5paH5qGj5omA5bGe6aG555uuXCIsIFwi5paH5Lu25aS56KeE5YiZ6Ieq5Yqo5aGr5YaZ77yM5oiW5omL5Yqo5aGr5YaZXCJdLFxuXHRcdFx0W1wi57G75Z6LXCIsIFwi5paH5qGj57G75Z6LXCIsIFwi5paH5Lu25aS56KeE5YiZ6Ieq5Yqo5aGr5YaZ77yM5oiW5omL5Yqo5aGr5YaZXCJdLFxuXHRcdFx0W1wi5L2c6ICFXCIsIFwi5paH5qGj5Yib5bu66ICFXCIsIFwi5qC55o2u6K6+5aSH6Ieq5Yqo6K+G5YirXCJdLFxuXHRcdFx0W1wi5pGY6KaBXCIsIFwi5paH5qGj5YaF5a655pGY6KaBXCIsIFwi5omL5Yqo5aGr5YaZIC8gQUkg6Ieq5Yqo55Sf5oiQXCJdLFxuXHRcdFx0W1wi5Yib5bu65pe26Ze0XCIsIFwi5paH5qGj5Yib5bu65pe26Ze0XCIsIFwi6Ieq5Yqo6I635Y+WXCJdLFxuXHRcdFx0W1wi5pyA5ZCO5pu05pawXCIsIFwi5pyA5ZCO5LiA5qyh57yW6L6R5pe26Ze0XCIsIFwi6Ieq5Yqo5pu05pawXCJdLFxuXHRcdF0pIHtcblx0XHRcdGNvbnN0IHRyID0gdGJvZHkuY3JlYXRlRWwoXCJ0clwiKTtcblx0XHRcdGZvciAoY29uc3QgY2VsbCBvZiByb3cpIHtcblx0XHRcdFx0dHIuY3JlYXRlRWwoXCJ0ZFwiLCB7IHRleHQ6IGNlbGwgfSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJEZXZpY2VCaW5kaW5ncyhjb250YWluZXJFbDogSFRNTEVsZW1lbnQpIHtcblx0XHR0aGlzLnJlbmRlckN1cnJlbnREZXZpY2VTdGF0dXMoY29udGFpbmVyRWwpO1xuXHRcdHRoaXMucmVuZGVyQm91bmREZXZpY2VMaXN0KGNvbnRhaW5lckVsKTtcblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyQ3VycmVudERldmljZVN0YXR1cyhjb250YWluZXJFbDogSFRNTEVsZW1lbnQpIHtcblx0XHRjb25zdCBjdXJyZW50QmluZGluZyA9IHRoaXMuZ2V0Q3VycmVudERldmljZUJpbmRpbmcoKTtcblx0XHRjb25zdCBzdGF0dXNFbCA9IGNvbnRhaW5lckVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLWN1cnJlbnQtZGV2aWNlLWNhcmRcIiB9KTtcblx0XHRzdGF0dXNFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1jdXJyZW50LWRldmljZS10aXRsZVwiLCB0ZXh0OiBcIuacrOacuuiuvuWkh1wiIH0pO1xuXHRcdHN0YXR1c0VsLmNyZWF0ZURpdih7XG5cdFx0XHRjbHM6IFwiYXV0by1mcm9udG1hdHRlci1jdXJyZW50LWRldmljZS1saW5lXCIsXG5cdFx0XHR0ZXh0OiBgVVVJRO+8miR7bWFza0RldmljZVV1aWQodGhpcy5wbHVnaW4uY3VycmVudERldmljZVV1aWQpfWAsXG5cdFx0fSk7XG5cblx0XHRpZiAoY3VycmVudEJpbmRpbmc/LmF1dGhvcikge1xuXHRcdFx0c3RhdHVzRWwuY3JlYXRlRGl2KHtcblx0XHRcdFx0Y2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItY3VycmVudC1kZXZpY2UtbGluZVwiLFxuXHRcdFx0XHR0ZXh0OiBg54q25oCB77ya4pyFIOW3sue7keWumiDigJQgJHtjdXJyZW50QmluZGluZy5hdXRob3J9YCxcblx0XHRcdH0pO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHN0YXR1c0VsLmNyZWF0ZURpdih7XG5cdFx0XHRjbHM6IFwiYXV0by1mcm9udG1hdHRlci1jdXJyZW50LWRldmljZS1saW5lXCIsXG5cdFx0XHR0ZXh0OiBcIueKtuaAge+8muKaoO+4jyDmnKrnu5HlrppcIixcblx0XHR9KTtcblxuXHRcdGNvbnN0IGFjdGlvbkVsID0gc3RhdHVzRWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItY3VycmVudC1kZXZpY2UtYWN0aW9uXCIgfSk7XG5cdFx0aWYgKHRoaXMuYmluZGluZ0N1cnJlbnREZXZpY2UpIHtcblx0XHRcdGlmICh0aGlzLmJpbmRpbmdDdXJyZW50RGV2aWNlQ3VzdG9tKSB7XG5cdFx0XHRcdG5ldyBTZXR0aW5nKGFjdGlvbkVsKS5hZGRUZXh0KCh0ZXh0KSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgY29uZmlybSA9IGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMuYmluZEN1cnJlbnREZXZpY2UodGV4dC5nZXRWYWx1ZSgpKTtcblx0XHRcdFx0XHR9O1xuXG5cdFx0XHRcdFx0dGV4dC5zZXRQbGFjZWhvbGRlcihcIuiHquWumuS5ieS9nOiAhVwiKTtcblx0XHRcdFx0XHR0ZXh0LmlucHV0RWwub25ibHVyID0gY29uZmlybTtcblx0XHRcdFx0XHR0ZXh0LmlucHV0RWwub25rZXlkb3duID0gKGV2ZW50KSA9PiB7XG5cdFx0XHRcdFx0XHRpZiAoZXZlbnQua2V5ID09PSBcIkVudGVyXCIpIHtcblx0XHRcdFx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0XHRcdFx0Y29uZmlybSgpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0d2luZG93LnNldFRpbWVvdXQoKCkgPT4gdGV4dC5pbnB1dEVsLmZvY3VzKCksIDApO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG5ldyBTZXR0aW5nKGFjdGlvbkVsKS5hZGREcm9wZG93bigoZHJvcGRvd24pID0+IHtcblx0XHRcdFx0XHRkcm9wZG93bi5hZGRPcHRpb24oXCJcIiwgXCLvvIjor7fpgInmi6nvvIlcIik7XG5cdFx0XHRcdFx0Zm9yIChjb25zdCBvcHRpb24gb2YgQVVUSE9SX09QVElPTlMpIHtcblx0XHRcdFx0XHRcdGRyb3Bkb3duLmFkZE9wdGlvbihvcHRpb24sIG9wdGlvbik7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0ZHJvcGRvd24ub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0XHRpZiAodmFsdWUgPT09IENVU1RPTV9BVVRIT1JfTU9ERSkge1xuXHRcdFx0XHRcdFx0XHR0aGlzLmJpbmRpbmdDdXJyZW50RGV2aWNlQ3VzdG9tID0gdHJ1ZTtcblx0XHRcdFx0XHRcdFx0dGhpcy5kaXNwbGF5KCk7XG5cdFx0XHRcdFx0XHR9IGVsc2UgaWYgKHZhbHVlKSB7XG5cdFx0XHRcdFx0XHRcdGF3YWl0IHRoaXMuYmluZEN1cnJlbnREZXZpY2UodmFsdWUpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0bmV3IFNldHRpbmcoYWN0aW9uRWwpLmFkZEJ1dHRvbigoYnV0dG9uKSA9PiB7XG5cdFx0XHRcdGJ1dHRvbi5zZXRCdXR0b25UZXh0KFwi57uR5a6a5pys5py6XCIpLnNldEN0YSgpLm9uQ2xpY2soKCkgPT4ge1xuXHRcdFx0XHRcdHRoaXMuYmluZGluZ0N1cnJlbnREZXZpY2UgPSB0cnVlO1xuXHRcdFx0XHRcdHRoaXMuYmluZGluZ0N1cnJlbnREZXZpY2VDdXN0b20gPSBmYWxzZTtcblx0XHRcdFx0XHR0aGlzLmRpc3BsYXkoKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlckJvdW5kRGV2aWNlTGlzdChjb250YWluZXJFbDogSFRNTEVsZW1lbnQpIHtcblx0XHRjb250YWluZXJFbC5jcmVhdGVFbChcImgyXCIsIHsgdGV4dDogXCLmiYDmnInlt7Lnu5Hlrprorr7lpIdcIiB9KTtcblx0XHRjb25zdCBsaXN0RWwgPSBjb250YWluZXJFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1ib3VuZC1kZXZpY2UtbGlzdFwiIH0pO1xuXHRcdGNvbnN0IGJpbmRpbmdzID0gdGhpcy5wbHVnaW4uc2V0dGluZ3MuZGV2aWNlQmluZGluZ3MuZmlsdGVyKChiaW5kaW5nKSA9PiBiaW5kaW5nLnV1aWQgJiYgYmluZGluZy5hdXRob3IpO1xuXHRcdGlmIChiaW5kaW5ncy5sZW5ndGggPT09IDApIHtcblx0XHRcdGxpc3RFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1ib3VuZC1kZXZpY2UtZW1wdHlcIiwgdGV4dDogXCLmmoLml6Dlt7Lnu5Hlrprorr7lpIdcIiB9KTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRmb3IgKGNvbnN0IGJpbmRpbmcgb2YgYmluZGluZ3MpIHtcblx0XHRcdGNvbnN0IHJvd0VsID0gbGlzdEVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLWJvdW5kLWRldmljZS1yb3dcIiB9KTtcblx0XHRcdHJvd0VsLmNyZWF0ZURpdih7XG5cdFx0XHRcdGNsczogXCJhdXRvLWZyb250bWF0dGVyLWJvdW5kLWRldmljZS11dWlkXCIsXG5cdFx0XHRcdHRleHQ6IG1hc2tEZXZpY2VVdWlkKGJpbmRpbmcudXVpZCksXG5cdFx0XHR9KTtcblx0XHRcdGNvbnN0IGF1dGhvckVsID0gcm93RWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItYm91bmQtZGV2aWNlLWF1dGhvclwiIH0pO1xuXHRcdFx0YXV0aG9yRWwuY3JlYXRlU3Bhbih7IHRleHQ6IGJpbmRpbmcuYXV0aG9yIH0pO1xuXHRcdFx0aWYgKGJpbmRpbmcudXVpZCA9PT0gdGhpcy5wbHVnaW4uY3VycmVudERldmljZVV1aWQpIHtcblx0XHRcdFx0YXV0aG9yRWwuY3JlYXRlU3Bhbih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLWRldmljZS1sb2NhbFwiLCB0ZXh0OiBcIu+8iOacrOacuu+8iVwiIH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyQWJvdXRTZWN0aW9uKGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCkge1xuXHRcdGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwiaDJcIiwgeyB0ZXh0OiBcImF1dG8tZnJvbnRtYXR0ZXJcIiB9KTtcblx0XHRjb250YWluZXJFbC5jcmVhdGVEaXYoe1xuXHRcdFx0Y2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItYWJvdXQtdmVyc2lvblwiLFxuXHRcdFx0dGV4dDogYOW9k+WJjeeJiOacrO+8miR7dGhpcy5wbHVnaW4ubWFuaWZlc3QudmVyc2lvbn1gLFxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgYWN0aW9uRWwgPSBjb250YWluZXJFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1hYm91dC1hY3Rpb25cIiB9KTtcblx0XHRjb25zdCBjaGVja0J1dHRvbiA9IGFjdGlvbkVsLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcblx0XHRcdGNsczogXCJtb2QtY3RhIGF1dG8tZnJvbnRtYXR0ZXItYWJvdXQtY2hlY2stYnRuXCIsXG5cdFx0XHR0ZXh0OiB0aGlzLmlzQ2hlY2tpbmdVcGRhdGUgPyBcIuajgOafpeS4rS4uLlwiIDogXCLmo4Dmn6Xmm7TmlrBcIixcblx0XHR9KTtcblx0XHRjaGVja0J1dHRvbi5kaXNhYmxlZCA9IHRoaXMuaXNDaGVja2luZ1VwZGF0ZSB8fCB0aGlzLmlzVXBkYXRpbmc7XG5cdFx0Y2hlY2tCdXR0b24ub25jbGljayA9IGFzeW5jICgpID0+IHtcblx0XHRcdHRoaXMuaXNDaGVja2luZ1VwZGF0ZSA9IHRydWU7XG5cdFx0XHR0aGlzLnVwZGF0ZVJlc3VsdE1lc3NhZ2UgPSBcIlwiO1xuXHRcdFx0dGhpcy5sYXRlc3RWZXJzaW9uID0gXCJcIjtcblx0XHRcdHRoaXMuZGlzcGxheSgpO1xuXG5cdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLnBsdWdpbi5jaGVja0ZvclVwZGF0ZSgpO1xuXHRcdFx0dGhpcy5pc0NoZWNraW5nVXBkYXRlID0gZmFsc2U7XG5cblx0XHRcdGlmIChyZXN1bHQuZXJyb3IgPT09IFwibm90X2ZvdW5kXCIpIHtcblx0XHRcdFx0bmV3IE5vdGljZShcIuacquaJvuWIsOi/nOerr+S7k+W6k++8jOivt+ajgOafpee9kee7nFwiKTtcblx0XHRcdFx0dGhpcy51cGRhdGVSZXN1bHRNZXNzYWdlID0gXCLmnKrmib7liLDov5znq6/ku5PlupPvvIzor7fmo4Dmn6XnvZHnu5xcIjtcblx0XHRcdH0gZWxzZSBpZiAocmVzdWx0LmVycm9yKSB7XG5cdFx0XHRcdG5ldyBOb3RpY2UocmVzdWx0LmVycm9yKTtcblx0XHRcdFx0dGhpcy51cGRhdGVSZXN1bHRNZXNzYWdlID0gcmVzdWx0LmVycm9yO1xuXHRcdFx0fSBlbHNlIGlmIChyZXN1bHQuaGFzVXBkYXRlKSB7XG5cdFx0XHRcdHRoaXMubGF0ZXN0VmVyc2lvbiA9IHJlc3VsdC52ZXJzaW9uO1xuXHRcdFx0XHR0aGlzLnVwZGF0ZVJlc3VsdE1lc3NhZ2UgPSBg8J+UhCDlj5HnjrDmlrDniYjmnKzvvJoke3Jlc3VsdC52ZXJzaW9ufe+8iOW9k+WJjSAke3RoaXMucGx1Z2luLm1hbmlmZXN0LnZlcnNpb25977yJYDtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMudXBkYXRlUmVzdWx0TWVzc2FnZSA9IGDinIUg5b2T5YmN5bey5piv5pyA5paw54mI5pys77yIJHt0aGlzLnBsdWdpbi5tYW5pZmVzdC52ZXJzaW9ufe+8iWA7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmRpc3BsYXkoKTtcblx0XHR9O1xuXG5cdFx0aWYgKHRoaXMudXBkYXRlUmVzdWx0TWVzc2FnZSkge1xuXHRcdFx0Y29uc3QgcmVzdWx0RWwgPSBjb250YWluZXJFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1hYm91dC1yZXN1bHRcIiB9KTtcblx0XHRcdHJlc3VsdEVsLmNyZWF0ZURpdih7IHRleHQ6IHRoaXMudXBkYXRlUmVzdWx0TWVzc2FnZSB9KTtcblxuXHRcdFx0aWYgKHRoaXMubGF0ZXN0VmVyc2lvbikge1xuXHRcdFx0XHRjb25zdCB1cGRhdGVCdXR0b24gPSByZXN1bHRFbC5jcmVhdGVFbChcImJ1dHRvblwiLCB7XG5cdFx0XHRcdFx0Y2xzOiBcIm1vZC1jdGEgYXV0by1mcm9udG1hdHRlci1hYm91dC11cGRhdGUtYnRuXCIsXG5cdFx0XHRcdFx0dGV4dDogdGhpcy5pc1VwZGF0aW5nID8gYOabtOaWsOS4rS4uLu+8iCR7dGhpcy51cGRhdGVQcm9ncmVzc30vM++8iWAgOiBcIueri+WNs+abtOaWsFwiLFxuXHRcdFx0XHR9KTtcblx0XHRcdFx0dXBkYXRlQnV0dG9uLmRpc2FibGVkID0gdGhpcy5pc1VwZGF0aW5nO1xuXHRcdFx0XHR1cGRhdGVCdXR0b24ub25jbGljayA9IGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHR0aGlzLmlzVXBkYXRpbmcgPSB0cnVlO1xuXHRcdFx0XHRcdHRoaXMudXBkYXRlUHJvZ3Jlc3MgPSAwO1xuXHRcdFx0XHRcdHRoaXMuZGlzcGxheSgpO1xuXG5cdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMucGx1Z2luLnBlcmZvcm1VcGRhdGUodGhpcy5sYXRlc3RWZXJzaW9uLCAoc3RlcCwgdG90YWwpID0+IHtcblx0XHRcdFx0XHRcdFx0dGhpcy51cGRhdGVQcm9ncmVzcyA9IHN0ZXA7XG5cdFx0XHRcdFx0XHRcdHRoaXMuZGlzcGxheSgpO1xuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHR0aGlzLmlzVXBkYXRpbmcgPSBmYWxzZTtcblx0XHRcdFx0XHRcdHRoaXMubGF0ZXN0VmVyc2lvbiA9IFwiXCI7XG5cdFx0XHRcdFx0XHR0aGlzLnVwZGF0ZVJlc3VsdE1lc3NhZ2UgPSBcIlwiO1xuXHRcdFx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdFx0XHR0aGlzLmlzVXBkYXRpbmcgPSBmYWxzZTtcblx0XHRcdFx0XHRcdG5ldyBOb3RpY2UoYOabtOaWsOWksei0pe+8miR7Z2V0RXJyb3JNZXNzYWdlKGVycm9yKX1gKTtcblx0XHRcdFx0XHRcdHRoaXMudXBkYXRlUmVzdWx0TWVzc2FnZSA9IGDmm7TmlrDlpLHotKXvvJoke2dldEVycm9yTWVzc2FnZShlcnJvcil9YDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0dGhpcy5kaXNwbGF5KCk7XG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBnZXRDdXJyZW50RGV2aWNlQmluZGluZygpOiBEZXZpY2VBdXRob3JCaW5kaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5wbHVnaW4uc2V0dGluZ3MuZGV2aWNlQmluZGluZ3MuZmluZCgoYmluZGluZykgPT4ge1xuXHRcdFx0cmV0dXJuIGJpbmRpbmcudXVpZCA9PT0gdGhpcy5wbHVnaW4uY3VycmVudERldmljZVV1aWQ7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGJpbmRDdXJyZW50RGV2aWNlKGF1dGhvcjogc3RyaW5nKSB7XG5cdFx0Y29uc3QgdHJpbW1lZCA9IGF1dGhvci50cmltKCk7XG5cdFx0aWYgKCF0cmltbWVkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0bGV0IGJpbmRpbmcgPSB0aGlzLmdldEN1cnJlbnREZXZpY2VCaW5kaW5nKCk7XG5cdFx0aWYgKCFiaW5kaW5nKSB7XG5cdFx0XHRiaW5kaW5nID0ge1xuXHRcdFx0XHR1dWlkOiB0aGlzLnBsdWdpbi5jdXJyZW50RGV2aWNlVXVpZCxcblx0XHRcdFx0YXV0aG9yOiB0cmltbWVkLFxuXHRcdFx0fTtcblx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLmRldmljZUJpbmRpbmdzLnB1c2goYmluZGluZyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGJpbmRpbmcuYXV0aG9yID0gdHJpbW1lZDtcblx0XHR9XG5cblx0XHR0aGlzLmJpbmRpbmdDdXJyZW50RGV2aWNlID0gZmFsc2U7XG5cdFx0dGhpcy5iaW5kaW5nQ3VycmVudERldmljZUN1c3RvbSA9IGZhbHNlO1xuXHRcdFx0YXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHR0aGlzLmRpc3BsYXkoKTtcblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyRm9sZGVyRGVmYXVsdFJ1bGVzKGZvbGRlclJ1bGVUYWJDb250ZW50OiBIVE1MRWxlbWVudCkge1xuXHRcdGZvbGRlclJ1bGVUYWJDb250ZW50LmFkZENsYXNzKFwiYXV0by1mcm9udG1hdHRlci1mb2xkZXItcnVsZXMtdGFiXCIpO1xuXHRcdGNvbnN0IHNlY3Rpb25FbCA9IGZvbGRlclJ1bGVUYWJDb250ZW50LmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLWZvbGRlci1ydWxlcy1zZWN0aW9uXCIgfSk7XG5cdFx0Y29uc3QgaGVhZGVyRWwgPSBzZWN0aW9uRWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItZm9sZGVyLXJ1bGVzLWhlYWRlclwiIH0pO1xuXHRcdGNvbnN0IGhlYWRlclRvcEVsID0gaGVhZGVyRWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItZm9sZGVyLXJ1bGVzLWhlYWRlci10b3BcIiB9KTtcblx0XHRoZWFkZXJUb3BFbC5jcmVhdGVFbChcImgyXCIsIHsgdGV4dDogXCLmlofku7blpLnlhoXmlofmoaPlsZ7mgKfljLnphY3op4TliJlcIiB9KTtcblx0XHRjb25zdCBhZGRSdWxlRWwgPSBoZWFkZXJUb3BFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1mb2xkZXItcnVsZXMtYWRkLWFjdGlvblwiIH0pO1xuXHRcdG5ldyBTZXR0aW5nKGFkZFJ1bGVFbCkuYWRkQnV0dG9uKChidXR0b24pID0+IHtcblx0XHRcdGJ1dHRvbi5zZXRCdXR0b25UZXh0KFwi5re75Yqg6KeE5YiZXCIpLnNldEN0YSgpLm9uQ2xpY2soYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRpZiAoIXRoaXMucGx1Z2luLmVuc3VyZURldmljZUJvdW5kKCkpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MuZm9sZGVyRGVmYXVsdHMucHVzaCh0aGlzLnBsdWdpbi5jcmVhdGVGb2xkZXJSdWxlKCkpO1xuXHRcdFx0XHRhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0dGhpcy5jdXJyZW50UnVsZVBhZ2UgPSBNYXRoLm1heCgwLCBNYXRoLmNlaWwodGhpcy5wbHVnaW4uc2V0dGluZ3MuZm9sZGVyRGVmYXVsdHMubGVuZ3RoIC8gUlVMRVNfUEVSX1BBR0UpIC0gMSk7XG5cdFx0XHRcdHRoaXMuZGlzcGxheSgpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdFx0aGVhZGVyRWwuY3JlYXRlRWwoXCJwXCIsIHtcblx0XHRcdGNsczogXCJhdXRvLWZyb250bWF0dGVyLWZvbGRlci1ydWxlcy1zdWJ0aXRsZVwiLFxuXHRcdFx0dGV4dDogXCLmi5blhaXop4TliJnmlofku7blpLnlhoXnmoTmiYDmnIltZOaWh+S7tu+8jOm7mOiupOeahOaWh+S7tuWxnuaAp+Wtl+auteS8mui3n+maj+WMuemFjeinhOWImei1sFwiLFxuXHRcdH0pO1xuXHRcdGhlYWRlckVsLmNyZWF0ZUVsKFwicFwiLCB7XG5cdFx0XHRjbHM6IFwiYXV0by1mcm9udG1hdHRlci1mb2xkZXItcnVsZXMtbm90ZVwiLFxuXHRcdFx0dGV4dDogJ+W9k+WJjeS7heaUr+aMgeiuvue9rlwi6aG555uuXCJcIuexu+Wei1wi5a2X5q61Jyxcblx0XHR9KTtcblxuXHRcdGNvbnN0IGZvbGRlcnMgPSBnZXRWYXVsdEZvbGRlcnModGhpcy5hcHApO1xuXHRcdHRoaXMucmVuZGVyUnVsZUNhcm91c2VsKHNlY3Rpb25FbCwgZm9sZGVycyk7XG5cblx0XHRzZWN0aW9uRWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItc2VjdGlvbi1kaXZpZGVyXCIgfSk7XG5cblx0XHRjb25zdCBjaGVja21hcmtTZXR0aW5nRWwgPSBzZWN0aW9uRWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItZm9sZGVyLWNoZWNrbWFyay1zZXR0aW5nXCIgfSk7XG5cdFx0bmV3IFNldHRpbmcoY2hlY2ttYXJrU2V0dGluZ0VsKVxuXHRcdFx0LnNldE5hbWUoXCLlnKjmlofku7bliJfooajkuK3moIforrDlt7LphY3op4TliJnnmoTmlofku7blpLlcIilcblx0XHRcdC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT4ge1xuXHRcdFx0XHR0b2dnbGVcblx0XHRcdFx0XHQuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3Muc2hvd0ZvbGRlckNoZWNrbWFyaylcblx0XHRcdFx0XHQub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0XHRpZiAoIXRoaXMucGx1Z2luLmVuc3VyZURldmljZUJvdW5kKCkpIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5kaXNwbGF5KCk7XG5cdFx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLnNob3dGb2xkZXJDaGVja21hcmsgPSB2YWx1ZTtcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4ucmVmcmVzaEZvbGRlckNoZWNrbWFya3MoKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXG5cdFx0c2VjdGlvbkVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLXNlY3Rpb24tZGl2aWRlclwiIH0pO1xuXG5cdFx0dGhpcy5yZW5kZXJVbm1hdGNoZWRGb2xkZXJTZWN0aW9uKHNlY3Rpb25FbCk7XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlclJ1bGVDYXJvdXNlbChmb2xkZXJSdWxlU2VjdGlvbkVsOiBIVE1MRWxlbWVudCwgZm9sZGVyczogc3RyaW5nW10pIHtcblx0XHRjb25zdCBydWxlQ291bnQgPSB0aGlzLnBsdWdpbi5zZXR0aW5ncy5mb2xkZXJEZWZhdWx0cy5sZW5ndGg7XG5cdFx0Y29uc3QgcGFnZUNvdW50ID0gTWF0aC5tYXgoMSwgTWF0aC5jZWlsKHJ1bGVDb3VudCAvIFJVTEVTX1BFUl9QQUdFKSk7XG5cdFx0dGhpcy5jdXJyZW50UnVsZVBhZ2UgPSBjbGFtcCh0aGlzLmN1cnJlbnRSdWxlUGFnZSwgMCwgcGFnZUNvdW50IC0gMSk7XG5cblx0XHRjb25zdCBjYXJvdXNlbEVsID0gZm9sZGVyUnVsZVNlY3Rpb25FbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1ydWxlLWNhcm91c2VsXCIgfSk7XG5cdFx0Y29uc3Qgdmlld3BvcnRFbCA9IGNhcm91c2VsRWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItcnVsZS1jYXJvdXNlbC12aWV3cG9ydFwiIH0pO1xuXHRcdGNvbnN0IGhhc011bHRpcGxlUGFnZXMgPSBwYWdlQ291bnQgPiAxO1xuXG5cdFx0aWYgKGhhc011bHRpcGxlUGFnZXMpIHtcblx0XHRcdHRoaXMucmVuZGVyUnVsZVBhZ2VCdXR0b24odmlld3BvcnRFbCwgXCJsZWZ0XCIsIHRoaXMuY3VycmVudFJ1bGVQYWdlID09PSAwLCAoKSA9PiB7XG5cdFx0XHRcdHRoaXMuY3VycmVudFJ1bGVQYWdlID0gTWF0aC5tYXgoMCwgdGhpcy5jdXJyZW50UnVsZVBhZ2UgLSAxKTtcblx0XHRcdFx0dGhpcy5kaXNwbGF5KCk7XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRjb25zdCBydWxlR3JpZEVsID0gdmlld3BvcnRFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1ydWxlLWdyaWRcIiB9KTtcblx0XHRjb25zdCBwYWdlU3RhcnQgPSB0aGlzLmN1cnJlbnRSdWxlUGFnZSAqIFJVTEVTX1BFUl9QQUdFO1xuXHRcdGNvbnN0IHBhZ2VSdWxlcyA9IHRoaXMucGx1Z2luLnNldHRpbmdzLmZvbGRlckRlZmF1bHRzLnNsaWNlKHBhZ2VTdGFydCwgcGFnZVN0YXJ0ICsgUlVMRVNfUEVSX1BBR0UpO1xuXG5cdFx0aWYgKHJ1bGVDb3VudCA9PT0gMCkge1xuXHRcdFx0cnVsZUdyaWRFbC5jcmVhdGVEaXYoe1xuXHRcdFx0XHRjbHM6IFwiYXV0by1mcm9udG1hdHRlci1ydWxlLWVtcHR5XCIsXG5cdFx0XHRcdHRleHQ6IFwi5pqC5peg6KeE5YiZXCIsXG5cdFx0XHR9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Zm9yIChsZXQgcGFnZUluZGV4ID0gMDsgcGFnZUluZGV4IDwgcGFnZVJ1bGVzLmxlbmd0aDsgcGFnZUluZGV4KyspIHtcblx0XHRcdFx0dGhpcy5yZW5kZXJSdWxlQ2FyZChydWxlR3JpZEVsLCBwYWdlUnVsZXNbcGFnZUluZGV4XSwgcGFnZVN0YXJ0ICsgcGFnZUluZGV4LCBmb2xkZXJzKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoaGFzTXVsdGlwbGVQYWdlcykge1xuXHRcdFx0dGhpcy5yZW5kZXJSdWxlUGFnZUJ1dHRvbih2aWV3cG9ydEVsLCBcInJpZ2h0XCIsIHRoaXMuY3VycmVudFJ1bGVQYWdlID09PSBwYWdlQ291bnQgLSAxLCAoKSA9PiB7XG5cdFx0XHRcdHRoaXMuY3VycmVudFJ1bGVQYWdlID0gTWF0aC5taW4ocGFnZUNvdW50IC0gMSwgdGhpcy5jdXJyZW50UnVsZVBhZ2UgKyAxKTtcblx0XHRcdFx0dGhpcy5kaXNwbGF5KCk7XG5cdFx0XHR9KTtcblxuXHRcdFx0Y29uc3QgZG90c0VsID0gY2Fyb3VzZWxFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1ydWxlLWRvdHNcIiB9KTtcblx0XHRcdGZvciAobGV0IHBhZ2UgPSAwOyBwYWdlIDwgcGFnZUNvdW50OyBwYWdlKyspIHtcblx0XHRcdFx0Y29uc3QgZG90RWwgPSBkb3RzRWwuY3JlYXRlRWwoXCJidXR0b25cIiwge1xuXHRcdFx0XHRcdGNsczogYGF1dG8tZnJvbnRtYXR0ZXItcnVsZS1kb3Qke3BhZ2UgPT09IHRoaXMuY3VycmVudFJ1bGVQYWdlID8gXCIgaXMtYWN0aXZlXCIgOiBcIlwifWAsXG5cdFx0XHRcdFx0YXR0cjogeyBcImFyaWEtbGFiZWxcIjogYOi3s+i9rOWIsOesrCAke3BhZ2UgKyAxfSDpobVgIH0sXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRkb3RFbC5vbmNsaWNrID0gKCkgPT4ge1xuXHRcdFx0XHRcdHRoaXMuY3VycmVudFJ1bGVQYWdlID0gcGFnZTtcblx0XHRcdFx0XHR0aGlzLmRpc3BsYXkoKTtcblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlclJ1bGVQYWdlQnV0dG9uKFxuXHRcdHJ1bGVDYXJvdXNlbFZpZXdwb3J0RWw6IEhUTUxFbGVtZW50LFxuXHRcdGRpcmVjdGlvbjogXCJsZWZ0XCIgfCBcInJpZ2h0XCIsXG5cdFx0ZGlzYWJsZWQ6IGJvb2xlYW4sXG5cdFx0b25DbGljazogKCkgPT4gdm9pZCxcblx0KSB7XG5cdFx0Y29uc3QgYnV0dG9uRWwgPSBydWxlQ2Fyb3VzZWxWaWV3cG9ydEVsLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcblx0XHRcdGNsczogYGF1dG8tZnJvbnRtYXR0ZXItcnVsZS1uYXYgaXMtJHtkaXJlY3Rpb259JHtkaXNhYmxlZCA/IFwiIGlzLWRpc2FibGVkXCIgOiBcIlwifWAsXG5cdFx0XHRhdHRyOiB7IFwiYXJpYS1sYWJlbFwiOiBkaXJlY3Rpb24gPT09IFwibGVmdFwiID8gXCLkuIrkuIDpobVcIiA6IFwi5LiL5LiA6aG1XCIgfSxcblx0XHR9KTtcblx0XHRzZXRJY29uKGJ1dHRvbkVsLCBkaXJlY3Rpb24gPT09IFwibGVmdFwiID8gXCJjaGV2cm9uLWxlZnRcIiA6IFwiY2hldnJvbi1yaWdodFwiKTtcblx0XHRidXR0b25FbC5kaXNhYmxlZCA9IGRpc2FibGVkO1xuXHRcdGJ1dHRvbkVsLm9uY2xpY2sgPSBvbkNsaWNrO1xuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJSdWxlQ2FyZChcblx0XHRydWxlR3JpZEVsOiBIVE1MRWxlbWVudCxcblx0XHRydWxlOiBGb2xkZXJEZWZhdWx0UnVsZSxcblx0XHRydWxlSW5kZXg6IG51bWJlcixcblx0XHRmb2xkZXJzOiBzdHJpbmdbXSxcblx0KSB7XG5cdFx0Y29uc3QgcnVsZUNhcmQgPSBydWxlR3JpZEVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLXJ1bGUtY2FyZFwiIH0pO1xuXHRcdGNvbnN0IHRvcFJvdyA9IHJ1bGVDYXJkLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLXJ1bGUtdG9wLXJvd1wiIH0pO1xuXHRcdHRvcFJvdy5jcmVhdGVTcGFuKHtcblx0XHRcdGNsczogXCJhdXRvLWZyb250bWF0dGVyLXJ1bGUtdGl0bGVcIixcblx0XHRcdHRleHQ6IGDop4TliJkgJHtydWxlSW5kZXggKyAxfWAsXG5cdFx0fSk7XG5cblx0XHRjb25zdCBkZWxldGVCdXR0b24gPSB0b3BSb3cuY3JlYXRlRWwoXCJidXR0b25cIiwge1xuXHRcdFx0Y2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItcnVsZS1kZWxldGVcIixcblx0XHRcdGF0dHI6IHsgXCJhcmlhLWxhYmVsXCI6IFwi5Yig6Zmk6KeE5YiZXCIgfSxcblx0XHR9KTtcblx0XHRzZXRJY29uKGRlbGV0ZUJ1dHRvbiwgXCJ0cmFzaC0yXCIpO1xuXHRcdGRlbGV0ZUJ1dHRvbi5vbmNsaWNrID0gYXN5bmMgKCkgPT4ge1xuXHRcdFx0aWYgKCF0aGlzLnBsdWdpbi5lbnN1cmVEZXZpY2VCb3VuZCgpKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLmZvbGRlckRlZmF1bHRzLnNwbGljZShydWxlSW5kZXgsIDEpO1xuXHRcdFx0YXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRjb25zdCBwYWdlQ291bnQgPSBNYXRoLm1heCgxLCBNYXRoLmNlaWwodGhpcy5wbHVnaW4uc2V0dGluZ3MuZm9sZGVyRGVmYXVsdHMubGVuZ3RoIC8gUlVMRVNfUEVSX1BBR0UpKTtcblx0XHRcdHRoaXMuY3VycmVudFJ1bGVQYWdlID0gY2xhbXAodGhpcy5jdXJyZW50UnVsZVBhZ2UsIDAsIHBhZ2VDb3VudCAtIDEpO1xuXHRcdFx0dGhpcy5kaXNwbGF5KCk7XG5cdFx0fTtcblxuXHRcdGNvbnN0IGZvbGRlclJvd0VsID0gcnVsZUNhcmQuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItcnVsZS1mb2xkZXItcm93XCIgfSk7XG5cdFx0Zm9sZGVyUm93RWwuY3JlYXRlU3Bhbih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLXJ1bGUtZm9sZGVyLWljb25cIiwgdGV4dDogXCLwn5OBXCIgfSk7XG5cdFx0dGhpcy5yZW5kZXJSdWxlSW5saW5lRm9sZGVyRWRpdG9yKGZvbGRlclJvd0VsLCBydWxlLCBmb2xkZXJzKTtcblxuXHRcdGNvbnN0IHZhbHVlUm93RWwgPSBydWxlQ2FyZC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1ydWxlLXZhbHVlLXJvd1wiIH0pO1xuXHRcdHRoaXMucmVuZGVyUnVsZUlubGluZUZpZWxkRWRpdG9yKHZhbHVlUm93RWwsIHJ1bGUpO1xuXHRcdHZhbHVlUm93RWwuY3JlYXRlU3Bhbih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLXJ1bGUtYXJyb3dcIiwgdGV4dDogXCLihpJcIiB9KTtcblx0XHR0aGlzLnJlbmRlclJ1bGVJbmxpbmVWYWx1ZUVkaXRvcih2YWx1ZVJvd0VsLCBydWxlKTtcblxuXHRcdGNvbnN0IGF1ZGl0RWwgPSBydWxlQ2FyZC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1ydWxlLWF1ZGl0XCIgfSk7XG5cdFx0aWYgKCFydWxlLmNyZWF0ZWRCeSB8fCAhcnVsZS5jcmVhdGVkQXQpIHtcblx0XHRcdGF1ZGl0RWwuc2V0VGV4dChcIuWIm+W7uuS/oeaBr+S4jeWPr+i/vea6r1wiKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0YXVkaXRFbC5jcmVhdGVEaXYoeyB0ZXh0OiBg55SxICR7cnVsZS5jcmVhdGVkQnl9YCB9KTtcblx0XHRcdGF1ZGl0RWwuY3JlYXRlRGl2KHsgdGV4dDogZm9ybWF0QXVkaXRUaW1lKHJ1bGUuY3JlYXRlZEF0KSB9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlclJ1bGVJbmxpbmVGb2xkZXJFZGl0b3IoXG5cdFx0Y29udGFpbmVyRWw6IEhUTUxFbGVtZW50LFxuXHRcdHJ1bGU6IEZvbGRlckRlZmF1bHRSdWxlLFxuXHRcdGZvbGRlcnM6IHN0cmluZ1tdLFxuXHQpIHtcblx0XHR0aGlzLmNyZWF0ZUlubGluZVJ1bGVWYXJpYWJsZShjb250YWluZXJFbCwgZm9ybWF0UnVsZUlubGluZVZhbHVlKHJ1bGUuZm9sZGVyKSwgKHNwYW5FbCkgPT4ge1xuXHRcdFx0dGhpcy5vcGVuSW5saW5lUnVsZVNlbGVjdEVkaXRvcihcblx0XHRcdFx0c3BhbkVsLFxuXHRcdFx0XHRydWxlLFxuXHRcdFx0XHRydWxlLmZvbGRlcixcblx0XHRcdFx0Zm9sZGVycy5tYXAoKGZvbGRlcikgPT4gKHtcblx0XHRcdFx0XHR2YWx1ZTogZm9sZGVyLFxuXHRcdFx0XHRcdGxhYmVsOiBmb3JtYXRGb2xkZXJPcHRpb25MYWJlbChmb2xkZXIpLFxuXHRcdFx0XHR9KSksXG5cdFx0XHRcdGFzeW5jICh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdHJ1bGUuZm9sZGVyID0gdmFsdWU7XG5cdFx0XHRcdH0sXG5cdFx0XHQpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJSdWxlSW5saW5lRmllbGRFZGl0b3IoY29udGFpbmVyRWw6IEhUTUxFbGVtZW50LCBydWxlOiBGb2xkZXJEZWZhdWx0UnVsZSkge1xuXHRcdHRoaXMuY3JlYXRlSW5saW5lUnVsZVZhcmlhYmxlKGNvbnRhaW5lckVsLCBmb3JtYXRSdWxlSW5saW5lVmFsdWUocnVsZS5maWVsZCksIChzcGFuRWwpID0+IHtcblx0XHRcdHRoaXMub3BlbklubGluZVJ1bGVTZWxlY3RFZGl0b3IoXG5cdFx0XHRcdHNwYW5FbCxcblx0XHRcdFx0cnVsZSxcblx0XHRcdFx0cnVsZS5maWVsZCxcblx0XHRcdFx0Rk9MREVSX0RFRkFVTFRfRklFTERTLm1hcCgoZmllbGQpID0+ICh7IHZhbHVlOiBmaWVsZCwgbGFiZWw6IGZpZWxkIH0pKSxcblx0XHRcdFx0YXN5bmMgKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0cnVsZS5maWVsZCA9IHZhbHVlIGFzIEZvbGRlckRlZmF1bHRGaWVsZDtcblx0XHRcdFx0XHRydWxlLnZhbHVlID0gXCJcIjtcblx0XHRcdFx0fSxcblx0XHRcdCk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlclJ1bGVJbmxpbmVWYWx1ZUVkaXRvcihjb250YWluZXJFbDogSFRNTEVsZW1lbnQsIHJ1bGU6IEZvbGRlckRlZmF1bHRSdWxlKSB7XG5cdFx0dGhpcy5jcmVhdGVJbmxpbmVSdWxlVmFyaWFibGUoY29udGFpbmVyRWwsIGZvcm1hdFJ1bGVJbmxpbmVWYWx1ZShydWxlLnZhbHVlKSwgKHNwYW5FbCkgPT4ge1xuXHRcdFx0Y29uc3QgY2FuZGlkYXRlcyA9IGdldEZyb250bWF0dGVyRmllbGRDYW5kaWRhdGVzKHRoaXMuYXBwLCBydWxlLmZpZWxkKTtcblx0XHRcdGNvbnN0IHZhbHVlcyA9XG5cdFx0XHRcdHJ1bGUudmFsdWUgJiYgIWNhbmRpZGF0ZXMuaW5jbHVkZXMocnVsZS52YWx1ZSkgPyBbLi4uY2FuZGlkYXRlcywgcnVsZS52YWx1ZV0gOiBjYW5kaWRhdGVzO1xuXHRcdFx0dGhpcy5vcGVuSW5saW5lUnVsZVNlbGVjdEVkaXRvcihcblx0XHRcdFx0c3BhbkVsLFxuXHRcdFx0XHRydWxlLFxuXHRcdFx0XHRydWxlLnZhbHVlLFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0Li4udmFsdWVzLm1hcCgodmFsdWUpID0+ICh7IHZhbHVlLCBsYWJlbDogdmFsdWUgfSkpLFxuXHRcdFx0XHRcdHsgdmFsdWU6IFwiX19uZXdfX1wiLCBsYWJlbDogXCLoh6rlrprkuYlcIiB9LFxuXHRcdFx0XHRdLFxuXHRcdFx0XHRhc3luYyAodmFsdWUpID0+IHtcblx0XHRcdFx0XHRpZiAodmFsdWUgPT09IFwiX19uZXdfX1wiKSB7XG5cdFx0XHRcdFx0XHR0aGlzLm9wZW5JbmxpbmVSdWxlSW5wdXRFZGl0b3Ioc3BhbkVsLCBydWxlLCBydWxlLnZhbHVlLCBhc3luYyAobmV4dFZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0XHRcdHJ1bGUudmFsdWUgPSBuZXh0VmFsdWU7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdHJldHVybiBcImRlZmVyXCI7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJ1bGUudmFsdWUgPSB2YWx1ZTtcblx0XHRcdFx0fSxcblx0XHRcdCk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZUlubGluZVJ1bGVWYXJpYWJsZShcblx0XHRjb250YWluZXJFbDogSFRNTEVsZW1lbnQsXG5cdFx0dGV4dDogc3RyaW5nLFxuXHRcdG9uQ2xpY2s6IChzcGFuRWw6IEhUTUxTcGFuRWxlbWVudCkgPT4gdm9pZCxcblx0KSB7XG5cdFx0Y29uc3Qgc3BhbkVsID0gY29udGFpbmVyRWwuY3JlYXRlRWwoXCJzcGFuXCIsIHtcblx0XHRcdGNsczogXCJhdXRvLWZyb250bWF0dGVyLXJ1bGUtaW5saW5lLXZhbHVlXCIsXG5cdFx0XHR0ZXh0LFxuXHRcdH0pO1xuXHRcdHNwYW5FbC50YWJJbmRleCA9IDA7XG5cdFx0c3BhbkVsLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZXZlbnQpID0+IHtcblx0XHRcdGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0b25DbGljayhzcGFuRWwpO1xuXHRcdH0pO1xuXHRcdHNwYW5FbC5hZGRFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCAoZXZlbnQpID0+IHtcblx0XHRcdGlmIChldmVudC5rZXkgPT09IFwiRW50ZXJcIiB8fCBldmVudC5rZXkgPT09IFwiIFwiKSB7XG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdG9uQ2xpY2soc3BhbkVsKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgb3BlbklubGluZVJ1bGVTZWxlY3RFZGl0b3IoXG5cdFx0Y29udGFpbmVyRWw6IEhUTUxFbGVtZW50LFxuXHRcdHJ1bGU6IEZvbGRlckRlZmF1bHRSdWxlLFxuXHRcdGN1cnJlbnRWYWx1ZTogc3RyaW5nLFxuXHRcdG9wdGlvbnM6IEFycmF5PHsgdmFsdWU6IHN0cmluZzsgbGFiZWw6IHN0cmluZyB9Pixcblx0XHRvbkNvbW1pdDogKHZhbHVlOiBzdHJpbmcpID0+IFByb21pc2U8dm9pZCB8IFwiZGVmZXJcIj4sXG5cdCkge1xuXHRcdHRoaXMuY2xvc2VBY3RpdmVJbmxpbmVFZGl0b3IoKTtcblx0XHRjb25zdCBvdmVybGF5RWwgPSBjb250YWluZXJFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1ydWxlLWlubGluZS1lZGl0b3JcIiB9KTtcblx0XHRjb25zdCBzZWxlY3RFbCA9IG92ZXJsYXlFbC5jcmVhdGVFbChcInNlbGVjdFwiLCB7XG5cdFx0XHRjbHM6IFwiZHJvcGRvd24gYXV0by1mcm9udG1hdHRlci1ydWxlLWlubGluZS1zZWxlY3RcIixcblx0XHR9KTtcblx0XHRmb3IgKGNvbnN0IG9wdGlvbiBvZiBvcHRpb25zKSB7XG5cdFx0XHRjb25zdCBvcHRpb25FbCA9IHNlbGVjdEVsLmNyZWF0ZUVsKFwib3B0aW9uXCIsIHtcblx0XHRcdFx0dmFsdWU6IG9wdGlvbi52YWx1ZSxcblx0XHRcdFx0dGV4dDogb3B0aW9uLmxhYmVsLFxuXHRcdFx0fSk7XG5cdFx0XHRpZiAob3B0aW9uLnZhbHVlID09PSBcIl9fbmV3X19cIikge1xuXHRcdFx0XHRvcHRpb25FbC5zZWxlY3RlZCA9IGN1cnJlbnRWYWx1ZS5sZW5ndGggPT09IDA7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmIChjdXJyZW50VmFsdWUgJiYgb3B0aW9ucy5zb21lKChvcHRpb24pID0+IG9wdGlvbi52YWx1ZSA9PT0gY3VycmVudFZhbHVlKSkge1xuXHRcdFx0c2VsZWN0RWwudmFsdWUgPSBjdXJyZW50VmFsdWU7XG5cdFx0fVxuXG5cdFx0Y29uc3QgY2xvc2VEcm9wZG93biA9IHRoaXMuY3JlYXRlSW5saW5lRHJvcGRvd25DbG9zZXIob3ZlcmxheUVsKTtcblxuXHRcdHNlbGVjdEVsLmFkZEV2ZW50TGlzdGVuZXIoXCJjaGFuZ2VcIiwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3Qgc2VsZWN0ZWRWYWx1ZSA9IHNlbGVjdEVsLnZhbHVlO1xuXHRcdFx0Y2xvc2VEcm9wZG93bigpO1xuXHRcdFx0aWYgKHNlbGVjdGVkVmFsdWUgPT09IFwiX19uZXdfX1wiKSB7XG5cdFx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IG9uQ29tbWl0KHNlbGVjdGVkVmFsdWUpO1xuXHRcdFx0XHRpZiAocmVzdWx0ICE9PSBcImRlZmVyXCIpIHtcblx0XHRcdFx0XHRjbG9zZURyb3Bkb3duKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0YXdhaXQgdGhpcy5zYXZlSW5saW5lUnVsZUNoYW5nZShydWxlLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGF3YWl0IG9uQ29tbWl0KHNlbGVjdGVkVmFsdWUpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdFx0c2VsZWN0RWwuYWRkRXZlbnRMaXN0ZW5lcihcImJsdXJcIiwgKCkgPT4ge1xuXHRcdFx0d2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHRjbG9zZURyb3Bkb3duKCk7XG5cdFx0XHR9LCAxMDApO1xuXHRcdH0pO1xuXG5cdFx0d2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0c2VsZWN0RWwuZm9jdXMoKTtcblx0XHRcdGNvbnN0IHBpY2tlckVsID0gc2VsZWN0RWwgYXMgSFRNTFNlbGVjdEVsZW1lbnQgJiB7IHNob3dQaWNrZXI/OiAoKSA9PiB2b2lkIH07XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRpZiAocGlja2VyRWwuc2hvd1BpY2tlcikge1xuXHRcdFx0XHRcdHBpY2tlckVsLnNob3dQaWNrZXIoKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRzZWxlY3RFbC5jbGljaygpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGNhdGNoIChfZXJyb3IpIHtcblx0XHRcdFx0c2VsZWN0RWwuY2xpY2soKTtcblx0XHRcdH1cblx0XHR9LCAwKTtcblx0fVxuXG5cdHByaXZhdGUgb3BlbklubGluZVJ1bGVJbnB1dEVkaXRvcihcblx0XHRjb250YWluZXJFbDogSFRNTEVsZW1lbnQsXG5cdFx0cnVsZTogRm9sZGVyRGVmYXVsdFJ1bGUsXG5cdFx0Y3VycmVudFZhbHVlOiBzdHJpbmcsXG5cdFx0b25Db21taXQ6ICh2YWx1ZTogc3RyaW5nKSA9PiBQcm9taXNlPHZvaWQ+LFxuXHQpIHtcblx0XHR0aGlzLmNsb3NlQWN0aXZlSW5saW5lRWRpdG9yKCk7XG5cdFx0Y29uc3Qgb3ZlcmxheUVsID0gY29udGFpbmVyRWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItcnVsZS1pbmxpbmUtZWRpdG9yXCIgfSk7XG5cdFx0Y29uc3QgaW5wdXRFbCA9IG92ZXJsYXlFbC5jcmVhdGVFbChcImlucHV0XCIsIHtcblx0XHRcdGNsczogXCJhdXRvLWZyb250bWF0dGVyLXJ1bGUtaW5saW5lLWlucHV0XCIsXG5cdFx0XHR0eXBlOiBcInRleHRcIixcblx0XHRcdHZhbHVlOiBjdXJyZW50VmFsdWUsXG5cdFx0fSk7XG5cblx0XHRjb25zdCBjbG9zZURyb3Bkb3duID0gdGhpcy5jcmVhdGVJbmxpbmVEcm9wZG93bkNsb3NlcihvdmVybGF5RWwpO1xuXHRcdGNvbnN0IGZpbmFsaXplID0gYXN5bmMgKCkgPT4ge1xuXHRcdFx0aWYgKGNsb3NlRHJvcGRvd24oKSkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLnNhdmVJbmxpbmVSdWxlQ2hhbmdlKHJ1bGUsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRhd2FpdCBvbkNvbW1pdChpbnB1dEVsLnZhbHVlKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGlucHV0RWwuYWRkRXZlbnRMaXN0ZW5lcihcImJsdXJcIiwgKCkgPT4ge1xuXHRcdFx0d2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHR2b2lkIGNsb3NlRHJvcGRvd24oKTtcblx0XHRcdH0sIDEwMCk7XG5cdFx0fSk7XG5cdFx0aW5wdXRFbC5hZGRFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCAoZXZlbnQpID0+IHtcblx0XHRcdGlmIChldmVudC5rZXkgPT09IFwiRW50ZXJcIikge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHR2b2lkIGZpbmFsaXplKCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoZXZlbnQua2V5ID09PSBcIkVzY2FwZVwiKSB7XG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdGNsb3NlRHJvcGRvd24oKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdGlucHV0RWwuZm9jdXMoKTtcblx0XHRcdGlucHV0RWwuc2VsZWN0KCk7XG5cdFx0fSwgMCk7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZUlubGluZURyb3Bkb3duQ2xvc2VyKG92ZXJsYXlFbDogSFRNTEVsZW1lbnQpIHtcblx0XHRsZXQgY2xvc2VkID0gZmFsc2U7XG5cdFx0Y29uc3QgY2xvc2VEcm9wZG93biA9ICgpID0+IHtcblx0XHRcdGlmIChjbG9zZWQpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0Y2xvc2VkID0gdHJ1ZTtcblx0XHRcdG92ZXJsYXlFbC5xdWVyeVNlbGVjdG9yQWxsKFwic2VsZWN0LCBpbnB1dFwiKS5mb3JFYWNoKChlbCkgPT4gZWwucmVtb3ZlKCkpO1xuXHRcdFx0aWYgKG92ZXJsYXlFbC5pc0Nvbm5lY3RlZCkge1xuXHRcdFx0XHRvdmVybGF5RWwucmVtb3ZlKCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAodGhpcy5hY3RpdmVJbmxpbmVFZGl0b3JDbGVhbnVwID09PSBjbG9zZURyb3Bkb3duKSB7XG5cdFx0XHRcdHRoaXMuYWN0aXZlSW5saW5lRWRpdG9yQ2xlYW51cCA9IG51bGw7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9O1xuXHRcdHRoaXMuYWN0aXZlSW5saW5lRWRpdG9yQ2xlYW51cCA9IGNsb3NlRHJvcGRvd247XG5cdFx0cmV0dXJuIGNsb3NlRHJvcGRvd247XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHNhdmVJbmxpbmVSdWxlQ2hhbmdlKHJ1bGU6IEZvbGRlckRlZmF1bHRSdWxlLCB1cGRhdGU6ICgpID0+IFByb21pc2U8dm9pZD4pIHtcblx0XHRpZiAoIXRoaXMucGx1Z2luLmVuc3VyZURldmljZUJvdW5kKCkpIHtcblx0XHRcdHRoaXMuZGlzcGxheSgpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRhd2FpdCB1cGRhdGUoKTtcblx0XHR0aGlzLnBsdWdpbi50b3VjaEZvbGRlclJ1bGUocnVsZSk7XG5cdFx0YXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0dGhpcy5kaXNwbGF5KCk7XG5cdH1cblxuXHRwcml2YXRlIGNsb3NlQWN0aXZlSW5saW5lRWRpdG9yKCkge1xuXHRcdHRoaXMuYWN0aXZlSW5saW5lRWRpdG9yQ2xlYW51cD8uKCk7XG5cdFx0dGhpcy5hY3RpdmVJbmxpbmVFZGl0b3JDbGVhbnVwID0gbnVsbDtcblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyVW5tYXRjaGVkRm9sZGVyU2VjdGlvbihjb250YWluZXJFbDogSFRNTEVsZW1lbnQpIHtcblx0XHRjb25zdCBzZWN0aW9uRWwgPSBjb250YWluZXJFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci11bm1hdGNoZWQtc2VjdGlvblwiIH0pO1xuXHRcdGNvbnN0IGhlYWRlckVsID0gc2VjdGlvbkVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLXVubWF0Y2hlZC1oZWFkZXJcIiB9KTtcblx0XHRoZWFkZXJFbC5jcmVhdGVFbChcImgzXCIsIHsgdGV4dDogXCLml6DljLnphY3op4TliJnnmoTmlofku7blpLlcIiB9KTtcblx0XHRjb25zdCBhY3Rpb25FbCA9IGhlYWRlckVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLXVubWF0Y2hlZC1hY3Rpb25cIiB9KTtcblx0XHRuZXcgU2V0dGluZyhhY3Rpb25FbCkuYWRkQnV0dG9uKChidXR0b24pID0+IHtcblx0XHRcdGJ1dHRvblxuXHRcdFx0XHQuc2V0QnV0dG9uVGV4dCh0aGlzLmlzU2Nhbm5pbmdVbm1hdGNoZWRGb2xkZXJzID8gXCLmiavmj4/kuK0uLi5cIiA6IFwi5omr5o+PXCIpXG5cdFx0XHRcdC5zZXREaXNhYmxlZCh0aGlzLmlzU2Nhbm5pbmdVbm1hdGNoZWRGb2xkZXJzKVxuXHRcdFx0XHQub25DbGljayhhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5zY2FuVW5tYXRjaGVkRm9sZGVycygpO1xuXHRcdFx0XHR9KTtcblx0XHR9KTtcblx0XHRzZWN0aW9uRWwuY3JlYXRlRWwoXCJwXCIsIHtcblx0XHRcdGNsczogXCJhdXRvLWZyb250bWF0dGVyLXVubWF0Y2hlZC1zdWJ0aXRsZVwiLFxuXHRcdFx0dGV4dDogXCLku6XkuIvmlofku7blpLnlsJrmnKrorr7nva7ku7vkvZXlsZ7mgKfljLnphY3op4TliJnjgIJcIixcblx0XHR9KTtcblxuXHRcdGNvbnN0IHJlc3VsdEVsID0gc2VjdGlvbkVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLXVubWF0Y2hlZC1yZXN1bHRzXCIgfSk7XG5cdFx0aWYgKCF0aGlzLmhhc1NjYW5uZWRVbm1hdGNoZWRGb2xkZXJzKSB7XG5cdFx0XHRyZXN1bHRFbC5jcmVhdGVEaXYoe1xuXHRcdFx0XHRjbHM6IFwiYXV0by1mcm9udG1hdHRlci11bm1hdGNoZWQtZW1wdHlcIixcblx0XHRcdFx0dGV4dDogXCLngrnlh7vmiavmj4/mn6XnnIvmnKrphY3nva7nmoTmlofku7blpLnjgIJcIixcblx0XHRcdH0pO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLnVubWF0Y2hlZEZvbGRlcnMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXN1bHRFbC5jcmVhdGVEaXYoe1xuXHRcdFx0XHRjbHM6IFwiYXV0by1mcm9udG1hdHRlci11bm1hdGNoZWQtZW1wdHlcIixcblx0XHRcdFx0dGV4dDogXCLmiYDmnInmlofku7blpLnlnYflt7LphY3nva7op4TliJnjgIJcIixcblx0XHRcdH0pO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGxpc3RFbCA9IHJlc3VsdEVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLXVubWF0Y2hlZC1saXN0XCIgfSk7XG5cdFx0Zm9yIChjb25zdCBmb2xkZXIgb2YgdGhpcy51bm1hdGNoZWRGb2xkZXJzKSB7XG5cdFx0XHRjb25zdCBpdGVtRWwgPSBsaXN0RWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItdW5tYXRjaGVkLWl0ZW1cIiB9KTtcblx0XHRcdGNvbnN0IGNvbnRlbnRFbCA9IGl0ZW1FbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci11bm1hdGNoZWQtY29udGVudFwiIH0pO1xuXHRcdFx0Y29udGVudEVsLmNyZWF0ZURpdih7XG5cdFx0XHRcdGNsczogXCJhdXRvLWZyb250bWF0dGVyLXVubWF0Y2hlZC1wYXRoXCIsXG5cdFx0XHRcdHRleHQ6IGZvbGRlci5wYXRoLFxuXHRcdFx0fSk7XG5cdFx0XHRjb250ZW50RWwuY3JlYXRlRGl2KHtcblx0XHRcdFx0Y2xzOiBmb2xkZXIuaW5oZXJpdGVkUnVsZXMubGVuZ3RoXG5cdFx0XHRcdFx0PyBcImF1dG8tZnJvbnRtYXR0ZXItdW5tYXRjaGVkLWhpbnQgaXMtaW5oZXJpdGVkXCJcblx0XHRcdFx0XHQ6IFwiYXV0by1mcm9udG1hdHRlci11bm1hdGNoZWQtaGludCBpcy1lbXB0eVwiLFxuXHRcdFx0XHR0ZXh0OlxuXHRcdFx0XHRcdGZvbGRlci5pbmhlcml0ZWRSdWxlcy5sZW5ndGggPiAwXG5cdFx0XHRcdFx0XHQ/IGDihpEg54i257qn6KeE5YiZ77yaJHtmb2xkZXIuaW5oZXJpdGVkUnVsZXNcblx0XHRcdFx0XHRcdFx0XHQubWFwKChydWxlKSA9PiBgJHtydWxlLmZvbGRlcn0g4oaSICR7cnVsZS5maWVsZH06ICR7cnVsZS52YWx1ZX1gKVxuXHRcdFx0XHRcdFx0XHRcdC5qb2luKFwi77yMXCIpfWBcblx0XHRcdFx0XHRcdDogXCLml6Dku7vkvZXniLbnuqfop4TliJlcIixcblx0XHRcdH0pO1xuXG5cdFx0XHRjb25zdCBidXR0b25FbCA9IGl0ZW1FbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci11bm1hdGNoZWQtYnV0dG9uXCIgfSk7XG5cdFx0XHRuZXcgU2V0dGluZyhidXR0b25FbCkuYWRkQnV0dG9uKChidXR0b24pID0+IHtcblx0XHRcdFx0YnV0dG9uLnNldEJ1dHRvblRleHQoXCLorr7nva5cIikub25DbGljaygoKSA9PiB7XG5cdFx0XHRcdFx0bmV3IEZvbGRlclJ1bGVNb2RhbCh0aGlzLmFwcCwgdGhpcy5wbHVnaW4sIGZvbGRlci5wYXRoKS5vcGVuKCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJTY2FuU2VjdGlvbihjb250YWluZXJFbDogSFRNTEVsZW1lbnQpIHtcblx0XHRjb250YWluZXJFbC5jcmVhdGVFbChcImgyXCIsIHsgdGV4dDogXCLmiavmj4/ku5PlupNcIiB9KTtcblxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LnNldE5hbWUoXCLmiavmj4/ku5PlupNcIilcblx0XHRcdC5zZXREZXNjKFwi5om+5Ye66ZyA6KaB6KGl5YWo5bGe5oCn55qEIE1hcmtkb3duIOaWh+S7tuOAglwiKVxuXHRcdFx0LmFkZEJ1dHRvbigoYnV0dG9uKSA9PiB7XG5cdFx0XHRcdGJ1dHRvblxuXHRcdFx0XHRcdC5zZXRCdXR0b25UZXh0KHRoaXMuaXNTY2FubmluZyA/IFwi5omr5o+P5LitLi4uXCIgOiBcIuaJq+aPj1wiKVxuXHRcdFx0XHRcdC5zZXREaXNhYmxlZCh0aGlzLmlzU2Nhbm5pbmcgfHwgdGhpcy5pc0V4ZWN1dGluZylcblx0XHRcdFx0XHQub25DbGljayhhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0XHRpZiAoIXRoaXMucGx1Z2luLmVuc3VyZURldmljZUJvdW5kKCkpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5zY2FuVmF1bHQoKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXG5cdFx0aWYgKCF0aGlzLmhhc1NjYW5uZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCByZXN1bHRFbCA9IGNvbnRhaW5lckVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLXNjYW4tcmVzdWx0c1wiIH0pO1xuXHRcdGlmICh0aGlzLnNjYW5SZXN1bHRzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmVzdWx0RWwuY3JlYXRlRGl2KHtcblx0XHRcdFx0Y2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItc2Nhbi1lbXB0eVwiLFxuXHRcdFx0XHR0ZXh0OiBcIuaJgOacieaWh+S7tuWdh+W3suWMheWQq+WxnuaApyDinJNcIixcblx0XHRcdH0pO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHJlc3VsdEVsLmNyZWF0ZURpdih7XG5cdFx0XHRjbHM6IFwiYXV0by1mcm9udG1hdHRlci1zY2FuLWNvdW50XCIsXG5cdFx0XHR0ZXh0OiBg5YWx5Y+R546wICR7dGhpcy5zY2FuUmVzdWx0cy5sZW5ndGh9IOS4quaWh+S7tumcgOimgeihpeWFqOWxnuaAp2AsXG5cdFx0fSk7XG5cblx0XHRjb25zdCBsaXN0RWwgPSByZXN1bHRFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1zY2FuLWxpc3RcIiB9KTtcblx0XHRmb3IgKGNvbnN0IHJlc3VsdCBvZiB0aGlzLnNjYW5SZXN1bHRzKSB7XG5cdFx0XHRjb25zdCBpdGVtRWwgPSBsaXN0RWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItc2Nhbi1pdGVtXCIgfSk7XG5cdFx0XHRjb25zdCB0aXRsZSA9IHJlc3VsdC5kb25lID8gYCR7cmVzdWx0LmZpbGUubmFtZX0g4pyTYCA6IHJlc3VsdC5maWxlLm5hbWU7XG5cdFx0XHRjb25zdCB0aXRsZUVsID0gaXRlbUVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLXNjYW4tbmFtZVwiLCB0ZXh0OiB0aXRsZSB9KTtcblx0XHRcdHRpdGxlRWwuY3JlYXRlU3Bhbih7XG5cdFx0XHRcdGNsczogXCJhdXRvLWZyb250bWF0dGVyLXNjYW4tbWlzc2luZ1wiLFxuXHRcdFx0XHR0ZXh0OiBgICR7Zm9ybWF0U2NhblJlYXNvbihyZXN1bHQpfWAsXG5cdFx0XHR9KTtcblx0XHRcdGl0ZW1FbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1zY2FuLXBhdGhcIiwgdGV4dDogcmVzdWx0LmZpbGUucGF0aCB9KTtcblx0XHR9XG5cblx0XHRjb25zdCBzdGF0dXNUZXh0ID1cblx0XHRcdHRoaXMucHJvY2Vzc2VkQ291bnQgPT09IHRoaXMuc2NhblJlc3VsdHMubGVuZ3RoICYmICF0aGlzLmlzRXhlY3V0aW5nXG5cdFx0XHRcdD8gYOWujOaIkO+8jOW3suWkhOeQhiAke3RoaXMucHJvY2Vzc2VkQ291bnR9IOS4quaWh+S7tmBcblx0XHRcdFx0OiBcIlwiO1xuXG5cdFx0bmV3IFNldHRpbmcocmVzdWx0RWwpXG5cdFx0XHQuc2V0RGVzYyhzdGF0dXNUZXh0KVxuXHRcdFx0LmFkZEJ1dHRvbigoYnV0dG9uKSA9PiB7XG5cdFx0XHRcdGJ1dHRvblxuXHRcdFx0XHRcdC5zZXRCdXR0b25UZXh0KHRoaXMuaXNFeGVjdXRpbmcgPyBcIuaJp+ihjOS4rS4uLlwiIDogXCLmiafooYxcIilcblx0XHRcdFx0XHQuc2V0Q3RhKClcblx0XHRcdFx0XHQuc2V0RGlzYWJsZWQodGhpcy5pc0V4ZWN1dGluZylcblx0XHRcdFx0XHQub25DbGljayhhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0XHRpZiAoIXRoaXMucGx1Z2luLmVuc3VyZURldmljZUJvdW5kKCkpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5leGVjdXRlU2NhblJlc3VsdHMoKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBzY2FuVmF1bHQoKSB7XG5cdFx0dGhpcy5pc1NjYW5uaW5nID0gdHJ1ZTtcblx0XHR0aGlzLmhhc1NjYW5uZWQgPSB0cnVlO1xuXHRcdHRoaXMuc2NhblJlc3VsdHMgPSBbXTtcblx0XHR0aGlzLnByb2Nlc3NlZENvdW50ID0gMDtcblx0XHR0aGlzLmRpc3BsYXkoKTtcblxuXHRcdGNvbnN0IHJlc3VsdHM6IFNjYW5SZXN1bHRbXSA9IFtdO1xuXHRcdGNvbnN0IGZpbGVzID0gdGhpcy5hcHAudmF1bHQuZ2V0TWFya2Rvd25GaWxlcygpO1xuXG5cdFx0Zm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IGZpbGVzLmxlbmd0aDsgaW5kZXgrKykge1xuXHRcdFx0Y29uc3QgZmlsZSA9IGZpbGVzW2luZGV4XTtcblx0XHRcdGNvbnN0IGNvbnRlbnQgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5jYWNoZWRSZWFkKGZpbGUpO1xuXHRcdFx0Y29uc3QgZGVmYXVsdHMgPSB0aGlzLnBsdWdpbi5nZXRGb2xkZXJEZWZhdWx0VmFsdWVzKGZpbGUpO1xuXHRcdFx0Y29uc3Qgc3RhdHVzID0gZ2V0RnJvbnRtYXR0ZXJTdGF0dXMoY29udGVudCwgZGVmYXVsdHMpO1xuXHRcdFx0aWYgKFxuXHRcdFx0XHRzdGF0dXMubWlzc2luZ0ZpZWxkcy5sZW5ndGggPiAwIHx8XG5cdFx0XHRcdHN0YXR1cy5vcmRlck5lZWRzRml4IHx8XG5cdFx0XHRcdHN0YXR1cy5yZW5hbWVGaWVsZHMubGVuZ3RoID4gMCB8fFxuXHRcdFx0XHRzdGF0dXMuZGVmYXVsdEZpZWxkcy5sZW5ndGggPiAwXG5cdFx0XHQpIHtcblx0XHRcdFx0cmVzdWx0cy5wdXNoKHtcblx0XHRcdFx0XHRmaWxlLFxuXHRcdFx0XHRcdG1pc3NpbmdGaWVsZHM6IHN0YXR1cy5taXNzaW5nRmllbGRzLFxuXHRcdFx0XHRcdG9yZGVyTmVlZHNGaXg6IHN0YXR1cy5vcmRlck5lZWRzRml4LFxuXHRcdFx0XHRcdHJlbmFtZUZpZWxkczogc3RhdHVzLnJlbmFtZUZpZWxkcyxcblx0XHRcdFx0XHRkZWZhdWx0RmllbGRzOiBzdGF0dXMuZGVmYXVsdEZpZWxkcyxcblx0XHRcdFx0XHRkb25lOiBmYWxzZSxcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChpbmRleCAlIDI1ID09PSAyNCkge1xuXHRcdFx0XHRhd2FpdCB5aWVsZFRvVWkoKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLnNjYW5SZXN1bHRzID0gcmVzdWx0cztcblx0XHR0aGlzLmlzU2Nhbm5pbmcgPSBmYWxzZTtcblx0XHR0aGlzLmRpc3BsYXkoKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgc2NhblVubWF0Y2hlZEZvbGRlcnMoKSB7XG5cdFx0dGhpcy5oYXNTY2FubmVkVW5tYXRjaGVkRm9sZGVycyA9IHRydWU7XG5cdFx0dGhpcy5pc1NjYW5uaW5nVW5tYXRjaGVkRm9sZGVycyA9IHRydWU7XG5cdFx0dGhpcy51bm1hdGNoZWRGb2xkZXJzID0gW107XG5cdFx0dGhpcy5kaXNwbGF5KCk7XG5cblx0XHRjb25zdCBmb2xkZXJzID0gZ2V0VmF1bHRGb2xkZXJzKHRoaXMuYXBwKS5maWx0ZXIoKGZvbGRlcikgPT4gc2hvdWxkSW5jbHVkZVJ1bGVGb2xkZXIoZm9sZGVyKSk7XG5cdFx0Y29uc3QgZGlyZWN0UnVsZUZvbGRlcnMgPSBuZXcgU2V0KFxuXHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MuZm9sZGVyRGVmYXVsdHNcblx0XHRcdFx0Lm1hcCgocnVsZSkgPT4gcnVsZS5mb2xkZXIpXG5cdFx0XHRcdC5maWx0ZXIoKGZvbGRlcikgPT4gc2hvdWxkSW5jbHVkZVJ1bGVGb2xkZXIoZm9sZGVyKSksXG5cdFx0KTtcblxuXHRcdHRoaXMudW5tYXRjaGVkRm9sZGVycyA9IGZvbGRlcnNcblx0XHRcdC5maWx0ZXIoKGZvbGRlcikgPT4gIWRpcmVjdFJ1bGVGb2xkZXJzLmhhcyhmb2xkZXIpKVxuXHRcdFx0Lm1hcCgoZm9sZGVyKSA9PiAoe1xuXHRcdFx0XHRwYXRoOiBmb2xkZXIsXG5cdFx0XHRcdGluaGVyaXRlZFJ1bGVzOiBnZXRBbmNlc3RvclJ1bGVzKGZvbGRlciwgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZm9sZGVyRGVmYXVsdHMpLFxuXHRcdFx0fSkpXG5cdFx0XHQuc29ydCgoYSwgYikgPT4gYS5wYXRoLmxvY2FsZUNvbXBhcmUoYi5wYXRoKSk7XG5cblx0XHR0aGlzLmlzU2Nhbm5pbmdVbm1hdGNoZWRGb2xkZXJzID0gZmFsc2U7XG5cdFx0dGhpcy5kaXNwbGF5KCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGV4ZWN1dGVTY2FuUmVzdWx0cygpIHtcblx0XHR0aGlzLmlzRXhlY3V0aW5nID0gdHJ1ZTtcblx0XHR0aGlzLnByb2Nlc3NlZENvdW50ID0gMDtcblx0XHR0aGlzLmRpc3BsYXkoKTtcblxuXHRcdGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCB0aGlzLnNjYW5SZXN1bHRzLmxlbmd0aDsgaW5kZXgrKykge1xuXHRcdFx0Y29uc3QgcmVzdWx0ID0gdGhpcy5zY2FuUmVzdWx0c1tpbmRleF07XG5cdFx0XHRjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZChyZXN1bHQuZmlsZSk7XG5cdFx0XHRjb25zdCBkZWZhdWx0cyA9IHRoaXMucGx1Z2luLmdldEZvbGRlckRlZmF1bHRWYWx1ZXMocmVzdWx0LmZpbGUpO1xuXHRcdFx0Y29uc3Qgc3RhdHVzID0gZ2V0RnJvbnRtYXR0ZXJTdGF0dXMoY29udGVudCwgZGVmYXVsdHMpO1xuXHRcdFx0Y29uc3QgbmV4dCA9IGJ1aWxkQ29udGVudFdpdGhPcmRlcmVkRmllbGRzKFxuXHRcdFx0XHRjb250ZW50LFxuXHRcdFx0XHRyZXN1bHQuZmlsZSxcblx0XHRcdFx0c3RhdHVzLFxuXHRcdFx0XHRcIlwiLFxuXHRcdFx0XHRkZWZhdWx0cyxcblx0XHRcdFx0dGhpcy5wbHVnaW4uYnVpbGRGcm9udG1hdHRlci5iaW5kKHRoaXMucGx1Z2luKSxcblx0XHRcdCk7XG5cdFx0XHRpZiAobmV4dCAhPT0gbnVsbCkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLmFwcC52YXVsdC5tb2RpZnkocmVzdWx0LmZpbGUsIG5leHQpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXN1bHQubWlzc2luZ0ZpZWxkcyA9IHN0YXR1cy5taXNzaW5nRmllbGRzO1xuXHRcdFx0cmVzdWx0Lm9yZGVyTmVlZHNGaXggPSBzdGF0dXMub3JkZXJOZWVkc0ZpeDtcblx0XHRcdHJlc3VsdC5yZW5hbWVGaWVsZHMgPSBzdGF0dXMucmVuYW1lRmllbGRzO1xuXHRcdFx0cmVzdWx0LmRlZmF1bHRGaWVsZHMgPSBzdGF0dXMuZGVmYXVsdEZpZWxkcztcblx0XHRcdHJlc3VsdC5kb25lID0gdHJ1ZTtcblx0XHRcdHRoaXMucHJvY2Vzc2VkQ291bnQrKztcblxuXHRcdFx0aWYgKGluZGV4ICUgMTAgPT09IDkgfHwgaW5kZXggPT09IHRoaXMuc2NhblJlc3VsdHMubGVuZ3RoIC0gMSkge1xuXHRcdFx0XHR0aGlzLmRpc3BsYXkoKTtcblx0XHRcdFx0YXdhaXQgeWllbGRUb1VpKCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5pc0V4ZWN1dGluZyA9IGZhbHNlO1xuXHRcdHRoaXMuZGlzcGxheSgpO1xuXHR9XG59XG5cbmludGVyZmFjZSBTY2FuUmVzdWx0IHtcblx0ZmlsZTogVEZpbGU7XG5cdG1pc3NpbmdGaWVsZHM6IFJlcXVpcmVkRmllbGRbXTtcblx0b3JkZXJOZWVkc0ZpeDogYm9vbGVhbjtcblx0cmVuYW1lRmllbGRzOiBMZWdhY3lSZW5hbWVbXTtcblx0ZGVmYXVsdEZpZWxkczogRm9sZGVyRGVmYXVsdEZpZWxkW107XG5cdGRvbmU6IGJvb2xlYW47XG59XG5cbmludGVyZmFjZSBVbm1hdGNoZWRGb2xkZXJSZXN1bHQge1xuXHRwYXRoOiBzdHJpbmc7XG5cdGluaGVyaXRlZFJ1bGVzOiBGb2xkZXJEZWZhdWx0UnVsZVtdO1xufVxuXG5pbnRlcmZhY2UgQUlTdW1tYXJ5Q2FuZGlkYXRlIHtcblx0ZmlsZTogVEZpbGU7XG5cdGNvbnRlbnQ6IHN0cmluZztcblx0ZG9jdW1lbnQ6IFN1bW1hcnlEb2N1bWVudDtcblx0ZG9uZT86IGJvb2xlYW47XG59XG5cbmludGVyZmFjZSBBSVN1bW1hcnlUYXNrVWlTdGF0ZSB7XG5cdHJlc3VsdHM6IEFJU3VtbWFyeUNhbmRpZGF0ZVtdO1xuXHRoYXNTY2FubmVkOiBib29sZWFuO1xuXHRpc1NjYW5uaW5nOiBib29sZWFuO1xuXHRpc0V4ZWN1dGluZzogYm9vbGVhbjtcblx0cHJvY2Vzc2VkQ291bnQ6IG51bWJlcjtcbn1cblxuaW50ZXJmYWNlIENoYXRDb21wbGV0aW9uUmVzcG9uc2Uge1xuXHRlcnJvcj86IHtcblx0XHRtZXNzYWdlPzogc3RyaW5nO1xuXHR9O1xuXHRjaG9pY2VzPzogQXJyYXk8e1xuXHRcdFx0bWVzc2FnZT86IHtcblx0XHRcdFx0Y29udGVudD86IHN0cmluZztcblx0XHRcdFx0cmVhc29uaW5nX2NvbnRlbnQ/OiBzdHJpbmc7XG5cdFx0XHRcdHJlYXNvbmluZz86IHN0cmluZztcblx0XHRcdH07XG5cdFx0fT47XG5cdH1cblxuaW50ZXJmYWNlIEZyb250bWF0dGVyU3RhdHVzIHtcblx0bWlzc2luZ0ZpZWxkczogUmVxdWlyZWRGaWVsZFtdO1xuXHRvcmRlck5lZWRzRml4OiBib29sZWFuO1xuXHRyZW5hbWVGaWVsZHM6IExlZ2FjeVJlbmFtZVtdO1xuXHRkZWZhdWx0RmllbGRzOiBGb2xkZXJEZWZhdWx0RmllbGRbXTtcbn1cblxuaW50ZXJmYWNlIEZyb250bWF0dGVyQmxvY2sge1xuXHRrZXk6IHN0cmluZyB8IG51bGw7XG5cdGxpbmVzOiBzdHJpbmdbXTtcbn1cblxuaW50ZXJmYWNlIExlZ2FjeVJlbmFtZSB7XG5cdGZyb206IExlZ2FjeUZpZWxkO1xuXHR0bzogUmVxdWlyZWRGaWVsZDtcbn1cblxuZnVuY3Rpb24gaGFzRnJvbnRtYXR0ZXIoY29udGVudDogc3RyaW5nKTogYm9vbGVhbiB7XG5cdHJldHVybiBjb250ZW50LnN0YXJ0c1dpdGgoXCItLS1cIik7XG59XG5cbmZ1bmN0aW9uIGdldEZyb250bWF0dGVyU3RhdHVzKGNvbnRlbnQ6IHN0cmluZywgZGVmYXVsdHM6IEZvbGRlckRlZmF1bHRWYWx1ZXMgPSB7fSk6IEZyb250bWF0dGVyU3RhdHVzIHtcblx0Y29uc3QgZnJvbnRtYXR0ZXIgPSBwYXJzZUZyb250bWF0dGVyKGNvbnRlbnQpO1xuXHRpZiAoZnJvbnRtYXR0ZXIgPT09IG51bGwpIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0bWlzc2luZ0ZpZWxkczogWy4uLlJFUVVJUkVEX0ZJRUxEU10sXG5cdFx0XHRvcmRlck5lZWRzRml4OiBmYWxzZSxcblx0XHRcdHJlbmFtZUZpZWxkczogW10sXG5cdFx0XHRkZWZhdWx0RmllbGRzOiBbXSxcblx0XHR9O1xuXHR9XG5cblx0Y29uc3QgYmxvY2tzID0gcGFyc2VGcm9udG1hdHRlckJsb2Nrcyhmcm9udG1hdHRlci5ib2R5KTtcblx0Y29uc3QgcmVuYW1lRmllbGRzID0gZ2V0TGVnYWN5UmVuYW1lcyhibG9ja3MpO1xuXHRjb25zdCBtaWdyYXRlZEJsb2NrcyA9IG1pZ3JhdGVMZWdhY3lCbG9ja3MoYmxvY2tzKTtcblx0Y29uc3QgbWlzc2luZ0ZpZWxkcyA9IFJFUVVJUkVEX0ZJRUxEUy5maWx0ZXIoKGZpZWxkKSA9PiAhaGFzRnJvbnRtYXR0ZXJCbG9jayhtaWdyYXRlZEJsb2NrcywgZmllbGQpKTtcblx0Y29uc3QgZGVmYXVsdEZpZWxkcyA9IEZPTERFUl9ERUZBVUxUX0ZJRUxEUy5maWx0ZXIoKGZpZWxkKSA9PiB7XG5cdFx0cmV0dXJuIGRlZmF1bHRzW2ZpZWxkXSAhPT0gdW5kZWZpbmVkICYmIGZyb250bWF0dGVyRmllbGRJc0VtcHR5KG1pZ3JhdGVkQmxvY2tzLCBmaWVsZCk7XG5cdH0pO1xuXHRyZXR1cm4ge1xuXHRcdG1pc3NpbmdGaWVsZHMsXG5cdFx0b3JkZXJOZWVkc0ZpeDogIXJlcXVpcmVkRmllbGRzQXJlSW5SZWxhdGl2ZU9yZGVyKG1pZ3JhdGVkQmxvY2tzKSxcblx0XHRyZW5hbWVGaWVsZHMsXG5cdFx0ZGVmYXVsdEZpZWxkcyxcblx0fTtcbn1cblxuZnVuY3Rpb24gYnVpbGRDb250ZW50V2l0aE9yZGVyZWRGaWVsZHMoXG5cdGNvbnRlbnQ6IHN0cmluZyxcblx0ZmlsZTogVEZpbGUsXG5cdHN0YXR1czogRnJvbnRtYXR0ZXJTdGF0dXMsXG5cdGF1dGhvck5hbWU6IHN0cmluZyxcblx0ZGVmYXVsdHM6IEZvbGRlckRlZmF1bHRWYWx1ZXMsXG5cdGJ1aWxkRnVsbEZyb250bWF0dGVyOiAoY3JlYXRlZDogc3RyaW5nLCBkZWZhdWx0cz86IEZvbGRlckRlZmF1bHRWYWx1ZXMpID0+IHN0cmluZyxcbik6IHN0cmluZyB8IG51bGwge1xuXHRpZiAoXG5cdFx0c3RhdHVzLm1pc3NpbmdGaWVsZHMubGVuZ3RoID09PSAwICYmXG5cdFx0IXN0YXR1cy5vcmRlck5lZWRzRml4ICYmXG5cdFx0c3RhdHVzLnJlbmFtZUZpZWxkcy5sZW5ndGggPT09IDAgJiZcblx0XHRzdGF0dXMuZGVmYXVsdEZpZWxkcy5sZW5ndGggPT09IDBcblx0KSB7XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRjb25zdCBjcmVhdGVkID0gZm9ybWF0TG9jYWxEYXRlKG5ldyBEYXRlKGZpbGUuc3RhdC5jdGltZSkpO1xuXHRjb25zdCBmcm9udG1hdHRlciA9IHBhcnNlRnJvbnRtYXR0ZXIoY29udGVudCk7XG5cdGlmIChmcm9udG1hdHRlciA9PT0gbnVsbCkge1xuXHRcdHJldHVybiBidWlsZEZ1bGxGcm9udG1hdHRlcihjcmVhdGVkLCBkZWZhdWx0cykgKyBjb250ZW50O1xuXHR9XG5cblx0Y29uc3QgbWlncmF0ZWRCb2R5ID0gbWlncmF0ZUxlZ2FjeUZyb250bWF0dGVyQm9keShmcm9udG1hdHRlci5ib2R5KTtcblx0Y29uc3QgYm9keSA9IHN0YXR1cy5vcmRlck5lZWRzRml4XG5cdFx0PyBidWlsZFJlb3JkZXJlZEZyb250bWF0dGVyQm9keShtaWdyYXRlZEJvZHksIGNyZWF0ZWQsIGF1dGhvck5hbWUsIGRlZmF1bHRzKVxuXHRcdDogYnVpbGRGcm9udG1hdHRlckJvZHlXaXRoTWlzc2luZ0ZpZWxkcyhcblx0XHRcdFx0bWlncmF0ZWRCb2R5LFxuXHRcdFx0XHRzdGF0dXMubWlzc2luZ0ZpZWxkcyxcblx0XHRcdFx0c3RhdHVzLmRlZmF1bHRGaWVsZHMsXG5cdFx0XHRcdGNyZWF0ZWQsXG5cdFx0XHRcdGF1dGhvck5hbWUsXG5cdFx0XHRcdGRlZmF1bHRzLFxuXHRcdFx0KTtcblx0Y29uc3Qgc3VmZml4ID0gY29udGVudC5zbGljZShmcm9udG1hdHRlci5lbmQpO1xuXHRjb25zdCBzZXBhcmF0b3IgPSBzdWZmaXguc3RhcnRzV2l0aChcIlxcblwiKSA/IFwiXCIgOiBcIlxcblwiO1xuXHRyZXR1cm4gYC0tLVxcbiR7Ym9keX0ke3NlcGFyYXRvcn0ke3N1ZmZpeH1gO1xufVxuXG5mdW5jdGlvbiBidWlsZEZyb250bWF0dGVyQm9keVdpdGhNaXNzaW5nRmllbGRzKFxuXHRmcm9udG1hdHRlckJvZHk6IHN0cmluZyxcblx0bWlzc2luZ0ZpZWxkczogUmVxdWlyZWRGaWVsZFtdLFxuXHRkZWZhdWx0RmllbGRzOiBGb2xkZXJEZWZhdWx0RmllbGRbXSxcblx0ZmlsZUNyZWF0ZWQ6IHN0cmluZyxcblx0YXV0aG9yTmFtZTogc3RyaW5nLFxuXHRkZWZhdWx0czogRm9sZGVyRGVmYXVsdFZhbHVlcyxcbik6IHN0cmluZyB7XG5cdGNvbnN0IGJsb2NrcyA9IHBhcnNlRnJvbnRtYXR0ZXJCbG9ja3MoZnJvbnRtYXR0ZXJCb2R5KTtcblx0Y29uc3QgbGluZXM6IHN0cmluZ1tdID0gW107XG5cdGNvbnN0IGluc2VydGVkID0gbmV3IFNldDxSZXF1aXJlZEZpZWxkPigpO1xuXHRjb25zdCBjcmVhdGVkRm9yVXBkYXRlZCA9IGdldEV4aXN0aW5nQ3JlYXRlZFZhbHVlKGJsb2NrcykgPz8gZmlsZUNyZWF0ZWQ7XG5cblx0Zm9yIChjb25zdCBibG9jayBvZiBibG9ja3MpIHtcblx0XHRpZiAoaXNSZXF1aXJlZEZpZWxkKGJsb2NrLmtleSkpIHtcblx0XHRcdGZvciAoY29uc3QgZmllbGQgb2YgbWlzc2luZ0ZpZWxkcykge1xuXHRcdFx0XHRpZiAoIWluc2VydGVkLmhhcyhmaWVsZCkgJiYgZ2V0UmVxdWlyZWRGaWVsZEluZGV4KGZpZWxkKSA8IGdldFJlcXVpcmVkRmllbGRJbmRleChibG9jay5rZXkpKSB7XG5cdFx0XHRcdFx0Y29uc3QgY3JlYXRlZCA9IGZpZWxkID09PSBcIuacgOWQjuabtOaWsFwiID8gY3JlYXRlZEZvclVwZGF0ZWQgOiBmaWxlQ3JlYXRlZDtcblx0XHRcdFx0XHRsaW5lcy5wdXNoKC4uLmJ1aWxkUmVxdWlyZWRGaWVsZExpbmVzKGZpZWxkLCB1bmRlZmluZWQsIGNyZWF0ZWQsIGF1dGhvck5hbWUsIGRlZmF1bHRzKSk7XG5cdFx0XHRcdFx0aW5zZXJ0ZWQuYWRkKGZpZWxkKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGxpbmVzLnB1c2goLi4uYnVpbGRCbG9ja0xpbmVzV2l0aERlZmF1bHQoYmxvY2ssIGRlZmF1bHRGaWVsZHMsIGRlZmF1bHRzKSk7XG5cdH1cblxuXHRmb3IgKGNvbnN0IGZpZWxkIG9mIG1pc3NpbmdGaWVsZHMpIHtcblx0XHRpZiAoIWluc2VydGVkLmhhcyhmaWVsZCkpIHtcblx0XHRcdGNvbnN0IGNyZWF0ZWQgPSBmaWVsZCA9PT0gXCLmnIDlkI7mm7TmlrBcIiA/IGNyZWF0ZWRGb3JVcGRhdGVkIDogZmlsZUNyZWF0ZWQ7XG5cdFx0XHRsaW5lcy5wdXNoKC4uLmJ1aWxkUmVxdWlyZWRGaWVsZExpbmVzKGZpZWxkLCB1bmRlZmluZWQsIGNyZWF0ZWQsIGF1dGhvck5hbWUsIGRlZmF1bHRzKSk7XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIGxpbmVzLmpvaW4oXCJcXG5cIik7XG59XG5cbmZ1bmN0aW9uIGdldEV4aXN0aW5nQ3JlYXRlZFZhbHVlKGJsb2NrczogRnJvbnRtYXR0ZXJCbG9ja1tdKTogc3RyaW5nIHwgbnVsbCB7XG5cdGZvciAoY29uc3QgYmxvY2sgb2YgYmxvY2tzKSB7XG5cdFx0aWYgKGJsb2NrLmtleSA9PT0gXCLliJvlu7rml7bpl7RcIikge1xuXHRcdFx0cmV0dXJuIGdldEJsb2NrU2NhbGFyKGJsb2NrKTtcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gYnVpbGRCbG9ja0xpbmVzV2l0aERlZmF1bHQoXG5cdGJsb2NrOiBGcm9udG1hdHRlckJsb2NrLFxuXHRkZWZhdWx0RmllbGRzOiBGb2xkZXJEZWZhdWx0RmllbGRbXSxcblx0ZGVmYXVsdHM6IEZvbGRlckRlZmF1bHRWYWx1ZXMsXG4pOiBzdHJpbmdbXSB7XG5cdGlmIChibG9jay5rZXkgPT09IFwi6aG555uuXCIgJiYgZGVmYXVsdEZpZWxkcy5pbmNsdWRlcyhcIumhueebrlwiKSkge1xuXHRcdHJldHVybiBbZm9ybWF0U2NhbGFyRmllbGQoXCLpobnnm65cIiwgZGVmYXVsdHNbXCLpobnnm65cIl0gPz8gXCJcIildO1xuXHR9XG5cdGlmIChibG9jay5rZXkgPT09IFwi57G75Z6LXCIgJiYgZGVmYXVsdEZpZWxkcy5pbmNsdWRlcyhcIuexu+Wei1wiKSkge1xuXHRcdHJldHVybiBbXCLnsbvlnos6XCIsIC4uLmZvcm1hdExpc3RWYWx1ZSh1bmRlZmluZWQsIGRlZmF1bHRzW1wi57G75Z6LXCJdID8/IFwiXCIpXTtcblx0fVxuXHRyZXR1cm4gYmxvY2subGluZXM7XG59XG5cbmZ1bmN0aW9uIGZpbGxFbXB0eUZvbGRlckRlZmF1bHRzKGNvbnRlbnQ6IHN0cmluZywgZGVmYXVsdHM6IEZvbGRlckRlZmF1bHRWYWx1ZXMpOiBzdHJpbmcgfCBudWxsIHtcblx0Y29uc3QgZnJvbnRtYXR0ZXIgPSBwYXJzZUZyb250bWF0dGVyKGNvbnRlbnQpO1xuXHRpZiAoZnJvbnRtYXR0ZXIgPT09IG51bGwpIHtcblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdGNvbnN0IGJvZHkgPSBtaWdyYXRlTGVnYWN5RnJvbnRtYXR0ZXJCb2R5KGZyb250bWF0dGVyLmJvZHkpO1xuXHRjb25zdCBibG9ja3MgPSBwYXJzZUZyb250bWF0dGVyQmxvY2tzKGJvZHkpO1xuXHRjb25zdCBkZWZhdWx0RmllbGRzID0gRk9MREVSX0RFRkFVTFRfRklFTERTLmZpbHRlcigoZmllbGQpID0+IHtcblx0XHRyZXR1cm4gZGVmYXVsdHNbZmllbGRdICE9PSB1bmRlZmluZWQgJiYgZnJvbnRtYXR0ZXJGaWVsZElzRW1wdHkoYmxvY2tzLCBmaWVsZCk7XG5cdH0pO1xuXHRpZiAoZGVmYXVsdEZpZWxkcy5sZW5ndGggPT09IDApIHtcblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdGNvbnN0IGxpbmVzID0gYmxvY2tzLmZsYXRNYXAoKGJsb2NrKSA9PiBidWlsZEJsb2NrTGluZXNXaXRoRGVmYXVsdChibG9jaywgZGVmYXVsdEZpZWxkcywgZGVmYXVsdHMpKTtcblx0Y29uc3Qgc3VmZml4ID0gY29udGVudC5zbGljZShmcm9udG1hdHRlci5lbmQpO1xuXHRjb25zdCBzZXBhcmF0b3IgPSBzdWZmaXguc3RhcnRzV2l0aChcIlxcblwiKSA/IFwiXCIgOiBcIlxcblwiO1xuXHRyZXR1cm4gYC0tLVxcbiR7bGluZXMuam9pbihcIlxcblwiKX0ke3NlcGFyYXRvcn0ke3N1ZmZpeH1gO1xufVxuXG5mdW5jdGlvbiBmcm9udG1hdHRlckZpZWxkSXNFbXB0eShibG9ja3M6IEZyb250bWF0dGVyQmxvY2tbXSwgZmllbGQ6IEZvbGRlckRlZmF1bHRGaWVsZCk6IGJvb2xlYW4ge1xuXHRjb25zdCBibG9jayA9IGJsb2Nrcy5maW5kKChpdGVtKSA9PiBpdGVtLmtleSA9PT0gZmllbGQpO1xuXHRpZiAoIWJsb2NrKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0aWYgKGZpZWxkID09PSBcIumhueebrlwiKSB7XG5cdFx0cmV0dXJuIGdldEJsb2NrU2NhbGFyKGJsb2NrKSA9PT0gbnVsbDtcblx0fVxuXG5cdGNvbnN0IGxpc3RWYWx1ZXMgPSBnZXRCbG9ja0xpc3RWYWx1ZXMoYmxvY2spO1xuXHRpZiAobGlzdFZhbHVlcy5sZW5ndGggPiAwKSB7XG5cdFx0cmV0dXJuIGxpc3RWYWx1ZXMuZXZlcnkoKHZhbHVlKSA9PiB2YWx1ZS5sZW5ndGggPT09IDApO1xuXHR9XG5cblx0cmV0dXJuIGdldEJsb2NrU2NhbGFyKGJsb2NrKSA9PT0gbnVsbDtcbn1cblxuZnVuY3Rpb24gYnVpbGRSZW9yZGVyZWRGcm9udG1hdHRlckJvZHkoXG5cdGZyb250bWF0dGVyQm9keTogc3RyaW5nLFxuXHRmaWxlQ3JlYXRlZDogc3RyaW5nLFxuXHRhdXRob3JOYW1lOiBzdHJpbmcsXG5cdGRlZmF1bHRzOiBGb2xkZXJEZWZhdWx0VmFsdWVzLFxuKTogc3RyaW5nIHtcblx0Y29uc3QgYmxvY2tzID0gcGFyc2VGcm9udG1hdHRlckJsb2Nrcyhmcm9udG1hdHRlckJvZHkpO1xuXHRjb25zdCByZXF1aXJlZEJsb2NrcyA9IG5ldyBNYXA8UmVxdWlyZWRGaWVsZCwgRnJvbnRtYXR0ZXJCbG9jaz4oKTtcblx0Y29uc3QgY3VzdG9tQmxvY2tzOiBGcm9udG1hdHRlckJsb2NrW10gPSBbXTtcblxuXHRmb3IgKGNvbnN0IGJsb2NrIG9mIGJsb2Nrcykge1xuXHRcdGlmIChpc1JlcXVpcmVkRmllbGQoYmxvY2sua2V5KSkge1xuXHRcdFx0aWYgKCFyZXF1aXJlZEJsb2Nrcy5oYXMoYmxvY2sua2V5KSkge1xuXHRcdFx0XHRyZXF1aXJlZEJsb2Nrcy5zZXQoYmxvY2sua2V5LCBibG9jayk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjdXN0b21CbG9ja3MucHVzaChibG9jayk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIGlmIChibG9jay5saW5lcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRjdXN0b21CbG9ja3MucHVzaChibG9jayk7XG5cdFx0fVxuXHR9XG5cblx0Y29uc3QgZXhpc3RpbmdDcmVhdGVkID0gZ2V0QmxvY2tTY2FsYXIocmVxdWlyZWRCbG9ja3MuZ2V0KFwi5Yib5bu65pe26Ze0XCIpKTtcblx0Y29uc3QgY3JlYXRlZCA9IGV4aXN0aW5nQ3JlYXRlZCB8fCBmaWxlQ3JlYXRlZDtcblx0Y29uc3QgbGluZXM6IHN0cmluZ1tdID0gW107XG5cblx0bGluZXMucHVzaCguLi5idWlsZFJlcXVpcmVkRmllbGRMaW5lcyhcIumhueebrlwiLCByZXF1aXJlZEJsb2Nrcy5nZXQoXCLpobnnm65cIiksIGZpbGVDcmVhdGVkLCBhdXRob3JOYW1lLCBkZWZhdWx0cykpO1xuXHRsaW5lcy5wdXNoKC4uLmJ1aWxkUmVxdWlyZWRGaWVsZExpbmVzKFwi57G75Z6LXCIsIHJlcXVpcmVkQmxvY2tzLmdldChcIuexu+Wei1wiKSwgZmlsZUNyZWF0ZWQsIGF1dGhvck5hbWUsIGRlZmF1bHRzKSk7XG5cdGxpbmVzLnB1c2goLi4uY3VzdG9tQmxvY2tzLmZsYXRNYXAoKGJsb2NrKSA9PiBibG9jay5saW5lcykpO1xuXHRsaW5lcy5wdXNoKC4uLmJ1aWxkUmVxdWlyZWRGaWVsZExpbmVzKFwi5L2c6ICFXCIsIHJlcXVpcmVkQmxvY2tzLmdldChcIuS9nOiAhVwiKSwgZmlsZUNyZWF0ZWQsIGF1dGhvck5hbWUsIGRlZmF1bHRzKSk7XG5cdGxpbmVzLnB1c2goLi4uYnVpbGRSZXF1aXJlZEZpZWxkTGluZXMoXCLmkZjopoFcIiwgcmVxdWlyZWRCbG9ja3MuZ2V0KFwi5pGY6KaBXCIpLCBmaWxlQ3JlYXRlZCwgYXV0aG9yTmFtZSwgZGVmYXVsdHMpKTtcblx0bGluZXMucHVzaCguLi5idWlsZFJlcXVpcmVkRmllbGRMaW5lcyhcIuWIm+W7uuaXtumXtFwiLCByZXF1aXJlZEJsb2Nrcy5nZXQoXCLliJvlu7rml7bpl7RcIiksIGZpbGVDcmVhdGVkLCBhdXRob3JOYW1lLCBkZWZhdWx0cykpO1xuXHRsaW5lcy5wdXNoKC4uLmJ1aWxkUmVxdWlyZWRGaWVsZExpbmVzKFwi5pyA5ZCO5pu05pawXCIsIHJlcXVpcmVkQmxvY2tzLmdldChcIuacgOWQjuabtOaWsFwiKSwgY3JlYXRlZCwgYXV0aG9yTmFtZSwgZGVmYXVsdHMpKTtcblx0cmV0dXJuIGxpbmVzLmpvaW4oXCJcXG5cIik7XG59XG5cbmZ1bmN0aW9uIGJ1aWxkUmVxdWlyZWRGaWVsZExpbmVzKFxuXHRmaWVsZDogUmVxdWlyZWRGaWVsZCxcblx0YmxvY2s6IEZyb250bWF0dGVyQmxvY2sgfCB1bmRlZmluZWQsXG5cdGZpbGVDcmVhdGVkOiBzdHJpbmcsXG5cdGF1dGhvck5hbWU6IHN0cmluZyxcblx0ZGVmYXVsdHM6IEZvbGRlckRlZmF1bHRWYWx1ZXMgPSB7fSxcbik6IHN0cmluZ1tdIHtcblx0aWYgKGZpZWxkID09PSBcIumhueebrlwiKSB7XG5cdFx0cmV0dXJuIFtmb3JtYXRTY2FsYXJGaWVsZChcIumhueebrlwiLCBnZXRCbG9ja1NjYWxhcihibG9jaykgPz8gZGVmYXVsdHNbXCLpobnnm65cIl0gPz8gXCJcIildO1xuXHR9XG5cdGlmIChmaWVsZCA9PT0gXCLnsbvlnotcIikge1xuXHRcdHJldHVybiBbXCLnsbvlnos6XCIsIC4uLmZvcm1hdExpc3RWYWx1ZShibG9jaywgZGVmYXVsdHNbXCLnsbvlnotcIl0gPz8gXCJcIildO1xuXHR9XG5cdGlmIChmaWVsZCA9PT0gXCLkvZzogIVcIikge1xuXHRcdHJldHVybiBbXCLkvZzogIU6XCIsIC4uLmZvcm1hdExpc3RWYWx1ZShibG9jaywgYXV0aG9yTmFtZSldO1xuXHR9XG5cdGlmIChmaWVsZCA9PT0gXCLmkZjopoFcIikge1xuXHRcdHJldHVybiBbZm9ybWF0U2NhbGFyRmllbGQoXCLmkZjopoFcIiwgZ2V0QmxvY2tTY2FsYXIoYmxvY2spID8/IFwiXCIpXTtcblx0fVxuXHRpZiAoZmllbGQgPT09IFwi5Yib5bu65pe26Ze0XCIpIHtcblx0XHRyZXR1cm4gW2DliJvlu7rml7bpl7Q6ICR7Z2V0QmxvY2tTY2FsYXIoYmxvY2spIHx8IGZpbGVDcmVhdGVkfWBdO1xuXHR9XG5cdHJldHVybiBbYOacgOWQjuabtOaWsDogJHtnZXRCbG9ja1NjYWxhcihibG9jaykgfHwgZmlsZUNyZWF0ZWR9YF07XG59XG5cbmZ1bmN0aW9uIGdldExlZ2FjeVJlbmFtZXMoYmxvY2tzOiBGcm9udG1hdHRlckJsb2NrW10pOiBMZWdhY3lSZW5hbWVbXSB7XG5cdGNvbnN0IHJlbmFtZXM6IExlZ2FjeVJlbmFtZVtdID0gW107XG5cdGZvciAoY29uc3QgbGVnYWN5RmllbGQgb2YgT2JqZWN0LmtleXMoTEVHQUNZX0ZJRUxEX1JFTkFNRVMpIGFzIExlZ2FjeUZpZWxkW10pIHtcblx0XHRpZiAoaGFzQW55RnJvbnRtYXR0ZXJCbG9jayhibG9ja3MsIGxlZ2FjeUZpZWxkKSkge1xuXHRcdFx0cmVuYW1lcy5wdXNoKHtcblx0XHRcdFx0ZnJvbTogbGVnYWN5RmllbGQsXG5cdFx0XHRcdHRvOiBMRUdBQ1lfRklFTERfUkVOQU1FU1tsZWdhY3lGaWVsZF0sXG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblx0cmV0dXJuIHJlbmFtZXM7XG59XG5cbmZ1bmN0aW9uIG1pZ3JhdGVMZWdhY3lGcm9udG1hdHRlckJvZHkoZnJvbnRtYXR0ZXJCb2R5OiBzdHJpbmcpOiBzdHJpbmcge1xuXHRyZXR1cm4gbWlncmF0ZUxlZ2FjeUJsb2NrcyhwYXJzZUZyb250bWF0dGVyQmxvY2tzKGZyb250bWF0dGVyQm9keSkpXG5cdFx0LmZsYXRNYXAoKGJsb2NrKSA9PiBibG9jay5saW5lcylcblx0XHQuam9pbihcIlxcblwiKTtcbn1cblxuZnVuY3Rpb24gbWlncmF0ZUxlZ2FjeUJsb2NrcyhibG9ja3M6IEZyb250bWF0dGVyQmxvY2tbXSk6IEZyb250bWF0dGVyQmxvY2tbXSB7XG5cdGNvbnN0IGhhc05ld0ZpZWxkID0gbmV3IFNldDxSZXF1aXJlZEZpZWxkPigpO1xuXHRmb3IgKGNvbnN0IGJsb2NrIG9mIGJsb2Nrcykge1xuXHRcdGlmIChpc1JlcXVpcmVkRmllbGQoYmxvY2sua2V5KSkge1xuXHRcdFx0aGFzTmV3RmllbGQuYWRkKGJsb2NrLmtleSk7XG5cdFx0fVxuXHR9XG5cblx0Y29uc3QgbWlncmF0ZWQ6IEZyb250bWF0dGVyQmxvY2tbXSA9IFtdO1xuXHRmb3IgKGNvbnN0IGJsb2NrIG9mIGJsb2Nrcykge1xuXHRcdGlmIChpc0xlZ2FjeUZpZWxkKGJsb2NrLmtleSkpIHtcblx0XHRcdGNvbnN0IG5ld0tleSA9IExFR0FDWV9GSUVMRF9SRU5BTUVTW2Jsb2NrLmtleV07XG5cdFx0XHRpZiAoaGFzTmV3RmllbGQuaGFzKG5ld0tleSkpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGhhc05ld0ZpZWxkLmFkZChuZXdLZXkpO1xuXHRcdFx0bWlncmF0ZWQucHVzaCh7XG5cdFx0XHRcdGtleTogbmV3S2V5LFxuXHRcdFx0XHRsaW5lczogcmVuYW1lQmxvY2tGaXJzdExpbmUoYmxvY2subGluZXMsIG5ld0tleSksXG5cdFx0XHR9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0bWlncmF0ZWQucHVzaChibG9jayk7XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIG1pZ3JhdGVkO1xufVxuXG5mdW5jdGlvbiByZW5hbWVCbG9ja0ZpcnN0TGluZShsaW5lczogc3RyaW5nW10sIGtleTogUmVxdWlyZWRGaWVsZCk6IHN0cmluZ1tdIHtcblx0aWYgKGxpbmVzLmxlbmd0aCA9PT0gMCkge1xuXHRcdHJldHVybiBbXTtcblx0fVxuXG5cdGNvbnN0IGNvbG9uID0gbGluZXNbMF0uaW5kZXhPZihcIjpcIik7XG5cdGNvbnN0IGZpcnN0TGluZSA9IGNvbG9uID09PSAtMSA/IGAke2tleX06YCA6IGAke2tleX0ke2xpbmVzWzBdLnNsaWNlKGNvbG9uKX1gO1xuXHRyZXR1cm4gW2ZpcnN0TGluZSwgLi4ubGluZXMuc2xpY2UoMSldO1xufVxuXG5mdW5jdGlvbiBwYXJzZUZyb250bWF0dGVyQmxvY2tzKGZyb250bWF0dGVyOiBzdHJpbmcpOiBGcm9udG1hdHRlckJsb2NrW10ge1xuXHRjb25zdCBibG9ja3M6IEZyb250bWF0dGVyQmxvY2tbXSA9IFtdO1xuXHRjb25zdCBsaW5lcyA9IGZyb250bWF0dGVyLnNwbGl0KFwiXFxuXCIpLmZpbHRlcigobGluZSwgaW5kZXgsIGFsbCkgPT4ge1xuXHRcdHJldHVybiBpbmRleCA8IGFsbC5sZW5ndGggLSAxIHx8IGxpbmUubGVuZ3RoID4gMDtcblx0fSk7XG5cblx0Zm9yIChjb25zdCBsaW5lIG9mIGxpbmVzKSB7XG5cdFx0Y29uc3Qga2V5ID0gZ2V0VG9wTGV2ZWxLZXkobGluZSk7XG5cdFx0aWYgKGtleSAhPT0gbnVsbCB8fCBibG9ja3MubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRibG9ja3MucHVzaCh7IGtleSwgbGluZXM6IFtsaW5lXSB9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0YmxvY2tzW2Jsb2Nrcy5sZW5ndGggLSAxXS5saW5lcy5wdXNoKGxpbmUpO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiBibG9ja3M7XG59XG5cbmZ1bmN0aW9uIGdldFRvcExldmVsS2V5KGxpbmU6IHN0cmluZyk6IHN0cmluZyB8IG51bGwge1xuXHRpZiAoL15cXHMvLnRlc3QobGluZSkpIHtcblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdGNvbnN0IG1hdGNoID0gL14oW146I11bXjpdKik6Ly5leGVjKGxpbmUpO1xuXHRyZXR1cm4gbWF0Y2ggPyBtYXRjaFsxXS50cmltKCkgOiBudWxsO1xufVxuXG5mdW5jdGlvbiBoYXNGcm9udG1hdHRlckJsb2NrKGJsb2NrczogRnJvbnRtYXR0ZXJCbG9ja1tdLCBmaWVsZDogUmVxdWlyZWRGaWVsZCk6IGJvb2xlYW4ge1xuXHRyZXR1cm4gYmxvY2tzLnNvbWUoKGJsb2NrKSA9PiBibG9jay5rZXkgPT09IGZpZWxkKTtcbn1cblxuZnVuY3Rpb24gaGFzQW55RnJvbnRtYXR0ZXJCbG9jayhibG9ja3M6IEZyb250bWF0dGVyQmxvY2tbXSwgZmllbGQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRyZXR1cm4gYmxvY2tzLnNvbWUoKGJsb2NrKSA9PiBibG9jay5rZXkgPT09IGZpZWxkKTtcbn1cblxuZnVuY3Rpb24gcmVxdWlyZWRGaWVsZHNBcmVJblJlbGF0aXZlT3JkZXIoYmxvY2tzOiBGcm9udG1hdHRlckJsb2NrW10pOiBib29sZWFuIHtcblx0bGV0IGxhc3RJbmRleCA9IC0xO1xuXHRmb3IgKGNvbnN0IGJsb2NrIG9mIGJsb2Nrcykge1xuXHRcdGlmICghaXNSZXF1aXJlZEZpZWxkKGJsb2NrLmtleSkpIHtcblx0XHRcdGNvbnRpbnVlO1xuXHRcdH1cblxuXHRcdGNvbnN0IGluZGV4ID0gZ2V0UmVxdWlyZWRGaWVsZEluZGV4KGJsb2NrLmtleSk7XG5cdFx0aWYgKGluZGV4IDwgbGFzdEluZGV4KSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGxhc3RJbmRleCA9IGluZGV4O1xuXHR9XG5cblx0cmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIGdldFJlcXVpcmVkRmllbGRJbmRleChmaWVsZDogUmVxdWlyZWRGaWVsZCk6IG51bWJlciB7XG5cdHJldHVybiBSRVFVSVJFRF9GSUVMRFMuaW5kZXhPZihmaWVsZCk7XG59XG5cbmZ1bmN0aW9uIGlzUmVxdWlyZWRGaWVsZChrZXk6IHN0cmluZyB8IG51bGwpOiBrZXkgaXMgUmVxdWlyZWRGaWVsZCB7XG5cdHJldHVybiBrZXkgIT09IG51bGwgJiYgKFJFUVVJUkVEX0ZJRUxEUyBhcyByZWFkb25seSBzdHJpbmdbXSkuaW5jbHVkZXMoa2V5KTtcbn1cblxuZnVuY3Rpb24gaXNMZWdhY3lGaWVsZChrZXk6IHN0cmluZyB8IG51bGwpOiBrZXkgaXMgTGVnYWN5RmllbGQge1xuXHRyZXR1cm4ga2V5ICE9PSBudWxsICYmIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChMRUdBQ1lfRklFTERfUkVOQU1FUywga2V5KTtcbn1cblxuZnVuY3Rpb24gZ2V0QmxvY2tTY2FsYXIoYmxvY2s6IEZyb250bWF0dGVyQmxvY2sgfCB1bmRlZmluZWQpOiBzdHJpbmcgfCBudWxsIHtcblx0aWYgKCFibG9jaykge1xuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0Y29uc3QgZmlyc3RMaW5lID0gYmxvY2subGluZXNbMF07XG5cdGNvbnN0IGNvbG9uID0gZmlyc3RMaW5lLmluZGV4T2YoXCI6XCIpO1xuXHRpZiAoY29sb24gPT09IC0xKSB7XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRjb25zdCB2YWx1ZSA9IGZpcnN0TGluZS5zbGljZShjb2xvbiArIDEpLnRyaW0oKTtcblx0cmV0dXJuIHZhbHVlLmxlbmd0aCA+IDAgPyB2YWx1ZSA6IG51bGw7XG59XG5cbmZ1bmN0aW9uIGZvcm1hdFNjYWxhckZpZWxkKGZpZWxkOiBSZXF1aXJlZEZpZWxkLCB2YWx1ZTogc3RyaW5nKTogc3RyaW5nIHtcblx0cmV0dXJuIHZhbHVlID8gYCR7ZmllbGR9OiAke3ZhbHVlfWAgOiBgJHtmaWVsZH06IGA7XG59XG5cbmZ1bmN0aW9uIGZvcm1hdExpc3RWYWx1ZShibG9jazogRnJvbnRtYXR0ZXJCbG9jayB8IHVuZGVmaW5lZCwgZGVmYXVsdFZhbHVlOiBzdHJpbmcpOiBzdHJpbmdbXSB7XG5cdGNvbnN0IHZhbHVlcyA9IGdldEJsb2NrTGlzdFZhbHVlcyhibG9jayk7XG5cdGlmICh2YWx1ZXMubGVuZ3RoID4gMCkge1xuXHRcdHJldHVybiB2YWx1ZXMubWFwKCh2YWx1ZSkgPT4gYCAgLSAke2Zvcm1hdFlhbWxTY2FsYXIodmFsdWUpfWApO1xuXHR9XG5cblx0Y29uc3Qgc2NhbGFyID0gZ2V0QmxvY2tTY2FsYXIoYmxvY2spO1xuXHRjb25zdCB2YWx1ZSA9IHNjYWxhciA/PyBkZWZhdWx0VmFsdWU7XG5cdHJldHVybiBbYCAgLSAke2Zvcm1hdFlhbWxTY2FsYXIodmFsdWUpfWBdO1xufVxuXG5mdW5jdGlvbiBnZXRCbG9ja0xpc3RWYWx1ZXMoYmxvY2s6IEZyb250bWF0dGVyQmxvY2sgfCB1bmRlZmluZWQpOiBzdHJpbmdbXSB7XG5cdGlmICghYmxvY2sgfHwgYmxvY2subGluZXMubGVuZ3RoIDw9IDEpIHtcblx0XHRyZXR1cm4gW107XG5cdH1cblxuXHRjb25zdCB2YWx1ZXM6IHN0cmluZ1tdID0gW107XG5cdGZvciAoY29uc3QgbGluZSBvZiBibG9jay5saW5lcy5zbGljZSgxKSkge1xuXHRcdGNvbnN0IG1hdGNoID0gL15cXHMqLVxccyooLiopJC8uZXhlYyhsaW5lKTtcblx0XHRpZiAobWF0Y2gpIHtcblx0XHRcdHZhbHVlcy5wdXNoKG1hdGNoWzFdLnRyaW0oKSk7XG5cdFx0fVxuXHR9XG5cdHJldHVybiB2YWx1ZXM7XG59XG5cbmZ1bmN0aW9uIHBhcnNlRnJvbnRtYXR0ZXIoY29udGVudDogc3RyaW5nKTogeyBib2R5OiBzdHJpbmc7IGVuZDogbnVtYmVyIH0gfCBudWxsIHtcblx0aWYgKCFjb250ZW50LnN0YXJ0c1dpdGgoXCItLS1cXG5cIikpIHtcblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdGxldCBsaW5lU3RhcnQgPSA0O1xuXHR3aGlsZSAobGluZVN0YXJ0IDw9IGNvbnRlbnQubGVuZ3RoKSB7XG5cdFx0Y29uc3QgbGluZUVuZCA9IGNvbnRlbnQuaW5kZXhPZihcIlxcblwiLCBsaW5lU3RhcnQpO1xuXHRcdGNvbnN0IGxpbmUgPSBjb250ZW50LnNsaWNlKGxpbmVTdGFydCwgbGluZUVuZCA9PT0gLTEgPyBjb250ZW50Lmxlbmd0aCA6IGxpbmVFbmQpO1xuXHRcdGlmIChsaW5lLnRyaW0oKSA9PT0gXCItLS1cIikge1xuXHRcdFx0Y29uc3QgZW5kID0gbGluZVN0YXJ0ID09PSA0ID8gNCA6IGxpbmVTdGFydCAtIDE7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRib2R5OiBjb250ZW50LnNsaWNlKDQsIGVuZCksXG5cdFx0XHRcdGVuZCxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKGxpbmVFbmQgPT09IC0xKSB7XG5cdFx0XHRicmVhaztcblx0XHR9XG5cdFx0bGluZVN0YXJ0ID0gbGluZUVuZCArIDE7XG5cdH1cblxuXHRyZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gZ2V0U3VtbWFyeURvY3VtZW50KGZpbGU6IFRGaWxlLCBjb250ZW50OiBzdHJpbmcsIG1pbkJvZHlMZW5ndGg6IG51bWJlcik6IFN1bW1hcnlEb2N1bWVudCB8IG51bGwge1xuXHRjb25zdCBmcm9udG1hdHRlciA9IHBhcnNlRnJvbnRtYXR0ZXIoY29udGVudCk7XG5cdGNvbnN0IGJvZHkgPSBnZXRCb2R5V2l0aG91dEZyb250bWF0dGVyKGNvbnRlbnQsIGZyb250bWF0dGVyKTtcblx0Y29uc3QgdHJpbW1lZCA9IGJvZHkudHJpbSgpO1xuXHRpZiAodHJpbW1lZC5sZW5ndGggPCBtaW5Cb2R5TGVuZ3RoKSB7XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRyZXR1cm4ge1xuXHRcdHRpdGxlOiBmaWxlLmJhc2VuYW1lLFxuXHRcdGZyb250bWF0dGVyOiBmcm9udG1hdHRlcj8uYm9keS50cmltKCkgPz8gXCJcIixcblx0XHRjb250ZW50OiB0cmltbWVkLnNsaWNlKDAsIE1BWF9TVU1NQVJZX0NPTlRFTlRfTEVOR1RIKSxcblx0fTtcbn1cblxuZnVuY3Rpb24gZ2V0Qm9keVdpdGhvdXRGcm9udG1hdHRlcihcblx0Y29udGVudDogc3RyaW5nLFxuXHRmcm9udG1hdHRlcjogeyBib2R5OiBzdHJpbmc7IGVuZDogbnVtYmVyIH0gfCBudWxsLFxuKTogc3RyaW5nIHtcblx0aWYgKGZyb250bWF0dGVyID09PSBudWxsKSB7XG5cdFx0cmV0dXJuIGNvbnRlbnQ7XG5cdH1cblxuXHRyZXR1cm4gY29udGVudC5zbGljZShmcm9udG1hdHRlci5lbmQpLnJlcGxhY2UoL15cXG4/LS0tXFxuPy8sIFwiXCIpO1xufVxuXG5mdW5jdGlvbiB3cml0ZVN1bW1hcnlUb0NvbnRlbnQoXG5cdGNvbnRlbnQ6IHN0cmluZyxcblx0ZmlsZTogVEZpbGUsXG5cdHN1bW1hcnk6IHN0cmluZyxcblx0ZGVmYXVsdHM6IEZvbGRlckRlZmF1bHRWYWx1ZXMsXG5cdGJ1aWxkRnVsbEZyb250bWF0dGVyOiAoY3JlYXRlZDogc3RyaW5nLCBkZWZhdWx0cz86IEZvbGRlckRlZmF1bHRWYWx1ZXMpID0+IHN0cmluZyxcbik6IHN0cmluZyB8IG51bGwge1xuXHRjb25zdCBjcmVhdGVkID0gZm9ybWF0TG9jYWxEYXRlKG5ldyBEYXRlKGZpbGUuc3RhdC5jdGltZSkpO1xuXHRjb25zdCBzb3VyY2UgPSBwYXJzZUZyb250bWF0dGVyKGNvbnRlbnQpID09PSBudWxsID8gYnVpbGRGdWxsRnJvbnRtYXR0ZXIoY3JlYXRlZCwgZGVmYXVsdHMpICsgY29udGVudCA6IGNvbnRlbnQ7XG5cdGNvbnN0IGZyb250bWF0dGVyID0gcGFyc2VGcm9udG1hdHRlcihzb3VyY2UpO1xuXHRpZiAoZnJvbnRtYXR0ZXIgPT09IG51bGwpIHtcblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdGxldCBib2R5ID0gbWlncmF0ZUxlZ2FjeUZyb250bWF0dGVyQm9keShmcm9udG1hdHRlci5ib2R5KTtcblx0aWYgKCFoYXNGcm9udG1hdHRlckJsb2NrKHBhcnNlRnJvbnRtYXR0ZXJCbG9ja3MoYm9keSksIFwi5pGY6KaBXCIpKSB7XG5cdFx0Ym9keSA9IGJ1aWxkRnJvbnRtYXR0ZXJCb2R5V2l0aE1pc3NpbmdGaWVsZHMoYm9keSwgW1wi5pGY6KaBXCJdLCBbXSwgY3JlYXRlZCwgXCJcIiwgZGVmYXVsdHMpO1xuXHR9XG5cblx0Y29uc3QgbmV4dEJvZHkgPSByZXBsYWNlU3VtbWFyeUZpZWxkKGJvZHksIG5vcm1hbGl6ZVN1bW1hcnkoc3VtbWFyeSkpO1xuXHRjb25zdCBzdWZmaXggPSBzb3VyY2Uuc2xpY2UoZnJvbnRtYXR0ZXIuZW5kKTtcblx0Y29uc3Qgc2VwYXJhdG9yID0gc3VmZml4LnN0YXJ0c1dpdGgoXCJcXG5cIikgPyBcIlwiIDogXCJcXG5cIjtcblx0cmV0dXJuIGAtLS1cXG4ke25leHRCb2R5fSR7c2VwYXJhdG9yfSR7c3VmZml4fWA7XG59XG5cbmZ1bmN0aW9uIHJlcGxhY2VTdW1tYXJ5RmllbGQoZnJvbnRtYXR0ZXJCb2R5OiBzdHJpbmcsIHN1bW1hcnk6IHN0cmluZyk6IHN0cmluZyB7XG5cdGxldCByZXBsYWNlZCA9IGZhbHNlO1xuXHRjb25zdCBibG9ja3MgPSBwYXJzZUZyb250bWF0dGVyQmxvY2tzKGZyb250bWF0dGVyQm9keSk7XG5cdGNvbnN0IGxpbmVzID0gYmxvY2tzLmZsYXRNYXAoKGJsb2NrKSA9PiB7XG5cdFx0aWYgKGJsb2NrLmtleSA9PT0gXCLmkZjopoFcIiAmJiAhcmVwbGFjZWQpIHtcblx0XHRcdHJlcGxhY2VkID0gdHJ1ZTtcblx0XHRcdHJldHVybiBbZm9ybWF0U2NhbGFyRmllbGQoXCLmkZjopoFcIiwgc3VtbWFyeSldO1xuXHRcdH1cblxuXHRcdHJldHVybiBibG9jay5saW5lcztcblx0fSk7XG5cdHJldHVybiBsaW5lcy5qb2luKFwiXFxuXCIpO1xufVxuXG5mdW5jdGlvbiBub3JtYWxpemVTdW1tYXJ5KHN1bW1hcnk6IHN0cmluZyk6IHN0cmluZyB7XG5cdHJldHVybiBzdW1tYXJ5LnJlcGxhY2UoL1xccysvZywgXCIgXCIpLnRyaW0oKTtcbn1cblxuZnVuY3Rpb24gZ2V0RXJyb3JNZXNzYWdlKGVycm9yOiB1bmtub3duKTogc3RyaW5nIHtcblx0cmV0dXJuIGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKTtcbn1cblxuZnVuY3Rpb24gZnJvbnRtYXR0ZXJBdXRob3JDb250YWlucyh2YWx1ZTogdW5rbm93biwgYXV0aG9yOiBzdHJpbmcpOiBib29sZWFuIHtcblx0cmV0dXJuIG5vcm1hbGl6ZUNhbmRpZGF0ZVZhbHVlcyh2YWx1ZSkuaW5jbHVkZXMoYXV0aG9yKTtcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplRnJvbnRtYXR0ZXJTY2FsYXIodmFsdWU6IHVua25vd24pOiBzdHJpbmcge1xuXHRpZiAodHlwZW9mIHZhbHVlID09PSBcInN0cmluZ1wiKSB7XG5cdFx0cmV0dXJuIHZhbHVlLnRyaW0oKTtcblx0fVxuXHRpZiAodmFsdWUgPT09IG51bGwgfHwgdmFsdWUgPT09IHVuZGVmaW5lZCkge1xuXHRcdHJldHVybiBcIlwiO1xuXHR9XG5cdGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuXHRcdHJldHVybiB2YWx1ZVxuXHRcdFx0Lm1hcCgoaXRlbSkgPT4gbm9ybWFsaXplRnJvbnRtYXR0ZXJTY2FsYXIoaXRlbSkpXG5cdFx0XHQuZmluZCgoaXRlbSkgPT4gaXRlbS5sZW5ndGggPiAwKSA/PyBcIlwiO1xuXHR9XG5cdHJldHVybiBTdHJpbmcodmFsdWUpLnRyaW0oKTtcbn1cblxuZnVuY3Rpb24gcmVwbGFjZVByb21wdFRva2VuKHByb21wdDogc3RyaW5nLCB0b2tlbjogc3RyaW5nLCB2YWx1ZTogc3RyaW5nKTogc3RyaW5nIHtcblx0cmV0dXJuIHByb21wdC5zcGxpdCh0b2tlbikuam9pbih2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIGRlbGF5KG1zOiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcblx0cmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG5cdFx0d2luZG93LnNldFRpbWVvdXQocmVzb2x2ZSwgbXMpO1xuXHR9KTtcbn1cblxuZnVuY3Rpb24gY2xhbXAodmFsdWU6IG51bWJlciwgbWluOiBudW1iZXIsIG1heDogbnVtYmVyKTogbnVtYmVyIHtcblx0cmV0dXJuIE1hdGgubWluKE1hdGgubWF4KHZhbHVlLCBtaW4pLCBtYXgpO1xufVxuXG5mdW5jdGlvbiBmb3JtYXRTY2FuUmVhc29uKHJlc3VsdDogU2NhblJlc3VsdCk6IHN0cmluZyB7XG5cdGNvbnN0IHJlYXNvbnM6IHN0cmluZ1tdID0gW107XG5cdGZvciAoY29uc3QgcmVuYW1lIG9mIHJlc3VsdC5yZW5hbWVGaWVsZHMpIHtcblx0XHRyZWFzb25zLnB1c2goYOWtl+autemcgOmHjeWRveWQje+8miR7cmVuYW1lLmZyb219IOKGkiAke3JlbmFtZS50b31gKTtcblx0fVxuXHRpZiAocmVzdWx0Lm1pc3NpbmdGaWVsZHMubGVuZ3RoID4gMCkge1xuXHRcdHJlYXNvbnMucHVzaChg57y65bCR77yaJHtyZXN1bHQubWlzc2luZ0ZpZWxkcy5qb2luKFwiLCBcIil9YCk7XG5cdH1cblx0aWYgKHJlc3VsdC5kZWZhdWx0RmllbGRzLmxlbmd0aCA+IDApIHtcblx0XHRyZWFzb25zLnB1c2goYOm7mOiupOWAvOihpeWFqO+8miR7cmVzdWx0LmRlZmF1bHRGaWVsZHMuam9pbihcIiwgXCIpfWApO1xuXHR9XG5cdGlmIChyZXN1bHQub3JkZXJOZWVkc0ZpeCkge1xuXHRcdHJlYXNvbnMucHVzaChcIuWtl+autemhuuW6j+mcgOiwg+aVtFwiKTtcblx0fVxuXHRyZXR1cm4gcmVhc29ucy5qb2luKFwi77ybXCIpO1xufVxuXG5mdW5jdGlvbiBmaW5kTWV0YWRhdGFSb3coY29udGFpbmVyOiBIVE1MRWxlbWVudCwgZmllbGQ6IFJlcXVpcmVkRmllbGQpOiBIVE1MRWxlbWVudCB8IG51bGwge1xuXHRjb25zdCBkYXRhUm93ID0gY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3I8SFRNTEVsZW1lbnQ+KGBbZGF0YS1wcm9wZXJ0eS1rZXk9XCIke2ZpZWxkfVwiXWApO1xuXHRpZiAoZGF0YVJvdyAhPT0gbnVsbCkge1xuXHRcdHJldHVybiAoZGF0YVJvdy5jbG9zZXN0KFwiLm1ldGFkYXRhLXByb3BlcnR5XCIpIGFzIEhUTUxFbGVtZW50IHwgbnVsbCkgPz8gZGF0YVJvdztcblx0fVxuXG5cdGNvbnN0IHByb3BlcnR5Um93cyA9IGNvbnRhaW5lci5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50PihcIi5tZXRhZGF0YS1wcm9wZXJ0eVwiKTtcblx0Zm9yIChjb25zdCByb3cgb2YgQXJyYXkuZnJvbShwcm9wZXJ0eVJvd3MpKSB7XG5cdFx0aWYgKHJvd0NvbnRhaW5zRmllbGRMYWJlbChyb3csIGZpZWxkKSkge1xuXHRcdFx0cmV0dXJuIHJvdztcblx0XHR9XG5cdH1cblxuXHRjb25zdCBlbGVtZW50cyA9IGNvbnRhaW5lci5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50PihcIipcIik7XG5cdGZvciAoY29uc3QgZWwgb2YgQXJyYXkuZnJvbShlbGVtZW50cykpIHtcblx0XHRpZiAoZ2V0RWxlbWVudExhYmVsKGVsKSA9PT0gZmllbGQpIHtcblx0XHRcdHJldHVybiAoZWwuY2xvc2VzdChcIi5tZXRhZGF0YS1wcm9wZXJ0eVwiKSBhcyBIVE1MRWxlbWVudCB8IG51bGwpID8/IGVsLnBhcmVudEVsZW1lbnQgPz8gZWw7XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIGZpbmRNZXRhZGF0YVZhbHVlQ29udGFpbmVyKHJvdzogSFRNTEVsZW1lbnQpOiBIVE1MRWxlbWVudCB8IG51bGwge1xuXHRyZXR1cm4gcm93LnF1ZXJ5U2VsZWN0b3I8SFRNTEVsZW1lbnQ+KFxuXHRcdFwiLm1ldGFkYXRhLXByb3BlcnR5LXZhbHVlLCAubWV0YWRhdGEtcHJvcGVydHktdmFsdWUtaW5wdXQsIC5tZXRhZGF0YS1wcm9wZXJ0eS12YWx1ZS1jb250YWluZXJcIixcblx0KTtcbn1cblxuZnVuY3Rpb24gcmVtb3ZlRW1wdHlIaWdobGlnaHRDbGFzc2VzKGVsOiBFbGVtZW50KSB7XG5cdGVsLmNsYXNzTGlzdC5yZW1vdmUoXG5cdFx0XCJmcm9udG1hdHRlci1lbXB0eS1oaWdobGlnaHRcIixcblx0XHRcImZyb250bWF0dGVyLWVtcHR5LTFcIixcblx0XHRcImZyb250bWF0dGVyLWVtcHR5LTJcIixcblx0XHRcImZyb250bWF0dGVyLWVtcHR5LTNcIixcblx0XHRcImZyb250bWF0dGVyLWVtcHR5LTRcIixcblx0XHRcImZyb250bWF0dGVyLWVtcHR5LTVcIixcblx0XHRcImZyb250bWF0dGVyLWVtcHR5LTZcIixcblx0KTtcbn1cblxuZnVuY3Rpb24gZ2V0RG9jdW1lbnRPcmRlcihhOiBIVE1MRWxlbWVudCwgYjogSFRNTEVsZW1lbnQpOiBudW1iZXIge1xuXHRpZiAoYSA9PT0gYikge1xuXHRcdHJldHVybiAwO1xuXHR9XG5cblx0Y29uc3QgcG9zaXRpb24gPSBhLmNvbXBhcmVEb2N1bWVudFBvc2l0aW9uKGIpO1xuXHRyZXR1cm4gcG9zaXRpb24gJiBOb2RlLkRPQ1VNRU5UX1BPU0lUSU9OX0ZPTExPV0lORyA/IC0xIDogMTtcbn1cblxuZnVuY3Rpb24gcm93Q29udGFpbnNGaWVsZExhYmVsKHJvdzogSFRNTEVsZW1lbnQsIGZpZWxkOiBSZXF1aXJlZEZpZWxkKTogYm9vbGVhbiB7XG5cdGlmIChnZXRFbGVtZW50TGFiZWwocm93KSA9PT0gZmllbGQpIHtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdGNvbnN0IGxhYmVsRWxlbWVudHMgPSByb3cucXVlcnlTZWxlY3RvckFsbDxIVE1MRWxlbWVudD4oXG5cdFx0XCIubWV0YWRhdGEtcHJvcGVydHkta2V5LCAubWV0YWRhdGEtcHJvcGVydHkta2V5LWlucHV0LCBbYXJpYS1sYWJlbF0sIFt0aXRsZV1cIixcblx0KTtcblx0Zm9yIChjb25zdCBlbCBvZiBBcnJheS5mcm9tKGxhYmVsRWxlbWVudHMpKSB7XG5cdFx0aWYgKGdldEVsZW1lbnRMYWJlbChlbCkgPT09IGZpZWxkKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gZmFsc2U7XG59XG5cbmZ1bmN0aW9uIGdldEVsZW1lbnRMYWJlbChlbDogSFRNTEVsZW1lbnQpOiBzdHJpbmcge1xuXHRpZiAoZWwgaW5zdGFuY2VvZiBIVE1MSW5wdXRFbGVtZW50IHx8IGVsIGluc3RhbmNlb2YgSFRNTFRleHRBcmVhRWxlbWVudCkge1xuXHRcdHJldHVybiBlbC52YWx1ZS50cmltKCk7XG5cdH1cblxuXHRyZXR1cm4gKFxuXHRcdGVsLmdldEF0dHJpYnV0ZShcImRhdGEtcHJvcGVydHkta2V5XCIpID8/XG5cdFx0ZWwuZ2V0QXR0cmlidXRlKFwiYXJpYS1sYWJlbFwiKSA/P1xuXHRcdGVsLmdldEF0dHJpYnV0ZShcInRpdGxlXCIpID8/XG5cdFx0ZWwudGV4dENvbnRlbnQgPz9cblx0XHRcIlwiXG5cdCkudHJpbSgpO1xufVxuXG5mdW5jdGlvbiBpc0VtcHR5RnJvbnRtYXR0ZXJWYWx1ZSh2YWx1ZTogdW5rbm93bik6IGJvb2xlYW4ge1xuXHRpZiAodmFsdWUgPT09IG51bGwgfHwgdmFsdWUgPT09IHVuZGVmaW5lZCkge1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cdGlmICh0eXBlb2YgdmFsdWUgPT09IFwic3RyaW5nXCIpIHtcblx0XHRyZXR1cm4gdmFsdWUudHJpbSgpLmxlbmd0aCA9PT0gMDtcblx0fVxuXHRpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcblx0XHRyZXR1cm4gdmFsdWUubGVuZ3RoID09PSAwIHx8IHZhbHVlLmV2ZXJ5KChpdGVtKSA9PiBpc0VtcHR5RnJvbnRtYXR0ZXJWYWx1ZShpdGVtKSk7XG5cdH1cblxuXHRyZXR1cm4gZmFsc2U7XG59XG5cbmZ1bmN0aW9uIGdldFZhdWx0Rm9sZGVycyhhcHA6IEFwcCk6IHN0cmluZ1tdIHtcblx0Y29uc3QgZm9sZGVycyA9IGFwcC52YXVsdFxuXHRcdC5nZXRBbGxMb2FkZWRGaWxlcygpXG5cdFx0LmZpbHRlcigoZmlsZSk6IGZpbGUgaXMgVEZvbGRlciA9PiBmaWxlIGluc3RhbmNlb2YgVEZvbGRlcilcblx0XHQubWFwKChmb2xkZXIpID0+IGZvbGRlci5wYXRoKVxuXHRcdC5zb3J0KChhLCBiKSA9PiBhLmxvY2FsZUNvbXBhcmUoYikpO1xuXG5cdHJldHVybiBbXCJcIiwgLi4uZm9sZGVycy5maWx0ZXIoKGZvbGRlcikgPT4gZm9sZGVyLmxlbmd0aCA+IDApXTtcbn1cblxuZnVuY3Rpb24gc2hvdWxkSW5jbHVkZVJ1bGVGb2xkZXIoZm9sZGVyOiBzdHJpbmcpOiBib29sZWFuIHtcblx0cmV0dXJuIGZvbGRlci5sZW5ndGggPiAwICYmIGZvbGRlciAhPT0gXCIub2JzaWRpYW5cIiAmJiAhZm9sZGVyLnN0YXJ0c1dpdGgoXCIub2JzaWRpYW4vXCIpO1xufVxuXG5mdW5jdGlvbiBmb3JtYXRGb2xkZXJPcHRpb25MYWJlbChmb2xkZXI6IHN0cmluZyk6IHN0cmluZyB7XG5cdGlmIChmb2xkZXIgPT09IFwiXCIpIHtcblx0XHRyZXR1cm4gXCIvXCI7XG5cdH1cblxuXHRjb25zdCBkZXB0aCA9IGdldEZvbGRlckRlcHRoKGZvbGRlcikgLSAxO1xuXHRjb25zdCBuYW1lID0gZm9sZGVyLnNwbGl0KFwiL1wiKS5wb3AoKSA/PyBmb2xkZXI7XG5cdHJldHVybiBgJHtcIlxcdTAwQTBcXHUwMEEwXFx1MDBBMFxcdTAwQTBcIi5yZXBlYXQoZGVwdGgpfSR7bmFtZX1gO1xufVxuXG5mdW5jdGlvbiBmb3JtYXRSdWxlSW5saW5lVmFsdWUodmFsdWU6IHN0cmluZyk6IHN0cmluZyB7XG5cdHJldHVybiB2YWx1ZS50cmltKCkubGVuZ3RoID4gMCA/IHZhbHVlIDogXCJfX19fX19cIjtcbn1cblxuZnVuY3Rpb24gdG9nZ2xlTW9kYWxTZWxlY3RQbGFjZWhvbGRlcihzZWxlY3RFbDogSFRNTFNlbGVjdEVsZW1lbnQsIGlzUGxhY2Vob2xkZXI6IGJvb2xlYW4pIHtcblx0c2VsZWN0RWwuY2xhc3NMaXN0LnRvZ2dsZShcImlzLXBsYWNlaG9sZGVyXCIsIGlzUGxhY2Vob2xkZXIpO1xufVxuXG5mdW5jdGlvbiBnZXRBbmNlc3RvclJ1bGVzKGZvbGRlcjogc3RyaW5nLCBydWxlczogRm9sZGVyRGVmYXVsdFJ1bGVbXSk6IEZvbGRlckRlZmF1bHRSdWxlW10ge1xuXHRyZXR1cm4gcnVsZXNcblx0XHQuZmlsdGVyKChydWxlKSA9PiB7XG5cdFx0XHRyZXR1cm4gcnVsZS52YWx1ZSAmJiBzaG91bGRJbmNsdWRlUnVsZUZvbGRlcihydWxlLmZvbGRlcikgJiYgcnVsZS5mb2xkZXIgIT09IGZvbGRlciAmJiBmb2xkZXJNYXRjaGVzKGZvbGRlciwgcnVsZS5mb2xkZXIpO1xuXHRcdH0pXG5cdFx0LnNvcnQoKGEsIGIpID0+IHtcblx0XHRcdGNvbnN0IGRlcHRoRGlmZiA9IGdldEZvbGRlckRlcHRoKGIuZm9sZGVyKSAtIGdldEZvbGRlckRlcHRoKGEuZm9sZGVyKTtcblx0XHRcdGlmIChkZXB0aERpZmYgIT09IDApIHtcblx0XHRcdFx0cmV0dXJuIGRlcHRoRGlmZjtcblx0XHRcdH1cblx0XHRcdHJldHVybiBhLmZvbGRlci5sb2NhbGVDb21wYXJlKGIuZm9sZGVyKSB8fCBhLmZpZWxkLmxvY2FsZUNvbXBhcmUoYi5maWVsZCk7XG5cdFx0fSk7XG59XG5cbmZ1bmN0aW9uIGZvcm1hdFJ1bGVBdWRpdChydWxlOiBGb2xkZXJEZWZhdWx0UnVsZSk6IHN0cmluZyB7XG5cdGlmICghcnVsZS5jcmVhdGVkQnkgfHwgIXJ1bGUuY3JlYXRlZEF0KSB7XG5cdFx0cmV0dXJuIFwi5Yib5bu65L+h5oGv5LiN5Y+v6L+95rqvXCI7XG5cdH1cblxuXHRjb25zdCBjcmVhdGVkID0gYOeUsSAke3J1bGUuY3JlYXRlZEJ5fSDliJvlu7rkuo4gJHtmb3JtYXRBdWRpdFRpbWUocnVsZS5jcmVhdGVkQXQpfWA7XG5cdGlmIChcblx0XHQhcnVsZS5tb2RpZmllZEJ5IHx8XG5cdFx0IXJ1bGUubW9kaWZpZWRBdCB8fFxuXHRcdChydWxlLm1vZGlmaWVkQnkgPT09IHJ1bGUuY3JlYXRlZEJ5ICYmIHJ1bGUubW9kaWZpZWRBdCA9PT0gcnVsZS5jcmVhdGVkQXQpXG5cdCkge1xuXHRcdHJldHVybiBjcmVhdGVkO1xuXHR9XG5cblx0cmV0dXJuIGAke2NyZWF0ZWR9IMK3ICR7cnVsZS5tb2RpZmllZEJ5fSDmnIDlkI7kv67mlLnkuo4gJHtmb3JtYXRBdWRpdFRpbWUocnVsZS5tb2RpZmllZEF0KX1gO1xufVxuXG5mdW5jdGlvbiBmb3JtYXRBdWRpdFRpbWUodmFsdWU6IHN0cmluZyk6IHN0cmluZyB7XG5cdHJldHVybiB2YWx1ZS5yZXBsYWNlKFwiVFwiLCBcIiBcIikuc2xpY2UoMCwgMTYpO1xufVxuXG5mdW5jdGlvbiBnZXREZXZpY2VVdWlkKCk6IHN0cmluZyB7XG5cdHRyeSB7XG5cdFx0aWYgKHByb2Nlc3MucGxhdGZvcm0gPT09IFwiZGFyd2luXCIpIHtcblx0XHRcdGNvbnN0IG91dHB1dCA9IHJlcXVpcmUoXCJjaGlsZF9wcm9jZXNzXCIpXG5cdFx0XHRcdC5leGVjU3luYyhcImlvcmVnIC1yZDEgLWMgSU9QbGF0Zm9ybUV4cGVydERldmljZVwiKVxuXHRcdFx0XHQudG9TdHJpbmcoKTtcblx0XHRcdGNvbnN0IG1hdGNoID0gL1wiSU9QbGF0Zm9ybVVVSURcIlxccyo9XFxzKlwiKFteXCJdKylcIi8uZXhlYyhvdXRwdXQpO1xuXHRcdFx0aWYgKG1hdGNoKSB7XG5cdFx0XHRcdHJldHVybiBtYXRjaFsxXTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gXCJ3aW4zMlwiKSB7XG5cdFx0XHRjb25zdCBvdXRwdXQgPSByZXF1aXJlKFwiY2hpbGRfcHJvY2Vzc1wiKS5leGVjU3luYyhcIndtaWMgY3Nwcm9kdWN0IGdldCBVVUlEXCIpLnRvU3RyaW5nKCk7XG5cdFx0XHRjb25zdCB1dWlkID0gb3V0cHV0XG5cdFx0XHRcdC5zcGxpdCgvXFxyP1xcbi8pXG5cdFx0XHRcdC5tYXAoKGxpbmU6IHN0cmluZykgPT4gbGluZS50cmltKCkpXG5cdFx0XHRcdC5maW5kKChsaW5lOiBzdHJpbmcpID0+IGxpbmUgJiYgbGluZS50b0xvd2VyQ2FzZSgpICE9PSBcInV1aWRcIik7XG5cdFx0XHRpZiAodXVpZCkge1xuXHRcdFx0XHRyZXR1cm4gdXVpZDtcblx0XHRcdH1cblx0XHR9XG5cdH0gY2F0Y2gge1xuXHRcdC8vIEZhbGwgYmFjayB0byBob3N0bmFtZSBiZWxvdy5cblx0fVxuXG5cdHJldHVybiByZXF1aXJlKFwib3NcIikuaG9zdG5hbWUoKTtcbn1cblxuZnVuY3Rpb24gZ2V0TGVnYWN5QXV0aG9yTmFtZShzZXR0aW5nczogQXV0b0Zyb250bWF0dGVyU2V0dGluZ3MpOiBzdHJpbmcge1xuXHRpZiAoc2V0dGluZ3MuYXV0aG9yTW9kZSA9PT0gQ1VTVE9NX0FVVEhPUl9NT0RFKSB7XG5cdFx0cmV0dXJuIHNldHRpbmdzLmF1dGhvckN1c3RvbSA/PyBcIlwiO1xuXHR9XG5cdHJldHVybiBzZXR0aW5ncy5hdXRob3JNb2RlIHx8IHNldHRpbmdzLmF1dGhvck5hbWUgfHwgXCJcIjtcbn1cblxuZnVuY3Rpb24gbWFza0RldmljZVV1aWQodXVpZDogc3RyaW5nKTogc3RyaW5nIHtcblx0Y29uc3QgcGFydHMgPSB1dWlkLnNwbGl0KFwiLVwiKTtcblx0aWYgKHBhcnRzLmxlbmd0aCAhPT0gNSkge1xuXHRcdHJldHVybiB1dWlkO1xuXHR9XG5cblx0Y29uc3QgbGFzdCA9IHBhcnRzWzRdO1xuXHRyZXR1cm4gYCR7cGFydHNbMF19LSoqKiotKioqKi0qKioqLSoqKioqKioqJHtsYXN0LnNsaWNlKC00KX1gO1xufVxuXG5mdW5jdGlvbiBnZXRGcm9udG1hdHRlckZpZWxkQ2FuZGlkYXRlcyhhcHA6IEFwcCwgZmllbGQ6IEZvbGRlckRlZmF1bHRGaWVsZCk6IHN0cmluZ1tdIHtcblx0Y29uc3QgdmFsdWVzID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cdGZvciAoY29uc3QgZmlsZSBvZiBhcHAudmF1bHQuZ2V0TWFya2Rvd25GaWxlcygpKSB7XG5cdFx0Y29uc3QgdmFsdWUgPSBhcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoZmlsZSk/LmZyb250bWF0dGVyPy5bZmllbGRdO1xuXHRcdGZvciAoY29uc3QgaXRlbSBvZiBub3JtYWxpemVDYW5kaWRhdGVWYWx1ZXModmFsdWUpKSB7XG5cdFx0XHR2YWx1ZXMuYWRkKGl0ZW0pO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiBBcnJheS5mcm9tKHZhbHVlcykuc29ydCgoYSwgYikgPT4gYS5sb2NhbGVDb21wYXJlKGIpKTtcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplQ2FuZGlkYXRlVmFsdWVzKHZhbHVlOiB1bmtub3duKTogc3RyaW5nW10ge1xuXHRpZiAodHlwZW9mIHZhbHVlID09PSBcInN0cmluZ1wiKSB7XG5cdFx0Y29uc3QgdHJpbW1lZCA9IHZhbHVlLnRyaW0oKTtcblx0XHRyZXR1cm4gdHJpbW1lZCA/IFt0cmltbWVkXSA6IFtdO1xuXHR9XG5cdGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuXHRcdHJldHVybiB2YWx1ZS5mbGF0TWFwKChpdGVtKSA9PiBub3JtYWxpemVDYW5kaWRhdGVWYWx1ZXMoaXRlbSkpO1xuXHR9XG5cdGlmICh2YWx1ZSA9PT0gbnVsbCB8fCB2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0cmV0dXJuIFtdO1xuXHR9XG5cdHJldHVybiBbU3RyaW5nKHZhbHVlKV07XG59XG5cbmZ1bmN0aW9uIGdldEZpbGVGb2xkZXIocGF0aDogc3RyaW5nKTogc3RyaW5nIHtcblx0Y29uc3Qgc2xhc2ggPSBwYXRoLmxhc3RJbmRleE9mKFwiL1wiKTtcblx0cmV0dXJuIHNsYXNoID09PSAtMSA/IFwiXCIgOiBwYXRoLnNsaWNlKDAsIHNsYXNoKTtcbn1cblxuZnVuY3Rpb24gZm9sZGVyTWF0Y2hlcyhmaWxlRm9sZGVyOiBzdHJpbmcsIHJ1bGVGb2xkZXI6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRyZXR1cm4gcnVsZUZvbGRlciA9PT0gXCJcIiB8fCBmaWxlRm9sZGVyID09PSBydWxlRm9sZGVyIHx8IGZpbGVGb2xkZXIuc3RhcnRzV2l0aChgJHtydWxlRm9sZGVyfS9gKTtcbn1cblxuZnVuY3Rpb24gZ2V0Rm9sZGVyRGVwdGgoZm9sZGVyOiBzdHJpbmcpOiBudW1iZXIge1xuXHRyZXR1cm4gZm9sZGVyID09PSBcIlwiID8gMCA6IGZvbGRlci5zcGxpdChcIi9cIikubGVuZ3RoO1xufVxuXG5mdW5jdGlvbiB1cGRhdGVGcm9udG1hdHRlclVwZGF0ZWQoY29udGVudDogc3RyaW5nLCB1cGRhdGVkOiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcblx0aWYgKCFjb250ZW50LnN0YXJ0c1dpdGgoXCItLS1cXG5cIikpIHtcblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdGNvbnN0IGVuZCA9IGNvbnRlbnQuaW5kZXhPZihcIlxcbi0tLVwiLCA0KTtcblx0aWYgKGVuZCA9PT0gLTEpIHtcblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdGNvbnN0IGZyb250bWF0dGVyID0gY29udGVudC5zbGljZSgwLCBlbmQgKyAxKTtcblx0Y29uc3QgdXBkYXRlZExpbmUgPSAvXuacgOWQjuabtOaWsDpcXHMqLiokL207XG5cdGlmICghdXBkYXRlZExpbmUudGVzdChmcm9udG1hdHRlcikpIHtcblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdGNvbnN0IG5leHRGcm9udG1hdHRlciA9IGZyb250bWF0dGVyLnJlcGxhY2UodXBkYXRlZExpbmUsIGDmnIDlkI7mm7TmlrA6ICR7dXBkYXRlZH1gKTtcblx0cmV0dXJuIG5leHRGcm9udG1hdHRlciArIGNvbnRlbnQuc2xpY2UoZW5kICsgMSk7XG59XG5cbmZ1bmN0aW9uIGZvcm1hdExvY2FsRGF0ZShkYXRlOiBEYXRlKTogc3RyaW5nIHtcblx0Y29uc3QgeWVhciA9IGRhdGUuZ2V0RnVsbFllYXIoKTtcblx0Y29uc3QgbW9udGggPSBwYWQoZGF0ZS5nZXRNb250aCgpICsgMSk7XG5cdGNvbnN0IGRheSA9IHBhZChkYXRlLmdldERhdGUoKSk7XG5cdGNvbnN0IGhvdXIgPSBwYWQoZGF0ZS5nZXRIb3VycygpKTtcblx0Y29uc3QgbWludXRlID0gcGFkKGRhdGUuZ2V0TWludXRlcygpKTtcblx0Y29uc3Qgc2Vjb25kID0gcGFkKGRhdGUuZ2V0U2Vjb25kcygpKTtcblx0cmV0dXJuIGAke3llYXJ9LSR7bW9udGh9LSR7ZGF5fVQke2hvdXJ9OiR7bWludXRlfToke3NlY29uZH1gO1xufVxuXG5mdW5jdGlvbiBwYWQodmFsdWU6IG51bWJlcik6IHN0cmluZyB7XG5cdHJldHVybiB2YWx1ZS50b1N0cmluZygpLnBhZFN0YXJ0KDIsIFwiMFwiKTtcbn1cblxuZnVuY3Rpb24gZm9ybWF0WWFtbFNjYWxhcih2YWx1ZTogc3RyaW5nKTogc3RyaW5nIHtcblx0aWYgKCF2YWx1ZSkge1xuXHRcdHJldHVybiBcIlwiO1xuXHR9XG5cblx0cmV0dXJuIEpTT04uc3RyaW5naWZ5KHZhbHVlKTtcbn1cblxuZnVuY3Rpb24geWllbGRUb1VpKCk6IFByb21pc2U8dm9pZD4ge1xuXHRyZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcblx0XHR3aW5kb3cuc2V0VGltZW91dChyZXNvbHZlLCAwKTtcblx0fSk7XG59XG4iXX0=