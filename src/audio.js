// Web Audio graph (spec §4.2–§4.3): music with truck ducking, the truck clip, the pour synth, one-shots and voices.
// Browser only. Nothing is created until start() runs inside a user gesture.
import { T } from './tuning.js';
import { makeRng } from './rng.js';
import { resonanceHz, truckMix, musicLevel, babblePlan, charTimes } from './audio-math.js';

const AUDIO_KEYS = ['MUSIC_GAIN', 'MUSIC_DUCK', 'DUCK_FADE_IN', 'DUCK_FADE_OUT', 'TRUCK_GAIN', 'RES_F_EMPTY', 'RES_MIN_AIR',
  'BLIP_MIN', 'BLIP_MAX', 'VOICE_JITTER', 'WORD_PAUSE'];
const SMOOTH = .03;      // seconds; how fast pour layers follow the sim
const CHIRP_RATE = 28;   // bubble chirps per second at full flow straight into water

export function createAudio({ musicUrl = 'audio/musica.mp3', truckUrl = 'audio/camion.mp3', store } = {}) {
  const params = Object.fromEntries(AUDIO_KEYS.map(k => [k, T[k]]));
  const rng = makeRng(Date.now() >>> 0);
  let ctx = null, master, musicGain, music, truckBuffer = null, truck = null, ducked = false;
  let pour = null, noise = null, chirpAcc = 0;
  let muted = !!store?.get('muted', false);

  const api = {
    params,
    get muted() { return muted; },
    get ready() { return !!ctx; },

    async start() {
      if (ctx) { if (ctx.state !== 'running') await ctx.resume(); return; }
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 1;
      master.connect(ctx.destination);

      music = new Audio(musicUrl);
      music.loop = true;
      music.preload = 'auto';
      musicGain = ctx.createGain();
      musicGain.gain.value = params.MUSIC_GAIN;
      ctx.createMediaElementSource(music).connect(musicGain).connect(master);
      music.play().catch(() => {});

      noise = makeNoise(ctx, 2);
      pour = buildPour();
      fetch(truckUrl).then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b)).then(b => { truckBuffer = b; }).catch(() => {});
      if (ctx.state !== 'running') await ctx.resume();
    },

    update(state, dt) {
      if (!ctx) return;
      const now = ctx.currentTime;
      const pouring = state.phase === 'pour' && state.flow > 0;
      const flow = pouring ? state.flow / T.FLOW_MAX : 0;
      const fill = Math.min(1, state.turn?.fill || 0);
      const top = state.topFrac || 0;
      const hz = resonanceHz(fill, params.RES_F_EMPTY);
      pour.streamGain.gain.setTargetAtTime(.22 * flow, now, SMOOTH);
      pour.streamBP.frequency.setTargetAtTime(650 + 900 * flow, now, SMOOTH);
      pour.res.frequency.setTargetAtTime(hz, now, SMOOTH);
      pour.res2.frequency.setTargetAtTime(hz * 2.02, now, SMOOTH);
      pour.resGain.gain.setTargetAtTime(1.6 * flow * (1 - .55 * top), now, SMOOTH);
      pour.surface.frequency.setTargetAtTime(3800 - 3000 * top, now, SMOOTH);
      chirpAcc += dt * CHIRP_RATE * flow * (1 - top);
      while (chirpAcc >= 1) { chirpAcc -= 1; chirp(hz); }

      if (state.truck.active !== ducked) duck(state.truck.active);
      if (truck) {
        const m = truckMix(state.truck.progress, params.TRUCK_GAIN);
        truck.gain.gain.setTargetAtTime(m.gain, now, .05);
        truck.pan.pan.setTargetAtTime(m.pan, now, .05);
        truck.filter.frequency.setTargetAtTime(m.cutoff, now, .05);
      }
    },

    handle(events, state) {
      if (!ctx) return;
      for (const e of events) {
        if (e.type === 'drinkEnd') api.slurp();
        else if (e.type === 'spill') api.splash();
        else if (e.type === 'guestSignal') api.honk();
        else if (e.type === 'truckEnter') startTruck(state);
        else if (e.type === 'truckLeave') stopTruck();
        else if (e.type === 'gameOver') pour.streamGain.gain.setTargetAtTime(0, ctx.currentTime, .05);
      }
    },

    // Plays babble for a line and returns each character's reveal time (seconds from now).
    say(text, voice, { silent = false } = {}) {
      const plan = babblePlan(text, { ...voice, wordPause: voice.wordPause ?? params.WORD_PAUSE }, rng);
      if (ctx && !silent) {
        const t0 = ctx.currentTime + .02;
        for (const b of plan) blip(t0 + b.t, b.hz, b.dur);
      }
      return charTimes(text, plan);
    },

    setMuted(b) {
      muted = b;
      if (ctx) master.gain.setTargetAtTime(b ? 0 : 1, ctx.currentTime, .02);
    },

    slurp() {
      if (!ctx) return;
      const t = ctx.currentTime, src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = noise; bp.type = 'bandpass'; bp.Q.value = 4;
      bp.frequency.setValueAtTime(1000, t);
      bp.frequency.exponentialRampToValueAtTime(180, t + .6);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(.9, t + .04);
      for (let i = 1; i <= 5; i++) g.gain.linearRampToValueAtTime(i % 2 ? .35 : .8, t + .04 + i * .08); // the gurgle
      g.gain.linearRampToValueAtTime(0, t + .6);
      src.connect(bp).connect(g).connect(master);
      src.start(t, Math.random()); src.stop(t + .65);
    },

    splash() {
      if (!ctx) return;
      const t = ctx.currentTime, src = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = noise; hp.type = 'highpass'; hp.frequency.value = 900;
      g.gain.setValueAtTime(.5, t);
      g.gain.exponentialRampToValueAtTime(.001, t + .35);
      src.connect(hp).connect(g).connect(master);
      src.start(t, Math.random()); src.stop(t + .4);
      for (let i = 0; i < 6; i++) chirp(500 + Math.random() * 900, t + Math.random() * .2);
    },

    honk() {
      if (!ctx) return;
      const t = ctx.currentTime;
      [[370, 0], [310, .28]].forEach(([hz, at]) => {
        const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
        o.type = 'square'; o.frequency.value = hz; lp.type = 'lowpass'; lp.frequency.value = 1800;
        g.gain.setValueAtTime(0, t + at);
        g.gain.linearRampToValueAtTime(.18, t + at + .01);
        g.gain.setValueAtTime(.18, t + at + .17);
        g.gain.linearRampToValueAtTime(0, t + at + .18);
        o.connect(lp).connect(g).connect(master);
        o.start(t + at); o.stop(t + at + .2);
      });
    },

    // a mid-sized street dog: a short pitched "woof" through a mouth-like band, plus a breathy burst
    bark(pan = .3, at = 0) {
      if (!ctx) return;
      const t = ctx.currentTime + at;
      const o = ctx.createOscillator(), bp = ctx.createBiquadFilter(), g = ctx.createGain(), p = ctx.createStereoPanner();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(420, t);
      o.frequency.linearRampToValueAtTime(560, t + .025);
      o.frequency.exponentialRampToValueAtTime(230, t + .13);
      bp.type = 'bandpass'; bp.frequency.value = 850; bp.Q.value = 1.6;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(.32, t + .012);
      g.gain.exponentialRampToValueAtTime(.001, t + .16);
      p.pan.value = Math.max(-1, Math.min(1, pan));
      o.connect(bp).connect(g).connect(p).connect(master);
      o.start(t); o.stop(t + .18);
      const n = ctx.createBufferSource(), nb = ctx.createBiquadFilter(), ng = ctx.createGain();
      n.buffer = noise; nb.type = 'bandpass'; nb.frequency.value = 1300; nb.Q.value = 1.2;
      ng.gain.setValueAtTime(.16, t); ng.gain.exponentialRampToValueAtTime(.001, t + .09);
      n.connect(nb).connect(ng).connect(p);
      n.start(t, Math.random()); n.stop(t + .1);
    },

    // a benteveo somewhere in the paraíso: "bien-te-veo", three quick whistles
    bird(pan = 0) {
      if (!ctx) return;
      const t0 = ctx.currentTime, p = ctx.createStereoPanner();
      p.pan.value = pan;
      p.connect(master);
      [[2500, 2900, 0, .11], [2150, 2100, .16, .09], [2600, 2250, .3, .17]].forEach(([a, b, at, d]) => {
        const o = ctx.createOscillator(), g = ctx.createGain(), t = t0 + at;
        o.type = 'sine';
        o.frequency.setValueAtTime(a, t);
        o.frequency.linearRampToValueAtTime(b, t + d);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(.045, t + .02);
        g.gain.linearRampToValueAtTime(0, t + d);
        o.connect(g).connect(p);
        o.start(t); o.stop(t + d + .02);
      });
    },

    duck,
  };

  function buildPour() {
    const src = ctx.createBufferSource();
    src.buffer = noise; src.loop = true;
    const streamBP = ctx.createBiquadFilter(); streamBP.type = 'bandpass'; streamBP.Q.value = .9; streamBP.frequency.value = 1000;
    const streamGain = ctx.createGain(); streamGain.gain.value = 0;
    const res = ctx.createBiquadFilter(); res.type = 'bandpass'; res.Q.value = 8;
    const res2 = ctx.createBiquadFilter(); res2.type = 'bandpass'; res2.Q.value = 10;
    const resGain = ctx.createGain(); resGain.gain.value = 0;
    const surface = ctx.createBiquadFilter(); surface.type = 'lowpass'; surface.frequency.value = 3800;
    const out = ctx.createGain(); out.gain.value = .9;
    src.connect(streamBP).connect(streamGain).connect(surface);
    src.connect(res).connect(resGain);
    src.connect(res2).connect(resGain);
    resGain.connect(surface);
    surface.connect(out).connect(master);
    src.start();
    return { streamBP, streamGain, res, res2, resGain, surface };
  }

  function chirp(base, at = ctx.currentTime) {
    const f = base * (1.1 + Math.random() * .7);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f, at);
    o.frequency.linearRampToValueAtTime(f + 180, at + .03);
    g.gain.setValueAtTime(.05 + Math.random() * .04, at);
    g.gain.exponentialRampToValueAtTime(.001, at + .04);
    o.connect(g).connect(pour.surface);
    o.start(at); o.stop(at + .05);
  }

  function blip(at, hz, dur) {
    const o = ctx.createOscillator(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = hz;
    bp.type = 'bandpass'; bp.frequency.value = 2 * hz; bp.Q.value = 1;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(.35, at + .005);
    g.gain.setValueAtTime(.35, at + dur * .6);
    g.gain.linearRampToValueAtTime(0, at + dur);
    o.connect(bp).connect(g).connect(master);
    o.start(at); o.stop(at + dur + .01);
  }

  function duck(active) {
    ducked = active;
    if (!ctx) return;
    const { target, fade } = musicLevel(active, params), g = musicGain.gain, now = ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(target, now + fade);
  }

  function startTruck(state) {
    stopTruck();
    if (!truckBuffer) return;
    const src = ctx.createBufferSource(), gain = ctx.createGain(), pan = ctx.createStereoPanner(), filter = ctx.createBiquadFilter();
    src.buffer = truckBuffer;
    src.loop = true; // the loudspeaker keeps repeating while the truck is stopped for the guest
    filter.type = 'lowpass';
    const m = truckMix(state?.truck.progress || 0, params.TRUCK_GAIN);
    gain.gain.value = m.gain; pan.pan.value = m.pan; filter.frequency.value = m.cutoff;
    src.connect(gain).connect(pan).connect(filter).connect(master);
    src.start();
    truck = { src, gain, pan, filter };
  }

  function stopTruck() {
    if (!truck) return;
    const { src, gain } = truck, now = ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setTargetAtTime(0, now, .15);
    src.stop(now + .8);
    truck = null;
  }

  return api;
}

function makeNoise(ctx, secs) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * secs, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}
