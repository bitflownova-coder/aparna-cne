-- ========================================
-- RENUMBER ALL FORM NUMBERS FROM 0051+ TO 0001+
-- Maintains chronological order
-- ========================================

-- CRITICAL: This updates ALL existing registrations!
-- Run this: mysql -u u984810592_aparna_admin -p'sCARFACE@2003?.' u984810592_aparna_cne < renumber-form-numbers.sql

-- Create temporary table with new form numbers
CREATE TEMPORARY TABLE temp_renumbering AS
SELECT 
    _id,
    workshopId,
    formNumber AS old_formNumber,
    CONCAT(
        SUBSTRING_INDEX(formNumber, '-', 1),  -- Get CPD number (e.g., "1288")
        '-',
        LPAD(
            CAST(SUBSTRING_INDEX(formNumber, '-', -1) AS UNSIGNED) - 50,  -- Subtract 50 from form number
            4,
            '0'
        )
    ) AS new_formNumber,
    submittedAt
FROM registrations
WHERE formNumber IS NOT NULL
  AND formNumber LIKE '%-0%'  -- Only process form numbers with 4-digit format
  AND CAST(SUBSTRING_INDEX(formNumber, '-', -1) AS UNSIGNED) > 50  -- Only those > 50
ORDER BY workshopId, submittedAt;

-- Preview changes
SELECT 
    workshopId,
    COUNT(*) AS registrations_to_update,
    MIN(old_formNumber) AS old_min,
    MIN(new_formNumber) AS new_min,
    MAX(old_formNumber) AS old_max,
    MAX(new_formNumber) AS new_max
FROM temp_renumbering
GROUP BY workshopId;

-- Update registrations with new form numbers
UPDATE registrations r
JOIN temp_renumbering t ON r._id = t._id
SET r.formNumber = t.new_formNumber;

-- Update form_number_counters (subtract 50 from all counters > 50)
UPDATE form_number_counters
SET lastNumber = lastNumber - 50
WHERE lastNumber > 50;

-- Verify updates
SELECT 
    'Updated Registrations' AS status,
    workshopId,
    COUNT(*) AS count,
    MIN(formNumber) AS min_form,
    MAX(formNumber) AS max_form
FROM registrations
WHERE formNumber IS NOT NULL
GROUP BY workshopId
ORDER BY workshopId;

SELECT 
    'Updated Counters' AS status,
    workshopId,
    lastNumber
FROM form_number_counters
ORDER BY workshopId;

-- Cleanup
DROP TEMPORARY TABLE temp_renumbering;
