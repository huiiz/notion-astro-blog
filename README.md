# Notion Astro Blog

一个可公开复用的中文博客模板：

- 用 `Notion` 管理文章和页面
- 用 `Astro` 生成静态站点
- 用 `GitHub Actions` 自动构建
- 发布到 `GitHub Pages`
- 可选接入 `Notion Webhook -> Cloudflare Worker -> GitHub Actions` 自动更新链路

这个仓库是公开模板仓库，不绑定任何个人域名、Pages 仓库或私有 Notion 数据。

## 适合谁

- 没有服务器，想直接用 `GitHub Pages`
- 希望继续在 `Notion` 里写作
- 想把文章和页面统一放进一个 Notion 数据库管理
- 想要一个别人 fork 或下载后就能继续复用的 starter

## 工作方式

这个项目不是在浏览器运行时直接请求 Notion API，而是在构建阶段同步内容：

1. 运行 `scripts/fetch-notion.mjs`
2. 从 Notion 数据库读取文章和页面
3. 生成本地数据文件
   - `src/data/generated/posts.json`
   - `src/data/generated/pages.json`
   - `src/data/generated/friends.json`
4. Astro 根据这些数据生成静态页面
5. GitHub Actions 把 `dist/` 发布到你的 Pages 仓库

这样做的好处：

- 不暴露 `NOTION_TOKEN`
- 完全兼容 `GitHub Pages`
- 部署简单
- SEO 更稳定

## 快速开始

1. 安装依赖

```bash
npm install
```

2. 新建 `.env`

参考 `.env.example`，至少填写：

- `NOTION_TOKEN`
- `NOTION_DATABASE_ID`
- `SITE_URL`
- `BASE_PATH`

3. 本地开发

```bash
npm run dev
```

4. 同步 Notion 内容

```bash
npm run sync:notion
```

5. 构建站点

```bash
npm run build
```

如果你还没接入 Notion，这个模板会先使用 `src/data/sample-posts.json` 中的示例文章，因此也可以先直接运行和预览样式。

## 推荐的 Notion 字段

推荐使用这些中文字段：

- `标题`：`title`
- `链接名`：`rich_text`
- `状态`：`select`
- `发布日期`：`date`
- `标签`：`multi_select`
- `分类`：`select`
- `摘要`：`rich_text`
- `推荐`：`checkbox`
- `类型`：`select`

推荐字段值：

- `状态`：`已发布`
- `类型`：`文章` / `页面`

补充说明：

- 页面封面统一使用 Notion 页面顶部的 `page cover`
- 不再依赖单独的“封面”属性字段

## 初始化 Notion 模板页

如果你已经：

- 创建好了 Notion integration
- 把一个根页面分享给它
- 在本地 `.env` 中填好了 `NOTION_TOKEN`

可以运行：

```bash
npm run setup:notion:starter
```

这个脚本会在你的 Notion 空间里创建：

- `Blog Admin`
- `Notion Astro Blog Starter`
- `Demo 博客数据库`

建议的使用方式：

- `Blog Admin`：放真实生产数据库和后台说明，保持私有
- `Notion Astro Blog Starter`：作为公开模板页
- `Demo 博客数据库`：给别人复制使用

## 环境变量

### 必填

- `NOTION_TOKEN`
- `NOTION_DATABASE_ID`

### 站点信息

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

### 部署配置

- `SITE_URL`
- `BASE_PATH`
- `PAGES_TARGET_REPOSITORY`
- `PAGES_TARGET_BRANCH`
- `SITE_CNAME`

### Cloudflare Worker

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## GitHub Pages 发布

这个模板默认使用 GitHub Actions + `peaceiris/actions-gh-pages` 发布。

你需要在源码仓库里配置这些 Secrets：

- `NOTION_TOKEN`
- `NOTION_DATABASE_ID`
- `PUBLISH_TO_PAGES_TOKEN`

建议配置这些 Variables：

- `SITE_URL`
- `BASE_PATH`
- `PAGES_TARGET_REPOSITORY`
- `PAGES_TARGET_BRANCH`
- `SITE_CNAME`
- 所有 `PUBLIC_BLOG_*`

说明：

- 如果你要发布到同一个仓库，可以把 `PAGES_TARGET_REPOSITORY` 设为当前仓库名
- 如果你要发布到 `username.github.io` 仓库，也可以跨仓库发布

## 自动更新

支持这条自动更新链路：

`Notion Webhook -> Cloudflare Worker -> GitHub repository_dispatch -> GitHub Actions -> GitHub Pages`

相关文档：

- `docs/notion-webhook-auto-deploy.md`
- `docs/auto-deploy-checklist.md`
- `automation/notion-webhook-relay`

## 当前支持的内容类型

- 段落
- 标题
- 无序列表
- 有序列表
- 引用
- Callout
- 代码块
- 分割线
- 图片
- 附件
- Embed

## 模板仓库原则

这个 starter 仓库默认只保留：

- 模板代码
- 最小示例内容
- 中性默认资源
- 自动部署脚本与说明文档

它不应该包含：

- 你的真实 Notion 内容
- 你的私有 token
- 你的生产构建产物
- 你的个人历史图片和附件全集

## 推荐仓库拆分方式

如果你同时维护自己的生产博客，建议这样拆分：

1. 一个公开的 starter 模板仓库
2. 一个实际写作和开发使用的源码仓库
3. 一个专门承接 `GitHub Pages` 发布结果的仓库

这样模板、生产环境和发布产物就能保持干净分离。
