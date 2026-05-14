import { computed } from "vue";
import { useScenarioStore } from "../stores/scenarioStore";

export function useCurrentArmor() {
  const scenarioStore = useScenarioStore();

  const currentArmor = computed(() => Math.round(scenarioStore.scenario.armor));

  return {
    currentArmor,
  };
}
