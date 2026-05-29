import { defineStore } from "pinia";
import { computed, reactive } from "vue";
import { damageTypes } from "../data";
import type { DamageComponentKey, DamageType } from "../types";

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
  // Frozen base types from static data
  const baseDamageTypes = Object.freeze(damageTypes.map(dt => Object.freeze({ ...dt })));
  
  // Reactive custom types
  const customDamageTypes = reactive<DamageType[]>([]);

  const allDamageTypes = computed(() => [...baseDamageTypes, ...customDamageTypes]);
  
  function addDamageType(): string {
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
    return id;
  }

  function removeDamageType(id: string): void {
    const index = customDamageTypes.findIndex(dt => dt.id === id);
    if (index !== -1) {
      customDamageTypes.splice(index, 1);
    }
  }

  function getMutableDamageType(id: string) {
    const target = customDamageTypes.find(dt => dt.id === id);
    if (!target) {
      const damageType = allDamageTypes.value.find((dt) => dt.id === id);
      console.warn(`[DamageTypesStore] Attempted to modify immutable base damage type: ${damageType?.name ?? id}`);
      return null;
    }
    return target;
  }

  function setArmorEffectiveness(id: string, value: number): void {
    const target = getMutableDamageType(id);
    if (target) target.armorEffectiveness = (Number.isFinite(value) ? value : 0) / 100;
  }

  function componentPercent(damageType: DamageType, component: DamageComponentKey): number {
    return damageType.damageComponents[component].percent;
  }

  function setComponentPercent(id: string, component: DamageComponentKey, value: number): void {
    const target = getMutableDamageType(id);
    if (target) target.damageComponents[component].percent = (Number.isFinite(value) ? value : 0) / 100;
  }

  function componentRandomized(damageType: DamageType, component: DamageComponentKey): boolean {
    return !!damageType.damageComponents[component].randomized;
  }

  function setComponentRandomized(id: string, component: DamageComponentKey, value: boolean): void {
    const target = getMutableDamageType(id);
    if (target) target.damageComponents[component].randomized = value;
  }

  return {
    editableDamageTypes: allDamageTypes,
    customDamageTypes,
    addDamageType,
    removeDamageType,
    setArmorEffectiveness,
    componentPercent,
    setComponentPercent,
    componentRandomized,
    setComponentRandomized,
  };
});
