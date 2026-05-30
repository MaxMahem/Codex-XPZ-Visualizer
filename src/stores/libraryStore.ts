import { defineStore } from "pinia";
import { reactive, ref } from "vue";
import { defaultTranslations } from "../data";
import defaultArmorsRul from "../data/datasets/xcom1/armors.rul?raw";
import defaultSoldiersRul from "../data/datasets/xcom1/soldiers.rul?raw";
import defaultUnitsRul from "../data/datasets/xcom1/units.rul?raw";
import {
  importOpenXcomArmors,
  importOpenXcomSoldiers,
  importOpenXcomTranslations,
  importOpenXcomUnits,
} from "../rulImport";
import { mergeArmorsById } from "./scenarioStoreHelpers";
import type { ArmorDefinition, TranslationMap, UnitDefinition } from "../types";

export const useLibraryStore = defineStore("library", () => {
  const translations = reactive<TranslationMap>({ ...defaultTranslations });
  const units = reactive<UnitDefinition[]>(importOpenXcomUnits(defaultUnitsRul, translations));
  const soldierPresets = reactive<UnitDefinition[]>(importOpenXcomSoldiers(defaultSoldiersRul, translations));
  const armors = reactive<ArmorDefinition[]>(importOpenXcomArmors(defaultArmorsRul, translations));
  const importStatus = ref("");

  async function importRulesetFile(event: Event): Promise<{ soldiers: number; units: number; armors: number }> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return { soldiers: 0, units: 0, armors: 0 };

    const text = await file.text();
    const importedTranslations = importOpenXcomTranslations(text);
    Object.assign(translations, importedTranslations);

    const importedSoldiers = importOpenXcomSoldiers(text, translations);
    soldierPresets.push(...importedSoldiers);

    const importedUnits = importOpenXcomUnits(text, translations);
    units.push(...importedUnits);

    const importedArmors = importOpenXcomArmors(text, translations);
    mergeArmorsById(armors, importedArmors);

    applyTranslations();

    const result = {
      soldiers: importedSoldiers.length,
      units: importedUnits.length,
      armors: importedArmors.length,
    };

    importStatus.value = importSummary(result, 0);
    input.value = "";
    return result;
  }

  function clearUnitsAndArmors(): void {
    soldierPresets.splice(0, soldierPresets.length);
    units.splice(0, units.length);
    armors.splice(0, armors.length);
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

  return {
    translations,
    units,
    soldierPresets,
    armors,
    importStatus,
    importRulesetFile,
    clearUnitsAndArmors,
  };
});

function importSummary(
  imported: { soldiers: number; units: number; armors: number },
  items: number,
): string {
  return `Imported ${imported.soldiers} soldier presets, ${imported.units} units, ${imported.armors} armors, ${items} powered items.`;
}

function displayName(key: string, translations: TranslationMap): string {
  return translations[key] ?? key
    .replace(/^STR_/, "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (match: string) => match.toUpperCase());
}
