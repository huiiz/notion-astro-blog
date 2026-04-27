const BASE_URL = import.meta.env.BASE_URL || "/";

export function withBasePath(value: string): string {
  if (!value) return value;
  if (/^(?:[a-z]+:)?\/\//i.test(value) || value.startsWith("data:") || value.startsWith("mailto:") || value.startsWith("#")) {
    return value;
  }

  const normalizedBase = BASE_URL.endsWith("/") ? BASE_URL : `${BASE_URL}/`;
  const trimmedBase = normalizedBase === "/" ? "" : normalizedBase.replace(/\/$/, "");

  if (trimmedBase && value.startsWith(trimmedBase + "/")) {
    return value;
  }

  if (value.startsWith("/")) {
    return `${trimmedBase}${value}` || value;
  }

  return `${normalizedBase}${value}`.replace(/(?<!:)\/{2,}/g, "/");
}

export function prefixHtmlAssetPaths(html: string): string {
  return html
    .replace(
      /((?:src|href|poster)=["'])(\/(?:img|data|survey-assets)\/[^"']*|\/mllm-survey-cn\.html(?:[^"']*)?)(["'])/gi,
      (_match, prefix, assetPath, suffix) => `${prefix}${withBasePath(assetPath)}${suffix}`
    )
    .replace(
      /(url\(["']?)(\/(?:img|data|survey-assets)\/[^)"']*|\/mllm-survey-cn\.html(?:[^)"']*)?)(["']?\))/gi,
      (_match, prefix, assetPath, suffix) => `${prefix}${withBasePath(assetPath)}${suffix}`
    );
}
