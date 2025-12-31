/* =========================================================
   MTP201 dynamic I/O emulation - Version 2.1
   80px Viewport + 1000 Line Scrollable Buffer
   ========================================================= */

window.mtp201 = {
    active: true,
    TG_BIT: 0x01,
    HOME_BIT: 0x02,
    motorOn: false,
    busyPolls: 0,
    tgCounter: 0,
    TG_PHASE_WIDTH: 25,
    headBits: 7,
    columnBuffer: [],
    currentX: 0, 
    currentY: 10, 
    LINE_SPACING: 2,
    isHome: true,
    lineHasData: false,
    skipFirst: false
};

const MTP201_WATCHDOG = 20000; 
const MAX_PAPER_HEIGHT = 9000; // Approx 1000 lines

function flushPrinterBuffer() {
    const m = window.mtp201;
    const canvas = document.getElementById('mtpScreen');
    const container = document.getElementById('printer-scroll-box');
    
    if (!m.columnBuffer || m.columnBuffer.length === 0) return;

    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = "#000000"; 

        for (let col = 0; col < m.columnBuffer.length; col++) {
            let data = m.columnBuffer[col];
            if (data > 0) {
                m.lineHasData = true; 
                for (let bit = 0; bit < m.headBits; bit++) {
                    if (data & (1 << bit)) {
                        ctx.fillRect(m.currentX + col, m.currentY + (m.headBits - 1 - bit), 1.1, 1.1);
                    }
                }
            }
        }
        m.currentX += m.columnBuffer.length;

        // AUTO-SCROLL: Center the current printing line in the 80px window
        if (container) {
            // Subtract 40 (half of window height) to keep 'ink' in the middle
            container.scrollTop = m.currentY - 40; 
        }
    }
    m.columnBuffer = [];
}

window.io_write_ca = function (port, value) {
    const m = window.mtp201;
    const thermalData = value & 0x7F;
    const motorBit = (value & 0x80) !== 0;

    if (motorBit && !m.motorOn && m.isHome) {
        if (m.lineHasData) {
            m.currentY += (m.headBits + m.LINE_SPACING);
            m.currentX = 0; 
            m.lineHasData = false;

            if (m.currentY > MAX_PAPER_HEIGHT - 50) {
                const canvas = document.getElementById('mtpScreen');
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                m.currentY = 10;
            }
        }
        m.isHome = false; 
        m.skipFirst = true;
    }

    if (motorBit || m.motorOn) {
        if (m.skipFirst) m.skipFirst = false;
        else m.columnBuffer.push(thermalData);
        m.busyPolls = MTP201_WATCHDOG;
    }

    if (motorBit && !m.motorOn) {
        m.motorOn = true;
    } else if (!motorBit && m.motorOn) {
        m.motorOn = false;
        flushPrinterBuffer();
        m.isHome = true; 
    }
};

window.io_read_cb = function (port) {
    const m = window.mtp201;
    let status = 0x00;
    if (m.isHome) status |= m.HOME_BIT;
    if (m.motorOn) {
        m.tgCounter++;
        if (Math.floor(m.tgCounter / m.TG_PHASE_WIDTH) % 2 === 0) status |= m.TG_BIT;
        if (m.busyPolls > 0) m.busyPolls--;
        else {
            m.motorOn = false;
            m.isHome = true;
            flushPrinterBuffer();
        }
    }
    return status;
};