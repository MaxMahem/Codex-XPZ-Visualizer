<script setup lang="ts">
const modelValue = defineModel<string>();
defineProps<{
  title?: string;
  tooltip?: string;
}>();
</script>

<template>
  <label
    class="swatch-picker"
    :class="{ 'has-tip': tooltip }"
    :style="{ backgroundColor: modelValue }"
    :data-tip="tooltip"
  >
    <input v-model="modelValue" type="color" :title="title" />
  </label>
</template>
