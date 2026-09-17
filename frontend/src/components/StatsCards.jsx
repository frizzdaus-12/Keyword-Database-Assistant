'use client';

import { Database, Zap, CheckCircle2, TrendingUp } from 'lucide-react';

export default function StatsCards({ keywords = [], category = 'image' }) {
  const total = keywords.length;
  const isVideo = category === 'video';

  const lowThreshold = isVideo ? 1000 : 10000;
  const medThreshold = isVideo ? 10000 : 100000;

  // Low competition
  const lowComp = keywords.filter((k) => {
    const thresh = k.category === 'video' ? 1000 : 10000;
    return (
      k.result_count !== null &&
      k.result_count !== undefined &&
      k.result_count > 0 &&
      k.result_count < thresh
    );
  }).length;

  // Medium competition
  const medComp = keywords.filter((k) => {
    if (k.result_count === null || k.result_count === undefined) return false;
    const low = k.category === 'video' ? 1000 : 10000;
    const high = k.category === 'video' ? 10000 : 100000;
    return k.result_count >= low && k.result_count <= high;
  }).length;

  // Used count
  const usedCount = keywords.filter((k) => k.is_used).length;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 mb-6">
      {/* Total Data */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
        <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
          <Database className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Keyword</p>
          <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">{total}</h3>
        </div>
      </div>

      {/* Low Competition */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
        <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
          <Zap className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Kompetisi Rendah</p>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <h3 className="text-xl sm:text-2xl font-bold text-emerald-600">{lowComp}</h3>
            <span className="text-[11px] font-medium text-slate-400">
              {isVideo ? '(<1k)' : '(<10k)'}
            </span>
          </div>
        </div>
      </div>

      {/* Medium Competition */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
        <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
          <TrendingUp className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Kompetisi Sedang</p>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <h3 className="text-xl sm:text-2xl font-bold text-amber-600">{medComp}</h3>
            <span className="text-[11px] font-medium text-slate-400">
              {isVideo ? '(1k-10k)' : '(10k-100k)'}
            </span>
          </div>
        </div>
      </div>

      {/* Used Count */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
        <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sudah Dipakai</p>
          <h3 className="text-xl sm:text-2xl font-bold text-indigo-600 mt-0.5">{usedCount}</h3>
        </div>
      </div>
    </div>
  );
}
