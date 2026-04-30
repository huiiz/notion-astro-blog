import generatedFriends from "../data/generated/friends.json";
import generatedPages from "../data/generated/pages.json";
import samplePages from "../data/sample-pages.json";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { prefixHtmlAssetPaths } from "./paths";

export type StandalonePage = {
  id: string;
  type: string;
  title: string;
  slug: string;
  summary: string;
  publishedAt: string;
  updatedAt?: string;
  tags: string[];
  categories: string[];
  featured?: boolean;
  cover?: string;
  html: string;
};

export type FriendLink = {
  name: string;
  link: string;
  avatar: string;
  descr: string;
};

export type FriendGroup = {
  className: string;
  classDesc: string;
  links: FriendLink[];
};

const sourcePages = ((generatedPages.length ? generatedPages : samplePages) as StandalonePage[]);

const pages = sourcePages.map((page) => ({
  ...page,
  html: prefixHtmlAssetPaths(
    stripMissingAssetMarkup(
      stripAssetCacheMarkers(rewriteLegacyAssetCachePaths(rewriteCachedAssetBlocks(normalizeImportedHtml(page.html || ""))))
    )
  )
}));
const friendGroups = generatedFriends as FriendGroup[];

export function getAllPages(): StandalonePage[] {
  return [...pages].sort((left, right) => {
    return new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime();
  });
}

export function getPageBySlug(slug: string): StandalonePage | undefined {
  return getAllPages().find((page) => page.slug === slug);
}

export function getFriendGroups(): FriendGroup[] {
  return friendGroups.filter((group) => group.links.length > 0);
}

function normalizeImportedHtml(html: string): string {
  return html
    .split(/(<pre[\s\S]*?<\/pre>)/gi)
    .map((segment, index) => (index % 2 === 1 ? segment : repairPseudoHtml(segment)))
    .join("")
    .replace(/&lt;p\s+([^<]+?)&lt;\/p/g, "<p>$1</p>")
    .replace(/&lt;strong\s+([^<]+?)&lt;\/strong/g, "<strong>$1</strong>")
    .replace(/<(strong|em|u|s|p|li|blockquote|figcaption|h[2-4])\s+([^<]+?)<\/\1/gi, "<$1>$2</$1>")
    .replace(/<li>&lt;p\s+([^<]+?)&lt;\/p<\/li>/g, "<li>$1</li>")
    .replace(/<(p|strong|em|u|s|li|blockquote|figcaption|h[2-4])\s+([^>]+?)<\/\1(?!>)/gi, "<$1>$2</$1>")
    .replace(/<\/(p|li|blockquote|strong|em|u|s|figcaption|h[2-4])(?!>)/gi, "</$1>")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\|\>/g, "")
    .replace(/<u>l>/gi, "<ul>")
    .replace(/<\/u>l>/gi, "</ul>")
    .replace(/<o>l>/gi, "<ol>")
    .replace(/<\/o>l>/gi, "</ol>")
    .replace(/<p>\s*<\/p>/g, "")
    .replace(/<li>\s*<\/li>/g, "");
}

function rewriteCachedAssetBlocks(html: string): string {
  const assetMap = new Map<string, string>();
  let nextHtml = html;

  nextHtml = nextHtml.replace(
    /<figure><img src="([^"]+)" alt="__ASSET_CACHE__:(\/[^"]+)" \/><figcaption>__ASSET_CACHE__:[^<]+<\/figcaption><\/figure>/gi,
    (_match, notionUrl, legacyPath) => {
      assetMap.set(normalizeLegacyAssetKey(legacyPath), notionUrl);
      return "";
    }
  );

  nextHtml = nextHtml.replace(
    /<p><a href="([^"]+)"(?:\s+target="[^"]*")?(?:\s+rel="[^"]*")?>__ASSET_CACHE__:(\/[^<]+)<\/a><\/p>/gi,
    (_match, notionUrl, legacyPath) => {
      assetMap.set(normalizeLegacyAssetKey(legacyPath), notionUrl);
      return "";
    }
  );

  if (!assetMap.size) {
    return nextHtml;
  }

  return nextHtml.replace(
    /((?:src|href)=["'])(\/(?:img|data|survey-assets)\/[^"'?#>]+(?:\?[^"'>]*)?)(["'])/gi,
    (fullMatch, prefix, legacyPath, suffix) => {
      const replacement = assetMap.get(normalizeLegacyAssetKey(legacyPath));
      return replacement ? `${prefix}${replacement}${suffix}` : fullMatch;
    }
  );
}

function rewriteLegacyAssetCachePaths(html: string): string {
  return html.replace(
    /((?:src|href)=["'])\/notion\/[^/"']+\/(?:image|attachment)\/__ASSET_CACHE__-((?:img|data|survey-assets))-(.+?)-[0-9a-f]{12}\.[a-z0-9]+((?:\?[^"'>]*)?)(["'])/gi,
    (_match, prefix, folder, fileName, search, suffix) => `${prefix}/${folder}/${fileName}${search}${suffix}`
  );
}

function stripAssetCacheMarkers(html: string): string {
  return html
    .replace(
      /<figure>\s*<img[^>]*alt="__ASSET_CACHE__:[^"]*"[^>]*>\s*(?:<figcaption>__ASSET_CACHE__:[\s\S]*?<\/figcaption>)?\s*<\/figure>/gi,
      ""
    )
    .replace(/<p>\s*<a href="[^"]+"(?:\s+target="[^"]*")?(?:\s+rel="[^"]*")?>__ASSET_CACHE__:[\s\S]*?<\/a>\s*<\/p>/gi, "")
    .replace(/<p>\s*__ASSET_CACHE__:[\s\S]*?<\/p>/gi, "")
    .replace(/__ASSET_CACHE__:[^<\s"]+/gi, "")
    .replace(/<p>\s*<\/p>/g, "")
    .replace(/<li>\s*<\/li>/g, "");
}

function stripMissingAssetMarkup(html: string): string {
  let nextHtml = html;

  nextHtml = nextHtml.replace(
    /<figure>\s*<img src="([^"]+)"[^>]*>\s*(?:<figcaption>[\s\S]*?<\/figcaption>)?\s*<\/figure>/gi,
    (match, src) => (assetReferenceExists(src) ? match : "")
  );

  nextHtml = nextHtml.replace(
    /<img src="([^"]+)"[^>]*\/?>/gi,
    (match, src) => (assetReferenceExists(src) ? match : "")
  );

  nextHtml = nextHtml.replace(
    /<a href="([^"]+)"([^>]*)>([\s\S]*?)<\/a>/gi,
    (match, href, _attrs, innerHtml) => {
      if (assetReferenceExists(href)) {
        return match;
      }

      const text = stripHtml(innerHtml).trim();
      return text || "";
    }
  );

  return nextHtml.replace(/<p>\s*<\/p>/g, "").replace(/<li>\s*<\/li>/g, "");
}

function repairPseudoHtml(segment: string): string {
  return segment
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;(strong|em|u|s|p|li|blockquote|figcaption|h[2-4])\s+([^<]+?)&lt;\/\1/gi, "<$1>$2</$1>")
    .replace(/&lt;code\s+([^<]+?)&lt;\/code/gi, "<code>$1</code>")
    .replace(
      /&lt;a\s+href="([^"]+)"\s+target="([^"]+)"\s+rel="([^"]+)"\s*([^<]+?)&lt;\/a/gi,
      '<a href="$1" target="$2" rel="$3">$4</a>'
    )
    .replace(
      /&lt;a\s+href="([^"]+)"\s+([^<]+?)&lt;\/a/gi,
      '<a href="$1" target="_blank" rel="noreferrer">$2</a>'
    )
    .replace(/&lt;img\s+src="([^"]+)"\s+alt="([^"]*)"[^<]*/gi, '<img src="$1" alt="$2" />')
    .replace(/&lt;\/(blockquote|figcaption|figure|strong|em|code|pre|ul|ol|li|p|a|u|s|h[2-4])/gi, "</$1>")
    .replace(/&lt;(ul|ol|blockquote|figure|pre)\b/gi, "<$1>")
    .replace(/<(strong|em|u|s|p|li|blockquote|figcaption|h[2-4])\s+([^>]+?)<\/\1>/gi, "<$1>$2</$1>");
}

function normalizeLegacyAssetKey(value: string): string {
  return decodeURIComponent(value || "")
    .replace(/\\/g, "/")
    .replace(/\/survey assets\//gi, "/survey-assets/")
    .replace(/\?.*$/, "")
    .replace(/#.*$/, "")
    .trim()
    .toLowerCase();
}

function assetReferenceExists(value: string): boolean {
  const assetPath = normalizeAssetLookupPath(value);
  if (!assetPath) return true;

  return existsSync(resolve("public", `.${assetPath}`));
}

function normalizeAssetLookupPath(value: string): string {
  const normalized = decodeURIComponent(value || "")
    .replace(/\\/g, "/")
    .replace(/\?.*$/, "")
    .replace(/#.*$/, "")
    .trim();

  return /^(\/(?:img|data|survey-assets|notion)\/.+|\/mllm-survey-cn\.html)$/i.test(normalized)
    ? normalized
    : "";
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
