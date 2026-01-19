// Quick script to check workshop statuses
const db = require('./database/mysql-db');

async function checkWorkshops() {
    try {
        const workshops = await db.Workshop.getAll();
        console.log('\n=== Workshop Statuses ===');
        workshops.forEach(w => {
            console.log(`${w.title} | Status: "${w.status}" | Date: ${w.date}`);
        });
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

checkWorkshops();
