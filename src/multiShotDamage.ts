import type {
  DamageType,
  DamageComponentCurvePoint,
  DamageComponentKey,
  DamageMetricKey,
  DamageRollResult,
  RandomProfile,
  Scenario,
  WeaponSystem,
} from "./types";
import {
  damageFromRolledPower,
  damageTypeFor,
  getDamageComponent,
  rolledPowerBase,
  rollOutcomes,
} from "./damage.ts";

export interface MultiShotDamageRollResult {
  hpDamage: number;
  stunDamage: number;
  totalDamage: number;
  count: number;
  probability: number;
}

export interface MultiShotDamageStats {
  zeroChance: number;
  killChance: number;
  koChance: number;
  outcomeCount: number;
}

interface CappedRollOutcome {
  hpDamage: number;
  totalDamage: number;
  probability: number;
}

interface CappedSingleShotDistribution {
  hpOutcomes: CappedDamageOutcome[];
  totalOutcomes: CappedDamageOutcome[];
  outcomeCount: number;
}

interface CappedDamageOutcome {
  damage: number;
  probability: number;
}

interface DamageDistribution {
  probabilities: Float64Array;
  activeValues: number[];
}

type PowerCurveValueKey = DamageComponentKey | "scaledMorale";

interface PowerCurveState {
  probability: number;
  values: Record<PowerCurveValueKey, number>;
}

interface SingleShotPowerOutcome {
  rolledPower: number;
  probability: number;
  values: Record<PowerCurveValueKey, number>;
}

const curveKeys: DamageComponentKey[] = [
  "hp",
  "stun",
  "morale",
  "armor",
  "preArmor",
  "tu",
  "energy",
  "mana",
];

export function multiplyExpectedDamageComponents(
  components: Record<DamageComponentKey, number>,
  shotCount: number,
): Record<DamageComponentKey, number> {
  return {
    hp: components.hp * shotCount,
    stun: components.stun * shotCount,
    morale: components.morale * shotCount,
    armor: components.armor * shotCount,
    preArmor: components.preArmor * shotCount,
    tu: components.tu * shotCount,
    energy: components.energy * shotCount,
    mana: components.mana * shotCount,
  };
}

export function buildMultiShotDamageRollResults(
  singleShotResults: DamageRollResult[],
  shotCount: number,
): MultiShotDamageRollResult[] {
  const base = compactRollResults(singleShotResults.map((result) => ({
    hpDamage: result.hpDamage,
    stunDamage: result.stunDamage,
    totalDamage: result.totalDamage,
    count: result.count,
    probability: result.probability,
  })));

  if (shotCount === 1) {
    return base;
  }

  const damageKeyBase = rollDamageKeyBase(base, shotCount);
  let distribution = new Map<number, MultiShotDamageRollResult>();
  distribution.set(0, {
    hpDamage: 0,
    stunDamage: 0,
    totalDamage: 0,
    count: 1,
    probability: 1,
  });

  for (let shot = 0; shot < shotCount; shot += 1) {
    const next = new Map<number, MultiShotDamageRollResult>();
    for (const current of distribution.values()) {
      for (const outcome of base) {
        const hpDamage = current.hpDamage + outcome.hpDamage;
        const stunDamage = current.stunDamage + outcome.stunDamage;
        const key = rollDamageKey(hpDamage, stunDamage, damageKeyBase);
        const existing = next.get(key);
        if (existing) {
          existing.count += current.count * outcome.count;
          existing.probability += current.probability * outcome.probability;
        } else {
          next.set(key, {
            hpDamage,
            stunDamage,
            totalDamage: hpDamage + stunDamage,
            count: current.count * outcome.count,
            probability: current.probability * outcome.probability,
          });
        }
      }
    }
    distribution = next;
  }

  return [...distribution.values()].sort((a, b) => a.totalDamage - b.totalDamage);
}

export function buildMultiShotDamageStats(
  singleShotResults: DamageRollResult[],
  shotCount: number,
  hitPoints: number,
): MultiShotDamageStats {
  const hpThreshold = Math.max(0, Math.trunc(hitPoints));
  const totalThreshold = hpThreshold + 1;
  const compacted = compactCappedRollResults(singleShotResults, hpThreshold, totalThreshold);
  return convolveCappedDamageStats(
    compacted.hpOutcomes,
    compacted.totalOutcomes,
    shotCount,
    hpThreshold,
    totalThreshold,
    singleShotResults.reduce((sum, result) => sum + result.count, 0),
  );
}

export function buildMultiShotDamageStatsForWeapon(
  weapon: WeaponSystem,
  scenario: Scenario,
  armor: number,
  damageTypes: DamageType[],
  shotCount: number,
  randomProfiles: RandomProfile[] = [],
): MultiShotDamageStats {
  const hpThreshold = Math.max(0, Math.trunc(scenario.hitPoints));
  const totalThreshold = hpThreshold + 1;
  const singleShot = buildCappedSingleShotDistribution(
    weapon,
    scenario,
    armor,
    damageTypes,
    randomProfiles,
    hpThreshold,
    totalThreshold,
  );

  return convolveCappedDamageStats(
    singleShot.hpOutcomes,
    singleShot.totalOutcomes,
    shotCount,
    hpThreshold,
    totalThreshold,
    singleShot.outcomeCount,
  );
}


function requestedCurveKeys(metrics: DamageMetricKey[]): DamageComponentKey[] {
  const keys = new Set<DamageComponentKey>();
  for (const metric of metrics) {
    switch (metric) {
      case "hp":
        keys.add("hp");
        break;
      case "stun":
        keys.add("stun");
        break;
      case "hp-stun":
        keys.add("hp");
        keys.add("stun");
        break;
      case "morale":
      case "scaledMorale":
      case "panicChance":
        keys.add("morale");
        break;
      case "armor":
        keys.add("armor");
        keys.add("preArmor");
        break;
      default:
        keys.add(metric);
        break;
    }
  }

  return curveKeys.filter((key) => keys.has(key));
}

export function buildSingleShotComponentCurveForMetrics(
  weapon: WeaponSystem,
  scenario: Scenario,
  armor: number,
  damageTypes: DamageType[],
  randomProfiles: RandomProfile[] = [],
  requestedMetrics: DamageMetricKey[] = ["hp", "stun"],
): Record<DamageMetricKey, DamageComponentCurvePoint[]> {
  const requestedKeys = requestedCurveKeys(requestedMetrics);
  const damageType = damageTypeFor(weapon, damageTypes);
  const settings = componentSettingsFor(weapon, damageType);
  const needsPostArmor = requestedKeys.some((key) => key !== "preArmor");

  const outcomes = rollOutcomes(weapon, scenario, damageTypes, randomProfiles);

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
  for (const outcome of outcomes) {
    cumulative += outcome.probability;
    const postArmorDamage = needsPostArmor
      ? damageFromRolledPower(weapon, scenario, armor, outcome.rolledPower, damageTypes)
      : 0;

    const percentile = cumulative * 100;
    const rollPercent = outcome.rollPercent;
    const rolledPower = outcome.rolledPower;

    for (const metric of requestedMetrics) {
      let value = 0;
      switch (metric) {
        case "hp":
          value = expectedIntegerComponent(postArmorDamage, settings.hp.percent, settings.hp.randomized);
          break;
        case "stun":
          value = expectedIntegerComponent(postArmorDamage, settings.stun.percent, settings.stun.randomized);
          break;
        case "hp-stun": {
          const hp = expectedIntegerComponent(postArmorDamage, settings.hp.percent, settings.hp.randomized);
          const stun = expectedIntegerComponent(postArmorDamage, settings.stun.percent, settings.stun.randomized);
          value = hp + stun;
          break;
        }
        case "morale":
          value = expectedIntegerComponent(postArmorDamage, settings.morale.percent, settings.morale.randomized);
          break;
        case "scaledMorale": {
          const morale = expectedIntegerComponent(postArmorDamage, settings.morale.percent, settings.morale.randomized);
          value = Math.trunc(((110 - scenario.targetBravery) * morale) / 100);
          break;
        }
        case "panicChance": {
          const morale = expectedIntegerComponent(postArmorDamage, settings.morale.percent, settings.morale.randomized);
          const scaled = Math.trunc(((110 - scenario.targetBravery) * morale) / 100);
          value = panicChanceFromScaledMoraleDamage(scaled);
          break;
        }
        case "armor": {
          const armorDmg = expectedIntegerComponent(postArmorDamage, settings.armor.percent, settings.armor.randomized);
          const preArmorDmg = expectedIntegerComponent(outcome.rolledPower, settings.preArmor.percent, settings.preArmor.randomized);
          value = armorDmg + preArmorDmg;
          break;
        }
        case "preArmor":
          value = expectedIntegerComponent(outcome.rolledPower, settings.preArmor.percent, settings.preArmor.randomized);
          break;
        case "tu":
          value = expectedIntegerComponent(postArmorDamage, settings.tu.percent, settings.tu.randomized);
          break;
        case "energy":
          value = expectedIntegerComponent(postArmorDamage, settings.energy.percent, settings.energy.randomized);
          break;
        case "mana":
          value = expectedIntegerComponent(postArmorDamage, settings.mana.percent, settings.mana.randomized);
          break;
      }
      curves[metric].push({ percentile, rollPercent, rolledPower, value });
    }
  }

  return curves;
}

export function buildMultiShotProjectionCurveForWeapon(
  weapon: WeaponSystem,
  scenario: Scenario,
  armor: number,
  damageTypes: DamageType[],
  shotCount: number,
  randomProfiles: RandomProfile[] = [],
  requestedMetrics: DamageMetricKey[] = ["hp", "stun"],
): Record<DamageMetricKey, DamageComponentCurvePoint[]> {
  const requestedKeys = requestedCurveKeys(requestedMetrics);
  const powerDistribution = powerCurveDistributionForWeapon(
    weapon,
    scenario,
    armor,
    damageTypes,
    randomProfiles,
    requestedKeys,
    shotCount,
  );

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
  const totalBasePower = rolledPowerBase(weapon, scenario) * shotCount;
  for (const rolledPower of [...powerDistribution.keys()].sort((a, b) => a - b)) {
    const state = powerDistribution.get(rolledPower);
    if (!state || state.probability <= 0) {
      continue;
    }

    cumulative += state.probability;
    const percentile = Math.min(100, cumulative * 100);
    const values = expectedPowerCurveValues(state);

    for (const metric of requestedMetrics) {
      curves[metric].push({
        percentile,
        rollPercent: totalBasePower > 0 ? (rolledPower / totalBasePower) * 100 : 0,
        rolledPower,
        value: curveValueForMetric(metric, values),
      });
    }
  }

  return curves;
}

function powerCurveDistributionForWeapon(
  weapon: WeaponSystem,
  scenario: Scenario,
  armor: number,
  damageTypes: DamageType[],
  randomProfiles: RandomProfile[],
  requestedKeys: DamageComponentKey[],
  shotCount: number,
): Map<number, PowerCurveState> {
  const singleShot = singleShotPowerCurveOutcomes(
    weapon,
    scenario,
    armor,
    damageTypes,
    randomProfiles,
    requestedKeys,
  );
  let distribution = new Map<number, PowerCurveState>();
  distribution.set(0, { probability: 1, values: emptyPowerCurveValues() });

  for (let shot = 0; shot < shotCount; shot += 1) {
    const next = new Map<number, PowerCurveState>();
    for (const [currentPower, current] of distribution.entries()) {
      for (const outcome of singleShot) {
        const rolledPower = currentPower + outcome.rolledPower;
        const probability = current.probability * outcome.probability;
        const existing = next.get(rolledPower) ?? {
          probability: 0,
          values: emptyPowerCurveValues(),
        };

        existing.probability += probability;
        for (const key of powerCurveValueKeys) {
          existing.values[key] +=
            outcome.probability * current.values[key] +
            probability * outcome.values[key];
        }
        next.set(rolledPower, existing);
      }
    }
    distribution = next;
  }

  return distribution;
}

function singleShotPowerCurveOutcomes(
  weapon: WeaponSystem,
  scenario: Scenario,
  armor: number,
  damageTypes: DamageType[],
  randomProfiles: RandomProfile[],
  requestedKeys: DamageComponentKey[],
): SingleShotPowerOutcome[] {
  const damageType = damageTypeFor(weapon, damageTypes);
  const settings = componentSettingsFor(weapon, damageType);
  const needsPostArmor = requestedKeys.some((key) => key !== "preArmor");

  return rollOutcomes(weapon, scenario, damageTypes, randomProfiles).map((outcome) => {
    const postArmorDamage = needsPostArmor
      ? damageFromRolledPower(weapon, scenario, armor, outcome.rolledPower, damageTypes)
      : 0;
    const values = emptyPowerCurveValues();

    if (requestedKeys.includes("hp")) {
      values.hp = expectedIntegerComponent(postArmorDamage, settings.hp.percent, settings.hp.randomized);
    }
    if (requestedKeys.includes("stun")) {
      values.stun = expectedIntegerComponent(postArmorDamage, settings.stun.percent, settings.stun.randomized);
    }
    if (requestedKeys.includes("morale")) {
      values.morale = expectedIntegerComponent(postArmorDamage, settings.morale.percent, settings.morale.randomized);
      values.scaledMorale = Math.trunc(((110 - scenario.targetBravery) * values.morale) / 100);
    }
    if (requestedKeys.includes("armor")) {
      values.armor = expectedIntegerComponent(postArmorDamage, settings.armor.percent, settings.armor.randomized);
    }
    if (requestedKeys.includes("preArmor")) {
      values.preArmor = expectedIntegerComponent(outcome.rolledPower, settings.preArmor.percent, settings.preArmor.randomized);
    }
    if (requestedKeys.includes("tu")) {
      values.tu = expectedIntegerComponent(postArmorDamage, settings.tu.percent, settings.tu.randomized);
    }
    if (requestedKeys.includes("energy")) {
      values.energy = expectedIntegerComponent(postArmorDamage, settings.energy.percent, settings.energy.randomized);
    }
    if (requestedKeys.includes("mana")) {
      values.mana = expectedIntegerComponent(postArmorDamage, settings.mana.percent, settings.mana.randomized);
    }

    return {
      rolledPower: outcome.rolledPower,
      probability: outcome.probability,
      values,
    };
  });
}

const powerCurveValueKeys: PowerCurveValueKey[] = [
  "hp",
  "stun",
  "morale",
  "armor",
  "preArmor",
  "tu",
  "energy",
  "mana",
  "scaledMorale",
];

function emptyPowerCurveValues(): Record<PowerCurveValueKey, number> {
  return {
    hp: 0,
    stun: 0,
    morale: 0,
    armor: 0,
    preArmor: 0,
    tu: 0,
    energy: 0,
    mana: 0,
    scaledMorale: 0,
  };
}

function expectedPowerCurveValues(state: PowerCurveState): Record<PowerCurveValueKey, number> {
  const values = emptyPowerCurveValues();
  for (const key of powerCurveValueKeys) {
    values[key] = state.values[key] / state.probability;
  }
  return values;
}

function curveValueForMetric(
  metric: DamageMetricKey,
  values: Record<PowerCurveValueKey, number>,
): number {
  switch (metric) {
    case "hp-stun":
      return values.hp + values.stun;
    case "scaledMorale":
      return values.scaledMorale;
    case "panicChance":
      return panicChanceFromScaledMoraleDamage(values.scaledMorale);
    case "armor":
      return values.armor + values.preArmor;
    default:
      return values[metric];
  }
}

function convolveCappedDamageStats(
  hpOutcomes: CappedDamageOutcome[],
  totalOutcomes: CappedDamageOutcome[],
  shots: number,
  hpThreshold: number,
  totalThreshold: number,
  singleShotOutcomeCount: number,
): MultiShotDamageStats {
  const outcomeCount = Math.pow(singleShotOutcomeCount, shots);
  const hpDistribution = convolveCappedOneDimensionalDistribution(hpOutcomes, shots, hpThreshold);
  const totalDistribution = convolveCappedOneDimensionalDistribution(totalOutcomes, shots, totalThreshold);

  return {
    zeroChance: totalDistribution[0],
    killChance: hpDistribution[hpThreshold],
    koChance: totalDistribution[totalThreshold],
    outcomeCount,
  };
}

function compactProjectionOutcomes(
  outcomes: Array<{ damage: number; probability: number }>,
): CappedDamageOutcome[] {
  const maxDamage = outcomes.reduce((max, outcome) => Math.max(max, outcome.damage), 0);
  const probabilities = new Float64Array(maxDamage + 1);
  const activeValues: number[] = [];
  for (const outcome of outcomes) {
    const damage = Math.max(0, Math.trunc(outcome.damage));
    if (probabilities[damage] === 0) {
      activeValues.push(damage);
    }
    probabilities[damage] += outcome.probability;
  }
  return activeValues.map((damage) => ({ damage, probability: probabilities[damage] }));
}

function convolveProjectionDistribution(
  base: CappedDamageOutcome[],
  shots: number,
): DamageDistribution {
  const maxSingleDamage = base.reduce((max, outcome) => Math.max(max, outcome.damage), 0);
  const threshold = maxSingleDamage * shots;
  const probabilities = convolveCappedOneDimensionalDistribution(base, shots, threshold);
  const activeValues: number[] = [];
  for (let damage = 0; damage < probabilities.length; damage += 1) {
    if (probabilities[damage] > 0) {
      activeValues.push(damage);
    }
  }

  return { probabilities, activeValues };
}

function projectionPercentiles(
  distributions: Partial<Record<string, DamageDistribution>>,
): number[] {
  const breakpoints: number[] = [];
  for (const distribution of Object.values(distributions)) {
    if (!distribution) continue;
    let cumulative = 0;
    for (const damage of distribution.activeValues) {
      cumulative += distribution.probabilities[damage];
      breakpoints.push(cumulative * 100);
    }
  }

  if (breakpoints.length === 0) {
    return [100];
  }

  breakpoints.sort((a, b) => a - b);
  const unique: number[] = [];
  for (const percentile of breakpoints) {
    const clamped = Math.min(100, Math.max(0, percentile));
    if (unique.length === 0 || Math.abs(clamped - unique[unique.length - 1]) > 1e-9) {
      unique.push(clamped);
    }
  }
  return unique;
}

function quantileAt(distribution: DamageDistribution | undefined, percentile: number): number {
  if (!distribution) return 0;
  const target = percentile / 100;
  let cumulative = 0;
  for (const damage of distribution.activeValues) {
    cumulative += distribution.probabilities[damage];
    if (cumulative + 1e-12 >= target) {
      return damage;
    }
  }
  return distribution.activeValues[distribution.activeValues.length - 1] ?? 0;
}

function convolveCappedOneDimensionalDistribution(
  base: CappedDamageOutcome[],
  shots: number,
  threshold: number,
): Float64Array {
  let probabilities = new Float64Array(threshold + 1);
  let activeValues = [0];
  probabilities[0] = 1;
  for (let shot = 0; shot < shots; shot += 1) {
    const nextProbabilities = new Float64Array(threshold + 1);
    const nextActiveValues: number[] = [];
    for (const currentDamage of activeValues) {
      const currentProbability = probabilities[currentDamage];
      for (const outcome of base) {
        const damage = Math.min(threshold, currentDamage + outcome.damage);
        if (nextProbabilities[damage] === 0) {
          nextActiveValues.push(damage);
        }
        nextProbabilities[damage] += currentProbability * outcome.probability;
      }
    }
    probabilities = nextProbabilities;
    activeValues = nextActiveValues;
  }

  return probabilities;
}

function buildCappedSingleShotDistribution(
  weapon: WeaponSystem,
  scenario: Scenario,
  armor: number,
  damageTypes: DamageType[],
  randomProfiles: RandomProfile[],
  hpThreshold: number,
  totalThreshold: number,
): CappedSingleShotDistribution {
  const damageType = damageTypeFor(weapon, damageTypes);
  const hpComp = getDamageComponent(damageType, "hp");
  const stunComp = getDamageComponent(damageType, "stun");
  const hpPercent = weapon.damageModifierOverrides?.hp ?? hpComp.percent;
  const stunPercent = weapon.damageModifierOverrides?.stun ?? stunComp.percent;
  const hpRandomized = weapon.damageRandomizedOverrides?.hp ?? hpComp.randomized;
  const stunRandomized = weapon.damageRandomizedOverrides?.stun ?? stunComp.randomized;

  const hpProbabilities = new Float64Array(hpThreshold + 1);
  const totalProbabilities = new Float64Array(totalThreshold + 1);
  const activeHpDamages: number[] = [];
  const activeTotalDamages: number[] = [];
  let outcomeCount = 0;

  for (const outcome of rollOutcomes(weapon, scenario, damageTypes, randomProfiles)) {
    const postArmorDamage = damageFromRolledPower(
      weapon,
      scenario,
      armor,
      outcome.rolledPower,
      damageTypes,
    );
    const hpOutcomes = cappedComponentRollOutcomes(postArmorDamage, hpPercent, !!hpRandomized, totalThreshold);
    const stunOutcomes = cappedComponentRollOutcomes(postArmorDamage, stunPercent, !!stunRandomized, totalThreshold);
    outcomeCount += outcome.count * hpOutcomes.totalCount * stunOutcomes.totalCount;

    for (const hpOutcome of hpOutcomes.outcomes) {
      const hpDamage = Math.min(hpThreshold, hpOutcome.damage);
      if (hpProbabilities[hpDamage] === 0) {
        activeHpDamages.push(hpDamage);
      }
      hpProbabilities[hpDamage] += outcome.probability * hpOutcome.probability;

      for (const stunOutcome of stunOutcomes.outcomes) {
        const totalDamage = Math.min(totalThreshold, hpOutcome.damage + stunOutcome.damage);
        if (totalProbabilities[totalDamage] === 0) {
          activeTotalDamages.push(totalDamage);
        }
        totalProbabilities[totalDamage] += outcome.probability * hpOutcome.probability * stunOutcome.probability;
      }
    }
  }

  return {
    outcomeCount,
    hpOutcomes: activeHpDamages.map((damage) => ({ damage, probability: hpProbabilities[damage] })),
    totalOutcomes: activeTotalDamages.map((damage) => ({ damage, probability: totalProbabilities[damage] })),
  };
}

function cappedComponentRollOutcomes(
  baseDamage: number,
  percent: number,
  randomized: boolean,
  threshold: number,
): { outcomes: Array<{ damage: number; probability: number }>; totalCount: number } {
  const damage = Math.max(0, Math.trunc(baseDamage));
  if (percent <= 0 || damage <= 0) {
    return { outcomes: [{ damage: 0, probability: 1 }], totalCount: 1 };
  }

  if (!randomized) {
    return {
      outcomes: [{ damage: Math.min(threshold, Math.round(damage * percent)), probability: 1 }],
      totalCount: 1,
    };
  }

  const counts = new Uint32Array(threshold + 1);
  for (let roll = 0; roll <= damage; roll += 1) {
    const rolledDamage = Math.min(threshold, Math.round(roll * percent));
    counts[rolledDamage] += 1;
  }

  const outcomes: Array<{ damage: number; probability: number }> = [];
  const totalCount = damage + 1;
  for (let rolledDamage = 0; rolledDamage < counts.length; rolledDamage += 1) {
    const count = counts[rolledDamage];
    if (count > 0) {
      outcomes.push({ damage: rolledDamage, probability: count / totalCount });
    }
  }

  return { outcomes, totalCount };
}

function componentSettingsFor(weapon: WeaponSystem, damageType: DamageType) {
  return {
    hp: componentSettingFor(weapon, damageType, "hp"),
    stun: componentSettingFor(weapon, damageType, "stun"),
    morale: componentSettingFor(weapon, damageType, "morale"),
    armor: componentSettingFor(weapon, damageType, "armor"),
    preArmor: componentSettingFor(weapon, damageType, "preArmor"),
    tu: componentSettingFor(weapon, damageType, "tu"),
    energy: componentSettingFor(weapon, damageType, "energy"),
    mana: componentSettingFor(weapon, damageType, "mana"),
  };
}

function componentSettingFor(
  weapon: WeaponSystem,
  damageType: DamageType,
  component: DamageComponentKey,
): { percent: number; randomized: boolean } {
  const setting = getDamageComponent(damageType, component);
  return {
    percent: weapon.damageModifierOverrides?.[component] ?? setting.percent,
    randomized: weapon.damageRandomizedOverrides?.[component] ?? !!setting.randomized,
  };
}

function expectedIntegerComponent(baseDamage: number, percent: number, randomized: boolean): number {
  return Math.round(expectedRawComponent(baseDamage, percent, randomized));
}

function expectedRawComponent(baseDamage: number, percent: number, randomized: boolean): number {
  const damage = Math.max(0, Math.trunc(baseDamage));
  if (percent <= 0 || damage <= 0) {
    return 0;
  }

  if (!randomized) {
    return Math.round(damage * percent);
  }

  let total = 0;
  for (let roll = 0; roll <= damage; roll += 1) {
    total += Math.round(roll * percent);
  }
  return total / (damage + 1);
}

export function buildMultiShotComponentCurve(
  singleShotCurve: Record<DamageMetricKey, DamageComponentCurvePoint[]>,
  shotCount: number,
  requestedMetrics: DamageMetricKey[] = ["hp", "stun"],
): Record<DamageMetricKey, DamageComponentCurvePoint[]> {
  if (shotCount === 1) {
    const result = {} as Record<DamageMetricKey, DamageComponentCurvePoint[]>;
    for (const metric of requestedMetrics) {
      result[metric] = singleShotCurve[metric] ?? [];
    }
    return result;
  }

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

  const distKeys = [...requestedMetrics, "rolledPower" as DamageMetricKey];
  const distributions = {} as Record<DamageMetricKey, DamageDistribution>;

  for (const key of distKeys) {
    const firstMetric = requestedMetrics.find((m) => singleShotCurve[m]?.length > 0) ?? requestedMetrics[0];
    const points = singleShotCurve[firstMetric] ?? [];
    if (points.length === 0) continue;

    const outcomes: CappedDamageOutcome[] = [];
    let prevPercentile = 0;
    const targetPoints = (key as string) === "rolledPower" ? points : (singleShotCurve[key] ?? []);
    if (targetPoints.length === 0) continue;

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const probability = (p.percentile - prevPercentile) / 100;
      prevPercentile = p.percentile;
      if (probability > 0) {
        const damage = (key as string) === "rolledPower" ? p.rolledPower : targetPoints[i].value;
        outcomes.push({ damage, probability });
      }
    }

    distributions[key] = convolveProjectionDistribution(compactProjectionOutcomes(outcomes), shotCount);
  }

  const requestedDistributions = {} as Record<DamageMetricKey, DamageDistribution>;
  for (const metric of requestedMetrics) {
    if (distributions[metric]) {
      requestedDistributions[metric] = distributions[metric];
    }
  }
  const percentiles = projectionPercentiles(requestedDistributions);

  for (const metric of requestedMetrics) {
    const dist = distributions[metric];
    const rolledPowerDist = distributions["rolledPower" as DamageMetricKey];
    if (!dist) {
      curves[metric] = [];
      continue;
    }
    curves[metric] = percentiles.map((percentile) => ({
      percentile,
      rollPercent: percentile,
      rolledPower: quantileAt(rolledPowerDist, percentile),
      value: quantileAt(dist, percentile),
    }));
  }

  return curves;
}

function panicChanceFromScaledMoraleDamage(scaledMoraleDamage: number): number {
  const remainingMorale = Math.max(0, 100 - scaledMoraleDamage);
  return Math.min(100, Math.max(0, 100 - 2 * remainingMorale));
}

function compactRollResults(results: MultiShotDamageRollResult[]): MultiShotDamageRollResult[] {
  const compacted = new Map<number, MultiShotDamageRollResult>();
  const keyBase = rollDamageKeyBase(results, 1);
  for (const result of results) {
    const key = rollDamageKey(result.hpDamage, result.stunDamage, keyBase);
    const existing = compacted.get(key);
    if (existing) {
      existing.count += result.count;
      existing.probability += result.probability;
    } else {
      compacted.set(key, { ...result });
    }
  }

  return [...compacted.values()].sort((a, b) => a.totalDamage - b.totalDamage);
}

function rollDamageKeyBase(results: MultiShotDamageRollResult[], shotCount: number): number {
  const maxStun = results.reduce((max, result) => Math.max(max, result.stunDamage), 0);
  return Math.max(1, Math.trunc(maxStun) * shotCount) + 1;
}

function rollDamageKey(hpDamage: number, stunDamage: number, base: number): number {
  return Math.trunc(hpDamage) * base + Math.trunc(stunDamage);
}

function compactCappedRollResults(
  results: DamageRollResult[],
  hpThreshold: number,
  totalThreshold: number,
): CappedSingleShotDistribution {
  const hpProbabilities = new Float64Array(hpThreshold + 1);
  const totalProbabilities = new Float64Array(totalThreshold + 1);
  const activeHpDamages: number[] = [];
  const activeTotalDamages: number[] = [];
  let outcomeCount = 0;
  for (const result of results) {
    const hpDamage = Math.min(hpThreshold, result.hpDamage);
    const totalDamage = Math.min(totalThreshold, result.hpDamage + result.stunDamage);
    if (hpProbabilities[hpDamage] === 0) {
      activeHpDamages.push(hpDamage);
    }
    if (totalProbabilities[totalDamage] === 0) {
      activeTotalDamages.push(totalDamage);
    }
    hpProbabilities[hpDamage] += result.probability;
    totalProbabilities[totalDamage] += result.probability;
    outcomeCount += result.count;
  }

  return {
    outcomeCount,
    hpOutcomes: activeHpDamages.map((damage) => ({ damage, probability: hpProbabilities[damage] })),
    totalOutcomes: activeTotalDamages.map((damage) => ({ damage, probability: totalProbabilities[damage] })),
  };
}
