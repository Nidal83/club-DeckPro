// Cache stereo room responses across decks; the envelope reaches -60 dB at the selected decay.
const rooms = new Map<string, AudioBuffer>();
function room(ctx: AudioContext, seconds: number) {
  const key = ctx.sampleRate + "/" + seconds;
  let impulse = rooms.get(key);
  if (!impulse) {
    impulse = ctx.createBuffer(2, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      const onset = Math.floor(ctx.sampleRate * (0.018 + ch * 0.003));
      for (let i = onset; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-6.908 * (i-onset) / data.length);
      }
    }
    if (rooms.size >= 8) rooms.delete(rooms.keys().next().value!);
    rooms.set(key, impulse);
  }
  return impulse;
}

export class HallTransition {
  readonly sweep: BiquadFilterNode;
  private hallSend: GainNode;
  private hall: ConvolverNode;
  private tone: BiquadFilterNode;
  private echoSend: GainNode;
  private delay: DelayNode;
  private nodes: AudioNode[];
  private decay = 0;
  constructor(private ctx: AudioContext, input: AudioNode, output: AudioNode) {
    this.sweep = ctx.createBiquadFilter();
    this.sweep.type = "lowshelf";
    this.sweep.frequency.value = 160;
    this.hallSend = ctx.createGain(); this.hallSend.gain.value = 0;
    this.hall = ctx.createConvolver();
    const bassCut = ctx.createBiquadFilter(); bassCut.type = "highpass"; bassCut.frequency.value = 230;
    this.tone = ctx.createBiquadFilter(); this.tone.type = "lowpass";
    input.connect(this.hallSend).connect(this.hall).connect(bassCut).connect(this.tone).connect(output);
    this.echoSend = ctx.createGain(); this.echoSend.gain.value = 0;
    this.delay = ctx.createDelay(3);
    const feedback = ctx.createGain(); feedback.gain.value = 0.43;
    input.connect(this.echoSend).connect(this.delay).connect(feedback).connect(this.delay);
    this.delay.connect(output);
    this.nodes = [this.sweep,this.hallSend,this.hall,bassCut,this.tone,this.echoSend,this.delay,feedback];
  }
  apply(amount: number, decay: number, toneHz: number, held: boolean, bpm: number, quickEcho=false) {
    const now = this.ctx.currentTime;
    if ((amount || held) && decay !== this.decay) {
      this.hall.buffer = room(this.ctx, decay);
      this.decay = decay;
    }
    const ramp = held ? 0.42 : 0.07;
    this.tone.frequency.setTargetAtTime(toneHz, now, 0.03);
    this.sweep.frequency.setTargetAtTime(held ? 1800 : 160, now, ramp);
    this.sweep.gain.setTargetAtTime(held ? -32 : 0, now, ramp);
    this.hallSend.gain.setTargetAtTime(held ? Math.max(0.70,amount/100) : amount/100, now, ramp);
    if(held||quickEcho) this.delay.delayTime.setTargetAtTime(30/Math.max(30,bpm),now,0.01);
    this.echoSend.gain.setTargetAtTime(held ? 0.44 : quickEcho ? 0.38 : 0, now, held ? ramp : 0.035);
  }
  destroy() { this.nodes.forEach(node=>node.disconnect()); }
}
