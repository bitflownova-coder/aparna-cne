/**
 * Bulk Student Import Script
 * 
 * Usage: node seed-students.js <folder-path>
 * Example: node seed-students.js "D:\Excel Files"
 * 
 * Put all your Excel files (.xlsx) in a folder and run this script
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Database file
const STUDENTS_FILE = path.join(__dirname, 'database', 'students.json');
const COUNTER_FILE = path.join(__dirname, 'database', 'counters.json');

// Read existing data
function readData(filename) {
    try {
        if (!fs.existsSync(filename)) {
            return filename.includes('counters') ? {} : [];
        }
        const data = fs.readFileSync(filename, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading ${filename}:`, error.message);
        return filename.includes('counters') ? {} : [];
    }
}

// Write data
function writeData(filename, data) {
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
}

// Generate ID
function generateId(counters) {
    counters.studentId = (counters.studentId || 0) + 1;
    return counters.studentId;
}

// Main import function
async function importStudents(folderPath) {
    console.log('\n========================================');
    console.log('   BULK STUDENT IMPORT SCRIPT');
    console.log('========================================\n');

    // Check folder exists
    if (!fs.existsSync(folderPath)) {
        console.error(`❌ Folder not found: ${folderPath}`);
        process.exit(1);
    }

    // Get all Excel files
    const files = fs.readdirSync(folderPath).filter(f => 
        f.endsWith('.xlsx') || f.endsWith('.xls')
    );

    if (files.length === 0) {
        console.error('❌ No Excel files found in folder');
        process.exit(1);
    }

    console.log(`📁 Found ${files.length} Excel file(s)\n`);

    // Load existing data
    let students = readData(STUDENTS_FILE);
    let counters = readData(COUNTER_FILE);

    const existingUIDs = new Set(students.filter(s => s.mncUID).map(s => s.mncUID));
    const existingRegs = new Set(students.filter(s => s.mncRegistrationNumber).map(s => s.mncRegistrationNumber));
    const existingMobiles = new Set(students.filter(s => s.mobileNumber).map(s => s.mobileNumber));
    const existingEmails = new Set(students.filter(s => s.email).map(s => s.email.toLowerCase()));

    let totalImported = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    // Process each file
    for (const filename of files) {
        const filePath = path.join(folderPath, filename);
        console.log(`📊 Processing: ${filename}`);

        try {
            const workbook = XLSX.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(worksheet);

            let fileImported = 0;
            let fileSkipped = 0;
            let fileErrors = 0;

            for (const row of data) {
                try {
                    // Get column values (handle different possible column names)
                    const studentUniqueId = String(row['Student Unique ID'] || row['StudentUniqueID'] || row['student_unique_id'] || row['MNC UID'] || '').trim();
                    const registrationNumber = String(row['Registration Number'] || row['RegistrationNumber'] || row['registration_number'] || row['MNC Registration Number'] || '').trim();
                    const name = String(row['Name'] || row['name'] || row['Full Name'] || row['FullName'] || '').trim();
                    const mobile = String(row['Mobile No'] || row['MobileNo'] || row['mobile_no'] || row['Mobile'] || row['Phone'] || '').replace(/[^0-9]/g, '');
                    const email = String(row['Email'] || row['email'] || row['E-mail'] || '').trim().toLowerCase();

                    // Skip if no name or no identifier
                    if (!name || (!studentUniqueId && !registrationNumber && !mobile)) {
                        fileErrors++;
                        continue;
                    }

                    // Check for duplicates
                    if (studentUniqueId && existingUIDs.has(studentUniqueId)) {
                        fileSkipped++;
                        continue;
                    }
                    if (registrationNumber && existingRegs.has(registrationNumber)) {
                        fileSkipped++;
                        continue;
                    }
                    if (mobile && existingMobiles.has(mobile)) {
                        fileSkipped++;
                        continue;
                    }
                    if (email && existingEmails.has(email)) {
                        fileSkipped++;
                        continue;
                    }

                    // Parse MNC Registration Number format (e.g., "XLVI-361")
                    let mncRegPrefix = '';
                    let mncRegNumber = '';
                    if (registrationNumber && registrationNumber.includes('-')) {
                        const parts = registrationNumber.split('-');
                        mncRegPrefix = parts[0];
                        mncRegNumber = parts.slice(1).join('-');
                    } else {
                        mncRegNumber = registrationNumber;
                    }

                    // Create student
                    const newStudent = {
                        _id: 'STU' + String(generateId(counters)).padStart(6, '0'),
                        name: name,
                        mncUID: studentUniqueId || null,
                        mncRegistrationNumber: registrationNumber || null,
                        mncRegPrefix: mncRegPrefix || null,
                        mncRegNumber: mncRegNumber || null,
                        mobileNumber: mobile || null,
                        email: email || null,
                        totalWorkshops: 0,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };

                    students.push(newStudent);

                    // Add to sets to prevent duplicates within same import
                    if (studentUniqueId) existingUIDs.add(studentUniqueId);
                    if (registrationNumber) existingRegs.add(registrationNumber);
                    if (mobile) existingMobiles.add(mobile);
                    if (email) existingEmails.add(email);

                    fileImported++;
                } catch (rowError) {
                    fileErrors++;
                }
            }

            console.log(`   ✅ Imported: ${fileImported} | ⏭️ Skipped: ${fileSkipped} | ❌ Errors: ${fileErrors}`);

            totalImported += fileImported;
            totalSkipped += fileSkipped;
            totalErrors += fileErrors;

        } catch (fileError) {
            console.error(`   ❌ Error reading file: ${fileError.message}`);
            totalErrors++;
        }
    }

    // Save to database
    writeData(STUDENTS_FILE, students);
    writeData(COUNTER_FILE, counters);

    console.log('\n========================================');
    console.log('   IMPORT COMPLETE');
    console.log('========================================');
    console.log(`✅ Total Imported: ${totalImported}`);
    console.log(`⏭️ Total Skipped (duplicates): ${totalSkipped}`);
    console.log(`❌ Total Errors: ${totalErrors}`);
    console.log(`📊 Total Students in Database: ${students.length}`);
    console.log('========================================\n');
}

// Get folder path from command line
const folderPath = process.argv[2];

if (!folderPath) {
    console.log('\n❌ Please provide the folder path containing Excel files');
    console.log('\nUsage: node seed-students.js <folder-path>');
    console.log('Example: node seed-students.js "D:\\Excel Files"');
    console.log('Example: node seed-students.js "./student_data"');
    process.exit(1);
}

// Run import
importStudents(path.resolve(folderPath));
