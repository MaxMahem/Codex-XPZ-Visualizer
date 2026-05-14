import {
  armorEffectivenessModifier,
  damageTypeFor,
  DAMAGE_BONUS_STATS,
  getDamageComponent,
  modifiedPower,
  randomProfileFor,
  randomRange,
} from "../damage";
import { randomProfiles } from "../data";
import { damageComponentOptions } from "../stores/damageTypesStore";
import type { DamageComponentCurvePoint, DamageComponentKey, DamageType, Scenario, WeaponSystem } from "../types";
import { formatDamage, formatPercent } from "./formatters";

export function targetHpTooltip(hitPoints: number): string {
  return `The red dashed horizontal line marks the target's HP (${formatDamage(hitPoints)}). Curves above it have enough expected damage to exceed that HP at the shown armor level.`;
}

export function percentileTooltip(result: DamageComponentCurvePoint): string {
  return `${formatDamage(result.totalDamage)} total by the ${Math.round(result.percentile)}th percentile. HP ${formatDamage(result.hpDamage)}, stun ${formatDamage(result.stunDamage)}. Underlying roll: ${result.rollPercent}%.`;
}

export function weaponTooltip(
  weapon: WeaponSystem,
  scenario: Scenario,
  damageTypes: DamageType[],
): string {
  const damageType = damageTypeFor(weapon, damageTypes);
  const profile = randomProfileFor(weapon, damageTypes, randomProfiles);
  const [minRoll, maxRoll] = randomRange(weapon, damageTypes, randomProfiles);
  const armorEffectiveness = armorEffectivenessModifier(weapon, scenario, damageTypes);
  const armorEffectivenessSource =
    weapon.armorEffectivenessOverride !== undefined
      ? "weapon override"
      : damageType.armorEffectivenessScalesWithPower
        ? "1 + power/100"
        : "damage type default";
  const components = damageComponentOptions
    .map((component) => {
      const percent = componentPercentFor(weapon, damageType, component.key);
      const randomized = componentRandomizedFor(weapon, damageType, component.key);
      if (
        percent === 0 &&
        weapon.damageModifierOverrides?.[component.key] === undefined &&
        weapon.damageRandomizedOverrides?.[component.key] === undefined
      ) {
        return "";
      }
      return `${component.label} ${formatPercent(percent)}${randomized ? " with 0-100% RNG" : ""} (${componentSource(weapon, component.key)})`;
    })
    .filter(Boolean)
    .join(", ");

  return [
    `${weapon.name}: ${damageType.name} damage.`,
    `Base ${formatDamage(weapon.basePower)}, current power ${formatDamage(modifiedPower(weapon, scenario))}.`,
    `Damage bonus: ${damageBonusTooltip(weapon)}.`,
    `ToArmorPre ${formatPercent(weapon.armorPenetration)} (displayed only; not included in calculations yet).`,
    `AP ${formatPercent(armorEffectiveness)} from ArmorEffectiveness (${armorEffectivenessSource}).`,
    `Random profile ${profile.label} (${formatPercent(minRoll)}-${formatPercent(maxRoll)})${weapon.randomProfileIdOverride ? " (weapon override)" : ""}.`,
    components ? `Components: ${components}.` : "Components: none.",
  ].join(" ");
}

function componentPercentFor(
  weapon: WeaponSystem,
  damageType: DamageType,
  component: DamageComponentKey,
): number {
  return weapon.damageModifierOverrides?.[component] ?? getDamageComponent(damageType, component).percent;
}

function componentRandomizedFor(
  weapon: WeaponSystem,
  damageType: DamageType,
  component: DamageComponentKey,
): boolean {
  return weapon.damageRandomizedOverrides?.[component] ?? !!getDamageComponent(damageType, component).randomized;
}

function componentSource(weapon: WeaponSystem, component: DamageComponentKey): string {
  const hasPercentOverride = weapon.damageModifierOverrides?.[component] !== undefined;
  const hasRandomOverride = weapon.damageRandomizedOverrides?.[component] !== undefined;
  if (hasPercentOverride && hasRandomOverride) return "weapon override";
  if (hasPercentOverride) return "weapon percent override";
  if (hasRandomOverride) return "weapon RNG override";
  return "damage type default";
}

function damageBonusTooltip(weapon: WeaponSystem): string {
  if ((weapon.damageBonus ?? []).length === 0) {
    return "no stat bonus";
  }

  return weapon.damageBonus
    .map((entry) => {
      const label = DAMAGE_BONUS_STATS.find((stat) => stat.key === entry.stat)?.label ?? entry.stat;
      const [linear, quadratic, cubic] = entry.coefficients;
      const terms = [
        linear !== 0 ? `${linear}x` : "",
        quadratic !== 0 ? `${quadratic}x^2` : "",
        cubic !== 0 ? `${cubic}x^3` : "",
      ].filter(Boolean);
      return `${label}: ${terms.length > 0 ? terms.join(" + ") : "0"}`;
    })
    .join("; ");
}
