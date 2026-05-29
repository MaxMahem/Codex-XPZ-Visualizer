<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { importSummary, useScenarioStore } from "../stores/scenarioStore";
import { useDamageTypesStore } from "../stores/damageTypesStore";
import { useWeaponsStore } from "../stores/weaponsStore";
import { formatDamage } from "../utils/formatters";
import type { ArmorSide } from "../types";

const scenarioStore = useScenarioStore();
const damageTypesStore = useDamageTypesStore();
const weaponsStore = useWeaponsStore();

const {
  scenario,
  scenarioTab,
  units,
  soldierPresets,
  userPresets,
  targetPresets,
  armors,
  selectedUserUnitId,
  selectedTargetUnitId,
  selectedTargetArmorId,
  targetArmorSide,
  importStatus,
  currentArmor,
} = storeToRefs(scenarioStore);

const selectedTargetArmor = computed(() =>
  armors.value.find((armor) => armor.id === selectedTargetArmorId.value),
);

const currentTargetResistance = computed(() => {
  const modifiers = scenario.value.targetDamageModifiers;
  if (!modifiers || modifiers.length === 0) return "Default";
  return `${modifiers.length} damage modifiers`;
});

function setTargetSide(event: Event): void {
  scenarioStore.setTargetArmorSide((event.target as HTMLSelectElement).value as ArmorSide);
}

async function importRuleset(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  if (files.length === 0) return;

  const total = { soldiers: 0, units: 0, armors: 0 };
  let itemCount = 0;
  for (const file of files) {
    const text = await file.text();
    const imported = scenarioStore.importRulesetText(text);
    damageTypesStore.applyTranslations(scenarioStore.translations);
    weaponsStore.applyTranslations(scenarioStore.translations);
    total.soldiers += imported.soldiers;
    total.units += imported.units;
    total.armors += imported.armors;
    itemCount += weaponsStore.importItemsText(text).length;
  }
  scenarioStore.setImportStatus(importSummary(total, itemCount));
  input.value = "";
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
        User: STR {{ scenario.strength }}, Melee {{ scenario.melee }} | Target: HP
        {{ formatDamage(scenario.hitPoints) }}, Armor {{ currentArmor }}
      </small>
    </summary>
    <div class="scenario-tabs" role="tablist" aria-label="Scenario sections">
      <button
        class="mini-tab"
        :class="{ active: scenarioTab === 'user' }"
        type="button"
        @click="scenarioTab = 'user'"
      >
        User
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
      <section v-if="scenarioTab === 'user'" class="panel-section">
        <label
          class="has-tip"
          data-tip="Choose a unit preset to fill the user stats below."
        >
          User Unit
          <select
            :value="selectedUserUnitId"
            @change="scenarioStore.applyUserUnit(($event.target as HTMLSelectElement).value)"
          >
            <option value="">Custom user</option>
            <option v-for="unit in userPresets" :key="unit.id" :value="unit.id">
              {{ unit.name }}
            </option>
          </select>
        </label>
        <label
          class="has-tip"
          data-tip="Strength contributes to weapons that define a strength damage bonus."
        >
          Strength
          <input v-model.number="scenario.strength" type="number" min="0" max="255" />
        </label>
        <label
          class="has-tip"
          data-tip="Melee accuracy contributes to weapons that define a melee damage bonus."
        >
          Melee
          <input v-model.number="scenario.melee" type="number" min="0" max="255" />
        </label>
        <label
          class="has-tip"
          data-tip="Bravery contributes to weapons that define a bravery damage bonus."
        >
          Bravery
          <input v-model.number="scenario.bravery" type="number" min="0" max="255" />
        </label>
        <label
          class="has-tip"
          data-tip="Firing accuracy contributes to weapons that define a firing damage bonus."
        >
          Firing
          <input v-model.number="scenario.firing" type="number" min="0" max="255" />
        </label>
        <label
          class="has-tip"
          data-tip="Reactions contributes to weapons that define a reactions damage bonus."
        >
          Reactions
          <input v-model.number="scenario.reactions" type="number" min="0" max="255" />
        </label>
        <label
          class="has-tip"
          data-tip="Throwing accuracy contributes to weapons that define a throwing damage bonus."
        >
          Throwing
          <input v-model.number="scenario.throwing" type="number" min="0" max="255" />
        </label>
        <label
          class="has-tip"
          data-tip="Psi Strength contributes to weapons that define a psi strength damage bonus."
        >
          Psi Strength
          <input v-model.number="scenario.psiStrength" type="number" min="0" max="255" />
        </label>
        <label
          class="has-tip"
          data-tip="Psi Skill contributes to weapons that define a psi skill damage bonus."
        >
          Psi Skill
          <input v-model.number="scenario.psiSkill" type="number" min="0" max="255" />
        </label>
        <label
          class="has-tip"
          data-tip="Mana contributes to weapons that define a mana damage bonus."
        >
          Mana
          <input v-model.number="scenario.mana" type="number" min="0" max="255" />
        </label>
        <label
          class="has-tip"
          data-tip="Rank contributes to weapons that define a rank damage bonus."
        >
          Rank
          <input v-model.number="scenario.rank" type="number" min="0" max="10" />
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
          <input v-model.number="scenario.hitPoints" type="number" min="1" max="500" />
        </label>
        <label
          class="has-tip"
          data-tip="Armor value used by the vertical inspection line and comparison table."
        >
          Armor
          <input v-model.number="scenario.armor" type="number" min="0" max="400" />
        </label>
        <label
          class="has-tip"
          data-tip="Target bravery reduces morale damage: (110 - bravery) / 100."
        >
          Target Bravery
          <input v-model.number="scenario.targetBravery" type="number" min="0" max="110" step="10" />
        </label>
        <label
          class="has-tip"
          data-tip="Multiplies armor before damage is subtracted. Leave at 1 for normal armor behavior."
        >
          Armor effectiveness
          <input
            v-model.number="scenario.armorEffectiveness"
            type="number"
            min="0"
            max="3"
            step="0.05"
          />
        </label>
        <label
          class="has-tip"
          data-tip="OpenXcom armor damageModifier array used before armor subtraction. The active damage type chooses the index."
        >
          Damage modifiers
          <input :value="currentTargetResistance" type="text" readonly />
        </label>
      </section>
    </div>
  </details>
</template>
