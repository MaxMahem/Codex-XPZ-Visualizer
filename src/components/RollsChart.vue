<script setup lang="ts">
import { ref, toRef } from "vue";
import { useRollDamageModel } from "../composables/useRollDamageModel";
import { formatDamage } from "../utils/formatters";
import { percentileTooltip } from "../utils/tooltips";
import type { DamageComponentCurvePoint, DamageMetricKey } from "../types";

const props = defineProps<{
  focusedWeaponId: string;
  targetHp: number;
  visibleRollComponents: DamageMetricKey[];
}>();
const rollHoverPercentile = ref<number | null>(null);
const focusedWeaponIdRef = toRef(props, "focusedWeaponId");
const visibleRollComponentsRef = toRef(props, "visibleRollComponents");
const { rollWeapon, rollStats, componentCurve, inspectedCurvePoint } = useRollDamageModel(
  focusedWeaponIdRef,
  visibleRollComponentsRef,
  rollHoverPercentile,
);

function rollX(percentile: number): number {
  const width = 760;
  return (percentile / 100) * width;
}

function rollY(damage: number): number {
  const height = 260;
  return height - (damage / rollStats.value.maxDamage) * height;
}

function panicY(chance: number): number {
  const height = 260;
  return height - (chance / 100) * height;
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

function componentLinePath(component: Exclude<DamageMetricKey, "hp" | "stun" | "hp-stun">): string {
  return rollPath(componentCurve.value.map((result) => ({
    ...result,
    totalDamage: componentDamage(result, component),
  })));
}

function panicLinePath(results: DamageComponentCurvePoint[]): string {
  return results
    .map((result, index) => {
      const x = rollX(result.percentile);
      const y = panicY(result.panicChance);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function componentDamage(result: DamageComponentCurvePoint, component: DamageMetricKey): number {
  switch (component) {
    case "hp": return result.hpDamage;
    case "stun": return result.stunDamage;
    case "hp-stun": return result.hpDamage + result.stunDamage;
    case "morale": return result.scaledMoraleDamage;
    case "scaledMorale": return result.scaledMoraleDamage;
    case "panicChance": return result.panicChance;
    case "armor": return result.armorDamage + result.preArmorDamage;
    case "preArmor": return result.preArmorDamage;
    case "tu": return result.tuDamage;
    case "energy": return result.energyDamage;
    case "mana": return result.manaDamage;
  }
}

function componentVisible(component: DamageMetricKey): boolean {
  return props.visibleRollComponents.includes(component);
}

function stackedDamage(point: DamageComponentCurvePoint): number {
  return (componentVisible("hp") ? point.hpDamage : 0) + (componentVisible("stun") ? point.stunDamage : 0);
}

function hoverTopDamage(point: DamageComponentCurvePoint): number {
  const visibleDamages = props.visibleRollComponents.map((component) =>
    component === "hp" || component === "stun"
      ? stackedDamage(point)
      : componentDamage(point, component),
  );
  return Math.max(...visibleDamages, 0);
}

function tooltipRows(point: DamageComponentCurvePoint): string[] {
  const rows = [
    `${Math.round(point.percentile)}% | Roll ${formatDamage(point.rolledPower)} power (${Math.round(point.rollPercent)}%)`,
  ];
  if (componentVisible("hp") || componentVisible("stun")) {
    rows.push(`HP + Stun ${formatDamage(stackedDamage(point))}`);
  }
  for (const component of props.visibleRollComponents) {
    if (component === "morale") {
      rows.push(`Morale ${formatDamage(point.scaledMoraleDamage)} (${formatDamage(point.moraleDamage)} raw)`);
    } else if (component === "panicChance") {
      rows.push(`Panic Chance ${formatDamage(point.panicChance)}%`);
    } else {
      rows.push(`${componentLabel(component)} ${formatDamage(componentDamage(point, component))}`);
    }
  }
  return rows;
}

function tooltipHeight(point: DamageComponentCurvePoint): number {
  return tooltipRows(point).length * 13 + 8;
}

function componentLabel(component: DamageMetricKey): string {
  switch (component) {
    case "hp": return "HP";
    case "stun": return "Stun";
    case "hp-stun": return "HP + Stun";
    case "morale": return "Morale";
    case "scaledMorale": return "Morale";
    case "panicChance": return "Panic Chance";
    case "armor": return "Armor";
    case "preArmor": return "Pre Armor";
    case "tu": return "TU";
    case "energy": return "Energy";
    case "mana": return "Mana";
  }
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

const extraComponents: Array<Exclude<DamageMetricKey, "hp" | "stun" | "hp-stun">> = [
  "morale",
  "armor",
  "tu",
  "energy",
  "mana",
];

function inspectorLabelX(point: DamageComponentCurvePoint): number {
  return Math.min(610, Math.max(8, rollX(point.percentile) + 10));
}

function inspectorLabelY(point: DamageComponentCurvePoint): number {
  return Math.max(10, rollY(hoverTopDamage(point)) - tooltipHeight(point) - 8);
}

function panicYLabel(index: number): string {
  const ticks = 4;
  return `${Math.round((100 * (ticks - 1 - index)) / (ticks - 1))}%`;
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
        <line
          v-if="componentVisible('morale')"
          class="morale-threshold-line"
          x1="0"
          x2="760"
          :y1="rollY(100)"
          :y2="rollY(100)"
          stroke="#718096"
          stroke-dasharray="4"
          opacity="0.4"
        >
          <title>Max morale threshold: 100</title>
        </line>
        <path
          v-if="componentVisible('hp')"
          class="component-area hp-area-fill"
          :fill="`color-mix(in srgb, ${rollWeapon.color} 13%, white)`"
          :d="componentAreaPath(componentCurve, () => 0, (result) => result.hpDamage)"
        >
          <title>{{ rollWeapon.name }} HP damage by cumulative percentile</title>
        </path>
        <path
          v-if="componentVisible('stun')"
          class="component-area stun-area-fill"
          :d="componentAreaPath(
            componentCurve,
            (result) => componentVisible('hp') ? result.hpDamage : 0,
            (result) => (componentVisible('hp') ? result.hpDamage : 0) + result.stunDamage,
          )"
        >
          <title>{{ rollWeapon.name }} stun damage stacked above HP damage</title>
        </path>
        <path
          v-if="componentVisible('hp')"
          class="damage-line hp-boundary-line"
          :stroke="rollWeapon.color"
          :d="rollPath(componentCurve.map((result) => ({ ...result, totalDamage: result.hpDamage })))"
        >
          <title>{{ rollWeapon.name }} HP damage boundary</title>
        </path>
        <path
          v-if="componentVisible('stun')"
          class="damage-line stun-boundary-line"
          :d="rollPath(componentCurve.map((result) => ({
            ...result,
            totalDamage: (componentVisible('hp') ? result.hpDamage : 0) + result.stunDamage,
          })))"
        >
          <title>{{ rollWeapon.name }} total stacked damage by cumulative percentile</title>
        </path>
        <path
          v-for="component in extraComponents.filter(componentVisible)"
          :key="component"
          class="damage-line component-line"
          :class="`${component}-component-line`"
          :d="componentLinePath(component)"
        >
          <title>{{ component }} damage by cumulative percentile</title>
        </path>
        <path
          v-if="componentVisible('panicChance')"
          class="damage-line component-line panicChance-component-line"
          :d="panicLinePath(componentCurve)"
        >
          <title>Panic chance by cumulative percentile</title>
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
          v-if="inspectedCurvePoint && componentVisible('hp')"
          class="hp-inspect-dot"
          r="4"
          :cx="rollX(inspectedCurvePoint.percentile)"
          :cy="rollY(inspectedCurvePoint.hpDamage)"
          :fill="rollWeapon.color"
        >
          <title>{{ percentileTooltip(inspectedCurvePoint, visibleRollComponents) }}</title>
        </circle>
        <circle
          v-if="inspectedCurvePoint && componentVisible('stun')"
          class="stun-inspect-dot"
          r="4"
          :cx="rollX(inspectedCurvePoint.percentile)"
          :cy="rollY(stackedDamage(inspectedCurvePoint))"
        >
          <title>{{ percentileTooltip(inspectedCurvePoint, visibleRollComponents) }}</title>
        </circle>
        <circle
          v-for="component in inspectedCurvePoint ? extraComponents.filter(componentVisible) : []"
          :key="`inspect-${component}`"
          class="component-inspect-dot"
          :class="`${component}-inspect-dot`"
          r="4"
          :cx="rollX(inspectedCurvePoint!.percentile)"
          :cy="rollY(componentDamage(inspectedCurvePoint!, component))"
        >
          <title>{{ percentileTooltip(inspectedCurvePoint!, visibleRollComponents) }}</title>
        </circle>
        <circle
          v-if="inspectedCurvePoint && componentVisible('panicChance')"
          class="component-inspect-dot panicChance-inspect-dot"
          r="4"
          :cx="rollX(inspectedCurvePoint.percentile)"
          :cy="panicY(inspectedCurvePoint.panicChance)"
        >
          <title>{{ percentileTooltip(inspectedCurvePoint, visibleRollComponents) }}</title>
        </circle>
        <g
          v-if="inspectedCurvePoint"
          class="chart-tooltip"
          :transform="`translate(${inspectorLabelX(inspectedCurvePoint)} ${inspectorLabelY(inspectedCurvePoint)})`"
        >
          <rect width="156" :height="tooltipHeight(inspectedCurvePoint)" rx="6"></rect>
          <text
            v-for="(row, index) in tooltipRows(inspectedCurvePoint)"
            :key="row"
            x="9"
            :y="14 + index * 13"
          >
            {{ row }}
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
        <text
          v-if="componentVisible('panicChance')"
          v-for="index in 4"
          :key="`panic-yl-${index}`"
          class="axis-label panic-axis-label"
          x="772"
          text-anchor="start"
          :y="((index - 1) / 3) * 260 + 4"
        >
          {{ panicYLabel(index - 1) }}
          <title>Panic chance</title>
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
        <text
          v-if="componentVisible('panicChance')"
          class="axis-title panic-axis-title"
          x="816"
          y="130"
          text-anchor="middle"
          transform="rotate(90 816 130)"
        >
          Panic chance
        </text>
      </g>
    </svg>
  </div>
</template>
