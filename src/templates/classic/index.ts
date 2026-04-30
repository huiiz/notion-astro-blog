import type { TemplateDefinition, TemplateThemePreset } from "../types";
import Home from "./Home.astro";

export const classicPreset: TemplateThemePreset = {
  title: "Classic",
  description: "保留从旧博客迁移而来的熟悉结构，适合作为长期使用的默认版本。",
  preview: "大图首页 + 双列文章卡片 + 右侧信息栏",
  aesthetic: "经典个人博客 / 旧站迁移风格 / 熟悉的侧栏布局",
  homeTemplate: "showcase",
  cardStyle: "magazine",
  sidebarStyle: "stacked",
  vars: {
    "--theme-color": "#4d81ef",
    "--theme-color-deep": "#274f99",
    "--theme-accent": "#12243a",
    "--theme-text": "#1b2736",
    "--theme-muted": "#607286",
    "--theme-line": "rgba(89, 113, 145, 0.16)",
    "--theme-bg": "#eff4fb",
    "--theme-panel": "rgba(255, 255, 255, 0.92)",
    "--theme-panel-solid": "#ffffff",
    "--theme-panel-soft": "rgba(255, 255, 255, 0.76)",
    "--theme-shadow": "0 22px 55px rgba(24, 44, 78, 0.08)",
    "--theme-shadow-strong": "0 26px 68px rgba(24, 44, 78, 0.14)",
    "--theme-bg-image":
      "radial-gradient(circle at top right, rgba(77, 129, 239, 0.16), transparent 19%), radial-gradient(circle at left 10%, rgba(18, 36, 58, 0.08), transparent 28%), linear-gradient(180deg, #f8fbff 0%, #eef4fb 100%)",
    "--theme-nav-bg": "rgba(248, 251, 255, 0.78)",
    "--theme-nav-border": "rgba(77, 129, 239, 0.08)",
    "--theme-hero-mask":
      "linear-gradient(135deg, rgba(16, 37, 66, 0.24), rgba(16, 37, 66, 0.58)), linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(0, 0, 0, 0.16))",
    "--theme-hero-panel-bg": "rgba(9, 25, 48, 0.28)",
    "--theme-hero-panel-border": "rgba(255, 255, 255, 0.16)",
    "--theme-hero-panel-shadow": "0 24px 60px rgba(8, 24, 46, 0.2)",
    "--theme-soft-fill": "rgba(77, 129, 239, 0.06)",
    "--theme-soft-fill-strong": "rgba(77, 129, 239, 0.1)",
    "--theme-code-bg": "#13263b",
    "--theme-code-text": "#edf4ff",
    "--theme-reading-text": "#334155",
    "--radius-lg": "30px",
    "--radius-md": "22px",
    "--radius-sm": "18px",
    "--nav-width": "1500px",
    "--content-width": "1520px",
    "--page-width": "1240px",
    "--reading-width": "1500px",
    "--font-sans": '"Avenir Next", "Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif',
    "--font-display": '"Iowan Old Style", "Palatino Linotype", "Noto Serif SC", "Source Han Serif SC", serif'
  }
};

export const classicTemplate: TemplateDefinition = {
  id: "classic",
  ...classicPreset,
  component: Home
};
