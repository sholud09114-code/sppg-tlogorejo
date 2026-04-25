-- SPPG Tlogorejo — Database Schema
-- Phase 1: Daily Beneficiary Report Module

CREATE DATABASE IF NOT EXISTS sppg_tlogorejo
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE sppg_tlogorejo;

-- =========================================
-- Users and role access
-- =========================================
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  username VARCHAR(80) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'publik') NOT NULL DEFAULT 'publik',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_username (username),
  INDEX idx_users_role (role)
) ENGINE=InnoDB;

-- =========================================
-- Master data: units / schools
-- =========================================
CREATE TABLE IF NOT EXISTS units (
  id INT AUTO_INCREMENT PRIMARY KEY,
  beneficiary_group_id INT NULL,
  name VARCHAR(150) NOT NULL,
  category ENUM('PAUD/TK/KB', 'SD', 'SMP', 'SMK') NOT NULL,
  default_target INT NOT NULL DEFAULT 0,
  display_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_units_beneficiary_group_id (beneficiary_group_id),
  INDEX idx_beneficiary_group_id (beneficiary_group_id),
  INDEX idx_category (category),
  INDEX idx_active (is_active)
) ENGINE=InnoDB;

-- =========================================
-- Daily report header (one row per date)
-- =========================================
CREATE TABLE IF NOT EXISTS daily_reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  report_date DATE NOT NULL UNIQUE,
  total_pm INT NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_date (report_date)
) ENGINE=InnoDB;

-- =========================================
-- Daily report detail (one row per unit per date)
-- =========================================
CREATE TABLE IF NOT EXISTS daily_report_details (
  id INT AUTO_INCREMENT PRIMARY KEY,
  report_id INT NOT NULL,
  unit_id INT NOT NULL,
  target_pm INT NOT NULL DEFAULT 0,
  service_status ENUM('penuh', 'libur', 'sebagian') NOT NULL,
  actual_pm INT NOT NULL DEFAULT 0,
  actual_small_portion INT NOT NULL DEFAULT 0,
  actual_large_portion INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_report FOREIGN KEY (report_id) REFERENCES daily_reports(id) ON DELETE CASCADE,
  CONSTRAINT fk_unit FOREIGN KEY (unit_id) REFERENCES units(id),
  UNIQUE KEY uq_report_unit (report_id, unit_id),
  INDEX idx_report (report_id),
  INDEX idx_unit (unit_id)
) ENGINE=InnoDB;

-- =========================================
-- Beneficiary groups
-- =========================================
CREATE TABLE IF NOT EXISTS beneficiary_groups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  group_type ENUM('Paud/KB/TK', 'SD', 'SMP/MTs', 'SMK') NOT NULL,
  group_name VARCHAR(150) NOT NULL,
  student_small_portion INT NOT NULL DEFAULT 0,
  student_large_portion INT NOT NULL DEFAULT 0,
  staff_small_portion INT NOT NULL DEFAULT 0,
  staff_large_portion INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_beneficiary_group_type (group_type),
  INDEX idx_beneficiary_group_name (group_name)
) ENGINE=InnoDB;

-- =========================================
-- Menu reports
-- =========================================
CREATE TABLE IF NOT EXISTS menu_reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  menu_date DATE NOT NULL,
  menu_name VARCHAR(150) NULL,
  menu_name_1 VARCHAR(150) NULL,
  menu_name_2 VARCHAR(150) NULL,
  menu_name_3 VARCHAR(150) NULL,
  menu_name_4 VARCHAR(150) NULL,
  menu_name_5 VARCHAR(150) NULL,
  energy DECIMAL(10,2) NOT NULL DEFAULT 0,
  protein DECIMAL(10,2) NOT NULL DEFAULT 0,
  fat DECIMAL(10,2) NOT NULL DEFAULT 0,
  carbohydrate DECIMAL(10,2) NOT NULL DEFAULT 0,
  fiber DECIMAL(10,2) NOT NULL DEFAULT 0,
  small_energy DECIMAL(10,2) NOT NULL DEFAULT 0,
  small_protein DECIMAL(10,2) NOT NULL DEFAULT 0,
  small_fat DECIMAL(10,2) NOT NULL DEFAULT 0,
  small_carbohydrate DECIMAL(10,2) NOT NULL DEFAULT 0,
  small_fiber DECIMAL(10,2) NOT NULL DEFAULT 0,
  large_energy DECIMAL(10,2) NOT NULL DEFAULT 0,
  large_protein DECIMAL(10,2) NOT NULL DEFAULT 0,
  large_fat DECIMAL(10,2) NOT NULL DEFAULT 0,
  large_carbohydrate DECIMAL(10,2) NOT NULL DEFAULT 0,
  large_fiber DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_menu_date (menu_date),
  INDEX idx_menu_name (menu_name)
) ENGINE=InnoDB;

-- =========================================
-- Shopping reports
-- =========================================
CREATE TABLE IF NOT EXISTS shopping_reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  report_date DATE NOT NULL,
  menu_name VARCHAR(200) NOT NULL,
  small_portion_count DECIMAL(12,2) NOT NULL DEFAULT 0,
  large_portion_count DECIMAL(12,2) NOT NULL DEFAULT 0,
  daily_budget DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_spending DECIMAL(12,2) NOT NULL DEFAULT 0,
  difference_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  item_count INT NOT NULL DEFAULT 0,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_shopping_report_date (report_date),
  INDEX idx_shopping_menu_name (menu_name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS item_masters (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item_code VARCHAR(50) NOT NULL,
  item_name VARCHAR(200) NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT '',
  default_unit VARCHAR(50) NOT NULL DEFAULT '',
  default_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_item_master_code (item_code),
  INDEX idx_item_master_name (item_name),
  INDEX idx_item_master_active (is_active)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS shopping_report_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  report_id INT NOT NULL,
  master_item_id INT NULL,
  description VARCHAR(200) NOT NULL,
  qty DECIMAL(12,2) NOT NULL DEFAULT 0,
  unit_name VARCHAR(50) NOT NULL DEFAULT '',
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes VARCHAR(255) NULL,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_shopping_report_items_report
    FOREIGN KEY (report_id) REFERENCES shopping_reports(id) ON DELETE CASCADE,
  CONSTRAINT fk_shopping_report_items_master
    FOREIGN KEY (master_item_id) REFERENCES item_masters(id) ON DELETE SET NULL,
  INDEX idx_shopping_report_items_report (report_id),
  INDEX idx_shopping_report_items_order (display_order)
) ENGINE=InnoDB;

-- =========================================
-- Seed data: list of schools/units
-- =========================================
INSERT INTO units (name, category, default_target, display_order) VALUES
  ('KB Mawaddah',              'PAUD/TK/KB', 50, 1),
  ('TPA Al-Hidayah',           'PAUD/TK/KB', 50, 2),
  ('KB Masyitoh Jurang',       'PAUD/TK/KB', 50, 3),
  ('KB Al Kautsar',            'PAUD/TK/KB', 50, 4),
  ('RA Masyitoh Jurang',       'PAUD/TK/KB', 50, 5),
  ('RA Nurul Iman Joho',       'PAUD/TK/KB', 50, 6),
  ('RA Al Iman Tlogorejo',     'PAUD/TK/KB', 50, 7),
  ('TK Tahfidz Sain Permata',  'PAUD/TK/KB', 50, 8),
  ('TK Al Kautsar',            'PAUD/TK/KB', 50, 9),
  ('SD N Tlogorejo',           'SD',         50, 10),
  ('SMP N 4 Temanggung',       'SMP',        50, 11),
  ('SMP Al Kautsar',           'SMP',        50, 12),
  ('MTs Integrasi Al Hudlori', 'SMP',        50, 13),
  ('SMK HKTI Temanggung',      'SMK',        50, 14);
