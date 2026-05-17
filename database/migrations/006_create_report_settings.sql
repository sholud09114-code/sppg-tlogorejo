-- Report settings: key-value store for boilerplate text and signing info
-- used by the weekly report DOCX generator.

USE sppg_tlogorejo;

CREATE TABLE IF NOT EXISTS report_settings (
  setting_key VARCHAR(80) NOT NULL PRIMARY KEY,
  setting_value MEDIUMTEXT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Optional: school address per unit (used by per-day distribution table).
-- Nullable so it can be filled in later by the admin.
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'units'
     AND COLUMN_NAME = 'address'
);
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE units ADD COLUMN address VARCHAR(255) NULL AFTER name',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
