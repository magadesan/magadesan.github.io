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
function flushPrinterBuffer() {
  const m = window.mtp201;
  if (m.columnBuffer.length === 0) return;

  console.log(`%c [MTP201 PRINTER OUTPUT] `, 'background: .; color: #bada55');

  /** * FIXED: Iterating from pin 6 down to 0 
   * This flips the bit-to-row mapping.
   */
  for (let row = m.headBits - 1; row >= 0; row--) {
    let lineString = "";
    for (let col = 0; col < m.columnBuffer.length; col++) {
      lineString += (m.columnBuffer[col] & (1 << row)) ? "█" : " ";
    }
    console.log(lineString);
  }

  m.columnBuffer = [];
  console.log("-".repeat(30));
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
  if (thermalData !== 0) {
    m.columnBuffer.push(thermalData);
    m.busyPolls = MTP201_MAX_LINE_POLLS;
  }
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
