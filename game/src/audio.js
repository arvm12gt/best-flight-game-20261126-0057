// Procedural sound, no assets: a low engine hum that follows the throttle, wind that
// follows speed, a two-note chime for each ring, a thud for a landing and a burst for a
// crash. Created lazily on the first user gesture; silent in screenshot staging.
export function createAudio() {
  let ctx = null;
  let engine = null;
  let engineGain = null;
  let wind = null;
  let windGain = null;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      engine = ctx.createOscillator();
      engine.type = 'sawtooth';
      engine.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engine.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engine.start();
      const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      wind = ctx.createBufferSource();
      wind.buffer = buffer;
      wind.loop = true;
      const windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 500;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      wind.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(ctx.destination);
      wind.start();
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, at, dur, vol) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, at + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  }

  return {
    unlock() {
      ensure();
      if (ctx && ctx.state === 'suspended') ctx.resume();
    },
    /** Called every frame while flying: hum and wind follow throttle and speed. */
    ambience(throttle, speed) {
      if (!ctx) return;
      const t = ctx.currentTime;
      engine.frequency.setTargetAtTime(48 + throttle * 55 + speed * 0.25, t, 0.1);
      engineGain.gain.setTargetAtTime(0.028 + throttle * 0.03, t, 0.1);
      windGain.gain.setTargetAtTime(Math.min(0.05, speed * 0.0006), t, 0.1);
    },
    ring() {
      if (!ensure()) return;
      const t = ctx.currentTime;
      tone(880, t, 0.35, 0.16);
      tone(1318, t + 0.09, 0.45, 0.14);
    },
    land() {
      if (!ensure()) return;
      tone(196, ctx.currentTime, 0.3, 0.2);
      tone(98, ctx.currentTime + 0.05, 0.4, 0.18);
    },
    crash() {
      if (!ensure()) return;
      const t = ctx.currentTime;
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const g = ctx.createGain();
      g.gain.value = 0.35;
      src.connect(g);
      g.connect(ctx.destination);
      src.start(t);
      tone(70, t, 0.5, 0.25);
    },
  };
}
