// Workshop Management JavaScript
let currentWorkshops = [];
let editingWorkshopId = null;
let selectedColumns = [];
let selectedWorkshopId = null;

// Available columns for export
const availableColumns = [
    { id: 'sno', label: 'S.No' },
    { id: 'formNumber', label: 'Form Number' },
    { id: 'fullName', label: 'Full Name' },
    { id: 'mobileNumber', label: 'Mobile Number' },
    { id: 'email', label: 'Email' },
    { id: 'mncUID', label: 'MNC UID' },
    { id: 'mncRegistrationNumber', label: 'MNC Registration Number' },
    { id: 'workshop', label: 'Workshop' },
    { id: 'workshopDate', label: 'Workshop Date' },
    { id: 'registrationSource', label: 'Registration Source' },
    { id: 'registeredBy', label: 'Registered By' },
    { id: 'dateOfBirth', label: 'Date of Birth' },
    { id: 'gender', label: 'Gender' },
    { id: 'qualification', label: 'Qualification' },
    { id: 'organization', label: 'Organization' },
    { id: 'experience', label: 'Experience (Years)' },
    { id: 'address', label: 'Address' },
    { id: 'city', label: 'City' },
    { id: 'state', label: 'State' },
    { id: 'pinCode', label: 'Pin Code' }
];

// Load workshops on page load
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    loadWorkshops();
});

// Check if user is authenticated
function checkAuth() {
    fetch('/api/admin/check-session')
        .then(response => response.json())
        .then(data => {
            if (!data.success || !data.isAdmin) {
                window.location.href = '/admin-login';
            }
        })
        .catch(() => {
            window.location.href = '/admin-login';
        });
}

// Load workshops with filters
async function loadWorkshops() {
    try {
        const status = document.getElementById('filterStatus').value;
        const dateFrom = document.getElementById('filterDateFrom').value;
        const dateTo = document.getElementById('filterDateTo').value;
        const search = document.getElementById('filterSearch').value;

        const params = new URLSearchParams();
        if (status) params.append('status', status);
        if (dateFrom) params.append('dateFrom', dateFrom);
        if (dateTo) params.append('dateTo', dateTo);
        if (search) params.append('search', search);

        const response = await fetch(`/api/admin/workshops?${params.toString()}`);
        const result = await response.json();

        if (result.success) {
            currentWorkshops = result.data;
            renderWorkshopsTable(result.data);
        } else {
            showError('Failed to load workshops: ' + result.message);
        }
    } catch (error) {
        console.error('Error loading workshops:', error);
        showError('Error loading workshops. Please try again.');
    }
}

// Render workshops table
function renderWorkshopsTable(workshops) {
    const tbody = document.getElementById('workshopsTableBody');
    
    if (workshops.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8">
                    <div class="empty-state">
                        <h3>No workshops found</h3>
                        <p>Create your first workshop to get started</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = workshops.map(workshop => {
        const date = new Date(workshop.date);
        const formattedDate = date.toLocaleDateString('en-IN', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
        
        const seatsUsed = workshop.currentRegistrations;
        const seatsTotal = workshop.maxSeats;
        const seatsPercent = (seatsUsed / seatsTotal * 100).toFixed(0);
        const seatsClass = seatsPercent >= 90 ? 'seats-warning' : '';

        return `
            <tr>
                <td style="text-align: center;">
                    <input type="radio" name="workshopSelect" value="${workshop._id}" onchange="selectWorkshop('${workshop._id}')" style="width: 18px; height: 18px; cursor: pointer;">
                </td>
                <td>
                    <strong>${escapeHtml(workshop.title)}</strong>
                    <div style="font-size: 12px; color: #666; margin-top: 3px;">
                        ${escapeHtml(workshop.venue)}
                    </div>
                </td>
                <td>
                    ${formattedDate}<br>
                    <span style="font-size: 12px; color: #666;">${workshop.dayOfWeek}</span>
                </td>
                <td>
                    <span class="status-badge status-${workshop.status}">${workshop.status}</span>
                </td>
                <td>
                    <div class="seats-info ${seatsClass}">
                        ${seatsUsed} / ${seatsTotal}
                        <div style="font-size: 11px;">(${seatsPercent}% filled)</div>
                    </div>
                </td>
                <td>₹${workshop.fee}</td>
                <td>${workshop.credits}</td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn btn-view" onclick="viewRegistrations('${workshop._id}')">
                            📋 View (${seatsUsed})
                        </button>
                        <button class="action-btn btn-edit" onclick="editWorkshop('${workshop._id}')">
                            ✏️ Edit
                        </button>
                        <button class="action-btn btn-qr" onclick="showQrUploadModal('${workshop._id}')">
                            📷 QR
                        </button>
                        <button class="action-btn btn-status" onclick="showStatusModal('${workshop._id}')">
                            🔄 Status
                        </button>
                        <button class="action-btn btn-delete" onclick="deleteWorkshop('${workshop._id}', ${seatsUsed})">
                            🗑️ Delete
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Clear filters
function clearFilters() {
    document.getElementById('filterStatus').value = '';
    document.getElementById('filterDateFrom').value = '';
    document.getElementById('filterDateTo').value = '';
    document.getElementById('filterSearch').value = '';
    loadWorkshops();
}

// Show create modal
function showCreateModal() {
    editingWorkshopId = null;
    document.getElementById('modalTitle').textContent = 'Create Workshop';
    document.getElementById('workshopForm').reset();
    document.getElementById('workshopId').value = '';
    document.getElementById('dayOfWeek').value = '';
    document.getElementById('workshopModal').style.display = 'block';
}

// Edit workshop
async function editWorkshop(id) {
    try {
        const response = await fetch(`/api/admin/workshops/${id}`);
        const result = await response.json();

        if (result.success) {
            const workshop = result.data;
            editingWorkshopId = id;
            
            document.getElementById('modalTitle').textContent = 'Edit Workshop';
            document.getElementById('workshopId').value = workshop._id;
            document.getElementById('title').value = workshop.title;
            document.getElementById('description').value = workshop.description;
            document.getElementById('date').value = workshop.date.split('T')[0];
            document.getElementById('dayOfWeek').value = workshop.dayOfWeek;
            document.getElementById('venue').value = workshop.venue;
            document.getElementById('venueLink').value = workshop.venueLink || '';
            document.getElementById('fee').value = workshop.fee;
            document.getElementById('credits').value = workshop.credits;
            document.getElementById('maxSeats').value = workshop.maxSeats;
            document.getElementById('status').value = workshop.status;

            // Show current QR code if exists
            if (workshop.qrCodeImage) {
                const qrPreview = document.getElementById('qrPreview');
                qrPreview.innerHTML = `
                    <p style="margin-bottom: 5px; font-size: 12px; color: #666;">Current QR Code:</p>
                    <img src="/uploads/qr-codes/${workshop.qrCodeImage}" alt="QR Code">
                `;
                qrPreview.style.display = 'block';
            }

            document.getElementById('workshopModal').style.display = 'block';
        } else {
            showError('Failed to load workshop details');
        }
    } catch (error) {
        console.error('Error loading workshop:', error);
        showError('Error loading workshop details');
    }
}

// Update day of week when date changes
function updateDayOfWeek() {
    const dateInput = document.getElementById('date');
    const dayOfWeekInput = document.getElementById('dayOfWeek');
    
    if (dateInput.value) {
        const date = new Date(dateInput.value + 'T00:00:00');
        const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
        dayOfWeekInput.value = days[date.getDay()];
    }
}

// Save workshop (create or update)
async function saveWorkshop(event) {
    event.preventDefault();

    try {
        // Validate CNE/CPD Number
        const cneCpdNumber = document.getElementById('cneCpdNumber').value.trim();
        if (!cneCpdNumber) {
            showError('CNE/CPD Number is required. This will be used as prefix for form numbers (e.g., 1001-001)');
            return;
        }
        
        const feeValue = document.getElementById('fee').value;
        const creditsValue = document.getElementById('credits').value;
        
        const formData = new FormData();
        formData.append('title', document.getElementById('title').value.trim());
        formData.append('description', document.getElementById('description').value.trim());
        formData.append('date', document.getElementById('date').value);
        formData.append('dayOfWeek', document.getElementById('dayOfWeek').value);
        formData.append('venue', document.getElementById('venue').value.trim());
        formData.append('venueLink', document.getElementById('venueLink').value.trim());
        formData.append('fee', feeValue);
        formData.append('credits', creditsValue);
        formData.append('cneCpdNumber', cneCpdNumber);
        formData.append('maxSeats', document.getElementById('maxSeats').value);
        formData.append('status', document.getElementById('status').value);

        // QR Code is uploaded separately via Upload QR button
        
        let response;
        if (editingWorkshopId) {
            // Update existing workshop
            response = await fetch(`/api/admin/workshops/${editingWorkshopId}`, {
                method: 'PUT',
                body: formData
            });
        } else {
            // Create new workshop
            response = await fetch('/api/admin/workshops', {
                method: 'POST',
                body: formData
            });
        }

        const result = await response.json();

        if (result.success) {
            showSuccess(editingWorkshopId ? 'Workshop updated successfully' : 'Workshop created successfully');
            closeModal();
            loadWorkshops();
        } else {
            showError(result.message || 'Failed to save workshop');
        }
    } catch (error) {
        console.error('Error saving workshop:', error);
        showError('Error saving workshop. Please try again.');
    }
}

// Close modal
function closeModal() {
    document.getElementById('workshopModal').style.display = 'none';
    editingWorkshopId = null;
}

// Show QR upload modal
function showQrUploadModal(id) {
    const workshop = currentWorkshops.find(w => w._id === id);
    
    document.getElementById('qrWorkshopId').value = id;
    document.getElementById('qrUploadForm').reset();
    document.getElementById('qrFilePreview').style.display = 'none';
    
    // Show current QR if exists
    const currentQrSection = document.getElementById('currentQrSection');
    const currentQrImage = document.getElementById('currentQrImage');
    
    if (workshop && workshop.qrCodeImage) {
        currentQrImage.src = `/uploads/qr-codes/${workshop.qrCodeImage}`;
        currentQrSection.style.display = 'block';
        document.getElementById('qrFile').removeAttribute('required');
    } else {
        currentQrSection.style.display = 'none';
        document.getElementById('qrFile').setAttribute('required', 'required');
    }
    
    // Reset button text
    document.getElementById('uploadBtnText').textContent = '💾 Save QR Code';
    document.getElementById('uploadQrBtn').disabled = false;
    
    document.getElementById('qrUploadModal').style.display = 'block';
}

// Preview QR file
function previewQrFile() {
    const file = document.getElementById('qrFile').files[0];
    const preview = document.getElementById('qrFilePreview');
    
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.innerHTML = `
                <p style="margin-bottom: 5px; font-size: 12px; color: #666;">New QR Preview:</p>
                <img src="${e.target.result}" alt="QR Preview" style="max-width: 150px; border-radius: 8px; border: 2px solid #3b82f6;">
            `;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
}

// Upload QR code
async function uploadQrCode(event) {
    event.preventDefault();
    
    const uploadBtn = document.getElementById('uploadQrBtn');
    const btnText = document.getElementById('uploadBtnText');
    
    // Show loading state
    uploadBtn.disabled = true;
    btnText.textContent = '⏳ Saving...';

    try {
        const workshopId = document.getElementById('qrWorkshopId').value;
        const file = document.getElementById('qrFile').files[0];

        if (!file) {
            showError('Please select a file');
            uploadBtn.disabled = false;
            btnText.textContent = '💾 Save QR Code';
            return;
        }

        const formData = new FormData();
        formData.append('qrCodeImage', file);

        const response = await fetch(`/api/admin/workshops/${workshopId}/upload-qr`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            showSuccess('✅ QR code saved successfully! Changes are now live.');
            closeQrModal();
            loadWorkshops();
        } else {
            showError(result.message || 'Failed to upload QR code');
            uploadBtn.disabled = false;
            btnText.textContent = '💾 Save QR Code';
        }
    } catch (error) {
        console.error('Error uploading QR:', error);
        showError('Error uploading QR code. Please try again.');
        document.getElementById('uploadQrBtn').disabled = false;
        document.getElementById('uploadBtnText').textContent = '💾 Save QR Code';
    }
}

// Close QR modal
function closeQrModal() {
    document.getElementById('qrUploadModal').style.display = 'none';
}

// Show status change modal
function showStatusModal(id) {
    const workshop = currentWorkshops.find(w => w._id === id);
    if (!workshop) return;

    document.getElementById('statusWorkshopId').value = id;
    document.getElementById('currentStatus').value = workshop.status.toUpperCase();
    document.getElementById('newStatus').value = '';
    document.getElementById('statusWarning').style.display = 'none';
    document.getElementById('statusModal').style.display = 'block';

    // Add event listener for status selection
    document.getElementById('newStatus').onchange = function() {
        const newStatus = this.value;
        const warning = document.getElementById('statusWarning');
        const warningText = document.getElementById('statusWarningText');

        if (newStatus === 'active' && workshop.status !== 'active') {
            warningText.textContent = 'Setting this workshop as ACTIVE will make it visible to users for registration. Multiple workshops can be active simultaneously.';
            warning.style.display = 'block';
        } else if (newStatus === 'completed') {
            warningText.textContent = 'Marking as COMPLETED will close registration permanently.';
            warning.style.display = 'block';
        } else if (newStatus === 'cancelled') {
            warningText.textContent = 'Cancelled workshops cannot accept registrations.';
            warning.style.display = 'block';
        } else {
            warning.style.display = 'none';
        }
    };
}

// Change status
async function changeStatus(event) {
    event.preventDefault();

    try {
        const workshopId = document.getElementById('statusWorkshopId').value;
        const newStatus = document.getElementById('newStatus').value;

        if (!newStatus) {
            showError('Please select a status');
            return;
        }

        const response = await fetch(`/api/admin/workshops/${workshopId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        });

        const result = await response.json();

        if (result.success) {
            showSuccess('Workshop status updated successfully');
            closeStatusModal();
            loadWorkshops();
        } else {
            showError(result.message || 'Failed to update status');
        }
    } catch (error) {
        console.error('Error updating status:', error);
        showError('Error updating status. Please try again.');
    }
}

// Close status modal
function closeStatusModal() {
    document.getElementById('statusModal').style.display = 'none';
}

// Delete workshop
async function deleteWorkshop(id, registrationCount) {
    if (registrationCount > 0) {
        showError('Cannot delete workshop with existing registrations');
        return;
    }

    const workshop = currentWorkshops.find(w => w._id === id);
    if (!confirm(`Are you sure you want to delete "${workshop.title}"? This action cannot be undone.`)) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/workshops/${id}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
            showSuccess('Workshop deleted successfully');
            loadWorkshops();
        } else {
            showError(result.message || 'Failed to delete workshop');
        }
    } catch (error) {
        console.error('Error deleting workshop:', error);
        showError('Error deleting workshop. Please try again.');
    }
}

// View registrations for workshop
function viewRegistrations(id) {
    window.location.href = `/admin-dashboard?workshopId=${id}`;
}

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showSuccess(message) {
    alert('✅ ' + message);
}

function showError(message) {
    alert('❌ ' + message);
}

// Select workshop for Excel download
window.selectWorkshop = function(workshopId) {
    selectedWorkshopId = workshopId;
    console.log('Selected workshop:', workshopId);
}

// Toggle download menu
window.toggleDownloadMenu = function() {
    const menu = document.getElementById('downloadMenu');
    if (menu) {
        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    }
}

// Close download menu when clicking outside
document.addEventListener('click', function(event) {
    const menu = document.getElementById('downloadMenu');
    const isClickInside = event.target.closest('.filter-group') && event.target.closest('.filter-group').querySelector('#downloadMenu');
    if (!isClickInside && menu) {
        menu.style.display = 'none';
    }
});

// Column selection modal functions
function showColumnModal() {
    // Hide download menu
    const menu = document.getElementById('downloadMenu');
    if (menu) menu.style.display = 'none';
    
    const modal = document.getElementById('columnModal');
    const checkboxContainer = document.getElementById('columnCheckboxes');
    
    // Clear previous checkboxes
    checkboxContainer.innerHTML = '';
    
    // Create checkboxes for each column
    availableColumns.forEach(col => {
        const label = document.createElement('label');
        label.style.cssText = 'display: flex; align-items: center; padding: 10px; cursor: pointer; border-radius: 6px; margin-bottom: 6px; transition: background 0.2s;';
        label.onmouseover = () => label.style.background = '#f1f5f9';
        label.onmouseout = () => label.style.background = 'transparent';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = col.id;
        checkbox.checked = selectedColumns.includes(col.id) || selectedColumns.length === 0;
        checkbox.style.cssText = 'margin-right: 10px; width: 18px; height: 18px; cursor: pointer;';
        checkbox.onchange = updateSelectedColumns;
        
        const span = document.createElement('span');
        span.textContent = col.label;
        span.style.color = '#334155';
        
        label.appendChild(checkbox);
        label.appendChild(span);
        checkboxContainer.appendChild(label);
    });
    
    // Initialize if empty
    if (selectedColumns.length === 0) {
        selectedColumns = availableColumns.map(col => col.id);
    }
    
    modal.style.display = 'block';
}

function closeColumnModal() {
    document.getElementById('columnModal').style.display = 'none';
}

function toggleAllColumns() {
    const selectAll = document.getElementById('selectAllColumns').checked;
    const checkboxes = document.querySelectorAll('#columnCheckboxes input[type="checkbox"]');
    
    checkboxes.forEach(cb => {
        cb.checked = selectAll;
    });
    
    updateSelectedColumns();
}

function updateSelectedColumns() {
    const checkboxes = document.querySelectorAll('#columnCheckboxes input[type="checkbox"]');
    selectedColumns = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);
    
    // Update "Select All" checkbox state
    const selectAllCheckbox = document.getElementById('selectAllColumns');
    selectAllCheckbox.checked = selectedColumns.length === availableColumns.length;
}

function confirmColumnSelection() {
    if (selectedColumns.length === 0) {
        alert('Please select at least one column');
        return;
    }
    closeColumnModal();
    downloadExcelWithColumns();
}

async function downloadExcel() {
    // Hide download menu
    const menu = document.getElementById('downloadMenu');
    if (menu) menu.style.display = 'none';
    
    if (!selectedWorkshopId) {
        alert('⚠️ Please select a workshop first by clicking the radio button');
        return;
    }
    // Download all columns
    selectedColumns = availableColumns.map(col => col.id);
    await downloadExcelWithColumns();
}

async function downloadExcelWithColumns() {
    if (!selectedWorkshopId) {
        alert('⚠️ Please select a workshop first by clicking the radio button');
        return;
    }
    
    try {
        const url = '/api/admin/export-excel?columns=' + selectedColumns.join(',') + '&workshopId=' + selectedWorkshopId;
        
        const response = await fetch(url);
        
        if (response.ok) {
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            
            // Find workshop name for filename
            const workshop = currentWorkshops.find(w => w._id === selectedWorkshopId);
            const workshopName = workshop ? workshop.title.replace(/[^a-z0-9]/gi, '-') : 'workshop';
            a.download = `${workshopName}-registrations-${new Date().toISOString().split('T')[0]}.xlsx`;
            
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(downloadUrl);
            
            showSuccess('Excel downloaded successfully!');
        } else {
            showError('Failed to download Excel');
        }
    } catch (error) {
        console.error('Error downloading Excel:', error);
        showError('Error downloading Excel');
    }
}

// Close modals when clicking outside
window.onclick = function(event) {
    const modals = ['workshopModal', 'qrUploadModal', 'statusModal', 'columnModal'];
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
}
