import { getTemplatePreset } from "../templates";
import type { CardStyle, HomeTemplate, SidebarStyle, ThemePresetName } from "../templates/types";
import { cardStyles, homeTemplates, sidebarStyles, templateIds } from "../templates/types";
import { notionThemeSettings } from "./notion-config";
export type { CardStyle, HomeTemplate, SidebarStyle, ThemePresetName } from "../templates/types";

const env = import.meta.env;

function readOptionalPublicVar(name: string) {
  const value = env[name];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function readPublicVar(name: string, fallback: string) {
  return readOptionalPublicVar(name) || fallback;
}

function pickEnum<T extends string>(value: string, allowed: readonly T[], fallback: T) {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function resolvePresetAlias(value: string) {
  const normalized = value.trim().toLowerCase();

  const legacyPresetMap: Record<string, ThemePresetName> = {
    horizon: "classic",
    paper: "essay",
    graphite: "ledger"
  };

  return legacyPresetMap[normalized] || normalized;
}

const customVarMap: Record<string, string> = {
  "--theme-color": readOptionalPublicVar("PUBLIC_THEME_COLOR"),
  "--theme-color-deep": readOptionalPublicVar("PUBLIC_THEME_COLOR_DEEP"),
  "--theme-accent": readOptionalPublicVar("PUBLIC_THEME_ACCENT"),
  "--theme-text": readOptionalPublicVar("PUBLIC_THEME_TEXT"),
  "--theme-muted": readOptionalPublicVar("PUBLIC_THEME_MUTED"),
  "--theme-line": readOptionalPublicVar("PUBLIC_THEME_LINE"),
  "--theme-bg": readOptionalPublicVar("PUBLIC_THEME_BG"),
  "--theme-panel": readOptionalPublicVar("PUBLIC_THEME_PANEL"),
  "--theme-panel-solid": readOptionalPublicVar("PUBLIC_THEME_PANEL_SOLID"),
  "--theme-panel-soft": readOptionalPublicVar("PUBLIC_THEME_PANEL_SOFT"),
  "--theme-shadow": readOptionalPublicVar("PUBLIC_THEME_SHADOW"),
  "--theme-shadow-strong": readOptionalPublicVar("PUBLIC_THEME_SHADOW_STRONG"),
  "--theme-bg-image": readOptionalPublicVar("PUBLIC_THEME_BG_IMAGE"),
  "--theme-nav-bg": readOptionalPublicVar("PUBLIC_THEME_NAV_BG"),
  "--theme-nav-border": readOptionalPublicVar("PUBLIC_THEME_NAV_BORDER"),
  "--theme-hero-mask": readOptionalPublicVar("PUBLIC_THEME_HERO_MASK"),
  "--theme-hero-panel-bg": readOptionalPublicVar("PUBLIC_THEME_HERO_PANEL_BG"),
  "--theme-hero-panel-border": readOptionalPublicVar("PUBLIC_THEME_HERO_PANEL_BORDER"),
  "--theme-hero-panel-shadow": readOptionalPublicVar("PUBLIC_THEME_HERO_PANEL_SHADOW"),
  "--theme-soft-fill": readOptionalPublicVar("PUBLIC_THEME_SOFT_FILL"),
  "--theme-soft-fill-strong": readOptionalPublicVar("PUBLIC_THEME_SOFT_FILL_STRONG"),
  "--theme-code-bg": readOptionalPublicVar("PUBLIC_THEME_CODE_BG"),
  "--theme-code-text": readOptionalPublicVar("PUBLIC_THEME_CODE_TEXT"),
  "--theme-reading-text": readOptionalPublicVar("PUBLIC_THEME_READING_TEXT"),
  "--radius-lg": readOptionalPublicVar("PUBLIC_THEME_RADIUS_LG"),
  "--radius-md": readOptionalPublicVar("PUBLIC_THEME_RADIUS_MD"),
  "--radius-sm": readOptionalPublicVar("PUBLIC_THEME_RADIUS_SM"),
  "--nav-width": readOptionalPublicVar("PUBLIC_THEME_NAV_WIDTH"),
  "--content-width": readOptionalPublicVar("PUBLIC_THEME_CONTENT_WIDTH"),
  "--page-width": readOptionalPublicVar("PUBLIC_THEME_PAGE_WIDTH"),
  "--reading-width": readOptionalPublicVar("PUBLIC_THEME_READING_WIDTH"),
  "--font-sans": readOptionalPublicVar("PUBLIC_THEME_FONT_SANS"),
  "--font-display": readOptionalPublicVar("PUBLIC_THEME_FONT_DISPLAY")
};

export type ThemeConfig = {
  preset: ThemePresetName;
  homeTemplate: HomeTemplate;
  cardStyle: CardStyle;
  sidebarStyle: SidebarStyle;
  vars: Record<string, string>;
  themeColor: string;
  inlineStyle: string;
};

export function createThemeConfig(
  overrides: Partial<{
    preset: ThemePresetName;
    homeTemplate: HomeTemplate;
    cardStyle: CardStyle;
    sidebarStyle: SidebarStyle;
    vars: Record<string, string>;
  }> = {}
): ThemeConfig {
  const notionVars = Object.fromEntries(
    Object.entries(notionThemeSettings.vars || {}).filter(([, value]) => typeof value === "string" && Boolean(value.trim()))
  );
  const envVars = Object.fromEntries(Object.entries(customVarMap).filter(([, value]) => Boolean(value)));
  const presetName = pickEnum(
    resolvePresetAlias(overrides.preset || notionThemeSettings.preset || readPublicVar("PUBLIC_TEMPLATE_PRESET", "classic")),
    templateIds,
    "classic"
  );

  const preset = getTemplatePreset(presetName);

  const homeTemplate = pickEnum(
    overrides.homeTemplate ||
      notionThemeSettings.homeTemplate ||
      readPublicVar("PUBLIC_HOME_TEMPLATE", preset.homeTemplate),
    homeTemplates,
    preset.homeTemplate
  );

  const cardStyle = pickEnum(
    overrides.cardStyle || notionThemeSettings.cardStyle || readPublicVar("PUBLIC_CARD_STYLE", preset.cardStyle),
    cardStyles,
    preset.cardStyle
  );

  const sidebarStyle = pickEnum(
    overrides.sidebarStyle ||
      notionThemeSettings.sidebarStyle ||
      readPublicVar("PUBLIC_SIDEBAR_STYLE", preset.sidebarStyle),
    sidebarStyles,
    preset.sidebarStyle
  );

  const vars = {
    ...preset.vars,
    ...envVars,
    ...notionVars,
    ...(overrides.vars || {})
  };

  return {
    preset: presetName,
    homeTemplate,
    cardStyle,
    sidebarStyle,
    vars,
    themeColor: vars["--theme-color"],
    inlineStyle: Object.entries(vars)
      .map(([key, value]) => `${key}:${value}`)
      .join(";")
  };
}

export const themeConfig = createThemeConfig();
