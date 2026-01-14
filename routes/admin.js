const express = require('express');
const router = express.Router();
const Registration = require('../models/Registration');
const Workshop = require('../models/Workshop');
const { isAuthenticated, isAdmin, verifyAdminCredentials, verifyUserCredentials } = require('../middleware/auth');
const { Student, Agent, Attendance } = require('../localdb');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

// Configure multer for Excel upload
const excelStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads', 'temp');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `bulk-${Date.now()}-${file.originalname}`);
  }
});

const excelUpload = multer({
  storage: excelStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
        file.mimetype === 'application/vnd.ms-excel') {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files are allowed'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Admin login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Try admin login first
    const isAdmin = await verifyAdminCredentials(username, password);

    if (isAdmin) {
      req.session.isAdmin = true;
      req.session.username = username;
      req.session.role = 'admin';
      
      // Explicitly save the session
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          return res.status(500).json({
            success: false,
            message: 'Session error'
          });
        }
        
        res.json({
          success: true,
          message: 'Login successful',
          role: 'admin'
        });
      });
    } else {
      // Try user login
      const user = await verifyUserCredentials(username, password);
      
      if (user) {
        req.session.userId = user._id;
        req.session.username = username;
        req.session.role = 'user';
        req.session.fullName = user.fullName;
        
        req.session.save((err) => {
          if (err) {
            console.error('Session save error:', err);
            return res.status(500).json({
              success: false,
              message: 'Session error'
            });
          }
          
          res.json({
            success: true,
            message: 'Login successful',
            role: 'user',
            fullName: user.fullName
          });
        });
      } else {
        res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login error'
    });
  }
});

// Admin logout
router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true, message: 'Logged out successfully' });
});

// Check admin session
router.get('/check-session', (req, res) => {
  if (req.session && (req.session.isAdmin || req.session.userId)) {
    res.json({ 
      success: true, 
      isAdmin: req.session.isAdmin || false,
      isUser: !!req.session.userId,
      role: req.session.role,
      fullName: req.session.fullName
    });
  } else {
    res.json({ success: false, isAdmin: false, isUser: false });
  }
});

// Get Excel template
router.get('/template', isAuthenticated, (req, res) => {
  try {
    // Create template data
    const templateData = [
      {
        'Full Name': 'John Doe',
        'MNC UID': 'MNC2024001',
        'MNC Registration Number': 'IV-1234',
        'Mobile Number': '9876543210',
        'Address': '123, Sample Street, City, State - 400001',
        'Payment UTR': '123456789012'
      }
    ];

    // Create workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(templateData);

    // Set column widths
    ws['!cols'] = [
      { wch: 25 }, // Full Name
      { wch: 15 }, // MNC UID
      { wch: 20 }, // MNC Registration Number
      { wch: 15 }, // Mobile Number
      { wch: 40 }, // Address
      { wch: 20 }  // Payment UTR
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Registrations');

    // Generate buffer
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Set headers
    res.setHeader('Content-Disposition', 'attachment; filename=Registration_Template.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    
    res.send(excelBuffer);
  } catch (error) {
    console.error('Template download error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating template'
    });
  }
});

// Bulk upload registrations
router.post('/bulk-upload', isAuthenticated, excelUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload an Excel file'
      });
    }

    // Read the uploaded Excel file
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    if (data.length === 0) {
      // Clean up temp file
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Excel file is empty'
      });
    }

    const results = {
      success: [],
      failed: []
    };

    // Get the current workshop
    const workshop = await Workshop.getLatestWorkshop();
    if (!workshop) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'No active workshop found'
      });
    }

    // Process each row
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      try {
        // Validate required fields
        if (!row['Full Name'] || !row['MNC UID'] || !row['MNC Registration Number'] || 
            !row['Mobile Number'] || !row['Payment UTR']) {
          results.failed.push({
            row: i + 2, // Excel rows start from 2 (1 is header)
            data: row,
            reason: 'Missing required fields'
          });
          continue;
        }

        // Check if already registered
        const existing = Registration.findOne({ 
          mncUID: row['MNC UID'] 
        });
        
        if (existing) {
          results.failed.push({
            row: i + 2,
            data: row,
            reason: 'MNC UID already registered'
          });
          continue;
        }

        // Check if registration is full
        const isFull = await Registration.isRegistrationFull(workshop._id);
        if (isFull) {
          results.failed.push({
            row: i + 2,
            data: row,
            reason: 'Workshop registration full'
          });
          continue;
        }

        // Create registration
        const formNumber = await Registration.getNextFormNumber(workshop._id);
        
        const registration = Registration.create({
          fullName: row['Full Name'],
          mncUID: row['MNC UID'],
          mncRegistrationNumber: row['MNC Registration Number'],
          mobileNumber: row['Mobile Number'],
          address: row['Address'] || '',
          paymentUTR: row['Payment UTR'],
          paymentScreenshot: 'bulk-upload',
          workshopId: workshop._id,
          formNumber,
          ipAddress: req.ip,
          addedBy: req.session.username,
          addedByRole: req.session.role,
          source: 'bulk-upload'
        });

        // Increment workshop count
        await Workshop.incrementRegistrationCount(workshop._id);

        results.success.push({
          row: i + 2,
          formNumber,
          name: row['Full Name']
        });

      } catch (error) {
        results.failed.push({
          row: i + 2,
          data: row,
          reason: error.message
        });
      }
    }

    // Clean up temp file
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      message: `Bulk upload completed: ${results.success.length} succeeded, ${results.failed.length} failed`,
      results
    });

  } catch (error) {
    console.error('Bulk upload error:', error);
    // Clean up temp file if exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      message: 'Error processing bulk upload'
    });
  }
});

// Get all registrations (protected)
router.get('/registrations', isAuthenticated, async (req, res) => {
  try {
    const { search, page = 1, limit = 50, workshopId } = req.query;
    
    // Get all registrations (local DB doesn't support complex queries)
    let allRegistrations = Registration.find({});
    
    // Filter by workshop if specified
    if (workshopId) {
      allRegistrations = allRegistrations.filter(reg => reg.workshopId === workshopId);
    }
    
    // Apply search filter
    if (search && search.trim()) {
      const searchLower = search.toLowerCase();
      allRegistrations = allRegistrations.filter(reg => {
        return (
          (reg.fullName && reg.fullName.toLowerCase().includes(searchLower)) ||
          (reg.mncUID && reg.mncUID.toLowerCase().includes(searchLower)) ||
          (reg.mncRegistrationNumber && reg.mncRegistrationNumber.toLowerCase().includes(searchLower)) ||
          (reg.mobileNumber && reg.mobileNumber.includes(search)) ||
          (reg.paymentUTR && reg.paymentUTR.toLowerCase().includes(searchLower))
        );
      });
    }
    
    // Sort by submittedAt (newest first)
    allRegistrations.sort((a, b) => {
      const dateA = new Date(a.submittedAt || a.createdAt);
      const dateB = new Date(b.submittedAt || b.createdAt);
      return dateB - dateA;
    });
    
    // Pagination
    const total = allRegistrations.length;
    const skip = (page - 1) * limit;
    const registrations = allRegistrations.slice(skip, skip + parseInt(limit));

    res.json({
      success: true,
      data: registrations,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching registrations:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching registrations',
      error: error.message
    });
  }
});

// Get dashboard stats (protected)
router.get('/stats', isAuthenticated, async (req, res) => {
  try {
    const { workshopId } = req.query;
    
    let stats = {};
    
    if (workshopId) {
      // Get stats for specific workshop
      const workshop = Workshop.findById(workshopId);
      if (!workshop) {
        return res.status(404).json({ success: false, message: 'Workshop not found' });
      }
      
      const total = Registration.getRegistrationCount(workshopId);
      const maxRegistrations = workshop.maxSeats;
      const remaining = Math.max(0, maxRegistrations - total);
      const percentageFilled = total > 0 ? ((total / maxRegistrations) * 100).toFixed(2) : '0.00';
      
      // Get recent registrations for this workshop
      let recent = Registration.find({ workshopId });
      recent.sort((a, b) => {
        const dateA = new Date(a.submittedAt || a.createdAt);
        const dateB = new Date(b.submittedAt || b.createdAt);
        return dateB - dateA;
      });
      recent = recent.slice(0, 10).map(r => ({
        _id: r._id,
        fullName: r.fullName,
        mncUID: r.mncUID,
        formNumber: r.formNumber,
        submittedAt: r.submittedAt
      }));
      
      stats = {
        total,
        remaining,
        percentageFilled,
        maxRegistrations,
        workshop: {
          id: workshop._id,
          title: workshop.title,
          date: workshop.date,
          fee: workshop.fee,
          credits: workshop.credits,
          venue: workshop.venue,
          status: workshop.status
        }
      };
      
      res.json({
        success: true,
        stats,
        recentRegistrations: recent
      });
    } else {
      // Get aggregated stats for all workshops
      const total = Registration.getRegistrationCount();
      const allWorkshops = Workshop.find({});
      const totalMaxSeats = allWorkshops.reduce((sum, w) => sum + (w.maxSeats || 0), 0);
      const remaining = Math.max(0, totalMaxSeats - total);
      const percentageFilled = total > 0 && totalMaxSeats > 0 
        ? ((total / totalMaxSeats) * 100).toFixed(2)
        : '0.00';
      
      // Get recent registrations across all workshops
      let recent = Registration.find({});
      recent.sort((a, b) => {
        const dateA = new Date(a.submittedAt || a.createdAt);
        const dateB = new Date(b.submittedAt || b.createdAt);
        return dateB - dateA;
      });
      recent = recent.slice(0, 10).map(r => {
        const workshop = Workshop.findById(r.workshopId);
        return {
          _id: r._id,
          fullName: r.fullName,
          mncUID: r.mncUID,
          formNumber: r.formNumber,
          submittedAt: r.submittedAt,
          workshopId: workshop ? { _id: workshop._id, title: workshop.title } : null
        };
      });
      
      stats = {
        total,
        remaining,
        maxRegistrations: totalMaxSeats,
        percentageFilled,
        workshopCount: allWorkshops.length
      };
      
      res.json({
        success: true,
        stats,
        recentRegistrations: recent
      });
    }
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching stats',
      error: error.message
    });
  }
});

// Bulk download as Excel (protected)
router.get('/export-excel', isAuthenticated, async (req, res) => {
  try {
    const { workshopId, columns } = req.query;
    
    // Parse selected columns
    const selectedColumns = columns ? columns.split(',') : null;
    
    // Fetch registrations with optional workshop filter
    let registrations = Registration.find({});
    if (workshopId) {
      registrations = registrations.filter(r => r.workshopId === workshopId);
    }
    
    // Sort by submittedAt (newest first)
    registrations.sort((a, b) => {
      const dateA = new Date(a.submittedAt || a.createdAt);
      const dateB = new Date(b.submittedAt || b.createdAt);
      return dateB - dateA;
    });

    // Fetch attendance records
    const db = require('../localdb');
    const allAttendance = db.Attendance.find({});
    const attendanceMap = {};
    allAttendance.forEach(att => {
      const key = `${att.workshopId}_${att.mncUID}`;
      attendanceMap[key] = att;
    });

    // Column mapping
    const columnMapping = {
      'sno': 'S.No',
      'formNumber': 'Form Number',
      'fullName': 'Full Name',
      'mobileNumber': 'Mobile Number',
      'email': 'Email',
      'mncUID': 'MNC UID',
      'mncRegistrationNumber': 'MNC Registration Number',
      'workshop': 'Workshop',
      'workshopDate': 'Workshop Date',
      'registrationSource': 'Registration Source',
      'registeredBy': 'Registered By',
      'attendanceStatus': 'Attendance Status',
      'attendanceTime': 'Attendance Time',
      'dateOfBirth': 'Date of Birth',
      'gender': 'Gender',
      'qualification': 'Qualification',
      'organization': 'Organization',
      'experience': 'Experience (Years)',
      'city': 'City',
      'state': 'State',
      'submittedAt': 'Submitted At'
    };

    // Prepare data for Excel
    const excelData = registrations.map((reg, index) => {
      const workshop = Workshop.findById(reg.workshopId);
      const attendanceKey = `${reg.workshopId}_${reg.mncUID}`;
      const attendance = attendanceMap[attendanceKey];
      const attendanceStatus = attendance ? 'Present' : 'Applied';
      const attendanceTime = attendance ? new Date(attendance.markedAt).toLocaleString('en-IN') : '';
      
      // Determine registration source
      let registrationSource = 'Website';
      let registeredBy = '';
      
      if (reg.submittedBy === 'executive' || reg.submittedBy === 'executive_bulk') {
        registrationSource = reg.submittedBy === 'executive_bulk' ? 'Executive (Bulk)' : 'Executive (Individual)';
        registeredBy = reg.executiveUsername || reg.registeredBy || '';
      }
      
      // Full data object
      const fullData = {
        'sno': index + 1,
        'formNumber': reg.formNumber,
        'fullName': reg.fullName,
        'mobileNumber': reg.mobileNumber,
        'email': reg.email || 'N/A',
        'mncUID': reg.mncUID,
        'mncRegistrationNumber': reg.mncRegistrationNumber || 'N/A',
        'workshop': workshop ? workshop.title : 'N/A',
        'workshopDate': workshop ? new Date(workshop.date).toLocaleDateString('en-IN') : 'N/A',
        'registrationSource': registrationSource,
        'registeredBy': registeredBy,
        'attendanceStatus': attendanceStatus,
        'attendanceTime': attendanceTime,
        'dateOfBirth': reg.dateOfBirth || 'N/A',
        'gender': reg.gender || 'N/A',
        'qualification': reg.qualification || 'N/A',
        'organization': reg.organization || 'N/A',
        'experience': reg.experience || 'N/A',
        'city': reg.city || 'N/A',
        'state': reg.state || 'N/A',
        'submittedAt': new Date(reg.submittedAt || reg.createdAt).toLocaleString('en-IN')
      };
      
      // Filter columns if specified
      if (selectedColumns) {
        const filteredData = {};
        selectedColumns.forEach(col => {
          if (fullData.hasOwnProperty(col)) {
            filteredData[columnMapping[col]] = fullData[col];
          }
        });
        return filteredData;
      }
      
      // Return all columns with proper headers
      const result = {};
      Object.keys(columnMapping).forEach(key => {
        result[columnMapping[key]] = fullData[key];
      });
      return result;
    });

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Set column widths
    ws['!cols'] = [
      { wch: 6 },  // S.No
      { wch: 25 }, // Workshop
      { wch: 12 }, // Form Number
      { wch: 25 }, // Full Name
      { wch: 20 }, // Registration Source
      { wch: 20 }, // Registered By Agent
      { wch: 15 }, // Attendance Status
      { wch: 20 }, // Attendance Marked At
      { wch: 15 }, // MNC UID
      { wch: 25 }, // MNC Registration Number
      { wch: 15 }, // Mobile Number
      { wch: 30 }, // Address
      { wch: 20 }, // Payment UTR
      { wch: 30 }, // Payment Screenshot
      { wch: 15 }, // Download Count
      { wch: 20 }, // Submitted At
      { wch: 15 }  // IP Address
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Registrations');

    // Generate buffer
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Generate filename based on filter
    const workshop = workshopId ? Workshop.findById(workshopId) : null;
    const workshopName = workshop ? `${workshop.title.replace(/[^a-zA-Z0-9]/g, '_')}_` : 'All_Workshops_';
    const filename = `CNE_Registrations_${workshopName}${new Date().toISOString().split('T')[0]}.xlsx`;
    
    // Set headers for download
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    
    res.send(excelBuffer);

  } catch (error) {
    console.error('Excel download error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating Excel file'
    });
  }
});

// Delete a registration (protected)
router.delete('/registrations/:id', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const record = await Registration.findById(id);

    if (!record) {
      return res.status(404).json({ success: false, message: 'Registration not found' });
    }

    // Store workshopId before deletion
    const workshopId = record.workshopId;

    // Delete associated payment screenshot if exists
    if (record.paymentScreenshot) {
      const filePath = path.join(__dirname, '..', 'uploads', 'payments', record.paymentScreenshot);
      if (fs.existsSync(filePath)) {
        fs.unlink(filePath, () => {});
      }
    }

    await record.deleteOne();

    // Decrement workshop registration count
    if (workshopId) {
      const Workshop = require('../models/Workshop');
      const workshop = await Workshop.findById(workshopId);
      if (workshop && workshop.currentRegistrations > 0) {
        workshop.currentRegistrations -= 1;
        await workshop.save();
        console.log(`Decremented registration count for workshop ${workshopId} to ${workshop.currentRegistrations}`);
      }
    }

    res.json({ success: true, message: 'Registration deleted successfully' });
  } catch (error) {
    console.error('Error deleting registration:', error);
    res.status(500).json({ success: false, message: 'Error deleting registration' });
  }
});

// ==================== STUDENT DATABASE ROUTES ====================

// Get all students
router.get('/students', isAdmin, async (req, res) => {
  try {
    const students = Student.find();
    res.json({ success: true, students });
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ success: false, message: 'Error fetching students' });
  }
});

// Get student by ID with registration history
router.get('/students/:id', isAdmin, async (req, res) => {
  try {
    const student = Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    
    // Get student's registration history
    const { Registration: RegModel } = require('../localdb');
    const registrations = RegModel.find({ studentId: student._id });
    
    res.json({
      success: true,
      student,
      registrations
    });
  } catch (error) {
    console.error('Error fetching student:', error);
    res.status(500).json({ success: false, message: 'Error fetching student' });
  }
});

// Update student
router.put('/students/:id', isAdmin, async (req, res) => {
  try {
    const updated = Student.update(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    res.json({ success: true, student: updated });
  } catch (error) {
    console.error('Error updating student:', error);
    res.status(500).json({ success: false, message: 'Error updating student' });
  }
});

// Delete student
router.delete('/students/:id', isAdmin, async (req, res) => {
  try {
    Student.deleteById(req.params.id);
    res.json({ success: true, message: 'Student deleted successfully' });
  } catch (error) {
    console.error('Error deleting student:', error);
    res.status(500).json({ success: false, message: 'Error deleting student' });
  }
});

// Export students to Excel
router.get('/students/export/excel', isAdmin, async (req, res) => {
  try {
    const students = Student.find();
    const { Registration: RegModel } = require('../localdb');
    
    const studentsWithDetails = students.map(student => {
      const registrations = RegModel.find({ studentId: student._id });
      
      return {
        'Student ID': student._id,
        'Full Name': student.fullName,
        'Mobile Number': student.mobileNumber,
        'Email': student.email,
        'Date of Birth': student.dateOfBirth || '',
        'Gender': student.gender || '',
        'Registration Number': student.registrationNumber || '',
        'Qualification': student.qualification || '',
        'Organization': student.organization || '',
        'Experience': student.experience || '',
        'City': student.city || '',
        'State': student.state || '',
        'Total Workshops': student.totalWorkshops || 0,
        'Created At': student.createdAt
      };
    });
    
    const ws = XLSX.utils.json_to_sheet(studentsWithDetails);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Disposition', `attachment; filename=Students_${new Date().toISOString().split('T')[0]}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    console.error('Error exporting students:', error);
    res.status(500).json({ success: false, message: 'Error exporting students' });
  }
});

// ==================== AGENT MANAGEMENT ROUTES ====================

// Get all agents
router.get('/agents', isAdmin, async (req, res) => {
  try {
    const agents = Agent.find();
    // Remove password from response
    const agentsWithoutPassword = agents.map(({ password, ...agent }) => agent);
    res.json({ success: true, agents: agentsWithoutPassword });
  } catch (error) {
    console.error('Error fetching agents:', error);
    res.status(500).json({ success: false, message: 'Error fetching agents' });
  }
});

// Get agent by ID with statistics
router.get('/agents/:id', isAdmin, async (req, res) => {
  try {
    const agent = Agent.findById(req.params.id);
    if (!agent) {
      return res.status(404).json({ success: false, message: 'Agent not found' });
    }
    
    const { password, ...agentWithoutPassword } = agent;
    
    // Get agent's registration stats
    const { Registration: RegModel } = require('../localdb');
    const registrations = RegModel.find({ registeredBy: agent.username });
    
    res.json({
      success: true,
      agent: agentWithoutPassword,
      registrationCount: registrations.length
    });
  } catch (error) {
    console.error('Error fetching agent:', error);
    res.status(500).json({ success: false, message: 'Error fetching agent' });
  }
});

// Create new agent
router.post('/agents', isAdmin, async (req, res) => {
  try {
    const { username, password, fullName, email, mobileNumber } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }
    
    const newAgent = Agent.create({
      username,
      password, // In production, hash this
      fullName: fullName || username,
      email: email || null,
      mobileNumber: mobileNumber || null
    });
    
    const { password: pwd, ...agentWithoutPassword } = newAgent;
    
    res.json({ success: true, agent: agentWithoutPassword });
  } catch (error) {
    if (error.message === 'Username already exists') {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error('Error creating agent:', error);
    res.status(500).json({ success: false, message: 'Error creating agent' });
  }
});

// Update agent
router.put('/agents/:id', isAdmin, async (req, res) => {
  try {
    const { password, ...updates } = req.body;
    
    // If password is being updated, include it
    if (password) {
      updates.password = password; // In production, hash this
    }
    
    const updated = Agent.update(req.params.id, updates);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Agent not found' });
    }
    
    const { password: pwd, ...agentWithoutPassword } = updated;
    
    res.json({ success: true, agent: agentWithoutPassword });
  } catch (error) {
    console.error('Error updating agent:', error);
    res.status(500).json({ success: false, message: 'Error updating agent' });
  }
});

// Delete agent
router.delete('/agents/:id', isAdmin, async (req, res) => {
  try {
    Agent.deleteById(req.params.id);
    res.json({ success: true, message: 'Agent deleted successfully' });
  } catch (error) {
    console.error('Error deleting agent:', error);
    res.status(500).json({ success: false, message: 'Error deleting agent' });
  }
});

// Toggle agent status (active/inactive)
router.patch('/agents/:id/toggle-status', isAdmin, async (req, res) => {
  try {
    const agent = Agent.findById(req.params.id);
    if (!agent) {
      return res.status(404).json({ success: false, message: 'Agent not found' });
    }
    
    const updated = Agent.update(req.params.id, {
      status: agent.status === 'active' ? 'inactive' : 'active'
    });
    
    const { password, ...agentWithoutPassword } = updated;
    
    res.json({ success: true, agent: agentWithoutPassword });
  } catch (error) {
    console.error('Error toggling agent status:', error);
    res.status(500).json({ success: false, message: 'Error toggling agent status' });
  }
});

module.exports = router;
