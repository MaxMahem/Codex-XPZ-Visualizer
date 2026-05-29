import type { DamageType, RandomProfile, Scenario, WeaponSystem } from "./types";
import randomProfilesJson from "./data/randomProfiles.json";
import damageTypesJson from "./data/damageTypes.json";
import defaultConfigJson from "./data/defaultConfig.json";
import defaultLanguageRaw from "./data/datasets/xcom1/en-US.yml?raw";
import { importOpenXcomTranslations } from "./rulImport.ts";
import { translatedDamageTypeName } from "./utils/damageTypeTranslations";
import type { AppConfig } from "./types";


export const defaultScenario: Scenario = {
  strength: 75,
  melee: 90,
  bravery: 50,
  firing: 60,
  reactions: 50,
  throwing: 50,
  psiStrength: 50,
  psiSkill: 0,
  mana: 0,
  rank: 0,
  hitPoints: 45,
  targetBravery: 50,
  armor: 40,
  armorEffectiveness: 1,
  targetDamageModifiers: undefined,
  armorMin: 0,
  armorMax: 100,
  armorStep: 5,
};

export const randomProfiles: RandomProfile[] = randomProfilesJson;
export const appConfig: AppConfig = defaultConfigJson as AppConfig;
export const defaultState = appConfig.defaultState;
export const defaultTranslations = importOpenXcomTranslations(defaultLanguageRaw);
export const damageTypes: DamageType[] = (damageTypesJson as DamageType[]).map((damageType) => ({
  ...damageType,
  name: translatedDamageTypeName(damageType, defaultTranslations),
}));
