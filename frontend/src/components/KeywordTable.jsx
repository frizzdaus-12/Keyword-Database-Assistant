'use client';

import { useState } from 'react';
import {
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  CheckCircle2,
  Circle,
  Search,
  RefreshCw,
  Clock,
  Trash2,
  CopyX
} from 'lucide-react';

export default function KeywordTable({
  keywords = [],
  onToggleMark,
  onOpenAiVariants,
  onRefresh,
  onDeleteKeyword,
  onDeleteDuplicates,
  loading = false
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'unused' | 'used'
  const [copiedId, setCopiedId] = useState(null);
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'lowest_count' | 'highest_count' | 'alphabetical'
  const [deletingId, setDeletingId] = useState(null);

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleDelete = async (id, keyword) => {
    if (confirm(`Yakin ingin menghapus kata kunci "${keyword}"?`)) {
      setDeletingId(id);
      try {
        if (onDeleteKeyword) {
          await onDeleteKeyword(id);
        }
      } finally {
        setDeletingId(null);
      }
    }
  };

  // Count duplicate keywords in current list (case-insensitive)
  const duplicateCount = (() => {
    const counts = new Map();
    for (const k of keywords) {
      const norm = k.keyword.trim().toLowerCase();
      counts.set(norm, (counts.get(norm) || 0) + 1);
    }
    let dupes = 0;
    for (const count of counts.values()) {
      if (count > 1) dupes += (count - 1);
    }
    return dupes;
  })();

  // Format number to readable string
  const formatCount = (count) => {
    if (count === null || count === undefined) {
      return (
        <span className="inline-flex items-center gap-1 text-slate-400 font-medium text-xs">
          <Clock className="w-3.5 h-3.5 animate-pulse" />
          <span>Antrean / Pending</span>
        </span>
      );
    }
    return new Intl.NumberFormat('id-ID').format(count);
  };

  // Badge for competition level (<10k Low, 10k-50k Moderate, >50k High)
  const renderCompetitionBadge = (count) => {
    // Don't show badge if count is null, undefined, or 0 (no data yet)
    if (count === null || count === undefined || count === 0) return null;

    if (count < 10000) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200/60">
          🔥 Low Comp (&lt;10k)
        </span>
      );
    } else if (count <= 50000) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200/60">
          ⚡ Moderate (10k-50k)
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
          🔺 High Comp (&gt;50k)
        </span>
      );
    }
  };

  // Filter keywords
  const filteredKeywords = keywords
    .filter((k) => {
      const matchesSearch = k.keyword.toLowerCase().includes(searchTerm.toLowerCase());
      if (statusFilter === 'used') return matchesSearch && k.is_used;
      if (statusFilter === 'unused') return matchesSearch && !k.is_used;
      return matchesSearch;
    })
    .sort((a, b) => {
      if (sortBy === 'lowest_count') {
        const countA = a.result_count !== null ? a.result_count : Infinity;
        const countB = b.result_count !== null ? b.result_count : Infinity;
        return countA - countB;
      }
      if (sortBy === 'highest_count') {
        const countA = a.result_count !== null ? a.result_count : -1;
        const countB = b.result_count !== null ? b.result_count : -1;
        return countB - countA;
      }
      if (sortBy === 'alphabetical') {
        return a.keyword.localeCompare(b.keyword);
      }
      // default: newest
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      {/* Table Toolbar */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row gap-3 items-center justify-between">
        {/* Search input */}
        <div className="relative w-full sm:w-80">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari keyword tersimpan..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>

        {/* Filters & Actions */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end overflow-x-auto pb-1 sm:pb-0">
          {/* Delete Duplicates Button */}
          {duplicateCount > 0 && onDeleteDuplicates && (
            <button
              onClick={onDeleteDuplicates}
              title={`Hapus ${duplicateCount} kata kunci yang duplikat`}
              className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-1.5 transition-all shrink-0"
            >
              <CopyX className="w-4 h-4 text-rose-600" />
              <span>Hapus Duplikat ({duplicateCount})</span>
            </button>
          )}

          {/* Status Filter */}
          <div className="flex bg-slate-100 p-1 rounded-xl shrink-0">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Semua ({keywords.length})
            </button>
            <button
              onClick={() => setStatusFilter('unused')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                statusFilter === 'unused'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Belum ({keywords.filter((k) => !k.is_used).length})
            </button>
            <button
              onClick={() => setStatusFilter('used')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                statusFilter === 'used'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Used ({keywords.filter((k) => k.is_used).length})
            </button>
          </div>

          {/* Sort selector */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 py-1.5 px-3 rounded-xl focus:outline-none focus:border-blue-500 shrink-0"
          >
            <option value="newest">Terbaru</option>
            <option value="lowest_count">Hasil Sedikit (Low Comp)</option>
            <option value="highest_count">Hasil Terbanyak</option>
            <option value="alphabetical">A - Z</option>
          </select>

          {/* Refresh Button */}
          {onRefresh && (
            <button
              onClick={() => onRefresh && onRefresh()}
              disabled={loading}
              title="Refresh Data"
              className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-xl transition-all shrink-0"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <th className="py-3.5 px-4 w-12 text-center">No</th>
              <th className="py-3.5 px-4">Kata Kunci / Link Pencarian</th>
              <th className="py-3.5 px-4 w-28">Kategori</th>
              <th className="py-3.5 px-4 w-44">Hasil Pencarian</th>
              <th className="py-3.5 px-4 w-28">Status</th>
              <th className="py-3.5 px-4 text-center w-64">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
            {filteredKeywords.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                  {searchTerm
                    ? 'Tidak ada kata kunci yang cocok dengan pencarian.'
                    : 'Belum ada data kata kunci di kategori ini. Masukkan kata kunci baru di atas untuk mulai riset.'}
                </td>
              </tr>
            ) : (
              filteredKeywords.map((item, index) => {
                const isMarked = item.is_used;

                return (
                  <tr
                    key={item.id}
                    className={`transition-colors ${
                      isMarked
                        ? 'bg-slate-50/60 text-slate-400 hover:bg-slate-100/50'
                        : 'hover:bg-blue-50/20 text-slate-800'
                    }`}
                  >
                    {/* Nomor Urut */}
                    <td className="py-3.5 px-4 text-center font-mono text-xs text-slate-400">
                      {index + 1}
                    </td>

                    {/* Keyword + Link */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col gap-0.5">
                        <span
                          className={`font-semibold tracking-tight ${
                            isMarked ? 'line-through text-slate-400' : 'text-slate-900'
                          }`}
                        >
                          {item.keyword}
                        </span>
                        {item.search_url && (
                          <a
                            href={item.search_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 font-medium w-fit"
                          >
                            <span>Buka di Adobe Stock</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </td>

                    {/* Category Badge */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider ${
                          item.category === 'video'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200/60'
                            : item.category === 'vector'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                            : 'bg-blue-50 text-blue-700 border border-blue-200/60'
                        }`}
                      >
                        {item.category}
                      </span>
                    </td>

                    {/* Result Count */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col gap-1">
                        <span className="font-bold text-slate-900 font-mono">
                          {formatCount(item.result_count)}
                        </span>
                        {renderCompetitionBadge(item.result_count)}
                      </div>
                    </td>

                    {/* Status Used */}
                    <td className="py-3.5 px-4">
                      {isMarked ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100/80 text-emerald-800">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Used</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                          <Circle className="w-3 h-3 text-slate-400" />
                          <span>Belum</span>
                        </span>
                      )}
                    </td>

                    {/* Action Buttons */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        {/* 1. Mark Button */}
                        <button
                          onClick={() => onToggleMark(item.id, !item.is_used)}
                          title={isMarked ? 'Batalkan tanda used' : 'Tandai sudah dipakai (Used)'}
                          className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1 transition-all ${
                            isMarked
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                          }`}
                        >
                          <CheckCircle2 className={`w-4 h-4 ${isMarked ? 'text-emerald-600' : 'text-slate-400'}`} />
                          <span className="hidden xl:inline">{isMarked ? 'Unmark' : 'Mark'}</span>
                        </button>

                        {/* 2. Copy Button */}
                        <button
                          onClick={() => handleCopy(item.keyword, item.id)}
                          title="Salin keyword"
                          className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 text-xs font-semibold flex items-center gap-1 transition-all"
                        >
                          {copiedId === item.id ? (
                            <Check className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Copy className="w-4 h-4 text-slate-500" />
                          )}
                          <span className="hidden xl:inline">
                            {copiedId === item.id ? 'Copied' : 'Copy'}
                          </span>
                        </button>

                        {/* 3. View Link */}
                        <a
                          href={item.search_url || `https://stock.adobe.com/search?k=${encodeURIComponent(item.keyword)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Buka link pencarian Adobe Stock"
                          className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 text-xs font-semibold flex items-center gap-1 transition-all"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span className="hidden xl:inline">View</span>
                        </a>

                        {/* 4. Generate Variasi (AI Gemini) */}
                        <button
                          onClick={() => onOpenAiVariants(item)}
                          title="Generate 10 variasi keyword dengan AI Gemini"
                          className="p-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-sm shadow-blue-500/20 text-xs font-semibold flex items-center gap-1.5 transition-all"
                        >
                          <Sparkles className="w-4 h-4 text-amber-300" />
                          <span>Variasi AI</span>
                        </button>

                        {/* 5. Delete Button */}
                        {onDeleteKeyword && (
                          <button
                            onClick={() => handleDelete(item.id, item.keyword)}
                            disabled={deletingId === item.id}
                            title="Hapus kata kunci ini"
                            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-400 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-xs font-semibold flex items-center gap-1 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span className="hidden xl:inline">Hapus</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
