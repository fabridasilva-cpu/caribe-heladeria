 (async () => {
  const products = window.CARIBE_PRODUCTS || [];
  const prices = window.CARIBE_PRICES || {iceCream:{},sauces:0};
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
  const addressInput = document.getElementById('address');
  function updateAddressRequirement() {
    const deliverySelected = document.querySelector('[name="delivery"]:checked').value.startsWith('Env�o');
    addressInput.required = deliverySelected;
    addressInput.setAttribute('aria-required', String(deliverySelected));
    addressInput.setAttribute('aria-label', deliverySelected ? 'Direcci�n de env�o obligatoria' : 'Direcci�n de env�o opcional');
    addressInput.placeholder = deliverySelected ? 'Direcci�n para el env�o (obligatoria)' : 'Direcci�n para el env�o (opcional)';
    if (!deliverySelected) addressInput.setCustomValidity('');
  }
  document.querySelectorAll('[name="delivery"]').forEach(input=>input.addEventListener('change',updateAddressRequirement));
  addressInput.addEventListener('input',()=>addressInput.setCustomValidity(''));
  updateAddressRequirement();
  const priceNote = document.querySelector('.price-note p');
  const priceLink = document.querySelector('.price-note a');
  if(priceNote) priceNote.innerHTML='<strong>Precios vigentes.</strong> Arm� tu pedido y vas a ver el total estimado antes de abrir WhatsApp. Los palitos se confirman por mensaje.';
  if(priceLink){priceLink.href='#pedido';priceLink.textContent='Ver precios y armar pedido';}
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
  const money = value => '$' + Number(value || 0).toLocaleString('es-AR');
  const unitPrice = (product, presentationValue='unidad') => {
    const presentation = getPresentations(product).find(x=>x.value===presentationValue);
    return presentation?.price ?? product.price ?? null;
  };
  const addonTotal = () => [...addons].reduce((sum,[name,quantity]) => sum + (products.find(p=>p.name===name)?.price || 0) * quantity, 0);
  const productPriceLabel = product => product.group==='helados' ? '' : product.presentations?.some(x=>x.price!=null) ? `Desde ${money(Math.min(...product.presentations.filter(x=>x.price!=null).map(x=>x.price)))}` : product.price!=null ? `${money(product.price)} c/u` : '';

  function syncPresentation(productSelect, presentationSelect) {
    const product = products.find(p => p.name === productSelect.value);
    const options = product ? getPresentations(product) : [{value:'unidad',label:'Unidad'}];
    const current = presentationSelect.value;
    presentationSelect.innerHTML = options.map(item=>`<option value="${escapeHTML(item.value)}">${escapeHTML(item.label)}${product && unitPrice(product,item.value)!=null ? ` - $${Number(unitPrice(product,item.value)).toLocaleString('es-AR')}` : ''}</option>`).join('');
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
      const kind = p.group === 'helados' ? 'Gusto de helado' : p.group === 'tentaciones' ? (p.orderType === 'addon' ? 'Para acompa�ar el helado' : 'Tentaci�n') : 'Comestible';
      const alt = p.group === 'helados' ? `Helado artesanal de ${escapeHTML(p.name)}` : `${kind}: ${escapeHTML(p.name)}`;
      const priceLabel = productPriceLabel(p);
      return `<article class="product-card ${inStock ? '' : 'out-of-stock'}"><div class="product-picture"><img src="assets/${p.image}" alt="${alt}" loading="lazy">${p.tag && inStock ? `<span class="product-tag">${escapeHTML(p.tag)}</span>` : ''}${inStock ? '' : '<span class="stock-badge">Sin stock</span>'}</div><div class="product-info"><div><h3>${escapeHTML(p.name)}</h3><small>${kind}</small></div><button type="button" class="quick-add" data-add="${escapeHTML(p.name)}" aria-label="Agregar ${escapeHTML(p.name)}" ${inStock ? '' : 'disabled'}>${inStock ? '+' : '-'}</button></div></article>`;
    }).join('');
    grid.querySelectorAll('.quick-add').forEach(button=>{
      const product=products.find(item=>item.name===button.dataset.add);
      const label=product && productPriceLabel(product);
      if(label){const price=document.createElement('small');price.className='card-price';price.textContent=label;button.parentElement.querySelector('div').append(price);}
    });
    document.querySelectorAll('[name="size"]').forEach(input=>{
      const price=prices.iceCream[input.value];
      const note=input.parentElement.querySelector('small');
      if(note) note.textContent=`${note.textContent.split(' � ')[0]} � ${money(price)}`;
    });
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
      const option = document.createElement('option'); option.value = p.name; option.textContent = `${p.name}${p.price!=null ? ` - $${Number(p.price).toLocaleString('es-AR')}` : ''}`; select.append(option);
    });
    if ([...select.options].some(o => o.value === current)) select.value = current;
  }

  function refreshPickers() {
    fillPicker(flavorPicker,'helados','Eleg� un sabor para agregar.');
    fillPicker(treatPicker,'tentaciones','Eleg� una tentaci�n.',p=>p.orderType==='standalone');
    fillPicker(addonPicker,'tentaciones','Eleg� un agregado.',p=>p.orderType==='addon');
    fillPicker(ediblePicker,'comestibles','Eleg� un comestible.');
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
      return `<span class="flavor-chip edible-chip">${escapeHTML(name)} ${detail} <button type="button" data-map="${key}" data-item-key="${escapeHTML(itemKey)}" data-delta="-1" aria-label="Quitar uno">-</button><b>${qty}</b><button type="button" data-map="${key}" data-item-key="${escapeHTML(itemKey)}" data-delta="1" aria-label="Agregar uno">+</button></span>`;
    }).join('');
    wrap.querySelectorAll('[data-item-key]').forEach(b => b.addEventListener('click', () => {
      if (b.dataset.map === 'addons') addQuantity(addons,b.dataset.itemKey,Number(b.dataset.delta));
      else changeLineItem(b.dataset.map === 'treats' ? treats : edibles,b.dataset.itemKey,Number(b.dataset.delta));
    }));
  }

  function drawSelected() {
    const wrap = document.getElementById('selected-flavors');
    const limit = maxFlavors();
    document.getElementById('flavor-limit').textContent = `(m�ximo ${limit}; elegidos ${selected.length})`;
    document.querySelectorAll('[name="size"]').forEach(input => input.closest('.size-option').classList.toggle('selected', input.checked));
    if (!selected.length) wrap.innerHTML = '<span class="flavor-empty">Tus gustos aparecen ac�.</span>';
    else wrap.innerHTML = selected.map((f,i) => `<span class="flavor-chip">${escapeHTML(f)} <button type="button" data-remove-flavor="${i}" aria-label="Quitar ${escapeHTML(f)}">�</button></span>`).join('');
    wrap.querySelectorAll('[data-remove-flavor]').forEach(b => b.addEventListener('click', () => {
      selected.splice(Number(b.dataset.removeFlavor),1);
      if (!selected.length) { selectedSauces.clear(); addons.clear(); }
      feedback(''); drawSelected();
    }));
    drawMap(document.getElementById('selected-treats'),treats,'Tus tentaciones aparecen ac�.','treats');
    drawMap(document.getElementById('selected-addons'),addons,'Pod�s agregar cucuruchos o tacita.','addons');
    drawMap(document.getElementById('selected-edibles'),edibles,'Tus comestibles aparecen ac�.','edibles');
    refreshPickers();
    drawSauces();

    const rows = [];
    if (selected.length) {
      rows.push(`<li class="summary-group">Helado � ${escapeHTML(sizeInput().value)}</li>`);
      selected.forEach(f => rows.push(`<li> ${escapeHTML(f)}</li>`));
      if (selectedSauces.size) rows.push(`<li class="summary-addition">Salsas: ${[...selectedSauces].map(escapeHTML).join(', ')}</li>`);
      if (addons.size) rows.push(`<li class="summary-addition">Para el helado: ${[...addons].map(([name,qty])=>`${qty} � ${escapeHTML(name)}`).join(', ')}</li>`);
    }
    if (addons.size) rows.push(`<li class="summary-addition">Precio de cucuruchos y tacitas: $${addonTotal().toLocaleString('es-AR')}</li>`);
    if (treats.size) {
      rows.push('<li class="summary-group">Tentaciones</li>');
      for (const [,item] of treats) rows.push(`<li> ${escapeHTML(formatLine(item))}</li>`);
    }
    if (edibles.size) {
      rows.push('<li class="summary-group">Comestibles</li>');
      for (const [,item] of edibles) rows.push(`<li> ${escapeHTML(formatLine(item))}</li>`);
    }
    document.getElementById('summary-content').innerHTML = rows.length ? `<ul class="summary-list">${rows.join('')}</ul>` : '<p class="summary-empty">Todav�a no agregaste productos.<br>Eleg� helados, tentaciones o comestibles.</p>';
    document.getElementById('whatsapp-order').disabled = rows.length === 0;
    const unpricedItems = [...treats.values(),...edibles.values()].filter(item=>item.unitPrice==null);
    const knownTotal = (selected.length ? (prices.iceCream[sizeInput().value] || 0) : 0)
      + addonTotal()
      + [...treats.values(),...edibles.values()].reduce((sum,item)=>sum+(item.unitPrice||0)*item.quantity,0);
    document.querySelector('.summary-price span').textContent = unpricedItems.length ? 'Subtotal conocido' : 'Total estimado';
    document.querySelector('.summary-price strong').textContent = '$' + knownTotal.toLocaleString('es-AR');
    document.querySelector('.summary-price small').textContent = unpricedItems.length ? 'Hay productos sin precio publicado; se confirman por WhatsApp. Env�o seg�n la zona.' : 'Salsas sin costo. El env�o se calcula seg�n la zona.';
  }

  function addFlavor(name) {
    const p = products.find(x => x.name === name);
    if (!p || !available(p)) return feedback(`${name} no est� disponible en este momento.`);
    if (selected.includes(name)) return feedback(`${name} ya est� en tu selecci�n.`);
    if (selected.length >= maxFlavors()) return feedback(`Para ${sizeInput().value} pod�s elegir hasta ${maxFlavors()} sabores.`);
    selected.push(name); feedback(''); drawSelected();
  }
  function addQuantity(map,name,delta=1) {
    const p = products.find(x => x.name === name);
    if (!p || !available(p)) return feedback(`${name} no est� disponible en este momento.`);
    const next = (map.get(name)||0)+delta;
    if (next <= 0) map.delete(name); else map.set(name,next);
    feedback(''); drawSelected();
  }
  function addLineItem(map,name,presentationValue,delta=1) {
    const product=products.find(p=>p.name===name);
    if(!product||!available(product)) return feedback(`${name} no est� disponible en este momento.`);
    const presentation=getPresentations(product).find(x=>x.value===presentationValue)||getPresentations(product)[0];
    const key=`${name}::${presentation.value}`;
    const next=(map.get(key)?.quantity||0)+delta;
    if(next<=0) map.delete(key); else map.set(key,{name,presentation:presentation.label,quantity:next,unitPrice:unitPrice(product,presentation.value)});
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
    return `${item.quantity} � ${item.presentation.toLocaleLowerCase('es')} de ${item.name}`;
  }
  function addAddon(name) {
    if (!selected.length) return feedback('Eleg� un helado antes de agregar un cucurucho o una tacita.');
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
    if (selected.length > maxFlavors()) { selected.splice(maxFlavors()); feedback(`Se ajust� la selecci�n al m�ximo de ${maxFlavors()} sabores para este tama�o.`); }
    drawSelected();
  }));
  document.getElementById('whatsapp-order').addEventListener('click', () => {
    if (!selected.length && !treats.size && !edibles.size) return;
    const selectedDelivery = document.querySelector('[name="delivery"]:checked').value;
    if (selectedDelivery.startsWith('Env�o') && !addressInput.value.trim()) {
      addressInput.setCustomValidity('Ingres� la direcci�n para coordinar el env�o.');
      addressInput.reportValidity();
      addressInput.focus();
      return;
    }
    addressInput.setCustomValidity('');
    let lines = [];
    if (addons.size) lines.push(`Precio de cucuruchos y tacitas: $${addonTotal().toLocaleString('es-AR')}`);
    const unpriced = [...treats.values(),...edibles.values()].some(item=>item.unitPrice==null);
    const estimatedTotal = (selected.length ? (prices.iceCream[sizeInput().value] || 0) : 0)
      + addonTotal()
      + [...treats.values(),...edibles.values()].reduce((sum,item)=>sum+(item.unitPrice||0)*item.quantity,0);
    lines.push('', `${unpriced ? 'Subtotal de productos con precio' : 'Total estimado'}: $${estimatedTotal.toLocaleString('es-AR')}`, 'Salsas: sin costo. El env�o se calcula seg�n la zona.');
    const delivery = document.querySelector('[name="delivery"]:checked').value;
    const payment = document.querySelector('[name="payment"]:checked').value;
    const address = document.getElementById('address').value.trim();
    const notes = document.getElementById('notes').value.trim();
    lines.unshift('�Hola, Caribe! Quiero hacer este pedido:');
    if (selected.length) {
      lines.push('',` Helado de ${sizeInput().value}`,` Gustos: ${selected.join(', ')}`);
      if (selectedSauces.size) lines.push(` Salsas: ${[...selectedSauces].join(', ')}`);
      if (addons.size) lines.push(` Para acompa�ar el helado: ${[...addons].map(([name,qty])=>`${qty} � ${name}`).join(', ')}`);
    }
    if (treats.size) lines.push('', ' Tentaciones:', ...[...treats.values()].map(item => `  - ${formatLine(item)}`));
    if (edibles.size) lines.push('', ' Comestibles:', ...[...edibles.values()].map(item => `  - ${formatLine(item)}`));
    lines.push('',` ${delivery}`);
    if (delivery.startsWith('Env�o') && address) lines.push(` Direcci�n: ${address}`);
    if (notes) lines.push(` Detalle: ${notes}`);
    lines.push('', '�Me confirman disponibilidad y precio?');
    const message = ['�Hola! Quisiera hacer este pedido en Caribe:', ''];
    if (selected.length) {
      message.push(`Helado (${sizeInput().value}): ${selected.join(', ')}`);
      if (selectedSauces.size) message.push(`Salsa: ${[...selectedSauces].join(', ')}`);
      if (addons.size) message.push(`Cucuruchos y tacitas: ${[...addons].map(([name,qty])=>`${qty} x ${name}`).join(', ')}`);
    }
    if (treats.size) message.push('', 'Tentaciones:', ...[...treats.values()].map(item=>`- ${formatLine(item)}`));
    if (edibles.size) message.push('', 'Comestibles:', ...[...edibles.values()].map(item=>`- ${formatLine(item)}`));
    message.push('', `Total del pedido: $${estimatedTotal.toLocaleString('es-AR')}${unpriced ? ' (hay productos con precio a confirmar)' : ''}`);
    message.push('', delivery.startsWith('Env\u00edo') ? 'Modalidad: Entrega a domicilio' : 'Modalidad: Retiro en el local');
    if (delivery.startsWith('Env\u00edo') && address) message.push(`Direcci\u00f3n: ${address}`);
    message.push(`Forma de pago: ${payment}`);
    if (notes) message.push(`Detalle: ${notes}`);
    if (delivery.startsWith('Env\u00edo')) {
      message.push('', payment === 'Transferencia'
        ? '�Me indican cu�nto cuesta el env�o y cu�l es el alias para transferir?'
        : '�Me indican cu�nto cuesta el env�o? Abono en efectivo al recibir.');
    } else if (payment === 'Transferencia') {
      message.push('', '�Me indican cu�l es el alias para transferir?');
    } else {
      message.push('', 'Abono en efectivo al retirar.');
    }
    window.open(`https://wa.me/543775415447?text=${encodeURIComponent(message.join('\n'))}`, '_blank', 'noopener,noreferrer');
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
  toggle.addEventListener('click',()=>{const nav=document.querySelector('.main-nav');const open=nav.classList.toggle('open');toggle.setAttribute('aria-expanded',String(open));toggle.textContent=open?'�':'?';});
  document.querySelectorAll('.main-nav a').forEach(a=>a.addEventListener('click',()=>{document.querySelector('.main-nav').classList.remove('open');toggle.setAttribute('aria-expanded','false');toggle.textContent='?';}));
  document.getElementById('year').textContent=new Date().getFullYear();
})();

