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

// Agent Login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Username and password are required' });
        }

        const isValid = await verifyAgentCredentials(username, password);

        if (isValid) {
            req.session.isAgent = true;
            req.session.agentUsername = username;
            return res.json({ success: true, message: 'Login successful' });
        } else {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    } catch (error) {
        console.error('Agent login error:', error);
        res.status(500).json({ success: false, message: 'Login failed' });
    }
});

// Check Session
router.get('/check-session', (req, res) => {
    if (req.session && req.session.isAgent) {
        return res.json({ authenticated: true, username: req.session.agentUsername });
    }
    res.json({ authenticated: false });
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
        const allRegistrations = Registration.find();
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
                    dateOfBirth: latestRegistration.dateOfBirth,
                    gender: latestRegistration.gender,
                    registrationNumber: latestRegistration.registrationNumber,
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

        // Validate required fields
        if (!registrationData.workshopId || !registrationData.fullName || 
            !registrationData.mobileNumber || !registrationData.email || 
            !registrationData.utrNumber) {
            return res.status(400).json({ 
                success: false, 
                message: 'Missing required fields: workshopId, fullName, mobileNumber, email, utrNumber' 
            });
        }

        // Validate workshop exists
        const workshop = Workshop.findById(registrationData.workshopId);
        if (!workshop) {
            return res.status(404).json({ success: false, message: 'Workshop not found' });
        }

        // Check for duplicate: same mobile + same workshop
        const existingRegistrations = Registration.find();
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
                    updatedBy: 'agent',
                    agentUsername: req.session.agentUsername,
                    paymentVerified: true,
                    paymentMethod: 'Offline - Agent Verified',
                    transactionId: registrationData.utrNumber
                };
                
                const updated = Registration.update(duplicate._id, updatedData);
                
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
        let student = Student.findByMobile(registrationData.mobileNumber);
        if (!student) {
            student = Student.create({
                fullName: registrationData.fullName,
                mobileNumber: registrationData.mobileNumber,
                email: registrationData.email,
                dateOfBirth: registrationData.dateOfBirth,
                gender: registrationData.gender,
                registrationNumber: registrationData.registrationNumber,
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
            Student.update(student._id, {
                fullName: registrationData.fullName,
                email: registrationData.email,
                dateOfBirth: registrationData.dateOfBirth,
                gender: registrationData.gender,
                registrationNumber: registrationData.registrationNumber,
                qualification: registrationData.qualification,
                organization: registrationData.organization,
                experience: registrationData.experience,
                address: registrationData.address,
                city: registrationData.city,
                state: registrationData.state,
                pinCode: registrationData.pinCode
            });
        }

        // Create new registration
        const newRegistration = {
            ...registrationData,
            studentId: student._id,
            submittedAt: new Date().toISOString(),
            submittedBy: 'agent',
            registeredBy: req.session.agentUsername,
            agentUsername: req.session.agentUsername,
            registrationSource: 'Agent',
            paymentVerified: true,
            paymentMethod: 'Offline - Agent Verified',
            transactionId: registrationData.utrNumber,
            status: 'confirmed'
        };

        const created = Registration.create(newRegistration);
        
        // Increment student workshop count
        Student.incrementWorkshopCount(student._id);

        res.json({
            success: true,
            message: 'Registration created successfully',
            registrationId: created._id,
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
        'registrationNumber', 'qualification', 'organization', 'experience',
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
        const workshops = Workshop.find();
        
        // Create workbook
        const workbook = XLSX.utils.book_new();
        
        // Template sheet with headers
        const templateHeaders = [
            'workshopId', 'fullName', 'mobileNumber', 'email', 'utrNumber',
            'dateOfBirth', 'gender', 'registrationNumber', 'qualification',
            'organization', 'experience', 'address', 'city', 'state', 'pinCode'
        ];
        
        const templateData = [templateHeaders];
        
        // Add sample row
        templateData.push([
            workshops.length > 0 ? workshops[0]._id : 'WORKSHOP_ID',
            'John Doe',
            '9876543210',
            'john@example.com',
            'UTR123456789012',
            '1990-01-15',
            'Male',
            'NC12345',
            'B.Sc Nursing',
            'City Hospital',
            '5',
            '123 Main Street',
            'Mumbai',
            'Maharashtra',
            '400001'
        ]);
        
        const templateSheet = XLSX.utils.aoa_to_sheet(templateData);
        
        // Set column widths
        templateSheet['!cols'] = [
            { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 25 }, { wch: 18 },
            { wch: 12 }, { wch: 10 }, { wch: 15 }, { wch: 15 },
            { wch: 20 }, { wch: 12 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 10 }
        ];
        
        XLSX.utils.book_append_sheet(workbook, templateSheet, 'Registration Template');
        
        // Workshops reference sheet
        const workshopHeaders = ['Workshop ID', 'Title', 'Date', 'Location'];
        const workshopData = [workshopHeaders];
        
        workshops.forEach(w => {
            workshopData.push([w._id, w.title, w.date, w.location]);
        });
        
        const workshopSheet = XLSX.utils.aoa_to_sheet(workshopData);
        workshopSheet['!cols'] = [{ wch: 15 }, { wch: 40 }, { wch: 15 }, { wch: 25 }];
        XLSX.utils.book_append_sheet(workbook, workshopSheet, 'Workshop Reference');
        
        // Instructions sheet
        const instructions = [
            ['CNE Bulk Registration Template - Instructions'],
            [''],
            ['REQUIRED FIELDS (Must be filled):'],
            ['1. workshopId - Copy exact ID from "Workshop Reference" sheet'],
            ['2. fullName - Full name of the participant'],
            ['3. mobileNumber - 10-digit mobile number (without country code)'],
            ['4. email - Valid email address'],
            ['5. utrNumber - Payment UTR/Transaction reference number'],
            [''],
            ['OPTIONAL FIELDS:'],
            ['- dateOfBirth (Format: YYYY-MM-DD, e.g., 1990-01-15)'],
            ['- gender (Male/Female/Other)'],
            ['- registrationNumber - Nursing council registration'],
            ['- qualification - Education qualification'],
            ['- organization - Current organization'],
            ['- experience - Years of experience (number only)'],
            ['- address, city, state, pinCode - Address details'],
            [''],
            ['IMPORTANT NOTES:'],
            ['- Maximum 500 registrations per upload'],
            ['- Duplicate detection: Same mobile + same workshop = duplicate'],
            ['- If duplicate found with different data, existing record will be updated'],
            ['- UTR numbers should be unique for each transaction'],
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

        // Read Excel file
        const workbook = XLSX.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);

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
                // Validate required fields
                if (!row.workshopId || !row.fullName || !row.mobileNumber || 
                    !row.email || !row.utrNumber) {
                    failed++;
                    results.push({
                        row: rowNumber,
                        fullName: row.fullName || 'N/A',
                        mobileNumber: row.mobileNumber || 'N/A',
                        workshopTitle: 'N/A',
                        status: 'error',
                        message: 'Missing required fields'
                    });
                    continue;
                }

                // Validate workshop
                const workshop = Workshop.findById(row.workshopId);
                if (!workshop) {
                    failed++;
                    results.push({
                        row: rowNumber,
                        fullName: row.fullName,
                        mobileNumber: row.mobileNumber,
                        workshopTitle: 'N/A',
                        status: 'error',
                        message: 'Invalid workshop ID'
                    });
                    continue;
                }

                // Check for duplicate
                const existingRegistrations = Registration.find();
                const duplicate = existingRegistrations.find(reg => 
                    reg.mobileNumber === String(row.mobileNumber) && 
                    reg.workshopId === row.workshopId
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
                            updatedBy: 'agent_bulk',
                            agentUsername: req.session.agentUsername,
                            paymentVerified: true,
                            paymentMethod: 'Offline - Agent Bulk Upload',
                            transactionId: row.utrNumber
                        };
                        
                        Registration.update(duplicate._id, updatedData);
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
                    let student = Student.findByMobile(String(row.mobileNumber));
                    if (!student) {
                        student = Student.create({
                            fullName: row.fullName,
                            mobileNumber: String(row.mobileNumber),
                            email: row.email,
                            dateOfBirth: row.dateOfBirth || null,
                            gender: row.gender || null,
                            registrationNumber: row.registrationNumber || null,
                            qualification: row.qualification || null,
                            organization: row.organization || null,
                            experience: row.experience ? parseInt(row.experience) : null,
                            address: row.address || null,
                            city: row.city || null,
                            state: row.state || null,
                            pinCode: row.pinCode || null
                        });
                    } else {
                        // Update student info
                        Student.update(student._id, {
                            fullName: row.fullName,
                            email: row.email,
                            dateOfBirth: row.dateOfBirth || null,
                            gender: row.gender || null,
                            registrationNumber: row.registrationNumber || null,
                            qualification: row.qualification || null,
                            organization: row.organization || null,
                            experience: row.experience ? parseInt(row.experience) : null,
                            address: row.address || null,
                            city: row.city || null,
                            state: row.state || null,
                            pinCode: row.pinCode || null
                        });
                    }
                    
                    // Create new registration
                    const newRegistration = {
                        workshopId: row.workshopId,
                        studentId: student._id,
                        fullName: row.fullName,
                        mobileNumber: String(row.mobileNumber),
                        email: row.email,
                        dateOfBirth: row.dateOfBirth || null,
                        gender: row.gender || null,
                        registrationNumber: row.registrationNumber || null,
                        qualification: row.qualification || null,
                        organization: row.organization || null,
                        experience: row.experience ? parseInt(row.experience) : null,
                        address: row.address || null,
                        city: row.city || null,
                        state: row.state || null,
                        pinCode: row.pinCode || null,
                        submittedAt: new Date().toISOString(),
                        submittedBy: 'agent_bulk',
                        registeredBy: req.session.agentUsername,
                        agentUsername: req.session.agentUsername,
                        registrationSource: 'Agent',
                        paymentVerified: true,
                        paymentMethod: 'Offline - Agent Bulk Upload',
                        transactionId: row.utrNumber,
                        status: 'confirmed'
                    };

                    Registration.create(newRegistration);
                    
                    // Increment student workshop count
                    Student.incrementWorkshopCount(student._id);
                    
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
