-- Check XVIII-53940 case specifically
SELECT 
    _id,
    mncUID,
    CHAR_LENGTH(mncUID) AS mncUID_length,
    mncRegistrationNumber,
    fullName,
    mobileNumber,
    createdAt
FROM students
WHERE mncRegistrationNumber = 'XVIII-53940'
ORDER BY createdAt;
