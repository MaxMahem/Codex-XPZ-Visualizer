import { computed, type Ref } from "vue";
import {
  expectedDamage,
  expectedDamageComponents,
} from "../damage";
import {
  buildMultiShotDamageStatsForWeapon,
  buildMultiShotProjectionCurveForWeapon,
  multiplyExpectedDamageComponents,
} from "../multiShotDamage";
import { randomProfiles } from "../data";
import { useDamageTypesStore } from "../stores/damageTypesStore";
import { useScenarioStore } from "../stores/scenarioStore";
import { useWeaponsStore } from "../stores/weaponsStore";
import type { DamageMetricKey } from "../types";

export function useRollDamageModel(
  focusedWeaponId: Ref<string>,
  metric: Ref<DamageMetricKey>,
  allMetrics: Ref<DamageMetricKey[]>,
  rollHoverPercentile: Ref<number | null> = computed(() => null),
  shotCount: Ref<number> = computed(() => 1),
) {
  const scenarioStore = useScenarioStore();
  const damageTypesStore = useDamageTypesStore();
  const weaponsStore = useWeaponsStore();
  const currentArmor = computed(() => scenarioStore.currentArmor);
  const modeledShotCount = computed(() => shotCount.value);

  const rollWeapon = computed(
    () =>
      weaponsStore.editableWeapons.find(
        (weapon) => weapon.id === focusedWeaponId.value,
      ) ??
      weaponsStore.editableWeapons[0] ??
      weaponsStore.fallbackWeapon,
  );

  const damageStats = computed(() =>
    buildMultiShotDamageStatsForWeapon(
      rollWeapon.value,
      scenarioStore.scenario,
      currentArmor.value,
      damageTypesStore.editableDamageTypes,
      modeledShotCount.value,
      randomProfiles,
    ),
  );

  const componentCurve = computed(() => {
    const curves = buildMultiShotProjectionCurveForWeapon(
      rollWeapon.value,
      scenarioStore.scenario,
      currentArmor.value,
      damageTypesStore.editableDamageTypes,
      modeledShotCount.value,
      randomProfiles,
      allMetrics.value,
    );
    return curves[metric.value] ?? [];
  });

  const rollExpectedDamage = computed(() =>
    expectedDamage(
      rollWeapon.value,
      scenarioStore.scenario,
      currentArmor.value,
      damageTypesStore.editableDamageTypes,
      randomProfiles,
    ) * modeledShotCount.value,
  );

  const rollExpectedComponents = computed(() =>
    multiplyExpectedDamageComponents(
      expectedDamageComponents(
        rollWeapon.value,
        scenarioStore.scenario,
        currentArmor.value,
        damageTypesStore.editableDamageTypes,
        randomProfiles,
      ),
      modeledShotCount.value,
    ),
  );

  const inspectedCurveIndex = computed(() => {
    const points = componentCurve.value;
    if (!points || points.length === 0) return null;
    const percentile = rollHoverPercentile.value ?? 50;
    let closestIndex = 0;
    let minDiff = Math.abs(points[0].percentile - percentile);
    for (let i = 1; i < points.length; i++) {
      const diff = Math.abs(points[i].percentile - percentile);
      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = i;
      }
    }
    return closestIndex;
  });

  const inspectedCurvePoint = computed(() => {
    const index = inspectedCurveIndex.value;
    if (index === null) return null;
    const points = componentCurve.value;
    const basePoint = points[index];
    if (!basePoint) return null;

    return {
      percentile: basePoint.percentile,
      rollPercent: basePoint.rollPercent,
      rolledPower: basePoint.rolledPower,
      value: basePoint.value,
    };
  });

  const rollStats = computed(() => {
    const stats = damageStats.value;
    const points = componentCurve.value;
    const damages = points.map((point) => point.value);
    const minDamage = Math.min(...damages, 0);
    const maxDamage = Math.max(...damages, scenarioStore.scenario.hitPoints, rollExpectedDamage.value, 10);

    return {
      minDamage,
      maxDamage,
      effectivePanicChance: metric.value === "panicChance"
        ? points.reduce((sum, point, index, pts) => {
          const previous = index === 0 ? 0 : pts[index - 1].percentile / 100;
          return sum + point.value * (point.percentile / 100 - previous);
        }, 0)
        : 0,
      zeroChance: stats.zeroChance,
      killChance: stats.killChance,
      koChance: stats.koChance,
      outcomeCount: stats.outcomeCount,
    };
  });

  return {
    rollWeapon,
    componentCurve,
    currentArmor,
    inspectedCurveIndex,
    inspectedCurvePoint,
    modeledShotCount,
    rollExpectedDamage,
    rollExpectedComponents,
    rollStats,
  };
}
