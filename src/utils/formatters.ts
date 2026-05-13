export function formatDamage(value: number): string {
  return `${Math.round(value)}`;
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function percentField(value: number): number {
  return Math.round(value * 100);
}

export function subtleColor(color: string): string {
  return `color-mix(in srgb, ${color} 13%, white)`;
}
