// Admin Main JS - Panel Administrador de Carolas Green

import { db, auth, storage } from '../js/firebase-config.js';
import {
    collection,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    query,
    where,
    orderBy,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import {
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import {
    ref,
    uploadBytes,
    getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-storage.js";

// ============================================
// VARIABLES GLOBALES
// ============================================

let usuarioActual = null;
let seccionActiva = 'dashboard';
let pedidoSeleccionado = null;
let productos = [];
let pedidos = [];
let comentarios = [];
let productoEditando = null;

// ============================================
// INICIALIZAR
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    verificarAutenticacion();
    setupMenuItems();
    setupFormularios();
});

// ============================================
// AUTENTICACIÓN
// ============================================

function verificarAutenticacion() {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            usuarioActual = user;
            document.getElementById('adminUserEmail').textContent = user.email;
            cargarDatos();
        } else {
            redirigirLogin();
        }
    });
}

function redirigirLogin() {
    // Aquí podrías crear una página de login o redirigir
    // Por ahora, mostraremos un prompt para que ingresen las credenciales
    const email = prompt('Email de administrador:');
    const password = prompt('Contraseña:');

    if (email && password) {
        signInWithEmailAndPassword(auth, email, password)
            .catch(error => {
                alert('Error de autenticación: ' + error.message);
                redirigirLogin();
            });
    }
}

document.getElementById('logoutBtn').addEventListener('click', () => {
    signOut(auth).then(() => {
        alert('Sesión cerrada');
        redirigirLogin();
    });
});

// ============================================
// SETUP MENU
// ============================================

function setupMenuItems() {
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            cambiarSeccion(item.getAttribute('data-section'));
        });
    });
}

function cambiarSeccion(seccion) {
    // Ocultar todas las secciones
    document.querySelectorAll('.admin-section').forEach(s => {
        s.classList.remove('active');
    });

    // Remover clase active de todos los items del menú
    document.querySelectorAll('.menu-item').forEach(m => {
        m.classList.remove('active');
    });

    // Mostrar sección seleccionada
    const seccionElement = document.getElementById(seccion);
    if (seccionElement) {
        seccionElement.classList.add('active');
        document.querySelector(`[data-section="${seccion}"]`).classList.add('active');
        seccionActiva = seccion;

        // Cargar datos específicos según la sección
        if (seccion === 'pedidos') {
            mostrarPedidos();
        } else if (seccion === 'productos') {
            mostrarProductos();
        } else if (seccion === 'comentarios') {
            mostrarComentarios();
        } else if (seccion === 'entregas') {
            mostrarEntregas();
        } else if (seccion === 'dashboard') {
            actualizarDashboard();
        } else if (seccion === 'chat') {
            mostrarChats();
        }
    }
}

// ============================================
// CARGAR DATOS
// ============================================

async function cargarDatos() {
    await Promise.all([
        cargarProductos(),
        cargarPedidos(),
        cargarComentarios()
    ]);
    actualizarDashboard();
}

async function cargarProductos() {
    try {
        const snapshot = await getDocs(collection(db, 'productos'));
        productos = [];
        snapshot.forEach(doc => {
            productos.push({
                id: doc.id,
                ...doc.data()
            });
        });
    } catch (error) {
        console.error('Error al cargar productos:', error);
    }
}

async function cargarPedidos() {
    try {
        const snapshot = await getDocs(collection(db, 'pedidos'));
        pedidos = [];
        snapshot.forEach(doc => {
            pedidos.push({
                id: doc.id,
                ...doc.data()
            });
        });
        // Ordenar por fecha descendente
        pedidos.sort((a, b) => (b.fecha?.toDate?.() || new Date(b.fecha)) - (a.fecha?.toDate?.() || new Date(a.fecha)));
    } catch (error) {
        console.error('Error al cargar pedidos:', error);
    }
}

async function cargarComentarios() {
    try {
        const snapshot = await getDocs(collection(db, 'comentarios'));
        comentarios = [];
        snapshot.forEach(doc => {
            comentarios.push({
                id: doc.id,
                ...doc.data()
            });
        });
    } catch (error) {
        console.error('Error al cargar comentarios:', error);
    }
}

// ============================================
// DASHBOARD
// ============================================

async function actualizarDashboard() {
    // Calcular estadísticas
    const totalPedidos = pedidos.length;
    const pedidosPendientes = pedidos.filter(p => p.estado === 'pendiente').length;
    const pedidosCompletados = pedidos.filter(p => p.estado === 'completado').length;
    const ventasTotales = pedidos.reduce((sum, p) => sum + (p.total || 0), 0);

    document.getElementById('totalPedidos').textContent = totalPedidos;
    document.getElementById('pedidosPendientes').textContent = pedidosPendientes;
    document.getElementById('pedidosCompletados').textContent = pedidosCompletados;
    document.getElementById('ventasTotales').textContent = '$' + ventasTotales.toFixed(2);

    // Mostrar pedidos recientes
    const pedidosRecientes = pedidos.slice(0, 5);
    const container = document.getElementById('pedidosRecientes');
    container.innerHTML = '';

    if (pedidosRecientes.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #798839;">Sin pedidos aún</p>';
        return;
    }

    pedidosRecientes.forEach(pedido => {
        const div = document.createElement('div');
        div.className = 'pedido-card';
        const fecha = new Date(pedido.fecha?.toDate?.() || pedido.fecha).toLocaleDateString('es-MX');
        div.innerHTML = `
            <div class="pedido-header">
                <div class="pedido-id">#${pedido.id.substring(0, 8)}</div>
                <span class="pedido-estado ${pedido.estado}">${pedido.estado}</span>
            </div>
            <p><strong>${pedido.nombre}</strong> - ${pedido.telefono}</p>
            <p>Total: $${pedido.total?.toFixed(2) || '0.00'}</p>
            <p style="font-size: 0.9rem; color: #6b7960;">${fecha}</p>
        `;
        container.appendChild(div);
    });
}

// ============================================
// PEDIDOS
// ============================================

async function mostrarPedidos() {
    const container = document.getElementById('listaPedidos');
    container.innerHTML = '';

    if (pedidos.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #798839;">Sin pedidos</p>';
        return;
    }

    pedidos.forEach(pedido => {
        const div = document.createElement('div');
        div.className = `pedido-card ${pedido.estado}`;

        const fecha = new Date(pedido.fecha?.toDate?.() || pedido.fecha).toLocaleDateString('es-MX');
        const itemsHTML = pedido.items.map(item =>
            `<div class="pedido-item">
                <span class="pedido-item-nombre">${item.nombre}</span>
                <span class="pedido-item-cantidad">x${item.cantidad}</span>
                <span class="pedido-item-precio">$${(item.precio * item.cantidad).toFixed(2)}</span>
            </div>`
        ).join('');

        let comprobanteHTML = '';
        if (pedido.comprobante) {
            comprobanteHTML = `
                <div class="pedido-comprobante">
                    <p><strong>Comprobante de Pago:</strong></p>
                    <a href="${pedido.comprobante}" target="_blank" class="btn-secondary">Ver Comprobante</a>
                </div>
            `;
        }

        div.innerHTML = `
            <div class="pedido-header">
                <div class="pedido-id">Pedido #${pedido.id.substring(0, 8)}</div>
                <span class="pedido-estado ${pedido.estado}">${pedido.estado}</span>
            </div>
            <div class="pedido-info">
                <div class="pedido-detail">
                    <label>Cliente</label>
                    <p>${pedido.nombre}</p>
                </div>
                <div class="pedido-detail">
                    <label>Teléfono</label>
                    <p>${pedido.telefono}</p>
                </div>
                <div class="pedido-detail">
                    <label>Dirección</label>
                    <p>${pedido.direccion}</p>
                </div>
                <div class="pedido-detail">
                    <label>Método de Pago</label>
                    <p>${pedido.metodoPago === 'transferencia' ? 'Transferencia' : 'Efectivo'}</p>
                </div>
                <div class="pedido-detail">
                    <label>Fecha</label>
                    <p>${fecha}</p>
                </div>
                <div class="pedido-detail">
                    <label>Total</label>
                    <p style="color: #dbb42a; font-weight: bold; font-size: 1.1rem;">$${pedido.total?.toFixed(2) || '0.00'}</p>
                </div>
            </div>
            <div class="pedido-items">
                <h4>Artículos:</h4>
                ${itemsHTML}
                <div class="pedido-total">Total: $${pedido.total?.toFixed(2) || '0.00'}</div>
            </div>
            ${comprobanteHTML}
            <div class="pedido-actions">
                <button class="btn-secondary" onclick="cambiarEstadoPedido('${pedido.id}', 'visto')">Marcar Visto</button>
                <button class="btn-secondary" onclick="cambiarEstadoPedido('${pedido.id}', 'preparacion')">En Preparación</button>
                <button class="btn-secondary" onclick="cambiarEstadoPedido('${pedido.id}', 'camino')">En Camino</button>
                <button class="btn-primary" onclick="cambiarEstadoPedido('${pedido.id}', 'completado')">Completado</button>
                <button class="btn-danger" onclick="eliminarPedido('${pedido.id}')">Eliminar</button>
            </div>
        `;
        container.appendChild(div);
    });
}

async function cambiarEstadoPedido(pedidoId, nuevoEstado) {
    try {
        await updateDoc(doc(db, 'pedidos', pedidoId), {
            estado: nuevoEstado,
            visto: true
        });
        await cargarPedidos();
        mostrarPedidos();
        alert('Estado actualizado');
    } catch (error) {
        console.error('Error:', error);
        alert('Error al actualizar estado');
    }
}

async function eliminarPedido(pedidoId) {
    if (!confirm('¿Estás seguro de que quieres eliminar este pedido?')) return;
    try {
        await deleteDoc(doc(db, 'pedidos', pedidoId));
        await cargarPedidos();
        mostrarPedidos();
        alert('Pedido eliminado');
    } catch (error) {
        console.error('Error:', error);
        alert('Error al eliminar pedido');
    }
}

// ============================================
// ENTREGAS
// ============================================

async function mostrarEntregas() {
    const container = document.getElementById('listaEntregas');
    container.innerHTML = '';

    const pedidosEnCamino = pedidos.filter(p => p.estado === 'camino');

    if (pedidosEnCamino.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #798839;">Sin entregas en proceso</p>';
        return;
    }

    pedidosEnCamino.forEach(pedido => {
        const div = document.createElement('div');
        div.className = 'entrega-card';

        const mapasURL = `https://www.google.com/maps/search/${encodeURIComponent(pedido.direccion || 'Carolas Green')}`;

        div.innerHTML = `
            <div class="pedido-header">
                <div class="pedido-id">Entrega #${pedido.id.substring(0, 8)}</div>
                <span class="pedido-estado camino">En Camino</span>
            </div>
            <div class="entrega-info">
                <div class="pedido-detail">
                    <label>Cliente</label>
                    <p>${pedido.nombre}</p>
                </div>
                <div class="pedido-detail">
                    <label>Teléfono</label>
                    <p><a href="tel:${pedido.telefono}">${pedido.telefono}</a></p>
                </div>
            </div>
            <a href="${mapasURL}" target="_blank" class="btn-secondary" style="display: block; text-align: center; margin: var(--spacing-md) 0;">
                Ver en Google Maps
            </a>
            <iframe class="entrega-mapa" src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1900.0656748246881!2d-91.78283489796188!3d17.738449150261328!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x85f3cb0014d7f5b5%3A0x8520af418f7832a8!2sCAROLAS%20GREEN!5e0!3m2!1ses-419!2smx!4v1780973089571!5m2!1ses-419!2smx" style="border:0;" allowfullscreen="" loading="lazy"></iframe>
        `;
        container.appendChild(div);
    });
}

// ============================================
// PRODUCTOS
// ============================================

function setupFormularios() {
    document.getElementById('btnAgregarProducto').addEventListener('click', () => {
        productoEditando = null;
        document.getElementById('formProducto').reset();
        document.getElementById('formProductoContainer').style.display = 'block';
    });

    document.getElementById('btnCancelaarProducto').addEventListener('click', () => {
        document.getElementById('formProductoContainer').style.display = 'none';
    });

    document.getElementById('formProducto').addEventListener('submit', guardarProducto);
    document.getElementById('formEditarProducto').addEventListener('submit', guardarProductoEditado);

    // Cerrar modal
    document.querySelector('#editProductoModal .close').addEventListener('click', () => {
        document.getElementById('editProductoModal').classList.remove('show');
    });
}

async function mostrarProductos() {
    const container = document.getElementById('listaProductos');
    container.innerHTML = '';

    productos.forEach(producto => {
        const div = document.createElement('div');
        div.className = 'producto-admin-card';

        const stockClass = producto.stock <= 5 ? 'bajo' : '';

        div.innerHTML = `
            <div class="producto-admin-img">
                ${producto.imagen ? `<img src="${producto.imagen}" alt="${producto.nombre}" style="width: 100%; height: 100%; object-fit: cover;">` : '🥗'}
            </div>
            <div class="producto-admin-info">
                <div class="producto-admin-nombre">${producto.nombre}</div>
                <div class="producto-admin-precio">$${producto.precio.toFixed(2)}</div>
                <div class="producto-admin-stock ${stockClass}">Stock: ${producto.stock}</div>
                <div class="producto-admin-actions">
                    <button class="btn-secondary" onclick="editarProducto('${producto.id}')">Editar</button>
                    <button class="btn-danger" onclick="eliminarProducto('${producto.id}')">Eliminar</button>
                </div>
            </div>
        `;
        container.appendChild(div);
    });
}

async function guardarProducto(e) {
    e.preventDefault();

    const nombre = document.getElementById('nombreProducto').value;
    const categoria = document.getElementById('categoriaProducto').value;
    const precio = parseFloat(document.getElementById('precioProducto').value);
    const ingredientes = document.getElementById('ingredientesProducto').value;
    const stock = parseInt(document.getElementById('stockProducto').value);
    const archivoImagen = document.getElementById('imagenProducto').files[0];

    try {
        let imagenURL = null;

        if (archivoImagen) {
            const storageRef = ref(storage, `productos/${Date.now()}_${archivoImagen.name}`);
            await uploadBytes(storageRef, archivoImagen);
            imagenURL = await getDownloadURL(storageRef);
        }

        await addDoc(collection(db, 'productos'), {
            nombre: nombre,
            categoria: categoria,
            precio: precio,
            ingredientes: ingredientes,
            stock: stock,
            imagen: imagenURL,
            creado: new Date()
        });

        document.getElementById('formProducto').reset();
        document.getElementById('formProductoContainer').style.display = 'none';
        await cargarProductos();
        mostrarProductos();
        alert('Producto agregado exitosamente');
    } catch (error) {
        console.error('Error:', error);
        alert('Error al agregar producto');
    }
}

function editarProducto(productoId) {
    const producto = productos.find(p => p.id === productoId);
    if (!producto) return;

    productoEditando = producto;
    document.getElementById('editNombreProducto').value = producto.nombre;
    document.getElementById('editCategoriaProducto').value = producto.categoria;
    document.getElementById('editPrecioProducto').value = producto.precio;
    document.getElementById('editIngredientesProducto').value = producto.ingredientes || '';
    document.getElementById('editStockProducto').value = producto.stock;

    document.getElementById('editProductoModal').classList.add('show');
}

async function guardarProductoEditado(e) {
    e.preventDefault();

    if (!productoEditando) return;

    try {
        await updateDoc(doc(db, 'productos', productoEditando.id), {
            nombre: document.getElementById('editNombreProducto').value,
            categoria: document.getElementById('editCategoriaProducto').value,
            precio: parseFloat(document.getElementById('editPrecioProducto').value),
            ingredientes: document.getElementById('editIngredientesProducto').value,
            stock: parseInt(document.getElementById('editStockProducto').value)
        });

        document.getElementById('editProductoModal').classList.remove('show');
        await cargarProductos();
        mostrarProductos();
        alert('Producto actualizado');
    } catch (error) {
        console.error('Error:', error);
        alert('Error al actualizar producto');
    }
}

async function eliminarProducto(productoId) {
    if (!confirm('¿Estás seguro de que quieres eliminar este producto?')) return;

    try {
        await deleteDoc(doc(db, 'productos', productoId));
        await cargarProductos();
        mostrarProductos();
        alert('Producto eliminado');
    } catch (error) {
        console.error('Error:', error);
        alert('Error al eliminar producto');
    }
}

// ============================================
// COMENTARIOS
// ============================================

async function mostrarComentarios() {
    const container = document.getElementById('listaComentarios');
    container.innerHTML = '';

    if (comentarios.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #798839;">Sin comentarios</p>';
        return;
    }

    comentarios.forEach(comentario => {
        const div = document.createElement('div');
        div.className = `comentario-admin-card ${comentario.aprobado ? 'aprobado' : ''}`;

        const fecha = new Date(comentario.fecha?.toDate?.() || comentario.fecha).toLocaleDateString('es-MX');

        div.innerHTML = `
            <div class="comentario-admin-header">
                <div>
                    <div class="comentario-admin-autor">${comentario.nombre}</div>
                    <div class="comentario-admin-email">${comentario.email}</div>
                </div>
                <span class="comentario-admin-estado ${comentario.aprobado ? 'aprobado' : ''}">
                    ${comentario.aprobado ? 'Aprobado' : 'Pendiente'}
                </span>
            </div>
            <div class="comentario-admin-texto">"${comentario.texto}"</div>
            <div class="comentario-admin-fecha">${fecha}</div>
            <div class="comentario-admin-actions">
                ${!comentario.aprobado ? `<button class="btn-secondary" onclick="aprobarComentario('${comentario.id}')">Aprobar</button>` : ''}
                <button class="btn-danger" onclick="eliminarComentario('${comentario.id}')">Eliminar</button>
            </div>
        `;
        container.appendChild(div);
    });
}

async function aprobarComentario(comentarioId) {
    try {
        await updateDoc(doc(db, 'comentarios', comentarioId), {
            aprobado: true
        });
        await cargarComentarios();
        mostrarComentarios();
    } catch (error) {
        console.error('Error:', error);
    }
}

async function eliminarComentario(comentarioId) {
    if (!confirm('¿Estás seguro?')) return;
    try {
        await deleteDoc(doc(db, 'comentarios', comentarioId));
        await cargarComentarios();
        mostrarComentarios();
    } catch (error) {
        console.error('Error:', error);
    }
}

// ============================================
// CHAT
// ============================================

async function mostrarChats() {
    const chatList = document.getElementById('chatList');
    chatList.innerHTML = '';

    const pedidosUnicos = [...new Set(pedidos.map(p => p.nombre))];

    pedidosUnicos.forEach((nombre, index) => {
        const div = document.createElement('div');
        div.className = 'chat-item';
        div.innerHTML = `
            <div class="chat-item-nombre">${nombre}</div>
            <div class="chat-item-preview">Haz click para chatear</div>
        `;
        div.addEventListener('click', () => abrirChat(nombre, index));
        chatList.appendChild(div);
    });
}

function abrirChat(nombreCliente, index) {
    document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));
    document.querySelectorAll('.chat-item')[index].classList.add('active');

    const mensajeInput = document.getElementById('mensajeInput');
    const enviarBtn = document.getElementById('enviarMensajeBtn');
    const chatMessages = document.getElementById('chatMessages');

    mensajeInput.disabled = false;
    enviarBtn.disabled = false;

    // Limpiar mensajes previos
    chatMessages.innerHTML = '';

    // Aquí irían los mensajes guardados de Firebase Realtime Database
    const mensajeBienvenida = document.createElement('div');
    mensajeBienvenida.className = 'chat-message admin';
    mensajeBienvenida.textContent = `Chat abierto con ${nombreCliente}`;
    chatMessages.appendChild(mensajeBienvenida);

    // Handler para enviar mensajes
    enviarBtn.onclick = () => {
        const texto = mensajeInput.value.trim();
        if (texto) {
            const div = document.createElement('div');
            div.className = 'chat-message admin';
            div.textContent = texto;
            chatMessages.appendChild(div);
            mensajeInput.value = '';
            chatMessages.scrollTop = chatMessages.scrollHeight;

            // Aquí guardarías el mensaje en Firebase Realtime Database
        }
    };

    // Enviar con Enter
    mensajeInput.onkeypress = (e) => {
        if (e.key === 'Enter') {
            enviarBtn.click();
        }
    };
}

// Hacer funciones globales
window.cambiarEstadoPedido = cambiarEstadoPedido;
window.eliminarPedido = eliminarPedido;
window.editarProducto = editarProducto;
window.eliminarProducto = eliminarProducto;
window.aprobarComentario = aprobarComentario;
window.eliminarComentario = eliminarComentario;
