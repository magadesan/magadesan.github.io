async function waitFor10ms(start) {
    while (Date.now() - start <= 10) {
        await new Promise(resolve => setTimeout(resolve, 0));
    }
}

// Helper function to get zpu instance safely
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
                else breakpoint = num;
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
