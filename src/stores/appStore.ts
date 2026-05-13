import { defineStore } from "pinia";
import { computed } from "vue";
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
import { randomProfiles } from "../data";
import type {
  DamageComponentCurvePoint,
  DamageComponentKey,
  DamagePoint,
  WeaponSystem,
} from "../types";
import { formatDamage, formatPercent } from "../utils/formatters";
import { useDamageTypesStore, damageComponentOptions } from "./damageTypesStore";
import { useScenarioStore } from "./scenarioStore";
import { useUiStore, heatmapMetrics } from "./uiStore";
import { useWeaponsStore } from "./weaponsStore";

export type HeatmapContourSegment = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export const useAppStore = defineStore('app', () => {
  const scenarioStore = useScenarioStore();
  const damageTypesStore = useDamageTypesStore();
  const weaponsStore = useWeaponsStore();
  const uiStore = useUiStore();

  const chartSeries = computed(() =>
    weaponsStore.selectedWeapons.map((weapon) => ({
      weapon,
      points: buildCurve(
        weapon,
        { ...scenarioStore.scenario, armorMin: 0, armorMax: 100, armorStep: 5 },
        damageTypesStore.editableDamageTypes,
        randomProfiles,
      ),
    })),
  );

  const maxExpectedDamage = computed(() => {
    const values = chartSeries.value.flatMap((series) =>
      series.points.map((point) => Math.round(point.expected)),
    );
    return Math.max(Math.round(scenarioStore.scenario.hitPoints), ...values, 10);
  });

  const currentArmor = computed(() => {
    return Math.round(uiStore.hoveredArmor ?? 40);
  });

  const focusedRows = computed(() =>
    weaponsStore.selectedWeapons
      .map((weapon) => ({
        weapon,
        point: buildCurve(weapon, {
          ...scenarioStore.scenario,
          armorMin: currentArmor.value,
          armorMax: currentArmor.value,
          armorStep: 1,
        }, damageTypesStore.editableDamageTypes, randomProfiles)[0],
        expectedStun: buildDamageRollResults(
          weapon,
          scenarioStore.scenario,
          currentArmor.value,
          damageTypesStore.editableDamageTypes,
          randomProfiles,
        ).reduce((sum, result) => sum + result.stunDamage * result.probability, 0),
        modifiedPower: modifiedPower(weapon, scenarioStore.scenario),
        effectiveArmor: effectiveArmor(weapon, scenarioStore.scenario, currentArmor.value, damageTypesStore.editableDamageTypes),
        armorEffectiveness: armorEffectivenessModifier(weapon, scenarioStore.scenario, damageTypesStore.editableDamageTypes),
        damageType: damageTypeFor(weapon, damageTypesStore.editableDamageTypes),
      }))
      .sort((a, b) => b.point.expected - a.point.expected),
  );

  const targetHpTooltip = computed(
    () =>
      `The red dashed horizontal line marks the target's HP (${formatDamage(scenarioStore.scenario.hitPoints)}). Curves above it have enough expected damage to exceed that HP at the shown armor level.`,
  );

  const rollResults = computed(() =>
    buildDamageRollResults(
      weaponsStore.rollWeapon,
      scenarioStore.scenario,
      currentArmor.value,
      damageTypesStore.editableDamageTypes,
      randomProfiles,
    ),
  );

  const componentCurve = computed(() =>
    buildDamageComponentCurve(
      weaponsStore.rollWeapon,
      scenarioStore.scenario,
      currentArmor.value,
      damageTypesStore.editableDamageTypes,
      randomProfiles,
    ),
  );

  const inspectedCurvePoint = computed(() => {
    const points = componentCurve.value;
    if (points.length === 0) {
      return null;
    }
    const percentile = uiStore.rollHoverPercentile ?? 50;
    return points.reduce((closest, point) =>
      Math.abs(point.percentile - percentile) < Math.abs(closest.percentile - percentile)
        ? point
        : closest,
    );
  });

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
    const maxValues: Record<any, number> = {
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
      damageTypeId: damageTypesStore.selectedDamageType.id,
      basePower: 0,
      armorPenetration: 0,
      damageBonus: [],
      color: damageTypesStore.selectedDamageType.color,
    };
    const outcomes = rollOutcomes(syntheticWeapon, damageTypesStore.editableDamageTypes, randomProfiles);
    const componentSettings = damageComponentOptions.map((option) => ({
      key: option.key,
      percent: damageTypesStore.componentPercent(damageTypesStore.selectedDamageType, option.key),
      randomized: damageTypesStore.componentRandomized(damageTypesStore.selectedDamageType, option.key),
    }));
    const fixedArmorEffectiveness =
      scenarioStore.scenario.armorEffectiveness * damageTypesStore.selectedDamageType.armorEffectiveness;

    for (let armor = 0; armor < height; armor += 1) {
      for (let power = 0; power < width; power += 1) {
        const index = armor * width + power;
        const armorEffectiveness = damageTypesStore.selectedDamageType.armorEffectivenessScalesWithPower
          ? scenarioStore.scenario.armorEffectiveness * (1 + power / 100)
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
            heatmapMetricValue(values, hpStunValues, metric.key as any, index),
          );
        }
      }
    }

    return { width, height, values, hpStunValues, maxValues };
  });

  const heatmapMaxDamage = computed(() => heatmapData.value.maxValues[uiStore.heatmapMetric]);

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
    const hover = uiStore.heatmapHover ?? { armor: 50, power: 75 };
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
    const threshold = scenarioStore.scenario.hitPoints;
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
    const maxDamage = Math.max(...damages, scenarioStore.scenario.hitPoints, rollExpectedDamage.value, 10);
    const zeroChance =
      results
        .filter((result) => result.totalDamage <= 0)
        .reduce((sum, result) => sum + result.probability, 0);
    const killChance =
      results
        .filter((result) => result.hpDamage >= scenarioStore.scenario.hitPoints)
        .reduce((sum, result) => sum + result.probability, 0);
    const koChance =
      results
        .filter((result) => result.hpDamage + result.stunDamage > scenarioStore.scenario.hitPoints)
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
      weaponsStore.rollWeapon,
      scenarioStore.scenario,
      currentArmor.value,
      damageTypesStore.editableDamageTypes,
      randomProfiles,
    ),
  );

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

  function heatmapX(power: number): number {
    return (power / 150) * 660;
  }

  function heatmapY(armor: number): number {
    return ((100 - armor) / 100) * 270;
  }

  function heatmapMetricValue(
    values: Record<DamageComponentKey, Float32Array>,
    hpStunValues: Float32Array,
    metric: string,
    index: number,
  ): number {
    return metric === "hp-stun" ? hpStunValues[index] : (values as any)[metric][index];
  }

  function heatmapValueAt(index: number): number {
    return heatmapMetricValue(
      heatmapData.value.values,
      heatmapData.value.hpStunValues,
      uiStore.heatmapMetric,
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
    const [minRoll, maxRoll] = randomRange(weapon, damageTypesStore.editableDamageTypes, randomProfiles);
    const damageType = damageTypeFor(weapon, damageTypesStore.editableDamageTypes);
    const profile = randomProfileFor(weapon, damageTypesStore.editableDamageTypes, randomProfiles);
    return `${weapon.name}: ${weapon.category}. ${damageType.name} damage. Base ${weapon.basePower}, armor penetration ${formatPercent(
      weapon.armorPenetration,
    )}, armor effectiveness ${formatPercent(armorEffectivenessModifier(weapon, scenarioStore.scenario, damageTypesStore.editableDamageTypes))}, HP ${formatPercent(weapon.damageModifierOverrides?.hp ?? damageType.hpDamagePercent)}, stun ${formatPercent(weapon.damageModifierOverrides?.stun ?? damageType.stunDamagePercent)}, random profile ${profile.label} (${formatPercent(minRoll)}-${formatPercent(
      maxRoll,
    )}).`;
  }

  function weaponAtArmor(weapon: WeaponSystem, armor: number): DamagePoint {
    return buildCurve(weapon, {
      ...scenarioStore.scenario,
      armorMin: armor,
      armorMax: armor,
      armorStep: 1,
    }, damageTypesStore.editableDamageTypes, randomProfiles)[0];
  }

  function percentileTooltip(result: DamageComponentCurvePoint): string {
    return `${formatDamage(result.totalDamage)} total by the ${Math.round(result.percentile)}th percentile. HP ${formatDamage(result.hpDamage)}, stun ${formatDamage(result.stunDamage)}. Underlying roll: ${result.rollPercent}%.`;
  }

  function inspectorLabelX(point: DamageComponentCurvePoint): number {
    return Math.min(610, Math.max(8, rollX(point.percentile) + 10));
  }

  function inspectorLabelY(point: DamageComponentCurvePoint): number {
    return Math.max(10, rollY(point.totalDamage) - 42);
  }

  return {
    chartSeries,
    maxExpectedDamage,
    currentArmor,
    focusedRows,
    targetHpTooltip,
    rollResults,
    componentCurve,
    inspectedCurvePoint,
    heatmapData,
    heatmapMaxDamage,
    heatmapImageHref,
    inspectedHeatmapCell,
    heatmapHpContour,
    rollStats,
    rollExpectedDamage,
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
    heatmapRgb,
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
    inspectorLabelX,
    inspectorLabelY,
  };
});
