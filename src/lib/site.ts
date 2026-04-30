import { notionSiteSettings } from "./notion-config";
import { withBasePath } from "./paths";

const env = import.meta.env;

function readConfiguredVar(key: keyof typeof notionSiteSettings, name: string, fallback: string) {
  const notionValue = notionSiteSettings[key];
  if (typeof notionValue === "string" && notionValue.trim()) {
    return notionValue.trim();
  }

  const envValue = env[name];
  return typeof envValue === "string" && envValue.trim() ? envValue.trim() : fallback;
}

export const siteConfig = {
  title: readConfiguredVar("title", "PUBLIC_BLOG_TITLE", "My Blog"),
  subtitle: readConfiguredVar("subtitle", "PUBLIC_BLOG_SUBTITLE", "New Beginning, New Way"),
  description: readConfiguredVar(
    "description",
    "PUBLIC_BLOG_DESCRIPTION",
    "Notes on tech, projects, and life."
  ),
  author: readConfiguredVar("author", "PUBLIC_BLOG_AUTHOR", "Your Name"),
  motto: readConfiguredVar("motto", "PUBLIC_BLOG_MOTTO", "Build slowly, think clearly."),
  github: readConfiguredVar("github", "PUBLIC_BLOG_GITHUB", "https://github.com/your-name"),
  profile: readConfiguredVar("profile", "PUBLIC_BLOG_PROFILE", "https://your-site.example.com/"),
  avatar: withBasePath(readConfiguredVar("avatar", "PUBLIC_BLOG_AVATAR", "/img/starter-avatar.svg")),
  logo: withBasePath(readConfiguredVar("logo", "PUBLIC_BLOG_LOGO", "/img/starter-logo.svg")),
  defaultCover: withBasePath(readConfiguredVar("defaultCover", "PUBLIC_BLOG_DEFAULT_COVER", "/img/starter-cover.svg")),
  runtimeSince: readConfiguredVar("runtimeSince", "PUBLIC_BLOG_RUNTIME_SINCE", "2024-01-01"),
  recordText: readConfiguredVar("recordText", "PUBLIC_BLOG_RECORD_TEXT", ""),
  recordLink: readConfiguredVar("recordLink", "PUBLIC_BLOG_RECORD_LINK", "")
};
