import generatedNavigation from "../data/generated/navigation.json";
import generatedSiteConfig from "../data/generated/site-config.json";

export type SiteSettings = {
  title?: string;
  subtitle?: string;
  description?: string;
  author?: string;
  motto?: string;
  github?: string;
  profile?: string;
  avatar?: string;
  logo?: string;
  defaultCover?: string;
  runtimeSince?: string;
  recordText?: string;
  recordLink?: string;
};

export type ThemeSettings = {
  preset?: string;
  homeTemplate?: string;
  cardStyle?: string;
  sidebarStyle?: string;
  vars?: Record<string, string>;
};

export type NotionSiteConfig = {
  site?: SiteSettings;
  theme?: ThemeSettings;
};

export type NavigationItem = {
  label: string;
  href: string;
  external?: boolean;
  enabled?: boolean;
  order?: number;
};

const siteConfigData = (generatedSiteConfig || {}) as NotionSiteConfig;

export const notionSiteSettings: SiteSettings = {
  ...(siteConfigData.site || {})
};

export const notionThemeSettings: ThemeSettings = {
  ...(siteConfigData.theme || {}),
  vars: normalizeStringMap(siteConfigData.theme?.vars || {})
};

export const notionNavigation: NavigationItem[] = ((generatedNavigation || []) as NavigationItem[])
  .filter((item) => Boolean(item?.label?.trim()) && Boolean(item?.href?.trim()) && item.enabled !== false)
  .map((item, index) => ({
    label: item.label.trim(),
    href: item.href.trim(),
    external: Boolean(item.external),
    enabled: item.enabled !== false,
    order: typeof item.order === "number" ? item.order : index + 1
  }))
  .sort((left, right) => (left.order || 0) - (right.order || 0));

function normalizeStringMap(input: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(input).filter(([key, value]) => Boolean(key.trim()) && typeof value === "string" && Boolean(value.trim()))
  );
}
