<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">

    <title>{{i18n .Lang "project.prj_space_list"}} - Powered by MinDoc</title>
    <meta name="keywords" content="MinDoc,文档在线管理系统,WIKI,wiki,wiki在线,文档在线管理,接口文档在线管理,接口文档管理">
    <meta name="description" content="MinDoc文档在线管理系统 {{.site_description}}">
    <meta name="author" content="Minho" />
    <meta name="site" content="https://www.iminho.me" />
    <!-- Bootstrap -->
    <link href="{{cdncss "/static/bootstrap/css/bootstrap.min.css"}}" rel="stylesheet">
    <link href="{{cdncss "/static/font-awesome/css/font-awesome.min.css"}}" rel="stylesheet">

    <link href="{{cdncss "/static/css/main.css" "version"}}" rel="stylesheet">
    <link href="{{cdncss "/static/css/mindoc-ui.css" "version"}}" rel="stylesheet">

</head>
<body>
<div class="manual-reader manual-container manual-search-reader">
{{template "widgets/header.tpl" .}}
    <div class="container manual-body">
        <div class="search-head">
            <strong class="search-title">{{i18n .Lang "project.prj_space_list"}}</strong>
        </div>
        <div class="row">
            <div class="hide tag-container-outer" style="border: 0;margin-top: 0;padding: 5px 15px;min-height: 200px;">
                <div class="attach-list" id="ItemsetsList">
                {{range $index,$item := .Lists}}
                    <a href="{{urlfor "ItemsetsController.List" ":key" $item.ItemKey}}" class="ui-card" title="{{$item.ItemName}}">
                    <div class="header">{{$item.ItemName}}</div>
                        <div class="description">{{i18n $.Lang "project.prj_amount"}}：{{$item.BookNumber}} &nbsp; {{i18n $.Lang "project.creator"}}：{{$item.CreateName}}<br/> {{i18n $.Lang "project.create_time"}}：{{$item.CreateTimeString}}</div>
                    </a>
                {{else}}
                    <div class="search-empty">
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
                        <span class="empty-text">{{i18n .Lang "project.no_projct_space"}}</span>
                    </div>
                {{end}}
                </div>
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
{{.Scripts}}
</body>
</html>