# 实测 DOM 契约

采集日期：2026-10-18（Asia/Shanghai）。环境：此任务内置浏览器，未登录 YouTube；窗口为 398 × 698 CSS 像素。实际读取 DOM，而非根据网站印象构造选择器。下列片段只保留相关结构，不保存完整页面／账号信息。

## 顶部搜索

首页 `/` 真实结构：

```html
<ytd-masthead>
  <yt-searchbox role="search">
    <div><div><div>
      <form action="/results" class="ytSearchboxComponentSearchForm">
        <input name="search_query" type="text" role="combobox" placeholder="搜索">
      </form>
    </div>
    <button aria-label="Search" title="搜索" class="ytSearchboxComponentSearchButton">…</button>
    </div></div>
  </yt-searchbox>
</ytd-masthead>
```

- 执行搜索按钮在 form 外，不能只依赖 submit。实现使用 `yt-searchbox` 范围和 `button[aria-label="Search"][title]`；不依赖 SVG 或生成类名。
- 只接受顶部 `ytd-masthead` 中的输入框，确认所属 form 的 action 为 `/results`。
- 窄窗口隐藏输入框，另有 `button[aria-label="搜索"]` 用于展开搜索；实测点击展开后输入框可见。此按钮不属于执行搜索按钮，不拦截。
- 还存在 `button[aria-label="清空搜索查询"]`、语音搜索按钮及建议列表；不按执行搜索处理。
- 实际输入 `nature 8k` 并按 Enter 后，读到 `/results` 和 `search_query=nature 8k`；点击执行搜索按钮后仍为该搜索目标。此处未加载本扩展，是原生行为检查。
- 搜索结果和播放页中再次检查到相同 `yt-searchbox` 与按钮语义。

## 搜索结果普通视频

真实访问：`/results?search_query=nature+4k`，当时有 19 个 `ytd-video-renderer`。

```html
<ytd-video-renderer>
  <div><ytd-thumbnail>
    <a id="thumbnail" href="/watch?v=UV0mhY2Dxr0&amp;pp=…"><yt-image><img …></yt-image>…</a>
  </ytd-thumbnail></div>
  …<h3><a id="video-title" href="/watch?v=UV0mhY2Dxr0&amp;pp=…">
    <yt-formatted-string>Nature Relaxation Film 4K …</yt-formatted-string>
  </a></h3>
  …<button aria-label="操作菜单">…</button>
</ytd-video-renderer>
```

实现检查标题 ID 或封面锚点与 `ytd-thumbnail` 的直接父子关系，再校验精确 YouTube 域名、`/watch` 和 11 位视频 ID。动态添加节点由相同的窗口委托处理。

广告中另有 `ad-button-view-model > a[href="/watch?v=1LVm1koF-pk"][aria-label="观看"]`。这证明“拦截所有 /watch 链接”会扩大范围；该广告按钮不满足标题／封面契约，保持原生。

## 频道视频页与播放页推荐区

真实访问 `/@8kEarth/videos` 和 `/watch?v=015eDw5i6P8`。推荐区位于 `#related`，两处均读到以下结构：

```html
<yt-lockup-view-model>
  <div><a href="/watch?v=015eDw5i6P8" class="ytLockupViewModelContentImage">
    <yt-thumbnail-view-model>…</yt-thumbnail-view-model>
  </a></div>
  <yt-lockup-metadata-view-model><div><h3>
    <a href="/watch?v=015eDw5i6P8" class="ytLockupMetadataViewModelTitle"><span>…</span></a>
  </h3></div></yt-lockup-metadata-view-model>
</yt-lockup-view-model>
```

用组件标签和语义 h3 关系判断，不依赖上述 CSS 类名。播放页播放器实际存在，但采集时处于 paused 状态，不能由此宣称已验证持续播放。

## 播放列表边界

真实访问 `/results?search_query=nature+playlist`，发现列表标题和封面同样使用 `/watch?v=D8uGCdzHCsY&list=PLeCPQtbuJaPtLugP7UijMU-ozdNmkdNFO`，**不能只通过 URL 区分列表与视频**。

```html
<yt-lockup-view-model>
  <div><a href="/watch?v=D8uGCdzHCsY&amp;list=…">
    <yt-collection-thumbnail-view-model>
      <yt-collections-stack>…<yt-thumbnail-view-model>…</yt-thumbnail-view-model></yt-collections-stack>
    </yt-collection-thumbnail-view-model>
  </a></div>
  …<h3><a href="/watch?v=D8uGCdzHCsY&amp;list=…">Best Nature Documentaries</a></h3>
  …<a href="/playlist?list=…">查看完整播放列表</a>
</yt-lockup-view-model>
```

因此先检查整个 lockup 是否包含 `yt-collection-thumbnail-view-model`，若有则整张列表卡片保持原生；普通视频的 list 参数不删除。

## 生命周期设计及证据边界

在 document_start 只安装一套 window 捕获阶段监听。每次事件读取 composedPath、当前节点和当前输入值，不长期缓存 YouTube DOM，不修改 history、不轮询、不逐项绑定，无需在 SPA 切换后重复初始化。隔离世界的初始化标记避免重复安装。

已读取多路由下的实际结构；完整扩展在真实 SPA 导航后的开页行为尚未验收。首页未登录状态没有推荐卡片；订阅页需登录，未读取其卡片。它们若复用已观察到的结构可由同一规则处理，但当前属于待实机验收，不能宣称已验证。
