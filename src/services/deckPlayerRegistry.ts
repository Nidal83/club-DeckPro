import type { DeckId } from "../types/dj";
import type { YouTubeDeckPlayer } from "./youtubeService";
import { useDjStore } from "../store/djStore";

const players = new Map<DeckId, YouTubeDeckPlayer>();

export const deckPlayerRegistry = {
  register(deckId: DeckId, player: YouTubeDeckPlayer) {
    players.set(deckId, player);
  },

  unregister(deckId: DeckId, player: YouTubeDeckPlayer | null) {
    if (player && players.get(deckId) === player) {
      players.delete(deckId);
    }
  },

  get(deckId: DeckId) {
    return players.get(deckId) ?? null;
  },

  play(deckId: DeckId) {
    players.get(deckId)?.play();
  },

  pause(deckId: DeckId) {
    players.get(deckId)?.pause();
  },

  cue(deckId: DeckId) {
    players.get(deckId)?.seekTo(0);
  },

  seekTo(deckId: DeckId, seconds: number) {
    players.get(deckId)?.seekTo(seconds);
    const deck = useDjStore.getState().decks[deckId];
    const duration = players.get(deckId)?.getDuration() ?? deck.duration;
    useDjStore.getState().setDeckPosition(deckId, Math.min(Math.max(0, seconds), duration || Math.max(0, seconds)), duration);
  },

  seekRelative(deckId: DeckId, deltaSeconds: number) {
    const player = players.get(deckId);
    const deck = useDjStore.getState().decks[deckId];
    const currentTime = player?.getCurrentTime() ?? deck.currentTime;
    const duration = player?.getDuration() ?? deck.duration;
    const nextTime = Math.min(Math.max(0, currentTime + deltaSeconds), duration || Math.max(0, currentTime + deltaSeconds));
    player?.seekTo(nextTime);
    useDjStore.getState().setDeckPosition(deckId, nextTime, duration);
  },

  pitchBend(deckId: DeckId, direction: "backward" | "forward") {
    const player = players.get(deckId);
    if (!player) {
      useDjStore.getState().updateDeck(deckId, { error: "Load a playable video before pitch bending." });
      return;
    }

    const deck = useDjStore.getState().decks[deckId];
    const baseRate = Math.min(2, Math.max(0.25, 1 + deck.pitch / 100));
    const bendRate = direction === "forward" ? baseRate + 0.12 : baseRate - 0.12;
    player.setPlaybackRate(Math.min(2, Math.max(0.25, bendRate)));
    window.setTimeout(() => player.setPlaybackRate(baseRate), 520);
  }
};
