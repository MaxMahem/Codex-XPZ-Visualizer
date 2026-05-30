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
  sourceType?: string;
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

export interface AttackerStats extends RuleUnitStats {
  rank: number;
}

export interface TargetStats {
  hitPoints: number;
  targetBravery: number;
  armor: number;
  armorEffectiveness: number;
  targetDamageModifiers?: number[];
}

export interface Scenario extends AttackerStats, TargetStats {
  armorMin: number;
  armorMax: number;
  armorStep: number;
}

export type ArmorSide = "front" | "side" | "rear" | "under";

export interface RuleUnitStats {
  tu: number;
  stamina: number;
  health: number;
  bravery: number;
  reactions: number;
  firing: number;
  throwing: number;
  strength: number;
  psiStrength: number;
  psiSkill: number;
  melee: number;
  mana: number;
}

export interface UnitDefinition {
  id: string;
  type: string;
  name: string;
  armorId?: string;
  stats: RuleUnitStats;
  presetKind?: "unit" | "soldier-min" | "soldier-average" | "soldier-max";
}

export interface HeatmapDomain {
  maxPower: number;
  maxArmor: number;
}

export interface AppConfig {
  activeDataset: string;
  defaultScenario: Scenario;
  defaultState: AppDefaultState;
  heatmap: HeatmapDomain;
}

export interface AppDefaultState {
  attackerPresetType?: string;
  attackerPresetKind?: UnitDefinition["presetKind"];
  targetUnitType?: string;
  targetArmorSide?: ArmorSide;
  focusedWeaponType?: string;
  selectedWeaponTypes?: string[];
}

export type TranslationMap = Record<string, string>;

export interface ArmorDefinition {
  id: string;
  type: string;
  name: string;
  frontArmor: number;
  sideArmor: number;
  rearArmor: number;
  underArmor: number;
  damageModifier: number[];
  unitTypes?: string[];
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
  rolledPower: number;
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
  rolledPower: number;
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
  absolute?: boolean;
}
