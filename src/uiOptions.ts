import type { DamageMetricKey } from "./types";

export type AppTab = "compare" | "damage-types" | "weapons";
export type HeatmapMetric = Exclude<DamageMetricKey, "panicChance" | "scaledMorale">;

export const heatmapMetrics: Array<{ key: HeatmapMetric; label: string }> = [
  { key: "hp", label: "HP" },
  { key: "stun", label: "Stun" },
  { key: "hp-stun", label: "HP + Stun" },
  { key: "morale", label: "Morale" },
  { key: "armor", label: "Armor" },
  { key: "preArmor", label: "Pre Armor" },
  { key: "tu", label: "TU" },
  { key: "energy", label: "Energy" },
  { key: "mana", label: "Mana" },
];
