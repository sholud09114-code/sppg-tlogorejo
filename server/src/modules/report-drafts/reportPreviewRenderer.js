import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_CSS = readFileSync(
  path.resolve(__dirname, "reportTemplate.css"),
  "utf8"
);
const BGN_LOGO_DATA_URI = (() => {
  try {
    const buffer = readFileSync(
      path.resolve(__dirname, "../../../../client/src/assets/bgn-logo-color-optimized.png")
    );
    return `data:image/png;base64,${buffer.toString("base64")}`;
  } catch {
    return "";
  }
})();

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function nl2br(value) {
  return escapeHtml(value).replace(/\n/g, "<br/>");
}

function paragraphs(value) {
  return String(value || "")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${nl2br(block)}</p>`)
    .join("\n");
}

function listItems(values, opts = {}) {
  const tag = opts.ordered ? "ol" : "ul";
  const className = opts.ordered ? ' class="ordered-list"' : ' class="bullet-list"';
  if (!values || !values.length) return "";
  return `<${tag}${className}>\n${values
    .map((line) => `  <li>${nl2br(line)}</li>`)
    .join("\n")}\n</${tag}>`;
}

function formatNumber(value) {
  if (value === "-" || value == null || value === "") return "-";
  const n = Number(value);
  if (!Number.isFinite(n)) return escapeHtml(value);
  return n.toLocaleString("id-ID");
}

function renderCover(report, baseUrl) {
  const logoSrc = BGN_LOGO_DATA_URI || (baseUrl ? `${baseUrl}/assets/bgn-logo.png` : "/assets/bgn-logo.png");
  return `
    <section class="page cover">
      <img class="cover-logo" src="${escapeHtml(logoSrc)}" alt="Logo BGN" onerror="this.outerHTML='<div class=\\'cover-logo-fallback\\'>Logo BGN</div>'"/>
      <div class="cover-title">${escapeHtml(report.title || "LAPORAN PELAKSANAAN")}</div>
      <div class="cover-program">${escapeHtml(report.programName || "PROGRAM MAKAN BERGIZI GRATIS")}</div>
      <div class="cover-sppg">${escapeHtml(report.sppgName || "")}</div>
      <div class="cover-id">Id SPPG : ${escapeHtml(report.sppgId || "")}</div>
      <div class="cover-yayasan">${escapeHtml(report.foundationName || "")}</div>
      <div class="cover-period">${escapeHtml(report.periodLabel || "")}</div>
      <div class="cover-location">${escapeHtml((report.kecamatan || "").toUpperCase())}</div>
      <div class="cover-location">${escapeHtml((report.city || "").toUpperCase())}</div>
      <div class="cover-location">PROVINSI ${escapeHtml((report.province || "").toUpperCase())}</div>
    </section>
  `;
}

function formatSppgLabel(value) {
  const name = String(value || "").trim();
  if (!name) return "";
  return /^SPPG\b/i.test(name) ? name : `SPPG ${name}`;
}

function renderBabI(draft) {
  const { chapters, report } = draft;
  const goalsList = chapters.goals?.length
    ? `<p>Program ini bertujuan untuk:</p>${listItems(chapters.goals, { ordered: true })}`
    : "";

  const targetRows = (chapters.targets || [])
    .map(
      (row, index) => `
      <li>
        <span>${index + 1})</span>
        <span class="target-label">${escapeHtml(row.category)}</span>
        <span>: ${formatNumber(row.total)}</span>
      </li>`
    )
    .join("\n");

  return `
    <section class="page">
      <div class="report-subtitle">
        <h1 class="report-title">Laporan Pelaksanaan Program Makan Bergizi Gratis</h1>
        <p>Satuan Pelayanan Pemenuhan Gizi (SPPG) ${escapeHtml(formatSppgLabel(report.sppgName))}</p>
        <p>Id SPPG : ${escapeHtml(report.sppgId || "")}</p>
      </div>

      <h2 class="bab">BAB I. PENDAHULUAN</h2>

      <h3 class="subbab">a. Latar Belakang</h3>
      ${paragraphs(chapters.background)}

      <h3 class="subbab">b. Tujuan</h3>
      ${goalsList}

      <h3 class="subbab">c. Sasaran</h3>
      <p class="no-indent">Sasaran program makan bergizi gratis di ${escapeHtml(report.sppgName || "")} ini adalah:</p>
      <ul class="target-list">
        ${targetRows}
      </ul>
      <div class="target-total">Total sasaran penerima manfaat : ${formatNumber(chapters.targetTotal)}</div>
    </section>
  `;
}

function renderPreparation(preparation) {
  if (!preparation || !preparation.length) return "";
  const ROMAN = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"];
  return preparation
    .map(
      (item, index) => `
      <h4 class="subsubbab prep-heading">${ROMAN[index] || index + 1}. ${escapeHtml(item.title || "")}</h4>
      <p class="no-indent coordination-label">Hasil koordinasi:</p>
      ${listItems(item.points || [])}
    `
    )
    .join("\n");
}

function renderDailyTable(day) {
  const rows = (day.rows || [])
    .map(
      (row) => `
      <tr>
        <td class="text-center">${escapeHtml(String(row.no))}.</td>
        <td>${escapeHtml(row.district || "")}</td>
        <td>${escapeHtml(row.schoolName || "")}</td>
        <td>${escapeHtml(row.address || "")}</td>
        <td class="text-center">${formatNumber(row.recipientCount)}</td>
      </tr>`
    )
    .join("\n");

  return `
    <div class="daily-table-group">
      <div class="daily-block">
        <p class="daily-meta"><strong>• Tanggal</strong> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: ${escapeHtml(day.dateLabel || "")}</p>
        <p class="daily-meta recipient-count"><strong>Jumlah Penerima Manfaat : ${formatNumber(day.totalBeneficiaries)}</strong></p>
      </div>
      <table class="daily-recipient-table">
      <thead>
        <tr>
          <th style="width:6%">No</th>
          <th style="width:14%">Kecamatan</th>
          <th style="width:24%">Nama Sekolah</th>
          <th style="width:34%">Alamat Sekolah</th>
          <th style="width:22%">Jumlah siswa/ Kelompok Sasaran Lain yang Mendapat MBG</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
      </table>
    </div>
  `;
}

function renderBabII(draft) {
  const { chapters, dailyRecipients, menus } = draft;
  const dailyTables = (dailyRecipients || []).map(renderDailyTable).join("\n");

  const menuRows = (menus || [])
    .map(
      (menu) => `
      <tr>
        <td class="text-center text-top">${escapeHtml(String(menu.no))}</td>
        <td class="text-top">${escapeHtml(menu.city || "")}</td>
        <td class="text-top">
          <ul class="school-list">
            ${(menu.schools || []).map((s) => `<li>${escapeHtml(s)}</li>`).join("\n")}
          </ul>
        </td>
        <td class="text-center text-top">${escapeHtml(menu.dateLabel || "")}</td>
        <td class="text-top">
          <ul class="school-list">
            ${(menu.menuItems || []).map((s) => `<li>${escapeHtml(s)}</li>`).join("\n")}
          </ul>
        </td>
        <td class="text-top">${escapeHtml(menu.note || "")}</td>
      </tr>`
    )
    .join("\n");

  return `
    <section class="page">
      <h2 class="bab">BAB II. PELAKSANAAN KEGIATAN</h2>

      <h3 class="subbab">a. Persiapan (koordinasi lintas sektor)</h3>
      ${renderPreparation(chapters.preparation)}

      <h3 class="subbab">b. Pelaksanaan</h3>
      <p>${nl2br(chapters.implementation || "")}</p>
      ${listItems(chapters.lessons || [], { ordered: true })}

      <h3 class="subbab">1) Penerima Makan Bergizi Gratis (MBG)</h3>
      ${dailyTables}

      <h3 class="subbab">2) Jenis MBG yang diberikan</h3>
      <table>
        <thead>
          <tr>
            <th style="width:5%">No</th>
            <th style="width:13%">Kabupaten/Kota</th>
            <th style="width:30%">Nama Sekolah/ Posyandu</th>
            <th style="width:14%">Hari/ Tanggal Pemberian</th>
            <th style="width:28%">Menu MBG</th>
            <th style="width:10%">Ket</th>
          </tr>
        </thead>
        <tbody>
          ${menuRows}
        </tbody>
      </table>

      ${renderActivityPhotos(draft.activityPhotos || [])}
      ${renderMenuPhotos(draft.menuPhotos || [])}
    </section>
  `;
}

function renderActivityPhotos(photos) {
  if (!photos.length) {
    return `
      <h3 class="subbab">3. Dokumentasi Pemberian MBG</h3>
      <div class="photo-section-title">Dokumentasi Pemberian MBG</div>
      <div class="photo-grid">
        <div class="photo-cell empty">Belum ada foto</div>
        <div class="photo-cell empty">Belum ada foto</div>
      </div>
    `;
  }

  const sorted = [...photos].sort(
    (a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0)
  );
  const cells = sorted
    .map(
      (p) => `
      <div class="photo-cell">
        <img class="activity-photo" src="${escapeHtml(p.imageUrl || "")}" alt="${escapeHtml(p.caption || "")}"/>
        ${p.caption ? `<div class="photo-caption">${escapeHtml(p.caption)}</div>` : ""}
      </div>`
    )
    .join("\n");

  return `
    <h3 class="subbab">3. Dokumentasi Pemberian MBG</h3>
    <div class="photo-section-title">Dokumentasi Pemberian MBG</div>
    <div class="photo-grid">
      ${cells}
    </div>
  `;
}

function renderMenuPhotos(menuPhotos) {
  if (!menuPhotos.length) return "";
  const sorted = [...menuPhotos].sort(
    (a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0)
  );
  const rows = sorted
    .map(
      (p) => {
        const imageUrl = p.imageUrl === "auto-documentation" ? "" : p.imageUrl;
        return `
      <tr>
        <td class="text-center text-top">${escapeHtml(String(p.no))}.</td>
        <td class="text-top">
          <ul class="school-list">
            ${(p.schools || []).map((s) => `<li>${escapeHtml(s)}</li>`).join("\n")}
          </ul>
        </td>
        <td class="menu-photo-cell text-top">
          ${
            imageUrl
              ? `<img class="menu-photo" src="${escapeHtml(imageUrl)}" alt=""/>`
              : `<span class="menu-photo-empty">Belum ada foto</span>`
          }
        </td>
        <td class="text-center text-top">${escapeHtml(p.dateLabel || "")}</td>
      </tr>`;
      }
    )
    .join("\n");

  return `
    <h3 class="subbab" style="margin-top:6mm">Dokumentasi Menu</h3>
    <table>
      <thead>
        <tr>
          <th style="width:6%">No</th>
          <th style="width:36%">Nama Sekolah</th>
          <th style="width:42%">Dokumentasi Menu</th>
          <th style="width:16%">Tanggal</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

function renderBabIII(chapters) {
  return `
    <section class="page">
      <h2 class="bab">BAB III. PERMASALAHAN DAN KENDALA</h2>
      <h3 class="subbab">a. Permasalahan dan Kendala</h3>
      ${listItems(chapters.problems || [])}
      <h3 class="subbab">b. Penanganan Permasalahan</h3>
      ${listItems(chapters.solutions || [])}
      <h3 class="subbab">c. Rencana Tindak Lanjut</h3>
      ${listItems(chapters.followUps || [])}
    </section>
  `;
}

function renderBabIV(draft) {
  const { chapters, signatures } = draft;
  return `
    <section class="page">
      <h2 class="bab">BAB IV. PENUTUP</h2>
      <div class="closing-block">
        ${paragraphs(chapters.closing)}
      </div>

      <p class="signature-place">${escapeHtml(signatures?.placeDate || "")}</p>
      <table class="signature-table">
        <tbody>
          <tr>
            <td class="signature-cell">
              <p class="signature-title">${escapeHtml(signatures?.leftTitle || "")}</p>
              <div class="signature-spacer"></div>
              <p class="signature-name">${escapeHtml(signatures?.leftName || "")}</p>
            </td>
            <td class="signature-cell">
              <p class="signature-title">${escapeHtml(signatures?.rightTitle || "")}</p>
              <div class="signature-spacer"></div>
              <p class="signature-name">${escapeHtml(signatures?.rightName || "")}</p>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  `;
}

function renderBody(draft, baseUrl) {
  return [
    renderCover(draft.report || {}, baseUrl),
    renderBabI(draft),
    renderBabII(draft),
    renderBabIII(draft.chapters || {}),
    renderBabIV(draft),
  ].join("\n");
}

export function renderPreviewHtml(draft, options = {}) {
  const { mode = "preview", baseUrl = "" } = options;
  const body = renderBody(draft, baseUrl);
  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(draft?.report?.title || "Laporan")} — ${escapeHtml(draft?.report?.periodLabel || "")}</title>
  <style>${TEMPLATE_CSS}</style>
</head>
<body>
  <div class="report-doc" data-mode="${escapeHtml(mode)}">
    ${body}
  </div>
</body>
</html>`;
}

export const REPORT_TEMPLATE_CSS = TEMPLATE_CSS;
