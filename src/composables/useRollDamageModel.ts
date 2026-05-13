import { computed } from "vue";
import {
  buildDamageComponentCurve,
  buildDamageRollResults,
  expectedDamage,
} from "../damage";
import { randomProfiles } from "../data";
import { useDamageTypesStore } from "../stores/damageTypesStore";
import { useScenarioStore } from "../stores/scenarioStore";
import { useUiStore } from "../stores/uiStore";
import { useWeaponsStore } from "../stores/weaponsStore";
import { useCurrentArmor } from "./useCurrentArmor";

export function useRollDamageModel() {
  const scenarioStore = useScenarioStore();
  const damageTypesStore = useDamageTypesStore();
  const weaponsStore = useWeaponsStore();
  const uiStore = useUiStore();
  const { currentArmor } = useCurrentArmor();

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

  const rollExpectedDamage = computed(() =>
    expectedDamage(
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

  const rollStats = computed(() => {
    const results = rollResults.value;
    const damages = componentCurve.value.map((result) => result.totalDamage);
    const minDamage = Math.min(...damages, 0);
    const maxDamage = Math.max(...damages, scenarioStore.scenario.hitPoints, rollExpectedDamage.value, 10);
    const zeroChance = results
      .filter((result) => result.totalDamage <= 0)
      .reduce((sum, result) => sum + result.probability, 0);
    const killChance = results
      .filter((result) => result.hpDamage >= scenarioStore.scenario.hitPoints)
      .reduce((sum, result) => sum + result.probability, 0);
    const koChance = results
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

  return {
    componentCurve,
    currentArmor,
    inspectedCurvePoint,
    rollExpectedDamage,
    rollResults,
    rollStats,
  };
}
