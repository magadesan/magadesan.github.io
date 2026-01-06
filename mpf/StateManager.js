/**
 * StateManager - Centralized state management for the emulator
 */

import { CONFIG } from './config.js';

export class StateManager {
    constructor() {
        this.visualZoom = CONFIG.VISUAL_ZOOM.DEFAULT;
        this.currentKeyboard = this.loadKeyboardPreference();
        this.tooltipState = {
            visible: false,
            text: '',
            x: 0,
            y: 0,
            width: 0
        };
    }

    /**
     * Loads keyboard preference from localStorage
     */
    loadKeyboardPreference() {
        try {
            return localStorage.getItem(CONFIG.STORAGE_KEYS.KEYBOARD) || 'mpf1b';
        } catch (e) {
            return 'mpf1b';
        }
    }

    /**
     * Saves keyboard preference to localStorage
     */
    saveKeyboardPreference(key) {
        try {
            localStorage.setItem(CONFIG.STORAGE_KEYS.KEYBOARD, key);
        } catch (e) {
            console.warn('Failed to save keyboard preference:', e);
        }
    }

    /**
     * Gets current keyboard
     */
    getCurrentKeyboard() {
        return this.currentKeyboard;
    }

    /**
     * Sets current keyboard
     */
    setCurrentKeyboard(key) {
        this.currentKeyboard = key;
        this.saveKeyboardPreference(key);
    }

    /**
     * Gets visual zoom level
     */
    getVisualZoom() {
        return this.visualZoom;
    }

    /**
     * Sets visual zoom level with bounds checking
     */
    setVisualZoom(scale) {
        this.visualZoom = Math.max(
            CONFIG.VISUAL_ZOOM.MIN,
            Math.min(CONFIG.VISUAL_ZOOM.MAX, +(scale).toFixed(2))
        );
        return this.visualZoom;
    }

    /**
     * Gets tooltip state
     */
    getTooltipState() {
        return { ...this.tooltipState };
    }

    /**
     * Sets tooltip state
     */
    setTooltipState(state) {
        this.tooltipState = { ...this.tooltipState, ...state };
    }

    /**
     * Resets tooltip
     */
    resetTooltip() {
        this.tooltipState = {
            visible: false,
            text: '',
            x: 0,
            y: 0,
            width: 0
        };
    }
}

