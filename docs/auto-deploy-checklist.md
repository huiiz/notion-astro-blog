# Notion 自动发布清单

这个模板已经具备这些能力：

- 推送到 `main` 时自动构建
- 接收 `repository_dispatch` 事件时自动构建
- 每 6 小时执行一次定时兜底构建

相关文件：

- `.github/workflows/deploy.yml`
- `automation/notion-webhook-relay/wrangler.toml.example`
- `automation/notion-webhook-relay/src/index.js`

## 你需要自己完成的外部配置

1. 创建自己的 Notion integration
2. 创建自己的博客数据库
3. 创建自己的 GitHub Pages 目标仓库
4. 创建自己的 Cloudflare Worker
5. 创建自己的 Notion Webhook

## GitHub 仓库 Secrets

至少需要：

- `NOTION_TOKEN`
- `NOTION_DATABASE_ID`
- `PUBLISH_TO_PAGES_TOKEN`

## GitHub 仓库 Variables

建议配置：

- `SITE_URL`
- `BASE_PATH`
- `PAGES_TARGET_REPOSITORY`
- `PAGES_TARGET_BRANCH`
- `SITE_CNAME`
- `PUBLIC_BLOG_TITLE`
- `PUBLIC_BLOG_SUBTITLE`
- `PUBLIC_BLOG_DESCRIPTION`
- `PUBLIC_BLOG_AUTHOR`
- `PUBLIC_BLOG_MOTTO`
- `PUBLIC_BLOG_GITHUB`
- `PUBLIC_BLOG_PROFILE`
- `PUBLIC_BLOG_AVATAR`
- `PUBLIC_BLOG_LOGO`
- `PUBLIC_BLOG_DEFAULT_COVER`
- `PUBLIC_BLOG_RUNTIME_SINCE`
- `PUBLIC_BLOG_RECORD_TEXT`
- `PUBLIC_BLOG_RECORD_LINK`

## Worker 本地部署所需环境变量

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## Worker Secrets

- `GITHUB_DISPATCH_TOKEN`
- `NOTION_WEBHOOK_VERIFICATION_TOKEN`

## 通常还需要手动完成的页面操作

1. Cloudflare 首次登录授权
2. Notion Webhook 创建与验证弹窗确认
