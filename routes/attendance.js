const express = require('express');
const router = express.Router();
const db = require('../localdb');

// Attendance login endpoint
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Check attendance credentials
        const user = db.User.find({}).find(u => 
            u.username === username && u.role === 'attendance'
        );
        
        if (!user || user.password !== password) {
            return res.json({
                success: false,
                message: 'Invalid username or password'
            });
        }
        
        // Set session
        req.session.attendanceUser = {
            id: user._id,
            username: user.username,
            role: user.role
        };
        
        res.json({
            success: true,
            message: 'Login successful',
            user: {
                username: user.username,
                role: user.role
            }
        });
        
    } catch (error) {
        console.error('Attendance login error:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed'
        });
    }
});

// Check session endpoint
router.get('/check-session', (req, res) => {
    if (req.session && req.session.attendanceUser) {
        res.json({
            success: true,
            user: req.session.attendanceUser
        });
    } else {
        res.status(401).json({
            success: false,
            message: 'Not authenticated'
        });
    }
});

// Logout endpoint
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Session destroy error:', err);
        }
        res.json({ success: true, message: 'Logged out successfully' });
    });
});

// Middleware to check attendance auth
function requireAttendanceAuth(req, res, next) {
    if (req.session && req.session.attendanceUser) {
        next();
    } else {
        res.status(401).json({
            success: false,
            message: 'Unauthorized. Please login first.'
        });
    }
}

// Mark attendance
router.post('/mark', async (req, res) => {
    try {
        const { workshopId, identifier, timestamp } = req.body; // identifier can be mobile or MNC reg number
        
        // Create device fingerprint from multiple sources for better uniqueness
        const userAgent = req.headers['user-agent'] || '';
        const ipAddress = req.ip || req.connection.remoteAddress || '';
        const deviceFingerprint = `${userAgent}_${ipAddress}`;
        
        console.log('Attendance attempt:', { workshopId, identifier, deviceFingerprint });
        
        if (!workshopId || !identifier) {
            return res.json({
                success: false,
                message: 'Workshop ID and Mobile Number/MNC Registration Number are required'
            });
        }
        
        // Verify workshop exists
        const workshop = await db.Workshop.findById(workshopId);
        if (!workshop) {
            return res.json({
                success: false,
                message: 'Workshop not found'
            });
        }
        
        // Verify student is registered - search by mobile number or MNC registration number
        const registration = db.Registration.find({}).find(reg => 
            (reg.mobileNumber === identifier || reg.mncRegistrationNumber === identifier) && 
            reg.workshopId === workshopId
        );
        
        if (!registration) {
            return res.json({
                success: false,
                message: 'No registration found for this Mobile Number/MNC Registration Number in this workshop'
            });
        }
        
        // Check if attendance already marked for this student using mncUID
        const existingAttendance = db.Attendance.find({}).find(att => 
            att.workshopId === workshopId && att.mncUID === registration.mncUID
        );
        
        if (existingAttendance) {
            return res.json({
                success: false,
                message: 'Attendance already marked for this student in this workshop'
            });
        }
        
        // STRICT CHECK: Block if this device/phone has already marked attendance for ANY student in this workshop
        const allAttendance = db.Attendance.find({});
        const deviceAlreadyUsed = allAttendance.some(att => 
            att.workshopId === workshopId && 
            att.deviceFingerprint && 
            att.deviceFingerprint === deviceFingerprint
        );
        
        if (deviceAlreadyUsed) {
            console.log('Device already used for this workshop:', deviceFingerprint);
            return res.json({
                success: false,
                message: 'This device has already been used to mark attendance in this workshop. Each device can only mark ONE attendance.'
            });
        }
        
        // Create attendance record with device fingerprint
        const attendance = await db.Attendance.create({
            workshopId,
            mncUID: registration.mncUID,
            studentName: registration.fullName,
            registrationNumber: registration.mncRegistrationNumber,
            markedAt: new Date(timestamp || Date.now()),
            ipAddress: ipAddress,
            deviceFingerprint: deviceFingerprint,
            userAgent: userAgent
        });
        
        console.log('Attendance marked successfully:', attendance._id);
        
        res.json({
            success: true,
            message: 'Attendance marked successfully',
            data: attendance
        });
        
    } catch (error) {
        console.error('Mark attendance error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark attendance'
        });
    }
});

// Get attendance for a workshop
router.get('/workshop/:workshopId', async (req, res) => {
    try {
        const { workshopId } = req.params;
        
        const attendances = db.Attendance.find({}).filter(att => 
            att.workshopId === workshopId
        );
        
        res.json({
            success: true,
            data: attendances,
            count: attendances.length
        });
        
    } catch (error) {
        console.error('Get attendance error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch attendance'
        });
    }
});

// Get attendance for a student
router.get('/student/:mncUID', async (req, res) => {
    try {
        const { mncUID } = req.params;
        
        const attendances = db.Attendance.find({}).filter(att => 
            att.mncUID === mncUID
        );
        
        res.json({
            success: true,
            data: attendances,
            count: attendances.length
        });
        
    } catch (error) {
        console.error('Get student attendance error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch attendance'
        });
    }
});

// Get all attendance (admin)
router.get('/all', async (req, res) => {
    try {
        const attendances = db.Attendance.find({});
        
        res.json({
            success: true,
            data: attendances,
            count: attendances.length
        });
        
    } catch (error) {
        console.error('Get all attendance error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch attendance'
        });
    }
});

module.exports = router;
