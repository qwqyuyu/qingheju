# 清和居 · 中医文化日常养生平台

> **学生比赛项目**：本项目为参赛作品，用于学习、交流与展示，非商业用途。

一个以“中医养生文化”为主题的静态前端 + Node.js 后端项目：食谱养生、二十四节气、中医文化、养生社区、每日签到、体质自测（AI 问诊）。

## 技术栈

- 前端：原生 HTML / CSS / JavaScript（无构建步骤）
- 后端：Node.js 18+、Express 5
- 数据库：MariaDB / MySQL（`mysql2`）
- 鉴权：JWT（`jsonwebtoken`）+ `bcryptjs`
- AI：OpenAI 兼容网关 / Anthropic Messages（地址、Key、模型全部走环境变量）

## 目录结构

```
qingheju/
├─ pages/                 所有前端页面（index 为入口落地页，home 为主站首页）
├─ css/ js/ images/       前端资源（js/vendor/lunar.js 为农历库）
├─ setup.js               首次配置向导（Windows / macOS / Linux 通用）
├─ setup.bat / setup.ps1  Windows 配置向导入口（双击 setup.bat 即可）
├─ setup.sh               Linux / macOS 配置向导入口
├─ start.bat / start.ps1  Windows 一键启动脚本
├─ start.sh               Linux / macOS 一键启动脚本
├─ server/                后端
│  ├─ app.js              入口：中间件、静态托管、路由、404/错误处理
│  ├─ config/             db、auth、ratelimit、validate、avatar、solarterm、ai、context、env（.env 加载）、time（时区）、body（请求体上限）、streak（连续签到）
│  ├─ routes/             user、post、checkin、solarterm、ai
│  ├─ test/               smoke（接口冒烟）、routes（路由行为，无需数据库）、context（上下文裁剪）、ratelimit（限流）、setup（配置向导）
│  ├─ schema.sql          建库建表 + 24 节气初始数据
│  └─ .env.example        环境变量模板
└─ README.md
```

页面地址形如 `/pages/home.html`；访问根路径 `/` 返回入口页 `pages/index.html`。旧地址 `/home.html` 会 301 重定向到 `/pages/home.html`。

## 快速启动（Windows）

1. 安装 Node.js 18+。
2. 启动 MariaDB / MySQL（本机 MariaDB 服务名 `MariaDB`，端口 3308）。
3. 运行配置向导（首次运行 `start.bat` 也会自动进入）：

   ```powershell
   .\setup.ps1            # 或双击 setup.bat
   ```

   依次填写数据库地址/端口/账号/密码/库名；向导会自动生成 `JWT_SECRET`，并询问是否配置 AI（可跳过）。
   填完会尝试连接数据库，并提示导入表结构的命令。

4. 首次导入表结构（向导没连上库时也可以先做这步）：

   ```powershell
   mysql -u root -p < server\schema.sql
   ```

5. 双击 `start.bat`，或：

   ```powershell
   .\start.ps1                 # 默认端口（server/app.js 里的 3112）
   .\start.ps1 -Port 3210      # 指定端口
   ```

浏览器打开 <http://localhost:3112/>（入口页 `pages/index.html`）。

手动方式：

```powershell
cd server
npm install
npm start
```

## 快速启动（Linux / macOS）

1. 安装 Node.js 18+（例如 `sudo apt install nodejs npm`，或用 nvm 安装较新版本）。
2. 启动数据库并导入表结构：

   ```bash
   sudo systemctl start mariadb          # 或 mysql
   mysql -u root -p < server/schema.sql
   ```

3. 运行配置向导（首次运行 `./start.sh` 也会自动进入）：

   ```bash
   chmod +x setup.sh start.sh            # 克隆后可能需要
   ./setup.sh                            # 依次填写数据库 / JWT / 可选的 AI 配置
   ```

4. 启动：

   ```bash
   chmod +x start.sh
   ./start.sh                  # 默认端口（server/app.js 里的 3112），不打开浏览器
   ./start.sh -p 3210          # 指定端口
   ./start.sh --browser        # 启动后顺便打开浏览器（可选）
   ./start.sh -h               # 查看帮助
   ```

脚本会做和 `start.ps1` 相同的事：检查 Node 版本、首次自动装依赖、读取 `server/.env`、检查端口占用和数据库连通性、校验 `JWT_SECRET`，最后启动服务。

> `start.sh` 默认**不打开浏览器**（服务器/远程环境更常见），需要时加 `--browser`；`--no-browser` 仍可显式指定，等价于默认行为。
> `start.sh` 已按 LF 换行提交（`.gitattributes` 保证），git 里也记录了可执行位；如果克隆后提示没有执行权限，`chmod +x start.sh` 即可。

## 首次配置向导（setup.js）

第一次跑服务前需要一份 `server/.env`（数据库、`JWT_SECRET`、可选的 AI）。向导会交互式问一遍并写文件，避免手抄模板出错：

| 系统 | 运行方式 |
|---|---|
| Windows | 双击 `setup.bat`，或 `.\setup.ps1`，或 `node setup.js` |
| macOS / Linux | `./setup.sh`（首次可能需要 `chmod +x setup.sh`），或 `node setup.js` |

流程：

1. 数据库：主机 / 端口 / 用户名 / 密码（隐藏输入）/ 库名，默认值来自现有 `.env` 或 `127.0.0.1:3306 / root / qingheju`；
2. 自动测试连接（依赖未安装时跳过），失败会提示导入表结构的命令，可选择仍然保存；
3. `JWT_SECRET`：没有就自动生成 64 位随机串，直接回车即可；
4. AI（可选）：地址（需带 `/v1`）、格式（responses / chat / messages）、模型名、Key；选“否”则写入注释占位，AI 接口返回 503，其它功能不受影响；
5. 高级项（时区 / 监听端口 / 反向代理 `TRUST_PROXY`）默认不改；
6. 写入 `server/.env`，已有文件先备份为 `server/.env.bak.<时间戳>`，Unix 上权限设为 `600`。

其他用法：

```bash
node setup.js --check     # 只检查配置能不能启动（0=可以，1=需要配置）；start 脚本用它判断
node setup.js --yes       # 非交互：保留已有值，缺的用默认值并自动生成 JWT（适合脚本/CI）
node setup.js --help      # 帮助
```

> `start.ps1` / `start.sh` 在依赖装好后会先跑 `setup.js --check`，配置缺失就自动进入向导，配完继续启动。
> 向导只管理上面这些键，`.env` 里自己加的其它变量会原样保留；重复运行不会丢掉已有密码和 AI Key。

## 环境变量（server/.env）

| 变量 | 说明 | 默认 |
|---|---|---|
| `APP_TIMEZONE` | 业务时区，“今天/现在”按它计算 | `Asia/Shanghai` |
| `MYSQL_HOST` / `MYSQL_PORT` | 数据库地址/端口 | `localhost` / `3306` |
| `MYSQL_USER` / `MYSQL_PASSWORD` | 数据库账号 | `root` / 空（不再有默认口令） |
| `MYSQL_DATABASE` | 库名 | `qingheju` |
| `JWT_SECRET` | JWT 签名密钥，至少 32 位随机字符串（缺失则拒绝启动） | 必填 |
| `AI_BASE_URL` | 接口地址，必须带 `/v1` | 必填 |
| `AI_FORMAT` | 接口格式：`responses` / `chat` / `messages` | `responses` |
| `AI_API_KEY` | 网关 Key（也兼容 `DASHSCOPE_API_KEY`） | 必填 |
| `AI_MODEL` | 模型名（以网关 `/v1/models` 为准） | 必填 |
| `AI_MAX_TOKENS` / `AI_TEMPERATURE` | 输出上限 / 温度 | `1000` / `0.8` |
| `AI_STREAM` | 是否流式输出（SSE）；`false` 返回普通 JSON | `true` |
| `AI_MAX_MESSAGES` | 一次请求最多携带的历史消息条数 | `15` |
| `AI_CONTEXT_TOKENS` | 输入上下文 token 上限（含 system prompt） | `80000` |
| `AI_MAX_MESSAGE_CHARS` | 单条消息字符上限（超出截断） | `20000` |
| `AI_RATE_LIMIT_WINDOW_MS` / `AI_RATE_LIMIT_MAX` | AI 按用户限流：窗口（毫秒）/ 窗口内最大请求数 | `600000` / `30` |
| `CORS_ORIGINS` | 允许跨域的来源，逗号分隔；留空只允许同源 | 空 |
| `TRUST_PROXY` | 反向代理层数（如 `1`）或 `loopback`；部署在 nginx / Railway 等反代后设置，限流才能取到真实客户端 IP；直连部署保持空 | 空 |
| `REGISTER_RATE_LIMIT_MAX` / `LOGIN_IP_RATE_LIMIT_MAX` / `LOGIN_USER_RATE_LIMIT_MAX` | 注册 / 登录 IP / 登录用户名限流上限 | `10` / `30` / `10` |
| `POST_RATE_LIMIT_MAX` / `COMMENT_RATE_LIMIT_MAX` / `LIKE_RATE_LIMIT_MAX` | 发帖 / 评论 / 点赞限流上限（窗口均为 10 分钟，可用 `*_RATE_LIMIT_WINDOW_MS` 调整） | `10` / `30` / `120` |
| `JSON_BODY_LIMIT` | 普通接口的 JSON 请求体上限 | `2mb` |
| `POST_BODY_LIMIT` | 发帖接口的 JSON 请求体上限（原图 base64 ≤10MB + 缩略图 ≤1MB） | `12mb` |
| `PORT` | 本地监听端口（`start.ps1` 会覆盖） | `3112` |

> `.env` 已被 `.gitignore` 忽略；如需部署，直接在各平台的环境变量里配置同名变量即可。
> `.env` 支持行内注释：未加引号的值会忽略「空白 + `#`」之后的内容（`AI_FORMAT=chat  # chat | messages` 读作 `chat`）；值本身包含 `#` 时用引号包起来。
> `JWT_SECRET` 必须设置（至少 32 位），生成命令：`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`。轮换后所有已签发的 token 立即失效，用户需重新登录。

## 接口一览（前缀 `/api`）

| 方法 | 路径 | 说明 | 鉴权 |
|---|---|---|---|
| POST | `/register` `/login` | 注册 / 登录（带限流） | — |
| GET/PUT | `/user` `/user/avatar` `/user/username` `/user/password` | 资料与设置 | ✅ |
| GET | `/users/:id/avatar?v=N` | 头像文件（独立 URL，可按版本长期缓存） | — |
| GET | `/posts?page=1&pageSize=10&username=` | 帖子分页列表（只返回缩略图与正文预览 `preview`） | 可选 |
| GET | `/posts/:id` | 帖子详情（返回原图） | 可选 |
| POST/DELETE | `/posts` `/posts/:id` | 发帖（限流）/ 删帖（作者或管理员） | ✅ |
| POST | `/posts/:id/like` | 点赞 / 取消（限流，返回最新计数） | ✅ |
| PUT | `/posts/:id/feature` | 设为 / 取消精选（仅管理员，`users.is_admin`） | ✅ |
| GET/POST | `/posts/:id/comments` | 评论列表 / 发评论（限流） | 读公开，写需登录 |
| DELETE | `/comments/:id` | 删评论（作者或管理员） | ✅ |
| POST/GET | `/checkin` | 签到 / 签到记录 | ✅ |
| GET | `/solarterms?year=YYYY` | 二十四节气（日期/农历按年计算，默认当前节气年） | — |
| POST | `/ai/chat` | 小清 AI 问诊（Responses / Chat） | ✅（按用户限流） |
| POST | `/ai/message` | 与 `/ai/chat` 相同（兼容别名），格式由 `AI_FORMAT` 决定 | ✅（按用户限流） |

未知 `/api/*` 统一返回 JSON 404；请求体格式错误返回 JSON 400。

## 测试

```powershell
cd server
npm test                 # 冒烟测试：需要数据库
npm run test:routes      # 路由行为：不需要数据库、不调用真实 AI
npm run test:context     # AI 上下文裁剪
npm run test:ratelimit   # 限流器
npm run test:setup       # 配置向导：不需要数据库，不修改 server/.env
```

`test/smoke.mjs` 会自动在 3199 端口启动一个临时服务，依次验证：节气、注册、重复注册（409）、登录、发帖、点赞/取消、评论、签到、重复签到（409）、改密后旧 token 立即失效、分页、非法 ID、JSON 404/400，结束后删除测试账号并关闭服务。前提是数据库可连接（读取 `server/.env`）。

`test/routes.test.mjs` 不需要数据库：它把 `config/db` 换成假连接池，AI 上游换成本机假服务，用真实路由验证请求体上限（含“未登录的大请求先 401”）、发帖/评论/点赞限流、管理员删帖删评论的权限（越权 403）、断签后连续天数归零、AI 错误不泄露上游信息、客户端断开即取消上游请求。

`test/setup.test.mjs` 用临时目录验证配置向导：`--check` 的通过/失败、`--yes` 生成的默认值、重复运行的备份、含空格/`#` 的密码加引号写回、自定义键保留，不会碰 `server/.env`。

## 部署说明

本项目不绑定特定云平台，可运行在任何 Node.js 18+ 环境：

- 安装依赖：`cd server && npm install`（有 `package-lock.json` 时用 `npm ci` 亦可）。
- 启动：`cd server && npm start`，监听 `PORT` 环境变量（默认 3112）；Linux / macOS 也可以直接 `./start.sh`（带端口/DB/AI/JWT 预检查）。
- 静态页面由同一个 Express 服务托管，不需要额外的前端服务。
- `server/.env` 不会进仓库，部署时通过环境变量配置 `MYSQL_*` / `AI_*`。

## 备注

- 二十四节气的日期与农历由 `config/solarterm.js` 按年计算（`js/vendor/lunar.js` 天文算法），支持 1900-2200；接口 `GET /api/solarterms?year=YYYY` 返回“立春(YYYY) → 大寒(YYYY+1)”的 24 条，默认当前节气年。数据库 `solar_terms` 只提供名称、图片、描述、养生建议，`term_date` / `lunar_date` 列仅作历史参考、接口不再读取。现有数据中“大暑 2026”与“冬至 2026”两条错误日期已修正为 2026-07-23、2026-12-22。
- 静态资源采用白名单托管：只暴露 `css/`、`js/`、`images/` 和 `pages/` 下真实存在的 `.html` 页面；`server/` 源码、`.env`、SQL 导出、`package.json` 等不再通过 HTTP 访问。所有页面在 `pages/` 目录里，页面内的静态资源引用统一写成 `/css/...`、`/js/...`、`/images/...` 绝对路径，页面之间的链接仍用同目录相对路径（`home.html` 等）。数据库导出文件 `server/qingheju_dump.sql` 已从当前工作树和索引移除（本地备份不入库）；git 历史中的旧提交仍保留，如需彻底清除需重写历史。
- AI 接口需要登录，并按用户限流：默认 10 分钟 30 次，超出返回 429；可用 `AI_RATE_LIMIT_WINDOW_MS` / `AI_RATE_LIMIT_MAX` 调整。限流基于单进程内存，多实例部署需要换成共享存储（如 Redis）。
- 用户名限制为 2-20 位中文、字母、数字、下划线或短横线，禁止引号/尖括号等字符；所有用户内容在页面输出时统一做 HTML 转义，防止存储型 XSS。
- 输入长度与字段对齐：标题 ≤100、帖子内容 ≤15000、评论 ≤500、密码 6-64 位且 ≤72 字节、邮箱 ≤100；非法 ID、超长内容、评论不存在的帖子分别返回 400/404，不再变成 500。
- 登录/注册有限流：注册每 IP 每小时 10 次；登录每 IP 10 分钟 30 次、每个用户名 10 分钟 10 次，超出返回 429。数据库密码不再有 `123456` 默认值。
- 发帖 / 评论 / 点赞也有限流（默认 10 分钟分别 10 / 30 / 120 次），超出返回 429，响应带 `X-RateLimit-*` 与 `Retry-After` 头；前端的评论、点赞、删除失败时会给出提示，不再静默失败。
- JSON 请求体上限分两档：普通接口 `JSON_BODY_LIMIT`（默认 2mb），发帖接口 `POST_BODY_LIMIT`（默认 12mb）。发帖的解析器挂在鉴权和限流之后，未登录的大请求在读出请求体之前就被 401 拒绝，不会占用内存。
- 删帖 / 删评论：作者本人可以删除自己的内容；管理员（`users.is_admin = 1`）可以删除任何人的帖子和评论。服务端每次都从数据库确认管理员身份（不信任 token），管理员删除他人内容时会在日志里留一条 `[审计]` 记录。越权删除返回 403，帖子/评论不存在返回 404。
- 状态码语义统一：参数/格式错误 400，未登录或 token 失效 401，无权操作 403，资源不存在 404，重复注册 / 重复签到等状态冲突 409，限流 429。响应体仍是 `{ success, message }`，前端按 `success` 判断即可。
- 改密会让旧 token 立即失效：`users.token_version` 在改密时自增，token 里带版本号，鉴权时与数据库比对；`PUT /api/user/password` 的响应里会给当前客户端换发新 token（前端会自动保存），因此用户改完密码不会被自己踢下线。删除账号后旧 token 同样立即失效（鉴权时查不到用户返回 401）。
- 签到连续天数：`checkins.streak` 记录的是签到当天的值，`GET /api/checkin` 会按业务时区判断最近一次签到是不是今天或昨天，断签则返回 0，避免页面一直显示旧的连续天数。
- 签到页的知识卡片缓存在 localStorage：打开页面只请求一次节气表，并且只回填最近 30 天；更早的日期点开时再按需生成，避免连续签到几百天的用户一进页面就发几百个请求。
- AI 出错时浏览器只拿到统一文案“AI 服务暂时不可用，请稍后重试”；上游的原始错误（可能包含网关地址、模型名等）只写服务端日志。客户端断开（关页面、停止）时服务端会通过 `AbortController` 取消上游请求，不会白白消耗 token。
- `.idea/` 已被 `.gitignore` 忽略。
- 已加基础安全响应头（CSP、`X-Content-Type-Options`、`X-Frame-Options`、`Referrer-Policy`、`Permissions-Policy`），并关闭 `X-Powered-By`；CSP 的 `frame-src` 只放行 `https://player.bilibili.com`，供中医文化页内嵌 B站 视频使用，其余来源仍被拦截。CORS 默认只允许同源，跨域需显式配置 `CORS_ORIGINS`。部署在 nginx / 云平台等反向代理后面时请设置 `TRUST_PROXY=1`，否则 `req.ip` 会是代理地址，按 IP 的登录/注册限流会被所有用户共享。
- 依赖已升级到 express 5.3.0、mysql2 3.24.6 等，`npm audit --omit=dev` 当前为 0 漏洞。
- 登录使用 JWT，签名密钥只来自 `JWT_SECRET`；未配置或不足 32 位时服务拒绝启动，轮换密钥会让所有旧 token 立即失效。token 里只放用户 id 与 token 版本号，鉴权时按 id 查一次数据库确认用户仍存在且版本一致，所以改密或删号后旧 token 立即失效。
- AI 上下文有双重限制：最多携带最近 `AI_MAX_MESSAGES`（默认 15）条消息，且输入总量不超过 `AI_CONTEXT_TOKENS`（默认 80000）tokens（含 system prompt）。裁剪后保证以 `user` 开头（必要时少一条）；超出预算时从最早的消息开始丢弃，若最新一条本身就超预算，会截断并追加“内容过长已截断”标记。token 为保守估算（中文按 1 字 1 token，其余按 4 字符 1 token），不依赖分词器。单条消息超过 `AI_MAX_MESSAGE_CHARS`（默认 20000 字符）会先截断并标记。前端对话页面同样只保留最近 15 条。
- AI 接口默认流式输出：服务端以 SSE 返回 `data: {"delta":"..."}`，前端逐段渲染；`AI_STREAM=false` 时返回普通 JSON。三种格式（responses / chat / messages）都支持流式。
- 中医文化页（`pages/culture.html`）的科普视频用 B站 内嵌播放器实现：每个条目在 `js/culture.js` 里都有 `video` 字段（当前留空），填入 `https://www.bilibili.com/video/BVxxxxxxx`、`av` 号或只填编号后，点击视频窗口才会注入 `iframe`（首屏不加载播放器）；切换抽屉或收起面板会销毁 `iframe`，避免声音继续播放。链接留空时显示“视频待配置”占位，不发起任何外部请求。
- `AI_TEMPERATURE` 默认 `0.8`；填 `default` / `omit` / `none` 表示不传该参数。若模型（如 `claude-haiku-5-5`）只接受默认温度，服务端会自动去掉 `temperature` 重试一次并记住该模型。
- AI 只有一套配置：`AI_BASE_URL`、`AI_FORMAT`、`AI_API_KEY`、`AI_MODEL`；`AI_FORMAT=messages` 时走 Anthropic Messages，`responses`/`chat` 时走 OpenAI 兼容接口。`/api/ai/chat` 与 `/api/ai/message` 行为相同，后者仅为兼容别名。
- AI 的地址、Key、模型全部来自 `server/.env`（已被 `.gitignore` 忽略）；代码和 `.env.example` 里只有占位符，不包含真实值。
- 帖子支持“精选”：`posts.is_featured = 1` 的帖子在列表里置顶并显示“精选”徽标；管理员（`users.is_admin = 1`）可在帖子卡片上点“设为精选 / 取消精选”。
- 帖子图片保留原始 base64（不转码、不压缩），上传时额外生成 800px 缩略图存 `image_thumb`；列表接口只返回缩略图与正文前 300 字的 `preview`，详情接口 `/posts/:id` 返回原图与全文，避免列表响应过大。
- 头像上传会在浏览器端压到 256px 再存库（`users.avatar` + `users.avatar_version`）。用户/帖子接口只返回 `avatar` URL（`/api/users/:id/avatar?v=N`），不再在每个帖子/评论里重复塞 base64；头像响应带 `Cache-Control: immutable`，浏览器每个用户只下载一次，旧版本 URL 会 302 到当前版本。`avatar_version` 由启动迁移自动添加。
- 图片已按显示尺寸压缩（仓库约 7 MB）；原图可从 git 历史恢复。
- 农历使用 `lunar-javascript`（`js/vendor/lunar.js`），未加载时自动隐藏农历行。
- 字体使用系统楷体/行楷（`STXingkai`、`KaiTi` 等），不依赖外部字体服务。
