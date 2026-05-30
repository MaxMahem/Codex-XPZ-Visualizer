import type {
  DamageBonusEntry,
  DamageBonusStat,
  DamageDistributionBucket,
  DamageComponentCurvePoint,
  DamageMetricKey,
  DamagePoint,
  DamageRollResult,
  DamageType,
  DamageComponent,
  DamageComponentKey,
  RandomProfile,
  Scenario,
  WeaponSystem,
} from "./types";

export const DAMAGE_BONUS_STATS: Array<{ key: DamageBonusStat; label: string }> = [
  { key: "strength", label: "Strength" },
  { key: "melee", label: "Melee" },
  { key: "bravery", label: "Bravery" },
  { key: "firing", label: "Firing" },
  { key: "reactions", label: "Reactions" },
  { key: "throwing", label: "Throwing" },
  { key: "psiStrength", label: "Psi Strength" },
  { key: "psiSkill", label: "Psi Skill" },
  { key: "mana", label: "Mana" },
  { key: "rank", label: "Rank" },
  { key: "flatHundred", label: "Flat (×100)" },
  { key: "flatOne", label: "Flat (×1)" },
];

export function statValue(stat: DamageBonusStat, scenario: Scenario): number {
  switch (stat) {
    case "flatHundred": return 100;
    case "flatOne": return 1;
    default: return scenario[stat] ?? 0;
  }
}

export function computeDamageBonus(entries: DamageBonusEntry[] = [], scenario: Scenario): number {
  let total = 0;
  for (const entry of entries) {
    const s = statValue(entry.stat, scenario);
    const [a, b, c] = entry.coefficients;
    total += a * s + b * s * s + c * s * s * s;
  }
  return total;
}

const fallbackDamageType: DamageType = {
  id: "fallback",
  name: "Default",
  armorEffectiveness: 1,
  armorEffectivenessScalesWithPower: false,
  damageComponents: {
    hp: { type: "hp", percent: 1, randomized: false },
    stun: { type: "stun", percent: 0, randomized: false },
    morale: { type: "morale", percent: 0, randomized: false },
    armor: { type: "armor", percent: 0, randomized: false },
    preArmor: { type: "preArmor", percent: 0, randomized: false },
    tu: { type: "tu", percent: 0, randomized: false },
    energy: { type: "energy", percent: 0, randomized: false },
    mana: { type: "mana", percent: 0, randomized: false },
  },
  randomProfileId: "0-200",
  color: "#66736b1c",
};

export function getDamageComponent(damageType: DamageType, component: DamageComponentKey): DamageComponent {
  const existing = damageType.damageComponents?.[component];
  if (existing) {
    return existing;
  }

  const legacy = damageType as unknown as Record<string, unknown>;
  const percent = legacy[`${component}DamagePercent`];
  const randomized = legacy[`${component}DamageRandomized`];
  return {
    type: component,
    percent: typeof percent === "number" ? percent : 0,
    randomized: typeof randomized === "boolean" ? randomized : false,
  };
}

const fallbackRandomProfile: RandomProfile = {
  id: "0-200",
  label: "0-200",
  minPercent: 0,
  maxPercent: 200,
  dice: 1,
};

export function modifiedPower(weapon: WeaponSystem, scenario: Scenario): number {
  return weapon.basePower + computeDamageBonus(weapon.damageBonus ?? [], scenario);
}

export function rolledPowerBase(weapon: WeaponSystem, scenario: Scenario): number {
  return Math.max(0, Math.trunc(modifiedPower(weapon, scenario)));
}

export function damageTypeFor(
  weapon: WeaponSystem,
  damageTypes: DamageType[],
): DamageType {
  return damageTypes.find((damageType) => damageType.id === weapon.damageTypeId) ?? fallbackDamageType;
}

export function armorEffectivenessModifier(
  weapon: WeaponSystem,
  scenario: Scenario,
  damageTypes: DamageType[],
): number {
  if (weapon.armorEffectivenessOverride !== undefined) {
    return weapon.armorEffectivenessOverride;
  }

  const damageType = damageTypeFor(weapon, damageTypes);
  if (damageType.armorEffectivenessScalesWithPower) {
    return 1 + modifiedPower(weapon, scenario) / 100;
  }

  return damageType.armorEffectiveness;
}

export function randomRange(
  weapon: WeaponSystem,
  damageTypes: DamageType[],
  randomProfiles: RandomProfile[] = [],
): [number, number] {
  const profile = randomProfileFor(weapon, damageTypes, randomProfiles);
  return [profile.minPercent / 100, profile.maxPercent / 100];
}

export function randomProfileFor(
  weapon: WeaponSystem,
  damageTypes: DamageType[],
  randomProfiles: RandomProfile[] = [],
): RandomProfile {
  const damageType = damageTypeFor(weapon, damageTypes);
  const profileId = weapon.randomProfileIdOverride ?? damageType.randomProfileId;
  return randomProfiles.find((profile) => profile.id === profileId) ?? fallbackRandomProfile;
}

export function rollOutcomes(
  weapon: WeaponSystem,
  scenario: Scenario,
  damageTypes: DamageType[],
  randomProfiles: RandomProfile[] = [],
): Array<{ rollPercent: number; rolledPower: number; count: number; probability: number }> {
  const profile = randomProfileFor(weapon, damageTypes, randomProfiles);
  const power = rolledPowerBase(weapon, scenario);
  return rollOutcomesForPower(power, profile);
}

export function rollOutcomesForPower(
  powerInput: number,
  profile: RandomProfile,
): Array<{ rollPercent: number; rolledPower: number; count: number; probability: number }> {
  const counts = new Map<number, number>();
  const power = Math.max(0, Math.round(powerInput));

  if (profile.absolute) {
    const minPower = Math.floor(profile.minPercent);
    const maxPower = Math.floor(profile.maxPercent);
    for (let rolledPower = minPower; rolledPower <= maxPower; rolledPower += 1) {
      counts.set(rolledPower, 1);
    }
  } else if (profile.dice === 2) {
    const dieMin = Math.floor((power * profile.minPercent) / profile.dice / 100);
    const dieMax = Math.floor((power * profile.maxPercent) / profile.dice / 100);
    for (let first = dieMin; first <= dieMax; first += 1) {
      for (let second = dieMin; second <= dieMax; second += 1) {
        const total = first + second;
        counts.set(total, (counts.get(total) ?? 0) + 1);
      }
    }
  } else {
    const minPower = Math.floor((power * profile.minPercent) / 100);
    const maxPower = Math.floor((power * profile.maxPercent) / 100);
    for (let rolledPower = minPower; rolledPower <= maxPower; rolledPower += 1) {
      counts.set(rolledPower, 1);
    }
  }

  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  return [...counts.entries()]
    .map(([rolledPower, count]) => ({
      rollPercent: power > 0 ? (rolledPower / power) * 100 : 0,
      rolledPower,
      count,
      probability: count / total,
    }))
    .sort((a, b) => a.rolledPower - b.rolledPower);
}

export function effectiveArmor(
  weapon: WeaponSystem,
  scenario: Scenario,
  armor: number,
  damageTypes: DamageType[],
): number {
  const armorEffectiveness = armorEffectivenessModifier(weapon, scenario, damageTypes);
  return armor * scenario.armorEffectiveness * armorEffectiveness;
}

export function targetDamageModifier(
  weapon: WeaponSystem,
  scenario: Scenario,
  damageTypes: DamageType[],
): number {
  const damageType = damageTypeFor(weapon, damageTypes);
  const damageTypeIndex = Number.parseInt(damageType.id, 10);
  if (!Number.isFinite(damageTypeIndex)) {
    return 1;
  }

  const modifier = scenario.targetDamageModifiers?.[damageTypeIndex];
  return typeof modifier === "number" && Number.isFinite(modifier) ? modifier : 1;
}

export function expectedDamage(
  weapon: WeaponSystem,
  scenario: Scenario,
  armor: number,
  damageTypes: DamageType[],
  randomProfiles: RandomProfile[] = [],
): number {
  return buildDamageRollResults(weapon, scenario, armor, damageTypes, randomProfiles).reduce(
    (sum, result) => sum + result.hpDamage * result.probability,
    0,
  );
}

export function expectedTotalDamage(
  weapon: WeaponSystem,
  scenario: Scenario,
  armor: number,
  damageTypes: DamageType[],
  randomProfiles: RandomProfile[] = [],
): number {
  return buildDamageRollResults(weapon, scenario, armor, damageTypes, randomProfiles).reduce(
    (sum, result) => sum + result.totalDamage * result.probability,
    0,
  );
}

export function panicChanceFromScaledMoraleDamage(scaledMoraleDamage: number): number {
  const remainingMorale = Math.max(0, 100 - scaledMoraleDamage);
  return clamp(100 - 2 * remainingMorale, 0, 100);
}

export function expectedPanicChance(
  weapon: WeaponSystem,
  scenario: Scenario,
  armor: number,
  damageTypes: DamageType[],
  randomProfiles: RandomProfile[] = [],
): number {
  return buildDamageRollResults(weapon, scenario, armor, damageTypes, randomProfiles).reduce(
    (sum, result) => sum + result.panicChance * result.probability,
    0,
  );
}

export function expectedComponentDamage(
  weapon: WeaponSystem,
  scenario: Scenario,
  armor: number,
  damageTypes: DamageType[],
  component: DamageComponentKey,
  randomProfiles: RandomProfile[] = [],
): number {
  const damageType = damageTypeFor(weapon, damageTypes);
  const comp = getDamageComponent(damageType, component);
  const percent = weapon.damageModifierOverrides?.[component] ?? comp.percent;
  const randomized = weapon.damageRandomizedOverrides?.[component] ?? comp.randomized;

  return rollOutcomes(weapon, scenario, damageTypes, randomProfiles).reduce((sum, outcome) => {
    const baseDamage = component === "preArmor"
      ? outcome.rolledPower
      : damageFromRolledPower(
        weapon,
        scenario,
        armor,
        outcome.rolledPower,
        damageTypes,
      );
    return sum + expectedRawComponent(baseDamage, percent, !!randomized) * outcome.probability;
  }, 0);
}

export function expectedDamageComponents(
  weapon: WeaponSystem,
  scenario: Scenario,
  armor: number,
  damageTypes: DamageType[],
  randomProfiles: RandomProfile[] = [],
): Record<DamageComponentKey, number> {
  return {
    hp: expectedComponentDamage(weapon, scenario, armor, damageTypes, "hp", randomProfiles),
    stun: expectedComponentDamage(weapon, scenario, armor, damageTypes, "stun", randomProfiles),
    morale: expectedComponentDamage(weapon, scenario, armor, damageTypes, "morale", randomProfiles),
    armor: expectedComponentDamage(weapon, scenario, armor, damageTypes, "armor", randomProfiles),
    preArmor: expectedComponentDamage(weapon, scenario, armor, damageTypes, "preArmor", randomProfiles),
    tu: expectedComponentDamage(weapon, scenario, armor, damageTypes, "tu", randomProfiles),
    energy: expectedComponentDamage(weapon, scenario, armor, damageTypes, "energy", randomProfiles),
    mana: expectedComponentDamage(weapon, scenario, armor, damageTypes, "mana", randomProfiles),
  };
}

export function averageRollDamage(
  weapon: WeaponSystem,
  scenario: Scenario,
  armor: number,
  damageTypes: DamageType[],
  randomProfiles: RandomProfile[] = [],
): number {
  const damageType = damageTypeFor(weapon, damageTypes);
  const outcomes = rollOutcomes(weapon, scenario, damageTypes, randomProfiles);
  const averageRoll =
    outcomes.reduce((sum, outcome) => sum + outcome.rolledPower * outcome.probability, 0);
  return Math.max(
    0,
    Math.max(0, averageRoll - effectiveArmor(weapon, scenario, armor, damageTypes)) *
    (weapon.damageModifierOverrides?.hp ?? getDamageComponent(damageType, "hp").percent),
  );
}

export function killChance(
  weapon: WeaponSystem,
  scenario: Scenario,
  armor: number,
  damageTypes: DamageType[],
  randomProfiles: RandomProfile[] = [],
): number {
  return buildDamageRollResults(weapon, scenario, armor, damageTypes, randomProfiles)
    .filter((result) => result.hpDamage >= scenario.hitPoints)
    .reduce((sum, result) => sum + result.probability, 0);
}

export function buildCurve(
  weapon: WeaponSystem,
  scenario: Scenario,
  damageTypes: DamageType[],
  randomProfiles: RandomProfile[] = [],
): DamagePoint[] {
  const points: DamagePoint[] = [];
  const step = Math.max(1, scenario.armorStep);

  for (let armor = scenario.armorMin; armor <= scenario.armorMax; armor += step) {
    points.push({
      armor,
      expected: expectedDamage(weapon, scenario, armor, damageTypes, randomProfiles),
      averageRollDamage: averageRollDamage(weapon, scenario, armor, damageTypes, randomProfiles),
      killChance: killChance(weapon, scenario, armor, damageTypes, randomProfiles),
    });
  }

  return points;
}

export function damageAtRoll(
  weapon: WeaponSystem,
  scenario: Scenario,
  armor: number,
  rollMultiplier: number,
  damageTypes: DamageType[],
): number {
  const power = rolledPowerBase(weapon, scenario);
  return damageFromRolledPower(
    weapon,
    scenario,
    armor,
    Math.round(power * rollMultiplier),
    damageTypes,
  );
}

export function damageFromRolledPower(
  weapon: WeaponSystem,
  scenario: Scenario,
  armor: number,
  rolledPower: number,
  damageTypes: DamageType[],
): number {
  const resistedPower = Math.floor(rolledPower * targetDamageModifier(weapon, scenario, damageTypes));
  return Math.max(
    0,
    Math.trunc(resistedPower - effectiveArmor(weapon, scenario, armor, damageTypes)),
  );
}

function componentRollOutcomes(
  baseDamage: number,
  percent: number,
  randomized: boolean,
): Array<{ damage: number; count: number; probability: number }> {
  const damage = Math.max(0, Math.trunc(baseDamage));
  if (percent <= 0 || damage <= 0) {
    return [{ damage: 0, count: 1, probability: 1 }];
  }

  if (!randomized) {
    return [{ damage: Math.round(damage * percent), count: 1, probability: 1 }];
  }

  const counts = new Map<number, number>();
  for (let roll = 0; roll <= damage; roll += 1) {
    const rolledDamage = Math.round(roll * percent);
    counts.set(rolledDamage, (counts.get(rolledDamage) ?? 0) + 1);
  }

  const total = damage + 1;
  return [...counts.entries()].map(([rolledDamage, count]) => ({
    damage: rolledDamage,
    count,
    probability: count / total,
  }));
}

function expectedIntegerComponent(baseDamage: number, percent: number, randomized: boolean): number {
  return Math.round(
    expectedRawComponent(baseDamage, percent, randomized),
  );
}

function expectedRawComponent(baseDamage: number, percent: number, randomized: boolean): number {
  if (percent <= 0 || baseDamage <= 0) {
    return 0;
  }

  return componentRollOutcomes(baseDamage, percent, randomized)
    .reduce((sum, outcome) => sum + outcome.damage * outcome.probability, 0);
}

function scaledMoraleDamage(rawMoraleDamage: number, scenario: Scenario): number {
  return Math.trunc(((110 - scenario.targetBravery) * rawMoraleDamage) / 100);
}

export function buildDamageComponentCurve(
  weapon: WeaponSystem,
  scenario: Scenario,
  armor: number,
  damageTypes: DamageType[],
  randomProfiles: RandomProfile[] = [],
): Record<DamageMetricKey, DamageComponentCurvePoint[]> {
  const damageType = damageTypeFor(weapon, damageTypes);
  const hpComp = getDamageComponent(damageType, "hp");
  const stunComp = getDamageComponent(damageType, "stun");
  const moraleComp = getDamageComponent(damageType, "morale");
  const armorComp = getDamageComponent(damageType, "armor");
  const preArmorComp = getDamageComponent(damageType, "preArmor");
  const tuComp = getDamageComponent(damageType, "tu");
  const energyComp = getDamageComponent(damageType, "energy");
  const manaComp = getDamageComponent(damageType, "mana");
  const hpPercent = weapon.damageModifierOverrides?.hp ?? hpComp.percent;
  const stunPercent = weapon.damageModifierOverrides?.stun ?? stunComp.percent;
  const moralePercent = weapon.damageModifierOverrides?.morale ?? moraleComp.percent;
  const armorPercent = weapon.damageModifierOverrides?.armor ?? armorComp.percent;
  const preArmorPercent = weapon.damageModifierOverrides?.preArmor ?? preArmorComp.percent;
  const tuPercent = weapon.damageModifierOverrides?.tu ?? tuComp.percent;
  const energyPercent = weapon.damageModifierOverrides?.energy ?? energyComp.percent;
  const manaPercent = weapon.damageModifierOverrides?.mana ?? manaComp.percent;
  const hpRandomized = weapon.damageRandomizedOverrides?.hp ?? hpComp.randomized;
  const stunRandomized = weapon.damageRandomizedOverrides?.stun ?? stunComp.randomized;
  const moraleRandomized = weapon.damageRandomizedOverrides?.morale ?? moraleComp.randomized;
  const armorRandomized = weapon.damageRandomizedOverrides?.armor ?? armorComp.randomized;
  const preArmorRandomized = weapon.damageRandomizedOverrides?.preArmor ?? preArmorComp.randomized;
  const tuRandomized = weapon.damageRandomizedOverrides?.tu ?? tuComp.randomized;
  const energyRandomized = weapon.damageRandomizedOverrides?.energy ?? energyComp.randomized;
  const manaRandomized = weapon.damageRandomizedOverrides?.mana ?? manaComp.randomized;

  const curves: Record<DamageMetricKey, DamageComponentCurvePoint[]> = {
    hp: [],
    stun: [],
    "hp-stun": [],
    morale: [],
    scaledMorale: [],
    panicChance: [],
    armor: [],
    preArmor: [],
    tu: [],
    energy: [],
    mana: [],
  };

  let cumulative = 0;
  for (const outcome of rollOutcomes(weapon, scenario, damageTypes, randomProfiles)) {
    cumulative += outcome.probability;
    const postArmorDamage = damageFromRolledPower(
      weapon,
      scenario,
      armor,
      outcome.rolledPower,
      damageTypes,
    );
    const hpDamage = expectedIntegerComponent(postArmorDamage, hpPercent, !!hpRandomized);
    const stunDamage = expectedIntegerComponent(postArmorDamage, stunPercent, !!stunRandomized);
    const moraleDamage = expectedIntegerComponent(postArmorDamage, moralePercent, !!moraleRandomized);
    const armorDamage = expectedIntegerComponent(postArmorDamage, armorPercent, !!armorRandomized);
    const preArmorDamage = expectedIntegerComponent(outcome.rolledPower, preArmorPercent, !!preArmorRandomized);
    const tuDamage = expectedIntegerComponent(postArmorDamage, tuPercent, !!tuRandomized);
    const energyDamage = expectedIntegerComponent(postArmorDamage, energyPercent, !!energyRandomized);
    const manaDamage = expectedIntegerComponent(postArmorDamage, manaPercent, !!manaRandomized);

    const scaledMorale = scaledMoraleDamage(moraleDamage, scenario);
    const percentile = cumulative * 100;
    const rollPercent = outcome.rollPercent;
    const rolledPower = outcome.rolledPower;

    curves.hp.push({ percentile, rollPercent, rolledPower, value: hpDamage });
    curves.stun.push({ percentile, rollPercent, rolledPower, value: stunDamage });
    curves["hp-stun"].push({ percentile, rollPercent, rolledPower, value: hpDamage + stunDamage });
    curves.morale.push({ percentile, rollPercent, rolledPower, value: moraleDamage });
    curves.scaledMorale.push({ percentile, rollPercent, rolledPower, value: scaledMorale });
    curves.panicChance.push({ percentile, rollPercent, rolledPower, value: panicChanceFromScaledMoraleDamage(scaledMorale) });
    curves.armor.push({ percentile, rollPercent, rolledPower, value: armorDamage + preArmorDamage });
    curves.preArmor.push({ percentile, rollPercent, rolledPower, value: preArmorDamage });
    curves.tu.push({ percentile, rollPercent, rolledPower, value: tuDamage });
    curves.energy.push({ percentile, rollPercent, rolledPower, value: energyDamage });
    curves.mana.push({ percentile, rollPercent, rolledPower, value: manaDamage });
  }

  return curves;
}

export function buildDamageDistribution(
  weapon: WeaponSystem,
  scenario: Scenario,
  armor: number,
  damageTypes: DamageType[],
  randomProfiles: RandomProfile[] = [],
): DamageDistributionBucket[] {
  const counts = new Map<number, number>();
  const outcomes = rollOutcomes(weapon, scenario, damageTypes, randomProfiles);

  for (const outcome of outcomes) {
    const damage = Math.round(
      damageFromRolledPower(weapon, scenario, armor, outcome.rolledPower, damageTypes),
    );
    counts.set(damage, (counts.get(damage) ?? 0) + outcome.count);
  }

  const total = Math.max(1, outcomes.reduce((sum, outcome) => sum + outcome.count, 0));
  return [...counts.entries()]
    .map(([damage, count]) => ({
      damage,
      count,
      probability: count / total,
    }))
    .sort((a, b) => a.damage - b.damage);
}

export function buildDamageRollResults(
  weapon: WeaponSystem,
  scenario: Scenario,
  armor: number,
  damageTypes: DamageType[],
  randomProfiles: RandomProfile[] = [],
): DamageRollResult[] {
  const results: DamageRollResult[] = [];
  const damageType = damageTypeFor(weapon, damageTypes);

  const hpComp = getDamageComponent(damageType, "hp");
  const stunComp = getDamageComponent(damageType, "stun");
  const moraleComp = getDamageComponent(damageType, "morale");
  const armorComp = getDamageComponent(damageType, "armor");
  const preArmorComp = getDamageComponent(damageType, "preArmor");
  const tuComp = getDamageComponent(damageType, "tu");
  const energyComp = getDamageComponent(damageType, "energy");
  const manaComp = getDamageComponent(damageType, "mana");

  const hpPercent = weapon.damageModifierOverrides?.hp ?? hpComp.percent;
  const stunPercent = weapon.damageModifierOverrides?.stun ?? stunComp.percent;
  const moralePercent = weapon.damageModifierOverrides?.morale ?? moraleComp.percent;
  const armorPercent = weapon.damageModifierOverrides?.armor ?? armorComp.percent;
  const preArmorPercent = weapon.damageModifierOverrides?.preArmor ?? preArmorComp.percent;
  const tuPercent = weapon.damageModifierOverrides?.tu ?? tuComp.percent;
  const energyPercent = weapon.damageModifierOverrides?.energy ?? energyComp.percent;
  const manaPercent = weapon.damageModifierOverrides?.mana ?? manaComp.percent;

  const hpRandomized = weapon.damageRandomizedOverrides?.hp ?? hpComp.randomized;
  const stunRandomized = weapon.damageRandomizedOverrides?.stun ?? stunComp.randomized;
  const moraleRandomized = weapon.damageRandomizedOverrides?.morale ?? moraleComp.randomized;
  const armorRandomized = weapon.damageRandomizedOverrides?.armor ?? armorComp.randomized;
  const preArmorRandomized = weapon.damageRandomizedOverrides?.preArmor ?? preArmorComp.randomized;
  const tuRandomized = weapon.damageRandomizedOverrides?.tu ?? tuComp.randomized;
  const energyRandomized = weapon.damageRandomizedOverrides?.energy ?? energyComp.randomized;
  const manaRandomized = weapon.damageRandomizedOverrides?.mana ?? manaComp.randomized;

  for (const outcome of rollOutcomes(weapon, scenario, damageTypes, randomProfiles)) {
    const postArmorDamage = damageFromRolledPower(
      weapon,
      scenario,
      armor,
      outcome.rolledPower,
      damageTypes,
    );
    const hpOutcomes = componentRollOutcomes(postArmorDamage, hpPercent, !!hpRandomized);
    const stunOutcomes = componentRollOutcomes(postArmorDamage, stunPercent, !!stunRandomized);

    for (const hpOutcome of hpOutcomes) {
      for (const stunOutcome of stunOutcomes) {
        const hpDamage = hpOutcome.damage;
        const stunDamage = stunOutcome.damage;
        const moraleDamage = expectedIntegerComponent(postArmorDamage, moralePercent, !!moraleRandomized);
        const scaledMorale = scaledMoraleDamage(moraleDamage, scenario);
        const armorDamage = expectedIntegerComponent(postArmorDamage, armorPercent, !!armorRandomized);
        const preArmorDamage = expectedIntegerComponent(outcome.rolledPower, preArmorPercent, !!preArmorRandomized);
        const tuDamage = expectedIntegerComponent(postArmorDamage, tuPercent, !!tuRandomized);
        const energyDamage = expectedIntegerComponent(postArmorDamage, energyPercent, !!energyRandomized);
        const manaDamage = expectedIntegerComponent(postArmorDamage, manaPercent, !!manaRandomized);
        results.push({
          rollPercent: outcome.rollPercent,
          rolledPower: outcome.rolledPower,
          hpDamage,
          stunDamage,
          moraleDamage,
          scaledMoraleDamage: scaledMorale,
          panicChance: panicChanceFromScaledMoraleDamage(scaledMorale),
          armorDamage,
          preArmorDamage,
          tuDamage,
          energyDamage,
          manaDamage,
          totalDamage: hpDamage + stunDamage,
          damage: hpDamage,
          count: outcome.count * hpOutcome.count * stunOutcome.count,
          probability: outcome.probability * hpOutcome.probability * stunOutcome.probability,
        });
      }
    }
  }

  return results.sort((a, b) => a.totalDamage - b.totalDamage);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
