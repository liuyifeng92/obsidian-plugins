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
    autoUpdate: true,
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
        this.autoUpdateCheckTimer = null;
        this.pendingAutoReloadTimer = null;
        this.pendingAutoReloadVersion = "";
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
        this.scheduleAutoUpdateCheck();
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
        this.clearAutoUpdateCheckTimer();
        this.clearPendingAutoReloadTimer();
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
        await this.downloadAndWriteUpdateFiles(version, onProgress);
        await this.reloadPlugin(version, false);
    }
    async downloadAndWriteUpdateFiles(version, onProgress) {
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
    }
    async reloadPlugin(version, auto = false) {
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
        new obsidian_1.Notice(auto ? `发现新版本（${version}），正在自动更新...` : `更新完成（${version}），正在重载插件...`);
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
                new obsidian_1.Notice(auto ? `插件已自动更新到 ${version}` : `插件已重载到 ${version}`);
            }
            catch (e) {
                console.error("[auto-frontmatter] 重载失败:", e);
                new obsidian_1.Notice("自动重载失败，请点击已安装插件页的「重新加载插件」按钮");
            }
        }, 100);
    }
    watchPendingAutoReload() {
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
    clearAutoUpdateCheckTimer() {
        if (this.autoUpdateCheckTimer !== null) {
            window.clearTimeout(this.autoUpdateCheckTimer);
            this.autoUpdateCheckTimer = null;
        }
    }
    clearPendingAutoReloadTimer() {
        if (this.pendingAutoReloadTimer !== null) {
            window.clearInterval(this.pendingAutoReloadTimer);
            this.pendingAutoReloadTimer = null;
        }
    }
    scheduleAutoUpdateCheck() {
        this.clearAutoUpdateCheckTimer();
        this.autoUpdateCheckTimer = window.setTimeout(() => {
            void this.runAutoUpdateCheck();
            this.registerInterval(window.setInterval(() => {
                void this.runAutoUpdateCheck();
            }, 60 * 60 * 1000));
        }, 30 * 1000);
    }
    async runAutoUpdateCheck() {
        if (!this.settings.autoUpdate) {
            return;
        }
        const result = await this.checkForUpdate();
        if (result.error || !result.hasUpdate) {
            return;
        }
        void this.performAutoUpdate(result.version);
    }
    async performAutoUpdate(version) {
        try {
            new obsidian_1.Notice(`发现新版本 ${version}，正在自动更新...`);
            await this.downloadAndWriteUpdateFiles(version);
            await this.reloadPlugin(version, true);
        }
        catch (error) {
            console.error("[auto-frontmatter] 自动更新失败:", error);
        }
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
        containerEl.createEl("h3", { text: "自动更新", cls: "auto-frontmatter-about-config-title" });
        new obsidian_1.Setting(containerEl)
            .setName("自动检查更新")
            .setDesc("每 60 分钟自动检查并更新到最新版本。")
            .addToggle((toggle) => toggle.setValue(this.plugin.settings.autoUpdate).onChange(async (value) => {
            this.plugin.settings.autoUpdate = value;
            await this.plugin.saveSettings();
        }));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm1haW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSx1Q0Fja0I7QUErQ2xCLE1BQU0sMEJBQTBCLEdBQUcsS0FBSyxDQUFDO0FBQ3pDLE1BQU0sNkJBQTZCLEdBQUcsRUFBRSxHQUFHLElBQUksQ0FBQztBQUNoRCxNQUFNLDJCQUEyQixHQUFHLElBQUksQ0FBQztBQUN6QyxNQUFNLHVCQUF1QixHQUFHLEVBQUUsQ0FBQztBQUNuQyxNQUFNLGNBQWMsR0FBRyxDQUFDLENBQUM7QUFDekIsTUFBTSxxQkFBcUIsR0FBRzs7Ozs7Ozs7OztVQVVwQixDQUFDO0FBQ1gsTUFBTSwwQkFBMEIsR0FBRzs7Ozs7Ozs7Ozs7Ozs7OztVQWdCekIsQ0FBQztBQUNYLE1BQU0seUJBQXlCLEdBQUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztVQThCeEIsQ0FBQztBQUVYLE1BQU0sZ0JBQWdCLEdBQTRCO0lBQ2pELFFBQVEsRUFBRSxFQUFFO0lBQ1osUUFBUSxFQUFFLHNDQUFzQztJQUNoRCxXQUFXLEVBQUUsZ0JBQWdCO0lBQzdCLGdCQUFnQixFQUFFLElBQUk7SUFDdEIsZUFBZSxFQUFFLHlCQUF5QjtJQUMxQyxjQUFjLEVBQUUsRUFBRTtJQUNsQixtQkFBbUIsRUFBRSxJQUFJO0lBQ3pCLGNBQWMsRUFBRSxFQUFFO0lBQ2xCLG1CQUFtQixFQUFFLEtBQUs7SUFDMUIsVUFBVSxFQUFFLElBQUk7Q0FDaEIsQ0FBQztBQUVGLE1BQU0sY0FBYyxHQUFHO0lBQ3RCLEtBQUs7SUFDTCxLQUFLO0lBQ0wsS0FBSztJQUNMLEtBQUs7SUFDTCxJQUFJO0lBQ0osS0FBSztJQUNMLEtBQUs7SUFDTCxLQUFLO0NBQ0ksQ0FBQztBQUNYLE1BQU0sa0JBQWtCLEdBQUcsS0FBSyxDQUFDO0FBRWpDLE1BQU0sZUFBZSxHQUFHLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLE1B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QUksSUFBSSxLQUFLLElBQUksR0FBRyxJQUFJLElBQUksSUFBSSxNQUFNLElBQUksTUFBTSxFQUFFLENBQUM7QUFDOUQsQ0FBQztBQUVELFNBQVMsR0FBRyxDQUFDLEtBQWE7SUFDekIsT0FBTyxLQUFLLENBQUMsUUFBUSxFQUFFLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQztBQUMxQyxDQUFDO0FBRUQsU0FBUyxnQkFBZ0IsQ0FBQyxLQUFhO0lBQ3RDLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUNaLE9BQU8sRUFBRSxDQUFDO0lBQ1gsQ0FBQztJQUVELE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUM5QixDQUFDO0FBRUQsU0FBUyxTQUFTO0lBQ2pCLE9BQU8sSUFBSSxPQUFPLENBQUMsQ0FBQyxPQUFPLEVBQUUsRUFBRTtRQUM5QixNQUFNLENBQUMsVUFBVSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQztJQUMvQixDQUFDLENBQUMsQ0FBQztBQUNKLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge1xuXHRBcHAsXG5cdEVkaXRvcixcblx0TWVudSxcblx0TWFya2Rvd25WaWV3LFxuXHRNb2RhbCxcblx0Tm90aWNlLFxuXHRQbHVnaW4sXG5cdFBsdWdpblNldHRpbmdUYWIsXG5cdFNldHRpbmcsXG5cdHNldEljb24sXG5cdFRBYnN0cmFjdEZpbGUsXG5cdFRGaWxlLFxuXHRURm9sZGVyLFxufSBmcm9tIFwib2JzaWRpYW5cIjtcblxuaW50ZXJmYWNlIEF1dG9Gcm9udG1hdHRlclNldHRpbmdzIHtcblx0YXV0aG9yTW9kZT86IHN0cmluZztcblx0YXV0aG9yQ3VzdG9tPzogc3RyaW5nO1xuXHRhdXRob3JOYW1lPzogc3RyaW5nO1xuXHRhaUFwaUtleTogc3RyaW5nO1xuXHRhaUFwaVVybDogc3RyaW5nO1xuXHRhaU1vZGVsTmFtZTogc3RyaW5nO1xuXHRhaVN1bW1hcnlFbmFibGVkOiBib29sZWFuO1xuXHRhaVN1bW1hcnlQcm9tcHQ6IHN0cmluZztcblx0ZGV2aWNlQmluZGluZ3M6IERldmljZUF1dGhvckJpbmRpbmdbXTtcblx0ZW1wdHlGaWVsZEhpZ2hsaWdodDogYm9vbGVhbjtcblx0Zm9sZGVyRGVmYXVsdHM6IEZvbGRlckRlZmF1bHRSdWxlW107XG5cdHNob3dGb2xkZXJDaGVja21hcms6IGJvb2xlYW47XG5cdGF1dG9VcGRhdGU6IGJvb2xlYW47XG59XG5cbmludGVyZmFjZSBTdW1tYXJ5U2VydmljZSB7XG5cdGdlbmVyYXRlU3VtbWFyeShkb2N1bWVudDogU3VtbWFyeURvY3VtZW50KTogUHJvbWlzZTxzdHJpbmc+O1xufVxuXG5pbnRlcmZhY2UgU3VtbWFyeURvY3VtZW50IHtcblx0dGl0bGU6IHN0cmluZztcblx0ZnJvbnRtYXR0ZXI6IHN0cmluZztcblx0Y29udGVudDogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgRGV2aWNlQXV0aG9yQmluZGluZyB7XG5cdHV1aWQ6IHN0cmluZztcblx0YXV0aG9yOiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBGb2xkZXJEZWZhdWx0UnVsZSB7XG5cdGZvbGRlcjogc3RyaW5nO1xuXHRmaWVsZDogRm9sZGVyRGVmYXVsdEZpZWxkO1xuXHR2YWx1ZTogc3RyaW5nO1xuXHRjcmVhdGVkQnk/OiBzdHJpbmc7XG5cdGNyZWF0ZWRBdD86IHN0cmluZztcblx0bW9kaWZpZWRCeT86IHN0cmluZztcblx0bW9kaWZpZWRBdD86IHN0cmluZztcblx0ZmllbGRzPzogQXJyYXk8e1xuXHRcdGZpZWxkOiBGb2xkZXJEZWZhdWx0RmllbGQ7XG5cdFx0dmFsdWU6IHN0cmluZztcblx0fT47XG59XG5cbmNvbnN0IE1BWF9TVU1NQVJZX0NPTlRFTlRfTEVOR1RIID0gMTYwMDA7XG5jb25zdCBBSV9TVU1NQVJZX1NDSEVEVUxFUl9DSEVDS19NUyA9IDYwICogMTAwMDtcbmNvbnN0IEFJX1NVTU1BUllfUkVRVUVTVF9ERUxBWV9NUyA9IDIwMDA7XG5jb25zdCBNSU5fU1VNTUFSWV9CT0RZX0xFTkdUSCA9IDUwO1xuY29uc3QgUlVMRVNfUEVSX1BBR0UgPSA2O1xuY29uc3QgT0xEX0FJX1NVTU1BUllfUFJPTVBUID0gYOS9oOaYr+S4gOS9jeS4k+S4mueahOaWh+aho+aRmOimgeWKqeaJi+OAguivt+WvueS7peS4i+aWh+aho+WGheWuueeUn+aIkOS4gOauteeugOa0geeahOaRmOimgeOAglxuXG7opoHmsYLvvJpcbjEuIOS4gOauteivneamguaLrO+8jOS4jei2hei/hyAxMDAg5a2XXG4yLiDmj5DngrzmoLjlv4PkuLvpopjjgIHlhbPplK7nu5PorrrmiJbkuLvopoHlhrPnrZZcbjMuIOS4jeimgeWHuueOsFwi5pys5paHXCLjgIFcIui/meevh+aWh+aho1wi562J5oyH5Luj6K+N77yM55u05o6l6ZmI6L+w5YaF5a65XG40LiDlpoLmnpzmlofmoaPljIXlkKvlm77niYfmj4/ov7DmiJbku6PnoIHniYfmrrXvvIzkvqfph43mgLvnu5PlhbbmhI/lm77ogIzpnZ7nu4boioJcbjUuIOS9v+eUqOS4juWOn+aWh+S4gOiHtOeahOivreiogO+8iOS4reaWh+aWh+aho+eUqOS4reaWh++8jOiLseaWh+aWh+aho+eUqOiLseaWh++8iVxuXG7mlofmoaPlhoXlrrnvvJpcbntjb250ZW50fWA7XG5jb25zdCBQUkVWSU9VU19BSV9TVU1NQVJZX1BST01QVCA9IGDkvaDmmK/kuIDkvY3kuJPkuJrnmoTmlofmoaPmkZjopoHliqnmiYvjgILor7fmoLnmja7ku6XkuIvmlofmoaPnmoTmoIfpopjjgIHlsZ7mgKflkozmraPmloflhoXlrrnvvIznlJ/miJDkuIDmrrXnroDmtIHnmoTkuK3mlofmkZjopoHjgIJcblxu6KaB5rGC77yaXG4xLiDkuIDmrrXor53mpoLmi6zvvIwzMCDliLAgMTQwIOWtl+S5i+mXtFxuMi4g5o+Q54K85qC45b+D5Li76aKY44CB5YWz6ZSu57uT6K665oiW5Li76KaB5Yaz562WXG4zLiDkuI3opoHlh7rnjrBcIuacrOaWh1wi44CBXCLov5nnr4fmlofmoaNcIuetieaMh+S7o+ivje+8jOebtOaOpemZiOi/sOWGheWuuVxuNC4g5aaC5p6c5paH5qGj5YyF5ZCr5Zu+54mH5o+P6L+w5oiW5Luj56CB54mH5q6177yM5L6n6YeN5oC757uT5YW25oSP5Zu+6ICM6Z2e57uG6IqCXG41LiDml6Dorrrljp/mlofmmK/ku4DkuYjor63oqIDvvIzkuIDlvovkvb/nlKjkuK3mlofovpPlh7pcblxu5paH5qGj5qCH6aKY77yaXG57dGl0bGV9XG5cbuaWh+aho+WxnuaAp++8mlxue2Zyb250bWF0dGVyfVxuXG7mlofmoaPmraPmlofvvJpcbntjb250ZW50fWA7XG5jb25zdCBERUZBVUxUX0FJX1NVTU1BUllfUFJPTVBUID0gYOivt+S4uuS7peS4i+WGheWuueWGmeS4gOauteaRmOimgeOAglxuXG7op4TliJnvvJpcbjEuIDMwIOWIsCAxNDAg5a2X77yM5LiA5q616K+d77yM5LiN5o2i6KGMXG4yLiDnlKjkuK3mloflhplcbjMuIOS7peWGheWuueacrOi6q+eahOWPo+WQu+amguaLrO+8jOWDj+aYr+i/meauteWGheWuueeahOW8gOWktOWvvOivrVxuNC4g55u05o6l6ZmI6L+w5qC45b+D5L+h5oGv77ya5YGa5LqG5LuA5LmI44CB6Kej5Yaz5LqG5LuA5LmI44CB5b6X5Ye65LqG5LuA5LmI57uT6K66XG41LiDnpoHmraLkvb/nlKjjgIzmnKzmlofjgI3jgIzor6XmlofmoaPjgI3jgIzov5nnr4fnrJTorrDjgI3jgIzkvZzogIXjgI3nrYnmjIfku6Por41cbjYuIOemgeatouS9v+eUqOOAjOS7i+e7jeS6huOAjeOAjOmYkOi/sOS6huOAjeOAjOaPj+i/sOS6huOAjeOAjOiuqOiuuuS6huOAjeOAjOaOouiuqOS6huOAjei/meexu+WFg+WPmei/sOWKqOivjVxuNy4g5aaC5p6c5YaF5a655piv5Lya6K6u57qq6KaB77yM5o+Q54K85YWz6ZSu5Yaz562W5ZKM5b6F5YqeXG44LiDlpoLmnpzlhoXlrrnmmK/mioDmnK/mlrnmoYjvvIzmj5Dngrznm67moIfjgIHmlrnmoYjopoHngrnlkozmoLjlv4PnuqbmnZ9cbjkuIOWmguaenOWGheWuueW+iOefreaIluS/oeaBr+WvhuW6puS9ju+8jOaRmOimgeWPr+S7peefreS6jiAzMCDlrZfvvIzkvYbkuI3opoHms6jmsLRcblxu5aW955qE5pGY6KaB56S65L6L77yaXG4tIOOAjOmAmui/h+aLhuWIhummluWxj+WKoOi9vei1hOa6kOW5tuW8leWFpemqqOaetuWxj++8jOWwhuWwj+aciOS6ruWGt+WQr+WKqOaXtumXtOS7jiAzLjJzIOmZjeiHsyAxLjFz77yM5ZCM5pe25L+u5aSN5LqGIGlPUyDnq6/nmb3lsY/pl6rng4Hpl67popjjgILjgI1cbi0g44CM56Gu6K6kIFEzIOWinumVv+ebruagh+S4uiBEQVUg57+75YCN77yM5Li76KaB6Lev5b6E5Li657qi5YyF6KOC5Y+YICsg5YaF5a6556S+5Yy65Ya35ZCv5Yqo77yM6aKE566X5LiK6ZmQIDUwIOS4h+OAguOAjVxuLSDjgIzmorPnkIbkuoYgT3dsZW4g5o6o6I2Q566X5rOV5LuO5Y2P5ZCM6L+H5ruk6L+B56e75Yiw5Y+M5aGU5qih5Z6L55qE5oqA5pyv6Lev5b6E77yM6YeN54K56Kej5Yaz5Ya35ZCv5Yqo5Zy65pmv5LiL55qE5Y+s5Zue546H6Zeu6aKY44CC44CNXG5cbuW3rueahOaRmOimgeekuuS+i++8iOemgeatou+8ie+8mlxuLSDinJfjgIzmnKzmlofku4vnu43kuobkuIDnp43kvJjljJblhrflkK/liqjnmoTmlrnms5UuLi7jgI3vvIjlhYPlj5nov7AgKyDmjIfku6Por43vvIlcbi0g4pyX44CM6K+l5paH5qGj6K6o6K665LqG5YWz5LqO5aKe6ZW/55uu5qCH55qE55u45YWz5YaF5a65Li4u44CN77yI5qih57OKICsg5oyH5Luj6K+N77yJXG4tIOKcl+OAjOi/meaYr+S4gOevh+WFs+S6juaOqOiNkOeul+azleeahOaKgOacr+aWh+ahoy4uLuOAje+8iOW6n+ivne+8iVxuXG4tLS1cbuagh+mimO+8mnt0aXRsZX1cblxu5bGe5oCn77yaXG57ZnJvbnRtYXR0ZXJ9XG5cbuato+aWh++8mlxue2NvbnRlbnR9YDtcblxuY29uc3QgREVGQVVMVF9TRVRUSU5HUzogQXV0b0Zyb250bWF0dGVyU2V0dGluZ3MgPSB7XG5cdGFpQXBpS2V5OiBcIlwiLFxuXHRhaUFwaVVybDogXCJodHRwczovL2FwaS5zdGVwZnVuLmNvbS9zdGVwX3BsYW4vdjFcIixcblx0YWlNb2RlbE5hbWU6IFwic3RlcC0zLjctZmxhc2hcIixcblx0YWlTdW1tYXJ5RW5hYmxlZDogdHJ1ZSxcblx0YWlTdW1tYXJ5UHJvbXB0OiBERUZBVUxUX0FJX1NVTU1BUllfUFJPTVBULFxuXHRkZXZpY2VCaW5kaW5nczogW10sXG5cdGVtcHR5RmllbGRIaWdobGlnaHQ6IHRydWUsXG5cdGZvbGRlckRlZmF1bHRzOiBbXSxcblx0c2hvd0ZvbGRlckNoZWNrbWFyazogZmFsc2UsXG5cdGF1dG9VcGRhdGU6IHRydWUsXG59O1xuXG5jb25zdCBBVVRIT1JfT1BUSU9OUyA9IFtcblx0XCLpmYjmmZPnkKZcIixcblx0XCLokaPmgZLmlodcIixcblx0XCLliJjkuIDplItcIixcblx0XCLnjovkuprlhptcIixcblx0XCLmnajnoZVcIixcblx0XCLlkajmraPpo55cIixcblx0XCLluoTpnZblrodcIixcblx0XCLoh6rlrprkuYlcIixcbl0gYXMgY29uc3Q7XG5jb25zdCBDVVNUT01fQVVUSE9SX01PREUgPSBcIuiHquWumuS5iVwiO1xuXG5jb25zdCBSRVFVSVJFRF9GSUVMRFMgPSBbXCLpobnnm65cIiwgXCLnsbvlnotcIiwgXCLkvZzogIVcIiwgXCLmkZjopoFcIiwgXCLliJvlu7rml7bpl7RcIiwgXCLmnIDlkI7mm7TmlrBcIl0gYXMgY29uc3Q7XG50eXBlIFJlcXVpcmVkRmllbGQgPSAodHlwZW9mIFJFUVVJUkVEX0ZJRUxEUylbbnVtYmVyXTtcbmNvbnN0IEhJR0hMSUdIVF9GSUVMRFMgPSBbXCLpobnnm65cIiwgXCLnsbvlnotcIiwgXCLkvZzogIVcIiwgXCLliJvlu7rml7bpl7RcIiwgXCLmnIDlkI7mm7TmlrBcIl0gYXMgY29uc3Q7XG50eXBlIEhpZ2hsaWdodEZpZWxkID0gKHR5cGVvZiBISUdITElHSFRfRklFTERTKVtudW1iZXJdO1xuY29uc3QgRk9MREVSX0RFRkFVTFRfRklFTERTID0gW1wi6aG555uuXCIsIFwi57G75Z6LXCJdIGFzIGNvbnN0O1xudHlwZSBGb2xkZXJEZWZhdWx0RmllbGQgPSAodHlwZW9mIEZPTERFUl9ERUZBVUxUX0ZJRUxEUylbbnVtYmVyXTtcbnR5cGUgRm9sZGVyRGVmYXVsdFZhbHVlcyA9IFBhcnRpYWw8UmVjb3JkPEZvbGRlckRlZmF1bHRGaWVsZCwgc3RyaW5nPj47XG5jb25zdCBTRVRUSU5HX1RBQlMgPSBbXCLpgJrnlKhcIiwgXCLmlofku7blpLnop4TliJlcIiwgXCJBSeaRmOimgVwiLCBcIuaJq+aPj+S7k+W6k1wiLCBcIuiuvuWkh+e7keWumlwiLCBcIueJiOacrOabtOaWsFwiXSBhcyBjb25zdDtcbnR5cGUgU2V0dGluZ1RhYklkID0gKHR5cGVvZiBTRVRUSU5HX1RBQlMpW251bWJlcl07XG5jb25zdCBHSVRIVUJfUkFXX0JBU0UgPSBcImh0dHBzOi8vcmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbS9saXV5aWZlbmc5Mi9vYnNpZGlhbi1wbHVnaW5zL21haW4vYXV0by1mcm9udG1hdHRlclwiO1xudHlwZSBBSVN1bW1hcnlUYXNrVHlwZSA9IFwiY29tcGxldGlvblwiO1xuY29uc3QgTEVHQUNZX0ZJRUxEX1JFTkFNRVMgPSB7XG5cdGNyZWF0ZWQ6IFwi5Yib5bu65pe26Ze0XCIsXG5cdHVwZGF0ZWQ6IFwi5pyA5ZCO5pu05pawXCIsXG59IGFzIGNvbnN0O1xudHlwZSBMZWdhY3lGaWVsZCA9IGtleW9mIHR5cGVvZiBMRUdBQ1lfRklFTERfUkVOQU1FUztcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgQXV0b0Zyb250bWF0dGVyUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcblx0c2V0dGluZ3M6IEF1dG9Gcm9udG1hdHRlclNldHRpbmdzO1xuXHRjdXJyZW50RGV2aWNlVXVpZCA9IFwiXCI7XG5cdHNldHRpbmdUYWI6IEF1dG9Gcm9udG1hdHRlclNldHRpbmdUYWIgfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSB1cGRhdGVUaW1lcjogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG5cdHByaXZhdGUgdXBkYXRlRmlsZVBhdGg6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIGNyZWF0ZVRpbWVycyA9IG5ldyBTZXQ8bnVtYmVyPigpO1xuXHRwcml2YXRlIGhpZ2hsaWdodFRpbWVyOiBudW1iZXIgfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSBoaWdobGlnaHRJbnRlcnZhbDogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG5cdHByaXZhdGUgaGlnaGxpZ2h0RmlsZVBhdGg6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIGZvbGRlckNoZWNrbWFya1RpbWVyOiBudW1iZXIgfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSBhaUJ1dHRvblRpbWVyOiBudW1iZXIgfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSBhaVN1bW1hcnlBYm9ydENvbnRyb2xsZXI6IEFib3J0Q29udHJvbGxlciB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIGFpU3VtbWFyeUNvbXBsZXRpb25SdW5uaW5nID0gZmFsc2U7XG5cdHByaXZhdGUgbGFzdEFJU3VtbWFyeVNjaGVkdWxlU2xvdCA9IFwiXCI7XG5cdHByaXZhdGUgYXV0b1VwZGF0ZUNoZWNrVGltZXI6IG51bWJlciB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIHBlbmRpbmdBdXRvUmVsb2FkVGltZXI6IG51bWJlciB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIHBlbmRpbmdBdXRvUmVsb2FkVmVyc2lvbiA9IFwiXCI7XG5cblx0YXN5bmMgb25sb2FkKCkge1xuXHRcdGF3YWl0IHRoaXMubG9hZFNldHRpbmdzKCk7XG5cblx0XHR0aGlzLnNldHRpbmdUYWIgPSBuZXcgQXV0b0Zyb250bWF0dGVyU2V0dGluZ1RhYih0aGlzLmFwcCwgdGhpcyk7XG5cdFx0dGhpcy5hZGRTZXR0aW5nVGFiKHRoaXMuc2V0dGluZ1RhYik7XG5cblx0XHR0aGlzLnJlZ2lzdGVyRXZlbnQoXG5cdFx0XHR0aGlzLmFwcC52YXVsdC5vbihcImNyZWF0ZVwiLCAoZmlsZSkgPT4ge1xuXHRcdFx0XHR0aGlzLmhhbmRsZUNyZWF0ZShmaWxlKTtcblx0XHRcdH0pLFxuXHRcdCk7XG5cblx0XHR0aGlzLnJlZ2lzdGVyRXZlbnQoXG5cdFx0XHR0aGlzLmFwcC52YXVsdC5vbihcInJlbmFtZVwiLCAoZmlsZSwgb2xkUGF0aCkgPT4ge1xuXHRcdFx0XHR0aGlzLmhhbmRsZVJlbmFtZShmaWxlLCBvbGRQYXRoKTtcblx0XHRcdH0pLFxuXHRcdCk7XG5cblx0XHR0aGlzLnJlZ2lzdGVyRXZlbnQoXG5cdFx0XHR0aGlzLmFwcC53b3Jrc3BhY2Uub24oXCJmaWxlLW1lbnVcIiwgKG1lbnU6IE1lbnUsIGZpbGU6IFRBYnN0cmFjdEZpbGUpID0+IHtcblx0XHRcdFx0dGhpcy5oYW5kbGVGaWxlTWVudShtZW51LCBmaWxlKTtcblx0XHRcdH0pLFxuXHRcdCk7XG5cblx0XHR0aGlzLnJlZ2lzdGVyRXZlbnQoXG5cdFx0XHR0aGlzLmFwcC53b3Jrc3BhY2Uub24oXCJlZGl0b3ItY2hhbmdlXCIsIChfZWRpdG9yOiBFZGl0b3IsIHZpZXc6IE1hcmtkb3duVmlldykgPT4ge1xuXHRcdFx0XHR0aGlzLnNjaGVkdWxlVXBkYXRlZEZpZWxkUmVmcmVzaCh2aWV3LmZpbGUpO1xuXHRcdFx0fSksXG5cdFx0KTtcblxuXHRcdHRoaXMucmVnaXN0ZXJFdmVudChcblx0XHRcdHRoaXMuYXBwLndvcmtzcGFjZS5vbihcImFjdGl2ZS1sZWFmLWNoYW5nZVwiLCAoKSA9PiB7XG5cdFx0XHRcdHRoaXMuc2NoZWR1bGVFbXB0eUZpZWxkSGlnaGxpZ2h0Q2hlY2soKTtcblx0XHRcdFx0dGhpcy5zY2hlZHVsZUFJU3VtbWFyeUJ1dHRvblJlZnJlc2goKTtcblx0XHRcdH0pLFxuXHRcdCk7XG5cblx0XHR0aGlzLnJlZ2lzdGVyRXZlbnQoXG5cdFx0XHR0aGlzLmFwcC53b3Jrc3BhY2Uub24oXCJsYXlvdXQtY2hhbmdlXCIsICgpID0+IHtcblx0XHRcdFx0dGhpcy5zY2hlZHVsZUVtcHR5RmllbGRIaWdobGlnaHRDaGVjaygpO1xuXHRcdFx0XHR0aGlzLnNjaGVkdWxlQUlTdW1tYXJ5QnV0dG9uUmVmcmVzaCgpO1xuXHRcdFx0XHR0aGlzLnNjaGVkdWxlRm9sZGVyQ2hlY2ttYXJrUmVmcmVzaCgpO1xuXHRcdFx0fSksXG5cdFx0KTtcblxuXHRcdHRoaXMucmVnaXN0ZXJJbnRlcnZhbCh3aW5kb3cuc2V0SW50ZXJ2YWwoKCkgPT4ge1xuXHRcdFx0dGhpcy5jaGVja0FJU3VtbWFyeVNjaGVkdWxlKCk7XG5cdFx0fSwgQUlfU1VNTUFSWV9TQ0hFRFVMRVJfQ0hFQ0tfTVMpKTtcblxuXHRcdHRoaXMuc2NoZWR1bGVFbXB0eUZpZWxkSGlnaGxpZ2h0Q2hlY2soKTtcblx0XHR0aGlzLnNjaGVkdWxlQUlTdW1tYXJ5QnV0dG9uUmVmcmVzaCgpO1xuXHRcdHRoaXMuc2NoZWR1bGVGb2xkZXJDaGVja21hcmtSZWZyZXNoKCk7XG5cdFx0dGhpcy5zY2hlZHVsZUF1dG9VcGRhdGVDaGVjaygpO1xuXHR9XG5cblx0b251bmxvYWQoKSB7XG5cdFx0dGhpcy5jbGVhclVwZGF0ZVRpbWVyKCk7XG5cdFx0dGhpcy5jbGVhckhpZ2hsaWdodFRpbWVycygpO1xuXHRcdHRoaXMuY2xlYXJFbXB0eUZpZWxkSGlnaGxpZ2h0cygpO1xuXHRcdHRoaXMuY2xlYXJBSVN1bW1hcnlCdXR0b25UaW1lcigpO1xuXHRcdHRoaXMuY2xlYXJBSVN1bW1hcnlCdXR0b25zKCk7XG5cdFx0dGhpcy5hYm9ydEFJU3VtbWFyeVN0cmVhbSgpO1xuXHRcdHRoaXMuY2xlYXJGb2xkZXJDaGVja21hcmtUaW1lcigpO1xuXHRcdHRoaXMuY2xlYXJGb2xkZXJDaGVja21hcmtzKCk7XG5cdFx0Zm9yIChjb25zdCB0aW1lciBvZiB0aGlzLmNyZWF0ZVRpbWVycykge1xuXHRcdFx0d2luZG93LmNsZWFyVGltZW91dCh0aW1lcik7XG5cdFx0fVxuXHRcdHRoaXMuY3JlYXRlVGltZXJzLmNsZWFyKCk7XG5cdFx0dGhpcy5jbGVhckF1dG9VcGRhdGVDaGVja1RpbWVyKCk7XG5cdFx0dGhpcy5jbGVhclBlbmRpbmdBdXRvUmVsb2FkVGltZXIoKTtcblx0fVxuXG5cdGFzeW5jIGxvYWRTZXR0aW5ncygpIHtcblx0XHR0aGlzLmN1cnJlbnREZXZpY2VVdWlkID0gZ2V0RGV2aWNlVXVpZCgpO1xuXHRcdHRoaXMuc2V0dGluZ3MgPSBPYmplY3QuYXNzaWduKHt9LCBERUZBVUxUX1NFVFRJTkdTLCBhd2FpdCB0aGlzLmxvYWREYXRhKCkpO1xuXHRcdHRoaXMubWlncmF0ZUF1dGhvclNldHRpbmdzKCk7XG5cdFx0dGhpcy5lbnN1cmVDdXJyZW50RGV2aWNlQmluZGluZygpO1xuXHRcdHRoaXMubWlncmF0ZUZvbGRlckRlZmF1bHRSdWxlcygpO1xuXHRcdHRoaXMubWlncmF0ZUFJU3VtbWFyeVByb21wdCgpO1xuXHR9XG5cblx0YXN5bmMgc2F2ZVNldHRpbmdzKCkge1xuXHRcdGF3YWl0IHRoaXMuc2F2ZURhdGEodGhpcy5zZXR0aW5ncyk7XG5cdFx0dGhpcy5zY2hlZHVsZUZvbGRlckNoZWNrbWFya1JlZnJlc2goKTtcblx0fVxuXG5cdHJlZnJlc2hTZXR0aW5nc1RhYigpIHtcblx0XHR0aGlzLnNldHRpbmdUYWI/LmRpc3BsYXkoKTtcblx0fVxuXG5cdHJlZnJlc2hFbXB0eUZpZWxkSGlnaGxpZ2h0cygpIHtcblx0XHR0aGlzLnNjaGVkdWxlRW1wdHlGaWVsZEhpZ2hsaWdodENoZWNrKCk7XG5cdH1cblxuXHRyZWZyZXNoRm9sZGVyQ2hlY2ttYXJrcygpIHtcblx0XHR0aGlzLmFwcGx5Rm9sZGVyQ2hlY2ttYXJrcygpO1xuXHR9XG5cblx0YXN5bmMgZ2VuZXJhdGVTdW1tYXJ5Rm9yRmlsZShmaWxlOiBURmlsZSkge1xuXHRcdGlmICghdGhpcy5zZXR0aW5ncy5haVN1bW1hcnlFbmFibGVkIHx8ICF0aGlzLnNldHRpbmdzLmFpQXBpS2V5LnRyaW0oKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZChmaWxlKTtcblx0XHRcdGNvbnN0IHN1bW1hcnlEb2N1bWVudCA9IGdldFN1bW1hcnlEb2N1bWVudChmaWxlLCBjb250ZW50LCAxKTtcblx0XHRcdGlmICghc3VtbWFyeURvY3VtZW50KSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3Qgc3VtbWFyeSA9IGF3YWl0IG5ldyBBSVN1bW1hcnlTZXJ2aWNlKHRoaXMuc2V0dGluZ3MpLmdlbmVyYXRlU3VtbWFyeShzdW1tYXJ5RG9jdW1lbnQpO1xuXHRcdFx0aWYgKCFzdW1tYXJ5KSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgbmV4dCA9IHdyaXRlU3VtbWFyeVRvQ29udGVudChcblx0XHRcdFx0Y29udGVudCxcblx0XHRcdFx0ZmlsZSxcblx0XHRcdFx0c3VtbWFyeSxcblx0XHRcdFx0dGhpcy5nZXRGb2xkZXJEZWZhdWx0VmFsdWVzKGZpbGUpLFxuXHRcdFx0XHR0aGlzLmJ1aWxkRnJvbnRtYXR0ZXIuYmluZCh0aGlzKSxcblx0XHRcdCk7XG5cdFx0XHRpZiAobmV4dCAhPT0gbnVsbCkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLmFwcC52YXVsdC5tb2RpZnkoZmlsZSwgbmV4dCk7XG5cdFx0XHRcdHRoaXMudHJpZ2dlck1ldGFkYXRhQ2hhbmdlZChmaWxlKTtcblx0XHRcdH1cblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0bmV3IE5vdGljZShgQUkg5pGY6KaB55Sf5oiQ5aSx6LSl77yaJHtnZXRFcnJvck1lc3NhZ2UoZXJyb3IpfWApO1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jIGdlbmVyYXRlU3VtbWFyeUZvck1ldGFkYXRhQnV0dG9uKFxuXHRcdGZpbGU6IFRGaWxlLFxuXHRcdG9uRGVsdGE6IChkZWx0YTogc3RyaW5nKSA9PiB2b2lkLFxuXHRcdHNpZ25hbDogQWJvcnRTaWduYWwsXG5cdCk6IFByb21pc2U8c3RyaW5nPiB7XG5cdFx0aWYgKCF0aGlzLnNldHRpbmdzLmFpU3VtbWFyeUVuYWJsZWQpIHtcblx0XHRcdG5ldyBOb3RpY2UoXCLor7flhYjlvIDlkK8gQUkg6Ieq5Yqo5pGY6KaBXCIpO1xuXHRcdFx0cmV0dXJuIFwiXCI7XG5cdFx0fVxuXHRcdGlmICghdGhpcy5zZXR0aW5ncy5haUFwaUtleS50cmltKCkpIHtcblx0XHRcdG5ldyBOb3RpY2UoXCLor7flhYjloavlhpkgQUkg5pGY6KaBIEFQSSBLZXlcIik7XG5cdFx0XHRyZXR1cm4gXCJcIjtcblx0XHR9XG5cblx0XHRjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZChmaWxlKTtcblx0XHRjb25zdCBzdW1tYXJ5RG9jdW1lbnQgPSBnZXRTdW1tYXJ5RG9jdW1lbnQoZmlsZSwgY29udGVudCwgMSk7XG5cdFx0aWYgKCFzdW1tYXJ5RG9jdW1lbnQpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihcIuaWh+aho+WGheWuueS4uuepuu+8jOaXoOazleeUn+aIkOaRmOimgVwiKTtcblx0XHR9XG5cblx0XHRsZXQgc3VtbWFyeSA9IFwiXCI7XG5cdFx0dHJ5IHtcblx0XHRcdHN1bW1hcnkgPSBhd2FpdCBuZXcgQUlTdW1tYXJ5U2VydmljZSh0aGlzLnNldHRpbmdzKS5nZW5lcmF0ZVN1bW1hcnkoc3VtbWFyeURvY3VtZW50KTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0aWYgKHNpZ25hbC5hYm9ydGVkKSB7XG5cdFx0XHRcdHJldHVybiBcIlwiO1xuXHRcdFx0fVxuXHRcdFx0dGhyb3cgZXJyb3I7XG5cdFx0fVxuXHRcdGlmICghc3VtbWFyeSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiQUkg5pGY6KaB6L+U5Zue5Li656m6XCIpO1xuXHRcdH1cblxuXHRcdGNvbnN0IG5leHQgPSB3cml0ZVN1bW1hcnlUb0NvbnRlbnQoXG5cdFx0XHRjb250ZW50LFxuXHRcdFx0ZmlsZSxcblx0XHRcdHN1bW1hcnksXG5cdFx0XHR0aGlzLmdldEZvbGRlckRlZmF1bHRWYWx1ZXMoZmlsZSksXG5cdFx0XHR0aGlzLmJ1aWxkRnJvbnRtYXR0ZXIuYmluZCh0aGlzKSxcblx0XHQpO1xuXHRcdGlmIChuZXh0ICE9PSBudWxsKSB7XG5cdFx0XHRhd2FpdCB0aGlzLmFwcC52YXVsdC5tb2RpZnkoZmlsZSwgbmV4dCk7XG5cdFx0fVxuXHRcdHJldHVybiBzdW1tYXJ5O1xuXHR9XG5cblx0YXN5bmMgc2NhbkFJU3VtbWFyeUNhbmRpZGF0ZXModGFzazogQUlTdW1tYXJ5VGFza1R5cGUsIHNob3dOb3RpY2U6IGJvb2xlYW4pOiBQcm9taXNlPEFJU3VtbWFyeUNhbmRpZGF0ZVtdPiB7XG5cdFx0Y29uc3QgYXV0aG9yID0gdGhpcy5nZXRBSVN1bW1hcnlBdXRob3JGb3JUYXNrKHNob3dOb3RpY2UpO1xuXHRcdGlmICghYXV0aG9yKSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGF3YWl0IHRoaXMuZ2V0QUlTdW1tYXJ5Q29tcGxldGlvbkNhbmRpZGF0ZXMoYXV0aG9yKTtcblx0fVxuXG5cdGFzeW5jIGV4ZWN1dGVBSVN1bW1hcnlRdWV1ZShcblx0XHR0YXNrOiBBSVN1bW1hcnlUYXNrVHlwZSxcblx0XHRjYW5kaWRhdGVzOiBBSVN1bW1hcnlDYW5kaWRhdGVbXSxcblx0XHRzaG93Tm90aWNlOiBib29sZWFuLFxuXHRcdG9uUHJvZ3Jlc3M/OiAoKSA9PiB2b2lkLFxuXHQpOiBQcm9taXNlPG51bWJlcj4ge1xuXHRcdGlmICh0aGlzLmlzQUlTdW1tYXJ5VGFza1J1bm5pbmcodGFzaykpIHtcblx0XHRcdGlmIChzaG93Tm90aWNlKSB7XG5cdFx0XHRcdG5ldyBOb3RpY2UoXCJBSSDmkZjopoHmraPlnKjmiafooYzkuK1cIik7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gMDtcblx0XHR9XG5cblx0XHRpZiAoIXRoaXMuZ2V0QUlTdW1tYXJ5QXV0aG9yRm9yVGFzayhzaG93Tm90aWNlKSkge1xuXHRcdFx0cmV0dXJuIDA7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGF3YWl0IHRoaXMucHJvY2Vzc0FJU3VtbWFyeVF1ZXVlKHRhc2ssIGNhbmRpZGF0ZXMsIHNob3dOb3RpY2UsIG9uUHJvZ3Jlc3MpO1xuXHR9XG5cblx0aXNBSVN1bW1hcnlUYXNrUnVubmluZyh0YXNrOiBBSVN1bW1hcnlUYXNrVHlwZSk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLmFpU3VtbWFyeUNvbXBsZXRpb25SdW5uaW5nO1xuXHR9XG5cblx0cHJpdmF0ZSBjaGVja0FJU3VtbWFyeVNjaGVkdWxlKCkge1xuXHRcdGNvbnN0IG5vdyA9IG5ldyBEYXRlKCk7XG5cdFx0Y29uc3QgbWludXRlID0gbm93LmdldE1pbnV0ZXMoKTtcblx0XHRpZiAobWludXRlICE9PSAwICYmIG1pbnV0ZSAhPT0gMzApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBzbG90ID0gYCR7bm93LmdldEZ1bGxZZWFyKCl9LSR7bm93LmdldE1vbnRoKCl9LSR7bm93LmdldERhdGUoKX0tJHtub3cuZ2V0SG91cnMoKX0tJHttaW51dGV9YDtcblx0XHRpZiAoc2xvdCA9PT0gdGhpcy5sYXN0QUlTdW1tYXJ5U2NoZWR1bGVTbG90KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5sYXN0QUlTdW1tYXJ5U2NoZWR1bGVTbG90ID0gc2xvdDtcblx0XHR2b2lkIHRoaXMucnVuU2NoZWR1bGVkQUlTdW1tYXJ5VGFza3MoKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcnVuU2NoZWR1bGVkQUlTdW1tYXJ5VGFza3MoKSB7XG5cdFx0YXdhaXQgdGhpcy5ydW5TY2hlZHVsZWRBSVN1bW1hcnlUYXNrKFwiY29tcGxldGlvblwiKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcnVuU2NoZWR1bGVkQUlTdW1tYXJ5VGFzayh0YXNrOiBBSVN1bW1hcnlUYXNrVHlwZSkge1xuXHRcdGlmICh0aGlzLmlzQUlTdW1tYXJ5VGFza1J1bm5pbmcodGFzaykpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBjYW5kaWRhdGVzID0gYXdhaXQgdGhpcy5zY2FuQUlTdW1tYXJ5Q2FuZGlkYXRlcyh0YXNrLCBmYWxzZSk7XG5cdFx0aWYgKGNhbmRpZGF0ZXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0YXdhaXQgdGhpcy5wcm9jZXNzQUlTdW1tYXJ5UXVldWUodGFzaywgY2FuZGlkYXRlcywgZmFsc2UpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRBSVN1bW1hcnlBdXRob3JGb3JUYXNrKHNob3dOb3RpY2U6IGJvb2xlYW4pOiBzdHJpbmcge1xuXHRcdGlmICghdGhpcy5zZXR0aW5ncy5haVN1bW1hcnlFbmFibGVkKSB7XG5cdFx0XHRpZiAoc2hvd05vdGljZSkge1xuXHRcdFx0XHRuZXcgTm90aWNlKFwi6K+35YWI5byA5ZCvIEFJIOiHquWKqOaRmOimgVwiKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBcIlwiO1xuXHRcdH1cblx0XHRpZiAoIXRoaXMuc2V0dGluZ3MuYWlBcGlLZXkudHJpbSgpKSB7XG5cdFx0XHRpZiAoc2hvd05vdGljZSkge1xuXHRcdFx0XHRuZXcgTm90aWNlKFwi6K+35YWI5aGr5YaZIEFJIOaRmOimgSBBUEkgS2V5XCIpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIFwiXCI7XG5cdFx0fVxuXG5cdFx0Y29uc3QgYXV0aG9yID0gdGhpcy5nZXRDdXJyZW50QXV0aG9yTmFtZSgpO1xuXHRcdGlmICghYXV0aG9yKSB7XG5cdFx0XHRpZiAoc2hvd05vdGljZSkge1xuXHRcdFx0XHRuZXcgTm90aWNlKFwi6K+35YWI5Zyo44CM6K6+5aSH57uR5a6a44CN5Lit57uR5a6a5pys5py66K6+5aSHXCIpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIFwiXCI7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGF1dGhvcjtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcHJvY2Vzc0FJU3VtbWFyeVF1ZXVlKFxuXHRcdHRhc2s6IEFJU3VtbWFyeVRhc2tUeXBlLFxuXHRcdGNhbmRpZGF0ZXM6IEFJU3VtbWFyeUNhbmRpZGF0ZVtdLFxuXHRcdHNob3dOb3RpY2U6IGJvb2xlYW4sXG5cdFx0b25Qcm9ncmVzcz86ICgpID0+IHZvaWQsXG5cdCk6IFByb21pc2U8bnVtYmVyPiB7XG5cdFx0dGhpcy5zZXRBSVN1bW1hcnlUYXNrUnVubmluZyh0YXNrLCB0cnVlKTtcblx0XHRsZXQgcHJvY2Vzc2VkQ291bnQgPSAwO1xuXHRcdGxldCBjb25zZWN1dGl2ZUZhaWx1cmVzID0gMDtcblxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBzZXJ2aWNlID0gbmV3IEFJU3VtbWFyeVNlcnZpY2UodGhpcy5zZXR0aW5ncyk7XG5cdFx0XHRmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgY2FuZGlkYXRlcy5sZW5ndGg7IGluZGV4KyspIHtcblx0XHRcdFx0Y29uc3QgY2FuZGlkYXRlID0gY2FuZGlkYXRlc1tpbmRleF07XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0Y29uc3Qgc3VtbWFyeSA9IGF3YWl0IHNlcnZpY2UuZ2VuZXJhdGVTdW1tYXJ5KGNhbmRpZGF0ZS5kb2N1bWVudCk7XG5cdFx0XHRcdFx0aWYgKCFzdW1tYXJ5KSB7XG5cdFx0XHRcdFx0XHRpZiAoaW5kZXggPCBjYW5kaWRhdGVzLmxlbmd0aCAtIDEpIHtcblx0XHRcdFx0XHRcdFx0YXdhaXQgZGVsYXkoQUlfU1VNTUFSWV9SRVFVRVNUX0RFTEFZX01TKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGNvbnN0IG5leHQgPSB3cml0ZVN1bW1hcnlUb0NvbnRlbnQoXG5cdFx0XHRcdFx0XHRjYW5kaWRhdGUuY29udGVudCxcblx0XHRcdFx0XHRcdGNhbmRpZGF0ZS5maWxlLFxuXHRcdFx0XHRcdFx0c3VtbWFyeSxcblx0XHRcdFx0XHRcdHRoaXMuZ2V0Rm9sZGVyRGVmYXVsdFZhbHVlcyhjYW5kaWRhdGUuZmlsZSksXG5cdFx0XHRcdFx0XHR0aGlzLmJ1aWxkRnJvbnRtYXR0ZXIuYmluZCh0aGlzKSxcblx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdGlmIChuZXh0ICE9PSBudWxsKSB7XG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLmFwcC52YXVsdC5tb2RpZnkoY2FuZGlkYXRlLmZpbGUsIG5leHQpO1xuXHRcdFx0XHRcdFx0dGhpcy50cmlnZ2VyTWV0YWRhdGFDaGFuZ2VkKGNhbmRpZGF0ZS5maWxlKTtcblx0XHRcdFx0XHRcdHByb2Nlc3NlZENvdW50Kys7XG5cdFx0XHRcdFx0XHRjYW5kaWRhdGUuZG9uZSA9IHRydWU7XG5cdFx0XHRcdFx0XHRvblByb2dyZXNzPy4oKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Y29uc2VjdXRpdmVGYWlsdXJlcyA9IDA7XG5cdFx0XHRcdH0gY2F0Y2ggKF9lcnJvcikge1xuXHRcdFx0XHRcdGNvbnNlY3V0aXZlRmFpbHVyZXMrKztcblx0XHRcdFx0XHRpZiAoY29uc2VjdXRpdmVGYWlsdXJlcyA+PSAzKSB7XG5cdFx0XHRcdFx0XHRuZXcgTm90aWNlKFwiQUkg5pGY6KaB5pyN5Yqh5byC5bi477yM5bey5pqC5YGc5pys5qyh5Lu75YqhXCIpO1xuXHRcdFx0XHRcdFx0cmV0dXJuIHByb2Nlc3NlZENvdW50O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChpbmRleCA8IGNhbmRpZGF0ZXMubGVuZ3RoIC0gMSkge1xuXHRcdFx0XHRcdGF3YWl0IGRlbGF5KEFJX1NVTU1BUllfUkVRVUVTVF9ERUxBWV9NUyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKHNob3dOb3RpY2UpIHtcblx0XHRcdFx0bmV3IE5vdGljZShcblx0XHRcdFx0XHRwcm9jZXNzZWRDb3VudCA+IDBcblx0XHRcdFx0XHRcdD8gYEFJIOaRmOimge+8muacrOasoeWkhOeQhiAke3Byb2Nlc3NlZENvdW50fSDnr4fmlofmoaNgXG5cdFx0XHRcdFx0XHQ6IFwiQUkg5pGY6KaB77ya5pqC5peg6ZyA6KaB5aSE55CG55qE5paH5qGjXCIsXG5cdFx0XHRcdCk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBwcm9jZXNzZWRDb3VudDtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0dGhpcy5zZXRBSVN1bW1hcnlUYXNrUnVubmluZyh0YXNrLCBmYWxzZSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBzZXRBSVN1bW1hcnlUYXNrUnVubmluZyh0YXNrOiBBSVN1bW1hcnlUYXNrVHlwZSwgaXNSdW5uaW5nOiBib29sZWFuKSB7XG5cdFx0dGhpcy5haVN1bW1hcnlDb21wbGV0aW9uUnVubmluZyA9IGlzUnVubmluZztcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZ2V0QUlTdW1tYXJ5Q29tcGxldGlvbkNhbmRpZGF0ZXMoYXV0aG9yOiBzdHJpbmcpOiBQcm9taXNlPEFJU3VtbWFyeUNhbmRpZGF0ZVtdPiB7XG5cdFx0Y29uc3QgY2FuZGlkYXRlczogQUlTdW1tYXJ5Q2FuZGlkYXRlW10gPSBbXTtcblx0XHRjb25zdCBmaWxlcyA9IHRoaXMuYXBwLnZhdWx0LmdldE1hcmtkb3duRmlsZXMoKTtcblxuXHRcdGZvciAoY29uc3QgZmlsZSBvZiBmaWxlcykge1xuXHRcdFx0Y29uc3QgZnJvbnRtYXR0ZXIgPSB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShmaWxlKT8uZnJvbnRtYXR0ZXIgPz8ge307XG5cdFx0XHRpZiAoIWZyb250bWF0dGVyQXV0aG9yQ29udGFpbnMoZnJvbnRtYXR0ZXJbXCLkvZzogIVcIl0sIGF1dGhvcikgfHwgIWlzRW1wdHlGcm9udG1hdHRlclZhbHVlKGZyb250bWF0dGVyW1wi5pGY6KaBXCJdKSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LmNhY2hlZFJlYWQoZmlsZSk7XG5cdFx0XHRjb25zdCBkb2N1bWVudCA9IGdldFN1bW1hcnlEb2N1bWVudChmaWxlLCBjb250ZW50LCBNSU5fU1VNTUFSWV9CT0RZX0xFTkdUSCk7XG5cdFx0XHRpZiAoIWRvY3VtZW50KSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRjYW5kaWRhdGVzLnB1c2goeyBmaWxlLCBjb250ZW50LCBkb2N1bWVudCB9KTtcblx0XHR9XG5cblx0XHRyZXR1cm4gY2FuZGlkYXRlcztcblx0fVxuXG5cdHByaXZhdGUgdHJpZ2dlck1ldGFkYXRhQ2hhbmdlZChmaWxlOiBURmlsZSkge1xuXHRcdCh0aGlzLmFwcC5tZXRhZGF0YUNhY2hlIGFzIHsgdHJpZ2dlcjogKG5hbWU6IHN0cmluZywgZmlsZTogVEZpbGUpID0+IHZvaWQgfSkudHJpZ2dlcihcImNoYW5nZWRcIiwgZmlsZSk7XG5cdH1cblxuXHRnZXRBdXRob3JOYW1lKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuc2V0dGluZ3MuZGV2aWNlQmluZGluZ3MuZmluZCgoYmluZGluZykgPT4gYmluZGluZy51dWlkID09PSB0aGlzLmN1cnJlbnREZXZpY2VVdWlkKT8uYXV0aG9yID8/IFwiXCI7XG5cdH1cblxuXHRlbnN1cmVEZXZpY2VCb3VuZCgpOiBib29sZWFuIHtcblx0XHRpZiAodGhpcy5nZXRDdXJyZW50QXV0aG9yTmFtZSgpKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRuZXcgTm90aWNlKFwi6K+35YWI5Zyo44CM6K6+5aSH57uR5a6a44CN5Lit57uR5a6a5pys5py66K6+5aSHXCIpO1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdGdldEN1cnJlbnRBdXRob3JOYW1lKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuc2V0dGluZ3MuZGV2aWNlQmluZGluZ3MuZmluZCgoYmluZGluZykgPT4ge1xuXHRcdFx0cmV0dXJuIGJpbmRpbmcudXVpZCA9PT0gdGhpcy5jdXJyZW50RGV2aWNlVXVpZCAmJiBiaW5kaW5nLmF1dGhvcjtcblx0XHR9KT8uYXV0aG9yID8/IFwiXCI7XG5cdH1cblxuXHRidWlsZEZyb250bWF0dGVyKGNyZWF0ZWQ6IHN0cmluZywgZGVmYXVsdHM6IEZvbGRlckRlZmF1bHRWYWx1ZXMgPSB7fSk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIFtcblx0XHRcdFwiLS0tXCIsXG5cdFx0XHRg6aG555uuOiAke2RlZmF1bHRzW1wi6aG555uuXCJdID8/IFwiXCJ9YCxcblx0XHRcdFwi57G75Z6LOlwiLFxuXHRcdFx0YCAgLSAke2Zvcm1hdFlhbWxTY2FsYXIoZGVmYXVsdHNbXCLnsbvlnotcIl0gPz8gXCJcIil9YCxcblx0XHRcdFwi5L2c6ICFOlwiLFxuXHRcdFx0YCAgLSAke2Zvcm1hdFlhbWxTY2FsYXIodGhpcy5nZXRBdXRob3JOYW1lKCkpfWAsXG5cdFx0XHRcIuaRmOimgTogXCIsXG5cdFx0XHRg5Yib5bu65pe26Ze0OiAke2NyZWF0ZWR9YCxcblx0XHRcdGDmnIDlkI7mm7TmlrA6ICR7Y3JlYXRlZH1gLFxuXHRcdFx0XCItLS1cIixcblx0XHRcdFwiXCIsXG5cdFx0XS5qb2luKFwiXFxuXCIpO1xuXHR9XG5cblx0cHJpdmF0ZSBoYW5kbGVDcmVhdGUoZmlsZTogVEFic3RyYWN0RmlsZSkge1xuXHRcdGlmICghKGZpbGUgaW5zdGFuY2VvZiBURmlsZSkgfHwgZmlsZS5leHRlbnNpb24gIT09IFwibWRcIikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHRpbWVyID0gd2luZG93LnNldFRpbWVvdXQoYXN5bmMgKCkgPT4ge1xuXHRcdFx0dGhpcy5jcmVhdGVUaW1lcnMuZGVsZXRlKHRpbWVyKTtcblxuXHRcdFx0Y29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQoZmlsZSk7XG5cdFx0XHRpZiAoY29udGVudC50cmltKCkubGVuZ3RoID4gMCB8fCBoYXNGcm9udG1hdHRlcihjb250ZW50KSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGNyZWF0ZWQgPSBmb3JtYXRMb2NhbERhdGUobmV3IERhdGUoZmlsZS5zdGF0LmN0aW1lKSk7XG5cdFx0XHRhd2FpdCB0aGlzLmFwcC52YXVsdC5tb2RpZnkoZmlsZSwgdGhpcy5idWlsZEZyb250bWF0dGVyKGNyZWF0ZWQsIHRoaXMuZ2V0Rm9sZGVyRGVmYXVsdFZhbHVlcyhmaWxlKSkpO1xuXHRcdH0sIDI1MCk7XG5cblx0XHR0aGlzLmNyZWF0ZVRpbWVycy5hZGQodGltZXIpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBoYW5kbGVSZW5hbWUoZmlsZTogVEFic3RyYWN0RmlsZSwgb2xkUGF0aDogc3RyaW5nKSB7XG5cdFx0aWYgKCEoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSB8fCBmaWxlLmV4dGVuc2lvbiAhPT0gXCJtZFwiKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKGdldEZpbGVGb2xkZXIoZmlsZS5wYXRoKSA9PT0gZ2V0RmlsZUZvbGRlcihvbGRQYXRoKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGRlZmF1bHRzID0gdGhpcy5nZXRGb2xkZXJEZWZhdWx0VmFsdWVzKGZpbGUpO1xuXHRcdGlmIChPYmplY3Qua2V5cyhkZWZhdWx0cykubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0YXdhaXQgdGhpcy5hcHAudmF1bHQucHJvY2VzcyhmaWxlLCAoY29udGVudCkgPT4ge1xuXHRcdFx0Y29uc3QgbmV4dCA9IGZpbGxFbXB0eUZvbGRlckRlZmF1bHRzKGNvbnRlbnQsIGRlZmF1bHRzKTtcblx0XHRcdHJldHVybiBuZXh0ID8/IGNvbnRlbnQ7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGhhbmRsZUZpbGVNZW51KG1lbnU6IE1lbnUsIGZpbGU6IFRBYnN0cmFjdEZpbGUpIHtcblx0XHRpZiAoIShmaWxlIGluc3RhbmNlb2YgVEZvbGRlcikpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRtZW51LmFkZEl0ZW0oKGl0ZW0pID0+IHtcblx0XHRcdGl0ZW0uc2V0VGl0bGUoXCLorr7nva7lsZ7mgKfljLnphY3op4TliJlcIikub25DbGljaygoKSA9PiB7XG5cdFx0XHRcdG5ldyBGb2xkZXJSdWxlTW9kYWwodGhpcy5hcHAsIHRoaXMsIGZpbGUucGF0aCkub3BlbigpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH1cblxuXHRnZXRGb2xkZXJEZWZhdWx0VmFsdWVzKGZpbGU6IFRGaWxlKTogRm9sZGVyRGVmYXVsdFZhbHVlcyB7XG5cdFx0Y29uc3QgdmFsdWVzOiBGb2xkZXJEZWZhdWx0VmFsdWVzID0ge307XG5cdFx0Y29uc3QgZGVwdGhzOiBQYXJ0aWFsPFJlY29yZDxGb2xkZXJEZWZhdWx0RmllbGQsIG51bWJlcj4+ID0ge307XG5cdFx0Y29uc3QgZmlsZUZvbGRlciA9IGdldEZpbGVGb2xkZXIoZmlsZS5wYXRoKTtcblxuXHRcdGZvciAoY29uc3QgcnVsZSBvZiB0aGlzLnNldHRpbmdzLmZvbGRlckRlZmF1bHRzKSB7XG5cdFx0XHRpZiAoIXJ1bGUudmFsdWUgfHwgIWZvbGRlck1hdGNoZXMoZmlsZUZvbGRlciwgcnVsZS5mb2xkZXIpKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBkZXB0aCA9IGdldEZvbGRlckRlcHRoKHJ1bGUuZm9sZGVyKTtcblx0XHRcdGlmIChkZXB0aCA+PSAoZGVwdGhzW3J1bGUuZmllbGRdID8/IC0xKSkge1xuXHRcdFx0XHR2YWx1ZXNbcnVsZS5maWVsZF0gPSBydWxlLnZhbHVlO1xuXHRcdFx0XHRkZXB0aHNbcnVsZS5maWVsZF0gPSBkZXB0aDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdmFsdWVzO1xuXHR9XG5cblx0Y3JlYXRlRm9sZGVyUnVsZShmb2xkZXIgPSBcIlwiLCBmaWVsZDogRm9sZGVyRGVmYXVsdEZpZWxkID0gXCLpobnnm65cIiwgdmFsdWUgPSBcIlwiKTogRm9sZGVyRGVmYXVsdFJ1bGUge1xuXHRcdGNvbnN0IG5vdyA9IGZvcm1hdExvY2FsRGF0ZShuZXcgRGF0ZSgpKTtcblx0XHRjb25zdCBhdXRob3IgPSB0aGlzLmdldEN1cnJlbnRBdXRob3JOYW1lKCk7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGZvbGRlcixcblx0XHRcdGZpZWxkLFxuXHRcdFx0dmFsdWUsXG5cdFx0XHRjcmVhdGVkQnk6IGF1dGhvcixcblx0XHRcdGNyZWF0ZWRBdDogbm93LFxuXHRcdFx0bW9kaWZpZWRCeTogYXV0aG9yLFxuXHRcdFx0bW9kaWZpZWRBdDogbm93LFxuXHRcdH07XG5cdH1cblxuXHR0b3VjaEZvbGRlclJ1bGUocnVsZTogRm9sZGVyRGVmYXVsdFJ1bGUpIHtcblx0XHRydWxlLm1vZGlmaWVkQnkgPSB0aGlzLmdldEN1cnJlbnRBdXRob3JOYW1lKCk7XG5cdFx0cnVsZS5tb2RpZmllZEF0ID0gZm9ybWF0TG9jYWxEYXRlKG5ldyBEYXRlKCkpO1xuXHR9XG5cblx0YXN5bmMgdXBzZXJ0Rm9sZGVyUnVsZShmb2xkZXI6IHN0cmluZywgZmllbGQ6IEZvbGRlckRlZmF1bHRGaWVsZCwgdmFsdWU6IHN0cmluZykge1xuXHRcdGNvbnN0IGV4aXN0aW5nID0gdGhpcy5zZXR0aW5ncy5mb2xkZXJEZWZhdWx0cy5maW5kKChydWxlKSA9PiB7XG5cdFx0XHRyZXR1cm4gcnVsZS5mb2xkZXIgPT09IGZvbGRlciAmJiBydWxlLmZpZWxkID09PSBmaWVsZDtcblx0XHR9KTtcblxuXHRcdGlmIChleGlzdGluZykge1xuXHRcdFx0ZXhpc3RpbmcudmFsdWUgPSB2YWx1ZTtcblx0XHRcdHRoaXMudG91Y2hGb2xkZXJSdWxlKGV4aXN0aW5nKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5zZXR0aW5ncy5mb2xkZXJEZWZhdWx0cy5wdXNoKHRoaXMuY3JlYXRlRm9sZGVyUnVsZShmb2xkZXIsIGZpZWxkLCB2YWx1ZSkpO1xuXHRcdH1cblxuXHRcdGF3YWl0IHRoaXMuc2F2ZVNldHRpbmdzKCk7XG5cdH1cblxuXHRwcml2YXRlIG1pZ3JhdGVBdXRob3JTZXR0aW5ncygpIHtcblx0XHRpZiAodGhpcy5zZXR0aW5ncy5kZXZpY2VCaW5kaW5ncy5sZW5ndGggPiAwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgYXV0aG9yID0gZ2V0TGVnYWN5QXV0aG9yTmFtZSh0aGlzLnNldHRpbmdzKTtcblx0XHRpZiAoYXV0aG9yKSB7XG5cdFx0XHR0aGlzLnNldHRpbmdzLmRldmljZUJpbmRpbmdzLnB1c2goe1xuXHRcdFx0XHR1dWlkOiB0aGlzLmN1cnJlbnREZXZpY2VVdWlkLFxuXHRcdFx0XHRhdXRob3IsXG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGVuc3VyZUN1cnJlbnREZXZpY2VCaW5kaW5nKCkge1xuXHRcdGlmICh0aGlzLnNldHRpbmdzLmRldmljZUJpbmRpbmdzLmxlbmd0aCA+IDApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLnNldHRpbmdzLmRldmljZUJpbmRpbmdzLnB1c2goe1xuXHRcdFx0dXVpZDogdGhpcy5jdXJyZW50RGV2aWNlVXVpZCxcblx0XHRcdGF1dGhvcjogXCJcIixcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgbWlncmF0ZUZvbGRlckRlZmF1bHRSdWxlcygpIHtcblx0XHRjb25zdCBydWxlczogRm9sZGVyRGVmYXVsdFJ1bGVbXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgcnVsZSBvZiB0aGlzLnNldHRpbmdzLmZvbGRlckRlZmF1bHRzKSB7XG5cdFx0XHRpZiAocnVsZS5maWVsZHMpIHtcblx0XHRcdFx0Zm9yIChjb25zdCBmaWVsZFNldHRpbmcgb2YgcnVsZS5maWVsZHMpIHtcblx0XHRcdFx0XHRydWxlcy5wdXNoKHtcblx0XHRcdFx0XHRcdGZvbGRlcjogcnVsZS5mb2xkZXIsXG5cdFx0XHRcdFx0XHRmaWVsZDogZmllbGRTZXR0aW5nLmZpZWxkLFxuXHRcdFx0XHRcdFx0dmFsdWU6IGZpZWxkU2V0dGluZy52YWx1ZSxcblx0XHRcdFx0XHRcdGNyZWF0ZWRCeTogcnVsZS5jcmVhdGVkQnksXG5cdFx0XHRcdFx0XHRjcmVhdGVkQXQ6IHJ1bGUuY3JlYXRlZEF0LFxuXHRcdFx0XHRcdFx0bW9kaWZpZWRCeTogcnVsZS5tb2RpZmllZEJ5LFxuXHRcdFx0XHRcdFx0bW9kaWZpZWRBdDogcnVsZS5tb2RpZmllZEF0LFxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRydWxlcy5wdXNoKHJ1bGUpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHR0aGlzLnNldHRpbmdzLmZvbGRlckRlZmF1bHRzID0gcnVsZXM7XG5cdH1cblxuXHRwcml2YXRlIG1pZ3JhdGVBSVN1bW1hcnlQcm9tcHQoKSB7XG5cdFx0aWYgKFxuXHRcdFx0dGhpcy5zZXR0aW5ncy5haVN1bW1hcnlQcm9tcHQgPT09IE9MRF9BSV9TVU1NQVJZX1BST01QVCB8fFxuXHRcdFx0dGhpcy5zZXR0aW5ncy5haVN1bW1hcnlQcm9tcHQgPT09IFBSRVZJT1VTX0FJX1NVTU1BUllfUFJPTVBUXG5cdFx0KSB7XG5cdFx0XHR0aGlzLnNldHRpbmdzLmFpU3VtbWFyeVByb21wdCA9IERFRkFVTFRfQUlfU1VNTUFSWV9QUk9NUFQ7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgY2hlY2tGb3JVcGRhdGUoKTogUHJvbWlzZTx7IGhhc1VwZGF0ZTogYm9vbGVhbjsgdmVyc2lvbjogc3RyaW5nOyBlcnJvcj86IHN0cmluZyB9PiB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goYCR7R0lUSFVCX1JBV19CQVNFfS9tYW5pZmVzdC5qc29uYCk7XG5cblx0XHRcdGlmIChyZXNwb25zZS5zdGF0dXMgPT09IDQwNCkge1xuXHRcdFx0XHRyZXR1cm4geyBoYXNVcGRhdGU6IGZhbHNlLCB2ZXJzaW9uOiBcIlwiLCBlcnJvcjogXCJub3RfZm91bmRcIiB9O1xuXHRcdFx0fVxuXHRcdFx0aWYgKCFyZXNwb25zZS5vaykge1xuXHRcdFx0XHRyZXR1cm4geyBoYXNVcGRhdGU6IGZhbHNlLCB2ZXJzaW9uOiBcIlwiLCBlcnJvcjogYOivt+axguWksei0pe+8miR7cmVzcG9uc2Uuc3RhdHVzfWAgfTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgcmVtb3RlTWFuaWZlc3QgPSBhd2FpdCByZXNwb25zZS5qc29uKCkgYXMgeyB2ZXJzaW9uPzogc3RyaW5nIH07XG5cdFx0XHRjb25zdCByZW1vdGVWZXJzaW9uID0gcmVtb3RlTWFuaWZlc3QudmVyc2lvbiA/PyBcIlwiO1xuXHRcdFx0aWYgKCFyZW1vdGVWZXJzaW9uKSB7XG5cdFx0XHRcdHJldHVybiB7IGhhc1VwZGF0ZTogZmFsc2UsIHZlcnNpb246IFwiXCIsIGVycm9yOiBcIui/nOerr+eJiOacrOWPt+aXoOaViFwiIH07XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGN1cnJlbnRWZXJzaW9uID0gdGhpcy5tYW5pZmVzdC52ZXJzaW9uO1xuXHRcdFx0Y29uc3QgaGFzVXBkYXRlID0gdGhpcy5jb21wYXJlVmVyc2lvbnMocmVtb3RlVmVyc2lvbiwgY3VycmVudFZlcnNpb24pID4gMDtcblx0XHRcdHJldHVybiB7IGhhc1VwZGF0ZSwgdmVyc2lvbjogcmVtb3RlVmVyc2lvbiB9O1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRyZXR1cm4geyBoYXNVcGRhdGU6IGZhbHNlLCB2ZXJzaW9uOiBcIlwiLCBlcnJvcjogZ2V0RXJyb3JNZXNzYWdlKGVycm9yKSB9O1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jIHBlcmZvcm1VcGRhdGUodmVyc2lvbjogc3RyaW5nLCBvblByb2dyZXNzPzogKHN0ZXA6IG51bWJlciwgdG90YWw6IG51bWJlcikgPT4gdm9pZCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHRoaXMuZG93bmxvYWRBbmRXcml0ZVVwZGF0ZUZpbGVzKHZlcnNpb24sIG9uUHJvZ3Jlc3MpO1xuXHRcdGF3YWl0IHRoaXMucmVsb2FkUGx1Z2luKHZlcnNpb24sIGZhbHNlKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZG93bmxvYWRBbmRXcml0ZVVwZGF0ZUZpbGVzKFxuXHRcdHZlcnNpb246IHN0cmluZyxcblx0XHRvblByb2dyZXNzPzogKHN0ZXA6IG51bWJlciwgdG90YWw6IG51bWJlcikgPT4gdm9pZCxcblx0KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZmlsZXMgPSBbXCJtYWluLmpzXCIsIFwibWFuaWZlc3QuanNvblwiLCBcInN0eWxlcy5jc3NcIl0gYXMgY29uc3Q7XG5cdFx0Y29uc3QgY29udGVudHM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fTtcblxuXHRcdGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCBmaWxlcy5sZW5ndGg7IGluZGV4KyspIHtcblx0XHRcdGNvbnN0IGZpbGUgPSBmaWxlc1tpbmRleF07XG5cdFx0XHRjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKGAke0dJVEhVQl9SQVdfQkFTRX0vJHtmaWxlfWApO1xuXHRcdFx0aWYgKCFyZXNwb25zZS5vaykge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYOS4i+i9vSAke2ZpbGV9IOWksei0pe+8miR7cmVzcG9uc2Uuc3RhdHVzfWApO1xuXHRcdFx0fVxuXHRcdFx0Y29udGVudHNbZmlsZV0gPSBhd2FpdCByZXNwb25zZS50ZXh0KCk7XG5cdFx0XHRvblByb2dyZXNzPy4oaW5kZXggKyAxLCBmaWxlcy5sZW5ndGgpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHBsdWdpbkRpciA9IHRoaXMubWFuaWZlc3QuZGlyO1xuXHRcdGlmICghcGx1Z2luRGlyKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCLml6Dms5Xojrflj5bmj5Lku7bnm67lvZVcIik7XG5cdFx0fVxuXG5cdFx0YXdhaXQgdGhpcy5hcHAudmF1bHQuYWRhcHRlci53cml0ZShgJHtwbHVnaW5EaXJ9L21haW4uanNgLCBjb250ZW50c1tcIm1haW4uanNcIl0pO1xuXHRcdGF3YWl0IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIud3JpdGUoYCR7cGx1Z2luRGlyfS9tYW5pZmVzdC5qc29uYCwgY29udGVudHNbXCJtYW5pZmVzdC5qc29uXCJdKTtcblx0XHRhd2FpdCB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLndyaXRlKGAke3BsdWdpbkRpcn0vc3R5bGVzLmNzc2AsIGNvbnRlbnRzW1wic3R5bGVzLmNzc1wiXSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHJlbG9hZFBsdWdpbih2ZXJzaW9uOiBzdHJpbmcsIGF1dG8gPSBmYWxzZSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHBsdWdpbklkID0gdGhpcy5tYW5pZmVzdC5pZDtcblx0XHRjb25zdCBhcHAgPSB0aGlzLmFwcDtcblxuXHRcdGlmIChhdXRvKSB7XG5cdFx0XHQvLyBAdHMtaWdub3JlIOKAlCDlhoXpg6ggQVBJXG5cdFx0XHRjb25zdCBzZXR0aW5nID0gYXBwLnNldHRpbmc7XG5cdFx0XHRpZiAoc2V0dGluZyAmJiBzZXR0aW5nLmFjdGl2ZVRhYj8uaWQgPT09IHBsdWdpbklkKSB7XG5cdFx0XHRcdHRoaXMucGVuZGluZ0F1dG9SZWxvYWRWZXJzaW9uID0gdmVyc2lvbjtcblx0XHRcdFx0dGhpcy53YXRjaFBlbmRpbmdBdXRvUmVsb2FkKCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRuZXcgTm90aWNlKGF1dG8gPyBg5Y+R546w5paw54mI5pys77yIJHt2ZXJzaW9ufe+8ie+8jOato+WcqOiHquWKqOabtOaWsC4uLmAgOiBg5pu05paw5a6M5oiQ77yIJHt2ZXJzaW9ufe+8ie+8jOato+WcqOmHjei9veaPkuS7ti4uLmApO1xuXG5cdFx0d2luZG93LnNldFRpbWVvdXQoYXN5bmMgKCkgPT4ge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Ly8gMS4g5Y246L295o+S5Lu2XG5cdFx0XHRcdC8vIEB0cy1pZ25vcmUg4oCUIOWGhemDqCBBUElcblx0XHRcdFx0YXdhaXQgYXBwLnBsdWdpbnMudW5sb2FkUGx1Z2luKHBsdWdpbklkKTtcblxuXHRcdFx0XHQvLyAyLiDmuIXpmaTlhoXlrZjkuK3nmoTml6cgbWFuaWZlc3Qg57yT5a2YXG5cdFx0XHRcdC8vIEB0cy1pZ25vcmUg4oCUIOWGhemDqCBBUElcblx0XHRcdFx0ZGVsZXRlIGFwcC5wbHVnaW5zLm1hbmlmZXN0c1twbHVnaW5JZF07XG5cblx0XHRcdFx0YXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHdpbmRvdy5zZXRUaW1lb3V0KHJlc29sdmUsIDMwMCkpO1xuXG5cdFx0XHRcdC8vIDMuIOmHjeaWsOivu+WPluejgeebmOS4iueahCBtYW5pZmVzdFxuXHRcdFx0XHQvLyBAdHMtaWdub3JlIOKAlCDlhoXpg6ggQVBJXG5cdFx0XHRcdGF3YWl0IGFwcC5wbHVnaW5zLmxvYWRNYW5pZmVzdHMoKTtcblxuXHRcdFx0XHRhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4gd2luZG93LnNldFRpbWVvdXQocmVzb2x2ZSwgMzAwKSk7XG5cblx0XHRcdFx0Ly8gNC4g6YeN5paw5Yqg6L295bm25ZCv55So5o+S5Lu2XG5cdFx0XHRcdC8vIEB0cy1pZ25vcmUg4oCUIOWGhemDqCBBUElcblx0XHRcdFx0YXdhaXQgYXBwLnBsdWdpbnMubG9hZFBsdWdpbihwbHVnaW5JZCk7XG5cdFx0XHRcdC8vIEB0cy1pZ25vcmUg4oCUIOWGhemDqCBBUElcblx0XHRcdFx0YXdhaXQgYXBwLnBsdWdpbnMuZW5hYmxlUGx1Z2luKHBsdWdpbklkKTtcblxuXHRcdFx0XHRhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4gd2luZG93LnNldFRpbWVvdXQocmVzb2x2ZSwgNTAwKSk7XG5cblx0XHRcdFx0Ly8gNS4g5omT5byA6K6+572u6aG1XG5cdFx0XHRcdC8vIEB0cy1pZ25vcmUg4oCUIOWGhemDqCBBUElcblx0XHRcdFx0YXBwLnNldHRpbmcub3BlbigpO1xuXHRcdFx0XHQvLyBAdHMtaWdub3JlIOKAlCDlhoXpg6ggQVBJXG5cdFx0XHRcdGFwcC5zZXR0aW5nLm9wZW5UYWJCeUlkKHBsdWdpbklkKTtcblxuXHRcdFx0XHRuZXcgTm90aWNlKGF1dG8gPyBg5o+S5Lu25bey6Ieq5Yqo5pu05paw5YiwICR7dmVyc2lvbn1gIDogYOaPkuS7tuW3sumHjei9veWIsCAke3ZlcnNpb259YCk7XG5cdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdGNvbnNvbGUuZXJyb3IoXCJbYXV0by1mcm9udG1hdHRlcl0g6YeN6L295aSx6LSlOlwiLCBlKTtcblx0XHRcdFx0bmV3IE5vdGljZShcIuiHquWKqOmHjei9veWksei0pe+8jOivt+eCueWHu+W3suWuieijheaPkuS7tumhteeahOOAjOmHjeaWsOWKoOi9veaPkuS7tuOAjeaMiemSrlwiKTtcblx0XHRcdH1cblx0XHR9LCAxMDApO1xuXHR9XG5cblx0cHJpdmF0ZSB3YXRjaFBlbmRpbmdBdXRvUmVsb2FkKCkge1xuXHRcdHRoaXMuY2xlYXJQZW5kaW5nQXV0b1JlbG9hZFRpbWVyKCk7XG5cdFx0dGhpcy5wZW5kaW5nQXV0b1JlbG9hZFRpbWVyID0gd2luZG93LnNldEludGVydmFsKCgpID0+IHtcblx0XHRcdGNvbnN0IHBsdWdpbklkID0gdGhpcy5tYW5pZmVzdC5pZDtcblx0XHRcdC8vIEB0cy1pZ25vcmUg4oCUIOWGhemDqCBBUElcblx0XHRcdGNvbnN0IHNldHRpbmcgPSB0aGlzLmFwcC5zZXR0aW5nO1xuXHRcdFx0aWYgKCFzZXR0aW5nIHx8IHNldHRpbmcuYWN0aXZlVGFiPy5pZCAhPT0gcGx1Z2luSWQpIHtcblx0XHRcdFx0dGhpcy5jbGVhclBlbmRpbmdBdXRvUmVsb2FkVGltZXIoKTtcblx0XHRcdFx0Y29uc3QgdmVyc2lvbiA9IHRoaXMucGVuZGluZ0F1dG9SZWxvYWRWZXJzaW9uO1xuXHRcdFx0XHR0aGlzLnBlbmRpbmdBdXRvUmVsb2FkVmVyc2lvbiA9IFwiXCI7XG5cdFx0XHRcdGlmICh2ZXJzaW9uKSB7XG5cdFx0XHRcdFx0dm9pZCB0aGlzLnJlbG9hZFBsdWdpbih2ZXJzaW9uLCB0cnVlKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0sIDEwMDApO1xuXHR9XG5cblx0cHJpdmF0ZSBjbGVhckF1dG9VcGRhdGVDaGVja1RpbWVyKCkge1xuXHRcdGlmICh0aGlzLmF1dG9VcGRhdGVDaGVja1RpbWVyICE9PSBudWxsKSB7XG5cdFx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMuYXV0b1VwZGF0ZUNoZWNrVGltZXIpO1xuXHRcdFx0dGhpcy5hdXRvVXBkYXRlQ2hlY2tUaW1lciA9IG51bGw7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBjbGVhclBlbmRpbmdBdXRvUmVsb2FkVGltZXIoKSB7XG5cdFx0aWYgKHRoaXMucGVuZGluZ0F1dG9SZWxvYWRUaW1lciAhPT0gbnVsbCkge1xuXHRcdFx0d2luZG93LmNsZWFySW50ZXJ2YWwodGhpcy5wZW5kaW5nQXV0b1JlbG9hZFRpbWVyKTtcblx0XHRcdHRoaXMucGVuZGluZ0F1dG9SZWxvYWRUaW1lciA9IG51bGw7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBzY2hlZHVsZUF1dG9VcGRhdGVDaGVjaygpIHtcblx0XHR0aGlzLmNsZWFyQXV0b1VwZGF0ZUNoZWNrVGltZXIoKTtcblx0XHR0aGlzLmF1dG9VcGRhdGVDaGVja1RpbWVyID0gd2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0dm9pZCB0aGlzLnJ1bkF1dG9VcGRhdGVDaGVjaygpO1xuXHRcdFx0dGhpcy5yZWdpc3RlckludGVydmFsKHdpbmRvdy5zZXRJbnRlcnZhbCgoKSA9PiB7XG5cdFx0XHRcdHZvaWQgdGhpcy5ydW5BdXRvVXBkYXRlQ2hlY2soKTtcblx0XHRcdH0sIDYwICogNjAgKiAxMDAwKSk7XG5cdFx0fSwgMzAgKiAxMDAwKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcnVuQXV0b1VwZGF0ZUNoZWNrKCkge1xuXHRcdGlmICghdGhpcy5zZXR0aW5ncy5hdXRvVXBkYXRlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5jaGVja0ZvclVwZGF0ZSgpO1xuXHRcdGlmIChyZXN1bHQuZXJyb3IgfHwgIXJlc3VsdC5oYXNVcGRhdGUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR2b2lkIHRoaXMucGVyZm9ybUF1dG9VcGRhdGUocmVzdWx0LnZlcnNpb24pO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBwZXJmb3JtQXV0b1VwZGF0ZSh2ZXJzaW9uOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0cnkge1xuXHRcdFx0bmV3IE5vdGljZShg5Y+R546w5paw54mI5pysICR7dmVyc2lvbn3vvIzmraPlnKjoh6rliqjmm7TmlrAuLi5gKTtcblx0XHRcdGF3YWl0IHRoaXMuZG93bmxvYWRBbmRXcml0ZVVwZGF0ZUZpbGVzKHZlcnNpb24pO1xuXHRcdFx0YXdhaXQgdGhpcy5yZWxvYWRQbHVnaW4odmVyc2lvbiwgdHJ1ZSk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdGNvbnNvbGUuZXJyb3IoXCJbYXV0by1mcm9udG1hdHRlcl0g6Ieq5Yqo5pu05paw5aSx6LSlOlwiLCBlcnJvcik7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBjb21wYXJlVmVyc2lvbnModjE6IHN0cmluZywgdjI6IHN0cmluZyk6IG51bWJlciB7XG5cdFx0Y29uc3QgcGFyc2VWZXJzaW9uID0gKHZlcnNpb246IHN0cmluZyk6IG51bWJlcltdID0+IHtcblx0XHRcdHJldHVybiB2ZXJzaW9uXG5cdFx0XHRcdC5yZXBsYWNlKC9edi8sIFwiXCIpXG5cdFx0XHRcdC5zcGxpdChcIi5cIilcblx0XHRcdFx0Lm1hcCgocGFydCkgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IG1hdGNoID0gL15cXGQrLy5leGVjKHBhcnQpO1xuXHRcdFx0XHRcdHJldHVybiBtYXRjaCA/IHBhcnNlSW50KG1hdGNoWzBdLCAxMCkgOiAwO1xuXHRcdFx0XHR9KTtcblx0XHR9O1xuXG5cdFx0Y29uc3QgcGFydHMxID0gcGFyc2VWZXJzaW9uKHYxKTtcblx0XHRjb25zdCBwYXJ0czIgPSBwYXJzZVZlcnNpb24odjIpO1xuXHRcdGNvbnN0IG1heExlbmd0aCA9IE1hdGgubWF4KHBhcnRzMS5sZW5ndGgsIHBhcnRzMi5sZW5ndGgpO1xuXG5cdFx0Zm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IG1heExlbmd0aDsgaW5kZXgrKykge1xuXHRcdFx0Y29uc3QgYSA9IHBhcnRzMVtpbmRleF0gPz8gMDtcblx0XHRcdGNvbnN0IGIgPSBwYXJ0czJbaW5kZXhdID8/IDA7XG5cdFx0XHRpZiAoYSA+IGIpIHJldHVybiAxO1xuXHRcdFx0aWYgKGEgPCBiKSByZXR1cm4gLTE7XG5cdFx0fVxuXHRcdHJldHVybiAwO1xuXHR9XG5cblx0cHJpdmF0ZSBzY2hlZHVsZVVwZGF0ZWRGaWVsZFJlZnJlc2goZmlsZTogVEZpbGUgfCBudWxsKSB7XG5cdFx0dGhpcy5jbGVhclVwZGF0ZVRpbWVyKCk7XG5cblx0XHRpZiAoIWZpbGUgfHwgZmlsZS5leHRlbnNpb24gIT09IFwibWRcIikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMudXBkYXRlRmlsZVBhdGggPSBmaWxlLnBhdGg7XG5cdFx0dGhpcy51cGRhdGVUaW1lciA9IHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdGNvbnN0IGFjdGl2ZUZpbGUgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlRmlsZSgpO1xuXHRcdFx0aWYgKCFhY3RpdmVGaWxlIHx8IGFjdGl2ZUZpbGUucGF0aCAhPT0gdGhpcy51cGRhdGVGaWxlUGF0aCkge1xuXHRcdFx0XHR0aGlzLmNsZWFyVXBkYXRlVGltZXIoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBwYXRoID0gdGhpcy51cGRhdGVGaWxlUGF0aDtcblx0XHRcdHRoaXMuY2xlYXJVcGRhdGVUaW1lcigpO1xuXHRcdFx0dGhpcy5yZWZyZXNoVXBkYXRlZEZpZWxkKHBhdGgpO1xuXHRcdH0sIDUwMDApO1xuXHR9XG5cblx0cHJpdmF0ZSBjbGVhclVwZGF0ZVRpbWVyKCkge1xuXHRcdGlmICh0aGlzLnVwZGF0ZVRpbWVyICE9PSBudWxsKSB7XG5cdFx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMudXBkYXRlVGltZXIpO1xuXHRcdFx0dGhpcy51cGRhdGVUaW1lciA9IG51bGw7XG5cdFx0fVxuXHRcdHRoaXMudXBkYXRlRmlsZVBhdGggPSBudWxsO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyByZWZyZXNoVXBkYXRlZEZpZWxkKHBhdGg6IHN0cmluZykge1xuXHRcdGNvbnN0IGZpbGUgPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgocGF0aCk7XG5cdFx0aWYgKCEoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGF3YWl0IHRoaXMuYXBwLnZhdWx0LnByb2Nlc3MoZmlsZSwgKGNvbnRlbnQpID0+IHtcblx0XHRcdGNvbnN0IG5leHQgPSB1cGRhdGVGcm9udG1hdHRlclVwZGF0ZWQoY29udGVudCwgZm9ybWF0TG9jYWxEYXRlKG5ldyBEYXRlKCkpKTtcblx0XHRcdHJldHVybiBuZXh0ID8/IGNvbnRlbnQ7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIHNjaGVkdWxlRW1wdHlGaWVsZEhpZ2hsaWdodENoZWNrKCkge1xuXHRcdGlmICh0aGlzLmhpZ2hsaWdodFRpbWVyICE9PSBudWxsKSB7XG5cdFx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMuaGlnaGxpZ2h0VGltZXIpO1xuXHRcdFx0dGhpcy5oaWdobGlnaHRUaW1lciA9IG51bGw7XG5cdFx0fVxuXG5cdFx0Y29uc3QgYWN0aXZlRmlsZSA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVGaWxlKCk7XG5cdFx0Y29uc3QgYWN0aXZlUGF0aCA9IGFjdGl2ZUZpbGU/LnBhdGggPz8gbnVsbDtcblx0XHRpZiAodGhpcy5oaWdobGlnaHRGaWxlUGF0aCAhPT0gYWN0aXZlUGF0aCkge1xuXHRcdFx0dGhpcy5jbGVhckVtcHR5RmllbGRIaWdobGlnaHRzKCk7XG5cdFx0XHR0aGlzLmNsZWFySGlnaGxpZ2h0SW50ZXJ2YWwoKTtcblx0XHRcdHRoaXMuaGlnaGxpZ2h0RmlsZVBhdGggPSBhY3RpdmVQYXRoO1xuXHRcdH1cblxuXHRcdGlmIChcblx0XHRcdCF0aGlzLnNldHRpbmdzLmVtcHR5RmllbGRIaWdobGlnaHQgfHxcblx0XHRcdCFhY3RpdmVGaWxlIHx8XG5cdFx0XHRhY3RpdmVGaWxlLmV4dGVuc2lvbiAhPT0gXCJtZFwiXG5cdFx0KSB7XG5cdFx0XHR0aGlzLmNsZWFySGlnaGxpZ2h0SW50ZXJ2YWwoKTtcblx0XHRcdHRoaXMuY2xlYXJFbXB0eUZpZWxkSGlnaGxpZ2h0cygpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuaGlnaGxpZ2h0VGltZXIgPSB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHR0aGlzLmhpZ2hsaWdodFRpbWVyID0gbnVsbDtcblx0XHRcdHRoaXMuYXBwbHlFbXB0eUZpZWxkSGlnaGxpZ2h0cygpO1xuXHRcdFx0dGhpcy5lbnN1cmVIaWdobGlnaHRJbnRlcnZhbCgpO1xuXHRcdH0sIDMwMCk7XG5cdH1cblxuXHRwcml2YXRlIHNjaGVkdWxlRm9sZGVyQ2hlY2ttYXJrUmVmcmVzaCgpIHtcblx0XHR0aGlzLmNsZWFyRm9sZGVyQ2hlY2ttYXJrVGltZXIoKTtcblx0XHR0aGlzLmZvbGRlckNoZWNrbWFya1RpbWVyID0gd2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0dGhpcy5mb2xkZXJDaGVja21hcmtUaW1lciA9IG51bGw7XG5cdFx0XHR0aGlzLmFwcGx5Rm9sZGVyQ2hlY2ttYXJrcygpO1xuXHRcdH0sIDApO1xuXHR9XG5cblx0cHJpdmF0ZSBjbGVhckZvbGRlckNoZWNrbWFya1RpbWVyKCkge1xuXHRcdGlmICh0aGlzLmZvbGRlckNoZWNrbWFya1RpbWVyICE9PSBudWxsKSB7XG5cdFx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMuZm9sZGVyQ2hlY2ttYXJrVGltZXIpO1xuXHRcdFx0dGhpcy5mb2xkZXJDaGVja21hcmtUaW1lciA9IG51bGw7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhcHBseUZvbGRlckNoZWNrbWFya3MoKSB7XG5cdFx0dGhpcy5jbGVhckZvbGRlckNoZWNrbWFya3MoKTtcblx0XHRpZiAoIXRoaXMuc2V0dGluZ3Muc2hvd0ZvbGRlckNoZWNrbWFyaykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJ1bGVGb2xkZXJzID0gbmV3IFNldChcblx0XHRcdHRoaXMuc2V0dGluZ3MuZm9sZGVyRGVmYXVsdHNcblx0XHRcdFx0Lm1hcCgocnVsZSkgPT4gcnVsZS5mb2xkZXIpXG5cdFx0XHRcdC5maWx0ZXIoKGZvbGRlcikgPT4gZm9sZGVyLmxlbmd0aCA+IDApLFxuXHRcdCk7XG5cdFx0aWYgKHJ1bGVGb2xkZXJzLnNpemUgPT09IDApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBmb2xkZXJUaXRsZXMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50PihcIi5uYXYtZm9sZGVyLXRpdGxlXCIpO1xuXHRcdGZvciAoY29uc3QgdGl0bGVFbCBvZiBBcnJheS5mcm9tKGZvbGRlclRpdGxlcykpIHtcblx0XHRcdGNvbnN0IGZvbGRlclBhdGggPVxuXHRcdFx0XHR0aXRsZUVsLmdldEF0dHJpYnV0ZShcImRhdGEtcGF0aFwiKSA/P1xuXHRcdFx0XHR0aXRsZUVsLmNsb3Nlc3QoXCIubmF2LWZvbGRlclwiKT8uZ2V0QXR0cmlidXRlKFwiZGF0YS1wYXRoXCIpID8/XG5cdFx0XHRcdFwiXCI7XG5cdFx0XHRpZiAoIXJ1bGVGb2xkZXJzLmhhcyhmb2xkZXJQYXRoKSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0dGl0bGVFbC5jcmVhdGVTcGFuKHtcblx0XHRcdFx0Y2xzOiBcImZyb250bWF0dGVyLWZvbGRlci1jaGVja1wiLFxuXHRcdFx0XHR0ZXh0OiBcIuKck1wiLFxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBjbGVhckZvbGRlckNoZWNrbWFya3MoKSB7XG5cdFx0ZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChcIi5mcm9udG1hdHRlci1mb2xkZXItY2hlY2tcIikuZm9yRWFjaCgoZWwpID0+IHtcblx0XHRcdGVsLnJlbW92ZSgpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBlbnN1cmVIaWdobGlnaHRJbnRlcnZhbCgpIHtcblx0XHRpZiAodGhpcy5oaWdobGlnaHRJbnRlcnZhbCAhPT0gbnVsbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuaGlnaGxpZ2h0SW50ZXJ2YWwgPSB3aW5kb3cuc2V0SW50ZXJ2YWwoKCkgPT4ge1xuXHRcdFx0dGhpcy5hcHBseUVtcHR5RmllbGRIaWdobGlnaHRzKCk7XG5cdFx0fSwgMjAwMCk7XG5cdH1cblxuXHRwcml2YXRlIGNsZWFySGlnaGxpZ2h0VGltZXJzKCkge1xuXHRcdGlmICh0aGlzLmhpZ2hsaWdodFRpbWVyICE9PSBudWxsKSB7XG5cdFx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMuaGlnaGxpZ2h0VGltZXIpO1xuXHRcdFx0dGhpcy5oaWdobGlnaHRUaW1lciA9IG51bGw7XG5cdFx0fVxuXHRcdHRoaXMuY2xlYXJIaWdobGlnaHRJbnRlcnZhbCgpO1xuXHR9XG5cblx0cHJpdmF0ZSBjbGVhckhpZ2hsaWdodEludGVydmFsKCkge1xuXHRcdGlmICh0aGlzLmhpZ2hsaWdodEludGVydmFsICE9PSBudWxsKSB7XG5cdFx0XHR3aW5kb3cuY2xlYXJJbnRlcnZhbCh0aGlzLmhpZ2hsaWdodEludGVydmFsKTtcblx0XHRcdHRoaXMuaGlnaGxpZ2h0SW50ZXJ2YWwgPSBudWxsO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXBwbHlFbXB0eUZpZWxkSGlnaGxpZ2h0cygpIHtcblx0XHRjb25zdCBhY3RpdmVGaWxlID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKTtcblx0XHRpZiAoXG5cdFx0XHQhdGhpcy5zZXR0aW5ncy5lbXB0eUZpZWxkSGlnaGxpZ2h0IHx8XG5cdFx0XHQhYWN0aXZlRmlsZSB8fFxuXHRcdFx0YWN0aXZlRmlsZS5leHRlbnNpb24gIT09IFwibWRcIlxuXHRcdCkge1xuXHRcdFx0dGhpcy5jbGVhckhpZ2hsaWdodEludGVydmFsKCk7XG5cdFx0XHR0aGlzLmNsZWFyRW1wdHlGaWVsZEhpZ2hsaWdodHMoKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBmcm9udG1hdHRlciA9IHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKGFjdGl2ZUZpbGUpPy5mcm9udG1hdHRlciA/PyB7fTtcblx0XHRjb25zdCBlbXB0eUZpZWxkcyA9IG5ldyBTZXQoXG5cdFx0XHRISUdITElHSFRfRklFTERTLmZpbHRlcigoZmllbGQpID0+IGlzRW1wdHlGcm9udG1hdHRlclZhbHVlKGZyb250bWF0dGVyW2ZpZWxkXSkpLFxuXHRcdCk7XG5cdFx0dGhpcy51cGRhdGVFbXB0eUZpZWxkSGlnaGxpZ2h0cyhlbXB0eUZpZWxkcyk7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZUVtcHR5RmllbGRIaWdobGlnaHRzKGVtcHR5RmllbGRzOiBTZXQ8SGlnaGxpZ2h0RmllbGQ+KSB7XG5cdFx0Y29uc3QgY29udGFpbmVycyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTEVsZW1lbnQ+KFwiLm1ldGFkYXRhLWNvbnRhaW5lclwiKTtcblx0XHRmb3IgKGNvbnN0IGNvbnRhaW5lciBvZiBBcnJheS5mcm9tKGNvbnRhaW5lcnMpKSB7XG5cdFx0XHRBcnJheS5mcm9tKGNvbnRhaW5lci5xdWVyeVNlbGVjdG9yQWxsKFwiLmZyb250bWF0dGVyLWVtcHR5LWhpZ2hsaWdodFwiKSkuZm9yRWFjaCgoZWwpID0+IHtcblx0XHRcdFx0cmVtb3ZlRW1wdHlIaWdobGlnaHRDbGFzc2VzKGVsKTtcblx0XHRcdH0pO1xuXG5cdFx0XHRjb25zdCBlbXB0eVJvd3MgPSBBcnJheS5mcm9tKGVtcHR5RmllbGRzKVxuXHRcdFx0XHQubWFwKChmaWVsZCkgPT4gZmluZE1ldGFkYXRhUm93KGNvbnRhaW5lciwgZmllbGQpKVxuXHRcdFx0XHQuZmlsdGVyKChyb3cpOiByb3cgaXMgSFRNTEVsZW1lbnQgPT4gcm93ICE9PSBudWxsKVxuXHRcdFx0XHQuc29ydCgoYSwgYikgPT4gZ2V0RG9jdW1lbnRPcmRlcihhLCBiKSk7XG5cblx0XHRcdGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCBlbXB0eVJvd3MubGVuZ3RoOyBpbmRleCsrKSB7XG5cdFx0XHRcdGVtcHR5Um93c1tpbmRleF0uY2xhc3NMaXN0LmFkZChcblx0XHRcdFx0XHRcImZyb250bWF0dGVyLWVtcHR5LWhpZ2hsaWdodFwiLFxuXHRcdFx0XHRcdGBmcm9udG1hdHRlci1lbXB0eS0keyhpbmRleCAlIEhJR0hMSUdIVF9GSUVMRFMubGVuZ3RoKSArIDF9YCxcblx0XHRcdFx0KTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGNsZWFyRW1wdHlGaWVsZEhpZ2hsaWdodHMoKSB7XG5cdFx0ZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChcIi5mcm9udG1hdHRlci1lbXB0eS1oaWdobGlnaHRcIikuZm9yRWFjaCgoZWwpID0+IHtcblx0XHRcdHJlbW92ZUVtcHR5SGlnaGxpZ2h0Q2xhc3NlcyhlbCk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIHNjaGVkdWxlQUlTdW1tYXJ5QnV0dG9uUmVmcmVzaCgpIHtcblx0XHR0aGlzLmNsZWFyQUlTdW1tYXJ5QnV0dG9uVGltZXIoKTtcblx0XHR0aGlzLmFib3J0QUlTdW1tYXJ5U3RyZWFtKCk7XG5cdFx0dGhpcy5haUJ1dHRvblRpbWVyID0gd2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0dGhpcy5haUJ1dHRvblRpbWVyID0gbnVsbDtcblx0XHRcdHRoaXMuYWRkQUlTdW1tYXJ5QnV0dG9uKCk7XG5cdFx0fSwgMzAwKTtcblx0fVxuXG5cdHByaXZhdGUgc2NoZWR1bGVEZWxheWVkQUlTdW1tYXJ5QnV0dG9uUmVmcmVzaCgpIHtcblx0XHR0aGlzLmNsZWFyQUlTdW1tYXJ5QnV0dG9uVGltZXIoKTtcblx0XHR0aGlzLmFpQnV0dG9uVGltZXIgPSB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHR0aGlzLmFpQnV0dG9uVGltZXIgPSBudWxsO1xuXHRcdFx0dGhpcy5hZGRBSVN1bW1hcnlCdXR0b24oKTtcblx0XHR9LCAxMDAwKTtcblx0fVxuXG5cdHByaXZhdGUgY2xlYXJBSVN1bW1hcnlCdXR0b25UaW1lcigpIHtcblx0XHRpZiAodGhpcy5haUJ1dHRvblRpbWVyICE9PSBudWxsKSB7XG5cdFx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMuYWlCdXR0b25UaW1lcik7XG5cdFx0XHR0aGlzLmFpQnV0dG9uVGltZXIgPSBudWxsO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgY2xlYXJBSVN1bW1hcnlCdXR0b25zKCkge1xuXHRcdGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCIuZnJvbnRtYXR0ZXItYWktc3VtbWFyeS1idG4sIC5mcm9udG1hdHRlci1haS1zdW1tYXJ5LWNvbmZpcm1cIikuZm9yRWFjaCgoZWwpID0+IHtcblx0XHRcdGVsLnJlbW92ZSgpO1xuXHRcdH0pO1xuXHRcdGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCIuZnJvbnRtYXR0ZXItYWktc3VtbWFyeS1yb3dcIikuZm9yRWFjaCgoZWwpID0+IHtcblx0XHRcdGNvbnN0IHJvdyA9IGVsIGFzIEhUTUxFbGVtZW50ICYge1xuXHRcdFx0XHRmcm9udG1hdHRlckFpRm9jdXNIYW5kbGVyPzogRXZlbnRMaXN0ZW5lcjtcblx0XHRcdFx0ZnJvbnRtYXR0ZXJBaUJsdXJIYW5kbGVyPzogRXZlbnRMaXN0ZW5lcjtcblx0XHRcdH07XG5cdFx0XHRjb25zdCB2YWx1ZUVsID0gZmluZE1ldGFkYXRhVmFsdWVDb250YWluZXIocm93KTtcblx0XHRcdGlmICh2YWx1ZUVsICYmIHJvdy5mcm9udG1hdHRlckFpRm9jdXNIYW5kbGVyKSB7XG5cdFx0XHRcdHZhbHVlRWwucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImZvY3VzaW5cIiwgcm93LmZyb250bWF0dGVyQWlGb2N1c0hhbmRsZXIpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHZhbHVlRWwgJiYgcm93LmZyb250bWF0dGVyQWlCbHVySGFuZGxlcikge1xuXHRcdFx0XHR2YWx1ZUVsLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJmb2N1c291dFwiLCByb3cuZnJvbnRtYXR0ZXJBaUJsdXJIYW5kbGVyKTtcblx0XHRcdH1cblx0XHRcdGRlbGV0ZSByb3cuZnJvbnRtYXR0ZXJBaUZvY3VzSGFuZGxlcjtcblx0XHRcdGRlbGV0ZSByb3cuZnJvbnRtYXR0ZXJBaUJsdXJIYW5kbGVyO1xuXHRcdH0pO1xuXHRcdGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCIuZnJvbnRtYXR0ZXItYWktc3VtbWFyeS1yb3dcIikuZm9yRWFjaCgoZWwpID0+IHtcblx0XHRcdGVsLmNsYXNzTGlzdC5yZW1vdmUoXCJmcm9udG1hdHRlci1haS1zdW1tYXJ5LXJvd1wiKTtcblx0XHR9KTtcblx0XHRkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiLmZyb250bWF0dGVyLWFpLXN1bW1hcnktbG9hZGluZ1wiKS5mb3JFYWNoKChlbCkgPT4ge1xuXHRcdFx0ZWwuY2xhc3NMaXN0LnJlbW92ZShcImZyb250bWF0dGVyLWFpLXN1bW1hcnktbG9hZGluZ1wiKTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgYWJvcnRBSVN1bW1hcnlTdHJlYW0oKSB7XG5cdFx0dGhpcy5haVN1bW1hcnlBYm9ydENvbnRyb2xsZXI/LmFib3J0KCk7XG5cdFx0dGhpcy5haVN1bW1hcnlBYm9ydENvbnRyb2xsZXIgPSBudWxsO1xuXHR9XG5cblx0cHJpdmF0ZSBhZGRBSVN1bW1hcnlCdXR0b24oKSB7XG5cdFx0dGhpcy5hcHBseUFJU3VtbWFyeUJ1dHRvbnMoKTtcblx0fVxuXG5cdHByaXZhdGUgYXBwbHlBSVN1bW1hcnlCdXR0b25zKCkge1xuXHRcdHRoaXMuY2xlYXJBSVN1bW1hcnlCdXR0b25zKCk7XG5cdFx0Y29uc3QgYWN0aXZlRmlsZSA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVGaWxlKCk7XG5cdFx0aWYgKCFhY3RpdmVGaWxlIHx8IGFjdGl2ZUZpbGUuZXh0ZW5zaW9uICE9PSBcIm1kXCIpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBjb250YWluZXJzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbDxIVE1MRWxlbWVudD4oXCIubWV0YWRhdGEtY29udGFpbmVyXCIpO1xuXHRcdGZvciAoY29uc3QgY29udGFpbmVyIG9mIEFycmF5LmZyb20oY29udGFpbmVycykpIHtcblx0XHRcdGNvbnN0IHJvdyA9IGZpbmRNZXRhZGF0YVJvdyhjb250YWluZXIsIFwi5pGY6KaBXCIpO1xuXHRcdFx0aWYgKFxuXHRcdFx0XHQhcm93IHx8XG5cdFx0XHRcdCFyb3cuaXNDb25uZWN0ZWQgfHxcblx0XHRcdFx0IWRvY3VtZW50LmNvbnRhaW5zKHJvdykgfHxcblx0XHRcdFx0cm93LnF1ZXJ5U2VsZWN0b3IoXCIuZnJvbnRtYXR0ZXItYWktc3VtbWFyeS1idG4sIC5mcm9udG1hdHRlci1haS1zdW1tYXJ5LWNvbmZpcm1cIilcblx0XHRcdCkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc29sZS5sb2coXCJbQUnmkZjopoFdIOaRmOimgeihjCBET006XCIsIHJvdy5vdXRlckhUTUwpO1xuXHRcdFx0cm93LmFkZENsYXNzKFwiZnJvbnRtYXR0ZXItYWktc3VtbWFyeS1yb3dcIik7XG5cdFx0XHRjb25zdCB2YWx1ZUVsID0gZmluZE1ldGFkYXRhVmFsdWVDb250YWluZXIocm93KTtcblx0XHRcdGNvbnN0IHN1bW1hcnkgPSBub3JtYWxpemVGcm9udG1hdHRlclNjYWxhcihcblx0XHRcdFx0dGhpcy5hcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoYWN0aXZlRmlsZSk/LmZyb250bWF0dGVyPy5bXCLmkZjopoFcIl0sXG5cdFx0XHQpO1xuXHRcdFx0aWYgKCFzdW1tYXJ5KSB7XG5cdFx0XHRcdHRoaXMuc2hvd0FJU3VtbWFyeUJ1dHRvbihyb3csIGFjdGl2ZUZpbGUsIFwiZnVsbFwiKTtcblx0XHRcdH0gZWxzZSBpZiAodmFsdWVFbCkge1xuXHRcdFx0XHRjb25zdCByb3dXaXRoSGFuZGxlcnMgPSByb3cgYXMgSFRNTEVsZW1lbnQgJiB7XG5cdFx0XHRcdFx0ZnJvbnRtYXR0ZXJBaUZvY3VzSGFuZGxlcj86IEV2ZW50TGlzdGVuZXI7XG5cdFx0XHRcdFx0ZnJvbnRtYXR0ZXJBaUJsdXJIYW5kbGVyPzogRXZlbnRMaXN0ZW5lcjtcblx0XHRcdFx0fTtcblx0XHRcdFx0bGV0IGhpZGVUaW1lcjogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG5cdFx0XHRcdHJvd1dpdGhIYW5kbGVycy5mcm9udG1hdHRlckFpRm9jdXNIYW5kbGVyID0gKCkgPT4ge1xuXHRcdFx0XHRcdGlmIChoaWRlVGltZXIgIT09IG51bGwpIHtcblx0XHRcdFx0XHRcdHdpbmRvdy5jbGVhclRpbWVvdXQoaGlkZVRpbWVyKTtcblx0XHRcdFx0XHRcdGhpZGVUaW1lciA9IG51bGw7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHRoaXMuc2hvd0FJU3VtbWFyeUJ1dHRvbihyb3csIGFjdGl2ZUZpbGUsIFwiaWNvblwiKTtcblx0XHRcdFx0fTtcblx0XHRcdFx0cm93V2l0aEhhbmRsZXJzLmZyb250bWF0dGVyQWlCbHVySGFuZGxlciA9ICgpID0+IHtcblx0XHRcdFx0XHRpZiAoaGlkZVRpbWVyICE9PSBudWxsKSB7XG5cdFx0XHRcdFx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0KGhpZGVUaW1lcik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGhpZGVUaW1lciA9IHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdFx0XHRcdGlmICghcm93LnF1ZXJ5U2VsZWN0b3IoXCIuZnJvbnRtYXR0ZXItYWktc3VtbWFyeS1jb25maXJtXCIpKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuaGlkZUFJU3VtbWFyeUJ1dHRvbihyb3cpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0sIDIwMCk7XG5cdFx0XHRcdH07XG5cdFx0XHRcdHZhbHVlRWwuYWRkRXZlbnRMaXN0ZW5lcihcImZvY3VzaW5cIiwgcm93V2l0aEhhbmRsZXJzLmZyb250bWF0dGVyQWlGb2N1c0hhbmRsZXIpO1xuXHRcdFx0XHR2YWx1ZUVsLmFkZEV2ZW50TGlzdGVuZXIoXCJmb2N1c291dFwiLCByb3dXaXRoSGFuZGxlcnMuZnJvbnRtYXR0ZXJBaUJsdXJIYW5kbGVyKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHNob3dBSVN1bW1hcnlCdXR0b24ocm93OiBIVE1MRWxlbWVudCwgZmlsZTogVEZpbGUsIHZhcmlhbnQ6IFwiZnVsbFwiIHwgXCJpY29uXCIpIHtcblx0XHRpZiAocm93LnF1ZXJ5U2VsZWN0b3IoXCIuZnJvbnRtYXR0ZXItYWktc3VtbWFyeS1idG4sIC5mcm9udG1hdHRlci1haS1zdW1tYXJ5LWNvbmZpcm1cIikpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBidXR0b24gPSByb3cuY3JlYXRlRWwoXCJidXR0b25cIiwge1xuXHRcdFx0Y2xzOiBgZnJvbnRtYXR0ZXItYWktc3VtbWFyeS1idG4gaXMtJHt2YXJpYW50fWAsXG5cdFx0XHRhdHRyOiB7IFwiYXJpYS1sYWJlbFwiOiBcIkFJIOeUn+aIkOaRmOimgVwiIH0sXG5cdFx0fSk7XG5cdFx0c2V0SWNvbihidXR0b24sIFwic3BhcmtsZXNcIik7XG5cdFx0aWYgKHZhcmlhbnQgPT09IFwiZnVsbFwiKSB7XG5cdFx0XHRidXR0b24uY3JlYXRlU3Bhbih7IHRleHQ6IFwiQUnmkZjopoFcIiB9KTtcblx0XHR9XG5cdFx0YnV0dG9uLm9uY2xpY2sgPSAoZXZlbnQpID0+IHtcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdHRoaXMuc2hvd0FJU3VtbWFyeUNvbmZpcm0ocm93LCBmaWxlLCBidXR0b24pO1xuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIGhpZGVBSVN1bW1hcnlCdXR0b24ocm93OiBIVE1MRWxlbWVudCkge1xuXHRcdHJvdy5xdWVyeVNlbGVjdG9yKFwiLmZyb250bWF0dGVyLWFpLXN1bW1hcnktYnRuXCIpPy5yZW1vdmUoKTtcblx0fVxuXG5cdHByaXZhdGUgc2hvd0FJU3VtbWFyeUNvbmZpcm0ocm93OiBIVE1MRWxlbWVudCwgZmlsZTogVEZpbGUsIGJ1dHRvbjogSFRNTEVsZW1lbnQpIHtcblx0XHRidXR0b24ucmVtb3ZlKCk7XG5cdFx0cm93LnF1ZXJ5U2VsZWN0b3IoXCIuZnJvbnRtYXR0ZXItYWktc3VtbWFyeS1jb25maXJtXCIpPy5yZW1vdmUoKTtcblx0XHRjb25zdCBvbGRTdW1tYXJ5ID0gbm9ybWFsaXplRnJvbnRtYXR0ZXJTY2FsYXIoXG5cdFx0XHR0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShmaWxlKT8uZnJvbnRtYXR0ZXI/LltcIuaRmOimgVwiXSxcblx0XHQpO1xuXHRcdGNvbnN0IGNvbmZpcm1FbCA9IHJvdy5jcmVhdGVTcGFuKHsgY2xzOiBcImZyb250bWF0dGVyLWFpLXN1bW1hcnktY29uZmlybVwiIH0pO1xuXHRcdGNvbmZpcm1FbC5jcmVhdGVTcGFuKHtcblx0XHRcdGNsczogXCJmcm9udG1hdHRlci1haS1zdW1tYXJ5LWNvbmZpcm0tdGV4dFwiLFxuXHRcdFx0dGV4dDogb2xkU3VtbWFyeSA/IFwi4pyoIEFJIOabtOaWsO+8n1wiIDogXCLinKggQUkg55Sf5oiQ77yfXCIsXG5cdFx0fSk7XG5cdFx0Y29uc3QgYWNjZXB0QnV0dG9uID0gY29uZmlybUVsLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgY2xzOiBcImZyb250bWF0dGVyLWFpLXN1bW1hcnktY29uZmlybS1pY29uXCIgfSk7XG5cdFx0c2V0SWNvbihhY2NlcHRCdXR0b24sIFwiY2hlY2tcIik7XG5cdFx0Y29uc3QgY2FuY2VsQnV0dG9uID0gY29uZmlybUVsLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgY2xzOiBcImZyb250bWF0dGVyLWFpLXN1bW1hcnktY29uZmlybS1pY29uXCIgfSk7XG5cdFx0c2V0SWNvbihjYW5jZWxCdXR0b24sIFwieFwiKTtcblxuXHRcdGNhbmNlbEJ1dHRvbi5vbmNsaWNrID0gKGV2ZW50KSA9PiB7XG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0ZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0XHRjb25maXJtRWwucmVtb3ZlKCk7XG5cdFx0XHR0aGlzLmFwcGx5QUlTdW1tYXJ5QnV0dG9ucygpO1xuXHRcdH07XG5cdFx0YWNjZXB0QnV0dG9uLm9uY2xpY2sgPSAoZXZlbnQpID0+IHtcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdHZvaWQgdGhpcy5ydW5NZXRhZGF0YUFJU3VtbWFyeShmaWxlLCByb3csIGNvbmZpcm1FbCk7XG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcnVuTWV0YWRhdGFBSVN1bW1hcnkoZmlsZTogVEZpbGUsIHJvdzogSFRNTEVsZW1lbnQsIGNvbmZpcm1FbDogSFRNTEVsZW1lbnQpIHtcblx0XHRjb25zdCB2YWx1ZUVsID0gZmluZE1ldGFkYXRhVmFsdWVDb250YWluZXIocm93KSA/PyByb3c7XG5cdFx0Y29uc3Qgb3JpZ2luYWxWYWx1ZSA9IHZhbHVlRWwudGV4dENvbnRlbnQgPz8gXCJcIjtcblx0XHRjb25maXJtRWwucmVtb3ZlKCk7XG5cdFx0dGhpcy5hYm9ydEFJU3VtbWFyeVN0cmVhbSgpO1xuXHRcdGNvbnN0IGNvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG5cdFx0dGhpcy5haVN1bW1hcnlBYm9ydENvbnRyb2xsZXIgPSBjb250cm9sbGVyO1xuXHRcdGxldCBzdHJlYW1lZFRleHQgPSBcIlwiO1xuXHRcdGxldCBmaW5hbFRleHQgPSBvcmlnaW5hbFZhbHVlO1xuXHRcdGxldCBkaWRTdWNjZWVkID0gZmFsc2U7XG5cdFx0bGV0IGZhbGxiYWNrRG90c1RpbWVyOiBudW1iZXIgfCBudWxsID0gd2luZG93LnNldEludGVydmFsKCgpID0+IHtcblx0XHRcdGlmIChzdHJlYW1lZFRleHQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0dmFsdWVFbC50ZXh0Q29udGVudCA9IHZhbHVlRWwudGV4dENvbnRlbnQgPT09IFwiwrfCt8K3XCIgPyBcIsK3XCIgOiBgJHt2YWx1ZUVsLnRleHRDb250ZW50fcK3YDtcblx0XHR9LCAzNTApO1xuXHRcdHZhbHVlRWwuZW1wdHkoKTtcblx0XHR2YWx1ZUVsLmFkZENsYXNzKFwiZnJvbnRtYXR0ZXItYWktc3VtbWFyeS1sb2FkaW5nXCIpO1xuXHRcdHZhbHVlRWwuc2V0VGV4dChcInxcIik7XG5cblx0XHR0cnkge1xuXHRcdFx0Y29uc3Qgc3VtbWFyeSA9IGF3YWl0IHRoaXMuZ2VuZXJhdGVTdW1tYXJ5Rm9yTWV0YWRhdGFCdXR0b24oZmlsZSwgKGRlbHRhKSA9PiB7XG5cdFx0XHRcdGlmICghZGVsdGEpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0c3RyZWFtZWRUZXh0ICs9IGRlbHRhO1xuXHRcdFx0XHR2YWx1ZUVsLnNldFRleHQoYCR7c3RyZWFtZWRUZXh0fXxgKTtcblx0XHRcdFx0fSwgY29udHJvbGxlci5zaWduYWwpO1xuXHRcdFx0XHRpZiAoZmFsbGJhY2tEb3RzVGltZXIgIT09IG51bGwpIHtcblx0XHRcdFx0XHR3aW5kb3cuY2xlYXJJbnRlcnZhbChmYWxsYmFja0RvdHNUaW1lcik7XG5cdFx0XHRcdFx0ZmFsbGJhY2tEb3RzVGltZXIgPSBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGZpbmFsVGV4dCA9IHN1bW1hcnkgfHwgc3RyZWFtZWRUZXh0O1xuXHRcdFx0XHRkaWRTdWNjZWVkID0gQm9vbGVhbihmaW5hbFRleHQpO1xuXHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0aWYgKCFjb250cm9sbGVyLnNpZ25hbC5hYm9ydGVkKSB7XG5cdFx0XHRcdFx0bmV3IE5vdGljZShgQUkg5pGY6KaB55Sf5oiQ5aSx6LSl77yaJHtnZXRFcnJvck1lc3NhZ2UoZXJyb3IpfWApO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGZpbmFsbHkge1xuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRpZiAoZmFsbGJhY2tEb3RzVGltZXIgIT09IG51bGwpIHtcblx0XHRcdFx0XHRcdFx0d2luZG93LmNsZWFySW50ZXJ2YWwoZmFsbGJhY2tEb3RzVGltZXIpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aWYgKHRoaXMuYWlTdW1tYXJ5QWJvcnRDb250cm9sbGVyID09PSBjb250cm9sbGVyKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuYWlTdW1tYXJ5QWJvcnRDb250cm9sbGVyID0gbnVsbDtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmIChkaWRTdWNjZWVkKSB7XG5cdFx0XHRcdFx0XHRcdG5ldyBOb3RpY2UoXCJBSSDmkZjopoHnlJ/miJDmiJDlip9cIik7XG5cdFx0XHRcdFx0XHRcdHRoaXMuc2NoZWR1bGVEZWxheWVkQUlTdW1tYXJ5QnV0dG9uUmVmcmVzaCgpO1xuXHRcdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdHZhbHVlRWwucmVtb3ZlQ2xhc3MoXCJmcm9udG1hdHRlci1haS1zdW1tYXJ5LWxvYWRpbmdcIik7XG5cdFx0XHRcdFx0XHR2YWx1ZUVsLnNldFRleHQob3JpZ2luYWxWYWx1ZSk7XG5cdFx0XHRcdFx0XHR0aGlzLnNjaGVkdWxlQUlTdW1tYXJ5QnV0dG9uUmVmcmVzaCgpO1xuXHRcdFx0XHRcdH0gY2F0Y2ggKGNsZWFudXBFcnJvcikge1xuXHRcdFx0XHRcdFx0Y29uc29sZS5lcnJvcihcIlthdXRvLWZyb250bWF0dGVyXSBBSSBzdW1tYXJ5IGNsZWFudXAgZmFpbGVkXCIsIGNsZWFudXBFcnJvcik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5jbGFzcyBGb2xkZXJSdWxlTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG5cdHByaXZhdGUgZmllbGQ6IEZvbGRlckRlZmF1bHRGaWVsZCB8IFwiXCIgPSBcIlwiO1xuXHRwcml2YXRlIHZhbHVlID0gXCJcIjtcblx0cHJpdmF0ZSBpc0N1c3RvbVZhbHVlID0gZmFsc2U7XG5cdHByaXZhdGUgY3VzdG9tVmFsdWVJbnB1dEVsOiBIVE1MSW5wdXRFbGVtZW50IHwgbnVsbCA9IG51bGw7XG5cdHByaXZhdGUgY3VzdG9tVmFsdWVCbHVySGFuZGxlcjogKChldmVudDogRm9jdXNFdmVudCkgPT4gdm9pZCkgfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSBjdXN0b21WYWx1ZUtleWRvd25IYW5kbGVyOiAoKGV2ZW50OiBLZXlib2FyZEV2ZW50KSA9PiB2b2lkKSB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIHN1Ym1pdEJ1dHRvbkVsOiBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGwgPSBudWxsO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGFwcDogQXBwLFxuXHRcdHByaXZhdGUgcGx1Z2luOiBBdXRvRnJvbnRtYXR0ZXJQbHVnaW4sXG5cdFx0cHJpdmF0ZSBmb2xkZXI6IHN0cmluZyxcblx0KSB7XG5cdFx0c3VwZXIoYXBwKTtcblx0XHR0aGlzLmZpZWxkID0gdGhpcy5nZXRJbml0aWFsRmllbGQoKTtcblx0XHR0aGlzLnZhbHVlID0gdGhpcy5maW5kRXhpc3RpbmdWYWx1ZSh0aGlzLmZpZWxkKTtcblx0fVxuXG5cdG9uT3BlbigpIHtcblx0XHR0aGlzLnJlbmRlcigpO1xuXHR9XG5cblx0b25DbG9zZSgpIHtcblx0XHR0aGlzLmNsZWFudXBDdXN0b21WYWx1ZUlucHV0KCk7XG5cdFx0dGhpcy5zdWJtaXRCdXR0b25FbCA9IG51bGw7XG5cdFx0dGhpcy5jb250ZW50RWwuZW1wdHkoKTtcblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyKCkge1xuXHRcdGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuXHRcdHRoaXMuY2xlYW51cEN1c3RvbVZhbHVlSW5wdXQoKTtcblx0XHRjb250ZW50RWwuZW1wdHkoKTtcblx0XHRjb250ZW50RWwuY3JlYXRlRWwoXCJoMlwiLCB7IHRleHQ6IFwi6K6+572u5bGe5oCn5Yy56YWN6KeE5YiZXCIgfSk7XG5cdFx0Y29uc3QgaW5oZXJpdGVkUnVsZXMgPSBnZXRBbmNlc3RvclJ1bGVzKHRoaXMuZm9sZGVyLCB0aGlzLnBsdWdpbi5zZXR0aW5ncy5mb2xkZXJEZWZhdWx0cyk7XG5cdFx0Zm9yIChjb25zdCBydWxlIG9mIGluaGVyaXRlZFJ1bGVzKSB7XG5cdFx0XHRjb250ZW50RWwuY3JlYXRlRGl2KHtcblx0XHRcdFx0Y2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItbW9kYWwtaW5oZXJpdGVkLXJ1bGVcIixcblx0XHRcdFx0dGV4dDogYOKGkSDnu6fmib/oh6ogJHtydWxlLmZvbGRlcn0g4oaSICR7cnVsZS5maWVsZH06ICR7cnVsZS52YWx1ZX1gLFxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0bmV3IFNldHRpbmcoY29udGVudEVsKVxuXHRcdFx0LnNldE5hbWUoXCLmlofku7blpLlcIilcblx0XHRcdC5zZXREZXNjKHRoaXMuZm9sZGVyIHx8IFwiL1wiKTtcblxuXHRcdG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcblx0XHRcdC5zZXROYW1lKFwi5a2X5q61XCIpXG5cdFx0XHQuYWRkRHJvcGRvd24oKGRyb3Bkb3duKSA9PiB7XG5cdFx0XHRcdGRyb3Bkb3duLmFkZE9wdGlvbihcIlwiLCBcIuacqumFjee9rlwiKTtcblx0XHRcdFx0Zm9yIChjb25zdCBmaWVsZCBvZiBGT0xERVJfREVGQVVMVF9GSUVMRFMpIHtcblx0XHRcdFx0XHRkcm9wZG93bi5hZGRPcHRpb24oZmllbGQsIGZpZWxkKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGRyb3Bkb3duLnNldFZhbHVlKHRoaXMuZmllbGQpLm9uQ2hhbmdlKCh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdHRoaXMuZmllbGQgPSB2YWx1ZSBhcyBGb2xkZXJEZWZhdWx0RmllbGQgfCBcIlwiO1xuXHRcdFx0XHRcdHRoaXMudmFsdWUgPSB0aGlzLmZpbmRFeGlzdGluZ1ZhbHVlKHRoaXMuZmllbGQpO1xuXHRcdFx0XHRcdHRoaXMuaXNDdXN0b21WYWx1ZSA9IGZhbHNlO1xuXHRcdFx0XHRcdHRoaXMudXBkYXRlU3VibWl0U3RhdGUoKTtcblx0XHRcdFx0XHR0aGlzLnJlbmRlcigpO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0dG9nZ2xlTW9kYWxTZWxlY3RQbGFjZWhvbGRlcihkcm9wZG93bi5zZWxlY3RFbCwgIXRoaXMuZmllbGQpO1xuXHRcdFx0fSk7XG5cblx0XHRjb25zdCBjYW5kaWRhdGVzID0gdGhpcy5maWVsZCA/IGdldEZyb250bWF0dGVyRmllbGRDYW5kaWRhdGVzKHRoaXMuYXBwLCB0aGlzLmZpZWxkKSA6IFtdO1xuXHRcdGNvbnN0IHZhbHVlcyA9IHRoaXMudmFsdWUgJiYgIWNhbmRpZGF0ZXMuaW5jbHVkZXModGhpcy52YWx1ZSkgPyBbLi4uY2FuZGlkYXRlcywgdGhpcy52YWx1ZV0gOiBjYW5kaWRhdGVzO1xuXHRcdGNvbnN0IHZhbHVlU2V0dGluZyA9IG5ldyBTZXR0aW5nKGNvbnRlbnRFbCkuc2V0TmFtZShcIuWhq+WGmVwiKTtcblx0XHR2YWx1ZVNldHRpbmcuY29udHJvbEVsLmFkZENsYXNzKFwiYXV0by1mcm9udG1hdHRlci1tb2RhbC12YWx1ZS1jb250cm9sXCIpO1xuXHRcdHZhbHVlU2V0dGluZy5jb250cm9sRWwuZW1wdHkoKTtcblx0XHRjb25zdCBzZWxlY3RFbCA9IHZhbHVlU2V0dGluZy5jb250cm9sRWwuY3JlYXRlRWwoXCJzZWxlY3RcIiwge1xuXHRcdFx0Y2xzOiBcImRyb3Bkb3duIGF1dG8tZnJvbnRtYXR0ZXItbW9kYWwtY3VzdG9tLXNlbGVjdFwiLFxuXHRcdH0pO1xuXHRcdHNlbGVjdEVsLmNyZWF0ZUVsKFwib3B0aW9uXCIsIHtcblx0XHRcdHZhbHVlOiBcIlwiLFxuXHRcdFx0dGV4dDogXCLmnKrphY3nva5cIixcblx0XHR9KTtcblx0XHRmb3IgKGNvbnN0IHZhbHVlIG9mIHZhbHVlcykge1xuXHRcdFx0c2VsZWN0RWwuY3JlYXRlRWwoXCJvcHRpb25cIiwge1xuXHRcdFx0XHR2YWx1ZSxcblx0XHRcdFx0dGV4dDogdmFsdWUsXG5cdFx0XHR9KTtcblx0XHR9XG5cdFx0c2VsZWN0RWwuY3JlYXRlRWwoXCJvcHRpb25cIiwge1xuXHRcdFx0dmFsdWU6IFwiX19uZXdfX1wiLFxuXHRcdFx0dGV4dDogXCLoh6rlrprkuYlcIixcblx0XHR9KTtcblx0XHRzZWxlY3RFbC5kaXNhYmxlZCA9ICF0aGlzLmZpZWxkO1xuXHRcdHNlbGVjdEVsLnZhbHVlID0gdGhpcy5pc0N1c3RvbVZhbHVlID8gXCJfX25ld19fXCIgOiB0aGlzLnZhbHVlIHx8IFwiXCI7XG5cdFx0dG9nZ2xlTW9kYWxTZWxlY3RQbGFjZWhvbGRlcihzZWxlY3RFbCwgIXNlbGVjdEVsLnZhbHVlKTtcblx0XHRzZWxlY3RFbC5hZGRFdmVudExpc3RlbmVyKFwiY2hhbmdlXCIsICgpID0+IHtcblx0XHRcdHRvZ2dsZU1vZGFsU2VsZWN0UGxhY2Vob2xkZXIoc2VsZWN0RWwsICFzZWxlY3RFbC52YWx1ZSk7XG5cdFx0XHRpZiAoIXNlbGVjdEVsLnZhbHVlKSB7XG5cdFx0XHRcdHRoaXMuaXNDdXN0b21WYWx1ZSA9IGZhbHNlO1xuXHRcdFx0XHR0aGlzLnZhbHVlID0gXCJcIjtcblx0XHRcdFx0dGhpcy51cGRhdGVTdWJtaXRTdGF0ZSgpO1xuXHRcdFx0XHR0aGlzLnJlbmRlcigpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoc2VsZWN0RWwudmFsdWUgPT09IFwiX19uZXdfX1wiKSB7XG5cdFx0XHRcdHRoaXMuaXNDdXN0b21WYWx1ZSA9IHRydWU7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLmlzQ3VzdG9tVmFsdWUgPSBmYWxzZTtcblx0XHRcdFx0dGhpcy52YWx1ZSA9IHNlbGVjdEVsLnZhbHVlO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy51cGRhdGVTdWJtaXRTdGF0ZSgpO1xuXHRcdFx0dGhpcy5yZW5kZXIoKTtcblx0XHR9KTtcblxuXHRcdGlmICh0aGlzLmlzQ3VzdG9tVmFsdWUpIHtcblx0XHRcdGNvbnN0IGlucHV0RWwgPSB2YWx1ZVNldHRpbmcuY29udHJvbEVsLmNyZWF0ZUVsKFwiaW5wdXRcIiwge1xuXHRcdFx0XHRjbHM6IFwiYXV0by1mcm9udG1hdHRlci1tb2RhbC1jdXN0b20taW5wdXRcIixcblx0XHRcdFx0dHlwZTogXCJ0ZXh0XCIsXG5cdFx0XHRcdHZhbHVlOiB0aGlzLnZhbHVlLFxuXHRcdFx0fSk7XG5cdFx0XHRpbnB1dEVsLnBsYWNlaG9sZGVyID0gXCLloavlhaXkv6Hmga9cIjtcblx0XHRcdGlucHV0RWwuYWRkRXZlbnRMaXN0ZW5lcihcImlucHV0XCIsICgpID0+IHtcblx0XHRcdFx0dGhpcy52YWx1ZSA9IGlucHV0RWwudmFsdWU7XG5cdFx0XHRcdHRoaXMudXBkYXRlU3VibWl0U3RhdGUoKTtcblx0XHRcdH0pO1xuXHRcdFx0aW5wdXRFbC5hZGRFdmVudExpc3RlbmVyKFwiY2hhbmdlXCIsICgpID0+IHtcblx0XHRcdFx0dGhpcy52YWx1ZSA9IGlucHV0RWwudmFsdWU7XG5cdFx0XHRcdHRoaXMudXBkYXRlU3VibWl0U3RhdGUoKTtcblx0XHRcdH0pO1xuXG5cdFx0XHR0aGlzLmN1c3RvbVZhbHVlSW5wdXRFbCA9IGlucHV0RWw7XG5cdFx0XHR0aGlzLmN1c3RvbVZhbHVlQmx1ckhhbmRsZXIgPSAoKSA9PiB7XG5cdFx0XHRcdHRoaXMudmFsdWUgPSBpbnB1dEVsLnZhbHVlO1xuXHRcdFx0XHR0aGlzLnVwZGF0ZVN1Ym1pdFN0YXRlKCk7XG5cdFx0XHR9O1xuXHRcdFx0dGhpcy5jdXN0b21WYWx1ZUtleWRvd25IYW5kbGVyID0gKGV2ZW50KSA9PiB7XG5cdFx0XHRcdGlmIChldmVudC5rZXkgPT09IFwiRW50ZXJcIikge1xuXHRcdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdFx0dGhpcy52YWx1ZSA9IGlucHV0RWwudmFsdWU7XG5cdFx0XHRcdFx0dGhpcy51cGRhdGVTdWJtaXRTdGF0ZSgpO1xuXHRcdFx0XHRcdGlucHV0RWwuYmx1cigpO1xuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXHRcdFx0aW5wdXRFbC5hZGRFdmVudExpc3RlbmVyKFwiYmx1clwiLCB0aGlzLmN1c3RvbVZhbHVlQmx1ckhhbmRsZXIpO1xuXHRcdFx0aW5wdXRFbC5hZGRFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCB0aGlzLmN1c3RvbVZhbHVlS2V5ZG93bkhhbmRsZXIpO1xuXHRcdFx0d2luZG93LnNldFRpbWVvdXQoKCkgPT4gaW5wdXRFbC5mb2N1cygpLCAwKTtcblx0XHR9XG5cblx0XHRjb25zdCBhY3Rpb25zRWwgPSBjb250ZW50RWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItbW9kYWwtYWN0aW9uc1wiIH0pO1xuXHRcdG5ldyBTZXR0aW5nKGFjdGlvbnNFbClcblx0XHRcdC5hZGRCdXR0b24oKGJ1dHRvbikgPT4ge1xuXHRcdFx0XHRidXR0b24uc2V0QnV0dG9uVGV4dChcIuWPlua2iFwiKS5vbkNsaWNrKCgpID0+IHtcblx0XHRcdFx0XHR0aGlzLmNsb3NlKCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSlcblx0XHRcdC5hZGRCdXR0b24oKGJ1dHRvbikgPT4ge1xuXHRcdFx0XHR0aGlzLnN1Ym1pdEJ1dHRvbkVsID0gYnV0dG9uLmJ1dHRvbkVsO1xuXHRcdFx0XHRidXR0b25cblx0XHRcdFx0XHQuc2V0QnV0dG9uVGV4dChcIuaPkOS6pFwiKVxuXHRcdFx0XHRcdC5zZXRDdGEoKVxuXHRcdFx0XHRcdC5vbkNsaWNrKGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRpZiAoIXRoaXMucGx1Z2luLmVuc3VyZURldmljZUJvdW5kKCkpIHtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRhd2FpdCB0aGlzLnBsdWdpbi51cHNlcnRGb2xkZXJSdWxlKHRoaXMuZm9sZGVyLCB0aGlzLmZpZWxkIGFzIEZvbGRlckRlZmF1bHRGaWVsZCwgdGhpcy52YWx1ZSk7XG5cdFx0XHRcdFx0dGhpcy5wbHVnaW4ucmVmcmVzaFNldHRpbmdzVGFiKCk7XG5cdFx0XHRcdFx0bmV3IE5vdGljZShg6KeE5YiZ5bey5L+d5a2Y77yIJHt0aGlzLnBsdWdpbi5nZXRDdXJyZW50QXV0aG9yTmFtZSgpfe+8iWApO1xuXHRcdFx0XHRcdHRoaXMuY2xvc2UoKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR0aGlzLnVwZGF0ZVN1Ym1pdFN0YXRlKCk7XG5cdH1cblxuXHRwcml2YXRlIGZpbmRFeGlzdGluZ1ZhbHVlKGZpZWxkOiBGb2xkZXJEZWZhdWx0RmllbGQgfCBcIlwiKTogc3RyaW5nIHtcblx0XHRpZiAoIWZpZWxkKSB7XG5cdFx0XHRyZXR1cm4gXCJcIjtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMucGx1Z2luLnNldHRpbmdzLmZvbGRlckRlZmF1bHRzLmZpbmQoKHJ1bGUpID0+IHtcblx0XHRcdHJldHVybiBydWxlLmZvbGRlciA9PT0gdGhpcy5mb2xkZXIgJiYgcnVsZS5maWVsZCA9PT0gZmllbGQ7XG5cdFx0fSk/LnZhbHVlID8/IFwiXCI7XG5cdH1cblxuXHRwcml2YXRlIGdldEluaXRpYWxGaWVsZCgpOiBGb2xkZXJEZWZhdWx0RmllbGQge1xuXHRcdGNvbnN0IG93bkZpZWxkcyA9IG5ldyBTZXQoXG5cdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5mb2xkZXJEZWZhdWx0c1xuXHRcdFx0XHQuZmlsdGVyKChydWxlKSA9PiBydWxlLmZvbGRlciA9PT0gdGhpcy5mb2xkZXIpXG5cdFx0XHRcdC5tYXAoKHJ1bGUpID0+IHJ1bGUuZmllbGQpLFxuXHRcdCk7XG5cdFx0Y29uc3QgaW5oZXJpdGVkRmllbGRzID0gbmV3IFNldChcblx0XHRcdGdldEFuY2VzdG9yUnVsZXModGhpcy5mb2xkZXIsIHRoaXMucGx1Z2luLnNldHRpbmdzLmZvbGRlckRlZmF1bHRzKS5tYXAoKHJ1bGUpID0+IHJ1bGUuZmllbGQpLFxuXHRcdCk7XG5cblx0XHRpZiAob3duRmllbGRzLmhhcyhcIumhueebrlwiKSAmJiAhb3duRmllbGRzLmhhcyhcIuexu+Wei1wiKSkge1xuXHRcdFx0cmV0dXJuIFwi57G75Z6LXCI7XG5cdFx0fVxuXHRcdGlmIChvd25GaWVsZHMuaGFzKFwi57G75Z6LXCIpICYmICFvd25GaWVsZHMuaGFzKFwi6aG555uuXCIpKSB7XG5cdFx0XHRyZXR1cm4gXCLpobnnm65cIjtcblx0XHR9XG5cdFx0aWYgKGluaGVyaXRlZEZpZWxkcy5oYXMoXCLpobnnm65cIikgJiYgIWluaGVyaXRlZEZpZWxkcy5oYXMoXCLnsbvlnotcIikpIHtcblx0XHRcdHJldHVybiBcIuexu+Wei1wiO1xuXHRcdH1cblx0XHRyZXR1cm4gXCLpobnnm65cIjtcblx0fVxuXG5cdHByaXZhdGUgY2xlYW51cEN1c3RvbVZhbHVlSW5wdXQoKSB7XG5cdFx0aWYgKHRoaXMuY3VzdG9tVmFsdWVJbnB1dEVsICYmIHRoaXMuY3VzdG9tVmFsdWVCbHVySGFuZGxlcikge1xuXHRcdFx0dGhpcy5jdXN0b21WYWx1ZUlucHV0RWwucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImJsdXJcIiwgdGhpcy5jdXN0b21WYWx1ZUJsdXJIYW5kbGVyKTtcblx0XHR9XG5cdFx0aWYgKHRoaXMuY3VzdG9tVmFsdWVJbnB1dEVsICYmIHRoaXMuY3VzdG9tVmFsdWVLZXlkb3duSGFuZGxlcikge1xuXHRcdFx0dGhpcy5jdXN0b21WYWx1ZUlucHV0RWwucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwgdGhpcy5jdXN0b21WYWx1ZUtleWRvd25IYW5kbGVyKTtcblx0XHR9XG5cdFx0dGhpcy5jdXN0b21WYWx1ZUlucHV0RWwgPSBudWxsO1xuXHRcdHRoaXMuY3VzdG9tVmFsdWVCbHVySGFuZGxlciA9IG51bGw7XG5cdFx0dGhpcy5jdXN0b21WYWx1ZUtleWRvd25IYW5kbGVyID0gbnVsbDtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlU3VibWl0U3RhdGUoKSB7XG5cdFx0aWYgKCF0aGlzLnN1Ym1pdEJ1dHRvbkVsKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgaGFzRmllbGQgPSBCb29sZWFuKHRoaXMuZmllbGQpO1xuXHRcdGNvbnN0IGhhc1ZhbHVlID0gdGhpcy5pc0N1c3RvbVZhbHVlXG5cdFx0XHQ/ICh0aGlzLmN1c3RvbVZhbHVlSW5wdXRFbD8udmFsdWUgPz8gdGhpcy52YWx1ZSkudHJpbSgpLmxlbmd0aCA+IDBcblx0XHRcdDogdGhpcy52YWx1ZS50cmltKCkubGVuZ3RoID4gMDtcblxuXHRcdHRoaXMuc3VibWl0QnV0dG9uRWwuZGlzYWJsZWQgPSAhKGhhc0ZpZWxkICYmIGhhc1ZhbHVlKTtcblx0fVxufVxuXG5jbGFzcyBBSVN1bW1hcnlTZXJ2aWNlIGltcGxlbWVudHMgU3VtbWFyeVNlcnZpY2Uge1xuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIHNldHRpbmdzOiBBdXRvRnJvbnRtYXR0ZXJTZXR0aW5ncykge31cblxuXHRhc3luYyBnZW5lcmF0ZVN1bW1hcnkoZG9jdW1lbnQ6IFN1bW1hcnlEb2N1bWVudCk6IFByb21pc2U8c3RyaW5nPiB7XG5cdFx0cmV0dXJuIGF3YWl0IHRoaXMuY2FsbEFJKHRoaXMuYnVpbGRQcm9tcHQoZG9jdW1lbnQpKTtcblx0fVxuXG5cdGFzeW5jIGNhbGxBSShwcm9tcHRDb250ZW50OiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4ge1xuXHRcdGNvbnN0IGFwaUtleSA9IHRoaXMuc2V0dGluZ3MuYWlBcGlLZXkudHJpbSgpO1xuXHRcdGlmICghYXBpS2V5KSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJBUEkgS2V5IOS4uuepulwiKTtcblx0XHR9XG5cblx0XHRjb25zdCBhcGlVcmwgPSB0aGlzLnNldHRpbmdzLmFpQXBpVXJsLnJlcGxhY2UoL1xcLyskLywgXCJcIik7XG5cdFx0Y29uc3QgdXJsID0gYCR7YXBpVXJsfS9jaGF0L2NvbXBsZXRpb25zYDtcblxuXHRcdGNvbnNvbGUubG9nKFwiW0FJ5pGY6KaBXSDor7fmsYIgVVJMOlwiLCB1cmwpO1xuXHRcdGNvbnNvbGUubG9nKFwiW0FJ5pGY6KaBXSDmqKHlnos6XCIsIHRoaXMuc2V0dGluZ3MuYWlNb2RlbE5hbWUpO1xuXG5cdFx0Y29uc3QgYm9keSA9IHtcblx0XHRcdG1vZGVsOiB0aGlzLnNldHRpbmdzLmFpTW9kZWxOYW1lLFxuXHRcdFx0bWVzc2FnZXM6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHJvbGU6IFwic3lzdGVtXCIsXG5cdFx0XHRcdFx0Y29udGVudDogXCLnm7TmjqXovpPlh7rmkZjopoHvvIzkuI3opoHmnInku7vkvZXlhbbku5blhoXlrrnjgIJcIixcblx0XHRcdFx0fSxcblx0XHRcdFx0eyByb2xlOiBcInVzZXJcIiwgY29udGVudDogcHJvbXB0Q29udGVudCB9LFxuXHRcdFx0XSxcblx0XHRcdHJlYXNvbmluZ19lZmZvcnQ6IFwibG93XCIsXG5cdFx0XHRyZWFzb25pbmdfZm9ybWF0OiBcImRlZXBzZWVrLXN0eWxlXCIsXG5cdFx0XHRtYXhfdG9rZW5zOiAxMDI0LFxuXHRcdH07XG5cblx0XHRjb25zb2xlLmxvZyhcIltBSeaRmOimgV0g6K+35rGCIGJvZHk6XCIsIEpTT04uc3RyaW5naWZ5KGJvZHksIG51bGwsIDIpLnN1YnN0cmluZygwLCA1MDApKTtcblxuXHRcdGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2godXJsLCB7XG5cdFx0XHRtZXRob2Q6IFwiUE9TVFwiLFxuXHRcdFx0aGVhZGVyczoge1xuXHRcdFx0XHRcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIixcblx0XHRcdFx0XCJBdXRob3JpemF0aW9uXCI6IGBCZWFyZXIgJHthcGlLZXl9YCxcblx0XHRcdH0sXG5cdFx0XHRib2R5OiBKU09OLnN0cmluZ2lmeShib2R5KSxcblx0XHR9KTtcblxuXHRcdGNvbnNvbGUubG9nKFwiW0FJ5pGY6KaBXSDlk43lupQgc3RhdHVzOlwiLCByZXNwb25zZS5zdGF0dXMsIHJlc3BvbnNlLnN0YXR1c1RleHQpO1xuXG5cdFx0aWYgKCFyZXNwb25zZS5vaykge1xuXHRcdFx0Y29uc3QgZXJyb3JUZXh0ID0gYXdhaXQgcmVzcG9uc2UudGV4dCgpO1xuXHRcdFx0Y29uc29sZS5sb2coXCJbQUnmkZjopoFdIOmUmeivr+WTjeW6lDpcIiwgZXJyb3JUZXh0LnN1YnN0cmluZygwLCA1MDApKTtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgQVBJIOivt+axguWksei0pSAoJHtyZXNwb25zZS5zdGF0dXN9KTogJHtlcnJvclRleHQuc3Vic3RyaW5nKDAsIDIwMCl9YCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZGF0YSA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKSBhcyBDaGF0Q29tcGxldGlvblJlc3BvbnNlO1xuXHRcdGNvbnNvbGUubG9nKFwiW0FJ5pGY6KaBXSDlrozmlbTlk43lupQ6XCIsIEpTT04uc3RyaW5naWZ5KGRhdGEsIG51bGwsIDIpKTtcblxuXHRcdGlmIChkYXRhLmVycm9yKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoZGF0YS5lcnJvci5tZXNzYWdlIHx8IEpTT04uc3RyaW5naWZ5KGRhdGEuZXJyb3IpKTtcblx0XHR9XG5cblx0XHRjb25zdCBtZXNzYWdlID0gZGF0YS5jaG9pY2VzPy5bMF0/Lm1lc3NhZ2U7XG5cdFx0aWYgKCFtZXNzYWdlKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCLlk43lupTkuK3ml6AgY2hvaWNlc1swXS5tZXNzYWdl77yM5a6M5pW05ZON5bqU5bey5omT5Y2w5Yiw5o6n5Yi25Y+wXCIpO1xuXHRcdH1cblxuXHRcdFx0Y29uc29sZS5sb2coXCJbQUnmkZjopoFdIG1lc3NhZ2UuY29udGVudDpcIiwgSlNPTi5zdHJpbmdpZnkobWVzc2FnZS5jb250ZW50KSk7XG5cdFx0XHRjb25zb2xlLmxvZyhcIltBSeaRmOimgV0gbWVzc2FnZS5yZWFzb25pbmdfY29udGVudDpcIiwgSlNPTi5zdHJpbmdpZnkobWVzc2FnZS5yZWFzb25pbmdfY29udGVudCk/LnN1YnN0cmluZygwLCAyMDApKTtcblx0XHRcdGNvbnNvbGUubG9nKFwiW0FJ5pGY6KaBXSBtZXNzYWdlLnJlYXNvbmluZzpcIiwgSlNPTi5zdHJpbmdpZnkobWVzc2FnZS5yZWFzb25pbmcpPy5zdWJzdHJpbmcoMCwgMjAwKSk7XG5cblx0XHRsZXQgc3VtbWFyeSA9IG1lc3NhZ2UuY29udGVudD8udHJpbSgpO1xuXHRcdGlmICghc3VtbWFyeSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwi5qih5Z6L5pyq55Sf5oiQ5pGY6KaB77yIY29udGVudCDkuLrnqbrvvInvvIzor7fmiZPlvIDlvIDlj5HogIXlt6Xlhbfmn6XnnIvlrozmlbTlk43lupRcIik7XG5cdFx0fVxuXG5cdFx0c3VtbWFyeSA9IHN1bW1hcnlcblx0XHRcdC5yZXBsYWNlKC9eW1xcXCLjgIzjgI1cIiddK3xbXFxcIuOAjOOAjVwiJ10rJC9nLCBcIlwiKVxuXHRcdFx0LnJlcGxhY2UoL14o5pGY6KaBWzrvvJpdXFxzKikvaSwgXCJcIilcblx0XHRcdC50cmltKCk7XG5cblx0XHRpZiAoIXN1bW1hcnkpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihcIkFJIOaRmOimgei/lOWbnuS4uuepulwiKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gc3VtbWFyeTtcblx0fVxuXG5cdHByaXZhdGUgYnVpbGRQcm9tcHQoZG9jdW1lbnQ6IFN1bW1hcnlEb2N1bWVudCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHJlcGxhY2VQcm9tcHRUb2tlbihcblx0XHRcdHJlcGxhY2VQcm9tcHRUb2tlbihcblx0XHRcdFx0cmVwbGFjZVByb21wdFRva2VuKHRoaXMuc2V0dGluZ3MuYWlTdW1tYXJ5UHJvbXB0LCBcInt0aXRsZX1cIiwgZG9jdW1lbnQudGl0bGUpLFxuXHRcdFx0XHRcIntmcm9udG1hdHRlcn1cIixcblx0XHRcdFx0ZG9jdW1lbnQuZnJvbnRtYXR0ZXIsXG5cdFx0XHQpLFxuXHRcdFx0XCJ7Y29udGVudH1cIixcblx0XHRcdGRvY3VtZW50LmNvbnRlbnQsXG5cdFx0KTtcblx0fVxufVxuXG5jbGFzcyBBdXRvRnJvbnRtYXR0ZXJTZXR0aW5nVGFiIGV4dGVuZHMgUGx1Z2luU2V0dGluZ1RhYiB7XG5cdHBsdWdpbjogQXV0b0Zyb250bWF0dGVyUGx1Z2luO1xuXHRwcml2YXRlIGFjdGl2ZVRhYjogU2V0dGluZ1RhYklkID0gXCLpgJrnlKhcIjtcblx0cHJpdmF0ZSBiaW5kaW5nQ3VycmVudERldmljZSA9IGZhbHNlO1xuXHRwcml2YXRlIGJpbmRpbmdDdXJyZW50RGV2aWNlQ3VzdG9tID0gZmFsc2U7XG5cdHByaXZhdGUgc2NhblJlc3VsdHM6IFNjYW5SZXN1bHRbXSA9IFtdO1xuXHRwcml2YXRlIGhhc1NjYW5uZWQgPSBmYWxzZTtcblx0cHJpdmF0ZSBpc1NjYW5uaW5nID0gZmFsc2U7XG5cdHByaXZhdGUgaXNFeGVjdXRpbmcgPSBmYWxzZTtcblx0cHJpdmF0ZSBwcm9jZXNzZWRDb3VudCA9IDA7XG5cdHByaXZhdGUgdW5tYXRjaGVkRm9sZGVyczogVW5tYXRjaGVkRm9sZGVyUmVzdWx0W10gPSBbXTtcblx0cHJpdmF0ZSBoYXNTY2FubmVkVW5tYXRjaGVkRm9sZGVycyA9IGZhbHNlO1xuXHRwcml2YXRlIGlzU2Nhbm5pbmdVbm1hdGNoZWRGb2xkZXJzID0gZmFsc2U7XG5cdHByaXZhdGUgYWN0aXZlSW5saW5lRWRpdG9yQ2xlYW51cDogKCgpID0+IHZvaWQpIHwgbnVsbCA9IG51bGw7XG5cdHByaXZhdGUgYWlBcGlLZXlWaXNpYmxlID0gZmFsc2U7XG5cdHByaXZhdGUgYWlTdW1tYXJ5Q29tcGxldGlvblJlc3VsdHM6IEFJU3VtbWFyeUNhbmRpZGF0ZVtdID0gW107XG5cdHByaXZhdGUgaGFzU2Nhbm5lZEFJU3VtbWFyeUNvbXBsZXRpb24gPSBmYWxzZTtcblx0cHJpdmF0ZSBpc1NjYW5uaW5nQUlTdW1tYXJ5Q29tcGxldGlvbiA9IGZhbHNlO1xuXHRwcml2YXRlIGlzRXhlY3V0aW5nQUlTdW1tYXJ5Q29tcGxldGlvbiA9IGZhbHNlO1xuXHRwcml2YXRlIHByb2Nlc3NlZEFJU3VtbWFyeUNvbXBsZXRpb25Db3VudCA9IDA7XG5cdHByaXZhdGUgY3VycmVudFJ1bGVQYWdlID0gMDtcblx0cHJpdmF0ZSBpc0NoZWNraW5nVXBkYXRlID0gZmFsc2U7XG5cdHByaXZhdGUgaXNVcGRhdGluZyA9IGZhbHNlO1xuXHRwcml2YXRlIHVwZGF0ZVByb2dyZXNzID0gMDtcblx0cHJpdmF0ZSB1cGRhdGVSZXN1bHRNZXNzYWdlID0gXCJcIjtcblx0cHJpdmF0ZSBsYXRlc3RWZXJzaW9uID0gXCJcIjtcblxuXHRjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcGx1Z2luOiBBdXRvRnJvbnRtYXR0ZXJQbHVnaW4pIHtcblx0XHRzdXBlcihhcHAsIHBsdWdpbik7XG5cdFx0dGhpcy5wbHVnaW4gPSBwbHVnaW47XG5cdH1cblxuXHRkaXNwbGF5KCk6IHZvaWQge1xuXHRcdGNvbnN0IHsgY29udGFpbmVyRWwgfSA9IHRoaXM7XG5cdFx0dGhpcy5jbG9zZUFjdGl2ZUlubGluZUVkaXRvcigpO1xuXHRcdGNvbnRhaW5lckVsLmVtcHR5KCk7XG5cblx0XHR0aGlzLnJlbmRlclRhYnMoY29udGFpbmVyRWwpO1xuXHRcdGNvbnN0IGNvbnRlbnRFbCA9IGNvbnRhaW5lckVsLmNyZWF0ZURpdih7XG5cdFx0XHRjbHM6IFwiYXV0by1mcm9udG1hdHRlci10YWItY29udGVudFwiLFxuXHRcdFx0YXR0cjogeyBcImRhdGEtYXV0by1mcm9udG1hdHRlci1hY3RpdmUtdGFiXCI6IHRoaXMuYWN0aXZlVGFiIH0sXG5cdFx0fSk7XG5cdFx0aWYgKHRoaXMuYWN0aXZlVGFiID09PSBcIumAmueUqFwiKSB7XG5cdFx0XHR0aGlzLnJlbmRlckdlbmVyYWxTZXR0aW5ncyhjb250ZW50RWwpO1xuXHRcdH0gZWxzZSBpZiAodGhpcy5hY3RpdmVUYWIgPT09IFwi5paH5Lu25aS56KeE5YiZXCIpIHtcblx0XHRcdHRoaXMucmVuZGVyRm9sZGVyRGVmYXVsdFJ1bGVzKGNvbnRlbnRFbCk7XG5cdFx0fSBlbHNlIGlmICh0aGlzLmFjdGl2ZVRhYiA9PT0gXCLmiavmj4/ku5PlupNcIikge1xuXHRcdFx0dGhpcy5yZW5kZXJTY2FuU2VjdGlvbihjb250ZW50RWwpO1xuXHRcdH0gZWxzZSBpZiAodGhpcy5hY3RpdmVUYWIgPT09IFwi6K6+5aSH57uR5a6aXCIpIHtcblx0XHRcdHRoaXMucmVuZGVyRGV2aWNlQmluZGluZ3MoY29udGVudEVsKTtcblx0XHR9IGVsc2UgaWYgKHRoaXMuYWN0aXZlVGFiID09PSBcIueJiOacrOabtOaWsFwiKSB7XG5cdFx0XHR0aGlzLnJlbmRlckFib3V0U2VjdGlvbihjb250ZW50RWwpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnJlbmRlckFJU3VtbWFyeVNldHRpbmdzKGNvbnRlbnRFbCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJUYWJzKGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCkge1xuXHRcdGNvbnN0IHRhYnNFbCA9IGNvbnRhaW5lckVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLXRhYnNcIiB9KTtcblx0XHRmb3IgKGNvbnN0IHRhYiBvZiBTRVRUSU5HX1RBQlMpIHtcblx0XHRcdGNvbnN0IHRhYkVsID0gdGFic0VsLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcblx0XHRcdFx0Y2xzOiBgYXV0by1mcm9udG1hdHRlci10YWIke3RoaXMuYWN0aXZlVGFiID09PSB0YWIgPyBcIiBpcy1hY3RpdmVcIiA6IFwiXCJ9YCxcblx0XHRcdFx0dGV4dDogdGFiLFxuXHRcdFx0fSk7XG5cdFx0XHR0YWJFbC5vbmNsaWNrID0gKCkgPT4ge1xuXHRcdFx0XHR0aGlzLmFjdGl2ZVRhYiA9IHRhYjtcblx0XHRcdFx0dGhpcy5kaXNwbGF5KCk7XG5cdFx0XHR9O1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyR2VuZXJhbFNldHRpbmdzKGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCkge1xuXHRcdHRoaXMucmVuZGVyUmVxdWlyZWRGaWVsZHNJbmZvKGNvbnRhaW5lckVsKTtcblxuXHRcdGNvbnN0IGhpZ2hsaWdodFNldHRpbmdFbCA9IGNvbnRhaW5lckVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLWhpZ2hsaWdodC1zZXR0aW5nXCIgfSk7XG5cdFx0bmV3IFNldHRpbmcoaGlnaGxpZ2h0U2V0dGluZ0VsKVxuXHRcdFx0LnNldE5hbWUoXCLnqbrlsZ7mgKfpq5jkuq7mj5DphpJcIilcblx0XHRcdC5zZXREZXNjKFwi5omT5byA5paH5Lu25pe26auY5Lqu5o+Q6YaS5b+F6ZyA5bGe5oCn5Lit55qE56m65YC844CCXCIpXG5cdFx0XHQuYWRkVG9nZ2xlKCh0b2dnbGUpID0+XG5cdFx0XHRcdHRvZ2dsZVxuXHRcdFx0XHRcdC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5lbXB0eUZpZWxkSGlnaGxpZ2h0KVxuXHRcdFx0XHRcdC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcblx0XHRcdFx0XHRcdGlmICghdGhpcy5wbHVnaW4uZW5zdXJlRGV2aWNlQm91bmQoKSkge1xuXHRcdFx0XHRcdFx0XHR0aGlzLmRpc3BsYXkoKTtcblx0XHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MuZW1wdHlGaWVsZEhpZ2hsaWdodCA9IHZhbHVlO1xuXHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5yZWZyZXNoRW1wdHlGaWVsZEhpZ2hsaWdodHMoKTtcblx0XHRcdFx0XHR9KSxcblx0XHRcdCk7XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlckFJU3VtbWFyeVNldHRpbmdzKGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCkge1xuXHRcdGNvbnN0IGludHJvRWwgPSBjb250YWluZXJFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1haS1zdW1tYXJ5LWludHJvXCIgfSk7XG5cdFx0bmV3IFNldHRpbmcoaW50cm9FbClcblx0XHRcdC5zZXROYW1lKFwiQUkg6Ieq5Yqo5pGY6KaBXCIpXG5cdFx0XHQuc2V0RGVzYyhcIuW8gOWQr+WQju+8jOWwhuS9v+eUqCBBSSDlr7nmlofmoaPlhoXlrrnov5vooYzmkZjopoHmgLvnu5PvvIzoh6rliqjloavlhaXjgIzmkZjopoHjgI3lrZfmrrXjgIJcIilcblx0XHRcdC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT5cblx0XHRcdFx0dG9nZ2xlXG5cdFx0XHRcdFx0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmFpU3VtbWFyeUVuYWJsZWQpXG5cdFx0XHRcdFx0Lm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MuYWlTdW1tYXJ5RW5hYmxlZCA9IHZhbHVlO1xuXHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdFx0fSksXG5cdFx0XHQpO1xuXG5cdFx0Y29udGFpbmVyRWwuY3JlYXRlRWwoXCJoM1wiLCB7IHRleHQ6IFwi5qih5Z6L6YWN572uXCIgfSk7XG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHQuc2V0TmFtZShcIkFQSSDlnLDlnYBcIilcblx0XHRcdC5hZGRUZXh0KCh0ZXh0KSA9PiB7XG5cdFx0XHRcdHRleHRcblx0XHRcdFx0XHQuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuYWlBcGlVcmwpXG5cdFx0XHRcdFx0Lm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MuYWlBcGlVcmwgPSB2YWx1ZTtcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR0ZXh0LmlucHV0RWwucGxhY2Vob2xkZXIgPSBcImh0dHBzOi8vYXBpLnN0ZXBmdW4uY29tL3N0ZXBfcGxhbi92MVwiO1xuXHRcdFx0fSk7XG5cblx0XHRuZXcgU2V0dGluZyhjb250YWluZXJFbClcblx0XHRcdC5zZXROYW1lKFwi5qih5Z6L5ZCN56ewXCIpXG5cdFx0XHQuYWRkVGV4dCgodGV4dCkgPT4ge1xuXHRcdFx0XHR0ZXh0XG5cdFx0XHRcdFx0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmFpTW9kZWxOYW1lKVxuXHRcdFx0XHRcdC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcblx0XHRcdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLmFpTW9kZWxOYW1lID0gdmFsdWU7XG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0dGV4dC5pbnB1dEVsLnBsYWNlaG9sZGVyID0gXCJzdGVwLTMuNy1mbGFzaFwiO1xuXHRcdFx0fSk7XG5cblx0XHRjb25zdCBhcGlLZXlTZXR0aW5nID0gbmV3IFNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJBUEkgS2V5XCIpO1xuXHRcdGFwaUtleVNldHRpbmcuY29udHJvbEVsLmFkZENsYXNzKFwiYXV0by1mcm9udG1hdHRlci1haS1hcGkta2V5LWNvbnRyb2xcIik7XG5cdFx0YXBpS2V5U2V0dGluZy5hZGRUZXh0KCh0ZXh0KSA9PiB7XG5cdFx0XHR0ZXh0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmFpQXBpS2V5KS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcblx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MuYWlBcGlLZXkgPSB2YWx1ZTtcblx0XHRcdFx0YXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHR9KTtcblx0XHRcdHRleHQuaW5wdXRFbC50eXBlID0gdGhpcy5haUFwaUtleVZpc2libGUgPyBcInRleHRcIiA6IFwicGFzc3dvcmRcIjtcblx0XHRcdHRleHQuaW5wdXRFbC5wbGFjZWhvbGRlciA9IFwic2steHh4eFwiO1xuXHRcdH0pO1xuXHRcdGFwaUtleVNldHRpbmcuYWRkQnV0dG9uKChidXR0b24pID0+IHtcblx0XHRcdGJ1dHRvbi5zZXRUb29sdGlwKHRoaXMuYWlBcGlLZXlWaXNpYmxlID8gXCLpmpDol48gQVBJIEtleVwiIDogXCLmmL7npLogQVBJIEtleVwiKS5vbkNsaWNrKCgpID0+IHtcblx0XHRcdFx0dGhpcy5haUFwaUtleVZpc2libGUgPSAhdGhpcy5haUFwaUtleVZpc2libGU7XG5cdFx0XHRcdHRoaXMuZGlzcGxheSgpO1xuXHRcdFx0fSk7XG5cdFx0XHRzZXRJY29uKGJ1dHRvbi5idXR0b25FbCwgdGhpcy5haUFwaUtleVZpc2libGUgPyBcImV5ZS1vZmZcIiA6IFwiZXllXCIpO1xuXHRcdH0pO1xuXG5cdFx0XHRjb25zdCBzdGF0dXNFbCA9IGNvbnRhaW5lckVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLWFpLXN0YXR1c1wiIH0pO1xuXHRcdFx0dGhpcy5yZW5kZXJBSVN1bW1hcnlUYXNrU2VjdGlvbihzdGF0dXNFbCwge1xuXHRcdFx0XHR0YXNrOiBcImNvbXBsZXRpb25cIixcblx0XHRcdFx0dGl0bGU6IFwi5pGY6KaB6KGl5YWoXCIsXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBcIuS4uuOAjOaRmOimgeOAjeS4uuepuuS4lOS9nOiAheS4uuacrOacuue7keWumuS9nOiAheeahOaWh+aho+eUn+aIkCBBSSDmkZjopoHjgIJcIixcblx0XHRcdFx0YXV0b1RleHQ6IFwi6Ieq5Yqo6Kem5Y+R77ya5q+PIDMwIOWIhumSn1wiLFxuXHRcdFx0XHRlbXB0eVRleHQ6IFwi54K55Ye75omr5o+P5p+l55yL6ZyA6KaB6KGl5YWo5pGY6KaB55qE5paH5qGj44CCXCIsXG5cdFx0XHRcdGNvdW50VGV4dDogXCLnr4fmlofmoaPpnIDopoHooaXlhajmkZjopoFcIixcblx0XHRcdH0pO1xuXG5cdFx0Y29uc3QgcHJvbXB0SGVhZGVyRWwgPSBjb250YWluZXJFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1haS1wcm9tcHQtaGVhZGVyXCIgfSk7XG5cdFx0cHJvbXB0SGVhZGVyRWwuY3JlYXRlRWwoXCJoM1wiLCB7IHRleHQ6IFwi5pGY6KaBIFByb21wdFwiIH0pO1xuXHRcdG5ldyBTZXR0aW5nKHByb21wdEhlYWRlckVsKS5hZGRCdXR0b24oKGJ1dHRvbikgPT4ge1xuXHRcdFx0YnV0dG9uLnNldEJ1dHRvblRleHQoXCLmgaLlpI3pu5jorqRcIikub25DbGljayhhc3luYyAoKSA9PiB7XG5cdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLmFpU3VtbWFyeVByb21wdCA9IERFRkFVTFRfQUlfU1VNTUFSWV9QUk9NUFQ7XG5cdFx0XHRcdGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdFx0XHR0aGlzLmRpc3BsYXkoKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXG5cdFx0Y29uc3QgcHJvbXB0RWwgPSBjb250YWluZXJFbC5jcmVhdGVFbChcInRleHRhcmVhXCIsIHtcblx0XHRcdGNsczogXCJhdXRvLWZyb250bWF0dGVyLWFpLXByb21wdC10ZXh0YXJlYVwiLFxuXHRcdH0pO1xuXHRcdHByb21wdEVsLnZhbHVlID0gdGhpcy5wbHVnaW4uc2V0dGluZ3MuYWlTdW1tYXJ5UHJvbXB0O1xuXHRcdHByb21wdEVsLmFkZEV2ZW50TGlzdGVuZXIoXCJjaGFuZ2VcIiwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MuYWlTdW1tYXJ5UHJvbXB0ID0gcHJvbXB0RWwudmFsdWU7XG5cdFx0XHRhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyQUlTdW1tYXJ5VGFza1NlY3Rpb24oXG5cdFx0Y29udGFpbmVyRWw6IEhUTUxFbGVtZW50LFxuXHRcdG9wdGlvbnM6IHtcblx0XHRcdHRhc2s6IEFJU3VtbWFyeVRhc2tUeXBlO1xuXHRcdFx0dGl0bGU6IHN0cmluZztcblx0XHRcdGRlc2NyaXB0aW9uOiBzdHJpbmc7XG5cdFx0XHRhdXRvVGV4dDogc3RyaW5nO1xuXHRcdFx0ZW1wdHlUZXh0OiBzdHJpbmc7XG5cdFx0XHRjb3VudFRleHQ6IHN0cmluZztcblx0XHR9LFxuXHQpIHtcblx0XHRjb25zdCB0YXNrRWwgPSBjb250YWluZXJFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1haS10YXNrLXNlY3Rpb25cIiB9KTtcblx0XHR0YXNrRWwuY3JlYXRlRWwoXCJoM1wiLCB7IHRleHQ6IG9wdGlvbnMudGl0bGUgfSk7XG5cdFx0dGFza0VsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLWFpLXRhc2stZGVzY3JpcHRpb25cIiwgdGV4dDogb3B0aW9ucy5kZXNjcmlwdGlvbiB9KTtcblx0XHRjb25zdCBoZWFkZXJFbCA9IHRhc2tFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1haS10YXNrLWhlYWRlclwiIH0pO1xuXHRcdGhlYWRlckVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLWFpLXRhc2stYXV0b1wiLCB0ZXh0OiBvcHRpb25zLmF1dG9UZXh0IH0pO1xuXHRcdGNvbnN0IHNjYW5BY3Rpb25FbCA9IGhlYWRlckVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLWFpLXRhc2stYWN0aW9uXCIgfSk7XG5cdFx0bmV3IFNldHRpbmcoc2NhbkFjdGlvbkVsKS5hZGRCdXR0b24oKGJ1dHRvbikgPT4ge1xuXHRcdFx0Y29uc3QgaXNTY2FubmluZyA9IHRoaXMuZ2V0QUlTdW1tYXJ5VGFza1N0YXRlKG9wdGlvbnMudGFzaykuaXNTY2FubmluZztcblx0XHRcdGJ1dHRvblxuXHRcdFx0XHQuc2V0QnV0dG9uVGV4dChpc1NjYW5uaW5nID8gXCLmiavmj4/kuK0uLi5cIiA6IFwi5omr5o+PXCIpXG5cdFx0XHRcdC5zZXREaXNhYmxlZChpc1NjYW5uaW5nIHx8IHRoaXMuZ2V0QUlTdW1tYXJ5VGFza1N0YXRlKG9wdGlvbnMudGFzaykuaXNFeGVjdXRpbmcpXG5cdFx0XHRcdC5vbkNsaWNrKGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLnNjYW5BSVN1bW1hcnlUYXNrKG9wdGlvbnMudGFzayk7XG5cdFx0XHRcdH0pO1xuXHRcdH0pO1xuXG5cdFx0Y29uc3QgcmVzdWx0RWwgPSB0YXNrRWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItYWktcmVzdWx0c1wiIH0pO1xuXHRcdGNvbnN0IHN0YXRlID0gdGhpcy5nZXRBSVN1bW1hcnlUYXNrU3RhdGUob3B0aW9ucy50YXNrKTtcblx0XHRpZiAoIXN0YXRlLmhhc1NjYW5uZWQpIHtcblx0XHRcdHJlc3VsdEVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLWFpLWVtcHR5XCIsIHRleHQ6IG9wdGlvbnMuZW1wdHlUZXh0IH0pO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmIChzdGF0ZS5yZXN1bHRzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmVzdWx0RWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItYWktZW1wdHlcIiwgdGV4dDogXCLmmoLml6DpnIDopoHlpITnkIbnmoTmlofmoaPjgIJcIiB9KTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRyZXN1bHRFbC5jcmVhdGVEaXYoe1xuXHRcdFx0Y2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItYWktY291bnRcIixcblx0XHRcdHRleHQ6IGDlhbHlj5HnjrAgJHtzdGF0ZS5yZXN1bHRzLmxlbmd0aH0gJHtvcHRpb25zLmNvdW50VGV4dH1gLFxuXHRcdH0pO1xuXHRcdGNvbnN0IGxpc3RFbCA9IHJlc3VsdEVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLWFpLWxpc3RcIiB9KTtcblx0XHRmb3IgKGNvbnN0IHJlc3VsdCBvZiBzdGF0ZS5yZXN1bHRzKSB7XG5cdFx0XHRjb25zdCBpdGVtRWwgPSBsaXN0RWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItYWktaXRlbVwiIH0pO1xuXHRcdFx0Y29uc3QgY29udGVudEVsID0gaXRlbUVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLWFpLWl0ZW0tY29udGVudFwiIH0pO1xuXHRcdFx0Y29uc3QgbmFtZUVsID0gY29udGVudEVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLWFpLW5hbWVcIiB9KTtcblx0XHRcdG5hbWVFbC5jcmVhdGVTcGFuKHsgdGV4dDogcmVzdWx0LmZpbGUubmFtZSB9KTtcblx0XHRcdGlmIChyZXN1bHQuZG9uZSkge1xuXHRcdFx0XHRuYW1lRWwuY3JlYXRlU3Bhbih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLWFpLWRvbmVcIiwgdGV4dDogXCIg4pyTXCIgfSk7XG5cdFx0XHR9XG5cdFx0XHRjb250ZW50RWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItYWktcGF0aFwiLCB0ZXh0OiByZXN1bHQuZmlsZS5wYXRoIH0pO1xuXHRcdFx0Y29uc3Qgb3BlbkJ1dHRvbiA9IGl0ZW1FbC5jcmVhdGVFbChcImJ1dHRvblwiLCB7XG5cdFx0XHRcdGNsczogXCJhdXRvLWZyb250bWF0dGVyLWFpLW9wZW5cIixcblx0XHRcdFx0YXR0cjogeyBcImFyaWEtbGFiZWxcIjogXCLmiZPlvIDmlofku7ZcIiB9LFxuXHRcdFx0fSk7XG5cdFx0XHRzZXRJY29uKG9wZW5CdXR0b24sIFwiZXh0ZXJuYWwtbGlua1wiKTtcblx0XHRcdG9wZW5CdXR0b24ub25jbGljayA9IGFzeW5jICgpID0+IHtcblx0XHRcdFx0YXdhaXQgdGhpcy5hcHAud29ya3NwYWNlLm9wZW5MaW5rVGV4dChyZXN1bHQuZmlsZS5wYXRoLCBcIlwiLCBmYWxzZSk7XG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGNvbnN0IHN0YXR1c1RleHQgPVxuXHRcdFx0c3RhdGUucHJvY2Vzc2VkQ291bnQgPT09IHN0YXRlLnJlc3VsdHMubGVuZ3RoICYmICFzdGF0ZS5pc0V4ZWN1dGluZ1xuXHRcdFx0XHQ/IGDlrozmiJDvvIzlt7LlpITnkIYgJHtzdGF0ZS5wcm9jZXNzZWRDb3VudH0g56+HYFxuXHRcdFx0XHQ6IFwiXCI7XG5cdFx0bmV3IFNldHRpbmcocmVzdWx0RWwpXG5cdFx0XHQuc2V0RGVzYyhzdGF0dXNUZXh0KVxuXHRcdFx0LmFkZEJ1dHRvbigoYnV0dG9uKSA9PiB7XG5cdFx0XHRcdGJ1dHRvblxuXHRcdFx0XHRcdC5zZXRCdXR0b25UZXh0KHN0YXRlLmlzRXhlY3V0aW5nID8gXCLmiafooYzkuK0uLi5cIiA6IFwi5omn6KGMXCIpXG5cdFx0XHRcdFx0LnNldEN0YSgpXG5cdFx0XHRcdFx0LnNldERpc2FibGVkKHN0YXRlLmlzRXhlY3V0aW5nIHx8IHRoaXMucGx1Z2luLmlzQUlTdW1tYXJ5VGFza1J1bm5pbmcob3B0aW9ucy50YXNrKSlcblx0XHRcdFx0XHQub25DbGljayhhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLmV4ZWN1dGVBSVN1bW1hcnlUYXNrKG9wdGlvbnMudGFzayk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0QUlTdW1tYXJ5VGFza1N0YXRlKHRhc2s6IEFJU3VtbWFyeVRhc2tUeXBlKTogQUlTdW1tYXJ5VGFza1VpU3RhdGUge1xuXHRcdHJldHVybiB7XG5cdFx0XHRyZXN1bHRzOiB0aGlzLmFpU3VtbWFyeUNvbXBsZXRpb25SZXN1bHRzLFxuXHRcdFx0aGFzU2Nhbm5lZDogdGhpcy5oYXNTY2FubmVkQUlTdW1tYXJ5Q29tcGxldGlvbixcblx0XHRcdGlzU2Nhbm5pbmc6IHRoaXMuaXNTY2FubmluZ0FJU3VtbWFyeUNvbXBsZXRpb24sXG5cdFx0XHRpc0V4ZWN1dGluZzogdGhpcy5pc0V4ZWN1dGluZ0FJU3VtbWFyeUNvbXBsZXRpb24sXG5cdFx0XHRwcm9jZXNzZWRDb3VudDogdGhpcy5wcm9jZXNzZWRBSVN1bW1hcnlDb21wbGV0aW9uQ291bnQsXG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgc2V0QUlTdW1tYXJ5VGFza1Jlc3VsdHModGFzazogQUlTdW1tYXJ5VGFza1R5cGUsIHJlc3VsdHM6IEFJU3VtbWFyeUNhbmRpZGF0ZVtdKSB7XG5cdFx0dGhpcy5haVN1bW1hcnlDb21wbGV0aW9uUmVzdWx0cyA9IHJlc3VsdHM7XG5cdH1cblxuXHRwcml2YXRlIHNldEFJU3VtbWFyeVRhc2tTY2FubmluZyh0YXNrOiBBSVN1bW1hcnlUYXNrVHlwZSwgdmFsdWU6IGJvb2xlYW4pIHtcblx0XHR0aGlzLmlzU2Nhbm5pbmdBSVN1bW1hcnlDb21wbGV0aW9uID0gdmFsdWU7XG5cdH1cblxuXHRwcml2YXRlIHNldEFJU3VtbWFyeVRhc2tTY2FubmVkKHRhc2s6IEFJU3VtbWFyeVRhc2tUeXBlLCB2YWx1ZTogYm9vbGVhbikge1xuXHRcdHRoaXMuaGFzU2Nhbm5lZEFJU3VtbWFyeUNvbXBsZXRpb24gPSB2YWx1ZTtcblx0fVxuXG5cdHByaXZhdGUgc2V0QUlTdW1tYXJ5VGFza0V4ZWN1dGluZyh0YXNrOiBBSVN1bW1hcnlUYXNrVHlwZSwgdmFsdWU6IGJvb2xlYW4pIHtcblx0XHR0aGlzLmlzRXhlY3V0aW5nQUlTdW1tYXJ5Q29tcGxldGlvbiA9IHZhbHVlO1xuXHR9XG5cblx0cHJpdmF0ZSBzZXRBSVN1bW1hcnlUYXNrUHJvY2Vzc2VkQ291bnQodGFzazogQUlTdW1tYXJ5VGFza1R5cGUsIHZhbHVlOiBudW1iZXIpIHtcblx0XHR0aGlzLnByb2Nlc3NlZEFJU3VtbWFyeUNvbXBsZXRpb25Db3VudCA9IHZhbHVlO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBzY2FuQUlTdW1tYXJ5VGFzayh0YXNrOiBBSVN1bW1hcnlUYXNrVHlwZSkge1xuXHRcdHRoaXMuc2V0QUlTdW1tYXJ5VGFza1NjYW5uZWQodGFzaywgdHJ1ZSk7XG5cdFx0dGhpcy5zZXRBSVN1bW1hcnlUYXNrU2Nhbm5pbmcodGFzaywgdHJ1ZSk7XG5cdFx0dGhpcy5zZXRBSVN1bW1hcnlUYXNrUmVzdWx0cyh0YXNrLCBbXSk7XG5cdFx0dGhpcy5zZXRBSVN1bW1hcnlUYXNrUHJvY2Vzc2VkQ291bnQodGFzaywgMCk7XG5cdFx0dGhpcy5kaXNwbGF5KCk7XG5cblx0XHRjb25zdCByZXN1bHRzID0gYXdhaXQgdGhpcy5wbHVnaW4uc2NhbkFJU3VtbWFyeUNhbmRpZGF0ZXModGFzaywgdHJ1ZSk7XG5cdFx0dGhpcy5zZXRBSVN1bW1hcnlUYXNrUmVzdWx0cyh0YXNrLCByZXN1bHRzKTtcblx0XHR0aGlzLnNldEFJU3VtbWFyeVRhc2tTY2FubmluZyh0YXNrLCBmYWxzZSk7XG5cdFx0dGhpcy5kaXNwbGF5KCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGV4ZWN1dGVBSVN1bW1hcnlUYXNrKHRhc2s6IEFJU3VtbWFyeVRhc2tUeXBlKSB7XG5cdFx0Y29uc3Qgc3RhdGUgPSB0aGlzLmdldEFJU3VtbWFyeVRhc2tTdGF0ZSh0YXNrKTtcblx0XHRpZiAoc3RhdGUucmVzdWx0cy5sZW5ndGggPT09IDApIHtcblx0XHRcdG5ldyBOb3RpY2UoXCJBSSDmkZjopoHvvJrmmoLml6DpnIDopoHlpITnkIbnmoTmlofmoaNcIik7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5zZXRBSVN1bW1hcnlUYXNrRXhlY3V0aW5nKHRhc2ssIHRydWUpO1xuXHRcdHRoaXMuc2V0QUlTdW1tYXJ5VGFza1Byb2Nlc3NlZENvdW50KHRhc2ssIDApO1xuXHRcdGZvciAoY29uc3QgcmVzdWx0IG9mIHN0YXRlLnJlc3VsdHMpIHtcblx0XHRcdHJlc3VsdC5kb25lID0gZmFsc2U7XG5cdFx0fVxuXHRcdHRoaXMuZGlzcGxheSgpO1xuXG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHByb2Nlc3NlZENvdW50ID0gYXdhaXQgdGhpcy5wbHVnaW4uZXhlY3V0ZUFJU3VtbWFyeVF1ZXVlKHRhc2ssIHN0YXRlLnJlc3VsdHMsIHRydWUsICgpID0+IHtcblx0XHRcdFx0dGhpcy5zZXRBSVN1bW1hcnlUYXNrUHJvY2Vzc2VkQ291bnQodGFzaywgdGhpcy5nZXRBSVN1bW1hcnlUYXNrU3RhdGUodGFzaykucHJvY2Vzc2VkQ291bnQgKyAxKTtcblx0XHRcdFx0dGhpcy5kaXNwbGF5KCk7XG5cdFx0XHR9KTtcblx0XHRcdHRoaXMuc2V0QUlTdW1tYXJ5VGFza1Byb2Nlc3NlZENvdW50KHRhc2ssIHByb2Nlc3NlZENvdW50KTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0dGhpcy5zZXRBSVN1bW1hcnlUYXNrRXhlY3V0aW5nKHRhc2ssIGZhbHNlKTtcblx0XHRcdHRoaXMuZGlzcGxheSgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyUmVxdWlyZWRGaWVsZHNJbmZvKGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCkge1xuXHRcdGNvbnN0IHNlY3Rpb25FbCA9IGNvbnRhaW5lckVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLXJlcXVpcmVkLWZpZWxkc1wiIH0pO1xuXHRcdHNlY3Rpb25FbC5jcmVhdGVFbChcImgyXCIsIHsgdGV4dDogXCLpu5jorqTmlofku7blsZ7mgKflrZfmrrVcIiB9KTtcblx0XHRzZWN0aW9uRWwuY3JlYXRlRWwoXCJwXCIsIHtcblx0XHRcdHRleHQ6IFwi5Lul5LiL5a2X5q615Lya5Zyo5paw5bu65paH5qGj5pe26Ieq5Yqo5YaZ5YWl77yM5bm25Zyo5omr5o+P5LuT5bqT5pe26KGl5YWo5qOA5p+l44CCXCIsXG5cdFx0fSk7XG5cblx0XHRjb25zdCB0YWJsZSA9IHNlY3Rpb25FbC5jcmVhdGVFbChcInRhYmxlXCIpO1xuXHRcdGNvbnN0IHRoZWFkID0gdGFibGUuY3JlYXRlRWwoXCJ0aGVhZFwiKTtcblx0XHRjb25zdCBoZWFkZXJSb3cgPSB0aGVhZC5jcmVhdGVFbChcInRyXCIpO1xuXHRcdGZvciAoY29uc3QgaGVhZGVyIG9mIFtcIuWtl+autVwiLCBcIuivtOaYjlwiLCBcIuWhq+WGmeaWueW8j1wiXSkge1xuXHRcdFx0aGVhZGVyUm93LmNyZWF0ZUVsKFwidGhcIiwgeyB0ZXh0OiBoZWFkZXIgfSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdGJvZHkgPSB0YWJsZS5jcmVhdGVFbChcInRib2R5XCIpO1xuXHRcdGZvciAoY29uc3Qgcm93IG9mIFtcblx0XHRcdFtcIumhueebrlwiLCBcIuaWh+aho+aJgOWxnumhueebrlwiLCBcIuaWh+S7tuWkueinhOWImeiHquWKqOWhq+WGme+8jOaIluaJi+WKqOWhq+WGmVwiXSxcblx0XHRcdFtcIuexu+Wei1wiLCBcIuaWh+aho+exu+Wei1wiLCBcIuaWh+S7tuWkueinhOWImeiHquWKqOWhq+WGme+8jOaIluaJi+WKqOWhq+WGmVwiXSxcblx0XHRcdFtcIuS9nOiAhVwiLCBcIuaWh+aho+WIm+W7uuiAhVwiLCBcIuagueaNruiuvuWkh+iHquWKqOivhuWIq1wiXSxcblx0XHRcdFtcIuaRmOimgVwiLCBcIuaWh+aho+WGheWuueaRmOimgVwiLCBcIuaJi+WKqOWhq+WGmSAvIEFJIOiHquWKqOeUn+aIkFwiXSxcblx0XHRcdFtcIuWIm+W7uuaXtumXtFwiLCBcIuaWh+aho+WIm+W7uuaXtumXtFwiLCBcIuiHquWKqOiOt+WPllwiXSxcblx0XHRcdFtcIuacgOWQjuabtOaWsFwiLCBcIuacgOWQjuS4gOasoee8lui+keaXtumXtFwiLCBcIuiHquWKqOabtOaWsFwiXSxcblx0XHRdKSB7XG5cdFx0XHRjb25zdCB0ciA9IHRib2R5LmNyZWF0ZUVsKFwidHJcIik7XG5cdFx0XHRmb3IgKGNvbnN0IGNlbGwgb2Ygcm93KSB7XG5cdFx0XHRcdHRyLmNyZWF0ZUVsKFwidGRcIiwgeyB0ZXh0OiBjZWxsIH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyRGV2aWNlQmluZGluZ3MoY29udGFpbmVyRWw6IEhUTUxFbGVtZW50KSB7XG5cdFx0dGhpcy5yZW5kZXJDdXJyZW50RGV2aWNlU3RhdHVzKGNvbnRhaW5lckVsKTtcblx0XHR0aGlzLnJlbmRlckJvdW5kRGV2aWNlTGlzdChjb250YWluZXJFbCk7XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlckN1cnJlbnREZXZpY2VTdGF0dXMoY29udGFpbmVyRWw6IEhUTUxFbGVtZW50KSB7XG5cdFx0Y29uc3QgY3VycmVudEJpbmRpbmcgPSB0aGlzLmdldEN1cnJlbnREZXZpY2VCaW5kaW5nKCk7XG5cdFx0Y29uc3Qgc3RhdHVzRWwgPSBjb250YWluZXJFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1jdXJyZW50LWRldmljZS1jYXJkXCIgfSk7XG5cdFx0c3RhdHVzRWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItY3VycmVudC1kZXZpY2UtdGl0bGVcIiwgdGV4dDogXCLmnKzmnLrorr7lpIdcIiB9KTtcblx0XHRzdGF0dXNFbC5jcmVhdGVEaXYoe1xuXHRcdFx0Y2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItY3VycmVudC1kZXZpY2UtbGluZVwiLFxuXHRcdFx0dGV4dDogYFVVSUTvvJoke21hc2tEZXZpY2VVdWlkKHRoaXMucGx1Z2luLmN1cnJlbnREZXZpY2VVdWlkKX1gLFxuXHRcdH0pO1xuXG5cdFx0aWYgKGN1cnJlbnRCaW5kaW5nPy5hdXRob3IpIHtcblx0XHRcdHN0YXR1c0VsLmNyZWF0ZURpdih7XG5cdFx0XHRcdGNsczogXCJhdXRvLWZyb250bWF0dGVyLWN1cnJlbnQtZGV2aWNlLWxpbmVcIixcblx0XHRcdFx0dGV4dDogYOeKtuaAge+8muKchSDlt7Lnu5Hlrpog4oCUICR7Y3VycmVudEJpbmRpbmcuYXV0aG9yfWAsXG5cdFx0XHR9KTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRzdGF0dXNFbC5jcmVhdGVEaXYoe1xuXHRcdFx0Y2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItY3VycmVudC1kZXZpY2UtbGluZVwiLFxuXHRcdFx0dGV4dDogXCLnirbmgIHvvJrimqDvuI8g5pyq57uR5a6aXCIsXG5cdFx0fSk7XG5cblx0XHRjb25zdCBhY3Rpb25FbCA9IHN0YXR1c0VsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLWN1cnJlbnQtZGV2aWNlLWFjdGlvblwiIH0pO1xuXHRcdGlmICh0aGlzLmJpbmRpbmdDdXJyZW50RGV2aWNlKSB7XG5cdFx0XHRpZiAodGhpcy5iaW5kaW5nQ3VycmVudERldmljZUN1c3RvbSkge1xuXHRcdFx0XHRuZXcgU2V0dGluZyhhY3Rpb25FbCkuYWRkVGV4dCgodGV4dCkgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IGNvbmZpcm0gPSBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLmJpbmRDdXJyZW50RGV2aWNlKHRleHQuZ2V0VmFsdWUoKSk7XG5cdFx0XHRcdFx0fTtcblxuXHRcdFx0XHRcdHRleHQuc2V0UGxhY2Vob2xkZXIoXCLoh6rlrprkuYnkvZzogIVcIik7XG5cdFx0XHRcdFx0dGV4dC5pbnB1dEVsLm9uYmx1ciA9IGNvbmZpcm07XG5cdFx0XHRcdFx0dGV4dC5pbnB1dEVsLm9ua2V5ZG93biA9IChldmVudCkgPT4ge1xuXHRcdFx0XHRcdFx0aWYgKGV2ZW50LmtleSA9PT0gXCJFbnRlclwiKSB7XG5cdFx0XHRcdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdFx0XHRcdGNvbmZpcm0oKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHRleHQuaW5wdXRFbC5mb2N1cygpLCAwKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRuZXcgU2V0dGluZyhhY3Rpb25FbCkuYWRkRHJvcGRvd24oKGRyb3Bkb3duKSA9PiB7XG5cdFx0XHRcdFx0ZHJvcGRvd24uYWRkT3B0aW9uKFwiXCIsIFwi77yI6K+36YCJ5oup77yJXCIpO1xuXHRcdFx0XHRcdGZvciAoY29uc3Qgb3B0aW9uIG9mIEFVVEhPUl9PUFRJT05TKSB7XG5cdFx0XHRcdFx0XHRkcm9wZG93bi5hZGRPcHRpb24ob3B0aW9uLCBvcHRpb24pO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGRyb3Bkb3duLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdFx0aWYgKHZhbHVlID09PSBDVVNUT01fQVVUSE9SX01PREUpIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5iaW5kaW5nQ3VycmVudERldmljZUN1c3RvbSA9IHRydWU7XG5cdFx0XHRcdFx0XHRcdHRoaXMuZGlzcGxheSgpO1xuXHRcdFx0XHRcdFx0fSBlbHNlIGlmICh2YWx1ZSkge1xuXHRcdFx0XHRcdFx0XHRhd2FpdCB0aGlzLmJpbmRDdXJyZW50RGV2aWNlKHZhbHVlKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdG5ldyBTZXR0aW5nKGFjdGlvbkVsKS5hZGRCdXR0b24oKGJ1dHRvbikgPT4ge1xuXHRcdFx0XHRidXR0b24uc2V0QnV0dG9uVGV4dChcIue7keWumuacrOaculwiKS5zZXRDdGEoKS5vbkNsaWNrKCgpID0+IHtcblx0XHRcdFx0XHR0aGlzLmJpbmRpbmdDdXJyZW50RGV2aWNlID0gdHJ1ZTtcblx0XHRcdFx0XHR0aGlzLmJpbmRpbmdDdXJyZW50RGV2aWNlQ3VzdG9tID0gZmFsc2U7XG5cdFx0XHRcdFx0dGhpcy5kaXNwbGF5KCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJCb3VuZERldmljZUxpc3QoY29udGFpbmVyRWw6IEhUTUxFbGVtZW50KSB7XG5cdFx0Y29udGFpbmVyRWwuY3JlYXRlRWwoXCJoMlwiLCB7IHRleHQ6IFwi5omA5pyJ5bey57uR5a6a6K6+5aSHXCIgfSk7XG5cdFx0Y29uc3QgbGlzdEVsID0gY29udGFpbmVyRWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItYm91bmQtZGV2aWNlLWxpc3RcIiB9KTtcblx0XHRjb25zdCBiaW5kaW5ncyA9IHRoaXMucGx1Z2luLnNldHRpbmdzLmRldmljZUJpbmRpbmdzLmZpbHRlcigoYmluZGluZykgPT4gYmluZGluZy51dWlkICYmIGJpbmRpbmcuYXV0aG9yKTtcblx0XHRpZiAoYmluZGluZ3MubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRsaXN0RWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItYm91bmQtZGV2aWNlLWVtcHR5XCIsIHRleHQ6IFwi5pqC5peg5bey57uR5a6a6K6+5aSHXCIgfSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Zm9yIChjb25zdCBiaW5kaW5nIG9mIGJpbmRpbmdzKSB7XG5cdFx0XHRjb25zdCByb3dFbCA9IGxpc3RFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1ib3VuZC1kZXZpY2Utcm93XCIgfSk7XG5cdFx0XHRyb3dFbC5jcmVhdGVEaXYoe1xuXHRcdFx0XHRjbHM6IFwiYXV0by1mcm9udG1hdHRlci1ib3VuZC1kZXZpY2UtdXVpZFwiLFxuXHRcdFx0XHR0ZXh0OiBtYXNrRGV2aWNlVXVpZChiaW5kaW5nLnV1aWQpLFxuXHRcdFx0fSk7XG5cdFx0XHRjb25zdCBhdXRob3JFbCA9IHJvd0VsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLWJvdW5kLWRldmljZS1hdXRob3JcIiB9KTtcblx0XHRcdGF1dGhvckVsLmNyZWF0ZVNwYW4oeyB0ZXh0OiBiaW5kaW5nLmF1dGhvciB9KTtcblx0XHRcdGlmIChiaW5kaW5nLnV1aWQgPT09IHRoaXMucGx1Z2luLmN1cnJlbnREZXZpY2VVdWlkKSB7XG5cdFx0XHRcdGF1dGhvckVsLmNyZWF0ZVNwYW4oeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1kZXZpY2UtbG9jYWxcIiwgdGV4dDogXCLvvIjmnKzmnLrvvIlcIiB9KTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlckFib3V0U2VjdGlvbihjb250YWluZXJFbDogSFRNTEVsZW1lbnQpIHtcblx0XHRjb250YWluZXJFbC5jcmVhdGVFbChcImgyXCIsIHsgdGV4dDogXCJhdXRvLWZyb250bWF0dGVyXCIgfSk7XG5cdFx0Y29udGFpbmVyRWwuY3JlYXRlRGl2KHtcblx0XHRcdGNsczogXCJhdXRvLWZyb250bWF0dGVyLWFib3V0LXZlcnNpb25cIixcblx0XHRcdHRleHQ6IGDlvZPliY3niYjmnKzvvJoke3RoaXMucGx1Z2luLm1hbmlmZXN0LnZlcnNpb259YCxcblx0XHR9KTtcblxuXHRcdGNvbnN0IGFjdGlvbkVsID0gY29udGFpbmVyRWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItYWJvdXQtYWN0aW9uXCIgfSk7XG5cdFx0Y29uc3QgY2hlY2tCdXR0b24gPSBhY3Rpb25FbC5jcmVhdGVFbChcImJ1dHRvblwiLCB7XG5cdFx0XHRjbHM6IFwibW9kLWN0YSBhdXRvLWZyb250bWF0dGVyLWFib3V0LWNoZWNrLWJ0blwiLFxuXHRcdFx0dGV4dDogdGhpcy5pc0NoZWNraW5nVXBkYXRlID8gXCLmo4Dmn6XkuK0uLi5cIiA6IFwi5qOA5p+l5pu05pawXCIsXG5cdFx0fSk7XG5cdFx0Y2hlY2tCdXR0b24uZGlzYWJsZWQgPSB0aGlzLmlzQ2hlY2tpbmdVcGRhdGUgfHwgdGhpcy5pc1VwZGF0aW5nO1xuXHRcdGNoZWNrQnV0dG9uLm9uY2xpY2sgPSBhc3luYyAoKSA9PiB7XG5cdFx0XHR0aGlzLmlzQ2hlY2tpbmdVcGRhdGUgPSB0cnVlO1xuXHRcdFx0dGhpcy51cGRhdGVSZXN1bHRNZXNzYWdlID0gXCJcIjtcblx0XHRcdHRoaXMubGF0ZXN0VmVyc2lvbiA9IFwiXCI7XG5cdFx0XHR0aGlzLmRpc3BsYXkoKTtcblxuXHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5wbHVnaW4uY2hlY2tGb3JVcGRhdGUoKTtcblx0XHRcdHRoaXMuaXNDaGVja2luZ1VwZGF0ZSA9IGZhbHNlO1xuXG5cdFx0XHRpZiAocmVzdWx0LmVycm9yID09PSBcIm5vdF9mb3VuZFwiKSB7XG5cdFx0XHRcdG5ldyBOb3RpY2UoXCLmnKrmib7liLDov5znq6/ku5PlupPvvIzor7fmo4Dmn6XnvZHnu5xcIik7XG5cdFx0XHRcdHRoaXMudXBkYXRlUmVzdWx0TWVzc2FnZSA9IFwi5pyq5om+5Yiw6L+c56uv5LuT5bqT77yM6K+35qOA5p+l572R57ucXCI7XG5cdFx0XHR9IGVsc2UgaWYgKHJlc3VsdC5lcnJvcikge1xuXHRcdFx0XHRuZXcgTm90aWNlKHJlc3VsdC5lcnJvcik7XG5cdFx0XHRcdHRoaXMudXBkYXRlUmVzdWx0TWVzc2FnZSA9IHJlc3VsdC5lcnJvcjtcblx0XHRcdH0gZWxzZSBpZiAocmVzdWx0Lmhhc1VwZGF0ZSkge1xuXHRcdFx0XHR0aGlzLmxhdGVzdFZlcnNpb24gPSByZXN1bHQudmVyc2lvbjtcblx0XHRcdFx0dGhpcy51cGRhdGVSZXN1bHRNZXNzYWdlID0gYPCflIQg5Y+R546w5paw54mI5pys77yaJHtyZXN1bHQudmVyc2lvbn3vvIjlvZPliY0gJHt0aGlzLnBsdWdpbi5tYW5pZmVzdC52ZXJzaW9ufe+8iWA7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLnVwZGF0ZVJlc3VsdE1lc3NhZ2UgPSBg4pyFIOW9k+WJjeW3suaYr+acgOaWsOeJiOacrO+8iCR7dGhpcy5wbHVnaW4ubWFuaWZlc3QudmVyc2lvbn3vvIlgO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5kaXNwbGF5KCk7XG5cdFx0fTtcblxuXHRcdGlmICh0aGlzLnVwZGF0ZVJlc3VsdE1lc3NhZ2UpIHtcblx0XHRcdGNvbnN0IHJlc3VsdEVsID0gY29udGFpbmVyRWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItYWJvdXQtcmVzdWx0XCIgfSk7XG5cdFx0XHRyZXN1bHRFbC5jcmVhdGVEaXYoeyB0ZXh0OiB0aGlzLnVwZGF0ZVJlc3VsdE1lc3NhZ2UgfSk7XG5cblx0XHRcdGlmICh0aGlzLmxhdGVzdFZlcnNpb24pIHtcblx0XHRcdFx0Y29uc3QgdXBkYXRlQnV0dG9uID0gcmVzdWx0RWwuY3JlYXRlRWwoXCJidXR0b25cIiwge1xuXHRcdFx0XHRcdGNsczogXCJtb2QtY3RhIGF1dG8tZnJvbnRtYXR0ZXItYWJvdXQtdXBkYXRlLWJ0blwiLFxuXHRcdFx0XHRcdHRleHQ6IHRoaXMuaXNVcGRhdGluZyA/IGDmm7TmlrDkuK0uLi7vvIgke3RoaXMudXBkYXRlUHJvZ3Jlc3N9LzPvvIlgIDogXCLnq4vljbPmm7TmlrBcIixcblx0XHRcdFx0fSk7XG5cdFx0XHRcdHVwZGF0ZUJ1dHRvbi5kaXNhYmxlZCA9IHRoaXMuaXNVcGRhdGluZztcblx0XHRcdFx0dXBkYXRlQnV0dG9uLm9uY2xpY2sgPSBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5pc1VwZGF0aW5nID0gdHJ1ZTtcblx0XHRcdFx0XHR0aGlzLnVwZGF0ZVByb2dyZXNzID0gMDtcblx0XHRcdFx0XHR0aGlzLmRpc3BsYXkoKTtcblxuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLnBsdWdpbi5wZXJmb3JtVXBkYXRlKHRoaXMubGF0ZXN0VmVyc2lvbiwgKHN0ZXAsIHRvdGFsKSA9PiB7XG5cdFx0XHRcdFx0XHRcdHRoaXMudXBkYXRlUHJvZ3Jlc3MgPSBzdGVwO1xuXHRcdFx0XHRcdFx0XHR0aGlzLmRpc3BsYXkoKTtcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0dGhpcy5pc1VwZGF0aW5nID0gZmFsc2U7XG5cdFx0XHRcdFx0XHR0aGlzLmxhdGVzdFZlcnNpb24gPSBcIlwiO1xuXHRcdFx0XHRcdFx0dGhpcy51cGRhdGVSZXN1bHRNZXNzYWdlID0gXCJcIjtcblx0XHRcdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRcdFx0dGhpcy5pc1VwZGF0aW5nID0gZmFsc2U7XG5cdFx0XHRcdFx0XHRuZXcgTm90aWNlKGDmm7TmlrDlpLHotKXvvJoke2dldEVycm9yTWVzc2FnZShlcnJvcil9YCk7XG5cdFx0XHRcdFx0XHR0aGlzLnVwZGF0ZVJlc3VsdE1lc3NhZ2UgPSBg5pu05paw5aSx6LSl77yaJHtnZXRFcnJvck1lc3NhZ2UoZXJyb3IpfWA7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHRoaXMuZGlzcGxheSgpO1xuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwiaDNcIiwgeyB0ZXh0OiBcIuiHquWKqOabtOaWsFwiLCBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1hYm91dC1jb25maWctdGl0bGVcIiB9KTtcblx0XHRuZXcgU2V0dGluZyhjb250YWluZXJFbClcblx0XHRcdC5zZXROYW1lKFwi6Ieq5Yqo5qOA5p+l5pu05pawXCIpXG5cdFx0XHQuc2V0RGVzYyhcIuavjyA2MCDliIbpkp/oh6rliqjmo4Dmn6Xlubbmm7TmlrDliLDmnIDmlrDniYjmnKzjgIJcIilcblx0XHRcdC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT5cblx0XHRcdFx0dG9nZ2xlLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmF1dG9VcGRhdGUpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLmF1dG9VcGRhdGUgPSB2YWx1ZTtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0fSksXG5cdFx0XHQpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRDdXJyZW50RGV2aWNlQmluZGluZygpOiBEZXZpY2VBdXRob3JCaW5kaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5wbHVnaW4uc2V0dGluZ3MuZGV2aWNlQmluZGluZ3MuZmluZCgoYmluZGluZykgPT4ge1xuXHRcdFx0cmV0dXJuIGJpbmRpbmcudXVpZCA9PT0gdGhpcy5wbHVnaW4uY3VycmVudERldmljZVV1aWQ7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGJpbmRDdXJyZW50RGV2aWNlKGF1dGhvcjogc3RyaW5nKSB7XG5cdFx0Y29uc3QgdHJpbW1lZCA9IGF1dGhvci50cmltKCk7XG5cdFx0aWYgKCF0cmltbWVkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0bGV0IGJpbmRpbmcgPSB0aGlzLmdldEN1cnJlbnREZXZpY2VCaW5kaW5nKCk7XG5cdFx0aWYgKCFiaW5kaW5nKSB7XG5cdFx0XHRiaW5kaW5nID0ge1xuXHRcdFx0XHR1dWlkOiB0aGlzLnBsdWdpbi5jdXJyZW50RGV2aWNlVXVpZCxcblx0XHRcdFx0YXV0aG9yOiB0cmltbWVkLFxuXHRcdFx0fTtcblx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLmRldmljZUJpbmRpbmdzLnB1c2goYmluZGluZyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGJpbmRpbmcuYXV0aG9yID0gdHJpbW1lZDtcblx0XHR9XG5cblx0XHR0aGlzLmJpbmRpbmdDdXJyZW50RGV2aWNlID0gZmFsc2U7XG5cdFx0dGhpcy5iaW5kaW5nQ3VycmVudERldmljZUN1c3RvbSA9IGZhbHNlO1xuXHRcdFx0YXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHR0aGlzLmRpc3BsYXkoKTtcblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyRm9sZGVyRGVmYXVsdFJ1bGVzKGZvbGRlclJ1bGVUYWJDb250ZW50OiBIVE1MRWxlbWVudCkge1xuXHRcdGZvbGRlclJ1bGVUYWJDb250ZW50LmFkZENsYXNzKFwiYXV0by1mcm9udG1hdHRlci1mb2xkZXItcnVsZXMtdGFiXCIpO1xuXHRcdGNvbnN0IHNlY3Rpb25FbCA9IGZvbGRlclJ1bGVUYWJDb250ZW50LmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLWZvbGRlci1ydWxlcy1zZWN0aW9uXCIgfSk7XG5cdFx0Y29uc3QgaGVhZGVyRWwgPSBzZWN0aW9uRWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItZm9sZGVyLXJ1bGVzLWhlYWRlclwiIH0pO1xuXHRcdGNvbnN0IGhlYWRlclRvcEVsID0gaGVhZGVyRWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItZm9sZGVyLXJ1bGVzLWhlYWRlci10b3BcIiB9KTtcblx0XHRoZWFkZXJUb3BFbC5jcmVhdGVFbChcImgyXCIsIHsgdGV4dDogXCLmlofku7blpLnlhoXmlofmoaPlsZ7mgKfljLnphY3op4TliJlcIiB9KTtcblx0XHRjb25zdCBhZGRSdWxlRWwgPSBoZWFkZXJUb3BFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1mb2xkZXItcnVsZXMtYWRkLWFjdGlvblwiIH0pO1xuXHRcdG5ldyBTZXR0aW5nKGFkZFJ1bGVFbCkuYWRkQnV0dG9uKChidXR0b24pID0+IHtcblx0XHRcdGJ1dHRvbi5zZXRCdXR0b25UZXh0KFwi5re75Yqg6KeE5YiZXCIpLnNldEN0YSgpLm9uQ2xpY2soYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRpZiAoIXRoaXMucGx1Z2luLmVuc3VyZURldmljZUJvdW5kKCkpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MuZm9sZGVyRGVmYXVsdHMucHVzaCh0aGlzLnBsdWdpbi5jcmVhdGVGb2xkZXJSdWxlKCkpO1xuXHRcdFx0XHRhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0dGhpcy5jdXJyZW50UnVsZVBhZ2UgPSBNYXRoLm1heCgwLCBNYXRoLmNlaWwodGhpcy5wbHVnaW4uc2V0dGluZ3MuZm9sZGVyRGVmYXVsdHMubGVuZ3RoIC8gUlVMRVNfUEVSX1BBR0UpIC0gMSk7XG5cdFx0XHRcdHRoaXMuZGlzcGxheSgpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdFx0aGVhZGVyRWwuY3JlYXRlRWwoXCJwXCIsIHtcblx0XHRcdGNsczogXCJhdXRvLWZyb250bWF0dGVyLWZvbGRlci1ydWxlcy1zdWJ0aXRsZVwiLFxuXHRcdFx0dGV4dDogXCLmi5blhaXop4TliJnmlofku7blpLnlhoXnmoTmiYDmnIltZOaWh+S7tu+8jOm7mOiupOeahOaWh+S7tuWxnuaAp+Wtl+auteS8mui3n+maj+WMuemFjeinhOWImei1sFwiLFxuXHRcdH0pO1xuXHRcdGhlYWRlckVsLmNyZWF0ZUVsKFwicFwiLCB7XG5cdFx0XHRjbHM6IFwiYXV0by1mcm9udG1hdHRlci1mb2xkZXItcnVsZXMtbm90ZVwiLFxuXHRcdFx0dGV4dDogJ+W9k+WJjeS7heaUr+aMgeiuvue9rlwi6aG555uuXCJcIuexu+Wei1wi5a2X5q61Jyxcblx0XHR9KTtcblxuXHRcdGNvbnN0IGZvbGRlcnMgPSBnZXRWYXVsdEZvbGRlcnModGhpcy5hcHApO1xuXHRcdHRoaXMucmVuZGVyUnVsZUNhcm91c2VsKHNlY3Rpb25FbCwgZm9sZGVycyk7XG5cblx0XHRzZWN0aW9uRWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItc2VjdGlvbi1kaXZpZGVyXCIgfSk7XG5cblx0XHRjb25zdCBjaGVja21hcmtTZXR0aW5nRWwgPSBzZWN0aW9uRWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItZm9sZGVyLWNoZWNrbWFyay1zZXR0aW5nXCIgfSk7XG5cdFx0bmV3IFNldHRpbmcoY2hlY2ttYXJrU2V0dGluZ0VsKVxuXHRcdFx0LnNldE5hbWUoXCLlnKjmlofku7bliJfooajkuK3moIforrDlt7LphY3op4TliJnnmoTmlofku7blpLlcIilcblx0XHRcdC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT4ge1xuXHRcdFx0XHR0b2dnbGVcblx0XHRcdFx0XHQuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3Muc2hvd0ZvbGRlckNoZWNrbWFyaylcblx0XHRcdFx0XHQub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0XHRpZiAoIXRoaXMucGx1Z2luLmVuc3VyZURldmljZUJvdW5kKCkpIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5kaXNwbGF5KCk7XG5cdFx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLnNob3dGb2xkZXJDaGVja21hcmsgPSB2YWx1ZTtcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4ucmVmcmVzaEZvbGRlckNoZWNrbWFya3MoKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXG5cdFx0c2VjdGlvbkVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLXNlY3Rpb24tZGl2aWRlclwiIH0pO1xuXG5cdFx0dGhpcy5yZW5kZXJVbm1hdGNoZWRGb2xkZXJTZWN0aW9uKHNlY3Rpb25FbCk7XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlclJ1bGVDYXJvdXNlbChmb2xkZXJSdWxlU2VjdGlvbkVsOiBIVE1MRWxlbWVudCwgZm9sZGVyczogc3RyaW5nW10pIHtcblx0XHRjb25zdCBydWxlQ291bnQgPSB0aGlzLnBsdWdpbi5zZXR0aW5ncy5mb2xkZXJEZWZhdWx0cy5sZW5ndGg7XG5cdFx0Y29uc3QgcGFnZUNvdW50ID0gTWF0aC5tYXgoMSwgTWF0aC5jZWlsKHJ1bGVDb3VudCAvIFJVTEVTX1BFUl9QQUdFKSk7XG5cdFx0dGhpcy5jdXJyZW50UnVsZVBhZ2UgPSBjbGFtcCh0aGlzLmN1cnJlbnRSdWxlUGFnZSwgMCwgcGFnZUNvdW50IC0gMSk7XG5cblx0XHRjb25zdCBjYXJvdXNlbEVsID0gZm9sZGVyUnVsZVNlY3Rpb25FbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1ydWxlLWNhcm91c2VsXCIgfSk7XG5cdFx0Y29uc3Qgdmlld3BvcnRFbCA9IGNhcm91c2VsRWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItcnVsZS1jYXJvdXNlbC12aWV3cG9ydFwiIH0pO1xuXHRcdGNvbnN0IGhhc011bHRpcGxlUGFnZXMgPSBwYWdlQ291bnQgPiAxO1xuXG5cdFx0aWYgKGhhc011bHRpcGxlUGFnZXMpIHtcblx0XHRcdHRoaXMucmVuZGVyUnVsZVBhZ2VCdXR0b24odmlld3BvcnRFbCwgXCJsZWZ0XCIsIHRoaXMuY3VycmVudFJ1bGVQYWdlID09PSAwLCAoKSA9PiB7XG5cdFx0XHRcdHRoaXMuY3VycmVudFJ1bGVQYWdlID0gTWF0aC5tYXgoMCwgdGhpcy5jdXJyZW50UnVsZVBhZ2UgLSAxKTtcblx0XHRcdFx0dGhpcy5kaXNwbGF5KCk7XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRjb25zdCBydWxlR3JpZEVsID0gdmlld3BvcnRFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1ydWxlLWdyaWRcIiB9KTtcblx0XHRjb25zdCBwYWdlU3RhcnQgPSB0aGlzLmN1cnJlbnRSdWxlUGFnZSAqIFJVTEVTX1BFUl9QQUdFO1xuXHRcdGNvbnN0IHBhZ2VSdWxlcyA9IHRoaXMucGx1Z2luLnNldHRpbmdzLmZvbGRlckRlZmF1bHRzLnNsaWNlKHBhZ2VTdGFydCwgcGFnZVN0YXJ0ICsgUlVMRVNfUEVSX1BBR0UpO1xuXG5cdFx0aWYgKHJ1bGVDb3VudCA9PT0gMCkge1xuXHRcdFx0cnVsZUdyaWRFbC5jcmVhdGVEaXYoe1xuXHRcdFx0XHRjbHM6IFwiYXV0by1mcm9udG1hdHRlci1ydWxlLWVtcHR5XCIsXG5cdFx0XHRcdHRleHQ6IFwi5pqC5peg6KeE5YiZXCIsXG5cdFx0XHR9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Zm9yIChsZXQgcGFnZUluZGV4ID0gMDsgcGFnZUluZGV4IDwgcGFnZVJ1bGVzLmxlbmd0aDsgcGFnZUluZGV4KyspIHtcblx0XHRcdFx0dGhpcy5yZW5kZXJSdWxlQ2FyZChydWxlR3JpZEVsLCBwYWdlUnVsZXNbcGFnZUluZGV4XSwgcGFnZVN0YXJ0ICsgcGFnZUluZGV4LCBmb2xkZXJzKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoaGFzTXVsdGlwbGVQYWdlcykge1xuXHRcdFx0dGhpcy5yZW5kZXJSdWxlUGFnZUJ1dHRvbih2aWV3cG9ydEVsLCBcInJpZ2h0XCIsIHRoaXMuY3VycmVudFJ1bGVQYWdlID09PSBwYWdlQ291bnQgLSAxLCAoKSA9PiB7XG5cdFx0XHRcdHRoaXMuY3VycmVudFJ1bGVQYWdlID0gTWF0aC5taW4ocGFnZUNvdW50IC0gMSwgdGhpcy5jdXJyZW50UnVsZVBhZ2UgKyAxKTtcblx0XHRcdFx0dGhpcy5kaXNwbGF5KCk7XG5cdFx0XHR9KTtcblxuXHRcdFx0Y29uc3QgZG90c0VsID0gY2Fyb3VzZWxFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1ydWxlLWRvdHNcIiB9KTtcblx0XHRcdGZvciAobGV0IHBhZ2UgPSAwOyBwYWdlIDwgcGFnZUNvdW50OyBwYWdlKyspIHtcblx0XHRcdFx0Y29uc3QgZG90RWwgPSBkb3RzRWwuY3JlYXRlRWwoXCJidXR0b25cIiwge1xuXHRcdFx0XHRcdGNsczogYGF1dG8tZnJvbnRtYXR0ZXItcnVsZS1kb3Qke3BhZ2UgPT09IHRoaXMuY3VycmVudFJ1bGVQYWdlID8gXCIgaXMtYWN0aXZlXCIgOiBcIlwifWAsXG5cdFx0XHRcdFx0YXR0cjogeyBcImFyaWEtbGFiZWxcIjogYOi3s+i9rOWIsOesrCAke3BhZ2UgKyAxfSDpobVgIH0sXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRkb3RFbC5vbmNsaWNrID0gKCkgPT4ge1xuXHRcdFx0XHRcdHRoaXMuY3VycmVudFJ1bGVQYWdlID0gcGFnZTtcblx0XHRcdFx0XHR0aGlzLmRpc3BsYXkoKTtcblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlclJ1bGVQYWdlQnV0dG9uKFxuXHRcdHJ1bGVDYXJvdXNlbFZpZXdwb3J0RWw6IEhUTUxFbGVtZW50LFxuXHRcdGRpcmVjdGlvbjogXCJsZWZ0XCIgfCBcInJpZ2h0XCIsXG5cdFx0ZGlzYWJsZWQ6IGJvb2xlYW4sXG5cdFx0b25DbGljazogKCkgPT4gdm9pZCxcblx0KSB7XG5cdFx0Y29uc3QgYnV0dG9uRWwgPSBydWxlQ2Fyb3VzZWxWaWV3cG9ydEVsLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcblx0XHRcdGNsczogYGF1dG8tZnJvbnRtYXR0ZXItcnVsZS1uYXYgaXMtJHtkaXJlY3Rpb259JHtkaXNhYmxlZCA/IFwiIGlzLWRpc2FibGVkXCIgOiBcIlwifWAsXG5cdFx0XHRhdHRyOiB7IFwiYXJpYS1sYWJlbFwiOiBkaXJlY3Rpb24gPT09IFwibGVmdFwiID8gXCLkuIrkuIDpobVcIiA6IFwi5LiL5LiA6aG1XCIgfSxcblx0XHR9KTtcblx0XHRzZXRJY29uKGJ1dHRvbkVsLCBkaXJlY3Rpb24gPT09IFwibGVmdFwiID8gXCJjaGV2cm9uLWxlZnRcIiA6IFwiY2hldnJvbi1yaWdodFwiKTtcblx0XHRidXR0b25FbC5kaXNhYmxlZCA9IGRpc2FibGVkO1xuXHRcdGJ1dHRvbkVsLm9uY2xpY2sgPSBvbkNsaWNrO1xuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJSdWxlQ2FyZChcblx0XHRydWxlR3JpZEVsOiBIVE1MRWxlbWVudCxcblx0XHRydWxlOiBGb2xkZXJEZWZhdWx0UnVsZSxcblx0XHRydWxlSW5kZXg6IG51bWJlcixcblx0XHRmb2xkZXJzOiBzdHJpbmdbXSxcblx0KSB7XG5cdFx0Y29uc3QgcnVsZUNhcmQgPSBydWxlR3JpZEVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLXJ1bGUtY2FyZFwiIH0pO1xuXHRcdGNvbnN0IHRvcFJvdyA9IHJ1bGVDYXJkLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLXJ1bGUtdG9wLXJvd1wiIH0pO1xuXHRcdHRvcFJvdy5jcmVhdGVTcGFuKHtcblx0XHRcdGNsczogXCJhdXRvLWZyb250bWF0dGVyLXJ1bGUtdGl0bGVcIixcblx0XHRcdHRleHQ6IGDop4TliJkgJHtydWxlSW5kZXggKyAxfWAsXG5cdFx0fSk7XG5cblx0XHRjb25zdCBkZWxldGVCdXR0b24gPSB0b3BSb3cuY3JlYXRlRWwoXCJidXR0b25cIiwge1xuXHRcdFx0Y2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItcnVsZS1kZWxldGVcIixcblx0XHRcdGF0dHI6IHsgXCJhcmlhLWxhYmVsXCI6IFwi5Yig6Zmk6KeE5YiZXCIgfSxcblx0XHR9KTtcblx0XHRzZXRJY29uKGRlbGV0ZUJ1dHRvbiwgXCJ0cmFzaC0yXCIpO1xuXHRcdGRlbGV0ZUJ1dHRvbi5vbmNsaWNrID0gYXN5bmMgKCkgPT4ge1xuXHRcdFx0aWYgKCF0aGlzLnBsdWdpbi5lbnN1cmVEZXZpY2VCb3VuZCgpKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLmZvbGRlckRlZmF1bHRzLnNwbGljZShydWxlSW5kZXgsIDEpO1xuXHRcdFx0YXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRjb25zdCBwYWdlQ291bnQgPSBNYXRoLm1heCgxLCBNYXRoLmNlaWwodGhpcy5wbHVnaW4uc2V0dGluZ3MuZm9sZGVyRGVmYXVsdHMubGVuZ3RoIC8gUlVMRVNfUEVSX1BBR0UpKTtcblx0XHRcdHRoaXMuY3VycmVudFJ1bGVQYWdlID0gY2xhbXAodGhpcy5jdXJyZW50UnVsZVBhZ2UsIDAsIHBhZ2VDb3VudCAtIDEpO1xuXHRcdFx0dGhpcy5kaXNwbGF5KCk7XG5cdFx0fTtcblxuXHRcdGNvbnN0IGZvbGRlclJvd0VsID0gcnVsZUNhcmQuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItcnVsZS1mb2xkZXItcm93XCIgfSk7XG5cdFx0Zm9sZGVyUm93RWwuY3JlYXRlU3Bhbih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLXJ1bGUtZm9sZGVyLWljb25cIiwgdGV4dDogXCLwn5OBXCIgfSk7XG5cdFx0dGhpcy5yZW5kZXJSdWxlSW5saW5lRm9sZGVyRWRpdG9yKGZvbGRlclJvd0VsLCBydWxlLCBmb2xkZXJzKTtcblxuXHRcdGNvbnN0IHZhbHVlUm93RWwgPSBydWxlQ2FyZC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1ydWxlLXZhbHVlLXJvd1wiIH0pO1xuXHRcdHRoaXMucmVuZGVyUnVsZUlubGluZUZpZWxkRWRpdG9yKHZhbHVlUm93RWwsIHJ1bGUpO1xuXHRcdHZhbHVlUm93RWwuY3JlYXRlU3Bhbih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLXJ1bGUtYXJyb3dcIiwgdGV4dDogXCLihpJcIiB9KTtcblx0XHR0aGlzLnJlbmRlclJ1bGVJbmxpbmVWYWx1ZUVkaXRvcih2YWx1ZVJvd0VsLCBydWxlKTtcblxuXHRcdGNvbnN0IGF1ZGl0RWwgPSBydWxlQ2FyZC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1ydWxlLWF1ZGl0XCIgfSk7XG5cdFx0aWYgKCFydWxlLmNyZWF0ZWRCeSB8fCAhcnVsZS5jcmVhdGVkQXQpIHtcblx0XHRcdGF1ZGl0RWwuc2V0VGV4dChcIuWIm+W7uuS/oeaBr+S4jeWPr+i/vea6r1wiKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0YXVkaXRFbC5jcmVhdGVEaXYoeyB0ZXh0OiBg55SxICR7cnVsZS5jcmVhdGVkQnl9YCB9KTtcblx0XHRcdGF1ZGl0RWwuY3JlYXRlRGl2KHsgdGV4dDogZm9ybWF0QXVkaXRUaW1lKHJ1bGUuY3JlYXRlZEF0KSB9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlclJ1bGVJbmxpbmVGb2xkZXJFZGl0b3IoXG5cdFx0Y29udGFpbmVyRWw6IEhUTUxFbGVtZW50LFxuXHRcdHJ1bGU6IEZvbGRlckRlZmF1bHRSdWxlLFxuXHRcdGZvbGRlcnM6IHN0cmluZ1tdLFxuXHQpIHtcblx0XHR0aGlzLmNyZWF0ZUlubGluZVJ1bGVWYXJpYWJsZShjb250YWluZXJFbCwgZm9ybWF0UnVsZUlubGluZVZhbHVlKHJ1bGUuZm9sZGVyKSwgKHNwYW5FbCkgPT4ge1xuXHRcdFx0dGhpcy5vcGVuSW5saW5lUnVsZVNlbGVjdEVkaXRvcihcblx0XHRcdFx0c3BhbkVsLFxuXHRcdFx0XHRydWxlLFxuXHRcdFx0XHRydWxlLmZvbGRlcixcblx0XHRcdFx0Zm9sZGVycy5tYXAoKGZvbGRlcikgPT4gKHtcblx0XHRcdFx0XHR2YWx1ZTogZm9sZGVyLFxuXHRcdFx0XHRcdGxhYmVsOiBmb3JtYXRGb2xkZXJPcHRpb25MYWJlbChmb2xkZXIpLFxuXHRcdFx0XHR9KSksXG5cdFx0XHRcdGFzeW5jICh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdHJ1bGUuZm9sZGVyID0gdmFsdWU7XG5cdFx0XHRcdH0sXG5cdFx0XHQpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJSdWxlSW5saW5lRmllbGRFZGl0b3IoY29udGFpbmVyRWw6IEhUTUxFbGVtZW50LCBydWxlOiBGb2xkZXJEZWZhdWx0UnVsZSkge1xuXHRcdHRoaXMuY3JlYXRlSW5saW5lUnVsZVZhcmlhYmxlKGNvbnRhaW5lckVsLCBmb3JtYXRSdWxlSW5saW5lVmFsdWUocnVsZS5maWVsZCksIChzcGFuRWwpID0+IHtcblx0XHRcdHRoaXMub3BlbklubGluZVJ1bGVTZWxlY3RFZGl0b3IoXG5cdFx0XHRcdHNwYW5FbCxcblx0XHRcdFx0cnVsZSxcblx0XHRcdFx0cnVsZS5maWVsZCxcblx0XHRcdFx0Rk9MREVSX0RFRkFVTFRfRklFTERTLm1hcCgoZmllbGQpID0+ICh7IHZhbHVlOiBmaWVsZCwgbGFiZWw6IGZpZWxkIH0pKSxcblx0XHRcdFx0YXN5bmMgKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0cnVsZS5maWVsZCA9IHZhbHVlIGFzIEZvbGRlckRlZmF1bHRGaWVsZDtcblx0XHRcdFx0XHRydWxlLnZhbHVlID0gXCJcIjtcblx0XHRcdFx0fSxcblx0XHRcdCk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlclJ1bGVJbmxpbmVWYWx1ZUVkaXRvcihjb250YWluZXJFbDogSFRNTEVsZW1lbnQsIHJ1bGU6IEZvbGRlckRlZmF1bHRSdWxlKSB7XG5cdFx0dGhpcy5jcmVhdGVJbmxpbmVSdWxlVmFyaWFibGUoY29udGFpbmVyRWwsIGZvcm1hdFJ1bGVJbmxpbmVWYWx1ZShydWxlLnZhbHVlKSwgKHNwYW5FbCkgPT4ge1xuXHRcdFx0Y29uc3QgY2FuZGlkYXRlcyA9IGdldEZyb250bWF0dGVyRmllbGRDYW5kaWRhdGVzKHRoaXMuYXBwLCBydWxlLmZpZWxkKTtcblx0XHRcdGNvbnN0IHZhbHVlcyA9XG5cdFx0XHRcdHJ1bGUudmFsdWUgJiYgIWNhbmRpZGF0ZXMuaW5jbHVkZXMocnVsZS52YWx1ZSkgPyBbLi4uY2FuZGlkYXRlcywgcnVsZS52YWx1ZV0gOiBjYW5kaWRhdGVzO1xuXHRcdFx0dGhpcy5vcGVuSW5saW5lUnVsZVNlbGVjdEVkaXRvcihcblx0XHRcdFx0c3BhbkVsLFxuXHRcdFx0XHRydWxlLFxuXHRcdFx0XHRydWxlLnZhbHVlLFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0Li4udmFsdWVzLm1hcCgodmFsdWUpID0+ICh7IHZhbHVlLCBsYWJlbDogdmFsdWUgfSkpLFxuXHRcdFx0XHRcdHsgdmFsdWU6IFwiX19uZXdfX1wiLCBsYWJlbDogXCLoh6rlrprkuYlcIiB9LFxuXHRcdFx0XHRdLFxuXHRcdFx0XHRhc3luYyAodmFsdWUpID0+IHtcblx0XHRcdFx0XHRpZiAodmFsdWUgPT09IFwiX19uZXdfX1wiKSB7XG5cdFx0XHRcdFx0XHR0aGlzLm9wZW5JbmxpbmVSdWxlSW5wdXRFZGl0b3Ioc3BhbkVsLCBydWxlLCBydWxlLnZhbHVlLCBhc3luYyAobmV4dFZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0XHRcdHJ1bGUudmFsdWUgPSBuZXh0VmFsdWU7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdHJldHVybiBcImRlZmVyXCI7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJ1bGUudmFsdWUgPSB2YWx1ZTtcblx0XHRcdFx0fSxcblx0XHRcdCk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZUlubGluZVJ1bGVWYXJpYWJsZShcblx0XHRjb250YWluZXJFbDogSFRNTEVsZW1lbnQsXG5cdFx0dGV4dDogc3RyaW5nLFxuXHRcdG9uQ2xpY2s6IChzcGFuRWw6IEhUTUxTcGFuRWxlbWVudCkgPT4gdm9pZCxcblx0KSB7XG5cdFx0Y29uc3Qgc3BhbkVsID0gY29udGFpbmVyRWwuY3JlYXRlRWwoXCJzcGFuXCIsIHtcblx0XHRcdGNsczogXCJhdXRvLWZyb250bWF0dGVyLXJ1bGUtaW5saW5lLXZhbHVlXCIsXG5cdFx0XHR0ZXh0LFxuXHRcdH0pO1xuXHRcdHNwYW5FbC50YWJJbmRleCA9IDA7XG5cdFx0c3BhbkVsLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZXZlbnQpID0+IHtcblx0XHRcdGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0b25DbGljayhzcGFuRWwpO1xuXHRcdH0pO1xuXHRcdHNwYW5FbC5hZGRFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCAoZXZlbnQpID0+IHtcblx0XHRcdGlmIChldmVudC5rZXkgPT09IFwiRW50ZXJcIiB8fCBldmVudC5rZXkgPT09IFwiIFwiKSB7XG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdG9uQ2xpY2soc3BhbkVsKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgb3BlbklubGluZVJ1bGVTZWxlY3RFZGl0b3IoXG5cdFx0Y29udGFpbmVyRWw6IEhUTUxFbGVtZW50LFxuXHRcdHJ1bGU6IEZvbGRlckRlZmF1bHRSdWxlLFxuXHRcdGN1cnJlbnRWYWx1ZTogc3RyaW5nLFxuXHRcdG9wdGlvbnM6IEFycmF5PHsgdmFsdWU6IHN0cmluZzsgbGFiZWw6IHN0cmluZyB9Pixcblx0XHRvbkNvbW1pdDogKHZhbHVlOiBzdHJpbmcpID0+IFByb21pc2U8dm9pZCB8IFwiZGVmZXJcIj4sXG5cdCkge1xuXHRcdHRoaXMuY2xvc2VBY3RpdmVJbmxpbmVFZGl0b3IoKTtcblx0XHRjb25zdCBvdmVybGF5RWwgPSBjb250YWluZXJFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1ydWxlLWlubGluZS1lZGl0b3JcIiB9KTtcblx0XHRjb25zdCBzZWxlY3RFbCA9IG92ZXJsYXlFbC5jcmVhdGVFbChcInNlbGVjdFwiLCB7XG5cdFx0XHRjbHM6IFwiZHJvcGRvd24gYXV0by1mcm9udG1hdHRlci1ydWxlLWlubGluZS1zZWxlY3RcIixcblx0XHR9KTtcblx0XHRmb3IgKGNvbnN0IG9wdGlvbiBvZiBvcHRpb25zKSB7XG5cdFx0XHRjb25zdCBvcHRpb25FbCA9IHNlbGVjdEVsLmNyZWF0ZUVsKFwib3B0aW9uXCIsIHtcblx0XHRcdFx0dmFsdWU6IG9wdGlvbi52YWx1ZSxcblx0XHRcdFx0dGV4dDogb3B0aW9uLmxhYmVsLFxuXHRcdFx0fSk7XG5cdFx0XHRpZiAob3B0aW9uLnZhbHVlID09PSBcIl9fbmV3X19cIikge1xuXHRcdFx0XHRvcHRpb25FbC5zZWxlY3RlZCA9IGN1cnJlbnRWYWx1ZS5sZW5ndGggPT09IDA7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmIChjdXJyZW50VmFsdWUgJiYgb3B0aW9ucy5zb21lKChvcHRpb24pID0+IG9wdGlvbi52YWx1ZSA9PT0gY3VycmVudFZhbHVlKSkge1xuXHRcdFx0c2VsZWN0RWwudmFsdWUgPSBjdXJyZW50VmFsdWU7XG5cdFx0fVxuXG5cdFx0Y29uc3QgY2xvc2VEcm9wZG93biA9IHRoaXMuY3JlYXRlSW5saW5lRHJvcGRvd25DbG9zZXIob3ZlcmxheUVsKTtcblxuXHRcdHNlbGVjdEVsLmFkZEV2ZW50TGlzdGVuZXIoXCJjaGFuZ2VcIiwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3Qgc2VsZWN0ZWRWYWx1ZSA9IHNlbGVjdEVsLnZhbHVlO1xuXHRcdFx0Y2xvc2VEcm9wZG93bigpO1xuXHRcdFx0aWYgKHNlbGVjdGVkVmFsdWUgPT09IFwiX19uZXdfX1wiKSB7XG5cdFx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IG9uQ29tbWl0KHNlbGVjdGVkVmFsdWUpO1xuXHRcdFx0XHRpZiAocmVzdWx0ICE9PSBcImRlZmVyXCIpIHtcblx0XHRcdFx0XHRjbG9zZURyb3Bkb3duKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0YXdhaXQgdGhpcy5zYXZlSW5saW5lUnVsZUNoYW5nZShydWxlLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGF3YWl0IG9uQ29tbWl0KHNlbGVjdGVkVmFsdWUpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdFx0c2VsZWN0RWwuYWRkRXZlbnRMaXN0ZW5lcihcImJsdXJcIiwgKCkgPT4ge1xuXHRcdFx0d2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHRjbG9zZURyb3Bkb3duKCk7XG5cdFx0XHR9LCAxMDApO1xuXHRcdH0pO1xuXG5cdFx0d2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0c2VsZWN0RWwuZm9jdXMoKTtcblx0XHRcdGNvbnN0IHBpY2tlckVsID0gc2VsZWN0RWwgYXMgSFRNTFNlbGVjdEVsZW1lbnQgJiB7IHNob3dQaWNrZXI/OiAoKSA9PiB2b2lkIH07XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRpZiAocGlja2VyRWwuc2hvd1BpY2tlcikge1xuXHRcdFx0XHRcdHBpY2tlckVsLnNob3dQaWNrZXIoKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRzZWxlY3RFbC5jbGljaygpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGNhdGNoIChfZXJyb3IpIHtcblx0XHRcdFx0c2VsZWN0RWwuY2xpY2soKTtcblx0XHRcdH1cblx0XHR9LCAwKTtcblx0fVxuXG5cdHByaXZhdGUgb3BlbklubGluZVJ1bGVJbnB1dEVkaXRvcihcblx0XHRjb250YWluZXJFbDogSFRNTEVsZW1lbnQsXG5cdFx0cnVsZTogRm9sZGVyRGVmYXVsdFJ1bGUsXG5cdFx0Y3VycmVudFZhbHVlOiBzdHJpbmcsXG5cdFx0b25Db21taXQ6ICh2YWx1ZTogc3RyaW5nKSA9PiBQcm9taXNlPHZvaWQ+LFxuXHQpIHtcblx0XHR0aGlzLmNsb3NlQWN0aXZlSW5saW5lRWRpdG9yKCk7XG5cdFx0Y29uc3Qgb3ZlcmxheUVsID0gY29udGFpbmVyRWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItcnVsZS1pbmxpbmUtZWRpdG9yXCIgfSk7XG5cdFx0Y29uc3QgaW5wdXRFbCA9IG92ZXJsYXlFbC5jcmVhdGVFbChcImlucHV0XCIsIHtcblx0XHRcdGNsczogXCJhdXRvLWZyb250bWF0dGVyLXJ1bGUtaW5saW5lLWlucHV0XCIsXG5cdFx0XHR0eXBlOiBcInRleHRcIixcblx0XHRcdHZhbHVlOiBjdXJyZW50VmFsdWUsXG5cdFx0fSk7XG5cblx0XHRjb25zdCBjbG9zZURyb3Bkb3duID0gdGhpcy5jcmVhdGVJbmxpbmVEcm9wZG93bkNsb3NlcihvdmVybGF5RWwpO1xuXHRcdGNvbnN0IGZpbmFsaXplID0gYXN5bmMgKCkgPT4ge1xuXHRcdFx0aWYgKGNsb3NlRHJvcGRvd24oKSkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLnNhdmVJbmxpbmVSdWxlQ2hhbmdlKHJ1bGUsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRhd2FpdCBvbkNvbW1pdChpbnB1dEVsLnZhbHVlKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGlucHV0RWwuYWRkRXZlbnRMaXN0ZW5lcihcImJsdXJcIiwgKCkgPT4ge1xuXHRcdFx0d2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHR2b2lkIGNsb3NlRHJvcGRvd24oKTtcblx0XHRcdH0sIDEwMCk7XG5cdFx0fSk7XG5cdFx0aW5wdXRFbC5hZGRFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCAoZXZlbnQpID0+IHtcblx0XHRcdGlmIChldmVudC5rZXkgPT09IFwiRW50ZXJcIikge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHR2b2lkIGZpbmFsaXplKCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoZXZlbnQua2V5ID09PSBcIkVzY2FwZVwiKSB7XG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdGNsb3NlRHJvcGRvd24oKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdGlucHV0RWwuZm9jdXMoKTtcblx0XHRcdGlucHV0RWwuc2VsZWN0KCk7XG5cdFx0fSwgMCk7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZUlubGluZURyb3Bkb3duQ2xvc2VyKG92ZXJsYXlFbDogSFRNTEVsZW1lbnQpIHtcblx0XHRsZXQgY2xvc2VkID0gZmFsc2U7XG5cdFx0Y29uc3QgY2xvc2VEcm9wZG93biA9ICgpID0+IHtcblx0XHRcdGlmIChjbG9zZWQpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0Y2xvc2VkID0gdHJ1ZTtcblx0XHRcdG92ZXJsYXlFbC5xdWVyeVNlbGVjdG9yQWxsKFwic2VsZWN0LCBpbnB1dFwiKS5mb3JFYWNoKChlbCkgPT4gZWwucmVtb3ZlKCkpO1xuXHRcdFx0aWYgKG92ZXJsYXlFbC5pc0Nvbm5lY3RlZCkge1xuXHRcdFx0XHRvdmVybGF5RWwucmVtb3ZlKCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAodGhpcy5hY3RpdmVJbmxpbmVFZGl0b3JDbGVhbnVwID09PSBjbG9zZURyb3Bkb3duKSB7XG5cdFx0XHRcdHRoaXMuYWN0aXZlSW5saW5lRWRpdG9yQ2xlYW51cCA9IG51bGw7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9O1xuXHRcdHRoaXMuYWN0aXZlSW5saW5lRWRpdG9yQ2xlYW51cCA9IGNsb3NlRHJvcGRvd247XG5cdFx0cmV0dXJuIGNsb3NlRHJvcGRvd247XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHNhdmVJbmxpbmVSdWxlQ2hhbmdlKHJ1bGU6IEZvbGRlckRlZmF1bHRSdWxlLCB1cGRhdGU6ICgpID0+IFByb21pc2U8dm9pZD4pIHtcblx0XHRpZiAoIXRoaXMucGx1Z2luLmVuc3VyZURldmljZUJvdW5kKCkpIHtcblx0XHRcdHRoaXMuZGlzcGxheSgpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRhd2FpdCB1cGRhdGUoKTtcblx0XHR0aGlzLnBsdWdpbi50b3VjaEZvbGRlclJ1bGUocnVsZSk7XG5cdFx0YXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0dGhpcy5kaXNwbGF5KCk7XG5cdH1cblxuXHRwcml2YXRlIGNsb3NlQWN0aXZlSW5saW5lRWRpdG9yKCkge1xuXHRcdHRoaXMuYWN0aXZlSW5saW5lRWRpdG9yQ2xlYW51cD8uKCk7XG5cdFx0dGhpcy5hY3RpdmVJbmxpbmVFZGl0b3JDbGVhbnVwID0gbnVsbDtcblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyVW5tYXRjaGVkRm9sZGVyU2VjdGlvbihjb250YWluZXJFbDogSFRNTEVsZW1lbnQpIHtcblx0XHRjb25zdCBzZWN0aW9uRWwgPSBjb250YWluZXJFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci11bm1hdGNoZWQtc2VjdGlvblwiIH0pO1xuXHRcdGNvbnN0IGhlYWRlckVsID0gc2VjdGlvbkVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLXVubWF0Y2hlZC1oZWFkZXJcIiB9KTtcblx0XHRoZWFkZXJFbC5jcmVhdGVFbChcImgzXCIsIHsgdGV4dDogXCLml6DljLnphY3op4TliJnnmoTmlofku7blpLlcIiB9KTtcblx0XHRjb25zdCBhY3Rpb25FbCA9IGhlYWRlckVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLXVubWF0Y2hlZC1hY3Rpb25cIiB9KTtcblx0XHRuZXcgU2V0dGluZyhhY3Rpb25FbCkuYWRkQnV0dG9uKChidXR0b24pID0+IHtcblx0XHRcdGJ1dHRvblxuXHRcdFx0XHQuc2V0QnV0dG9uVGV4dCh0aGlzLmlzU2Nhbm5pbmdVbm1hdGNoZWRGb2xkZXJzID8gXCLmiavmj4/kuK0uLi5cIiA6IFwi5omr5o+PXCIpXG5cdFx0XHRcdC5zZXREaXNhYmxlZCh0aGlzLmlzU2Nhbm5pbmdVbm1hdGNoZWRGb2xkZXJzKVxuXHRcdFx0XHQub25DbGljayhhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5zY2FuVW5tYXRjaGVkRm9sZGVycygpO1xuXHRcdFx0XHR9KTtcblx0XHR9KTtcblx0XHRzZWN0aW9uRWwuY3JlYXRlRWwoXCJwXCIsIHtcblx0XHRcdGNsczogXCJhdXRvLWZyb250bWF0dGVyLXVubWF0Y2hlZC1zdWJ0aXRsZVwiLFxuXHRcdFx0dGV4dDogXCLku6XkuIvmlofku7blpLnlsJrmnKrorr7nva7ku7vkvZXlsZ7mgKfljLnphY3op4TliJnjgIJcIixcblx0XHR9KTtcblxuXHRcdGNvbnN0IHJlc3VsdEVsID0gc2VjdGlvbkVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLXVubWF0Y2hlZC1yZXN1bHRzXCIgfSk7XG5cdFx0aWYgKCF0aGlzLmhhc1NjYW5uZWRVbm1hdGNoZWRGb2xkZXJzKSB7XG5cdFx0XHRyZXN1bHRFbC5jcmVhdGVEaXYoe1xuXHRcdFx0XHRjbHM6IFwiYXV0by1mcm9udG1hdHRlci11bm1hdGNoZWQtZW1wdHlcIixcblx0XHRcdFx0dGV4dDogXCLngrnlh7vmiavmj4/mn6XnnIvmnKrphY3nva7nmoTmlofku7blpLnjgIJcIixcblx0XHRcdH0pO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLnVubWF0Y2hlZEZvbGRlcnMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXN1bHRFbC5jcmVhdGVEaXYoe1xuXHRcdFx0XHRjbHM6IFwiYXV0by1mcm9udG1hdHRlci11bm1hdGNoZWQtZW1wdHlcIixcblx0XHRcdFx0dGV4dDogXCLmiYDmnInmlofku7blpLnlnYflt7LphY3nva7op4TliJnjgIJcIixcblx0XHRcdH0pO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGxpc3RFbCA9IHJlc3VsdEVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLXVubWF0Y2hlZC1saXN0XCIgfSk7XG5cdFx0Zm9yIChjb25zdCBmb2xkZXIgb2YgdGhpcy51bm1hdGNoZWRGb2xkZXJzKSB7XG5cdFx0XHRjb25zdCBpdGVtRWwgPSBsaXN0RWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItdW5tYXRjaGVkLWl0ZW1cIiB9KTtcblx0XHRcdGNvbnN0IGNvbnRlbnRFbCA9IGl0ZW1FbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci11bm1hdGNoZWQtY29udGVudFwiIH0pO1xuXHRcdFx0Y29udGVudEVsLmNyZWF0ZURpdih7XG5cdFx0XHRcdGNsczogXCJhdXRvLWZyb250bWF0dGVyLXVubWF0Y2hlZC1wYXRoXCIsXG5cdFx0XHRcdHRleHQ6IGZvbGRlci5wYXRoLFxuXHRcdFx0fSk7XG5cdFx0XHRjb250ZW50RWwuY3JlYXRlRGl2KHtcblx0XHRcdFx0Y2xzOiBmb2xkZXIuaW5oZXJpdGVkUnVsZXMubGVuZ3RoXG5cdFx0XHRcdFx0PyBcImF1dG8tZnJvbnRtYXR0ZXItdW5tYXRjaGVkLWhpbnQgaXMtaW5oZXJpdGVkXCJcblx0XHRcdFx0XHQ6IFwiYXV0by1mcm9udG1hdHRlci11bm1hdGNoZWQtaGludCBpcy1lbXB0eVwiLFxuXHRcdFx0XHR0ZXh0OlxuXHRcdFx0XHRcdGZvbGRlci5pbmhlcml0ZWRSdWxlcy5sZW5ndGggPiAwXG5cdFx0XHRcdFx0XHQ/IGDihpEg54i257qn6KeE5YiZ77yaJHtmb2xkZXIuaW5oZXJpdGVkUnVsZXNcblx0XHRcdFx0XHRcdFx0XHQubWFwKChydWxlKSA9PiBgJHtydWxlLmZvbGRlcn0g4oaSICR7cnVsZS5maWVsZH06ICR7cnVsZS52YWx1ZX1gKVxuXHRcdFx0XHRcdFx0XHRcdC5qb2luKFwi77yMXCIpfWBcblx0XHRcdFx0XHRcdDogXCLml6Dku7vkvZXniLbnuqfop4TliJlcIixcblx0XHRcdH0pO1xuXG5cdFx0XHRjb25zdCBidXR0b25FbCA9IGl0ZW1FbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci11bm1hdGNoZWQtYnV0dG9uXCIgfSk7XG5cdFx0XHRuZXcgU2V0dGluZyhidXR0b25FbCkuYWRkQnV0dG9uKChidXR0b24pID0+IHtcblx0XHRcdFx0YnV0dG9uLnNldEJ1dHRvblRleHQoXCLorr7nva5cIikub25DbGljaygoKSA9PiB7XG5cdFx0XHRcdFx0bmV3IEZvbGRlclJ1bGVNb2RhbCh0aGlzLmFwcCwgdGhpcy5wbHVnaW4sIGZvbGRlci5wYXRoKS5vcGVuKCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJTY2FuU2VjdGlvbihjb250YWluZXJFbDogSFRNTEVsZW1lbnQpIHtcblx0XHRjb250YWluZXJFbC5jcmVhdGVFbChcImgyXCIsIHsgdGV4dDogXCLmiavmj4/ku5PlupNcIiB9KTtcblxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LnNldE5hbWUoXCLmiavmj4/ku5PlupNcIilcblx0XHRcdC5zZXREZXNjKFwi5om+5Ye66ZyA6KaB6KGl5YWo5bGe5oCn55qEIE1hcmtkb3duIOaWh+S7tuOAglwiKVxuXHRcdFx0LmFkZEJ1dHRvbigoYnV0dG9uKSA9PiB7XG5cdFx0XHRcdGJ1dHRvblxuXHRcdFx0XHRcdC5zZXRCdXR0b25UZXh0KHRoaXMuaXNTY2FubmluZyA/IFwi5omr5o+P5LitLi4uXCIgOiBcIuaJq+aPj1wiKVxuXHRcdFx0XHRcdC5zZXREaXNhYmxlZCh0aGlzLmlzU2Nhbm5pbmcgfHwgdGhpcy5pc0V4ZWN1dGluZylcblx0XHRcdFx0XHQub25DbGljayhhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0XHRpZiAoIXRoaXMucGx1Z2luLmVuc3VyZURldmljZUJvdW5kKCkpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5zY2FuVmF1bHQoKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXG5cdFx0aWYgKCF0aGlzLmhhc1NjYW5uZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCByZXN1bHRFbCA9IGNvbnRhaW5lckVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLXNjYW4tcmVzdWx0c1wiIH0pO1xuXHRcdGlmICh0aGlzLnNjYW5SZXN1bHRzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmVzdWx0RWwuY3JlYXRlRGl2KHtcblx0XHRcdFx0Y2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItc2Nhbi1lbXB0eVwiLFxuXHRcdFx0XHR0ZXh0OiBcIuaJgOacieaWh+S7tuWdh+W3suWMheWQq+WxnuaApyDinJNcIixcblx0XHRcdH0pO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHJlc3VsdEVsLmNyZWF0ZURpdih7XG5cdFx0XHRjbHM6IFwiYXV0by1mcm9udG1hdHRlci1zY2FuLWNvdW50XCIsXG5cdFx0XHR0ZXh0OiBg5YWx5Y+R546wICR7dGhpcy5zY2FuUmVzdWx0cy5sZW5ndGh9IOS4quaWh+S7tumcgOimgeihpeWFqOWxnuaAp2AsXG5cdFx0fSk7XG5cblx0XHRjb25zdCBsaXN0RWwgPSByZXN1bHRFbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1zY2FuLWxpc3RcIiB9KTtcblx0XHRmb3IgKGNvbnN0IHJlc3VsdCBvZiB0aGlzLnNjYW5SZXN1bHRzKSB7XG5cdFx0XHRjb25zdCBpdGVtRWwgPSBsaXN0RWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItc2Nhbi1pdGVtXCIgfSk7XG5cdFx0XHRjb25zdCB0aXRsZSA9IHJlc3VsdC5kb25lID8gYCR7cmVzdWx0LmZpbGUubmFtZX0g4pyTYCA6IHJlc3VsdC5maWxlLm5hbWU7XG5cdFx0XHRjb25zdCB0aXRsZUVsID0gaXRlbUVsLmNyZWF0ZURpdih7IGNsczogXCJhdXRvLWZyb250bWF0dGVyLXNjYW4tbmFtZVwiLCB0ZXh0OiB0aXRsZSB9KTtcblx0XHRcdHRpdGxlRWwuY3JlYXRlU3Bhbih7XG5cdFx0XHRcdGNsczogXCJhdXRvLWZyb250bWF0dGVyLXNjYW4tbWlzc2luZ1wiLFxuXHRcdFx0XHR0ZXh0OiBgICR7Zm9ybWF0U2NhblJlYXNvbihyZXN1bHQpfWAsXG5cdFx0XHR9KTtcblx0XHRcdGl0ZW1FbC5jcmVhdGVEaXYoeyBjbHM6IFwiYXV0by1mcm9udG1hdHRlci1zY2FuLXBhdGhcIiwgdGV4dDogcmVzdWx0LmZpbGUucGF0aCB9KTtcblx0XHR9XG5cblx0XHRjb25zdCBzdGF0dXNUZXh0ID1cblx0XHRcdHRoaXMucHJvY2Vzc2VkQ291bnQgPT09IHRoaXMuc2NhblJlc3VsdHMubGVuZ3RoICYmICF0aGlzLmlzRXhlY3V0aW5nXG5cdFx0XHRcdD8gYOWujOaIkO+8jOW3suWkhOeQhiAke3RoaXMucHJvY2Vzc2VkQ291bnR9IOS4quaWh+S7tmBcblx0XHRcdFx0OiBcIlwiO1xuXG5cdFx0bmV3IFNldHRpbmcocmVzdWx0RWwpXG5cdFx0XHQuc2V0RGVzYyhzdGF0dXNUZXh0KVxuXHRcdFx0LmFkZEJ1dHRvbigoYnV0dG9uKSA9PiB7XG5cdFx0XHRcdGJ1dHRvblxuXHRcdFx0XHRcdC5zZXRCdXR0b25UZXh0KHRoaXMuaXNFeGVjdXRpbmcgPyBcIuaJp+ihjOS4rS4uLlwiIDogXCLmiafooYxcIilcblx0XHRcdFx0XHQuc2V0Q3RhKClcblx0XHRcdFx0XHQuc2V0RGlzYWJsZWQodGhpcy5pc0V4ZWN1dGluZylcblx0XHRcdFx0XHQub25DbGljayhhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0XHRpZiAoIXRoaXMucGx1Z2luLmVuc3VyZURldmljZUJvdW5kKCkpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5leGVjdXRlU2NhblJlc3VsdHMoKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBzY2FuVmF1bHQoKSB7XG5cdFx0dGhpcy5pc1NjYW5uaW5nID0gdHJ1ZTtcblx0XHR0aGlzLmhhc1NjYW5uZWQgPSB0cnVlO1xuXHRcdHRoaXMuc2NhblJlc3VsdHMgPSBbXTtcblx0XHR0aGlzLnByb2Nlc3NlZENvdW50ID0gMDtcblx0XHR0aGlzLmRpc3BsYXkoKTtcblxuXHRcdGNvbnN0IHJlc3VsdHM6IFNjYW5SZXN1bHRbXSA9IFtdO1xuXHRcdGNvbnN0IGZpbGVzID0gdGhpcy5hcHAudmF1bHQuZ2V0TWFya2Rvd25GaWxlcygpO1xuXG5cdFx0Zm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IGZpbGVzLmxlbmd0aDsgaW5kZXgrKykge1xuXHRcdFx0Y29uc3QgZmlsZSA9IGZpbGVzW2luZGV4XTtcblx0XHRcdGNvbnN0IGNvbnRlbnQgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5jYWNoZWRSZWFkKGZpbGUpO1xuXHRcdFx0Y29uc3QgZGVmYXVsdHMgPSB0aGlzLnBsdWdpbi5nZXRGb2xkZXJEZWZhdWx0VmFsdWVzKGZpbGUpO1xuXHRcdFx0Y29uc3Qgc3RhdHVzID0gZ2V0RnJvbnRtYXR0ZXJTdGF0dXMoY29udGVudCwgZGVmYXVsdHMpO1xuXHRcdFx0aWYgKFxuXHRcdFx0XHRzdGF0dXMubWlzc2luZ0ZpZWxkcy5sZW5ndGggPiAwIHx8XG5cdFx0XHRcdHN0YXR1cy5vcmRlck5lZWRzRml4IHx8XG5cdFx0XHRcdHN0YXR1cy5yZW5hbWVGaWVsZHMubGVuZ3RoID4gMCB8fFxuXHRcdFx0XHRzdGF0dXMuZGVmYXVsdEZpZWxkcy5sZW5ndGggPiAwXG5cdFx0XHQpIHtcblx0XHRcdFx0cmVzdWx0cy5wdXNoKHtcblx0XHRcdFx0XHRmaWxlLFxuXHRcdFx0XHRcdG1pc3NpbmdGaWVsZHM6IHN0YXR1cy5taXNzaW5nRmllbGRzLFxuXHRcdFx0XHRcdG9yZGVyTmVlZHNGaXg6IHN0YXR1cy5vcmRlck5lZWRzRml4LFxuXHRcdFx0XHRcdHJlbmFtZUZpZWxkczogc3RhdHVzLnJlbmFtZUZpZWxkcyxcblx0XHRcdFx0XHRkZWZhdWx0RmllbGRzOiBzdGF0dXMuZGVmYXVsdEZpZWxkcyxcblx0XHRcdFx0XHRkb25lOiBmYWxzZSxcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChpbmRleCAlIDI1ID09PSAyNCkge1xuXHRcdFx0XHRhd2FpdCB5aWVsZFRvVWkoKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLnNjYW5SZXN1bHRzID0gcmVzdWx0cztcblx0XHR0aGlzLmlzU2Nhbm5pbmcgPSBmYWxzZTtcblx0XHR0aGlzLmRpc3BsYXkoKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgc2NhblVubWF0Y2hlZEZvbGRlcnMoKSB7XG5cdFx0dGhpcy5oYXNTY2FubmVkVW5tYXRjaGVkRm9sZGVycyA9IHRydWU7XG5cdFx0dGhpcy5pc1NjYW5uaW5nVW5tYXRjaGVkRm9sZGVycyA9IHRydWU7XG5cdFx0dGhpcy51bm1hdGNoZWRGb2xkZXJzID0gW107XG5cdFx0dGhpcy5kaXNwbGF5KCk7XG5cblx0XHRjb25zdCBmb2xkZXJzID0gZ2V0VmF1bHRGb2xkZXJzKHRoaXMuYXBwKS5maWx0ZXIoKGZvbGRlcikgPT4gc2hvdWxkSW5jbHVkZVJ1bGVGb2xkZXIoZm9sZGVyKSk7XG5cdFx0Y29uc3QgZGlyZWN0UnVsZUZvbGRlcnMgPSBuZXcgU2V0KFxuXHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MuZm9sZGVyRGVmYXVsdHNcblx0XHRcdFx0Lm1hcCgocnVsZSkgPT4gcnVsZS5mb2xkZXIpXG5cdFx0XHRcdC5maWx0ZXIoKGZvbGRlcikgPT4gc2hvdWxkSW5jbHVkZVJ1bGVGb2xkZXIoZm9sZGVyKSksXG5cdFx0KTtcblxuXHRcdHRoaXMudW5tYXRjaGVkRm9sZGVycyA9IGZvbGRlcnNcblx0XHRcdC5maWx0ZXIoKGZvbGRlcikgPT4gIWRpcmVjdFJ1bGVGb2xkZXJzLmhhcyhmb2xkZXIpKVxuXHRcdFx0Lm1hcCgoZm9sZGVyKSA9PiAoe1xuXHRcdFx0XHRwYXRoOiBmb2xkZXIsXG5cdFx0XHRcdGluaGVyaXRlZFJ1bGVzOiBnZXRBbmNlc3RvclJ1bGVzKGZvbGRlciwgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZm9sZGVyRGVmYXVsdHMpLFxuXHRcdFx0fSkpXG5cdFx0XHQuc29ydCgoYSwgYikgPT4gYS5wYXRoLmxvY2FsZUNvbXBhcmUoYi5wYXRoKSk7XG5cblx0XHR0aGlzLmlzU2Nhbm5pbmdVbm1hdGNoZWRGb2xkZXJzID0gZmFsc2U7XG5cdFx0dGhpcy5kaXNwbGF5KCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGV4ZWN1dGVTY2FuUmVzdWx0cygpIHtcblx0XHR0aGlzLmlzRXhlY3V0aW5nID0gdHJ1ZTtcblx0XHR0aGlzLnByb2Nlc3NlZENvdW50ID0gMDtcblx0XHR0aGlzLmRpc3BsYXkoKTtcblxuXHRcdGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCB0aGlzLnNjYW5SZXN1bHRzLmxlbmd0aDsgaW5kZXgrKykge1xuXHRcdFx0Y29uc3QgcmVzdWx0ID0gdGhpcy5zY2FuUmVzdWx0c1tpbmRleF07XG5cdFx0XHRjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZChyZXN1bHQuZmlsZSk7XG5cdFx0XHRjb25zdCBkZWZhdWx0cyA9IHRoaXMucGx1Z2luLmdldEZvbGRlckRlZmF1bHRWYWx1ZXMocmVzdWx0LmZpbGUpO1xuXHRcdFx0Y29uc3Qgc3RhdHVzID0gZ2V0RnJvbnRtYXR0ZXJTdGF0dXMoY29udGVudCwgZGVmYXVsdHMpO1xuXHRcdFx0Y29uc3QgbmV4dCA9IGJ1aWxkQ29udGVudFdpdGhPcmRlcmVkRmllbGRzKFxuXHRcdFx0XHRjb250ZW50LFxuXHRcdFx0XHRyZXN1bHQuZmlsZSxcblx0XHRcdFx0c3RhdHVzLFxuXHRcdFx0XHRcIlwiLFxuXHRcdFx0XHRkZWZhdWx0cyxcblx0XHRcdFx0dGhpcy5wbHVnaW4uYnVpbGRGcm9udG1hdHRlci5iaW5kKHRoaXMucGx1Z2luKSxcblx0XHRcdCk7XG5cdFx0XHRpZiAobmV4dCAhPT0gbnVsbCkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLmFwcC52YXVsdC5tb2RpZnkocmVzdWx0LmZpbGUsIG5leHQpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXN1bHQubWlzc2luZ0ZpZWxkcyA9IHN0YXR1cy5taXNzaW5nRmllbGRzO1xuXHRcdFx0cmVzdWx0Lm9yZGVyTmVlZHNGaXggPSBzdGF0dXMub3JkZXJOZWVkc0ZpeDtcblx0XHRcdHJlc3VsdC5yZW5hbWVGaWVsZHMgPSBzdGF0dXMucmVuYW1lRmllbGRzO1xuXHRcdFx0cmVzdWx0LmRlZmF1bHRGaWVsZHMgPSBzdGF0dXMuZGVmYXVsdEZpZWxkcztcblx0XHRcdHJlc3VsdC5kb25lID0gdHJ1ZTtcblx0XHRcdHRoaXMucHJvY2Vzc2VkQ291bnQrKztcblxuXHRcdFx0aWYgKGluZGV4ICUgMTAgPT09IDkgfHwgaW5kZXggPT09IHRoaXMuc2NhblJlc3VsdHMubGVuZ3RoIC0gMSkge1xuXHRcdFx0XHR0aGlzLmRpc3BsYXkoKTtcblx0XHRcdFx0YXdhaXQgeWllbGRUb1VpKCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5pc0V4ZWN1dGluZyA9IGZhbHNlO1xuXHRcdHRoaXMuZGlzcGxheSgpO1xuXHR9XG59XG5cbmludGVyZmFjZSBTY2FuUmVzdWx0IHtcblx0ZmlsZTogVEZpbGU7XG5cdG1pc3NpbmdGaWVsZHM6IFJlcXVpcmVkRmllbGRbXTtcblx0b3JkZXJOZWVkc0ZpeDogYm9vbGVhbjtcblx0cmVuYW1lRmllbGRzOiBMZWdhY3lSZW5hbWVbXTtcblx0ZGVmYXVsdEZpZWxkczogRm9sZGVyRGVmYXVsdEZpZWxkW107XG5cdGRvbmU6IGJvb2xlYW47XG59XG5cbmludGVyZmFjZSBVbm1hdGNoZWRGb2xkZXJSZXN1bHQge1xuXHRwYXRoOiBzdHJpbmc7XG5cdGluaGVyaXRlZFJ1bGVzOiBGb2xkZXJEZWZhdWx0UnVsZVtdO1xufVxuXG5pbnRlcmZhY2UgQUlTdW1tYXJ5Q2FuZGlkYXRlIHtcblx0ZmlsZTogVEZpbGU7XG5cdGNvbnRlbnQ6IHN0cmluZztcblx0ZG9jdW1lbnQ6IFN1bW1hcnlEb2N1bWVudDtcblx0ZG9uZT86IGJvb2xlYW47XG59XG5cbmludGVyZmFjZSBBSVN1bW1hcnlUYXNrVWlTdGF0ZSB7XG5cdHJlc3VsdHM6IEFJU3VtbWFyeUNhbmRpZGF0ZVtdO1xuXHRoYXNTY2FubmVkOiBib29sZWFuO1xuXHRpc1NjYW5uaW5nOiBib29sZWFuO1xuXHRpc0V4ZWN1dGluZzogYm9vbGVhbjtcblx0cHJvY2Vzc2VkQ291bnQ6IG51bWJlcjtcbn1cblxuaW50ZXJmYWNlIENoYXRDb21wbGV0aW9uUmVzcG9uc2Uge1xuXHRlcnJvcj86IHtcblx0XHRtZXNzYWdlPzogc3RyaW5nO1xuXHR9O1xuXHRjaG9pY2VzPzogQXJyYXk8e1xuXHRcdFx0bWVzc2FnZT86IHtcblx0XHRcdFx0Y29udGVudD86IHN0cmluZztcblx0XHRcdFx0cmVhc29uaW5nX2NvbnRlbnQ/OiBzdHJpbmc7XG5cdFx0XHRcdHJlYXNvbmluZz86IHN0cmluZztcblx0XHRcdH07XG5cdFx0fT47XG5cdH1cblxuaW50ZXJmYWNlIEZyb250bWF0dGVyU3RhdHVzIHtcblx0bWlzc2luZ0ZpZWxkczogUmVxdWlyZWRGaWVsZFtdO1xuXHRvcmRlck5lZWRzRml4OiBib29sZWFuO1xuXHRyZW5hbWVGaWVsZHM6IExlZ2FjeVJlbmFtZVtdO1xuXHRkZWZhdWx0RmllbGRzOiBGb2xkZXJEZWZhdWx0RmllbGRbXTtcbn1cblxuaW50ZXJmYWNlIEZyb250bWF0dGVyQmxvY2sge1xuXHRrZXk6IHN0cmluZyB8IG51bGw7XG5cdGxpbmVzOiBzdHJpbmdbXTtcbn1cblxuaW50ZXJmYWNlIExlZ2FjeVJlbmFtZSB7XG5cdGZyb206IExlZ2FjeUZpZWxkO1xuXHR0bzogUmVxdWlyZWRGaWVsZDtcbn1cblxuZnVuY3Rpb24gaGFzRnJvbnRtYXR0ZXIoY29udGVudDogc3RyaW5nKTogYm9vbGVhbiB7XG5cdHJldHVybiBjb250ZW50LnN0YXJ0c1dpdGgoXCItLS1cIik7XG59XG5cbmZ1bmN0aW9uIGdldEZyb250bWF0dGVyU3RhdHVzKGNvbnRlbnQ6IHN0cmluZywgZGVmYXVsdHM6IEZvbGRlckRlZmF1bHRWYWx1ZXMgPSB7fSk6IEZyb250bWF0dGVyU3RhdHVzIHtcblx0Y29uc3QgZnJvbnRtYXR0ZXIgPSBwYXJzZUZyb250bWF0dGVyKGNvbnRlbnQpO1xuXHRpZiAoZnJvbnRtYXR0ZXIgPT09IG51bGwpIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0bWlzc2luZ0ZpZWxkczogWy4uLlJFUVVJUkVEX0ZJRUxEU10sXG5cdFx0XHRvcmRlck5lZWRzRml4OiBmYWxzZSxcblx0XHRcdHJlbmFtZUZpZWxkczogW10sXG5cdFx0XHRkZWZhdWx0RmllbGRzOiBbXSxcblx0XHR9O1xuXHR9XG5cblx0Y29uc3QgYmxvY2tzID0gcGFyc2VGcm9udG1hdHRlckJsb2Nrcyhmcm9udG1hdHRlci5ib2R5KTtcblx0Y29uc3QgcmVuYW1lRmllbGRzID0gZ2V0TGVnYWN5UmVuYW1lcyhibG9ja3MpO1xuXHRjb25zdCBtaWdyYXRlZEJsb2NrcyA9IG1pZ3JhdGVMZWdhY3lCbG9ja3MoYmxvY2tzKTtcblx0Y29uc3QgbWlzc2luZ0ZpZWxkcyA9IFJFUVVJUkVEX0ZJRUxEUy5maWx0ZXIoKGZpZWxkKSA9PiAhaGFzRnJvbnRtYXR0ZXJCbG9jayhtaWdyYXRlZEJsb2NrcywgZmllbGQpKTtcblx0Y29uc3QgZGVmYXVsdEZpZWxkcyA9IEZPTERFUl9ERUZBVUxUX0ZJRUxEUy5maWx0ZXIoKGZpZWxkKSA9PiB7XG5cdFx0cmV0dXJuIGRlZmF1bHRzW2ZpZWxkXSAhPT0gdW5kZWZpbmVkICYmIGZyb250bWF0dGVyRmllbGRJc0VtcHR5KG1pZ3JhdGVkQmxvY2tzLCBmaWVsZCk7XG5cdH0pO1xuXHRyZXR1cm4ge1xuXHRcdG1pc3NpbmdGaWVsZHMsXG5cdFx0b3JkZXJOZWVkc0ZpeDogIXJlcXVpcmVkRmllbGRzQXJlSW5SZWxhdGl2ZU9yZGVyKG1pZ3JhdGVkQmxvY2tzKSxcblx0XHRyZW5hbWVGaWVsZHMsXG5cdFx0ZGVmYXVsdEZpZWxkcyxcblx0fTtcbn1cblxuZnVuY3Rpb24gYnVpbGRDb250ZW50V2l0aE9yZGVyZWRGaWVsZHMoXG5cdGNvbnRlbnQ6IHN0cmluZyxcblx0ZmlsZTogVEZpbGUsXG5cdHN0YXR1czogRnJvbnRtYXR0ZXJTdGF0dXMsXG5cdGF1dGhvck5hbWU6IHN0cmluZyxcblx0ZGVmYXVsdHM6IEZvbGRlckRlZmF1bHRWYWx1ZXMsXG5cdGJ1aWxkRnVsbEZyb250bWF0dGVyOiAoY3JlYXRlZDogc3RyaW5nLCBkZWZhdWx0cz86IEZvbGRlckRlZmF1bHRWYWx1ZXMpID0+IHN0cmluZyxcbik6IHN0cmluZyB8IG51bGwge1xuXHRpZiAoXG5cdFx0c3RhdHVzLm1pc3NpbmdGaWVsZHMubGVuZ3RoID09PSAwICYmXG5cdFx0IXN0YXR1cy5vcmRlck5lZWRzRml4ICYmXG5cdFx0c3RhdHVzLnJlbmFtZUZpZWxkcy5sZW5ndGggPT09IDAgJiZcblx0XHRzdGF0dXMuZGVmYXVsdEZpZWxkcy5sZW5ndGggPT09IDBcblx0KSB7XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRjb25zdCBjcmVhdGVkID0gZm9ybWF0TG9jYWxEYXRlKG5ldyBEYXRlKGZpbGUuc3RhdC5jdGltZSkpO1xuXHRjb25zdCBmcm9udG1hdHRlciA9IHBhcnNlRnJvbnRtYXR0ZXIoY29udGVudCk7XG5cdGlmIChmcm9udG1hdHRlciA9PT0gbnVsbCkge1xuXHRcdHJldHVybiBidWlsZEZ1bGxGcm9udG1hdHRlcihjcmVhdGVkLCBkZWZhdWx0cykgKyBjb250ZW50O1xuXHR9XG5cblx0Y29uc3QgbWlncmF0ZWRCb2R5ID0gbWlncmF0ZUxlZ2FjeUZyb250bWF0dGVyQm9keShmcm9udG1hdHRlci5ib2R5KTtcblx0Y29uc3QgYm9keSA9IHN0YXR1cy5vcmRlck5lZWRzRml4XG5cdFx0PyBidWlsZFJlb3JkZXJlZEZyb250bWF0dGVyQm9keShtaWdyYXRlZEJvZHksIGNyZWF0ZWQsIGF1dGhvck5hbWUsIGRlZmF1bHRzKVxuXHRcdDogYnVpbGRGcm9udG1hdHRlckJvZHlXaXRoTWlzc2luZ0ZpZWxkcyhcblx0XHRcdFx0bWlncmF0ZWRCb2R5LFxuXHRcdFx0XHRzdGF0dXMubWlzc2luZ0ZpZWxkcyxcblx0XHRcdFx0c3RhdHVzLmRlZmF1bHRGaWVsZHMsXG5cdFx0XHRcdGNyZWF0ZWQsXG5cdFx0XHRcdGF1dGhvck5hbWUsXG5cdFx0XHRcdGRlZmF1bHRzLFxuXHRcdFx0KTtcblx0Y29uc3Qgc3VmZml4ID0gY29udGVudC5zbGljZShmcm9udG1hdHRlci5lbmQpO1xuXHRjb25zdCBzZXBhcmF0b3IgPSBzdWZmaXguc3RhcnRzV2l0aChcIlxcblwiKSA/IFwiXCIgOiBcIlxcblwiO1xuXHRyZXR1cm4gYC0tLVxcbiR7Ym9keX0ke3NlcGFyYXRvcn0ke3N1ZmZpeH1gO1xufVxuXG5mdW5jdGlvbiBidWlsZEZyb250bWF0dGVyQm9keVdpdGhNaXNzaW5nRmllbGRzKFxuXHRmcm9udG1hdHRlckJvZHk6IHN0cmluZyxcblx0bWlzc2luZ0ZpZWxkczogUmVxdWlyZWRGaWVsZFtdLFxuXHRkZWZhdWx0RmllbGRzOiBGb2xkZXJEZWZhdWx0RmllbGRbXSxcblx0ZmlsZUNyZWF0ZWQ6IHN0cmluZyxcblx0YXV0aG9yTmFtZTogc3RyaW5nLFxuXHRkZWZhdWx0czogRm9sZGVyRGVmYXVsdFZhbHVlcyxcbik6IHN0cmluZyB7XG5cdGNvbnN0IGJsb2NrcyA9IHBhcnNlRnJvbnRtYXR0ZXJCbG9ja3MoZnJvbnRtYXR0ZXJCb2R5KTtcblx0Y29uc3QgbGluZXM6IHN0cmluZ1tdID0gW107XG5cdGNvbnN0IGluc2VydGVkID0gbmV3IFNldDxSZXF1aXJlZEZpZWxkPigpO1xuXHRjb25zdCBjcmVhdGVkRm9yVXBkYXRlZCA9IGdldEV4aXN0aW5nQ3JlYXRlZFZhbHVlKGJsb2NrcykgPz8gZmlsZUNyZWF0ZWQ7XG5cblx0Zm9yIChjb25zdCBibG9jayBvZiBibG9ja3MpIHtcblx0XHRpZiAoaXNSZXF1aXJlZEZpZWxkKGJsb2NrLmtleSkpIHtcblx0XHRcdGZvciAoY29uc3QgZmllbGQgb2YgbWlzc2luZ0ZpZWxkcykge1xuXHRcdFx0XHRpZiAoIWluc2VydGVkLmhhcyhmaWVsZCkgJiYgZ2V0UmVxdWlyZWRGaWVsZEluZGV4KGZpZWxkKSA8IGdldFJlcXVpcmVkRmllbGRJbmRleChibG9jay5rZXkpKSB7XG5cdFx0XHRcdFx0Y29uc3QgY3JlYXRlZCA9IGZpZWxkID09PSBcIuacgOWQjuabtOaWsFwiID8gY3JlYXRlZEZvclVwZGF0ZWQgOiBmaWxlQ3JlYXRlZDtcblx0XHRcdFx0XHRsaW5lcy5wdXNoKC4uLmJ1aWxkUmVxdWlyZWRGaWVsZExpbmVzKGZpZWxkLCB1bmRlZmluZWQsIGNyZWF0ZWQsIGF1dGhvck5hbWUsIGRlZmF1bHRzKSk7XG5cdFx0XHRcdFx0aW5zZXJ0ZWQuYWRkKGZpZWxkKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGxpbmVzLnB1c2goLi4uYnVpbGRCbG9ja0xpbmVzV2l0aERlZmF1bHQoYmxvY2ssIGRlZmF1bHRGaWVsZHMsIGRlZmF1bHRzKSk7XG5cdH1cblxuXHRmb3IgKGNvbnN0IGZpZWxkIG9mIG1pc3NpbmdGaWVsZHMpIHtcblx0XHRpZiAoIWluc2VydGVkLmhhcyhmaWVsZCkpIHtcblx0XHRcdGNvbnN0IGNyZWF0ZWQgPSBmaWVsZCA9PT0gXCLmnIDlkI7mm7TmlrBcIiA/IGNyZWF0ZWRGb3JVcGRhdGVkIDogZmlsZUNyZWF0ZWQ7XG5cdFx0XHRsaW5lcy5wdXNoKC4uLmJ1aWxkUmVxdWlyZWRGaWVsZExpbmVzKGZpZWxkLCB1bmRlZmluZWQsIGNyZWF0ZWQsIGF1dGhvck5hbWUsIGRlZmF1bHRzKSk7XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIGxpbmVzLmpvaW4oXCJcXG5cIik7XG59XG5cbmZ1bmN0aW9uIGdldEV4aXN0aW5nQ3JlYXRlZFZhbHVlKGJsb2NrczogRnJvbnRtYXR0ZXJCbG9ja1tdKTogc3RyaW5nIHwgbnVsbCB7XG5cdGZvciAoY29uc3QgYmxvY2sgb2YgYmxvY2tzKSB7XG5cdFx0aWYgKGJsb2NrLmtleSA9PT0gXCLliJvlu7rml7bpl7RcIikge1xuXHRcdFx0cmV0dXJuIGdldEJsb2NrU2NhbGFyKGJsb2NrKTtcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gYnVpbGRCbG9ja0xpbmVzV2l0aERlZmF1bHQoXG5cdGJsb2NrOiBGcm9udG1hdHRlckJsb2NrLFxuXHRkZWZhdWx0RmllbGRzOiBGb2xkZXJEZWZhdWx0RmllbGRbXSxcblx0ZGVmYXVsdHM6IEZvbGRlckRlZmF1bHRWYWx1ZXMsXG4pOiBzdHJpbmdbXSB7XG5cdGlmIChibG9jay5rZXkgPT09IFwi6aG555uuXCIgJiYgZGVmYXVsdEZpZWxkcy5pbmNsdWRlcyhcIumhueebrlwiKSkge1xuXHRcdHJldHVybiBbZm9ybWF0U2NhbGFyRmllbGQoXCLpobnnm65cIiwgZGVmYXVsdHNbXCLpobnnm65cIl0gPz8gXCJcIildO1xuXHR9XG5cdGlmIChibG9jay5rZXkgPT09IFwi57G75Z6LXCIgJiYgZGVmYXVsdEZpZWxkcy5pbmNsdWRlcyhcIuexu+Wei1wiKSkge1xuXHRcdHJldHVybiBbXCLnsbvlnos6XCIsIC4uLmZvcm1hdExpc3RWYWx1ZSh1bmRlZmluZWQsIGRlZmF1bHRzW1wi57G75Z6LXCJdID8/IFwiXCIpXTtcblx0fVxuXHRyZXR1cm4gYmxvY2subGluZXM7XG59XG5cbmZ1bmN0aW9uIGZpbGxFbXB0eUZvbGRlckRlZmF1bHRzKGNvbnRlbnQ6IHN0cmluZywgZGVmYXVsdHM6IEZvbGRlckRlZmF1bHRWYWx1ZXMpOiBzdHJpbmcgfCBudWxsIHtcblx0Y29uc3QgZnJvbnRtYXR0ZXIgPSBwYXJzZUZyb250bWF0dGVyKGNvbnRlbnQpO1xuXHRpZiAoZnJvbnRtYXR0ZXIgPT09IG51bGwpIHtcblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdGNvbnN0IGJvZHkgPSBtaWdyYXRlTGVnYWN5RnJvbnRtYXR0ZXJCb2R5KGZyb250bWF0dGVyLmJvZHkpO1xuXHRjb25zdCBibG9ja3MgPSBwYXJzZUZyb250bWF0dGVyQmxvY2tzKGJvZHkpO1xuXHRjb25zdCBkZWZhdWx0RmllbGRzID0gRk9MREVSX0RFRkFVTFRfRklFTERTLmZpbHRlcigoZmllbGQpID0+IHtcblx0XHRyZXR1cm4gZGVmYXVsdHNbZmllbGRdICE9PSB1bmRlZmluZWQgJiYgZnJvbnRtYXR0ZXJGaWVsZElzRW1wdHkoYmxvY2tzLCBmaWVsZCk7XG5cdH0pO1xuXHRpZiAoZGVmYXVsdEZpZWxkcy5sZW5ndGggPT09IDApIHtcblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdGNvbnN0IGxpbmVzID0gYmxvY2tzLmZsYXRNYXAoKGJsb2NrKSA9PiBidWlsZEJsb2NrTGluZXNXaXRoRGVmYXVsdChibG9jaywgZGVmYXVsdEZpZWxkcywgZGVmYXVsdHMpKTtcblx0Y29uc3Qgc3VmZml4ID0gY29udGVudC5zbGljZShmcm9udG1hdHRlci5lbmQpO1xuXHRjb25zdCBzZXBhcmF0b3IgPSBzdWZmaXguc3RhcnRzV2l0aChcIlxcblwiKSA/IFwiXCIgOiBcIlxcblwiO1xuXHRyZXR1cm4gYC0tLVxcbiR7bGluZXMuam9pbihcIlxcblwiKX0ke3NlcGFyYXRvcn0ke3N1ZmZpeH1gO1xufVxuXG5mdW5jdGlvbiBmcm9udG1hdHRlckZpZWxkSXNFbXB0eShibG9ja3M6IEZyb250bWF0dGVyQmxvY2tbXSwgZmllbGQ6IEZvbGRlckRlZmF1bHRGaWVsZCk6IGJvb2xlYW4ge1xuXHRjb25zdCBibG9jayA9IGJsb2Nrcy5maW5kKChpdGVtKSA9PiBpdGVtLmtleSA9PT0gZmllbGQpO1xuXHRpZiAoIWJsb2NrKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0aWYgKGZpZWxkID09PSBcIumhueebrlwiKSB7XG5cdFx0cmV0dXJuIGdldEJsb2NrU2NhbGFyKGJsb2NrKSA9PT0gbnVsbDtcblx0fVxuXG5cdGNvbnN0IGxpc3RWYWx1ZXMgPSBnZXRCbG9ja0xpc3RWYWx1ZXMoYmxvY2spO1xuXHRpZiAobGlzdFZhbHVlcy5sZW5ndGggPiAwKSB7XG5cdFx0cmV0dXJuIGxpc3RWYWx1ZXMuZXZlcnkoKHZhbHVlKSA9PiB2YWx1ZS5sZW5ndGggPT09IDApO1xuXHR9XG5cblx0cmV0dXJuIGdldEJsb2NrU2NhbGFyKGJsb2NrKSA9PT0gbnVsbDtcbn1cblxuZnVuY3Rpb24gYnVpbGRSZW9yZGVyZWRGcm9udG1hdHRlckJvZHkoXG5cdGZyb250bWF0dGVyQm9keTogc3RyaW5nLFxuXHRmaWxlQ3JlYXRlZDogc3RyaW5nLFxuXHRhdXRob3JOYW1lOiBzdHJpbmcsXG5cdGRlZmF1bHRzOiBGb2xkZXJEZWZhdWx0VmFsdWVzLFxuKTogc3RyaW5nIHtcblx0Y29uc3QgYmxvY2tzID0gcGFyc2VGcm9udG1hdHRlckJsb2Nrcyhmcm9udG1hdHRlckJvZHkpO1xuXHRjb25zdCByZXF1aXJlZEJsb2NrcyA9IG5ldyBNYXA8UmVxdWlyZWRGaWVsZCwgRnJvbnRtYXR0ZXJCbG9jaz4oKTtcblx0Y29uc3QgY3VzdG9tQmxvY2tzOiBGcm9udG1hdHRlckJsb2NrW10gPSBbXTtcblxuXHRmb3IgKGNvbnN0IGJsb2NrIG9mIGJsb2Nrcykge1xuXHRcdGlmIChpc1JlcXVpcmVkRmllbGQoYmxvY2sua2V5KSkge1xuXHRcdFx0aWYgKCFyZXF1aXJlZEJsb2Nrcy5oYXMoYmxvY2sua2V5KSkge1xuXHRcdFx0XHRyZXF1aXJlZEJsb2Nrcy5zZXQoYmxvY2sua2V5LCBibG9jayk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjdXN0b21CbG9ja3MucHVzaChibG9jayk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIGlmIChibG9jay5saW5lcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRjdXN0b21CbG9ja3MucHVzaChibG9jayk7XG5cdFx0fVxuXHR9XG5cblx0Y29uc3QgZXhpc3RpbmdDcmVhdGVkID0gZ2V0QmxvY2tTY2FsYXIocmVxdWlyZWRCbG9ja3MuZ2V0KFwi5Yib5bu65pe26Ze0XCIpKTtcblx0Y29uc3QgY3JlYXRlZCA9IGV4aXN0aW5nQ3JlYXRlZCB8fCBmaWxlQ3JlYXRlZDtcblx0Y29uc3QgbGluZXM6IHN0cmluZ1tdID0gW107XG5cblx0bGluZXMucHVzaCguLi5idWlsZFJlcXVpcmVkRmllbGRMaW5lcyhcIumhueebrlwiLCByZXF1aXJlZEJsb2Nrcy5nZXQoXCLpobnnm65cIiksIGZpbGVDcmVhdGVkLCBhdXRob3JOYW1lLCBkZWZhdWx0cykpO1xuXHRsaW5lcy5wdXNoKC4uLmJ1aWxkUmVxdWlyZWRGaWVsZExpbmVzKFwi57G75Z6LXCIsIHJlcXVpcmVkQmxvY2tzLmdldChcIuexu+Wei1wiKSwgZmlsZUNyZWF0ZWQsIGF1dGhvck5hbWUsIGRlZmF1bHRzKSk7XG5cdGxpbmVzLnB1c2goLi4uY3VzdG9tQmxvY2tzLmZsYXRNYXAoKGJsb2NrKSA9PiBibG9jay5saW5lcykpO1xuXHRsaW5lcy5wdXNoKC4uLmJ1aWxkUmVxdWlyZWRGaWVsZExpbmVzKFwi5L2c6ICFXCIsIHJlcXVpcmVkQmxvY2tzLmdldChcIuS9nOiAhVwiKSwgZmlsZUNyZWF0ZWQsIGF1dGhvck5hbWUsIGRlZmF1bHRzKSk7XG5cdGxpbmVzLnB1c2goLi4uYnVpbGRSZXF1aXJlZEZpZWxkTGluZXMoXCLmkZjopoFcIiwgcmVxdWlyZWRCbG9ja3MuZ2V0KFwi5pGY6KaBXCIpLCBmaWxlQ3JlYXRlZCwgYXV0aG9yTmFtZSwgZGVmYXVsdHMpKTtcblx0bGluZXMucHVzaCguLi5idWlsZFJlcXVpcmVkRmllbGRMaW5lcyhcIuWIm+W7uuaXtumXtFwiLCByZXF1aXJlZEJsb2Nrcy5nZXQoXCLliJvlu7rml7bpl7RcIiksIGZpbGVDcmVhdGVkLCBhdXRob3JOYW1lLCBkZWZhdWx0cykpO1xuXHRsaW5lcy5wdXNoKC4uLmJ1aWxkUmVxdWlyZWRGaWVsZExpbmVzKFwi5pyA5ZCO5pu05pawXCIsIHJlcXVpcmVkQmxvY2tzLmdldChcIuacgOWQjuabtOaWsFwiKSwgY3JlYXRlZCwgYXV0aG9yTmFtZSwgZGVmYXVsdHMpKTtcblx0cmV0dXJuIGxpbmVzLmpvaW4oXCJcXG5cIik7XG59XG5cbmZ1bmN0aW9uIGJ1aWxkUmVxdWlyZWRGaWVsZExpbmVzKFxuXHRmaWVsZDogUmVxdWlyZWRGaWVsZCxcblx0YmxvY2s6IEZyb250bWF0dGVyQmxvY2sgfCB1bmRlZmluZWQsXG5cdGZpbGVDcmVhdGVkOiBzdHJpbmcsXG5cdGF1dGhvck5hbWU6IHN0cmluZyxcblx0ZGVmYXVsdHM6IEZvbGRlckRlZmF1bHRWYWx1ZXMgPSB7fSxcbik6IHN0cmluZ1tdIHtcblx0aWYgKGZpZWxkID09PSBcIumhueebrlwiKSB7XG5cdFx0cmV0dXJuIFtmb3JtYXRTY2FsYXJGaWVsZChcIumhueebrlwiLCBnZXRCbG9ja1NjYWxhcihibG9jaykgPz8gZGVmYXVsdHNbXCLpobnnm65cIl0gPz8gXCJcIildO1xuXHR9XG5cdGlmIChmaWVsZCA9PT0gXCLnsbvlnotcIikge1xuXHRcdHJldHVybiBbXCLnsbvlnos6XCIsIC4uLmZvcm1hdExpc3RWYWx1ZShibG9jaywgZGVmYXVsdHNbXCLnsbvlnotcIl0gPz8gXCJcIildO1xuXHR9XG5cdGlmIChmaWVsZCA9PT0gXCLkvZzogIVcIikge1xuXHRcdHJldHVybiBbXCLkvZzogIU6XCIsIC4uLmZvcm1hdExpc3RWYWx1ZShibG9jaywgYXV0aG9yTmFtZSldO1xuXHR9XG5cdGlmIChmaWVsZCA9PT0gXCLmkZjopoFcIikge1xuXHRcdHJldHVybiBbZm9ybWF0U2NhbGFyRmllbGQoXCLmkZjopoFcIiwgZ2V0QmxvY2tTY2FsYXIoYmxvY2spID8/IFwiXCIpXTtcblx0fVxuXHRpZiAoZmllbGQgPT09IFwi5Yib5bu65pe26Ze0XCIpIHtcblx0XHRyZXR1cm4gW2DliJvlu7rml7bpl7Q6ICR7Z2V0QmxvY2tTY2FsYXIoYmxvY2spIHx8IGZpbGVDcmVhdGVkfWBdO1xuXHR9XG5cdHJldHVybiBbYOacgOWQjuabtOaWsDogJHtnZXRCbG9ja1NjYWxhcihibG9jaykgfHwgZmlsZUNyZWF0ZWR9YF07XG59XG5cbmZ1bmN0aW9uIGdldExlZ2FjeVJlbmFtZXMoYmxvY2tzOiBGcm9udG1hdHRlckJsb2NrW10pOiBMZWdhY3lSZW5hbWVbXSB7XG5cdGNvbnN0IHJlbmFtZXM6IExlZ2FjeVJlbmFtZVtdID0gW107XG5cdGZvciAoY29uc3QgbGVnYWN5RmllbGQgb2YgT2JqZWN0LmtleXMoTEVHQUNZX0ZJRUxEX1JFTkFNRVMpIGFzIExlZ2FjeUZpZWxkW10pIHtcblx0XHRpZiAoaGFzQW55RnJvbnRtYXR0ZXJCbG9jayhibG9ja3MsIGxlZ2FjeUZpZWxkKSkge1xuXHRcdFx0cmVuYW1lcy5wdXNoKHtcblx0XHRcdFx0ZnJvbTogbGVnYWN5RmllbGQsXG5cdFx0XHRcdHRvOiBMRUdBQ1lfRklFTERfUkVOQU1FU1tsZWdhY3lGaWVsZF0sXG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblx0cmV0dXJuIHJlbmFtZXM7XG59XG5cbmZ1bmN0aW9uIG1pZ3JhdGVMZWdhY3lGcm9udG1hdHRlckJvZHkoZnJvbnRtYXR0ZXJCb2R5OiBzdHJpbmcpOiBzdHJpbmcge1xuXHRyZXR1cm4gbWlncmF0ZUxlZ2FjeUJsb2NrcyhwYXJzZUZyb250bWF0dGVyQmxvY2tzKGZyb250bWF0dGVyQm9keSkpXG5cdFx0LmZsYXRNYXAoKGJsb2NrKSA9PiBibG9jay5saW5lcylcblx0XHQuam9pbihcIlxcblwiKTtcbn1cblxuZnVuY3Rpb24gbWlncmF0ZUxlZ2FjeUJsb2NrcyhibG9ja3M6IEZyb250bWF0dGVyQmxvY2tbXSk6IEZyb250bWF0dGVyQmxvY2tbXSB7XG5cdGNvbnN0IGhhc05ld0ZpZWxkID0gbmV3IFNldDxSZXF1aXJlZEZpZWxkPigpO1xuXHRmb3IgKGNvbnN0IGJsb2NrIG9mIGJsb2Nrcykge1xuXHRcdGlmIChpc1JlcXVpcmVkRmllbGQoYmxvY2sua2V5KSkge1xuXHRcdFx0aGFzTmV3RmllbGQuYWRkKGJsb2NrLmtleSk7XG5cdFx0fVxuXHR9XG5cblx0Y29uc3QgbWlncmF0ZWQ6IEZyb250bWF0dGVyQmxvY2tbXSA9IFtdO1xuXHRmb3IgKGNvbnN0IGJsb2NrIG9mIGJsb2Nrcykge1xuXHRcdGlmIChpc0xlZ2FjeUZpZWxkKGJsb2NrLmtleSkpIHtcblx0XHRcdGNvbnN0IG5ld0tleSA9IExFR0FDWV9GSUVMRF9SRU5BTUVTW2Jsb2NrLmtleV07XG5cdFx0XHRpZiAoaGFzTmV3RmllbGQuaGFzKG5ld0tleSkpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGhhc05ld0ZpZWxkLmFkZChuZXdLZXkpO1xuXHRcdFx0bWlncmF0ZWQucHVzaCh7XG5cdFx0XHRcdGtleTogbmV3S2V5LFxuXHRcdFx0XHRsaW5lczogcmVuYW1lQmxvY2tGaXJzdExpbmUoYmxvY2subGluZXMsIG5ld0tleSksXG5cdFx0XHR9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0bWlncmF0ZWQucHVzaChibG9jayk7XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIG1pZ3JhdGVkO1xufVxuXG5mdW5jdGlvbiByZW5hbWVCbG9ja0ZpcnN0TGluZShsaW5lczogc3RyaW5nW10sIGtleTogUmVxdWlyZWRGaWVsZCk6IHN0cmluZ1tdIHtcblx0aWYgKGxpbmVzLmxlbmd0aCA9PT0gMCkge1xuXHRcdHJldHVybiBbXTtcblx0fVxuXG5cdGNvbnN0IGNvbG9uID0gbGluZXNbMF0uaW5kZXhPZihcIjpcIik7XG5cdGNvbnN0IGZpcnN0TGluZSA9IGNvbG9uID09PSAtMSA/IGAke2tleX06YCA6IGAke2tleX0ke2xpbmVzWzBdLnNsaWNlKGNvbG9uKX1gO1xuXHRyZXR1cm4gW2ZpcnN0TGluZSwgLi4ubGluZXMuc2xpY2UoMSldO1xufVxuXG5mdW5jdGlvbiBwYXJzZUZyb250bWF0dGVyQmxvY2tzKGZyb250bWF0dGVyOiBzdHJpbmcpOiBGcm9udG1hdHRlckJsb2NrW10ge1xuXHRjb25zdCBibG9ja3M6IEZyb250bWF0dGVyQmxvY2tbXSA9IFtdO1xuXHRjb25zdCBsaW5lcyA9IGZyb250bWF0dGVyLnNwbGl0KFwiXFxuXCIpLmZpbHRlcigobGluZSwgaW5kZXgsIGFsbCkgPT4ge1xuXHRcdHJldHVybiBpbmRleCA8IGFsbC5sZW5ndGggLSAxIHx8IGxpbmUubGVuZ3RoID4gMDtcblx0fSk7XG5cblx0Zm9yIChjb25zdCBsaW5lIG9mIGxpbmVzKSB7XG5cdFx0Y29uc3Qga2V5ID0gZ2V0VG9wTGV2ZWxLZXkobGluZSk7XG5cdFx0aWYgKGtleSAhPT0gbnVsbCB8fCBibG9ja3MubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRibG9ja3MucHVzaCh7IGtleSwgbGluZXM6IFtsaW5lXSB9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0YmxvY2tzW2Jsb2Nrcy5sZW5ndGggLSAxXS5saW5lcy5wdXNoKGxpbmUpO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiBibG9ja3M7XG59XG5cbmZ1bmN0aW9uIGdldFRvcExldmVsS2V5KGxpbmU6IHN0cmluZyk6IHN0cmluZyB8IG51bGwge1xuXHRpZiAoL15cXHMvLnRlc3QobGluZSkpIHtcblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdGNvbnN0IG1hdGNoID0gL14oW146I11bXjpdKik6Ly5leGVjKGxpbmUpO1xuXHRyZXR1cm4gbWF0Y2ggPyBtYXRjaFsxXS50cmltKCkgOiBudWxsO1xufVxuXG5mdW5jdGlvbiBoYXNGcm9udG1hdHRlckJsb2NrKGJsb2NrczogRnJvbnRtYXR0ZXJCbG9ja1tdLCBmaWVsZDogUmVxdWlyZWRGaWVsZCk6IGJvb2xlYW4ge1xuXHRyZXR1cm4gYmxvY2tzLnNvbWUoKGJsb2NrKSA9PiBibG9jay5rZXkgPT09IGZpZWxkKTtcbn1cblxuZnVuY3Rpb24gaGFzQW55RnJvbnRtYXR0ZXJCbG9jayhibG9ja3M6IEZyb250bWF0dGVyQmxvY2tbXSwgZmllbGQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRyZXR1cm4gYmxvY2tzLnNvbWUoKGJsb2NrKSA9PiBibG9jay5rZXkgPT09IGZpZWxkKTtcbn1cblxuZnVuY3Rpb24gcmVxdWlyZWRGaWVsZHNBcmVJblJlbGF0aXZlT3JkZXIoYmxvY2tzOiBGcm9udG1hdHRlckJsb2NrW10pOiBib29sZWFuIHtcblx0bGV0IGxhc3RJbmRleCA9IC0xO1xuXHRmb3IgKGNvbnN0IGJsb2NrIG9mIGJsb2Nrcykge1xuXHRcdGlmICghaXNSZXF1aXJlZEZpZWxkKGJsb2NrLmtleSkpIHtcblx0XHRcdGNvbnRpbnVlO1xuXHRcdH1cblxuXHRcdGNvbnN0IGluZGV4ID0gZ2V0UmVxdWlyZWRGaWVsZEluZGV4KGJsb2NrLmtleSk7XG5cdFx0aWYgKGluZGV4IDwgbGFzdEluZGV4KSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGxhc3RJbmRleCA9IGluZGV4O1xuXHR9XG5cblx0cmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIGdldFJlcXVpcmVkRmllbGRJbmRleChmaWVsZDogUmVxdWlyZWRGaWVsZCk6IG51bWJlciB7XG5cdHJldHVybiBSRVFVSVJFRF9GSUVMRFMuaW5kZXhPZihmaWVsZCk7XG59XG5cbmZ1bmN0aW9uIGlzUmVxdWlyZWRGaWVsZChrZXk6IHN0cmluZyB8IG51bGwpOiBrZXkgaXMgUmVxdWlyZWRGaWVsZCB7XG5cdHJldHVybiBrZXkgIT09IG51bGwgJiYgKFJFUVVJUkVEX0ZJRUxEUyBhcyByZWFkb25seSBzdHJpbmdbXSkuaW5jbHVkZXMoa2V5KTtcbn1cblxuZnVuY3Rpb24gaXNMZWdhY3lGaWVsZChrZXk6IHN0cmluZyB8IG51bGwpOiBrZXkgaXMgTGVnYWN5RmllbGQge1xuXHRyZXR1cm4ga2V5ICE9PSBudWxsICYmIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChMRUdBQ1lfRklFTERfUkVOQU1FUywga2V5KTtcbn1cblxuZnVuY3Rpb24gZ2V0QmxvY2tTY2FsYXIoYmxvY2s6IEZyb250bWF0dGVyQmxvY2sgfCB1bmRlZmluZWQpOiBzdHJpbmcgfCBudWxsIHtcblx0aWYgKCFibG9jaykge1xuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0Y29uc3QgZmlyc3RMaW5lID0gYmxvY2subGluZXNbMF07XG5cdGNvbnN0IGNvbG9uID0gZmlyc3RMaW5lLmluZGV4T2YoXCI6XCIpO1xuXHRpZiAoY29sb24gPT09IC0xKSB7XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRjb25zdCB2YWx1ZSA9IGZpcnN0TGluZS5zbGljZShjb2xvbiArIDEpLnRyaW0oKTtcblx0cmV0dXJuIHZhbHVlLmxlbmd0aCA+IDAgPyB2YWx1ZSA6IG51bGw7XG59XG5cbmZ1bmN0aW9uIGZvcm1hdFNjYWxhckZpZWxkKGZpZWxkOiBSZXF1aXJlZEZpZWxkLCB2YWx1ZTogc3RyaW5nKTogc3RyaW5nIHtcblx0cmV0dXJuIHZhbHVlID8gYCR7ZmllbGR9OiAke3ZhbHVlfWAgOiBgJHtmaWVsZH06IGA7XG59XG5cbmZ1bmN0aW9uIGZvcm1hdExpc3RWYWx1ZShibG9jazogRnJvbnRtYXR0ZXJCbG9jayB8IHVuZGVmaW5lZCwgZGVmYXVsdFZhbHVlOiBzdHJpbmcpOiBzdHJpbmdbXSB7XG5cdGNvbnN0IHZhbHVlcyA9IGdldEJsb2NrTGlzdFZhbHVlcyhibG9jayk7XG5cdGlmICh2YWx1ZXMubGVuZ3RoID4gMCkge1xuXHRcdHJldHVybiB2YWx1ZXMubWFwKCh2YWx1ZSkgPT4gYCAgLSAke2Zvcm1hdFlhbWxTY2FsYXIodmFsdWUpfWApO1xuXHR9XG5cblx0Y29uc3Qgc2NhbGFyID0gZ2V0QmxvY2tTY2FsYXIoYmxvY2spO1xuXHRjb25zdCB2YWx1ZSA9IHNjYWxhciA/PyBkZWZhdWx0VmFsdWU7XG5cdHJldHVybiBbYCAgLSAke2Zvcm1hdFlhbWxTY2FsYXIodmFsdWUpfWBdO1xufVxuXG5mdW5jdGlvbiBnZXRCbG9ja0xpc3RWYWx1ZXMoYmxvY2s6IEZyb250bWF0dGVyQmxvY2sgfCB1bmRlZmluZWQpOiBzdHJpbmdbXSB7XG5cdGlmICghYmxvY2sgfHwgYmxvY2subGluZXMubGVuZ3RoIDw9IDEpIHtcblx0XHRyZXR1cm4gW107XG5cdH1cblxuXHRjb25zdCB2YWx1ZXM6IHN0cmluZ1tdID0gW107XG5cdGZvciAoY29uc3QgbGluZSBvZiBibG9jay5saW5lcy5zbGljZSgxKSkge1xuXHRcdGNvbnN0IG1hdGNoID0gL15cXHMqLVxccyooLiopJC8uZXhlYyhsaW5lKTtcblx0XHRpZiAobWF0Y2gpIHtcblx0XHRcdHZhbHVlcy5wdXNoKG1hdGNoWzFdLnRyaW0oKSk7XG5cdFx0fVxuXHR9XG5cdHJldHVybiB2YWx1ZXM7XG59XG5cbmZ1bmN0aW9uIHBhcnNlRnJvbnRtYXR0ZXIoY29udGVudDogc3RyaW5nKTogeyBib2R5OiBzdHJpbmc7IGVuZDogbnVtYmVyIH0gfCBudWxsIHtcblx0aWYgKCFjb250ZW50LnN0YXJ0c1dpdGgoXCItLS1cXG5cIikpIHtcblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdGxldCBsaW5lU3RhcnQgPSA0O1xuXHR3aGlsZSAobGluZVN0YXJ0IDw9IGNvbnRlbnQubGVuZ3RoKSB7XG5cdFx0Y29uc3QgbGluZUVuZCA9IGNvbnRlbnQuaW5kZXhPZihcIlxcblwiLCBsaW5lU3RhcnQpO1xuXHRcdGNvbnN0IGxpbmUgPSBjb250ZW50LnNsaWNlKGxpbmVTdGFydCwgbGluZUVuZCA9PT0gLTEgPyBjb250ZW50Lmxlbmd0aCA6IGxpbmVFbmQpO1xuXHRcdGlmIChsaW5lLnRyaW0oKSA9PT0gXCItLS1cIikge1xuXHRcdFx0Y29uc3QgZW5kID0gbGluZVN0YXJ0ID09PSA0ID8gNCA6IGxpbmVTdGFydCAtIDE7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRib2R5OiBjb250ZW50LnNsaWNlKDQsIGVuZCksXG5cdFx0XHRcdGVuZCxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKGxpbmVFbmQgPT09IC0xKSB7XG5cdFx0XHRicmVhaztcblx0XHR9XG5cdFx0bGluZVN0YXJ0ID0gbGluZUVuZCArIDE7XG5cdH1cblxuXHRyZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gZ2V0U3VtbWFyeURvY3VtZW50KGZpbGU6IFRGaWxlLCBjb250ZW50OiBzdHJpbmcsIG1pbkJvZHlMZW5ndGg6IG51bWJlcik6IFN1bW1hcnlEb2N1bWVudCB8IG51bGwge1xuXHRjb25zdCBmcm9udG1hdHRlciA9IHBhcnNlRnJvbnRtYXR0ZXIoY29udGVudCk7XG5cdGNvbnN0IGJvZHkgPSBnZXRCb2R5V2l0aG91dEZyb250bWF0dGVyKGNvbnRlbnQsIGZyb250bWF0dGVyKTtcblx0Y29uc3QgdHJpbW1lZCA9IGJvZHkudHJpbSgpO1xuXHRpZiAodHJpbW1lZC5sZW5ndGggPCBtaW5Cb2R5TGVuZ3RoKSB7XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRyZXR1cm4ge1xuXHRcdHRpdGxlOiBmaWxlLmJhc2VuYW1lLFxuXHRcdGZyb250bWF0dGVyOiBmcm9udG1hdHRlcj8uYm9keS50cmltKCkgPz8gXCJcIixcblx0XHRjb250ZW50OiB0cmltbWVkLnNsaWNlKDAsIE1BWF9TVU1NQVJZX0NPTlRFTlRfTEVOR1RIKSxcblx0fTtcbn1cblxuZnVuY3Rpb24gZ2V0Qm9keVdpdGhvdXRGcm9udG1hdHRlcihcblx0Y29udGVudDogc3RyaW5nLFxuXHRmcm9udG1hdHRlcjogeyBib2R5OiBzdHJpbmc7IGVuZDogbnVtYmVyIH0gfCBudWxsLFxuKTogc3RyaW5nIHtcblx0aWYgKGZyb250bWF0dGVyID09PSBudWxsKSB7XG5cdFx0cmV0dXJuIGNvbnRlbnQ7XG5cdH1cblxuXHRyZXR1cm4gY29udGVudC5zbGljZShmcm9udG1hdHRlci5lbmQpLnJlcGxhY2UoL15cXG4/LS0tXFxuPy8sIFwiXCIpO1xufVxuXG5mdW5jdGlvbiB3cml0ZVN1bW1hcnlUb0NvbnRlbnQoXG5cdGNvbnRlbnQ6IHN0cmluZyxcblx0ZmlsZTogVEZpbGUsXG5cdHN1bW1hcnk6IHN0cmluZyxcblx0ZGVmYXVsdHM6IEZvbGRlckRlZmF1bHRWYWx1ZXMsXG5cdGJ1aWxkRnVsbEZyb250bWF0dGVyOiAoY3JlYXRlZDogc3RyaW5nLCBkZWZhdWx0cz86IEZvbGRlckRlZmF1bHRWYWx1ZXMpID0+IHN0cmluZyxcbik6IHN0cmluZyB8IG51bGwge1xuXHRjb25zdCBjcmVhdGVkID0gZm9ybWF0TG9jYWxEYXRlKG5ldyBEYXRlKGZpbGUuc3RhdC5jdGltZSkpO1xuXHRjb25zdCBzb3VyY2UgPSBwYXJzZUZyb250bWF0dGVyKGNvbnRlbnQpID09PSBudWxsID8gYnVpbGRGdWxsRnJvbnRtYXR0ZXIoY3JlYXRlZCwgZGVmYXVsdHMpICsgY29udGVudCA6IGNvbnRlbnQ7XG5cdGNvbnN0IGZyb250bWF0dGVyID0gcGFyc2VGcm9udG1hdHRlcihzb3VyY2UpO1xuXHRpZiAoZnJvbnRtYXR0ZXIgPT09IG51bGwpIHtcblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdGxldCBib2R5ID0gbWlncmF0ZUxlZ2FjeUZyb250bWF0dGVyQm9keShmcm9udG1hdHRlci5ib2R5KTtcblx0aWYgKCFoYXNGcm9udG1hdHRlckJsb2NrKHBhcnNlRnJvbnRtYXR0ZXJCbG9ja3MoYm9keSksIFwi5pGY6KaBXCIpKSB7XG5cdFx0Ym9keSA9IGJ1aWxkRnJvbnRtYXR0ZXJCb2R5V2l0aE1pc3NpbmdGaWVsZHMoYm9keSwgW1wi5pGY6KaBXCJdLCBbXSwgY3JlYXRlZCwgXCJcIiwgZGVmYXVsdHMpO1xuXHR9XG5cblx0Y29uc3QgbmV4dEJvZHkgPSByZXBsYWNlU3VtbWFyeUZpZWxkKGJvZHksIG5vcm1hbGl6ZVN1bW1hcnkoc3VtbWFyeSkpO1xuXHRjb25zdCBzdWZmaXggPSBzb3VyY2Uuc2xpY2UoZnJvbnRtYXR0ZXIuZW5kKTtcblx0Y29uc3Qgc2VwYXJhdG9yID0gc3VmZml4LnN0YXJ0c1dpdGgoXCJcXG5cIikgPyBcIlwiIDogXCJcXG5cIjtcblx0cmV0dXJuIGAtLS1cXG4ke25leHRCb2R5fSR7c2VwYXJhdG9yfSR7c3VmZml4fWA7XG59XG5cbmZ1bmN0aW9uIHJlcGxhY2VTdW1tYXJ5RmllbGQoZnJvbnRtYXR0ZXJCb2R5OiBzdHJpbmcsIHN1bW1hcnk6IHN0cmluZyk6IHN0cmluZyB7XG5cdGxldCByZXBsYWNlZCA9IGZhbHNlO1xuXHRjb25zdCBibG9ja3MgPSBwYXJzZUZyb250bWF0dGVyQmxvY2tzKGZyb250bWF0dGVyQm9keSk7XG5cdGNvbnN0IGxpbmVzID0gYmxvY2tzLmZsYXRNYXAoKGJsb2NrKSA9PiB7XG5cdFx0aWYgKGJsb2NrLmtleSA9PT0gXCLmkZjopoFcIiAmJiAhcmVwbGFjZWQpIHtcblx0XHRcdHJlcGxhY2VkID0gdHJ1ZTtcblx0XHRcdHJldHVybiBbZm9ybWF0U2NhbGFyRmllbGQoXCLmkZjopoFcIiwgc3VtbWFyeSldO1xuXHRcdH1cblxuXHRcdHJldHVybiBibG9jay5saW5lcztcblx0fSk7XG5cdHJldHVybiBsaW5lcy5qb2luKFwiXFxuXCIpO1xufVxuXG5mdW5jdGlvbiBub3JtYWxpemVTdW1tYXJ5KHN1bW1hcnk6IHN0cmluZyk6IHN0cmluZyB7XG5cdHJldHVybiBzdW1tYXJ5LnJlcGxhY2UoL1xccysvZywgXCIgXCIpLnRyaW0oKTtcbn1cblxuZnVuY3Rpb24gZ2V0RXJyb3JNZXNzYWdlKGVycm9yOiB1bmtub3duKTogc3RyaW5nIHtcblx0cmV0dXJuIGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKTtcbn1cblxuZnVuY3Rpb24gZnJvbnRtYXR0ZXJBdXRob3JDb250YWlucyh2YWx1ZTogdW5rbm93biwgYXV0aG9yOiBzdHJpbmcpOiBib29sZWFuIHtcblx0cmV0dXJuIG5vcm1hbGl6ZUNhbmRpZGF0ZVZhbHVlcyh2YWx1ZSkuaW5jbHVkZXMoYXV0aG9yKTtcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplRnJvbnRtYXR0ZXJTY2FsYXIodmFsdWU6IHVua25vd24pOiBzdHJpbmcge1xuXHRpZiAodHlwZW9mIHZhbHVlID09PSBcInN0cmluZ1wiKSB7XG5cdFx0cmV0dXJuIHZhbHVlLnRyaW0oKTtcblx0fVxuXHRpZiAodmFsdWUgPT09IG51bGwgfHwgdmFsdWUgPT09IHVuZGVmaW5lZCkge1xuXHRcdHJldHVybiBcIlwiO1xuXHR9XG5cdGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuXHRcdHJldHVybiB2YWx1ZVxuXHRcdFx0Lm1hcCgoaXRlbSkgPT4gbm9ybWFsaXplRnJvbnRtYXR0ZXJTY2FsYXIoaXRlbSkpXG5cdFx0XHQuZmluZCgoaXRlbSkgPT4gaXRlbS5sZW5ndGggPiAwKSA/PyBcIlwiO1xuXHR9XG5cdHJldHVybiBTdHJpbmcodmFsdWUpLnRyaW0oKTtcbn1cblxuZnVuY3Rpb24gcmVwbGFjZVByb21wdFRva2VuKHByb21wdDogc3RyaW5nLCB0b2tlbjogc3RyaW5nLCB2YWx1ZTogc3RyaW5nKTogc3RyaW5nIHtcblx0cmV0dXJuIHByb21wdC5zcGxpdCh0b2tlbikuam9pbih2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIGRlbGF5KG1zOiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcblx0cmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG5cdFx0d2luZG93LnNldFRpbWVvdXQocmVzb2x2ZSwgbXMpO1xuXHR9KTtcbn1cblxuZnVuY3Rpb24gY2xhbXAodmFsdWU6IG51bWJlciwgbWluOiBudW1iZXIsIG1heDogbnVtYmVyKTogbnVtYmVyIHtcblx0cmV0dXJuIE1hdGgubWluKE1hdGgubWF4KHZhbHVlLCBtaW4pLCBtYXgpO1xufVxuXG5mdW5jdGlvbiBmb3JtYXRTY2FuUmVhc29uKHJlc3VsdDogU2NhblJlc3VsdCk6IHN0cmluZyB7XG5cdGNvbnN0IHJlYXNvbnM6IHN0cmluZ1tdID0gW107XG5cdGZvciAoY29uc3QgcmVuYW1lIG9mIHJlc3VsdC5yZW5hbWVGaWVsZHMpIHtcblx0XHRyZWFzb25zLnB1c2goYOWtl+autemcgOmHjeWRveWQje+8miR7cmVuYW1lLmZyb219IOKGkiAke3JlbmFtZS50b31gKTtcblx0fVxuXHRpZiAocmVzdWx0Lm1pc3NpbmdGaWVsZHMubGVuZ3RoID4gMCkge1xuXHRcdHJlYXNvbnMucHVzaChg57y65bCR77yaJHtyZXN1bHQubWlzc2luZ0ZpZWxkcy5qb2luKFwiLCBcIil9YCk7XG5cdH1cblx0aWYgKHJlc3VsdC5kZWZhdWx0RmllbGRzLmxlbmd0aCA+IDApIHtcblx0XHRyZWFzb25zLnB1c2goYOm7mOiupOWAvOihpeWFqO+8miR7cmVzdWx0LmRlZmF1bHRGaWVsZHMuam9pbihcIiwgXCIpfWApO1xuXHR9XG5cdGlmIChyZXN1bHQub3JkZXJOZWVkc0ZpeCkge1xuXHRcdHJlYXNvbnMucHVzaChcIuWtl+autemhuuW6j+mcgOiwg+aVtFwiKTtcblx0fVxuXHRyZXR1cm4gcmVhc29ucy5qb2luKFwi77ybXCIpO1xufVxuXG5mdW5jdGlvbiBmaW5kTWV0YWRhdGFSb3coY29udGFpbmVyOiBIVE1MRWxlbWVudCwgZmllbGQ6IFJlcXVpcmVkRmllbGQpOiBIVE1MRWxlbWVudCB8IG51bGwge1xuXHRjb25zdCBkYXRhUm93ID0gY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3I8SFRNTEVsZW1lbnQ+KGBbZGF0YS1wcm9wZXJ0eS1rZXk9XCIke2ZpZWxkfVwiXWApO1xuXHRpZiAoZGF0YVJvdyAhPT0gbnVsbCkge1xuXHRcdHJldHVybiAoZGF0YVJvdy5jbG9zZXN0KFwiLm1ldGFkYXRhLXByb3BlcnR5XCIpIGFzIEhUTUxFbGVtZW50IHwgbnVsbCkgPz8gZGF0YVJvdztcblx0fVxuXG5cdGNvbnN0IHByb3BlcnR5Um93cyA9IGNvbnRhaW5lci5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50PihcIi5tZXRhZGF0YS1wcm9wZXJ0eVwiKTtcblx0Zm9yIChjb25zdCByb3cgb2YgQXJyYXkuZnJvbShwcm9wZXJ0eVJvd3MpKSB7XG5cdFx0aWYgKHJvd0NvbnRhaW5zRmllbGRMYWJlbChyb3csIGZpZWxkKSkge1xuXHRcdFx0cmV0dXJuIHJvdztcblx0XHR9XG5cdH1cblxuXHRjb25zdCBlbGVtZW50cyA9IGNvbnRhaW5lci5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50PihcIipcIik7XG5cdGZvciAoY29uc3QgZWwgb2YgQXJyYXkuZnJvbShlbGVtZW50cykpIHtcblx0XHRpZiAoZ2V0RWxlbWVudExhYmVsKGVsKSA9PT0gZmllbGQpIHtcblx0XHRcdHJldHVybiAoZWwuY2xvc2VzdChcIi5tZXRhZGF0YS1wcm9wZXJ0eVwiKSBhcyBIVE1MRWxlbWVudCB8IG51bGwpID8/IGVsLnBhcmVudEVsZW1lbnQgPz8gZWw7XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIGZpbmRNZXRhZGF0YVZhbHVlQ29udGFpbmVyKHJvdzogSFRNTEVsZW1lbnQpOiBIVE1MRWxlbWVudCB8IG51bGwge1xuXHRyZXR1cm4gcm93LnF1ZXJ5U2VsZWN0b3I8SFRNTEVsZW1lbnQ+KFxuXHRcdFwiLm1ldGFkYXRhLXByb3BlcnR5LXZhbHVlLCAubWV0YWRhdGEtcHJvcGVydHktdmFsdWUtaW5wdXQsIC5tZXRhZGF0YS1wcm9wZXJ0eS12YWx1ZS1jb250YWluZXJcIixcblx0KTtcbn1cblxuZnVuY3Rpb24gcmVtb3ZlRW1wdHlIaWdobGlnaHRDbGFzc2VzKGVsOiBFbGVtZW50KSB7XG5cdGVsLmNsYXNzTGlzdC5yZW1vdmUoXG5cdFx0XCJmcm9udG1hdHRlci1lbXB0eS1oaWdobGlnaHRcIixcblx0XHRcImZyb250bWF0dGVyLWVtcHR5LTFcIixcblx0XHRcImZyb250bWF0dGVyLWVtcHR5LTJcIixcblx0XHRcImZyb250bWF0dGVyLWVtcHR5LTNcIixcblx0XHRcImZyb250bWF0dGVyLWVtcHR5LTRcIixcblx0XHRcImZyb250bWF0dGVyLWVtcHR5LTVcIixcblx0XHRcImZyb250bWF0dGVyLWVtcHR5LTZcIixcblx0KTtcbn1cblxuZnVuY3Rpb24gZ2V0RG9jdW1lbnRPcmRlcihhOiBIVE1MRWxlbWVudCwgYjogSFRNTEVsZW1lbnQpOiBudW1iZXIge1xuXHRpZiAoYSA9PT0gYikge1xuXHRcdHJldHVybiAwO1xuXHR9XG5cblx0Y29uc3QgcG9zaXRpb24gPSBhLmNvbXBhcmVEb2N1bWVudFBvc2l0aW9uKGIpO1xuXHRyZXR1cm4gcG9zaXRpb24gJiBOb2RlLkRPQ1VNRU5UX1BPU0lUSU9OX0ZPTExPV0lORyA/IC0xIDogMTtcbn1cblxuZnVuY3Rpb24gcm93Q29udGFpbnNGaWVsZExhYmVsKHJvdzogSFRNTEVsZW1lbnQsIGZpZWxkOiBSZXF1aXJlZEZpZWxkKTogYm9vbGVhbiB7XG5cdGlmIChnZXRFbGVtZW50TGFiZWwocm93KSA9PT0gZmllbGQpIHtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdGNvbnN0IGxhYmVsRWxlbWVudHMgPSByb3cucXVlcnlTZWxlY3RvckFsbDxIVE1MRWxlbWVudD4oXG5cdFx0XCIubWV0YWRhdGEtcHJvcGVydHkta2V5LCAubWV0YWRhdGEtcHJvcGVydHkta2V5LWlucHV0LCBbYXJpYS1sYWJlbF0sIFt0aXRsZV1cIixcblx0KTtcblx0Zm9yIChjb25zdCBlbCBvZiBBcnJheS5mcm9tKGxhYmVsRWxlbWVudHMpKSB7XG5cdFx0aWYgKGdldEVsZW1lbnRMYWJlbChlbCkgPT09IGZpZWxkKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gZmFsc2U7XG59XG5cbmZ1bmN0aW9uIGdldEVsZW1lbnRMYWJlbChlbDogSFRNTEVsZW1lbnQpOiBzdHJpbmcge1xuXHRpZiAoZWwgaW5zdGFuY2VvZiBIVE1MSW5wdXRFbGVtZW50IHx8IGVsIGluc3RhbmNlb2YgSFRNTFRleHRBcmVhRWxlbWVudCkge1xuXHRcdHJldHVybiBlbC52YWx1ZS50cmltKCk7XG5cdH1cblxuXHRyZXR1cm4gKFxuXHRcdGVsLmdldEF0dHJpYnV0ZShcImRhdGEtcHJvcGVydHkta2V5XCIpID8/XG5cdFx0ZWwuZ2V0QXR0cmlidXRlKFwiYXJpYS1sYWJlbFwiKSA/P1xuXHRcdGVsLmdldEF0dHJpYnV0ZShcInRpdGxlXCIpID8/XG5cdFx0ZWwudGV4dENvbnRlbnQgPz9cblx0XHRcIlwiXG5cdCkudHJpbSgpO1xufVxuXG5mdW5jdGlvbiBpc0VtcHR5RnJvbnRtYXR0ZXJWYWx1ZSh2YWx1ZTogdW5rbm93bik6IGJvb2xlYW4ge1xuXHRpZiAodmFsdWUgPT09IG51bGwgfHwgdmFsdWUgPT09IHVuZGVmaW5lZCkge1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cdGlmICh0eXBlb2YgdmFsdWUgPT09IFwic3RyaW5nXCIpIHtcblx0XHRyZXR1cm4gdmFsdWUudHJpbSgpLmxlbmd0aCA9PT0gMDtcblx0fVxuXHRpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcblx0XHRyZXR1cm4gdmFsdWUubGVuZ3RoID09PSAwIHx8IHZhbHVlLmV2ZXJ5KChpdGVtKSA9PiBpc0VtcHR5RnJvbnRtYXR0ZXJWYWx1ZShpdGVtKSk7XG5cdH1cblxuXHRyZXR1cm4gZmFsc2U7XG59XG5cbmZ1bmN0aW9uIGdldFZhdWx0Rm9sZGVycyhhcHA6IEFwcCk6IHN0cmluZ1tdIHtcblx0Y29uc3QgZm9sZGVycyA9IGFwcC52YXVsdFxuXHRcdC5nZXRBbGxMb2FkZWRGaWxlcygpXG5cdFx0LmZpbHRlcigoZmlsZSk6IGZpbGUgaXMgVEZvbGRlciA9PiBmaWxlIGluc3RhbmNlb2YgVEZvbGRlcilcblx0XHQubWFwKChmb2xkZXIpID0+IGZvbGRlci5wYXRoKVxuXHRcdC5zb3J0KChhLCBiKSA9PiBhLmxvY2FsZUNvbXBhcmUoYikpO1xuXG5cdHJldHVybiBbXCJcIiwgLi4uZm9sZGVycy5maWx0ZXIoKGZvbGRlcikgPT4gZm9sZGVyLmxlbmd0aCA+IDApXTtcbn1cblxuZnVuY3Rpb24gc2hvdWxkSW5jbHVkZVJ1bGVGb2xkZXIoZm9sZGVyOiBzdHJpbmcpOiBib29sZWFuIHtcblx0cmV0dXJuIGZvbGRlci5sZW5ndGggPiAwICYmIGZvbGRlciAhPT0gXCIub2JzaWRpYW5cIiAmJiAhZm9sZGVyLnN0YXJ0c1dpdGgoXCIub2JzaWRpYW4vXCIpO1xufVxuXG5mdW5jdGlvbiBmb3JtYXRGb2xkZXJPcHRpb25MYWJlbChmb2xkZXI6IHN0cmluZyk6IHN0cmluZyB7XG5cdGlmIChmb2xkZXIgPT09IFwiXCIpIHtcblx0XHRyZXR1cm4gXCIvXCI7XG5cdH1cblxuXHRjb25zdCBkZXB0aCA9IGdldEZvbGRlckRlcHRoKGZvbGRlcikgLSAxO1xuXHRjb25zdCBuYW1lID0gZm9sZGVyLnNwbGl0KFwiL1wiKS5wb3AoKSA/PyBmb2xkZXI7XG5cdHJldHVybiBgJHtcIlxcdTAwQTBcXHUwMEEwXFx1MDBBMFxcdTAwQTBcIi5yZXBlYXQoZGVwdGgpfSR7bmFtZX1gO1xufVxuXG5mdW5jdGlvbiBmb3JtYXRSdWxlSW5saW5lVmFsdWUodmFsdWU6IHN0cmluZyk6IHN0cmluZyB7XG5cdHJldHVybiB2YWx1ZS50cmltKCkubGVuZ3RoID4gMCA/IHZhbHVlIDogXCJfX19fX19cIjtcbn1cblxuZnVuY3Rpb24gdG9nZ2xlTW9kYWxTZWxlY3RQbGFjZWhvbGRlcihzZWxlY3RFbDogSFRNTFNlbGVjdEVsZW1lbnQsIGlzUGxhY2Vob2xkZXI6IGJvb2xlYW4pIHtcblx0c2VsZWN0RWwuY2xhc3NMaXN0LnRvZ2dsZShcImlzLXBsYWNlaG9sZGVyXCIsIGlzUGxhY2Vob2xkZXIpO1xufVxuXG5mdW5jdGlvbiBnZXRBbmNlc3RvclJ1bGVzKGZvbGRlcjogc3RyaW5nLCBydWxlczogRm9sZGVyRGVmYXVsdFJ1bGVbXSk6IEZvbGRlckRlZmF1bHRSdWxlW10ge1xuXHRyZXR1cm4gcnVsZXNcblx0XHQuZmlsdGVyKChydWxlKSA9PiB7XG5cdFx0XHRyZXR1cm4gcnVsZS52YWx1ZSAmJiBzaG91bGRJbmNsdWRlUnVsZUZvbGRlcihydWxlLmZvbGRlcikgJiYgcnVsZS5mb2xkZXIgIT09IGZvbGRlciAmJiBmb2xkZXJNYXRjaGVzKGZvbGRlciwgcnVsZS5mb2xkZXIpO1xuXHRcdH0pXG5cdFx0LnNvcnQoKGEsIGIpID0+IHtcblx0XHRcdGNvbnN0IGRlcHRoRGlmZiA9IGdldEZvbGRlckRlcHRoKGIuZm9sZGVyKSAtIGdldEZvbGRlckRlcHRoKGEuZm9sZGVyKTtcblx0XHRcdGlmIChkZXB0aERpZmYgIT09IDApIHtcblx0XHRcdFx0cmV0dXJuIGRlcHRoRGlmZjtcblx0XHRcdH1cblx0XHRcdHJldHVybiBhLmZvbGRlci5sb2NhbGVDb21wYXJlKGIuZm9sZGVyKSB8fCBhLmZpZWxkLmxvY2FsZUNvbXBhcmUoYi5maWVsZCk7XG5cdFx0fSk7XG59XG5cbmZ1bmN0aW9uIGZvcm1hdFJ1bGVBdWRpdChydWxlOiBGb2xkZXJEZWZhdWx0UnVsZSk6IHN0cmluZyB7XG5cdGlmICghcnVsZS5jcmVhdGVkQnkgfHwgIXJ1bGUuY3JlYXRlZEF0KSB7XG5cdFx0cmV0dXJuIFwi5Yib5bu65L+h5oGv5LiN5Y+v6L+95rqvXCI7XG5cdH1cblxuXHRjb25zdCBjcmVhdGVkID0gYOeUsSAke3J1bGUuY3JlYXRlZEJ5fSDliJvlu7rkuo4gJHtmb3JtYXRBdWRpdFRpbWUocnVsZS5jcmVhdGVkQXQpfWA7XG5cdGlmIChcblx0XHQhcnVsZS5tb2RpZmllZEJ5IHx8XG5cdFx0IXJ1bGUubW9kaWZpZWRBdCB8fFxuXHRcdChydWxlLm1vZGlmaWVkQnkgPT09IHJ1bGUuY3JlYXRlZEJ5ICYmIHJ1bGUubW9kaWZpZWRBdCA9PT0gcnVsZS5jcmVhdGVkQXQpXG5cdCkge1xuXHRcdHJldHVybiBjcmVhdGVkO1xuXHR9XG5cblx0cmV0dXJuIGAke2NyZWF0ZWR9IMK3ICR7cnVsZS5tb2RpZmllZEJ5fSDmnIDlkI7kv67mlLnkuo4gJHtmb3JtYXRBdWRpdFRpbWUocnVsZS5tb2RpZmllZEF0KX1gO1xufVxuXG5mdW5jdGlvbiBmb3JtYXRBdWRpdFRpbWUodmFsdWU6IHN0cmluZyk6IHN0cmluZyB7XG5cdHJldHVybiB2YWx1ZS5yZXBsYWNlKFwiVFwiLCBcIiBcIikuc2xpY2UoMCwgMTYpO1xufVxuXG5mdW5jdGlvbiBnZXREZXZpY2VVdWlkKCk6IHN0cmluZyB7XG5cdHRyeSB7XG5cdFx0aWYgKHByb2Nlc3MucGxhdGZvcm0gPT09IFwiZGFyd2luXCIpIHtcblx0XHRcdGNvbnN0IG91dHB1dCA9IHJlcXVpcmUoXCJjaGlsZF9wcm9jZXNzXCIpXG5cdFx0XHRcdC5leGVjU3luYyhcImlvcmVnIC1yZDEgLWMgSU9QbGF0Zm9ybUV4cGVydERldmljZVwiKVxuXHRcdFx0XHQudG9TdHJpbmcoKTtcblx0XHRcdGNvbnN0IG1hdGNoID0gL1wiSU9QbGF0Zm9ybVVVSURcIlxccyo9XFxzKlwiKFteXCJdKylcIi8uZXhlYyhvdXRwdXQpO1xuXHRcdFx0aWYgKG1hdGNoKSB7XG5cdFx0XHRcdHJldHVybiBtYXRjaFsxXTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gXCJ3aW4zMlwiKSB7XG5cdFx0XHRjb25zdCBvdXRwdXQgPSByZXF1aXJlKFwiY2hpbGRfcHJvY2Vzc1wiKS5leGVjU3luYyhcIndtaWMgY3Nwcm9kdWN0IGdldCBVVUlEXCIpLnRvU3RyaW5nKCk7XG5cdFx0XHRjb25zdCB1dWlkID0gb3V0cHV0XG5cdFx0XHRcdC5zcGxpdCgvXFxyP1xcbi8pXG5cdFx0XHRcdC5tYXAoKGxpbmU6IHN0cmluZykgPT4gbGluZS50cmltKCkpXG5cdFx0XHRcdC5maW5kKChsaW5lOiBzdHJpbmcpID0+IGxpbmUgJiYgbGluZS50b0xvd2VyQ2FzZSgpICE9PSBcInV1aWRcIik7XG5cdFx0XHRpZiAodXVpZCkge1xuXHRcdFx0XHRyZXR1cm4gdXVpZDtcblx0XHRcdH1cblx0XHR9XG5cdH0gY2F0Y2gge1xuXHRcdC8vIEZhbGwgYmFjayB0byBob3N0bmFtZSBiZWxvdy5cblx0fVxuXG5cdHJldHVybiByZXF1aXJlKFwib3NcIikuaG9zdG5hbWUoKTtcbn1cblxuZnVuY3Rpb24gZ2V0TGVnYWN5QXV0aG9yTmFtZShzZXR0aW5nczogQXV0b0Zyb250bWF0dGVyU2V0dGluZ3MpOiBzdHJpbmcge1xuXHRpZiAoc2V0dGluZ3MuYXV0aG9yTW9kZSA9PT0gQ1VTVE9NX0FVVEhPUl9NT0RFKSB7XG5cdFx0cmV0dXJuIHNldHRpbmdzLmF1dGhvckN1c3RvbSA/PyBcIlwiO1xuXHR9XG5cdHJldHVybiBzZXR0aW5ncy5hdXRob3JNb2RlIHx8IHNldHRpbmdzLmF1dGhvck5hbWUgfHwgXCJcIjtcbn1cblxuZnVuY3Rpb24gbWFza0RldmljZVV1aWQodXVpZDogc3RyaW5nKTogc3RyaW5nIHtcblx0Y29uc3QgcGFydHMgPSB1dWlkLnNwbGl0KFwiLVwiKTtcblx0aWYgKHBhcnRzLmxlbmd0aCAhPT0gNSkge1xuXHRcdHJldHVybiB1dWlkO1xuXHR9XG5cblx0Y29uc3QgbGFzdCA9IHBhcnRzWzRdO1xuXHRyZXR1cm4gYCR7cGFydHNbMF19LSoqKiotKioqKi0qKioqLSoqKioqKioqJHtsYXN0LnNsaWNlKC00KX1gO1xufVxuXG5mdW5jdGlvbiBnZXRGcm9udG1hdHRlckZpZWxkQ2FuZGlkYXRlcyhhcHA6IEFwcCwgZmllbGQ6IEZvbGRlckRlZmF1bHRGaWVsZCk6IHN0cmluZ1tdIHtcblx0Y29uc3QgdmFsdWVzID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cdGZvciAoY29uc3QgZmlsZSBvZiBhcHAudmF1bHQuZ2V0TWFya2Rvd25GaWxlcygpKSB7XG5cdFx0Y29uc3QgdmFsdWUgPSBhcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoZmlsZSk/LmZyb250bWF0dGVyPy5bZmllbGRdO1xuXHRcdGZvciAoY29uc3QgaXRlbSBvZiBub3JtYWxpemVDYW5kaWRhdGVWYWx1ZXModmFsdWUpKSB7XG5cdFx0XHR2YWx1ZXMuYWRkKGl0ZW0pO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiBBcnJheS5mcm9tKHZhbHVlcykuc29ydCgoYSwgYikgPT4gYS5sb2NhbGVDb21wYXJlKGIpKTtcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplQ2FuZGlkYXRlVmFsdWVzKHZhbHVlOiB1bmtub3duKTogc3RyaW5nW10ge1xuXHRpZiAodHlwZW9mIHZhbHVlID09PSBcInN0cmluZ1wiKSB7XG5cdFx0Y29uc3QgdHJpbW1lZCA9IHZhbHVlLnRyaW0oKTtcblx0XHRyZXR1cm4gdHJpbW1lZCA/IFt0cmltbWVkXSA6IFtdO1xuXHR9XG5cdGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuXHRcdHJldHVybiB2YWx1ZS5mbGF0TWFwKChpdGVtKSA9PiBub3JtYWxpemVDYW5kaWRhdGVWYWx1ZXMoaXRlbSkpO1xuXHR9XG5cdGlmICh2YWx1ZSA9PT0gbnVsbCB8fCB2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0cmV0dXJuIFtdO1xuXHR9XG5cdHJldHVybiBbU3RyaW5nKHZhbHVlKV07XG59XG5cbmZ1bmN0aW9uIGdldEZpbGVGb2xkZXIocGF0aDogc3RyaW5nKTogc3RyaW5nIHtcblx0Y29uc3Qgc2xhc2ggPSBwYXRoLmxhc3RJbmRleE9mKFwiL1wiKTtcblx0cmV0dXJuIHNsYXNoID09PSAtMSA/IFwiXCIgOiBwYXRoLnNsaWNlKDAsIHNsYXNoKTtcbn1cblxuZnVuY3Rpb24gZm9sZGVyTWF0Y2hlcyhmaWxlRm9sZGVyOiBzdHJpbmcsIHJ1bGVGb2xkZXI6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRyZXR1cm4gcnVsZUZvbGRlciA9PT0gXCJcIiB8fCBmaWxlRm9sZGVyID09PSBydWxlRm9sZGVyIHx8IGZpbGVGb2xkZXIuc3RhcnRzV2l0aChgJHtydWxlRm9sZGVyfS9gKTtcbn1cblxuZnVuY3Rpb24gZ2V0Rm9sZGVyRGVwdGgoZm9sZGVyOiBzdHJpbmcpOiBudW1iZXIge1xuXHRyZXR1cm4gZm9sZGVyID09PSBcIlwiID8gMCA6IGZvbGRlci5zcGxpdChcIi9cIikubGVuZ3RoO1xufVxuXG5mdW5jdGlvbiB1cGRhdGVGcm9udG1hdHRlclVwZGF0ZWQoY29udGVudDogc3RyaW5nLCB1cGRhdGVkOiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcblx0aWYgKCFjb250ZW50LnN0YXJ0c1dpdGgoXCItLS1cXG5cIikpIHtcblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdGNvbnN0IGVuZCA9IGNvbnRlbnQuaW5kZXhPZihcIlxcbi0tLVwiLCA0KTtcblx0aWYgKGVuZCA9PT0gLTEpIHtcblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdGNvbnN0IGZyb250bWF0dGVyID0gY29udGVudC5zbGljZSgwLCBlbmQgKyAxKTtcblx0Y29uc3QgdXBkYXRlZExpbmUgPSAvXuacgOWQjuabtOaWsDpcXHMqLiokL207XG5cdGlmICghdXBkYXRlZExpbmUudGVzdChmcm9udG1hdHRlcikpIHtcblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdGNvbnN0IG5leHRGcm9udG1hdHRlciA9IGZyb250bWF0dGVyLnJlcGxhY2UodXBkYXRlZExpbmUsIGDmnIDlkI7mm7TmlrA6ICR7dXBkYXRlZH1gKTtcblx0cmV0dXJuIG5leHRGcm9udG1hdHRlciArIGNvbnRlbnQuc2xpY2UoZW5kICsgMSk7XG59XG5cbmZ1bmN0aW9uIGZvcm1hdExvY2FsRGF0ZShkYXRlOiBEYXRlKTogc3RyaW5nIHtcblx0Y29uc3QgeWVhciA9IGRhdGUuZ2V0RnVsbFllYXIoKTtcblx0Y29uc3QgbW9udGggPSBwYWQoZGF0ZS5nZXRNb250aCgpICsgMSk7XG5cdGNvbnN0IGRheSA9IHBhZChkYXRlLmdldERhdGUoKSk7XG5cdGNvbnN0IGhvdXIgPSBwYWQoZGF0ZS5nZXRIb3VycygpKTtcblx0Y29uc3QgbWludXRlID0gcGFkKGRhdGUuZ2V0TWludXRlcygpKTtcblx0Y29uc3Qgc2Vjb25kID0gcGFkKGRhdGUuZ2V0U2Vjb25kcygpKTtcblx0cmV0dXJuIGAke3llYXJ9LSR7bW9udGh9LSR7ZGF5fVQke2hvdXJ9OiR7bWludXRlfToke3NlY29uZH1gO1xufVxuXG5mdW5jdGlvbiBwYWQodmFsdWU6IG51bWJlcik6IHN0cmluZyB7XG5cdHJldHVybiB2YWx1ZS50b1N0cmluZygpLnBhZFN0YXJ0KDIsIFwiMFwiKTtcbn1cblxuZnVuY3Rpb24gZm9ybWF0WWFtbFNjYWxhcih2YWx1ZTogc3RyaW5nKTogc3RyaW5nIHtcblx0aWYgKCF2YWx1ZSkge1xuXHRcdHJldHVybiBcIlwiO1xuXHR9XG5cblx0cmV0dXJuIEpTT04uc3RyaW5naWZ5KHZhbHVlKTtcbn1cblxuZnVuY3Rpb24geWllbGRUb1VpKCk6IFByb21pc2U8dm9pZD4ge1xuXHRyZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcblx0XHR3aW5kb3cuc2V0VGltZW91dChyZXNvbHZlLCAwKTtcblx0fSk7XG59XG4iXX0=