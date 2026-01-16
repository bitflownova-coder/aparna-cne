-- ========================================
-- COMPREHENSIVE DUPLICATE ANALYSIS
-- Find ALL duplicates across all fields
-- ========================================

-- 1. Count duplicate MNC UIDs in students
SELECT 
    'DUPLICATE MNC UIDs' AS duplicate_type,
    COUNT(DISTINCT mncUID) AS unique_values_with_duplicates,
    SUM(duplicate_count - 1) AS total_duplicate_records
FROM (
    SELECT mncUID, COUNT(*) AS duplicate_count
    FROM students
    WHERE mncUID IS NOT NULL AND mncUID != ''
    GROUP BY mncUID
    HAVING COUNT(*) > 1
) AS dups;

-- 2. Count duplicate MNC Registration Numbers in students
SELECT 
    'DUPLICATE MNC REG NUMBERS' AS duplicate_type,
    COUNT(DISTINCT mncRegistrationNumber) AS unique_values_with_duplicates,
    SUM(duplicate_count - 1) AS total_duplicate_records
FROM (
    SELECT mncRegistrationNumber, COUNT(*) AS duplicate_count
    FROM students
    WHERE mncRegistrationNumber IS NOT NULL AND mncRegistrationNumber != ''
    GROUP BY mncRegistrationNumber
    HAVING COUNT(*) > 1
) AS dups;

-- 3. Count duplicate mobile numbers in students
SELECT 
    'DUPLICATE MOBILE NUMBERS' AS duplicate_type,
    COUNT(DISTINCT mobileNumber) AS unique_values_with_duplicates,
    SUM(duplicate_count - 1) AS total_duplicate_records
FROM (
    SELECT mobileNumber, COUNT(*) AS duplicate_count
    FROM students
    WHERE mobileNumber IS NOT NULL AND mobileNumber != ''
    GROUP BY mobileNumber
    HAVING COUNT(*) > 1
) AS dups;

-- 4. Count duplicate (mncUID, workshopId) in registrations
SELECT 
    'DUPLICATE REGISTRATIONS' AS duplicate_type,
    COUNT(*) AS unique_combinations_with_duplicates,
    SUM(duplicate_count - 1) AS total_duplicate_records
FROM (
    SELECT mncUID, workshopId, COUNT(*) AS duplicate_count
    FROM registrations
    WHERE mncUID IS NOT NULL AND mncUID != ''
    GROUP BY mncUID, workshopId
    HAVING COUNT(*) > 1
) AS dups;

-- 5. DETAILED LIST: All duplicate MNC Registration Numbers
SELECT 
    'DETAIL: Duplicate Reg Numbers' AS section,
    mncRegistrationNumber,
    COUNT(*) AS count,
    GROUP_CONCAT(_id ORDER BY createdAt SEPARATOR ', ') AS student_ids
FROM students
WHERE mncRegistrationNumber IS NOT NULL AND mncRegistrationNumber != ''
GROUP BY mncRegistrationNumber
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- 6. DETAILED LIST: All duplicate MNC UIDs
SELECT 
    'DETAIL: Duplicate MNC UIDs' AS section,
    mncUID,
    COUNT(*) AS count,
    GROUP_CONCAT(_id ORDER BY createdAt SEPARATOR ', ') AS student_ids
FROM students
WHERE mncUID IS NOT NULL AND mncUID != ''
GROUP BY mncUID
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- 7. SUMMARY: Total duplicates to delete
SELECT 
    'TOTAL SUMMARY' AS report,
    (SELECT SUM(duplicate_count - 1) FROM (
        SELECT COUNT(*) AS duplicate_count FROM students 
        WHERE mncUID IS NOT NULL AND mncUID != ''
        GROUP BY mncUID HAVING COUNT(*) > 1
    ) t1) + 
    (SELECT SUM(duplicate_count - 1) FROM (
        SELECT COUNT(*) AS duplicate_count FROM students 
        WHERE mncRegistrationNumber IS NOT NULL AND mncRegistrationNumber != ''
        GROUP BY mncRegistrationNumber HAVING COUNT(*) > 1
    ) t2) AS total_duplicate_student_records_to_delete,
    (SELECT SUM(duplicate_count - 1) FROM (
        SELECT COUNT(*) AS duplicate_count FROM registrations 
        WHERE mncUID IS NOT NULL AND mncUID != ''
        GROUP BY mncUID, workshopId HAVING COUNT(*) > 1
    ) t3) AS total_duplicate_registration_records_to_delete;
