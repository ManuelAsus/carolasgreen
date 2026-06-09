# 🚀 INICIO RÁPIDO - Carolas Green

## Paso 1: Abrir la Aplicación

### Opción A: Desde tu navegador (Recomendado)
1. Navega a la carpeta `web`
2. Haz doble clic en `index.html`
3. ¡Listo! La página se abre

### Opción B: Usar un servidor local
1. Abre terminal en la carpeta `web`
2. Ejecuta: `python -m http.server 8000` (Python 3)
3. O: `php -S localhost:8000` (si tienes PHP)
4. Abre: http://localhost:8000

## Paso 2: Preparar el Panel de Admin

### Crear usuario admin en Firebase
1. Ve a: https://console.firebase.google.com
2. Selecciona proyecto: **carolasgreen**
3. Ir a: **Autenticación > Usuarios**
4. Haz clic en **"Crear usuario"**
5. Email: `admin@carolasgreen.com`
6. Contraseña: `admin123456` (o tu contraseña)
7. Haz clic en **"Crear"**

## Paso 3: Acceder al Panel Admin

1. Abre: `web/admin/` (o `web/admin/login.html`)
2. Inicia sesión con:
   - Email: `admin@carolasgreen.com`
   - Contraseña: `admin123456`
3. ¡Bienvenido al panel!

**📖 Guía completa**: Lee `web/admin/GUIA_ADMIN.md`

## Paso 4: Agregar Productos (PRIMERO)

Antes de que los clientes vean productos, el admin debe agregarlos.

### Instrucciones:
1. En el panel admin (ya logeado)
2. En el menú izquierdo, haz clic en **"Productos"**
3. Haz clic en **"+ Agregar Producto"**
4. Completa:
   - Nombre: Ej: "Ensalada Verde"
   - Categoría: Comidas
   - Precio: Ej: 85.50
   - Ingredientes: Ej: "Lechuga, tomate, cebolla..."
   - Stock: Ej: 20
   - Imagen: (opcional) Copia una URL de imagen
5. Haz clic en "Guardar Producto"

Repite para agregar varios productos.

## Paso 5: Probar la Página Principal

1. Abre `web/index.html`
2. Verás:
   - ✅ Header con logo y menú
   - ✅ Sección Hero
   - ✅ Productos que agregaste (filtrados por categoría)
   - ✅ Botón "Sobre Nosotros"
   - ✅ Sección de comentarios
   - ✅ Ubicación y contacto

## Paso 5: Probar Carrito y Pedidos

1. En la página principal
2. Haz clic en un producto
3. Escoge cantidad
4. Haz clic en **"Añadir"**
5. Verás la cantidad en el icono del carrito
6. Haz clic en el carrito
7. Verás tus items
8. Haz clic en **"Proceder a Checkout"**
9. Completa:
   - Nombre Completo
   - Teléfono
   - Dirección (o se detecta automática)
   - Método de Pago:
     - **Transferencia**: Sube comprobante
     - **Efectivo**: Sin comprobante
10. Haz clic en **"Realizar Pedido"**
11. ¡Tu pedido está creado! Se genera un ID único

## Paso 6: Ver Pedidos en Admin

1. Abre el panel admin: `web/admin/index.html`
2. Login con tu usuario admin
3. Menú izquierdo: **"Pedidos"**
4. Verás todos los pedidos
5. Puedes:
   - Marcar como "Visto"
   - Cambiar a "En Preparación"
   - Cambiar a "En Camino"
   - Marcar como "Completado"
   - Ver comprobante (si usó transferencia)
   - Eliminar

## Paso 7: Dashboard

En el panel admin, selecciona **"Dashboard"**

Verás:
- Total de pedidos
- Pedidos pendientes
- Pedidos completados
- Ventas totales
- Últimos 5 pedidos

## Paso 8: Funciones Adicionales

### Comentarios
- Clientes pueden dejar comentarios en la página
- Admin ve comentarios y puede aprobarlos o eliminarlos
- Menú: **"Comentarios"**

### Entregas
- Cuando un pedido está "En Camino"
- Admin puede verlo en **"Entregas"**
- Se muestra ubicación en Google Maps
- Se puede hacer clic para abrir en Maps

### Chat
- Admin puede chatear con clientes
- Menú: **"Chat"**
- Selecciona cliente y escribe mensaje

## 🔑 Credenciales de Firebase

La aplicación ya tiene configuradas las credenciales de Firebase. Están en:
- Archivo: `web/js/firebase-config.js`
- Proyecto: **carolasgreen**

## 📱 Probando en Móvil

El sitio es 100% responsivo. Para probar:

1. **En tu celular**: Abre la IP de tu computadora
   - Ejemplo: http://192.168.1.100:8000

2. **En Chrome (emulador)**:
   - Abre las DevTools (F12)
   - Haz clic en el icono de "Toggle device toolbar"
   - Selecciona dispositivo móvil
   - ¡A probar!

## ❓ Solución de Problemas

### "No puedo iniciar sesión en admin"
- ✅ Verifica que creaste usuario en Firebase
- ✅ Verifica que la conexión a internet está activa
- ✅ Recarga la página (F5)

### "No veo productos"
- ✅ Necesitas crear productos primero
- ✅ Ve a Admin > Productos > Agregar
- ✅ Recarga la página principal

### "Los cambios no se guardan"
- ✅ Verifica conexión a Firebase
- ✅ Mira la consola (F12 > Console) para errores

### "Imágenes no cargan"
- ✅ Verifica que Firebase Storage está habilitado
- ✅ Las imágenes se guardan en el Storage

## 📝 Notas Importantes

- El carrito se guarda localmente (no desaparece si recargas)
- Los pedidos se guardan en Firebase (permanentes)
- Los comentarios requieren aprobación del admin
- Las imágenes se suben a Firebase Storage
- El sistema usa Google Maps para ubicación

## 🎨 Personalización

### Cambiar Colores
Abre: `web/css/style.css`
Busca: `:root { ... }`
Modifica los colores:
```css
--color-verde-oscuro: #798839;
--color-verde-claro: #babd6f;
--color-amarillo: #dbb42a;
```

### Cambiar Logo
1. Reemplaza la imagen en: `LOGO/logo.jpg`
2. O modifica la ruta en `web/index.html` (línea del logo)

### Cambiar Información de Contacto
Abre: `web/index.html`
Busca: "Contacto" (línea ~150)
Actualiza:
- Dirección
- Teléfono
- Mapa

## 🚀 Próximos Pasos

Después de estas pruebas, puedes:

1. **Añadir más productos**
2. **Customizar estilos** según tu marca
3. **Configurar métodos de pago** reales
4. **Integrar email notifications**
5. **Publicar en un servidor** real

---

¡Eso es todo! El sistema está listo para usar. 🎉

Si tienes preguntas, revisa el `README.md` para más detalles técnicos.

**¡Bienvenido a Carolas Green!** 🥗❤️
