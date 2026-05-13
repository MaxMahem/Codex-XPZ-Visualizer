<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useAppStore } from "../stores/appStore";
import { useWeaponsStore } from "../stores/weaponsStore";

const appStore = useAppStore();
const weaponsStore = useWeaponsStore();
const { editableWeapons, selectedIds } = storeToRefs(weaponsStore);
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
        :class="{ active: selectedIds.includes(weapon.id) }"
        type="button"
        :title="appStore.weaponTooltip(weapon)"
        :data-tip="appStore.weaponTooltip(weapon)"
        @click="weaponsStore.toggleWeapon(weapon.id)"
      >
        <span class="swatch" :style="{ backgroundColor: weapon.color }"></span>
        <span>
          <strong>{{ weapon.name }}</strong>
          <small>{{ weapon.category }}</small>
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
typeArmorEffectiveness = fixedArmor% or (100% + power%)
postArmor = max(0, rolled - armor * typeArmorEffectiveness * (1 - armorPenetration))
hp = floor(postArmor * hpPercent * componentRoll())
stun = floor(postArmor * stunPercent * componentRoll())</code></pre>
    </div>
  </aside>
</template>
