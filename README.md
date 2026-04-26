# SPPG Tlogorejo — Full-Stack App

Aplikasi pelaporan penerima manfaat (PM) harian untuk SPPG Tlogorejo (Fase 1).

## Stack

- **Frontend:** React 18 + Vite
- **Backend:** Node.js + Express (ES modules)
- **Database:** MySQL 8+

## Struktur folder

```
sppg-tlogorejo/
├── client/                       # React + Vite (port 5173)
│   ├── src/
│   │   ├── api/reportApi.js
│   │   ├── components/
│   │   │   ├── CategoryGroup.jsx
│   │   │   ├── DateInput.jsx
│   │   │   ├── Header.jsx
│   │   │   ├── Navigation.jsx
│   │   │   ├── SchoolCard.jsx
│   │   │   ├── SummaryPanel.jsx
│   │   │   └── Toast.jsx
│   │   ├── pages/DailyReport.jsx
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── server/                       # Express API (port 4000)
│   ├── src/
│   │   ├── config/db.js
│   │   ├── controllers/
│   │   │   ├── reportController.js
│   │   │   └── schoolController.js
│   │   ├── routes/
│   │   │   ├── reportRoutes.js
│   │   │   └── schoolRoutes.js
│   │   └── app.js
│   ├── .env.example
│   └── package.json
│
└── database/
    ├── migrations/               # SQL migration bertahap
    ├── seeds/                    # Seed data idempotent
    └── schema.sql                # Referensi gabungan schema + seed
```

## Prasyarat

- **Node.js** v18 atau lebih baru — cek: `node -v`
- **npm** v9+ (sudah include di Node.js)
- **MySQL** 8.0+ (atau MariaDB 10.6+) dalam kondisi jalan
- **VS Code** (opsional tapi direkomendasikan)

## Setup awal (sekali saja)

### 1. Buka di VS Code

```bash
cd sppg-tlogorejo
code .
```

### 2. Buat database

Jalankan dari folder root project:

```bash
mysql -u root -p < database/schema.sql
```

Perintah ini akan:
- Membuat database `sppg_tlogorejo`
- Membuat tabel `units`, `daily_reports`, `daily_report_details`
- Mengisi 14 unit sekolah sebagai data awal

Cek bahwa data sudah masuk:

```bash
mysql -u root -p -e "USE sppg_tlogorejo; SELECT COUNT(*) AS total_units FROM units;"
```

Outputnya harus menampilkan `14`.

### 3. Setup backend

```bash
cd server
cp .env.example .env
```

Edit `.env` sesuai konfigurasi MySQL Anda:

```
PORT=4000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=password_mysql_anda
DB_NAME=sppg_tlogorejo
JWT_SECRET=ganti_dengan_secret_panjang_dari_password_manager
CLIENT_URL=http://localhost:5173
GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-2.5-flash-lite
GEMINI_FALLBACK_MODEL=gemini-2.5-flash
```

`JWT_SECRET` wajib diisi dan tidak boleh memakai nilai contoh. `CLIENT_URL` dipakai backend untuk whitelist CORS; pisahkan dengan koma jika ada lebih dari satu origin.

`GEMINI_API_KEY` wajib diisi jika ingin memakai fitur `Import Gambar` pada menu `Laporan Belanja`. Setelah mengubah `.env`, restart backend.

Lalu install dependencies:

```bash
npm install
```

### 4. Setup frontend

Buka terminal baru, dari folder root project:

```bash
cd client
npm install
```

## Menjalankan aplikasi

Anda butuh **dua terminal** yang berjalan bersamaan. Di VS Code: Terminal → Split Terminal.

### Terminal 1 — Backend

```bash
cd server
npm run dev
```

Output yang diharapkan:
```
SPPG API running on http://localhost:4000
```

### Terminal 2 — Frontend

```bash
cd client
npm run dev
```

Output yang diharapkan:
```
VITE v5.x.x  ready in xxx ms
➜  Local:   http://localhost:5173/
```

Buka `http://localhost:5173` di browser. Form laporan harian siap digunakan.

## Backup database

Script backup membaca `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, dan `DB_NAME` dari environment. Jika `server/.env` ada, script akan memuat file itu otomatis.

```bash
./scripts/backup-db.sh
```

Output backup disimpan ke folder `backups/` dengan nama file bertimestamp. Folder ini sudah masuk `.gitignore`.

## Fitur utama

**Form laporan harian:**
- Pilih tanggal laporan (default: hari ini)
- 14 unit sekolah dikelompokkan per kategori (PAUD/TK/KB, SD, SMP, SMK)
- Per unit: tombol segmented "Dilayani penuh / Libur / Dilayani sebagian"
- Input parsial muncul otomatis jika status "Dilayani sebagian"
- Validasi: tidak boleh negatif, tidak boleh melebihi target
- Panel akumulasi di samping form, update real-time per kategori + grand total
- Submit hanya aktif jika semua unit sudah diisi
- Jika tanggal yang sama diinput ulang → otomatis mode edit (tidak duplikat)

## Endpoint API

| Method | Endpoint              | Kegunaan                                  |
|--------|-----------------------|-------------------------------------------|
| GET    | `/api/health`         | Health check                              |
| GET    | `/api/units`          | Daftar semua unit aktif                   |
| GET    | `/api/reports`        | List laporan terbaru (default 30)         |
| GET    | `/api/reports/:date`  | Ambil laporan untuk satu tanggal          |
| POST   | `/api/reports`        | Simpan atau update laporan (upsert)       |

### Contoh body POST `/api/reports`

```json
{
  "report_date": "2026-04-20",
  "notes": "Catatan opsional",
  "details": [
    {
      "unit_id": 1,
      "target_pm": 50,
      "service_status": "penuh",
      "actual_pm": 50
    },
    {
      "unit_id": 2,
      "target_pm": 50,
      "service_status": "libur",
      "actual_pm": 0
    },
    {
      "unit_id": 3,
      "target_pm": 50,
      "service_status": "sebagian",
      "actual_pm": 35
    }
  ]
}
```

## Skema database (ringkas)

- **`units`** — master data sekolah (id, name, category, default_target, display_order, is_active)
- **`daily_reports`** — header laporan per tanggal (unique constraint di `report_date`)
- **`daily_report_details`** — baris detail per unit per laporan (unique `(report_id, unit_id)`)

Foreign key `ON DELETE CASCADE` dari `daily_report_details` ke `daily_reports`, sehingga menghapus header juga menghapus semua detailnya.

## Troubleshooting

**"ECONNREFUSED" di backend saat startup:**
MySQL belum jalan. Cek dengan `sudo systemctl status mysql` (Linux) atau buka MySQL Workbench.

**"Access denied for user 'root'@'localhost'":**
Password MySQL di `.env` salah. Pastikan sama dengan password root MySQL Anda.

**Frontend tampil tapi form kosong:**
Buka DevTools → Network. Jika `/api/units` gagal, backend belum jalan atau port salah.

**"Fitur import gambar belum aktif" saat upload nota belanja:**
Isi `GEMINI_API_KEY` pada `server/.env`, simpan, lalu restart backend dengan `cd server && npm run dev`.

**Port 4000 atau 5173 sudah dipakai:**
- Backend: ubah `PORT` di `server/.env`
- Frontend: ubah `port` di `client/vite.config.js` dan update `proxy` target jika backend port juga berubah.

## Langkah berikutnya (Fase 2+)

Sesuai brief:
- Modul laporan mingguan (agregasi otomatis dari harian)
- Halaman dokumentasi
- Master data management UI (tambah/edit unit)
- Autentikasi admin/operator
- Export ke Excel/PDF
- Dashboard di halaman Home
- Activity log
