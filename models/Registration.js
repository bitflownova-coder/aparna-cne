const mongoose = require('mongoose');
const { Registration: DB } = require('../localdb');

// Registration model wrapper for local database
const Registration = {
  find: (query = {}) => DB.find(query),
  findOne: (query) => DB.findOne(query),
  findById: (id) => DB.findById(id),
  create: (data) => DB.create(data),
  findByIdAndUpdate: (id, updates) => DB.updateById(id, updates),
  findByIdAndDelete: (id) => DB.deleteById(id),
  countDocuments: (query = {}) => DB.countDocuments(query),

  // Static methods
  getNextFormNumber: (workshopId = null) => DB.getNextFormNumber(workshopId),
  getRegistrationCount: (workshopId = null) => DB.countDocuments(workshopId ? { workshopId } : {}),
  isRegistrationFull: (workshopId = null) => DB.isRegistrationFull(workshopId)
};

// Helper to add methods to registration objects
function addMethods(reg) {
  if (!reg) return null;

  return {
    ...reg,
    canDownload: reg.downloadCount < 2,
    incrementDownload: async function() {
      if (this.downloadCount >= 2) {
        throw new Error('Download limit reached');
      }
      const updated = DB.updateById(this._id, { downloadCount: this.downloadCount + 1 });
      return addMethods(updated);
    }
  };
}

// Wrap methods
const WrappedRegistration = {
  ...Registration,
  findOne: (query) => addMethods(DB.findOne(query)),
  findById: (id) => addMethods(DB.findById(id)),
  create: (data) => addMethods(DB.create(data))
};

module.exports = WrappedRegistration;
