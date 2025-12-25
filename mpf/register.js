function toHex(value, length) {
    if (typeof value !== 'number') {
        value = Number(value);
    }

    if (isNaN(value)) {
        console.error("Invalid value passed:", value);
        return "Invalid";
    }

    return value.toString(16).toUpperCase().padStart(length, '0');
}
function decimalToHex(number, bytes = 1) {
    const hexDigits = "0123456789ABCDEF";
    let hexString = '';
    if (number === 0) {
        return '0'.padStart(bytes * 2, '0');
    }
    const maxValue = Math.pow(256, bytes) - 1;
    if (number < 0 || number > maxValue) {
        throw new Error(`Number out of range for ${bytes}-byte input.`);
    }
    while (number > 0) {
        let remainder = number % 16;
        hexString = hexDigits[remainder] + hexString;
        number = Math.floor(number / 16);
    }
    return hexString.padStart(bytes * 2, '0');
}
function displayRegisters() {
    const state = zpu.getState();
    const registerList = [
        { label: 'A', value: state.a, length: 2 },
        { label: 'B', value: state.b, length: 2 },
        { label: 'C', value: state.c, length: 2 },
        { label: 'D', value: state.d, length: 2 },
        { label: 'E', value: state.e, length: 2 },
        { label: 'H', value: state.h, length: 2 },
        { label: 'L', value: state.l, length: 2 },
        { label: 'A\'', value: state.a_prime, length: 2 },
        { label: 'B\'', value: state.b_prime, length: 2 },
        { label: 'C\'', value: state.c_prime, length: 2 },
        { label: 'D\'', value: state.d_prime, length: 2 },
        { label: 'E\'', value: state.e_prime, length: 2 },
        { label: 'H\'', value: state.h_prime, length: 2 },
        { label: 'L\'', value: state.l_prime, length: 2 },
        { label: 'IX', value: state.ix, length: 4 },
        { label: 'IY', value: state.iy, length: 4 },
        { label: 'I', value: state.i, length: 2 },
        { label: 'R', value: state.r, length: 2 },
        { label: 'SP', value: state.sp, length: 4 },
        { label: 'PC', value: state.pc, length: 4 }
    ];

    const flags = `S: ${state.flags.S}, Z: ${state.flags.Z}, Y: ${state.flags.Y}, H: ${state.flags.H}, ` +
        `X: ${state.flags.X}, P: ${state.flags.P}, N: ${state.flags.N}, C: ${state.flags.C}`;

    const flagsPrime = `S: ${state.flags_prime.S}, Z: ${state.flags_prime.Z}, Y: ${state.flags_prime.Y}, H: ${state.flags_prime.H}, ` +
        `X: ${state.flags_prime.X}, P: ${state.flags_prime.P}, N: ${state.flags_prime.N}, C: ${state.flags_prime.C}`;

    let line = '\n\r';
    registerList.forEach((reg, index) => {
        const regStr = `${reg.label}:${toHex(reg.value, reg.length)}`;
        if (line.length + regStr.length + 1 <= 80) {
            line += regStr + ' ';
        } else {
            logger.write('\n\r' + line.trim() + '\n\r');
            line = regStr + ' ';
        }
        if (index === registerList.length - 1) {
            logger.write(line.trim() + '\n\r');
        }
    });
    logger.write(`Flags: ${flags}\n\r`);
    logger.write(`Flags' (Prime): ${flagsPrime}`);
}
function displayMemorySubset(start, end) {
    if (start < 0 || start >= end) {
        logger.write("Invalid range!\n");
        return;
    }
    for (let i = start; i < end; i += 16) {
        logger.write(i.toString(16).padStart(4, '0').toUpperCase() + "  ");
        for (let j = 0; j < 16 && i + j < end; j++) {
            logger.write(decimalToHex(m_mem_mapping[i + j]) + " ");
        }
        logger.write("  ");
        for (let j = 0; j < 16 && i + j < end; j++) {
            let byte = m_mem_mapping[i + j];
            if (byte >= 32 && byte <= 126) {
                logger.write(String.fromCharCode(byte));
            } else {
                logger.write(".");
            }
        }

        if (i < end - 16) logger.write("\n\r");
    }
}
