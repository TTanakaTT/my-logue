import type { Scaling } from '../entities/battleState';

export const scaling: Scaling = {
  enemyHP: (base, floorIndex) => {
    const mult = 1 + Math.floor(floorIndex / 5) * 0.4;
    return Math.round(base * mult);
  },
  enemyAttack: (base, floorIndex) => base + floorIndex
};
