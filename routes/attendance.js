const express = require('express');
const router = express.Router();

// Conditional database import
const useMySQL = process.env.USE_MYSQL === 'true';
let db;
if (useMySQL) {
  db = require('../database/mysql-db');
} else {
  db = require('../localdb');
}

// Attendance login endpoint
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Check attendance credentials
        const users = await db.User.find({});
        const user = users.find(u => 
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
        const { workshopId, identifier, timestamp } = req.body;
        
        // Build MNC Registration Number from identifier
        const searchIdentifier = identifier.trim().toUpperCase();
        
        // Create device fingerprint from multiple sources for better uniqueness
        const userAgent = req.headers['user-agent'] || '';
        const ipAddress = req.ip || req.connection.remoteAddress || '';
        const deviceFingerprint = `${userAgent}_${ipAddress}`;
        
        console.log('Attendance attempt:', { workshopId, searchIdentifier, deviceFingerprint });
        
        if (!workshopId || !searchIdentifier) {
            return res.json({
                success: false,
                message: 'Workshop ID and MNC Registration Number are required'
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
        
        // Verify student is registered - search by MNC registration number ONLY
        const allRegistrations = await db.Registration.find({});
        const registration = allRegistrations.find(reg => {
            if (reg.workshopId !== workshopId) return false;
            
            // Match by MNC Registration Number (exact match only)
            if (reg.mncRegistrationNumber) {
                const regNum = reg.mncRegistrationNumber.toUpperCase().trim();
                const searchNum = searchIdentifier;
                if (regNum === searchNum) return true;
            }
            
            return false;
        });
        
        if (!registration) {
            return res.json({
                success: false,
                message: 'No registration found for this MNC Registration Number in this workshop. Please check the registration number format (e.g., XII-12345)'
            });
        }
        
        // Check if attendance already marked for this student using mncUID
        const allAttendance = await db.Attendance.find({});
        const existingAttendance = allAttendance.find(att => 
            att.workshopId === workshopId && att.mncUID === registration.mncUID
        );
        
        if (existingAttendance) {
            return res.json({
                success: false,
                message: 'Attendance already marked for this student in this workshop'
            });
        }
        
        // NOTE: Device/IP check removed to allow multiple attendance from same device/IP
        // This allows multiple students to mark attendance from the same phone/device
        
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
        
        const allAttendances = await db.Attendance.find({});
        const attendances = allAttendances.filter(att => 
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
        
        const allAttendances = await db.Attendance.find({});
        const attendances = allAttendances.filter(att => 
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
        const attendances = await db.Attendance.find({});
        
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

// Manual attendance marking by admin (no device restriction)
router.post('/mark-manual', async (req, res) => {
    try {
        const { workshopId, mncRegistrationNumber } = req.body;
        
        console.log('Manual attendance marking:', { workshopId, mncRegistrationNumber });
        
        if (!workshopId || !mncRegistrationNumber) {
            return res.json({
                success: false,
                message: 'Workshop ID and MNC Registration Number are required'
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
        
        // Find registration by MNC Registration Number
        const allRegistrations = await db.Registration.find({});
        const registration = allRegistrations.find(reg => {
            if (reg.workshopId !== workshopId) return false;
            
            if (reg.mncRegistrationNumber) {
                const regNum = reg.mncRegistrationNumber.toUpperCase().trim();
                const searchNum = mncRegistrationNumber.toUpperCase().trim();
                if (regNum === searchNum) return true;
            }
            
            return false;
        });
        
        if (!registration) {
            return res.json({
                success: false,
                message: `No registration found for ${mncRegistrationNumber} in this workshop`
            });
        }
        
        // Check if attendance already marked
        const allAttendance = await db.Attendance.find({});
        const existingAttendance = allAttendance.find(att => 
            att.workshopId === workshopId && att.mncUID === registration.mncUID
        );
        
        if (existingAttendance) {
            return res.json({
                success: false,
                message: 'Attendance already marked for this student in this workshop'
            });
        }
        
        // Create attendance record (manual marking - no device fingerprint restrictions)
        const attendance = await db.Attendance.create({
            workshopId,
            mncUID: registration.mncUID,
            studentName: registration.fullName,
            registrationNumber: registration.mncRegistrationNumber,
            markedAt: new Date(),
            ipAddress: 'MANUAL_ADMIN',
            deviceFingerprint: `ADMIN_${req.session?.username || 'UNKNOWN'}_${Date.now()}`,
            userAgent: 'Manual Admin Entry',
            markedBy: req.session?.username || 'admin'
        });
        
        console.log('Manual attendance marked successfully:', attendance._id);
        
        res.json({
            success: true,
            message: 'Attendance marked successfully',
            data: attendance
        });
        
    } catch (error) {
        console.error('Manual mark attendance error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark attendance'
        });
    }
});

// Delete attendance record (admin only)
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const attendance = await db.Attendance.findById(id);
        if (!attendance) {
            return res.json({
                success: false,
                message: 'Attendance record not found'
            });
        }
        
        await db.Attendance.deleteById(id);
        
        console.log('Attendance deleted:', id);
        
        res.json({
            success: true,
            message: 'Attendance record deleted successfully'
        });
        
    } catch (error) {
        console.error('Delete attendance error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete attendance record'
        });
    }
});

module.exports = router;
