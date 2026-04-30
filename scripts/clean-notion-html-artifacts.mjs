import { Client } from "@notionhq/client";
import { access } from "node:fs/promises";

await loadLocalEnv();

const notionToken = process.env.NOTION_TOKEN;
const databaseId = process.env.NOTION_DATABASE_ID;
const shouldApply = process.argv.includes("--apply");
const slugFilters = process.argv
  .filter((arg) => arg.startsWith("--slug="))
  .map((arg) => arg.slice("--slug=".length))
  .filter(Boolean);

if (!notionToken || !databaseId) {
  throw new Error("Missing NOTION_TOKEN or NOTION_DATABASE_ID.");
}

const notion = new Client({ auth: notionToken });
const pages = await queryAllPages();
const changes = [];

for (const page of pages) {
  if (page.archived || page.in_trash) continue;

  const title = readTitle(page);
  const slug = readSlug(page);
  if (slugFilters.length > 0 && !slugFilters.includes(slug)) continue;
  await scanBlocks(page.id, { title, slug }, changes);
}

if (!changes.length) {
  console.log("No cleanable HTML artifacts found in Notion blocks.");
  process.exit(0);
}

console.log(`Found ${changes.length} cleanable blocks.`);

for (const change of changes) {
  console.log(`- ${change.context.slug || change.context.title || change.context.pageId}: ${change.before} -> ${change.after}`);
}

if (!shouldApply) {
  console.log("Dry run only. Re-run with --apply to update Notion blocks.");
  process.exit(0);
}

for (const change of changes) {
  await notion.blocks.update(buildUpdatePayload(change.block, change.after));
  await sleep(180);
}

console.log(`Applied ${changes.length} block updates to Notion.`);

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

async function scanBlocks(blockId, context, changes, cursor) {
  const response = await notion.blocks.children.list({
    block_id: blockId,
    start_cursor: cursor,
    page_size: 100
  });

  for (const block of response.results) {
    const candidate = extractCleanableBlock(block, context);
    if (candidate) {
      changes.push(candidate);
    }

    if (block.has_children) {
      await scanBlocks(block.id, context, changes);
    }
  }

  if (response.has_more && response.next_cursor) {
    await scanBlocks(blockId, context, changes, response.next_cursor);
  }
}

function extractCleanableBlock(block, context) {
  const richText = getRichText(block);
  if (!richText.length) return null;

  if (richText.length !== 1) return null;

  const before = (richText[0].plain_text || "").trim();
  if (!before) return null;

  const after = cleanupArtifactText(before);
  if (!after || after === before) return null;

  return {
    block,
    context: {
      ...context,
      pageId: block.parent?.page_id || ""
    },
    before,
    after
  };
}

function getRichText(block) {
  switch (block.type) {
    case "paragraph":
      return block.paragraph.rich_text || [];
    case "heading_1":
      return block.heading_1.rich_text || [];
    case "heading_2":
      return block.heading_2.rich_text || [];
    case "heading_3":
      return block.heading_3.rich_text || [];
    case "quote":
      return block.quote.rich_text || [];
    case "bulleted_list_item":
      return block.bulleted_list_item.rich_text || [];
    case "numbered_list_item":
      return block.numbered_list_item.rich_text || [];
    default:
      return [];
  }
}

function cleanupArtifactText(value) {
  const source = value.trim();
  if (!source) return source;
  if (/[\r\n]/.test(source)) return source;

  const decoded = decodeEntities(source);
  const cleaned = decoded
    .replace(/&nbsp;/gi, " ")
    .replace(/^<(p|strong|em|u|s|code)\s+([^<]+?)<\/\1>?$/i, "$2")
    .replace(/^&lt;(p|strong|em|u|s|code)\s+([^<]+?)&lt;\/\1>?$/i, "$2")
    .replace(/^<(p|strong|em|u|s|code)>\s*([^<]+?)\s*<\/\1>?$/i, "$2")
    .replace(/^&lt;(p|strong|em|u|s|code)&gt;\s*([^<]+?)\s*&lt;\/\1&gt;$/i, "$2")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned === source) return source;
  if (/[<>]/.test(cleaned)) return source;
  return cleaned;
}

function decodeEntities(value) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function buildUpdatePayload(block, text) {
  const rich_text = toRichText(text);

  switch (block.type) {
    case "paragraph":
      return {
        block_id: block.id,
        paragraph: {
          rich_text,
          color: block.paragraph.color || "default"
        }
      };
    case "heading_1":
      return {
        block_id: block.id,
        heading_1: {
          rich_text,
          color: block.heading_1.color || "default"
        }
      };
    case "heading_2":
      return {
        block_id: block.id,
        heading_2: {
          rich_text,
          color: block.heading_2.color || "default"
        }
      };
    case "heading_3":
      return {
        block_id: block.id,
        heading_3: {
          rich_text,
          color: block.heading_3.color || "default"
        }
      };
    case "quote":
      return {
        block_id: block.id,
        quote: {
          rich_text,
          color: block.quote.color || "default"
        }
      };
    case "bulleted_list_item":
      return {
        block_id: block.id,
        bulleted_list_item: {
          rich_text,
          color: block.bulleted_list_item.color || "default"
        }
      };
    case "numbered_list_item":
      return {
        block_id: block.id,
        numbered_list_item: {
          rich_text,
          color: block.numbered_list_item.color || "default"
        }
      };
    default:
      throw new Error(`Unsupported block type: ${block.type}`);
  }
}

function toRichText(text) {
  return splitText(text, 1800).map((content) => ({
    type: "text",
    text: {
      content
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

function readTitle(page) {
  const property = page.properties?.["标题"] || page.properties?.["Title"] || page.properties?.["Name"];
  if (!property || property.type !== "title") return "";
  return property.title.map((item) => item.plain_text || "").join("");
}

function readSlug(page) {
  const property = page.properties?.["链接名"] || page.properties?.["Slug"] || page.properties?.["路径"];
  if (!property) return "";

  if (property.type === "rich_text") {
    return property.rich_text.map((item) => item.plain_text || "").join("");
  }

  if (property.type === "title") {
    return property.title.map((item) => item.plain_text || "").join("");
  }

  return "";
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
    // Ignore missing local env file.
  }
}
