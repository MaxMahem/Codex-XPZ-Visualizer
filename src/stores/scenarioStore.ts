import { defineStore } from "pinia";
import { computed, reactive, ref } from "vue";
import { defaultScenario, defaultState, defaultTranslations } from "../data";
import defaultArmorsRul from "../data/datasets/xcom1/armors.rul?raw";
import defaultSoldiersRul from "../data/datasets/xcom1/soldiers.rul?raw";
import defaultUnitsRul from "../data/datasets/xcom1/units.rul?raw";
import {
  importOpenXcomArmors,
  importOpenXcomSoldiers,
  importOpenXcomTranslations,
  importOpenXcomUnits,
} from "../rulImport";
import { damageModifiersForArmor, mergeArmorsById } from "./scenarioStoreHelpers";
import type { ArmorDefinition, ArmorSide, Scenario, TranslationMap, UnitDefinition } from "../types";

export type ScenarioTab = "user" | "target";

export const useScenarioStore = defineStore('scenario', () => {
  const scenario = reactive({ ...defaultScenario });
  const scenarioTab = ref<ScenarioTab>("user");
  const translations = reactive<TranslationMap>({ ...defaultTranslations });
  const units = reactive<UnitDefinition[]>(importOpenXcomUnits(defaultUnitsRul, translations));
  const soldierPresets = reactive<UnitDefinition[]>(importOpenXcomSoldiers(defaultSoldiersRul, translations));
  const armors = reactive<ArmorDefinition[]>(importOpenXcomArmors(defaultArmorsRul, translations));
  const userPresets = computed(() => [...soldierPresets, ...units]);
  const targetPresets = computed(() => [...soldierPresets, ...units]);
  const selectedUserUnitId = ref(defaultUserPresetId(soldierPresets, units));
  const selectedTargetUnitId = ref("");
  const selectedTargetArmorId = ref("");
  const targetArmorSide = ref<ArmorSide>(defaultState.targetArmorSide ?? "side");
  const importStatus = ref("");
  const currentArmor = computed(() => Math.round(scenario.armor));

  const selectedTargetPreset = computed(() =>
    targetPresets.value.find((candidate) => candidate.id === selectedTargetUnitId.value),
  );

  const targetArmors = computed(() => armors);

  function applyUserUnit(unitId: string): void {
    selectedUserUnitId.value = unitId;
    const unit = userPresets.value.find((candidate) => candidate.id === unitId);
    if (!unit) return;

    applyUserStats(unit, scenario);
  }

  function applyTargetUnit(unitId: string): void {
    selectedTargetUnitId.value = unitId;
    const unit = targetPresets.value.find((candidate) => candidate.id === unitId);
    if (!unit) return;

    if (unit.stats.health !== undefined) scenario.hitPoints = unit.stats.health;
    if (unit.stats.bravery !== undefined) scenario.targetBravery = unit.stats.bravery;
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
    const armor = armors.find((candidate) => candidate.id === armorId);
    if (!armor) {
      scenario.targetDamageModifiers = damageModifiersForArmor(undefined);
      return;
    }

    scenario.targetDamageModifiers = damageModifiersForArmor(armor);
    scenario.armor = armorValueForSide(armor, targetArmorSide.value);
  }

  function setTargetArmorSide(side: ArmorSide): void {
    targetArmorSide.value = side;
    if (selectedTargetArmorId.value) {
      applyTargetArmor(selectedTargetArmorId.value);
    }
  }

  function importUnitsText(text: string): UnitDefinition[] {
    const imported = importOpenXcomUnits(text, translations);
    units.push(...imported);
    return imported;
  }

  function importArmorsText(text: string): ArmorDefinition[] {
    const imported = importOpenXcomArmors(text, translations);
    mergeArmorsById(armors, imported);
    return imported;
  }

  function importSoldiersText(text: string): UnitDefinition[] {
    const imported = importOpenXcomSoldiers(text, translations);
    soldierPresets.push(...imported);
    return imported;
  }

  function importRulesetText(text: string): { soldiers: number; units: number; armors: number } {
    const importedTranslations = importOpenXcomTranslations(text);
    Object.assign(translations, importedTranslations);
    const soldiers = importSoldiersText(text);
    const importedUnits = importUnitsText(text);
    const importedArmors = importArmorsText(text);
    applyTranslations();
    return { soldiers: soldiers.length, units: importedUnits.length, armors: importedArmors.length };
  }

  async function importRulesetFile(event: Event): Promise<{ soldiers: number; units: number; armors: number }> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return { soldiers: 0, units: 0, armors: 0 };

    const imported = importRulesetText(await file.text());
    importStatus.value = importSummary(imported, 0);
    input.value = "";
    return imported;
  }

  function setImportStatus(message: string): void {
    importStatus.value = message;
  }

  function clearUnitsAndArmors(): void {
    soldierPresets.splice(0, soldierPresets.length);
    units.splice(0, units.length);
    armors.splice(0, armors.length);
    selectedUserUnitId.value = "";
    selectedTargetUnitId.value = "";
    selectedTargetArmorId.value = "";
    scenario.targetDamageModifiers = undefined;
    importStatus.value = "Cleared soldiers, units, and armors.";
  }

  function applyTranslations(): void {
    for (const unit of units) {
      unit.name = displayName(unit.type, translations);
    }
    for (const armor of armors) {
      armor.name = displayName(armor.type, translations);
    }
    for (const soldier of soldierPresets) {
      const suffix = soldier.presetKind === "soldier-min"
        ? " (Min)"
        : soldier.presetKind === "soldier-max"
          ? " (Max)"
          : soldier.presetKind === "soldier-average"
            ? " (Average)"
            : "";
      soldier.name = `${displayName(soldier.type, translations)}${suffix}`;
    }
  }

  if (selectedUserUnitId.value) {
    applyUserUnit(selectedUserUnitId.value);
  }
  if (defaultState.targetUnitType) {
    applyTargetUnitByType(defaultState.targetUnitType);
  }

  return {
    scenario,
    scenarioTab,
    translations,
    units,
    soldierPresets,
    userPresets,
    targetPresets,
    armors,
    targetArmors,
    selectedTargetPreset,
    selectedUserUnitId,
    selectedTargetUnitId,
    selectedTargetArmorId,
    targetArmorSide,
    importStatus,
    currentArmor,
    applyUserUnit,
    applyTargetUnit,
    applyTargetUnitByType,
    applyTargetArmor,
    setTargetArmorSide,
    importUnitsText,
    importSoldiersText,
    importArmorsText,
    importRulesetText,
    importRulesetFile,
    setImportStatus,
    clearUnitsAndArmors,
  };
});

export function importSummary(
  imported: { soldiers: number; units: number; armors: number },
  items: number,
): string {
  return `Imported ${imported.soldiers} soldier presets, ${imported.units} units, ${imported.armors} armors, ${items} powered items.`;
}

function applyUserStats(unit: UnitDefinition, scenario: Scenario): void {
  if (unit.stats.strength !== undefined) scenario.strength = unit.stats.strength;
  if (unit.stats.melee !== undefined) scenario.melee = unit.stats.melee;
  if (unit.stats.bravery !== undefined) scenario.bravery = unit.stats.bravery;
  if (unit.stats.firing !== undefined) scenario.firing = unit.stats.firing;
  if (unit.stats.reactions !== undefined) scenario.reactions = unit.stats.reactions;
  if (unit.stats.throwing !== undefined) scenario.throwing = unit.stats.throwing;
  if (unit.stats.psiStrength !== undefined) scenario.psiStrength = unit.stats.psiStrength;
  if (unit.stats.psiSkill !== undefined) scenario.psiSkill = unit.stats.psiSkill;
  if (unit.stats.mana !== undefined) scenario.mana = unit.stats.mana;
}

function armorValueForSide(armor: ArmorDefinition, side: ArmorSide): number {
  switch (side) {
    case "front": return armor.frontArmor;
    case "rear": return armor.rearArmor;
    case "under": return armor.underArmor;
    case "side": return armor.sideArmor;
  }
}

function defaultUserPresetId(soldiers: UnitDefinition[], units: UnitDefinition[]): string {
  const configured = [...soldiers, ...units].find(
    (unit) =>
      unit.type === defaultState.userPresetType &&
      (defaultState.userPresetKind === undefined || unit.presetKind === defaultState.userPresetKind),
  );
  return configured?.id ?? soldiers.find((soldier) => soldier.presetKind === "soldier-average")?.id ?? "";
}

function displayName(key: string, translations: TranslationMap): string {
  return translations[key] ?? key
    .replace(/^STR_/, "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (match: string) => match.toUpperCase());
}
