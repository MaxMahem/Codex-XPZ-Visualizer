import assert from "node:assert/strict";
import test from "node:test";
import {
  armorEffectivenessModifier,
  buildDamageComponentCurve,
  buildDamageRollResults,
  damageAtRoll,
  effectiveArmor,
  expectedDamage,
  expectedComponentDamage,
  expectedPanicChance,
  expectedTotalDamage,
  panicChanceFromScaledMoraleDamage,
  rollOutcomes,
  targetDamageModifier,
} from "../src/damage.ts";
import {
  buildMultiShotComponentCurve,
  buildMultiShotDamageRollResults,
  buildMultiShotDamageStats,
  buildMultiShotDamageStatsForWeapon,
  buildMultiShotProjectionCurveForWeapon,
  buildSingleShotComponentCurveForMetrics,
  multiplyExpectedDamageComponents,
} from "../src/multiShotDamage.ts";

import {
  importOpenXcomArmors,
  importOpenXcomItems,
  importOpenXcomSoldiers,
  importOpenXcomTranslations,
  importOpenXcomUnits,
} from "../src/rulImport.ts";
import { damageModifiersForArmor, mergeArmorsById } from "../src/stores/scenarioStoreHelpers.ts";
import type { DamageType, RandomProfile, Scenario, WeaponSystem, DamageMetricKey, DamageComponentCurvePoint } from "../src/types.ts";
import { translatedDamageTypeName } from "../src/utils/damageTypeTranslations.ts";

const scenario: Scenario = {
  tu: 50,
  stamina: 50,
  health: 40,
  strength: 0,
  melee: 0,
  bravery: 50,
  firing: 50,
  reactions: 50,
  throwing: 50,
  psiStrength: 50,
  psiSkill: 0,
  mana: 0,
  rank: 0,
  hitPoints: 45,
  targetBravery: 50,
  armor: 40,
  armorEffectiveness: 1,
  targetDamageModifiers: undefined,
  armorMin: 0,
  armorMax: 100,
  armorStep: 5,
};

const flatProfile: RandomProfile = {
  id: "flat-power",
  label: "Flat power",
  minPercent: 100,
  maxPercent: 100,
  dice: 1,
};

const standardProfile: RandomProfile = {
  id: "0-200",
  label: "0-200",
  minPercent: 0,
  maxPercent: 200,
  dice: 1,
};

const twoDiceProfile: RandomProfile = {
  id: "0-200-2d",
  label: "0-200 (2 dice)",
  minPercent: 0,
  maxPercent: 200,
  dice: 2,
};

const flatHpType: DamageType = {
  id: "flat-hp",
  name: "Flat HP",
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
  randomProfileId: "flat-power",
  color: "#000000",
};

const weapon: WeaponSystem = {
  id: "test",
  name: "Test",
  category: "Test",
  damageTypeId: "flat-hp",
  basePower: 40,
  armorPenetration: 0,
  strengthBonus: 0,
  meleeBonus: 0,
  color: "#000000",
};

function range(start: number, end: number): number[] {
  const values: number[] = [];
  for (let value = start; value <= end; value += 1) {
    values.push(value);
  }
  return values;
}

function totalFromRollResults(
  testWeapon: WeaponSystem,
  testScenario: Scenario,
  armor: number,
  damageTypes: DamageType[],
  profiles: RandomProfile[],
): number {
  return buildDamageRollResults(testWeapon, testScenario, armor, damageTypes, profiles).reduce(
    (sum, result) => sum + result.totalDamage * result.probability,
    0,
  );
}

test("flat power at zero armor deals expected HP equal to weapon power", () => {
  assert.equal(expectedDamage(weapon, scenario, 0, [flatHpType], [flatProfile]), 40);
  assert.equal(expectedTotalDamage(weapon, scenario, 0, [flatHpType], [flatProfile]), 40);
});

test("multi-shot expected components scale outside the single-shot damage logic", () => {
  const components = multiplyExpectedDamageComponents(
    { hp: 40, stun: 2, morale: 0, armor: 1, preArmor: 3, tu: 0, energy: 0, mana: 0 },
    3,
  );

  assert.deepEqual(components, {
    hp: 120,
    stun: 6,
    morale: 0,
    armor: 3,
    preArmor: 9,
    tu: 0,
    energy: 0,
    mana: 0,
  });
});

test("multi-shot roll results convolve independent shots", () => {
  const singleShot = buildDamageRollResults(weapon, scenario, 0, [flatHpType], [standardProfile]);
  const threeShots = buildMultiShotDamageRollResults(singleShot, 3);
  const expected = threeShots.reduce((sum, result) => sum + result.hpDamage * result.probability, 0);
  const killChance = threeShots
    .filter((result) => result.hpDamage >= scenario.hitPoints)
    .reduce((sum, result) => sum + result.probability, 0);

  assert.equal(Math.round(expected), 120);
  assert.ok(killChance > 0.96);
  assert.ok(killChance < 0.97);
});

test("multi-shot damage stats match the full hp and stun distribution", () => {
  const singleShot = buildDamageRollResults(weapon, scenario, 0, [flatHpType], [standardProfile]);
  const threeShots = buildMultiShotDamageRollResults(singleShot, 3);
  const stats = buildMultiShotDamageStats(singleShot, 3, scenario.hitPoints);
  const directStats = buildMultiShotDamageStatsForWeapon(
    weapon,
    scenario,
    0,
    [flatHpType],
    3,
    [standardProfile],
  );
  const zeroChance = threeShots
    .filter((result) => result.totalDamage <= 0)
    .reduce((sum, result) => sum + result.probability, 0);
  const killChance = threeShots
    .filter((result) => result.hpDamage >= scenario.hitPoints)
    .reduce((sum, result) => sum + result.probability, 0);
  const koChance = threeShots
    .filter((result) => result.hpDamage + result.stunDamage > scenario.hitPoints)
    .reduce((sum, result) => sum + result.probability, 0);

  assert.ok(Math.abs(stats.zeroChance - zeroChance) < 1e-12);
  assert.ok(Math.abs(stats.killChance - killChance) < 1e-12);
  assert.ok(Math.abs(stats.koChance - koChance) < 1e-12);
  assert.ok(Math.abs(directStats.zeroChance - zeroChance) < 1e-12);
  assert.ok(Math.abs(directStats.killChance - killChance) < 1e-12);
  assert.ok(Math.abs(directStats.koChance - koChance) < 1e-12);
});

function createTestCurve(
  hpValues: number[],
  rolledPowers: number[] = [],
  armorValues: number[] = [],
): Record<DamageMetricKey, DamageComponentCurvePoint[]> {
  const percentiles = hpValues.map((_, index) => Math.round((100 * (index + 1)) / hpValues.length));
  
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

  for (let i = 0; i < hpValues.length; i++) {
    const percentile = percentiles[i];
    const rolledPower = rolledPowers[i] ?? hpValues[i];
    const rollPercent = rolledPower;

    curves.hp.push({ percentile, rollPercent, rolledPower, value: hpValues[i] });
    curves.stun.push({ percentile, rollPercent, rolledPower, value: 0 });
    curves["hp-stun"].push({ percentile, rollPercent, rolledPower, value: hpValues[i] });
    curves.morale.push({ percentile, rollPercent, rolledPower, value: 0 });
    curves.scaledMorale.push({ percentile, rollPercent, rolledPower, value: 0 });
    curves.panicChance.push({ percentile, rollPercent, rolledPower, value: 0 });
    curves.armor.push({ percentile, rollPercent, rolledPower, value: armorValues[i] ?? 0 });
    curves.preArmor.push({ percentile, rollPercent, rolledPower, value: 0 });
    curves.tu.push({ percentile, rollPercent, rolledPower, value: 0 });
    curves.energy.push({ percentile, rollPercent, rolledPower, value: 0 });
    curves.mana.push({ percentile, rollPercent, rolledPower, value: 0 });
  }

  return curves;
}

test("multi-shot component curve preserves one-shot curve and sums percentiles for volleys", () => {
  const oneShot = createTestCurve([20, 40]);

  const preserved = buildMultiShotComponentCurve(oneShot, 1, ["hp"]);
  assert.deepEqual(preserved.hp, oneShot.hp);

  const twoShots = buildMultiShotComponentCurve(oneShot, 2, ["hp"]);
  assert.deepEqual(
    twoShots.hp.map((point) => [point.percentile, point.value, point.rolledPower]),
    [
      [25, 40, 40],
      [75, 60, 60],
      [100, 80, 80],
    ],
  );
});

test("multi-shot component curve only convolves requested component dimensions", () => {
  const oneShot = createTestCurve([10, 10], [20, 40], [1, 9]);

  const hpOnly = buildMultiShotComponentCurve(oneShot, 2, ["hp"]);
  const hpAndArmor = buildMultiShotComponentCurve(oneShot, 2, ["hp", "armor"]);

  assert.equal(hpOnly.hp.length, 1);
  assert.equal(hpOnly.hp[0].value, 20);
  assert.equal(hpOnly.armor.length, 0);
  assert.equal(hpAndArmor.hp.length, 3);
});

test("metric-scoped single-shot curve matches canonical curve for requested metrics", () => {
  const canonical = buildDamageComponentCurve(
    weapon,
    scenario,
    0,
    [flatHpType],
    [standardProfile],
  );
  const scoped = buildSingleShotComponentCurveForMetrics(
    weapon,
    scenario,
    0,
    [flatHpType],
    [standardProfile],
    ["hp", "stun", "armor", "panicChance"],
  );

  assert.deepEqual(scoped.hp, canonical.hp);
  assert.deepEqual(scoped.stun, canonical.stun);
  assert.deepEqual(scoped.armor, canonical.armor);
  assert.deepEqual(scoped.panicChance, canonical.panicChance);
});

test("projection curve produces monotonic multi-shot damage percentiles", () => {
  const curve = buildMultiShotProjectionCurveForWeapon(
    weapon,
    scenario,
    0,
    [flatHpType],
    3,
    [standardProfile],
    ["hp", "stun", "armor"],
  );

  assert.ok(Math.abs((curve.hp.at(-1)?.percentile ?? 0) - 100) < 1e-9);
  for (let index = 1; index < curve.hp.length; index += 1) {
    assert.ok(curve.hp[index].percentile >= curve.hp[index - 1].percentile);
    assert.ok(curve.hp[index].value >= curve.hp[index - 1].value);
  }
});

test("projection curve keeps every generated power point even when armor floors damage to zero", () => {
  const halfWideProfile: RandomProfile = {
    id: "50-150",
    label: "50-150",
    minPercent: 50,
    maxPercent: 150,
    dice: 1,
  };
  const halfWideType: DamageType = {
    ...flatHpType,
    randomProfileId: "50-150",
  };
  const highArmorScenario = {
    ...scenario,
    armor: 100,
  };
  const power50Weapon = {
    ...weapon,
    basePower: 50,
  };

  const oneShot = buildMultiShotProjectionCurveForWeapon(
    power50Weapon,
    highArmorScenario,
    100,
    [halfWideType],
    1,
    [halfWideProfile],
    ["hp"],
  );
  const twoShots = buildMultiShotProjectionCurveForWeapon(
    power50Weapon,
    highArmorScenario,
    100,
    [halfWideType],
    2,
    [halfWideProfile],
    ["hp", "armor"],
  );

  assert.deepEqual(oneShot.hp.map((point) => point.rolledPower), range(25, 75));
  assert.equal(oneShot.hp.every((point) => point.value === 0), true);
  assert.deepEqual(twoShots.hp.map((point) => point.rolledPower), range(50, 150));
  assert.deepEqual(twoShots.armor.map((point) => point.rolledPower), range(50, 150));
  assert.equal(twoShots.hp.every((point) => point.value === 0), true);
  assert.ok(Math.abs((twoShots.hp.at(-1)?.percentile ?? 0) - 100) < 1e-9);
});

test("HP damage percent scales zero-armor expected damage", () => {
  const damageType: DamageType = {
    ...flatHpType,
    hpDamagePercent: 0.75,
  };

  assert.equal(expectedDamage(weapon, scenario, 0, [damageType], [flatProfile]), 30);
  assert.equal(expectedTotalDamage(weapon, scenario, 0, [damageType], [flatProfile]), 30);
});

test("0-200 random profile averages back to power at zero armor before integer reporting", () => {
  const damageType: DamageType = {
    ...flatHpType,
    randomProfileId: "0-200",
  };
  const expected = expectedDamage(weapon, scenario, 0, [damageType], [standardProfile]);

  assert.equal(Math.round(expected), 40);
});

test("primary RNG uses OpenXcom-style integer rolled power outcomes", () => {
  const oddPowerWeapon: WeaponSystem = {
    ...weapon,
    basePower: 41,
  };
  const outcomes = rollOutcomes(oddPowerWeapon, scenario, [flatHpType], [standardProfile]);

  assert.equal(outcomes[0].rolledPower, 0);
  assert.equal(outcomes.at(-1)?.rolledPower, 82);
  assert.equal(outcomes.length, 83);
  assert.equal(outcomes.every((outcome) => Number.isInteger(outcome.rolledPower)), true);
});

test("two-dice primary RNG sums two integer 0-power rolls", () => {
  const twoDiceWeapon = {
    ...weapon,
    randomProfileIdOverride: "0-200-2d",
  };
  const outcomes = rollOutcomes(twoDiceWeapon, scenario, [flatHpType], [twoDiceProfile]);
  const byPower = new Map(outcomes.map((outcome) => [outcome.rolledPower, outcome]));

  assert.equal(outcomes.length, 81);
  assert.equal(outcomes.reduce((sum, outcome) => sum + outcome.count, 0), 1681);
  assert.equal(byPower.get(0)?.count, 1);
  assert.equal(byPower.get(40)?.count, 41);
  assert.equal(byPower.get(80)?.count, 1);
});

test("power-scaled armor effectiveness uses 100% plus power percent", () => {
  const damageType: DamageType = {
    ...flatHpType,
    armorEffectivenessScalesWithPower: true,
  };

  assert.equal(armorEffectivenessModifier(weapon, scenario, [damageType]), 1.4);
  assert.equal(effectiveArmor(weapon, scenario, 10, [damageType]), 14);
  assert.equal(damageAtRoll(weapon, scenario, 10, 1, [damageType]), 26);
});

test("post-armor damage truncates like OpenXcom int assignment", () => {
  const damageType: DamageType = {
    ...flatHpType,
    armorEffectiveness: 1.25,
  };

  assert.equal(damageAtRoll(weapon, scenario, 9, 1, [damageType]), 28);
});

test("post-armor truncation floors neither way, it truncates toward zero before the damage gate", () => {
  const damageType: DamageType = {
    ...flatHpType,
    armorEffectiveness: 1.25,
  };

  assert.equal(damageAtRoll(weapon, scenario, 32, 1, [damageType]), 0);
});

test("weapon armor effectiveness override wins over damage type power scaling", () => {
  const damageType: DamageType = {
    ...flatHpType,
    armorEffectivenessScalesWithPower: true,
  };
  const overrideWeapon: WeaponSystem = {
    ...weapon,
    armorEffectivenessOverride: 0.5,
  };

  assert.equal(armorEffectivenessModifier(overrideWeapon, scenario, [damageType]), 0.5);
  assert.equal(effectiveArmor(overrideWeapon, scenario, 10, [damageType]), 5);
});

test("ToArmorPre is tracked as pre-armor damage without changing current armor math", () => {
  const toArmorPreWeapon: WeaponSystem = {
    ...weapon,
    damageModifierOverrides: {
      preArmor: 0.9,
    },
    damageRandomizedOverrides: {
      preArmor: true,
    },
  };

  assert.equal(effectiveArmor(toArmorPreWeapon, scenario, 10, [flatHpType]), 10);
  assert.equal(damageAtRoll(toArmorPreWeapon, scenario, 10, 1, [flatHpType]), 30);
  assert.equal(expectedComponentDamage(toArmorPreWeapon, scenario, 10, [flatHpType], "preArmor", [flatProfile]), 18.04878048780488);
});

test("expectedTotalDamage matches the full roll-result engine with randomized stun", () => {
  const damageType: DamageType = {
    ...flatHpType,
    hpDamagePercent: 1,
    stunDamagePercent: 0.25,
    stunDamageRandomized: true,
  };

  const exact = totalFromRollResults(weapon, scenario, 0, [damageType], [flatProfile]);
  const helper = expectedTotalDamage(weapon, scenario, 0, [damageType], [flatProfile]);

  assert.equal(helper, exact);
});

test("randomized components roll from zero to penetrating damage", () => {
  const damageType: DamageType = {
    ...flatHpType,
    hpDamagePercent: 0,
    stunDamagePercent: 0.25,
    stunDamageRandomized: true,
  };

  assert.equal(expectedComponentDamage(weapon, scenario, 0, [damageType], "stun", [flatProfile]), 5.121951219512195);
  assert.equal(expectedTotalDamage(weapon, scenario, 0, [damageType], [flatProfile]), 5.121951219512195);
});

test("non-HP damage components can be configured independently", () => {
  const damageType: DamageType = {
    ...flatHpType,
    hpDamagePercent: 0,
    moraleDamagePercent: 0.5,
  };

  assert.equal(expectedDamage(weapon, scenario, 0, [damageType], [flatProfile]), 0);
  assert.equal(expectedComponentDamage(weapon, scenario, 0, [damageType], "morale", [flatProfile]), 20);
});

test("raw morale component does not depend on target bravery", () => {
  const damageType: DamageType = {
    ...flatHpType,
    hpDamagePercent: 0,
    moraleDamagePercent: 0.5,
  };
  const braveTarget = { ...scenario, targetBravery: 100 };
  const panickedTarget = { ...scenario, targetBravery: 0 };

  assert.equal(expectedComponentDamage(weapon, braveTarget, 0, [damageType], "morale", [flatProfile]), 20);
  assert.equal(expectedComponentDamage(weapon, panickedTarget, 0, [damageType], "morale", [flatProfile]), 20);
});

test("panic chance derives from scaled morale damage and averages over rolls", () => {
  const damageType: DamageType = {
    ...flatHpType,
    hpDamagePercent: 0,
    moraleDamagePercent: 1,
  };
  const moraleWeapon = { ...weapon, basePower: 100 };

  assert.equal(panicChanceFromScaledMoraleDamage(60), 20);
  assert.equal(panicChanceFromScaledMoraleDamage(20), 0);
  assert.equal(panicChanceFromScaledMoraleDamage(120), 100);
  assert.equal(expectedPanicChance(moraleWeapon, scenario, 0, [damageType], [flatProfile]), 20);
});

test("scaled morale uses OpenXcom integer division instead of rounding", () => {
  const damageType: DamageType = {
    ...flatHpType,
    hpDamagePercent: 0,
    moraleDamagePercent: 1,
  };
  const moraleWeapon = { ...weapon, basePower: 20 };
  const almostRoundingTarget = { ...scenario, targetBravery: 52 };
  const result = buildDamageRollResults(moraleWeapon, almostRoundingTarget, 0, [damageType], [flatProfile])[0];

  assert.equal(result.moraleDamage, 20);
  assert.equal(result.scaledMoraleDamage, 11);
});

test("imports OpenXcom RandomType enum values into the matching local profiles", () => {
  const expectedProfiles: Record<number, string> = {
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

  for (const [randomType, expectedProfile] of Object.entries(expectedProfiles)) {
    const source = `
items:
  - type: STR_RANDOM_${randomType}
    power: 20
    damageType: 0
    battleType: 2
    damageAlter:
      RandomType: ${randomType}
`;
    const imported = importOpenXcomItems(source, [flatHpType]);
    assert.equal(imported.weapons[0].randomProfileIdOverride, expectedProfile);
  }
});

test("imports units and linked armors for scenario presets", () => {
  const units = importOpenXcomUnits(`
units:
  - type: STR_TEST_SOLDIER
    stats:
      tu: 50
      stamina: 50
      health: 42
      bravery: 70
      reactions: 50
      firing: 64
      throwing: 50
      strength: 55
      melee: 71
    armor: TEST_ARMOR
`);
  const armors = importOpenXcomArmors(`
armors:
  - type: TEST_ARMOR
    frontArmor: 30
    sideArmor: 20
    rearArmor: 10
    underArmor: 5
    damageModifier: [1, 0.75, 0.5]
`);

  assert.equal(units[0].armorId, "TEST_ARMOR");
  assert.equal(units[0].stats.health, 42);
  assert.equal(units[0].stats.melee, 71);
  assert.equal(armors[0].sideArmor, 20);
  assert.equal(armors[0].damageModifier[1], 0.75);
});

test("imports translations and applies them to ruleset names", () => {
  const translations = importOpenXcomTranslations(`
en-US:
  STR_TEST_SOLDIER: "Translated Soldier"
  TEST_ARMOR: "Translated Armor"
  STR_TEST_CLIP: "Translated Clip"
`);
  const units = importOpenXcomUnits(`
units:
  - type: STR_TEST_SOLDIER
    stats:
      tu: 50
      stamina: 50
      health: 42
      bravery: 70
      reactions: 50
      firing: 50
      throwing: 50
      strength: 50
      melee: 50
`, translations);
  const armors = importOpenXcomArmors(`
armors:
  - type: TEST_ARMOR
`, translations);
  const imported = importOpenXcomItems(`
items:
  - type: STR_TEST_CLIP
    power: 42
    damageType: 0
    battleType: 2
`, [flatHpType], translations);

  assert.equal(units[0].name, "Translated Soldier");
  assert.equal(armors[0].name, "Translated Armor");
  assert.equal(imported.weapons[0].name, "Translated Clip");
});

test("default damage type names use language translations", () => {
  const translations = {
    STR_DAMAGE_ARMOR_PIERCING: "ARMOR PIERCING",
    STR_DAMAGE_HIGH_EXPLOSIVE: "HIGH EXPLOSIVE",
  };

  assert.equal(
    translatedDamageTypeName({ ...flatHpType, id: "1-armor-piercing", name: "1 - Armor Piercing" }, translations),
    "1 - ARMOR PIERCING",
  );
  assert.equal(
    translatedDamageTypeName({ ...flatHpType, id: "3-high-explosive", name: "3 - High Explosive" }, translations),
    "3 - HIGH EXPLOSIVE",
  );
});

test("imports soldier min, average, and max user presets", () => {
  const soldiers = importOpenXcomSoldiers(`
soldiers:
  - type: STR_TEST_SOLDIER
    minStats:
      tu: 50
      stamina: 50
      health: 25
      bravery: 10
      reactions: 50
      firing: 40
      throwing: 50
      strength: 20
      melee: 20
    maxStats:
      tu: 50
      stamina: 50
      health: 40
      bravery: 60
      reactions: 50
      firing: 70
      throwing: 50
      strength: 40
      melee: 40
    armor: STR_NONE_UC
`);

  assert.equal(soldiers.length, 3);
  assert.equal(soldiers[0].name, "Test Soldier (Average)");
  assert.equal(soldiers[0].presetKind, "soldier-average");
  assert.equal(soldiers[0].armorId, "STR_NONE_UC");
  assert.equal(soldiers[0].stats.health, 33);
  assert.equal(soldiers[0].stats.bravery, 35);
  assert.equal(soldiers[0].stats.strength, 30);
  assert.equal(soldiers[1].stats.firing, 40);
  assert.equal(soldiers[2].stats.melee, 40);
});

test("target armor damage modifiers reduce rolled power before armor", () => {
  const apType: DamageType = {
    ...flatHpType,
    id: "1-armor-piercing",
  };
  const resistantScenario = {
    ...scenario,
    targetDamageModifiers: [1, 0.75],
  };
  const apWeapon = {
    ...weapon,
    damageTypeId: "1-armor-piercing",
  };

  assert.equal(targetDamageModifier(apWeapon, resistantScenario, [flatHpType, apType]), 0.75);
  assert.equal(damageAtRoll(apWeapon, resistantScenario, 0, 1, [flatHpType, apType]), 30);
});

test("custom target armor clears damage modifiers from previous preset armor", () => {
  assert.deepEqual(
    damageModifiersForArmor({
      id: "TEST_RESISTANT_ARMOR",
      type: "TEST_RESISTANT_ARMOR",
      name: "Test Resistant Armor",
      frontArmor: 20,
      sideArmor: 20,
      rearArmor: 20,
      underArmor: 20,
      damageModifier: [1, 0.5],
    }),
    [1, 0.5],
  );
  assert.equal(damageModifiersForArmor(undefined), undefined);
});

test("imported armors replace existing definitions with the same id", () => {
  const existing = importOpenXcomArmors(`
armors:
  - type: STR_PERSONAL_ARMOR_UC
    sideArmor: 22
    damageModifier: [1, 1]
`);
  const imported = importOpenXcomArmors(`
armors:
  - type: STR_PERSONAL_ARMOR_UC
    sideArmor: 88
    damageModifier: [1, 0.25]
`);

  mergeArmorsById(existing, imported);

  assert.equal(existing.length, 1);
  assert.equal(existing[0].sideArmor, 88);
  assert.deepEqual(existing[0].damageModifier, [1, 0.25]);
});

test("imports powered OpenXcom items mapping to damage types and overrides", () => {
  const source = `
items:
  - type: STR_TEST_CLIP
    power: 42
    damageType: 4
    damageAlter:
      ArmorEffectiveness: 0.666
      ToArmorPre: 0.025
      RandomArmorPre: true
      ToHealth: 0.75
      ToStun: 0.25
      RandomStun: true
      RandomType: 2
    battleType: 2
`;

  const mockDamageTypes: DamageType[] = [
    flatHpType,
    flatHpType,
    flatHpType,
    flatHpType,
    { ...flatHpType, id: "4-laser" },
  ];
  const imported = importOpenXcomItems(source, mockDamageTypes);

  assert.equal(imported.weapons.length, 1);
  assert.equal(imported.weapons[0].basePower, 42);
  assert.equal(imported.weapons[0].damageModifierOverrides?.preArmor, 0.025);
  assert.equal(imported.weapons[0].damageRandomizedOverrides?.preArmor, true);
  assert.equal(imported.weapons[0].damageTypeId, "4-laser");
  assert.equal(imported.weapons[0].armorEffectivenessOverride, 0.666);
  assert.equal(imported.weapons[0].damageModifierOverrides?.hp, 0.75);
  assert.equal(imported.weapons[0].damageModifierOverrides?.stun, 0.25);
  assert.equal(imported.weapons[0].damageRandomizedOverrides?.stun, true);
  assert.equal(imported.weapons[0].randomProfileIdOverride, "50-150");
});

test("imports damageAlter ArmorEffectiveness from powered ammo", () => {
  const source = `
items:
  - type: STR_ACAR_LASCANNON_CLIP_HI
    categories: [STR_BAT_CAT_TANK_AMMO, STR_BAT_CAT_0G, STR_BAT_CAT_EXO]
    battleType: 2
    power: 150
    damageType: 4
    damageAlter:
      RandomType: 6
      IgnoreOverKill: false
      ArmorEffectiveness: 0.5
      ToArmorPre: 0.025
      ToWound: 0.06
      RandomWound: false
      FireThreshold: 40
`;

  const mockDamageTypes: DamageType[] = [
    flatHpType,
    flatHpType,
    flatHpType,
    flatHpType,
    { ...flatHpType, id: "4-laser" },
  ];
  const imported = importOpenXcomItems(source, mockDamageTypes);

  assert.equal(imported.weapons.length, 1);
  assert.equal(imported.weapons[0].basePower, 150);
  assert.equal(imported.weapons[0].damageTypeId, "4-laser");
  assert.equal(imported.weapons[0].armorEffectivenessOverride, 0.5);
  assert.equal(imported.weapons[0].damageModifierOverrides?.preArmor, 0.025);
  assert.equal(imported.weapons[0].randomProfileIdOverride, "0-200-2d");
});
