import { defineStore } from "pinia";
import { computed, reactive, ref } from "vue";
import { defaultScenario, defaultState } from "../data";
import { useLibraryStore } from "./libraryStore";
import { damageModifiersForArmor } from "./scenarioStoreHelpers";
import type { ArmorDefinition, ArmorSide, TargetStats } from "../types";

export const useTargetStore = defineStore("target", () => {
  const libraryStore = useLibraryStore();

  const stats = reactive<TargetStats>({
    hitPoints: defaultScenario.hitPoints,
    targetBravery: defaultScenario.targetBravery,
    armor: defaultScenario.armor,
    armorEffectiveness: defaultScenario.armorEffectiveness,
    targetDamageModifiers: undefined as number[] | undefined,
  });

  const selectedTargetUnitId = ref("");
  const selectedTargetArmorId = ref("");
  const targetArmorSide = ref<ArmorSide>(defaultState.targetArmorSide ?? "side");

  const targetPresets = computed(() => [...libraryStore.soldierPresets, ...libraryStore.units]);
  const targetArmors = computed(() => libraryStore.armors);

  const selectedTargetPreset = computed(() =>
    targetPresets.value.find((candidate) => candidate.id === selectedTargetUnitId.value),
  );

  const selectedTargetArmor = computed(() =>
    targetArmors.value.find((candidate) => candidate.id === selectedTargetArmorId.value),
  );

  const currentArmor = computed(() => Math.round(stats.armor));

  function applyTargetUnit(unitId: string): void {
    selectedTargetUnitId.value = unitId;
    const unit = targetPresets.value.find((candidate) => candidate.id === unitId);
    if (!unit) return;

    stats.hitPoints = unit.stats.health;
    stats.targetBravery = unit.stats.bravery;
    if (unit.armorId) {
      applyTargetArmor(unit.armorId);
    }
  }

  function applyTargetUnitByType(unitType: string): void {
    const unit = targetPresets.value.find((candidate) => candidate.type === unitType);
    if (unit) {
      applyTargetUnit(unit.id);
    }
  }

  function applyTargetArmor(armorId: string): void {
    selectedTargetArmorId.value = armorId;
    const armor = targetArmors.value.find((candidate) => candidate.id === armorId);
    if (!armor) {
      stats.targetDamageModifiers = damageModifiersForArmor(undefined);
      return;
    }

    stats.targetDamageModifiers = damageModifiersForArmor(armor);
    stats.armor = armorValueForSide(armor, targetArmorSide.value);
  }

  function setTargetArmorSide(side: ArmorSide): void {
    targetArmorSide.value = side;
    if (selectedTargetArmorId.value) {
      applyTargetArmor(selectedTargetArmorId.value);
    }
  }

  function clearSelection(): void {
    selectedTargetUnitId.value = "";
    selectedTargetArmorId.value = "";
    stats.targetDamageModifiers = undefined;
  }

  if (defaultState.targetUnitType) {
    applyTargetUnitByType(defaultState.targetUnitType);
  }

  return {
    stats,
    selectedTargetUnitId,
    selectedTargetArmorId,
    targetArmorSide,
    targetPresets,
    targetArmors,
    selectedTargetArmor,
    currentArmor,
    applyTargetUnit,
    applyTargetArmor,
    setTargetArmorSide,
    clearSelection,
  };
});

function armorValueForSide(armor: ArmorDefinition, side: ArmorSide): number {
  switch (side) {
    case "front": return armor.frontArmor;
    case "rear": return armor.rearArmor;
    case "under": return armor.underArmor;
    case "side": return armor.sideArmor;
  }
}
