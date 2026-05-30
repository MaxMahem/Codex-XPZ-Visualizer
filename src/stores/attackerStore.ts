import { defineStore } from "pinia";
import { computed, reactive, ref } from "vue";
import { defaultScenario, defaultState } from "../data";
import { useLibraryStore } from "./libraryStore";
import type { AttackerStats, UnitDefinition } from "../types";

export const useAttackerStore = defineStore("attacker", () => {
  const libraryStore = useLibraryStore();

  const stats = reactive<AttackerStats>({
    tu: defaultScenario.tu,
    stamina: defaultScenario.stamina,
    health: defaultScenario.health,
    strength: defaultScenario.strength,
    melee: defaultScenario.melee,
    bravery: defaultScenario.bravery,
    firing: defaultScenario.firing,
    reactions: defaultScenario.reactions,
    throwing: defaultScenario.throwing,
    psiStrength: defaultScenario.psiStrength,
    psiSkill: defaultScenario.psiSkill,
    mana: defaultScenario.mana,
    rank: defaultScenario.rank,
  });

  const attackerPresets = computed(() => [...libraryStore.soldierPresets, ...libraryStore.units]);
  const selectedAttackerUnitId = ref(defaultAttackerPresetId(libraryStore.soldierPresets, libraryStore.units));

  function applyAttackerUnit(unitId: string): void {
    selectedAttackerUnitId.value = unitId;
    const unit = attackerPresets.value.find((candidate) => candidate.id === unitId);
    if (!unit) return;

    applyAttackerStats(unit, stats);
  }

  function clearSelection(): void {
    selectedAttackerUnitId.value = "";
  }

  if (selectedAttackerUnitId.value) {
    applyAttackerUnit(selectedAttackerUnitId.value);
  }

  return {
    stats,
    attackerPresets,
    selectedAttackerUnitId,
    applyAttackerUnit,
    clearSelection,
  };
});

function applyAttackerStats(unit: UnitDefinition, stats: AttackerStats): void {
  Object.assign(stats, unit.stats);
}

function defaultAttackerPresetId(soldiers: UnitDefinition[], units: UnitDefinition[]): string {
  const configured = [...soldiers, ...units].find(
    (unit) =>
      unit.type === defaultState.attackerPresetType &&
      (defaultState.attackerPresetKind === undefined || unit.presetKind === defaultState.attackerPresetKind),
  );
  return configured?.id ?? soldiers.find((soldier) => soldier.presetKind === "soldier-average")?.id ?? "";
}
