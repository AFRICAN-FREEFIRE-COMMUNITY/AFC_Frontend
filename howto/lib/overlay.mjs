// howto/lib/overlay.mjs - what the how-to clips draw ON TOP of the real site while recording.
//
// Injected into every page the recorder opens (render.mjs, page.evaluateOnNewDocument), so it
// survives navigations. It draws three things and nothing else:
//   - a cursor (desktop) that travels to the element about to be pressed
//   - a flat click mark: a solid translucent dot that fades, no blur, no glow (house design ban)
//   - caption cards: FILLED cards in the site's own font (DM Sans, read off <body>), a step number,
//     a small filled pointer toward the part explained, no border or ring anywhere
// Everything lives in one fixed layer with pointer-events: none, so it never catches a click meant
// for the page. The caption TEXT is not here: render.mjs reads it from messages/<lang>/howto.json.
//
// Colours are the site's own tokens (app/globals.css): --primary green for the card, the dark
// background tone for the number disc. Called only through window.__howto.* by render.mjs.
export function installOverlay() {
  if (window.__howto) return;
  const Z = 2147483000;
  let layer = null;
  let cursor = null;
  let card = null;
  let scrim = null;
  const state = { x: -40, y: -40, touch: false };

  function root() {
    if (layer && document.documentElement.contains(layer)) return layer;
    layer = document.createElement("div");
    layer.setAttribute("data-howto-layer", "");
    layer.setAttribute("aria-hidden", "true");
    Object.assign(layer.style, {
      position: "fixed", inset: "0", zIndex: String(Z), pointerEvents: "none",
    });
    const style = document.createElement("style");
    style.textContent = `
      nextjs-portal, [data-nextjs-toast], [data-next-badge-root] { display: none !important; }
      [data-howto-layer] * { box-sizing: border-box; }
      [data-howto-card] {
        position: fixed; max-width: min(420px, calc(100vw - 32px)); padding: 12px 16px 12px 12px;
        display: flex; align-items: center; gap: 12px; border-radius: 12px;
        background: oklch(0.624 0.170 149.09); color: oklch(0.141 0.005 285.823);
        font-weight: 700; font-size: 18px; line-height: 1.25; letter-spacing: -0.005em;
        box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
        transition: opacity 160ms ease-out, transform 160ms ease-out;
      }
      [data-howto-card][data-small] { font-size: 16px; padding: 10px 14px 10px 10px; }
      [data-howto-card] b {
        flex: none; display: grid; place-items: center; width: 30px; height: 30px; border-radius: 999px;
        background: oklch(0.141 0.005 285.823); color: oklch(0.624 0.170 149.09); font-size: 15px;
      }
      [data-howto-card] i {
        position: absolute; width: 14px; height: 14px; background: inherit; transform: rotate(45deg);
        border-radius: 2px;
      }
      [data-howto-scrim] { position: fixed; inset: 0; background: rgba(9, 9, 11, 0.72);
        transition: opacity 200ms ease-out; }
      [data-howto-dot] { position: fixed; width: 34px; height: 34px; margin: -17px 0 0 -17px;
        border-radius: 999px; background: oklch(0.624 0.170 149.09); opacity: 0.55;
        transition: transform 380ms ease-out, opacity 380ms ease-out; }
    `;
    layer.appendChild(style);
    document.documentElement.appendChild(layer);
    cursor = null;
    card = null;
    scrim = null;
    return layer;
  }

  function font() {
    return getComputedStyle(document.body || document.documentElement).fontFamily;
  }

  function drawCursor() {
    if (state.touch) return;
    root();
    if (!cursor || !layer.contains(cursor)) {
      cursor = document.createElement("div");
      // A plain arrow: white fill, a dark edge so it reads on the light and the dark parts of the page.
      cursor.innerHTML =
        '<svg width="26" height="26" viewBox="0 0 26 26"><path d="M4 2 L4 21 L9 16.5 L12.6 24 L16 22.4 L12.4 15 L19 15 Z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>';
      Object.assign(cursor.style, { position: "fixed", left: "0", top: "0", width: "26px", height: "26px",
        transform: `translate(${state.x - 4}px, ${state.y - 2}px)`, willChange: "transform" });
      layer.appendChild(cursor);
    }
    cursor.style.transform = `translate(${state.x - 4}px, ${state.y - 2}px)`;
  }

  function moveTo(x, y, ms) {
    root();
    if (state.touch) {
      state.x = x;
      state.y = y;
      return Promise.resolve();
    }
    drawCursor();
    const x0 = state.x, y0 = state.y;
    const t0 = performance.now();
    const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    return new Promise((resolve) => {
      function step(now) {
        const t = Math.min(1, (now - t0) / Math.max(1, ms));
        state.x = x0 + (x - x0) * ease(t);
        state.y = y0 + (y - y0) * ease(t);
        drawCursor();
        if (t < 1) requestAnimationFrame(step);
        else resolve();
      }
      requestAnimationFrame(step);
    });
  }

  function mark(x, y) {
    root();
    const dot = document.createElement("div");
    dot.setAttribute("data-howto-dot", "");
    dot.style.left = `${x}px`;
    dot.style.top = `${y}px`;
    dot.style.transform = "scale(0.5)";
    layer.appendChild(dot);
    requestAnimationFrame(() => {
      dot.style.transform = "scale(1.15)";
      dot.style.opacity = "0";
    });
    setTimeout(() => dot.remove(), 450);
    if (cursor) layer.appendChild(cursor); // keep the cursor above the mark
  }

  // A caption card. `rect` is the part being explained (null = centred, e.g. a step that happens
  // somewhere we do not show). The card sits BESIDE the part on a wide screen (opts.place "auto"),
  // else ABOVE it when there is room, else below, so it
  // never covers the fields and the button the next action needs (first recording: a card under
  // the code boxes hid the Confirm button). opts.place = "below" flips the preference. A small
  // filled pointer aims at the part.
  function caption(n, text, rect, opts = {}) {
    root();
    clearCaption();
    if (opts.scrim) {
      scrim = document.createElement("div");
      scrim.setAttribute("data-howto-scrim", "");
      layer.appendChild(scrim);
    }
    card = document.createElement("div");
    card.setAttribute("data-howto-card", "");
    if (window.innerWidth < 600) card.setAttribute("data-small", "");
    card.style.fontFamily = font();
    const num = document.createElement("b");
    num.textContent = String(n);
    const span = document.createElement("span");
    span.textContent = text;
    card.append(num, span);
    card.style.opacity = "0";
    layer.appendChild(card);
    const vw = window.innerWidth, vh = window.innerHeight, gap = 14, m = 16;
    const w = card.offsetWidth;
    let h = card.offsetHeight;
    let left, top, pointer = null;
    if (!rect) {
      left = (vw - w) / 2;
      top = (vh - h) / 2;
    } else {
      // Beside the part first, on a screen wide enough to have room beside it: above, the card
      // covered the page's own title on the sign-up form (desktop review of the ninth recording).
      // A card may wrap to two lines to fit beside the part (at least 260px wide): the sign-up
      // form leaves about 350px to its right at 1440, less than the one-line card needs.
      const besideWidth = vw - m - (rect.right + gap);
      const roomRight = vw >= 900 && besideWidth >= Math.min(w, 260);
      const roomAbove = rect.top - gap - h >= m;
      const roomBelow = rect.bottom + gap + h + m <= vh;
      const cy = rect.top + rect.height / 2;
      if (opts.place === "auto" && roomRight) {
        if (w > besideWidth) {
          card.style.maxWidth = `${Math.floor(besideWidth)}px`;
          h = card.offsetHeight;
        }
        left = rect.right + gap;
        top = Math.min(vh - h - m, Math.max(m, cy - h / 2));
        pointer = { side: "left", y: Math.min(h - 20, Math.max(6, cy - top - 7)) };
      } else {
        const below = opts.place === "below" ? roomBelow || !roomAbove : !roomAbove && roomBelow;
        top = below ? rect.bottom + gap : Math.max(m, rect.top - gap - h);
        const cx = rect.left + rect.width / 2;
        left = Math.min(vw - w - m, Math.max(m, cx - w / 2));
        pointer = { side: below ? "top" : "bottom", x: Math.min(w - 22, Math.max(14, cx - left - 7)) };
      }
    }
    card.style.left = `${Math.round(left)}px`;
    card.style.top = `${Math.round(top)}px`;
    if (pointer) {
      const tip = document.createElement("i");
      if (pointer.side === "left") {
        tip.style.top = `${pointer.y}px`;
        tip.style.left = "-6px";
      } else {
        tip.style.left = `${pointer.x}px`;
        tip.style[pointer.side] = "-6px";
      }
      card.appendChild(tip);
    }
    card.style.transform = "translateY(4px)";
    requestAnimationFrame(() => {
      card.style.opacity = "1";
      card.style.transform = "translateY(0)";
    });
    if (cursor) layer.appendChild(cursor);
  }

  function clearCaption() {
    if (card) card.remove();
    if (scrim) scrim.remove();
    card = null;
    scrim = null;
  }

  window.__howto = {
    setTouch(v) { state.touch = !!v; },
    place(x, y) { state.x = x; state.y = y; drawCursor(); },
    moveTo,
    mark,
    caption,
    clearCaption,
    where() { return { x: state.x, y: state.y }; },
  };
  const ready = () => root();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready);
  else ready();
}
