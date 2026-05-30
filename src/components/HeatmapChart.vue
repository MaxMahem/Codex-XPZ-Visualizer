<script setup lang="ts">
import { computed, ref, toRef } from "vue";
import { useHeatmapModel } from "../composables/useHeatmapModel";
import { heatmapMetrics, type HeatmapMetric } from "../uiOptions";
import { formatDamage } from "../utils/formatters";
import type { DamageType } from "../types";
import { defaultHeatmapDomain } from "../data";

// --- SVG layout constants (presentation only) ---
const PLOT_WIDTH = 660;
const PLOT_HEIGHT = 270;
const SVG_WIDTH = 780;
const SVG_HEIGHT = 350;
const TRANSLATE_X = 58;
const TRANSLATE_Y = 20;

const props = defineProps<{
  damageType: DamageType;
  heatmapMetric: HeatmapMetric;
}>();

const heatmapHover = ref<{ armor: number; power: number } | null>(null);
const domain = computed(() => defaultHeatmapDomain);
const damageTypeRef = toRef(props, "damageType");
const heatmapMetricRef = toRef(props, "heatmapMetric");

const { metricGrid, maxValue, valueAt, lookupCell, heatmapHpContour } = useHeatmapModel(
  domain,
  damageTypeRef,
  heatmapMetricRef,
);

const metricLabel = computed(
  () => heatmapMetrics.find((m) => m.key === props.heatmapMetric)?.label ?? props.heatmapMetric,
);

const inspectedHeatmapCell = computed(() => lookupCell(heatmapHover.value ?? { armor: 50, power: 75 }));

const powerTicks = computed(() => {
  const ticks = [];
  for (let i = 0; i <= domain.value.maxPower; i += 25) ticks.push(i);
  return ticks;
});

const armorTicks = computed(() => {
  const ticks = [];
  for (let i = 0; i <= domain.value.maxArmor; i += 25) ticks.push(i);
  return ticks;
});

// --- Pixel coordinate conversion (presentation) ---

function heatmapX(power: number): number {
  return (power / domain.value.maxPower) * PLOT_WIDTH;
}

function heatmapY(armor: number): number {
  return ((domain.value.maxArmor - armor) / domain.value.maxArmor) * PLOT_HEIGHT;
}

function heatmapTooltipX(): number {
  return Math.min(PLOT_WIDTH - 148, heatmapX(inspectedHeatmapCell.value.power) + 12);
}

function heatmapTooltipY(): number {
  return Math.max(8, heatmapY(inspectedHeatmapCell.value.armor) - 56);
}

// --- Canvas image rendering (presentation) ---

function heatmapRgb(value: number, max: number): [number, number, number] {
  const clampedMax = Math.max(1, Math.round(max));
  const intensity = Math.max(0, Math.min(1, Math.round(value) / clampedMax));
  const low = [253, 245, 243];
  const high = [198, 67, 44];
  return [
    Math.round(low[0] + (high[0] - low[0]) * intensity),
    Math.round(low[1] + (high[1] - low[1]) * intensity),
    Math.round(low[2] + (high[2] - low[2]) * intensity),
  ];
}

const heatmapImageHref = computed(() => {
  const { values, width, height } = metricGrid.value;
  const max = maxValue.value;
  if (typeof document === "undefined") return "";

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return "";

  const image = context.createImageData(width, height);
  for (let armor = 0; armor < height; armor += 1) {
    for (let power = 0; power < width; power += 1) {
      const sourceIndex = armor * width + power;
      const targetIndex = ((height - 1 - armor) * width + power) * 4;
      const [red, green, blue] = heatmapRgb(valueAt(sourceIndex), max);
      image.data[targetIndex] = red;
      image.data[targetIndex + 1] = green;
      image.data[targetIndex + 2] = blue;
      image.data[targetIndex + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);
  return canvas.toDataURL("image/png");
});

// --- Contour segments converted to pixel coordinates ---

const heatmapContourPixels = computed(() =>
  heatmapHpContour.value.map((seg) => ({
    x1: heatmapX(seg.powerA),
    y1: heatmapY(seg.armorA),
    x2: heatmapX(seg.powerB),
    y2: heatmapY(seg.armorB),
  })),
);

// --- Pointer interaction ---

function handlePointer(event: PointerEvent): void {
  const svg = event.currentTarget as SVGSVGElement;
  const rect = svg.getBoundingClientRect();
  const plotLeft = (TRANSLATE_X / SVG_WIDTH) * rect.width;
  const plotTop = (TRANSLATE_Y / SVG_HEIGHT) * rect.height;
  const plotWidth = (PLOT_WIDTH / SVG_WIDTH) * rect.width;
  const plotHeight = (PLOT_HEIGHT / SVG_HEIGHT) * rect.height;
  const x = Math.min(plotWidth, Math.max(0, event.clientX - rect.left - plotLeft));
  const y = Math.min(plotHeight, Math.max(0, event.clientY - rect.top - plotTop));
  heatmapHover.value = {
    power: Math.round((x / plotWidth) * domain.value.maxPower),
    armor: Math.round(domain.value.maxArmor - (y / plotHeight) * domain.value.maxArmor),
  };
}

function clearPointer(): void {
  heatmapHover.value = null;
}
</script>

<template>
  <div class="heatmap-map">
    <svg
      viewBox="0 0 780 350"
      role="img"
      aria-label="Expected damage heat map by weapon power and armor"
      @pointermove="handlePointer"
      @pointerleave="clearPointer"
    >
      <defs>
        <clipPath id="heatmap-surface-clip">
          <rect width="660" height="270" rx="6"></rect>
        </clipPath>
      </defs>
      <g transform="translate(58 20)">
        <rect class="heatmap-backdrop" width="660" height="270" rx="6"></rect>
        <g clip-path="url(#heatmap-surface-clip)">
          <image
            v-if="heatmapImageHref"
            class="heatmap-surface"
            :href="heatmapImageHref"
            x="0"
            y="0"
            width="660"
            height="270"
            preserveAspectRatio="none"
          />
          <line
            v-for="power in powerTicks"
            :key="`hm-x-${power}`"
            class="heatmap-grid-line"
            :x1="heatmapX(power)"
            :x2="heatmapX(power)"
            y1="0"
            y2="270"
          />
          <line
            v-for="armor in armorTicks"
            :key="`hm-y-${armor}`"
            class="heatmap-grid-line"
            x1="0"
            x2="660"
            :y1="heatmapY(armor)"
            :y2="heatmapY(armor)"
          />
          <line
            v-for="(segment, index) in heatmapContourPixels"
            :key="`hm-hp-${index}`"
            class="heatmap-contour"
            :x1="segment.x1"
            :y1="segment.y1"
            :x2="segment.x2"
            :y2="segment.y2"
          />
        </g>
        <text
          v-for="power in powerTicks"
          :key="`hm-xl-${power}`"
          class="axis-label"
          :x="heatmapX(power)"
          y="300"
          text-anchor="middle"
        >
          {{ power }}
        </text>
        <text
          v-for="armor in armorTicks"
          :key="`hm-yl-${armor}`"
          class="axis-label"
          x="-12"
          :y="heatmapY(armor) + 4"
          text-anchor="end"
        >
          {{ armor }}
        </text>
        <text class="axis-title" x="330" y="334" text-anchor="middle">Weapon power</text>
        <text
          class="axis-title"
          x="-42"
          y="135"
          text-anchor="middle"
          transform="rotate(-90 -42 135)"
        >
          Armor
        </text>
        <line
          v-if="inspectedHeatmapCell"
          class="hover-line"
          :x1="heatmapX(inspectedHeatmapCell.power)"
          :x2="heatmapX(inspectedHeatmapCell.power)"
          y1="0"
          y2="270"
        />
        <line
          v-if="inspectedHeatmapCell"
          class="hover-line"
          x1="0"
          x2="660"
          :y1="heatmapY(inspectedHeatmapCell.armor)"
          :y2="heatmapY(inspectedHeatmapCell.armor)"
        />
        <circle
          v-if="inspectedHeatmapCell"
          class="heatmap-inspect-dot"
          r="5"
          :cx="heatmapX(inspectedHeatmapCell.power)"
          :cy="heatmapY(inspectedHeatmapCell.armor)"
        />
        <g
          v-if="inspectedHeatmapCell"
          class="chart-tooltip heatmap-tooltip"
          :transform="`translate(${heatmapTooltipX()} ${heatmapTooltipY()})`"
        >
          <rect width="160" height="48" rx="6"></rect>
          <text x="9" y="14">Power {{ inspectedHeatmapCell.power }}</text>
          <text x="9" y="28">Armor {{ inspectedHeatmapCell.armor }}</text>
          <text x="9" y="42">{{ metricLabel }} {{ formatDamage(inspectedHeatmapCell.expectedMetric) }}</text>
        </g>
      </g>
    </svg>
  </div>
</template>
