import type { DamageType, RandomProfile, Scenario, WeaponSystem } from "./types";
import randomProfilesJson from "./data/randomProfiles.json";
import damageTypesJson from "./data/damageTypes.json";
import weaponsJson from "./data/weapons.json";

export const defaultScenario: Scenario = {
  strength: 75,
  melee: 90,
  hitPoints: 45,
  armorEffectiveness: 1,
  armorMin: 0,
  armorMax: 100,
  armorStep: 5,
};

export const randomProfiles: RandomProfile[] = randomProfilesJson;
export const damageTypes: DamageType[] = damageTypesJson;
export const weapons: WeaponSystem[] = weaponsJson;
