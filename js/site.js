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
  var img = cover
    ? '<img src="' + cover + '" alt="' + twcAttrEscape(p.name) + '" style="width:100%;height:100%;object-fit:cover;object-position:center top;">'
    : '<i class="ti ti-photo" aria-hidden="true"></i>';
  var badge = p.badge ? '<div class="pbadge">' + p.badge + '</div>' : '';
  var was = p.was_price ? '<span class="pwas">' + p.was_price + '</span>' : '';
  return '<div class="pcard" onclick="twcOpenProductPage(\'' + p.slug + '\')">\n'
    + '  <div class="pcard-img" style="position:relative;">' + img + badge + '</div>\n'
    + '  <div class="pcard-info"><div class="pcard-name">' + p.name + '</div><div class="pcard-mat">' + (p.material || '') + '</div>'
    + '<div class="pcard-price"><span class="pnow">' + p.price + '</span>' + was + '</div>'
    + '<button type="button" class="twc-card-addcart" onclick="event.stopPropagation();twcAddToCartBySlug(\'' + p.slug + '\')">Add to Cart</button>'
    + '</div>\n</div>';
}

function twcRenderProductGrids() {
  var home = document.getElementById('prod-grid');
  var shop = document.getElementById('shop-grid');
  if (home) home.innerHTML = TWC_PRODUCTS.slice(0, 6).map(twcBuildPcardHtml).join('\n');
  if (shop) shop.innerHTML = TWC_PRODUCTS.map(twcBuildPcardHtml).join('\n');
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
  if (!p) return;
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
  twcPModalData = { slug: slug, name: p.name, price: priceNum, img: gal[0] };
  twcPModalImgs = gal;
  twcPModalIdx = 0;

  var b = document.getElementById('twcPPBadge');
  b.style.display = p.badge ? 'inline-block' : 'none';
  b.textContent = p.badge || '';
  document.getElementById('twcPPName').textContent = p.name;
  document.getElementById('twcPPCrumbName').textContent = p.name;
  document.getElementById('twcPPMat').textContent = p.material || '';
  document.getElementById('twcPPNow').textContent = p.price;
  var w = document.getElementById('twcPPWas');
  w.textContent = p.was_price || '';
  w.style.display = p.was_price ? 'inline' : 'none';
  document.getElementById('twcPPQty').textContent = '1';
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
  if (!twcPModalData) return;
  var qty = parseInt(document.getElementById('twcPPQty').textContent, 10) || 1;
  twcAddToCart(twcPModalData.slug, twcPModalData.name, twcPModalData.price, twcPModalData.img, qty);
  twcCartPanel(true);
}
function twcBuyNowFromPage() {
  if (!twcPModalData) return;
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
}

/* ── AI Style Advisor: wire its recommendation rules up to the loaded products ── */
function twcWireAiAdvisorProducts() {
  if (typeof window.twcSetAiProducts === 'function') {
    window.twcSetAiProducts(TWC_PRODUCTS);
  }
}

document.addEventListener('DOMContentLoaded', function () {
  twcLoadCart();
  twcLoadProducts();
});
