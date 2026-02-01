/**
 * About Page Logic
 * Handles statistics and feature displays
 */

// About page state
const aboutState = {
    stats: {
        deals: 15000,
        clients: 5000
    }
};

/**
 * Initialize About Page
 */
function initAboutPage() {
    // Animate stats on load
    animateStats();

    console.log('About page initialized');
}

/**
 * Animate statistics counter
 */
function animateStats() {
    const statDeals = document.getElementById('statDeals');
    const statClients = document.getElementById('statClients');

    if (statDeals) {
        animateCounter(statDeals, aboutState.stats.deals, 'K+');
    }

    if (statClients) {
        animateCounter(statClients, aboutState.stats.clients, 'K+');
    }
}

/**
 * Animate a counter element
 */
function animateCounter(element, target, suffix = '') {
    const duration = 1500;
    const startTime = performance.now();
    const startValue = 0;

    // Convert to K format
    const displayTarget = target / 1000;

    function updateCounter(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function (ease-out)
        const easeOut = 1 - Math.pow(1 - progress, 3);

        const currentValue = startValue + (displayTarget - startValue) * easeOut;

        // Format the number
        if (currentValue >= 1) {
            element.textContent = Math.round(currentValue) + suffix;
        } else {
            element.textContent = currentValue.toFixed(1) + suffix;
        }

        if (progress < 1) {
            requestAnimationFrame(updateCounter);
        } else {
            element.textContent = Math.round(displayTarget) + suffix;
        }
    }

    // Start animation after a small delay
    setTimeout(() => {
        requestAnimationFrame(updateCounter);
    }, 500);
}

/**
 * Update statistics (can be called from server)
 */
function updateStats(deals, clients) {
    aboutState.stats.deals = deals;
    aboutState.stats.clients = clients;

    const statDeals = document.getElementById('statDeals');
    const statClients = document.getElementById('statClients');

    if (statDeals) {
        statDeals.textContent = formatStatNumber(deals);
    }

    if (statClients) {
        statClients.textContent = formatStatNumber(clients);
    }
}

/**
 * Format stat number to K+ format
 */
function formatStatNumber(num) {
    if (num >= 1000) {
        return Math.round(num / 1000) + 'K+';
    }
    return num + '+';
}

// Export functions for global use
window.initAboutPage = initAboutPage;
window.updateStats = updateStats;
window.aboutState = aboutState;
