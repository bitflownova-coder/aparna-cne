const express = require('express');
const router = express.Router();
const Registration = require('../models/Registration');
const localdb = require('../localdb');

// Lookup MNC details by UID or Registration Number from Students database
router.post('/lookup', async (req, res) => {
  try {
    const { mncUID, mncRegistrationNumber } = req.body;
    
    if (!mncUID && !mncRegistrationNumber) {
      return res.status(400).json({
        success: false,
        message: 'Please provide MNC UID or MNC Registration Number'
      });
    }
    
    // Build query based on what's provided
    let query = {};
    if (mncUID) {
      query.mncUID = mncUID;
    }
    if (mncRegistrationNumber) {
      query.mncRegistrationNumber = mncRegistrationNumber;
    }
    
    // Search in students database first
    const students = localdb.readDatabase('students');
    let foundStudent = null;
    
    for (const student of students) {
      if ((mncUID && student.mncUID === mncUID) || 
          (mncRegistrationNumber && student.mncRegistrationNumber === mncRegistrationNumber)) {
        foundStudent = student;
        break;
      }
    }
    
    if (foundStudent) {
      // Return comprehensive student details for auto-fill
      return res.json({
        success: true,
        found: true,
        data: {
          fullName: foundStudent.fullName || '',
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
    const registrations = Registration.find(query);
    
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
