'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import StatsCards from '../../components/StatsCards';
import KeywordTable from '../../components/KeywordTable';
import AiVariantsModal from '../../components/AiVariantsModal';
import {
  LogOut,
  Video,
  Layers,
  Image as ImageIcon,
  Plus,
  Loader2,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  HelpCircle
} from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('image'); // 'video' | 'vector' | 'image'
  const [keywords, setKeywords] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  // New Keyword Input state
  const [inputKeywords, setInputKeywords] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processError, setProcessError] = useState('');
  const [activeJob, setActiveJob] = useState(null);

  // AI Modal state
  const [selectedKeywordForAi, setSelectedKeywordForAi] = useState(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  // Polling ref for cleanup
  const pollIntervalRef = useRef(null);

  // 1. Check Auth & Load User
  useEffect(() => {
    const initAuth = async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace('/login');
        return;
      }

      setUser(session.user);
    };

    initAuth();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace('/login');
      } else {
        setUser(session.user);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  // 2. Fetch Keywords from Supabase
  const fetchKeywords = useCallback(async (targetTab) => {
    if (!user) return;
    const cat = typeof targetTab === 'string' ? targetTab : activeTabRef.current;
    setLoadingData(true);

    try {
      const { data, error } = await supabase
        .from('keywords')
        .select('*')
        .eq('category', cat)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setKeywords(data || []);
    } catch (err) {
      console.error('[Fetch Keywords Error]:', err);
    } finally {
      setLoadingData(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchKeywords(activeTab);
    }
  }, [user, activeTab, fetchKeywords]);

  // 3. Polling Active Scraping Job
  const pollJobStatus = useCallback(
    (jobId) => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

      let pollCount = 0;
      pollIntervalRef.current = setInterval(async () => {
        pollCount++;
        try {
          const res = await fetch(`${BACKEND_URL}/api/jobs/${jobId}`);
          if (!res.ok) {
            clearInterval(pollIntervalRef.current);
            return;
          }

          const data = await res.json();
          if (data.success && data.job) {
            setActiveJob(data.job);

            // Refetch keywords on current table
            fetchKeywords(activeTabRef.current);

            // Check if job finished or in extension mode (where backend is done immediately)
            if (
              data.job.status === 'completed' ||
              data.job.status === 'failed' ||
              data.job.status === 'paused_due_to_block' ||
              data.job.status === 'pending_extension' ||
              pollCount >= 5
            ) {
              clearInterval(pollIntervalRef.current);
              setIsProcessing(false);
            }
          }
        } catch (err) {
          console.warn('[Job Poll Error]:', err);
          clearInterval(pollIntervalRef.current);
          setIsProcessing(false);
        }
      }, 2000);
    },
    [fetchKeywords]
  );

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // 4. Handle Logout
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  // 5. Handle Process Request (Scraping Submission)
  const handleProcessRequest = async (e) => {
    e.preventDefault();
    if (!inputKeywords.trim() || !user) return;

    setProcessError('');
    setIsProcessing(true);

    try {
      const res = await fetch(`${BACKEND_URL}/api/keywords/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords: inputKeywords,
          category: activeTab,
          userId: user.id
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal memulai pemrosesan scraping.');
      }

      setInputKeywords('');
      await fetchKeywords(activeTab);
      setIsProcessing(false);

      if (data.jobId && data.status !== 'pending_extension') {
        pollJobStatus(data.jobId);
      }
    } catch (err) {
      console.error('[Process Error]:', err);
      setProcessError(err.message || 'Terjadi kesalahan saat menghubungi server backend.');
      setIsProcessing(false);
    }
  };

  // 6. Handle Toggle Mark (Used / Unused)
  const handleToggleMark = async (id, isUsed) => {
    // Optimistic UI update
    setKeywords((prev) =>
      prev.map((item) => (item.id === id ? { ...item, is_used: isUsed } : item))
    );

    try {
      const { error } = await supabase
        .from('keywords')
        .update({ is_used: isUsed })
        .eq('id', id);

      if (error) {
        throw error;
      }
    } catch (err) {
      console.error('[Toggle Mark Error]:', err);
      fetchKeywords(); // Revert on failure
    }
  };

  // 7. Handle AI Variants Modal Open
  const handleOpenAiVariants = (keywordItem) => {
    setSelectedKeywordForAi(keywordItem);
    setIsAiModalOpen(true);
  };

  // 8. Handle Add AI Variant to input
  const handleAddKeywordToSearch = (variantText, cat) => {
    setActiveTab(cat);
    setInputKeywords((prev) => (prev ? `${prev}\n${variantText}` : variantText));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 9. Handle Delete Keyword
  const handleDeleteKeyword = async (id) => {
    // Optimistic UI update
    setKeywords((prev) => prev.filter((item) => item.id !== id));

    try {
      const { error } = await supabase
        .from('keywords')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (err) {
      console.error('[Delete Keyword Error]:', err);
      fetchKeywords();
    }
  };

  // 10. Handle Delete Duplicate Keywords in current category
  const handleDeleteDuplicates = async () => {
    const seen = new Map();
    const duplicateIds = [];

    // Identify duplicates (case insensitive)
    for (const item of keywords) {
      const norm = item.keyword.trim().toLowerCase();
      if (seen.has(norm)) {
        const existing = seen.get(norm);
        // Keep the one with valid result_count, delete the other
        if (item.result_count !== null && existing.result_count === null) {
          duplicateIds.push(existing.id);
          seen.set(norm, item);
        } else {
          duplicateIds.push(item.id);
        }
      } else {
        seen.set(norm, item);
      }
    }

    if (duplicateIds.length === 0) return;

    if (!confirm(`Hapus ${duplicateIds.length} kata kunci duplikat pada tab ini?`)) {
      return;
    }

    // Optimistic UI update
    setKeywords((prev) => prev.filter((item) => !duplicateIds.includes(item.id)));

    try {
      const { error } = await supabase
        .from('keywords')
        .delete()
        .in('id', duplicateIds);

      if (error) throw error;
      fetchKeywords();
    } catch (err) {
      console.error('[Delete Duplicates Error]:', err);
      fetchKeywords();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navigation Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-500/25">
            <span className="text-white font-black text-lg tracking-tighter">D2P</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-slate-900 text-base sm:text-lg leading-none">
                Data2Pro
              </h1>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60">
                Adobe Stock Tool
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium hidden sm:block mt-0.5">
              Riset Keyword High Demand • Low Competition
            </p>
          </div>
        </div>

        {/* User Badge & Logout */}
        <div className="flex items-center gap-3">
          {user && (
            <div className="text-right hidden md:block">
              <p className="text-xs font-semibold text-slate-800">{user.email}</p>
              <p className="text-[11px] text-slate-400">Kontributor Adobe</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            title="Keluar Akun"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-red-50 hover:text-red-700 text-slate-700 rounded-xl text-xs font-semibold transition-all border border-transparent hover:border-red-200"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar</span>
          </button>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Category Tabs */}
        <div className="flex items-center justify-center">
          <div className="inline-flex p-1.5 bg-slate-200/80 backdrop-blur rounded-2xl gap-1 shadow-inner max-w-full overflow-x-auto">
            <button
              onClick={() => setActiveTab('video')}
              className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 ${
                activeTab === 'video'
                  ? 'bg-white text-purple-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Video className="w-4 h-4 text-purple-600" />
              <span>Video Data</span>
            </button>

            <button
              onClick={() => setActiveTab('vector')}
              className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 ${
                activeTab === 'vector'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-4 h-4 text-emerald-600" />
              <span>Vector Data</span>
            </button>

            <button
              onClick={() => setActiveTab('image')}
              className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 ${
                activeTab === 'image'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ImageIcon className="w-4 h-4 text-blue-600" />
              <span>Image Data</span>
            </button>
          </div>
        </div>

        {/* Input Panel for New Keyword Research */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-ping" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                Masukkan Kata Kunci Baru ({activeTab.toUpperCase()})
              </h2>
            </div>
            <span className="text-xs text-slate-400 font-medium">
              Maksimal 30–50 keyword per proses
            </span>
          </div>

          <form onSubmit={handleProcessRequest} className="space-y-3">
            <textarea
              rows={3}
              value={inputKeywords}
              onChange={(e) => setInputKeywords(e.target.value)}
              placeholder="Ketik kata kunci di sini... (Bisa multiple keyword, pisahkan dengan baris baru atau koma. Contoh: ramadan kareem, eid mubarak vector, ramadan lantern)"
              className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-y"
            />

            {processError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{processError}</span>
              </div>
            )}

            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                Sistem scraping menggunakan browser Playwright anonim dengan delay 3–5 detik.
              </p>

              <button
                type="submit"
                disabled={isProcessing || !inputKeywords.trim()}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-blue-500/20 flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing Request...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Process Request</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Live Scraping Progress Banner */}
        {activeJob && activeJob.status === 'processing' && (
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-4 sm:p-5 text-white shadow-lg shadow-blue-500/15 animate-in fade-in flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
                <Loader2 className="w-5 h-5 animate-spin text-white" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-100">
                  Scraping Playwright Sedang Berjalan (Background)
                </p>
                <h4 className="text-sm sm:text-base font-bold text-white mt-0.5">
                  Memproses: <span className="underline">{activeJob.currentKeyword}</span> ({activeJob.processed}/{activeJob.total})
                </h4>
              </div>
            </div>

            <div className="w-full sm:w-48 bg-white/20 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-white h-2.5 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.round((activeJob.processed / activeJob.total) * 100)}%`
                }}
              />
            </div>
          </div>
        )}

        {/* Extension Info Banner - replaces old Playwright block warning */}
        {activeJob && activeJob.status === 'paused_due_to_block' && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-blue-800 text-xs sm:text-sm flex items-start gap-3">
            <span className="text-lg shrink-0">🧩</span>
            <div>
              <p className="font-bold">Gunakan Ekstensi Chrome Data2Pro</p>
              <p className="mt-0.5 text-blue-700">
                Scraping server-side terdeteksi oleh Adobe Stock. Aktifkan ekstensi <strong>Data2Pro Helper</strong> di browser Anda agar pencarian berjalan otomatis melalui sesi browser asli Anda.
              </p>
            </div>
          </div>
        )}

        {/* Stats Metrics Cards */}
        <StatsCards keywords={keywords} category={activeTab} />

        {/* Main Keywords Table */}
        <KeywordTable
          keywords={keywords}
          loading={loadingData}
          onRefresh={fetchKeywords}
          onToggleMark={handleToggleMark}
          onOpenAiVariants={handleOpenAiVariants}
          onDeleteKeyword={handleDeleteKeyword}
          onDeleteDuplicates={handleDeleteDuplicates}
        />
      </main>

      {/* AI Variants Gemini Modal */}
      <AiVariantsModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        keyword={selectedKeywordForAi}
        backendUrl={BACKEND_URL}
        onAddKeywordToSearch={handleAddKeywordToSearch}
      />
    </div>
  );
}
