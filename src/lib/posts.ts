import generatedPosts from "../data/generated/posts.json";
import samplePosts from "../data/sample-posts.json";
import { prefixHtmlAssetPaths, withBasePath } from "./paths";

export type PostHeading = {
  level: 2 | 3 | 4;
  text: string;
  id: string;
};

export type BlogPost = {
  id: string;
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
  contentText: string;
  readingMinutes: number;
  headings: PostHeading[];
  year: string;
  month: string;
};

type RawPost = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  publishedAt: string;
  updatedAt?: string;
  tags?: string[];
  categories?: string[];
  featured?: boolean;
  cover?: string;
  html: string;
};

type ArchiveGroup = {
  year: string;
  posts: BlogPost[];
};

type TaxonomyCount = {
  name: string;
  count: number;
};

const rawPosts = ((generatedPosts.length ? generatedPosts : samplePosts) as RawPost[]).map(enrichPost);

export function getAllPosts(): BlogPost[] {
  return [...rawPosts].sort((left, right) => {
    return new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime();
  });
}

export function getLatestPosts(limit = 6): BlogPost[] {
  return getAllPosts().slice(0, limit);
}

export function getFeaturedPosts(): BlogPost[] {
  const featured = getAllPosts().filter((post) => post.featured);
  return featured.length ? featured : getAllPosts().slice(0, 2);
}

export function getPostBySlug(slug: string): BlogPost | undefined {
  return getAllPosts().find((post) => post.slug === slug);
}

export function getAllTags(): string[] {
  return [...new Set(getAllPosts().flatMap((post) => post.tags))].sort((left, right) =>
    left.localeCompare(right, "zh-CN")
  );
}

export function getPostsByTag(tag: string): BlogPost[] {
  return getAllPosts().filter((post) => post.tags.includes(tag));
}

export function getTagBySlug(slug: string): string | undefined {
  return getAllTags().find((tag) => slugifyText(tag) === slug);
}

export function slugifyTag(tag: string): string {
  return slugifyText(tag);
}

export function getAllCategories(): string[] {
  return [...new Set(getAllPosts().flatMap((post) => post.categories))].sort((left, right) =>
    left.localeCompare(right, "zh-CN")
  );
}

export function getPostsByCategory(category: string): BlogPost[] {
  return getAllPosts().filter((post) => post.categories.includes(category));
}

export function getCategoryBySlug(slug: string): string | undefined {
  return getAllCategories().find((category) => slugifyText(category) === slug);
}

export function slugifyCategory(category: string): string {
  return slugifyText(category);
}

export function getArchiveGroups(): ArchiveGroup[] {
  const groups = new Map<string, BlogPost[]>();

  for (const post of getAllPosts()) {
    const current = groups.get(post.year) || [];
    current.push(post);
    groups.set(post.year, current);
  }

  return [...groups.entries()].map(([year, posts]) => ({ year, posts }));
}

export function getTagCounts(): TaxonomyCount[] {
  return buildCounts(getAllPosts().flatMap((post) => post.tags));
}

export function getCategoryCounts(): TaxonomyCount[] {
  return buildCounts(getAllPosts().flatMap((post) => post.categories));
}

export function getLatestUpdatedPost(): BlogPost | undefined {
  return [...getAllPosts()].sort((left, right) => {
    return (
      new Date(right.updatedAt || right.publishedAt).getTime() -
      new Date(left.updatedAt || left.publishedAt).getTime()
    );
  })[0];
}

export function getAdjacentPosts(slug: string) {
  const posts = getAllPosts();
  const index = posts.findIndex((post) => post.slug === slug);

  return {
    newer: index > 0 ? posts[index - 1] : undefined,
    older: index >= 0 && index < posts.length - 1 ? posts[index + 1] : undefined
  };
}

export function getRelatedPosts(slug: string, limit = 3): BlogPost[] {
  const post = getPostBySlug(slug);
  if (!post) return [];

  return getAllPosts()
    .filter((candidate) => candidate.slug !== slug)
    .map((candidate) => ({
      candidate,
      score:
        candidate.tags.filter((tag) => post.tags.includes(tag)).length * 2 +
        candidate.categories.filter((category) => post.categories.includes(category)).length
    }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return new Date(right.candidate.publishedAt).getTime() - new Date(left.candidate.publishedAt).getTime();
    })
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(new Date(date));
}

export function formatMonth(date: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long"
  }).format(new Date(date));
}

export function getDefaultCover(post: BlogPost): string {
  return withBasePath(normalizeAssetPath(post.cover || "/img/index.png"));
}

function enrichPost(post: RawPost): BlogPost {
  const normalizedHtml = normalizeImportedHtml(post.html);
  const { html, headings } = enrichHtml(prefixHtmlAssetPaths(normalizedHtml));
  const contentText = stripHtml(html);
  const charCount = contentText.replace(/\s+/g, "").length;

  return {
    ...post,
    tags: post.tags || [],
    categories: post.categories || [],
    cover: withBasePath(normalizeAssetPath(post.cover || "")),
    html,
    headings,
    contentText,
    readingMinutes: Math.max(1, Math.round(charCount / 380)),
    year: post.publishedAt.slice(0, 4),
    month: post.publishedAt.slice(5, 7)
  };
}

function buildCounts(items: string[]): TaxonomyCount[] {
  const counts = new Map<string, number>();

  for (const item of items) {
    counts.set(item, (counts.get(item) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return left.name.localeCompare(right.name, "zh-CN");
    });
}

function enrichHtml(html: string) {
  const headings: PostHeading[] = [];
  const seen = new Set<string>();

  const nextHtml = html.replace(/<h([2-4])>(.*?)<\/h\1>/gsi, (_match, rawLevel, innerHtml) => {
    const level = Number(rawLevel) as 2 | 3 | 4;
    const text = stripHtml(innerHtml);
    const id = uniqueSlug(text, seen);
    headings.push({ level, text, id });
    return `<h${level} id="${id}">${innerHtml}</h${level}>`;
  });

  return { html: nextHtml, headings };
}

function normalizeImportedHtml(html: string): string {
  return html
    .split(/(<pre[\s\S]*?<\/pre>)/gi)
    .map((segment, index) => (index % 2 === 1 ? segment : repairPseudoHtml(segment)))
    .join("")
    .replace(/(["'(])https?:\/\/[^/"']+\/(img|data|survey-assets)\//gi, '$1/$2/')
    .replace(/(["'(])https?:\/\/[^/"']+\/mllm-survey-cn\.html/gi, '$1/mllm-survey-cn.html')
    .replace(
      /(["'(])(?:[A-Za-z]:)?[\\/].*?[\\/]public[\\/](img|data|survey-assets)[\\/]/gi,
      (_match, prefix, folder) => `${prefix}/${folder}/`
    )
    .replace(
      /(["'(])(?:[A-Za-z]:)?[\\/].*?[\\/]public[\\/]mllm-survey-cn\.html/gi,
      '$1/mllm-survey-cn.html'
    )
    .replace(/<p>\s*<\/p>/g, "")
    .replace(/<li>\s*<\/li>/g, "");
}

function repairPseudoHtml(segment: string): string {
  return segment
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(
      /&lt;a href="\/survey assets\/openclaw survey\.pdf"\s*英文版PDF（10页）&lt;\/a/gi,
      '<a href="/survey-assets/openclaw_survey.pdf">英文版PDF（10页）</a>'
    )
    .replace(
      /&lt;a href="\/survey assets\/openclaw survey cn\.pdf"(?:\s+target="_blank"\s+rel="noreferrer")?\s*中文版PDF（14页）&lt;\/a/gi,
      '<a href="/survey-assets/openclaw-survey-cn.pdf">中文版PDF（14页）</a>'
    )
    .replace(/\/survey assets\//gi, "/survey-assets/")
    .replace(/openclaw survey cn\.pdf/gi, "openclaw-survey-cn.pdf")
    .replace(/openclaw survey\.pdf/gi, "openclaw_survey.pdf")
    .replace(/&lt;strong\s+([^<]+?)&lt;\/strong/gi, "<strong>$1</strong>")
    .replace(/&lt;(em|u|s|p|li|blockquote|figcaption|h[2-4])\s+([^<]+?)&lt;\/\1/gi, "<$1>$2</$1>")
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
    .replace(/&lt;pre\b/gi, "<pre>")
    .replace(/&lt;\/pre/gi, "</pre>")
    .replace(/&lt;code\s+class="([^"]+)"\s*/gi, '<code class="$1">')
    .replace(/&lt;\/code/gi, "</code>")
    .replace(/&lt;\/(p|li|ul|ol|blockquote|strong|em|u|s|a|figure|figcaption|h[2-4])/gi, "</$1>")
    .replace(/&lt;(ul|ol|blockquote|figure)\b/gi, "<$1>")
    .replace(/<a href="([^"]+)" target="_blank" rel="noreferrer">([^<]+)<\/a>/gi, (_match, href, text) => {
      if (/\.(pdf|zip|rar)$/i.test(href)) {
        return `<a href="${href}">${text}</a>`;
      }
      return `<a href="${href}" target="_blank" rel="noreferrer">${text}</a>`;
    });
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

function uniqueSlug(text: string, seen: Set<string>): string {
  const base = slugifyText(text) || `section-${seen.size + 1}`;
  let next = base;
  let suffix = 2;

  while (seen.has(next)) {
    next = `${base}-${suffix}`;
    suffix += 1;
  }

  seen.add(next);
  return next;
}

function slugifyText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeAssetPath(value: string): string {
  if (!value) return "";

  const normalized = value.trim().replace(/\\/g, "/");

  try {
    const parsed = new URL(normalized);
    if (
      parsed.pathname.startsWith("/img/") ||
      parsed.pathname.startsWith("/data/") ||
      parsed.pathname.startsWith("/survey-assets/") ||
      parsed.pathname === "/mllm-survey-cn.html"
    ) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    // Non-URL values continue below.
  }

  const windowsAssetPath = normalized.match(/(?:[A-Za-z]:)?\/.*?\/public\/(img|data|survey-assets)\/(.+)$/i);
  if (windowsAssetPath) {
    const [, folder, rest] = windowsAssetPath;
    return `/${folder}/${rest}`;
  }

  if (/(?:[A-Za-z]:)?\/.*?\/public\/mllm-survey-cn\.html$/i.test(normalized)) {
    return "/mllm-survey-cn.html";
  }

  return normalized;
}
