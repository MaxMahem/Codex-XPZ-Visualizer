<script setup lang="ts">
import { onMounted } from "vue";
import { storeToRefs } from "pinia";
import { useUiStore } from "./stores/uiStore";
import { useWeaponsStore } from "./stores/weaponsStore";
import { useComparisonStore } from "./stores/comparisonStore";
import { useInspectorStore } from "./stores/inspectorStore";

import ScenarioControls from "./components/ScenarioControls.vue";
import CompareTab from "./components/CompareTab.vue";
import RollsTab from "./components/RollsTab.vue";
import WeaponPanel from "./components/WeaponPanel.vue";
import DamageTypesTab from "./components/DamageTypesTab.vue";
import WeaponsTab from "./components/WeaponsTab.vue";

const uiStore = useUiStore();
const weaponsStore = useWeaponsStore();
const comparisonStore = useComparisonStore();
const inspectorStore = useInspectorStore();

const { activeTab } = storeToRefs(uiStore);

onMounted(() => {
  // Initialize default UI state from weapons data
  if (comparisonStore.selectedIds.length === 0) {
    comparisonStore.selectedIds = weaponsStore.shippedWeapons.slice(0, 3).map(w => w.id);
  }
  if (!inspectorStore.focusedId) {
    inspectorStore.focusedId = weaponsStore.shippedWeapons[0]?.id ?? "";
  }
});
</script>

<template>
  <main class="app-shell">
    <header class="masthead">
      <div>
        <p class="eyebrow">OpenXcom damage lab</p>
        <h1
          class="has-tip"
          tabindex="0"
          data-tip="Each curve shows final expected damage after the OpenXcom-style damage roll, damage factor, armor modifiers, and the zero floor."
        >
          Compare expected weapon damage across armor levels.
        </h1>
      </div>
    </header>

    <nav class="view-tabs" aria-label="Visualization tabs">
      <button
        class="tab-button"
        :class="{ active: activeTab === 'compare' }"
        type="button"
        @click="activeTab = 'compare'"
      >
        Vs Armor
      </button>
      <button
        class="tab-button"
        :class="{ active: activeTab === 'weapons' }"
        type="button"
        @click="activeTab = 'weapons'"
      >
        Weapons
      </button>
      <button
        class="tab-button"
        :class="{ active: activeTab === 'damage-types' }"
        type="button"
        @click="activeTab = 'damage-types'"
      >
        Damage Types
      </button>
    </nav>

    <section
      class="workspace"
      :class="{
        'compare-layout': activeTab === 'compare',
        'single-column': activeTab === 'weapons' || activeTab === 'damage-types',
      }"
    >
      <ScenarioControls v-if="activeTab === 'compare' || activeTab === 'weapons'" />

      <CompareTab v-if="activeTab === 'compare'" />

      <RollsTab v-if="activeTab === 'weapons'" embedded />

      <WeaponPanel v-if="activeTab === 'compare'" />

      <DamageTypesTab v-if="activeTab === 'damage-types'" />

      <WeaponsTab v-if="activeTab === 'weapons'" />
    </section>
  </main>
</template>
