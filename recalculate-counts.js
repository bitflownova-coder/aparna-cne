const mysql = require('mysql2/promise');

async function recalculate() {
  const pool = await mysql.createPool({
    host: '127.0.0.1',
    user: 'u984810592_aparna_cne',
    password: 'Aparna@123456',
    database: 'u984810592_aparna_cne'
  });
  
  // Get all workshops
  const [workshops] = await pool.query('SELECT _id, title, currentRegistrations FROM workshops');
  
  for (const workshop of workshops) {
    // Count registrations for this workshop
    const [countResult] = await pool.query('SELECT COUNT(*) as cnt FROM registrations WHERE workshopId = ?', [workshop._id]);
    const count = countResult[0].cnt;
    
    if (workshop.currentRegistrations !== count) {
      await pool.query('UPDATE workshops SET currentRegistrations = ? WHERE _id = ?', [count, workshop._id]);
      console.log('Updated ' + workshop.title + ': ' + workshop.currentRegistrations + ' -> ' + count);
    } else {
      console.log(workshop.title + ': already correct at ' + count);
    }
  }
  
  console.log('Done!');
  await pool.end();
  process.exit(0);
}

recalculate().catch(e => { console.error(e); process.exit(1); });
