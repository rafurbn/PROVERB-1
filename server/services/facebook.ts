import fs from 'fs';

const GRAPH_API_VERSION = 'v21.0';

export interface PublishReelParams {
  pageId: string;
  pageAccessToken: string;
  videoFilePath: string;
  description: string;
}

export interface PublishReelResult {
  videoId: string;
  success: boolean;
}

async function parseGraphJson<T>(res: Response, phase: string): Promise<T> {
  const raw = await res.text();
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`Meta Graph API (${phase}) HTTP ${res.status}: ${raw.slice(0, 240)}`);
  }
}

export async function verifyFacebookCredentials(
  pageId: string,
  pageAccessToken: string
): Promise<{ valid: boolean; pageName?: string; id?: string }> {
  if (!pageId.trim() || !pageAccessToken.trim()) {
    throw new Error('Both Page ID and Page Access Token are required.');
  }
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(
    pageId.trim()
  )}?fields=id,name&access_token=${encodeURIComponent(pageAccessToken.trim())}`;
  const res = await fetch(url);
  const data = await parseGraphJson<{
    id?: string;
    name?: string;
    error?: { message?: string };
  }>(res, 'verify');
  if (!res.ok || !data.id) {
    throw new Error(data.error?.message || 'Failed to verify Facebook Page credentials.');
  }
  return { valid: true, id: data.id, pageName: data.name };
}

/**
 * Publishes an MP4 vertical video as a Facebook Page Reel using the official
 * 3-phase Meta Graph API Reels Publishing Protocol:
 * 1. Initialize upload session -> GET video_id & upload_url
 * 2. Binary upload MP4 bytes to rupload.facebook.com
 * 3. Finalize & publish Reel with caption description via POST form body
 */
export async function publishFacebookReel(params: PublishReelParams): Promise<PublishReelResult> {
  const { pageId, pageAccessToken, videoFilePath, description } = params;

  if (!pageId || pageId === 'YOUR_FACEBOOK_PAGE_ID') {
    throw new Error('Facebook PAGE_ID is not configured.');
  }
  if (!pageAccessToken || pageAccessToken === 'YOUR_LONG_LIVED_PAGE_ACCESS_TOKEN') {
    throw new Error('Facebook PAGE_ACCESS_TOKEN is not configured.');
  }
  if (!fs.existsSync(videoFilePath)) {
    throw new Error(`Rendered video file not found at ${videoFilePath}`);
  }

  // Step 1: Start Upload Session
  const startUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(
    pageId
  )}/video_reels`;
  const startRes = await fetch(startUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      upload_phase: 'start',
      access_token: pageAccessToken,
    }),
  });

  const startData = await parseGraphJson<{
    video_id?: string;
    upload_url?: string;
    error?: { message?: string };
  }>(startRes, 'start');

  if (!startRes.ok || !startData.video_id || !startData.upload_url) {
    throw new Error(
      `Meta Graph API start phase failed: ${startData.error?.message || JSON.stringify(startData)}`
    );
  }

  const { video_id: videoId, upload_url: uploadUrl } = startData;

  // Step 2: Binary Video Upload
  const videoBuffer = fs.readFileSync(videoFilePath);
  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `OAuth ${pageAccessToken}`,
      offset: '0',
      file_size: String(videoBuffer.byteLength),
      'Content-Type': 'application/octet-stream',
    },
    body: videoBuffer,
  });

  const uploadData = await parseGraphJson<{
    success?: boolean;
    error?: { message?: string };
  }>(uploadRes, 'upload');

  if (!uploadRes.ok || !uploadData.success) {
    throw new Error(
      `Meta Graph API binary upload failed: ${uploadData.error?.message || JSON.stringify(uploadData)}`
    );
  }

  // Step 3: Finish & Publish Reel (send token & description safely in POST body)
  const finishBody = new URLSearchParams({
    access_token: pageAccessToken,
    video_id: videoId,
    upload_phase: 'finish',
    video_state: 'PUBLISHED',
    description,
  });

  const finishRes = await fetch(startUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: finishBody.toString(),
  });

  const finishData = await parseGraphJson<{
    success?: boolean;
    error?: { message?: string };
  }>(finishRes, 'finish');

  if (!finishRes.ok || !finishData.success) {
    throw new Error(
      `Meta Graph API finish phase failed: ${finishData.error?.message || JSON.stringify(finishData)}`
    );
  }

  return { videoId, success: true };
}
