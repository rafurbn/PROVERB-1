import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { addMediaAsset, DIRS, listMediaAssets } from './store.ts';

const execFileAsync = promisify(execFile);

let cachedFfmpegAvailable: boolean | null = null;

export async function isFfmpegAvailable(): Promise<boolean> {
  if (cachedFfmpegAvailable !== null) return cachedFfmpegAvailable;
  try {
    await execFileAsync('ffmpeg', ['-version'], { timeout: 5000 });
    cachedFfmpegAvailable = true;
  } catch {
    cachedFfmpegAvailable = false;
  }
  return cachedFfmpegAvailable;
}

export async function probeDuration(filePath: string): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync(
      'ffprobe',
      [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        filePath,
      ],
      { timeout: 10000 }
    );
    const parsed = parseFloat(stdout.trim());
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    // Unknown duration — callers must decide, never invent a value.
    return null;
  }
}

async function generateVerticalClipFromImage(
  imagePath: string,
  outputPath: string,
  durationSec = 12
): Promise<void> {
  const frames = durationSec * 30;
  const tmpPath = `${outputPath}.tmp.mp4`;
  try {
    await execFileAsync(
      'ffmpeg',
      [
        '-y',
        '-threads',
        '2',
        '-loop',
        '1',
        '-i',
        imagePath,
        '-vf',
        `scale=1200:2134:force_original_aspect_ratio=increase,crop=1200:2134,zoompan=z='min(zoom+0.00025,1.08)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1080x1920:fps=30,format=yuv420p`,
        '-t',
        String(durationSec),
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '23',
        '-an',
        '-movflags',
        '+faststart',
        tmpPath,
      ],
      { timeout: 180_000, maxBuffer: 10 * 1024 * 1024 }
    );
    fs.renameSync(tmpPath, outputPath);
  } catch (err) {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    throw err;
  }
}

async function generateAmbientTrack(
  outputPath: string,
  freqs: [number, number, number],
  durationSec = 18
): Promise<void> {
  const [f1, f2, f3] = freqs;
  const expr = `0.28*sin(2*PI*${f1}*t)+0.22*sin(2*PI*${f2}*t)+0.16*sin(2*PI*${f3}*t)+0.08*sin(2*PI*${f1 * 0.5}*t)*(0.5+0.5*sin(2*PI*0.18*t))`;
  const tmpPath = `${outputPath}.tmp.wav`;
  try {
    await execFileAsync(
      'ffmpeg',
      [
        '-y',
        '-f',
        'lavfi',
        '-i',
        `aevalsrc='${expr}':s=44100:d=${durationSec}`,
        '-af',
        `lowpass=f=850,aecho=0.8:0.88:60:0.4,afade=t=in:st=0:d=1.5,afade=t=out:st=${durationSec - 2}:d=2`,
        '-c:a',
        'pcm_s16le',
        tmpPath,
      ],
      { timeout: 60_000, maxBuffer: 10 * 1024 * 1024 }
    );
    fs.renameSync(tmpPath, outputPath);
  } catch (err) {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    throw err;
  }
}

let seedingPromise: Promise<void> | null = null;

export function ensureDefaultMediaAssets(): Promise<void> {
  if (seedingPromise) return seedingPromise;

  seedingPromise = (async () => {
    try {
      const ffmpegOk = await isFfmpegAvailable();
      if (!ffmpegOk) {
        return;
      }

      const existingAssets = listMediaAssets();
      const videoAssets = existingAssets.filter(
        (a) => a.type === 'video' && fs.existsSync(a.file_path)
      );

      const defaultVideos = [
        {
          image: path.resolve(process.cwd(), 'src/assets/images/bg_bengal_river_dawn_1795015373281.jpg'),
          filename: 'default_bengal_river_dawn.mp4',
          originalName: 'Bengal River Dawn (1080x1920 Nature Loop)',
        },
        {
          image: path.resolve(
            process.cwd(),
            'src/assets/images/bg_monsoon_bamboo_mist_1795015373345.jpg'
          ),
          filename: 'default_monsoon_bamboo_mist.mp4',
          originalName: 'Monsoon Bamboo Mist (1080x1920 Nature Loop)',
        },
      ];

      if (videoAssets.length === 0) {
        for (const v of defaultVideos) {
          if (!fs.existsSync(v.image)) continue;
          const outPath = path.join(DIRS.videos, v.filename);
          if (!fs.existsSync(outPath)) {
            await generateVerticalClipFromImage(v.image, outPath, 12);
          }
          const stat = fs.statSync(outPath);
          const dur = (await probeDuration(outPath)) ?? 0;
          addMediaAsset({
            type: 'video',
            filename: v.filename,
            original_name: v.originalName,
            file_path: outPath,
            duration_sec: dur,
            file_size: stat.size,
            is_default: 1,
          });
        }
      }

      const musicAssets = existingAssets.filter(
        (a) => a.type === 'music' && fs.existsSync(a.file_path)
      );

      if (musicAssets.length === 0) {
        const defaultMusic: Array<{
          filename: string;
          originalName: string;
          freqs: [number, number, number];
        }> = [
          {
            filename: 'default_tanpura_dawn.wav',
            originalName: 'Soft Morning Tanpura Pad (Ambient)',
            freqs: [146.83, 220.0, 293.66],
          },
          {
            filename: 'default_calm_bamboo_drone.wav',
            originalName: 'Gentle Flute & Rain Pad (Ambient)',
            freqs: [174.61, 261.63, 349.23],
          },
        ];

        for (const m of defaultMusic) {
          const outPath = path.join(DIRS.music, m.filename);
          if (!fs.existsSync(outPath)) {
            await generateAmbientTrack(outPath, m.freqs, 18);
          }
          const stat = fs.statSync(outPath);
          const dur = (await probeDuration(outPath)) ?? 0;
          addMediaAsset({
            type: 'music',
            filename: m.filename,
            original_name: m.originalName,
            file_path: outPath,
            duration_sec: dur,
            file_size: stat.size,
            is_default: 1,
          });
        }
      }
    } catch (err) {
      console.error('[seedMedia] Failed generating default media assets:', err);
      seedingPromise = null;
    }
  })();

  return seedingPromise;
}
