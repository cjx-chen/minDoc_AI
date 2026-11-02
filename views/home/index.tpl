<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <title>{{.SITE_NAME}} - Powered by MinDoc</title>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="renderer" content="webkit">
    <meta name="author" content="Minho" />
    <meta name="site" content="https://www.iminho.me" />
    <meta name="keywords" content="MinDoc,文档在线管理系统,WIKI,wiki,wiki在线,文档在线管理,接口文档在线管理,接口文档管理">
    <meta name="description" content="MinDoc文档在线管理系统 {{.site_description}}">
    <!-- Bootstrap -->
    <link href="{{cdncss "/static/bootstrap/css/bootstrap.min.css"}}" rel="stylesheet">
    <link href="{{cdncss "/static/font-awesome/css/font-awesome.min.css"}}" rel="stylesheet">
    <link href="{{cdncss "/static/css/main.css" "version"}}" rel="stylesheet">
    <link href="{{cdncss "/static/css/mindoc-ui.css" "version"}}" rel="stylesheet">
    <script type="text/javascript">
        window.updateBookOrder = "{{urlfor "BookController.UpdateBookOrder"}}";
        /* 3D 书柜功能开关 · 服务端默认值。
           后端可在 HomeController.Index 注入 c.Data["EnableShelf3D"]；缺省时取 false（默认关闭）。
           用户在前端拨动开关后的选择存 localStorage，优先级高于此默认值。 */
        window.MINDOC_SHELF3D_DEFAULT = {{if .EnableShelf3D}}true{{else}}false{{end}};
    </script>
</head>
<body>
<div class="manual-reader manual-container">
    {{template "widgets/header.tpl" .}}
    <div class="ui-home-hero">
        <div class="container">
            <span class="hero-eyebrow"><i class="fa fa-book" aria-hidden="true"></i>&nbsp;知识管理 · 文档库</span>
            <h1>全部文档</h1>
            <p>浏览沉淀的项目文档与知识资产，或使用顶部搜索快速定位内容</p>
            <div class="ui-home-actions">
                <div class="ui-view-toggle" id="home-view-toggle">
                    <button type="button" data-view="cards" class="active"><i class="fa fa-th-large" aria-hidden="true"></i>卡片视图</button>
                    <button type="button" data-view="shelf"><i class="fa fa-book" aria-hidden="true"></i>3D 书柜</button>
                </div>
                <!-- 手册入口：<1024 隐藏视图切换后仍可打开规范手册（shelf-spec.js 用 document 级委托监听该 action） -->
                <button type="button" class="ui-spec-link" data-shelf-action="spec">
                    <i class="fa fa-file-text-o" aria-hidden="true"></i>资产规范
                </button>
                <!-- 3D 书柜功能开关：默认关闭；开启后才显示「3D 书柜」视图入口与规范手册（shelf-3d.js 接线） -->
                <button type="button" class="ui-shelf-switch" id="home-shelf-switch" role="switch" aria-checked="false"
                        title="开启后，首页可切换到 3D 书柜视图">
                    <span class="ui-shelf-switch-track" aria-hidden="true"><span class="ui-shelf-switch-thumb"></span></span>
                    <span class="ui-shelf-switch-text">3D 书柜</span>
                </button>
            </div>
        </div>
    </div>
    <div class="container manual-body ui-home-body">
        <div class="row">
            <div class="col-xs-12">
                <!-- 3D 书柜舞台：canvas 由 shelf-3d.js 注入（class="shelf-canvas"），chrome 样式见 mindoc-ui.css -->
                <div class="home-shelf-3d" id="home-shelf-3d" role="region" aria-label="知识书柜 3D 展示"
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
            </div>
             <div class="manual-list ui-book-grid">
                {{range $index,$item := .Lists}}
                    <div class="list-item" data-id="{{$item.BookId}}" data-docs="{{$item.DocCount}}" data-desc="{{$item.Description}}">
                        <dl class="manual-item-standard">
                            <dt>
                                <a href="{{urlfor "DocumentController.Index" ":key" $item.Identify}}" title="{{$item.BookName}}-{{$item.CreateName}}">
                                    <span class="cover-fallback" aria-hidden="true" data-name="{{$item.BookName}}">
                                        <svg class="cover-fallback-icon" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <rect x="16" y="12" width="44" height="56" rx="5" transform="rotate(-6 16 12)" fill="rgba(255,255,255,.08)" stroke="rgba(255,255,255,.4)" stroke-width="2"/>
                                            <path d="M30 8h30l12 12v48a4 4 0 0 1-4 4H30a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4z" fill="rgba(255,255,255,.75)" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/>
                                            <path d="M60 8v12h12" fill="rgba(255,255,255,.55)" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/>
                                            <line x1="35" y1="31" x2="60" y2="31" stroke="#0a6b4a" stroke-width="3.5" stroke-linecap="round" opacity=".4"/>
                                            <line x1="35" y1="41" x2="60" y2="41" stroke="#0a6b4a" stroke-width="3.5" stroke-linecap="round" opacity=".22"/>
                                        </svg>
                                        <span class="cover-fallback-name">{{$item.BookName}}</span>
                                    </span>
                                    {{if ne $item.Cover (cdnimg "static/images/book.jpg")}}<img src="{{cdnimg $item.Cover}}" class="cover" alt="{{$item.BookName}}-{{$item.CreateName}}" onerror="this.style.display='none';">{{end}}
                                </a>
                            </dt>
                            <dd class="book-name">
                                <a href="{{urlfor "DocumentController.Index" ":key" $item.Identify}}" class="name" title="{{$item.BookName}}-{{$item.CreateName}}">{{$item.BookName}}</a>
                            </dd>
                            <dd>
                            <span class="author">
                                <b class="text" style="display:inline-block;margin-right:6px;"><i class="fa fa-user-o" aria-hidden="true"></i></b>
                                <b class="text">{{if eq $item.RealName "" }}{{$item.CreateName}}{{else}}{{$item.RealName}}{{end}}</b>
                            </span>
                            </dd>
                        </dl>
                    </div>
                {{else}}
                    <div class="ui-home-empty">
                        <div class="empty-icon" aria-hidden="true">
                            <svg viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect x="16" y="12" width="44" height="56" rx="5" transform="rotate(-6 16 12)" fill="#eaf6f0" stroke="#cfe8db" stroke-width="2"/>
                                <path d="M30 8h30l12 12v48a4 4 0 0 1-4 4H30a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4z" fill="#ffffff" stroke="#009a61" stroke-width="2.5"/>
                                <path d="M60 8v12h12" fill="#e7f6f0" stroke="#009a61" stroke-width="2.5" stroke-linejoin="round"/>
                                <line x1="35" y1="32" x2="63" y2="32" stroke="#cfe8db" stroke-width="3.5" stroke-linecap="round"/>
                                <line x1="35" y1="42" x2="63" y2="42" stroke="#e2efe8" stroke-width="3.5" stroke-linecap="round"/>
                                <line x1="35" y1="52" x2="52" y2="52" stroke="#e2efe8" stroke-width="3.5" stroke-linecap="round"/>
                                <circle cx="68" cy="64" r="12" fill="#ffffff" stroke="#009a61" stroke-width="2.5"/>
                                <line x1="77" y1="73" x2="84" y2="80" stroke="#009a61" stroke-width="3.5" stroke-linecap="round"/>
                            </svg>
                        </div>
                        <div class="empty-text">{{i18n $.Lang "message.no_project"}}</div>
                    </div>
                {{end}}
                <div class="clearfix"></div>
            </div>
            <nav class="pagination-container">
                {{if gt .TotalPages 1}}
                    {{.PageHtml}}
                {{end}}
                <div class="clearfix"></div>
            </nav>
        </div>
    </div>
    {{template "widgets/footer.tpl" .}}
</div>
<script src="{{cdnjs "/static/jquery/1.12.4/jquery.min.js"}}" type="text/javascript"></script>
<script src="{{cdnjs "/static/bootstrap/js/bootstrap.min.js"}}" type="text/javascript"></script>
<script src="{{cdnjs "/static/layer/layer.js"}}"></script>
<script src="{{cdnjs "/static/js/sort.js"}}" type="text/javascript"></script>
<script src="{{cdnjs "/static/js/three/three.min.js" "version"}}" type="text/javascript"></script>
<script src="{{cdnjs "/static/js/shelf-spec.js" "version"}}" type="text/javascript"></script>
<script src="{{cdnjs "/static/js/shelf-3d.js" "version"}}" type="text/javascript"></script>
{{.Scripts}}
</body>
</html>
