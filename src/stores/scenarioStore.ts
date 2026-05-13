import { defineStore } from "pinia";
import { reactive, ref } from "vue";
import { defaultScenario } from "../data";

export type ScenarioTab = "user" | "target";

export const useScenarioStore = defineStore('scenario', () => {
  const scenario = reactive({ ...defaultScenario });
  const scenarioTab = ref<ScenarioTab>("user");

  return {
    scenario,
    scenarioTab,
  };
});
