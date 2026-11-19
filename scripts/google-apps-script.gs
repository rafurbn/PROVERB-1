/**
 * Probad Studio — Google Sheets Backend Connector (Google Apps Script)
 *
 * Setup Steps:
 * 1. Create a new Google Sheet (e.g., "Probad Studio Proverbs").
 * 2. Open Extensions -> Apps Script.
 * 3. Paste this entire code into Code.gs and Save.
 * 4. Click Deploy -> New deployment -> Select type: "Web app".
 *    - Execute as: "Me"
 *    - Who has access: "Anyone"
 * 5. Copy the Web App URL (ends with /exec) and add it to:
 *    - GitHub Repository Secret: GOOGLE_SHEET_API_URL
 *    - Or Probad Studio Dashboard -> Google Sheets & Automation Setup
 */

const SHEET_PROVERBS = 'Proverbs';
const SHEET_LOGS = 'Logs';
const PROVERB_HEADERS = [
  'id',
  'text_bn',
  'meaning_bn',
  'category',
  'status',
  'posted_at',
  'fb_post_id',
  'last_error',
  'created_at',
];
const LOG_HEADERS = [
  'id',
  'proverb_id',
  'proverb_text',
  'mode',
  'status',
  'tts_provider',
  'video_asset',
  'music_asset',
  'fb_reel_id',
  'error_message',
  'duration_ms',
  'created_at',
];

function ensureSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let proverbSheet = ss.getSheetByName(SHEET_PROVERBS);
  if (!proverbSheet) {
    proverbSheet = ss.insertSheet(SHEET_PROVERBS);
    proverbSheet.appendRow(PROVERB_HEADERS);
    proverbSheet.setFrozenRows(1);
    seedDefaultRows(proverbSheet);
  } else if (proverbSheet.getLastRow() === 0) {
    proverbSheet.appendRow(PROVERB_HEADERS);
    proverbSheet.setFrozenRows(1);
  }

  let logSheet = ss.getSheetByName(SHEET_LOGS);
  if (!logSheet) {
    logSheet = ss.insertSheet(SHEET_LOGS);
    logSheet.appendRow(LOG_HEADERS);
    logSheet.setFrozenRows(1);
  } else if (logSheet.getLastRow() === 0) {
    logSheet.appendRow(LOG_HEADERS);
    logSheet.setFrozenRows(1);
  }

  return { proverbSheet, logSheet };
}

function seedDefaultRows(sheet) {
  const now = new Date().toISOString();
  const defaults = [
    [1, 'অল্প বিদ্যা ভয়ংকরী', 'আংশিক বা অসম্পূর্ণ জ্ঞান অনেক সময় বিপদের কারণ হয়ে দাঁড়ায়।', 'জ্ঞান ও শিক্ষা', 'pending', '', '', '', now],
    [2, 'দশে মিলে করি কাজ, হারি জিতি নাহি লাজ', 'একসাথে মিলেমিশে কাজ করলে সাফল্য আসে এবং ব্যর্থতাতেও গ্লানি থাকে না।', 'একতা', 'pending', '', '', '', now],
    [3, 'সময়ের এক ফোঁড়, অসময়ের দশ ফোঁড়', 'সঠিক সময়ে ছোট উদ্যোগ নিলে ভবিষ্যতের বড় ঝামেলা এড়ানো যায়।', 'সময়ানুবর্তিতা', 'pending', '', '', '', now],
    [4, 'যেমন কর্ম তেমন ফল', 'মানুষ তার নিজের কাজের অনুরূপ ফলাফলই ভোগ করে।', 'কর্মফল', 'pending', '', '', '', now],
    [5, 'চকচক করলেই সোনা হয় না', 'বাইরের চাকচিক্য দেখে সবসময় ভেতরের আসল গুণ বিচার করা যায় না।', 'বাস্তবতা', 'pending', '', '', '', now],
    [6, 'অতি লোভে তাঁতি নষ্ট', 'অতিরিক্ত লোভ করতে গেলে হাতের পাওয়া জিনিসও হারাতে হয়।', 'সতর্কতা', 'pending', '', '', '', now],
  ];
  sheet.getRange(2, 1, defaults.length, PROVERB_HEADERS.length).setValues(defaults);
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function readRowsAsObjects(sheet, headers) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return values
    .map((row, idx) => {
      const obj = { sheet_row: idx + 2 };
      headers.forEach((h, i) => {
        obj[h] = row[i] === undefined || row[i] === null ? '' : row[i];
      });
      obj.id = Number(obj.id) || idx + 1;
      return obj;
    })
    .filter((item) => String(item.text_bn || item.proverb_text || '').trim() !== '');
}

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'list';
    const { proverbSheet, logSheet } = ensureSheets();

    if (action === 'ping') {
      const rows = readRowsAsObjects(proverbSheet, PROVERB_HEADERS);
      return jsonResponse({
        ok: true,
        sheetName: SpreadsheetApp.getActiveSpreadsheet().getName(),
        totalProverbs: rows.length,
      });
    }

    if (action === 'logs') {
      const logs = readRowsAsObjects(logSheet, LOG_HEADERS).reverse().slice(0, 30);
      return jsonResponse({ ok: true, logs });
    }

    const proverbs = readRowsAsObjects(proverbSheet, PROVERB_HEADERS).map((r) => ({
      id: Number(r.id),
      text_bn: String(r.text_bn || ''),
      meaning_bn: String(r.meaning_bn || ''),
      category: String(r.category || 'প্রজ্ঞা'),
      status: ['pending', 'posted', 'failed'].indexOf(String(r.status)) >= 0 ? String(r.status) : 'pending',
      posted_at: r.posted_at ? String(r.posted_at) : null,
      fb_post_id: r.fb_post_id ? String(r.fb_post_id) : null,
      last_error: r.last_error ? String(r.last_error) : null,
      created_at: r.created_at ? String(r.created_at) : new Date().toISOString(),
      sheet_row: r.sheet_row,
    }));

    return jsonResponse({ ok: true, proverbs });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const action = body.action || '';
    const { proverbSheet, logSheet } = ensureSheets();

    if (action === 'add') {
      const existing = readRowsAsObjects(proverbSheet, PROVERB_HEADERS);
      const maxId = existing.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0);
      const nextId = maxId + 1;
      const now = new Date().toISOString();
      const text_bn = String(body.text_bn || '').trim();
      const meaning_bn = String(body.meaning_bn || '').trim();
      const category = String(body.category || 'প্রজ্ঞা').trim() || 'প্রজ্ঞা';

      if (!text_bn || !meaning_bn) {
        return jsonResponse({ ok: false, error: 'text_bn and meaning_bn are required.' });
      }

      proverbSheet.appendRow([nextId, text_bn, meaning_bn, category, 'pending', '', '', '', now]);
      return jsonResponse({
        ok: true,
        proverb: {
          id: nextId,
          text_bn,
          meaning_bn,
          category,
          status: 'pending',
          posted_at: null,
          fb_post_id: null,
          last_error: null,
          created_at: now,
        },
      });
    }

    if (action === 'bulk_add') {
      const items = Array.isArray(body.items) ? body.items : [];
      const existing = readRowsAsObjects(proverbSheet, PROVERB_HEADERS);
      const existingTexts = new Set(existing.map((r) => String(r.text_bn).trim()));
      let maxId = existing.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0);
      const now = new Date().toISOString();

      const rowsToInsert = [];
      let skippedDuplicates = 0;

      items.forEach((item) => {
        const t = String(item.text_bn || '').trim();
        const m = String(item.meaning_bn || '').trim();
        const c = String(item.category || 'প্রজ্ঞা').trim() || 'প্রজ্ঞা';
        if (!t || !m) return;
        if (existingTexts.has(t)) {
          skippedDuplicates++;
          return;
        }
        existingTexts.add(t);
        maxId++;
        rowsToInsert.push([
          maxId,
          t,
          m,
          c,
          item.status === 'posted' ? 'posted' : 'pending',
          item.posted_at || '',
          item.fb_post_id || '',
          '',
          item.created_at || now,
        ]);
      });

      if (rowsToInsert.length > 0) {
        const startRow = proverbSheet.getLastRow() + 1;
        proverbSheet.getRange(startRow, 1, rowsToInsert.length, PROVERB_HEADERS.length).setValues(rowsToInsert);
      }

      return jsonResponse({
        ok: true,
        inserted: rowsToInsert.length,
        skippedDuplicates,
      });
    }

    if (action === 'update') {
      const id = Number(body.id);
      const existing = readRowsAsObjects(proverbSheet, PROVERB_HEADERS);
      const target = existing.find((r) => Number(r.id) === id);
      if (!target) {
        return jsonResponse({ ok: false, error: 'Proverb ID not found: ' + id });
      }

      const nextStatus = body.status !== undefined ? String(body.status) : String(target.status);
      const updatedRow = [
        id,
        body.text_bn !== undefined ? String(body.text_bn).trim() : String(target.text_bn),
        body.meaning_bn !== undefined ? String(body.meaning_bn).trim() : String(target.meaning_bn),
        body.category !== undefined ? String(body.category).trim() : String(target.category),
        nextStatus,
        body.posted_at !== undefined ? String(body.posted_at || '') : nextStatus === 'pending' ? '' : String(target.posted_at || ''),
        body.fb_post_id !== undefined ? String(body.fb_post_id || '') : nextStatus === 'pending' ? '' : String(target.fb_post_id || ''),
        body.last_error !== undefined ? String(body.last_error || '') : nextStatus === 'pending' ? '' : String(target.last_error || ''),
        String(target.created_at || new Date().toISOString()),
      ];

      proverbSheet.getRange(target.sheet_row, 1, 1, PROVERB_HEADERS.length).setValues([updatedRow]);
      return jsonResponse({
        ok: true,
        proverb: {
          id: updatedRow[0],
          text_bn: updatedRow[1],
          meaning_bn: updatedRow[2],
          category: updatedRow[3],
          status: updatedRow[4],
          posted_at: updatedRow[5] || null,
          fb_post_id: updatedRow[6] || null,
          last_error: updatedRow[7] || null,
          created_at: updatedRow[8],
        },
      });
    }

    if (action === 'delete') {
      const id = Number(body.id);
      const existing = readRowsAsObjects(proverbSheet, PROVERB_HEADERS);
      const target = existing.find((r) => Number(r.id) === id);
      if (!target) {
        return jsonResponse({ ok: false, error: 'Proverb ID not found: ' + id });
      }
      proverbSheet.deleteRow(target.sheet_row);
      return jsonResponse({ ok: true, deleted: true });
    }

    if (action === 'add_log') {
      const existingLogs = readRowsAsObjects(logSheet, LOG_HEADERS);
      const nextLogId = existingLogs.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0) + 1;
      const now = new Date().toISOString();
      logSheet.appendRow([
        nextLogId,
        body.proverb_id || '',
        body.proverb_text || '',
        body.mode || 'publish',
        body.status || 'published',
        body.tts_provider || 'edge-tts',
        body.video_asset || '',
        body.music_asset || '',
        body.fb_reel_id || '',
        body.error_message || '',
        body.duration_ms || '',
        now,
      ]);
      return jsonResponse({ ok: true, id: nextLogId });
    }

    return jsonResponse({ ok: false, error: 'Unknown action: ' + action });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    lock.releaseLock();
  }
}
