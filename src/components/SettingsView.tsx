import { CheckCircle2, Loader2, Save, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { StudioSettings } from '../types';

const TIMEZONE_OPTIONS = [
  'Asia/Dhaka',
  'Asia/Kolkata',
  'Asia/Karachi',
  'Asia/Dubai',
  'Asia/Singapore',
  'Europe/London',
  'America/New_York',
  'UTC',
];

interface SettingsViewProps {
  settings: StudioSettings | null;
  onSaveSettings: (partial: Record<string, string>) => Promise<void>;
  onTestFacebook: (pageId: string, token: string) => Promise<{ pageName?: string; id?: string }>;
}

export function SettingsView({ settings, onSaveSettings, onTestFacebook }: SettingsViewProps) {
  const [form, setForm] = useState({
    text_color: '#FFFFFF',
    meaning_color: '#FACC15',
    overlay_opacity: '0.54',
    music_volume: '0.15',
    reel_hashtags: '#বাংলাপ্রবাদ #BengaliProverbs #BanglaQuotes #Reels',
    fb_page_id: '',
    cron_expression: '0 9 * * *',
    cron_timezone: 'Asia/Dhaka',
    cron_enabled: 'true',
  });
  const [saving, setSaving] = useState(false);
  const [testingFb, setTestingFb] = useState(false);
  const [fbVerifiedInfo, setFbVerifiedInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!settings) return;
    setForm((prev) => ({
      ...prev,
      text_color: settings.text_color || '#FFFFFF',
      meaning_color: settings.meaning_color || '#FACC15',
      overlay_opacity: settings.overlay_opacity || '0.54',
      music_volume: settings.music_volume || '0.15',
      reel_hashtags: settings.reel_hashtags || '',
      fb_page_id: settings.fb_page_id || '',
      cron_expression: settings.cron_expression || '0 9 * * *',
      cron_timezone: settings.cron_timezone || 'Asia/Dhaka',
      cron_enabled: settings.cron_enabled || 'true',
    }));
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, string> = {
        text_color: form.text_color,
        meaning_color: form.meaning_color,
        overlay_opacity: form.overlay_opacity,
        music_volume: form.music_volume,
        reel_hashtags: form.reel_hashtags,
        fb_page_id: form.fb_page_id,
        cron_expression: form.cron_expression,
        cron_timezone: form.cron_timezone,
        cron_enabled: form.cron_enabled,
      };
      await onSaveSettings(payload);
    } finally {
      setSaving(false);
    }
  };

  const handleTestFb = async () => {
    setTestingFb(true);
    setFbVerifiedInfo(null);
    try {
      const res = await onTestFacebook(form.fb_page_id, '');
      setFbVerifiedInfo(`সফলভাবে যাচাই হয়েছে: ${res.pageName || res.id}`);
    } finally {
      setTestingFb(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      {/* Reel Typography & Audio Mix */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">রিলস ডিজাইন ও অডিও মিক্স</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            ওভারভিউয়ের ৯:১৬ লাইভ স্টেজে পরিবর্তনগুলো সাথে সাথে দেখতে পাবেন।
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">প্রবাদের রঙ</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.text_color}
                onChange={(e) => setForm((p) => ({ ...p, text_color: e.target.value }))}
                className="w-10 h-9 rounded border border-slate-300 cursor-pointer"
              />
              <input
                type="text"
                value={form.text_color}
                onChange={(e) => setForm((p) => ({ ...p, text_color: e.target.value }))}
                className="flex-1 px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">অর্থের রঙ</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.meaning_color}
                onChange={(e) => setForm((p) => ({ ...p, meaning_color: e.target.value }))}
                className="w-10 h-9 rounded border border-slate-300 cursor-pointer"
              />
              <input
                type="text"
                value={form.meaning_color}
                onChange={(e) => setForm((p) => ({ ...p, meaning_color: e.target.value }))}
                className="flex-1 px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              ব্যাকগ্রাউন্ড ডার্ক ওভারলে ({Math.round(Number(form.overlay_opacity) * 100)}%)
            </label>
            <input
              type="range"
              min="0.2"
              max="0.8"
              step="0.02"
              value={form.overlay_opacity}
              onChange={(e) => setForm((p) => ({ ...p, overlay_opacity: e.target.value }))}
              className="w-full accent-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              আবহ সংগীতের ভলিউম ({Math.round(Number(form.music_volume) * 100)}%)
            </label>
            <input
              type="range"
              min="0"
              max="0.5"
              step="0.01"
              value={form.music_volume}
              onChange={(e) => setForm((p) => ({ ...p, music_volume: e.target.value }))}
              className="w-full accent-slate-900"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            ফেইসবুক রিলস ক্যাপশন হ্যাশট্যাগ
          </label>
          <input
            type="text"
            value={form.reel_hashtags}
            onChange={(e) => setForm((p) => ({ ...p, reel_hashtags: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
          />
        </div>
      </section>

      {/* Facebook Page Reels Credentials */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">ফেইসবুক পেজ Reels API</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              GitHub Actions-এ চালাতে এই মানগুলো GitHub Repository Secrets-এও (<code className="font-mono">FB_PAGE_ID</code> ও <code className="font-mono">FB_PAGE_ACCESS_TOKEN</code>) দেবেন।
            </p>
          </div>
          {settings?.has_fb_token && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
              টোকেন সেভ করা আছে
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Facebook Page ID</label>
            <input
              type="text"
              value={form.fb_page_id}
              onChange={(e) => setForm((p) => ({ ...p, fb_page_id: e.target.value }))}
              placeholder="যেমন: 102938475610293"
              className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Page Access Token</label>
            <div className="w-full px-3 py-2 text-sm border border-slate-200 bg-slate-50 rounded-lg text-slate-600 flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              {settings?.has_fb_token ? (
                <span className="font-mono">{settings.fb_page_access_token_masked}</span>
              ) : (
                <span>.env ফাইলে FB_PAGE_ACCESS_TOKEN সেট করুন</span>
              )}
            </div>
          </div>
        </div>

        <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 leading-relaxed">
          নিরাপত্তার জন্য টোকেন আর ড্যাশবোর্ডে বা সার্ভারের JSON-এ সেভ হয় না। সার্ভারের{' '}
          <code className="font-mono">.env</code> ফাইলে{' '}
          <code className="font-mono">FB_PAGE_ACCESS_TOKEN</code> দিয়ে দিন এবং সার্ভার রিস্টার্ট করুন।
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleTestFb}
            disabled={testingFb || !form.fb_page_id}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-slate-300 bg-white text-slate-800 rounded-lg hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
          >
            {testingFb ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
            ফেইসবুক সংযোগ যাচাই করুন
          </button>
          {fbVerifiedInfo && <span className="text-xs font-medium text-emerald-700">{fbVerifiedInfo}</span>}
        </div>
      </section>

      {/* Schedule Settings */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">সার্ভার শিডিউল সেটিংস</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            লোকাল বা ২৪/৭ সার্ভারে চালালে এই সময় অনুযায়ী অটো-পোস্ট হবে (GitHub Actions-এর সময়সূচি <code className="font-mono">daily-reel.yml</code> ফাইলে নির্ধারিত থাকে)।
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Cron Expression</label>
            <input
              type="text"
              value={form.cron_expression}
              onChange={(e) => setForm((p) => ({ ...p, cron_expression: e.target.value }))}
              className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Timezone</label>
            <select
              value={form.cron_timezone}
              onChange={(e) => setForm((p) => ({ ...p, cron_timezone: e.target.value }))}
              className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg bg-white"
            >
              {Boolean(form.cron_timezone) && !TIMEZONE_OPTIONS.includes(form.cron_timezone) && (
                <option value={form.cron_timezone}>{form.cron_timezone}</option>
              )}
              {TIMEZONE_OPTIONS.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">অটো-শিডিউলার</label>
            <select
              value={form.cron_enabled}
              onChange={(e) => setForm((p) => ({ ...p, cron_enabled: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              <option value="true">চালু (Enabled)</option>
              <option value="false">বন্ধ (Disabled)</option>
            </select>
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          সেটিংস সংরক্ষণ করুন
        </button>
      </div>
    </form>
  );
}
