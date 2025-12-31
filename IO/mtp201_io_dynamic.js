/* =========================================================
   MTP201 dynamic I/O emulation - Version 1.0
   ========================================================= */

window.mtp201 = {
  active: true,
  TG_BIT: 0x01,
  HOME_BIT: 0x02,

  motorOn: false,
  busyPolls: 0,
  lastCB: null,

  tgCounter: 0,
  TG_PHASE_WIDTH: 25,
  headBits: 7,

  columnBuffer: []
};

const MTP201_MAX_LINE_POLLS = 3000;

function getPC() {
  try {
    if (typeof zpu !== 'undefined') return zpu.getState().pc.toString(16).toUpperCase();
  } catch (e) { }
  return "????";
}

// =========================================================
// Flush Printer Buffer (Fixed for correct vertical order)
// =========================================================
// Add these to the top of mtp201_io_dynamic.js or inside window.mtp201
let currentY = 0;

function flushPrinterBuffer() {
  const m = window.mtp201;
  const canvas = document.getElementById('mtpScreen');
  if (!canvas || m.columnBuffer.length === 0) return;
  
  const ctx = canvas.getContext('2d');
  
  // Set the "ink" color - slightly grey-black for a thermal look
  ctx.fillStyle = "rgba(0, 0, 0, 0.8)"; 

  // console.log for debugging
  console.log(`%c [MTP201 PRINT] `, 'background: #222; color: #bada55');

  for (let col = 0; col < m.columnBuffer.length; col++) {
    let columnData = m.columnBuffer[col];
    
    // Process the 7 bits (rows)
    for (let bit = 0; bit < m.headBits; bit++) {
      // Check if the specific bit is active
      if (columnData & (1 << bit)) {
        // Draw the dot at (x, y)
        // x = column index
        // y = current vertical position + (inverted bit for correct orientation)
        ctx.fillRect(col, currentY + (m.headBits - 1 - bit), 1, 1);
      }
    }
  }

  // Advance the "paper" by the height of the print head
  currentY += m.headBits;

  // If we run off the bottom, clear and restart at the top
  if (currentY > canvas.height) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    currentY = 0;
  }

  m.columnBuffer = [];
}

window.io_write_ca = function (port, value) {
  const m = window.mtp201;
  const motor = (value & 0x80) !== 0;

  if (motor && !m.motorOn) {
    m.motorOn = true;
    m.busyPolls = MTP201_MAX_LINE_POLLS;
    m.tgCounter = 0;
    console.debug(`[MTP201] MOTOR START`);
  } else if (!motor && m.motorOn) {
    m.motorOn = false;
    flushPrinterBuffer();
  }

  const thermalData = value & 0x7F;
  m.columnBuffer.push(thermalData);
  m.busyPolls = MTP201_MAX_LINE_POLLS;
};

window.io_read_cb = function (port) {
  const m = window.mtp201;
  let status = 0x00;

  if (!m.motorOn) {
    status |= m.HOME_BIT;
  } else {
    m.tgCounter++;
    if (Math.floor(m.tgCounter / m.TG_PHASE_WIDTH) % 2 === 0) {
      status |= m.TG_BIT;
    }

    if (m.busyPolls > 0) {
      m.busyPolls--;
    } else {
      m.motorOn = false;
      flushPrinterBuffer();
    }
  }

  if (status !== m.lastCB) {
    m.lastCB = status;
  }

  return status;
};
