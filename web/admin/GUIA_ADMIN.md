# 🔐 Panel Administrativo - Guía Completa

## Acceso al Panel

1. **Abre**: `web/admin/` 
2. **Automáticamente redirige a**: `web/admin/login.html`
3. **Inicia sesión con**:
   - Email: `admin@example.com` (tu usuario en Firebase)
   - Contraseña: Tu contraseña en Firebase

## 🔑 Crear tu Usuario Admin en Firebase

Antes de usar el panel, necesitas un usuario admin en Firebase:

1. Ve a: https://console.firebase.google.com
2. Selecciona proyecto: **carolasgreen**
3. Ir a: **Autenticación > Usuarios**
4. Haz clic en **"Crear usuario"**
5. Completa:
   - Email: `admin@carolasgreen.com` (o tu email)
   - Contraseña: `admin123456` (o tu contraseña)
6. Haz clic en **"Crear"**

Usa estas credenciales para iniciar sesión en el panel.

## 📋 Panel Principal - Dashboard

Al entrar, verás:

### Estadísticas
- 📦 **Pedidos Totales** - Número total de pedidos
- ⏳ **Pedidos Pendientes** - Esperando revisión
- ✅ **Pedidos Completados** - Pedidos entregados
- 💰 **Ventas Totales** - Monto total de dinero

### Pedidos Recientes
Los últimos 5 pedidos realizados con opciones para cambiar estado.

## 🛠️ Secciones del Panel

### 1️⃣ DASHBOARD
- Vista general del negocio
- Estadísticas en tiempo real
- Últimos pedidos

### 2️⃣ PRODUCTOS (Gestión)

#### ➕ Agregar Producto
1. Haz clic en **"+ Agregar Producto"**
2. Completa:
   - **Nombre**: Ej: "Ensalada Verde Orgánica"
   - **Categoría**: Comidas, Bebidas, Postres, Licuados
   - **Precio**: Ej: 85.50
   - **Ingredientes**: Ej: "Lechuga, tomate, zanahoria, aderezo casero"
   - **Stock**: Ej: 20
   - **Imagen**: URL de la imagen (ej: https://ejemplo.com/imagen.jpg)
3. Haz clic en **"Guardar Producto"**

#### 📝 Editar Producto
1. Busca el producto en la lista
2. Haz clic en **"Editar"**
3. Modifica los datos
4. Haz clic en **"Guardar Cambios"**

#### 🗑️ Eliminar Producto
1. Busca el producto
2. Haz clic en **"Eliminar"**
3. Confirma

### 3️⃣ PEDIDOS (Gestión)

#### 🔍 Ver Pedidos
- Verás todos los pedidos de clientes
- Puedes buscar por nombre o teléfono
- Puedes filtrar por estado

#### 📊 Cambiar Estado del Pedido
Haz clic en los botones para cambiar estado:
1. **Marcar Visto** - Ya viste el pedido
2. **En Preparación** - Estás preparando los productos
3. **En Camino** - El repartidor va hacia el cliente
4. **Completado** - Pedido entregado
5. **Eliminar** - Borrar el pedido (cuidado)

#### 📦 Información del Pedido
Cada pedido muestra:
- 👤 Nombre del cliente
- 📞 Teléfono
- 🏠 Dirección
- 💳 Método de pago
- 📅 Fecha y hora
- 💰 Total
- 🧾 Artículos comprados
- 📄 Comprobante (si pagó por transferencia)

### 4️⃣ COMENTARIOS (Moderación)

#### 👀 Ver Comentarios
- Verás comentarios de clientes
- Mostrados con estado (Pendiente/Aprobado)

#### ✅ Aprobar Comentario
1. Busca comentario pendiente
2. Haz clic en **"Aprobar"**
3. El comentario aparecerá en la página principal

#### 🗑️ Eliminar Comentario
1. Haz clic en **"Eliminar"**
2. Se eliminará del sistema

## 📲 Flujo de un Pedido Típico

1. **Cliente hace pedido** → Estado: "Pendiente"
2. **Ves el pedido** → Haces clic: "Marcar Visto" → Estado: "Visto"
3. **Empiezas a preparar** → Haces clic: "En Preparación"
4. **Terminas y repartidor sale** → Haces clic: "En Camino"
5. **Cliente recibe** → Haces clic: "Completado" → ✅ Listo

## 🚨 Problemas Comunes

### "No puedo iniciar sesión"
- ✅ Verifica email correcto
- ✅ Verifica contraseña correcta
- ✅ Asegúrate de haber creado el usuario en Firebase
- ✅ Recarga la página (F5)

### "No veo datos"
- ✅ Espera a que cargue (hasta 5 segundos)
- ✅ Abre la consola (F12) para ver errores
- ✅ Verifica conexión a internet

### "No puedo agregar productos"
- ✅ Todos los campos son requeridos
- ✅ El precio debe ser un número (ej: 85.50)
- ✅ Stock debe ser un número entero (ej: 10)

### "La imagen no aparece"
- ✅ Usa una URL válida (https://...)
- ✅ Verifica que la imagen sea pública
- ✅ Tipos soportados: JPG, PNG, GIF

## 💾 Datos Guardados

Todos los datos se guardan automáticamente en Firebase:

- **Productos** → Colección "productos"
- **Pedidos** → Colección "pedidos"
- **Comentarios** → Colección "comentarios"

## 🔒 Seguridad

- Solo tú puedes acceder con tu usuario/contraseña
- Los datos se envían encriptados a Firebase
- No compartas tus credenciales

## ⚙️ Configuración Avanzada

### Cambiar Categorías de Productos
En `web/admin/dashboard.html`, busca:
```html
<option value="comidas">Comidas</option>
<option value="bebidas">Bebidas</option>
<option value="postres">Postres</option>
<option value="licuados">Licuados</option>
```
Modifica según necesites.

### Agregar Más Secciones
Edita `web/admin/dashboard.html` y `web/admin/js/admin-dashboard.js` para agregar nuevas funcionalidades.

## 📞 Soporte

Si tienes problemas:
1. Abre la consola (F12 > Console)
2. Anota el mensaje de error
3. Revisa la guía anterior
4. Contacta soporte técnico

---

## ✅ Checklist para Comenzar

- [ ] Crear usuario admin en Firebase
- [ ] Iniciar sesión en panel
- [ ] Agregar primeros 5 productos
- [ ] Probar flujo de pedido
- [ ] Aprobar comentarios
- [ ] Cambiar estados de pedidos

¡Listo para usar! 🎉

---

**Carolas Green Admin Panel** - Gestión fácil y rápida
