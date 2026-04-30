# Notion 修改后自动发布

这套方案的目标是：

- 继续在 `Notion` 里写作
- 内容变更后由 `Notion Webhook` 发出通知
- `Cloudflare Worker` 接收通知
- Worker 调用 GitHub 的 `repository_dispatch`
- GitHub Actions 自动重建并发布到 `GitHub Pages`

## 为什么不是运行时直接读取 Notion

因为 `GitHub Pages` 是纯静态托管：

- 不能运行自定义服务端逻辑
- 不适合在前端暴露 `NOTION_TOKEN`
- 更稳的方式是“构建时取数，发布静态页面”

所以自动化的关键不是改成运行时请求，而是让“重新构建”自动发生。

## 当前项目的自动更新结构

当前仓库已经接好这些部分：

- GitHub Actions 支持 `repository_dispatch`
- Cloudflare Worker 已部署
- Worker 已配置 GitHub dispatch secret
- Worker 已配置 Notion webhook verification secret
- GitHub Actions 每 6 小时还有一次兜底自动构建

## 当前使用的 Worker

- Worker 地址：`https://notion-webhook-relay.im-zhenghui.workers.dev`
- 目标仓库：`your-name/your-source-repo`
- 事件名：`notion-content-updated`

配置文件：

- `automation/notion-webhook-relay/wrangler.toml`
- `automation/notion-webhook-relay/src/index.js`

## GitHub Actions 触发方式

工作流文件：

- `.github/workflows/deploy.yml`

当前支持 4 种触发：

- `push`
- `workflow_dispatch`
- `repository_dispatch`
- `schedule`

其中：

- `repository_dispatch` 用于 Notion 内容变更自动更新
- `schedule` 用于兜底重建

## Cloudflare 本地部署所需环境变量

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

示例见：

- `.env.example`
- `automation/notion-webhook-relay/.env.example`

## Worker 需要的 secret

在 Worker 目录下执行：

```bash
cd automation/notion-webhook-relay
npm install
npx wrangler secret put GITHUB_DISPATCH_TOKEN
npx wrangler secret put NOTION_WEBHOOK_VERIFICATION_TOKEN
```

其中：

- `GITHUB_DISPATCH_TOKEN`：用于触发 `repository_dispatch`
- `NOTION_WEBHOOK_VERIFICATION_TOKEN`：用于校验 Notion webhook 签名

## Notion Webhook 推荐订阅事件

建议至少订阅这些事件：

- `page.content_updated`
- `page.properties_updated`
- `page.created`
- `page.moved`

## 如何验证链路

建议按这个顺序测试：

1. 在 Notion 中修改一篇已发布文章
2. 等待大约 30 秒到 2 分钟
3. 查看 GitHub Actions 是否出现新的 `repository_dispatch` 运行
4. 等待构建完成
5. 刷新你的线上站点地址

## 常见问题

### 为什么改完 Notion 没有立刻更新

可能原因：

- Notion webhook 有短暂延迟
- 某次事件没有成功送达
- GitHub Actions 正在排队

当前仓库已经开启每 6 小时一次兜底自动构建，所以即使个别 webhook 漏掉，内容最终也会同步。

### 为什么需要 `verification_token`

Notion 在首次创建 webhook 时会发送一个 `verification_token`。完成验证后，后续请求才能稳定校验签名。

### 如果以后要重新部署 Worker 怎么做

进入 Worker 目录后执行：

```bash
cd automation/notion-webhook-relay
npm install
npx wrangler deploy
```

前提是已经配置好：

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## 参考

- `docs/auto-deploy-checklist.md`
- `automation/notion-webhook-relay/src/index.js`
