/**
 * RevenTicket — Analytics & Ads Tracking
 * 
 * Variables de entorno (agregar en Vercel → Environment Variables):
 * VITE_GA4_ID=G-XXXXXXXXXX          (Google Analytics 4)
 * VITE_GTM_ID=GTM-XXXXXXX           (Google Tag Manager)
 * VITE_META_PIXEL_ID=XXXXXXXXXXXXXXX (Meta Pixel)
 */

// ── Google Tag Manager ────────────────────────────────────────────────────────
export function initGTM() {
  const gtmId = import.meta.env.VITE_GTM_ID;
  if (!gtmId) return;

  const script = document.createElement("script");
  script.innerHTML = `
    (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
    new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
    j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
    'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer','${gtmId}');
  `;
  document.head.appendChild(script);
}

// ── Google Analytics 4 ───────────────────────────────────────────────────────
export function initGA4() {
  const gaId = import.meta.env.VITE_GA4_ID;
  if (!gaId) return;

  const script = document.createElement("script");
  script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
  script.async = true;
  document.head.appendChild(script);

  (window as any).dataLayer = (window as any).dataLayer || [];
  (window as any).gtag = function() { (window as any).dataLayer.push(arguments); };
  (window as any).gtag("js", new Date());
  (window as any).gtag("config", gaId, { send_page_view: true });
}

// ── Meta Pixel ────────────────────────────────────────────────────────────────
export function initMetaPixel() {
  const pixelId = import.meta.env.VITE_META_PIXEL_ID;
  if (!pixelId) return;

  const script = document.createElement("script");
  script.innerHTML = `
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
    document,'script','https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '${pixelId}');
    fbq('track', 'PageView');
  `;
  document.head.appendChild(script);
}

// ── Eventos de conversión ─────────────────────────────────────────────────────

/** Llamar cuando el usuario ve un evento */
export function trackViewEvent(eventName: string, eventId: string, price: number) {
  // GA4
  if ((window as any).gtag) {
    (window as any).gtag("event", "view_item", {
      currency: "MXN",
      value: price,
      items: [{ item_id: eventId, item_name: eventName, price }],
    });
  }
  // Meta
  if ((window as any).fbq) {
    (window as any).fbq("track", "ViewContent", {
      content_ids: [eventId],
      content_name: eventName,
      content_type: "product",
      value: price,
      currency: "MXN",
    });
  }
}

/** Llamar cuando el usuario inicia el checkout */
export function trackBeginCheckout(eventName: string, eventId: string, price: number) {
  if ((window as any).gtag) {
    (window as any).gtag("event", "begin_checkout", {
      currency: "MXN",
      value: price,
      items: [{ item_id: eventId, item_name: eventName, price }],
    });
  }
  if ((window as any).fbq) {
    (window as any).fbq("track", "InitiateCheckout", {
      content_ids: [eventId],
      value: price,
      currency: "MXN",
    });
  }
}

/** Llamar cuando se completa una compra */
export function trackPurchase(orderId: string, eventName: string, eventId: string, total: number, paymentMethod: string) {
  if ((window as any).gtag) {
    (window as any).gtag("event", "purchase", {
      transaction_id: orderId,
      value: total,
      currency: "MXN",
      payment_type: paymentMethod,
      items: [{ item_id: eventId, item_name: eventName, price: total }],
    });
  }
  if ((window as any).fbq) {
    (window as any).fbq("track", "Purchase", {
      content_ids: [eventId],
      content_name: eventName,
      value: total,
      currency: "MXN",
      order_id: orderId,
    });
  }
}

/** Llamar cuando el usuario se registra */
export function trackRegistration(method: string) {
  if ((window as any).gtag) {
    (window as any).gtag("event", "sign_up", { method });
  }
  if ((window as any).fbq) {
    (window as any).fbq("track", "CompleteRegistration", { method });
  }
}

/** Llamar cuando el usuario busca */
export function trackSearch(searchTerm: string) {
  if ((window as any).gtag) {
    (window as any).gtag("event", "search", { search_term: searchTerm });
  }
}
