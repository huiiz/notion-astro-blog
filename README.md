# Notion Astro Blog

一个可公开复用的中文博客 starter：

- 用 `Notion` 管理文章和页面
- 用 `Astro` 生成静态站点
- 支持 `GitHub Actions` 自动构建与发布
- 可选接入 `Notion Webhook -> Cloudflare Worker -> GitHub Actions`
- 内置 5 套可切换模板与 Notion 驱动的站点配置

这个仓库是公开模板仓库，不绑定任何私人域名、Pages 仓库或私有内容。你可以直接 fork，或把它作为自己的 starter。

## 适合谁

- 想继续在 `Notion` 里写作，但站点用静态博客发布
- 没有服务器，只想用 `GitHub Pages`
- 希望把文章、页面、导航、站点信息统一收进 Notion
- 想要一个别人 fork 后就能继续复用的 starter

## 当前能力

- 构建前从 Notion 同步文章、页面、站点配置和导航
- 支持标签、分类、归档、分页、RSS
- 支持图片、附件、代码块、引用、Callout、Embed
- 支持站点信息和导航从 Notion 独立数据库管理
- 支持 5 套模板：`classic`、`ledger`、`essay`、`clover`、`pulse`
- 未接入 Notion 时，自动回退到本地示例文章和示例页面

## 工作方式

这个项目不会在浏览器运行时直接请求 Notion API，而是在构建阶段同步内容：

1. 运行 `scripts/fetch-notion.mjs`
2. 从 Notion 读取文章、页面、站点配置和导航
3. 生成本地数据文件
   - `src/data/generated/posts.json`
   - `src/data/generated/pages.json`
   - `src/data/generated/site-config.json`
   - `src/data/generated/navigation.json`
4. Astro 基于这些数据生成静态页面
5. GitHub Actions 把 `dist/` 发布到你的 Pages 仓库

这样做的好处：

- 不暴露 `NOTION_TOKEN`
- 完全兼容 `GitHub Pages`
- 访问更快，SEO 更稳定
- Notion 资源可以在构建时缓存到本地静态资源

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

如果你还没接入 Notion，这个 starter 会先使用：

- `src/data/sample-posts.json`
- `src/data/sample-pages.json`

所以也可以先直接运行并预览模板效果。

## 初始化 Notion 模板

如果你已经：

- 创建好了 Notion integration
- 把一个根页面分享给它
- 在本地 `.env` 中填好了 `NOTION_TOKEN`

可以先运行：

```bash
npm run setup:notion:starter
```

这个脚本会在你的 Notion 空间里创建：

- `Blog Admin`
- `Notion Astro Blog Starter`
- `Demo 博客数据库`

如果你还想把站点信息和导航也做成 Notion 可管理数据库，再运行：

```bash
npm run setup:notion:site-config
```

这个脚本会在 `Blog Admin` 下创建：

- `站点配置`
- `导航配置`

推荐使用方式：

- `Blog Admin`：放真实生产数据库、站点配置、导航配置和部署说明，保持私有
- `Notion Astro Blog Starter`：作为可公开复制的模板页
- `Demo 博客数据库`：提供别人复制后即可上手的最小示例

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

### 模板与主题

- `PUBLIC_TEMPLATE_PRESET`
- `PUBLIC_HOME_TEMPLATE`
- `PUBLIC_CARD_STYLE`
- `PUBLIC_SIDEBAR_STYLE`
- `PUBLIC_THEME_*`

### 部署配置

- `SITE_URL`
- `BASE_PATH`
- `PAGES_TARGET_REPOSITORY`
- `PAGES_TARGET_BRANCH`
- `SITE_CNAME`

### Cloudflare Worker

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## 模板与自定义主题

项目现在内置了 5 套可直接切换的模板：

- `classic`
  - 默认首页结构：`showcase`
  - 风格：清爽、明亮、杂志化，适合通用个人博客
- `ledger`
  - 默认首页结构：`journal`
  - 风格：纸张感、编辑部、专栏式，适合长文与持续写作
- `essay`
  - 默认首页结构：`showcase`
  - 风格：学术作者站、清单式内容组织，适合知识型博客
- `clover`
  - 默认首页结构：`showcase`
  - 风格：先展示作者与精选内容，再展开文章流，适合个人品牌首页
- `pulse`
  - 默认首页结构：`focus`
  - 风格：封面感更强、节奏更鲜明，适合专题与系列文章

在 `.env` 中切换模板：

```env
PUBLIC_TEMPLATE_PRESET=classic
```

可选值：

- `classic`
- `ledger`
- `essay`
- `clover`
- `pulse`

也可以单独覆盖布局：

```env
PUBLIC_HOME_TEMPLATE=showcase
PUBLIC_CARD_STYLE=magazine
PUBLIC_SIDEBAR_STYLE=stacked
```

## GitHub Pages 发布

这个 starter 现在使用更直接的“构建后推送发布仓库”方式，而不是旧的 `peaceiris/actions-gh-pages` 强绑定配置。

默认行为：

- 如果没有配置 `PUBLISH_TO_PAGES_TOKEN`，workflow 会只构建、不发布
- 配好 token 后，才会把 `dist/` 推送到目标仓库和目标分支

你需要在源码仓库中配置这些 Secrets：

- `NOTION_TOKEN`
- `NOTION_DATABASE_ID`
- `PUBLISH_TO_PAGES_TOKEN`

推荐配置这些 Variables：

- `SITE_URL`
- `BASE_PATH`
- `PAGES_TARGET_REPOSITORY`
- `PAGES_TARGET_BRANCH`
- `SITE_CNAME`
- 所有 `PUBLIC_BLOG_*`

说明：

- 如果你要发布到同一个仓库，可以把 `PAGES_TARGET_REPOSITORY` 设为当前仓库
- 如果你要发布到 `username.github.io` 仓库，也可以跨仓库发布

## 自动更新

支持这条自动更新链路：

`Notion Webhook -> Cloudflare Worker -> GitHub repository_dispatch -> GitHub Actions -> GitHub Pages`

相关文档：

- `docs/notion-webhook-auto-deploy.md`
- `docs/auto-deploy-checklist.md`
- `automation/notion-webhook-relay`

## 模板仓库原则

这个 starter 仓库默认只保留：

- 模板代码
- 最小示例内容
- 中性默认素材
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
