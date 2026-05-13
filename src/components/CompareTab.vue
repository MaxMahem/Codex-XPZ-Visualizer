<script setup lang="ts">
import { storeToRefs } from "pinia";
import { computed } from "vue";
import { useVsArmorModel } from "../composables/useVsArmorModel";
import { useDamageTypesStore } from "../stores/damageTypesStore";
import { useScenarioStore } from "../stores/scenarioStore";
import ExpectedDamageChart from "./ExpectedDamageChart.vue";
import { formatDamage, formatPercent } from "../utils/formatters";
import { targetHpTooltip as makeTargetHpTooltip, weaponTooltip } from "../utils/tooltips";

const scenarioStore = useScenarioStore();
const damageTypesStore = useDamageTypesStore();
const { focusedRows } = useVsArmorModel();

const { scenario } = storeToRefs(scenarioStore);
const { editableDamageTypes } = storeToRefs(damageTypesStore);
const targetHpTooltip = computed(() => makeTargetHpTooltip(scenario.value.hitPoints));
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

    <ExpectedDamageChart :targetHp="scenario.hitPoints" :targetHpTooltip="targetHpTooltip" />

    <div class="results-table">
      <div class="table-row table-head">
        <span class="has-tip" tabindex="0" data-tip="Selected weapon or ammo system.">Weapon</span>
        <span class="has-tip" tabindex="0" data-tip="Base power plus stat bonuses before roll and damage factor.">Power</span>
        <span class="has-tip" tabindex="0" data-tip="Armor after scenario armor effectiveness and AP / ArmorEffectiveness. ToArmorPre is not included yet.">Armor</span>
        <span class="has-tip" tabindex="0" data-tip="Expected HP damage after all primary roll outcomes, armor, HP component percent, and any HP component RNG.">Expected HP</span>
        <span class="has-tip" tabindex="0" data-tip="Expected stun damage after all primary roll outcomes, armor, stun component percent, and any stun component RNG.">Expected Stun</span>
        <span class="has-tip" tabindex="0" data-tip="Chance HP damage alone reaches or exceeds target HP at the inspected armor value.">Kill</span>
      </div>
      <div v-for="row in focusedRows" :key="row.weapon.id" class="table-row">
        <span class="weapon-name has-tip" tabindex="0" :data-tip="weaponTooltip(row.weapon, scenario, editableDamageTypes)">
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
          data-tip="Armor value after AP / ArmorEffectiveness. ToArmorPre is displayed on weapons but not included yet."
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
