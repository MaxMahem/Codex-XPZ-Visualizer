import { computed, type Ref } from "vue";
import { rollOutcomesForPower } from "../damage";
import { randomProfiles } from "../data";
import { damageComponentOptions } from "../stores/damageTypesStore";
import { useScenarioStore } from "../stores/scenarioStore";
import { heatmapMetrics, type HeatmapMetric } from "../uiOptions";
import type { DamageComponentKey, DamageType, HeatmapDomain } from "../types";

/** A contour segment in data coordinates (power/armor). */
export type HeatmapContourSegment = {
  powerA: number;
  armorA: number;
  powerB: number;
  armorB: number;
};

const heatmapMetricComponents = {
  hp: ["hp"],
  stun: ["stun"],
  "hp-stun": ["hp", "stun"],
  morale: ["morale"],
  armor: ["armor", "preArmor"],
  preArmor: ["preArmor"],
  tu: ["tu"],
  energy: ["energy"],
  mana: ["mana"],
} satisfies Record<HeatmapMetric, DamageComponentKey[]>;

export function useHeatmapModel(
  domain: Ref<HeatmapDomain>,
  damageType: Ref<DamageType>,
  heatmapMetric: Ref<HeatmapMetric>,
) {
  const scenarioStore = useScenarioStore();

  /** The set of component keys needed to compute the requested metric. */
  const neededComponents = computed(() => heatmapMetricComponents[heatmapMetric.value]);

  /**
   * Computes the damage components required for the selected metric.
   * Returns a flat Float32Array of metric values indexed by (armor * width + power).
   */
  const metricGrid = computed((): { values: Float32Array; width: number; height: number; maxValue: number } => {
    const { maxPower, maxArmor } = domain.value;
    const width = maxPower + 1;
    const height = maxArmor + 1;
    const components = neededComponents.value;

    const componentSet = new Set<DamageComponentKey>(components);
    const componentValues: Partial<Record<DamageComponentKey, Float32Array>> =
      Object.fromEntries(
        [...componentSet].map(key => [key, new Float32Array(width * height)])
      );

    const randomProfile =
      randomProfiles.find((p) => p.id === damageType.value.randomProfileId) ?? randomProfiles[0];
    const outcomesByPower = Array.from({ length: width }, (_, power) => rollOutcomesForPower(power, randomProfile));
    const componentSettings = damageComponentOptions
      .filter((option) => componentSet.has(option.key))
      .map((option) => ({
        key: option.key,
        percent: damageType.value.damageComponents[option.key].percent,
        randomized: !!damageType.value.damageComponents[option.key].randomized,
      }));
    const fixedArmorEffectiveness =
      scenarioStore.scenario.armorEffectiveness * damageType.value.armorEffectiveness;

    const metric = heatmapMetric.value;
    const values = new Float32Array(width * height);
    let maxValue = 1;

    for (let armor = 0; armor < height; armor += 1) {
      for (let power = 0; power < width; power += 1) {
        const index = armor * width + power;
        const armorEffectiveness = damageType.value.armorEffectivenessScalesWithPower
          ? scenarioStore.scenario.armorEffectiveness * (1 + power / 100)
          : fixedArmorEffectiveness;

        for (const outcome of outcomesByPower[power]) {
          const rolledPower = outcome.rolledPower;
          const postArmorDamage = Math.max(0, Math.trunc(rolledPower - armor * armorEffectiveness));

          for (const setting of componentSettings) {
            const baseDamage = setting.key === "preArmor" ? rolledPower : postArmorDamage;
            componentValues[setting.key]![index] +=
              expectedComponentFromPostArmor(baseDamage, setting.percent, setting.randomized) *
              outcome.probability;
          }
        }

        // Sum the needed components into the metric value for this cell.
        let cellValue = 0;
        for (const key of components) {
          cellValue += componentValues[key]![index];
        }
        values[index] = cellValue;
        if (cellValue > maxValue) maxValue = cellValue;
      }
    }

    return { values, width, height, maxValue };
  });

  const maxValue = computed(() => metricGrid.value.maxValue);

  function valueAt(index: number): number {
    return metricGrid.value.values[index] ?? 0;
  }

  function valueAtCoord(power: number, armor: number): number {
    const { width } = metricGrid.value;
    return valueAt(armor * width + power);
  }

  function lookupCell(hover: { armor: number; power: number }): {
    armor: number;
    power: number;
    expectedMetric: number;
  } {
    const { maxPower, maxArmor } = domain.value;
    const armor = Math.max(0, Math.min(maxArmor, Math.round(hover.armor)));
    const power = Math.max(0, Math.min(maxPower, Math.round(hover.power)));
    return { armor, power, expectedMetric: valueAt(armor * metricGrid.value.width + power) };
  }

  /** Returns contour segments in data coordinates (power/armor), at the scenario HP threshold. */
  const heatmapHpContour = computed<HeatmapContourSegment[]>(() => {
    const { width, height } = metricGrid.value;
    const threshold = scenarioStore.scenario.hitPoints;
    const segments: HeatmapContourSegment[] = [];

    for (let armor = 0; armor < height - 1; armor += 1) {
      for (let power = 0; power < width - 1; power += 1) {
        const bottomLeft = valueAtCoord(power, armor);
        const bottomRight = valueAtCoord(power + 1, armor);
        const topRight = valueAtCoord(power + 1, armor + 1);
        const topLeft = valueAtCoord(power, armor + 1);
        const intersections = [
          contourPoint(power, armor, bottomLeft, power + 1, armor, bottomRight, threshold),
          contourPoint(power + 1, armor, bottomRight, power + 1, armor + 1, topRight, threshold),
          contourPoint(power + 1, armor + 1, topRight, power, armor + 1, topLeft, threshold),
          contourPoint(power, armor + 1, topLeft, power, armor, bottomLeft, threshold),
        ].filter((point): point is { power: number; armor: number } => point !== null);

        if (intersections.length === 2) {
          segments.push({
            powerA: intersections[0].power,
            armorA: intersections[0].armor,
            powerB: intersections[1].power,
            armorB: intersections[1].armor,
          });
        }

        if (intersections.length === 4) {
          segments.push(
            {
              powerA: intersections[0].power,
              armorA: intersections[0].armor,
              powerB: intersections[1].power,
              armorB: intersections[1].armor,
            },
            {
              powerA: intersections[2].power,
              armorA: intersections[2].armor,
              powerB: intersections[3].power,
              armorB: intersections[3].armor,
            },
          );
        }
      }
    }

    return segments;
  });

  /** Returns a contour intersection point in data coordinates, or null. */
  function contourPoint(
    powerA: number,
    armorA: number,
    valueA: number,
    powerB: number,
    armorB: number,
    valueB: number,
    threshold: number,
  ): { power: number; armor: number } | null {
    if (valueA === valueB) return null;

    const min = Math.min(valueA, valueB);
    const max = Math.max(valueA, valueB);
    if (threshold < min || threshold > max) return null;

    const ratio = (threshold - valueA) / (valueB - valueA);
    return {
      power: powerA + (powerB - powerA) * ratio,
      armor: armorA + (armorB - armorA) * ratio,
    };
  }

  return {
    metricGrid,
    maxValue,
    valueAt,
    lookupCell,
    heatmapHpContour,
  };
}

function expectedComponentFromPostArmor(
  postArmorDamage: number,
  percent: number,
  randomized: boolean,
): number {
  const damage = Math.max(0, Math.trunc(postArmorDamage));
  if (damage <= 0 || percent <= 0) return 0;

  if (!randomized) return Math.round(damage * percent);

  let sum = 0;
  for (let roll = 0; roll <= damage; roll += 1) {
    sum += Math.round(roll * percent);
  }
  return sum / (damage + 1);
}
