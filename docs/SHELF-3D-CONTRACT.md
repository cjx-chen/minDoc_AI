# 书柜 3D 页面 · 重建契约（v2，全部重做）

> 本文件是本次「书柜功能页面全部重做」的唯一接口契约。所有成员以本文件为准，不得擅自改动他人文件的接口。
> 源需求：`/Users/yubinma/Downloads/问答/书柜3D提示词全量包.md`（下称《提示词包》）

## 0. 背景与目标

旧实现（`static/js/shelf-3d.js` 863 行 + `mindoc-ui.css` 中 `.home-shelf-3d` 段）只有 2 层、书与架糊在一起、无槽位/不再摆放、场景简陋。本次按《提示词包》第 0~13 章全部目标**从头重做**，交付一个可在 MinDoc 首页「3D 书柜」视图中运行的高质量 Web 3D 书柜：

- 1 个柜体 + N 本可独立拿取的书（1+N 策略）
- 5 层开放层板、胡桃木框、可选下柜双门黄铜拉手
- 写实 / 风格化 / 低多边形 三种风格（提示词包 §1/§2/§3）
- 单书模板、横放书堆、盆栽、马克杯、书立（§4/§5/§6）
- 摄影棚 / 阅读角两种展示环境（§7）
- 视角与光照预设（§10）
- 拿起 → 拖动换位 / 悬停空位 ghost 预览 / 吸附 / 放回 / 堆叠支撑检测 / 摆放存档（§11/§13）
- 页面内「资产规范手册」完整收纳提示词包 §0~§13 + 实时公差数据（§11）
- 降级：无 WebGL / <1024px / 脚本异常 → 卡片视图；键盘可达；reduced-motion 适配

## 1. 文件归属（写权限严格分离）

| 成员 | 文件 | 说明 |
|---|---|---|
| lead | `static/js/shelf-3d.js` | 全部 3D 场景、交互、状态机、存档、视图切换 |
| ui-shell | `views/home/index.tpl`、`static/css/mindoc-ui.css` | 页面骨架、舞台 chrome、规范手册外壳样式、响应式 |
| spec-content | `static/js/shelf-spec.js`、`docs/SHELF-3D-实现对照.md` | 规范手册全文与交互、提示词数据、实现对照文档 |
| qa-verify | `qa-artifacts/`、`/tmp/shelf-qa/` | 验证脚本与截图，不修改生产文件 |

- 只在归属文件内修改；需要跨文件改动先在共享任务里说明，由对应 owner 执行。
- 不要提交 git，不要改 Go 代码，不要重启服务（`runmode=dev`，模板与静态文件即时生效）。

## 2. 页面结构（ui-shell 产出，lead 依赖）

`views/home/index.tpl` 中，在 `.ui-home-body` 内保留现有 `.ui-book-grid`（JS 的数据源，**不得改动其 DOM 结构/data-* 属性**），并替换 `.home-shelf-3d` 空容器为下列结构。所有文案保持中文，图标可用 Font Awesome（页面已引入）或纯 CSS。

```html
<div class="ui-home-body shelf-active?">
  <div class="row"><div class="col-xs-12">
    <div class="home-shelf-3d" id="home-shelf-3d"
         data-style="real" data-camera="three-quarter" data-environment="studio" data-phase="idle">
      <!-- canvas 由 shelf-3d.js 注入，class="shelf-canvas" -->

      <div class="shelf-topbar">
        <div class="shelf-brand">
          <span class="shelf-brand-mark" aria-hidden="true"><i class="fa fa-book"></i></span>
          <span class="shelf-brand-text"><b>知识书柜</b><em>Walnut · 5 层 · 3D</em></span>
        </div>
        <div class="shelf-controls">
          <div class="shelf-seg" role="group" aria-label="材质风格">
            <button type="button" data-shelf-style="real" class="is-active" aria-pressed="true">写实</button>
            <button type="button" data-shelf-style="stylized" aria-pressed="false">风格化</button>
            <button type="button" data-shelf-style="lowpoly" aria-pressed="false">低多边形</button>
          </div>
          <div class="shelf-seg" role="group" aria-label="机位">
            <button type="button" data-shelf-cam="three-quarter" class="is-active" aria-pressed="true">三分之四</button>
            <button type="button" data-shelf-cam="front" aria-pressed="false">正面</button>
            <button type="button" data-shelf-cam="hero" aria-pressed="false">低角度</button>
            <button type="button" data-shelf-cam="top" aria-pressed="false">俯视</button>
            <button type="button" data-shelf-cam="ortho" aria-pressed="false">正交</button>
          </div>
        </div>
        <div class="shelf-actions">
          <button type="button" data-shelf-action="env" aria-pressed="false">
            <span class="shelf-act-dot" aria-hidden="true"></span>
            <span class="shelf-act-label">摄影棚</span>
          </button>
          <button type="button" data-shelf-action="orbit" aria-pressed="false">环绕</button>
          <button type="button" data-shelf-action="sound" aria-pressed="true">音效</button>
          <button type="button" data-shelf-action="reset">重置</button>
          <button type="button" data-shelf-action="spec" class="shelf-act-primary">规范手册</button>
        </div>
      </div>

      <div class="shelf-statusbar" id="shelf-status" aria-live="polite"></div>

      <aside class="shelf-card" id="shelf-card" hidden aria-label="书籍详情">
        <button type="button" class="shelf-card-close" id="shelf-card-close" aria-label="关闭并放回书架">&times;</button>
        <div class="shelf-card-top">
          <div class="shelf-card-cover"><img id="shelf-card-cover-img" alt=""></div>
          <div class="shelf-card-heading">
            <span class="shelf-card-badge" id="shelf-card-badge"></span>
            <h2 class="shelf-card-name" id="shelf-card-name"></h2>
            <p class="shelf-card-meta" id="shelf-card-meta"></p>
          </div>
        </div>
        <p class="shelf-card-desc" id="shelf-card-desc"></p>
        <dl class="shelf-card-stats" id="shelf-card-stats"></dl>
        <div class="shelf-card-actions">
          <a class="shelf-card-open" id="shelf-card-open" href="#">进入项目</a>
          <button type="button" class="shelf-card-putback" id="shelf-card-putback">放回书架</button>
        </div>
        <p class="shelf-card-tip">拖动书本可换位 · Esc 放回</p>
      </aside>

      <div class="shelf-hint" aria-hidden="true">
        <span>拖拽旋转</span><span>滚轮缩放</span><span>拖动书本换位</span><span>单击取书</span>
      </div>

      <div class="shelf-toast" id="shelf-toast" role="status" aria-live="polite"></div>

      <div class="shelf-loading" id="shelf-loading">
        <span class="shelf-spinner" aria-hidden="true"></span><span>正在生成书柜场景…</span>
      </div>

      <div class="shelf-fallback" id="shelf-fallback" hidden>
        <p>当前浏览器无法渲染 3D 书柜，已为你保留卡片视图。</p>
        <button type="button" data-shelf-action="cards">切换到卡片视图</button>
      </div>

      <div id="shelf-spec-root"></div>
    </div>
    <div class="manual-list ui-book-grid">…保持原样…</div>
    <nav class="pagination-container">…</nav>
  </div></div>
</div>
```

脚本加载顺序（模板底部，three 之后）：
```html
<script src="{{cdnjs "/static/js/three/three.min.js" "version"}}"></script>
<script src="{{cdnjs "/static/js/shelf-spec.js" "version"}}"></script>
<script src="{{cdnjs "/static/js/shelf-3d.js" "version"}}"></script>
```

行为约定（lead 实现）：`shelf-active` 由 shelf-3d.js 加在 `.ui-home-body` 上；`data-style/camera/environment/phase` 由 shelf-3d.js 维护；ui-shell 只负责样式，不写 JS 逻辑。

## 3. JS API（lead 提供）

```js
window.Shelf3D = {
  ready: Promise,                       // resolve(spec) | reject(undefined)
  getSpec(),                            // 就绪前返回 null
  setStyle('real'|'stylized'|'lowpoly'),// Promise<void>
  setCamera('three-quarter'|'front'|'hero'|'top'|'ortho'),
  setEnvironment('studio'|'room'),
  setOrbit(bool), setSound(bool),
  resetLayout(), putBack(), openSpec(), // openSpec 调 window.ShelfSpec.open()
  // QA 专用（生产也可留）
  __debug: {
    state(),                            // {phase,style,camera,environment,orbit,sound,activeBook,books:[...],gaps:[...]}
    screenOf(bookId),                   // {x,y} 画布视口坐标；不可见返回 null
    gapScreen(shelfIndex),              // 某层一个可用空位的屏幕坐标（用于拖拽测试）
    project(bookId),                    // {x,y,z} 世界坐标
    fps()                               // 最近 1s 帧率
  }
};
// 事件（window）
// shelf:ready  detail = getSpec()
// shelf:change detail = {style,camera,environment,orbit,sound}
// shelf:book   detail = {id,real,open}
// shelf:placed detail = {id,shelf,x,orient}
// shelf:toast  detail = {text}
```

`getSpec()` 返回（供规范手册使用，shelf-spec.js 需容错处理 null）：
```js
{
  style, camera, environment, orbit, sound,
  dimensions: { outerW, outerH, outerD, zoneH, shelfW, plankT, zones: 5,
                unit: 'm' /* 内部计算用米，手册展示用 cm */ },
  tolerances: { shelfGapCm, bookHeightCm, clearanceCm, slotPitchCm, bookThicknessCm, bookGapCm },
  counts: { real, sample, total, shelves: 5, gaps },
  palette: [{name:'深绯',hex:'#8C2F39'}, ...], // 8 色
  styles: [{key:'real',name:'写实'},...],
  cameras: [...], environments: [...]
}
```

## 4. 规范手册契约（spec-content 产出）

- 挂载点 `#shelf-spec-root`，自建 fixed 全屏层；结构：
  `#shelf-spec-root > .shelf-spec[hidden]` → `.shelf-spec-backdrop[data-spec-close]` + `.shelf-spec-panel[role=dialog][aria-modal=true][aria-labelledby=shelf-spec-title]`
  - `.shelf-spec-head`：eyebrow / `h2#shelf-spec-title` / `.shelf-spec-tabs`（`button[data-spec-tab="strategy|structure|book|texture|negative|camera|post|interaction"]`）/ `.shelf-spec-close[data-spec-close]`
  - `.shelf-spec-body`：`.shelf-spec-section[data-tab-panel]`，内含 `<pre class="shelf-prompt">` + 复制按钮 `.shelf-prompt-copy`、表格、示例块
  - `.shelf-spec-foot`
- `window.ShelfSpec = { open(), close(), toggle(), isOpen() }`
- 点击 `[data-shelf-action="spec"]` 由 shelf-spec.js 自己监听；Esc / backdrop / 关闭按钮关闭；打开后焦点进入面板，关闭后还原；`hidden` 属性控制显隐。
- 文案必须覆盖《提示词包》§0~§13（策略、主提示词、变体 A/B、单书模板+参数表、横放书堆、盆栽/马克杯、房间环境、贴图提示词、三级负面提示词、视角/镜头/光照库、微调建议、Blender 清单、Unity/UE 交互），并提供一键复制。
- 「交互」页签中展示 `Shelf3D.getSpec()` 的实时数据（层高/书高/余量/槽距/书厚/间隙，单位 cm），未就绪时显示占位并监听 `shelf:ready`。
- 视觉由 ui-shell 的 CSS 负责（见 §5 类名），spec-content 不写内联样式。

## 5. 视觉规范（ui-shell 执行）

- 气质：温暖书房 / 编辑部画册感，木质 + 纸感 + 站点绿点缀；不要霓虹暗黑风。沿用站点变量 `--ui-*`，另在 `.home-shelf-3d` 内定义 `--sh-wood/--sh-brass/--sh-paper/--sh-ink` 等。
- 舞台 `#home-shelf-3d`：`position:relative; height:clamp(560px, 74vh, 800px); border-radius:18px; overflow:hidden; border:1px solid rgba(74,56,38,.14); box-shadow:0 18px 48px rgba(56,44,30,.12); background:` 默认摄影棚渐变（暖灰）；`[data-environment="room"]` 时换暖色房间渐变。
- canvas：绝对定位铺满，`display:block; border-radius:inherit; touch-action:none; cursor:grab`。
- topbar：顶部 12px 悬浮玻璃条（白 78% + blur 16px），左侧品牌、中间两组胶囊分段控件、右侧动作；在 1024~1200px 收敛（隐藏 `em`、缩小间距），避免溢出。要有清晰 hover / active / focus-visible 状态。
- 状态条：左上（topbar 下方）小胶囊，12px 文本。
- 书籍卡：右侧 16px、宽 320px、白 94% 玻璃、圆角 16、投影；进入动画 240ms；封面 54×74；badge 绿色 tint；标题 15/600；描述三行截断；`.shelf-card-stats` 两列小字；主按钮绿、次按钮描边；关闭按钮 26px 圆形。
- 提示条：左下玻璃胶囊，4 段文字以细竖线分隔，`aria-hidden`。
- toast：底部居中深色胶囊，`.is-show` 显示。
- loading / fallback：居中玻璃卡片；loading 有旋转圈。
- 规范手册：fixed 全屏，backdrop 暖黑 45% + blur 4px；右侧抽屉面板（宽 min(840px, 94vw)，高 100%，纸色 `#fbf9f5`），头部渐变/描边，tabs 胶囊可横向滚动，正文可滚动，`pre.shelf-prompt` 用等宽字体 + 纸色底 + 复制按钮，表格细线；移动端全宽。层级高于站点 header。
- 站点 header 高度约 51px；舞台上下留 14px；`.ui-home-body.shelf-active .pagination-container { display:none }`。
- 断点：≥1024 启用 3D（<1024 保持原有卡片回退规则）；640px 以下规范手册全宽、tabs 横向滚动。
- reduced-motion：去掉卡片/遮罩动画与 spinner 动画（仍显示文字）。
- 不引入外部字体/图片；不写内联 `<style>`；所有新样式限定在 `.home-shelf-3d` / `.shelf-spec` 作用域内，避免污染其他页面。

## 6. 验证环境（qa-verify）

- 站点：http://127.0.0.1:8182 ，已运行（dev 模式，静态文件即时生效；模板改动若未生效再联系 lead）。
- 测试账号：`shelfqa` / `ShelfQa!2026`（管理员）。登录按钮是 `#btn-login`（type=button，前端 ajax 提交）。
- 现有数据只有 2 个项目（id 1/2），页面会用「示例书」补足场景；QA 需验证真实书（2 本）与示例书的区别。
- Playwright 已装在 `/tmp/pw`（`require('playwright')`），浏览器缓存已就绪。
- 测试脚本放 `/tmp/shelf-qa/`，截图与报告放 `<repo>/qa-artifacts/`，四不要：不要改生产文件、不要提交、不要改数据库、不要重启服务。

## 7. 完成标准（全队）

1. 1440×900 首屏观感达到「可上线的产品级 3D 展台」：木纹、纸边、布料书脊、黄铜、柔光、阴影、层次清晰，无穿模/漏光/空荡。
2. 三种风格切换后视觉差异明显且都完整（不是换色）。
3. 拿起/拖动/ghost/吸附/放回/禁用位置反馈/堆叠/重置/刷新后恢复全部可用，鼠标与键盘焦点不出错。
4. 规范手册覆盖 §0~§13，复制可用，实时公差数据正确。
5. 无 console error；降级路径（WebGL 关闭、<1024px）回到卡片视图；`prefers-reduced-motion` 下可用。
6. Playwright 全量脚本通过，截图归档。
