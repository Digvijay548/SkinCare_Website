/* ═══════════════════════════════════════════════════════
   Wenni Skin Care Academy — script.js (data-driven)
   All content loaded from data.json.
   ═══════════════════════════════════════════════════════ */

let D = null;

/* ── DEPTH CAROUSEL CLASS ────────────────────────────── */
class VanillaDepthCarousel {
  constructor(el, props = {}) {
    this.root = el;
    this.props = {
      items: props.items || [],
      cardWidth: props.cardWidth || 300,
      cardHeight: props.cardHeight || 380,
      radius: props.radius || 18,
      tint: props.tint || '#05060a',
      depth: props.depth || 220,
      spread: props.spread || 90,
      tilt: props.tilt || 22,
      tiltDirection: props.tiltDirection || 'right',
      perspective: props.perspective || 1400,
      visibleCards: props.visibleCards || 4,
      falloff: props.falloff || 0.2,
      blur: props.blur || 6,
      duration: props.duration || 700,
      ease: props.ease || 'power3.out',
      autoplay: props.autoplay || false,
      autoplayDelay: props.autoplayDelay || 3200,
      loop: props.loop || true,
      showControls: props.showControls !== false,
      showIndicators: props.showIndicators !== false,
      onChange: props.onChange || null,
      ...props
    };

    this.data = this.props.items.map(it => (typeof it === 'string' ? { image: it, alt: '' } : it));
    this.count = this.data.length;

    this.pos = 0;
    this.focusIdx = 0;
    this.activeIdx = 0;
    this.tween = null;
    this.scale = 1;
    
    this.drag = null;
    this.wheelTimer = null;
    this.autoTimer = null;
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.init();
  }

  init() {
    this.root.style.setProperty('--dc-perspective', `${this.props.perspective}px`);
    this.root.classList.add('depth-carousel');
    this.root.setAttribute('role', 'group');
    this.root.setAttribute('aria-roledescription', 'carousel');
    this.root.setAttribute('aria-label', 'Depth carousel');
    this.root.setAttribute('tabIndex', '0');

    // Create stage
    this.stage = document.createElement('div');
    this.stage.className = 'depth-carousel__stage';
    this.root.appendChild(this.stage);

    // Create cards
    this.cards = [];
    this.overlays = [];
    this.data.forEach((item, i) => {
      const card = document.createElement('div');
      card.className = 'depth-carousel__card';
      card.style.width = `${this.props.cardWidth}px`;
      card.style.height = `${this.props.cardHeight}px`;
      card.style.borderRadius = `${this.props.radius}px`;
      card.setAttribute('aria-roledescription', 'slide');
      card.setAttribute('aria-label', `${i + 1} of ${this.count}`);
      card.setAttribute('aria-hidden', 'true');
      
      const img = document.createElement('img');
      img.className = 'depth-carousel__img';
      img.src = item.image;
      img.alt = item.alt || '';
      img.draggable = false;
      card.appendChild(img);

      const tintEl = document.createElement('span');
      tintEl.className = 'depth-carousel__tint';
      tintEl.style.background = this.props.tint;
      card.appendChild(tintEl);

      card.addEventListener('click', () => this.onCardClick(i));

      this.stage.appendChild(card);
      this.cards.push(card);
      this.overlays.push(tintEl);
    });

    // Create controls
    if (this.props.showControls && this.count > 1) {
      this.prevBtn = document.createElement('button');
      this.prevBtn.type = 'button';
      this.prevBtn.className = 'depth-carousel__arrow depth-carousel__arrow--prev';
      this.prevBtn.setAttribute('aria-label', 'Previous slide');
      this.prevBtn.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      this.prevBtn.addEventListener('click', () => this.navigateBy(-1));
      this.root.appendChild(this.prevBtn);

      this.nextBtn = document.createElement('button');
      this.nextBtn.type = 'button';
      this.nextBtn.className = 'depth-carousel__arrow depth-carousel__arrow--next';
      this.nextBtn.setAttribute('aria-label', 'Next slide');
      this.nextBtn.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      this.nextBtn.addEventListener('click', () => this.navigateBy(1));
      this.root.appendChild(this.nextBtn);
    }

    // Create indicators
    if (this.props.showIndicators && this.count > 1) {
      this.dotsContainer = document.createElement('div');
      this.dotsContainer.className = 'depth-carousel__dots';
      this.dotsContainer.setAttribute('role', 'tablist');
      this.dotsContainer.setAttribute('aria-label', 'Slides');
      
      this.dots = [];
      this.data.forEach((_, i) => {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.role = 'tab';
        dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
        dot.className = 'depth-carousel__dot';
        dot.addEventListener('click', () => this.setFocus(i, true));
        this.dotsContainer.appendChild(dot);
        this.dots.push(dot);
      });
      this.root.appendChild(this.dotsContainer);
    }

    // Bind events
    this.root.addEventListener('pointerdown', e => this.onPointerDown(e));
    this.root.addEventListener('pointermove', e => this.onPointerMove(e));
    const endDrag = () => this.onPointerEnd();
    this.root.addEventListener('pointerup', endDrag);
    this.root.addEventListener('pointercancel', endDrag);
    this.root.addEventListener('keydown', e => this.onKeyDown(e));
    this.root.addEventListener('wheel', e => this.onWheel(e), { passive: false });

    // Resize Observer
    this.ro = new ResizeObserver(entries => {
      if (!entries[0]) return;
      const w = entries[0].contentRect.width;
      const needed = this.props.cardWidth + Math.abs(this.props.spread) * 2 + 120;
      this.scale = Math.min(Math.max(w / needed, 0.4), 1);
      this.layout(this.pos);
    });
    this.ro.observe(this.root);

    // Autoplay
    if (this.props.autoplay && !this.reduced && this.count > 1) {
      let hovered = false;
      let focused = false;
      const start = () => {
        this.stopAutoplay();
        this.autoTimer = setInterval(() => {
          if (!hovered && !focused) this.navigateBy(1);
        }, Math.max(this.props.autoplayDelay, 600));
      };
      
      this.root.addEventListener('mouseenter', () => { hovered = true; });
      this.root.addEventListener('mouseleave', () => { hovered = false; });
      this.root.addEventListener('focusin', () => { focused = true; });
      this.root.addEventListener('focusout', () => { focused = false; });
      start();
    }

    this.layout(this.pos);
    this.updateActiveState(0);
  }

  clamp(v, min, max) { return Math.min(Math.max(v, min), max); }

  layout(pos) {
    const n = this.count;
    if (!n) return;
    const dir = this.props.tiltDirection === 'left' ? -1 : 1;
    const sc = this.scale;

    for (let i = 0; i < n; i++) {
      const el = this.cards[i];
      if (!el) continue;

      let d = i - pos;
      if (this.props.loop && n > 1) {
        d = ((d % n) + n) % n;
        if (d > n / 2) d -= n;
      }

      const back = Math.max(0, d);
      const az = Math.abs(d);
      const shown = az <= this.props.visibleCards + 0.5;

      const tz = -this.props.depth * d;
      const tx = dir * this.props.spread * d;
      const ry = dir * this.props.tilt * this.clamp(d, 0, 1);

      let opacity = d < 0 ? Math.max(0, 1 + d) : 1;
      if (!shown) opacity = 0;

      const brightness = Math.max(0.15, 1 - back * this.props.falloff);
      const blurPx = this.props.blur > 0 ? Math.min(this.props.blur, (back / Math.max(1, this.props.visibleCards)) * this.props.blur) : 0;
      const zi = Math.round(2000 - d * 20);

      el.style.transform = `translate(-50%, -50%) scale(${sc}) translateX(${tx.toFixed(2)}px) translateZ(${tz.toFixed(2)}px) rotateY(${ry.toFixed(3)}deg)`;
      el.style.opacity = opacity.toFixed(3);
      el.style.filter = `brightness(${brightness.toFixed(3)}) blur(${blurPx.toFixed(2)}px)`;
      el.style.zIndex = String(zi);
      el.style.pointerEvents = shown && opacity > 0.05 ? 'auto' : 'none';

      const ov = this.overlays[i];
      if (ov) ov.style.opacity = this.clamp(back * this.props.falloff * 1.25, 0, 0.86).toFixed(3);
    }
  }

  updateActiveState(idx) {
    this.activeIdx = idx;
    this.cards.forEach((card, i) => {
      card.setAttribute('aria-hidden', String(i !== idx));
    });
    if (this.dots) {
      this.dots.forEach((dot, i) => {
        dot.setAttribute('aria-selected', String(i === idx));
        dot.classList.toggle('is-active', i === idx);
      });
    }
    this.props.onChange?.(idx, this.data[idx]);
  }

  tweenTo(target, animate) {
    if (this.tween) this.tween.kill();
    const proxy = { p: this.pos };
    const dur = animate && !this.reduced ? this.props.duration / 1000 : 0;
    this.tween = gsap.to(proxy, {
      p: target,
      duration: dur,
      ease: this.props.ease,
      onUpdate: () => {
        this.pos = proxy.p;
        this.layout(proxy.p);
      },
      onComplete: () => {
        const n = this.count;
        if (n > 0) this.pos = ((this.pos % n) + n) % n;
        this.layout(this.pos);
      }
    });
  }

  setFocus(rawIndex, animate = true) {
    const n = this.count;
    if (!n) return;
    const idx = this.props.loop ? ((rawIndex % n) + n) % n : this.clamp(rawIndex, 0, n - 1);
    let delta = idx - this.pos;
    if (this.props.loop && n > 1) {
      delta = ((delta % n) + n) % n;
      if (delta > n / 2) delta -= n;
    }
    this.tweenTo(this.pos + delta, animate);
    if (idx !== this.focusIdx) {
      this.focusIdx = idx;
      this.updateActiveState(idx);
    }
  }

  navigateBy(step) { this.setFocus(this.focusIdx + step, true); }

  onWheel(e) {
    if (this.count < 2) return;
    e.preventDefault();
    if (this.tween) this.tween.kill();
    const raw = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    const delta = e.deltaMode === 1 ? raw * 24 : raw;
    const step = this.clamp(delta / (this.props.cardWidth * 0.9), -0.6, 0.6);
    this.pos += step;
    this.layout(this.pos);
    if (this.wheelTimer) clearTimeout(this.wheelTimer);
    this.wheelTimer = setTimeout(() => this.setFocus(Math.round(this.pos), true), 130);
  }

  onPointerDown(e) {
    if (this.count < 2) return;
    if (this.tween) this.tween.kill();
    this.drag = {
      x: e.clientX,
      startPos: this.pos,
      lastX: e.clientX,
      lastT: performance.now(),
      v: 0,
      moved: false,
      id: e.pointerId
    };
  }

  onPointerMove(e) {
    if (!this.drag) return;
    const stepPx = Math.max(this.props.cardWidth * 0.55 * this.scale, 40);
    const dx = e.clientX - this.drag.x;
    if (!this.drag.moved && Math.abs(dx) > 4) {
      this.drag.moved = true;
      this.root.setPointerCapture(this.drag.id);
    }
    if (!this.drag.moved) return;
    const now = performance.now();
    const dt = Math.max(now - this.drag.lastT, 1);
    this.drag.v = (e.clientX - this.drag.lastX) / dt;
    this.drag.lastX = e.clientX;
    this.drag.lastT = now;
    this.pos = this.drag.startPos - dx / stepPx;
    this.layout(this.pos);
  }

  onPointerEnd() {
    if (!this.drag) return;
    const drag = this.drag;
    this.drag = null;
    if (!drag.moved) return;
    const stepPx = Math.max(this.props.cardWidth * 0.55 * this.scale, 40);
    const projected = this.pos - (drag.v * 180) / stepPx;
    this.setFocus(Math.round(projected), true);
  }

  onKeyDown(e) {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      this.navigateBy(-1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      this.navigateBy(1);
    }
  }

  onCardClick(index) {
    if (this.drag && this.drag.moved) return;
    this.setFocus(index, true);
  }

  stopAutoplay() {
    if (this.autoTimer) clearInterval(this.autoTimer);
    this.autoTimer = null;
  }

  destroy() {
    if (this.ro) this.ro.disconnect();
    this.stopAutoplay();
    if (this.wheelTimer) clearTimeout(this.wheelTimer);
    if (this.tween) this.tween.kill();
  }
}

let D = null;

/* ── HELPERS ──────────────────────────────────────────── */
function esc(str) {
  return String(str ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

/* Sparkle / leaf SVG for brand logo */
const BRAND_SVG = `<svg width="SIZE" height="SIZE" viewBox="0 0 32 32" fill="none">
  <circle cx="16" cy="16" r="14" fill="url(#brandGrad)"/>
  <path d="M16 8c0 0-6 4-6 9a6 6 0 0 0 12 0c0-5-6-9-6-9z" fill="white" opacity="0.9"/>
  <path d="M16 10v10M13 14l3-4 3 4" stroke="url(#brandGrad)" stroke-width="1.5" stroke-linecap="round"/>
  <defs>
    <linearGradient id="brandGrad" x1="0" y1="0" x2="32" y2="32">
      <stop offset="0%" stop-color="#C084FC"/>
      <stop offset="100%" stop-color="#F472B6"/>
    </linearGradient>
  </defs>
</svg>`;

const WA_SVG = `<svg width="SIZE" height="SIZE" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>`;

function brandSvg(size) { return BRAND_SVG.replace(/SIZE/g, size); }
function waSvg(size)    { return WA_SVG.replace(/SIZE/g, size); }

function waHref() {
  return `https://wa.me/${D.whatsapp.number}?text=${encodeURIComponent(D.whatsapp.message)}`;
}

function headerHTML(eyebrow, title, titleAccent, subtitle) {
  return `
    <p class="section-eyebrow">${esc(eyebrow)}</p>
    <h2 class="section-title">${esc(title)}${titleAccent ? ` <span class="accent">${esc(titleAccent)}</span>` : ""}</h2>
    ${subtitle ? `<p class="section-subtitle">${esc(subtitle)}</p>` : ""}
  `;
}

/* ── RENDER: META + HEADER ────────────────────────────── */
function applyMeta() {
  document.title = D.site.pageTitle;
  document.getElementById("pageDesc").setAttribute("content", D.site.pageDescription);
}

function renderHeader() {
  document.getElementById("logo").innerHTML = `
    <div class="logo-icon">${brandSvg(34)}</div>
    <div class="logo-text">
      <span class="logo-name">${esc(D.site.name)}</span>
      <span class="logo-sub">${esc(D.site.branch)}</span>
    </div>
  `;
  const isAcademyEnabled = D.academic && D.academic.enabled !== false;
  const filteredNav = D.nav.filter(n => isAcademyEnabled || n.href !== "#academic");
  document.getElementById("navList").innerHTML = filteredNav.map(n =>
    n.cta
      ? `<li><a href="${esc(n.href)}" class="nav-cta-btn">${esc(n.label)}</a></li>`
      : `<li><a href="${esc(n.href)}" class="nav-link">${esc(n.label)}<span class="nav-link-bar"></span></a></li>`
  ).join("");
}

/* ── RENDER: HERO ─────────────────────────────────────── */
function renderHero() {
  const h = D.hero;
  const titleHTML = h.titleLines.map(l =>
    l.accent ? `<span class="hero-title-accent" id="heroTypewriter">${esc(l.text)}</span>` : esc(l.text)
  ).join("<br/>");

  document.getElementById("heroContent").innerHTML = `
    <div class="hero-badge">
      <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="7" fill="#F472B6"/></svg>
      ${esc(h.badge)}
    </div>
    <h1 class="hero-title">${titleHTML}</h1>
    <p class="hero-subtitle">${esc(h.subtitle)}</p>
    <div class="hero-actions">
      <a href="${esc(h.btnPrimary.href)}" class="btn btn-primary btn-lg">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        ${esc(h.btnPrimary.label)}
      </a>
      <a href="${esc(h.btnSecondary.href)}" class="btn btn-outline btn-lg">${esc(h.btnSecondary.label)}</a>
    </div>
    <div class="hero-trust">
      ${h.trust.map((t, i) => `
        ${i > 0 ? '<div class="trust-divider"></div>' : ''}
        <div class="trust-item"><strong>${esc(t.value)}</strong><span>${esc(t.label)}</span></div>
      `).join("")}
    </div>
  `;

  const cc = h.consultCard;
  document.getElementById("heroBg").innerHTML = `
    <img src="${esc(h.image)}" alt="${esc(h.imageAlt)}" />
    <div class="hero-bg-overlay"></div>
  `;
  document.getElementById("heroVisual").innerHTML = `
    <div class="hero-card-main">
      <div class="hero-consult-card">
        <div class="consult-icon">${esc(cc.icon)}</div>
        <p class="consult-label">${esc(cc.label)}</p>
        <h3>${esc(cc.title)}</h3>
        <p>${esc(cc.desc)}</p>
        <div class="consult-mini-grid">
          ${cc.tags.map(t => `<span>${esc(t)}</span>`).join("")}
        </div>
      </div>
    </div>
    ${h.badges.map(b => `<div class="hero-float-badge badge-${esc(b.position)}">${b.icon}<span>${esc(b.text)}</span></div>`).join("")}
  `;
}

/* ── RENDER: ABOUT ────────────────────────────────────── */
function renderAbout() {
  const a = D.about;
  document.getElementById("aboutInner").innerHTML = `
    <div class="about-image-col">
      <div class="about-img-wrap">
        <div class="care-process-card">
          <div class="process-head">
            <span>${esc(a.process.headLabel)}</span>
            <strong>${esc(a.process.headTitle)}</strong>
          </div>
          ${a.process.steps.map(s => `
            <div class="process-step"><b>${esc(s.num)}</b><div><h4>${esc(s.title)}</h4><p>${esc(s.desc)}</p></div></div>
          `).join("")}
        </div>
        <div class="about-img-accent"></div>
        <div class="about-exp-badge">
          <strong>${esc(a.expBadge.value)}</strong>
          <span>${a.expBadge.label}</span>
        </div>
      </div>
    </div>
    <div class="about-text-col">
      <p class="section-eyebrow">${esc(a.eyebrow)}</p>
      <h2 class="section-title">${esc(a.title)} <span class="accent">${esc(a.titleAccent)}</span></h2>
      ${a.desc.map(d => `<p class="about-desc">${esc(d)}</p>`).join("")}
      <div class="about-features">
        ${a.features.map(f => `
          <div class="about-feat">
            <div class="feat-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <span>${esc(f)}</span>
          </div>
        `).join("")}
      </div>
      <a href="#appointment" class="btn btn-primary">${esc(a.btnLabel)}</a>
    </div>
  `;
}

/* ── RENDER: SERVICES ─────────────────────────────────── */
function renderServices() {
  const s = D.sections.services;
  document.getElementById("servicesHeader").innerHTML = headerHTML(s.eyebrow, s.title, s.titleAccent, s.subtitle);
  document.getElementById("servicesGrid").innerHTML = D.services.map((service, i) => `
    <div class="service-card" data-tilt>
      <div class="service-img"><img src="${esc(service.image)}" alt="${esc(service.name)}" loading="lazy" /></div>
      <div class="service-icon" style="--icon-color:${esc(service.color)}">${service.icon}</div>
      <h3 class="service-name">${esc(service.name)}</h3>
      <p class="service-desc">${esc(service.desc)}</p>
      <a href="#appointment" class="service-link">Book Now →</a>
    </div>
  `).join("");
}

/* ── RENDER: WHY US ───────────────────────────────────── */
function renderWhy() {
  const s = D.sections.whyUs;
  document.getElementById("whyHeader").innerHTML = headerHTML(s.eyebrow, s.title, s.titleAccent, s.subtitle);
  document.getElementById("whyGrid").innerHTML = D.whyUs.map(item => `
    <div class="why-card">
      <div class="why-num">${esc(item.num)}</div>
      <h3>${esc(item.title)}</h3>
      <p>${esc(item.desc)}</p>
    </div>
  `).join("");
}

/* ── RENDER: ACADEMY (unique to skincare branch) ──────── */
function renderAcademy() {
  const ac = D.academic;
  const secEl = document.getElementById("academic");
  if (!ac || ac.enabled === false) {
    if (secEl) secEl.style.display = "none";
    return;
  } else {
    if (secEl) secEl.style.display = "";
  }
  document.getElementById("academicInner").innerHTML = `
    <div class="academy-header">
      <p class="section-eyebrow eyebrow-light">${esc(ac.eyebrow)}</p>
      <h2 class="section-title title-light">${esc(ac.title)} <span class="accent">${esc(ac.titleAccent)}</span></h2>
      <p class="section-subtitle" style="color:rgba(255,255,255,0.6);max-width:600px;margin:0 auto 60px">${esc(ac.subtitle)}</p>
    </div>

    <div class="academy-inner">
      <div class="academy-text-col">
        ${ac.desc.map(d => `<p class="academy-desc">${esc(d)}</p>`).join("")}

        <div class="academy-stats">
          ${ac.stats.map(s => `
            <div class="academy-stat">
              <strong>${esc(s.value)}</strong>
              <span>${esc(s.label)}</span>
            </div>
          `).join("")}
        </div>

        <div class="academy-features">
          ${ac.features.map(f => `
            <div class="academy-feat">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              ${esc(f)}
            </div>
          `).join("")}
        </div>
        <a href="#appointment" class="btn btn-gold">${esc(ac.btnLabel)}</a>
      </div>

      <div class="courses-grid">
        ${ac.courses.map(c => `
          <div class="course-card">
            <div class="course-num">${esc(c.num)}</div>
            <h4>${esc(c.title)}</h4>
            <p>${esc(c.desc)}</p>
            <div class="course-meta">
              <span class="course-duration">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                ${esc(c.duration)}
              </span>
              <span class="course-level level-${esc(c.level.toLowerCase())}">${esc(c.level)}</span>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

/* ── RENDER: FOUNDER / DOCTOR ─────────────────────────── */
function renderDoctor() {
  const doc = D.doctor;
  document.getElementById("doctorInner").innerHTML = `
    <div class="doctor-img-col">
      <div class="doctor-expertise-card">
        <div class="expertise-icon">✦</div>
        <h3>${esc(doc.expertise.title)}</h3>
        <ul>
          ${doc.expertise.points.map(p => `<li>${esc(p)}</li>`).join("")}
        </ul>
        <div class="expertise-note">${esc(doc.expertise.note)}</div>
      </div>
    </div>
    <div class="doctor-text-col">
      <p class="section-eyebrow">${esc(doc.eyebrow)}</p>
      <h2 class="section-title">${esc(doc.name)}</h2>
      <p class="doctor-degree">${esc(doc.degree)}</p>
      ${doc.bio.map(b => `<p class="doctor-bio">${esc(b)}</p>`).join("")}
      <div class="doctor-credentials">
        ${doc.credentials.map(c => `
          <div class="cred-item"><strong>${esc(c.value)}</strong><span>${esc(c.label)}</span></div>
        `).join("")}
      </div>
      <a href="#appointment" class="btn btn-primary">${esc(doc.btnLabel)}</a>
    </div>
  `;
}

/* ── RENDER: TESTIMONIALS ─────────────────────────────── */
function renderTestimonials() {
  const s = D.sections.testimonials;
  document.getElementById("testiHeader").innerHTML = headerHTML(s.eyebrow, s.title, s.titleAccent, s.subtitle);
  document.getElementById("testiGrid").innerHTML = D.testimonials.map(ti => `
    <div class="testi-card${ti.featured ? " testi-featured" : ""}">
      <div class="testi-stars">${"★".repeat(ti.stars)}${"☆".repeat(Math.max(0, 5 - ti.stars))}</div>
      <p class="testi-text">"${esc(ti.text)}"</p>
      <div class="testi-author">
        <div class="testi-avatar" style="background:${esc(ti.avatar)}">${esc((ti.name || "?").charAt(0))}</div>
        <div>
          <strong>${esc(ti.name)}</strong>
          <span>${esc(ti.role)}</span>
        </div>
      </div>
    </div>
  `).join("");
}

/* ── RENDER: GALLERY / SHOWCASE ───────────────────────── */
function renderGallery() {
  const images = [
    { image: 'images/svc-facial.jpg', alt: 'Signature Facial Glow Treatment' },
    { image: 'images/svc-microderm.jpg', alt: 'Advanced Microdermabrasion Session' },
    { image: 'images/svc-peel.jpg', alt: 'Chemical Peel & Brightening Care' },
    { image: 'images/svc-acne.jpg', alt: 'Dermal Acne Clarifying Therapy' },
    { image: 'images/svc-antiaging-new.jpg', alt: 'Youthful Anti-Aging Recovery Care' },
    { image: 'images/svc-laser.jpg', alt: 'Laser Resurfacing Treatment' },
    { image: 'images/svc-waxing.jpg', alt: 'Hygienic Organic Waxing Service' },
    { image: 'images/svc-body.jpg', alt: 'Luxury Full Body Polishing Treatment' }
  ];

  document.getElementById("galleryHeader").innerHTML = headerHTML(
    "Visual Showcase",
    "Experience The",
    "Glow Effect",
    "A visual walk through our premium skincare results and advanced aesthetic procedures."
  );

  const container = document.getElementById("galleryContainer");
  container.innerHTML = `<div id="depthCarousel" style="height:100%;width:100%;"></div>`;
  
  const carouselEl = document.getElementById("depthCarousel");
  new VanillaDepthCarousel(carouselEl, {
    items: images,
    depth: 220,
    spread: 90,
    tilt: 22,
    tiltDirection: "right",
    perspective: 1400,
    visibleCards: 4,
    falloff: 0.2,
    blur: 6,
    autoplay: true,
    autoplayDelay: 3200,
    loop: true
  });
}

/* ── RENDER: APPOINTMENT ──────────────────────────────── */
function renderAppointment() {
  const a = D.appointment;
  document.getElementById("apptInner").innerHTML = `
    <div class="appt-info">
      <p class="section-eyebrow">${esc(a.eyebrow)}</p>
      <h2 class="section-title">${esc(a.title)} <span class="accent">${esc(a.titleAccent)}</span></h2>
      <p class="appt-desc">${esc(a.desc)}</p>
      <div class="appt-features">
        ${a.features.map(f => `
          <div class="appt-feat">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            ${esc(f)}
          </div>
        `).join("")}
      </div>
      <div class="clinic-hours">
        <h4>${esc(a.hoursTitle)}</h4>
        ${D.hours.map(h => `
          <div class="hours-row"><span>${esc(h.days)}</span><span>${esc(h.time)}</span></div>
        `).join("")}
      </div>
    </div>
    <div class="appt-form-wrap">
      <div class="appt-form-card">
        <div class="form-header">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="#25D366"/></svg>
          <span>${esc(a.formTitle)}</span>
        </div>
        <div class="appt-form" id="appointmentForm">
          <div class="form-group">
            <label for="patientName">${esc(a.labels.name)}</label>
            <input type="text" id="patientName" placeholder="${esc(a.placeholders.name)}" required />
          </div>
          <div class="form-group">
            <label for="patientPhone">${esc(a.labels.phone)}</label>
            <input type="tel" id="patientPhone" placeholder="${esc(a.placeholders.phone)}" required />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="preferredDate">${esc(a.labels.date)}</label>
              <input type="date" id="preferredDate" required />
            </div>
            <div class="form-group">
              <label for="preferredTime">${esc(a.labels.time)}</label>
              <select id="preferredTime" required>
                <option value="">${esc(a.placeholders.time)}</option>
                ${a.timeOptions.map(t => `<option>${esc(t)}</option>`).join("")}
              </select>
            </div>
          </div>
          <div class="form-group">
            <label for="treatment">${esc(a.labels.treatment)}</label>
            <select id="treatment" required>
              <option value="">${esc(a.placeholders.treatment)}</option>
              ${a.treatmentOptions.map(t => `<option>${esc(t)}</option>`).join("")}
            </select>
          </div>
          <div class="form-group">
            <label for="message">${esc(a.labels.message)}</label>
            <textarea id="message" rows="3" placeholder="${esc(a.placeholders.message)}"></textarea>
          </div>
          <button type="button" class="btn btn-whatsapp btn-full" id="submitBtn" onclick="bookOnWhatsApp()">${waSvg(20)} ${esc(a.submitLabel)}</button>
          <p class="form-note">${esc(a.formNote)}</p>
        </div>
      </div>
    </div>
  `;
}

/* ── RENDER: CONTACT ──────────────────────────────────── */
function renderContact() {
  const c = D.contactSection;
  const w = D.whatsapp;
  const contactHours = D.hours.map(h => `${esc(h.days)}: ${esc(h.time)}`).join("<br/>");

  document.getElementById("contactHeader").innerHTML = `
    <p class="section-eyebrow">${esc(c.eyebrow)}</p>
    <h2 class="section-title">${esc(c.title)} <span class="accent">— ${esc(c.titleBranch)}</span></h2>
  `;

  document.getElementById("contactInner").innerHTML = `
    <div class="contact-details">
      <div class="contact-card">
        <div class="contact-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        </div>
        <div>
          <h4>Address</h4>
          <p>${esc(D.contact.address)}</p>
        </div>
      </div>
      <div class="contact-card">
        <div class="contact-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.28h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9a16 16 0 0 0 6 6l1.27-.85a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
        </div>
        <div>
          <h4>Phone / WhatsApp</h4>
          <p><a href="tel:${esc(w.display)}">${esc(w.display)}</a></p>
        </div>
      </div>
      <div class="contact-card">
        <div class="contact-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        </div>
        <div>
          <h4>Email</h4>
          <p><a href="mailto:${esc(D.contact.email)}">${esc(D.contact.email)}</a></p>
        </div>
      </div>
      <div class="contact-card">
        <div class="contact-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <div>
          <h4>Studio Hours</h4>
          <p>${contactHours}</p>
        </div>
      </div>
      <a href="${waHref()}" target="_blank" class="btn btn-whatsapp contact-wa">${waSvg(18)} ${esc(c.waButton)}</a>
    </div>
    <div class="map-wrap">
      <iframe src="${esc(D.contact.mapEmbed)}" width="600" height="450" style="border:0;" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
    </div>
  `;
}

/* ── RENDER: FOOTER ───────────────────────────────────── */
function renderFooter() {
  const s = D.site;
  const f = D.footer;
  const w = D.whatsapp;
  const wa = waHref();

  const isAcademyEnabled = D.academic && D.academic.enabled !== false;
  const filteredQuickLinks = f.quickLinks.filter(l => isAcademyEnabled || l.href !== "#academic");

  document.getElementById("footerInner").innerHTML = `
    <div class="footer-brand">
      <a href="#" class="logo logo-light">
        <div class="logo-icon">${brandSvg(28)}</div>
        <div class="logo-text">
          <span class="logo-name">${esc(s.name)}</span>
          <span class="logo-sub">${esc(s.tagline)}</span>
        </div>
      </a>
      <p class="footer-tagline">${esc(s.footerTagline)}</p>
      <div class="footer-social">
        ${f.social.map(soc => {
          const href = soc.href === "whatsapp" ? wa : soc.href;
          if (soc.href === "#") {
            return `<a href="javascript:void(0)" aria-label="${esc(soc.label)} (coming soon)" title="${esc(soc.label)} — link coming soon" class="social-link social-placeholder" role="button">${soc.icon}</a>`;
          }
          return `<a href="${esc(href)}" aria-label="${esc(soc.label)}" class="social-link"${soc.href === "whatsapp" || soc.href.startsWith("http") ? ' target="_blank"' : ""}>${soc.icon}</a>`;
        }).join("")}
      </div>
    </div>
    <div class="footer-links">
      <h4>Services</h4>
      <ul>
        ${f.servicesLinks.map(l => `<li><a href="${esc(l.href)}">${esc(l.label)}</a></li>`).join("")}
      </ul>
    </div>
    <div class="footer-links">
      <h4>Quick Links</h4>
      <ul>
        ${filteredQuickLinks.map(l => `<li><a href="${esc(l.href)}">${esc(l.label)}</a></li>`).join("")}
      </ul>
    </div>
    <div class="footer-contact">
      <h4>Contact</h4>
      <p>${esc(D.contact.address)}</p>
      <p class="phone-link"><a href="tel:${esc(w.display)}">${esc(w.display)}</a></p>
      <p><a href="mailto:${esc(D.contact.email)}">${esc(D.contact.email)}</a></p>
      <a href="${wa}" target="_blank" class="btn btn-whatsapp footer-wa">${waSvg(16)} WhatsApp Us</a>
    </div>
  `;

  document.getElementById("footerBottom").innerHTML = `
    <p>${esc(s.copyright)}</p>
    <p>${esc(s.credit)}</p>
  `;
}

/* ── RENDER: FLOATING WHATSAPP ────────────────────────── */
function renderFloat() {
  const el = document.getElementById("whatsappFloat");
  el.href = waHref();
  el.innerHTML = `${waSvg(28)}<span class="whatsapp-float-label">Book Now</span>`;
}

/* ── RENDER ALL ───────────────────────────────────────── */
function renderAll() {
  applyMeta();
  renderHeader();
  renderHero();
  renderAbout();
  renderServices();
  renderWhy();
  renderAcademy();
  renderDoctor();
  renderTestimonials();
  renderGallery();
  renderAppointment();
  renderContact();
  renderFooter();
  renderFloat();
}

/* ═══════════════════════════════════════════════════════
   BEHAVIOURS
   ═══════════════════════════════════════════════════════ */
function initBehaviours() {
  const header = document.getElementById("header");

  /* ── SCROLL PROGRESS BAR ── */
  const progressBar = document.getElementById("scrollProgress");
  window.addEventListener("scroll", () => {
    if (!progressBar) return;
    const scrollTop  = window.scrollY;
    const docHeight  = document.documentElement.scrollHeight - window.innerHeight;
    progressBar.style.width = `${Math.min(100, (scrollTop / docHeight) * 100)}%`;
  }, { passive: true });

  /* ── HEADER SCROLL EFFECT ── */
  window.addEventListener("scroll", () => {
    header.classList.toggle("scrolled", window.scrollY > 20);
  }, { passive: true });

  /* ── HAMBURGER ── */
  const hamburger = document.getElementById("hamburger");
  const nav = document.getElementById("nav");
  hamburger.addEventListener("click", () => {
    hamburger.classList.toggle("active");
    nav.classList.toggle("open");
    document.body.style.overflow = nav.classList.contains("open") ? "hidden" : "";
  });
  document.querySelectorAll(".nav-link, .nav-cta-btn").forEach(link => {
    link.addEventListener("click", () => {
      hamburger.classList.remove("active");
      nav.classList.remove("open");
      document.body.style.overflow = "";
    });
  });
  document.addEventListener("click", e => {
    if (nav.classList.contains("open") && !nav.contains(e.target) && !hamburger.contains(e.target)) {
      hamburger.classList.remove("active");
      nav.classList.remove("open");
      document.body.style.overflow = "";
    }
  });

  /* ── ACTIVE NAV LINK ── */
  const sections = Array.from(document.querySelectorAll("section[id]")).filter(s => s.style.display !== "none");
  const navLinks = document.querySelectorAll(".nav-link");
  const secObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const id = e.target.id;
        navLinks.forEach(l => l.classList.toggle("active-link", l.getAttribute("href") === `#${id}`));
      }
    });
  }, { rootMargin: "-40% 0px -55% 0px" });
  sections.forEach(s => secObs.observe(s));

  /* ── SCROLL REVEAL ── */
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const reveals = Array.from(document.querySelectorAll(
    ".service-card, .why-card, .testi-card, .about-feat, .contact-card, .experience-card, .appt-feat, .cred-item, .course-card, .academy-feat, .academy-stat"
  )).filter(el => {
    const parentSec = el.closest("section");
    return !parentSec || parentSec.style.display !== "none";
  });

  if (reducedMotion.matches) {
    reveals.forEach(el => el.classList.add("visible"));
  } else {
    reveals.forEach((el, idx) => {
      // Map elements to custom reveal styles
      if (el.classList.contains("service-card") || el.classList.contains("course-card")) {
        el.classList.add("reveal-scale");
      } else if (el.classList.contains("about-feat") || el.classList.contains("appt-feat") || el.classList.contains("cred-item")) {
        el.classList.add("reveal-left");
      } else if (el.classList.contains("contact-card") || el.classList.contains("experience-card")) {
        el.classList.add("reveal-right");
      } else {
        el.classList.add("reveal-up");
      }
      el.dataset.revealIndex = idx % 4; // Max stagger delay is 300ms
    });
    const ro = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const delay = parseInt(entry.target.dataset.revealIndex || 0) * 100;
          setTimeout(() => { entry.target.classList.add("visible"); ro.unobserve(entry.target); }, delay);
        }
      });
    }, { threshold: 0.1 });
    reveals.forEach(el => ro.observe(el));
  }

  /* ── SECTION HEADER REVEAL ── */
  const headers = document.querySelectorAll(".section-header, .about-text-col, .appt-info, #contactHeader, .academy-header");
  if (reducedMotion.matches) {
    headers.forEach(el => el.classList.add("header-visible"));
  } else {
    headers.forEach(el => {
      const parentSec = el.closest("section");
      if (parentSec && parentSec.style.display === "none") return;
      el.classList.add("reveal-header");
      new IntersectionObserver(entries => {
        entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("header-visible"); } });
      }, { threshold: 0.15 }).observe(el);
    });
  }

  /* ── SET MIN DATE ── */
  const dateInput = document.getElementById("preferredDate");
  if (dateInput) {
    const t = new Date();
    dateInput.min = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`;
  }

  /* ── SMOOTH SCROLL ── */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener("click", e => {
      const id = anchor.getAttribute("href");
      if (id === "#") return;
      const target = document.querySelector(id);
      if (target) {
        e.preventDefault();
        window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - (header?.offsetHeight || 72), behavior: "smooth" });
      }
    });
  });

  /* ── FLOATING WA HIDE/SHOW ── */
  const waFloat = document.getElementById("whatsappFloat");
  let lastY = 0;
  window.addEventListener("scroll", () => {
    if (!waFloat) return;
    const y = window.scrollY;
    waFloat.style.transform = y > lastY + 60 ? "translateY(120%)" : "";
    waFloat.style.opacity   = y > lastY + 60 ? "0" : "";
    lastY = y;
  }, { passive: true });

  /* ── HERO SCROLL PARALLAX ── */
  window.addEventListener("scroll", () => {
    const y = window.scrollY;
    const img = document.querySelector(".hero-bg-img img");
    if (y < window.innerHeight && img && !reducedMotion.matches) {
      img.style.transform = `translate3d(0, ${y * 0.32}px, 0) scale(${1 + y * 0.00012})`;
    }
  }, { passive: true });

  /* ── MOUSE GLOW FOLLOWER ── */
  const glow1 = document.querySelector(".glow-blob-1");
  if (glow1 && !reducedMotion.matches) {
    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 3;
    let posX = mouseX;
    let posY = mouseY;

    window.addEventListener("mousemove", e => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    }, { passive: true });

    function animGlow() {
      posX += (mouseX - posX) * 0.05;
      posY += (mouseY - posY) * 0.05;
      // Offset by 225px to center the 450px glow-blob under the cursor
      glow1.style.transform = `translate3d(${posX - 225}px, ${posY - 225}px, 0)`;
      requestAnimationFrame(animGlow);
    }
    animGlow();
  }

  /* ── COUNTER ANIMATION ── */
  function animateCounter(el, target, suffix = "") {
    let v = 0;
    const step = target / (1800 / 16);
    const t = setInterval(() => {
      v += step;
      if (v >= target) { v = target; clearInterval(t); }
      el.textContent = Math.floor(v) + suffix;
    }, 16);
  }
  new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting && !e.target.dataset.counted) {
        e.target.dataset.counted = "true";
        const raw = e.target.textContent;
        const num = parseInt(raw.replace(/\D/g,""), 10);
        if (!isNaN(num)) animateCounter(e.target, num, raw.replace(/[\d]/g,""));
      }
    });
  }, { threshold: 0.5 }).observe && (() => {
    const co = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting && !e.target.dataset.counted) {
          e.target.dataset.counted = "true";
          const raw = e.target.textContent;
          const num = parseInt(raw.replace(/\D/g,""), 10);
          if (!isNaN(num)) animateCounter(e.target, num, raw.replace(/[\d]/g,""));
        }
      });
    }, { threshold: 0.5 });
    document.querySelectorAll(".trust-item strong, .cred-item strong, .academy-stat strong").forEach(el => co.observe(el));
  })();

  /* ── CARD TILT EFFECT ── */
  if (!reducedMotion.matches) {
    document.querySelectorAll("[data-tilt]").forEach(card => {
      card.style.transition = "transform 0.1s ease, box-shadow 0.1s ease";
      card.addEventListener("mousemove", e => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = `perspective(1000px) rotateY(${x*10}deg) rotateX(${-y*10}deg) translateY(-10px)`;
        card.style.boxShadow = "var(--shadow-lg), 0 20px 50px rgba(139, 92, 246, 0.15)";
      });
      card.addEventListener("mouseleave", () => {
        card.style.transition = "transform 0.5s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.5s cubic-bezier(0.22, 1, 0.36, 1)";
        card.style.transform = "";
        card.style.boxShadow = "";
      });
    });
  }

  /* ── TYPEWRITER ON HERO ACCENT ── */
  const tw = document.getElementById("heroTypewriter");
  if (tw) {
    const full = tw.textContent;
    tw.textContent = "";
    tw.style.borderRight = "3px solid var(--rose)";
    let i = 0;
    const type = () => {
      if (i <= full.length) { tw.textContent = full.slice(0, i++); setTimeout(type, 80); }
      else { setTimeout(() => { tw.style.borderRight = "none"; }, 1200); }
    };
    setTimeout(type, 700);
  }

  /* ── PROCESS STEP STAGGER ── */
  const processSteps = document.querySelectorAll(".process-step");
  processSteps.forEach((el, i) => {
    el.style.cssText = `opacity:0;transform:translateX(-20px);transition:opacity 0.5s ease ${i*120}ms,transform 0.5s ease ${i*120}ms`;
  });
  const processCard = document.querySelector(".care-process-card");
  if (processCard) {
    new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          processSteps.forEach(s => { s.style.opacity = "1"; s.style.transform = "translateX(0)"; });
        }
      });
    }, { threshold: 0.3 }).observe(processCard);
  }

  /* ── FORM FOCUS ── */
  document.querySelectorAll(".form-group input,.form-group select,.form-group textarea").forEach(inp => {
    inp.addEventListener("focus", () => inp.parentElement.classList.add("field-focused"));
    inp.addEventListener("blur",  () => inp.parentElement.classList.remove("field-focused"));
  });

  console.log(`%c✨ ${D.site.name} Loaded`, "color:#C084FC;font-size:14px;font-weight:bold");
}

/* ── WHATSAPP BOOKING ─────────────────────────────────── */
function bookOnWhatsApp() {
  const name      = document.getElementById("patientName").value.trim();
  const phone     = document.getElementById("patientPhone").value.trim();
  const date      = document.getElementById("preferredDate").value;
  const time      = document.getElementById("preferredTime").value;
  const treatment = document.getElementById("treatment").value;
  const message   = document.getElementById("message").value.trim();

  if (!name)                        { showFormError("patientName",   "Please enter your full name.");         return; }
  if (!phone)                       { showFormError("patientPhone",  "Please enter your mobile number.");     return; }
  if (!isValidPhone(phone))         { showFormError("patientPhone",  "Please enter a valid phone number.");   return; }
  if (!date)                        { showFormError("preferredDate", "Please select a preferred date.");      return; }
  if (!time)                        { showFormError("preferredTime", "Please select a preferred time.");      return; }
  if (!treatment)                   { showFormError("treatment",     "Please select the service required.");  return; }

  const displayDate = new Date(date).toLocaleDateString("en-IN", { weekday:"long", year:"numeric", month:"long", day:"numeric" });

  // BUG FIX: filter(Boolean) removes empty strings
  const waMessage = [
    `✨ *Booking Request — ${D.site.name}*`,
    ``,
    `👤 *Name:* ${name}`,
    `📱 *Mobile:* ${phone}`,
    `📅 *Date:* ${displayDate}`,
    `🕐 *Time:* ${time}`,
    `💆 *Service / Course:* ${treatment}`,
    message ? `💬 *Concern / Message:* ${message}` : ``,
    ``,
    `_Sent from the academy website booking form._`
  ].filter(Boolean).join("\n");

  const btn = document.getElementById("submitBtn");
  btn.textContent = "Opening WhatsApp...";
  btn.style.opacity = "0.8";
  btn.style.pointerEvents = "none";

  setTimeout(() => {
    window.open(`https://wa.me/${D.whatsapp.number}?text=${encodeURIComponent(waMessage)}`, "_blank");
    btn.innerHTML = `${waSvg(20)} ✅ Sent!`;
    btn.style.background = "#16a34a";
    btn.style.opacity = "1";
    btn.style.pointerEvents = "auto";
    setTimeout(() => { btn.innerHTML = `${waSvg(20)} ${D.appointment.submitLabel}`; btn.style.background = ""; }, 3000);
  }, 400);
}

function showFormError(fieldId, message) {
  const field = document.getElementById(fieldId);
  if (!field) return;
  clearFormError(field);
  field.style.borderColor = "#EF4444";
  field.style.boxShadow = "0 0 0 3px rgba(239,68,68,0.1)";
  const err = document.createElement("p");
  err.className = "form-error";
  err.style.cssText = "color:#EF4444;font-size:12px;margin-top:5px;font-weight:500;";
  err.innerHTML = `⚠️ ${message}`;
  field.parentNode.appendChild(err);
  field.focus();
  field.scrollIntoView({ behavior:"smooth", block:"center" });
  const clear = () => { clearFormError(field); field.removeEventListener("input", clear); field.removeEventListener("change", clear); };
  field.addEventListener("input", clear);
  field.addEventListener("change", clear);
}

function clearFormError(field) {
  field.style.borderColor = "";
  field.style.boxShadow = "";
  const e = field.parentNode.querySelector(".form-error");
  if (e) e.remove();
}

function isValidPhone(phone) {
  return /^\d{7,15}$/.test(phone.replace(/[\s\-\+\(\)]/g,""));
}

/* ── BOOT ─────────────────────────────────────────────── */
(async function boot() {
  try {
    const res = await fetch("data.json", { cache: "no-store" });
    D = await res.json();
    renderAll();
    initBehaviours();
  } catch(err) {
    console.error("Failed to load data.json", err);
    document.body.insertAdjacentHTML("afterbegin",
      `<div style="background:#7C3AED;color:#fff;padding:12px 24px;font-family:sans-serif;text-align:center;">Failed to load data.json — check the file exists and is valid JSON.</div>`);
  }
})();
