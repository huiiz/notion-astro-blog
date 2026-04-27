import { Client } from "@notionhq/client";
import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, extname, join, resolve } from "node:path";

await loadLocalEnv();

const postsOutputFile = resolve("src/data/generated/posts.json");
const pagesOutputFile = resolve("src/data/generated/pages.json");
const notionAssetsDir = resolve("public/notion");
const notionAssetsUrlBase = "/notion";
const notionToken = process.env.NOTION_TOKEN;
const databaseId = process.env.NOTION_DATABASE_ID;
const siteOrigin = normalizeOrigin(process.env.SITE_URL || "https://example.com");
const publishedValues = new Set(["Published", "已发布"]);
const pageValues = new Set(["Page", "页面"]);
const assetCache = new Map();

if (!notionToken || !databaseId) {
  console.log("Skipping Notion sync because NOTION_TOKEN or NOTION_DATABASE_ID is missing.");
  await Promise.all([ensureOutputFile(postsOutputFile, []), ensureOutputFile(pagesOutputFile, [])]);
  process.exit(0);
}

await rm(notionAssetsDir, { recursive: true, force: true });
await mkdir(notionAssetsDir, { recursive: true });

const notion = new Client({ auth: notionToken });
const rows = await queryPublishedPages();
const posts = [];
const pages = [];

for (const row of rows) {
  const entry = await transformPage(row);
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

await Promise.all([ensureOutputFile(postsOutputFile, posts), ensureOutputFile(pagesOutputFile, pages)]);
console.log(`Synced ${posts.length} posts and ${pages.length} pages from Notion.`);

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

async function transformPage(page) {
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
    console.warn(`Skipping page ${page.id} because its blocks could not be loaded.`);
    return null;
  }

  const html = await renderBlocks(blocks, slug);
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
    let text = escapeHtml(item.plain_text || "");

    if (item.annotations?.code) text = `<code>${text}</code>`;
    if (item.annotations?.bold) text = `<strong>${text}</strong>`;
    if (item.annotations?.italic) text = `<em>${text}</em>`;
    if (item.annotations?.strikethrough) text = `<s>${text}</s>`;
    if (item.annotations?.underline) text = `<u>${text}</u>`;

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

  const cacheKey = parsed.toString();
  if (assetCache.has(cacheKey)) {
    return assetCache.get(cacheKey);
  }

  const localPath = buildAssetLocalPath(parsed, options);
  const filePath = join(notionAssetsDir, localPath);
  const publicUrl = `${notionAssetsUrlBase}/${localPath}`.replace(/\\/g, "/");

  assetCache.set(cacheKey, publicUrl);

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
  const suggested = sanitizeFilename(options.preferredName || "");
  const extension = detectFileExtension(url, suggested);
  const hash = createHash("sha1").update(url.toString()).digest("hex").slice(0, 12);
  const baseName = suggested || `${kind}-${hash}`;
  return `${pageSlug}/${kind}/${baseName}${extension}`;
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

async function loadLocalEnv() {
  if (typeof process.loadEnvFile !== "function") return;

  try {
    await access(".env");
    process.loadEnvFile(".env");
  } catch {
    // CI may inject env vars without providing a local .env file.
  }
}
