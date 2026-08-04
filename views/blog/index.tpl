<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="renderer" content="webkit">
    <meta name="author" content="Minho" />
    <meta name="site" content="https://www.iminho.me" />
    <meta name="keywords" content="{{.Model.BlogTitle}}">
    <meta name="description" content="{{.Model.BlogTitle}}-{{.Description}}">
    <title>{{.Model.BlogTitle}} - Powered by MinDoc</title>

    <!-- Bootstrap -->
    <link href="{{cdncss "/static/bootstrap/css/bootstrap.min.css"}}" rel="stylesheet">

    <link href="{{cdncss "/static/font-awesome/css/font-awesome.min.css"}}" rel="stylesheet">
    <link href="{{cdncss "/static/editor.md/lib/sequence/sequence-diagram-min.css"}}" rel="stylesheet">
    <link href="{{cdncss "/static/css/kancloud.css" "version"}}" rel="stylesheet">
    <link href="{{cdncss "/static/editor.md/css/editormd.preview.css"}}" rel="stylesheet">
    <link href="{{cdncss "/static/css/markdown.preview.css" "version"}}" rel="stylesheet">
    <link href="{{cdncss (print "/static/editor.md/lib/highlight/styles/" .HighlightStyle ".css") "version"}}" rel="stylesheet">
    <link href="{{cdncss "/static/katex/katex.min.css"}}" rel="stylesheet">
    <link href="{{cdncss "/static/css/print.css"}}" media="print" rel="stylesheet">
    <link href="{{cdncss "/static/css/main.css" "version"}}" rel="stylesheet">
    <link href="{{cdncss "/static/css/mindoc-ui.css" "version"}}" rel="stylesheet">
    <link href="{{cdncss "/static/css/blog-detail.css" "version"}}" rel="stylesheet">
</head>
<body>
<div class="manual-reader manual-container manual-search-reader ui-blog-detail-shell">
{{template "widgets/header.tpl" .}}
    <div class="container manual-body ui-blog-detail">
        <div class="search-head">
            <h1 class="header">
               {{.Model.BlogTitle}}
            </h1>
            <div class="blog-meta">
                <div class="item user_img"><img src="{{cdnimg .Model.MemberAvatar}}" alt="{{.Model.CreateName}}"> </div>
                <div class="item">&nbsp;{{.Model.CreateName}}</div>
                <div class="item">{{i18n .Lang "blog.posted_on"}}</div>
                <div class="item">{{date_format .Model.Created "2006-01-02 15:04:05"}}</div>
                <div class="item">{{.Model.ModifyRealName}}</div>
                <div class="item">{{i18n .Lang "blog.modified_on"}}</div>
                <div class="item">{{date_format .Model.Modified "2006-01-02 15:04:05"}}</div>
                {{if eq .Member.MemberId .Model.MemberId}}
                    <div class="item"><a href='{{urlfor "BlogController.ManageEdit" ":id" .Model.BlogId}}' title="{{i18n .Lang "blog.edit_blog"}}"><i class="fa fa-edit"></i> {{i18n .Lang "common.edit"}}</a></div>
                {{end}}
            </div>
        </div>
        <div class="row">
            <div class="article-body  markdown-body editormd-preview-container content">
                {{.Content}}
                {{if .Model.AttachList}}
                <div class="attach-list"><strong>{{i18n .Lang "doc.attachment"}}</strong><ul>
                {{range $index,$item := .Model.AttachList}}
                <li><a href="{{$item.HttpPath}}" title="{{$item.FileName}}">{{$item.FileName}}</a> </li>
                {{end}}
                </ul>
                {{end}}
            </div>
        </div>
        <div class="row blog-footer">
            <p>
                <span>{{i18n .Lang "blog.prev"}}</span>
            {{if .Previous}}
                <a href="{{urlfor "BlogController.Index" ":id" .Previous.BlogId}}" title="{{.Previous.BlogTitle}}">{{.Previous.BlogTitle}}
                </a>
            {{else}}
               {{i18n .Lang "blog.no"}}
            {{end}}
            </p>
            <p>
                <span>{{i18n .Lang "blog.next"}}</span>
            {{if .Next}}
                <a href="{{urlfor "BlogController.Index" ":id" .Next.BlogId}}" title="{{.Next.BlogTitle}}">{{.Next.BlogTitle}}</a>
            {{else}}
                {{i18n .Lang "blog.no"}}
            {{end}}
            </p>
        </div>
    </div>
{{template "widgets/footer.tpl" .}}
    </div>
</div>
<script src="{{cdnjs "/static/jquery/1.12.4/jquery.min.js"}}"></script>
<script src="{{cdnjs "/static/bootstrap/js/bootstrap.min.js"}}"></script>
{{.Scripts}}
</body>
</html>
