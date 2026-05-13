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
  { key: "tu", label: "TU" },
  { key: "energy", label: "Energy" },
  { key: "mana", label: "Mana" },
];

export const useUiStore = defineStore('ui', () => {
  const activeTab = ref<AppTab>("compare");
  const hoveredArmor = ref<number | null>(40);
  const rollHoverPercentile = ref<number | null>(null);
  const heatmapHover = ref<{ armor: number; power: number } | null>(null);
  const heatmapMetric = ref<HeatmapMetric>("hp");

  function handleRollPointer(event: PointerEvent, plotLeft: number, plotWidth: number): void {
    const svg = event.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    const x = Math.min(plotWidth, Math.max(0, event.clientX - rect.left - plotLeft));
    rollHoverPercentile.value = (x / plotWidth) * 100;
  }

  function clearRollPointer(): void {
    rollHoverPercentile.value = null;
  }

  function handleHeatmapPointer(event: PointerEvent, plotLeft: number, plotTop: number, plotWidth: number, plotHeight: number): void {
    const svg = event.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    const x = Math.min(plotWidth, Math.max(0, event.clientX - rect.left - plotLeft));
    const y = Math.min(plotHeight, Math.max(0, event.clientY - rect.top - plotTop));
    heatmapHover.value = {
      power: Math.round((x / plotWidth) * 150),
      armor: Math.round(100 - (y / plotHeight) * 100),
    };
  }

  function clearHeatmapPointer(): void {
    heatmapHover.value = null;
  }

  return {
    activeTab,
    hoveredArmor,
    rollHoverPercentile,
    heatmapHover,
    heatmapMetric,
    handleRollPointer,
    clearRollPointer,
    handleHeatmapPointer,
    clearHeatmapPointer,
  };
});
