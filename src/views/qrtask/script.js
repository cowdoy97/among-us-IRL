// Get all the necessary DOM elements
const startContainer = document.getElementById('start-container');
const startButton = document.getElementById('start-button');
const errorMessage = document.getElementById('error-message');

const qrScannerContainer = document.getElementById('qr-scanner-container');
const scannedInfoContainer = document.getElementById('scanned-info-container');
const crewmateNameElement = document.getElementById('crewmate-name');
const faceCaptureContainer = document.getElementById('face-capture-container');
const processingContainer = document.getElementById('processing-container');
const approvedContainer = document.getElementById('approved-container');
const faceVideo = document.getElementById('face-video');
const canvas = document.getElementById('canvas');
const refreshMessage = document.getElementById('refresh-message');

// Get the audio elements
const processingSound = document.getElementById('processing-sound');
// THIS IS THE NEW APPROVED SOUND ELEMENT
const approvedSound = document.getElementById('approved-sound');

let html5QrCode;

// --- Main App Flow ---

startButton.addEventListener('click', () => {
    startContainer.style.display = 'none';
    qrScannerContainer.style.display = 'block';
    startCamera();
});

function startCamera() {
    html5QrCode = new Html5Qrcode("qr-reader");

    const qrCodeSuccessCallback = (decodedText, decodedResult) => {
        onScanSuccess(decodedText, decodedResult);
    };

    const qrCodeErrorCallback = (errorMessage) => { /* Ignore scan errors */ };

    const rearCameraConfig = { 
        fps: 10, 
        qrbox: { width: 250, height: 250 }
    };

    const frontCameraConfig = { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        disableFlip: true 
    };

    html5QrCode.start(
        { facingMode: "environment" },
        rearCameraConfig,
        qrCodeSuccessCallback,
        qrCodeErrorCallback
    ).catch(err => {
        console.log("Rear camera failed, trying front camera.");
        html5QrCode.start(
            { facingMode: "user" },
            frontCameraConfig,
            qrCodeSuccessCallback,
            qrCodeErrorCallback
        ).catch(err => {
            console.error("Failed to start any camera.", err);
            alert("Could not start camera.");
        });
    });
}

function onScanSuccess(decodedText, decodedResult) {
    html5QrCode.stop().then(() => {
        qrScannerContainer.style.display = 'none';
        crewmateNameElement.innerText = decodedText;
        scannedInfoContainer.style.display = 'block';
        setTimeout(() => {
            scannedInfoContainer.style.display = 'none';
            startFaceCapture();
        }, 3000);
    }).catch(error => {
        console.error("Failed to stop the QR scanner.", error);
    });
}

async function startFaceCapture() {
    faceCaptureContainer.style.display = 'block';
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        faceVideo.srcObject = stream;
        faceVideo.play();
        setTimeout(takePicture, 2000);
    } catch (err) {
        console.error("Error accessing webcam for face capture:", err);
        alert("Could not access webcam.");
    }
}

function takePicture() {
    const context = canvas.getContext('2d');
    context.drawImage(faceVideo, 0, 0, 640, 480);
    
    const stream = faceVideo.srcObject;
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    
    faceCaptureContainer.style.display = 'none';
    showProcessing();
}

function showProcessing() {
    processingContainer.style.display = 'block';
    processingSound.play();
    setTimeout(showApproved, 10000);
}

// --- THIS FUNCTION IS UPDATED ---
function showApproved() {
    // Stop the looping verification sound
    processingSound.pause();
    processingSound.currentTime = 0;

    processingContainer.style.display = 'none';
    approvedContainer.style.display = 'block';

    // Play the approval sound once
    approvedSound.play();

    // Start the reset countdown
    let countdown = 15;
    refreshMessage.textContent = `Resetting in ${countdown} seconds...`;

    const countdownInterval = setInterval(() => {
        countdown--;
        refreshMessage.textContent = `Resetting in ${countdown} seconds...`;
        if (countdown <= 0) {
            clearInterval(countdownInterval);
        }
    }, 1000);

    setTimeout(() => {
        location.reload();
    }, 15000);
}