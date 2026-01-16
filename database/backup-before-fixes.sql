-- ========================================
-- DATABASE BACKUP SCRIPT
-- Created: January 16, 2026
-- Purpose: Backup critical tables before applying fixes
-- ========================================

-- Run this script BEFORE making any changes:
-- mysql -u u984810592_aparna_admin -p'sCARFACE@2003?.' u984810592_aparna_cne < backup-before-fixes.sql

-- Backup students table
CREATE TABLE IF NOT EXISTS students_backup_20260116 AS SELECT * FROM students;

-- Backup registrations table
CREATE TABLE IF NOT EXISTS registrations_backup_20260116 AS SELECT * FROM registrations;

-- Backup attendance table
CREATE TABLE IF NOT EXISTS attendance_backup_20260116 AS SELECT * FROM attendance;

-- Backup form_number_counters table
CREATE TABLE IF NOT EXISTS form_number_counters_backup_20260116 AS SELECT * FROM form_number_counters;

-- Verify backup counts
SELECT 'students' AS table_name, COUNT(*) AS original_count FROM students
UNION ALL
SELECT 'students_backup_20260116', COUNT(*) FROM students_backup_20260116
UNION ALL
SELECT 'registrations', COUNT(*) FROM registrations
UNION ALL
SELECT 'registrations_backup_20260116', COUNT(*) FROM registrations_backup_20260116
UNION ALL
SELECT 'attendance', COUNT(*) FROM attendance
UNION ALL
SELECT 'attendance_backup_20260116', COUNT(*) FROM attendance_backup_20260116
UNION ALL
SELECT 'form_number_counters', COUNT(*) FROM form_number_counters
UNION ALL
SELECT 'form_number_counters_backup_20260116', COUNT(*) FROM form_number_counters_backup_20260116;
