<script setup lang="ts">
const modelValue = defineModel<string>();
const props = defineProps<{
  title?: string;
  tooltip?: string;
  disabled?: boolean;
}>();
</script>

<template>
  <label
    class="swatch-picker"
    :class="{ 'has-tip': tooltip, 'disabled': disabled }"
    :style="{ backgroundColor: modelValue }"
    :data-tip="tooltip"
  >
    <input v-model="modelValue" type="color" :title="title" :disabled="disabled" />
  </label>
</template>

<style scoped>
.swatch-picker.disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
.swatch-picker.disabled input {
  pointer-events: none;
}
</style>
