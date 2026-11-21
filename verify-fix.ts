// Renders a single frame with the UPDATED logo chain to verify contrast.
import fs from 'fs';
import path from 'path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

const assPath = path.resolve('storage/previews/verify.ass');
fs.writeFileSync(
  assPath,
  `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Kicker,Noto Sans Bengali,44,&H00E5E7EB,&H000000FF,&HCC000000,&H00000000,1,0,0,0,100,100,2,0,1,3,1.5,5,80,120,80,1
Style: Proverb,Noto Sans Bengali,66,&H00FFFFFF,&H000000FF,&HAA000000,&H64000000,1,0,0,0,100,100,0,0,1,3.5,2.5,5,80,120,80,1
Style: Meaning,Noto Sans Bengali,42,&H0000D7F5,&H000000FF,&HBB000000,&H64000000,0,0,0,0,100,100,0,0,1,3,2,5,80,120,80,1
Style: Brand,Noto Sans Bengali,40,&H00FFFFFF,&H000000FF,&HCC000000,&H00000000,0,0,0,0,100,100,1,0,1,2,0,5,80,120,80,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.15,0:00:06.00,Kicker,,0,0,0,,{\\an5\\pos(540,320)}জ্ঞান ও শিক্ষা
Dialogue: 1,0:00:00.25,0:00:06.00,Proverb,,0,0,0,,{\\an5\\pos(540,860)}অল্প বিদ্যা ভয়ংকরী
Dialogue: 2,0:00:00.90,0:00:06.00,Meaning,,0,0,0,,{\\an5\\pos(540,1010)}আংশিক বা অসম্পূর্ণ জ্ঞান অনেক সময় বিপদের কারণ হয়ে দাঁড়ায়।
Dialogue: 0,0:00:00.40,0:00:06.00,Brand,,0,0,0,,{\\an5\\pos(540,1580)}বাংলা প্রবাদ-প্রবচন
`,
  'utf-8'
);
const relAss = assPath.replace(/\\/g, '/').replace(/:/g, '\\:');
const LOGO_W = 620;
const LOGO_H = Math.round((LOGO_W * 184) / 660);
const fc = [
  `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30,drawbox=x=0:y=0:w=iw:h=ih:color=black@0.54:t=fill,ass='${relAss}'[base]`,
  `[1:v]fps=30,scale=${LOGO_W}:${LOGO_H},format=rgba,drawbox=x=0:y=0:w=iw:h=ih:color=black@0.45:t=fill,pad=iw+48:ih+48:24:24:color=white@0.96,format=rgba,` +
    `fade=t=in:st=0:d=0.35:alpha=1,fade=t=out:st=2.1:d=0.9:alpha=1[wm]`,
  `[base][wm]overlay=x=(W-w)/2:y=1680:format=auto,format=yuv420p[vout]`,
].join(';');
const out = 'storage/previews/verify_fix.mp4';
await run(
  'ffmpeg',
  ['-y', '-stream_loop', '-1', '-i', 'storage/videos/default_bengal_river_dawn.mp4', '-loop', '1', '-i', 'public/assets/brand/rafu-folk-logo-dark.png',
    '-filter_complex', fc, '-map', '[vout]', '-t', '2', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', out],
  { maxBuffer: 20 * 1024 * 1024 }
);
await run('ffmpeg', ['-y', '-ss', '1.6', '-i', out, '-frames:v', '1', '-update', '1', 'storage/previews/verify_fix.png']);
await run('ffmpeg', ['-y', '-i', 'storage/previews/verify_fix.png', '-vf', 'crop=1080:400:0:1520', '-update', '1', 'storage/previews/verify_logo_crop.png']);
console.log('done verify');
