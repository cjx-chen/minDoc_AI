# 知识库「网页收集」功能调研与方案设计

> 目标：在 MinDoc_AI 知识库中新增一个**卡片式网页收集整理**功能——入口位于顶部菜单栏「AI 问答」旁边。粘贴外部网页地址后自动捕获页面信息（标题、描述、图标、封面图、正文快照），生成可编辑的卡片；支持标签、笔记、置顶等整理操作；点击卡片跳转到原网页。
>
> **与 AI 问答无任何关联**：本功能是独立的链接收集整理模块，仅复用「入口并列放置」这一布局关系。
>
> 本文分三部分：开源工程调研 → 方案对比与选型 → 面向 MinDoc_AI 的落地方案（含已实现代码说明）。

---

## 一、需求解读（经多轮澄清后的最终口径）

| # | 能力 | 说明 |
|---|------|------|
| 1 | 卡片收集 | 以卡片形式收集**其他网页**的地址与信息，而非当前站内页面 |
| 2 | 自动捕获 | 添加时服务端自动抓取目标页：标题 / 描述 / 图标 / 封面图（og:image）/ 站点名 / **正文快照** |
| 3 | 整理编辑 | 卡片**可编辑**（标题/描述/地址/标签/笔记/置顶），支持标签筛选、搜索、库内阅读正文 |
| 4 | 点击跳转 | 点击卡片在新标签页打开原网页 |
| 5 | 入口位置 | 顶部菜单栏「AI 问答」旁边新增「网页收集」；文档阅读页「AI问答」按钮旁同样加入口 |

「页面状态」的两种实现路线：

- **路线甲（服务端捕获）**：用户提交 URL，服务端抓取并解析页面。代表：Linkwarden、Karakeep、ArchiveBox、Wallabag。**本项目采用此路线**。
- **路线乙（浏览器插件捕获）**：浏览器扩展直接捕获当前页（含选区、滚动位置、登录态页面）。代表：Obsidian Web Clipper、SingleFile、Karakeep 扩展。作为后续迭代可选。

---

## 二、开源工程调研

以下项目信息均于 2026-10-27 通过 GitHub API 实测核实（star / 语言 /  License）。

### 2.1 综合类（链接管理 + 自动捕获，最贴近需求）

#### Linkwarden ⭐ 20,232 · TypeScript · AGPL-3.0
- 定位：自托管协作书签管理器，"collect, read, annotate, and fully preserve"。
- 架构：Next.js monorepo（`apps/web` + `apps/worker` + `apps/extension` + `packages/lib`）。
- 捕获管线（`apps/worker/lib/preservationScheme/`，已读源码）：
  - `handleReadability.ts`：`@mozilla/readability` + `jsdom` + `DOMPurify` 清洗，提取正文 JSON + 截断文本，限制 buffer 大小；
  - `handleScreenshotAndPdf.ts`：Playwright 驱动，先 `page.evaluate(autoScroll)` 自动滚动触发懒加载，再 `fullPage` 截图（jpeg）和 `page.pdf()`；
  - `handleArchivePreview.ts`：优先取 `og:image` 生成预览图，失败回退首屏截图，`generatePreview.ts` 用 Jimp 压缩到 1000px；
  - `packages/lib/ssrf.ts` + `safeFetch.ts`：**SSRF 防护**（DNS 解析后校验 IP，封禁 localhost/内网/链路本地等 CIDR），抓取 og:image 前也走安全 fetch。
- 浏览器扩展（`apps/extension`）：MV3，弹窗内编辑标题/标签，`screenshot.ts` 用 `chrome.tabs.captureVisibleTab` 分段截图再 canvas 拼接长图。
- **借鉴点**：四层捕获策略（元信息 → 正文 → 截图/PDF → 预览图）、SSRF 白名单、buffer 上限、扩展与 Web 端同构。

#### Karakeep（原 Hoarder）⭐ 30,090 · TypeScript · AGPL-3.0
- 定位：自托管 "bookmark-everything" 应用，AI 自动打标 + 全文搜索。
- 架构：monorepo（`apps/web` Next.js + `apps/workers` + `apps/browser-extension` + `packages/*`）。
- 捕获管线（`apps/workers/workers/crawlerWorker.ts`，已读源码）：
  1. 抓取前：域名级限流、URL 校验（`validateUrl`）、探测决定「资产型（pdf/图片）」还是「网页型」；
  2. 网页型：用 **patchright**（Playwright 的防检测 fork，不启用 CDP Runtime domain）渲染页面，子进程解析，存元数据 / 正文 / 资产；
  3. **全页 archive 放在最后执行**（注释明言 "the most failure-prone"）；
  4. 抓取后：入队 AI 推理（打标/摘要）、搜索索引、webhook。
- 工具函数（`crawlerUtils.ts`）：URL 脱敏（redact token）、Content-Type 归一化、403/429/5xx 重试、UA 伪装（去掉 HeadlessChrome 标记）。
- 浏览器扩展：popup 直接保存当前页（含选中文本）。
- **借鉴点**：抓取任务队列化 + 失败降级顺序、域名限流、UA/重试策略、抓取产物结构化存储（本功能的标签/正文快照思路同源）。

#### ArchiveBox ⭐ 28,893 · Python · MIT
- 定位：自托管网页归档，存 HTML/JS/PDF/媒体/WARC。
- 特点：多归档器（warc、pdf、screenshot、media、git、headers…），依赖 Chrome headless；有浏览器扩展与 CLI。
- **借鉴点**：「多份归档产物」理念（WARC/PDF/截图/媒体），适合做长期防丢归档；对轻量场景过重。

#### Wallabag ⭐ 13,031 · PHP · MIT
- 定位：read-it-later，readability 正文提取 + 离线阅读 + 标签分类。
- **借鉴点**：正文提取 + 阅读体验（排版、字体、深色模式）的产品形态。

#### Shiori ⭐ 11,688 · Go · MIT
- 定位：**Go 编写的简单书签管理器**（与 MinDoc 同语言）。
- 特点：beego 风格命令行 + web UI，bookmark 增删、导入导出、离线归档（`archive` 子命令用 wget）。
- **借鉴点**：Go 技术栈下的最小书签模型参考；但架构较老，仅作数据结构参考。

### 2.2 浏览器扩展类（捕获「当前正在看的页面」，含选区/滚动/登录态）

#### Obsidian Web Clipper ⭐ 5,402 · TypeScript · MIT
- Obsidian 官方扩展：变量系统（`{{title}}`、`{{url}}`、`{{content}}`、`{{selection}}`、`{{scrollY}}`…）+ 过滤器 + 模板，把网页转 Markdown 存入笔记库；内置 defuddle（readability 提取）。
- **借鉴点**：「变量 + 过滤器 + 模板」三件套是捕获页面状态的经典抽象；扩展侧只需把 `{{selection}}`、`{{scrollY}}` 等随 URL 一起 POST 给服务端。

#### SingleFile ⭐ 22,742 · JavaScript · AGPL-3.0
- 定位：把完整网页（含资源）存成单个自包含 HTML。
- **借鉴点**：`captureVisibleTab` + 资源内联的「忠实快照」技术，适合做「离线可用」的链接预览（配合 sandbox iframe 渲染）。

### 2.3 抓取/解析库与服务（可直接集成）

| 项目 | star | 语言/License | 用途 |
|---|---|---|---|
| [metascraper](https://github.com/microlinkhq/metascraper) | 2,750 | JS/HTML · MIT | 元数据抓取事实标准：Open Graph、JSON-LD、meta、智能回退，规则可组合 |
| [microlink SDK](https://github.com/microlinkhq/sdk) | 624 | MIT | "Make any URL embeddable"，浏览器渲染级 link preview API |
| [go-readability](https://github.com/go-shiori/go-readability) | 940 | Go · MIT | Go 版 Readability 正文提取（Go 服务端首选） |
| [goquery](https://github.com/PuerkitoBio/goquery) | 14,992 | Go · BSD-3 | **本项目已直接依赖**（go.mod v1.10.2），解析 og/meta 无需新增依赖 |
| [chromedp](https://github.com/chromedp/chromedp) | 13,340 | Go · MIT | Go 驱动 Chrome DevTools Protocol，可做截图/PDF/渲染态捕获 |
| [go-rod](https://github.com/go-rod/rod) | 7,135 | Go · MIT | 同类 CDP 驱动，API 更现代 |
| [iframe-resizer](https://github.com/davidjbradshaw/iframe-resizer) | — | JS · MIT | iframe 嵌入时自动高度/同源 postMessage 通信（本项目 AI 问答弹框已在用 iframe 模式） |

> 另可关注 `r.jina.ai`（Reader 服务，把任意 URL 转 Markdown，适合作为无浏览器的兜底抓取通道）与 Iframely（商业 link embed 服务）。

---

## 三、方案对比与选型

| 维度 | 方案 A：纯元信息捕获 | 方案 B：元信息 + 正文快照（**已实现**） | 方案 C：B + 截图/PDF + 浏览器扩展 |
|---|---|---|---|
| 捕获内容 | title/desc/favicon/og:image/site_name | + readability 正文快照（库内阅读 + 关键字搜索） | + 整页截图、PDF、当前选区/滚动位置 |
| 技术成本 | 低（goquery + 安全 fetch，**零新依赖**） | 中（新增 go-readability 依赖） | 高（chromedp/Playwright + Chrome 依赖 + 扩展工程） |
| 离线可用性 | 否 | 正文可离线 | 完全离线（单 HTML/截图） |
| 参考对象 | metascraper / Linkwarden 元信息层 | Wallabag / Linkwarden readability 层 | Linkwarden 全量 / ArchiveBox / SingleFile |
| 适配 MinDoc_AI | ✅ 当天可上线 | ✅ 已落地 | 建议作为后续迭代 |

**推荐路径：A → B → C 渐进落地**，理由：

1. 正文快照让「收集」真正成立——卡片不只存一个地址，还保存了可随时在库内阅读、可被关键字搜索命中的页面内容；
2. 截图/PDF 需要 Chrome 运行时，对部署环境有额外要求，放最后并按配置开关；
3. 浏览器扩展是独立工程，可作为「增强捕获」（选区、滚动位置、登录态页面）后续单独做。

---

## 四、面向 MinDoc_AI 的落地方案

### 4.1 总体架构

```
浏览器                           Go 服务端 (beego)
┌─────────────────┐   POST /api/links/preview   ┌──────────────────────────┐
│ 链接库页面        │ ───────────────────────────▶ │ LinkController           │
│ views/link/*.tpl │ ◀─────────────────────────── │  ├ captureLinkPreview()  │
│                 │   {title,desc,icon,image}   │  │  ├ safeFetch(SSRF 防护) │
│ 粘贴 URL         │                              │  │  └ goquery 解析 og/meta │
│     ↓           │   POST /api/links/add        │  └ models.WebLink (MySQL)│
│ 卡片预览+确认     │ ───────────────────────────▶ │      md_web_links 表     │
│     ↓           │   GET  /api/links/lists      │                          │
│ 卡片网格(新标签跳转)│ ◀─────────────────────────── │                          │
└─────────────────┘                              └──────────────────────────┘
```

### 4.2 数据模型（`models/WebLink.go`）

`md_web_links` 表（前缀与现有模型一致，走 `conf.GetDatabasePrefix()`）：

| 字段 | 类型 | 说明 |
|---|---|---|
| link_id | int pk auto | 主键 |
| book_id | int index | 归属项目（0 = 全局） |
| url | text | 目标地址 |
| url_md5 | char(32) | url 的 md5，与 book_id 组成唯一索引（跨库去重） |
| title | varchar(500) | 捕获的标题（可编辑） |
| description | varchar(2000) | 捕获的描述（可编辑） |
| icon_url / image_url | varchar(1000) | favicon / og:image |
| site_name | varchar(255) | 站点名 |
| link_type | varchar(32) | `external`（预留 `screenshot`/`pdf`/`archive`） |
| content | text | **正文快照**（readability 提取，库内阅读） |
| tags | varchar(500) | 标签（逗号分隔，可编辑） |
| note | text | 用户笔记（可编辑） |
| pinned | int index | 置顶（0/1） |
| word_count | int | 正文字数 |
| sort / status | int | 排序权重 / 0 正常 1 隐藏 |
| created_by / created_by_name | int / varchar | 创建者 |
| create_time / modify_time | datetime | 时间戳 |

建表用 `CREATE TABLE IF NOT EXISTS`（按数据库适配器选择 MySQL/SQLite 方言，失败自动回退），新增列通过幂等 `ALTER TABLE` 升级；模型需在 `commands.RegisterModel()` 注册（beego ORM 要求）。

### 4.3 捕获服务（`controllers/LinkController.go`）

`captureLinkPreview(rawURL)` 流程（借鉴 Linkwarden `ssrf.ts` + metascraper 规则优先级）：

1. **URL 校验**：仅允许 http/https；禁止 localhost / `.local` / `.internal` / 私网 / 链路本地 / CGNAT 等 CIDR（IPv4+IPv6），**先 DNS 解析再校验 IP**，防 DNS rebinding 的基础版；
2. **安全 fetch**：超时（默认 8s）、最大 2MB、最多 5 次跳转、固定 UA、只读 `GET`、重定向目标同样校验；
3. **元信息解析**（goquery，优先级同 metascraper）：
   - 标题：`og:title` → `twitter:title` → `<title>` → URL host
   - 描述：`og:description` → `twitter:description` → `meta[name=description]`
   - 图标：`link[rel="apple-touch-icon"]` → `link[rel="icon"]` → `link[rel="shortcut icon"]` → `favicon.ico` 约定路径
   - 封面图：`og:image` → `twitter:image` → `twitter:image:src`
   - 站点名：`og:site_name`；相对地址一律补全为绝对地址；
4. **正文快照**（go-readability）：提取正文 HTML → 去标签转纯文本 → 压缩空行 → 按 `web_link_content_max_bytes`（默认 256KB）截断；
5. 返回标准化 JSON；失败时返回降级结果（host 作为标题），保证前端可用。

**v2 优化（对齐开源实现，2026-10-28）**：

| 优化项 | 借鉴对象 | 说明 |
|---|---|---|
| 元数据规则链扩展 | metascraper | 标题增加 JSON-LD headline/.post-title/.entry-title/h1[class*=title] 兜底；描述增加 meta[itemprop]/JSON-LD description/articleBody；图片增加 og:image:secure_url/og:image:url/itemprop/JSON-LD image/**正文首图**（无 og:image 的内容页也有真实封面） |
| JSON-LD 解析 | metascraper `$jsonld` | 解析 `<script type="application/ld+json">`，支持 @graph/数组根/嵌套路径（author.name、image.url） |
| 作者 / 发布时间 | metascraper author/date | JSON-LD author.name → meta[author] → article:author → a[rel=author]；JSON-LD datePublished → meta[property*=published_time] → time[datetime]；多格式日期解析 |
| favicon 选优 | metascraper-logo-favicon | 按 `尺寸 × 类型权重`（apple/android 5 > png 5 > jpg 4 > svg 3 > ico 2）选最佳图标，而非取第一个 |
| URL 规范化 | Karakeep/Linkwarden | 去 utm_*/gclid/fbclid/spm 等 20+ 跟踪参数、小写主机名、去默认端口（**保留 fragment** 供 SPA 跳转）；规范化后再去重，`?utm_source=x` 与干净 URL 判为同一卡片 |
| 浏览器特征 UA + Accept-Language | Karakeep `normalizeBrowserUserAgent` | 放弃 bot 特征 UA，降低被站点拒绝的概率；带中文 Accept-Language |
| 429/5xx 重试 | Karakeep `shouldRetryCrawlStatusCode` | 抓取遇 429/5xx 自动重试一次（间隔 400ms） |
| 捕获缓存 | — | 进程内 60s TTL 缓存，避免「预览→收集」对同一 URL 重复抓取 |
| readability 阈值调优 | go-readability Parser | `CharThresholds` 默认 500 对中文短文偏高，降至 150（可配置）提高提取率 |
| 正文兜底 | — | readability 无结果时回退：描述 → 页面可见文本前 500 字（已剔除 script/style） |
| fake-ip 代理适配 | — | `198.18.0.0/15`（Clash/Surge fake-ip 段）识别为代理假 IP 放行，修复「开着代理所有公网网址被误拦」 |
| canonical URL | metascraper-url | `og:url → twitter:url → link[rel=canonical] → link[rel=alternate][hreflang=x-default]`；仅接受同主机地址（防跨站劫持），归一后再去重——「别名页?utm=x」与「真实页」判为同一张卡片 |
| 站点名兜底链 | metascraper-publisher | `og:site_name → JSON-LD publisher.name → application-name/app_name → 标题后缀提取（"文章 - 知乎"→"知乎"）→ hostname` |
| 语言捕获 | metascraper-lang | `og:locale → meta[itemprop=inLanguage] → <html lang>`，标准化为 zh-CN 形式 |
| 品牌 logo 兜底 | metascraper-logo | favicon 选优无结果时：`og:logo → meta[itemprop=logo] → img[itemprop=logo] → JSON-LD 方形 logo（organization/publisher/brand 等）` |

### 4.4 API 设计

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/links` | 网页收集页面（`LinkController.LinkPage`，渲染 `views/link/index.tpl`） |
| POST | `/api/links/preview` | 输入 URL，返回捕获结果（元信息 + 正文快照，不落库，供前端卡片预览） |
| POST | `/api/links/add` | 捕获 + 落库（支持 `tags` 标签、`note` 笔记；`book_id` 可选，默认 0 全局） |
| POST | `/api/links/edit` | 编辑卡片（标题/描述/地址/标签/笔记/置顶；**地址变更时自动重新捕获**） |
| GET | `/api/links/detail` | 卡片详情（含正文快照，供库内阅读） |
| POST | `/api/links/pin` | 置顶 / 取消置顶 |
| POST | `/api/links/recapture` | 重新捕获页面信息与正文（保留标签/笔记/置顶） |
| GET | `/api/links/lists` | 列表（按 `book_id` 过滤 + 关键字[标题/描述/网址/标签/笔记] + 返回全部标签） |
| POST | `/api/links/delete` | 删除 |

登录/匿名策略与 `AiController` 一致：非匿名站点要求登录。

### 4.5 前端与入口

- **新页面** `views/link/index.tpl`（standalone + embedded 双模式）：
  - 收集区：URL 输入框，粘贴合法 URL 自动捕获（防抖 700ms）→ 展示捕获卡片（favicon、标题、描述、封面图、站点名、正文字数 badge）→ 可填标签/笔记 → 「收集到卡片」；
  - 标签筛选条：服务端汇总的标签 chips，点击即筛；
  - 卡片网格：封面 / favicon + 标题 / 描述 / 标签 / 域名 + 正文字数；置顶与笔记角标；**整卡点击 `target=_blank` 跳转原网页**；悬停操作：详情 / 编辑 / 置顶 / 删除；
  - 详情弹框：完整元信息 + **正文快照阅读**（等宽预格式化、可滚动）+ 我的笔记 + 「打开原网页 / 重新捕获 / 编辑」；
  - 编辑弹框：地址（变更时提示将重新捕获）、标题、描述、标签、笔记、置顶开关。
- **入口 1（顶部菜单栏）** `views/widgets/header.tpl`：「AI 问答」旁新增「网页收集」（桌面导航 + 移动端下拉 + 未登录右侧，三处）。
- **入口 2（文档阅读页）** `views/document/default_read.tpl`、`cherry_read.tpl`：「AI问答」按钮旁新增「网页收集」按钮，点击弹出 modal，内嵌 iframe 指向 `/links?embedded=1&book_id=...`（懒加载 data-src）。

### 4.6 配置项（`conf/app.conf` / `app.conf.example`）

```ini
# 网页收集：卡片式收藏外部网页并自动捕获页面信息
enable_web_links="${MINDOC_ENABLE_WEB_LINKS||true}"   # 功能开关
web_link_fetch_timeout="8"          # 抓取超时（秒）
web_link_fetch_max_bytes="2097152"  # 抓取上限 2MB
web_link_fetch_max_redirects="5"    # 最大跳转
web_link_capture_content="true"     # 是否捕获正文快照（仅用于库内阅读，与 AI 问答无关）
web_link_content_max_bytes="262144" # 正文快照上限 256KB
#web_link_allow_private="false"     # 允许抓取内网地址（SSRF 风险，默认关闭，仅内网部署开启）
```

### 4.7 安全要点（照搬 Linkwarden 的教训）

1. **SSRF**：内网 IP 段黑名单（IPv4/IPv6 CIDR）+ 主机名黑名单 + DNS 解析后校验 + 禁止非 http(s) 协议 + 禁止 URL 携带凭证（`user:pass@`）+ 重定向目标同样校验；**例外**：`198.18.0.0/15`（RFC 2544）是 Clash/Surge 等代理工具 fake-ip 模式的假 IP 段——公网真实主机不会使用、该段公网不可路由，域名解析到该段时放行由本地透明代理转发（否则开着此类代理的机器上所有公网网址都会被误拦）；如需抓取真实内网地址（10.x/192.168.x），显式开启 `web_link_allow_private=true`；
2. **XSS**：前端渲染全部走 `text()`/`createTextNode`，不做 HTML 拼接；封面图/图标带 `referrerpolicy="no-referrer"`；
3. **跳转安全**：一律 `target="_blank" rel="noopener noreferrer"`，不做服务端 302 中转；
4. **资源耗尽**：抓取超时、大小上限、跳转上限、正文快照上限；
5. **数据长度**：入库前按列宽截断（标题 500 / 描述 2000 / 标签 500 / 笔记 8000），防 MySQL 严格模式插入失败。

### 4.8 已实现的功能（本次代码改动）

| 文件 | 改动 |
|---|---|
| `models/WebLink.go` | `WebLink` 模型（url/title/description/icon/image/site_name/**content 正文快照**/**tags 标签**/**note 笔记**/**pinned 置顶**/word_count/sort/status/创建者/时间戳）+ `EnsureWebLinkTable`（按适配器生成 MySQL/SQLite DDL，失败自动回退另一种方言）+ `ensureWebLinkColumns` 幂等列升级 + Find/FindByURL/Insert/Update/Delete/分页查询（置顶优先排序）/FindTags 标签汇总 + 标签标准化工具 |
| `controllers/LinkController.go` | 9 个接口（Page/Preview/Add/Edit/Detail/Pin/Recapture/Lists/Delete）+ `captureLinkPreview` 安全抓取（SSRF 防护、超时、大小/跳转限制、og/meta 解析、**go-readability 正文提取**）+ `parsePageMetadata` / `extractPageContent` 可单测函数 |
| `controllers/LinkController_test.go` | 10 个单元测试（元数据优先级/回退/兜底、正文提取含噪声剔除、IP 黑名单矩阵、URL 校验、相对地址补全、截断） |
| `commands/command.go` | `RegisterModel()` 注册 `models.WebLink`（beego ORM 必需，否则 QueryTable 报 table not exists） |
| `routers/router.go` | 注册 9 条路由 |
| `views/link/index.tpl` | 新增：网页收集页面（捕获卡片、标签筛选、卡片网格、详情阅读、编辑弹框、搜索） |
| `views/widgets/header.tpl` | 菜单栏「AI 问答」旁新增「网页收集」（桌面导航 + 移动端下拉 + 未登录右侧） |
| `views/document/default_read.tpl`、`views/document/cherry_read.tpl` | 「AI问答」按钮旁新增「网页收集」按钮 + iframe 弹框（懒加载） |
| `conf/app.conf`、`conf/app.conf.example` | 追加 6 个 `web_link_*` 配置项 |
| `go.mod` | `goquery`（已有）、`go-readability`（新增，正文提取） |

**已验证**（本地 sqlite 冒烟实例 + 单元测试）：
- `go build ./...`、`go vet`、`gofmt`（新增文件）通过；`go test ./controllers/` 10 项全过；
- 端到端：未登录 302 跳登录；登录后页面 200；og 页面捕获返回正确的标题/描述/图标/封面/站点名；
- **正文捕获**：readability 提取 295 字正文，导航/页脚/脚本噪声被剔除，关键段落完整保留；
- 整理能力：标签 + 笔记随卡片保存；标签汇总接口返回 `["支付","联机交易"]`；标签关键字搜索命中；置顶切换生效；
- 编辑：标题/标签/笔记/置顶均可改；详情返回正文快照；重新捕获刷新元信息与正文且保留用户标签/笔记；删除生效；
- 安全：`127.0.0.1`、`ftp://`、`user:pass@`、`.local`/`.internal` 等均被拒绝；
- 文档阅读页（default/cherry 两种模板）新按钮与弹框正常渲染。

后续迭代建议（对应方案 C）：chromedp/Playwright 截图与 PDF 归档（配置开关，默认关）；MV3 浏览器扩展捕获当前页选区与滚动位置；导入浏览器书签 HTML；卡片分享与批量导出。

---

## 五、参考链接

- Linkwarden: https://github.com/linkwarden/linkwarden
- Karakeep: https://github.com/karakeep-app/karakeep
- ArchiveBox: https://github.com/ArchiveBox/ArchiveBox
- Wallabag: https://github.com/wallabag/wallabag
- Shiori: https://github.com/go-shiori/shiori
- Obsidian Web Clipper: https://github.com/obsidianmd/obsidian-clipper
- SingleFile: https://github.com/gildas-lormeau/singlefile
- metascraper: https://github.com/microlinkhq/metascraper
- microlink SDK: https://github.com/microlinkhq/sdk
- go-readability: https://github.com/go-shiori/go-readability
- chromedp: https://github.com/chromedp/chromedp
- iframe-resizer: https://github.com/davidjbradshaw/iframe-resizer
