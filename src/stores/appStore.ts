import { defineStore } from "pinia";
import { computed, reactive, ref } from "vue";
import {
  buildCurve,
  buildDamageComponentCurve,
  buildDamageRollResults,
  armorEffectivenessModifier,
  damageTypeFor,
  effectiveArmor,
  expectedDamage,
  modifiedPower,
  randomProfileFor,
  randomRange,
  rollOutcomes,
} from "../damage";
import { damageTypes, defaultScenario, randomProfiles, weapons } from "../data";
import defaultItemsRul from "../data/default-items.rul?raw";
import { importOpenXcomItems } from "../rulImport";
import type {
  DamageComponentCurvePoint,
  DamageComponentKey,
  DamagePoint,
  DamageType,
  WeaponSystem,
} from "../types";

export type AppTab = "compare" | "damage-types" | "weapons";
export type ScenarioTab = "user" | "target";
export type HeatmapContourSegment = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};
export type HeatmapMetric = DamageComponentKey | "hp-stun";

export const damageComponentOptions: Array<{ key: DamageComponentKey; label: string }> = [
  { key: "hp", label: "HP" },
  { key: "stun", label: "Stun" },
  { key: "morale", label: "Morale" },
  { key: "armor", label: "Armor" },
  { key: "tu", label: "TU" },
  { key: "energy", label: "Energy" },
  { key: "mana", label: "Mana" },
];

export const heatmapMetrics: Array<{ key: HeatmapMetric; label: string }> = [
  { key: "hp", label: "HP" },
  { key: "stun", label: "Stun" },
  { key: "hp-stun", label: "HP + Stun" },
  { key: "morale", label: "Morale" },
  { key: "armor", label: "Armor" },
  { key: "tu", label: "TU" },
  { key: "energy", label: "Energy" },
  { key: "mana", label: "Mana" },
];

export const useAppStore = defineStore('app', () => {

const scenario = reactive({ ...defaultScenario });
const shippedImport = importOpenXcomItems(
  defaultItemsRul,
  damageTypes,
);
const shippedWeapons = shippedImport.weapons.length > 0 ? shippedImport.weapons : weapons;
const fallbackWeapon: WeaponSystem = {
  id: "fallback-weapon",
  name: "No Weapon",
  category: "Fallback",
  damageTypeId: damageTypes[0]?.id ?? "0-none",
  basePower: 0,
  armorPenetration: 0,
  strengthBonus: 0,
  meleeBonus: 0,
  color: "#6f7f90",
};

const editableDamageTypes = reactive<DamageType[]>([
  ...damageTypes.map((damageType) => ({ ...damageType })),
]);
const editableWeapons = reactive<WeaponSystem[]>(shippedWeapons.map((weapon) => ({ ...weapon })));
const selectedIds = ref<string[]>(shippedWeapons.slice(0, 3).map((weapon) => weapon.id));
const hoveredArmor = ref<number | null>(40);
const rollWeaponId = ref(shippedWeapons[0]?.id ?? "");
const selectedWeaponId = ref(shippedWeapons[0]?.id ?? "");
const selectedDamageTypeId = ref(damageTypes[0]?.id ?? "0-none");
const activeTab = ref<AppTab>("compare");
const scenarioTab = ref<ScenarioTab>("user");
const heatmapMetric = ref<HeatmapMetric>("hp");

const rollHoverPercentile = ref<number | null>(null);
const heatmapHover = ref<{ armor: number; power: number } | null>(null);
const importStatus = ref("");

const selectedWeapons = computed(() =>
  editableWeapons.filter((weapon) => selectedIds.value.includes(weapon.id)),
);

const chartSeries = computed(() =>
  selectedWeapons.value.map((weapon) => ({
    weapon,
    points: buildCurve(
      weapon,
      { ...scenario, armorMin: 0, armorMax: 100, armorStep: 5 },
      editableDamageTypes,
      randomProfiles,
    ),
  })),
);

const maxExpectedDamage = computed(() => {
  const values = chartSeries.value.flatMap((series) =>
    series.points.map((point) => Math.round(point.expected)),
  );
  return Math.max(Math.round(scenario.hitPoints), ...values, 10);
});

const currentArmor = computed(() => {
  return Math.round(hoveredArmor.value ?? 40);
});

const focusedRows = computed(() =>
  selectedWeapons.value
    .map((weapon) => ({
      weapon,
      point: buildCurve(weapon, {
        ...scenario,
        armorMin: currentArmor.value,
        armorMax: currentArmor.value,
        armorStep: 1,
      }, editableDamageTypes, randomProfiles)[0],
      expectedStun: buildDamageRollResults(
        weapon,
        scenario,
        currentArmor.value,
        editableDamageTypes,
        randomProfiles,
      ).reduce((sum, result) => sum + result.stunDamage * result.probability, 0),
      modifiedPower: modifiedPower(weapon, scenario),
      effectiveArmor: effectiveArmor(weapon, scenario, currentArmor.value, editableDamageTypes),
      armorEffectiveness: armorEffectivenessModifier(weapon, scenario, editableDamageTypes),
      damageType: damageTypeFor(weapon, editableDamageTypes),
    }))
    .sort((a, b) => b.point.expected - a.point.expected),
);

const targetHpTooltip = computed(
  () =>
    `The red dashed horizontal line marks the target's HP (${formatDamage(scenario.hitPoints)}). Curves above it have enough expected damage to exceed that HP at the shown armor level.`,
);

const rollWeapon = computed(
  () => editableWeapons.find((weapon) => weapon.id === selectedWeaponId.value) ?? editableWeapons[0] ?? fallbackWeapon,
);

const rollResults = computed(() =>
  buildDamageRollResults(
    rollWeapon.value,
    scenario,
    currentArmor.value,
    editableDamageTypes,
    randomProfiles,
  ),
);

const componentCurve = computed(() =>
  buildDamageComponentCurve(
    rollWeapon.value,
    scenario,
    currentArmor.value,
    editableDamageTypes,
    randomProfiles,
  ),
);

const inspectedCurvePoint = computed(() => {
  const points = componentCurve.value;
  if (points.length === 0) {
    return null;
  }
  const percentile = rollHoverPercentile.value ?? 50;
  return points.reduce((closest, point) =>
    Math.abs(point.percentile - percentile) < Math.abs(closest.percentile - percentile)
      ? point
      : closest,
  );
});

const selectedDamageType = computed(
  () =>
    editableDamageTypes.find((damageType) => damageType.id === selectedDamageTypeId.value) ??
    editableDamageTypes[0],
);

const heatmapData = computed(() => {
  const width = 151;
  const height = 101;
  const values: Record<DamageComponentKey, Float32Array> = {
    hp: new Float32Array(width * height),
    stun: new Float32Array(width * height),
    morale: new Float32Array(width * height),
    armor: new Float32Array(width * height),
    tu: new Float32Array(width * height),
    energy: new Float32Array(width * height),
    mana: new Float32Array(width * height),
  };
  const hpStunValues = new Float32Array(width * height);
  const maxValues: Record<HeatmapMetric, number> = {
    hp: 1,
    stun: 1,
    "hp-stun": 1,
    morale: 1,
    armor: 1,
    tu: 1,
    energy: 1,
    mana: 1,
  };
  const syntheticWeapon: WeaponSystem = {
    id: "heatmap-preview",
    name: "Heatmap Preview",
    category: "Preview",
    damageTypeId: selectedDamageType.value.id,
    basePower: 0,
    armorPenetration: 0,
    strengthBonus: 0,
    meleeBonus: 0,
    color: selectedDamageType.value.color,
  };
  const outcomes = rollOutcomes(syntheticWeapon, editableDamageTypes, randomProfiles);
  const componentSettings = damageComponentOptions.map((option) => ({
    key: option.key,
    percent: componentPercent(selectedDamageType.value, option.key),
    randomized: componentRandomized(selectedDamageType.value, option.key),
  }));
  const fixedArmorEffectiveness =
    scenario.armorEffectiveness * selectedDamageType.value.armorEffectiveness;

  for (let armor = 0; armor < height; armor += 1) {
    for (let power = 0; power < width; power += 1) {
      const index = armor * width + power;
      const armorEffectiveness = selectedDamageType.value.armorEffectivenessScalesWithPower
        ? scenario.armorEffectiveness * (1 + power / 100)
        : fixedArmorEffectiveness;

      for (const outcome of outcomes) {
        const postArmorDamage = Math.max(
          0,
          power * (outcome.rollPercent / 100) - armor * armorEffectiveness,
        );
        for (const setting of componentSettings) {
          values[setting.key][index] +=
            expectedComponentFromPostArmor(
              postArmorDamage,
              setting.percent,
              setting.randomized,
            ) * outcome.probability;
        }
      }

      hpStunValues[index] = values.hp[index] + values.stun[index];
      for (const metric of heatmapMetrics) {
        maxValues[metric.key] = Math.max(
          maxValues[metric.key],
          heatmapMetricValue(values, hpStunValues, metric.key, index),
        );
      }
    }
  }

  return { width, height, values, hpStunValues, maxValues };
});

const heatmapMaxDamage = computed(() => heatmapData.value.maxValues[heatmapMetric.value]);

const heatmapImageHref = computed(() => {
  const data = heatmapData.value;
  if (typeof document === "undefined") {
    return "";
  }

  const canvas = document.createElement("canvas");
  canvas.width = data.width;
  canvas.height = data.height;
  const context = canvas.getContext("2d");
  if (!context) {
    return "";
  }

  const image = context.createImageData(data.width, data.height);
  for (let armor = 0; armor < data.height; armor += 1) {
    for (let power = 0; power < data.width; power += 1) {
      const sourceIndex = armor * data.width + power;
      const targetIndex = ((data.height - 1 - armor) * data.width + power) * 4;
      const [red, green, blue] = heatmapRgb(heatmapValueAt(sourceIndex));
      image.data[targetIndex] = red;
      image.data[targetIndex + 1] = green;
      image.data[targetIndex + 2] = blue;
      image.data[targetIndex + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);
  return canvas.toDataURL("image/png");
});

const inspectedHeatmapCell = computed(() => {
  const hover = heatmapHover.value ?? { armor: 50, power: 75 };
  const armor = Math.max(0, Math.min(100, Math.round(hover.armor)));
  const power = Math.max(0, Math.min(150, Math.round(hover.power)));
  const index = armor * heatmapData.value.width + power;
  const expectedHp = heatmapData.value.values.hp[index] ?? 0;
  const expectedStun = heatmapData.value.values.stun[index] ?? 0;
  const expectedMetric = heatmapValueAt(index);
  return {
    armor,
    power,
    expectedHp,
    expectedStun,
    expectedMetric,
    expectedTotal: expectedHp + expectedStun,
  };
});

const heatmapHpContour = computed<HeatmapContourSegment[]>(() => {
  const data = heatmapData.value;
  const threshold = scenario.hitPoints;
  const segments: HeatmapContourSegment[] = [];

  for (let armor = 0; armor < data.height - 1; armor += 1) {
    for (let power = 0; power < data.width - 1; power += 1) {
      const bottomLeft = heatmapValue(power, armor);
      const bottomRight = heatmapValue(power + 1, armor);
      const topRight = heatmapValue(power + 1, armor + 1);
      const topLeft = heatmapValue(power, armor + 1);
      const intersections = [
        contourPoint(power, armor, bottomLeft, power + 1, armor, bottomRight, threshold),
        contourPoint(power + 1, armor, bottomRight, power + 1, armor + 1, topRight, threshold),
        contourPoint(power + 1, armor + 1, topRight, power, armor + 1, topLeft, threshold),
        contourPoint(power, armor + 1, topLeft, power, armor, bottomLeft, threshold),
      ].filter((point): point is { x: number; y: number } => point !== null);

      if (intersections.length === 2) {
        segments.push({
          x1: intersections[0].x,
          y1: intersections[0].y,
          x2: intersections[1].x,
          y2: intersections[1].y,
        });
      }

      if (intersections.length === 4) {
        segments.push(
          {
            x1: intersections[0].x,
            y1: intersections[0].y,
            x2: intersections[1].x,
            y2: intersections[1].y,
          },
          {
            x1: intersections[2].x,
            y1: intersections[2].y,
            x2: intersections[3].x,
            y2: intersections[3].y,
          },
        );
      }
    }
  }

  return segments;
});

const rollStats = computed(() => {
  const results = rollResults.value;
  const damages = componentCurve.value.map((result) => result.totalDamage);
  const minDamage = Math.min(...damages, 0);
  const maxDamage = Math.max(...damages, scenario.hitPoints, rollExpectedDamage.value, 10);
  const zeroChance =
    results
      .filter((result) => result.totalDamage <= 0)
      .reduce((sum, result) => sum + result.probability, 0);
  const killChance =
    results
      .filter((result) => result.hpDamage >= scenario.hitPoints)
      .reduce((sum, result) => sum + result.probability, 0);
  const koChance =
    results
      .filter((result) => result.hpDamage + result.stunDamage > scenario.hitPoints)
      .reduce((sum, result) => sum + result.probability, 0);

  return {
    minDamage,
    maxDamage,
    zeroChance,
    killChance,
    koChance,
    outcomeCount: results.reduce((sum, result) => sum + result.count, 0),
  };
});

const rollExpectedDamage = computed(() =>
  expectedDamage(
    rollWeapon.value,
    scenario,
    currentArmor.value,
    editableDamageTypes,
    randomProfiles,
  ),
);

function toggleWeapon(id: string): void {
  if (selectedIds.value.includes(id)) {
    selectedIds.value = selectedIds.value.filter((selected) => selected !== id);
    return;
  }
  selectedIds.value = [...selectedIds.value, id];
}

function selectWeapon(id: string): void {
  selectedWeaponId.value = id;
  rollWeaponId.value = id;
}

function pathFor(points: DamagePoint[]): string {
  if (points.length === 0) {
    return "";
  }

  return points
    .map((point, index) => {
      const x = scaleX(point.armor);
      const y = scaleY(Math.round(point.expected));
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function scaleX(armor: number): number {
  const width = 760;
  const min = 0;
  const max = 100;
  return ((armor - min) / (max - min)) * width;
}

function scaleY(damage: number): number {
  const height = 320;
  return height - (damage / maxExpectedDamage.value) * height;
}

function xLabel(index: number): number {
  const ticks = 5;
  return Math.round((100 * index) / (ticks - 1));
}

function yLabel(index: number): number {
  const ticks = 5;
  return Math.round((maxExpectedDamage.value * (ticks - 1 - index)) / (ticks - 1));
}

function rollX(percentile: number): number {
  const width = 760;
  return (percentile / 100) * width;
}

function rollY(damage: number): number {
  const height = 260;
  return height - (damage / rollStats.value.maxDamage) * height;
}

function rollPath(results: DamageComponentCurvePoint[]): string {
  return results
    .map((result, index) => {
      const x = rollX(result.percentile);
      const y = rollY(result.totalDamage);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function componentAreaPath(
  results: DamageComponentCurvePoint[],
  lower: (result: DamageComponentCurvePoint) => number,
  upper: (result: DamageComponentCurvePoint) => number,
): string {
  if (results.length === 0) {
    return "";
  }

  const top = results
    .map((result, index) => {
      const x = rollX(result.percentile);
      const y = rollY(upper(result));
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
  const bottom = [...results]
    .reverse()
    .map((result) => {
      const x = rollX(result.percentile);
      const y = rollY(lower(result));
      return `L ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return `${top} ${bottom} Z`;
}

function rollXLabel(index: number): string {
  const ticks = 5;
  return `${Math.round((100 * index) / (ticks - 1))}%`;
}

function rollYLabel(index: number): number {
  const ticks = 4;
  return Math.round((rollStats.value.maxDamage * (ticks - 1 - index)) / (ticks - 1));
}

function formatDamage(value: number): string {
  return `${Math.round(value)}`;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function percentField(value: number): number {
  return Math.round(value * 100);
}

function setArmorEffectiveness(value: number): void {
  selectedDamageType.value.armorEffectiveness = (Number.isFinite(value) ? value : 0) / 100;
}

function setHpDamagePercent(value: number): void {
  selectedDamageType.value.hpDamagePercent = (Number.isFinite(value) ? value : 0) / 100;
}

function setStunDamagePercent(value: number): void {
  selectedDamageType.value.stunDamagePercent = (Number.isFinite(value) ? value : 0) / 100;
}

function componentPercent(damageType: DamageType, component: DamageComponentKey): number {
  return damageType[`${component}DamagePercent`];
}

function setComponentPercent(component: DamageComponentKey, value: number): void {
  selectedDamageType.value[`${component}DamagePercent`] = (Number.isFinite(value) ? value : 0) / 100;
}

function componentRandomized(damageType: DamageType, component: DamageComponentKey): boolean {
  return damageType[`${component}DamageRandomized`];
}

function setComponentRandomized(component: DamageComponentKey, value: boolean): void {
  selectedDamageType.value[`${component}DamageRandomized`] = value;
}

function expectedComponentFromPostArmor(
  postArmorDamage: number,
  percent: number,
  randomized: boolean,
): number {
  if (postArmorDamage <= 0 || percent <= 0) {
    return 0;
  }

  if (!randomized) {
    return Math.floor(postArmorDamage * percent);
  }

  let sum = 0;
  for (let roll = 0; roll <= 100; roll += 1) {
    sum += Math.floor(postArmorDamage * percent * (roll / 100));
  }
  return sum / 101;
}

function subtleColor(color: string): string {
  return `color-mix(in srgb, ${color} 13%, white)`;
}

function heatmapColor(value: number): string {
  const intensity = Math.max(0, Math.min(1, Math.round(value) / Math.round(heatmapMaxDamage.value)));
  const lightness = 96 - intensity * 52;
  const saturation = 36 + intensity * 42;
  return `hsl(8  ${saturation}% ${lightness}%)`;
}

function heatmapRgb(value: number): [number, number, number] {
  const maxDamage = Math.max(1, Math.round(heatmapMaxDamage.value));
  const intensity = Math.max(0, Math.min(1, Math.round(value) / maxDamage));
  const low = [253, 245, 243];
  const high = [198, 67, 44];
  return [
    Math.round(low[0] + (high[0] - low[0]) * intensity),
    Math.round(low[1] + (high[1] - low[1]) * intensity),
    Math.round(low[2] + (high[2] - low[2]) * intensity),
  ];
}

function handleHeatmapPointer(event: PointerEvent): void {
  const svg = event.currentTarget as SVGSVGElement;
  const rect = svg.getBoundingClientRect();
  const plotLeft = (58 / 780) * rect.width;
  const plotTop = (20 / 350) * rect.height;
  const plotWidth = (660 / 780) * rect.width;
  const plotHeight = (270 / 350) * rect.height;
  const x = Math.min(plotWidth, Math.max(0, event.clientX - rect.left - plotLeft));
  const y = Math.min(plotHeight, Math.max(0, event.clientY - rect.top - plotTop));
  heatmapHover.value = {
    power: Math.round((x / plotWidth) * 150),
    armor: Math.round(100 - (y / plotHeight) * 100),
  };
}

function clearHeatmapPointer(): void {
  heatmapHover.value = null;
}

function heatmapX(power: number): number {
  return (power / 150) * 660;
}

function heatmapY(armor: number): number {
  return ((100 - armor) / 100) * 270;
}

function heatmapMetricValue(
  values: Record<DamageComponentKey, Float32Array>,
  hpStunValues: Float32Array,
  metric: HeatmapMetric,
  index: number,
): number {
  return metric === "hp-stun" ? hpStunValues[index] : values[metric][index];
}

function heatmapValueAt(index: number): number {
  return heatmapMetricValue(
    heatmapData.value.values,
    heatmapData.value.hpStunValues,
    heatmapMetric.value,
    index,
  );
}

function heatmapValue(power: number, armor: number): number {
  const data = heatmapData.value;
  return heatmapValueAt(armor * data.width + power) ?? 0;
}

function contourPoint(
  powerA: number,
  armorA: number,
  valueA: number,
  powerB: number,
  armorB: number,
  valueB: number,
  threshold: number,
): { x: number; y: number } | null {
  if (valueA === valueB) {
    return null;
  }

  const min = Math.min(valueA, valueB);
  const max = Math.max(valueA, valueB);
  if (threshold < min || threshold > max) {
    return null;
  }

  const ratio = (threshold - valueA) / (valueB - valueA);
  const power = powerA + (powerB - powerA) * ratio;
  const armor = armorA + (armorB - armorA) * ratio;
  return {
    x: heatmapX(power),
    y: heatmapY(armor),
  };
}

function heatmapTooltipX(): number {
  return Math.min(512, heatmapX(inspectedHeatmapCell.value.power) + 12);
}

function heatmapTooltipY(): number {
  return Math.max(8, heatmapY(inspectedHeatmapCell.value.armor) - 42);
}

function weaponTooltip(weapon: WeaponSystem): string {
  const [minRoll, maxRoll] = randomRange(weapon, editableDamageTypes, randomProfiles);
  const damageType = damageTypeFor(weapon, editableDamageTypes);
  const profile = randomProfileFor(weapon, editableDamageTypes, randomProfiles);
  return `${weapon.name}: ${weapon.category}. ${damageType.name} damage. Base ${weapon.basePower}, armor penetration ${formatPercent(
    weapon.armorPenetration,
  )}, armor effectiveness ${formatPercent(armorEffectivenessModifier(weapon, scenario, editableDamageTypes))}, HP ${formatPercent(weapon.damageModifierOverrides?.hp ?? damageType.hpDamagePercent)}, stun ${formatPercent(weapon.damageModifierOverrides?.stun ?? damageType.stunDamagePercent)}, random profile ${profile.label} (${formatPercent(minRoll)}-${formatPercent(
    maxRoll,
  )}).`;
}

function weaponAtArmor(weapon: WeaponSystem, armor: number): DamagePoint {
  return buildCurve(weapon, {
    ...scenario,
    armorMin: armor,
    armorMax: armor,
    armorStep: 1,
  }, editableDamageTypes, randomProfiles)[0];
}

function percentileTooltip(result: DamageComponentCurvePoint): string {
  return `${formatDamage(result.totalDamage)} total by the ${Math.round(result.percentile)}th percentile. HP ${formatDamage(result.hpDamage)}, stun ${formatDamage(result.stunDamage)}. Underlying roll: ${result.rollPercent}%.`;
}

function handleRollPointer(event: PointerEvent): void {
  const svg = event.currentTarget as SVGSVGElement;
  const rect = svg.getBoundingClientRect();
  const plotLeft = (58 / 840) * rect.width;
  const plotWidth = (760 / 840) * rect.width;
  const x = Math.min(plotWidth, Math.max(0, event.clientX - rect.left - plotLeft));
  rollHoverPercentile.value = (x / plotWidth) * 100;
}

function clearRollPointer(): void {
  rollHoverPercentile.value = null;
}

function inspectorLabelX(point: DamageComponentCurvePoint): number {
  return Math.min(610, Math.max(8, rollX(point.percentile) + 10));
}

function inspectorLabelY(point: DamageComponentCurvePoint): number {
  return Math.max(10, rollY(point.totalDamage) - 42);
}

function addDamageType(): void {
  const nextNumber = editableDamageTypes.length + 1;
  const id = `custom-${Date.now()}`;
  editableDamageTypes.push({
    id,
    name: `Custom Type ${nextNumber}`,
    armorEffectiveness: 1,
    armorEffectivenessScalesWithPower: false,
    hpDamagePercent: 1,
    hpDamageRandomized: false,
    stunDamagePercent: 0.25,
    stunDamageRandomized: true,
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
    color: "#6f7f90",
  });
  selectedDamageTypeId.value = id;
}

function addWeapon(): void {
  const nextNumber = editableWeapons.length + 1;
  const id = `custom-weapon-${Date.now()}`;
  const damageTypeId = editableDamageTypes[0]?.id ?? "0-none";
  editableWeapons.push({
    id,
    name: `Custom Weapon ${nextNumber}`,
    category: "Custom",
    damageTypeId,
    basePower: 50,
    armorPenetration: 0,
    strengthBonus: 0,
    meleeBonus: 0,
    color: "#6f7f90",
  });
  selectedWeaponId.value = id;
  rollWeaponId.value = id;
  selectedIds.value = [...selectedIds.value, id];
}

function clearWeapons(): void {
  editableWeapons.splice(0, editableWeapons.length);
  selectedIds.value = [];
  selectedWeaponId.value = "";
  rollWeaponId.value = "";
  importStatus.value = "Cleared all weapons/items. Damage type defaults are still available.";
}

function setWeaponModifiedPower(weapon: WeaponSystem, value: number): void {
  const desiredPower = Number.isFinite(value) ? value : 0;
  weapon.basePower = Math.round(
    desiredPower - weapon.strengthBonus * scenario.strength - weapon.meleeBonus * scenario.melee,
  );
}

async function importItemsFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) {
    return;
  }

  const text = await file.text();
  const imported = importOpenXcomItems(
    text,
    editableDamageTypes,
  );

  editableWeapons.push(...imported.weapons);
  selectedIds.value = [...new Set([...selectedIds.value, ...imported.weapons.map((weapon) => weapon.id)])];
  if (imported.weapons[0]) {
    selectedWeaponId.value = imported.weapons[0].id;
    rollWeaponId.value = imported.weapons[0].id;
  }
  importStatus.value = `Imported ${imported.weapons.length} powered items.`;
  input.value = "";
}

function setWeaponArmorPenetration(weapon: WeaponSystem, value: number): void {
  weapon.armorPenetration = (Number.isFinite(value) ? value : 0) / 100;
}

function setWeaponRandomProfile(weapon: WeaponSystem, value: string): void {
  weapon.randomProfileIdOverride = value === "default" ? undefined : value;
}

function setWeaponArmorEffectivenessOverride(weapon: WeaponSystem, value: number | undefined): void {
  weapon.armorEffectivenessOverride = value;
}

function setWeaponDamageModifierOverride(weapon: WeaponSystem, component: DamageComponentKey, value: number | undefined): void {
  if (value === undefined) {
    if (weapon.damageModifierOverrides) {
      delete weapon.damageModifierOverrides[component];
    }
  } else {
    weapon.damageModifierOverrides ??= {};
    weapon.damageModifierOverrides[component] = value;
  }
}

function setWeaponDamageRandomizedOverride(weapon: WeaponSystem, component: DamageComponentKey, value: boolean | undefined): void {
  if (value === undefined) {
    if (weapon.damageRandomizedOverrides) {
      delete weapon.damageRandomizedOverrides[component];
    }
  } else {
    weapon.damageRandomizedOverrides ??= {};
    weapon.damageRandomizedOverrides[component] = value;
  }
}

function setWeaponDamageType(weapon: WeaponSystem, typeId: string): void {
  weapon.damageTypeId = typeId;
  // Reset all overrides when the base damage type changes
  delete weapon.damageModifierOverrides;
  delete weapon.damageRandomizedOverrides;
  delete weapon.randomProfileIdOverride;
  delete weapon.armorEffectivenessOverride;
}

  return {
    damageComponentOptions,
    heatmapMetrics,
    scenario,
    shippedImport,
    shippedWeapons,
    fallbackWeapon,
    editableDamageTypes,
    editableWeapons,
    selectedIds,
    hoveredArmor,
    rollWeaponId,
    selectedWeaponId,
    selectedDamageTypeId,
    activeTab,
    scenarioTab,
    heatmapMetric,
    rollHoverPercentile,
    heatmapHover,
    importStatus,
    selectedWeapons,
    chartSeries,
    maxExpectedDamage,
    currentArmor,
    focusedRows,
    targetHpTooltip,
    rollWeapon,
    rollResults,
    componentCurve,
    inspectedCurvePoint,
    selectedDamageType,
    heatmapData,
    heatmapMaxDamage,
    heatmapImageHref,
    inspectedHeatmapCell,
    heatmapHpContour,
    rollStats,
    rollExpectedDamage,
    toggleWeapon,
    selectWeapon,
    pathFor,
    scaleX,
    scaleY,
    xLabel,
    yLabel,
    rollX,
    rollY,
    rollPath,
    componentAreaPath,
    rollXLabel,
    rollYLabel,
    formatDamage,
    formatPercent,
    percentField,
    setArmorEffectiveness,
    setHpDamagePercent,
    setStunDamagePercent,
    componentPercent,
    setComponentPercent,
    componentRandomized,
    setComponentRandomized,
    expectedComponentFromPostArmor,
    subtleColor,
    heatmapColor,
    heatmapRgb,
    handleHeatmapPointer,
    clearHeatmapPointer,
    heatmapX,
    heatmapY,
    heatmapMetricValue,
    heatmapValueAt,
    heatmapValue,
    contourPoint,
    heatmapTooltipX,
    heatmapTooltipY,
    weaponTooltip,
    weaponAtArmor,
    percentileTooltip,
    handleRollPointer,
    clearRollPointer,
    inspectorLabelX,
    inspectorLabelY,
    addDamageType,
    addWeapon,
    clearWeapons,
    setWeaponModifiedPower,
    importItemsFile,
    setWeaponArmorPenetration,
    setWeaponRandomProfile,
    setWeaponArmorEffectivenessOverride,
    setWeaponDamageType,
    setWeaponDamageModifierOverride,
    setWeaponDamageRandomizedOverride,
  };
});
