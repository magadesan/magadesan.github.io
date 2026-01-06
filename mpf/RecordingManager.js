/**
 * RecordingManager - Handles audio and video recording functionality
 */

import { CONFIG } from './config.js';

export class RecordingManager {
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

    /**
     * Starts audio-only recording
     */
    startAudioRecording(getAudioDestination, term) {
        if (!window.getAudioDestination || !window.globalAudioContext) {
            if (term) term.write('\r\nERROR: Audio stream functions missing.\r\n> ');
            return false;
        }

        if (this.mediaRecorderAudioOnly && this.mediaRecorderAudioOnly.state === 'recording') {
            return false; // Already recording
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

    /**
     * Stops audio-only recording
     */
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

    /**
     * Starts combined screen and audio recording
     */
    startScreenRecording(getVisualStream, getAudioDestination, beepTone, term) {
        if (!window.getAudioDestination || !window.beepTone) {
            if (term) term.write('\r\nERROR: Audio stream or tone function failed.\r\n> ');
            return false;
        }

        if (this.mediaRecorderCombined && this.mediaRecorderCombined.state === 'recording') {
            return false; // Already recording
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

    /**
     * Stops screen recording
     */
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

    /**
     * Dumps the recorded buffer to a file
     */
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

    /**
     * Sets the recording interval for visual stream updates
     */
    setRecordingInterval(intervalId) {
        if (this.recordingInterval) {
            clearInterval(this.recordingInterval);
        }
        this.recordingInterval = intervalId;
    }

    /**
     * Gets the current feature state
     */
    getFeatureState() {
        return { ...this.featureState };
    }

    /**
     * Updates feature state
     */
    setFeatureState(key, value) {
        if (key in this.featureState) {
            this.featureState[key] = value;
        }
    }
}

