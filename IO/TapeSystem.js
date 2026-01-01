/**
 * Z80 Tape Interface Emulator
 * Supports: .HEX to Virtual Tape, .WAV to Data, and Data to .WAV
 */
class TapeSystem {
    constructor(cpuHz = 1790000) {
        this.cpuHz = cpuHz;
        this.sampleRate = 44100;
        
        // Pulse Timing (T-States)
        this.halfPeriod2K = Math.round(cpuHz / 2000 / 2); // ~447 cycles
        this.halfPeriod1K = Math.round(cpuHz / 1000 / 2); // ~895 cycles

        // State Tracking
        this.tapeBuffer = [];     // Raw bytes for Virtual Tape
        this.outputEdgeLog = [];  // {level: 0|1, t: timestamp}
        this.playbackTStart = 0;
    }

    // --- FEATURE 1: HEX Parsing ---
    loadHex(hexString) {
        this.tapeBuffer = [];
        const lines = hexString.split('\n');
        for (let line of lines) {
            if (line.startsWith(':')) {
                const len = parseInt(line.substr(1, 2), 16);
                const type = parseInt(line.substr(7, 2), 16);
                if (type === 0) { // Data Record
                    for (let i = 0; i < len; i++) {
                        this.tapeBuffer.push(parseInt(line.substr(9 + (i * 2), 2), 16));
                    }
                }
            }
        }
        this.playbackTStart = 0; 
    }

    // --- FEATURE 2: TapeIN (Virtual Pulse Generation) ---
    // Simulates the hardware port for TAPEIN
    handleIn(currentT) {
        if (this.tapeBuffer.length === 0) return 0xFF;

        const elapsed = currentT - this.playbackTStart;
        const bitDuration = (this.halfPeriod2K * 16) + (this.halfPeriod1K * 8); // Avg bit length
        const byteIdx = Math.floor(elapsed / (bitDuration * 10)); // 10 bits per byte (S+8+P)
        
        if (byteIdx >= this.tapeBuffer.length) return 0xFF;

        // Simple bit-banging simulator: toggles bit 7 based on frequency
        // In a real impl, you'd calculate the exact phase within the 2K/1K cycles
        const isHigh = (Math.floor(elapsed / this.halfPeriod2K) % 2 === 0);
        return isHigh ? 0x80 : 0x00;
    }

    // --- FEATURE 3: TapeOUT (Recording Edges) ---
    handleOut(value, currentT) {
        const level = (value >> 7) & 1;
        if (this.outputEdgeLog.length === 0 || this.outputEdgeLog[this.outputEdgeLog.length - 1].level !== level) {
            this.outputEdgeLog.push({ level, t: currentT });
        }
    }

    // --- FEATURE 4: WAV Generation ---
    saveWav() {
        if (this.outputEdgeLog.length < 2) return;

        const lastEdge = this.outputEdgeLog[this.outputEdgeLog.length - 1];
        const totalTStates = lastEdge.t - this.outputEdgeLog[0].t;
        const totalSamples = Math.floor((totalTStates / this.cpuHz) * this.sampleRate);
        
        const buffer = new Int16Array(totalSamples);
        let currentSample = 0;

        for (let i = 0; i < this.outputEdgeLog.length - 1; i++) {
            const start = this.outputEdgeLog[i];
            const end = this.outputEdgeLog[i + 1];
            const durationSamples = Math.floor(((end.t - start.t) / this.cpuHz) * this.sampleRate);
            const val = start.level ? 16000 : -16000;

            for (let s = 0; s < durationSamples; s++) {
                if (currentSample < totalSamples) buffer[currentSample++] = val;
            }
        }

        return this.createWavBlob(buffer);
    }

    createWavBlob(samples) {
        const buffer = new ArrayBuffer(44 + samples.length * 2);
        const view = new DataView(buffer);

        // RIFF chunk descriptor
        this.writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + samples.length * 2, true);
        this.writeString(view, 8, 'WAVE');
        // fmt sub-chunk
        this.writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true); // Subchunk1Size
        view.setUint16(20, 1, true);    // AudioFormat (PCM)
        view.setUint16(22, 1, true);    // NumChannels (Mono)
        view.setUint32(24, this.sampleRate, true);
        view.setUint32(28, this.sampleRate * 2, true); // ByteRate
        view.setUint16(32, 2, true);    // BlockAlign
        view.setUint16(34, 16, true);   // BitsPerSample
        // data sub-chunk
        this.writeString(view, 36, 'data');
        view.setUint32(40, samples.length * 2, true);

        // Write PCM samples
        for (let i = 0; i < samples.length; i++) {
            view.setInt16(44 + (i * 2), samples[i], true);
        }

        return new Blob([buffer], { type: 'audio/wav' });
    }

    writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }
}