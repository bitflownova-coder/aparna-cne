// Admin Dashboard Handler
let allRegistrations = [];
let currentPage = 1;
let searchTerm = '';
let selectedWorkshopId = '';

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
        loadStats();
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
    const searchBox = document.getElementById('searchBox');
    const workshopFilter = document.getElementById('workshopFilter');
    const closeModalBtn = document.getElementById('closeModalBtn');

    logoutBtn.addEventListener('click', handleLogout);
    downloadExcelBtn.addEventListener('click', downloadExcel);
    closeModalBtn.addEventListener('click', closeModal);

    // Workshop filter - update both stats and registrations
    workshopFilter.addEventListener('change', (e) => {
        selectedWorkshopId = e.target.value;
        currentPage = 1;
        loadStats(selectedWorkshopId); // Update stats for selected workshop
        loadRegistrations();
        loadWorkshopDetails(selectedWorkshopId); // Load workshop details
    });

    // Search with debounce
    let searchTimeout;
    searchBox.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            searchTerm = e.target.value;
            currentPage = 1;
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
                option.textContent = `${workshop.title} - ${date} (${workshop.status})`;
                workshopFilter.appendChild(option);
            });

            // Check if specific workshop is requested in URL
            const urlParams = new URLSearchParams(window.location.search);
            const workshopId = urlParams.get('workshopId');
            if (workshopId) {
                workshopFilter.value = workshopId;
                selectedWorkshopId = workshopId;
            }
        }
    } catch (error) {
        console.error('Error loading workshops:', error);
    }
}

// Load dashboard stats
async function loadStats(workshopId = '') {
    const statsSection = document.getElementById('statsSection');
    
    // Only show stats if a specific workshop is selected
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

// Load workshop details into dashboard header
async function loadWorkshopDetails(workshopId) {
    const workshopInfo = document.getElementById('workshopInfo');
    
    if (!workshopId) {
        // Show "All Workshops" view
        workshopInfo.innerHTML = `
            <h1 class="workshop-title">All Workshops</h1>
            <div class="workshop-meta">
                <span><i class="fas fa-calendar-alt"></i> View All</span>
            </div>
        `;
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/stats?workshopId=${workshopId}`);
        const data = await response.json();
        
        if (data.success && data.stats.workshop) {
            const workshop = data.stats.workshop;
            const date = new Date(workshop.date).toLocaleDateString('en-IN', { 
                day: '2-digit',
                month: '2-digit', 
                year: 'numeric' 
            });
            
            workshopInfo.innerHTML = `
                <h1 class="workshop-title">${workshop.title}</h1>
                <div class="workshop-meta">
                    <span><i class="fas fa-calendar-alt"></i> ${date}</span>
                    <span><i class="fas fa-rupee-sign"></i> ${workshop.fee}/-</span>
                    <span><i class="fas fa-award"></i> ${workshop.credits} CME Credits</span>
                    <span><i class="fas fa-map-marker-alt"></i> ${workshop.venue}</span>
                    <span class="status-badge status-${workshop.status.toLowerCase()}">${workshop.status}</span>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading workshop details:', error);
    }
}

// Load registrations
async function loadRegistrations() {
    try {
        let url = `/api/admin/registrations?page=${currentPage}&limit=50&search=${searchTerm}`;
        if (selectedWorkshopId) {
            url += `&workshopId=${selectedWorkshopId}`;
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success) {
            // Ensure table is ordered by form number ascending
            allRegistrations = (data.data || []).slice().sort((a, b) => (a.formNumber || 0) - (b.formNumber || 0));
            displayRegistrations(allRegistrations);
            
            if (data.pagination.pages > 1) {
                displayPagination(data.pagination);
            }
        }
    } catch (error) {
        console.error('Error loading registrations:', error);
        showAlert('Error loading registrations', 'error');
    }
}

// Display registrations in table
function displayRegistrations(registrations) {
    const tableContent = document.getElementById('tableContent');
    
    if (registrations.length === 0) {
        tableContent.innerHTML = '<p style="text-align: center; padding: 40px; color: var(--text-light);">No registrations found</p>';
        return;
    }

    let tableHTML = `
        <table>
            <thead>
                <tr>
                    <th>Form No</th>
                    <th>Full Name</th>
                    <th>MNC UID</th>
                    <th>MNC Reg No.</th>
                    <th>Mobile</th>
                    <th>Payment UTR</th>
                    <th>Downloads</th>
                    <th>Submitted</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
    `;

    registrations.forEach((reg, index) => {
        const submittedDate = new Date(reg.submittedAt).toLocaleDateString('en-IN');
        const downloadBadge = reg.downloadCount >= 2 ? 
            '<span class="badge badge-warning">2/2</span>' : 
            `<span class="badge badge-success">${reg.downloadCount}/2</span>`;

        tableHTML += `
            <tr>
                <td>${reg.formNumber || '-'}</td>
                <td>${reg.fullName}</td>
                <td>${reg.mncUID}</td>
                <td>${escapeHtml(reg.mncRegistrationNumber || '-')}</td>
                <td>${reg.mobileNumber}</td>
                <td>${reg.paymentUTR}</td>
                <td>${downloadBadge}</td>
                <td>${submittedDate}</td>
                <td>
                    <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 0.85rem;" onclick="viewDetails('${reg._id}')">
                        View
                    </button>
                    <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 0.85rem; background:#ef4444; color:white; border:none; margin-left:6px;" onclick="deleteRegistration('${reg._id}')">
                        Delete
                    </button>
                </td>
            </tr>
        `;
    });

    tableHTML += `
            </tbody>
        </table>
    `;

    tableContent.innerHTML = tableHTML;
}

// Display pagination
function displayPagination(pagination) {
    const paginationDiv = document.getElementById('pagination');
    paginationDiv.style.display = 'block';
    
    let paginationHTML = '<div style="display: flex; gap: 10px; justify-content: center; align-items: center;">';
    
    // Previous button
    if (pagination.page > 1) {
        paginationHTML += `<button class="btn btn-secondary" onclick="changePage(${pagination.page - 1})">Previous</button>`;
    }
    
    // Page info
    paginationHTML += `<span style="padding: 0 20px;">Page ${pagination.page} of ${pagination.pages}</span>`;
    
    // Next button
    if (pagination.page < pagination.pages) {
        paginationHTML += `<button class="btn btn-secondary" onclick="changePage(${pagination.page + 1})">Next</button>`;
    }
    
    paginationHTML += '</div>';
    paginationDiv.innerHTML = paginationHTML;
}

// Change page
function changePage(page) {
    currentPage = page;
    loadRegistrations();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// View registration details
function viewDetails(id) {
    const registration = allRegistrations.find(r => r._id === id);
    
    if (!registration) {
        showAlert('Registration not found', 'error');
        return;
    }

    const submittedDate = new Date(registration.submittedAt).toLocaleString('en-IN', {
        dateStyle: 'long',
        timeStyle: 'short'
    });

    const modalDetails = document.getElementById('modalDetails');
    modalDetails.innerHTML = `
        <div class="review-details">
            <div class="review-item">
                <strong>Form Number</strong>
                <span>${registration.formNumber || 'N/A'}</span>
            </div>
            <div class="review-item">
                <strong>Full Name</strong>
                <span>${registration.fullName}</span>
            </div>
            <div class="review-item">
                <strong>MNC UID</strong>
                <span>${registration.mncUID}</span>
            </div>
            <div class="review-item">
                <strong>MNC Registration Number</strong>
                <span>${registration.mncRegistrationNumber}</span>
            </div>
            <div class="review-item">
                <strong>Mobile Number</strong>
                <span>${registration.mobileNumber}</span>
            </div>
            <div class="review-item">
                <strong>Payment UTR / Transaction ID</strong>
                <span>${registration.paymentUTR}</span>
            </div>
            <div class="review-item">
                <strong>Download Count</strong>
                <span>${registration.downloadCount}/2</span>
            </div>
            <div class="review-item">
                <strong>Submitted At</strong>
                <span>${submittedDate}</span>
            </div>
            <div class="review-item">
                <strong>IP Address</strong>
                <span>${registration.ipAddress || 'N/A'}</span>
            </div>
            <div class="review-item">
                <strong>Payment Screenshot</strong>
                <span><img src="/uploads/payments/${registration.paymentScreenshot}" style="max-width: 100%; border-radius: 8px; margin-top: 10px;" alt="Payment Screenshot"></span>
            </div>
        </div>
    `;

    document.getElementById('detailsModal').classList.add('show');
}

// Close modal
function closeModal() {
    document.getElementById('detailsModal').classList.remove('show');
}

// Download Excel
async function downloadExcel() {
    try {
        showAlert('Generating Excel file...', 'info');
        
        const response = await fetch('/api/admin/download-excel');
        
        if (!response.ok) {
            throw new Error('Download failed');
        }

        // Get the blob
        const blob = await response.blob();
        
        // Create download link
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `CNE_Registrations_${Date.now()}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        showAlert('Excel file downloaded successfully!', 'success');
    } catch (error) {
        console.error('Excel download error:', error);
        showAlert('Error downloading Excel file', 'error');
    }
}

// Handle logout
async function handleLogout() {
    try {
        const response = await fetch('/api/admin/logout', {
            method: 'POST'
        });

        const data = await response.json();

        if (data.success) {
            window.location.href = '/admin-login';
        }
    } catch (error) {
        console.error('Logout error:', error);
        window.location.href = '/admin-login';
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

// Make viewDetails available globally
window.viewDetails = viewDetails;
window.changePage = changePage;
window.deleteRegistration = deleteRegistration;

// Delete registration
async function deleteRegistration(id) {
    const sure = confirm('Are you sure you want to delete this registration? This cannot be undone.');
    if (!sure) return;

    try {
        const response = await fetch(`/api/admin/registrations/${id}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            showAlert('Registration deleted successfully', 'success');
            loadRegistrations();
            loadStats();
        } else {
            showAlert(data.message || 'Delete failed', 'error');
        }
    } catch (error) {
        console.error('Delete error:', error);
        showAlert('Error deleting registration', 'error');
    }
}
