import type { TemplateDefinition, TemplateThemePreset } from "../types";
import Home from "./Home.astro";

export const ledgerPreset: TemplateThemePreset = {
  title: "Ledger",
  description: "偏中文专栏与长文阅读的报刊式主题，适合技术记录、研究笔记和阶段总结。",
  preview: "报刊首页 + 纵向长文流 + 两侧索引",
  aesthetic: "中文专栏 / 报刊感 / 长文阅读导向",
  homeTemplate: "journal",
  cardStyle: "outline",
  sidebarStyle: "minimal",
  vars: {
    "--theme-color": "#8e5a48",
    "--theme-color-deep": "#5b342a",
    "--theme-accent": "#281d19",
    "--theme-text": "#241b18",
    "--theme-muted": "#7c6d63",
    "--theme-line": "rgba(93, 67, 52, 0.18)",
    "--theme-bg": "#f6f0e8",
    "--theme-panel": "rgba(255, 251, 246, 0.94)",
    "--theme-panel-solid": "#fffaf4",
    "--theme-panel-soft": "rgba(255, 246, 238, 0.76)",
    "--theme-shadow": "0 14px 36px rgba(72, 51, 41, 0.06)",
    "--theme-shadow-strong": "0 18px 46px rgba(72, 51, 41, 0.11)",
    "--theme-bg-image":
      "radial-gradient(circle at top right, rgba(142, 90, 72, 0.08), transparent 21%), radial-gradient(circle at left 18%, rgba(39, 29, 26, 0.05), transparent 24%), linear-gradient(180deg, #faf6ef 0%, #f3ece2 100%)",
    "--theme-nav-bg": "rgba(250, 245, 238, 0.84)",
    "--theme-nav-border": "rgba(93, 67, 52, 0.1)",
    "--theme-hero-mask":
      "linear-gradient(135deg, rgba(30, 23, 20, 0.28), rgba(30, 23, 20, 0.46)), linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(0, 0, 0, 0.1))",
    "--theme-hero-panel-bg": "rgba(39, 29, 26, 0.22)",
    "--theme-hero-panel-border": "rgba(255, 244, 233, 0.18)",
    "--theme-hero-panel-shadow": "0 24px 54px rgba(35, 27, 23, 0.18)",
    "--theme-soft-fill": "rgba(140, 79, 61, 0.07)",
    "--theme-soft-fill-strong": "rgba(140, 79, 61, 0.12)",
    "--theme-code-bg": "#241d1c",
    "--theme-code-text": "#f8f0e5",
    "--theme-reading-text": "#3b312b",
    "--radius-lg": "22px",
    "--radius-md": "16px",
    "--radius-sm": "10px",
    "--nav-width": "1360px",
    "--content-width": "1380px",
    "--page-width": "1180px",
    "--reading-width": "1360px",
    "--font-sans": '"Libre Franklin", "PingFang SC", "Microsoft YaHei", sans-serif',
    "--font-display": '"EB Garamond", "Noto Serif SC", "Source Han Serif SC", serif'
  }
};

export const ledgerTemplate: TemplateDefinition = {
  id: "ledger",
  ...ledgerPreset,
  component: Home
};
