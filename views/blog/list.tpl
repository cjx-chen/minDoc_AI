<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{i18n .Lang "blog.blog_list"}} - Powered by MinDoc</title>
    <meta name="keywords" content="MinDoc,文档在线管理系统,WIKI,wiki,wiki在线,文档在线管理,接口文档在线管理,接口文档管理">
    <meta name="description" content="MinDoc文档在线管理系统 {{.site_description}}">
    <!-- Bootstrap -->
    <link href="{{cdncss "/static/bootstrap/css/bootstrap.min.css"}}" rel="stylesheet">
    <link href="{{cdncss "/static/font-awesome/css/font-awesome.min.css"}}" rel="stylesheet">
    <link href="{{cdncss "/static/css/main.css" "version"}}" rel="stylesheet">
    <link href="{{cdncss "/static/css/mindoc-ui.css" "version"}}" rel="stylesheet">

    <style type="text/css">
        .footer{margin-top: 0;}
        .label {
            background-color: #00b5ad!important;
            border-color: #00b5ad!important;
            color: #fff!important;
            font-weight: 400;
        }
    </style>
</head>
<body>
<div class="manual-reader manual-container manual-search-reader">
{{template "widgets/header.tpl" .}}
    <div class="container manual-body">
        <div class="row">
            <div class="manual-list">
            {{range $index,$item := .Lists}}
                <div class="search-item">
                    <div class="title">{{if eq $item.BlogStatus "password"}}<span class="label">{{i18n $.Lang "blog.encrypt"}}</span>{{end}} <a href="{{urlfor "BlogController.Index" ":id" $item.BlogId}}" title="{{$item.BlogTitle}}">{{$item.BlogTitle}}</a> </div>
                    <div class="description">
                    {{$item.BlogExcerpt}}
                    </div>
                    {{/*<div class="site">{{urlfor "BlogController.Index" ":id" $item.BlogId}}</div>*/}}
                    <div class="source">
                        <span class="item">{{i18n $.Lang "blog.author"}}：{{$item.CreateName}}</span>
                        <span class="item">{{i18n $.Lang "blog.update_time"}}：{{date_format  $item.Modified "2006-01-02 15:04:05"}}</span>
                    </div>
                </div>
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
                    <span class="empty-text">{{i18n $.Lang "blog.no_blog"}}</span>
                </div>
            {{end}}
                <nav class="pagination-container">
                {{.PageHtml}}
                </nav>
                <div class="clearfix"></div>
            </div>
        </div>
    </div>
{{template "widgets/footer.tpl" .}}
</div>
<script src="{{cdnjs "/static/jquery/1.12.4/jquery.min.js"}}"></script>
<script src="{{cdnjs "/static/bootstrap/js/bootstrap.min.js"}}"></script>
{{.Scripts}}
</body>
</html>