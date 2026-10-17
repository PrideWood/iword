# 词间 WordCraft

面向中职英语课堂的班级、学生、词库、学习任务、测评与报告管理应用。Next.js 16 + React 19 + TypeScript + Drizzle + PostgreSQL，可本地开发并部署到 Vercel，数据库支持 Neon。

## 本地启动

1. `npm ci`
2. 复制 `.env.example` 为 `.env.local` 并配置 PostgreSQL/Neon 和腾讯云凭据。
3. 本地 PostgreSQL 可运行 `docker compose up -d`；使用 Neon 则跳过。
4. `npm run db:migrate`
5. 可选：`npm run db:seed` 显式写入演示数据。
6. `npm run auth:bootstrap` 为当前 CLI 工作空间创建首次教师账号。
7. `npm run dev`，教师访问 http://localhost:3000/teacher，学生访问 http://localhost:3000/。

首次教师的随机密码保存在被 Git 忽略的 `outputs/teacher-login.txt`。教师登录后可修改密码、分配学生账号。所有环境均要求登录；不存在 localhost 身份旁路或默认生产密码。

## 角色与权限

教师管理本人工作空间的班级、学生、词库、任务及报告。学生只接收本人学习所需数据，只能提交本人进度和测评。服务器校验角色、工作空间、班级和学生归属，客户端不能通过修改 ID 切换身份。教师密码重置和本人修改密码会撤销全部旧会话。

教师登录 `/teacher/login`，后台 `/teacher`；学生登录 `/login`，学习首页 `/`。旧教师首页访问会自动跳转到 `/teacher`。错误角色无法在另一端登录或获取另一端数据。

任务列表、词库详情、单词行和班级卡片均提供编辑入口，学生资料沿用行内编辑。已开始或有学习记录的任务锁定班级、词库及题型，但可修改名称、时间、达标线和重复测评设置。未开始且无记录的任务可调整结构，并通过「更新任务词表」刷新快照；词库或单词的编辑不会自动改写已发布任务。

教师在「班级与学生 → 学生注册」选择班级及开放时间，复制注册链接发给学生；可随时关闭。学生填写姓名、学号、账号和密码，自助加入该班级，不能注册为教师。重复账号或同班学号会被拒绝。教师仍可编辑学生资料，姓名会同步登录账户。

学生端使用「学习 / 词表 / 我的」底部导航。词表区分待学习、已学；账号资料和修改密码仅在「我的」。单词与题目随机排列，拼写练习补全缺失字母，听音题选择英文单词。

## 单词发音

单词库每个词都有播放按钮。学生端和单词库共用服务端接口：已有 COS 音频直接复用，缺失时用腾讯 YunMia 403006 生成 MP3、上传私有 COS，记录数据库索引，再返回短期签名地址。并发生成通过数据库锁去重，Vercel 运行时不写本地磁盘。当前仅美音。

进入学习任务时，先下载整组单词音频并存入浏览器 IndexedDB，完成后开始学习。后续点击与自动播放从本地缓存读取，不再逐次请求 COS；清除站点数据或更换设备后需重新缓存。浏览器禁止本地存储时退回内存缓存。首次学习和听音选词自动发音；浏览器拦截自动播放时点击「开启声音」。这不代表整个应用支持离线学习，进度及测评保存仍需联网。

批量预生成仍可使用：

```sh
npm run audio:plan
npm run audio:sync
npm run audio:validate
```

批处理读取 `PRONUNCIATION_WORD_SOURCE=database` 指定数据库的 CLI 工作空间。运行时按需生成不依赖静态 manifest，登录后可从 `/api/pronunciation/manifest` 查看本人的动态索引。详见 [AUDIO_SETUP.md](./AUDIO_SETUP.md)。

## 验证与部署

```sh
npm run typecheck
npm run test:learning
npm run test:audio-cache
npm run lint
npm run build
npm run db:check
# 先启动应用，再运行真实 Neon/COS 集成测试：
npm run test:integration
```

Vercel 配置已指定新加坡函数区域 `sin1`，Node.js 使用 22.x。环境变量、数据库迁移、首次账号和操作说明见 [DEPLOYMENT.md](./DEPLOYMENT.md)。

`npm run build` 不执行迁移或写入示例数据。请在受控发布步骤对目标数据库运行迁移，生产/预览推荐使用不同 Neon 分支。

## 数据

结构定义在 `db/schema.ts`，迁移文件在 `drizzle/`。登录会话、限流和音频索引持久化到 PostgreSQL，在多实例部署间共享。密码采用 scrypt，加盐保存；Cookie 使用 HttpOnly、SameSite=Lax 和生产 Secure。

现有演示课堂已保存到 Neon。原云端 D1 真实数据不会自动导入，需要独立导出并转换。
