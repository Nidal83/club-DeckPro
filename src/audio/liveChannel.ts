import type { DeckId } from "../types/dj";
import { HallTransition } from "./hallTransition";

export const tapEffects = ["Echo","Delay","Reverb","Flanger","Chorus","Phaser"] as const;
export const holdEffects = ["Beat Roll","Stutter"] as const;
export type LiveEffect = typeof tapEffects[number] | typeof holdEffects[number];
export const liveEffects: LiveEffect[] = [...tapEffects,...holdEffects];
export const channels = new Map<DeckId, LiveChannel>();

export class LiveChannel {
  readonly ambience: HallTransition;
  private nodes: AudioNode[] = [];
  private monitor = new Audio();
  private cueBus: MediaStreamAudioDestinationNode;
  private out: GainNode;
  private filter: BiquadFilterNode;
  private bands: BiquadFilterNode[];
  private echo: DelayNode;
  private feedback: GainNode;
  private send: GainNode;
  private repeat: DelayNode;
  private write: GainNode;
  private recycle: GainNode;
  private dry: GainNode;
  private wet: GainNode;
  private meter: AnalyserNode;
  private samples = new Float32Array(256);
  private effectInput: GainNode;
  private effectOutput: GainNode;
  private insert: AudioNode[] = [];
  private oscillator?: OscillatorNode;
  private impulse?: AudioBuffer;
  private insertName: LiveEffect | null = null;
  private cueSequence = 0;
  constructor(private ctx: AudioContext, audio: HTMLAudioElement, output: AudioNode) {
    const gain = (value: number) => { const g = ctx.createGain(); g.gain.value = value; return g; };
    const source = ctx.createMediaElementSource(audio);
    this.bands = ([["lowshelf", 220], ["peaking", 1200], ["highshelf", 4500]] as const).map(([type, hz]) => {
      const node = ctx.createBiquadFilter(); node.type = type; node.frequency.value = hz; return node;
    });
    this.filter = ctx.createBiquadFilter();
    this.filter.type = "allpass";
    this.filter.Q.value = 0.7;
    source.connect(this.bands[0]).connect(this.bands[1]).connect(this.bands[2]).connect(this.filter);
    this.out = gain(0);
    this.dry = gain(1); this.wet = gain(0); this.write = gain(1); this.recycle = gain(0);
    this.repeat = ctx.createDelay(4);
    // Continuously prime one slice. Holding freezes that slice while the original transport advances.
    this.filter.connect(this.write).connect(this.repeat).connect(this.recycle).connect(this.repeat);
    const mix = gain(1);
    this.filter.connect(this.dry).connect(mix);
    this.repeat.connect(this.wet).connect(mix);
    this.echo = ctx.createDelay(4); this.send = gain(0);
    const feedback = gain(0.45); this.feedback=feedback;
    const bus = gain(1);
    this.ambience = new HallTransition(ctx,mix,bus);
    this.bands[2].disconnect(this.filter);
    this.bands[2].connect(this.ambience.sweep).connect(this.filter);
    this.effectInput=mix; this.effectOutput=gain(0.45);
    this.effectOutput.connect(bus);
    mix.connect(bus);
    mix.connect(this.send).connect(this.echo).connect(feedback).connect(this.echo);
    this.echo.connect(bus);
    this.cueBus = ctx.createMediaStreamDestination();
    bus.connect(this.cueBus);
    this.monitor.srcObject = this.cueBus.stream;
    this.meter = ctx.createAnalyser(); this.meter.fftSize = 256;
    bus.connect(this.out).connect(this.meter).connect(output);
    this.nodes = [source, ...this.bands, this.filter, this.out, this.dry, this.wet, this.write, this.recycle,
      this.repeat, mix, this.echo, this.send, feedback, bus, this.meter, this.cueBus,this.effectOutput];
  }
  private smooth(param: AudioParam, value: number) { param.setTargetAtTime(value, this.ctx.currentTime, 0.004); }
  volume(percent: number) { this.smooth(this.out.gain, percent / 100); }
  eq(low: number, mid: number, high: number) {
    [low, mid, high].forEach((v, i) => this.smooth(this.bands[i].gain, v));
  }
  tone(value: number) {
    this.filter.type = value < 0 ? "lowpass" : value > 0 ? "highpass" : "allpass";
    const hz = value < 0 ? 20000 * Math.pow(0.003, -value / 100) : 30 * Math.pow(430, value / 100);
    this.smooth(this.filter.frequency, Math.min(hz, this.ctx.sampleRate / 2));
  }
  private setInsert(name: LiveEffect | null, amount: number) {
    if(this.insertName===name && this.insert.length) {
      if(this.oscillator) this.smooth(this.oscillator.frequency,0.15+amount*1.6);
      return;
    }
    if(this.insert.length) this.effectInput.disconnect(this.insert[0]);
    this.oscillator?.stop(); this.oscillator?.disconnect(); this.oscillator=undefined;
    this.insert.forEach(n=>n.disconnect()); this.insert=[]; this.insertName=name;
    if(!name)return;
    if(name==="Reverb") {
      const reverb=this.ctx.createConvolver();
      if(!this.impulse) {
        this.impulse=this.ctx.createBuffer(2,Math.round(1.5*this.ctx.sampleRate),this.ctx.sampleRate);
        for(let ch=0;ch<2;ch++) {
          const data=this.impulse.getChannelData(ch);
          for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/data.length,3);
        }
      }
      reverb.buffer=this.impulse; this.insert=[reverb];
      this.effectInput.connect(reverb).connect(this.effectOutput);
    } else {
      const lfo=this.ctx.createOscillator(), depth=this.ctx.createGain();
      lfo.frequency.value=0.15+amount*1.6; this.oscillator=lfo;
      if(name==="Phaser") {
        const stage=this.ctx.createBiquadFilter(); stage.type="allpass"; stage.frequency.value=950;
        depth.gain.value=750; lfo.connect(depth).connect(stage.frequency);
        this.effectInput.connect(stage).connect(this.effectOutput); this.insert=[stage,depth];
      } else {
        const delay=this.ctx.createDelay(0.1);
        delay.delayTime.value=name==="Chorus"?0.022:0.004;
        depth.gain.value=name==="Chorus"?0.006:0.003;
        lfo.connect(depth).connect(delay.delayTime); this.effectInput.connect(delay).connect(this.effectOutput);
        this.insert=[delay,depth];
      }
      lfo.start();
    }
  }
  effects(bpm: number, echo: LiveEffect | null, roll: LiveEffect | null, wet=0.38, amount=0.5) {
    const beat = 60 / Math.max(30, bpm);
    // Leave the delay and feedback connected so the previous echo can ring out.
    const timed=echo==="Delay"||echo==="Echo";
    if (timed) this.smooth(this.echo.delayTime, beat * (echo === "Delay" ? 0.75 : 0.5));
    this.smooth(this.send.gain, timed ? wet : 0);
    if(timed)this.smooth(this.feedback.gain,0.12+0.66*amount);
    this.setInsert(timed?null:echo,amount);
    this.smooth(this.effectOutput.gain,wet);
    this.smooth(this.repeat.delayTime, beat * (roll === "Stutter" ? 0.125 : 0.25));
    this.smooth(this.write.gain, roll ? 0 : 1); this.smooth(this.recycle.gain, roll ? 1 : 0);
    this.smooth(this.dry.gain, roll ? 0 : 1); this.smooth(this.wet.gain, roll ? 1 : 0);
  }
  async cue(device: string, enabled: boolean) {
    const sequence = ++this.cueSequence;
    if (!enabled || !device) { this.monitor.pause(); return; }
    await this.monitor.setSinkId(device);
    if (sequence === this.cueSequence) await this.monitor.play();
  }
  level() {
    this.meter.getFloatTimeDomainData(this.samples);
    return Math.min(100, 100 * Math.sqrt(this.samples.reduce((v, n) => v + n*n, 0) / this.samples.length) * 2);
  }
  destroy() {
    this.ambience.destroy();
    this.setInsert(null,0);
    this.cueSequence++;
    this.monitor.pause(); this.monitor.srcObject = null;
    this.cueBus.stream.getTracks().forEach(track => track.stop());
    this.nodes.forEach(node => node.disconnect());
  }
}
