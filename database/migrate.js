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
    ];
    
    // Migrations for registrations table - add missing columns
    const registrationMigrations = [
      "ALTER TABLE registrations MODIFY COLUMN name VARCHAR(255) NULL",
      "ALTER TABLE registrations ADD COLUMN IF NOT EXISTS fullName VARCHAR(255) AFTER name",
      "ALTER TABLE registrations ADD COLUMN IF NOT EXISTS dateOfBirth VARCHAR(50) AFTER email",
      "ALTER TABLE registrations ADD COLUMN IF NOT EXISTS gender VARCHAR(20) AFTER dateOfBirth",
      "ALTER TABLE registrations ADD COLUMN IF NOT EXISTS qualification VARCHAR(255) AFTER gender",
      "ALTER TABLE registrations ADD COLUMN IF NOT EXISTS organization VARCHAR(255) AFTER qualification",
      "ALTER TABLE registrations ADD COLUMN IF NOT EXISTS experience VARCHAR(100) AFTER organization",
      "ALTER TABLE registrations ADD COLUMN IF NOT EXISTS address TEXT AFTER experience",
      "ALTER TABLE registrations ADD COLUMN IF NOT EXISTS city VARCHAR(100) AFTER address",
      "ALTER TABLE registrations ADD COLUMN IF NOT EXISTS state VARCHAR(100) AFTER city",
      "ALTER TABLE registrations ADD COLUMN IF NOT EXISTS pinCode VARCHAR(20) AFTER state",
      "ALTER TABLE registrations ADD COLUMN IF NOT EXISTS paymentVerified TINYINT(1) DEFAULT 0 AFTER paymentStatus",
      "ALTER TABLE registrations ADD COLUMN IF NOT EXISTS paymentMethod VARCHAR(100) AFTER paymentVerified",
      "ALTER TABLE registrations ADD COLUMN IF NOT EXISTS transactionId VARCHAR(100) AFTER paymentMethod",
      "ALTER TABLE registrations ADD COLUMN IF NOT EXISTS utrNumber VARCHAR(100) AFTER transactionId",
      "ALTER TABLE registrations ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending' AFTER registrationStatus",
      "ALTER TABLE registrations ADD COLUMN IF NOT EXISTS executiveUsername VARCHAR(100) AFTER agentId",
      "ALTER TABLE registrations ADD COLUMN IF NOT EXISTS registrationSource VARCHAR(50) AFTER executiveUsername",
      "ALTER TABLE registrations ADD COLUMN IF NOT EXISTS submittedBy VARCHAR(100) AFTER registrationSource",
      "ALTER TABLE registrations ADD COLUMN IF NOT EXISTS submittedAt DATETIME AFTER submittedBy",
      "ALTER TABLE registrations ADD COLUMN IF NOT EXISTS updatedBy VARCHAR(100) AFTER submittedAt",
      // Fix ENUM columns to VARCHAR for flexibility
      "ALTER TABLE registrations MODIFY COLUMN paymentStatus VARCHAR(50) DEFAULT 'pending'",
      "ALTER TABLE registrations MODIFY COLUMN registrationStatus VARCHAR(50) DEFAULT 'pending'",
      "ALTER TABLE registrations MODIFY COLUMN registeredByType VARCHAR(50) DEFAULT 'self'",
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
    
    console.log('\n=== Running Registration Table Migrations ===');
    for (const sql of registrationMigrations) {
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
