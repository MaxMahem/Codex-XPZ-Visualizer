<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  modelValue: number | undefined;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  disabled?: boolean;
}>(), {
  min: 0,
  max: 500,
  step: 1,
  placeholder: '',
  disabled: false,
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: number | undefined): void;
}>();

const displayValue = computed(() => {
  if (props.modelValue === undefined || !Number.isFinite(props.modelValue)) {
    return '';
  }
  return Math.round(props.modelValue * 100);
});

function handleInput(event: Event) {
  const value = (event.target as HTMLInputElement).value;
  if (value === "") {
    emit('update:modelValue', undefined);
    return;
  }
  const parsed = parseInt(value, 10);
  if (Number.isFinite(parsed)) {
    emit('update:modelValue', parsed / 100);
  } else {
    emit('update:modelValue', undefined);
  }
}
</script>

<template>
  <input
    type="number"
    :min="min"
    :max="max"
    :step="step"
    :placeholder="placeholder"
    :disabled="disabled"
    :value="displayValue"
    @input="handleInput"
  />
</template>
