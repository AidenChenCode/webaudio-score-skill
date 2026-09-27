/* =====================================================================
   engine-audio.js — 音乐层：Web Audio 合成器乐器包 + OfflineAudioContext 离线渲染
     · makeKit(ctx, t0)：kick/hat/clap/bass/pluck/bell/marimba/tick/pad/riser/sweep/stab/impact/blip/click + 通用 tone/noise
     · 总线：压缩(胶合) → 限制(封顶) → 输出增益(SPEC.music.outGain)；延迟发送 3/4 拍
     · renderAudioWav()：离线渲染全曲 → base64 WAV（16-bit 48 kHz 立体声）；挂在 window.__renderAudioWav
   依赖（任一来源即可）：SPEC.duration（秒）、SPEC.bpm、SPEC.seed、SPEC.music；PROJECT.score(kit) 由 score.js 提供。
   可与 engine-visual.js 同页加载（画面 + 声音同一张时间表），也可单独配合 render-score.html 只出音频。
   所有调度时间都是绝对秒（相对曲首），随机只用带种子的 RNG，两次渲染逐样本一致。
   ===================================================================== */
'use strict';
(() => {
  // spec.js 用 const 声明 SPEC（全局词法绑定，不在 window 上），所以用 typeof 取
  const S = (typeof SPEC !== 'undefined') ? SPEC : (window.SPEC || {});
  const DURATION = (typeof DUR !== 'undefined') ? DUR : (S.duration || 30);
  const BEAT_ = (typeof BEAT !== 'undefined') ? BEAT : 60 / (S.bpm || 120);
  const PROJECT_ = window.PROJECT = window.PROJECT || {};
  const rng = seed => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);       // MIDI → Hz
  const N = { F1: 29, A1: 33, C2: 36, E2: 40, F2: 41, G2: 43, A2: 45, C3: 48, E3: 52, F3: 53, G3: 55, A3: 57, B3: 59, C4: 60, D4: 62, E4: 64, F4: 65, G4: 67, A4: 69, B4: 71, C5: 72, D5: 74, E5: 76, F5: 77, G5: 79, A5: 81, B5: 83, C6: 84, D6: 86, E6: 88 };

  function makeKit(ctx, t0) {
    const R = rng((S.seed || 1) + 777);
    const M = S.music || {};
    const master = ctx.createGain(); master.gain.value = 1.0;
    // Chrome 的 DynamicsCompressor 自带补偿增益，单独一个会把混音推到削波；压缩 + 限制 + 输出增益三级都要有
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 10; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.2;
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -6; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.08;
    const out = ctx.createGain(); out.gain.value = M.outGain ?? 0.75;
    master.connect(comp); comp.connect(lim); lim.connect(out); out.connect(ctx.destination);
    const dly = ctx.createDelay(2); dly.delayTime.value = BEAT_ * 0.75;
    const fb = ctx.createGain(); fb.gain.value = 0.34;
    const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2600;
    const send = ctx.createGain(); send.gain.value = 0.32;
    dly.connect(dlp); dlp.connect(fb); fb.connect(dly); dly.connect(send); send.connect(master);
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    { const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = R() * 2 - 1; }
    const at = s => t0 + s;

    function tone({ type = 'sine', f, t, dur, g = 0.2, a = 0.005, d = 0.1, s = 0.6, r = 0.2, detune = 0, lp, lpEnd, q = 0.7, dest = master, wet = 0, pitchTo, pitchDur = 0.05 }) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, at(t));
      if (pitchTo) o.frequency.exponentialRampToValueAtTime(pitchTo, at(t + pitchDur));
      o.detune.value = detune;
      const e = ctx.createGain(); e.gain.setValueAtTime(0.0001, at(t));
      e.gain.exponentialRampToValueAtTime(g, at(t + a));
      e.gain.exponentialRampToValueAtTime(Math.max(g * s, 0.0001), at(t + a + d));
      e.gain.setValueAtTime(Math.max(g * s, 0.0001), at(t + Math.max(dur - r, a + d)));
      e.gain.exponentialRampToValueAtTime(0.0001, at(t + dur));
      let node = o;
      if (lp) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = q; fl.frequency.setValueAtTime(lp, at(t)); if (lpEnd) fl.frequency.exponentialRampToValueAtTime(lpEnd, at(t + dur * 0.5)); o.connect(fl); node = fl; }
      node.connect(e); e.connect(dest);
      if (wet) { const w = ctx.createGain(); w.gain.value = wet; e.connect(w); w.connect(dly); }
      o.start(at(t)); o.stop(at(t + dur + 0.05));
    }
    function noise({ t, dur, g = 0.2, a = 0.002, r = 0.08, type = 'highpass', f = 6000, fEnd, q = 0.8, dest = master, wet = 0 }) {
      const src = ctx.createBufferSource(); src.buffer = nb; src.loop = true;
      const fl = ctx.createBiquadFilter(); fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f, at(t));
      if (fEnd) fl.frequency.exponentialRampToValueAtTime(fEnd, at(t + dur));
      const e = ctx.createGain(); e.gain.setValueAtTime(0.0001, at(t));
      e.gain.linearRampToValueAtTime(g, at(t + a));
      e.gain.setValueAtTime(g, at(t + Math.max(a, dur - r)));
      e.gain.exponentialRampToValueAtTime(0.0001, at(t + dur));
      src.connect(fl); fl.connect(e); e.connect(dest);
      if (wet) { const w = ctx.createGain(); w.gain.value = wet; e.connect(w); w.connect(dly); }
      src.start(at(t), R() * 1.5); src.stop(at(t + dur + 0.05));
    }
    const kit = {
      ctx, master, dly, at, tone, noise, NOTE, N, BEAT: BEAT_, DUR: DURATION,
      fadeOut(t1, t2) { master.gain.setValueAtTime(1.0, at(t1)); master.gain.linearRampToValueAtTime(0.0001, at(t2)); },
      kick: (t, g = 0.7, f0 = 170, f1 = 46) => { tone({ f: f0, pitchTo: f1, pitchDur: 0.06, t, dur: 0.32, g, a: 0.002, d: 0.26, s: 0.0001, r: 0.05 }); noise({ t, dur: 0.02, g: g * 0.25, f: 3000, r: 0.015 }); },
      hat: (t, g = 0.12, dur = 0.045) => noise({ t, dur, g, f: 7500, r: dur * 0.8 }),
      clap: (t, g = 0.24) => { for (let k = 0; k < 3; k++) noise({ t: t + k * 0.009, dur: 0.11 + k * 0.03, g: g * (1 - k * 0.2), type: 'bandpass', f: 1300 + k * 400, q: 1.1, r: 0.08, wet: 0.25 }); },
      bass: (t, n, dur = 0.22, g = 0.22) => { tone({ type: 'sawtooth', f: NOTE(n), t, dur, g: g * 0.6, a: 0.004, d: 0.08, s: 0.7, r: 0.06, lp: 520, q: 1.2 }); tone({ type: 'square', f: NOTE(n), t, dur, g: g * 0.35, a: 0.004, d: 0.08, s: 0.7, r: 0.06, lp: 380 }); },
      pluck: (t, n, g = 0.14, dur = 0.34) => { tone({ type: 'sawtooth', f: NOTE(n), t, dur, g, a: 0.003, d: 0.14, s: 0.08, r: 0.1, lp: 3200, lpEnd: 900, q: 1.5, wet: 0.5 }); tone({ type: 'triangle', f: NOTE(n), t, dur, g: g * 0.7, a: 0.003, d: 0.12, s: 0.05, r: 0.1, wet: 0.3 }); },
      bell: (t, n, g = 0.2, dur = 0.5) => { tone({ f: NOTE(n), t, dur, g, a: 0.003, d: 0.2, s: 0.25, r: 0.25, wet: 0.6 }); tone({ f: NOTE(n) * 2.76, t, dur: dur * 0.5, g: g * 0.35, a: 0.002, d: 0.08, s: 0.1, r: 0.1, wet: 0.4 }); tone({ f: NOTE(n) * 4.07, t, dur: dur * 0.3, g: g * 0.15, a: 0.002, d: 0.05, s: 0.05, r: 0.05 }); },
      marimba: (t, n, g = 0.16) => { tone({ f: NOTE(n), t, dur: 0.42, g, a: 0.002, d: 0.16, s: 0.15, r: 0.2, wet: 0.35 }); tone({ f: NOTE(n) * 4, t, dur: 0.12, g: g * 0.3, a: 0.002, d: 0.05, s: 0.1, r: 0.05 }); },
      tick: (t, f0 = 420, f1 = 260, g = 0.28) => tone({ f: f0, pitchTo: f1, pitchDur: 0.05, t, dur: 0.14, g, a: 0.002, d: 0.1, s: 0.05, r: 0.03, wet: 0.35 }),
      pad(t, dur, notes, g = 0.08, lp = 900, lpEnd = 1800, pump = false) {
        const bus = ctx.createGain(); bus.gain.setValueAtTime(g, at(t)); bus.connect(master);
        const w = ctx.createGain(); w.gain.value = 0.25; bus.connect(w); w.connect(dly);
        if (pump) for (let b = t; b < t + dur - 0.01; b += BEAT_) { bus.gain.setValueAtTime(g * 0.3, at(b)); bus.gain.linearRampToValueAtTime(g, at(b + BEAT_ * 0.64)); }
        for (const n of notes) for (const det of [-8, 8]) tone({ type: 'sawtooth', f: NOTE(n), t, dur, g: 0.5, a: 0.9, d: 0.5, s: 0.9, r: 1.6, detune: det, lp, lpEnd, q: 0.5, dest: bus });
      },
      riser: (t, dur, g = 0.3) => { noise({ t, dur, g, a: dur * 0.9, r: 0.05, type: 'bandpass', f: 300, fEnd: 6000, q: 1.2, wet: 0.3 }); tone({ f: 180, pitchTo: 900, pitchDur: dur, t, dur, g: 0.07, a: dur * 0.8, d: 0.05, s: 1, r: 0.05, type: 'triangle' }); },
      sweep: (t, dur = 0.5, g = 0.22) => noise({ t, dur, g, a: dur * 0.9, r: 0.04, type: 'bandpass', f: 800, fEnd: 5000, q: 1 }),
      stab(t, notes) { for (const n of notes) for (const det of [-10, 0, 10]) tone({ type: 'sawtooth', f: NOTE(n), t, dur: 0.6, g: 0.09, a: 0.004, d: 0.3, s: 0.2, r: 0.25, detune: det, lp: 4200, lpEnd: 500, q: 1, wet: 0.35 }); tone({ f: 95, pitchTo: 34, pitchDur: 0.5, t, dur: 0.7, g: 0.45, a: 0.003, d: 0.5, s: 0.0001, r: 0.1 }); noise({ t, dur: 0.35, g: 0.22, f: 2500, r: 0.3, wet: 0.3 }); },
      impact(t, g = 1) { tone({ f: 72, pitchTo: 27, pitchDur: 1.1, t, dur: 1.6, g: 0.75 * g, a: 0.003, d: 1.4, s: 0.0001, r: 0.1 }); noise({ t, dur: 2.2, g: 0.32 * g, f: 3800, r: 2.1, wet: 0.5 }); noise({ t, dur: 0.12, g: 0.4 * g, type: 'lowpass', f: 900, r: 0.1 }); },
      blip: (t, f = 1300, g = 0.09) => tone({ f, t, dur: 0.07, g, a: 0.002, d: 0.04, s: 0.2, r: 0.02, wet: 0.5 }),
      click: (t, f = 3600, g = 0.07) => noise({ t, dur: 0.03, g, type: 'bandpass', f, q: 2.5, r: 0.02 }),
    };
    return kit;
  }

  async function renderAudioWav() {
    const sr = 48000;
    const ctx = new OfflineAudioContext(2, Math.round(sr * DURATION), sr);
    if (typeof PROJECT_.score !== 'function') throw new Error('PROJECT.score(kit) 未定义（需要 score.js）');
    PROJECT_.score(makeKit(ctx, 0));
    const buf = await ctx.startRendering();
    const ch = [buf.getChannelData(0), buf.getChannelData(1)];
    const n = buf.length, bytes = 44 + n * 4, ab = new ArrayBuffer(bytes), dv = new DataView(ab);
    const str = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); dv.setUint32(4, bytes - 8, true); str(8, 'WAVE'); str(12, 'fmt '); dv.setUint32(16, 16, true);
    dv.setUint16(20, 1, true); dv.setUint16(22, 2, true); dv.setUint32(24, sr, true); dv.setUint32(28, sr * 4, true);
    dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); str(36, 'data'); dv.setUint32(40, n * 4, true);
    let o = 44;
    for (let i = 0; i < n; i++) for (let c = 0; c < 2; c++) { const v = Math.max(-1, Math.min(1, ch[c][i])); dv.setInt16(o, v < 0 ? v * 32768 : v * 32767, true); o += 2; }
    const u8 = new Uint8Array(ab); let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  }

  window.makeKit = makeKit;
  window.NOTE = NOTE; window.N = N;
  window.__renderAudioWav = renderAudioWav;
})();
