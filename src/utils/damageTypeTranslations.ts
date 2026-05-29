import type { DamageType, TranslationMap } from "../types";

const DAMAGE_TYPE_TRANSLATION_KEYS: Record<string, string> = {
  "1-armor-piercing": "STR_DAMAGE_ARMOR_PIERCING",
  "2-incendiary": "STR_DAMAGE_INCENDIARY",
  "3-high-explosive": "STR_DAMAGE_HIGH_EXPLOSIVE",
  "4-laser": "STR_DAMAGE_LASER_BEAM",
  "5-plasma": "STR_DAMAGE_PLASMA_BEAM",
  "6-stun": "STR_DAMAGE_STUN",
  "7-melee": "STR_DAMAGE_MELEE",
  "8-acid": "STR_DAMAGE_ACID",
  "9-smoke": "STR_DAMAGE_SMOKE",
};

export function translatedDamageTypeName(damageType: DamageType, translations: TranslationMap): string {
  const key = DAMAGE_TYPE_TRANSLATION_KEYS[damageType.id];
  const translated = key ? translations[key] : undefined;
  if (!translated) return damageType.name;
  const numericPrefix = Number.parseInt(damageType.id, 10);
  return Number.isFinite(numericPrefix) ? `${numericPrefix} - ${translated}` : translated;
}
