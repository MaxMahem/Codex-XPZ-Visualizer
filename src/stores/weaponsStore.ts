import { defineStore } from "pinia";
import { computed, reactive, ref } from "vue";
import { damageTypes } from "../data";
import defaultItemsRul from "../data/default-items.rul?raw";
import { computeDamageBonus } from "../damage";
import { importOpenXcomItems } from "../rulImport";
import type { DamageBonusStat, DamageComponentKey, WeaponSystem } from "../types";
import { useDamageTypesStore } from "./damageTypesStore";
import { useScenarioStore } from "./scenarioStore";

export const useWeaponsStore = defineStore('weapons', () => {
  const damageTypesStore = useDamageTypesStore();
  const scenarioStore = useScenarioStore();

  const shippedImport = importOpenXcomItems(
    defaultItemsRul,
    damageTypes,
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
  const selectedIds = ref<string[]>(shippedWeapons.slice(0, 3).map((weapon) => weapon.id));
  const selectedWeaponId = ref(shippedWeapons[0]?.id ?? "");
  const rollWeaponId = ref(shippedWeapons[0]?.id ?? "");
  const importStatus = ref("");

  const selectedWeapons = computed(() =>
    editableWeapons.filter((weapon) => selectedIds.value.includes(weapon.id)),
  );

  const rollWeapon = computed(
    () => editableWeapons.find((weapon) => weapon.id === selectedWeaponId.value) ?? editableWeapons[0] ?? fallbackWeapon,
  );

  function toggleWeapon(id: string): void {
    if (selectedIds.value.includes(id)) {
      selectedIds.value = selectedIds.value.filter((selected) => selected !== id);
      return;
    }
    selectedIds.value = [...selectedIds.value, id];
  }

  function selectWeapon(id: string): void {
    selectedWeaponId.value = id;
    rollWeaponId.value = id;
  }

  function addWeapon(): void {
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
    selectedWeaponId.value = id;
    rollWeaponId.value = id;
    selectedIds.value = [...selectedIds.value, id];
  }

  function clearWeapons(): void {
    editableWeapons.splice(0, editableWeapons.length);
    selectedIds.value = [];
    selectedWeaponId.value = "";
    rollWeaponId.value = "";
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

  async function importItemsFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    const text = await file.text();
    const imported = importOpenXcomItems(
      text,
      damageTypesStore.editableDamageTypes,
    );

    editableWeapons.push(...imported.weapons);
    selectedIds.value = [...new Set([...selectedIds.value, ...imported.weapons.map((weapon) => weapon.id)])];
    if (imported.weapons[0]) {
      selectedWeaponId.value = imported.weapons[0].id;
      rollWeaponId.value = imported.weapons[0].id;
    }
    importStatus.value = `Imported ${imported.weapons.length} powered items.`;
    input.value = "";
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

  return {
    shippedWeapons,
    fallbackWeapon,
    editableWeapons,
    selectedIds,
    selectedWeaponId,
    rollWeaponId,
    importStatus,
    selectedWeapons,
    rollWeapon,
    toggleWeapon,
    selectWeapon,
    addWeapon,
    clearWeapons,
    setWeaponModifiedPower,
    addWeaponDamageBonus,
    removeWeaponDamageBonus,
    setWeaponDamageBonusStat,
    setWeaponDamageBonusCoefficient,
    importItemsFile,
    setWeaponArmorPenetration,
    setWeaponRandomProfile,
    setWeaponArmorEffectivenessOverride,
    setWeaponDamageModifierOverride,
    setWeaponDamageRandomizedOverride,
    setWeaponDamageType,
  };
});
