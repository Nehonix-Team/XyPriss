/**
 * XyPriss Documentation Interactive Features
 * Handles navigation, animations, and interactive elements
 */

// DOM Content Loaded - see bottom of file for main initialization

// Navigation functionality
function initializeNavigation() {
    const navbar = document.getElementById("navbar");
    const navToggle = document.getElementById("nav-toggle");
    const navMenu = document.getElementById("nav-menu");
    const navLinks = document.querySelectorAll(".nav-link");

    // Mobile menu toggle
    navToggle.addEventListener("click", function () {
        navToggle.classList.toggle("active");
        navMenu.classList.toggle("active");
    });

    // Close mobile menu when clicking on a link
    navLinks.forEach((link) => {
        link.addEventListener("click", function () {
            navToggle.classList.remove("active");
            navMenu.classList.remove("active");
        });
    });

    // Navbar scroll effect
    let lastScrollTop = 0;
    window.addEventListener("scroll", function () {
        const scrollTop =
            window.pageYOffset || document.documentElement.scrollTop;

        if (scrollTop > 100) {
            navbar.classList.add("scrolled");
        } else {
            navbar.classList.remove("scrolled");
        }

        // Hide/show navbar on scroll
        if (scrollTop > lastScrollTop && scrollTop > 200) {
            navbar.style.transform = "translateY(-100%)";
        } else {
            navbar.style.transform = "translateY(0)";
        }
        lastScrollTop = scrollTop;
    });

    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
        anchor.addEventListener("click", function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute("href"));
            if (target) {
                const offsetTop = target.offsetTop - 80; // Account for fixed navbar
                window.scrollTo({
                    top: offsetTop,
                    behavior: "smooth",
                });
            }
        });
    });
}

// Scroll effects and animations
function initializeScrollEffects() {
    // Initialize AOS (Animate On Scroll) if available
    if (typeof AOS !== "undefined") {
        AOS.init({
            duration: 800,
            easing: "ease-out-cubic",
            once: true,
            offset: 100,
        });
    }

    // Custom scroll animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px",
    };

    const observer = new IntersectionObserver(function (entries) {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add("animate-in");
            }
        });
    }, observerOptions);

    // Observe elements for animation
    document
        .querySelectorAll(".feature-card, .section-header, .hero-content")
        .forEach((el) => {
            observer.observe(el);
        });

    // Parallax effect for hero background
    window.addEventListener("scroll", function () {
        const scrolled = window.pageYOffset;
        const parallaxElements = document.querySelectorAll(".hero-particles");

        parallaxElements.forEach((element) => {
            const speed = 0.5;
            element.style.transform = `translateY(${scrolled * speed}px)`;
        });
    });
}

// Tab functionality
function initializeTabs() {
    // Installation tabs
    const installTabs = document.querySelectorAll(".tab-btn");
    const installPanels = document.querySelectorAll(".install-panel");

    installTabs.forEach((tab) => {
        tab.addEventListener("click", function () {
            const targetPanel = this.dataset.tab + "-panel";

            // Remove active class from all tabs and panels
            installTabs.forEach((t) => t.classList.remove("active"));
            installPanels.forEach((p) => p.classList.remove("active"));

            // Add active class to clicked tab and corresponding panel
            this.classList.add("active");
            document.getElementById(targetPanel).classList.add("active");
        });
    });

    // Example tabs
    const exampleTabs = document.querySelectorAll(".example-tab");
    const examplePanels = document.querySelectorAll(".example-panel");

    exampleTabs.forEach((tab) => {
        tab.addEventListener("click", function () {
            const targetPanel = this.dataset.example + "-example";

            // Remove active class from all tabs and panels
            exampleTabs.forEach((t) => t.classList.remove("active"));
            examplePanels.forEach((p) => p.classList.remove("active"));

            // Add active class to clicked tab and corresponding panel
            this.classList.add("active");
            document.getElementById(targetPanel).classList.add("active");
        });
    });
}

// Animation utilities
function initializeAnimations() {
    // Add CSS classes for animations
    const style = document.createElement("style");
    style.textContent = `
        .animate-in {
            animation: fadeInUp 0.8s ease-out forwards;
        }
        
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .feature-card {
            opacity: 0;
            transform: translateY(30px);
            transition: all 0.8s ease-out;
        }
        
        .feature-card.animate-in {
            opacity: 1;
            transform: translateY(0);
        }
    `;
    document.head.appendChild(style);

    // Stagger animation for feature cards
    const featureCards = document.querySelectorAll(".feature-card");
    featureCards.forEach((card, index) => {
        card.style.animationDelay = `${index * 0.1}s`;
    });

    // Button hover effects
    document.querySelectorAll(".btn").forEach((btn) => {
        btn.addEventListener("mouseenter", function () {
            this.style.transform = "translateY(-2px) scale(1.02)";
        });

        btn.addEventListener("mouseleave", function () {
            this.style.transform = "translateY(0) scale(1)";
        });
    });
}

// Code highlighting and copy functionality
function initializeCodeHighlighting() {
    // Add copy buttons to code blocks
    document.querySelectorAll("pre").forEach((pre) => {
        const copyButton = document.createElement("button");
        copyButton.className = "copy-btn";
        copyButton.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            Copy
        `;

        copyButton.addEventListener("click", function () {
            const code = pre.querySelector("code");
            const text = code.textContent;

            navigator.clipboard.writeText(text).then(() => {
                copyButton.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20,6 9,17 4,12"></polyline>
                    </svg>
                    Copied!
                `;
                copyButton.classList.add("copied");

                setTimeout(() => {
                    copyButton.innerHTML = `
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        Copy
                    `;
                    copyButton.classList.remove("copied");
                }, 2000);
            });
        });

        pre.style.position = "relative";
        pre.appendChild(copyButton);
    });

    // Add copy button styles
    const copyStyles = document.createElement("style");
    copyStyles.textContent = `
        .copy-btn {
            position: absolute;
            top: 12px;
            right: 12px;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: var(--text-secondary);
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 12px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 4px;
            transition: all 0.2s ease;
            backdrop-filter: blur(10px);
        }
        
        .copy-btn:hover {
            background: rgba(255, 255, 255, 0.2);
            color: var(--text-primary);
            transform: translateY(-1px);
        }
        
        .copy-btn.copied {
            background: rgba(16, 185, 129, 0.2);
            color: #34d399;
            border-color: rgba(16, 185, 129, 0.3);
        }
    `;
    document.head.appendChild(copyStyles);
}

// Particle effects
function initializeParticleEffects() {
    const heroParticles = document.querySelector(".hero-particles");
    if (!heroParticles) return;

    // Create floating particles
    for (let i = 0; i < 50; i++) {
        const particle = document.createElement("div");
        particle.className = "floating-particle";
        particle.style.cssText = `
            position: absolute;
            width: ${Math.random() * 4 + 1}px;
            height: ${Math.random() * 4 + 1}px;
            background: rgba(99, 102, 241, ${Math.random() * 0.5 + 0.1});
            border-radius: 50%;
            left: ${Math.random() * 100}%;
            top: ${Math.random() * 100}%;
            animation: float ${Math.random() * 10 + 10}s linear infinite;
            animation-delay: ${Math.random() * 10}s;
        `;
        heroParticles.appendChild(particle);
    }

    // Add floating animation
    const floatStyles = document.createElement("style");
    floatStyles.textContent = `
        @keyframes float {
            0% {
                transform: translateY(100vh) rotate(0deg);
                opacity: 0;
            }
            10% {
                opacity: 1;
            }
            90% {
                opacity: 1;
            }
            100% {
                transform: translateY(-100px) rotate(360deg);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(floatStyles);
}

// Typing effect for hero title
function initializeTypingEffect() {
    const titleElement = document.querySelector(".title-main");
    if (!titleElement) return;

    const originalText = titleElement.textContent;
    titleElement.textContent = "";

    let i = 0;
    const typeWriter = () => {
        if (i < originalText.length) {
            titleElement.textContent += originalText.charAt(i);
            i++;
            setTimeout(typeWriter, 100);
        } else {
            // Add blinking cursor
            const cursor = document.createElement("span");
            cursor.textContent = "|";
            cursor.style.animation = "blink 1s infinite";
            titleElement.appendChild(cursor);

            // Remove cursor after 3 seconds
            setTimeout(() => {
                cursor.remove();
            }, 3000);
        }
    };

    // Start typing effect after a delay
    setTimeout(typeWriter, 1000);

    // Add blink animation
    const blinkStyles = document.createElement("style");
    blinkStyles.textContent = `
        @keyframes blink {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0; }
        }
    `;
    document.head.appendChild(blinkStyles);
}

// Utility functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function throttle(func, limit) {
    let inThrottle;
    return function () {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
}

// Performance optimizations
const optimizedScrollHandler = throttle(function () {
    // Handle scroll events efficiently
}, 16); // ~60fps

window.addEventListener("scroll", optimizedScrollHandler);

// Error handling
window.addEventListener("error", function (e) {
    console.warn("XyPriss Docs: Non-critical error occurred:", e.error);
});

// Additional interactive features
function initializeInteractiveFeatures() {
    // Add loading animation to buttons
    document.querySelectorAll(".btn").forEach((btn) => {
        btn.addEventListener("click", function (e) {
            if (this.href && this.href.startsWith("#")) {
                return; // Let anchor links work normally
            }

            const originalText = this.innerHTML;
            this.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="animate-spin">
                    <path d="M21 12a9 9 0 11-6.219-8.56"/>
                </svg>
                Loading...
            `;
            this.style.pointerEvents = "none";

            setTimeout(() => {
                this.innerHTML = originalText;
                this.style.pointerEvents = "auto";
            }, 1500);
        });
    });

    // Add hover effects to cards
    document.querySelectorAll(".feature-card, .doc-card").forEach((card) => {
        card.addEventListener("mouseenter", function () {
            this.style.transform = "translateY(-8px) scale(1.02)";
        });

        card.addEventListener("mouseleave", function () {
            this.style.transform = "translateY(0) scale(1)";
        });
    });

    // Add ripple effect to buttons
    document.querySelectorAll(".btn, .tab-btn, .example-tab").forEach((btn) => {
        btn.addEventListener("click", function (e) {
            const ripple = document.createElement("span");
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;

            ripple.style.cssText = `
                position: absolute;
                width: ${size}px;
                height: ${size}px;
                left: ${x}px;
                top: ${y}px;
                background: rgba(255, 255, 255, 0.3);
                border-radius: 50%;
                transform: scale(0);
                animation: ripple 0.6s ease-out;
                pointer-events: none;
            `;

            this.style.position = "relative";
            this.style.overflow = "hidden";
            this.appendChild(ripple);

            setTimeout(() => ripple.remove(), 600);
        });
    });

    // Add ripple animation
    const rippleStyles = document.createElement("style");
    rippleStyles.textContent = `
        @keyframes ripple {
            to {
                transform: scale(2);
                opacity: 0;
            }
        }

        .animate-spin {
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(rippleStyles);
}

// Initialize all features when DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
    initializeNavigation();
    initializeScrollEffects();
    initializeTabs();
    initializeAnimations();
    initializeCodeHighlighting();
    initializeParticleEffects();
    initializeTypingEffect();
    initializeInteractiveFeatures();
});

// Export functions for potential external use
window.XyPrissDocsAPI = {
    initializeNavigation,
    initializeScrollEffects,
    initializeTabs,
    initializeAnimations,
    initializeCodeHighlighting,
    initializeInteractiveFeatures,
};

