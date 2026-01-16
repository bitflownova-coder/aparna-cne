-- ========================================
-- ANALYZE DUPLICATE DATA
-- Created: January 16, 2026
-- Purpose: Find duplicate MNC UIDs and registrations
-- ========================================

-- Run this to see what duplicates exist:
-- mysql -u u984810592_aparna_admin -p'sCARFACE@2003?.' u984810592_aparna_cne < analyze-duplicates.sql

-- 1. Find duplicate MNC UIDs in students table
SELECT 
    'DUPLICATE MNC UIDs IN STUDENTS' AS check_type,
    mncUID,
    COUNT(*) AS duplicate_count,
    GROUP_CONCAT(_id ORDER BY createdAt SEPARATOR ', ') AS student_ids,
    GROUP_CONCAT(fullName ORDER BY createdAt SEPARATOR ' | ') AS names
FROM students
WHERE mncUID IS NOT NULL AND mncUID != ''
GROUP BY mncUID
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 2. Find duplicate MNC Registration Numbers in students table
SELECT 
    'DUPLICATE MNC REG NUMBERS IN STUDENTS' AS check_type,
    mncRegistrationNumber,
    COUNT(*) AS duplicate_count,
    GROUP_CONCAT(_id ORDER BY createdAt SEPARATOR ', ') AS student_ids,
    GROUP_CONCAT(fullName ORDER BY createdAt SEPARATOR ' | ') AS names
FROM students
WHERE mncRegistrationNumber IS NOT NULL AND mncRegistrationNumber != ''
GROUP BY mncRegistrationNumber
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 3. Find duplicate (mncUID, workshopId) in registrations table
SELECT 
    'DUPLICATE REGISTRATIONS (SAME STUDENT, SAME WORKSHOP)' AS check_type,
    mncUID,
    workshopId,
    workshopTitle,
    COUNT(*) AS duplicate_count,
    GROUP_CONCAT(_id ORDER BY submittedAt SEPARATOR ', ') AS registration_ids,
    GROUP_CONCAT(formNumber ORDER BY submittedAt SEPARATOR ', ') AS form_numbers,
    GROUP_CONCAT(fullName ORDER BY submittedAt SEPARATOR ' | ') AS names
FROM registrations
WHERE mncUID IS NOT NULL AND mncUID != ''
GROUP BY mncUID, workshopId
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 4. Find duplicate (mncUID, workshopId) in attendance table
SELECT 
    'DUPLICATE ATTENDANCE (SAME STUDENT, SAME WORKSHOP)' AS check_type,
    mncUID,
    workshopId,
    COUNT(*) AS duplicate_count,
    GROUP_CONCAT(_id ORDER BY markedAt SEPARATOR ', ') AS attendance_ids,
    GROUP_CONCAT(studentName ORDER BY markedAt SEPARATOR ' | ') AS names
FROM attendance
WHERE mncUID IS NOT NULL AND mncUID != ''
GROUP BY mncUID, workshopId
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 5. Summary counts
SELECT 'SUMMARY' AS report_section, 'Total Students' AS metric, COUNT(*) AS count FROM students
UNION ALL
SELECT 'SUMMARY', 'Students with NULL/empty mncUID', COUNT(*) FROM students WHERE mncUID IS NULL OR mncUID = ''
UNION ALL
SELECT 'SUMMARY', 'Total Registrations', COUNT(*) FROM registrations
UNION ALL
SELECT 'SUMMARY', 'Registrations with NULL/empty mncUID', COUNT(*) FROM registrations WHERE mncUID IS NULL OR mncUID = ''
UNION ALL
SELECT 'SUMMARY', 'Total Attendance Records', COUNT(*) FROM attendance
UNION ALL
SELECT 'SUMMARY', 'Attendance with NULL/empty mncUID', COUNT(*) FROM attendance WHERE mncUID IS NULL OR mncUID = '';
