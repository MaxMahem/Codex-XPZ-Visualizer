<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useAppStore } from "../stores/appStore";
import { useScenarioStore } from "../stores/scenarioStore";
import { useWeaponsStore } from "../stores/weaponsStore";
import { formatDamage, formatPercent } from "../utils/formatters";

const appStore = useAppStore();
const scenarioStore = useScenarioStore();
const weaponsStore = useWeaponsStore();

const {
  currentArmor,
  chartSeries,
  focusedRows,
  targetHpTooltip,
} = storeToRefs(appStore);
const { scenario } = storeToRefs(scenarioStore);
const { selectedWeapons } = storeToRefs(weaponsStore);
</script>

<template>
  <section class="chart-area" aria-label="Damage comparison chart">
    <div class="chart-header">
      <div>
        <h2
          class="has-tip"
          tabindex="0"
          data-tip="Y-axis is damage. X-axis is target armor. Higher curves are better damage output."
        >
          Expected Damage
        </h2>
      </div>
      <div class="target-marker has-tip" tabindex="0" :data-tip="targetHpTooltip">
        <span>Target HP</span>
        <strong>{{ formatDamage(scenario.hitPoints) }}</strong>
      </div>
    </div>

    <div class="chart-legend" aria-label="Chart legend">
      <span class="legend-item has-tip" tabindex="0" :data-tip="targetHpTooltip">
        <i class="legend-line hp"></i>
        Target HP threshold
      </span>
      <span
        class="legend-item has-tip"
        tabindex="0"
        data-tip="The vertical dashed line is the armor value used by the table and colored chart dots."
      >
        <i class="legend-line inspect"></i>
        Inspected armor
      </span>
    </div>

    <div class="chart-frame">
      <svg viewBox="0 0 840 420" role="img" aria-label="Expected damage by armor level">
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
            :y1="appStore.scaleY(scenario.hitPoints)"
            :y2="appStore.scaleY(scenario.hitPoints)"
          >
            <title>{{ targetHpTooltip }}</title>
          </line>
          <line
            class="inspect-line"
            :x1="appStore.scaleX(currentArmor)"
            :x2="appStore.scaleX(currentArmor)"
            y1="0"
            y2="320"
          >
            <title>Inspected armor: {{ currentArmor }}</title>
          </line>
          <path
            v-for="series in chartSeries"
            :key="series.weapon.id"
            class="damage-line"
            :d="appStore.pathFor(series.points)"
            :stroke="series.weapon.color"
          >
            <title>{{ appStore.weaponTooltip(series.weapon) }}</title>
          </path>
          <circle
            v-for="weapon in selectedWeapons"
            :key="`${weapon.id}-dot`"
            r="4"
            :cx="appStore.scaleX(currentArmor)"
            :cy="appStore.scaleY(Math.round(appStore.weaponAtArmor(weapon, currentArmor).expected))"
            :fill="weapon.color"
          >
            <title>
              {{ weapon.name }} at armor {{ currentArmor }}:
              {{ formatDamage(appStore.weaponAtArmor(weapon, currentArmor).expected) }} expected damage
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
            {{ appStore.yLabel(index - 1) }}
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
            {{ appStore.xLabel(index - 1) }}
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

    <div class="results-table">
      <div class="table-row table-head">
        <span class="has-tip" tabindex="0" data-tip="Selected weapon or ammo system.">Weapon</span>
        <span class="has-tip" tabindex="0" data-tip="Base power plus stat bonuses before roll and damage factor.">Power</span>
        <span class="has-tip" tabindex="0" data-tip="Armor after armor effectiveness and weapon armor penetration.">Armor</span>
        <span class="has-tip" tabindex="0" data-tip="Expected HP damage after all primary roll outcomes, armor, HP component percent, and any HP component RNG.">Expected HP</span>
        <span class="has-tip" tabindex="0" data-tip="Expected stun damage after all primary roll outcomes, armor, stun component percent, and any stun component RNG.">Expected Stun</span>
        <span class="has-tip" tabindex="0" data-tip="Chance HP damage alone reaches or exceeds target HP at the inspected armor value.">Kill</span>
      </div>
      <div v-for="row in focusedRows" :key="row.weapon.id" class="table-row">
        <span class="weapon-name has-tip" tabindex="0" :data-tip="appStore.weaponTooltip(row.weapon)">
          <i :style="{ backgroundColor: row.weapon.color }"></i>
          {{ row.weapon.name }}
        </span>
        <span
          class="has-tip"
          tabindex="0"
          data-tip="Modified power before random roll and damage factor."
        >
          {{ formatDamage(row.modifiedPower) }}
        </span>
        <span
          class="has-tip"
          tabindex="0"
          data-tip="Armor value remaining after armor effectiveness and weapon armor penetration."
        >
          {{ formatDamage(row.effectiveArmor) }}
        </span>
        <span
          class="has-tip"
          tabindex="0"
          data-tip="Expected HP damage after integrating all possible rolls."
        >
          {{ formatDamage(row.point.expected) }}
        </span>
        <span
          class="has-tip"
          tabindex="0"
          data-tip="Expected stun damage after integrating all possible rolls."
        >
          {{ formatDamage(row.expectedStun) }}
        </span>
        <span
          class="has-tip"
          tabindex="0"
          data-tip="Probability that one hit deals at least the target's HP."
        >
          {{ formatPercent(row.point.killChance) }}
        </span>
      </div>
    </div>
  </section>
</template>
