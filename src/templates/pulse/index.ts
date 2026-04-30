import type { TemplateDefinition, TemplateThemePreset } from "../types";
import Home from "./Home.astro";

export const pulsePreset: TemplateThemePreset = {
  title: "Pulse",
  description: "用封面故事、速览和列表把首页节奏做得更强一点。",
  preview: "封面故事 + 速览栅格 + 编辑流",
  aesthetic: "焦点首页 / 强节奏 / 个人编辑品牌感",
  homeTemplate: "focus",
  cardStyle: "compact",
  sidebarStyle: "stacked",
  vars: {
    "--theme-color": "#d06c45",
    "--theme-color-deep": "#8c402a",
    "--theme-accent": "#20252d",
    "--theme-text": "#20252d",
    "--theme-muted": "#66707a",
    "--theme-line": "rgba(45, 54, 67, 0.14)",
    "--theme-bg": "#f4efe9",
    "--theme-panel": "rgba(255, 255, 255, 0.96)",
    "--theme-panel-solid": "#ffffff",
    "--theme-panel-soft": "rgba(250, 244, 239, 0.9)",
    "--theme-shadow": "0 14px 36px rgba(31, 38, 48, 0.08)",
    "--theme-shadow-strong": "0 24px 58px rgba(31, 38, 48, 0.14)",
    "--theme-bg-image":
      "radial-gradient(circle at top left, rgba(208, 108, 69, 0.12), transparent 22%), radial-gradient(circle at right 18%, rgba(31, 37, 45, 0.08), transparent 20%), linear-gradient(180deg, #fbf8f4 0%, #f4ede7 100%)",
    "--theme-nav-bg": "rgba(248, 245, 241, 0.9)",
    "--theme-nav-border": "rgba(45, 54, 67, 0.08)",
    "--theme-hero-mask":
      "linear-gradient(135deg, rgba(25, 31, 40, 0.22), rgba(25, 31, 40, 0.38)), linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(0, 0, 0, 0.14))",
    "--theme-hero-panel-bg": "rgba(26, 32, 41, 0.2)",
    "--theme-hero-panel-border": "rgba(255, 255, 255, 0.16)",
    "--theme-hero-panel-shadow": "0 22px 56px rgba(18, 23, 30, 0.2)",
    "--theme-soft-fill": "rgba(212, 107, 73, 0.07)",
    "--theme-soft-fill-strong": "rgba(212, 107, 73, 0.12)",
    "--theme-code-bg": "#1f2630",
    "--theme-code-text": "#f6f1eb",
    "--theme-reading-text": "#3b434f",
    "--radius-lg": "12px",
    "--radius-md": "8px",
    "--radius-sm": "6px",
    "--nav-width": "1480px",
    "--content-width": "1500px",
    "--page-width": "1260px",
    "--reading-width": "1480px",
    "--font-sans": '"IBM Plex Sans", "PingFang SC", "Microsoft YaHei", sans-serif',
    "--font-display": '"Baskerville", "Times New Roman", "Noto Serif SC", "Source Han Serif SC", serif'
  }
};

export const pulseTemplate: TemplateDefinition = {
  id: "pulse",
  ...pulsePreset,
  component: Home
};
