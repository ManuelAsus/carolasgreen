# Carolas Green - Sistema de Tienda Online

## Descripción
Sistema completo de tienda online para Carolas Green, una tienda de comida orgánica. Incluye página principal responsiva, carrito de compras, gestión de pedidos, panel de administrador, seguimiento de entregas y más.

## 📁 Estructura del Proyecto

```
web/
├── index.html                 # Página principal
├── css/
│   ├── style.css             # Estilos principales
│   └── responsive.css        # Estilos responsivos
├── js/
│   ├── firebase-config.js    # Configuración de Firebase
│   ├── main.js               # Lógica principal de la página
│   └── carrito.js            # Lógica del carrito
└── admin/
    ├── index.html            # Panel de administrador
    ├── css/
    │   └── admin-style.css   # Estilos del panel admin
    └── js/
        └── admin-main.js     # Lógica del panel admin
```

## 🚀 Características Principales

### Para Clientes
- ✅ Página principal atractiva y responsiva
- ✅ Catálogo de productos con filtros
- ✅ Carrito de compras
- ✅ Sistema de pedidos sin necesidad de cuenta
- ✅ Métodos de pago: Transferencia o Efectivo
- ✅ Seguimiento de estado del pedido
- ✅ Sistema de comentarios
- ✅ Información de contacto y ubicación
- ✅ Diseño 100% responsivo (móvil, tablet, desktop)

### Para Administrador
- ✅ Autenticación segura
- ✅ Dashboard con estadísticas
- ✅ Gestión de pedidos (crear, ver, cambiar estado)
- ✅ Gestión de productos (CRUD completo)
- ✅ Modulación de comentarios
- ✅ Seguimiento de entregas en tiempo real
- ✅ Chat con clientes
- ✅ Control de stock

## 🔧 Instalación y Configuración

### 1. Requisitos
- Un navegador web moderno
- Acceso a internet
- Cuenta en Firebase

### 2. Configuración de Firebase
El sistema ya tiene la configuración de Firebase incluida. Los datos de conexión están en:
- `web/js/firebase-config.js`

Asegúrate de que Firebase esté configurado con:
- ✅ Firestore (Lectura y escritura habilitadas)
- ✅ Autenticación por Email/Contraseña
- ✅ Storage para imágenes

### 3. Abrir la Aplicación
1. Abre `web/index.html` en tu navegador
2. Para acceder al panel admin, haz clic en "Admin" en la navegación

### 4. Crear Usuario Admin
En Firebase Console:
1. Ir a Autenticación > Usuarios
2. Crear nuevo usuario con email y contraseña
3. Usar esas credenciales para iniciar sesión en el panel admin

## 📱 Responsividad

El sistema está optimizado para:
- 📱 Móviles (hasta 480px)
- 📱 Móviles grandes (480px - 768px)
- 📊 Tablets (768px - 1024px)
- 💻 Desktops (1024px+)

## 🎨 Paleta de Colores

```
Verde Oscuro: #798839 (Principal)
Verde Claro:  #babd6f (Secundario)
Amarillo:     #dbb42a (Acentos)
Azul Claro:   #e5e1d9 (Fondo)
Gris:         #6b7960 / #c4bbb5 (Texto)
```

## 💳 Métodos de Pago

1. **Transferencia Bancaria**
   - Cliente sube comprobante de pago
   - Datos de transferencia mostrados en checkout
   - Archivo guardado en Firebase Storage

2. **Efectivo en Domicilio**
   - El repartidor cobra al llegar
   - No requiere comprobante

## 🔐 Seguridad

- Firebase maneja la autenticación segura
- Firestore con reglas de seguridad configuradas
- Contraseñas encriptadas
- Datos de clientes protegidos

## 📊 Base de Datos (Firestore)

### Colecciones

#### `productos`
```json
{
  "nombre": "string",
  "categoria": "comidas|bebidas|postres|licuados",
  "precio": "number",
  "ingredientes": "string",
  "stock": "number",
  "imagen": "string (URL)",
  "creado": "timestamp"
}
```

#### `pedidos`
```json
{
  "nombre": "string",
  "telefono": "string",
  "direccion": "string",
  "metodoPago": "transferencia|efectivo",
  "comprobante": "string (URL de archivo)",
  "items": [
    {
      "id": "string",
      "nombre": "string",
      "precio": "number",
      "cantidad": "number"
    }
  ],
  "total": "number",
  "estado": "pendiente|visto|preparacion|camino|completado",
  "fecha": "timestamp",
  "visto": "boolean"
}
```

#### `comentarios`
```json
{
  "nombre": "string",
  "email": "string",
  "texto": "string",
  "fecha": "timestamp",
  "aprobado": "boolean"
}
```

#### `chat` (opcional - para Realtime Database)
```json
{
  "clienteId": "string",
  "mensajes": [
    {
      "remitente": "cliente|admin",
      "texto": "string",
      "timestamp": "timestamp"
    }
  ]
}
```

## 🚚 Estados del Pedido

1. **Pendiente** - Pedido recibido, esperando revisión
2. **Visto** - Administrador ha visto el pedido
3. **En Preparación** - Se está preparando
4. **En Camino** - En camino hacia el cliente
5. **Completado** - Pedido entregado

## 💬 Chat

El sistema incluye un módulo de chat para que el administrador se comunique directamente con los clientes. Los mensajes se pueden guardar en Realtime Database.

## 🗺️ Ubicación del Negocio

- **Dirección**: Cto. Laguna Saquila 19, Bajo Usumacinta, 86981 Emiliano Zapata, Tab.
- **Teléfono**: 9341154258
- **Mapa embebido**: Google Maps con ubicación

## 📝 Notas de Desarrollo

- El carrito se guarda en `localStorage` del navegador
- Los pedidos se almacenan en Firestore
- Las imágenes se suben a Firebase Storage
- La geolocalización es opcional en el checkout

## 🔄 Próximas Mejoras Sugeridas

- [ ] Sistema de cupones y promociones
- [ ] Notificaciones por email
- [ ] Reportes de ventas
- [ ] Integración de pasarelas de pago online
- [ ] App móvil nativa
- [ ] Sistema de reseñas de productos
- [ ] Historial de compras del cliente

## 📞 Soporte

Para soporte técnico o reportar problemas, contacta con el equipo de desarrollo.

---

**Carolas Green** - Comida Saludable y Orgánica ❤️🥗
