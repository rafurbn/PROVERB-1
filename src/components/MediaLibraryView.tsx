import { Film, Loader2, Music, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import type { MediaAssetItem } from '../types';

interface MediaLibraryViewProps {
  assets: MediaAssetItem[];
  ffmpegAvailable: boolean;
  onUploadMedia: (file: File, type: 'video' | 'music') => Promise<void>;
  onDeleteMedia: (id: number) => Promise<void>;
}

const BUILTIN_BACKDROPS = [
  {
    title: 'বাংলার ভোরের নদী (৯:১৬)',
    subtitle: 'স্বয়ংক্রিয় স্লো-জুম লুপ · ১০৮০×১৯২০',
    src: '/src/assets/images/bg_bengal_river_dawn_1795015373281.jpg',
  },
  {
    title: 'বর্ষার বাঁশবন ও কুয়াশা (৯:১৬)',
    subtitle: 'স্বয়ংক্রিয় স্লো-জুম লুপ · ১০৮০×১৯২০',
    src: '/src/assets/images/bg_monsoon_bamboo_mist_1795015373345.jpg',
  },
];

export function MediaLibraryView({
  assets,
  ffmpegAvailable,
  onUploadMedia,
  onDeleteMedia,
}: MediaLibraryViewProps) {
  const [uploadingType, setUploadingType] = useState<'video' | 'music' | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>, type: 'video' | 'music') => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingType(type);
    try {
      await onUploadMedia(file, type);
    } finally {
      setUploadingType(null);
      e.target.value = '';
    }
  };

  const videos = assets.filter((a) => a.type === 'video');
  const music = assets.filter((a) => a.type === 'music');

  return (
    <div className="space-y-6">
      {/* Upload Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">ব্যাকগ্রাউন্ড ভিডিও ও আবহ সংগীত</h2>
          <p className="text-xs text-slate-500 mt-1">
            রিলস তৈরির সময় এখান থেকে র‍্যান্ডমভাবে একটি প্রকৃতির ভিডিও ও শান্ত মিউজিক নির্বাচন করা হয়। GitHub Actions-এ স্থায়ী রাখতে ফাইলগুলো রেপোতেও রাখতে পারেন।
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <input
            ref={videoInputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            onChange={(e) => handleFile(e, 'video')}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => videoInputRef.current?.click()}
            disabled={uploadingType !== null}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-slate-300 bg-white text-slate-800 rounded-lg hover:bg-slate-50 disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            {uploadingType === 'video' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            ভিডিও আপলোড (MP4)
          </button>

          <input
            ref={musicInputRef}
            type="file"
            accept="audio/mpeg,audio/wav,audio/mp3,audio/*"
            onChange={(e) => handleFile(e, 'music')}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => musicInputRef.current?.click()}
            disabled={uploadingType !== null}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            {uploadingType === 'music' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Music className="w-3.5 h-3.5" />
            )}
            মিউজিক আপলোড (MP3/WAV)
          </button>
        </div>
      </div>

      {/* Default 9:16 Scene Templates */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">বিল্ট-ইন বাংলার প্রকৃতি ব্যাকড্রপ (সোর্স ইমেজ)</h3>
          <span className="text-xs text-slate-500">
            {ffmpegAvailable ? 'FFmpeg ক্লিপ জেনারেটর সক্রিয়' : 'GitHub Actions-এ অটো-রেন্ডার হবে'}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {BUILTIN_BACKDROPS.map((b) => (
            <div key={b.title} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="aspect-[9/16] max-h-64 w-full bg-slate-900 overflow-hidden">
                <img
                  src={b.src}
                  alt={b.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-3.5">
                <p className="text-xs font-semibold text-slate-900">{b.title}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{b.subtitle}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Rendered/Uploaded Videos */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <Film className="w-4 h-4 text-slate-500" />
          ভিডিও লাইব্রেরি ({videos.length})
        </h3>
        {videos.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-6 text-xs text-slate-500">
            এখনো কোনো MP4 ভিডিও ক্লিপ আপলোড বা জেনারেট হয়নি। কাস্টম MP4 আপলোড করুন অথবা GitHub Actions-এ বিল্ট-ইন প্রকৃতির ছবি থেকে অটো-ভিডিও তৈরি হবে।
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {videos.map((v) => (
              <div key={v.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <video src={v.url} controls className="w-full aspect-video bg-slate-900 object-cover" />
                <div className="p-3.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-900 truncate">{v.original_name}</p>
                    <p className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                      {v.duration_sec.toFixed(1)}s · {(v.file_size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteMedia(v.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Music Tracks */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <Music className="w-4 h-4 text-slate-500" />
          আবহ সংগীত ({music.length})
        </h3>
        {music.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-6 text-xs text-slate-500">
            কোনো অডিও ট্র্যাক নেই। শান্ত বাঁশি, তানপুরা বা দোতারার কপিরাইট-ফ্রি MP3 আপলোড করতে পারেন।
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {music.map((m) => (
              <div
                key={m.id}
                className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 truncate">{m.original_name}</p>
                    <p className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                      {m.duration_sec.toFixed(1)}s · {(m.file_size / 1024).toFixed(0)} KB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteMedia(m.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <audio src={m.url} controls className="w-full h-8" />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
