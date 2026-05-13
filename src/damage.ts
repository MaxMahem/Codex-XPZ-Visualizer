import type {
  DamageBonusEntry,
  DamageBonusStat,
  DamageDistributionBucket,
  DamageComponentCurvePoint,
  DamagePoint,
  DamageRollResult,
  DamageType,
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

export function computeDamageBonus(entries: DamageBonusEntry[], scenario: Scenario): number {
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
  hpDamagePercent: 1,
  hpDamageRandomized: false,
  stunDamagePercent: 0,
  stunDamageRandomized: false,
  moraleDamagePercent: 0,
  moraleDamageRandomized: false,
  armorDamagePercent: 0,
  armorDamageRandomized: false,
  tuDamagePercent: 0,
  tuDamageRandomized: false,
  energyDamagePercent: 0,
  energyDamageRandomized: false,
  manaDamagePercent: 0,
  manaDamageRandomized: false,
  randomProfileId: "0-200",
  color: "#66736b1c",
};

const fallbackRandomProfile: RandomProfile = {
  id: "0-200",
  label: "0-200",
  minPercent: 0,
  maxPercent: 200,
  dice: 1,
};

export function modifiedPower(weapon: WeaponSystem, scenario: Scenario): number {
  return weapon.basePower + computeDamageBonus(weapon.damageBonus, scenario);
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
  damageTypes: DamageType[],
  randomProfiles: RandomProfile[] = [],
): Array<{ rollPercent: number; count: number; probability: number }> {
  const profile = randomProfileFor(weapon, damageTypes, randomProfiles);
  const counts = new Map<number, number>();

  if (profile.dice === 2) {
    const dieMin = profile.minPercent / 2;
    const dieMax = profile.maxPercent / 2;
    for (let first = dieMin; first <= dieMax; first += 1) {
      for (let second = dieMin; second <= dieMax; second += 1) {
        const total = first + second;
        counts.set(total, (counts.get(total) ?? 0) + 1);
      }
    }
  } else {
    for (let percent = profile.minPercent; percent <= profile.maxPercent; percent += 1) {
      counts.set(percent, 1);
    }
  }

  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  return [...counts.entries()]
    .map(([rollPercent, count]) => ({
      rollPercent,
      count,
      probability: count / total,
    }))
    .sort((a, b) => a.rollPercent - b.rollPercent);
}

export function effectiveArmor(
  weapon: WeaponSystem,
  scenario: Scenario,
  armor: number,
  damageTypes: DamageType[],
): number {
  const penetration = clamp(weapon.armorPenetration, 0, 1);
  const armorEffectiveness = armorEffectivenessModifier(weapon, scenario, damageTypes);
  return armor * scenario.armorEffectiveness * armorEffectiveness * (1 - penetration);
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

export function expectedComponentDamage(
  weapon: WeaponSystem,
  scenario: Scenario,
  armor: number,
  damageTypes: DamageType[],
  component: DamageComponentKey,
  randomProfiles: RandomProfile[] = [],
): number {
  const damageType = damageTypeFor(weapon, damageTypes);
  const percent = weapon.damageModifierOverrides?.[component] ?? damageType[`${component}DamagePercent`] as number;
  const randomized = weapon.damageRandomizedOverrides?.[component] ?? damageType[`${component}DamageRandomized`] as boolean;

  return rollOutcomes(weapon, damageTypes, randomProfiles).reduce((sum, outcome) => {
    const postArmorDamage = damageAtRoll(
      weapon,
      scenario,
      armor,
      outcome.rollPercent / 100,
      damageTypes,
    );
    return sum + expectedRawComponent(postArmorDamage, percent, randomized) * outcome.probability;
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
  const power = modifiedPower(weapon, scenario);
  const damageType = damageTypeFor(weapon, damageTypes);
  const outcomes = rollOutcomes(weapon, damageTypes, randomProfiles);
  const averageRoll =
    outcomes.reduce((sum, outcome) => sum + outcome.rollPercent * outcome.probability, 0) / 100;
  return Math.max(
    0,
    Math.max(0, power * averageRoll - effectiveArmor(weapon, scenario, armor, damageTypes)) *
      (weapon.damageModifierOverrides?.hp ?? damageType.hpDamagePercent),
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
  const power = modifiedPower(weapon, scenario);
  return Math.max(
    0,
    power * rollMultiplier - effectiveArmor(weapon, scenario, armor, damageTypes),
  );
}

function componentRollOutcomes(randomized: boolean): Array<{ multiplier: number; probability: number }> {
  if (!randomized) {
    return [{ multiplier: 1, probability: 1 }];
  }

  const probability = 1 / 101;
  return Array.from({ length: 101 }, (_, value) => ({
    multiplier: value / 100,
    probability,
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

  if (!randomized) {
    return Math.floor(baseDamage * percent);
  }

  return (
    componentRollOutcomes(randomized).reduce(
      (sum, roll) => sum + Math.floor(baseDamage * percent * roll.multiplier) * roll.probability,
      0,
    )
  );
}

export function buildDamageComponentCurve(
  weapon: WeaponSystem,
  scenario: Scenario,
  armor: number,
  damageTypes: DamageType[],
  randomProfiles: RandomProfile[] = [],
): DamageComponentCurvePoint[] {
  let cumulative = 0;
  const damageType = damageTypeFor(weapon, damageTypes);
  const hpPercent = weapon.damageModifierOverrides?.hp ?? damageType.hpDamagePercent;
  const stunPercent = weapon.damageModifierOverrides?.stun ?? damageType.stunDamagePercent;
  const hpRandomized = weapon.damageRandomizedOverrides?.hp ?? damageType.hpDamageRandomized;
  const stunRandomized = weapon.damageRandomizedOverrides?.stun ?? damageType.stunDamageRandomized;

  return rollOutcomes(weapon, damageTypes, randomProfiles).map((outcome) => {
    cumulative += outcome.probability;
    const postArmorDamage = damageAtRoll(
      weapon,
      scenario,
      armor,
      outcome.rollPercent / 100,
      damageTypes,
    );
    const hpDamage = expectedIntegerComponent(postArmorDamage, hpPercent, hpRandomized);
    const stunDamage = expectedIntegerComponent(postArmorDamage, stunPercent, stunRandomized);

    return {
      percentile: cumulative * 100,
      rollPercent: outcome.rollPercent,
      hpDamage,
      stunDamage,
      totalDamage: hpDamage + stunDamage,
    };
  });
}

export function buildDamageDistribution(
  weapon: WeaponSystem,
  scenario: Scenario,
  armor: number,
  damageTypes: DamageType[],
  randomProfiles: RandomProfile[] = [],
): DamageDistributionBucket[] {
  const counts = new Map<number, number>();
  const outcomes = rollOutcomes(weapon, damageTypes, randomProfiles);

  for (const outcome of outcomes) {
    const damage = Math.floor(
      damageAtRoll(weapon, scenario, armor, outcome.rollPercent / 100, damageTypes),
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
  const hpPercent = weapon.damageModifierOverrides?.hp ?? damageType.hpDamagePercent;
  const stunPercent = weapon.damageModifierOverrides?.stun ?? damageType.stunDamagePercent;
  const moralePercent = weapon.damageModifierOverrides?.morale ?? damageType.moraleDamagePercent;
  const armorPercent = weapon.damageModifierOverrides?.armor ?? damageType.armorDamagePercent;
  const tuPercent = weapon.damageModifierOverrides?.tu ?? damageType.tuDamagePercent;
  const energyPercent = weapon.damageModifierOverrides?.energy ?? damageType.energyDamagePercent;
  const hpRolls = componentRollOutcomes(weapon.damageRandomizedOverrides?.hp ?? damageType.hpDamageRandomized);
  const stunRolls = componentRollOutcomes(weapon.damageRandomizedOverrides?.stun ?? damageType.stunDamageRandomized);
  const moraleRandomized = weapon.damageRandomizedOverrides?.morale ?? damageType.moraleDamageRandomized;
  const armorRandomized = weapon.damageRandomizedOverrides?.armor ?? damageType.armorDamageRandomized;
  const tuRandomized = weapon.damageRandomizedOverrides?.tu ?? damageType.tuDamageRandomized;
  const energyRandomized = weapon.damageRandomizedOverrides?.energy ?? damageType.energyDamageRandomized;
  const manaPercent = weapon.damageModifierOverrides?.mana ?? damageType.manaDamagePercent;
  const manaRandomized = weapon.damageRandomizedOverrides?.mana ?? damageType.manaDamageRandomized;

  for (const outcome of rollOutcomes(weapon, damageTypes, randomProfiles)) {
    const postArmorDamage = damageAtRoll(
      weapon,
      scenario,
      armor,
      outcome.rollPercent / 100,
      damageTypes,
    );

    for (const hpRoll of hpRolls) {
      for (const stunRoll of stunRolls) {
        const hpDamage = Math.floor(postArmorDamage * hpPercent * hpRoll.multiplier);
        const stunDamage = Math.floor(postArmorDamage * stunPercent * stunRoll.multiplier);
        const moraleDamage = expectedIntegerComponent(postArmorDamage, moralePercent, moraleRandomized);
        const armorDamage = expectedIntegerComponent(postArmorDamage, armorPercent, armorRandomized);
        const tuDamage = expectedIntegerComponent(postArmorDamage, tuPercent, tuRandomized);
        const energyDamage = expectedIntegerComponent(postArmorDamage, energyPercent, energyRandomized);
        const manaDamage = expectedIntegerComponent(postArmorDamage, manaPercent, manaRandomized);
        results.push({
          rollPercent: outcome.rollPercent,
          hpDamage,
          stunDamage,
          moraleDamage,
          armorDamage,
          tuDamage,
          energyDamage,
          manaDamage,
          totalDamage: hpDamage + stunDamage,
          damage: hpDamage,
          count: outcome.count,
          probability: outcome.probability * hpRoll.probability * stunRoll.probability,
        });
      }
    }
  }

  return results.sort((a, b) => a.totalDamage - b.totalDamage);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
