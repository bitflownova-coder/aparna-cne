-- Create Bitflow Owner Admin User
INSERT INTO users (_id, username, password, name, email, role, status, createdAt, updatedAt)
VALUES (
  'USR999999',
  'bitflowadmin',
  'sCARFACE@aMISHA@1804',
  'Bitflow Owner',
  'admin@bitflow.com',
  'admin',
  'active',
  NOW(),
  NOW()
)
ON DUPLICATE KEY UPDATE
  password = 'sCARFACE@aMISHA@1804',
  updatedAt = NOW();

-- Verify user created
SELECT _id, username, name, role, status FROM users WHERE username = 'bitflowadmin';
