let zpu;

function initZpu() {
    zpu = Z80({ mem_read, mem_write, io_read, io_write });
    // expose for debugging / external reinit
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

    // Best-effort clear of any intervals the zpu implementation might have exposed
    try {
        if (zpu._intervals && Array.isArray(zpu._intervals)) {
            zpu._intervals.forEach(id => clearInterval(id));
        }
    } catch (e) {}

    // Remove global reference if it points to this instance
    try { if (window.zpu === zpu) window.zpu = null; } catch (e) {}

    // Finally drop our reference to allow GC
    zpu = null;
}

// expose init/destroy helpers to the page/console
try { window.initZpu = initZpu; window.destroyZpu = destroyZpu; } catch (e) {}
// state for CB emulation
let cb_counter = 0;
let ca_last_write = 0;       // last value written to CA
let busy_timer = 0;          // counts down “busy” cycles

// Minimal CB read logic
function io_read(address) {
    const port = address & 0xFF;

    if (port === 0xCB) {
       return mtp201_io_read(port);
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
