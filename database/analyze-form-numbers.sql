-- ========================================
-- RENUMBER FORM NUMBERS
-- Change all workshops from 0051+ to 0001+
-- ========================================

-- Find all workshops with form numbers starting above 50
SELECT 
    workshopId,
    lastNumber,
    'Will renumber from' AS action,
    CONCAT('0051-', LPAD(lastNumber, 4, '0')) AS current_range,
    CONCAT('0001-', LPAD(lastNumber - 50, 4, '0')) AS new_range
FROM form_number_counters
WHERE lastNumber > 50;

-- For each workshop, renumber all registrations
-- Workshop 1: Get total registrations
SELECT 
    workshopId,
    COUNT(*) AS total_registrations,
    MIN(formNumber) AS min_form,
    MAX(formNumber) AS max_form
FROM registrations
WHERE formNumber IS NOT NULL
GROUP BY workshopId
HAVING COUNT(*) > 0
ORDER BY workshopId;
