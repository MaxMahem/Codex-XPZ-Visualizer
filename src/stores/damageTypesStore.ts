import { defineStore } from "pinia";
import { computed, reactive, ref } from "vue";
import { damageTypes } from "../data";
import type { DamageComponentKey, DamageType } from "../types";

export const damageComponentOptions: Array<{ key: DamageComponentKey; label: string }> = [
  { key: "hp", label: "HP" },
  { key: "stun", label: "Stun" },
  { key: "morale", label: "Morale" },
  { key: "armor", label: "Armor" },
  { key: "tu", label: "TU" },
  { key: "energy", label: "Energy" },
  { key: "mana", label: "Mana" },
];

export const useDamageTypesStore = defineStore('damageTypes', () => {
  const editableDamageTypes = reactive<DamageType[]>([
    ...damageTypes.map((damageType) => ({ ...damageType })),
  ]);
  const selectedDamageTypeId = ref(damageTypes[0]?.id ?? "0-none");

  const selectedDamageType = computed(
    () =>
      editableDamageTypes.find((damageType) => damageType.id === selectedDamageTypeId.value) ??
      editableDamageTypes[0],
  );

  function addDamageType(): void {
    const nextNumber = editableDamageTypes.length + 1;
    const id = `custom-${Date.now()}`;
    editableDamageTypes.push({
      id,
      name: `Custom Type ${nextNumber}`,
      armorEffectiveness: 1,
      armorEffectivenessScalesWithPower: false,
      hpDamagePercent: 1,
      hpDamageRandomized: false,
      stunDamagePercent: 0.25,
      stunDamageRandomized: true,
      moraleDamagePercent: 0,
      moraleDamageRandomized: false,
      armorDamagePercent: 0,
      armorDamageRandomized: false,
      tuDamagePercent: 0,
      tuDamageRandomized: false,
      energyDamagePercent: 0,
      energyDamageRandomized: false,
      manaDamagePercent: 0,
      manaDamageRandomized: false,
      randomProfileId: "0-200",
      color: "#6f7f90",
    });
    selectedDamageTypeId.value = id;
  }

  function setArmorEffectiveness(value: number): void {
    selectedDamageType.value.armorEffectiveness = (Number.isFinite(value) ? value : 0) / 100;
  }

  function setHpDamagePercent(value: number): void {
    selectedDamageType.value.hpDamagePercent = (Number.isFinite(value) ? value : 0) / 100;
  }

  function setStunDamagePercent(value: number): void {
    selectedDamageType.value.stunDamagePercent = (Number.isFinite(value) ? value : 0) / 100;
  }

  function componentPercent(damageType: DamageType, component: DamageComponentKey): number {
    return (damageType as any)[`${component}DamagePercent`];
  }

  function setComponentPercent(component: DamageComponentKey, value: number): void {
    (selectedDamageType.value as any)[`${component}DamagePercent`] = (Number.isFinite(value) ? value : 0) / 100;
  }

  function componentRandomized(damageType: DamageType, component: DamageComponentKey): boolean {
    return (damageType as any)[`${component}DamageRandomized`];
  }

  function setComponentRandomized(component: DamageComponentKey, value: boolean): void {
    (selectedDamageType.value as any)[`${component}DamageRandomized`] = value;
  }

  return {
    editableDamageTypes,
    selectedDamageTypeId,
    selectedDamageType,
    addDamageType,
    setArmorEffectiveness,
    setHpDamagePercent,
    setStunDamagePercent,
    componentPercent,
    setComponentPercent,
    componentRandomized,
    setComponentRandomized,
  };
});
