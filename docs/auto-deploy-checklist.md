# Notion 自动发布清单

当前仓库已经具备这些能力：

- 推送到 `main` 时自动构建并发布
- 接收 `repository_dispatch` 事件时自动构建并发布
- 每 6 小时自动兜底构建一次

相关文件：

- `.github/workflows/deploy.yml`
- `automation/notion-webhook-relay/wrangler.toml`
- `automation/notion-webhook-relay/src/index.js`

## Worker 当前目标仓库

- `GITHUB_OWNER = your-github-name`
- `GITHUB_REPO = your-source-repo`
- `NOTION_WEBHOOK_EVENT_TYPE = notion-content-updated`

## 还需要的外部配置

1. Cloudflare Worker 登录并部署
2. Worker secret `GITHUB_DISPATCH_TOKEN`
3. 在 Notion Integration 后台创建 Webhook
4. 用 Notion 返回的 `verification_token` 完成验证，并回填到 Worker secret `NOTION_WEBHOOK_VERIFICATION_TOKEN`

## 你需要提供给这个项目的敏感信息

源码仓库 `your-name/your-source-repo` 中需要：

- `NOTION_TOKEN`
- `NOTION_DATABASE_ID`
- `PUBLISH_TO_PAGES_TOKEN`

GitHub 仓库 Variables 中建议配置：

- `SITE_URL`
- `BASE_PATH`
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

## 通常还需要你手动点的页面

即使脚本和 token 都齐了，下面这两步通常还是需要你本人在 Web 界面里完成：

1. Cloudflare 首次登录授权
2. Notion Webhook 创建与验证弹窗确认
