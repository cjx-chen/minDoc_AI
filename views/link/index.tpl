<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>网页收集 - {{.SITE_NAME}}</title>
    <link href="{{cdncss "/static/bootstrap/css/bootstrap.min.css"}}" rel="stylesheet">
    <link href="{{cdncss "/static/font-awesome/css/font-awesome.min.css"}}" rel="stylesheet">
    <link href="{{cdncss "/static/css/main.css" "version"}}" rel="stylesheet">
    {{if .WebLinksEmbedded}}{{else}}
    <link href="{{cdncss "/static/css/mindoc-ui.css" "version"}}" rel="stylesheet">
    {{end}}
    <style>
        :root {
            --wl-paper: #F4F6F7;
            --wl-card: #FFFFFF;
            --wl-ink: #1F2933;
            --wl-ink-2: #52606D;
            --wl-ink-3: #9AA5B1;
            --wl-line: #E4E7EB;
            --wl-accent: #0E7C6B;
            --wl-accent-dark: #0A6154;
            --wl-accent-tint: #E9F4F1;
            --wl-danger: #D64545;
            --wl-top: 50px;
        }
        html, body { height: 100%; }
        body.wl-standalone { overflow: hidden; }

        .wl-page {
            height: 100vh;
            box-sizing: border-box;
            display: flex;
            justify-content: center;
            background: var(--wl-paper);
            padding: calc(var(--wl-top) + 20px) 20px 20px;
        }
        .wl-shell {
            width: 100%;
            max-width: 1180px;
            display: flex;
            flex-direction: column;
            background: var(--wl-card);
            border: 1px solid var(--wl-line);
            border-radius: 14px;
            box-shadow: 0 10px 34px rgba(15, 35, 45, .07);
            overflow: hidden;
        }
        body.wl-embedded .wl-page { padding: 0; background: var(--wl-card); }
        body.wl-embedded .wl-shell {
            max-width: none;
            border: 0;
            border-radius: 0;
            box-shadow: none;
        }

        /* ---------- 顶条 ---------- */
        .wl-topbar {
            flex: none;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            padding: 14px 22px;
            border-bottom: 1px solid var(--wl-line);
            background: var(--wl-card);
        }
        .wl-brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
        .wl-brand-mark {
            width: 38px; height: 38px;
            border-radius: 11px;
            background: linear-gradient(135deg, var(--wl-accent), var(--wl-accent-dark));
            color: #fff;
            display: flex; align-items: center; justify-content: center;
            font-size: 15px; font-weight: 700;
            flex: none;
        }
        .wl-brand-text { display: flex; flex-direction: column; min-width: 0; }
        .wl-brand-text strong { font-size: 16px; color: var(--wl-ink); line-height: 1.3; }
        .wl-brand-text small { font-size: 12px; color: var(--wl-ink-3); }
        .wl-topbar-right { display: flex; align-items: center; gap: 10px; flex: none; }
        .wl-search { position: relative; }
        .wl-search input {
            width: 240px;
            height: 34px;
            border: 1px solid var(--wl-line);
            border-radius: 17px;
            padding: 0 14px 0 34px;
            font-size: 13px;
            outline: none;
            background: #F8FAFB;
            transition: border-color .15s, box-shadow .15s, width .2s;
        }
        .wl-search input:focus { border-color: var(--wl-accent); box-shadow: 0 0 0 3px var(--wl-accent-tint); background: #fff; width: 280px; }
        .wl-search i {
            position: absolute; left: 13px; top: 50%; transform: translateY(-50%);
            color: var(--wl-ink-3); font-size: 13px; pointer-events: none;
        }
        .wl-count { font-size: 12px; color: var(--wl-ink-3); white-space: nowrap; }

        /* ---------- 收集区 ---------- */
        .wl-capture {
            flex: none;
            padding: 18px 22px 16px;
            border-bottom: 1px solid var(--wl-line);
            background: linear-gradient(180deg, #FBFDFD, #F6F9F9);
        }
        .wl-capture-row { display: flex; gap: 10px; }
        .wl-capture-row .wl-url-wrap { position: relative; flex: 1; min-width: 0; }
        .wl-capture-row i.wl-url-icon {
            position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
            color: var(--wl-ink-3); font-size: 14px; pointer-events: none;
        }
        .wl-capture-row input {
            width: 100%; height: 42px;
            border: 1px solid var(--wl-line);
            border-radius: 10px;
            padding: 0 14px 0 38px;
            font-size: 14px;
            outline: none;
            background: #fff;
            transition: border-color .15s, box-shadow .15s;
        }
        .wl-capture-row input:focus { border-color: var(--wl-accent); box-shadow: 0 0 0 3px var(--wl-accent-tint); }
        .wl-capture-extra { display: none; margin-top: 10px; gap: 10px; }
        .wl-capture-extra.show { display: flex; }
        .wl-capture-extra input {
            height: 36px;
            border: 1px solid var(--wl-line);
            border-radius: 8px;
            padding: 0 12px;
            font-size: 13px;
            outline: none;
            background: #fff;
            min-width: 0;
        }
        .wl-capture-extra input:focus { border-color: var(--wl-accent); }
        .wl-btn {
            height: 42px;
            border: 0;
            border-radius: 10px;
            padding: 0 20px;
            font-size: 14px;
            cursor: pointer;
            display: inline-flex; align-items: center; gap: 7px;
            transition: background .15s, opacity .15s;
            white-space: nowrap;
        }
        .wl-btn-primary { background: var(--wl-accent); color: #fff; }
        .wl-btn-primary:hover { background: var(--wl-accent-dark); }
        .wl-btn-primary:disabled { background: #B7C4C2; cursor: not-allowed; }
        .wl-btn-ghost { background: #fff; color: var(--wl-ink-2); border: 1px solid var(--wl-line); }
        .wl-btn-ghost:hover { border-color: var(--wl-accent); color: var(--wl-accent); }
        .wl-btn-sm { height: 34px; padding: 0 14px; font-size: 13px; border-radius: 8px; }
        .wl-capture-hint { margin: 9px 2px 0; font-size: 12px; color: var(--wl-ink-3); }
        .wl-capture-hint a { color: var(--wl-accent); cursor: pointer; text-decoration: none; }

        /* ---------- 捕获预览卡片 ---------- */
        .wl-preview {
            display: none;
            margin-top: 14px;
            border: 1px solid #CBE3DC;
            background: #fff;
            border-radius: 12px;
            overflow: hidden;
        }
        .wl-preview.show { display: block; animation: wlFade .25s ease; }
        @keyframes wlFade { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
        .wl-preview-inner { display: flex; gap: 16px; padding: 16px; }
        .wl-preview-cover {
            width: 168px; height: 96px;
            border-radius: 8px;
            object-fit: cover;
            background: #EEF2F3;
            flex: none;
        }
        .wl-preview-body { flex: 1; min-width: 0; }
        .wl-preview-title { font-size: 15px; font-weight: 600; color: var(--wl-ink); margin: 0 0 5px; display: flex; align-items: center; gap: 8px; }
        .wl-preview-title img { width: 16px; height: 16px; border-radius: 3px; flex: none; }
        .wl-preview-title span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .wl-preview-desc { font-size: 13px; color: var(--wl-ink-2); line-height: 1.6; margin: 0 0 6px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .wl-preview-url { font-size: 12px; color: var(--wl-ink-3); word-break: break-all; }
        .wl-preview-meta { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 6px; }
        .wl-badge {
            font-size: 11px; color: var(--wl-accent-dark);
            background: var(--wl-accent-tint);
            border-radius: 10px; padding: 2px 9px;
            display: inline-flex; align-items: center; gap: 4px;
        }
        .wl-preview-actions { display: flex; gap: 10px; margin-top: 12px; align-items: center; flex-wrap: wrap; }
        .wl-preview-msg { font-size: 12px; margin-top: 8px; }
        .wl-preview-msg.ok { color: var(--wl-accent); }
        .wl-preview-msg.warn { color: #B7791F; }
        .wl-preview-fields { display: flex; gap: 10px; margin-top: 10px; flex-wrap: wrap; }
        .wl-preview-fields input {
            height: 34px;
            border: 1px solid var(--wl-line);
            border-radius: 8px;
            padding: 0 12px;
            font-size: 13px;
            outline: none;
            background: #fff;
        }
        .wl-preview-fields input:focus { border-color: var(--wl-accent); }
        .wl-preview-fields .wl-f-tags { width: 260px; }
        .wl-preview-fields .wl-f-note { flex: 1; min-width: 200px; }

        /* ---------- 标签筛选 ---------- */
        .wl-filters {
            flex: none;
            display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
            padding: 10px 22px;
            border-bottom: 1px solid var(--wl-line);
            background: #FBFDFD;
        }
        .wl-filters-label { font-size: 12px; color: var(--wl-ink-3); flex: none; }
        .wl-chip {
            border: 1px solid var(--wl-line);
            background: #fff;
            color: var(--wl-ink-2);
            font-size: 12px;
            border-radius: 14px;
            padding: 3px 12px;
            cursor: pointer;
            transition: all .15s;
        }
        .wl-chip:hover { border-color: var(--wl-accent); color: var(--wl-accent); }
        .wl-chip.active { background: var(--wl-accent); border-color: var(--wl-accent); color: #fff; }

        /* ---------- 卡片网格 ---------- */
        .wl-body { flex: 1; overflow-y: auto; padding: 20px 22px 28px; }
        .wl-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(255px, 1fr));
            gap: 16px;
        }
        .wl-card {
            position: relative;
            border: 1px solid var(--wl-line);
            border-radius: 12px;
            background: #fff;
            overflow: hidden;
            transition: box-shadow .18s, transform .18s, border-color .18s;
            display: flex; flex-direction: column;
        }
        .wl-card:hover { box-shadow: 0 8px 24px rgba(15, 35, 45, .10); transform: translateY(-2px); border-color: #C9D6D4; }
        .wl-card-cover { width: 100%; height: 128px; object-fit: cover; background: #EEF2F3; display: block; }
        .wl-card-cover.empty { display: flex; align-items: center; justify-content: center; color: var(--wl-ink-3); font-size: 12px; }
        .wl-card-cover.generated { display: flex; align-items: center; justify-content: center; }
        .wl-card-cover.generated img { width: 40px; height: 40px; border-radius: 9px; }
        .wl-card-cover.generated .wl-cover-letter { color: #fff; font-size: 32px; font-weight: 600; text-shadow: 0 2px 10px rgba(0,0,0,.28); }
        .wl-card-main { padding: 12px 14px 14px; display: flex; flex-direction: column; gap: 7px; flex: 1; }
        .wl-card-title {
            font-size: 14px; font-weight: 600; color: var(--wl-ink); line-height: 1.45;
            display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
            min-height: 40px;
        }
        .wl-card-title img { width: 15px; height: 15px; border-radius: 3px; margin-right: 6px; vertical-align: -2px; }
        .wl-card-desc {
            font-size: 12px; color: var(--wl-ink-2); line-height: 1.6;
            display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
        }
        .wl-card-tags { display: flex; flex-wrap: wrap; gap: 5px; }
        .wl-tag {
            font-size: 11px; color: var(--wl-accent-dark);
            background: var(--wl-accent-tint);
            border-radius: 9px; padding: 1px 8px;
        }
        .wl-card-foot { margin-top: auto; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .wl-card-domain { font-size: 12px; color: var(--wl-ink-3); display: flex; align-items: center; gap: 5px; min-width: 0; }
        .wl-card-domain span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .wl-card-ops { display: flex; gap: 4px; flex: none; opacity: 0; transition: opacity .15s; position: relative; z-index: 2; }
        .wl-card:hover .wl-card-ops { opacity: 1; }
        .wl-op {
            width: 26px; height: 26px;
            border: 0; border-radius: 6px;
            background: #F1F4F5;
            color: var(--wl-ink-2);
            font-size: 12px;
            cursor: pointer;
            display: inline-flex; align-items: center; justify-content: center;
        }
        .wl-op:hover { background: var(--wl-accent-tint); color: var(--wl-accent); }
        .wl-op.active { background: var(--wl-accent-tint); color: var(--wl-accent); }
        .wl-op.danger:hover { background: #FBEAEA; color: var(--wl-danger); }
        .wl-card-link { position: absolute; inset: 0; z-index: 1; }
        .wl-pin-flag {
            position: absolute; top: 10px; right: 10px; z-index: 2;
            background: rgba(14, 124, 107, .92); color: #fff;
            font-size: 11px; border-radius: 9px; padding: 2px 8px;
            display: inline-flex; align-items: center; gap: 4px;
        }
        .wl-note-flag {
            position: absolute; top: 10px; left: 10px; z-index: 2;
            background: rgba(31, 41, 51, .78); color: #fff;
            font-size: 11px; border-radius: 9px; padding: 2px 8px;
            display: inline-flex; align-items: center; gap: 4px;
        }

        /* ---------- 空态 / 加载 ---------- */
        .wl-empty { text-align: center; padding: 70px 20px; color: var(--wl-ink-3); }
        .wl-empty-mark {
            width: 62px; height: 62px;
            margin: 0 auto 16px;
            border-radius: 18px;
            background: var(--wl-accent-tint);
            color: var(--wl-accent);
            display: flex; align-items: center; justify-content: center;
            font-size: 24px;
        }
        .wl-empty h1 { font-size: 17px; color: var(--wl-ink); margin: 0 0 8px; }
        .wl-empty p { font-size: 13px; margin: 0; }
        .wl-loading { text-align: center; padding: 40px; color: var(--wl-ink-3); font-size: 13px; }
        .wl-spinner {
            display: inline-block; width: 14px; height: 14px;
            border: 2px solid var(--wl-accent-tint); border-top-color: var(--wl-accent);
            border-radius: 50%; animation: wlSpin .7s linear infinite;
            vertical-align: -2px; margin-right: 6px;
        }
        @keyframes wlSpin { to { transform: rotate(360deg); } }

        /* ---------- 提示 ---------- */
        .wl-toast {
            position: fixed; top: 70px; left: 50%; transform: translateX(-50%) translateY(-8px);
            background: rgba(31, 41, 51, .92); color: #fff;
            font-size: 13px; padding: 9px 18px; border-radius: 8px;
            opacity: 0; pointer-events: none; transition: opacity .2s, transform .2s;
            z-index: 2100; max-width: 80vw;
        }
        .wl-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
        .wl-toast.error { background: rgba(214, 69, 69, .94); }

        /* ---------- 弹框 ---------- */
        .wl-modal .modal-dialog { width: 92%; max-width: 760px; }
        .wl-modal .modal-body { max-height: 66vh; overflow-y: auto; }
        .wl-modal .form-group label { font-size: 13px; color: var(--wl-ink-2); font-weight: 600; }
        .wl-modal .form-control { border-radius: 8px; border-color: var(--wl-line); font-size: 13px; }
        .wl-modal .form-control:focus { border-color: var(--wl-accent); box-shadow: 0 0 0 3px var(--wl-accent-tint); }
        .wl-detail-meta { font-size: 12px; color: var(--wl-ink-3); word-break: break-all; margin-bottom: 10px; }
        .wl-detail-meta a { color: var(--wl-accent); }
        .wl-detail-content {
            font-size: 13px; color: var(--wl-ink); line-height: 1.85;
            white-space: pre-wrap; word-break: break-word;
            background: #F8FAFB; border: 1px solid var(--wl-line);
            border-radius: 10px; padding: 14px 16px;
            max-height: 40vh; overflow-y: auto;
        }
        .wl-detail-note {
            font-size: 13px; color: var(--wl-ink-2); line-height: 1.7;
            background: #FDF6E7; border: 1px solid #F3E5C0;
            border-radius: 10px; padding: 10px 14px; margin-top: 12px;
            white-space: pre-wrap; word-break: break-word;
        }
        .wl-detail-empty { font-size: 13px; color: var(--wl-ink-3); padding: 18px; text-align: center; }

        @media (max-width: 768px) {
            .wl-topbar { flex-wrap: wrap; }
            .wl-search input, .wl-search input:focus { width: 100%; }
            .wl-search { flex: 1; }
            .wl-capture-row { flex-direction: column; }
            .wl-preview-inner { flex-direction: column; }
            .wl-preview-cover { width: 100%; height: 140px; }
            body.wl-standalone { overflow: auto; }
            .wl-page { height: auto; min-height: 100vh; }
            .wl-body { overflow: visible; }
        }
    </style>
</head>
<body{{if .WebLinksEmbedded}} class="wl-embedded"{{else}} class="wl-standalone"{{end}}>
{{if .WebLinksEmbedded}}{{else}}
{{template "widgets/header.tpl" .}}
{{end}}
<div class="wl-page">
    <div class="wl-shell">
        <div class="wl-topbar">
            <div class="wl-brand">
                <span class="wl-brand-mark"><i class="fa fa-folder-open-o"></i></span>
                <span class="wl-brand-text">
                    <strong>网页收集</strong>
                    <small>卡片式收藏外部网页 · 自动捕获页面信息与正文 · 可编辑整理 · 点击跳转</small>
                </span>
            </div>
            <div class="wl-topbar-right">
                <span class="wl-count" id="wl-count"></span>
                <div class="wl-search">
                    <i class="fa fa-search"></i>
                    <input type="search" id="wl-search-input" placeholder="搜索标题、描述、标签或网址...">
                </div>
            </div>
        </div>

        <div class="wl-capture">
            <div class="wl-capture-row">
                <div class="wl-url-wrap">
                    <i class="fa fa-globe wl-url-icon"></i>
                    <input type="url" id="wl-url-input" placeholder="粘贴网页链接，自动捕获标题、描述、图标、封面和正文，例如 https://example.com" autocomplete="off">
                </div>
                <button type="button" class="wl-btn wl-btn-primary" id="wl-capture-btn"><i class="fa fa-magic"></i> 捕获并收集</button>
            </div>
            <div class="wl-capture-extra" id="wl-capture-extra">
                <input type="text" id="wl-new-tags" placeholder="标签（逗号分隔，如：支付,联机交易）" style="flex:1;">
                <input type="text" id="wl-new-note" placeholder="笔记（可选，记录为什么收藏）" style="flex:1;">
            </div>
            <p class="wl-capture-hint">自动抓取标题/描述/图标/封面图/正文快照等公开信息；<a id="wl-toggle-extra">填写标签和笔记</a></p>

            <div class="wl-preview" id="wl-preview">
                <div class="wl-preview-inner">
                    <span id="wl-preview-cover-wrap" style="flex:none;display:none;"></span>
                    <img class="wl-preview-cover" id="wl-preview-cover" alt="" style="display:none;">
                    <div class="wl-preview-body">
                        <h3 class="wl-preview-title">
                            <img id="wl-preview-icon" alt="" style="display:none;">
                            <span id="wl-preview-title"></span>
                        </h3>
                        <p class="wl-preview-desc" id="wl-preview-desc"></p>
                        <div class="wl-preview-url" id="wl-preview-url"></div>
                        <div class="wl-preview-meta" id="wl-preview-meta"></div>
                        <div class="wl-preview-msg" id="wl-preview-msg"></div>
                        <div class="wl-preview-actions">
                            <button type="button" class="wl-btn wl-btn-primary wl-btn-sm" id="wl-preview-save"><i class="fa fa-plus"></i> 收集到卡片</button>
                            <button type="button" class="wl-btn wl-btn-ghost wl-btn-sm" id="wl-preview-recapture"><i class="fa fa-refresh"></i> 重新捕获</button>
                            <button type="button" class="wl-btn wl-btn-ghost wl-btn-sm" id="wl-preview-cancel">取消</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="wl-filters" id="wl-filters">
            <span class="wl-filters-label">标签</span>
            <span id="wl-tag-chips"></span>
        </div>

        <div class="wl-body" id="wl-body">
            <div class="wl-loading" id="wl-loading" style="display:none;"><span class="wl-spinner"></span>正在加载...</div>
            <div class="wl-grid" id="wl-grid"></div>
            <div class="wl-empty" id="wl-empty" style="display:none;">
                <div class="wl-empty-mark"><i class="fa fa-folder-open-o"></i></div>
                <h1>还没有收集任何网页</h1>
                <p>在上方输入框粘贴网址，系统会自动捕获页面信息并生成可编辑的卡片</p>
            </div>
        </div>
    </div>
</div>

<div class="wl-toast" id="wl-toast"></div>

<!-- 编辑弹框 -->
<div class="modal fade wl-modal" id="wl-edit-modal" tabindex="-1" role="dialog" aria-labelledby="wl-edit-title">
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
                <h4 class="modal-title" id="wl-edit-title">编辑卡片</h4>
            </div>
            <div class="modal-body">
                <input type="hidden" id="wl-edit-id">
                <div class="form-group">
                    <label for="wl-edit-url">网页地址</label>
                    <input type="url" class="form-control" id="wl-edit-url" placeholder="https://...">
                    <p class="help-block" id="wl-edit-url-hint" style="display:none;font-size:12px;">地址已修改，保存时将重新捕获页面信息与正文。</p>
                </div>
                <div class="form-group">
                    <label for="wl-edit-card-title">标题</label>
                    <input type="text" class="form-control" id="wl-edit-card-title" placeholder="卡片标题">
                </div>
                <div class="form-group">
                    <label for="wl-edit-desc">描述</label>
                    <textarea class="form-control" id="wl-edit-desc" rows="2" placeholder="页面描述（可修改）"></textarea>
                </div>
                <div class="form-group">
                    <label for="wl-edit-tags">标签</label>
                    <input type="text" class="form-control" id="wl-edit-tags" placeholder="逗号分隔，如：支付,联机交易">
                </div>
                <div class="form-group">
                    <label for="wl-edit-note">笔记</label>
                    <textarea class="form-control" id="wl-edit-note" rows="3" placeholder="记录收藏原因、要点等"></textarea>
                </div>
                <div class="checkbox">
                    <label>
                        <input type="checkbox" id="wl-edit-pinned"> 置顶这张卡片
                    </label>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-default" data-dismiss="modal">取消</button>
                <button type="button" class="btn btn-primary" id="wl-edit-save">保存</button>
            </div>
        </div>
    </div>
</div>

<!-- 详情弹框 -->
<div class="modal fade wl-modal" id="wl-detail-modal" tabindex="-1" role="dialog" aria-labelledby="wl-detail-title">
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
                <h4 class="modal-title" id="wl-detail-title">卡片详情</h4>
            </div>
            <div class="modal-body" id="wl-detail-body"></div>
            <div class="modal-footer">
                <a class="btn btn-default" id="wl-detail-open" target="_blank" rel="noopener noreferrer"><i class="fa fa-external-link"></i> 打开原网页</a>
                <button type="button" class="btn btn-default" id="wl-detail-recapture"><i class="fa fa-refresh"></i> 重新捕获</button>
                <button type="button" class="btn btn-primary" id="wl-detail-edit">编辑</button>
            </div>
        </div>
    </div>
</div>

<script type="text/javascript" src="{{cdnjs "/static/jquery/1.12.4/jquery.min.js"}}"></script>
<script type="text/javascript" src="{{cdnjs "/static/bootstrap/js/bootstrap.min.js"}}"></script>
<script type="text/javascript">
    $(function () {
        var BOOK_ID = {{.BookId}};
        var EMBEDDED = {{if .WebLinksEmbedded}}true{{else}}false{{end}};
        var ENABLED = {{if .WebLinksEnabled}}true{{else}}false{{end}};
        var previewUrl = "{{urlfor "LinkController.Preview"}}";
        var addUrl = "{{urlfor "LinkController.Add"}}";
        var editUrl = "{{urlfor "LinkController.Edit"}}";
        var detailUrl = "{{urlfor "LinkController.Detail"}}";
        var pinUrl = "{{urlfor "LinkController.Pin"}}";
        var recaptureUrl = "{{urlfor "LinkController.Recapture"}}";
        var listsUrl = "{{urlfor "LinkController.Lists"}}";
        var deleteUrl = "{{urlfor "LinkController.Delete"}}";

        var $input = $("#wl-url-input");
        var $captureBtn = $("#wl-capture-btn");
        var $preview = $("#wl-preview");
        var $grid = $("#wl-grid");
        var $empty = $("#wl-empty");
        var $loading = $("#wl-loading");
        var $count = $("#wl-count");
        var $search = $("#wl-search-input");
        var $toast = $("#wl-toast");
        var $tagChips = $("#wl-tag-chips");

        var currentPreview = null;   // 当前捕获结果
        var captureTimer = null;
        var searchTimer = null;
        var toastTimer = null;
        var links = [];
        var allTags = [];
        var activeTag = "";
        var detailLink = null;

        /* ---------- 工具 ---------- */
        function toast(message, isError) {
            $toast.text(message).toggleClass("error", !!isError).addClass("show");
            clearTimeout(toastTimer);
            toastTimer = setTimeout(function () { $toast.removeClass("show"); }, 2600);
        }

        function hostOf(url) {
            try { return new URL(url).hostname.replace(/^www\./, ""); } catch (e) { return url; }
        }

        // 无 og:image 时生成品牌色封面（favicon 或标题首字 + 由 URL 确定性派生的渐变色）
        function generatedCover(item) {
            var seed = (item.url || "") + (item.title || "");
            var hash = 0;
            for (var i = 0; i < seed.length; i++) { hash = (hash * 31 + seed.charCodeAt(i)) % 99991; }
            var hue = hash % 360;
            var hue2 = (hue + 38) % 360;
            var $div = $("<div>", {
                "class": "wl-card-cover generated",
                style: "background:linear-gradient(135deg, hsl(" + hue + ",40%,44%), hsl(" + hue2 + ",36%,26%));"
            });
            var letter = $("<span>", { "class": "wl-cover-letter", text: ((item.title || item.url || "?").trim().charAt(0) || "?").toUpperCase() });
            if (item.icon_url) {
                $("<img>", { src: item.icon_url, alt: "", referrerpolicy: "no-referrer" })
                    .on("error", function () { $(this).replaceWith(letter); })
                    .appendTo($div);
            } else {
                $div.append(letter);
            }
            return $div;
        }

        function loading(btn, text) {
            btn.prop("disabled", true).data("html", btn.html()).html('<span class="wl-spinner"></span>' + (text || "处理中"));
        }
        function loaded(btn) {
            btn.prop("disabled", false).html(btn.data("html") || "完成");
        }

        /* ---------- 加载列表 ---------- */
        function loadLinks() {
            $loading.show();
            $grid.empty();
            $.ajax({
                url: listsUrl,
                type: "GET",
                data: { book_id: BOOK_ID, keyword: $search.val().trim(), page: 1, page_size: 120 },
                dataType: "json",
                success: function (resp) {
                    $loading.hide();
                    if (resp.errcode !== 0) {
                        toast(resp.message || "加载失败", true);
                        return;
                    }
                    links = (resp.data && resp.data.list) || [];
                    allTags = (resp.data && resp.data.tags) || [];
                    $count.text("共 " + ((resp.data && resp.data.total) || 0) + " 张卡片");
                    renderTagChips();
                    renderLinks(links);
                },
                error: function () {
                    $loading.hide();
                    toast("网络异常，加载失败", true);
                }
            });
        }

        function renderTagChips() {
            $tagChips.empty();
            if (!allTags.length) {
                $("#wl-filters").hide();
                return;
            }
            $("#wl-filters").show();
            $("<button>", { type: "button", "class": "wl-chip" + (activeTag === "" ? " active" : ""), text: "全部" })
                .on("click", function () { activeTag = ""; renderTagChips(); renderLinks(links); })
                .appendTo($tagChips);
            allTags.forEach(function (tag) {
                $("<button>", { type: "button", "class": "wl-chip" + (activeTag === tag ? " active" : ""), text: tag })
                    .on("click", function () {
                        activeTag = (activeTag === tag) ? "" : tag;
                        renderTagChips();
                        renderLinks(links);
                    })
                    .appendTo($tagChips);
            });
        }

        function renderLinks(list) {
            $grid.empty();
            var visible = list.filter(function (item) {
                if (!activeTag) { return true; }
                return (item.tags || "").toLowerCase().indexOf(activeTag.toLowerCase()) >= 0;
            });
            if (!visible.length) {
                $empty.show();
                if (list.length) { $empty.find("p").text("没有匹配当前筛选条件的卡片"); }
                return;
            }
            $empty.hide().find("p").text("在上方输入框粘贴网址，系统会自动捕获页面信息并生成可编辑的卡片");

            visible.forEach(function (item) {
                var domain = hostOf(item.url);
                var $card = $("<div>", { "class": "wl-card" });

                if (item.pinned == 1) {
                    $("<span>", { "class": "wl-pin-flag", html: '<i class="fa fa-thumb-tack"></i> 置顶' }).appendTo($card);
                }
                if (item.note) {
                    $("<span>", { "class": "wl-note-flag", html: '<i class="fa fa-pencil"></i> 笔记' }).appendTo($card);
                }

                if (item.image_url) {
                    $("<img>", { "class": "wl-card-cover", src: item.image_url, alt: "", loading: "lazy", referrerpolicy: "no-referrer" })
                        .on("error", function () { $(this).replaceWith(generatedCover(item)); })
                        .appendTo($card);
                } else {
                    generatedCover(item).appendTo($card);
                }

                // 整卡点击跳转原网页
                $("<a>", { "class": "wl-card-link", href: item.url, target: "_blank", rel: "noopener noreferrer", title: "点击跳转：" + item.url }).appendTo($card);

                var $main = $("<div>", { "class": "wl-card-main" }).appendTo($card);
                var $title = $("<div>", { "class": "wl-card-title" }).appendTo($main);
                if (item.icon_url) {
                    $("<img>", { src: item.icon_url, alt: "", referrerpolicy: "no-referrer" })
                        .on("error", function () { $(this).remove(); })
                        .appendTo($title);
                }
                $("<span>").text(item.title || item.url).appendTo($title);
                if (item.description) {
                    $("<div>", { "class": "wl-card-desc", text: item.description }).appendTo($main);
                }
                if (item.tags) {
                    var $tags = $("<div>", { "class": "wl-card-tags" }).appendTo($main);
                    item.tags.split(",").forEach(function (tag) {
                        tag = $.trim(tag);
                        if (tag) { $("<span>", { "class": "wl-tag", text: tag }).appendTo($tags); }
                    });
                }
                var $foot = $("<div>", { "class": "wl-card-foot" }).appendTo($main);
                var $domain = $("<div>", { "class": "wl-card-domain" }).appendTo($foot);
                $("<i>", { "class": "fa fa-globe" }).appendTo($domain);
                $("<span>", { text: domain }).appendTo($domain);
                if (item.word_count > 0) {
                    $("<span>", { "class": "wl-tag", text: "正文 " + item.word_count + " 字", style: "margin-left:6px;" }).appendTo($domain);
                }
                if (item.published_at) {
                    $("<span>", { "class": "wl-tag", text: String(item.published_at).slice(0, 10), style: "margin-left:6px;" }).appendTo($domain);
                }

                var $ops = $("<div>", { "class": "wl-card-ops" }).appendTo($foot);
                $("<button>", { "class": "wl-op", type: "button", title: "查看详情与正文", html: '<i class="fa fa-file-text-o"></i>' })
                    .on("click", function (e) { e.preventDefault(); e.stopPropagation(); openDetail(item); }).appendTo($ops);
                $("<button>", { "class": "wl-op", type: "button", title: "编辑", html: '<i class="fa fa-pencil"></i>' })
                    .on("click", function (e) { e.preventDefault(); e.stopPropagation(); openEdit(item); }).appendTo($ops);
                $("<button>", { "class": "wl-op" + (item.pinned == 1 ? " active" : ""), type: "button", title: item.pinned == 1 ? "取消置顶" : "置顶", html: '<i class="fa fa-thumb-tack"></i>' })
                    .on("click", function (e) { e.preventDefault(); e.stopPropagation(); togglePin(item); }).appendTo($ops);
                $("<button>", { "class": "wl-op danger", type: "button", title: "删除", html: '<i class="fa fa-trash-o"></i>' })
                    .on("click", function (e) { e.preventDefault(); e.stopPropagation(); removeLink(item); }).appendTo($ops);

                $card.appendTo($grid);
            });
        }

        /* ---------- 捕获 ---------- */
        function showPreview(result) {
            currentPreview = result;
            $preview.addClass("show");
            $("#wl-preview-title").text(result.title || result.url);
            $("#wl-preview-desc").text(result.description || "").toggle(!!result.description);
            $("#wl-preview-url").text(result.url);

            var $icon = $("#wl-preview-icon");
            if (result.icon_url) {
                $icon.attr("src", result.icon_url).show().off("error").on("error", function () { $(this).hide(); });
            } else { $icon.hide(); }

            var $cover = $("#wl-preview-cover");
            var $wrap = $("#wl-preview-cover-wrap");
            if (result.image_url) {
                $wrap.hide().empty();
                $cover.attr("src", result.image_url).removeClass("empty").show()
                    .off("error").on("error", function () { $(this).hide(); });
            } else {
                // 无 og:image：用生成的品牌色封面（favicon 或首字）
                $cover.hide();
                var $gen = generatedCover(result);
                $gen.addClass("wl-preview-cover").css({ width: "168px", height: "96px", flex: "none" });
                $wrap.empty().append($gen).show();
            }

            var $meta = $("#wl-preview-meta").empty();
            if (result.site_name) {
                $("<span>", { "class": "wl-badge", html: '<i class="fa fa-flag-o"></i>' }).append($("<span>", { text: result.site_name })).appendTo($meta);
            }
            if (result.word_count > 0) {
                $("<span>", { "class": "wl-badge", html: '<i class="fa fa-file-text-o"></i>' }).append($("<span>", { text: "正文 " + result.word_count + " 字" })).appendTo($meta);
            }

            var $msg = $("#wl-preview-msg");
            if (result.fetched) {
                $msg.removeClass("warn").addClass("ok").text(result.word_count > 0 ? "已自动捕获页面信息与正文" : "已自动捕获页面信息（未提取到正文）");
            } else {
                $msg.removeClass("ok").addClass("warn").text(result.message || "自动捕获失败，可仍按当前信息保存");
            }
        }

        function capture(url, silent) {
            url = (url || "").trim();
            if (!url) { return; }
            if (!silent) { loading($captureBtn, "捕获中"); }
            $.ajax({
                url: previewUrl,
                type: "POST",
                data: { url: url },
                dataType: "json",
                success: function (resp) {
                    loaded($captureBtn);
                    if (resp.errcode !== 0) {
                        if (!silent) { toast(resp.message || "捕获失败", true); }
                        return;
                    }
                    if (resp.data) { showPreview(resp.data); }
                },
                error: function () {
                    loaded($captureBtn);
                    if (!silent) { toast("网络异常，捕获失败", true); }
                }
            });
        }

        /* ---------- 收集（新增） ---------- */
        function savePreview() {
            if (!currentPreview) { return; }
            var $btn = $("#wl-preview-save");
            loading($btn, "保存中");
            $.ajax({
                url: addUrl,
                type: "POST",
                data: {
                    url: currentPreview.url,
                    book_id: BOOK_ID,
                    tags: $("#wl-new-tags").val() || "",
                    note: $("#wl-new-note").val() || ""
                },
                dataType: "json",
                success: function (resp) {
                    loaded($btn);
                    if (resp.errcode !== 0) {
                        toast(resp.message || "保存失败", true);
                        return;
                    }
                    toast(resp.data && resp.data.existed ? "该网页已在卡片库中" : "已收集为卡片");
                    $preview.removeClass("show");
                    $input.val("");
                    $("#wl-new-tags").val("");
                    $("#wl-new-note").val("");
                    currentPreview = null;
                    loadLinks();
                },
                error: function () {
                    loaded($btn);
                    toast("网络异常，保存失败", true);
                }
            });
        }

        /* ---------- 编辑 ---------- */
        function openEdit(item) {
            $("#wl-edit-id").val(item.link_id);
            $("#wl-edit-url").val(item.url).data("origin", item.url);
            $("#wl-edit-card-title").val(item.title || "");
            $("#wl-edit-desc").val(item.description || "");
            $("#wl-edit-tags").val(item.tags || "");
            $("#wl-edit-note").val(item.note || "");
            $("#wl-edit-pinned").prop("checked", item.pinned == 1);
            $("#wl-edit-url-hint").hide();
            $("#wl-edit-modal").modal("show");
        }
        $("#wl-edit-url").on("input change", function () {
            var changed = $(this).val().trim() !== ($(this).data("origin") || "");
            $("#wl-edit-url-hint").toggle(changed);
        });
        $("#wl-edit-save").on("click", function () {
            var linkId = $("#wl-edit-id").val();
            var newURL = $("#wl-edit-url").val().trim();
            if (!newURL) { toast("网页地址不能为空", true); return; }
            var $btn = $(this);
            loading($btn, "保存中");
            $.ajax({
                url: editUrl,
                type: "POST",
                data: {
                    link_id: linkId,
                    url: newURL,
                    title: $("#wl-edit-card-title").val(),
                    description: $("#wl-edit-desc").val(),
                    tags: $("#wl-edit-tags").val(),
                    note: $("#wl-edit-note").val(),
                    pinned: $("#wl-edit-pinned").is(":checked") ? 1 : 0
                },
                dataType: "json",
                success: function (resp) {
                    loaded($btn);
                    if (resp.errcode !== 0) {
                        toast(resp.message || "保存失败", true);
                        return;
                    }
                    toast("已保存");
                    $("#wl-edit-modal").modal("hide");
                    loadLinks();
                },
                error: function () {
                    loaded($btn);
                    toast("网络异常，保存失败", true);
                }
            });
        });

        /* ---------- 详情 ---------- */
        function openDetail(item) {
            detailLink = item;
            $.ajax({
                url: detailUrl,
                type: "GET",
                data: { link_id: item.link_id },
                dataType: "json",
                success: function (resp) {
                    if (resp.errcode !== 0 || !resp.data || !resp.data.link) {
                        toast(resp.message || "加载详情失败", true);
                        return;
                    }
                    renderDetail(resp.data.link);
                },
                error: function () { toast("网络异常", true); }
            });
        }
        function renderDetail(link) {
            detailLink = link;
            $("#wl-detail-title").text(link.title || hostOf(link.url));
            $("#wl-detail-open").attr("href", link.url);

            var $body = $("#wl-detail-body").empty();
            var $meta = $("<div>", { "class": "wl-detail-meta" }).appendTo($body);
            $("<div>").append($("<a>", { href: link.url, target: "_blank", rel: "noopener noreferrer", text: link.url })).appendTo($meta);
            var metaBits = [];
            if (link.site_name) { metaBits.push("站点：" + link.site_name); }
            if (link.lang) { metaBits.push("语言：" + link.lang); }
            if (link.author) { metaBits.push("作者：" + link.author); }
            if (link.published_at) { metaBits.push("发布：" + String(link.published_at).slice(0, 10)); }
            if (link.word_count > 0) { metaBits.push("正文 " + link.word_count + " 字"); }
            if (link.tags) { metaBits.push("标签：" + link.tags); }
            if (metaBits.length) {
                $("<div>", { text: metaBits.join(" · "), style: "margin-top:4px;" }).appendTo($meta);
            }
            if (link.description) {
                $("<div>", { text: link.description, style: "margin-top:6px;color:var(--wl-ink-2);" }).appendTo($meta);
            }

            if (link.content) {
                $("<div>", { "class": "wl-detail-content", text: link.content }).appendTo($body);
            } else {
                $("<div>", { "class": "wl-detail-empty", text: "未捕获到正文快照（可点击下方「重新捕获」重试）" }).appendTo($body);
            }
            if (link.note) {
                $("<div>", { "class": "wl-detail-note" }).append($("<strong>", { text: "我的笔记：" })).append(document.createTextNode(link.note)).appendTo($body);
            }
            $("#wl-detail-modal").modal("show");
        }
        $("#wl-detail-edit").on("click", function () {
            $("#wl-detail-modal").modal("hide");
            if (detailLink) { setTimeout(function () { openEdit(detailLink); }, 300); }
        });
        $("#wl-detail-recapture").on("click", function () {
            if (!detailLink) { return; }
            var $btn = $(this);
            loading($btn, "捕获中");
            $.ajax({
                url: recaptureUrl,
                type: "POST",
                data: { link_id: detailLink.link_id },
                dataType: "json",
                success: function (resp) {
                    loaded($btn);
                    if (resp.errcode !== 0) {
                        toast(resp.message || "重新捕获失败", true);
                        return;
                    }
                    if (resp.data && resp.data.link) {
                        detailLink = resp.data.link;
                        renderDetail(resp.data.link);
                        toast(resp.data.preview && resp.data.preview.fetched ? "已重新捕获" : "重新捕获失败，保留原内容", !(resp.data.preview && resp.data.preview.fetched));
                    }
                },
                error: function () { loaded($btn); toast("网络异常", true); }
            });
        });

        /* ---------- 置顶 / 删除 ---------- */
        function togglePin(item) {
            $.ajax({
                url: pinUrl,
                type: "POST",
                data: { link_id: item.link_id },
                dataType: "json",
                success: function (resp) {
                    if (resp.errcode !== 0) { toast(resp.message || "操作失败", true); return; }
                    toast(resp.data && resp.data.link && resp.data.link.pinned == 1 ? "已置顶" : "已取消置顶");
                    loadLinks();
                },
                error: function () { toast("网络异常", true); }
            });
        }

        function removeLink(item) {
            if (!window.confirm("确定删除卡片「" + (item.title || item.url) + "」吗？")) { return; }
            $.ajax({
                url: deleteUrl,
                type: "POST",
                data: { link_id: item.link_id },
                dataType: "json",
                success: function (resp) {
                    if (resp.errcode !== 0) { toast(resp.message || "删除失败", true); return; }
                    toast("已删除");
                    loadLinks();
                },
                error: function () { toast("网络异常，删除失败", true); }
            });
        }

        /* ---------- 事件 ---------- */
        $captureBtn.on("click", function () { capture($input.val()); });
        $input.on("keydown", function (e) {
            if (e.which === 13) { e.preventDefault(); capture($input.val()); }
        });
        // 粘贴或输入合法 URL 后自动捕获（防抖）
        $input.on("input paste", function () {
            var value = $input.val().trim();
            clearTimeout(captureTimer);
            if (!/^https?:\/\/\S+$/i.test(value)) { return; }
            captureTimer = setTimeout(function () { capture(value, true); }, 700);
        });
        $input.on("blur", function () {
            var value = $input.val().trim();
            if (/^https?:\/\/\S+$/i.test(value) && !$preview.hasClass("show")) {
                capture(value, true);
            }
        });

        $("#wl-preview-save").on("click", savePreview);
        $("#wl-preview-recapture").on("click", function () {
            if (currentPreview) { capture(currentPreview.url); }
        });
        $("#wl-preview-cancel").on("click", function () {
            $preview.removeClass("show");
            currentPreview = null;
        });
        $("#wl-toggle-extra").on("click", function () {
            $("#wl-capture-extra").toggleClass("show");
            $(this).text($("#wl-capture-extra").hasClass("show") ? "收起标签和笔记" : "填写标签和笔记");
        });

        $search.on("input", function () {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(loadLinks, 350);
        });

        /* ---------- 初始化 ---------- */
        if (!ENABLED) {
            $captureBtn.prop("disabled", true);
            toast("网页收集功能未开启", true);
        }
        loadLinks();
    });
</script>
</body>
</html>
