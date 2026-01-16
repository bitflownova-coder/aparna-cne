-- Check remaining duplicates
SELECT _id, mncUID, mncRegistrationNumber, fullName, createdAt 
FROM students 
WHERE mncRegistrationNumber IN ('XVIII-53940', 'XVII-9216', 'XVIII-21704', 'XVIII-23409', 'XXVIII-24075', 'XXVIII-44432') 
ORDER BY mncRegistrationNumber, createdAt;
