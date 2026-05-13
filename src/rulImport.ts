import { parse } from "yaml";
import type { DamageType, DamageBonusEntry, DamageBonusStat, WeaponSystem, DamageComponentKey } from "./types";

type Scalar = string | number | boolean;
type YamlRecord = Record<string, unknown>;

const VALID_BONUS_STATS = new Set<string>([
  "strength", "melee", "bravery", "firing", "reactions", "throwing",
  "psiStrength", "psiSkill", "mana", "rank", "flatHundred", "flatOne",
]);

type ParsedRulItem = {
  type: string;
  power?: number;
  damageType?: number | string;
  battleType?: number;
  clipSize?: number;
  damageAlter: Record<string, Scalar>;
  damageBonus: Record<string, unknown>;
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

export function importOpenXcomItems(text: string, defaultDamageTypes: DamageType[]): ImportResult {
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
      name: cleanRuleName(item.type),
      category: item.battleType === 2 || item.clipSize !== undefined ? "Ammo" : "Item",
      damageTypeId,
      basePower: Math.round(item.power ?? 0),
      armorPenetration: numberValue(item.damageAlter.ToArmorPre, 0),
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



const RANDOM_PROFILE_MAP: Record<number, string> = {
  1: "50-150",
  2: "50-150",
  3: "50-200",
  4: "flat-power",
  5: "0-200-2d",
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

function scalarOrUndefined(value: unknown): Scalar | undefined {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? value
    : undefined;
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
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

function uniqueId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
