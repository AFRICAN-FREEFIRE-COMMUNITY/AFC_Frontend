"use client";

/**
 * app/(user)/awards/_kol/KolMotion.tsx - the arrival motion of the KOL Awards pages.
 *
 * Motion here is ARRIVAL only: a title is slapped on letter by letter, a block rises into place the
 * first time it scrolls into view. Nothing loops, nothing pulses, nothing glows (WEBSITE/CLAUDE.md).
 * Under prefers-reduced-motion every one of these renders its plain content with no animation at all.
 *
 * Built on framer-motion (already in the bundle) instead of the mockup's GSAP, so the route adds no
 * animation library. Used by KolLanding, KolAward and KolNominee.
 */
import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

// A fixed spread instead of Math.random(): the server render and the browser must agree on every
// style, or React reports a hydration mismatch on each letter of each title.
const tilt = (i: number) => ((i * 37) % 33) - 16;

type Chars = { n: number };

/** Walk a React node, wrapping every character of every text node in an animated span. */
function splitNode(node: ReactNode, counter: Chars, once: boolean, base: number, inView: boolean): ReactNode {
  if (typeof node === "string") {
    return node.split(/(\s+)/).map((word, wi) => {
      if (!word) return null;
      if (/^\s+$/.test(word)) return word;
      return (
        <span key={`w${wi}`} className="word">
          {[...word].map((ch) => {
            const i = counter.n++;
            const target = { opacity: 1, scale: 1, y: 0, rotate: 0 };
            return (
              <motion.span
                key={i}
                className="ch"
                initial={{ opacity: 0, scale: 1.9, y: -18, rotate: tilt(i) }}
                {...(inView
                  ? { whileInView: target, viewport: { once, margin: "0px 0px -15% 0px" } }
                  : { animate: target })}
                transition={{ type: "spring", stiffness: 380, damping: 17, delay: base + i * 0.035 }}
              >
                {ch}
              </motion.span>
            );
          })}
        </span>
      );
    });
  }
  if (Array.isArray(node)) return node.map((c, i) => <span key={i} style={{ display: "contents" }}>{splitNode(c, counter, once, base, inView)}</span>);
  if (isValidElement(node)) {
    const el = node as ReactElement<{ children?: ReactNode }>;
    return cloneElement(el, undefined, ...Children.toArray(el.props.children).map((c) => splitNode(c, counter, once, base, inView)));
  }
  return node;
}

/**
 * A title whose letters land one after another. `inView` waits for the title to scroll into view
 * (every title below the fold); without it the title plays on load (the hero and page headers).
 * The accessible name is the plain text, because the per-letter spans would read out letter by letter.
 */
export function SplitTitle({
  as: Tag = "h2",
  className,
  children,
  label,
  inView = false,
  delay = 0,
  style,
}: {
  as?: "h1" | "h2";
  className?: string;
  children: ReactNode;
  /** Plain-text name for assistive tech. */
  label: string;
  inView?: boolean;
  delay?: number;
  style?: React.CSSProperties;
}) {
  const reduce = useReducedMotion();
  if (reduce) {
    return (
      <Tag className={className} style={style}>
        {children}
      </Tag>
    );
  }
  return (
    <Tag className={className} style={style} aria-label={label}>
      <span aria-hidden="true" style={{ display: "contents" }}>
        {splitNode(children, { n: 0 }, true, delay, inView)}
      </span>
    </Tag>
  );
}

type Kind = "rise" | "pop" | "sticker" | "stamp" | "drop" | "slide-l" | "slide-r";

const FROM: Record<Kind, Record<string, number>> = {
  rise: { opacity: 0, y: 30 },
  pop: { opacity: 0, scale: 0.6, rotate: -10 },
  sticker: { opacity: 0, scale: 2.2, rotate: 40 },
  stamp: { opacity: 0, scale: 1.12, y: 40 },
  drop: { opacity: 0, y: -24 },
  "slide-l": { opacity: 0, x: -80 },
  "slide-r": { opacity: 0, x: 80 },
};

/** A block that arrives once, the first time it is seen (or on load with `now`). */
export function Reveal({
  kind = "rise",
  now = false,
  delay = 0,
  as = "div",
  className,
  style,
  children,
  src,
  alt,
}: {
  kind?: Kind;
  now?: boolean;
  delay?: number;
  as?: "div" | "li" | "span" | "p" | "img";
  className?: string;
  style?: React.CSSProperties;
  children?: ReactNode;
  /** Only for as="img". */
  src?: string;
  alt?: string;
}) {
  const reduce = useReducedMotion();
  const target = { opacity: 1, x: 0, y: 0, scale: 1, rotate: 0 };
  const Comp = (motion as unknown as Record<string, React.ElementType>)[as];
  const media = as === "img" ? { src, alt: alt ?? "" } : {};
  if (reduce) {
    const Plain = as as React.ElementType;
    return <Plain className={className} style={style} {...media}>{children}</Plain>;
  }
  const spring = kind === "sticker" || kind === "pop" || kind === "stamp";
  return (
    <Comp
      className={className}
      style={style}
      {...media}
      initial={FROM[kind]}
      {...(now ? { animate: target } : { whileInView: target, viewport: { once: true, margin: "0px 0px -12% 0px" } })}
      transition={spring ? { type: "spring", stiffness: 260, damping: 18, delay } : { duration: 0.6, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </Comp>
  );
}
