// Bulk Upload JavaScript
let selectedFile = null;

document.addEventListener('DOMContentLoaded', () => {
    checkSession();
    setupDragAndDrop();
});

// Check if user is authenticated
async function checkSession() {
    try {
        const response = await fetch('/api/admin/check-session');
        const data = await response.json();
        
        if (!data.success || (!data.isAdmin && !data.isUser)) {
            window.location.href = '/admin-login';
        }
    } catch (error) {
        console.error('Session check error:', error);
        window.location.href = '/admin-login';
    }
}

// Setup drag and drop
function setupDragAndDrop() {
    const uploadArea = document.getElementById('uploadArea');
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => {
            uploadArea.classList.add('dragover');
        }, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => {
            uploadArea.classList.remove('dragover');
        }, false);
    });
    
    uploadArea.addEventListener('drop', handleDrop, false);
}

// Handle drop
function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    
    if (files.length > 0) {
        handleFile(files[0]);
    }
}

// Handle file select
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        handleFile(file);
    }
}

// Handle file
function handleFile(file) {
    // Validate file type
    const validTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls)$/i)) {
        showAlert('Please upload a valid Excel file (.xlsx or .xls)', 'error');
        return;
    }
    
    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
        showAlert('File size must be less than 10MB', 'error');
        return;
    }
    
    selectedFile = file;
    
    // Display file info
    document.getElementById('fileName').textContent = file.name;
    document.getElementById('fileSize').textContent = formatFileSize(file.size);
    document.getElementById('selectedFile').classList.add('show');
}

// Clear file
function clearFile() {
    selectedFile = null;
    document.getElementById('fileInput').value = '';
    document.getElementById('selectedFile').classList.remove('show');
}

// Upload file
async function uploadFile() {
    if (!selectedFile) {
        showAlert('Please select a file first', 'error');
        return;
    }
    
    const uploadBtn = document.getElementById('uploadBtn');
    uploadBtn.disabled = true;
    uploadBtn.textContent = '? Processing...';
    
    showSpinner(true);
    
    try {
        const formData = new FormData();
        formData.append('file', selectedFile);
        
        const response = await fetch('/api/admin/bulk-upload', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert(data.message, 'success');
            displayResults(data.results);
            clearFile();
        } else {
            showAlert(data.message || 'Error processing file', 'error');
        }
    } catch (error) {
        console.error('Upload error:', error);
        showAlert('Error uploading file. Please try again.', 'error');
    } finally {
        showSpinner(false);
        uploadBtn.disabled = false;
        uploadBtn.textContent = '?? Upload and Process';
    }
}

// Display results
function displayResults(results) {
    const resultsSection = document.getElementById('resultsSection');
    const successCount = document.getElementById('successCount');
    const failedCount = document.getElementById('failedCount');
    const resultsDetails = document.getElementById('resultsDetails');
    
    successCount.textContent = results.success.length;
    failedCount.textContent = results.failed.length;
    
    let detailsHTML = '';
    
    // Success table
    if (results.success.length > 0) {
        detailsHTML += `
            <div style="margin-bottom: 30px;">
                <h3 style="color: #28a745; margin-bottom: 15px;">? Successfully Registered (${results.success.length})</h3>
                <div class="results-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Row #</th>
                                <th>Form Number</th>
                                <th>Name</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${results.success.map(item => `
                                <tr>
                                    <td>${item.row}</td>
                                    <td><strong>#${item.formNumber}</strong></td>
                                    <td>${escapeHtml(item.name)}</td>
                                    <td><span class="status-icon">?</span> Success</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
    
    // Failed table
    if (results.failed.length > 0) {
        detailsHTML += `
            <div>
                <h3 style="color: #dc3545; margin-bottom: 15px;">? Failed to Register (${results.failed.length})</h3>
                <div class="results-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Row #</th>
                                <th>Name</th>
                                <th>MNC UID</th>
                                <th>Reason</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${results.failed.map(item => `
                                <tr>
                                    <td>${item.row}</td>
                                    <td>${item.data ? escapeHtml(item.data['Full Name'] || 'N/A') : 'N/A'}</td>
                                    <td>${item.data ? escapeHtml(item.data['MNC UID'] || 'N/A') : 'N/A'}</td>
                                    <td style="color: #dc3545;"><span class="status-icon">?</span> ${escapeHtml(item.reason)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
    
    resultsDetails.innerHTML = detailsHTML;
    resultsSection.classList.add('show');
    
    // Scroll to results
    setTimeout(() => {
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}

// Reset upload
function resetUpload() {
    clearFile();
    document.getElementById('resultsSection').classList.remove('show');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
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
