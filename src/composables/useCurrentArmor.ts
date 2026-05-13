import { computed } from "vue";
import { useUiStore } from "../stores/uiStore";

export function useCurrentArmor() {
  const uiStore = useUiStore();

  const currentArmor = computed(() => Math.round(uiStore.hoveredArmor ?? 40));

  return {
    currentArmor,
  };
}
