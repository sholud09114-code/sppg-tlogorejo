-- Add read-path indexes used by dashboard and report list pages.

USE sppg_tlogorejo;

DROP PROCEDURE IF EXISTS add_index_if_missing;

DELIMITER //
CREATE PROCEDURE add_index_if_missing(
  IN p_table_name VARCHAR(64),
  IN p_index_name VARCHAR(64),
  IN p_create_statement TEXT
)
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.tables
     WHERE table_schema = DATABASE()
       AND table_name = p_table_name
  ) AND NOT EXISTS (
    SELECT 1
      FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = p_table_name
       AND index_name = p_index_name
  ) THEN
    SET @create_index_sql = p_create_statement;
    PREPARE create_index_stmt FROM @create_index_sql;
    EXECUTE create_index_stmt;
    DEALLOCATE PREPARE create_index_stmt;
  END IF;
END//
DELIMITER ;

CALL add_index_if_missing(
  'daily_reports',
  'idx_daily_reports_updated_at',
  'CREATE INDEX idx_daily_reports_updated_at ON daily_reports (updated_at)'
);

CALL add_index_if_missing(
  'daily_report_details',
  'idx_daily_report_details_updated_at',
  'CREATE INDEX idx_daily_report_details_updated_at ON daily_report_details (updated_at)'
);

CALL add_index_if_missing(
  'beneficiary_groups',
  'idx_beneficiary_groups_updated_at',
  'CREATE INDEX idx_beneficiary_groups_updated_at ON beneficiary_groups (updated_at)'
);

CALL add_index_if_missing(
  'menu_reports',
  'idx_menu_reports_updated_at',
  'CREATE INDEX idx_menu_reports_updated_at ON menu_reports (updated_at)'
);

CALL add_index_if_missing(
  'item_masters',
  'idx_item_masters_updated_at',
  'CREATE INDEX idx_item_masters_updated_at ON item_masters (updated_at)'
);

CALL add_index_if_missing(
  'shopping_reports',
  'idx_shopping_reports_updated_at',
  'CREATE INDEX idx_shopping_reports_updated_at ON shopping_reports (updated_at)'
);

CALL add_index_if_missing(
  'shopping_report_items',
  'idx_shopping_report_items_master_item_id',
  'CREATE INDEX idx_shopping_report_items_master_item_id ON shopping_report_items (master_item_id)'
);

CALL add_index_if_missing(
  'shopping_report_items',
  'idx_shopping_report_items_updated_at',
  'CREATE INDEX idx_shopping_report_items_updated_at ON shopping_report_items (updated_at)'
);

CALL add_index_if_missing(
  'food_waste_reports',
  'idx_food_waste_reports_updated_at',
  'CREATE INDEX idx_food_waste_reports_updated_at ON food_waste_reports (updated_at)'
);

DROP PROCEDURE IF EXISTS add_index_if_missing;
