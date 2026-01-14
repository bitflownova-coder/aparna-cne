let video = null;
let canvas = null;
let canvasContext = null;
let scanningActive = false;
let scannedData = null;

function openScanner() {
    const modal = document.getElementById('scannerModal');
    modal.style.display = 'flex';
    
    // Reset to step 1
    document.getElementById('scannerStep1').style.display = 'block';
    document.getElementById('scannerStep2').style.display = 'none';
    document.getElementById('scannerStep3').style.display = 'none';
    
    // Initialize camera
    initCamera();
}

function closeScanner() {
    const modal = document.getElementById('scannerModal');
    modal.style.display = 'none';
    
    // Stop camera
    stopCamera();
    scannedData = null;
}

async function initCamera() {
    video = document.getElementById('qrVideo');
    canvas = document.createElement('canvas');
    canvasContext = canvas.getContext('2d');
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' } // Prefer back camera on mobile
        });
        
        video.srcObject = stream;
        video.setAttribute('playsinline', true); // Required for iOS
        video.play();
        
        document.getElementById('scanStatus').textContent = '📷 Camera ready - Point at QR code';
        document.getElementById('scanStatus').style.color = '#10b981';
        
        scanningActive = true;
        requestAnimationFrame(scanQRCode);
        
    } catch (err) {
        console.error('Camera error:', err);
        document.getElementById('scanStatus').innerHTML = '❌ Camera access denied<br><small>Please allow camera permission</small>';
        document.getElementById('scanStatus').style.color = '#ef4444';
    }
}

function stopCamera() {
    scanningActive = false;
    
    if (video && video.srcObject) {
        const stream = video.srcObject;
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
        video.srcObject = null;
    }
}

function scanQRCode() {
    if (!scanningActive) return;
    
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        canvasContext.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const imageData = canvasContext.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
        });
        
        if (code) {
            handleQRCodeScanned(code.data);
            return; // Stop scanning
        }
    }
    
    requestAnimationFrame(scanQRCode);
}

function handleQRCodeScanned(data) {
    stopCamera();
    
    console.log('QR Code scanned:', data); // Debug log
    
    try {
        // Parse pipe-delimited format: ATTENDANCE:workshopId|workshopTitle|timestamp|sequence
        if (data.startsWith('ATTENDANCE:')) {
            const parts = data.substring(11).split('|'); // Remove "ATTENDANCE:" prefix
            
            if (parts.length >= 4) {
                scannedData = {
                    workshopId: parts[0],
                    workshopTitle: parts[1],
                    timestamp: parseInt(parts[2]),
                    type: 'attendance',
                    sequence: parseInt(parts[3])
                };
                
                console.log('Parsed QR data:', scannedData); // Debug log
                
                // Show step 2
                document.getElementById('scannerStep1').style.display = 'none';
                document.getElementById('scannerStep2').style.display = 'block';
                document.getElementById('scannedWorkshop').textContent = scannedData.workshopTitle || 'Workshop';
            } else {
                console.error('Invalid QR data structure:', data);
                alert('Invalid QR code format. Please scan the correct attendance QR code.');
                closeScanner();
            }
        } else {
            console.error('Not an attendance QR code:', data);
            alert('Invalid QR code. Please scan the attendance QR code displayed on screen.');
            closeScanner();
        }
    } catch (error) {
        console.error('QR Parse error:', error, 'Raw data:', data); // Debug log
        alert('Invalid QR code format. Please scan the correct attendance QR code.');
        closeScanner();
    }
}

async function submitAttendance() {
    const identifier = document.getElementById('attendanceMncUID').value.trim();
    
    if (!identifier) {
        alert('⚠️ Please enter your Mobile Number or MNC Registration Number');
        document.getElementById('attendanceMncUID').focus();
        return;
    }
    
    // Basic validation
    const isMobile = /^[0-9]{10}$/.test(identifier);
    const isMNCReg = /^[A-Z]+-[0-9]+$/.test(identifier);
    
    if (!isMobile && !isMNCReg) {
        alert('⚠️ Please enter a valid format:\n• Mobile: 10 digits (e.g., 9876543210)\n• MNC Registration: Roman-Number (e.g., XVI-5581)');
        document.getElementById('attendanceMncUID').focus();
        return;
    }
    
    if (!scannedData || !scannedData.workshopId) {
        alert('❌ QR code data missing. Please scan again.');
        closeScanner();
        return;
    }
    
    // Disable button and show loading state
    const btn = event.target;
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Confirming...';
    btn.style.opacity = '0.7';
    
    try {
        const response = await fetch('/api/attendance/mark', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                workshopId: scannedData.workshopId,
                identifier: identifier,
                timestamp: Date.now()
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Show success step
            document.getElementById('scannerStep2').style.display = 'none';
            document.getElementById('scannerStep3').style.display = 'block';
        } else {
            alert('❌ ' + (result.message || 'Failed to mark attendance. Please try again.'));
            btn.disabled = false;
            btn.textContent = originalText;
            btn.style.opacity = '1';
        }
    } catch (error) {
        console.error('Attendance error:', error);
        alert('❌ Error marking attendance. Please check your connection and try again.');
        btn.disabled = false;
        btn.textContent = originalText;
        btn.style.opacity = '1';
    }
}
