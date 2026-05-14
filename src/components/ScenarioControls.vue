<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useCurrentArmor } from "../composables/useCurrentArmor";
import { useScenarioStore } from "../stores/scenarioStore";
import { formatDamage } from "../utils/formatters";

const scenarioStore = useScenarioStore();
const { currentArmor } = useCurrentArmor();

const { scenario, scenarioTab } = storeToRefs(scenarioStore);
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
    <div class="scenario-content">
      <section v-if="scenarioTab === 'user'" class="panel-section">
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
      </section>
    </div>
  </details>
</template>
