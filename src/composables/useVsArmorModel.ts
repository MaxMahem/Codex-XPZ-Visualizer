import { computed, type Ref } from "vue";
import {
  armorEffectivenessModifier,
  buildCurve,
  buildDamageRollResults,
  damageTypeFor,
  effectiveArmor,
  modifiedPower,
} from "../damage";
import { randomProfiles } from "../data";
import { useDamageTypesStore } from "../stores/damageTypesStore";
import { useScenarioStore } from "../stores/scenarioStore";
import { useWeaponsStore } from "../stores/weaponsStore";
import type { DamagePoint, WeaponSystem } from "../types";

export function useVsArmorModel(selectedWeaponIds: Ref<readonly string[]>) {
  const scenarioStore = useScenarioStore();
  const damageTypesStore = useDamageTypesStore();
  const weaponsStore = useWeaponsStore();
  const currentArmor = computed(() => scenarioStore.currentArmor);

  const selectedWeapons = computed(() =>
    weaponsStore.editableWeapons.filter((weapon) =>
      selectedWeaponIds.value.includes(weapon.id),
    ),
  );

  const chartSeries = computed(() =>
    selectedWeapons.value.map((weapon) => ({
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

  const focusedRows = computed(() =>
    selectedWeapons.value
      .map((weapon) => ({
        weapon,
        point: weaponAtArmor(weapon, currentArmor.value),
        expectedStun: buildDamageRollResults(
          weapon,
          scenarioStore.scenario,
          currentArmor.value,
          damageTypesStore.editableDamageTypes,
          randomProfiles,
        ).reduce((sum, result) => sum + result.stunDamage * result.probability, 0),
        modifiedPower: modifiedPower(weapon, scenarioStore.scenario),
        effectiveArmor: effectiveArmor(
          weapon,
          scenarioStore.scenario,
          currentArmor.value,
          damageTypesStore.editableDamageTypes,
        ),
        armorEffectiveness: armorEffectivenessModifier(
          weapon,
          scenarioStore.scenario,
          damageTypesStore.editableDamageTypes,
        ),
        damageType: damageTypeFor(weapon, damageTypesStore.editableDamageTypes),
      }))
      .sort((a, b) => b.point.expected - a.point.expected),
  );

  function weaponAtArmor(weapon: WeaponSystem, armor: number): DamagePoint {
    return buildCurve(
      weapon,
      {
        ...scenarioStore.scenario,
        armorMin: Math.round(armor),
        armorMax: Math.round(armor),
        armorStep: 1,
      },
      damageTypesStore.editableDamageTypes,
      randomProfiles,
    )[0];
  }

  return {
    selectedWeapons,
    chartSeries,
    currentArmor,
    focusedRows,
    maxExpectedDamage,
    weaponAtArmor,
  };
}
