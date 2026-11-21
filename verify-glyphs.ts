// Renders each text line alone on black and crops it, to see if glyphs are real.
import fs from 'fs';
import path from 'path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const fontsDir = path.resolve('public/assets/fonts').replace(/\\/g, '/').replace(/:/g, '\\:');

const lines: Array<[string, number, string, number]> = [
  ['kicker', 44, '\\H00E5E7EB', 220],
  ['proverb', 66, '\\H00FFFFFF', 420],
  ['meaning', 42, '\\H0000D7F5', 580],
  ['brand', 40, '\\H00FFFFFF', 720],
];
const texts: Record<string, string> = {
  kicker: 'জ্ঞান ও শিক্ষা',
  proverb: 'অল্প বিদ্যা ভয়ংকরী',
  meaning: 'আংশিক বা অসম্পূর্ণ জ্ঞান অনেক সময় বিপদের কারণ হয়ে দাঁড়ায়।',
  brand: 'বাংলা প্রবাদ-প্রবচন',
};

for (const [name, size, color, y] of lines) {
  const assPath = path.resolve(`storage/previews/glyph_${name}.ass`);
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
Style: S,Noto Sans Bengali,${size},${color.replace(/\\/g, '&')},&H000000FF,&HCC000000,&H00000000,0,0,0,0,100,100,0,0,1,3,1.5,5,80,120,80,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:00:02.00,S,,0,0,0,,{\\an5\\pos(540,${y})}${texts[name]}
`,
    'utf-8'
  );
  const rel = assPath.replace(/\\/g, '/').replace(/:/g, '\\:');
  await run('ffmpeg', [
    '-y', '-f', 'lavfi', '-i', 'color=c=0x0B1220:s=1080x1920:d=1', '-frames:v', '1',
    '-vf', `ass='${rel}':fontsdir='${fontsDir}'`, `storage/previews/glyph_${name}.png`,
  ]);
  console.log('ok', name);
}
