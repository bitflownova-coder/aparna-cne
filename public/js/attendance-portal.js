let currentWorkshop = null;
let qrRefreshInterval = null;
let timerInterval = null;
let currentTime = 30;
let qrUpdateCount = 0;

// Load workshops on page load
document.addEventListener('DOMContentLoaded', () => {
    checkSession();
});

async function checkSession() {
    try {
        const response = await fetch('/api/attendance/check-session');
        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                // Session is valid, load workshops
                loadWorkshops();
                return;
            }
        }
        // Session invalid or error, redirect to login
        window.location.href = '/attendance-login.html';
    } catch (error) {
        console.error('Session check error:', error);
        window.location.href = '/attendance-login.html';
    }
}

async function logout() {
    try {
        await fetch('/api/attendance/logout', { method: 'POST' });
        window.location.href = '/attendance-login.html';
    } catch (error) {
        console.error('Logout error:', error);
        window.location.href = '/attendance-login.html';
    }
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            alert('Error enabling fullscreen: ' + err.message);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

async function loadWorkshops() {
    try {
        const response = await fetch('/api/workshop');
        const result = await response.json();
        
        if (result.success && result.data) {
            const select = document.getElementById('workshopSelect');
            const workshops = result.data.filter(w => w.status === 'active');
            
            workshops.forEach(workshop => {
                const option = document.createElement('option');
                option.value = workshop._id;
                option.textContent = `${workshop.title} - ${new Date(workshop.date).toLocaleDateString()}`;
                option.dataset.workshop = JSON.stringify(workshop);
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading workshops:', error);
        showNotification('Error loading workshops', 'error');
    }
}

function startDisplay() {
    const select = document.getElementById('workshopSelect');
    const selectedOption = select.options[select.selectedIndex];
    
    if (!selectedOption.value) {
        showNotification('Please select a workshop first', 'warning');
        return;
    }
    
    currentWorkshop = JSON.parse(selectedOption.dataset.workshop);
    qrUpdateCount = 0;
    
    // Show QR card, hide no workshop message
    document.getElementById('qrCard').style.display = 'block';
    document.getElementById('noWorkshop').style.display = 'none';
    
    // Update workshop info
    document.getElementById('workshopTitle').textContent = currentWorkshop.title;
    document.getElementById('workshopDate').textContent = `📅 ${new Date(currentWorkshop.date).toLocaleDateString('en-US', { 
        weekday: 'short', 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    })}`;
    document.getElementById('workshopVenue').textContent = `📍 ${currentWorkshop.venue}`;
    
    // Update status
    const statusText = document.getElementById('statusText');
    statusText.innerHTML = '<span class="status-indicator"></span>Active';
    
    // Generate first QR code
    generateQRCode();
    
    // Start auto-refresh
    qrRefreshInterval = setInterval(generateQRCode, 30000); // 30 seconds
    startTimer();
    
    showNotification('QR Display Started', 'success');
}

function stopDisplay() {
    if (qrRefreshInterval) {
        clearInterval(qrRefreshInterval);
        qrRefreshInterval = null;
    }
    
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    document.getElementById('qrCard').style.display = 'none';
    document.getElementById('noWorkshop').style.display = 'block';
    
    const statusText = document.getElementById('statusText');
    statusText.innerHTML = '<span class="status-indicator stopped"></span>Stopped';
    
    currentWorkshop = null;
    qrUpdateCount = 0;
    document.getElementById('qrCount').textContent = '0';
    
    showNotification('QR Display Stopped', 'info');
}

function generateQRCode() {
    if (!currentWorkshop) return;
    
    // Increment update counter
    qrUpdateCount++;
    document.getElementById('qrCount').textContent = qrUpdateCount;
    
    // Create simple URL-based QR data that's easier to scan
    const timestamp = Date.now();
    const qrData = `ATTENDANCE:${currentWorkshop._id}|${currentWorkshop.title}|${timestamp}|${qrUpdateCount}`;
    
    console.log('Generating QR code with data:', qrData); // Debug log
    
    const container = document.getElementById('qrCanvas');
    
    // Check if QRCode library is loaded
    if (typeof window.QRCode === 'undefined') {
        console.error('QRCode library not loaded');
        showNotification('QRCode library not loaded', 'error');
        return;
    }
    
    // Clear existing QR code completely
    container.innerHTML = '';
    
    // Create new QR code
    try {
        const qr = new window.QRCode(container, {
            text: qrData,
            width: 300,
            height: 300,
            colorDark: '#1e3a8a',
            colorLight: '#ffffff',
            correctLevel: window.QRCode.CorrectLevel.H
        });
        
        console.log('QR Code generated successfully'); // Debug log
        console.log(`QR Code #${qrUpdateCount} generated at ${new Date(timestamp).toLocaleTimeString()}`);
        
        // Verify QR was created
        setTimeout(() => {
            const canvas = container.querySelector('canvas');
            const img = container.querySelector('img');
            if (canvas || img) {
                console.log('QR Code element found:', canvas ? 'canvas' : 'img');
            } else {
                console.error('QR Code element not created!');
            }
        }, 100);
        
    } catch (error) {
        console.error('QR Code generation error:', error);
        showNotification('QR generation failed: ' + error.message, 'error');
    }
    
    // Reset timer
    currentTime = 30;
    updateTimer();
}

function startTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    
    timerInterval = setInterval(() => {
        currentTime--;
        updateTimer();
        
        if (currentTime <= 0) {
            currentTime = 30;
        }
    }, 1000);
}

function updateTimer() {
    document.getElementById('timerText').textContent = currentTime;
    const percentage = (currentTime / 30) * 100;
    document.getElementById('timerBarFill').style.width = percentage + '%';
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 24px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
        color: white;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        z-index: 10000;
        font-weight: 600;
        animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Add CSS animations for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
