let globalAudioContext = null;
let globalOscillator = null;
let globalGainNode = null;
let globalMediaRecorder = null; // Used for Audio-only recording (Button C)
let globalAudioChunks = [];
let globalIsBeeping = false;

// Global variable for audio stream capture (used by Button D in script.js)
let globalAudioDestination = null;

// Exported function for dumping files
window.triggerDownload = function(blob, filename) {
    console.log(`[DL DEBUG] triggerDownload called for: ${filename}, Blob size: ${blob.size}`);
    try {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        
        // This is the critical click to initiate download
        a.click();
        
        // Clean up
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        console.log(`[DL DEBUG] Successfully executed download steps for: ${filename}`);
        return true; 
    } catch (error) {
        console.error("[DL DEBUG] Fatal Error in triggerDownload utility:", error);
        return false; 
    }
};

// Exported object for screen recording access
window.getAudioDestination = function() {
    return globalAudioDestination;
};

// Exported global context for resume/checks
window.globalAudioContext = globalAudioContext;

/**
 * Public function to forcefully resume the AudioContext on user interaction.
 */
window.resumeAudioContext = function() {
    if (globalAudioContext && globalAudioContext.state === 'suspended') {
        globalAudioContext.resume().then(() => {
            console.log('AudioContext resumed via user action.');
        }).catch(e => {
            console.error('Failed to resume AudioContext:', e);
        });
    }
};


/**
 * Initializes the global AudioContext and starts the oscillator permanently.
 */
function startAudioSession(initialFreq = 100) {
    if (!globalAudioContext) {
        globalAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        globalOscillator = globalAudioContext.createOscillator();
        globalGainNode = globalAudioContext.createGain();
        
        globalAudioDestination = globalAudioContext.createMediaStreamDestination(); 
        
        window.globalAudioContext = globalAudioContext; 

        const safeInitialFreq = (typeof initialFreq === 'number' && isFinite(initialFreq)) ? initialFreq : 100;

        globalOscillator.frequency.value = safeInitialFreq;
        globalGainNode.gain.value = 0.05;

        globalGainNode.gain.setValueAtTime(0, globalAudioContext.currentTime);

        globalOscillator.connect(globalGainNode);
        
        globalGainNode.connect(globalAudioDestination);
        globalGainNode.connect(globalAudioContext.destination); 
        
        globalOscillator.start(0); 
        
        console.log("Audio Context Initialized and Oscillator Running.");
    }
    
    if (globalAudioContext.state === 'suspended') {
        globalAudioContext.resume().then(() => {
            console.log('AudioContext resumed successfully during initialization.');
        }).catch(() => {
            console.log('AudioContext remains suspended. A user gesture is required to resume.');
        });
    }
}

/**
 * Starts the audio-only recording (Button C logic).
 */
window.startAudioOnlyRecording = function() {
    if (globalMediaRecorder && globalMediaRecorder.state !== 'inactive') {
        console.warn("Audio-only recording is already active.");
        return;
    }
    
    if (!globalAudioContext || globalAudioContext.state !== 'running') {
        console.error("Audio Context not running. Cannot start audio-only recording.");
        window.resumeAudioContext(); 
        return;
    }

    const dest = globalAudioContext.createMediaStreamDestination();
    globalMediaRecorder = new MediaRecorder(dest.stream, { mimeType: 'audio/webm' });
    globalAudioChunks = [];
    
    globalGainNode.connect(dest); 

    globalMediaRecorder.ondataavailable = (event) => {
        globalAudioChunks.push(event.data);
    };

    globalMediaRecorder.onstop = () => {
        globalGainNode.disconnect(dest); 
        
        const recordedAudioBlob = new Blob(globalAudioChunks, { type: 'audio/webm' });
        console.log(`[AUD DEBUG] Audio-only recording stopped. Chunks: ${globalAudioChunks.length}, Blob size: ${recordedAudioBlob.size}`);
        
        window.triggerDownload(recordedAudioBlob, 'recorded_session.webm');

        globalMediaRecorder = null;
        globalAudioChunks = [];
        document.getElementById("led-green")?.classList.remove("on");
    };

    globalMediaRecorder.start();
};

function beepTone(freq = 440, durationMs = 100, volume = 0.05) {
    startAudioSession(freq); 
    
    document.getElementById("led-green")?.classList.add("on");

    if (globalAudioContext && globalAudioContext.state !== 'closed') {
        if (globalIsBeeping) return;
        globalIsBeeping = true;
        
        const safeFreq = (typeof freq === 'number' && isFinite(freq)) ? freq : 440;
        
        globalGainNode.gain.cancelAndHoldAtTime(globalAudioContext.currentTime);
        globalOscillator.frequency.setValueAtTime(safeFreq, globalAudioContext.currentTime);
        globalGainNode.gain.setValueAtTime(volume, globalAudioContext.currentTime);

        setTimeout(() => {
            globalGainNode.gain.setValueAtTime(0, globalAudioContext.currentTime);
            globalIsBeeping = false;
            document.getElementById("led-green")?.classList.remove("on");
        }, durationMs);

    } else {
        console.error("Audio Context is not available for beep. State:", globalAudioContext ? globalAudioContext.state : 'null');
        document.getElementById("led-green")?.classList.remove("on");
    }
}

/**
 * Stops the audio-only media recorder (Button C logic).
 */
function stopAudioSession() {
    if (globalMediaRecorder && globalMediaRecorder.state === 'recording') {
        globalMediaRecorder.stop();
    } else {
        console.warn("No active audio-only recording session to stop.");
    }
}
window.stopAudioSession = stopAudioSession; // Export for script.js

// Don't start audio automatically on DOMContentLoaded — modern browsers
// require a user gesture to start or resume AudioContext. Instead,
// initialize/resume the audio context on the first user interaction.
function initAudioOnFirstGesture() {
    function onFirstGesture() {
        try {
            startAudioSession();
            // Attempt to resume if suspended
            if (window.globalAudioContext && window.globalAudioContext.state === 'suspended') {
                window.globalAudioContext.resume().catch(() => {});
            }
        } catch (e) {
            console.error('Failed to start audio on first gesture:', e);
        }
    }

    // Use click and keydown as common user gestures. Use { once: true }
    // so we only call startAudioSession once.
    document.addEventListener('click', onFirstGesture, { once: true, passive: true });
    document.addEventListener('keydown', onFirstGesture, { once: true, passive: true });
}

initAudioOnFirstGesture();