import type { ProverbItem, ProverbStatus, RenderLogItem } from '../types.ts';

function ensureValidUrl(apiUrl: string): string {
  const trimmed = apiUrl.trim();
  if (!trimmed) {
    throw new Error('Google Sheet Apps Script URL is not configured.');
  }
  if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec/i.test(trimmed)) {
    throw new Error(
      'Invalid Google Apps Script URL. It should look like https://script.google.com/macros/s/.../exec'
    );
  }
  return trimmed;
}

async function parseAppsScriptJson<T>(res: Response): Promise<T> {
  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`Google Sheets HTTP ${res.status}: ${raw.slice(0, 240)}`);
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    if (raw.includes('<!DOCTYPE') || raw.includes('ServiceLogin')) {
      throw new Error(
        'Google Apps Script returned an HTML login page. Redeploy the Web App with "Who has access: Anyone".'
      );
    }
    throw new Error(`Unexpected Google Sheets response: ${raw.slice(0, 200)}`);
  }
}

export async function testGoogleSheetConnection(apiUrl: string): Promise<{
  ok: boolean;
  sheetName: string;
  totalProverbs: number;
}> {
  const base = ensureValidUrl(apiUrl);
  const sep = base.includes('?') ? '&' : '?';
  const res = await fetch(`${base}${sep}action=ping`, {
    method: 'GET',
    redirect: 'follow',
  });
  const data = await parseAppsScriptJson<{
    ok?: boolean;
    sheetName?: string;
    totalProverbs?: number;
    error?: string;
  }>(res);
  if (!data.ok) {
    throw new Error(data.error || 'Google Sheet ping failed.');
  }
  return {
    ok: true,
    sheetName: data.sheetName || 'Google Sheet',
    totalProverbs: Number(data.totalProverbs || 0),
  };
}

export async function fetchGoogleSheetProverbs(apiUrl: string): Promise<ProverbItem[]> {
  const base = ensureValidUrl(apiUrl);
  const sep = base.includes('?') ? '&' : '?';
  const res = await fetch(`${base}${sep}action=list`, {
    method: 'GET',
    redirect: 'follow',
  });
  const data = await parseAppsScriptJson<{
    ok?: boolean;
    proverbs?: ProverbItem[];
    error?: string;
  }>(res);
  if (!data.ok || !Array.isArray(data.proverbs)) {
    throw new Error(data.error || 'Failed to read proverbs from Google Sheet.');
  }
  return data.proverbs;
}

export async function fetchGoogleSheetLogs(apiUrl: string): Promise<RenderLogItem[]> {
  const base = ensureValidUrl(apiUrl);
  const sep = base.includes('?') ? '&' : '?';
  const res = await fetch(`${base}${sep}action=logs`, {
    method: 'GET',
    redirect: 'follow',
  });
  const data = await parseAppsScriptJson<{
    ok?: boolean;
    logs?: RenderLogItem[];
    error?: string;
  }>(res);
  if (!data.ok || !Array.isArray(data.logs)) {
    return [];
  }
  return data.logs;
}

export async function addGoogleSheetProverb(
  apiUrl: string,
  input: { text_bn: string; meaning_bn: string; category: string }
): Promise<ProverbItem> {
  const base = ensureValidUrl(apiUrl);
  const res = await fetch(base, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action: 'add',
      text_bn: input.text_bn,
      meaning_bn: input.meaning_bn,
      category: input.category,
    }),
  });
  const data = await parseAppsScriptJson<{
    ok?: boolean;
    proverb?: ProverbItem;
    error?: string;
  }>(res);
  if (!data.ok || !data.proverb) {
    throw new Error(data.error || 'Failed to add proverb to Google Sheet.');
  }
  return data.proverb;
}

export async function bulkAddGoogleSheetProverbs(
  apiUrl: string,
  items: Array<{
    text_bn: string;
    meaning_bn: string;
    category: string;
    status?: ProverbStatus;
    posted_at?: string | null;
    fb_post_id?: string | null;
    created_at?: string;
  }>
): Promise<{ inserted: number; skippedDuplicates: number }> {
  const base = ensureValidUrl(apiUrl);
  const res = await fetch(base, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action: 'bulk_add',
      items,
    }),
  });
  const data = await parseAppsScriptJson<{
    ok?: boolean;
    inserted?: number;
    skippedDuplicates?: number;
    error?: string;
  }>(res);
  if (!data.ok) {
    throw new Error(data.error || 'Failed bulk upload to Google Sheet.');
  }
  return {
    inserted: Number(data.inserted || 0),
    skippedDuplicates: Number(data.skippedDuplicates || 0),
  };
}

export async function updateGoogleSheetProverb(
  apiUrl: string,
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
  const base = ensureValidUrl(apiUrl);
  const res = await fetch(base, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action: 'update',
      id,
      ...updates,
    }),
  });
  const data = await parseAppsScriptJson<{
    ok?: boolean;
    proverb?: ProverbItem;
    error?: string;
  }>(res);
  if (!data.ok || !data.proverb) {
    throw new Error(data.error || 'Failed to update proverb in Google Sheet.');
  }
  return data.proverb;
}

export async function deleteGoogleSheetProverb(apiUrl: string, id: number): Promise<void> {
  const base = ensureValidUrl(apiUrl);
  const res = await fetch(base, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action: 'delete',
      id,
    }),
  });
  const data = await parseAppsScriptJson<{ ok?: boolean; error?: string }>(res);
  if (!data.ok) {
    throw new Error(data.error || 'Failed to delete proverb from Google Sheet.');
  }
}

export async function appendGoogleSheetLog(
  apiUrl: string,
  log: Omit<RenderLogItem, 'id' | 'created_at' | 'output_filename'>
): Promise<void> {
  try {
    const base = ensureValidUrl(apiUrl);
    await fetch(base, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'add_log',
        ...log,
      }),
    });
  } catch (err) {
    console.warn('[googleSheets] Could not append remote log:', err);
  }
}
