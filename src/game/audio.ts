import type { Game } from './sim';
export const STATIONS = ['Rádio desligado', 'Vila FM', 'Baile 021', 'Estrada AM'];
export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private engine: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private beat = 0;
  private shot = 0;
  private crash = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  constructor(private game: Game) {}
  unlock = () => {
    if (!this.ctx) {
      const c = new AudioContext(); this.ctx = c;
      const limiter = c.createDynamicsCompressor(); limiter.threshold.value = -12; limiter.ratio.value = 12; limiter.connect(c.destination);
      this.master = c.createGain(); this.master.gain.value = 0.3; this.master.connect(limiter);
      this.engineGain = c.createGain(); this.engineGain.gain.value = 0; this.engineGain.connect(this.master);
      this.engine = c.createOscillator(); this.engine.type = 'sawtooth'; this.engine.connect(this.engineGain); this.engine.start();
      this.timer = setInterval(() => this.tick(), 125);
    }
    void this.ctx.resume();
  };
  private tone(frequency: number, length: number, gain: number, type: OscillatorType = 'sine') {
    const c = this.ctx; if (!c || !this.master) return;
    const osc = c.createOscillator(), amp = c.createGain(); osc.type = type; osc.frequency.value = frequency;
    amp.gain.setValueAtTime(gain, c.currentTime); amp.gain.exponentialRampToValueAtTime(0.001, c.currentTime + length);
    osc.connect(amp); amp.connect(this.master); osc.start(); osc.stop(c.currentTime + length);
    osc.onended = () => { osc.disconnect(); amp.disconnect(); };
  }
  private tick() {
    const c = this.ctx; if (!c || document.hidden) return;
    const g = this.game;
    this.engine?.frequency.setTargetAtTime(38 + Math.abs(g.player.v) * 4, c.currentTime, 0.08);
    this.engineGain?.gain.setTargetAtTime(g.vehicle ? 0.07 : 0, c.currentTime, 0.1);
    if (g.shots !== this.shot) { this.shot = g.shots; this.tone(90, 0.1, 0.35, 'sawtooth'); }
    if (g.crashes !== this.crash) { this.crash = g.crashes; this.tone(55, 0.2, 0.3, 'triangle'); }
    if (g.horn) { g.horn = false; this.tone(350, 0.3, 0.2, 'square'); this.tone(440, 0.3, 0.12); }
    if (g.radio && g.vehicle) {
      const b = this.beat++ % 16;
      if (b % (g.radio === 3 ? 4 : 2) === 0) this.tone(g.radio === 2 ? 65 : 90, 0.12, 0.15);
      if (b % 4 === 2) this.tone(1800, 0.04, 0.035, 'square');
      const notes = g.radio === 1 ? [220, 261.6, 329.6, 293.7] : g.radio === 2 ? [110, 110, 130.8, 146.8] : [196, 246.9, 293.7, 246.9];
      const note = notes[Math.floor(b / 4)]; if (note && b % 2 === 0) this.tone(note, 0.2, 0.06, g.radio === 3 ? 'triangle' : 'sine');
    }
  }
  dispose() { if (this.timer) clearInterval(this.timer); this.engine?.stop(); void this.ctx?.close(); }
}
