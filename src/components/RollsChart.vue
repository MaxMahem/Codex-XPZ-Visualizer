<script setup lang="ts">
import { computed, ref, toRef } from "vue";
import { useRollDamageModel } from "../composables/useRollDamageModel";
import { useScenarioStore } from "../stores/scenarioStore";
import { formatDamage } from "../utils/formatters";
import { percentileTooltip } from "../utils/tooltips";
import type { DamageComponentCurvePoint, DamageMetricKey } from "../types";

const props = defineProps<{
  focusedWeaponId: string;
  shotCount: number;
  targetHp: number;
  visibleRollComponents: DamageMetricKey[];
}>();
const rollHoverPercentile = ref<number | null>(null);
const focusedWeaponIdRef = toRef(props, "focusedWeaponId");
const shotCountRef = toRef(props, "shotCount");
const scenarioStore = useScenarioStore();

// Compute the union of visible components plus hp-stun (if hp or stun is visible)
const allMetrics = computed(() => {
  const list = [...props.visibleRollComponents];
  if (list.includes("hp") || list.includes("stun")) {
    if (!list.includes("hp-stun")) {
      list.push("hp-stun");
    }
  }
  return list;
});

// Instantiate individual models for each possible metric key
const hpModel = useRollDamageModel(focusedWeaponIdRef, ref("hp"), allMetrics, rollHoverPercentile, shotCountRef);
const stunModel = useRollDamageModel(focusedWeaponIdRef, ref("stun"), allMetrics, rollHoverPercentile, shotCountRef);
const hpStunModel = useRollDamageModel(focusedWeaponIdRef, ref("hp-stun"), allMetrics, rollHoverPercentile, shotCountRef);
const moraleModel = useRollDamageModel(focusedWeaponIdRef, ref("morale"), allMetrics, rollHoverPercentile, shotCountRef);
const panicChanceModel = useRollDamageModel(focusedWeaponIdRef, ref("panicChance"), allMetrics, rollHoverPercentile, shotCountRef);
const armorModel = useRollDamageModel(focusedWeaponIdRef, ref("armor"), allMetrics, rollHoverPercentile, shotCountRef);
const tuModel = useRollDamageModel(focusedWeaponIdRef, ref("tu"), allMetrics, rollHoverPercentile, shotCountRef);
const energyModel = useRollDamageModel(focusedWeaponIdRef, ref("energy"), allMetrics, rollHoverPercentile, shotCountRef);
const manaModel = useRollDamageModel(focusedWeaponIdRef, ref("mana"), allMetrics, rollHoverPercentile, shotCountRef);

const models = {
  hp: hpModel,
  stun: stunModel,
  "hp-stun": hpStunModel,
  morale: moraleModel,
  panicChance: panicChanceModel,
  armor: armorModel,
  tu: tuModel,
  energy: energyModel,
  mana: manaModel,
};

const rollWeapon = hpModel.rollWeapon;

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
      const y = rollY(result.value);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function componentLinePath(component: "morale" | "armor" | "tu" | "energy" | "mana"): string {
  const model = models[component];
  return rollPath(model.componentCurve.value);
}

function panicLinePath(results: DamageComponentCurvePoint[]): string {
  return results
    .map((result, index) => {
      const x = rollX(result.percentile);
      const y = panicY(result.value);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function componentVisible(component: DamageMetricKey): boolean {
  return props.visibleRollComponents.includes(component);
}

type HoverPoint = { percentile: number; rollPercent: number; rolledPower: number; values: Record<DamageMetricKey, number> };

function stackedDamage(point: HoverPoint | { values: Record<DamageMetricKey, number> }): number {
  return (componentVisible("hp") ? (point.values.hp ?? 0) : 0) + (componentVisible("stun") ? (point.values.stun ?? 0) : 0);
}

function hoverTopDamage(point: HoverPoint | { values: Record<DamageMetricKey, number> }): number {
  const visibleDamages = props.visibleRollComponents.map((component) => {
    if (component === "hp" || component === "stun") {
      return stackedDamage(point);
    }
    if (component === "morale" || component === "scaledMorale") {
      return point.values.scaledMorale ?? point.values.morale ?? 0;
    }
    return point.values[component] ?? 0;
  });
  return Math.max(...visibleDamages, 0);
}

const inspectedCurvePoint = computed(() => {
  const firstMetric = props.visibleRollComponents[0];
  if (!firstMetric) return null;
  
  const metricKey = (firstMetric === "hp-stun"
    ? "hp-stun"
    : (firstMetric === "scaledMorale"
      ? "morale"
      : (firstMetric === "preArmor"
        ? "armor"
        : firstMetric))) as keyof typeof models;
  
  const model = models[metricKey];
  if (!model) return null;

  const index = model.inspectedCurveIndex.value;
  if (index === null) return null;
  const basePoint = model.componentCurve.value[index];
  if (!basePoint) return null;

  const values = {} as Record<DamageMetricKey, number>;
  values.hp = hpModel.componentCurve.value[index]?.value ?? 0;
  values.stun = stunModel.componentCurve.value[index]?.value ?? 0;
  values["hp-stun"] = hpStunModel.componentCurve.value[index]?.value ?? 0;
  values.morale = moraleModel.componentCurve.value[index]?.value ?? 0;
  values.panicChance = panicChanceModel.componentCurve.value[index]?.value ?? 0;
  values.armor = armorModel.componentCurve.value[index]?.value ?? 0;
  values.preArmor = 0;
  values.tu = tuModel.componentCurve.value[index]?.value ?? 0;
  values.energy = energyModel.componentCurve.value[index]?.value ?? 0;
  values.mana = manaModel.componentCurve.value[index]?.value ?? 0;
  values.scaledMorale = Math.trunc(((110 - scenarioStore.scenario.targetBravery) * values.morale) / 100);

  return {
    percentile: basePoint.percentile,
    rollPercent: basePoint.rollPercent,
    rolledPower: basePoint.rolledPower,
    values,
  };
});

function tooltipRows(point: HoverPoint): string[] {
  const rows = [
    `${Math.round(point.percentile)}% | Roll ${formatDamage(point.rolledPower)} power (${Math.round(point.rollPercent)}%)`,
  ];
  if (componentVisible("hp") || componentVisible("stun")) {
    rows.push(`HP + Stun ${formatDamage(stackedDamage(point))}`);
  }
  for (const component of props.visibleRollComponents) {
    if (component === "morale") {
      const raw = point.values.morale ?? 0;
      const scaled = point.values.scaledMorale ?? point.values.morale ?? 0;
      rows.push(`Morale ${formatDamage(scaled)} (${formatDamage(raw)} raw)`);
    } else if (component === "panicChance") {
      rows.push(`Panic Chance ${formatDamage(point.values.panicChance ?? 0)}%`);
    } else {
      rows.push(`${componentLabel(component)} ${formatDamage(point.values[component] ?? 0)}`);
    }
  }
  return rows;
}

function tooltipHeight(point: HoverPoint): number {
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
  lower: (result: DamageComponentCurvePoint, index: number) => number,
  upper: (result: DamageComponentCurvePoint, index: number) => number,
): string {
  if (results.length === 0) return "";
  const top = results
    .map((result, index) => {
      const x = rollX(result.percentile);
      const y = rollY(upper(result, index));
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
  const bottom = [...results]
    .reverse()
    .map((result, revIndex) => {
      const index = results.length - 1 - revIndex;
      const x = rollX(result.percentile);
      const y = rollY(lower(result, index));
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

const extraComponents: Array<"morale" | "armor" | "tu" | "energy" | "mana"> = [
  "morale",
  "armor",
  "tu",
  "energy",
  "mana",
];

function inspectorLabelX(point: { percentile: number }): number {
  return Math.min(610, Math.max(8, rollX(point.percentile) + 10));
}

function inspectorLabelY(point: HoverPoint): number {
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

const rollStats = computed(() => {
  const curvesToScan: DamageComponentCurvePoint[][] = [];
  if (componentVisible("hp") || componentVisible("stun") || componentVisible("hp-stun")) {
    curvesToScan.push(hpStunModel.componentCurve.value);
  }
  for (const component of extraComponents) {
    if (componentVisible(component)) {
      curvesToScan.push(models[component].componentCurve.value);
    }
  }

  const damages = curvesToScan.flatMap((curve) => curve.map((point) => point.value));
  const minDamage = Math.min(...damages, 0);
  const maxDamage = Math.max(...damages, props.targetHp, 10);

  return {
    minDamage,
    maxDamage,
    effectivePanicChance: panicChanceModel.rollStats.value.effectivePanicChance,
    zeroChance: hpModel.rollStats.value.zeroChance,
    killChance: hpModel.rollStats.value.killChance,
    koChance: hpModel.rollStats.value.koChance,
    outcomeCount: hpModel.rollStats.value.outcomeCount,
  };
});
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
          :d="componentAreaPath(hpModel.componentCurve.value, () => 0, (result) => result.value)"
        >
          <title>{{ rollWeapon.name }} HP damage by cumulative percentile</title>
        </path>
        <path
          v-if="componentVisible('stun')"
          class="component-area stun-area-fill"
          :d="componentAreaPath(
            stunModel.componentCurve.value,
            (result, index) => componentVisible('hp') ? hpModel.componentCurve.value[index].value : 0,
            (result, index) => (componentVisible('hp') ? hpModel.componentCurve.value[index].value : 0) + result.value,
          )"
        >
          <title>{{ rollWeapon.name }} stun damage stacked above HP damage</title>
        </path>
        <path
          v-if="componentVisible('hp')"
          class="damage-line hp-boundary-line"
          :stroke="rollWeapon.color"
          :d="rollPath(hpModel.componentCurve.value)"
        >
          <title>{{ rollWeapon.name }} HP damage boundary</title>
        </path>
        <path
          v-if="componentVisible('stun')"
          class="damage-line stun-boundary-line"
          :d="rollPath(stunModel.componentCurve.value.map((result, index) => ({
            ...result,
            value: (componentVisible('hp') ? hpModel.componentCurve.value[index].value : 0) + result.value,
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
          :d="panicLinePath(panicChanceModel.componentCurve.value)"
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
          :cy="rollY(inspectedCurvePoint.values.hp ?? 0)"
          :fill="rollWeapon.color"
        >
          <title>{{ percentileTooltip(inspectedCurvePoint, inspectedCurvePoint.values, visibleRollComponents) }}</title>
        </circle>
        <circle
          v-if="inspectedCurvePoint && componentVisible('stun')"
          class="stun-inspect-dot"
          r="4"
          :cx="rollX(inspectedCurvePoint.percentile)"
          :cy="rollY(stackedDamage(inspectedCurvePoint))"
        >
          <title>{{ percentileTooltip(inspectedCurvePoint, inspectedCurvePoint.values, visibleRollComponents) }}</title>
        </circle>
        <circle
          v-for="component in inspectedCurvePoint ? extraComponents.filter(componentVisible) : []"
          :key="`inspect-${component}`"
          class="component-inspect-dot"
          :class="`${component}-inspect-dot`"
          r="4"
          :cx="rollX(inspectedCurvePoint!.percentile)"
          :cy="rollY(inspectedCurvePoint!.values[component] ?? 0)"
        >
          <title>{{ percentileTooltip(inspectedCurvePoint!, inspectedCurvePoint!.values, visibleRollComponents) }}</title>
        </circle>
        <circle
          v-if="inspectedCurvePoint && componentVisible('panicChance')"
          class="component-inspect-dot panicChance-inspect-dot"
          r="4"
          :cx="rollX(inspectedCurvePoint.percentile)"
          :cy="panicY(inspectedCurvePoint.values.panicChance ?? 0)"
        >
          <title>{{ percentileTooltip(inspectedCurvePoint, inspectedCurvePoint.values, visibleRollComponents) }}</title>
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
