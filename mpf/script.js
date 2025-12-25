// ----------------------------------------------------------------------
// JAVASCRIPT LOGIC AND HOOKS
// ----------------------------------------------------------------------

// New global variables for recording state
let mediaRecorderCombined = null;
let mediaRecorderAudioOnly = null;
let recordedChunksCombined = [];
let recordedChunksAudioOnly = [];
let recordingInterval = null;
let currentCombinedStream = null;
let currentAudioOnlyStream = null;
let currentVisualStream = null; 

// --- TOOLTIP STATE (NEW) ---
let tooltipState = {
    visible: false,
    text: '',
    x: 0,
    y: 0,
    width: 0
};

let recordedAudioMimeType = ''; 
const FRAME_RATE = 60; 

// State Object to track toggleable features
const featureState = {
    power: false,
    audioRecord: false, 
    screenRecord: false 
};

// Visual capture zoom (1.0 = 100%)
let visualZoom = 1.0;
const VISUAL_ZOOM_MIN = 0.5;
const VISUAL_ZOOM_MAX = 3.0;
const VISUAL_ZOOM_STEP = 0.1;

// Keyboard image mappings and helper functions
const KEYBOARD_MAP = {
    mpf1b: 'https://www.robkalmeijer.nl/techniek/computer/mpf1/mpf-1b_keyboard.jpg',
    tinybasic: 'https://electrickery.hosting.philpem.me.uk/comp/mpf1/doc/tinyBasicKeyboardOverlay.jpg'
};

let currentKeyboard = localStorage.getItem('upf.keyboard') || 'mpf1b';

function setKeyboardImage(keyName) {
    const img = document.getElementById('keyboard-image');
    if (!img) return;
    const key = keyName in KEYBOARD_MAP ? keyName : 'mpf1b';
    img.src = KEYBOARD_MAP[key];
    currentKeyboard = key;
    try { localStorage.setItem('upf.keyboard', key); } catch (e) {}
    // update selector if present
    const sel = document.getElementById('keyboard-select');
    if (sel) {
        try { sel.value = key === 'mpf1b' ? 'mpf-1b' : 'tiny-basic'; } catch (e) {}
    }
}

function initKeyboardSelector() {
    const sel = document.getElementById('keyboard-select');
    if (!sel) return;
    // map stored key to select value
    try { sel.value = currentKeyboard === 'mpf1b' ? 'mpf-1b' : 'tiny-basic'; } catch (e) {}
    sel.addEventListener('change', (e) => {
        const v = e.target.value === 'tiny-basic' ? 'tinybasic' : 'mpf1b';
        setKeyboardImage(v);
    });
    // ensure image set on load
    setKeyboardImage(currentKeyboard);
}

function toggleKeyboard() {
    const next = currentKeyboard === 'mpf1b' ? 'tinybasic' : 'mpf1b';
    setKeyboardImage(next);
}

try { window.toggleKeyboard = toggleKeyboard; } catch (e) {}

function setVisualZoom(scale) {
    visualZoom = Math.max(VISUAL_ZOOM_MIN, Math.min(VISUAL_ZOOM_MAX, +(scale).toFixed(2)));
    // Apply an immediate UI scale so users see the effect right away
    applyUIScale(visualZoom);
}
function zoomInVisual() { setVisualZoom(visualZoom + VISUAL_ZOOM_STEP); }
function zoomOutVisual() { setVisualZoom(visualZoom - VISUAL_ZOOM_STEP); }
function resetVisualZoom() { setVisualZoom(1.0); }

// Expose helpers to the page/console
try { window.zoomInVisual = zoomInVisual; window.zoomOutVisual = zoomOutVisual; window.resetVisualZoom = resetVisualZoom; window.setVisualZoom = setVisualZoom; } catch (e) {}

// Apply CSS transform scaling to the visible UI so zoom changes are instant for the user.
function applyUIScale(scale) {
    try {
        const windowEl = document.getElementById('window');
        const imageContainer = document.querySelector('.image-container');
        if (windowEl) {
            windowEl.style.transformOrigin = '0 0';
            windowEl.style.transform = `scale(${scale})`;
        }
        if (imageContainer) {
            imageContainer.style.transformOrigin = '0 0';
            imageContainer.style.transform = `scale(${scale})`;
        }
    } catch (e) {
        console.warn('applyUIScale failed', e);
    }
}

try { window.applyUIScale = applyUIScale; } catch (e) {}

// Exposing required functions to the window scope
window.handlePower = handlePower;
window.handleAudioIn = handleAudioIn;
window.handleAudioRecord = handleAudioRecord;
window.handleScreenRecord = handleScreenRecord;
window.handleDumpBuffer = handleDumpBuffer;
window.handleLoadAndRunScript = handleLoadAndRunScript;


/**
 * Finds and clears the character/text displayed on a single 7-segment SVG object.
 */
function clearSingle7Segment(id) {
    const obj = document.getElementById(id);
    if (obj) {
        const clearSvgText = (svgDoc) => {
            const textElement = svgDoc.querySelector('text');
            if (textElement) {
                textElement.textContent = '';
            }
        };
        obj.onload = () => { clearSvgText(obj.contentDocument); };
        if (obj.contentDocument) { clearSvgText(obj.contentDocument); }
    }
}

/**
 * Initializes all 7-segment display characters to be blank.
 */
function clear7SegmentDisplays() {
    const segIds = ["svg-object-add3", "svg-object-add2", "svg-object-add1", "svg-object-add0", "svg-object-data1", "svg-object-data0"];
    segIds.forEach(clearSingle7Segment);
}

/**
 * Synchronously retrieves the current state of an embedded SVG object as an Image object.
 */
function getDynamicSVGImage(id) {
    const obj = document.getElementById(id);
    if (obj && obj.contentDocument) {
        try {
            const svgElement = obj.contentDocument.documentElement;
            const width = obj.offsetWidth;
            const height = obj.offsetHeight;
            const svgString = new XMLSerializer().serializeToString(svgElement);
            const svgDataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
            
            const img = new Image(width, height);
            img.width = width; 
            img.height = height;
            img.src = svgDataUrl;
            return img;
        } catch (e) {
            console.error(`Failed to generate SVG image for ${id}:`, e);
            return null;
        }
    }
    return null;
}

/**
 * Helper function to extract the relevant drawing details for a button circle and text.
 */
function getButtonCircleDetails(button, windowRect) {
    const circle = button.querySelector('svg circle');
    const textElement = button.querySelector('svg text') || button.querySelector('p');
    
    if (!circle) return null;

    const circleRect = circle.getBoundingClientRect();
    if (circleRect.width === 0) return null;

    const is_active = button.getAttribute('data-state') === 'on';
    
    // Determine the steady state fill color
    let fillColor = circle.getAttribute('fill') || '#bbb'; 
    if (!is_active && button.getAttribute('title') && button.getAttribute('title').includes('Power')) {
        fillColor = '#F44336';
    } else if (!is_active) {
        fillColor = '#bbb'; 
    }

    const centerX = circleRect.left - windowRect.left + (circleRect.width / 2);
    const centerY = circleRect.top - windowRect.top + (circleRect.height / 2); 

    let buttonText = '';
    if (textElement) {
        buttonText = textElement.textContent.trim();
    }

    return {
        x: centerX,
        y: centerY,
        radius: parseInt(circle.getAttribute('r'), 10) || 12,
        fill: fillColor, 
        text: buttonText,
        textX: centerX,
        textY: centerY,
        textColor: '#333' 
    };
}

/**
 * Initializes mouse event listeners to track tooltips for video capture.
 */
function initTooltipTracking() {
    const buttons = document.querySelectorAll('.button-grid div');
    const windowEl = document.getElementById('window');

    buttons.forEach(btn => {
        btn.addEventListener('mouseenter', () => {
            const title = btn.getAttribute('title');
            if (title) {
                const rect = btn.getBoundingClientRect();
                const winRect = windowEl.getBoundingClientRect();
                
                tooltipState.text = title;
                tooltipState.visible = true;
                // Calculate position relative to the canvas origin (windowEl)
                // Position tooltip slightly below the button
                tooltipState.x = rect.left - winRect.left + (rect.width / 2); 
                tooltipState.y = rect.bottom - winRect.top + 5; 
            }
        });

        btn.addEventListener('mouseleave', () => {
            tooltipState.visible = false;
            tooltipState.text = '';
        });
    });
}


/**
 * Helper function to draw the current state onto the canvas, including dynamic elements and tooltips.
 */
function drawCanvasFrame(canvas, ctx, windowEl, keyboardImage) {
    const windowRect = windowEl.getBoundingClientRect();

    // Clear the whole canvas using the identity transform so we clear pixel area correctly
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    // Apply the visual zoom transform so subsequent drawing uses logical (CSS) coordinates scaled by visualZoom
    ctx.setTransform(visualZoom, 0, 0, visualZoom, 0, 0);
    
    // --- DRAW WINDOW AREA (7-Segments & LEDs) ---
    ctx.fillStyle = '#f0f0f0'; 
    ctx.fillRect(0, 0, windowEl.offsetWidth, windowEl.offsetHeight);

    // b. Draw Dynamic 7-Segment Displays
    const segIds = ["svg-object-add3", "svg-object-add2", "svg-object-add1", "svg-object-add0", "svg-object-data1", "svg-object-data0"];
    segIds.forEach(id => {
        const obj = document.getElementById(id);
        const img = getDynamicSVGImage(id);

        if (obj && img && img.complete) {
            const objRect = obj.getBoundingClientRect();
            const x_pos = objRect.left - windowRect.left;
            const y_pos = objRect.top - windowRect.top;
            ctx.drawImage(img, x_pos, y_pos, obj.offsetWidth, obj.offsetHeight);
        }
    });

    // c. Draw LEDs
    const ledGreen = document.getElementById('led-green');
    const ledRed = document.getElementById('led-red');
    
    [ledGreen, ledRed].forEach(led => {
        if (!led) return;
        const ledRect = led.getBoundingClientRect();
        const is_on = led.classList.contains('on');
        const color = led.id === 'led-green' ? 'limegreen' : 'red';
        
        const x_pos = ledRect.left - windowRect.left + (ledRect.width / 2);
        const y_pos = ledRect.top - windowRect.top + (ledRect.height / 2);
        const radius = ledRect.width / 2;

        if (radius > 0) {
            ctx.beginPath();
            ctx.arc(x_pos, y_pos, radius, 0, 2 * Math.PI);
            let drawColor;
            if (is_on) {
                drawColor = color;
            } else {
                drawColor = led.id === 'led-green' ? 'rgba(0, 128, 0, 0.15)' : 'rgba(255, 0, 0, 0.15)'; 
            }
            ctx.fillStyle = drawColor;
            ctx.fill();
            
            if (is_on) {
                ctx.shadowColor = color;
                ctx.shadowBlur = 10;
                ctx.fillStyle = color;
                ctx.fill(); 
                ctx.shadowBlur = 0; 
            }
        }
    });

    // --- DRAW KEYBOARD AREA ---
    const keyboardYOffset = windowEl.offsetHeight;
    ctx.drawImage(keyboardImage, 0, keyboardYOffset, keyboardImage.offsetWidth, keyboardImage.offsetHeight);

    // e. Draw Buttons (Circles + Text)
    const buttons = document.querySelectorAll('.button-grid div');
    
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle'; 
    ctx.font = '12px Arial'; 

    buttons.forEach(button => {
        const details = getButtonCircleDetails(button, windowRect);
        const is_pressed = button.classList.contains('is-pressed'); 

        if (details) {
            let finalFill = details.fill;
            if (is_pressed) {
                finalFill = '#F44336'; 
            }

            ctx.beginPath();
            ctx.arc(details.x, details.y, details.radius + 1, 0, 2 * Math.PI); 
            ctx.strokeStyle = '#333'; 
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(details.x, details.y, details.radius, 0, 2 * Math.PI);
            ctx.fillStyle = finalFill; 
            ctx.fill();
            
            if (details.text) {
                ctx.fillStyle = details.textColor;
                ctx.fillText(details.text, details.textX, details.textY); 
            }
        }
    });

    // f. Draw Feedback Circle (Red Click)
    const feedbackCircle = document.getElementById('circle');
    if (feedbackCircle) {
        const computedStyle = window.getComputedStyle(feedbackCircle);
        const opacity = parseFloat(computedStyle.opacity);
        const display = computedStyle.display;

        if (display !== 'none' && opacity > 0) {
            const circleRect = feedbackCircle.getBoundingClientRect();
            const x = circleRect.left - windowRect.left + (circleRect.width / 2);
            const y = circleRect.top - windowRect.top + (circleRect.height / 2);
            const radius = circleRect.width / 2;

            ctx.save(); 
            ctx.globalAlpha = opacity; 
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, 2 * Math.PI);
            ctx.fillStyle = computedStyle.backgroundColor || 'rgba(255, 0, 0, 0.5)';
            ctx.fill();
            ctx.restore(); 
        }
    }

    // g. DRAW TOOLTIP (NEW)
    if (tooltipState.visible && tooltipState.text) {
        ctx.save();
        ctx.font = '12px sans-serif';
        const padding = 6;
        const textWidth = ctx.measureText(tooltipState.text).width;
        const boxWidth = textWidth + (padding * 2);
        const boxHeight = 20; // Approx height for 12px text
        
        // Draw Tooltip Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        // Center the box horizontally on tooltipState.x
        ctx.fillRect(tooltipState.x - (boxWidth / 2), tooltipState.y, boxWidth, boxHeight);
        
        // Draw Tooltip Text
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tooltipState.text, tooltipState.x, tooltipState.y + (boxHeight / 2));
        
        ctx.restore();
    }
}


/**
 * Captures the visual stream from elements by drawing permitted elements onto a canvas.
 */
function getVisualStream() {
    const windowEl = document.getElementById('window');
    const keyboardImage = document.getElementById('keyboard-image'); 
    const imageContainerEl = document.querySelector('.image-container'); 

    if (!windowEl || !keyboardImage || !imageContainerEl) {
        console.error("Visual capture failed: Required DOM elements missing.");
        throw new Error("Missing DOM elements for visual capture.");
    }
    
    const canvas = document.createElement('canvas');
    const totalHeight = windowEl.offsetHeight + imageContainerEl.offsetHeight;
    const totalWidth = windowEl.offsetWidth;

    // Set canvas pixel dimensions according to visualZoom so captureStream records at the desired resolution
    canvas.width = Math.round(totalWidth * visualZoom);
    canvas.height = Math.round(totalHeight * visualZoom);
    // optional CSS size (not necessary since canvas is off-DOM) but keeps drawing math consistent
    canvas.style.width = `${totalWidth}px`;
    canvas.style.height = `${totalHeight}px`;

    const ctx = canvas.getContext('2d');

    drawCanvasFrame(canvas, ctx, windowEl, keyboardImage);
    const stream = canvas.captureStream(FRAME_RATE);
    
    if (recordingInterval) {
        clearInterval(recordingInterval);
    }
    
    recordingInterval = setInterval(() => {
        try {
            drawCanvasFrame(canvas, ctx, windowEl, keyboardImage);
        } catch (e) {
            console.error("[VIS WARN] Canvas drawImage failed. Stopping interval.", e);
            clearInterval(recordingInterval); 
            term.write('\r\nERROR: Visual capture failed. Check browser console for details.\r\n> ');
            mediaRecorderCombined?.stop();
        }
    }, 1000 / FRAME_RATE);
    
    return stream;
}


// 1. Power Off/ON
function handlePower() {
    const element = document.querySelector('.button-grid div[title*="Power"]');
    const svgCircle = element.querySelector('svg circle');

    featureState.power = !featureState.power;

    if (featureState.power) {
        svgCircle.setAttribute('fill', '#4CAF50'); 
        element.setAttribute('data-state', 'on');
        if (window.resumeAudioContext) window.resumeAudioContext();
        if (typeof executeCommand === 'function') executeCommand('run');
        term.write('\r\nSystem Powered ON.\r\n> ');
    } else {
        destroyZpu
        svgCircle.setAttribute('fill', '#F44336'); 
        element.setAttribute('data-state', 'off');
        term.write('\r\nSystem Powered OFF.\r\n> ');
    }
}

// 2. Audio In
function handleAudioIn() {
    const element = document.querySelector('.button-grid div[title*="Audio In"]');
    const svgCircle = element.querySelector('svg circle');
    const originalFill = svgCircle.getAttribute('fill');

    svgCircle.setAttribute('fill', '#FFC107'); 
    setTimeout(() => { svgCircle.setAttribute('fill', originalFill); }, 200);
    term.write('\r\nAudio Input: Waiting for file upload...\r\n> ');
}

// 3. Audio Record
function handleAudioRecord() {
    const element = document.querySelector('.button-grid div[title*="Audio Record"]');
    const svgCircle = element.querySelector('svg circle');
    const led = document.getElementById('led-green');
    
    if (!window.getAudioDestination || !window.globalAudioContext) {
         term.write('\r\nERROR: Audio stream functions missing.\r\n> ');
         return;
    }

    if (mediaRecorderAudioOnly && mediaRecorderAudioOnly.state === 'recording') {
        mediaRecorderAudioOnly.onstop = () => {
            if (currentAudioOnlyStream) currentAudioOnlyStream.getTracks().forEach(track => track.stop());
            const audioBlob = new Blob(recordedChunksAudioOnly, { 'type': recordedAudioMimeType });
            const extension = recordedAudioMimeType.includes('ogg') ? 'ogg' : 'webm';
            if (typeof window.triggerDownload === 'function') window.triggerDownload(audioBlob, `audio_out_${Date.now()}.${extension}`);
            
            recordedChunksAudioOnly.length = 0; 
            mediaRecorderAudioOnly = null;
            currentAudioOnlyStream = null;
            led.classList.remove('on');
            svgCircle.setAttribute('fill', '#bbb');
            featureState.audioRecord = false;
            term.write(`\r\nAudio Out Recording Stopped.\r\n> `);
        };
        mediaRecorderAudioOnly.stop();
    } else {
        try {
            const audioDestination = window.getAudioDestination();
            currentAudioOnlyStream = audioDestination.stream;
            let mimeType = 'audio/webm';
            if (MediaRecorder.isTypeSupported('audio/webm; codecs=opus')) mimeType = 'audio/webm; codecs=opus';
            else if (MediaRecorder.isTypeSupported('audio/ogg; codecs=opus')) mimeType = 'audio/ogg; codecs=opus';

            mediaRecorderAudioOnly = new MediaRecorder(currentAudioOnlyStream, { mimeType });
            recordedAudioMimeType = mediaRecorderAudioOnly.mimeType;
            recordedChunksAudioOnly = [];
            
            mediaRecorderAudioOnly.ondataavailable = (event) => {
                if (event.data.size > 0) recordedChunksAudioOnly.push(event.data);
            };
            mediaRecorderAudioOnly.start(100); 
            featureState.audioRecord = true;
            led.classList.add('on');
            svgCircle.setAttribute('fill', '#4CAF50');
            term.write('\r\nAudio Out Recording Started (Audio-only).\r\n> ');
        } catch (error) {
            console.error(`[AUDIO ERROR]`, error);
            term.write(`\r\nERROR: Failed to start audio recording.\r\n> `);
        }
    }
    element.setAttribute('data-state', featureState.audioRecord ? 'on' : 'off');
}

// 4. Screen Record
function handleScreenRecord() {
    const element = document.querySelector('.button-grid div[title*="Screen Record"]');
    const svgCircle = element.querySelector('svg circle');
    
    if (!window.getAudioDestination || !window.beepTone) {
        term.write('\r\nERROR: Audio stream or tone function failed.\r\n> ');
        return;
    }

    if (mediaRecorderCombined && mediaRecorderCombined.state === 'recording') {
        clearInterval(recordingInterval); 
        mediaRecorderCombined.onstop = () => {
            if (currentCombinedStream) currentCombinedStream.getTracks().forEach(track => track.stop());
            if (currentVisualStream) currentVisualStream.getTracks().forEach(track => track.stop());
            
            currentCombinedStream = null;
            currentVisualStream = null;
            svgCircle.setAttribute('fill', '#bbb');
            element.setAttribute('data-state', 'off');
            featureState.screenRecord = false;
            term.write('\r\nScreen & Audio Recording Stopped. Ready for dump.\r\n> ');
        };
        mediaRecorderCombined.stop();
    } else {
        try {
            window.beepTone(880, 500, 0.1); 
            currentVisualStream = getVisualStream(); 
            const audioDestination = window.getAudioDestination();
            currentCombinedStream = new MediaStream(); 
            
            currentVisualStream.getVideoTracks().forEach(track => currentCombinedStream.addTrack(track));
            audioDestination.stream.getAudioTracks().forEach(track => currentCombinedStream.addTrack(track));

            let finalMimeType = 'video/webm; codecs=vp8,opus'; 
            if (!MediaRecorder.isTypeSupported(finalMimeType)) {
                finalMimeType = MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : '';
                if (!finalMimeType) throw new Error("Browser does not support basic WebM recording.");
            }

            const options = { mimeType: finalMimeType, videoBitsPerSecond: 2000000 };
            mediaRecorderCombined = new MediaRecorder(currentCombinedStream, options);
            recordedChunksCombined = [];

            mediaRecorderCombined.ondataavailable = (event) => {
                if (event.data.size > 0) recordedChunksCombined.push(event.data);
            };
            
            mediaRecorderCombined.start(1000); 
            featureState.screenRecord = true;
            svgCircle.setAttribute('fill', '#F44336'); 
            element.setAttribute('data-state', 'on');
            term.write(`\r\nScreen & Audio Recording Started (1/${FRAME_RATE} FPS).\r\n> `);
        } catch (error) {
            featureState.screenRecord = false;
            svgCircle.setAttribute('fill', '#bbb');
            console.error(`[REC ERROR]`, error);
            term.write(`\r\nERROR: Failed to start recording.\r\n> `);
            clearInterval(recordingInterval);
        }
    }
}

// 5. Dump Buffer
function handleDumpBuffer() {
    const element = document.querySelector('.button-grid div[title*="Dump Buffer"]');
    const svgCircle = element.querySelector('svg circle');
    const originalFill = svgCircle.getAttribute('fill');
    
    if (featureState.screenRecord) {
        term.write('\r\nCannot dump: Screen recording is in progress. Stopping...\r\n> ');
        handleScreenRecord(); 
        return; 
    }
    
    if (recordedChunksCombined.length === 0) {
         svgCircle.setAttribute('fill', '#FFC107'); 
         setTimeout(() => svgCircle.setAttribute('fill', originalFill), 200);
         term.write('\r\nDump failed: Buffer is empty.\r\n> ');
         return;
    }
    
    svgCircle.setAttribute('fill', '#2196F3'); 
    
    const finalMimeType = mediaRecorderCombined?.mimeType || 'video/webm; codecs=vp8,opus'; 
    const extension = finalMimeType.includes('mp4') ? 'mp4' : 'webm';
    
    if (currentCombinedStream) currentCombinedStream.getTracks().forEach(track => track.stop());
    if (currentVisualStream) currentVisualStream.getTracks().forEach(track => track.stop());
    
    const blob = new Blob(recordedChunksCombined, { type: finalMimeType });
    
    if (blob.size === 0) {
        console.error("[DUMP ERROR] Created blob has size 0.");
        svgCircle.setAttribute('fill', '#FFC107'); 
        setTimeout(() => svgCircle.setAttribute('fill', originalFill), 200);
        term.write('\r\nDump failed: Data buffer corrupted.\r\n> ');
        recordedChunksCombined = []; 
        mediaRecorderCombined = null; 
        currentCombinedStream = null; 
        currentVisualStream = null;
        return;
    }

    if (typeof window.triggerDownload === 'function') {
        window.triggerDownload(blob, `upf-capture-${Date.now()}.${extension}`);
    } else {
        term.write('\r\nDump failed: Download utility missing.\r\n> ');
    }
    
    recordedChunksCombined = []; 
    mediaRecorderCombined = null; 
    currentCombinedStream = null; 
    currentVisualStream = null;
    
    setTimeout(() => svgCircle.setAttribute('fill', originalFill), 500);
    term.write('\r\nDump complete: Captured file downloaded.\r\n> ');
}
    
// 6. Load & Run
function handleLoadAndRunScript() {
    const element = document.querySelector('.button-grid div[title*="Load & Run"]');
    const svgCircle = element.querySelector('svg circle');
    const originalFill = svgCircle.getAttribute('fill');

    svgCircle.setAttribute('fill', '#9C27B0'); 
    setTimeout(() => { svgCircle.setAttribute('fill', originalFill); }, 200);
    term.write('\r\nScript Load & Run: Triggering file selection...\r\n> ');
}


// Initialize terminal (use Terminal if available, otherwise use shim/fallback)
let term;
if (typeof Terminal !== 'undefined') {
    term = new Terminal({ cols: 80, rows: 24 });
} else if (window.term) {
    term = window.term; // from term-shim or previously set global
} else {
    term = {
        write: (s) => console.log(String(s).replace(/\r/g, '')),
        onData: () => {},
        open: () => {},
        dispose: () => {},
    };
    window.term = term;
}
const terminalContainer = document.getElementById('terminal');
if (typeof term.open === 'function') term.open(terminalContainer);
if (terminalContainer) {
    terminalContainer.style.display = 'block'; 
    terminalContainer.style.opacity = '1';
}
term.write("Welcome to the virtual upf--1\r\n> "); 

let currentCommand = '';
let breakpoint = 0xffff; 

// Command Execution Handler
term.onData((data) => {
    if (data === '\r') {
        if (typeof executeCommand === 'function') executeCommand(currentCommand.trim());
        else term.write('\r\n(Command executed: ' + currentCommand.trim() + ')\r\n> ');
        currentCommand = '';
    } else if (data === '\x7f') { 
        if (currentCommand.length > 0) {
            currentCommand = currentCommand.slice(0, -1);
            term.write('\b \b');
        }
    } else {
        currentCommand += data;
        term.write(data);
    }
});

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    clear7SegmentDisplays();
    document.getElementById("led-red")?.classList.remove("on");
    document.getElementById("led-green")?.classList.remove("on");

    const powerCircle = document.querySelector('.button-grid div[title*="Power"] svg circle');
    if (powerCircle) powerCircle.setAttribute('fill', '#F44336'); 

    // Initialize tooltip tracking listeners for video capture
    initTooltipTracking();
    try { initZoomControls(); } catch (e) {}
    try { initKeyboardSelector(); } catch (e) {}
});