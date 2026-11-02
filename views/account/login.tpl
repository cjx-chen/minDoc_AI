<!DOCTYPE html>
<html lang="zh-cn">
<head>
    <meta charset="utf-8">
    <link rel="shortcut icon" href="{{cdnimg "/static/favicon.ico"}}">
    <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1" />
    <meta name="renderer" content="webkit" />
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="author" content="MinDoc" />
    <title>{{i18n .Lang "common.login"}} - Powered by MinDoc</title>
    <meta name="keywords" content="MinDoc,文档在线管理系统,WIKI,wiki,wiki在线,文档在线管理,接口文档在线管理,接口文档管理">
    <meta name="description" content="MinDoc文档在线管理系统 {{.site_description}}">
    <!-- Bootstrap -->
    <link href="{{cdncss "/static/bootstrap/css/bootstrap.min.css"}}" rel="stylesheet">
    <link href="{{cdncss "/static/font-awesome/css/font-awesome.min.css"}}" rel="stylesheet">
    <link href="{{cdncss "/static/css/main.css" "version"}}" rel="stylesheet">
    <link href="{{cdncss "/static/css/mindoc-ui.css" "version"}}" rel="stylesheet">
    <!-- jQuery (necessary for Bootstrap's JavaScript plugins) -->
    <script src="{{cdnjs "/static/jquery/1.12.4/jquery.min.js"}}"></script>
</head>
<body class="ui-login-page">
<div class="ui-login-shell">
    <div class="ui-login-card">
        <aside class="ui-login-brand">
            <div class="brand-row">知识管理</div>
            <h1>让知识<br>随时触手可及</h1>
            <p>汇聚项目文档与经验，支持全文检索与 AI 智能问答，登录后即可开始探索。</p>
            <div class="ui-doc-stack" aria-hidden="true">
                <div class="doc doc-1"></div>
                <div class="doc doc-2"></div>
                <div class="doc doc-3"><span class="bookmark"></span></div>
            </div>
        </aside>
        <main class="ui-login-main">
            <h2>{{i18n .Lang "common.login"}}</h2>
            <p class="login-sub">使用域账号登录知识管理平台</p>
            <form role="form" method="post">
            {{ .xsrfdata }}
                <div class="form-group">
                    <div class="input-group">
                        <div class="input-group-addon">
                            <i class="fa fa-user"></i>
                        </div>
                        <input type="text" class="form-control" placeholder="域用户" name="account" id="account" autocomplete="off">
                    </div>
                </div>
                <div class="form-group">
                    <div class="input-group">
                        <div class="input-group-addon">
                            <i class="fa fa-lock"></i>
                        </div>
                        <input type="password" class="form-control" placeholder="域密码" name="password" id="password" autocomplete="off">
                    </div>
                </div>
                {{if .ShowLoginCaptcha}}
                <div class="form-group">
                    <div class="captcha-row">
                        <div class="input-group">
                            <div class="input-group-addon">
                                <i class="fa fa-check-square"></i>
                            </div>
                            <input type="text" name="code" id="code" class="form-control" maxlength="5" placeholder="{{i18n .Lang "common.captcha"}}" autocomplete="off">
                        </div>
                        <img id="captcha-img" src="{{urlfor "AccountController.Captcha"}}" onclick="this.src='{{urlfor "AccountController.Captcha"}}?key=login&t='+(new Date()).getTime();" title={{i18n .Lang "message.click_to_change"}}>
                    </div>
                </div>
                {{end}}
                <div class="login-options">
                    <div class="checkbox">
                        <label>
                            <input type="checkbox" name="is_remember" value="yes"> {{i18n .Lang "common.keep_login"}}
                        </label>
                    </div>
                    {{if .ShowForgotPassword}}
                    <a href="{{urlfor "AccountController.FindPassword" }}">{{i18n .Lang "common.forgot_password"}}</a>
                    {{end}}
                </div>
                <div class="form-group">
                    <button type="button" id="btn-login" class="btn btn-success" style="width: 100%"  data-loading-text="{{i18n .Lang "message.logging_in"}}" autocomplete="off">{{i18n .Lang "common.login"}}</button>
                </div>
                {{if .ENABLED_REGISTER}}
                    {{if ne .ENABLED_REGISTER "false"}}
                        <div class="register-link">
                            {{i18n .Lang "message.no_account_yet"}} <a href="{{urlfor "AccountController.Register" }}" title={{i18n .Lang "common.register"}}>{{i18n .Lang "common.register"}}</a>
                        </div>
                    {{end}}
                {{end}}
                {{if .ShowThirdPartyLogin}}
                <div class="third-party">
                    <div class="line">
                        <span class="text">{{i18n .Lang "common.third_party_login"}}</span>
                    </div>
                    <div class="icon-box">
                        <div class="icon {{ if .CanLoginDingTalk }}btn-success{{else}}icon-disable{{end}}" title="{{i18n .Lang "common.dingtalk_login"}}" data-url="{{ .dingtalk_login_url }}">
                            <img alt="{{i18n .Lang "common.dingtalk_login"}}" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAAAXNSR0IArs4c6QAAA9hJREFUaEPNmVvoZ1MUxz/fPOBR8uJBya0QXmRqhsZtasq4xQMP7h5GyiR5MIkHlOQBDyaEcmvGrTBCYjDuKbmUW3jyQF7kEsrSd9pHx+9/fufss8/5/85v1e7/6/9ba+31OXutfdbeP9EgEfE6cChwN3CXpL+a9Jbhf2oBWJ+++wN42DCSvliGoOsx5ADU9R8zjKRXlwWkL0AV905gO7BD0p9TwswDuAG4NSOwrxPIdkmfZeiPrjIP4Fjg456z7TCMpGd62g1SbwSwx4h4DzihwLvBnV6G+a7AvpdJG8BW4JZe3v6v/HsN5OUBflpN2wCOBj4daeLdLvi0Kj+O5HOPm7kAKY2eAzaNOOHPgH3uGZL+Geq7C8AvM7+VV0O8gxnkeUlvlE7QCpBW4QrgYmBd6SQZdh8ATwFPSvo+Q/8/lU6ASjMizksgZ/SZoKfub4ZIIC/m2GYD1ECOAs5MY03OJIU6HwIPSLqvzb6rBo4A3MB9A3wOvAXslvR+Sq8TU5EbyLqrIR8BWyR5J1shnSsQEd8CBzfYurhdfIbyOBXYmMZhq0CyTtLbs35zAO4HXMg58mgqRgPdNDKMt92zSgAuAB7Pib5B5wfAUG7Dz01Qha7YJenk3gAp118BTi+deSS7OyVdVwrg4A0xpWyU9FIRQFqFmwemwBD4JyRdWLQL1Y0iYiqINdXWXbwClWFEXAVcCxwy5JH2sPWtyJZ5+p3baJNhRBwAHAfsm8Y+M3/3ArwD1Yfb876NoVtvP/25B6MigJm02h/wEdTDUNXnHg95rupWSbe1OSoGSPVwDnDMGJE2+PAlgZ++G7y5MgTAbUNWx1gIeJmkh7psiwHS1upj4vldkxR8/7Qkt++dMghglSB+AU6R5C60UwYDJIgx3w83Ssq+DRkFIEG4oO9oeT/8BPhK0nXj1GuSN4HTJP3d+eiTwmgACWI/YENq/KoXnS/IdlYHkogw5IqmLMWzSdILucFbb1SAnIkjwoegkxp0d82zb2qjK92FAkTEQcCXgN/cOfIrcHzb7xKLBvDW6FuHXLlI0iNtyosGuB24PjN6/yJ0TZfuogFeA1YcCxuCfEfS2q7gF1rEEXE4cGBDUN5W3dVW4rxfK+mTpQJoCiYiLgFm+53LJT2YE/xCV2AOgG/drqx9d68kH5iyZaE1MBtVRLhl9lWlJTvv634mA4iII9N1peNx3q/PbeCWBeBq4J4UzGZJ27LzpqY45Qo8C5wNbJO0uST4SYs4ItydfpVSJ7v7nAWdZAVST+Tr+g2S3i19+pOtQERcCuxdmveTF3FEeL8vzvs6wL8iyC9AZnHsagAAAABJRU5ErkJggg==">
                        </div>
                        <div class="icon {{ if .CanLoginWorkWeixin }}btn-success{{else}}icon-disable{{end}}" title="{{i18n .Lang "common.wecom_login"}}" data-url="{{ .workweixin_login_url }}">
                            <img alt="{{i18n .Lang "common.wecom_login"}}" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAAAXNSR0IArs4c6QAABE9JREFUaEPtmVvIpWMUx3//IkkYhgkXTBiFHEPjVCYXJscJMyOHMEUZN0NOuWEuJCPHhBnqk0MuhmYaoswFQoYoTAqNHBqH0IyRK9Jfa/e80/u93/vt5917v/vb31ez6m1fPOv0f9Z6nrWetcUMJ81w/xkIgO3DgTOBY4H9St8fwPfAD+l3o6T/hrFZPQOwfSFwMXBGcryJX/8CLwFvAgFmexOhJjyNASTHbwQuaqK4C8/PwDPAakm/DKgrn0K25wKPAIsGNVaRL4DcJyki1Bd1jYDt84ExYE5f2psJvQ8s6TcakwKwfTuwqpkPA3NtAxZI+qJXTbUAbJ8DvN2rshb4T5H0aS96JgCwfRTwdS9KWuY9UFJcw41oHADbewMbgIjAqGiDpEuaGq8CeBK4qanwEPlWSHqsif6dAGwfCsQh2reJ4JB5vgPmS/otZ6cM4C7g/pzAFK4vl/RUzl4ZQOz+cTmBKVx/VdLlOXsdACl9ovGaTrRd0v45hwoAZwHv5ZhHsD5L0o5udgsAV6ZucQQ+djU5T9KWJgCmwwF+AViTimg0d1GLfpW0qQmA61LTNqoIrJW0pB/jRQqdCnzcj4IWZDZLOj5dJvsApwOHAW9JilddVyoA7AX8CeyWExjC+kpJ9yYAH6SXXmHmaElfZVMoCX8GnDAEB3Mqo41+x/bVQJyDMq2TdGlTALEL9+SsDWG9ABAvvnUV/f8AR0jaOpndciU+GPgEOGQITtapjPy+W9LLKQNmRd4DcR7LdK2k57MAkpKpiMJK4MP4JP2V7M4HFsZZsB1ZsLg08YhrNNZqC1q1nR5mFOIwLpI07rFk+/o0NFgj6Y5ip20HiOWpHoxJWlYXhboX2Q2poLSZSTskRYp0yHZcm2enbynwmqSYNU0g20VWzJH0e5VhsjfxQ8CtLSJYJmnM9pHAw5XZUgy5TuvWMqRmMyYj8eA6Js2V3pW0vttU4nXgghZAbJIUxSl2vu6MNWqbbb8IXFXyp6O3G4DYrY1ADLYGoS2S5iUAMemovrezDxfbJwNPAF8CjwPfRCXOAIih8MISz0fA05KeywGI+zru6DZoD0lRWceRbadOOEBOuOttr0jX7OfA+phwSwoAHcoBiOnxQTXeB7ComnsCB6RvduV3MxDft0C0AlslvVEDoHAwClZEJhzspJTtE9OEcG2q2hMGXjkAsTtlioP0gKRQ2BrZXg3E6D4onI+UCTC7A+cW3WqdwRyA4tYIx6NSxoupdUr/9ESlDlocL+htYWhe1sgM5APHAmNvP1LhXlLZfAS6ryD0rKTqDSanxPzS9OtQrv+1rgGrXuUrSnTMCQDq05bMQF8ViST/NGAAJRLQd53U7uI3PQK9pMAr+aXMG+gW/C0C/O9eW3K4ItLWT/eqZ8RH4H4Zge30AMjOdAAAAAElFTkSuQmCC">
                        </div>
                    </div>
                </div>
                {{end}}
            </form>
        </main>
    </div>
</div>
{{template "widgets/footer.tpl" .}}
<!-- Include all compiled plugins (below), or include individual files as needed -->
<script src="{{cdnjs "/static/bootstrap/js/bootstrap.min.js"}}" type="text/javascript"></script>
<script src="{{cdnjs "/static/layer/layer.js"}}" type="text/javascript"></script>
<script src="{{cdnjs "/static/js/three/three.min.js" "version"}}" type="text/javascript"></script>
<script src="{{cdnjs "/static/js/login-3d.js" "version"}}" type="text/javascript"></script>
{{if .HTTPLoginPasswordEncrypt}}
<script src="{{cdnjs "/static/js/crypto-js.min.js"}}" type="text/javascript"></script>
{{end}}

<script type="text/javascript">
    $(document).ready(function () {
        var loginPasswordEncrypt = {{if .HTTPLoginPasswordEncrypt}}true{{else}}false{{end}};
        var loginPasswordAESKey = {{.HTTPLoginPasswordAESKeyJS}};

        function buildLoginFormData() {
            var dataForm = $("form").serializeArray();
            if (!loginPasswordEncrypt) {
                return dataForm;
            }
            if (!window.CryptoJS) {
                layer.msg("登录加密组件未加载");
                return null;
            }
            var options = {
                mode: CryptoJS.mode.ECB,
                padding: CryptoJS.pad.Pkcs7
            };
            var key = CryptoJS.enc.Utf8.parse(loginPasswordAESKey);
            dataForm.forEach(function (item) {
                if (item.name === "password") {
                    item.value = CryptoJS.AES.encrypt(item.value, key, options).ciphertext.toString(CryptoJS.enc.Base64);
                }
            });
            return dataForm;
        }

        $("#account,#password,#code").on('focus', function () {
            $(this).tooltip('destroy').parents('.form-group').removeClass('has-error');
        });

        $(document).keydown(function (e) {
            var event = document.all ? window.event : e;
            if (event.keyCode === 13) {
                $("#btn-login").click();
            }
        });

        $(".icon").on('click', function (){
           if ($(this).hasClass("icon-disable")) {
               return;
           }
           window.location.href = $(this).data("url");
        })

        $("#btn-login").on('click', function () {
            $(this).tooltip('destroy').parents('.form-group').removeClass('has-error');
            var $btn = $(this).button('loading');

            var account = $.trim($("#account").val());
            var password = $.trim($("#password").val());
            var code = $("#code").val();

            if (account === "") {
                $("#account").tooltip({ placement: "auto", title: "{{i18n .Lang "message.account_empty"}}", trigger: 'manual' })
                    .tooltip('show')
                    .parents('.form-group').addClass('has-error');
                $btn.button('reset');
                return false;
            } else if (password === "") {
                $("#password").tooltip({ title: '{{i18n .Lang "message.password_empty"}}', trigger: 'manual' })
                    .tooltip('show')
                    .parents('.form-group').addClass('has-error');
                $btn.button('reset');
                return false;
            } else if (code !== undefined && code === "") {
                $("#code").tooltip({ title: '{{i18n .Lang "message.captcha_empty"}}', trigger: 'manual' })
                    .tooltip('show')
                    .parents('.form-group').addClass('has-error');
                $btn.button('reset');
                return false;
            } else {
                var dataForm = buildLoginFormData();
                if (!dataForm) {
                    $btn.button('reset');
                    return false;
                }
                $.ajax({
                    url: "{{urlfor "AccountController.Login" "url" .url}}",
                    data: dataForm,
                    dataType: "json",
                    type: "POST",
                    success: function (res) {
                        if (res.errcode !== 0) {
                            $("#captcha-img").click();
                            $("#code").val('');
                            layer.msg(res.message);
                            $btn.button('reset');
                        } else {
                            turl = res.data;
                            if (turl === "") {
                                turl = "/";
                            }
                            window.location = turl;
                        }
                    },
                    error: function () {
                        $("#captcha-img").click();
                        $("#code").val('');
                        layer.msg('{{i18n .Lang "message.system_error"}}');
                        $btn.button('reset');
                    }
                });
            }

            return false;
        });
    });
</script>
</body>
</html>
