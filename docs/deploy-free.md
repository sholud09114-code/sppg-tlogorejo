# Deploy Gratis: Vercel + Render + Aiven MySQL

Panduan ini untuk uji coba hosting gratis:

- Frontend React/Vite: Vercel Hobby
- Backend Express: Render Free Web Service
- Database MySQL: Aiven MySQL Free Tier

## 1. Push repo ke GitHub

Vercel dan Render paling mudah membaca project dari GitHub.

```bash
git remote -v
git push origin main
```

Jika remote belum ada, buat repository GitHub dulu lalu hubungkan remote sesuai URL repo Anda.

## 2. Buat database di Aiven

1. Buat service MySQL Free Tier di Aiven.
2. Buat database bernama `sppg_tlogorejo` jika belum ada.
3. Catat connection detail:
   - host
   - port
   - user
   - password
   - database
4. Karena Aiven memakai SSL, gunakan:

```env
DB_SSL=true
```

Jika Render gagal konek karena validasi sertifikat, ambil CA certificate dari Aiven lalu isi `DB_SSL_CA` di Render. Paste isi sertifikat dengan `\n` sebagai pemisah baris.

## 3. Siapkan file env lokal untuk migration

Buat file sementara di luar git, misalnya `/tmp/sppg-aiven.env`:

```env
DB_HOST=isi-host-aiven
DB_PORT=isi-port-aiven
DB_USER=isi-user-aiven
DB_PASSWORD=isi-password-aiven
DB_NAME=sppg_tlogorejo
DB_SSL=true
```

Jalankan migration dan seed:

```bash
ENV_FILE=/tmp/sppg-aiven.env ./scripts/migrate-db.sh
```

Jika MySQL CLI Anda tidak mendukung `--ssl-mode`, gunakan versi MySQL client yang lebih baru atau jalankan import SQL dari console/panel database Aiven.

## 4. Deploy backend ke Render

Cara paling cepat:

1. Buka Render.
2. Pilih **New +** lalu **Blueprint**.
3. Pilih repo ini.
4. Render akan membaca `render.yaml`.
5. Isi environment variable yang bertanda manual:

```env
CLIENT_URL=https://domain-vercel-anda.vercel.app
DB_HOST=isi-host-aiven
DB_PORT=isi-port-aiven
DB_USER=isi-user-aiven
DB_PASSWORD=isi-password-aiven
DB_NAME=sppg_tlogorejo
DB_SSL=true
DEFAULT_ADMIN_PASSWORD=password-admin-kuat
DEFAULT_PUBLIC_PASSWORD=password-publik-kuat
```

`JWT_SECRET` akan dibuat otomatis jika memakai blueprint `render.yaml`.

Setelah deploy, cek:

```bash
curl https://domain-render-anda.onrender.com/api/health
```

Catatan: Render free bisa sleep saat tidak dipakai. Request pertama setelah idle bisa lambat.

## 5. Deploy frontend ke Vercel

1. Buka Vercel.
2. Import repo GitHub.
3. Set root directory ke `client`.
4. Framework preset: Vite.
5. Build command:

```bash
npm run build
```

6. Output directory:

```bash
dist
```

7. Isi environment variable:

```env
VITE_API_BASE_URL=https://domain-render-anda.onrender.com/api
```

Deploy frontend.

## 6. Update CORS backend

Setelah Vercel memberi domain final, kembali ke Render lalu pastikan:

```env
CLIENT_URL=https://domain-vercel-anda.vercel.app
```

Jika Anda punya beberapa domain frontend, pisahkan dengan koma:

```env
CLIENT_URL=https://domain-vercel-anda.vercel.app,https://domain-custom-anda.com
```

Redeploy backend setelah env diubah.

## 7. Uji login

Gunakan username default:

```text
admin
publik
```

Password mengikuti env `DEFAULT_ADMIN_PASSWORD` dan `DEFAULT_PUBLIC_PASSWORD` yang Anda isi sebelum backend pertama kali membuat user.

Jika tabel `users` sudah pernah terisi, perubahan env default password tidak mengubah password user lama.

## Checklist masalah umum

- Frontend gagal fetch API: cek `VITE_API_BASE_URL` di Vercel.
- API kena CORS: cek `CLIENT_URL` di Render harus sama persis dengan origin Vercel.
- Backend gagal start: cek log Render, guard production akan memberi pesan env mana yang belum aman.
- Database gagal konek: cek host, port, password, database name, dan `DB_SSL=true`.
- Reload halaman frontend 404: `client/vercel.json` sudah menangani Vercel; untuk hosting lain perlu rewrite ke `index.html`.
