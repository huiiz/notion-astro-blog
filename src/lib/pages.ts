import generatedFriends from "../data/generated/friends.json";
import generatedPages from "../data/generated/pages.json";
import samplePages from "../data/sample-pages.json";

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

const sourcePages = (generatedPages.length ? generatedPages : samplePages) as StandalonePage[];
const pages = sourcePages.map((page) => ({
  ...page,
  html: normalizeImportedHtml(page.html || "")
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
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}
