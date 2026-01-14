const bcrypt = require('bcrypt');
const User = require('../models/User');
const { Agent } = require('../localdb');

// Middleware to check if user is authenticated as admin or user
const isAuthenticated = (req, res, next) => {
  if (req.session && (req.session.isAdmin || req.session.userId)) {
    return next();
  }
  return res.status(401).json({ success: false, message: 'Unauthorized access' });
};

// Middleware to check if user is admin only
const isAdmin = (req, res, next) => {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  return res.status(401).json({ success: false, message: 'Admin access required' });
};

// Middleware to check if user is agent
const isAgent = (req, res, next) => {
  if (req.session && req.session.isAgent) {
    return next();
  }
  return res.status(401).json({ success: false, message: 'Agent access required' });
};

// Verify admin credentials
const verifyAdminCredentials = async (username, password) => {
  const adminUsername = process.env.ADMIN_USERNAME || 'aparnainstitutes';
  const adminPassword = process.env.ADMIN_PASSWORD || 'APARNA@2025!Admin';
  
  // Simple comparison for username
  if (username !== adminUsername) {
    return false;
  }
  
  // Direct password comparison (in production, you'd store hashed password)
  return password === adminPassword;
};

// Verify user credentials
const verifyUserCredentials = async (username, password) => {
  const user = User.findOne({ username, status: 'active' });
  
  if (!user) {
    return null;
  }
  
  // Compare password (assuming stored as plain text for now)
  // In production, use bcrypt.compare for hashed passwords
  if (user.password === password) {
    return user;
  }
  
  return null;
};

// Verify agent credentials
const verifyAgentCredentials = async (username, password) => {
  // Check database first
  const agent = Agent.verifyCredentials(username, password);
  if (agent) {
    return agent;
  }
  
  // Fallback to pre-seeded accounts for backward compatibility
  const agentAccounts = [
    { username: 'agent', password: 'agent123' },
    { username: 'payment_agent', password: 'payment2026' },
    { username: 'offline_agent', password: 'offline123' }
  ];
  
  const fallbackAgent = agentAccounts.find(a => a.username === username && a.password === password);
  return fallbackAgent !== undefined ? { username, fullName: username } : null;
};

module.exports = {
  isAuthenticated,
  isAdmin,
  isAgent,
  verifyAdminCredentials,
  verifyUserCredentials,
  verifyAgentCredentials
};
