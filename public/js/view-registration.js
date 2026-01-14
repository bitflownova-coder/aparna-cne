// View Registration Handler
let currentRegistration = null;

// Check URL parameters
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const mncUID = urlParams.get('mncUID');
    
    if (mncUID) {
        document.getElementById('mncUID').value = mncUID;
    }

    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    const lookupForm = document.getElementById('lookupForm');
    const downloadBtn = document.getElementById('downloadBtn');
    const backBtn = document.getElementById('backBtn');
    const mobileInput = document.getElementById('mobileNumber');

    lookupForm.addEventListener('submit', handleLookup);
    downloadBtn.addEventListener('click', handleDownload);
    backBtn.addEventListener('click', showLookupForm);

    // Mobile number validation
    mobileInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[^0-9]/g, '');
    });
}

// Quick auto-fill function
async function quickAutoFill() {
    const input = document.getElementById('quickLookupInput');
    const value = input.value.trim();
    const roman = document.getElementById('quickLookupRegRoman').value;
    const number = document.getElementById('quickLookupRegNumber').value;
    
    // Check if either MNC UID or Registration Number is provided
    let lookupValue = value;
    if (!value && roman && number) {
        lookupValue = `${roman}-${number}`;
    }
    
    if (!lookupValue) {
        showAlert('Please enter MNC UID or Registration Number', 'error');
        input.focus();
        return;
    }

    try {
        const response = await fetch('/api/mnc/lookup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mncUID: value || '', mncRegistrationNumber: lookupValue })
        });
        
        const result = await response.json();
        
        if (result.success && result.found) {
            const d = result.data;
            // Auto-fill fields
            if(d.mncUID) document.getElementById('mncUID').value = d.mncUID;
            if(d.mobileNumber) document.getElementById('mobileNumber').value = d.mobileNumber;
            
            showAlert('✅ Details found and auto-filled!', 'success');
        } else {
            showAlert('No previous records found. Please fill manually.', 'info');
        }
    } catch (e) {
        console.error(e);
        showAlert('Error checking details.', 'error');
    }
}

// Handle lookup form submission
async function handleLookup(e) {
    e.preventDefault();

    const mncUID = document.getElementById('mncUID').value.trim();
    const mobileNumber = document.getElementById('mobileNumber').value.trim();

    if (!mncUID || !mobileNumber) {
        showAlert('Please enter both MNC UID and Mobile Number', 'error');
        return;
    }

    if (!/^[0-9]{10}$/.test(mobileNumber)) {
        showAlert('Please enter a valid 10-digit mobile number', 'error');
        return;
    }

    showSpinner(true);

    try {
        const response = await fetch('/api/registration/view', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ mncUID, mobileNumber })
        });

        const data = await response.json();
        showSpinner(false);

        if (data.success) {
            // Handle multiple registrations (newest first)
            if (Array.isArray(data.data)) {
                showAllRegistrations(data.data);
            } else {
                // Fallback for single registration (backward compatibility)
                currentRegistration = data.data;
                showRegistrationDetails(data.data);
            }
        } else {
            showAlert(data.message || 'No registration found with these details', 'error');
        }
    } catch (error) {
        console.error('Lookup error:', error);
        showSpinner(false);
        showAlert('Network error. Please try again.', 'error');
    }
}

// Show all registrations (newest first)
function showAllRegistrations(registrations) {
    const detailsDiv = document.getElementById('registrationDetails');
    
    let html = '';
    
    if (registrations.length > 1) {
        html += `<div style="background: #e0f2fe; padding: 12px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
            <strong>✅ Found ${registrations.length} registrations</strong> (showing newest first)
        </div>`;
    }
    
    registrations.forEach((data, index) => {
        const submittedDate = new Date(data.submittedAt).toLocaleString('en-IN', {
            dateStyle: 'long',
            timeStyle: 'short'
        });
        
        const remainingDownloads = 2 - data.downloadCount;
        const isNewest = index === 0;
        
        html += `
            <div style="background: white; border-radius: 12px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); ${isNewest ? 'border: 3px solid #10b981;' : ''}">
                ${isNewest ? '<div style="background: #10b981; color: white; padding: 6px 12px; border-radius: 6px; display: inline-block; margin-bottom: 12px; font-weight: 600;">📌 Latest Registration</div>' : ''}
                ${data.workshop ? `<h3 style="color: #667eea; margin-bottom: 16px;">🎓 ${data.workshop.title}</h3>` : ''}
                
                <div class="review-details">
                    <div class="review-item">
                        <strong>Form Number</strong>
                        <span>${data.formNumber || 'N/A'}</span>
                    </div>
                    <div class="review-item">
                        <strong>Full Name</strong>
                        <span>${data.fullName}</span>
                    </div>
                    <div class="review-item">
                        <strong>MNC UID</strong>
                        <span>${data.mncUID}</span>
                    </div>
                    <div class="review-item">
                        <strong>MNC Registration Number</strong>
                        <span>${data.mncRegistrationNumber}</span>
                    </div>
                    <div class="review-item">
                        <strong>Mobile Number</strong>
                        <span>${data.mobileNumber}</span>
                    </div>
                    <div class="review-item">
                        <strong>Payment UTR / Transaction ID</strong>
                        <span>${data.paymentUTR}</span>
                    </div>
                    <div class="review-item">
                        <strong>Submitted At</strong>
                        <span>${submittedDate}</span>
                    </div>
                    ${data.workshop ? `
                    <div class="review-item">
                        <strong>Workshop Date</strong>
                        <span>${new Date(data.workshop.date).toLocaleDateString('en-IN', { dateStyle: 'long' })}</span>
                    </div>
                    <div class="review-item">
                        <strong>Venue</strong>
                        <span>${data.workshop.venue}</span>
                    </div>` : ''}
                    <div class="review-item">
                        <strong>Payment Screenshot</strong>
                        <span><img src="/uploads/payments/${data.paymentScreenshot}" style="max-width: 300px; border-radius: 8px; margin-top: 10px;" alt="Payment Screenshot"></span>
                    </div>
                    <div class="review-item">
                        <strong>Download Status</strong>
                        <span style="color: ${remainingDownloads > 0 ? '#10b981' : '#ef4444'}; font-weight: 600;">
                            ${remainingDownloads > 0 ? `📥 ${remainingDownloads}/2 downloads remaining` : '❌ Limit reached (2/2)'}
                        </span>
                    </div>
                </div>
                
                <div style="display: flex; gap: 10px; margin-top: 16px;">
                    <button class="btn btn-primary" ${remainingDownloads <= 0 ? 'disabled' : ''} 
                        onclick="downloadRegistration(${index})" 
                        style="flex: 1; ${remainingDownloads <= 0 ? 'opacity: 0.5; cursor: not-allowed;' : ''}">
                        ${remainingDownloads > 0 ? '📄 Download PDF' : '❌ Download Limit Reached'}
                    </button>
                    <button class="btn" onclick="deleteRegistration('${data._id}')" 
                        style="background: #ef4444; color: white; padding: 10px 16px;">
                        🗑️ Delete
                    </button>
                </div>
            </div>
        `;
    });
    
    detailsDiv.innerHTML = html;
    
    // Store all registrations globally
    window.allRegistrations = registrations;
    
    // Set the first (newest) as current
    currentRegistration = registrations[0];
    
    // Hide download info section (now shown in each card)
    const downloadInfo = document.getElementById('downloadInfo');
    const downloadBtn = document.getElementById('downloadBtn');
    if (downloadInfo) downloadInfo.style.display = 'none';
    if (downloadBtn) downloadBtn.style.display = 'none';
    
    // Show the results card
    document.getElementById('lookupCard').style.display = 'none';
    document.getElementById('detailsCard').style.display = 'block';
}

// Download specific registration
function downloadRegistration(index) {
    const registration = window.allRegistrations[index];
    currentRegistration = registration;
    handleDownload();
}

// Show registration details
function showRegistrationDetails(data) {
    const detailsDiv = document.getElementById('registrationDetails');
    
    const submittedDate = new Date(data.submittedAt).toLocaleString('en-IN', {
        dateStyle: 'long',
        timeStyle: 'short'
    });

    detailsDiv.innerHTML = `
        <div class="review-details">
            <div class="review-item">
                <strong>Form Number</strong>
                <span>${data.formNumber || 'N/A'}</span>
            </div>
            <div class="review-item">
                <strong>Full Name</strong>
                <span>${data.fullName}</span>
            </div>
            <div class="review-item">
                <strong>MNC UID</strong>
                <span>${data.mncUID}</span>
            </div>
            <div class="review-item">
                <strong>MNC Registration Number</strong>
                <span>${data.mncRegistrationNumber}</span>
            </div>
            <div class="review-item">
                <strong>Mobile Number</strong>
                <span>${data.mobileNumber}</span>
            </div>
            <div class="review-item">
                <strong>Payment UTR / Transaction ID</strong>
                <span>${data.paymentUTR}</span>
            </div>
            <div class="review-item">
                <strong>Submitted At</strong>
                <span>${submittedDate}</span>
            </div>
            <div class="review-item">
                <strong>Payment Screenshot</strong>
                <span><img src="/uploads/payments/${data.paymentScreenshot}" style="max-width: 300px; border-radius: 8px; margin-top: 10px;" alt="Payment Screenshot"></span>
            </div>
        </div>
    `;

    // Update download info
    const downloadInfo = document.getElementById('downloadInfo');
    const remainingDownloads = 2 - data.downloadCount;
    
    if (remainingDownloads > 0) {
        downloadInfo.innerHTML = `<p>📥 Downloads remaining: ${remainingDownloads}/2</p>`;
        document.getElementById('downloadBtn').disabled = false;
    } else {
        downloadInfo.innerHTML = `<p style="color: var(--error-color);">❌ Download limit reached (2/2). You can still view your details here anytime.</p>`;
        document.getElementById('downloadBtn').disabled = true;
    }

    // Hide lookup form, show details
    document.getElementById('lookupCard').style.display = 'none';
    document.getElementById('detailsCard').style.display = 'block';

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Show lookup form
function showLookupForm() {
    document.getElementById('lookupCard').style.display = 'block';
    document.getElementById('detailsCard').style.display = 'none';
    currentRegistration = null;
    
    // Clear form
    document.getElementById('lookupForm').reset();
}

// Handle PDF download
async function handleDownload() {
    if (!currentRegistration) {
        showAlert('No registration data found', 'error');
        return;
    }

    if (currentRegistration.downloadCount >= 2) {
        showAlert('Download limit reached. You have already downloaded 2 times.', 'error');
        return;
    }

    const proceed = confirm('Please confirm you will print and carry this form to the workshop. Continue to download PDF?');
    if (!proceed) {
        return;
    }

    try {
        // Increment download count first
        const response = await fetch('/api/registration/download', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                mncUID: currentRegistration.mncUID,
                mobileNumber: currentRegistration.mobileNumber
            })
        });

        const data = await response.json();

        if (data.success) {
            // Update local download count
            currentRegistration.downloadCount = data.downloadCount;
            
            // Generate PDF
            await generatePDF();

            // Update download info
            const remainingDownloads = 2 - data.downloadCount;
            const downloadInfo = document.getElementById('downloadInfo');
            
            if (remainingDownloads > 0) {
                downloadInfo.innerHTML = `<p>📥 Downloads remaining: ${remainingDownloads}/2</p>`;
            } else {
                downloadInfo.innerHTML = `<p style="color: var(--error-color);">❌ Download limit reached (2/2). You can still view your details here anytime.</p>`;
                document.getElementById('downloadBtn').disabled = true;
            }

            showAlert('PDF downloaded successfully!', 'success');
        } else {
            showAlert(data.message || 'Download failed', 'error');
        }
    } catch (error) {
        console.error('Download error:', error);
        showAlert('Download failed. Please try again.', 'error');
    }
}

// Generate PDF
async function generatePDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const submittedDate = new Date(currentRegistration.submittedAt).toLocaleString('en-IN', {
        dateStyle: 'long',
        timeStyle: 'short'
    });

    // Header
    doc.setFontSize(18);
    doc.setTextColor(95, 37, 159);
    doc.text('SAI CARE GROUP OF INSTITUTES', 105, 20, { align: 'center' });
    
    doc.setFontSize(14);
    doc.text('CNE Registration 2025', 105, 30, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`Form Number: ${currentRegistration.formNumber || 'N/A'}`, 105, 38, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text('Registration Confirmation', 105, 40, { align: 'center' });

    // Draw line
    doc.setDrawColor(95, 37, 159);
    doc.setLineWidth(0.5);
    doc.line(20, 45, 190, 45);

    let yPos = 60;

    // Registration Details
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    
    // Full Name
    doc.text('Full Name:', 20, yPos);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.text(currentRegistration.fullName, 70, yPos);
    yPos += 15;

    // MNC UID
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('MNC UID:', 20, yPos);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.text(currentRegistration.mncUID, 70, yPos);
    yPos += 15;

    // MNC Registration Number
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('MNC Registration Number:', 20, yPos);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.text(currentRegistration.mncRegistrationNumber, 70, yPos);
    yPos += 15;

    // Mobile Number
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('Mobile Number:', 20, yPos);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.text(currentRegistration.mobileNumber, 70, yPos);
    yPos += 15;

    // Payment UTR
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('Payment UTR / Transaction ID:', 20, yPos);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.text(currentRegistration.paymentUTR, 70, yPos);
    yPos += 15;

    // Submitted At
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('Submitted At:', 20, yPos);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.text(submittedDate, 70, yPos);
    yPos += 20;

    // Payment Screenshot
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('Payment Screenshot:', 20, yPos);
    yPos += 10;

    try {
        // Add payment screenshot image
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.src = `/uploads/payments/${currentRegistration.paymentScreenshot}`;
        
        await new Promise((resolve, reject) => {
            img.onload = () => {
                const imgWidth = 80;
                const imgHeight = (img.height * imgWidth) / img.width;
                
                doc.addImage(img, 'JPEG', 20, yPos, imgWidth, imgHeight);
                yPos += imgHeight + 20;
                resolve();
            };
            img.onerror = () => {
                doc.setFontSize(9);
                doc.setTextColor(200, 0, 0);
                doc.text('Screenshot not available', 20, yPos);
                yPos += 20;
                resolve();
            };
        });
    } catch (error) {
        console.error('Error adding image:', error);
    }

    // Disclaimer
    if (yPos > 240) {
        doc.addPage();
        yPos = 20;
    }

    doc.setDrawColor(245, 158, 11);
    doc.setLineWidth(0.5);
    doc.line(20, yPos, 190, yPos);
    yPos += 10;

    doc.setFontSize(10);
    doc.setTextColor(146, 64, 14);
    doc.text('IMPORTANT DISCLAIMER:', 20, yPos);
    yPos += 8;

    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    const disclaimerText = 'If MNC Registration Number or MNC UID is incorrect, we are NOT liable for credits not being added to your account.';
    const splitDisclaimer = doc.splitTextToSize(disclaimerText, 170);
    doc.text(splitDisclaimer, 20, yPos);
    yPos += (splitDisclaimer.length * 5) + 10;

    const printNote = 'Please print this form and carry it along with payment proof to the workshop entrance.';
    const splitPrintNote = doc.splitTextToSize(printNote, 170);
    doc.text(splitPrintNote, 20, yPos);
    yPos += (splitPrintNote.length * 5) + 10;

    doc.setDrawColor(245, 158, 11);
    doc.line(20, yPos, 190, yPos);

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('© 2025 Sai Care Group of Institutes. All rights reserved.', 105, 285, { align: 'center' });

    // Save PDF
    doc.save(`CNE_Registration_${currentRegistration.mncUID}.pdf`);
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
    
    // Auto hide after 5 seconds
    setTimeout(() => {
        alert.classList.remove('show');
    }, 5000);

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Delete registration
async function deleteRegistration(registrationId) {
    if (!confirm('Are you sure you want to delete this registration? This action cannot be undone.')) {
        return;
    }

    // Double confirmation
    const confirmText = prompt('Please type "DELETE" to confirm deletion:');
    if (confirmText !== 'DELETE') {
        showAlert('Deletion cancelled', 'info');
        return;
    }

    showSpinner(true);

    try {
        const response = await fetch(`/api/registration/${registrationId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        showSpinner(false);

        if (data.success) {
            showAlert('Registration deleted successfully', 'success');
            // Go back to lookup form
            setTimeout(() => {
                showLookupForm();
            }, 2000);
        } else {
            showAlert(data.message || 'Failed to delete registration', 'error');
        }
    } catch (error) {
        console.error('Delete error:', error);
        showSpinner(false);
        showAlert('Failed to delete registration. Please try again.', 'error');
    }
}
