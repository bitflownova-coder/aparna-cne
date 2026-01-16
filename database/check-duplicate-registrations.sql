-- Check if duplicate students have any registrations
SELECT 
    r._id AS registration_id,
    r.studentId,
    r.mncUID,
    r.workshopId,
    r.workshopTitle,
    r.formNumber,
    r.fullName,
    r.submittedAt
FROM registrations r
WHERE r.studentId IN (
    'STU006898',
    'STU007148', 
    'STU007154',
    'STU007156',
    'STU002327',
    'STU007145',
    'STU007129'
)
ORDER BY r.studentId, r.submittedAt;

-- Count registrations for each duplicate student
SELECT 
    'Registration Count' AS metric,
    studentId,
    COUNT(*) AS registration_count
FROM registrations
WHERE studentId IN (
    'STU006898',
    'STU007148',
    'STU007154',
    'STU007156',
    'STU002327',
    'STU007145',
    'STU007129'
)
GROUP BY studentId;
