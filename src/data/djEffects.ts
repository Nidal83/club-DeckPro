import type { DjEffectDefinition, EffectState, SamplerPadState, SoundFxDefinition, SoundFxState } from "../types/dj";

export const djEffects: DjEffectDefinition[] = [
  { id: "echo", label: "Echo", category: "Basic", accent: "amber" },
  { id: "delay", label: "Delay", category: "Basic", accent: "blue" },
  { id: "reverb", label: "Reverb", category: "Basic", accent: "cyan" },
  { id: "flanger", label: "Flanger", category: "Basic", accent: "pink" },
  { id: "phaser", label: "Phaser", category: "Basic", accent: "blue" },
  { id: "chorus", label: "Chorus", category: "Basic", accent: "cyan" },
  { id: "filter-sweep", label: "Filter Sweep", category: "Club", accent: "amber" },
  { id: "white-noise", label: "White Noise", category: "Club", accent: "cyan" },
  { id: "noise-rise", label: "Noise Rise", category: "Club", accent: "pink" },
  { id: "downlifter", label: "Downlifter", category: "Club", accent: "blue" },
  { id: "impact", label: "Impact", category: "Club", accent: "amber" },
  { id: "build-up", label: "Build Up", category: "Club", accent: "pink" },
  { id: "vinyl-brake", label: "Vinyl Brake", category: "Performance", accent: "amber" },
  { id: "vinyl-start", label: "Vinyl Start", category: "Performance", accent: "blue" },
  { id: "backspin", label: "Backspin", category: "Performance", accent: "pink" },
  { id: "stutter", label: "Stutter", category: "Performance", accent: "cyan" },
  { id: "beat-repeat", label: "Beat Repeat", category: "Performance", accent: "blue" },
  { id: "roll", label: "Roll", category: "Performance", accent: "amber" },
  { id: "bass-drop", label: "Bass Drop", category: "EDM", accent: "amber" },
  { id: "reverse-crash", label: "Reverse Crash", category: "EDM", accent: "cyan" },
  { id: "energy-build", label: "Energy Build", category: "EDM", accent: "pink" },
  { id: "laser-sweep", label: "Laser Sweep", category: "EDM", accent: "blue" },
  { id: "festival-drop", label: "Festival Drop", category: "EDM", accent: "amber" }
];

export const soundFxDefinitions: SoundFxDefinition[] = [
  { id: "airhorn", label: "Airhorn" },
  { id: "siren", label: "Siren" },
  { id: "crowd-cheer", label: "Crowd Cheer" },
  { id: "crowd-applause", label: "Crowd Applause" },
  { id: "laser", label: "Laser" },
  { id: "explosion", label: "Explosion" },
  { id: "sweep-up", label: "Sweep Up" },
  { id: "sweep-down", label: "Sweep Down" },
  { id: "reverse-fx", label: "Reverse FX" },
  { id: "vinyl-scratch", label: "Vinyl Scratch" },
  { id: "bass-drop", label: "Bass Drop" },
  { id: "impact-hit", label: "Impact Hit" },
  { id: "festival-horn", label: "Festival Horn" },
  { id: "gun-reload", label: "Gun Reload" },
  { id: "dj-shout", label: "DJ Shout" }
];

export const createInitialEffects = (): Record<string, EffectState> =>
  Object.fromEntries(
    djEffects.map((effect) => [
      effect.id,
      {
        id: effect.id,
        enabled: false,
        dryWet: 35,
        amount: 50
      }
    ])
  );

export const createInitialSoundFx = (): Record<string, SoundFxState> =>
  Object.fromEntries(
    soundFxDefinitions.map((fx) => [
      fx.id,
      {
        id: fx.id,
        volume: 75,
        assignA: false,
        assignB: false,
        assignMaster: true,
        isPlaying: false
      }
    ])
  );

export const createInitialSamplerPads = (): SamplerPadState[] =>
  Array.from({ length: 8 }, (_, index) => ({
    id: index + 1,
    label: `PAD ${index + 1}`,
    fileName: null,
    objectUrl: null,
    volume: 85,
    isPlaying: false
  }));
