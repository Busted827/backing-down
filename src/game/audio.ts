export class AudioBus {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private engineGain: GainNode | null = null;
  private engine: OscillatorNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private noise: AudioBuffer | null = null;
  muted = false;

  unlock() {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    if (!this.ctx) {
      const ctx = new AC();
      this.ctx = ctx;
      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : 0.8;
      master.connect(ctx.destination);
      this.master = master;
      const engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 240;
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = 46;
      osc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(master);
      osc.start();
      this.engine = osc;
      this.engineGain = engineGain;
      this.filter = filter;
      const dur = 0.25;
      const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.noise = buffer;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (!this.ctx || !this.master) return;
    this.master.gain.setTargetAtTime(muted ? 0 : 0.8, this.ctx.currentTime, 0.03);
  }

  engineSpeed(speed: number) {
    if (!this.ctx || !this.engine || !this.engineGain || !this.filter || this.muted) return;
    const s = Math.abs(speed);
    const vol = Math.min(0.18, 0.02 + s * 0.012);
    this.engineGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.05);
    this.engine.frequency.setTargetAtTime(42 + s * 7.5, this.ctx.currentTime, 0.05);
    this.filter.frequency.setTargetAtTime(180 + s * 28, this.ctx.currentTime, 0.05);
  }

  private burst(freq: number, dur: number, gain: number, type: BiquadFilterType) {
    if (!this.ctx || !this.master || !this.noise || this.muted) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start();
    src.stop(this.ctx.currentTime + dur + 0.02);
  }

  hit() {
    this.burst(180 + Math.random() * 80, 0.18, 0.35, "lowpass");
  }

  splash() {
    this.burst(700, 0.45, 0.28, "highpass");
    this.burst(140, 0.4, 0.4, "lowpass");
  }

  resume() {
    if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
  }

  destroy() {
    this.engine?.stop();
    void this.ctx?.close();
    this.ctx = null;
  }
}
