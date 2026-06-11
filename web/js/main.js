// Importar Firebase
import { db, storage } from './firebase-config.js';
import { 
    collection, 
    getDocs, 
    addDoc, 
    query, 
    where,
    deleteDoc,
    doc,
    getDoc,
    updateDoc,
    orderBy,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import { 
    ref, 
    uploadBytes, 
    getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-storage.js";

// ============================================
// VARIABLES GLOBALES
// ============================================

let productos = [];
let filtroActivo = 'todos';
let comentarios = [];
let menus = [];
let galeria = [];
let listenerPedidosActivo = false;

// ============================================
// INICIALIZAR APLICACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 DOMContentLoaded - Iniciando aplicación...');
    
    // Configurar listeners primero
    setupEventListeners();
    setupNavbar();
    
    // Cargar datos (esperar a que terminen)
    await cargarProductos();
    await cargarComentarios();
    await cargarMenus();
    await cargarGaleria();
    await cargarConfiguracion();
    cargarMisPedidos();
    
    // Iniciar listener en tiempo real después de cargar mis pedidos
    iniciarListenerPedidosEnTiempoReal();
    
    // Restaurar estado de checkout si existe
    restaurarEstadoCheckout();
    
    console.log('✅ Aplicación lista');
});

// ============================================
// SETUP NAVBAR
// ============================================

function setupNavbar() {
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    const carritoBtn = document.querySelector('.carrito-btn');
    const adminBtn = document.querySelector('.admin-btn');

    hamburger.addEventListener('click', () => {
        navLinks.classList.toggle('show');
        hamburger.classList.toggle('active');
    });

    // Cerrar menú al hacer click en un link
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('show');
            hamburger.classList.remove('active');
        });
    });

    // Cerrar menú cuando se hace click fuera
    document.addEventListener('click', (e) => {
        if (!hamburger.contains(e.target) && !navLinks.contains(e.target)) {
            navLinks.classList.remove('show');
            hamburger.classList.remove('active');
        }
    });

    // Carrito
    carritoBtn.addEventListener('click', (e) => {
        e.preventDefault();
        abrirModal('carritoModal');
    });

    // Admin
    adminBtn.addEventListener('click', (e) => {
        // Mantener la navegación normal
    });
}

// ============================================
// CARGAR PRODUCTOS
// ============================================

async function cargarProductos() {
    try {
        const productosCollection = collection(db, 'productos');
        const snapshot = await getDocs(productosCollection);
        
        productos = [];
        snapshot.forEach(doc => {
            productos.push({
                id: doc.id,
                ...doc.data()
            });
        });

        mostrarProductos('todos');
        console.log('Productos cargados:', productos);
    } catch (error) {
        console.error('Error al cargar productos:', error);
        alert('Error al cargar los productos');
    }
}

// ============================================
// MOSTRAR PRODUCTOS
// ============================================

function mostrarProductos(filtro) {
    const grid = document.getElementById('productosGrid');
    grid.innerHTML = '';
    
    let productosFiltrados = productos;
    
    if (filtro !== 'todos') {
        productosFiltrados = productos.filter(p => p.categoria === filtro);
    }

    if (productosFiltrados.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 2rem; color: #798839;">No hay productos en esta categoría</p>';
        return;
    }

    productosFiltrados.forEach(producto => {
        const card = document.createElement('div');
        card.className = 'producto-card';
        
        const stockClass = producto.stock > 0 ? 'disponible' : 'agotado';
        const stockText = producto.stock > 0 ? `Stock: ${producto.stock}` : 'Agotado';

        card.innerHTML = `
            <div class="producto-img">
                ${producto.imagen ? `<img src="${producto.imagen}" alt="${producto.nombre}" style="width: 100%; height: 100%; object-fit: cover;">` : '🥗'}
            </div>
            <div class="producto-info">
                <div class="producto-nombre">${producto.nombre}</div>
                <div class="producto-precio">$${producto.precio.toFixed(2)}</div>
                <div class="producto-ingredientes">${producto.ingredientes || 'Sin ingredientes especificados'}</div>
                <div class="producto-stock ${stockClass}">${stockText}</div>
                <div class="producto-actions">
                    <input type="number" id="cantidad-${producto.id}" value="1" min="1" max="${producto.stock}" ${producto.stock === 0 ? 'disabled' : ''}>
                    <button class="btn-secondary" onclick="window.agregarAlCarrito('${producto.id}')" ${producto.stock === 0 ? 'disabled' : ''}>Añadir</button>
                    <button class="btn-primary" onclick="window.comprarAhora('${producto.id}')" ${producto.stock === 0 ? 'disabled' : ''}>Comprar</button>
                </div>
            </div>
        `;
        
        grid.appendChild(card);
    });
}

// ============================================
// FILTRAR PRODUCTOS
// ============================================

function setupEventListeners() {
    console.log('🔧 Configurando event listeners...');
    
    // Filtros
    document.querySelectorAll('.filtro-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filtroActivo = btn.getAttribute('data-filtro');
            mostrarProductos(filtroActivo);
        });
    });
    console.log('✅ Filtros configurados');

    // Formulario de comentarios
    const formComentario = document.getElementById('formComentario');
    if (formComentario) {
        formComentario.addEventListener('submit', enviarComentario);
        console.log('✅ Formulario de comentarios vinculado');
    }

    // Formulario de pedido
    const formPedido = document.getElementById('formPedido');
    if (formPedido) {
        formPedido.addEventListener('submit', realizarPedido);
        console.log('✅ Formulario de pedido vinculado');
    } else {
        console.error('❌ NO SE ENCONTRÓ el formulario #formPedido');
    }

    // Método de pago
    document.getElementById('metodoPago').addEventListener('change', (e) => {
        const comprobantePago = document.getElementById('comprobantePago');
        const datosTransferencia = document.getElementById('datosTransferencia');
        if (e.target.value === 'transferencia') {
            datosTransferencia.style.display = 'block';
            comprobantePago.style.display = 'block';
        } else {
            datosTransferencia.style.display = 'none';
            comprobantePago.style.display = 'none';
        }
        // Guardar estado cuando cambia el método de pago
        guardarEstadoCheckout();
    });

    // Guardar estado cuando se cambian los campos del formulario
    document.getElementById('nombrePedido').addEventListener('input', guardarEstadoCheckout);
    document.getElementById('telefonoPedido').addEventListener('input', guardarEstadoCheckout);
    document.getElementById('direccionPedido').addEventListener('input', guardarEstadoCheckout);

    // Cerrar modales
    document.querySelectorAll('.close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            modal.classList.remove('show');
            if (modal.id === 'checkoutModal') {
                limpiarEstadoCheckout();
            }
        });
    });

    // Cerrar modal al hacer click fuera
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
                if (modal.id === 'checkoutModal') {
                    limpiarEstadoCheckout();
                }
            }
        });
    });

    // Botón proceder a compra
    document.getElementById('procederCompra').addEventListener('click', () => {
        cerrarModal('carritoModal');
        abrirModal('checkoutModal');
    });
}

// ============================================
// CARRITO DE COMPRAS
// ============================================

function agregarAlCarrito(productoId) {
    const cantidad = parseInt(document.getElementById(`cantidad-${productoId}`).value) || 1;
    const producto = productos.find(p => p.id === productoId);
    
    if (!producto) return;

    let carrito = JSON.parse(localStorage.getItem('carrito')) || [];
    const existe = carrito.find(item => item.id === productoId);

    if (existe) {
        existe.cantidad += cantidad;
    } else {
        carrito.push({
            id: productoId,
            nombre: producto.nombre,
            precio: producto.precio,
            cantidad: cantidad,
            imagen: producto.imagen || ''
        });
    }

    localStorage.setItem('carrito', JSON.stringify(carrito));
    actualizarConteCarrito();
    
    alert(`${producto.nombre} añadido al carrito`);
}

function comprarAhora(productoId) {
    const cantidad = parseInt(document.getElementById(`cantidad-${productoId}`).value) || 1;
    const producto = productos.find(p => p.id === productoId);
    
    if (!producto) return;

    // Crear carrito temporal solo con este producto
    const carrito = [{
        id: productoId,
        nombre: producto.nombre,
        precio: producto.precio,
        cantidad: cantidad,
        imagen: producto.imagen || ''
    }];

    localStorage.setItem('carrito', JSON.stringify(carrito));
    actualizarConteCarrito();
    
    // Abrir modal de checkout
    abrirModal('checkoutModal');
}

function actualizarConteCarrito() {
    const carrito = JSON.parse(localStorage.getItem('carrito')) || [];
    const count = carrito.reduce((total, item) => total + item.cantidad, 0);
    document.querySelector('.carrito-count').textContent = count;
}

function mostrarCarrito() {
    const carrito = JSON.parse(localStorage.getItem('carrito')) || [];
    const carritoItems = document.getElementById('carritoItems');
    const totalCarrito = document.getElementById('totalCarrito');
    
    carritoItems.innerHTML = '';
    let total = 0;

    if (carrito.length === 0) {
        carritoItems.innerHTML = '<p style="padding: 1rem; text-align: center; color: #798839;">Tu carrito está vacío</p>';
        totalCarrito.textContent = '0.00';
        return;
    }

    carrito.forEach(item => {
        const itemTotal = item.precio * item.cantidad;
        total += itemTotal;

        const itemDiv = document.createElement('div');
        itemDiv.className = 'carrito-item';
        itemDiv.innerHTML = `
            <div class="carrito-item-layout">
                <div class="carrito-item-thumb">
                    ${item.imagen ? `<img src="${item.imagen}" alt="${item.nombre}" class="carrito-item-img">` : '<div class="carrito-item-img-placeholder">🥗</div>'}
                </div>
                <div class="carrito-item-info">
                    <div class="carrito-item-nombre">${item.nombre}</div>
                    <div class="carrito-item-precio">$${item.precio.toFixed(2)} x ${item.cantidad} = $${itemTotal.toFixed(2)}</div>
                </div>
            </div>
            <div class="carrito-item-acciones">
                <input type="number" value="${item.cantidad}" min="1" onchange="actualizarCantidad('${item.id}', this.value)">
                <button class="btn-danger" onclick="eliminarDelCarrito('${item.id}')">Eliminar</button>
            </div>
        `;
        carritoItems.appendChild(itemDiv);
    });

    totalCarrito.textContent = total.toFixed(2);
}

function actualizarCantidad(productoId, cantidad) {
    const carrito = JSON.parse(localStorage.getItem('carrito')) || [];
    const item = carrito.find(i => i.id === productoId);
    
    if (item) {
        item.cantidad = Math.max(1, parseInt(cantidad));
        localStorage.setItem('carrito', JSON.stringify(carrito));
        actualizarConteCarrito();
        mostrarCarrito();
    }
}

function eliminarDelCarrito(productoId) {
    let carrito = JSON.parse(localStorage.getItem('carrito')) || [];
    carrito = carrito.filter(item => item.id !== productoId);
    localStorage.setItem('carrito', JSON.stringify(carrito));
    actualizarConteCarrito();
    mostrarCarrito();
}

// ============================================
// COMENTARIOS
// ============================================

async function cargarComentarios() {
    try {
        const comentariosCollection = collection(db, 'comentarios');
        const q = query(comentariosCollection, orderBy('fecha', 'desc'));
        const snapshot = await getDocs(q);
        
        comentarios = [];
        snapshot.forEach(doc => {
            comentarios.push({
                id: doc.id,
                ...doc.data()
            });
        });

        mostrarComentarios();
    } catch (error) {
        console.error('Error al cargar comentarios:', error);
    }
}

function mostrarComentarios() {
    const lista = document.getElementById('listaComentarios');
    lista.innerHTML = '';

    comentarios.forEach(comentario => {
        const fecha = new Date(comentario.fecha?.toDate?.() || comentario.fecha).toLocaleDateString('es-MX');
        
        const div = document.createElement('div');
        div.className = 'comentario-item';
        div.innerHTML = `
            <div class="comentario-autor">${comentario.nombre}</div>
            <div class="comentario-texto">${comentario.texto}</div>
            <div class="comentario-fecha">${fecha}</div>
        `;
        lista.appendChild(div);
    });
}

async function enviarComentario(e) {
    e.preventDefault();

    const nombre = document.getElementById('nombreComentario').value;
    const email = document.getElementById('emailComentario').value;
    const texto = document.getElementById('textoComentario').value;

    try {
        await addDoc(collection(db, 'comentarios'), {
            nombre: nombre,
            email: email,
            texto: texto,
            fecha: new Date(),
            aprobado: false
        });

        // Limpiar formulario
        document.getElementById('formComentario').reset();
        
        // Recargar comentarios
        await cargarComentarios();
        alert('Comentario enviado! Será revisado por el administrador.');
    } catch (error) {
        console.error('Error al enviar comentario:', error);
        alert('Error al enviar comentario');
    }
}

// ============================================
// MENÚS
// ============================================

async function cargarMenus() {
    try {
        const menusCollection = collection(db, 'menus');
        const snapshot = await getDocs(menusCollection);
        
        menus = [];
        snapshot.forEach(doc => {
            menus.push({
                id: doc.id,
                ...doc.data()
            });
        });

        mostrarMenus(menus);
    } catch (error) {
        console.error('Error al cargar menús:', error);
    }
}

function mostrarMenus(menus) {
    const grid = document.getElementById('menusGrid');
    if (!grid) return;
    
    grid.innerHTML = '';

    if (menus.length === 0) {
        grid.innerHTML = '<p>No hay menús disponibles</p>';
        return;
    }

    menus.forEach(menu => {
        const div = document.createElement('div');
        div.className = 'menu-card';
        
        let contenido = `
            <div class="menu-card-content" style="cursor: pointer;" onclick="abrirMenuModal('${menu.id}')">
                <h3>${menu.nombre}</h3>
        `;

        if (menu.imagen) {
            contenido += `<img src="${menu.imagen}" alt="${menu.nombre}" class="menu-card-image" style="cursor: pointer;">`;
            
            if (menu.tipo === 'pdf') {
                contenido += `
                    <p style="font-size: 0.9rem; color: #666; margin-top: 0.5rem; text-align: center;">📄 PDF - Haz clic para ver completo</p>
                `;
            } else {
                contenido += `
                    <p style="font-size: 0.9rem; color: #666; margin-top: 0.5rem; text-align: center;">🖼️ Haz clic para ver completo</p>
                `;
            }
        }

        contenido += `
            </div>
        `;

        div.innerHTML = contenido;
        grid.appendChild(div);
    });
}

// Función para abrir modal con menú completo
window.abrirMenuModal = function(menuId) {
    const menu = menus.find(m => m.id === menuId);
    
    if (!menu || !menu.imagen) {
        alert('No se puede cargar el menú');
        return;
    }
    
    const modalContent = document.getElementById('menuModalContent');
    modalContent.innerHTML = `
        <h2>${menu.nombre}</h2>
        <img src="${menu.imagen}" alt="${menu.nombre}" style="width: 100%; height: auto; margin-top: 1rem; border-radius: 10px;">
        <p style="text-align: center; margin-top: 1rem; color: #666;">
            ${menu.tipo === 'pdf' ? '📄 Menú PDF' : '🖼️ Menú Imagen'}
        </p>
    `;
    
    abrirModal('menuModal');
};

// Función para descargar imagen
window.descargarMenuImagen = function(imagenUrl, nombre) {
    if (!imagenUrl) {
        alert('No se puede descargar la imagen');
        return;
    }

    const link = document.createElement('a');
    link.href = imagenUrl;
    link.download = `${nombre}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// ============================================
// GALERÍA
// ============================================

async function cargarGaleria() {
    try {
        const galeriaCollection = collection(db, 'galeria');
        const snapshot = await getDocs(galeriaCollection);
        
        galeria = [];
        snapshot.forEach(doc => {
            galeria.push({
                id: doc.id,
                ...doc.data()
            });
        });

        mostrarGaleria(galeria);
    } catch (error) {
        console.error('Error al cargar galería:', error);
    }
}

function mostrarGaleria(galeria) {
    const grid = document.getElementById('galeriaGrid');
    if (!grid) return;
    
    grid.innerHTML = '';

    if (galeria.length === 0) {
        grid.innerHTML = '<p>No hay imágenes en la galería</p>';
        return;
    }

    galeria.forEach(imagen => {
        const div = document.createElement('div');
        div.className = 'galeria-card';
        div.innerHTML = `
            <img src="${imagen.url}" alt="${imagen.titulo || 'Imagen'}">
        `;
        grid.appendChild(div);
    });
}

// ============================================
// CONFIGURACIÓN (LOGO E IMAGEN PRINCIPAL)
// ============================================

async function cargarConfiguracion() {
    try {
        const configDoc = await getDoc(doc(db, 'configuracion', 'tienda'));
        
        if (configDoc.exists()) {
            const config = configDoc.data();
            
            // Cambiar logo
            if (config.logo) {
                const logoElement = document.getElementById('logoTienda');
                if (logoElement) {
                    logoElement.src = config.logo;
                }
            }
            
            // Cambiar imagen principal
            if (config.imagenPrincipal) {
                const imagenElement = document.getElementById('imagenPrincipal');
                if (imagenElement) {
                    imagenElement.src = config.imagenPrincipal;
                }
            }
        }
    } catch (error) {
        console.error('Error al cargar configuración:', error);
    }
}

// ============================================
// PEDIDOS
// ============================================

async function realizarPedido(e) {
    e.preventDefault();
    console.log('🚀 Iniciando realizarPedido()');

    const carritoRaw = localStorage.getItem('carrito');
    console.log('📦 Carrito raw desde localStorage:', carritoRaw);
    
    const carrito = JSON.parse(carritoRaw) || [];
    console.log('📦 Carrito parseado:', carrito);
    
    if (!carrito || carrito.length === 0) {
        alert('❌ Tu carrito está vacío');
        return;
    }

    // Validar que todos los items tengan la estructura correcta
    const carritoValido = carrito.every(item => item.nombre && item.precio && item.cantidad);
    if (!carritoValido) {
        console.error('❌ Carrito con estructura inválida:', carrito);
        alert('❌ Error: Carrito corrupto. Intenta nuevamente.');
        return;
    }

    const nombre = document.getElementById('nombrePedido').value.trim();
    const telefono = document.getElementById('telefonoPedido').value.trim();
    const direccion = document.getElementById('direccionPedido').value.trim();
    const metodoPago = document.getElementById('metodoPago').value;
    
    console.log('📋 Datos del formulario:', { nombre, telefono, direccion, metodoPago });
    
    // Validación de campos
    if (!nombre || !telefono || !direccion || !metodoPago) {
        alert('❌ Por favor completa todos los campos');
        return;
    }

    if (telefono.length < 8) {
        alert('❌ El teléfono debe tener al menos 8 dígitos');
        return;
    }
    
    // Obtener geolocalización del cliente
    console.log('📍 Obteniendo geolocalización del cliente...');
    let ubicacionCliente = { lat: null, lng: null };
    
    const geoPromise = new Promise((resolve) => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    ubicacionCliente.lat = position.coords.latitude;
                    ubicacionCliente.lng = position.coords.longitude;
                    console.log('✅ Ubicación obtenida:', ubicacionCliente);
                    resolve();
                },
                (error) => {
                    console.warn('⚠️ No se pudo obtener geolocalización:', error.message);
                    resolve(); // Continuar aunque falle la geolocalización
                }
            );
        } else {
            console.warn('⚠️ Navegador no soporta geolocalización');
            resolve();
        }
    });

    await geoPromise;
    
    // 🔧 FALLBACK: Si no hay GPS, usar coordenadas por defecto de la tienda
    if (!ubicacionCliente.lat || !ubicacionCliente.lng) {
        console.warn('⚠️ Sin GPS del cliente - usando coordenadas por defecto');
        ubicacionCliente = {
            lat: 17.6936260,   // Emiliano Zapata, Tabasco (ubicación tienda)
            lng: -91.6397346
        };
        console.log('📍 Usando ubicación por defecto:', ubicacionCliente);
    }
    
    // Calcular total
    const total = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
    console.log('💰 Total del pedido: $' + total.toFixed(2));

    try {
        let comprobante = null;

        // Si es transferencia, validar comprobante
        if (metodoPago === 'transferencia') {
            console.log('💳 Método: Transferencia Bancaria - buscando comprobante...');
            const archivoComprobante = document.getElementById('archivoComprobante').files[0];
            
            if (!archivoComprobante) {
                alert('❌ Debes subir un comprobante de pago para transferencia');
                return;
            }

            // Validar tamaño del archivo (máximo 10MB)
            const maxSize = 10 * 1024 * 1024; // 10MB
            if (archivoComprobante.size > maxSize) {
                alert('❌ El comprobante debe ser menor a 10MB');
                return;
            }

            console.log('📤 Subiendo comprobante:', archivoComprobante.name);
            const storageRef = ref(storage, `comprobantes/${Date.now()}_${archivoComprobante.name}`);
            await uploadBytes(storageRef, archivoComprobante);
            comprobante = await getDownloadURL(storageRef);
            console.log('✅ Comprobante subido:', comprobante);
        } else {
            console.log('💵 Método: Efectivo en Domicilio');
        }

        // Crear pedido en Firestore
        console.log('🔄 Creando pedido en Firestore con ubicación:', ubicacionCliente);
        
        // IMPORTANTE: Siempre hay ubicación (GPS o fallback)
        const ubicacionFirestore = {
            lat: ubicacionCliente.lat,
            lng: ubicacionCliente.lng,
            timestamp: new Date().toISOString()
        };
        console.log('✅ Guardando ubicación del cliente:', ubicacionFirestore);
        
        const pedidoDoc = await addDoc(collection(db, 'pedidos'), {
            nombre: nombre,
            telefono: telefono,
            direccion: direccion,
            metodoPago: metodoPago,
            comprobante: comprobante,
            items: carrito,
            total: total,
            estado: 'pendiente',
            fecha: new Date(),
            visto: false,
            ubicacionCliente: ubicacionFirestore,
            estado: 'pendiente',
            repartidorUbicacion: null,
            repartidorNombre: null
        });
        console.log('✅ Pedido creado en Firestore:', pedidoDoc.id);

        // Guardar en localStorage ANTES de limpiar el carrito
        let misPedidos = JSON.parse(localStorage.getItem('misPedidos')) || [];
        const fechaActual = new Date();
        const nuevoPedido = {
            id: pedidoDoc.id,
            nombre: nombre,
            telefono: telefono,
            direccion: direccion,
            metodoPago: metodoPago,
            items: carrito,  // Copiar array completo
            total: total,
            estado: 'pendiente',
            fecha: fechaActual.toISOString(),
            fechaFormato: fechaActual.toLocaleString('es-MX'),
            comprobante: comprobante,
            ubicacionCliente: ubicacionFirestore,
            repartidorUbicacion: null,
            repartidorNombre: null
        };
        console.log('📝 Nuevo pedido a guardar:', nuevoPedido);
        
        misPedidos.push(nuevoPedido);
        localStorage.setItem('misPedidos', JSON.stringify(misPedidos));
        console.log('✅ Pedido guardado en localStorage. Total de pedidos:', misPedidos.length);

        // Limpiar carrito
        localStorage.removeItem('carrito');
        document.getElementById('formPedido').reset();
        
        // Cerrar modal y limpiar estado
        cerrarModal('checkoutModal');
        limpiarEstadoCheckout();
        actualizarConteCarrito();

        alert(`✅ ¡Pedido realizado exitosamente!\n\nNúmero de pedido: ${pedidoDoc.id}\n\nRevisa tu pedido en "Mis Pedidos" ↓`);
        
        // Recargar sección de mis pedidos inmediatamente
        cargarMisPedidos();
        console.log('✅ Sección de Mis Pedidos actualizada');
        
        // Reiniciar listener para monitorear el nuevo pedido en tiempo real
        iniciarListenerPedidosEnTiempoReal();
        console.log('✅ Listener reiniciado para el nuevo pedido');

    } catch (error) {
        console.error('❌ Error al realizar pedido:', error);
        console.error('Error completo:', error.message, error.stack);
        alert(`❌ Error al realizar pedido:\n${error.message}\n\nIntenta nuevamente o contacta con soporte.`);
    }
}

// ============================================
// PERSISTENCIA DE ESTADO (GUARDAR/RESTAURAR)
// ============================================

// Guardar estado del checkout cuando se abre el modal
function guardarEstadoCheckout() {
    const estado = {
        modalAbierto: true,
        nombrePedido: document.getElementById('nombrePedido').value,
        telefonoPedido: document.getElementById('telefonoPedido').value,
        direccionPedido: document.getElementById('direccionPedido').value,
        metodoPago: document.getElementById('metodoPago').value,
        timestamp: Date.now()
    };
    localStorage.setItem('estadoCheckout', JSON.stringify(estado));
}

// Restaurar estado del checkout al cargar la página
function restaurarEstadoCheckout() {
    const estadoGuardado = localStorage.getItem('estadoCheckout');
    
    if (estadoGuardado) {
        try {
            const estado = JSON.parse(estadoGuardado);
            
            // Restaurar valores del formulario
            if (estado.nombrePedido) {
                document.getElementById('nombrePedido').value = estado.nombrePedido;
            }
            if (estado.telefonoPedido) {
                document.getElementById('telefonoPedido').value = estado.telefonoPedido;
            }
            if (estado.direccionPedido) {
                document.getElementById('direccionPedido').value = estado.direccionPedido;
            }
            if (estado.metodoPago) {
                document.getElementById('metodoPago').value = estado.metodoPago;
                
                // Mostrar/ocultar elementos según el método de pago
                const comprobantePago = document.getElementById('comprobantePago');
                const datosTransferencia = document.getElementById('datosTransferencia');
                if (estado.metodoPago === 'transferencia') {
                    datosTransferencia.style.display = 'block';
                    comprobantePago.style.display = 'block';
                } else {
                    datosTransferencia.style.display = 'none';
                    comprobantePago.style.display = 'none';
                }
            }
            
            // Restaurar modal abierto
            if (estado.modalAbierto) {
                abrirModal('checkoutModal');
            }
        } catch (error) {
            console.error('Error al restaurar estado:', error);
            localStorage.removeItem('estadoCheckout');
        }
    }
}

// Limpiar estado cuando se completa el pedido
function limpiarEstadoCheckout() {
    localStorage.removeItem('estadoCheckout');
}

// ============================================
// MODALES
// ============================================

function abrirModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.add('show');

    if (modalId === 'carritoModal') {
        mostrarCarrito();
    } else if (modalId === 'checkoutModal') {
        // Guardar estado cuando se abre el modal de checkout
        guardarEstadoCheckout();
    }
}

function cerrarModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.remove('show');
    
    if (modalId === 'checkoutModal') {
        // Limpiar estado cuando se cierra el modal
        limpiarEstadoCheckout();
    }
}

// ============================================
// MIS PEDIDOS
// ============================================

function cargarMisPedidos() {
    const misPedidosRaw = localStorage.getItem('misPedidos');
    console.log('misPedidos raw desde localStorage:', misPedidosRaw);
    
    let misPedidos = JSON.parse(misPedidosRaw) || [];
    const content = document.getElementById('misPedidosContent');
    
    if (!content) {
        console.error('❌ ERROR: No se encontró el contenedor #misPedidosContent');
        return;
    }
    
    // 🔥 FILTRAR: Solo mostrar pedidos que NO están completados
    misPedidos = misPedidos.filter(pedido => pedido.estado !== 'Completado' && pedido.estado !== 'completado');
    
    console.log('📋 Mis Pedidos cargados:', misPedidos.length, 'pedidos activos (completados excluidos)');
    
    if (!Array.isArray(misPedidos) || misPedidos.length === 0) {
        console.log('📭 No hay pedidos activos, mostrando estado vacío');
        content.innerHTML = `
            <div class="mis-pedidos-vacio">
                <i class="fas fa-box"></i>
                <p>No tienes pedidos activos</p>
                <a href="#productos" class="btn-primary" style="display: inline-block; margin-top: 1rem;">Hacer un Pedido</a>
            </div>
        `;
        return;
    }
    
    content.innerHTML = '';
    let pedidosValidos = 0;
    
    // Limpiar pedidos antiguos y actualizar formato de fecha
    misPedidos = misPedidos.map(pedido => {
        if (!pedido.fechaFormato && pedido.fecha) {
            try {
                let fecha;
                
                // Manejar Firebase Timestamp (objeto con seconds y nanoseconds)
                if (pedido.fecha && typeof pedido.fecha === 'object' && pedido.fecha.seconds) {
                    fecha = new Date(pedido.fecha.seconds * 1000);
                } else if (typeof pedido.fecha === 'string') {
                    fecha = new Date(pedido.fecha);
                } else if (typeof pedido.fecha === 'number') {
                    fecha = new Date(pedido.fecha);
                } else if (pedido.fecha instanceof Date) {
                    fecha = pedido.fecha;
                } else if (pedido.fecha && pedido.fecha.toDate) {
                    fecha = pedido.fecha.toDate();
                } else {
                    fecha = new Date(pedido.fecha);
                }
                
                if (fecha && !isNaN(fecha.getTime())) {
                    pedido.fechaFormato = fecha.toLocaleString('es-MX', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    console.log('OK: Fecha actualizada para pedido', pedido.id, '-', pedido.fechaFormato);
                } else {
                    pedido.fechaFormato = 'Fecha no disponible';
                }
            } catch (e) {
                console.warn('Error procesando fecha para pedido:', pedido.id, e);
                pedido.fechaFormato = 'Fecha no disponible';
            }
        }
        return pedido;
    });
    
    // Actualizar localStorage con fechas formateadas
    localStorage.setItem('misPedidos', JSON.stringify(misPedidos));
    
    misPedidos.forEach((pedido, index) => {
        // Validar que el pedido tenga la estructura correcta
        if (!pedido) {
            console.warn(`⚠️ Pedido ${index} es null/undefined`);
            return;
        }
        
        if (!pedido.items || !Array.isArray(pedido.items)) {
            console.warn(`⚠️ Pedido ${index} sin items válidos:`, pedido);
            return; // Saltar este pedido si está corrupto
        }
        
        // Procesar fecha de forma segura
        let fechaFormato = pedido.fechaFormato || 'Fecha no disponible';
        
        const itemsHtml = pedido.items.map(item => {
            // Validar que el item tenga nombre y precio
            const nombre = item.nombre || 'Producto desconocido';
            const cantidad = item.cantidad || 1;
            const precio = item.precio || 0;
            return `
                <div class="pedido-item-producto">
                    <span>${nombre} x${cantidad}</span>
                    <span>$${(precio * cantidad).toFixed(2)}</span>
                </div>
            `;
        }).join('');
        
        const div = document.createElement('div');
        div.className = 'pedido-item';
        div.setAttribute('data-pedido-id', pedido.id);
        div.innerHTML = `
            <div class="pedido-header">
                <span class="pedido-numero">Pedido #${pedido.id.substring(0, 8).toUpperCase()}</span>
                <span class="pedido-estado ${pedido.estado}">${pedido.estado.charAt(0).toUpperCase() + pedido.estado.slice(1)}</span>
                <span class="pedido-fecha">${fechaFormato}</span>
            </div>
            
            <div class="pedido-detalles">
                <div class="pedido-detalle">
                    <span class="pedido-detalle-label">Cliente:</span>
                    ${pedido.nombre}
                </div>
                <div class="pedido-detalle">
                    <span class="pedido-detalle-label">Teléfono:</span>
                    ${pedido.telefono}
                </div>
                <div class="pedido-detalle">
                    <span class="pedido-detalle-label">Método de Pago:</span>
                    ${pedido.metodoPago === 'transferencia' ? 'Transferencia Bancaria' : 'Efectivo en Domicilio'}
                </div>
                <div class="pedido-detalle">
                    <span class="pedido-detalle-label">Dirección:</span>
                    ${pedido.direccion}
                </div>
            </div>
            
            <div class="pedido-items">
                <h4>Productos</h4>
                ${itemsHtml}
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-top: 1rem;">
                <div class="pedido-total">Total: $${pedido.total.toFixed(2)}</div>
                <button class="btn-ver-detalle" onclick="window.mostrarMapa('${pedido.direccion.replace(/'/g, "\\'")}', '${pedido.nombre.replace(/'/g, "\\'")}', ${pedido.ubicacionCliente?.lat || 'null'}, ${pedido.ubicacionCliente?.lng || 'null'}, '${pedido.id}')">
                    📍 Ver Mapa
                </button>
            </div>
        `;
        
        content.appendChild(div);
        pedidosValidos++;
    });
    
    console.log(`✅ Se mostraron ${pedidosValidos} de ${misPedidos.length} pedidos`);
}

// ============================================
// LISTENER EN TIEMPO REAL - PEDIDOS
// ============================================

let unsubscribePedidos = null;

function iniciarListenerPedidosEnTiempoReal() {
    try {
        console.log('🔄 Iniciando listener de pedidos en tiempo real...');
        
        // Obtener todos los IDs de pedidos locales
        const misPedidosLocal = JSON.parse(localStorage.getItem('misPedidos')) || [];
        if (misPedidosLocal.length === 0) {
            console.warn('⚠️ No hay pedidos locales para escuchar. Nota: El listener se iniciará cuando se cree un pedido');
            return;
        }
        
        const pedidoIds = misPedidosLocal.map(p => p.id);
        console.log('📋 IDs de pedidos a monitorear:', pedidoIds.length, 'pedidos');
        
        // Cancelar listeners anteriores si existen
        if (unsubscribePedidos && Array.isArray(unsubscribePedidos)) {
            console.log('🛑 Deteniendo listeners anteriores');
            unsubscribePedidos.forEach(unsub => {
                try { unsub(); } catch(e) {}
            });
        }
        
        // Crear listeners para cada pedido individual
        const listeners = pedidoIds.map(pedidoId => {
            return onSnapshot(doc(db, 'pedidos', pedidoId), (docSnapshot) => {
                if (docSnapshot.exists()) {
                    console.log(`🔔 Cambios en pedido ${pedidoId}`);
                    
                    const pedidoFirestore = {
                        id: docSnapshot.id,
                        ...docSnapshot.data()
                    };
                    
                    // Actualizar localStorage con los datos nuevos
                    const misPedidosLocal = JSON.parse(localStorage.getItem('misPedidos')) || [];
                    const misPedidosActualizados = misPedidosLocal.map(pedidoLocal => {
                        if (pedidoLocal.id === pedidoFirestore.id) {
                            // Copiar TODO desde Firestore, no solo campos específicos
                            const actualizado = {
                                ...pedidoLocal,
                                ...pedidoFirestore  // Esto sobrescribe con todos los datos de Firestore
                            };
                            console.log('✅ Pedido actualizado en localStorage');
                            console.log('   - Estado:', actualizado.estado);
                            console.log('   - Repartidor:', actualizado.repartidorUbicacion ? 'SÍ' : 'NO');
                            return actualizado;
                        }
                        return pedidoLocal;
                    });
                    
                    localStorage.setItem('misPedidos', JSON.stringify(misPedidosActualizados));
                    console.log('✅ localStorage sincronizado con Firestore');
                    
                    // Actualizar SOLO el elemento DOM correspondiente sin llamar a cargarMisPedidos() (evita loop infinito)
                    actualizarPedidoEnUI(pedidoFirestore.id, pedidoFirestore.estado);
                    
                    // Si hay repartidor, actualizar el botón del mapa
                    if (pedidoFirestore.repartidorUbicacion && pedidoFirestore.repartidorUbicacion.lat && pedidoFirestore.repartidorUbicacion.lng) {
                        actualizarBotonesMapaEnUI(pedidoFirestore.id);
                        console.log('🟢 Repartidor detectado en listener, actualizando UI');
                    }
                }
            }, (error) => {
                console.error(`❌ Error en listener del pedido ${pedidoId}:`, error);
            });
        });
        
        // Guardar funciones para dejar de escuchar si es necesario
        unsubscribePedidos = listeners;
        console.log('✅ Listener de pedidos iniciado con éxito');
    } catch (error) {
        console.error('❌ Error iniciando listener de pedidos:', error);
    }
}

// Función para actualizar solo el estado del pedido en el DOM sin redibujar todo
function actualizarPedidoEnUI(pedidoId, nuevoEstado) {
    const pedidoElement = document.querySelector(`[data-pedido-id="${pedidoId}"]`);
    if (pedidoElement) {
        const estadoElement = pedidoElement.querySelector('.pedido-estado');
        if (estadoElement) {
            estadoElement.textContent = nuevoEstado.charAt(0).toUpperCase() + nuevoEstado.slice(1);
            estadoElement.className = `pedido-estado ${nuevoEstado}`;
            console.log('🎨 UI actualizado para pedido:', pedidoId, 'Estado:', nuevoEstado);
        }
    }
}

// Función para actualizar el botón del mapa cuando hay repartidor
function actualizarBotonesMapaEnUI(pedidoId) {
    const pedidoElement = document.querySelector(`[data-pedido-id="${pedidoId}"]`);
    if (pedidoElement) {
        const btnMapa = pedidoElement.querySelector('.btn-ver-detalle');
        if (btnMapa) {
            btnMapa.style.backgroundColor = '#27ae60';
            btnMapa.style.borderColor = '#27ae60';
            console.log('🎨 Botón de mapa actualizado para pedido:', pedidoId);
        }
    }
}
// MAPA DE ENTREGA
// ============================================

function mostrarMapa(direccionCliente, nombreCliente, lat = null, lng = null) {
    const mapaModal = document.getElementById('mapaModal');
    const mapContainer = document.getElementById('mapContainer');
    const mapaInfo = document.getElementById('mapaInfo');
    
    // Limpiar mapa anterior
    mapContainer.innerHTML = '';
    
    // Crear mapa
    const mapa = L.map('mapContainer').setView([18.4241, -69.9267], 13); // Centro en República Dominicana
    
    // Agregar tiles de OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(mapa);
    
    // Mostrar modal
    abrirModal('mapaModal');
    
    mapaInfo.innerHTML = `<p>📍 <strong>Destino:</strong> ${nombreCliente}</p><p>⏳ Cargando ruta...</p>`;
    
    // Obtener ubicación actual del usuario
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLat = position.coords.latitude;
                const userLng = position.coords.longitude;
                
                // Marcar ubicación del usuario
                L.marker([userLat, userLng], {
                    icon: L.icon({
                        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
                        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                        iconSize: [25, 41],
                        iconAnchor: [12, 41],
                        popupAnchor: [1, -34],
                        shadowSize: [41, 41]
                    })
                }).addTo(mapa).bindPopup('Tu ubicación actual');
                
                // Usar coordenadas directas si están disponibles, si no buscar la dirección
                let destLat, destLng;
                
                if (lat !== null && lng !== null) {
                    // Usar coordenadas GPS del cliente
                    destLat = parseFloat(lat);
                    destLng = parseFloat(lng);
                    console.log('📍 Usando coordenadas GPS del cliente:', destLat, destLng);
                    procesarMapa(destLat, destLng, true);
                } else {
                    // Buscar coordenadas de la dirección del cliente usando Nominatim
                    fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(direccionCliente)}&format=json&limit=1`)
                        .then(res => res.json())
                        .then(data => {
                            if (data.length > 0) {
                                destLat = parseFloat(data[0].lat);
                                destLng = parseFloat(data[0].lon);
                                console.log('🔍 Coordenadas encontradas por dirección:', destLat, destLng);
                                procesarMapa(destLat, destLng, false);
                            } else {
                                mapaInfo.innerHTML = `
                                    <p>⚠️ No se encontró la dirección: ${direccionCliente}</p>
                                    <p>Por favor, verifica la dirección e intenta nuevamente.</p>
                                `;
                            }
                        })
                        .catch(err => {
                            console.error('Error buscando dirección:', err);
                            mapaInfo.innerHTML = `<p>❌ Error al cargar el mapa. Intenta nuevamente.</p>`;
                        });
                }
                
                function procesarMapa(destLat, destLng, esGPS) {
                    // Marcar ubicación del cliente
                    L.marker([destLat, destLng], {
                        icon: L.icon({
                            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                            iconSize: [25, 41],
                            iconAnchor: [12, 41],
                            popupAnchor: [1, -34],
                            shadowSize: [41, 41]
                        })
                    }).addTo(mapa).bindPopup(`<strong>${nombreCliente}</strong><br>${direccionCliente}`);
                    
                    // Dibujar línea entre puntos
                    const latlngs = [[userLat, userLng], [destLat, destLng]];
                    L.polyline(latlngs, { color: '#dbb42a', weight: 3, opacity: 0.8 }).addTo(mapa);
                    
                    // Ajustar zoom para ver ambos puntos
                    const group = new L.featureGroup([
                        L.marker([userLat, userLng]),
                        L.marker([destLat, destLng])
                    ]);
                    mapa.fitBounds(group.getBounds().pad(0.1));
                    
                    // Calcular distancia (aproximada)
                    const distance = Math.sqrt(
                        Math.pow(destLat - userLat, 2) + Math.pow(destLng - userLng, 2)
                    ) * 111; // Aproximado en km
                    
                    const tipoUbicacion = esGPS ? '(GPS en tiempo real)' : '(búsqueda de dirección)';
                    
                    mapaInfo.innerHTML = `
                        <p>📍 <strong>Destino:</strong> ${nombreCliente}</p>
                        <p>📮 <strong>Dirección:</strong> ${direccionCliente}</p>
                        <p>📌 <strong>Coordenadas:</strong> ${destLat.toFixed(4)}, ${destLng.toFixed(4)}</p>
                        <p>📏 <strong>Distancia aproximada:</strong> ${distance.toFixed(2)} km</p>
                        <p style="font-size: 0.9rem; color: #666; margin-top: 0.5rem;">🔵 Azul = Tu ubicación | 🔴 Rojo = Destino ${tipoUbicacion}</p>
                    `;
                }
            },
            (error) => {
                console.error('Error al obtener ubicación:', error);
                mapaInfo.innerHTML = `<p>⚠️ No se pudo obtener tu ubicación. Asegúrate de permitir acceso a la ubicación.</p>`;
                
                // Si tenemos coordenadas GPS del cliente, mostrar solo la ubicación del cliente
                if (lat !== null && lng !== null) {
                    const destLat = parseFloat(lat);
                    const destLng = parseFloat(lng);
                    
                    L.marker([destLat, destLng], {
                        icon: L.icon({
                            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                            iconSize: [25, 41],
                            iconAnchor: [12, 41],
                            popupAnchor: [1, -34],
                            shadowSize: [41, 41]
                        })
                    }).addTo(mapa).bindPopup(`<strong>${nombreCliente}</strong><br>${direccionCliente}`);
                    
                    mapa.setView([destLat, destLng], 15);
                    
                    mapaInfo.innerHTML = `
                        <p>📍 <strong>Destino:</strong> ${nombreCliente}</p>
                        <p>📮 <strong>Dirección:</strong> ${direccionCliente}</p>
                        <p>📌 <strong>Coordenadas GPS:</strong> ${destLat.toFixed(4)}, ${destLng.toFixed(4)}</p>
                        <p style="font-size: 0.9rem; color: #999; margin-top: 0.5rem;">ℹ️ No se pudo obtener tu ubicación, mostrando ubicación del cliente</p>
                    `;
                }
            }
        );
    } else {
        mapaInfo.innerHTML = `<p>❌ Tu navegador no soporta geolocalización.</p>`;
    }
}

// ============================================
// HACER FUNCIONES GLOBALES
// ============================================

function cerrarMapa() {
    const mapaModal = document.getElementById('mapaModal');
    if (mapaModal) {
        mapaModal.classList.remove('show');
    }
}

window.agregarAlCarrito = agregarAlCarrito;
window.comprarAhora = comprarAhora;
window.actualizarCantidad = actualizarCantidad;
window.eliminarDelCarrito = eliminarDelCarrito;
window.abrirModal = abrirModal;
window.cerrarModal = cerrarModal;
window.realizarPedido = realizarPedido;
window.cargarMisPedidos = cargarMisPedidos;
window.cerrarMapa = cerrarMapa;

// 🔥 OVERRIDE CRÍTICO: Usar mostrarMapaMejorado que incluye repartidor
window.mostrarMapa = function(direccionCliente, nombreCliente, lat = null, lng = null, pedidoId = null) {
    console.log('📍 mostrarMapa() llamado con:', { direccionCliente, nombreCliente, lat, lng, pedidoId });
    
    // Pasar directamente a la versión mejorada
    window.mostrarMapaMejorado(direccionCliente, nombreCliente, lat, lng, pedidoId);
};
