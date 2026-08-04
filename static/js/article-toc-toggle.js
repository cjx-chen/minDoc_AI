(function ($) {
    "use strict";

    $(function () {
        var $reader = $(".m-manual.manual-reader");
        var storageKey = "mindoc.article.toc.hidden";

        if (!$reader.length || !$("#page-content").length) {
            return;
        }

        function readHiddenState() {
            try {
                return window.localStorage.getItem(storageKey) === "1";
            } catch (e) {
                return false;
            }
        }

        function saveHiddenState(hidden) {
            try {
                window.localStorage.setItem(storageKey, hidden ? "1" : "0");
            } catch (e) {
                return;
            }
        }

        function findArticleToc() {
            return $("#page-content")
                .find(".markdown-toc, .editormd-markdown-toc, .toc")
                .filter(function () {
                    return $(this).find("a").length > 0;
                });
        }

        function applyState(hidden, $button) {
            $reader.toggleClass("article-toc-hidden", hidden);
            $button.attr("aria-pressed", hidden ? "true" : "false");
            $button.attr("title", hidden ? "\u663e\u793a\u6587\u7ae0\u76ee\u5f55" : "\u9690\u85cf\u6587\u7ae0\u76ee\u5f55");
            $button.find(".article-toc-toggle-text").text(hidden ? "\u663e\u793a\u76ee\u5f55" : "\u9690\u85cf\u76ee\u5f55");
            $button.find("i").toggleClass("fa-list-ul", hidden).toggleClass("fa-columns", !hidden);
        }

        function initializeToggle() {
            var $toc = findArticleToc();
            var $button = $("#article-toc-toggle");

            if (!$toc.length) {
                return false;
            }

            $toc.attr("data-article-toc", "1");
            if (!$button.length) {
                $button = $(
                    '<button type="button" id="article-toc-toggle" class="article-toc-toggle" aria-pressed="false">' +
                    '<i class="fa fa-columns" aria-hidden="true"></i>' +
                    '<span class="article-toc-toggle-text"></span>' +
                    '</button>'
                );
                $reader.append($button);
                $button.on("click", function () {
                    var hidden = !$reader.hasClass("article-toc-hidden");
                    applyState(hidden, $button);
                    saveHiddenState(hidden);
                });
            }

            applyState(readHiddenState(), $button);
            $button.addClass("is-ready");
            return true;
        }

        if (!initializeToggle()) {
            window.setTimeout(initializeToggle, 500);
            window.setTimeout(initializeToggle, 1500);
        }
    });
})(jQuery);
