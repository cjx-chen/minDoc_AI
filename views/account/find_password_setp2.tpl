<!DOCTYPE html>
<html lang="zh-cn">
<head>
    <meta charset="utf-8">
    <link rel="shortcut icon" href="{{cdnimg "/static/favicon.ico"}}">
    <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1" />
    <meta name="renderer" content="webkit" />
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="author" content="MinDoc" />
    <title>{{i18n .Lang "common.account_recovery"}} - Powered by MinDoc</title>

    <!-- Bootstrap -->
    <link href="{{cdncss "/static/bootstrap/css/bootstrap.min.css"}}" rel="stylesheet">
    <link href="{{cdncss "/static/font-awesome/css/font-awesome.min.css"}}" rel="stylesheet">
    <link href="{{cdncss "/static/css/main.css" "version"}}" rel="stylesheet">
    <link href="{{cdncss "/static/css/mindoc-ui.css" "version"}}" rel="stylesheet">
    <!-- HTML5 shim and Respond.js for IE8 support of HTML5 elements and media queries -->
    <!-- WARNING: Respond.js doesn't work if you view the page via file:// -->
    <!--[if lt IE 9]>
    <script src="/static/html5shiv/3.7.3/html5shiv.min.js"></script>
    <script src="/static/respond.js/1.4.2/respond.min.js"></script>
    <![endif]-->
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
            <h2>{{i18n .Lang "common.account_recovery"}}</h2>
            <p class="login-sub">为账号 {{.Email}} 设置新密码</p>
            <form role="form" method="post" id="findPasswordForm" action="{{urlfor "AccountController.ValidEmail"}}">
            {{ .xsrfdata }}
                <input type="hidden" name="token" value="{{.Token}}">
                <input type="hidden" name="mail" value="{{.Email}}">
                <div class="form-group">
                    <div class="input-group">
                        <div class="input-group-addon">
                            <i class="fa fa-lock"></i>
                        </div>
                        <input type="password" class="form-control" name="password1" id="newPassword" maxlength="20" placeholder="{{i18n .Lang "common.new_password"}}"  autocomplete="off">
                    </div>
                </div>
                <div class="form-group">
                    <div class="input-group">
                        <div class="input-group-addon">
                            <i class="fa fa-lock"></i>
                        </div>
                        <input type="password" class="form-control" id="confirmPassword" name="password2" maxlength="20" placeholder="{{i18n .Lang "common.confirm_password"}}"  autocomplete="off">
                    </div>
                </div>

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
                <div class="form-group">
                    <button type="submit" id="btnSendMail" class="btn btn-success ui-btn-block" style="width: 100%"  data-loading-text="{{i18n .Lang "message.processing"}}" autocomplete="off">{{i18n .Lang "common.account_recovery"}}</button>
                </div>

            </form>
        </main>
    </div>
</div>
{{template "widgets/footer.tpl" .}}
<!-- Include all compiled plugins (below), or include individual files as needed -->
<script src="{{cdnjs "/static/bootstrap/js/bootstrap.min.js"}}" type="text/javascript"></script>
<script src="{{cdnjs "/static/layer/layer.js"}}" type="text/javascript"></script>
<script src="{{cdnjs "/static/js/jquery.form.js"}}" type="text/javascript"></script>
<script type="text/javascript">
    $(function () {
        $("#email,#code").on('focus',function () {
            $(this).tooltip('destroy').parents('.form-group').removeClass('has-error');;
        });

        $(document).keydown(function (e) {
            var event = document.all ? window.event : e;
            if(event.keyCode == 13){
                $("#btn-login").click();
            }
        });

        $("#findPasswordForm").ajaxForm({
            beforeSubmit : function () {

                var newPassword = $.trim($("#newPassword").val());
                var confirmPassword = $.trim($("#confirmPassword").val());
                var code = $.trim($("#code").val());

                if(newPassword === ""){
                    $("#newPassword").tooltip({placement:"auto",title : "{{i18n .Lang "message.password_empty"}}",trigger : 'manual'})
                        .tooltip('show')
                        .parents('.form-group').addClass('has-error');

                    return false;

                }else if(confirmPassword === ""){
                    $("#confirmPassword").tooltip({placement:"auto",title : "{{i18n .Lang "message.confirm_password_empty"}}",trigger : 'manual'})
                        .tooltip('show')
                        .parents('.form-group').addClass('has-error');

                    return false;
                }else if(newPassword !== confirmPassword) {
                    $("#confirmPassword").tooltip({placement:"auto",title : "{{i18n .Lang "message.incorrect_confirm_password"}}",trigger : 'manual'})
                        .tooltip('show')
                        .parents('.form-group').addClass('has-error');

                    return false;
                }else if(code === ""){
                    $("#code").tooltip({title : '{{i18n .Lang "message.captcha_empty"}}',trigger : 'manual'})
                        .tooltip('show')
                        .parents('.form-group').addClass('has-error');

                    return false;
                }

                $("#btnSendMail").button("loading");
            },
            success : function (res) {

                if(res.errcode !== 0){
                    $("#captcha-img").click();
                    $("#code").val('');
                    layer.msg(res.message);
                    $("#btnSendMail").button('reset');
                }else{
                    window.location = res.data;
                }
            },
            error :function () {
                $("#captcha-img").click();
                $("#code").val('');
                layer.msg('{{i18n .Lang "message.system_error"}}');
                $("#btnSendMail").button('reset');
            }
        });

    });
</script>
</body>
</html>
