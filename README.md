# Sitio de Heladería Caribe

Sitio estático para Caribe, heladería artesanal de Monte Caseros, Corrientes. La web puede seguir alojada en GitHub Pages; Supabase almacena la disponibilidad compartida.

## Conectar Supabase

El código está preparado, pero todavía necesita los datos de un proyecto Supabase. Hasta completarlos, el panel queda en modo local y los cambios solo se guardan en el navegador actual.

1. Crear un proyecto en Supabase.
2. En **Authentication → Users**, crear el usuario del local con correo y contraseña. La contraseña se usa para iniciar sesión en el panel y no hace falta compartirla.
3. Abrir `supabase-setup.sql`, reemplazar `ADMIN_EMAIL` por el correo exacto del usuario creado y ejecutar el archivo completo en **SQL Editor**. Esto crea el inventario, protege las escrituras para usuarios autorizados y activa las actualizaciones en tiempo real.
4. En **Project Settings → API Keys** (o **Connect**), copiar el **Project URL** y la **publishable key**. Pegarlos en `supabase-config.js` en `url` y `publishableKey`.
5. Probar `stock.html`: iniciar sesión, cambiar un producto y confirmar que el menú abierto en otro navegador recibe el cambio.
6. Cuando la prueba esté correcta, publicar los archivos actualizados en GitHub Pages.

No colocar una **secret key** en `supabase-config.js` ni en ningún archivo que se publique. La publishable key puede estar en el frontend porque las políticas de Row Level Security restringen lo que puede hacer cada usuario. No habilitar altas públicas de usuarios; crear las cuentas del equipo desde el panel de Supabase.

## Cómo funciona el inventario

El menú público puede leer la disponibilidad de productos y salsas. Solo una cuenta incluida en `stock_admins` puede cambiarla desde `stock.html`. Los cambios se guardan en Supabase y se distribuyen a clientes con la página abierta mediante Realtime; si el cliente abre el sitio después, lee el estado más reciente.

## Otros detalles

- `products.js` contiene sabores, tentaciones, comestibles y salsas.
- Los pedidos se preparan como mensaje para WhatsApp, para revisar y enviar.
- Los precios aún deben incorporarse desde la lista vigente; la página indica consulta por WhatsApp mientras tanto.
- `supabase-setup.sql` contiene el esquema y las políticas de seguridad.
