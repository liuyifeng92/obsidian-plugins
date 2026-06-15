# AGENTS.md

开发行为准则，用于减少 LLM 编码中的常见错误。可与项目特定指令合并使用。

**根据用户输入语言进行思考和输出。** 用户用中文提问则用中文回答和思考，用英文提问则用英文。代码注释语言跟随代码库现有风格。

**权衡原则：** 这些准则倾向于谨慎而非速度。对于简单任务，可自行判断。

## 1. 先想后写

**不要假设，不要隐藏困惑，主动暴露权衡。**

动手之前：
- 明确说出你的假设。不确定就问。
- 如果存在多种理解方式，列出来——不要默默选一个。
- 如果有更简单的方案，说出来。该反驳就反驳。
- 如果有不清楚的地方，停下来，说清楚哪里不清楚，然后问。

## 2. 简单优先

**用最少的代码解决问题，不写推测性代码。**

- 不做超出要求的功能。
- 单次使用的代码不做抽象。
- 没有被要求的「灵活性」「可配置性」不要加。
- 不为不可能的场景写错误处理。
- 如果你写了 200 行但 50 行就够，重写。

自问：「一个资深工程师会不会觉得这过于复杂了？」如果会，简化。

## 3. 精准修改

**只动必须动的部分，只清理自己制造的垃圾。**

修改已有代码时：
- 不要「顺手改进」旁边的代码、注释或格式。
- 不要重构没坏的东西。
- 匹配已有代码风格，即使你会用不同方式写。
- 如果发现不相关的死代码，提一嘴——不要删。

当你的修改产生了孤立代码时：
- 清理掉因你的改动而变得无用的 import / 变量 / 函数。
- 不要清理改动之前就存在的死代码，除非被要求。

检验标准：每一行变更都应该能直接追溯到用户的需求。

## 4. 目标驱动执行

**定义成功标准，循环直到验证通过。**

把任务转化为可验证的目标：
- 「加个校验」→「为无效输入写测试，然后让测试通过」
- 「修这个 bug」→「写一个能复现的测试，然后让测试通过」
- 「重构 X」→「确保重构前后测试都通过」

多步骤任务先列计划：
1. [步骤] → 验证：[检查方式]
2. [步骤] → 验证：[检查方式]
3. [步骤] → 验证：[检查方式]

## 5. Git 纪律

**默认不执行任何 git 操作，除非 prompt 中明确要求。**

- 不要自动 `git add`、`git commit`、`git push`。
- 用户说「提交」才执行 `git add . && git commit`。
- 用户说「推送到 GitHub」才执行 `git push`。
- 构建和部署 ≠ 提交。`pnpm build` 和 `deploy.sh` 不应触发 git 操作。
- 本地 commit 时默认递增三级版本号（如 1.2.3 → 1.2.4）。
- 三级版本号不限于 9，可以是 1.2.10、1.2.101 等。
- 推送到远端前，必须询问用户是否需要升级到二级（如 1.3.0）或一级（如 2.0.0）版本号。

## 6. data.json 是用户数据，绝对不能碰

- `data.json` 存储用户个人设置（API key、设备绑定、文件夹规则等），每台设备不同。
- 构建、部署、清理、git 操作中绝不覆盖、删除或修改 `data.json`。
- `.gitignore` 已忽略 `data.json`，不要把它加回 git。

## 7. Obsidian 插件开发注意事项

**插件重载（OTA 更新后）：**
- `disablePlugin` + `enablePlugin` 不会重新从磁盘读取 JS 文件，不能用于 OTA 重载。
- 正确方式：`unloadPlugin` → `delete app.plugins.manifests[id]` → `loadManifests()` → `loadPlugin` → `enablePlugin`。
- 重载逻辑必须用 `window.setTimeout` 脱离当前插件生命周期执行（当前实例会被 unload 销毁）。
- 把 `app` 引用提前存到局部变量，不依赖 `this`。

**DOM 操作：**
- Obsidian 属性面板在文件切换时会重建 DOM，插件挂载的按钮/样式需要重新添加。
- `vault.modify()` 写入文件后属性面板会重渲染，不要立即操作 DOM，延迟 1 秒后再添加自定义元素。
- 编辑模式下 CodeMirror 6 会拦截原生 Drag and Drop 事件，需要用 mousedown/mousemove/mouseup 手动实现拖拽。

**GitHub API：**
- 不要使用 `api.github.com`（匿名限 60 次/小时），使用 `raw.githubusercontent.com` 直接获取文件。

## 构建与部署

**Mono-repo 结构：**
obsidian插件/
├── auto-frontmatter/        # 文档属性管理插件
├── file-auto-upload-plugin/ # 文件自动上传插件
├── homepage-dashboard/      # 首页仪表盘插件
├── deploy.sh                # 一键构建部署脚本
├── AGENTS.md
├── README.md
└── .gitignore

**构建：** 进入对应插件目录执行 `pnpm install && pnpm build`。

**部署到本地 vault 测试：**
- `./deploy.sh auto` — 只部署 auto-frontmatter
- `./deploy.sh upload` — 只部署 file-auto-upload-plugin
- `./deploy.sh dashboard` — 只部署 homepage-dashboard
- `./deploy.sh` — 部署全部

**Vault 插件目录映射：**
- `auto-frontmatter` → `FutureLAB/.obsidian/plugins/auto-frontmatter/`
- `file-auto-upload-plugin` → `FutureLAB/.obsidian/plugins/obsidian-image-auto-upload-plugin/`
- `homepage-dashboard` → `FutureLAB/.obsidian/plugins/homepage-dashboard/`

**部署只复制：** `main.js`、`manifest.json`、`styles.css`。绝不复制 `data.json`。

**OTA 更新地址（GitHub raw）：**
https://raw.githubusercontent.com/liuyifeng92/obsidian-plugins/main/{插件目录名}/main.js
https://raw.githubusercontent.com/liuyifeng92/obsidian-plugins/main/{插件目录名}/manifest.json
https://raw.githubusercontent.com/liuyifeng92/obsidian-plugins/main/{插件目录名}/styles.css

**构建产物 `main.js` 必须提交到 git**（不在 .gitignore 中忽略），OTA 更新依赖从 GitHub 下载 main.js。

**版本号工作流：**
1. 改代码
2. `pnpm build`
3. `./deploy.sh {插件}` 部署到本地测试
4. 测试通过后 `git add . && git commit -m "描述"`（提交代码改动）
5. 递增三级版本号并自动打 tag：`npm version patch`（会自动更新 `package.json`、`manifest.json`、`versions.json`，并生成 commit + tag，如 `v1.0.1`）
6. 推送前询问用户是否需要升级二级或一级版本号
7. 确认后 `git push && git push --tags`，远端版本号即为 OTA 可检测的最新版本