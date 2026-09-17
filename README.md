# Data2Pro - Adobe Stock Keyword Intelligence Tool

**Data2Pro** adalah aplikasi riset kata kunci khusus kontributor Adobe Stock untuk menemukan kata kunci dengan permintaan tinggi (*high-demand*) namun kompetisi rendah (*low-competition / jumlah hasil pencarian sedikit*).

---

## 🏗️ Arsitektur & Teknologi

- **Frontend**: Next.js 14 (App Router) + Tailwind CSS + Lucide Icons (Deploy target: **Vercel**)
- **Backend**: Node.js + Express + Playwright (Headless Browser) + Google Gemini API (Deploy target: **Railway**)
- **Database & Auth**: Supabase (PostgreSQL) dengan Row Level Security (RLS)
- **Struktur Monorepo**: Folder `/frontend` dan `/backend` terpisah secara independen dengan `package.json` masing-masing.

---

## 📁 Struktur Folder

```
Data2Pro/
├── frontend/                 # Web Dashboard Next.js
│   ├── src/
│   │   ├── app/             # App Router (login, dashboard, layout)
│   │   ├── components/      # Table, StatsCards, AI Variations Modal
│   │   └── lib/             # Supabase Client
│   ├── .env.example
│   └── package.json
├── backend/                  # API Scraper & Gemini AI Service
│   ├── src/
│   │   ├── config/          # Supabase Admin Client
│   │   ├── routes/          # Express API Endpoints
│   │   ├── services/        # Playwright Scraper, Gemini AI, Async Queue
│   │   └── server.js        # Express Server Entry Point
│   ├── .env.example
│   └── package.json
├── supabase/
│   └── schema.sql           # Skema database & RLS policies
├── .gitignore
└── README.md
```

---

## 🚀 Panduan Menjalankan Secara Lokal

### 1. Setup Database Supabase
1. Buka dashboard project di [Supabase](https://supabase.com).
2. Buka menu **SQL Editor**.
3. Salin isi file `supabase/schema.sql` dan jalankan (*Run*) di SQL Editor.
4. Ambil **Project URL**, **Anon Key**, dan **Service Role Key** dari menu *Project Settings -> API*.

---

### 2. Setup & Jalankan Backend

```bash
cd backend

# Salin konfigurasi environment
cp .env.example .env
```

Edit file `backend/.env`:
```env
PORT=5000
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_KEY=your-supabase-service-role-key
GEMINI_API_KEY=your-gemini-api-key
```

Install dependensi & Playwright browser:
```bash
npm install
npx playwright install chromium

# Jalankan server backend
npm run dev
```
Backend akan berjalan di `http://localhost:5000`.

---

### 3. Setup & Jalankan Frontend

Buka terminal baru:
```bash
cd frontend

# Salin konfigurasi environment
cp .env.example .env.local
```

Edit file `frontend/.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_BACKEND_URL=http://localhost:5000
```

Install dependensi & jalankan frontend:
```bash
npm install
npm run dev
```
Frontend akan berjalan di `http://localhost:3000`.

---

## 🌟 Fitur Utama

1. **Autentikasi Supabase**: Login & pendaftaran akun mandiri untuk dashboard.
2. **Kategori Tab**: Pemisahan riset untuk **Video Data**, **Vector Data**, dan **Image Data**.
3. **Scraping Anonim Playwright**:
   - Menghitung jumlah hasil pencarian real-time di Adobe Stock.
   - 100% anonim (browser context baru setiap request, tanpa cookies/kredensial).
   - Rate limiting otomatis (3–5 detik random delay) & antrean background job.
   - Proteksi auto-pause saat terdeteksi pembatasan/captcha.
4. **Variasi Keyword AI (Gemini 2.5 Flash)**:
   - Generate 10 ide sinonim dan frasa pencarian terkait hanya dengan 1 klik.
   - Tombol salin instan atau langsung daftarkan variasi ke antrean riset.
5. **Indikator Kompetisi & Aksi**:
   - 🔥 **Low Comp (<10k)**, ⚡ **Moderate (10k–100k)**, **High Comp (>100k)**.
   - Tombol **Mark as Used** dengan styling khusus untuk keyword yang telah diproduksi.
   - Tombol **Copy** dan **View di Adobe Stock**.

---

## 🚢 Panduan Deployment

### Deploy Frontend ke Vercel
1. Push repository ke GitHub.
2. Hubungkan repository ke [Vercel](https://vercel.com).
3. Set **Root Directory** ke `frontend`.
4. Masukkan Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_BACKEND_URL` (URL service Railway backend Anda).

### Deploy Backend ke Railway
1. Hubungkan repository ke [Railway](https://railway.app).
2. Set **Root Directory** ke `backend`.
3. Masukkan Environment Variables:
   - `PORT=5000`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `GEMINI_API_KEY`
4. Pastikan Railway build mendownload Playwright Chromium (`npx playwright install chromium --with-deps` jika menggunakan Docker/Nixpacks).
