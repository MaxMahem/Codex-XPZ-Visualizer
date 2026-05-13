export interface WeaponSystem {
  id: string;
  name: string;
  category: string;
  damageTypeId: string;
  basePower: number;
  armorPenetration: number;
  strengthBonus: number;
  meleeBonus: number;
  color: string;
  armorEffectivenessOverride?: number;
  damageModifierOverrides?: Partial<Record<DamageComponentKey, number>>;
  damageRandomizedOverrides?: Partial<Record<DamageComponentKey, boolean>>;
  randomProfileIdOverride?: string;
}

export type DamageComponentKey = "hp" | "stun" | "morale" | "armor" | "tu" | "energy" | "mana";

export interface DamageType {
  id: string;
  name: string;
  armorEffectiveness: number;
  armorEffectivenessScalesWithPower?: boolean;
  hpDamagePercent: number;
  hpDamageRandomized: boolean;
  stunDamagePercent: number;
  stunDamageRandomized: boolean;
  moraleDamagePercent: number;
  moraleDamageRandomized: boolean;
  armorDamagePercent: number;
  armorDamageRandomized: boolean;
  tuDamagePercent: number;
  tuDamageRandomized: boolean;
  energyDamagePercent: number;
  energyDamageRandomized: boolean;
  manaDamagePercent: number;
  manaDamageRandomized: boolean;
  randomProfileId: string;
  color: string;
}

export interface Scenario {
  strength: number;
  melee: number;
  hitPoints: number;
  armorEffectiveness: number;
  armorMin: number;
  armorMax: number;
  armorStep: number;
}

export interface DamagePoint {
  armor: number;
  expected: number;
  averageRollDamage: number;
  killChance: number;
}

export interface DamageDistributionBucket {
  damage: number;
  count: number;
  probability: number;
}

export interface DamageRollResult {
  rollPercent: number;
  hpDamage: number;
  stunDamage: number;
  moraleDamage: number;
  armorDamage: number;
  tuDamage: number;
  energyDamage: number;
  manaDamage: number;
  totalDamage: number;
  damage: number;
  count: number;
  probability: number;
}

export interface DamageComponentCurvePoint {
  percentile: number;
  rollPercent: number;
  hpDamage: number;
  stunDamage: number;
  totalDamage: number;
}

export interface RandomProfile {
  id: string;
  label: string;
  minPercent: number;
  maxPercent: number;
  dice: number;
}
