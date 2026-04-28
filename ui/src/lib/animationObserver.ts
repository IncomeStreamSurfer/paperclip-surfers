const ANIMATED_SELECTOR =
  ".widget-enter:not(.in-view),.metric-pop:not(.in-view),.bar-grow:not(.in-view),.list-item-enter:not(.in-view),.fade-in-up:not(.in-view)";

const observed = new WeakSet<Element>();

function activate(el: Element) {
  el.classList.add("in-view");
}

function registerElement(el: Element, io: IntersectionObserver) {
  if (observed.has(el) || el.classList.contains("in-view")) return;
  observed.add(el);
  const rect = el.getBoundingClientRect();
  if (rect.top < window.innerHeight + 50 && rect.bottom > -50) {
    activate(el);
  } else {
    io.observe(el);
  }
}

export function setupScrollAnimations(): () => void {
  if (typeof window === "undefined") return () => {};
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    // Just add in-view to everything immediately so they render normally
    document.querySelectorAll(ANIMATED_SELECTOR).forEach((el) => el.classList.add("in-view"));
    return () => {};
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          activate(entry.target);
          io.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.05, rootMargin: "0px 0px -10px 0px" },
  );

  document.querySelectorAll(ANIMATED_SELECTOR).forEach((el) => registerElement(el, io));

  const mo = new MutationObserver(() => {
    document.querySelectorAll(ANIMATED_SELECTOR).forEach((el) => registerElement(el, io));
  });
  mo.observe(document.body, { childList: true, subtree: true });

  return () => {
    io.disconnect();
    mo.disconnect();
  };
}
