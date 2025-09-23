<script lang="ts">
  import { effects, floatings } from '$lib/presentation/utils/effectBus';
  export let panelKey: string;
  $: localEffects = $effects.filter((e) => e.panelKey === panelKey);
  $: localFloatings = $floatings.filter((f) => f.panelKey === panelKey);
</script>

<div class="effect-layer pointer-events-none">
  {#each localEffects as e (e.id)}
    <div class={`fx fx-${e.kind}`}></div>
  {/each}
  {#each localFloatings as f (f.id)}
    <div class={`float ${f.kind}`}>
      {f.kind === 'damage' ? `-${f.value}` : `+${f.value}`}
    </div>
  {/each}
</div>

<style>
  .effect-layer {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 5;
  }
  .fx {
    position: absolute;
    width: 72px;
    height: 72px;
    opacity: 0.9;
    background-size: contain;
    background-repeat: no-repeat;
    background-position: center;
  }
  /* 簡易アイコン（SVG data URL） */
  .fx-guard {
    animation: pop 0.6s ease-out forwards;
    background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><path d="M48 8l28 10v22c0 18-12 30-28 38-16-8-28-20-28-38V18l28-10z" fill="%23a7f3d0" stroke="%2322c55e" stroke-width="4"/></svg>');
  }
  .fx-strike_attacker {
    animation: punch 0.35s ease-out forwards;
    background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><circle cx="36" cy="48" r="16" fill="%23fcd34d" stroke="%23f59e0b" stroke-width="4"/><rect x="44" y="42" width="32" height="12" rx="6" fill="%23f59e0b"/></svg>');
  }
  .fx-strike_hit {
    animation: burst 0.5s ease-out forwards;
    background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><g fill="%23fca5a5" stroke="%23ef4444" stroke-width="3"><polygon points="48,8 56,36 88,36 60,52 68,84 48,64 28,84 36,52 8,36 40,36"/></g></svg>');
  }
  .fx-curse_cast {
    animation: fadeup 0.45s ease-out forwards;
    background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><defs><radialGradient id="g" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="%23c084fc"/><stop offset="100%" stop-color="%237a3faf"/></radialGradient></defs><circle cx="48" cy="60" r="18" fill="url(%23g)"/></svg>');
  }
  .fx-poison_tick {
    animation: wiggle 0.5s ease-out forwards;
    background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><path d="M32 24c8 0 8 8 16 8s8-8 16-8 8 8 8 16-8 16-16 24S56 80 48 80 40 72 32 64 16 48 16 40s8-16 16-16z" fill="%23a78bfa" stroke="%236b21a8" stroke-width="3"/></svg>');
  }

  .float {
    position: absolute;
    right: 8px;
    top: 8px;
    font-weight: 800;
    padding: 2px 6px;
    border-radius: 6px;
    transform: translateY(0);
    animation: floatUp 1.5s ease-out forwards;
  }
  .float.damage {
    background: rgba(239, 68, 68, 0.9);
    color: #fff;
  }
  .float.heal {
    background: rgba(16, 185, 129, 0.9);
    color: #022;
  }

  @keyframes floatUp {
    0% {
      opacity: 0;
      transform: translateY(8px) scale(0.9);
    }
    20% {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
    100% {
      opacity: 0;
      transform: translateY(-24px) scale(0.95);
    }
  }
  @keyframes pop {
    0% {
      transform: scale(0.6);
      opacity: 0;
    }
    60% {
      transform: scale(1.05);
      opacity: 1;
    }
    100% {
      transform: scale(1);
      opacity: 0;
    }
  }
  @keyframes punch {
    0% {
      transform: translateX(-30%) scale(0.7);
      opacity: 0;
    }
    70% {
      transform: translateX(0) scale(1.05);
      opacity: 1;
    }
    100% {
      transform: translateX(10%) scale(0.98);
      opacity: 0;
    }
  }
  @keyframes burst {
    0% {
      transform: scale(0.6) rotate(-10deg);
      opacity: 0;
    }
    60% {
      transform: scale(1.1) rotate(5deg);
      opacity: 1;
    }
    100% {
      transform: scale(0.9) rotate(0deg);
      opacity: 0;
    }
  }
  @keyframes fadeup {
    0% {
      transform: translateY(12px) scale(0.8);
      opacity: 0;
    }
    100% {
      transform: translateY(0) scale(1);
      opacity: 1;
    }
  }
  @keyframes wiggle {
    0% {
      transform: rotate(0deg);
    }
    25% {
      transform: rotate(6deg);
    }
    50% {
      transform: rotate(-6deg);
    }
    75% {
      transform: rotate(4deg);
    }
    100% {
      transform: rotate(0deg);
      opacity: 0;
    }
  }
</style>
