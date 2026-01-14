const fs = require('fs');
const path = require('path');

// Database directory
const DB_DIR = path.join(__dirname, 'database');
const REGISTRATIONS_FILE = path.join(DB_DIR, 'registrations.json');
const WORKSHOPS_FILE = path.join(DB_DIR, 'workshops.json');
const USERS_FILE = path.join(DB_DIR, 'users.json');
const COUNTER_FILE = path.join(DB_DIR, 'counters.json');
const ATTENDANCE_FILE = path.join(DB_DIR, 'attendance.json');
const STUDENTS_FILE = path.join(DB_DIR, 'students.json');
const AGENTS_FILE = path.join(DB_DIR, 'agents.json');

// Initialize database
function initDatabase() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  
  if (!fs.existsSync(REGISTRATIONS_FILE)) {
    fs.writeFileSync(REGISTRATIONS_FILE, JSON.stringify([], null, 2));
  }
  
  if (!fs.existsSync(WORKSHOPS_FILE)) {
    fs.writeFileSync(WORKSHOPS_FILE, JSON.stringify([], null, 2));
  }
  
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2));
  }
  
  if (!fs.existsSync(COUNTER_FILE)) {
    fs.writeFileSync(COUNTER_FILE, JSON.stringify({ registrationId: 0, workshopId: 0, userId: 0, attendanceId: 0, studentId: 0, agentId: 0 }, null, 2));
  }
  
  if (!fs.existsSync(ATTENDANCE_FILE)) {
    fs.writeFileSync(ATTENDANCE_FILE, JSON.stringify([], null, 2));
  }
  
  if (!fs.existsSync(STUDENTS_FILE)) {
    fs.writeFileSync(STUDENTS_FILE, JSON.stringify([], null, 2));
  }
  
  if (!fs.existsSync(AGENTS_FILE)) {
    fs.writeFileSync(AGENTS_FILE, JSON.stringify([], null, 2));
  }
}

// Read data from file
function readData(filename) {
  try {
    const data = fs.readFileSync(filename, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading ${filename}:`, error);
    return [];
  }
}

// Write data to file
function writeData(filename, data) {
  try {
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`Error writing ${filename}:`, error);
    return false;
  }
}

// Generate unique ID
function generateId(type) {
  const counters = readData(COUNTER_FILE);
  const key = `${type}Id`;
  counters[key] = (counters[key] || 0) + 1;
  writeData(COUNTER_FILE, counters);
  return counters[key].toString();
}

// Registration operations
const Registration = {
  find: (query = {}) => {
    const registrations = readData(REGISTRATIONS_FILE);
    if (Object.keys(query).length === 0) return registrations;
    
    return registrations.filter(reg => {
      return Object.keys(query).every(key => {
        if (key === 'workshopId') return reg.workshopId === query[key];
        return reg[key] === query[key];
      });
    });
  },
  
  findOne: (query) => {
    const registrations = readData(REGISTRATIONS_FILE);
    return registrations.find(reg => {
      return Object.keys(query).every(key => {
        if (key === 'workshopId') return reg.workshopId === query[key];
        return reg[key] === query[key];
      });
    });
  },
  
  findById: (id) => {
    const registrations = readData(REGISTRATIONS_FILE);
    return registrations.find(reg => reg._id === id);
  },
  
  create: (data) => {
    const registrations = readData(REGISTRATIONS_FILE);
    const newReg = {
      _id: generateId('registration'),
      ...data,
      downloadCount: 0,
      submittedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    registrations.push(newReg);
    writeData(REGISTRATIONS_FILE, registrations);
    return newReg;
  },
  
  updateById: (id, updates) => {
    const registrations = readData(REGISTRATIONS_FILE);
    const index = registrations.findIndex(reg => reg._id === id);
    if (index === -1) return null;
    
    registrations[index] = {
      ...registrations[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    writeData(REGISTRATIONS_FILE, registrations);
    return registrations[index];
  },
  
  deleteById: (id) => {
    const registrations = readData(REGISTRATIONS_FILE);
    const filtered = registrations.filter(reg => reg._id !== id);
    writeData(REGISTRATIONS_FILE, filtered);
    return true;
  },
  
  countDocuments: (query = {}) => {
    const registrations = Registration.find(query);
    return registrations.length;
  },
  
  getNextFormNumber: (workshopId = null) => {
    if (!workshopId) {
      // If no workshop specified, return numeric form number
      const registrations = Registration.find({});
      const formNumbers = registrations
        .map(r => {
          if (typeof r.formNumber === 'string' && r.formNumber.includes('-')) {
            return parseInt(r.formNumber.split('-')[1]) || 0;
          }
          return r.formNumber || 0;
        });
      return Math.max(0, ...formNumbers) + 1;
    }
    
    // Get workshop to fetch CPD number
    const workshop = Workshop.findById(workshopId);
    if (!workshop || !workshop.cneCpdNumber) {
      // Fallback to numeric if no CPD number
      const registrations = Registration.find({ workshopId });
      const formNumbers = registrations.map(r => r.formNumber || 0);
      return Math.max(0, ...formNumbers) + 1;
    }
    
    // Generate CPD-FormNumber format
    const cneCpd = workshop.cneCpdNumber;
    const registrations = Registration.find({ workshopId });
    
    // Extract numeric parts from existing form numbers for this workshop
    const sequenceNumbers = registrations
      .map(r => {
        if (typeof r.formNumber === 'string' && r.formNumber.startsWith(cneCpd + '-')) {
          const parts = r.formNumber.split('-');
          return parseInt(parts[parts.length - 1]) || 0;
        }
        return 0;
      })
      .filter(n => n > 0);
    
    const nextSequence = sequenceNumbers.length > 0 ? Math.max(...sequenceNumbers) + 1 : 1;
    const paddedSequence = String(nextSequence).padStart(3, '0');
    
    return `${cneCpd}-${paddedSequence}`;
  },
  
  isRegistrationFull: async (workshopId = null) => {
    if (workshopId) {
      const workshop = Workshop.findById(workshopId);
      if (!workshop) return true;
      const count = Registration.countDocuments({ workshopId });
      return count >= workshop.maxSeats;
    }
    const count = Registration.countDocuments();
    return count >= 500;
  }
};

// Workshop operations
const Workshop = {
  find: (query = {}) => {
    const workshops = readData(WORKSHOPS_FILE);
    if (Object.keys(query).length === 0) return workshops;
    
    return workshops.filter(workshop => {
      return Object.keys(query).every(key => workshop[key] === query[key]);
    });
  },
  
  findOne: (query) => {
    const workshops = readData(WORKSHOPS_FILE);
    return workshops.find(workshop => {
      return Object.keys(query).every(key => workshop[key] === query[key]);
    });
  },
  
  findById: (id) => {
    const workshops = readData(WORKSHOPS_FILE);
    return workshops.find(workshop => workshop._id === id);
  },
  
  create: (data) => {
    const workshops = readData(WORKSHOPS_FILE);
    const newWorkshop = {
      _id: generateId('workshop'),
      ...data,
      currentRegistrations: 0,
      status: data.status || 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    workshops.push(newWorkshop);
    writeData(WORKSHOPS_FILE, workshops);
    return newWorkshop;
  },
  
  updateById: (id, updates) => {
    const workshops = readData(WORKSHOPS_FILE);
    const index = workshops.findIndex(workshop => workshop._id === id);
    if (index === -1) return null;
    
    workshops[index] = {
      ...workshops[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    writeData(WORKSHOPS_FILE, workshops);
    return workshops[index];
  },
  
  deleteById: (id) => {
    const workshops = readData(WORKSHOPS_FILE);
    const filtered = workshops.filter(workshop => workshop._id !== id);
    writeData(WORKSHOPS_FILE, filtered);
    return true;
  },
  
  getActiveWorkshop: () => {
    return Workshop.findOne({ status: 'active' });
  },
  
  getUpcomingWorkshops: () => {
    const workshops = readData(WORKSHOPS_FILE);
    const now = new Date();
    return workshops
      .filter(w => ['upcoming', 'active'].includes(w.status) && new Date(w.date) >= now)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  },
  
  getLatestWorkshop: () => {
    const active = Workshop.findOne({ status: 'active' });
    if (active) return active;
    
    const workshops = readData(WORKSHOPS_FILE);
    const now = new Date();
    const upcoming = workshops
      .filter(w => w.status === 'upcoming' && new Date(w.date) >= now)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    
    return upcoming[0] || null;
  },
  
  incrementRegistrationCount: (id) => {
    const workshop = Workshop.findById(id);
    if (!workshop) return null;
    
    const newCount = (workshop.currentRegistrations || 0) + 1;
    const updates = { currentRegistrations: newCount };
    
    // Auto-mark as full if max seats reached
    if (newCount >= workshop.maxSeats) {
      updates.status = 'full';
    }
    
    return Workshop.updateById(id, updates);
  }
};

// User operations
const User = {
  find: (query = {}) => {
    const users = readData(USERS_FILE);
    if (Object.keys(query).length === 0) return users;
    
    return users.filter(user => {
      return Object.keys(query).every(key => user[key] === query[key]);
    });
  },
  
  findOne: (query) => {
    const users = readData(USERS_FILE);
    return users.find(user => {
      return Object.keys(query).every(key => user[key] === query[key]);
    });
  },
  
  findById: (id) => {
    const users = readData(USERS_FILE);
    return users.find(user => user._id === id);
  },
  
  create: (data) => {
    const users = readData(USERS_FILE);
    const newUser = {
      _id: generateId('user'),
      ...data,
      role: data.role || 'user',
      status: data.status || 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    users.push(newUser);
    writeData(USERS_FILE, users);
    return newUser;
  },
  
  updateById: (id, updates) => {
    const users = readData(USERS_FILE);
    const index = users.findIndex(user => user._id === id);
    if (index === -1) return null;
    
    users[index] = {
      ...users[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    writeData(USERS_FILE, users);
    return users[index];
  },
  
  deleteById: (id) => {
    const users = readData(USERS_FILE);
    const filtered = users.filter(user => user._id !== id);
    writeData(USERS_FILE, filtered);
    return true;
  },
  
  countDocuments: (query = {}) => {
    const users = User.find(query);
    return users.length;
  }
};

// Attendance Model
const Attendance = {
  find: (query = {}) => {
    const attendance = readData(ATTENDANCE_FILE);
    if (Object.keys(query).length === 0) return attendance;
    
    return attendance.filter(att => {
      return Object.keys(query).every(key => att[key] === query[key]);
    });
  },
  
  findById: (id) => {
    const attendance = readData(ATTENDANCE_FILE);
    return attendance.find(att => att._id === id) || null;
  },
  
  findOne: (query) => {
    const attendance = readData(ATTENDANCE_FILE);
    return attendance.find(att => {
      return Object.keys(query).every(key => att[key] === query[key]);
    }) || null;
  },
  
  create: (data) => {
    const attendance = readData(ATTENDANCE_FILE);
    const counters = readData(COUNTER_FILE);
    
    counters.attendanceId = (counters.attendanceId || 0) + 1;
    
    const newAttendance = {
      _id: `ATT${String(counters.attendanceId).padStart(6, '0')}`,
      ...data,
      createdAt: new Date().toISOString()
    };
    
    attendance.push(newAttendance);
    writeData(ATTENDANCE_FILE, attendance);
    writeData(COUNTER_FILE, counters);
    
    return newAttendance;
  },
  
  deleteById: (id) => {
    const attendance = readData(ATTENDANCE_FILE);
    const filtered = attendance.filter(att => att._id !== id);
    writeData(ATTENDANCE_FILE, filtered);
    return true;
  },
  
  countDocuments: (query = {}) => {
    const attendance = Attendance.find(query);
    return attendance.length;
  }
};

// Student operations (Central Student Database)
const Student = {
  find: (query = {}) => {
    const students = readData(STUDENTS_FILE);
    if (Object.keys(query).length === 0) return students;
    
    return students.filter(student => {
      return Object.keys(query).every(key => student[key] === query[key]);
    });
  },
  
  findOne: (query) => {
    const students = readData(STUDENTS_FILE);
    return students.find(student => {
      return Object.keys(query).every(key => student[key] === query[key]);
    });
  },
  
  findById: (id) => {
    const students = readData(STUDENTS_FILE);
    return students.find(s => s._id === id);
  },
  
  findByMobile: (mobile) => {
    const students = readData(STUDENTS_FILE);
    return students.find(s => s.mobileNumber === mobile);
  },
  
  findByMncUID: (mncUID) => {
    const students = readData(STUDENTS_FILE);
    return students.find(s => s.mncUID === mncUID);
  },
  
  findByMncRegistrationNumber: (mncRegNo) => {
    const students = readData(STUDENTS_FILE);
    return students.find(s => s.mncRegistrationNumber === mncRegNo);
  },
  
  findByEmail: (email) => {
    const students = readData(STUDENTS_FILE);
    return students.find(s => s.email && s.email.toLowerCase() === email.toLowerCase());
  },
  
  create: (data) => {
    const students = readData(STUDENTS_FILE);
    
    // Check if student already exists by mobile, email, or MNC UID
    const existing = students.find(s => 
      s.mobileNumber === data.mobileNumber || 
      (data.email && s.email && s.email.toLowerCase() === data.email.toLowerCase()) ||
      (data.mncUID && s.mncUID === data.mncUID)
    );
    
    if (existing) {
      return existing; // Return existing student
    }
    
    const newStudent = {
      _id: 'STU' + String(generateId('student')).padStart(6, '0'),
      ...data,
      mncUID: data.mncUID || null,
      mncRegistrationNumber: data.mncRegistrationNumber || null,
      totalWorkshops: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    students.push(newStudent);
    writeData(STUDENTS_FILE, students);
    return newStudent;
  },
  
  update: (id, updates) => {
    const students = readData(STUDENTS_FILE);
    const index = students.findIndex(s => s._id === id);
    if (index === -1) return null;
    
    students[index] = {
      ...students[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    writeData(STUDENTS_FILE, students);
    return students[index];
  },
  
  deleteById: (id) => {
    const students = readData(STUDENTS_FILE);
    const filtered = students.filter(s => s._id !== id);
    writeData(STUDENTS_FILE, filtered);
    return true;
  },
  
  incrementWorkshopCount: (id) => {
    const student = Student.findById(id);
    if (!student) return null;
    
    return Student.update(id, {
      totalWorkshops: (student.totalWorkshops || 0) + 1
    });
  },
  
  // Get all students (for bulk operations)
  findAll: () => {
    return readData(STUDENTS_FILE);
  },
  
  // Bulk create students (FAST - single file write)
  bulkCreate: (studentsArray) => {
    const students = readData(STUDENTS_FILE);
    const counters = readData(COUNTER_FILE);
    
    const newStudents = studentsArray.map(data => {
      counters.studentId = (counters.studentId || 0) + 1;
      return {
        _id: 'STU' + String(counters.studentId).padStart(6, '0'),
        ...data,
        mncUID: data.mncUID || null,
        mncRegistrationNumber: data.mncRegistrationNumber || null,
        totalWorkshops: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    });
    
    // Single write for all students
    students.push(...newStudents);
    writeData(STUDENTS_FILE, students);
    writeData(COUNTER_FILE, counters);
    
    return newStudents;
  }
};

// Agent operations (Agent User Management)
const Agent = {
  find: (query = {}) => {
    const agents = readData(AGENTS_FILE);
    if (Object.keys(query).length === 0) return agents;
    
    return agents.filter(agent => {
      return Object.keys(query).every(key => agent[key] === query[key]);
    });
  },
  
  findOne: (query) => {
    const agents = readData(AGENTS_FILE);
    return agents.find(agent => {
      return Object.keys(query).every(key => agent[key] === query[key]);
    });
  },
  
  findById: (id) => {
    const agents = readData(AGENTS_FILE);
    return agents.find(a => a._id === id);
  },
  
  findByUsername: (username) => {
    const agents = readData(AGENTS_FILE);
    return agents.find(a => a.username === username);
  },
  
  create: (data) => {
    const agents = readData(AGENTS_FILE);
    
    // Check if username already exists
    const existing = agents.find(a => a.username === data.username);
    if (existing) {
      throw new Error('Username already exists');
    }
    
    const newAgent = {
      _id: 'AGT' + String(generateId('agent')).padStart(6, '0'),
      ...data,
      totalRegistrations: 0,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    agents.push(newAgent);
    writeData(AGENTS_FILE, agents);
    return newAgent;
  },
  
  update: (id, updates) => {
    const agents = readData(AGENTS_FILE);
    const index = agents.findIndex(a => a._id === id);
    if (index === -1) return null;
    
    agents[index] = {
      ...agents[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    writeData(AGENTS_FILE, agents);
    return agents[index];
  },
  
  deleteById: (id) => {
    const agents = readData(AGENTS_FILE);
    const filtered = agents.filter(a => a._id !== id);
    writeData(AGENTS_FILE, filtered);
    return true;
  },
  
  incrementRegistrationCount: (id) => {
    const agent = Agent.findById(id);
    if (!agent) return null;
    
    return Agent.update(id, {
      totalRegistrations: (agent.totalRegistrations || 0) + 1
    });
  },
  
  verifyCredentials: (username, password) => {
    const agent = Agent.findByUsername(username);
    if (!agent || agent.status !== 'active') return null;
    return agent.password === password ? agent : null;
  }
};

// Initialize database on module load
initDatabase();

module.exports = {
  Registration,
  Workshop,
  User,
  Attendance,
  Student,
  Agent,
  initDatabase
};
