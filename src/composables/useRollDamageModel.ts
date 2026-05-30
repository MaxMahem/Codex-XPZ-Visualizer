import { computed, type Ref } from "vue";
import {
  buildDamageRollResults,
  expectedDamage,
  expectedDamageComponents,
} from "../damage";
import {
  buildMultiShotComponentCurve,
  buildMultiShotDamageStatsForWeapon,
  buildMultiShotDamageRollResults,
  buildMultiShotProjectionCurveForWeapon,
  buildSingleShotComponentCurveForMetrics,
  multiplyExpectedDamageComponents,
} from "../multiShotDamage";
import { randomProfiles } from "../data";
import { useDamageTypesStore } from "../stores/damageTypesStore";
import { useScenarioStore } from "../stores/scenarioStore";
import { useWeaponsStore } from "../stores/weaponsStore";
import type { DamageComponentCurvePoint, DamageMetricKey } from "../types";

export function useRollDamageModel(
  focusedWeaponId: Ref<string>,
  visibleRollComponents: Ref<DamageMetricKey[]>,
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

  const singleShotRollResults = computed(() =>
    buildDamageRollResults(
      rollWeapon.value,
      scenarioStore.scenario,
      currentArmor.value,
      damageTypesStore.editableDamageTypes,
      randomProfiles,
    ),
  );

  const rollResults = computed(() =>
    buildMultiShotDamageRollResults(singleShotRollResults.value, modeledShotCount.value),
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

  const singleShotComponentCurve = computed(() =>
    buildSingleShotComponentCurveForMetrics(
      rollWeapon.value,
      scenarioStore.scenario,
      currentArmor.value,
      damageTypesStore.editableDamageTypes,
      randomProfiles,
      visibleRollComponents.value,
    ),
  );

  const componentCurve = computed(() =>
    buildMultiShotProjectionCurveForWeapon(
      rollWeapon.value,
      scenarioStore.scenario,
      currentArmor.value,
      damageTypesStore.editableDamageTypes,
      modeledShotCount.value,
      randomProfiles,
      visibleRollComponents.value,
    ),
  );

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

  const rollStats = computed(() => {
    const stats = damageStats.value;
    const damageComponents = visibleRollComponents.value.filter((component) => component !== "panicChance");
    const damages = componentCurve.value.flatMap((result) => [
      result.totalDamage,
      ...damageComponents.map((component) => visibleComponentDamage(result, component)),
    ]);
    const minDamage = Math.min(...damages, 0);
    const maxDamage = Math.max(...damages, scenarioStore.scenario.hitPoints, rollExpectedDamage.value, 10);

    return {
      minDamage,
      maxDamage,
      effectivePanicChance: componentCurve.value.reduce((sum, point, index, points) => {
        const previous = index === 0 ? 0 : points[index - 1].percentile / 100;
        return sum + point.panicChance * (point.percentile / 100 - previous);
      }, 0),
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
    inspectedCurvePoint,
    modeledShotCount,
    rollExpectedDamage,
    rollExpectedComponents,
    rollResults,
    rollStats,
  };
}

function visibleComponentDamage(result: DamageComponentCurvePoint, component: DamageMetricKey): number {
  switch (component) {
    case "hp": return result.hpDamage;
    case "stun": return result.stunDamage;
    case "hp-stun": return result.hpDamage + result.stunDamage;
    case "morale": return result.scaledMoraleDamage;
    case "scaledMorale": return result.scaledMoraleDamage;
    case "panicChance": return result.panicChance;
    case "armor": return result.armorDamage + result.preArmorDamage;
    case "preArmor": return result.preArmorDamage;
    case "tu": return result.tuDamage;
    case "energy": return result.energyDamage;
    case "mana": return result.manaDamage;
  }
}
