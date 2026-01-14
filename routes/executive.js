const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const { verifyAgentCredentials, isAgent } = require('../middleware/auth');

// Conditional database import
const useMySQL = process.env.USE_MYSQL === 'true';
let Registration, Workshop, Student, Agent;
if (useMySQL) {
  const mysqlDb = require('../database/mysql-db');
  Registration = mysqlDb.Registration;
  Workshop = mysqlDb.Workshop;
  Student = mysqlDb.Student;
  Agent = mysqlDb.Agent;
} else {
  const localDb = require('../localdb');
  Registration = localDb.Registration;
  Workshop = localDb.Workshop;
  Student = localDb.Student;
  Agent = localDb.Agent;
}

// Multer configuration for Excel upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads/bulk');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, `bulk_${Date.now()}_${file.originalname}`);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext === '.xlsx' || ext === '.xls') {
            cb(null, true);
        } else {
            cb(new Error('Only Excel files are allowed'));
        }
    },
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// executive Login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Username and password are required' });
        }

        const isValid = await verifyAgentCredentials(username, password);

        if (isValid) {
            req.session.isAgent = true;
            req.session.executiveUsername = username;
            return res.json({ success: true, message: 'Login successful' });
        } else {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    } catch (error) {
        console.error('executive login error:', error);
        res.status(500).json({ success: false, message: 'Login failed' });
    }
});

// Check Session
router.get('/check-session', (req, res) => {
    if (req.session && req.session.isAgent) {
        return res.json({ authenticated: true, username: req.session.executiveUsername });
    }
    res.json({ authenticated: false });
});

// Get My Registrations (registrations done by this executive)
router.get('/my-registrations', isAgent, async (req, res) => {
    try {
        const executiveUsername = req.session.executiveUsername;
        
        // Get all registrations and filter by executiveUsername
        const allRegistrations = await Registration.find();
        const myRegistrations = allRegistrations.filter(reg => 
            reg.executiveUsername === executiveUsername || 
            reg.registeredBy === executiveUsername
        );
        
        // Sort by date (newest first)
        myRegistrations.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        res.json({
            success: true,
            count: myRegistrations.length,
            data: myRegistrations
        });
    } catch (error) {
        console.error('Error fetching executive registrations:', error);
        res.status(500).json({ success: false, message: 'Error fetching registrations' });
    }
});

// Logout
router.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Check Existing User (for autofill)
router.get('/check-user', isAgent, async (req, res) => {
    try {
        const { mobile, email } = req.query;

        if (!mobile && !email) {
            return res.status(400).json({ exists: false, message: 'Mobile or email required' });
        }

        // Find all registrations for this user
        const allRegistrations = await Registration.find();
        const userRegistrations = allRegistrations.filter(reg => {
            if (mobile && reg.mobileNumber === mobile) return true;
            if (email && reg.email && reg.email.toLowerCase() === email.toLowerCase()) return true;
            return false;
        });

        if (userRegistrations.length > 0) {
            // Get the most recent registration data
            const latestRegistration = userRegistrations.sort((a, b) => 
                new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0)
            )[0];

            return res.json({
                exists: true,
                registrationCount: userRegistrations.length,
                userData: {
                    fullName: latestRegistration.fullName,
                    mobileNumber: latestRegistration.mobileNumber,
                    email: latestRegistration.email,
                    mncUID: latestRegistration.mncUID,
                    mncRegistrationNumber: latestRegistration.mncRegistrationNumber,
                    dateOfBirth: latestRegistration.dateOfBirth,
                    gender: latestRegistration.gender,
                    qualification: latestRegistration.qualification,
                    organization: latestRegistration.organization,
                    experience: latestRegistration.experience,
                    address: latestRegistration.address,
                    city: latestRegistration.city,
                    state: latestRegistration.state,
                    pinCode: latestRegistration.pinCode
                }
            });
        }

        res.json({ exists: false, message: 'No existing user found' });
    } catch (error) {
        console.error('Check user error:', error);
        res.status(500).json({ exists: false, message: 'Error checking user' });
    }
});

// Individual Registration with Duplicate Detection
router.post('/register-individual', isAgent, async (req, res) => {
    try {
        const registrationData = req.body;

        // Validate required fields (email is optional)
        if (!registrationData.workshopId || !registrationData.fullName || 
            !registrationData.mobileNumber ||
            !registrationData.mncUID || !registrationData.mncRegistrationNumber) {
            return res.status(400).json({ 
                success: false, 
                message: 'Missing required fields: workshopId, fullName, mobileNumber, mncUID, mncRegistrationNumber' 
            });
        }

        // Validate workshop exists
        const workshop = await Workshop.findById(registrationData.workshopId);
        if (!workshop) {
            return res.status(404).json({ success: false, message: 'Workshop not found' });
        }

        // Check if UTR number already exists (must be unique across all registrations)
        if (registrationData.utrNumber && registrationData.utrNumber.trim() !== '' && registrationData.utrNumber.trim().toUpperCase() !== 'N/A') {
            const allRegsForUTR = await Registration.find();
            const utrExists = allRegsForUTR.find(reg => 
                (reg.paymentUTR && reg.paymentUTR.trim().toLowerCase() === registrationData.utrNumber.trim().toLowerCase()) ||
                (reg.transactionId && reg.transactionId.trim().toLowerCase() === registrationData.utrNumber.trim().toLowerCase())
            );
            if (utrExists) {
                return res.status(400).json({
                    success: false,
                    message: 'This UTR/Transaction number has already been used for another registration'
                });
            }
        }

        // Check for duplicate: same mobile + same workshop
        const existingRegistrations = await Registration.find();
        const duplicate = existingRegistrations.find(reg => 
            reg.mobileNumber === registrationData.mobileNumber && 
            reg.workshopId === registrationData.workshopId
        );

        if (duplicate) {
            // Check if data has changed
            const dataChanged = checkIfDataChanged(duplicate, registrationData);
            
            if (dataChanged) {
                // Update existing registration with new data
                const updatedData = {
                    ...duplicate,
                    ...registrationData,
                    updatedAt: new Date().toISOString(),
                    updatedBy: 'executive',
                    executiveUsername: req.session.executiveUsername,
                    paymentVerified: true,
                    paymentMethod: 'Offline - Executive Verified',
                    transactionId: registrationData.utrNumber || duplicate.transactionId || 'N/A'
                };
                
                const updated = await Registration.update(duplicate._id, updatedData);
                
                return res.json({
                    success: true,
                    message: 'Registration updated with new details',
                    registrationId: updated._id,
                    action: 'updated'
                });
            } else {
                return res.status(400).json({
                    success: false,
                    message: 'Duplicate registration found with same details. No changes made.',
                    registrationId: duplicate._id,
                    action: 'duplicate'
                });
            }
        }

        // Create or update student record
        let student = await Student.findByMobile(registrationData.mobileNumber);
        if (!student) {
            student = await Student.create({
                name: registrationData.fullName,
                fullName: registrationData.fullName,
                mobileNumber: registrationData.mobileNumber,
                email: registrationData.email,
                dateOfBirth: registrationData.dateOfBirth,
                gender: registrationData.gender,
                qualification: registrationData.qualification,
                organization: registrationData.organization,
                experience: registrationData.experience,
                address: registrationData.address,
                city: registrationData.city,
                state: registrationData.state,
                pinCode: registrationData.pinCode
            });
        } else {
            // Update student info
            await Student.update(student._id, {
                fullName: registrationData.fullName,
                email: registrationData.email,
                dateOfBirth: registrationData.dateOfBirth,
                gender: registrationData.gender,
                qualification: registrationData.qualification,
                organization: registrationData.organization,
                experience: registrationData.experience,
                address: registrationData.address,
                city: registrationData.city,
                state: registrationData.state,
                pinCode: registrationData.pinCode
            });
        }

        // Generate form number for this workshop
        const formNumber = await Registration.getNextFormNumber(registrationData.workshopId);

        // Create new registration
        const newRegistration = {
            ...registrationData,
            formNumber: formNumber,
            studentId: student._id,
            submittedAt: new Date().toISOString(),
            submittedBy: 'executive',
            registeredBy: req.session.executiveUsername,
            executiveUsername: req.session.executiveUsername,
            registrationSource: 'executive',
            paymentVerified: true,
            paymentMethod: 'Offline - Executive Verified',
            transactionId: registrationData.utrNumber || 'N/A',
            status: 'confirmed'
        };

        const created = await Registration.create(newRegistration);
        
        // Increment student workshop count
        await Student.incrementWorkshopCount(student._id);

        res.json({
            success: true,
            message: 'Registration created successfully',
            registrationId: created._id,
            formNumber: formNumber,
            action: 'created'
        });

    } catch (error) {
        console.error('Individual registration error:', error);
        res.status(500).json({ success: false, message: 'Registration failed' });
    }
});

// Helper function to check if data has changed
function checkIfDataChanged(existing, newData) {
    const fieldsToCheck = ['fullName', 'email', 'dateOfBirth', 'gender', 
        'qualification', 'organization', 'experience',
        'address', 'city', 'state', 'pinCode', 'utrNumber'];
    
    for (const field of fieldsToCheck) {
        if (existing[field] !== newData[field]) {
            return true;
        }
    }
    return false;
}

// Download Excel Template
router.get('/download-template', isAgent, async (req, res) => {
    try {
        // Get active workshops for reference
        const workshops = await Workshop.find();
        
        // Create workbook
        const workbook = XLSX.utils.book_new();
        
        // Template sheet with headers (no workshopId - selected separately)
        const templateHeaders = [
            'fullName', 'mobileNumber', 'email', 'mncUID', 'mncRegistrationNumber',
            'dateOfBirth', 'gender', 'qualification',
            'organization', 'address', 'city', 'state', 'pinCode'
        ];
        
        const templateData = [templateHeaders];
        
        // Add sample row
        templateData.push([
            'John Doe',
            '9876543210',
            'john@example.com',
            'MNC001',
            'XVI-5581',
            '1990-01-15',
            'Male',
            'B.Sc Nursing',
            'City Hospital',
            '123 Main Street',
            'Mumbai',
            'Maharashtra',
            '400001'
        ]);
        
        const templateSheet = XLSX.utils.aoa_to_sheet(templateData);
        
        // Format mncUID column (column D, index 3) as text to preserve leading zeros
        // Get the range of cells
        const range = XLSX.utils.decode_range(templateSheet['!ref']);
        for (let row = 1; row <= range.e.r; row++) {
            const cellAddress = XLSX.utils.encode_cell({ r: row, c: 3 }); // Column D (mncUID)
            if (templateSheet[cellAddress]) {
                templateSheet[cellAddress].t = 's'; // Set type to string
                templateSheet[cellAddress].z = '@'; // Format as text
            }
        }
        
        // Set column widths
        templateSheet['!cols'] = [
            { wch: 20 }, { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 18 },
            { wch: 12 }, { wch: 10 }, { wch: 15 },
            { wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 10 }
        ];
        
        XLSX.utils.book_append_sheet(workbook, templateSheet, 'Registration Template');
        
        // Instructions sheet (no workshop reference needed)
        const instructions = [
            ['CNE Bulk Registration Template - Instructions'],
            [''],
            ['NOTE: Select the workshop from the dropdown on the upload page.'],
            ['All participants in this file will be registered to that workshop.'],
            [''],
            ['REQUIRED FIELDS (Must be filled):'],
            ['1. fullName - Full name of the participant'],
            ['2. mobileNumber - 10-digit mobile number (without country code)'],
            ['3. mncUID - MNC UID number (e.g., MNC001 or 0123456)'],
            ['   NOTE: If mncUID starts with 0, format the column as TEXT in Excel'],
            ['4. mncRegistrationNumber - MNC Registration Number (e.g., XVI-5581)'],
            [''],
            ['OPTIONAL FIELDS:'],
            ['- email - Email address (optional)'],
            ['- dateOfBirth (Format: YYYY-MM-DD, e.g., 1990-01-15)'],
            ['- gender (Male/Female/Other)'],
            ['- qualification - Education qualification'],
            ['- organization - Current organization'],
            ['- address, city, state, pinCode - Address details'],
            [''],
            ['IMPORTANT NOTES:'],
            ['- Maximum 500 registrations per upload'],
            ['- Duplicate detection: Same mobile + same workshop = duplicate'],
            ['- Delete the sample row before uploading your data'],
            [''],
            ['SUPPORT:'],
            ['For assistance, contact admin or refer to the user manual']
        ];
        
        const instructionSheet = XLSX.utils.aoa_to_sheet(instructions);
        instructionSheet['!cols'] = [{ wch: 80 }];
        XLSX.utils.book_append_sheet(workbook, instructionSheet, 'Instructions');
        
        // Generate Excel file
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        
        res.setHeader('Content-Disposition', 'attachment; filename=CNE_Bulk_Registration_Template.xlsx');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
        
    } catch (error) {
        console.error('Template download error:', error);
        res.status(500).json({ success: false, message: 'Error generating template' });
    }
});

// Bulk Upload Processing
router.post('/bulk-upload', isAgent, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        // Get workshopId from form data
        const workshopId = req.body.workshopId;
        if (!workshopId) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ success: false, message: 'Please select a workshop' });
        }

        // Validate workshop exists
        const workshop = await Workshop.findById(workshopId);
        if (!workshop) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ success: false, message: 'Invalid workshop selected' });
        }

        // Read Excel file with raw option to preserve values like leading zeros
        const workbook = XLSX.readFile(req.file.path, { raw: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: '' });

        // Validate row count
        if (data.length === 0) {
            fs.unlinkSync(req.file.path); // Clean up
            return res.status(400).json({ success: false, message: 'Excel file is empty' });
        }

        if (data.length > 500) {
            fs.unlinkSync(req.file.path); // Clean up
            return res.status(400).json({ success: false, message: 'Maximum 500 registrations allowed per upload' });
        }

        // Process each row
        const results = [];
        let successful = 0;
        let failed = 0;
        let duplicates = 0;

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const rowNumber = i + 2; // Excel row number (header is row 1)

            try {
                // Validate required fields (workshopId comes from form, not row) - email is optional
                if (!row.fullName || !row.mobileNumber || 
                    !row.mncUID || !row.mncRegistrationNumber) {
                    failed++;
                    results.push({
                        row: rowNumber,
                        fullName: row.fullName || 'N/A',
                        mobileNumber: row.mobileNumber || 'N/A',
                        workshopTitle: workshop.title,
                        status: 'error',
                        message: 'Missing required fields (fullName, mobileNumber, mncUID, mncRegistrationNumber)'
                    });
                    continue;
                }

                // Check if UTR number already exists (must be unique)
                if (row.utrNumber && row.utrNumber.toString().trim() !== '' && row.utrNumber.toString().trim().toUpperCase() !== 'N/A') {
                    const allRegsForUTR = await Registration.find();
                    const utrExists = allRegsForUTR.find(reg => 
                        (reg.paymentUTR && reg.paymentUTR.trim().toLowerCase() === row.utrNumber.toString().trim().toLowerCase()) ||
                        (reg.transactionId && reg.transactionId.trim().toLowerCase() === row.utrNumber.toString().trim().toLowerCase())
                    );
                    if (utrExists) {
                        failed++;
                        results.push({
                            row: rowNumber,
                            fullName: row.fullName,
                            mobileNumber: row.mobileNumber,
                            workshopTitle: workshop.title,
                            status: 'error',
                            message: 'UTR number already used in another registration'
                        });
                        continue;
                    }
                }

                // Check for duplicate (using workshop from form)
                const existingRegistrations = await Registration.find();
                const duplicate = existingRegistrations.find(reg => 
                    reg.mobileNumber === String(row.mobileNumber) && 
                    reg.workshopId === workshopId
                );

                if (duplicate) {
                    // Check if data changed
                    const dataChanged = checkIfDataChanged(duplicate, row);
                    
                    if (dataChanged) {
                        // Update existing
                        const updatedData = {
                            ...duplicate,
                            ...row,
                            updatedAt: new Date().toISOString(),
                            updatedBy: 'executive_bulk',
                            executiveUsername: req.session.executiveUsername,
                            paymentVerified: true,
                            paymentMethod: 'Offline - Executive Bulk Upload',
                            transactionId: row.utrNumber || duplicate.transactionId || 'N/A'
                        };
                        
                        await Registration.update(duplicate._id, updatedData);
                        successful++;
                        
                        results.push({
                            row: rowNumber,
                            fullName: row.fullName,
                            mobileNumber: row.mobileNumber,
                            workshopTitle: workshop.title,
                            status: 'success',
                            message: 'Updated existing registration'
                        });
                    } else {
                        duplicates++;
                        results.push({
                            row: rowNumber,
                            fullName: row.fullName,
                            mobileNumber: row.mobileNumber,
                            workshopTitle: workshop.title,
                            status: 'warning',
                            message: 'Duplicate - no changes needed'
                        });
                    }
                } else {
                    // Create or update student record
                    let student = await Student.findByMobile(String(row.mobileNumber));
                    if (!student) {
                        student = await Student.create({
                            name: row.fullName,
                            fullName: row.fullName,
                            mobileNumber: String(row.mobileNumber),
                            email: row.email,
                            dateOfBirth: row.dateOfBirth || null,
                            gender: row.gender || null,
                            qualification: row.qualification || null,
                            organization: row.organization || null,
                            address: row.address || null,
                            city: row.city || null,
                            state: row.state || null,
                            pinCode: row.pinCode || null
                        });
                    } else {
                        // Update student info
                        await Student.update(student._id, {
                            fullName: row.fullName,
                            email: row.email,
                            dateOfBirth: row.dateOfBirth || null,
                            gender: row.gender || null,
                            qualification: row.qualification || null,
                            organization: row.organization || null,
                            address: row.address || null,
                            city: row.city || null,
                            state: row.state || null,
                            pinCode: row.pinCode || null
                        });
                    }
                    
                    // Generate form number for this workshop
                    const formNumber = await Registration.getNextFormNumber(workshopId);
                    
                    // Create new registration
                    const newRegistration = {
                        workshopId: workshopId,
                        studentId: student._id,
                        formNumber: formNumber,
                        fullName: row.fullName,
                        mobileNumber: String(row.mobileNumber),
                        email: row.email,
                        mncUID: String(row.mncUID || '').trim(),
                        mncRegistrationNumber: String(row.mncRegistrationNumber || '').trim(),
                        dateOfBirth: row.dateOfBirth || null,
                        gender: row.gender || null,
                        qualification: row.qualification || null,
                        organization: row.organization || null,
                        address: row.address || null,
                        city: row.city || null,
                        state: row.state || null,
                        pinCode: row.pinCode || null,
                        submittedAt: new Date().toISOString(),
                        submittedBy: 'executive_bulk',
                        registeredBy: req.session.executiveUsername,
                        executiveUsername: req.session.executiveUsername,
                        registrationSource: 'executive',
                        paymentVerified: true,
                        paymentMethod: 'Offline - Executive Bulk Upload',
                        transactionId: row.utrNumber || 'N/A',
                        status: 'confirmed'
                    };

                    await Registration.create(newRegistration);
                    
                    // Increment student workshop count
                    await Student.incrementWorkshopCount(student._id);
                    
                    successful++;

                    results.push({
                        row: rowNumber,
                        fullName: row.fullName,
                        mobileNumber: row.mobileNumber,
                        workshopTitle: workshop.title,
                        status: 'success',
                        message: 'Successfully registered'
                    });
                }

            } catch (rowError) {
                console.error(`Error processing row ${rowNumber}:`, rowError);
                failed++;
                results.push({
                    row: rowNumber,
                    fullName: row.fullName || 'N/A',
                    mobileNumber: row.mobileNumber || 'N/A',
                    workshopTitle: 'N/A',
                    status: 'error',
                    message: rowError.message || 'Processing error'
                });
            }
        }

        // Clean up uploaded file
        fs.unlinkSync(req.file.path);

        // Return results
        res.json({
            success: true,
            message: 'Bulk upload processed',
            data: {
                total: data.length,
                successful,
                duplicates,
                failed,
                results
            }
        });

    } catch (error) {
        console.error('Bulk upload error:', error);
        
        // Clean up file if exists
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({ success: false, message: 'Bulk upload processing failed' });
    }
});

module.exports = router;
