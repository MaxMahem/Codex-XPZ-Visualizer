<script setup lang="ts">
import { storeToRefs } from "pinia";
import { computed, ref } from "vue";
import { useDamageTypesStore, damageComponentOptions } from "../stores/damageTypesStore";
import { heatmapMetrics, type HeatmapMetric } from "../uiOptions";
import { randomProfiles } from "../data";
import type { WeaponSystem } from "../types";
import { randomProfileFor } from "../damage";
import { formatDamage, percentField, subtleColor } from "../utils/formatters";
import ColorPicker from "./ColorPicker.vue";
import PercentInput from "./PercentInput.vue";

import HeatmapChart from "./HeatmapChart.vue";

const damageTypesStore = useDamageTypesStore();
const heatmapMetric = ref<HeatmapMetric>("hp");

const {
  editableDamageTypes,
  customDamageTypes,
} = storeToRefs(damageTypesStore);

const selectedDamageTypeId = ref(editableDamageTypes.value[0]?.id ?? "");
const selectedDamageType = computed(
  () =>
    editableDamageTypes.value.find((damageType) => damageType.id === selectedDamageTypeId.value) ??
    editableDamageTypes.value[0],
);
const isCustomSelected = computed(() =>
  customDamageTypes.value.some((damageType) => damageType.id === selectedDamageTypeId.value),
);

function addDamageType(): void {
  selectedDamageTypeId.value = damageTypesStore.addDamageType();
}

function removeSelectedDamageType(): void {
  damageTypesStore.removeDamageType(selectedDamageType.value.id);
  selectedDamageTypeId.value = editableDamageTypes.value[0]?.id ?? "";
}
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
          @click="addDamageType"
        >
          Add Damage Type
        </button>
        <button
          v-if="isCustomSelected"
          class="remove-button has-tip"
          type="button"
          data-tip="Remove this custom damage type."
          @click="removeSelectedDamageType"
        >
          Remove
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
          <div style="display: flex; align-items: center; gap: 8px;">
            <h3>{{ selectedDamageType.name }}</h3>
            <span v-if="!isCustomSelected" class="locked-badge" title="Default damage types cannot be modified">Locked</span>
          </div>
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
          <input v-model="selectedDamageType.name" type="text" :disabled="!isCustomSelected" />
        </label>
        <label
          class="has-tip"
          data-tip="Multiplies armor before it is subtracted. Entered as a percent, so 100% means normal armor and 140% means armor is 1.4x as effective."
        >
          Armor Effectiveness %
          <PercentInput
            :modelValue="selectedDamageType.armorEffectiveness"
            :disabled="!isCustomSelected || selectedDamageType.armorEffectivenessScalesWithPower"
            @update:modelValue="damageTypesStore.setArmorEffectiveness(selectedDamageType.id, $event ?? 0)"
          />
        </label>
        <label
          class="checkbox-label has-tip"
          :class="{ disabled: !isCustomSelected }"
          data-tip="When enabled, the damage type default armor effectiveness is 100% plus weapon power as a percent. Power 40 becomes 140% armor effectiveness."
        >
          <input v-model="selectedDamageType.armorEffectivenessScalesWithPower" type="checkbox" :disabled="!isCustomSelected" />
          <span>Armor % = 100% + Power%</span>
        </label>
        <label
          class="has-tip"
          data-tip="Default random roll profile for this damage type. The 2 dice option weights middle rolls more heavily."
        >
          Random Type
          <select v-model="selectedDamageType.randomProfileId" :disabled="!isCustomSelected">
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
          <ColorPicker v-model="selectedDamageType.color" title="Damage type color" :disabled="!isCustomSelected" />
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
            :modelValue="selectedDamageType.damageComponents[component.key].percent"
            :disabled="!isCustomSelected"
            @update:modelValue="damageTypesStore.setComponentPercent(selectedDamageType.id, component.key, $event ?? 0)"
          />
          <label class="checkbox-label compact-checkbox" :class="{ disabled: !isCustomSelected }">
            <input
              :checked="!!selectedDamageType.damageComponents[component.key].randomized"
              type="checkbox"
              :disabled="!isCustomSelected"
              @change="damageTypesStore.setComponentRandomized(selectedDamageType.id, component.key, ($event.target as HTMLInputElement).checked)"
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
      <HeatmapChart :heatmapMetric="heatmapMetric" :damageType="selectedDamageType" />
    </section>

    <div class="damage-type-grid">
      <article
        v-for="damageType in editableDamageTypes"
        :key="damageType.id"
        class="damage-type-card"
        :class="{ 
          active: selectedDamageTypeId === damageType.id, 
          'is-default': !customDamageTypes.some(ct => ct.id === damageType.id) 
        }"
        :style="{ backgroundColor: subtleColor(damageType.color) }"
        @click="selectedDamageTypeId = damageType.id"
      >
        <div v-if="!customDamageTypes.some(ct => ct.id === damageType.id)" class="card-lock-icon" title="Default damage type">🔒</div>
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
          <div v-for="comp in Object.values(damageType.damageComponents)" :key="comp.type">
            <dt>{{ damageComponentOptions.find(o => o.key === comp.type)?.label ?? comp.type }}</dt>
            <dd>
              {{ percentField(comp.percent) }}%{{
                comp.randomized ? " rng" : ""
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
