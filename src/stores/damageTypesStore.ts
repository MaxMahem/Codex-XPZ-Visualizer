import { defineStore } from "pinia";
import { computed, reactive, ref } from "vue";
import { damageTypes } from "../data";
import type { DamageComponentKey, DamageType, TranslationMap } from "../types";
import { translatedDamageTypeName } from "../utils/damageTypeTranslations";

export const damageComponentOptions: Array<{ key: DamageComponentKey; label: string }> = [
  { key: "hp", label: "HP" },
  { key: "stun", label: "Stun" },
  { key: "morale", label: "Morale" },
  { key: "armor", label: "Armor" },
  { key: "preArmor", label: "Pre Armor" },
  { key: "tu", label: "TU" },
  { key: "energy", label: "Energy" },
  { key: "mana", label: "Mana" },
];

export const useDamageTypesStore = defineStore('damageTypes', () => {
  const baseDamageTypes = reactive<DamageType[]>(damageTypes.map(dt => ({ ...dt })));
  
  // Reactive custom types
  const customDamageTypes = reactive<DamageType[]>([]);

  const allDamageTypes = computed(() => [...baseDamageTypes, ...customDamageTypes]);
  
  const selectedDamageTypeId = ref(baseDamageTypes[0].id);

  const selectedDamageType = computed(
    () =>
      allDamageTypes.value.find((dt) => dt.id === selectedDamageTypeId.value) ??
      baseDamageTypes[0],
  );

  const isCustomSelected = computed(() => 
    customDamageTypes.some(dt => dt.id === selectedDamageTypeId.value)
  );

  function addDamageType(): void {
    const nextNumber = allDamageTypes.value.length + 1;
    const id = `custom-${Date.now()}`;
    customDamageTypes.push({
      id,
      name: `Custom Type ${nextNumber}`,
      armorEffectiveness: 1,
      armorEffectivenessScalesWithPower: false,
      damageComponents: Object.fromEntries(
        damageComponentOptions.map(opt => [
          opt.key,
          {
            type: opt.key,
            percent: opt.key === "hp" ? 1 : opt.key === "stun" ? 0.25 : 0,
            randomized: opt.key === "stun"
          }
        ])
      ) as Record<DamageComponentKey, any>,
      randomProfileId: "0-200",
      color: "#6f7f90",
    });
    selectedDamageTypeId.value = id;
  }

  function removeDamageType(id: string): void {
    const index = customDamageTypes.findIndex(dt => dt.id === id);
    if (index !== -1) {
      customDamageTypes.splice(index, 1);
      if (selectedDamageTypeId.value === id) {
        selectedDamageTypeId.value = baseDamageTypes[0].id;
      }
    }
  }

  // Helper to get mutable version of selected type (only if it's custom)
  function getMutableSelected() {
    if (!isCustomSelected.value) {
      console.warn(`[DamageTypesStore] Attempted to modify immutable base damage type: ${selectedDamageType.value.name}`);
      return null;
    }
    return customDamageTypes.find(dt => dt.id === selectedDamageTypeId.value);
  }

  function setArmorEffectiveness(value: number): void {
    const target = getMutableSelected();
    if (target) target.armorEffectiveness = (Number.isFinite(value) ? value : 0) / 100;
  }

  function componentPercent(damageType: DamageType, component: DamageComponentKey): number {
    return damageType.damageComponents[component].percent;
  }

  function setComponentPercent(component: DamageComponentKey, value: number): void {
    const target = getMutableSelected();
    if (target) target.damageComponents[component].percent = (Number.isFinite(value) ? value : 0) / 100;
  }

  function componentRandomized(damageType: DamageType, component: DamageComponentKey): boolean {
    return !!damageType.damageComponents[component].randomized;
  }

  function setComponentRandomized(component: DamageComponentKey, value: boolean): void {
    const target = getMutableSelected();
    if (target) target.damageComponents[component].randomized = value;
  }

  function applyTranslations(translations: TranslationMap): void {
    for (const damageType of baseDamageTypes) {
      damageType.name = translatedDamageTypeName(damageType, translations);
    }
  }

  return {
    editableDamageTypes: allDamageTypes,
    customDamageTypes,
    selectedDamageTypeId,
    selectedDamageType,
    isCustomSelected,
    addDamageType,
    removeDamageType,
    setArmorEffectiveness,
    componentPercent,
    setComponentPercent,
    componentRandomized,
    setComponentRandomized,
    applyTranslations,
  };
});
