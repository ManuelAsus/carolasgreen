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
let cajas = [];
let cajaActualData = null;
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
                actualizarPermisosOrdenesTienda();
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

function isAdminUser() {
    return usuarioActual?.email?.toLowerCase() === 'admin@carolasgreen.com';
}

function actualizarPermisosOrdenesTienda() {
    const esAdmin = isAdminUser();
    const btnAbrirCaja = document.getElementById('btnAbrirCaja');
    const btnReporteVentas = document.getElementById('btnReporteVentas');

    if (btnAbrirCaja) {
        btnAbrirCaja.disabled = !esAdmin;
        btnAbrirCaja.style.opacity = esAdmin ? '' : '0.6';
        btnAbrirCaja.style.cursor = esAdmin ? '' : 'not-allowed';
    }

    if (btnReporteVentas) {
        btnReporteVentas.disabled = !esAdmin;
        btnReporteVentas.style.opacity = esAdmin ? '' : '0.6';
        btnReporteVentas.style.cursor = esAdmin ? '' : 'not-allowed';
    }
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

    const sidebar = document.querySelector('.admin-sidebar');
    if (window.innerWidth <= 768 && sidebar) {
        sidebar.classList.remove('show');
    }

    if (seccion === 'dashboard') {
        actualizarDashboard();
    } else if (seccion === 'productos') {
        mostrarProductos();
    } else if (seccion === 'ordenes_tienda') {
        mostrarProductosOrdenTienda();
        mostrarOrdenesTienda();
        actualizarBotonCaja();
        mostrarHistorialCajas();
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

        // Cajas
        const cajasSnap = await getDocs(query(collection(db, 'cajas'), orderBy('fechaApertura', 'desc')));
        cajas = [];
        cajasSnap.forEach(doc => {
            cajas.push({ id: doc.id, ...doc.data() });
        });
        cajaActualData = cajas.find(c => c.estado === 'abierta') || null;

        document.getElementById('loadingMessage').style.display = 'none';
        actualizarDashboard();
        actualizarBotonCaja();
        mostrarHistorialCajas();
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

    const btnCargaMasiva = document.getElementById('btnCargaMasivaProductos');
    if (btnCargaMasiva) {
        btnCargaMasiva.addEventListener('click', async () => {
            if (!confirm('¿Deseas cargar todos los productos del menú de forma masiva?')) return;
            try {
                await import('./admin-bulk-upload.js');
                if (typeof window.bulkUploadProductos === 'function') {
                    await window.bulkUploadProductos();
                    await cargarDatos();
                    mostrarProductos();
                } else {
                    alert('No se encontró la función de carga masiva. Recarga la página.');
                }
            } catch (error) {
                console.error('Error cargando el módulo de carga masiva:', error);
                alert('Error al iniciar la carga masiva: ' + error.message);
            }
        });
    }

    document.getElementById('btnCancelarProducto').addEventListener('click', () => {
        document.getElementById('formProductoContainer').style.display = 'none';
    });

    document.getElementById('buscarProductoAdmin').addEventListener('input', mostrarProductos);
    document.getElementById('buscarProductoOrdenTienda').addEventListener('input', mostrarProductosOrdenTienda);

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
        document.getElementById('direccionOrdenTienda').value = '';
        document.getElementById('repartidorOrdenTienda').value = '';
        document.getElementById('detallesOrdenTienda').value = '';
        actualizarResumenOrdenTienda();
    });

    document.getElementById('btnGuardarOrdenTienda').addEventListener('click', guardarOrdenTienda);

    // ========== CAJA ==========
    document.getElementById('btnAbrirCaja').addEventListener('click', mostrarModalAbrirCaja);
    document.getElementById('btnReporteVentas').addEventListener('click', mostrarModalReporteVentas);
    document.getElementById('btnCerrarReporteVentas').addEventListener('click', () => {
        document.getElementById('modalReporteVentas').classList.remove('show');
    });
    document.getElementById('btnConfirmarAbrirCaja').addEventListener('click', abrirCaja);
    document.getElementById('btnCancelarAbrirCaja').addEventListener('click', () => {
        document.getElementById('modalAbrirCaja').classList.remove('show');
    });
    document.getElementById('btnConfirmarCerrarCaja').addEventListener('click', cerrarCaja);
    document.getElementById('btnCancelarCerrarCaja').addEventListener('click', () => {
        document.getElementById('modalCerrarCaja').classList.remove('show');
    });
    document.getElementById('btnCerrarReporteCaja').addEventListener('click', () => {
        document.getElementById('modalReporteCaja').classList.remove('show');
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

    const busqueda = document.getElementById('buscarProductoAdmin')?.value?.trim().toLowerCase() || '';
    const productosFiltrados = productos.filter(producto => {
        if (!busqueda) return true;
        return [producto.nombre, producto.categoria, producto.ingredientes, producto.seccion]
            .filter(Boolean)
            .some(valor => valor.toString().toLowerCase().includes(busqueda));
    });

    if (productosFiltrados.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #798839;">No se encontraron productos con esa búsqueda.</p>';
        return;
    }

    productosFiltrados.forEach(producto => {
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

        const actualizacion = {
            nombre: document.getElementById('editNombreProducto').value,
            categoria: document.getElementById('editCategoriaProducto').value,
            precio: parseFloat(document.getElementById('editPrecioProducto').value),
            ingredientes: document.getElementById('editIngredientesProducto').value,
            stock: parseInt(document.getElementById('editStockProducto').value)
        };

        const archivoImagen = document.getElementById('editImagenProducto').files[0];
        if (archivoImagen) {
            const imagenBase64 = await fileToBase64(archivoImagen);
            Object.assign(actualizacion, prepareAssetForFirestore(imagenBase64, 'imagen'));
        }

        await updateDoc(doc(db, 'productos', productoEditando.id), actualizacion);

        document.getElementById('editProductoModal').classList.remove('show');
        await cargarDatos();
        mostrarProductos();
        alert('✅ Producto actualizado');
    } catch (error) {
        console.error('Error editando producto:', error);
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

    const busqueda = document.getElementById('buscarProductoOrdenTienda')?.value?.trim().toLowerCase() || '';
    const productosFiltrados = productos.filter(producto => {
        if (!busqueda) return true;
        return [producto.nombre, producto.categoria, producto.ingredientes, producto.seccion]
            .filter(Boolean)
            .some(valor => valor.toString().toLowerCase().includes(busqueda));
    });

    container.innerHTML = '';

    if (!productosFiltrados.length) {
        container.innerHTML = '<p style="text-align: center; color: #798839;">No hay productos disponibles con ese criterio.</p>';
        return;
    }

    productosFiltrados.forEach(producto => {
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

function calcularTotalesCaja(ordenesPeriodo) {
    const resumen = {
        totalVentas: 0,
        totalVentasEfectivo: 0,
        totalVentasTransferencia: 0,
        totalOrdenes: ordenesPeriodo.length,
        productosVendidos: {},
        pagos: {
            efectivo: { cantidad: 0, total: 0 },
            transferencia: { cantidad: 0, total: 0 }
        }
    };

    ordenesPeriodo.forEach(orden => {
        const totalOrden = Number(orden.total || 0);
        const tipoPago = String(orden.tipoPago || orden.metodoPago || 'efectivo').toLowerCase();

        resumen.totalVentas += totalOrden;

        if (tipoPago === 'transferencia') {
            resumen.totalVentasTransferencia += totalOrden;
            resumen.pagos.transferencia.cantidad += 1;
            resumen.pagos.transferencia.total += totalOrden;
        } else {
            resumen.totalVentasEfectivo += totalOrden;
            resumen.pagos.efectivo.cantidad += 1;
            resumen.pagos.efectivo.total += totalOrden;
        }

        (orden.items || []).forEach(item => {
            const key = item.nombre;
            if (!resumen.productosVendidos[key]) {
                resumen.productosVendidos[key] = { cantidad: 0, total: 0, precio: item.precio };
            }
            resumen.productosVendidos[key].cantidad += item.cantidad;
            resumen.productosVendidos[key].total += Number(item.precio || 0) * item.cantidad;
        });
    });

    return resumen;
}

async function guardarOrdenTienda() {
    if (!ordenTiendaActual.length) {
        alert('Selecciona al menos un producto para la orden.');
        return;
    }

    const nombreCliente = document.getElementById('nombreOrdenTienda')?.value.trim();
    const telefonoCliente = document.getElementById('telefonoOrdenTienda')?.value.trim();
    const tipoPago = document.getElementById('tipoPagoOrdenTienda')?.value || 'efectivo';
    const mesa = document.getElementById('mesaOrdenTienda')?.value.trim();
    const direccion = document.getElementById('direccionOrdenTienda')?.value.trim();
    const repartidor = document.getElementById('repartidorOrdenTienda')?.value.trim();
    const detallesAdicionales = document.getElementById('detallesOrdenTienda')?.value.trim();

    try {
        const { collection, addDoc } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');
        const total = ordenTiendaActual.reduce((sum, item) => sum + item.precio * item.cantidad, 0);

        const orden = {
            nombre: nombreCliente,
            telefono: telefonoCliente,
            mesa: mesa || '',
            direccion: direccion || '',
            repartidor: repartidor || '',
            detallesAdicionales: detallesAdicionales || '',
            items: ordenTiendaActual,
            total,
            estado: 'pendiente',
            metodoPago: tipoPago,
            tipoPago,
            fecha: new Date(),
            tipo: 'tienda'
        };

        const docRef = await addDoc(collection(db, 'pedidos_tienda'), orden);
        const ordenGuardada = {
            ...orden,
            id: docRef.id,
            fecha: new Date()
        };

        setTimeout(() => {
            generarTicketTienda(ordenGuardada);
        }, 150);

        ordenTiendaActual = [];
        document.getElementById('nombreOrdenTienda').value = '';
        document.getElementById('telefonoOrdenTienda').value = '';
        document.getElementById('tipoPagoOrdenTienda').value = 'efectivo';
        document.getElementById('mesaOrdenTienda').value = '';
        document.getElementById('direccionOrdenTienda').value = '';
        document.getElementById('repartidorOrdenTienda').value = '';
        document.getElementById('detallesOrdenTienda').value = '';
        actualizarResumenOrdenTienda();
        await cargarDatos();
        mostrarOrdenesTienda();
        alert('✅ Orden registrada correctamente.');
    } catch (error) {
        console.error('Error guardando orden en tienda:', error);
        alert('❌ No se pudo guardar la orden: ' + error.message);
    }
}

function esDispositivoMovil() {
    const userAgent = navigator.userAgent || '';
    const touchCapable = navigator.maxTouchPoints > 0 || 'ontouchstart' in window || window.matchMedia('(pointer: coarse)').matches;
    return window.innerWidth <= 1024 || touchCapable || /Android|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(userAgent);
}

function cerrarPreviewTicket() {
    const modal = document.getElementById('modalTicketPreview');
    if (modal) {
        modal.classList.remove('show');
    }

    const previewBody = document.getElementById('ticketPreviewBody');
    if (previewBody) {
        previewBody.innerHTML = '';
    }
    const btnOpen = document.getElementById('btnOpenTicketTab');
    if (btnOpen) {
        btnOpen.style.display = 'none';
        btnOpen.onclick = null;
    }
    const btnPrint = document.getElementById('btnPrintTicketModal');
    if (btnPrint) {
        btnPrint.style.display = 'none';
        btnPrint.onclick = null;
    }

    // Also ensure visibility flags are reset
    try {
        if (btnOpen) { btnOpen.style.visibility = 'hidden'; btnOpen.disabled = true; }
        if (btnPrint) { btnPrint.style.visibility = 'hidden'; btnPrint.disabled = true; }
    } catch (e) {}
}

window.cerrarPreviewTicket = cerrarPreviewTicket;

function generarTicketTienda(orden, printWindow = null) {
    const fecha = new Date(orden.fecha?.toDate?.() || orden.fecha);
    const fechaTexto = isNaN(fecha.getTime()) ? 'Fecha no disponible' : fecha.toLocaleString('es-MX');
    const items = orden.items
        .map(item => `${item.cantidad}x ${item.nombre}   $${(item.precio * item.cantidad).toFixed(2)}`)
        .join('\n');

    const isMobile = esDispositivoMovil();
    const html = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8" />
          <title>Ticket - ${orden.nombre}</title>
          <style>
            @page { size: 58mm auto; margin: 0; }
            html, body { margin: 0; padding: 0; background: #fff; }
            body { width: 58mm; margin: 0 auto; font-family: 'Courier New', Courier, monospace; font-size: 16px; color: #000; line-height: 1.5; display: flex; justify-content: center; }
            .ticket { width: 100%; max-width: 56mm; padding: 10px 8px; box-sizing: border-box; margin: 0 auto; }
            .center { text-align: center; }
            .bold { font-weight: 700; }
            .small { font-size: 13px; }
            .item-row { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
            .item-name { flex: 1; white-space: normal; word-break: break-word; }
            .item-price { min-width: 56px; text-align: right; }
            .separator { border: 0; border-top: 1px dashed #000; margin: 8px 0; }
          </style>
        </head>
        <body>
          <div class="ticket">
            <div class="center bold" style="font-size: 16px; margin-bottom: 4px;">CAROLAS GREEN</div>
            <div class="center small" style="margin-bottom: 8px;">Orden en tienda</div>
            <hr class="separator">
            <div class="small">Cliente: ${orden.nombre}</div>
            ${orden.telefono ? `<div class="small">Teléfono: ${orden.telefono}</div>` : ''}
            ${orden.mesa ? `<div class="small">Mesa: ${orden.mesa}</div>` : ''}
            <div class="small">Fecha: ${fechaTexto}</div>
            <div class="small">Pago: ${orden.tipoPago === 'transferencia' ? 'Transferencia' : 'Efectivo'}</div>
            ${orden.direccion ? `<div class="small">Dirección: ${orden.direccion}</div>` : ''}
            ${orden.repartidor ? `<div class="small">Repartidor: ${orden.repartidor}</div>` : ''}
            ${orden.detallesAdicionales ? `<div class="small">Detalles: ${orden.detallesAdicionales}</div>` : ''}
            <hr class="separator">
            ${orden.items.map(item => `
              <div class="item-row">
                <div class="item-name">${item.cantidad} x ${item.nombre}</div>
                <div class="item-price">$${(item.precio * item.cantidad).toFixed(2)}</div>
              </div>
            `).join('')}
            <hr class="separator">
            <div class="item-row bold" style="margin-top: 4px;">
              <div>Total</div>
              <div>$${Number(orden.total || 0).toFixed(2)}</div>
            </div>
            <hr class="separator">
            <div class="center small" style="margin-top: 8px;">¡Gracias por su visita!</div>
            ${isMobile ? '' : '<div class="center"><button type="button" onclick="window.print();" style="padding:8px 10px; margin-top:8px; font-family:Courier New, monospace; font-size:13px;">Imprimir ticket</button></div>'}
          </div>
        </body>
        </html>`;

    // If the ticket preview modal exists, prefer showing it (user can open in new tab manually)
    const previewBody = document.getElementById('ticketPreviewBody');
    const modal = document.getElementById('modalTicketPreview');
    if (previewBody && modal) {
        // derive inner fragment (content inside <body>) so we inject only the ticket markup into the modal
        let fragment = html;
        try {
            fragment = html.replace(/^[\s\S]*<body[^>]*>/i, '').replace(/<\/body>[\s\S]*$/i, '').trim();
        } catch (e) {
            fragment = html;
        }

        previewBody.innerHTML = fragment;
        // wire "Abrir en pestaña" button
        try {
            const btnOpen = document.getElementById('btnOpenTicketTab');
            if (btnOpen) {
                btnOpen.style.display = '';
                btnOpen.onclick = () => {
                    const w = window.open('', '_blank');
                    if (!w) {
                        alert('Permite ventanas emergentes para abrir el ticket en una pestaña.');
                        return;
                    }
                    w.document.open();
                    w.document.write(html);
                    w.document.close();
                    w.focus();
                };
            }

            const btnPrint = document.getElementById('btnPrintTicketModal');
            if (btnPrint) {
                btnPrint.style.display = 'inline-flex';
                btnPrint.style.visibility = 'visible';
                btnPrint.disabled = false;
                btnPrint.onclick = () => {
                    try {
                        // Save full HTML to sessionStorage and navigate to print page in same tab
                        const KEY = 'carolas_print_ticket';
                        try { sessionStorage.setItem(KEY, html); } catch(e) { console.warn('sessionStorage set failed', e); }
                        // Navigate in same tab to printable page
                        window.location.href = 'printTicket.html';
                    } catch (err) {
                        console.warn('No se pudo iniciar impresión desde modal:', err);
                        alert('No se pudo iniciar la impresión desde el dispositivo. Intenta "Abrir en pestaña" y usar imprimir.');
                    }
                };
            }
        } catch (err) {
            console.warn('No se pudo configurar botones del modal:', err);
        }

        modal.classList.add('show');
        // ensure header buttons are visible after modal opens
        try {
            const bp = document.getElementById('btnPrintTicketModal');
            if (bp) { bp.style.display = 'inline-flex'; bp.style.visibility = 'visible'; bp.disabled = false; }
            const bo = document.getElementById('btnOpenTicketTab');
            if (bo) { bo.style.display = 'inline-flex'; bo.style.visibility = 'visible'; bo.disabled = false; }
        } catch (e) { /* ignore */ }
        return;
    }

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

    actualizarPermisosOrdenesTienda();
    const esAdmin = isAdminUser();

    container.innerHTML = '';

    if (!ordenesTienda.length) {
        container.innerHTML = '<p style="text-align: center; color: #798839;">No hay órdenes en tienda aún.</p>';
        return;
    }

    const ESTADOS = [
        { key: 'pendiente',   label: 'Pendiente' },
        { key: 'preparacion', label: 'En Preparación' },
        { key: 'listo',       label: 'Listo' },
        { key: 'completado',  label: 'Completado' }
    ];

    ordenesTienda.forEach(orden => {
        const fechaTicket = new Date(orden.fecha?.toDate?.() || orden.fecha);
        const fechaTexto = isNaN(fechaTicket.getTime()) ? 'Fecha no disponible' : fechaTicket.toLocaleString('es-MX');
        const itemsHtml = orden.items.map(item => `<div class="pedido-item"><span class="pedido-item-nombre">${item.nombre}</span><span class="pedido-item-cantidad">x${item.cantidad}</span><span class="pedido-item-precio">$${(item.precio * item.cantidad).toFixed(2)}</span></div>`).join('');

        const estadoActual = orden.estado || 'pendiente';
        const estadoLabel = ESTADOS.find(e => e.key === estadoActual)?.label || estadoActual;
        const idxActual = ESTADOS.findIndex(e => e.key === estadoActual);

        const flujoEstados = ESTADOS.map((est, idx) => {
            const isActivo = idx === idxActual;
            const isPasado = idx < idxActual;
            const cls = isActivo ? 'ot-estado-btn ot-estado-activo' : isPasado ? 'ot-estado-btn ot-estado-pasado' : 'ot-estado-btn ot-estado-futuro';
            return `<button type="button" class="${cls}" onclick="cambiarEstadoOrdenTienda('${orden.id}', '${est.key}')"${isActivo ? ' disabled' : ''}>${est.label}</button>`;
        }).join('<span class="ot-estado-arrow">›</span>');

        const card = document.createElement('div');
        card.className = `pedido-card ${estadoActual}`;
        card.innerHTML = `
            <div class="pedido-header">
                <div class="pedido-id">${orden.nombre}${orden.mesa ? ` · Mesa ${orden.mesa}` : ''}</div>
                <span class="pedido-estado ${estadoActual}">${estadoLabel}</span>
            </div>
            <div class="pedido-info">
                <div class="pedido-detail"><label>Fecha</label><p>${fechaTexto}</p></div>
                <div class="pedido-detail"><label>Teléfono</label><p>${orden.telefono || '-'}</p></div>
                <div class="pedido-detail"><label>Pago</label><p>${orden.tipoPago === 'transferencia' ? 'Transferencia' : 'Efectivo'}</p></div>
                <div class="pedido-detail"><label>Total</label><p style="color:#dbb42a;font-weight:bold;">$${Number(orden.total || 0).toFixed(2)}</p></div>
                ${orden.direccion ? `<div class="pedido-detail"><label>Direcci\u00f3n</label><p>${orden.direccion}</p></div>` : ''}
                ${orden.repartidor ? `<div class="pedido-detail"><label>Repartidor</label><p>${orden.repartidor}</p></div>` : ''}
                ${orden.detallesAdicionales ? `<div class="pedido-detail"><label>Detalles</label><p>${orden.detallesAdicionales}</p></div>` : ''}
            </div>
            <div class="pedido-items"><h4>Art\u00edculos:</h4>${itemsHtml}<div class="pedido-total">Total: $${Number(orden.total || 0).toFixed(2)}</div></div>
            <div class="ot-estado-flow">${flujoEstados}</div>
            <div class="pedido-actions">
                <button class="btn-secondary" type="button" onclick="imprimirTicketTienda('${orden.id}')"><i class="fas fa-print"></i> Ticket</button>
                <button class="btn-danger${esAdmin ? '' : ' disabled'}" type="button" ${esAdmin ? '' : 'disabled'} onclick="eliminarOrdenTienda('${orden.id}')">Eliminar</button>
            </div>`;
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

    setTimeout(() => {
        generarTicketTienda(ordenNormalizada);
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

async function cambiarEstadoOrdenTienda(ordenId, nuevoEstado) {
    try {
        const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');
        await updateDoc(doc(db, 'pedidos_tienda', ordenId), { estado: nuevoEstado });
        // El listener en tiempo real actualizará la UI automáticamente
    } catch (error) {
        alert('❌ Error al actualizar el estado: ' + error.message);
    }
}

async function eliminarOrdenTienda(ordenId) {
    if (!confirm('¿Eliminar esta orden? Esta acción no se puede deshacer.')) return;
    try {
        const { deleteDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');
        await deleteDoc(doc(db, 'pedidos_tienda', ordenId));
        // El listener en tiempo real actualizará la UI automáticamente
    } catch (error) {
        alert('❌ Error al eliminar la orden: ' + error.message);
    }
}

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
window.cambiarEstadoOrdenTienda = cambiarEstadoOrdenTienda;
window.eliminarOrdenTienda = eliminarOrdenTienda;

// Funciones de caja
window.verReporteCaja = verReporteCaja;
window.imprimirReporteCaja = imprimirReporteCaja;
window.mostrarModalCerrarCaja = mostrarModalCerrarCaja;

// Funciones de reporte de ventas
window.generarReporteVentas = generarReporteVentas;
window.imprimirReporteVentas = imprimirReporteVentas;

// ============================================
// REPORTE DE VENTAS (MÁS/MENOS VENDIDOS + FINANZAS)
// ============================================

function mostrarModalReporteVentas() {
    document.getElementById('modalReporteVentas').classList.add('show');
    generarReporteVentas('dia');
}

function generarReporteVentas(periodo) {
    // Actualizar tab activo
    const tabs = document.querySelectorAll('#modalReporteVentas .reporte-tab');
    const idxMap = { dia: 0, semana: 1, mes: 2 };
    tabs.forEach((t, i) => t.classList.toggle('active', i === idxMap[periodo]));

    const ahora = new Date();
    const inicio = new Date();

    if (periodo === 'dia') {
        inicio.setHours(0, 0, 0, 0);
    } else if (periodo === 'semana') {
        inicio.setDate(ahora.getDate() - 6);
        inicio.setHours(0, 0, 0, 0);
    } else { // mes
        inicio.setDate(1);
        inicio.setHours(0, 0, 0, 0);
    }

    const periodoLabel = { dia: 'Hoy (' + ahora.toLocaleDateString('es-MX') + ')', semana: 'Últimos 7 días', mes: 'Este mes (' + ahora.toLocaleString('es-MX', { month: 'long', year: 'numeric' }) + ')' }[periodo];

    // ---- Filtrar órdenes ----
    const ordenesFiltradas = ordenesTienda.filter(o => {
        const f = new Date(o.fecha?.toDate?.() || o.fecha);
        return f >= inicio && f <= ahora;
    });

    // ---- Filtrar cajas cerradas en el período ----
    const cajasFiltradas = cajas.filter(c => {
        if (c.estado !== 'cerrada' || !c.fechaCierre) return false;
        const f = new Date(c.fechaCierre?.toDate?.() || c.fechaCierre);
        return f >= inicio && f <= ahora;
    });

    // ---- Estadísticas financieras ----
    const totalIngresos = ordenesFiltradas.reduce((s, o) => s + Number(o.total || 0), 0);
    const totalOrdenes = ordenesFiltradas.length;
    const totalEgresos = cajasFiltradas.reduce((s, c) => s + Number(c.egresos || 0), 0);
    const totalTurnos = cajasFiltradas.length;
    const balance = totalIngresos - totalEgresos;

    // ---- Estadísticas de productos ----
    const mapaProductos = {};
    ordenesFiltradas.forEach(orden => {
        (orden.items || []).forEach(item => {
            const key = item.nombre;
            if (!mapaProductos[key]) mapaProductos[key] = { nombre: key, cantidad: 0, total: 0 };
            mapaProductos[key].cantidad += item.cantidad;
            mapaProductos[key].total += Number(item.precio || 0) * item.cantidad;
        });
    });

    const vendidos = Object.values(mapaProductos);
    const masVendidos = [...vendidos].sort((a, b) => b.cantidad - a.cantidad).slice(0, 10);

    // Productos con 0 ventas en el período se incluyen en "menos vendidos"
    const nombresConVentas = new Set(vendidos.map(p => p.nombre));
    const sinVentas = productos
        .filter(p => !nombresConVentas.has(p.nombre))
        .map(p => ({ nombre: p.nombre, cantidad: 0, total: 0 }));
    const menosVendidos = [...vendidos, ...sinVentas]
        .sort((a, b) => a.cantidad - b.cantidad)
        .slice(0, 10);

    // ---- Helpers HTML ----
    const filasProductos = (lista, isMas) => lista.length > 0
        ? lista.map((p, i) => `
            <tr>
                <td><span class="rv-rank${isMas && i < 3 ? ' rv-rank-' + (i + 1) : ''}">${i + 1}</span></td>
                <td>${p.nombre}</td>
                <td class="rv-center rv-bold">${p.cantidad}</td>
                <td class="rv-right ${isMas ? 'rv-green' : 'rv-muted'}">$${p.total.toFixed(2)}</td>
            </tr>`).join('')
        : '<tr><td colspan="4" class="rv-empty">Sin datos en este período</td></tr>';

    // ---- Renderizar ----
    document.getElementById('reporteVentasContenido').innerHTML = `
        <p class="rv-periodo-label"><i class="fas fa-calendar-alt"></i> ${periodoLabel}</p>

        <!-- Finanzas -->
        <div class="rv-section">
            <h3 class="rv-section-title"><i class="fas fa-coins"></i> Resumen Financiero</h3>
            <div class="rv-metricas">
                <div class="rv-metrica">
                    <label>Órdenes registradas</label>
                    <span class="rv-value">${totalOrdenes}</span>
                </div>
                <div class="rv-metrica">
                    <label>Turnos de caja cerrados</label>
                    <span class="rv-value">${totalTurnos}</span>
                </div>
                <div class="rv-metrica rv-ingreso">
                    <label>Ingresos (ventas)</label>
                    <span class="rv-value">$${totalIngresos.toFixed(2)}</span>
                </div>
                <div class="rv-metrica rv-egreso">
                    <label>Egresos (gastos/retiros)</label>
                    <span class="rv-value">$${totalEgresos.toFixed(2)}</span>
                </div>
                <div class="rv-metrica ${balance >= 0 ? 'rv-balance-pos' : 'rv-balance-neg'}">
                    <label>Balance neto</label>
                    <span class="rv-value">$${balance.toFixed(2)}</span>
                </div>
            </div>
        </div>

        <!-- Más vendidos -->
        <div class="rv-section">
            <h3 class="rv-section-title"><i class="fas fa-fire"></i> Productos Más Vendidos</h3>
            <div style="overflow-x:auto;">
                <table class="rv-tabla">
                    <thead>
                        <tr>
                            <th style="width:40px;">#</th>
                            <th>Producto</th>
                            <th class="rv-center">Cantidad vendida</th>
                            <th class="rv-right">Total recaudado</th>
                        </tr>
                    </thead>
                    <tbody>${filasProductos(masVendidos, true)}</tbody>
                </table>
            </div>
        </div>

        <!-- Menos vendidos -->
        <div class="rv-section">
            <h3 class="rv-section-title"><i class="fas fa-snowflake"></i> Productos Menos Vendidos</h3>
            <p style="font-size:0.8rem; color:#5f6368; margin-bottom:0.5rem;">Incluye productos sin ventas en el período.</p>
            <div style="overflow-x:auto;">
                <table class="rv-tabla">
                    <thead>
                        <tr>
                            <th style="width:40px;">#</th>
                            <th>Producto</th>
                            <th class="rv-center">Cantidad vendida</th>
                            <th class="rv-right">Total recaudado</th>
                        </tr>
                    </thead>
                    <tbody>${filasProductos(menosVendidos, false)}</tbody>
                </table>
            </div>
        </div>
    `;
}

function imprimirReporteVentas() {
    const periodoActivo = document.querySelector('#modalReporteVentas .reporte-tab.active')?.textContent?.trim() || 'Período';
    const contenidoEl = document.getElementById('reporteVentasContenido');
    if (!contenidoEl) return;

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Reporte de Ventas \u2014 ${periodoActivo}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; padding: 1.8cm 2.2cm; }
    @page { size: A4; margin: 1.8cm 2.2cm; }

    .header { border-bottom: 3px solid #4a6741; padding-bottom: 10px; margin-bottom: 14px; }
    .header h1 { font-size: 18px; color: #4a6741; }
    .header p { color: #666; font-size: 10px; margin-top: 3px; }

    .rv-periodo-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em;
                        color: #888; margin-bottom: 12px; }
    .rv-section { margin-bottom: 18px; }
    .rv-section-title { font-size: 10px; color: #4a6741; text-transform: uppercase;
                        letter-spacing: 0.04em; border-bottom: 1px solid #c8dab6;
                        padding-bottom: 3px; margin-bottom: 8px; }
    .rv-metricas { display: flex; flex-wrap: wrap; gap: 6px; }
    .rv-metrica { flex: 1; min-width: 110px; background: #f0f4e8; padding: 7px 9px; border-radius: 5px; }
    .rv-metrica.rv-ingreso { background: #e8f5e9; }
    .rv-metrica.rv-egreso  { background: #fdf0ed; }
    .rv-metrica.rv-balance-pos { background: #e8f4fd; }
    .rv-metrica.rv-balance-neg { background: #fdf0ed; }
    .rv-metrica label { display: block; font-size: 8px; text-transform: uppercase; color: #777; margin-bottom: 2px; }
    .rv-value { font-size: 14px; font-weight: 700; color: #4a6741; }
    .rv-metrica.rv-ingreso .rv-value { color: #27ae60; }
    .rv-metrica.rv-egreso .rv-value  { color: #c0392b; }
    .rv-metrica.rv-balance-pos .rv-value { color: #1a6fa0; }
    .rv-metrica.rv-balance-neg .rv-value { color: #c0392b; }

    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 4px; }
    thead th { background: #4a6741; color: #fff; padding: 5px 8px; text-align: left; font-size: 9px; }
    tbody td { padding: 5px 8px; border-bottom: 1px solid #eee; }
    tbody tr:last-child td { border-bottom: none; }
    tbody tr:nth-child(even) td { background: #f8faf5; }
    .rv-center { text-align: center; }
    .rv-right  { text-align: right; }
    .rv-bold   { font-weight: 700; }
    .rv-green  { color: #27ae60; font-weight: 600; }
    .rv-muted  { color: #999; }
    .rv-empty  { text-align: center; color: #aaa; font-style: italic; padding: 8px; }
    .rv-rank   { font-weight: 700; }
    .rv-rank-1 { color: #b8860b; }
    .rv-rank-2 { color: #555; }
    .rv-rank-3 { color: #8b4513; }
    .footer { margin-top: 20px; border-top: 1px solid #ddd; padding-top: 6px;
              font-size: 9px; color: #aaa; display: flex; justify-content: space-between; }
    p[style] { font-size: 10px !important; }
  </style>
</head>
<body>
  <div class="header">
    <h1>CAROLAS GREEN \u2014 Reporte de Ventas</h1>
    <p>Per\u00edodo: <strong>${periodoActivo}</strong> &nbsp;|&nbsp; Generado: ${new Date().toLocaleString('es-MX')}</p>
  </div>
  ${contenidoEl.innerHTML}
  <div class="footer">
    <span>CAROLAS GREEN \u2014 Sistema de Punto de Venta</span>
    <span>${new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
  </div>
  <script>window.onload = function() { window.print(); };<\/script>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=920,height=760');
    if (!win) { alert('Permite ventanas emergentes para imprimir el reporte.'); return; }
    win.document.open();
    win.document.write(html);
    win.document.close();
}

// ============================================
// CAJA (APERTURA / CIERRE / REPORTES)
// ============================================

function actualizarBotonCaja() {
    const btn = document.getElementById('btnAbrirCaja');
    const statusBar = document.getElementById('cajaStatusBar');
    if (!btn) return;

    if (cajaActualData) {
        btn.innerHTML = '<i class="fas fa-lock"></i> Cerrar Caja';
        btn.className = 'btn-danger';
        if (statusBar) {
            statusBar.innerHTML = `
                <div style="display:flex; align-items:center; gap:0.75rem; padding:0.75rem 1rem; background:#e8f5e9; border-radius:8px; border-left:4px solid #27ae60;">
                    <i class="fas fa-cash-register" style="color:#27ae60; font-size:1.2rem;"></i>
                    <div>
                        <strong style="color:#27ae60;">Caja Abierta</strong>
                        <span style="color:#5f6368; margin-left:0.75rem;">Cajero: ${cajaActualData.nombre} &nbsp;&middot;&nbsp; Apertura: ${cajaActualData.horaApertura} &nbsp;&middot;&nbsp; Dinero inicial: $${Number(cajaActualData.dineroInicial || 0).toFixed(2)}</span>
                    </div>
                </div>`;
            statusBar.style.display = 'block';
        }
    } else {
        btn.innerHTML = '<i class="fas fa-cash-register"></i> Abrir Caja';
        btn.className = 'btn-secondary';
        if (statusBar) {
            statusBar.style.display = 'none';
            statusBar.innerHTML = '';
        }
    }
}

function mostrarModalAbrirCaja() {
    if (cajaActualData) {
        mostrarModalCerrarCaja();
        return;
    }
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    document.getElementById('cajaFecha').value = `${yyyy}-${mm}-${dd}`;
    document.getElementById('cajaHoraApertura').value = now.toTimeString().slice(0, 5);
    document.getElementById('cajaNombre').value = '';
    document.getElementById('cajaDineroInicial').value = '';
    document.getElementById('cajaDetalles').value = '';
    document.getElementById('modalAbrirCaja').classList.add('show');
}

async function abrirCaja() {
    const nombre = document.getElementById('cajaNombre').value.trim();
    const fecha = document.getElementById('cajaFecha').value;
    const horaApertura = document.getElementById('cajaHoraApertura').value;
    const dineroInicial = parseFloat(document.getElementById('cajaDineroInicial').value);
    const detalles = document.getElementById('cajaDetalles').value.trim();

    if (!nombre || !fecha || !horaApertura || isNaN(dineroInicial) || dineroInicial < 0) {
        alert('Por favor completa los campos obligatorios: Nombre, Fecha, Hora y Dinero inicial.');
        return;
    }

    try {
        const { collection, addDoc } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');

        await addDoc(collection(db, 'cajas'), {
            nombre,
            fecha,
            horaApertura,
            dineroInicial,
            detalles: detalles || '',
            estado: 'abierta',
            fechaApertura: new Date(),
            fechaCierre: null,
            horaCierre: null,
            dineroFinal: null,
            egresos: 0,
            notasCierre: '',
            totalVentas: null,
            totalOrdenes: null,
            productosVendidos: {},
            ordenesIds: []
        });

        document.getElementById('modalAbrirCaja').classList.remove('show');
        await cargarDatosCajas();
        actualizarBotonCaja();
        mostrarHistorialCajas();
        alert('✅ Caja abierta correctamente.');
    } catch (error) {
        console.error('Error abriendo caja:', error);
        alert('❌ No se pudo abrir la caja: ' + error.message);
    }
}

function mostrarModalCerrarCaja() {
    if (!cajaActualData) {
        alert('No hay ninguna caja abierta actualmente.');
        return;
    }
    const now = new Date();
    document.getElementById('cajaHoraCierre').value = now.toTimeString().slice(0, 5);
    document.getElementById('cajaDineroFinal').value = '';
    document.getElementById('cajaEgresos').value = '0';
    document.getElementById('cajaNotasCierre').value = '';

    // Calcular total vendido desde la apertura de esta caja
    const fechaApertura = new Date(cajaActualData.fechaApertura?.toDate?.() || cajaActualData.fechaApertura);
    const ordenesPeriodo = ordenesTienda.filter(o => {
        const f = new Date(o.fecha?.toDate?.() || o.fecha);
        return f >= fechaApertura && f <= now;
    });
    const resumenCaja = calcularTotalesCaja(ordenesPeriodo);
    const totalVendido = resumenCaja.totalVentas;
    const totalEfectivo = resumenCaja.totalVentasEfectivo;
    const totalTransferencia = resumenCaja.totalVentasTransferencia;
    const cantidadOrdenes = resumenCaja.totalOrdenes;

    document.getElementById('infoCajaActual').innerHTML = `
        <div style="background:#f0f4e8; padding:0.75rem 1rem; border-radius:8px; margin-bottom:1rem; border-left:4px solid #798839;">
            <p style="margin:0.25rem 0;"><strong>Cajero:</strong> ${cajaActualData.nombre}</p>
            <p style="margin:0.25rem 0;"><strong>Fecha:</strong> ${cajaActualData.fecha}</p>
            <p style="margin:0.25rem 0;"><strong>Hora apertura:</strong> ${cajaActualData.horaApertura}</p>
            <p style="margin:0.25rem 0;"><strong>Dinero inicial:</strong> $${Number(cajaActualData.dineroInicial || 0).toFixed(2)}</p>
            <hr style="border:none; border-top:1px solid #c8dab6; margin:0.5rem 0;">
            <p style="margin:0.25rem 0;"><strong>Ventas en efectivo (caja física):</strong> <span style="color:#27ae60; font-weight:700; font-size:1.05rem;">$${totalEfectivo.toFixed(2)}</span></p>
            <p style="margin:0.25rem 0;"><strong>Ventas por transferencia (caja digital):</strong> <span style="color:#1a6fa0; font-weight:700; font-size:1.05rem;">$${totalTransferencia.toFixed(2)}</span></p>
            <p style="margin:0.25rem 0;"><strong>Total ventas del turno:</strong> $${totalVendido.toFixed(2)}</p>
            <p style="margin:0.25rem 0;"><strong>Órdenes del turno:</strong> ${cantidadOrdenes}</p>
        </div>
    `;

    document.getElementById('modalCerrarCaja').classList.add('show');
}

async function cerrarCaja() {
    if (!cajaActualData) return;

    const horaCierre = document.getElementById('cajaHoraCierre').value;
    const dineroFinal = parseFloat(document.getElementById('cajaDineroFinal').value);
    const egresos = parseFloat(document.getElementById('cajaEgresos').value) || 0;
    const notasCierre = document.getElementById('cajaNotasCierre').value.trim();

    if (!horaCierre || isNaN(dineroFinal) || dineroFinal < 0) {
        alert('Por favor completa la hora de cierre y el dinero final en caja.');
        return;
    }

    try {
        const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');

        const fechaApertura = new Date(cajaActualData.fechaApertura?.toDate?.() || cajaActualData.fechaApertura);
        const fechaCierre = new Date();

        // Compute totals from orders in this caja period
        const ordenesPeriodo = ordenesTienda.filter(o => {
            const fechaOrden = new Date(o.fecha?.toDate?.() || o.fecha);
            return fechaOrden >= fechaApertura && fechaOrden <= fechaCierre;
        });

        const resumenCaja = calcularTotalesCaja(ordenesPeriodo);
        const totalVentas = resumenCaja.totalVentas;
        const totalVentasEfectivo = resumenCaja.totalVentasEfectivo;
        const totalVentasTransferencia = resumenCaja.totalVentasTransferencia;
        const totalOrdenes = resumenCaja.totalOrdenes;
        const productosVendidos = resumenCaja.productosVendidos;

        await updateDoc(doc(db, 'cajas', cajaActualData.id), {
            estado: 'cerrada',
            fechaCierre,
            horaCierre,
            dineroFinal,
            egresos,
            notasCierre: notasCierre || '',
            totalVentas,
            totalVentasEfectivo,
            totalVentasTransferencia,
            totalOrdenes,
            productosVendidos,
            ordenesIds: ordenesPeriodo.map(o => o.id)
        });

        // Capturar todos los datos antes de que cargarDatosCajas() sobreescriba cajaActualData
        const cajaParaPDF = {
            nombre: cajaActualData.nombre,
            fecha: cajaActualData.fecha,
            horaApertura: cajaActualData.horaApertura,
            horaCierre,
            dineroInicial: Number(cajaActualData.dineroInicial || 0),
            dineroFinal,
            egresos,
            notasCierre: notasCierre || '',
            totalVentas,
            totalVentasEfectivo,
            totalVentasTransferencia,
            totalOrdenes,
            productosVendidos,
            ordenesPeriodo
        };

        document.getElementById('modalCerrarCaja').classList.remove('show');
        await cargarDatosCajas();
        actualizarBotonCaja();
        mostrarHistorialCajas();
        generarPDFCaja(cajaParaPDF);
    } catch (error) {
        console.error('Error cerrando caja:', error);
        alert('❌ No se pudo cerrar la caja: ' + error.message);
    }
}

async function cargarDatosCajas() {
    try {
        const { collection, getDocs, query, orderBy } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');
        const cajasSnap = await getDocs(query(collection(db, 'cajas'), orderBy('fechaApertura', 'desc')));
        cajas = [];
        cajasSnap.forEach(docSnap => {
            cajas.push({ id: docSnap.id, ...docSnap.data() });
        });
        cajaActualData = cajas.find(c => c.estado === 'abierta') || null;
    } catch (error) {
        console.error('Error cargando cajas:', error);
    }
}

function generarPDFCaja(info) {
    const {
        nombre, fecha, horaApertura, horaCierre,
        dineroInicial, dineroFinal, egresos, notasCierre,
        totalVentas, totalVentasEfectivo = 0, totalVentasTransferencia = 0,
        totalOrdenes, productosVendidos, ordenesPeriodo
    } = info;

    const ingresos = dineroInicial + Number(totalVentasEfectivo || 0);
    const ingresosDigitales = Number(totalVentasTransferencia || 0);
    const balance = ingresos - egresos;

    const productosOrdenados = Object.entries(productosVendidos || {})
        .map(([nom, data]) => ({ nom, ...data }))
        .sort((a, b) => b.total - a.total);

    const productosHTML = productosOrdenados.length > 0
        ? productosOrdenados.map(p => `
            <tr>
                <td>${p.nom}</td>
                <td class="center">${p.cantidad}</td>
                <td class="right">$${Number(p.precio || 0).toFixed(2)}</td>
                <td class="right bold green">$${Number(p.total || 0).toFixed(2)}</td>
            </tr>`).join('')
        : '<tr><td colspan="4" class="empty">Sin productos vendidos en este per\u00edodo</td></tr>';

    const ordenesHTML = (ordenesPeriodo || []).length > 0
        ? ordenesPeriodo.map(o => {
            const f = new Date(o.fecha?.toDate?.() || o.fecha);
            const fStr = isNaN(f.getTime()) ? '-' : f.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
            return `<tr>
                <td>${o.nombre}</td>
                <td>Mesa ${o.mesa}</td>
                <td class="center">${fStr}</td>
                <td class="right bold">$${Number(o.total || 0).toFixed(2)}</td>
            </tr>`;
        }).join('')
        : '<tr><td colspan="4" class="empty">Sin \u00f3rdenes en este per\u00edodo</td></tr>';

    const generado = new Date().toLocaleString('es-MX');

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Reporte de Caja \u2014 ${nombre} \u2014 ${fecha}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; background: #fff; padding: 2cm 2.5cm; }
    @page { size: A4; margin: 2cm 2.5cm; }

    .header { display: flex; justify-content: space-between; align-items: flex-start;
              border-bottom: 3px solid #4a6741; padding-bottom: 12px; margin-bottom: 16px; }
    .header-title h1 { font-size: 20px; color: #4a6741; }
    .header-title p { color: #666; font-size: 11px; margin-top: 4px; }
    .header-info { text-align: right; font-size: 11px; color: #555; }
    .header-info strong { display: block; font-size: 14px; color: #1a1a1a; margin-bottom: 2px; }

    .info-bar { display: flex; gap: 8px; background: #f0f4e8; padding: 10px 14px;
                border-radius: 6px; margin-bottom: 16px; }
    .info-item { flex: 1; }
    .info-item label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em;
                       color: #777; display: block; margin-bottom: 2px; }
    .info-item span { font-size: 12px; font-weight: 700; color: #2c3e1f; }

    h2 { font-size: 11px; color: #4a6741; border-bottom: 1px solid #c8dab6; padding-bottom: 4px;
         margin: 18px 0 8px; text-transform: uppercase; letter-spacing: 0.04em; }

    .fin-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 4px; }
    .fin-card { padding: 8px 10px; border-radius: 5px; background: #f0f4e8; }
    .fin-card.egreso { background: #fdf0ed; }
    .fin-card.balance { background: #e8f4fd; }
    .fin-card label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em;
                      color: #777; display: block; margin-bottom: 3px; }
    .fin-card span { font-size: 16px; font-weight: 700; color: #4a6741; }
    .fin-card.egreso span { color: #c0392b; }
    .fin-card.balance span { color: #1a6fa0; }

    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    thead th { background: #4a6741; color: #fff; padding: 6px 8px; text-align: left; font-size: 10px; }
    tbody td { padding: 5px 8px; border-bottom: 1px solid #e8e8e8; }
    tbody tr:last-child td { border-bottom: none; }
    tbody tr:nth-child(even) td { background: #f8faf5; }
    .center { text-align: center; }
    .right { text-align: right; }
    .bold { font-weight: 700; }
    .green { color: #27ae60; }
    .empty { text-align: center; color: #999; padding: 10px; font-style: italic; }

    .notes-box { background: #fafafa; border: 1px solid #e8e8e8; border-radius: 5px;
                 padding: 8px 10px; font-style: italic; color: #555; font-size: 11px; }

    .footer { margin-top: 24px; padding-top: 8px; border-top: 1px solid #ddd;
              display: flex; justify-content: space-between; color: #aaa; font-size: 9px; }
  </style>
</head>
<body>

  <div class="header">
    <div class="header-title">
      <h1>CAROLAS GREEN</h1>
      <p>Reporte de Caja &mdash; Cierre de turno</p>
    </div>
    <div class="header-info">
      <strong>${nombre}</strong>
      Cajero responsable
    </div>
  </div>

  <div class="info-bar">
    <div class="info-item"><label>Fecha</label><span>${fecha}</span></div>
    <div class="info-item"><label>Hora apertura</label><span>${horaApertura}</span></div>
    <div class="info-item"><label>Hora cierre</label><span>${horaCierre}</span></div>
    <div class="info-item"><label>\u00d3rdenes registradas</label><span>${totalOrdenes}</span></div>
  </div>

  <h2>Resumen Financiero</h2>
  <div class="fin-grid">
    <div class="fin-card"><label>Dinero Inicial</label><span>$${dineroInicial.toFixed(2)}</span></div>
    <div class="fin-card"><label>Total Ventas</label><span>$${totalVentas.toFixed(2)}</span></div>
    <div class="fin-card"><label>Ventas en Efectivo</label><span>$${Number(totalVentasEfectivo || 0).toFixed(2)}</span></div>
    <div class="fin-card"><label>Ventas por Transferencia</label><span>$${Number(totalVentasTransferencia || 0).toFixed(2)}</span></div>
    <div class="fin-card"><label>Ingresos Caja Física</label><span>$${ingresos.toFixed(2)}</span></div>
    <div class="fin-card"><label>Ingresos Digitales</label><span>$${ingresosDigitales.toFixed(2)}</span></div>
    <div class="fin-card egreso"><label>Egresos</label><span>$${egresos.toFixed(2)}</span></div>
    <div class="fin-card balance"><label>Dinero Final Real</label><span>$${dineroFinal.toFixed(2)}</span></div>
    <div class="fin-card balance"><label>Balance Caja Física</label><span>$${balance.toFixed(2)}</span></div>
  </div>

  <h2>Productos Vendidos</h2>
  <table>
    <thead>
      <tr>
        <th>Producto</th>
        <th class="center">Cantidad vendida</th>
        <th class="right">Precio unitario</th>
        <th class="right">Total recaudado</th>
      </tr>
    </thead>
    <tbody>${productosHTML}</tbody>
  </table>

  <h2>Detalle de \u00d3rdenes del Turno</h2>
  <table>
    <thead>
      <tr>
        <th>Cliente</th>
        <th>Mesa</th>
        <th class="center">Hora</th>
        <th class="right">Total</th>
      </tr>
    </thead>
    <tbody>${ordenesHTML}</tbody>
  </table>

  <h2>Notas de Cierre</h2>
  <div class="notes-box">${notasCierre || 'Sin notas registradas.'}</div>

  <div class="footer">
    <span>CAROLAS GREEN &mdash; Sistema de Punto de Venta</span>
    <span>Generado: ${generado}</span>
  </div>

  <script>window.onload = function() { window.print(); };<\/script>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=920,height=760');
    if (!win) {
        alert('\u2705 Caja cerrada correctamente.\n\nPermite ventanas emergentes en el navegador para ver el reporte PDF autom\u00e1ticamente.\nPuedes generar el reporte desde el Historial de Cajas.');
        return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
}

function mostrarHistorialCajas() {
    const container = document.getElementById('historialCajas');
    if (!container) return;

    container.innerHTML = '';

    if (!cajas.length) {
        container.innerHTML = '<p style="text-align:center; color:#798839; padding:1rem 0;">No hay cajas registradas aún.</p>';
        return;
    }

    cajas.forEach(caja => {
        const esAbierta = caja.estado === 'abierta';
        const card = document.createElement('div');
        card.className = `caja-card ${esAbierta ? 'caja-abierta' : 'caja-cerrada'}`;

        const metricasHTML = !esAbierta ? `
            <div class="caja-card-info">
                <div class="caja-stat"><label>Dinero Inicial</label><p>$${Number(caja.dineroInicial || 0).toFixed(2)}</p></div>
                <div class="caja-stat"><label>Ventas del turno</label><p class="caja-stat-ingreso">$${Number(caja.totalVentas || 0).toFixed(2)}</p></div>
                <div class="caja-stat"><label>Ventas efectivo</label><p>$${Number(caja.totalVentasEfectivo || 0).toFixed(2)}</p></div>
                <div class="caja-stat"><label>Ventas transferencia</label><p>$${Number(caja.totalVentasTransferencia || 0).toFixed(2)}</p></div>
                <div class="caja-stat"><label>Órdenes</label><p>${caja.totalOrdenes || 0}</p></div>
                <div class="caja-stat"><label>Egresos</label><p class="caja-stat-egreso">$${Number(caja.egresos || 0).toFixed(2)}</p></div>
                <div class="caja-stat"><label>Dinero Final</label><p class="caja-stat-balance">$${Number(caja.dineroFinal || 0).toFixed(2)}</p></div>
            </div>
            <button class="btn-secondary" type="button" onclick="verReporteCaja('${caja.id}')" style="margin-top:0.75rem;"><i class="fas fa-chart-bar"></i> Ver reporte detallado</button>
        ` : `
            <div class="caja-card-info">
                <div class="caja-stat"><label>Dinero Inicial</label><p>$${Number(caja.dineroInicial || 0).toFixed(2)}</p></div>
                ${caja.detalles ? `<div class="caja-stat"><label>Detalles</label><p>${caja.detalles}</p></div>` : ''}
            </div>
        `;

        card.innerHTML = `
            <div class="caja-card-header">
                <div>
                    <span class="caja-card-nombre"><i class="fas fa-cash-register"></i> ${caja.nombre}</span>
                    <span class="caja-card-fecha">${caja.fecha} &nbsp;&middot;&nbsp; Apertura: ${caja.horaApertura}${caja.horaCierre ? ` &nbsp;&middot;&nbsp; Cierre: ${caja.horaCierre}` : ''}</span>
                </div>
                <span class="caja-estado ${esAbierta ? 'caja-estado-abierta' : 'caja-estado-cerrada'}">${esAbierta ? 'Abierta' : 'Cerrada'}</span>
            </div>
            ${metricasHTML}
        `;
        container.appendChild(card);
    });
}

function verReporteCaja(cajaId) {
    const caja = cajas.find(c => c.id === cajaId);
    if (!caja) return;

    const fechaApertura = new Date(caja.fechaApertura?.toDate?.() || caja.fechaApertura);
    const fechaCierre = caja.fechaCierre ? new Date(caja.fechaCierre?.toDate?.() || caja.fechaCierre) : null;

    const ordenesCaja = ordenesTienda.filter(o => {
        const fechaOrden = new Date(o.fecha?.toDate?.() || o.fecha);
        return fechaOrden >= fechaApertura && (!fechaCierre || fechaOrden <= fechaCierre);
    });

    const productosVendidos = caja.productosVendidos || {};
    const totalVentas = Number(caja.totalVentas || 0);
    const totalVentasEfectivo = Number(caja.totalVentasEfectivo || 0);
    const totalVentasTransferencia = Number(caja.totalVentasTransferencia || 0);
    const dineroInicial = Number(caja.dineroInicial || 0);
    const egresos = Number(caja.egresos || 0);
    const dineroFinal = Number(caja.dineroFinal || 0);
    const ingresos = dineroInicial + totalVentasEfectivo;
    const ingresosDigitales = totalVentasTransferencia;

    const productosOrdenados = Object.entries(productosVendidos)
        .map(([nombre, data]) => ({ nombre, ...data }))
        .sort((a, b) => b.total - a.total);

    const productosHTML = productosOrdenados.length > 0
        ? productosOrdenados.map(p => `
            <tr>
                <td>${p.nombre}</td>
                <td style="text-align:center;">${p.cantidad}</td>
                <td style="text-align:right;">$${Number(p.precio || 0).toFixed(2)}</td>
                <td style="text-align:right; font-weight:600; color:#27ae60;">$${Number(p.total || 0).toFixed(2)}</td>
            </tr>
        `).join('')
        : '<tr><td colspan="4" style="text-align:center; color:#999; padding:1rem;">Sin productos vendidos en este período</td></tr>';

    const ordenesCajaHTML = ordenesCaja.length > 0
        ? ordenesCaja.map(o => {
            const f = new Date(o.fecha?.toDate?.() || o.fecha);
            const fStr = isNaN(f.getTime()) ? '-' : f.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
            return `<tr>
                <td>${o.nombre}</td>
                <td>Mesa ${o.mesa}</td>
                <td style="text-align:center;">${fStr}</td>
                <td style="text-align:right; font-weight:600;">$${Number(o.total || 0).toFixed(2)}</td>
            </tr>`;
        }).join('')
        : '<tr><td colspan="4" style="text-align:center; color:#999; padding:1rem;">Sin órdenes registradas en este período</td></tr>';

    document.getElementById('reporteCajaNombre').textContent = `${caja.nombre} · ${caja.fecha}`;
    document.getElementById('reporteCajaPeriodo').textContent = `${caja.horaApertura} → ${caja.horaCierre || 'En curso'}`;
    document.getElementById('reporteProductosTabla').innerHTML = productosHTML;
    document.getElementById('reporteOrdenesTabla').innerHTML = ordenesCajaHTML;
    document.getElementById('reporteDineroInicial').textContent = `$${dineroInicial.toFixed(2)}`;
    document.getElementById('reporteTotalVentas').textContent = `$${totalVentas.toFixed(2)}`;
    document.getElementById('reporteVentasEfectivo').textContent = `$${totalVentasEfectivo.toFixed(2)}`;
    document.getElementById('reporteVentasTransferencia').textContent = `$${totalVentasTransferencia.toFixed(2)}`;
    document.getElementById('reporteIngresosTotales').textContent = `$${ingresos.toFixed(2)}`;
    document.getElementById('reporteIngresosDigitales').textContent = `$${ingresosDigitales.toFixed(2)}`;
    document.getElementById('reporteEgresos').textContent = `$${egresos.toFixed(2)}`;
    document.getElementById('reporteDineroFinal').textContent = `$${dineroFinal.toFixed(2)}`;
    document.getElementById('reporteBalance').textContent = `$${(ingresos - egresos).toFixed(2)}`;
    document.getElementById('reporteTotalOrdenes').textContent = caja.totalOrdenes || ordenesCaja.length;
    document.getElementById('reporteNotasCierre').textContent = caja.notasCierre || 'Sin notas.';

    document.getElementById('modalReporteCaja').classList.add('show');
}

function imprimirReporteCaja() {
    const nombre = document.getElementById('reporteCajaNombre')?.textContent || '';
    const periodo = document.getElementById('reporteCajaPeriodo')?.textContent || '';
    const productosBody = document.getElementById('reporteProductosTabla')?.innerHTML || '';
    const ordenesBody = document.getElementById('reporteOrdenesTabla')?.innerHTML || '';
    const dineroInicial = document.getElementById('reporteDineroInicial')?.textContent || '$0.00';
    const totalVentas = document.getElementById('reporteTotalVentas')?.textContent || '$0.00';
    const ventasEfectivo = document.getElementById('reporteVentasEfectivo')?.textContent || '$0.00';
    const ventasTransferencia = document.getElementById('reporteVentasTransferencia')?.textContent || '$0.00';
    const ingresos = document.getElementById('reporteIngresosTotales')?.textContent || '$0.00';
    const ingresosDigitales = document.getElementById('reporteIngresosDigitales')?.textContent || '$0.00';
    const egresosVal = document.getElementById('reporteEgresos')?.textContent || '$0.00';
    const dineroFinal = document.getElementById('reporteDineroFinal')?.textContent || '$0.00';
    const balance = document.getElementById('reporteBalance')?.textContent || '$0.00';
    const totalOrdenes = document.getElementById('reporteTotalOrdenes')?.textContent || '0';
    const notas = document.getElementById('reporteNotasCierre')?.textContent || '';

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Reporte de Caja - ${nombre}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 13px; margin: 1.5cm; color: #222; }
    h1 { color: #4a6741; font-size: 1.4rem; margin-bottom: 0.25rem; }
    h2 { color: #4a6741; font-size: 1rem; margin: 1.2rem 0 0.4rem; border-bottom: 1px solid #ccc; padding-bottom: 0.25rem; }
    .periodo { color: #666; margin-bottom: 1rem; }
    .metricas { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem; }
    .metrica { flex: 1; min-width: 130px; padding: 0.6rem; border-radius: 6px; background: #f0f4e8; }
    .metrica label { display: block; font-size: 0.75rem; color: #666; text-transform: uppercase; }
    .metrica span { font-size: 1.1rem; font-weight: 700; color: #4a6741; }
    .metrica.egreso span { color: #c0392b; }
    .metrica.balance span { color: #2980b9; }
    table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; font-size: 0.88rem; }
    th { background: #4a6741; color: white; padding: 6px 8px; text-align: left; }
    td { padding: 5px 8px; border-bottom: 1px solid #eee; }
    tr:last-child td { border-bottom: none; }
    tr:nth-child(even) td { background: #fafafa; }
    .notas { background: #f9f9f9; padding: 0.75rem; border-radius: 6px; font-style: italic; color: #555; }
    .footer { text-align: right; color: #aaa; font-size: 0.78rem; margin-top: 1.5rem; }
  </style>
</head>
<body>
  <h1>Reporte de Caja &mdash; CAROLAS GREEN</h1>
  <p class="periodo"><strong>${nombre}</strong> &nbsp;|&nbsp; Período: ${periodo}</p>
  <h2>Resumen financiero</h2>
  <div class="metricas">
    <div class="metrica"><label>Dinero Inicial</label><span>${dineroInicial}</span></div>
    <div class="metrica"><label>Total Ventas</label><span>${totalVentas}</span></div>
    <div class="metrica"><label>Ventas Efectivo</label><span>${ventasEfectivo}</span></div>
    <div class="metrica"><label>Ventas Transferencia</label><span>${ventasTransferencia}</span></div>
    <div class="metrica"><label>Ingresos Caja Física</label><span>${ingresos}</span></div>
    <div class="metrica"><label>Ingresos Digitales</label><span>${ingresosDigitales}</span></div>
    <div class="metrica egreso"><label>Egresos</label><span>${egresosVal}</span></div>
    <div class="metrica balance"><label>Dinero Final Real</label><span>${dineroFinal}</span></div>
    <div class="metrica balance"><label>Balance</label><span>${balance}</span></div>
  </div>
  <p><strong>Total de órdenes:</strong> ${totalOrdenes}</p>
  <h2>Productos vendidos</h2>
  <table>
    <thead><tr><th>Producto</th><th style="text-align:center;">Cantidad</th><th style="text-align:right;">Precio unit.</th><th style="text-align:right;">Total</th></tr></thead>
    <tbody>${productosBody}</tbody>
  </table>
  <h2>Órdenes del período</h2>
  <table>
    <thead><tr><th>Cliente</th><th>Mesa</th><th style="text-align:center;">Hora</th><th style="text-align:right;">Total</th></tr></thead>
    <tbody>${ordenesBody}</tbody>
  </table>
  <h2>Notas de cierre</h2>
  <div class="notas">${notas}</div>
  <p class="footer">Generado el ${new Date().toLocaleString('es-MX')}</p>
  <script>window.onload = function() { window.print(); };<\/script>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=820,height=700');
    if (!win) { alert('Permite ventanas emergentes para imprimir el reporte.'); return; }
    win.document.open();
    win.document.write(html);
    win.document.close();
}