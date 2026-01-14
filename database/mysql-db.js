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
      name VARCHAR(255) NOT NULL,
      mncUID VARCHAR(100),
      mncRegistrationNumber VARCHAR(100),
      mncRegPrefix VARCHAR(50),
      mncRegNumber VARCHAR(50),
      mobileNumber VARCHAR(20),
      email VARCHAR(255),
      
      formNumber VARCHAR(50),
      qrCode TEXT,
      qrCodeUrl VARCHAR(255),
      
      paymentStatus ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
      registrationStatus ENUM('pending', 'confirmed', 'cancelled') DEFAULT 'pending',
      
      registeredBy VARCHAR(100),
      registeredByType ENUM('self', 'executive', 'admin') DEFAULT 'self',
      agentId VARCHAR(50),
      
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
      mobileNumber VARCHAR(20),
      formNumber VARCHAR(50),
      
      checkInTime DATETIME,
      checkOutTime DATETIME,
      status ENUM('present', 'absent', 'late') DEFAULT 'present',
      
      markedBy VARCHAR(100),
      markedByType ENUM('scan', 'manual') DEFAULT 'scan',
      
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      INDEX idx_workshopId (workshopId),
      INDEX idx_registrationId (registrationId),
      INDEX idx_studentId (studentId)
    )`,
    
    // Agents table
    `CREATE TABLE IF NOT EXISTS agents (
      _id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      code VARCHAR(50) UNIQUE,
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
    const [rows] = await pool.query("SELECT * FROM workshops WHERE status = 'active' ORDER BY date ASC");
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
    await pool.query(
      'UPDATE workshops SET currentRegistrations = currentRegistrations + 1, updatedAt = NOW() WHERE _id = ?',
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
    return Student.findOne({ mncUID: mncUID });
  },
  
  findByMncRegistrationNumber: async (mncRegNo) => {
    return Student.findOne({ mncRegistrationNumber: mncRegNo });
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
    const [rows] = await pool.query(
      'SELECT COUNT(*) as count FROM registrations WHERE workshopId = ?',
      [workshopId]
    );
    const count = rows[0].count + 1;
    // Format: WS{workshopNumber}-{registrationNumber}
    // Extract workshop number from workshopId (e.g., WRK000001 -> 1)
    const wsNum = workshopId ? workshopId.replace(/\D/g, '') : '0';
    return `WS${wsNum}-${String(count).padStart(4, '0')}`;
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
  
  create: async (data) => {
    const pool = await getPool();
    const id = 'AGT' + String(await generateId('agent')).padStart(6, '0');
    
    const agent = {
      _id: id,
      ...data,
      totalRegistrations: 0,
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

module.exports = {
  initDatabase,
  getPool,
  User,
  Workshop,
  Student,
  Registration,
  Attendance,
  Agent
};
