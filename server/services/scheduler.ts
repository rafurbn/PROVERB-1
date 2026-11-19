import fs from 'fs';
import cron, { type ScheduledTask } from 'node-cron';
import path from 'path';
import type { ProverbItem } from '../types.ts';
import { publishFacebookReel } from './facebook.ts';
import {
  createRenderLog,
  DIRS,
  getNextPendingProverb,
  getProverbById,
  getSettings,
  patchProverb,
  updateRenderLog,
  updateSettings,
} from './store.ts';
import { generateBengaliVoiceover } from './tts.ts';
import { renderReelVideo } from './videoEngine.ts';

let activeTask: ScheduledTask | null = null;
let isPipelineRunning = false;

export interface PipelineRunResult {
  logId: number;
  proverb: ProverbItem;
  mode: 'preview' | 'publish';
  status: 'rendered' | 'published';
  outputFilename: string | null;
  previewUrl: string | null;
  fbReelId: string | null;
  durationMs: number;
  ttsProvider: string;
}

export function isAutomationBusy(): boolean {
  return isPipelineRunning;
}

export async function runReelPipeline(options: {
  mode: 'preview' | 'publish';
  proverbId?: number;
  videoAssetId?: number;
  musicAssetId?: number;
}): Promise<PipelineRunResult> {
  if (isPipelineRunning) {
    throw new Error('A video rendering job is already in progress. Please wait for it to finish.');
  }

  isPipelineRunning = true;
  const startedAt = Date.now();
  const settings = getSettings();

  let proverb: ProverbItem | undefined;
  try {
    proverb = options.proverbId
      ? await getProverbById(options.proverbId)
      : await getNextPendingProverb();
  } catch (err) {
    isPipelineRunning = false;
    throw err;
  }

  if (!proverb) {
    isPipelineRunning = false;
    throw new Error('No pending Bengali proverbs left in the queue. Add or import proverbs first.');
  }

  const log = createRenderLog({
    proverb_id: proverb.id,
    proverb_text: proverb.text_bn,
    mode: options.mode,
    tts_provider: 'edge-tts',
  });

  const timestamp = Date.now();
  const voiceBase = path.join(DIRS.temp, `voice_${proverb.id}_${timestamp}`);
  const outputFilename = `reel_${proverb.id}_${timestamp}.mp4`;
  const outputPath =
    options.mode === 'preview'
      ? path.join(DIRS.previews, outputFilename)
      : path.join(DIRS.temp, outputFilename);

  let voiceoverFilePath: string | null = null;

  try {
    const tts = await generateBengaliVoiceover({
      proverbBn: proverb.text_bn,
      meaningBn: proverb.meaning_bn,
      outputPathWithoutExt: voiceBase,
    });
    voiceoverFilePath = tts.filePath;

    const rendered = await renderReelVideo({
      proverb,
      voiceoverPath: voiceoverFilePath,
      settings,
      outputPath,
      videoAssetId: options.videoAssetId,
      musicAssetId: options.musicAssetId,
    });

    if (voiceoverFilePath && fs.existsSync(voiceoverFilePath)) {
      fs.unlinkSync(voiceoverFilePath);
      voiceoverFilePath = null;
    }

    let fbReelId: string | null = null;
    let finalStatus: 'rendered' | 'published' = 'rendered';
    let updatedProverb = proverb;

    if (options.mode === 'publish') {
      const caption = `${proverb.text_bn}\n\nঅর্থ: ${proverb.meaning_bn}\n\n${settings.reel_hashtags}`;
      const fbResult = await publishFacebookReel({
        pageId: settings.fb_page_id,
        pageAccessToken: settings.fb_page_access_token,
        videoFilePath: outputPath,
        description: caption,
      });

      fbReelId = fbResult.videoId;
      finalStatus = 'published';

      updatedProverb = await patchProverb(proverb.id, {
        status: 'posted',
        posted_at: new Date().toISOString(),
        fb_post_id: fbReelId,
        last_error: null,
      });

      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
      updateSettings({ last_run_at: new Date().toISOString() });
    }

    const durationMs = Date.now() - startedAt;

    await updateRenderLog(
      log.id,
      {
        status: finalStatus,
        tts_provider: tts.providerUsed,
        video_asset: rendered.videoAssetName,
        music_asset: rendered.musicAssetName,
        output_filename: options.mode === 'preview' ? outputFilename : null,
        fb_reel_id: fbReelId,
        duration_ms: durationMs,
      },
      options.mode === 'publish'
    );

    return {
      logId: log.id,
      proverb: updatedProverb,
      mode: options.mode,
      status: finalStatus,
      outputFilename: options.mode === 'preview' ? outputFilename : null,
      previewUrl: options.mode === 'preview' ? `/api/previews/${outputFilename}` : null,
      fbReelId,
      durationMs,
      ttsProvider: tts.providerUsed,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - startedAt;

    if (voiceoverFilePath && fs.existsSync(voiceoverFilePath)) {
      fs.unlinkSync(voiceoverFilePath);
    }
    if (options.mode === 'publish' && fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }

    await updateRenderLog(
      log.id,
      {
        status: 'failed',
        error_message: message,
        duration_ms: durationMs,
      },
      options.mode === 'publish'
    );

    if (options.mode === 'publish') {
      try {
        await patchProverb(proverb.id, { last_error: message });
      } catch (patchErr) {
        console.warn('[scheduler] Failed updating proverb error in store:', patchErr);
      }
    }

    throw err;
  } finally {
    isPipelineRunning = false;
  }
}

export function reloadCronScheduler(): { active: boolean; expression: string; timezone: string } {
  if (activeTask) {
    activeTask.stop();
    activeTask = null;
  }

  const settings = getSettings();
  const enabled = settings.cron_enabled === 'true';
  const expression = settings.cron_expression || '0 9 * * *';
  const timezone = settings.cron_timezone || 'Asia/Dhaka';

  if (!enabled) {
    return { active: false, expression, timezone };
  }

  const validExpr = cron.validate(expression) ? expression : '0 9 * * *';
  if (!cron.validate(expression)) {
    console.warn(`[scheduler] Invalid cron expression "${expression}". Falling back to 0 9 * * *.`);
  }

  activeTask = cron.schedule(
    validExpr,
    async () => {
      console.log(`[scheduler] Triggering daily Bengali Proverb Reel job (${validExpr} ${timezone})...`);
      try {
        const res = await runReelPipeline({ mode: 'publish' });
        console.log(`[scheduler] Published proverb #${res.proverb.id} -> FB Reel ID: ${res.fbReelId}`);
      } catch (err) {
        console.error('[scheduler] Daily Reel automation error:', err);
      }
    },
    { timezone }
  );

  return { active: true, expression: validExpr, timezone };
}
