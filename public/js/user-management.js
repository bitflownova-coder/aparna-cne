// User Management JavaScript
let currentEditUser = null;
let deleteUserId = null;

document.addEventListener('DOMContentLoaded', () => {
    checkAdminSession();
    loadUsers();
    loadStats();
});

// Check if user is admin
async function checkAdminSession() {
    try {
        const response = await fetch('/api/admin/check-session');
        const data = await response.json();
        
        if (!data.success || !data.isAdmin) {
            window.location.href = '/admin-login';
        }
    } catch (error) {
        console.error('Session check error:', error);
        window.location.href = '/admin-login';
    }
}

// Load statistics
async function loadStats() {
    try {
        const response = await fetch('/api/users');
        const data = await response.json();
        
        if (data.success) {
            const users = data.data;
            const activeCount = users.filter(u => u.status === 'active').length;
            const inactiveCount = users.filter(u => u.status === 'inactive').length;
            
            document.getElementById('totalUsers').textContent = users.length;
            document.getElementById('activeUsers').textContent = activeCount;
            document.getElementById('inactiveUsers').textContent = inactiveCount;
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Load all users
async function loadUsers() {
    showSpinner(true);
    
    try {
        const response = await fetch('/api/users');
        const data = await response.json();
        
        if (data.success) {
            displayUsers(data.data);
        } else {
            showAlert('Error loading users: ' + data.message, 'error');
        }
    } catch (error) {
        console.error('Error loading users:', error);
        showAlert('Error loading users. Please try again.', 'error');
    } finally {
        showSpinner(false);
    }
}

// Display users
function displayUsers(users) {
    const usersList = document.getElementById('usersList');
    
    if (users.length === 0) {
        usersList.innerHTML = `
            <div class="empty-state">
                <h3>No Users Found</h3>
                <p>Click "Create New User" to add your first user.</p>
            </div>
        `;
        return;
    }
    
    usersList.innerHTML = users.map(user => {
        const createdDate = new Date(user.createdAt).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
        
        return `
            <div class="user-card">
                <div class="user-header">
                    <div class="user-info">
                        <h3>${escapeHtml(user.fullName)}</h3>
                        <div class="user-meta">
                            <span>
                                <strong>?? Username:</strong> ${escapeHtml(user.username)}
                            </span>
                            ${user.email ? `
                                <span>
                                    <strong>?? Email:</strong> ${escapeHtml(user.email)}
                                </span>
                            ` : ''}
                            ${user.phone ? `
                                <span>
                                    <strong>?? Phone:</strong> ${escapeHtml(user.phone)}
                                </span>
                            ` : ''}
                            <span>
                                <strong>?? Created:</strong> ${createdDate}
                            </span>
                        </div>
                    </div>
                    <div>
                        <span class="status-badge status-${user.status}">
                            ${user.status === 'active' ? '? Active' : '? Inactive'}
                        </span>
                    </div>
                </div>
                <div class="user-actions">
                    <button class="btn-icon btn-edit" onclick='editUser(${JSON.stringify(user).replace(/'/g, "&#39;")})'>
                        ?? Edit
                    </button>
                    <button class="btn-icon btn-toggle" onclick="toggleUserStatus('${user._id}', '${user.status}')">
                        ${user.status === 'active' ? '?? Deactivate' : '?? Activate'}
                    </button>
                    <button class="btn-icon btn-delete" onclick="showDeleteModal('${user._id}', '${escapeHtml(user.fullName)}')">
                        ??? Delete
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Show create user modal
function showCreateUserModal() {
    currentEditUser = null;
    document.getElementById('modalTitle').textContent = 'Create New User';
    document.getElementById('userForm').reset();
    document.getElementById('userId').value = '';
    document.getElementById('username').disabled = false;
    document.getElementById('password').required = true;
    
    // Update password help text
    const passwordField = document.getElementById('password');
    const passwordHelp = passwordField.nextElementSibling;
    passwordHelp.textContent = 'Minimum 6 characters';
    
    document.getElementById('userModal').classList.add('show');
}

// Edit user
function editUser(user) {
    currentEditUser = user;
    document.getElementById('modalTitle').textContent = 'Edit User';
    document.getElementById('userId').value = user._id;
    document.getElementById('username').value = user.username;
    document.getElementById('username').disabled = true; // Cannot change username
    document.getElementById('password').value = '';
    document.getElementById('password').required = false;
    document.getElementById('fullName').value = user.fullName;
    document.getElementById('email').value = user.email || '';
    document.getElementById('phone').value = user.phone || '';
    document.getElementById('status').value = user.status;
    
    // Update password help text
    const passwordField = document.getElementById('password');
    const passwordHelp = passwordField.nextElementSibling;
    passwordHelp.textContent = 'Leave blank to keep existing password';
    
    document.getElementById('userModal').classList.add('show');
}

// Close user modal
function closeUserModal() {
    document.getElementById('userModal').classList.remove('show');
    document.getElementById('userForm').reset();
    currentEditUser = null;
}

// Save user (create or update)
async function saveUser() {
    const form = document.getElementById('userForm');
    
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const userId = document.getElementById('userId').value;
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const fullName = document.getElementById('fullName').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const status = document.getElementById('status').value;
    
    // Validate
    if (!username || !fullName) {
        showAlert('Username and Full Name are required', 'error');
        return;
    }
    
    if (!userId && !password) {
        showAlert('Password is required for new users', 'error');
        return;
    }
    
    if (password && password.length < 6) {
        showAlert('Password must be at least 6 characters', 'error');
        return;
    }
    
    const saveBtn = document.getElementById('saveUserBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    
    try {
        const userData = {
            username,
            fullName,
            email,
            phone,
            status
        };
        
        // Only include password if provided
        if (password) {
            userData.password = password;
        }
        
        let response;
        if (userId) {
            // Update existing user
            response = await fetch(`/api/users/${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });
        } else {
            // Create new user
            response = await fetch('/api/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });
        }
        
        const data = await response.json();
        
        if (data.success) {
            showAlert(userId ? 'User updated successfully!' : 'User created successfully!', 'success');
            closeUserModal();
            loadUsers();
            loadStats();
        } else {
            showAlert(data.message || 'Error saving user', 'error');
        }
    } catch (error) {
        console.error('Error saving user:', error);
        showAlert('Error saving user. Please try again.', 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save User';
    }
}

// Toggle user status
async function toggleUserStatus(userId, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    
    if (!confirm(`Are you sure you want to ${newStatus === 'active' ? 'activate' : 'deactivate'} this user?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/users/${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert(`User ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully!`, 'success');
            loadUsers();
            loadStats();
        } else {
            showAlert(data.message || 'Error updating user status', 'error');
        }
    } catch (error) {
        console.error('Error toggling user status:', error);
        showAlert('Error updating user status. Please try again.', 'error');
    }
}

// Show delete confirmation modal
function showDeleteModal(userId, userName) {
    deleteUserId = userId;
    document.getElementById('deleteUserName').textContent = userName;
    document.getElementById('deleteModal').classList.add('show');
}

// Close delete modal
function closeDeleteModal() {
    document.getElementById('deleteModal').classList.remove('show');
    deleteUserId = null;
}

// Confirm delete user
async function confirmDelete() {
    if (!deleteUserId) return;
    
    try {
        const response = await fetch(`/api/users/${deleteUserId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('User deleted successfully!', 'success');
            closeDeleteModal();
            loadUsers();
            loadStats();
        } else {
            showAlert(data.message || 'Error deleting user', 'error');
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        showAlert('Error deleting user. Please try again.', 'error');
    }
}

// Logout
async function logout() {
    try {
        await fetch('/api/admin/logout', { method: 'POST' });
        window.location.href = '/admin-login';
    } catch (error) {
        console.error('Logout error:', error);
        window.location.href = '/admin-login';
    }
}

// Show/hide spinner
function showSpinner(show) {
    const spinner = document.getElementById('loadingSpinner');
    if (show) {
        spinner.classList.add('show');
    } else {
        spinner.classList.remove('show');
    }
}

// Show alert message
function showAlert(message, type) {
    const alert = document.getElementById('alertMessage');
    alert.textContent = message;
    alert.className = `alert alert-${type} show`;
    
    setTimeout(() => {
        alert.classList.remove('show');
    }, 5000);
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
