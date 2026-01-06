/**
 * Configuration and constants for the MPF-1B emulator
 */

export const CONFIG = {
  // Recording settings
  FRAME_RATE: 60,
  RECORDING_INTERVAL_MS: 1000,
  AUDIO_CHUNK_INTERVAL_MS: 100,
  
  // Visual zoom settings
  VISUAL_ZOOM: {
    MIN: 0.5,
    MAX: 3.0,
    STEP: 0.1,
    DEFAULT: 1.0
  },
  
  // Keyboard mappings
  KEYBOARD_MAP: {
    mpf1b: 'https://www.robkalmeijer.nl/techniek/computer/mpf1/mpf-1b_keyboard.jpg',
    tinybasic: 'https://electrickery.hosting.philpem.me.uk/comp/mpf1/doc/tinyBasicKeyboardOverlay.jpg'
  },
  
  // 7-segment display IDs
  SEGMENT_DISPLAY_IDS: [
    "svg-object-add3",
    "svg-object-add2",
    "svg-object-add1",
    "svg-object-add0",
    "svg-object-data1",
    "svg-object-data0"
  ],
  
  // I/O Port addresses
  IO_PORTS: {
    DATA: 0x01,
    DIGIT_SELECT: 0x02,
    CA: 0xCA,
    CB: 0xCB
  },
  
  // Memory regions
  MEMORY: {
    ROM_START: 0x6000,
    VALID_WRITE_START: 0x1800,
    VALID_WRITE_END: 0x2000
  },
  
  // CPU execution
  CPU: {
    CYCLE_THRESHOLD: 18000,
    TIMING_MS: 10,
    DEFAULT_BREAKPOINT: 0xFFFF
  },
  
  // Button colors
  BUTTON_COLORS: {
    DEFAULT: '#bbb',
    POWER_OFF: '#F44336',
    POWER_ON: '#4CAF50',
    PRESSED: '#F44336',
    ACTIVE: '#4CAF50',
    WARNING: '#FFC107',
    INFO: '#2196F3',
    PURPLE: '#9C27B0'
  },
  
  // LED colors
  LED_COLORS: {
    GREEN_ON: 'limegreen',
    GREEN_OFF: 'rgba(0, 128, 0, 0.15)',
    RED_ON: 'red',
    RED_OFF: 'rgba(255, 0, 0, 0.15)'
  },
  
  // Storage keys
  STORAGE_KEYS: {
    KEYBOARD: 'upf.keyboard'
  }
};

