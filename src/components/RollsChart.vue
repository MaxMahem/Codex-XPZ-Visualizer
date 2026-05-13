<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useRollDamageModel } from "../composables/useRollDamageModel";
import { useWeaponsStore } from "../stores/weaponsStore";
import { useUiStore } from "../stores/uiStore";
import { formatDamage } from "../utils/formatters";
import { percentileTooltip } from "../utils/tooltips";
import type { DamageComponentCurvePoint } from "../types";

const weaponsStore = useWeaponsStore();
const uiStore = useUiStore();
const { rollStats, componentCurve, inspectedCurvePoint } = useRollDamageModel();

const { rollWeapon } = storeToRefs(weaponsStore);
const { rollHoverPercentile } = storeToRefs(uiStore);

const props = defineProps<{
  targetHp: number;
}>();

function rollX(percentile: number): number {
  const width = 760;
  return (percentile / 100) * width;
}

function rollY(damage: number): number {
  const height = 260;
  return height - (damage / rollStats.value.maxDamage) * height;
}

function rollPath(results: DamageComponentCurvePoint[]): string {
  return results
    .map((result, index) => {
      const x = rollX(result.percentile);
      const y = rollY(result.totalDamage);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function componentAreaPath(
  results: DamageComponentCurvePoint[],
  lower: (result: DamageComponentCurvePoint) => number,
  upper: (result: DamageComponentCurvePoint) => number,
): string {
  if (results.length === 0) return "";
  const top = results
    .map((result, index) => {
      const x = rollX(result.percentile);
      const y = rollY(upper(result));
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
  const bottom = [...results]
    .reverse()
    .map((result) => {
      const x = rollX(result.percentile);
      const y = rollY(lower(result));
      return `L ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
  return `${top} ${bottom} Z`;
}

function rollXLabel(index: number): string {
  const ticks = 5;
  return `${Math.round((100 * index) / (ticks - 1))}%`;
}

function rollYLabel(index: number): number {
  const ticks = 4;
  return Math.round((rollStats.value.maxDamage * (ticks - 1 - index)) / (ticks - 1));
}

function inspectorLabelX(point: DamageComponentCurvePoint): number {
  return Math.min(610, Math.max(8, rollX(point.percentile) + 10));
}

function inspectorLabelY(point: DamageComponentCurvePoint): number {
  return Math.max(10, rollY(point.totalDamage) - 42);
}

function handlePointer(event: PointerEvent): void {
  const svg = event.currentTarget as SVGSVGElement;
  const rect = svg.getBoundingClientRect();
  const plotLeft = (58 / 840) * rect.width;
  const plotWidth = (760 / 840) * rect.width;
  const x = Math.min(plotWidth, Math.max(0, event.clientX - rect.left - plotLeft));
  rollHoverPercentile.value = (x / plotWidth) * 100;
}

function clearPointer(): void {
  rollHoverPercentile.value = null;
}
</script>

<template>
  <div class="chart-frame roll-frame">
    <svg
      viewBox="0 0 840 330"
      role="img"
      aria-label="Final damage by cumulative percentile"
      @pointermove="handlePointer"
      @pointerleave="clearPointer"
    >
      <g transform="translate(58 22)">
        <line
          v-for="index in 4"
          :key="`roll-y-${index}`"
          class="grid-line"
          x1="0"
          x2="760"
          :y1="((index - 1) / 3) * 260"
          :y2="((index - 1) / 3) * 260"
        >
          <title>Damage grid line</title>
        </line>
        <line
          v-for="index in 5"
          :key="`roll-x-${index}`"
          class="grid-line"
          :x1="((index - 1) / 4) * 760"
          :x2="((index - 1) / 4) * 760"
          y1="0"
          y2="260"
        >
          <title>Cumulative chance grid line</title>
        </line>
        <line
          class="hp-line"
          x1="0"
          x2="760"
          :y1="rollY(props.targetHp)"
          :y2="rollY(props.targetHp)"
        >
          <title>Target HP threshold: {{ props.targetHp }} damage</title>
        </line>
        <path
          class="component-area hp-area-fill"
          :fill="`color-mix(in srgb, ${rollWeapon.color} 13%, white)`"
          :d="componentAreaPath(componentCurve, () => 0, (result) => result.hpDamage)"
        >
          <title>{{ rollWeapon.name }} HP damage by cumulative percentile</title>
        </path>
        <path
          class="component-area stun-area-fill"
          :d="componentAreaPath(componentCurve, (result) => result.hpDamage, (result) => result.totalDamage)"
        >
          <title>{{ rollWeapon.name }} stun damage stacked above HP damage</title>
        </path>
        <path
          class="damage-line hp-boundary-line"
          :stroke="rollWeapon.color"
          :d="rollPath(componentCurve.map((result) => ({ ...result, totalDamage: result.hpDamage })))"
        >
          <title>{{ rollWeapon.name }} HP damage boundary</title>
        </path>
        <path class="damage-line stun-boundary-line" :d="rollPath(componentCurve)">
          <title>{{ rollWeapon.name }} total stacked damage by cumulative percentile</title>
        </path>
        <line
          v-if="inspectedCurvePoint"
          class="hover-line"
          :x1="rollX(inspectedCurvePoint.percentile)"
          :x2="rollX(inspectedCurvePoint.percentile)"
          y1="0"
          y2="260"
        />
        <circle
          v-if="inspectedCurvePoint"
          class="hp-inspect-dot"
          r="4"
          :cx="rollX(inspectedCurvePoint.percentile)"
          :cy="rollY(inspectedCurvePoint.hpDamage)"
          :fill="rollWeapon.color"
        >
          <title>{{ percentileTooltip(inspectedCurvePoint) }}</title>
        </circle>
        <circle
          v-if="inspectedCurvePoint"
          class="stun-inspect-dot"
          r="4"
          :cx="rollX(inspectedCurvePoint.percentile)"
          :cy="rollY(inspectedCurvePoint.totalDamage)"
        >
          <title>{{ percentileTooltip(inspectedCurvePoint) }}</title>
        </circle>
        <g
          v-if="inspectedCurvePoint"
          class="chart-tooltip"
          :transform="`translate(${inspectorLabelX(inspectedCurvePoint)} ${inspectorLabelY(inspectedCurvePoint)})`"
        >
          <rect width="142" height="34" rx="6"></rect>
          <text x="9" y="14">
            {{ Math.round(inspectedCurvePoint.percentile) }}% | HP
            {{ formatDamage(inspectedCurvePoint.hpDamage) }}
          </text>
          <text x="9" y="27">
            Stun {{ formatDamage(inspectedCurvePoint.stunDamage) }}
          </text>
        </g>
        <text
          v-for="index in 4"
          :key="`roll-yl-${index}`"
          class="axis-label"
          x="-12"
          text-anchor="end"
          :y="((index - 1) / 3) * 260 + 4"
        >
          {{ rollYLabel(index - 1) }}
          <title>Final damage</title>
        </text>
        <text
          v-for="index in 5"
          :key="`roll-xl-${index}`"
          class="axis-label"
          :x="((index - 1) / 4) * 760"
          y="292"
          text-anchor="middle"
        >
          {{ rollXLabel(index - 1) }}
          <title>Cumulative chance percentile</title>
        </text>
        <text class="axis-title x-axis-title" x="380" y="322" text-anchor="middle">
          Cumulative chance
        </text>
        <text
          class="axis-title y-axis-title"
          x="-42"
          y="130"
          text-anchor="middle"
          transform="rotate(-90 -42 130)"
        >
          Damage
        </text>
      </g>
    </svg>
  </div>
</template>
