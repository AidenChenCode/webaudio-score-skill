/* score.js — 起步示例：启动 blip → 抽吸垫音 + 鼓 + 贝斯 → riser → 落点 impact + 宽垫音 + 铃 → 琶音 → 淡出
   切点一律引用 TL（与画面同一张表），这就是"同步靠构造保证"。乐器与编曲套路见 references/music.md */
'use strict';
PROJECT.score = kit => {
  const { kick, hat, bass, pluck, pad, riser, impact, bell, blip, N } = kit;
  const B = kit.BEAT, eighth = B / 2;
  kit.fadeOut(TL.fade, TL.end - 0.1);

  // 启动
  [[B * 0.5, 1300], [B * 1.1, 1750], [B * 1.7, 2300]].forEach(([t, f]) => blip(t, f));
  pad(0.2, TL.hit - 0.2, [N.A3, N.C4, N.E4], 0.06, 700, 1600, true);
  // 律动
  for (let t = B * 2; t < TL.hit - 0.01; t += B) { kick(t, 0.6); hat(t + eighth); }
  const bassPat = [N.A1, N.A1, N.A2, N.A1, N.A1, N.A1, N.A2, N.C2];
  for (let i = 0, t = B * 2; t < TL.hit - 0.01; i++, t += eighth) bass(t, bassPat[i % 8]);
  riser(TL.hit - B * 3, B * 3, 0.32);
  // 落点
  impact(TL.hit);
  pad(TL.hit, TL.end - TL.hit, [N.F2, N.F3, N.A3, N.C4, N.E4], 0.12, 1200, 3000);
  bell(TL.hit + 0.02, N.E6, 0.22, 1.2);
  for (let t = TL.hit + B; t < TL.fade; t += B) hat(t, 0.08, 0.035);
  const arp = [N.F4, N.A4, N.C5, N.E5, N.F5, N.E5, N.C5, N.A4];
  for (let i = 0, t = TL.hit + B; t < TL.fade; i++, t += eighth) pluck(t, arp[i % 8], 0.1, 0.3);
};
