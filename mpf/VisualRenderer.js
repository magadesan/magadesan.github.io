/**
 * VisualRenderer - Handles canvas rendering for screen recording
 */

import { CONFIG } from './config.js';
import { DOMUtils } from './DOMUtils.js';

export class VisualRenderer {
    constructor(stateManager) {
        this.stateManager = stateManager;
    }

    /**
     * Draws a single frame onto the canvas
     */
    drawCanvasFrame(canvas, ctx, windowEl, keyboardImage) {
        const windowRect = windowEl.getBoundingClientRect();
        const visualZoom = this.stateManager.getVisualZoom();
        const tooltipState = this.stateManager.getTooltipState();

        // Clear the whole canvas
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();

        // Apply visual zoom transform
        ctx.setTransform(visualZoom, 0, 0, visualZoom, 0, 0);
        
        // Draw window area background
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, windowEl.offsetWidth, windowEl.offsetHeight);

        // Draw 7-segment displays
        this.draw7SegmentDisplays(ctx, windowRect);

        // Draw LEDs
        this.drawLEDs(ctx, windowRect);

        // Draw keyboard area
        const keyboardYOffset = windowEl.offsetHeight;
        ctx.drawImage(keyboardImage, 0, keyboardYOffset, keyboardImage.offsetWidth, keyboardImage.offsetHeight);

        // Draw buttons
        this.drawButtons(ctx, windowRect);

        // Draw feedback circle
        this.drawFeedbackCircle(ctx, windowRect);

        // Draw tooltip
        if (tooltipState.visible && tooltipState.text) {
            this.drawTooltip(ctx, tooltipState);
        }
    }

    /**
     * Draws 7-segment displays
     */
    draw7SegmentDisplays(ctx, windowRect) {
        CONFIG.SEGMENT_DISPLAY_IDS.forEach(id => {
            const obj = document.getElementById(id);
            const img = DOMUtils.getDynamicSVGImage(id);

            if (obj && img && img.complete) {
                const objRect = obj.getBoundingClientRect();
                const xPos = objRect.left - windowRect.left;
                const yPos = objRect.top - windowRect.top;
                ctx.drawImage(img, xPos, yPos, obj.offsetWidth, obj.offsetHeight);
            }
        });
    }

    /**
     * Draws LEDs
     */
    drawLEDs(ctx, windowRect) {
        const ledGreen = document.getElementById('led-green');
        const ledRed = document.getElementById('led-red');
        
        [ledGreen, ledRed].forEach(led => {
            if (!led) return;
            
            const ledRect = led.getBoundingClientRect();
            const isOn = led.classList.contains('on');
            const color = led.id === 'led-green' 
                ? CONFIG.LED_COLORS.GREEN_ON 
                : CONFIG.LED_COLORS.RED_ON;
            const offColor = led.id === 'led-green'
                ? CONFIG.LED_COLORS.GREEN_OFF
                : CONFIG.LED_COLORS.RED_OFF;
            
            const xPos = ledRect.left - windowRect.left + (ledRect.width / 2);
            const yPos = ledRect.top - windowRect.top + (ledRect.height / 2);
            const radius = ledRect.width / 2;

            if (radius > 0) {
                ctx.beginPath();
                ctx.arc(xPos, yPos, radius, 0, 2 * Math.PI);
                ctx.fillStyle = isOn ? color : offColor;
                ctx.fill();
                
                if (isOn) {
                    ctx.shadowColor = color;
                    ctx.shadowBlur = 10;
                    ctx.fillStyle = color;
                    ctx.fill();
                    ctx.shadowBlur = 0;
                }
            }
        });
    }

    /**
     * Draws buttons
     */
    drawButtons(ctx, windowRect) {
        const buttons = document.querySelectorAll('.button-grid div');
        
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '12px Arial';

        buttons.forEach(button => {
            const details = DOMUtils.getButtonCircleDetails(button, windowRect);
            const isPressed = button.classList.contains('is-pressed');

            if (details) {
                let finalFill = details.fill;
                if (isPressed) {
                    finalFill = CONFIG.BUTTON_COLORS.PRESSED;
                }

                ctx.beginPath();
                ctx.arc(details.x, details.y, details.radius + 1, 0, 2 * Math.PI);
                ctx.strokeStyle = '#333';
                ctx.lineWidth = 1;
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(details.x, details.y, details.radius, 0, 2 * Math.PI);
                ctx.fillStyle = finalFill;
                ctx.fill();
                
                if (details.text) {
                    ctx.fillStyle = details.textColor;
                    ctx.fillText(details.text, details.textX, details.textY);
                }
            }
        });
    }

    /**
     * Draws feedback circle
     */
    drawFeedbackCircle(ctx, windowRect) {
        const feedbackCircle = document.getElementById('circle');
        if (!feedbackCircle) return;

        const computedStyle = window.getComputedStyle(feedbackCircle);
        const opacity = parseFloat(computedStyle.opacity);
        const display = computedStyle.display;

        if (display !== 'none' && opacity > 0) {
            const circleRect = feedbackCircle.getBoundingClientRect();
            const x = circleRect.left - windowRect.left + (circleRect.width / 2);
            const y = circleRect.top - windowRect.top + (circleRect.height / 2);
            const radius = circleRect.width / 2;

            ctx.save();
            ctx.globalAlpha = opacity;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, 2 * Math.PI);
            ctx.fillStyle = computedStyle.backgroundColor || 'rgba(255, 0, 0, 0.5)';
            ctx.fill();
            ctx.restore();
        }
    }

    /**
     * Draws tooltip
     */
    drawTooltip(ctx, tooltipState) {
        ctx.save();
        ctx.font = '12px sans-serif';
        const padding = 6;
        const textWidth = ctx.measureText(tooltipState.text).width;
        const boxWidth = textWidth + (padding * 2);
        const boxHeight = 20;
        
        // Draw tooltip background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(tooltipState.x - (boxWidth / 2), tooltipState.y, boxWidth, boxHeight);
        
        // Draw tooltip text
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tooltipState.text, tooltipState.x, tooltipState.y + (boxHeight / 2));
        
        ctx.restore();
    }

    /**
     * Gets visual stream for recording
     */
    getVisualStream(recordingManager) {
        const windowEl = document.getElementById('window');
        const keyboardImage = document.getElementById('keyboard-image');
        const imageContainerEl = document.querySelector('.image-container');

        if (!windowEl || !keyboardImage || !imageContainerEl) {
            console.error("Visual capture failed: Required DOM elements missing.");
            throw new Error("Missing DOM elements for visual capture.");
        }
        
        const canvas = document.createElement('canvas');
        const totalHeight = windowEl.offsetHeight + imageContainerEl.offsetHeight;
        const totalWidth = windowEl.offsetWidth;
        const visualZoom = this.stateManager.getVisualZoom();

        // Set canvas pixel dimensions according to visualZoom
        canvas.width = Math.round(totalWidth * visualZoom);
        canvas.height = Math.round(totalHeight * visualZoom);
        canvas.style.width = `${totalWidth}px`;
        canvas.style.height = `${totalHeight}px`;

        const ctx = canvas.getContext('2d');

        // Draw initial frame
        this.drawCanvasFrame(canvas, ctx, windowEl, keyboardImage);
        
        const stream = canvas.captureStream(CONFIG.FRAME_RATE);
        
        // Set up interval for continuous drawing
        const intervalId = setInterval(() => {
            try {
                this.drawCanvasFrame(canvas, ctx, windowEl, keyboardImage);
            } catch (e) {
                console.error("[VIS WARN] Canvas drawImage failed. Stopping interval.", e);
                clearInterval(intervalId);
                recordingManager.setRecordingInterval(null);
                throw e;
            }
        }, 1000 / CONFIG.FRAME_RATE);
        
        recordingManager.setRecordingInterval(intervalId);
        
        return stream;
    }
}

