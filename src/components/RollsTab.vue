<script setup lang="ts">
import { computed, ref, toRef } from "vue";
import { storeToRefs } from "pinia";
import { useRollDamageModel } from "../composables/useRollDamageModel";
import { useScenarioStore } from "../stores/scenarioStore";
import { damageComponentOptions } from "../stores/damageTypesStore";
import { useWeaponsStore } from "../stores/weaponsStore";
import IntegerSpinner from "./IntegerSpinner.vue";
import RollsChart from "./RollsChart.vue";
import { formatPercent, formatAverage } from "../utils/formatters";
import type { DamageMetricKey } from "../types";

const props = defineProps<{
  embedded?: boolean;
  focusedWeaponId: string;
}>();
const emit = defineEmits<{
  "update:focusedWeaponId": [id: string];
}>();

const scenarioStore = useScenarioStore();
const weaponsStore = useWeaponsStore();
const visibleRollComponents = ref<DamageMetricKey[]>(["hp", "stun", "armor"]);
const shotCount = ref(1);
const focusedWeaponIdRef = toRef(props, "focusedWeaponId");

const hpModel = useRollDamageModel(
  focusedWeaponIdRef,
  ref("hp"),
  visibleRollComponents,
  undefined,
  shotCount,
);

const panicChanceModel = useRollDamageModel(
  focusedWeaponIdRef,
  ref("panicChance"),
  visibleRollComponents,
  undefined,
  shotCount,
);

const { rollWeapon, modeledShotCount, currentArmor, rollExpectedComponents } = hpModel;

const rollStats = computed(() => ({
  zeroChance: hpModel.rollStats.value.zeroChance,
  killChance: hpModel.rollStats.value.killChance,
  koChance: hpModel.rollStats.value.koChance,
  effectivePanicChance: panicChanceModel.rollStats.value.effectivePanicChance,
}));

const { scenario } = storeToRefs(scenarioStore);
const { editableWeapons } = storeToRefs(weaponsStore);
const rollLegendComponents = computed(() =>
  [
    ...damageComponentOptions.filter((component) => component.key !== "preArmor"),
    { key: "panicChance" as const, label: "Panic Chance" },
  ],
);

const componentSwatches: Partial<Record<DamageMetricKey, string>> = {
  hp: "hp-area",
  stun: "stun-area",
  morale: "morale-line",
  panicChance: "panic-line",
  armor: "armor-line",
  preArmor: "armor-line",
  tu: "tu-line",
  energy: "energy-line",
  mana: "mana-line",
};

function toggleRollComponent(component: DamageMetricKey): void {
  if (visibleRollComponents.value.includes(component)) {
    visibleRollComponents.value = visibleRollComponents.value.filter((item) => item !== component);
    return;
  }
  visibleRollComponents.value = [...visibleRollComponents.value, component];
}

function rollLegendTotal(component: DamageMetricKey): string {
  if (component === "armor") {
    return formatAverage(rollExpectedComponents.value.armor + rollExpectedComponents.value.preArmor);
  }
  if (component === "hp-stun") {
    return formatAverage(rollExpectedComponents.value.hp + rollExpectedComponents.value.stun);
  }
  if (component === "panicChance") {
    return `${formatAverage(rollStats.value.effectivePanicChance)}%`;
  }
  if (component === "morale") {
    const scaled = Math.trunc(((110 - scenario.value.targetBravery) * rollExpectedComponents.value.morale) / 100);
    return `${formatAverage(scaled)} (${formatAverage(rollExpectedComponents.value.morale)})`;
  }
  if (component === "scaledMorale") {
    return formatAverage(Math.trunc(((110 - scenario.value.targetBravery) * rollExpectedComponents.value.morale) / 100));
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
          {{ rollWeapon.name }} x {{ modeledShotCount }} vs armor {{ currentArmor }}
        </p>
      </div>
      <div class="distribution-controls">
        <label
          v-if="!embedded"
          class="distribution-picker has-tip"
          data-tip="Choose the weapon or ammo system shown in the roll-result chart."
        >
          Weapon
          <select
            :value="focusedWeaponId"
            @change="emit('update:focusedWeaponId', ($event.target as HTMLSelectElement).value)"
          >
            <option v-for="weapon in editableWeapons" :key="weapon.id" :value="weapon.id">
              {{ weapon.name }}
            </option>
          </select>
        </label>
        <label
          class="distribution-picker shot-picker has-tip"
          data-tip="Model this many independent shots using the same single-shot damage logic."
        >
          Shots
          <IntegerSpinner
            v-model="shotCount"
            :min="1"
            :max="30"
            :step="1"
            :fallback="1"
          />
        </label>
      </div>
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
        data-tip="Chance that total HP damage across all modeled shots reaches or exceeds target HP."
      >
        Kill: <strong>{{ formatPercent(rollStats.killChance) }}</strong>
      </span>
      <span
        class="has-tip"
        tabindex="0"
        data-tip="Chance total HP plus stun damage across all modeled shots exceeds target HP."
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
        @click="toggleRollComponent(component.key)"
        tabindex="0"
        :data-tip="component.key === 'hp'
          ? 'Toggle HP damage. HP forms the base filled area when visible.'
          : component.key === 'stun'
            ? 'Toggle stun damage. Stun stacks above HP when HP is also visible.'
            : component.key === 'morale'
              ? 'Toggle target-scaled morale damage. The parenthetical number is the raw weapon morale before target bravery.'
              : component.key === 'panicChance'
                ? 'Toggle panic chance from scaled morale damage. This uses the right-side percent axis.'
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

    <RollsChart
      :focusedWeaponId="focusedWeaponId"
      :shotCount="modeledShotCount"
      :targetHp="scenario.hitPoints"
      :visibleRollComponents="visibleRollComponents"
    />
  </section>
</template>
