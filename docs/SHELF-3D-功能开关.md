# 3D 书柜 · 功能开关（默认关闭）

> 需求：给 3D 书柜加个开关，默认关闭该功能。
> 涉及文件：`views/home/index.tpl`（开关 UI）、`static/js/shelf-3d.js`（开关逻辑）、`static/css/mindoc-ui.css`（开关样式）。
> 纯前端改动，无需重新编译 / 重启服务（dev 模式下模板与静态文件即时生效）。

## 1. 开关在哪

首页顶部 hero 动作行，「资产规范」按钮右侧，一个胶囊开关：

- 轨道灰、圆点在左 = **关闭**（默认）
- 轨道站点绿、圆点在右 = **开启**

## 2. 状态与优先级

| 优先级 | 来源 | 说明 |
|---|---|---|
| 1 | `localStorage["mindoc_shelf3d_enabled"]` | 用户拨动开关后的选择，`"1"` 开 / `"0"` 关 |
| 2 | `window.MINDOC_SHELF3D_DEFAULT` | 服务端默认值，模板注入；后端未提供时恒为 `false` |

即：**默认关闭**；用户拨动后按用户选择记忆（换浏览器 / 清缓存后回到默认）。

## 3. 关闭时（默认态）的行为

- 「3D 书柜」视图切换按钮（`#home-view-toggle`）隐藏，只剩卡片视图；
- 「资产规范」入口（`.ui-spec-link`）一并隐藏；
- 强制卡片视图：即使本地记忆了 3D 视图或从深链进入，也不会初始化 3D 场景；
- 3D 场景懒加载不会触发，无 WebGL 开销。

## 4. 开启方式

1. **UI**：点击开关 → 出现「3D 书柜」视图按钮，点击即可进入 3D 视图；
2. **深链**：`/?showshelf=1` 会强制开启开关并直接进入 3D 视图（QA / 演示用）；
3. **API**：`window.Shelf3D.setFeature(true|false)` / `window.Shelf3D.featureEnabled()`；
4. **事件**：拨动开关时 window 上派发 `shelf:feature`，`detail = { enabled }`。

## 5. 服务端默认开启（可选）

后端在 `controllers/HomeController.go` 的 `Index()` 中注入即可（需重新编译）；

```go
c.Data["EnableShelf3D"] = true // 或从 conf / 配置项读取
```

模板已预留：`window.MINDOC_SHELF3D_DEFAULT = {{if .EnableShelf3D}}true{{else}}false{{end}};`
未注入时求值为 `false`，不影响默认关闭行为。用户 localStorage 选择仍优先于服务端默认值。

## 6. 验证结论

见 `qa-artifacts/shelf-switch/`（Playwright 脚本与截图）：
默认关闭 → 开启 → 3D 视图可用 → 刷新后保持开启 → 关闭后复位卡片视图。
