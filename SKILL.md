---
name: webaudio-score
description: "音乐层：用 Web Audio 代码合成整段配乐与音效（底鼓、hat、拍手、贝斯、琶音、铃、马林巴、垫音、riser、stab、impact、blip…），按时间表调度，OfflineAudioContext 离线一次性渲染成 WAV；可与画面页同页加载共用时间表，也可单独出音频。当用户要'给视频/动画配乐''合成音乐或音效''不用素材生成背景音乐''做个 jingle/节奏/落点音效''让切点有声音''Web Audio''把音乐和画面对齐'等时触发；即使用户只说'加点音乐'也用本 skill，不要去找现成音乐素材。"
---

# Web Audio 音乐层

目标：不用任何采样素材，用振荡器、噪声、滤波器和包络合成一整段配乐，所有事件按**绝对秒**调度并引用与画面相同的时间表 `TL`，所以音画同步是构造出来的，不需要事后对齐。渲染用 `OfflineAudioContext`，比实时快十几倍，结果逐样本确定。

## 上下游

- 上游：`webgl-canvas-scene`（画面页；同页加载即可共用 `SPEC`/`TL`）。没有画面也能单独用 `assets/render-score.html`。
- 下游：`headless-export`（导出时顺带取走 WAV）或本 skill 的 `scripts/render_wav.mjs`（只出 WAV）→ `ffmpeg-encode` → `video-verify`（测响度/同步）。

## 工作流

### 1. 放文件
```bash
cp <skill>/assets/engine-audio.js <dir>/ && cp <skill>/assets/score-template.js <dir>/score.js
```
- 有画面页：在 `index.html` 里 `engine-visual.js` 之后加载 `engine-audio.js`，`scenes.js` 之后加载 `score.js`（模板里已留好注释行）。
- 只出音频：再 `cp <skill>/assets/render-score.html <dir>/` 并准备一个 `spec.js`（至少 `title / duration / bpm / seed / music.outGain`，时间表 `TL`）。

### 2. 编排 `score.js`
`PROJECT.score(kit)` 里用乐器包调度：`kick / hat / clap / bass / pluck / bell / marimba / tick / pad / riser / sweep / stab / impact / blip / click`，以及通用 `tone({...})` / `noise({...})`；音高用 `kit.N.C4` 这类 MIDI 号，`kit.BEAT` 是拍长。编曲套路（各幕怎么配、切点用什么、riser 放哪）与乐器参数见 `references/music.md`。

规则：
- 切点上的声音（`stab / impact / tick / bell`）必须写 `TL.xxx`，不写秒数。
- 切点上要有**瞬态**（stab/impact），只有渐入的 pad 测不出同步。
- 音色相似即可，不照搬任何现成旋律。

### 3. 预览
画面页点 PLAY（画面与声音同步播放），或 `render-score.html` 的 PLAY。

### 4. 渲染 WAV
```bash
cd <skill>/scripts && npm install          # 只需一次（puppeteer-core + ws）
node <skill>/scripts/render_wav.mjs <dir>/render-score.html <dir>/build/audio.wav     # 或传画面页 index.html
```
用 `headless-export` 导出画面时会自动取走音频，不必单独跑。

### 5. 响度
`video-verify` 会测；只有音频时：`ffmpeg -i build/audio.wav -filter:a ebur128=peak=true -f null -`。目标 -16 … -12 LUFS、真峰值 ≤ -1 dBTP。偏离改 `SPEC.music.outGain`（每 0.1 ≈ 1.2 dB）。

同一份 score 在不同 Chrome 进程里渲染，结果可能有极少数采样 ±1 LSB 的浮点差异（约 0.03% 采样），听不出也测不出，属正常。

## 混音链（引擎内置，不要绕开）

`乐器 → master → 压缩(-18 dB, 3:1) → 限制(-6 dB, 20:1) → 输出增益(outGain 0.75)`。Chrome 的压缩器自带补偿增益，去掉限制器会直接削波。延迟发送 3/4 拍（`wet` 参数控制送多少）。

## 文件

```
assets/engine-audio.js      乐器包 + 离线渲染（window.makeKit / __renderAudioWav）
assets/score-template.js    起步编曲示例（复制为 score.js）
assets/render-score.html    只出音频的最小页面（PLAY / RENDER WAV）
scripts/render_wav.mjs      无头渲染 WAV；scripts/package.json 依赖
references/music.md         乐器速查、五幕编曲套路、同步、混音与响度、改曲风
```
