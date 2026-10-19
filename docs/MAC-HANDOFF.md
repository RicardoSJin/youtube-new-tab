# Mac / ego-lite 接续开发

## 当前交接状态

- 项目：[RicardoSJin/youtube-new-tab](https://github.com/RicardoSJin/youtube-new-tab)，独立的 Manifest V3 扩展。
- 运行目录：仓库内 `extension/`，不需要编译。三个设置默认均开启，`active=true` 代表立即切换。
- 当前运行版本：1.0.0。47 项模拟 DOM / 扩展 API 测试已通过；完整真实浏览器验收仍待完成。
- 实际检查过 YouTube 搜索框、搜索结果、频道视频页、播放页推荐区、播放列表卡片。不能把 2026-10-18 的结构当作未来一直不变，改选择器前需在 Mac 再检查。
- Windows 上 2026-10-19 重试可列标签、创建标签并打开 YouTube，但读页面 DOM 仍超时。没有据此改扩展逻辑；不要继续把时间用于重现 Windows 连接问题。
- 本版 Shorts、`/live/…` 路由、搜索建议点击不在拦截范围。普通 `/watch?v=…` 视频为当前目标。
- 工作区和安装目录可能不同；必须验证 ego-lite 实际加载的目录、版本与本仓库代码一致。

## Mac 上准备项目

在希望保存代码的位置执行；若已有同名仓库，先读其 `git status` 和 remote，复用而不覆盖：

```bash
git clone https://github.com/RicardoSJin/youtube-new-tab.git
cd youtube-new-tab
npm ci --ignore-scripts
npm run check
npm test
```

要求 Node.js 24 或更新的受支持版本。测试依赖锁定在 package-lock.json；运行时不依赖 npm。生成包使用 `bash package.sh`，不必安装 PowerShell。

先读 `AGENTS.md`、`README.md`、`docs/DOM-CONTRACT.md` 和 `docs/VALIDATION.md`，再继续。开始修改前新建 `codex/ego-lite-e2e` 分支；若已存在或有未提交改动，先检查并延续，不能重置用户工作。

## ego-lite 的使用边界

1. 先读取当前机器的 ego-browser 技能。使用技能规定的 `ego-browser` CLI 和真实 TaskSpace，不自行猜 Playwright 接口、浏览器管理接口或隐藏扩展安装命令。
2. 当前目标只使用一个 TaskSpace。创建后记录 spaceId，后续继续该 space；页面卡住时不能另建空间掩盖问题。
3. **先确认该 TaskSpace 的真实浏览器已加载本扩展。**主窗口已安装不等于任务空间也安装。检查实际扩展管理界面、路径和版本；加载 unpacked 目录是 `extension/`。若工具无法操作扩展管理界面／目录选择器，按技能 handOff，让用户仅完成这一必要步骤。
4. 不用模拟 chrome API、临时注入 content.js、Console click 或替换导航函数冒充完整扩展测试。自动化测试可保留，但真实 E2E 必须通过加载后的扩展和真实鼠标／键盘操作完成。
5. 本扩展后台调用 `chrome.tabs.create`，新标签不一定产生 Page 的 `popup` 事件。使用技能里的 TaskSpace tabs API 检查整个空间中的新增标签和 active 状态；操作前记录基线，操作后确认恰好多一个标签、源页面未导航。
6. 新标签若未纳入管理，按技能的 adopt 流程后再操作。不要把用户原有页面当作可随意关闭的测试页；接管、登录、权限提示按现场技能处理。

## 真实验收重点

优先在 ego-lite 完成以下项目，并按实际可用浏览器补充 Chrome / Edge 结果，不把 ego-lite 的通过直接写成其他浏览器通过：

- 首页、搜索结果、频道视频页、订阅页、播放页推荐区，分别点击标题和封面。
- Enter 搜索与按钮搜索；窄窗口搜索入口只展开，不开页。
- 前台／后台各测试视频、Enter 搜索和按钮搜索，记录实际标签增量、激活标签及源 URL。
- 播放中的源视频执行操作，比较前后 currentTime、paused 和元素存续，不能只比较 URL 就说“播放状态保持”。
- YouTube 内部 SPA 导航后、滚动加载更多卡片后重复操作，无失效、无重复开页。
- 两个开关独立切换，关闭后恢复原生行为；Ctrl / ⌘ / Shift / 中键／右键菜单保持原生。
- 频道、列表卡片、操作菜单、稍后观看、广告观看按钮不误拦截；中文输入法 Enter 确认候选、空搜索不误开页。

每项记录版本、页面类别、操作、标签数量和焦点变化、源页面 URL／播放器状态、结果及必要截图。未登录导致订阅页不可验时标明受阻，不创建虚假记录。发现失败先收集最小 DOM／事件事实，定位缺陷后再改代码。

## 提交与发布

修改后运行静态检查、测试和 `bash package.sh`。运行时代码变动时递增 manifest 和 package.json 中的版本；仅文档改动不强行升版本。

提交到功能分支，建立 draft PR 交用户审阅，不擅自合并。按照用户已授权的插件调试发布规则，将验证后的对应提交打包发布带安装 ZIP 与 SHA256SUMS 的 GitHub Release；测试版本标记 prerelease，并明确还未验证的项目。版本、Git 标签、Release target 和包内 manifest 要一致。

## 可直接复制到 Mac 上 Agent 的提示词

```text
请继续开发这个已有项目，不要从零重写：
https://github.com/RicardoSJin/youtube-new-tab

目标：让 YouTube 像 B 站一样，普通左键点击视频标题／封面、顶部输入框按 Enter 或点击搜索按钮时，只新增一个标签页，保留源页面及播放状态；视频、搜索开关独立，支持立即切换／留在后台，默认均开启。

先按这台 Mac 的现有项目目录约定查找已有 checkout，检查 git status 和 remote；没有则在当前合适的工作目录 clone。读 AGENTS.md、README.md、docs/DOM-CONTRACT.md、docs/VALIDATION.md、docs/MAC-HANDOFF.md。然后读当前安装的 browser-plugin-builder 和 ego-browser 技能，按真实 ego-lite API 工作，不猜接口。

现状：v1.0.0 实现和 47 项模拟 DOM／扩展 API 测试已完成，真实 Chrome／Edge／ego-lite E2E 尚未完成。Windows 卡在浏览器内容读取连接，不代表扩展自身有已确认的运行故障。请优先在 Mac 的 ego-lite 补齐验收，保持最小修改，不为未复现的问题改选择器。

用一个 TaskSpace，记录 spaceId 并持续复用。先确认当前 TaskSpace 真实加载的是本仓库 extension/ 目录和正确版本；如果扩展安装界面或目录选择必须人工完成，只把这个具体步骤交给我。不能用主窗口已安装、临时注入脚本或 chrome API 模拟器冒充任务空间已加载的扩展。

先检查当前真实 YouTube DOM 和原生交互，再验证扩展。依次覆盖首页、搜索结果、频道页、订阅页、播放页推荐区的标题／封面；Enter／按钮搜索；前台／后台；开关关闭；SPA 导航后；无限滚动新卡片；⌘／Ctrl／Shift／中键／右键；频道、播放列表、菜单、稍后观看；中文输入法与空输入。

每次以 TaskSpace 的真实标签列表比较前后差异，确认只新增一个标签、实际 active 状态正确、源 URL 不变。tabs.create 不保证产生 opener 的 popup 事件，不要只等待 popup。视频播放保持需对比真实 currentTime、paused 和播放器是否仍在，不能仅据源 URL 判断。

注意已确认的边界：搜索执行按钮在 form 外；窄窗口的“展开搜索”按钮不等于执行搜索；播放列表卡片的标题与封面也可能使用 /watch?v=...&list=...，当前按 yt-collection-thumbnail-view-model 排除整张列表。优先维持 document_start 单次事件委托、每次操作一次创建；保留 storage 唯一权限，不增加外部服务或浏览日志。

遇到失败先收集最小 DOM／事件证据再修复，保留用户其他改动。无法验证的项目写清原因，别把模拟测试和真实浏览器结果混写。更新 DOM-CONTRACT.md 与 VALIDATION.md，记录版本、页面、标签增量、焦点、源播放器状态和必要截图。完成相应改动后运行 npm run check、npm test、bash package.sh。

在 codex/ego-lite-e2e 分支提交并推送，创建 draft PR 交我审阅，不自行合并。按我已授权的插件调试发布规则，验证后发布带可安装 ZIP 和校验文件的 GitHub 预发布版本，注明尚未验证的限制。最后给出具体通过／失败／受阻项目、修改点、PR 和下载链接。
```
