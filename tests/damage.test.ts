import assert from "node:assert/strict";
import test from "node:test";
import {
  armorEffectivenessModifier,
  buildDamageRollResults,
  damageAtRoll,
  effectiveArmor,
  expectedDamage,
  expectedComponentDamage,
  expectedPanicChance,
  expectedTotalDamage,
  panicChanceFromScaledMoraleDamage,
} from "../src/damage.ts";
import { importOpenXcomItems } from "../src/rulImport.ts";
import type { DamageType, RandomProfile, Scenario, WeaponSystem } from "../src/types.ts";

const scenario: Scenario = {
  strength: 0,
  melee: 0,
  hitPoints: 45,
  armorEffectiveness: 1,
  armorMin: 0,
  armorMax: 100,
  armorStep: 5,
  targetBravery: 50,
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

test("power-scaled armor effectiveness uses 100% plus power percent", () => {
  const damageType: DamageType = {
    ...flatHpType,
    armorEffectivenessScalesWithPower: true,
  };

  assert.equal(armorEffectivenessModifier(weapon, scenario, [damageType]), 1.4);
  assert.equal(effectiveArmor(weapon, scenario, 10, [damageType]), 14);
  assert.equal(damageAtRoll(weapon, scenario, 10, 1, [damageType]), 26);
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
  assert.equal(expectedComponentDamage(toArmorPreWeapon, scenario, 10, [flatHpType], "preArmor", [flatProfile]), 17.524752475247524);
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
});
