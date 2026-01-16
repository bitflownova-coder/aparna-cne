-- ========================================
-- CLEANUP DUPLICATE DATA
-- Created: January 16, 2026
-- Purpose: Remove duplicates before adding UNIQUE constraints
-- ========================================

-- CRITICAL: Run backup-before-fixes.sql FIRST!
-- Then run this: mysql -u u984810592_aparna_admin -p'sCARFACE@2003?.' u984810592_aparna_cne < cleanup-duplicates.sql

-- ==================================================
-- STEP 1: Clean duplicate students caused by leading zeros
-- Strategy: Keep students WITH registrations, delete duplicates WITHOUT registrations
-- For unregistered duplicates: Keep one with leading zeros (correct format)
-- ==================================================

-- Delete duplicate student: AMRUTA PATIL (mncUID: 1700001335)
-- Keep STU007171 (older), delete STU007172
DELETE FROM students WHERE _id = 'STU007172';

-- LEADING ZERO DUPLICATES - Keep students with registrations (newer bulk upload)
-- Delete older students without registrations

-- XVII-9216: Keep STU006898 (has registration REG000348), delete STU001288
DELETE FROM students WHERE _id = 'STU001288';

-- XVIII-21704: Keep STU007148 (has registration REG001055), delete STU005669  
DELETE FROM students WHERE _id = 'STU005669';

-- XVIII-23409: Keep STU007154 (has registration REG001063), delete STU005459
DELETE FROM students WHERE _id = 'STU005459';

-- XVIII-35199: Keep STU007156 (has registration REG001065), delete STU002360
DELETE FROM students WHERE _id = 'STU002360';

-- XVIII-53940: Keep STU002327 (has leading zeros: 0000073385), delete STU000527 (no zeros: 73385)
DELETE FROM students WHERE _id = 'STU000527';

-- XXVIII-24075: Keep STU007145 (has registration REG001050), delete STU005604
DELETE FROM students WHERE _id = 'STU005604';

-- XXVIII-44432: Keep STU007129 (has registration REG001031), delete STU002246
DELETE FROM students WHERE _id = 'STU002246';

-- ==================================================
-- STEP 2: Clean duplicate registrations
-- Keep oldest registration, delete newer duplicates
-- ==================================================

-- Student: AMRUTA PATIL (mncUID: 1700001335) - 7 duplicate registrations for WRK000008
-- Keep REG001092 (oldest form 1288-0439), delete 6 duplicates
DELETE FROM registrations WHERE _id IN ('REG001093', 'REG001094', 'REG001095', 'REG001096', 'REG001097', 'REG001098');

-- Student: PRATIKSHA KOTGIR (mncUID: 0000071640) - 5 duplicate registrations for WRK000008
-- Keep REG000599 (oldest form 1288-0070), delete 4 duplicates
DELETE FROM registrations WHERE _id IN ('REG000600', 'REG000601', 'REG000602', 'REG000603');

-- Student: ALKA LUIES KAKAD (mncUID: 0000050377) - 2 duplicate registrations for WRK000009
-- Keep REG000702 (oldest form 1288-0121), delete 1 duplicate
DELETE FROM registrations WHERE _id = 'REG000703';

-- Student: PRANALI GAJANAN SAMANT (mncUID: 0000055189) - 2 duplicate registrations for WRK000008
-- Keep REG000604 (oldest form 1288-0075), delete 1 duplicate
DELETE FROM registrations WHERE _id = 'REG000605';

-- Student: SHILPA BAJIRAO CHOPADE (mncUID: 0000089915) - 2 duplicate registrations for WRK000012
-- Keep REG001081 (oldest form 1371-0054), delete 1 duplicate
DELETE FROM registrations WHERE _id = 'REG001082';

-- Student: NEHA PANDIT WAVARE/PRITI KAMBLE (mncUID: 1900020889) - 2 duplicate registrations for WRK000008
-- Keep REG000651 (oldest form 1288-0122), delete 1 duplicate
DELETE FROM registrations WHERE _id = 'REG000652';

-- ==================================================
-- STEP 3: Verify cleanup
-- ==================================================

-- Check if duplicates still exist (should return 0 rows)
SELECT 'Remaining duplicate MNC UIDs' AS check_type, mncUID, COUNT(*) AS count
FROM students
WHERE mncUID IS NOT NULL AND mncUID != ''
GROUP BY mncUID
HAVING COUNT(*) > 1;

SELECT 'Remaining duplicate registrations' AS check_type, mncUID, workshopId, COUNT(*) AS count
FROM registrations
WHERE mncUID IS NOT NULL AND mncUID != ''
GROUP BY mncUID, workshopId
HAVING COUNT(*) > 1;

-- Summary
SELECT 'Cleanup Summary' AS report, 'Students deleted' AS action, 7 AS count
UNION ALL
SELECT 'Cleanup Summary', 'Registrations deleted', 15;
