(() => {
  const stock = window.CARIBE_STOCK;
  const products = window.CARIBE_PRODUCTS || [];
  const sauces = window.CARIBE_SAUCES || [];
  const groups = [
    {title:'Gustos de helado',items:products.filter(p=>p.group==='helados').map(p=>({name:p.name,type:'products'}))},
    {title:'Tentaciones',items:products.filter(p=>p.group==='tentaciones').map(p=>({name:p.name,type:'products'}))},
    {title:'Comestibles',items:products.filter(p=>p.group==='comestibles').map(p=>({name:p.name,type:'products'}))},
    {title:'Salsas',items:sauces.map(name=>({name,type:'sauces'}))}
  ];
  const root=document.getElementById('stock-groups');
  function render(){
    root.innerHTML=groups.map(group=>`<section class="stock-group"><h2>${group.title}</h2><div class="stock-list">${group.items.map(item=>{const checked=stock.isAvailable(item.type,item.name);return `<label class="stock-row"><span>${item.name}</span><span class="stock-toggle"><input type="checkbox" data-type="${item.type}" data-name="${item.name.replace(/&/g,'&amp;').replace(/"/g,'&quot;')}" ${checked?'checked':''}><b>${checked?'Disponible':'Agotado'}</b></span></label>`;}).join('')}</div></section>`).join('');
    root.querySelectorAll('input[type="checkbox"]').forEach(input=>input.addEventListener('change',()=>{stock.setAvailable(input.dataset.type,input.dataset.name,input.checked);input.nextElementSibling.textContent=input.checked?'Disponible':'Agotado';}));
  }
  document.getElementById('reset-stock').addEventListener('click',()=>{stock.reset();render();});
  window.addEventListener('caribe-stock-changed',render);
  render();
})();
