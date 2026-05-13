<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useScenarioStore } from "../stores/scenarioStore";
import { useDamageTypesStore, damageComponentOptions } from "../stores/damageTypesStore";
import { useUiStore, heatmapMetrics } from "../stores/uiStore";
import { randomProfiles } from "../data";
import type { WeaponSystem } from "../types";
import { randomProfileFor } from "../damage";
import { formatDamage, percentField, subtleColor } from "../utils/formatters";
import ColorPicker from "./ColorPicker.vue";
import PercentInput from "./PercentInput.vue";

import HeatmapChart from "./HeatmapChart.vue";

const scenarioStore = useScenarioStore();
const damageTypesStore = useDamageTypesStore();
const uiStore = useUiStore();

const {
  scenario,
} = storeToRefs(scenarioStore);

const {
  editableDamageTypes,
  selectedDamageTypeId,
  selectedDamageType,
} = storeToRefs(damageTypesStore);

const {
  heatmapMetric,
} = storeToRefs(uiStore);
</script>

<template>
  <section class="chart-area damage-type-area" aria-label="Damage type defaults">
    <div class="chart-header">
      <div>
        <h2>Damage Type Defaults</h2>
        <p>
          These are default rules by damage type. Weapon-specific overrides can sit on top of
          these later, but the charts already use these values now.
        </p>
      </div>
      <div class="damage-type-actions">
        <label
          class="distribution-picker has-tip"
          data-tip="Pick a damage type to edit its default armor, HP, stun, and random-roll behavior."
        >
          Damage type
          <select v-model="selectedDamageTypeId">
            <option
              v-for="damageType in editableDamageTypes"
              :key="damageType.id"
              :value="damageType.id"
            >
              {{ damageType.name }}
            </option>
          </select>
        </label>
        <button
          class="add-button has-tip"
          type="button"
          data-tip="Create a new editable damage type using neutral defaults."
          @click="damageTypesStore.addDamageType"
        >
          Add Damage Type
        </button>
      </div>
    </div>

    <div class="damage-type-editor" :style="{ backgroundColor: subtleColor(selectedDamageType.color) }">
      <div class="damage-type-preview">
        <span
          class="damage-type-swatch"
          :style="{ backgroundColor: selectedDamageType.color }"
        ></span>
        <div>
          <h3>{{ selectedDamageType.name }}</h3>
          <p>
            {{ randomProfileFor({ damageTypeId: selectedDamageType.id } as WeaponSystem, editableDamageTypes, randomProfiles).label }}
            random profile
          </p>
        </div>
      </div>

      <div class="damage-type-form damage-type-base-form">
        <label
          class="has-tip"
          data-tip="Display name for this damage type."
        >
          Name
          <input v-model="selectedDamageType.name" type="text" />
        </label>
        <label
          class="has-tip"
          data-tip="Multiplies armor before it is subtracted. Entered as a percent, so 100% means normal armor and 140% means armor is 1.4x as effective."
        >
          Armor Effectiveness %
          <PercentInput
            :modelValue="selectedDamageType.armorEffectiveness"
            :disabled="selectedDamageType.armorEffectivenessScalesWithPower"
            @update:modelValue="damageTypesStore.setArmorEffectiveness($event ?? 0)"
          />
        </label>
        <label
          class="checkbox-label has-tip"
          data-tip="When enabled, the damage type default armor effectiveness is 100% plus weapon power as a percent. Power 40 becomes 140% armor effectiveness."
        >
          <input v-model="selectedDamageType.armorEffectivenessScalesWithPower" type="checkbox" />
          <span>Armor % = 100% + Power%</span>
        </label>
        <label
          class="has-tip"
          data-tip="Default random roll profile for this damage type. The 2 dice option weights middle rolls more heavily."
        >
          Random Type
          <select v-model="selectedDamageType.randomProfileId">
            <option v-for="profile in randomProfiles" :key="profile.id" :value="profile.id">
              {{ profile.label }}
            </option>
          </select>
        </label>
        <div class="color-picker-wrap">
          <span
            class="has-tip"
            style="font-size: 0.82rem; font-weight: 700; color: #435149; margin-bottom: 7px; display: block;"
            data-tip="Subtle UI tint for this damage type. Weapon line colors stay separate."
          >
            Color
          </span>
          <ColorPicker v-model="selectedDamageType.color" title="Damage type color" />
        </div>
      </div>
      <div class="component-list" aria-label="Damage components">
        <div class="component-list-head">
          <span>Component</span>
          <span>Damage %</span>
          <span>0-100% Roll</span>
        </div>
        <div
          v-for="component in damageComponentOptions"
          :key="component.key"
          class="component-row"
        >
          <strong>{{ component.label }}</strong>
          <PercentInput
            :ariaLabel="`${component.label} damage percent`"
            :modelValue="damageTypesStore.componentPercent(selectedDamageType, component.key)"
            @update:modelValue="damageTypesStore.setComponentPercent(component.key, $event ?? 0)"
          />
          <label class="checkbox-label compact-checkbox">
            <input
              :checked="damageTypesStore.componentRandomized(selectedDamageType, component.key)"
              type="checkbox"
              @change="damageTypesStore.setComponentRandomized(component.key, ($event.target as HTMLInputElement).checked)"
            />
            <span>Roll</span>
          </label>
        </div>
      </div>
    </div>

    <section class="heatmap-panel" aria-label="Damage heat map">
      <div class="heatmap-header">
        <div>
          <h3>Power vs Armor</h3>
          <p>
            Color shows expected
            {{ heatmapMetrics.find((metric) => metric.key === heatmapMetric)?.label }}
            damage for {{ selectedDamageType.name }}.
          </p>
        </div>
        <div class="heatmap-tools">
          <label class="heatmap-picker has-tip" data-tip="Choose which expected damage component colors the map.">
            Show
            <select v-model="heatmapMetric">
              <option v-for="metric in heatmapMetrics" :key="metric.key" :value="metric.key">
                {{ metric.label }}
              </option>
            </select>
          </label>
          <div class="heatmap-scale" aria-label="Heat map color scale">
            <span>Low</span>
            <i></i>
            <span>High</span>
            <span class="contour-key">Target HP</span>
          </div>
        </div>
      </div>
      <HeatmapChart />
    </section>

    <div class="damage-type-grid">
      <article
        v-for="damageType in editableDamageTypes"
        :key="damageType.id"
        class="damage-type-card"
        :class="{ active: selectedDamageTypeId === damageType.id }"
        :style="{ backgroundColor: subtleColor(damageType.color) }"
        @click="selectedDamageTypeId = damageType.id"
      >
        <h3>{{ damageType.name }}</h3>
        <dl>
          <div>
            <dt>Armor</dt>
            <dd>
              {{
                damageType.armorEffectivenessScalesWithPower
                  ? "100% + Power%"
                  : `${percentField(damageType.armorEffectiveness)}%`
              }}
            </dd>
          </div>
          <div>
            <dt>HP</dt>
            <dd>{{ percentField(damageType.hpDamagePercent) }}%{{ damageType.hpDamageRandomized ? " rng" : "" }}</dd>
          </div>
          <div>
            <dt>Stun</dt>
            <dd>{{ percentField(damageType.stunDamagePercent) }}%{{ damageType.stunDamageRandomized ? " rng" : "" }}</dd>
          </div>
          <div v-for="component in damageComponentOptions.slice(2)" :key="component.key">
            <dt>{{ component.label }}</dt>
            <dd>
              {{ percentField(damageTypesStore.componentPercent(damageType, component.key)) }}%{{
                damageTypesStore.componentRandomized(damageType, component.key) ? " rng" : ""
              }}
            </dd>
          </div>
          <div>
            <dt>Random</dt>
            <dd>
              {{
                randomProfiles.find((profile) => profile.id === damageType.randomProfileId)
                  ?.label ?? damageType.randomProfileId
              }}
            </dd>
          </div>
        </dl>
      </article>
    </div>
  </section>
</template>
