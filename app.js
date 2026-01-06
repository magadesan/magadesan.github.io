// ============================================================================
// MPF-1B Emulator - Merged JavaScript File
// ============================================================================

// ----------------------------------------------------------------------------
// 1. LOGGER
// ----------------------------------------------------------------------------
(function () {
  if (typeof window === 'undefined') return;
  const logger = {
    write(text) {
      try {
        const out = String(text).replace(/\r/g, '');
        console.log(out);
      } catch (e) {
        console.log(text);
      }
    },
    onData() {},
    open() {},
    dispose() {}
  };
  window.logger = logger;
})();

// ----------------------------------------------------------------------------
// 2. CONFIGURATION
// ----------------------------------------------------------------------------
const CONFIG = {
  FRAME_RATE: 60,
  RECORDING_INTERVAL_MS: 1000,
  AUDIO_CHUNK_INTERVAL_MS: 100,
  VISUAL_ZOOM: {
    MIN: 0.5,
    MAX: 3.0,
    STEP: 0.1,
    DEFAULT: 1.0
  },
  KEYBOARD_MAP: {
    mpf1b: 'https://www.robkalmeijer.nl/techniek/computer/mpf1/mpf-1b_keyboard.jpg',
    tinybasic: 'https://electrickery.hosting.philpem.me.uk/comp/mpf1/doc/tinyBasicKeyboardOverlay.jpg'
  },
  SEGMENT_DISPLAY_IDS: [
    "svg-object-add3", "svg-object-add2", "svg-object-add1", "svg-object-add0",
    "svg-object-data1", "svg-object-data0"
  ],
  BUTTON_COLORS: {
    DEFAULT: '#bbb',
    POWER_OFF: '#F44336',
    POWER_ON: '#4CAF50',
    PRESSED: '#F44336',
    ACTIVE: '#4CAF50',
    WARNING: '#FFC107',
    INFO: '#2196F3',
    PURPLE: '#9C27B0'
  },
  LED_COLORS: {
    GREEN_ON: 'limegreen',
    GREEN_OFF: 'rgba(0, 128, 0, 0.15)',
    RED_ON: 'red',
    RED_OFF: 'rgba(255, 0, 0, 0.15)'
  },
  STORAGE_KEYS: {
    KEYBOARD: 'upf.keyboard'
  }
};

// ----------------------------------------------------------------------------
// 3. DOM UTILITIES
// ----------------------------------------------------------------------------
class DOMUtils {
    static getButtonByTitle(pattern) {
        return document.querySelector(`.button-grid div[title*="${pattern}"]`);
    }

    static updateButtonState(button, isActive, color) {
        if (!button) return;
        const svgCircle = button.querySelector('svg circle');
        if (svgCircle) {
            svgCircle.setAttribute('fill', color);
        }
        button.setAttribute('data-state', isActive ? 'on' : 'off');
    }

    static flashButton(button, color, duration = 200) {
        if (!button) return;
        const svgCircle = button.querySelector('svg circle');
        if (!svgCircle) return;
        const originalFill = svgCircle.getAttribute('fill');
        svgCircle.setAttribute('fill', color);
        setTimeout(() => {
            svgCircle.setAttribute('fill', originalFill);
        }, duration);
    }

    static updateLED(ledId, isOn) {
        const led = document.getElementById(ledId);
        if (led) {
            if (isOn) {
                led.classList.add('on');
            } else {
                led.classList.remove('on');
            }
        }
    }

    static clearSingle7Segment(id) {
        const obj = document.getElementById(id);
        if (!obj) return;
        const clearSvgText = (svgDoc) => {
            const textElement = svgDoc.querySelector('text');
            if (textElement) {
                textElement.textContent = '';
            }
        };
        obj.onload = () => { clearSvgText(obj.contentDocument); };
        if (obj.contentDocument) {
            clearSvgText(obj.contentDocument);
        }
    }

    static clearAll7SegmentDisplays() {
        CONFIG.SEGMENT_DISPLAY_IDS.forEach(id => {
            this.clearSingle7Segment(id);
        });
    }

    static getDynamicSVGImage(id) {
        const obj = document.getElementById(id);
        if (!obj || !obj.contentDocument) return null;
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

    static getButtonCircleDetails(button, windowRect) {
        const circle = button.querySelector('svg circle');
        const textElement = button.querySelector('svg text') || button.querySelector('p');
        if (!circle) return null;
        const circleRect = circle.getBoundingClientRect();
        if (circleRect.width === 0) return null;
        const isActive = button.getAttribute('data-state') === 'on';
        let fillColor = circle.getAttribute('fill') || CONFIG.BUTTON_COLORS.DEFAULT;
        if (!isActive && button.getAttribute('title')?.includes('Power')) {
            fillColor = CONFIG.BUTTON_COLORS.POWER_OFF;
        } else if (!isActive) {
            fillColor = CONFIG.BUTTON_COLORS.DEFAULT;
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

    static applyUIScale(scale) {
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
}

// ----------------------------------------------------------------------------
// 4. STATE MANAGER
// ----------------------------------------------------------------------------
class StateManager {
    constructor() {
        this.visualZoom = CONFIG.VISUAL_ZOOM.DEFAULT;
        this.currentKeyboard = this.loadKeyboardPreference();
        this.tooltipState = {
            visible: false,
            text: '',
            x: 0,
            y: 0,
            width: 0
        };
    }

    loadKeyboardPreference() {
        try {
            return localStorage.getItem(CONFIG.STORAGE_KEYS.KEYBOARD) || 'mpf1b';
        } catch (e) {
            return 'mpf1b';
        }
    }

    saveKeyboardPreference(key) {
        try {
            localStorage.setItem(CONFIG.STORAGE_KEYS.KEYBOARD, key);
        } catch (e) {
            console.warn('Failed to save keyboard preference:', e);
        }
    }

    getCurrentKeyboard() {
        return this.currentKeyboard;
    }

    setCurrentKeyboard(key) {
        this.currentKeyboard = key;
        this.saveKeyboardPreference(key);
    }

    getVisualZoom() {
        return this.visualZoom;
    }

    setVisualZoom(scale) {
        this.visualZoom = Math.max(
            CONFIG.VISUAL_ZOOM.MIN,
            Math.min(CONFIG.VISUAL_ZOOM.MAX, +(scale).toFixed(2))
        );
        return this.visualZoom;
    }

    getTooltipState() {
        return { ...this.tooltipState };
    }

    setTooltipState(state) {
        this.tooltipState = { ...this.tooltipState, ...state };
    }

    resetTooltip() {
        this.tooltipState = {
            visible: false,
            text: '',
            x: 0,
            y: 0,
            width: 0
        };
    }
}

// ----------------------------------------------------------------------------
// 5. RECORDING MANAGER
// ----------------------------------------------------------------------------
class RecordingManager {
    constructor() {
        this.mediaRecorderCombined = null;
        this.mediaRecorderAudioOnly = null;
        this.recordedChunksCombined = [];
        this.recordedChunksAudioOnly = [];
        this.recordingInterval = null;
        this.currentCombinedStream = null;
        this.currentAudioOnlyStream = null;
        this.currentVisualStream = null;
        this.recordedAudioMimeType = '';
        this.featureState = {
            power: false,
            audioRecord: false,
            screenRecord: false
        };
    }

    startAudioRecording(getAudioDestination, term) {
        if (!window.getAudioDestination || !window.globalAudioContext) {
            if (term) term.write('\r\nERROR: Audio stream functions missing.\r\n> ');
            return false;
        }
        if (this.mediaRecorderAudioOnly && this.mediaRecorderAudioOnly.state === 'recording') {
            return false;
        }
        try {
            const audioDestination = getAudioDestination();
            this.currentAudioOnlyStream = audioDestination.stream;
            let mimeType = 'audio/webm';
            if (MediaRecorder.isTypeSupported('audio/webm; codecs=opus')) {
                mimeType = 'audio/webm; codecs=opus';
            } else if (MediaRecorder.isTypeSupported('audio/ogg; codecs=opus')) {
                mimeType = 'audio/ogg; codecs=opus';
            }
            this.mediaRecorderAudioOnly = new MediaRecorder(this.currentAudioOnlyStream, { mimeType });
            this.recordedAudioMimeType = this.mediaRecorderAudioOnly.mimeType;
            this.recordedChunksAudioOnly = [];
            this.mediaRecorderAudioOnly.ondataavailable = (event) => {
                if (event.data.size > 0) this.recordedChunksAudioOnly.push(event.data);
            };
            this.mediaRecorderAudioOnly.start(CONFIG.AUDIO_CHUNK_INTERVAL_MS);
            this.featureState.audioRecord = true;
            if (term) term.write('\r\nAudio Out Recording Started (Audio-only).\r\n> ');
            return true;
        } catch (error) {
            console.error('[AUDIO ERROR]', error);
            if (term) term.write('\r\nERROR: Failed to start audio recording.\r\n> ');
            return false;
        }
    }

    stopAudioRecording(triggerDownload, term) {
        if (!this.mediaRecorderAudioOnly || this.mediaRecorderAudioOnly.state !== 'recording') {
            return false;
        }
        this.mediaRecorderAudioOnly.onstop = () => {
            if (this.currentAudioOnlyStream) {
                this.currentAudioOnlyStream.getTracks().forEach(track => track.stop());
            }
            const audioBlob = new Blob(this.recordedChunksAudioOnly, { 'type': this.recordedAudioMimeType });
            const extension = this.recordedAudioMimeType.includes('ogg') ? 'ogg' : 'webm';
            if (typeof triggerDownload === 'function') {
                triggerDownload(audioBlob, `audio_out_${Date.now()}.${extension}`);
            }
            this.recordedChunksAudioOnly.length = 0;
            this.mediaRecorderAudioOnly = null;
            this.currentAudioOnlyStream = null;
            this.featureState.audioRecord = false;
            if (term) term.write(`\r\nAudio Out Recording Stopped.\r\n> `);
        };
        this.mediaRecorderAudioOnly.stop();
        return true;
    }

    startScreenRecording(getVisualStream, getAudioDestination, beepTone, term) {
        if (!window.getAudioDestination || !window.beepTone) {
            if (term) term.write('\r\nERROR: Audio stream or tone function failed.\r\n> ');
            return false;
        }
        if (this.mediaRecorderCombined && this.mediaRecorderCombined.state === 'recording') {
            return false;
        }
        try {
            if (typeof beepTone === 'function') {
                beepTone(880, 500, 0.1);
            }
            this.currentVisualStream = getVisualStream();
            const audioDestination = getAudioDestination();
            this.currentCombinedStream = new MediaStream();
            this.currentVisualStream.getVideoTracks().forEach(track => 
                this.currentCombinedStream.addTrack(track)
            );
            audioDestination.stream.getAudioTracks().forEach(track => 
                this.currentCombinedStream.addTrack(track)
            );
            let finalMimeType = 'video/webm; codecs=vp8,opus';
            if (!MediaRecorder.isTypeSupported(finalMimeType)) {
                finalMimeType = MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : '';
                if (!finalMimeType) {
                    throw new Error("Browser does not support basic WebM recording.");
                }
            }
            const options = { 
                mimeType: finalMimeType, 
                videoBitsPerSecond: 2000000 
            };
            this.mediaRecorderCombined = new MediaRecorder(this.currentCombinedStream, options);
            this.recordedChunksCombined = [];
            this.mediaRecorderCombined.ondataavailable = (event) => {
                if (event.data.size > 0) this.recordedChunksCombined.push(event.data);
            };
            this.mediaRecorderCombined.start(CONFIG.RECORDING_INTERVAL_MS);
            this.featureState.screenRecord = true;
            if (term) {
                term.write(`\r\nScreen & Audio Recording Started (1/${CONFIG.FRAME_RATE} FPS).\r\n> `);
            }
            return true;
        } catch (error) {
            this.featureState.screenRecord = false;
            console.error('[REC ERROR]', error);
            if (term) term.write(`\r\nERROR: Failed to start recording.\r\n> `);
            if (this.recordingInterval) {
                clearInterval(this.recordingInterval);
            }
            return false;
        }
    }

    stopScreenRecording(term) {
        if (!this.mediaRecorderCombined || this.mediaRecorderCombined.state !== 'recording') {
            return false;
        }
        if (this.recordingInterval) {
            clearInterval(this.recordingInterval);
            this.recordingInterval = null;
        }
        this.mediaRecorderCombined.onstop = () => {
            if (this.currentCombinedStream) {
                this.currentCombinedStream.getTracks().forEach(track => track.stop());
            }
            if (this.currentVisualStream) {
                this.currentVisualStream.getTracks().forEach(track => track.stop());
            }
            this.currentCombinedStream = null;
            this.currentVisualStream = null;
            this.featureState.screenRecord = false;
            if (term) term.write('\r\nScreen & Audio Recording Stopped. Ready for dump.\r\n> ');
        };
        this.mediaRecorderCombined.stop();
        return true;
    }

    dumpBuffer(triggerDownload, term) {
        if (this.featureState.screenRecord) {
            if (term) term.write('\r\nCannot dump: Screen recording is in progress. Stopping...\r\n> ');
            this.stopScreenRecording(term);
            return false;
        }
        if (this.recordedChunksCombined.length === 0) {
            if (term) term.write('\r\nDump failed: Buffer is empty.\r\n> ');
            return false;
        }
        const finalMimeType = this.mediaRecorderCombined?.mimeType || 'video/webm; codecs=vp8,opus';
        const extension = finalMimeType.includes('mp4') ? 'mp4' : 'webm';
        if (this.currentCombinedStream) {
            this.currentCombinedStream.getTracks().forEach(track => track.stop());
        }
        if (this.currentVisualStream) {
            this.currentVisualStream.getTracks().forEach(track => track.stop());
        }
        const blob = new Blob(this.recordedChunksCombined, { type: finalMimeType });
        if (blob.size === 0) {
            console.error("[DUMP ERROR] Created blob has size 0.");
            if (term) term.write('\r\nDump failed: Data buffer corrupted.\r\n> ');
            this.recordedChunksCombined = [];
            this.mediaRecorderCombined = null;
            this.currentCombinedStream = null;
            this.currentVisualStream = null;
            return false;
        }
        if (typeof triggerDownload === 'function') {
            triggerDownload(blob, `upf-capture-${Date.now()}.${extension}`);
        } else {
            if (term) term.write('\r\nDump failed: Download utility missing.\r\n> ');
            return false;
        }
        this.recordedChunksCombined = [];
        this.mediaRecorderCombined = null;
        this.currentCombinedStream = null;
        this.currentVisualStream = null;
        if (term) term.write('\r\nDump complete: Captured file downloaded.\r\n> ');
        return true;
    }

    setRecordingInterval(intervalId) {
        if (this.recordingInterval) {
            clearInterval(this.recordingInterval);
        }
        this.recordingInterval = intervalId;
    }

    getFeatureState() {
        return { ...this.featureState };
    }

    setFeatureState(key, value) {
        if (key in this.featureState) {
            this.featureState[key] = value;
        }
    }
}

// ----------------------------------------------------------------------------
// 6. KEYBOARD MANAGER
// ----------------------------------------------------------------------------
class KeyboardManager {
    constructor(stateManager) {
        this.stateManager = stateManager;
    }

    setKeyboardImage(keyName) {
        const img = document.getElementById('keyboard-image');
        if (!img) return;
        const key = keyName in CONFIG.KEYBOARD_MAP ? keyName : 'mpf1b';
        img.src = CONFIG.KEYBOARD_MAP[key];
        this.stateManager.setCurrentKeyboard(key);
        const sel = document.getElementById('keyboard-select');
        if (sel) {
            try {
                sel.value = key === 'mpf1b' ? 'mpf-1b' : 'tiny-basic';
            } catch (e) {
                console.warn('Failed to update keyboard selector:', e);
            }
        }
    }

    initKeyboardSelector() {
        const sel = document.getElementById('keyboard-select');
        if (!sel) return;
        try {
            const currentKey = this.stateManager.getCurrentKeyboard();
            sel.value = currentKey === 'mpf1b' ? 'mpf-1b' : 'tiny-basic';
        } catch (e) {
            console.warn('Failed to set keyboard selector value:', e);
        }
        sel.addEventListener('change', (e) => {
            const v = e.target.value === 'tiny-basic' ? 'tinybasic' : 'mpf1b';
            this.setKeyboardImage(v);
        });
        this.setKeyboardImage(this.stateManager.getCurrentKeyboard());
    }

    toggleKeyboard() {
        const current = this.stateManager.getCurrentKeyboard();
        const next = current === 'mpf1b' ? 'tinybasic' : 'mpf1b';
        this.setKeyboardImage(next);
    }
}

// ----------------------------------------------------------------------------
// 7. VISUAL RENDERER
// ----------------------------------------------------------------------------
class VisualRenderer {
    constructor(stateManager) {
        this.stateManager = stateManager;
    }

    drawCanvasFrame(canvas, ctx, windowEl, keyboardImage) {
        const windowRect = windowEl.getBoundingClientRect();
        const visualZoom = this.stateManager.getVisualZoom();
        const tooltipState = this.stateManager.getTooltipState();
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
        ctx.setTransform(visualZoom, 0, 0, visualZoom, 0, 0);
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, windowEl.offsetWidth, windowEl.offsetHeight);
        this.draw7SegmentDisplays(ctx, windowRect);
        this.drawLEDs(ctx, windowRect);
        const keyboardYOffset = windowEl.offsetHeight;
        ctx.drawImage(keyboardImage, 0, keyboardYOffset, keyboardImage.offsetWidth, keyboardImage.offsetHeight);
        this.drawButtons(ctx, windowRect);
        this.drawFeedbackCircle(ctx, windowRect);
        if (tooltipState.visible && tooltipState.text) {
            this.drawTooltip(ctx, tooltipState);
        }
    }

    draw7SegmentDisplays(ctx, windowRect) {
        CONFIG.SEGMENT_DISPLAY_IDS.forEach(id => {
            const obj = document.getElementById(id);
            const img = DOMUtils.getDynamicSVGImage(id);
            if (obj && img && img.complete) {
                const objRect = obj.getBoundingClientRect();
                const xPos = objRect.left - windowRect.left;
                const yPos = objRect.top - windowRect.top;
                ctx.drawImage(img, xPos, yPos, obj.offsetWidth, obj.offsetHeight);
            }
        });
    }

    drawLEDs(ctx, windowRect) {
        const ledGreen = document.getElementById('led-green');
        const ledRed = document.getElementById('led-red');
        [ledGreen, ledRed].forEach(led => {
            if (!led) return;
            const ledRect = led.getBoundingClientRect();
            const isOn = led.classList.contains('on');
            const color = led.id === 'led-green' 
                ? CONFIG.LED_COLORS.GREEN_ON 
                : CONFIG.LED_COLORS.RED_ON;
            const offColor = led.id === 'led-green'
                ? CONFIG.LED_COLORS.GREEN_OFF
                : CONFIG.LED_COLORS.RED_OFF;
            const xPos = ledRect.left - windowRect.left + (ledRect.width / 2);
            const yPos = ledRect.top - windowRect.top + (ledRect.height / 2);
            const radius = ledRect.width / 2;
            if (radius > 0) {
                ctx.beginPath();
                ctx.arc(xPos, yPos, radius, 0, 2 * Math.PI);
                ctx.fillStyle = isOn ? color : offColor;
                ctx.fill();
                if (isOn) {
                    ctx.shadowColor = color;
                    ctx.shadowBlur = 10;
                    ctx.fillStyle = color;
                    ctx.fill();
                    ctx.shadowBlur = 0;
                }
            }
        });
    }

    drawButtons(ctx, windowRect) {
        const buttons = document.querySelectorAll('.button-grid div');
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '12px Arial';
        buttons.forEach(button => {
            const details = DOMUtils.getButtonCircleDetails(button, windowRect);
            const isPressed = button.classList.contains('is-pressed');
            if (details) {
                let finalFill = details.fill;
                if (isPressed) {
                    finalFill = CONFIG.BUTTON_COLORS.PRESSED;
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
    }

    drawFeedbackCircle(ctx, windowRect) {
        const feedbackCircle = document.getElementById('circle');
        if (!feedbackCircle) return;
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

    drawTooltip(ctx, tooltipState) {
        ctx.save();
        ctx.font = '12px sans-serif';
        const padding = 6;
        const textWidth = ctx.measureText(tooltipState.text).width;
        const boxWidth = textWidth + (padding * 2);
        const boxHeight = 20;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(tooltipState.x - (boxWidth / 2), tooltipState.y, boxWidth, boxHeight);
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tooltipState.text, tooltipState.x, tooltipState.y + (boxHeight / 2));
        ctx.restore();
    }

    getVisualStream(recordingManager) {
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
        const visualZoom = this.stateManager.getVisualZoom();
        canvas.width = Math.round(totalWidth * visualZoom);
        canvas.height = Math.round(totalHeight * visualZoom);
        canvas.style.width = `${totalWidth}px`;
        canvas.style.height = `${totalHeight}px`;
        const ctx = canvas.getContext('2d');
        this.drawCanvasFrame(canvas, ctx, windowEl, keyboardImage);
        const stream = canvas.captureStream(CONFIG.FRAME_RATE);
        const intervalId = setInterval(() => {
            try {
                this.drawCanvasFrame(canvas, ctx, windowEl, keyboardImage);
            } catch (e) {
                console.error("[VIS WARN] Canvas drawImage failed. Stopping interval.", e);
                clearInterval(intervalId);
                recordingManager.setRecordingInterval(null);
                throw e;
            }
        }, 1000 / CONFIG.FRAME_RATE);
        recordingManager.setRecordingInterval(intervalId);
        return stream;
    }
}

// ----------------------------------------------------------------------------
// 8. REGISTER UTILITIES
// ----------------------------------------------------------------------------
function toHex(value, length) {
    if (typeof value !== 'number') {
        value = Number(value);
    }
    if (isNaN(value)) {
        console.error("Invalid value passed:", value);
        return "Invalid";
    }
    return value.toString(16).toUpperCase().padStart(length, '0');
}

function decimalToHex(number, bytes = 1) {
    const hexDigits = "0123456789ABCDEF";
    let hexString = '';
    if (number === 0) {
        return '0'.padStart(bytes * 2, '0');
    }
    const maxValue = Math.pow(256, bytes) - 1;
    if (number < 0 || number > maxValue) {
        throw new Error(`Number out of range for ${bytes}-byte input.`);
    }
    while (number > 0) {
        let remainder = number % 16;
        hexString = hexDigits[remainder] + hexString;
        number = Math.floor(number / 16);
    }
    return hexString.padStart(bytes * 2, '0');
}

function displayRegisters() {
    const state = zpu.getState();
    const registerList = [
        { label: 'A', value: state.a, length: 2 },
        { label: 'B', value: state.b, length: 2 },
        { label: 'C', value: state.c, length: 2 },
        { label: 'D', value: state.d, length: 2 },
        { label: 'E', value: state.e, length: 2 },
        { label: 'H', value: state.h, length: 2 },
        { label: 'L', value: state.l, length: 2 },
        { label: 'A\'', value: state.a_prime, length: 2 },
        { label: 'B\'', value: state.b_prime, length: 2 },
        { label: 'C\'', value: state.c_prime, length: 2 },
        { label: 'D\'', value: state.d_prime, length: 2 },
        { label: 'E\'', value: state.e_prime, length: 2 },
        { label: 'H\'', value: state.h_prime, length: 2 },
        { label: 'L\'', value: state.l_prime, length: 2 },
        { label: 'IX', value: state.ix, length: 4 },
        { label: 'IY', value: state.iy, length: 4 },
        { label: 'I', value: state.i, length: 2 },
        { label: 'R', value: state.r, length: 2 },
        { label: 'SP', value: state.sp, length: 4 },
        { label: 'PC', value: state.pc, length: 4 }
    ];
    const flags = `S: ${state.flags.S}, Z: ${state.flags.Z}, Y: ${state.flags.Y}, H: ${state.flags.H}, ` +
        `X: ${state.flags.X}, P: ${state.flags.P}, N: ${state.flags.N}, C: ${state.flags.C}`;
    const flagsPrime = `S: ${state.flags_prime.S}, Z: ${state.flags_prime.Z}, Y: ${state.flags_prime.Y}, H: ${state.flags_prime.H}, ` +
        `X: ${state.flags_prime.X}, P: ${state.flags_prime.P}, N: ${state.flags_prime.N}, C: ${state.flags_prime.C}`;
    let line = '\n\r';
    registerList.forEach((reg, index) => {
        const regStr = `${reg.label}:${toHex(reg.value, reg.length)}`;
        if (line.length + regStr.length + 1 <= 80) {
            line += regStr + ' ';
        } else {
            logger.write('\n\r' + line.trim() + '\n\r');
            line = regStr + ' ';
        }
        if (index === registerList.length - 1) {
            logger.write(line.trim() + '\n\r');
        }
    });
    logger.write(`Flags: ${flags}\n\r`);
    logger.write(`Flags' (Prime): ${flagsPrime}`);
}

function displayMemorySubset(start, end) {
    if (start < 0 || start >= end) {
        logger.write("Invalid range!\n");
        return;
    }
    for (let i = start; i < end; i += 16) {
        logger.write(i.toString(16).padStart(4, '0').toUpperCase() + "  ");
        for (let j = 0; j < 16 && i + j < end; j++) {
            logger.write(decimalToHex(m_mem_mapping[i + j]) + " ");
        }
        logger.write("  ");
        for (let j = 0; j < 16 && i + j < end; j++) {
            let byte = m_mem_mapping[i + j];
            if (byte >= 32 && byte <= 126) {
                logger.write(String.fromCharCode(byte));
            } else {
                logger.write(".");
            }
        }
        if (i < end - 16) logger.write("\n\r");
    }
}

// ----------------------------------------------------------------------------
// 9. MEMORY
// ----------------------------------------------------------------------------
let m_mem_mapping = new Uint8Array(65536).fill(255);
const romRegions = [];

function isRomAddress(addr) {
    for (const r of romRegions) {
        if (addr >= r.start && addr <= r.end) return true;
    }
    return false;
}

async function loadHexRom(url, baseAddr = 0x6000) {
    try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`Failed to fetch ${url}: ${resp.status}`);
        const text = await resp.text();
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        let minAddr = Infinity, maxAddr = -Infinity;
        for (const line of lines) {
            if (line[0] !== ':') continue;
            const len = parseInt(line.substr(1,2),16);
            const addr = parseInt(line.substr(3,4),16);
            const type = parseInt(line.substr(7,2),16);
            if (type === 0) {
                for (let i=0;i<len;i++) {
                    const byte = parseInt(line.substr(9 + i*2, 2), 16);
                    const dst = (baseAddr + addr + i) & 0xffff;
                    m_mem_mapping[dst] = byte;
                    if (dst < minAddr) minAddr = dst;
                    if (dst > maxAddr) maxAddr = dst;
                }
            }
        }
        if (minAddr !== Infinity) {
            romRegions.push({ start: minAddr, end: maxAddr });
            console.log(`Loaded ROM ${url} -> ${toHex(baseAddr)}..${toHex(baseAddr + (maxAddr-minAddr))}`);
        } else {
            console.warn(`No data records found in ${url}`);
        }
    } catch (e) {
        console.error('loadHexRom error', e);
    }
}

loadHexRom('/archive/prt-ib.hex', 0x6000);

try { window.loadHexRom = loadHexRom; window.listRomRegions = () => romRegions; } catch (e) {}

function mem_read(address) {
    if ((address & 0xffff) === address) {
        return m_mem_mapping[address];
    }
    console.error("No Mem replied to memory read: " + address);
    return 0;
}

function mem_write(address, value) {
    address &= 0xffff;
    value &= 0xff;
    if (isRomAddress(address)) {
        console.warn(`Attempt to write to ROM at ${toHex(address)} ignored (value ${toHex(value)})`);
        return;
    }
    if (address > 0x17ff && address < 0x2000) {
        m_mem_mapping[address] = value;
    } else {
        if (!((address == 0 && value == 0x10) ||
            (address == 1 & value == 0x20) ||
            (address == 0x1000 & value == 0) ||
            (address == 0xffff & value == 0xff)))
            console.error(`PC: ${toHex(zpu ? zpu.getState().pc : 0)} Invalid memory at: ${toHex(address)} value: ${toHex(value)}`);
    }
}

// Initialize memory
mem_write(0, 0x10);
mem_write(1, 0x20);

// ----------------------------------------------------------------------------
// 10. DISPLAY I/O
// ----------------------------------------------------------------------------
const IO_PORT_DATA = 0x01;
const IO_PORT_DIGIT_SELECT = 0x02;
const IO_PORT_CA = 0xCA;
const DIGIT_SELECT_MASK = 0x3f;
const SEGMENT_DISPLAY_MAPPING = {
    0x01: "svg-object-data0",
    0x02: "svg-object-data1",
    0x04: "svg-object-add0",
    0x08: "svg-object-add1",
    0x10: "svg-object-add2",
    0x20: "svg-object-add3"
};
const SEGMENT_BIT_MAP = {
    0x01: 'e', 0x02: 'g', 0x04: 'f', 0x08: 'a',
    0x10: 'b', 0x20: 'c', 0x40: 'dp', 0x80: 'd'
};
const SEGMENT_COLOR_ON = "red";
const SEGMENT_COLOR_OFF = "white";
const ZERO_HISTORY_THRESHOLD = 2;

let digitSelect;
let run_digit = "";
let debug = false;

let zeroHistory = {
    a: 0, b: 0, c: 0, d: 0,
    e: 0, f: 0, g: 0, dp: 0
};

let seg = {
    a: SEGMENT_COLOR_OFF, 
    b: SEGMENT_COLOR_OFF, 
    c: SEGMENT_COLOR_OFF, 
    d: SEGMENT_COLOR_OFF,
    e: SEGMENT_COLOR_OFF, 
    f: SEGMENT_COLOR_OFF, 
    g: SEGMENT_COLOR_OFF, 
    dp: SEGMENT_COLOR_OFF
};

function io_write(address, value) {
    const port = address & 0xff;
    if (debug) {
        console.log(`${decimalToHex(port)}:${decimalToHex(value & DIGIT_SELECT_MASK)}::${toHex(zpu.getState().pc, 4)}`);
    }
    switch (port) {
        case IO_PORT_DIGIT_SELECT:
            if ((value & 0x80) == 0x80) {
                if (zpu.getState().l == 0x5e) {
                    document.getElementById("led-green").classList.add("on");
                    beepTone(zpu.getState().c * 10, (256 * zpu.getState().h) + zpu.getState().l);
                    if (debug) {
                        console.log(`${decimalToHex(value)} = ${decimalToHex(zpu.getState().h)} ${decimalToHex(zpu.getState().l)} :: ${decimalToHex(zpu.getState().c)} ${decimalToHex(zpu.getState().b)}\n\r`);
                    }
                }
            }
            handleRunDigit(value);
            break;
        case IO_PORT_DATA:
            updateSegmentDisplay(value);
            break;
        case IO_PORT_CA:
            io_write_ca(address, value);
            break;
        default:
            console.warn(`No IO handled for write to: ${decimalToHex(port)} value: ${decimalToHex(value)} at ${toHex(zpu.getState().pc, 4)}`);
            break;
    }
}

function handleRunDigit(value) {
    digitSelect = value & DIGIT_SELECT_MASK;
    run_digit = SEGMENT_DISPLAY_MAPPING[digitSelect] || "";
    if (debug && run_digit) {
        console.log(`run_digit: ${run_digit} value: ${decimalToHex(digitSelect)}`);
    }
}

function updateSegmentDisplay(value) {
    for (const mask in SEGMENT_BIT_MAP) {
        const segName = SEGMENT_BIT_MAP[mask];
        const bitOn = (value & parseInt(mask, 10)) !== 0;
        if (bitOn) {
            seg[segName] = SEGMENT_COLOR_ON;
            zeroHistory[segName] = 0;
        } else {
            zeroHistory[segName]++;
            if (zeroHistory[segName] >= ZERO_HISTORY_THRESHOLD) {
                seg[segName] = SEGMENT_COLOR_OFF;
            }
        }
    }
    updateSVGDisplay();
}

function updateSVGDisplay() {
    if (!document.getElementById(run_digit)) return;
    const svg = document.getElementById(run_digit).contentDocument;
    for (let s in seg) {
        const elem = svg.getElementById(s);
        if (elem) {
            elem.setAttribute("fill", seg[s]);
        }
    }
    if (debug) {
        console.log(`Updated SVG for: ${run_digit} with colors: ${JSON.stringify(seg)}`);
    }
}

// ----------------------------------------------------------------------------
// 11. AUDIO MANAGER
// ----------------------------------------------------------------------------
class AudioManager {
    constructor() {
        this.audioContext = null;
        this.oscillator = null;
        this.gainNode = null;
        this.isBeeping = false;
        this.audioDestination = null;
    }

    startSession(initialFreq = 100) {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.oscillator = this.audioContext.createOscillator();
            this.gainNode = this.audioContext.createGain();
            this.audioDestination = this.audioContext.createMediaStreamDestination();
            const safeInitialFreq = (typeof initialFreq === 'number' && isFinite(initialFreq)) ? initialFreq : 100;
            this.oscillator.frequency.value = safeInitialFreq;
            this.gainNode.gain.value = 0.05;
            this.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            this.oscillator.connect(this.gainNode);
            this.gainNode.connect(this.audioDestination);
            this.gainNode.connect(this.audioContext.destination);
            this.oscillator.start(0);
            console.log("Audio Context Initialized and Oscillator Running.");
        }
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume().then(() => {
                console.log('AudioContext resumed successfully during initialization.');
            }).catch(() => {
                console.log('AudioContext remains suspended. A user gesture is required to resume.');
            });
        }
    }

    resumeContext() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume().then(() => {
                console.log('AudioContext resumed via user action.');
            }).catch(e => {
                console.error('Failed to resume AudioContext:', e);
            });
        }
    }

    getDestination() {
        return this.audioDestination;
    }

    stopRecording() {
        // Legacy method - recording now handled by RecordingManager
        // Kept for backward compatibility with stopAudioSession()
    }

    beep(freq = 440, durationMs = 100, volume = 0.05) {
        this.startSession(freq);
        document.getElementById("led-green")?.classList.add("on");
        if (this.audioContext && this.audioContext.state !== 'closed') {
            if (this.isBeeping) return;
            this.isBeeping = true;
            const safeFreq = (typeof freq === 'number' && isFinite(freq)) ? freq : 440;
            this.gainNode.gain.cancelAndHoldAtTime(this.audioContext.currentTime);
            this.oscillator.frequency.setValueAtTime(safeFreq, this.audioContext.currentTime);
            this.gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
            setTimeout(() => {
                this.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
                this.isBeeping = false;
                document.getElementById("led-green")?.classList.remove("on");
            }, durationMs);
        } else {
            console.error("Audio Context not available. State:", this.audioContext ? this.audioContext.state : 'null');
            document.getElementById("led-green")?.classList.remove("on");
        }
    }

    downloadBlob(blob, filename) {
        try {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            return true;
        } catch (error) {
            console.error("Download error:", error);
            return false;
        }
    }
}

const audioManager = new AudioManager();

window.triggerDownload = function(blob, filename) {
    return audioManager.downloadBlob(blob, filename);
};

window.getAudioDestination = function() {
    return audioManager.getDestination();
};

window.resumeAudioContext = function() {
    audioManager.resumeContext();
};

window.globalAudioContext = null;
Object.defineProperty(window, 'globalAudioContext', {
    get() { return audioManager.audioContext; },
    set(val) { /* read-only */ }
});


function startAudioSession(initialFreq = 100) {
    audioManager.startSession(initialFreq);
}

function beepTone(freq = 440, durationMs = 100, volume = 0.05) {
    audioManager.beep(freq, durationMs, volume);
}

function stopAudioSession() {
    audioManager.stopRecording();
}

window.stopAudioSession = stopAudioSession;

function initAudioOnFirstGesture() {
    function onFirstGesture() {
        try {
            audioManager.startSession();
            if (audioManager.audioContext && audioManager.audioContext.state === 'suspended') {
                audioManager.audioContext.resume().catch(() => {});
            }
        } catch (e) {
            console.error('Failed to start audio on first gesture:', e);
        }
    }
    document.addEventListener('click', onFirstGesture, { once: true, passive: true });
    document.addEventListener('keydown', onFirstGesture, { once: true, passive: true });
}

initAudioOnFirstGesture();

// ----------------------------------------------------------------------------
// 12. KEY MAP
// ----------------------------------------------------------------------------
const keyMap = [
    { rowcol: 0, pc: 0x3e, pa: 0x1f, scani: "", scan: 0x00, key: "RESET", x: 32, y: 33 },
    { rowcol: 1, pc: 0x1f, pa: 0x1f, scani: "K23", scan: 0x1c, key: "MOVE", x: 287, y: 229 },
    { rowcol: 2, pc: 0x1f, pa: 0x2f, scani: "K22", scan: 0x16, key: "INS", x: 159, y: 32 },
    { rowcol: 3, pc: 0x1f, pa: 0x3e, scani: "K1B", scan: 0x1e, key: "SBR", x: 223, y: 32 },
    { rowcol: 4, pc: 0x2f, pa: 0x3d, scani: "K19", scan: 0x18, key: "PC", x: 287, y: 33 },
    { rowcol: 5, pc: 0x37, pa: 0x37, scani: "K15", scan: 0x0c, key: "HEX_C", x: 351, y: 33 },
    { rowcol: 6, pc: 0x3b, pa: 0x37, scani: "KF", scan: 0x0d, key: "HEX_D", x: 415, y: 33 },
    { rowcol: 7, pc: 0x3d, pa: 0x37, scani: "K9", scan: 0x0e, key: "HEX_E", x: 478, y: 33 },
    { rowcol: 8, pc: 0x3e, pa: 0x37, scani: "K3", scan: 0x0f, key: "HEX_F", x: 542, y: 33 },
    { rowcol: 9, pc: 1, pa: 1, scani: "", scan: 0x00, key: "MONI", x: 32, y: 98 },
    { rowcol: 10, pc: 0x2f, pa: 0x1f, scani: "K1D", scan: 0x1d, key: "RELA", x: 96, y: 98 },
    { rowcol: 11, pc: 0x2f, pa: 0x2f, scani: "K1C", scan: 0x17, key: "DEL", x: 159, y: 98 },
    { rowcol: 12, pc: 0x2f, pa: 0x3e, scani: "K18", scan: 0x1a, key: "CBR", x: 223, y: 98 },
    { rowcol: 13, pc: 0x2f, pa: 0x3b, scani: "K1A", scan: 0x1b, key: "REG", x: 287, y: 98 },
    { rowcol: 14, pc: 0x37, pa: 0x3b, scani: "K14", scan: 0x08, key: "HEX_8", x: 351, y: 98 },
    { rowcol: 15, pc: 0x3b, pa: 0x3b, scani: "K0E", scan: 0x09, key: "HEX_9", x: 415, y: 98 },
    { rowcol: 16, pc: 0x3d, pa: 0x3b, scani: "K8", scan: 0x0a, key: "HEX_A", x: 478, y: 98 },
    { rowcol: 17, pc: 0x3e, pa: 0x3b, scani: "K2", scan: 0x0b, key: "HEX_B", x: 542, y: 98 },
    { rowcol: 18, pc: 1, pa: 1, scani: "", scan: 0x00, key: "INTR", x: 32, y: 164 },
    { rowcol: 19, pc: 0x37, pa: 0x1f, scani: "K17", scan: 0x1e, key: "TAPEWR", x: 96, y: 164 },
    { rowcol: 20, pc: 0x3b, pa: 0x2f, scani: "K10", scan: 0x13, key: "STEP", x: 159, y: 164 },
    { rowcol: 21, pc: 0x1f, pa: 0x3d, scani: "K1F", scan: 0x11, key: "-", x: 223, y: 164 },
    { rowcol: 22, pc: 0x1f, pa: 0x3b, scani: "K20", scan: 0x14, key: "DATA", x: 287, y: 164 },
    { rowcol: 23, pc: 0x37, pa: 0x3d, scani: "K13", scan: 0x04, key: "HEX_4", x: 351, y: 164 },
    { rowcol: 24, pc: 0x3b, pa: 0x3d, scani: "KD", scan: 0x05, key: "HEX_5", x: 415, y: 164 },
    { rowcol: 25, pc: 0x3d, pa: 0x3d, scani: "K7", scan: 0x06, key: "HEX_6", x: 475, y: 164 },
    { rowcol: 26, pc: 0x3e, pa: 0x3d, scani: "K1", scan: 0x07, key: "HEX_7", x: 542, y: 164 },
    { rowcol: 27, pc: 1, pa: 0xbf, scani: "", scan: 0x00, key: "USER KEY", x: 31, y: 229 },
    { rowcol: 28, pc: 0x3b, pa: 0x1f, scani: "K11", scan: 0x1f, key: "TAPERD", x: 96, y: 229 },
    { rowcol: 29, pc: 0x37, pa: 0x2f, scani: "K16", scan: 0x12, key: "GO", x: 159, y: 229 },
    { rowcol: 30, pc: 0x1f, pa: 0x37, scani: "K21", scan: 0x10, key: "+", x: 223, y: 229 },
    { rowcol: 31, pc: 0x2f, pa: 0x37, scani: "K1B", scan: 0x19, key: "ADDR", x: 287, y: 229 },
    { rowcol: 32, pc: 0x37, pa: 0x3e, scani: "K12", scan: 0x00, key: "HEX_0", x: 351, y: 229 },
    { rowcol: 33, pc: 0x3b, pa: 0x3e, scani: "K0C", scan: 0x01, key: "HEX_1", x: 415, y: 229 },
    { rowcol: 34, pc: 0x3d, pa: 0x3e, scani: "K6", scan: 0x02, key: "HEX_2", x: 475, y: 229 },
    { rowcol: 35, pc: 0x3e, pa: 0x3e, scani: "K0", scan: 0x03, key: "HEX_3", x: 542, y: 229 },
];

// ----------------------------------------------------------------------------
// 13. KEYBOARD HANDLERS
// ----------------------------------------------------------------------------
let keypressed = false;
const rows = 4;
const cols = 9;
let cellWidth;
let cellHeight;
let row;
let col;
let image;

window.onload = function () {
    image = document.getElementById('keyboard-image');
    const imageContainer = document.querySelector('.image-container');
    if (image) {
        cellWidth = image.width / cols;
        cellHeight = image.height / rows;
        for (let row1 = 0; row1 < rows; row1++) {
            for (let col1 = 0; col1 < cols; col1++) {
                const cell = document.createElement('div');
                cell.style.left = `${col1 * cellWidth}px`;
                cell.style.top = `${row1 * cellHeight}px`;
                cell.style.width = `${cellWidth}px`;
                cell.style.height = `${cellHeight}px`;
                imageContainer.appendChild(cell);
            }
        }
        moveCircle(0, 0, 0);
    }
    else {
        console.error('Image element not found!');
    }
    image.addEventListener('mousemove', function () {
        const circle = document.getElementById('circle');
        if (circle) circle.style.display = 'none';
    });
    image.addEventListener('mousedown', function (event) {
        keypressed = true;
        const rect = image.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        col = Math.floor(x / cellWidth);
        row = Math.floor(y / cellHeight);
        moveCircle(x, y, 1);
    });
    image.addEventListener('mouseup', function () {
        moveCircle(0, 0, 0);
    });
}

// ----------------------------------------------------------------------------
// 14. MTP201 PRINTER EMULATION
// ----------------------------------------------------------------------------
window.mtp201 = {
    active: true,
    TG_BIT: 0x01,
    HOME_BIT: 0x02,
    motorOn: false,
    busyPolls: 0,
    tgCounter: 0,
    TG_PHASE_WIDTH: 25,
    headBits: 7,
    columnBuffer: [],
    currentX: 0, 
    currentY: 10, 
    LINE_SPACING: 2,
    isHome: true,
    lineHasData: false,
    skipFirst: false
};

const MTP201_WATCHDOG = 20000; 
const MAX_PAPER_HEIGHT = 9000;

function flushPrinterBuffer() {
    const m = window.mtp201;
    const canvas = document.getElementById('mtpScreen');
    const container = document.getElementById('printer-scroll-box');
    if (!m.columnBuffer || m.columnBuffer.length === 0) return;
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = "#000000"; 
        for (let col = 0; col < m.columnBuffer.length; col++) {
            let data = m.columnBuffer[col];
            if (data > 0) {
                m.lineHasData = true; 
                for (let bit = 0; bit < m.headBits; bit++) {
                    if (data & (1 << bit)) {
                        ctx.fillRect(m.currentX + col, m.currentY + (m.headBits - 1 - bit), 1.1, 1.1);
                    }
                }
            }
        }
        m.currentX += m.columnBuffer.length;
        if (container) {
            container.scrollTop = m.currentY - 40; 
        }
    }
    m.columnBuffer = [];
}

window.io_write_ca = function (port, value) {
    const m = window.mtp201;
    const thermalData = value & 0x7F;
    const motorBit = (value & 0x80) !== 0;
    if (motorBit && !m.motorOn && m.isHome) {
        if (m.lineHasData) {
            m.currentY += (m.headBits + m.LINE_SPACING);
            m.currentX = 0; 
            m.lineHasData = false;
            if (m.currentY > MAX_PAPER_HEIGHT - 50) {
                const canvas = document.getElementById('mtpScreen');
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                m.currentY = 10;
            }
        }
        m.isHome = false; 
        m.skipFirst = true;
    }
    if (motorBit || m.motorOn) {
        if (m.skipFirst) m.skipFirst = false;
        else m.columnBuffer.push(thermalData);
        m.busyPolls = MTP201_WATCHDOG;
    }
    if (motorBit && !m.motorOn) {
        m.motorOn = true;
    } else if (!motorBit && m.motorOn) {
        m.motorOn = false;
        flushPrinterBuffer();
        m.isHome = true; 
    }
};

window.io_read_cb = function (port) {
    const m = window.mtp201;
    let status = 0x00;
    if (m.isHome) status |= m.HOME_BIT;
    if (m.motorOn) {
        m.tgCounter++;
        if (Math.floor(m.tgCounter / m.TG_PHASE_WIDTH) % 2 === 0) status |= m.TG_BIT;
        if (m.busyPolls > 0) m.busyPolls--;
        else {
            m.motorOn = false;
            m.isHome = true;
            flushPrinterBuffer();
        }
    }
    return status;
};

// ----------------------------------------------------------------------------
// 15. Z80 CPU INITIALIZATION
// ----------------------------------------------------------------------------
var zpu;

function initZpu() {
    zpu = Z80({ mem_read, mem_write, io_read, io_write });
    try { window.zpu = zpu; } catch (e) {}
}

initZpu();

let keyDelay = 4;

function destroyZpu() {
    if (!zpu) return;
    try {
        if (typeof zpu.destroy === 'function') zpu.destroy();
        if (typeof zpu.stop === 'function') zpu.stop();
        if (typeof zpu.dispose === 'function') zpu.dispose();
        if (typeof zpu.terminate === 'function') zpu.terminate();
    } catch (e) {
        console.warn('destroyZpu: error calling instance cleanup methods', e);
    }
    try {
        if (zpu._intervals && Array.isArray(zpu._intervals)) {
            zpu._intervals.forEach(id => clearInterval(id));
        }
    } catch (e) {}
    try { if (window.zpu === zpu) window.zpu = null; } catch (e) {}
    zpu = null;
}

try { window.initZpu = initZpu; window.destroyZpu = destroyZpu; } catch (e) {}

const IO_PORT_CB = 0xCB;

function io_read(address) {
    const port = address & 0xFF;
    if (port === IO_PORT_CB) {
       return io_read_cb(port);
    }
    if (!keypressed) return 0xff;
    let keyLoc = (row * 9) + col;
    if (debug) {
        console.log(
            "row: " + (row + 1) +
            " col: " + (col + 1) +
            " rowcol: " + toHex(keyMap[keyLoc].rowcol) +
            " Digit: " + toHex(digitSelect) +
            " KeyIn: " + toHex(keyMap[keyLoc].pa) +
            " scani: " + keyMap[keyLoc].scani +
            " Scan: " + toHex(keyMap[keyLoc].scan) +
            " digitSelect: " + toHex(digitSelect) +
            " keyDelay: " + keyDelay +
            " keyMap[keyLoc].pc: " + toHex(keyMap[keyLoc].pc) +
            " Key: " + keyMap[keyLoc].key);
    }
    if ((digitSelect & keyMap[keyLoc].pc) == keyMap[keyLoc].pc) {
        if (keyDelay-- < 0) {
            keypressed = false;
        }
        if (keyLoc == 0) {
            let state = zpu.getState();
            state.pc = 0;
            zpu.setState(state);
            return 0xff;
        }
        else if (keyLoc == 18) {
            let state = zpu.getState();
            state.iff1 = 1;
            zpu.setState(state);
            zpu.interrupt(false, 0);
            return 0xff;
        }
        else if (keyLoc == 9) {
            zpu.interrupt(true, 0);
            return 0xff;
        }
        return keyMap[keyLoc].pa;
    }
    return 0xff;
}

// ----------------------------------------------------------------------------
// 16. COMMANDS
// ----------------------------------------------------------------------------
async function waitFor10ms(start) {
    while (Date.now() - start <= 10) {
        await new Promise(resolve => setTimeout(resolve, 0));
    }
}

function getZpu() {
    if (typeof zpu !== 'undefined') return zpu;
    if (typeof window !== 'undefined' && window.zpu) return window.zpu;
    return null;
}

function executeCommand(command) {
    const [cmd, ...args] = command.split(' ');
    function getBreakpoint() {
        return (typeof window !== 'undefined' && typeof window.breakpoint !== 'undefined') ? window.breakpoint : 0xffff;
    }
    const commands = {
        'exit': () => {
            logger.write('\n\rExiting...');
        },
        'go': async () => {
            const zpu = getZpu();
            if (!zpu) {
                logger.write('\n\rERROR: ZPU not initialized.\n\r> ');
                return;
            }
            let num = args.length && !isNaN(Number(args[0])) ? Number(args[0]) : 10;
            logger.write('\n\r');
            let cycle_counter = 0;
            let start = Date.now();
            while (num-- > 0 && zpu.getState().pc !== getBreakpoint()) {
                cycle_counter += zpu.run_instruction();
                if (cycle_counter > 18000) {
                    await waitFor10ms(start);
                    cycle_counter = 0;
                    start = Date.now();
                }
            }
            displayRegisters();
            logger.write('\n\r> ');
        },
        'run': async () => {
            const zpu = getZpu();
            if (!zpu) {
                logger.write('\n\rERROR: ZPU not initialized.\n\r> ');
                return;
            }
            logger.write('\n\r> ');
            let cycle_counter = 0;
            let start = Date.now();
            while (zpu.getState().pc !== getBreakpoint()) {
                cycle_counter += zpu.run_instruction();
                if (cycle_counter > 18000) {
                    await waitFor10ms(start);
                    cycle_counter = 0;
                    start = Date.now();
                }
            }
            displayRegisters();
            logger.write('\n\r> ');
        },
        'pc': () => {
            const zpu = getZpu();
            if (!zpu) {
                logger.write('\n\rERROR: ZPU not initialized.\n\r> ');
                return;
            }
            let num = (args.length && !isNaN(parseInt(args[0], 16))) ? parseInt(args[0], 16) : zpu.getState().pc;
            let state = zpu.getState();
            state.pc = num;
            zpu.setState(state);
        },
        'break': () => {
            if (args.length == 1) {
                let num = (args.length && !isNaN(parseInt(args[0], 16))) ? parseInt(args[0], 16) : 0;
                if (typeof window !== 'undefined') window.breakpoint = num;
            }
            logger.write('\n\r' + decimalToHex(getBreakpoint(), 2) + '\n\r> ');
        },
        'debug': () => {
            debug = !debug;
            logger.write('\n\r' + debug);
        },
        'reg': () => {
            logger.write('\n\r');
            displayRegisters();
        },
        'set': () => logger.write('\nEcho: ' + currentCommand.slice(5).trim()),
        'dump': () => {
            const zpu = getZpu();
            if (!zpu) {
                logger.write('\n\rERROR: ZPU not initialized.\n\r> ');
                return;
            }
            logger.write('\n\r');
            let start = args.length && !isNaN(parseInt(args[0], 16)) ? parseInt(args[0], 16) : zpu.getState().pc;
            let end = args.length && !isNaN(parseInt(args[1], 16)) ? parseInt(args[1], 16) : start + 128;
            displayMemorySubset(start, end);
            displayRegisters();
            logger.write('\n\r> ');
        },
        'step': () => {
            const zpu = getZpu();
            if (!zpu) {
                logger.write('\n\rERROR: ZPU not initialized.\n\r> ');
                return;
            }
            zpu.run_instruction();
            displayRegisters();
            logger.write('\n\r> ');
        },
        's': () => {
            const zpu = getZpu();
            if (!zpu) {
                logger.write('\n\rERROR: ZPU not initialized.\n\r> ');
                return;
            }
            zpu.run_instruction();
            logger.write('\n\r> ');
        },
        'load': () => {
            const allowedValues = ['DEFAULT', 'HELLO', 'CURRENT', "SOUND", "SIREN", "HELPUS", "HELPUSFLASH", "KEYCODE", "POSCODE"];
            if ((args.length == 1) && allowedValues.includes(args[0].trim().toUpperCase())) {
                load(args[0].trim().toUpperCase());
            }
            else
                load();
        },
        'file': () => {
            file();
        },
        'default': () => {
            logger.write(`\ncommand not found: ${command}\n\r> `);
        }
    };
    (commands[cmd] || commands['default'])();
}

// ----------------------------------------------------------------------------
// 17. INTEL HEX PARSER
// ----------------------------------------------------------------------------
function parseIntelHex(hexString, dataArrays) {
    const lines = hexString.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    let address;
    let length;
    for (const line of lines) {
        if (line[0] !== ':') {
            throw new Error("Invalid Intel HEX line, should start with ':'");
        }
        length = parseInt(line.substr(1, 2), 16);
        address = parseInt(line.substr(3, 4), 16);
        const type = parseInt(line.substr(7, 2), 16);
        const data = line.substr(9, length * 2);
        let j = 0;
        for (let i = 0; i < data.length; i += 2, j++) {
            const byte = parseInt(data.substr(i, 2), 16);
            dataArrays[address + j] = byte;
        }
    }
    return { address: address, length: length, data: dataArrays.slice(address, address + length) };
}

let fileContent;
const fileUrl = '/archive/monitor_and_tiny_basic.u6.hex';

logFileContent(fileUrl);

async function logFileContent(fileUrl) {
    await fetchFileAndLog(fileUrl);
    parseIntelHex(fileContent, m_mem_mapping);
}   

async function fetchFileAndLog(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch the file: ${response.statusText}`);
        }
        fileContent = await response.text();
    } catch (error) {
        console.error('Error fetching the file:', error);
    }
}

// ----------------------------------------------------------------------------
// 18. AUTOMATION
// ----------------------------------------------------------------------------
async function waitFor200ms() {
  return new Promise(resolve => setTimeout(resolve, 200));
}

function pressKey(key) {
  for (const entry of keyMap) {
    if (entry.key === key) {
      keypressed = true;
      const image = document.getElementById('keyboard-image');
      const rect = image.getBoundingClientRect();
      const nativeW = image.naturalWidth || rect.width || 574;
      const nativeH = image.naturalHeight || rect.height || 262;
      const scaleX = rect.width / nativeW;
      const scaleY = rect.height / nativeH;
      const clickX = rect.left + (entry.x * scaleX);
      const clickY = rect.top + (entry.y * scaleY);
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        clientX: clickX,
        clientY: clickY,
      });
      image.dispatchEvent(clickEvent);
    }
  }
}

async function moveCircle(x, y, z) {
  if (z == 0) await new Promise(r => setTimeout(r, 100));
  const circle = document.getElementById('circle');
  circle.style.left = `${x - circle.offsetWidth / 2}px`;
  circle.style.top = `${y - circle.offsetHeight / 2}px`;
  circle.style.display = 'block';
  circle.style.opacity = z;
}

async function load(SET_KEY = 'DEFAULT') {
  let codeRows;
  startAudioSession();
  try {
    const response = await fetch('./resources/hex-data.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const HEX_CODE_SETS = await response.json();
    codeRows = HEX_CODE_SETS[SET_KEY];
  } catch (error) {
    console.error("Could not load HEX_CODE_SETS:", error);
  }
  let memBlock = new Uint8Array(codeRows.length).fill(255);
  let dummyMem = new Uint8Array(0x10000).fill(255);
  const codeArray = codeRows.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  for (const code of codeArray) {
    pressKey("ADDR");
    await waitFor200ms();
    memBlock = parseIntelHex(code, dummyMem);
    const addressChunks = [
      Math.floor(memBlock.address / 0x1000),
      Math.floor((memBlock.address % 0x1000) / 0x100),
      Math.floor((memBlock.address % 0x100) / 0x10),
      Math.floor(memBlock.address % 0x10)
    ];
    for (let i = 0; i < addressChunks.length; i++) {
      pressKey(`HEX_${addressChunks[i].toString(16).toUpperCase().padStart(1, '0')}`);
      await waitFor200ms();
    }
    pressKey("DATA");
    await waitFor200ms();
    for (let i = 0; i < memBlock.data.length; i++) {
      const dataByte = memBlock.data[i];
      pressKey(`HEX_${Math.floor(dataByte / 0x10).toString(16).toUpperCase().padStart(1, '0')}`);
      await waitFor200ms();
      pressKey(`HEX_${(dataByte % 0x10).toString(16).toUpperCase().padStart(1, '0')}`);
      await waitFor200ms();
      pressKey("+");
      await waitFor200ms();
    }
  }
  pressKey("ADDR"); await waitFor200ms();
  pressKey("HEX_1"); await waitFor200ms();
  pressKey("HEX_8"); await waitFor200ms();
  pressKey("HEX_0"); await waitFor200ms();
  pressKey("HEX_0"); await waitFor200ms();
  pressKey("GO"); await waitFor200ms();
  dummyMem = null;
  memBlock = null;
  stopAudioSession();
}

function file() {
  // Note: file-upload element not present in HTML
  if (term) term.write('\r\nFile upload not available.\r\n> ');
}

// ----------------------------------------------------------------------------
// 19. MAIN APPLICATION
// ----------------------------------------------------------------------------
const stateManager = new StateManager();
const recordingManager = new RecordingManager();
const keyboardManager = new KeyboardManager(stateManager);
const visualRenderer = new VisualRenderer(stateManager);

try { 
    window.stateManager = stateManager;
    window.recordingManager = recordingManager;
    window.keyboardManager = keyboardManager;
    window.visualRenderer = visualRenderer;
} catch (e) {}

// Keyboard functions - direct access via keyboardManager
function initKeyboardSelector() {
    keyboardManager.initKeyboardSelector();
}

function toggleKeyboard() {
    keyboardManager.toggleKeyboard();
}

try { window.toggleKeyboard = toggleKeyboard; } catch (e) {}

function setVisualZoom(scale) {
    const newZoom = stateManager.setVisualZoom(scale);
    DOMUtils.applyUIScale(newZoom);
}

function zoomInVisual() { 
    setVisualZoom(stateManager.getVisualZoom() + CONFIG.VISUAL_ZOOM.STEP); 
}

function zoomOutVisual() { 
    setVisualZoom(stateManager.getVisualZoom() - CONFIG.VISUAL_ZOOM.STEP); 
}

function resetVisualZoom() { 
    setVisualZoom(CONFIG.VISUAL_ZOOM.DEFAULT); 
}

try { 
    window.zoomInVisual = zoomInVisual; 
    window.zoomOutVisual = zoomOutVisual; 
    window.resetVisualZoom = resetVisualZoom; 
    window.setVisualZoom = setVisualZoom; 
} catch (e) {}

// Expose DOMUtils.applyUIScale directly for debugging
try { window.applyUIScale = DOMUtils.applyUIScale.bind(DOMUtils); } catch (e) {}


function initTooltipTracking() {
    const buttons = document.querySelectorAll('.button-grid div');
    const windowEl = document.getElementById('window');
    buttons.forEach(btn => {
        btn.addEventListener('mouseenter', () => {
            const title = btn.getAttribute('title');
            if (title) {
                const rect = btn.getBoundingClientRect();
                const winRect = windowEl.getBoundingClientRect();
                stateManager.setTooltipState({
                    text: title,
                    visible: true,
                    x: rect.left - winRect.left + (rect.width / 2),
                    y: rect.bottom - winRect.top + 5
                });
            }
        });
        btn.addEventListener('mouseleave', () => {
            stateManager.resetTooltip();
        });
    });
}

function getVisualStream() {
    return visualRenderer.getVisualStream(recordingManager);
}

function handlePower() {
    const element = DOMUtils.getButtonByTitle('Power');
    if (!element) return;
    const currentState = recordingManager.getFeatureState();
    const newPowerState = !currentState.power;
    recordingManager.setFeatureState('power', newPowerState);
    if (newPowerState) {
        DOMUtils.updateButtonState(element, true, CONFIG.BUTTON_COLORS.POWER_ON);
        if (window.resumeAudioContext) window.resumeAudioContext();
        if (typeof executeCommand === 'function') executeCommand('run');
        term.write('\r\nSystem Powered ON.\r\n> ');
    } else {
        if (typeof destroyZpu === 'function') destroyZpu();
        DOMUtils.updateButtonState(element, false, CONFIG.BUTTON_COLORS.POWER_OFF);
        term.write('\r\nSystem Powered OFF.\r\n> ');
    }
}

function handleAudioIn() {
    const element = DOMUtils.getButtonByTitle('Audio In');
    if (!element) return;
    DOMUtils.flashButton(element, CONFIG.BUTTON_COLORS.WARNING, 200);
    term.write('\r\nAudio Input: Waiting for file upload...\r\n> ');
}

function handleAudioRecord() {
    const element = DOMUtils.getButtonByTitle('Audio Record');
    if (!element) return;
    const currentState = recordingManager.getFeatureState();
    if (currentState.audioRecord) {
        const stopped = recordingManager.stopAudioRecording(window.triggerDownload, term);
        if (stopped) {
            DOMUtils.updateLED('led-green', false);
            DOMUtils.updateButtonState(element, false, CONFIG.BUTTON_COLORS.DEFAULT);
        }
    } else {
        const started = recordingManager.startAudioRecording(
            window.getAudioDestination,
            term
        );
        if (started) {
            DOMUtils.updateLED('led-green', true);
            DOMUtils.updateButtonState(element, true, CONFIG.BUTTON_COLORS.ACTIVE);
        }
    }
}

function handleScreenRecord() {
    const element = DOMUtils.getButtonByTitle('Screen Record');
    if (!element) return;
    const currentState = recordingManager.getFeatureState();
    if (currentState.screenRecord) {
        const stopped = recordingManager.stopScreenRecording(term);
        if (stopped) {
            DOMUtils.updateButtonState(element, false, CONFIG.BUTTON_COLORS.DEFAULT);
        }
    } else {
        const started = recordingManager.startScreenRecording(
            () => getVisualStream(),
            window.getAudioDestination,
            window.beepTone,
            term
        );
        if (started) {
            DOMUtils.updateButtonState(element, true, CONFIG.BUTTON_COLORS.PRESSED);
        } else {
            DOMUtils.updateButtonState(element, false, CONFIG.BUTTON_COLORS.DEFAULT);
        }
    }
}

function handleDumpBuffer() {
    const element = DOMUtils.getButtonByTitle('Dump Buffer');
    if (!element) return;
    const currentState = recordingManager.getFeatureState();
    if (currentState.screenRecord) {
        term.write('\r\nCannot dump: Screen recording is in progress. Stopping...\r\n> ');
        handleScreenRecord();
        return;
    }
    const success = recordingManager.dumpBuffer(window.triggerDownload, term);
    if (success) {
        DOMUtils.flashButton(element, CONFIG.BUTTON_COLORS.INFO, 500);
    } else {
        DOMUtils.flashButton(element, CONFIG.BUTTON_COLORS.WARNING, 200);
    }
}

function handleLoadAndRunScript() {
    const element = DOMUtils.getButtonByTitle('Load & Run');
    if (!element) return;
    DOMUtils.flashButton(element, CONFIG.BUTTON_COLORS.PURPLE, 200);
    term.write('\r\nScript Load & Run: Triggering file selection...\r\n> ');
}

// Expose button handlers to window
try {
    window.handlePower = handlePower;
    window.handleAudioIn = handleAudioIn;
    window.handleAudioRecord = handleAudioRecord;
    // Expose for console/debugging use (no HTML buttons)
    window.handleScreenRecord = handleScreenRecord;
    window.handleDumpBuffer = handleDumpBuffer;
    window.handleLoadAndRunScript = handleLoadAndRunScript;
} catch (e) {}

let term;
if (typeof Terminal !== 'undefined') {
    term = new Terminal({ cols: 80, rows: 24 });
} else if (window.term) {
    term = window.term;
} else {
    term = {
        write: (s) => console.log(String(s).replace(/\r/g, '')),
        onData: () => {},
        open: () => {},
        dispose: () => {},
    };
    window.term = term;
}

// Terminal container not present in HTML - using console logger instead

term.write("Welcome to the virtual upf--1\r\n> "); 

let currentCommand = '';

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

document.addEventListener('DOMContentLoaded', () => {
    DOMUtils.clearAll7SegmentDisplays();
    DOMUtils.updateLED('led-red', false);
    DOMUtils.updateLED('led-green', false);
    const powerButton = DOMUtils.getButtonByTitle('Power');
    if (powerButton) {
        DOMUtils.updateButtonState(powerButton, false, CONFIG.BUTTON_COLORS.POWER_OFF);
    }
    initTooltipTracking();
    try { initKeyboardSelector(); } catch (e) {}
});

