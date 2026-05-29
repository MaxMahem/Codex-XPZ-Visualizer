import { computed, type Ref } from "vue";
import { rollOutcomesForPower } from "../damage";
import { randomProfiles } from "../data";
import { damageComponentOptions } from "../stores/damageTypesStore";
import { useScenarioStore } from "../stores/scenarioStore";
import { heatmapMetrics, type HeatmapMetric } from "../uiOptions";
import type { DamageComponentKey, DamageType } from "../types";

export type HeatmapContourSegment = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export function useHeatmapModel(damageType: Ref<DamageType>, heatmapMetric: Ref<HeatmapMetric>) {
  const scenarioStore = useScenarioStore();

  const heatmapData = computed(() => {
    const width = 151;
    const height = 101;
    const values: Record<DamageComponentKey, Float32Array> = {
      hp: new Float32Array(width * height),
      stun: new Float32Array(width * height),
      morale: new Float32Array(width * height),
      armor: new Float32Array(width * height),
      preArmor: new Float32Array(width * height),
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
      scaledMorale: 1,
      armor: 1,
      preArmor: 1,
      tu: 1,
      energy: 1,
      mana: 1,
    };
    const profile =
      randomProfiles.find((randomProfile) => randomProfile.id === damageType.value.randomProfileId) ??
      randomProfiles[0];
    const outcomesByPower = Array.from({ length: width }, (_, power) => rollOutcomesForPower(power, profile));
    const componentSettings = damageComponentOptions.map((option) => ({
      key: option.key,
      percent: damageType.value.damageComponents[option.key].percent,
      randomized: !!damageType.value.damageComponents[option.key].randomized,
    }));
    const fixedArmorEffectiveness =
      scenarioStore.scenario.armorEffectiveness * damageType.value.armorEffectiveness;

    for (let armor = 0; armor < height; armor += 1) {
      for (let power = 0; power < width; power += 1) {
        const index = armor * width + power;
        const armorEffectiveness = damageType.value.armorEffectivenessScalesWithPower
          ? scenarioStore.scenario.armorEffectiveness * (1 + power / 100)
          : fixedArmorEffectiveness;

        for (const outcome of outcomesByPower[power]) {
          const rolledPower = outcome.rolledPower;
          const postArmorDamage = Math.max(
            0,
            Math.trunc(rolledPower - armor * armorEffectiveness),
          );
          for (const setting of componentSettings) {
            const componentBaseDamage = setting.key === "preArmor" ? rolledPower : postArmorDamage;
            values[setting.key][index] +=
              expectedComponentFromPostArmor(
                componentBaseDamage,
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

  function lookupCell(hover: { armor: number; power: number }) {
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
  }

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

  function heatmapMetricValue(
    values: Record<DamageComponentKey, Float32Array>,
    hpStunValues: Float32Array,
    metric: HeatmapMetric,
    index: number,
  ): number {
    if (metric === "hp-stun") {
      return hpStunValues[index];
    }
    if (metric === "scaledMorale") {
      return Math.trunc(((110 - scenarioStore.scenario.targetBravery) * values.morale[index]) / 100);
    }
    if (metric === "armor") {
      return values.armor[index] + values.preArmor[index];
    }
    return values[metric][index];
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

  return {
    heatmapData,
    heatmapHpContour,
    heatmapImageHref,
    heatmapMaxDamage,
    lookupCell,
  };
}

function expectedComponentFromPostArmor(
  postArmorDamage: number,
  percent: number,
  randomized: boolean,
): number {
  const damage = Math.max(0, Math.trunc(postArmorDamage));
  if (damage <= 0 || percent <= 0) {
    return 0;
  }

  if (!randomized) {
    return Math.round(damage * percent);
  }

  let sum = 0;
  for (let roll = 0; roll <= damage; roll += 1) {
    sum += Math.round(roll * percent);
  }
  return sum / (damage + 1);
}

function heatmapX(power: number): number {
  return (power / 150) * 660;
}

function heatmapY(armor: number): number {
  return ((100 - armor) / 100) * 270;
}
