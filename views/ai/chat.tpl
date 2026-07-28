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
        .manual-body {
            padding-top: 12px;
        }
        .manual-reader > .footer,
        .manual-reader > .footer .container,
        .manual-reader > .footer .row {
            text-align: center;
        }
        .manual-reader > .footer span {
            display: inline-block;
            float: none;
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
        .ai-book-picker {
            position: relative;
            max-width: 520px;
        }
        .ai-book-picker-toggle {
            position: relative;
            height: auto;
            min-height: 34px;
            padding-right: 34px;
            text-align: left;
            white-space: normal;
            background: #fff;
        }
        .ai-book-picker-toggle .caret {
            position: absolute;
            top: 15px;
            right: 12px;
        }
        .ai-book-menu {
            display: none;
            position: absolute;
            z-index: 1000;
            top: 100%;
            left: 0;
            right: 0;
            max-height: 260px;
            margin-top: 2px;
            padding: 8px 0;
            overflow: auto;
            background: #fff;
            border: 1px solid #ccc;
            border-radius: 4px;
            box-shadow: 0 6px 12px rgba(0, 0, 0, .175);
        }
        .ai-book-picker.open .ai-book-menu {
            display: block;
        }
        .ai-book-search {
            padding: 0 12px 8px;
        }
        .ai-book-search input {
            height: 32px;
        }
        .ai-book-option {
            display: block;
            margin: 0;
            padding: 7px 12px;
            cursor: pointer;
            font-weight: normal;
        }
        .ai-book-option:hover {
            background: #f5f5f5;
        }
        .ai-book-option input {
            margin-right: 8px;
        }
        .ai-book-divider {
            margin: 6px 0;
            border-top: 1px solid #eee;
        }
        .ai-book-empty {
            padding: 7px 12px;
            color: #999;
        }
        .ai-chat-embedded .manual-body {
            width: 100%;
            padding: 18px;
            margin: 0;
        }
        .ai-chat-embedded .m-box {
            margin-bottom: 0;
            border-radius: 6px;
        }
        .ai-chat-embedded .footer {
            display: none;
        }
        .ai-chat-embedded .box-head {
            display: none;
        }
        .ai-chat-embedded .box-title {
            display: none;
        }
        .ai-chat-embedded #ai-status {
            margin-top: 0;
        }
    </style>
</head>
<body{{if .AIEmbedded}} class="ai-chat-embedded"{{end}}>
<div class="manual-reader">
    {{if .AIEmbedded}}{{else}}
    {{template "widgets/header.tpl" .}}
    {{end}}
    <div class="container manual-body">
        <div class="row">
            <div class="m-box">
                <div class="box-head">
                    {{if .AIEmbedded}}{{else}}<strong class="box-title">AI 问答（基于 Markdown 知识库）</strong>{{end}}
                    <span class="pull-right text-muted" id="ai-status">
                        {{if .AIEnabled}}
                        &#24403;&#21069;&#27169;&#22411;&#65306;
                        <select id="ai-model-select" class="form-control input-sm" style="display:inline-block;width:auto;min-width:180px;">
                            {{range .AIModelOptions}}
                            <option value="{{.}}" {{if eq . $.AIModel}}selected{{end}}>{{.}}</option>
                            {{end}}
                        </select>
                        <label class="text-muted" style="font-weight:normal;margin-left:12px;margin-bottom:0;">
                            <input type="checkbox" id="ai-embedding-enabled" name="embedding_enabled" value="1" {{if .AIEmbeddingEnabled}}checked{{end}}>
                            &#21521;&#37327;&#26816;&#32034;
                        </label>
                        {{else}}
                        &#26410;&#24320;&#21551; AI &#27169;&#22411;&#65292;&#24403;&#21069;&#20026;&#26816;&#32034;&#25688;&#35201;&#27169;&#24335;
                        {{end}}
                    </span>
                </div>
                <div class="box-body">
                    <form id="ai-chat-form">
                        <div class="form-group">
                            <label for="question">向 MinDoc 知识库提问：</label>
                            <textarea id="question" name="question" class="form-control" rows="4" placeholder="{{.AIQuestionPlaceholder}}"></textarea>
                        </div>
                        <div class="form-group" id="code-wiki-repo-group" style="display:none;">
                            <label for="code_wiki_repo_select">Code Wiki &#20179;&#24211;&#65306;</label>
                            <select id="code_wiki_repo_select" class="form-control"></select>
                            <input type="hidden" id="code_wiki_repo_url" name="code_wiki_repo_url" value="{{.AICodeWikiRepoURL}}">
                            <input type="hidden" id="code_wiki_cnb_url" name="code_wiki_cnb_url">
                            <input type="hidden" id="code_wiki_cnb_username" name="code_wiki_cnb_username">
                            <input type="hidden" id="code_wiki_cnb_token" name="code_wiki_cnb_token">
                            <p class="help-block">&#36873;&#25321; code wiki &#27169;&#22411;&#26102;&#65292;&#35831;&#36873;&#25321;&#20195;&#30721;&#30693;&#35782;&#24211;&#65307;&#28857;&#20987;&#8220;&#26356;&#22810;...&#8221;&#21487;&#26032;&#22686; CNB &#20179;&#24211;&#20449;&#24687;&#12290;</p>
                        </div>
                        <div class="form-group">
                            <label for="ai-book-toggle">&#26816;&#32034;&#39033;&#30446;&#33539;&#22260;&#65306;</label>
                            <div class="ai-book-picker" id="ai-book-picker">
                                <button type="button" class="form-control ai-book-picker-toggle" id="ai-book-toggle">
                                    <span id="ai-book-summary">&#20840;&#37096;&#21487;&#35775;&#38382;&#39033;&#30446;</span>
                                    <span class="caret"></span>
                                </button>
                                <div class="ai-book-menu" id="ai-book-menu">
                                    <div class="ai-book-search">
                                        <input type="text" class="form-control input-sm" id="ai-book-search" placeholder="输入项目名搜索...">
                                    </div>
                                    <label class="ai-book-option ai-book-all">
                                        <input type="checkbox" id="ai-book-all">
                                        <span>&#20840;&#37096;&#21487;&#35775;&#38382;&#39033;&#30446;</span>
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
                            <p class="help-block">&#28857;&#20987;&#19979;&#25289;&#26694;&#21246;&#36873;&#22810;&#20010;&#39033;&#30446;&#65307;&#19981;&#21246;&#36873;&#34920;&#31034;&#26816;&#32034;&#20840;&#37096;&#21487;&#35775;&#38382;&#39033;&#30446;&#12290;</p>
                        </div>
                        <div class="form-group">
                            <button type="submit" class="btn btn-success" data-loading-text="生成中...">
                                <i class="fa fa-send-o"></i> 发送问题
                            </button>
                            <span id="ai-error" class="text-danger" style="margin-left: 10px;"></span>
                        </div>
                    </form>
                    <div id="ai-loading" class="text-muted" style="display:none; margin-bottom: 10px;">
                        <i class="fa fa-spinner fa-spin"></i> <span id="ai-loading-text">正在检索知识分片并生成答案...</span>
                    </div>
                    <div id="ai-result" style="display:none;">
                        <h4>答案</h4>
                        <div id="ai-answer" class="well ai-answer-markdown"></div>
                        <div id="ai-timing" class="text-muted" style="margin-bottom: 10px;"></div>
                        <h4>参考来源</h4>
                        <ul id="ai-sources" class="list-unstyled"></ul>
                    </div>
                </div>
            </div>
        </div>
    </div>
    {{template "widgets/footer.tpl" .}}
</div>
<div class="modal fade" id="code-wiki-repo-more-modal" tabindex="-1" role="dialog" aria-labelledby="code-wiki-repo-more-title">
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
                <h4 class="modal-title" id="code-wiki-repo-more-title">&#26032;&#22686; Code Wiki &#20179;&#24211;</h4>
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
                <button type="button" class="btn btn-default" data-dismiss="modal">&#21462;&#28040;</button>
                <button type="button" class="btn btn-primary" id="code-wiki-repo-more-save">&#30830;&#23450;</button>
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
    var $form = $("#ai-chat-form");
    var $question = $("#question");
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
    var $answer = $("#ai-answer");
    var $sources = $("#ai-sources");
    var $timing = $("#ai-timing");
    var $loading = $("#ai-loading");
    var $loadingText = $("#ai-loading-text");
    var $result = $("#ai-result");
    var $error = $("#ai-error");

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

    applyInitialBookScope();
    updateCodeWikiRepoField();
    $modelSelect.on("change", updateCodeWikiRepoField);
    buildBookPicker();

    $form.on("submit", function (event) {
        event.preventDefault();
        var question = $.trim($question.val());
        if (question.length === 0) {
            $error.text("请输入问题内容");
            return;
        }
        $error.text("");
        $loadingText.text($embeddingEnabled.is(":checked") ? "正在进行向量检索并生成答案..." : "正在检索知识分片并生成答案...");
        $loading.show();
        $result.hide();
        $sources.empty();
        $answer.empty();
        $timing.empty();
        $("button[type='submit']").button("loading");

        $.ajax({
            type: "POST",
            url: askUrl,
            traditional: true,
            data: { question: question, model: $modelSelect.val() || "", embedding_enabled: $embeddingEnabled.is(":checked") ? "1" : "0", code_wiki_repo_url: $codeWikiRepoInput.val() || "", code_wiki_cnb_url: $codeWikiCNBURL.val() || "", code_wiki_cnb_username: $codeWikiCNBUsername.val() || "", code_wiki_cnb_token: $codeWikiCNBToken.val() || "", book_ids: $bookIds.val() || [] }
        }).done(function (res) {
            if (!res || res.errcode !== 0) {
                $error.text(res && res.message ? res.message : "请求失败");
                return;
            }
            $answer.html(renderMarkdown(res.data.answer || ""));
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
            $timing.text("Timing: retrieval " + retrieveMs + " ms, embedding " + embeddingMs + " ms, model " + llmMs + " ms, total " + totalMs + " ms | " + vectorText);
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
