import { defineStore } from "pinia";
import { ref } from "vue";
import type { DamageComponentKey } from "../types";

export type AppTab = "compare" | "damage-types" | "weapons";
export type HeatmapMetric = DamageComponentKey | "hp-stun";

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

export const useUiStore = defineStore('ui', () => {
  const activeTab = ref<AppTab>("compare");
  const rollHoverPercentile = ref<number | null>(null);
  const visibleRollComponents = ref<DamageComponentKey[]>(["hp", "stun"]);
  const heatmapHover = ref<{ armor: number; power: number } | null>(null);
  const heatmapMetric = ref<HeatmapMetric>("hp");

  function toggleRollComponent(component: DamageComponentKey): void {
    if (visibleRollComponents.value.includes(component)) {
      visibleRollComponents.value = visibleRollComponents.value.filter((item) => item !== component);
      return;
    }
    visibleRollComponents.value = [...visibleRollComponents.value, component];
  }

  return {
    activeTab,
    rollHoverPercentile,
    visibleRollComponents,
    heatmapHover,
    heatmapMetric,
    toggleRollComponent,
  };
});
