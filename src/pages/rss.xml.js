import rss from "@astrojs/rss";
import { getAllPosts } from "../lib/posts";
import { siteConfig } from "../lib/site";

export function GET(context) {
  return rss({
    title: siteConfig.title,
    description: siteConfig.description,
    site: context.site,
    items: getAllPosts().map((post) => ({
      title: post.title,
      pubDate: new Date(post.publishedAt),
      description: post.summary,
      link: `posts/${post.slug}/`
    }))
  });
}
