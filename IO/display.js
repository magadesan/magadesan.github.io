// I/O Port constants
const IO_PORT_DATA = 0x01;
const IO_PORT_DIGIT_SELECT = 0x02;
const IO_PORT_CA = 0xCA;
// Note: IO_PORT_CB is defined in run.js to avoid duplicate declaration

// Segment display mapping
const DIGIT_SELECT_MASK = 0x3f;
const SEGMENT_DISPLAY_MAPPING = {
    0x01: "svg-object-data0",
    0x02: "svg-object-data1",
    0x04: "svg-object-add0",
    0x08: "svg-object-add1",
    0x10: "svg-object-add2",
    0x20: "svg-object-add3"
};

// Segment bit mapping
const SEGMENT_BIT_MAP = {
    0x01: 'e', 0x02: 'g', 0x04: 'f', 0x08: 'a',
    0x10: 'b', 0x20: 'c', 0x40: 'dp', 0x80: 'd'
};

// Segment colors
const SEGMENT_COLOR_ON = "red";
const SEGMENT_COLOR_OFF = "white";
const ZERO_HISTORY_THRESHOLD = 2;

let digitSelect;
let run_digit = "";
let debug = false;

let zeroHistory = {
    a: 0, b: 0, c: 0, d: 0,
    e: 0, f: 0, g: 0, dp: 0
};

let seg = {
    a: SEGMENT_COLOR_OFF, 
    b: SEGMENT_COLOR_OFF, 
    c: SEGMENT_COLOR_OFF, 
    d: SEGMENT_COLOR_OFF,
    e: SEGMENT_COLOR_OFF, 
    f: SEGMENT_COLOR_OFF, 
    g: SEGMENT_COLOR_OFF, 
    dp: SEGMENT_COLOR_OFF
};

function io_write(address, value) {
    const port = address & 0xff;
    
    if (debug) {
        console.log(`${decimalToHex(port)}:${decimalToHex(value & DIGIT_SELECT_MASK)}::${toHex(zpu.getState().pc, 4)}`);
    }
    
    switch (port) {
        case IO_PORT_DIGIT_SELECT:
            //if ((value == 0xff) || (value == 0)) {
            if ((value & 0x80) == 0x80) {
                if (zpu.getState().l == 0x5e) {
                    document.getElementById("led-green").classList.add("on");
                    beepTone(zpu.getState().c * 10, (256 * zpu.getState().h) + zpu.getState().l);
                    if (debug) {
                        console.log(`${decimalToHex(value)} = ${decimalToHex(zpu.getState().h)} ${decimalToHex(zpu.getState().l)} :: ${decimalToHex(zpu.getState().c)} ${decimalToHex(zpu.getState().b)}\n\r`);
                    }
                }
            }
            handleRunDigit(value);
            break;
        case IO_PORT_DATA:
            updateSegmentDisplay(value);
            break;
        case IO_PORT_CA:
            io_write_ca(address, value);
            break;
        default:
            console.warn(`No IO handled for write to: ${decimalToHex(port)} value: ${decimalToHex(value)} at ${toHex(zpu.getState().pc, 4)}`);
            break;
    }
}

function handleRunDigit(value) {
    digitSelect = value & DIGIT_SELECT_MASK;
    run_digit = SEGMENT_DISPLAY_MAPPING[digitSelect] || "";
    if (debug && run_digit) {
        console.log(`run_digit: ${run_digit} value: ${decimalToHex(digitSelect)}`);
    }
}

function updateSegmentDisplay(value) {
    for (const mask in SEGMENT_BIT_MAP) {
        const segName = SEGMENT_BIT_MAP[mask];
        const bitOn = (value & parseInt(mask, 10)) !== 0;

        if (bitOn) {
            seg[segName] = SEGMENT_COLOR_ON;
            zeroHistory[segName] = 0;
        } else {
            zeroHistory[segName]++;
            if (zeroHistory[segName] >= ZERO_HISTORY_THRESHOLD) {
                seg[segName] = SEGMENT_COLOR_OFF;
            }
        }
    }

    updateSVGDisplay();
}

function updateSVGDisplay() {
    if (!document.getElementById(run_digit)) return;
    const svg = document.getElementById(run_digit).contentDocument;
    for (let s in seg) {
        const elem = svg.getElementById(s);
        if (elem) {
            elem.setAttribute("fill", seg[s]);
        }
    }
    if (debug) {
        console.log(`Updated SVG for: ${run_digit} with colors: ${JSON.stringify(seg)}`);
    }
}
