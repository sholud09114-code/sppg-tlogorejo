# Mobile QA Checklist SPPG

Gunakan checklist ini sebelum merge atau deploy perubahan UI mobile.

## Viewport

- [ ] Mobile 360px.
- [ ] Mobile 390px.
- [ ] Mobile 400px.
- [ ] Mobile 430px.
- [ ] Tablet 768px.
- [ ] Tablet 1024px.
- [ ] Desktop normal.

## Global

- [ ] Tidak ada horizontal overflow seluruh halaman.
- [ ] Bottom navigation tidak menutup konten terakhir.
- [ ] Header halaman tetap terbaca.
- [ ] Summary card tidak terlalu tinggi.
- [ ] Tombol utama jelas dan tombol sekunder tidak dominan.
- [ ] Action berbahaya tetap jelas tetapi soft.
- [ ] Empty/loading/error state tampil rapi.
- [ ] Toast tidak menutup action penting.

## Beranda

- [ ] Summary hari ini/keterangan kemarin terbaca.
- [ ] Action card tidak overlap.
- [ ] Rekomendasi dan anomali bisa dipindai.
- [ ] Tidak ada card yang terpotong bottom nav.

## Laporan Harian

- [ ] List laporan memakai card mobile.
- [ ] Modal input bisa scroll internal.
- [ ] Quick action lengkap: Semua penuh, Semua libur, Reset.
- [ ] Filter chips satu baris dan bisa digeser.
- [ ] Daftar unit terlihat tanpa banyak scroll awal.
- [ ] Bottom submit bar tidak menutup unit terakhir.
- [ ] Detail laporan harian compact dan tidak memaksa horizontal scroll.
- [ ] Import preview readable dan error jelas.

## Laporan Menu

- [ ] Tablet/mobile memakai card layout, bukan tabel desktop sempit.
- [ ] Nama menu panjang tidak merusak layout.
- [ ] Modal tambah/edit bisa scroll internal.
- [ ] Tanggal tetap jelas.
- [ ] Card menu compact.
- [ ] Matrix gizi mobile tidak memakai kolom satuan terpisah yang membuat baris tinggi.
- [ ] Bottom submit bar tidak menutup input terakhir.
- [ ] Detail menu readable tanpa overflow.

## Laporan Belanja

- [ ] Summary list 2 kolom.
- [ ] Item count tampil sebagai badge kecil.
- [ ] Selisih hanya memakai warna teks, bukan pill/kotak.
- [ ] Modal tambah/edit bisa scroll internal.
- [ ] Import gambar terlihat di mobile.
- [ ] Tambah baris ada di bawah daftar item.
- [ ] Field item punya label: Kode/barang, Uraian, Qty, Satuan, Harga, Jumlah, Catatan.
- [ ] Qty/Satuan dan Harga/Jumlah 2 kolom.
- [ ] Harga/Jumlah tampil Rupiah tetapi payload tetap numeric.
- [ ] Autocomplete tidak terpotong dan tidak menimpa field lain.

## Sisa Pangan

- [ ] Hero dan toolbar compact.
- [ ] Summary 2 kolom.
- [ ] Card laporan compact.
- [ ] Karbohidrat/Protein/Sayur/Buah 2 kolom.
- [ ] Total dan per porsi jelas.
- [ ] Modal edit scroll internal.
- [ ] Alert/chips status compact.
- [ ] Textarea menu tidak terlalu tinggi.
- [ ] Detail modal summary dan komposisi 2 kolom.

## Monitoring Harga

- [ ] Hero dan form deteksi compact.
- [ ] Checkbox memakai style UI aplikasi.
- [ ] Filter chips horizontal scroll dan chip terakhir terlihat.
- [ ] Card deteksi memisahkan nama barang, kode, dan menu.
- [ ] Status badge kecil.
- [ ] Harga sebelumnya/sekarang compact.
- [ ] Tombol Riwayat sejajar icon/teks.
- [ ] Chart tidak keluar viewport.
- [ ] Histori 0/1 data memakai state ringkas.
- [ ] Metric riwayat 2 kolom dan card ganjil full-width.

## Data Kelompok

- [ ] Hero/action/search/filter compact.
- [ ] Filter chips bisa digeser.
- [ ] KPI 2 kolom.
- [ ] Card kelompok hemat ruang.
- [ ] Total porsi jelas.
- [ ] Import modal readable.
- [ ] Preview import error/valid jelas.

## Laporan Mingguan

- [ ] Form rentang tanggal compact.
- [ ] Tanggal mulai/selesai 2 kolom jika cukup.
- [ ] Submit full-width.
- [ ] KPI summary 2 kolom.
- [ ] Dashboard section tetap readable.
- [ ] Rekomendasi/anomali tidak terlalu tinggi.

## Modal

- [ ] Container modal tidak melebihi viewport.
- [ ] Header compact.
- [ ] Tombol close punya `aria-label`.
- [ ] Body modal scroll internal.
- [ ] Bottom submit bar sticky jika ada.
- [ ] Field terakhir tidak tertutup bottom submit.
- [ ] Action tidak overlap.

## Flow

- [ ] Tambah data berhasil.
- [ ] Edit data berhasil.
- [ ] Hapus data menampilkan konfirmasi.
- [ ] Import data/gambar menampilkan loading, error, dan hasil.
- [ ] Autocomplete bisa dipilih dengan tap.
- [ ] Validasi error tampil jelas.
- [ ] Submit sukses/gagal memberi feedback.

## Regression

- [ ] Mobile tidak overflow.
- [ ] Tablet tidak overlap.
- [ ] Desktop tidak berubah/rusak.
- [ ] `npm run lint` sukses.
- [ ] `npm run build` sukses.
