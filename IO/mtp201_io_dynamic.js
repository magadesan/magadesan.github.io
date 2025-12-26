/* =========================================================
   MTP201 Dynamic I/O Device Emulation
   ---------------------------------------------------------
   Ports:
     READ  CBh:
       bit 0 = TG
       bit 1 = HOME

     WRITE CAh:
       bit 0 = MOTOR
       bit 1–7 = THERMAL (data only)

   Behavior:
     - Motor OFF→ON starts ONE mechanical line
     - TG pulses generated while moving right
     - HOME asserted on return + paper feed
     - Number of lines is fully ROM-driven
   ========================================================= */

// -------------------- constants --------------------
const TG_BIT    = 0x01;
const HOME_BIT  = 0x02;
const MOTOR_BIT = 0x01;

const TG_PER_LINE = 120;   // adjust to match your ROM timing

// -------------------- internal state --------------------
let motorOn     = false;
let lastMotor   = false;

let tg          = 0;
let home        = true;

let phase       = "IDLE";   // IDLE → RIGHT → RETURN
let tgCounter   = 0;
let lineQueue   = 0;

// optional debug
const DEBUG = true;
function log(...a) { if (DEBUG) console.log("[MTP201]", ...a); }

// ========================================================
// IO READ (CBh)
// ========================================================
function mtp201_io_read(port) {
    if (port !== 0xCB) return null;

    let v = 0;
    if (tg)   v |= TG_BIT;
    if (home) v |= HOME_BIT;

    log("[READ] CBh →", v.toString(2).padStart(8, "0"),
        `TG=${tg}`, `HOME=${home}`, `PHASE=${phase}`, `LQ=${lineQueue}`);

    return v;
}

// ========================================================
// IO WRITE (CAh)
// ========================================================
function mtp201_io_write(port, value) {
    if (port !== 0xCA) return false;

    const motor = (value & MOTOR_BIT) !== 0;
    const thermal = value & 0xFE;

    log("[WRITE] CAh ←", "0x" + value.toString(16).padStart(2, "0"),
        `motor=${motor}`, `thermal=${thermal !== 0}`);

    // Motor rising edge → start ONE line
    if (motor && !lastMotor) {
        lineQueue++;
        phase = "RIGHT";
        tgCounter = 0;
        tg = 0;
        home = true;
        log("motor ON → enqueue line, LQ =", lineQueue);
    }

    lastMotor = motor;
    motorOn = motor;
    return true;
}

// ========================================================
// DEVICE STEP (call every emulator tick)
// ========================================================
function mtp201_step() {
    if (!motorOn || lineQueue <= 0) return;

    switch (phase) {

        case "RIGHT":
            home = false;

            // generate TG pulses
            tg ^= 1;
            if (tg) tgCounter++;

            if (tgCounter >= TG_PER_LINE) {
                phase = "RETURN";
                tgCounter = 0;
                tg = 0;
                log("right edge reached → RETURN");
            }
            break;

        case "RETURN":
            home = true;

            // paper feed occurs here
            lineQueue--;
            log("line complete → paper feed, remaining =", lineQueue);

            if (lineQueue > 0) {
                phase = "RIGHT";
            } else {
                phase = "IDLE";
                motorOn = false;
                log("print idle");
            }
            break;

        case "IDLE":
        default:
            tg = 0;
            break;
    }
}
