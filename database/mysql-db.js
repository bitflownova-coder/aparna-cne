/**
 * MySQL Database Connection and Operations
 * Replaces localdb.js for production use
 */

const mysql = require('mysql2/promise');

// Database configuration from environment variables
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'aparna_cne',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Create connection pool
let pool = null;

async function getPool() {
  if (!pool) {
    pool = mysql.createPool(dbConfig);
    console.log('=====================================');
    console.log('MySQL DATABASE CONNECTED');
    console.log('Host:', dbConfig.host);
    console.log('Database:', dbConfig.database);
    console.log('=====================================');
  }
  return pool;
}

// Initialize database tables
async function initDatabase() {
  const pool = await getPool();
  
  // Create tables if they don't exist
  const tables = [
    // Counters table
    `CREATE TABLE IF NOT EXISTS counters (
      id INT PRIMARY KEY DEFAULT 1,
      registrationId INT DEFAULT 0,
      workshopId INT DEFAULT 0,
      userId INT DEFAULT 0,
      attendanceId INT DEFAULT 0,
      studentId INT DEFAULT 0,
      agentId INT DEFAULT 0
    )`,
    
    // Form number counters table (for atomic form number generation per workshop)
    `CREATE TABLE IF NOT EXISTS form_number_counters (
      workshopId VARCHAR(50) PRIMARY KEY,
      lastNumber INT DEFAULT 50,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    
    // Audit logs table
    `CREATE TABLE IF NOT EXISTS audit_logs (
      _id VARCHAR(50) PRIMARY KEY,
      action VARCHAR(100) NOT NULL,
      entityType VARCHAR(50) NOT NULL,
      entityId VARCHAR(50),
      userId VARCHAR(50),
      username VARCHAR(100),
      userRole VARCHAR(50),
      details JSON,
      ipAddress VARCHAR(100),
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_action (action),
      INDEX idx_entityType (entityType),
      INDEX idx_userId (userId),
      INDEX idx_createdAt (createdAt)
    )`,
    
    // Users table (admin, executives, attendance staff)
    `CREATE TABLE IF NOT EXISTS users (
      _id VARCHAR(50) PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      name VARCHAR(255),
      email VARCHAR(255),
      role ENUM('admin', 'executive', 'attendance') DEFAULT 'executive',
      status ENUM('active', 'inactive') DEFAULT 'active',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    
    // Workshops table
    `CREATE TABLE IF NOT EXISTS workshops (
      _id VARCHAR(50) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      date DATETIME,
      dayOfWeek VARCHAR(20),
      venue VARCHAR(255),
      venueLink VARCHAR(500),
      fee DECIMAL(10,2) DEFAULT 0,
      credits INT DEFAULT 0,
      cneCpdNumber VARCHAR(100),
      maxSeats INT DEFAULT 100,
      currentRegistrations INT DEFAULT 0,
      status ENUM('draft', 'upcoming', 'active', 'full', 'completed') DEFAULT 'draft',
      qrCodeImage VARCHAR(255),
      registrationStartDate DATETIME,
      registrationEndDate DATETIME,
      createdBy VARCHAR(100),
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    
    // Students table (central database)
    `CREATE TABLE IF NOT EXISTS students (
      _id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      fullName VARCHAR(255),
      mncUID VARCHAR(100),
      mncRegistrationNumber VARCHAR(100),
      mncRegPrefix VARCHAR(50),
      mncRegNumber VARCHAR(50),
      mobileNumber VARCHAR(20),
      email VARCHAR(255),
      dateOfBirth VARCHAR(50),
      gender VARCHAR(20),
      qualification VARCHAR(255),
      organization VARCHAR(255),
      experience VARCHAR(100),
      address TEXT,
      city VARCHAR(100),
      state VARCHAR(100),
      pinCode VARCHAR(20),
      totalWorkshops INT DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_mncUID (mncUID),
      INDEX idx_mncRegNo (mncRegistrationNumber),
      INDEX idx_mobile (mobileNumber),
      INDEX idx_email (email)
    )`,
    
    // Registrations table
    `CREATE TABLE IF NOT EXISTS registrations (
      _id VARCHAR(50) PRIMARY KEY,
      
      workshopId VARCHAR(50),
      workshopTitle VARCHAR(255),
      cneCpdNumber VARCHAR(100),
      
      studentId VARCHAR(50),
      name VARCHAR(255),
      fullName VARCHAR(255),
      mncUID VARCHAR(100),
      mncRegistrationNumber VARCHAR(100),
      mncRegPrefix VARCHAR(50),
      mncRegNumber VARCHAR(50),
      mobileNumber VARCHAR(20),
      email VARCHAR(255),
      dateOfBirth VARCHAR(50),
      gender VARCHAR(20),
      qualification VARCHAR(255),
      organization VARCHAR(255),
      experience VARCHAR(100),
      address TEXT,
      city VARCHAR(100),
      state VARCHAR(100),
      pinCode VARCHAR(20),
      
      formNumber VARCHAR(50),
      qrCode TEXT,
      qrCodeUrl VARCHAR(255),
      
      paymentStatus VARCHAR(50) DEFAULT 'pending',
      paymentVerified TINYINT(1) DEFAULT 0,
      paymentMethod VARCHAR(100),
      transactionId VARCHAR(100),
      utrNumber VARCHAR(100),
      registrationStatus VARCHAR(50) DEFAULT 'pending',
      status VARCHAR(50) DEFAULT 'pending',
      
      registeredBy VARCHAR(100),
      registeredByType VARCHAR(50) DEFAULT 'self',
      agentId VARCHAR(50),
      executiveUsername VARCHAR(100),
      registrationSource VARCHAR(50),
      submittedBy VARCHAR(100),
      submittedAt DATETIME,
      updatedBy VARCHAR(100),
      
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      INDEX idx_workshopId (workshopId),
      INDEX idx_studentId (studentId),
      INDEX idx_formNumber (formNumber),
      INDEX idx_mobile (mobileNumber)
    )`,
    
    // Attendance table
    `CREATE TABLE IF NOT EXISTS attendance (
      _id VARCHAR(50) PRIMARY KEY,
      
      workshopId VARCHAR(50),
      workshopTitle VARCHAR(255),
      
      registrationId VARCHAR(50),
      studentId VARCHAR(50),
      studentName VARCHAR(255),
      mncUID VARCHAR(100),
      registrationNumber VARCHAR(100),
      mobileNumber VARCHAR(20),
      formNumber VARCHAR(50),
      
      checkInTime DATETIME,
      checkOutTime DATETIME,
      markedAt DATETIME,
      status ENUM('present', 'absent', 'late') DEFAULT 'present',
      
      markedBy VARCHAR(100),
      markedByType ENUM('scan', 'manual') DEFAULT 'scan',
      ipAddress VARCHAR(100),
      deviceFingerprint TEXT,
      userAgent TEXT,
      
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      INDEX idx_workshopId (workshopId),
      INDEX idx_registrationId (registrationId),
      INDEX idx_studentId (studentId),
      INDEX idx_mncUID (mncUID)
    )`,
    
    // Agents table
    `CREATE TABLE IF NOT EXISTS agents (
      _id VARCHAR(50) PRIMARY KEY,
      username VARCHAR(100) UNIQUE,
      password VARCHAR(255),
      fullName VARCHAR(255),
      name VARCHAR(255),
      code VARCHAR(50),
      mobileNumber VARCHAR(20),
      email VARCHAR(255),
      status ENUM('active', 'inactive') DEFAULT 'active',
      totalRegistrations INT DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`
  ];
  
  for (const sql of tables) {
    await pool.query(sql);
  }
  
  // Initialize counters if not exists
  await pool.query(`INSERT IGNORE INTO counters (id) VALUES (1)`);
  
  console.log('All MySQL tables initialized successfully');
}

// Generate ID helper
async function generateId(type) {
  const pool = await getPool();
  const field = `${type}Id`;
  
  await pool.query(`UPDATE counters SET ${field} = ${field} + 1 WHERE id = 1`);
  const [rows] = await pool.query(`SELECT ${field} FROM counters WHERE id = 1`);
  
  return rows[0][field];
}

// ==================== USER OPERATIONS ====================
const User = {
  find: async (query = {}) => {
    const pool = await getPool();
    let sql = 'SELECT * FROM users';
    const values = [];
    
    if (Object.keys(query).length > 0) {
      const conditions = Object.keys(query).map(key => {
        values.push(query[key]);
        return `${key} = ?`;
      });
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    
    const [rows] = await pool.query(sql, values);
    return rows;
  },
  
  findOne: async (query) => {
    const users = await User.find(query);
    return users[0] || null;
  },
  
  findById: async (id) => {
    return User.findOne({ _id: id });
  },
  
  create: async (data) => {
    const pool = await getPool();
    const id = 'USR' + String(await generateId('user')).padStart(6, '0');
    
    const user = {
      _id: id,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const fields = Object.keys(user);
    const placeholders = fields.map(() => '?').join(', ');
    const values = fields.map(f => user[f]);
    
    await pool.query(
      `INSERT INTO users (${fields.join(', ')}) VALUES (${placeholders})`,
      values
    );
    
    return user;
  },
  
  findByIdAndUpdate: async (id, updates) => {
    const pool = await getPool();
    updates.updatedAt = new Date();
    
    const fields = Object.keys(updates);
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = [...fields.map(f => updates[f]), id];
    
    await pool.query(`UPDATE users SET ${setClause} WHERE _id = ?`, values);
    return User.findById(id);
  },
  
  findByIdAndDelete: async (id) => {
    const pool = await getPool();
    await pool.query('DELETE FROM users WHERE _id = ?', [id]);
    return true;
  },
  
  // Alias methods for compatibility
  update: async (id, updates) => {
    return User.findByIdAndUpdate(id, updates);
  },
  
  deleteById: async (id) => {
    return User.findByIdAndDelete(id);
  }
};

// ==================== WORKSHOP OPERATIONS ====================
const Workshop = {
  find: async (query = {}) => {
    const pool = await getPool();
    let sql = 'SELECT * FROM workshops';
    const values = [];
    
    if (Object.keys(query).length > 0) {
      const conditions = Object.keys(query).map(key => {
        values.push(query[key]);
        return `${key} = ?`;
      });
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    
    sql += ' ORDER BY date DESC';
    const [rows] = await pool.query(sql, values);
    // Add canAcceptRegistrations method to each workshop
    return rows.map(w => ({
      ...w,
      canAcceptRegistrations: function() {
        return this.currentRegistrations < this.maxSeats;
      }
    }));
  },
  
  findOne: async (query) => {
    const workshops = await Workshop.find(query);
    return workshops[0] || null;
  },
  
  findById: async (id) => {
    return Workshop.findOne({ _id: id });
  },
  
  create: async (data) => {
    const pool = await getPool();
    const id = 'WRK' + String(await generateId('workshop')).padStart(6, '0');
    
    const workshop = {
      _id: id,
      ...data,
      currentRegistrations: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const fields = Object.keys(workshop);
    const placeholders = fields.map(() => '?').join(', ');
    const values = fields.map(f => workshop[f]);
    
    await pool.query(
      `INSERT INTO workshops (${fields.join(', ')}) VALUES (${placeholders})`,
      values
    );
    
    return workshop;
  },
  
  findByIdAndUpdate: async (id, updates) => {
    const pool = await getPool();
    updates.updatedAt = new Date();
    
    const fields = Object.keys(updates);
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = [...fields.map(f => updates[f]), id];
    
    await pool.query(`UPDATE workshops SET ${setClause} WHERE _id = ?`, values);
    return Workshop.findById(id);
  },
  
  findByIdAndDelete: async (id) => {
    const pool = await getPool();
    await pool.query('DELETE FROM workshops WHERE _id = ?', [id]);
    return true;
  },
  
  getActiveWorkshop: async () => {
    return Workshop.findOne({ status: 'active' });
  },
  
  getActiveWorkshops: async () => {
    const pool = await getPool();
    // Show workshops that are active/full AND within date range (today - 1 day to future)
    const [rows] = await pool.query(
      `SELECT * FROM workshops 
       WHERE status IN ('active', 'full') 
         AND DATE(date) >= DATE_SUB(CURDATE(), INTERVAL 1 DAY)
       ORDER BY date ASC`
    );
    return rows;
  },
  
  getUpcomingWorkshops: async () => {
    const pool = await getPool();
    const [rows] = await pool.query(
      "SELECT * FROM workshops WHERE status IN ('upcoming', 'active') AND date >= NOW() ORDER BY date ASC"
    );
    return rows;
  },
  
  getLatestWorkshop: async () => {
    const active = await Workshop.getActiveWorkshop();
    if (active) return active;
    
    const pool = await getPool();
    const [rows] = await pool.query(
      "SELECT * FROM workshops WHERE status = 'upcoming' AND date >= NOW() ORDER BY date ASC LIMIT 1"
    );
    return rows[0] || null;
  },
  
  incrementRegistrationCount: async (id) => {
    const pool = await getPool();
    // Increment count
    await pool.query(
      'UPDATE workshops SET currentRegistrations = currentRegistrations + 1, updatedAt = NOW() WHERE _id = ?',
      [id]
    );
    // Auto-update status to 'full' if maxSeats reached
    await pool.query(
      "UPDATE workshops SET status = 'full' WHERE _id = ? AND currentRegistrations >= maxSeats AND status = 'active'",
      [id]
    );
    return Workshop.findById(id);
  },
  
  decrementRegistrationCount: async (id) => {
    const pool = await getPool();
    // Decrement count (don't go below 0)
    await pool.query(
      'UPDATE workshops SET currentRegistrations = GREATEST(currentRegistrations - 1, 0), updatedAt = NOW() WHERE _id = ?',
      [id]
    );
    // Auto-revert status from 'full' to 'active' if there's now space
    await pool.query(
      "UPDATE workshops SET status = 'active' WHERE _id = ? AND currentRegistrations < maxSeats AND status = 'full'",
      [id]
    );
    return Workshop.findById(id);
  },
  
  // Alias methods for compatibility
  update: async (id, updates) => {
    return Workshop.findByIdAndUpdate(id, updates);
  },
  
  deleteById: async (id) => {
    return Workshop.findByIdAndDelete(id);
  },
  
  // Method for workshop that returns a canAcceptRegistrations method
  canAcceptRegistrations: function() {
    return this.currentRegistrations < this.maxSeats;
  }
};

// ==================== STUDENT OPERATIONS ====================
const Student = {
  find: async (query = {}) => {
    const pool = await getPool();
    let sql = 'SELECT * FROM students';
    const values = [];
    
    if (Object.keys(query).length > 0) {
      const conditions = Object.keys(query).map(key => {
        values.push(query[key]);
        return `${key} = ?`;
      });
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    
    sql += ' ORDER BY createdAt DESC';
    const [rows] = await pool.query(sql, values);
    return rows;
  },
  
  findOne: async (query) => {
    const students = await Student.find(query);
    return students[0] || null;
  },
  
  findById: async (id) => {
    return Student.findOne({ _id: id });
  },
  
  findByMobile: async (mobile) => {
    return Student.findOne({ mobileNumber: mobile });
  },
  
  findByMncUID: async (mncUID) => {
    const pool = await getPool();
    const cleanUID = mncUID.replace(/\s+/g, '').trim();
    const [rows] = await pool.query(
      'SELECT * FROM students WHERE REPLACE(UPPER(mncUID), " ", "") = ? LIMIT 1',
      [cleanUID.toUpperCase()]
    );
    return rows[0] || null;
  },
  
  findByMncRegistrationNumber: async (mncRegNo) => {
    const pool = await getPool();
    // Remove spaces and do case-insensitive search
    const cleanRegNo = mncRegNo.replace(/\s+/g, '').trim().toUpperCase();
    
    // Try exact match first
    let [rows] = await pool.query(
      'SELECT * FROM students WHERE REPLACE(UPPER(mncRegistrationNumber), " ", "") = ? LIMIT 1',
      [cleanRegNo]
    );
    
    // If not found, try partial match (for corrupted data with multiple reg numbers)
    if (!rows || rows.length === 0) {
      [rows] = await pool.query(
        'SELECT * FROM students WHERE REPLACE(UPPER(mncRegistrationNumber), " ", "") LIKE ? LIMIT 1',
        [`%${cleanRegNo}%`]
      );
      
      if (rows && rows.length > 0) {
        console.log(`WARNING: Found student using partial match. RegNo "${rows[0].mncRegistrationNumber}" contains multiple registration numbers!`);
      }
    }
    
    return rows[0] || null;
  },
  
  findByEmail: async (email) => {
    const pool = await getPool();
    const [rows] = await pool.query(
      'SELECT * FROM students WHERE LOWER(email) = LOWER(?) LIMIT 1',
      [email]
    );
    return rows[0] || null;
  },
  
  findAll: async () => {
    const pool = await getPool();
    const [rows] = await pool.query('SELECT * FROM students ORDER BY createdAt DESC');
    return rows;
  },
  
  create: async (data) => {
    const pool = await getPool();
    const id = 'STU' + String(await generateId('student')).padStart(6, '0');
    
    const student = {
      _id: id,
      ...data,
      totalWorkshops: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const fields = Object.keys(student);
    const placeholders = fields.map(() => '?').join(', ');
    const values = fields.map(f => student[f]);
    
    await pool.query(
      `INSERT INTO students (${fields.join(', ')}) VALUES (${placeholders})`,
      values
    );
    
    return student;
  },
  
  bulkCreate: async (studentsArray) => {
    const pool = await getPool();
    const results = [];
    
    for (const data of studentsArray) {
      const student = await Student.create(data);
      results.push(student);
    }
    
    return results;
  },
  
  findByIdAndUpdate: async (id, updates) => {
    const pool = await getPool();
    updates.updatedAt = new Date();
    
    const fields = Object.keys(updates);
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = [...fields.map(f => updates[f]), id];
    
    await pool.query(`UPDATE students SET ${setClause} WHERE _id = ?`, values);
    return Student.findById(id);
  },
  
  findByIdAndDelete: async (id) => {
    const pool = await getPool();
    await pool.query('DELETE FROM students WHERE _id = ?', [id]);
    return true;
  },
  
  incrementWorkshopCount: async (id) => {
    const pool = await getPool();
    await pool.query(
      'UPDATE students SET totalWorkshops = totalWorkshops + 1, updatedAt = NOW() WHERE _id = ?',
      [id]
    );
    return Student.findById(id);
  },
  
  decrementWorkshopCount: async (id) => {
    const pool = await getPool();
    await pool.query(
      'UPDATE students SET totalWorkshops = GREATEST(totalWorkshops - 1, 0), updatedAt = NOW() WHERE _id = ?',
      [id]
    );
    return Student.findById(id);
  },
  
  // Alias methods for compatibility
  update: async (id, updates) => {
    return Student.findByIdAndUpdate(id, updates);
  },
  
  deleteById: async (id) => {
    return Student.findByIdAndDelete(id);
  },
  
  deleteAll: async () => {
    const pool = await getPool();
    await pool.query('DELETE FROM students');
    return true;
  }
};

// ==================== REGISTRATION OPERATIONS ====================
const Registration = {
  find: async (query = {}) => {
    const pool = await getPool();
    let sql = 'SELECT * FROM registrations';
    const values = [];
    
    if (Object.keys(query).length > 0) {
      const conditions = Object.keys(query).map(key => {
        values.push(query[key]);
        return `${key} = ?`;
      });
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    
    sql += ' ORDER BY createdAt DESC';
    const [rows] = await pool.query(sql, values);
    return rows;
  },
  
  findOne: async (query) => {
    const registrations = await Registration.find(query);
    return registrations[0] || null;
  },
  
  findById: async (id) => {
    return Registration.findOne({ _id: id });
  },
  
  findByFormNumber: async (formNumber) => {
    return Registration.findOne({ formNumber: formNumber });
  },
  
  findByMobile: async (mobile) => {
    return Registration.findOne({ mobileNumber: mobile });
  },
  
  findByWorkshop: async (workshopId) => {
    return Registration.find({ workshopId: workshopId });
  },
  
  create: async (data) => {
    const pool = await getPool();
    const id = 'REG' + String(await generateId('registration')).padStart(6, '0');
    
    const registration = {
      _id: id,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const fields = Object.keys(registration);
    const placeholders = fields.map(() => '?').join(', ');
    const values = fields.map(f => registration[f]);
    
    await pool.query(
      `INSERT INTO registrations (${fields.join(', ')}) VALUES (${placeholders})`,
      values
    );
    
    return registration;
  },
  
  findByIdAndUpdate: async (id, updates) => {
    const pool = await getPool();
    updates.updatedAt = new Date();
    
    const fields = Object.keys(updates);
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = [...fields.map(f => updates[f]), id];
    
    await pool.query(`UPDATE registrations SET ${setClause} WHERE _id = ?`, values);
    return Registration.findById(id);
  },
  
  findByIdAndDelete: async (id) => {
    const pool = await getPool();
    await pool.query('DELETE FROM registrations WHERE _id = ?', [id]);
    return true;
  },
  
  countByWorkshop: async (workshopId) => {
    const pool = await getPool();
    const [rows] = await pool.query(
      'SELECT COUNT(*) as count FROM registrations WHERE workshopId = ?',
      [workshopId]
    );
    return rows[0].count;
  },
  
  // Alias methods for compatibility
  update: async (id, updates) => {
    return Registration.findByIdAndUpdate(id, updates);
  },
  
  deleteById: async (id) => {
    return Registration.findByIdAndDelete(id);
  },
  
  getRegistrationCount: async (workshopId) => {
    if (workshopId) {
      return Registration.countByWorkshop(workshopId);
    }
    const pool = await getPool();
    const [rows] = await pool.query('SELECT COUNT(*) as count FROM registrations');
    return rows[0].count;
  },
  
  isRegistrationFull: async () => {
    const count = await Registration.getRegistrationCount();
    return count >= 500; // Default max
  },
  
  getNextFormNumber: async (workshopId) => {
    const pool = await getPool();
    const connection = await pool.getConnection();
    
    try {
      // Use transaction with row lock for atomic form number generation
      await connection.beginTransaction();
      
      // Get the workshop's cneCpdNumber for the form prefix
      let prefix = 'REG';
      if (workshopId) {
        const [workshopRows] = await connection.query(
          'SELECT cneCpdNumber FROM workshops WHERE _id = ?',
          [workshopId]
        );
        if (workshopRows.length > 0 && workshopRows[0].cneCpdNumber) {
          prefix = workshopRows[0].cneCpdNumber;
        }
      }
      
      // Insert or update the counter atomically with row lock
      // Start from 0 so first registration gets 0001
      await connection.query(
        `INSERT INTO form_number_counters (workshopId, lastNumber) VALUES (?, 0) 
         ON DUPLICATE KEY UPDATE lastNumber = lastNumber`,
        [workshopId]
      );
      
      // Get and increment in one atomic operation with row lock
      await connection.query(
        'UPDATE form_number_counters SET lastNumber = lastNumber + 1 WHERE workshopId = ?',
        [workshopId]
      );
      
      const [rows] = await connection.query(
        'SELECT lastNumber FROM form_number_counters WHERE workshopId = ?',
        [workshopId]
      );
      
      await connection.commit();
      
      const formNumber = rows[0].lastNumber;
      
      // Format: {cneCpdNumber}-{registrationNumber} e.g., 1001-0051, CPD-0052
      return `${prefix}-${String(formNumber).padStart(4, '0')}`;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
};

// ==================== ATTENDANCE OPERATIONS ====================
const Attendance = {
  find: async (query = {}) => {
    const pool = await getPool();
    let sql = 'SELECT * FROM attendance';
    const values = [];
    
    if (Object.keys(query).length > 0) {
      const conditions = Object.keys(query).map(key => {
        values.push(query[key]);
        return `${key} = ?`;
      });
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    
    sql += ' ORDER BY createdAt DESC';
    const [rows] = await pool.query(sql, values);
    return rows;
  },
  
  findOne: async (query) => {
    const records = await Attendance.find(query);
    return records[0] || null;
  },
  
  findById: async (id) => {
    return Attendance.findOne({ _id: id });
  },
  
  findByWorkshop: async (workshopId) => {
    return Attendance.find({ workshopId: workshopId });
  },
  
  create: async (data) => {
    const pool = await getPool();
    const id = 'ATT' + String(await generateId('attendance')).padStart(6, '0');
    
    const attendance = {
      _id: id,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const fields = Object.keys(attendance);
    const placeholders = fields.map(() => '?').join(', ');
    const values = fields.map(f => attendance[f]);
    
    await pool.query(
      `INSERT INTO attendance (${fields.join(', ')}) VALUES (${placeholders})`,
      values
    );
    
    return attendance;
  },
  
  findByIdAndUpdate: async (id, updates) => {
    const pool = await getPool();
    updates.updatedAt = new Date();
    
    const fields = Object.keys(updates);
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = [...fields.map(f => updates[f]), id];
    
    await pool.query(`UPDATE attendance SET ${setClause} WHERE _id = ?`, values);
    return Attendance.findById(id);
  },
  
  findByIdAndDelete: async (id) => {
    const pool = await getPool();
    await pool.query('DELETE FROM attendance WHERE _id = ?', [id]);
    return true;
  },
  
  // Alias methods for compatibility
  update: async (id, updates) => {
    return Attendance.findByIdAndUpdate(id, updates);
  },
  
  deleteById: async (id) => {
    return Attendance.findByIdAndDelete(id);
  }
};

// ==================== AGENT OPERATIONS ====================
const Agent = {
  find: async (query = {}) => {
    const pool = await getPool();
    let sql = 'SELECT * FROM agents';
    const values = [];
    
    if (Object.keys(query).length > 0) {
      const conditions = Object.keys(query).map(key => {
        values.push(query[key]);
        return `${key} = ?`;
      });
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    
    sql += ' ORDER BY createdAt DESC';
    const [rows] = await pool.query(sql, values);
    return rows;
  },
  
  findOne: async (query) => {
    const agents = await Agent.find(query);
    return agents[0] || null;
  },
  
  findById: async (id) => {
    return Agent.findOne({ _id: id });
  },
  
  findByCode: async (code) => {
    return Agent.findOne({ code: code });
  },
  
  findByUsername: async (username) => {
    return Agent.findOne({ username: username });
  },
  
  create: async (data) => {
    const pool = await getPool();
    const id = 'AGT' + String(await generateId('agent')).padStart(6, '0');
    
    // Check if username already exists
    if (data.username) {
      const existing = await Agent.findByUsername(data.username);
      if (existing) {
        throw new Error('Username already exists');
      }
    }
    
    const agent = {
      _id: id,
      ...data,
      totalRegistrations: 0,
      status: data.status || 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const fields = Object.keys(agent);
    const placeholders = fields.map(() => '?').join(', ');
    const values = fields.map(f => agent[f]);
    
    await pool.query(
      `INSERT INTO agents (${fields.join(', ')}) VALUES (${placeholders})`,
      values
    );
    
    return agent;
  },
  
  findByIdAndUpdate: async (id, updates) => {
    const pool = await getPool();
    updates.updatedAt = new Date();
    
    const fields = Object.keys(updates);
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = [...fields.map(f => updates[f]), id];
    
    await pool.query(`UPDATE agents SET ${setClause} WHERE _id = ?`, values);
    return Agent.findById(id);
  },
  
  findByIdAndDelete: async (id) => {
    const pool = await getPool();
    await pool.query('DELETE FROM agents WHERE _id = ?', [id]);
    return true;
  },
  
  incrementRegistrationCount: async (id) => {
    const pool = await getPool();
    await pool.query(
      'UPDATE agents SET totalRegistrations = totalRegistrations + 1, updatedAt = NOW() WHERE _id = ?',
      [id]
    );
    return Agent.findById(id);
  },
  
  // Alias methods for compatibility
  update: async (id, updates) => {
    return Agent.findByIdAndUpdate(id, updates);
  },
  
  deleteById: async (id) => {
    return Agent.findByIdAndDelete(id);
  },
  
  verifyCredentials: async (username, password) => {
    const pool = await getPool();
    const [rows] = await pool.query(
      'SELECT * FROM agents WHERE username = ? AND password = ? AND status = "active" LIMIT 1',
      [username, password]
    );
    return rows[0] || null;
  }
};

// ==================== AUDIT LOG OPERATIONS ====================
let auditLogCounter = 0;

const AuditLog = {
  create: async (data) => {
    const pool = await getPool();
    auditLogCounter++;
    const id = 'LOG' + Date.now() + String(auditLogCounter).padStart(4, '0');
    
    const log = {
      _id: id,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId || null,
      userId: data.userId || null,
      username: data.username || null,
      userRole: data.userRole || null,
      details: data.details ? JSON.stringify(data.details) : null,
      ipAddress: data.ipAddress || null,
      createdAt: new Date()
    };
    
    const fields = Object.keys(log);
    const placeholders = fields.map(() => '?').join(', ');
    const values = fields.map(f => log[f]);
    
    await pool.query(
      `INSERT INTO audit_logs (${fields.join(', ')}) VALUES (${placeholders})`,
      values
    );
    
    return log;
  },
  
  find: async (query = {}) => {
    const pool = await getPool();
    let sql = 'SELECT * FROM audit_logs';
    const values = [];
    
    if (Object.keys(query).length > 0) {
      const conditions = Object.keys(query).map(key => {
        values.push(query[key]);
        return `${key} = ?`;
      });
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    
    sql += ' ORDER BY createdAt DESC LIMIT 1000';
    const [rows] = await pool.query(sql, values);
    return rows;
  },
  
  findByEntity: async (entityType, entityId) => {
    const pool = await getPool();
    const [rows] = await pool.query(
      'SELECT * FROM audit_logs WHERE entityType = ? AND entityId = ? ORDER BY createdAt DESC',
      [entityType, entityId]
    );
    return rows;
  },
  
  // Bitflow Owner Portal - Get all logs with advanced filters
  getAll: async (filters = {}) => {
    try {
      const pool = await getPool();
      let sql = 'SELECT * FROM audit_logs';
      const conditions = [];
      const values = [];
      
      // Add filters
      if (filters.action) {
        conditions.push('action = ?');
        values.push(filters.action);
      }
      
      if (filters.entityType) {
        conditions.push('entityType = ?');
        values.push(filters.entityType);
      }
      
      if (filters.userId) {
        conditions.push('userId = ?');
        values.push(filters.userId);
      }
      
      // Date range filter
      if (filters.dateRange) {
        if (filters.dateRange.from) {
          conditions.push('createdAt >= ?');
          values.push(filters.dateRange.from);
        }
        if (filters.dateRange.to) {
          conditions.push('createdAt <= ?');
          values.push(filters.dateRange.to);
        }
      }
      
      // Add WHERE clause if there are conditions
      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }
      
      // Order by most recent first
      sql += ' ORDER BY createdAt DESC LIMIT 5000';
      
      const [rows] = await pool.query(sql, values);
      
      // Parse JSON details field
      const logsWithParsedDetails = rows.map(row => {
        try {
          return {
            ...row,
            details: row.details ? JSON.parse(row.details) : null
          };
        } catch (e) {
          return row;
        }
      });
      
      return {
        success: true,
        data: logsWithParsedDetails
      };
    } catch (error) {
      console.error('Error in AuditLog.getAll:', error);
      return {
        success: false,
        message: 'Error fetching audit logs',
        error: error.message
      };
    }
  },
  
  // Bitflow Owner Portal - Get log by ID
  getById: async (logId) => {
    try {
      const pool = await getPool();
      const [rows] = await pool.query(
        'SELECT * FROM audit_logs WHERE _id = ?',
        [logId]
      );
      
      if (rows.length === 0) {
        return {
          success: false,
          message: 'Audit log not found'
        };
      }
      
      const log = rows[0];
      
      // Parse JSON details
      try {
        log.details = log.details ? JSON.parse(log.details) : null;
      } catch (e) {
        // Keep original if parsing fails
      }
      
      return {
        success: true,
        data: log
      };
    } catch (error) {
      console.error('Error in AuditLog.getById:', error);
      return {
        success: false,
        message: 'Error fetching audit log',
        error: error.message
      };
    }
  }
};

module.exports = {
  initDatabase,
  getPool,
  User,
  Workshop,
  Student,
  Registration,
  Attendance,
  Agent,
  AuditLog
};
