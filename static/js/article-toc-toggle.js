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
                .find(".markdown-toc, .editormd-markdown-toc, .toc, .toc-container, [data-toc]")
                .filter(function () {
                    return $(this).find("a").length > 0;
                });
        }

        function applyState(hidden, $button) {
            var actionText = hidden ? "\u663e\u793a\u76ee\u5f55" : "\u9690\u85cf\u76ee\u5f55";
            $reader.toggleClass("article-toc-hidden", hidden);
            $button.attr("aria-pressed", hidden ? "true" : "false");
            $button.attr("aria-expanded", hidden ? "false" : "true");
            $button.attr("aria-label", actionText);
            $button.attr("title", actionText);
            $button.find(".article-toc-toggle-text").text(actionText);
            $button.find("i").toggleClass("fa-list-ul", hidden).toggleClass("fa-columns", !hidden);
        }

        function initializeToggle() {
            var $toc = findArticleToc();
            var $button = $("#article-toc-toggle");

            if (!$toc.length) {
                $button.removeClass("is-ready");
                return false;
            }

            $toc.attr("data-article-toc", "1");
            if (!$button.length) {
                $button = $(
                    '<button type="button" id="article-toc-toggle" class="article-toc-toggle" aria-pressed="false" aria-expanded="true" aria-controls="page-content">' +
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

        initializeToggle();

        var observeNode = $reader.find(".manual-right").get(0) || document.getElementById("page-content");
        if (observeNode && window.MutationObserver) {
            var refreshTimer = null;
            var observer = new MutationObserver(function () {
                window.clearTimeout(refreshTimer);
                refreshTimer = window.setTimeout(initializeToggle, 30);
            });
            observer.observe(observeNode, { childList: true, subtree: true });
        } else {
            window.setInterval(initializeToggle, 1500);
        }
    });
})(jQuery);
