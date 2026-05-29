<script setup lang="ts">
import { ref } from "vue";
import { storeToRefs } from "pinia";
import { useComparisonStore } from "../stores/comparisonStore";
import { useInspectorStore } from "../stores/inspectorStore";
import { useScenarioStore } from "../stores/scenarioStore";
import { useWeaponsStore } from "../stores/weaponsStore";
import { useDamageTypesStore, damageComponentOptions } from "../stores/damageTypesStore";
import { randomProfiles } from "../data";
import { modifiedPower, damageTypeFor, computeDamageBonus, DAMAGE_BONUS_STATS, getDamageComponent } from "../damage";
import type { WeaponSystem, DamageComponentKey } from "../types";
import { formatDamage } from "../utils/formatters";
import ColorPicker from "./ColorPicker.vue";
import PercentInput from "./PercentInput.vue";

const scenarioStore = useScenarioStore();
const weaponsStore = useWeaponsStore();
const damageTypesStore = useDamageTypesStore();
const inspectorStore = useInspectorStore();
const comparisonStore = useComparisonStore();

const {
  importStatus,
  editableWeapons,
} = storeToRefs(weaponsStore);

const { focusedId } = storeToRefs(inspectorStore);

const {
  editableDamageTypes,
} = storeToRefs(damageTypesStore);

const {
  scenario,
} = storeToRefs(scenarioStore);

const expandedWeapons = ref<Record<string, boolean>>({});

function toggleWeaponDetails(id: string) {
  expandedWeapons.value[id] = !expandedWeapons.value[id];
}

function handleAddWeapon() {
  const id = weaponsStore.addWeapon();
  inspectorStore.setFocus(id);
  comparisonStore.toggleWeapon(id);
}

function handleClearWeapons() {
  weaponsStore.clearWeapons();
  inspectorStore.setFocus("");
  comparisonStore.clear();
}

function effectivePercent(weapon: WeaponSystem, key: DamageComponentKey): number {
  const override = weapon.damageModifierOverrides?.[key];
  if (override !== undefined) return override;
  const dt = damageTypeFor(weapon, editableDamageTypes.value);
  return getDamageComponent(dt, key).percent;
}

function hasPercentOverride(weapon: WeaponSystem, key: DamageComponentKey): boolean {
  return weapon.damageModifierOverrides?.[key] !== undefined;
}

function effectiveRandomized(weapon: WeaponSystem, key: DamageComponentKey): boolean {
  const override = weapon.damageRandomizedOverrides?.[key];
  if (override !== undefined) return override;
  const dt = damageTypeFor(weapon, editableDamageTypes.value);
  return !!getDamageComponent(dt, key).randomized;
}

function hasRandomizedOverride(weapon: WeaponSystem, key: DamageComponentKey): boolean {
  return weapon.damageRandomizedOverrides?.[key] !== undefined;
}

function effectiveArmorEffectiveness(weapon: WeaponSystem): number {
  const override = weapon.armorEffectivenessOverride;
  if (override !== undefined) return override;
  const dt = damageTypeFor(weapon, editableDamageTypes.value);
  if (dt.armorEffectivenessScalesWithPower) {
    return 1 + modifiedPower(weapon, scenario.value) / 100;
  }
  return dt.armorEffectiveness;
}

function hasArmorEffectivenessOverride(weapon: WeaponSystem): boolean {
  return weapon.armorEffectivenessOverride !== undefined;
}

function bonusPreview(weapon: WeaponSystem): string {
  const bonus = computeDamageBonus(weapon.damageBonus, scenario.value);
  if (bonus === 0 && weapon.damageBonus.length === 0) return "—";
  const sign = bonus >= 0 ? "+" : "";
  return `${sign}${Math.round(bonus * 100) / 100}`;
}

</script>

<template>
  <section class="chart-area weapon-editor-area" aria-label="Weapon data">
    <div class="chart-header">
      <div>
        <h2>Weapons &amp; Ammo</h2>
        <p>
          Edit weapon defaults used by the comparison and expected damage charts.
        </p>
      </div>
      <div class="damage-type-actions">
        <button
          class="add-button has-tip"
          type="button"
          data-tip="Remove all current weapon and ammo rows. Damage types are kept."
          @click="handleClearWeapons"
        >
          Clear Weapons
        </button>
      </div>
    </div>
    <p v-if="importStatus" class="import-status">{{ importStatus }}</p>

    <div class="weapon-table-wrap">
      <div class="weapon-edit-table" role="table" aria-label="Editable weapon stats">
        <div class="weapon-edit-row weapon-edit-head" role="row">
          <span class="has-tip" role="columnheader" tabindex="0" data-tip="Chart color. Click a row's circle to change it.">Color</span>
          <span class="has-tip" role="columnheader" tabindex="0" data-tip="Editable weapon or ammo display name.">Name</span>
          <span class="has-tip" role="columnheader" tabindex="0" data-tip="Damage type (switching resets all weapon-specific 'Alter' overrides to the new type's defaults).">Damage Type</span>
          <span class="has-tip" role="columnheader" tabindex="0" data-tip="Base item power before stat bonuses.">Base</span>
          <span class="has-tip" role="columnheader" tabindex="0" data-tip="AP armor multiplier. Imported from damageAlter.ArmorEffectiveness when present; otherwise inherited from the damage type. 50% means armor counts at half value.">AP %</span>
          <span class="has-tip" role="columnheader" tabindex="0" data-tip="Total power bonus from damage bonus entries for the current scenario stats.">Bonus</span>
          <span class="has-tip" role="columnheader" tabindex="0" data-tip="Editable final power after stat bonuses for the current scenario. Editing this adjusts Base.">Power</span>
          <span class="has-tip" role="columnheader" tabindex="0" data-tip="Primary damage roll profile. Default uses the selected damage type's profile.">Random</span>
          <span class="has-tip" role="columnheader" tabindex="0" data-tip="Toggle advanced damage alter settings">Alter</span>
        </div>
        <template v-for="weapon in editableWeapons" :key="weapon.id">
          <div
          class="weapon-edit-row"
          :class="{ active: focusedId === weapon.id }"
          role="row"
          :aria-selected="focusedId === weapon.id"
          tabindex="0"
          @pointerdown="inspectorStore.setFocus(weapon.id)"
          @click="inspectorStore.setFocus(weapon.id)"
          @focusin.capture="inspectorStore.setFocus(weapon.id)"
          @keydown.enter.prevent="inspectorStore.setFocus(weapon.id)"
          @keydown.space.prevent="inspectorStore.setFocus(weapon.id)"
        >
          <span role="cell">
            <ColorPicker
              v-model="weapon.color"
              tooltip="Click to change this weapon's chart color."
              title="Weapon chart color"
            />
          </span>
          <span role="cell">
            <input v-model="weapon.name" class="dense-input name-input" type="text" title="Weapon name" />
          </span>
          <span role="cell">
            <select
              :value="weapon.damageTypeId"
              class="dense-input"
              title="Damage type (switching resets all weapon-specific 'Alter' overrides to the new type's defaults)."
              @change="weaponsStore.setWeaponDamageType(weapon, ($event.target as HTMLSelectElement).value)"
            >
              <option v-for="damageType in editableDamageTypes" :key="damageType.id" :value="damageType.id">
                {{ damageType.name }}
              </option>
            </select>
          </span>
          <span role="cell">
            <input v-model.number="weapon.basePower" class="dense-input number-input" type="number" min="0" max="500" step="1" title="Base power" />
          </span>
          <span role="cell">
            <PercentInput
              :modelValue="effectiveArmorEffectiveness(weapon)"
              class="dense-input number-input"
              :class="{ 'alter-inherited': !hasArmorEffectivenessOverride(weapon) }"
              :max="500"
              :title="hasArmorEffectivenessOverride(weapon)
                ? 'AP percent from weapon damageAlter.ArmorEffectiveness'
                : `AP percent inherited from ${damageTypeFor(weapon, editableDamageTypes).name}`"
              @update:modelValue="weaponsStore.setWeaponArmorEffectivenessOverride(weapon, $event)"
            />
          </span>
          <span role="cell" class="readonly-cell" :title="`Damage bonus from ${weapon.damageBonus.length} stat entries`">
            {{ bonusPreview(weapon) }}
          </span>
          <span role="cell">
            <input
              :value="formatDamage(modifiedPower(weapon, scenario))"
              class="dense-input number-input"
              type="number"
              min="0"
              max="1000"
              step="1"
              title="Final power for the current scenario; editing adjusts base power."
              @input="weaponsStore.setWeaponModifiedPower(weapon, ($event.target as HTMLInputElement).valueAsNumber)"
            />
          </span>
          <span role="cell">
            <select
              :value="weapon.randomProfileIdOverride ?? 'default'"
              class="dense-input"
              title="Primary damage roll profile"
              @change="weaponsStore.setWeaponRandomProfile(weapon, ($event.target as HTMLSelectElement).value)"
            >
              <option value="default">Default ({{ randomProfiles.find(p => p.id === damageTypeFor(weapon, editableDamageTypes).randomProfileId)?.label ?? '0-200' }})</option>
              <option v-for="profile in randomProfiles" :key="profile.id" :value="profile.id">
                {{ profile.label }}
              </option>
            </select>
          </span>
          <span role="cell">
            <button
              class="dense-input"
              :class="{ active: expandedWeapons[weapon.id] }"
              type="button"
              title="Toggle advanced overrides"
              @pointerdown.stop
              @click.stop="toggleWeaponDetails(weapon.id)"
            >
              ⚙️
            </button>
          </span>
        </div>
        <div v-if="expandedWeapons[weapon.id]" class="weapon-edit-details">
          <div class="alter-inline">
            <template v-for="component in damageComponentOptions" :key="component.key">
              <span class="alter-label">{{ component.label }}</span>
              <PercentInput
                :modelValue="effectivePercent(weapon, component.key)"
                placeholder="—"
                class="alter-input"
                :class="{ 'alter-inherited': !hasPercentOverride(weapon, component.key) }"
                :title="hasPercentOverride(weapon, component.key)
                  ? `${component.label} damage % (overridden)`
                  : `${component.label} damage % (inherited from ${damageTypeFor(weapon, editableDamageTypes).name})`"
                @update:modelValue="weaponsStore.setWeaponDamageModifierOverride(weapon, component.key, $event)"
              />
              <input
                type="checkbox"
                class="alter-check"
                :class="{ 'alter-inherited': !hasRandomizedOverride(weapon, component.key) }"
                :checked="effectiveRandomized(weapon, component.key)"
                :title="hasRandomizedOverride(weapon, component.key)
                  ? `${component.label} RNG (overridden)`
                  : `${component.label} RNG (inherited from ${damageTypeFor(weapon, editableDamageTypes).name})`"
                @pointerdown.stop
                @change.stop="weaponsStore.setWeaponDamageRandomizedOverride(weapon, component.key, ($event.target as HTMLInputElement).checked)"
              />
            </template>
          </div>

          <div class="bonus-section">
            <div class="bonus-header">
              <span class="bonus-title">Damage Bonus</span>
              <span class="bonus-preview" v-if="weapon.damageBonus.length > 0">
                Total: <strong>{{ bonusPreview(weapon) }}</strong>
              </span>
            </div>
            <div class="bonus-list" v-if="weapon.damageBonus.length > 0">
              <div class="bonus-list-head">
                <span>Stat</span>
                <span>×s</span>
                <span>×s²</span>
                <span>×s³</span>
                <span></span>
              </div>
              <div v-for="(entry, index) in weapon.damageBonus" :key="index" class="bonus-row">
                <select
                  :value="entry.stat"
                  class="bonus-select"
                  title="Stat attribute for this bonus entry"
                  @pointerdown.stop
                  @change.stop="weaponsStore.setWeaponDamageBonusStat(weapon, index, ($event.target as HTMLSelectElement).value as any)"
                >
                  <option v-for="stat in DAMAGE_BONUS_STATS" :key="stat.key" :value="stat.key">
                    {{ stat.label }}
                  </option>
                </select>
                <input
                  :value="entry.coefficients[0]"
                  class="bonus-coeff"
                  type="number"
                  step="0.01"
                  title="Linear coefficient (×s)"
                  @pointerdown.stop
                  @input.stop="weaponsStore.setWeaponDamageBonusCoefficient(weapon, index, 0, ($event.target as HTMLInputElement).valueAsNumber)"
                />
                <input
                  :value="entry.coefficients[1]"
                  class="bonus-coeff"
                  type="number"
                  step="0.001"
                  title="Quadratic coefficient (×s²)"
                  @pointerdown.stop
                  @input.stop="weaponsStore.setWeaponDamageBonusCoefficient(weapon, index, 1, ($event.target as HTMLInputElement).valueAsNumber)"
                />
                <input
                  :value="entry.coefficients[2]"
                  class="bonus-coeff"
                  type="number"
                  step="0.0001"
                  title="Cubic coefficient (×s³)"
                  @pointerdown.stop
                  @input.stop="weaponsStore.setWeaponDamageBonusCoefficient(weapon, index, 2, ($event.target as HTMLInputElement).valueAsNumber)"
                />
                <button
                  class="bonus-remove"
                  type="button"
                  title="Remove this bonus entry"
                  @pointerdown.stop
                  @click.stop="weaponsStore.removeWeaponDamageBonus(weapon, index)"
                >✕</button>
              </div>
            </div>
            <button
              class="bonus-add-btn"
              type="button"
              title="Add a new stat-based damage bonus entry"
              @pointerdown.stop
              @click.stop="weaponsStore.addWeaponDamageBonus(weapon)"
            >+ Add Bonus</button>
          </div>
        </div>
      </template>
      <button class="weapon-add-row has-tip" type="button" data-tip="Create a new editable weapon row." @click="handleAddWeapon">
          Add Weapon
        </button>
      </div>
    </div>
  </section>
</template>
