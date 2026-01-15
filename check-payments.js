const mysql = require('mysql2/promise');
async function check() {
  const pool = await mysql.createPool({
    host: '127.0.0.1',
    user: 'u984810592_aparna_admin',
    password: 'sCARFACE@2003?.',
    database: 'u984810592_aparna_cne'
  });
  const [rows] = await pool.query('SELECT _id, paymentScreenshot FROM registrations LIMIT 5');
  console.log(JSON.stringify(rows, null, 2));
  await pool.end();
  process.exit(0);
}
check().catch(e => { console.error(e); process.exit(1); });
