import { computed } from "vue";
import {
  buildDamageComponentCurve,
  buildDamageRollResults,
  expectedDamage,
  expectedDamageComponents,
} from "../damage";
import { randomProfiles } from "../data";
import { useDamageTypesStore } from "../stores/damageTypesStore";
import { useInspectorStore } from "../stores/inspectorStore";
import { useScenarioStore } from "../stores/scenarioStore";
import { useUiStore } from "../stores/uiStore";
import { useWeaponsStore } from "../stores/weaponsStore";
import { useCurrentArmor } from "./useCurrentArmor";
import type { DamageComponentCurvePoint, DamageMetricKey } from "../types";

export function useRollDamageModel() {
  const scenarioStore = useScenarioStore();
  const damageTypesStore = useDamageTypesStore();
  const weaponsStore = useWeaponsStore();
  const inspectorStore = useInspectorStore();
  const uiStore = useUiStore();
  const { currentArmor } = useCurrentArmor();

  const rollWeapon = computed(
    () =>
      weaponsStore.editableWeapons.find(
        (weapon) => weapon.id === inspectorStore.focusedId,
      ) ??
      weaponsStore.editableWeapons[0] ??
      weaponsStore.fallbackWeapon,
  );

  const rollResults = computed(() =>
    buildDamageRollResults(
      rollWeapon.value,
      scenarioStore.scenario,
      currentArmor.value,
      damageTypesStore.editableDamageTypes,
      randomProfiles,
    ),
  );

  const componentCurve = computed(() =>
    buildDamageComponentCurve(
      rollWeapon.value,
      scenarioStore.scenario,
      currentArmor.value,
      damageTypesStore.editableDamageTypes,
      randomProfiles,
    ),
  );

  const rollExpectedDamage = computed(() =>
    expectedDamage(
      rollWeapon.value,
      scenarioStore.scenario,
      currentArmor.value,
      damageTypesStore.editableDamageTypes,
      randomProfiles,
    ),
  );

  const rollExpectedComponents = computed(() =>
    expectedDamageComponents(
      rollWeapon.value,
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
    const damages = componentCurve.value.flatMap((result) => [
      result.totalDamage,
      ...uiStore.visibleRollComponents.map((component) => visibleComponentDamage(result, component)),
    ]);
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
    rollWeapon,
    componentCurve,
    currentArmor,
    inspectedCurvePoint,
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
    case "armor": return result.armorDamage + result.preArmorDamage;
    case "preArmor": return result.preArmorDamage;
    case "tu": return result.tuDamage;
    case "energy": return result.energyDamage;
    case "mana": return result.manaDamage;
  }
}
