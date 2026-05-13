<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useAppStore } from "../stores/appStore";
import { useScenarioStore } from "../stores/scenarioStore";
import { useWeaponsStore } from "../stores/weaponsStore";
import { useUiStore } from "../stores/uiStore";
import { formatDamage, formatPercent, subtleColor } from "../utils/formatters";

defineProps<{
  embedded?: boolean;
}>();

const appStore = useAppStore();
const scenarioStore = useScenarioStore();
const weaponsStore = useWeaponsStore();
const uiStore = useUiStore();

const {
  currentArmor,
  rollStats,
  componentCurve,
  inspectedCurvePoint,
} = storeToRefs(appStore);
const { scenario } = storeToRefs(scenarioStore);
const { editableWeapons, selectedWeaponId, rollWeapon } = storeToRefs(weaponsStore);
</script>

<template>
  <section class="chart-area roll-area" aria-label="Roll result chart">
    <div class="distribution-header">
      <div>
        <h2
          class="has-tip"
          tabindex="0"
          data-tip="X-axis is cumulative chance percentile. Y-axis is final damage after factor, armor, and the zero floor."
        >
          Expected Damage
        </h2>
        <p>
          {{ rollWeapon.name }} vs armor {{ currentArmor }}
        </p>
      </div>
      <label
        v-if="!embedded"
        class="distribution-picker has-tip"
        data-tip="Choose the single weapon or ammo system shown in the roll-result chart."
      >
        Weapon
        <select
          v-model="selectedWeaponId"
          @change="weaponsStore.selectWeapon(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="weapon in editableWeapons" :key="weapon.id" :value="weapon.id">
            {{ weapon.name }}
          </option>
        </select>
      </label>
    </div>

    <div class="distribution-stats">
      <span
        class="has-tip"
        tabindex="0"
        data-tip="Chance that armor fully absorbs the damage after the roll."
      >
        No Damage: <strong>{{ formatPercent(rollStats.zeroChance) }}</strong>
      </span>
      <span
        class="has-tip"
        tabindex="0"
        data-tip="Chance that one hit reaches or exceeds target HP."
      >
        Kill: <strong>{{ formatPercent(rollStats.killChance) }}</strong>
      </span>
      <span
        class="has-tip"
        tabindex="0"
        data-tip="Chance HP damage plus stun damage exceeds target HP."
      >
        KO: <strong>{{ formatPercent(rollStats.koChance) }}</strong>
      </span>
    </div>

    <div class="chart-legend" aria-label="Roll chart legend">
      <span
        class="legend-item has-tip"
        tabindex="0"
        data-tip="The solid weapon-colored line shows final damage by cumulative chance percentile."
      >
        <i class="legend-swatch hp-area" :style="{ backgroundColor: rollWeapon.color }"></i>
        HP damage
      </span>
      <span
        class="legend-item has-tip"
        tabindex="0"
        data-tip="The upper stacked area shows average integer stun damage added on top of HP for the same primary damage percentile."
      >
        <i class="legend-swatch stun-area"></i>
        Stun damage
      </span>
    </div>

    <div class="chart-frame roll-frame">
        <svg
          viewBox="0 0 840 330"
          role="img"
          aria-label="Final damage by cumulative percentile"
          @pointermove="(e) => uiStore.handleRollPointer(e, (58 / 840) * (e.currentTarget as any).getBoundingClientRect().width, (760 / 840) * (e.currentTarget as any).getBoundingClientRect().width)"
          @pointerleave="uiStore.clearRollPointer"
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
            :y1="appStore.rollY(scenario.hitPoints)"
            :y2="appStore.rollY(scenario.hitPoints)"
          >
            <title>Target HP threshold: {{ scenario.hitPoints }} damage</title>
          </line>
          <path
            class="component-area hp-area-fill"
            :fill="subtleColor(rollWeapon.color)"
            :d="appStore.componentAreaPath(componentCurve, () => 0, (result) => result.hpDamage)"
          >
            <title>{{ rollWeapon.name }} HP damage by cumulative percentile</title>
          </path>
          <path
            class="component-area stun-area-fill"
            :d="
              appStore.componentAreaPath(
                componentCurve,
                (result) => result.hpDamage,
                (result) => result.totalDamage,
              )
            "
          >
            <title>{{ rollWeapon.name }} stun damage stacked above HP damage</title>
          </path>
          <path
            class="damage-line hp-boundary-line"
            :stroke="rollWeapon.color"
            :d="
              appStore.rollPath(
                componentCurve.map((result) => ({
                  ...result,
                  totalDamage: result.hpDamage,
                })),
              )
            "
          >
            <title>{{ rollWeapon.name }} HP damage boundary</title>
          </path>
          <path
            class="damage-line stun-boundary-line"
            :d="appStore.rollPath(componentCurve)"
          >
            <title>{{ rollWeapon.name }} total stacked damage by cumulative percentile</title>
          </path>
          <line
            v-if="inspectedCurvePoint"
            class="hover-line"
            :x1="appStore.rollX(inspectedCurvePoint.percentile)"
            :x2="appStore.rollX(inspectedCurvePoint.percentile)"
            y1="0"
            y2="260"
          />
          <circle
            v-if="inspectedCurvePoint"
            class="hp-inspect-dot"
            r="4"
            :cx="appStore.rollX(inspectedCurvePoint.percentile)"
            :cy="appStore.rollY(inspectedCurvePoint.hpDamage)"
            :fill="rollWeapon.color"
          >
            <title>{{ appStore.percentileTooltip(inspectedCurvePoint) }}</title>
          </circle>
          <circle
            v-if="inspectedCurvePoint"
            class="stun-inspect-dot"
            r="4"
            :cx="appStore.rollX(inspectedCurvePoint.percentile)"
            :cy="appStore.rollY(inspectedCurvePoint.totalDamage)"
          >
            <title>{{ appStore.percentileTooltip(inspectedCurvePoint) }}</title>
          </circle>
          <g
            v-if="inspectedCurvePoint"
            class="chart-tooltip"
            :transform="`translate(${appStore.inspectorLabelX(inspectedCurvePoint)} ${appStore.inspectorLabelY(inspectedCurvePoint)})`"
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
            {{ appStore.rollYLabel(index - 1) }}
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
            {{ appStore.rollXLabel(index - 1) }}
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
  </section>
</template>
