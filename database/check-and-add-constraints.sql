-- Check if constraints already exist, add only if missing

-- Check existing indexes
SELECT DISTINCT INDEX_NAME 
FROM INFORMATION_SCHEMA.STATISTICS 
WHERE TABLE_SCHEMA = 'u984810592_aparna_cne' 
  AND TABLE_NAME IN ('students', 'registrations', 'attendance')
  AND INDEX_NAME LIKE 'unique_%';

-- Try to add constraints (will fail if already exist - that's OK)
ALTER TABLE students ADD UNIQUE KEY unique_mncUID (mncUID);
ALTER TABLE students ADD UNIQUE KEY unique_mncRegistrationNumber (mncRegistrationNumber);
ALTER TABLE registrations ADD UNIQUE KEY unique_registration_per_workshop (mncUID, workshopId);
ALTER TABLE attendance ADD UNIQUE KEY unique_attendance_per_workshop (mncUID, workshopId);
