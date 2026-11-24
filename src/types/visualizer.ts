import type { DeckId, DeckStatus } from "./dj";

export interface VisualizerDeckSnapshot {
  id: DeckId;
  title: string;
  bpm: number;
  isPlaying: boolean;
  status: DeckStatus;
  volume: number;
  currentTime: number;
  duration: number;
}

export interface VisualizerSnapshot {
  updatedAt: number;
  visibleDeckIds: DeckId[];
  decks: Record<DeckId, VisualizerDeckSnapshot>;
  mixer: {
    crossfader: number;
    vuA: number;
    vuB: number;
    masterMeter: number;
  };
}
