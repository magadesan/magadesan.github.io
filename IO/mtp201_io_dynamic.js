/* =========================================================
   MTP201 dynamic I/O emulation (ROM-faithful)
   ---------------------------------------------------------
   Port CA : output (motor / control)
   Port CB : input  (status)
     bit 0 = TG
     bit 1 = HOME
   ========================================================= */

const mtp201 = {
  active: true,

  // status bits
  TG_BIT:   0x01,
  HOME_BIT: 0x02,

  // mechanical state
  motorOn: false,
  busyPolls: 0,      // counts down on IN CB
  lastCB: null,      // last CB value to reduce log spam
  tgPulsePending: false, // TG pulse triggered by CA write

  // thermal head state
  headBits: 7         // number of pins on thermal head
};

// --- tuning ---
const MTP201_BUSY_POLLS = 64;

// --- helpers ---
function dbg(msg) {
  console.debug(msg);
}

function toHex(v, len=2) {
  return v.toString(16).padStart(len, '0').toUpperCase();
}

// =========================================================
// Render thermal column as console bitmap
// =========================================================
function renderThermalBitmap(bits) {
  let row = '';
  for (let i = 0; i < mtp201.headBits; i++) {
    row += (bits & (1 << i)) ? '█' : '.';
  }
  return row.split('').reverse().join(''); // pin 0 left
}

// =========================================================
// OUT (CA) handler
// =========================================================
function io_write_ca(value) {
  if (!mtp201.active) return false;

  const pc = toHex(zpu.getState().pc, 4);

  // bit 7 controls motor
  const motor = (value & 0x80) !== 0;

  if (motor && !mtp201.motorOn) {
    mtp201.motorOn   = true;
    mtp201.busyPolls = MTP201_BUSY_POLLS;
    dbg(`[MTP201][PC=${pc}] CA[7] → MOTOR ON`);
  }
  else if (!motor && mtp201.motorOn) {
    mtp201.motorOn   = false;
    mtp201.busyPolls = 0;
    dbg(`[MTP201][PC=${pc}] CA[7] → MOTOR OFF`);
  }

  // Determine which pins fired (thermal head bits)
  const firedPins = [];
  for (let i = 0; i < mtp201.headBits; i++) {
    if (value & (1 << i)) firedPins.push(i);
  }

  if (firedPins.length > 0) {
    dbg(`[MTP201] CA pins fired → bits {${firedPins.join(',')}}`);
    dbg(`[MTP201] Thermal bitmap → ${renderThermalBitmap(value)}`);
  }

  // Generate a TG pulse for each CA write if motor+thermal
  if ((value & 0x7F) !== 0) { // any thermal bit set
    mtp201.tgPulsePending = true;
    mtp201.tgPulseWidth   = 2; // pulse lasts 2 reads
    dbg(`[MTP201][PC=${pc}] TG pulse armed (width=2)`);
  }

  return true; // port handled
}

// =========================================================
// IN (CB) handler
// =========================================================
function io_read_cb() {
  if (!mtp201.active) return null;

  let status = 0x00;

  // TG pulse from CA write
  if (mtp201.tgPulsePending) {
    status |= mtp201.TG_BIT;
    mtp201.tgPulseWidth--;
    if (mtp201.tgPulseWidth <= 0) mtp201.tgPulsePending = false;
  }

  // HOME bit reflects motor idle
  if (!mtp201.motorOn) {
    status |= mtp201.HOME_BIT;
  } else {
    // decrement busyPolls to auto-stop motor
    if (mtp201.busyPolls > 0) {
      mtp201.busyPolls--;
      if (mtp201.busyPolls === 0) {
        mtp201.motorOn = false;
        mtp201.lastCB = null; // force log on next read
        dbg(`[MTP201] Motor motion complete → HOME`);
      }
    }
  }

  // Only log if CB value changed
  if (status !== mtp201.lastCB) {
    mtp201.lastCB = status;
    dbg(`[MTP201][PC=${toHex(zpu.getState().pc,4)}] IN  CB → ${toHex(status,2)}`);
  }

  return status;
}

// =========================================================
// Glue helpers for global I/O dispatcher
// =========================================================
function mtp201_io_read(port) {
  if (port === 0xCB) return io_read_cb();
  return null;
}

function mtp201_io_write(port, value) {
  if (port === 0xCA) return io_write_ca(value);
  return false;
}
