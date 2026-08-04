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
        </div>
    </div>
    <div class="container manual-body ui-home-body">
        <div class="row">
             <div class="manual-list ui-book-grid">
                {{range $index,$item := .Lists}}
                    <div class="list-item" data-id="{{$item.BookId}}">
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
{{.Scripts}}
</body>
</html>
