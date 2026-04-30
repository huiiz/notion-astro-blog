import type { PostHeading } from "./posts";

type TocOptions = {
  maxLevel?: 2 | 3 | 4;
  maxItems?: number;
};

export function getReadableToc(headings: PostHeading[], options: TocOptions = {}): PostHeading[] {
  const { maxLevel = 3, maxItems = 18 } = options;
  const filtered = headings.filter((heading) => heading.level <= maxLevel);
  const selected = filtered.length ? filtered : headings;

  return selected.slice(0, maxItems);
}
