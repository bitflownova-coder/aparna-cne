const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { isAdmin } = require('../middleware/auth');

// Get all users (admin only)
router.get('/', isAdmin, async (req, res) => {
  try {
    const users = User.find({});
    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users'
    });
  }
});

// Create new user (admin only)
router.post('/', isAdmin, async (req, res) => {
  try {
    const { username, password, fullName, email, phone } = req.body;
    
    // Validate required fields
    if (!username || !password || !fullName) {
      return res.status(400).json({
        success: false,
        message: 'Username, password, and full name are required'
      });
    }
    
    // Check if username already exists
    const existingUser = User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Username already exists'
      });
    }
    
    // Create new user
    const newUser = User.create({
      username,
      password, // In production, hash this password
      fullName,
      email,
      phone,
      role: 'user',
      status: 'active'
    });
    
    res.json({
      success: true,
      message: 'User created successfully',
      data: {
        _id: newUser._id,
        username: newUser.username,
        fullName: newUser.fullName,
        role: newUser.role,
        status: newUser.status
      }
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating user'
    });
  }
});

// Update user (admin only)
router.put('/:id', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, email, phone, status, password } = req.body;
    
    const user = User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const updates = {};
    if (fullName) updates.fullName = fullName;
    if (email) updates.email = email;
    if (phone) updates.phone = phone;
    if (status) updates.status = status;
    if (password) updates.password = password; // In production, hash this
    
    const updatedUser = User.updateById(id, updates);
    
    res.json({
      success: true,
      message: 'User updated successfully',
      data: {
        _id: updatedUser._id,
        username: updatedUser.username,
        fullName: updatedUser.fullName,
        role: updatedUser.role,
        status: updatedUser.status
      }
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating user'
    });
  }
});

// Delete user (admin only)
router.delete('/:id', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    User.deleteById(id);
    
    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting user'
    });
  }
});

module.exports = router;
