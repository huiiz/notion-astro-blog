import { Client } from "@notionhq/client";
import { access } from "node:fs/promises";

await loadLocalEnv();

const notionToken = process.env.NOTION_TOKEN;
const parentPageId = process.env.NOTION_PARENT_PAGE_ID || "";
const parentPageTitle = process.env.NOTION_PARENT_PAGE_TITLE || process.env.NOTION_ROOT_PAGE_TITLE || "blog-cms";
const adminPageTitle = process.env.NOTION_ADMIN_PAGE_TITLE || "Blog Admin";
const siteConfigDatabaseTitle = process.env.NOTION_SITE_CONFIG_DATABASE_TITLE || "\u7ad9\u70b9\u914d\u7f6e";
const navigationDatabaseTitle = process.env.NOTION_NAVIGATION_DATABASE_TITLE || "\u5bfc\u822a\u914d\u7f6e";

if (!notionToken) {
  throw new Error("Missing NOTION_TOKEN in .env");
}

const notion = new Client({ auth: notionToken });
const parentPage = await resolveParentPage();
const adminPage = (await findChildPageByTitle(parentPage.id, adminPageTitle)) || (await createChildPage(parentPage.id, adminPageTitle));
const siteConfigDatabase =
  (await findChildDatabaseByTitle(adminPage.id, siteConfigDatabaseTitle)) ||
  (await createSiteConfigDatabase(adminPage.id, siteConfigDatabaseTitle));
const navigationDatabase =
  (await findChildDatabaseByTitle(adminPage.id, navigationDatabaseTitle)) ||
  (await createNavigationDatabase(adminPage.id, navigationDatabaseTitle));

await ensureSiteConfigDatabaseSchema(siteConfigDatabase);
await ensureSiteConfigRows(siteConfigDatabase.id);
await ensureNavigationRows(navigationDatabase.id);

console.log(
  JSON.stringify(
    {
      parentPage: { id: parentPage.id, url: parentPage.url, title: getPageTitle(parentPage) },
      adminPage: { id: adminPage.id, url: adminPage.url, title: getPageTitle(adminPage) },
      siteConfigDatabase: { id: siteConfigDatabase.id, url: siteConfigDatabase.url, title: getDatabaseTitle(siteConfigDatabase) },
      navigationDatabase: { id: navigationDatabase.id, url: navigationDatabase.url, title: getDatabaseTitle(navigationDatabase) }
    },
    null,
    2
  )
);

async function resolveParentPage() {
  if (parentPageId) {
    return notion.pages.retrieve({ page_id: parentPageId });
  }

  const exactMatch = await findPageByTitle(parentPageTitle);
  if (exactMatch) {
    return exactMatch;
  }

  const fallbackPages = await searchPages("");
  if (fallbackPages.length === 1) {
    return fallbackPages[0];
  }

  const pageTitles = fallbackPages.map((page) => getPageTitle(page)).filter(Boolean);
  throw new Error(
    `Could not determine the Notion parent page. Share a single page with the integration or set NOTION_PARENT_PAGE_ID / NOTION_PARENT_PAGE_TITLE. Visible pages: ${pageTitles.join(", ")}`
  );
}

async function createChildPage(parentId, title) {
  return notion.pages.create({
    parent: { page_id: parentId },
    properties: {
      title: {
        title: [{ type: "text", text: { content: title } }]
      }
    }
  });
}

async function createSiteConfigDatabase(parentId, title) {
  return notion.databases.create({
    parent: { page_id: parentId },
    title: [{ type: "text", text: { content: title } }],
    is_inline: true,
    properties: {
      "\u952e\u540d": { title: {} },
      "\u503c": { rich_text: {} },
      "\u9009\u9879\u503c": {
        select: {
          options: enumConfigOptions().map((name) => ({ name, color: "default" }))
        }
      },
      "\u7c7b\u578b": {
        select: {
          options: [
            { name: "text", color: "default" },
            { name: "url", color: "blue" },
            { name: "number", color: "green" },
            { name: "boolean", color: "yellow" },
            { name: "json", color: "purple" },
            { name: "asset", color: "pink" }
          ]
        }
      },
      "\u542f\u7528": { checkbox: {} },
      "\u8d44\u6e90": { files: {} },
      "\u5907\u6ce8": { rich_text: {} }
    }
  });
}

async function ensureSiteConfigDatabaseSchema(database) {
  const existingProperties = database?.properties || {};
  const properties = {};

  if (!existingProperties["\u9009\u9879\u503c"]) {
    properties["\u9009\u9879\u503c"] = {
      select: {
        options: enumConfigOptions().map((name) => ({ name, color: "default" }))
      }
    };
  }

  if (Object.keys(properties).length === 0) {
    return database;
  }

  return notion.databases.update({
    database_id: database.id,
    properties
  });
}

async function createNavigationDatabase(parentId, title) {
  return notion.databases.create({
    parent: { page_id: parentId },
    title: [{ type: "text", text: { content: title } }],
    is_inline: true,
    properties: {
      "\u540d\u79f0": { title: {} },
      "\u94fe\u63a5": { rich_text: {} },
      "\u5916\u94fe": { checkbox: {} },
      "\u542f\u7528": { checkbox: {} },
      "\u6392\u5e8f": { number: { format: "number" } },
      "\u5907\u6ce8": { rich_text: {} }
    }
  });
}

async function ensureSiteConfigRows(databaseId) {
  const existingRows = await notion.databases.query({ database_id: databaseId, page_size: 100 });
  const existingRowsByKey = new Map(
    existingRows.results
      .map((row) => [getPropertyText(row.properties?.["\u952e\u540d"]), row])
      .filter(([key]) => Boolean(key))
  );

  for (const row of buildDefaultSiteConfigRows()) {
    const existingRow = existingRowsByKey.get(row.key);

    if (existingRow) {
      await hydrateEnumConfigSelection(existingRow, row);
      continue;
    }

    await notion.pages.create({
      parent: { database_id: databaseId },
      properties: buildSiteConfigProperties(row)
    });
  }
}

async function hydrateEnumConfigSelection(existingRow, row) {
  if (!row.optionValue) {
    return;
  }

  const currentOption = existingRow.properties?.["\u9009\u9879\u503c"]?.select?.name || "";
  if (currentOption) {
    return;
  }

  const currentTextValue = getPropertyText(existingRow.properties?.["\u503c"]).trim();
  const candidate = currentTextValue || row.optionValue;
  if (!enumConfigOptions().includes(candidate)) {
    return;
  }

  await notion.pages.update({
    page_id: existingRow.id,
    properties: {
      "\u9009\u9879\u503c": { select: { name: candidate } }
    }
  });
}

async function ensureNavigationRows(databaseId) {
  const existingRows = await notion.databases.query({ database_id: databaseId, page_size: 100 });
  if (existingRows.results.length > 0) {
    return;
  }

  for (const row of buildDefaultNavigationRows()) {
    await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        "\u540d\u79f0": titleValue(row.label),
        "\u94fe\u63a5": richTextValue(row.href),
        "\u5916\u94fe": { checkbox: row.external },
        "\u542f\u7528": { checkbox: true },
        "\u6392\u5e8f": { number: row.order },
        "\u5907\u6ce8": richTextValue(row.note)
      }
    });
  }
}

function buildDefaultSiteConfigRows() {
  return [
    {
      key: "site.title",
      value: readPublicEnv("PUBLIC_BLOG_TITLE", "My Blog"),
      type: "text",
      note: "\u7ad9\u70b9\u540d\u79f0"
    },
    {
      key: "site.subtitle",
      value: readPublicEnv("PUBLIC_BLOG_SUBTITLE", "New Beginning, New Way"),
      type: "text",
      note: "\u5bfc\u822a\u680f\u526f\u6807\u9898"
    },
    {
      key: "site.description",
      value: readPublicEnv("PUBLIC_BLOG_DESCRIPTION", "Notes on tech, projects, and life."),
      type: "text",
      note: "\u9996\u9875\u4e0e SEO \u63cf\u8ff0"
    },
    {
      key: "site.author",
      value: readPublicEnv("PUBLIC_BLOG_AUTHOR", "Your Name"),
      type: "text",
      note: "\u4f5c\u8005\u540d\u79f0"
    },
    {
      key: "site.motto",
      value: readPublicEnv("PUBLIC_BLOG_MOTTO", "Build slowly, think clearly."),
      type: "text",
      note: "\u4fa7\u8fb9\u680f\u7b80\u77ed\u7b7e\u540d"
    },
    {
      key: "site.github",
      value: readPublicEnv("PUBLIC_BLOG_GITHUB", "https://github.com/your-name"),
      type: "url",
      note: "GitHub \u4e3b\u9875"
    },
    {
      key: "site.profile",
      value: readPublicEnv("PUBLIC_BLOG_PROFILE", "https://your-site.example.com/"),
      type: "url",
      note: "\u5916\u90e8\u4e3b\u9875\u94fe\u63a5"
    },
    {
      key: "site.avatar",
      value: readPublicEnv("PUBLIC_BLOG_AVATAR", "/img/starter-avatar.svg"),
      type: "asset",
      note: "\u4f5c\u8005\u5934\u50cf\uff0c\u53ef\u76f4\u63a5\u4e0a\u4f20\u5230\u8d44\u6e90\u5217"
    },
    {
      key: "site.logo",
      value: readPublicEnv("PUBLIC_BLOG_LOGO", "/img/starter-logo.svg"),
      type: "asset",
      note: "\u5bfc\u822a Logo"
    },
    {
      key: "site.defaultCover",
      value: readPublicEnv("PUBLIC_BLOG_DEFAULT_COVER", "/img/starter-cover.svg"),
      type: "asset",
      note: "\u9875\u9762\u9ed8\u8ba4\u5c01\u9762"
    },
    {
      key: "site.runtimeSince",
      value: readPublicEnv("PUBLIC_BLOG_RUNTIME_SINCE", "2024-01-01"),
      type: "text",
      note: "\u7ad9\u70b9\u5f00\u59cb\u65e5\u671f"
    },
    {
      key: "site.recordText",
      value: readPublicEnv("PUBLIC_BLOG_RECORD_TEXT", ""),
      type: "text",
      note: "\u5907\u6848\u6216\u9875\u811a\u989d\u5916\u6587\u5b57"
    },
    {
      key: "site.recordLink",
      value: readPublicEnv("PUBLIC_BLOG_RECORD_LINK", ""),
      type: "url",
      note: "\u9875\u811a\u989d\u5916\u94fe\u63a5"
    },
    {
      key: "theme.preset",
      value: readPublicEnv("PUBLIC_TEMPLATE_PRESET", "classic"),
      optionValue: readPublicEnv("PUBLIC_TEMPLATE_PRESET", "classic"),
      type: "text",
      note: "\u5df2\u5185\u7f6e\u6a21\u677f\uff1aclassic | ledger | essay | clover | pulse"
    },
    {
      key: "theme.homeTemplate",
      value: readPublicEnv("PUBLIC_HOME_TEMPLATE", ""),
      optionValue: readPublicEnv("PUBLIC_HOME_TEMPLATE", ""),
      type: "text",
      note: "\u53ef\u9009\uff1ashowcase | journal | focus"
    },
    {
      key: "theme.cardStyle",
      value: readPublicEnv("PUBLIC_CARD_STYLE", ""),
      optionValue: readPublicEnv("PUBLIC_CARD_STYLE", ""),
      type: "text",
      note: "\u53ef\u9009\uff1amagazine | compact | outline"
    },
    {
      key: "theme.sidebarStyle",
      value: readPublicEnv("PUBLIC_SIDEBAR_STYLE", ""),
      optionValue: readPublicEnv("PUBLIC_SIDEBAR_STYLE", ""),
      type: "text",
      note: "\u53ef\u9009\uff1astacked | minimal"
    }
  ];
}

function buildDefaultNavigationRows() {
  return [
    { label: "\u9996\u9875", href: "/", external: false, order: 1, note: "\u7ad9\u70b9\u9996\u9875" },
    { label: "\u5f52\u6863", href: "/archive/", external: false, order: 2, note: "\u65f6\u95f4\u5f52\u6863" },
    { label: "\u6807\u7b7e", href: "/tags/", external: false, order: 3, note: "\u6807\u7b7e\u5217\u8868" },
    { label: "\u5206\u7c7b", href: "/categories/", external: false, order: 4, note: "\u5206\u7c7b\u5217\u8868" },
    { label: "\u53cb\u94fe", href: "/link/", external: false, order: 5, note: "\u53cb\u60c5\u94fe\u63a5" },
    { label: "\u5173\u4e8e", href: "/about/", external: false, order: 6, note: "\u5173\u4e8e\u9875" },
    {
      label: "\u4e2a\u4eba\u4e3b\u9875",
      href: readPublicEnv("PUBLIC_BLOG_PROFILE", "https://your-site.example.com/"),
      external: true,
      order: 7,
      note: "\u5916\u90e8\u4e3b\u9875"
    }
  ];
}

function buildSiteConfigProperties(row) {
  return {
    "\u952e\u540d": titleValue(row.key),
    "\u503c": richTextValue(row.value),
    ...(row.optionValue
      ? {
          "\u9009\u9879\u503c": { select: { name: row.optionValue } }
        }
      : {}),
    "\u7c7b\u578b": { select: { name: row.type } },
    "\u542f\u7528": { checkbox: true },
    "\u5907\u6ce8": richTextValue(row.note)
  };
}

function enumConfigOptions() {
  return [
    "classic",
    "ledger",
    "essay",
    "clover",
    "pulse",
    "showcase",
    "journal",
    "focus",
    "magazine",
    "compact",
    "outline",
    "stacked",
    "minimal"
  ];
}

async function findPageByTitle(title) {
  const pages = await searchPages(title);
  return pages.find((page) => getPageTitle(page) === title) || null;
}

async function searchPages(query) {
  const response = await notion.search({
    query,
    filter: { property: "object", value: "page" },
    page_size: 20
  });

  return response.results.filter((item) => item.object === "page");
}

async function findChildPageByTitle(parentPageId, title) {
  const children = await listAllBlockChildren(parentPageId);
  const pageBlocks = children.filter((item) => item.type === "child_page");
  const match = pageBlocks.find((item) => item.child_page?.title === title);
  return match ? notion.pages.retrieve({ page_id: match.id }) : null;
}

async function findChildDatabaseByTitle(parentPageId, title) {
  const children = await listAllBlockChildren(parentPageId);
  const databaseBlocks = children.filter((item) => item.type === "child_database");
  const match = databaseBlocks.find((item) => item.child_database?.title === title);
  return match ? notion.databases.retrieve({ database_id: match.id }) : null;
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
  if (property.type === "title") {
    return property.title.map((item) => item.plain_text).join("");
  }
  if (property.type === "rich_text") {
    return property.rich_text.map((item) => item.plain_text).join("");
  }
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

function readPublicEnv(name, fallback) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
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
