export const DEFAULT_USAGE_CHART_VIEW = 'spending-bar' as const;

export function usageModelColor(model: string): string {
  let hash = 0;
  for (const char of model) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const hue = hash % 360;
  const lightness = 70 + ((hash >>> 8) % 10);
  return `hsl(${hue} 65% ${lightness}%)`;
}

export const usageModelLabel = (model: string) => model || 'Неизвестная модель';
