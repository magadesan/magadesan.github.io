let digitSelect;
let run_digit = "";
let debug = false;

let zeroHistory = {
    a: 0, b: 0, c: 0, d: 0,
    e: 0, f: 0, g: 0, dp: 0
};

const mapping = {
    0x01: "svg-object-data0",
    0x02: "svg-object-data1",
    0x04: "svg-object-add0",
    0x08: "svg-object-add1",
    0x10: "svg-object-add2",
    0x20: "svg-object-add3"
};

let seg = {
    a: "white", b: "white", c: "white", d: "white",
    e: "white", f: "white", g: "white", dp: "white"
};

function io_write(address, value) {
    if (debug) {
        console.log(`${decimalToHex(address & 0xff)}:${decimalToHex(value & 0x3f)}::${toHex(zpu.getState().pc, 4)}`);
    }
    switch (address & 0xff) {
        case 0x02:
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
        case 0x01:
            updateSegmentDisplay(value);
            break;
        case 0xCA1:
            console.log(`Write CA value: ${value.toString(16).padStart(2, '0')} at ${toHex(zpu.getState().pc, 4)}`);
            ca_last_write = value;

            // If strobe bit is set, start BUSY simulation
            if (value & 0x80) {
                busy_timer = 2; // printer busy for next 2 CB reads (adjust as needed)
            }
            break;
        case 0xCA:
            if (mtp201_io_write(port, value)) return;
            mtp201_step();
            break;
        default:
            console.warn(`No IO handled for write to: ${decimalToHex(address & 0xff)} value: ${decimalToHex(value)} at ${toHex(zpu.getState().pc, 4)}`);
            break;
    }

}

function handleRunDigit(value) {
    digitSelect = value & 0x3f;
    run_digit = mapping[digitSelect] || "";
    if (debug && run_digit) {
        console.log(`run_digit: ${run_digit} value: ${decimalToHex(value & 0x3f)}`);
    }
}

function updateSegmentDisplay(value) {
    const segmentMap = {
        0x01: 'e', 0x02: 'g', 0x04: 'f', 0x08: 'a',
        0x10: 'b', 0x20: 'c', 0x40: 'dp', 0x80: 'd'
    };

    for (let mask in segmentMap) {
        const segName = segmentMap[mask];
        const bitOn = (value & mask) !== 0;

        if (bitOn) {
            seg[segName] = "red";
            zeroHistory[segName] = 0;
        } else {
            zeroHistory[segName]++;
            if (zeroHistory[segName] >= 2) {
                seg[segName] = "white";
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
