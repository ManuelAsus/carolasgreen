// Admin Dashboard - Carolas Green

// Variables globales
let usuarioActual = null;
let productos = [];
let pedidos = [];
let comentarios = [];
let menus = [];
let galeria = [];
let ordenesTienda = [];
let ordenTiendaActual = [];
let productoEditando = null;
let db = null;
let auth = null;
let storage = null;

// ============================================
// UTILIDAD: CONVERTIR ARCHIVO A BASE64
// ============================================

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

function chunkBase64(value, chunkSize = 700 * 1024) {
    if (!value) return [];
    const chunks = [];
    for (let i = 0; i < value.length; i += chunkSize) {
        chunks.push(value.slice(i, i + chunkSize));
    }
    return chunks;
}

function getStoredAsset(item, field) {
    const chunkField = `${field}Chunks`;
    if (typeof item?.[field] === 'string' && item[field].startsWith('data:')) {
        return item[field];
    }
    if (Array.isArray(item?.[chunkField]) && item[chunkField].length) {
        return item[chunkField].join('');
    }
    return item?.[field] || '';
}

function prepareAssetForFirestore(base64Value, field) {
    const chunks = chunkBase64(base64Value);
    if (chunks.length > 1) {
        return {
            [field]: null,
            [`${field}Chunks`]: chunks,
            [`${field}Size`]: base64Value.length
        };
    }
    return {
        [field]: base64Value,
        [`${field}Chunks`]: [],
        [`${field}Size`]: base64Value.length
    };
}

// ============================================
// UTILIDAD: CONVERTIR PDF A IMAGEN BASE64
// ============================================

async function pdfToImage(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        const totalPages = pdf.numPages;
        
        const scale = 2;
        const firstPage = await pdf.getPage(1);
        const viewport = firstPage.getViewport({ scale });
        
        const totalCanvas = document.createElement('canvas');
        totalCanvas.width = viewport.width;
        totalCanvas.height = viewport.height * totalPages;
        
        const totalContext = totalCanvas.getContext('2d');
        totalContext.fillStyle = 'white';
        totalContext.fillRect(0, 0, totalCanvas.width, totalCanvas.height);
        
        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const pageViewport = page.getViewport({ scale });
            const pageCanvas = document.createElement('canvas');
            pageCanvas.width = pageViewport.width;
            pageCanvas.height = pageViewport.height;
            const pageContext = pageCanvas.getContext('2d');
            await page.render({
                canvasContext: pageContext,
                viewport: pageViewport
            }).promise;
            const yOffset = (pageNum - 1) * pageViewport.height;
            totalContext.drawImage(pageCanvas, 0, yOffset);
        }
        
        return totalCanvas.toDataURL('image/jpeg', 0.85);
    } catch (error) {
        console.error('Error al convertir PDF a imagen:', error);
        throw new Error('No se pudo convertir el PDF a imagen: ' + error.message);
    }
}

// ============================================
// INICIALIZAR FIREBASE
// ============================================

async function inicializarFirebase() {
    try {
        const firebaseModule = await import('../../js/firebase-config.js');
        db = firebaseModule.db;
        auth = firebaseModule.auth;
        storage = firebaseModule.storage;

        const { onAuthStateChanged, signOut } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js');
        
        onAuthStateChanged(auth, (user) => {
            if (user) {
                usuarioActual = user;
                document.getElementById('adminUserEmail').textContent = user.email;
                cargarDatos();
            } else {
                window.location.href = 'login.html';
            }
        });

        document.getElementById('logoutBtn').addEventListener('click', () => {
            signOut(auth).then(() => {
                localStorage.removeItem('adminUser');
                window.location.href = 'login.html';
            });
        });

    } catch (error) {
        console.error('Error al inicializar Firebase:', error);
        mostrarError('Error de conexión con Firebase');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setupMenuItems();
    setupFormularios();
    inicializarFirebase();
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
    document.querySelectorAll('.admin-section').forEach(s => {
        s.classList.remove('active');
    });
    document.querySelectorAll('.menu-item').forEach(m => {
        m.classList.remove('active');
    });

    document.getElementById(seccion).classList.add('active');
    document.querySelector(`[data-section="${seccion}"]`).classList.add('active');

    if (seccion === 'dashboard') {
        actualizarDashboard();
    } else if (seccion === 'productos') {
        mostrarProductos();
    } else if (seccion === 'ordenes_tienda') {
        mostrarProductosOrdenTienda();
        mostrarOrdenesTienda();
    } else if (seccion === 'pedidos') {
        mostrarPedidos();
    } else if (seccion === 'menus') {
        mostrarMenus();
    } else if (seccion === 'galeria') {
        mostrarGaleria();
    } else if (seccion === 'configuracion') {
        cargarPreviewsConfiguracion();
    } else if (seccion === 'comentarios') {
        mostrarComentarios();
    }
}

// ============================================
// CARGAR DATOS DE FIREBASE
// ============================================

async function cargarDatos() {
    try {
        const { collection, getDocs, query, orderBy } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');
        
        // Productos
        const productosSnap = await getDocs(collection(db, 'productos'));
        productos = [];
        productosSnap.forEach(doc => {
            productos.push({ id: doc.id, ...doc.data() });
        });

        // Pedidos
        const pedidosSnap = await getDocs(query(collection(db, 'pedidos'), orderBy('fecha', 'desc')));
        pedidos = [];
        pedidosSnap.forEach(doc => {
            pedidos.push({ id: doc.id, ...doc.data() });
        });

        // Órdenes en tienda
        const ordenesTiendaSnap = await getDocs(query(collection(db, 'pedidos_tienda'), orderBy('fecha', 'desc')));
        ordenesTienda = [];
        ordenesTiendaSnap.forEach(doc => {
            ordenesTienda.push({ id: doc.id, ...doc.data() });
        });

        // Comentarios
        const comentariosSnap = await getDocs(collection(db, 'comentarios'));
        comentarios = [];
        comentariosSnap.forEach(doc => {
            comentarios.push({ id: doc.id, ...doc.data() });
        });

        // Menús
        const menusSnap = await getDocs(collection(db, 'menus'));
        menus = [];
        menusSnap.forEach(doc => {
            menus.push({ id: doc.id, ...doc.data() });
        });

        // Galería
        const galeriaSnap = await getDocs(collection(db, 'galeria'));
        galeria = [];
        galeriaSnap.forEach(doc => {
            galeria.push({ id: doc.id, ...doc.data() });
        });

        document.getElementById('loadingMessage').style.display = 'none';
        actualizarDashboard();
        console.log('Datos cargados correctamente');
        
        iniciarListenerPedidosAdmin();
        iniciarListenerOrdenesTiendaAdmin();
    } catch (error) {
        console.error('Error al cargar datos:', error);
        mostrarError('Error al cargar datos: ' + error.message);
    }
}

// ============================================
// LISTENERS EN TIEMPO REAL
// ============================================

let unsubscribePedidosAdmin = null;
let unsubscribeOrdenesTiendaAdmin = null;

async function iniciarListenerPedidosAdmin() {
    try {
        console.log('🔄 Iniciando listener de pedidos en tiempo real (ADMIN)...');
        const { collection, query, orderBy, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');
        
        if (unsubscribePedidosAdmin) {
            console.log('🛑 Deteniendo listener anterior');
            unsubscribePedidosAdmin();
        }
        
        const q = query(collection(db, 'pedidos'), orderBy('fecha', 'desc'));
        unsubscribePedidosAdmin = onSnapshot(q, (snapshot) => {
            console.log('🔔 Cambios detectados en pedidos (ADMIN). Actualizando...');
            pedidos = [];
            snapshot.forEach(doc => {
                pedidos.push({ id: doc.id, ...doc.data() });
            });
            console.log('✅ Actualizando panel de pedidos. Total:', pedidos.length);
            mostrarPedidos();
        }, (error) => {
            console.error('❌ Error en listener de pedidos (ADMIN):', error);
        });
    } catch (error) {
        console.error('Error iniciando listener:', error);
    }
}

async function iniciarListenerOrdenesTiendaAdmin() {
    try {
        console.log('🔄 Iniciando listener de órdenes en tienda (ADMIN)...');
        const { collection, query, orderBy, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');
        
        if (unsubscribeOrdenesTiendaAdmin) {
            console.log('🛑 Deteniendo listener anterior de órdenes tienda');
            unsubscribeOrdenesTiendaAdmin();
        }
        
        const q = query(collection(db, 'pedidos_tienda'), orderBy('fecha', 'desc'));
        unsubscribeOrdenesTiendaAdmin = onSnapshot(q, (snapshot) => {
            console.log('🔔 Cambios detectados en órdenes tienda. Actualizando...');
            ordenesTienda = [];
            snapshot.forEach(doc => {
                ordenesTienda.push({ id: doc.id, ...doc.data() });
            });
            console.log('✅ Actualizando lista de órdenes tienda. Total:', ordenesTienda.length);
            mostrarOrdenesTienda();
        }, (error) => {
            console.error('❌ Error en listener de órdenes tienda:', error);
        });
    } catch (error) {
        console.error('Error iniciando listener de órdenes tienda:', error);
    }
}

function mostrarError(mensaje) {
    const loadingDiv = document.getElementById('loadingMessage');
    if (loadingDiv) {
        loadingDiv.textContent = '❌ ' + mensaje;
        loadingDiv.style.color = '#ff4757';
    }
}

// ============================================
// DASHBOARD
// ============================================

function actualizarDashboard() {
    const totalPedidos = pedidos.length;
    const pedidosPendientes = pedidos.filter(p => p.estado === 'pendiente').length;
    const pedidosCompletados = pedidos.filter(p => p.estado === 'completado').length;
    const ventasTotales = pedidos.reduce((sum, p) => sum + (p.total || 0), 0);

    const statsHTML = `
        <div class="stat-card">
            <i class="fas fa-box"></i>
            <div>
                <h3>${totalPedidos}</h3>
                <p>Pedidos Totales</p>
            </div>
        </div>
        <div class="stat-card">
            <i class="fas fa-hourglass-half"></i>
            <div>
                <h3>${pedidosPendientes}</h3>
                <p>Pedidos Pendientes</p>
            </div>
        </div>
        <div class="stat-card">
            <i class="fas fa-check-circle"></i>
            <div>
                <h3>${pedidosCompletados}</h3>
                <p>Pedidos Completados</p>
            </div>
        </div>
        <div class="stat-card">
            <i class="fas fa-dollar-sign"></i>
            <div>
                <h3>$${ventasTotales.toFixed(2)}</h3>
                <p>Ventas Totales</p>
            </div>
        </div>
    `;
    
    document.getElementById('dashboardStats').innerHTML = statsHTML;

    const pedidosRecientes = pedidos.slice(0, 5);
    let recientesHTML = '<h3>Pedidos Recientes</h3>';
    
    if (pedidosRecientes.length === 0) {
        recientesHTML += '<p style="text-align: center; color: #798839;">Sin pedidos aún</p>';
    } else {
        pedidosRecientes.forEach(pedido => {
            const fecha = new Date(pedido.fecha?.toDate?.() || pedido.fecha).toLocaleDateString('es-MX');
            recientesHTML += `
                <div class="pedido-card" style="cursor: pointer;" onclick="cambiarSeccion('pedidos')">
                    <div class="pedido-header">
                        <div class="pedido-id">#${pedido.id.substring(0, 8)}</div>
                        <span class="pedido-estado ${pedido.estado}">${pedido.estado}</span>
                    </div>
                    <p><strong>${pedido.nombre}</strong> - ${pedido.telefono}</p>
                    <p>Total: $${pedido.total?.toFixed(2) || '0.00'}</p>
                    <p style="font-size: 0.9rem; color: #6b7960;">${fecha}</p>
                </div>
            `;
        });
    }
    
    document.getElementById('dashboardRecent').innerHTML = recientesHTML;
    mostrarProductos();
    mostrarMenus();
    mostrarGaleria();
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

    document.getElementById('btnCancelarProducto').addEventListener('click', () => {
        document.getElementById('formProductoContainer').style.display = 'none';
    });

    document.getElementById('formProducto').addEventListener('submit', guardarProducto);
    document.getElementById('formEditarProducto').addEventListener('submit', guardarProductoEditado);

    document.querySelector('#editProductoModal .close').addEventListener('click', () => {
        document.getElementById('editProductoModal').classList.remove('show');
    });

    // Menús
    document.getElementById('btnAgregarMenu').addEventListener('click', () => {
        document.getElementById('formMenu').reset();
        document.getElementById('formMenuContainer').style.display = 'block';
    });

    document.getElementById('btnCancelarMenu').addEventListener('click', () => {
        document.getElementById('formMenuContainer').style.display = 'none';
    });

    document.getElementById('tipoMenu').addEventListener('change', (e) => {
        document.getElementById('imagenMenuGroup').style.display = e.target.value === 'imagen' ? 'block' : 'none';
        document.getElementById('enlaceMenuGroup').style.display = e.target.value === 'pdf' ? 'block' : 'none';
    });

    document.getElementById('archivoMenuPdf').addEventListener('change', (e) => {
        const archivo = e.target.files[0];
        if (archivo) {
            const maxSizeMB = 20;
            const fileSizeMB = archivo.size / (1024 * 1024);
            if (fileSizeMB > maxSizeMB) {
                alert(`❌ El archivo es demasiado grande (${fileSizeMB.toFixed(2)} MB). Máximo permitido: ${maxSizeMB} MB`);
                e.target.value = '';
            } else {
                console.log(`✅ Archivo válido (${fileSizeMB.toFixed(2)} MB) - Se convertirá a imagen`);
            }
        }
    });

    document.getElementById('formMenu').addEventListener('submit', guardarMenu);

    // Galería
    document.getElementById('btnAgregarGaleria').addEventListener('click', () => {
        document.getElementById('formGaleria').reset();
        document.getElementById('formGaleriaContainer').style.display = 'block';
    });

    document.getElementById('btnCancelarGaleria').addEventListener('click', () => {
        document.getElementById('formGaleriaContainer').style.display = 'none';
    });

    document.getElementById('formGaleria').addEventListener('submit', guardarImagenGaleria);

    // Configuración
    document.getElementById('btnGuardarLogo').addEventListener('click', guardarLogo);
    document.getElementById('btnEliminarLogo').addEventListener('click', eliminarLogo);
    document.getElementById('btnGuardarImagenPrincipal').addEventListener('click', guardarImagenPrincipal);
    document.getElementById('btnEliminarImagenPrincipal').addEventListener('click', eliminarImagenPrincipal);

    cargarPreviewsConfiguracion();

    // Filtros de pedidos
    document.getElementById('buscarPedido').addEventListener('input', mostrarPedidos);
    document.getElementById('filtroEstado').addEventListener('change', mostrarPedidos);

    // ========== ÓRDENES EN TIENDA ==========
    document.getElementById('btnNuevaOrdenTienda').addEventListener('click', () => {
        ordenTiendaActual = [];
        document.getElementById('nombreOrdenTienda').value = '';
        document.getElementById('mesaOrdenTienda').value = '';
        document.getElementById('observacionesOrdenTienda').value = '';
        actualizarResumenOrdenTienda();
    });

    document.getElementById('btnGuardarOrdenTienda').addEventListener('click', guardarOrdenTienda);
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
        const { collection, addDoc } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');

        let imagenBase64 = null;
        if (archivoImagen) {
            imagenBase64 = await fileToBase64(archivoImagen);
        }

        const imagenAsset = imagenBase64 ? prepareAssetForFirestore(imagenBase64, 'imagen') : { imagen: null, imagenChunks: [], imagenSize: 0 };

        await addDoc(collection(db, 'productos'), {
            nombre: nombre,
            categoria: categoria,
            precio: precio,
            ingredientes: ingredientes,
            stock: stock,
            ...imagenAsset,
            creado: new Date()
        });

        document.getElementById('formProducto').reset();
        document.getElementById('formProductoContainer').style.display = 'none';
        await cargarDatos();
        mostrarProductos();
        alert('✅ Producto agregado exitosamente');
    } catch (error) {
        console.error('Error:', error);
        alert('❌ Error al agregar producto: ' + error.message);
    }
}

async function mostrarProductos() {
    const container = document.getElementById('listaProductos');
    container.innerHTML = '';

    if (productos.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #798839;">Sin productos. Agrega uno para comenzar.</p>';
        return;
    }

    productos.forEach(producto => {
        const stockClass = producto.stock <= 5 ? 'bajo' : '';
        const card = document.createElement('div');
        card.className = 'producto-admin-card';

        const imagenProducto = getStoredAsset(producto, 'imagen');
        card.innerHTML = `
            <div class="producto-admin-img">
                ${imagenProducto ? `<img src="${imagenProducto}" alt="${producto.nombre}" style="width: 100%; height: 100%; object-fit: cover;">` : '🥗'}
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
        container.appendChild(card);
    });
}

async function editarProducto(productoId) {
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
        const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');

        await updateDoc(doc(db, 'productos', productoEditando.id), {
            nombre: document.getElementById('editNombreProducto').value,
            categoria: document.getElementById('editCategoriaProducto').value,
            precio: parseFloat(document.getElementById('editPrecioProducto').value),
            ingredientes: document.getElementById('editIngredientesProducto').value,
            stock: parseInt(document.getElementById('editStockProducto').value)
        });

        document.getElementById('editProductoModal').classList.remove('show');
        await cargarDatos();
        mostrarProductos();
        alert('✅ Producto actualizado');
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
}

async function eliminarProducto(productoId) {
    if (!confirm('¿Estás seguro?')) return;

    try {
        const { deleteDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');

        await deleteDoc(doc(db, 'productos', productoId));
        await cargarDatos();
        mostrarProductos();
        alert('✅ Producto eliminado');
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
}

// ============================================
// ÓRDENES EN TIENDA
// ============================================

function mostrarProductosOrdenTienda() {
    const container = document.getElementById('listaProductosTienda');
    if (!container) return;

    container.innerHTML = '';

    if (!productos.length) {
        container.innerHTML = '<p style="text-align: center; color: #798839;">No hay productos disponibles.</p>';
        return;
    }

    productos.forEach(producto => {
        const card = document.createElement('div');
        card.className = 'producto-admin-card';
        const imagenProducto = getStoredAsset(producto, 'imagen');

        card.innerHTML = `
            <div class="producto-admin-img">${imagenProducto ? `<img src="${imagenProducto}" alt="${producto.nombre}" style="width:100%;height:100%;object-fit:cover;">` : '🍕'}</div>
            <div class="producto-admin-info">
                <div class="producto-admin-nombre">${producto.nombre}</div>
                <div class="producto-admin-precio">$${Number(producto.precio || 0).toFixed(2)}</div>
                <div style="display:flex; gap:0.5rem; align-items:center; margin-top:0.5rem;">
                    <input type="number" min="1" value="1" id="cantidad-${producto.id}" style="width: 60px; padding: 0.45rem; border: 1px solid #ddd; border-radius: 8px;">
                    <button type="button" class="btn-primary" onclick="agregarProductoOrdenTienda('${producto.id}')">Agregar</button>
                </div>
            </div>`;
        container.appendChild(card);
    });
}

function agregarProductoOrdenTienda(productoId) {
    const producto = productos.find(item => item.id === productoId);
    if (!producto) return;

    const cantidadInput = document.getElementById(`cantidad-${productoId}`);
    const cantidad = Math.max(1, parseInt(cantidadInput?.value || '1', 10) || 1);

    const itemExistente = ordenTiendaActual.find(item => item.id === productoId);
    if (itemExistente) {
        itemExistente.cantidad += cantidad;
    } else {
        ordenTiendaActual.push({
            id: producto.id,
            nombre: producto.nombre,
            precio: Number(producto.precio || 0),
            cantidad
        });
    }

    actualizarResumenOrdenTienda();
}

function quitarProductoOrdenTienda(productoId) {
    ordenTiendaActual = ordenTiendaActual.filter(item => item.id !== productoId);
    actualizarResumenOrdenTienda();
}

function actualizarResumenOrdenTienda() {
    const resumen = document.getElementById('resumenOrdenTienda');
    const total = document.getElementById('totalOrdenTienda');
    if (!resumen || !total) return;

    if (!ordenTiendaActual.length) {
        resumen.innerHTML = '<p style="color:#5f6368;">Aún no hay productos seleccionados.</p>';
        total.textContent = '0.00';
        return;
    }

    const subtotal = ordenTiendaActual.reduce((sum, item) => sum + item.precio * item.cantidad, 0);
    total.textContent = subtotal.toFixed(2);

    resumen.innerHTML = ordenTiendaActual.map(item => `
        <div style="display:flex; justify-content:space-between; gap:0.75rem; padding:0.45rem 0; border-bottom:1px solid #f0f0f0;">
            <div>
                <strong>${item.nombre}</strong><br>
                <small style="color:#5f6368;">x${item.cantidad} · $${item.precio.toFixed(2)} c/u</small>
            </div>
            <button type="button" class="btn-danger" onclick="quitarProductoOrdenTienda('${item.id}')" style="padding:0.35rem 0.5rem; font-size:0.9rem;">Quitar</button>
        </div>
    `).join('');
}

async function guardarOrdenTienda() {
    if (!ordenTiendaActual.length) {
        alert('Selecciona al menos un producto para la orden.');
        return;
    }

    const nombreCliente = document.getElementById('nombreOrdenTienda')?.value.trim();
    const mesa = document.getElementById('mesaOrdenTienda')?.value.trim();
    const observaciones = document.getElementById('observacionesOrdenTienda')?.value.trim();

    if (!nombreCliente || !mesa) {
        alert('Escribe el nombre del cliente y el número de mesa para continuar.');
        return;
    }

    try {
        const { collection, addDoc } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');
        const total = ordenTiendaActual.reduce((sum, item) => sum + item.precio * item.cantidad, 0);

        const orden = {
            nombre: nombreCliente,
            mesa,
            observaciones: observaciones || '',
            items: ordenTiendaActual,
            total,
            estado: 'pendiente',
            metodoPago: 'en_tienda',
            fecha: new Date(),
            tipo: 'tienda'
        };

        const docRef = await addDoc(collection(db, 'pedidos_tienda'), orden);
        const ordenGuardada = {
            ...orden,
            id: docRef.id,
            fecha: new Date()
        };

        const printWindow = window.open('', '_blank', 'width=340,height=720');
        if (!printWindow) {
            alert('Permite ventanas emergentes para imprimir el ticket.');
            return;
        }

        setTimeout(() => {
            generarTicketTienda(ordenGuardada, printWindow);
            printWindow.focus();
        }, 150);

        ordenTiendaActual = [];
        document.getElementById('nombreOrdenTienda').value = '';
        document.getElementById('mesaOrdenTienda').value = '';
        document.getElementById('observacionesOrdenTienda').value = '';
        actualizarResumenOrdenTienda();
        await cargarDatos();
        mostrarOrdenesTienda();
        alert('✅ Orden registrada correctamente.');
    } catch (error) {
        console.error('Error guardando orden en tienda:', error);
        alert('❌ No se pudo guardar la orden: ' + error.message);
    }
}

function generarTicketTienda(orden, printWindow = null) {
    const fecha = new Date(orden.fecha?.toDate?.() || orden.fecha);
    const fechaTexto = isNaN(fecha.getTime()) ? 'Fecha no disponible' : fecha.toLocaleString('es-MX');
    const items = orden.items
        .map(item => `${item.cantidad}x ${item.nombre}   $${(item.precio * item.cantidad).toFixed(2)}`)
        .join('\n');

    const html = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8" />
          <title>Ticket - ${orden.nombre}</title>
          <style>
            @page { size: 80mm auto; margin: 0; }
            html, body { margin: 0; padding: 0; background: #fff; }
            body { width: 80mm; font-family: 'Courier New', Courier, monospace; font-size: 12px; color: #000; }
            .ticket { padding: 10px; box-sizing: border-box; }
            .center { text-align: center; }
            .bold { font-weight: 700; }
            hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
            .row { display: flex; justify-content: space-between; gap: 8px; }
            .small { font-size: 11px; }
            pre { margin: 0; white-space: pre-wrap; font-family: 'Courier New', Courier, monospace; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="ticket">
            <div class="center bold">CAROLAS GREEN</div>
            <div class="center small">Orden en tienda</div>
            <hr>
            <div class="small">Cliente: ${orden.nombre}</div>
            <div class="small">Mesa: ${orden.mesa}</div>
            <div class="small">Fecha: ${fechaTexto}</div>
            ${orden.observaciones ? `<div class="small">Obs: ${orden.observaciones}</div>` : ''}
            <hr>
            <pre>${items}</pre>
            <hr>
            <div class="row bold"><span>Total</span><span>$${Number(orden.total || 0).toFixed(2)}</span></div>
            <hr>
            <div class="center small">¡Gracias por su visita!</div>
            <div class="center" style="margin-top: 8px;">
              <button type="button" onclick="window.print();" style="padding: 6px 10px; font-family: 'Courier New', Courier, monospace; font-size: 11px;">Imprimir ticket</button>
            </div>
          </div>
        </body>
        </html>`;

    const targetWindow = printWindow || window.open('', '_blank', 'width=340,height=720');
    if (!targetWindow) {
        alert('Permite ventanas emergentes para imprimir el ticket.');
        return;
    }

    targetWindow.document.open();
    targetWindow.document.write(html);
    targetWindow.document.close();
    targetWindow.focus();
}

function mostrarOrdenesTienda() {
    const container = document.getElementById('listaOrdenesTienda');
    if (!container) return;

    container.innerHTML = '';

    if (!ordenesTienda.length) {
        container.innerHTML = '<p style="text-align: center; color: #798839;">No hay órdenes en tienda aún.</p>';
        return;
    }

    ordenesTienda.forEach(orden => {
        const fechaTicket = new Date(orden.fecha?.toDate?.() || orden.fecha);
        const fechaTexto = isNaN(fechaTicket.getTime()) ? 'Fecha no disponible' : fechaTicket.toLocaleString('es-MX');
        const itemsHtml = orden.items.map(item => `<div class="pedido-item"><span class="pedido-item-nombre">${item.nombre}</span><span class="pedido-item-cantidad">x${item.cantidad}</span><span class="pedido-item-precio">$${(item.precio * item.cantidad).toFixed(2)}</span></div>`).join('');

        const card = document.createElement('div');
        card.className = 'pedido-card pendiente';
        card.innerHTML = `
            <div class="pedido-header">
                <div class="pedido-id">${orden.nombre} · Mesa ${orden.mesa}</div>
                <span class="pedido-estado pendiente">${orden.estado}</span>
            </div>
            <div class="pedido-info">
                <div class="pedido-detail"><label>Fecha</label><p>${fechaTexto}</p></div>
                <div class="pedido-detail"><label>Total</label><p style="color:#dbb42a;font-weight:bold;">$${Number(orden.total || 0).toFixed(2)}</p></div>
                ${orden.observaciones ? `<div class="pedido-detail"><label>Observaciones</label><p>${orden.observaciones}</p></div>` : ''}
            </div>
            <div class="pedido-items"><h4>Artículos:</h4>${itemsHtml}<div class="pedido-total">Total: $${Number(orden.total || 0).toFixed(2)}</div></div>
            <div class="pedido-actions"><button class="btn-primary" type="button" onclick="imprimirTicketTienda('${orden.id}')">Imprimir ticket</button></div>`;
        container.appendChild(card);
    });
}

function imprimirTicketTienda(ordenId) {
    // Buscar la orden en el arreglo global
    const orden = ordenesTienda.find(o => o.id === ordenId);
    if (!orden) {
        alert('Orden no encontrada');
        return;
    }

    // Normalizar fecha (por si viene como Timestamp o string)
    const fecha = new Date(orden.fecha?.toDate?.() || orden.fecha);
    const ordenNormalizada = {
        ...orden,
        fecha: fecha && !isNaN(fecha.getTime()) ? fecha : new Date(),
        total: Number(orden.total || 0)
    };

    const printWindow = window.open('', '_blank', 'width=340,height=720');
    if (!printWindow) {
        alert('Permite ventanas emergentes para imprimir el ticket.');
        return;
    }

    setTimeout(() => {
        generarTicketTienda(ordenNormalizada, printWindow);
        printWindow.focus();
    }, 150);
}

// ============================================
// PEDIDOS
// ============================================

async function mostrarPedidos() {
    const container = document.getElementById('listaPedidos');
    const buscar = document.getElementById('buscarPedido')?.value.toLowerCase() || '';
    const filtro = document.getElementById('filtroEstado')?.value || '';

    let pedidosFiltrados = pedidos;

    if (buscar) {
        pedidosFiltrados = pedidosFiltrados.filter(p => 
            p.nombre.toLowerCase().includes(buscar) || 
            p.telefono.includes(buscar)
        );
    }

    if (filtro) {
        pedidosFiltrados = pedidosFiltrados.filter(p => p.estado === filtro);
    }

    container.innerHTML = '';

    if (pedidosFiltrados.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #798839;">Sin pedidos</p>';
        return;
    }

    pedidosFiltrados.forEach(pedido => {
        const fecha = new Date(pedido.fecha?.toDate?.() || pedido.fecha).toLocaleDateString('es-MX');
        const comprobanteValue = getStoredAsset(pedido, 'comprobante');
        const comprobanteHTML = comprobanteValue
            ? `<div class="pedido-comprobante"><p><strong>Comprobante:</strong> <a href="${comprobanteValue}" target="_blank" download="${pedido.comprobanteNombre || 'comprobante'}">Descargar</a></p></div>`
            : ((pedido.comprobanteChunks || 0) > 0 || pedido.comprobanteSize > 0
                ? `<div class="pedido-comprobante"><p><strong>Comprobante:</strong> <button class="btn-secondary" onclick="descargarComprobanteAdmin('${pedido.id}', '${pedido.comprobanteNombre || 'comprobante'}')">Descargar</button></p></div>`
                : '');
        const itemsHTML = pedido.items.map(item =>
            `<div class="pedido-item">
                <span class="pedido-item-nombre">${item.nombre}</span>
                <span class="pedido-item-cantidad">x${item.cantidad}</span>
                <span class="pedido-item-precio">$${(item.precio * item.cantidad).toFixed(2)}</span>
            </div>`
        ).join('');

        const card = document.createElement('div');
        card.className = `pedido-card ${pedido.estado}`;

        card.innerHTML = `
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
                    <label>Ubicación GPS</label>
                    <p>${pedido.ubicacionCliente ? `📍 ${pedido.ubicacionCliente.lat?.toFixed(4)}, ${pedido.ubicacionCliente.lng?.toFixed(4)}` : '⚠️ No disponible'}</p>
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
                    <p style="color: #dbb42a; font-weight: bold;">$${pedido.total?.toFixed(2)}</p>
                </div>
            </div>
            <div class="pedido-items">
                <h4>Artículos:</h4>
                ${itemsHTML}
                <div class="pedido-total">Total: $${pedido.total?.toFixed(2)}</div>
            </div>
            ${comprobanteHTML}
            <div class="pedido-actions">
                <button class="btn-secondary" onclick="mostrarMapaAdmin('${pedido.id}', '${pedido.direccion}', '${pedido.nombre}', ${pedido.ubicacionCliente?.lat || 'null'}, ${pedido.ubicacionCliente?.lng || 'null'})">📍 Ver Mapa</button>
                <button class="btn-secondary" onclick="cambiarEstadoPedido('${pedido.id}', 'visto')">Marcar Visto</button>
                <button class="btn-secondary" onclick="cambiarEstadoPedido('${pedido.id}', 'preparacion')">En Preparación</button>
                <button class="btn-secondary" onclick="cambiarEstadoPedido('${pedido.id}', 'camino')">En Camino</button>
                <button class="btn-primary" onclick="cambiarEstadoPedido('${pedido.id}', 'completado')">Completado</button>
                <button class="btn-danger" onclick="eliminarPedido('${pedido.id}')">Eliminar</button>
            </div>
        `;
        container.appendChild(card);
    });
}

async function descargarComprobanteAdmin(pedidoId, nombre = 'comprobante') {
    try {
        const { collection, getDocs, query, orderBy } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');
        const q = query(collection(db, 'pedidos', pedidoId, 'comprobanteParts'), orderBy('index', 'asc'));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            alert('❌ No se encontró comprobante para descargar');
            return;
        }

        const dataUrl = snapshot.docs.map(doc => doc.data().chunk || '').join('');
        if (!dataUrl) {
            alert('❌ El comprobante está vacío');
            return;
        }

        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = nombre;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        console.error('Error descargando comprobante del admin:', error);
        alert('❌ No se pudo descargar el comprobante');
    }
}

async function cambiarEstadoPedido(pedidoId, nuevoEstado) {
    try {
        const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');

        await updateDoc(doc(db, 'pedidos', pedidoId), {
            estado: nuevoEstado,
            visto: true
        });
        await cargarDatos();
        mostrarPedidos();
        alert('✅ Estado actualizado');
        
        if (nuevoEstado === 'camino') {
            setTimeout(() => {
                const compartir = confirm('✅ Pedido en camino!\n\n¿Quieres compartir tu ubicación en tiempo real con el cliente?');
                if (compartir) {
                    iniciarCompartirUbicacionRepartidor(pedidoId);
                }
            }, 500);
        }
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
}

async function eliminarPedido(pedidoId) {
    if (!confirm('¿Estás seguro?')) return;

    try {
        const { deleteDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');

        await deleteDoc(doc(db, 'pedidos', pedidoId));
        await cargarDatos();
        mostrarPedidos();
        alert('✅ Pedido eliminado');
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
}

// ============================================
// COMPARTIR UBICACIÓN DEL REPARTIDOR
// ============================================

let idPedidoCompartiendoUbicacion = null;
let intervaloUbicacionRepartidor = null;

async function iniciarCompartirUbicacionRepartidor(pedidoId) {
    if (!navigator.geolocation) {
        alert('❌ Tu navegador no soporta geolocalización');
        return;
    }

    idPedidoCompartiendoUbicacion = pedidoId;
    console.log('🚗 Iniciando compartir ubicación para pedido:', pedidoId);
    alert('📍 Compartiendo tu ubicación en tiempo real...\n\nEl cliente verá tu posición actualizándose cada 5 segundos.\n\nHaz clic en "Detener compartición" para pausar.');

    await actualizarUbicacionRepartidor(pedidoId);

    if (intervaloUbicacionRepartidor) {
        clearInterval(intervaloUbicacionRepartidor);
    }

    intervaloUbicacionRepartidor = setInterval(() => {
        if (idPedidoCompartiendoUbicacion === pedidoId) {
            actualizarUbicacionRepartidor(pedidoId);
        }
    }, 5000);
}

async function actualizarUbicacionRepartidor(pedidoId) {
    return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');

                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;

                    await updateDoc(doc(db, 'pedidos', pedidoId), {
                        repartidorUbicacion: {
                            lat: lat,
                            lng: lng,
                            timestamp: new Date()
                        }
                    });

                    console.log('📡 Ubicación repartidor actualizada:', { lat: lat.toFixed(4), lng: lng.toFixed(4) });
                    resolve();
                } catch (error) {
                    console.error('Error actualizando ubicación:', error);
                    resolve();
                }
            },
            (error) => {
                console.warn('Error obteniendo ubicación:', error);
                resolve();
            }
        );
    });
}

function detenerCompartirUbicacion() {
    if (intervaloUbicacionRepartidor) {
        clearInterval(intervaloUbicacionRepartidor);
        intervaloUbicacionRepartidor = null;
    }
    idPedidoCompartiendoUbicacion = null;
    console.log('🛑 Compartición de ubicación detenida');
}

// ============================================
// FUNCIONES DE MAPA
// ============================================

let mapaInstanciaAdmin = null;

function mostrarMapaAdmin(pedidoId, direccionCliente, nombreCliente, lat = null, lng = null) {
    const modal = document.getElementById('mapaAdminModal');
    const mapContainer = document.getElementById('mapAdminContainer');
    const mapaInfo = document.getElementById('mapaAdminInfo');
    
    if (mapaInstanciaAdmin) {
        try {
            mapaInstanciaAdmin.off();
            mapaInstanciaAdmin.remove();
            mapaInstanciaAdmin = null;
        } catch (e) {
            console.warn('Error removiendo mapa anterior:', e);
        }
    }
    
    mapContainer.innerHTML = '';
    modal.classList.add('show');
    mapaInfo.innerHTML = `<p>📍 <strong>Cliente:</strong> ${nombreCliente}</p><p>📮 <strong>Dirección:</strong> ${direccionCliente}</p><p>⏳ Cargando ubicación...</p>`;
    
    setTimeout(() => {
        try {
            const mapa = L.map('mapAdminContainer', {
                preferCanvas: true
            }).setView([18.4241, -69.9267], 13);
            mapaInstanciaAdmin = mapa;
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '© OpenStreetMap contributors'
            }).addTo(mapa);
            
            mapa.invalidateSize(false);
    
            const pedidoData = pedidos.find(p => p.id === pedidoId);
            const repartidorUbicacion = pedidoData?.repartidorUbicacion || null;
            
            if (lat !== null && lng !== null) {
                console.log('Usando coordenadas directas:', lat, lng);
                
                const group = new L.FeatureGroup();
                
                const markerCliente = L.marker([lat, lng], {
                    icon: L.icon({
                        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                        iconSize: [25, 41],
                        iconAnchor: [12, 41],
                        popupAnchor: [1, -34],
                        shadowSize: [41, 41]
                    })
                }).bindPopup(`<strong>${nombreCliente}</strong><br>${direccionCliente}`);
                
                group.addLayer(markerCliente);
                markerCliente.addTo(mapa);
                
                let infoText = `
                    <p>📍 <strong>Cliente:</strong> ${nombreCliente}</p>
                    <p>📮 <strong>Dirección:</strong> ${direccionCliente}</p>
                    <p>📍 <strong>Coordenadas GPS:</strong> ${lat.toFixed(4)}, ${lng.toFixed(4)}</p>
                    <p style="font-size: 0.9rem; color: #666; margin-top: 0.5rem;">📍 Ubicación del cliente (en tiempo real)</p>
                `;
                
                if (repartidorUbicacion && repartidorUbicacion.lat && repartidorUbicacion.lng) {
                    console.log('Ubicación del repartidor:', repartidorUbicacion);
                    const repLat = repartidorUbicacion.lat;
                    const repLng = repartidorUbicacion.lng;
                    
                    const markerRepartidor = L.marker([repLat, repLng], {
                        icon: L.icon({
                            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
                            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                            iconSize: [25, 41],
                            iconAnchor: [12, 41],
                            popupAnchor: [1, -34],
                            shadowSize: [41, 41]
                        })
                    }).bindPopup(`<strong>🚗 Repartidor</strong><br>En camino`);
                    
                    group.addLayer(markerRepartidor);
                    markerRepartidor.addTo(mapa);
                    
                    const polyline = L.polyline([[lat, lng], [repLat, repLng]], {
                        color: '#0066ff',
                        weight: 3,
                        opacity: 0.7,
                        dashArray: '5, 5'
                    }).addTo(mapa);
                    
                    group.addLayer(polyline);
                    
                    const R = 6371;
                    const dLat = (repLat - lat) * Math.PI / 180;
                    const dLng = (repLng - lng) * Math.PI / 180;
                    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                              Math.cos(lat * Math.PI / 180) * Math.cos(repLat * Math.PI / 180) *
                              Math.sin(dLng/2) * Math.sin(dLng/2);
                    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                    const distancia = (R * c).toFixed(2);
                    
                    const timestamp = repartidorUbicacion.timestamp ? 
                        new Date(repartidorUbicacion.timestamp).toLocaleString() : 'Sin actualizar';
                    
                    infoText += `
                        <hr style="margin: 0.5rem 0;">
                        <p>🚗 <strong>Repartidor:</strong> En camino</p>
                        <p>📍 <strong>Coordenadas:</strong> ${repLat.toFixed(4)}, ${repLng.toFixed(4)}</p>
                        <p>📏 <strong>Distancia:</strong> ${distancia} km</p>
                        <p style="font-size: 0.85rem; color: #666;">⏰ Actualizado: ${timestamp}</p>
                        <p style="font-size: 0.9rem; color: #666; margin-top: 0.5rem;">🟢 Ubicación del repartidor (en tiempo real)</p>
                    `;
                    
                    try {
                        mapa.fitBounds(group.getBounds().pad(0.15), {maxZoom: 15, animate: true});
                    } catch (e) {
                        console.warn('Error en fitBounds:', e);
                        mapa.setView([lat, lng], 13);
                    }
                } else {
                    mapa.setView([lat, lng], 15);
                }
                
                mapaInfo.innerHTML = infoText;
            } else {
                console.log('⚠️ Sin coordenadas GPS - mostrando ubicación por defecto');
                const destLat = 18.4241;
                const destLng = -69.9267;
                const data = [{lat: destLat, lon: destLng}];
                
                Promise.resolve(data)
                    .then(data => {
                        if (data.length > 0) {
                            const destLatResult = parseFloat(data[0].lat);
                            const destLngResult = parseFloat(data[0].lon);
                            
                            const group = new L.FeatureGroup();
                            
                            const markerCliente = L.marker([destLatResult, destLngResult], {
                                icon: L.icon({
                                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                                    iconSize: [25, 41],
                                    iconAnchor: [12, 41],
                                    popupAnchor: [1, -34],
                                    shadowSize: [41, 41]
                                })
                            }).bindPopup(`<strong>${nombreCliente}</strong><br>${direccionCliente}`);
                            
                            group.addLayer(markerCliente);
                            markerCliente.addTo(mapa);
                            
                            let infoText = `
                                <p>📍 <strong>Cliente:</strong> ${nombreCliente}</p>
                                <p>📮 <strong>Dirección registrada:</strong> ${direccionCliente}</p>
                                <p>📌 <strong>Coordenadas:</strong> ${destLat.toFixed(4)}, ${destLng.toFixed(4)}</p>
                                <p style="font-size: 0.9rem; color: #f39c12; margin-top: 0.5rem;">⚠️ Sin GPS del cliente - mostrando ubicación por defecto</p>
                            `;
                            
                            if (repartidorUbicacion && repartidorUbicacion.lat && repartidorUbicacion.lng) {
                                console.log('🚗 Ubicación del repartidor:', repartidorUbicacion);
                                const repLat = repartidorUbicacion.lat;
                                const repLng = repartidorUbicacion.lng;
                                
                                const markerRepartidor = L.marker([repLat, repLng], {
                                    icon: L.icon({
                                        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
                                        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                                        iconSize: [25, 41],
                                        iconAnchor: [12, 41],
                                        popupAnchor: [1, -34],
                                        shadowSize: [41, 41]
                                    })
                                }).bindPopup(`<strong>🚗 Repartidor</strong><br>En camino`);
                                
                                group.addLayer(markerRepartidor);
                                markerRepartidor.addTo(mapa);
                                
                                const polyline = L.polyline([[destLatResult, destLngResult], [repLat, repLng]], {
                                    color: '#0066ff',
                                    weight: 3,
                                    opacity: 0.7,
                                    dashArray: '5, 5'
                                }).addTo(mapa);
                                
                                group.addLayer(polyline);
                                
                                const R = 6371;
                                const dLat = (repLat - destLatResult) * Math.PI / 180;
                                const dLng = (repLng - destLngResult) * Math.PI / 180;
                                const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                                          Math.cos(destLatResult * Math.PI / 180) * Math.cos(repLat * Math.PI / 180) *
                                          Math.sin(dLng/2) * Math.sin(dLng/2);
                                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                                const distancia = (R * c).toFixed(2);
                                
                                const timestamp = repartidorUbicacion.timestamp ? 
                                    new Date(repartidorUbicacion.timestamp).toLocaleString() : 'Sin actualizar';
                                
                                infoText += `
                                    <hr style="margin: 0.5rem 0;">
                                    <p>🚗 <strong>Repartidor:</strong> En camino</p>
                                    <p>📍 <strong>Coordenadas:</strong> ${repLat.toFixed(4)}, ${repLng.toFixed(4)}</p>
                                    <p>📏 <strong>Distancia:</strong> ${distancia} km</p>
                                    <p style="font-size: 0.85rem; color: #666;">⏰ Actualizado: ${timestamp}</p>
                                    <p style="font-size: 0.9rem; color: #666; margin-top: 0.5rem;">🟢 Ubicación del repartidor (en tiempo real)</p>
                                `;
                                
                                try {
                                    mapa.fitBounds(group.getBounds().pad(0.15), {maxZoom: 15, animate: true});
                                } catch (e) {
                                    console.warn('Error en fitBounds:', e);
                                    mapa.setView([destLatResult, destLngResult], 13);
                                }
                            } else {
                                mapa.setView([destLatResult, destLngResult], 15);
                            }
                            
                            mapaInfo.innerHTML = infoText;
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
        } catch (error) {
            console.error('Error creando mapa admin:', error);
            mapaInfo.innerHTML = `<p>❌ Error al crear el mapa. Por favor intenta nuevamente.</p>`;
        }
    }, 300);
}

function cerrarMapaAdmin() {
    const modal = document.getElementById('mapaAdminModal');
    modal.classList.remove('show');
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
        const fecha = new Date(comentario.fecha?.toDate?.() || comentario.fecha).toLocaleDateString('es-MX');
        const card = document.createElement('div');
        card.className = `comentario-admin-card ${comentario.aprobado ? 'aprobado' : ''}`;

        card.innerHTML = `
            <div class="comentario-admin-header">
                <div>
                    <div class="comentario-admin-autor">${comentario.nombre}</div>
                    <div class="comentario-admin-email">${comentario.email}</div>
                </div>
                <span class="comentario-admin-estado ${comentario.aprobado ? 'aprobado' : ''}">${comentario.aprobado ? 'Aprobado' : 'Pendiente'}</span>
            </div>
            <div class="comentario-admin-texto">"${comentario.texto}"</div>
            <div class="comentario-admin-fecha">${fecha}</div>
            <div class="comentario-admin-actions">
                ${!comentario.aprobado ? `<button class="btn-secondary" onclick="aprobarComentario('${comentario.id}')">Aprobar</button>` : ''}
                <button class="btn-danger" onclick="eliminarComentario('${comentario.id}')">Eliminar</button>
            </div>
        `;
        container.appendChild(card);
    });
}

async function aprobarComentario(comentarioId) {
    try {
        const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');

        await updateDoc(doc(db, 'comentarios', comentarioId), {
            aprobado: true
        });
        await cargarDatos();
        mostrarComentarios();
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
}

async function eliminarComentario(comentarioId) {
    if (!confirm('¿Estás seguro?')) return;

    try {
        const { deleteDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');

        await deleteDoc(doc(db, 'comentarios', comentarioId));
        await cargarDatos();
        mostrarComentarios();
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
}

// ============================================
// MENÚS
// ============================================

async function guardarMenu(e) {
    e.preventDefault();

    const nombre = document.getElementById('nombreMenu').value;
    const tipo = document.getElementById('tipoMenu').value;
    const { collection, addDoc } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');

    try {
        let dataMenu = { nombre, tipo, creado: new Date() };

        if (tipo === 'imagen') {
            const archivo = document.getElementById('imagenMenu').files[0];
            if (archivo) {
                const imagenBase64 = await fileToBase64(archivo);
                Object.assign(dataMenu, prepareAssetForFirestore(imagenBase64, 'imagen'));
            }
        } else if (tipo === 'pdf') {
            const archivoPdf = document.getElementById('archivoMenuPdf').files[0];
            if (archivoPdf) {
                if (archivoPdf.size > 20 * 1024 * 1024) {
                    alert('❌ El archivo PDF no debe superar 20 MB');
                    return;
                }
                alert('⏳ Convirtiendo PDF a imagen, esto puede tomar unos segundos...');
                const imagenBase64 = await pdfToImage(archivoPdf);
                Object.assign(dataMenu, prepareAssetForFirestore(imagenBase64, 'imagen'));
            } else {
                alert('❌ Selecciona un archivo PDF');
                return;
            }
        }

        await addDoc(collection(db, 'menus'), dataMenu);
        document.getElementById('formMenu').reset();
        document.getElementById('formMenuContainer').style.display = 'none';
        await cargarDatos();
        mostrarMenus();
        alert('✅ Menú agregado exitosamente');
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
}

async function mostrarMenus() {
    const container = document.getElementById('listaMenus');
    if (!container) return;
    
    container.innerHTML = '';

    menus.forEach(menu => {
        const div = document.createElement('div');
        div.className = 'menu-admin-card';
        
        const imagenMenu = getStoredAsset(menu, 'imagen');
        let contenido = '<div class="menu-admin-info">';
        if (imagenMenu) {
            contenido += `<img src="${imagenMenu}" alt="${menu.nombre}">`;
        } else if (menu.tipo === 'pdf') {
            contenido += `<div style="width: 100%; height: 150px; background-color: #f0f0f0; display: flex; align-items: center; justify-content: center; border-radius: 5px;"><span style="font-size: 3rem;">📄</span></div>`;
        }
        contenido += `
            <h3>${menu.nombre}</h3>
            <p>Tipo: ${menu.tipo === 'pdf' ? 'PDF' : 'Imagen'}</p>
            <div class="menu-admin-actions">
                <button class="btn-danger" onclick="eliminarMenu('${menu.id}')">Eliminar</button>
            </div>
        </div>`;

        div.innerHTML = contenido;
        container.appendChild(div);
    });
}

async function eliminarMenu(menuId) {
    if (!confirm('¿Eliminar este menú?')) return;

    try {
        const { deleteDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');
        
        await deleteDoc(doc(db, 'menus', menuId));
        await cargarDatos();
        mostrarMenus();
        alert('✅ Menú eliminado');
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
}

// ============================================
// GALERÍA
// ============================================

async function guardarImagenGaleria(e) {
    e.preventDefault();

    const titulo = document.getElementById('tituloGaleria').value;
    const archivo = document.getElementById('archivoGaleria').files[0];

    if (!archivo) {
        alert('❌ Selecciona una imagen');
        return;
    }

    try {
        const { collection, addDoc } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');

        const imagenBase64 = await fileToBase64(archivo);
        const imagenAsset = prepareAssetForFirestore(imagenBase64, 'url');

        await addDoc(collection(db, 'galeria'), {
            titulo: titulo || 'Sin título',
            ...imagenAsset,
            creado: new Date()
        });

        document.getElementById('formGaleria').reset();
        document.getElementById('formGaleriaContainer').style.display = 'none';
        await cargarDatos();
        mostrarGaleria();
        alert('✅ Imagen agregada a la galería');
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
}

async function mostrarGaleria() {
    const container = document.getElementById('listaGaleria');
    if (!container) return;
    
    container.innerHTML = '';

    galeria.forEach(imagen => {
        const imagenGaleria = getStoredAsset(imagen, 'url');
        const div = document.createElement('div');
        div.className = 'galeria-admin-card';
        div.innerHTML = `
            <img src="${imagenGaleria}" alt="${imagen.titulo}">
            <button class="galeria-admin-delete" onclick="eliminarImagenGaleria('${imagen.id}')">Eliminar</button>
        `;
        container.appendChild(div);
    });
}

async function eliminarImagenGaleria(imagenId) {
    if (!confirm('¿Eliminar esta imagen?')) return;

    try {
        const { deleteDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');
        await deleteDoc(doc(db, 'galeria', imagenId));
        await cargarDatos();
        mostrarGaleria();
        alert('✅ Imagen eliminada');
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
}

// ============================================
// CONFIGURACIÓN
// ============================================

async function cargarPreviewsConfiguracion() {
    try {
        if (!db) {
            console.warn('Firebase no está inicializado aún');
            return;
        }

        const { getDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');
        const configDoc = await getDoc(doc(db, 'configuracion', 'tienda'));

        if (configDoc.exists()) {
            const config = configDoc.data();
            if (config.logo) {
                document.getElementById('previewLogo').src = config.logo;
                document.getElementById('previewLogo').style.display = 'block';
            }
            if (config.imagenPrincipal) {
                document.getElementById('previewImagenPrincipal').src = config.imagenPrincipal;
                document.getElementById('previewImagenPrincipal').style.display = 'block';
            }
        }
    } catch (error) {
        console.error('Error cargando previews:', error);
    }
}

async function guardarLogo(e) {
    const archivo = document.getElementById('archivoLogo').files[0];
    if (!archivo) {
        alert('❌ Selecciona una imagen');
        return;
    }

    try {
        const { setDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');

        const logoBase64 = await fileToBase64(archivo);
        const logoAsset = prepareAssetForFirestore(logoBase64, 'logo');

        await setDoc(doc(db, 'configuracion', 'tienda'), logoAsset, { merge: true });

        document.getElementById('previewLogo').src = getStoredAsset(logoAsset, 'logo') || logoBase64;
        document.getElementById('previewLogo').style.display = 'block';
        document.getElementById('archivoLogo').value = '';
        alert('✅ Logo actualizado');
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
}

async function eliminarLogo() {
    if (!confirm('¿Eliminar el logo?')) return;

    try {
        const { setDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');
        await setDoc(doc(db, 'configuracion', 'tienda'), { logo: null }, { merge: true });

        document.getElementById('previewLogo').style.display = 'none';
        alert('✅ Logo eliminado');
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
}

async function guardarImagenPrincipal(e) {
    const archivo = document.getElementById('archivoImagenPrincipal').files[0];
    if (!archivo) {
        alert('❌ Selecciona una imagen');
        return;
    }

    try {
        const { setDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');

        const imagenBase64 = await fileToBase64(archivo);
        const imagenAsset = prepareAssetForFirestore(imagenBase64, 'imagenPrincipal');

        await setDoc(doc(db, 'configuracion', 'tienda'), imagenAsset, { merge: true });

        document.getElementById('previewImagenPrincipal').src = getStoredAsset(imagenAsset, 'imagenPrincipal') || imagenBase64;
        document.getElementById('previewImagenPrincipal').style.display = 'block';
        document.getElementById('archivoImagenPrincipal').value = '';
        alert('✅ Imagen principal actualizada');
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
}

async function eliminarImagenPrincipal() {
    if (!confirm('¿Eliminar la imagen principal?')) return;

    try {
        const { setDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');
        await setDoc(doc(db, 'configuracion', 'tienda'), { imagenPrincipal: null }, { merge: true });

        document.getElementById('previewImagenPrincipal').style.display = 'none';
        alert('✅ Imagen principal eliminada');
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
}

// ============================================
// EXPONER FUNCIONES GLOBALMENTE
// ============================================

window.cambiarSeccion = cambiarSeccion;
window.editarProducto = editarProducto;
window.eliminarProducto = eliminarProducto;
window.cambiarEstadoPedido = cambiarEstadoPedido;
window.eliminarPedido = eliminarPedido;
window.descargarComprobanteAdmin = descargarComprobanteAdmin;
window.mostrarMapaAdmin = mostrarMapaAdmin;
window.cerrarMapaAdmin = cerrarMapaAdmin;
window.detenerCompartirUbicacion = detenerCompartirUbicacion;
window.iniciarCompartirUbicacionRepartidor = iniciarCompartirUbicacionRepartidor;
window.aprobarComentario = aprobarComentario;
window.eliminarComentario = eliminarComentario;
window.eliminarMenu = eliminarMenu;
window.eliminarImagenGaleria = eliminarImagenGaleria;

// Funciones específicas de órdenes en tienda
window.agregarProductoOrdenTienda = agregarProductoOrdenTienda;
window.quitarProductoOrdenTienda = quitarProductoOrdenTienda;
window.imprimirTicketTienda = imprimirTicketTienda;