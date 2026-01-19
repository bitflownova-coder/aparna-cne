const express = require('express');
const router = express.Router();
const Registration = require('../models/Registration');

// Conditional database import
const useMySQL = process.env.USE_MYSQL === 'true';
let Student;
if (useMySQL) {
  Student = require('../database/mysql-db').Student;
} else {
  Student = require('../localdb').Student;
}

// Lookup MNC details by UID or Registration Number from Students database
router.post('/lookup', async (req, res) => {
  try {
    const { mncUID, mncRegistrationNumber } = req.body;
    
    console.log('MNC Lookup request:', { mncUID, mncRegistrationNumber });
    
    if (!mncUID && !mncRegistrationNumber) {
      return res.status(400).json({
        success: false,
        message: 'Please provide MNC UID or MNC Registration Number'
      });
    }
    
    // Search in students database
    let foundStudent = null;
    if (mncUID) {
      foundStudent = await Student.findByMncUID(mncUID);
      console.log('Search by mncUID result:', foundStudent ? 'Found' : 'Not found');
    }
    if (!foundStudent && mncRegistrationNumber) {
      foundStudent = await Student.findByMncRegistrationNumber(mncRegistrationNumber);
      console.log('Search by mncRegistrationNumber result:', foundStudent ? 'Found' : 'Not found');
    }
    
    if (foundStudent) {
      // Return comprehensive student details for auto-fill
      return res.json({
        success: true,
        found: true,
        data: {
          fullName: foundStudent.fullName || foundStudent.name || '',
          mncUID: foundStudent.mncUID || '',
          mncRegistrationNumber: foundStudent.mncRegistrationNumber || '',
          mobileNumber: foundStudent.mobileNumber || '',
          email: foundStudent.email || '',
          dateOfBirth: foundStudent.dateOfBirth || '',
          gender: foundStudent.gender || '',
          qualification: foundStudent.qualification || '',
          organization: foundStudent.organization || '',
          experience: foundStudent.experience || '',
          address: foundStudent.address || '',
          city: foundStudent.city || '',
          state: foundStudent.state || '',
          pinCode: foundStudent.pinCode || ''
        }
      });
    }
    
    // Fallback: search in registrations if not found in students
    let query = {};
    if (mncUID) query.mncUID = mncUID;
    if (mncRegistrationNumber) query.mncRegistrationNumber = mncRegistrationNumber;
    
    const registrations = await Registration.find(query);
    
    if (registrations.length === 0) {
      return res.json({
        success: false,
        found: false,
        message: 'No previous registration found'
      });
    }
    
    // Get the most recent registration
    const latestReg = registrations.sort((a, b) => 
      new Date(b.submittedAt) - new Date(a.submittedAt)
    )[0];
    
    // Return basic details from registration (fallback)
    res.json({
      success: true,
      found: true,
      data: {
        fullName: latestReg.fullName || '',
        mncUID: latestReg.mncUID || '',
        mncRegistrationNumber: latestReg.mncRegistrationNumber || '',
        mobileNumber: latestReg.mobileNumber || '',
        address: latestReg.address || '',
        email: '',
        dateOfBirth: '',
        gender: '',
        qualification: '',
        organization: '',
        experience: '',
        city: '',
        state: '',
        pinCode: ''
      }
    });
  } catch (error) {
    console.error('MNC lookup error:', error);
    res.status(500).json({
      success: false,
      message: 'Error looking up MNC details'
    });
  }
});

module.exports = router;
