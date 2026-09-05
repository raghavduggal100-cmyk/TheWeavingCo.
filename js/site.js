/* ================================================================
   The Weaving Co. — product data + cart + product page + checkout
   All product data now lives in /content/products.json, edited via
   the /admin CMS (no more embedding product HTML/data into the page).
   ================================================================ */

var TWC_PRODUCTS = [];
var TWC_PLACEHOLDER_IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="750" viewBox="0 0 600 750"><rect width="600" height="750" fill="%230d1d30"/><g fill="none" stroke="%233a4f6a" stroke-width="6"><rect x="150" y="230" width="300" height="230" rx="8"/><circle cx="230" cy="300" r="26"/><path d="M150 430 L260 340 L340 400 L450 300 L450 460 L150 460 Z"/></g></svg>');

function twcAttrEscape(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ── Load products.json, then render every product-dependent part of the page ── */
async function twcLoadProducts() {
  try {
    var res = await fetch('/content/products.json', { cache: 'no-store' });
    var data = await res.json();
    TWC_PRODUCTS = (data && data.products) || [];
  } catch (e) {
    console.error('Could not load products.json', e);
    TWC_PRODUCTS = [];
  }
  twcRenderProductGrids();
  twcWireAiAdvisorProducts();
}

/* ── Product cards (home + shop grids) ── */
function twcBuildPcardHtml(p) {
  var cover = p.photos && p.photos.length ? p.photos[0] : '';
  var inStock = p.in_stock !== false;
  var img = cover
    ? '<img src="' + cover + '" alt="' + twcAttrEscape(p.name) + '" style="width:100%;height:100%;object-fit:cover;object-position:center top;' + (inStock ? '' : 'filter:grayscale(0.6);opacity:0.75;') + '">'
    : '<i class="ti ti-photo" aria-hidden="true"></i>';
  var badge = !inStock
    ? '<div class="pbadge pbadge-oos">Out of stock</div>'
    : (p.badge ? '<div class="pbadge">' + p.badge + '</div>' : '');
  var was = p.was_price ? '<span class="pwas">' + p.was_price + '</span>' : '';
  var cartBtn = inStock
    ? '<button type="button" class="twc-card-addcart" onclick="event.stopPropagation();twcAddToCartBySlug(\'' + p.slug + '\')">Add to Cart</button>'
    : '<button type="button" class="twc-card-addcart" disabled>Out of Stock</button>';
  return '<div class="pcard" onclick="twcOpenProductPage(\'' + p.slug + '\')">\n'
    + '  <div class="pcard-img" style="position:relative;">' + img + badge + '</div>\n'
    + '  <div class="pcard-info"><div class="pcard-name">' + p.name + '</div><div class="pcard-mat">' + (p.material || '') + '</div>'
    + '<div class="pcard-price"><span class="pnow">' + p.price + '</span>' + was + '</div>'
    + cartBtn
    + '</div>\n</div>';
}

var TWC_SHOP_FILTER = 'all';

/* Categories map to product.category exactly. Pashmina/Cashmere are separate
   admin toggles (is_pashmina/is_cashmere) so a product can sit under a main
   category AND also surface under those menu links. 'sale' and 'new' are derived. */
function twcProductsForFilter(key) {
  if (!key || key === 'all') return TWC_PRODUCTS;
  if (key === 'sale') return TWC_PRODUCTS.filter(function (p) { return !!p.was_price; });
  if (key === 'new') return TWC_PRODUCTS.filter(function (p) { return (p.badge || '').toLowerCase().indexOf('new') !== -1; });
  if (key === 'pashmina') return TWC_PRODUCTS.filter(function (p) { return !!p.is_pashmina; });
  if (key === 'cashmere') return TWC_PRODUCTS.filter(function (p) { return !!p.is_cashmere; });
  if (key === 'women' || key === 'men' || key === 'stoles' || key === 'gifts') {
    return TWC_PRODUCTS.filter(function (p) { return p.category === key; });
  }
  var needle = key.toLowerCase();
  return TWC_PRODUCTS.filter(function (p) {
    return ((p.name || '') + ' ' + (p.material || '')).toLowerCase().indexOf(needle) !== -1;
  });
}

function twcRenderProductGrids() {
  var home = document.querySelector('.prod-grid');
  var shop = document.querySelector('.shop-grid');
  if (home) {
    var bestsellers = TWC_PRODUCTS.filter(function (p) { return !!p.is_bestseller; }).slice(0, 16);
    home.innerHTML = bestsellers.length
      ? bestsellers.map(twcBuildPcardHtml).join('\n')
      : '<div style="grid-column:1/-1;text-align:center;padding:40px 0;color:#7a6e5a;font-size:13px;">No bestsellers marked yet \u2014 toggle \u201cShow in Homepage Bestsellers\u201d on a product in the admin portal.</div>';
  }
  if (shop) {
    var list = twcProductsForFilter(TWC_SHOP_FILTER);
    shop.innerHTML = list.length
      ? list.map(twcBuildPcardHtml).join('\n')
      : '<div style="grid-column:1/-1;text-align:center;padding:40px 0;color:#7a6e5a;font-size:13px;">No products in this category yet — check back soon.</div>';
  }
}

/* Shop page filter chips call this directly */
function twcFilterShop(key, chipEl) {
  TWC_SHOP_FILTER = key;
  document.querySelectorAll('.filter-chip').forEach(function (c) { c.classList.remove('active'); });
  if (chipEl) {
    chipEl.classList.add('active');
  } else {
    document.querySelectorAll('.filter-chip').forEach(function (c) {
      if (c.getAttribute('data-filter') === key) c.classList.add('active');
    });
  }
  twcRenderProductGrids();
}

/* Drawer / home category links: go to Shop and pre-apply a category filter */
function twcGoShopFiltered(key) {
  twcCloseAll();
  twcGo('shop', 1);
  twcFilterShop(key, null);
}

/* Generic navigation for standalone pages that have no top-nav button
   (policy pages, track order, account, etc.) — mirrors twcGo() but for twcGo2 */
function twcGoPage(id) {
  twcCloseAll();
  twcGo2(id);
}

/* Wholesale: send to the Contact page with the enquiry type pre-set */
function twcGoWholesale() {
  twcCloseAll();
  twcGo('contact', 4);
  setTimeout(function () {
    var sel = document.querySelector('#page-contact select[aria-label="Enquiry type"]');
    if (sel) sel.value = 'Wholesale';
    var form = document.querySelector('#page-contact .contact-form');
    if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 60);
}

/* Track order: honest lookup — we don't have a live order-status backend yet,
   so we point the customer to the fastest real channel instead of faking a result */
function twcTrackOrder(evt) {
  if (evt) evt.preventDefault();
  var idEl = document.getElementById('twcTrackOrderId');
  var emailEl = document.getElementById('twcTrackOrderEmail');
  var out = document.getElementById('twcTrackOrderResult');
  var orderId = idEl ? idEl.value.trim() : '';
  var email = emailEl ? emailEl.value.trim() : '';
  if (!out) return false;
  if (!orderId || !email) {
    out.innerHTML = '<div class="twc-form-note twc-form-note-error">Please enter both your order ID and the email used at checkout.</div>';
    return false;
  }
  out.innerHTML = '<div class="twc-form-note">Thanks — we\'ve noted order <strong>' + twcAttrEscape(orderId) + '</strong>. '
    + 'For the fastest live update, check the shipping confirmation email sent to <strong>' + twcAttrEscape(email) + '</strong>, '
    + 'or WhatsApp us at <strong>+91 98765 43210</strong> with your order ID and we\'ll reply within a few hours.</div>';
  return false;
}

/* Account page: accounts aren't live yet — collect interest honestly instead of faking a login */
function twcNotifyMe(evt) {
  if (evt) evt.preventDefault();
  var emailEl = document.getElementById('twcNotifyEmail');
  var out = document.getElementById('twcNotifyResult');
  var email = emailEl ? emailEl.value.trim() : '';
  if (!out) return false;
  if (!email || email.indexOf('@') === -1) {
    out.innerHTML = '<div class="twc-form-note twc-form-note-error">Please enter a valid email address.</div>';
    return false;
  }
  out.innerHTML = '<div class="twc-form-note">Thanks! We\'ll email <strong>' + twcAttrEscape(email) + '</strong> the moment accounts launch. In the meantime you can check out as a guest — we\'ll send order updates to your email either way.</div>';
  if (emailEl) emailEl.value = '';
  return false;
}

function twcFindProduct(slug) {
  return TWC_PRODUCTS.find(function (p) { return p.slug === slug; });
}

/* ── Cart ── */
var TWC_CART_KEY = 'twc_cart_v1';
var twcCart = [];

function twcSafeStorageGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
function twcSafeStorageSet(key, val) { try { localStorage.setItem(key, val); } catch (e) {} }

function twcLoadCart() {
  try { twcCart = JSON.parse(twcSafeStorageGet(TWC_CART_KEY) || '[]'); } catch (e) { twcCart = []; }
  twcUpdateCartBadge();
}
function twcSaveCart() {
  twcSafeStorageSet(TWC_CART_KEY, JSON.stringify(twcCart));
  twcUpdateCartBadge();
  twcRenderCartPanel();
}
function twcUpdateCartBadge() {
  var total = twcCart.reduce(function (s, i) { return s + i.qty; }, 0);
  var btn = document.querySelector('.nav-icon[aria-label="Shopping bag"]');
  if (!btn) return;
  var badge = btn.querySelector('.cart-count');
  if (total > 0) {
    if (!badge) { badge = document.createElement('span'); badge.className = 'cart-count'; btn.appendChild(badge); }
    badge.textContent = total;
    badge.style.display = 'flex';
  } else if (badge) { badge.style.display = 'none'; }
}
function twcRenderCartPanel() {
  var panel = document.getElementById('twc-cartp');
  if (!panel) return;
  var body = panel.querySelector('.cart-empty') || panel.querySelector('.twc-cart-body');
  if (!body) return;
  if (!twcCart.length) {
    body.className = 'cart-empty';
    body.removeAttribute('style');
    body.innerHTML = '<i class="ti ti-shopping-bag"></i><p>Your bag is empty</p><button class="btn-royal" onclick="twcGo(\'shop\',1); twcCartPanel(false)">Explore the collection &#8594;</button>';
    return;
  }
  body.className = 'twc-cart-body';
  body.style.cssText = 'flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;';
  var total = 0;
  var itemsHtml = twcCart.map(function (item) {
    total += item.price * item.qty;
    return '<div class="twc-cart-item"><img src="' + item.img + '" alt=""><div class="twc-cart-item-info"><div class="twc-cart-item-name">' + item.name + '</div><div class="twc-cart-item-price">₹' + item.price.toLocaleString('en-IN') + '</div><div class="twc-cart-item-qty"><button onclick="twcCartQtyStep(\'' + item.slug + '\',-1)">&minus;</button><span>' + item.qty + '</span><button onclick="twcCartQtyStep(\'' + item.slug + '\',1)">+</button></div></div><button class="twc-cart-remove" onclick="twcRemoveFromCart(\'' + item.slug + '\')">&#10005;</button></div>';
  }).join('');
  var footer = '<div class="twc-cart-footer"><div class="twc-cart-total"><span>Total</span><span>₹' + total.toLocaleString('en-IN') + '</span></div><button class="twc-cart-checkout" onclick="twcGoToCheckout()">Checkout</button></div>';
  body.innerHTML = itemsHtml + footer;
}
function twcAddToCart(slug, name, price, img, qty) {
  qty = qty || 1;
  var existing = twcCart.find(function (i) { return i.slug === slug; });
  if (existing) { existing.qty += qty; } else { twcCart.push({ slug: slug, name: name, price: price, img: img, qty: qty }); }
  twcSaveCart();
}
function twcAddToCartBySlug(slug) {
  var p = twcFindProduct(slug);
  if (!p || p.in_stock === false) return;
  var priceNum = parseInt((p.price || '').replace(/[^\d]/g, ''), 10) || 0;
  var img = (p.photos && p.photos[0]) || TWC_PLACEHOLDER_IMG;
  twcAddToCart(slug, p.name, priceNum, img, 1);
  twcCartPanel(true);
}
function twcRemoveFromCart(slug) {
  twcCart = twcCart.filter(function (i) { return i.slug !== slug; });
  twcSaveCart();
}
function twcCartQtyStep(slug, delta) {
  var item = twcCart.find(function (i) { return i.slug === slug; });
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) { twcCart = twcCart.filter(function (i) { return i.slug !== slug; }); }
  twcSaveCart();
}

/* ── Checkout page ── */
function twcGoToCheckout() {
  twcCartPanel(false);
  twcRenderCheckoutPage();
  twcGo2('checkout');
}
function twcRenderCheckoutPage() {
  var wrap = document.getElementById('twcCheckoutItems');
  if (!wrap) return;
  if (!twcCart.length) {
    wrap.innerHTML = '<div class="twc-co-empty">Your bag is empty. <span style="color:#bc9961;cursor:pointer;" onclick="twcGo(\'shop\',1)">Browse the collection &#8594;</span></div>';
    document.getElementById('twcCheckoutSubtotal').textContent = '₹0';
    document.getElementById('twcCheckoutTotal').textContent = '₹0';
    return;
  }
  var total = 0;
  wrap.innerHTML = twcCart.map(function (item) {
    total += item.price * item.qty;
    return '<div class="twc-co-line"><img src="' + item.img + '" alt=""><div class="twc-co-line-info"><div class="twc-co-line-name">' + item.name + '</div><div class="twc-co-line-qty">Qty: ' + item.qty + '</div></div><div class="twc-co-line-price">₹' + (item.price * item.qty).toLocaleString('en-IN') + '</div></div>';
  }).join('');
  document.getElementById('twcCheckoutSubtotal').textContent = '₹' + total.toLocaleString('en-IN');
  document.getElementById('twcCheckoutTotal').textContent = '₹' + total.toLocaleString('en-IN');
}

/* ── Payment (Razorpay-ready, falls back to email order request until enabled) ── */
var TWC_PAYMENT_CONFIG = { enabled: false, provider: 'razorpay', keyId: '', fallbackEmail: 'hello@theweavingco.in' };

function twcInitiatePayment() {
  if (!twcCart.length) return;
  var total = twcCart.reduce(function (s, i) { return s + i.price * i.qty; }, 0);
  if (TWC_PAYMENT_CONFIG.enabled && TWC_PAYMENT_CONFIG.keyId) { twcLaunchRazorpay(total); return; }
  var lines = twcCart.map(function (i) { return i.name + ' x' + i.qty + ' — ₹' + (i.price * i.qty).toLocaleString('en-IN'); }).join('%0D%0A');
  var subject = encodeURIComponent('Order request — The Weaving Co.');
  var bodyText = encodeURIComponent('Hi, I would like to place the following order:\r\n\r\n' + decodeURIComponent(lines) + '\r\n\r\nTotal: ₹' + total.toLocaleString('en-IN') + '\r\n\r\nPlease share payment instructions.');
  alert('Online card/UPI payments are being set up. Click OK to email us your order at ' + TWC_PAYMENT_CONFIG.fallbackEmail + ' and we will confirm it manually.');
  window.location.href = 'mailto:' + TWC_PAYMENT_CONFIG.fallbackEmail + '?subject=' + subject + '&body=' + bodyText;
}
function twcLaunchRazorpay(total) {
  function open() {
    var rzp = new window.Razorpay({
      key: TWC_PAYMENT_CONFIG.keyId, amount: total * 100, currency: 'INR', name: 'The Weaving Co.',
      description: 'Order payment',
      handler: function (response) { twcCart = []; twcSaveCart(); alert('Payment successful! Reference: ' + response.razorpay_payment_id); twcGo('home', 0); },
      theme: { color: '#a5844f' }
    });
    rzp.open();
  }
  if (window.Razorpay) { open(); return; }
  var s = document.createElement('script');
  s.src = 'https://checkout.razorpay.com/v1/checkout.js';
  s.onload = open;
  document.head.appendChild(s);
}

/* ── Product detail page ── */
var twcPModalImgs = [];
var twcPModalIdx = 0;
var twcPModalData = null;

var TWC_ACCORDION_SECTIONS = [
  { title: 'Description', body: 'Handwoven and hand-finished by master artisans, each piece takes up to three weeks to complete. Every shawl, stole and pashmina is inspected for quality before it reaches you.' },
  { title: 'Shipping & Delivery', body: 'Free shipping across India, delivered in 4–7 business days. International shipping available at checkout with rates calculated by destination.' },
  { title: 'Returns & Refunds', body: 'Not the right fit? Return it within 7 days of delivery for a full refund, as long as the piece is unused and in its original packaging.' },
  { title: 'About The Weaving Co.', body: 'We work directly with artisan families in Amritsar to bring GI-tagged, Woolmark-certified pashmina, cashmere, and hand-embroidered shawls to the world — fairly priced and made to last.' }
];

function twcOpenProductPage(slug) {
  var p = twcFindProduct(slug);
  if (!p) { console.error('Product not found for slug:', slug); return; }
  var priceNum = parseInt((p.price || '').replace(/[^\d]/g, ''), 10) || 0;
  var gal = (p.photos && p.photos.length) ? p.photos.slice() : [TWC_PLACEHOLDER_IMG];
  var inStock = p.in_stock !== false;
  twcPModalData = { slug: slug, name: p.name, price: priceNum, img: gal[0], inStock: inStock };
  twcTrackViewItem(p, priceNum);
  twcPModalImgs = gal;
  twcPModalIdx = 0;

  var b = document.getElementById('twcPPBadge');
  if (!inStock) {
    b.style.display = 'inline-block';
    b.textContent = 'Out of stock';
    b.classList.add('pbadge-oos');
  } else {
    b.style.display = p.badge ? 'inline-block' : 'none';
    b.textContent = p.badge || '';
    b.classList.remove('pbadge-oos');
  }
  document.getElementById('twcPPName').textContent = p.name;
  document.getElementById('twcPPCrumbName').textContent = p.name;
  document.getElementById('twcPPMat').textContent = p.material || '';
  document.getElementById('twcPPNow').textContent = p.price;
  var w = document.getElementById('twcPPWas');
  w.textContent = p.was_price || '';
  w.style.display = p.was_price ? 'inline' : 'none';
  document.getElementById('twcPPQty').textContent = '1';

  var statusWrap = document.getElementById('twcPPStatus');
  if (statusWrap) {
    statusWrap.innerHTML = inStock
      ? '<div class="twc-pp-status-item"><span class="twc-pp-status-dot"></span> In stock, ready to ship</div><div class="twc-pp-status-item">&#128230; Free shipping across India &middot; 4&ndash;7 business days</div>'
      : '<div class="twc-pp-status-item"><span class="twc-pp-status-dot oos"></span> Currently out of stock</div><div class="twc-pp-status-item">Check back soon, or contact us to be notified when restocked.</div>';
  }
  var addBtn = document.querySelector('.twc-pp-addcart');
  var buyBtn = document.querySelector('.twc-pp-buynow');
  if (addBtn) { addBtn.disabled = !inStock; addBtn.textContent = inStock ? 'Add to Cart' : 'Out of Stock'; }
  if (buyBtn) { buyBtn.disabled = !inStock; buyBtn.textContent = inStock ? 'Buy Now' : 'Out of Stock'; }

  twcShowPModalImg();
  twcRenderAccordion();
  twcGo2('product');
}
function twcShowPModalImg() {
  document.getElementById('twcPPMainImg').src = twcPModalImgs[twcPModalIdx];
  var thumbs = document.getElementById('twcPPThumbs');
  if (twcPModalImgs.length > 1) {
    thumbs.style.display = 'flex';
    thumbs.innerHTML = twcPModalImgs.map(function (src, i) {
      return '<img src="' + src + '" class="' + (i === twcPModalIdx ? 'active' : '') + '" onclick="twcPModalIdx=' + i + ';twcShowPModalImg()">';
    }).join('');
  } else {
    thumbs.style.display = 'none';
    thumbs.innerHTML = '';
  }
}
function twcProductNav(dir) {
  if (twcPModalImgs.length < 2) return;
  twcPModalIdx = (twcPModalIdx + dir + twcPModalImgs.length) % twcPModalImgs.length;
  twcShowPModalImg();
}
function twcOpenZoom() {
  document.getElementById('twcZoomImg').src = twcPModalImgs[twcPModalIdx];
  document.getElementById('twcZoomOverlay').classList.add('open');
}
function twcCloseZoom() { document.getElementById('twcZoomOverlay').classList.remove('open'); }
function twcQtyStep(delta) {
  var el = document.getElementById('twcPPQty');
  var v = parseInt(el.textContent, 10) + delta;
  if (v < 1) v = 1;
  el.textContent = v;
}
function twcAddToCartFromPage() {
  if (!twcPModalData || twcPModalData.inStock === false) return;
  var qty = parseInt(document.getElementById('twcPPQty').textContent, 10) || 1;
  twcAddToCart(twcPModalData.slug, twcPModalData.name, twcPModalData.price, twcPModalData.img, qty);
  twcCartPanel(true);
}
function twcBuyNowFromPage() {
  if (!twcPModalData || twcPModalData.inStock === false) return;
  var qty = parseInt(document.getElementById('twcPPQty').textContent, 10) || 1;
  twcAddToCart(twcPModalData.slug, twcPModalData.name, twcPModalData.price, twcPModalData.img, qty);
  twcGoToCheckout();
}
function twcRenderAccordion() {
  var wrap = document.getElementById('twcPPAccordion');
  wrap.innerHTML = TWC_ACCORDION_SECTIONS.map(function (sec, i) {
    return '<div class="twc-pp-acc-item' + (i === 0 ? ' open' : '') + '"><div class="twc-pp-acc-head" onclick="twcToggleAccordion(this)">' + sec.title + '<span class="car">&#9662;</span></div><div class="twc-pp-acc-body"><div class="twc-pp-acc-body-inner">' + sec.body + '</div></div></div>';
  }).join('');
}
function twcToggleAccordion(headEl) {
  var item = headEl.parentElement;
  var wasOpen = item.classList.contains('open');
  item.parentElement.querySelectorAll('.twc-pp-acc-item').forEach(function (it) { it.classList.remove('open'); });
  if (!wasOpen) item.classList.add('open');
}

/* ── Page navigation for product/checkout (mirrors the site's own showPage) ── */
function twcGo2(id) {
  document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); });
  document.querySelectorAll('.page-btn').forEach(function (b) { b.classList.remove('active'); b.removeAttribute('aria-current'); });
  var page = document.getElementById('page-' + id);
  if (page) { page.classList.add('active'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  twcTrackPageView(id, id);
}

/* ── AI Style Advisor: wire its recommendation rules up to the loaded products ── */
function twcWireAiAdvisorProducts() {
  if (typeof window.twcSetAiProducts === 'function') {
    window.twcSetAiProducts(TWC_PRODUCTS);
  }
}

/* ── Homepage photo gallery (CMS-managed via content/gallery.json) ── */
function twcBuildGalleryImgHtml(item) {
  var cls = item.css_class || '';
  var src = item.photo || TWC_PLACEHOLDER_IMG;
  var alt = twcAttrEscape(item.alt || '');
  return '<div' + (cls ? ' class="' + cls + '"' : '') + '><img src="' + src + '" alt="' + alt + '" loading="lazy"></div>';
}
async function twcLoadGallery() {
  var grid = document.getElementById('twcGalleryGrid');
  if (!grid) return;
  try {
    var res = await fetch('/content/gallery.json', { cache: 'no-store' });
    var data = await res.json();
    var images = (data && data.images) || [];
    grid.innerHTML = images.map(twcBuildGalleryImgHtml).join('\n');
  } catch (e) {
    console.error('Could not load gallery.json', e);
  }
}

/* ── Homepage / About page editable text (CMS-managed via content/site-content.json) ── */
function twcSetText(id, text) {
  var el = document.getElementById(id);
  if (el) el.textContent = text;
}
function twcSetLines(id, line1, line2) {
  var el = document.getElementById(id);
  if (!el) return;
  var l1 = twcAttrEscape(line1 || '');
  var l2 = twcAttrEscape(line2 || '');
  el.innerHTML = l2 ? (l1 + '<br>' + l2) : l1;
}
function twcBuildCatCardHtml(card) {
  return '<div class="cat-card" onclick="twcGoShopFiltered(\'' + (card.filter || '') + '\')" role="button" tabindex="0" aria-label="Shop ' + twcAttrEscape(card.name || '') + '">'
    + '<div class="cat-icon-wrap"><i class="ti ' + (card.icon || 'ti-tag').replace(/^ti-ti-/, 'ti-') + '" aria-hidden="true"></i></div>'
    + '<div class="cat-info"><div class="cat-name">' + twcAttrEscape(card.name || '') + '</div><div class="cat-desc">' + twcAttrEscape(card.desc || '') + '</div></div>'
    + '</div>';
}
function twcBuildStatCardHtml(s) {
  return '<div class="stat-card"><div class="stat-num">' + twcAttrEscape(s.num || '') + '</div><div class="stat-label">' + twcAttrEscape(s.label || '') + '</div></div>';
}
function twcBuildPillHtml(text) {
  return '<span class="cpill">' + twcAttrEscape(text) + '</span>';
}
function twcBuildGiftPillHtml(p) {
  return '<div class="gift-pill"><i class="ti ' + (p.icon || 'ti-star') + '" aria-hidden="true"></i>' + twcAttrEscape(p.label || '') + '</div>';
}
function twcBuildReviewCardHtml(r) {
  var stars = new Array(5).fill('<i class="ti ti-star" aria-hidden="true"></i>').join('');
  return '<div class="rcard"><div class="rcard-stars">' + stars + '</div>'
    + '<div class="rcard-text">"' + twcAttrEscape(r.quote || '') + '"</div>'
    + '<div class="rcard-author">' + twcAttrEscape(r.name || '') + '</div>'
    + '<div class="rcard-loc">' + twcAttrEscape(r.location || '') + '</div></div>';
}
function twcBuildValueCardHtml(v) {
  return '<div class="value-card"><div class="value-title">' + twcAttrEscape(v.title || '') + '</div><div class="value-body">' + twcAttrEscape(v.body || '') + '</div></div>';
}
function twcBuildFaqItemHtml(item) {
  return '<div class="faq-item"><div class="faq-q">' + twcAttrEscape(item.q || '') + '</div><div class="faq-a">' + twcAttrEscape(item.a || '') + '</div></div>';
}
function twcBuildTeamCardHtml(m) {
  return '<div class="team-card"><div class="team-avatar"><i class="ti ' + (m.icon || 'ti-user') + '" aria-hidden="true"></i></div><div class="team-name">' + twcAttrEscape(m.name || '') + '</div><div class="team-role">' + twcAttrEscape(m.role || '') + '</div></div>';
}

async function twcLoadSiteContent() {
  var data;
  try {
    var res = await fetch('/content/site-content.json', { cache: 'no-store' });
    data = await res.json();
  } catch (e) {
    console.error('Could not load site-content.json', e);
    return;
  }
  var home = (data && data.home) || {};
  var about = (data && data.about) || {};

  if (home.hero) {
    twcSetText('tc-hero-eyebrow', home.hero.eyebrow);
    twcSetLines('tc-hero-title', home.hero.title_line1, home.hero.title_line2);
    twcSetText('tc-hero-sub', home.hero.sub);
    var c1 = document.getElementById('tc-hero-cta1'); if (c1 && home.hero.cta_primary) c1.textContent = home.hero.cta_primary + ' →';
    var c2 = document.getElementById('tc-hero-cta2'); if (c2 && home.hero.cta_secondary) c2.textContent = home.hero.cta_secondary + ' →';
  }
  twcSetText('tc-brand-tagline', home.brand_tagline);

  if (home.story) {
    twcSetText('tc-story-label', home.story.label);
    twcSetLines('tc-story-title', home.story.title_line1, home.story.title_line2);
    twcSetText('tc-story-body', home.story.body);
    var statsEl = document.getElementById('tc-story-stats');
    if (statsEl && home.story.stats) statsEl.innerHTML = home.story.stats.map(twcBuildStatCardHtml).join('');
  }

  if (home.categories) {
    twcSetText('tc-cat-eyebrow', home.categories.eyebrow);
    twcSetText('tc-cat-heading', home.categories.heading);
    twcSetText('tc-cat-sub', home.categories.sub);
    var catGrid = document.getElementById('tc-cat-grid');
    if (catGrid && home.categories.cards) catGrid.innerHTML = home.categories.cards.map(twcBuildCatCardHtml).join('');
  }

  if (home.bestsellers) {
    twcSetText('tc-prod-eyebrow', home.bestsellers.eyebrow);
    twcSetText('tc-prod-heading', home.bestsellers.heading);
    twcSetText('tc-prod-sub', home.bestsellers.sub);
  }

  if (home.craft) {
    twcSetText('tc-craft-label', home.craft.label);
    twcSetLines('tc-craft-title', home.craft.title_line1, home.craft.title_line2);
    twcSetText('tc-craft-body', home.craft.body);
    var pillsEl = document.getElementById('tc-craft-pills');
    if (pillsEl && home.craft.pills) pillsEl.innerHTML = home.craft.pills.map(twcBuildPillHtml).join('');
    var linkEl = document.getElementById('tc-craft-link'); if (linkEl && home.craft.link_text) linkEl.textContent = home.craft.link_text + ' →';
  }

  if (home.ai_advisor) {
    twcSetText('tc-ai-eyebrow', home.ai_advisor.eyebrow);
    twcSetText('tc-ai-heading', home.ai_advisor.heading);
    twcSetText('tc-ai-sub', home.ai_advisor.sub);
  }

  if (home.reviews) {
    twcSetText('tc-reviews-eyebrow', home.reviews.eyebrow);
    twcSetText('tc-reviews-heading', home.reviews.heading);
    twcSetText('tc-reviews-sub', home.reviews.sub);
    var revGrid = document.getElementById('tc-reviews-grid');
    if (revGrid && home.reviews.items) revGrid.innerHTML = home.reviews.items.map(twcBuildReviewCardHtml).join('');
  }

  if (home.gifting) {
    twcSetText('tc-gift-eyebrow', home.gifting.eyebrow);
    twcSetText('tc-gift-heading', home.gifting.heading);
    twcSetText('tc-gift-sub', home.gifting.sub);
    var giftGrid = document.getElementById('tc-gift-grid');
    if (giftGrid && home.gifting.pills) giftGrid.innerHTML = home.gifting.pills.map(twcBuildGiftPillHtml).join('');
  }

  if (home.gallery_section) {
    twcSetText('tc-gallery-eyebrow', home.gallery_section.eyebrow);
    twcSetText('tc-gallery-heading', home.gallery_section.heading);
    twcSetText('tc-gallery-sub', home.gallery_section.sub);
  }

  if (home.newsletter) {
    twcSetText('tc-nl-eyebrow', home.newsletter.eyebrow);
    twcSetText('tc-nl-heading', home.newsletter.heading);
    twcSetText('tc-nl-sub', home.newsletter.sub);
    var nlBtn = document.getElementById('tc-nl-cta'); if (nlBtn && home.newsletter.cta) nlBtn.textContent = home.newsletter.cta + ' →';
    twcSetText('tc-nl-note', home.newsletter.note);
  }

  if (about.hero) {
    twcSetText('tc-about-hero-label', about.hero.label);
    twcSetLines('tc-about-hero-title', about.hero.title_line1, about.hero.title_line2);
    twcSetText('tc-about-hero-sub', about.hero.sub);
  }
  if (about.story) {
    twcSetText('tc-about-story-title', about.story.title);
    twcSetText('tc-about-story-p1', about.story.paragraph1);
    twcSetText('tc-about-story-p2', about.story.paragraph2);
  }
  if (about.values) {
    twcSetText('tc-about-values-title', about.values.title);
    twcSetText('tc-about-values-sub', about.values.sub);
    var valGrid = document.getElementById('tc-about-values-grid');
    if (valGrid && about.values.items) valGrid.innerHTML = about.values.items.map(twcBuildValueCardHtml).join('');
  }
  if (about.team) {
    twcSetText('tc-about-team-title', about.team.title);
    twcSetText('tc-about-team-sub', about.team.sub);
    var teamGrid = document.getElementById('tc-about-team-grid');
    if (teamGrid && about.team.members) teamGrid.innerHTML = about.team.members.map(twcBuildTeamCardHtml).join('');
  }

  var contact = (data && data.contact) || {};
  if (contact.hero) {
    twcSetText('tc-contact-hero-label', contact.hero.label);
    twcSetText('tc-contact-hero-title', contact.hero.title);
    twcSetText('tc-contact-hero-sub', contact.hero.sub);
  }
  twcSetText('tc-contact-email', contact.email);
  var waEl = document.getElementById('tc-contact-whatsapp');
  if (waEl) waEl.textContent = [contact.whatsapp_number, contact.whatsapp_hours].filter(Boolean).join(' · ');
  twcSetText('tc-contact-office', contact.office_location);
  twcSetText('tc-contact-wholesale', contact.wholesale_email);
  var faqWrap = document.getElementById('tc-contact-faqs');
  if (faqWrap && contact.faqs) faqWrap.innerHTML = contact.faqs.map(twcBuildFaqItemHtml).join('');
}

/* ── Analytics (Google Analytics 4) + cookie consent ──
   HOW TO TURN THIS ON:
   1. Create a free Google Analytics 4 property at analytics.google.com and copy your
      Measurement ID (looks like "G-XXXXXXXX").
   2. Paste it into TWC_ANALYTICS_CONFIG.measurementId below and set enabled: true.
   That's it — the cookie banner and tracking below will start working automatically.
   Nothing is loaded or tracked until this is turned on and a visitor accepts cookies. */
var TWC_ANALYTICS_CONFIG = { enabled: false, measurementId: '' };
var TWC_COOKIE_CONSENT_KEY = 'twc_cookie_consent';

function twcAnalyticsReady() {
  return TWC_ANALYTICS_CONFIG.enabled && !!TWC_ANALYTICS_CONFIG.measurementId && typeof window.gtag === 'function';
}

function twcInitAnalytics() {
  if (!TWC_ANALYTICS_CONFIG.enabled || !TWC_ANALYTICS_CONFIG.measurementId) return;
  if (document.getElementById('twc-ga4-script')) return; // already loaded
  var s = document.createElement('script');
  s.id = 'twc-ga4-script';
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(TWC_ANALYTICS_CONFIG.measurementId);
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  // anonymize_ip keeps only approximate (city/region) location, never a precise address
  window.gtag('config', TWC_ANALYTICS_CONFIG.measurementId, { anonymize_ip: true });
}

function twcShowCookieBanner() {
  var b = document.getElementById('twc-cookie-banner');
  if (b) b.classList.add('open');
}
function twcHideCookieBanner() {
  var b = document.getElementById('twc-cookie-banner');
  if (b) b.classList.remove('open');
}
function twcCookieConsent(accepted) {
  twcSafeStorageSet(TWC_COOKIE_CONSENT_KEY, accepted ? 'accepted' : 'declined');
  twcHideCookieBanner();
  if (accepted) twcInitAnalytics();
}
function twcInitCookieConsent() {
  if (!TWC_ANALYTICS_CONFIG.enabled || !TWC_ANALYTICS_CONFIG.measurementId) return; // nothing to ask consent for yet
  var choice = twcSafeStorageGet(TWC_COOKIE_CONSENT_KEY);
  if (choice === 'accepted') { twcInitAnalytics(); return; }
  if (choice === 'declined') return;
  twcShowCookieBanner();
}

/* Fires a virtual pageview whenever a visitor switches between site sections (Shop, About,
   product pages, etc.) — the site is a single HTML page, so without this GA would only ever
   see one pageview no matter how much someone browses. */
function twcTrackPageView(pagePath, pageTitle) {
  if (!twcAnalyticsReady()) return;
  window.gtag('event', 'page_view', {
    page_path: '/' + (pagePath || ''),
    page_title: pageTitle || document.title
  });
}
/* Fires when a visitor opens a product's detail page, so Bestsellers/traffic reports show
   which specific products people are actually looking at. */
function twcTrackViewItem(product, priceNum) {
  if (!twcAnalyticsReady()) return;
  window.gtag('event', 'view_item', {
    currency: 'INR',
    value: priceNum || 0,
    items: [{ item_id: product.slug, item_name: product.name, item_category: product.category || '', price: priceNum || 0 }]
  });
}

/* ── Hero slideshow (CMS-managed slides + text) ──
   The drag/swipe/autoplay behaviour below is copied over unchanged from the
   original inline version — only *when* it runs changed (now after the CMS
   slide data has been fetched and rendered), not *how* it behaves. */
function twcBuildHeroSlideHtml(slide, i) {
  var activeClass = i === 0 ? ' active' : '';
  if (slide.type === 'video') {
    return '<div class="ths-slide' + activeClass + '"><video class="ths-slide-video" src="' + slide.src + '" autoplay muted loop playsinline></video></div>';
  }
  return '<div class="ths-slide' + activeClass + '" style="background-image:url(\'' + slide.src + '\')"></div>';
}
function twcBuildHeroDotHtml(i) {
  return '<button class="ths-dot' + (i === 0 ? ' active' : '') + '" onclick="thsGoTo(' + i + ')" aria-label="Slide ' + (i + 1) + '"></button>';
}

function twcSetupHeroCarousel() {
  var wrap = document.getElementById('heroSlides');
  var track = document.getElementById('thsTrack');
  if (!wrap || !track) return;
  var slides = track.querySelectorAll('.ths-slide');
  var dots = document.querySelectorAll('#heroSlides .ths-dot');
  var n = slides.length;
  if (!n) return;
  var idx = 0, timer, wrapWidth = 0, dragging = false, startX = 0, dragDelta = 0, activePointerId = null;

  function measure() { wrapWidth = wrap.getBoundingClientRect().width || 1; }
  function applyTransform(px) { track.style.transform = 'translateX(' + px + 'px)'; }
  function baseOffsetFor(i) { return -i * wrapWidth; }
  function show(i) {
    idx = ((i % n) + n) % n;
    track.classList.remove('ths-nodrag-transition');
    applyTransform(baseOffsetFor(idx));
    dots.forEach(function (d, j) { d.classList.toggle('active', j === idx); });
  }
  function next() { show(idx + 1); }
  function restart() { clearInterval(timer); timer = setInterval(next, 4500); }
  window.thsGoTo = function (i) { show(i); restart(); };

  function pointX(e) { return e.touches ? e.touches[0].clientX : e.clientX; }

  function onDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    if (e.pointerType === 'mouse') e.preventDefault();
    dragging = true;
    activePointerId = e.pointerId;
    measure();
    startX = pointX(e);
    dragDelta = 0;
    track.classList.add('ths-nodrag-transition');
    clearInterval(timer);
    wrap.classList.add('ths-grabbing');
    if (wrap.setPointerCapture && e.pointerId != null) {
      try { wrap.setPointerCapture(e.pointerId); } catch (err) {}
    }
  }
  function onMove(e) {
    if (!dragging) return;
    dragDelta = pointX(e) - startX;
    applyTransform(baseOffsetFor(idx) + dragDelta);
  }
  function onUp() {
    if (!dragging) return;
    dragging = false;
    wrap.classList.remove('ths-grabbing');
    var threshold = Math.min(60, wrapWidth * 0.12);
    if (dragDelta > threshold) show(idx - 1);
    else if (dragDelta < -threshold) show(idx + 1);
    else show(idx);
    restart();
  }

  wrap.addEventListener('pointerdown', onDown);
  wrap.addEventListener('pointermove', onMove);
  wrap.addEventListener('pointerup', onUp);
  wrap.addEventListener('pointercancel', onUp);
  wrap.addEventListener('pointerleave', function (e) { if (dragging && e.pointerId === activePointerId) onUp(); });
  wrap.addEventListener('dragstart', function (e) { e.preventDefault(); });
  window.addEventListener('resize', function () { measure(); track.classList.add('ths-nodrag-transition'); applyTransform(baseOffsetFor(idx)); });

  measure();
  show(0);
  restart();
}

async function twcLoadHeroSlides() {
  var track = document.getElementById('thsTrack');
  var dotsWrap = document.getElementById('thsDots');
  if (!track || !dotsWrap) return;
  var data;
  try {
    var res = await fetch('/content/hero-slides.json', { cache: 'no-store' });
    data = await res.json();
  } catch (e) {
    console.error('Could not load hero-slides.json', e);
    return;
  }
  twcSetText('tc-hs-eyebrow', data.eyebrow);
  twcSetLines('tc-hs-title', data.title_line1, data.title_line2);
  twcSetText('tc-hs-sub', data.sub);
  var ctaBtn = document.getElementById('tc-hs-cta');
  if (ctaBtn && data.cta) ctaBtn.textContent = data.cta + ' →';

  var slides = data.slides || [];
  if (!slides.length) return;
  track.innerHTML = slides.map(twcBuildHeroSlideHtml).join('');
  dotsWrap.innerHTML = slides.map(function (s, i) { return twcBuildHeroDotHtml(i); }).join('');
  twcSetupHeroCarousel();
}

document.addEventListener('DOMContentLoaded', function () {
  twcLoadCart();
  twcLoadProducts();
  twcLoadGallery();
  twcLoadSiteContent();
  twcLoadHeroSlides();
  twcInitCookieConsent();
});
