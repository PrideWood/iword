# 本地交接

Next.js + Neon/PostgreSQL 项目已接入教师/学生登录和服务端权限隔离，适配 Vercel 新加坡 Node.js 函数。

首次教师登录凭据保存在本机 `outputs/teacher-login.txt`，不会进入 Git。现有 Neon 数据迁移已执行。首次教师关联现有课堂，学生账号由教师在账户面板分配。

本地开发：`npm run dev`。模拟正式运行：`npm run build` 后 `npm start`。请勿同时运行构建与开发服务器，两者默认共享 `.next`。

部署与环境变量见 [DEPLOYMENT.md](./DEPLOYMENT.md)。不要提交 `.env.local` 或初始密码文件。
