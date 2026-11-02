/**
 * three.js 登录页 3D 漂浮文档场景
 * 挂载于 .ui-login-brand 品牌面板：三张文档卡片悬浮缓动 + 微粒 + 鼠标视差。
 * 降级策略：无 WebGL / 脚本失败时保留原有 CSS 文档堆叠（.ui-doc-stack）。
 */
(function () {
    "use strict";

    var panel = document.querySelector(".ui-login-brand");
    if (!panel || typeof window.THREE === "undefined") { return; }

    /* WebGL 能力检测 */
    try {
        var probe = document.createElement("canvas");
        if (!(probe.getContext("webgl") || probe.getContext("experimental-webgl"))) { return; }
    } catch (e) { return; }

    var reduceMotion = window.matchMedia
        && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* 移动端品牌面板过矮，不渲染 3D 场景（与 .ui-doc-stack 的 840px 断点保持一致） */
    var rect = panel.getBoundingClientRect();
    if (rect.height < 300) { return; }

    var host, renderer;
    try {
        host = document.createElement("div");
        host.className = "ui-login-3d";
        host.setAttribute("aria-hidden", "true");
        panel.insertBefore(host, panel.firstChild);

        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setClearColor(0x000000, 0);
        host.appendChild(renderer.domElement);
    } catch (e) {
        if (host && host.parentNode) { host.parentNode.removeChild(host); }
        return;
    }

    /* 3D 场景就绪：隐藏 CSS 堆叠降级件 */
    panel.classList.add("has-3d");

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(36, rect.width / rect.height, 0.1, 100);
    camera.position.set(0, 0.45, 6.4);

    /* 灯光：环境光 + 主光 + 冷色补光 */
    scene.add(new THREE.AmbientLight(0xffffff, 0.82));
    var keyLight = new THREE.DirectionalLight(0xffffff, 0.5);
    keyLight.position.set(-3, 5, 4);
    scene.add(keyLight);
    var fillLight = new THREE.DirectionalLight(0xd6f5e6, 0.28);
    fillLight.position.set(4, -2, 2);
    scene.add(fillLight);

    var WHITE = 0xfdfefd;
    var LINE = 0xd9e6de;
    var ACCENT = 0x00a870;

    /* 圆角矩形轮廓（文档卡片截面） */
    function roundedRectShape(w, h, r) {
        var s = new THREE.Shape();
        var x = -w / 2, y = -h / 2;
        s.moveTo(x + r, y);
        s.lineTo(x + w - r, y);
        s.quadraticCurveTo(x + w, y, x + w, y + r);
        s.lineTo(x + w, y + h - r);
        s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        s.lineTo(x + r, y + h);
        s.quadraticCurveTo(x, y + h, x, y + h - r);
        s.lineTo(x, y + r);
        s.quadraticCurveTo(x, y, x + r, y);
        return s;
    }

    function cardGeometry(w, h) {
        return new THREE.ExtrudeGeometry(roundedRectShape(w, h, 0.09), {
            depth: 0.028,
            bevelEnabled: true,
            bevelThickness: 0.008,
            bevelSize: 0.012,
            bevelSegments: 2,
            curveSegments: 6
        });
    }

    /* 卡片正面的“文本行” */
    function addTextLines(card, w, h, withTitle) {
        var frontZ = 0.028 + 0.008 + 0.004;
        var lineMat = new THREE.MeshBasicMaterial({ color: LINE });
        var titleMat = new THREE.MeshBasicMaterial({ color: ACCENT });
        var specs = [
            { y: h / 2 - 0.2, w: w * 0.52, mat: withTitle ? titleMat : lineMat },
            { y: h / 2 - 0.36, w: w * 0.78, mat: lineMat },
            { y: h / 2 - 0.5, w: w * 0.7, mat: lineMat },
            { y: h / 2 - 0.64, w: w * 0.46, mat: lineMat }
        ];
        specs.forEach(function (spec) {
            var geo = new THREE.BoxGeometry(spec.w, 0.032, 0.01);
            var line = new THREE.Mesh(geo, spec.mat);
            line.position.set(-w / 2 + 0.14, spec.y, frontZ);
            card.add(line);
        });
    }

    /* 书签飘带 */
    function addBookmark(card, w, h) {
        var frontZ = 0.028 + 0.008;
        var geo = new THREE.BoxGeometry(0.1, 0.24, 0.012);
        var mark = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: ACCENT }));
        mark.position.set(w / 2 - 0.2, h / 2 - 0.1, frontZ + 0.002);
        card.add(mark);
    }

    var docsGroup = new THREE.Group();
    scene.add(docsGroup);

    var CARD_W = 0.82, CARD_H = 0.95;
    var docSpecs = [
        { x: -1.02, y: -1.88, z: 0.35, rotY: 0.44, rotZ: -0.1, speed: 0.55, phase: 0.0, title: false, bookmark: false },
        { x: 0.03, y: -2.02, z: 0.95, rotY: -0.04, rotZ: 0.03, speed: 0.42, phase: 2.1, title: true, bookmark: false },
        { x: 1.0, y: -1.84, z: 0.3, rotY: -0.42, rotZ: 0.09, speed: 0.62, phase: 4.2, title: false, bookmark: true }
    ];

    var docs = docSpecs.map(function (spec) {
        var card = new THREE.Mesh(
            cardGeometry(CARD_W, CARD_H),
            new THREE.MeshStandardMaterial({ color: WHITE, roughness: 0.92, metalness: 0 })
        );
        card.position.set(spec.x, spec.y, spec.z);
        card.rotation.set(0, spec.rotY, spec.rotZ);
        addTextLines(card, CARD_W, CARD_H, spec.title);
        if (spec.bookmark) { addBookmark(card, CARD_W, CARD_H); }
        docsGroup.add(card);
        return { mesh: card, spec: spec };
    });

    /* 漂浮微粒（柔和圆点） */
    var PARTICLE_COUNT = 46;
    var pGeo = new THREE.BufferGeometry();
    var pPos = new Float32Array(PARTICLE_COUNT * 3);
    var pSpeed = new Float32Array(PARTICLE_COUNT);
    for (var i = 0; i < PARTICLE_COUNT; i++) {
        pPos[i * 3] = (Math.random() * 2 - 1) * 1.9;
        pPos[i * 3 + 1] = -2.6 + Math.random() * 2.0;
        pPos[i * 3 + 2] = -0.8 + Math.random() * 2.2;
        pSpeed[i] = 0.03 + Math.random() * 0.06;
    }
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));

    function dotTexture() {
        var c = document.createElement("canvas");
        c.width = c.height = 64;
        var ctx = c.getContext("2d");
        var grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, "rgba(255,255,255,1)");
        grad.addColorStop(0.4, "rgba(255,255,255,.6)");
        grad.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 64, 64);
        var tex = new THREE.CanvasTexture(c);
        return tex;
    }

    var particles = new THREE.Points(pGeo, new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.05,
        map: dotTexture(),
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        sizeAttenuation: true
    }));
    scene.add(particles);

    /* 尺寸自适应 */
    function resize() {
        var r = panel.getBoundingClientRect();
        if (r.width < 10 || r.height < 10) { return; }
        camera.aspect = r.width / r.height;
        camera.updateProjectionMatrix();
        renderer.setSize(r.width, r.height, false);
    }
    if (typeof ResizeObserver === "function") {
        new ResizeObserver(resize).observe(panel);
    }
    window.addEventListener("resize", resize);
    resize();

    /* 鼠标视差 */
    var pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    panel.addEventListener("mousemove", function (e) {
        var r = panel.getBoundingClientRect();
        pointer.tx = ((e.clientX - r.left) / r.width) * 2 - 1;
        pointer.ty = ((e.clientY - r.top) / r.height) * 2 - 1;
    });
    panel.addEventListener("mouseleave", function () {
        pointer.tx = 0;
        pointer.ty = 0;
    });

    /* 动画循环 */
    var clock = new THREE.Clock();
    var rafId = null;

    function updateParticles(dt) {
        var arr = pGeo.attributes.position.array;
        for (var i = 0; i < PARTICLE_COUNT; i++) {
            arr[i * 3 + 1] += pSpeed[i] * dt;
            arr[i * 3] += Math.sin(clock.elapsedTime * 0.4 + i) * 0.0004;
            if (arr[i * 3 + 1] > -0.5) { arr[i * 3 + 1] = -2.6; }
        }
        pGeo.attributes.position.needsUpdate = true;
    }

    function tick() {
        rafId = requestAnimationFrame(tick);
        var dt = Math.min(clock.getDelta(), 0.05);
        var t = clock.elapsedTime;

        docs.forEach(function (d) {
            var s = d.spec;
            d.mesh.position.y = s.y + Math.sin(t * s.speed + s.phase) * 0.065;
            d.mesh.rotation.y = s.rotY + Math.sin(t * s.speed * 0.8 + s.phase) * 0.09;
            d.mesh.rotation.z = s.rotZ + Math.sin(t * s.speed * 0.6 + s.phase * 1.3) * 0.025;
            d.mesh.rotation.x = Math.sin(t * s.speed * 0.5 + s.phase) * 0.035;
        });

        pointer.x += (pointer.tx - pointer.x) * 0.045;
        pointer.y += (pointer.ty - pointer.y) * 0.045;
        docsGroup.rotation.y = pointer.x * 0.07;
        docsGroup.rotation.x = -pointer.y * 0.045;
        camera.position.x = pointer.x * 0.18;
        camera.position.y = 0.45 - pointer.y * 0.14;
        camera.lookAt(0, -0.7, 0);

        updateParticles(dt);
        renderer.render(scene, camera);
    }

    function start() {
        if (rafId === null && !document.hidden) {
            clock.getDelta();
            tick();
        }
    }
    function stop() {
        if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
    }
    document.addEventListener("visibilitychange", function () {
        if (document.hidden) { stop(); } else { start(); }
    });

    if (reduceMotion) {
        /* 减少动态效果：仅渲染一帧静态画面 */
        renderer.render(scene, camera);
    } else {
        start();
    }
})();
