import { Client } from "@notionhq/client";
import { access } from "node:fs/promises";

await loadLocalEnv();

const notionToken = process.env.NOTION_TOKEN;

if (!notionToken) {
  throw new Error("Missing NOTION_TOKEN in .env");
}

const notion = new Client({ auth: notionToken });

const ROOT_PAGE_TITLE = "blog-cms";
const ADMIN_PAGE_TITLE = "Blog Admin";
const STARTER_PAGE_TITLE = "Notion Astro Blog Starter";
const STARTER_DATABASE_TITLE = "Demo 博客数据库";

const rootPage = await findPageByTitle(ROOT_PAGE_TITLE);

if (!rootPage) {
  throw new Error(`Could not find shared page "${ROOT_PAGE_TITLE}".`);
}

const existingAdminPage = await findChildPageByTitle(rootPage.id, ADMIN_PAGE_TITLE);
const existingStarterPage = await findChildPageByTitle(rootPage.id, STARTER_PAGE_TITLE);

const adminPage =
  existingAdminPage ??
  (await notion.pages.create({
    parent: { page_id: rootPage.id },
    properties: {
      title: {
        title: [{ type: "text", text: { content: ADMIN_PAGE_TITLE } }]
      }
    }
  }));

const starterPage =
  existingStarterPage ??
  (await notion.pages.create({
    parent: { page_id: rootPage.id },
    properties: {
      title: {
        title: [{ type: "text", text: { content: STARTER_PAGE_TITLE } }]
      }
    }
  }));

await replacePageChildren(adminPage.id, buildAdminBlocks());
await replacePageChildren(starterPage.id, buildStarterIntroBlocks());

let starterDatabase = await findDatabaseByTitle(STARTER_DATABASE_TITLE);

if (!starterDatabase) {
  starterDatabase = await notion.databases.create({
    parent: { page_id: starterPage.id },
    title: [{ type: "text", text: { content: STARTER_DATABASE_TITLE } }],
    is_inline: true,
    properties: {
      标题: { title: {} },
      链接名: { rich_text: {} },
      状态: {
        select: {
          options: [
            { name: "草稿", color: "gray" },
            { name: "已发布", color: "green" }
          ]
        }
      },
      发布日期: { date: {} },
      标签: {
        multi_select: {
          options: [
            { name: "建站", color: "blue" },
            { name: "教程", color: "green" },
            { name: "Notion", color: "brown" },
            { name: "Astro", color: "orange" }
          ]
        }
      },
      分类: {
        select: {
          options: [
            { name: "博客", color: "default" },
            { name: "笔记", color: "purple" },
            { name: "页面", color: "pink" }
          ]
        }
      },
      摘要: { rich_text: {} },
      推荐: { checkbox: {} },
      类型: {
        select: {
          options: [
            { name: "文章", color: "blue" },
            { name: "页面", color: "yellow" }
          ]
        }
      }
    }
  });
}

await ensureDemoEntries(starterDatabase.id);

console.log(
  JSON.stringify(
    {
      rootPage: { id: rootPage.id, url: rootPage.url },
      adminPage: { id: adminPage.id, url: adminPage.url },
      starterPage: { id: starterPage.id, url: starterPage.url },
      starterDatabase: { id: starterDatabase.id, url: starterDatabase.url }
    },
    null,
    2
  )
);

function buildAdminBlocks() {
  return [
    heading1("博客后台管理"),
    paragraph("这个页面用于放置真实生产环境的内容入口、自动部署说明和管理用链接。建议保持私有，不对外公开。"),
    callout("真实生产数据库继续使用你当前的博客内容数据库，不需要把它公开给别人复制。"),
    heading2("建议放在这里的内容"),
    bulleted("真实文章数据库入口"),
    bulleted("关于页、友链页等站点页面的维护说明"),
    bulleted("Webhook / GitHub Actions / Cloudflare Worker 的配置记录"),
    bulleted("封面、资源、附件的整理规范"),
    heading2("生产库说明"),
    paragraph("当前博客已经支持 Notion -> GitHub Actions -> GitHub Pages 的自动发布链路。你平时只需要在真实数据库中写作和修改内容。"),
    quote("这个页面是后台，不是模板。对外公开时请使用 Starter 页面和 Demo 数据库。")
  ];
}

function buildStarterIntroBlocks() {
  return [
    heading1("Notion Astro Blog Starter"),
    paragraph("这个页面是给别人复制的公开模板页。建议你在 Notion 前端把它公开，并开启“允许复制为模板”。"),
    callout("下面这个 Demo 数据库是最小可用示例。复制它后，只要填入自己的 Notion Token、数据库 ID 和站点地址，就能把博客跑起来。"),
    heading2("使用说明"),
    numbered("复制这个页面和 Demo 数据库到你自己的 Notion 工作区。"),
    numbered("把数据库分享给你的 Notion integration。"),
    numbered("在项目 `.env` 中填入 `NOTION_TOKEN`、`NOTION_DATABASE_ID`、`SITE_URL` 和 `BASE_PATH`。"),
    numbered("运行 `npm install`。"),
    numbered("运行 `npm run sync:notion` 拉取内容。"),
    numbered("运行 `npm run dev` 本地预览，确认无误后推送到 GitHub。"),
    numbered("如果你想用 Notion 管理站点信息和导航，再运行 `npm run setup:notion:site-config`。"),
    heading2("字段说明"),
    bulleted("标题：文章标题，必须填写。"),
    bulleted("链接名：文章 URL slug，例如 `hello-world`。"),
    bulleted("状态：只有“已发布”的内容会出现在站点中。"),
    bulleted("发布日期：文章或页面对应的发布日期。"),
    bulleted("标签 / 分类：用于列表展示和内容组织。"),
    bulleted("摘要：首页卡片和 SEO 描述使用。"),
    bulleted("推荐：可用于首页精选。"),
    bulleted("类型：区分“文章”和“页面”。"),
    heading2("项目地址"),
    paragraph("源码仓库：`https://github.com/huiiz/notion-astro-blog`"),
    paragraph("发布仓库可以是当前仓库的 `gh-pages`，也可以是 `username.github.io` Pages 仓库。"),
    paragraph("自动部署、Notion Webhook 和站点配置的完整说明可以直接参考 README 与 `docs/`。")
  ];
}

async function ensureDemoEntries(databaseId) {
  const existing = await notion.databases.query({ database_id: databaseId, page_size: 50 });
  const titles = new Set(
    existing.results
      .map((page) => getPropertyText(page.properties?.标题))
      .filter(Boolean)
  );

  if (!titles.has("欢迎使用 Notion Astro Blog")) {
    await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        标题: titleValue("欢迎使用 Notion Astro Blog"),
        链接名: richTextValue("welcome-to-notion-astro-blog"),
        状态: { select: { name: "已发布" } },
        发布日期: { date: { start: "2026-05-01" } },
        标签: { multi_select: [{ name: "建站" }, { name: "Notion" }, { name: "Astro" }] },
        分类: { select: { name: "博客" } },
        摘要: richTextValue("这是一篇示例文章，用来帮助你确认 Notion 数据库字段、内容结构和 Astro 站点同步流程都已经正常工作。"),
        推荐: { checkbox: true },
        类型: { select: { name: "文章" } }
      },
      children: [
        paragraphBlock("欢迎，这是一篇模板示例文章。"),
        paragraphBlock("你可以直接修改这篇文章，也可以删除它之后开始写自己的第一篇内容。"),
        heading2("写作建议"),
        bulletedBlock("页面封面直接使用 Notion 页面顶部 Cover。"),
        bulletedBlock("正文里可以直接插入图片、代码块、引用和附件。"),
        bulletedBlock("发布前把“状态”改成“已发布”。"),
        heading2("下一步"),
        bulletedBlock("如果你只是先预览模板效果，保留这篇示例文章即可。"),
        bulletedBlock("如果你已经准备接入真实内容，可以把它删掉，换成自己的文章。")
      ]
    });
  }

  if (!titles.has("关于")) {
    await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        标题: titleValue("关于"),
        链接名: richTextValue("about"),
        状态: { select: { name: "已发布" } },
        发布日期: { date: { start: "2026-05-01" } },
        标签: { multi_select: [{ name: "建站" }] },
        分类: { select: { name: "页面" } },
        摘要: richTextValue("一个示例页面，用于展示如何把单页内容也放进同一个 Notion 数据库里统一管理。"),
        推荐: { checkbox: false },
        类型: { select: { name: "页面" } }
      },
      children: [
        paragraphBlock("这里可以写你的个人简介、研究方向、联系方式，或者任何你希望长期展示的页面内容。")
      ]
    });
  }

  if (!titles.has("友链")) {
    await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        标题: titleValue("友链"),
        链接名: richTextValue("link"),
        状态: { select: { name: "已发布" } },
        发布日期: { date: { start: "2026-05-01" } },
        标签: { multi_select: [{ name: "建站" }] },
        分类: { select: { name: "页面" } },
        摘要: richTextValue("一个示例友链页，你可以在这里补充自己的友链说明，或者后续接入独立友链数据。"),
        推荐: { checkbox: false },
        类型: { select: { name: "页面" } }
      },
      children: [
        paragraphBlock("这个页面默认用于放置友情链接、合作伙伴或推荐站点。"),
        paragraphBlock("如果你暂时没有友链内容，也可以先保留这页，后续再补。")
      ]
    });
  }
}

async function findPageByTitle(title) {
  const response = await notion.search({
    query: title,
    filter: { property: "object", value: "page" },
    page_size: 20
  });

  return response.results.find((item) => item.object === "page" && getPageTitle(item) === title) ?? null;
}

async function findChildPageByTitle(parentPageId, title) {
  const children = await listAllBlockChildren(parentPageId);
  const pageBlocks = children.filter((item) => item.type === "child_page");
  const hit = pageBlocks.find((item) => item.child_page?.title === title);

  if (!hit) return null;

  return notion.pages.retrieve({ page_id: hit.id });
}

async function findDatabaseByTitle(title) {
  const response = await notion.search({
    query: title,
    filter: { property: "object", value: "database" },
    page_size: 20
  });

  return response.results.find((item) => item.object === "database" && getDatabaseTitle(item) === title) ?? null;
}

async function replacePageChildren(blockId, nextChildren) {
  const existingChildren = await listAllBlockChildren(blockId);

  for (const child of existingChildren) {
    if (child.type === "child_database" || child.type === "child_page") {
      continue;
    }

    await notion.blocks.delete({ block_id: child.id });
  }

  for (let index = 0; index < nextChildren.length; index += 50) {
    const chunk = nextChildren.slice(index, index + 50);
    await notion.blocks.children.append({
      block_id: blockId,
      children: chunk
    });
  }
}

async function listAllBlockChildren(blockId) {
  const results = [];
  let cursor = undefined;

  while (true) {
    const response = await notion.blocks.children.list({
      block_id: blockId,
      page_size: 100,
      start_cursor: cursor
    });

    results.push(...response.results);

    if (!response.has_more) {
      break;
    }

    cursor = response.next_cursor ?? undefined;
  }

  return results;
}

function getPageTitle(page) {
  const titleProp = Object.values(page.properties || {}).find((value) => value?.type === "title");
  return Array.isArray(titleProp?.title) ? titleProp.title.map((item) => item.plain_text).join("") : "";
}

function getDatabaseTitle(database) {
  return Array.isArray(database.title) ? database.title.map((item) => item.plain_text).join("") : "";
}

function getPropertyText(property) {
  if (!property) return "";
  if (property.type === "title") return property.title.map((item) => item.plain_text).join("");
  if (property.type === "rich_text") return property.rich_text.map((item) => item.plain_text).join("");
  return "";
}

function titleValue(content) {
  return {
    title: [{ type: "text", text: { content } }]
  };
}

function richTextValue(content) {
  return {
    rich_text: [{ type: "text", text: { content } }]
  };
}

function richText(content) {
  return [{ type: "text", text: { content } }];
}

function paragraph(content) {
  return paragraphBlock(content);
}

function paragraphBlock(content) {
  return {
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: richText(content)
    }
  };
}

function heading1(content) {
  return {
    object: "block",
    type: "heading_1",
    heading_1: {
      rich_text: richText(content)
    }
  };
}

function heading2(content) {
  return {
    object: "block",
    type: "heading_2",
    heading_2: {
      rich_text: richText(content)
    }
  };
}

function callout(content) {
  return {
    object: "block",
    type: "callout",
    callout: {
      rich_text: richText(content),
      icon: { emoji: "📝" }
    }
  };
}

function quote(content) {
  return {
    object: "block",
    type: "quote",
    quote: {
      rich_text: richText(content)
    }
  };
}

function bulleted(content) {
  return bulletedBlock(content);
}

function bulletedBlock(content) {
  return {
    object: "block",
    type: "bulleted_list_item",
    bulleted_list_item: {
      rich_text: richText(content)
    }
  };
}

function numbered(content) {
  return {
    object: "block",
    type: "numbered_list_item",
    numbered_list_item: {
      rich_text: richText(content)
    }
  };
}

async function loadLocalEnv() {
  if (typeof process.loadEnvFile !== "function") return;

  try {
    await access(".env");
    process.loadEnvFile(".env");
  } catch {
    // Ignore missing local env file.
  }
}
