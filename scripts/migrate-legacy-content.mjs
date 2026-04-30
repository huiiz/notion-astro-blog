import { Client } from "@notionhq/client";
import matter from "gray-matter";
import yaml from "js-yaml";
import { marked } from "marked";
import { access, cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";

await loadLocalEnv();
marked.setOptions({ gfm: true, breaks: true });

const projectRoot = resolve(".");
const legacySourceRoot = resolve(".refs/blog_source/source");
const postsDir = join(legacySourceRoot, "_posts");
const notionToken = process.env.NOTION_TOKEN;
const databaseId = process.env.NOTION_DATABASE_ID;
const siteOrigin = normalizeOrigin(process.env.SITE_URL || "https://example.com");
const outputFriendsFile = resolve("src/data/generated/friends.json");
const supportedCodeLanguages = new Set([
  "bash",
  "c",
  "c++",
  "css",
  "diff",
  "html",
  "java",
  "javascript",
  "json",
  "latex",
  "makefile",
  "markdown",
  "markup",
  "matlab",
  "plain text",
  "powershell",
  "python",
  "rust",
  "scss",
  "shell",
  "sql",
  "toml",
  "typescript",
  "xml",
  "yaml"
]);

if (!notionToken || !databaseId) {
  throw new Error("NOTION_TOKEN or NOTION_DATABASE_ID is missing.");
}

const notion = new Client({ auth: notionToken });

await copyLegacyAssets();
const friendGroups = await migrateFriendLinks();
const posts = await loadLegacyPosts();
const pages = await loadLegacyPages();
await ensureDatabaseSchema();
await archivePlaceholderPage();
await archiveBrokenPages();
await upsertLegacyEntries([...posts, ...pages]);

console.log(
  `Migrated ${posts.length} posts, ${pages.length} pages, and ${friendGroups.length} friend-link groups.`
);

async function copyLegacyAssets() {
  await cp(join(legacySourceRoot, "img"), resolve("public/img"), { recursive: true, force: true });
  await cp(join(legacySourceRoot, "data"), resolve("public/data"), { recursive: true, force: true });
  await cp(join(legacySourceRoot, "survey-assets"), resolve("public/survey-assets"), {
    recursive: true,
    force: true
  });
  await cp(join(legacySourceRoot, "mllm-survey-cn.html"), resolve("public/mllm-survey-cn.html"), {
    force: true
  });
}

async function migrateFriendLinks() {
  const raw = await readFile(join(legacySourceRoot, "_data/link.yml"), "utf8");
  const parsed = yaml.load(raw) || [];
  const groups = Array.isArray(parsed)
    ? parsed.map((group) => ({
        className: group.class_name || "",
        classDesc: group.class_desc || "",
        links: Array.isArray(group.link_list)
          ? group.link_list.map((item) => ({
              name: item.name || "",
              link: item.link || "",
              avatar: normalizeAssetUrl(item.avatar || ""),
              descr: item.descr || ""
            }))
          : []
      }))
    : [];

  await ensureJsonFile(outputFriendsFile, groups);
  return groups;
}

async function loadLegacyPosts() {
  const files = (await readdir(postsDir))
    .filter((file) => extname(file).toLowerCase() === ".md")
    .sort((left, right) => left.localeCompare(right, "zh-CN"));

  const items = [];
  for (const file of files) {
    items.push(await parseMarkdownFile(join(postsDir, file), { type: "文章" }));
  }
  return items;
}

async function loadLegacyPages() {
  const pages = [
    await parseMarkdownFile(join(legacySourceRoot, "about/index.md"), {
      type: "页面",
      slug: "about",
      title: "关于",
      summary: "关于这个博客，也关于我在这里记录什么。"
    }),
    await parseMarkdownFile(join(legacySourceRoot, "link/index.md"), {
      type: "页面",
      slug: "link",
      title: "友情链接",
      summary: "那些我常去、也愿意推荐给你的站点。"
    })
  ];

  return pages;
}

async function parseMarkdownFile(filePath, overrides = {}) {
  const raw = await readFile(filePath, "utf8");
  const parsed = matter(raw);
  const normalizedMarkdown = normalizeMarkdown(parsed.content);
  const title = overrides.title || parsed.data.title || basename(filePath, extname(filePath));
  const slug = overrides.slug || slugify(parsed.data.slug || basename(filePath, extname(filePath)));
  const date = normalizeDate(parsed.data.date);
  const tags = normalizeArray(parsed.data.tags);
  const categories = normalizeArray(parsed.data.categories);
  const cover = normalizeAssetUrl(parsed.data.cover || "");
  const hasEmbed = /<iframe\b/i.test(normalizedMarkdown);
  const summary =
    overrides.summary ||
    buildSummary(parsed.data.description || normalizedMarkdown, title, normalizedMarkdown);

  return {
    type: overrides.type || "文章",
    title,
    slug,
    summary,
    publishedAt: date,
    tags,
    categories,
    cover,
    featured: false,
    hasEmbed,
    markdown: normalizedMarkdown,
    blocks: markdownToBlocks(normalizedMarkdown)
  };
}

async function ensureDatabaseSchema() {
  const database = await notion.databases.retrieve({ database_id: databaseId });
  const properties = database.properties || {};
  const patch = {};

  if (!properties["分类"]) {
    patch["分类"] = { multi_select: {} };
  }

  if (!properties["类型"]) {
    patch["类型"] = {
      select: {
        options: [{ name: "文章" }, { name: "页面" }]
      }
    };
  }

  if (Object.keys(patch).length > 0) {
    await notion.databases.update({
      database_id: databaseId,
      properties: patch
    });
  }
}

async function archivePlaceholderPage() {
  const existing = await queryAllPages();
  const placeholder = existing.find((page) => readSlug(page) === "hello-notion-blog");
  if (!placeholder) return;

  await notion.pages.update({
    page_id: placeholder.id,
    archived: true
  });
}

async function archiveBrokenPages() {
  const existing = await queryAllPages();
  const brokenPages = existing.filter((page) => {
    const slug = readSlug(page);
    const title = readTitle(page);
    return !page.archived && !slug && !title;
  });

  for (const page of brokenPages) {
    await notion.pages.update({
      page_id: page.id,
      archived: true
    });
    await sleep(150);
  }
}

async function upsertLegacyEntries(entries) {
  const existing = await queryAllPages();
  const existingSlugs = new Map(existing.map((page) => [readSlug(page), page]));

  for (const entry of entries) {
    const current = existingSlugs.get(entry.slug);

    if (current && !entry.hasEmbed) {
      console.log(`Skipping existing slug: ${entry.slug}`);
      continue;
    }

    if (current && entry.hasEmbed) {
      await notion.pages.update({
        page_id: current.id,
        archived: true
      });
      await sleep(200);
    }

    const page = await notion.pages.create({
      parent: { database_id: databaseId },
      properties: buildProperties(entry)
    });

    await sleep(250);
    await appendBlocks(page.id, entry.blocks);
    await sleep(350);
    console.log(`Imported ${entry.type}: ${entry.title}`);
  }
}

async function queryAllPages(cursor, collected = []) {
  const response = await notion.databases.query({
    database_id: databaseId,
    start_cursor: cursor,
    page_size: 100
  });

  const items = collected.concat(response.results);
  if (!response.has_more || !response.next_cursor) {
    return items;
  }

  return queryAllPages(response.next_cursor, items);
}

function buildProperties(entry) {
  return {
    标题: {
      title: [{ text: { content: entry.title } }]
    },
    链接名: {
      rich_text: [{ text: { content: entry.slug } }]
    },
    状态: {
      select: { name: "已发布" }
    },
    发布日期: {
      date: { start: entry.publishedAt }
    },
    标签: {
      multi_select: entry.tags.map((name) => ({ name }))
    },
    分类: {
      multi_select: entry.categories.map((name) => ({ name }))
    },
    摘要: {
      rich_text: entry.summary ? [{ text: { content: entry.summary.slice(0, 2000) } }] : []
    },
    封面: {
      url: entry.cover || null
    },
    推荐: {
      checkbox: Boolean(entry.featured)
    },
    类型: {
      select: { name: entry.type }
    }
  };
}

async function appendBlocks(pageId, blocks) {
  if (!blocks.length) return;

  for (let index = 0; index < blocks.length; index += 50) {
    await notion.blocks.children.append({
      block_id: pageId,
      children: blocks.slice(index, index + 50)
    });
    await sleep(250);
  }
}

function markdownToBlocks(markdown) {
  const tokens = marked.lexer(markdown);
  return tokens.flatMap((token) => tokenToBlocks(token)).slice(0, 1000);
}

function tokenToBlocks(token) {
  switch (token.type) {
    case "space":
      return [];
    case "heading":
      return [headingBlock(token.depth, inlineTokensToRichText(token.tokens))];
    case "paragraph":
    case "text":
      return paragraphTokenToBlocks(token);
    case "list":
      return listTokenToBlocks(token);
    case "blockquote":
      return [
        quoteBlock(
          toRichText(stripMarkdown(marked.parser(token.tokens || [])) || token.text || token.raw || "")
        )
      ];
    case "code":
      return [codeBlock(token.text || "", token.lang || "")];
    case "hr":
      return [dividerBlock()];
    case "html":
      return htmlTokenToBlocks(token.raw || token.text || "");
    case "table":
      return [codeBlock(tableToText(token), "table")];
    default:
      return [];
  }
}

function paragraphTokenToBlocks(token) {
  const blocks = [];
  const richText = [];
  const tokens = token.tokens || [];

  if (!tokens.length && (token.text || "").trim()) {
    return [paragraphBlock(toRichText(token.text))];
  }

  for (const inlineToken of tokens) {
    if (isImageCarrier(inlineToken)) {
      if (richText.length) {
        blocks.push(paragraphBlock(richText.splice(0)));
      }

      blocks.push(...imageBlocksFromToken(inlineToken));
      continue;
    }

    richText.push(...inlineTokensToRichText([inlineToken]));
  }

  if (richText.length) {
    blocks.push(paragraphBlock(richText));
  }

  return blocks;
}

function listTokenToBlocks(token) {
  const type = token.ordered ? "numbered_list_item" : "bulleted_list_item";
  const blocks = [];

  for (const item of token.items || []) {
    const text = stripMarkdown(marked.parser(item.tokens || [])) || item.text || "";
    blocks.push(listItemBlock(type, toRichText(text)));

    for (const childToken of item.tokens || []) {
      if (childToken.type === "list") {
        blocks.push(...listTokenToBlocks(childToken));
      }
    }
  }

  return blocks;
}

function htmlTokenToBlocks(html) {
  const blocks = [];
  const iframeMatches = [...html.matchAll(/<iframe[^>]+src=["']([^"']+)["'][^>]*>/gi)];
  const imageMatches = [...html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)];

  for (const match of iframeMatches) {
    const src = normalizeAssetUrl(match[1] || "");
    if (src) {
      blocks.push(embedBlock(src));
    }
  }

  for (const match of imageMatches) {
    const src = normalizeAssetUrl(match[1] || "");
    if (src) {
      blocks.push(imageBlock(src, ""));
    }
  }

  const text = stripMarkdown(stripHtml(html));
  if (text) {
    blocks.push(paragraphBlock(toRichText(text)));
  }

  return blocks;
}

function isImageCarrier(token) {
  if (!token) return false;
  if (token.type === "image") return true;
  if (token.type === "link" && (token.tokens || []).some((item) => item.type === "image")) return true;
  if (token.type === "html") return /<img\b/i.test(token.raw || token.text || "");
  return false;
}

function imageBlocksFromToken(token) {
  if (token.type === "image") {
    return [imageBlock(normalizeAssetUrl(token.href || ""), token.text || token.title || "")];
  }

  if (token.type === "link") {
    return (token.tokens || [])
      .filter((item) => item.type === "image")
      .map((item) => imageBlock(normalizeAssetUrl(item.href || ""), item.text || item.title || ""));
  }

  if (token.type === "html") {
    return htmlTokenToBlocks(token.raw || token.text || "").filter((item) => item.type === "image");
  }

  return [];
}

function inlineTokensToRichText(tokens, annotations = {}, href = "") {
  const richText = [];

  for (const token of tokens || []) {
    switch (token.type) {
      case "strong":
        richText.push(
          ...inlineTokensToRichText(token.tokens, { ...annotations, bold: true }, href)
        );
        break;
      case "em":
        richText.push(
          ...inlineTokensToRichText(token.tokens, { ...annotations, italic: true }, href)
        );
        break;
      case "codespan":
        richText.push(...toRichText(token.text || "", { ...annotations, code: true }, href));
        break;
      case "del":
        richText.push(
          ...inlineTokensToRichText(token.tokens, { ...annotations, strikethrough: true }, href)
        );
        break;
      case "link":
        richText.push(
          ...inlineTokensToRichText(token.tokens, annotations, normalizeAssetUrl(token.href || ""))
        );
        break;
      case "br":
        richText.push(...toRichText("\n", annotations, href));
        break;
      case "html":
        richText.push(...toRichText(stripHtml(token.raw || token.text || ""), annotations, href));
        break;
      case "image":
        break;
      default:
        richText.push(...toRichText(token.text || token.raw || "", annotations, href));
        break;
    }
  }

  return richText;
}

function headingBlock(depth, richText) {
  const type = depth <= 1 ? "heading_1" : depth === 2 ? "heading_2" : "heading_3";
  return {
    object: "block",
    type,
    [type]: {
      rich_text: richText.slice(0, 100)
    }
  };
}

function paragraphBlock(richText) {
  return {
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: richText.slice(0, 100)
    }
  };
}

function quoteBlock(richText) {
  return {
    object: "block",
    type: "quote",
    quote: {
      rich_text: richText.slice(0, 100)
    }
  };
}

function codeBlock(text, language) {
  return {
    object: "block",
    type: "code",
    code: {
      language: normalizeCodeLanguage(language),
      rich_text: toRichText(text || "").slice(0, 100)
    }
  };
}

function dividerBlock() {
  return {
    object: "block",
    type: "divider",
    divider: {}
  };
}

function listItemBlock(type, richText) {
  return {
    object: "block",
    type,
    [type]: {
      rich_text: richText.slice(0, 100)
    }
  };
}

function imageBlock(url, caption) {
  return {
    object: "block",
    type: "image",
    image: {
      type: "external",
      external: {
        url
      },
      caption: caption ? toRichText(caption).slice(0, 100) : []
    }
  };
}

function embedBlock(url) {
  return {
    object: "block",
    type: "embed",
    embed: {
      url
    }
  };
}

function normalizeCodeLanguage(value) {
  const aliases = {
    cpp: "c++",
    js: "javascript",
    ts: "typescript",
    py: "python",
    yml: "yaml",
    md: "markdown",
    text: "plain text",
    txt: "plain text",
    sh: "shell",
    ps1: "powershell"
  };
  const normalized = value ? value.toLowerCase() : "plain text";
  const mapped = aliases[normalized] || normalized;
  return supportedCodeLanguages.has(mapped) ? mapped : "plain text";
}

function toRichText(text, annotations = {}, href = "") {
  const cleaned = (text || "").replace(/\r/g, "");
  if (!cleaned) return [];

  return splitText(cleaned, 1800).map((content) => ({
    type: "text",
    text: {
      content,
      link: href ? { url: href } : null
    },
    annotations: {
      bold: Boolean(annotations.bold),
      italic: Boolean(annotations.italic),
      strikethrough: Boolean(annotations.strikethrough),
      underline: Boolean(annotations.underline),
      code: Boolean(annotations.code),
      color: "default"
    }
  }));
}

function splitText(text, size) {
  const parts = [];
  let current = text;

  while (current.length > size) {
    parts.push(current.slice(0, size));
    current = current.slice(size);
  }

  if (current) {
    parts.push(current);
  }

  return parts;
}

function extractSummary(markdown) {
  return stripMarkdown(markdown).slice(0, 140).trim();
}

function buildSummary(value, title, markdown) {
  if (markdown.includes("mllm-survey-cn.html")) {
    return "多模态大语言模型综述专题页，已作为独立交互页面保留。";
  }

  return extractSummary(stripHtml(value)) || title;
}

function normalizeArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => normalizeArray(item)).filter(Boolean);
  }
  return [String(value).trim()].filter(Boolean);
}

function normalizeDate(value) {
  const date = value ? new Date(String(value)) : new Date();
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

function normalizeMarkdown(markdown) {
  return markdown
    .replace(/(\(|")\.\.\/img\//g, "$1/img/")
    .replace(/(\(|")\.\/img\//g, "$1/img/")
    .replace(/(\(|")img\//g, "$1/img/")
    .replace(/(\(|")\.\.\/data\//g, "$1/data/")
    .replace(/(\(|")\.\/data\//g, "$1/data/")
    .replace(/(\(|")data\//g, "$1/data/")
    .replace(/(\(|")\.\.\/survey-assets\//g, "$1/survey-assets/")
    .replace(/(\(|")\.\/survey-assets\//g, "$1/survey-assets/")
    .replace(/(\(|")survey-assets\//g, "$1/survey-assets/");
}

function normalizeAssetUrl(value) {
  if (!value) return "";

  const normalized = String(value).trim().replace(/\\/g, "/");
  if (/^https?:\/\//i.test(normalized)) {
    try {
      const parsed = new URL(normalized);
      const assetPrefixes = ["/img/", "/data/", "/survey-assets/", "/mllm-survey-cn.html"];
      const matchedPrefix = assetPrefixes.find((prefix) => parsed.pathname.startsWith(prefix));
      if (matchedPrefix) {
        return `${parsed.pathname}${parsed.search}${parsed.hash}`;
      }
    } catch {
      // Fall through to return the original external URL.
    }
    return normalized;
  }

  const windowsAssetPath = normalized.match(/(?:[A-Za-z]:)?\/.*?\/public\/(img|data|survey-assets)\/(.+)$/i);
  if (windowsAssetPath) {
    const [, folder, rest] = windowsAssetPath;
    return `/${folder}/${rest}`;
  }

  if (/(?:[A-Za-z]:)?\/.*?\/public\/mllm-survey-cn\.html$/i.test(normalized)) {
    return "/mllm-survey-cn.html";
  }

  const path = normalized
    .replace(/^(\.\.\/)+img\//, "/img/")
    .replace(/^(\.\/)+img\//, "/img/")
    .replace(/^img\//, "/img/")
    .replace(/^(\.\.\/)+data\//, "/data/")
    .replace(/^(\.\/)+data\//, "/data/")
    .replace(/^data\//, "/data/")
    .replace(/^(\.\.\/)+survey-assets\//, "/survey-assets/")
    .replace(/^(\.\/)+survey-assets\//, "/survey-assets/")
    .replace(/^survey-assets\//, "/survey-assets/");

  return path.startsWith("/") ? path : path;
}

function normalizeOrigin(value) {
  return value.replace(/\/+$/, "");
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

function stripHtml(value) {
  return String(value)
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

function stripMarkdown(value) {
  return String(value)
    .replace(/!\[[^\]]*]\(([^)]+)\)/g, " ")
    .replace(/\[([^\]]+)]\(([^)]+)\)/g, "$1")
    .replace(/`{1,3}([^`]+)`{1,3}/g, "$1")
    .replace(/[*_>#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tableToText(token) {
  const header = (token.header || []).map((item) => stripMarkdown(item.text || ""));
  const rows = (token.rows || []).map((row) => row.map((item) => stripMarkdown(item.text || "")));
  return [header, ...rows].map((row) => row.join(" | ")).join("\n");
}

function readSlug(page) {
  const property = page.properties?.["链接名"];
  if (!property || property.type !== "rich_text") return "";
  return property.rich_text.map((item) => item.plain_text || "").join("");
}

async function ensureJsonFile(outputFile, data) {
  await mkdir(dirname(outputFile), { recursive: true });
  await writeFile(outputFile, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function readTitle(page) {
  const property = page.properties?.["标题"];
  if (!property || property.type !== "title") return "";
  return property.title.map((item) => item.plain_text || "").join("");
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
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
