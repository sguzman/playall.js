// ==UserScript==
// @name         YouTube Play All Channel Videos (v1.4 – externalId Fix)
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  Adds a “▶ Play All” button on any YouTube channel page. Now checks metadata.channelMetadataRenderer.externalId.
// @match        https://www.youtube.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
  'use strict';
  console.log('[PlayAll] Script start on', location.href);

  let currentChannelId = null;
  let btn = null;

  // --- Hook into YouTube SPA navigation ---
  ['pushState','replaceState'].forEach(fn => {
    const orig = history[fn];
    history[fn] = function() {
      const ret = orig.apply(this, arguments);
      window.dispatchEvent(new Event('locationchange'));
      return ret;
    };
  });
  window.addEventListener('popstate', () => window.dispatchEvent(new Event('locationchange')));
  window.addEventListener('locationchange', init);

  // --- Initial run ---
  init();

  function init() {
    console.log('[PlayAll] Running init()');
    const id = getChannelId();
    if (id) {
      if (id !== currentChannelId) {
        console.log('[PlayAll] ✅ New channelId detected:', id);
        currentChannelId = id;
        injectButton(id);
      }
    } else {
      console.log('[PlayAll] ❌ No channelId found; removing button if present.');
      currentChannelId = null;
      removeButton();
    }
  }

  function getChannelId() {
    // 1) meta[itemprop="channelId"]
    console.log('[PlayAll] → Checking <meta itemprop="channelId">');
    const meta = document.querySelector('meta[itemprop="channelId"]');
    if (meta?.content) {
      console.log('[PlayAll]    • meta channelId =', meta.content);
      return meta.content;
    }
    console.log('[PlayAll]    • not found');

    // 2) window.ytcfg.get("CHANNEL_ID")
    console.log('[PlayAll] → Checking ytcfg.get("CHANNEL_ID")');
    if (window.ytcfg?.get) {
      const cfg = window.ytcfg.get('CHANNEL_ID');
      console.log('[PlayAll]    • ytcfg CHANNEL_ID =', cfg);
      if (cfg) return cfg;
    } else {
      console.log('[PlayAll]    • ytcfg not available');
    }

    // 3) ytInitialData.metadata.channelMetadataRenderer.externalId
    console.log('[PlayAll] → Checking ytInitialData.metadata.channelMetadataRenderer.externalId');
    const mdr = window.ytInitialData?.metadata?.channelMetadataRenderer;
    if (mdr?.externalId) {
      console.log('[PlayAll]    • externalId =', mdr.externalId);
      return mdr.externalId;
    } else {
      console.log('[PlayAll]    • externalId not present');
    }

    // 4) legacy externalChannelId (just in case)
    console.log('[PlayAll] → Checking ytInitialData.metadata.channelMetadataRenderer.externalChannelId');
    if (mdr?.externalChannelId) {
      console.log('[PlayAll]    • externalChannelId =', mdr.externalChannelId);
      return mdr.externalChannelId;
    } else {
      console.log('[PlayAll]    • externalChannelId not present');
    }

    // 5) header.c4TabbedHeaderRenderer.channelId
    console.log('[PlayAll] → Checking ytInitialData.header.c4TabbedHeaderRenderer.channelId');
    const hdr = window.ytInitialData?.header?.c4TabbedHeaderRenderer;
    if (hdr?.channelId) {
      console.log('[PlayAll]    • header channelId =', hdr.channelId);
      return hdr.channelId;
    } else {
      console.log('[PlayAll]    • not present');
    }

    // 6) JSON-LD <script> tags
    console.log('[PlayAll] → Scanning JSON-LD <script> tags');
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const obj = JSON.parse(s.textContent);
        if (obj['@type'] === 'Person' && obj.mainEntityOfPage?.['@id']) {
          const m = obj.mainEntityOfPage['@id'].match(/channel\/([A-Za-z0-9_-]+)/);
          if (m) {
            console.log('[PlayAll]    • JSON-LD channel ID =', m[1]);
            return m[1];
          }
        }
      } catch(e) {
        console.log('[PlayAll]    • JSON-LD parse error', e);
      }
    }
    console.log('[PlayAll]    • no JSON-LD match');

    // 7) anchor link lookup
    console.log('[PlayAll] → Scanning <a> for "/channel/"');
    const anchor = document.querySelector('a[href*="/channel/"]');
    if (anchor?.href) {
      const m = anchor.href.match(/\/channel\/([A-Za-z0-9_-]+)/);
      if (m) {
        console.log('[PlayAll]    • anchor href channel ID =', m[1]);
        return m[1];
      }
    }
    console.log('[PlayAll]    • no anchor match');

    // 8) URL path fallback
    console.log('[PlayAll] → Fallback: URL path /channel/ID');
    const parts = location.pathname.split('/');
    const idx = parts.indexOf('channel');
    if (idx !== -1 && parts[idx+1]) {
      console.log('[PlayAll]    • URL path channelId =', parts[idx+1]);
      return parts[idx+1];
    }
    console.log('[PlayAll]    • URL fallback not applicable');

    // nothing found
    return null;
  }

  function injectButton(channelId) {
    removeButton();
    btn = document.createElement('button');
    btn.id = 'yt-play-all-btn';
    btn.textContent = '▶ Play All';
    Object.assign(btn.style, {
      position: 'fixed',
      top: '120px',
      right: '20px',
      padding: '10px 16px',
      backgroundColor: '#FF0000',
      color: '#FFF',
      border: 'none',
      borderRadius: '4px',
      fontSize: '14px',
      cursor: 'pointer',
      zIndex: 9999,
      boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
    });
    btn.addEventListener('click', () => {
      console.log('[PlayAll] ▶ Button clicked');
      const uploads = channelId.replace(/^UC/, 'UU');
      const url = `https://www.youtube.com/playlist?list=${uploads}`;
      console.log('[PlayAll] ↗ Redirecting to:', url);
      window.location.href = url;
    });
    document.body.appendChild(btn);
    console.log('[PlayAll] ✅ Button injected');
  }

  function removeButton() {
    const e = document.getElementById('yt-play-all-btn');
    if (e) {
      e.remove();
      console.log('[PlayAll] 🗑️ Button removed');
    }
    btn = null;
  }
})();
