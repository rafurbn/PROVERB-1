import fs from 'fs';
import path from 'path';
import type {
  AutomationSettings,
  MediaAssetItem,
  ProverbItem,
  ProverbStatus,
  RenderLogItem,
  StorageMode,
} from '../types.ts';
import {
  addGoogleSheetProverb,
  appendGoogleSheetLog,
  bulkAddGoogleSheetProverbs,
  deleteGoogleSheetProverb,
  fetchGoogleSheetLogs,
  fetchGoogleSheetProverbs,
  updateGoogleSheetProverb,
} from './googleSheets.ts';

const STORAGE_DIR = path.resolve(process.cwd(), 'storage');
export const DIRS = {
  storage: STORAGE_DIR,
  videos: path.join(STORAGE_DIR, 'videos'),
  music: path.join(STORAGE_DIR, 'music'),
  previews: path.join(STORAGE_DIR, 'previews'),
  temp: path.join(STORAGE_DIR, 'temp'),
};

for (const dir of Object.values(DIRS)) {
  fs.mkdirSync(dir, { recursive: true });
}

const STORE_PATH = path.join(STORAGE_DIR, 'studio-store.json');

interface LocalStoreData {
  nextProverbId: number;
  nextMediaId: number;
  nextLogId: number;
  proverbs: ProverbItem[];
  mediaAssets: MediaAssetItem[];
  renderLogs: RenderLogItem[];
  settings: AutomationSettings;
}

const INITIAL_PROVERBS: Array<{ text_bn: string; meaning_bn: string; category: string }> = [
  {
    text_bn: 'অল্প বিদ্যা ভয়ংকরী',
    meaning_bn: 'আংশিক বা অসম্পূর্ণ জ্ঞান অনেক সময় বিপদের কারণ হয়ে দাঁড়ায়।',
    category: 'জ্ঞান ও শিক্ষা',
  },
  {
    text_bn: 'দশে মিলে করি কাজ, হারি জিতি নাহি লাজ',
    meaning_bn: 'একসাথে মিলেমিশে কাজ করলে সাফল্য আসে এবং ব্যর্থতাতেও গ্লানি থাকে না।',
    category: 'একতা',
  },
  {
    text_bn: 'সময়ের এক ফোঁড়, অসময়ের দশ ফোঁড়',
    meaning_bn: 'সঠিক সময়ে ছোট উদ্যোগ নিলে ভবিষ্যতের বড় ঝামেলা এড়ানো যায়।',
    category: 'সময়ানুবর্তিতা',
  },
  {
    text_bn: 'যেমন কর্ম তেমন ফল',
    meaning_bn: 'মানুষ তার নিজের কাজের অনুরূপ ফলাফলই ভোগ করে।',
    category: 'কর্মফল',
  },
  {
    text_bn: 'যত গর্জে তত বর্ষে না',
    meaning_bn: 'যারা বেশি বড় বড় কথা বলে, তারা কাজের সময় তেমন কিছু করতে পারে না।',
    category: 'আচরণ',
  },
  {
    text_bn: 'নানা মুনির নানা মত',
    meaning_bn: 'ভিন্ন ভিন্ন মানুষের চিন্তাভাবনা ও মতামত আলাদা হয়ে থাকে।',
    category: 'জীবনদর্শন',
  },
  {
    text_bn: 'চকচক করলেই সোনা হয় না',
    meaning_bn: 'বাইরের চাকচিক্য দেখে সবসময় ভেতরের আসল গুণ বিচার করা যায় না।',
    category: 'বাস্তবতা',
  },
  {
    text_bn: 'অতি লোভে তাঁতি নষ্ট',
    meaning_bn: 'অতিরিক্ত লোভ করতে গেলে হাতের পাওয়া জিনিসও হারাতে হয়।',
    category: 'সতর্কতা',
  },
  {
    text_bn: 'এক হাতে তালি বাজে না',
    meaning_bn: 'কোনো বিবাদ বা সমস্যার জন্য সাধারণত দুই পক্ষেরই দায় থাকে।',
    category: 'সম্পর্ক',
  },
  {
    text_bn: 'সৎ সঙ্গে স্বর্গবাস, অসৎ সঙ্গে সর্বনাশ',
    meaning_bn: 'ভালো মানুষের সঙ্গ জীবনকে উন্নত করে, আর খারাপ সঙ্গ ধ্বংস ডেকে আনে।',
    category: 'নীতিবাক্য',
  },
  {
    text_bn: 'পরিশ্রমই সৌভাগ্যের প্রসূতি',
    meaning_bn: 'কঠোর পরিশ্রমের মাধ্যমেই জীবনে প্রকৃত সাফল্য ও সৌভাগ্য আসে।',
    category: 'উদ্যম',
  },
  {
    text_bn: 'বিপদে ধৈর্য ধারণ করাই প্রকৃত বীরত্ব',
    meaning_bn: 'কঠিন সময়ে শান্ত থেকে পরিস্থিতি সামাল দেওয়াই মানুষের বড় গুণ।',
    category: 'সাহস',
  },
];

function getDefaultSettings(): AutomationSettings {
  return {
    google_sheet_api_url: process.env.GOOGLE_SHEET_API_URL?.trim() || '',
    cron_expression: process.env.DAILY_CRON_SCHEDULE || '0 9 * * *',
    cron_timezone: process.env.CRON_TIMEZONE || 'Asia/Dhaka',
    cron_enabled: 'true',
    tts_provider: 'edge-tts',
    tts_voice: 'bn-BD-NabanitaNeural',
    music_volume: '0.15',
    overlay_opacity: '0.54',
    text_color: '#FFFFFF',
    meaning_color: '#FACC15',
    fb_page_id:
      process.env.FB_PAGE_ID && process.env.FB_PAGE_ID !== 'YOUR_FACEBOOK_PAGE_ID'
        ? process.env.FB_PAGE_ID.trim()
        : '',
    // Never persisted to studio-store.json — always sourced from the environment.
    fb_page_access_token:
      process.env.FB_PAGE_ACCESS_TOKEN &&
      process.env.FB_PAGE_ACCESS_TOKEN !== 'YOUR_LONG_LIVED_PAGE_ACCESS_TOKEN'
        ? process.env.FB_PAGE_ACCESS_TOKEN.trim()
        : '',
    reel_hashtags: '#বাংলাপ্রবাদ #BengaliProverbs #BanglaQuotes #Reels',
    last_run_at: '',
  };
}

function createInitialStore(): LocalStoreData {
  const now = new Date().toISOString();
  return {
    nextProverbId: INITIAL_PROVERBS.length + 1,
    nextMediaId: 1,
    nextLogId: 1,
    proverbs: INITIAL_PROVERBS.map((item, idx) => ({
      id: idx + 1,
      text_bn: item.text_bn,
      meaning_bn: item.meaning_bn,
      category: item.category,
      status: 'pending',
      posted_at: null,
      fb_post_id: null,
      last_error: null,
      created_at: now,
    })),
    mediaAssets: [],
    renderLogs: [],
    settings: getDefaultSettings(),
  };
}

function readLocalStore(): LocalStoreData {
  if (!fs.existsSync(STORE_PATH)) {
    const init = createInitialStore();
    writeLocalStore(init);
    return init;
  }
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<LocalStoreData> & { settings?: Partial<AutomationSettings> };
    const defaults = getDefaultSettings();
    const mergedSettings: AutomationSettings = {
      ...defaults,
      ...(parsed.settings || {}),
    };
    if (!mergedSettings.google_sheet_api_url && defaults.google_sheet_api_url) {
      mergedSettings.google_sheet_api_url = defaults.google_sheet_api_url;
    }
    if (!mergedSettings.fb_page_id && defaults.fb_page_id) {
      mergedSettings.fb_page_id = defaults.fb_page_id;
    }
    // The token is env-only; drop any legacy plaintext copy left in the JSON file.
    mergedSettings.fb_page_access_token = defaults.fb_page_access_token;
    return {
      nextProverbId: parsed.nextProverbId || (parsed.proverbs?.length || 0) + 1,
      nextMediaId: parsed.nextMediaId || (parsed.mediaAssets?.length || 0) + 1,
      nextLogId: parsed.nextLogId || (parsed.renderLogs?.length || 0) + 1,
      proverbs: Array.isArray(parsed.proverbs) ? parsed.proverbs : [],
      mediaAssets: Array.isArray(parsed.mediaAssets) ? parsed.mediaAssets : [],
      renderLogs: Array.isArray(parsed.renderLogs) ? parsed.renderLogs : [],
      settings: mergedSettings,
    };
  } catch (err) {
    const backupPath = `${STORE_PATH}.corrupt-${Date.now()}`;
    try {
      fs.copyFileSync(STORE_PATH, backupPath);
      console.error(
        `[store] studio-store.json is unreadable; original kept at ${backupPath}. Resetting local store.`,
        err
      );
    } catch (copyErr) {
      console.error('[store] studio-store.json is unreadable and backup failed:', copyErr);
    }
    const init = createInitialStore();
    writeLocalStore(init);
    return init;
  }
}

function writeLocalStore(data: LocalStoreData): void {
  // Persist secrets-free data only: the Facebook token lives in .env, never on disk.
  const safe: LocalStoreData = {
    ...data,
    settings: { ...data.settings, fb_page_access_token: '' },
  };
  const tmpPath = `${STORE_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(safe, null, 2), 'utf-8');
  fs.renameSync(tmpPath, STORE_PATH);
}

export function getSettings(): AutomationSettings {
  return readLocalStore().settings;
}

export function updateSettings(partial: Partial<AutomationSettings>): AutomationSettings {
  const store = readLocalStore();
  const next: AutomationSettings = { ...store.settings };
  for (const [k, v] of Object.entries(partial)) {
    if (v !== undefined) {
      (next as unknown as Record<string, string>)[k] = String(v);
    }
  }
  store.settings = next;
  writeLocalStore(store);
  // Return the live view (env token in place) even though it is not written to disk.
  return { ...next, fb_page_access_token: getDefaultSettings().fb_page_access_token };
}

export function getStorageMode(): { mode: StorageMode; sheetUrl: string } {
  const sheetUrl = getSettings().google_sheet_api_url.trim();
  return {
    mode: sheetUrl ? 'google-sheets' : 'local-json',
    sheetUrl,
  };
}

// --- Proverbs Operations (Auto-routes to Google Sheets when configured) ---
export async function listProverbs(): Promise<{ proverbs: ProverbItem[]; mode: StorageMode }> {
  const { mode, sheetUrl } = getStorageMode();
  if (mode === 'google-sheets') {
    const proverbs = await fetchGoogleSheetProverbs(sheetUrl);
    return { proverbs, mode };
  }
  return { proverbs: readLocalStore().proverbs, mode };
}

export async function getProverbById(id: number): Promise<ProverbItem | undefined> {
  const { proverbs } = await listProverbs();
  return proverbs.find((p) => p.id === id);
}

export async function getNextPendingProverb(): Promise<ProverbItem | undefined> {
  const { proverbs } = await listProverbs();
  return proverbs
    .filter((p) => p.status === 'pending')
    .sort((a, b) => a.id - b.id)[0];
}

export async function createProverb(input: {
  text_bn: string;
  meaning_bn: string;
  category: string;
}): Promise<ProverbItem> {
  const { mode, sheetUrl } = getStorageMode();
  if (mode === 'google-sheets') {
    return addGoogleSheetProverb(sheetUrl, input);
  }
  const store = readLocalStore();
  const item: ProverbItem = {
    id: store.nextProverbId++,
    text_bn: input.text_bn.trim(),
    meaning_bn: input.meaning_bn.trim(),
    category: input.category.trim() || 'প্রজ্ঞা',
    status: 'pending',
    posted_at: null,
    fb_post_id: null,
    last_error: null,
    created_at: new Date().toISOString(),
  };
  store.proverbs.push(item);
  writeLocalStore(store);
  return item;
}

export async function bulkCreateProverbs(
  items: Array<{ text_bn: string; meaning_bn: string; category: string }>
): Promise<{ inserted: number; skippedDuplicates: number }> {
  const { mode, sheetUrl } = getStorageMode();
  if (mode === 'google-sheets') {
    return bulkAddGoogleSheetProverbs(sheetUrl, items);
  }
  const store = readLocalStore();
  const existing = new Set(store.proverbs.map((p) => p.text_bn.trim()));
  let inserted = 0;
  let skippedDuplicates = 0;
  const now = new Date().toISOString();

  for (const item of items) {
    const t = item.text_bn.trim();
    if (existing.has(t)) {
      skippedDuplicates++;
      continue;
    }
    existing.add(t);
    store.proverbs.push({
      id: store.nextProverbId++,
      text_bn: t,
      meaning_bn: item.meaning_bn.trim(),
      category: item.category.trim() || 'প্রজ্ঞা',
      status: 'pending',
      posted_at: null,
      fb_post_id: null,
      last_error: null,
      created_at: now,
    });
    inserted++;
  }
  writeLocalStore(store);
  return { inserted, skippedDuplicates };
}

export async function patchProverb(
  id: number,
  updates: Partial<{
    text_bn: string;
    meaning_bn: string;
    category: string;
    status: ProverbStatus;
    posted_at: string | null;
    fb_post_id: string | null;
    last_error: string | null;
  }>
): Promise<ProverbItem> {
  const { mode, sheetUrl } = getStorageMode();
  if (mode === 'google-sheets') {
    return updateGoogleSheetProverb(sheetUrl, id, updates);
  }
  const store = readLocalStore();
  const idx = store.proverbs.findIndex((p) => p.id === id);
  if (idx === -1) {
    throw new Error('Proverb not found.');
  }
  const existing = store.proverbs[idx];
  const nextStatus = updates.status ?? existing.status;
  const updated: ProverbItem = {
    ...existing,
    text_bn: updates.text_bn !== undefined ? updates.text_bn.trim() : existing.text_bn,
    meaning_bn: updates.meaning_bn !== undefined ? updates.meaning_bn.trim() : existing.meaning_bn,
    category: updates.category !== undefined ? updates.category.trim() : existing.category,
    status: nextStatus,
    posted_at:
      updates.posted_at !== undefined
        ? updates.posted_at
        : nextStatus === 'pending'
          ? null
          : existing.posted_at,
    fb_post_id:
      updates.fb_post_id !== undefined
        ? updates.fb_post_id
        : nextStatus === 'pending'
          ? null
          : existing.fb_post_id,
    last_error:
      updates.last_error !== undefined
        ? updates.last_error
        : nextStatus === 'pending'
          ? null
          : existing.last_error,
  };
  store.proverbs[idx] = updated;
  writeLocalStore(store);
  return updated;
}

export async function removeProverb(id: number): Promise<void> {
  const { mode, sheetUrl } = getStorageMode();
  if (mode === 'google-sheets') {
    await deleteGoogleSheetProverb(sheetUrl, id);
    return;
  }
  const store = readLocalStore();
  store.proverbs = store.proverbs.filter((p) => p.id !== id);
  writeLocalStore(store);
}

export async function syncLocalProverbsToSheet(): Promise<{
  inserted: number;
  skippedDuplicates: number;
}> {
  const { mode, sheetUrl } = getStorageMode();
  if (mode !== 'google-sheets') {
    throw new Error('Google Sheet Apps Script URL is not configured yet.');
  }
  const store = readLocalStore();
  return bulkAddGoogleSheetProverbs(sheetUrl, store.proverbs);
}

// --- Media Assets Operations ---
export function listMediaAssets(): MediaAssetItem[] {
  const store = readLocalStore();
  return [...store.mediaAssets].sort((a, b) => a.is_default - b.is_default || b.id - a.id);
}

export function getMediaAssetById(id: number): MediaAssetItem | undefined {
  return readLocalStore().mediaAssets.find((m) => m.id === id);
}

export function addMediaAsset(input: Omit<MediaAssetItem, 'id' | 'created_at'>): MediaAssetItem {
  const store = readLocalStore();
  const existing = store.mediaAssets.find((m) => m.filename === input.filename);
  if (existing) return existing;

  const created: MediaAssetItem = {
    ...input,
    id: store.nextMediaId++,
    created_at: new Date().toISOString(),
  };
  store.mediaAssets.push(created);
  writeLocalStore(store);
  return created;
}

export function removeMediaAsset(id: number): MediaAssetItem | undefined {
  const store = readLocalStore();
  const target = store.mediaAssets.find((m) => m.id === id);
  if (!target) return undefined;
  store.mediaAssets = store.mediaAssets.filter((m) => m.id !== id);
  writeLocalStore(store);
  return target;
}

// --- Render Logs ---
export async function listRenderLogs(limit = 30): Promise<RenderLogItem[]> {
  const localLogs = [...readLocalStore().renderLogs].sort((a, b) => b.id - a.id);
  const { mode, sheetUrl } = getStorageMode();
  if (mode === 'google-sheets') {
    const remoteLogs = await fetchGoogleSheetLogs(sheetUrl);
    const merged = [...localLogs];
    for (const log of remoteLogs) {
      const dup =
        merged.some((l) => l.id === log.id) ||
        merged.some(
          (l) =>
            l.created_at === log.created_at &&
            l.proverb_id === log.proverb_id &&
            l.mode === log.mode
        );
      if (!dup) merged.push(log);
    }
    merged.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '') || b.id - a.id);
    return merged.slice(0, limit);
  }
  return localLogs.slice(0, limit);
}

export function createRenderLog(input: {
  proverb_id: number | null;
  proverb_text: string;
  mode: 'preview' | 'publish';
  tts_provider: string;
}): RenderLogItem {
  const store = readLocalStore();
  const log: RenderLogItem = {
    id: store.nextLogId++,
    proverb_id: input.proverb_id,
    proverb_text: input.proverb_text,
    mode: input.mode,
    status: 'rendering',
    tts_provider: input.tts_provider,
    video_asset: null,
    music_asset: null,
    output_filename: null,
    fb_reel_id: null,
    error_message: null,
    duration_ms: null,
    created_at: new Date().toISOString(),
  };
  store.renderLogs.push(log);
  if (store.renderLogs.length > 100) {
    store.renderLogs = store.renderLogs.slice(-100);
  }
  writeLocalStore(store);
  return log;
}

export async function updateRenderLog(
  id: number,
  updates: Partial<RenderLogItem>,
  syncToSheet = false
): Promise<void> {
  const store = readLocalStore();
  const idx = store.renderLogs.findIndex((l) => l.id === id);
  if (idx !== -1) {
    store.renderLogs[idx] = { ...store.renderLogs[idx], ...updates };
    writeLocalStore(store);
    if (syncToSheet) {
      const { mode, sheetUrl } = getStorageMode();
      if (mode === 'google-sheets') {
        const finalLog = store.renderLogs[idx];
        await appendGoogleSheetLog(sheetUrl, {
          proverb_id: finalLog.proverb_id,
          proverb_text: finalLog.proverb_text,
          mode: finalLog.mode,
          status: finalLog.status,
          tts_provider: finalLog.tts_provider,
          video_asset: finalLog.video_asset,
          music_asset: finalLog.music_asset,
          fb_reel_id: finalLog.fb_reel_id,
          error_message: finalLog.error_message,
          duration_ms: finalLog.duration_ms,
        });
      }
    }
  }
}
