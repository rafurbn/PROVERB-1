import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  Film,
  LayoutDashboard,
  ListChecks,
  Loader2,
  Menu,
  Plus,
  RefreshCw,
  Settings,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { AutomationSetupView } from './components/AutomationSetupView';
import { MediaLibraryView } from './components/MediaLibraryView';
import { ProverbQueueView } from './components/ProverbQueueView';
import { ReelStagePreview } from './components/ReelStagePreview';
import { SettingsView } from './components/SettingsView';
import type {
  MediaAssetItem,
  OverviewData,
  ProverbItem,
  ProverbStatus,
  RenderLogItem,
  StudioSettings,
} from './types';

type ActiveTab = 'overview' | 'proverbs' | 'sheets' | 'media' | 'settings';

const SECRET_KEY = 'probad_app_secret';

/**
 * Sends an X-App-Secret header with every API call when the operator supplied
 * one at runtime (kept in sessionStorage by the unlock screen below).
 */
const appFetch = (input: string, init: RequestInit = {}): Promise<Response> => {
  const secret = sessionStorage.getItem(SECRET_KEY);
  const headers = new Headers(init.headers);
  if (secret) headers.set('X-App-Secret', secret);
  return fetch(input, { ...init, headers });
};

const NAV_ITEMS: Array<{ id: ActiveTab; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'overview', label: 'ওভারভিউ', icon: LayoutDashboard },
  { id: 'proverbs', label: 'প্রবাদ তালিকা', icon: ListChecks },
  { id: 'sheets', label: 'গুগল শীট ও অটোমেশন', icon: FileSpreadsheet },
  { id: 'media', label: 'মিডিয়া লাইব্রেরি', icon: Film },
  { id: 'settings', label: 'সেটিংস', icon: Settings },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [proverbs, setProverbs] = useState<ProverbItem[]>([]);
  const [mediaAssets, setMediaAssets] = useState<MediaAssetItem[]>([]);
  const [settings, setSettings] = useState<StudioSettings | null>(null);
  const [logs, setLogs] = useState<RenderLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [isRendering, setIsRendering] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [latestPreviewUrl, setLatestPreviewUrl] = useState<string | null>(null);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newProverb, setNewProverb] = useState({
    text_bn: '',
    meaning_bn: '',
    category: 'প্রজ্ঞা',
  });
  const [submittingProverb, setSubmittingProverb] = useState(false);

  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [needsSecret, setNeedsSecret] = useState(false);
  const [secretInput, setSecretInput] = useState('');

  const showNotice = useCallback((type: 'success' | 'error', text: string) => {
    setNotice({ type, text });
    setTimeout(() => {
      setNotice((prev) => (prev?.text === text ? null : prev));
    }, 5500);
  }, []);

  const fetchAllData = useCallback(async () => {
    try {
      const [ovRes, prRes, mdRes, stRes, lgRes] = await Promise.all([
        appFetch('/api/overview'),
        appFetch('/api/proverbs'),
        appFetch('/api/media'),
        appFetch('/api/settings'),
        appFetch('/api/logs'),
      ]);

      if (ovRes.status === 401) {
        setNeedsSecret(true);
        setLoading(false);
        return;
      }

      const [ov, pr, md, st, lg] = await Promise.all([
        ovRes.json(),
        prRes.json(),
        mdRes.json(),
        stRes.json(),
        lgRes.json(),
      ]);

      if (!ovRes.ok) throw new Error(ov.error || 'ড্যাশবোর্ড লোড করতে সমস্যা হয়েছে');
      setOverview(ov);
      setProverbs(Array.isArray(pr.proverbs) ? pr.proverbs : []);
      setMediaAssets(Array.isArray(md.assets) ? md.assets : []);
      setSettings(st.settings || null);
      setLogs(Array.isArray(lg.logs) ? lg.logs : []);
      if (ov.latestPreview?.previewUrl) {
        setLatestPreviewUrl(ov.latestPreview.previewUrl);
      }
    } catch (err) {
      showNotice('error', err instanceof Error ? err.message : 'সার্ভারের সাথে সংযোগ ব্যর্থ');
    } finally {
      setLoading(false);
    }
  }, [showNotice]);

  useEffect(() => {
    void fetchAllData();
  }, [fetchAllData]);

  const handleAddProverb = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingProverb(true);
    try {
      const res = await appFetch('/api/proverbs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProverb),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'প্রবাদ যোগ করা যায়নি');
      setNewProverb({ text_bn: '', meaning_bn: '', category: 'প্রজ্ঞা' });
      setAddModalOpen(false);
      showNotice('success', 'নতুন বাংলা প্রবাদ সফলভাবে সংরক্ষিত হয়েছে।');
      await fetchAllData();
    } catch (err) {
      showNotice('error', err instanceof Error ? err.message : 'প্রবাদ যোগ করতে ত্রুটি হয়েছে');
    } finally {
      setSubmittingProverb(false);
    }
  };

  const handleUpdateProverb = async (
    id: number,
    updates: Partial<{ text_bn: string; meaning_bn: string; category: string; status: ProverbStatus }>
  ) => {
    const res = await appFetch(`/api/proverbs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (!res.ok) {
      showNotice('error', data.error || 'আপডেট করা যায়নি');
      throw new Error(data.error);
    }
    showNotice('success', 'প্রবাদ আপডেট হয়েছে।');
    await fetchAllData();
  };

  const handleDeleteProverb = async (id: number) => {
    const res = await appFetch(`/api/proverbs/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      showNotice('error', data.error || 'মুছে ফেলা যায়নি');
      throw new Error(data.error);
    }
    showNotice('success', 'প্রবাদ মুছে ফেলা হয়েছে।');
    await fetchAllData();
  };

  const handleBulkUpload = async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await appFetch('/api/proverbs/bulk', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) {
      showNotice('error', data.error || 'ফাইল ইম্পোর্ট ব্যর্থ');
      return;
    }
    showNotice(
      'success',
      `ইম্পোর্ট সম্পন্ন: ${data.inserted}টি নতুন প্রবাদ যোগ হয়েছে (${data.skippedDuplicates}টি ডুপ্লিকেট বাদ)।`
    );
    await fetchAllData();
  };

  const handleRenderPreview = async (proverbId?: number) => {
    setIsRendering(true);
    try {
      const res = await appFetch('/api/pipeline/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proverbId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'প্রিভিউ রেন্ডার ব্যর্থ');
      if (data.previewUrl) setLatestPreviewUrl(data.previewUrl);
      showNotice('success', `MP4 প্রিভিউ তৈরি হয়েছে (${(data.durationMs / 1000).toFixed(1)}s)।`);
      await fetchAllData();
    } catch (err) {
      showNotice('error', err instanceof Error ? err.message : 'রেন্ডারিং ব্যর্থ হয়েছে');
    } finally {
      setIsRendering(false);
    }
  };

  const handlePublishNow = async (proverbId?: number) => {
    setIsPublishing(true);
    try {
      const res = await appFetch('/api/pipeline/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proverbId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ফেইসবুকে পোস্ট ব্যর্থ');
      showNotice('success', `ফেইসবুক Reels-এ পোস্ট হয়েছে! Reel ID: ${data.fbReelId}`);
      await fetchAllData();
    } catch (err) {
      showNotice('error', err instanceof Error ? err.message : 'পাবলিশ ব্যর্থ হয়েছে');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleSaveAndTestSheet = async (url: string) => {
    const testRes = await appFetch('/api/sheets/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const testData = await testRes.json();
    if (!testRes.ok) {
      showNotice('error', testData.error || 'Google Sheet কানেকশন ব্যর্থ');
      throw new Error(testData.error);
    }

    const saveRes = await appFetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ google_sheet_api_url: url }),
    });
    if (!saveRes.ok) {
      throw new Error('সেটিংস সংরক্ষণ ব্যর্থ');
    }
    showNotice('success', `Google Sheet সংযুক্ত হয়েছে: ${testData.sheetName}`);
    await fetchAllData();
    return testData;
  };

  const handleSyncLocalToSheet = async () => {
    const res = await appFetch('/api/sheets/sync-up', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      showNotice('error', data.error || 'সিঙ্ক ব্যর্থ');
      throw new Error(data.error);
    }
    showNotice('success', `${data.inserted}টি প্রবাদ Google Sheet-এ পাঠানো হয়েছে।`);
    await fetchAllData();
    return data;
  };

  const handleUploadMedia = async (file: File, type: 'video' | 'music') => {
    const fd = new FormData();
    fd.append('type', type);
    fd.append('file', file);
    const res = await appFetch('/api/media/upload', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) {
      showNotice('error', data.error || 'মিডিয়া আপলোড ব্যর্থ');
      return;
    }
    showNotice('success', 'মিডিয়া লাইব্রেরিতে ফাইল যোগ হয়েছে।');
    await fetchAllData();
  };

  const handleDeleteMedia = async (id: number) => {
    const res = await appFetch(`/api/media/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      showNotice('error', 'ফাইল মুছে ফেলা যায়নি');
      return;
    }
    showNotice('success', 'মিডিয়া ফাইল মুছে ফেলা হয়েছে।');
    await fetchAllData();
  };

  const handleSaveSettings = async (partial: Record<string, string>) => {
    const res = await appFetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partial),
    });
    const data = await res.json();
    if (!res.ok) {
      showNotice('error', data.error || 'সেটিংস সেভ হয়নি');
      throw new Error(data.error);
    }
    showNotice('success', 'সেটিংস সংরক্ষিত হয়েছে।');
    await fetchAllData();
  };

  const handleTestFacebook = async (pageId: string, token: string) => {
    const res = await appFetch('/api/settings/test-fb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fb_page_id: pageId, fb_page_access_token: token }),
    });
    const data = await res.json();
    if (!res.ok) {
      showNotice('error', data.error || 'ফেইসবুক যাচাই ব্যর্থ');
      throw new Error(data.error);
    }
    showNotice('success', `ফেইসবুক পেজ যাচাই সফল: ${data.pageName}`);
    return data;
  };

  const activeNavLabel = NAV_ITEMS.find((n) => n.id === activeTab)?.label || 'ওভারভিউ';

  if (needsSecret) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sessionStorage.setItem(SECRET_KEY, secretInput.trim());
            setNeedsSecret(false);
            setLoading(true);
            void fetchAllData();
          }}
          className="bg-white border border-slate-200 rounded-xl p-6 w-full max-w-sm space-y-4"
        >
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-slate-900" />
            <h1 className="text-base font-bold text-slate-900">Probad Studio</h1>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            এই সার্ভারে একটি অ্যাক্সেস কী সেট করা আছে। চালিয়ে যেতে সেটি দিন।
          </p>
          <input
            type="password"
            required
            autoFocus
            value={secretInput}
            onChange={(e) => setSecretInput(e.target.value)}
            placeholder="APP_SECRET"
            className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
          />
          <button
            type="submit"
            className="w-full px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            প্রবেশ করুন
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 bg-white border-r border-slate-200">
        <div className="h-16 px-5 border-b border-slate-200 flex items-center gap-2.5">
          <BookOpen className="w-5 h-5 text-slate-900 shrink-0" />
          <span className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
            Probad Studio
          </span>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 text-xs text-slate-500 space-y-1.5">
          <div className="flex items-center justify-between">
            <span>ডাটাবেস</span>
            <span className="font-medium text-slate-800">
              {overview?.googleSheetConnected ? 'Google Sheets' : 'Local JSON'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>ফেইসবুক API</span>
            <span className="font-medium text-slate-800">
              {overview?.credentials.facebookConfigured ? 'যুক্ত আছে' : 'সেট নেই'}
            </span>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-64 bg-white h-full border-r border-slate-200 flex flex-col z-10">
            <div className="h-16 px-5 border-b border-slate-200 flex items-center justify-between">
              <span className="text-base font-bold text-slate-900">Probad Studio</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-slate-500 hover:text-slate-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="p-3 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-lg cursor-pointer ${
                      active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract: Breadcrumb — Nav/Meta — Single Primary Action */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-8 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 hidden sm:inline whitespace-nowrap">Probad Studio</span>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <h1 className="font-semibold text-slate-900 truncate">{activeNavLabel}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              নতুন প্রবাদ যোগ করুন
            </button>
          </div>
        </header>

        {/* Non-blocking Notice Banner */}
        {notice && (
          <div className="px-4 sm:px-6 pt-4">
            <div
              className={`rounded-lg border px-4 py-2.5 text-xs font-medium flex items-center justify-between gap-3 ${
                notice.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              <div className="flex items-center gap-2">
                {notice.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{notice.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setNotice(null)}
                className="p-0.5 hover:opacity-70 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Viewport Content */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1320px] w-full mx-auto space-y-6">
          {activeTab === 'overview' && (
            <>
              {/* Google Sheet Connection Prompt if not connected yet */}
              {overview && !overview.googleSheetConnected && (
                <div className="bg-white border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Google Sheets এখনো যুক্ত করা হয়নি
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      সার্ভার রিস্টার্ট হলেও যেন কোনো প্রবাদ ডিলিট না হয় এবং GitHub Actions থেকে অটো-পোস্ট হয়, সেজন্য আপনার Google Sheet-টি যুক্ত করুন।
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('sheets')}
                    className="px-3.5 py-2 text-xs font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Google Sheet যুক্ত করুন
                  </button>
                </div>
              )}

              {/* 4-Column Metric Strip */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="text-xs text-slate-500">মোট প্রবাদ</p>
                  <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
                    {overview?.counts.total ?? 0}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {overview?.googleSheetConnected ? 'Google Sheets সিঙ্কড' : 'লোকাল স্টোর'}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="text-xs text-slate-500">অপেক্ষমাণ (Pending)</p>
                  <p className="text-2xl font-bold text-amber-700 font-mono tabular-nums mt-1">
                    {overview?.counts.pending ?? 0}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">দৈনিক কিউতে সারিভুক্ত</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="text-xs text-slate-500">পোস্ট সম্পন্ন (Posted)</p>
                  <p className="text-2xl font-bold text-emerald-700 font-mono tabular-nums mt-1">
                    {overview?.counts.posted ?? 0}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">Facebook Page Reels</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="text-xs text-slate-500">ব্যর্থ (Failed)</p>
                  <p className="text-2xl font-bold text-red-700 font-mono tabular-nums mt-1">
                    {overview?.counts.failed ?? 0}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">পুনরায় চেষ্টাযোগ্য</p>
                </div>
              </div>

              {/* 2-Column Main Workspace: Left Queue & Logs / Right 9:16 Reel Stage */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-7 space-y-6">
                  {/* Next Scheduled Proverb */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-base font-semibold text-slate-900">
                        পরবর্তী নির্ধারিত প্রবাদ
                      </h2>
                      <button
                        type="button"
                        onClick={() => void fetchAllData()}
                        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        রিফ্রেশ
                      </button>
                    </div>

                    {loading ? (
                      <div className="h-24 bg-slate-100 rounded-lg animate-pulse" />
                    ) : overview?.nextPending ? (
                      <div className="space-y-2.5 pt-1">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="font-mono tabular-nums">#{overview.nextPending.id}</span>
                          <span>·</span>
                          <span>{overview.nextPending.category}</span>
                          <span>·</span>
                          <span className="text-amber-700 font-medium">পরবর্তী অটো-পোস্টের জন্য প্রস্তুত</span>
                        </div>
                        <p className="text-xl font-bold text-slate-900 leading-snug">
                          “{overview.nextPending.text_bn}”
                        </p>
                        <p className="text-sm text-slate-600 leading-relaxed">
                          {overview.nextPending.meaning_bn}
                        </p>
                      </div>
                    ) : (
                      <div className="py-6 text-center text-xs text-slate-500">
                        সব প্রবাদ পোস্ট হয়ে গেছে। নতুন প্রবাদ যোগ করুন অথবা CSV আপলোড করুন।
                      </div>
                    )}

                    <div className="border-t border-slate-100 pt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                      <span>
                        ভয়েস: <strong className="text-slate-700 font-medium">bn-BD-NabanitaNeural</strong> (Google TTS ফলব্যাকসহ)
                      </span>
                      <span className="font-mono tabular-nums">
                        সকাল {overview?.scheduler.expression || '0 9 * * *'} ({overview?.scheduler.timezone || 'Asia/Dhaka'})
                      </span>
                    </div>
                  </div>

                  {/* Recent Logs */}
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-slate-900">সাম্প্রতিক রেন্ডার ও পাবলিশ লগ</h2>
                      <span className="text-xs text-slate-500 font-mono tabular-nums">
                        {logs.length} টি রেকর্ড
                      </span>
                    </div>
                    {logs.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500">
                        এখনো কোনো প্রিভিউ বা পাবলিশ রান হয়নি।
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {logs.slice(0, 6).map((log) => (
                          <div
                            key={log.id}
                            className="px-5 py-3 flex items-center justify-between gap-4 text-xs"
                          >
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900 truncate">{log.proverb_text}</p>
                              <p className="text-slate-500 mt-0.5">
                                {log.mode === 'publish' ? 'ফেইসবুক পাবলিশ' : 'MP4 প্রিভিউ'} ·{' '}
                                <span className="font-mono">{log.tts_provider}</span>
                                {log.duration_ms ? ` · ${(log.duration_ms / 1000).toFixed(1)}s` : ''}
                              </p>
                              {log.error_message && (
                                <p className="text-red-600 mt-0.5 truncate">{log.error_message}</p>
                              )}
                            </div>
                            <div className="shrink-0 text-right">
                              {log.status === 'published' ? (
                                <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  পাবলিশড
                                </span>
                              ) : log.status === 'rendered' ? (
                                <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                                  <Film className="w-3.5 h-3.5" />
                                  রেন্ডার্ড
                                </span>
                              ) : log.status === 'failed' ? (
                                <span className="inline-flex items-center gap-1 font-medium text-red-700">
                                  <AlertCircle className="w-3.5 h-3.5" />
                                  ব্যর্থ
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                                  <Clock className="w-3.5 h-3.5" />
                                  চলছে
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Live 9:16 Reel Preview Stage */}
                <div className="lg:col-span-5">
                  <ReelStagePreview
                    proverb={overview?.nextPending || proverbs[0] || null}
                    settings={settings}
                    previewUrl={latestPreviewUrl}
                    ffmpegAvailable={overview?.ffmpegAvailable ?? false}
                    isRendering={isRendering}
                    isPublishing={isPublishing}
                    onRenderPreview={handleRenderPreview}
                    onPublishNow={handlePublishNow}
                  />
                </div>
              </div>
            </>
          )}

          {activeTab === 'proverbs' && (
            <ProverbQueueView
              proverbs={proverbs}
              storageMode={overview?.storageMode || 'local-json'}
              loading={loading}
              ffmpegAvailable={overview?.ffmpegAvailable ?? false}
              isBusy={isRendering || isPublishing}
              onRefresh={() => void fetchAllData()}
              onOpenAddModal={() => setAddModalOpen(true)}
              onUpdateProverb={handleUpdateProverb}
              onDeleteProverb={handleDeleteProverb}
              onBulkUpload={handleBulkUpload}
              onRenderPreview={handleRenderPreview}
              onPublishNow={handlePublishNow}
            />
          )}

          {activeTab === 'sheets' && (
            <AutomationSetupView
              currentSheetUrl={settings?.google_sheet_api_url || ''}
              googleSheetConnected={overview?.googleSheetConnected ?? false}
              onSaveAndTestSheet={handleSaveAndTestSheet}
              onSyncLocalToSheet={handleSyncLocalToSheet}
            />
          )}

          {activeTab === 'media' && (
            <MediaLibraryView
              assets={mediaAssets}
              ffmpegAvailable={overview?.ffmpegAvailable ?? false}
              onUploadMedia={handleUploadMedia}
              onDeleteMedia={handleDeleteMedia}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              settings={settings}
              onSaveSettings={handleSaveSettings}
              onTestFacebook={handleTestFacebook}
            />
          )}
        </main>
      </div>

      {/* Add Proverb Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">নতুন বাংলা প্রবাদ যোগ করুন</h3>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddProverb} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">বাংলা প্রবাদ-প্রবচন</label>
                <input
                  type="text"
                  required
                  value={newProverb.text_bn}
                  onChange={(e) => setNewProverb((p) => ({ ...p, text_bn: e.target.value }))}
                  placeholder="যেমন: নানা মুনির নানা মত"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">সরল অর্থ (১–২ লাইন)</label>
                <textarea
                  required
                  rows={3}
                  value={newProverb.meaning_bn}
                  onChange={(e) => setNewProverb((p) => ({ ...p, meaning_bn: e.target.value }))}
                  placeholder="যেমন: ভিন্ন ভিন্ন মানুষের চিন্তাভাবনা ও মতামত আলাদা হয়ে থাকে।"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">বিভাগ / ধরন</label>
                <input
                  type="text"
                  value={newProverb.category}
                  onChange={(e) => setNewProverb((p) => ({ ...p, category: e.target.value }))}
                  placeholder="প্রজ্ঞা, নীতিবাক্য, বাস্তবতা..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={submittingProverb}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                >
                  {submittingProverb && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {overview?.googleSheetConnected ? 'Google Sheet-এ যোগ করুন' : 'যোগ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
