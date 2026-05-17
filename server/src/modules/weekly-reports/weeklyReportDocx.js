import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  PageNumber,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  HeightRule,
} from "docx";

const ID_MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const FONT = "Times New Roman";
const TITLE_SIZE = 28; // half-points → 14pt
const HEADING_SIZE = 26;
const BODY_SIZE = 22; // 11pt
const TABLE_SIZE = 18; // 9pt

function formatIdDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${ID_MONTHS[m - 1]} ${y}`;
}

function formatIdDateShort(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d}/${m}/${y}`;
}

function formatPeriodLabel(startIso, endIso) {
  if (!startIso || !endIso) return "";
  const [, sm, sd] = startIso.split("-").map(Number);
  const [ey, em, ed] = endIso.split("-").map(Number);
  if (sm === em) {
    return `${sd} – ${ed} ${ID_MONTHS[em - 1]} ${ey}`;
  }
  const [, , ] = startIso.split("-");
  return `${formatIdDate(startIso)} – ${formatIdDate(endIso)}`;
}

function run(text, options = {}) {
  return new TextRun({
    text: String(text ?? ""),
    font: FONT,
    size: options.size ?? BODY_SIZE,
    bold: options.bold ?? false,
    italics: options.italic ?? false,
    color: options.color,
  });
}

function paragraph(text, options = {}) {
  return new Paragraph({
    alignment: options.alignment ?? AlignmentType.JUSTIFIED,
    spacing: { after: options.after ?? 120, line: 300 },
    children: Array.isArray(text)
      ? text
      : [run(text, { size: options.size, bold: options.bold, italic: options.italic })],
    indent: options.indent,
    heading: options.heading,
  });
}

function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { before: 240, after: 160 },
    heading: level,
    children: [run(text, { bold: true, size: HEADING_SIZE })],
  });
}

function bulletList(textBlock) {
  return String(textBlock || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map(
      (line) =>
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 80, line: 280 },
          bullet: { level: 0 },
          children: [run(line)],
        })
    );
}

function multilineParagraphs(textBlock) {
  return String(textBlock || "")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => paragraph(block));
}

function thinBorder(size = 4) {
  return {
    top: { style: BorderStyle.SINGLE, size, color: "000000" },
    bottom: { style: BorderStyle.SINGLE, size, color: "000000" },
    left: { style: BorderStyle.SINGLE, size, color: "000000" },
    right: { style: BorderStyle.SINGLE, size, color: "000000" },
  };
}

function tableCell(content, options = {}) {
  const children = Array.isArray(content)
    ? content
    : [
        new Paragraph({
          alignment: options.alignment ?? AlignmentType.LEFT,
          spacing: { after: 0 },
          children: [
            run(content, {
              size: options.size ?? TABLE_SIZE,
              bold: options.bold ?? false,
            }),
          ],
        }),
      ];

  return new TableCell({
    width: options.width
      ? { size: options.width, type: WidthType.PERCENTAGE }
      : undefined,
    shading: options.shading
      ? { fill: options.shading, val: "clear", color: "auto" }
      : undefined,
    verticalAlign: options.verticalAlign,
    children,
    columnSpan: options.columnSpan,
  });
}

function buildCoverSection(settings, periodLabel) {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 1600, after: 240 },
      children: [run("LAPORAN PELAKSANAAN", { bold: true, size: TITLE_SIZE })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [run("PROGRAM MAKAN BERGIZI GRATIS", { bold: true, size: TITLE_SIZE })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
      children: [run(settings.sppg_name, { bold: true, size: HEADING_SIZE })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [run(`Id SPPG : ${settings.sppg_id}`, { bold: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [run(settings.yayasan_name, { bold: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
      children: [run(`Periode ${periodLabel}`, { bold: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [run(`KECAMATAN ${(settings.kecamatan || "").toUpperCase()}`, { bold: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [run(`KABUPATEN ${(settings.kabupaten || "").toUpperCase()}`, { bold: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 1200 },
      children: [run(`PROVINSI ${(settings.provinsi || "").toUpperCase()}`, { bold: true })],
    }),
    new Paragraph({ children: [run("")], pageBreakBefore: true }),
  ];
}

function buildBabIPendahuluan(settings, data) {
  const sasaranByCategory = data.targetByCategory;
  const total = data.totalTarget || 0;

  const sasaranLines = [
    [`1) ${data.categoryLabel["PAUD/TK/KB"] || "Siswa TK/PAUD/RA"}`, sasaranByCategory["PAUD/TK/KB"] || 0],
    [`2) ${data.categoryLabel["SD"] || "Siswa SD/MI"}`, sasaranByCategory["SD"] || 0],
    [`3) ${data.categoryLabel["SMP"] || "Siswa SMP/MTs"}`, sasaranByCategory["SMP"] || 0],
    [`4) ${data.categoryLabel["SMK"] || "Siswa SMA/MA/SMK"}`, sasaranByCategory["SMK"] || 0],
  ];

  return [
    heading("BAB I. PENDAHULUAN"),
    paragraph([run("Latar Belakang", { bold: true })]),
    ...multilineParagraphs(settings.narasi_latar_belakang),

    paragraph([run("Tujuan", { bold: true })]),
    paragraph("Program ini bertujuan untuk:"),
    ...bulletList(settings.narasi_tujuan),

    paragraph([run("Sasaran", { bold: true })]),
    paragraph(
      `Sasaran program makan bergizi gratis di ${settings.sppg_name} ini adalah:`
    ),
    ...sasaranLines.map(
      ([label, value]) =>
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { after: 60 },
          children: [run(`${label}\t: ${Number(value).toLocaleString("id-ID")}`)],
        })
    ),
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before: 80, after: 240 },
      children: [
        run(`Total sasaran penerima manfaat: ${Number(total).toLocaleString("id-ID")}`, {
          bold: true,
        }),
      ],
    }),
  ];
}

function buildDailyTable(dayData, units, kecamatan) {
  const rows = [];

  rows.push(
    new TableRow({
      tableHeader: true,
      height: { value: 360, rule: HeightRule.ATLEAST },
      children: [
        tableCell("No", { bold: true, alignment: AlignmentType.CENTER, shading: "DDDDDD", width: 5 }),
        tableCell("Kecamatan", { bold: true, alignment: AlignmentType.CENTER, shading: "DDDDDD", width: 14 }),
        tableCell("Nama Sekolah", { bold: true, alignment: AlignmentType.CENTER, shading: "DDDDDD", width: 30 }),
        tableCell("Alamat Sekolah", { bold: true, alignment: AlignmentType.CENTER, shading: "DDDDDD", width: 36 }),
        tableCell("Jumlah siswa / Kelompok Sasaran Lain yang Mendapat MBG", {
          bold: true,
          alignment: AlignmentType.CENTER,
          shading: "DDDDDD",
          width: 15,
        }),
      ],
    })
  );

  dayData.rows.forEach((row, index) => {
    const isLibur = String(row.service_status || "").toLowerCase() === "libur" || row.actual_pm <= 0;
    const value = isLibur ? "Libur" : Number(row.actual_pm).toLocaleString("id-ID");
    rows.push(
      new TableRow({
        children: [
          tableCell(`${index + 1}.`, { alignment: AlignmentType.CENTER }),
          tableCell(kecamatan || "", { alignment: AlignmentType.LEFT }),
          tableCell(row.unit_name || "-"),
          tableCell(row.unit_address || "-"),
          tableCell(value, { alignment: AlignmentType.CENTER }),
        ],
      })
    );
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
    borders: thinBorder(),
  });
}

function buildBabIIPelaksanaan(settings, data) {
  const elements = [
    heading("BAB II. PELAKSANAAN KEGIATAN"),
    paragraph([run("Persiapan (koordinasi lintas sektor)", { bold: true })]),
    paragraph([run("a. Koordinasi dengan pihak pimpinan Sekolah", { bold: true })]),
    paragraph(
      "Hasil koordinasi: Validasi jumlah penerima manfaat. Pemberian teknis pendistribusian, jam pendistribusian yang disesuaikan dengan jam istirahat, serta pengembalian ompreng dari sekolah."
    ),
    paragraph([run(`b. Koordinasi dengan Dinas Kesehatan Kabupaten ${settings.kabupaten}`, { bold: true })]),
    paragraph(
      "Hasil koordinasi: Dinas Kesehatan melakukan monitoring, evaluasi, serta tindakan penanganan apabila terjadi KLB pada saat pelaksanaan makan bergizi gratis. Dinas Kesehatan memberikan beberapa materi dalam acara sosialisasi terkait program MBG."
    ),
    paragraph([run(`c. Koordinasi dengan Pemda Kecamatan ${settings.kecamatan}`, { bold: true })]),
    paragraph(
      "Hasil Koordinasi: Harapannya ekonomi lokal dan pedesaan dapat tumbuh dengan adanya program MBG ini. Mereka membantu kami untuk membuat kajian mengenai ekosistem bisnis yang bisa dijalankan dengan adanya program MBG."
    ),

    paragraph([run("Pelaksanaan", { bold: true })]),
    paragraph(
      `Program makan bergizi gratis di beberapa sekolah di Kecamatan ${settings.kecamatan} dapat memberikan berbagai lesson learned atau pembelajaran penting, antara lain:`
    ),
    ...bulletList(settings.narasi_pelaksanaan_lessons),

    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before: 240, after: 160 },
      children: [run("1) Penerima Makan Bergizi Gratis (MBG)", { bold: true, size: HEADING_SIZE })],
    }),
  ];

  data.dailyTables.forEach((day) => {
    elements.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 200, after: 60 },
        bullet: { level: 0 },
        children: [run(`Tanggal\t\t\t: ${formatIdDate(day.date)}`, { bold: true })],
      })
    );
    elements.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 120 },
        indent: { left: 360 },
        children: [
          run(
            `Jumlah Penerima Manfaat\t: ${Number(day.total_pm).toLocaleString("id-ID")}`,
            { bold: true }
          ),
        ],
      })
    );
    elements.push(buildDailyTable(day, data.units, settings.kecamatan));
    elements.push(paragraph(""));
  });

  return elements;
}

function buildMenuTable(data) {
  const rows = [
    new TableRow({
      tableHeader: true,
      children: [
        tableCell("No", { bold: true, alignment: AlignmentType.CENTER, shading: "DDDDDD", width: 6 }),
        tableCell("Tanggal", { bold: true, alignment: AlignmentType.CENTER, shading: "DDDDDD", width: 18 }),
        tableCell("Menu MBG", { bold: true, alignment: AlignmentType.CENTER, shading: "DDDDDD", width: 76 }),
      ],
    }),
  ];

  data.dates.forEach((iso, index) => {
    const menu = data.menuByDate.get(iso);
    const items = menu
      ? [menu.menu_name_1, menu.menu_name_2, menu.menu_name_3, menu.menu_name_4, menu.menu_name_5]
          .filter(Boolean)
      : [];

    let menuContent;
    if (items.length === 0) {
      menuContent = [
        new Paragraph({
          spacing: { after: 0 },
          children: [run(menu?.menu_name || "-", { size: TABLE_SIZE, italic: !menu })],
        }),
      ];
    } else {
      menuContent = items.map(
        (name) =>
          new Paragraph({
            spacing: { after: 40 },
            bullet: { level: 0 },
            children: [run(name, { size: TABLE_SIZE })],
          })
      );
    }

    rows.push(
      new TableRow({
        children: [
          tableCell(`${index + 1}.`, { alignment: AlignmentType.CENTER }),
          tableCell(formatIdDateShort(iso), { alignment: AlignmentType.CENTER }),
          tableCell(menuContent),
        ],
      })
    );
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
    borders: thinBorder(),
  });
}

function buildBabIIIPermasalahan(settings) {
  return [
    heading("BAB III. PERMASALAHAN DAN KENDALA"),
    paragraph([run("Permasalahan dan Kendala", { bold: true })]),
    ...bulletList(settings.narasi_kendala),
    paragraph([run("Penanganan Permasalahan", { bold: true })]),
    ...bulletList(settings.narasi_penanganan),
    paragraph([run("Rencana Tindak Lanjut", { bold: true })]),
    ...bulletList(settings.narasi_rencana_lanjut),
  ];
}

function buildBabIVPenutup(settings, periodEndDate) {
  const elements = [
    heading("BAB IV. PENUTUP"),
    ...multilineParagraphs(settings.narasi_penutup),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 480, after: 240 },
      children: [run(`${settings.kecamatan}, ${formatIdDate(periodEndDate)}`)],
    }),
  ];

  const sigRow = new TableRow({
    children: [
      new TableCell({
        width: { size: 50, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        },
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, children: [run(`Ketua ${settings.yayasan_name}`, { bold: true })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 1200 }, children: [run("")] }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [run(settings.ketua_yayasan_name, { bold: true })],
          }),
        ],
      }),
      new TableCell({
        width: { size: 50, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        },
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, children: [run(`K.A Satuan Pemenuhan Gizi ${settings.sppg_name}`, { bold: true })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 1200 }, children: [run("")] }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [run(settings.kepala_sppg_name, { bold: true })],
          }),
        ],
      }),
    ],
  });

  elements.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [sigRow],
      borders: {
        top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      },
    })
  );

  return elements;
}

export async function buildWeeklyReportDocx({ data, settings }) {
  const periodLabel = formatPeriodLabel(data.range.start_date, data.range.end_date);

  const cover = buildCoverSection(settings, periodLabel);
  const bab1 = buildBabIPendahuluan(settings, data);
  const bab2 = buildBabIIPelaksanaan(settings, data);
  const menuSection = [
    heading("Ringkasan Menu Harian", HeadingLevel.HEADING_2),
    buildMenuTable(data),
  ];
  const bab3 = buildBabIIIPermasalahan(settings);
  const bab4 = buildBabIVPenutup(settings, data.range.end_date);

  const doc = new Document({
    creator: "SPPG Tlogorejo",
    title: `Laporan Mingguan ${periodLabel}`,
    description: `Laporan Pelaksanaan Program MBG ${periodLabel}`,
    styles: {
      default: {
        document: {
          run: { font: FONT, size: BODY_SIZE },
        },
      },
    },
    sections: [
      {
        properties: {
          page: { margin: { top: 1440, right: 1080, bottom: 1440, left: 1440 } },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  run("Halaman "),
                  new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: BODY_SIZE }),
                  run(" dari "),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: BODY_SIZE }),
                ],
              }),
            ],
          }),
        },
        children: [
          ...cover,
          ...bab1,
          ...bab2,
          ...menuSection,
          ...bab3,
          ...bab4,
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return { buffer, periodLabel };
}

export function buildDocxFilename(periodLabel, settings) {
  const safe = String(periodLabel || "")
    .replace(/[\\/:*?"<>|]/g, "")
    .trim() || "Laporan";
  const sppg = String(settings?.sppg_name || "SPPG").replace(/[\\/:*?"<>|]/g, "");
  return `${safe} Laporan Mingguan ${sppg}.docx`;
}
