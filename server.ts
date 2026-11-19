import { parse as parseCsv } from 'csv-parse/sync';
import crypto from 'crypto';
import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { verifyFacebookCredentials } from './server/services/facebook.ts';
import { testGoogleSheetConnection } from './server/services/googleSheets.ts';
import { isAutomationBusy, reloadCronScheduler, runReelPipeline } from './server/services/scheduler.ts';
import { ensureDefaultMediaAssets, isFfmpegAvailable, probeDuration } from './server/services/seedMedia.ts';
import {
  addMediaAsset,
  bulkCreateProverbs,
  createProverb,
  DIRS,
  getSettings,
  getStorageMode,
  listMediaAssets,
  listProverbs,
  listRenderLogs,
  patchProverb,
  removeMediaAsset,
  removeProverb,
  syncLocalProverbsToSheet,
  updateSettings,
} from './server/services/store.ts';
import type { ProverbStatus } from './server/types.ts';

const PORT = Number(process.env.PORT) || 3000;
const APP_SECRET = process.env.APP_SECRET?.trim() || '';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

function timingSafeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

const uploadMedia = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const mediaType =
        req.body?.type === 'music' || file.mimetype.startsWith('audio/') ? 'music' : 'video';
      cb(null, mediaType === 'music' ? DIRS.music : DIRS.videos);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || '.bin';
      const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext.toLowerCase()}`;
      cb(null, safeName);
    },
  }),
  limits: { fileSize: 120 * 1024 * 1024 },
});

function extractProverbColumns(row: Record<string, unknown>): {
  text_bn: string;
  meaning_bn: string;
  category: string;
} | null {
  const normalized: Record<string, string> = {};
  for (const [key, val] of Object.entries(row)) {
    normalized[key.trim().toLowerCase()] = String(val ?? '').trim();
  }

  const text_bn =
    normalized['text_bn'] ||
    normalized['proverb'] ||
    normalized['proverb_bn'] ||
    normalized['bangla_proverb'] ||
    normalized['প্রবাদ'] ||
    normalized['প্রবাদ-প্রবচন'] ||
    Object.values(normalized)[0] ||
    '';

  const meaning_bn =
    normalized['meaning_bn'] ||
    normalized['meaning'] ||
    normalized['explanation'] ||
    normalized['অর্থ'] ||
    normalized['সরল অর্থ'] ||
    Object.values(normalized)[1] ||
    '';

  const category =
    normalized['category'] ||
    normalized['tag'] ||
    normalized['topic'] ||
    normalized['ধরন'] ||
    normalized['বিষয়'] ||
    'প্রজ্ঞা';

  if (!text_bn || !meaning_bn) return null;
  return { text_bn, meaning_bn, category: category || 'প্রজ্ঞা' };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // --- Authentication guard for every /api route (healthcheck stays public) ---
  if (!APP_SECRET) {
    if (IS_PRODUCTION) {
      throw new Error(
        'APP_SECRET is required in production. Set APP_SECRET in .env so that nobody can publish or edit proverbs without permission.'
      );
    }
    console.warn(
      '[security] APP_SECRET is not set. API is unprotected — this is only acceptable on localhost.'
    );
  }
  const publicPaths = new Set(['/health', '/cron/publish']);
  app.use('/api', (req, res, next) => {
    if (!APP_SECRET || publicPaths.has(req.path)) {
      next();
      return;
    }
    const provided = String(req.header('x-app-secret') || '').trim();
    if (!provided || !timingSafeEqualString(provided, APP_SECRET)) {
      res.status(401).json({ error: 'Unauthorized: missing or invalid X-App-Secret header.' });
      return;
    }
    next();
  });

  void ensureDefaultMediaAssets();
  let schedulerStatus = reloadCronScheduler();

  // --- Healthcheck ---
  app.get('/api/health', async (_req, res) => {
    const ffmpegAvailable = await isFfmpegAvailable();
    const { mode } = getStorageMode();
    res.json({ ok: true, storageMode: mode, ffmpegAvailable });
  });

  // --- Overview & Dashboard Summary ---
  app.get('/api/overview', async (_req, res) => {
    try {
      await ensureDefaultMediaAssets();
      const { proverbs, mode: storageMode } = await listProverbs();
      const media = listMediaAssets();
      const logs = await listRenderLogs(10);
      const settings = getSettings();
      const ffmpegAvailable = await isFfmpegAvailable();

      const counts = {
        total: proverbs.length,
        pending: proverbs.filter((p) => p.status === 'pending').length,
        posted: proverbs.filter((p) => p.status === 'posted').length,
        failed: proverbs.filter((p) => p.status === 'failed').length,
      };

      const mediaCounts = {
        videos: media.filter((m) => m.type === 'video' && fs.existsSync(m.file_path)).length,
        music: media.filter((m) => m.type === 'music' && fs.existsSync(m.file_path)).length,
      };

      const nextPending =
        proverbs.filter((p) => p.status === 'pending').sort((a, b) => a.id - b.id)[0] || null;

      const latestPreviewRow = logs.find(
        (l) => l.mode === 'preview' && l.status === 'rendered' && l.output_filename
      );

      res.json({
        storageMode,
        googleSheetConnected: storageMode === 'google-sheets',
        ffmpegAvailable,
        counts,
        mediaCounts,
        nextPending,
        latestPreview:
          latestPreviewRow &&
          latestPreviewRow.output_filename &&
          fs.existsSync(path.join(DIRS.previews, latestPreviewRow.output_filename))
            ? {
                ...latestPreviewRow,
                previewUrl: `/api/previews/${latestPreviewRow.output_filename}`,
              }
            : null,
        recentLogs: logs.slice(0, 8),
        scheduler: {
          ...schedulerStatus,
          lastRunAt: settings.last_run_at || null,
          isBusy: isAutomationBusy(),
        },
        credentials: {
          elevenLabsConfigured: Boolean(
            process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID
          ),
          facebookConfigured: Boolean(settings.fb_page_id && settings.fb_page_access_token),
          ttsProvider: 'edge-tts',
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed loading dashboard overview.';
      res.status(500).json({ error: message });
    }
  });

  // --- Proverbs CRUD & Bulk CSV/Excel Upload ---
  app.get('/api/proverbs', async (req, res) => {
    try {
      const status = String(req.query.status || 'all');
      const search = String(req.query.q || '').trim().toLowerCase();
      const { proverbs: all, mode: storageMode } = await listProverbs();

      let rows = [...all];
      if (status !== 'all' && ['pending', 'posted', 'failed'].includes(status)) {
        rows = rows.filter((r) => r.status === status);
      }
      if (search) {
        rows = rows.filter(
          (r) =>
            r.text_bn.toLowerCase().includes(search) ||
            r.meaning_bn.toLowerCase().includes(search) ||
            r.category.toLowerCase().includes(search)
        );
      }

      rows.sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        return a.id - b.id;
      });

      res.json({ proverbs: rows, storageMode });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed loading proverbs.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/proverbs', async (req, res) => {
    const text_bn = String(req.body?.text_bn || '').trim();
    const meaning_bn = String(req.body?.meaning_bn || '').trim();
    const category = String(req.body?.category || 'প্রজ্ঞা').trim() || 'প্রজ্ঞা';

    if (!text_bn || !meaning_bn) {
      res.status(400).json({ error: 'বাংলা প্রবাদ এবং এর সরল অর্থ উভয়ই দিতে হবে।' });
      return;
    }

    try {
      const created = await createProverb({ text_bn, meaning_bn, category });
      res.status(201).json({ proverb: created });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed adding proverb.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/proverbs/bulk', uploadMemory.single('file'), async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'অনুগ্রহ করে একটি CSV (.csv) ফাইল আপলোড করুন।' });
      return;
    }

    try {
      const ext = path.extname(req.file.originalname).toLowerCase();
      if (ext !== '.csv') {
        res.status(400).json({
          error:
            'শুধু CSV (.csv) ফাইল সমর্থিত। Excel থেকে "Save as → CSV UTF-8" করে আপলোড করুন।',
        });
        return;
      }

      const content = req.file.buffer.toString('utf-8').replace(/^\uFEFF/, '');
      const rawRows = parseCsv(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as Array<Record<string, unknown>>;

      const parsedItems = rawRows
        .map(extractProverbColumns)
        .filter((item): item is NonNullable<typeof item> => item !== null);

      if (parsedItems.length === 0) {
        res.status(400).json({
          error:
            'ফাইলে কোনো সঠিক প্রবাদ পাওয়া যায়নি। কলামের নাম "text_bn" (বা "proverb") এবং "meaning_bn" (বা "meaning") রাখুন।',
        });
        return;
      }

      const result = await bulkCreateProverbs(parsedItems);
      res.json({
        inserted: result.inserted,
        skippedDuplicates: result.skippedDuplicates,
        totalProcessed: parsedItems.length,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed parsing bulk upload file.';
      res.status(400).json({ error: message });
    }
  });

  app.get('/api/proverbs/sample-csv', (_req, res) => {
    const csvRows = [
      'text_bn,meaning_bn,category',
      '"অতি চালাকের গলায় দড়ি","অতিরিক্ত চতুরতা করতে গেলে মানুষ নিজেই বিপদে পড়ে।","সতর্কতা"',
      '"আপন ভালো তো জগৎ ভালো","নিজে সৎ ও ভালো হলে চারপাশের পৃথিবীও সুন্দর মনে হয়।","জীবনদর্শন"',
      '"ঘর পোড়া গরু সিঁদুরে মেঘ দেখলে ভয় পায়","একবার বিপদে পড়লে মানুষ সামান্য লক্ষণ দেখেই আতঙ্কিত হয়।","অভিজ্ঞতা"',
    ];
    const bom = '\uFEFF';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="bengali-proverbs-template.csv"');
    res.send(bom + csvRows.join('\n'));
  });

  app.patch('/api/proverbs/:id', async (req, res) => {
    const id = Number(req.params.id);
    try {
      const updates: Partial<{
        text_bn: string;
        meaning_bn: string;
        category: string;
        status: ProverbStatus;
      }> = {};
      if (req.body?.text_bn !== undefined) updates.text_bn = String(req.body.text_bn).trim();
      if (req.body?.meaning_bn !== undefined) updates.meaning_bn = String(req.body.meaning_bn).trim();
      if (req.body?.category !== undefined) updates.category = String(req.body.category).trim();
      if (req.body?.status && ['pending', 'posted', 'failed'].includes(req.body.status)) {
        updates.status = req.body.status;
      }

      const updated = await patchProverb(id, updates);
      res.json({ proverb: updated });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed updating proverb.';
      res.status(400).json({ error: message });
    }
  });

  app.delete('/api/proverbs/:id', async (req, res) => {
    const id = Number(req.params.id);
    try {
      await removeProverb(id);
      res.json({ deleted: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed deleting proverb.';
      res.status(500).json({ error: message });
    }
  });

  // --- Google Sheets Integration Endpoints ---
  app.post('/api/sheets/test', async (req, res) => {
    const url = String(req.body?.url || getSettings().google_sheet_api_url || '').trim();
    try {
      const result = await testGoogleSheetConnection(url);
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Google Sheet connection test failed.';
      res.status(400).json({ error: message });
    }
  });

  app.post('/api/sheets/sync-up', async (_req, res) => {
    try {
      const result = await syncLocalProverbsToSheet();
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed syncing local proverbs to sheet.';
      res.status(400).json({ error: message });
    }
  });

  app.get('/api/sheets/apps-script', (_req, res) => {
    const gsPath = path.resolve(process.cwd(), 'scripts/google-apps-script.gs');
    const ymlPath = path.resolve(process.cwd(), '.github/workflows/daily-reel.yml');
    res.json({
      appsScript: fs.existsSync(gsPath) ? fs.readFileSync(gsPath, 'utf-8') : '',
      workflowYaml: fs.existsSync(ymlPath) ? fs.readFileSync(ymlPath, 'utf-8') : '',
    });
  });

  // --- Media Assets Library ---
  app.get('/api/media', async (_req, res) => {
    await ensureDefaultMediaAssets();
    const assets = listMediaAssets();
    const ffmpegAvailable = await isFfmpegAvailable();
    res.json({
      ffmpegAvailable,
      assets: assets.map((a) => ({
        ...a,
        url: `/api/media/file/${a.type}/${encodeURIComponent(a.filename)}`,
      })),
    });
  });

  app.post('/api/media/upload', uploadMedia.single('file'), async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'No media file received.' });
      return;
    }

    const mediaType: 'video' | 'music' =
      req.body?.type === 'music' || req.file.mimetype.startsWith('audio/') ? 'music' : 'video';
    const duration = (await probeDuration(req.file.path)) ?? 0;

    const asset = addMediaAsset({
      type: mediaType,
      filename: req.file.filename,
      original_name: req.file.originalname,
      file_path: req.file.path,
      duration_sec: duration,
      file_size: req.file.size,
      is_default: 0,
    });

    res.status(201).json({
      asset: {
        ...asset,
        url: `/api/media/file/${asset.type}/${encodeURIComponent(asset.filename)}`,
      },
    });
  });

  app.get('/api/media/file/:type/:filename', (req, res) => {
    const { type, filename } = req.params;
    const baseDir = type === 'music' ? DIRS.music : DIRS.videos;
    const safeFile = path.basename(filename);
    const fullPath = path.join(baseDir, safeFile);
    if (!fs.existsSync(fullPath)) {
      res.status(404).send('Media not found');
      return;
    }
    res.sendFile(fullPath);
  });

  app.delete('/api/media/:id', (req, res) => {
    const id = Number(req.params.id);
    const asset = removeMediaAsset(id);
    if (!asset) {
      res.status(404).json({ error: 'Asset not found.' });
      return;
    }
    if (fs.existsSync(asset.file_path)) {
      fs.unlinkSync(asset.file_path);
    }
    res.json({ deleted: true });
  });

  // --- Preview Video Streaming ---
  app.get('/api/previews/:filename', (req, res) => {
    const safeFile = path.basename(req.params.filename);
    const fullPath = path.join(DIRS.previews, safeFile);
    if (!fs.existsSync(fullPath)) {
      res.status(404).send('Preview video not found');
      return;
    }
    res.sendFile(fullPath);
  });

  // --- Automation Settings & Scheduler ---
  app.get('/api/settings', (_req, res) => {
    const s = getSettings();
    res.json({
      settings: {
        ...s,
        fb_page_access_token_masked: s.fb_page_access_token
          ? `${s.fb_page_access_token.slice(0, 6)}••••••••${s.fb_page_access_token.slice(-4)}`
          : '',
        has_fb_token: Boolean(s.fb_page_access_token),
        fb_page_access_token: undefined,
      },
      envStatus: {
        edgeTtsVoice: 'bn-BD-NabanitaNeural',
        googleTtsFallback: true,
        elevenLabsConfigured: Boolean(process.env.ELEVENLABS_API_KEY?.trim()),
        elevenLabsVoiceConfigured: Boolean(process.env.ELEVENLABS_VOICE_ID?.trim()),
        fbTokenConfigured: Boolean(process.env.FB_PAGE_ACCESS_TOKEN?.trim()),
        appSecretConfigured: Boolean(APP_SECRET),
      },
      scheduler: schedulerStatus,
    });
  });

  app.put('/api/settings', (req, res) => {
    const body = req.body || {};
    const updates: Record<string, string> = {};

    const allowedKeys = [
      'google_sheet_api_url',
      'cron_expression',
      'cron_timezone',
      'cron_enabled',
      'music_volume',
      'overlay_opacity',
      'text_color',
      'meaning_color',
      'fb_page_id',
      'reel_hashtags',
    ];

    for (const k of allowedKeys) {
      if (body[k] !== undefined) {
        updates[k] = String(body[k]).trim();
      }
    }

    if (typeof body.fb_page_access_token === 'string' && body.fb_page_access_token.trim()) {
      res.status(400).json({
        error:
          'নিরাপত্তার জন্য Page Access Token এখন শুধু .env ফাইলের FB_PAGE_ACCESS_TOKEN থেকে পড়া হয়। ড্যাশবোর্ড থেকে টোকেন সেভ করা বন্ধ করা হয়েছে।',
      });
      return;
    }

    const updated = updateSettings(updates);
    schedulerStatus = reloadCronScheduler();

    res.json({
      settings: {
        ...updated,
        fb_page_access_token_masked: updated.fb_page_access_token
          ? `${updated.fb_page_access_token.slice(0, 6)}••••••••${updated.fb_page_access_token.slice(-4)}`
          : '',
        has_fb_token: Boolean(updated.fb_page_access_token),
        fb_page_access_token: undefined,
      },
      scheduler: schedulerStatus,
    });
  });

  app.post('/api/settings/test-fb', async (req, res) => {
    const s = getSettings();
    const pageId = String(req.body?.fb_page_id || s.fb_page_id || '').trim();
    const token = String(req.body?.fb_page_access_token || '').trim();
    try {
      const verified = await verifyFacebookCredentials(pageId, token);
      res.json(verified);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Facebook verification failed.';
      res.status(400).json({ error: message });
    }
  });

  // --- Video Engine & Publishing Pipeline ---
  app.post('/api/pipeline/preview', async (req, res) => {
    try {
      const proverbId = req.body?.proverbId ? Number(req.body.proverbId) : undefined;
      const videoAssetId = req.body?.videoAssetId ? Number(req.body.videoAssetId) : undefined;
      const musicAssetId = req.body?.musicAssetId ? Number(req.body.musicAssetId) : undefined;

      const result = await runReelPipeline({
        mode: 'preview',
        proverbId,
        videoAssetId,
        musicAssetId,
      });
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Preview rendering failed.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/pipeline/publish', async (req, res) => {
    try {
      const proverbId = req.body?.proverbId ? Number(req.body.proverbId) : undefined;
      const result = await runReelPipeline({
        mode: 'publish',
        proverbId,
      });
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Facebook Reels publishing failed.';
      res.status(500).json({ error: message });
    }
  });

  // --- External Cron Webhook (Optional for cron-job.org if hosting Express server) ---
  app.post('/api/cron/publish', async (req, res) => {
    const expected = process.env.CRON_SECRET?.trim();
    if (!expected) {
      res.status(503).json({ error: 'CRON_SECRET is not configured on the server.' });
      return;
    }
    const provided = String(
      req.headers['x-cron-secret'] || req.query.secret || req.body?.secret || ''
    ).trim();
    if (!provided || !timingSafeEqualString(provided, expected)) {
      res.status(401).json({ error: 'Unauthorized cron trigger.' });
      return;
    }
    try {
      const result = await runReelPipeline({ mode: 'publish' });
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Cron pipeline execution failed.';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/logs', async (_req, res) => {
    try {
      const logs = await listRenderLogs(30);
      res.json({
        logs: logs.map((l) => ({
          ...l,
          previewUrl:
            l.output_filename && fs.existsSync(path.join(DIRS.previews, l.output_filename))
              ? `/api/previews/${l.output_filename}`
              : null,
        })),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed loading logs.';
      res.status(500).json({ error: message });
    }
  });

  // --- Vite Dev Middleware / Static Prod Serving ---
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Probad Studio server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
