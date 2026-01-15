// Temporary script to check database - uses server's existing DB config
process.env.USE_MYSQL = 'true';
process.env.DB_HOST = '127.0.0.1';
process.env.DB_USER = 'u984810592_aparna';
process.env.DB_PASSWORD = 'sCARFACE@2003?.';
process.env.DB_NAME = 'u984810592_aparna_cne';

const db = require('./database/mysql-db');

async function checkDB() {
  console.log('\n========== DATABASE CHECK ==========\n');

  // Total registrations
  const registrations = await db.Registration.find();
  console.log('Total Registrations:', registrations.length);

  // Per workshop
  const workshopCounts = {};
  registrations.forEach(r => {
    workshopCounts[r.workshopId] = (workshopCounts[r.workshopId] || 0) + 1;
  });
  console.log('\nRegistrations per Workshop:');
  Object.entries(workshopCounts).forEach(([wid, count]) => {
    console.log('  ' + wid + ': ' + count);
  });

  // Check audit_logs
  try {
    const auditLogs = await db.AuditLog.find();
    console.log('\nAudit Logs (total ' + auditLogs.length + '):');
    if (auditLogs.length === 0) {
      console.log('  No audit logs found');
    } else {
      auditLogs.slice(0, 30).forEach(log => {
        console.log('  [' + log.createdAt + '] ' + log.action + ' by ' + log.performedBy + ': ' + log.details);
      });
    }
  } catch (e) {
    console.log('\nAudit logs error:', e.message);
  }

  // Check workshops
  const workshops = await db.Workshop.find();
  console.log('\nWorkshops:');
  workshops.forEach(w => {
    console.log('  ' + w._id + ' - ' + w.title + ': ' + w.currentRegistrations + '/' + w.maxSeats + ' (' + w.status + ')');
  });

  // Recent registrations
  const sorted = registrations.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  console.log('\nRecent 10 Registrations:');
  sorted.slice(0, 10).forEach(r => {
    console.log('  ' + r.formNumber + ' - ' + r.fullName + ' (' + r.workshopId + ') at ' + r.submittedAt);
  });

  // Oldest registrations
  console.log('\nOldest 10 Registrations:');
  sorted.slice(-10).reverse().forEach(r => {
    console.log('  ' + r.formNumber + ' - ' + r.fullName + ' (' + r.workshopId + ') at ' + r.submittedAt);
  });

  process.exit(0);
}

checkDB().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
