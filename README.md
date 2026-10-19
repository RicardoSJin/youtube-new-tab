# YouTube 新标签页 · Chrome / Edge Manifest V3

普通左键点击视频标题／封面，或使用顶部搜索框 Enter／搜索按钮时，新建标签页并保留原页面。

**当前版本：1.0.0。源码和可加载目录已完成；47 项模拟 DOM／扩展 API 自动化测试通过。已检查真实 YouTube DOM，尚未完成将扩展加载到 Chrome／Edge 后的端到端验收。具体范围见 [验证报告](docs/VALIDATION.md)。**

公开仓库：[RicardoSJin/youtube-new-tab](https://github.com/RicardoSJin/youtube-new-tab)。安装包见 [Releases](https://github.com/RicardoSJin/youtube-new-tab/releases)；当前调试包标记为预发布，插件下载器需要启用“包含预发布版本”。

在另一台 Mac 配合 ego-lite 继续开发，先阅读 [Mac 接续开发说明与可复制提示词](docs/MAC-HANDOFF.md)。

## 安装

1. Chrome 地址栏输入 `chrome://extensions`；Edge 输入 `edge://extensions`。
2. 打开“开发者模式”，点击“加载已解压的扩展程序”。
3. 选择本项目的 **extension 文件夹**（仓库根目录下）。

   若从 ZIP 安装，先解压 `dist/youtube-new-tab-v1.0.0.zip`，再选择里面直接包含 `manifest.json` 的目录。不要把 ZIP 拖入扩展页面。
4. **刷新已打开的 YouTube 页面一次**，使内容脚本生效。安装后新打开的页面会自动生效。
5. 固定扩展到工具栏，点击图标设置。也可从扩展详情页打开“扩展程序选项”。

## 设置与行为

- “视频在新标签页打开”：默认开启。
- “搜索在新标签页打开”：默认开启。
- “新标签页打开后”：默认“立即切换”，可改为“留在后台”。

设置自动保存在本浏览器的本地扩展存储，已打开页面通过存储事件自动更新；不需要刷新。禁用开关后相应操作由 YouTube 自己处理。

视频链接保留原有时间戳、播放列表上下文和其他参数。播放列表**卡片**、频道链接、广告观看按钮、菜单、稍后观看按钮保持原有行为。Shorts 和 `/live/…` 路由暂不拦截；指向普通 `/watch?v=…` 的直播视频卡片可按普通视频处理。

Ctrl / ⌘ / Shift / Alt、鼠标中键、右键菜单保持浏览器及 YouTube 的原生行为。窄窗口先点击“展开搜索框”的按钮也保持原有行为，只拦截真正执行搜索的按钮。

仅针对桌面站 `https://www.youtube.com/*`。不注入移动站、嵌入播放器或第三方网页。

## 验证状态与已知限制

- 已在真实网站检查：首页搜索框、搜索结果视频卡片、频道视频页、播放页推荐区、播放列表卡片。
- 已在真实网站执行原生 Enter 搜索和搜索按钮点击，确认原生行为在当前标签页导航。
- 47 项自动化测试执行实际 `content.js`、`background.js`、设置页脚本；DOM 使用实测结构精简片段，`chrome.*` API 为模拟实现。断言覆盖事件阻止、一次请求、前后台参数、设置持久化、重复注入及模拟 SPA 替换等。
- **尚未实测打包扩展在 Chrome／Edge 中的真实开页／焦点切换／原视频持续播放，以及登录账号下首页和订阅页的点击、无限滚动。不能把上述自动化测试当作这些端到端项目已通过。**
- 真实浏览器连接连续超时；内置浏览器可读 DOM，但当前工具未提供向其中加载本地 MV3 扩展的接口。
- 首次注入且本地设置尚未读完的短暂间隔内，保持原生导航；存储读取失败也保持原生行为，避免在已关闭功能时误拦截。
- 本版只为实测的新搜索框 `yt-searchbox` 和两种视频卡片结构编写规则。YouTube A/B 改版或旧搜索框若结构不同，会保留原生行为，需重新采集 DOM 后适配。
- 只处理顶部输入框 Enter 和执行搜索按钮；不扩展到搜索建议点击、语音搜索、历史搜索链接等额外交互。
- 创建标签页失败或扩展重载后旧内容脚本失效，会显示短提示，不自动重试、不回退为原页面跳转。请重载扩展并刷新 YouTube 后再试。
- 插件不主动暂停、播放或静音任何视频。实际后台播放还会受到浏览器省电／内存管理、YouTube 和其他插件影响。

## 结构

```text
extension/               可直接加载，运行时零依赖
  manifest.json          仅 storage 权限；document_start 注入
  shared.js              默认值、设置规范化、URL 校验
  content.js             窗口捕获阶段事件委托
  background.js          校验请求、读取设置、tabs.create
  settings.html/.css/.js  工具栏弹窗及独立选项页
  icons/                 本地生成图标
tests/                   基于实测 DOM 的自动化回归测试
scripts/                 静态校验、图标生成脚本
docs/DOM-CONTRACT.md      真实页面观察及实现依据
docs/VALIDATION.md        已验证范围、受阻项目及人工验收步骤
package.ps1              校验、测试及打包（PowerShell 7）
package.sh               macOS / Linux 校验、测试及打包
docs/MAC-HANDOFF.md       Mac / ego-lite 接续开发与提示词
```

## 本地开发与打包

运行时不需要 npm、服务器或外部服务。只有开发测试需要 Node.js 与开发依赖 jsdom。

```powershell
Set-Location .\youtube-new-tab
npm ci --ignore-scripts
npm run check
npm test
pwsh -NoProfile -File .\package.ps1
```

macOS（在准备保存项目的目录执行；已有仓库则直接进入并检查本地改动，不重复 clone）：

```bash
git clone https://github.com/RicardoSJin/youtube-new-tab.git
cd youtube-new-tab
npm ci --ignore-scripts
npm run check
npm test
```

需要生成安装包时，在仓库根目录执行 `bash package.sh`。要求 Node.js 24 或更新的受支持版本；脚本使用系统 `zip`，并自动运行校验和测试。

打包产物：`dist/youtube-new-tab-v1.0.0.zip`（根目录为 manifest，可解压加载）和 `dist/youtube-new-tab-source-v1.0.0.zip`（完整源码、测试与文档，不含 node_modules）。现有同名包会先改名归档，不直接删除。`-SkipTests` 仅供已完成测试后的重复打包使用。

扩展更新时，在扩展管理页点击“重新加载”，再刷新现有 YouTube 页面。删除扩展即可卸载，所有页面恢复原生导航。

## 权限与隐私

仅声明 `storage` 保存三个布尔设置。内容脚本仅匹配 `www.youtube.com`。没有 `tabs`、`history`、`scripting`、`webRequest`、`activeTab`、下载或外部主机权限。

后台只在收到操作请求时创建新标签页，不枚举其他标签、不读取浏览历史、不持久化标题／URL／搜索词，不发起网络请求、不包含远程代码。新标签页正常访问 YouTube 时，YouTube 自身仍按其网站规则接收请求。

Chrome 官方说明：[创建标签页不需要 tabs 权限](https://developer.chrome.com/docs/extensions/reference/api/tabs#permissions)；[声明式内容脚本](https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts)。详情见 [隐私说明](PRIVACY.md)。
