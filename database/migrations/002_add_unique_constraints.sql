-- Add safe unique constraints after initial schema.
-- This migration does not deduplicate existing production data.

USE sppg_tlogorejo;

DELIMITER //

CREATE PROCEDURE add_uq_units_name_if_safe()
BEGIN
  IF EXISTS (
    SELECT 1
      FROM units
     GROUP BY name
    HAVING COUNT(*) > 1
     LIMIT 1
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Cannot add uq_units_name: duplicate units.name values exist. Resolve duplicates first.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = 'units'
       AND index_name = 'uq_units_name'
  ) THEN
    ALTER TABLE units ADD UNIQUE KEY uq_units_name (name);
  END IF;
END//

DELIMITER ;

CALL add_uq_units_name_if_safe();
DROP PROCEDURE add_uq_units_name_if_safe;

-- Report constraint recommendations:
-- 1. daily_reports.report_date is already unique in 001_init.sql.
-- 2. menu_reports can use UNIQUE KEY (menu_date) if the business rule is exactly one menu report per date.
-- 3. shopping_reports can use UNIQUE KEY (report_date) if the business rule is exactly one shopping report per date.
-- 4. If multiple shopping/menu entries per date are intentionally allowed, keep date indexes only.
