export type DamageBonusStat =
  | "strength"
  | "melee"
  | "bravery"
  | "firing"
  | "reactions"
  | "throwing"
  | "psiStrength"
  | "psiSkill"
  | "mana"
  | "rank"
  | "flatHundred"
  | "flatOne";

export interface DamageBonusEntry {
  stat: DamageBonusStat;
  coefficients: [number, number, number];
}

export interface WeaponSystem {
  id: string;
  name: string;
  category: string;
  damageTypeId: string;
  basePower: number;
  armorPenetration: number;
  damageBonus: DamageBonusEntry[];
  color: string;
  armorEffectivenessOverride?: number;
  damageModifierOverrides?: Partial<Record<DamageComponentKey, number>>;
  damageRandomizedOverrides?: Partial<Record<DamageComponentKey, boolean>>;
  randomProfileIdOverride?: string;
}

export type DamageComponentKey = "hp" | "stun" | "morale" | "armor" | "preArmor" | "tu" | "energy" | "mana";
export type DerivedDamageMetricKey = "hp-stun" | "scaledMorale" | "panicChance";
export type DamageMetricKey = DamageComponentKey | DerivedDamageMetricKey;

export interface DamageComponent {
  type: DamageComponentKey;   // discriminant
  percent: number;            // e.g. 0.5, 1.5, etc.
  randomized?: boolean;       // optional flag
}

export interface DamageType {
  id: string;
  name: string;
  armorEffectiveness: number;
  armorEffectivenessScalesWithPower?: boolean;
  damageComponents: Record<DamageComponentKey, DamageComponent>;
  randomProfileId: string;
  color: string;
}

export interface Scenario {
  strength: number;
  melee: number;
  bravery: number;
  firing: number;
  reactions: number;
  throwing: number;
  psiStrength: number;
  psiSkill: number;
  mana: number;
  rank: number;
  hitPoints: number;
  targetBravery: number;
  armor: number;
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
  preArmorDamage: number;
  tuDamage: number;
  energyDamage: number;
  manaDamage: number;
  scaledMoraleDamage: number;
  panicChance: number;
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
  moraleDamage: number;
  armorDamage: number;
  preArmorDamage: number;
  tuDamage: number;
  energyDamage: number;
  manaDamage: number;
  scaledMoraleDamage: number;
  panicChance: number;
  totalDamage: number;
}

export interface RandomProfile {
  id: string;
  label: string;
  minPercent: number;
  maxPercent: number;
  dice: number;
}
