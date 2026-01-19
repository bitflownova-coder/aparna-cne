-- Find all students with corrupted registration numbers (containing spaces)
-- Run this in phpMyAdmin to see the corrupted records

SELECT 
    _id as 'Student ID',
    fullName as 'Name',
    mncUID as 'MNC UID',
    mncRegistrationNumber as 'Registration Number (CORRUPTED)',
    totalWorkshops as 'Total Workshops'
FROM students 
WHERE mncRegistrationNumber LIKE '% %'
ORDER BY fullName;

-- To see how many corrupted records exist:
-- SELECT COUNT(*) as 'Corrupted Records' FROM students WHERE mncRegistrationNumber LIKE '% %';

-- OPTIONAL: If you want to keep only the FIRST registration number (before the space):
-- WARNING: This will modify your data! Test on a backup first!
-- 
-- UPDATE students 
-- SET mncRegistrationNumber = SUBSTRING_INDEX(mncRegistrationNumber, ' ', 1)
-- WHERE mncRegistrationNumber LIKE '% %';
