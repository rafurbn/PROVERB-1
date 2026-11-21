// Re-runs the exact production filter graph with variations to isolate the cause.
import fs from 'fs';
import path from 'path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const fontsDir = path.resolve('public/assets/fonts').replace(/\\/g, '/').replace(/:/g, '\\:');
// Must match production (server/services/videoEngine.ts).
const LOGO_W = 580;
const LOGO_Y = 1596;
const BRAND_Y = 1520;
const LOGO_H = Math.round((LOGO_W * 184) / 660);

async function render(label: string, opts: { logo: boolean; glow: boolean; opacity: number; fontSize?: number }) {
  const assPath = path.resolve('storage/previews/audit.ass');
  const fs_ = opts.fontSize ?? 66;
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
Style: Kicker,Noto Sans Bengali,44,&H00E5E7EB,&H000000FF,&HCC000000,&H00000000,0,0,0,0,100,100,0,0,1,3,1.5,5,80,120,80,1
Style: Proverb,Noto Sans Bengali,${fs_},&H00FFFFFF,&H000000FF,&HAA000000,&H64000000,0,0,0,0,100,100,0,0,1,3.5,2.5,5,80,120,80,1
Style: Meaning,Noto Sans Bengali,42,&H0000D7F5,&H000000FF,&HBB000000,&H64000000,0,0,0,0,100,100,0,0,1,3,2,5,80,120,80,1
Style: Brand,Noto Sans Bengali,40,&H00FFFFFF,&H000000FF,&HCC000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,5,80,120,80,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.15,0:00:06.00,Kicker,,0,0,0,,{\\an5\\pos(540,320)}জ্ঞান ও শিক্ষা
Dialogue: 1,0:00:00.25,0:00:06.00,Proverb,,0,0,0,,{\\an5\\pos(540,860)}অল্প বিদ্যা ভয়ংকরী
Dialogue: 2,0:00:00.90,0:00:06.00,Meaning,,0,0,0,,{\\an5\\pos(540,1010)}আংশিক বা অসম্পূর্ণ জ্ঞান অনেক সময় বিপদের কারণ হয়ে দাঁড়ায়।
Dialogue: 0,0:00:00.40,0:00:06.00,Brand,,0,0,0,,{\\an5\\pos(540,${BRAND_Y})}বাংলা প্রবাদ-প্রবচন
`,
    'utf-8'
  );
  const relAss = assPath.replace(/\\/g, '/').replace(/:/g, '\\:');
  const overlay = opts.opacity;
  const parts = [
    `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30,drawbox=x=0:y=0:w=iw:h=ih:color=black@${overlay}:t=fill,ass='${relAss}':fontsdir='${fontsDir}'[base]`,
  ];
  if (opts.logo) {
    const wm = opts.glow
      ? `[3:v]fps=30,scale=${LOGO_W}:${LOGO_H},format=rgba,split[lc][lg];[lg]gblur=sigma=14,colorchannelmixer=aa=0.55[lo];[lc][lo]overlay=(W-w)/2:(H-h)/2,format=rgba[wm]`
      : `[3:v]fps=30,scale=${LOGO_W}:${LOGO_H},format=rgba,pad=iw+56:ih+40:28:20:color=0x0B1220EE,format=rgba[wm]`;
    parts.push(wm);
    parts.push(`[base][wm]overlay=x=(W-w)/2:y=${LOGO_Y}:format=auto,format=yuv420p[vout]`);
  } else {
    parts.push('[base]null[vout]');
  }
  const fc = parts.join(';');
  const out = `storage/previews/var_${label}.mp4`;
  const args = ['-y', '-stream_loop', '-1', '-i', 'storage/videos/default_bengal_river_dawn.mp4', '-i', 'storage/temp/audit_voice.mp3', '-stream_loop', '-1', '-i', 'storage/music/default_tanpura_dawn.wav'];
  if (opts.logo) args.push('-loop', '1', '-i', 'public/assets/brand/rafu-folk-logo-dark.png');
  args.push('-filter_complex', fc, '-map', '[vout]', '-t', '4', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', out);
  await run('ffmpeg', args, { maxBuffer: 20 * 1024 * 1024 });
  await run('ffmpeg', ['-y', '-ss', '2', '-i', out, '-frames:v', '1', '-update', '1', `storage/previews/var_${label}.png`]);
  console.log('done', label);
}

await render('logo_glow', { logo: true, glow: true, opacity: 0.54 });
await render('logo_plain', { logo: true, glow: false, opacity: 0.54 });
await render('nologo', { logo: false, glow: false, opacity: 0.54 });
