const { User: DB } = require('../localdb');

// User model wrapper for local database
const User = {
  find: (query = {}) => DB.find(query),
  findOne: (query) => DB.findOne(query),
  findById: (id) => DB.findById(id),
  create: (data) => DB.create(data),
  findByIdAndUpdate: (id, updates) => DB.updateById(id, updates),
  findByIdAndDelete: (id) => DB.deleteById(id),
  countDocuments: (query = {}) => DB.countDocuments(query)
};

module.exports = User;
