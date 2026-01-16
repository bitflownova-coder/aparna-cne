-- Check which mncUID was submitted in registration forms
SELECT 
    r._id AS registration_id,
    r.studentId,
    r.mncUID AS submitted_mncUID,
    r.mncRegistrationNumber AS submitted_regNumber,
    r.formNumber,
    r.fullName,
    s.mncUID AS student_table_mncUID,
    s.mncRegistrationNumber AS student_table_regNumber,
    s._id AS student_id
FROM registrations r
LEFT JOIN students s ON r.studentId = s._id
WHERE r._id IN (
    'REG000348',
    'REG001031',
    'REG001050',
    'REG001055',
    'REG001063',
    'REG001065'
)
ORDER BY r._id;
