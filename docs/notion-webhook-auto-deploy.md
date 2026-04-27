# Notion 修改后自动发布

这个模板支持以下自动更新链路：

- 继续在 `Notion` 里写作
- 内容更新后由 `Notion Webhook` 发出通知
- `Cloudflare Worker` 接收通知
- Worker 调用 GitHub 的 `repository_dispatch`
- GitHub Actions 自动重新构建并发布到 `GitHub Pages`

## 为什么不是运行时直接读取 Notion

因为 `GitHub Pages` 是纯静态托管：

- 不能运行你自己的服务端逻辑
- 不适合在前端暴露 `NOTION_TOKEN`
- 更稳妥的方式是“构建时取数，发布静态页面”

所以这里的自动化重点不是让站点实时请求 Notion，而是让“重新构建”自动发生。

## 当前模板中的自动更新结构

模板仓库已经准备好了：

- 支持 `repository_dispatch` 的 GitHub Actions 工作流
- 可部署的 Cloudflare Worker
- Worker 示例代码
- 自动发布说明文档

## GitHub Actions 触发方式

工作流文件：

- `.github/workflows/deploy.yml`

当前支持：

- `push`
- `workflow_dispatch`
- `repository_dispatch`
- `schedule`

其中：

- `repository_dispatch` 用于 Notion 自动更新
- `schedule` 用于兜底重建

## Worker 目录

- `automation/notion-webhook-relay`

关键文件：

- `automation/notion-webhook-relay/wrangler.toml.example`
- `automation/notion-webhook-relay/src/index.js`

## Worker 本地部署

```bash
cd automation/notion-webhook-relay
npm install
npx wrangler deploy
```

需要的本地环境变量：

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## Worker 需要的 Secret

```bash
npx wrangler secret put GITHUB_DISPATCH_TOKEN
npx wrangler secret put NOTION_WEBHOOK_VERIFICATION_TOKEN
```

含义：

- `GITHUB_DISPATCH_TOKEN`：用于调用 GitHub `repository_dispatch`
- `NOTION_WEBHOOK_VERIFICATION_TOKEN`：用于校验 Notion webhook 签名

## Notion Webhook 推荐订阅事件

建议至少订阅：

- `page.content_updated`
- `page.properties_updated`
- `page.created`
- `page.moved`

## 如何验证链路

建议按这个顺序测试：

1. 在 Notion 中修改一篇已发布文章
2. 等待 30 秒到 2 分钟
3. 查看 GitHub Actions 是否出现新的 `repository_dispatch`
4. 等待构建完成
5. 刷新你的博客地址

## 常见问题

### 为什么改完 Notion 没有立刻更新

可能原因：

- Notion webhook 有短暂延迟
- 某次事件没有成功送达
- GitHub Actions 正在排队

模板默认还带有定时兜底构建，所以即使 webhook 偶发漏掉，后续也会再次同步。

### 为什么需要 `verification_token`

Notion 在首次创建 webhook 时会发送一个 `verification_token`。只有完成验证，后续请求才能稳定校验签名。

## 参考

- `docs/auto-deploy-checklist.md`
- `docs/examples/notion-webhook-relay.js`
