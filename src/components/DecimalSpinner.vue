<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(defineProps<{
  modelValue: number;
  min?: number;
  max?: number;
  step?: number;
  fallback?: number;
  placeholder?: string;
  disabled?: boolean;
}>(), {
  min: Number.NEGATIVE_INFINITY,
  max: Number.POSITIVE_INFINITY,
  step: 0.01,
  fallback: 0,
  placeholder: "",
  disabled: false,
});

const emit = defineEmits<{
  "update:modelValue": [value: number];
}>();

const displayValue = computed(() => clampValidNumber(props.modelValue));

function handleInput(event: Event): void {
  const input = event.target as HTMLInputElement;
  if (input.value === "") {
    return;
  }

  emit("update:modelValue", clampValidNumber(input.valueAsNumber));
}

function handleChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  const value = input.value === "" ? props.fallback : input.valueAsNumber;
  const normalized = clampValidNumber(value);
  input.value = String(normalized);
  emit("update:modelValue", normalized);
}

function clampValidNumber(value: number): number {
  const finite = Number.isFinite(value) ? value : props.fallback;
  return Math.min(props.max, Math.max(props.min, finite));
}
</script>

<template>
  <input
    type="number"
    :min="Number.isFinite(min) ? min : undefined"
    :max="Number.isFinite(max) ? max : undefined"
    :step="step"
    :placeholder="placeholder"
    :disabled="disabled"
    :value="displayValue"
    @input="handleInput"
    @change="handleChange"
    @blur="handleChange"
  />
</template>
