import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  Edit3,
  FileSpreadsheet,
  Film,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  Send,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useRef, useState } from 'react';
import type { ProverbItem, ProverbStatus, StorageMode } from '../types';

interface ProverbQueueViewProps {
  proverbs: ProverbItem[];
  storageMode: StorageMode;
  loading: boolean;
  ffmpegAvailable: boolean;
  isBusy: boolean;
  onRefresh: () => void;
  onOpenAddModal: () => void;
  onUpdateProverb: (
    id: number,
    updates: Partial<{ text_bn: string; meaning_bn: string; category: string; status: ProverbStatus }>
  ) => Promise<void>;
  onDeleteProverb: (id: number) => Promise<void>;
  onBulkUpload: (file: File) => Promise<void>;
  onRenderPreview: (id: number) => void;
  onPublishNow: (id: number) => void;
}

export function ProverbQueueView({
  proverbs,
  storageMode,
  loading,
  ffmpegAvailable,
  isBusy,
  onOpenAddModal,
  onUpdateProverb,
  onDeleteProverb,
  onBulkUpload,
  onRenderPreview,
  onPublishNow,
}: ProverbQueueViewProps) {
  const [filter, setFilter] = useState<'all' | ProverbStatus>('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<ProverbItem | null>(null);
  const [editForm, setEditForm] = useState({ text_bn: '', meaning_bn: '', category: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [uploadingBulk, setUploadingBulk] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = proverbs.filter((p) => {
    if (filter !== 'all' && p.status !== filter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return (
        p.text_bn.toLowerCase().includes(q) ||
        p.meaning_bn.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleBulkFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBulk(true);
    try {
      await onBulkUpload(file);
    } finally {
      setUploadingBulk(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const openEdit = (p: ProverbItem) => {
    setEditing(p);
    setEditForm({ text_bn: p.text_bn, meaning_bn: p.meaning_bn, category: p.category });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSavingEdit(true);
    try {
      await onUpdateProverb(editing.id, editForm);
      setEditing(null);
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="প্রবাদ, অর্থ বা ধরন খুঁজুন..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(
              [
                { id: 'all', label: 'সব' },
                { id: 'pending', label: 'অপেক্ষমাণ' },
                { id: 'posted', label: 'পোস্ট হয়েছে' },
                { id: 'failed', label: 'ব্যর্থ' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  filter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              const secret = sessionStorage.getItem('probad_app_secret');
              const res = await fetch('/api/proverbs/sample-csv', {
                headers: secret ? { 'X-App-Secret': secret } : undefined,
              });
              if (!res.ok) return;
              const url = URL.createObjectURL(await res.blob());
              const a = document.createElement('a');
              a.href = url;
              a.download = 'bengali-proverbs-template.csv';
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            নমুনা CSV
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleBulkFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingBulk}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            {uploadingBulk ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            CSV আপলোড
          </button>

          <button
            type="button"
            onClick={onOpenAddModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            নতুন প্রবাদ
          </button>
        </div>
      </div>

      {/* Data Source Notice */}
      <div className="flex items-center justify-between px-1 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400" />
          <span>
            স্টোরেজ উৎস:{' '}
            <strong className="font-medium text-slate-700">
              {storageMode === 'google-sheets'
                ? 'Google Sheets (ক্লাউড সিঙ্ক সক্রিয়)'
                : 'লোকাল স্টোর (অস্থায়ী — Google Sheets কানেক্ট করুন)'}
            </strong>
          </span>
        </div>
        <span className="tabular-nums font-mono">
          {filtered.length} / {proverbs.length} টি প্রবাদ
        </span>
      </div>

      {/* High-Density Proverb Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map((row) => (
              <div key={row} className="h-10 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-14 px-6 text-center">
            <p className="text-sm font-medium text-slate-800">কোনো প্রবাদ পাওয়া যায়নি</p>
            <p className="text-xs text-slate-500 mt-1">
              নতুন প্রবাদ যোগ করুন অথবা CSV ফাইল দিয়ে একসাথে শত শত প্রবাদ ইম্পোর্ট করুন।
            </p>
            <button
              type="button"
              onClick={onOpenAddModal}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              প্রথম প্রবাদ যোগ করুন
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[12px] font-medium text-slate-500">
                  <th className="py-2.5 px-4 w-14 font-mono">ID</th>
                  <th className="py-2.5 px-4">প্রবাদ ও সরল অর্থ</th>
                  <th className="py-2.5 px-4 w-36">ধরন</th>
                  <th className="py-2.5 px-4 w-36">অবস্থা</th>
                  <th className="py-2.5 px-4 text-right w-48">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 align-top font-mono text-xs text-slate-500 tabular-nums">
                      #{item.id}
                    </td>
                    <td className="py-3 px-4 align-top max-w-xl">
                      <p className="font-semibold text-slate-900 leading-snug">{item.text_bn}</p>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">{item.meaning_bn}</p>
                      {item.last_error && (
                        <p className="text-[11px] text-red-600 mt-1">ত্রুটি: {item.last_error}</p>
                      )}
                      {item.fb_post_id && (
                        <p className="text-[11px] text-slate-400 font-mono mt-1 tabular-nums">
                          FB Reel ID: {item.fb_post_id}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4 align-top text-xs text-slate-600">
                      {item.category || 'প্রজ্ঞা'}
                    </td>
                    <td className="py-3 px-4 align-top text-xs">
                      {item.status === 'posted' ? (
                        <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          পোস্ট হয়েছে
                        </span>
                      ) : item.status === 'failed' ? (
                        <span className="inline-flex items-center gap-1.5 font-medium text-red-700">
                          <AlertCircle className="w-3.5 h-3.5" />
                          ব্যর্থ
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 font-medium text-amber-700">
                          <Clock className="w-3.5 h-3.5" />
                          অপেক্ষমাণ
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 align-top">
                      <div className="flex items-center justify-end gap-1">
                        {item.status !== 'pending' && (
                          <button
                            type="button"
                            onClick={() => onUpdateProverb(item.id, { status: 'pending' })}
                            title="আবার Pending কিউতে পাঠান"
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {ffmpegAvailable && (
                          <>
                            <button
                              type="button"
                              onClick={() => onRenderPreview(item.id)}
                              disabled={isBusy}
                              title="প্রিভিউ ভিডিও তৈরি করুন"
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md cursor-pointer disabled:opacity-40"
                            >
                              <Film className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onPublishNow(item.id)}
                              disabled={isBusy}
                              title="ফেইসবুকে পাবলিশ করুন"
                              className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-md cursor-pointer disabled:opacity-40"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          title="সম্পাদনা"
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {confirmDeleteId === item.id ? (
                          <button
                            type="button"
                            onClick={async () => {
                              await onDeleteProverb(item.id);
                              setConfirmDeleteId(null);
                            }}
                            className="px-2 py-1 text-[11px] font-medium bg-red-600 text-white rounded hover:bg-red-700 cursor-pointer whitespace-nowrap"
                          >
                            নিশ্চিত?
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(item.id)}
                            title="মুছে ফেলুন"
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">প্রবাদ সম্পাদনা (#{editing.id})</h3>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">বাংলা প্রবাদ</label>
                <input
                  type="text"
                  required
                  value={editForm.text_bn}
                  onChange={(e) => setEditForm((f) => ({ ...f, text_bn: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">সরল অর্থ</label>
                <textarea
                  required
                  rows={3}
                  value={editForm.meaning_bn}
                  onChange={(e) => setEditForm((f) => ({ ...f, meaning_bn: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">বিভাগ / ধরন</label>
                <input
                  type="text"
                  value={editForm.category}
                  onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                >
                  {savingEdit ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
