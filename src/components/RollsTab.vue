<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useRollDamageModel } from "../composables/useRollDamageModel";
import { useScenarioStore } from "../stores/scenarioStore";
import { useWeaponsStore } from "../stores/weaponsStore";
import RollsChart from "./RollsChart.vue";
import { formatPercent } from "../utils/formatters";

defineProps<{
  embedded?: boolean;
}>();

const scenarioStore = useScenarioStore();
const weaponsStore = useWeaponsStore();
const { currentArmor, rollStats } = useRollDamageModel();

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

    <RollsChart :targetHp="scenario.hitPoints" />
  </section>
</template>
