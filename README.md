# 词间 WordCraft

面向中职英语课堂的班级、学生、词库、学习任务、测评与报告管理应用。Next.js 16 + React 19 + TypeScript + Drizzle + PostgreSQL，可本地开发并部署到 Vercel，数据库支持 Neon。

## 本地启动

1. `npm ci`
2. 复制 `.env.example` 为 `.env.local` 并配置 PostgreSQL/Neon 和腾讯云凭据。
3. 本地 PostgreSQL 可运行 `docker compose up -d`；使用 Neon 则跳过。
4. `npm run db:migrate`
5. 可选：`npm run db:seed` 显式写入演示数据。
6. `npm run auth:bootstrap` 为当前 CLI 工作空间创建首次教师账号。
7. `npm run dev`，访问 http://localhost:3000/login。

首次教师的随机密码保存在被 Git 忽略的 `outputs/teacher-login.txt`。教师登录后可修改密码、分配学生账号。所有环境均要求登录；不存在 localhost 身份旁路或默认生产密码。

## 角色与权限

教师管理本人工作空间的班级、学生、词库、任务及报告。学生只接收本人学习所需数据，只能提交本人进度和测评。服务器校验角色、工作空间、班级和学生归属，客户端不能通过修改 ID 切换身份。教师密码重置和本人修改密码会撤销全部旧会话。

## 单词发音

单词库每个词都有播放按钮。学生端和单词库共用服务端接口：已有 COS 音频直接复用，缺失时用腾讯 YunMia 403006 生成 MP3、上传私有 COS，记录数据库索引，再返回短期签名地址。并发生成通过数据库锁去重，Vercel 运行时不写本地磁盘。当前仅美音。

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
