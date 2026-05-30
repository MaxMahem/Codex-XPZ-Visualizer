import { performance } from "node:perf_hooks";
import {
  buildDamageComponentCurve,
  buildDamageRollResults,
} from "../src/damage.ts";
import {
  buildMultiShotComponentCurve,
  buildMultiShotDamageStats,
  buildMultiShotDamageStatsForWeapon,
  buildMultiShotDamageRollResults,
  buildMultiShotProjectionCurveForWeapon,
  buildSingleShotComponentCurveForMetrics,
} from "../src/multiShotDamage.ts";
import type {
  DamageComponentKey,
  DamageMetricKey,
  DamageType,
  RandomProfile,
  Scenario,
  WeaponSystem,
} from "../src/types.ts";

interface BenchCase {
  name: string;
  power: number;
  shots: number;
  metrics: DamageMetricKey[];
  profile: RandomProfile;
  damageType: DamageType;
}

interface BenchResult {
  caseName: string;
  kind: string;
  iterations: number;
  medianMs: number;
  minMs: number;
  maxMs: number;
  outputSize: number;
}

const scenario: Scenario = {
  strength: 75,
  melee: 90,
  bravery: 50,
  firing: 60,
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

const damageTypes = [
  damageType("normal", {
    hp: 1,
    stun: 0.25,
    armor: 0.1,
  }),
  damageType("wide-components", {
    hp: 1,
    stun: 0.25,
    morale: 0.2,
    armor: 0.1,
    preArmor: 0.05,
    tu: 0.05,
    energy: 0.05,
    mana: 0.05,
  }),
];

const cases: BenchCase[] = [
  {
    name: "rifle-ish 3 shots default metrics",
    power: 40,
    shots: 3,
    metrics: ["hp", "stun", "armor"],
    profile: standardProfile,
    damageType: damageTypes[0],
  },
  {
    name: "medium power 3 shots default metrics",
    power: 80,
    shots: 3,
    metrics: ["hp", "stun", "armor"],
    profile: standardProfile,
    damageType: damageTypes[0],
  },
  {
    name: "medium power 2 shots two-dice default metrics",
    power: 80,
    shots: 2,
    metrics: ["hp", "stun", "armor"],
    profile: twoDiceProfile,
    damageType: damageTypes[0],
  },
  {
    name: "wide components 2 shots all metrics",
    power: 50,
    shots: 2,
    metrics: ["hp", "stun", "armor", "morale", "tu", "energy", "mana", "panicChance"],
    profile: standardProfile,
    damageType: damageTypes[1],
  },
];

let sink = 0;

const results: BenchResult[] = [];
for (const benchCase of cases) {
  const weapon = weaponFor(benchCase);
  const singleShotCurve = buildDamageComponentCurve(
    weapon,
    scenario,
    scenario.armor,
    [benchCase.damageType],
    [benchCase.profile],
  );
  const singleShotRolls = buildDamageRollResults(
    weapon,
    scenario,
    scenario.armor,
    [benchCase.damageType],
    [benchCase.profile],
  );

  results.push(measure(
    benchCase.name,
    `curve ${singleShotCurve.length} ->`,
    () => buildMultiShotComponentCurve(singleShotCurve, benchCase.shots, benchCase.metrics),
  ));
  results.push(measure(
    benchCase.name,
    "direct curve",
    () => buildMultiShotComponentCurve(
      buildSingleShotComponentCurveForMetrics(
        weapon,
        scenario,
        scenario.armor,
        [benchCase.damageType],
        [benchCase.profile],
        benchCase.metrics,
      ),
      benchCase.shots,
      benchCase.metrics,
    ),
  ));
  results.push(measure(
    benchCase.name,
    "projection curve",
    () => buildMultiShotProjectionCurveForWeapon(
      weapon,
      scenario,
      scenario.armor,
      [benchCase.damageType],
      benchCase.shots,
      [benchCase.profile],
      benchCase.metrics,
    ),
  ));
  results.push(measure(
    benchCase.name,
    `stats ${singleShotRolls.length} ->`,
    () => [buildMultiShotDamageStats(singleShotRolls, benchCase.shots, scenario.hitPoints)],
  ));
  results.push(measure(
    benchCase.name,
    "expanded stats",
    () => [
      buildMultiShotDamageStats(
        buildDamageRollResults(
          weapon,
          scenario,
          scenario.armor,
          [benchCase.damageType],
          [benchCase.profile],
        ),
        benchCase.shots,
        scenario.hitPoints,
      ),
    ],
  ));
  results.push(measure(
    benchCase.name,
    "direct stats",
    () => [
      buildMultiShotDamageStatsForWeapon(
        weapon,
        scenario,
        scenario.armor,
        [benchCase.damageType],
        benchCase.shots,
        [benchCase.profile],
      ),
    ],
  ));
  results.push(measure(
    benchCase.name,
    `full hp/stun ${singleShotRolls.length} ->`,
    () => buildMultiShotDamageRollResults(singleShotRolls, benchCase.shots),
  ));
}

printResults(results);
if (sink === Number.MIN_SAFE_INTEGER) {
  console.log("unreachable", sink);
}

function measure<T extends { length: number }>(
  caseName: string,
  kind: string,
  run: () => T,
): BenchResult {
  console.log(`Running ${caseName} / ${kind}`);
  run();
  const firstDuration = timeIterations(run, 1);
  const iterations = Math.max(1, Math.min(10, Math.floor(20 / Math.max(firstDuration, 0.1))));
  const samples: number[] = [];
  let outputSize = 0;

  for (let sample = 0; sample < 3; sample += 1) {
    const started = performance.now();
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      const output = run();
      outputSize = output.length;
      sink += outputSize;
    }
    samples.push((performance.now() - started) / iterations);
  }

  samples.sort((a, b) => a - b);
  return {
    caseName,
    kind: `${kind} ${outputSize}`,
    iterations,
    medianMs: samples[Math.floor(samples.length / 2)],
    minMs: samples[0],
    maxMs: samples[samples.length - 1],
    outputSize,
  };
}

function timeIterations(run: () => { length: number }, iterations: number): number {
  const started = performance.now();
  for (let index = 0; index < iterations; index += 1) {
    sink += run().length;
  }
  return (performance.now() - started) / iterations;
}

function printResults(benchResults: BenchResult[]): void {
  const rows = benchResults.map((result) => ({
    case: result.caseName,
    benchmark: result.kind,
    iterations: result.iterations,
    "median ms": result.medianMs.toFixed(3),
    "min ms": result.minMs.toFixed(3),
    "max ms": result.maxMs.toFixed(3),
  }));

  console.table(rows);
}

function weaponFor(benchCase: BenchCase): WeaponSystem {
  return {
    id: benchCase.name,
    name: benchCase.name,
    category: "Benchmark",
    damageTypeId: benchCase.damageType.id,
    basePower: benchCase.power,
    armorPenetration: 0,
    damageBonus: [],
    color: "#000000",
    randomProfileIdOverride: benchCase.profile.id,
  };
}

function damageType(id: string, percents: Partial<Record<DamageComponentKey, number>>): DamageType {
  return {
    id,
    name: id,
    armorEffectiveness: 1,
    armorEffectivenessScalesWithPower: false,
    randomProfileId: "0-200",
    color: "#000000",
    damageComponents: {
      hp: component("hp", percents.hp ?? 0, false),
      stun: component("stun", percents.stun ?? 0, true),
      morale: component("morale", percents.morale ?? 0, false),
      armor: component("armor", percents.armor ?? 0, false),
      preArmor: component("preArmor", percents.preArmor ?? 0, false),
      tu: component("tu", percents.tu ?? 0, false),
      energy: component("energy", percents.energy ?? 0, false),
      mana: component("mana", percents.mana ?? 0, false),
    },
  };
}

function component(type: DamageComponentKey, percent: number, randomized: boolean) {
  return { type, percent, randomized };
}
