import "@testing-library/jest-dom/vitest";

// jsdom has no ResizeObserver, and cmdk's command list measures itself with one.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(window, "ResizeObserver", { writable: true, value: ResizeObserverStub });

// jsdom elements can't scroll themselves into view, which cmdk does on every highlight change.
Element.prototype.scrollIntoView = function () {};

Object.defineProperty(window, "scrollTo", {
  writable: true,
  value: () => {},
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
