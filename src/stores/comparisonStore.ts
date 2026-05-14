import { defineStore } from "pinia";
import { ref } from "vue";

export const useComparisonStore = defineStore('comparison', () => {
  const selectedIds = ref<string[]>([]);

  function toggleWeapon(id: string) {
    if (selectedIds.value.includes(id)) {
      selectedIds.value = selectedIds.value.filter((i) => i !== id);
    } else {
      selectedIds.value = [...selectedIds.value, id];
    }
  }

  function selectOnly(id: string) {
    selectedIds.value = [id];
  }

  function clear() {
    selectedIds.value = [];
  }

  return {
    selectedIds,
    toggleWeapon,
    selectOnly,
    clear,
  };
});
