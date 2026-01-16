-- Add missing UNIQUE constraints (skip if error means it already exists)

-- Add UNIQUE constraint on mncRegistrationNumber (if not exists)
ALTER TABLE students ADD UNIQUE KEY unique_mncRegistrationNumber (mncRegistrationNumber);

-- Add UNIQUE constraint on (mncUID, workshopId) in registrations
ALTER TABLE registrations ADD UNIQUE KEY unique_registration_per_workshop (mncUID, workshopId);

-- Add UNIQUE constraint on (mncUID, workshopId) in attendance  
ALTER TABLE attendance ADD UNIQUE KEY unique_attendance_per_workshop (mncUID, workshopId);

-- Verify all constraints
SELECT 'students' AS table_name, INDEX_NAME AS Key_name, COLUMN_NAME AS Column_name 
FROM INFORMATION_SCHEMA.STATISTICS 
WHERE TABLE_SCHEMA = 'u984810592_aparna_cne' 
  AND TABLE_NAME = 'students'
  AND INDEX_NAME LIKE 'unique%'
UNION ALL
SELECT 'registrations', INDEX_NAME, COLUMN_NAME
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = 'u984810592_aparna_cne'
  AND TABLE_NAME = 'registrations'
  AND INDEX_NAME LIKE 'unique%'
UNION ALL
SELECT 'attendance', INDEX_NAME, COLUMN_NAME
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = 'u984810592_aparna_cne'
  AND TABLE_NAME = 'attendance'
  AND INDEX_NAME LIKE 'unique%'
ORDER BY table_name, Key_name, Column_name;
