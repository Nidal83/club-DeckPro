import type { BpmAnalysis } from "../types/dj";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const stableSeed = (value: string) =>
  value.split("").reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 11), 0);

export const analyzeYouTubeTempo = (videoId: string, title = ""): BpmAnalysis => {
  const seed = stableSeed(`${videoId}:${title}`);
  const bpm = clamp(104 + (seed % 42), 92, 148);
  const secondsPerBeat = 60 / bpm;
  const beatGrid = Array.from({ length: 192 }, (_, index) => Number((index * secondsPerBeat).toFixed(3)));
  const downbeats = beatGrid.filter((_, index) => index % 4 === 0);

  return {
    bpm,
    beatGrid,
    downbeats,
    tempoLabel: bpm >= 128 ? "Peak" : bpm >= 118 ? "Club" : "Warm"
  };
};

export const getPitchForBpmSync = (sourceBpm: number, targetBpm: number) => {
  if (!sourceBpm || !targetBpm) {
    return 0;
  }

  return Number((((targetBpm - sourceBpm) / sourceBpm) * 100).toFixed(2));
};
