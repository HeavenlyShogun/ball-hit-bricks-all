// Web Audio Synthesizer for 111% TAN series - zero external audio dependencies

class SoundManager {
  private ctx: AudioContext | null = null;
  private _enabled: boolean = true;

  constructor() {
    try {
      const saved = localStorage.getItem('tan_audio_enabled');
      if (saved !== null) {
        this._enabled = saved === 'true';
      }
    } catch {
      // Ignore storage access errors in strict sandboxes
    }
  }

  get enabled(): boolean {
    return this._enabled;
  }

  set enabled(val: boolean) {
    this._enabled = val;
    try {
      localStorage.setItem('tan_audio_enabled', String(val));
    } catch {
      // Ignore storage write errors
    }
    if (val) {
      this.powerup();
    }
  }

  public init() {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public tone(
    freq: number,
    type: OscillatorType = 'sine',
    duration: number = 0.08,
    vol: number = 0.08,
    slideTo: number | null = null
  ) {
    if (!this._enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(20, freq), now);
      if (slideTo) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + duration);
      }

      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + duration);
    } catch {
      // AudioContext safety ignore
    }
  }

  public shoot() {
    this.tone(520, 'sine', 0.06, 0.05, 260);
  }

  public bounce() {
    this.tone(280, 'sine', 0.04, 0.03, 340);
  }

  public hit(pitchOffset: number = 0) {
    const base = 320 + (pitchOffset % 480);
    this.tone(base, 'triangle', 0.06, 0.07, base * 0.6);
  }

  public powerup() {
    this.tone(440, 'sine', 0.08, 0.07, 880);
    setTimeout(() => {
      this.tone(880, 'sine', 0.12, 0.08, 1320);
    }, 70);
  }

  public laser() {
    this.tone(960, 'sawtooth', 0.09, 0.07, 240);
  }

  public coreHit(combo: number = 1) {
    const freq = Math.min(1400, 520 + combo * 65);
    this.tone(freq, 'triangle', 0.11, 0.09, freq * 1.6);
  }

  public gameOver() {
    this.tone(340, 'sawtooth', 0.15, 0.09, 220);
    setTimeout(() => {
      this.tone(220, 'sawtooth', 0.25, 0.09, 90);
    }, 140);
  }
}

export const Sound = new SoundManager();
