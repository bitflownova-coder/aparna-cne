require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');

// Use MySQL database for production, local JSON for development
const useMySQL = process.env.USE_MYSQL === 'true';
let db;
if (useMySQL) {
  db = require('./database/mysql-db');
  console.log('Using MySQL Database');
} else {
  db = require('./localdb');
  console.log('Using Local JSON Database');
}
const { initDatabase } = db;

// Import routes
const registrationRoutes = require('./routes/registration');
const adminRoutes = require('./routes/admin');
const workshopRoutes = require('./routes/workshop');
const adminWorkshopRoutes = require('./routes/adminWorkshop');
const userRoutes = require('./routes/users');
const mncRoutes = require('./routes/mnc');
const attendanceRoutes = require('./routes/attendance');
const agentRoutes = require('./routes/agent');
const executiveRoutes = require('./routes/executive');

const app = express();
const PORT = process.env.PORT || 3000;

// Rate limiting - Only apply to form submissions (POST/PUT/DELETE)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000,
  message: 'Too many requests from this IP.',
  skip: (req) => {
    // Skip rate limiting for GET requests and admin routes
    return req.method === 'GET' || req.path.startsWith('/api/admin/');
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply rate limiting to API routes
app.use('/api/', limiter);

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'SaiCareGroup_CNE_Secret_Key_2025_Secure',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to false for HTTP
    httpOnly: true,
    maxAge: 2 * 60 * 60 * 1000, // 2 hours
    sameSite: 'lax'
  },
  rolling: true // Reset maxAge on every response
}));

// Serve static assets first (efficient serving)
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use('/assest', express.static('assest'));

// Favicon handler
app.get('/favicon.ico', (req, res) => {
  const logoPath = path.join(__dirname, 'assest', 'logo.png');
  if (fs.existsSync(logoPath)) return res.sendFile(logoPath);
  res.status(204).end();
});

// Initialize database
(async () => {
  try {
    await initDatabase();
    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    process.exit(1);
  }
})();

// Mount API Routes
app.use('/api/registration', registrationRoutes);
app.use('/api/admin/workshops', adminWorkshopRoutes); // Mount before generic admin
app.use('/api/admin', adminRoutes);
app.use('/api/workshop', workshopRoutes); // Public workshop routes
app.use('/api/users', userRoutes);
app.use('/api/mnc', mncRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/agent', agentRoutes); // Legacy support
app.use('/api/executive', executiveRoutes); // New routes

// HTML Page Routes
const sendPage = (pageName, res) => res.sendFile(path.join(__dirname, 'public', pageName));

app.get('/', (req, res) => sendPage('index.html', res));
app.get('/view-registration', (req, res) => sendPage('view-registration.html', res));
app.get('/admin-login', (req, res) => sendPage('admin-login.html', res));
app.get('/admin-dashboard', (req, res) => sendPage('admin-dashboard.html', res));
app.get('/admin-workshops', (req, res) => sendPage('admin-workshops.html', res));
app.get('/admin-users', (req, res) => sendPage('admin-users.html', res));
app.get('/admin-bulk-upload', (req, res) => sendPage('admin-bulk-upload.html', res));
app.get('/admin-bulk-students', (req, res) => sendPage('admin-bulk-students.html', res));
app.get('/admin-students', (req, res) => sendPage('admin-students.html', res));
app.get('/admin-agents', (req, res) => sendPage('admin-agents.html', res));
app.get('/attendance-login', (req, res) => sendPage('attendance-login.html', res));
app.get('/attendance-portal', (req, res) => {
    // Check if user is logged in
    if (!req.session.attendanceUser) {
        return res.redirect('/attendance-login');
    }
    sendPage('attendance-portal.html', res);
});
app.get('/admin-attendance', (req, res) => sendPage('admin-attendance.html', res));

// Agent Portal Routes (Legacy support)
app.get('/agent-login', (req, res) => sendPage('agent-login.html', res));
app.get('/agent-portal', (req, res) => {
    // Check if agent is logged in
    if (!req.session.isAgent) {
        return res.redirect('/agent-login');
    }
    sendPage('agent-portal.html', res);
});
app.get('/agent-individual', (req, res) => {
    // Check if agent is logged in
    if (!req.session.isAgent) {
        return res.redirect('/agent-login');
    }
    sendPage('agent-individual.html', res);
});
app.get('/agent-bulk-upload', (req, res) => {
    // Check if agent is logged in
    if (!req.session.isAgent) {
        return res.redirect('/agent-login');
    }
    sendPage('agent-bulk-upload.html', res);
});

// Executive Portal Routes (New)
app.get('/executive-login', (req, res) => sendPage('executive-login.html', res));
app.get('/executive-portal', (req, res) => {
    if (!req.session.isAgent) {
        return res.redirect('/executive-login');
    }
    sendPage('executive-portal.html', res);
});
app.get('/executive-individual', (req, res) => {
    if (!req.session.isAgent) {
        return res.redirect('/executive-login');
    }
    sendPage('executive-individual.html', res);
});
app.get('/executive-bulk-upload', (req, res) => {
    if (!req.session.isAgent) {
        return res.redirect('/executive-login');
    }
    sendPage('executive-bulk-upload.html', res);
});

// Error Handling (404 for API, Global Error Handler)
app.use('/api/*', (req, res) => {
    res.status(404).json({ success: false, message: 'API Endpoint Not Found' });
});

app.use((err, req, res, next) => {
  console.error('Server Error:', err.stack);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

module.exports = app;
