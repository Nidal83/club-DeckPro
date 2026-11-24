import * as Tone from "tone";
import type { DeckId, FadeCurve } from "../types/dj";

export const calculateCrossfadeGain = (deckId: DeckId, crossfader: number, curve: FadeCurve) => {
  if (deckId !== "A" && deckId !== "B") {
    return 1;
  }

  const normalized = Math.min(100, Math.max(0, crossfader)) / 100;
  const deckPosition = deckId === "A" ? 1 - normalized : normalized;

  if (curve === "smooth") {
    return Math.sin(deckPosition * (Math.PI / 2));
  }

  if (curve === "sharp") {
    return deckPosition < 0.08 ? 0 : Math.pow(deckPosition, 0.35);
  }

  if (curve === "scratch") {
    return deckPosition < 0.18 ? 0 : deckPosition > 0.28 ? 1 : (deckPosition - 0.18) / 0.1;
  }

  return deckPosition;
};

class ProfessionalAudioEngine {
  private initialized = false;
  private samplerBuffers = new Map<number, AudioBuffer>();
  private sampleSources = new Map<number, AudioBufferSourceNode>();
  private masterGain: GainNode | null = null;
  private outputBus: GainNode | null = null;
  private channelGains: Partial<Record<DeckId, GainNode | null>> = { A: null, B: null };
  private recordingDestination: MediaStreamAudioDestinationNode | null = null;
  private masterLevel = 1;
  private channelLevels: Partial<Record<DeckId,number>> = {};
  private voices = new Map<string,()=>void>();

  async initialize() {
    if (this.initialized) {
      return;
    }

    await Tone.start();
    if (this.initialized) return;
    const context = Tone.getContext().rawContext as AudioContext;
    this.masterGain = context.createGain();
    this.masterGain.gain.value = this.masterLevel;
    this.channelGains.A = context.createGain();
    this.channelGains.B = context.createGain();
    this.channelGains.C = context.createGain();
    this.channelGains.D = context.createGain();
    this.channelGains.E = context.createGain();
    this.recordingDestination =
      "createMediaStreamDestination" in context ? context.createMediaStreamDestination() : null;

    for(const [id,gain] of Object.entries(this.channelGains)) {
      if(gain) { gain.gain.value=this.channelLevels[id as DeckId]??1; gain.connect(this.masterGain); }
    }
    this.outputBus=context.createGain();
    this.masterGain.connect(this.outputBus);
    this.outputBus.connect(context.destination);
    if (this.recordingDestination) {
      this.outputBus.connect(this.recordingDestination);
    }
    this.initialized = true;
  }

  setMasterVolume(value: number) {
    this.masterLevel = value/100;
    if (this.masterGain) {
      this.masterGain.gain.value = value / 100;
    }
  }

  setChannelVolume(deckId: DeckId, value: number) {
    this.channelLevels[deckId]=value/100;
    const gain = this.channelGains[deckId];
    if (gain) {
      gain.gain.value = value / 100;
    }
  }

  getRecordingStream() {
    return this.recordingDestination?.stream ?? null;
  }

  context() { return Tone.getContext().rawContext as AudioContext; }
  deckOutput() {
    if(!this.outputBus) throw new Error("Audio output is not initialized.");
    return this.outputBus;
  }

  async loadSamplerPad(padId: number, file: File) {
    await this.initialize();
    const context = Tone.getContext().rawContext as AudioContext;
    const buffer = await file.arrayBuffer();
    const decoded = await context.decodeAudioData(buffer.slice(0));
    this.samplerBuffers.set(padId, decoded);
  }

  triggerSamplerPad(padId: number, volume: number) {
    const buffer = this.samplerBuffers.get(padId);
    const context = Tone.getContext().rawContext as AudioContext;

    if (!buffer || !this.masterGain) {
      void this.previewTone("impact", volume);
      return;
    }

    this.sampleSources.get(padId)?.stop();
    const source = context.createBufferSource();
    const gain = context.createGain();
    gain.gain.value = volume / 100;
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(this.masterGain);
    source.start();
    this.sampleSources.set(padId, source);
  }

  stopSamplerPad(padId: number) {
    this.sampleSources.get(padId)?.stop();
    this.sampleSources.delete(padId);
  }

  stopTone(key:string) { this.voices.get(key)?.(); }
  async previewTone(kind: string, volume = 70, routes: ("master"|DeckId)[] = ["master"], key=kind, amount=50) {
    await this.initialize();
    this.stopTone(key);
    const gate=this.context().createGain();
    gate.gain.value=volume/100;
    for(const route of routes) {
      const output=route==="master"?this.masterGain:this.channelGains[route];
      if(output)gate.connect(output);
    }
    const voices: {dispose():unknown}[]=[];
    const timers:number[]=[];
    const stop=()=>{
      gate.disconnect(); timers.forEach(clearTimeout); voices.forEach(v=>v.dispose());
      this.voices.delete(key);
    };
    this.voices.set(key,stop);
    timers.push(window.setTimeout(stop,1400));
    const velocity = 0.15+amount*0.0085;

    if (kind.includes("scratch")) {
      const noise = new Tone.NoiseSynth({
        noise: { type: "pink" },
        envelope: { attack: 0.005, decay: 0.06, sustain: 0.15, release: 0.08 }
      }).connect(gate);
      const synth = new Tone.Synth({
        oscillator: { type: "square" },
        envelope: { attack: 0.005, decay: 0.05, sustain: 0.1, release: 0.06 }
      }).connect(gate);
      voices.push(noise,synth);
      noise.triggerAttackRelease("16n", undefined, velocity * 0.85);
      synth.triggerAttackRelease("G3", "32n", undefined, velocity);
      timers.push(window.setTimeout(() => synth.triggerAttackRelease("C4", "32n", undefined, velocity), 70));
      return;
    }

    if (kind.includes("backspin") || kind.includes("reverse")) {
      const synth = new Tone.Synth({
        oscillator: { type: "sawtooth" },
        envelope: { attack: 0.01, decay: 0.18, sustain: 0.2, release: 0.25 }
      }).connect(gate);
      voices.push(synth);
      synth.triggerAttackRelease("A3", "32n", undefined, velocity);
      timers.push(window.setTimeout(() => synth.triggerAttackRelease("E3", "32n", undefined, velocity), 90));
      timers.push(window.setTimeout(() => synth.triggerAttackRelease("B2", "16n", undefined, velocity), 180));
      return;
    }

    if (kind.includes("bass") || kind.includes("drop")) {
      const synth = new Tone.MembraneSynth().connect(gate); voices.push(synth);
      synth.triggerAttackRelease("C1", "8n", undefined, velocity);
      return;
    }

    if (kind.includes("noise") || kind.includes("sweep") || kind.includes("laser")) {
      const noise = new Tone.NoiseSynth({
        noise: { type: "white" },
        envelope: { attack: 0.02, decay: 0.35, sustain: 0.1, release: 0.45 }
      }).connect(gate);
      voices.push(noise);
      noise.triggerAttackRelease("8n", undefined, velocity);
      return;
    }

    const synth = new Tone.Synth({
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.01, decay: 0.12, sustain: 0.2, release: 0.18 }
    }).connect(gate);
    voices.push(synth);
    synth.triggerAttackRelease(kind.includes("horn") ? "A4" : "E3", "16n", undefined, velocity);
  }
}

export const audioEngine = new ProfessionalAudioEngine();
