(() => {
  const stock = window.CARIBE_STOCK;
  const products = window.CARIBE_PRODUCTS || [];
  const sauces = window.CARIBE_SAUCES || [];
  const groups = [
    { title: 'Gustos de helado', items: products.filter(p => p.group === 'helados').map(p => ({ name: p.name, type: 'products' })) },
    { title: 'Tentaciones', items: products.filter(p => p.group === 'tentaciones').map(p => ({ name: p.name, type: 'products' })) },
    { title: 'Comestibles', items: products.filter(p => p.group === 'comestibles').map(p => ({ name: p.name, type: 'products' })) },
    { title: 'Salsas', items: sauces.map(name => ({ name, type: 'sauces' })) }
  ];
  const root = document.getElementById('stock-groups');
  const panel = document.getElementById('stock-panel');
  const login = document.getElementById('stock-login');
  const notice = document.getElementById('stock-notice');
  const message = document.getElementById('stock-action-message');
  const loginMessage = document.getElementById('stock-login-message');
  const escape = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  function showNotice(title, copy) {
    notice.hidden = false;
    notice.innerHTML = `<strong>${escape(title)}</strong><p>${escape(copy)}</p>`;
  }
  function render() {
    root.innerHTML = groups.map(group => `<section class="stock-group"><h2>${escape(group.title)}</h2><div class="stock-list">${group.items.map(item => {
      const checked = stock.isAvailable(item.type, item.name);
      return `<label class="stock-row"><span>${escape(item.name)}</span><span class="stock-toggle"><input type="checkbox" data-type="${item.type}" data-name="${escape(item.name)}" ${checked ? 'checked' : ''}><b>${checked ? 'Disponible' : 'Agotado'}</b></span></label>`;
    }).join('')}</div></section>`).join('');
    root.querySelectorAll('input[type="checkbox"]').forEach(input => input.addEventListener('change', async () => {
      const wasChecked = !input.checked;
      input.disabled = true;
      message.textContent = 'Guardando disponibilidad…';
      try {
        await stock.setAvailable(input.dataset.type, input.dataset.name, input.checked);
        message.textContent = stock.isConfigured() ? 'Guardado en Supabase.' : 'Guardado en este dispositivo.';
      } catch (error) {
        input.checked = wasChecked;
        message.textContent = error.message || 'No se pudo guardar el cambio. Revisá la conexión.';
      } finally {
        input.disabled = false;
        input.nextElementSibling.textContent = input.checked ? 'Disponible' : 'Agotado';
      }
    }));
  }
  function showLocalPanel() {
    showNotice('Modo local: solo este dispositivo', 'Este modo permite revisar el panel, pero sus cambios no se comparten con los clientes. Conectá Supabase para habilitar el inventario online.');
    document.getElementById('stock-mode-copy').textContent = 'Desmarcá un producto cuando se termine. Al volver a tenerlo, marcá “Disponible”.';
    panel.hidden = false;
    document.getElementById('stock-logout').hidden = true;
    render();
  }
  async function showCloudPanel(session) {
    if (!session) {
      login.hidden = false;
      panel.hidden = true;
      document.getElementById('stock-logout').hidden = true;
      return;
    }
    let allowed = false;
    try { allowed = await stock.isAdmin(session.user.id); }
    catch (error) { loginMessage.textContent = error.message || 'No se pudo verificar el acceso.'; }
    if (!allowed) {
      await stock.client.auth.signOut();
      login.hidden = false;
      panel.hidden = true;
      document.getElementById('stock-logout').hidden = true;
      loginMessage.textContent = 'Esta cuenta no tiene permiso para administrar el stock. Contactá a quien configuró Supabase.';
      return;
    }
    login.hidden = true;
    panel.hidden = false;
    document.getElementById('stock-logout').hidden = false;
    const online = stock.isConnected();
    showNotice(online ? 'Inventario compartido activo' : 'Sin conexión al inventario', online
      ? 'La disponibilidad se guarda en Supabase. Los menús que tengan esta integración abierta se actualizan automáticamente.'
      : stock.getError() || 'Reconectá para volver a guardar cambios.');
    document.getElementById('stock-mode-copy').textContent = 'Los cambios se guardan en Supabase y se comparten con todos los clientes.';
    render();
  }

  async function init() {
    await stock.ready;
    if (!stock.isConfigured()) {
      showLocalPanel();
      document.getElementById('reset-stock').addEventListener('click', async () => {
        await stock.setMany(groups.flatMap(group => group.items));
        message.textContent = 'Todos los productos quedaron disponibles en este dispositivo.';
        render();
      });
      return;
    }
    if (!stock.client) {
      showNotice('No se pudo iniciar Supabase', stock.getError() || 'Revisá la configuración del proyecto.');
      return;
    }

    login.hidden = false;
    showNotice(stock.isConnected() ? 'Inventario compartido activo' : 'Conectando con Supabase…',
      stock.isConnected() ? 'Iniciá sesión para cambiar el stock.' : stock.getError() || 'Esperá mientras se consulta la disponibilidad.');
    try { await showCloudPanel(await stock.getAdminSession()); }
    catch (error) { loginMessage.textContent = error.message || 'No se pudo consultar la sesión.'; }

    document.getElementById('stock-login-form').addEventListener('submit', async event => {
      event.preventDefault();
      const button = document.getElementById('stock-login-button');
      button.disabled = true;
      loginMessage.textContent = 'Verificando acceso…';
      try {
        const { data, error } = await stock.client.auth.signInWithPassword({
          email: document.getElementById('stock-email').value.trim(),
          password: document.getElementById('stock-password').value
        });
        if (error) throw error;
        await showCloudPanel(data.session);
      } catch (error) {
        loginMessage.textContent = error.message || 'No se pudo iniciar sesión.';
      } finally {
        button.disabled = false;
      }
    });
    document.getElementById('stock-logout').addEventListener('click', async () => {
      await stock.client.auth.signOut();
      loginMessage.textContent = 'Sesión cerrada.';
      await showCloudPanel(null);
    });
    document.getElementById('reset-stock').addEventListener('click', async () => {
      const button = document.getElementById('reset-stock');
      button.disabled = true;
      message.textContent = 'Guardando…';
      try {
        await stock.setMany(groups.flatMap(group => group.items));
        message.textContent = 'Todos los productos quedaron disponibles.';
      } catch (error) {
        message.textContent = error.message || 'No se pudo actualizar el inventario.';
      } finally {
        button.disabled = false;
      }
    });
  }

  window.addEventListener('caribe-stock-changed', () => { if (!panel.hidden) render(); });
  window.addEventListener('caribe-stock-error', () => {
    showNotice('Sin conexión al inventario compartido', stock.getError() || 'Revisá tu conexión a internet.');
  });
  init().catch(error => showNotice('No se pudo abrir el panel', error.message || 'Recargá la página e intentá de nuevo.'));
})();
