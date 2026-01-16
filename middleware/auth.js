const bcrypt = require('bcrypt');
const User = require('../models/User');

// Conditional database import for Agent and database User
const useMySQL = process.env.USE_MYSQL === 'true';
let Agent, DbUser;
if (useMySQL) {
  const mysqlDb = require('../database/mysql-db');
  Agent = mysqlDb.Agent;
  DbUser = mysqlDb.User;
} else {
  Agent = require('../localdb').Agent;
  DbUser = null;
}

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
  // First, check database users table for admin role
  if (DbUser) {
    try {
      const user = await DbUser.findOne({ username, status: 'active' });
      if (user && user.role === 'admin') {
        // Direct password comparison (plain text in DB)
        if (user.password === password) {
          return true;
        }
      }
    } catch (error) {
      console.error('Database admin check error:', error);
    }
  }
  
  // Fallback to hardcoded admin
  const adminUsername = process.env.ADMIN_USERNAME || 'aparnainstitutes';
  const adminPassword = process.env.ADMIN_PASSWORD || 'APARNA@2025!Admin';
  
  if (username === adminUsername && password === adminPassword) {
    return true;
  }
  
  return false;
};

// Verify user credentials
const verifyUserCredentials = async (username, password) => {
  const user = await User.findOne({ username, status: 'active' });
  
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
  const agent = await Agent.verifyCredentials(username, password);
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
