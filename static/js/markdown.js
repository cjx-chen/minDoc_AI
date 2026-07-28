function getMinDocSafeLocale(locales) {
    locales = locales || {};
    return locales[window.lang] || (typeof lang !== "undefined" ? locales[lang] : null) || locales["zh-CN"] || locales.en || {};
}
function getMinDocActiveEditormdLocale() {
    var locales = window.editormdLocales || {};
    return locales[window.lang] || (typeof lang !== "undefined" ? locales[lang] : null) || locales["zh-CN"] || locales.en || {};
}
$(function () {
    editormd.katexURL = {
        css: window.katex.css,
        jsmain: window.katex.js,
        jsauto: window.katex.jsauto || (window.katex.js.replace(/\/[^\/]+$/, '') + '/contrib/auto-render.min')
    };

    function getCodeMirrorPass(cm) {
        var codeMirror = window.CodeMirror || (window.editormd && window.editormd.$CodeMirror) || (cm && cm.constructor);
        return codeMirror && codeMirror.Pass;
    }

    function repeatSpaces(count) {
        return new Array(Math.max(count, 0) + 1).join(" ");
    }

    function parseMarkdownTableCells(line) {
        if (!line || line.indexOf("|") < 0) {
            return null;
        }

        var text = $.trim(line);
        if (!text) {
            return null;
        }
        if (text.charAt(0) === "|") {
            text = text.substring(1);
        }
        if (text.charAt(text.length - 1) === "|") {
            text = text.substring(0, text.length - 1);
        }

        var cells = [];
        var cell = "";
        var escaped = false;
        for (var i = 0; i < text.length; i++) {
            var ch = text.charAt(i);
            if (escaped) {
                cell += ch;
                escaped = false;
                continue;
            }
            if (ch === "\\") {
                cell += ch;
                escaped = true;
                continue;
            }
            if (ch === "|") {
                cells.push(cell);
                cell = "";
                continue;
            }
            cell += ch;
        }
        cells.push(cell);

        return cells.length >= 2 ? cells : null;
    }

    function isMarkdownTableSeparator(line) {
        return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line || "");
    }

    function isMarkdownTableRow(cm, lineNo) {
        var line = cm.getLine(lineNo);
        var cells = parseMarkdownTableCells(line);
        if (!cells) {
            return false;
        }

        var text = $.trim(line);
        if (text.charAt(0) === "|" || text.charAt(text.length - 1) === "|" || isMarkdownTableSeparator(line)) {
            return true;
        }

        var prev = lineNo > cm.firstLine() ? cm.getLine(lineNo - 1) : "";
        var next = lineNo < cm.lastLine() ? cm.getLine(lineNo + 1) : "";
        return isMarkdownTableSeparator(prev) || isMarkdownTableSeparator(next);
    }

    function isInMarkdownFence(cm, lineNo) {
        var fence = null;
        for (var i = cm.firstLine(); i < lineNo; i++) {
            var match = (cm.getLine(i) || "").match(/^\s*(```+|~~~+)/);
            if (!match) {
                continue;
            }
            var marker = match[1].charAt(0);
            if (!fence) {
                fence = marker;
            } else if (fence === marker) {
                fence = null;
            }
        }
        return !!fence;
    }

    function collectMarkdownTableWidths(cm, lineNo, columnCount) {
        var widths = [];
        for (var i = 0; i < columnCount; i++) {
            widths[i] = 1;
        }

        var start = lineNo;
        var end = lineNo;
        while (start > cm.firstLine() && isMarkdownTableRow(cm, start - 1)) {
            start--;
        }
        while (end < cm.lastLine() && isMarkdownTableRow(cm, end + 1)) {
            end++;
        }

        for (var lineIndex = start; lineIndex <= end; lineIndex++) {
            var line = cm.getLine(lineIndex);
            var cells = parseMarkdownTableCells(line);
            if (!cells) {
                continue;
            }
            for (var col = 0; col < columnCount; col++) {
                var cellText = $.trim(cells[col] || "");
                widths[col] = Math.max(widths[col], isMarkdownTableSeparator(line) ? 3 : cellText.length, 1);
            }
        }

        return widths;
    }

    function buildEmptyMarkdownTableRow(indent, widths) {
        var row = indent + "|";
        for (var i = 0; i < widths.length; i++) {
            row += "  |";
        }
        return row;
    }

    function insertMarkdownTableRow(cm) {
        if (cm.getOption && cm.getOption("disableInput")) {
            return false;
        }

        var ranges = cm.listSelections();
        if (ranges.length !== 1 || !ranges[0].empty()) {
            return false;
        }

        var pos = ranges[0].head;
        if (isInMarkdownFence(cm, pos.line) || !isMarkdownTableRow(cm, pos.line)) {
            return false;
        }

        var line = cm.getLine(pos.line);
        var cells = parseMarkdownTableCells(line);
        if (!cells) {
            return false;
        }

        var indent = (line.match(/^\s*/) || [""])[0];
        var widths = collectMarkdownTableWidths(cm, pos.line, cells.length);
        var newRow = buildEmptyMarkdownTableRow(indent, widths);
        var insertAt = {line: pos.line, ch: line.length};

        cm.operation(function () {
            cm.replaceRange("\n" + newRow, insertAt, null, "+input");
            cm.setCursor({line: pos.line + 1, ch: indent.length + 2});
        });
        return true;
    }

    var drawio = new Object()

    drawio.processMarkers = function (from, to) {
        var _this = this
        var found = null
        var foundStart = 0
        var cm = window.editor.cm;
        cm.doc.getAllMarks().forEach(mk => {
            if (mk.__kind) {
                mk.clear()
            }
        })
        cm.eachLine(from, to, function (ln) {
            const line = ln.lineNo()

            if (ln.text.startsWith('```drawio')) {
                found = 'drawio'
                foundStart = line
            } else if (ln.text === '```' && found) {
                switch (found) {
                    // -> DRAWIO
                    case 'drawio': {
                        if (line - foundStart !== 2) {
                            return
                        }
                        _this.addMarker({
                            kind: 'drawio',
                            from: { line: foundStart, ch: 3 },
                            to: { line: foundStart, ch: 10 },
                            text: 'drawio',
                            action: (function (start, end) {
                                return function (ev) {
                                    cm.doc.setSelection({ line: start, ch: 0 }, { line: end, ch: 3 })
                                    try {
                                        // save state data
                                        const raw = cm.doc.getLine(end - 1)
                                        window.sessionStorage.setItem("drawio", raw);
                                        _this.show()
                                    } catch (err) {
                                        console.log(err)
                                    }
                                }
                            })(foundStart, line)
                        })

                        if (ln.height > 0) {
                            cm.foldCode(foundStart)
                        }
                        break;
                    }
                }
                found = null
            }
        })
    }

    drawio.addMarker = function ({ kind, from, to, text, action }) {

        const markerElm = document.createElement('span')
        markerElm.appendChild(document.createTextNode(text))
        markerElm.className = 'CodeMirror-buttonmarker'
        markerElm.addEventListener('click', action)

        var cm = window.editor.cm;
        cm.markText(from, to, { replacedWith: markerElm, __kind: kind })
    }

    drawio.show = function () {

        const drawUrl = 'https://embed.diagrams.net/?embed=1&libraries=1&proto=json&spin=1&saveAndExit=1&noSaveBtn=1&noExitBtn=0'; // TODO: with Tomcat & https://github.com/jgraph/drawio
        this.div = document.createElement('div');
        this.div.id = 'diagram';
        this.gXml = '';
        this.div.innerHTML = '';
        this.iframe = document.createElement('iframe');
        this.iframe.setAttribute('frameborder', '0');
        this.iframe.style.zIndex = 9999;
        this.iframe.style.width = "100%";
        this.iframe.style.height = "100%";
        this.iframe.style.position = "absolute";
        this.iframe.style.top = window.scrollY + "px";
        binded = this.postMessage.bind(this);
        window.addEventListener("message", binded, false);
        this.iframe.setAttribute('src', drawUrl);
        document.body.appendChild(this.iframe);
    }

    drawio.postMessage = function (evt) {
        if (evt.data.length < 1) return
        var msg = JSON.parse(evt.data)
        var svg = '';

        switch (msg.event) {
            case "configure":
                this.iframe.contentWindow.postMessage(
                    JSON.stringify({
                        action: "configure",
                        config: {
                            defaultFonts: ["Humor Sans", "Helvetica", "Times New Roman"],
                        },
                    }),
                    "*"
                );
                break;
            case "init":
                code = window.sessionStorage.getItem("drawio")
                svg = decodeURIComponent(escape(window.atob(code)))
                this.iframe.contentWindow.postMessage(
                    JSON.stringify({ action: "load", autosave: 1, xml: svg }),
                    "*"
                );
                break;
            case "autosave":
                window.sessionStorage.setItem("drawio", svg);
                break;
            case "save":
                this.iframe.contentWindow.postMessage(
                    JSON.stringify({
                        action: "export",
                        format: "xmlsvg",
                        xml: msg.xml,
                        spin: "Updating page",
                    }),
                    "*"
                );
                break;
            case "export":
                svgData = msg.data.substring(msg.data.indexOf(',') + 1);
                // clean event bind
                window.removeEventListener("message", this.binded);
                document.body.removeChild(this.iframe);

                // write back svg data
                var cm = window.editor.cm;
                cm.doc.replaceSelection('```drawio\n' + svgData + '\n```', 'start')
                // clean state data
                window.sessionStorage.setItem("drawio", '');
                break;
            case "exit":
                window.removeEventListener("message", this.binded);
                document.body.removeChild(this.iframe);
                break;
        }
    }

    window.editormdLocales = {
        'zh-CN': {
            placeholder: '本编辑器支持 Markdown 编辑，左边编写，右边预览。',
            contentUnsaved: '编辑内容未保存，需要保存吗？',
            noDocNeedPublish: '没有需要发布的文档',
            loadDocFailed: '文档加载失败',
            fetchDocFailed: '获取当前文档信息失败',
            cannotAddToEmptyNode: '空节点不能添加内容',
            overrideModified: '文档已被其他人修改确定覆盖已存在的文档吗？',
            confirm: '确定',
            cancel: '取消',
            contentsNameEmpty: '目录名称不能为空',
            addDoc: '添加文档',
            edit: '编辑',
            delete: '删除',
            loadFailed: '加载失败请重试',
            tplNameEmpty: '模板名称不能为空',
            tplContentEmpty: '模板内容不能为空',
            saveSucc: '保存成功',
            serverExcept: '服务器异常',
            paramName: '参数名称',
            paramType: '参数类型',
            example: '示例值',
            remark: '备注',
        },
        'en': {
            placeholder: 'This editor supports Markdown editing, writing on the left and previewing on the right.',
            contentUnsaved: 'The edited content is not saved, need to save it?',
            noDocNeedPublish: 'No Document need to be publish',
            loadDocFailed: 'Load Document failed',
            fetchDocFailed: 'Fetch Document info failed',
            cannotAddToEmptyNode: 'Cannot add content to empty node',
            overrideModified: 'The document has been modified by someone else, are you sure to overwrite the document?',
            confirm: 'Confirm',
            cancel: 'Cancel',
            contentsNameEmpty: 'Document Name cannot be empty',
            addDoc: 'Add Document',
            edit: 'Edit',
            delete: 'Delete',
            loadFailed: 'Failed to load, please try again',
            tplNameEmpty: 'Template name cannot be empty',
            tplContentEmpty: 'Template content cannot be empty',
            saveSucc: 'Save success',
            serverExcept: 'Server Exception',
            paramName: 'Parameter',
            paramType: 'Type',
            example: 'Example',
            remark: 'Remark',
        }
    };
    var htmlDecodeList = ["style", "script", "title", "onmouseover", "onmouseout", "style"];
    if (!window.IS_ENABLE_IFRAME) {
        htmlDecodeList.unshift("iframe");
    }
    var activeEditorLocale = window.editormdLocales[window.lang] || window.editormdLocales["zh-CN"] || window.editormdLocales.en || {};
    window.editor = editormd("docEditor", {
        width: "100%",
        height: "100%",
        path: window.editormdLib,
        toolbar: true,
        placeholder: activeEditorLocale.placeholder || "",
        imageUpload: true,
        imageFormats: ["jpg", "jpeg", "gif", "png", "svg", "JPG", "JPEG", "GIF", "PNG", "SVG"],
        imageUploadURL: window.imageUploadURL,
        toolbarModes: "full",
        fileUpload: true,
        fileUploadURL: window.fileUploadURL,
        taskList: true,
        emoji: false,
        flowChart: false,
        htmlDecode: htmlDecodeList.join(','),
        lineNumbers: true,
        sequenceDiagram: false,
        tocStartLevel: 1,
        tocm: true,
        previewCodeHighlight: 1,
        highlightStyle: window.highlightStyle ? window.highlightStyle : "github",
        tex: true,
        saveHTMLToTextarea: true,
        codeFold: true,

        onload: function() {
            this.registerHelper()
            this.hideToolbar();
            var keyMap = {
                "Ctrl-S": function (cm) {
                    saveDocument(false);
                },
                "Cmd-S": function (cm) {
                    saveDocument(false);
                },
                "Ctrl-A": function (cm) {
                    cm.execCommand("selectAll");
                },
                "Enter": function (cm) {
                    if (insertMarkdownTableRow(cm)) {
                        return;
                    }
                    var pass = getCodeMirrorPass(cm);
                    if (pass) {
                        return pass;
                    }
                    cm.execCommand("newlineAndIndent");
                }
            };
            this.addKeyMap(keyMap);

            //如果没有选中节点则选中默认节点
            openLastSelectedNode();
            uploadResource("docEditor", function ($state, $res) {
                if ($state === "before") {
                    return layer.load(1, {
                        shade: [0.1, '#fff'] // 0.1 透明度的白色背景
                    });
                } else if ($state === "success") {
                    if ($res.errcode === 0) {
                        if ($res.resource_type === 'video') {
                            let value = `<video controls><source src="${$res.url}" type="video/mp4"></video>`;
                            window.editor.insertValue(value);
                        } else {
                            let value = '![](' + $res.url + ')';
                            window.editor.insertValue(value);
                        }
                    } else {
                        layer.msg("上传失败：" + $res.message);
                    }
                }
            });

            window.isLoad = true;
            this.tableEditor = TableEditor.initTableEditor(this.cm)
        },
        onchange: function () {
            /**
             * 实现画图的事件注入
             * 
             * 1. 分析文本，添加点击编辑事件，processMarkers
             * 2. 获取内容，存储状态数据
             * 3. 打开编辑画面
             * 4. 推出触发变更事件，并回写数据
             */

            var cm = window.editor.cm;
            drawio.processMarkers(cm.firstLine(), cm.lastLine() + 1)

            resetEditorChanged(true);
        }
    });

    editormd.fn.registerHelper = function () {

        const maxDepth = 100
        const codeBlockStartMatch = /^`{3}[a-zA-Z0-9]+$/
        const codeBlockEndMatch = /^`{3}$/


        editormd.$CodeMirror.registerHelper('fold', 'markdown', function (cm, start) {
            const firstLine = cm.getLine(start.line)
            const lastLineNo = cm.lastLine()
            let end

            function isHeader(lineNo) {
                const tokentype = cm.getTokenTypeAt(CodeMirror.Pos(lineNo, 0))
                return tokentype && /\bheader\b/.test(tokentype)
            }

            function headerLevel(lineNo, line, nextLine) {
                let match = line && line.match(/^#+/)
                if (match && isHeader(lineNo)) return match[0].length
                match = nextLine && nextLine.match(/^[=-]+\s*$/)
                if (match && isHeader(lineNo + 1)) return nextLine[0] === '=' ? 1 : 2
                return maxDepth
            }

            // -> CODE BLOCK

            if (codeBlockStartMatch.test(cm.getLine(start.line))) {
                end = start.line
                let nextNextLine = cm.getLine(end + 1)
                while (end < lastLineNo) {
                    if (codeBlockEndMatch.test(nextNextLine)) {
                        end++
                        break
                    }
                    end++
                    nextNextLine = cm.getLine(end + 1)
                }
            } else {
                // -> HEADER

                let nextLine = cm.getLine(start.line + 1)
                const level = headerLevel(start.line, firstLine, nextLine)
                if (level === maxDepth) return undefined

                end = start.line
                let nextNextLine = cm.getLine(end + 2)
                while (end < lastLineNo) {
                    if (headerLevel(end + 1, nextLine, nextNextLine) <= level) break
                    ++end
                    nextLine = nextNextLine
                    nextNextLine = cm.getLine(end + 2)
                }
            }

            return {
                from: CodeMirror.Pos(start.line, firstLine.length),
                to: CodeMirror.Pos(end, cm.getLine(end).length)
            }
        })
    }

    function insertToMarkdown(body) {
        window.isLoad = true;
        window.editor.insertValue(body);
        window.editor.setCursor({ line: 0, ch: 0 });
        resetEditorChanged(true);
    }
    function insertAndClearToMarkdown(body) {
        window.isLoad = true;
        window.editor.clear();
        window.editor.insertValue(body);
        window.editor.setCursor({ line: 0, ch: 0 });
        resetEditorChanged(true);
    }

    /**
     * 实现标题栏操作
     */
    $("#editormd-tools").on("click", "a[class!='disabled']", function () {
        var name = $(this).find("i").attr("name");
        if (name === "attachment") {
            $("#uploadAttachModal").modal("show");
        } else if (name === "history") {
            window.documentHistory();
        } else if (name === "save") {
            saveDocument(false);
        } else if (name === "template") {
            $("#documentTemplateModal").modal("show");
        } else if (name === "save-template") {
            $("#saveTemplateModal").modal("show");
        } else if (name === 'json') {
            $("#convertJsonToTableModal").modal("show");
        } else if (name === "sidebar") {
            $("#manualCategory").toggle(0, "swing", function () {
                var $then = $("#manualEditorContainer");
                var left = parseInt($then.css("left"));
                if (left > 0) {
                    window.editorContainerLeft = left;
                    $then.css("left", "0");
                } else {
                    $then.css("left", window.editorContainerLeft + "px");
                }
                window.editor.resize();
            });
        } else if (name === "release") {
            if (Object.prototype.toString.call(window.documentCategory) === '[object Array]' && window.documentCategory.length > 0) {
                if ($("#markdown-save").hasClass('change')) {
                    var confirm_result = confirm(getMinDocActiveEditormdLocale().contentUnsaved);
                    if (confirm_result) {
                        saveDocument(false, releaseBook);
                        return;
                    }
                }

                releaseBook();
            } else {
                layer.msg(getMinDocActiveEditormdLocale().noDocNeedPublish)
            }
        } else if (name === "tasks") {
            // 插入 GFM 任务列表
            var cm = window.editor.cm;
            var selection = cm.getSelection();
            var cursor = cm.getCursor();
            if (selection === "") {
                cm.setCursor(cursor.line, 0);
                cm.replaceSelection("- [x] " + selection);
                cm.setCursor(cursor.line, cursor.ch + 6);
            } else {
                var selectionText = selection.split("\n");

                for (var i = 0, len = selectionText.length; i < len; i++) {
                    selectionText[i] = (selectionText[i] === "") ? "" : "- [x] " + selectionText[i];
                }
                cm.replaceSelection(selectionText.join("\n"));
            }
        } else if (name === "drawio") {
            /**
             * TODO: 画图功能实现
             * 
             * 1. 获取光标处数据，存储数据
             * 2. 打开画图页面，初始化数据（获取数据）
             */
            window.sessionStorage.setItem("drawio", '');

            var cm = window.editor.cm;
            const selStartLine = cm.getCursor('from').line
            const selEndLine = cm.getCursor('to').line + 1

            drawio.processMarkers(selStartLine, selEndLine)
            drawio.show()
        } else if (name === 'wordToContent') {
            let converter = new WordToHtmlConverter();
            converter.handleFileSelect(function (response) {
                if (response.messages.length) {
                    let messages = response.messages.map((item)=>{
                        return item.message + "<br/>";
                    }).join('\n');
                    layer.msg(messages);
                }
                converter.replaceHtmlBase64(response.value).then((html)=>{
                    let cm = window.editor.cm;
                    cm.replaceSelection(html);
                });
            })
        } else if (name === 'htmlToMarkdown') {
            let converter = new HtmlToMarkdownConverter();
            converter.handleFileSelect(function (response) {
                let cm = window.editor.cm;
                cm.replaceSelection(response);
            })
        } else {
            var action = window.editor.toolbarHandlers[name];

            if (!!action && action !== "undefined") {
                $.proxy(action, window.editor)();
                window.editor.focus();
            }
        }
    });

    /***
     * 加载指定的文档到编辑器中
     * @param $node
     */
    window.loadDocument = function ($node) {
        var index = layer.load(1, {
            shade: [0.1, '#fff'] // 0.1 透明度的白色背景
        });

        $.get(window.editURL + $node.node.id).done(function (res) {
            layer.close(index);

            if (res.errcode === 0) {
                window.isLoad = true;
                try {
                    window.editor.clear();
                    window.editor.insertValue(res.data.markdown);
                    window.editor.setCursor({ line: 0, ch: 0 });
                } catch (e) {
                    console.log(e);
                }
                var node = { "id": res.data.doc_id, 'parent': res.data.parent_id === 0 ? '#' : res.data.parent_id, "text": res.data.doc_name, "identify": res.data.identify, "version": res.data.version };
                pushDocumentCategory(node);
                window.selectNode = node;
                // 更新浏览器地址栏和预览链接
                var docIdentify = res.data.identify;
                if (docIdentify && window.history) {
                    var editBase = window.editURL.replace(/\/content\/$/, '/edit/');
                    var newURL = editBase + docIdentify;
                    if (window._initialDocLoaded) {
                        history.pushState({ docId: res.data.doc_id }, res.data.doc_name, newURL);
                    } else {
                        history.replaceState({ docId: res.data.doc_id }, res.data.doc_name, newURL);
                        window._initialDocLoaded = true;
                    }
                    var readBase = window.editURL.replace(/\/api\/([^/]+)\/content\/$/, '/docs/$1/');
                    $('a:has(i[name="preview-open"])').attr('href', readBase + docIdentify);
                }
                pushVueLists(res.data.attach);
                setLastSelectNode($node);
            } else {
                layer.msg(getMinDocActiveEditormdLocale().loadDocFailed);
            }
        }).fail(function () {
            layer.close(index);
            layer.msg(getMinDocActiveEditormdLocale().loadDocFailed);
        });
    };

    /**
     * 保存文档到服务器
     * @param $is_cover 是否强制覆盖
     */
    function saveDocument($is_cover, callback) {
        var index = null;
        var node = window.selectNode;
        var content = window.editor.getMarkdown();
        var html = window.editor.getPreviewedHTML();
        var version = "";

        if (!node) {
            layer.msg(getMinDocActiveEditormdLocale().fetchDocFailed);
            return;
        }
        if (node.a_attr && node.a_attr.disabled) {
            layer.msg(getMinDocActiveEditormdLocale().cannotAddToEmptyNode);
            return;
        }

        var doc_id = parseInt(node.id);

        for (var i in window.documentCategory) {
            var item = window.documentCategory[i];

            if (item.id === doc_id) {
                version = item.version;
                break;
            }
        }
        $.ajax({
            beforeSend: function () {
                index = layer.load(1, { shade: [0.1, '#fff'] });
                window.saveing = true;
            },
            url: window.editURL,
            data: { "identify": window.book.identify, "doc_id": doc_id, "markdown": content, "html": html, "cover": $is_cover ? "yes" : "no", "version": version },
            type: "post",
            timeout: 30000,
            dataType: "json",
            success: function (res) {
                if (res.errcode === 0) {
                    resetEditorChanged(false);
                    for (var i in window.documentCategory) {
                        var item = window.documentCategory[i];

                        if (item.id === doc_id) {
                            window.documentCategory[i].version = res.data.version;
                            break;
                        }
                    }
                    $.each(window.documentCategory, function (i, item) {
                        var $item = window.documentCategory[i];

                        if (item.id === doc_id) {
                            window.documentCategory[i].version = res.data.version;
                        }
                    });
                    if (typeof callback === "function") {
                        callback();
                    }

                } else if (res.errcode === 6005) {
                    var confirmIndex = layer.confirm(getMinDocActiveEditormdLocale().overrideModified, {
                        btn: [getMinDocActiveEditormdLocale().confirm, getMinDocActiveEditormdLocale().cancel] // 按钮
                    }, function () {
                        layer.close(confirmIndex);
                        saveDocument(true, callback);
                    });
                } else {
                    layer.msg(res.message);
                }
            },
            error: function (XMLHttpRequest, textStatus, errorThrown) {
                layer.msg(activeEditorLocale.serverExcept + errorThrown);
            },
            complete: function () {
                layer.close(index);
                window.saveing = false;
            }
        });
    }


    /**
     * 设置编辑器变更状态
     * @param $is_change
     */
    function resetEditorChanged($is_change) {
        if ($is_change && !window.isLoad) {
            $("#markdown-save").removeClass('disabled').addClass('change');
        } else {
            $("#markdown-save").removeClass('change').addClass('disabled');
        }
        window.isLoad = false;
    }

    /**
     * 添加文档
     */
    $("#addDocumentForm").ajaxForm({
        beforeSubmit: function () {
            var doc_name = $.trim($("#documentName").val());
            if (doc_name === "") {
                return showError(getMinDocActiveEditormdLocale().contentsNameEmpty, "#add-error-message")
            }
            $("#btnSaveDocument").button("loading");
            return true;
        },
        success: function (res) {
            if (res.errcode === 0) {
                var data = {
                    "id": res.data.doc_id,
                    'parent': res.data.parent_id === 0 ? '#' : res.data.parent_id,
                    "text": res.data.doc_name,
                    "identify": res.data.identify,
                    "version": res.data.version,
                    state: { opened: res.data.is_open == 1 },
                    a_attr: { is_open: res.data.is_open == 1, href: window.editURL.replace(/\/content\/$/, '/edit/') + res.data.identify }
                };

                var node = window.treeCatalog.get_node(data.id);
                if (node) {
                    window.treeCatalog.rename_node({ "id": data.id }, data.text);
                    $("#sidebar").jstree(true).get_node(data.id).a_attr.is_open = data.state.opened;
                } else {
                    window.treeCatalog.create_node(data.parent, data);
                    window.treeCatalog.deselect_all();
                    window.treeCatalog.select_node(data);
                }
                pushDocumentCategory(data);
                $("#markdown-save").removeClass('change').addClass('disabled');
                $("#addDocumentModal").modal('hide');
            } else {
                showError(res.message, "#add-error-message");
            }
            $("#btnSaveDocument").button("reset");
        }
    });

    /**
     * 文档目录树
     */
    // 为目录树节点注入 href，使鼠标悬浮时浏览器状态栏显示对应编辑 URL
    (function () {
        var editBase = window.editURL.replace(/\/content\/$/, '/edit/');
        window.documentCategory.forEach(function (item) {
            if (item.identify && !(item.a_attr && item.a_attr.disabled)) {
                if (!item.a_attr) item.a_attr = {};
                item.a_attr.href = editBase + item.identify;
            }
        });
    }());
    $("#sidebar").jstree({
        'plugins': ["wholerow", "types", 'dnd', 'contextmenu'],
        "types": {
            "default": {
                "icon": false  // 删除默认图标
            }
        },
        'core': {
            'check_callback': true,
            "multiple": false,
            'animation': 0,
            "data": window.documentCategory
        },
        "contextmenu": {
            show_at_node: false,
            select_node: false,
            "items": {
                "添加文档": {
                    "separator_before": false,
                    "separator_after": true,
                    "_disabled": false,
                    "label": activeEditorLocale.addDoc,//"添加文档",
                    "icon": "fa fa-plus",
                    "action": function (data) {
                        var inst = $.jstree.reference(data.reference),
                            node = inst.get_node(data.reference);

                        openCreateCatalogDialog(node);
                    }
                },
                "编辑": {
                    "separator_before": false,
                    "separator_after": true,
                    "_disabled": false,
                    "label": activeEditorLocale.edit,
                    "icon": "fa fa-edit",
                    "action": function (data) {
                        var inst = $.jstree.reference(data.reference);
                        var node = inst.get_node(data.reference);
                        openEditCatalogDialog(node);
                    }
                },
                "删除": {
                    "separator_before": false,
                    "separator_after": true,
                    "_disabled": false,
                    "label": activeEditorLocale.delete,
                    "icon": "fa fa-trash-o",
                    "action": function (data) {
                        var inst = $.jstree.reference(data.reference);
                        var node = inst.get_node(data.reference);
                        openDeleteDocumentDialog(node);
                    }
                }
            }
        }
    }).on("ready.jstree", function () {
        window.treeCatalog = $("#sidebar").jstree(true);

        //如果没有选中节点则选中默认节点
        // openLastSelectedNode();
    }).on('select_node.jstree', function (node, selected) {

        if ($("#markdown-save").hasClass('change')) {
            if (confirm(activeEditorLocale.contentUnsaved)) {
                saveDocument(false, function () {
                    loadDocument(selected);
                });
                return true;
            }
        }
        //如果是空目录则直接出发展开下一级功能
        if (selected.node.a_attr && selected.node.a_attr.disabled) {
            selected.instance.toggle_node(selected.node);
            return false
        }


        loadDocument(selected);
    }).on("move_node.jstree", jstree_save).on("delete_node.jstree", function ($node, $parent) {
        openLastSelectedNode();
    });
    /**
     * 打开文档模板
     */
    $("#documentTemplateModal").on("click", ".section>a[data-type]", function () {
        var $this = $(this).attr("data-type");
        if ($this === "customs") {
            $("#displayCustomsTemplateModal").modal("show");
            return;
        }
        var body = $("#template-" + $this).html();
        if (body) {
            window.isLoad = true;
            window.editor.clear();
            window.editor.insertValue(body);
            window.editor.setCursor({ line: 0, ch: 0 });
            resetEditorChanged(true);
        }
        $("#documentTemplateModal").modal('hide');
    });
    /**
     * 展示自定义模板列表
     */
    $("#displayCustomsTemplateModal").on("show.bs.modal", function () {
        window.sessionStorage.setItem("displayCustomsTemplateList", $("#displayCustomsTemplateList").html());

        var index;
        $.ajax({
            beforeSend: function () {
                index = layer.load(1, { shade: [0.1, '#fff'] });
            },
            url: window.template.listUrl,
            data: { "identify": window.book.identify },
            type: "POST",
            dataType: "html",
            success: function ($res) {
                $("#displayCustomsTemplateList").html($res);
            },
            error: function () {
                layer.msg(activeEditorLocale.loadFailed);
            },
            complete: function () {
                layer.close(index);
            }
        });
        $("#documentTemplateModal").modal("hide");
    }).on("hidden.bs.modal", function () {
        var cache = window.sessionStorage.getItem("displayCustomsTemplateList");
        $("#displayCustomsTemplateList").html(cache);
    });
    /**
     * 添加模板
     */
    $("#saveTemplateForm").ajaxForm({
        beforeSubmit: function () {
            var doc_name = $.trim($("#templateName").val());
            if (doc_name === "") {
                return showError(activeEditorLocale.tplNameEmpty, "#saveTemplateForm .show-error-message");
            }
            var content = $("#saveTemplateForm").find("input[name='content']").val();
            if (content === "") {
                return showError(activeEditorLocale.tplContentEmpty, "#saveTemplateForm .show-error-message");
            }

            $("#btnSaveTemplate").button("loading");

            return true;
        },
        success: function ($res) {
            if ($res.errcode === 0) {
                $("#saveTemplateModal").modal("hide");
                layer.msg(activeEditorLocale.saveSucc);
            } else {
                return showError($res.message, "#saveTemplateForm .show-error-message");
            }
        },
        complete: function () {
            $("#btnSaveTemplate").button("reset");
        }
    });
    /**
     * 当添加模板弹窗事件发生
     */
    $("#saveTemplateModal").on("show.bs.modal", function () {
        window.sessionStorage.setItem("saveTemplateModal", $(this).find(".modal-body").html());
        var content = window.editor.getMarkdown();
        $("#saveTemplateForm").find("input[name='content']").val(content);
        $("#saveTemplateForm .show-error-message").html("");
    }).on("hidden.bs.modal", function () {
        $(this).find(".modal-body").html(window.sessionStorage.getItem("saveTemplateModal"));
    });
    /**
     * 插入自定义模板内容
     */
    $("#displayCustomsTemplateList").on("click", ".btn-insert", function () {
        var templateId = $(this).attr("data-id");

        $.ajax({
            url: window.template.getUrl,
            data: { "identify": window.book.identify, "template_id": templateId },
            dataType: "json",
            type: "get",
            success: function ($res) {
                if ($res.errcode !== 0) {
                    layer.msg($res.message);
                    return;
                }
                window.isLoad = true;
                window.editor.clear();
                window.editor.insertValue($res.data.template_content);
                window.editor.setCursor({ line: 0, ch: 0 });
                resetEditorChanged(true);
                $("#displayCustomsTemplateModal").modal("hide");
            }, error: function () {
                layer.msg(activeEditorLocale.serverExcept);
            }
        });
    }).on("click", ".btn-delete", function () {
        var $then = $(this);
        var templateId = $then.attr("data-id");
        $then.button("loading");

        $.ajax({
            url: window.template.deleteUrl,
            data: { "identify": window.book.identify, "template_id": templateId },
            dataType: "json",
            type: "post",
            success: function ($res) {
                if ($res.errcode !== 0) {
                    layer.msg($res.message);
                } else {
                    $then.parents("tr").empty().remove();
                }
            }, error: function () {
                layer.msg(activeEditorLocale.serverExcept);
            },
            complete: function () {
                $then.button("reset");
            }
        })
    });

    $("#btnInsertTable").on("click", function () {
        var content = $("#jsonContent").val();
        if (content !== "") {
            try {
                var jsonObj = $.parseJSON(content);
                var data = foreachJson(jsonObj, "");
                var table = "| " + activeEditorLocale.paramName
                    + "  | " + activeEditorLocale.paramType
                    + " | " + activeEditorLocale.example
                    + "  |  " + activeEditorLocale.remark
                    + " |\n| ------------ | ------------ | ------------ | ------------ |\n";
                $.each(data, function (i, item) {
                    table += "|" + item.key + "|" + item.type + "|" + item.value + "| |\n";
                });
                insertToMarkdown(table);
            } catch (e) {
                showError("Json 格式错误:" + e.toString(), "#json-error-message");
                return;
            }
        }
        $("#convertJsonToTableModal").modal("hide");
    });
    $("#convertJsonToTableModal").on("hidden.bs.modal", function () {
        $("#jsonContent").val("");
    }).on("shown.bs.modal", function () {
        $("#jsonContent").focus();
    });
});
