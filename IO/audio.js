class AudioManager {
    constructor() {
        this.audioContext = null;
        this.oscillator = null;
        this.gainNode = null;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isBeeping = false;
        this.audioDestination = null;
    }

    /**
     * Initializes the AudioContext and starts the oscillator permanently.
     */
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

    /**
     * Resumes the AudioContext if suspended.
     */
    resumeContext() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume().then(() => {
                console.log('AudioContext resumed via user action.');
            }).catch(e => {
                console.error('Failed to resume AudioContext:', e);
            });
        }
    }

    /**
     * Get the audio destination for recording.
     */
    getDestination() {
        return this.audioDestination;
    }

    /**
     * Starts audio-only recording.
     */
    startRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            console.warn("Audio recording is already active.");
            return;
        }

        if (!this.audioContext || this.audioContext.state !== 'running') {
            console.error("Audio Context not running. Cannot start recording.");
            this.resumeContext();
            return;
        }

        const dest = this.audioContext.createMediaStreamDestination();
        this.mediaRecorder = new MediaRecorder(dest.stream, { mimeType: 'audio/webm' });
        this.audioChunks = [];

        this.gainNode.connect(dest);

        this.mediaRecorder.ondataavailable = (event) => {
            this.audioChunks.push(event.data);
        };

        this.mediaRecorder.onstop = () => {
            this.gainNode.disconnect(dest);

            const recordedAudioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
            console.log(`[AUD DEBUG] Recording stopped. Chunks: ${this.audioChunks.length}, Blob size: ${recordedAudioBlob.size}`);

            this.downloadBlob(recordedAudioBlob, 'recorded_session.webm');

            this.mediaRecorder = null;
            this.audioChunks = [];
            document.getElementById("led-green")?.classList.remove("on");
        };

        this.mediaRecorder.start();
    }

    /**
     * Stops the current recording session.
     */
    stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
        } else {
            console.warn("No active recording session to stop.");
        }
    }

    /**
     * Plays a beep tone.
     */
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

    /**
     * Downloads a blob to the user's device.
     */
    downloadBlob(blob, filename) {
        console.log(`[DL DEBUG] Downloading: ${filename}, Blob size: ${blob.size}`);
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
            console.log(`[DL DEBUG] Download successful: ${filename}`);
            return true;
        } catch (error) {
            console.error("[DL DEBUG] Download error:", error);
            return false;
        }
    }
}

// Create global instance
const audioManager = new AudioManager();

// Legacy global functions for backward compatibility
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

window.startAudioOnlyRecording = function() {
    audioManager.startRecording();
};

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

/**
 * Initialize audio on first user gesture.
 */
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