import '@testing-library/jest-dom/vitest'

Object.defineProperty(globalThis, 'ResizeObserver', {
  configurable: true,
  writable: true,
  value: class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
})

Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  writable: true,
  value: (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})

Object.defineProperties(HTMLElement.prototype, {
  scrollIntoView: {
    configurable: true,
    value: () => {},
  },
  hasPointerCapture: {
    configurable: true,
    value: () => false,
  },
  setPointerCapture: {
    configurable: true,
    value: () => {},
  },
  releasePointerCapture: {
    configurable: true,
    value: () => {},
  },
})
