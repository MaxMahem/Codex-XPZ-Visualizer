import { defineStore } from "pinia";
import { ref } from "vue";

export const useInspectorStore = defineStore('inspector', () => {
  const focusedId = ref<string>("");

  function setFocus(id: string) {
    focusedId.value = id;
  }

  return {
    focusedId,
    setFocus,
  };
});
