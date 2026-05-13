import type { DamageType, RandomProfile, Scenario, WeaponSystem } from "./types";
import randomProfilesJson from "./data/randomProfiles.json";
import damageTypesJson from "./data/damageTypes.json";


export const defaultScenario: Scenario = {
  strength: 75,
  melee: 90,
  bravery: 30,
  firing: 60,
  reactions: 50,
  throwing: 50,
  psiStrength: 50,
  psiSkill: 0,
  mana: 0,
  rank: 0,
  hitPoints: 45,
  armorEffectiveness: 1,
  armorMin: 0,
  armorMax: 100,
  armorStep: 5,
};

export const randomProfiles: RandomProfile[] = randomProfilesJson;
export const damageTypes: DamageType[] = damageTypesJson;

