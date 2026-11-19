export type ProverbStatus = 'pending' | 'posted' | 'failed';
export type StorageMode = 'google-sheets' | 'local-json';

export interface ProverbItem {
  id: number;
  text_bn: string;
  meaning_bn: string;
  category: string;
  status: ProverbStatus;
  posted_at: string | null;
  fb_post_id: string | null;
  last_error: string | null;
  created_at: string;
}

export interface MediaAssetItem {
  id: number;
  type: 'video' | 'music';
  filename: string;
  original_name: string;
  duration_sec: number;
  file_size: number;
  is_default: number;
  url: string;
  created_at: string;
}

export interface RenderLogItem {
  id: number;
  proverb_id: number | null;
  proverb_text: string;
  mode: 'preview' | 'publish';
  status: 'rendering' | 'rendered' | 'published' | 'failed';
  tts_provider: string;
  video_asset: string | null;
  music_asset: string | null;
  output_filename: string | null;
  fb_reel_id: string | null;
  error_message: string | null;
  duration_ms: number | null;
  created_at: string;
  previewUrl?: string | null;
}

export interface StudioSettings {
  google_sheet_api_url: string;
  cron_expression: string;
  cron_timezone: string;
  cron_enabled: string;
  tts_provider: string;
  tts_voice: string;
  music_volume: string;
  overlay_opacity: string;
  text_color: string;
  meaning_color: string;
  fb_page_id: string;
  fb_page_access_token_masked: string;
  has_fb_token: boolean;
  reel_hashtags: string;
  last_run_at: string;
}

export interface OverviewData {
  storageMode: StorageMode;
  googleSheetConnected: boolean;
  ffmpegAvailable: boolean;
  counts: {
    total: number;
    pending: number;
    posted: number;
    failed: number;
  };
  mediaCounts: {
    videos: number;
    music: number;
  };
  nextPending: ProverbItem | null;
  latestPreview: (RenderLogItem & { previewUrl: string }) | null;
  recentLogs: RenderLogItem[];
  scheduler: {
    active: boolean;
    expression: string;
    timezone: string;
    lastRunAt: string | null;
    isBusy: boolean;
  };
  credentials: {
    elevenLabsConfigured: boolean;
    facebookConfigured: boolean;
    ttsProvider: string;
  };
}
