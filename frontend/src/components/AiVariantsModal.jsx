'use client';

import { useState, useEffect } from 'react';
import { Sparkles, X, Copy, Check, Plus, Loader2, AlertCircle } from 'lucide-react';

export default function AiVariantsModal({
  isOpen,
  onClose,
  keyword,
  onAddKeywordToSearch,
  backendUrl = 'http://localhost:5000'
}) {
  const [loading, setLoading] = useState(false);
  const [variants, setVariants] = useState([]);
  const [error, setError] = useState('');
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);

  useEffect(() => {
    if (isOpen && keyword) {
      fetchOrGenerateVariants();
    } else {
      setVariants([]);
      setError('');
    }
  }, [isOpen, keyword]);

  const fetchOrGenerateVariants = async () => {
    if (!keyword) return;
    setLoading(true);
    setError('');

    try {
      // 1. Check if variants already exist in database
      const existingRes = await fetch(`${backendUrl}/api/keywords/${keyword.id}/variants`);
      const existingData = await existingRes.json();

      if (existingData?.variants?.length > 0) {
        setVariants(existingData.variants.map((v) => v.variant_text));
        setLoading(false);
        return;
      }

      // 2. Generate new variants via Gemini API
      const res = await fetch(`${backendUrl}/api/keywords/${keyword.id}/generate-variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: keyword.keyword,
          category: keyword.category
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menghasilkan variasi kata kunci dari Gemini AI.');
      }

      setVariants(data.variants || []);
    } catch (err) {
      console.error('[AI Variants Modal Error]:', err);
      setError(err.message || 'Terjadi kesalahan saat memanggil Gemini AI.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyAll = () => {
    if (variants.length === 0) return;
    navigator.clipboard.writeText(variants.join('\n'));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleCopySingle = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  if (!isOpen || !keyword) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-50/50 to-indigo-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Variasi AI Gemini</h3>
              <p className="text-xs text-slate-500">
                Keyword asal: <span className="font-semibold text-blue-600">"{keyword.keyword}"</span> ({keyword.category})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {loading && (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
              <p className="text-sm font-semibold text-slate-800">Sedang Meracik 10 Variasi Kata Kunci...</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Gemini 2.5 Flash sedang menganalisis sinonim & frasa pencarian potensial untuk Adobe Stock.
              </p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs sm:text-sm flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Gagal memproses:</p>
                <p className="mt-0.5">{error}</p>
                <button
                  onClick={fetchOrGenerateVariants}
                  className="mt-2 text-xs font-semibold text-blue-600 hover:underline"
                >
                  Coba Lagi
                </button>
              </div>
            </div>
          )}

          {!loading && !error && variants.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-2 font-medium">
                <span>10 Variasi Ditemukan:</span>
                <button
                  onClick={handleCopyAll}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
                >
                  {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedAll ? 'Tersalin Semua!' : 'Salin Semua'}</span>
                </button>
              </div>

              <div className="space-y-1.5">
                {variants.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-blue-50/40 hover:border-blue-200 transition-all group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <span className="w-5 text-xs text-slate-400 font-mono font-medium">{idx + 1}.</span>
                      <span className="text-sm font-medium text-slate-800 truncate">{item}</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        title="Salin keyword"
                        onClick={() => handleCopySingle(item, idx)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white border border-transparent hover:border-slate-200 transition-all"
                      >
                        {copiedIndex === idx ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {onAddKeywordToSearch && (
                        <button
                          title="Riset kata kunci ini"
                          onClick={() => {
                            onAddKeywordToSearch(item, keyword.category);
                            onClose();
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white rounded-lg text-xs font-semibold border border-blue-200 hover:border-blue-600 transition-all"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Riset</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
