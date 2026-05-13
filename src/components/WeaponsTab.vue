<script setup lang="ts">
import { ref } from "vue";
import { storeToRefs } from "pinia";
import { useAppStore, damageComponentOptions } from "../stores/appStore";
import { randomProfiles } from "../data";
import { modifiedPower, damageTypeFor } from "../damage";
import type { WeaponSystem, DamageComponentKey } from "../types";
import ColorPicker from "./ColorPicker.vue";
import PercentInput from "./PercentInput.vue";

const store = useAppStore();
const {
  importStatus,
  editableWeapons,
  selectedWeaponId,
  selectedIds,
  editableDamageTypes,
  scenario,
} = storeToRefs(store);

const expandedWeapons = ref<Record<string, boolean>>({});

function toggleWeaponDetails(id: string) {
  expandedWeapons.value[id] = !expandedWeapons.value[id];
}

function effectivePercent(weapon: WeaponSystem, key: DamageComponentKey): number {
  const override = weapon.damageModifierOverrides?.[key];
  if (override !== undefined) return override;
  const dt = damageTypeFor(weapon, editableDamageTypes.value);
  return dt[`${key}DamagePercent`];
}

function hasPercentOverride(weapon: WeaponSystem, key: DamageComponentKey): boolean {
  return weapon.damageModifierOverrides?.[key] !== undefined;
}

function effectiveRandomized(weapon: WeaponSystem, key: DamageComponentKey): boolean {
  const override = weapon.damageRandomizedOverrides?.[key];
  if (override !== undefined) return override;
  const dt = damageTypeFor(weapon, editableDamageTypes.value);
  return dt[`${key}DamageRandomized`];
}

function hasRandomizedOverride(weapon: WeaponSystem, key: DamageComponentKey): boolean {
  return weapon.damageRandomizedOverrides?.[key] !== undefined;
}


</script>

<template>
  <section class="chart-area weapon-editor-area" aria-label="Weapon data">
    <div class="chart-header">
      <div>
        <h2>Weapons & Ammo</h2>
        <p>
          Edit weapon defaults used by the comparison and expected damage charts.
        </p>
      </div>
      <div class="damage-type-actions">
        <label
          class="import-button has-tip"
          data-tip="Import powered OpenXcom item or ammo entries from a .rul YAML file."
        >
          Import Items
          <input type="file" accept=".rul,.yml,.yaml,text/yaml,text/plain" @change="store.importItemsFile" />
        </label>
        <button
          class="add-button has-tip"
          type="button"
          data-tip="Remove all current weapon and ammo rows. Damage types are kept."
          @click="store.clearWeapons"
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
          <span class="has-tip" role="columnheader" tabindex="0" data-tip="Base item power before strength and melee bonuses.">Base</span>
          <span class="has-tip" role="columnheader" tabindex="0" data-tip="Percent of armor ignored before armor is subtracted.">Armor Pen %</span>
          <span class="has-tip" role="columnheader" tabindex="0" data-tip="Power added per point of scenario Strength.">STR</span>
          <span class="has-tip" role="columnheader" tabindex="0" data-tip="Power added per point of scenario Melee.">Melee</span>
          <span class="has-tip" role="columnheader" tabindex="0" data-tip="Editable final power after stat bonuses for the current scenario. Editing this adjusts Base.">Power</span>
          <span class="has-tip" role="columnheader" tabindex="0" data-tip="Primary damage roll profile. Default uses the selected damage type's profile.">Random</span>
          <span class="has-tip" role="columnheader" tabindex="0" data-tip="Toggle advanced damage alter settings">Alter</span>
        </div>
        <template v-for="weapon in editableWeapons" :key="weapon.id">
          <div
          class="weapon-edit-row"
          :class="{ active: selectedWeaponId === weapon.id }"
          role="row"
          :aria-selected="selectedWeaponId === weapon.id"
          tabindex="0"
          @pointerdown="store.selectWeapon(weapon.id)"
          @click="store.selectWeapon(weapon.id)"
          @focusin.capture="store.selectWeapon(weapon.id)"
          @keydown.enter.prevent="store.selectWeapon(weapon.id)"
          @keydown.space.prevent="store.selectWeapon(weapon.id)"
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
              @change="store.setWeaponDamageType(weapon, ($event.target as HTMLSelectElement).value)"
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
              :modelValue="weapon.armorPenetration"
              class="dense-input number-input"
              :max="100"
              title="Armor penetration percent"
              @update:modelValue="store.setWeaponArmorPenetration(weapon, $event ?? 0)"
            />
          </span>
          <span role="cell">
            <input v-model.number="weapon.strengthBonus" class="dense-input number-input" type="number" min="0" max="10" step="0.05" title="Strength power bonus" />
          </span>
          <span role="cell">
            <input v-model.number="weapon.meleeBonus" class="dense-input number-input" type="number" min="0" max="10" step="0.05" title="Melee power bonus" />
          </span>
          <span role="cell">
            <input
              :value="store.formatDamage(modifiedPower(weapon, scenario))"
              class="dense-input number-input"
              type="number"
              min="0"
              max="1000"
              step="1"
              title="Final power for the current scenario; editing adjusts base power."
              @input="store.setWeaponModifiedPower(weapon, ($event.target as HTMLInputElement).valueAsNumber)"
            />
          </span>
          <span role="cell">
            <select
              :value="weapon.randomProfileIdOverride ?? 'default'"
              class="dense-input"
              title="Primary damage roll profile"
              @change="store.setWeaponRandomProfile(weapon, ($event.target as HTMLSelectElement).value)"
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
                @update:modelValue="store.setWeaponDamageModifierOverride(weapon, component.key, $event)"
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
                @change.stop="store.setWeaponDamageRandomizedOverride(weapon, component.key, ($event.target as HTMLInputElement).checked)"
              />
            </template>
          </div>
        </div>
      </template>
      <button class="weapon-add-row has-tip" type="button" data-tip="Create a new editable weapon row." @click="store.addWeapon">
          Add Weapon
        </button>
      </div>
    </div>
  </section>
</template>
