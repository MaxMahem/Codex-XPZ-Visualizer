import type { ArmorDefinition } from "../types";

export function damageModifiersForArmor(armor: ArmorDefinition | undefined): number[] | undefined {
  return armor && armor.damageModifier.length > 0 ? [...armor.damageModifier] : undefined;
}

export function mergeArmorsById(existingArmors: ArmorDefinition[], importedArmors: ArmorDefinition[]): void {
  for (const armor of importedArmors) {
    const existingIndex = existingArmors.findIndex((candidate) => candidate.id === armor.id);
    if (existingIndex === -1) {
      existingArmors.push(armor);
    } else {
      existingArmors.splice(existingIndex, 1, armor);
    }
  }
}
