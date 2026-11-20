import { Film, Loader2, Play, Send, Sparkles, Volume2 } from 'lucide-react';
import { useState } from 'react';
import type { ProverbItem, StudioSettings } from '../types';

const BACKDROP_OPTIONS = [
  {
    id: 'river',
    label: 'নদীর ভোর',
    src: '/src/assets/images/bg_bengal_river_dawn_1795015373281.jpg',
  },
  {
    id: 'bamboo',
    label: 'বর্ষার বাঁশবন',
    src: '/src/assets/images/bg_monsoon_bamboo_mist_1795015373345.jpg',
  },
];

const RAFU_FOLK_LOGO_SRC = '/assets/brand/rafu-folk-logo.svg';

interface ReelStagePreviewProps {
  proverb: ProverbItem | null;
  settings: StudioSettings | null;
  previewUrl: string | null;
  ffmpegAvailable: boolean;
  isRendering: boolean;
  isPublishing: boolean;
  onRenderPreview: (proverbId?: number) => void;
  onPublishNow: (proverbId?: number) => void;
}

export function ReelStagePreview({
  proverb,
  settings,
  previewUrl,
  ffmpegAvailable,
  isRendering,
  isPublishing,
  onRenderPreview,
  onPublishNow,
}: ReelStagePreviewProps) {
  const [backdropIdx, setBackdropIdx] = useState(0);
  const [viewMode, setViewMode] = useState<'stage' | 'mp4'>(previewUrl ? 'mp4' : 'stage');
  const [imgError, setImgError] = useState(false);

  const overlayOpacity = Math.max(
    0.15,
    Math.min(0.85, parseFloat(settings?.overlay_opacity || '0.54') || 0.54)
  );
  const textColor = settings?.text_color || '#FFFFFF';
  const meaningColor = settings?.meaning_color || '#FACC15';
  const activeBackdrop = BACKDROP_OPTIONS[backdropIdx];

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">৯:১৬ রিলস প্রিভিউ স্টেজ</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            ফেইসবুক রিলস সেফ-জোন · ১০৮০×১৯২০
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('stage')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              viewMode === 'stage'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            লাইভ ডিজাইন
          </button>
          <button
            type="button"
            onClick={() => setViewMode('mp4')}
            disabled={!previewUrl}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
              viewMode === 'mp4'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            রেন্ডার্ড MP4
          </button>
        </div>
      </div>

      {/* 9:16 Vertical Stage Container */}
      <div className="mx-auto w-full max-w-[270px] aspect-[9/16] rounded-xl overflow-hidden border border-slate-200 bg-slate-900 relative flex items-center justify-center">
        {viewMode === 'mp4' && previewUrl ? (
          <video
            key={previewUrl}
            src={previewUrl}
            controls
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <>
            {!imgError ? (
              <img
                src={activeBackdrop.src}
                alt={activeBackdrop.label}
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-b from-slate-800 via-slate-900 to-emerald-950" />
            )}

            {/* Measured Scrim Overlay */}
            <div
              className="absolute inset-0 transition-opacity duration-200"
              style={{ backgroundColor: `rgba(0, 0, 0, ${overlayOpacity})` }}
            />

            {/* Proverb Typography Layer */}
            <div className="relative z-10 px-6 pr-9 text-center flex flex-col items-center gap-3">
              {proverb ? (
                <>
                  <span className="text-[11px] font-medium tracking-wide text-slate-300">
                    {proverb.category || 'বাংলা প্রবাদ'}
                  </span>
                  <p
                    className="text-lg font-bold leading-snug drop-shadow-md"
                    style={{ color: textColor }}
                  >
                    “{proverb.text_bn}”
                  </p>
                  <div className="w-10 h-px bg-white/30" />
                  <p
                    className="text-xs font-medium leading-relaxed drop-shadow-sm"
                    style={{ color: meaningColor }}
                  >
                    {proverb.meaning_bn}
                  </p>
                </>
              ) : (
                <p className="text-xs text-slate-300">
                  প্রিভিউ দেখার জন্য কিউতে অন্তত একটি প্রবাদ যোগ করুন।
                </p>
              )}
            </div>

            <div className="absolute bottom-7 inset-x-0 flex justify-center z-10 pointer-events-none">
              <span className="reel-watermark-logo w-[62%] max-w-[170px]" aria-label="RAFU FOLK">
                <img src={RAFU_FOLK_LOGO_SRC} alt="RAFU FOLK" className="relative block h-auto w-full opacity-80" />
              </span>
            </div>
          </>
        )}
      </div>

      {/* Backdrop Switcher for Live Preview */}
      {viewMode === 'stage' && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>ব্যাকগ্রাউন্ড দৃশ্য</span>
          <div className="flex items-center gap-1.5">
            {BACKDROP_OPTIONS.map((bg, i) => (
              <button
                key={bg.id}
                type="button"
                onClick={() => {
                  setImgError(false);
                  setBackdropIdx(i);
                }}
                className={`px-2 py-1 rounded border text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  backdropIdx === i
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {bg.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Voice Script Preview */}
      {proverb && (
        <div className="border-t border-slate-100 pt-3 text-xs text-slate-600 flex items-start gap-2">
          <Volume2 className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <span className="font-medium text-slate-700">ভয়েস স্ক্রিপ্ট: </span>
            “{proverb.text_bn.replace(/[।.]+$/, '')}। এর অর্থ হলো:{' '}
            {proverb.meaning_bn.replace(/[।.]+$/, '')}।”
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2.5 pt-1">
        <button
          type="button"
          onClick={() => {
            onRenderPreview(proverb?.id);
            setViewMode('mp4');
          }}
          disabled={!proverb || isRendering || isPublishing || !ffmpegAvailable}
          title={
            !ffmpegAvailable
              ? 'এই সার্ভারে FFmpeg নেই; GitHub Actions-এ ভিডিও অটো-রেন্ডার হবে'
              : 'টেস্ট MP4 প্রিভিউ রেন্ডার করুন'
          }
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          {isRendering ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : previewUrl ? (
            <Play className="w-3.5 h-3.5" />
          ) : (
            <Film className="w-3.5 h-3.5" />
          )}
          {isRendering ? 'রেন্ডার হচ্ছে...' : 'MP4 প্রিভিউ'}
        </button>

        <button
          type="button"
          onClick={() => onPublishNow(proverb?.id)}
          disabled={!proverb || isRendering || isPublishing || !ffmpegAvailable}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          {isPublishing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
          {isPublishing ? 'পোস্ট হচ্ছে...' : 'এখনই পাবলিশ'}
        </button>
      </div>

      {!ffmpegAvailable && (
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
          এই প্রিভিউ এনভায়রনমেন্টে FFmpeg ইন্সটল নেই, তাই লাইভ স্টেজ প্রিভিউ চালু আছে। GitHub Actions-এ প্রতিদিন অটোমেটিক FFmpeg + Noto Sans Bengali দিয়ে MP4 ভিডিও তৈরি হবে।
        </p>
      )}
    </div>
  );
}
