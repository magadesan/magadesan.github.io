let m_mem_mapping = new Uint8Array(65536).fill(255);
// ROM region list: { start, end }
const romRegions = [];

mem_write(0, 0x10);
mem_write(1, 0x20);

function isRomAddress(addr) {
    for (const r of romRegions) {
        if (addr >= r.start && addr <= r.end) return true;
    }
    return false;
}

async function loadHexRom(url, baseAddr = 0x6000) {
    try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`Failed to fetch ${url}: ${resp.status}`);
        const text = await resp.text();
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        let minAddr = Infinity, maxAddr = -Infinity;
        for (const line of lines) {
            if (line[0] !== ':') continue;
            const len = parseInt(line.substr(1,2),16);
            const addr = parseInt(line.substr(3,4),16);
            const type = parseInt(line.substr(7,2),16);
            if (type === 0) {
                // data record
                for (let i=0;i<len;i++) {
                    const byte = parseInt(line.substr(9 + i*2, 2), 16);
                    const dst = (baseAddr + addr + i) & 0xffff;
                    m_mem_mapping[dst] = byte;
                    if (dst < minAddr) minAddr = dst;
                    if (dst > maxAddr) maxAddr = dst;
                }
            }
            // ignore other record types (e.g., EOF)
        }
        if (minAddr !== Infinity) {
            romRegions.push({ start: minAddr, end: maxAddr });
            console.log(`Loaded ROM ${url} -> ${toHex(baseAddr)}..${toHex(baseAddr + (maxAddr-minAddr))}`);
        } else {
            console.warn(`No data records found in ${url}`);
        }
    } catch (e) {
        console.error('loadHexRom error', e);
    }
}

// Auto-load requested ROM file into 0x6000 on startup
loadHexRom('/archive/prt-ib.hex', 0x6000);

// Convenience helpers for console interaction
try { window.loadHexRom = loadHexRom; window.listRomRegions = () => romRegions; } catch (e) {}

function mem_read(address) {
    if ((address & 0xffff) === address) {
        return m_mem_mapping[address];
    }
    console.error("No Mem replied to memory read: " + address);
    return 0;
}

function mem_write(address, value) {
    address &= 0xffff;
    value &= 0xff;
    // Prevent writes into ROM regions
    if (isRomAddress(address)) {
        console.warn(`Attempt to write to ROM at ${toHex(address)} ignored (value ${toHex(value)})`);
        return;
    }
    if (address > 0x17ff && address < 0x2000) {
        m_mem_mapping[address] = value;
    } else {
        if (!((address == 0 && value == 0x10) ||
            (address == 1 & value == 0x20) ||
            (address == 0x1000 & value == 0) ||
            (address == 0xffff & value == 0xff)))
            console.error(`PC: ${toHex(zpu.getState().pc)} Invalid memory at: ${toHex(address)} value: ${toHex(value)}`);
    }
}
