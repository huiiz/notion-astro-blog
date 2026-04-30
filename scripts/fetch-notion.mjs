import { Client } from "@notionhq/client";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, extname, join, resolve } from "node:path";

await loadLocalEnv();

const postsOutputFile = resolve("src/data/generated/posts.json");
const pagesOutputFile = resolve("src/data/generated/pages.json");
const siteConfigOutputFile = resolve("src/data/generated/site-config.json");
const navigationOutputFile = resolve("src/data/generated/navigation.json");
const notionAssetsDir = resolve("public/notion");
const notionAssetsUrlBase = "/notion";
const notionToken = process.env.NOTION_TOKEN;
const databaseId = process.env.NOTION_DATABASE_ID;
const siteConfigDatabaseId = process.env.NOTION_SITE_CONFIG_DATABASE_ID || "";
const navigationDatabaseId = process.env.NOTION_NAVIGATION_DATABASE_ID || "";
const siteConfigDatabaseTitle = process.env.NOTION_SITE_CONFIG_DATABASE_TITLE || "\u7ad9\u70b9\u914d\u7f6e";
const navigationDatabaseTitle = process.env.NOTION_NAVIGATION_DATABASE_TITLE || "\u5bfc\u822a\u914d\u7f6e";
const siteOrigin = normalizeOrigin(process.env.SITE_URL || "https://example.com");
const publishedValues = new Set(["Published", "已发布"]);
const pageValues = new Set(["Page", "页面"]);
const configBooleanTrueValues = new Set(["true", "1", "yes", "on", "\u662f", "\u542f\u7528"]);
const configBooleanFalseValues = new Set(["false", "0", "no", "off", "\u5426", "\u505c\u7528"]);
const themeEnvVarMap = {
  PUBLIC_THEME_COLOR: "--theme-color",
  PUBLIC_THEME_COLOR_DEEP: "--theme-color-deep",
  PUBLIC_THEME_ACCENT: "--theme-accent",
  PUBLIC_THEME_TEXT: "--theme-text",
  PUBLIC_THEME_MUTED: "--theme-muted",
  PUBLIC_THEME_LINE: "--theme-line",
  PUBLIC_THEME_BG: "--theme-bg",
  PUBLIC_THEME_PANEL: "--theme-panel",
  PUBLIC_THEME_PANEL_SOLID: "--theme-panel-solid",
  PUBLIC_THEME_PANEL_SOFT: "--theme-panel-soft",
  PUBLIC_THEME_SHADOW: "--theme-shadow",
  PUBLIC_THEME_SHADOW_STRONG: "--theme-shadow-strong",
  PUBLIC_THEME_BG_IMAGE: "--theme-bg-image",
  PUBLIC_THEME_NAV_BG: "--theme-nav-bg",
  PUBLIC_THEME_NAV_BORDER: "--theme-nav-border",
  PUBLIC_THEME_HERO_MASK: "--theme-hero-mask",
  PUBLIC_THEME_HERO_PANEL_BG: "--theme-hero-panel-bg",
  PUBLIC_THEME_HERO_PANEL_BORDER: "--theme-hero-panel-border",
  PUBLIC_THEME_HERO_PANEL_SHADOW: "--theme-hero-panel-shadow",
  PUBLIC_THEME_SOFT_FILL: "--theme-soft-fill",
  PUBLIC_THEME_SOFT_FILL_STRONG: "--theme-soft-fill-strong",
  PUBLIC_THEME_CODE_BG: "--theme-code-bg",
  PUBLIC_THEME_CODE_TEXT: "--theme-code-text",
  PUBLIC_THEME_READING_TEXT: "--theme-reading-text",
  PUBLIC_THEME_RADIUS_LG: "--radius-lg",
  PUBLIC_THEME_RADIUS_MD: "--radius-md",
  PUBLIC_THEME_RADIUS_SM: "--radius-sm",
  PUBLIC_THEME_NAV_WIDTH: "--nav-width",
  PUBLIC_THEME_CONTENT_WIDTH: "--content-width",
  PUBLIC_THEME_PAGE_WIDTH: "--page-width",
  PUBLIC_THEME_READING_WIDTH: "--reading-width",
  PUBLIC_THEME_FONT_SANS: "--font-sans",
  PUBLIC_THEME_FONT_DISPLAY: "--font-display"
};
const defaultGeneratedSiteConfig = { site: {}, theme: { vars: {} } };
const assetCache = new Map();
const previousEntries = await loadPreviousEntries();
const previousSiteConfig = await loadJsonFile(siteConfigOutputFile, defaultGeneratedSiteConfig);
const previousNavigation = await loadJsonFile(navigationOutputFile, []);

if (!notionToken) {
  console.log("Skipping Notion sync because NOTION_TOKEN is missing.");
  await Promise.all([
    ensureOutputFile(postsOutputFile, []),
    ensureOutputFile(pagesOutputFile, []),
    ensureOutputFile(siteConfigOutputFile, previousSiteConfig),
    ensureOutputFile(navigationOutputFile, previousNavigation)
  ]);
  process.exit(0);
}

await mkdir(notionAssetsDir, { recursive: true });

const notion = new Client({ auth: notionToken });
const rows = databaseId ? await queryPublishedPages() : [];
const posts = [];
const pages = [];

if (!databaseId) {
  console.log("Skipping post/page sync because NOTION_DATABASE_ID is missing.");
}

for (const row of rows) {
  const entry = await transformPage(row, previousEntries.get(row.id));
  if (!entry) continue;

  if (entry.type === "页面") {
    pages.push(entry);
  } else {
    posts.push(entry);
  }
}

const byDateDesc = (left, right) =>
  new Date(right.publishedAt || right.updatedAt).getTime() -
  new Date(left.publishedAt || left.updatedAt).getTime();

posts.sort(byDateDesc);
pages.sort(byDateDesc);

const siteConfigData = await syncSiteConfig(previousSiteConfig);
const navigationData = await syncNavigation(previousNavigation);

await Promise.all([
  ensureOutputFile(postsOutputFile, posts),
  ensureOutputFile(pagesOutputFile, pages),
  ensureOutputFile(siteConfigOutputFile, siteConfigData),
  ensureOutputFile(navigationOutputFile, navigationData)
]);
console.log(
  `Synced ${posts.length} posts, ${pages.length} pages, ${Object.keys(siteConfigData.site || {}).length} site settings and ${navigationData.length} nav items from Notion.`
);

async function queryPublishedPages(cursor) {
  const response = await notion.databases.query({
    database_id: databaseId,
    start_cursor: cursor,
    page_size: 100
  });

  if (!response.has_more || !response.next_cursor) {
    return response.results;
  }

  return response.results.concat(await queryPublishedPages(response.next_cursor));
}

async function queryDatabaseRows(databaseId, cursor, collected = []) {
  const response = await notion.databases.query({
    database_id: databaseId,
    start_cursor: cursor,
    page_size: 100
  });

  const items = collected.concat(response.results);
  if (!response.has_more || !response.next_cursor) {
    return items;
  }

  return queryDatabaseRows(databaseId, response.next_cursor, items);
}

async function syncSiteConfig(previousConfig) {
  const database = await resolveOptionalDatabase({
    databaseId: siteConfigDatabaseId,
    title: siteConfigDatabaseTitle
  });

  if (!database) {
    return previousConfig;
  }

  try {
    const rows = await queryDatabaseRows(database.id);
    return buildSiteConfig(rows);
  } catch (error) {
    console.warn(`Falling back to previous site config because site config sync failed: ${error}`);
    return previousConfig;
  }
}

async function syncNavigation(previousNavigationItems) {
  const database = await resolveOptionalDatabase({
    databaseId: navigationDatabaseId,
    title: navigationDatabaseTitle
  });

  if (!database) {
    return previousNavigationItems;
  }

  try {
    const rows = await queryDatabaseRows(database.id);
    return buildNavigation(rows);
  } catch (error) {
    console.warn(`Falling back to previous navigation because nav sync failed: ${error}`);
    return previousNavigationItems;
  }
}

async function resolveOptionalDatabase({ databaseId, title }) {
  if (databaseId) {
    try {
      return await notion.databases.retrieve({ database_id: databaseId });
    } catch (error) {
      console.warn(`Configured database ${databaseId} could not be loaded: ${error}`);
    }
  }

  if (!title) {
    return null;
  }

  return findDatabaseByTitle(title);
}

async function findDatabaseByTitle(title) {
  const response = await notion.search({
    query: title,
    filter: { property: "object", value: "database" },
    page_size: 20
  });

  return response.results.find((item) => item.object === "database" && getDatabaseTitle(item) === title) ?? null;
}

function getDatabaseTitle(database) {
  return Array.isArray(database.title) ? database.title.map((item) => item.plain_text).join("") : "";
}

async function buildSiteConfig(rows) {
  const nextConfig = {
    site: {},
    theme: {
      vars: {}
    }
  };

  for (const row of rows) {
    if (row.archived || row.in_trash) {
      continue;
    }

    const properties = row.properties || {};
    if (!readOptionalCheckbox(getProperty(properties, ["\u542f\u7528", "Enabled"]), true)) {
      continue;
    }

    const key =
      readTitle(getProperty(properties, ["\u952e\u540d", "Key"])) ||
      readPlainText(getProperty(properties, ["\u952e\u540d", "Key"]));

    if (!key) {
      continue;
    }

    const value = await readConfigValue(properties, key);
    applySiteConfigValue(nextConfig, key, value);
  }

  return nextConfig;
}

function buildNavigation(rows) {
  return rows
    .filter((row) => !row.archived && !row.in_trash)
    .map((row, index) => {
      const properties = row.properties || {};
      if (!readOptionalCheckbox(getProperty(properties, ["\u542f\u7528", "Enabled"]), true)) {
        return null;
      }

      const label =
        readTitle(getProperty(properties, ["\u540d\u79f0", "Label", "Title"])) ||
        readPlainText(getProperty(properties, ["\u540d\u79f0", "Label", "Title"]));
      const href = String(readPropertyValue(getProperty(properties, ["\u94fe\u63a5", "Href", "URL"])) || "").trim();

      if (!label || !href) {
        return null;
      }

      return {
        label,
        href: normalizeSiteAssetUrl(href),
        external: readOptionalCheckbox(getProperty(properties, ["\u5916\u94fe", "External"]), isExternalUrl(href)),
        enabled: true,
        order: readNumber(getProperty(properties, ["\u6392\u5e8f", "Order"])) ?? index + 1
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.order - right.order);
}

async function transformPage(page, previousEntry) {
  if (page.archived || page.in_trash) {
    return null;
  }

  const properties = page.properties || {};
  const title = readTitle(getProperty(properties, ["标题", "Title", "Name"]));
  const slug = readPlainText(getProperty(properties, ["链接名", "Slug", "路径"])) || slugify(title);
  const status = readSelect(getProperty(properties, ["状态", "Status"]));

  if (!publishedValues.has(status)) {
    return null;
  }

  if (!title || !slug) {
    console.warn(`Skipping page ${page.id} because title or slug is missing.`);
    return null;
  }

  let blocks = [];

  try {
    blocks = await getAllBlocks(page.id);
  } catch {
    if (previousEntry) {
      console.warn(`Falling back to previously generated content for page ${page.id}.`);
      return previousEntry;
    }

    console.warn(`Skipping page ${page.id} because its blocks could not be loaded.`);
    return null;
  }

  const html = rewriteLegacyAttachmentLinks(await renderBlocks(blocks, slug), slug);
  const summary = readPlainText(getProperty(properties, ["摘要", "Summary", "描述"])) || getFallbackSummary(blocks);
  const type = normalizeType(readSelect(getProperty(properties, ["类型", "Type"])));

  const cover =
    (await materializeAsset(readPageCover(page.cover), {
      pageSlug: slug,
      kind: "cover"
    })) ||
    (await materializeAsset(readCover(getProperty(properties, ["封面", "Cover"])), {
      pageSlug: slug,
      kind: "cover"
    }));

  return {
    id: page.id,
    type,
    title,
    slug,
    summary,
    publishedAt: readDate(getProperty(properties, ["发布日期", "PublishDate", "发布时间"])) || page.created_time.slice(0, 10),
    updatedAt: page.last_edited_time.slice(0, 10),
    tags: readMultiSelect(getProperty(properties, ["标签", "Tags"])),
    categories: readSelectOrMultiSelect(getProperty(properties, ["分类", "Categories"])),
    featured: readCheckbox(getProperty(properties, ["推荐", "Featured"])),
    cover: normalizeSiteAssetUrl(cover),
    html
  };
}

async function getAllBlocks(blockId, cursor, collected = []) {
  const response = await notion.blocks.children.list({
    block_id: blockId,
    start_cursor: cursor,
    page_size: 100
  });

  const items = collected.concat(response.results);
  if (!response.has_more || !response.next_cursor) {
    return items;
  }

  return getAllBlocks(blockId, response.next_cursor, items);
}

async function renderBlocks(blocks, pageSlug) {
  const html = [];
  let index = 0;

  while (index < blocks.length) {
    const block = blocks[index];

    if (block.type === "bulleted_list_item") {
      const items = [];

      while (blocks[index]?.type === "bulleted_list_item") {
        items.push(`<li>${await renderRichText(blocks[index].bulleted_list_item.rich_text, pageSlug)}</li>`);
        index += 1;
      }

      html.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    if (block.type === "numbered_list_item") {
      const items = [];

      while (blocks[index]?.type === "numbered_list_item") {
        items.push(`<li>${await renderRichText(blocks[index].numbered_list_item.rich_text, pageSlug)}</li>`);
        index += 1;
      }

      html.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    html.push(await renderBlock(block, pageSlug));
    index += 1;
  }

  return html.filter(Boolean).join("");
}

async function renderBlock(block, pageSlug) {
  switch (block.type) {
    case "paragraph":
      return wrapIfContent("p", await renderRichText(block.paragraph.rich_text, pageSlug));
    case "heading_1":
      return wrapIfContent("h2", await renderRichText(block.heading_1.rich_text, pageSlug));
    case "heading_2":
      return wrapIfContent("h3", await renderRichText(block.heading_2.rich_text, pageSlug));
    case "heading_3":
      return wrapIfContent("h4", await renderRichText(block.heading_3.rich_text, pageSlug));
    case "quote":
      return wrapIfContent("blockquote", await renderRichText(block.quote.rich_text, pageSlug));
    case "code":
      return `<pre><code>${escapeHtml(readPlain(block.code.rich_text))}</code></pre>`;
    case "callout":
      return `<blockquote>${await renderRichText(block.callout.rich_text, pageSlug)}</blockquote>`;
    case "divider":
      return "<hr />";
    case "equation":
      return renderEquationBlock(block.equation);
    case "image":
      return renderImage(block.image, pageSlug);
    case "file":
      return renderFile(block.file, pageSlug);
    case "pdf":
      return renderFile(block.pdf, pageSlug, { label: "PDF 附件" });
    case "video":
      return renderFile(block.video, pageSlug, { label: "视频附件" });
    case "audio":
      return renderFile(block.audio, pageSlug, { label: "音频附件" });
    case "embed":
      return renderEmbed(block.embed);
    default:
      return "";
  }
}

async function renderImage(image, pageSlug) {
  const rawUrl = image.type === "external" ? image.external.url : image.file.url;
  const url = await materializeAsset(rawUrl, {
    pageSlug,
    kind: "image",
    preferredName: readPlain(image.caption || [])
  });
  const caption = await renderRichText(image.caption || [], pageSlug);

  if (!url) {
    return "";
  }

  return `<figure><img src="${escapeAttribute(url)}" alt="${escapeAttribute(readPlain(image.caption || []))}" />${caption ? `<figcaption>${caption}</figcaption>` : ""}</figure>`;
}

async function renderFile(file, pageSlug, options = {}) {
  const rawUrl = file?.type === "external" ? file.external.url : file?.file?.url || "";
  const captionText = readPlain(file?.caption || []);
  const label = captionText || options.label || "下载附件";
  const url = await materializeAsset(rawUrl, {
    pageSlug,
    kind: "attachment",
    preferredName: captionText
  });

  if (!url) {
    return "";
  }

  return `<p><a href="${escapeAttribute(url)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a></p>`;
}

function renderEmbed(embed) {
  const url = normalizeSiteAssetUrl(embed.url || "");
  if (!url) return "";

  return `<div class="embed-frame"><iframe src="${escapeAttribute(url)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe></div>`;
}

async function renderRichText(richText = [], pageSlug) {
  const parts = [];

  for (const item of richText) {
    let text =
      item.type === "equation"
        ? renderEquationExpression(item.equation?.expression || item.plain_text || "")
        : escapeHtml(item.plain_text || "");

    if (item.type !== "equation") {
      if (item.annotations?.code) text = `<code>${text}</code>`;
      if (item.annotations?.bold) text = `<strong>${text}</strong>`;
      if (item.annotations?.italic) text = `<em>${text}</em>`;
      if (item.annotations?.strikethrough) text = `<s>${text}</s>`;
      if (item.annotations?.underline) text = `<u>${text}</u>`;
    }

    const href = item.href || "";
    const localHref =
      (await materializeAsset(href, {
        pageSlug,
        kind: "attachment",
        preferredName: item.plain_text || ""
      })) || normalizeSiteAssetUrl(href);

    if (localHref) {
      text = `<a href="${escapeAttribute(localHref)}" target="_blank" rel="noreferrer">${text}</a>`;
    }

    parts.push(text);
  }

  return parts.join("");
}

function renderEquationBlock(equation) {
  const expression = equation?.expression || "";
  if (!expression.trim()) {
    return "";
  }

  return `<div class="math-display">${renderEquationExpression(expression, { displayMode: true })}</div>`;
}

function renderEquationExpression(expression, options = {}) {
  const escaped = escapeHtml(expression || "");
  if (!escaped.trim()) {
    return "";
  }

  return options.displayMode ? `\\[${escaped}\\]` : `<span class="math-inline">\\(${escaped}\\)</span>`;
}

function wrapIfContent(tag, content) {
  return content ? `<${tag}>${content}</${tag}>` : "";
}

function readTitle(property) {
  return property?.type === "title" ? readPlain(property.title) : "";
}

function readPlainText(property) {
  if (!property) return "";
  if (property.type === "rich_text") return readPlain(property.rich_text);
  if (property.type === "title") return readPlain(property.title);
  return "";
}

function readDate(property) {
  return property?.type === "date" ? property.date?.start || "" : "";
}

function readSelect(property) {
  return property?.type === "select" ? property.select?.name || "" : "";
}

function readMultiSelect(property) {
  return property?.type === "multi_select" ? property.multi_select.map((item) => item.name) : [];
}

function readSelectOrMultiSelect(property) {
  if (!property) return [];
  if (property.type === "multi_select") return property.multi_select.map((item) => item.name);
  if (property.type === "select" && property.select?.name) return [property.select.name];
  return [];
}

function readCheckbox(property) {
  return property?.type === "checkbox" ? property.checkbox : false;
}

function readOptionalCheckbox(property, fallback = false) {
  return property?.type === "checkbox" ? property.checkbox : fallback;
}

function readNumber(property) {
  return property?.type === "number" ? property.number : null;
}

function readPropertyValue(property) {
  if (!property) return "";
  if (property.type === "rich_text") return readPlain(property.rich_text);
  if (property.type === "title") return readPlain(property.title);
  if (property.type === "url") return property.url || "";
  if (property.type === "number") return property.number ?? "";
  if (property.type === "checkbox") return property.checkbox;
  if (property.type === "select") return property.select?.name || "";
  if (property.type === "multi_select") return property.multi_select.map((item) => item.name);
  if (property.type === "date") return property.date?.start || "";
  return "";
}

async function readConfigValue(properties, key) {
  const type = readSelect(getProperty(properties, ["\u7c7b\u578b", "Type"])).toLowerCase();
  const optionValue = readSelect(getProperty(properties, ["\u9009\u9879\u503c", "OptionValue", "Option"]));
  const rawValue = readPropertyValue(getProperty(properties, ["\u503c", "Value"]));
  const assetValue = await materializeAsset(readCover(getProperty(properties, ["\u8d44\u6e90", "Asset"])), {
    pageSlug: "site-config",
    kind: "asset",
    preferredName: key
  });

  if (type === "json") {
    try {
      return JSON.parse(String(rawValue || "{}"));
    } catch {
      console.warn(`Skipping config key ${key} because its JSON value is invalid.`);
      return undefined;
    }
  }

  if (type === "boolean") {
    return toBoolean(rawValue);
  }

  if (type === "number") {
    return typeof rawValue === "number" ? rawValue : Number(rawValue);
  }

  const stringValue = String(assetValue || optionValue || rawValue || "").trim();
  if (!stringValue) {
    return "";
  }

  return normalizeSiteAssetUrl(stringValue);
}

function applySiteConfigValue(target, key, value) {
  if (value === undefined || value === null || value === "") {
    return;
  }

  const normalizedKey = normalizeConfigKey(key);

  if (normalizedKey === "theme.vars" && isRecord(value)) {
    for (const [varName, varValue] of Object.entries(value)) {
      if (typeof varValue === "string" && varName.trim() && varValue.trim()) {
        target.theme.vars[varName.trim()] = varValue.trim();
      }
    }
    return;
  }

  if (normalizedKey.startsWith("theme.var.") || normalizedKey.startsWith("theme.vars.")) {
    const prefix = normalizedKey.startsWith("theme.var.") ? "theme.var." : "theme.vars.";
    const varName = normalizedKey.slice(prefix.length).trim();
    if (varName && typeof value === "string") {
      target.theme.vars[varName] = value.trim();
    }
    return;
  }

  if (normalizedKey.startsWith("site.")) {
    const field = normalizedKey.slice("site.".length).trim();
    if (field && typeof value === "string") {
      target.site[field] = value.trim();
    }
    return;
  }

  if (normalizedKey.startsWith("theme.")) {
    const field = normalizedKey.slice("theme.".length).trim();
    if (field && typeof value === "string" && field !== "vars") {
      target.theme[field] = value.trim();
    }
  }
}

function normalizeConfigKey(key) {
  const trimmed = String(key || "").trim();

  const directKeyMap = {
    PUBLIC_BLOG_TITLE: "site.title",
    PUBLIC_BLOG_SUBTITLE: "site.subtitle",
    PUBLIC_BLOG_DESCRIPTION: "site.description",
    PUBLIC_BLOG_AUTHOR: "site.author",
    PUBLIC_BLOG_MOTTO: "site.motto",
    PUBLIC_BLOG_GITHUB: "site.github",
    PUBLIC_BLOG_PROFILE: "site.profile",
    PUBLIC_BLOG_AVATAR: "site.avatar",
    PUBLIC_BLOG_LOGO: "site.logo",
    PUBLIC_BLOG_DEFAULT_COVER: "site.defaultCover",
    PUBLIC_BLOG_RUNTIME_SINCE: "site.runtimeSince",
    PUBLIC_BLOG_RECORD_TEXT: "site.recordText",
    PUBLIC_BLOG_RECORD_LINK: "site.recordLink",
    PUBLIC_TEMPLATE_PRESET: "theme.preset",
    PUBLIC_HOME_TEMPLATE: "theme.homeTemplate",
    PUBLIC_CARD_STYLE: "theme.cardStyle",
    PUBLIC_SIDEBAR_STYLE: "theme.sidebarStyle"
  };

  if (directKeyMap[trimmed]) {
    return directKeyMap[trimmed];
  }

  if (themeEnvVarMap[trimmed]) {
    return `theme.var.${themeEnvVarMap[trimmed]}`;
  }

  return trimmed;
}

function toBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value || "").trim().toLowerCase();
  if (configBooleanTrueValues.has(normalized)) {
    return true;
  }
  if (configBooleanFalseValues.has(normalized)) {
    return false;
  }
  return false;
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readCover(property) {
  if (!property) return "";
  if (property.type === "url") return property.url || "";
  if (property.type === "files") {
    return property.files[0]?.type === "external"
      ? property.files[0].external.url
      : property.files[0]?.file?.url || "";
  }
  return "";
}

function readPageCover(cover) {
  if (!cover) return "";
  return cover.type === "external" ? cover.external?.url || "" : cover.file?.url || "";
}

function getFallbackSummary(blocks) {
  const paragraph = blocks.find((block) => block.type === "paragraph");
  if (!paragraph) return "";
  return readPlain(paragraph.paragraph.rich_text).slice(0, 120).trim();
}

function rewriteLegacyAttachmentLinks(html, pageSlug) {
  if (!html.includes("/data/") || !html.includes("/attachment/")) {
    return html;
  }

  const attachmentMap = new Map();
  const attachmentPattern = new RegExp(
    `${escapeRegExp(`/notion/${pageSlug}/attachment/`)}([^"'?#<>]+)`,
    "g"
  );

  for (const match of html.matchAll(attachmentPattern)) {
    const fullUrl = `/notion/${pageSlug}/attachment/${match[1]}`;
    const key = normalizeAttachmentKey(match[1]);
    if (key && !attachmentMap.has(key)) {
      attachmentMap.set(key, fullUrl);
    }
  }

  if (!attachmentMap.size) {
    return html;
  }

  return html.replace(/href="(\/data\/[^"]+)"/g, (fullMatch, href) => {
    const key = normalizeAttachmentKey(href);
    const replacement = attachmentMap.get(key);
    return replacement ? `href="${escapeAttribute(replacement)}"` : fullMatch;
  });
}

function normalizeAttachmentKey(value) {
  const decoded = decodeURIComponent(value || "")
    .normalize("NFKC")
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    ?.toLowerCase();

  if (!decoded) return "";

  return decoded
    .replace(/(\.(zip|pdf|docx?|xlsx?|pptx?|rar|7z|bin))+$/gi, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readPlain(richText = []) {
  return richText.map((item) => item.plain_text || "").join("");
}

function getProperty(properties, aliases) {
  for (const alias of aliases) {
    if (properties?.[alias]) {
      return properties[alias];
    }
  }
  return undefined;
}

function normalizeType(value) {
  return pageValues.has(value) ? "页面" : "文章";
}

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeOrigin(value) {
  return value.replace(/\/+$/, "");
}

function normalizeSiteAssetUrl(url) {
  if (!url) return "";
  const normalized = url.trim();

  if (normalized.startsWith(siteOrigin)) {
    return normalized.slice(siteOrigin.length) || "/";
  }

  const windowsAssetPath = normalized.match(/(?:[A-Za-z]:)?[\\/].*?[\\/]public[\\/](img|data|survey-assets|notion)[\\/](.+)$/i);
  if (windowsAssetPath) {
    const [, folder, rest] = windowsAssetPath;
    return `/${folder}/${rest.replace(/\\/g, "/")}`;
  }

  const windowsStandalonePage = normalized.match(/(?:[A-Za-z]:)?[\\/].*?[\\/]public[\\/]mllm-survey-cn\.html$/i);
  if (windowsStandalonePage) {
    return "/mllm-survey-cn.html";
  }

  try {
    const parsed = new URL(normalized);
    const assetPrefixes = ["/img/", "/data/", "/survey-assets/", "/notion/", "/mllm-survey-cn.html"];
    const matchedPrefix = assetPrefixes.find((prefix) => parsed.pathname.startsWith(prefix));

    if (matchedPrefix) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    // Non-URL values are handled below.
  }

  return normalized;
}

async function materializeAsset(rawUrl, options) {
  if (!rawUrl) return "";
  const normalized = rawUrl.trim();
  if (!normalized) return "";

  if (normalized.startsWith(siteOrigin)) {
    return normalized.slice(siteOrigin.length) || "/";
  }

  const localUrl = normalizeSiteAssetUrl(normalized);
  if (localUrl !== normalized) {
    return localUrl;
  }

  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    return normalized;
  }

  if (!shouldDownloadRemoteAsset(parsed)) {
    return normalized;
  }

  const cacheKey = getAssetCacheKey(parsed, options);
  if (assetCache.has(cacheKey)) {
    return assetCache.get(cacheKey);
  }

  const localPath = buildAssetLocalPath(parsed, options);
  const filePath = join(notionAssetsDir, localPath);
  const publicUrl = `${notionAssetsUrlBase}/${localPath}`.replace(/\\/g, "/");

  assetCache.set(cacheKey, publicUrl);

  if (await fileExists(filePath)) {
    return publicUrl;
  }

  try {
    const response = await fetch(parsed);

    if (!response.ok) {
      console.warn(`Failed to download asset: ${parsed} (${response.status})`);
      assetCache.set(cacheKey, "");
      return "";
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, buffer);
    return publicUrl;
  } catch {
    console.warn(`Failed to download asset: ${parsed}`);
    assetCache.set(cacheKey, "");
    return "";
  }
}

function shouldDownloadRemoteAsset(url) {
  const host = url.hostname.toLowerCase();

  return [
    "secure.notion-static.com",
    "prod-files-secure.s3.us-west-2.amazonaws.com",
    "s3.us-west-2.amazonaws.com"
  ].some((value) => host.includes(value));
}

function buildAssetLocalPath(url, options) {
  const kind = options.kind || "asset";
  const pageSlug = slugify(options.pageSlug || "page") || "page";
  const suggested = sanitizeFilename(normalizeAssetPreferredName(options.preferredName || ""));
  const extension = detectFileExtension(url, suggested);
  const hash = createHash("sha1").update(getStableAssetKey(url)).digest("hex").slice(0, 12);
  const baseName = suggested ? `${suggested}-${hash}` : `${kind}-${hash}`;
  return `${pageSlug}/${kind}/${baseName}${extension}`;
}

function getAssetCacheKey(url, options = {}) {
  return [
    url.toString(),
    options.kind || "asset",
    slugify(options.pageSlug || "page") || "page",
    sanitizeFilename(normalizeAssetPreferredName(options.preferredName || ""))
  ].join("::");
}

function getStableAssetKey(url) {
  const stablePath = `${url.origin}${url.pathname}`;
  return stablePath || url.toString();
}

function detectFileExtension(url, suggestedName) {
  const fromName = extname(suggestedName || "");
  if (fromName) return normalizeExtension(fromName);

  const pathnameExt = extname(url.pathname || "");
  if (pathnameExt) return normalizeExtension(pathnameExt);

  return "";
}

function normalizeExtension(value) {
  const cleaned = value.toLowerCase();
  if (cleaned.length > 12) return "";
  return cleaned.startsWith(".") ? cleaned : `.${cleaned}`;
}

function sanitizeFilename(value) {
  return value
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeAssetPreferredName(value) {
  const normalized = String(value || "").trim();
  if (!normalized.startsWith("__ASSET_CACHE__:")) {
    return normalized;
  }

  return normalized.replace(/^__ASSET_CACHE__:/, "").split("/").pop() || "";
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

async function ensureOutputFile(outputFile, data) {
  await mkdir(dirname(outputFile), { recursive: true });
  await writeFile(outputFile, JSON.stringify(data, null, 2) + "\n", "utf8");
}

async function loadJsonFile(outputFile, fallback) {
  try {
    const raw = await readFile(outputFile, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function loadPreviousEntries() {
  const entries = new Map();

  for (const outputFile of [postsOutputFile, pagesOutputFile]) {
    try {
      const raw = await readFile(outputFile, "utf8");
      const parsed = JSON.parse(raw);

      if (!Array.isArray(parsed)) continue;

      for (const entry of parsed) {
        if (entry?.id) {
          entries.set(entry.id, entry);
        }
      }
    } catch {
      // Ignore missing or malformed generated files during bootstrap.
    }
  }

  return entries;
}

function isExternalUrl(value) {
  return /^(?:[a-z]+:)?\/\//i.test(value);
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function loadLocalEnv() {
  if (typeof process.loadEnvFile !== "function") return;

  try {
    await access(".env");
    process.loadEnvFile(".env");
  } catch {
    // CI may inject env vars without providing a local .env file.
  }
}
