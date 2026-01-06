// ----------------------------------------------------------------------
// JAVASCRIPT LOGIC AND HOOKS
// ----------------------------------------------------------------------

import { CONFIG } from './config.js';
import { StateManager } from './StateManager.js';
import { RecordingManager } from './RecordingManager.js';
import { KeyboardManager } from './KeyboardManager.js';
import { VisualRenderer } from './VisualRenderer.js';
import { DOMUtils } from './DOMUtils.js';

// Initialize managers
const stateManager = new StateManager();
const recordingManager = new RecordingManager();
const keyboardManager = new KeyboardManager(stateManager);
const visualRenderer = new VisualRenderer(stateManager);

// Expose managers globally for debugging
try { 
    window.stateManager = stateManager;
    window.recordingManager = recordingManager;
    window.keyboardManager = keyboardManager;
    window.visualRenderer = visualRenderer;
} catch (e) {}

// Keyboard functions
function setKeyboardImage(keyName) {
    keyboardManager.setKeyboardImage(keyName);
}

function initKeyboardSelector() {
    keyboardManager.initKeyboardSelector();
}

function toggleKeyboard() {
    keyboardManager.toggleKeyboard();
}

try { window.toggleKeyboard = toggleKeyboard; } catch (e) {}

// Visual zoom functions
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

// Expose helpers to the page/console
try { 
    window.zoomInVisual = zoomInVisual; 
    window.zoomOutVisual = zoomOutVisual; 
    window.resetVisualZoom = resetVisualZoom; 
    window.setVisualZoom = setVisualZoom; 
} catch (e) {}

// Apply UI scale
function applyUIScale(scale) {
    DOMUtils.applyUIScale(scale);
}

try { window.applyUIScale = applyUIScale; } catch (e) {}

// 7-segment display functions
function clear7SegmentDisplays() {
    DOMUtils.clearAll7SegmentDisplays();
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


/**
 * Captures the visual stream from elements by drawing permitted elements onto a canvas.
 */
function getVisualStream() {
    return visualRenderer.getVisualStream(recordingManager);
}


// 1. Power Off/ON
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

// 2. Audio In
function handleAudioIn() {
    const element = DOMUtils.getButtonByTitle('Audio In');
    if (!element) return;
    
    DOMUtils.flashButton(element, CONFIG.BUTTON_COLORS.WARNING, 200);
    term.write('\r\nAudio Input: Waiting for file upload...\r\n> ');
}

// 3. Audio Record
function handleAudioRecord() {
    const element = DOMUtils.getButtonByTitle('Audio Record');
    if (!element) return;
    
    const currentState = recordingManager.getFeatureState();
    
    if (currentState.audioRecord) {
        // Stop recording
        const stopped = recordingManager.stopAudioRecording(window.triggerDownload, term);
        if (stopped) {
            DOMUtils.updateLED('led-green', false);
            DOMUtils.updateButtonState(element, false, CONFIG.BUTTON_COLORS.DEFAULT);
        }
    } else {
        // Start recording
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

// 4. Screen Record
function handleScreenRecord() {
    const element = DOMUtils.getButtonByTitle('Screen Record');
    if (!element) return;
    
    const currentState = recordingManager.getFeatureState();
    
    if (currentState.screenRecord) {
        // Stop recording
        const stopped = recordingManager.stopScreenRecording(term);
        if (stopped) {
            DOMUtils.updateButtonState(element, false, CONFIG.BUTTON_COLORS.DEFAULT);
        }
    } else {
        // Start recording
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

// 5. Dump Buffer
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
    
// 6. Load & Run
function handleLoadAndRunScript() {
    const element = DOMUtils.getButtonByTitle('Load & Run');
    if (!element) return;
    
    DOMUtils.flashButton(element, CONFIG.BUTTON_COLORS.PURPLE, 200);
    term.write('\r\nScript Load & Run: Triggering file selection...\r\n> ');
}

// Exposing required functions to the window scope (after definitions)
try {
    window.handlePower = handlePower;
    window.handleAudioIn = handleAudioIn;
    window.handleAudioRecord = handleAudioRecord;
    window.handleScreenRecord = handleScreenRecord;
    window.handleDumpBuffer = handleDumpBuffer;
    window.handleLoadAndRunScript = handleLoadAndRunScript;
} catch (e) {}

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
    DOMUtils.updateLED('led-red', false);
    DOMUtils.updateLED('led-green', false);

    const powerButton = DOMUtils.getButtonByTitle('Power');
    if (powerButton) {
        DOMUtils.updateButtonState(powerButton, false, CONFIG.BUTTON_COLORS.POWER_OFF);
    }

    // Initialize tooltip tracking listeners for video capture
    initTooltipTracking();
    try { initKeyboardSelector(); } catch (e) {}
});