import 'dotenv/config';
import { runReelPipeline } from '../server/services/scheduler.ts';
import { getStorageMode } from '../server/services/store.ts';

async function main() {
  const { mode, sheetUrl } = getStorageMode();
  const rawId = process.env.PROVERB_ID?.trim();
  const proverbId = rawId ? Number(rawId) : undefined;

  console.log(`[daily-reel] Storage mode: ${mode}${sheetUrl ? ' (Google Sheets connected)' : ''}`);

  if (mode !== 'google-sheets') {
    console.warn(
      '[daily-reel] WARNING: GOOGLE_SHEET_API_URL is not set. Running against local studio-store.json.'
    );
  }

  const result = await runReelPipeline({
    mode: 'publish',
    proverbId: Number.isFinite(proverbId) ? proverbId : undefined,
  });

  console.log(
    `[daily-reel] Published Proverb #${result.proverb.id} ("${result.proverb.text_bn}") via ${result.ttsProvider} -> FB Reel ID: ${result.fbReelId} in ${(result.durationMs / 1000).toFixed(1)}s`
  );
}

main().catch((err) => {
  console.error('[daily-reel] Fatal error:', err);
  process.exit(1);
});
