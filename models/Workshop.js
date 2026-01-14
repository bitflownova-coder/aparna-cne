const { Workshop: DB } = require('../localdb');

// Workshop model wrapper for local database
const Workshop = {
  find: (query = {}) => DB.find(query),
  findOne: (query) => DB.findOne(query),
  findById: (id) => DB.findById(id),
  create: (data) => DB.create(data),
  findByIdAndUpdate: (id, updates) => DB.updateById(id, updates),
  findByIdAndDelete: (id) => DB.deleteById(id),
  
  // Static methods
  getActiveWorkshop: () => DB.getActiveWorkshop(),
  getUpcomingWorkshops: () => DB.getUpcomingWorkshops(),
  getLatestWorkshop: () => DB.getLatestWorkshop()
};

// Helper to add methods to workshop objects
function addMethods(workshop) {
  if (!workshop) return null;
  
  return {
    ...workshop,
    seatsRemaining: workshop.maxSeats - (workshop.currentRegistrations || 0),
    incrementRegistrationCount: async function() {
      return addMethods(DB.incrementRegistrationCount(this._id));
    },
    markAsFull: async function() {
      return addMethods(DB.updateById(this._id, { status: 'full' }));
    },
    markCompleted: async function() {
      return addMethods(DB.updateById(this._id, { status: 'completed' }));
    },
    canAcceptRegistrations: function() {
      return this.status === 'active' && this.currentRegistrations < this.maxSeats;
    }
  };
}

// Wrap methods
const WrappedWorkshop = {
  ...Workshop,
  findOne: (query) => addMethods(DB.findOne(query)),
  findById: (id) => addMethods(DB.findById(id)),
  create: (data) => addMethods(DB.create(data)),
  getActiveWorkshop: () => addMethods(DB.getActiveWorkshop()),
  getLatestWorkshop: () => addMethods(DB.getLatestWorkshop()),
  getUpcomingWorkshops: () => {
    const workshops = DB.getUpcomingWorkshops();
    return workshops.map(w => addMethods(w));
  },
  find: (query = {}) => {
    const workshops = DB.find(query);
    return workshops.map(w => addMethods(w));
  }
};

module.exports = WrappedWorkshop;
