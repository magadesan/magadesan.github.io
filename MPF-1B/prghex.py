#!/usr/bin/env python3
"""
Convert Intel HEX <-> Commodore PRG (pure Python)
Usage:
    python convert_hex_prg_pure.py <file.hex|file.prg>
"""

import sys
import os

DEFAULT_LOAD_ADDR = 0x0801

def parse_intel_hex_line(line):
    """Parse a single line of Intel HEX"""
    if not line.startswith(':'):
        raise ValueError("Invalid HEX line")
    byte_count = int(line[1:3], 16)
    addr = int(line[3:7], 16)
    record_type = int(line[7:9], 16)
    data = bytes(int(line[9+2*i:11+2*i],16) for i in range(byte_count))
    checksum = int(line[9+2*byte_count:11+2*byte_count],16)
    return addr, record_type, data

def read_intel_hex(file_path):
    """Read entire Intel HEX into memory dict {address: byte}"""
    memory = {}
    with open(file_path, 'r') as f:
        for line in f:
            line = line.strip()
            if not line: continue
            addr, rec_type, data = parse_intel_hex_line(line)
            if rec_type == 0:  # data record
                for i, b in enumerate(data):
                    memory[addr + i] = b
            elif rec_type == 1:  # end of file
                break
            # ignore other record types for simplicity
    # Convert memory dict to bytearray, contiguous
    if memory:
        start = min(memory.keys())
        end = max(memory.keys())
        data_bytes = bytearray(memory.get(i,0) for i in range(start, end+1))
    else:
        data_bytes = bytearray()
    return data_bytes

def write_intel_hex(data_bytes, start_addr, output_file):
    """Write bytearray to Intel HEX format"""
    with open(output_file, 'w') as f:
        addr = start_addr
        for i in range(0, len(data_bytes), 16):
            chunk = data_bytes[i:i+16]
            byte_count = len(chunk)
            addr_field = f"{addr+i:04X}"
            record_type = "00"
            data_field = ''.join(f"{b:02X}" for b in chunk)
            checksum = (byte_count + ((addr+i)>>8) + ((addr+i)&0xFF) + sum(chunk))
            checksum = ((~checksum + 1) & 0xFF)
            f.write(f":{byte_count:02X}{addr_field}{record_type}{data_field}{checksum:02X}\n")
        f.write(":00000001FF\n")  # EOF

def hex_to_prg(input_file, output_file, load_addr=DEFAULT_LOAD_ADDR):
    data_bytes = read_intel_hex(input_file)
    prg_bytes = bytearray([load_addr & 0xFF, (load_addr >> 8) & 0xFF]) + data_bytes
    with open(output_file, "wb") as f:
        f.write(prg_bytes)

def prg_to_hex(input_file, output_file):
    with open(input_file, "rb") as f:
        data = f.read()
    if len(data) < 2:
        print("PRG too short")
        return
    load_addr = data[0] + (data[1] << 8)
    data_bytes = data[2:]
    write_intel_hex(data_bytes, load_addr, output_file)

def main():
    if len(sys.argv) != 2:
        print("Usage: python convert_hex_prg_pure.py <file.hex|file.prg>")
        sys.exit(1)
    input_file = sys.argv[1]
    base, ext = os.path.splitext(input_file)
    if ext.lower() == ".hex":
        hex_to_prg(input_file, base + ".prg")
        print(f"Converted {input_file} -> {base}.prg")
    elif ext.lower() == ".prg":
        prg_to_hex(input_file, base + ".hex")
        print(f"Converted {input_file} -> {base}.hex")
    else:
        print("Unknown extension. Use .hex or .prg")

if __name__ == "__main__":
    main()
