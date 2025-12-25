async function waitFor200ms() {
  return new Promise(resolve => setTimeout(resolve, 200));
}

function pressKey(key) {
  for (const entry of keyMap) {
    if (entry.key === key) {
      keypressed = true;
      const image = document.getElementById('keyboard-image');
      const rect = image.getBoundingClientRect();
      // Compute scale relative to the image's intrinsic size so coordinates map correctly
      const nativeW = image.naturalWidth || rect.width || 574;
      const nativeH = image.naturalHeight || rect.height || 262;
      const scaleX = rect.width / nativeW;
      const scaleY = rect.height / nativeH;
      const clickX = rect.left + (entry.x * scaleX);
      const clickY = rect.top + (entry.y * scaleY);
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        clientX: clickX,
        clientY: clickY,
      });
      image.dispatchEvent(clickEvent);
    }
  }
}

async function moveCircle(x, y, z) {
  if (z == 0) await new Promise(r => setTimeout(r, 100));
  const circle = document.getElementById('circle');
  const image = document.getElementById('keyboard-image');
  const container = image.closest('.image-container') || image.parentElement;
  const containerRect = container.getBoundingClientRect();
  const relX = x - containerRect.left;
  const relY = y - containerRect.top;
  circle.style.left = `${relX - circle.offsetWidth / 2}px`;
  circle.style.top = `${relY - circle.offsetHeight / 2}px`;
  circle.style.display = 'block';
  circle.style.opacity = z;
}

async function load(SET_KEY = 'DEFAULT') {
  let codeRows;
  startAudioSession();
  try {
    const response = await fetch('./resources/hex-data.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const HEX_CODE_SETS = await response.json();
    codeRows = HEX_CODE_SETS[SET_KEY];
  } catch (error) {
    console.error("Could not load HEX_CODE_SETS:", error);
  }
  let memBlock = new Uint8Array(codeRows.length).fill(255);
  let dummyMem = new Uint8Array(0x10000).fill(255);
  const codeArray = codeRows.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  for (const code of codeArray) {
    pressKey("ADDR");
    await waitFor200ms();
    memBlock = parseIntelHex(code, dummyMem);
    const addressChunks = [
      Math.floor(memBlock.address / 0x1000),
      Math.floor((memBlock.address % 0x1000) / 0x100),
      Math.floor((memBlock.address % 0x100) / 0x10),
      Math.floor(memBlock.address % 0x10)
    ];
    for (let i = 0; i < addressChunks.length; i++) {
      pressKey(`HEX_${addressChunks[i].toString(16).toUpperCase().padStart(1, '0')}`);
      await waitFor200ms();
    }
    pressKey("DATA");
    await waitFor200ms();
    for (let i = 0; i < memBlock.data.length; i++) {
      const dataByte = memBlock.data[i];
      pressKey(`HEX_${Math.floor(dataByte / 0x10).toString(16).toUpperCase().padStart(1, '0')}`);
      await waitFor200ms();
      pressKey(`HEX_${(dataByte % 0x10).toString(16).toUpperCase().padStart(1, '0')}`);
      await waitFor200ms();
      pressKey("+");
      await waitFor200ms();
    }
  }
  pressKey("ADDR"); await waitFor200ms();
  pressKey("HEX_1"); await waitFor200ms();
  pressKey("HEX_8"); await waitFor200ms();
  pressKey("HEX_0"); await waitFor200ms();
  pressKey("HEX_0"); await waitFor200ms();
  pressKey("GO"); await waitFor200ms();
  dummyMem = null;
  memBlock = null;
  stopAudioSession();
}

function file() {
  const fileInput = document.getElementById('file-upload');
  fileInput.click();
  fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function (e) {
        term.write(`\r\nFile content:\r\n${e.target.result}\r\n`);
        term.write('\r\n> ');
      };
      reader.onerror = function () {
        term.write(`\r\nError reading file.\r\n> `);
      };
      reader.readAsText(file);
    } else {
      term.write(`\r\nNo file selected.\r\n> `);
    }
  });
}