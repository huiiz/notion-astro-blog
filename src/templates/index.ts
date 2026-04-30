import type { TemplateDefinition, TemplateThemePreset, ThemePresetName } from "./types";
import { classicTemplate } from "./classic";
import { cloverTemplate } from "./clover";
import { essayTemplate } from "./essay";
import { ledgerTemplate } from "./ledger";
import { pulseTemplate } from "./pulse";

const templates = [classicTemplate, ledgerTemplate, essayTemplate, cloverTemplate, pulseTemplate] as const;

export const templateRegistry = Object.fromEntries(templates.map((template) => [template.id, template])) as Record<
  ThemePresetName,
  TemplateDefinition
>;

export const templatePresets = Object.fromEntries(templates.map((template) => [template.id, template])) as Record<
  ThemePresetName,
  TemplateThemePreset
>;

export function getTemplateDefinition(name: ThemePresetName): TemplateDefinition {
  return templateRegistry[name];
}

export function getTemplateDefinitions(): TemplateDefinition[] {
  return [...templates];
}

export function getTemplatePreset(name: ThemePresetName): TemplateThemePreset {
  return templatePresets[name];
}
