// Find students with corrupted registration numbers
const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'u984810592_aparna_admin',
  password: process.env.DB_PASSWORD || 'Aparna@1234',
  database: process.env.DB_NAME || 'u984810592_aparna_cne'
};

async function findBadRegNums() {
  const pool = mysql.createPool(dbConfig);
  
  try {
    // Find registration numbers with spaces (likely multiple reg numbers in one field)
    const [rows] = await pool.query(
      "SELECT _id, fullName, mncUID, mncRegistrationNumber FROM students WHERE mncRegistrationNumber LIKE '% %' OR mncRegistrationNumber LIKE '%  %'"
    );
    
    console.log('\n=== Students with potentially corrupted registration numbers ===\n');
    console.log(`Found ${rows.length} records with spaces in mncRegistrationNumber:\n`);
    
    rows.forEach((row, i) => {
      console.log(`${i+1}. ID: ${row._id}`);
      console.log(`   Name: ${row.fullName}`);
      console.log(`   MNC UID: ${row.mncUID}`);
      console.log(`   Reg Number: "${row.mncRegistrationNumber}"`);
      console.log('');
    });
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

findBadRegNums();
