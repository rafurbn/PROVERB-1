import { Check, CheckCircle2, Copy, FileSpreadsheet, GitBranch, Loader2, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';

interface AutomationSetupViewProps {
  currentSheetUrl: string;
  googleSheetConnected: boolean;
  onSaveAndTestSheet: (url: string) => Promise<{ sheetName: string; totalProverbs: number }>;
  onSyncLocalToSheet: () => Promise<{ inserted: number; skippedDuplicates: number }>;
}

const REQUIRED_SECRETS = [
  {
    name: 'GOOGLE_SHEET_API_URL',
    desc: 'Google Apps Script Web App URL (https://script.google.com/macros/s/.../exec)',
  },
  {
    name: 'FB_PAGE_ID',
    desc: 'আপনার Facebook Page-এর নিউমেরিক ID',
  },
  {
    name: 'FB_PAGE_ACCESS_TOKEN',
    desc: 'Long-lived / Never-expiring Page Access Token (pages_manage_posts পারমিশনসহ)',
  },
  {
    name: 'ELEVENLABS_API_KEY',
    desc: 'ঐচ্ছিক — Edge TTS ও Google TTS-এর পাশাপাশি প্রিমিয়াম ভয়েস ফলব্যাকের জন্য',
  },
];

export function AutomationSetupView({
  currentSheetUrl,
  googleSheetConnected,
  onSaveAndTestSheet,
  onSyncLocalToSheet,
}: AutomationSetupViewProps) {
  const [sheetUrl, setSheetUrl] = useState(currentSheetUrl);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [testInfo, setTestInfo] = useState<string | null>(null);
  const [appsScriptCode, setAppsScriptCode] = useState('');
  const [workflowYaml, setWorkflowYaml] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    setSheetUrl(currentSheetUrl);
  }, [currentSheetUrl]);

  useEffect(() => {
    fetch('/api/sheets/apps-script')
      .then((r) => r.json())
      .then((d) => {
        setAppsScriptCode(d.appsScript || '');
        setWorkflowYaml(d.workflowYaml || '');
      })
      .catch(() => {});
  }, []);

  const copyText = async (key: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setTesting(true);
    setTestInfo(null);
    try {
      const res = await onSaveAndTestSheet(sheetUrl);
      setTestInfo(`সংযুক্ত হয়েছে: "${res.sheetName}" (${res.totalProverbs}টি প্রবাদ)`);
    } finally {
      setTesting(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await onSyncLocalToSheet();
      setTestInfo(`সিঙ্ক সম্পন্ন: ${res.inserted}টি নতুন যোগ হয়েছে, ${res.skippedDuplicates}টি ডুপ্লিকেট বাদ।`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Step 1: Connect Google Sheet URL */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              ১. Google Sheets কানেকশন (ফ্রি স্থায়ী ডাটাবেস)
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              ফ্রি সার্ভারে প্রবাদ ডিলিট হওয়া স্থায়ীভাবে বন্ধ করতে আপনার Google Sheet-এর Apps Script Web App URL যুক্ত করুন।
            </p>
          </div>
          {googleSheetConnected && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 shrink-0">
              <CheckCircle2 className="w-4 h-4" />
              Google Sheet সক্রিয়
            </span>
          )}
        </div>

        <form onSubmit={handleTest} className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="url"
            required
            value={sheetUrl}
            onChange={(e) => setSheetUrl(e.target.value)}
            placeholder="https://script.google.com/macros/s/.../exec"
            className="flex-1 px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:border-slate-900"
          />
          <button
            type="submit"
            disabled={testing || !sheetUrl.trim()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
          >
            {testing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            সেভ ও কানেকশন টেস্ট
          </button>
          {googleSheetConnected && (
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-slate-300 bg-white text-slate-800 rounded-lg hover:bg-slate-50 disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
            >
              {syncing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              লোকাল প্রবাদ শীটে পাঠান
            </button>
          )}
        </form>

        {testInfo && (
          <p className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3.5 py-2">
            {testInfo}
          </p>
        )}
      </section>

      {/* Step 2: Copy Apps Script */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              ২. Google Sheet-এ Apps Script বসানোর নিয়ম
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              নতুন Google Sheet খুলুন → Extensions → Apps Script → নিচের কোড পেস্ট করে Deploy → New deployment → Web app (Execute as: Me, Who has access: Anyone) সিলেক্ট করে URL কপি করুন।
            </p>
          </div>
          <button
            type="button"
            onClick={() => copyText('gs', appsScriptCode)}
            disabled={!appsScriptCode}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg bg-white text-slate-800 hover:bg-slate-50 cursor-pointer whitespace-nowrap shrink-0"
          >
            {copiedKey === 'gs' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedKey === 'gs' ? 'কপি হয়েছে' : 'Code.gs কপি করুন'}
          </button>
        </div>

        <pre className="bg-slate-950 text-slate-100 text-xs font-mono p-4 rounded-lg overflow-x-auto max-h-64 leading-relaxed">
          {appsScriptCode || 'Loading Apps Script...'}
        </pre>
      </section>

      {/* Step 3: GitHub Actions Zero-Cost Automation */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-slate-700" />
              ৩. GitHub Actions ফ্রি অটো-পাবলিশিং (সার্ভার স্পেইস ছাড়াই)
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              এই প্রজেক্টের <code className="font-mono text-slate-700">.github/workflows/daily-reel.yml</code> ফাইলটি প্রতিদিন বাংলাদেশ সময় সকাল ৯টায় অটো চলবে (৭GB RAM + FFmpeg + Noto Sans Bengali ফন্ট)।
            </p>
          </div>
          <button
            type="button"
            onClick={() => copyText('yml', workflowYaml)}
            disabled={!workflowYaml}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg bg-white text-slate-800 hover:bg-slate-50 cursor-pointer whitespace-nowrap shrink-0"
          >
            {copiedKey === 'yml' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedKey === 'yml' ? 'কপি হয়েছে' : 'Workflow YAML কপি করুন'}
          </button>
        </div>

        <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
          <div className="px-4 py-2.5 bg-slate-50 text-xs font-medium text-slate-700">
            GitHub Repository → Settings → Secrets and variables → Actions-এ নিচের Secret গুলো যোগ করুন:
          </div>
          {REQUIRED_SECRETS.map((sec) => (
            <div key={sec.name} className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
              <code className="font-mono font-semibold text-slate-900">{sec.name}</code>
              <span className="text-slate-600">{sec.desc}</span>
            </div>
          ))}
        </div>

        <pre className="bg-slate-950 text-slate-100 text-xs font-mono p-4 rounded-lg overflow-x-auto max-h-64 leading-relaxed">
          {workflowYaml || 'Loading GitHub Actions YAML...'}
        </pre>
      </section>
    </div>
  );
}
