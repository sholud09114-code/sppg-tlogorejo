import pool from "../../config/db.js";

let ensureReportSettingsTablePromise;

export function ensureReportSettingsTable() {
  if (!ensureReportSettingsTablePromise) {
    ensureReportSettingsTablePromise = (async () => {
      await pool.query(
        `CREATE TABLE IF NOT EXISTS report_settings (
          setting_key VARCHAR(80) NOT NULL PRIMARY KEY,
          setting_value MEDIUMTEXT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB`
      );

      const [columns] = await pool.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'units'
            AND COLUMN_NAME = 'address'`
      );
      if (columns.length === 0) {
        await pool.query(`ALTER TABLE units ADD COLUMN address VARCHAR(255) NULL AFTER name`);
      }
    })().catch((err) => {
      ensureReportSettingsTablePromise = null;
      throw err;
    });
  }

  return ensureReportSettingsTablePromise;
}

export const REPORT_SETTING_KEYS = [
  "sppg_name",
  "sppg_id",
  "yayasan_name",
  "kecamatan",
  "kabupaten",
  "provinsi",
  "ketua_yayasan_name",
  "kepala_sppg_name",
  "narasi_latar_belakang",
  "narasi_tujuan",
  "narasi_persiapan_json",
  "narasi_pelaksanaan_lessons",
  "narasi_kendala",
  "narasi_penanganan",
  "narasi_rencana_lanjut",
  "narasi_penutup",
];

const DEFAULT_PERSIAPAN = [
  {
    title: "Koordinasi dengan pihak pimpinan Sekolah",
    points: [
      "Validasi jumlah penerima manfaat.",
      "Pemberian teknis pendistribusian, jam pendistribusian yang disesuaikan dengan jam istirahat, serta pengembalian ompreng dari sekolah.",
    ],
  },
  {
    title: "Koordinasi dengan Dinas Kesehatan Kabupaten Temanggung",
    points: [
      "Dinas Kesehatan melakukan monitoring, evaluasi, serta tindakan penanganan apabila terjadi KLB pada saat pelaksanaan makan bergizi gratis.",
      "Dinas Kesehatan Kabupaten Temanggung memberikan beberapa materi dalam acara sosialisasi terkait program MBG.",
    ],
  },
  {
    title: "Koordinasi dengan Pemda Kecamatan Temanggung",
    points: [
      "Harapannya ekonomi lokal dan pedesaan dapat tumbuh dengan adanya program MBG ini. Mereka membantu kami untuk membuat kajian mengenai ekosistem bisnis yang bisa dijalankan dengan adanya program MBG agar selaras dengan Asta Cita yang digaungkan oleh Presiden RI ke-8 Bapak Prabowo Subianto.",
    ],
  },
];

export const DEFAULT_REPORT_SETTINGS = {
  sppg_name: "SPPG Temanggung Tlogorejo",
  sppg_id: "KKEU3BPJ",
  yayasan_name: "Yayasan Al Hudlori",
  kecamatan: "Temanggung",
  kabupaten: "Temanggung",
  provinsi: "Jawa Tengah",
  ketua_yayasan_name: "Abdul Hakim",
  kepala_sppg_name: "Sholeh Jamaluddin, S.I.P.",
  narasi_latar_belakang:
    "Masalah gizi merupakan salah satu tantangan utama dalam upaya meningkatkan kualitas sumber daya manusia di Indonesia. Kondisi gizi yang buruk, seperti kekurangan gizi kronis (stunting), gizi kurang, maupun obesitas, dapat berdampak negatif terhadap perkembangan fisik dan kognitif anak, yang pada akhirnya mempengaruhi prestasi akademik serta produktivitas di masa depan. Pemerintah, melalui Badan Gizi Nasional, telah menginisiasi berbagai program intervensi untuk mengatasi permasalahan ini, termasuk penyediaan makan bergizi gratis bagi anak-anak sekolah.\n\nProgram makan bergizi gratis bertujuan untuk memastikan bahwa anak-anak usia sekolah, balita, ibu hamil dan menyusui mendapatkan asupan gizi yang memadai, sehingga mereka dapat tumbuh dan berkembang secara optimal. Dalam pelaksanaannya, Badan Gizi Nasional bermitra dengan berbagai organisasi dan lembaga untuk membentuk Satuan Pelayanan Pemenuhan Gizi (SPPG), salah satunya bekerja sama dengan Yayasan Al Hudlori di Temanggung sebagai penerima bantuan pemerintah.\n\nPada periode ini, program dilaksanakan di wilayah layanan SPPG Temanggung Tlogorejo, dengan total sekolah penerima manfaat yang berasal dari satuan pendidikan jenjang KB/PAUD, TK/RA, SD/MI, SMP/MTs, serta SMA/SMK.\n\nKerja sama antara SPPG Temanggung Tlogorejo dan Badan Gizi Nasional (BGN) memastikan bahwa makanan yang diberikan memenuhi standar gizi seimbang, aman dikonsumsi, serta sesuai dengan kebutuhan dan selera peserta didik.",
  narasi_tujuan:
    "Meningkatkan status gizi peserta didik di sekolah yang berada di wilayah radius penerima manfaat di Kecamatan Temanggung.\nMengurangi risiko malnutrisi, baik gizi kurang maupun gizi buruk, pada anak-anak.\nMendukung kemampuan belajar peserta didik melalui penyediaan makanan yang bergizi.\nMeningkatkan kesadaran masyarakat tentang pentingnya pola makan sehat dan bergizi.\nMemperkuat sinergi antar-pihak dalam mendukung program intervensi gizi pemerintah.",
  narasi_persiapan_json: JSON.stringify(DEFAULT_PERSIAPAN),
  narasi_pelaksanaan_lessons:
    "Nutrisi yang cukup dapat meningkatkan kesehatan fisik dan kemampuan kognitif siswa, yang berpengaruh langsung pada konsentrasi dan prestasi belajar serta meningkatkan partisipasi siswa untuk datang ke sekolah.\nProgram ini dapat mengurangi kesenjangan sosial di antara siswa dengan latar belakang ekonomi yang berbeda. Semua anak mendapatkan akses yang sama terhadap makanan bergizi.\nSelain menyediakan makanan, program ini menjadi momen edukasi tentang pentingnya pola makan sehat bagi siswa dan keluarga.\nProgram ini menunjukkan bahwa keberhasilan inisiatif sosial sangat bergantung pada kolaborasi pemerintah, sekolah, orang tua, dan pihak swasta.\nPelaksanaan program menghadapi tantangan dalam distribusi makanan yang perlu terus dievaluasi.",
  narasi_kendala:
    "Bahan baku yang datang perlu dilakukan proses sortir yang teliti karena tidak semuanya dalam kondisi yang bagus.",
  narasi_penanganan:
    "Para koordinator selalu memberikan laporan setiap terjadi kendala dan kami memberikan arahan kepada para relawan khususnya para koordinator per tim terkait kendala yang dialami.\nMenghubungi pihak terkait khususnya jika terjadi kendala air mati.",
  narasi_rencana_lanjut:
    "Mengadakan evaluasi untuk menentukan menu MBG yang menjadi kegemaran penerima manfaat berdasarkan hasil food waste dan permintaan berupa request para siswa.\nMengadakan evaluasi kepada mitra dan semua relawan supaya kinerja mereka dapat berkembang sehingga MBG dapat terlaksana dengan lancar.\nMelakukan evaluasi rutin terhadap proses distribusi makanan bergizi untuk memastikan efektivitas sistem yang diterapkan pada SPPG.",
  narasi_penutup:
    "Pelaksanaan program makan bergizi gratis yang diselenggarakan oleh SPPG Temanggung Tlogorejo, bekerja sama dengan Yayasan Al Hudlori, berhasil dilaksanakan dengan baik. Program ini bertujuan untuk memberikan bantuan pangan yang bergizi kepada masyarakat, terutama anak-anak dan keluarga yang membutuhkan, guna mendukung pemenuhan kebutuhan gizi yang optimal dan mencegah masalah gizi buruk.\n\nKeberhasilan program ini tidak terlepas dari kerja sama yang solid antara berbagai pihak yang terlibat. Program MBG ini tidak hanya memenuhi kebutuhan pangan bagi penerima manfaat, tetapi juga menjadi bentuk perhatian dan kepedulian terhadap kesehatan masyarakat, khususnya di Kecamatan Temanggung.\n\nKami mengucapkan terima kasih yang sebesar-besarnya kepada semua pihak yang telah memberikan dukungan penuh dalam kelancaran program ini. Semoga program ini dapat menjadi langkah awal yang berkelanjutan dalam meningkatkan kesejahteraan masyarakat di Kecamatan Temanggung dan daerah lainnya.",
};

export async function getReportSettings() {
  await ensureReportSettingsTable();
  const [rows] = await pool.query(
    `SELECT setting_key, setting_value FROM report_settings`
  );
  const stored = Object.fromEntries(rows.map((row) => [row.setting_key, row.setting_value]));
  const result = { ...DEFAULT_REPORT_SETTINGS };
  REPORT_SETTING_KEYS.forEach((key) => {
    if (stored[key] != null) {
      result[key] = stored[key];
    }
  });
  return result;
}

export async function updateReportSettings(payload) {
  await ensureReportSettingsTable();
  const entries = Object.entries(payload || {}).filter(([key]) =>
    REPORT_SETTING_KEYS.includes(key)
  );

  if (!entries.length) return getReportSettings();

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const [key, value] of entries) {
      await conn.query(
        `INSERT INTO report_settings (setting_key, setting_value)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [key, value == null ? null : String(value)]
      );
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  return getReportSettings();
}
