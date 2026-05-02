# SPPG Mobile UI/UX Guidelines

Panduan ini menjadi acuan polish mobile untuk aplikasi operasional SPPG. Tujuannya menjaga halaman tetap compact, mudah dipindai, dan aman dipakai operator di layar HP tanpa mengubah logic bisnis.

## Prinsip Umum

- Prioritaskan pekerjaan utama pengguna: input laporan, review data, import, dan cek rekomendasi.
- Gunakan card/list layout untuk data padat di mobile; jangan memaksa tabel desktop tampil pada viewport kecil.
- Jaga spacing compact sekitar 10-15% dibanding desktop, tetapi touch target tetap nyaman.
- Hindari horizontal overflow seluruh halaman. Horizontal scroll hanya boleh untuk chip/action row yang jelas bisa digeser.
- Beri padding bawah konten untuk menghindari bottom navigation atau bottom submit bar menutup item terakhir.

## Page Mobile

- Header halaman harus ringkas: judul jelas, deskripsi pendek, action utama mudah terlihat.
- Summary metric gunakan grid 2 kolom jika memungkinkan.
- Jika jumlah metric ganjil, card terakhir boleh span 2 kolom.
- Card data harus menampilkan identitas utama di header, metrik inti di grid, dan action di bawah.
- Teks panjang dibatasi 2-3 baris dengan ellipsis jika berpotensi merusak layout.

## Modal Mobile

- Container modal: `max-height: calc(100vh - 24px)`, `display: flex`, `flex-direction: column`, `overflow: hidden`.
- Header modal ringkas, `flex-shrink: 0`, tombol X/close punya `aria-label`.
- Body modal harus scroll internal dengan `overflow-y: auto` dan `-webkit-overflow-scrolling: touch`.
- Sticky hanya untuk konteks utama yang penting, misalnya tanggal, dan bottom submit bar.
- Jangan membuat seluruh area kontrol atas sticky karena akan mengurangi ruang kerja.

## Bottom Submit Bar

- Gunakan ringkasan kecil di atas/samping tombol submit.
- Tombol utama full-width di mobile atau dominan di dalam bar.
- Disabled state harus tetap readable.
- Scroll area harus punya padding bawah cukup agar field terakhir tidak tertutup.

## Summary Card

- Gunakan label kecil dan angka yang lebih dominan.
- Padding mobile umumnya 10-14px.
- Icon summary bisa diperkecil di mobile.
- Hindari semua summary full-width jika datanya bisa dipindai dalam 2 kolom.

## Data Card

- Header: tanggal/nama utama, subtitle, badge kecil jika perlu.
- Metrik: 2 kolom untuk pasangan data, full-width hanya untuk total utama.
- Action: tombol Lihat/Edit/Hapus tetap touch-friendly.
- Danger action gunakan soft danger agar tidak terlalu dominan.

## Action Button

- Primary action memakai biru solid.
- Secondary action memakai soft/outline.
- Action row mobile boleh grid 2 kolom atau horizontal scroll.
- Jangan menyembunyikan action penting di mobile.
- Icon-only button wajib punya `aria-label`.

## Form Input

- Label selalu terlihat untuk field penting.
- Tinggi input mobile ideal 44-52px, boleh 38-42px untuk area padat yang tetap readable.
- Gunakan grid 2 kolom untuk field berpasangan seperti Qty/Satuan, Harga/Jumlah, Porsi kecil/Porsi besar.
- Field readonly harus terlihat berbeda dari input manual.
- Placeholder tidak boleh menggantikan label.

## Autocomplete

- Suggestion tidak boleh terpotong oleh parent container.
- Jika suggestion terbuka, row/card aktif boleh expand agar tidak menimpa field lain.
- Kode dan nama item harus ditampilkan jelas.
- Nama panjang boleh wrap maksimal 2 baris.
- Dropdown harus punya max-height dan scroll internal.

## Empty, Loading, Error, Success

- Empty state harus menjelaskan kondisi dan action berikutnya jika relevan.
- Loading state singkat dan tidak menggeser layout berlebihan.
- Error penting gunakan `role="alert"`.
- Info/success non-kritis gunakan `role="status"`.
- Import preview harus membedakan valid/error dengan teks, bukan warna saja.

## Warna Status

- Success: hijau soft untuk valid/siap.
- Warning: amber soft untuk perlu cek.
- Danger: merah soft untuk error/hapus.
- Info: biru soft untuk informasi.
- Neutral: slate/gray untuk kondisi tanpa histori atau belum tersedia.

## Formatter

- Rupiah: `Rp 20.241.500`, `Rp -1.511.500`.
- Berat: `47,3 kg`, `0,024 kg/porsi`.
- Persen: `2,40%`.
- Porsi: `1.972 porsi`.
- Tanggal panjang: `Rabu, 22 April 2026`.
- Formatting hanya untuk tampilan. Payload numeric tetap numeric.

## Checklist Sebelum Merge

- Tidak ada horizontal overflow pada 360/390/400/430px.
- Bottom navigation tidak menutup card/action terakhir.
- Modal bisa scroll internal.
- Bottom submit bar tidak menutup field terakhir.
- Filter chips dan action row tetap bisa digeser jika tidak muat.
- Autocomplete readable dan tidak terpotong.
- `npm run lint` sukses.
- `npm run build` sukses.
