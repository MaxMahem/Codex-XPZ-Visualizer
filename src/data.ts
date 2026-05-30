import type { DamageType, RandomProfile, Scenario, WeaponSystem } from "./types";
import randomProfilesJson from "./data/randomProfiles.json";
import damageTypesJson from "./data/damageTypes.json";
import defaultConfigJson from "./data/defaultConfig.json";
import defaultLanguageRaw from "./data/datasets/xcom1/en-US.yml?raw";
import { importOpenXcomTranslations } from "./rulImport.ts";
import { translatedDamageTypeName } from "./utils/damageTypeTranslations";
import type { AppConfig } from "./types";


export const appConfig: AppConfig = defaultConfigJson as unknown as AppConfig;
export const defaultScenario: Scenario = appConfig.defaultScenario;
export const defaultHeatmapDomain = appConfig.heatmap;
export const randomProfiles: RandomProfile[] = randomProfilesJson;
export const defaultState = appConfig.defaultState;
export const defaultTranslations = importOpenXcomTranslations(defaultLanguageRaw);
export const damageTypes: DamageType[] = (damageTypesJson as DamageType[]).map((damageType) => ({
  ...damageType,
  name: translatedDamageTypeName(damageType, defaultTranslations),
}));
