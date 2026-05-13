<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useAppStore } from "../stores/appStore";
import { randomProfiles } from "../data";
import { damageComponentOptions, heatmapMetrics } from "../stores/appStore";
import type { WeaponSystem } from "../types";
import { randomProfileFor } from "../damage";
import ColorPicker from "./ColorPicker.vue";
import PercentInput from "./PercentInput.vue";

const store = useAppStore();
const {
  scenario,
  editableDamageTypes,
  selectedDamageTypeId,
  selectedDamageType,
  heatmapMetric,
  heatmapImageHref,
  heatmapHpContour,
  inspectedHeatmapCell,
} = storeToRefs(store);

// Because we need randomProfileFor here in template which isn't directly in store,
// actually we can just import it.
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
          @click="store.addDamageType"
        >
          Add Damage Type
        </button>
      </div>
    </div>

    <div class="damage-type-editor" :style="{ backgroundColor: store.subtleColor(selectedDamageType.color) }">
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
            @update:modelValue="store.setArmorEffectiveness($event ?? 0)"
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
            :modelValue="store.componentPercent(selectedDamageType, component.key)"
            @update:modelValue="store.setComponentPercent(component.key, $event ?? 0)"
          />
          <label class="checkbox-label compact-checkbox">
            <input
              :checked="store.componentRandomized(selectedDamageType, component.key)"
              type="checkbox"
              @change="store.setComponentRandomized(component.key, ($event.target as HTMLInputElement).checked)"
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
      <div class="heatmap-map">
        <svg
          viewBox="0 0 780 350"
          role="img"
          aria-label="Expected damage heat map by weapon power and armor"
          @pointermove="store.handleHeatmapPointer"
          @pointerleave="store.clearHeatmapPointer"
        >
          <defs>
            <clipPath id="heatmap-surface-clip">
              <rect width="660" height="270" rx="6"></rect>
            </clipPath>
          </defs>
          <g transform="translate(58 20)">
            <rect class="heatmap-backdrop" width="660" height="270" rx="6"></rect>
            <g clip-path="url(#heatmap-surface-clip)">
              <image
                v-if="heatmapImageHref"
                class="heatmap-surface"
                :href="heatmapImageHref"
                x="0"
                y="0"
                width="660"
                height="270"
                preserveAspectRatio="none"
              />
              <line
                v-for="power in [0, 25, 50, 75, 100, 125, 150]"
                :key="`hm-x-${power}`"
                class="heatmap-grid-line"
                :x1="store.heatmapX(power)"
                :x2="store.heatmapX(power)"
                y1="0"
                y2="270"
              />
              <line
                v-for="armor in [0, 25, 50, 75, 100]"
                :key="`hm-y-${armor}`"
                class="heatmap-grid-line"
                x1="0"
                x2="660"
                :y1="store.heatmapY(armor)"
                :y2="store.heatmapY(armor)"
              />
              <line
                v-for="(segment, index) in heatmapHpContour"
                :key="`hm-hp-${index}`"
                class="heatmap-contour"
                :x1="segment.x1"
                :y1="segment.y1"
                :x2="segment.x2"
                :y2="segment.y2"
              />
            </g>
            <text
              v-for="power in [0, 25, 50, 75, 100, 125, 150]"
              :key="`hm-xl-${power}`"
              class="axis-label"
              :x="store.heatmapX(power)"
              y="300"
              text-anchor="middle"
            >
              {{ power }}
            </text>
            <text
              v-for="armor in [0, 25, 50, 75, 100]"
              :key="`hm-yl-${armor}`"
              class="axis-label"
              x="-12"
              :y="store.heatmapY(armor) + 4"
              text-anchor="end"
            >
              {{ armor }}
            </text>
            <text class="axis-title" x="330" y="334" text-anchor="middle">Weapon power</text>
            <text
              class="axis-title"
              x="-42"
              y="135"
              text-anchor="middle"
              transform="rotate(-90 -42 135)"
            >
              Armor
            </text>
            <line
              v-if="inspectedHeatmapCell"
              class="hover-line"
              :x1="store.heatmapX(inspectedHeatmapCell.power)"
              :x2="store.heatmapX(inspectedHeatmapCell.power)"
              y1="0"
              y2="270"
            />
            <line
              v-if="inspectedHeatmapCell"
              class="hover-line"
              x1="0"
              x2="660"
              :y1="store.heatmapY(inspectedHeatmapCell.armor)"
              :y2="store.heatmapY(inspectedHeatmapCell.armor)"
            />
            <circle
              v-if="inspectedHeatmapCell"
              class="heatmap-inspect-dot"
              r="5"
              :cx="store.heatmapX(inspectedHeatmapCell.power)"
              :cy="store.heatmapY(inspectedHeatmapCell.armor)"
            />
            <g
              v-if="inspectedHeatmapCell"
              class="chart-tooltip heatmap-tooltip"
              :transform="`translate(${store.heatmapTooltipX()} ${store.heatmapTooltipY()})`"
            >
              <rect width="160" height="62" rx="6"></rect>
              <text x="9" y="14">Power {{ inspectedHeatmapCell.power }}</text>
              <text x="9" y="28">Armor {{ inspectedHeatmapCell.armor }}</text>
              <text x="9" y="42">
                Selected {{ store.formatDamage(inspectedHeatmapCell.expectedMetric) }}
              </text>
              <text x="9" y="55">
                HP {{ store.formatDamage(inspectedHeatmapCell.expectedHp) }} | HP+Stun
                {{ store.formatDamage(inspectedHeatmapCell.expectedTotal) }}
              </text>
            </g>
          </g>
        </svg>
      </div>
    </section>

    <div class="damage-type-grid">
      <article
        v-for="damageType in editableDamageTypes"
        :key="damageType.id"
        class="damage-type-card"
        :class="{ active: selectedDamageTypeId === damageType.id }"
        :style="{ backgroundColor: store.subtleColor(damageType.color) }"
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
                  : `${store.percentField(damageType.armorEffectiveness)}%`
              }}
            </dd>
          </div>
          <div>
            <dt>HP</dt>
            <dd>{{ store.percentField(damageType.hpDamagePercent) }}%{{ damageType.hpDamageRandomized ? " rng" : "" }}</dd>
          </div>
          <div>
            <dt>Stun</dt>
            <dd>{{ store.percentField(damageType.stunDamagePercent) }}%{{ damageType.stunDamageRandomized ? " rng" : "" }}</dd>
          </div>
          <div v-for="component in damageComponentOptions.slice(2)" :key="component.key">
            <dt>{{ component.label }}</dt>
            <dd>
              {{ store.percentField(store.componentPercent(damageType, component.key)) }}%{{
                store.componentRandomized(damageType, component.key) ? " rng" : ""
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
