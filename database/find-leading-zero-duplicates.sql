-- Find duplicates caused by leading zeros in mncUID
-- Example: "73385" vs "0000073385" are the same person

SELECT 
    'Duplicates by leading zeros' AS issue_type,
    s1._id AS student1_id,
    s1.mncUID AS student1_mncUID,
    s1.mncRegistrationNumber AS student1_regNum,
    s1.createdAt AS student1_created,
    s2._id AS student2_id,
    s2.mncUID AS student2_mncUID,
    s2.mncRegistrationNumber AS student2_regNum,
    s2.createdAt AS student2_created
FROM students s1
JOIN students s2 ON s1.mncRegistrationNumber = s2.mncRegistrationNumber
WHERE s1._id != s2._id
  AND s1.mncUID != s2.mncUID
  AND (
    -- Check if one is the numeric version of the other (leading zeros stripped)
    CAST(s1.mncUID AS UNSIGNED) = CAST(s2.mncUID AS UNSIGNED)
  )
ORDER BY s1.mncRegistrationNumber;

-- Also check for all students with the duplicate registration numbers
SELECT 
    _id,
    mncUID,
    mncRegistrationNumber,
    fullName,
    createdAt,
    CASE 
        WHEN _id IN ('STU006898', 'STU007129', 'STU007145', 'STU007148', 'STU007154', 'STU007156') THEN 'KEEP - Has registration'
        WHEN _id IN ('STU001288', 'STU002246', 'STU005604', 'STU005669', 'STU005459', 'STU002360') THEN 'DELETE - Older duplicate'
        WHEN _id = 'STU000527' AND mncUID LIKE '0000%' THEN 'KEEP - Has leading zeros'
        WHEN _id = 'STU002327' AND mncUID NOT LIKE '0000%' THEN 'DELETE - No leading zeros'
        ELSE 'CHECK'
    END AS action
FROM students
WHERE mncRegistrationNumber IN (
    'XVII-9216',
    'XVIII-21704',
    'XVIII-23409',
    'XVIII-35199',
    'XVIII-53940',
    'XXVIII-24075',
    'XXVIII-44432'
)
ORDER BY mncRegistrationNumber, createdAt;
