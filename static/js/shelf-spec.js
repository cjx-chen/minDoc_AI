/**
 * 书柜 3D · 资产规范手册（shelf-spec.js）
 * ---------------------------------------------------------------------------
 * 职责：把《书柜 3D 提示词全量包》§0~§13 完整收进首页 3D 书柜抽屉，
 *       提供 8 个页签、逐段一键复制、以及来自 window.Shelf3D.getSpec() 的实时公差。
 * 约束：IIFE / ES5 语法 / 零依赖 / 不写内联样式（显隐只用 hidden 属性）。
 * 契约：docs/SHELF-3D-CONTRACT.md §4（DOM、类名、API、交互）。
 * 提示词：英文原文逐字取自《书柜 3D 提示词全量包》，中文只做导读与落点说明。
 */
(function () {
    "use strict";

    /* ======================================================================
     * 一、提示词原文（逐字照抄，行断句与源文件一致）
     * ==================================================================== */

    var P = {};

    P.main = [
        "A tall modular wooden bookshelf with five evenly spaced open shelves on a",
        "solid dark walnut hardwood frame, clean straight edges with subtle",
        "chamfers, fine visible wood grain running vertically along the frame,",
        "optional two lower cabinet doors with slim brass handles, books arranged",
        "in upright rows on each shelf with natural variation in height, thickness",
        "and spine colors (deep crimson, navy blue, forest green, mustard yellow,",
        "cream, charcoal), two small horizontal stacks, a potted monstera plant and",
        "a ceramic mug on the third shelf, small gaps between every book so each",
        "book reads as a separate removable object, uniform shelf slot spacing,",
        "PBR physically-based realistic materials, matte paper page edges in cream",
        "white, semi-gloss cloth hardcover spines, satin matte varnish on the wood,",
        "three-quarter perspective view from slightly above eye level, the full",
        "object fully visible and centered, soft warm three-point studio lighting",
        "with gentle ambient occlusion, neutral light gray seamless background,",
        "clean quad-dominant topology, smooth beveled edges, watertight manifold",
        "mesh, symmetric construction, centered at origin, real-world scale in",
        "meters, game-ready asset, approximately 60,000 to 80,000 triangles, high",
        "quality 4K PBR texture maps with albedo, roughness and normal."
    ].join("\n");

    P.stylized = [
        "A stylized hand-painted wooden bookshelf, chunky rounded proportions, five",
        "shelves with thick visible wood planks in warm caramel and honey tones,",
        "smooth simplified shapes with soft bevels, books as bold simple blocks in",
        "saturated colors (red, teal, yellow, purple, cream) with minimal detail, a",
        "few tiny books leaning, one small potted cactus on top, stylized",
        "hand-painted texture look with visible soft brush strokes, warm rim light,",
        "slightly exaggerated cartoon proportions, three-quarter view, full object",
        "centered, clean topology, watertight manifold, real-world scale,",
        "approximately 15,000 to 25,000 triangles, game-ready stylized asset."
    ].join("\n");

    P.lowpoly = [
        "Low-poly wooden bookshelf, five flat-shaded shelves, simple box geometry,",
        "light birch wood color with subtle plank lines, books as flat colored",
        "blocks (red, blue, green, yellow, white) with no texture detail, minimal",
        "silhouette, flat shading, no smooth normals, orthographic three-quarter",
        "view, full object centered on neutral background, clean triangulated",
        "topology, non-overlapping faces, watertight manifold, real-world scale,",
        "approximately 2,000 to 4,000 triangles, mobile-ready game asset."
    ].join("\n");

    P.book = [
        "A single hardcover book standing upright and facing the camera, {COLOR}",
        "cloth-bound cover with subtle woven linen texture, {THICKNESS} thick spine",
        "with a gilded title band and subtle debossed title lines, cream white page",
        "edges with fine individual page lines visible at the fore-edge, slightly",
        "worn corners, matte cloth and semi-gloss foil materials, front-facing",
        "straight-on view, full book centered, clean quad-dominant topology,",
        "watertight manifold mesh, pivot at the book's center, real-world scale in",
        "meters, approximately 3,000 to 5,000 triangles, game-ready asset, no",
        "readable text."
    ].join("\n");

    P.stack = [
        "A small horizontal stack of two to three books lying flat on an invisible",
        "surface, the top book slightly rotated and offset, mixed cloth and",
        "leather-bound covers in muted tones (tan leather, dark green cloth, cream",
        "linen), page edges facing up in cream white with fine page lines, natural",
        "slight misalignment, three-quarter view from above, clean quad topology,",
        "watertight manifold, real-world scale, approximately 4,000 to 6,000",
        "triangles, game-ready asset, no readable text."
    ].join("\n");

    P.plant = [
        "A small potted monstera plant in a simple matte terracotta pot, three to",
        "five glossy dark green leaves with visible vein detail, a little soil on",
        "top, PBR realistic materials, three-quarter view, clean topology,",
        "watertight manifold, real-world scale, approximately 8,000 triangles,",
        "game-ready prop."
    ].join("\n");

    P.mug = [
        "A simple matte ceramic mug in off-white with a subtle speckled glaze,",
        "smooth rounded cylinder with a C-shaped handle, faint coffee stain ring on",
        "the rim, PBR realistic, three-quarter view, clean topology, watertight",
        "manifold, real-world scale, approximately 2,000 triangles, game-ready",
        "prop."
    ].join("\n");

    P.room = [
        "A cozy reading room corner, the tall wooden bookshelf against a warm",
        "off-white plaster wall, light oak parquet floor, soft afternoon window",
        "light from the left casting gentle long shadows, a woven jute rug, the",
        "corner of a cognac leather armchair partially in frame, photorealistic,",
        "cinematic composition, 35mm lens, shallow depth of field, warm color",
        "grading, interior design magazine style."
    ].join("\n");

    P.wood = [
        "Dark walnut hardwood, fine straight wood grain with occasional small",
        "knots, satin matte varnish with soft specular highlights, warm brown tone,",
        "subtle edge wear, seamless tileable PBR albedo, roughness and normal maps,",
        "4K."
    ].join("\n");

    P.linen = [
        "Woven linen book cloth, fine fabric weave with subtle normal detail, matte",
        "finish, gilded foil title band with slight metallic sheen, seamless",
        "tileable, 4K."
    ].join("\n");

    P.paper = [
        "Cream white stacked paper page edges, hundreds of fine parallel page",
        "lines, soft fibrous texture, matte, seamless tileable normal map, 4K."
    ].join("\n");

    P.negGeneral = [
        "blurry, lowres, jpeg artifacts, watermark, signature, text, logo,",
        "oversaturated, underexposed, harsh flash lighting, cropped, out of frame,",
        "tilted camera, fisheye distortion, duplicate objects, worst quality, low",
        "quality."
    ].join("\n");

    P.negStructure = [
        "distorted, deformed, warped shelves, bent frame, asymmetric, uneven shelf",
        "spacing, broken geometry, non-manifold mesh, holes, spikes, noisy",
        "triangulation, books fused into the frame, books merged together, floating",
        "books, duplicate books, missing books, overlapping geometry, unoptimized",
        "dense topology."
    ].join("\n");

    P.negReal = [
        "cartoon, anime, cel shading, clay, plastic look, low-poly, flat colors."
    ].join("\n");

    P.negReplace = [
        "photorealistic textures, fine surface detail, high frequency noise."
    ].join("\n");

    P.views = [
        "three-quarter perspective view from slightly above eye level",
        "straight-on front view, eye level",
        "low hero angle looking slightly up",
        "top-down view at 45 degrees",
        "orthographic view, no perspective distortion"
    ].join("\n");

    P.lens = [
        "35mm lens, f/8, deep depth of field",
        "50mm lens, f/2.8, shallow depth of field",
        "centered composition, full object visible, neutral light gray seamless background"
    ].join("\n");

    P.light = [
        "soft three-point studio lighting, large softbox key light at 4500K",
        "gentle ambient occlusion in crevices",
        "warm afternoon window light from the left",
        "subtle rim light to separate object from background"
    ].join("\n");

    /* ======================================================================
     * 二、DOM 构建工具
     * ==================================================================== */

    function esc(value) {
        return String(value === null || value === undefined ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function promptBlock(text) {
        return '<div class="shelf-spec-prompt-block">' +
            '<button type="button" class="shelf-prompt-copy" aria-label="复制这段提示词">复制</button>' +
            '<pre class="shelf-prompt">' + esc(text) + "</pre>" +
            "</div>";
    }

    function sectionHead(num, title, sub) {
        return '<header class="shelf-spec-sechead">' +
            '<span class="shelf-spec-secnum">' + num + "</span>" +
            '<div class="shelf-spec-secmeta">' +
            '<h3 class="shelf-spec-sectitle">' + title + "</h3>" +
            (sub ? '<p class="shelf-spec-secsub">' + sub + "</p>" : "") +
            "</div></header>";
    }

    function subhead(text) {
        return '<h4 class="shelf-spec-subhead">' + text + "</h4>";
    }

    function lead(text) {
        return '<p class="shelf-spec-lead">' + text + "</p>";
    }

    function paragraph(text) {
        return '<p class="shelf-spec-p">' + text + "</p>";
    }

    function note(text) {
        return '<p class="shelf-spec-note">' + text + "</p>";
    }

    function callout(title, body, tone) {
        return '<div class="shelf-spec-callout' + (tone ? " is-" + tone : "") + '">' +
            '<b class="shelf-spec-callout-title">' + title + "</b>" +
            '<div class="shelf-spec-callout-body">' + body + "</div>" +
            "</div>";
    }

    function table(headers, rows) {
        var html = '<div class="shelf-spec-tablewrap"><table class="shelf-spec-table"><thead><tr>';
        var i;
        var c;
        for (i = 0; i < headers.length; i++) {
            html += '<th scope="col">' + headers[i] + "</th>";
        }
        html += "</tr></thead><tbody>";
        for (i = 0; i < rows.length; i++) {
            html += "<tr>";
            for (c = 0; c < rows[i].length; c++) {
                html += c === 0
                    ? '<th scope="row">' + rows[i][c] + "</th>"
                    : "<td>" + rows[i][c] + "</td>";
            }
            html += "</tr>";
        }
        return html + "</tbody></table></div>";
    }

    function kv(pairs) {
        var html = '<dl class="shelf-spec-kv">';
        for (var i = 0; i < pairs.length; i++) {
            html += '<div class="shelf-spec-kv-item">' +
                "<dt>" + pairs[i][0] + "</dt>" +
                "<dd>" + pairs[i][1] + "</dd>" +
                "</div>";
        }
        return html + "</dl>";
    }

    function chips(items) {
        var html = '<p class="shelf-spec-chips">';
        for (var i = 0; i < items.length; i++) {
            html += '<span class="shelf-spec-chip">' + items[i] + "</span>";
        }
        return html + "</p>";
    }

    function list(items, ordered) {
        var tag = ordered ? "ol" : "ul";
        var html = "<" + tag + ' class="shelf-spec-list">';
        for (var i = 0; i < items.length; i++) {
            html += "<li>" + items[i] + "</li>";
        }
        return html + "</" + tag + ">";
    }

    function cards(items) {
        var html = '<div class="shelf-spec-grid">';
        for (var i = 0; i < items.length; i++) {
            html += '<div class="shelf-spec-card">' +
                '<p class="shelf-spec-card-title"><b>' + items[i][0] + "</b></p>" +
                '<p class="shelf-spec-card-body">' + items[i][1] + "</p>" +
                "</div>";
        }
        return html + "</div>";
    }

    function steps(items) {
        var html = '<ol class="shelf-spec-steps">';
        for (var i = 0; i < items.length; i++) {
            html += '<li class="shelf-spec-step">' +
                "<h4>" + items[i][0] + "</h4>" +
                items[i][1] +
                "</li>";
        }
        return html + "</ol>";
    }

    function section(key, inner, active) {
        return '<section class="shelf-spec-section" data-tab-panel="' + key + '"' +
            ' id="shelf-spec-panel-' + key + '" role="tabpanel"' +
            ' aria-labelledby="shelf-spec-tab-' + key + '" tabindex="0"' +
            (active ? "" : " hidden") + ">" + inner + "</section>";
    }

    /* ======================================================================
     * 三、八章内容
     * ==================================================================== */

    var TABS = [
        { key: "strategy", label: "生成策略", num: "§0" },
        { key: "structure", label: "柜体与变体", num: "§1–3" },
        { key: "book", label: "书本与道具", num: "§4–6" },
        { key: "texture", label: "贴图材质", num: "§8" },
        { key: "negative", label: "负面提示词", num: "§9" },
        { key: "camera", label: "镜头光照", num: "§7·§10" },
        { key: "post", label: "Blender 后处理", num: "§12" },
        { key: "interaction", label: "交互与公差", num: "§11·§13" }
    ];

    var SECTIONS = {};

    /* ---------- §0 生成策略 ---------- */

    SECTIONS.strategy =
        sectionHead("§0", "生成策略 · 先读",
            "文生 3D 不能一次产出可独立拿取的每本书，先定 1 + N 组合策略。") +
        lead("本手册把《书柜 3D 提示词全量包》§0~§13 完整搬进产品页面：英文提示词逐字保留、可直接复制；中文只负责导读、参数解释和本页落点。建议按页签顺序阅读，也可以把它当作资产重制时的对照清单。") +
        callout("1 + N 组合策略",
            '<ol class="shelf-spec-flow">' +
            "<li><b>1 个柜体</b><span>一次性生成书架主体，可带少量书做占位。</span></li>" +
            "<li><b>N 本书</b><span>用「单书模板」批量生成，通过参数表替换颜色 / 厚度。</span></li>" +
            "<li><b>组装</b><span>在 Blender / 引擎内按槽位摆放，书与书之间留 0.3~0.5cm 公差。</span></li>" +
            "</ol>") +
        subhead("工具差异与选型") +
        table(["工具", "强项", "本包的用法"], [
            ["Rodin (Deemos)", "拓扑质量最高，PBR 细节好", "柜体主体首选：先出一版高质量柜体，再谈拆件与道具。"],
            ["Tripo3D", "四边形重拓扑与面数控制，部分版本支持部件拆分", "需要游戏级柜体 / 单书拆件时使用；面数按风格预算收敛。"],
            ["Meshy", "Text-to-3D 与 Text-to-Texture 分离", "结构定稿后用 §8 提示词统一重贴木纹、亚麻书脊与纸边。"],
            ["Hunyuan3D 2.x", "PBR 几何细节强，部件级生成友好", "N 本书批量生成、需要独立部件与可分离网格时使用。"]
        ]) +
        note("<b>选型原则</b>：柜体优先 Rodin 或 Tripo3D，书本批量用 Hunyuan3D 的部件能力，贴图统一交给 Meshy 的 Text-to-Texture。换工具不换提示词结构，交付基线保持一致。") +
        subhead("所有提示词共享的交付基线") +
        kv([
            ["尺度", "米制真实尺度（1 单位 = 1 m），导入后必须 Apply Scale"],
            ["原点", "柜体居中于原点，+Y 向上，便于引擎与 Web 对齐"],
            ["拓扑", "写实 / 风格化 quad-dominant；低模允许三角化但 non-overlapping"],
            ["水密", "watertight manifold：无洞、无穿插、无重复面"],
            ["面数预算", "写实 60k–80k · 风格化 15k–25k · 低模 2k–4k 三角面"],
            ["贴图", "4K PBR，albedo / roughness / normal，可 seamless tileable"],
            ["交互分离", "每本书独立对象，书间留 0.3~0.5cm 公差，保证可拿取"]
        ]) +
        callout("本页（Web 版）与生成管线的关系",
            "<p>页面不调用文生 3D，也不加载外部模型：Three.js 以程序化柜体 + 可独立拿取的书本对象等价实现 1+N，实时尺寸与公差由 <code>Shelf3D.getSpec()</code> 提供。手册里的提示词用于真实资产重制、替换或外包交付时照抄。</p>",
            "tint") +
        note("对应契约：§0 背景与目标、§2 页面结构、§3 JS API。");

    /* ---------- §1–§3 柜体与变体 ---------- */

    SECTIONS.structure =
        sectionHead("§1–§3", "柜体与三种风格变体",
            "一个柜体、三套风格语言，分别对应页面顶栏的写实 / 风格化 / 低多边形。") +
        lead("主提示词同时约束结构、书阵、道具、镜头与交付规格，生成时一次给全，避免模型自行发挥。三个变体之间不要混用材质词：写实版用胡桃木与亚麻，风格化版用手绘与饱和色块，低模版用平面着色与纯色。") +
        subhead("主提示词 · 柜体（PBR 写实）") +
        paragraph('对应页面 <code>data-style="real"</code>。') +
        promptBlock(P.main) +
        subhead("提示词拆解 · 生成后逐条核对") +
        kv([
            ["结构", "五层等距开放层板 + 深胡桃木实木框，直边微倒角，竖向细木纹"],
            ["下柜", "可选两扇下柜门 + 细黄铜拉手（页面默认省略，保留结构位）"],
            ["书阵", "竖放成排，高度 / 厚度 / 书脊色自然变化；每本之间留缝，读作独立可拿取物体"],
            ["道具", "两小摞横放书 + 第 3 层盆栽 + 马克杯"],
            ["槽位", "uniform shelf slot spacing，统一槽距，便于吸附与公差计算"],
            ["材质", "PBR 写实：纸边哑光奶白、布面书脊半哑光、木面缎面清漆"],
            ["镜头", "三分之四、略高于视平线、完整居中、中性浅灰无缝背景"],
            ["光照", "柔和暖色三点棚拍 + 轻 AO"],
            ["交付", "quad-dominant、平滑倒角、水密、对称、原点居中、米制、6–8 万三角、4K PBR"]
        ]) +
        subhead("变体 A · Stylized 风格化") +
        paragraph('对应 <code>data-style="stylized"</code>：圆润厚重、手绘笔触、饱和色块与暖色轮廓光。') +
        promptBlock(P.stylized) +
        subhead("变体 B · Low-poly 低多边形") +
        paragraph('对应 <code>data-style="lowpoly"</code>：平面着色、盒状几何、浅桦木与纯色书块、无贴图。') +
        promptBlock(P.lowpoly) +
        subhead("三风格对照") +
        table(["风格", "data-style", "形态语言", "材质与色彩", "三角面"], [
            ["写实", "real", "直边微倒角、五层等距、结构清晰", "胡桃木 + 亚麻书脊 + 奶白纸边 + 黄铜", "60k–80k"],
            ["风格化", "stylized", "圆润厚重、厚木板、略夸张的可爱比例", "焦糖 / 蜂蜜暖色、饱和色块、手绘笔触", "15k–25k"],
            ["低多边形", "lowpoly", "盒状、平面着色、无平滑法线", "浅桦木 + 纯色书块、无纹理细节", "2k–4k"]
        ]) +
        note("<b>本页行为</b>：切换风格 = 重算材质参数与细节层级（木纹、倒角、阴影、书脊高光），不重新生成网格。三种风格都必须完整成形，而不是简单换色。");

    /* ---------- §4–§6 书本与道具 ---------- */

    SECTIONS.book =
        sectionHead("§4–§6", "书本与装饰道具",
            "单书模板 + 参数替换，是 1+N 里 N 的来源；横放书堆、盆栽与马克杯负责打破整齐。") +
        lead("先用模板生成一本“标准书”，再靠两张参数表批量替换颜色与厚度。单书模板刻意不写可读文字：既能避免版权与乱码，也让书名交给 Web 端贴图 / 标签控制。") +
        subhead("单书模板 · 批量生成用") +
        promptBlock(P.book) +
        subhead("参数替换表") +
        table(["占位符", "可选值", "摆放建议"], [
            ["{COLOR}", "deep crimson / navy blue / forest green / mustard yellow / cream / charcoal / terracotta / dusty rose / burgundy / olive", "同层书脊不超过 2 本同色；深浅交替形成节奏。"],
            ["{THICKNESS}", "slim 2 cm / medium 4 cm / thick 7 cm / oversized art book 10 cm", "常规层以 medium 4 cm 为主，夹 1~2 本 thick 7 cm 制造高低差。"]
        ]) +
        note("示例：<code>{COLOR} = deep crimson</code>、<code>{THICKNESS} = medium 4 cm</code>。替换时保留其余文字不动，尤其 3,000–5,000 triangles、pivot 居中与 no readable text 三条。") +
        callout("书脊视角变体 · 一行替换",
            "<p>把 <code>standing upright and facing the camera</code> 换成 <code>standing upright with the spine facing the camera</code>，即得书脊正对镜头的版本。柜内摆放优先使用这一版，书脊才是主要观感面。</p>") +
        subhead("§5 横放书堆") +
        paragraph("两到三本平放，顶本轻微旋转错位，书页朝上。堆叠必须有下方支撑，页面会做支撑检测。") +
        promptBlock(P.stack) +
        subhead("§6 装饰小物") +
        subhead("盆栽") +
        promptBlock(P.plant) +
        subhead("陶瓷杯") +
        promptBlock(P.mug) +
        subhead("摆放与支撑规则") +
        table(["类型", "生成来源", "页面摆放", "公差与支撑"], [
            ["竖放书", "单书模板 + 参数替换", "每层槽位，可单击拿起 / 拖动换位", "书宽 = 槽宽 + 0.3~0.5cm；书高 = 层高 − 1~2cm"],
            ["横放堆", "§5 横放书堆", "层板端部，顶本可轻微旋转", "下方必须有支撑，否则不允许放置 / 滑落"],
            ["盆栽", "§6 盆栽", "第 3 层端部或柜顶", "底座接地，不占槽位"],
            ["马克杯", "§6 陶瓷杯", "第 3 层", "单独道具，不占槽位"]
        ]) +
        note("<b>关于书立</b>：《提示词包》没有独立的书立提示词。页面若需要书立，按柜体同材质延伸或复用低模描述生成，不要临时改写主提示词。");

    /* ---------- §8 贴图材质 ---------- */

    SECTIONS.texture =
        sectionHead("§8", "贴图与材质重绘",
            "Meshy Text-to-Texture / Tripo 贴图阶段使用，三套提示词覆盖木架、书脊布料、纸张切口。") +
        lead("统一贴图是去掉“生成器塑料感”的关键：柜体、书本和道具必须在同一套光照假设下重贴。木纹方向统一竖向，布纹密度一致，纸边只做 Normal 也能显著提升真实感。") +
        subhead("木架") +
        paragraph("深胡桃木、缎面清漆、轻微边缘磨损；输出无缝平铺的 PBR 三通道。") +
        promptBlock(P.wood) +
        subhead("书脊布料") +
        paragraph("亚麻布纹 + 烫金书名带；适合作为全部书脊的共享材质底。") +
        promptBlock(P.linen) +
        subhead("纸张切口") +
        paragraph("奶白纸页与细密平行页线；书页朝上的横放堆尤其需要。") +
        promptBlock(P.paper) +
        subhead("书脊色板 · 全书架只用这组颜色") +
        table(["色名", "英文参数值", "用途"], [
            ["深绯", "deep crimson", "主色与视觉焦点，占比最高"],
            ["藏青", "navy blue", "冷色平衡，压住暖木色"],
            ["森林绿", "forest green", "呼应站点绿，适合工具 / 技术类书"],
            ["芥末黄", "mustard yellow", "点亮层板，少量使用"],
            ["奶白", "cream", "纸边与浅色书脊，提供呼吸感"],
            ["炭灰", "charcoal", "压暗底色，制造层次"],
            ["陶土", "terracotta", "暖色过渡，与花盆同色系"],
            ["干玫瑰", "dusty rose", "低饱和点缀，避免高饱和刺眼"],
            ["勃艮第", "burgundy", "深红的替代色，适合成套书"],
            ["橄榄", "olive", "自然色补充，适合植物 / 生活类书"]
        ]) +
        subhead("贴图通道规范") +
        table(["资产", "提示词", "通道", "规格"], [
            ["木架", "§8 木架", "Albedo + Roughness + Normal", "4K · seamless tileable"],
            ["书脊", "§8 书脊布料", "Albedo + Normal", "4K · seamless"],
            ["纸边", "§8 纸张切口", "Normal（可叠 Albedo）", "4K · seamless"],
            ["烫金", "书脊布料内描述", "Metallic / Roughness 由材质参数控制", "不单独出图"]
        ]) +
        note("<b>Web 版差异</b>：页面不加载外部贴图，材质以程序化 canvas 纹理等价近似（木纹、布纹、纸边一次生成后复用），具体实现见 <code>shelf-3d.js</code>。");

    /* ---------- §9 负面提示词 ---------- */

    SECTIONS.negative =
        sectionHead("§9", "三级负面提示词",
            "质量兜底 + 结构兜底 + 风格互斥，按目标版本拼装，不要整段复制到所有版本。") +
        lead("负面提示词不是越长越好：通用段每次携带，结构段只在生成柜体 / 书本时携带，风格段则按目标风格二选一。写实版本加“反卡通”段；生成风格化 / 低模时，必须把这一段替换掉。") +
        subhead("通用 · 每次都加") +
        promptBlock(P.negGeneral) +
        subhead("结构类 · 柜体和书生成时加") +
        promptBlock(P.negStructure) +
        subhead("风格互斥 · 写实版本加") +
        promptBlock(P.negReal) +
        subhead("风格化 / 低模版本的替换段") +
        paragraph("生成 low-poly / stylized 版本时，把上面的“风格互斥”段整段替换为下面这段。") +
        promptBlock(P.negReplace) +
        subhead("拼装矩阵") +
        table(["目标版本", "通用", "结构类", "风格互斥", "说明"], [
            ["写实柜体", "✓", "✓", "写实互斥段", "三段全加，重点压 fused / merged / floating。"],
            ["写实单书", "✓", "✓", "写实互斥段", "单书同样需要结构段，避免书页融合。"],
            ["风格化", "✓", "✓", "替换段", "整段替换，不要保留 cartoon 等互斥词。"],
            ["低多边形", "✓", "✓", "替换段", "替换后仍保留 low-poly 结构词。"],
            ["贴图重绘", "✓", "—", "按目标风格", "只保留质量与构图类，避免影响纹理细节。"]
        ]) +
        subhead("负面词 → 页面可观察缺陷") +
        table(["负面词", "页面上的可观察缺陷", "验收方式"], [
            ["books fused into the frame", "书与层板 / 侧板粘连，拿不起或回位异常", "单击取书、放回各执行一次"],
            ["books merged together", "相邻书无法独立选中，槽位计数错误", "核对计数 real / sample / gaps"],
            ["floating books", "书底悬空，没有贴合层板", "侧视 / 俯视机位走查"],
            ["duplicate books / missing books", "槽位重复占用或出现空槽", "刷新后对比存档与计数"],
            ["uneven shelf spacing", "五层层距不一致", "从正面机位查看层距"],
            ["warped shelves / bent frame", "柜体线条弯曲、透视不齐", "正交机位走查"],
            ["noisy triangulation / dense topology", "低模轮廓破碎、帧率下降", "低多边形模式 + 帧率检查"],
            ["duplicate objects", "场景内出现重叠网格与闪面", "环绕 + 俯视走查"]
        ]) +
        note("<b>本页行为</b>：运行时不会把负面词发给任何模型；这张表被用作场景验收清单，把“不该出现的东西”逐条转成可观察、可复现的缺陷。" +
            "质量目标见契约 §7。");

    /* ---------- §7·§10 镜头光照 ---------- */

    SECTIONS.camera =
        sectionHead("§7 · §10", "镜头、光照与展示环境",
            "五个机位、两套环境都由这些关键词驱动；页面按钮只是预设，不是另一套美术。") +
        lead("镜头关键词决定构图，光照关键词决定材质是否可信。页面把 §10 的视角关键词映射成机位按钮、把光照与 §7 的房间描述映射成两套环境；切换时只重算相机与灯光，不重新加载模型。") +
        subhead("页面机位 ↔ 关键词") +
        table(["页面机位", "data-shelf-cam", "视角关键词", "观感"], [
            ["三分之四", "three-quarter", "three-quarter perspective view from slightly above eye level", "默认机位；深度与书本层次最好"],
            ["正面", "front", "straight-on front view, eye level", "看层高与书阵节奏"],
            ["低角度", "hero", "low hero angle looking slightly up", "强调柜体高度与气场"],
            ["俯视", "top", "top-down view at 45 degrees", "看横放堆、层板与道具"],
            ["正交", "ortho", "orthographic view, no perspective distortion", "资产检查、对齐公差"]
        ]) +
        subhead("视角关键词") +
        paragraph("复制内容为英文关键词，行内中文注解只用于导读，不随复制带走。") +
        promptBlock(P.views) +
        subhead("镜头 / 构图") +
        table(["用途", "关键词", "说明"], [
            ["产品图", "35mm lens, f/8, deep depth of field", "全柜清晰，适合资产验收"],
            ["氛围图", "50mm lens, f/2.8, shallow depth of field", "前后景分离，适合运营头图"],
            ["构图", "centered composition, full object visible, neutral light gray seamless background", "主体居中、完整入画、背景干净"]
        ]) +
        promptBlock(P.lens) +
        subhead("光照") +
        promptBlock(P.light) +
        subhead("展示环境 · 摄影棚 / 阅读角") +
        table(["页面环境", "data-environment", "光照与背景", "适配提示词"], [
            ["摄影棚", "studio", "中性浅灰无缝背景 + 三点柔光 4500K + 轻 AO", "§1 主提示词 + §10 光照"],
            ["阅读角", "room", "暖白灰泥墙、橡木地板、左侧午后窗光、暖色调", "§7 房间环境"]
        ]) +
        subhead("§7 房间环境（展示渲染图用）") +
        paragraph("用于运营图 / 展示渲染，不是柜体资产本身。Web 版以暖色环境光、背景渐变与假窗光近似，不加载房间模型。") +
        promptBlock(P.room) +
        note("<b>本页行为</b>：变换机位使用同一台 PerspectiveCamera 的参数插值；正交机位切换到 OrthographicCamera 等价实现。环境切换重建背景与灯光组，书本与柜体不重建。");

    /* ---------- §12 Blender 后处理 ---------- */

    SECTIONS.post =
        sectionHead("§12", "Blender 后处理清单",
            "从导入到导出共六步；命名与碰撞体规范同时是引擎侧与 Web 侧的共同语言。") +
        lead("文生 3D 的产物默认不能直接进项目：缩放、书与架融合、命名混乱、碰撞体缺失都需要在这一步修掉。六步按顺序执行，不要跳步。") +
        steps([
            ["Step 1 · 导入与清理",
                "<p>导入生成的 .glb / .fbx。文生 3D 工具常导出非 1:1 缩放，全选后 <b>Apply Scale</b>（Ctrl+A → Scale）；再全选 → Mesh → Clean Up → Merge by Distance，去除重复顶点。</p>"],
            ["Step 2 · 书与架分离（生成时若融合）",
                "<p>Edit Mode 下按 <b>L</b> 选中连通的一本书 → <b>P</b> → Selection 单独分离；或 Mesh → Separate → By Material / By Loose Parts。每本书 <b>Set Origin → Origin to Center of Mass</b>，把枢轴放到重心。</p>"],
            ["Step 3 · 命名与挂点规范",
                table(["对象", "命名", "说明"], [
                    ["柜体", "Bookshelf_Master", "父级空物体"],
                    ["层板", "Shelf_01 ~ Shelf_05", "兼作碰撞体"],
                    ["单本书", "Book_01 ~ Book_24", "逐本独立"],
                    ["抓取锚点", "Book_XX_GrabSocket", "书脊顶部 Empty，Ctrl+P 父子绑定"],
                    ["装饰物", "Prop_Plant / Prop_Mug", "不进入槽位"],
                    ["贴图", "xxx_Albedo / xxx_Normal / xxx_Roughness", "UE 命名规范"]
                ])],
            ["Step 4 · 碰撞体",
                "<ul><li>每本书：Box Collider 代理（勿用 Mesh Collider，性能差）。</li>" +
                "<li>层板：Box Collider，厚度比视觉层板厚 1~2cm，防止书穿透。</li>" +
                "<li>背板、侧板：Box Collider。</li>" +
                "<li>Blender 内可先设 Rigid Body（Active / Passive）预览，正式项目在引擎里配。</li></ul>"],
            ["Step 5 · 公差检查",
                "<p>逐本书进 N 面板核对尺寸：<b>书宽 = 槽宽 + 0.3~0.5cm，书高 = 层高 − 1~2cm</b>。不达标直接输入数值微调 Scale。</p>"],
            ["Step 6 · 导出",
                "<ul><li>选中全部 → Export → glTF 2.0 (.glb)：<b>+Y Up</b>，<b>Apply Modifiers</b>。</li>" +
                "<li>UE 用户导 FBX：<b>Apply Transform</b>，关闭 <b>Add Leaf Bones</b>。</li></ul>"]
        ]) +
        subhead("导出参数速查") +
        chips(["+Y Up", "Apply Modifiers", "glTF 2.0 (.glb)", "FBX · Apply Transform", "Add Leaf Bones 关闭"]) +
        subhead("命名规范在 Web 版的等价物（示意）") +
        table(["Blender / 引擎命名", "Web 场景中的等价物"], [
            ["Bookshelf_Master", "场景根 Group（柜体与所有子对象）"],
            ["Shelf_01 ~ Shelf_05", "每层 Group + 层序号（userData.shelfIndex）"],
            ["Book_01 ~ Book_24", "每本书 Group + 书籍 ID / real 标记"],
            ["Book_XX_GrabSocket", "书脊顶部抓取点，决定拖拽枢轴与包围盒"],
            ["Prop_Plant / Prop_Mug", "装饰 Mesh，不参与槽位占用"],
            ["xxx_Albedo 等", "程序化材质缓存键（本页不加载外部贴图）"]
        ]) +
        note("<b>本页行为</b>：页面没有 Blender 环节；命名规范保留在场景对象结构与摆放存档里，公差由布局算法保证，并由「交互与公差」页签实时展示。");

    /* ---------- §11 · §13 交互与公差 ---------- */

    SECTIONS.interaction =
        sectionHead("§11 · §13", "交互、公差与引擎要点",
            "先读实时公差，再看微调建议与引擎侧状态机；Web 版用 Three.js 状态机等价实现。") +
        '<div class="shelf-spec-live" data-spec-live aria-live="polite">' +
        '<p class="shelf-spec-waiting">待场景就绪 · 打开 3D 书柜后自动读取层高、书高、手取余量、槽距、书厚与间隙</p>' +
        "</div>" +
        note("数据来源 <code>window.Shelf3D.getSpec()</code>，单位 cm；场景未就绪或接口返回 null 时显示「待场景就绪」，并在 <code>shelf:ready</code> 后自动刷新，绝不抛错。") +
        subhead("§11 微调建议") +
        cards([
            ["公差与可分离性",
                "书宽 = 槽宽 + 0.3~0.5cm，书高 = 层高 − 1~2cm，留出手指拿取空间。若生成结果中书与架融合，改用单书模板逐本生成再组装，或开启工具的部件分割功能重出。"],
            ["交互挂点",
                "每本书 pivot 设在重心而非几何中心，书脊顶部加 Empty 空物体作抓取锚点；每层加 Box Collider；书设为刚体并降低摩擦。VR 抓取或鼠标拖拽、放回时物理表现才自然。"],
            ["风格统一",
                "先定 6~8 色书脊色板，全书架只用这些颜色；Meshy 用户可对柜体和书使用同一段贴图提示词重贴，避免木纹与布料质感不统一。"],
            ["自然感细节",
                "追加 <code>slight random 2-5 degree tilt, one book leaning, one book pulled halfway out</code>。一本书半抽出槽最能暗示「可拿取」，展示效果也最好。"]
        ]) +
        subhead("§13 核心状态机") +
        '<div class="shelf-spec-state" role="img" aria-label="Idle 在架上，到 Grabbed 被拿起，到 Placed 放回或放到新位置">' +
        '<span class="shelf-spec-state-node"><b>Idle</b><small>在架上</small></span>' +
        '<span class="shelf-spec-state-arrow" aria-hidden="true">→</span>' +
        '<span class="shelf-spec-state-node"><b>Grabbed</b><small>被拿起</small></span>' +
        '<span class="shelf-spec-state-arrow" aria-hidden="true">→</span>' +
        '<span class="shelf-spec-state-node"><b>Placed</b><small>放回 / 放到新位置</small></span>' +
        "</div>" +
        subhead("Unity 要点") +
        list([
            "每本书挂 <code>BookInteractable</code> 脚本，实现 <code>XRGrabInteractable</code>（VR）或自定义鼠标拖拽。",
            "Rigidbody 管理：在架上 <code>isKinematic = true</code>；被拿起时关闭物理，用 Transform 跟随手部；松手瞬间恢复。",
            "<b>槽位吸附</b>：每个槽位定义 <code>BookSlot</code>（Transform + Box 尺寸）；松手时检测最近空槽位，距离 &lt; 5cm → 位置 + 朝向插值对齐（Lerp，0.1~0.2s）。",
            "碰撞层：Book↔Book 互相碰撞，Shelf 对 Book 单向阻挡。",
            "高亮反馈：拿起时 Outline + 轻微缩放（1.05x），放下成功播放吸附音效。"
        ]) +
        subhead("UE 要点") +
        list([
            "Enhanced Input + Motion Controller（VR）或 PC 鼠标射线抓取。",
            "每本书 Actor 加 <b>Physics Handle</b> 组件；在架上 Simulate Physics 关闭，拿起时 Grab Component at Location。",
            "放下逻辑：Sphere Overlap / Line Trace 找最近 <code>BP_BookSlot</code>，命中且为空 → Lerp 吸附对齐。",
            "Collision Preset：书对书、书对层板 BlockAllDynamic。",
            "放回失败（松手处无槽位）→ 飞回原槽位或原地自由摆放，二选一写进设计文档。"
        ]) +
        subhead("通用逻辑清单") +
        list([
            "<b>拿起</b>：记录原槽位引用 → 清除占用标记 → 开启抓取。",
            "<b>悬停预览</b>：拿起状态下，准星指向空槽位时显示半透明预览 ghost。",
            "<b>放下</b>：命中有效空槽 → 吸附；命中无效位置 → 允许自由摆放或回原槽位。",
            "<b>堆叠</b>：横放书堆需额外支撑检测（下方无支撑则滑落 / 不允许放置）。",
            "<b>存档</b>：记录每本书的槽位 ID，读档时重建摆放状态。"
        ], true) +
        subhead("引擎侧 → Web 版等价实现") +
        table(["引擎侧概念", "Web 版等价实现"], [
            ["Idle / Grabbed / Placed", "同一套 phase 状态机（idle / grabbed / placed），由指针事件驱动"],
            ["Rigidbody isKinematic", "无真实刚体；拿起时脱离槽位矩阵，Transform 跟随指针插值"],
            ["Box Collider", "Raycaster + 槽位 / 层板包围盒命中，代替物理碰撞"],
            ["BookSlot + 距离 &lt; 5cm 吸附", "最近空槽 + 世界距离阈值吸附；以页面实际阈值为准"],
            ["Physics Handle", "pointerdown / pointermove / pointerup 拖拽状态机"],
            ["Outline + 1.05x 缩放", "高亮描边 + 轻微放大，松手回落"],
            ["放回失败飞回原槽", "无效位置回退动画 + toast 提示"],
            ["存档 slot ID", "localStorage 摆放存档，刷新后重建"]
        ]) +
        note("<b>键盘与可达性</b>：Esc 关闭手册或放回当前书；Tab 在面板内循环；方向键切换页签；打开手册时焦点进入抽屉，关闭后还原到触发按钮。");

    /* ======================================================================
     * 四、装配抽屉
     * ==================================================================== */

    var tabHtml = "";
    var tabIndex;
    for (tabIndex = 0; tabIndex < TABS.length; tabIndex++) {
        tabHtml += '<button type="button" class="shelf-spec-tab' +
            (tabIndex === 0 ? " is-active" : "") + '"' +
            ' role="tab" id="shelf-spec-tab-' + TABS[tabIndex].key + '"' +
            ' data-spec-tab="' + TABS[tabIndex].key + '"' +
            ' aria-controls="shelf-spec-panel-' + TABS[tabIndex].key + '"' +
            ' aria-selected="' + (tabIndex === 0 ? "true" : "false") + '"' +
            ' tabindex="' + (tabIndex === 0 ? "0" : "-1") + '">' +
            '<span class="shelf-spec-tablabel">' + TABS[tabIndex].label + "</span>" +
            '<span class="shelf-spec-tabnum" aria-hidden="true">' + TABS[tabIndex].num + "</span>" +
            "</button>";
    }

    var sectionHtml = "";
    for (tabIndex = 0; tabIndex < TABS.length; tabIndex++) {
        sectionHtml += section(TABS[tabIndex].key, SECTIONS[TABS[tabIndex].key], tabIndex === 0);
    }

    var specHtml =
        '<div class="shelf-spec" hidden>' +
        '<div class="shelf-spec-backdrop" data-spec-close></div>' +
        '<div class="shelf-spec-panel" role="dialog" aria-modal="true"' +
        ' aria-labelledby="shelf-spec-title" tabindex="-1">' +
        '<header class="shelf-spec-head">' +
        '<div class="shelf-spec-headrow">' +
        '<div class="shelf-spec-headtext">' +
        '<p class="shelf-spec-eyebrow">SHELF 3D · ASSET SPEC / 提示词全量包</p>' +
        '<h2 class="shelf-spec-title" id="shelf-spec-title">书柜 3D · 资产规范手册</h2>' +
        "</div>" +
        '<button type="button" class="shelf-spec-close" data-spec-close aria-label="关闭规范手册">' +
        '<span aria-hidden="true">&times;</span></button>' +
        "</div>" +
        '<p class="shelf-spec-sub">§0~§13 全文收录 · 英文提示词逐字保留 · 点右上角复制即可取用</p>' +
        '<div class="shelf-spec-tabs" role="tablist" aria-label="资产规范章节">' + tabHtml + "</div>" +
        "</header>" +
        '<div class="shelf-spec-body">' + sectionHtml + "</div>" +
        '<footer class="shelf-spec-foot">' +
        '<span class="shelf-spec-foot-src">源：《书柜 3D 提示词全量包》§0~§13 · 英文原文逐字收录</span>' +
        '<span class="shelf-spec-foot-live">实时公差来自 <code>Shelf3D.getSpec()</code> · 1 m = 100 cm</span>' +
        "</footer>" +
        '<div class="shelf-spec-toast" role="status" aria-live="polite"></div>' +
        "</div></div>";

    /* ======================================================================
     * 五、交互
     * ==================================================================== */

    function init() {
        var root = document.getElementById("shelf-spec-root");
        if (!root || root.getAttribute("data-spec-ready") === "1") {
            return;
        }
        root.setAttribute("data-spec-ready", "1");
        root.innerHTML = specHtml;

        var specEl = root.querySelector(".shelf-spec");
        var panel = root.querySelector(".shelf-spec-panel");
        var tabs = root.querySelectorAll(".shelf-spec-tab");
        var panels = root.querySelectorAll(".shelf-spec-section");
        var toast = root.querySelector(".shelf-spec-toast");
        var live = root.querySelector("[data-spec-live]");
        var isOpenFlag = false;
        var lastFocus = null;
        var toastTimer = null;

        /* ---------- 实时公差 ---------- */

        function num(value) {
            var n = Number(value);
            if (value === null || value === undefined || value === "" || isNaN(n)) {
                return "—";
            }
            if (Math.abs(n - Math.round(n)) < 0.05) {
                return String(Math.round(n));
            }
            return n.toFixed(1);
        }

        function pickName(list, key) {
            if (!list || !list.length) {
                return key || "";
            }
            for (var i = 0; i < list.length; i++) {
                if (list[i] && list[i].key === key) {
                    return list[i].name || key;
                }
            }
            return key || "";
        }

        function datum(label, value, hint) {
            return '<div class="shelf-spec-datum">' +
                "<dt>" + label + "</dt>" +
                '<dd><b>' + num(value) + '</b><span class="shelf-spec-unit">cm</span>' +
                "<small>" + hint + "</small></dd>" +
                "</div>";
        }

        function countItem(label, value) {
            var shown = value === null || value === undefined ? "—" : String(value);
            return '<span class="shelf-spec-count"><b>' + esc(shown) + "</b> " + label + "</span>";
        }

        function renderWaiting() {
            if (!live) {
                return;
            }
            live.innerHTML =
                '<p class="shelf-spec-waiting">待场景就绪 · 打开 3D 书柜后自动读取层高、书高、手取余量、槽距、书厚与间隙</p>';
        }

        function renderLive(spec) {
            if (!live) {
                return;
            }
            if (!spec || typeof spec !== "object") {
                renderWaiting();
                return;
            }
            try {
                var tolerances = spec.tolerances || {};
                var counts = spec.counts || {};
                var dims = spec.dimensions || {};

                var stateBits = [];
                var styleName = pickName(spec.styles, spec.style);
                var camName = pickName(spec.cameras, spec.camera);
                var envName = pickName(spec.environments, spec.environment);
                if (styleName) { stateBits.push(styleName); }
                if (camName) { stateBits.push(camName); }
                if (envName) { stateBits.push(envName); }

                var html = '<p class="shelf-spec-live-status">场景就绪' +
                    (stateBits.length ? " · " + esc(stateBits.join(" · ")) : "") +
                    "</p>";

                var factor = dims.unit === "cm" ? 1 : 100;
                var zoneHCm = dims.zoneH !== undefined && dims.zoneH !== null
                    ? Number(dims.zoneH) * factor
                    : tolerances.shelfGapCm;

                html += '<dl class="shelf-spec-live-grid">' +
                    datum("层高", zoneHCm, "层板净空") +
                    datum("书高", tolerances.bookHeightCm, "竖放书高上限") +
                    datum("手取余量", tolerances.clearanceCm, "顶部落手空间") +
                    datum("槽距", tolerances.slotPitchCm, "相邻槽位中心距") +
                    datum("书厚", tolerances.bookThicknessCm, "单书平均厚度") +
                    datum("间隙", tolerances.bookGapCm, "书与书留缝") +
                    "</dl>";

                var countBits = [];
                if (counts.real !== undefined) { countBits.push(countItem("真实书", counts.real)); }
                if (counts.sample !== undefined) { countBits.push(countItem("示例书", counts.sample)); }
                if (counts.gaps !== undefined) { countBits.push(countItem("空槽位", counts.gaps)); }
                if (counts.shelves !== undefined || dims.zones !== undefined) {
                    countBits.push(countItem("层板", counts.shelves !== undefined ? counts.shelves : dims.zones));
                }
                if (counts.total !== undefined) { countBits.push(countItem("总书数", counts.total)); }
                if (countBits.length) {
                    html += '<p class="shelf-spec-live-counts">' + countBits.join("") + "</p>";
                }

                if (dims.outerW !== undefined && dims.outerW !== null) {
                    html += '<p class="shelf-spec-live-dims">外框 ' +
                        num(Number(dims.outerW) * factor) + " × " +
                        num(Number(dims.outerH) * factor) + " × " +
                        num(Number(dims.outerD) * factor) + " cm" +
                        (dims.plankT !== undefined && dims.plankT !== null
                            ? " · 层板厚 " + num(Number(dims.plankT) * factor) + " cm"
                            : "") +
                        "</p>";
                }

                live.innerHTML = html;
            } catch (err) {
                renderWaiting();
            }
        }

        function refreshLive() {
            var spec = null;
            try {
                if (window.Shelf3D && typeof window.Shelf3D.getSpec === "function") {
                    spec = window.Shelf3D.getSpec();
                }
            } catch (err) {
                spec = null;
            }
            if (spec && typeof spec.then === "function") {
                try {
                    spec.then(renderLive, function () { renderWaiting(); });
                } catch (err2) {
                    renderWaiting();
                }
                return;
            }
            if (spec) {
                renderLive(spec);
            } else {
                renderWaiting();
            }
        }

        /* ---------- 打开 / 关闭 ---------- */

        function focusPanel() {
            try {
                panel.focus();
            } catch (err) {
                /* ignore */
            }
        }

        function open() {
            if (isOpenFlag) {
                return;
            }
            isOpenFlag = true;
            lastFocus = document.activeElement;
            specEl.hidden = false;
            specEl.className = "shelf-spec is-open";
            /* 极端情况：舞台被祖先 display:none（<1024px 卡片回退）时，
               不锁定页面滚动，避免“页面卡住但抽屉不可见”。 */
            if (panel.getClientRects().length) {
                document.body.classList.add("shelf-spec-locked");
            }
            refreshLive();
            focusPanel();
        }

        function close() {
            if (!isOpenFlag) {
                return;
            }
            isOpenFlag = false;
            specEl.className = "shelf-spec";
            specEl.hidden = true;
            document.body.classList.remove("shelf-spec-locked");
            if (lastFocus && typeof lastFocus.focus === "function") {
                try {
                    lastFocus.focus();
                } catch (err) {
                    /* ignore */
                }
            }
            lastFocus = null;
        }

        function toggle() {
            if (isOpenFlag) {
                close();
            } else {
                open();
            }
        }

        /* ---------- 页签 ---------- */

        function activateTab(key, focusTab) {
            var i;
            var matched = false;
            for (i = 0; i < tabs.length; i++) {
                if (tabs[i].getAttribute("data-spec-tab") === key) {
                    matched = true;
                    tabs[i].classList.add("is-active");
                    tabs[i].setAttribute("aria-selected", "true");
                    tabs[i].setAttribute("tabindex", "0");
                    if (focusTab) {
                        try {
                            tabs[i].focus();
                        } catch (err) {
                            /* ignore */
                        }
                    }
                } else {
                    tabs[i].classList.remove("is-active");
                    tabs[i].setAttribute("aria-selected", "false");
                    tabs[i].setAttribute("tabindex", "-1");
                }
            }
            if (!matched) {
                return;
            }
            for (i = 0; i < panels.length; i++) {
                if (panels[i].getAttribute("data-tab-panel") === key) {
                    panels[i].hidden = false;
                } else {
                    panels[i].hidden = true;
                }
            }
            var body = root.querySelector(".shelf-spec-body");
            if (body) {
                body.scrollTop = 0;
            }
        }

        function tabFromKey(event) {
            var key = event.key;
            var code = event.keyCode;
            var active = document.activeElement;
            var current = -1;
            var i;
            for (i = 0; i < tabs.length; i++) {
                if (tabs[i] === active) {
                    current = i;
                }
            }
            if (current < 0) {
                return;
            }
            var target = -1;
            if (key === "ArrowRight" || code === 39) {
                target = (current + 1) % tabs.length;
            } else if (key === "ArrowLeft" || code === 37) {
                target = (current - 1 + tabs.length) % tabs.length;
            } else if (key === "Home" || code === 36) {
                target = 0;
            } else if (key === "End" || code === 35) {
                target = tabs.length - 1;
            }
            if (target >= 0) {
                event.preventDefault();
                activateTab(tabs[target].getAttribute("data-spec-tab"), true);
            }
        }

        /* ---------- 复制 ---------- */

        function fallbackCopy(text) {
            var textarea = document.createElement("textarea");
            textarea.className = "shelf-spec-copy-src";
            textarea.setAttribute("readonly", "readonly");
            textarea.setAttribute("aria-hidden", "true");
            textarea.value = text;
            panel.appendChild(textarea);
            var ok = false;
            try {
                textarea.select();
                textarea.setSelectionRange(0, text.length);
                ok = document.execCommand("copy");
            } catch (err) {
                ok = false;
            }
            panel.removeChild(textarea);
            return ok;
        }

        function showToast(message) {
            if (!toast) {
                return;
            }
            toast.textContent = message;
            toast.className = "shelf-spec-toast is-show";
            if (toastTimer) {
                clearTimeout(toastTimer);
            }
            toastTimer = setTimeout(function () {
                toast.className = "shelf-spec-toast";
                toast.textContent = "";
            }, 1600);
        }

        function flashButton(button, ok) {
            if (!button) {
                return;
            }
            button.textContent = ok ? "已复制" : "复制失败";
            button.className = "shelf-prompt-copy " + (ok ? "is-copied" : "is-failed");
            setTimeout(function () {
                button.textContent = "复制";
                button.className = "shelf-prompt-copy";
            }, 1400);
        }

        function copyPrompt(button) {
            var block = button.parentNode;
            while (block && block.className.indexOf("shelf-spec-prompt-block") === -1) {
                block = block.parentNode;
            }
            if (!block) {
                return;
            }
            var pre = block.querySelector(".shelf-prompt");
            if (!pre) {
                return;
            }
            var text = pre.textContent || pre.innerText || "";
            var finish = function (ok) {
                flashButton(button, ok);
                showToast(ok ? "已复制到剪贴板" : "复制失败，请手动选择文本");
            };
            if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
                try {
                    var promise = navigator.clipboard.writeText(text);
                    if (promise && typeof promise.then === "function") {
                        promise.then(function () {
                            finish(true);
                        }, function () {
                            finish(fallbackCopy(text));
                        });
                    } else {
                        finish(fallbackCopy(text));
                    }
                } catch (err) {
                    finish(fallbackCopy(text));
                }
                return;
            }
            finish(fallbackCopy(text));
        }

        /* ---------- 事件 ---------- */

        function closest(node, selector) {
            while (node && node.nodeType === 1) {
                var fn = node.matches || node.msMatchesSelector || node.webkitMatchesSelector;
                if (fn && fn.call(node, selector)) {
                    return node;
                }
                node = node.parentNode;
            }
            return null;
        }

        document.addEventListener("click", function (event) {
            var target = event.target;

            var trigger = closest(target, '[data-shelf-action="spec"]');
            if (trigger) {
                event.preventDefault();
                open();
                return;
            }

            if (!isOpenFlag) {
                return;
            }

            var closer = closest(target, "[data-spec-close]");
            if (closer) {
                event.preventDefault();
                close();
                return;
            }

            var tab = closest(target, "[data-spec-tab]");
            if (tab && closest(tab, ".shelf-spec-tabs")) {
                event.preventDefault();
                activateTab(tab.getAttribute("data-spec-tab"), true);
                return;
            }

            var copyButton = closest(target, ".shelf-prompt-copy");
            if (copyButton) {
                event.preventDefault();
                copyPrompt(copyButton);
            }
        });

        document.addEventListener("keydown", function (event) {
            if (!isOpenFlag) {
                return;
            }
            var key = event.key;
            var code = event.keyCode;

            if (key === "Escape" || code === 27) {
                event.preventDefault();
                close();
                return;
            }

            if (key === "Tab" || code === 9) {
                var focusables = [];
                var candidates = panel.querySelectorAll(
                    'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
                );
                for (var i = 0; i < candidates.length; i++) {
                    var el = candidates[i];
                    if (el.hidden || el.getAttribute("aria-hidden") === "true") {
                        continue;
                    }
                    if (!el.getClientRects().length) {
                        continue;
                    }
                    focusables.push(el);
                }
                if (!focusables.length) {
                    event.preventDefault();
                    focusPanel();
                    return;
                }
                var first = focusables[0];
                var last = focusables[focusables.length - 1];
                var active = document.activeElement;
                var inside = false;
                for (var j = 0; j < focusables.length; j++) {
                    if (focusables[j] === active) {
                        inside = true;
                    }
                }
                if (event.shiftKey) {
                    if (active === first || active === panel || !inside) {
                        event.preventDefault();
                        try { last.focus(); } catch (err) { /* ignore */ }
                    }
                } else if (active === last || active === panel || !inside) {
                    event.preventDefault();
                    try { first.focus(); } catch (err) { /* ignore */ }
                }
                return;
            }

            var onTab = closest(document.activeElement, "[data-spec-tab]");
            if (onTab && closest(onTab, ".shelf-spec-tabs")) {
                tabFromKey(event);
            }
        });

        window.addEventListener("shelf:ready", function () {
            refreshLive();
        });
        window.addEventListener("shelf:change", function () {
            refreshLive();
        });
        window.addEventListener("shelf:book", function () {
            refreshLive();
        });
        window.addEventListener("shelf:placed", function () {
            refreshLive();
        });

        try {
            if (window.Shelf3D && window.Shelf3D.ready && typeof window.Shelf3D.ready.then === "function") {
                window.Shelf3D.ready.then(function () {
                    refreshLive();
                }, function () {
                    renderWaiting();
                });
            }
        } catch (err) {
            /* ignore */
        }

        refreshLive();

        window.ShelfSpec = {
            open: open,
            close: close,
            toggle: toggle,
            isOpen: function () {
                return isOpenFlag;
            }
        };
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
