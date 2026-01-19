const express = require('express');
const router = express.Router();
const Workshop = require('../models/Workshop');
const Registration = require('../models/Registration');
const { isAuthenticated } = require('../middleware/auth');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// Configure multer for QR code uploads
const qrStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads', 'qr-codes');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'qr-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: qrStorage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, JPG, PNG) are allowed!'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Admin Routes - All protected by authentication

// Get all workshops (with filters)
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const { status, startDate, endDate, search } = req.query;
    
    // Get all workshops
    let workshops = await Workshop.find({});
    
    // Apply user filters if provided
    if (status && status !== 'all') {
      workshops = workshops.filter(w => w.status === status);
    }
    
    if (startDate) {
      const start = new Date(startDate);
      workshops = workshops.filter(w => new Date(w.date) >= start);
    }
    
    if (endDate) {
      const end = new Date(endDate);
      workshops = workshops.filter(w => new Date(w.date) <= end);
    }
    
    if (search) {
      const searchLower = search.toLowerCase();
      workshops = workshops.filter(w => 
        w.title.toLowerCase().includes(searchLower) ||
        (w.description && w.description.toLowerCase().includes(searchLower))
      );
    }
    
    // Three-tier sorting: Active/Upcoming first, Full second, Completed last (latest date first in each tier)
    workshops.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      
      // Define status priority: active/upcoming (0) > full (1) > completed (2) > others (3)
      const getStatusPriority = (status) => {
        if (status === 'active' || status === 'upcoming') return 0;
        if (status === 'full') return 1;
        if (status === 'completed') return 2;
        return 3;
      };
      
      const priorityA = getStatusPriority(a.status);
      const priorityB = getStatusPriority(b.status);
      
      // If different priority, sort by priority
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      // Within same priority, sort by date (latest first)
      return dateB - dateA;
    });
    
    res.json({
      success: true,
      data: workshops
    });
    
  } catch (error) {
    console.error('Error fetching workshops:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching workshops'
    });
  }
});

// Get specific workshop
router.get('/:id', isAuthenticated, async (req, res) => {
  try {
    const workshop = await Workshop.findById(req.params.id);
    
    if (!workshop) {
      return res.status(404).json({
        success: false,
        message: 'Workshop not found'
      });
    }
    
    res.json({
      success: true,
      data: workshop
    });
    
  } catch (error) {
    console.error('Error fetching workshop:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching workshop'
    });
  }
});

// Create new workshop
router.post('/', isAuthenticated, upload.single('qrCodeImage'), async (req, res) => {
  try {
    // Validate required CNE/CPD Number
    if (!req.body.cneCpdNumber || req.body.cneCpdNumber.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'CNE/CPD Number is required. This will be used as prefix for form numbers (e.g., 1001-001, 1001-002)'
      });
    }
    
    const workshopData = {
      title: req.body.title,
      description: req.body.description || '',
      date: new Date(req.body.date),
      dayOfWeek: req.body.dayOfWeek,
      venue: req.body.venue,
      venueLink: req.body.venueLink || '',
      fee: parseFloat(req.body.fee) || 0,
      credits: parseInt(req.body.credits) || 0,
      cneCpdNumber: req.body.cneCpdNumber.trim(),
      maxSeats: parseInt(req.body.maxSeats) || 500,
      status: req.body.status || 'draft',
      registrationStartDate: req.body.registrationStartDate ? new Date(req.body.registrationStartDate) : null,
      registrationEndDate: req.body.registrationEndDate ? new Date(req.body.registrationEndDate) : null,
      createdBy: req.session.username || 'admin'
    };
    
    // Add QR code filename if uploaded
    if (req.file) {
      workshopData.qrCodeImage = req.file.filename;
    }
    
    // Multiple workshops can be active simultaneously
    
    const workshop = await Workshop.create(workshopData);
    
    res.json({
      success: true,
      message: 'Workshop created successfully',
      data: workshop
    });
    
  } catch (error) {
    console.error('Error creating workshop:', error);
    // Delete uploaded file if workshop creation failed
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      message: 'Error creating workshop: ' + error.message
    });
  }
});

// Update workshop
router.put('/:id', isAuthenticated, async (req, res) => {
  try {
    const workshop = await Workshop.findById(req.params.id);
    
    if (!workshop) {
      return res.status(404).json({
        success: false,
        message: 'Workshop not found'
      });
    }
    
    // Validate required CNE/CPD Number
    if (req.body.cneCpdNumber !== undefined && (!req.body.cneCpdNumber || req.body.cneCpdNumber.trim() === '')) {
      return res.status(400).json({
        success: false,
        message: 'CNE/CPD Number is required and cannot be empty. This is used as prefix for form numbers.'
      });
    }
    
    // Check if trying to reduce max seats below current registrations
    if (req.body.maxSeats && parseInt(req.body.maxSeats) < workshop.currentRegistrations) {
      return res.status(400).json({
        success: false,
        message: `Cannot reduce max seats below current registrations (${workshop.currentRegistrations})`
      });
    }
    
    // Multiple workshops can be active simultaneously
    
    // Build updates object
    const updates = {};
    const allowedUpdates = ['title', 'description', 'date', 'dayOfWeek', 'venue', 'venueLink', 
                           'fee', 'credits', 'cneCpdNumber', 'maxSeats', 'status', 'registrationStartDate', 'registrationEndDate'];
    
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === 'date' || field === 'registrationStartDate' || field === 'registrationEndDate') {
          updates[field] = req.body[field] ? new Date(req.body[field]).toISOString() : null;
        } else if (field === 'fee') {
          updates[field] = parseFloat(req.body[field]) || 0;
        } else if (field === 'credits' || field === 'maxSeats') {
          updates[field] = parseInt(req.body[field]) || 0;
        } else {
          updates[field] = req.body[field];
        }
      }
    });
    
    const updatedWorkshop = await Workshop.findByIdAndUpdate(req.params.id, updates);
    
    res.json({
      success: true,
      message: 'Workshop updated successfully',
      data: updatedWorkshop
    });
    
  } catch (error) {
    console.error('Error updating workshop:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating workshop: ' + error.message
    });
  }
});

// Upload or replace QR code
router.post('/:id/upload-qr', isAuthenticated, upload.single('qrCodeImage'), async (req, res) => {
  try {
    const workshop = await Workshop.findById(req.params.id);
    
    if (!workshop) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({
        success: false,
        message: 'Workshop not found'
      });
    }
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }
    
    // Delete old QR code if exists
    if (workshop.qrCodeImage) {
      const oldPath = path.join(__dirname, '..', 'uploads', 'qr-codes', workshop.qrCodeImage);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }
    
    // Update with new QR code
    const updatedWorkshop = await Workshop.findByIdAndUpdate(req.params.id, { qrCodeImage: req.file.filename });
    
    res.json({
      success: true,
      message: 'QR code uploaded successfully',
      qrCodeImage: updatedWorkshop.qrCodeImage
    });
    
  } catch (error) {
    console.error('Error uploading QR code:', error);
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({
      success: false,
      message: 'Error uploading QR code'
    });
  }
});

// Change workshop status
router.put('/:id/status', isAuthenticated, async (req, res) => {
  try {
    const { status } = req.body;
    const workshop = await Workshop.findById(req.params.id);
    
    if (!workshop) {
      return res.status(404).json({
        success: false,
        message: 'Workshop not found'
      });
    }
    
    // Multiple workshops can be active simultaneously
    
    const updatedWorkshop = await Workshop.findByIdAndUpdate(req.params.id, { status });
    
    res.json({
      success: true,
      message: 'Workshop status updated successfully',
      data: updatedWorkshop
    });
    
  } catch (error) {
    console.error('Error updating workshop status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating workshop status'
    });
  }
});

// Delete workshop
router.delete('/:id', isAuthenticated, async (req, res) => {
  try {
    const workshop = await Workshop.findById(req.params.id);
    
    if (!workshop) {
      return res.status(404).json({
        success: false,
        message: 'Workshop not found'
      });
    }
    
    // Check actual registration count
    const allRegistrations = await Registration.find({});
    const registrationCount = allRegistrations.filter(r => r.workshopId === req.params.id).length;
    
    console.log(`Workshop ${workshop._id} has ${registrationCount} registrations`);
    
    if (registrationCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete workshop. Found ${registrationCount} registration(s). Please delete all registrations first via the admin panel.`
      });
    }
    
    // Delete QR code file if exists
    if (workshop.qrCodeImage) {
      const qrPath = path.join(__dirname, '..', 'uploads', 'qr-codes', workshop.qrCodeImage);
      if (fs.existsSync(qrPath)) {
        fs.unlinkSync(qrPath);
      }
    }
    
    await Workshop.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: 'Workshop deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting workshop:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting workshop'
    });
  }
});

// Get registrations for a specific workshop
router.get('/:id/registrations', isAuthenticated, async (req, res) => {
  try {
    const { page = 1, limit = 50, search } = req.query;
    const workshopId = req.params.id;
    
    // Get all registrations for this workshop
    let allRegistrations = await Registration.find({});
    let registrations = allRegistrations.filter(r => r.workshopId === workshopId);
    
    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      registrations = registrations.filter(r =>
        r.fullName.toLowerCase().includes(searchLower) ||
        r.mncUID.toLowerCase().includes(searchLower) ||
        r.mncRegistrationNumber.toLowerCase().includes(searchLower) ||
        r.mobileNumber.includes(search) ||
        r.paymentUTR.toLowerCase().includes(searchLower)
      );
    }
    
    // Sort by submission date descending
    registrations.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
    
    // Pagination
    const total = registrations.length;
    const skip = (page - 1) * limit;
    const paginatedResults = registrations.slice(skip, skip + parseInt(limit));
    
    res.json({
      success: true,
      data: paginatedResults,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Error fetching workshop registrations:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching registrations'
    });
  }
});

// Export workshops to Excel
router.get('/export-excel', isAuthenticated, async (req, res) => {
  try {
    const { columns } = req.query;
    const selectedColumns = columns ? columns.split(',') : [];
    
    // Get all workshops with the same smart sorting
    let workshops = await Workshop.find({});
    
    // Apply smart sorting
    workshops.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      
      const getStatusPriority = (status) => {
        if (status === 'active') return 0;
        if (status === 'full') return 1;
        if (status === 'completed') return 2;
        return 3;
      };
      
      const priorityA = getStatusPriority(a.status);
      const priorityB = getStatusPriority(b.status);
      
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      return dateB - dateA;
    });
    
    // Column mapping
    const columnMapping = {
      'title': 'Workshop Title',
      'date': 'Workshop Date',
      'dayOfWeek': 'Day',
      'venue': 'Venue',
      'venueLink': 'Venue Link',
      'fee': 'Fee',
      'credits': 'Credits',
      'cneCpdNumber': 'CNE/CPD Number',
      'maxSeats': 'Max Seats',
      'currentRegistrations': 'Current Registrations',
      'seatsRemaining': 'Seats Remaining',
      'status': 'Status',
      'registrationStartDate': 'Registration Start Date',
      'registrationEndDate': 'Registration End Date',
      'createdBy': 'Created By',
      'createdAt': 'Created At'
    };
    
    // Prepare data
    const data = workshops.map((workshop, index) => {
      const row = { 'S.No': index + 1 };
      
      const columnsToInclude = selectedColumns.length > 0 ? selectedColumns : Object.keys(columnMapping);
      
      columnsToInclude.forEach(col => {
        const header = columnMapping[col] || col;
        let value = workshop[col];
        
        // Format dates
        if ((col === 'date' || col === 'registrationStartDate' || col === 'registrationEndDate' || col === 'createdAt') && value) {
          value = new Date(value).toLocaleDateString('en-IN');
        }
        
        // Calculate seats remaining
        if (col === 'seatsRemaining') {
          value = Math.max(0, (workshop.maxSeats || 0) - (workshop.currentRegistrations || 0));
        }
        
        row[header] = value || '';
      });
      
      return row;
    });
    
    // Create workbook
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data);
    
    // Set column widths
    const colWidths = [
      { wch: 8 },  // S.No
      { wch: 30 }, // Title
      { wch: 15 }, // Date
      { wch: 12 }, // Day
      { wch: 30 }, // Venue
      { wch: 15 }, // Fee
      { wch: 10 }, // Credits
      { wch: 15 }, // CNE/CPD Number
      { wch: 12 }, // Max Seats
      { wch: 20 }, // Current Registrations
      { wch: 15 }, // Status
    ];
    worksheet['!cols'] = colWidths;
    
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Workshops');
    
    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    // Set headers
    res.setHeader('Content-Disposition', `attachment; filename=workshops-${new Date().toISOString().split('T')[0]}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    
    res.send(buffer);
    
  } catch (error) {
    console.error('Error exporting workshops to Excel:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting to Excel'
    });
  }
});

module.exports = router;
