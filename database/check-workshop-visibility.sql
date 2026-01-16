-- Check all workshops and their status
SELECT 
    _id,
    title,
    DATE(date) as workshop_date,
    status,
    currentRegistrations,
    maxSeats,
    CASE 
        WHEN DATE(date) >= DATE_SUB(CURDATE(), INTERVAL 1 DAY) THEN 'Within date range'
        ELSE 'Outside date range'
    END as date_filter_result,
    CASE 
        WHEN status IN ('active', 'full') THEN 'Matches status filter'
        ELSE 'Does not match status'
    END as status_filter_result,
    CASE 
        WHEN status IN ('active', 'full') AND DATE(date) >= DATE_SUB(CURDATE(), INTERVAL 1 DAY) THEN 'SHOULD SHOW'
        ELSE 'SHOULD NOT SHOW'
    END as final_result
FROM workshops
ORDER BY date;

-- Summary
SELECT 
    'Total Workshops' as metric,
    COUNT(*) as count
FROM workshops
UNION ALL
SELECT 
    'Status = active',
    COUNT(*)
FROM workshops
WHERE status = 'active'
UNION ALL
SELECT 
    'Status = full',
    COUNT(*)
FROM workshops
WHERE status = 'full'
UNION ALL
SELECT 
    'Should show in attendance (active/full + date filter)',
    COUNT(*)
FROM workshops
WHERE status IN ('active', 'full') 
  AND DATE(date) >= DATE_SUB(CURDATE(), INTERVAL 1 DAY);
