<!DOCTYPE html>
<html lang="zh-cn">
<head>
    <meta charset="utf-8">
    <link rel="shortcut icon" href="{{cdnimg "/static/favicon.ico"}}">
    <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1" />
    <meta name="renderer" content="webkit" />
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="author" content="MinDoc" />
    <title>{{i18n .Lang "common.new_account"}} - Powered by MinDoc</title>

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
            <p>汇聚项目文档与经验，支持全文检索与 AI 智能问答，注册后即可加入。</p>
            <div class="ui-doc-stack" aria-hidden="true">
                <div class="doc doc-1"></div>
                <div class="doc doc-2"></div>
                <div class="doc doc-3"><span class="bookmark"></span></div>
            </div>
        </aside>
        <main class="ui-login-main">
            <h2>{{i18n .Lang "common.new_account"}}</h2>
            <p class="login-sub">注册知识管理平台账号</p>
            <form role="form" method="post" id="registerForm">
            {{ .xsrfdata }}
                <div class="form-group">
                    <div class="input-group">
                        <div class="input-group-addon">
                            <i class="fa fa-user"></i>
                        </div>
                        <input type="text" class="form-control" placeholder="{{i18n .Lang "common.username"}}" name="account" id="account" autocomplete="off">
                    </div>
                </div>
                <div class="form-group">
                    <div class="input-group">
                        <div class="input-group-addon">
                            <i class="fa fa-lock"></i>
                        </div>
                        <input type="password" class="form-control" placeholder="{{i18n .Lang "common.password"}}" name="password1" id="password1" autocomplete="off">
                    </div>
                </div>
                <div class="form-group">
                    <div class="input-group">
                        <div class="input-group-addon">
                            <i class="fa fa-lock"></i>
                        </div>
                        <input type="password" class="form-control" placeholder="{{i18n .Lang "common.confirm_password"}}" name="password2" id="password2" autocomplete="off">
                    </div>
                </div>
                <div class="form-group">
                    <div class="input-group">
                        <div class="input-group-addon" style="padding: 6px 9px;"><i class="fa fa-envelope"></i></div>
                        <input type="email" class="form-control" placeholder="{{i18n .Lang "common.email"}}" name="email" id="email" autocomplete="off">
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
                    <button type="submit" id="btnRegister" class="btn btn-success ui-btn-block" style="width: 100%"  data-loading-text="{{i18n .Lang "message.processing"}}" autocomplete="off">{{i18n .Lang "common.register"}}</button>
                </div>
                {{if ne .ENABLED_REGISTER "false"}}
                <div class="register-link">
                    {{i18n .Lang "message.has_account"}} <a href="{{urlfor "AccountController.Login" }}" title="{{i18n .Lang "common.login"}}">{{i18n .Lang "common.login"}}</a>
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
<script src="{{cdnjs "/static/js/jquery.form.js"}}" type="text/javascript"></script>
<script type="text/javascript">
    $(function () {
        $("#account,#password,#confirm_password,#code").on('focus',function () {
            $(this).tooltip('destroy').parents('.form-group').removeClass('has-error');
        });

        $(document).keyup(function (e) {
            var event = document.all ? window.event : e;
            if(event.keyCode === 13){
                $("#btnRegister").trigger("click");
            }
        });
        $("#registerForm").ajaxForm({
            beforeSubmit : function () {
                var account = $.trim($("#account").val());
                var password = $.trim($("#password1").val());
                var confirmPassword = $.trim($("#password2").val());
                var code = $.trim($("#code").val());
                var email = $.trim($("#email").val());

                if(account === ""){
                    $("#account").focus().tooltip({placement:"auto",title : "{{i18n .Lang "message.account_empty"}}",trigger : 'manual'})
                        .tooltip('show')
                        .parents('.form-group').addClass('has-error');
                    return false;

                }else if(password === ""){
                    $("#password").focus().tooltip({title : '{{i18n .Lang "message.password_empty"}}',trigger : 'manual'})
                        .tooltip('show')
                        .parents('.form-group').addClass('has-error');
                    return false;
                }else if(confirmPassword !== password){
                    $("#confirm_password").focus().tooltip({title : '{{i18n .Lang "message.confirm_password_empty"}}',trigger : 'manual'})
                        .tooltip('show')
                        .parents('.form-group').addClass('has-error');
                    return false;
                }else if(email === ""){
                    $("#email").focus().tooltip({title : '{{i18n .Lang "message.email_empty"}}',trigger : 'manual'})
                        .tooltip('show')
                        .parents('.form-group').addClass('has-error');
                    return false;
                }else if(code !== undefined && code === ""){
                    $("#code").focus().tooltip({title : '{{i18n .Lang "message.captcha_empty"}}',trigger : 'manual'})
                        .tooltip('show')
                        .parents('.form-group').addClass('has-error');
                    return false;
                }else {

                    $("button[type='submit']").button('loading');
                }
            },
            success : function (res) {
                $("button[type='submit']").button('reset');
                if(res.errcode === 0){
                    window.location = "{{urlfor "AccountController.Login"}}";
                }else{
                    $("#captcha-img").click();
                    $("#code").val('');
                    layer.msg(res.message);
                }
            }
        });
    });
</script>
</body>
</html>
