function parseIntelHex(hexString, dataArrays) {
    const lines = hexString.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    let address;
    let length;
    for (const line of lines) {
        if (line[0] !== ':') {
            throw new Error("Invalid Intel HEX line, should start with ':'");
        }
        length = parseInt(line.substr(1, 2), 16);
        address = parseInt(line.substr(3, 4), 16);
        const type = parseInt(line.substr(7, 2), 16);
        const data = line.substr(9, length * 2);
        let j = 0;
        for (let i = 0; i < data.length; i += 2, j++) {
            const byte = parseInt(data.substr(i, 2), 16);
            dataArrays[address + j] = byte;
        }
    }
    return { address: address, length: length, data: dataArrays.slice(address, address + length) };
}
let fileContent;
const fileUrl = '/archive/monitor_and_tiny_basic.u6.hex';

logFileContent(fileUrl);

async function logFileContent(fileUrl) {
    await fetchFileAndLog(fileUrl);
    parseIntelHex(fileContent, m_mem_mapping);
}   

async function fetchFileAndLog(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch the file: ${response.statusText}`);
        }
        fileContent = await response.text();
    } catch (error) {
        console.error('Error fetching the file:', error);
    }
}
