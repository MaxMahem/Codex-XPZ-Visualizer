<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useInspectorStore } from "../stores/inspectorStore";
import { useRollDamageModel } from "../composables/useRollDamageModel";
import { useScenarioStore } from "../stores/scenarioStore";
import { damageComponentOptions } from "../stores/damageTypesStore";
import { useUiStore } from "../stores/uiStore";
import { useWeaponsStore } from "../stores/weaponsStore";
import RollsChart from "./RollsChart.vue";
import { formatPercent, formatAverage } from "../utils/formatters";
import type { DamageMetricKey } from "../types";

defineProps<{
  embedded?: boolean;
}>();

const scenarioStore = useScenarioStore();
const uiStore = useUiStore();
const weaponsStore = useWeaponsStore();
const inspectorStore = useInspectorStore();
const { currentArmor, rollStats, rollWeapon, rollExpectedComponents } = useRollDamageModel();

const { scenario } = storeToRefs(scenarioStore);
const { editableWeapons } = storeToRefs(weaponsStore);
const { focusedId } = storeToRefs(inspectorStore);
const { visibleRollComponents } = storeToRefs(uiStore);
const rollLegendComponents = computed(() =>
  damageComponentOptions.filter((component) => component.key !== "preArmor"),
);

const componentSwatches: Partial<Record<DamageMetricKey, string>> = {
  hp: "hp-area",
  stun: "stun-area",
  morale: "morale-line",
  armor: "armor-line",
  preArmor: "armor-line",
  tu: "tu-line",
  energy: "energy-line",
  mana: "mana-line",
};

function rollLegendTotal(component: DamageMetricKey): string {
  if (component === "armor") {
    return formatAverage(rollExpectedComponents.value.armor + rollExpectedComponents.value.preArmor);
  }
  if (component === "hp-stun") {
    return formatAverage(rollExpectedComponents.value.hp + rollExpectedComponents.value.stun);
  }
  if (component === "morale") {
    const scaled = Math.floor(((110 - scenario.value.targetBravery) * rollExpectedComponents.value.morale) / 100);
    return `${formatAverage(scaled)} (${formatAverage(rollExpectedComponents.value.morale)})`;
  }
  if (component === "scaledMorale") {
    return formatAverage(Math.floor(((110 - scenario.value.targetBravery) * rollExpectedComponents.value.morale) / 100));
  }
  return formatAverage(rollExpectedComponents.value[component]);
}
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
          v-model="focusedId"
          @change="inspectorStore.setFocus(($event.target as HTMLSelectElement).value)"
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
      <button
        v-for="component in rollLegendComponents"
        :key="component.key"
        class="legend-item legend-toggle has-tip"
        :class="{ inactive: !visibleRollComponents.includes(component.key) }"
        type="button"
        :aria-pressed="visibleRollComponents.includes(component.key)"
        @click="uiStore.toggleRollComponent(component.key)"
        tabindex="0"
        :data-tip="component.key === 'hp'
          ? 'Toggle HP damage. HP forms the base filled area when visible.'
          : component.key === 'stun'
            ? 'Toggle stun damage. Stun stacks above HP when HP is also visible.'
            : component.key === 'morale'
              ? 'Toggle target-scaled morale damage. The parenthetical number is the raw weapon morale before target bravery.'
              : component.key === 'armor'
                ? 'Toggle armor damage plus pre-armor damage as one non-stacked line.'
                : `Toggle ${component.label} damage as its own non-stacked line.`"
      >
        <i
          class="legend-swatch"
          :class="componentSwatches[component.key] ?? 'component-line'"
          :style="component.key === 'hp' ? { backgroundColor: rollWeapon.color } : undefined"
        ></i>
        <span class="legend-label">{{ component.label }}</span>
        <span class="legend-total">{{ rollLegendTotal(component.key) }}</span>
      </button>
    </div>

    <RollsChart :targetHp="scenario.hitPoints" />
  </section>
</template>
