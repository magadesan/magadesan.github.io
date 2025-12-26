/* =========================================================
   MTP201 I/O DEVICE EMULATION — ROM-DRIVEN
   ---------------------------------------------------------
   Observed ROM behavior:
     OUT (CAh),00h  → Drive thermal head shift right

   Ports:
     READ  CBh:
       bit 0 = TG
       bit 1 = HOME

     WRITE CAh:
       any value = mechanical command / thermal data

   Model:
     - CA write while IDLE starts one shift-right cycle
     - TG pulses generated during right movement
     - Return stroke asserts HOME + feeds paper
   ========================================================= */

// ------------------ constants ------------------
const TG_BIT   = 0x01;
const HOME_BIT = 0x02;

const TG_PER_LINE = 120;   // tune to match ROM timing

// ------------------ internal state ------------------
let phase     = "IDLE";    // IDLE → RIGHT → RETURN
let tg        = 0;
let home      = true;

let tgCounter = 0;
let lineQueue = 0;

// ------------------ debug ------------------
const DEBUG = true;
function log(...a) { if (DEBUG) console.log("[MTP201]", ...a); }

// ==================================================
// IO READ (CBh)
// ==================================================
function mtp201_io_read(port) {
    if (port !== 0xCB) return null;

    let v = 0;
    if (tg)   v |= TG_BIT;
    if (home) v |= HOME_BIT;

    log("[READ] CBh →",
        v.toString(2).padStart(8, "0"),
        `TG=${tg}`,
        `HOME=${home}`,
        `PHASE=${phase}`,
        `LQ=${lineQueue}`);

    return v;
}

// ==================================================
// IO WRITE (CAh)
// ==================================================
function mtp201_io_write(port, value) {
    if (port !== 0xCA) return false;

    log("[WRITE] CAh ←",
        "0x" + value.toString(16).padStart(2, "0"),
        "PHASE=" + phase);

    // ROM uses CAh writes to drive motion
    if (phase === "IDLE") {
        lineQueue++;
        phase = "RIGHT";
        tgCounter = 0;
        tg = 0;
        home = true;

        log("CA write → shift right, enqueue line =", lineQueue);
    }

    // Thermal bits intentionally ignored here
    return true;
}

// ==================================================
// DEVICE STEP (call every emulator tick)
// ==================================================
function mtp201_step() {
    if (lineQueue <= 0) return;

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

            // paper feed happens here
            lineQueue--;
            log("line done → paper feed, remaining =", lineQueue);

            if (lineQueue > 0) {
                phase = "RIGHT";
            } else {
                phase = "IDLE";
                log("printer idle");
            }
            break;

        case "IDLE":
        default:
            tg = 0;
            break;
    }
}
