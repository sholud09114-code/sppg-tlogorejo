# Deploy VPS: MySQL + Express API + Vite Static Build

Panduan ini untuk memindahkan setup lama Aiven + Render + Vercel ke satu VPS.

## 1. Backup dari Aiven

Gunakan env Aiven, lalu jalankan:

```bash
ENV_FILE=/tmp/sppg-aiven.env ./scripts/backup-db.sh
```

Backup terbaru yang sudah dicek:

```text
backups/sppg_tlogorejo_20260428-125420.sql
```

Untuk restore ke VPS, gunakan versi yang sudah dibersihkan dari GTID/binlog:

```text
backups/sppg_tlogorejo_20260428-125420_vps_restore.sql
```

## 2. Siapkan MySQL di VPS

Masuk ke MySQL sebagai root/admin:

```sql
CREATE DATABASE IF NOT EXISTS sppg_tlogorejo
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'sppg_app'@'localhost' IDENTIFIED BY 'ganti-password-kuat';
GRANT ALL PRIVILEGES ON sppg_tlogorejo.* TO 'sppg_app'@'localhost';
FLUSH PRIVILEGES;
```

## 3. Restore dump ke MySQL VPS

Buat file env lokal untuk VPS, misalnya `/tmp/sppg-vps.env`:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=sppg_app
DB_PASSWORD=ganti-password-kuat
DB_NAME=sppg_tlogorejo
DB_SSL=false
```

Jalankan restore:

```bash
ENV_FILE=/tmp/sppg-vps.env CONFIRM_RESTORE=yes ./scripts/restore-db.sh backups/sppg_tlogorejo_20260428-125420_vps_restore.sql
```

## 4. Env backend di VPS

Di `server/.env` VPS:

```env
NODE_ENV=production
PORT=4000
CLIENT_URL=https://domain-anda

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=sppg_app
DB_PASSWORD=ganti-password-kuat
DB_NAME=sppg_tlogorejo
DB_SSL=false

JWT_SECRET=ganti-dengan-random-panjang-minimal-32-karakter
JWT_EXPIRES_IN=8h

GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash-lite
GEMINI_FALLBACK_MODEL=gemini-2.5-flash

DEFAULT_ADMIN_NAME=Admin SPPG
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=ganti-password-admin
DEFAULT_PUBLIC_NAME=Publik
DEFAULT_PUBLIC_USERNAME=publik
DEFAULT_PUBLIC_PASSWORD=ganti-password-publik
```

Catatan: karena dump sudah berisi tabel `users`, `DEFAULT_*_PASSWORD` tidak akan mengubah password user lama.

## 5. Jalankan backend

```bash
cd server
npm ci --omit=dev
pm2 start ecosystem.config.cjs
pm2 save
```

Cek API:

```bash
curl http://127.0.0.1:4000/api/health
```

## 6. Build frontend

Jika frontend disajikan dari domain yang sama lewat Nginx reverse proxy `/api`, gunakan:

```env
VITE_API_BASE_URL=/api
```

Lalu build:

```bash
cd client
npm ci
npm run build
```

Upload atau sajikan folder `client/dist` sebagai web root Nginx.

## 7. Nginx ringkas

```nginx
server {
  listen 80;
  server_name domain-anda;

  root /var/www/sppg-tlogorejo/client/dist;
  index index.html;

  location /api/ {
    proxy_pass http://127.0.0.1:4000/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```
