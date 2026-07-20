# 线上组队

面向宁波诺丁汉大学 2026 级中国大陆高考新生的第三方舍友匹配与选寝前组队网站。

> 本项目不是宁波诺丁汉大学官方选寝系统。提前组队不代表锁定房源，也不能保证入住同一宿舍，低层、阳面等热门位置可能更难抢到。

## 已实现

- 手机与电脑响应式界面
- 13、14、15、19、23 号楼及性别/房型规则
- 作息 55%＋兴趣 40%＋朝向 5% 的透明匹配算法
- 个人广场、匹配推荐、队伍广场与匿名队伍摘要
- 双方互相感兴趣后解锁微信/QQ
- 多队申请、队长审批、用户最终确认的组队流程设计
- 资料最小化、暂停展示、举报/拉黑及 30 天数据清理结构
- 管理员后台（预留 GitHub OAuth）
- Supabase 数据库、RLS 隐私策略和匿名账号迁移方案
- 真实匿名账户、个人资料、联系方式、感兴趣与队伍数据读写
- 建队、申请、队长审批、申请人二次确认的数据库事务接口

## 本地启动

需要 Node.js 20+ 和 pnpm。

```bash
pnpm install
pnpm dev
```

打开 [http://localhost:3000](http://localhost:3000)。没有 `.env.local` 时自动使用演示数据，不需要数据库账号。

## 接入 Supabase

1. 创建 Supabase 免费项目。
2. 在 SQL Editor 依次执行：
   - `supabase/migrations/202607190001_initial_schema.sql`
   - `supabase/migrations/202607200001_live_workflows.sql`
3. 复制 `.env.example` 为 `.env.local`，填写项目 URL 和 anon key。
4. 在 Supabase Auth 中开启 Anonymous Sign-Ins。
5. 为管理员配置 GitHub OAuth，并填写 `ADMIN_GITHUB_LOGIN`。

密钥、真实联系方式和用户数据不得提交到 GitHub。

## 部署到 Vercel

1. 将仓库导入 Vercel。
2. 在 Vercel 项目设置中添加 `.env.example` 列出的环境变量。
3. 部署后，把正式域名加入 Supabase Auth 的允许跳转地址。
4. 上线前测试举报、联系方式权限和账号迁移流程。

Vercel Hobby 只适用于个人、非商业用途；免费额度耗尽后项目可能暂停。

## 需求与数据模型

- 产品需求：[docs/PRODUCT_REQUIREMENTS.md](docs/PRODUCT_REQUIREMENTS.md)
- 初始数据库：[supabase/migrations/202607190001_initial_schema.sql](supabase/migrations/202607190001_initial_schema.sql)
- 真实业务流程：[supabase/migrations/202607200001_live_workflows.sql](supabase/migrations/202607200001_live_workflows.sql)
- 匹配算法：[src/lib/matching.ts](src/lib/matching.ts)

## 后续功能

- `@nottingham.edu.cn` 邮箱验证码与 7 天绑定期
- 微信开放平台头像/昵称同步（审核通过后启用）
- 队长审批、成员移除与二次确认的完整前端管理界面
- Cloudflare Turnstile 防滥用验证
- 管理员 GitHub OAuth 权限中间件
- 头像压缩、内容审核和账户迁移码
