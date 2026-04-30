import type { TemplateDefinition, TemplateThemePreset } from "../types";
import Home from "./Home.astro";

export const cloverPreset: TemplateThemePreset = {
  title: "Clover",
  description: "先放作者信息和精选阅读，再用更轻的内容流打开首页。",
  preview: "作者首页 + 推荐阅读 + 文章河流",
  aesthetic: "作者站首页 / 轻柔内容流 / 松弛编辑感",
  homeTemplate: "showcase",
  cardStyle: "magazine",
  sidebarStyle: "stacked",
  vars: {
    "--theme-color": "#2f7b64",
    "--theme-color-deep": "#174b3d",
    "--theme-accent": "#18322d",
    "--theme-text": "#17312d",
    "--theme-muted": "#5d736d",
    "--theme-line": "rgba(61, 104, 89, 0.14)",
    "--theme-bg": "#eef6f0",
    "--theme-panel": "rgba(255, 255, 255, 0.94)",
    "--theme-panel-solid": "#ffffff",
    "--theme-panel-soft": "rgba(246, 251, 247, 0.84)",
    "--theme-shadow": "0 18px 44px rgba(22, 57, 47, 0.08)",
    "--theme-shadow-strong": "0 24px 60px rgba(22, 57, 47, 0.13)",
    "--theme-bg-image":
      "radial-gradient(circle at top left, rgba(47, 123, 100, 0.14), transparent 24%), radial-gradient(circle at 86% 12%, rgba(23, 76, 61, 0.08), transparent 20%), linear-gradient(180deg, #f9fcf9 0%, #edf5ef 100%)",
    "--theme-nav-bg": "rgba(248, 252, 248, 0.82)",
    "--theme-nav-border": "rgba(47, 122, 99, 0.08)",
    "--theme-hero-mask":
      "linear-gradient(135deg, rgba(19, 49, 45, 0.2), rgba(19, 49, 45, 0.36)), linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(0, 0, 0, 0.14))",
    "--theme-hero-panel-bg": "rgba(20, 48, 43, 0.2)",
    "--theme-hero-panel-border": "rgba(255, 255, 255, 0.16)",
    "--theme-hero-panel-shadow": "0 22px 56px rgba(16, 42, 38, 0.18)",
    "--theme-soft-fill": "rgba(47, 122, 99, 0.07)",
    "--theme-soft-fill-strong": "rgba(47, 122, 99, 0.12)",
    "--theme-code-bg": "#14302a",
    "--theme-code-text": "#edf7f1",
    "--theme-reading-text": "#334440",
    "--radius-lg": "28px",
    "--radius-md": "20px",
    "--radius-sm": "14px",
    "--nav-width": "1480px",
    "--content-width": "1500px",
    "--page-width": "1260px",
    "--reading-width": "1480px",
    "--font-sans": '"Avenir Next", "Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif',
    "--font-display": '"Palatino Linotype", "Book Antiqua", "Noto Serif SC", "Source Han Serif SC", serif'
  }
};

export const cloverTemplate: TemplateDefinition = {
  id: "clover",
  ...cloverPreset,
  component: Home
};
