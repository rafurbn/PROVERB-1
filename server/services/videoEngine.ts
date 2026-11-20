import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import type { AutomationSettings, MediaAssetItem, ProverbItem } from '../types.ts';
import { ensureDefaultMediaAssets, isFfmpegAvailable, probeDuration } from './seedMedia.ts';
import { DIRS, getMediaAssetById, listMediaAssets } from './store.ts';

const execFileAsync = promisify(execFile);

/**
 * Brand watermark ("RAFU FOLK") burnt into every rendered reel.
 * Sits inside the Facebook Reels safe zone, above the bottom UI chrome.
 */
export const BRAND_LOGO_PUBLIC_PATH = '/assets/brand/rafu-folk-logo-dark.png';
const BRAND_LOGO_WIDTH = 620;
const BRAND_LOGO_OVERLAY_Y = 1680;

/**
 * FFmpeg on CI (and most builds) has no SVG decoder, so the burnt-in
 * watermark uses the pre-rendered PNG raster of the same artwork.
 */
export function resolveBrandLogoPath(): string | null {
  const candidates = [
    path.resolve(process.cwd(), 'public', 'assets', 'brand', 'rafu-folk-logo-dark.png'),
    path.resolve(process.cwd(), 'dist', 'assets', 'brand', 'rafu-folk-logo-dark.png'),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function hexToAssColor(hex: string, alphaHex = '00'): string {
  const clean = hex.replace('#', '').trim();
  if (clean.length !== 6) return `&H${alphaHex}FFFFFF`;
  const r = clean.slice(0, 2);
  const g = clean.slice(2, 4);
  const b = clean.slice(4, 6);
  return `&H${alphaHex}${b}${g}${r}`.toUpperCase();
}

function escapeAssText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\r?\n/g, ' ');
}

function wrapBengaliLines(text: string, maxChars: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (!current) {
      current = word;
    } else if (current.length + 1 + word.length <= maxChars) {
      current += ' ' + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function formatAssTime(sec: number): string {
  const clamped = Math.max(0, sec);
  const h = Math.floor(clamped / 3600);
  const m = Math.floor((clamped % 3600) / 60);
  const s = Math.floor(clamped % 60);
  const cs = Math.floor((clamped % 1) * 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function buildAssSubtitleContent(options: {
  proverb: ProverbItem;
  durationSec: number;
  textColor: string;
  meaningColor: string;
}): string {
  const { proverb, durationSec, textColor, meaningColor } = options;

  const proverbRaw = `“${proverb.text_bn.trim()}”`;
  const isLongProverb = proverbRaw.length > 48;
  const proverbFontSize = isLongProverb ? 56 : 66;
  const proverbLineHeight = isLongProverb ? 74 : 86;
  const proverbLines = wrapBengaliLines(proverbRaw, isLongProverb ? 26 : 22);

  const meaningRaw = proverb.meaning_bn.trim();
  const isLongMeaning = meaningRaw.length > 90;
  const meaningFontSize = isLongMeaning ? 36 : 42;
  const meaningLineHeight = isLongMeaning ? 48 : 56;
  const meaningLines = wrapBengaliLines(meaningRaw, isLongMeaning ? 34 : 30);

  const proverbBlockHeight = proverbLines.length * proverbLineHeight;
  const meaningBlockHeight = meaningLines.length * meaningLineHeight;
  const totalHeight = proverbBlockHeight + 70 + meaningBlockHeight;

  const centerX = 520;
  const topStartY = Math.round(880 - totalHeight / 2);
  const proverbCenterY = Math.round(topStartY + proverbBlockHeight / 2);
  const dividerY = topStartY + proverbBlockHeight + 28;
  const meaningCenterY = Math.round(dividerY + 42 + meaningBlockHeight / 2);
  const kickerY = Math.max(340, topStartY - 76);

  const primaryAss = hexToAssColor(textColor);
  const meaningAss = hexToAssColor(meaningColor);
  const endTime = formatAssTime(durationSec);

  const proverbEscaped = proverbLines.map(escapeAssText).join('\\N');
  const meaningEscaped = meaningLines.map(escapeAssText).join('\\N');
  const categoryEscaped = escapeAssText(proverb.category || 'বাংলা প্রবাদ');

  return `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Kicker,Noto Sans Bengali,30,&H00D4D4D8,&H000000FF,&H80000000,&H00000000,1,0,0,0,100,100,2,0,1,2,1,5,80,120,80,1
Style: Proverb,Noto Sans Bengali,${proverbFontSize},${primaryAss},&H000000FF,&HAA000000,&H64000000,1,0,0,0,100,100,0,0,1,3.5,2.5,5,80,120,80,1
Style: Meaning,Noto Sans Bengali,${meaningFontSize},${meaningAss},&H000000FF,&HAA000000,&H64000000,0,0,0,0,100,100,0,0,1,2.8,2,5,80,120,80,1
Style: Brand,Noto Sans Bengali,28,&H33FFFFFF,&H000000FF,&H60000000,&H00000000,0,0,0,0,100,100,1,0,1,1.5,0,5,80,120,80,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.15,${endTime},Kicker,,0,0,0,,{\\an5\\pos(${centerX},${kickerY})\\fad(600,400)}${categoryEscaped}
Dialogue: 1,0:00:00.25,${endTime},Proverb,,0,0,0,,{\\an5\\pos(${centerX},${proverbCenterY})\\fad(800,400)}${proverbEscaped}
Dialogue: 2,0:00:00.90,${endTime},Meaning,,0,0,0,,{\\an5\\pos(${centerX},${meaningCenterY})\\fad(850,400)}${meaningEscaped}
Dialogue: 0,0:00:00.40,${endTime},Brand,,0,0,0,,{\\an5\\pos(${centerX},1560)\\fad(600,400)}বাংলা প্রবাদ-প্রবচন
`;
}

export function pickRandomAsset(type: 'video' | 'music', preferredId?: number): MediaAssetItem {
  if (preferredId) {
    const exact = getMediaAssetById(preferredId);
    if (exact && exact.type === type && fs.existsSync(exact.file_path)) {
      return exact;
    }
  }

  const existing = listMediaAssets().filter(
    (a) => a.type === type && fs.existsSync(a.file_path)
  );

  if (existing.length === 0) {
    throw new Error(
      `No ${type} assets available. Ensure FFmpeg is installed or upload a ${type} file.`
    );
  }

  return existing[Math.floor(Math.random() * existing.length)];
}

export async function renderReelVideo(options: {
  proverb: ProverbItem;
  voiceoverPath: string;
  settings: AutomationSettings;
  outputPath: string;
  videoAssetId?: number;
  musicAssetId?: number;
}): Promise<{
  outputPath: string;
  durationSec: number;
  videoAssetName: string;
  musicAssetName: string;
}> {
  const ffmpegOk = await isFfmpegAvailable();
  if (!ffmpegOk) {
    throw new Error(
      'FFmpeg is not installed on this runtime. Run via GitHub Actions (ubuntu-latest) or install ffmpeg + fonts-noto-core.'
    );
  }

  await ensureDefaultMediaAssets();

  const videoAsset = pickRandomAsset('video', options.videoAssetId);
  const musicAsset = pickRandomAsset('music', options.musicAssetId);

  const logoPath = resolveBrandLogoPath();

  const voiceDur = await probeDuration(options.voiceoverPath);
  if (voiceDur === null) {
    throw new Error(`Could not read voiceover duration for ${options.voiceoverPath}.`);
  }
  const targetDuration = Number(Math.max(10, Math.min(45, voiceDur + 2.4)).toFixed(2));

  const assFilename = `overlay_${options.proverb.id}_${Date.now()}.ass`;
  const assPath = path.join(DIRS.temp, assFilename);
  const assContent = buildAssSubtitleContent({
    proverb: options.proverb,
    durationSec: targetDuration,
    textColor: options.settings.text_color || '#FFFFFF',
    meaningColor: options.settings.meaning_color || '#FACC15',
  });
  fs.writeFileSync(assPath, assContent, 'utf-8');

  const musicVol = Math.max(0, Math.min(1, parseFloat(options.settings.music_volume) || 0.15));
  const overlayOpacity = Math.max(0, Math.min(0.85, parseFloat(options.settings.overlay_opacity) || 0.54));

  const relAssPath = path.relative(process.cwd(), assPath).replace(/\\/g, '/').replace(/:/g, '\\:');
  const fadeOutStart = Math.max(1, Number((targetDuration - 1.8).toFixed(2)));
  const logoFadeOutStart = Math.max(0.5, Number((targetDuration - 0.9).toFixed(2)));
  const watermarkChain = logoPath
    ? `,format=rgba,split[logoCore][logoGlowSrc];` +
      `[logoGlowSrc]gblur=sigma=14,colorchannelmixer=aa=0.55[logoGlow];` +
      `[logoCore][logoGlow]overlay=(W-w)/2:(H-h)/2,format=rgba,fade=t=in:st=0.25:d=0.9:alpha=1,fade=t=out:st=${logoFadeOutStart}:d=0.9:alpha=1[wm]`
    : '';
  const filterComplex = [
    `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30,drawbox=x=0:y=0:w=iw:h=ih:color=black@${overlayOpacity}:t=fill,ass='${relAssPath}'[base]`,
    ...(logoPath
      ? [
          `[3:v]fps=30,scale=${BRAND_LOGO_WIDTH}:${Math.round((BRAND_LOGO_WIDTH * 184) / 660)}${watermarkChain}`,
          `[base][wm]overlay=x=(W-w)/2:y=${BRAND_LOGO_OVERLAY_Y}:format=auto,format=yuv420p[vout]`,
        ]
      : [`[base]null[vout]`]),
    `[1:a]adelay=600|600,apad=whole_dur=${targetDuration},volume=1.0[voice]`,
    `[2:a]atrim=0:${targetDuration},asetpts=PTS-STARTPTS,volume=${musicVol},afade=t=in:st=0:d=1.0,afade=t=out:st=${fadeOutStart}:d=1.8[bgm]`,
    `[voice][bgm]amix=inputs=2:duration=first:normalize=0[aout]`,
  ].join(';');

  const tmpOutputPath = `${options.outputPath}.tmp.mp4`;

  try {
    await execFileAsync(
      'ffmpeg',
      [
        '-y',
        '-threads',
        '2',
        '-stream_loop',
        '-1',
        '-i',
        videoAsset.file_path,
        '-i',
        options.voiceoverPath,
        '-stream_loop',
        '-1',
        '-i',
        musicAsset.file_path,
        ...(logoPath ? ['-loop', '1', '-i', logoPath] : []),
        '-filter_complex',
        filterComplex,
        '-map',
        '[vout]',
        '-map',
        '[aout]',
        '-t',
        String(targetDuration),
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '22',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-b:a',
        '192k',
        '-ar',
        '44100',
        '-movflags',
        '+faststart',
        tmpOutputPath,
      ],
      { timeout: 180_000, maxBuffer: 10 * 1024 * 1024 }
    );
    fs.renameSync(tmpOutputPath, options.outputPath);
  } catch (err) {
    if (fs.existsSync(tmpOutputPath)) fs.unlinkSync(tmpOutputPath);
    throw err;
  } finally {
    if (fs.existsSync(assPath)) {
      fs.unlinkSync(assPath);
    }
  }

  return {
    outputPath: options.outputPath,
    durationSec: targetDuration,
    videoAssetName: videoAsset.original_name,
    musicAssetName: musicAsset.original_name,
  };
}
