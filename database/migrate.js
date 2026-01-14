/**
 * Database Migration Script
 * Run this to add missing columns to existing tables
 * Usage: node database/migrate.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'aparna_cne',
};

async function migrate() {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('Connected to database:', dbConfig.database);
    
    // Migrations for agents table - add missing columns
    const agentMigrations = [
      "ALTER TABLE agents ADD COLUMN IF NOT EXISTS username VARCHAR(100) UNIQUE AFTER _id",
      "ALTER TABLE agents ADD COLUMN IF NOT EXISTS password VARCHAR(255) AFTER username",
      "ALTER TABLE agents ADD COLUMN IF NOT EXISTS fullName VARCHAR(255) AFTER password",
    ];
    
    // Migrations for attendance table - add missing columns
    const attendanceMigrations = [
      "ALTER TABLE attendance ADD COLUMN IF NOT EXISTS mncUID VARCHAR(100) AFTER studentName",
      "ALTER TABLE attendance ADD COLUMN IF NOT EXISTS registrationNumber VARCHAR(100) AFTER mncUID",
      "ALTER TABLE attendance ADD COLUMN IF NOT EXISTS markedAt DATETIME AFTER checkOutTime",
      "ALTER TABLE attendance ADD COLUMN IF NOT EXISTS ipAddress VARCHAR(100) AFTER markedByType",
      "ALTER TABLE attendance ADD COLUMN IF NOT EXISTS deviceFingerprint TEXT AFTER ipAddress",
      "ALTER TABLE attendance ADD COLUMN IF NOT EXISTS userAgent TEXT AFTER deviceFingerprint",
      "ALTER TABLE attendance ADD INDEX IF NOT EXISTS idx_mncUID (mncUID)",
    ];
    
    console.log('\n=== Running Agent Table Migrations ===');
    for (const sql of agentMigrations) {
      try {
        await connection.query(sql);
        console.log('✅', sql.substring(0, 60) + '...');
      } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME' || err.code === 'ER_DUP_KEYNAME') {
          console.log('⏭️  Column/Index already exists, skipping');
        } else {
          console.log('❌', err.message);
        }
      }
    }
    
    console.log('\n=== Running Attendance Table Migrations ===');
    for (const sql of attendanceMigrations) {
      try {
        await connection.query(sql);
        console.log('✅', sql.substring(0, 60) + '...');
      } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME' || err.code === 'ER_DUP_KEYNAME') {
          console.log('⏭️  Column/Index already exists, skipping');
        } else {
          console.log('❌', err.message);
        }
      }
    }
    
    console.log('\n✅ Migration completed!');
    
  } catch (error) {
    console.error('Migration failed:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

migrate();
