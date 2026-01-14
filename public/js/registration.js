// MNC Lookup functionality
async function lookupMNC() {
    const lookupInput = document.getElementById('lookupMncUID');
    const lookupValue = lookupInput.value.trim();
    
    if (!lookupValue) {
        showAlert('Please enter MNC UID or MNC Registration Number', 'error');
        return;
    }
    
    const lookupBtn = document.getElementById('lookupBtn');
    lookupBtn.disabled = true;
    lookupBtn.textContent = 'Looking up...';
    
    try {
        const response = await fetch('/api/mnc/lookup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                mncUID: lookupValue,
                mncRegistrationNumber: lookupValue
            })
        });
        
        const data = await response.json();
        
        if (data.success && data.found) {
            // Auto-fill the form
            document.getElementById('fullName').value = data.data.fullName || '';
            document.getElementById('mncUID').value = data.data.mncUID || '';
            
            // Split and auto-fill registration number
            if (data.data.mncRegistrationNumber) {
                const regNum = data.data.mncRegistrationNumber;
                const parts = regNum.split('-');
                if (parts.length === 2) {
                    document.getElementById('mncRegRoman').value = parts[0];
                    document.getElementById('mncRegNumber').value = parts[1];
                }
                document.getElementById('mncRegistrationNumber').value = regNum;
            }
            
            document.getElementById('mobileNumber').value = data.data.mobileNumber || '';
            if (data.data.address) {
                document.getElementById('address').value = data.data.address;
            }
            
            showAlert('✅ Details found and auto-filled! Please verify and update if needed.', 'success');
            
            // Scroll to form
            setTimeout(() => {
                const formSection = document.getElementById('formSection');
                // Ensure form section is visible if we are autofilling (though technically they should select workshop first)
                // If the user hasn't selected a workshop, we can't really scroll to form as it might be hidden.
                // But typically users might lookup first? 
                // In new design, form is hidden until workshop selected. 
                // We should probably tell them to select a workshop now.
                if (formSection.classList.contains('show')) {
                     formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                } else {
                     showAlert('Details loaded. Please select a workshop to proceed.', 'success');
                }
            }, 500);
        } else {
            showAlert('No previous registration found with this MNC UID/Registration Number. Please fill the form manually.', 'info');
        }
    } catch (error) {
        console.error('Lookup error:', error);
        showAlert('Error looking up details. Please try again.', 'error');
    } finally {
        lookupBtn.disabled = false;
        lookupBtn.textContent = 'Auto-fill Form';
    }
}

// New Lookup Function for Integrated Form
async function performLookup() {
    const input = document.getElementById('lookupInput');
    const value = input.value.trim();
    const roman = document.getElementById('lookupRegRoman').value;
    const number = document.getElementById('lookupRegNumber').value;
    const btn = document.querySelector('.btn-check');
    
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

    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Checking...';

    try {
        const response = await fetch('/api/mnc/lookup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mncUID: value || '', mncRegistrationNumber: lookupValue })
        });
        
        const result = await response.json();
        
        if (result.success && result.found) {
            const d = result.data;
            // Auto-fill all comprehensive fields
            if(d.fullName) document.getElementById('fullName').value = d.fullName;
            if(d.mncUID) document.getElementById('mncUID').value = d.mncUID;
            if(d.mncRegistrationNumber) {
                // Split the registration number into Roman and digits
                const regNum = d.mncRegistrationNumber;
                const parts = regNum.split('-');
                if (parts.length === 2) {
                    document.getElementById('mncRegRoman').value = parts[0];
                    document.getElementById('mncRegNumber').value = parts[1];
                    document.getElementById('mncRegistrationNumber').value = regNum;
                } else {
                    document.getElementById('mncRegistrationNumber').value = regNum;
                }
            }
            if(d.mobileNumber) document.getElementById('mobileNumber').value = d.mobileNumber;
            if(d.email) document.getElementById('email').value = d.email;
            if(d.dateOfBirth) document.getElementById('dateOfBirth').value = d.dateOfBirth;
            if(d.gender) document.getElementById('gender').value = d.gender;
            if(d.qualification) document.getElementById('qualification').value = d.qualification;
            if(d.organization) document.getElementById('organization').value = d.organization;
            if(d.experience) document.getElementById('experience').value = d.experience;
            if(d.address) document.getElementById('address').value = d.address;
            if(d.city) document.getElementById('city').value = d.city;
            if(d.state) document.getElementById('state').value = d.state;
            if(d.pinCode) document.getElementById('pinCode').value = d.pinCode;
            
            showAlert('✅ All details found and auto-filled! Please verify before submitting.', 'success');
        } else {
            showAlert('⚠️ No previous records found. Please fill all the details mentioned below.', 'warning');
        }
    } catch (e) {
        console.error(e);
        showAlert('Error checking details.', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

// Registration Form Handler
let formData = null;
let currentWorkshop = null;
let allWorkshops = [];

// Load workshops and setup
document.addEventListener('DOMContentLoaded', () => {
    loadAllWorkshops();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    const form = document.getElementById('registrationForm');
    const fileInput = document.getElementById('paymentScreenshot');
    const mobileInput = document.getElementById('mobileNumber');
    const cancelBtn = document.getElementById('cancelBtn');
    const confirmBtn = document.getElementById('confirmBtn');
    
    // MNC Registration Number combination
    const mncRegRoman = document.getElementById('mncRegRoman');
    const mncRegNumber = document.getElementById('mncRegNumber');
    const mncRegistrationNumber = document.getElementById('mncRegistrationNumber');
    
    function updateMncRegistrationNumber() {
        const roman = mncRegRoman.value;
        const number = mncRegNumber.value;
        if (roman && number) {
            mncRegistrationNumber.value = `${roman}-${number}`;
        } else {
            mncRegistrationNumber.value = '';
        }
    }
    
    if (mncRegRoman) mncRegRoman.addEventListener('change', updateMncRegistrationNumber);
    if (mncRegNumber) {
        mncRegNumber.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
            updateMncRegistrationNumber();
        });
    }

    // Form submission
    if (form) form.addEventListener('submit', handleFormSubmit);

    // File input change
    if (fileInput) fileInput.addEventListener('change', handleFileChange);

    // Mobile number validation
    if (mobileInput) {
        mobileInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
        });
    }

    // Modal buttons
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    if (confirmBtn) confirmBtn.addEventListener('click', confirmSubmission);
}

// Load all workshops
async function loadAllWorkshops() {
    try {
        let workshops = [];
        let errors = [];

        // Try getting all workshops from the list endpoint first (preferred)
        try {
            const response = await fetch('/api/workshop');
            if (response.ok) {
                const result = await response.json();
                if (result.success && Array.isArray(result.data)) {
                    workshops = result.data;
                }
            } else {
                errors.push(`Main list endpoint failed: ${response.status}`);
            }
        } catch (e) {
            errors.push(e.message);
        }

        // If that failed or returned nothing, try the specific endpoints (legacy/robustness)
        if (workshops.length === 0) {
            try {
                const [activeRes, upcomingRes] = await Promise.all([
                    fetch('/api/workshop/active'),
                    fetch('/api/workshop/upcoming')
                ]);

                if (activeRes.ok) {
                    const activeData = await activeRes.json();
                    if (activeData.success && activeData.data) {
                        // Ensure we don't duplicate if it's already in the list
                        workshops.push(activeData.data);
                    }
                }

                if (upcomingRes.ok) {
                    const upcomingData = await upcomingRes.json();
                    if (upcomingData.success && Array.isArray(upcomingData.data)) {
                        workshops = workshops.concat(upcomingData.data);
                    }
                }
            } catch (e) {
                console.error("Fallback fetch failed", e);
            }
        }

        // Remove duplicates based on _id
        const uniqueWorkshops = Array.from(new Map(workshops.map(item => [item._id, item])).values());
        
        allWorkshops = uniqueWorkshops.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // Show list or empty state
        displayWorkshopsList();

    } catch (error) {
        console.error('Error loading workshops:', error);
        document.getElementById('workshopsContainer').innerHTML = `
            <div style="text-align: center; padding: 40px 20px;">
                <h3 style="color: var(--text-light);">Unable to Load Workshops</h3>
                <p style="color: var(--danger);">Please try again later. (Make sure you have started the server)</p>
            </div>
        `;
    }
}

// Display workshops list
function displayWorkshopsList() {
    const container = document.getElementById('workshopsContainer');
    
    if (allWorkshops.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 4rem 2rem; background: #f9fafb; border-radius: 8px;">
                <div style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;">📚</div>
                <h3 style="color: var(--text-main); margin-bottom: 0.5rem;">No Workshops Currently Available</h3>
                <p style="color: var(--text-light);">Please check back later for upcoming CNE sessions.</p>
            </div>
        `;
        return;
    }

    let html = '<div class="workshop-grid">';

    allWorkshops.forEach(workshop => {
        const date = new Date(workshop.date);
        const dateStr = date.toLocaleDateString('en-IN', { 
            weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' 
        });

        const seatsLeft = workshop.maxSeats - (workshop.currentRegistrations || 0); // Handle undefined count
        const percentFilled = Math.min(100, ((workshop.currentRegistrations || 0) / workshop.maxSeats) * 100);
        const isOpen = workshop.status === 'active' && seatsLeft > 0;
        
        html += `
            <div class="workshop-item">
                <div class="workshop-top">
                    <span style="font-weight: 700; color: var(--text-light); font-size: 0.9rem;">${dateStr}</span>
                    <span class="status-badge ${isOpen ? 'status-open' : 'status-full'}">
                        ${isOpen ? 'Registration Open' : 'Full / Closed'}
                    </span>
                </div>
                <div class="workshop-body">
                    <!-- Highlighted Venue Display -->
                    <div style="background: #eff6ff; color: #1e3a8a; padding: 10px 12px; border-radius: 6px; margin-bottom: 1rem; font-size: 0.95rem; font-weight: 600; display: flex; align-items: start; gap: 8px; border: 1px solid #dbeafe;">
                        <span style="font-size: 1.1rem;">📍</span>
                        <span style="line-height: 1.4;">${escapeHtml(workshop.venue)}</span>
                    </div>

                    <h3 class="workshop-name">${escapeHtml(workshop.title)}</h3>
                    
                    <div class="info-row">
                        <span class="info-label">💰 Fee</span>
                        <span class="info-value">₹${workshop.fee}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">🎓 Credits</span>
                        <span class="info-value">${workshop.credits} Credits</span>
                    </div>

                    <div class="seats-bar-container">
                        <div class="seats-bar" style="width: ${percentFilled}%;"></div>
                    </div>
                    <div style="text-align: right; font-size: 0.85rem; color: var(--text-light); margin-bottom: 1rem;">
                        <strong>${seatsLeft}</strong> spots left
                    </div>

                    <button class="btn-register" onclick="selectWorkshop('${workshop._id}')" ${!isOpen ? 'disabled' : ''}>
                        ${isOpen ? 'Register Now' : 'Registration Closed'}
                    </button>
                    
                    ${!isOpen ? `<div style="text-align: center; margin-top: 0.5rem; font-size: 0.8rem; color: var(--danger);">Top Tip: Check back for cancellations or new dates.</div>` : ''}
                </div>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
}

// Select workshop
function selectWorkshop(workshopId) {
    const workshop = allWorkshops.find(w => w._id === workshopId);
    if (!workshop) return;

    if (workshop.status !== 'active' || (workshop.maxSeats - (workshop.currentRegistrations || 0)) <= 0) {
        showAlert('This workshop is currently not accepting registrations.', 'error');
        return;
    }

    currentWorkshop = workshop;

    // Update form context
    const formTitle = document.getElementById('formTitle');
    if (formTitle) {
        formTitle.innerHTML = `📝 Registering for: <span style="color:#fbbf24">${escapeHtml(workshop.title)}</span>`;
    }

    // Show form with animation
    const section = document.getElementById('formSection');
    section.classList.add('show');
    
    // Smooth scroll
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Handle form submission
function handleFormSubmit(e) {
    e.preventDefault();
    if (!currentWorkshop) {
        showAlert('Please select a workshop first.', 'error');
        return;
    }
    
    // Check if a workshop is actually selected/available before proceeding
    if (currentWorkshop.status !== 'active' || (currentWorkshop.maxSeats - (currentWorkshop.currentRegistrations || 0)) <= 0) {
        showAlert('Registration for this workshop is closed.', 'error');
        return;
    }

    // Get form data
    const form = e.target;
    formData = new FormData(form);
    formData.append('workshopId', currentWorkshop._id); // Add workshop ID
    
    showReviewModal(formData);
}

// Show review modal
function showReviewModal(formData) {
    const modal = document.getElementById('confirmationModal');
    const reviewDetails = document.getElementById('reviewDetails');
    
    let html = '';
    
    // Helper to display review item
    const addItem = (label, value) => `
        <div class="review-item">
            <strong>${label}:</strong>
            <span>${escapeHtml(value)}</span>
        </div>
    `;
    
    html += addItem('Workshop', currentWorkshop.title);
    html += addItem('Full Name', formData.get('fullName'));
    html += addItem('MNC UID', formData.get('mncUID'));
    html += addItem('Registration No', formData.get('mncRegistrationNumber'));
    html += addItem('Mobile', formData.get('mobileNumber'));
    html += addItem('Payment UTR', formData.get('paymentUTR'));
    
    const file = formData.get('paymentScreenshot');
    if (file && file.name) {
        html += addItem('Screenshot', file.name);
    }
    
    reviewDetails.innerHTML = html;
    modal.classList.add('show');
}

// Close modal
function closeModal() { // Used by 'Go Back'
    document.getElementById('confirmationModal').classList.remove('show');
}

// Confirm submission
async function confirmSubmission() {
    const confirmBtn = document.getElementById('confirmBtn');
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Submitting...';
    
    try {
        const response = await fetch('/api/registration/submit', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            closeModal();
            // Reset form and hide it
            document.getElementById('registrationForm').reset();
            document.getElementById('formSection').classList.remove('show');
            document.getElementById('fileNameDisplay').innerHTML = 'Click to upload image';
            
            // Show success message and download link?? Or just redirect/alert
            // Let's redirect to view-registration or show a success alert
            alert(`✅ Registration Successful!\n\nYour Form Number: ${data.data.formNumber}`);
            
            // Reload workshops to update counts
            loadAllWorkshops();
            
            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            showAlert(data.message || 'Registration failed', 'error');
        }
    } catch (error) {
        console.error('Submission error:', error);
        showAlert('Error submitting registration. Please try again.', 'error');
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Confirm & Submit';
    }
}

// Handle file input change
function handleFileChange(e) {
    const file = e.target.files[0];
    // Support new design's display element
    const fileNameDisplay = document.getElementById('fileNameDisplay');

    if (file) {
        // Validate file size (5MB)
        if (file.size > 5 * 1024 * 1024) {
            showAlert('File size must be less than 5MB', 'error');
            e.target.value = '';
            if (fileNameDisplay) {
                 fileNameDisplay.innerHTML = 'Click to upload image';
                 fileNameDisplay.style.color = 'inherit';
            }
            return;
        }
        
        if (fileNameDisplay) {
            fileNameDisplay.innerHTML = `<strong>Picked:</strong> ${escapeHtml(file.name)}`;
            fileNameDisplay.style.color = 'var(--success)';
        }
    } else {
        if (fileNameDisplay) {
             fileNameDisplay.innerHTML = 'Click to upload image';
             fileNameDisplay.style.color = 'inherit';
        }
    }
}

// Utility: Escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Utility: Show Alert
function showAlert(message, type = 'info') {
    const alert = document.getElementById('alertMessage');
    if (!alert) {
        alert(message); // Fallback
        return;
    }
    
    alert.textContent = message;
    alert.className = `alert alert-${type} show`;
    
    setTimeout(() => {
        alert.classList.remove('show');
    }, 5000);
}
