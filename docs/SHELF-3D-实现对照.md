# 书柜 3D · 实现对照（提示词包 §0~§13 → 本页）

> 版本：v1.0 · 2026-10-27
> 状态：与当前 `runmode=dev` 站点一致（静态文件即时生效）
> 契约：`docs/SHELF-3D-CONTRACT.md`
> 源需求：`/Users/yubinma/Downloads/问答/书柜3D提示词全量包.md`（下称《提示词包》）
> 生产实现：`views/home/index.tpl`、`static/css/mindoc-ui.css`、`static/js/shelf-3d.js`、`static/js/shelf-spec.js`

本文回答两个问题：

1. 《提示词包》§0~§13 的每一条目标，落在本页的哪个位置、由什么行为支撑；
2. 同一条目标，Web 运行时与 Blender / Unity / UE 资产管线的差异在哪里，哪些能力被等价替代、哪些只是展示性保留。

---

## 1. 交付物与文件归属

| 文件 | 归属 | 本页职责 |
|---|---|---|
| `views/home/index.tpl` | ui-shell | 3D 舞台骨架、悬浮玻璃顶栏、书籍卡、状态条、toast、loading / fallback、`#shelf-spec-root` 挂载点 |
| `static/css/mindoc-ui.css` | ui-shell | 舞台与 chrome 视觉、规范手册外壳与正文排版、响应式、reduced-motion、焦点可见性 |
| `static/js/shelf-3d.js` | lead | Three.js 场景、5 层柜体、书本 / 道具、三风格、五机位、两环境、拖拽与状态机、存档、`window.Shelf3D` |
| `static/js/shelf-spec.js` | spec-content | 规范手册 8 页签全文、提示词复制、实时公差、抽屉交互与焦点管理 |
| `docs/SHELF-3D-实现对照.md` | spec-content | 本文 |

脚本加载顺序（模板底部，契约 §2）：`three.min.js` → `shelf-spec.js` → `shelf-3d.js`。手册先完成 DOM 与事件绑定，场景就绪后通过 `shelf:ready` 回填实时数据，因此两者的初始化顺序不构成依赖。

---

## 2. 运行时链路

```
.ui-book-grid（服务端渲染的书籍 DOM，数据源）
        │  shelf-3d.js 读取 .list-item / data-*
        ▼
window.Shelf3D ── getSpec() ──────────────┐
        │  shelf:ready / shelf:change     │
        │  shelf:book / shelf:placed      ▼
        └──────────────────────► shelf-spec.js「交互与公差」实时面板
                                        │
                                        └─ 复制按钮 → navigator.clipboard（失败回退 textarea）

#home-shelf-3d 顶栏 [data-shelf-action="spec"] ─┐
hero 常驻入口 .ui-spec-link[data-shelf-action="spec"] ─┴─► window.ShelfSpec.open()
```

关键约定：

- 手册不直接读写 Three.js 场景，只消费 `getSpec()` 与 `window` 事件；`getSpec()` 返回 `null`、尚未就绪或抛错时，面板显示「待场景就绪」，不阻塞页面、不产生 console error。
- `shelf-3d.js` 在 `Escape` 处理中先判断 `ShelfSpec.isOpen()`，手册打开时不会误触「放回书本」。
- 手册自身监听 `[data-shelf-action="spec"]`，不依赖 `shelf-3d.js` 转发；`Shelf3D.openSpec()` 只是对 `ShelfSpec.open()` 的封装。

---

## 3. 提示词包 §0~§13 逐条对照

| 章节 | 目标（《提示词包》） | 本页实现位置 / 行为 | Web 版 vs Blender / 引擎侧差异 |
|---|---|---|---|
| §0 生成策略 | 1 + N 组合；工具差异（Rodin / Tripo3D / Meshy / Hunyuan3D）；组装留 0.3~0.5cm 公差 | 手册「生成策略」页签：1+N 流程、工具选型表、共享交付基线；场景侧由 `buildModels()` + `defaultLayout()` 生成独立书本对象与槽位 | 页面不调用文生 3D：柜体与书本由 Three.js 程序化构建，「1 个柜体 + N 本书」以对象树与槽位数据等价实现。工具差异仅作为资产重制指南保留。 |
| §1 主提示词（柜体 PBR） | 5 层等距开放层板、深胡桃木框、细微倒角、竖向木纹、可选下柜双门黄铜拉手、书阵自然变化、2 摞横放、第 3 层盆栽与马克杯、书间留缝、统一槽距、PBR 材质、三分之四视角、6~8 万三角、4K PBR | 场景 `bookshelf` 组：5 层 `Shelf_01~05`、胡桃木框、下柜、书本、道具；手册「柜体与变体」页签逐条拆解 | 几何为低面数程序化网格，不做 6~8 万三角导出；木纹 / 布纹 / 纸边为 canvas 程序化纹理而非 4K 贴图文件；倒角、清漆、AO 用材质参数与灯光近似。 |
| §2 变体 A · Stylized | 圆润厚重、暖焦糖 / 蜂蜜色、饱和色块、手绘笔触、暖轮廓光、1.5~2.5 万三角 | 顶栏「风格化」→ `data-style="stylized"`；`STYLES.stylized` 调整圆角、层板厚、书本缩放、曝光与环境强度 | 不是重新生成模型，而是同一几何的参数化重算：圆角、色板、纹理开关、灯光与曝光切换。手绘笔触以纹理滤镜与平面高光近似。 |
| §3 变体 B · Low-poly | 盒状几何、平面着色、浅桦木、纯色书块、无贴图、正交三分之四、2k~4k 三角 | 顶栏「低多边形」→ `data-style="lowpoly"`；`flatShading: true`、关闭木纹 / 阴影 | 实时场景仍保留必要面数以保证可读性，不强制 2k~4k 预算；导出预算仅在真实资产管线中执行。 |
| §4 单书模板 + 参数替换 | 每本书独立、cloth / 纸边 / 烫金、pivot 居中、3k~5k 三角、无可读文字；`{COLOR}` 十色、`{THICKNESS}` 四档；书脊视角变体 | 手册「书本与道具」页签：单书模板原文、参数替换表、书脊视角替换说明；场景每本书为独立 Group，可单独拾取 | 无生成式「单书模板」；以同一书本几何模板 + 色板 / 厚度 / 倾斜参数批量实例化。真实项目书（real）与示例书（sample）共用几何，差异在标题数据与计数。 |
| §5 横放书堆 | 2~3 本平放、顶本旋转错位、混合布面 / 皮面、书页朝上、4k~6k 三角 | 每层端部 1~2 摞横放书；手册「书本与道具」页签收录提示词与支撑规则 | 堆叠支撑为层板顶面与下方书本的 AABB 判定，不使用刚体滑落；顶本旋转 / 偏移以确定性随机实现。 |
| §6 盆栽 / 马克杯 | 龟背竹（陶盆、3~5 片叶、8k 三角）；陶瓷杯（奶白、斑点釉、C 形柄、2k 三角） | 第 3 层装饰道具；不占书本槽位；手册「书本与道具」页签收录两段提示词 | 程序化简单几何 + 材质近似；不加载外部 GLB。道具作为装饰对象，不参与槽位计数。 |
| §7 房间环境 | 温暖阅读角、暖白灰泥墙、橡木地板、左侧午后窗光、黄麻地毯、干邑皮椅一角、35mm、浅景深、杂志感 | 顶栏「摄影棚 / 阅读角」→ `data-environment="room"`：程序化房间（灰泥墙、橡木拼花地板、黄麻地毯、干邑皮椅、左侧窗与暖窗光）；手册「镜头光照」页签收录完整房间提示词 | 场景有真实房间几何与暖窗光，但无 HDRI / 相机景深 / 35mm 镜头模拟；房间家具为简化体块，不复刻照片级材质。房间提示词同时作为展示图参考保留。 |
| §8 贴图 / 材质重绘 | 木架（深胡桃木、细直纹、缎面清漆、4K 三通道）；书脊（亚麻布、烫金、4K）；纸边（奶白页线、4K Normal）；seamless tileable | 手册「贴图材质」页签收录三段原文 + 色板 + 通道规范；场景以 canvas 生成木纹 / 布纹 / 纸边，按风格缓存复用 | 不加载 4K PBR 贴图文件，程序化纹理一次生成、按 `wood:/cloth:/paper:` 键缓存；Meshy / Tripo 重贴流程只作为真实资产管线保留。 |
| §9 三级负面提示词 | 通用 / 结构类 / 风格互斥；风格化与低模替换「反卡通」段 | 手册「负面提示词」页签收录四段原文、拼装矩阵，并把负面词映射成页面可观察缺陷清单 | 运行时没有提示词输入，负面词转化为 QA 验收项（书与架融合、悬空、重复 / 缺失、层距不均等），不参与渲染。 |
| §10 视角与光照库 | 5 种视角、35mm / 50mm 镜头、棚拍三点光 4500K、AO、窗光、轮廓光 | 顶栏五机位 → `data-camera`；两环境 → `data-environment`；手册「镜头光照」页签收录关键词库与机位映射 | 相机为参数化插值与正交相机切换；灯光为 Three.js 环境光 / 平行光 / 点光组合，无软箱 IES、HDRI 与真实景深。 |
| §11 微调建议 | 公差与可分离性、交互挂点、风格统一、自然感细节（随机倾斜 / 半抽出） | 手册「交互与公差」页签：实时公差 + 4 张建议卡；场景 `DIM` / `MODELS` 落实公差、书脊抓取点、8 色色板、随机倾斜与半抽出书 | pivot / 刚体 / 挂点 Empty 由对象变换、射线命中与包围盒替代；摩擦与刚体手感无等价物，改用吸附与缓动动画。 |
| §12 Blender 后处理 | 导入清理、书与架分离、命名挂点、碰撞体、公差检查、glTF / FBX 导出 | 手册「Blender 后处理」页签：六步清单、命名表、导出参数速查、命名到 Web 的映射 | 页面不经过 Blender；命名规范保留为场景对象结构与存档键，碰撞体由射线与包围盒承担，尺度在代码中直接以米定义。 |
| §13 Unity / UE 交互 | Idle → Grabbed → Placed 状态机；刚体 / 槽位吸附 / 碰撞层 / 高亮 / 存档 | 场景拖拽状态机、ghost 预览、槽位吸附、Esc 放回、localStorage 存档；手册「交互与公差」页签收录 Unity / UE 要点与通用逻辑 | 无物理引擎与 XR 输入；以指针事件 + Raycaster + 槽位数据 + 动画缓动实现同等交互语义，存档从槽位 ID 文件改为 `localStorage`。 |

---

## 4. 规范手册（契约 §4）实现说明

### 4.1 DOM 映射

| 契约要求 | 实际结构 / 行为 |
|---|---|
| 挂载点 `#shelf-spec-root` | 位于 `#home-shelf-3d` 内；`shelf-spec.js` 检测到后注入 fixed 全屏层，重复初始化有 `data-spec-ready` 保护 |
| `.shelf-spec[hidden]` | 显隐只用 `hidden` 属性（另加 `.is-open` 供样式钩子），关闭后完全退出布局 |
| `.shelf-spec-backdrop[data-spec-close]` | 暖黑遮罩；点击关闭；`.shelf-spec-panel` 内点击不冒泡关闭 |
| `.shelf-spec-panel[role=dialog][aria-modal=true][aria-labelledby=shelf-spec-title]` | 右侧抽屉，`tabindex="-1"`，打开后聚焦；`min(840px, 94vw)`，640px 以下全宽 |
| `.shelf-spec-head` | eyebrow + `h2#shelf-spec-title` + 副标题 + `.shelf-spec-tabs` + `.shelf-spec-close` |
| 8 个 `button[data-spec-tab]` | `strategy / structure / book / texture / negative / camera / post / interaction`，`role=tab` + `aria-selected` + roving `tabindex` + 方向键 / Home / End；≥900px 为 4×2 两行，窄屏横向滚动 |
| `.shelf-spec-body` | 唯一垂直滚动容器；切页签时回到顶部 |
| `.shelf-spec-section[data-tab-panel]` | `role=tabpanel`，非当前页签使用 `hidden`；每章独立可滚动 |
| `pre.shelf-prompt` + `.shelf-prompt-copy` | 18 个复制块；按钮绝对定位在块右上角；复制成功按钮变「已复制」并在抽屉底部显示轻提示 |
| `.shelf-spec-foot` | 提示词来源与实时数据来源说明 |
| `.shelf-spec-toast` | 面板内底部提示，1.6s 自动消失，`role=status` |
| `window.ShelfSpec` | `{ open, close, toggle, isOpen }`，供 `Shelf3D.openSpec()` 与 QA 调用 |

### 4.2 8 页签 ↔ 提示词包章节

| 页签 | 章节 | 收录内容 | 复制块 |
|---|---|---|---|
| 生成策略 | §0 | 1+N 策略、工具差异、交付基线、Web 落地说明 | 0（中文流程，无英文提示词） |
| 柜体与变体 | §1 / §2 / §3 | 主提示词、变体 A、变体 B、三风格对照、拆解清单 | 3 |
| 书本与道具 | §4 / §5 / §6 | 单书模板、参数替换表、书脊视角变体、横放书堆、盆栽、马克杯、摆放支撑规则 | 4 |
| 贴图材质 | §8 | 木架 / 书脊布料 / 纸张切口提示词、10 色书脊色板、通道规范 | 3 |
| 负面提示词 | §9 | 通用 / 结构 / 风格互斥 / 替换段、拼装矩阵、负面词→缺陷表 | 4 |
| 镜头光照 | §7 / §10 | 五机位映射、视角关键词、镜头构图、光照关键词、两环境、房间提示词 | 4 |
| Blender 后处理 | §12 | 六步清单、命名表、导出参数、命名到 Web 的映射 | 0（流程清单） |
| 交互与公差 | §11 / §13 | 实时公差面板、4 条微调建议、状态机、Unity / UE 要点、通用逻辑、引擎→Web 映射 | 0（数据与清单） |

### 4.3 实时公差数据

「交互与公差」页签的数据字段与来源：

| 展示项 | 数据来源 | 说明 |
|---|---|---|
| 层高 | `dimensions.zoneH × 100`（cm） | 层板净空；若 `zoneH` 缺失，回退 `tolerances.shelfGapCm` |
| 书高 | `tolerances.bookHeightCm` | 当前最高竖放书 |
| 手取余量 | `tolerances.clearanceCm` | 层高减去最高书高 |
| 槽距 | `tolerances.slotPitchCm` | 平均书厚 + 书间留缝 |
| 书厚 | `tolerances.bookThicknessCm` | 当前书本平均厚度 |
| 间隙 | `tolerances.bookGapCm` | 书与书的设计留缝（0.4cm） |
| 真实书 / 示例书 / 空槽位 / 层板 / 总书数 | `counts.real / sample / gaps / shelves / total` | 场景实时计数 |
| 场景状态 | `style / camera / environment` + `styles / cameras / environments` 名称表 | 显示中文名称 |
| 外框尺寸 / 层板厚 | `dimensions.outerW/H/D`、`plankT`（米 → cm） | 附加信息 |

刷新时机：初始化、打开抽屉、`shelf:ready`、`shelf:change`、`shelf:book`、`shelf:placed`。数值格式化保留 1 位小数；`getSpec()` 为 `null` / 抛错 / 返回非对象时显示「待场景就绪」，不抛错。

### 4.4 交互与可达性

| 行为 | 实现 |
|---|---|
| 打开 | 顶栏 `[data-shelf-action="spec"]` 或 hero 常驻入口 `.ui-spec-link[data-shelf-action="spec"]` 点击（document 级委托）；`window.ShelfSpec.open()`；`Shelf3D.openSpec()` |
| 关闭 | Esc、遮罩、右上角关闭按钮；`window.ShelfSpec.close()` |
| 焦点进入 / 还原 | 打开时聚焦 `.shelf-spec-panel`，关闭时还原到触发元素 |
| Focus trap | Tab / Shift+Tab 在面板内可聚焦元素间循环，首尾回绕；隐藏页签内容不参与 |
| 背景滚动 | 打开且面板可见时给 `body` 加 `.shelf-spec-locked`，CSS 锁定 `overflow`；祖先被隐藏时不锁定，避免页面卡死 |
| 窄屏入口 | `< 1024px` 时 3D 舞台隐藏，hero 的「资产规范」按钮仍可打开手册；ui-shell 用 `.home-shelf-3d:has(.shelf-spec:not([hidden]))` 临时恢复渲染（高度 0，不影响页面布局） |
| 页签 | 点击 + ←/→/Home/End；`aria-selected` 与 `tabindex` 同步；面板 `hidden` 切换 |
| 复制 | `navigator.clipboard.writeText`；Promise 失败、权限拒绝或 API 缺失时回退隐藏 `textarea` + `execCommand("copy")`；成功提示「已复制到剪贴板」 |
| 复制块来源 | 直接读取 `pre.textContent`，与展示文本完全一致，不含按钮文字 |
| 容错 | 场景未就绪、接口缺失、`getSpec()` 返回 null、复制失败均不抛异常；无内联样式、无外部库 / 字体 / 图片 |

---

## 5. 本页技术参数

> 数值取自 2026-10-27 当前站点 `Shelf3D.getSpec()`；书架内容变化时以实时面板为准。长度单位：米（内部）／厘米（展示）。

### 5.1 世界尺度与柜体

| 参数 | 值 | 说明 |
|---|---|---|
| 世界单位 | 1 unit = 1 m | 与提示词包「real-world scale in meters」一致 |
| 外框（宽 × 高 × 深） | 1.000 × 2.011 × 0.340 m | 100.0 × 201.1 × 34.0 cm |
| 层板净宽 / 深 | 0.944 / 0.310 m | 内宽 94.4 cm |
| 层板厚 | 0.026 m | 2.6 cm |
| 层数 | 5 层 | `zones: 5`，层序号 `Shelf_01~05` |
| 层高（净空） | 0.280 m | 28.0 cm |
| 底板 / 下柜高 | 0.055 / 0.420 m | 双门黄铜拉手位保留 |

### 5.2 公差基线

| 参数 | 实时值 | 公式 / 说明 |
|---|---|---|
| 层高 | 28.0 cm | `DIM.zoneH` |
| 最高竖放书 | 25.3 cm | 当前书本最大高度 |
| 手取余量 | 2.7 cm | 层高 − 最高书高（建议 1~2 cm，实际随书本内容浮动） |
| 槽距 | 5.0 cm | 平均书厚 + 0.8 cm 槽间隙 |
| 平均书厚 | 4.2 cm | 真实书 3.6~5.2 cm；示例书 2.8~5.4 cm |
| 书间间隙 | 0.4 cm | 提示词包 §0 / §11 公差带 0.3~0.5 cm 的中值 |
| 书本数量 | 真实 2 + 示例 34 = 36 | 场景总量 36~42，随项目数补齐示例书 |
| 空槽位 | 21 | 实时计算，随拖拽 / 放回变化 |

### 5.3 色板（8 色）

| 色名 | HEX | 用途 |
|---|---|---|
| 深绯 | `#8C2F39` | 主色 / 视觉焦点 |
| 藏蓝 | `#1F3A5F` | 冷色平衡 |
| 森林绿 | `#2E5E4E` | 呼应站点绿 |
| 芥末黄 | `#C9A227` | 点亮层板 |
| 奶油白 | `#EFE3CF` | 纸边 / 浅色书脊 |
| 炭灰 | `#3A3A3C` | 压暗层次 |
| 陶土 | `#B4654A` | 暖色过渡 / 道具 |
| 橄榄 | `#6B6B3A` | 自然色补充 |

色板同时用于书本材质与 `getSpec().palette`，书脊烫金使用固定黄铜色，不进入色板。

### 5.4 风格、机位与环境

| 类型 | 键值 | 中文名 | 视觉要点 |
|---|---|---|---|
| 风格 | `real` | 写实 | 胡桃木纹、布面书脊、纸边、软阴影、环境反射 |
| 风格 | `stylized` | 风格化 | 大圆角、厚层板、蜂蜜 / 焦糖色、饱和书脊、低环境强度 |
| 风格 | `lowpoly` | 低多边形 | 平面着色、无贴图、无阴影、浅桦木 |
| 机位 | `three-quarter` | 三分之四 | 默认；略高于视平线 |
| 机位 | `front` | 正面 | 平视，检查层距 |
| 机位 | `hero` | 低角度 | 仰视，强调柜体高度 |
| 机位 | `top` | 俯视 | 45° 俯视，看横放堆 |
| 机位 | `ortho` | 正交 | 正交相机，资产检查 |
| 环境 | `studio` | 摄影棚 | 中性浅灰背景 + 三点柔光 |
| 环境 | `room` | 阅读角 | 暖灰泥墙 + 窗光 + 暖色环境 |

### 5.5 断点与脚本

| 项 | 值 |
|---|---|
| 3D 启用 | `window.innerWidth >= 1024` 且 WebGL 可用 |
| 卡片回退 | `< 1024px`、无 WebGL、脚本异常、无项目 |
| 手册全宽 | `< 640px`；页签在 `< 900px` 时横向滚动 |
| 手册入口 | 顶栏「规范手册」+ hero「资产规范」；`< 1024px` 走 `.ui-spec-link` + `:has()` 兜底 |
| 视角高度 | 舞台 `clamp(560px, 74vh, 800px)` |
| 存档键 | `mindoc_home_view`（视图）、`mindoc_shelf3d_state_v2`（摆放与偏好） |
| 脚本顺序 | `three.min.js` → `shelf-spec.js` → `shelf-3d.js` |

---

## 6. 提示词完整性与一致性

- **15 段 fenced 英文提示词**（§1 主提示词、§2 / §3 变体、§4 单书、§5 书堆、§6 盆栽 / 马克杯、§7 房间、§8 木架 / 书脊 / 纸边、§9 四段负面词）与源 Markdown **逐字节一致**（比较方式：解析源文件 fenced block，与页面 `pre.shelf-prompt.textContent` 全等比较，结果 15/15 命中、0 缺失）。
- **§10 三组关键词**（视角 / 镜头 / 光照）按源文件逐行保留英文关键词；源文件中的中文括注（如「推荐默认」「产品图」）不进入复制内容，已在页签内以说明文字呈现。
- 共 **18 个复制块**：结构 3 + 书本 4 + 贴图 3 + 负面 4 + 镜头光照 4。
- 中文文案只用于导读、拆解、参数解释和 Web 落点说明，不替换、不改写英文原文。

---

## 7. Web 版与 Blender / 引擎侧差异汇总

| 能力 | Blender / Unity / UE | 本页 Web 版 |
|---|---|---|
| 柜体与书本生成 | 文生 3D + 人工清理 / 分离 / 重拓扑 | Three.js 程序化几何；书本为独立对象，等价 1+N |
| 贴图 | 4K PBR albedo / roughness / normal，seamless | canvas 程序化纹理，按风格与材质键缓存 |
| 尺度与原点 | Apply Scale、原点居中、米制 | 代码中直接以米定义，柜体居中原点 |
| 碰撞 | Box Collider / Collision Preset | Raycaster + 槽位 / 层板包围盒 |
| 物理 | Rigidbody / Physics Handle / 刚体摩擦 | 无物理引擎；拖拽变换 + 支撑检测 + 缓动 |
| 槽位吸附 | 距离 &lt; 5cm → Lerp 对齐 | 最近空槽 + 世界距离阈值 + 位置 / 朝向缓动 |
| 抓起 / 放下 | XRGrabInteractable / Physics Handle | 指针事件状态机 + 书脊抓取点 + ghost 预览 |
| 高亮 | Outline / 描边 + 1.05x 缩放 | 描边材质 + 轻微放大 |
| 存档 | 槽位 ID 文件 / SaveGame | `localStorage` 摆放存档，刷新重建 |
| 展示环境 | 房间模型 / HDRI / 摄影棚灯光 | 背景渐变 + 环境光 / 平行光 / 点光近似 |
| 导出 | glTF 2.0 / FBX（+Y Up、Apply Modifiers） | 无导出环节；命名规范映射到场景对象与 `userData` |

---

## 8. 已知取舍与已解决事项

1. **`tolerances.shelfGapCm` 语义（已对齐）**：早期版本返回「层高 − 最高书高」（等于 `clearanceCm`，2.7cm），与字段名不符；lead 已于最新版本改为层高 28.0cm。手册始终优先使用 `dimensions.zoneH × 100` 显示层高、缺失时回退 `shelfGapCm`，两种实现下都正确。
2. **`< 1024px` 手册入口（已解决）**：手册挂在 `#home-shelf-3d` 内、舞台在窄屏按契约隐藏；ui-shell 已通过 hero 常驻入口 `.ui-spec-link[data-shelf-action="spec"]` + `.home-shelf-3d:has(.shelf-spec:not([hidden]))`（display:block; height:0）让抽屉在窄屏照常渲染。实测 390×844 打开/关闭、滚动、焦点还原均正常；`open()` 仍保留“面板不可见时不锁滚动”的保护。
3. **书立**：契约 §0 提到「书立」，但《提示词包》没有对应的独立提示词；手册在「书本与道具」中注明按柜体同材质延伸，不自行编造提示词。
4. **页签布局**：≥900px 时 8 个页签以 4×2 两行展示，全部可见；`< 900px` 时退回单行横向滚动（640px 以下带右侧渐隐提示）。
5. **§10 关键词复制**：复制内容为英文关键词（不含中文括注），以保证粘贴到生成工具时可直接使用；中文注解在页面中以说明文字呈现。
6. **实时面板不展示调色板**：色板在「贴图材质」页签以设计规范形式呈现；`getSpec().palette` 已由 API 提供，后续如需展示实时色块可在不改契约的前提下追加。

---

## 9. 验证记录（2026-10-27）

| 验证 | 方式 | 结果 |
|---|---|---|
| 语法 | `node --check static/js/shelf-spec.js` | 通过 |
| 预览（独立样式壳） | Playwright 1440×900 + 390×844 | 38/38 检查通过 |
| 真实站点集成 | `http://127.0.0.1:8182` 登录 shelfqa → 切 3D → 打开手册 | 35/35 检查通过（8 页签、复制、Esc、焦点、滚动、移动端 hero 入口与 :has 兜底） |
| 提示词完整性 | 源 Markdown fenced block 与 `pre.textContent` 全等比较 | 15/15 一致，0 缺失 |
| 控制台 | 真实站点 | 无 console error；仅 WebGL 驱动性能 warning（GPU stall due to ReadPixels），与页面代码无关 |

截图与检查报告：`/tmp/shelf-spec-artifacts/`（`site-01~08` 桌面页签、`site-08-interaction-live` 实时公差、`site-11` 状态机、`site-12` 镜头关键词、`site-13` 色板、`site-14/15` 移动端 hero 入口、`site-09/10` 移动端旧版对照、`preview-checks.json`、`integration-checks.json`、`prompt-integrity.json`）。
