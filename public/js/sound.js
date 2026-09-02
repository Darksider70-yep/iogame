/**
 * Web Audio API procedural sound synthesizer for WWII aerial combat.
 */
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.engineGain = null;
    this.engineOsc1 = null;
    this.engineOsc2 = null;
    this.engineFilter = null;
    this.lastShootTime = 0;
    this.lastExplosionTime = 0;
    this.cachedNoiseBuffer = null;
  }

  init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.initNoiseBuffer();
    } catch (e) {
      console.warn('Web Audio API not supported', e);
    }
  }

  initNoiseBuffer() {
    if (!this.ctx || this.cachedNoiseBuffer) return;
    const duration = 1.2;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    this.cachedNoiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = this.cachedNoiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.3));
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled && this.engineGain) {
      this.engineGain.gain.setValueAtTime(0, this.ctx.currentTime);
    }
    return this.enabled;
  }

  startEngineSound() {
    if (!this.enabled || !this.ctx || this.isEngineRunning) return;
    this.init();

    try {
      this.engineOsc1 = this.ctx.createOscillator();
      this.engineOsc2 = this.ctx.createOscillator();
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineGain = this.ctx.createGain();

      this.engineOsc1.type = 'sawtooth';
      this.engineOsc1.frequency.setValueAtTime(65, this.ctx.currentTime);

      this.engineOsc2.type = 'triangle';
      this.engineOsc2.frequency.setValueAtTime(130, this.ctx.currentTime);

      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.setValueAtTime(320, this.ctx.currentTime);

      this.engineGain.gain.setValueAtTime(0.08, this.ctx.currentTime);

      this.engineOsc1.connect(this.engineFilter);
      this.engineOsc2.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);

      this.engineOsc1.start();
      this.engineOsc2.start();
      this.isEngineRunning = true;
    } catch (e) {
      console.warn('Could not start engine sound', e);
    }
  }

  updateEngine(speedRatio, isBoosting, isBraking) {
    if (!this.enabled || !this.ctx || !this.isEngineRunning) return;
    const now = this.ctx.currentTime;
    let baseFreq = 65 + speedRatio * 40;
    if (isBoosting) baseFreq += 35;
    if (isBraking) baseFreq -= 20;

    this.engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.08);
    this.engineOsc2.frequency.setTargetAtTime(baseFreq * 2, now, 0.08);
    this.engineFilter.frequency.setTargetAtTime(isBoosting ? 550 : 320, now, 0.1);
    this.engineGain.gain.setTargetAtTime(isBoosting ? 0.14 : 0.08, now, 0.1);
  }

  stopEngine() {
    if (this.engineOsc1) {
      try {
        this.engineOsc1.stop();
        this.engineOsc2.stop();
      } catch (e) {}
      this.isEngineRunning = false;
    }
  }

  playShoot(isHeavy = false, minInterval = 0.09) {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastShootTime < minInterval) return;
    this.lastShootTime = now;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = isHeavy ? 'square' : 'sawtooth';
    osc.frequency.setValueAtTime(isHeavy ? 180 : 320, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + (isHeavy ? 0.14 : 0.08));

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(isHeavy ? 1200 : 2200, now);

    gain.gain.setValueAtTime(isHeavy ? 0.2 : 0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isHeavy ? 0.14 : 0.08));

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + (isHeavy ? 0.14 : 0.08));
  }

  playExplosion(isLarge = false) {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastExplosionTime < 0.06) return;
    this.lastExplosionTime = now;

    this.initNoiseBuffer();
    if (!this.cachedNoiseBuffer) return;

    const duration = isLarge ? 1.0 : 0.6;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.cachedNoiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(isLarge ? 300 : 500, now);
    filter.frequency.exponentialRampToValueAtTime(60, now + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(isLarge ? 0.35 : 0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(now);
    noise.stop(now + duration);
  }

  playRocketLaunch() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.3);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  }

  playPickup() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.setValueAtTime(660, now + 0.08);
    osc.frequency.setValueAtTime(880, now + 0.16);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.26);
  }

  playMedal() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + idx * 0.09;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.25);
    });
  }
}

window.soundEngine = new SoundEngine();
