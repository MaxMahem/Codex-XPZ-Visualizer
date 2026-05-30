<script setup lang="ts">
import { computed, ref } from "vue";
import { storeToRefs } from "pinia";
import { useScenarioStore } from "../stores/scenarioStore";
import { formatDamage } from "../utils/formatters";
import DecimalSpinner from "./DecimalSpinner.vue";
import IntegerSpinner from "./IntegerSpinner.vue";
import type { ArmorSide } from "../types";

const scenarioStore = useScenarioStore();

const {
  scenario,
  scenarioTab,
  attackerPresets,
  targetPresets,
  armors,
  selectedAttackerUnitId,
  selectedTargetUnitId,
  selectedTargetArmorId,
  targetArmorSide,
  selectedTargetArmor,
  importStatus,
  soldierPresets,
  units,
  currentArmor,
} = storeToRefs(scenarioStore);

const currentTargetResistance = computed(() => {
  const armor = selectedTargetArmor.value;
  if (!armor) return "None";
  return armor.damageModifier.map((m: number) => m * 100 + '%').join(', ');
});

function importRuleset(event: Event) {
  scenarioStore.importRulesetFile(event);
}

function setTargetSide(event: Event) {
  scenarioStore.setTargetArmorSide((event.target as HTMLSelectElement).value as ArmorSide);
}
</script>

<template>
  <details
    class="control-panel scenario-accordion"
    aria-label="Scenario controls"
  >
    <summary class="scenario-summary">
      <span>Scenario</span>
      <small>
        Attacker: STR {{ scenario.strength }}, Melee {{ scenario.melee }} | Target: HP
        {{ formatDamage(scenario.hitPoints) }}, Armor {{ currentArmor }}
      </small>
    </summary>
    <div class="scenario-tabs" role="tablist" aria-label="Scenario sections">
      <button
        class="mini-tab"
        :class="{ active: scenarioTab === 'attacker' }"
        type="button"
        @click="scenarioTab = 'attacker'"
      >
        Attacker
      </button>
      <button
        class="mini-tab"
        :class="{ active: scenarioTab === 'target' }"
        type="button"
        @click="scenarioTab = 'target'"
      >
        Target
      </button>
    </div>
    <div class="scenario-imports">
      <label
        class="import-button has-tip"
        data-tip="Import any OpenXcom .rul or YAML file. Soldiers, units, armors, and powered items are imported from whichever sections are present."
      >
        Import Ruleset
        <input multiple type="file" accept=".rul,.yml,.yaml,text/yaml,text/plain" @change="importRuleset" />
      </label>
      <button
        class="add-button has-tip"
        type="button"
        data-tip="Clear imported and default soldiers, units, and armors. Weapon and ammo rows are kept."
        @click="scenarioStore.clearUnitsAndArmors"
      >
        Clear Units &amp; Armors
      </button>
      <small>{{ soldierPresets.length }} soldier presets, {{ units.length }} units, {{ armors.length }} armors loaded</small>
    </div>
    <p v-if="importStatus" class="import-status scenario-import-status">{{ importStatus }}</p>
    <div class="scenario-content">
      <section v-if="scenarioTab === 'attacker'" class="panel-section">
        <label
          class="has-tip"
          data-tip="Choose a unit preset to fill the attacker stats below."
        >
          Attacker Unit
          <select
            :value="selectedAttackerUnitId"
            @change="scenarioStore.applyAttackerUnit(($event.target as HTMLSelectElement).value)"
          >
            <option value="">Custom attacker</option>
            <option v-for="unit in attackerPresets" :key="unit.id" :value="unit.id">
              {{ unit.name }}
            </option>
          </select>
        </label>
        <label
          class="has-tip"
          data-tip="Strength contributes to weapons that define a strength damage bonus."
        >
          Strength
          <IntegerSpinner v-model="scenario.strength" :min="0" :max="255" />
        </label>
        <label
          class="has-tip"
          data-tip="Melee accuracy contributes to weapons that define a melee damage bonus."
        >
          Melee
          <IntegerSpinner v-model="scenario.melee" :min="0" :max="255" />
        </label>
        <label
          class="has-tip"
          data-tip="Bravery contributes to weapons that define a bravery damage bonus."
        >
          Bravery
          <IntegerSpinner v-model="scenario.bravery" :min="0" :max="255" />
        </label>
        <label
          class="has-tip"
          data-tip="Firing accuracy contributes to weapons that define a firing damage bonus."
        >
          Firing
          <IntegerSpinner v-model="scenario.firing" :min="0" :max="255" />
        </label>
        <label
          class="has-tip"
          data-tip="Reactions contributes to weapons that define a reactions damage bonus."
        >
          Reactions
          <IntegerSpinner v-model="scenario.reactions" :min="0" :max="255" />
        </label>
        <label
          class="has-tip"
          data-tip="Throwing accuracy contributes to weapons that define a throwing damage bonus."
        >
          Throwing
          <IntegerSpinner v-model="scenario.throwing" :min="0" :max="255" />
        </label>
        <label
          class="has-tip"
          data-tip="Psi Strength contributes to weapons that define a psi strength damage bonus."
        >
          Psi Strength
          <IntegerSpinner v-model="scenario.psiStrength" :min="0" :max="255" />
        </label>
        <label
          class="has-tip"
          data-tip="Psi Skill contributes to weapons that define a psi skill damage bonus."
        >
          Psi Skill
          <IntegerSpinner v-model="scenario.psiSkill" :min="0" :max="255" />
        </label>
        <label
          class="has-tip"
          data-tip="Mana contributes to weapons that define a mana damage bonus."
        >
          Mana
          <IntegerSpinner v-model="scenario.mana" :min="0" :max="255" />
        </label>
        <label
          class="has-tip"
          data-tip="Rank contributes to weapons that define a rank damage bonus."
        >
          Rank
          <IntegerSpinner v-model="scenario.rank" :min="0" :max="10" />
        </label>
      </section>

      <section v-if="scenarioTab === 'target'" class="panel-section">
        <label
          class="has-tip"
          data-tip="Choose a unit preset to fill target HP, bravery, armor, and armor resistances."
        >
          Target Unit
          <select
            :value="selectedTargetUnitId"
            @change="scenarioStore.applyTargetUnit(($event.target as HTMLSelectElement).value)"
          >
            <option value="">Custom target</option>
            <option v-for="unit in targetPresets" :key="unit.id" :value="unit.id">
              {{ unit.name }}
            </option>
          </select>
        </label>
        <label
          class="has-tip"
          data-tip="Target armor supplies side armor values and damage modifier resistances. Target presets choose their default armor automatically, but the full armor list remains available."
        >
          Target Armor
          <select
            :value="selectedTargetArmorId"
            @change="scenarioStore.applyTargetArmor(($event.target as HTMLSelectElement).value)"
          >
            <option value="">Custom armor</option>
            <option v-for="armor in armors" :key="armor.id" :value="armor.id">
              {{ armor.name }}
            </option>
          </select>
        </label>
        <label
          class="has-tip"
          data-tip="Select which side of the target armor is being hit."
        >
          Armor Side
          <select :value="targetArmorSide" @change="setTargetSide">
            <option value="front">Front {{ selectedTargetArmor ? selectedTargetArmor.frontArmor : "" }}</option>
            <option value="side">Side {{ selectedTargetArmor ? selectedTargetArmor.sideArmor : "" }}</option>
            <option value="rear">Rear {{ selectedTargetArmor ? selectedTargetArmor.rearArmor : "" }}</option>
            <option value="under">Under {{ selectedTargetArmor ? selectedTargetArmor.underArmor : "" }}</option>
          </select>
        </label>
        <label
          class="has-tip"
          data-tip="Used for the red horizontal HP line and the kill chance column."
        >
          Target HP
          <IntegerSpinner v-model="scenario.hitPoints" :min="1" :max="500" :fallback="1" />
        </label>
        <label
          class="has-tip"
          data-tip="Armor value used by the vertical inspection line and comparison table."
        >
          Armor
          <IntegerSpinner v-model="scenario.armor" :min="0" :max="400" />
        </label>
        <label
          class="has-tip"
          data-tip="Target bravery reduces morale damage: (110 - bravery) / 100."
        >
          Target Bravery
          <IntegerSpinner v-model="scenario.targetBravery" :min="0" :max="110" :step="10" />
        </label>
        <label
          class="has-tip"
          data-tip="Multiplies armor before damage is subtracted. Leave at 1 for normal armor behavior."
        >
          Armor effectiveness
          <DecimalSpinner
            v-model="scenario.armorEffectiveness"
            :min="0"
            :max="3"
            :step="0.05"
            :fallback="1"
          />
        </label>
        <label
          class="has-tip"
          data-tip="OpenXcom armor damageModifier array used before armor subtraction."
        >
          Damage modifiers
          <input :value="currentTargetResistance" type="text" readonly />
        </label>
      </section>
    </div>
  </details>
</template>
