-- Documentation photos: stores metadata for photos kept in Google Drive
-- across three categories: menu_daily, distribution, activity_other.

USE sppg_tlogorejo;

CREATE TABLE IF NOT EXISTS documentation_photos (
  id                 CHAR(36)        NOT NULL PRIMARY KEY,
  photo_type         ENUM('menu_daily','distribution','activity_other') NOT NULL,
  photo_date         DATE            NOT NULL,
  title              VARCHAR(255)    NULL,
  notes              TEXT            NULL,
  gdrive_file_id     VARCHAR(120)    NOT NULL,
  gdrive_view_url    VARCHAR(500)    NULL,
  gdrive_thumbnail_url VARCHAR(500)  NULL,
  mime_type          VARCHAR(100)    NULL,
  file_size_bytes    BIGINT          NULL,
  uploaded_by        INT             NULL,
  created_at         TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_documentation_photos_user
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY uq_documentation_photos_drive (gdrive_file_id),
  INDEX idx_documentation_photos_type_date (photo_type, photo_date),
  INDEX idx_documentation_photos_date (photo_date),
  INDEX idx_documentation_photos_updated_at (updated_at)
) ENGINE=InnoDB;
