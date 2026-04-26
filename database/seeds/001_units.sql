-- Idempotent seed for units / schools.

USE sppg_tlogorejo;

CREATE TEMPORARY TABLE seed_units (
  name VARCHAR(150) NOT NULL PRIMARY KEY,
  category ENUM('PAUD/TK/KB', 'SD', 'SMP', 'SMK') NOT NULL,
  default_target INT NOT NULL DEFAULT 0,
  display_order INT NOT NULL DEFAULT 0
) ENGINE=Memory;

INSERT INTO seed_units (name, category, default_target, display_order) VALUES
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

INSERT INTO units (name, category, default_target, display_order)
SELECT seed.name, seed.category, seed.default_target, seed.display_order
  FROM seed_units seed
 WHERE NOT EXISTS (
   SELECT 1
     FROM units existing
    WHERE existing.name = seed.name
 );

UPDATE units unit
JOIN seed_units seed ON seed.name = unit.name
   SET unit.category = seed.category,
       unit.default_target = seed.default_target,
       unit.display_order = seed.display_order;

DROP TEMPORARY TABLE seed_units;
