-- Report drafts: editable WeeklyReportDraft documents that drive the
-- A4 preview and PDF export. One row per draft document.

USE sppg_tlogorejo;

CREATE TABLE IF NOT EXISTS report_drafts (
  id                  CHAR(36)        NOT NULL PRIMARY KEY,
  report_type         VARCHAR(40)     NOT NULL DEFAULT 'weekly',
  sppg_id             VARCHAR(40)     NULL,
  start_date          DATE            NOT NULL,
  end_date            DATE            NOT NULL,
  title               VARCHAR(255)    NULL,
  status              ENUM('draft','final') NOT NULL DEFAULT 'draft',
  data_json           JSON            NOT NULL,
  generated_pdf_path  VARCHAR(500)    NULL,
  created_by          INT             NULL,
  updated_by          INT             NULL,
  created_at          TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_report_drafts_creator
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_report_drafts_updater
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_report_drafts_range (report_type, start_date, end_date),
  INDEX idx_report_drafts_status (status),
  INDEX idx_report_drafts_updated_at (updated_at)
) ENGINE=InnoDB;
