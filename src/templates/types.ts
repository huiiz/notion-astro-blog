export const homeTemplates = ["showcase", "journal", "focus"] as const;
export const cardStyles = ["magazine", "compact", "outline"] as const;
export const sidebarStyles = ["stacked", "minimal"] as const;
export const templateIds = ["classic", "ledger", "essay", "clover", "pulse"] as const;

export type HomeTemplate = (typeof homeTemplates)[number];
export type CardStyle = (typeof cardStyles)[number];
export type SidebarStyle = (typeof sidebarStyles)[number];
export type ThemePresetName = (typeof templateIds)[number];

export type TemplateThemePreset = {
  title: string;
  description: string;
  preview: string;
  aesthetic: string;
  homeTemplate: HomeTemplate;
  cardStyle: CardStyle;
  sidebarStyle: SidebarStyle;
  vars: Record<string, string>;
};

export type TemplateDefinition = TemplateThemePreset & {
  id: ThemePresetName;
  component: any;
};
