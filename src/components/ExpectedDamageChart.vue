<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useVsArmorModel } from "../composables/useVsArmorModel";
import { useDamageTypesStore } from "../stores/damageTypesStore";
import { useScenarioStore } from "../stores/scenarioStore";
import { useWeaponsStore } from "../stores/weaponsStore";
import { useUiStore } from "../stores/uiStore";
import { formatDamage } from "../utils/formatters";
import { weaponTooltip } from "../utils/tooltips";
import type { DamagePoint, WeaponSystem } from "../types";

const damageTypesStore = useDamageTypesStore();
const scenarioStore = useScenarioStore();
const weaponsStore = useWeaponsStore();
const uiStore = useUiStore();
const { chartSeries, maxExpectedDamage, weaponAtArmor } = useVsArmorModel();

const { hoveredArmor } = storeToRefs(uiStore);
const { selectedWeapons } = storeToRefs(weaponsStore);
const { editableDamageTypes } = storeToRefs(damageTypesStore);
const { scenario } = storeToRefs(scenarioStore);

const props = defineProps<{
  targetHp: number;
  targetHpTooltip: string;
}>();

function scaleX(armor: number): number {
  const width = 760;
  const min = 0;
  const max = 100;
  return ((armor - min) / (max - min)) * width;
}

function scaleY(damage: number): number {
  const height = 320;
  return height - (damage / maxExpectedDamage.value) * height;
}

function pathFor(points: DamagePoint[]): string {
  if (points.length === 0) return "";
  return points
    .map((point, index) => {
      const x = scaleX(point.armor);
      const y = scaleY(Math.round(point.expected));
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function xLabel(index: number): number {
  const ticks = 5;
  return Math.round((100 * index) / (ticks - 1));
}

function yLabel(index: number): number {
  const ticks = 5;
  return Math.round((maxExpectedDamage.value * (ticks - 1 - index)) / (ticks - 1));
}

function handlePointer(event: PointerEvent): void {
  const svg = event.currentTarget as SVGSVGElement;
  const rect = svg.getBoundingClientRect();
  const plotLeft = (58 / 840) * rect.width;
  const plotWidth = (760 / 840) * rect.width;
  const x = Math.min(plotWidth, Math.max(0, event.clientX - rect.left - plotLeft));
  hoveredArmor.value = (x / plotWidth) * 100;
}
</script>

<template>
  <div class="chart-frame">
    <svg 
      viewBox="0 0 840 420" 
      role="img" 
      aria-label="Expected damage by armor level"
      @pointermove="handlePointer"
    >
      <g transform="translate(58 22)">
        <line
          v-for="index in 5"
          :key="`y-${index}`"
          class="grid-line"
          x1="0"
          x2="760"
          :y1="((index - 1) / 4) * 320"
          :y2="((index - 1) / 4) * 320"
        >
          <title>Damage grid line</title>
        </line>
        <line
          v-for="index in 5"
          :key="`x-${index}`"
          class="grid-line"
          :x1="((index - 1) / 4) * 760"
          :x2="((index - 1) / 4) * 760"
          y1="0"
          y2="320"
        >
          <title>Armor grid line</title>
        </line>
        <line
          class="hp-line"
          x1="0"
          x2="760"
          :y1="scaleY(props.targetHp)"
          :y2="scaleY(props.targetHp)"
        >
          <title>{{ props.targetHpTooltip }}</title>
        </line>
        <line
          class="inspect-line"
          :x1="scaleX(hoveredArmor ?? 0)"
          :x2="scaleX(hoveredArmor ?? 0)"
          y1="0"
          y2="320"
        >
          <title>Inspected armor: {{ Math.round(hoveredArmor ?? 0) }}</title>
        </line>
        <path
          v-for="series in chartSeries"
          :key="series.weapon.id"
          class="damage-line"
          :d="pathFor(series.points)"
          :stroke="series.weapon.color"
        >
          <title>{{ weaponTooltip(series.weapon, scenario, editableDamageTypes) }}</title>
        </path>
        <circle
          v-for="weapon in selectedWeapons"
          :key="`${weapon.id}-dot`"
          r="4"
          :cx="scaleX(hoveredArmor ?? 0)"
          :cy="scaleY(Math.round(weaponAtArmor(weapon, hoveredArmor ?? 0).expected))"
          :fill="weapon.color"
        >
          <title>
            {{ weapon.name }} at armor {{ Math.round(hoveredArmor ?? 0) }}:
            {{ formatDamage(weaponAtArmor(weapon, hoveredArmor ?? 0).expected) }} expected damage
          </title>
        </circle>
        <text
          v-for="index in 5"
          :key="`yl-${index}`"
          class="axis-label"
          x="-12"
          text-anchor="end"
          :y="((index - 1) / 4) * 320 + 4"
        >
          {{ yLabel(index - 1) }}
          <title>Expected damage value</title>
        </text>
        <text
          v-for="index in 5"
          :key="`xl-${index}`"
          class="axis-label"
          :x="((index - 1) / 4) * 760"
          y="350"
          text-anchor="middle"
        >
          {{ xLabel(index - 1) }}
          <title>Armor value</title>
        </text>
        <text class="axis-title" x="380" y="386" text-anchor="middle">
          Armor
        </text>
        <text
          class="axis-title"
          x="-44"
          y="160"
          text-anchor="middle"
          transform="rotate(-90 -44 160)"
        >
          Expected HP damage
        </text>
      </g>
    </svg>
  </div>
</template>
