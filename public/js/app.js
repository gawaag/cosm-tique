/* TechPortables - storefront client script */
(function () {
  'use strict';

  var CURRENCY = window.__CURRENCY__ || 'د.م.';
  var LANG = window.__LANG__ || 'fr';
  var CART_KEY = 'tp_cart_v2';

  var T = {
    fr: {
      added: 'Ajouté au panier', empty: 'Votre panier est vide.', qty: 'Qté',
      wa_intro: 'Bonjour, je souhaite commander :', wa_total: 'Total', wa_offer: 'Mon message',
      cfg_base: 'Formule', cfg_included: 'Inclus', cfg_quote: 'à confirmer'
    },
    ar: {
      added: 'أُضيف إلى السلة', empty: 'سلتك فارغة.', qty: 'الكمية',
      wa_intro: 'مرحباً، أرغب في طلب:', wa_total: 'المجموع', wa_offer: 'رسالتي',
      cfg_base: 'الصيغة', cfg_included: 'مشمول', cfg_quote: 'يُؤكد لاحقاً'
    },
    en: {
      added: 'Added to cart', empty: 'Your cart is empty.', qty: 'Qty',
      wa_intro: 'Hello, I would like to order:', wa_total: 'Total', wa_offer: 'My message',
      cfg_base: 'Formula', cfg_included: 'Included', cfg_quote: 'price TBD'
    }
  };
  var t = function (k) { return (T[LANG] && T[LANG][k]) || T.fr[k]; };

  function fmt(n) { return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' ' + CURRENCY; }

  // ---- Cart storage ----
  function getCart() {
    try { var c = JSON.parse(localStorage.getItem(CART_KEY)); return Array.isArray(c) ? c : []; }
    catch (e) { return []; }
  }
  function saveCart(c) { localStorage.setItem(CART_KEY, JSON.stringify(c)); updateBadge(); }
  function cartCount() { return getCart().reduce(function (s, i) { return s + i.qty; }, 0); }

  function updateBadge() {
    var n = cartCount();
    document.querySelectorAll('[data-cart-count]').forEach(function (el) {
      el.textContent = n;
      if (n === 0) el.setAttribute('data-empty', ''); else el.removeAttribute('data-empty');
    });
  }

  function configKeyOf(cfg) {
    cfg = cfg || {};
    return [cfg.storageSteps || 0, cfg.ramGb || 0, cfg.antivirus ? 1 : 0, cfg.otherSoftware || ''].join('|');
  }

  function addToCart(item) {
    item.config = item.config || { storageSteps: 0, ramGb: 8, office: true, antivirus: false, otherSoftware: '' };
    item.configKey = configKeyOf(item.config);
    var cart = getCart();
    var found = cart.find(function (i) { return i.id === item.id && i.configKey === item.configKey; });
    if (found) { found.qty = Math.min(found.qty + item.qty, 99); }
    else { cart.push(item); }
    saveCart(cart);
  }

  function configLabel(item) {
    if (!item || !item.config) return '';
    if (item.cfgLabel) return item.cfgLabel;
    var c = item.config;
    var bits = [];
    if (c.storageSteps) bits.push('Stockage +' + (c.storageSteps * (item.storageStep || 256)) + ' Go');
    if (c.ramGb) bits.push('RAM ' + c.ramGb + ' Go');
    bits.push('Office inclus');
    if (c.antivirus) bits.push('Antivirus (' + t('cfg_quote') + ')');
    if (c.otherSoftware) bits.push(c.otherSoftware + ' (' + t('cfg_quote') + ')');
    return bits.join(' · ');
  }

  function cartPayload(cart) {
    return cart.map(function (i) {
      return {
        id: i.id,
        qty: i.qty,
        offer: i.offer,
        config: i.config || { storageSteps: 0, ramGb: 8, antivirus: false, otherSoftware: '' }
      };
    });
  }

  // ---- Theme toggle ----
  function initTheme() {
    document.querySelectorAll('#themeToggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
        var next = cur === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        try { localStorage.setItem('theme', next); } catch (e) {}
      });
    });
  }

  // ---- Mobile nav ----
  function initNav() {
    var toggle = document.getElementById('navToggle');
    var nav = document.getElementById('mainNav');
    if (toggle && nav) {
      toggle.addEventListener('click', function () {
        var open = nav.classList.toggle('open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    }
  }

  // ---- Product detail page ----
  function initProductPage() {
    var box = document.querySelector('.product-detail');
    if (!box) return;
    var qtyInput = document.getElementById('qty');
    box.querySelector('.qty-minus') && box.querySelector('.qty-minus').addEventListener('click', function () {
      qtyInput.value = Math.max(1, (parseInt(qtyInput.value, 10) || 1) - 1);
    });
    box.querySelector('.qty-plus') && box.querySelector('.qty-plus').addEventListener('click', function () {
      qtyInput.value = Math.min(99, (parseInt(qtyInput.value, 10) || 1) + 1);
    });

    var configurable = box.dataset.configurable === '1';
    var basePrice = parseFloat(box.dataset.price) || 0;
    var storageStep = parseInt(box.dataset.storageStep, 10) || 256;
    var storagePrice = parseFloat(box.dataset.storagePrice) || 40;
    var maxStorage = parseInt(box.dataset.maxStorageSteps, 10) || 3;
    var baseStorage = parseInt(box.dataset.baseStorage, 10) || 0;
    var baseRam = parseInt(box.dataset.baseRam, 10) || 8;
    var ramOptions = [];
    try {
      ramOptions = JSON.parse(decodeURIComponent(box.dataset.ramOptions || '%5B%5D'));
    } catch (e) { ramOptions = []; }
    if (!ramOptions.length) {
      if (baseRam <= 8) {
        ramOptions = [
          { gb: 8, delta: 0, isDefault: true },
          { gb: 16, delta: parseFloat(box.dataset.ramUpgrade) || 25, isDefault: false }
        ];
      } else if (baseRam === 16) {
        ramOptions = [
          { gb: 16, delta: 0, isDefault: true },
          { gb: 8, delta: -(parseFloat(box.dataset.ramDowngrade) || 15), isDefault: false }
        ];
      } else {
        ramOptions = [{ gb: baseRam, delta: 0, isDefault: true }];
      }
    }
    var defaultRam = (ramOptions.find(function (o) { return o.isDefault; }) || ramOptions[0]).gb;
    var state = { storageSteps: 0, ramGb: defaultRam, antivirus: false, otherSoftware: '' };
    var sticky = document.getElementById('cfgSticky');

    function ramDelta(gb) {
      var opt = ramOptions.find(function (o) { return o.gb === gb; });
      return opt ? Number(opt.delta) || 0 : 0;
    }
    function priceFor(storageSteps, ramGb) {
      return Math.round((basePrice + storageSteps * storagePrice + ramDelta(ramGb)) * 100) / 100;
    }
    function livePrice() { return priceFor(state.storageSteps, state.ramGb); }

    function summaryText() {
      var bits = [];
      if (baseStorage || state.storageSteps) {
        bits.push((baseStorage + state.storageSteps * storageStep) + ' Go');
      }
      bits.push(state.ramGb + ' Go RAM');
      bits.push('Office inclus');
      if (state.antivirus) bits.push('Antivirus');
      if (state.otherSoftware) bits.push(state.otherSoftware);
      return bits.join(' · ');
    }

    function refreshOptionPrices() {
      document.querySelectorAll('#cfgStorageOpts .pc-option').forEach(function (row) {
        var s = parseInt(row.getAttribute('data-steps'), 10) || 0;
        var priceEl = row.querySelector('.pc-option-price');
        if (priceEl) priceEl.textContent = fmt(priceFor(s, state.ramGb));
      });
      document.querySelectorAll('#cfgRamOpts .pc-option').forEach(function (row) {
        var gb = parseInt(row.getAttribute('data-gb'), 10);
        var priceEl = row.querySelector('.pc-option-price');
        if (priceEl) priceEl.textContent = fmt(priceFor(state.storageSteps, gb));
      });
    }

    function refreshPrice() {
      var p = fmt(livePrice());
      var live = document.getElementById('cfgLivePrice');
      var hero = document.getElementById('pdpHeroPrice');
      var stickyPrice = document.getElementById('cfgStickyPrice');
      var stickySummary = document.getElementById('cfgStickySummary');
      if (live) live.textContent = p;
      if (hero) hero.textContent = p;
      if (stickyPrice) stickyPrice.textContent = p;
      if (stickySummary) stickySummary.textContent = summaryText();
      refreshOptionPrices();
    }

    function fillStorageOptions() {
      var el = document.getElementById('cfgStorageOpts');
      if (!el) return;
      el.innerHTML = '';
      for (var s = 0; s <= maxStorage; s++) {
        var label = document.createElement('label');
        label.className = 'pc-option';
        label.setAttribute('data-steps', String(s));
        var input = document.createElement('input');
        input.type = 'radio';
        input.name = 'cfg_storage';
        input.value = String(s);
        if (s === 0) input.checked = true;
        var title = document.createElement('strong');
        var final = baseStorage + s * storageStep;
        title.textContent = final ? (final + ' Go') : ('+' + (s * storageStep) + ' Go');
        var price = document.createElement('span');
        price.className = 'pc-option-price';
        price.textContent = fmt(priceFor(s, state.ramGb));
        label.appendChild(input);
        label.appendChild(title);
        label.appendChild(price);
        el.appendChild(label);
      }
      el.addEventListener('change', function (e) {
        if (!e.target || e.target.name !== 'cfg_storage') return;
        state.storageSteps = parseInt(e.target.value, 10) || 0;
        refreshPrice();
      });
    }

    function fillRamOptions() {
      var el = document.getElementById('cfgRamOpts');
      if (!el) return;
      el.innerHTML = '';
      ramOptions.forEach(function (opt) {
        var label = document.createElement('label');
        label.className = 'pc-option';
        label.setAttribute('data-gb', String(opt.gb));
        var input = document.createElement('input');
        input.type = 'radio';
        input.name = 'cfg_ram';
        input.value = String(opt.gb);
        if (opt.isDefault) input.checked = true;
        var title = document.createElement('strong');
        title.textContent = opt.gb + ' Go';
        var price = document.createElement('span');
        price.className = 'pc-option-price';
        price.textContent = fmt(priceFor(state.storageSteps, opt.gb));
        label.appendChild(input);
        label.appendChild(title);
        label.appendChild(price);
        el.appendChild(label);
      });
      el.addEventListener('change', function (e) {
        if (!e.target || e.target.name !== 'cfg_ram') return;
        state.ramGb = parseInt(e.target.value, 10) || defaultRam;
        refreshPrice();
      });
    }

    function doAdd() {
      var attest = document.getElementById('pdpAttest');
      if (attest && !attest.checked) {
        var wrap = attest.closest('.attest-option');
        if (wrap) wrap.classList.add('is-error');
        if (attest.reportValidity) attest.reportValidity();
        attest.focus();
        return;
      }
      addToCart(buildItem());
      var msg = document.getElementById('addedMsg');
      if (msg) { msg.hidden = false; msg.textContent = '✓ Ajouté au panier'; }
      if (sticky) sticky.classList.add('is-added');
    }

    function buildItem() {
      var cfg = {
        storageSteps: state.storageSteps,
        ramGb: state.ramGb,
        office: true,
        antivirus: state.antivirus,
        otherSoftware: state.otherSoftware
      };
      return {
        id: parseInt(box.dataset.productId, 10),
        name: box.dataset.productName,
        price: livePrice(),
        basePrice: basePrice,
        image: box.dataset.image || '',
        slug: box.dataset.slug,
        qty: Math.max(1, Math.min(99, parseInt(qtyInput.value, 10) || 1)),
        offer: null,
        config: cfg,
        storageStep: storageStep,
        cfgLabel: configurable ? summaryText() : ''
      };
    }

    if (configurable) {
      fillStorageOptions();
      fillRamOptions();
      var av = document.getElementById('cfgAntivirus');
      var other = document.getElementById('cfgOtherSoft');
      if (av) av.addEventListener('change', function () { state.antivirus = !!av.checked; refreshPrice(); });
      if (other) other.addEventListener('input', function () {
        state.otherSoftware = String(other.value || '').trim().slice(0, 120);
        refreshPrice();
      });
      if (sticky) {
        sticky.hidden = false;
        document.body.classList.add('has-cfg-sticky');
      }
      var stickyAdd = document.getElementById('cfgStickyAdd');
      if (stickyAdd) stickyAdd.addEventListener('click', doAdd);
      refreshPrice();
    }

    var addBtn = document.getElementById('addToCart');
    addBtn && addBtn.addEventListener('click', doAdd);

    var offerBtn = document.getElementById('makeOffer');
    offerBtn && offerBtn.addEventListener('click', function () {
      addToCart(buildItem());
      window.location.href = '/panier#offer';
    });

    document.querySelectorAll('.thumb-mini').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var img = document.querySelector('#mainImage img');
        var hero = document.getElementById('pdpHeroImg');
        if (img) img.src = btn.dataset.src;
        if (hero) hero.src = btn.dataset.src;
        document.querySelectorAll('.thumb-mini').forEach(function (b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');
      });
    });
  }

  // ---- Cart / checkout page ----
  function initCartPage() {
    var itemsBox = document.getElementById('cartItems');
    if (!itemsBox) return;
    var emptyBox = document.getElementById('cartEmpty');
    var totalRow = document.getElementById('cartTotalRow');
    var totalEl = document.getElementById('cartTotal');
    var form = document.getElementById('reservationForm');
    var itemsField = document.getElementById('itemsField');
    var waBtn = document.getElementById('whatsappCheckout');

    function render() {
      var cart = getCart();
      itemsBox.innerHTML = '';
      if (!cart.length) {
        emptyBox.hidden = false;
        totalRow.style.display = 'none';
        if (form) form.querySelector('#submitReservation').disabled = true;
      } else {
        emptyBox.hidden = true;
        totalRow.style.display = 'flex';
        if (form) form.querySelector('#submitReservation').disabled = false;
      }
      var total = 0;
      cart.forEach(function (i, idx) {
        total += i.price * i.qty;
        var el = document.createElement('div');
        el.className = 'cart-item';
        var cfg = configLabel(i);
        var imgHtml = i.image
          ? '<img src="/uploads/' + i.image + '" alt="">'
          : '<svg viewBox="0 0 24 24" width="26" height="26" style="color:var(--muted)"><path fill="currentColor" d="M4 5h16a1 1 0 011 1v9H3V6a1 1 0 011-1z"/></svg>';
        el.innerHTML =
          '<div class="cart-item-img">' + imgHtml + '</div>' +
          '<div><div class="cart-item-name">' + escapeHtml(i.name) + '</div>' +
          (cfg ? '<div class="cart-item-cfg">' + escapeHtml(cfg) + '</div>' : '') +
          '<div class="cart-item-meta">' + fmt(i.price) + '</div></div>' +
          '<div class="cart-item-right">' +
            '<div class="cart-qty"><button type="button" data-idx="' + idx + '" data-dec="1">−</button>' +
            '<span>' + i.qty + '</span>' +
            '<button type="button" data-idx="' + idx + '" data-inc="1">+</button></div>' +
            '<button type="button" class="cart-remove" data-idx="' + idx + '" data-rm="1">Retirer</button>' +
          '</div>';
        itemsBox.appendChild(el);
      });
      totalEl.textContent = fmt(total);
      if (itemsField) itemsField.value = JSON.stringify(cartPayload(cart));
      updateWhatsApp(cart, total);
    }

    function updateWhatsApp(cart, total) {
      if (!waBtn || !cart.length) return;
      var base = waBtn.getAttribute('href').split('?')[0];
      var lines = [t('wa_intro')];
      cart.forEach(function (i) {
        lines.push('- ' + i.name + ' x' + i.qty + ' (' + fmt(i.price) + ')');
        var cfg = configLabel(i);
        if (cfg) lines.push('  ' + cfg);
      });
      lines.push(t('wa_total') + ': ' + fmt(total));
      var pay = document.querySelector('input[name="payment_pref"]:checked');
      if (pay) {
        var payMap = {
          leboncoin: 'Leboncoin',
          ebay: 'eBay Marketplace',
          paypal: 'PayPal',
          handoff: 'Remise en main propre (RDV)'
        };
        lines.push('Paiement: ' + (payMap[pay.value] || pay.value));
      }
      if (document.querySelector('input[name="req_rdv"]:checked')) lines.push('Demande: rendez-vous');
      if (document.querySelector('input[name="req_photos"]:checked')) lines.push('Demande: plus de photos');
      if (document.querySelector('input[name="req_info"]:checked')) lines.push('Demande: plus d’infos');
      waBtn.setAttribute('href', base + '?text=' + encodeURIComponent(lines.join('\n')));
    }

    function refreshWaPrefs() { updateWhatsApp(getCart(), getCart().reduce(function (s, i) { return s + i.price * i.qty; }, 0)); }
    if (form) {
      form.addEventListener('change', function (e) {
        if (e.target && (e.target.name === 'payment_pref' || e.target.name === 'req_rdv' || e.target.name === 'req_photos' || e.target.name === 'req_info')) {
          refreshWaPrefs();
        }
      });
    }

    itemsBox.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-idx]');
      if (!btn) return;
      var idx = parseInt(btn.getAttribute('data-idx'), 10);
      var cart = getCart();
      if (!cart[idx]) return;
      if (btn.getAttribute('data-inc')) cart[idx].qty = Math.min(99, cart[idx].qty + 1);
      if (btn.getAttribute('data-dec')) cart[idx].qty = Math.max(1, cart[idx].qty - 1);
      if (btn.getAttribute('data-rm')) cart.splice(idx, 1);
      saveCart(cart);
      render();
    });

    // attach global offer to items on submit
    if (form) {
      form.addEventListener('submit', function () {
        var cart = getCart();
        if (itemsField) itemsField.value = JSON.stringify(cartPayload(cart));
      });
    }
    render();

    if (window.location.hash === '#offer') {
      var of = document.getElementById('offer_total');
      if (of) { of.focus(); of.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    }
  }

  // ---- Product search + category filter ----
  function initSearch() {
    var list = document.getElementById('productList');
    if (!list) return;
    var input = document.getElementById('productSearch');
    var chips = document.querySelectorAll('#catChips .cat-chip');
    var noRes = document.getElementById('noResults');
    var activeCat = window.__ACTIVE_CAT__ || '';

    function apply() {
      var q = input ? input.value.toLowerCase().trim() : '';
      var visible = 0;
      list.querySelectorAll('.product-item').forEach(function (it) {
        var okCat = !activeCat || it.dataset.category === activeCat;
        var okText = !q || it.dataset.name.indexOf(q) > -1;
        var show = okCat && okText;
        it.style.display = show ? '' : 'none';
        if (show) {
          visible++;
          it.querySelectorAll('[data-reveal]').forEach(function (r) { r.style.transitionDelay = '0ms'; r.classList.add('is-visible'); });
        }
      });
      if (noRes) noRes.hidden = visible !== 0;
    }

    if (input) input.addEventListener('input', apply);
    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        activeCat = chip.dataset.cat || '';
        chips.forEach(function (c) { c.classList.remove('active'); });
        chip.classList.add('active');
        var url = new URL(window.location);
        if (activeCat) url.searchParams.set('cat', activeCat); else url.searchParams.delete('cat');
        history.replaceState(null, '', url);
        apply();
      });
    });
    apply();
  }

  // ---- Clear cart after confirmation ----
  function initClearCart() {
    if (document.querySelector('[data-clear-cart]')) {
      localStorage.removeItem(CART_KEY);
      updateBadge();
    }
  }

  // ---- Scroll reveal (staggered, respects reduced motion) ----
  function initReveal() {
    var els = document.querySelectorAll('[data-reveal]');
    if (!els.length) return;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }
    function reveal(el, stagger) {
      if (el.classList.contains('is-visible')) return;
      if (stagger) {
        var parent = el.parentElement;
        var sibs = parent ? Array.prototype.filter.call(parent.children, function (c) { return c.hasAttribute('data-reveal'); }) : [el];
        el.style.transitionDelay = Math.min(sibs.indexOf(el), 8) * 70 + 'ms';
      }
      el.classList.add('is-visible');
    }
    function revealInView() {
      var vh = window.innerHeight || document.documentElement.clientHeight;
      els.forEach(function (el) {
        if (el.classList.contains('is-visible')) return;
        var r = el.getBoundingClientRect();
        if (r.top < vh * 0.92 && r.bottom > 0) reveal(el, true);
      });
    }
    var io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        reveal(e.target, true);
        obs.unobserve(e.target);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -4% 0px' });
    els.forEach(function (el) { io.observe(el); });
    revealInView();
    window.addEventListener('scroll', revealInView, { passive: true });
    window.addEventListener('resize', revealInView);
    setTimeout(revealInView, 400);
    setTimeout(revealInView, 1200);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---- Rappel réservation toutes les 4 minutes ----
  function initReservationReminder() {
    var form = document.getElementById('reservationForm');
    var banner = document.getElementById('reserveBanner');
    if (!form || !banner) return;
    var INTERVAL = 4 * 60 * 1000;
    var toast = document.getElementById('reserveToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'reserveToast';
      toast.className = 'reserve-toast';
      toast.setAttribute('role', 'alert');
      toast.innerHTML =
        '<strong>Rappel :</strong> validez votre réservation maintenant — sinon la demande n’est pas envoyée.' +
        '<button type="button" class="reserve-toast-btn">Réserver</button>';
      document.body.appendChild(toast);
      toast.querySelector('.reserve-toast-btn').addEventListener('click', function () {
        toast.classList.remove('is-visible');
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        var name = document.getElementById('customer_name');
        if (name) name.focus();
      });
    }
    function pulse() {
      banner.classList.add('is-pulse');
      toast.classList.add('is-visible');
      setTimeout(function () { banner.classList.remove('is-pulse'); }, 2200);
      setTimeout(function () { toast.classList.remove('is-visible'); }, 12000);
    }
    var focusBtn = document.getElementById('reserveBannerFocus');
    if (focusBtn) {
      focusBtn.addEventListener('click', function () {
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        var name = document.getElementById('customer_name');
        if (name) name.focus();
      });
    }
    setInterval(pulse, INTERVAL);
    // Premier rappel après 4 minutes
    setTimeout(pulse, INTERVAL);
  }

  // ---- Hero video (qualité + reduced motion) ----
  function initHeroVideo() {
    var v = document.querySelector('video.hero-bg--video');
    if (!v) return;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      v.pause();
      v.removeAttribute('autoplay');
      return;
    }
    v.muted = true;
    var play = v.play();
    if (play && play.catch) play.catch(function () { /* autoplay bloqué */ });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initTheme();
    initNav();
    updateBadge();
    initProductPage();
    initCartPage();
    initSearch();
    initClearCart();
    initReveal();
    initHeroVideo();
    initReservationReminder();
  });
})();
