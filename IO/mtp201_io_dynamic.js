/* =========================================================
   Dynamic MTP201 I/O emulation
   - Fully driven by ROM writes to CAh
   - TG and HOME on CBh emulate printer
   ========================================================= */

let motorOn = false;
let home    = true;
let tg      = 0;

// Internal state
let phase      = "IDLE";   // IDLE, RIGHT, RETURN
let tgCounter  = 0;
let lineQueue  = 0;        // lines to print based on motor pulses
let lastMotor  = false;

// Constants
const TG_BIT    = 0x01;
const HOME_BIT  = 0x02;
const MOTOR_BIT = 0x01;
const TG_PER_LINE = 120;   // dots per line, adjust to mechanism

// =========================================================
// IO READ
// =========================================================
function mtp201_io_read(port) {
    if (port !== 0xCB) return null;
    let v = 0;
    if (tg) v |= TG_BIT;
    if (home) v |= HOME_BIT;
    return v;
}

// =========================================================
// IO WRITE
// =========================================================
function mtp201_io_write(port, value) {
    if (port !== 0xCA) return false;

    const motor = (value & MOTOR_BIT) !== 0;
    const thermal = value & 0xFE;

    // Detect rising edge of motor → enqueue a line if thermal bits were set
    if (motor && !lastMotor && thermal !== 0) {
        lineQueue++;          // one line to print per motor+thermal write
        phase = "RIGHT";
        tgCounter = 0;
        home = true;
    }

    lastMotor = motor;
    motorOn = motor;

    return true;
}

// =========================================================
// DEVICE STEP (call each tick)
// =========================================================
function mtp201_step() {
    if (!motorOn || lineQueue <= 0) return;

    switch (phase) {
        case "RIGHT":
            home = false;

            // simulate TG pulses while moving right
            tg ^= 1;
            if (tg) tgCounter++;

            if (tgCounter >= TG_PER_LINE) {
                phase = "RETURN";
                tgCounter = 0;
                tg = 0;
            }
            break;

        case "RETURN":
            home = true;

            // line printed + paper feed
            lineQueue--;

            if (lineQueue > 0) {
                phase = "RIGHT";
            } else {
                phase = "IDLE";
                motorOn = false;
            }
            break;

        case "IDLE":
        default:
            tg = 0;
            break;
    }
}
