// Admin Dashboard Handler - Mobile-Friendly Version
let selectedWorkshopId = '';
let searchTerm = '';
let sortOrder = 'oldest'; // Default to oldest first
let currentPage = 1;
let pageSize = 50;
let totalRegistrations = 0;

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
    const pageSizeSelect = document.getElementById('pageSize');

    logoutBtn.addEventListener('click', handleLogout);
    downloadExcelBtn.addEventListener('click', downloadExcel);
    selectColumnsBtn.addEventListener('click', openColumnModal);

    // Workshop filter
    workshopFilter.addEventListener('change', (e) => {
        selectedWorkshopId = e.target.value;
        currentPage = 1; // Reset to first page
        loadStats(selectedWorkshopId);
        loadRegistrations();
    });

    // Sort order filter
    sortOrderSelect.addEventListener('change', (e) => {
        sortOrder = e.target.value;
        currentPage = 1; // Reset to first page
        loadRegistrations();
    });

    // Page size selector
    pageSizeSelect.addEventListener('change', (e) => {
        pageSize = parseInt(e.target.value);
        currentPage = 1; // Reset to first page
        loadRegistrations();
    });

    // Search with debounce
    let searchTimeout;
    searchBox.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            searchTerm = e.target.value;
            currentPage = 1; // Reset to first page on new search
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
            
            // Three-tier sorting: Active/Upcoming first (nearest date), Full second (nearest date), Completed last (latest date)
            const workshops = result.data.sort((a, b) => {
                // Define status priority: active/upcoming (0) > full (1) > completed (2) > others (3)
                const getStatusPriority = (status) => {
                    if (status === 'active' || status === 'upcoming') return 0;
                    if (status === 'full') return 1;
                    if (status === 'completed') return 2;
                    return 3;
                };
                
                const priorityA = getStatusPriority(a.status);
                const priorityB = getStatusPriority(b.status);
                
                // If different priority, sort by priority
                if (priorityA !== priorityB) {
                    return priorityA - priorityB;
                }
                
                // Within same priority, sort by date
                // For active/upcoming and full: nearest date first (ascending)
                // For completed: latest date first (descending)
                if (priorityA <= 1) {
                    return new Date(a.date) - new Date(b.date); // Nearest first
                } else {
                    return new Date(b.date) - new Date(a.date); // Latest first
                }
            });
            
            workshops.forEach(workshop => {
                const option = document.createElement('option');
                option.value = workshop._id;
                const date = new Date(workshop.date).toLocaleDateString('en-IN', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                });
                const statusLabel = ['completed', 'full'].includes(workshop.status) ? ` [${workshop.status.toUpperCase()}]` : '';
                option.textContent = `${workshop.title} - ${date}${statusLabel}`;
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
        // Build URL with pagination parameters
        let url = `/api/admin/registrations?page=${currentPage}&limit=${pageSize}&search=${encodeURIComponent(searchTerm)}&sort=${sortOrder}`;
        if (selectedWorkshopId) {
            url += `&workshopId=${selectedWorkshopId}`;
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success) {
            let registrations = data.data || [];
            totalRegistrations = data.total || registrations.length;
            
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
            
            displayRegistrations(registrations);
        }
    } catch (error) {
        console.error('Error loading registrations:', error);
        listContainer.innerHTML = '<div class="empty-state"><h3>Error loading registrations</h3><p>Please try again</p></div>';
    }
}

// Display registrations as Excel-style table
function displayRegistrations(registrations) {
    const listContainer = document.getElementById('registrationsList');
    
    if (registrations.length === 0) {
        listContainer.innerHTML = '<div class="empty-state"><h3>No registrations found</h3><p>Try changing the filters</p></div>';
        return;
    }

    // Store registrations globally for details modal
    window.registrationsData = {};
    registrations.forEach(reg => {
        window.registrationsData[reg._id] = reg;
    });

    // Calculate pagination info
    const totalPages = Math.ceil(totalRegistrations / pageSize);
    const startItem = (currentPage - 1) * pageSize + 1;
    const endItem = Math.min(currentPage * pageSize, totalRegistrations);

    let tableHTML = `
        <div class="pagination-controls">
            <div class="pagination-info">
                Showing ${startItem}-${endItem} of ${totalRegistrations} registrations
            </div>
            <div class="pagination-buttons">
                <button class="pagination-btn" onclick="goToFirstPage()" ${currentPage === 1 ? 'disabled' : ''}>⏮️ First</button>
                <button class="pagination-btn" onclick="goToPrevPage()" ${currentPage === 1 ? 'disabled' : ''}>◀️ Prev</button>
                <span class="page-indicator">Page ${currentPage} of ${totalPages}</span>
                <button class="pagination-btn" onclick="goToNextPage()" ${currentPage >= totalPages ? 'disabled' : ''}>Next ▶️</button>
                <button class="pagination-btn" onclick="goToLastPage()" ${currentPage >= totalPages ? 'disabled' : ''}>Last ⏭️</button>
            </div>
        </div>
        <table class="reg-table">
            <thead>
                <tr>
                    <th>Form No</th>
                    <th>MNC UID</th>
                    <th>MNC Reg No</th>
                    <th>Name</th>
                    <th>Payment UTR</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    registrations.forEach(reg => {
        const attendanceStatus = reg.attendanceStatus || 'Applied';
        const isPresent = attendanceStatus === 'Present';
        const statusBadge = isPresent 
            ? '<span class="badge badge-present">✓ Present</span>'
            : '<span class="badge badge-applied">● Applied</span>';
        
        tableHTML += `
            <tr>
                <td><span class="badge badge-form">${reg.formNumber || '-'}</span></td>
                <td title="${escapeHtml(reg.mncUID)}">${escapeHtml(reg.mncUID)}</td>
                <td title="${escapeHtml(reg.mncRegistrationNumber || '-')}">${escapeHtml(reg.mncRegistrationNumber || '-')}</td>
                <td class="truncate-text" title="${escapeHtml(reg.fullName)}">${escapeHtml(reg.fullName)}</td>
                <td title="${reg.paymentUTR}">${reg.paymentUTR}</td>
                <td>${statusBadge}</td>
                <td style="white-space: nowrap;">
                    <button class="action-btn action-btn-view" onclick="viewDetails('${reg._id}')" title="View Details">👁️</button>
                    <button class="action-btn action-btn-payment" onclick="viewPayment('${reg.paymentScreenshot}')" title="View Payment">💳</button>
                    <button class="action-btn action-btn-delete" onclick="deleteRegistration('${reg._id}')" title="Delete">🗑️</button>
                </td>
            </tr>
        `;
    });
    
    tableHTML += `</tbody></table>
        <div class="pagination-controls" style="margin-top: 16px;">
            <div class="pagination-info">
                Showing ${startItem}-${endItem} of ${totalRegistrations} registrations
            </div>
            <div class="pagination-buttons">
                <button class="pagination-btn" onclick="goToFirstPage()" ${currentPage === 1 ? 'disabled' : ''}>⏮️ First</button>
                <button class="pagination-btn" onclick="goToPrevPage()" ${currentPage === 1 ? 'disabled' : ''}>◀️ Prev</button>
                <span class="page-indicator">Page ${currentPage} of ${totalPages}</span>
                <button class="pagination-btn" onclick="goToNextPage()" ${currentPage >= totalPages ? 'disabled' : ''}>Next ▶️</button>
                <button class="pagination-btn" onclick="goToLastPage()" ${currentPage >= totalPages ? 'disabled' : ''}>Last ⏭️</button>
            </div>
        </div>`;
    listContainer.innerHTML = tableHTML;
}

// Pagination navigation functions
function goToFirstPage() {
    currentPage = 1;
    loadRegistrations();
}

function goToPrevPage() {
    if (currentPage > 1) {
        currentPage--;
        loadRegistrations();
    }
}

function goToNextPage() {
    const totalPages = Math.ceil(totalRegistrations / pageSize);
    if (currentPage < totalPages) {
        currentPage++;
        loadRegistrations();
    }
}

function goToLastPage() {
    currentPage = Math.ceil(totalRegistrations / pageSize);
    loadRegistrations();
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

// View participant details
function viewDetails(id) {
    const reg = window.registrationsData[id];
    if (!reg) {
        showAlert('Registration details not found', 'error');
        return;
    }
    
    const submittedDate = new Date(reg.submittedAt).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    // Determine registration source
    let registrationSource = '🌐 Website';
    if (reg.submittedBy === 'executive' || reg.submittedBy === 'executive_bulk') {
        const executiveName = reg.executiveUsername || reg.registeredBy || 'Unknown';
        const method = reg.submittedBy === 'executive_bulk' ? 'Bulk' : 'Individual';
        registrationSource = `👔 ${executiveName} (${method})`;
    }
    
    const attendanceStatus = reg.attendanceStatus || 'Applied';
    const attendanceMarkedAt = reg.attendanceMarkedAt 
        ? new Date(reg.attendanceMarkedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '-';
    
    const detailsHTML = `
        <div class="detail-row">
            <span class="detail-label">Form Number:</span>
            <span class="detail-value">${reg.formNumber || '-'}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Full Name:</span>
            <span class="detail-value">${escapeHtml(reg.fullName)}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">MNC UID:</span>
            <span class="detail-value">${escapeHtml(reg.mncUID)}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">MNC Reg Number:</span>
            <span class="detail-value">${escapeHtml(reg.mncRegistrationNumber || '-')}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Mobile:</span>
            <span class="detail-value">${reg.mobileNumber}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Email:</span>
            <span class="detail-value">${reg.email || '-'}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Date of Birth:</span>
            <span class="detail-value">${reg.dateOfBirth || '-'}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Gender:</span>
            <span class="detail-value">${reg.gender || '-'}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Qualification:</span>
            <span class="detail-value">${reg.qualification || '-'}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Organization:</span>
            <span class="detail-value">${escapeHtml(reg.organization || '-')}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Address:</span>
            <span class="detail-value">${escapeHtml(reg.address || '-')}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">City:</span>
            <span class="detail-value">${escapeHtml(reg.city || '-')}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">State:</span>
            <span class="detail-value">${escapeHtml(reg.state || '-')}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Pin Code:</span>
            <span class="detail-value">${reg.pinCode || '-'}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Payment UTR:</span>
            <span class="detail-value">${reg.paymentUTR}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Payment Verified:</span>
            <span class="detail-value">${reg.paymentVerified ? '✅ Yes' : '❌ No'}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Attendance:</span>
            <span class="detail-value">${attendanceStatus === 'Present' ? '✅ Present' : '⏳ Applied'}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Attendance Marked:</span>
            <span class="detail-value">${attendanceMarkedAt}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Download Count:</span>
            <span class="detail-value" style="color: ${reg.downloadCount >= 2 ? '#ef4444' : '#10b981'}; font-weight: 700;">${reg.downloadCount}/2</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Registration Source:</span>
            <span class="detail-value">${registrationSource}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Submitted At:</span>
            <span class="detail-value">${submittedDate}</span>
        </div>
    `;
    
    document.getElementById('detailsContent').innerHTML = detailsHTML;
    document.getElementById('detailsModal').style.display = 'block';
}

// Close details modal
function closeDetailsModal() {
    document.getElementById('detailsModal').style.display = 'none';
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
        // Require workshop selection for download
        if (!selectedWorkshopId) {
            showAlert('Please select a workshop first to download its registrations', 'error');
            return;
        }
        
        let url = `/api/admin/export-excel?workshopId=${selectedWorkshopId}`;
        
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
