import { defineStore } from "pinia";
import { computed, reactive, ref, toRefs } from "vue";
import { defaultScenario } from "../data";
import { useLibraryStore } from "./libraryStore";
import { useAttackerStore } from "./attackerStore";
import { useTargetStore } from "./targetStore";

export type ScenarioTab = "attacker" | "target";

export const useScenarioStore = defineStore('scenario', () => {
  const libraryStore = useLibraryStore();
  const attackerStore = useAttackerStore();
  const targetStore = useTargetStore();

  const scenarioTab = ref<ScenarioTab>("attacker");

  // Facade reactive object wrapping attacker stats & target stats
  const scenario = reactive({
    ...toRefs(attackerStore.stats),
    ...toRefs(targetStore.stats),
    armorMin: defaultScenario.armorMin,
    armorMax: defaultScenario.armorMax,
    armorStep: defaultScenario.armorStep,
  });

  // Delegate states, refs & computed properties from sub-stores
  const units = computed(() => libraryStore.units);
  const soldierPresets = computed(() => libraryStore.soldierPresets);
  const armors = computed(() => libraryStore.armors);

  const attackerPresets = computed(() => attackerStore.attackerPresets);
  const targetPresets = computed(() => targetStore.targetPresets);
  const targetArmors = computed(() => targetStore.targetArmors);

  const selectedAttackerUnitId = computed(() => attackerStore.selectedAttackerUnitId);
  const selectedTargetUnitId = computed(() => targetStore.selectedTargetUnitId);
  const selectedTargetArmorId = computed(() => targetStore.selectedTargetArmorId);
  const targetArmorSide = computed(() => targetStore.targetArmorSide);

  const selectedTargetArmor = computed(() => targetStore.selectedTargetArmor);
  const currentArmor = computed(() => targetStore.currentArmor);
  const importStatus = computed(() => libraryStore.importStatus);

  // Delegate actions
  const applyAttackerUnit = attackerStore.applyAttackerUnit;
  const applyTargetUnit = targetStore.applyTargetUnit;
  const applyTargetArmor = targetStore.applyTargetArmor;
  const setTargetArmorSide = targetStore.setTargetArmorSide;
  const importRulesetFile = libraryStore.importRulesetFile;

  function clearUnitsAndArmors(): void {
    libraryStore.clearUnitsAndArmors();
    attackerStore.clearSelection();
    targetStore.clearSelection();
  }

  return {
    scenario,
    scenarioTab,
    units,
    soldierPresets,
    attackerPresets,
    targetPresets,
    armors,
    targetArmors,
    selectedTargetArmor,
    selectedAttackerUnitId,
    selectedTargetUnitId,
    selectedTargetArmorId,
    targetArmorSide,
    importStatus,
    currentArmor,
    applyAttackerUnit,
    applyTargetUnit,
    applyTargetArmor,
    setTargetArmorSide,
    importRulesetFile,
    clearUnitsAndArmors,
  };
});
