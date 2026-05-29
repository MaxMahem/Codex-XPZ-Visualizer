import { defineStore } from "pinia";
import { computed, reactive } from "vue";
import { defaultScenario } from "../data";

export const useScenarioStore = defineStore('scenario', () => {
  const scenario = reactive({ ...defaultScenario });
  const currentArmor = computed(() => Math.round(scenario.armor));

  return {
    scenario,
    currentArmor,
  };
});
