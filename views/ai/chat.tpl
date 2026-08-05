<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>AI 问答 - {{.SITE_NAME}}</title>
    <link href="{{cdncss "/static/bootstrap/css/bootstrap.min.css"}}" rel="stylesheet">
    <link href="{{cdncss "/static/font-awesome/css/font-awesome.min.css"}}" rel="stylesheet">
    <link href="{{cdncss "/static/css/main.css" "version"}}" rel="stylesheet">
    {{if .AIEmbedded}}{{else}}
    <link href="{{cdncss "/static/css/mindoc-ui.css" "version"}}" rel="stylesheet">
    {{end}}
    <style>
        :root {
            --ai-paper: #F4F6F7;
            --ai-card: #FFFFFF;
            --ai-ink: #1F2933;
            --ai-ink-2: #52606D;
            --ai-ink-3: #9AA5B1;
            --ai-line: #E4E7EB;
            --ai-accent: #0E7C6B;
            --ai-accent-dark: #0A6154;
            --ai-accent-tint: #E9F4F1;
            --ai-danger: #D64545;
            --ai-top: 50px;
        }
        html, body { height: 100%; }
        body.ai-standalone, body.ai-chat-embedded { overflow: hidden; }

        .ai-page {
            height: 100vh;
            box-sizing: border-box;
            display: flex;
            justify-content: center;
            background: var(--ai-paper);
            padding: calc(var(--ai-top) + 20px) 20px 20px;
        }
        .ai-shell {
            width: 100%;
            max-width: 920px;
            display: flex;
            flex-direction: column;
            background: var(--ai-card);
            border: 1px solid var(--ai-line);
            border-radius: 14px;
            box-shadow: 0 10px 34px rgba(15, 35, 45, .07);
            overflow: hidden;
        }
        body.ai-chat-embedded .ai-page { padding: 0; background: var(--ai-card); }
        body.ai-chat-embedded .ai-shell {
            max-width: none;
            border: 0;
            border-radius: 0;
            box-shadow: none;
        }

        /* ---------- 顶条 ---------- */
        .ai-topbar {
            flex: none;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            padding: 12px 20px;
            border-bottom: 1px solid var(--ai-line);
        }
        body.ai-chat-embedded .ai-topbar { display: none; }
        .ai-brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
        .ai-brand-mark {
            flex: none;
            width: 34px; height: 34px;
            border-radius: 10px;
            background: var(--ai-accent);
            color: #fff;
            font-size: 13px; font-weight: 700; letter-spacing: .5px;
            display: flex; align-items: center; justify-content: center;
        }
        .ai-brand-text { display: flex; flex-direction: column; line-height: 1.3; min-width: 0; }
        .ai-brand-text strong { font-size: 15px; color: var(--ai-ink); font-weight: 600; }
        .ai-brand-text small { font-size: 12px; color: var(--ai-ink-3); }
        .ai-topbar-right { display: flex; align-items: center; gap: 14px; flex: none; }
        .ai-topbar-right .ai-field { display: flex; align-items: center; gap: 8px; margin: 0; font-weight: normal; }
        .ai-topbar-right .ai-field > span { font-size: 12px; color: var(--ai-ink-3); }
        .ai-topbar-right select.form-control {
            height: 32px; padding: 4px 8px; font-size: 13px;
            width: auto; min-width: 168px;
            border-color: var(--ai-line); border-radius: 8px;
            box-shadow: none; color: var(--ai-ink);
        }
        .ai-topbar-right select.form-control:focus { border-color: var(--ai-accent); box-shadow: 0 0 0 3px rgba(14,124,107,.12); }
        /* 模型选择下拉框 */
        .ai-topbar-right #ai-model-select {
            -webkit-appearance: none;
            -moz-appearance: none;
            appearance: none;
            height: 34px;
            padding: 4px 34px 4px 36px;
            font-size: 13px;
            font-weight: 500;
            color: var(--ai-ink);
            background-color: #FBFCFC;
            background-image:
                url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%230E7C6B' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E"),
                url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='15' height='15' viewBox='0 0 24 24' fill='none' stroke='%230E7C6B' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='5' y='5' width='14' height='14' rx='2'/%3E%3Crect x='9.5' y='9.5' width='5' height='5'/%3E%3Cpath d='M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3'/%3E%3C/svg%3E");
            background-repeat: no-repeat, no-repeat;
            background-position: right 11px center, left 11px center;
            background-size: 12px 12px, 15px 15px;
            border: 1px solid var(--ai-line);
            border-radius: 10px;
            box-shadow: 0 1px 2px rgba(15, 35, 45, .04);
            cursor: pointer;
            transition: border-color .15s ease, box-shadow .15s ease, background-color .15s ease;
        }
        .ai-topbar-right #ai-model-select:hover {
            border-color: var(--ai-accent);
            background-color: #fff;
        }
        .ai-topbar-right #ai-model-select:focus {
            border-color: var(--ai-accent);
            background-color: #fff;
            box-shadow: 0 0 0 3px rgba(14,124,107,.14);
        }
        .ai-topbar-right #ai-model-select::-ms-expand { display: none; }

        /* 自定义模型下拉组件（原生 select 隐藏，仅作数据载体） */
        .ai-model-dropdown { position: relative; }
        #ai-model-select.ai-native-hidden {
            position: absolute !important;
            width: 1px !important; height: 1px !important;
            opacity: 0; pointer-events: none;
            padding: 0 !important; border: 0 !important;
        }
        .ai-model-trigger {
            display: inline-flex; align-items: center; gap: 8px;
            height: 34px; min-width: 168px; max-width: 260px;
            padding: 0 11px;
            font-size: 13px; font-weight: 500; color: var(--ai-ink);
            background: #FBFCFC;
            border: 1px solid var(--ai-line);
            border-radius: 10px;
            box-shadow: 0 1px 2px rgba(15,35,45,.04);
            cursor: pointer; user-select: none;
            transition: border-color .15s ease, box-shadow .15s ease, background-color .15s ease;
        }
        .ai-model-trigger:hover { border-color: var(--ai-accent); background: #fff; }
        .ai-model-trigger:focus { outline: none; }
        .ai-model-trigger:focus-visible { border-color: var(--ai-accent); box-shadow: 0 0 0 3px rgba(14,124,107,.14); }
        .ai-model-dropdown.open .ai-model-trigger { border-color: var(--ai-accent); background: #fff; box-shadow: 0 0 0 3px rgba(14,124,107,.14); }
        .ai-model-trigger svg { flex: none; }
        .ai-model-trigger .chip { width: 15px; height: 15px; color: var(--ai-accent); }
        .ai-model-trigger .sel-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left; }
        .ai-model-trigger .chev { width: 12px; height: 12px; color: var(--ai-accent); transition: transform .18s ease; }
        .ai-model-dropdown.open .ai-model-trigger .chev { transform: rotate(180deg); }

        .ai-model-menu {
            position: absolute; top: calc(100% + 6px); right: 0;
            min-width: 100%; width: max-content; max-width: 320px;
            max-height: 264px; overflow-y: auto;
            margin: 0; padding: 6px; list-style: none;
            background: #fff; border: 1px solid var(--ai-line); border-radius: 12px;
            box-shadow: 0 12px 32px rgba(15,35,45,.14), 0 2px 8px rgba(15,35,45,.06);
            z-index: 1050;
            opacity: 0; transform: translateY(-4px) scale(.98); transform-origin: top right;
            pointer-events: none;
            transition: opacity .15s ease, transform .15s ease;
        }
        .ai-model-dropdown.open .ai-model-menu { opacity: 1; transform: none; pointer-events: auto; }
        .ai-model-menu li {
            display: flex; align-items: center; gap: 8px;
            padding: 8px 10px; border-radius: 8px;
            font-size: 13px; color: var(--ai-ink-2);
            cursor: pointer;
            transition: background-color .12s ease, color .12s ease;
        }
        .ai-model-menu li .opt-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ai-model-menu li:hover { background: var(--ai-accent-tint); color: var(--ai-accent-dark); }
        .ai-model-menu li.selected { background: var(--ai-accent-tint); color: var(--ai-accent-dark); font-weight: 500; }
        .ai-model-menu li .check { width: 14px; height: 14px; margin-left: auto; color: var(--ai-accent); visibility: hidden; flex: none; }
        .ai-model-menu li.selected .check { visibility: visible; }
        @media (prefers-reduced-motion: reduce) {
            .ai-model-menu, .ai-model-trigger .chev { transition: none; }
        }
        .ai-check {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            height: 34px;
            margin: 0;
            padding: 0;
            color: var(--ai-ink-2);
            font-family: inherit;
            font-size: 13px;
            font-weight: 400;
            line-height: 1;
            letter-spacing: 0;
            white-space: nowrap;
            cursor: pointer;
        }
        .ai-check input {
            position: static;
            flex: none;
            width: 15px;
            height: 15px;
            margin: 0 !important;
            accent-color: var(--ai-accent);
        }
        .ai-topbar-note { font-size: 12px; color: var(--ai-ink-3); }

        /* ---------- Code Wiki 仓库条 ---------- */
        .ai-codewiki-bar {
            flex: none;
            padding: 10px 20px;
            background: #FBFCFC;
            border-bottom: 1px solid var(--ai-line);
        }
        .ai-codewiki-bar .ai-field { display: flex; align-items: center; gap: 10px; margin: 0; font-weight: normal; }
        .ai-codewiki-bar .ai-field > span { flex: none; font-size: 12px; color: var(--ai-ink-3); }
        .ai-codewiki-bar select.form-control {
            height: 32px; font-size: 13px; border-color: var(--ai-line);
            border-radius: 8px; box-shadow: none; max-width: 460px;
        }
        .ai-codewiki-bar .help-block { margin: 6px 0 0; font-size: 12px; color: var(--ai-ink-3); }

        /* ---------- 消息流 ---------- */
        .ai-stream {
            flex: 1 1 auto;
            overflow-y: auto;
            padding: 24px 20px 12px;
            scroll-behavior: smooth;
        }
        .ai-empty {
            height: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 24px;
        }
        .ai-stream.has-messages .ai-empty { display: none; }
        .ai-empty-mark {
            width: 52px; height: 52px;
            border-radius: 16px;
            background: var(--ai-accent-tint);
            color: var(--ai-accent);
            font-size: 16px; font-weight: 700; letter-spacing: .5px;
            display: flex; align-items: center; justify-content: center;
            margin-bottom: 18px;
        }
        .ai-empty h1 { margin: 0 0 8px; font-size: 22px; font-weight: 600; color: var(--ai-ink); }
        .ai-empty p { margin: 0 0 22px; font-size: 13px; color: var(--ai-ink-2); max-width: 420px; }
        .ai-suggest { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; max-width: 560px; }
        .ai-suggest button {
            border: 1px solid var(--ai-line);
            background: var(--ai-card);
            color: var(--ai-ink-2);
            font-size: 13px;
            padding: 7px 14px;
            border-radius: 999px;
            transition: border-color .15s, color .15s, background .15s;
        }
        .ai-suggest button:hover { border-color: var(--ai-accent); color: var(--ai-accent-dark); background: var(--ai-accent-tint); }
        .ai-suggest button:focus { outline: 2px solid rgba(14,124,107,.35); outline-offset: 1px; }

        .ai-msg { margin-bottom: 20px; }
        .ai-msg-user { display: flex; justify-content: flex-end; }
        .ai-msg-bubble {
            max-width: 78%;
            background: var(--ai-accent);
            color: #fff;
            padding: 10px 15px;
            border-radius: 14px 14px 4px 14px;
            font-size: 14px;
            line-height: 1.65;
            white-space: pre-wrap;
            word-break: break-word;
        }
        .ai-msg-doc {
            border-left: 2px solid var(--ai-accent);
            padding: 2px 0 2px 16px;
        }
        .ai-msg-body { font-size: 14px; color: var(--ai-ink); line-height: 1.8; word-break: break-word; }
        .ai-msg-body p:last-child, .ai-msg-body ul:last-child,
        .ai-msg-body ol:last-child, .ai-msg-body pre:last-child { margin-bottom: 0; }
        .ai-msg-body pre {
            padding: 12px 14px;
            background: #F6F8F8;
            border: 1px solid var(--ai-line);
            border-radius: 8px;
            overflow: auto;
            font-size: 13px;
        }
        .ai-msg-body code { color: #B4365B; background: #FAF0F3; border-radius: 4px; padding: 1px 5px; }
        .ai-msg-body pre code { color: inherit; background: transparent; padding: 0; }
        .ai-msg-body blockquote {
            border-left: 3px solid var(--ai-accent);
            color: var(--ai-ink-2);
            margin: 0 0 10px;
            padding: 6px 14px;
            background: #FAFCFC;
        }
        .ai-msg-body table { width: 100%; margin-bottom: 12px; border-collapse: collapse; font-size: 13px; }
        .ai-msg-body th, .ai-msg-body td { border: 1px solid var(--ai-line); padding: 6px 10px; }
        .ai-msg-body th { background: #F6F8F8; }
        .ai-msg-body a { color: var(--ai-accent-dark); }
        .ai-msg-meta {
            margin-top: 10px;
            font-family: Consolas, "SF Mono", Monaco, monospace;
            font-size: 11px;
            color: var(--ai-ink-3);
            word-break: break-all;
        }

        /* 来源引用 */
        .ai-msg-sources { margin-top: 12px; }
        .ai-sources-label {
            font-size: 11px;
            letter-spacing: 1px;
            color: var(--ai-ink-3);
            margin-bottom: 8px;
            text-transform: uppercase;
        }
        .ai-source-list { display: flex; flex-wrap: wrap; gap: 6px; list-style: none; margin: 0; padding: 0; }
        .ai-source {
            position: relative;
            display: inline-flex;
            align-items: center;
            gap: 7px;
            max-width: 100%;
            border: 1px solid var(--ai-line);
            border-radius: 999px;
            padding: 4px 12px 4px 5px;
            font-size: 12px;
            color: var(--ai-ink-2);
            background: var(--ai-card);
            cursor: pointer;
            text-decoration: none;
            transition: border-color .15s, background .15s;
        }
        .ai-source:hover { border-color: var(--ai-accent); background: var(--ai-accent-tint); color: var(--ai-accent-dark); text-decoration: none; }
        .ai-source:focus { outline: 2px solid rgba(14,124,107,.35); outline-offset: 1px; }
        .ai-source-no {
            flex: none;
            width: 18px; height: 18px;
            border-radius: 50%;
            background: var(--ai-accent);
            color: #fff;
            font-size: 11px;
            display: inline-flex; align-items: center; justify-content: center;
        }
        .ai-source-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 300px; }
        .ai-source-static { cursor: default; }
        .ai-source-static:hover { border-color: var(--ai-line); background: var(--ai-card); color: var(--ai-ink-2); }
        .ai-source-pop {
            display: none;
            position: absolute;
            left: 0; bottom: calc(100% + 8px);
            z-index: 60;
            width: 320px;
            padding: 12px 14px;
            background: var(--ai-card);
            border: 1px solid var(--ai-line);
            border-radius: 10px;
            box-shadow: 0 12px 32px rgba(15, 35, 45, .14);
            cursor: default;
            white-space: normal;
        }
        .ai-source:hover .ai-source-pop { display: block; }
        .ai-source-pop-title { display: block; font-size: 12px; font-weight: 600; color: var(--ai-ink); margin-bottom: 6px; }
        .ai-source-pop-snippet {
            display: -webkit-box;
            -webkit-line-clamp: 5;
            -webkit-box-orient: vertical;
            overflow: hidden;
            font-size: 12px;
            line-height: 1.7;
            color: var(--ai-ink-2);
        }
        .ai-source-pop-link { display: block; margin-top: 8px; font-size: 12px; color: var(--ai-accent-dark); }
        .ai-sources-empty { font-size: 12px; color: var(--ai-ink-3); margin: 0; }

        /* 思考中 */
        .ai-thinking { display: flex; align-items: center; gap: 10px; padding: 4px 0; }
        .ai-thinking-dots { display: inline-flex; gap: 4px; }
        .ai-thinking-dots span {
            width: 6px; height: 6px; border-radius: 50%;
            background: var(--ai-accent);
            animation: ai-bounce 1.2s infinite ease-in-out;
        }
        .ai-thinking-dots span:nth-child(2) { animation-delay: .15s; }
        .ai-thinking-dots span:nth-child(3) { animation-delay: .3s; }
        @keyframes ai-bounce {
            0%, 60%, 100% { transform: translateY(0); opacity: .35; }
            30% { transform: translateY(-4px); opacity: 1; }
        }
        .ai-thinking-text { font-size: 12px; color: var(--ai-ink-3); }

        .ai-msg-error-card {
            display: flex; align-items: flex-start; gap: 8px;
            border: 1px solid #F0D5D5;
            background: #FBF3F3;
            color: var(--ai-danger);
            border-radius: 10px;
            padding: 10px 14px;
            font-size: 13px;
        }
        .ai-msg-error-card i { margin-top: 2px; }

        /* ---------- 输入区 ---------- */
        .ai-composer {
            flex: none;
            border-top: 1px solid var(--ai-line);
            padding: 12px 20px 14px;
            background: var(--ai-card);
        }
        #ai-error { display: block; font-size: 12px; margin-bottom: 8px; }
        #ai-error:empty { display: none; }
        .ai-input-box {
            border: 1px solid var(--ai-line);
            border-radius: 14px;
            background: var(--ai-card);
            transition: border-color .15s, box-shadow .15s;
        }
        .ai-input-box:focus-within {
            border-color: var(--ai-accent);
            box-shadow: 0 0 0 3px rgba(14, 124, 107, .12);
        }
        .ai-input-box textarea {
            display: block;
            width: 100%;
            border: 0;
            outline: none;
            resize: none;
            box-shadow: none;
            padding: 12px 14px 4px;
            font-size: 14px;
            line-height: 1.6;
            color: var(--ai-ink);
            background: transparent;
            max-height: 168px;
            font-family: inherit;
        }
        body.ai-standalone .ai-input-box #question:focus,
        body.ai-standalone .ai-input-box #question:focus-visible {
            outline: none !important;
            box-shadow: none !important;
        }
        .ai-input-toolbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            padding: 6px 8px 8px;
        }
        .ai-scope { position: relative; min-width: 0; }
        .ai-scope-chip {
            display: inline-flex;
            align-items: center;
            gap: 7px;
            max-width: 100%;
            border: 1px solid var(--ai-line);
            background: var(--ai-card);
            color: var(--ai-ink-2);
            font-size: 12px;
            padding: 5px 12px;
            border-radius: 999px;
            transition: border-color .15s, color .15s;
        }
        .ai-scope-chip:hover { border-color: var(--ai-accent); color: var(--ai-accent-dark); }
        .ai-scope-chip:focus { outline: 2px solid rgba(14,124,107,.35); outline-offset: 1px; }
        .ai-scope-chip .fa-book { color: var(--ai-ink-3); }
        .ai-scope-chip .fa-chevron-down { font-size: 10px; color: var(--ai-ink-3); }
        .ai-scope-chip span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 260px; }
        .ai-book-picker.open .ai-scope-chip { border-color: var(--ai-accent); color: var(--ai-accent-dark); }

        .ai-book-menu {
            display: none;
            position: absolute;
            z-index: 1000;
            bottom: calc(100% + 8px);
            left: 0;
            width: 300px;
            max-height: 280px;
            overflow: auto;
            background: var(--ai-card);
            border: 1px solid var(--ai-line);
            border-radius: 12px;
            box-shadow: 0 14px 36px rgba(15, 35, 45, .16);
            padding: 8px 0;
        }
        .ai-book-picker.open .ai-book-menu { display: block; }
        .ai-book-search { padding: 2px 12px 8px; }
        .ai-book-search input {
            height: 30px; font-size: 13px;
            border-color: var(--ai-line); border-radius: 8px; box-shadow: none;
        }
        .ai-book-search input:focus { border-color: var(--ai-accent); }
        .ai-book-option {
            display: flex;
            align-items: center;
            gap: 8px;
            margin: 0;
            padding: 7px 14px;
            cursor: pointer;
            font-weight: normal;
            font-size: 13px;
            color: var(--ai-ink-2);
        }
        .ai-book-option:hover { background: #F4F7F7; }
        .ai-book-option input { margin: 0; accent-color: var(--ai-accent); }
        .ai-book-option span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ai-book-divider { margin: 6px 0; border-top: 1px solid var(--ai-line); }
        .ai-book-empty { padding: 7px 14px; font-size: 12px; color: var(--ai-ink-3); }

        .ai-send {
            flex: none;
            width: 34px; height: 34px;
            border: 0;
            border-radius: 50%;
            background: #DDE3E6;
            color: #fff;
            font-size: 14px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            transition: background .15s, transform .1s;
        }
        .ai-send:not(:disabled) { background: var(--ai-accent); }
        .ai-send:not(:disabled):hover { background: var(--ai-accent-dark); }
        .ai-send:not(:disabled):active { transform: scale(.94); }
        .ai-send:focus { outline: 2px solid rgba(14,124,107,.35); outline-offset: 1px; }
        .ai-composer-hint {
            margin-top: 8px;
            font-size: 11px;
            color: var(--ai-ink-3);
            text-align: center;
        }

        @media (max-width: 640px) {
            .ai-page { padding: var(--ai-top) 0 0; }
            .ai-shell { border: 0; border-radius: 0; max-width: none; }
            .ai-topbar { flex-wrap: wrap; gap: 8px; }
            .ai-brand-text small { display: none; }
            .ai-msg-bubble { max-width: 88%; }
            .ai-source-name { max-width: 200px; }
            .ai-source-pop { width: 260px; }
        }
        @media (prefers-reduced-motion: reduce) {
            .ai-thinking-dots span { animation: none; opacity: .6; }
            .ai-stream { scroll-behavior: auto; }
        }
    </style>
</head>
<body{{if .AIEmbedded}} class="ai-chat-embedded"{{else}} class="ai-standalone"{{end}}>
{{if .AIEmbedded}}{{else}}
{{template "widgets/header.tpl" .}}
{{end}}
<div class="ai-page">
    <div class="ai-shell">
        <div class="ai-topbar" id="ai-status">
            <div class="ai-brand">
                <span class="ai-brand-mark">AI</span>
                <span class="ai-brand-text">
                    <strong>MinDoc 智能问答</strong>
                    <small>基于知识库的检索增强回答，来源可追溯</small>
                </span>
            </div>
            <div class="ai-topbar-right">
                {{if .AIEnabled}}
                <label class="ai-field">
                    <span>模型</span>
                    <select id="ai-model-select" class="form-control input-sm">
                        {{range .AIModelOptions}}
                        <option value="{{.}}" {{if eq . $.AIModel}}selected{{end}}>{{.}}</option>
                        {{end}}
                    </select>
                </label>
                <label class="ai-check" title="开启后将同时使用向量语义检索">
                    <input type="checkbox" id="ai-embedding-enabled" name="embedding_enabled" value="1" {{if .AIEmbeddingEnabled}}checked{{end}}>
                    向量检索
                </label>
                {{else}}
                <span class="ai-topbar-note">未开启 AI 模型，当前为检索摘要模式</span>
                {{end}}
            </div>
        </div>

        <div class="ai-codewiki-bar" id="code-wiki-repo-group" style="display:none;">
            <label class="ai-field">
                <span>Code Wiki 仓库</span>
                <select id="code_wiki_repo_select" class="form-control input-sm"></select>
            </label>
            <input type="hidden" id="code_wiki_repo_url" name="code_wiki_repo_url" value="{{.AICodeWikiRepoURL}}">
            <input type="hidden" id="code_wiki_cnb_url" name="code_wiki_cnb_url">
            <input type="hidden" id="code_wiki_cnb_username" name="code_wiki_cnb_username">
            <input type="hidden" id="code_wiki_cnb_token" name="code_wiki_cnb_token">
            <p class="help-block">选择 code wiki 模型时，请选择代码知识库；点击“更多...”可新增 CNB 仓库信息。</p>
        </div>

        <div class="ai-stream" id="ai-stream">
            <div class="ai-empty" id="ai-empty">
                <div class="ai-empty-mark">AI</div>
                <h1>有什么想了解的？</h1>
                <p>向 MinDoc 知识库提问，系统会检索相关文档分片并生成答案，每条结论均可追溯到来源文档。</p>
                <div class="ai-suggest">
                    <button type="button" data-question="会计日过期如何处理？">会计日过期如何处理？</button>
                    <button type="button" data-question="序号重复如何处理？">序号重复如何处理？</button>
                    <button type="button" data-question="联机交易报文由什么组成？">联机交易报文由什么组成？</button>
                </div>
            </div>
        </div>

        <div class="ai-composer">
            <span id="ai-error" class="text-danger"></span>
            <form id="ai-chat-form">
                <div class="ai-input-box">
                    <textarea id="question" name="question" rows="1" placeholder="{{.AIQuestionPlaceholder}}"></textarea>
                    <div class="ai-input-toolbar">
                        <div class="ai-scope">
                            <div class="ai-book-picker" id="ai-book-picker">
                                <button type="button" class="ai-scope-chip" id="ai-book-toggle" title="选择检索的项目范围">
                                    <i class="fa fa-book"></i>
                                    <span id="ai-book-summary">全部可访问项目</span>
                                    <i class="fa fa-chevron-down"></i>
                                </button>
                                <div class="ai-book-menu" id="ai-book-menu">
                                    <div class="ai-book-search">
                                        <input type="text" class="form-control input-sm" id="ai-book-search" placeholder="输入项目名搜索...">
                                    </div>
                                    <label class="ai-book-option ai-book-all">
                                        <input type="checkbox" id="ai-book-all">
                                        <span>全部可访问项目</span>
                                    </label>
                                    <div class="ai-book-divider"></div>
                                    <div id="ai-book-options"></div>
                                    <div id="ai-book-no-match" class="ai-book-empty" style="display:none;">没有匹配项目</div>
                                </div>
                            </div>
                            <select id="book_ids" name="book_ids" multiple style="display:none;">
                                {{range .AIBookOptions}}
                                <option value="{{.BookId}}">{{.BookName}}</option>
                                {{end}}
                            </select>
                        </div>
                        <button type="submit" class="ai-send" id="ai-send-btn" disabled title="发送问题">
                            <i class="fa fa-arrow-up"></i>
                        </button>
                    </div>
                </div>
                <div class="ai-composer-hint">Enter 发送 · Shift + Enter 换行 · AI 回答仅供参考，请以来源文档为准</div>
            </form>
        </div>
    </div>
</div>

<div class="modal fade" id="code-wiki-repo-more-modal" tabindex="-1" role="dialog" aria-labelledby="code-wiki-repo-more-title">
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
                <h4 class="modal-title" id="code-wiki-repo-more-title">新增 Code Wiki 仓库</h4>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label for="code-wiki-cnb-url-input">CNB URL</label>
                    <input type="text" class="form-control" id="code-wiki-cnb-url-input" placeholder="https://...">
                </div>
                <div class="form-group">
                    <label for="code-wiki-cnb-username-input">CNB USERNAME</label>
                    <input type="text" class="form-control" id="code-wiki-cnb-username-input">
                </div>
                <div class="form-group">
                    <label for="code-wiki-cnb-token-input">CNB TOKEN</label>
                    <input type="password" class="form-control" id="code-wiki-cnb-token-input">
                </div>
                <div class="text-danger" id="code-wiki-repo-more-error"></div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-default" data-dismiss="modal">取消</button>
                <button type="button" class="btn btn-primary" id="code-wiki-repo-more-save">确定</button>
            </div>
        </div>
    </div>
</div>

<script src="{{cdnjs "/static/jquery/1.12.4/jquery.min.js"}}" type="text/javascript"></script>
<script src="{{cdnjs "/static/bootstrap/js/bootstrap.min.js"}}" type="text/javascript"></script>
<script src="{{cdnjs "/static/editor.md/lib/marked.min.js"}}" type="text/javascript"></script>
<script>
$(function () {
    var askUrl = "{{urlfor "AiController.Ask"}}";
    var codeWikiReposUrl = "{{urlfor "AiController.CodeWikiRepos"}}";
    var codeWikiRepoAddUrl = "{{urlfor "AiController.AddCodeWikiRepo"}}";
    var isEmbedded = $("body").hasClass("ai-chat-embedded");
    var $form = $("#ai-chat-form");
    var $question = $("#question");
    var $send = $("#ai-send-btn");
    var $stream = $("#ai-stream");
    var $modelSelect = $("#ai-model-select");
    var $embeddingEnabled = $("#ai-embedding-enabled");
    var $codeWikiRepoGroup = $("#code-wiki-repo-group");
    var $codeWikiRepoSelect = $("#code_wiki_repo_select");
    var $codeWikiRepoInput = $("#code_wiki_repo_url");
    var $codeWikiCNBURL = $("#code_wiki_cnb_url");
    var $codeWikiCNBUsername = $("#code_wiki_cnb_username");
    var $codeWikiCNBToken = $("#code_wiki_cnb_token");
    var codeWikiReposLoaded = false;
    var $bookIds = $("#book_ids");
    var $bookPicker = $("#ai-book-picker");
    var $bookToggle = $("#ai-book-toggle");
    var $bookSummary = $("#ai-book-summary");
    var $bookMenu = $("#ai-book-menu");
    var $bookSearch = $("#ai-book-search");
    var $bookOptions = $("#ai-book-options");
    var $bookAll = $("#ai-book-all");
    var $bookNoMatch = $("#ai-book-no-match");
    var $error = $("#ai-error");
    var sending = false;

    /* ---------- 自定义模型下拉组件 ---------- */
    (function initModelDropdown() {
        if (!$modelSelect.length) { return; }
        var svgChip = '<svg class="chip" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9.5" y="9.5" width="5" height="5"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/></svg>';
        var svgChev = '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
        var svgCheck = '<svg class="check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

        var $wrap = $('<div class="ai-model-dropdown"></div>');
        $modelSelect.after($wrap);
        $wrap.append($modelSelect);
        $modelSelect.addClass("ai-native-hidden");

        var $trigger = $('<button type="button" class="ai-model-trigger" aria-haspopup="listbox" aria-expanded="false">' + svgChip + '<span class="sel-label"></span>' + svgChev + '</button>');
        var $menu = $('<ul class="ai-model-menu" role="listbox" tabindex="-1"></ul>');
        $wrap.append($trigger).append($menu);

        function syncUI() {
            var current = $modelSelect.val();
            $trigger.find(".sel-label").text($modelSelect.find("option:selected").text());
            $menu.find("li").each(function () {
                var matched = $(this).attr("data-value") === current;
                $(this).toggleClass("selected", matched).attr("aria-selected", matched ? "true" : "false");
            });
        }

        $modelSelect.find("option").each(function () {
            var $li = $('<li role="option" tabindex="-1"><span class="opt-text"></span>' + svgCheck + '</li>');
            $li.attr("data-value", $(this).val());
            $li.find(".opt-text").text($(this).text());
            $menu.append($li);
        });
        syncUI();

        function closeMenu() { $wrap.removeClass("open"); $trigger.attr("aria-expanded", "false"); }
        function openMenu() { $wrap.addClass("open"); $trigger.attr("aria-expanded", "true"); }

        $trigger.on("click", function (e) {
            e.stopPropagation();
            if ($wrap.hasClass("open")) { closeMenu(); } else { openMenu(); }
        });
        $menu.on("click", "li", function () {
            $modelSelect.val($(this).attr("data-value")).trigger("change");
            syncUI();
            closeMenu();
        });
        $modelSelect.on("change", syncUI);
        $(document).on("click", function (e) {
            if (!$wrap.is(e.target) && $wrap.has(e.target).length === 0) { closeMenu(); }
        });
        $(document).on("keydown", function (e) {
            if (e.key === "Escape") { closeMenu(); }
        });
    })();

    /* ---------- 布局 ---------- */
    function syncTopOffset() {
        if (isEmbedded) {
            return;
        }
        var header = document.querySelector(".manual-header");
        var height = header ? header.offsetHeight : 0;
        document.documentElement.style.setProperty("--ai-top", height + "px");
    }
    $(window).on("resize", syncTopOffset);
    syncTopOffset();

    function scrollStream() {
        var el = $stream[0];
        if (el) {
            el.scrollTop = el.scrollHeight;
        }
    }

    function notifyArticleAIParent() {
        if (window.parent && window.parent !== window && typeof window.parent.syncArticleAIModelSelector === "function") {
            window.parent.syncArticleAIModelSelector();
        }
    }

    function renderMarkdown(text) {
        var source = text || "";
        if (window.marked) {
            if (typeof window.marked.setOptions === "function") {
                window.marked.setOptions({
                    sanitize: true,
                    smartLists: true,
                    breaks: true
                });
            }
            if (typeof window.marked === "function") {
                return window.marked(source);
            }
            if (typeof window.marked.parse === "function") {
                return window.marked.parse(source, {
                    sanitize: true,
                    smartLists: true,
                    breaks: true
                });
            }
        }
        return $("<div>").text(source).html().replace(/\n/g, "<br>");
    }

    /* ---------- 输入区 ---------- */
    function autosizeQuestion() {
        var el = $question[0];
        el.style.height = "auto";
        el.style.height = Math.min(el.scrollHeight, 168) + "px";
        if (!sending) {
            $send.prop("disabled", $.trim($question.val()).length === 0);
        }
    }
    $question.on("input", autosizeQuestion);
    $question.on("keydown", function (event) {
        if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
            event.preventDefault();
            if (!sending && $.trim($question.val()).length > 0) {
                $form.trigger("submit");
            }
        }
    });
    $(".ai-suggest button").on("click", function () {
        $question.val($(this).attr("data-question") || $(this).text());
        autosizeQuestion();
        $question.focus();
    });

    /* ---------- 消息渲染 ---------- */
    function appendUserMessage(text) {
        var $msg = $("<div>").addClass("ai-msg ai-msg-user");
        $msg.append($("<div>").addClass("ai-msg-bubble").text(text));
        $stream.append($msg);
    }

    function appendThinkingMessage() {
        var $msg = $("<div>").addClass("ai-msg ai-msg-assistant");
        var $doc = $("<div>").addClass("ai-msg-doc");
        var $thinking = $("<div>").addClass("ai-thinking");
        var $dots = $("<div>").addClass("ai-thinking-dots");
        $dots.append("<span></span><span></span><span></span>");
        $thinking.append($dots);
        $thinking.append($("<span>").addClass("ai-thinking-text").text(
            $embeddingEnabled.is(":checked") ? "正在进行向量检索并生成答案..." : "正在检索知识分片并生成答案..."
        ));
        $doc.append($thinking);
        $msg.append($doc);
        $stream.append($msg);
        return $msg;
    }

    function buildSourceItem(item, index) {
        var title = (item.book_name || "未知项目") + " · " + (item.title || "未命名文档");
        var hasUrl = !!item.source_url;
        var $chip = hasUrl
            ? $("<a>").attr({ href: item.source_url, target: "_blank", rel: "noopener" })
            : $("<span>").addClass("ai-source-static");
        $chip.addClass("ai-source").attr("title", title);
        $chip.append($("<span>").addClass("ai-source-no").text(index + 1));
        $chip.append($("<span>").addClass("ai-source-name").text(title));

        var $pop = $("<span>").addClass("ai-source-pop");
        $pop.append($("<span>").addClass("ai-source-pop-title").text(title));
        $pop.append($("<span>").addClass("ai-source-pop-snippet").text(item.snippet || "暂无片段预览。"));
        if (hasUrl) {
            $pop.append($("<span>").addClass("ai-source-pop-link").text("查看原文档 →"));
        }
        $chip.append($pop);
        return $("<li>").append($chip);
    }

    function renderAssistantMessage($msg, res) {
        var $doc = $("<div>").addClass("ai-msg-doc");
        $doc.append($("<div>").addClass("ai-msg-body").html(renderMarkdown(res.data.answer || "")));

        var timing = res.data.timing || {};
        var embedding = res.data.embedding || {};
        var retrieveMs = timing.retrieve_ms !== undefined ? timing.retrieve_ms : "-";
        var embeddingMs = timing.embedding_ms !== undefined ? timing.embedding_ms : "-";
        var llmMs = timing.llm_ms !== undefined ? timing.llm_ms : "-";
        var totalMs = timing.total_ms !== undefined ? timing.total_ms : "-";
        var vectorText = "Vector: disabled";
        if (embedding.enabled) {
            vectorText = "Vector: enabled"
                + ", model " + (embedding.model || "-")
                + ", query " + (embedding.query_called ? "yes" : "no")
                + ", candidates " + (embedding.candidates || 0)
                + ", stored " + (embedding.stored || 0)
                + ", backfilled " + (embedding.backfilled || 0)
                + ", matched " + (embedding.matched || 0);
            if (embedding.error) {
                vectorText += ", error: " + embedding.error;
            }
        }
        $doc.append($("<div>").addClass("ai-msg-meta").text(
            "Timing: retrieval " + retrieveMs + " ms, embedding " + embeddingMs + " ms, model " + llmMs + " ms, total " + totalMs + " ms | " + vectorText
        ));

        var $sourcesWrap = $("<div>").addClass("ai-msg-sources");
        if (res.data.sources && res.data.sources.length) {
            $sourcesWrap.append($("<div>").addClass("ai-sources-label").text("参考来源 · " + res.data.sources.length));
            var $list = $("<ul>").addClass("ai-source-list");
            $.each(res.data.sources, function (index, item) {
                $list.append(buildSourceItem(item, index));
            });
            $sourcesWrap.append($list);
        } else {
            $sourcesWrap.append($("<p>").addClass("ai-sources-empty").text("未检索到可追溯来源。"));
        }
        $doc.append($sourcesWrap);
        $msg.empty().append($doc);
    }

    function renderErrorMessage($msg, text) {
        var $card = $("<div>").addClass("ai-msg-error-card");
        $card.append($("<i>").addClass("fa fa-exclamation-circle"));
        $card.append($("<span>").text(text));
        $msg.empty().append($card);
    }

    function setSending(on) {
        sending = on;
        $send.prop("disabled", on || $.trim($question.val()).length === 0);
        $send.find("i").attr("class", on ? "fa fa-circle-o-notch fa-spin" : "fa fa-arrow-up");
    }

    /* ---------- 项目范围选择 ---------- */
    function normalizeBookKeyword(text) {
        return $.trim((text || "").toLowerCase());
    }

    function filterBookOptions() {
        var keyword = normalizeBookKeyword($bookSearch.val());
        var visibleCount = 0;
        $bookOptions.find(".ai-book-option").each(function () {
            var $option = $(this);
            var bookName = normalizeBookKeyword($option.attr("data-book-name") || $option.text());
            var matched = keyword.length === 0 || bookName.indexOf(keyword) !== -1;
            $option.toggle(matched);
            if (matched) {
                visibleCount++;
            }
        });
        $bookNoMatch.toggle(visibleCount === 0 && $bookOptions.find(".ai-book-option").length > 0);
    }

    function updateBookSummary() {
        var selected = $bookIds.find("option:selected");
        $bookAll.prop("checked", selected.length === 0);
        $bookOptions.find("input[type='checkbox']").each(function () {
            var $checkbox = $(this);
            var value = $checkbox.val();
            $checkbox.prop("checked", $bookIds.find("option[value='" + value + "']").prop("selected"));
        });
        if (selected.length === 0) {
            $bookSummary.text("全部可访问项目");
            return;
        }
        if (selected.length <= 2) {
            var labels = selected.map(function () {
                return $(this).text();
            }).get();
            $bookSummary.text(labels.join("、"));
            return;
        }
        $bookSummary.text("已选择 " + selected.length + " 个项目");
    }

    function getAIChatQueryValue(name) {
        var search = window.location.search || "";
        if (search.charAt(0) === "?") {
            search = search.substring(1);
        }
        var parts = search.split("&");
        for (var i = 0; i < parts.length; i++) {
            var pair = parts[i].split("=");
            if (decodeURIComponent(pair[0] || "") === name) {
                return decodeURIComponent((pair[1] || "").replace(/\+/g, " "));
            }
        }
        return "";
    }

    function applyInitialBookScope() {
        var bookId = getAIChatQueryValue("book_id");
        if (!bookId) {
            return;
        }
        $bookIds.find("option").filter(function () {
            return $(this).val() === bookId;
        }).prop("selected", true);
    }

    function buildBookPicker() {
        var options = $bookIds.find("option");
        $bookOptions.empty();
        if (options.length === 0) {
            $bookOptions.append($("<div>").addClass("ai-book-empty").text("暂无可选项目"));
            $bookAll.prop("disabled", true);
            updateBookSummary();
            return;
        }
        options.each(function (index) {
            var $option = $(this);
            var checkboxId = "ai-book-option-" + index;
            var $checkbox = $("<input>").attr({
                type: "checkbox",
                id: checkboxId,
                value: $option.val()
            });
            var $label = $("<label>").addClass("ai-book-option").attr("for", checkboxId);
            $checkbox.on("change", function () {
                $option.prop("selected", this.checked);
                updateBookSummary();
            });
            $label.attr("data-book-name", $option.text());
            $label.append($checkbox).append($("<span>").text($option.text()));
            $bookOptions.append($label);
        });
        updateBookSummary();
        filterBookOptions();
    }

    $bookToggle.on("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        $bookPicker.toggleClass("open");
    });

    $bookMenu.on("click", function (event) {
        event.stopPropagation();
    });

    $bookSearch.on("keyup change input", function () {
        filterBookOptions();
    });

    $bookAll.on("change", function () {
        if (this.checked) {
            $bookIds.find("option").prop("selected", false);
        }
        updateBookSummary();
    });

    $(document).on("click", function () {
        $bookPicker.removeClass("open");
    });

    /* ---------- Code Wiki 仓库 ---------- */
    function isCodeWikiModelSelected() {
        return $.trim(($modelSelect.val() || "").toLowerCase()) === "code wiki";
    }

    function updateCodeWikiRepoField() {
        $codeWikiRepoGroup.toggle(isCodeWikiModelSelected());
        if ($embeddingEnabled.length) {
            $embeddingEnabled.prop("disabled", isCodeWikiModelSelected());
        }
        if (isCodeWikiModelSelected()) {
            loadCodeWikiRepos();
        }
    }
    window.updateAIChatCodeWikiRepoField = updateCodeWikiRepoField;
    function appendCodeWikiRepoOption(label, value, selected) {
        if (!value) {
            return;
        }
        var exists = false;
        $codeWikiRepoSelect.find("option").each(function () {
            if ($(this).val() === value) {
                exists = true;
                if (selected) {
                    $(this).prop("selected", true);
                }
                return false;
            }
        });
        if (!exists) {
            $codeWikiRepoSelect.append($("<option>").attr("value", value).text(label || value).prop("selected", !!selected));
        }
    }
    function appendCodeWikiMoreOption() {
        $codeWikiRepoSelect.find("option[value='__more__']").remove();
        $codeWikiRepoSelect.append($("<option>").attr("value", "__more__").text("更多..."));
    }
    function syncCodeWikiRepoHidden() {
        var value = $codeWikiRepoSelect.val() || "";
        if (value && value !== "__more__") {
            $codeWikiRepoInput.val(value);
        }
    }
    function renderCodeWikiRepos(repos) {
        var current = $codeWikiRepoInput.val() || "";
        $codeWikiRepoSelect.empty();
        if (current) {
            appendCodeWikiRepoOption(current, current, true);
        }
        $.each(repos || [], function (_, item) {
            if (typeof item === "string") {
                appendCodeWikiRepoOption(item, item, !current);
                if (!current) {
                    current = item;
                }
            } else if (item && item.value) {
                appendCodeWikiRepoOption(item.label || item.value, item.value, !current);
                if (!current) {
                    current = item.value;
                }
            }
        });
        if (!current && !$codeWikiRepoSelect.find("option").length) {
            $codeWikiRepoSelect.append($("<option>").attr("value", "").text("请选择仓库").prop("selected", true));
        }
        appendCodeWikiMoreOption();
        if (!current && $codeWikiRepoSelect.find("option").not("[value='__more__']").length) {
            current = $codeWikiRepoSelect.find("option").not("[value='__more__']").first().val();
        }
        if (current) {
            $codeWikiRepoSelect.val(current);
            $codeWikiRepoInput.val(current);
        }
        notifyArticleAIParent();
    }
    function loadCodeWikiRepos() {
        if (codeWikiReposLoaded) {
            return;
        }
        codeWikiReposLoaded = true;
        renderCodeWikiRepos([]);
        $.ajax({
            type: "GET",
            url: codeWikiReposUrl
        }).done(function (res) {
            if (res && res.errcode === 0) {
                renderCodeWikiRepos((res.data && res.data.repos) || []);
                if (res.data && res.data.error) {
                    $error.text("Code Wiki 仓库列表加载失败：" + res.data.error);
                }
            } else {
                $error.text(res && res.message ? res.message : "Code Wiki 仓库列表加载失败");
            }
        }).fail(function () {
            $error.text("Code Wiki 仓库列表加载失败");
        });
    }
    $codeWikiRepoSelect.on("change", function () {
        if ($(this).val() === "__more__") {
            var previousRepoURL = $codeWikiRepoInput.val() || "";
            $codeWikiRepoSelect.val(previousRepoURL);
            $("#code-wiki-repo-more-error").text("");
            $("#code-wiki-cnb-url-input").val("");
            $("#code-wiki-cnb-username-input").val("");
            $("#code-wiki-cnb-token-input").val("");
            $("#code-wiki-repo-more-modal").modal("show");
            return;
        }
        $codeWikiCNBURL.val("");
        $codeWikiCNBUsername.val("");
        $codeWikiCNBToken.val("");
        syncCodeWikiRepoHidden();
        notifyArticleAIParent();
    });
    $("#code-wiki-repo-more-save").on("click", function () {
        var cnbURL = $.trim($("#code-wiki-cnb-url-input").val());
        var cnbUsername = $.trim($("#code-wiki-cnb-username-input").val());
        var cnbToken = $.trim($("#code-wiki-cnb-token-input").val());
        if (!cnbURL) {
            $("#code-wiki-repo-more-error").text("请输入 CNB URL");
            return;
        }
        $("#code-wiki-repo-more-error").text("");
        var $saveButton = $(this);
        $saveButton.prop("disabled", true).text("保存中...");
        $.ajax({
            type: "POST",
            url: codeWikiRepoAddUrl,
            data: {
                cnb_url: cnbURL,
                cnb_username: cnbUsername,
                cnb_token: cnbToken
            }
        }).done(function (res) {
            if (!res || res.errcode !== 0) {
                $("#code-wiki-repo-more-error").text(res && res.message ? res.message : "新增仓库失败");
                return;
            }
            var repo = (res.data && res.data.repo) || {};
            var repoValue = repo.value || cnbURL;
            var repoLabel = repo.label || repoValue;
            appendCodeWikiRepoOption(repoLabel, repoValue, true);
            appendCodeWikiMoreOption();
            $codeWikiRepoSelect.val(repoValue);
            $codeWikiRepoInput.val(repoValue);
            $codeWikiCNBURL.val(cnbURL);
            $codeWikiCNBUsername.val(cnbUsername);
            $codeWikiCNBToken.val(cnbToken);
            codeWikiReposLoaded = false;
            notifyArticleAIParent();
            $("#code-wiki-repo-more-modal").modal("hide");
        }).fail(function (xhr) {
            $("#code-wiki-repo-more-error").text("新增仓库失败：" + (xhr && xhr.responseJSON && xhr.responseJSON.message ? xhr.responseJSON.message : "网络异常"));
        }).always(function () {
            $saveButton.prop("disabled", false).text("确定");
        });
    });

    applyInitialBookScope();
    updateCodeWikiRepoField();
    $modelSelect.on("change", updateCodeWikiRepoField);
    buildBookPicker();

    /* ---------- 提交问答 ---------- */
    $form.on("submit", function (event) {
        event.preventDefault();
        if (sending) {
            return;
        }
        var question = $.trim($question.val());
        if (question.length === 0) {
            $error.text("请输入问题内容");
            return;
        }
        $error.text("");
        $stream.addClass("has-messages");
        appendUserMessage(question);
        var $pending = appendThinkingMessage();
        scrollStream();
        setSending(true);

        $.ajax({
            type: "POST",
            url: askUrl,
            traditional: true,
            data: { question: question, model: $modelSelect.val() || "", embedding_enabled: $embeddingEnabled.is(":checked") ? "1" : "0", code_wiki_repo_url: $codeWikiRepoInput.val() || "", code_wiki_cnb_url: $codeWikiCNBURL.val() || "", code_wiki_cnb_username: $codeWikiCNBUsername.val() || "", code_wiki_cnb_token: $codeWikiCNBToken.val() || "", book_ids: $bookIds.val() || [] }
        }).done(function (res) {
            if (!res || res.errcode !== 0) {
                renderErrorMessage($pending, res && res.message ? res.message : "请求失败，请稍后重试。");
                return;
            }
            renderAssistantMessage($pending, res);
            $question.val("");
            autosizeQuestion();
        }).fail(function (xhr) {
            renderErrorMessage($pending, "请求失败：" + (xhr && xhr.responseJSON && xhr.responseJSON.message ? xhr.responseJSON.message : "网络异常"));
        }).always(function () {
            setSending(false);
            scrollStream();
            $question.focus();
        });
    });
});
</script>
</body>
</html>
