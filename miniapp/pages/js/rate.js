// ========================================
// RATE PAGE LOGIC
// ========================================

(function() {
    'use strict';

    // DOM Elements
    let backButton = null;
    let goHomeButton = null;
    let buyRateValue = null;
    let sellRateValue = null;

    // Rate update interval
    let rateUpdateInterval = null;

    // Initialize
    function init() {
        // Get DOM elements after page is loaded
        backButton = document.querySelector('#pageRate .back-button');
        goHomeButton = document.getElementById('goHomeButton');
        buyRateValue = document.getElementById('ratePageBuyValue');
        sellRateValue = document.getElementById('ratePageSellValue');
        
        setupEventListeners();
        startRateUpdates();
    }

    // Setup event listeners
    function setupEventListeners() {
        // Back button
        if (backButton) {
            backButton.addEventListener('click', handleBack);
        }

        // CTA button (now btn-contact)
        const goHomeButton = document.getElementById('goHomeButton');
        if (goHomeButton) {
            goHomeButton.addEventListener('click', handleGoHome);
        }

        // Rate cards tap feedback
        const rateCards = document.querySelectorAll('#pageRate .rate-card');
        rateCards.forEach(card => {
            card.addEventListener('click', () => {
                if (window.Telegram?.WebApp?.HapticFeedback) {
                    window.Telegram.WebApp.HapticFeedback.selectionChanged();
                }
            });
        });
    }

    // Handle back button
    function handleBack() {
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
        }
        stopRateUpdates();
        if (typeof showPage === 'function') {
            showPage('home');
        }
    }

    // Handle go home button
    function handleGoHome() {
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
        }
        stopRateUpdates();
        // Use global showPage function
        if (window.showPage) {
            window.showPage('home');
        } else if (typeof showPage === 'function') {
            showPage('home');
        }
    }

    // Start rate updates
    function startRateUpdates() {
        // Initial rates from global variables
        // Always try to update immediately
        updateRatesFromAPI();
        
        // Also update after delays to catch API updates
        setTimeout(() => {
            updateRatesFromAPI();
        }, 500);
        
        setTimeout(() => {
            updateRatesFromAPI();
        }, 1500);

        // Update rates every 30 seconds (same as main app)
        rateUpdateInterval = setInterval(() => {
            updateRatesFromAPI();
        }, 30000);
    }

    // Update rates from API (using global variables)
    function updateRatesFromAPI() {
        // Get rates directly from global variables
        // If not set yet, use placeholders or 0
        const buyRate = window.globalBuyRate || 0;
        const sellRate = window.globalSellRate || 0;

        // Update display with animation
        if (buyRateValue && sellRateValue) {
            // Check if values actually changed to avoid unnecessary animation
            const currentBuy = parseFloat(buyRateValue.textContent) || 0;
            const currentSell = parseFloat(sellRateValue.textContent) || 0;
            
            // Only animate if we have valid rates and they changed
            const isValidRate = buyRate > 0 && sellRate > 0;
            const hasChanged = isValidRate && (Math.abs(currentBuy - buyRate) > 0.01 || Math.abs(currentSell - sellRate) > 0.01);

            // Always update values if we have them
            if (buyRateValue && isValidRate) {
                buyRateValue.textContent = buyRate.toFixed(2);
            } else if (buyRateValue && !isValidRate && buyRateValue.textContent.trim() === '') {
                 // Show loader or placeholder if empty and no rate yet
                 buyRateValue.textContent = '...';
            }
            
            if (sellRateValue && isValidRate) {
                sellRateValue.textContent = sellRate.toFixed(2);
            } else if (sellRateValue && !isValidRate && sellRateValue.textContent.trim() === '') {
                 // Show loader or placeholder if empty and no rate yet
                 sellRateValue.textContent = '...';
            }

            // Add animation only if values changed
            if (hasChanged) {
                buyRateValue.classList.add('updating');
                sellRateValue.classList.add('updating');
                
                setTimeout(() => {
                    if (buyRateValue) buyRateValue.classList.remove('updating');
                    if (sellRateValue) sellRateValue.classList.remove('updating');
                }, 500);

                // Haptic feedback on rate change
                if (window.Telegram?.WebApp?.HapticFeedback) {
                    window.Telegram.WebApp.HapticFeedback.selectionChanged();
                }
            }
        }
    }

    // Stop rate updates
    function stopRateUpdates() {
        if (rateUpdateInterval) {
            clearInterval(rateUpdateInterval);
            rateUpdateInterval = null;
        }
    }


    // Export update function for global use
    window.updateRatesFromAPI = updateRatesFromAPI;

    // Cleanup function (called when leaving page)
    window.cleanupRatePage = function() {
        stopRateUpdates();
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
