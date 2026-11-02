# MinDoc AI 知识管理系统

MinDoc AI 是基于 MinDoc 改造的企业知识管理系统。它保留了 MinDoc 原有的项目空间、Markdown 文档管理、权限控制、文档阅读和编辑能力，并增加了面向企业内网知识库的 AI 问答能力。

本文档主要说明工程部署流程和关键配置。详细功能介绍请查看 `MinDoc_AI_试用手册.md`。

## 1. 简要功能介绍

- 支持项目空间、文档目录、Markdown 文档编辑、阅读、发布。
- 支持保存后默认自动发布，减少重复操作。
- 支持 Markdown `[TOC]` 目录跳转和文章目录定位。
- 支持顶部导航 AI 问答页面。
- 支持文章页 AI 问答弹框。
- 支持按当前用户可访问项目范围进行知识库检索。
- 支持项目范围多选和模糊搜索。
- 支持 Markdown 格式答案渲染和参考来源跳转。
- 支持关键词检索、SQL 预过滤、FULLTEXT 检索和可选向量检索。
- 支持普通聊天模型、`bocai-agent` 和 `code wiki` 模型切换。
- 支持 OpenAPI 自动向指定项目路径导入 Markdown 文档。

## 2. 部署包说明

常用部署包：

```text
mindoc-ai-windows-amd64-package.tar.gz
mindoc-ai-linux-amd64-package.tar.gz
```

解压后通常包含：

```text
.
├── mindoc-ai-windows-amd64.exe       # Windows 可执行文件
├── mindoc-ai-linux-amd64             # Linux AMD64 可执行文件
├── conf/
│   ├── app.conf                      # 实际运行配置
│   ├── app.conf.example              # 配置模板
│   └── lang/                         # 多语言配置
├── static/                           # 前端静态资源
├── views/                            # 页面模板
├── lib/                              # 运行依赖资源
├── uploads/                          # 上传目录（含默认图片）
├── database/                         # SQLite 数据目录（仅演示模式使用）
├── deploy_mysql_ai_schema.sql        # AI 知识库相关数据库脚本
├── MinDoc_AI_试用手册.md              # 详细功能试用手册
├── BUILD-INFO.txt                    # 构建信息与快速启动说明
└── README.md                         # 部署说明
```

注意：部署时需要保证 `conf/`、`static/`、`views/`、`lib/` 与可执行文件在同一部署目录下。

生产部署建议使用 MySQL；SQLite 仅适合本机演示（并发写入时可能出现锁等待，历史版本记录可能丢失）。

## 3. 部署前准备

### 3.1 服务器要求

Windows：

- Windows 10 / Windows Server 及以上版本。
- 能访问 MySQL。
- 能访问内网大模型服务或外部模型服务。

Linux AMD64：

- x86_64 / amd64 架构。
- 推荐 Linux 内核 3.10 及以上。
- 能访问 MySQL。
- 能访问内网大模型服务或外部模型服务。

### 3.2 数据库要求

当前部署建议使用 MySQL。SQLite 仅适合本机演示，生产环境不建议使用。

准备一个数据库，例如：

```sql
CREATE DATABASE mindoc DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
```

如果是已有 MinDoc 数据库，请先备份后再升级。

### 3.3 网络要求

请确保应用服务器可以访问：

- MySQL 数据库地址。
- 普通聊天模型接口。
- embedding 向量模型接口。
- agent 接口。
- Code Wiki 接口。
- HTTP 登录认证接口。

其中 embedding、agent、Code Wiki 为可选能力，未使用时可以不配置。

## 4. 数据库初始化和升级

### 4.1 全新部署

全新部署时，需要先准备 MinDoc 基础数据库表。基础表初始化方式请按现有 MinDoc 部署方式执行。

也可以在部署目录执行安装命令自动初始化基础表：

```bash
./mindoc-ai-linux-amd64 install
```

AI 知识库相关表和索引可执行：

```bash
mysql -h127.0.0.1 -P3306 -uroot -p mindoc < deploy_mysql_ai_schema.sql
```

### 4.2 已有 MinDoc 升级

已有系统升级前建议：

1. 停止旧服务。
2. 备份数据库。
3. 备份原部署目录。
4. 使用新包替换可执行文件、`static/`、`views/`、`conf/lang/` 等资源。
5. 合并 `conf/app.conf.example` 中新增配置到原 `conf/app.conf`。
6. 执行 `deploy_mysql_ai_schema.sql` 补充 AI 相关表和索引。
7. 启动新服务。

备份示例：

```bash
mysqldump -h127.0.0.1 -P3306 -uroot -p mindoc > mindoc_backup.sql
```

## 5. 配置文件

主配置文件：

```text
conf/app.conf
```

如部署目录中没有 `conf/app.conf`，可复制：

```bash
cp conf/app.conf.example conf/app.conf
```

Windows 可直接复制并重命名。

## 6. 基础服务配置

### 6.1 监听地址和端口

```ini
httpaddr=0.0.0.0
httpport=8182
baseurl=http://127.0.0.1:8182
```

说明：

- `httpaddr=0.0.0.0` 表示允许其他机器访问。
- `httpport` 是应用端口。
- `baseurl` 建议配置为用户实际访问地址。

内网示例：

```ini
httpaddr=0.0.0.0
httpport=8182
baseurl=http://22.10.10.10:8182
```

### 6.2 MySQL 配置

```ini
db_adapter=mysql
db_host=127.0.0.1
db_port=3306
db_database=mindoc
db_username=root
db_password=your_password
```

生产环境建议使用独立数据库账号，不建议直接使用 root。

## 7. 内网登录配置

内网部署通常不需要第三方登录、验证码和忘记密码：

```ini
show_third_party_login=false
show_login_captcha=false
show_forgot_password=false
```

如使用 HTTP 登录：

```ini
auth_method=http
http_login_url=你的内网登录接口
http_login_password_encrypt=true
http_login_password_aes_key=DiyFDNeMBxW1SGgp
http_login_secret=你的登录密钥
```

说明：

- `http_login_password_encrypt=true` 表示前端会对密码进行 AES 加密后提交。
- `http_login_password_aes_key` 需要与内网登录接口约定一致。
- 登录页字段会显示为“域用户”和“域密码”。

## 8. AI 问答配置

### 8.1 开启 AI 问答

```ini
enable_ai_chat=true
```

### 8.2 普通聊天模型

```ini
ai_endpoint=https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions
ai_model=qwen2.5-14b-instruct
ai_api_key=你的API_KEY
ai_request_profile=openai
ai_auth_header=Authorization
ai_auth_prefix=Bearer
ai_request_timeout=120
ai_request_retries=2
```

字段说明：

- `ai_endpoint`：聊天模型请求地址。
- `ai_model`：默认聊天模型。
- `ai_api_key`：模型 API Key。
- `ai_request_profile`：请求格式，按模型网关适配，例如 `openai`、`aicoding`、`bocai`。
- `ai_auth_header`：认证请求头。
- `ai_auth_prefix`：认证前缀。
- `ai_request_timeout`：请求超时时间。
- `ai_request_retries`：失败重试次数。

### 8.3 模型下拉框

```ini
ai_model_options=qwen_chat_medium,Cot-quick,bocai-agent,code wiki
```

说明：

- 普通模型走 `ai_endpoint`。
- `bocai-agent` 走 agent 专用配置。
- `code wiki` 走 Code Wiki 专用配置。

## 9. 向量检索配置

如需使用向量检索，配置 embedding：

```ini
ai_embedding_enabled=true
ai_embedding_endpoint=http://你的embedding地址
ai_embedding_model=embedding
ai_embedding_request_profile=bocai
ai_embedding_api_key=你的embedding_API_KEY
ai_embedding_auth_header=Authorization
ai_embedding_auth_prefix=Bearer
ai_embedding_input_format=string
```

当前支持的 embedding 请求格式：

```json
{
  "model": "embedding",
  "input": "你是谁开发的"
}
```

页面中只有勾选“向量检索”后，后端才会实际调用 embedding 模型。

## 10. bocai-agent 配置

```ini
ai_agent_endpoint=http://你的agent地址
ai_agent_model=bocai-agent
ai_agent_request_profile=auto
ai_agent_api_key=
ai_agent_fallback_api_key=false
ai_agent_auth_header=auto
ai_agent_auth_prefix=auto
ai_agent_request_timeout=120
ai_agent_request_retries=2
```

说明：

- `ai_agent_api_key` 用于配置 agent 独立密钥。
- `ai_agent_request_profile=auto` 表示默认跟随 `ai_request_profile`，例如主模型配置为 `bocai` 时，`bocai-agent` 也使用 bocai 请求格式。
- `ai_agent_fallback_api_key=false` 表示不复用普通聊天模型的 `ai_api_key`。
- 只有 agent 和普通聊天模型共用同一个 Key 时，才建议设置为 `true`。

## 11. Code Wiki 配置

当模型选择 `code wiki` 时，页面会显示 Code Wiki 仓库下拉框。

```ini
code_wiki_endpoint=http://22.10.124.20:8001/chat/completions/stream
code_wiki_repo_url=D:\JavaProject\wiki\IN0800
code_wiki_provider=openai
code_wiki_model=Cot-quick
code_wiki_language=zh
code_wiki_type=local
```

仓库列表接口：

```ini
code_wiki_repo_list_endpoint=http://你的接口地址/repos
code_wiki_repo_list_method=GET
```

新增仓库接口：

```ini
code_wiki_repo_add_endpoint=http://你的接口地址/repos
code_wiki_repo_add_method=POST
```

说明：Code Wiki 仓库列表接口和新增仓库接口是普通业务接口，不是大模型接口。

## 12. OpenAPI 导入配置

开启接口：

```ini
openapi_markdown_import_enabled=true
openapi_markdown_import_token=你的接口token
openapi_markdown_import_auth_header=X-MinDoc-Token
openapi_markdown_import_auth_prefix=
```

请求地址：

```text
POST /openapi/markdown/import
```

请求示例：

```json
{
  "book_identify": "demo",
  "path": "接口文档/支付接口",
  "title": "支付接口说明",
  "identify": "payment-api",
  "markdown": "# 支付接口说明\n\n这里是 Markdown 内容。",
  "overwrite": true,
  "auto_create_dirs": true,
  "order_sort": 1
}
```

## 13. Windows 部署流程

1. 将 `mindoc-ai-windows-amd64-package.tar.gz` 拷贝到服务器。
2. 解压部署包。
3. 进入解压目录。
4. 修改 `conf/app.conf`。
5. 配置 MySQL、端口、登录方式和 AI 模型。
6. 如目标数据库缺少 AI 表，执行 `deploy_mysql_ai_schema.sql`。
7. 启动服务：

```powershell
.\mindoc-ai-windows-amd64.exe
```

8. 浏览器访问：

```text
http://127.0.0.1:8182
```

9. 登录后确认首页、项目列表、AI 问答入口是否正常。

## 14. Linux AMD64 部署流程

1. 上传部署包：

```bash
scp mindoc-ai-linux-amd64-package.tar.gz user@server:/opt/
```

2. 登录服务器并解压：

```bash
cd /opt
tar -zxvf mindoc-ai-linux-amd64-package.tar.gz
cd mindoc-ai-linux-amd64-package
```

3. 赋予执行权限：

```bash
chmod +x mindoc-ai-linux-amd64
```

4. 修改配置：

```bash
vi conf/app.conf
```

5. 如目标数据库缺少 AI 表，执行：

```bash
mysql -h数据库地址 -P3306 -u用户名 -p 数据库名 < deploy_mysql_ai_schema.sql
```

6. 首次全新部署，初始化基础表（已有数据库可跳过）：

```bash
./mindoc-ai-linux-amd64 install
```

7. 前台启动：

```bash
./mindoc-ai-linux-amd64
```

8. 后台启动：

```bash
nohup ./mindoc-ai-linux-amd64 > mindoc.log 2>&1 &
```

9. 查看日志：

```bash
tail -f mindoc.log
```

10. 浏览器访问：

```text
http://服务器IP:8182
```

## 15. systemd 服务示例

如需配置为 Linux 系统服务，可创建：

```text
/etc/systemd/system/mindoc-ai.service
```

示例：

```ini
[Unit]
Description=MinDoc AI
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/mindoc-ai-linux-amd64-package
ExecStart=/opt/mindoc-ai-linux-amd64-package/mindoc-ai-linux-amd64
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

启动：

```bash
systemctl daemon-reload
systemctl enable mindoc-ai
systemctl start mindoc-ai
systemctl status mindoc-ai
```

## 16. Nginx 反向代理示例

如果需要通过 Nginx 代理访问：

```nginx
server {
    listen 80;
    server_name mindoc.example.com;

    location / {
        proxy_pass http://127.0.0.1:8182;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

代理后建议同步修改：

```ini
baseurl=http://mindoc.example.com
```

## 17. 部署后检查

部署完成后建议检查：

- 首页能正常打开。
- 登录页显示“域用户”和“域密码”。
- 登录页不显示第三方登录、验证码、忘记密码。
- 左上角系统名显示“知识管理”。
- 页脚显示“软件中心（深圳）开发一部”。
- 项目列表能正常展示。
- 文档能正常编辑和保存。
- 保存后文档能自动发布。
- AI 问答页面能打开。
- 检索项目范围能显示当前用户可访问项目。
- 普通模型能正常回答。
- 勾选向量检索后能看到 embedding 相关 Timing。
- 选择 `bocai-agent` 后能调用 agent。
- 选择 `code wiki` 后能显示仓库下拉。
- OpenAPI 导入 Markdown 文档正常。

## 18. 升级和回滚建议

升级前：

- 备份数据库。
- 备份原部署目录。
- 记录原 `conf/app.conf`。

升级时：

- 替换可执行文件。
- 替换 `static/`。
- 替换 `views/`。
- 替换 `conf/lang/`。
- 合并新增配置项。
- 执行新增 SQL。

回滚时：

- 停止新服务。
- 恢复旧部署目录。
- 如数据库结构已变更，按备份恢复数据库。
- 启动旧服务。

## 19. 常见部署问题

### 19.1 端口被占用

处理方式：

```bash
netstat -tunlp | grep 8182
```

或修改：

```ini
httpport=新的端口
```

### 19.2 登录提示验证码不正确

确认：

```ini
show_login_captcha=false
```

修改后需要重启服务并清理浏览器缓存。

### 19.3 编辑页面空白

通常是静态资源或语言文件没有同步。

请确认部署目录包含：

```text
static/
views/
conf/lang/zh-cn.ini
conf/lang/en-us.ini
```

### 19.4 AI 调用超时

可调大：

```ini
ai_request_timeout=180
ai_request_retries=2
```

如果是 agent 或 embedding，也需要调整对应配置。

### 19.5 向量检索提示 embedding 未配置

请确认：

```ini
ai_embedding_enabled=true
ai_embedding_model=embedding
ai_embedding_endpoint=你的embedding地址
```

## 20. 详细功能手册

详细功能试用说明请查看：

```text
MinDoc_AI_试用手册.md
```

## 21. 安全建议

- 不要将真实 API Key 提交到 GitHub 或公开文档。
- 内网部署建议通过环境变量或运维配置系统管理密钥。
- OpenAPI 导入接口建议配置强 token。
- 对外暴露时建议增加 HTTPS、IP 白名单和访问审计。
- 生产数据库账号建议使用最小权限。
- 模型接口如涉及敏感文档，应确认模型服务部署在可信环境。

## 22. 技术栈

- Go
- Beego
- MySQL
- Markdown / Editor.md / Cherry Markdown
- Bootstrap
- jQuery
- OpenAI 兼容模型接口
- 可选 embedding 语义检索

## 23. License

本工程基于 MinDoc 改造，请遵循原项目 License 及公司内部使用规范。
