/**
 * 首页 3D 书柜（全量重做 · v2）
 * ------------------------------------------------------------------
 * 目标来源：书柜3D提示词全量包.md §0~§13
 *  · 1 个柜体 + N 本可独立拿取的书（1+N 组合策略）
 *  · 5 层开放层板 + 下柜双门黄铜拉手 + 胡桃木框
 *  · 写实 / 风格化 / 低多边形 三风格；摄影棚 / 阅读角 双环境
 *  · 拿起 → 拖动换位 → ghost 预览 → 吸附 / 回弹 / 堆叠支撑检测
 *  · 摆放存档（localStorage）、书脊抓取点、公差可视化、规范手册联动
 *  · 可访问性：键盘机位、Esc 放回、reduced-motion、无 WebGL 回退卡片
 *
 * 依赖：static/js/three/three.min.js (r149)、shelf-spec.js（可选）
 * 数据源：首页 .ui-book-grid 中已有项目 DOM（零后端改动）
 */
(function () {
    "use strict";

    var host = document.getElementById("home-shelf-3d");
    var body = document.querySelector(".ui-home-body");
    var grid = document.querySelector(".ui-book-grid");
    var toggle = document.getElementById("home-view-toggle");
    if (!host || !body || !grid || !toggle) { return; }

    var hasThree = typeof window.THREE !== "undefined";
    /* r149 默认 legacyMode：材质纯色按线性解释，配合 sRGB 输出会整体发灰发粉。
       关闭 legacyMode，让纯色与 sRGB 贴图使用同一套色彩管理。 */
    if (hasThree && THREE.ColorManagement) {
        THREE.ColorManagement.legacyMode = false;
    }
    var reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    var FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Helvetica Neue",Arial,sans-serif';
    var STORE_VIEW = "mindoc_home_view";
    var STORE_STATE = "mindoc_shelf3d_state_v2";

    /* ---------- 功能开关（默认关闭） ----------
     * 优先级：localStorage（用户拨动记录） > window.MINDOC_SHELF3D_DEFAULT（服务端默认，缺省 false）。
     * 关闭时：隐藏「3D 书柜」视图切换与「资产规范」入口，强制卡片视图，不初始化 3D 场景。 */
    var STORE_FEATURE = "mindoc_shelf3d_enabled";
    function readFeature() {
        try {
            var v = localStorage.getItem(STORE_FEATURE);
            if (v === "1") { return true; }
            if (v === "0") { return false; }
        } catch (e) {}
        return !!window.MINDOC_SHELF3D_DEFAULT;
    }
    function writeFeature(on) {
        try { localStorage.setItem(STORE_FEATURE, on ? "1" : "0"); } catch (e) {}
    }
    var featureOn = readFeature();
    function computeCanShelf() { return glOk && viewportOk && dataOk && featureOn; }
    var MIN_TOTAL = 36;
    var MAX_TOTAL = 42;
    var ACCENT_HEX = "#00794c";
    var DANGER_HEX = "#c0392b";

    /* 提示词包 §1/§4 色板（8 色） */
    var PALETTE = [
        { name: "深绯", hex: "#8C2F39" },
        { name: "藏蓝", hex: "#1F3A5F" },
        { name: "森林绿", hex: "#2E5E4E" },
        { name: "芥末黄", hex: "#C9A227" },
        { name: "奶油白", hex: "#EFE3CF" },
        { name: "炭灰", hex: "#3A3A3C" },
        { name: "陶土", hex: "#B4654A" },
        { name: "橄榄", hex: "#6B6B3A" }
    ];

    /* 真实尺度（米），见提示词包 §11 公差建议 */
    var DIM = {
        outerW: 1.0,
        outerH: 2.011,
        outerD: 0.34,
        sideT: 0.028,
        plankT: 0.026,
        topT: 0.032,
        plinthH: 0.055,
        cabinetH: 0.42,
        cabinetTopY: 0.475,
        zoneH: 0.28,
        innerW: 0.944,
        innerD: 0.31,
        floors: [0.475, 0.781, 1.087, 1.393, 1.699],
        topY: 1.979,
        frontZ: 0.17,
        backZ: -0.164
    };

    var STYLES = {
        real: {
            key: "real", name: "写实", radius: 0.0026, plankT: 0.026,
            bookScale: 1.0, woodTex: true, bookTex: true, propTex: true, flatShading: false,
            shadow: true, envInt: 0.34, exposure: 0.98, lightScale: 1.0
        },
        stylized: {
            key: "stylized", name: "风格化", radius: 0.016, plankT: 0.036,
            bookScale: 1.12, woodTex: true, bookTex: false, propTex: false, flatShading: false,
            shadow: true, envInt: 0.12, exposure: 1.02, lightScale: 0.95
        },
        lowpoly: {
            key: "lowpoly", name: "低多边形", radius: 0, plankT: 0.03,
            bookScale: 1.0, woodTex: false, bookTex: false, propTex: false, flatShading: true,
            shadow: false, envInt: 0.0, exposure: 0.92, lightScale: 1.0
        }
    };

    var CAMERAS = {
        "three-quarter": { name: "三分之四", az: 0.32, pol: 0.07, zoom: 1.0, ty: 1.07 },
        front: { name: "正面", az: 0.0, pol: 0.02, zoom: 1.02, ty: 1.07 },
        hero: { name: "低角度", az: 0.28, pol: -0.12, zoom: 1.05, ty: 0.98 },
        top: { name: "俯视", az: 0.44, pol: 0.52, zoom: 1.12, ty: 0.92 },
        ortho: { name: "正交", az: 0.14, pol: 0.05, zoom: 1.0, ty: 1.14 }
    };

    /* ================================================================
     * 通用工具
     * ================================================================ */
    function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
    function lerp(a, b, t) { return a + (b - a) * t; }
    function mulberry32(a) {
        return function () {
            a |= 0; a = a + 0x6D2B79F5 | 0;
            var t = Math.imul(a ^ a >>> 15, 1 | a);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }
    function newCanvas(w, h) {
        var c = document.createElement("canvas");
        c.width = w; c.height = h;
        return c;
    }
    function roundRect(ctx, x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }
    function luminance(hex) {
        var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
        return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    }
    function hexToRgb(hex) {
        return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    }
    function shade(hex, k) {
        var c = hexToRgb(hex);
        return "rgb(" + clamp(Math.round(c[0] * k), 0, 255) + "," + clamp(Math.round(c[1] * k), 0, 255) + "," + clamp(Math.round(c[2] * k), 0, 255) + ")";
    }
    function rgba(hex, a) {
        var c = hexToRgb(hex);
        return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")";
    }
    function wrapText(ctx, text, maxWidth) {
        var lines = [], line = "", chars = String(text || "").split("");
        for (var i = 0; i < chars.length; i++) {
            var test = line + chars[i];
            if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = chars[i]; }
            else { line = test; }
        }
        if (line) { lines.push(line); }
        return lines;
    }
    function seedNoise(ctx, w, h, amount, alpha, size) {
        for (var i = 0; i < amount; i++) {
            var x = Math.random() * w, y = Math.random() * h;
            ctx.fillStyle = "rgba(" + (Math.random() < 0.5 ? "255,255,255" : "0,0,0") + "," + (Math.random() * alpha) + ")";
            ctx.fillRect(x, y, size * (0.4 + Math.random()), size * (0.4 + Math.random()));
        }
    }

    /* ================================================================
     * 数据：从现有首页网格抓取项目（零后端改动）
     * ================================================================ */
    var RAW_BOOKS = [];
    Array.prototype.forEach.call(grid.querySelectorAll(".list-item"), function (el) {
        var nameEl = el.querySelector(".book-name .name") || el.querySelector(".manual-item-standard dd a") || el.querySelector("a");
        var authorEls = el.querySelectorAll(".author .text");
        var img = el.querySelector("img.cover");
        var name = nameEl ? (nameEl.textContent || "").trim() : "";
        var href = nameEl ? nameEl.getAttribute("href") : "";
        if (!name || !href) { return; }
        RAW_BOOKS.push({
            id: el.getAttribute("data-id") || "",
            name: name,
            href: href,
            author: authorEls.length ? (authorEls[authorEls.length - 1].textContent || "").trim() : "",
            coverSrc: img ? img.getAttribute("src") : "",
            docs: parseInt(el.getAttribute("data-docs") || "0", 10) || 0,
            desc: (el.getAttribute("data-desc") || "").trim()
        });
    });

    /* ================================================================
     * 模型与默认摆放（纯数据，风格无关；种子固定保证风格切换不重排）
     * ================================================================ */
    var PLAN = [
        { s: 0, upright: 7, stack: 2, lean: true },
        { s: 1, upright: 7, stack: 2, lean: false },
        { s: 2, upright: 6, stack: 0, lean: false, props: true },
        { s: 3, upright: 7, stack: 0, lean: true },
        { s: 4, upright: 6, stack: 0, lean: false }
    ];

    function buildModels() {
        var rnd = mulberry32(0x5EED2026);
        var reals = RAW_BOOKS.map(function (b, i) {
            return { key: "b" + (b.id || i), real: true, meta: b, colorIndex: i % PALETTE.length };
        });
        var target = Math.min(MAX_TOTAL, Math.max(MIN_TOTAL, reals.length));
        if (reals.length > target) { reals = reals.slice(0, target); }
        var samplesN = Math.max(0, target - reals.length);
        var samples = [];
        for (var i = 0; i < samplesN; i++) {
            samples.push({ key: "s" + i, real: false, colorIndex: (i * 3 + 1) % PALETTE.length });
        }
        var all = reals.concat(samples);
        all.forEach(function (m, i) {
            var real = m.real;
            m.t = real ? 0.036 + rnd() * 0.016 : 0.028 + rnd() * 0.026;
            m.h = real ? 0.238 + rnd() * 0.02 : 0.206 + rnd() * 0.048;
            m.d = 0.155 + rnd() * 0.048;
            m.color = PALETTE[m.colorIndex % PALETTE.length];
            m.tilt = (!real && rnd() < 0.2) ? (rnd() * 0.05 - 0.025) : 0;
            m.variant = Math.floor(rnd() * 1000);
            m.pulled = false;
            m.idx = i;
        });
        return all;
    }

    function defaultLayout(models) {
        var rnd = mulberry32(0xA11CE);
        var assign = {};
        var pool = models.slice();
        var order = [2, 1, 3, 0, 4];
        var byKey = {};
        models.forEach(function (m) { byKey[m.key] = m; });

        order.forEach(function (si) {
            var plan = null;
            for (var k = 0; k < PLAN.length; k++) { if (PLAN[k].s === si) { plan = PLAN[k]; } }
            if (!plan) { return; }
            var list = [];
            for (var i = 0; i < plan.upright && pool.length; i++) { list.push(pool.shift()); }
            var reserved = (plan.stack ? 0.3 : 0) + (plan.props ? 0.24 : 0);
            var X0 = -DIM.innerW / 2 + 0.026;
            var X1 = DIM.innerW / 2 - 0.026 - reserved;
            var total = 0;
            list.forEach(function (m) { total += m.t; });
            var gapN = list.length + 1;
            var free = Math.max(0.02, (X1 - X0) - total);
            var weights = [], wsum = 0;
            for (var g = 0; g < gapN; g++) {
                var w = 0.45 + rnd();
                if (g === 0 || g === gapN - 1) { w *= 0.45; }
                weights.push(w); wsum += w;
            }
            var gaps = weights.map(function (w) { return Math.max(0.005, free * w / wsum); });
            var gsum = gaps.reduce(function (a, b) { return a + b; }, 0);
            if (gsum > free) { gaps = gaps.map(function (v) { return v * free / gsum; }); }
            var x = X0;
            list.forEach(function (m, i) {
                x += gaps[i];
                assign[m.key] = { s: si, x: x + m.t / 2, o: "u", l: 0 };
                x += m.t;
            });
            if (plan.lean && list.length) {
                var lean = list[list.length - 1];
                lean.tilt = 0.19;
            }
        });

        PLAN.forEach(function (plan) {
            if (!plan.stack) { return; }
            var stackBooks = [];
            for (var i = 0; i < plan.stack && pool.length; i++) { stackBooks.push(pool.shift()); }
            if (!stackBooks.length) { return; }
            var maxH = 0;
            stackBooks.forEach(function (m) { maxH = Math.max(maxH, m.h); });
            var sx = DIM.innerW / 2 - 0.028 - maxH / 2;
            stackBooks.forEach(function (m, li) {
                assign[m.key] = { s: plan.s, x: sx + (rnd() - 0.5) * 0.008, o: "f", l: li };
            });
        });

        /* 半抽出的书（提示词包 §11.4：最能暗示可拿取） */
        var pulledDone = false;
        models.forEach(function (m) {
            if (pulledDone || !m.real) { return; }
            var a = assign[m.key];
            if (a && a.s === 2) { m.pulled = true; pulledDone = true; }
        });

        return assign;
    }

    var MODELS = buildModels();
    var DEFAULT_ASSIGN = defaultLayout(MODELS);
    var MODEL_BY_KEY = {};
    MODELS.forEach(function (m) { MODEL_BY_KEY[m.key] = m; });

    function loadState() {
        var st = { style: "real", camera: "three-quarter", environment: "studio", orbit: false, sound: true, layout: null };
        try {
            var raw = localStorage.getItem(STORE_STATE);
            if (!raw) { return st; }
            var saved = JSON.parse(raw);
            if (!saved || saved.v !== 2) { return st; }
            if (STYLES[saved.style]) { st.style = saved.style; }
            if (CAMERAS[saved.camera]) { st.camera = saved.camera; }
            if (saved.environment === "room" || saved.environment === "studio") { st.environment = saved.environment; }
            st.orbit = !!saved.orbit;
            st.sound = saved.sound !== false;
            if (saved.layout && typeof saved.layout === "object") {
                var valid = {};
                Object.keys(saved.layout).forEach(function (k) {
                    var a = saved.layout[k];
                    if (!MODEL_BY_KEY[k] || !a) { return; }
                    var si = parseInt(a.s, 10), x = parseFloat(a.x), o = a.o === "f" ? "f" : "u";
                    var l = parseInt(a.l, 10);
                    if (!(si >= 0 && si < 5) || !isFinite(x)) { return; }
                    if (x < -DIM.innerW / 2 || x > DIM.innerW / 2) { return; }
                    valid[k] = { s: si, x: x, o: o, l: isFinite(l) ? Math.max(0, l) : 0 };
                });
                st.layout = valid;
            }
        } catch (e) {}
        return st;
    }

    var APP_STATE = loadState();
    var ASSIGN = {};
    MODELS.forEach(function (m) {
        if (APP_STATE.layout && APP_STATE.layout[m.key]) { ASSIGN[m.key] = APP_STATE.layout[m.key]; }
        else if (DEFAULT_ASSIGN[m.key]) { ASSIGN[m.key] = DEFAULT_ASSIGN[m.key]; }
    });

    var PUBLIC_API = null;
    var readyResolve = null;
    var readyPromise = new Promise(function (res) { readyResolve = res; });

    function saveState() {
        try {
            localStorage.setItem(STORE_STATE, JSON.stringify({
                v: 2,
                style: APP_STATE.style,
                camera: APP_STATE.camera,
                environment: APP_STATE.environment,
                orbit: APP_STATE.orbit,
                sound: APP_STATE.sound,
                layout: ASSIGN
            }));
        } catch (e) {}
    }

    /* ================================================================
     * 轻提示（不依赖 3D）
     * ================================================================ */
    var toastEl = document.getElementById("shelf-toast");
    var toastTimer = null;
    function showToast(text) {
        if (!toastEl) { return; }
        toastEl.textContent = text;
        toastEl.classList.add("is-show");
        try {
            window.dispatchEvent(new CustomEvent("shelf:toast", { detail: { text: text } }));
        } catch (e) {}
        if (toastTimer) { clearTimeout(toastTimer); }
        toastTimer = setTimeout(function () {
            toastEl.classList.remove("is-show");
            toastTimer = null;
        }, 1900);
    }

    /* ================================================================
     * 能力探测 & 视图切换
     * ================================================================ */
    function detectGL() {
        try {
            var c = document.createElement("canvas");
            return !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl")));
        } catch (e) { return false; }
    }
    var glOk = hasThree && detectGL();
    var viewportOk = window.innerWidth >= 1024;
    var dataOk = RAW_BOOKS.length > 0;
    var canShelf = computeCanShelf();
    var fallbackMode = false;
    var fallbackAvailable = viewportOk && dataOk && !glOk;
    var sceneInited = false;
    var initFailed = false;
    var initPending = false;
    var shelfApi = null;
    var toggleBtns = [].slice.call(toggle.querySelectorAll("button"));

    function currentView() {
        return body.classList.contains("shelf-active") ? "shelf" : "cards";
    }
    function syncToggle() {
        var v = currentView();
        toggleBtns.forEach(function (btn) {
            var on = btn.getAttribute("data-view") === v;
            btn.classList.toggle("active", on);
            btn.setAttribute("aria-pressed", on ? "true" : "false");
        });
    }
    function rememberView(v) {
        try { localStorage.setItem(STORE_VIEW, v); } catch (e) {}
    }
    function enterFallback() {
        fallbackMode = true;
        body.classList.add("shelf-active");
        document.body.classList.add("shelf-mode");
        host.classList.add("is-fallback");
        var fb = document.getElementById("shelf-fallback");
        var loading = document.getElementById("shelf-loading");
        if (fb) { fb.hidden = false; }
        if (loading) { loading.hidden = true; }
        syncToggle();
        try {
            window.dispatchEvent(new CustomEvent("shelf:fallback"));
        } catch (e) {}
    }
    function leaveFallback() {
        fallbackMode = false;
        host.classList.remove("is-fallback");
        body.classList.remove("shelf-active");
        document.body.classList.remove("shelf-mode");
        var fb = document.getElementById("shelf-fallback");
        if (fb) { fb.hidden = true; }
        syncToggle();
    }

    function setView(view, opts) {
        opts = opts || {};
        if (view === "shelf") {
            if (!featureOn) {
                showToast("3D 书柜功能已关闭，请先点击上方开关开启");
                return;
            }
            if (!canShelf) {
                if (fallbackAvailable) {
                    enterFallback();
                } else {
                    showToast(RAW_BOOKS.length ? "当前设备不支持 3D 视图，可继续使用卡片视图" : "暂无可上架的项目");
                }
                return;
            }
            body.classList.add("shelf-active");
            document.body.classList.add("shelf-mode");
            syncToggle();
            if (!opts.silent) { rememberView("shelf"); }
            if (!sceneInited && !initPending) {
                initPending = true;
                var loading = document.getElementById("shelf-loading");
                if (loading) { loading.hidden = false; }
                requestAnimationFrame(function () {
                    requestAnimationFrame(function () {
                        initPending = false;
                        var ok = false;
                        try { ok = initScene(); } catch (err) {
                            ok = false;
                            if (window.console && console.error) { console.error("[shelf3d]", err); }
                        }
                        sceneInited = true;
                        if (!ok) {
                            initFailed = true;
                            body.classList.remove("shelf-active");
                            document.body.classList.remove("shelf-mode");
                            syncToggle();
                            if (loading) { loading.hidden = true; }
                            showToast("3D 书柜初始化失败，已保留卡片视图");
                            if (toggle) { toggle.style.display = "none"; }
                            canShelf = false;
                            rememberView("cards");
                            return;
                        }
                        if (shelfApi) { shelfApi.resume(); }
                    });
                });
            } else if (shelfApi) {
                shelfApi.resume();
            }
            return;
        }
        if (shelfApi) { shelfApi.pause(); }
        if (fallbackMode) { leaveFallback(); } else {
            body.classList.remove("shelf-active");
            document.body.classList.remove("shelf-mode");
        }
        syncToggle();
        if (!opts.silent) { rememberView("cards"); }
    }

    toggleBtns.forEach(function (btn) {
        btn.addEventListener("click", function () {
            var v = btn.getAttribute("data-view");
            if (v === currentView()) { return; }
            setView(v);
        });
    });
    if (!canShelf && !fallbackAvailable) {
        toggle.style.display = "none";
    }

    /* ---------- 功能开关：显隐 / 状态 / 持久化 ---------- */
    var specLink = document.querySelector(".ui-spec-link");
    var switchBtn = document.getElementById("home-shelf-switch");
    function applyFeatureState() {
        document.body.classList.toggle("shelf-feature-off", !featureOn);
        if (switchBtn) {
            switchBtn.classList.toggle("on", featureOn);
            switchBtn.setAttribute("aria-checked", featureOn ? "true" : "false");
        }
        if (specLink) { specLink.hidden = !featureOn; }
        if (toggle) { toggle.style.display = featureOn && viewportOk && dataOk ? "" : "none"; }
    }
    if (switchBtn) {
        switchBtn.addEventListener("click", function () {
            featureOn = !featureOn;
            writeFeature(featureOn);
            canShelf = computeCanShelf();
            applyFeatureState();
            if (featureOn) {
                showToast("3D 书柜已开启，可切换到 3D 视图");
            } else {
                if (currentView() === "shelf") { setView("cards"); }
                showToast("3D 书柜已关闭，首页恢复卡片视图");
            }
            try {
                window.dispatchEvent(new CustomEvent("shelf:feature", { detail: { enabled: featureOn } }));
            } catch (e) {}
        });
    }
    applyFeatureState();

    document.addEventListener("click", function (e) {
        var target = e.target;
        if (!target || !target.closest) { return; }
        var btn = target.closest('[data-shelf-action="cards"]');
        if (btn) {
            e.preventDefault();
            setView("cards");
        }
    });

    window.addEventListener("resize", function () {
        if (!featureOn) {
            if (toggle) { toggle.style.display = "none"; }
            return;
        }
        if (!canShelf && !fallbackAvailable) {
            toggle.style.display = window.innerWidth < 1024 || !dataOk ? "none" : "";
        } else if (window.innerWidth < 1024) {
            if (!fallbackMode) { toggle.style.display = "none"; }
        } else {
            toggle.style.display = "";
        }
        if (window.innerWidth < 1024 && body.classList.contains("shelf-active")) {
            if (fallbackMode) { leaveFallback(); rememberView("cards"); return; }
            setView("cards");
            showToast("窗口较窄，已切换到卡片视图");
        }
    });

    /* ================================================================
     * 3D 场景（懒初始化）
     * ================================================================ */
    function initScene() {
        var renderer;
        try {
            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
        } catch (e) { return false; }
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setClearColor(0x000000, 0);
        if ("outputEncoding" in renderer && THREE.sRGBEncoding) { renderer.outputEncoding = THREE.sRGBEncoding; }
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = STYLES[APP_STATE.style].exposure;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        /* 场景静态：阴影图仅在书本移动/风格切换时重算，空闲时省掉 shadow pass */
        renderer.shadowMap.autoUpdate = false;
        renderer.shadowMap.needsUpdate = true;

        var canvasEl = renderer.domElement;
        canvasEl.className = "shelf-canvas";
        canvasEl.setAttribute("role", "img");
        canvasEl.setAttribute("tabindex", "0");
        canvasEl.setAttribute("aria-label", "3D 知识书柜：拖拽旋转视角，滚轮缩放，单击书本查看项目，拖动书本可重新摆放");
        host.insertBefore(canvasEl, host.firstChild);

        var cfg = STYLES[APP_STATE.style];
        host.setAttribute("data-style", APP_STATE.style);
        host.setAttribute("data-camera", APP_STATE.camera);
        host.setAttribute("data-environment", APP_STATE.environment);
        host.setAttribute("data-phase", "idle");

        var scene = new THREE.Scene();
        var camera = new THREE.PerspectiveCamera(34, 1, 0.05, 80);
        var orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.05, 80);
        var activeCam = APP_STATE.camera === "ortho" ? orthoCam : camera;

        var maxAniso = renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1;
        function refreshShadow() { renderer.shadowMap.needsUpdate = true; }

        var elStatus = document.getElementById("shelf-status");
        var elCard = document.getElementById("shelf-card");
        var elLoading = document.getElementById("shelf-loading");
        var elFallback = document.getElementById("shelf-fallback");
        var elCardCover = document.getElementById("shelf-card-cover-img");
        var elCardBadge = document.getElementById("shelf-card-badge");
        var elCardName = document.getElementById("shelf-card-name");
        var elCardMeta = document.getElementById("shelf-card-meta");
        var elCardDesc = document.getElementById("shelf-card-desc");
        var elCardStats = document.getElementById("shelf-card-stats");
        var elCardOpen = document.getElementById("shelf-card-open");
        var elCardPut = document.getElementById("shelf-card-putback");
        var elCardClose = document.getElementById("shelf-card-close");

        /* ---------- 纹理缓存 ---------- */
        var TEX = {};
        function texture(canvas, opts) {
            opts = opts || {};
            var t = new THREE.CanvasTexture(canvas);
            t.anisotropy = maxAniso;
            if (opts.srgb !== false) { t.encoding = THREE.sRGBEncoding; }
            if (opts.repeat) {
                t.wrapS = t.wrapT = THREE.RepeatWrapping;
                if (opts.repeat !== true) { t.repeat.set(opts.repeat[0], opts.repeat[1]); }
            }
            t.needsUpdate = true;
            return t;
        }
        function cached(key, maker) {
            if (!TEX[key]) { TEX[key] = maker(); }
            return TEX[key];
        }

        var IMG_CACHE = {};
        var COVER_TEX = {};
        var COVER_MAT = {};
        var pendingCover = [];

        /* ---------- 材质工厂 ---------- */
        function woodTexture(horizontal, dark, painted) {
            var W = 512, H = 512;
            var c = newCanvas(W, H), ctx = c.getContext("2d");
            var base = painted ? (dark ? "#8C5A32" : "#A9713F") : (dark ? "#3E2819" : "#4F3524");
            var base2 = painted ? (dark ? "#9C6539" : "#B97E46") : (dark ? "#4A2F1E" : "#5C3F2A");
            ctx.fillStyle = base;
            ctx.fillRect(0, 0, W, H);
            var rnd = mulberry32(dark ? 11 : 29);
            if (painted) {
                /* 风格化：大笔触手绘木纹 */
                for (var p = 0; p < 18; p++) {
                    var py = rnd() * H;
                    ctx.fillStyle = "rgba(" + (rnd() < 0.5 ? "255,226,180" : "96,58,30") + "," + (0.05 + rnd() * 0.08) + ")";
                    if (horizontal) { ctx.fillRect(0, py, W, 14 + rnd() * 36); }
                    else { ctx.fillRect(py, 0, 14 + rnd() * 36, H); }
                }
                for (var q = 0; q < 30; q++) {
                    var qy = rnd() * H;
                    ctx.strokeStyle = "rgba(84,50,24," + (0.08 + rnd() * 0.12) + ")";
                    ctx.lineWidth = 3 + rnd() * 7;
                    ctx.beginPath();
                    if (horizontal) { ctx.moveTo(0, qy); ctx.lineTo(W, qy + (rnd() - 0.5) * 16); }
                    else { ctx.moveTo(qy, 0); ctx.lineTo(qy + (rnd() - 0.5) * 16, H); }
                    ctx.stroke();
                }
                seedNoise(ctx, W, H, 900, 0.05, 3);
                return texture(c, { repeat: [1, 1] });
            }
            /* 底层色带 */
            for (var i = 0; i < 26; i++) {
                var y = rnd() * H;
                var h = 6 + rnd() * 34;
                ctx.fillStyle = "rgba(" + (dark ? "74,47,30" : "92,63,42") + "," + (0.06 + rnd() * 0.12) + ")";
                if (horizontal) { ctx.fillRect(0, y, W, h); }
                else { ctx.fillRect(y, 0, h, H); }
            }
            /* 木纹线 */
            for (var g = 0; g < 90; g++) {
                var pos = rnd() * W;
                var alpha = 0.05 + rnd() * 0.16;
                ctx.strokeStyle = "rgba(38,24,15," + alpha + ")";
                ctx.lineWidth = 0.6 + rnd() * 1.8;
                ctx.beginPath();
                for (var s = 0; s <= W; s += 16) {
                    var wobble = Math.sin(s * 0.02 + g) * (3 + rnd() * 5);
                    var p = pos + wobble;
                    if (s === 0) {
                        if (horizontal) { ctx.moveTo(s, p); } else { ctx.moveTo(p, s); }
                    } else {
                        if (horizontal) { ctx.lineTo(s, p); } else { ctx.lineTo(p, s); }
                    }
                }
                ctx.stroke();
            }
            /* 小节疤 */
            for (var k = 0; k < 3; k++) {
                var kx = rnd() * W, ky = rnd() * H;
                var kr = 4 + rnd() * 9;
                var grad = ctx.createRadialGradient(kx, ky, 0, kx, ky, kr * 2.4);
                grad.addColorStop(0, "rgba(32,20,12,.55)");
                grad.addColorStop(0.5, "rgba(46,30,19,.28)");
                grad.addColorStop(1, "rgba(46,30,19,0)");
                ctx.fillStyle = grad;
                ctx.beginPath(); ctx.ellipse(kx, ky, kr * 2.4, kr * 1.2, rnd() * 3, 0, Math.PI * 2); ctx.fill();
            }
            /* 高光丝 */
            for (var m = 0; m < 24; m++) {
                var mp = rnd() * H;
                ctx.strokeStyle = "rgba(255,226,190," + (0.03 + rnd() * 0.05) + ")";
                ctx.lineWidth = 0.8 + rnd();
                ctx.beginPath();
                if (horizontal) { ctx.moveTo(0, mp); ctx.lineTo(W, mp + (rnd() - 0.5) * 8); }
                else { ctx.moveTo(mp, 0); ctx.lineTo(mp + (rnd() - 0.5) * 8, H); }
                ctx.stroke();
            }
            seedNoise(ctx, W, H, 1400, 0.05, 2);
            return texture(c, { repeat: [1, 1] });
        }

        function clothTexture(hex) {
            var W = 256, H = 256;
            var c = newCanvas(W, H), ctx = c.getContext("2d");
            ctx.fillStyle = hex;
            ctx.fillRect(0, 0, W, H);
            for (var y = 0; y < H; y += 3) {
                ctx.fillStyle = "rgba(255,255,255," + (y % 6 === 0 ? 0.045 : 0.018) + ")";
                ctx.fillRect(0, y, W, 1);
            }
            for (var x = 0; x < W; x += 3) {
                ctx.fillStyle = "rgba(0,0,0," + (x % 6 === 0 ? 0.05 : 0.02) + ")";
                ctx.fillRect(x, 0, 1, H);
            }
            var rnd = mulberry32(hex.length + hex.charCodeAt(1));
            for (var i = 0; i < 500; i++) {
                ctx.fillStyle = "rgba(255,255,255," + (rnd() * 0.06) + ")";
                ctx.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 2, 1);
            }
            return texture(c, { repeat: [2, 3] });
        }

        function paperTexture() {
            var W = 256, H = 256;
            var c = newCanvas(W, H), ctx = c.getContext("2d");
            ctx.fillStyle = "#F4EBD9";
            ctx.fillRect(0, 0, W, H);
            for (var y = 0; y < H; y += 2) {
                ctx.fillStyle = "rgba(132,106,70," + (0.1 + (y % 6 === 0 ? 0.1 : 0)) + ")";
                ctx.fillRect(0, y, W, 1);
            }
            seedNoise(ctx, W, H, 300, 0.04, 1.4);
            return texture(c, { repeat: [1, 1] });
        }

        function spineTexture(m) {
            var key = m.real ? ("spine:r:" + m.key) : ("spine:f:" + m.color.hex + ":" + (m.variant % 2));
            return cached(key, function () {
                var W = 256, H = 1024;
                var c = newCanvas(W, H), ctx = c.getContext("2d");
                var col = m.color.hex;
                ctx.fillStyle = col;
                ctx.fillRect(0, 0, W, H);
                /* 布料织纹 */
                for (var y = 0; y < H; y += 4) {
                    ctx.fillStyle = "rgba(255,255,255," + (y % 8 === 0 ? 0.06 : 0.025) + ")";
                    ctx.fillRect(0, y, W, 1);
                }
                for (var x = 0; x < W; x += 4) {
                    ctx.fillStyle = "rgba(0,0,0," + (x % 8 === 0 ? 0.06 : 0.025) + ")";
                    ctx.fillRect(x, 0, 1, H);
                }
                /* 圆背书脊的明暗（中间亮、两侧暗） */
                var spineShade = ctx.createLinearGradient(0, 0, W, 0);
                spineShade.addColorStop(0, "rgba(0,0,0,.34)");
                spineShade.addColorStop(0.18, "rgba(0,0,0,.06)");
                spineShade.addColorStop(0.5, "rgba(255,255,255,.16)");
                spineShade.addColorStop(0.82, "rgba(0,0,0,.06)");
                spineShade.addColorStop(1, "rgba(0,0,0,.34)");
                ctx.fillStyle = spineShade;
                ctx.fillRect(0, 0, W, H);
                /* 堵头布 */
                ctx.fillStyle = "rgba(238,228,208,.85)";
                ctx.fillRect(0, 0, W, 7);
                ctx.fillRect(0, H - 7, W, 7);
                ctx.fillStyle = "rgba(20,14,8,.55)";
                ctx.fillRect(0, 7, W, 4);
                ctx.fillRect(0, H - 11, W, 4);
                /* 烫金带 */
                function goldRect(x, y, w, h) {
                    var grad = ctx.createLinearGradient(x, y, x + w, y);
                    grad.addColorStop(0, "#8f6d16");
                    grad.addColorStop(0.3, "#C9A227");
                    grad.addColorStop(0.5, "#F4DE92");
                    grad.addColorStop(0.7, "#C9A227");
                    grad.addColorStop(1, "#8f6d16");
                    ctx.fillStyle = grad;
                    ctx.fillRect(x, y, w, h);
                }
                var bandTop = 64 + (m.variant % 3) * 16;
                var bandH = 26 + (m.variant % 2) * 10;
                goldRect(30, bandTop, W - 60, bandH);
                goldRect(30, H - bandTop - bandH, W - 60, bandH);
                goldRect(30, bandTop + bandH + 8, W - 60, 4);
                goldRect(30, H - bandTop - bandH - 12, W - 60, 4);
                /* 标签贴片（三分之一的书） */
                if (m.variant % 3 === 0) {
                    var lx = 38, ly = H * 0.34, lw = W - 76, lh = H * 0.26;
                    ctx.fillStyle = "rgba(24,18,12,.22)";
                    ctx.fillRect(lx, ly, lw, lh);
                    ctx.strokeStyle = "rgba(201,162,39,.75)";
                    ctx.lineWidth = 3;
                    ctx.strokeRect(lx + 5, ly + 5, lw - 10, lh - 10);
                }
                var light = luminance(col) > 0.62;
                var fg = light ? "rgba(32,26,18,.9)" : "rgba(248,240,225,.94)";
                if (m.real) {
                    var meta = m.meta || {};
                    ctx.save();
                    ctx.translate(W / 2, H / 2);
                    ctx.rotate(-Math.PI / 2);
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillStyle = "rgba(201,162,39,.95)";
                    ctx.font = '600 46px ' + FONT;
                    var title = String(meta.name || "");
                    if (title.length > 13) { title = title.slice(0, 12) + "…"; }
                    ctx.fillText(title, 0, 2);
                    if (meta.author) {
                        ctx.fillStyle = light ? "rgba(40,32,22,.75)" : "rgba(248,240,225,.66)";
                        ctx.font = '400 25px ' + FONT;
                        ctx.fillText(meta.author, 0, 58);
                    }
                    ctx.restore();
                } else {
                    /* 示例书：装饰图案，无可读文字 */
                    ctx.save();
                    ctx.translate(W / 2, H / 2);
                    ctx.rotate(-Math.PI / 2);
                    ctx.strokeStyle = "rgba(255,255,255,.42)";
                    ctx.lineWidth = 3;
                    ctx.beginPath(); ctx.moveTo(-46, -20); ctx.lineTo(46, -20); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(-46, 20); ctx.lineTo(46, 20); ctx.stroke();
                    ctx.fillStyle = "rgba(214,184,92,.85)";
                    ctx.beginPath();
                    ctx.moveTo(0, -12); ctx.lineTo(11, 0); ctx.lineTo(0, 12); ctx.lineTo(-11, 0); ctx.closePath();
                    ctx.fill();
                    ctx.fillStyle = "rgba(255,255,255,.5)";
                    ctx.fillRect(-3, -86, 6, 48);
                    ctx.restore();
                }
                seedNoise(ctx, W, H, 260, 0.045, 2);
                return texture(c, { repeat: [1, 1] });
            });
        }

        function coverTexture(m) {
            var meta = m.meta || {};
            if (m.real && COVER_TEX[m.key]) { return COVER_TEX[m.key]; }
            if (!m.real) { return null; }
            var W = 512, H = 768;
            var c = newCanvas(W, H), ctx = c.getContext("2d");
            function paint() {
                ctx.fillStyle = m.color.hex;
                ctx.fillRect(0, 0, W, H);
                var grad = ctx.createLinearGradient(0, 0, W, H);
                grad.addColorStop(0, "rgba(255,255,255,.12)");
                grad.addColorStop(1, "rgba(0,0,0,.18)");
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, W, H);
                var light = luminance(m.color.hex) > 0.62;
                var fg = light ? "rgba(32,26,18,.92)" : "rgba(250,243,230,.94)";
                ctx.strokeStyle = light ? "rgba(32,26,18,.35)" : "rgba(255,255,255,.4)";
                ctx.lineWidth = 3;
                ctx.strokeRect(44, 44, W - 88, H - 88);
                ctx.fillStyle = fg;
                ctx.textAlign = "center";
                ctx.font = '600 46px ' + FONT;
                var lines = wrapText(ctx, meta.name || "未命名项目", W - 130).slice(0, 3);
                lines.forEach(function (ln, i) { ctx.fillText(ln, W / 2, 250 + i * 62); });
                ctx.font = '400 24px ' + FONT;
                ctx.fillStyle = light ? "rgba(32,26,18,.6)" : "rgba(255,255,255,.66)";
                ctx.fillText(meta.author || "佚名", W / 2, 470);
                var gold = ctx.createLinearGradient(0, 0, W, 0);
                gold.addColorStop(0, "#8f6d16"); gold.addColorStop(0.5, "#F0D67A"); gold.addColorStop(1, "#8f6d16");
                ctx.fillStyle = gold;
                ctx.fillRect(120, 510, W - 240, 6);
                ctx.fillStyle = light ? "rgba(32,26,18,.5)" : "rgba(255,255,255,.55)";
                ctx.font = '400 22px ' + FONT;
                if (meta.docs > 0) { ctx.fillText(meta.docs + " 篇文档", W / 2, 580); }
                ctx.font = '400 18px ' + FONT;
                ctx.fillText("MinDoc 知识库", W / 2, H - 70);
            }
            paint();
            var t = texture(c);
            COVER_TEX[m.key] = t;
            if (meta.coverSrc) {
                var img = IMG_CACHE[meta.coverSrc] || new Image();
                IMG_CACHE[meta.coverSrc] = img;
                var apply = function () {
                    try {
                        var s = Math.max(W / img.width, H / img.height);
                        var dw = img.width * s, dh = img.height * s;
                        ctx.fillStyle = "#F5F1E8";
                        ctx.fillRect(0, 0, W, H);
                        ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
                        ctx.strokeStyle = "rgba(0,0,0,.2)";
                        ctx.lineWidth = 2;
                        ctx.strokeRect(2, 2, W - 4, H - 4);
                        t.needsUpdate = true;
                    } catch (e) {}
                };
                if (img.complete && img.naturalWidth) { apply(); }
                else {
                    img.crossOrigin = "anonymous";
                    img.onload = apply;
                    img.onerror = function () {};
                    pendingCover.push(img);
                    if (!img.getAttribute("src")) { img.src = meta.coverSrc; }
                }
            }
            return t;
        }

        function makeWoodMaterial(kind) {
            var key = "wood:" + APP_STATE.style + ":" + kind;
            return cached(key, function () {
                if (cfg.woodTex) {
                    var painted = APP_STATE.style === "stylized";
                    var map = woodTexture(kind === "plank" || kind === "door", kind === "dark" || kind === "back", painted);
                    var mat = new THREE.MeshStandardMaterial({
                        map: map,
                        bumpMap: map,
                        bumpScale: 0.004,
                        roughness: 0.46,
                        metalness: 0.02,
                        envMapIntensity: cfg.envInt
                    });
                    if (kind === "back") { mat.color = new THREE.Color(0xffffff); mat.roughness = 0.82; }
                    return mat;
                }
                var color;
                if (APP_STATE.style === "stylized") {
                    color = kind === "dark" || kind === "back" ? 0x8C5A32 : 0xB97E46;
                } else {
                    color = kind === "dark" || kind === "back" ? 0xB69D79 : 0xCDB58F;
                }
                var m2 = new THREE.MeshStandardMaterial({
                    color: color,
                    roughness: APP_STATE.style === "lowpoly" ? 0.95 : 0.82,
                    metalness: 0,
                    flatShading: cfg.flatShading,
                    envMapIntensity: cfg.envInt
                });
                return m2;
            });
        }

        var pageMaterial = null;
        function getPageMaterial() {
            if (!pageMaterial) {
                if (cfg.bookTex) {
                    var pt = paperTexture();
                    pageMaterial = new THREE.MeshStandardMaterial({
                        map: pt, bumpMap: pt, bumpScale: 0.002,
                        color: 0xfaf4e8, roughness: 0.92, metalness: 0, envMapIntensity: cfg.envInt * 0.5
                    });
                } else {
                    pageMaterial = new THREE.MeshStandardMaterial({
                        color: APP_STATE.style === "stylized" ? 0xF7ECD8 : 0xF2E7D2,
                        roughness: 0.95, metalness: 0, flatShading: cfg.flatShading, envMapIntensity: cfg.envInt
                    });
                }
            }
            return pageMaterial;
        }
        function getClothMaterial(m) {
            var key = "cloth:" + APP_STATE.style + ":" + m.color.hex;
            if (!cached(key, function () { return null; })) {
                TEX[key] = null;
            }
            return cached(key + ":mat", function () {
                if (cfg.bookTex) {
                    var tx = clothTexture(m.color.hex);
                    return new THREE.MeshStandardMaterial({
                        map: tx, bumpMap: tx, bumpScale: 0.0018,
                        roughness: 0.85, metalness: 0, envMapIntensity: cfg.envInt * 0.7
                    });
                }
                return new THREE.MeshStandardMaterial({
                    color: m.color.hex,
                    roughness: APP_STATE.style === "lowpoly" ? 0.98 : 0.82,
                    metalness: 0,
                    flatShading: cfg.flatShading,
                    envMapIntensity: cfg.envInt
                });
            });
        }
        function getSpineMaterial(m) {
            var key = "spinemat:" + APP_STATE.style + ":" + m.key;
            return cached(key, function () {
                if (cfg.bookTex) {
                    return new THREE.MeshStandardMaterial({
                        map: spineTexture(m),
                        bumpMap: spineTexture(m),
                        bumpScale: 0.0015,
                        roughness: 0.62,
                        metalness: 0.06,
                        envMapIntensity: cfg.envInt
                    });
                }
                var c = m.color.hex;
                return new THREE.MeshStandardMaterial({
                    color: new THREE.Color(c).multiplyScalar(APP_STATE.style === "stylized" ? 1.02 : 0.95),
                    roughness: 0.85,
                    metalness: 0,
                    flatShading: cfg.flatShading,
                    envMapIntensity: cfg.envInt
                });
            });
        }
        function getCoverMaterial(m) {
            if (!m.real) { return getClothMaterial(m); }
            var key = "covermat:" + APP_STATE.style + ":" + m.key;
            return cached(key, function () {
                if (cfg.bookTex) {
                    var tx = coverTexture(m);
                    return new THREE.MeshStandardMaterial({
                        map: tx, roughness: 0.72, metalness: 0.01, envMapIntensity: cfg.envInt
                    });
                }
                return new THREE.MeshStandardMaterial({
                    color: m.color.hex,
                    roughness: 0.85,
                    metalness: 0,
                    flatShading: cfg.flatShading,
                    envMapIntensity: cfg.envInt
                });
            });
        }
        function makeBrassMaterial() {
            return cached("brass:" + APP_STATE.style, function () {
                if (APP_STATE.style === "lowpoly") {
                    return new THREE.MeshStandardMaterial({ color: 0xC9A227, roughness: 0.7, metalness: 0.3, flatShading: true });
                }
                return new THREE.MeshStandardMaterial({
                    color: 0xB08A3E, roughness: 0.4, metalness: 0.72, envMapIntensity: Math.max(0.4, cfg.envInt)
                });
            });
        }
        function makeTerracottaMaterial() {
            return cached("terra:" + APP_STATE.style, function () {
                return new THREE.MeshStandardMaterial({
                    color: APP_STATE.style === "stylized" ? 0xC97A50 : 0xB4654A,
                    roughness: APP_STATE.style === "stylized" ? 0.8 : 0.72,
                    metalness: 0.02,
                    flatShading: cfg.flatShading,
                    envMapIntensity: cfg.envInt
                });
            });
        }

        /* ---------- 几何工具 ---------- */
        function roundedBoxGeo(w, h, d, r) {
            if (!r || r <= 0.0005) {
                return new THREE.BoxGeometry(w, h, d);
            }
            r = Math.min(r, w / 2 - 0.0005, h / 2 - 0.0005, d / 2 - 0.0005);
            var shape = new THREE.Shape();
            var x = -w / 2, y = -h / 2;
            shape.moveTo(x + r, y);
            shape.lineTo(x + w - r, y);
            shape.quadraticCurveTo(x + w, y, x + w, y + r);
            shape.lineTo(x + w, y + h - r);
            shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
            shape.lineTo(x + r, y + h);
            shape.quadraticCurveTo(x, y + h, x, y + h - r);
            shape.lineTo(x, y + r);
            shape.quadraticCurveTo(x, y, x + r, y);
            var geo = new THREE.ExtrudeGeometry(shape, {
                depth: Math.max(d - 2 * r, 0.001),
                bevelEnabled: true,
                bevelSize: r,
                bevelThickness: r,
                bevelSegments: 2,
                curveSegments: 3,
                steps: 1
            });
            geo.center();
            return geo;
        }

        function bookGeometry(t, h, d, groupFaces) {
            var geo = new THREE.BoxGeometry(t, h, d, 1, 1, 1);
            if (!groupFaces) { return geo; }
            var idx = geo.index.array;
            var out = [];
            groupFaces.forEach(function (faces) {
                faces.forEach(function (f) {
                    for (var k = 0; k < 6; k++) { out.push(idx[f * 6 + k]); }
                });
            });
            geo.setIndex(out);
            geo.clearGroups();
            var start = 0;
            groupFaces.forEach(function (faces, i) {
                geo.addGroup(start, faces.length * 6, i);
                start += faces.length * 6;
            });
            return geo;
        }

        /* ---------- 场景根 ---------- */
        var sceneRoot = new THREE.Group();
        scene.add(sceneRoot);
        var envRoot = new THREE.Group();
        var shelfRoot = new THREE.Group();
        var studioRoot = new THREE.Group();
        var roomRoot = new THREE.Group();
        envRoot.add(studioRoot);
        envRoot.add(roomRoot);
        sceneRoot.add(envRoot);
        sceneRoot.add(shelfRoot);

        /* ---------- 环境反射贴图（PMREM） ---------- */
        var envTexture = null;
        try {
            var envCanvas = newCanvas(1024, 512);
            var ectx = envCanvas.getContext("2d");
            var eg = ectx.createLinearGradient(0, 0, 0, 512);
            eg.addColorStop(0, "#d9cfbc");
            eg.addColorStop(0.42, "#a99d89");
            eg.addColorStop(0.56, "#75695a");
            eg.addColorStop(1, "#241d17");
            ectx.fillStyle = eg;
            ectx.fillRect(0, 0, 1024, 512);
            var glow = ectx.createRadialGradient(300, 150, 10, 300, 150, 380);
            glow.addColorStop(0, "rgba(255,244,215,.55)");
            glow.addColorStop(1, "rgba(255,244,215,0)");
            ectx.fillStyle = glow;
            ectx.fillRect(0, 0, 1024, 512);
            var envTex = texture(envCanvas);
            envTex.mapping = THREE.EquirectangularReflectionMapping;
            var pmrem = new THREE.PMREMGenerator(renderer);
            pmrem.compileEquirectangularShader();
            var rt = pmrem.fromEquirectangular(envTex);
            envTexture = rt.texture;
            scene.environment = envTexture;
            envTex.dispose();
            pmrem.dispose();
        } catch (e) {
            scene.environment = null;
        }

        /* ---------- 灯光 ---------- */
        var studioLights = new THREE.Group();
        var roomLights = new THREE.Group();
        sceneRoot.add(studioLights);
        sceneRoot.add(roomLights);

        function addLights(group, kind) {
            if (kind === "studio") {
                var hemi = new THREE.HemisphereLight(0xfff7ea, 0x7d6a52, 0.38);
                group.add(hemi);
                group.add(new THREE.AmbientLight(0xffeedc, 0.14));
                var key = new THREE.DirectionalLight(0xfff2de, 1.38);
                key.position.set(1.9, 3.1, 2.8);
                key.castShadow = true;
                key.shadow.mapSize.set(1536, 1536);
                key.shadow.camera.left = -1.5;
                key.shadow.camera.right = 1.5;
                key.shadow.camera.top = 2.2;
                key.shadow.camera.bottom = -0.4;
                key.shadow.camera.near = 0.5;
                key.shadow.camera.far = 9;
                key.shadow.bias = -0.00035;
                key.shadow.normalBias = 0.02;
                key.shadow.radius = 3;
                group.add(key);
                group.add(key.target);
                key.target.position.set(0, 1.0, 0);
                var fill = new THREE.DirectionalLight(0xdfe9ff, 0.22);
                fill.position.set(-3, 1.6, 2.4);
                group.add(fill);
                var rim = new THREE.DirectionalLight(0xffd9a8, 0.55);
                rim.position.set(-1.6, 2.4, -2.4);
                group.add(rim);
                var bounce = new THREE.DirectionalLight(0xffe6cd, 0.2);
                bounce.position.set(-0.4, -2.2, 2.4);
                group.add(bounce);
            } else {
                var hemi2 = new THREE.HemisphereLight(0xffeed4, 0x7a6250, 0.34);
                group.add(hemi2);
                group.add(new THREE.AmbientLight(0xffe4c4, 0.12));
                var win = new THREE.DirectionalLight(0xffd6a0, 1.5);
                win.position.set(-3.4, 2.6, 2.0);
                win.castShadow = true;
                win.shadow.mapSize.set(1536, 1536);
                win.shadow.camera.left = -2.2;
                win.shadow.camera.right = 2.2;
                win.shadow.camera.top = 2.6;
                win.shadow.camera.bottom = -0.6;
                win.shadow.camera.near = 0.5;
                win.shadow.camera.far = 12;
                win.shadow.bias = -0.0004;
                win.shadow.normalBias = 0.02;
                win.shadow.radius = 4;
                group.add(win);
                group.add(win.target);
                win.target.position.set(0, 1.1, 0);
                var warm = new THREE.PointLight(0xffc98a, 0.4, 5, 2);
                warm.position.set(0.2, 2.5, 0.8);
                group.add(warm);
                var cool = new THREE.DirectionalLight(0xcfe0ff, 0.14);
                cool.position.set(3, 1.2, 1.5);
                group.add(cool);
                var bounce2 = new THREE.DirectionalLight(0xffdfba, 0.16);
                bounce2.position.set(0.4, -2.2, 2.2);
                group.add(bounce2);
            }
        }
        addLights(studioLights, "studio");
        addLights(roomLights, "room");
        studioLights.visible = APP_STATE.environment === "studio";
        roomLights.visible = APP_STATE.environment === "room";

        /* ---------- 柜体 ---------- */
        function buildCabinet(styleCfg) {
            var g = new THREE.Group();
            var woodFront = makeWoodMaterial("front");
            var woodDark = makeWoodMaterial("dark");
            var woodPlank = makeWoodMaterial("plank");
            var woodBack = makeWoodMaterial("back");
            var brass = makeBrassMaterial();

            function addBox(w, h, d, x, y, z, mat, rounded) {
                var geo = rounded ? roundedBoxGeo(w, h, d, styleCfg.radius) : new THREE.BoxGeometry(w, h, d);
                var mesh = new THREE.Mesh(geo, mat);
                mesh.position.set(x, y, z);
                mesh.castShadow = !!styleCfg.shadow;
                mesh.receiveShadow = !!styleCfg.shadow;
                g.add(mesh);
                return mesh;
            }

            /* 踢脚 */
            addBox(DIM.outerW - 0.02, DIM.plinthH, DIM.outerD - 0.02, 0, DIM.plinthH / 2, -0.008, woodDark, true);
            /* 下柜体 */
            addBox(DIM.outerW - 0.002, DIM.cabinetH, DIM.outerD, 0, DIM.plinthH + DIM.cabinetH / 2, 0, woodFront, true);
            /* 侧板 */
            var sideH = DIM.topY - DIM.plinthH;
            addBox(DIM.sideT, sideH, DIM.outerD, -(DIM.innerW / 2 + DIM.sideT / 2), DIM.plinthH + sideH / 2, 0, woodFront, true);
            addBox(DIM.sideT, sideH, DIM.outerD, (DIM.innerW / 2 + DIM.sideT / 2), DIM.plinthH + sideH / 2, 0, woodFront, true);
            /* 背板 */
            addBox(DIM.innerW - 0.002, sideH, 0.012, 0, DIM.plinthH + sideH / 2, -DIM.outerD / 2 + 0.007, woodBack, false);
            /* 层板（4 块，第 0 层由下柜顶面承担） */
            for (var i = 1; i < DIM.floors.length; i++) {
                var y = DIM.floors[i] - DIM.plankT / 2;
                addBox(DIM.innerW, DIM.plankT, DIM.innerD - 0.004, 0, y, -0.004, woodPlank, true);
            }
            /* 顶板 + 压顶 */
            addBox(DIM.outerW + 0.022, DIM.topT, DIM.outerD + 0.022, 0, DIM.topY + DIM.topT / 2, 0, woodFront, true);
            addBox(DIM.outerW + 0.03, 0.012, DIM.outerD + 0.03, 0, DIM.topY + DIM.topT + 0.006, 0, woodFront, true);

            /* 下柜双门 + 黄铜拉手（提示词包 §1） */
            /* 层板前沿收边：让每层层板有清晰的实木边缘 */
            for (var pi = 1; pi < DIM.floors.length; pi++) {
                var py = DIM.floors[pi] - DIM.plankT / 2;
                addBox(DIM.innerW + 0.002, DIM.plankT, 0.006, 0, py, DIM.innerD / 2 - 0.008, woodDark, false);
            }
            /* 层板底部假 AO 条：书与层板之间更“坐实” */
            var aoCanvas = newCanvas(64, 64);
            var actx = aoCanvas.getContext("2d");
            var agrad = actx.createLinearGradient(0, 0, 0, 64);
            agrad.addColorStop(0, "rgba(28,18,10,0)");
            agrad.addColorStop(0.55, "rgba(28,18,10,.18)");
            agrad.addColorStop(1, "rgba(28,18,10,.5)");
            actx.fillStyle = agrad;
            actx.fillRect(0, 0, 64, 64);
            var aoTex = texture(aoCanvas);
            var aoMat = new THREE.MeshBasicMaterial({ map: aoTex, transparent: true, depthWrite: false });
            for (var ai = 0; ai < DIM.floors.length; ai++) {
                var aoPlane = new THREE.Mesh(new THREE.PlaneGeometry(DIM.innerW - 0.01, 0.075), aoMat);
                aoPlane.position.set(0, DIM.floors[ai] + 0.0375, DIM.backZ + 0.004);
                g.add(aoPlane);
            }

            var doorW = (DIM.innerW - 0.008) / 2;
            var doorH = DIM.cabinetH - 0.085;
            var doorY = DIM.plinthH + 0.04 + doorH / 2;
            var doorZ = DIM.outerD / 2 - 0.006;
            [-1, 1].forEach(function (sgn) {
                var dx = sgn * (doorW / 2 + 0.004);
                addBox(doorW - 0.004, doorH, 0.02, dx, doorY, doorZ, woodFront, true);
                addBox(doorW - 0.062, doorH - 0.062, 0.006, dx, doorY, doorZ + 0.012, woodDark, true);
                if (styleCfg.key !== "lowpoly") {
                    var barGeo = new THREE.CylinderGeometry(0.0055, 0.0055, 0.13, 10);
                    var bar = new THREE.Mesh(barGeo, brass);
                    bar.position.set(sgn * 0.035, doorY + 0.02, doorZ + 0.03);
                    bar.castShadow = true;
                    g.add(bar);
                    [-0.048, 0.048].forEach(function (dy) {
                        var stub = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.03, 8), brass);
                        stub.rotation.x = Math.PI / 2;
                        stub.position.set(sgn * 0.035, doorY + 0.02 + dy, doorZ + 0.018);
                        g.add(stub);
                    });
                } else {
                    var knob = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.05, 0.02), brass);
                    knob.position.set(sgn * 0.035, doorY, doorZ + 0.022);
                    g.add(knob);
                }
            });
            return g;
        }

        /* ---------- 书籍对象 ---------- */
        var BOOK_OBJ = [];
        var BOOK_BY_KEY = {};
        var pickList = [];
        var outlineMaterial = new THREE.MeshBasicMaterial({
            color: 0x2fbf7e, side: THREE.BackSide, transparent: true, opacity: 0.62, depthWrite: false
        });
        var socketGeometry = new THREE.SphereGeometry(0.0055, 10, 8);
        var socketMaterial = new THREE.MeshStandardMaterial({
            color: 0xD9B44A, roughness: 0.3, metalness: 0.85, emissive: 0x4a3505, emissiveIntensity: 0.2
        });

        var PROP = {
            shelf: 2,
            plantX: DIM.innerW / 2 - 0.09,
            mugX: DIM.innerW / 2 - 0.205
        };

        function bookZ(d) {
            return DIM.frontZ - 0.02 - d / 2;
        }

        function flatHeightBelow(si, m, a) {
            var below = 0;
            MODELS.forEach(function (other) {
                if (other.key === m.key) { return; }
                var oa = ASSIGN[other.key];
                if (!oa || oa.s !== si || oa.o !== "f") { return; }
                if (oa.l < a.l) { below += other.t * cfg.bookScale + 0.0015; }
            });
            return below;
        }

        function buildBooks(styleCfg) {
            BOOK_OBJ = [];
            BOOK_BY_KEY = {};
            pickList = [];
            var scale = styleCfg.bookScale;
            MODELS.forEach(function (m) {
                var a = ASSIGN[m.key];
                if (!a) { return; }
                var t = m.t * scale, h = m.h, d = m.d;
                var group = new THREE.Group();
                var mesh;

                if (APP_STATE.style === "lowpoly") {
                    var gLow = new THREE.BoxGeometry(t, h, d);
                    var matLow = new THREE.MeshStandardMaterial({
                        color: m.color.hex, roughness: 0.97, metalness: 0, flatShading: true,
                        envMapIntensity: 0.04
                    });
                    mesh = new THREE.Mesh(gLow, matLow);
                } else {
                    var cloth = getClothMaterial(m);
                    var spine = getSpineMaterial(m);
                    var page = getPageMaterial();
                    if (m.real) {
                        var gReal = bookGeometry(t, h, d, [[0], [1], [4], [2, 3, 5]]);
                        mesh = new THREE.Mesh(gReal, [getCoverMaterial(m), cloth, spine, page]);
                    } else {
                        var gFill = bookGeometry(t, h, d, [[0, 1], [4], [2, 3, 5]]);
                        mesh = new THREE.Mesh(gFill, [cloth, spine, page]);
                    }
                }
                mesh.castShadow = !!styleCfg.shadow;
                mesh.receiveShadow = !!styleCfg.shadow;
                group.add(mesh);

                var outline = new THREE.Mesh(new THREE.BoxGeometry(t * 1.13, h * 1.05, d * 1.16), outlineMaterial);
                outline.visible = false;
                group.add(outline);

                var socket = new THREE.Mesh(socketGeometry, socketMaterial);
                socket.position.set(0, h / 2 - 0.012, d / 2 + 0.002);
                socket.visible = false;
                group.add(socket);

                var pick = new THREE.Mesh(
                    new THREE.BoxGeometry(t * 1.4, h * 1.08, d * 1.8),
                    new THREE.MeshBasicMaterial({ visible: false })
                );
                pick.userData.key = m.key;
                group.add(pick);
                pickList.push(pick);

                shelfRoot.add(group);

                var obj = {
                    model: m, group: group, mesh: mesh, outline: outline,
                    socket: socket, pick: pick, a: a, dims: { t: t, h: h, d: d },
                    baseZ: bookZ(d), hover: 0, scaleCur: 1
                };
                BOOK_OBJ.push(obj);
                BOOK_BY_KEY[m.key] = obj;
                applyBookPose(obj, true);
            });
        }

        function applyBookPose(obj, immediate) {
            var m = obj.model, a = obj.a, floor = DIM.floors[a.s];
            var pos = obj.group.position, rot = obj.group.rotation;
            if (a.o === "f") {
                var below = flatHeightBelow(a.s, m, a);
                var ty = floor + below + (m.t * cfg.bookScale) / 2 + 0.001;
                pos.set(a.x, ty, obj.baseZ + 0.01);
                rot.set(0, (m.variant % 7 - 3) * 0.012, Math.PI / 2);
            } else {
                var tilt = m.tilt || 0;
                var bottom = (obj.dims.h / 2) * Math.cos(Math.abs(tilt)) + (obj.dims.t / 2) * Math.sin(Math.abs(tilt));
                var jitterZ = ((m.variant % 7) - 3) * 0.0022;
                var yaw = ((m.variant % 5) - 2) * 0.008;
                pos.set(a.x, floor + bottom + 0.001, obj.baseZ + jitterZ + (m.pulled ? 0.055 : 0));
                rot.set(0, yaw, tilt);
            }
            obj.group.scale.setScalar(1);
            if (obj.socket) { obj.socket.visible = false; }
            if (obj.outline) { obj.outline.visible = false; }
        }

        /* ---------- 层板占用 / 空位计算（拖动时使用） ---------- */
        function bookWidth(m, a) {
            return a.o === "f" ? m.h : m.t * cfg.bookScale;
        }

        function bookendX(si) {
            var plan = null;
            for (var i = 0; i < PLAN.length; i++) { if (PLAN[i].s === si) { plan = PLAN[i]; } }
            if (!plan || !plan.lean) { return null; }
            var maxRight = null;
            MODELS.forEach(function (m) {
                var a = ASSIGN[m.key];
                if (!a || a.s !== si || a.o !== "u") { return; }
                var edge = a.x + bookWidth(m, a) / 2;
                if (maxRight === null || edge > maxRight) { maxRight = edge; }
            });
            if (maxRight === null) { return null; }
            return Math.min(DIM.innerW / 2 - 0.022, maxRight + 0.026);
        }

        function obstaclesOnShelf(si, excludeKey) {
            var list = [];
            MODELS.forEach(function (m) {
                if (m.key === excludeKey) { return; }
                var a = ASSIGN[m.key];
                if (!a || a.s !== si) { return; }
                var w = bookWidth(m, a);
                list.push({ x1: a.x - w / 2 - 0.004, x2: a.x + w / 2 + 0.004 });
            });
            if (si === PROP.shelf) {
                list.push({ x1: PROP.plantX - 0.062, x2: PROP.plantX + 0.062 });
                list.push({ x1: PROP.mugX - 0.05, x2: PROP.mugX + 0.05 });
            }
            var be = bookendX(si);
            if (be !== null) {
                list.push({ x1: be - 0.035, x2: be + 0.035 });
            }
            return list;
        }

        function shelfAtY(y) {
            for (var i = 0; i < DIM.floors.length; i++) {
                var f = DIM.floors[i];
                if (y >= f - 0.06 && y <= f + DIM.zoneH + 0.04) { return i; }
            }
            if (y < DIM.floors[0]) { return 0; }
            return DIM.floors.length - 1;
        }

        function stackTopOnShelf(si) {
            var top = null;
            MODELS.forEach(function (m) {
                var a = ASSIGN[m.key];
                if (!a || a.s !== si || a.o !== "f") { return; }
                var hBelow = flatHeightBelow(si, m, a);
                var y = DIM.floors[si] + hBelow + m.t * cfg.bookScale;
                if (top === null || y > top.y) { top = { y: y, x: a.x, model: m, layer: a.l + 1 }; }
            });
            return top;
        }

        function findPlacement(si, x, m, mode) {
            var half = DIM.innerW / 2 - 0.018;
            var width = mode === "f" ? m.h : m.t * cfg.bookScale;
            if (si < 0 || si >= DIM.floors.length) { return { ok: false, reason: "outside" }; }
            if (width > DIM.innerW - 0.06) { return { ok: false, reason: "too-big" }; }
            var obs = obstaclesOnShelf(si, m.key);
            var cx = clamp(x, -half + width / 2, half - width / 2);

            function overlaps(c) {
                var x1 = c - width / 2 - 0.004, x2 = c + width / 2 + 0.004;
                for (var i = 0; i < obs.length; i++) {
                    if (x2 > obs[i].x1 && x1 < obs[i].x2) { return true; }
                }
                return false;
            }
            if (!overlaps(cx)) { return { ok: true, x: cx, mode: mode }; }
            for (var step = 1; step <= 6; step++) {
                var d = step * 0.01;
                var candidates = [cx - d, cx + d];
                for (var k = 0; k < candidates.length; k++) {
                    var c = candidates[k];
                    if (c < -half + width / 2 || c > half - width / 2) { continue; }
                    if (!overlaps(c)) { return { ok: true, x: c, mode: mode, snapped: true }; }
                }
            }
            return { ok: false, reason: "occupied", x: cx };
        }

        /* ---------- 道具：盆栽 / 马克杯 / 书立 ---------- */
        function leafTexture(baseHex) {
            return cached("leaf:" + baseHex + ":" + APP_STATE.style, function () {
                var W = 256, H = 256;
                var c = newCanvas(W, H), ctx = c.getContext("2d");
                ctx.fillStyle = baseHex;
                ctx.fillRect(0, 0, W, H);
                var grad = ctx.createLinearGradient(0, 0, 0, H);
                grad.addColorStop(0, "rgba(255,255,255,.16)");
                grad.addColorStop(1, "rgba(0,0,0,.22)");
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, W, H);
                /* 主脉 + 侧脉 */
                ctx.strokeStyle = "rgba(228,240,214,.5)";
                ctx.lineWidth = 3.5;
                ctx.beginPath();
                ctx.moveTo(W / 2, H);
                ctx.quadraticCurveTo(W / 2 + 4, H * 0.5, W / 2, 4);
                ctx.stroke();
                for (var i = 1; i < 9; i++) {
                    var y = H - (H - 14) * (i / 9);
                    var spread = 40 + i * 8;
                    ctx.strokeStyle = "rgba(228,240,214,.3)";
                    ctx.lineWidth = 1.6;
                    ctx.beginPath();
                    ctx.moveTo(W / 2, y);
                    ctx.quadraticCurveTo(W / 2 + spread * 0.7, y - 14, W / 2 + spread, y - 34);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.moveTo(W / 2, y);
                    ctx.quadraticCurveTo(W / 2 - spread * 0.7, y - 14, W / 2 - spread, y - 34);
                    ctx.stroke();
                }
                seedNoise(ctx, W, H, 500, 0.05, 2);
                return texture(c, { repeat: [1, 1] });
            });
        }

        function monsteraLeafGeometry() {
            var sh = new THREE.Shape();
            sh.moveTo(0, 0);
            sh.bezierCurveTo(0.012, 0.008, 0.045, 0.014, 0.07, 0.036);
            sh.quadraticCurveTo(0.052, 0.046, 0.062, 0.062);
            sh.bezierCurveTo(0.088, 0.078, 0.082, 0.108, 0.055, 0.128);
            sh.quadraticCurveTo(0.038, 0.116, 0.03, 0.132);
            sh.bezierCurveTo(0.05, 0.146, 0.036, 0.166, 0.012, 0.176);
            sh.quadraticCurveTo(0.004, 0.18, 0, 0.182);
            sh.quadraticCurveTo(-0.004, 0.18, -0.012, 0.176);
            sh.bezierCurveTo(-0.036, 0.166, -0.05, 0.146, -0.03, 0.132);
            sh.quadraticCurveTo(-0.038, 0.116, -0.055, 0.128);
            sh.bezierCurveTo(-0.082, 0.108, -0.088, 0.078, -0.062, 0.062);
            sh.quadraticCurveTo(-0.052, 0.046, -0.07, 0.036);
            sh.bezierCurveTo(-0.045, 0.014, -0.012, 0.008, 0, 0);
            var geo = new THREE.ShapeGeometry(sh, 6);
            /* 归一化 UV，便于贴叶子纹理 */
            geo.computeBoundingBox();
            var bb = geo.boundingBox;
            var uv = [];
            var pos = geo.attributes.position;
            for (var i = 0; i < pos.count; i++) {
                uv.push((pos.getX(i) - bb.min.x) / (bb.max.x - bb.min.x || 1));
                uv.push((pos.getY(i) - bb.min.y) / (bb.max.y - bb.min.y || 1));
            }
            geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
            return geo;
        }

        function buildPlant(styleCfg) {
            var g = new THREE.Group();
            var isStyled = styleCfg.key === "stylized";
            var isLow = styleCfg.key === "lowpoly";
            var potMat = makeTerracottaMaterial();
            var soilMat = new THREE.MeshStandardMaterial({ color: 0x35241A, roughness: 1 });
            var potH = 0.088;
            var potGeo = new THREE.CylinderGeometry(0.033, 0.045, potH, isLow ? 8 : 24, 1);
            var pot = new THREE.Mesh(potGeo, potMat);
            pot.position.y = potH / 2;
            pot.castShadow = true; pot.receiveShadow = true;
            g.add(pot);
            var rim = new THREE.Mesh(new THREE.TorusGeometry(0.044, 0.005, isLow ? 4 : 8, isLow ? 8 : 26), potMat);
            rim.rotation.x = Math.PI / 2;
            rim.position.y = potH;
            g.add(rim);
            var soil = new THREE.Mesh(new THREE.CylinderGeometry(0.041, 0.041, 0.008, isLow ? 7 : 20), soilMat);
            soil.position.y = potH - 0.002;
            g.add(soil);

            var leafHex = isStyled ? "#2F7A4C" : (isLow ? "#3C7A50" : "#1F4A30");
            var leafMat;
            if (styleCfg.bookTex) {
                leafMat = new THREE.MeshStandardMaterial({
                    color: leafHex, roughness: 0.78, metalness: 0,
                    side: THREE.DoubleSide, envMapIntensity: cfg.envInt * 0.35
                });
            } else {
                leafMat = new THREE.MeshStandardMaterial({
                    color: leafHex, roughness: 0.82, metalness: 0,
                    side: THREE.DoubleSide, flatShading: isLow, envMapIntensity: cfg.envInt
                });
            }
            var leafMat2 = new THREE.MeshStandardMaterial({
                color: isStyled ? "#3C8A57" : (isLow ? "#4A8A5C" : "#2A5C3B"),
                roughness: 0.8, metalness: 0, side: THREE.DoubleSide,
                flatShading: isLow, envMapIntensity: cfg.envInt * 0.35
            });
            var stemMat = new THREE.MeshStandardMaterial({ color: 0x3B5E36, roughness: 0.8 });
            var leafGeo = monsteraLeafGeometry();
            var count = isLow ? 4 : 6;
            for (var i = 0; i < count; i++) {
                var ang = (i / count) * Math.PI * 2 + 0.35;
                var stemLen = 0.07 + (i % 3) * 0.03;
                var lean = 0.2;
                var stem = new THREE.Mesh(new THREE.CylinderGeometry(0.0032, 0.0046, stemLen, 6), stemMat);
                stem.position.set(Math.cos(ang) * 0.018, potH + stemLen / 2 - 0.006, Math.sin(ang) * 0.018);
                stem.rotation.set(Math.sin(ang) * lean, 0, -Math.cos(ang) * lean);
                g.add(stem);
                var scale = 0.62 + (i % 3) * 0.13;
                var leaf = new THREE.Mesh(leafGeo, i % 2 === 0 ? leafMat : leafMat2);
                leaf.scale.setScalar(scale);
                leaf.position.set(
                    Math.cos(ang) * (0.028 + stemLen * 0.4),
                    potH + stemLen - 0.004,
                    Math.sin(ang) * (0.028 + stemLen * 0.4)
                );
                leaf.rotation.set(-0.62 + lean * 0.7, -ang + Math.PI / 2, 0.1 - lean * 0.6);
                leaf.castShadow = true;
                g.add(leaf);
            }
            return g;
        }

        function buildMug(styleCfg) {
            var g = new THREE.Group();
            var isLow = styleCfg.key === "lowpoly";
            var mugH = 0.088, mugR = 0.036;
            var mugMat;
            if (styleCfg.propTex) {
                var mc = newCanvas(256, 256), mctx = mc.getContext("2d");
                mctx.fillStyle = "#F4EFE4"; mctx.fillRect(0, 0, 256, 256);
                for (var i = 0; i < 900; i++) {
                    mctx.fillStyle = "rgba(" + (i % 3 === 0 ? "80,66,48" : "150,130,100") + "," + (0.05 + Math.random() * 0.1) + ")";
                    mctx.fillRect(Math.random() * 256, Math.random() * 256, 1.4, 1.4);
                }
                var mugTex = texture(mc, { repeat: [2, 1] });
                mugMat = new THREE.MeshStandardMaterial({
                    map: mugTex, roughness: 0.65, metalness: 0.02, envMapIntensity: cfg.envInt
                });
            } else {
                mugMat = new THREE.MeshStandardMaterial({
                    color: 0xF4EFE4, roughness: 0.8, metalness: 0, flatShading: isLow, envMapIntensity: cfg.envInt
                });
            }
            var body = new THREE.Mesh(new THREE.CylinderGeometry(mugR, mugR * 0.92, mugH, isLow ? 8 : 24, 1, true), mugMat);
            body.position.y = mugH / 2;
            body.castShadow = true;
            g.add(body);
            var inner = new THREE.Mesh(new THREE.CylinderGeometry(mugR * 0.94, mugR * 0.94, 0.004, isLow ? 8 : 24), mugMat);
            inner.position.y = mugH - 0.002;
            g.add(inner);
            var coffee = new THREE.Mesh(new THREE.CylinderGeometry(mugR * 0.86, mugR * 0.86, 0.002, 20),
                new THREE.MeshStandardMaterial({ color: 0x3a2418, roughness: 0.35 }));
            coffee.position.y = mugH - 0.005;
            g.add(coffee);
            var handle = new THREE.Mesh(
                new THREE.TorusGeometry(0.026, 0.0065, isLow ? 4 : 8, isLow ? 6 : 16, Math.PI * 1.35),
                mugMat
            );
            handle.position.set(mugR * 0.86, mugH * 0.52, 0);
            handle.rotation.z = -Math.PI * 0.34;
            handle.rotation.y = Math.PI / 2;
            g.add(handle);
            return g;
        }

        function buildBookend(styleCfg) {
            var g = new THREE.Group();
            if (styleCfg.key === "lowpoly") {
                var mat = new THREE.MeshStandardMaterial({ color: 0x2E5E4E, roughness: 0.9 });
                var v = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.15, 0.14), mat);
                v.position.set(0.006, 0.075, 0);
                g.add(v);
                var b = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.012, 0.14), mat);
                b.position.set(-0.03, 0.006, 0);
                g.add(b);
                return g;
            }
            var brass = makeBrassMaterial();
            var v2 = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.155, 0.145), brass);
            v2.position.set(0, 0.0775, 0);
            v2.castShadow = true;
            g.add(v2);
            var b2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.009, 0.145), brass);
            b2.position.set(-0.038, 0.0045, 0);
            b2.castShadow = true;
            g.add(b2);
            return g;
        }

        function buildProps(styleCfg) {
            var plant = buildPlant(styleCfg);
            plant.position.set(PROP.plantX - 0.012, DIM.floors[PROP.shelf] + 0.001, bookZ(0.16));
            shelfRoot.add(plant);

            var mug = buildMug(styleCfg);
            mug.position.set(PROP.mugX, DIM.floors[PROP.shelf] + 0.001, DIM.frontZ - 0.095);
            mug.rotation.y = -0.6;
            shelfRoot.add(mug);

            PLAN.forEach(function (plan) {
                if (!plan.lean) { return; }
                var bx = bookendX(plan.s);
                if (bx === null) { return; }
                var be = buildBookend(styleCfg);
                be.position.set(bx, DIM.floors[plan.s] + 0.001, DIM.frontZ - 0.12);
                shelfRoot.add(be);
            });
        }

        /* ---------- 环境：摄影棚 / 阅读角 ---------- */
        function buildParquetTexture() {
            return cached("parquet", function () {
                var W = 1024, H = 1024;
                var c = newCanvas(W, H), ctx = c.getContext("2d");
                var rnd = mulberry32(77);
                var rowH = 128;
                for (var row = 0; row < H / rowH; row++) {
                    var offset = (row % 2) * 240;
                    for (var bx = -1; bx < 3; bx++) {
                        var x = bx * 512 + offset;
                        var base = 168 + Math.floor(rnd() * 26);
                        ctx.fillStyle = "rgb(" + base + "," + Math.floor(base * 0.72) + "," + Math.floor(base * 0.48) + ")";
                        ctx.fillRect(x, row * rowH, 512, rowH);
                        /* 木纹 */
                        for (var g = 0; g < 40; g++) {
                            ctx.strokeStyle = "rgba(92,58,32," + (0.04 + rnd() * 0.16) + ")";
                            ctx.lineWidth = 0.6 + rnd() * 1.6;
                            var gy = row * rowH + rnd() * rowH;
                            ctx.beginPath();
                            ctx.moveTo(x, gy);
                            for (var sx = 0; sx <= 512; sx += 32) {
                                ctx.lineTo(x + sx, gy + Math.sin(sx * 0.02 + g) * 2.5);
                            }
                            ctx.stroke();
                        }
                        ctx.fillStyle = "rgba(48,30,16,.5)";
                        ctx.fillRect(x, row * rowH, 2, rowH);
                        ctx.fillRect(x, row * rowH, 512, 2);
                    }
                }
                seedNoise(ctx, W, H, 2200, 0.05, 2);
                return texture(c, { repeat: [2.4, 2.0] });
            });
        }

        function buildPlasterTexture() {
            return cached("plaster", function () {
                var W = 512, H = 512;
                var c = newCanvas(W, H), ctx = c.getContext("2d");
                ctx.fillStyle = "#EFE8DB";
                ctx.fillRect(0, 0, W, H);
                var rnd = mulberry32(31);
                for (var i = 0; i < 160; i++) {
                    ctx.fillStyle = "rgba(255,255,255," + (rnd() * 0.08) + ")";
                    ctx.beginPath();
                    ctx.ellipse(rnd() * W, rnd() * H, 20 + rnd() * 60, 8 + rnd() * 30, rnd() * 3, 0, Math.PI * 2);
                    ctx.fill();
                }
                for (var j = 0; j < 90; j++) {
                    ctx.fillStyle = "rgba(150,130,100," + (rnd() * 0.05) + ")";
                    ctx.beginPath();
                    ctx.ellipse(rnd() * W, rnd() * H, 30 + rnd() * 80, 6 + rnd() * 20, rnd() * 3, 0, Math.PI * 2);
                    ctx.fill();
                }
                seedNoise(ctx, W, H, 1800, 0.04, 2);
                return texture(c, { repeat: [2, 2] });
            });
        }

        function buildRugTexture() {
            return cached("rug", function () {
                var W = 512, H = 512;
                var c = newCanvas(W, H), ctx = c.getContext("2d");
                ctx.fillStyle = "#C7B394";
                ctx.fillRect(0, 0, W, H);
                var rnd = mulberry32(13);
                for (var y = 0; y < H; y += 4) {
                    for (var x = 0; x < W; x += 4) {
                        var v = 0.5 + rnd() * 0.5;
                        ctx.fillStyle = "rgba(" + Math.floor(150 + 60 * v) + "," + Math.floor(130 + 50 * v) + "," + Math.floor(100 + 45 * v) + ",.55)";
                        ctx.fillRect(x, y, 3, 3);
                    }
                }
                ctx.strokeStyle = "rgba(92,72,48,.75)";
                ctx.lineWidth = 14;
                ctx.strokeRect(26, 26, W - 52, H - 52);
                ctx.strokeStyle = "rgba(92,72,48,.35)";
                ctx.lineWidth = 4;
                ctx.strokeRect(44, 44, W - 88, H - 88);
                seedNoise(ctx, W, H, 1200, 0.08, 2);
                return texture(c);
            });
        }

        function buildArmchair() {
            var g = new THREE.Group();
            var leather = new THREE.MeshStandardMaterial({
                color: 0x6E3A24, roughness: 0.58, metalness: 0.05, envMapIntensity: 0.4
            });
            var wood = new THREE.MeshStandardMaterial({ color: 0x4B3324, roughness: 0.7 });
            function box(w, h, d, x, y, z, mat, ry) {
                var mesh = new THREE.Mesh(roundedBoxGeo(w, h, d, 0.02), mat);
                mesh.position.set(x, y, z);
                if (ry) { mesh.rotation.y = ry; }
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                g.add(mesh);
                return mesh;
            }
            box(0.58, 0.16, 0.54, 0, 0.36, 0, leather);
            box(0.58, 0.5, 0.12, 0, 0.62, -0.24, leather);
            box(0.1, 0.26, 0.5, -0.29, 0.48, 0, leather);
            box(0.1, 0.26, 0.5, 0.29, 0.48, 0, leather);
            box(0.34, 0.09, 0.34, 0, 0.475, 0.06, leather);
            [[-0.24, -0.2], [0.24, -0.2], [-0.24, 0.2], [0.24, 0.2]].forEach(function (p) {
                var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.014, 0.29, 8), wood);
                leg.position.set(p[0], 0.145, p[1]);
                leg.rotation.x = p[1] > 0 ? 0.08 : -0.08;
                leg.castShadow = true;
                g.add(leg);
            });
            return g;
        }

        function buildEnvironment() {
            while (studioRoot.children.length) { studioRoot.remove(studioRoot.children[0]); }
            while (roomRoot.children.length) { roomRoot.remove(roomRoot.children[0]); }

            /* --- 摄影棚 --- */
            /* 软接触阴影：让柜体“落地”，避免硬投影显得漂浮 */
            var contactCanvas = newCanvas(256, 128);
            var cctx = contactCanvas.getContext("2d");
            var cg = cctx.createRadialGradient(128, 64, 6, 128, 64, 118);
            cg.addColorStop(0, "rgba(38,26,16,.55)");
            cg.addColorStop(0.5, "rgba(38,26,16,.28)");
            cg.addColorStop(1, "rgba(38,26,16,0)");
            cctx.fillStyle = cg;
            cctx.fillRect(0, 0, 256, 128);
            var contact = new THREE.Mesh(
                new THREE.PlaneGeometry(1.7, 0.72),
                new THREE.MeshBasicMaterial({ map: texture(contactCanvas), transparent: true, depthWrite: false })
            );
            contact.rotation.x = -Math.PI / 2;
            contact.position.set(0, 0.002, 0.06);
            studioRoot.add(contact);

            /* --- 阅读角（提示词包 §7） --- */
            var floor = new THREE.Mesh(
                new THREE.PlaneGeometry(7, 5.6),
                new THREE.MeshStandardMaterial({
                    map: buildParquetTexture(), roughness: 0.55, metalness: 0.02, envMapIntensity: 0.4
                })
            );
            floor.rotation.x = -Math.PI / 2;
            floor.receiveShadow = true;
            roomRoot.add(floor);

            var wallMat = new THREE.MeshStandardMaterial({
                map: buildPlasterTexture(), roughness: 0.94, metalness: 0, envMapIntensity: 0.22
            });
            var wall = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 3.4), wallMat);
            wall.position.set(0, 1.7, -0.26);
            wall.receiveShadow = false;
            roomRoot.add(wall);

            var sideWall = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 3.4), wallMat);
            sideWall.position.set(-1.95, 1.7, 1.4);
            sideWall.rotation.y = Math.PI / 2;
            sideWall.receiveShadow = false;
            roomRoot.add(sideWall);

            var baseboardMat = new THREE.MeshStandardMaterial({ color: 0xE6DCCB, roughness: 0.8 });
            var baseboard = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.09, 0.02), baseboardMat);
            baseboard.position.set(0, 0.045, -0.248);
            roomRoot.add(baseboard);

            var rug = new THREE.Mesh(
                new THREE.PlaneGeometry(2.7, 1.85),
                new THREE.MeshStandardMaterial({
                    map: buildRugTexture(), roughness: 0.98, metalness: 0, envMapIntensity: 0.18
                })
            );
            rug.rotation.x = -Math.PI / 2;
            rug.position.set(0.05, 0.005, 0.95);
            rug.receiveShadow = true;
            roomRoot.add(rug);

            /* 墙面接触阴影（补偿关闭 receiveShadow 后的漂浮感） */
            var wallAO = newCanvas(256, 256);
            var wctx = wallAO.getContext("2d");
            var wg = wctx.createLinearGradient(0, 0, 256, 0);
            wg.addColorStop(0, "rgba(48,32,20,0)");
            wg.addColorStop(0.18, "rgba(48,32,20,.26)");
            wg.addColorStop(0.5, "rgba(48,32,20,.32)");
            wg.addColorStop(0.82, "rgba(48,32,20,.26)");
            wg.addColorStop(1, "rgba(48,32,20,0)");
            wctx.fillStyle = wg;
            wctx.fillRect(0, 0, 256, 256);
            var wallAOMesh = new THREE.Mesh(
                new THREE.PlaneGeometry(1.55, 2.2),
                new THREE.MeshBasicMaterial({ map: texture(wallAO), transparent: true, opacity: 0.75, depthWrite: false })
            );
            wallAOMesh.position.set(0, 1.02, -0.252);
            roomRoot.add(wallAOMesh);

            var chair = buildArmchair();
            chair.scale.setScalar(0.86);
            chair.position.set(1.5, 0, 0.28);
            chair.rotation.y = -1.12;
            roomRoot.add(chair);

            /* 窗（左侧，暖光来源） */
            var frameMat = new THREE.MeshStandardMaterial({ color: 0xF7F2E8, roughness: 0.7 });
            var windowGroup = new THREE.Group();
            windowGroup.position.set(-1.94, 1.62, 0.62);
            windowGroup.rotation.y = Math.PI / 2;
            var paneMat = new THREE.MeshStandardMaterial({
                color: 0xFFF4D8, emissive: 0xFFE4B0, emissiveIntensity: 0.85, roughness: 0.9
            });
            var pane = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 1.42), paneMat);
            windowGroup.add(pane);
            for (var k = 0; k < 4; k++) {
                var bar = new THREE.Mesh(new THREE.BoxGeometry(k % 2 === 0 ? 0.06 : 1.12, k % 2 === 0 ? 1.5 : 0.06, 0.05), frameMat);
                bar.position.set(0, 0, 0.02);
                windowGroup.add(bar);
            }
            roomRoot.add(windowGroup);

            studioRoot.visible = APP_STATE.environment === "studio";
            roomRoot.visible = APP_STATE.environment === "room";
        }

        /* ---------- 浮尘 ---------- */
        var dustGroup = new THREE.Group();
        var DUST_COUNT = 46;
        var dustGeo = new THREE.BufferGeometry();
        var dustPos = new Float32Array(DUST_COUNT * 3);
        var dustSeed = [];
        for (var di = 0; di < DUST_COUNT; di++) {
            dustPos[di * 3] = (Math.random() - 0.5) * 1.7;
            dustPos[di * 3 + 1] = 0.2 + Math.random() * 1.9;
            dustPos[di * 3 + 2] = -0.1 + Math.random() * 0.9;
            dustSeed.push(0.1 + Math.random() * 0.3);
        }
        dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
        var dustCanvas = newCanvas(64, 64);
        var dctx = dustCanvas.getContext("2d");
        var dgrad = dctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        dgrad.addColorStop(0, "rgba(255,248,230,1)");
        dgrad.addColorStop(0.4, "rgba(255,248,230,.45)");
        dgrad.addColorStop(1, "rgba(255,248,230,0)");
        dctx.fillStyle = dgrad;
        dctx.fillRect(0, 0, 64, 64);
        var dustTex = texture(dustCanvas);
        var dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
            map: dustTex, color: 0xfff4dc, size: 0.014, transparent: true, opacity: 0.3,
            depthWrite: false, blending: THREE.AdditiveBlending
        }));
        dustGroup.add(dust);
        scene.add(dustGroup);

        /* ---------- 相机控制 ---------- */
        var ctrl = {
            az: CAMERAS[APP_STATE.camera].az,
            pol: CAMERAS[APP_STATE.camera].pol,
            viewZoom: CAMERAS[APP_STATE.camera].zoom,
            targetY: CAMERAS[APP_STATE.camera].ty,
            goalAz: CAMERAS[APP_STATE.camera].az,
            goalPol: CAMERAS[APP_STATE.camera].pol,
            goalZoom: CAMERAS[APP_STATE.camera].zoom,
            goalTargetY: CAMERAS[APP_STATE.camera].ty,
            orbitDir: 1
        };
        var fitDist = 3.9;

        function computeFit() {
            var w = Math.max(1, host.clientWidth || 1);
            var h = Math.max(1, host.clientHeight || 1);
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h, false);
            var tan = Math.tan(camera.fov * Math.PI / 360);
            var distW = ((DIM.outerW + 0.24) / 2) / (tan * camera.aspect);
            var distH = ((DIM.outerH * 0.5) + 0.18) / tan;
            fitDist = Math.max(distW, distH);
            updateOrtho();
            applyCamera();
        }

        function updateOrtho() {
            var w = Math.max(1, host.clientWidth || 1);
            var h = Math.max(1, host.clientHeight || 1);
            var vh = 2.72 * ctrl.viewZoom;
            var vw = vh * (w / h);
            orthoCam.left = -vw / 2;
            orthoCam.right = vw / 2;
            orthoCam.top = vh / 2;
            orthoCam.bottom = -vh / 2;
            orthoCam.updateProjectionMatrix();
        }

        function applyCamera() {
            var d = activeCam === orthoCam ? 6 : fitDist * ctrl.viewZoom;
            var cp = Math.cos(ctrl.pol);
            activeCam.position.set(
                d * Math.sin(ctrl.az) * cp,
                ctrl.targetY + d * Math.sin(ctrl.pol),
                d * Math.cos(ctrl.az) * cp
            );
            activeCam.lookAt(0, ctrl.targetY, 0);
        }

        function setCameraPreset(key, silent) {
            if (!CAMERAS[key]) { return; }
            APP_STATE.camera = key;
            host.setAttribute("data-camera", key);
            activeCam = key === "ortho" ? orthoCam : camera;
            var p = CAMERAS[key];
            ctrl.goalAz = p.az;
            ctrl.goalPol = p.pol;
            ctrl.goalZoom = p.zoom;
            ctrl.goalTargetY = p.ty;
            if (activeCam === orthoCam) { updateOrtho(); }
            try {
                document.querySelectorAll("[data-shelf-cam]").forEach(function (b) {
                    var on = b.getAttribute("data-shelf-cam") === key;
                    b.classList.toggle("is-active", on);
                    b.setAttribute("aria-pressed", on ? "true" : "false");
                });
            } catch (e) {}
            if (!silent) {
                saveState();
                emitChange();
            }
        }

        computeFit();

        /* ---------- 交互状态 ---------- */
        var phase = "idle";
        var activeObj = null;
        var hovered = null;
        var pointerInside = false;
        var pointerDirty = false;
        var orbiting = false;
        var raycaster = new THREE.Raycaster();
        var pointerNdc = new THREE.Vector2(-2, -2);
        var dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.2);
        var dragPoint = new THREE.Vector3();
        var dragInfo = null;
        var lastValid = null;
        var tmpVec = new THREE.Vector3();

        /* ---------- 补间 ---------- */
        var tweens = [];
        function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
        function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
        function killTweens(tag) {
            tweens = tweens.filter(function (tw) { return tw.tag !== tag; });
        }
        function tweenVec(target, to, dur, opts) {
            opts = opts || {};
            if (reduceMotion) { dur = 0.001; }
            if (opts.tag) { killTweens(opts.tag); }
            var from = { x: target.x, y: target.y, z: target.z };
            tweens.push({
                target: target, from: from, to: { x: to[0], y: to[1], z: to[2] },
                t: 0, dur: Math.max(0.001, dur), ease: opts.ease || easeInOut,
                tag: opts.tag || "", onDone: opts.onDone
            });
        }
        function tweenScalar(target, prop, to, dur, opts) {
            opts = opts || {};
            if (reduceMotion) { dur = 0.001; }
            if (opts.tag) { killTweens(opts.tag); }
            tweens.push({
                target: target, scalar: prop, from: target[prop], to: to,
                t: 0, dur: Math.max(0.001, dur), ease: opts.ease || easeInOut,
                tag: opts.tag || "", onDone: opts.onDone
            });
        }
        function updateTweens(dt) {
            for (var i = tweens.length - 1; i >= 0; i--) {
                var tw = tweens[i];
                tw.t += dt;
                var k = Math.min(tw.t / tw.dur, 1);
                var e = tw.ease(k);
                if (tw.scalar) {
                    tw.target[tw.scalar] = tw.from + (tw.to - tw.from) * e;
                } else {
                    tw.target.x = tw.from.x + (tw.to.x - tw.from.x) * e;
                    tw.target.y = tw.from.y + (tw.to.y - tw.from.y) * e;
                    tw.target.z = tw.from.z + (tw.to.z - tw.from.z) * e;
                }
                if (k >= 1) {
                    tweens.splice(i, 1);
                    if (tw.onDone) { tw.onDone(); }
                }
            }
        }

        /* ---------- Ghost / 层位高亮 ---------- */
        var ghostMat = new THREE.MeshBasicMaterial({
            color: 0x2fae7a, transparent: true, opacity: 0.32, depthWrite: false
        });
        var ghostEdgeMat = new THREE.LineBasicMaterial({
            color: 0x1f9d68, transparent: true, opacity: 0.9, depthTest: false, depthWrite: false
        });
        var ghost = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), ghostMat);
        var ghostEdges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), ghostEdgeMat);
        ghostEdges.renderOrder = 30;
        ghost.add(ghostEdges);
        ghost.renderOrder = 20;
        ghost.visible = false;
        sceneRoot.add(ghost);

        var zoneHighlight = new THREE.Mesh(
            new THREE.BoxGeometry(DIM.innerW - 0.02, DIM.zoneH, 0.004),
            new THREE.MeshBasicMaterial({ color: 0x2fae7a, transparent: true, opacity: 0.06, depthWrite: false })
        );
        zoneHighlight.visible = false;
        sceneRoot.add(zoneHighlight);

        function setGhostColor(ok) {
            ghostMat.color.setHex(ok ? 0x2fae7a : 0xc0392b);
            ghostEdgeMat.color.setHex(ok ? 0x1f9d68 : 0xc0392b);
        }

        /* ---------- 音效 ---------- */
        var audioCtx = null;
        function playSound(kind) {
            if (!APP_STATE.sound) { return; }
            try {
                if (!audioCtx) {
                    var AC = window.AudioContext || window.webkitAudioContext;
                    if (!AC) { return; }
                    audioCtx = new AC();
                }
                if (audioCtx.state === "suspended") { audioCtx.resume(); }
                var t0 = audioCtx.currentTime;
                var osc = audioCtx.createOscillator();
                var gain = audioCtx.createGain();
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                if (kind === "pick") {
                    osc.type = "sine"; osc.frequency.setValueAtTime(520, t0);
                    osc.frequency.exponentialRampToValueAtTime(700, t0 + 0.07);
                    gain.gain.setValueAtTime(0.0001, t0);
                    gain.gain.exponentialRampToValueAtTime(0.05, t0 + 0.012);
                    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.13);
                    osc.start(t0); osc.stop(t0 + 0.15);
                } else if (kind === "place") {
                    osc.type = "triangle"; osc.frequency.setValueAtTime(210, t0);
                    osc.frequency.exponentialRampToValueAtTime(120, t0 + 0.12);
                    gain.gain.setValueAtTime(0.0001, t0);
                    gain.gain.exponentialRampToValueAtTime(0.085, t0 + 0.008);
                    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
                    osc.start(t0); osc.stop(t0 + 0.22);
                } else {
                    osc.type = "square"; osc.frequency.setValueAtTime(150, t0);
                    osc.frequency.exponentialRampToValueAtTime(90, t0 + 0.14);
                    gain.gain.setValueAtTime(0.0001, t0);
                    gain.gain.exponentialRampToValueAtTime(0.032, t0 + 0.01);
                    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.17);
                    osc.start(t0); osc.stop(t0 + 0.19);
                }
            } catch (e) {}
        }

        /* ---------- 状态广播 ---------- */
        function emitChange() {
            try {
                window.dispatchEvent(new CustomEvent("shelf:change", {
                    detail: {
                        style: APP_STATE.style, camera: APP_STATE.camera,
                        environment: APP_STATE.environment, orbit: APP_STATE.orbit, sound: APP_STATE.sound
                    }
                }));
            } catch (e) {}
        }
        function emitBook(obj, open) {
            try {
                window.dispatchEvent(new CustomEvent("shelf:book", {
                    detail: { id: obj.model.key, real: !!obj.model.real, open: open }
                }));
            } catch (e) {}
        }

        /* ---------- 机位 / 环境 / 风格 ---------- */
        function updateStyleButtons() {
            [].forEach.call(host.querySelectorAll("[data-shelf-style]"), function (b) {
                var on = b.getAttribute("data-shelf-style") === APP_STATE.style;
                b.classList.toggle("is-active", on);
                b.setAttribute("aria-pressed", on ? "true" : "false");
            });
        }
        function updateEnvButton() {
            var btn = host.querySelector('[data-shelf-action="env"]');
            if (!btn) { return; }
            var isRoom = APP_STATE.environment === "room";
            btn.setAttribute("aria-pressed", isRoom ? "true" : "false");
            btn.classList.toggle("is-active", isRoom);
            var label = btn.querySelector(".shelf-act-label");
            if (label) { label.textContent = isRoom ? "阅读角" : "摄影棚"; }
        }
        function updateOrbitButton() {
            var btn = host.querySelector('[data-shelf-action="orbit"]');
            if (!btn) { return; }
            btn.setAttribute("aria-pressed", APP_STATE.orbit ? "true" : "false");
            btn.classList.toggle("is-active", APP_STATE.orbit);
        }
        function updateSoundButton() {
            var btn = host.querySelector('[data-shelf-action="sound"]');
            if (!btn) { return; }
            btn.setAttribute("aria-pressed", APP_STATE.sound ? "true" : "false");
            btn.classList.toggle("is-active", APP_STATE.sound);
        }

        function disposeShelf() {
            while (shelfRoot.children.length) {
                var child = shelfRoot.children[0];
                shelfRoot.remove(child);
                child.traverse(function (o) {
                    if (o.isMesh && o.geometry) {
                        try { o.geometry.dispose(); } catch (e) {}
                    }
                });
            }
        }

        function populateShelf() {
            var cabinet = buildCabinet(cfg);
            shelfRoot.add(cabinet);
            buildBooks(cfg);
            buildProps(cfg);
        }

        function setStyle(key, silent) {
            if (!STYLES[key]) { return; }
            if (key === APP_STATE.style) { return; }
            if (phase !== "idle") { putBack(true); }
            APP_STATE.style = key;
            cfg = STYLES[key];
            renderer.toneMappingExposure = cfg.exposure;
            pageMaterial = null;
            host.setAttribute("data-style", key);
            disposeShelf();
            populateShelf();
            refreshShadow();
            updateStyleButtons();
            applyBookPoseAll();
            updateStatus();
            saveState();
            emitChange();
            if (!silent) { showToast("已切换为「" + STYLES[key].name + "」风格"); }
        }

        function applyBookPoseAll() {
            BOOK_OBJ.forEach(function (b) {
                b.a = ASSIGN[b.model.key];
                applyBookPose(b, true);
            });
        }

        function toggleEnvironment() {
            APP_STATE.environment = APP_STATE.environment === "studio" ? "room" : "studio";
            var isStudio = APP_STATE.environment === "studio";
            studioRoot.visible = isStudio;
            roomRoot.visible = !isStudio;
            studioLights.visible = isStudio;
            roomLights.visible = !isStudio;
            host.setAttribute("data-environment", APP_STATE.environment);
            refreshShadow();
            updateEnvButton();
            saveState();
            emitChange();
        }

        function toggleOrbit() {
            APP_STATE.orbit = !APP_STATE.orbit;
            updateOrbitButton();
            saveState();
            emitChange();
        }
        function toggleSound() {
            APP_STATE.sound = !APP_STATE.sound;
            updateSoundButton();
            saveState();
            emitChange();
            if (APP_STATE.sound) { playSound("pick"); }
        }

        function resetLayout() {
            if (phase !== "idle") { putBack(true); }
            var fresh = defaultLayout(MODELS);
            MODELS.forEach(function (m) {
                m.tilt = 0;
                m.pulled = false;
            });
            var pulledDone = false;
            MODELS.forEach(function (m) {
                if (pulledDone || !m.real) { return; }
                var a = fresh[m.key];
                if (a && a.s === 2) { m.pulled = true; pulledDone = true; }
            });
            /* 复原 lean 倾斜 */
            PLAN.forEach(function (p) {
                if (!p.lean) { return; }
                var list = [];
                MODELS.forEach(function (m) {
                    var a = fresh[m.key];
                    if (a && a.s === p.s && a.o === "u") { list.push(m); }
                });
                if (list.length) { list[list.length - 1].tilt = 0.19; }
            });
            ASSIGN = fresh;
            disposeShelf();
            populateShelf();
            applyBookPoseAll();
            refreshShadow();
            updateStatus();
            saveState();
            showToast("已恢复初始摆放");
        }

        /* ---------- 卡片 ---------- */
        var cardLastFocus = null;
        function clearCard() {
            if (!elCard) { return; }
            var hadFocus = elCard.contains(document.activeElement);
            elCard.hidden = true;
            if (hadFocus) {
                try { canvasEl.focus({ preventScroll: true }); } catch (e) {}
            }
        }
        function showCard(obj) {
            if (!elCard) { return; }
            var m = obj.model;
            var meta = m.meta || {};
            var isReal = !!m.real;
            elCard.hidden = false;
            if (elCardBadge) {
                elCardBadge.textContent = isReal ? "项目" : "示例书";
                elCardBadge.classList.toggle("is-sample", !isReal);
            }
            if (elCardName) { elCardName.textContent = isReal ? (meta.name || "未命名项目") : "示例藏书 · No." + (m.idx + 1); }
            if (elCardMeta) {
                elCardMeta.textContent = isReal
                    ? ((meta.author || "佚名") + (meta.docs ? "  ·  " + meta.docs + " 篇文档" : ""))
                    : "内置资产库程序化生成 · 用于展示三风格与可拿取交互";
            }
            if (elCardDesc) {
                var desc = isReal && meta.desc ? meta.desc.replace(/<[^>]+>/g, "") : (isReal
                    ? "该项目暂无描述，可进入项目查看完整文档。"
                    : "这本书没有对应项目，它是书柜场景自带的示例资产：色板、书脊烫金、纸张切口与公差都按提示词包规范生成。");
                elCardDesc.textContent = desc;
            }
            if (elCardCover) {
                if (isReal && meta.coverSrc) {
                    elCardCover.src = meta.coverSrc;
                    elCardCover.hidden = false;
                    elCardCover.onerror = function () { elCardCover.hidden = true; };
                } else {
                    elCardCover.hidden = true;
                    elCardCover.removeAttribute("src");
                }
            }
            if (elCardStats) {
                elCardStats.innerHTML = "";
                var rows = [
                    ["层位", "第 " + (obj.a.s + 1) + " 层"],
                    ["书脊厚度", (obj.dims.t * 100).toFixed(1) + " cm"],
                    ["书高", (obj.dims.h * 100).toFixed(1) + " cm"],
                    ["形态", obj.a.o === "f" ? "横放 · 第 " + (obj.a.l + 1) + " 层" : "竖放"]
                ];
                if (isReal && meta.docs) { rows[1] = ["文档数量", meta.docs + " 篇"]; }
                rows.forEach(function (r) {
                    var dt = document.createElement("dt");
                    dt.textContent = r[0];
                    var dd = document.createElement("dd");
                    dd.textContent = r[1];
                    elCardStats.appendChild(dt);
                    elCardStats.appendChild(dd);
                });
            }
            if (elCardOpen) {
                if (isReal) {
                    elCardOpen.href = meta.href || "#";
                    elCardOpen.textContent = "进入项目";
                    elCardOpen.hidden = false;
                } else {
                    elCardOpen.href = "#";
                    elCardOpen.textContent = "查看资产规范";
                    elCardOpen.hidden = false;
                }
            }
            if (elCardPut) { elCardPut.textContent = "放回书架"; }
            try {
                elCard.setAttribute("tabindex", "-1");
                elCard.focus({ preventScroll: true });
            } catch (e) {}
            emitBook(obj, true);
        }

        if (elCardClose) { elCardClose.addEventListener("click", function (e) { e.stopPropagation(); putBack(); }); }
        if (elCardPut) { elCardPut.addEventListener("click", function (e) { e.stopPropagation(); putBack(); }); }
        if (elCardOpen) {
            elCardOpen.addEventListener("click", function (e) {
                if (!activeObj) { return; }
                if (!activeObj.model.real) {
                    e.preventDefault();
                    if (window.ShelfSpec && window.ShelfSpec.open) { window.ShelfSpec.open(); }
                    else { showToast("规范手册加载中"); }
                }
            });
        }

        function poseFor(m, a) {
            var floor = DIM.floors[a.s];
            var scale = cfg.bookScale;
            if (a.o === "f") {
                var below = flatHeightBelow(a.s, m, a);
                return {
                    p: [a.x, floor + below + (m.t * scale) / 2 + 0.001, bookZ(m.d) + 0.01],
                    r: [0, (m.variant % 7 - 3) * 0.012, Math.PI / 2]
                };
            }
            var tilt = m.tilt || 0;
            var bottom = (m.h / 2) * Math.cos(Math.abs(tilt)) + (m.t * scale / 2) * Math.sin(Math.abs(tilt));
            return {
                p: [a.x, floor + bottom + 0.001, bookZ(m.d) + ((m.variant % 7) - 3) * 0.0022 + (m.pulled ? 0.055 : 0)],
                r: [0, ((m.variant % 5) - 2) * 0.008, tilt]
            };
        }

        /* ---------- 拿起 / 拖动 / 放置 ---------- */
        var busyKey = null;
        var busyUntil = 0;
        function markBusy(key) {
            busyKey = key;
            busyUntil = clock.elapsedTime + 0.55;
        }

        function setPhase(p) {
            phase = p;
            host.setAttribute("data-phase", p);
        }

        function beginGrab(obj) {
            if (!obj) { return; }
            if (phase === "held") { putBack(true); }
            if (phase !== "idle") { return; }
            activeObj = obj;
            var a = ASSIGN[obj.model.key];
            dragInfo = {
                startClientX: lastClient.x, startClientY: lastClient.y,
                origin: { s: a.s, x: a.x, o: a.o, l: a.l },
                moved: false, pointerId: activePointerId
            };
            lastValid = null;
            setPhase("grabbed");
            clearCard();
            playSound("pick");
            obj.outline.visible = true;
            obj.socket.visible = true;
            tweenScalar(obj.group.scale, "x", 1.05, 0.16, {});
            tweenScalar(obj.group.scale, "y", 1.05, 0.16, {});
            tweenScalar(obj.group.scale, "z", 1.05, 0.16, {});
        }

        function updateDrag(e) {
            setNdc(e);
            raycaster.setFromCamera(pointerNdc, activeCam);
            if (!raycaster.ray.intersectPlane(dragPlane, dragPoint)) { return; }
            var m = activeObj.model;
            var shelf = shelfAtY(dragPoint.y);
            var mode = "u";
            var top = stackTopOnShelf(shelf);
            if (top && dragPoint.y > top.y - 0.09 && Math.abs(dragPoint.x - top.x) < Math.max(0.2, m.h * 0.8 + 0.06)) {
                mode = "f";
            }
            var result;
            if (mode === "f" && top) {
                var halfShelf = DIM.innerW / 2 - 0.018;
                var cx = clamp(top.x, -halfShelf + m.h / 2, halfShelf - m.h / 2);
                var fits = m.h <= top.model.h * 1.5 + 0.06;
                result = { ok: fits, x: cx, mode: "f", layer: top.layer, topY: top.y, support: true };
            } else {
                result = findPlacement(shelf, dragPoint.x, m, "u");
                result.layer = 0;
            }
            lastValid = result.ok ? {
                s: shelf, x: result.x, o: result.mode,
                l: result.layer || 0
            } : null;

            /* ghost + 层位高亮 */
            var floor = DIM.floors[shelf];
            if (result.ok) {
                ghost.visible = true;
                setGhostColor(true);
                ghost.scale.set(m.t * cfg.bookScale, m.h, m.d);
                if (result.mode === "f") {
                    ghost.rotation.set(0, 0, Math.PI / 2);
                    var topY = result.topY !== undefined ? result.topY : floor;
                    ghost.position.set(result.x, topY + (m.t * cfg.bookScale) / 2 + 0.001, bookZ(m.d) + 0.01);
                    ghost.scale.set(m.t * cfg.bookScale, m.h, m.d);
                } else {
                    ghost.rotation.set(0, 0, 0);
                    ghost.position.set(result.x, floor + m.h / 2, bookZ(m.d));
                }
                zoneHighlight.visible = true;
                zoneHighlight.position.set(0, floor + DIM.zoneH / 2, DIM.frontZ - DIM.innerD / 2 + 0.02);
            } else {
                ghost.visible = true;
                setGhostColor(false);
                ghost.rotation.set(0, 0, result.mode === "f" ? Math.PI / 2 : 0);
                ghost.scale.set(m.t * cfg.bookScale, m.h, m.d);
                ghost.position.set(dragPoint.x, floor + m.h / 2, bookZ(m.d));
                zoneHighlight.visible = true;
                zoneHighlight.position.set(0, floor + DIM.zoneH / 2, DIM.frontZ - DIM.innerD / 2 + 0.02);
            }

            /* 书本跟随指针（保持立/横形态） */
            var g = activeObj.group;
            if (result.mode === "f") {
                g.rotation.set(0, 0, Math.PI / 2);
                g.position.set(clamp(dragPoint.x, -0.44, 0.44), Math.max(floor + 0.08, dragPoint.y) + 0.02, 0.28);
            } else {
                g.rotation.set(0.02, 0, 0.045);
                g.position.set(clamp(dragPoint.x, -0.46, 0.46), floor + m.h / 2 + 0.075, 0.28);
            }
            g.scale.setScalar(1.07);
            refreshShadow();
        }

        function finishPlace() {
            if (!activeObj) { return; }
            var obj = activeObj;
            var m = obj.model;
            var rect = canvasEl.getBoundingClientRect();
            var outside = lastClient.x < rect.left || lastClient.x > rect.right ||
                lastClient.y < rect.top || lastClient.y > rect.bottom;
            if (outside) { lastValid = null; }
            if (!lastValid) {
                var feedback = "这里放不下，已放回原位";
                showToast(feedback);
                playSound("deny");
                lastValid = null;
                putBack(true);
                return;
            }
            var target = lastValid;
            ASSIGN[m.key] = { s: target.s, x: target.x, o: target.o, l: target.l || 0 };
            obj.a = ASSIGN[m.key];
            ghost.visible = false;
            zoneHighlight.visible = false;
            obj.outline.visible = false;
            obj.socket.visible = false;
            hideHover();
            markBusy(m.key);
            setPhase("idle");
            playSound("place");
            var pose = poseFor(m, obj.a);
            tweenVec(obj.group.position, pose.p, 0.2, { tag: "active", ease: easeOut });
            tweenVec(obj.group.rotation, pose.r, 0.2, { tag: "active2", ease: easeOut });
            tweenScalar(obj.group.scale, "x", 1, 0.2);
            tweenScalar(obj.group.scale, "y", 1, 0.2);
            tweenScalar(obj.group.scale, "z", 1, 0.2);
            activeObj = null;
            dragInfo = null;
            updateStatus();
            saveState();
            refreshShadow();
            showToast("已放入第 " + (target.s + 1) + " 层 · " + (target.o === "f" ? "横放" : "竖放"));
            try {
                window.dispatchEvent(new CustomEvent("shelf:placed", {
                    detail: { id: m.key, shelf: target.s, x: target.x, orient: target.o }
                }));
            } catch (e) {}
        }

        function enterHeld() {
            if (!activeObj) { return; }
            var obj = activeObj;
            var m = obj.model;
            setPhase("held");
            markBusy(m.key);
            ghost.visible = false;
            zoneHighlight.visible = false;
            var display = heldPose();
            tweenVec(obj.group.position, display.p, 0.34, { tag: "active", ease: easeOut });
            tweenVec(obj.group.rotation, display.r, 0.34, { tag: "active2", ease: easeOut });
            tweenScalar(obj.group.scale, "x", 1.5, 0.34);
            tweenScalar(obj.group.scale, "y", 1.5, 0.34);
            tweenScalar(obj.group.scale, "z", 1.5, 0.34);
            showCard(obj);
            updateStatus();
            refreshShadow();
        }

        function heldPose() {
            return {
                p: [-0.3, 1.2, 0.92],
                r: [0.05, -Math.PI / 2 + 0.24, 0.03]
            };
        }

        function putBack(silent) {
            if (!activeObj) {
                if (phase !== "idle") { setPhase("idle"); }
                clearCard();
                return;
            }
            var obj = activeObj;
            var m = obj.model;
            var pose = poseFor(m, ASSIGN[m.key]);
            clearCard();
            hideHover();
            obj.outline.visible = false;
            obj.socket.visible = false;
            ghost.visible = false;
            zoneHighlight.visible = false;
            activeObj = null;
            dragInfo = null;
            lastValid = null;
            markBusy(m.key);
            setPhase("idle");
            playSound("place");
            tweenVec(obj.group.position, pose.p, 0.24, { tag: "active", ease: easeOut });
            tweenVec(obj.group.rotation, pose.r, 0.24, { tag: "active2", ease: easeOut });
            tweenScalar(obj.group.scale, "x", 1, 0.24);
            tweenScalar(obj.group.scale, "y", 1, 0.24);
            tweenScalar(obj.group.scale, "z", 1, 0.24);
            updateStatus();
            refreshShadow();
        }

        /* ---------- 指针 ---------- */
        var lastClient = { x: 0, y: 0 };
        var activePointerId = null;
        var orbitLast = { x: 0, y: 0 };
        var dragDist = 0;

        function setNdc(e) {
            var r = canvasEl.getBoundingClientRect();
            pointerNdc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
            pointerNdc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
        }

        function pickBookAt() {
            raycaster.setFromCamera(pointerNdc, activeCam);
            var hits = raycaster.intersectObjects(pickList, false);
            if (!hits.length) { return null; }
            var key = hits[0].object.userData.key;
            return BOOK_BY_KEY[key] || null;
        }

        function setHover(obj) {
            if (hovered === obj) { return; }
            if (hovered) {
                hovered.outline.visible = false;
                hovered.socket.visible = false;
            }
            hovered = obj;
            if (hovered) {
                hovered.outline.visible = true;
                hovered.socket.visible = true;
                canvasEl.style.cursor = "grab";
            } else if (!orbiting) {
                canvasEl.style.cursor = "";
            }
        }
        function hideHover() {
            if (hovered) {
                hovered.outline.visible = false;
                hovered.socket.visible = false;
            }
            hovered = null;
        }

        function onPointerDown(e) {
            if (e.button !== 0 && e.pointerType === "mouse") { return; }
            if (!SCENE_READY) { return; }
            try { canvasEl.setPointerCapture(e.pointerId); } catch (err) {}
            activePointerId = e.pointerId;
            lastClient.x = e.clientX; lastClient.y = e.clientY;
            orbitLast.x = e.clientX; orbitLast.y = e.clientY;
            dragDist = 0;
            setNdc(e);
            pointerInside = true;

            if (phase === "held") {
                /* 手持状态下点击画布其他区域 → 放回 */
                if (elCard && !elCard.hidden && e.target === canvasEl) { putBack(); }
                return;
            }
            if (phase !== "idle") { return; }

            var hit = pickBookAt();
            if (hit) {
                beginGrab(hit);
                e.preventDefault();
                return;
            }
            orbiting = true;
            canvasEl.style.cursor = "grabbing";
            setHover(null);
        }

        function onPointerMove(e) {
            if (!SCENE_READY) { return; }
            lastClient.x = e.clientX; lastClient.y = e.clientY;
            setNdc(e);
            pointerInside = true;
            pointerDirty = true;

            if (phase === "grabbed" && activeObj) {
                var dx = e.clientX - dragInfo.startClientX;
                var dy = e.clientY - dragInfo.startClientY;
                dragDist = Math.sqrt(dx * dx + dy * dy);
                if (dragDist > 5) { dragInfo.moved = true; }
                if (dragInfo.moved) { updateDrag(e); }
                return;
            }
            if (orbiting) {
                var ox = e.clientX - orbitLast.x;
                var oy = e.clientY - orbitLast.y;
                orbitLast.x = e.clientX; orbitLast.y = e.clientY;
                ctrl.goalAz = clamp(ctrl.goalAz - ox * 0.005, -0.85, 0.85);
                ctrl.goalPol = clamp(ctrl.goalPol + oy * 0.0035, -0.28, 0.78);
                return;
            }
            if (phase === "idle") {
                var hit = pickBookAt();
                setHover(hit);
            }
        }

        function onPointerUp(e) {
            if (!SCENE_READY) { return; }
            try { canvasEl.releasePointerCapture(e.pointerId); } catch (err) {}
            if (orbiting) {
                orbiting = false;
                canvasEl.style.cursor = hovered ? "grab" : "";
                return;
            }
            if (phase === "grabbed" && activeObj) {
                if (dragInfo && !dragInfo.moved) { enterHeld(); }
                else { finishPlace(); }
            }
            activePointerId = null;
        }

        function onWheel(e) {
            if (!SCENE_READY) { return; }
            e.preventDefault();
            var k = e.deltaY > 0 ? 1.06 : 0.94;
            ctrl.goalZoom = clamp(ctrl.goalZoom * k, 0.72, 1.5);
            if (activeCam === orthoCam) {
                ctrl.viewZoom = ctrl.goalZoom;
                updateOrtho();
            }
        }

        canvasEl.addEventListener("pointerdown", onPointerDown);
        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp);
        window.addEventListener("pointercancel", onPointerUp);
        canvasEl.addEventListener("wheel", onWheel, { passive: false });
        canvasEl.addEventListener("pointerleave", function () {
            pointerInside = false;
            if (phase === "idle") { setHover(null); }
        });

        canvasEl.addEventListener("keydown", function (e) {
            var handled = true;
            if (e.key === "ArrowLeft") { ctrl.goalAz = clamp(ctrl.goalAz + 0.08, -0.85, 0.85); }
            else if (e.key === "ArrowRight") { ctrl.goalAz = clamp(ctrl.goalAz - 0.08, -0.85, 0.85); }
            else if (e.key === "ArrowUp") { ctrl.goalPol = clamp(ctrl.goalPol - 0.06, -0.28, 0.78); }
            else if (e.key === "ArrowDown") { ctrl.goalPol = clamp(ctrl.goalPol + 0.06, -0.28, 0.78); }
            else if (e.key === "Enter" || e.key === " ") {
                if (hovered) { beginGrab(hovered); enterHeld(); }
            } else if (e.key === "Escape") { putBack(); }
            else { handled = false; }
            if (handled) { e.preventDefault(); }
        });

        window.addEventListener("keydown", function (e) {
            if (e.key !== "Escape") { return; }
            if (window.ShelfSpec && window.ShelfSpec.isOpen && window.ShelfSpec.isOpen()) { return; }
            if (phase !== "idle") { putBack(); }
        });

        /* ---------- 工具栏 ---------- */
        host.addEventListener("click", function (e) {
            var styleBtn = e.target.closest ? e.target.closest("[data-shelf-style]") : null;
            if (styleBtn) { setStyle(styleBtn.getAttribute("data-shelf-style")); return; }
            var camBtn = e.target.closest ? e.target.closest("[data-shelf-cam]") : null;
            if (camBtn) { setCameraPreset(camBtn.getAttribute("data-shelf-cam")); return; }
            var actBtn = e.target.closest ? e.target.closest("[data-shelf-action]") : null;
            if (!actBtn) { return; }
            var act = actBtn.getAttribute("data-shelf-action");
            if (act === "env") { toggleEnvironment(); }
            else if (act === "orbit") { toggleOrbit(); }
            else if (act === "sound") { toggleSound(); }
            else if (act === "reset") { resetLayout(); }
            else if (act === "spec") { if (!window.ShelfSpec) { showToast("规范手册加载中"); } }
            else if (act === "cards") { setView("cards"); }
        });

        /* ---------- 状态栏 ---------- */
        function countGaps() {
            var gaps = 0;
            for (var si = 0; si < 5; si++) {
                var items = [];
                MODELS.forEach(function (m) {
                    var a = ASSIGN[m.key];
                    if (!a || a.s !== si || a.o !== "u") { return; }
                    items.push([a.x - bookWidth(m, a) / 2, a.x + bookWidth(m, a) / 2]);
                });
                items.sort(function (a, b) { return a[0] - b[0]; });
                var cursor = -DIM.innerW / 2 + 0.02;
                items.forEach(function (it) {
                    if (it[0] - cursor > 0.05) { gaps++; }
                    cursor = Math.max(cursor, it[1]);
                });
                if (DIM.innerW / 2 - 0.02 - cursor > 0.05) { gaps++; }
            }
            return gaps;
        }

        function updateStatus() {
            if (!elStatus) { return; }
            var real = 0;
            MODELS.forEach(function (m) { if (m.real) { real++; } });
            var total = MODELS.length;
            var gaps = countGaps();
            var parts = [
                "5 层",
                total + " 册",
                real + " 个项目",
                gaps + " 个空位"
            ];
            elStatus.innerHTML = parts.map(function (p) { return "<span>" + p + "</span>"; }).join("");
        }

        /* ---------- 规格 ---------- */
        function getSpec() {
            var realCount = 0, maxH = 0, sumT = 0, n = 0;
            MODELS.forEach(function (m) {
                if (m.real) { realCount++; }
                maxH = Math.max(maxH, m.h);
                sumT += m.t * cfg.bookScale; n++;
            });
            var thick = n ? sumT / n : 0;
            var gapsCm = countGaps();
            return {
                style: APP_STATE.style,
                camera: APP_STATE.camera,
                environment: APP_STATE.environment,
                orbit: APP_STATE.orbit,
                sound: APP_STATE.sound,
                unit: "m",
                dimensions: {
                    outerW: DIM.outerW, outerH: DIM.outerH, outerD: DIM.outerD,
                    zoneH: DIM.zoneH, shelfW: DIM.innerW, shelfD: DIM.innerD,
                    plankT: DIM.plankT, zones: 5
                },
                tolerances: {
                    shelfGapCm: DIM.zoneH * 100,
                    bookHeightCm: maxH * 100,
                    clearanceCm: (DIM.zoneH - maxH) * 100,
                    slotPitchCm: (thick + 0.008) * 100,
                    bookThicknessCm: thick * 100,
                    bookGapCm: 0.4
                },
                counts: {
                    real: realCount,
                    sample: MODELS.length - realCount,
                    total: MODELS.length,
                    shelves: 5,
                    gaps: gapsCm
                },
                palette: PALETTE.map(function (p) { return { name: p.name, hex: p.hex }; }),
                styles: Object.keys(STYLES).map(function (k) { return { key: k, name: STYLES[k].name }; }),
                cameras: Object.keys(CAMERAS).map(function (k) { return { key: k, name: CAMERAS[k].name }; }),
                environments: [{ key: "studio", name: "摄影棚" }, { key: "room", name: "阅读角" }]
            };
        }

        /* ---------- 调试接口 ---------- */
        function projectKey(key) {
            var obj = BOOK_BY_KEY[key];
            if (!obj) { return null; }
            tmpVec.copy(obj.group.position);
            tmpVec.project(activeCam);
            return { x: tmpVec.x, y: tmpVec.y, z: tmpVec.z };
        }
        function screenOf(key) {
            var p = projectKey(key);
            if (!p) { return null; }
            var r = canvasEl.getBoundingClientRect();
            return {
                x: r.left + (p.x + 1) / 2 * r.width,
                y: r.top + (1 - p.y) / 2 * r.height
            };
        }
        function gapScreen(si) {
            for (var s = Math.max(0, si - 1); s < Math.min(5, si + 2); s++) {
                var items = [];
                MODELS.forEach(function (m) {
                    var a = ASSIGN[m.key];
                    if (!a || a.s !== s || a.o !== "u") { return; }
                    items.push([a.x - bookWidth(m, a) / 2, a.x + bookWidth(m, a) / 2]);
                });
                if (s === PROP.shelf) {
                    items.push([PROP.mugX - 0.05, PROP.mugX + 0.05]);
                    items.push([PROP.plantX - 0.062, PROP.plantX + 0.062]);
                }
                items.sort(function (a, b) { return a[0] - b[0]; });
                var cursor = -DIM.innerW / 2 + 0.02;
                for (var i = 0; i < items.length; i++) {
                    if (items[i][0] - cursor > 0.09) {
                        return screenOfPoint((cursor + items[i][0]) / 2, DIM.floors[s] + DIM.zoneH * 0.5);
                    }
                    cursor = Math.max(cursor, items[i][1]);
                }
                if (DIM.innerW / 2 - 0.02 - cursor > 0.09) {
                    return screenOfPoint((cursor + DIM.innerW / 2 - 0.02) / 2, DIM.floors[s] + DIM.zoneH * 0.5);
                }
            }
            return null;
        }
        function screenOfPoint(x, y) {
            tmpVec.set(x, y, 0.2);
            tmpVec.project(activeCam);
            var r = canvasEl.getBoundingClientRect();
            return {
                x: r.left + (tmpVec.x + 1) / 2 * r.width,
                y: r.top + (1 - tmpVec.y) / 2 * r.height
            };
        }
        function debugState() {
            var gaps = [];
            for (var gs = 0; gs < 5; gs++) {
                var items = [];
                MODELS.forEach(function (m) {
                    var a = ASSIGN[m.key];
                    if (!a || a.s !== gs || a.o !== "u") { return; }
                    items.push([a.x - bookWidth(m, a) / 2, a.x + bookWidth(m, a) / 2]);
                });
                if (gs === PROP.shelf) {
                    items.push([PROP.mugX - 0.05, PROP.mugX + 0.05]);
                    items.push([PROP.plantX - 0.062, PROP.plantX + 0.062]);
                }
                items.sort(function (a, b) { return a[0] - b[0]; });
                var cursor = -DIM.innerW / 2 + 0.02;
                items.forEach(function (it) {
                    if (it[0] - cursor > 0.05) {
                        gaps.push({ shelf: gs, xCm: +(((cursor + it[0]) / 2) * 100).toFixed(1), widthCm: +((it[0] - cursor) * 100).toFixed(1) });
                    }
                    cursor = Math.max(cursor, it[1]);
                });
                if (DIM.innerW / 2 - 0.02 - cursor > 0.05) {
                    gaps.push({ shelf: gs, xCm: +(((cursor + DIM.innerW / 2 - 0.02) / 2) * 100).toFixed(1), widthCm: +((DIM.innerW / 2 - 0.02 - cursor) * 100).toFixed(1) });
                }
            }
            return {
                gaps: gaps,
                phase: phase,
                style: APP_STATE.style,
                camera: APP_STATE.camera,
                environment: APP_STATE.environment,
                orbit: APP_STATE.orbit,
                sound: APP_STATE.sound,
                activeBook: activeObj ? activeObj.model.key : null,
                books: BOOK_OBJ.map(function (b) {
                    return {
                        key: b.model.key,
                        real: !!b.model.real,
                        shelf: b.a.s,
                        xCm: +(b.a.x * 100).toFixed(1),
                        orient: b.a.o,
                        layer: b.a.l,
                        heightCm: +(b.dims.h * 100).toFixed(1),
                        thicknessCm: +(b.dims.t * 100).toFixed(1)
                    };
                })
            };
        }
        function fpsNow() { return fpsValue; }

        /* ---------- 主循环 ---------- */
        var clock = new THREE.Clock();
        var rafId = null;
        var fpsValue = 60;
        var fpsAcc = 0, fpsFrames = 0;
        var SCENE_READY = false;
        var lastHoverCheck = 0;

        function tick() {
            rafId = requestAnimationFrame(tick);
            var dt = Math.min(clock.getDelta(), 0.05);
            var t = clock.elapsedTime;
            updateTweens(dt);

            /* 相机阻尼 */
            if (APP_STATE.orbit && !reduceMotion && !orbiting && phase === "idle") {
                ctrl.goalAz += dt * 0.075 * ctrl.orbitDir;
                if (ctrl.goalAz > 0.62) { ctrl.orbitDir = -1; }
                if (ctrl.goalAz < -0.3) { ctrl.orbitDir = 1; }
            }
            if (activeCam !== orthoCam) {
                ctrl.az += (ctrl.goalAz - ctrl.az) * Math.min(1, dt * 6.5);
                ctrl.pol += (ctrl.goalPol - ctrl.pol) * Math.min(1, dt * 6.5);
                ctrl.viewZoom += (ctrl.goalZoom - ctrl.viewZoom) * Math.min(1, dt * 6.5);
            } else {
                ctrl.az += (ctrl.goalAz - ctrl.az) * Math.min(1, dt * 6.5);
                ctrl.pol += (ctrl.goalPol - ctrl.pol) * Math.min(1, dt * 6.5);
                ctrl.viewZoom += (ctrl.goalZoom - ctrl.viewZoom) * Math.min(1, dt * 6.5);
                updateOrtho();
            }
            ctrl.targetY += (ctrl.goalTargetY - ctrl.targetY) * Math.min(1, dt * 5);
            applyCamera();

            /* 悬浮 */
            if (phase === "idle") {
                for (var i = 0; i < BOOK_OBJ.length; i++) {
                    var b = BOOK_OBJ[i];
                    if (b === activeObj) { continue; }
                    if (b.model.key === busyKey && clock.elapsedTime < busyUntil) { continue; }
                    var target = b === hovered ? 1 : 0;
                    b.hover += (target - b.hover) * Math.min(1, dt * 12);
                    var base = b.a.o === "f" ? 0.01 : (b.model.pulled ? 0.055 : 0);
                    b.group.position.z = b.baseZ + base + b.hover * 0.018;
                    b.group.scale.setScalar(1 + b.hover * 0.02);
                }
            }

            /* 浮尘 */
            var arr = dustGeo.attributes.position.array;
            for (var d = 0; d < DUST_COUNT; d++) {
                arr[d * 3 + 1] += dustSeed[d] * dt * 0.03;
                arr[d * 3] += Math.sin(t * 0.4 + d) * dt * 0.004;
                if (arr[d * 3 + 1] > 2.2) { arr[d * 3 + 1] = 0.15; }
            }
            dustGeo.attributes.position.needsUpdate = true;

            /* 悬停检测（低频） */
            if (phase === "idle" && pointerInside && !orbiting && t - lastHoverCheck > 0.06) {
                lastHoverCheck = t;
                var hit = pickBookAt();
                setHover(hit);
            }

            renderer.render(scene, activeCam);

            fpsAcc += dt; fpsFrames++;
            if (fpsAcc >= 1) {
                fpsValue = Math.round(fpsFrames / fpsAcc);
                fpsAcc = 0; fpsFrames = 0;
            }
        }

        function start() {
            if (rafId === null && !document.hidden) {
                clock.getDelta();
                tick();
            }
        }
        function stop() {
            if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
        }
        document.addEventListener("visibilitychange", function () {
            if (document.hidden) { stop(); }
            else if (body.classList.contains("shelf-active")) { start(); }
        });

        if (typeof ResizeObserver === "function") {
            new ResizeObserver(function () { computeFit(); }).observe(host);
        }
        window.addEventListener("resize", computeFit);

        /* ---------- 构建 ---------- */
        buildEnvironment();
        populateShelf();
        refreshShadow();
        updateStatus();
        updateStyleButtons();
        updateEnvButton();
        updateOrbitButton();
        updateSoundButton();
        setCameraPreset(APP_STATE.camera, true);
        computeFit();
        SCENE_READY = true;
        if (elLoading) { elLoading.hidden = true; }
        if (elFallback) { elFallback.hidden = true; }
        renderer.render(scene, activeCam);

        PUBLIC_API = {
            getSpec: getSpec,
            setStyle: function (k) { setStyle(k); return Promise.resolve(); },
            setCamera: function (k) { setCameraPreset(k); },
            setEnvironment: function (k) {
                if (k !== APP_STATE.environment) { toggleEnvironment(); }
            },
            setOrbit: function (v) { if (!!v !== APP_STATE.orbit) { toggleOrbit(); } },
            setSound: function (v) { if (!!v !== APP_STATE.sound) { toggleSound(); } },
            resetLayout: resetLayout,
            putBack: putBack,
            openSpec: function () {
                if (window.ShelfSpec && window.ShelfSpec.open) { window.ShelfSpec.open(); }
                else { showToast("规范手册加载中"); }
            },
            __debug: {
                state: debugState,
                screenOf: screenOf,
                gapScreen: gapScreen,
                project: projectKey,
                fps: fpsNow
            }
        };
        try {
            window.dispatchEvent(new CustomEvent("shelf:ready", { detail: getSpec() }));
        } catch (e) {}
        if (readyResolve) {
            try { readyResolve(getSpec()); } catch (e) {}
        }
        if (window.shelfReadyHooks && window.shelfReadyHooks.length) {
            window.shelfReadyHooks.forEach(function (fn) { try { fn(getSpec()); } catch (e) {} });
        }

        shelfApi = {
            resume: start,
            pause: function () {
                stop();
                if (phase !== "idle") { putBack(true); }
            }
        };
        start();
        return true;
    }

    /* 对外 API：场景未就绪时安全降级，就绪后自动转发 */
    function whenReady(fn) {
        return readyPromise.then(function () {
            return PUBLIC_API ? fn(PUBLIC_API) : undefined;
        });
    }
    window.Shelf3D = {
        ready: readyPromise,
        featureEnabled: function () { return featureOn; },
        setFeature: function (on) {
            if (!!on !== featureOn && switchBtn) { switchBtn.click(); }
        },
        getSpec: function () { return PUBLIC_API ? PUBLIC_API.getSpec() : null; },
        setStyle: function (k) { return whenReady(function (api) { return api.setStyle(k); }); },
        setCamera: function (k) { return whenReady(function (api) { api.setCamera(k); }); },
        setEnvironment: function (k) { return whenReady(function (api) { api.setEnvironment(k); }); },
        setOrbit: function (v) { return whenReady(function (api) { api.setOrbit(v); }); },
        setSound: function (v) { return whenReady(function (api) { api.setSound(v); }); },
        resetLayout: function () { return whenReady(function (api) { api.resetLayout(); }); },
        putBack: function () { return whenReady(function (api) { api.putBack(); }); },
        openSpec: function () {
            if (window.ShelfSpec && window.ShelfSpec.open) { window.ShelfSpec.open(); }
            else { whenReady(function (api) { api.openSpec(); }); }
        },
        __debug: {
            state: function () { return PUBLIC_API ? PUBLIC_API.__debug.state() : null; },
            screenOf: function (k) { return PUBLIC_API ? PUBLIC_API.__debug.screenOf(k) : null; },
            gapScreen: function (s) { return PUBLIC_API ? PUBLIC_API.__debug.gapScreen(s) : null; },
            project: function (k) { return PUBLIC_API ? PUBLIC_API.__debug.project(k) : null; },
            fps: function () { return PUBLIC_API ? PUBLIC_API.__debug.fps() : 0; }
        }
    };

    /* 卡片视图/窄屏下打开规范手册时，临时显示舞台容器，保证 fixed 抽屉可见 */
    (function watchSpecVisibility() {
        var root = document.getElementById("shelf-spec-root");
        if (!root || typeof MutationObserver !== "function") { return; }
        var bridge = false;
        var cssHas = !!(window.CSS && window.CSS.supports && window.CSS.supports("selector(:has(*))"));
        function sync() {
            var spec = root.querySelector(".shelf-spec");
            var open = !!(spec && !spec.hidden);
            if (open && !body.classList.contains("shelf-active") && !cssHas) {
                bridge = true;
                body.classList.add("shelf-active");
                host.classList.add("is-fallback");
                host.setAttribute("data-spec-only", "1");
                var fb = document.getElementById("shelf-fallback");
                if (fb) { fb.hidden = true; }
                var loading = document.getElementById("shelf-loading");
                if (loading) { loading.hidden = true; }
            } else if (!open && bridge) {
                bridge = false;
                host.removeAttribute("data-spec-only");
                host.classList.remove("is-fallback");
                body.classList.remove("shelf-active");
            }
        }
        new MutationObserver(sync).observe(root, {
            subtree: true, attributes: true,
            attributeFilter: ["hidden", "class", "style"]
        });
        sync();
    })();

    /* 初始视图：功能关闭时强制卡片视图；?showshelf=1 深链同时视为开启开关（QA / 演示用） */
    var initialView = "cards";
    try { initialView = localStorage.getItem(STORE_VIEW) || "cards"; } catch (e) {}
    if (location.search.indexOf("showshelf=1") !== -1) {
        if (!featureOn) {
            featureOn = true;
            writeFeature(true);
            canShelf = computeCanShelf();
            applyFeatureState();
        }
        initialView = "shelf";
    }
    if (initialView === "shelf" && featureOn && canShelf) { setView("shelf"); }
    else { setView("cards"); }
})();
