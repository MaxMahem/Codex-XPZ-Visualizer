<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useAppStore } from "../stores/appStore";

const store = useAppStore();
const { scenario, scenarioTab, currentArmor, hoveredArmor } = storeToRefs(store);
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
        {{ store.formatDamage(scenario.hitPoints) }}, Armor {{ currentArmor }}
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
          data-tip="Strength contributes to weapons that define a strength damage bonus, such as the sample Hammer."
        >
          Strength
          <input v-model.number="scenario.strength" type="number" min="0" max="255" />
        </label>
        <label
          class="has-tip"
          data-tip="Melee contributes to weapons that define a melee damage bonus and is separate from hit chance in this first version."
        >
          Melee
          <input v-model.number="scenario.melee" type="number" min="0" max="255" />
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
          <input v-model.number="hoveredArmor" type="number" min="0" max="400" />
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
