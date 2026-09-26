export function observeFirstResult(element: Element, onVisible: () => void): () => void {
  let isIntersecting = false;
  let reported = false;

  function reportIfVisible() {
    if (!reported && isIntersecting && document.visibilityState === "visible") {
      reported = true;
      onVisible();
    }
  }

  const observer = new IntersectionObserver(
    (entries) => {
      isIntersecting = entries.some((entry) => entry.target === element && entry.isIntersecting);
      reportIfVisible();
    },
    { threshold: 0.25 },
  );
  observer.observe(element);
  document.addEventListener("visibilitychange", reportIfVisible);

  return () => {
    observer.disconnect();
    document.removeEventListener("visibilitychange", reportIfVisible);
  };
}
