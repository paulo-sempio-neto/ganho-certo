import { afterEach, describe, expect, it, vi } from "vitest";

import { observeFirstResult } from "./observeFirstResult";

afterEach(() => vi.unstubAllGlobals());

describe("observeFirstResult", () => {
  it("reports only when the result is on screen and the page is visible", () => {
    const element = {} as Element;
    const onVisible = vi.fn();
    let visibilityHandler: (() => void) | undefined;
    let intersectionCallback: IntersectionObserverCallback | undefined;
    const disconnect = vi.fn();
    const observe = vi.fn();
    const removeEventListener = vi.fn();
    const page = {
      visibilityState: "hidden",
      addEventListener: vi.fn((_name: string, handler: () => void) => {
        visibilityHandler = handler;
      }),
      removeEventListener,
    };
    vi.stubGlobal("document", page);
    vi.stubGlobal("IntersectionObserver", class {
      constructor(callback: IntersectionObserverCallback) {
        intersectionCallback = callback;
      }
      observe = observe;
      disconnect = disconnect;
    });

    const stop = observeFirstResult(element, onVisible);
    expect(observe).toHaveBeenCalledWith(element);

    intersectionCallback?.([{ target: element, isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver);
    expect(onVisible).not.toHaveBeenCalled();

    intersectionCallback?.([{ target: element, isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    expect(onVisible).not.toHaveBeenCalled();

    page.visibilityState = "visible";
    visibilityHandler?.();
    visibilityHandler?.();
    expect(onVisible).toHaveBeenCalledTimes(1);

    stop();
    expect(disconnect).toHaveBeenCalledOnce();
    expect(removeEventListener).toHaveBeenCalledWith("visibilitychange", visibilityHandler);
  });
});
