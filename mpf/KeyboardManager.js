/**
 * KeyboardManager - Manages keyboard image switching and preferences
 */

import { CONFIG } from './config.js';
import { StateManager } from './StateManager.js';

export class KeyboardManager {
    constructor(stateManager) {
        this.stateManager = stateManager;
    }

    /**
     * Sets the keyboard image
     */
    setKeyboardImage(keyName) {
        const img = document.getElementById('keyboard-image');
        if (!img) return;
        
        const key = keyName in CONFIG.KEYBOARD_MAP ? keyName : 'mpf1b';
        img.src = CONFIG.KEYBOARD_MAP[key];
        this.stateManager.setCurrentKeyboard(key);
        
        // Update selector if present
        const sel = document.getElementById('keyboard-select');
        if (sel) {
            try {
                sel.value = key === 'mpf1b' ? 'mpf-1b' : 'tiny-basic';
            } catch (e) {
                console.warn('Failed to update keyboard selector:', e);
            }
        }
    }

    /**
     * Initializes keyboard selector
     */
    initKeyboardSelector() {
        const sel = document.getElementById('keyboard-select');
        if (!sel) return;
        
        try {
            const currentKey = this.stateManager.getCurrentKeyboard();
            sel.value = currentKey === 'mpf1b' ? 'mpf-1b' : 'tiny-basic';
        } catch (e) {
            console.warn('Failed to set keyboard selector value:', e);
        }
        
        sel.addEventListener('change', (e) => {
            const v = e.target.value === 'tiny-basic' ? 'tinybasic' : 'mpf1b';
            this.setKeyboardImage(v);
        });
        
        // Ensure image is set on load
        this.setKeyboardImage(this.stateManager.getCurrentKeyboard());
    }

    /**
     * Toggles between keyboard layouts
     */
    toggleKeyboard() {
        const current = this.stateManager.getCurrentKeyboard();
        const next = current === 'mpf1b' ? 'tinybasic' : 'mpf1b';
        this.setKeyboardImage(next);
    }
}

