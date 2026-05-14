-- Add weekly menu planning tables.

USE sppg_tlogorejo;

CREATE TABLE IF NOT EXISTS menu_plans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  year SMALLINT NOT NULL,
  month TINYINT NOT NULL,
  week_number TINYINT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_menu_plans_year_month_week (year, month, week_number),
  INDEX idx_menu_plans_start_date (start_date),
  INDEX idx_menu_plans_updated_at (updated_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS menu_plan_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  plan_id INT NOT NULL,
  plan_date DATE NOT NULL,
  day_of_week TINYINT NOT NULL,
  category ENUM(
    'karbohidrat',
    'protein_hewani',
    'protein_nabati',
    'sayur',
    'buah'
  ) NOT NULL,
  menu_name VARCHAR(200) NOT NULL,
  portion_target ENUM('all', 'PMB', 'PMK') NOT NULL DEFAULT 'all',
  is_holiday TINYINT(1) NOT NULL DEFAULT 0,
  sort_order TINYINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_menu_plan_items_plan
    FOREIGN KEY (plan_id) REFERENCES menu_plans(id) ON DELETE CASCADE,
  INDEX idx_menu_plan_items_plan (plan_id),
  INDEX idx_menu_plan_items_date (plan_date),
  INDEX idx_menu_plan_items_category (plan_id, category),
  INDEX idx_menu_plan_items_day (plan_id, day_of_week)
) ENGINE=InnoDB;
