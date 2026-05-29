import { defineStore } from "pinia";
import { computed, reactive, ref } from "vue";
import { damageTypes, defaultState } from "../data";
import defaultItemsRul from "../data/datasets/xcom1/items.rul?raw";
import { computeDamageBonus } from "../damage";
import { importOpenXcomItems } from "../rulImport";
import type { DamageBonusStat, DamageComponentKey, TranslationMap, WeaponSystem } from "../types";
import { useComparisonStore } from "./comparisonStore";
import { useDamageTypesStore } from "./damageTypesStore";
import { useInspectorStore } from "./inspectorStore";
import { useScenarioStore } from "./scenarioStore";

export const useWeaponsStore = defineStore('weapons', () => {
  const damageTypesStore = useDamageTypesStore();
  const comparisonStore = useComparisonStore();
  const inspectorStore = useInspectorStore();
  const scenarioStore = useScenarioStore();

  const shippedImport = importOpenXcomItems(
    defaultItemsRul,
    damageTypes,
    scenarioStore.translations,
  );
  const shippedWeapons = shippedImport.weapons;

  const fallbackWeapon: WeaponSystem = {
    id: "fallback-weapon",
    name: "No Weapon",
    category: "Fallback",
    damageTypeId: damageTypes[0]?.id ?? "0-none",
    basePower: 0,
    armorPenetration: 0,
    damageBonus: [],
    color: "#6f7f90",
  };

  const editableWeapons = reactive<WeaponSystem[]>(shippedWeapons.map((weapon) => ({ ...weapon })));
  const importStatus = ref("");

  const defaultSelectedIds = defaultWeaponIds(defaultState.selectedWeaponTypes ?? [], editableWeapons);
  if (comparisonStore.selectedIds.length === 0) {
    comparisonStore.selectedIds = defaultSelectedIds;
  }
  if (!inspectorStore.focusedId) {
    inspectorStore.setFocus(
      weaponIdForType(defaultState.focusedWeaponType, editableWeapons) ??
      defaultSelectedIds[0] ??
      editableWeapons[0]?.id ??
      "",
    );
  }

  function addWeapon(): string {
    const nextNumber = editableWeapons.length + 1;
    const id = `custom-weapon-${Date.now()}`;
    const damageTypeId = damageTypesStore.editableDamageTypes[0]?.id ?? "0-none";
    editableWeapons.push({
      id,
      name: `Custom Weapon ${nextNumber}`,
      category: "Custom",
      damageTypeId,
      basePower: 50,
      armorPenetration: 0,
      damageBonus: [],
      color: "#6f7f90",
    });
    return id;
  }

  function clearWeapons(): void {
    editableWeapons.splice(0, editableWeapons.length);
    importStatus.value = "Cleared all weapons/items. Damage type defaults are still available.";
  }

  function setWeaponModifiedPower(weapon: WeaponSystem, value: number): void {
    const desiredPower = Number.isFinite(value) ? value : 0;
    weapon.basePower = Math.round(
      desiredPower - computeDamageBonus(weapon.damageBonus, scenarioStore.scenario),
    );
  }

  function addWeaponDamageBonus(weapon: WeaponSystem): void {
    weapon.damageBonus.push({ stat: "strength", coefficients: [0, 0, 0] });
  }

  function removeWeaponDamageBonus(weapon: WeaponSystem, index: number): void {
    weapon.damageBonus.splice(index, 1);
  }

  function setWeaponDamageBonusStat(weapon: WeaponSystem, index: number, stat: DamageBonusStat): void {
    weapon.damageBonus[index].stat = stat;
  }

  function setWeaponDamageBonusCoefficient(weapon: WeaponSystem, index: number, degree: 0 | 1 | 2, value: number): void {
    weapon.damageBonus[index].coefficients[degree] = Number.isFinite(value) ? value : 0;
  }

  async function importItemsFile(event: Event): Promise<WeaponSystem[]> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return [];
    }

    const importedWeapons = importItemsText(await file.text());
    importStatus.value = `Imported ${importedWeapons.length} powered items.`;
    input.value = "";
    return importedWeapons;
  }

  function importItemsText(text: string): WeaponSystem[] {
    const imported = importOpenXcomItems(
      text,
      damageTypesStore.editableDamageTypes,
      scenarioStore.translations,
    );

    editableWeapons.push(...imported.weapons);
    return imported.weapons;
  }

  function setWeaponArmorPenetration(weapon: WeaponSystem, value: number): void {
    weapon.armorPenetration = (Number.isFinite(value) ? value : 0) / 100;
  }

  function setWeaponRandomProfile(weapon: WeaponSystem, value: string): void {
    weapon.randomProfileIdOverride = value === "default" ? undefined : value;
  }

  function setWeaponArmorEffectivenessOverride(weapon: WeaponSystem, value: number | undefined): void {
    if (value === undefined) {
      delete weapon.armorEffectivenessOverride;
      return;
    }
    weapon.armorEffectivenessOverride = value;
  }

  function setWeaponDamageModifierOverride(weapon: WeaponSystem, component: DamageComponentKey, value: number | undefined): void {
    if (value === undefined) {
      if (weapon.damageModifierOverrides) {
        delete weapon.damageModifierOverrides[component];
      }
    } else {
      weapon.damageModifierOverrides ??= {};
      weapon.damageModifierOverrides[component] = value;
    }
  }

  function setWeaponDamageRandomizedOverride(weapon: WeaponSystem, component: DamageComponentKey, value: boolean | undefined): void {
    if (value === undefined) {
      if (weapon.damageRandomizedOverrides) {
        delete weapon.damageRandomizedOverrides[component];
      }
    } else {
      weapon.damageRandomizedOverrides ??= {};
      weapon.damageRandomizedOverrides[component] = value;
    }
  }

  function setWeaponDamageType(weapon: WeaponSystem, typeId: string): void {
    weapon.damageTypeId = typeId;
    // Reset all overrides when the base damage type changes
    delete weapon.damageModifierOverrides;
    delete weapon.damageRandomizedOverrides;
    delete weapon.randomProfileIdOverride;
    delete weapon.armorEffectivenessOverride;
  }

  function applyTranslations(translations: TranslationMap): void {
    for (const weapon of editableWeapons) {
      if (weapon.sourceType) {
        weapon.name = displayName(weapon.sourceType, translations);
      }
    }
  }

  return {
    shippedWeapons,
    fallbackWeapon,
    editableWeapons,
    importStatus,
    addWeapon,
    clearWeapons,
    setWeaponModifiedPower,
    addWeaponDamageBonus,
    removeWeaponDamageBonus,
    setWeaponDamageBonusStat,
    setWeaponDamageBonusCoefficient,
    importItemsFile,
    importItemsText,
    setWeaponArmorPenetration,
    setWeaponRandomProfile,
    setWeaponArmorEffectivenessOverride,
    setWeaponDamageModifierOverride,
    setWeaponDamageRandomizedOverride,
    setWeaponDamageType,
    applyTranslations,
  };
});

function defaultWeaponIds(types: string[], weapons: WeaponSystem[]): string[] {
  return types.flatMap((type) => {
    const id = weaponIdForType(type, weapons);
    return id ? [id] : [];
  });
}

function weaponIdForType(type: string | undefined, weapons: WeaponSystem[]): string | undefined {
  if (!type) return undefined;
  return weapons.find((weapon) => weapon.sourceType === type || weapon.id === type)?.id;
}

function displayName(key: string, translations: TranslationMap): string {
  return translations[key] ?? key
    .replace(/^STR_/, "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (match: string) => match.toUpperCase());
}
