/* =========================================================
   MTP201 Printer Emulation (ROM-compatible)
   DEBUG BUILD – NO LOGIC CHANGES
   ========================================================= */

let motorOn = false;
let home    = true;
let tg      = 0;

// Internal state
let phase      = "IDLE";   // IDLE, RIGHT, RETURN
let tgCounter  = 0;
let lineQueue  = 0;
let lastMotor  = false;

// Debug helpers
let stepCount = 0;
let lastTG    = 0;

// Constants
const MOTOR_BIT    = 0x01;
const TG_BIT       = 0x01;
const HOME_BIT     = 0x02;
const TG_PER_LINE  = 120;

// =========================================================
// IO READ
// =========================================================
function mtp201_io_read(port) {
    if (port !== 0xCB) return null;

    let v = 0;
    if (tg)   v |= TG_BIT;
    if (home) v |= HOME_BIT;

    console.log(
        `[MTP201][READ] CBh → ${v.toString(2).padStart(8, "0")} ` +
        `TG=${tg} HOME=${home} PHASE=${phase} LQ=${lineQueue}`
    );

    return v;
}

// =========================================================
// IO WRITE
// =========================================================
function mtp201_io_write(port, value) {
    if (port !== 0xCA) return false;

    const motor   = (value & MOTOR_BIT) !== 0;
    const thermal = value & 0xFE;

    console.log(
        `[MTP201][WRITE] CAh ← 0x${value.toString(16).padStart(2, "0")} ` +
        `motor=${motor} thermal=${thermal !== 0}`
    );

    // Detect rising edge of motor
    if (motor && !lastMotor) {
        console.log(`[MTP201] Motor rising edge`);
    }

    // Rising edge + thermal data queues a line
    if (motor && !lastMotor && thermal !== 0) {
        lineQueue++;
        phase = "RIGHT";
        tgCounter = 0;
        home = true;

        console.log(
            `[MTP201] LINE QUEUED → lineQueue=${lineQueue}, phase=RIGHT`
        );
    }

    lastMotor = motor;
    motorOn   = motor;

    return true;
}

// =========================================================
// DEVICE STEP
// =========================================================
function mtp201_step() {
    stepCount++;

    if (!motorOn || lineQueue <= 0) {
        if (phase !== "IDLE") {
            console.log(
                `[MTP201][STEP ${stepCount}] Motor stopped → IDLE`
            );
        }
        phase = "IDLE";
        tg = 0;
        return;
    }

    switch (phase) {

        // ---------------------------------------------
        case "RIGHT":
            home = false;

            tg ^= 1;
            if (tg && !lastTG) {
                tgCounter++;
                console.log(
                    `[MTP201][TG ↑] pulse=${tgCounter}/${TG_PER_LINE}`
                );
            }

            console.log(
                `[MTP201][STEP ${stepCount}] RIGHT ` +
                `TG=${tg} tgCounter=${tgCounter}`
            );

            if (tgCounter >= TG_PER_LINE) {
                phase = "RETURN";
                tgCounter = 0;
                tg = 0;

                console.log(
                    `[MTP201] END OF LINE → RETURN`
                );
            }
            break;

        // ---------------------------------------------
        case "RETURN":
            home = true;

            lineQueue--;

            console.log(
                `[MTP201][STEP ${stepCount}] RETURN ` +
                `line complete → remaining=${lineQueue}`
            );

            if (lineQueue > 0) {
                phase = "RIGHT";
                console.log(`[MTP201] NEXT LINE → RIGHT`);
            } else {
                phase = "IDLE";
                motorOn = false;
                console.log(`[MTP201] PRINT DONE → IDLE`);
            }
            break;

        // ---------------------------------------------
        case "IDLE":
        default:
            tg = 0;
            break;
    }

    lastTG = tg;
}
