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
    <style>
        .ai-answer-markdown {
            min-height: 120px;
            white-space: normal;
            line-height: 1.75;
        }
        .ai-answer-markdown p:last-child,
        .ai-answer-markdown ul:last-child,
        .ai-answer-markdown ol:last-child,
        .ai-answer-markdown pre:last-child {
            margin-bottom: 0;
        }
        .ai-answer-markdown pre {
            padding: 12px;
            background: #f7f7f7;
            border: 1px solid #e5e5e5;
            border-radius: 4px;
            overflow: auto;
        }
        .ai-answer-markdown code {
            color: #c7254e;
            background: #f9f2f4;
        }
        .ai-answer-markdown pre code {
            color: inherit;
            background: transparent;
        }
        .ai-answer-markdown blockquote {
            border-left: 4px solid #ddd;
            color: #666;
            margin: 0 0 10px;
            padding: 8px 14px;
            background: #fafafa;
        }
        .ai-answer-markdown table {
            width: 100%;
            margin-bottom: 12px;
            border-collapse: collapse;
        }
        .ai-answer-markdown th,
        .ai-answer-markdown td {
            border: 1px solid #ddd;
            padding: 6px 10px;
        }
    </style>
</head>
<body>
<div class="manual-reader">
    {{template "widgets/header.tpl" .}}
    <div class="container manual-body">
        <div class="row">
            <div class="m-box">
                <div class="box-head">
                    <strong class="box-title">AI 问答（基于 Markdown 知识库）</strong>
                    <span class="pull-right text-muted" id="ai-status">
                        {{if .AIEnabled}}当前模型：{{.AIModel}}{{else}}未开启 AI 模型，当前为检索摘要模式{{end}}
                    </span>
                </div>
                <div class="box-body">
                    <form id="ai-chat-form">
                        <div class="form-group">
                            <label for="question">向 MinDoc 知识库提问：</label>
                            <textarea id="question" name="question" class="form-control" rows="4" placeholder="{{.AIQuestionPlaceholder}}"></textarea>
                        </div>
                        <div class="form-group">
                            <button type="submit" class="btn btn-success" data-loading-text="生成中...">
                                <i class="fa fa-send-o"></i> 发送问题
                            </button>
                            <span id="ai-error" class="text-danger" style="margin-left: 10px;"></span>
                        </div>
                    </form>
                    <div id="ai-loading" class="text-muted" style="display:none; margin-bottom: 10px;">
                        <i class="fa fa-spinner fa-spin"></i> 正在检索知识分片并生成答案...
                    </div>
                    <div id="ai-result" style="display:none;">
                        <h4>答案</h4>
                        <div id="ai-answer" class="well ai-answer-markdown"></div>
                        <h4>参考来源</h4>
                        <ul id="ai-sources" class="list-unstyled"></ul>
                    </div>
                </div>
            </div>
        </div>
    </div>
    {{template "widgets/footer.tpl" .}}
</div>
<script src="{{cdnjs "/static/jquery/1.12.4/jquery.min.js"}}" type="text/javascript"></script>
<script src="{{cdnjs "/static/bootstrap/js/bootstrap.min.js"}}" type="text/javascript"></script>
<script src="{{cdnjs "/static/editor.md/lib/marked.min.js"}}" type="text/javascript"></script>
<script>
$(function () {
    var askUrl = "{{urlfor "AiController.Ask"}}";
    var $form = $("#ai-chat-form");
    var $question = $("#question");
    var $answer = $("#ai-answer");
    var $sources = $("#ai-sources");
    var $loading = $("#ai-loading");
    var $result = $("#ai-result");
    var $error = $("#ai-error");

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

    $form.on("submit", function (event) {
        event.preventDefault();
        var question = $.trim($question.val());
        if (question.length === 0) {
            $error.text("请输入问题内容");
            return;
        }
        $error.text("");
        $loading.show();
        $result.hide();
        $sources.empty();
        $answer.empty();
        $("button[type='submit']").button("loading");

        $.ajax({
            type: "POST",
            url: askUrl,
            data: { question: question }
        }).done(function (res) {
            if (!res || res.errcode !== 0) {
                $error.text(res && res.message ? res.message : "请求失败");
                return;
            }
            $answer.html(renderMarkdown(res.data.answer || ""));
            if (res.data.sources && res.data.sources.length) {
                $.each(res.data.sources, function (index, item) {
                    var source = $("<li>").addClass("text-muted").css("margin-bottom", "10px");
                    var title = $("<span>").text((index + 1) + ". " + (item.book_name || "未知项目") + " - " + (item.title || "未命名文档"));
                    var link = $("<a>").attr("href", item.source_url || "#")
                        .attr("target", "_blank")
                        .text(item.source_url ? "查看原文档" : "无链接");
                    source.append(title).append("（").append(link).append("）");
                    $sources.append(source);
                });
            } else {
                $sources.append($("<li>").text("未检索到可追溯来源。"));
            }
            $result.show();
        }).fail(function (xhr) {
            $error.text("请求失败：" + (xhr && xhr.responseJSON && xhr.responseJSON.message ? xhr.responseJSON.message : "网络异常"));
        }).always(function () {
            $loading.hide();
            $("button[type='submit']").button("reset");
        });
    });
});
</script>
</body>
</html>
