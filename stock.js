(() => {
  const CONFIG = window.CARIBE_SUPABASE_CONFIG || {};
  const configured = Boolean(CONFIG.url && CONFIG.publishableKey);
  const LOCAL_KEY = 'caribe-stock-v1';
  const CACHE_KEY = 'caribe-stock-cache-v2';
  let memory = { products: {}, sauces: {} };
  let connected = false;
  let lastError = null;
  let client = null;

  function emptyStock() { return { products: {}, sauces: {} }; }
  function readLocal(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      if (value && value.products && value.sauces) return value;
    } catch (_) {}
    return emptyStock();
  }
  function dispatch(name = 'caribe-stock-changed') {
    window.dispatchEvent(new CustomEvent(name, { detail: { connected, error: lastError } }));
  }
  function cache() {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(memory)); } catch (_) {}
  }
  function applyRows(rows) {
    const next = emptyStock();
    for (const row of rows || []) {
      const group = row.type === 'sauces' ? 'sauces' : 'products';
      next[group][row.name] = Boolean(row.available);
    }
    memory = next;
    cache();
  }
  async function fetchRemote() {
    if (!client) throw new Error('No se pudo iniciar la conexión con Supabase.');
    const { data, error } = await client.from('inventory').select('type,name,available');
    if (error) throw error;
    applyRows(data);
    connected = true;
    lastError = null;
    dispatch();
  }

  if (configured) {
    memory = readLocal(CACHE_KEY);
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      client = window.supabase.createClient(CONFIG.url, CONFIG.publishableKey);
    }
  } else {
    memory = readLocal(LOCAL_KEY);
  }

  const ready = configured
    ? fetchRemote().catch(error => {
        connected = false;
        lastError = error?.message || 'No se pudo leer la disponibilidad compartida.';
        dispatch('caribe-stock-error');
      })
    : Promise.resolve();

  if (configured && client) {
    client.channel('caribe-inventory-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => {
        fetchRemote().catch(error => {
          connected = false;
          lastError = error?.message || 'Se perdió la conexión con Supabase.';
          dispatch('caribe-stock-error');
        });
      })
      .subscribe(status => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          lastError = 'No se pudo iniciar la actualización en tiempo real.';
          dispatch('caribe-stock-error');
        }
      });
  }

  window.CARIBE_STOCK = {
    ready,
    client,
    isConfigured() { return configured; },
    isConnected() { return connected; },
    getError() { return lastError; },
    isAvailable(type, name) { return memory[type]?.[name] !== false; },
    async setAvailable(type, name, value) {
      const available = Boolean(value);
      if (configured) {
        if (!connected || !client) throw new Error(lastError || 'Sin conexión con el inventario compartido.');
        const { error } = await client.from('inventory').upsert(
          { type, name, available, updated_at: new Date().toISOString() },
          { onConflict: 'type,name' }
        );
        if (error) throw error;
        memory[type][name] = available;
        cache();
        dispatch();
        return;
      }
      memory[type][name] = available;
      try { localStorage.setItem(LOCAL_KEY, JSON.stringify(memory)); } catch (_) {}
      dispatch();
    },
    async setMany(items) {
      if (configured) {
        if (!connected || !client) throw new Error(lastError || 'Sin conexión con el inventario compartido.');
        const rows = items.map(item => ({ ...item, available: true, updated_at: new Date().toISOString() }));
        const { error } = await client.from('inventory').upsert(rows, { onConflict: 'type,name' });
        if (error) throw error;
        for (const item of items) memory[item.type][item.name] = true;
        cache();
        dispatch();
        return;
      }
      for (const item of items) memory[item.type][item.name] = true;
      try { localStorage.setItem(LOCAL_KEY, JSON.stringify(memory)); } catch (_) {}
      dispatch();
    },
    async getAdminSession() {
      if (!configured || !client) return null;
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      return data.session;
    },
    async isAdmin(userId) {
      if (!configured || !client || !userId) return false;
      const { data, error } = await client.from('stock_admins').select('user_id').eq('user_id', userId).maybeSingle();
      if (error) throw error;
      return Boolean(data);
    }
  };

  if (configured && !client) {
    connected = false;
    lastError = 'No se cargó la biblioteca de Supabase. Revisá la conexión a internet e intentá de nuevo.';
  }
})();
