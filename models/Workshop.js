// Choose database based on environment
const useMySQL = process.env.USE_MYSQL === 'true';
let DB;
if (useMySQL) {
  DB = require('../database/mysql-db').Workshop;
} else {
  DB = require('../localdb').Workshop;
}

// Workshop model wrapper - works with both MySQL and JSON
const Workshop = {
  find: (query = {}) => DB.find(query),
  findOne: (query) => DB.findOne(query),
  findById: (id) => DB.findById(id),
  create: (data) => DB.create(data),
  findByIdAndUpdate: (id, updates) => DB.findByIdAndUpdate(id, updates),
  findByIdAndDelete: (id) => DB.findByIdAndDelete(id),
  
  // Static methods
  getActiveWorkshop: () => DB.getActiveWorkshop(),
  getActiveWorkshops: () => DB.getActiveWorkshops(),
  getUpcomingWorkshops: () => DB.getUpcomingWorkshops(),
  getLatestWorkshop: () => DB.getLatestWorkshop(),
  incrementRegistrationCount: (id) => DB.incrementRegistrationCount(id),
  decrementRegistrationCount: (id) => DB.decrementRegistrationCount ? DB.decrementRegistrationCount(id) : null,
  
  // Alias methods
  update: (id, updates) => DB.update ? DB.update(id, updates) : DB.findByIdAndUpdate(id, updates),
  deleteById: (id) => DB.deleteById ? DB.deleteById(id) : DB.findByIdAndDelete(id)
};

module.exports = Workshop;
