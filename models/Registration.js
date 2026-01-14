// Choose database based on environment
const useMySQL = process.env.USE_MYSQL === 'true';
let DB;
if (useMySQL) {
  DB = require('../database/mysql-db').Registration;
} else {
  DB = require('../localdb').Registration;
}

// Registration model wrapper - works with both MySQL and JSON
const Registration = {
  find: (query = {}) => DB.find(query),
  findOne: (query) => DB.findOne(query),
  findById: (id) => DB.findById(id),
  create: (data) => DB.create(data),
  findByIdAndUpdate: (id, updates) => DB.findByIdAndUpdate(id, updates),
  findByIdAndDelete: (id) => DB.findByIdAndDelete(id),
  countDocuments: (query = {}) => DB.countByWorkshop ? DB.countByWorkshop(query.workshopId) : 0,
  findByFormNumber: (formNumber) => DB.findByFormNumber(formNumber),
  findByMobile: (mobile) => DB.findByMobile(mobile),
  findByWorkshop: (workshopId) => DB.findByWorkshop(workshopId)
};

module.exports = Registration;
