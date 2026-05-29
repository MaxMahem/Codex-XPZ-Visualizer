<script setup lang="ts">
import { ref, computed } from "vue";
import { useHeatmapModel } from "../composables/useHeatmapModel";
import { formatDamage } from "../utils/formatters";

const { heatmapImageHref, heatmapHpContour, lookupCell } = useHeatmapModel();

const heatmapHover = ref<{ armor: number; power: number } | null>(null);
const inspectedHeatmapCell = computed(() => {
  const hover = heatmapHover.value ?? { armor: 50, power: 75 };
  return lookupCell(hover.armor, hover.power);
});

function heatmapX(power: number): number {
  return (power / 150) * 660;
}

function heatmapY(armor: number): number {
  return ((100 - armor) / 100) * 270;
}

function heatmapTooltipX(): number {
  return Math.min(512, heatmapX(inspectedHeatmapCell.value.power) + 12);
}

function heatmapTooltipY(): number {
  return Math.max(8, heatmapY(inspectedHeatmapCell.value.armor) - 42);
}

function handlePointer(event: PointerEvent): void {
  const svg = event.currentTarget as SVGSVGElement;
  const rect = svg.getBoundingClientRect();
  const plotLeft = (58 / 780) * rect.width;
  const plotTop = (20 / 350) * rect.height;
  const plotWidth = (660 / 780) * rect.width;
  const plotHeight = (270 / 350) * rect.height;
  const x = Math.min(plotWidth, Math.max(0, event.clientX - rect.left - plotLeft));
  const y = Math.min(plotHeight, Math.max(0, event.clientY - rect.top - plotTop));
  heatmapHover.value = {
    power: Math.round((x / plotWidth) * 150),
    armor: Math.round(100 - (y / plotHeight) * 100),
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
            v-for="power in [0, 25, 50, 75, 100, 125, 150]"
            :key="`hm-x-${power}`"
            class="heatmap-grid-line"
            :x1="heatmapX(power)"
            :x2="heatmapX(power)"
            y1="0"
            y2="270"
          />
          <line
            v-for="armor in [0, 25, 50, 75, 100]"
            :key="`hm-y-${armor}`"
            class="heatmap-grid-line"
            x1="0"
            x2="660"
            :y1="heatmapY(armor)"
            :y2="heatmapY(armor)"
          />
          <line
            v-for="(segment, index) in heatmapHpContour"
            :key="`hm-hp-${index}`"
            class="heatmap-contour"
            :x1="segment.x1"
            :y1="segment.y1"
            :x2="segment.x2"
            :y2="segment.y2"
          />
        </g>
        <text
          v-for="power in [0, 25, 50, 75, 100, 125, 150]"
          :key="`hm-xl-${power}`"
          class="axis-label"
          :x="heatmapX(power)"
          y="300"
          text-anchor="middle"
        >
          {{ power }}
        </text>
        <text
          v-for="armor in [0, 25, 50, 75, 100]"
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
          <rect width="160" height="62" rx="6"></rect>
          <text x="9" y="14">Power {{ inspectedHeatmapCell.power }}</text>
          <text x="9" y="28">Armor {{ inspectedHeatmapCell.armor }}</text>
          <text x="9" y="42">
            Selected {{ formatDamage(inspectedHeatmapCell.expectedMetric) }}
          </text>
          <text x="9" y="55">
            HP {{ formatDamage(inspectedHeatmapCell.expectedHp) }} | HP+Stun
            {{ formatDamage(inspectedHeatmapCell.expectedTotal) }}
          </text>
        </g>
      </g>
    </svg>
  </div>
</template>
