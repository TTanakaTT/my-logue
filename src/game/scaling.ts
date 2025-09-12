import type { Scaling } from './types';

export const scaling: Scaling = {
  enemyHP: (base, floorIndex) => {
    const mult = 1 + Math.floor(floorIndex / 5) * 0.4; // 0,5階層目で+40%, 10で+80%(ただし9まで)
    return Math.round(base * mult);
  },
  enemyAttack: (base, floorIndex) => base + floorIndex
};
