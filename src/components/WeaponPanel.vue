<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useDamageTypesStore } from "../stores/damageTypesStore";
import { useScenarioStore } from "../stores/scenarioStore";
import { useWeaponsStore } from "../stores/weaponsStore";
import { weaponTooltip } from "../utils/tooltips";

const damageTypesStore = useDamageTypesStore();
const scenarioStore = useScenarioStore();
const weaponsStore = useWeaponsStore();

const props = defineProps<{
  selectedWeaponIds: string[];
}>();
const emit = defineEmits<{
  "update:selectedWeaponIds": [ids: string[]];
}>();

const { editableWeapons } = storeToRefs(weaponsStore);
const { editableDamageTypes } = storeToRefs(damageTypesStore);
const { scenario } = storeToRefs(scenarioStore);

function toggleWeapon(id: string): void {
  emit(
    "update:selectedWeaponIds",
    props.selectedWeaponIds.includes(id)
      ? props.selectedWeaponIds.filter((selectedId) => selectedId !== id)
      : [...props.selectedWeaponIds, id],
  );
}
</script>

<template>
  <aside class="weapon-panel" aria-label="Weapon selection">
    <div class="panel-section">
      <h2
        class="has-tip"
        tabindex="0"
        data-tip="Select any number of weapons or ammo systems to compare on the graph."
      >
        Weapons & Ammo
      </h2>
      <button
        v-for="weapon in editableWeapons"
        :key="weapon.id"
        class="weapon-toggle"
        :class="{ active: selectedWeaponIds.includes(weapon.id) }"
        type="button"
        :title="weaponTooltip(weapon, scenario, editableDamageTypes)"
        :data-tip="weaponTooltip(weapon, scenario, editableDamageTypes)"
        @click="toggleWeapon(weapon.id)"
      >
        <span class="swatch" :style="{ backgroundColor: weapon.color }"></span>
        <span>
          <strong>{{ weapon.name }}</strong>
        </span>
      </button>
    </div>

    <div class="panel-section formula-panel">
      <h2
        class="has-tip"
        tabindex="0"
        data-tip="A compact description of the model this first version uses."
      >
        Damage Formula
      </h2>
      <pre class="formula-code"><code>power = base + Σ(coeff[0]*stat + coeff[1]*stat² + coeff[2]*stat³)
rolled = power * randomProfile()
ap = ArmorEffectiveness override or damage type default
postArmor = max(0, rolled - armor * ap)
hp = floor(postArmor * hpPercent * componentRoll())
stun = floor(postArmor * stunPercent * componentRoll())</code></pre>
    </div>
  </aside>
</template>
