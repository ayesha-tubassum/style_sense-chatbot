/* ==========================================================================
   StyleSense AI — Site interactions
   --------------------------------------------------------------------------
   Handles everything that is not the chatbot:
     • Sticky header state + scroll progress bar
     • Mobile navigation drawer
     • Dark / light theme toggle (persisted)
     • Outfit gallery rendering + filtering + "ask the stylist" handoff
     • Scroll-reveal animations, active nav link, toast helper
   ========================================================================== */

(function () {
  "use strict";

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));

  /* ======================================================================
     GALLERY DATA
     A curated mood board across the styles StyleSense covers. Each card can
     hand a tailored prompt to the chatbot when clicked.
  ====================================================================== */
  const LOOKS = [
    {
      tag: "Campus",
      filter: "campus",
      title: "Autumn Campus Chic",
      desc: "Oversized cream knit, straight-leg denim, white sneakers and gold hoops.",
      img: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=80",
      ask: "Build me an autumn campus outfit with a cream knit and straight-leg jeans."
    },
    {
      tag: "Casual",
      filter: "casual",
      title: "Weekend Neutrals",
      desc: "Oatmeal overshirt, ecru tee, wide-leg trousers and clean trainers.",
      img: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=800&q=80",
      ask: "Suggest a relaxed weekend outfit in neutral tones for mild weather."
    },
    {
      tag: "Formal",
      filter: "formal",
      title: "Evening in Sapphire",
      desc: "Midnight satin column dress with silver accents and a structured clutch.",
      img: "https://images.unsplash.com/photo-1539008835657-9e8e9680c956?auto=format&fit=crop&w=800&q=80",
      ask: "Style me for a formal evening event in deep sapphire tones."
    },
    {
      tag: "Wedding",
      filter: "wedding",
      title: "Garden Wedding Guest",
      desc: "Sage midi dress, block heels and a matching pashmina for an outdoor ceremony.",
      img: "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=800&q=80",
      ask: "What should I wear as a guest to a summer garden wedding?"
    },
    {
      tag: "Modest",
      filter: "modest",
      title: "Layered Elegance",
      desc: "Tonal cream layers with a fluid chiffon hijab and pointed nude flats.",
      img: "https://images.unsplash.com/photo-1581044777550-4cfa60707c03?auto=format&fit=crop&w=800&q=80",
      ask: "Create a modest, elegant tonal cream outfit for a formal dinner."
    },
    {
      tag: "Streetwear",
      filter: "casual",
      title: "Concrete Proportions",
      desc: "Boxy hoodie, wide-leg cargos, chunky runners and one bold chain.",
      img: "https://images.unsplash.com/photo-1523398002811-999ca8dec234?auto=format&fit=crop&w=800&q=80",
      ask: "Give me a streetwear look with an oversized hoodie and cargo pants."
    },
    {
      tag: "Interview",
      filter: "formal",
      title: "First Impression",
      desc: "Navy blazer, crisp white shirt, tapered trousers and polished leather.",
      img: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80",
      ask: "Style me for a job interview at a conservative corporate office."
    },
    {
      tag: "Street Style",
      filter: "casual",
      title: "Signature Layers",
      desc: "Longline trench over denim and knit, finished with leather loafers.",
      img: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=800&q=80",
      ask: "Build a smart-casual street style outfit around a longline trench coat."
    },
    {
      tag: "Culture",
      filter: "modest",
      title: "Festive Traditional",
      desc: "Embroidered jewel-tone set styled with gold jewellery and a matching dupatta.",
      img: "https://images.unsplash.com/photo-1758985402638-6028bae83b98?auto=format&fit=crop&w=800&q=80",
      ask: "Help me style a traditional festive outfit in jewel tones for a ceremony."
    }
  ];

  /* ======================================================================
     1. HEADER, SCROLL PROGRESS, FLOATING CTA
  ====================================================================== */
  function initHeader() {
    const header = $("#siteHeader");
    const progress = $("#scrollProgress");
    const fab = $("#fab");
    const chatSection = $("#chat");

    if (!header) return;

    let ticking = false;

    const update = () => {
      const y = window.scrollY || window.pageYOffset || 0;
      const doc = document.documentElement;
      const max = (doc.scrollHeight - window.innerHeight) || 1;

      header.classList.toggle("is-scrolled", y > 24);

      if (progress) {
        progress.style.width = Math.min(100, Math.max(0, (y / max) * 100)) + "%";
      }

      if (fab) {
        // Show the floating chat launcher once the user has scrolled past
        // the hero, and hide it while the chat section itself is on screen.
        let chatVisible = false;
        if (chatSection) {
          const r = chatSection.getBoundingClientRect();
          chatVisible = r.top < window.innerHeight * 0.6 && r.bottom > window.innerHeight * 0.35;
        }
        fab.classList.toggle("is-visible", y > 420 && !chatVisible);
      }

      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    update();
  }

  /* ======================================================================
     2. MOBILE NAVIGATION
  ====================================================================== */
  function initNav() {
    const toggle = $("#hamburger");
    const nav = $("#primaryNav");
    const backdrop = $("#navBackdrop");
    if (!toggle || !nav) return;

    const open = () => {
      nav.classList.add("is-open");
      if (backdrop) backdrop.classList.add("is-visible");
      document.body.classList.add("nav-open");
      toggle.setAttribute("aria-expanded", "true");
      toggle.setAttribute("aria-label", "Close menu");
    };

    const close = () => {
      nav.classList.remove("is-open");
      if (backdrop) backdrop.classList.remove("is-visible");
      document.body.classList.remove("nav-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open menu");
    };

    const toggleNav = () => {
      if (nav.classList.contains("is-open")) close(); else open();
    };

    toggle.addEventListener("click", toggleNav);
    if (backdrop) backdrop.addEventListener("click", close);

    // Close when a nav link is chosen
    $$(".nav-link", nav).forEach((link) => link.addEventListener("click", close));

    // Close on Escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && nav.classList.contains("is-open")) close();
    });

    // Reset state if the viewport grows back to desktop
    window.addEventListener("resize", () => {
      if (window.innerWidth > 900 && nav.classList.contains("is-open")) close();
    });

    // Expose for other modules
    window.__styleSenseCloseNav = close;
  }

  /* ======================================================================
     3. THEME TOGGLE
  ====================================================================== */
  function initTheme() {
    const root = document.documentElement;
    const btn = $("#themeToggle");
    const STORE = "stylesense.theme";

    const apply = (theme) => {
      root.setAttribute("data-theme", theme);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", theme === "dark" ? "#0f0e0d" : "#fbf9f7");
    };

    // Priority: saved choice -> system preference -> light
    let saved = null;
    try { saved = localStorage.getItem(STORE); } catch (e) { saved = null; }

    if (saved === "dark" || saved === "light") {
      apply(saved);
    } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      apply("dark");
    }

    if (!btn) return;

    btn.addEventListener("click", () => {
      const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      apply(next);
      try { localStorage.setItem(STORE, next); } catch (e) { /* ignore */ }
      showToast(next === "dark" ? "Dark mode on" : "Light mode on");
    });
  }

  /* ======================================================================
     4. TOAST
  ====================================================================== */
  let toastTimer = null;
  function showToast(message) {
    const el = $("#toast");
    if (!el || !message) return;
    el.textContent = message;
    el.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-visible"), 2600);
  }
  window.__styleSenseToast = showToast;

  /* ======================================================================
     5. GALLERY
  ====================================================================== */
  function initGallery() {
    const grid = $("#galleryGrid");
    if (!grid) return;

    grid.innerHTML = LOOKS.map((look, i) => {
      return '' +
        '<article class="look-card" data-filter="' + look.filter + '" tabindex="0" role="button" ' +
          'aria-label="Ask StyleSense about ' + look.title + '" style="--d:' + (i % 3) * 90 + 'ms">' +
          '<div class="look-media">' +
            '<img src="' + look.img + '" alt="' + look.title + ' — ' + look.desc + '" loading="lazy" ' +
              'onerror="this.style.display=\'none\'">' +
          '</div>' +
          '<div class="look-body">' +
            '<span class="look-tag">' + look.tag + '</span>' +
            '<h3>' + look.title + '</h3>' +
            '<p>' + look.desc + '</p>' +
            '<span class="look-ask">' +
              '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-9 8.35 8.5 8.5 0 0 1-3.4-.7L3 21l1.85-5.6A8.5 8.5 0 0 1 12 3.15a8.38 8.38 0 0 1 9 8.35Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>' +
              'Ask the stylist' +
            '</span>' +
          '</div>' +
        '</article>';
    }).join("");

    // Clicking a look seeds the chatbot with a tailored prompt
    const handoff = (card) => {
      const idx = $$(".look-card", grid).indexOf(card);
      const look = LOOKS[idx];
      if (!look) return;

      const chat = $("#chat");
      if (chat) chat.scrollIntoView({ behavior: "smooth", block: "start" });

      // Give the smooth scroll a moment, then hand off to the chatbot
      setTimeout(() => {
        document.dispatchEvent(new CustomEvent("stylesense:ask", {
          detail: { question: look.ask }
        }));
        showToast("Asking StyleSense about \u201C" + look.title + "\u201D");
      }, 620);
    };

    grid.addEventListener("click", (e) => {
      const card = e.target.closest(".look-card");
      if (card) handoff(card);
    });

    grid.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const card = e.target.closest(".look-card");
      if (card) { e.preventDefault(); handoff(card); }
    });

    // Filters
    const chips = $$(".gallery-filters .chip");
    chips.forEach((chip) => {
      chip.addEventListener("click", () => {
        chips.forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        const filter = chip.getAttribute("data-filter") || "all";

        $$(".look-card", grid).forEach((card, i) => {
          const match = filter === "all" || card.getAttribute("data-filter") === filter;
          card.classList.toggle("is-hidden", !match);
          if (match) {
            // Re-trigger the entrance animation
            card.style.animation = "none";
            /* eslint-disable no-unused-expressions */
            void card.offsetWidth;
            card.style.animation = "";
            card.style.animationDelay = (i % 4) * 60 + "ms";
          }
        });
      });
    });
  }

  /* ======================================================================
     6. SCROLL REVEAL + ACTIVE NAV LINK
  ====================================================================== */
  function initReveal() {
    const items = $$(".reveal-up");

    if (!("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });

    items.forEach((el) => io.observe(el));
  }

  function initActiveNav() {
    const links = $$(".nav-link");
    if (!links.length || !("IntersectionObserver" in window)) return;

    const map = {};
    links.forEach((link) => {
      const id = (link.getAttribute("href") || "").replace("#", "");
      const section = id && document.getElementById(id);
      if (section) map[id] = link;
    });

    const ids = Object.keys(map);
    if (!ids.length) return;

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const link = map[entry.target.id];
        if (!link) return;
        links.forEach((l) => l.classList.remove("is-active"));
        link.classList.add("is-active");
      });
    }, { rootMargin: "-45% 0px -50% 0px", threshold: 0 });

    ids.forEach((id) => {
      const section = document.getElementById(id);
      if (section) io.observe(section);
    });
  }

  /* ======================================================================
     7. HERO / CTA BUTTON WIRING
  ====================================================================== */
  function initPrimaryCta() {
    // The floating launcher and every "Open StyleSense AI" button simply
    // scroll to the chat and focus the composer, so the user can type.
    $$('a[href="#chat"]').forEach((a) => {
      a.addEventListener("click", () => {
        setTimeout(() => {
          const input = $("#chatInput");
          if (input && !("ontouchstart" in window)) input.focus();
        }, 700);
      });
    });
  }

  /* ======================================================================
     8. MISC
  ====================================================================== */
  function initMisc() {
    // Footer year
    const year = $("#year");
    if (year) year.textContent = String(new Date().getFullYear());

    // Warn-less image fallback: if an Unsplash image fails, tint the container
    $$("img").forEach((img) => {
      img.addEventListener("error", () => {
        img.style.background = "linear-gradient(135deg, #efe6d8, #dfe7df)";
        img.setAttribute("data-failed", "true");
      });
    });
  }

  /* ======================================================================
     9. BOOT
  ====================================================================== */
  function boot() {
    try { initTheme(); } catch (e) { console.warn("[StyleSense] theme:", e); }
    try { initHeader(); } catch (e) { console.warn("[StyleSense] header:", e); }
    try { initNav(); } catch (e) { console.warn("[StyleSense] nav:", e); }
    try { initGallery(); } catch (e) { console.warn("[StyleSense] gallery:", e); }
    try { initReveal(); } catch (e) { console.warn("[StyleSense] reveal:", e); }
    try { initActiveNav(); } catch (e) { console.warn("[StyleSense] activeNav:", e); }
    try { initPrimaryCta(); } catch (e) { console.warn("[StyleSense] cta:", e); }
    try { initMisc(); } catch (e) { console.warn("[StyleSense] misc:", e); }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();