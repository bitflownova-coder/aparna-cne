// Choose database based on environment
const useMySQL = process.env.USE_MYSQL === 'true';
let DB;
if (useMySQL) {
  DB = require('../database/mysql-db').User;
} else {
  DB = require('../localdb').User;
}

// User model wrapper - works with both MySQL and JSON
const User = {
  find: (query = {}) => DB.find(query),
  findOne: (query) => DB.findOne(query),
  findById: (id) => DB.findById(id),
  create: (data) => DB.create(data),
  findByIdAndUpdate: (id, updates) => DB.findByIdAndUpdate(id, updates),
  findByIdAndDelete: (id) => DB.findByIdAndDelete(id)
};

module.exports = User;
