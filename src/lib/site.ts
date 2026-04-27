import { withBasePath } from "./paths";

const env = import.meta.env;

function readPublicVar(name: string, fallback: string) {
  const value = env[name];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export const siteConfig = {
  title: readPublicVar("PUBLIC_BLOG_TITLE", "我的博客"),
  subtitle: readPublicVar("PUBLIC_BLOG_SUBTITLE", "在 Notion 写作，用 Astro 发布"),
  description: readPublicVar("PUBLIC_BLOG_DESCRIPTION", "记录思考、技术与生活。"),
  author: readPublicVar("PUBLIC_BLOG_AUTHOR", "你的名字"),
  motto: readPublicVar("PUBLIC_BLOG_MOTTO", "用内容积累长期价值。"),
  github: readPublicVar("PUBLIC_BLOG_GITHUB", "https://github.com/your-name"),
  profile: readPublicVar("PUBLIC_BLOG_PROFILE", "https://your-site.example.com/"),
  avatar: withBasePath(readPublicVar("PUBLIC_BLOG_AVATAR", "/img/starter-avatar.svg")),
  logo: withBasePath(readPublicVar("PUBLIC_BLOG_LOGO", "/img/starter-logo.svg")),
  defaultCover: withBasePath(readPublicVar("PUBLIC_BLOG_DEFAULT_COVER", "/img/starter-cover.svg")),
  runtimeSince: readPublicVar("PUBLIC_BLOG_RUNTIME_SINCE", "2024-01-01"),
  recordText: readPublicVar("PUBLIC_BLOG_RECORD_TEXT", ""),
  recordLink: readPublicVar("PUBLIC_BLOG_RECORD_LINK", "")
};
