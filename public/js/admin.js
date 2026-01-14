// Admin Dashboard Handler - Mobile-Friendly Version
let selectedWorkshopId = '';
let searchTerm = '';
let sortOrder = 'newest'; // Default to newest first

// Check authentication on load
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupEventListeners();
});

// Check if admin is authenticated
async function checkAuth() {
    try {
        const response = await fetch('/api/admin/check-session');
        const data = await response.json();
        
        if (!data.success || !data.isAdmin) {
            window.location.href = '/admin-login';
            return;
        }
        
        // Load dashboard data
        loadWorkshops();
        loadRegistrations();
    } catch (error) {
        console.error('Auth check error:', error);
        window.location.href = '/admin-login';
    }
}

// Setup event listeners
function setupEventListeners() {
    const logoutBtn = document.getElementById('logoutBtn');
    const downloadExcelBtn = document.getElementById('downloadExcelBtn');
    const selectColumnsBtn = document.getElementById('selectColumnsBtn');
    const searchBox = document.getElementById('searchBox');
    const workshopFilter = document.getElementById('workshopFilter');
    const sortOrderSelect = document.getElementById('sortOrder');

    logoutBtn.addEventListener('click', handleLogout);
    downloadExcelBtn.addEventListener('click', downloadExcel);
    selectColumnsBtn.addEventListener('click', openColumnModal);

    // Workshop filter
    workshopFilter.addEventListener('change', (e) => {
        selectedWorkshopId = e.target.value;
        loadStats(selectedWorkshopId);
        loadRegistrations();
    });

    // Sort order filter
    sortOrderSelect.addEventListener('change', (e) => {
        sortOrder = e.target.value;
        loadRegistrations();
    });

    // Search with debounce
    let searchTimeout;
    searchBox.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            searchTerm = e.target.value;
            loadRegistrations();
        }, 500);
    });
}

// Load workshops for filter dropdown
async function loadWorkshops() {
    try {
        const response = await fetch('/api/admin/workshops');
        const result = await response.json();
        
        if (result.success && result.data) {
            const workshopFilter = document.getElementById('workshopFilter');
            const workshops = result.data.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            workshops.forEach(workshop => {
                const option = document.createElement('option');
                option.value = workshop._id;
                const date = new Date(workshop.date).toLocaleDateString('en-IN', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                });
                option.textContent = `${workshop.title} - ${date}`;
                workshopFilter.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading workshops:', error);
    }
}

// Load dashboard stats
async function loadStats(workshopId = '') {
    const statsSection = document.getElementById('statsSection');
    
    if (!workshopId) {
        statsSection.style.display = 'none';
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/stats?workshopId=${workshopId}`);
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('totalCount').textContent = data.stats.total;
            document.getElementById('remainingCount').textContent = data.stats.remaining;
            document.getElementById('percentageFilled').textContent = data.stats.percentageFilled + '%';
            statsSection.style.display = 'grid';
        }
    } catch (error) {
        console.error('Error loading stats:', error);
        statsSection.style.display = 'none';
    }
}

// Load registrations
async function loadRegistrations() {
    const listContainer = document.getElementById('registrationsList');
    listContainer.innerHTML = '<div class="spinner"></div>';
    
    try {
        let url = `/api/admin/registrations?limit=1000&search=${searchTerm}`;
        if (selectedWorkshopId) {
            url += `&workshopId=${selectedWorkshopId}`;
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success) {
            let registrations = data.data || [];
            
            // Fetch attendance data
            const attendanceResponse = await fetch('/api/attendance/all');
            const attendanceData = await attendanceResponse.json();
            const attendanceMap = {};
            
            if (attendanceData.success) {
                attendanceData.data.forEach(att => {
                    const key = `${att.workshopId}_${att.mncUID}`;
                    attendanceMap[key] = att;
                });
            }
            
            // Add attendance status to registrations
            registrations = registrations.map(reg => {
                const key = `${reg.workshopId}_${reg.mncUID}`;
                reg.attendanceStatus = attendanceMap[key] ? 'Present' : 'Applied';
                reg.attendanceMarkedAt = attendanceMap[key] ? attendanceMap[key].markedAt : null;
                return reg;
            });
            
            // Sort by registration time (submittedAt)
            registrations.sort((a, b) => {
                const dateA = new Date(a.submittedAt);
                const dateB = new Date(b.submittedAt);
                
                if (sortOrder === 'newest') {
                    return dateB - dateA; // Newest first (descending)
                } else {
                    return dateA - dateB; // Oldest first (ascending)
                }
            });
            
            displayRegistrations(registrations);
        }
    } catch (error) {
        console.error('Error loading registrations:', error);
        listContainer.innerHTML = '<div class="empty-state"><h3>Error loading registrations</h3><p>Please try again</p></div>';
    }
}

// Display registrations as cards
function displayRegistrations(registrations) {
    const listContainer = document.getElementById('registrationsList');
    
    if (registrations.length === 0) {
        listContainer.innerHTML = '<div class="empty-state"><h3>No registrations found</h3><p>Try changing the filters</p></div>';
        return;
    }

    let cardsHTML = '';
    
    registrations.forEach(reg => {
        const submittedDate = new Date(reg.submittedAt).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
        
        const attendanceStatus = reg.attendanceStatus || 'Applied';
        const isPresent = attendanceStatus === 'Present';
        const attendanceBadge = isPresent 
            ? '<span style="background: #10b981; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">✓ Present</span>'
            : '<span style="background: #f59e0b; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">● Applied</span>';
        
        // Determine registration source
        let registrationSource = '🌐 Website';
        let sourceColor = '#3b82f6';
        
        if (reg.submittedBy === 'executive' || reg.submittedBy === 'executive_bulk') {
            const executiveName = reg.executiveUsername || reg.registeredBy || 'Unknown';
            const method = reg.submittedBy === 'executive_bulk' ? 'Bulk' : 'Individual';
            registrationSource = `👔 ${executiveName} (${method})`;
            sourceColor = '#8b5cf6';
        }
        
        cardsHTML += `
            <div class="registration-card">
                <div class="reg-header">
                    <div class="reg-name">${escapeHtml(reg.fullName)}</div>
                    <div class="reg-form-no">Form ${reg.formNumber || '-'}</div>
                </div>
                <div class="reg-details">
                    <div class="reg-detail-row">
                        <span class="reg-detail-label">Registration Source:</span>
                        <span style="color: ${sourceColor}; font-weight: 600;">${registrationSource}</span>
                    </div>
                    <div class="reg-detail-row">
                        <span class="reg-detail-label">MNC UID:</span>
                        <span>${escapeHtml(reg.mncUID)}</span>
                    </div>
                    <div class="reg-detail-row">
                        <span class="reg-detail-label">Reg Number:</span>
                        <span>${escapeHtml(reg.mncRegistrationNumber || '-')}</span>
                    </div>
                    <div class="reg-detail-row">
                        <span class="reg-detail-label">Mobile:</span>
                        <span>${reg.mobileNumber}</span>
                    </div>
                    <div class="reg-detail-row">
                        <span class="reg-detail-label">Payment UTR:</span>
                        <span>${reg.paymentUTR}</span>
                    </div>
                    <div class="reg-detail-row">
                        <span class="reg-detail-label">Submitted:</span>
                        <span>${submittedDate}</span>
                    </div>
                    <div class="reg-detail-row">
                        <span class="reg-detail-label">Attendance:</span>
                        <span>${attendanceBadge}</span>
                    </div>
                    <div class="reg-detail-row">
                        <span class="reg-detail-label">Downloads:</span>
                        <span style="color: ${reg.downloadCount >= 2 ? '#ef4444' : '#10b981'}; font-weight: 700;">${reg.downloadCount}/2</span>
                    </div>
                </div>
                <div class="reg-actions">
                    <button class="btn btn-primary btn-small" onclick="viewPayment('${reg.paymentScreenshot}')">
                        View Payment
                    </button>
                    <button class="btn btn-danger btn-small" onclick="deleteRegistration('${reg._id}')">
                        Delete
                    </button>
                </div>
            </div>
        `;
    });
    
    listContainer.innerHTML = cardsHTML;
}

// View payment screenshot
function viewPayment(screenshotPath) {
    const modal = document.getElementById('paymentModal');
    const img = document.getElementById('paymentImage');
    // If path doesn't start with uploads/, add it
    const fullPath = screenshotPath.startsWith('uploads/') ? screenshotPath : `uploads/payments/${screenshotPath}`;
    img.src = '/' + fullPath;
    modal.style.display = 'block';
}

// Close payment modal
function closePaymentModal() {
    const modal = document.getElementById('paymentModal');
    modal.style.display = 'none';
}

// Delete registration
async function deleteRegistration(id) {
    if (!confirm('Are you sure you want to delete this registration?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/registrations/${id}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Registration deleted successfully', 'success');
            loadStats(selectedWorkshopId);
            loadRegistrations();
        } else {
            showAlert(data.message || 'Failed to delete registration', 'error');
        }
    } catch (error) {
        console.error('Error deleting registration:', error);
        showAlert('Error deleting registration', 'error');
    }
}

// Download Excel
async function downloadExcel() {
    try {
        let url = '/api/admin/export-excel';
        if (selectedWorkshopId) {
            url += `?workshopId=${selectedWorkshopId}`;
        }
        
        const response = await fetch(url);
        
        if (response.ok) {
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `registrations-${new Date().toISOString().split('T')[0]}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(downloadUrl);
            
            showAlert('Excel downloaded successfully', 'success');
        } else {
            showAlert('Failed to download Excel', 'error');
        }
    } catch (error) {
        console.error('Error downloading Excel:', error);
        showAlert('Error downloading Excel', 'error');
    }
}

// Logout
async function handleLogout() {
    try {
        await fetch('/api/admin/logout', { method: 'POST' });
        window.location.href = '/admin-login';
    } catch (error) {
        console.error('Logout error:', error);
        window.location.href = '/admin-login';
    }
}

// Show alert
function showAlert(message, type) {
    const alert = document.getElementById('alertMessage');
    alert.textContent = message;
    alert.className = `alert ${type} show`;
    
    setTimeout(() => {
        alert.classList.remove('show');
    }, 3000);
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Column selector for Excel export
const availableColumns = [
    { key: 'sno', label: 'S.No', default: true },
    { key: 'formNumber', label: 'Form Number (CPD-XXX)', default: true },
    { key: 'fullName', label: 'Full Name', default: true },
    { key: 'mobileNumber', label: 'Mobile Number', default: true },
    { key: 'email', label: 'Email', default: true },
    { key: 'mncUID', label: 'MNC UID', default: true },
    { key: 'mncRegistrationNumber', label: 'MNC Registration Number', default: true },
    { key: 'workshop', label: 'Workshop Name', default: true },
    { key: 'workshopDate', label: 'Workshop Date', default: true },
    { key: 'registrationSource', label: 'Registration Source (Website/Executive)', default: true },
    { key: 'registeredBy', label: 'Registered By (Executive Name)', default: true },
    { key: 'attendanceStatus', label: 'Attendance Status', default: true },
    { key: 'attendanceTime', label: 'Attendance Time', default: false },
    { key: 'dateOfBirth', label: 'Date of Birth', default: false },
    { key: 'gender', label: 'Gender', default: false },
    { key: 'qualification', label: 'Qualification', default: false },

    { key: 'organization', label: 'Organization', default: false },
    { key: 'experience', label: 'Experience (Years)', default: false },
    { key: 'city', label: 'City', default: false },
    { key: 'state', label: 'State', default: false },
    { key: 'submittedAt', label: 'Submitted At', default: true }
];

let selectedColumns = availableColumns.filter(col => col.default).map(col => col.key);

function openColumnModal() {
    const modal = document.getElementById('columnModal');
    const checkboxesContainer = document.getElementById('columnCheckboxes');
    
    // Generate checkboxes
    let checkboxesHTML = '';
    availableColumns.forEach(col => {
        const isChecked = selectedColumns.includes(col.key) ? 'checked' : '';
        checkboxesHTML += `
            <label style="display: flex; align-items: center; padding: 10px; cursor: pointer; border-bottom: 1px solid #f1f5f9;">
                <input type="checkbox" value="${col.key}" ${isChecked} onchange="updateColumnSelection()" style="margin-right: 10px; width: 18px; height: 18px; cursor: pointer;">
                <span style="font-size: 14px; color: #334155;">${col.label}</span>
            </label>
        `;
    });
    
    checkboxesContainer.innerHTML = checkboxesHTML;
    modal.style.display = 'block';
    updateSelectAllCheckbox();
}

function closeColumnModal() {
    document.getElementById('columnModal').style.display = 'none';
}

function updateColumnSelection() {
    const checkboxes = document.querySelectorAll('#columnCheckboxes input[type="checkbox"]');
    selectedColumns = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);
    updateSelectAllCheckbox();
}

function toggleAllColumns() {
    const selectAllCheckbox = document.getElementById('selectAllColumns');
    const checkboxes = document.querySelectorAll('#columnCheckboxes input[type="checkbox"]');
    
    checkboxes.forEach(cb => {
        cb.checked = selectAllCheckbox.checked;
    });
    
    updateColumnSelection();
}

function updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('selectAllColumns');
    const checkboxes = document.querySelectorAll('#columnCheckboxes input[type="checkbox"]');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    
    if (selectAllCheckbox) {
        selectAllCheckbox.checked = allChecked;
    }
}

function confirmColumnSelection() {
    if (selectedColumns.length === 0) {
        showAlert('Please select at least one column', 'error');
        return;
    }
    closeColumnModal();
    downloadExcelWithColumns();
}

async function downloadExcelWithColumns() {
    try {
        let url = '/api/admin/export-excel?columns=' + selectedColumns.join(',');
        if (selectedWorkshopId) {
            url += `&workshopId=${selectedWorkshopId}`;
        }
        
        const response = await fetch(url);
        
        if (response.ok) {
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `registrations-${new Date().toISOString().split('T')[0]}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(downloadUrl);
            
            showAlert('Excel downloaded successfully with selected columns', 'success');
        } else {
            showAlert('Failed to download Excel', 'error');
        }
    } catch (error) {
        console.error('Error downloading Excel:', error);
        showAlert('Error downloading Excel', 'error');
    }
}
