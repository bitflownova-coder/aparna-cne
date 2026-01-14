const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Registration = require('../models/Registration');
const Workshop = require('../models/Workshop');

// Conditional database import
const useMySQL = process.env.USE_MYSQL === 'true';
let Student;
if (useMySQL) {
  Student = require('../database/mysql-db').Student;
} else {
  Student = require('../localdb').Student;
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/payments/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'payment-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Accept only images
  const allowedTypes = /jpeg|jpg|png/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, JPG, PNG) are allowed!'));
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: fileFilter
});

// Get registration count and remaining slots
router.get('/count', async (req, res) => {
  try {
    const { workshopId } = req.query;
    
    if (workshopId) {
      // Get count for specific workshop
      const workshop = await Workshop.findById(workshopId);
      if (!workshop) {
        return res.status(404).json({
          success: false,
          message: 'Workshop not found'
        });
      }
      
      const count = await Registration.getRegistrationCount(workshopId);
      const remaining = Math.max(0, workshop.maxSeats - count);
      
      res.json({
        success: true,
        total: count,
        remaining: remaining,
        isFull: count >= workshop.maxSeats,
        maxRegistrations: workshop.maxSeats
      });
    } else {
      // Get count for all registrations (legacy support)
      const count = await Registration.getRegistrationCount();
      const remaining = Math.max(0, 500 - count);
      const isFull = await Registration.isRegistrationFull();
      
      res.json({
        success: true,
        total: count,
        remaining: remaining,
        isFull: isFull,
        maxRegistrations: 500
      });
    }
  } catch (error) {
    console.error('Error fetching registration count:', error);
    res.status(500).json({ success: false, message: 'Error fetching registration count' });
  }
});

// Submit new registration
router.post('/submit', upload.single('paymentScreenshot'), async (req, res) => {
  try {
    // Get workshopId from request body
    const { workshopId } = req.body;
    
    if (!workshopId) {
      return res.status(400).json({
        success: false,
        message: 'Workshop ID is required'
      });
    }

    // Validate workshop exists
    const workshop = await Workshop.findById(workshopId);
    if (!workshop) {
      return res.status(404).json({
        success: false,
        message: 'Workshop not found'
      });
    }

    // Check if workshop is active and accepting registrations
    if (workshop.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: `Registration is not available. Workshop status: ${workshop.status}`
      });
    }

    // Check if workshop is full
    if (workshop.currentRegistrations >= workshop.maxSeats) {
      return res.status(400).json({
        success: false,
        message: 'Registration closed. All seats are filled.'
      });
    }

    // Get next form number for this workshop
    const formNumber = await Registration.getNextFormNumber(workshopId);

    // Validate required fields
    const { fullName, mncUID, mncRegistrationNumber, mobileNumber, address, paymentUTR,
            email, dateOfBirth, gender, qualification, organization, 
            experience, city, state, pinCode } = req.body;

    // Check each field and return specific error
    const requiredFields = {
      fullName, mncUID, mncRegistrationNumber, mobileNumber, address, paymentUTR,
      email, dateOfBirth, gender, qualification, organization, experience, city, state, pinCode
    };
    
    const missingFields = Object.entries(requiredFields)
      .filter(([key, value]) => !value || value === '')
      .map(([key]) => key);
    
    if (missingFields.length > 0) {
      console.log('Missing fields:', missingFields);
      console.log('Received body:', req.body);
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Payment screenshot is required'
      });
    }

    // Check if MNC UID already exists for this workshop
    const existingRegistration = await Registration.findOne({ 
      mncUID: mncUID.trim(),
      workshopId: workshopId
    });
    if (existingRegistration) {
      return res.status(400).json({
        success: false,
        message: 'This MNC UID is already registered for this workshop'
      });
    }

    // Get IP address for tracking
    const ipAddress = req.ip || req.connection.remoteAddress;

    // Create or update student record with all comprehensive fields
    let student = await Student.findByMobile(mobileNumber.trim());
    if (!student) {
      student = await Student.create({
        name: fullName.trim(),
        fullName: fullName.trim(),
        mobileNumber: mobileNumber.trim(),
        email: email.trim(),
        dateOfBirth: dateOfBirth,
        gender: gender,
        qualification: qualification.trim(),
        organization: organization.trim(),
        experience: experience,
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        pinCode: pinCode.trim(),
        mncUID: mncUID.trim(),
        mncRegistrationNumber: mncRegistrationNumber.trim()
      });
    } else {
      // Update student info with all fields
      await Student.update(student._id, {
        fullName: fullName.trim(),
        email: email.trim(),
        dateOfBirth: dateOfBirth,
        gender: gender,
        qualification: qualification.trim(),
        organization: organization.trim(),
        experience: experience,
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        pinCode: pinCode.trim(),
        mncUID: mncUID.trim(),
        mncRegistrationNumber: mncRegistrationNumber.trim()
      });
    }

    // Create new registration
    const registration = await Registration.create({
      workshopId: workshopId,
      formNumber: formNumber,
      fullName: fullName.trim(),
      mncUID: mncUID.trim(),
      mncRegistrationNumber: mncRegistrationNumber.trim(),
      mobileNumber: mobileNumber.trim(),
      address: address.trim(),
      paymentUTR: paymentUTR.trim(),
      paymentScreenshot: req.file.filename,
      ipAddress: ipAddress,
      studentId: student._id,
      registrationSource: 'Website',
      submittedBy: 'website'
    });

    // Increment student workshop count
    await Student.incrementWorkshopCount(student._id);

    // Increment workshop registration count (auto-marks as full if needed)
    await Workshop.incrementRegistrationCount(workshopId);

    res.status(201).json({
      success: true,
      message: 'Registration submitted successfully',
      data: {
        formNumber: registration.formNumber,
        mncUID: registration.mncUID,
        mobileNumber: registration.mobileNumber,
        fullName: registration.fullName,
        submittedAt: registration.submittedAt,
        workshop: {
          title: workshop.title,
          date: workshop.date
        }
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'This MNC UID is already registered'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error submitting registration: ' + error.message
    });
  }
});

// View registration by MNC UID and Mobile Number
router.post('/view', async (req, res) => {
  try {
    const { mncUID, mobileNumber, workshopId } = req.body;

    if (!mncUID || !mobileNumber) {
      return res.status(400).json({
        success: false,
        message: 'MNC UID and Mobile Number are required'
      });
    }

    // Build query - optionally filter by workshop
    const query = {
      mncUID: mncUID.trim(),
      mobileNumber: mobileNumber.trim()
    };
    
    if (workshopId) {
      query.workshopId = workshopId;
    }

    // Find ALL registrations for this user, sorted by newest first
    const registrations = await Registration.find(query);
    const sortedRegistrations = registrations.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

    if (!sortedRegistrations || sortedRegistrations.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No registration found with these details'
      });
    }

    // Populate workshop details for each registration
    const data = await Promise.all(sortedRegistrations.map(async registration => {
      const workshop = await Workshop.findById(registration.workshopId);
      return {
        formNumber: registration.formNumber,
        fullName: registration.fullName,
        mncUID: registration.mncUID,
        mncRegistrationNumber: registration.mncRegistrationNumber,
        mobileNumber: registration.mobileNumber,
        address: registration.address || '',
        paymentUTR: registration.paymentUTR,
        paymentScreenshot: registration.paymentScreenshot,
        submittedAt: registration.submittedAt,
        downloadCount: registration.downloadCount,
        canDownload: registration.downloadCount < 2,
        workshop: workshop ? {
          title: workshop.title,
          date: workshop.date,
          venue: workshop.venue
        } : null
      };
    }));

    res.json({
      success: true,
      data: data,
      count: data.length
    });

  } catch (error) {
    console.error('Error retrieving registration:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving registration'
    });
  }
});

// Increment download count
router.post('/download', async (req, res) => {
  try {
    const { mncUID, mobileNumber } = req.body;

    if (!mncUID || !mobileNumber) {
      return res.status(400).json({
        success: false,
        message: 'MNC UID and Mobile Number are required'
      });
    }

    const registration = await Registration.findOne({
      mncUID: mncUID.trim(),
      mobileNumber: mobileNumber.trim()
    });

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'No registration found'
      });
    }

    if (registration.downloadCount >= 2) {
      return res.status(400).json({
        success: false,
        message: 'Download limit reached. You have already downloaded 2 times.'
      });
    }

    await registration.incrementDownload();

    res.json({
      success: true,
      message: 'Download count incremented',
      downloadCount: registration.downloadCount
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Delete registration by ID (public endpoint)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const registration = await Registration.findById(id);
    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    // Store workshopId before deletion
    const workshopId = registration.workshopId;

    // Delete associated payment screenshot if exists
    const fs = require('fs');
    if (registration.paymentScreenshot) {
      const filePath = path.join(__dirname, '..', 'uploads', 'payments', registration.paymentScreenshot);
      if (fs.existsSync(filePath)) {
        fs.unlink(filePath, () => {});
      }
    }

    // Delete the registration
    await Registration.deleteById(id);

    // Decrement workshop registration count if applicable
    if (workshopId) {
      const workshop = await Workshop.findById(workshopId);
      if (workshop && workshop.currentRegistrations > 0) {
        await Workshop.updateById(workshopId, {
          currentRegistrations: workshop.currentRegistrations - 1
        });
      }
    }

    res.json({
      success: true,
      message: 'Registration deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting registration:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting registration'
    });
  }
});

// Helper to determine next form number with cap
async function getNextFormNumber() {
  const next = await Registration.getNextFormNumber();
  if (next > 500) {
    throw new Error('Registration closed. All 500 seats are filled.');
  }
  return next;
}

module.exports = router;
