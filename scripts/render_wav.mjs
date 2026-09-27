#!/usr/bin/env node
/* 用无头 Chrome 打开任意实现了 window.__renderAudioWav() 的页面，把离线渲染的 WAV 写到磁盘
   用法: node render_wav.mjs <page.html> [out.wav]     （默认 out = <page 目录>/build/audio.wav）
   环境变量 CHROME 可指定浏览器路径。依赖 puppeteer-core（npm install 见同目录 package.json）。 */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const page_ = process.argv[2];
if (!page_) { console.error('用法: node render_wav.mjs <page.html> [out.wav]'); process.exit(1); }
const pagePath = path.resolve(page_);
const out = path.resolve(process.argv[3] || path.join(path.dirname(pagePath), 'build', 'audio.wav'));
const CHROME = process.env.CHROME || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(p => fs.existsSync(p));
if (!CHROME) { console.error('未找到 Chrome，请设置 CHROME=<路径>'); process.exit(1); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage();
  page.on('pageerror', e => console.error('PAGE ERROR', e.message));
  await page.goto(pathToFileURL(pagePath).href + '?export=1', { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.__renderAudioWav === 'function' && (window.__ready === undefined || window.__ready === true), { timeout: 30000 });
  const t = Date.now();
  const b64 = await page.evaluate(() => window.__renderAudioWav());
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.from(b64, 'base64'));
  console.log(`wav → ${out} (${(fs.statSync(out).size / 1e6).toFixed(2)} MB) in ${((Date.now() - t) / 1000).toFixed(1)} s`);
} finally {
  const proc = browser.process();
  await Promise.race([browser.close().catch(() => {}), sleep(15000)]);
  if (proc && proc.exitCode === null) { try { proc.kill('SIGKILL'); } catch {} }
}
await new Promise(r => process.stdout.write('', r));
process.exit(0);
