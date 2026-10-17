(() => {
  const KEY = 'caribe-stock-v1';
  let memory = { products: {}, sauces: {} };
  function read() {
    try {
      const value = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (value && value.products && value.sauces) memory = value;
    } catch (_) {}
    return memory;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(memory)); } catch (_) {}
    window.dispatchEvent(new CustomEvent('caribe-stock-changed'));
  }
  window.CARIBE_STOCK = {
    isAvailable(type, name) { return read()[type][name] !== false; },
    setAvailable(type, name, value) { read()[type][name] = Boolean(value); save(); },
    reset() { memory = { products: {}, sauces: {} }; try { localStorage.removeItem(KEY); } catch (_) {} save(); }
  };
  window.addEventListener('storage', event => {
    if (event.key === KEY) {
      try { memory = JSON.parse(event.newValue || 'null') || { products: {}, sauces: {} }; } catch (_) { memory = { products: {}, sauces: {} }; }
      window.dispatchEvent(new CustomEvent('caribe-stock-changed'));
    }
  });
})();
