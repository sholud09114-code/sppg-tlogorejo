-- Add address column to beneficiary_groups (synced into units.address)
USE sppg_tlogorejo;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'beneficiary_groups'
     AND COLUMN_NAME = 'address'
);
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE beneficiary_groups ADD COLUMN address VARCHAR(255) NULL AFTER group_name',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
