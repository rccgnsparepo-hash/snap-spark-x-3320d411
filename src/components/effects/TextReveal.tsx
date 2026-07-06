import { useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";

/** Splits children text into word-spans and reveals them with stagger on mount. */
export function TextReveal({ text, className = "", delay = 0, as: As = "h1" }: { text: string; className?: string; delay?: number; as?: keyof React.JSX.IntrinsicElements }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const words = el.querySelectorAll<HTMLSpanElement>("[data-word]");
    gsap.set(words, { yPercent: 110, opacity: 0 });
    gsap.to(words, { yPercent: 0, opacity: 1, duration: 0.9, stagger: 0.06, delay, ease: "expo.out" });
  }, [text, delay]);
  const Cmp = As as keyof React.JSX.IntrinsicElements;
  return (
    <Cmp ref={ref as React.RefObject<HTMLElement>} className={className}>
      {text.split(" ").map((w, i) => (
        <span key={i} className="inline-block overflow-hidden pb-[0.06em] mr-[0.25em] align-bottom">
          <span data-word className="inline-block will-change-transform">{w}</span>
        </span>
      ))}
    </Cmp>
  );
}