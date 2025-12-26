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

    console.log(`[MTP201] IO READ from port 0x${port.toString(16)} -> 0x${v.toString(16)} | tg=${tg} home=${home}`);
    return v;
}

// =========================================================
// IO WRITE
// =========================================================
function mtp201_io_write(port, value) {
    if (port !== 0xCA) return false;

    const motor = (value & MOTOR_BIT) !== 0;
    const thermal = value & 0xFE;

    console.log(`[MTP201] IO WRITE to port 0x${port.toString(16)} -> 0x${value.toString(16)} | motor=${motor} thermal=0x${thermal.toString(16)}`);

    // Detect rising edge of motor → enqueue a line if thermal bits were set
    if (motor && !lastMotor && thermal !== 0) {
        lineQueue++;          // one line to print per motor+thermal write
        phase = "RIGHT";
        tgCounter = 0;
        home = true;
        console.log(`[MTP201] Motor rising edge detected -> lineQueue=${lineQueue}, phase=${phase}`);
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

            console.log(`[MTP201] STEP RIGHT | tg=${tg} tgCounter=${tgCounter} lineQueue=${lineQueue}`);

            if (tgCounter >= TG_PER_LINE) {
                phase = "RETURN";
                tgCounter = 0;
                tg = 0;
                console.log(`[MTP201] RIGHT complete -> phase=${phase}`);
            }
            break;

        case "RETURN":
            home = true;

            // line printed + paper feed
            lineQueue--;
            console.log(`[MTP201] STEP RETURN | line printed, lineQueue=${lineQueue}`);

            if (lineQueue > 0) {
                phase = "RIGHT";
                console.log(`[MTP201] More lines to print -> phase=${phase}`);
            } else {
                phase = "IDLE";
                motorOn = false;
                console.log(`[MTP201] All lines printed -> phase=${phase}, motorOn=${motorOn}`);
            }
            break;

        case "IDLE":
        default:
            tg = 0;
            break;
    }
}
