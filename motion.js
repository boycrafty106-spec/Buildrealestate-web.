/**
 * Team Sarvsiddhi Real Estate Services Pvt. Ltd.
 * Mobile-first motion and interaction layer (motion.js)
 * Hero motion is CSS only. Animate only transform and opacity. No scroll listeners
 * except the word-by-word text scrub, which runs only while that text is on screen.
 */

(function () {
  'use strict';

  // Check reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------------------------------------------------------------------------
  // 1. Glass Navbar: Hairline Border & Height Shrink via IntersectionObserver
  // Toggle .is-scrolled when user scrolls past 24px using #nav-sentinel
  // Zero scroll listeners needed!
  // ---------------------------------------------------------------------------
  function initGlassNavbar() {
    const navSentinel = document.getElementById('nav-sentinel');
    const siteHeader = document.getElementById('header');

    if (!navSentinel || !siteHeader || !('IntersectionObserver' in window)) return;

    const navObserver = new IntersectionObserver(
      function (entries) {
        const entry = entries[0];
        // When sentinel is above the viewport (top <= 0 and not intersecting), header is scrolled
        if (!entry.isIntersecting) {
          siteHeader.classList.add('is-scrolled');
        } else {
          siteHeader.classList.remove('is-scrolled');
        }
      },
      {
        root: null,
        threshold: 0
      }
    );

    navObserver.observe(navSentinel);
  }

  // ---------------------------------------------------------------------------
  // 2. Scroll reveals (.reveal, .reveal-item, optional data-reveal direction)
  // - Each element is observed on its own and revealed once.
  // - Speed aware: when the visitor scrolls quickly the animation is short
  //   (.is-fast) so content is clear at once; at a calm pace it plays fully.
  // - Content already scrolled past (link jump, fling) is shown instantly.
  // - Only items entering together are staggered (max 3 steps of 70ms).
  // - No scroll listener: speed is sampled inside the observer callback.
  // ---------------------------------------------------------------------------
  function initEntryReveals() {
    const targets = Array.prototype.slice.call(document.querySelectorAll('.reveal, .reveal-item'));
    if (!targets.length) return;

    const root = document.documentElement;

    function show(el, instant) {
      if (instant) el.classList.add('is-instant');
      el.classList.add('is-revealed');
    }

    // Reduced motion, a late-starting script, or no IntersectionObserver: show everything
    if (prefersReducedMotion || root.classList.contains('js-timeout') || !('IntersectionObserver' in window)) {
      targets.forEach(function (el) { show(el, true); });
      return;
    }

    const FAST_SCROLL_PX_PER_MS = 1.1;
    const STAGGER_MS = 70;
    const MAX_STAGGER_STEPS = 3;

    let lastY = window.pageYOffset;
    let lastTime = performance.now();
    let pending = targets.slice();

    function clearDelayWhenDone(el) {
      function done(event) {
        if (event.target !== el || event.propertyName !== 'transform') return;
        el.style.transitionDelay = '';
        el.removeEventListener('transitionend', done);
      }
      el.addEventListener('transitionend', done);
    }

    const revealObserver = new IntersectionObserver(
      function (entries) {
        const now = performance.now();
        const y = window.pageYOffset;
        const speed = Math.abs(y - lastY) / Math.max(1, now - lastTime);
        lastY = y;
        lastTime = now;
        const isFast = speed > FAST_SCROLL_PX_PER_MS;

        let step = 0;
        entries.forEach(function (entry) {
          const el = entry.target;
          if (entry.isIntersecting) {
            if (isFast) {
              el.classList.add('is-fast');
            } else {
              el.style.transitionDelay = (Math.min(step, MAX_STAGGER_STEPS) * STAGGER_MS) + 'ms';
              clearDelayWhenDone(el);
            }
            step += 1;
            show(el, false);
            revealObserver.unobserve(el);
          } else if (entry.boundingClientRect.top < 0) {
            // Scrolled past before it was ever seen
            show(el, true);
            revealObserver.unobserve(el);
          }
        });

        // A fast jump can skip an element without the observer reporting it:
        // anything now fully above the viewport is shown without animation
        pending = pending.filter(function (el) {
          if (el.classList.contains('is-revealed')) return false;
          if (el.getBoundingClientRect().bottom < 0) {
            show(el, true);
            revealObserver.unobserve(el);
            return false;
          }
          return true;
        });
      },
      { root: null, rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
    );

    targets.forEach(function (el) { revealObserver.observe(el); });
  }

  // ---------------------------------------------------------------------------
  // Section background images (data-src)
  // Loaded after the page has finished loading, and only once the section is within
  // 400px of the viewport, so they never compete with the hero image. Faded in.
  // Purely decorative.
  // ---------------------------------------------------------------------------
  function initSectionBackgrounds() {
    const images = Array.prototype.slice.call(document.querySelectorAll('.section-bg-img[data-src]'));
    if (!images.length) return;

    function load(img) {
      img.addEventListener('load', function () { img.classList.add('is-loaded'); }, { once: true });
      img.src = img.getAttribute('data-src');
      img.removeAttribute('data-src');
    }

    if (!('IntersectionObserver' in window)) {
      images.forEach(load);
      return;
    }

    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          load(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '400px 0px' });

    // Start only after the page (hero image included) has finished loading
    function start() { images.forEach(function (img) { observer.observe(img); }); }
    if (document.readyState === 'complete') {
      start();
    } else {
      window.addEventListener('load', start, { once: true });
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Hero building image state
  // The building fades in once it has loaded. If it fails, or has not loaded
  // after 4s, the hero switches to the full-photo fallback so it never looks
  // broken. If the cut-out arrives late, the fallback is removed again.
  // ---------------------------------------------------------------------------
  function initHeroImage() {
    const hero = document.getElementById('home');
    const picture = document.getElementById('heroBuilding');
    const img = picture ? picture.querySelector('img') : null;
    if (!hero || !picture || !img) return;

    function reveal() {
      picture.classList.remove('is-loading');
    }

    function loaded() {
      hero.classList.remove('hero--fallback');
      reveal();
    }

    function failed() {
      hero.classList.add('hero--fallback');
      reveal();
    }

    function isLoaded() {
      return img.complete && img.naturalWidth > 0;
    }

    // Already finished before this script ran: a loaded image needs nothing,
    // a broken one (complete but zero width) goes straight to the fallback
    if (isLoaded()) return;
    if (img.complete && img.naturalWidth === 0) {
      failed();
      img.addEventListener('load', loaded);
      return;
    }

    picture.classList.add('is-loading');
    img.addEventListener('load', loaded);
    img.addEventListener('error', failed);

    // Never leave the scene empty on a slow connection
    window.setTimeout(function () { if (!isLoaded()) reveal(); }, 2500);
    window.setTimeout(function () { if (!isLoaded()) failed(); }, 4000);
  }

  // ---------------------------------------------------------------------------
  // 4. Inquiry card
  // Builds the WhatsApp link from the selected options. The WhatsApp number comes
  // from the single BUSINESS_CONFIG defined in main.js. The rental budget band is
  // shown only for rentals; purchase bands are shown otherwise.
  // ---------------------------------------------------------------------------
  function initInquiryConsole() {
    const form = document.getElementById('heroInquiryForm');
    const localitySelect = document.getElementById('inquiryLocality');
    const typeSelect = document.getElementById('inquiryType');
    const budgetSelect = document.getElementById('inquiryBudget');
    const whatsappBtn = document.getElementById('inquiryWhatsAppBtn');

    if (!form || !whatsappBtn || !localitySelect || !typeSelect || !budgetSelect) return;

    const config = window.BUSINESS_CONFIG || {};
    const rentalType = 'Rental Flat / Home';

    // Keep every budget option so the list can be rebuilt (iOS Safari ignores hidden <option>)
    const allBudgetOptions = Array.prototype.slice.call(budgetSelect.options).map(function (option) {
      return option.cloneNode(true);
    });

    function syncBudgetOptions() {
      const group = typeSelect.value === rentalType ? 'rent' : 'buy';
      const previous = budgetSelect.value;
      const wanted = allBudgetOptions.filter(function (option) {
        return option.getAttribute('data-budget-group') === group;
      });
      if (!wanted.length) return;

      budgetSelect.innerHTML = '';
      wanted.forEach(function (option) {
        budgetSelect.appendChild(option.cloneNode(true));
      });

      const stillValid = wanted.some(function (option) { return option.value === previous; });
      if (stillValid) {
        budgetSelect.value = previous;
      } else {
        const preset = wanted.filter(function (option) { return option.hasAttribute('selected'); })[0] || wanted[0];
        budgetSelect.value = preset.value;
      }
    }

    function updateWhatsAppLink() {
      if (!config.primaryWhatsAppNumber) return;
      const message = 'Hello Team Sarvsiddhi, I am interested in a property in ' + localitySelect.value +
        '. Property type: ' + typeSelect.value +
        '. My budget is ' + budgetSelect.value +
        '. Please share suitable options.';
      whatsappBtn.href = 'https://wa.me/' + config.primaryWhatsAppNumber + '?text=' + encodeURIComponent(message);
    }

    typeSelect.addEventListener('change', function () {
      syncBudgetOptions();
      updateWhatsAppLink();
    });
    localitySelect.addEventListener('change', updateWhatsAppLink);
    budgetSelect.addEventListener('change', updateWhatsAppLink);
    form.addEventListener('submit', function (event) { event.preventDefault(); });

    syncBudgetOptions();
    updateWhatsAppLink();
  }

  // ---------------------------------------------------------------------------
  // 6. Scroll-Scrubbed Text Reveal (Preserving Semantic HTML tags)
  // Recursively traverses text nodes without stripping <strong>, <em>, etc.
  // Screen-reader accessible: full text kept in aria-label, spans aria-hidden
  // ---------------------------------------------------------------------------
  function initScrollScrubText() {
    const scrubContainers = document.querySelectorAll('[data-scrub-text]');
    if (!scrubContainers.length || prefersReducedMotion) return;

    function wrapTextNodesInWords(node) {
      if (node.nodeType === 3) { // TEXT_NODE
        const text = node.nodeValue;
        if (!text || !text.trim()) return;
        const fragment = document.createDocumentFragment();
        const parts = text.split(/(\s+)/);
        parts.forEach(function (part) {
          if (/^\s+$/.test(part)) {
            fragment.appendChild(document.createTextNode(part));
          } else if (part.length > 0) {
            const span = document.createElement('span');
            span.className = 'scrub-word';
            span.setAttribute('aria-hidden', 'true');
            span.textContent = part;
            fragment.appendChild(span);
          }
        });
        node.parentNode.replaceChild(fragment, node);
      } else if (node.nodeType === 1) { // ELEMENT_NODE
        if (node.classList.contains('scrub-word')) return;
        Array.from(node.childNodes).forEach(wrapTextNodesInWords);
      }
    }

    scrubContainers.forEach(function (container) {
      // Preserve full sentence in aria-label if not already set
      if (!container.getAttribute('aria-label')) {
        container.setAttribute('aria-label', container.textContent.trim());
      }

      // Wrap text nodes while preserving existing markup (strong, em, etc.)
      wrapTextNodesInWords(container);

      const wordSpans = container.querySelectorAll('.scrub-word');
      const totalWords = wordSpans.length;

      let isObserving = false;
      let ticking = false;

      function updateScrubProgress() {
        const rect = container.getBoundingClientRect();
        const windowH = window.innerHeight;
        // Scrub starts when element is 85% down viewport, finishes when it reaches 30%
        const start = windowH * 0.85;
        const end = windowH * 0.30;
        const progress = Math.max(0, Math.min(1, (start - rect.top) / (start - end)));
        const activeCount = Math.floor(progress * totalWords);

        wordSpans.forEach(function (span, i) {
          if (i <= activeCount) {
            span.classList.add('is-illuminated');
          } else {
            span.classList.remove('is-illuminated');
          }
        });

        ticking = false;
      }

      function onScrubScroll() {
        if (!ticking) {
          window.requestAnimationFrame(updateScrubProgress);
          ticking = true;
        }
      }

      if ('IntersectionObserver' in window) {
        const scrubObserver = new IntersectionObserver(
          function (entries) {
            const entry = entries[0];
            if (entry.isIntersecting && !isObserving) {
              window.addEventListener('scroll', onScrubScroll, { passive: true });
              isObserving = true;
              updateScrubProgress();
            } else if (!entry.isIntersecting && isObserving) {
              window.removeEventListener('scroll', onScrubScroll);
              isObserving = false;
            }
          },
          { root: null, rootMargin: '100px 0px 100px 0px', threshold: 0 }
        );
        scrubObserver.observe(container);
      } else {
        window.addEventListener('scroll', onScrubScroll, { passive: true });
        updateScrubProgress();
      }
    });
  }

  // ---------------------------------------------------------------------------
  // 5. Horizontal Snap Carousel for Listings
  // Centered card scales to 1.0, neighbors to 0.92 and 0.6 opacity via IntersectionObserver
  // Absolutely ZERO scroll listeners!
  // ---------------------------------------------------------------------------
  function initSnapCarousel() {
    const carousel = document.getElementById('servicesBentoGrid');
    const cards = Array.prototype.slice.call(document.querySelectorAll('#servicesBentoGrid .bento-card'));
    const dots = Array.prototype.slice.call(document.querySelectorAll('#servicesCarouselDots .carousel-dot'));

    if (!carousel || !cards.length) return;

    function setActive(index) {
      cards.forEach(function (card, i) {
        card.classList.toggle('is-active-card', i === index);
      });
      dots.forEach(function (dot, i) {
        const isActive = i === index;
        dot.classList.toggle('is-active', isActive);
        if (isActive) {
          dot.setAttribute('aria-current', 'true');
        } else {
          dot.removeAttribute('aria-current');
        }
      });
    }

    // Scroll the track itself (never the page) so the card sits at the start edge
    function scrollToCard(index) {
      const card = cards[index];
      if (!card) return;
      const trackRect = carousel.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const padLeft = parseFloat(window.getComputedStyle(carousel).paddingLeft) || 0;
      const left = carousel.scrollLeft + (cardRect.left - trackRect.left) - padLeft;
      carousel.scrollTo({ left: Math.max(0, left), behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    }

    function currentIndex() {
      const activeIndex = cards.findIndex(function (card) { return card.classList.contains('is-active-card'); });
      return activeIndex < 0 ? 0 : activeIndex;
    }

    setActive(0);

    if ('IntersectionObserver' in window) {
      const cardObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              setActive(cards.indexOf(entry.target));
            }
          });
        },
        { root: carousel, threshold: 0.6 }
      );
      cards.forEach(function (card) { cardObserver.observe(card); });
    }

    dots.forEach(function (dot) {
      dot.addEventListener('click', function () {
        scrollToCard(parseInt(dot.getAttribute('data-slide-index'), 10));
      });
    });

    // Lets nav links (#buy, #sell, #rent) bring their card into view horizontally
    carousel.addEventListener('carousel:goto', function (event) {
      const index = cards.indexOf(event.detail && event.detail.card);
      if (index >= 0) scrollToCard(index);
    });

    // The track is a focusable region only while it scrolls (phones and small tablets)
    const phoneLayout = window.matchMedia('(max-width: 899px)');
    function syncFocusable() {
      if (phoneLayout.matches) {
        carousel.setAttribute('tabindex', '0');
        carousel.setAttribute('role', 'region');
        carousel.setAttribute('aria-label', 'Property services. Swipe or use the arrow keys.');
      } else {
        carousel.removeAttribute('tabindex');
        carousel.removeAttribute('role');
        carousel.removeAttribute('aria-label');
      }
    }
    syncFocusable();
    if (phoneLayout.addEventListener) {
      phoneLayout.addEventListener('change', syncFocusable);
    } else if (phoneLayout.addListener) {
      phoneLayout.addListener(syncFocusable);
    }

    carousel.addEventListener('keydown', function (event) {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      const step = event.key === 'ArrowRight' ? 1 : -1;
      const target = Math.max(0, Math.min(cards.length - 1, currentIndex() + step));
      scrollToCard(target);
      event.preventDefault();
    });
  }

  // ---------------------------------------------------------------------------
  // 6. Number Count-Up Stats
  // Counts from 0 to value when 40% visible over ~1.6s with ease-out cubic curve
  // Triggered once only via IntersectionObserver
  // ---------------------------------------------------------------------------
  function initCountUpStats() {
    const statElements = document.querySelectorAll('[data-stat-target]');
    if (!statElements.length) return;

    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      // In reduced motion or legacy browsers, maintain final values immediately
      return;
    }

    // Set initial display to 0 formatted with decimals and suffix
    statElements.forEach(function (el) {
      const suffix = el.getAttribute('data-stat-suffix') || '';
      const decimals = parseInt(el.getAttribute('data-stat-decimals') || '0', 10);
      el.textContent = (0).toFixed(decimals) + suffix;
    });

    const statsObserver = new IntersectionObserver(
      function (entries, observer) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            const el = entry.target;
            observer.unobserve(el); // Trigger ONCE only!

            const targetVal = parseFloat(el.getAttribute('data-stat-target'));
            const suffix = el.getAttribute('data-stat-suffix') || '';
            const decimals = parseInt(el.getAttribute('data-stat-decimals') || '0', 10);
            const duration = 1600; // 1.6s
            const startTime = performance.now();

            // Cubic ease-out curve: 1 - (1 - t)^3
            function easeOutCubic(t) {
              return 1 - Math.pow(1 - t, 3);
            }

            function animateStat(now) {
              const elapsed = now - startTime;
              const t = Math.min(1, elapsed / duration);
              const current = targetVal * easeOutCubic(t);

              el.textContent = current.toFixed(decimals) + suffix;

              if (t < 1) {
                window.requestAnimationFrame(animateStat);
              } else {
                el.textContent = targetVal.toFixed(decimals) + suffix;
              }
            }

            window.requestAnimationFrame(animateStat);
          }
        });
      },
      {
        root: null,
        threshold: 0.4 // Trigger when 40% visible
      }
    );

    statElements.forEach(function (el) {
      statsObserver.observe(el);
    });
  }

  // ---------------------------------------------------------------------------
  // System Initialization
  // ---------------------------------------------------------------------------
  function initMotionSystem() {
    window.__sarvMotionReady = true;
    initGlassNavbar();
    initEntryReveals();
    initHeroImage();
    initSectionBackgrounds();
    initInquiryConsole();
    initScrollScrubText();
    initSnapCarousel();
    initCountUpStats();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMotionSystem);
  } else {
    initMotionSystem();
  }

})();
