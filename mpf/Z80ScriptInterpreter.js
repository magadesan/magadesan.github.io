class Z80ScriptInterpreter {
    constructor(emulator) {
        this.emulator = emulator; // Reference to your Z80 instance
        this.currentAddr = 0;
    }

    runScript(scriptText) {
        const lines = scriptText.split('\n');

        lines.forEach(line => {
            const cleanLine = line.trim();
            if (!cleanLine || cleanLine.startsWith(';')) return; // Skip empty/comments

            const parts = cleanLine.split(/\s+/);
            const command = parts[0].toUpperCase();
            const args = parts.slice(1);

            switch (command) {
                case 'SPEED':
                    // Set emulator clock speed (Hz)
                    this.emulator.setClockSpeed(parseInt(args[0]));
                    break;

                case 'ADDR':
                    // Set the pointer for subsequent DATA commands
                    this.currentAddr = parseInt(args[0], 16);
                    break;

                case 'DATA':
                    // Join arguments and split by '+' to get hex bytes
                    const hexBytes = args.join('').split('+').filter(x => x.length > 0);
                    hexBytes.forEach(hex => {
                        this.emulator.memory.write(this.currentAddr++, parseInt(hex, 16));
                    });
                    break;

                case 'SLEEP':
                    // In a real emulator, this might pause execution for N ms
                    this.emulator.pause(parseInt(args[0]));
                    break;

                case 'GO':
                    // Set Program Counter and start the CPU
                    this.emulator.cpu.pc = this.currentAddr; 
                    this.emulator.start();
                    break;
            }
        });
    }
}