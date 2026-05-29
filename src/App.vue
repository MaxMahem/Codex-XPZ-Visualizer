<script setup lang="ts">
import { ref } from "vue";
import { useWeaponsStore } from "./stores/weaponsStore";
import type { AppTab } from "./uiOptions";

import ScenarioControls from "./components/ScenarioControls.vue";
import CompareTab from "./components/CompareTab.vue";
import RollsTab from "./components/RollsTab.vue";
import WeaponPanel from "./components/WeaponPanel.vue";
import DamageTypesTab from "./components/DamageTypesTab.vue";
import WeaponsTab from "./components/WeaponsTab.vue";

const weaponsStore = useWeaponsStore();
const activeTab = ref<AppTab>("compare");
const selectedWeaponIds = ref<string[]>(weaponsStore.shippedWeapons.slice(0, 3).map((weapon) => weapon.id));
const focusedWeaponId = ref(weaponsStore.shippedWeapons[0]?.id ?? "");
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
      <ScenarioControls v-show="activeTab === 'compare' || activeTab === 'weapons'" />

      <CompareTab v-show="activeTab === 'compare'" :selectedWeaponIds="selectedWeaponIds" />

      <RollsTab
        v-show="activeTab === 'weapons'"
        embedded
        :focusedWeaponId="focusedWeaponId"
        @update:focusedWeaponId="focusedWeaponId = $event"
      />

      <WeaponPanel
        v-show="activeTab === 'compare'"
        :selectedWeaponIds="selectedWeaponIds"
        @update:selectedWeaponIds="selectedWeaponIds = $event"
      />

      <DamageTypesTab v-show="activeTab === 'damage-types'" />

      <WeaponsTab
        v-show="activeTab === 'weapons'"
        :focusedWeaponId="focusedWeaponId"
        :selectedWeaponIds="selectedWeaponIds"
        @update:focusedWeaponId="focusedWeaponId = $event"
        @update:selectedWeaponIds="selectedWeaponIds = $event"
      />
    </section>
  </main>
</template>
