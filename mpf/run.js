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

    if (port === 0xCB1) {
        cb_counter++;

        // simulate BUSY (bit0)
        let busy = 0x01; // ready by default
        if (busy_timer > 0) {
            busy = 0x00; // busy
            busy_timer--;
        }

        // simulate TACHO (bit1)
        let tacho = (cb_counter % 4 === 0) ? 0x02 : 0x00; // pulse every 4 reads

        // paper end and error (static for now)
        const paper_end = 0x00;
        const error = 0x00;

        const val = busy | tacho | paper_end | error;

        // log only when value changes
        if (typeof io_read._last_cb_val === 'undefined') io_read._last_cb_val = null;
        if (val !== io_read._last_cb_val) {
            console.warn(`Read CB -> ${val.toString(16).padStart(2,'0')} at PC=${toHex(zpu.getState().pc,4)}`);
            io_read._last_cb_val = val;
        }

        return val;
    }
    if (port === 0xCB) {
       if (mtp201_io_write(port, value)) return;
       mtp201_step();
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
