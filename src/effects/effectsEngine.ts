import * as Tone from "tone";
import type { EffectId, EffectState } from "../types/dj";
import { audioEngine } from "../audio/audioEngine";

class EffectsEngine {
  private effectPreviewSynth: Tone.PolySynth | null = null;

  async initialize() {
    await audioEngine.initialize();
    if (!this.effectPreviewSynth) {
      this.effectPreviewSynth = new Tone.PolySynth(Tone.Synth).toDestination();
    }
  }

  async preview(effectId: EffectId, state: EffectState) {
    await this.initialize();
    const velocity = Math.max(0.08, state.amount / 100);

    if (effectId.includes("noise") || effectId.includes("sweep") || effectId.includes("crash")) {
      await audioEngine.previewTone(effectId, state.dryWet);
      return;
    }

    if (effectId.includes("bass") || effectId.includes("impact")) {
      await audioEngine.previewTone("bass-drop", state.amount);
      return;
    }

    this.effectPreviewSynth?.triggerAttackRelease(["C4", "G4"], "16n", undefined, velocity);
  }
}

export const effectsEngine = new EffectsEngine();
