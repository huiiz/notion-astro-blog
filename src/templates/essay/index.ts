import type { TemplateDefinition, TemplateThemePreset } from "../types";
import Home from "./Home.astro";

export const essayPreset: TemplateThemePreset = {
  title: "Essay",
  description: "学术作者站取向，强调清单式组织与更克制的阅读节奏。",
  preview: "作者简介 + 清单式文章列表",
  aesthetic: "学术作者 / 清单式首页 / 低卡片感",
  homeTemplate: "showcase",
  cardStyle: "magazine",
  sidebarStyle: "stacked",
  vars: {
    "--theme-color": "#315c6d",
    "--theme-color-deep": "#173646",
    "--theme-accent": "#11212c",
    "--theme-text": "#18242c",
    "--theme-muted": "#5f6f79",
    "--theme-line": "rgba(49, 92, 109, 0.14)",
    "--theme-bg": "#eef1f2",
    "--theme-panel": "rgba(255, 255, 255, 0.92)",
    "--theme-panel-solid": "#ffffff",
    "--theme-panel-soft": "rgba(247, 249, 250, 0.9)",
    "--theme-shadow": "0 12px 28px rgba(21, 38, 47, 0.05)",
    "--theme-shadow-strong": "0 18px 40px rgba(21, 38, 47, 0.08)",
    "--theme-bg-image":
      "radial-gradient(circle at top left, rgba(49, 92, 109, 0.09), transparent 24%), radial-gradient(circle at 82% 12%, rgba(23, 54, 70, 0.05), transparent 22%), linear-gradient(180deg, #fbfcfc 0%, #eef1f2 100%)",
    "--theme-nav-bg": "rgba(251, 252, 251, 0.9)",
    "--theme-nav-border": "rgba(49, 92, 109, 0.1)",
    "--theme-hero-mask":
      "linear-gradient(135deg, rgba(17, 33, 44, 0.18), rgba(17, 33, 44, 0.26)), linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(0, 0, 0, 0.1))",
    "--theme-hero-panel-bg": "rgba(17, 33, 44, 0.16)",
    "--theme-hero-panel-border": "rgba(255, 255, 255, 0.14)",
    "--theme-hero-panel-shadow": "0 20px 44px rgba(20, 32, 38, 0.12)",
    "--theme-soft-fill": "rgba(49, 92, 109, 0.06)",
    "--theme-soft-fill-strong": "rgba(49, 92, 109, 0.12)",
    "--theme-code-bg": "#16232d",
    "--theme-code-text": "#edf5f7",
    "--theme-reading-text": "#33424b",
    "--radius-lg": "12px",
    "--radius-md": "8px",
    "--radius-sm": "6px",
    "--nav-width": "1480px",
    "--content-width": "1500px",
    "--page-width": "1260px",
    "--reading-width": "1520px",
    "--font-sans": '"IBM Plex Sans", "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
    "--font-display": '"Georgia", "Times New Roman", "Noto Serif SC", "Source Han Serif SC", serif'
  }
};

export const essayTemplate: TemplateDefinition = {
  id: "essay",
  ...essayPreset,
  component: Home
};
