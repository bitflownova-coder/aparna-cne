/**
 * Cleanup utility for old files
 * Deletes payment screenshots for workshops that ended more than 1 month ago
 */

const fs = require('fs');
const path = require('path');

// Conditional database import
const useMySQL = process.env.USE_MYSQL === 'true';

async function cleanupOldPaymentScreenshots() {
  console.log('Starting cleanup of old payment screenshots...');
  
  try {
    let Workshop, Registration;
    
    if (useMySQL) {
      const mysqlDb = require('../database/mysql-db');
      Workshop = mysqlDb.Workshop;
      Registration = mysqlDb.Registration;
    } else {
      const localDb = require('../localdb');
      Workshop = localDb.Workshop;
      Registration = localDb.Registration;
    }
    
    // Get all workshops
    const workshops = await Workshop.find({});
    
    // Find workshops that ended more than 1 month ago
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    const oldWorkshops = workshops.filter(w => {
      const workshopDate = new Date(w.date);
      return workshopDate < oneMonthAgo;
    });
    
    if (oldWorkshops.length === 0) {
      console.log('No old workshops found for cleanup.');
      return { deleted: 0, errors: 0 };
    }
    
    console.log(`Found ${oldWorkshops.length} workshops older than 1 month.`);
    
    // Get workshopIds
    const oldWorkshopIds = oldWorkshops.map(w => w._id);
    
    // Get registrations for these workshops
    const allRegistrations = await Registration.find({});
    const oldRegistrations = allRegistrations.filter(r => 
      oldWorkshopIds.includes(r.workshopId) && r.paymentScreenshot
    );
    
    console.log(`Found ${oldRegistrations.length} registrations with payment screenshots to clean.`);
    
    let deletedCount = 0;
    let errorCount = 0;
    
    const uploadsPath = path.join(__dirname, '..', 'uploads', 'payments');
    
    for (const reg of oldRegistrations) {
      if (reg.paymentScreenshot) {
        const filePath = path.join(uploadsPath, reg.paymentScreenshot);
        
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            deletedCount++;
            console.log(`Deleted: ${reg.paymentScreenshot}`);
          }
        } catch (err) {
          console.error(`Error deleting ${reg.paymentScreenshot}:`, err.message);
          errorCount++;
        }
      }
    }
    
    console.log(`Cleanup complete. Deleted: ${deletedCount}, Errors: ${errorCount}`);
    return { deleted: deletedCount, errors: errorCount };
    
  } catch (error) {
    console.error('Cleanup error:', error);
    return { deleted: 0, errors: 1, message: error.message };
  }
}

// Clean up orphaned files (files not linked to any registration)
async function cleanupOrphanedFiles() {
  console.log('Starting cleanup of orphaned payment files...');
  
  try {
    let Registration;
    
    if (useMySQL) {
      Registration = require('../database/mysql-db').Registration;
    } else {
      Registration = require('../localdb').Registration;
    }
    
    const uploadsPath = path.join(__dirname, '..', 'uploads', 'payments');
    
    // Get all files in uploads/payments
    if (!fs.existsSync(uploadsPath)) {
      console.log('Uploads directory does not exist.');
      return { deleted: 0, errors: 0 };
    }
    
    const files = fs.readdirSync(uploadsPath);
    
    if (files.length === 0) {
      console.log('No files in uploads directory.');
      return { deleted: 0, errors: 0 };
    }
    
    // Get all registered payment screenshots
    const registrations = await Registration.find({});
    const registeredFiles = new Set(
      registrations
        .filter(r => r.paymentScreenshot)
        .map(r => r.paymentScreenshot)
    );
    
    let deletedCount = 0;
    let errorCount = 0;
    
    for (const file of files) {
      // Skip if file is registered
      if (registeredFiles.has(file)) continue;
      
      // Check file age - only delete if older than 7 days (orphaned uploads)
      const filePath = path.join(uploadsPath, file);
      try {
        const stats = fs.statSync(filePath);
        const fileAge = Date.now() - stats.mtimeMs;
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        
        if (fileAge > sevenDays) {
          fs.unlinkSync(filePath);
          deletedCount++;
          console.log(`Deleted orphaned file: ${file}`);
        }
      } catch (err) {
        console.error(`Error processing ${file}:`, err.message);
        errorCount++;
      }
    }
    
    console.log(`Orphan cleanup complete. Deleted: ${deletedCount}, Errors: ${errorCount}`);
    return { deleted: deletedCount, errors: errorCount };
    
  } catch (error) {
    console.error('Orphan cleanup error:', error);
    return { deleted: 0, errors: 1, message: error.message };
  }
}

// Run all cleanup tasks
async function runAllCleanup() {
  console.log('=== STARTING SCHEDULED CLEANUP ===');
  console.log('Time:', new Date().toISOString());
  
  const results = {
    oldScreenshots: await cleanupOldPaymentScreenshots(),
    orphanedFiles: await cleanupOrphanedFiles()
  };
  
  console.log('=== CLEANUP COMPLETE ===');
  console.log('Results:', JSON.stringify(results, null, 2));
  
  return results;
}

module.exports = {
  cleanupOldPaymentScreenshots,
  cleanupOrphanedFiles,
  runAllCleanup
};
