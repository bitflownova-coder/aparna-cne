-- ========================================
-- ADD UNIQUE CONSTRAINTS
-- Created: January 16, 2026
-- Purpose: Prevent duplicate MNC UIDs and registrations
-- ========================================

-- CRITICAL: Run cleanup-duplicates.sql FIRST!
-- Then run this: mysql -u u984810592_aparna_admin -p'sCARFACE@2003?.' u984810592_aparna_cne < add-unique-constraints.sql

-- ==================================================
-- STEP 1: Add UNIQUE constraints to students table
-- ==================================================

-- Add UNIQUE constraint on mncUID
ALTER TABLE students 
ADD UNIQUE KEY unique_mncUID (mncUID);

-- Add UNIQUE constraint on mncRegistrationNumber
ALTER TABLE students 
ADD UNIQUE KEY unique_mncRegistrationNumber (mncRegistrationNumber);

-- ==================================================
-- STEP 2: Add UNIQUE constraints to registrations table
-- ==================================================

-- Add UNIQUE constraint on (mncUID, workshopId) combination
-- This prevents same student from registering twice for same workshop
ALTER TABLE registrations 
ADD UNIQUE KEY unique_registration_per_workshop (mncUID, workshopId);

-- ==================================================
-- STEP 3: Add UNIQUE constraints to attendance table
-- ==================================================

-- Add UNIQUE constraint on (mncUID, workshopId) combination
-- This prevents same student from marking attendance twice for same workshop
ALTER TABLE attendance 
ADD UNIQUE KEY unique_attendance_per_workshop (mncUID, workshopId);

-- ==================================================
-- STEP 4: Verify constraints were added
-- ==================================================

-- Show all indexes/constraints on students table
SHOW INDEX FROM students;

-- Show all indexes/constraints on registrations table
SHOW INDEX FROM registrations;

-- Show all indexes/constraints on attendance table
SHOW INDEX FROM attendance;

-- ==================================================
-- STEP 5: Test constraints
-- ==================================================

-- This should FAIL with "Duplicate entry" error:
-- INSERT INTO students (_id, mncUID, mncRegistrationNumber, name, fullName) 
-- VALUES ('TEST001', '1700001335', 'XI-9928', 'TEST', 'TEST USER');

SELECT 'UNIQUE constraints added successfully!' AS status;
