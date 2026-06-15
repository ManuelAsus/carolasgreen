// Admin Dashboard - Carolas Green

// Variables globales
let usuarioActual = null;
let productos = [];
let pedidos = [];
let comentarios = [];
let menus = [];
let galeria = [];
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
        
        // Configurar escala
        const scale = 2; // 2x para mejor calidad
        
        // Obtener dimensiones de la primera página para conocer el ancho
        const firstPage = await pdf.getPage(1);
        const viewport = firstPage.getViewport({ scale });
        
        // Crear canvas grande que contendrá todas las páginas apiladas
        const totalCanvas = document.createElement('canvas');
        totalCanvas.width = viewport.width;
        totalCanvas.height = viewport.height * totalPages;
        
        const totalContext = totalCanvas.getContext('2d');
        totalContext.fillStyle = 'white';
        totalContext.fillRect(0, 0, totalCanvas.width, totalCanvas.height);
        
        // Renderizar cada página
        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const pageViewport = page.getViewport({ scale });
            
            // Crear canvas para la página individual
            const pageCanvas = document.createElement('canvas');
            pageCanvas.width = pageViewport.width;
            pageCanvas.height = pageViewport.height;
            
            const pageContext = pageCanvas.getContext('2d');
            
            // Renderizar la página
            await page.render({
                canvasContext: pageContext,
                viewport: pageViewport
            }).promise;
            
            // Dibujar en el canvas total
            const yOffset = (pageNum - 1) * pageViewport.height;
            totalContext.drawImage(pageCanvas, 0, yOffset);
        }
        
        // Convertir a Base64
        return totalCanvas.toDataURL('image/jpeg', 0.85);
    } catch (error) {
        console.error('Error al convertir PDF a imagen:', error);
        throw new Error('No se pudo convertir el PDF a imagen: ' + error.message);
    }
}

// ============================================
async function inicializarFirebase() {
    try {
        // Importar módulos dinámicamente
        const firebaseModule = await import('../../js/firebase-config.js');
        db = firebaseModule.db;
        auth = firebaseModule.auth;
        storage = firebaseModule.storage;

        // Verificar autenticación
        const { onAuthStateChanged, signOut } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js');
        
        onAuthStateChanged(auth, (user) => {
            if (user) {
                usuarioActual = user;
                document.getElementById('adminUserEmail').textContent = user.email;
                cargarDatos();
            } else {
                // Redirigir a login
                window.location.href = 'login.html';
            }
        });

        // Botón logout
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

// Iniciar cuando DOM está listo
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
        
        // Cargar productos
        const productosSnap = await getDocs(collection(db, 'productos'));
        productos = [];
        productosSnap.forEach(doc => {
            productos.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Cargar pedidos
        const pedidosSnap = await getDocs(query(collection(db, 'pedidos'), orderBy('fecha', 'desc')));
        pedidos = [];
        pedidosSnap.forEach(doc => {
            pedidos.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Cargar comentarios
        const comentariosSnap = await getDocs(collection(db, 'comentarios'));
        comentarios = [];
        comentariosSnap.forEach(doc => {
            comentarios.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Cargar menús
        const menusSnap = await getDocs(collection(db, 'menus'));
        menus = [];
        menusSnap.forEach(doc => {
            menus.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Cargar galería
        const galeriaSnap = await getDocs(collection(db, 'galeria'));
        galeria = [];
        galeriaSnap.forEach(doc => {
            galeria.push({
                id: doc.id,
                ...doc.data()
            });
        });

        document.getElementById('loadingMessage').style.display = 'none';
        actualizarDashboard();
        console.log('Datos cargados correctamente');
        
        // Iniciar listener en tiempo real para pedidos
        iniciarListenerPedidosAdmin();
    } catch (error) {
        console.error('Error al cargar datos:', error);
        mostrarError('Error al cargar datos: ' + error.message);
    }
}

// ============================================
// LISTENER EN TIEMPO REAL - ADMIN PANEL
// ============================================

let unsubscribePedidosAdmin = null;

async function iniciarListenerPedidosAdmin() {
    try {
        console.log('🔄 Iniciando listener de pedidos en tiempo real (ADMIN)...');
        
        const { collection, query, orderBy, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');
        
        // Cancelar listeners anteriores si existen
        if (unsubscribePedidosAdmin) {
            console.log('🛑 Deteniendo listener anterior');
            unsubscribePedidosAdmin();
        }
        
        // Crear consulta que escucha en tiempo real
        const q = query(collection(db, 'pedidos'), orderBy('fecha', 'desc'));
        
        unsubscribePedidosAdmin = onSnapshot(q, (snapshot) => {
            console.log('🔔 Cambios detectados en pedidos (ADMIN). Actualizando...');
            
            pedidos = [];
            snapshot.forEach(doc => {
                pedidos.push({
                    id: doc.id,
                    ...doc.data()
                });
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

    // Validador de tamaño para PDF de menú
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

    // Cargar previsualizaciones
    cargarPreviewsConfiguracion();

    // Filtros de pedidos
    document.getElementById('buscarPedido').addEventListener('input', mostrarPedidos);
    document.getElementById('filtroEstado').addEventListener('change', mostrarPedidos);
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
            : '';
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
        
        // Si cambió a "en camino", ofrecer compartir ubicación
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

    // Actualizar ubicación inmediatamente
    await actualizarUbicacionRepartidor(pedidoId);

    // Luego cada 5 segundos
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
    
    // Destruir mapa anterior si existe
    if (mapaInstanciaAdmin) {
        try {
            mapaInstanciaAdmin.off();
            mapaInstanciaAdmin.remove();
            mapaInstanciaAdmin = null;
        } catch (e) {
            console.warn('Error removiendo mapa anterior:', e);
        }
    }
    
    // Limpiar contenedor
    mapContainer.innerHTML = '';
    
    // Mostrar modal PRIMERO para que el contenedor tenga dimensiones
    modal.classList.add('show');
    
    mapaInfo.innerHTML = `<p>📍 <strong>Cliente:</strong> ${nombreCliente}</p><p>📮 <strong>Dirección:</strong> ${direccionCliente}</p><p>⏳ Cargando ubicación...</p>`;
    
    // Dar tiempo a que el modal aparezca y el contenedor tenga dimensiones
    setTimeout(() => {
        try {
            // Crear mapa
            const mapa = L.map('mapAdminContainer', {
                preferCanvas: true
            }).setView([18.4241, -69.9267], 13);
            
            mapaInstanciaAdmin = mapa;
            
            // Agregar tiles de OpenStreetMap
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '© OpenStreetMap contributors'
            }).addTo(mapa);
            
            // Forzar que Leaflet recalcule el tamaño del mapa
            mapa.invalidateSize(false);
    
    // Obtener ubicación del repartidor (admin) 
    const pedidoData = pedidos.find(p => p.id === pedidoId);
    const repartidorUbicacion = pedidoData?.repartidorUbicacion || null;
    
    // Si tenemos coordenadas directas, usarlas
    if (lat !== null && lng !== null) {
        console.log('?? Usando coordenadas directas:', lat, lng);
        
        // Grupo de capas para fitBounds
        const group = new L.FeatureGroup();
        
        // Marcar ubicaci�n del cliente
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
            <p>?? <strong>Cliente:</strong> ${nombreCliente}</p>
            <p>?? <strong>Direcci�n:</strong> ${direccionCliente}</p>
            <p>?? <strong>Coordenadas GPS:</strong> ${lat.toFixed(4)}, ${lng.toFixed(4)}</p>
            <p style="font-size: 0.9rem; color: #666; margin-top: 0.5rem;">?? Ubicaci�n del cliente (en tiempo real)</p>
        `;
        
        // Si el repartidor tiene ubicaci�n, mostrarla
        if (repartidorUbicacion && repartidorUbicacion.lat && repartidorUbicacion.lng) {
            console.log('?? Ubicaci�n del repartidor:', repartidorUbicacion);
            
            const repLat = repartidorUbicacion.lat;
            const repLng = repartidorUbicacion.lng;
            
            // Marcador verde del repartidor
            const markerRepartidor = L.marker([repLat, repLng], {
                icon: L.icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowSize: [41, 41]
                })
            }).bindPopup(`<strong>?? Repartidor</strong><br>En camino`);
            
            group.addLayer(markerRepartidor);
            markerRepartidor.addTo(mapa);
            
            // Dibujar l�nea entre cliente y repartidor
            const polyline = L.polyline([[lat, lng], [repLat, repLng]], {
                color: '#0066ff',
                weight: 3,
                opacity: 0.7,
                dashArray: '5, 5'
            }).addTo(mapa);
            
            group.addLayer(polyline);
            
            // Calcular distancia usando f�rmula Haversine
            const R = 6371; // Radio de la Tierra en km
            const dLat = (repLat - lat) * Math.PI / 180;
            const dLng = (repLng - lng) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                      Math.cos(lat * Math.PI / 180) * Math.cos(repLat * Math.PI / 180) *
                      Math.sin(dLng/2) * Math.sin(dLng/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            const distancia = (R * c).toFixed(2);
            
            // Timestamp del repartidor
            const timestamp = repartidorUbicacion.timestamp ? 
                new Date(repartidorUbicacion.timestamp).toLocaleString() : 'Sin actualizar';
            
            infoText += `
                <hr style="margin: 0.5rem 0;">
                <p>?? <strong>Repartidor:</strong> En camino</p>
                <p>?? <strong>Coordenadas:</strong> ${repLat.toFixed(4)}, ${repLng.toFixed(4)}</p>
                <p>?? <strong>Distancia:</strong> ${distancia} km</p>
                <p style="font-size: 0.85rem; color: #666;">? Actualizado: ${timestamp}</p>
                <p style="font-size: 0.9rem; color: #666; margin-top: 0.5rem;">?? Ubicaci�n del repartidor (en tiempo real)</p>
            `;
            
            // Ajustar vista para mostrar ambos puntos
            try {
                mapa.fitBounds(group.getBounds().pad(0.15), {maxZoom: 15, animate: true});
            } catch (e) {
                console.warn('Error en fitBounds:', e);
                mapa.setView([lat, lng], 13);
            }
        } else {
            // Solo mostrar ubicaci�n del cliente
            mapa.setView([lat, lng], 15);
        }
        
        mapaInfo.innerHTML = infoText;
    } else {
        // Si no tenemos coordenadas GPS, mostrar ubicación por defecto (tienda)
        console.log('⚠️ Sin coordenadas GPS - mostrando ubicación por defecto');
        
        const destLat = 18.4241;  // Ubicación por defecto
        const destLng = -69.9267;
        const data = [{lat: destLat, lon: destLng}];
        
        // Simular estructura fetch para mantener consistencia
        Promise.resolve(data)
            .then(data => {
                if (data.length > 0) {
                    const destLatResult = parseFloat(data[0].lat);
                    const destLngResult = parseFloat(data[0].lon);
                    
                    // Grupo de capas para fitBounds
                    const group = new L.FeatureGroup();
                    
                    // Marcar ubicación del cliente
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
                    
                    // Si el repartidor tiene ubicación, mostrarla
                    if (repartidorUbicacion && repartidorUbicacion.lat && repartidorUbicacion.lng) {
                        console.log('🚗 Ubicación del repartidor:', repartidorUbicacion);
                        
                        const repLat = repartidorUbicacion.lat;
                        const repLng = repartidorUbicacion.lng;
                        
                        // Marcador verde del repartidor
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
                        
                        // Dibujar línea entre cliente y repartidor
                        const polyline = L.polyline([[destLatResult, destLngResult], [repLat, repLng]], {
                            color: '#0066ff',
                            weight: 3,
                            opacity: 0.7,
                            dashArray: '5, 5'
                        }).addTo(mapa);
                        
                        group.addLayer(polyline);
                        
                        // Calcular distancia usando fórmula Haversine
                        const R = 6371; // Radio de la Tierra en km
                        const dLat = (repLat - destLatResult) * Math.PI / 180;
                        const dLng = (repLng - destLngResult) * Math.PI / 180;
                        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                                  Math.cos(destLatResult * Math.PI / 180) * Math.cos(repLat * Math.PI / 180) *
                                  Math.sin(dLng/2) * Math.sin(dLng/2);
                        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                        const distancia = (R * c).toFixed(2);
                        
                        // Timestamp del repartidor
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
                        
                        // Ajustar vista para mostrar ambos puntos
                        try {
                            mapa.fitBounds(group.getBounds().pad(0.15), {maxZoom: 15, animate: true});
                        } catch (e) {
                            console.warn('Error en fitBounds:', e);
                            mapa.setView([destLatResult, destLngResult], 13);
                        }
                    } else {
                        // Solo mostrar ubicación del cliente
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
                // Validar tamaño (máximo 20 MB antes de conversión)
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
        // Verificar que db esté inicializado
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

// Hacer funciones globales
window.cambiarSeccion = cambiarSeccion;
window.editarProducto = editarProducto;
window.eliminarProducto = eliminarProducto;
window.cambiarEstadoPedido = cambiarEstadoPedido;
window.eliminarPedido = eliminarPedido;
window.mostrarMapaAdmin = mostrarMapaAdmin;
window.cerrarMapaAdmin = cerrarMapaAdmin;
window.detenerCompartirUbicacion = detenerCompartirUbicacion;
window.iniciarCompartirUbicacionRepartidor = iniciarCompartirUbicacionRepartidor;
window.aprobarComentario = aprobarComentario;
window.eliminarComentario = eliminarComentario;
window.eliminarMenu = eliminarMenu;
window.eliminarImagenGaleria = eliminarImagenGaleria;

