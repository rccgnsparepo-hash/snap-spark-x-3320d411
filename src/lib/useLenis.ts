import { useEffect, type RefObject } from "react";
import Lenis from "lenis";

/**
 * Smooth-scroll for the app's primary scroll container.
 * Pass the scrollable element ref (the desktop main viewport); falls back to the window.
 * Auto-disables on prefers-reduced-motion and on touch coarse pointers.
 */
export function useLenis(wrapperRef?: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (reduce || coarse) return; // native scroll on mobile / a11y
    const wrapper = wrapperRef?.current ?? undefined;
    const lenis = new Lenis({
      ...(wrapper
        ? { wrapper, content: (wrapper.firstElementChild as HTMLElement) ?? wrapper }
        : {}),
      duration: 1.05,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 0.9,
    });
    let rafId = 0;
    const raf = (time: number) => { lenis.raf(time); rafId = requestAnimationFrame(raf); };
    rafId = requestAnimationFrame(raf);
    return () => { cancelAnimationFrame(rafId); lenis.destroy(); };
  }, [wrapperRef]);
}