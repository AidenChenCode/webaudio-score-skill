# webaudio-score — 音乐层 Claude Code Skill

> Music layer of a code-generated video pipeline: synthesize an entire score with Web Audio (kick, hats, clap, bass, plucks, bells, marimba, pads, risers, stabs, impacts), schedule it against the same timeline as the visuals, and render it offline with `OfflineAudioContext` to a WAV — deterministic, sample-accurate, no samples or stock music.

技术栈五层里的**音乐**层。所有声音由振荡器、噪声、滤波器和包络合成，事件按绝对秒调度并引用与画面相同的时间表，所以音画同步是构造出来的。可与画面页同页加载，也可用 `render-score.html` 单独出音频。

## 安装

```bash
git clone https://github.com/AidenChenCode/webaudio-score-skill.git ~/.claude/skills/webaudio-score
cd ~/.claude/skills/webaudio-score/scripts && npm install      # 无头渲染 WAV 需要 puppeteer-core
```

## 使用

在 Claude Code 里说「给这个动画配乐 / 合成一段音乐 / 加个落点音效」即可触发。手动：

```bash
cp ~/.claude/skills/webaudio-score/assets/engine-audio.js my-scene/
cp ~/.claude/skills/webaudio-score/assets/score-template.js my-scene/score.js     # 编排改这里
# 画面页 index.html 里加载 engine-audio.js 与 score.js；或复制 render-score.html 单独出音频
node ~/.claude/skills/webaudio-score/scripts/render_wav.mjs my-scene/render-score.html my-scene/build/audio.wav
```

## 结构

```
SKILL.md                     工作流、混音链、响度
assets/engine-audio.js       乐器包 makeKit(ctx, t0) + 离线渲染 window.__renderAudioWav
assets/score-template.js     起步编曲示例
assets/render-score.html     只出音频的最小页面（PLAY / RENDER WAV）
scripts/render_wav.mjs       无头 Chrome 渲染 WAV
references/music.md          乐器速查、五幕编曲套路、同步、混音与响度、改曲风
```

## 同一套技术栈的其它 skill

| 层 | 仓库 |
|---|---|
| 画面 | [webgl-canvas-scene-skill](https://github.com/AidenChenCode/webgl-canvas-scene-skill) |
| 音乐 | webaudio-score-skill（本仓库） |
| 导出 | [headless-export-skill](https://github.com/AidenChenCode/headless-export-skill) |
| 编码 | [ffmpeg-encode-skill](https://github.com/AidenChenCode/ffmpeg-encode-skill) |
| 核对 | [video-verify-skill](https://github.com/AidenChenCode/video-verify-skill) |
| 组合体 | [motion-graphics-skill](https://github.com/AidenChenCode/motion-graphics-skill) |
