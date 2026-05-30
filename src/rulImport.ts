import { parse } from "yaml";
import type {
  ArmorDefinition,
  DamageType,
  DamageBonusEntry,
  DamageBonusStat,
  WeaponSystem,
  DamageComponentKey,
  RuleUnitStats,
  TranslationMap,
  UnitDefinition,
} from "./types";

type Scalar = string | number | boolean;
type YamlRecord = Record<string, unknown>;

const VALID_BONUS_STATS = new Set<string>([
  "strength", "melee", "bravery", "firing", "reactions", "throwing",
  "psiStrength", "psiSkill", "mana", "rank", "flatHundred", "flatOne",
]);

type ParsedRulItem = {
  type: string;
  nameKey?: string;
  power?: number;
  damageType?: number | string;
  battleType?: number;
  clipSize?: number;
  damageAlter: Record<string, Scalar>;
  damageBonus: Record<string, unknown>;
};

type ParsedRulUnit = {
  type: string;
  nameKey?: string;
  armorId?: string;
  stats: RuleUnitStats;
};

type ParsedRulSoldier = {
  type: string;
  nameKey?: string;
  armorId?: string;
  minStats: RuleUnitStats;
  maxStats: RuleUnitStats;
};

type ParsedRulArmor = {
  type: string;
  nameKey?: string;
  frontArmor?: number;
  sideArmor?: number;
  rearArmor?: number;
  underArmor?: number;
  damageModifier: number[];
  unitTypes: string[];
};

type ImportResult = {
  weapons: WeaponSystem[];
};

interface DamageAlterField {
  alterKey: string;
  target: DamageComponentKey;
  field: "modifier" | "randomized";
}

const DAMAGE_ALTER_FIELDS: DamageAlterField[] = [
  { alterKey: "ToHealth", target: "hp", field: "modifier" },
  { alterKey: "RandomHealth", target: "hp", field: "randomized" },
  { alterKey: "ToStun", target: "stun", field: "modifier" },
  { alterKey: "RandomStun", target: "stun", field: "randomized" },
  { alterKey: "ToMorale", target: "morale", field: "modifier" },
  { alterKey: "RandomMorale", target: "morale", field: "randomized" },
  { alterKey: "ToArmor", target: "armor", field: "modifier" },
  { alterKey: "RandomArmor", target: "armor", field: "randomized" },
  { alterKey: "ToArmorPre", target: "preArmor", field: "modifier" },
  { alterKey: "RandomArmorPre", target: "preArmor", field: "randomized" },
  { alterKey: "ToTime", target: "tu", field: "modifier" },
  { alterKey: "RandomTime", target: "tu", field: "randomized" },
  { alterKey: "ToEnergy", target: "energy", field: "modifier" },
  { alterKey: "RandomEnergy", target: "energy", field: "randomized" },
  { alterKey: "ToMana", target: "mana", field: "modifier" },
  { alterKey: "RandomMana", target: "mana", field: "randomized" },
];

function parseDamageBonusEntries(raw: Record<string, unknown>): DamageBonusEntry[] {
  const entries: DamageBonusEntry[] = [];
  for (const [key, value] of Object.entries(raw)) {
    if (!VALID_BONUS_STATS.has(key)) continue;
    const stat = key as DamageBonusStat;

    if (typeof value === "number" && Number.isFinite(value)) {
      // scalar: stat: 0.5 → linear only
      entries.push({ stat, coefficients: [value, 0, 0] });
    } else if (Array.isArray(value)) {
      // array: stat: [a, b, c] → polynomial
      const coeffs: [number, number, number] = [0, 0, 0];
      for (let i = 0; i < Math.min(3, value.length); i++) {
        coeffs[i] = typeof value[i] === "number" && Number.isFinite(value[i]) ? value[i] : 0;
      }
      entries.push({ stat, coefficients: coeffs });
    }
  }
  return entries;
}

export function importOpenXcomItems(
  text: string,
  defaultDamageTypes: DamageType[],
  translations: TranslationMap = {},
): ImportResult {
  const items = parseRulItems(text).filter(
    (item) =>
      Number.isFinite(item.power) &&
      item.battleType !== undefined &&
      item.battleType >= 1 &&
      item.battleType <= 5,
  );
  const weapons: WeaponSystem[] = [];

  for (const item of items) {
    const rawDamageType = item.damageType ?? 0;
    const damageTypeIndex = typeof rawDamageType === "number" ? rawDamageType : 0;
    const damageType = defaultDamageTypes[damageTypeIndex] ?? defaultDamageTypes[0];
    const damageTypeId = damageType?.id ?? "0-none";

    const damageModifierOverrides: Partial<Record<DamageComponentKey, number>> = {};
    const damageRandomizedOverrides: Partial<Record<DamageComponentKey, boolean>> = {};

    for (const entry of DAMAGE_ALTER_FIELDS) {
      const value = item.damageAlter[entry.alterKey];
      if (value === undefined) continue;
      if (entry.field === "modifier") {
        damageModifierOverrides[entry.target] = numberValue(value, 0);
      } else {
        damageRandomizedOverrides[entry.target] = booleanValue(value, false);
      }
    }

    const randomProfileIdOverride = item.damageAlter.RandomType !== undefined
      ? randomProfileId(numberValue(item.damageAlter.RandomType, Number.NaN))
      : undefined;

    const armorEffectivenessOverride = item.damageAlter.ArmorEffectiveness !== undefined
      ? numberValue(item.damageAlter.ArmorEffectiveness, 1)
      : undefined;

    const damageBonus = parseDamageBonusEntries(item.damageBonus);

    weapons.push({
      id: uniqueId(`rul-${item.type.toLowerCase()}`),
      sourceType: item.type,
      name: displayName(item.nameKey ?? item.type, translations),
      category: item.battleType === 2 || item.clipSize !== undefined ? "Ammo" : "Item",
      damageTypeId,
      basePower: Math.round(item.power ?? 0),
      armorPenetration: 0,
      damageBonus,
      color: damageType?.color ?? "#6f7f90",
      ...(Object.keys(damageModifierOverrides).length > 0 && { damageModifierOverrides }),
      ...(Object.keys(damageRandomizedOverrides).length > 0 && { damageRandomizedOverrides }),
      ...(randomProfileIdOverride && { randomProfileIdOverride }),
      ...(armorEffectivenessOverride !== undefined && { armorEffectivenessOverride }),
    });
  }

  return { weapons };
}

export function importOpenXcomUnits(text: string, translations: TranslationMap = {}): UnitDefinition[] {
  return parseRulUnits(text).map((unit) => ({
    id: uniqueId(`unit-${unit.type}`),
    type: unit.type,
    name: displayName(unit.nameKey ?? unit.type, translations),
    armorId: unit.armorId,
    stats: unit.stats,
    presetKind: "unit",
  }));
}

export function importOpenXcomSoldiers(text: string, translations: TranslationMap = {}): UnitDefinition[] {
  return parseRulSoldiers(text).flatMap((soldier) => {
    const baseName = displayName(soldier.nameKey ?? soldier.type, translations);
    const baseId = `soldier-${soldier.type}`;

    return [
      {
        id: uniqueId(`${baseId}-average`),
        type: soldier.type,
        name: `${baseName} (Average)`,
        armorId: soldier.armorId,
        stats: averageStats(soldier.minStats, soldier.maxStats),
        presetKind: "soldier-average" as const,
      },
      {
        id: uniqueId(`${baseId}-min`),
        type: soldier.type,
        name: `${baseName} (Min)`,
        armorId: soldier.armorId,
        stats: soldier.minStats,
        presetKind: "soldier-min" as const,
      },
      {
        id: uniqueId(`${baseId}-max`),
        type: soldier.type,
        name: `${baseName} (Max)`,
        armorId: soldier.armorId,
        stats: soldier.maxStats,
        presetKind: "soldier-max" as const,
      },
    ];
  });
}

export function importOpenXcomArmors(text: string, translations: TranslationMap = {}): ArmorDefinition[] {
  return parseRulArmors(text).map((armor) => ({
    id: armor.type,
    type: armor.type,
    name: displayName(armor.nameKey ?? armor.type, translations),
    frontArmor: Math.round(armor.frontArmor ?? 0),
    sideArmor: Math.round(armor.sideArmor ?? 0),
    rearArmor: Math.round(armor.rearArmor ?? 0),
    underArmor: Math.round(armor.underArmor ?? 0),
    damageModifier: armor.damageModifier,
    unitTypes: armor.unitTypes.length > 0 ? armor.unitTypes : undefined,
  }));
}

export function importOpenXcomTranslations(text: string): TranslationMap {
  const document = parse(text, { prettyErrors: true, maxAliasCount: -1 }) as YamlRecord | null;
  if (!document) return {};
  const root = isRecord(document["en-US"]) ? document["en-US"] : document;

  return Object.fromEntries(
    Object.entries(root).flatMap(([key, value]) =>
      typeof value === "string" ? [[key, value]] : [],
    ),
  );
}

function parseRulItems(text: string): ParsedRulItem[] {
  const document = parse(text, { prettyErrors: true, maxAliasCount: -1 }) as YamlRecord | null;
  const rawItems = Array.isArray(document?.items) ? document.items : [];

  return rawItems.flatMap((rawItem) => {
    if (!isRecord(rawItem) || typeof rawItem.type !== "string") {
      return [];
    }

    const damageAlter = scalarRecord(rawItem.damageAlter);
    const damageBonus = rawRecord(rawItem.damageBonus);
    return [
      {
        type: rawItem.type,
        nameKey: typeof rawItem.name === "string" ? rawItem.name : undefined,
        power: numberOrUndefined(rawItem.power),
        damageType: scalarOrUndefined(rawItem.damageType) as number | string | undefined,
        battleType: numberOrUndefined(rawItem.battleType),
        clipSize: numberOrUndefined(rawItem.clipSize),
        damageAlter,
        damageBonus,
      },
    ];
  });
}

function parseRulUnits(text: string): ParsedRulUnit[] {
  const document = parse(text, { prettyErrors: true, maxAliasCount: -1 }) as YamlRecord | null;
  const rawUnits = Array.isArray(document?.units) ? document.units : [];

  return rawUnits.flatMap((rawUnit) => {
    if (!isRecord(rawUnit) || typeof rawUnit.type !== "string") {
      return [];
    }

    const stats = statsRecord(rawUnit.stats);
    if (!stats) return [];

    return [
      {
        type: rawUnit.type,
        nameKey: typeof rawUnit.name === "string" ? rawUnit.name : undefined,
        armorId: typeof rawUnit.armor === "string" ? rawUnit.armor : undefined,
        stats,
      },
    ];
  });
}

function parseRulSoldiers(text: string): ParsedRulSoldier[] {
  const document = parse(text, { prettyErrors: true, maxAliasCount: -1 }) as YamlRecord | null;
  const rawSoldiers = Array.isArray(document?.soldiers) ? document.soldiers : [];

  return rawSoldiers.flatMap((rawSoldier) => {
    if (!isRecord(rawSoldier) || typeof rawSoldier.type !== "string") {
      return [];
    }

    const minStats = statsRecord(rawSoldier.minStats);
    const maxStats = statsRecord(rawSoldier.maxStats);
    if (!minStats || !maxStats) return [];

    return [
      {
        type: rawSoldier.type,
        nameKey: typeof rawSoldier.name === "string" ? rawSoldier.name : undefined,
        armorId: typeof rawSoldier.armor === "string" ? rawSoldier.armor : undefined,
        minStats,
        maxStats,
      },
    ];
  });
}

function parseRulArmors(text: string): ParsedRulArmor[] {
  const document = parse(text, { prettyErrors: true, maxAliasCount: -1 }) as YamlRecord | null;
  const rawArmors = Array.isArray(document?.armors) ? document.armors : [];

  return rawArmors.flatMap((rawArmor) => {
    if (!isRecord(rawArmor) || typeof rawArmor.type !== "string") {
      return [];
    }

    return [
      {
        type: rawArmor.type,
        nameKey: typeof rawArmor.name === "string" ? rawArmor.name : undefined,
        frontArmor: numberOrUndefined(rawArmor.frontArmor),
        sideArmor: numberOrUndefined(rawArmor.sideArmor),
        rearArmor: numberOrUndefined(rawArmor.rearArmor),
        underArmor: numberOrUndefined(rawArmor.underArmor),
        damageModifier: numberArray(rawArmor.damageModifier),
        unitTypes: stringArray(rawArmor.units),
      },
    ];
  });
}



const RANDOM_PROFILE_MAP: Record<number, string> = {
  1: "0-200",
  2: "50-150",
  3: "flat-power",
  4: "fire-5-10",
  5: "none",
  6: "0-200-2d",
  7: "50-200",
  8: "0-200",
  9: "50-150",
};

function randomProfileId(randomType: number): string | undefined {
  if (randomType === 0 || Number.isNaN(randomType)) {
    return undefined;
  }
  return RANDOM_PROFILE_MAP[randomType] ?? "0-200";
}

function numberValue(value: Scalar | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function booleanValue(value: Scalar | undefined, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}


function scalarRecord(value: unknown): Record<string, Scalar> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, rawValue]) => {
      const scalar = scalarOrUndefined(rawValue);
      return scalar === undefined ? [] : [[key, scalar]];
    }),
  );
}

function rawRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    return {};
  }
  return { ...value };
}

function statsRecord(value: unknown): RuleUnitStats | null {
  if (!isRecord(value)) {
    return null;
  }

  const tu = numberOrUndefined(value.tu);
  const stamina = numberOrUndefined(value.stamina);
  const health = numberOrUndefined(value.health);
  const bravery = numberOrUndefined(value.bravery);
  const reactions = numberOrUndefined(value.reactions);
  const firing = numberOrUndefined(value.firing);
  const throwing = numberOrUndefined(value.throwing);
  const strength = numberOrUndefined(value.strength);
  const melee = numberOrUndefined(value.melee);

  if (
    tu === undefined ||
    stamina === undefined ||
    health === undefined ||
    bravery === undefined ||
    reactions === undefined ||
    firing === undefined ||
    throwing === undefined ||
    strength === undefined ||
    melee === undefined
  ) {
    return null;
  }

  return {
    tu,
    stamina,
    health,
    bravery,
    reactions,
    firing,
    throwing,
    strength,
    melee,
    psiStrength: numberOrUndefined(value.psiStrength) ?? 0,
    psiSkill: numberOrUndefined(value.psiSkill) ?? 0,
    mana: numberOrUndefined(value.mana) ?? 0,
  };
}

function scalarOrUndefined(value: unknown): Scalar | undefined {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? value
    : undefined;
}

function numberArray(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry) => (typeof entry === "number" && Number.isFinite(entry) ? entry : 1));
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function averageStats(minStats: RuleUnitStats, maxStats: RuleUnitStats): RuleUnitStats {
  const keys: Array<keyof RuleUnitStats> = [
    "tu",
    "stamina",
    "health",
    "bravery",
    "reactions",
    "firing",
    "throwing",
    "strength",
    "psiStrength",
    "psiSkill",
    "melee",
    "mana",
  ];

  return Object.fromEntries(
    keys.map((key) => [key, Math.round((minStats[key] + maxStats[key]) / 2)]),
  ) as unknown as RuleUnitStats;
}

function isRecord(value: unknown): value is YamlRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanRuleName(type: string): string {
  return type
    .replace(/^STR_/, "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (match: string) => match.toUpperCase());
}

function displayName(key: string, translations: TranslationMap): string {
  return translations[key] ?? cleanRuleName(key);
}

function uniqueId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
