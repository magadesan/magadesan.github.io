/**
 * DOMUtils - Utility functions for DOM manipulation
 */

import { CONFIG } from './config.js';

export class DOMUtils {
    /**
     * Gets a DOM element by ID with error handling
     */
    static getElementById(id) {
        const element = document.getElementById(id);
        if (!element) {
            console.warn(`Element with id "${id}" not found`);
        }
        return element;
    }

    /**
     * Gets button element by title pattern
     */
    static getButtonByTitle(pattern) {
        return document.querySelector(`.button-grid div[title*="${pattern}"]`);
    }

    /**
     * Updates button state and color
     */
    static updateButtonState(button, isActive, color) {
        if (!button) return;
        
        const svgCircle = button.querySelector('svg circle');
        if (svgCircle) {
            svgCircle.setAttribute('fill', color);
        }
        button.setAttribute('data-state', isActive ? 'on' : 'off');
    }

    /**
     * Temporarily flashes a button color
     */
    static flashButton(button, color, duration = 200) {
        if (!button) return;
        
        const svgCircle = button.querySelector('svg circle');
        if (!svgCircle) return;
        
        const originalFill = svgCircle.getAttribute('fill');
        svgCircle.setAttribute('fill', color);
        
        setTimeout(() => {
            svgCircle.setAttribute('fill', originalFill);
        }, duration);
    }

    /**
     * Updates LED state
     */
    static updateLED(ledId, isOn) {
        const led = document.getElementById(ledId);
        if (led) {
            if (isOn) {
                led.classList.add('on');
            } else {
                led.classList.remove('on');
            }
        }
    }

    /**
     * Clears a single 7-segment display
     */
    static clearSingle7Segment(id) {
        const obj = document.getElementById(id);
        if (!obj) return;
        
        const clearSvgText = (svgDoc) => {
            const textElement = svgDoc.querySelector('text');
            if (textElement) {
                textElement.textContent = '';
            }
        };
        
        obj.onload = () => { clearSvgText(obj.contentDocument); };
        if (obj.contentDocument) {
            clearSvgText(obj.contentDocument);
        }
    }

    /**
     * Clears all 7-segment displays
     */
    static clearAll7SegmentDisplays() {
        CONFIG.SEGMENT_DISPLAY_IDS.forEach(id => {
            this.clearSingle7Segment(id);
        });
    }

    /**
     * Gets dynamic SVG image from an object element
     */
    static getDynamicSVGImage(id) {
        const obj = document.getElementById(id);
        if (!obj || !obj.contentDocument) return null;
        
        try {
            const svgElement = obj.contentDocument.documentElement;
            const width = obj.offsetWidth;
            const height = obj.offsetHeight;
            const svgString = new XMLSerializer().serializeToString(svgElement);
            const svgDataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
            
            const img = new Image(width, height);
            img.width = width;
            img.height = height;
            img.src = svgDataUrl;
            return img;
        } catch (e) {
            console.error(`Failed to generate SVG image for ${id}:`, e);
            return null;
        }
    }

    /**
     * Gets button circle details for drawing
     */
    static getButtonCircleDetails(button, windowRect) {
        const circle = button.querySelector('svg circle');
        const textElement = button.querySelector('svg text') || button.querySelector('p');
        
        if (!circle) return null;

        const circleRect = circle.getBoundingClientRect();
        if (circleRect.width === 0) return null;

        const isActive = button.getAttribute('data-state') === 'on';
        
        let fillColor = circle.getAttribute('fill') || CONFIG.BUTTON_COLORS.DEFAULT;
        if (!isActive && button.getAttribute('title')?.includes('Power')) {
            fillColor = CONFIG.BUTTON_COLORS.POWER_OFF;
        } else if (!isActive) {
            fillColor = CONFIG.BUTTON_COLORS.DEFAULT;
        }

        const centerX = circleRect.left - windowRect.left + (circleRect.width / 2);
        const centerY = circleRect.top - windowRect.top + (circleRect.height / 2);

        let buttonText = '';
        if (textElement) {
            buttonText = textElement.textContent.trim();
        }

        return {
            x: centerX,
            y: centerY,
            radius: parseInt(circle.getAttribute('r'), 10) || 12,
            fill: fillColor,
            text: buttonText,
            textX: centerX,
            textY: centerY,
            textColor: '#333'
        };
    }

    /**
     * Applies UI scale transform
     */
    static applyUIScale(scale) {
        try {
            const windowEl = document.getElementById('window');
            const imageContainer = document.querySelector('.image-container');
            
            if (windowEl) {
                windowEl.style.transformOrigin = '0 0';
                windowEl.style.transform = `scale(${scale})`;
            }
            if (imageContainer) {
                imageContainer.style.transformOrigin = '0 0';
                imageContainer.style.transform = `scale(${scale})`;
            }
        } catch (e) {
            console.warn('applyUIScale failed', e);
        }
    }
}

