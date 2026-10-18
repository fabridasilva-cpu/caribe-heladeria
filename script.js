 (async () => {
  const products = window.CARIBE_PRODUCTS || [];
  const sauces = window.CARIBE_SAUCES || [];
  const inventory = window.CARIBE_STOCK;
  await inventory.ready;
  const grid = document.getElementById('product-grid');
  const flavorPicker = document.getElementById('flavor-picker');
  const treatPicker = document.getElementById('treat-picker');
  const treatPresentation = document.getElementById('treat-presentation');
  const addonPicker = document.getElementById('addon-picker');
  const ediblePicker = document.getElementById('edible-picker');
  const ediblePresentation = document.getElementById('edible-presentation');
  const search = document.getElementById('search');
  const selected = [];
  const treats = new Map();
  const addons = new Map();
  const edibles = new Map();
  const selectedSauces = new Set();
  let activeFilter = 'helados';
  const escapeHTML = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const inventoryStatus = document.getElementById('inventory-status');
  function updateInventoryStatus() {
    if (!inventoryStatus || !inventory.isConfigured()) return;
    inventoryStatus.hidden = inventory.isConnected();
    inventoryStatus.textContent = inventory.isConnected()
      ? ''
      : 'No pudimos actualizar el stock en este momento. Confirmaremos la disponibilidad por WhatsApp.';
  }
  updateInventoryStatus();
  window.addEventListener('caribe-stock-changed', updateInventoryStatus);
  window.addEventListener('caribe-stock-error', updateInventoryStatus);
  const available = p => inventory.isAvailable('products', p.name);
  const sizeInput = () => document.querySelector('[name="size"]:checked');
  const maxFlavors = () => sizeInput().value === '1 kg' ? 4 : 3;
  const feedback = text => { document.getElementById('builder-feedback').textContent = text; };
  const getPresentations = product => product.presentations || [{value:'unidad',label:'Unidad'}];

  function syncPresentation(productSelect, presentationSelect) {
    const product = products.find(p => p.name === productSelect.value);
    const options = product ? getPresentations(product) : [{value:'unidad',label:'Unidad'}];
    const current = presentationSelect.value;
    presentationSelect.innerHTML = options.map(item=>`<option value="${escapeHTML(item.value)}">${escapeHTML(item.label)}</option>`).join('');
    if (options.some(item=>item.value===current)) presentationSelect.value=current;
    presentationSelect.disabled = !product;
    if (productSelect === treatPicker) document.getElementById('add-treat').disabled = !product;
    if (productSelect === ediblePicker) document.getElementById('add-edible').disabled = !product;
  }

  function drawProducts() {
    const q = search.value.trim().toLocaleLowerCase('es');
    const visible = products.filter(p => p.group === activeFilter && p.name.toLocaleLowerCase('es').includes(q));
    grid.innerHTML = visible.map(p => {
      const inStock = available(p);
      const kind = p.group === 'helados' ? 'Gusto de helado' : p.group === 'tentaciones' ? (p.orderType === 'addon' ? 'Para acompañar el helado' : 'Tentación') : 'Comestible';
      const alt = p.group === 'helados' ? `Helado artesanal de ${escapeHTML(p.name)}` : `${kind}: ${escapeHTML(p.name)}`;
      return `<article class="product-card ${inStock ? '' : 'out-of-stock'}"><div class="product-picture"><img src="assets/${p.image}" alt="${alt}" loading="lazy">${p.tag && inStock ? `<span class="product-tag">${escapeHTML(p.tag)}</span>` : ''}${inStock ? '' : '<span class="stock-badge">Sin stock</span>'}</div><div class="product-info"><div><h3>${escapeHTML(p.name)}</h3><small>${kind}</small></div><button type="button" class="quick-add" data-add="${escapeHTML(p.name)}" aria-label="Agregar ${escapeHTML(p.name)}" ${inStock ? '' : 'disabled'}>${inStock ? '+' : '–'}</button></div></article>`;
    }).join('');
    document.getElementById('empty-state').hidden = visible.length > 0;
    grid.querySelectorAll('[data-add]').forEach(btn => btn.addEventListener('click', () => {
      const p = products.find(x => x.name === btn.dataset.add);
      if (p.group === 'helados') addFlavor(p.name);
      else if (p.group === 'comestibles') addLineItem(edibles,p.name,'unidad');
      else if (p.orderType === 'addon') addAddon(p.name);
      else addLineItem(treats,p.name,'unidad');
    }));
  }

  function fillPicker(select, group, placeholder, predicate = () => true) {
    const current = select.value;
    select.innerHTML = `<option value="">${placeholder}</option>`;
    products.filter(p => p.group === group && predicate(p) && available(p)).forEach(p => {
      const option = document.createElement('option'); option.value = p.name; option.textContent = p.name; select.append(option);
    });
    if ([...select.options].some(o => o.value === current)) select.value = current;
  }

  function refreshPickers() {
    fillPicker(flavorPicker,'helados','Elegí un sabor para agregar…');
    fillPicker(treatPicker,'tentaciones','Elegí una tentación…',p=>p.orderType==='standalone');
    fillPicker(addonPicker,'tentaciones','Elegí un agregado…',p=>p.orderType==='addon');
    fillPicker(ediblePicker,'comestibles','Elegí un comestible…');
    syncPresentation(treatPicker,treatPresentation);
    syncPresentation(ediblePicker,ediblePresentation);
    addonPicker.disabled = selected.length === 0;
    document.getElementById('add-addon').disabled = selected.length === 0;
    document.querySelector('.addon-block').classList.toggle('inactive',selected.length===0);
  }

  function drawSauces() {
    const container = document.getElementById('sauce-options');
    const canAddSauce = selected.length > 0;
    container.innerHTML = sauces.map(sauce => {
      const inStock = inventory.isAvailable('sauces', sauce);
      return `<label class="sauce-option ${inStock ? '' : 'disabled'}"><input type="checkbox" value="${escapeHTML(sauce)}" ${selectedSauces.has(sauce) ? 'checked' : ''} ${!canAddSauce || !inStock ? 'disabled' : ''}><span>${escapeHTML(sauce)}</span>${inStock ? '' : '<small>Sin stock</small>'}</label>`;
    }).join('');
    container.querySelectorAll('input').forEach(input => input.addEventListener('change', () => {
      input.checked ? selectedSauces.add(input.value) : selectedSauces.delete(input.value);
      drawSelected();
    }));
    document.querySelector('.sauce-block').classList.toggle('inactive', !canAddSauce);
  }

  function drawMap(wrap, map, emptyText, key) {
    if (!map.size) wrap.innerHTML = `<span class="flavor-empty">${emptyText}</span>`;
    else wrap.innerHTML = [...map.entries()].map(([itemKey,value]) => {
      const isAddon = key === 'addons';
      const name = isAddon ? itemKey : value.name;
      const qty = isAddon ? value : value.quantity;
      const detail = isAddon ? '' : `<small>${escapeHTML(value.presentation)}</small>`;
      return `<span class="flavor-chip edible-chip">${escapeHTML(name)} ${detail} <button type="button" data-map="${key}" data-item-key="${escapeHTML(itemKey)}" data-delta="-1" aria-label="Quitar uno">−</button><b>${qty}</b><button type="button" data-map="${key}" data-item-key="${escapeHTML(itemKey)}" data-delta="1" aria-label="Agregar uno">+</button></span>`;
    }).join('');
    wrap.querySelectorAll('[data-item-key]').forEach(b => b.addEventListener('click', () => {
      if (b.dataset.map === 'addons') addQuantity(addons,b.dataset.itemKey,Number(b.dataset.delta));
      else changeLineItem(b.dataset.map === 'treats' ? treats : edibles,b.dataset.itemKey,Number(b.dataset.delta));
    }));
  }

  function drawSelected() {
    const wrap = document.getElementById('selected-flavors');
    const limit = maxFlavors();
    document.getElementById('flavor-limit').textContent = `(máximo ${limit}; elegidos ${selected.length})`;
    document.querySelectorAll('[name="size"]').forEach(input => input.closest('.size-option').classList.toggle('selected', input.checked));
    if (!selected.length) wrap.innerHTML = '<span class="flavor-empty">Tus gustos aparecen acá.</span>';
    else wrap.innerHTML = selected.map((f,i) => `<span class="flavor-chip">${escapeHTML(f)} <button type="button" data-remove-flavor="${i}" aria-label="Quitar ${escapeHTML(f)}">×</button></span>`).join('');
    wrap.querySelectorAll('[data-remove-flavor]').forEach(b => b.addEventListener('click', () => {
      selected.splice(Number(b.dataset.removeFlavor),1);
      if (!selected.length) { selectedSauces.clear(); addons.clear(); }
      feedback(''); drawSelected();
    }));
    drawMap(document.getElementById('selected-treats'),treats,'Tus tentaciones aparecen acá.','treats');
    drawMap(document.getElementById('selected-addons'),addons,'Podés agregar cucuruchos o tacita.','addons');
    drawMap(document.getElementById('selected-edibles'),edibles,'Tus comestibles aparecen acá.','edibles');
    refreshPickers();
    drawSauces();

    const rows = [];
    if (selected.length) {
      rows.push(`<li class="summary-group">Helado · ${escapeHTML(sizeInput().value)}</li>`);
      selected.forEach(f => rows.push(`<li>• ${escapeHTML(f)}</li>`));
      if (selectedSauces.size) rows.push(`<li class="summary-addition">Salsas: ${[...selectedSauces].map(escapeHTML).join(', ')}</li>`);
      if (addons.size) rows.push(`<li class="summary-addition">Para el helado: ${[...addons].map(([name,qty])=>`${qty} × ${escapeHTML(name)}`).join(', ')}</li>`);
    }
    if (treats.size) {
      rows.push('<li class="summary-group">Tentaciones</li>');
      for (const [,item] of treats) rows.push(`<li>• ${escapeHTML(formatLine(item))}</li>`);
    }
    if (edibles.size) {
      rows.push('<li class="summary-group">Comestibles</li>');
      for (const [,item] of edibles) rows.push(`<li>• ${escapeHTML(formatLine(item))}</li>`);
    }
    document.getElementById('summary-content').innerHTML = rows.length ? `<ul class="summary-list">${rows.join('')}</ul>` : '<p class="summary-empty">Todavía no agregaste productos.<br>Elegí helados, tentaciones o comestibles.</p>';
    document.getElementById('whatsapp-order').disabled = rows.length === 0;
  }

  function addFlavor(name) {
    const p = products.find(x => x.name === name);
    if (!p || !available(p)) return feedback(`${name} no está disponible en este momento.`);
    if (selected.includes(name)) return feedback(`${name} ya está en tu selección.`);
    if (selected.length >= maxFlavors()) return feedback(`Para ${sizeInput().value} podés elegir hasta ${maxFlavors()} sabores.`);
    selected.push(name); feedback(''); drawSelected();
  }
  function addQuantity(map,name,delta=1) {
    const p = products.find(x => x.name === name);
    if (!p || !available(p)) return feedback(`${name} no está disponible en este momento.`);
    const next = (map.get(name)||0)+delta;
    if (next <= 0) map.delete(name); else map.set(name,next);
    feedback(''); drawSelected();
  }
  function addLineItem(map,name,presentationValue,delta=1) {
    const product=products.find(p=>p.name===name);
    if(!product||!available(product)) return feedback(`${name} no está disponible en este momento.`);
    const presentation=getPresentations(product).find(x=>x.value===presentationValue)||getPresentations(product)[0];
    const key=`${name}::${presentation.value}`;
    const next=(map.get(key)?.quantity||0)+delta;
    if(next<=0) map.delete(key); else map.set(key,{name,presentation:presentation.label,quantity:next});
    feedback(''); drawSelected();
  }
  function changeLineItem(map,key,delta) {
    const entry=map.get(key);
    if(!entry)return;
    const next=entry.quantity+delta;
    if(next<=0)map.delete(key);else map.set(key,{...entry,quantity:next});
    drawSelected();
  }
  function formatLine(item) {
    if(item.presentation==='Unidad') return `${item.quantity} ${item.quantity===1?'unidad':'unidades'} de ${item.name}`;
    return `${item.quantity} × ${item.presentation.toLocaleLowerCase('es')} de ${item.name}`;
  }
  function addAddon(name) {
    if (!selected.length) return feedback('Elegí un helado antes de agregar un cucurucho o una tacita.');
    addQuantity(addons,name,1);
  }

  refreshPickers(); drawProducts(); drawSelected();
  document.querySelectorAll('.filter').forEach(btn => btn.addEventListener('click', () => { document.querySelector('.filter.active').classList.remove('active'); btn.classList.add('active'); activeFilter=btn.dataset.filter; drawProducts(); }));
  search.addEventListener('input', drawProducts);
  document.getElementById('add-flavor').addEventListener('click', () => { addFlavor(flavorPicker.value); flavorPicker.value=''; });
  flavorPicker.addEventListener('keydown', e => { if(e.key==='Enter'){e.preventDefault();addFlavor(flavorPicker.value);flavorPicker.value='';} });
  treatPicker.addEventListener('change',()=>syncPresentation(treatPicker,treatPresentation));
  ediblePicker.addEventListener('change',()=>syncPresentation(ediblePicker,ediblePresentation));
  document.getElementById('add-treat').addEventListener('click', () => { addLineItem(treats,treatPicker.value,treatPresentation.value); treatPicker.value=''; syncPresentation(treatPicker,treatPresentation); });
  treatPicker.addEventListener('keydown', e => { if(e.key==='Enter'){e.preventDefault();addLineItem(treats,treatPicker.value,treatPresentation.value);treatPicker.value='';syncPresentation(treatPicker,treatPresentation);} });
  document.getElementById('add-addon').addEventListener('click', () => { addAddon(addonPicker.value); addonPicker.value=''; });
  addonPicker.addEventListener('keydown', e => { if(e.key==='Enter'){e.preventDefault();addAddon(addonPicker.value);addonPicker.value='';} });
  document.getElementById('add-edible').addEventListener('click', () => { addLineItem(edibles,ediblePicker.value,ediblePresentation.value); ediblePicker.value=''; syncPresentation(ediblePicker,ediblePresentation); });
  ediblePicker.addEventListener('keydown', e => { if(e.key==='Enter'){e.preventDefault();addLineItem(edibles,ediblePicker.value,ediblePresentation.value);ediblePicker.value='';syncPresentation(ediblePicker,ediblePresentation);} });
  document.querySelectorAll('[name="size"]').forEach(input => input.addEventListener('change', () => {
    if (selected.length > maxFlavors()) { selected.splice(maxFlavors()); feedback(`Se ajustó la selección al máximo de ${maxFlavors()} sabores para este tamaño.`); }
    drawSelected();
  }));
  document.getElementById('whatsapp-order').addEventListener('click', () => {
    if (!selected.length && !treats.size && !edibles.size) return;
    const delivery = document.querySelector('[name="delivery"]:checked').value;
    const address = document.getElementById('address').value.trim();
    const notes = document.getElementById('notes').value.trim();
    const lines = ['¡Hola, Caribe! Quiero hacer este pedido:'];
    if (selected.length) {
      lines.push('',`• Helado de ${sizeInput().value}`,`• Gustos: ${selected.join(', ')}`);
      if (selectedSauces.size) lines.push(`• Salsas: ${[...selectedSauces].join(', ')}`);
      if (addons.size) lines.push(`• Para acompañar el helado: ${[...addons].map(([name,qty])=>`${qty} × ${name}`).join(', ')}`);
    }
    if (treats.size) lines.push('', '• Tentaciones:', ...[...treats.values()].map(item => `  - ${formatLine(item)}`));
    if (edibles.size) lines.push('', '• Comestibles:', ...[...edibles.values()].map(item => `  - ${formatLine(item)}`));
    lines.push('',`• ${delivery}`);
    if (delivery.startsWith('Envío') && address) lines.push(`• Dirección: ${address}`);
    if (notes) lines.push(`• Detalle: ${notes}`);
    lines.push('', '¿Me confirman disponibilidad y precio?');
    window.open(`https://wa.me/543775415447?text=${encodeURIComponent(lines.join('\n'))}`, '_blank', 'noopener,noreferrer');
  });

  window.addEventListener('caribe-stock-changed', () => {
    for (let i=selected.length-1;i>=0;i--) if (!inventory.isAvailable('products',selected[i])) selected.splice(i,1);
    for (const map of [treats,edibles]) for (const [key,item] of map) if (!inventory.isAvailable('products',item.name)) map.delete(key);
    for (const name of addons.keys()) if (!inventory.isAvailable('products',name)) addons.delete(name);
    if (!selected.length) { selectedSauces.clear(); addons.clear(); }
    for (const name of selectedSauces) if (!inventory.isAvailable('sauces',name)) selectedSauces.delete(name);
    feedback(''); refreshPickers(); drawProducts(); drawSelected();
  });
  const toggle=document.querySelector('.menu-toggle');
  toggle.addEventListener('click',()=>{const nav=document.querySelector('.main-nav');const open=nav.classList.toggle('open');toggle.setAttribute('aria-expanded',String(open));toggle.textContent=open?'×':'☰';});
  document.querySelectorAll('.main-nav a').forEach(a=>a.addEventListener('click',()=>{document.querySelector('.main-nav').classList.remove('open');toggle.setAttribute('aria-expanded','false');toggle.textContent='☰';}));
  document.getElementById('year').textContent=new Date().getFullYear();
})();
