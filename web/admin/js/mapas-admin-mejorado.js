// ============================================
// MAPAS ADMIN - REPARTIDOR EN TIEMPO REAL
// ============================================

let mapaInstanciaAdmin = null;
let watchPositionId = null;
let marcadorAdminAdmin = null;
let marcadorClienteAdmin = null;
let polylineAdminAdmin = null;

// Para el admin (repartidor): mostrar su ubicación + ubicación del cliente
window.mostrarMapaAdminMejorado = function(pedidoId, direccionCliente, nombreCliente, lat = null, lng = null) {
    const modal = document.getElementById('mapaAdminModal');
    const mapContainer = document.getElementById('mapAdminContainer');
    const mapaInfo = document.getElementById('mapaAdminInfo');
    
    // Destruir mapa anterior
    if (mapaInstanciaAdmin) {
        try {
            // Detener watchPosition
            if (watchPositionId !== null) {
                navigator.geolocation.clearWatch(watchPositionId);
                watchPositionId = null;
            }
            mapaInstanciaAdmin.off();
            mapaInstanciaAdmin.remove();
            mapaInstanciaAdmin = null;
            marcadorAdminAdmin = null;
            marcadorClienteAdmin = null;
            polylineAdminAdmin = null;
        } catch (e) {
            console.warn('Error removiendo mapa:', e);
        }
    }
    
    mapContainer.innerHTML = '';
    modal.classList.add('show');
    
    mapaInfo.innerHTML = `
        <p style="color: #2980b9; font-weight: bold;">🗺️ Permiso de Ubicación Requerido</p>
        <p>Para mostrar el mapa con tu ubicación como repartidor:</p>
        <ul style="margin: 0.5rem 0; padding-left: 1.5rem; font-size: 0.95rem;">
            <li>✅ Habilita el GPS en tu dispositivo</li>
            <li>✅ Permite acceso a la ubicación cuando aparezca el prompt</li>
            <li>✅ Espera mientras se obtiene tu ubicación (puede tomar unos segundos)</li>
        </ul>
        <p style="color: #666; font-size: 0.9rem; margin-top: 1rem;">⏳ Cargando mapa...</p>
    `;
    
    // Convertir coordenadas cliente
    const clientLat = lat !== null ? parseFloat(lat) : null;
    const clientLng = lng !== null ? parseFloat(lng) : null;
    
    // Verificar si hay coordenadas del cliente
    if (clientLat === null || clientLng === null) {
        mapaInfo.innerHTML = `
            <p style="color: #e74c3c;">⚠️ Coordenadas GPS del cliente no disponibles</p>
            <p>El cliente no proporcionó su ubicación GPS.</p>
        `;
        console.warn('Admin: GPS cliente no disponible');
        return;
    }
    
    setTimeout(() => {
        try {
            // Obtener ubicación del admin CON ALTA PRECISIÓN
            if (navigator.geolocation) {
                const opcionesGeoloc = {
                    enableHighAccuracy: true,  // Solicitar GPS con máxima precisión
                    timeout: 10000,             // Esperar 10 segundos máximo
                    maximumAge: 0               // No usar datos en caché
                };
                
                // Primero obtener la ubicación inicial
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        crearMapaAdmin(position, clientLat, clientLng, pedidoId, direccionCliente, nombreCliente, mapContainer, mapaInfo);
                    },
                    (error) => {
                        console.warn('Error obteniendo ubicación inicial:', error);
                        mostrarFallback(clientLat, clientLng, direccionCliente, nombreCliente, mapContainer, mapaInfo);
                    },
                    opcionesGeoloc
                );
                
                // Luego, usar watchPosition para actualizaciones continuas
                watchPositionId = navigator.geolocation.watchPosition(
                    (position) => {
                        // Actualizar marcador si el mapa existe
                        if (mapaInstanciaAdmin && marcadorAdminAdmin) {
                            const newLat = position.coords.latitude;
                            const newLng = position.coords.longitude;
                            const accuracy = position.coords.accuracy;
                            
                            console.log('📍 Posición actualizada:', newLat, newLng, 'Precisión:', accuracy, 'm');
                            
                            const posAnterior = marcadorAdminAdmin.getLatLng();
                            
                            // Solo actualizar si cambió la posición (más de 5 metros)
                            const distMovimiento = Math.sqrt(Math.pow(newLat - posAnterior.lat, 2) + Math.pow(newLng - posAnterior.lng, 2)) * 111000;
                            
                            if (distMovimiento > 5) { // 5 metros de tolerancia
                                marcadorAdminAdmin.setLatLng([newLat, newLng]);
                                
                                // Actualizar polyline
                                if (polylineAdminAdmin) {
                                    polylineAdminAdmin.setLatLngs([[newLat, newLng], [clientLat, clientLng]]);
                                }
                                
                                // Actualizar distancia
                                const distance = haversineDistance(newLat, newLng, clientLat, clientLng);
                                
                                const mapaInfoHtml = `
                                    <p><strong style="color: #3498db;">MI UBICACION (ADMIN/REPARTIDOR)</strong></p>
                                    <p>Coordenadas: ${newLat.toFixed(4)}, ${newLng.toFixed(4)}</p>
                                    <p style="font-size: 0.85rem; color: #666;">Precisión: ${accuracy.toFixed(0)}m</p>
                                    <hr>
                                    <p><strong style="color: #e74c3c;">UBICACION DEL CLIENTE</strong></p>
                                    <p>${nombreCliente}</p>
                                    <p>Direccion: ${direccionCliente}</p>
                                    <p>Coordenadas: ${clientLat.toFixed(4)}, ${clientLng.toFixed(4)}</p>
                                    <p><strong style="color: #27ae60;">Distancia: ${distance.toFixed(2)} km</strong></p>
                                    <p style="font-size: 0.9rem; color: #666; margin-top: 1rem;">🔵 Azul=Mi ubicacion | 🔴 Rojo=Cliente</p>
                                `;
                                document.getElementById('mapaAdminInfo').innerHTML = mapaInfoHtml;
                            }
                        }
                    },
                    (error) => {
                        console.warn('Error en watchPosition:', error);
                    },
                    opcionesGeoloc
                );
            } else {
                mostrarFallback(clientLat, clientLng, direccionCliente, nombreCliente, mapContainer, mapaInfo);
            }
        } catch (error) {
            console.error('Error mapa admin:', error);
            mapaInfo.innerHTML = `<p style="color: #e74c3c;">❌ Error al crear el mapa</p>`;
        }
    }, 300);
};

// Función para crear el mapa
function crearMapaAdmin(position, clientLat, clientLng, pedidoId, direccionCliente, nombreCliente, mapContainer, mapaInfo) {
    const adminLat = position.coords.latitude;
    const adminLng = position.coords.longitude;
    const accuracy = position.coords.accuracy;
    
    console.log('Admin ubicacion:', adminLat, adminLng);
    console.log('Precisión (metros):', accuracy);
    console.log('Cliente ubicacion:', clientLat, clientLng);
    
    // CREAR MAPA CENTRADO EN ADMIN CON ZOOM MÁS ALTO PARA PRECISIÓN
    const mapa = L.map('mapAdminContainer', {
        preferCanvas: true
    }).setView([adminLat, adminLng], 16);
    
    mapaInstanciaAdmin = mapa;
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(mapa);
    
    mapa.invalidateSize(false);
    
    const marcadores = [];
    
    // MARCADOR AZUL - Tu ubicacion (admin/repartidor)
    marcadorAdminAdmin = L.marker([adminLat, adminLng], {
        icon: L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        })
    }).addTo(mapa).bindPopup('Mi ubicacion (Admin/Repartidor)');
    marcadores.push(marcadorAdminAdmin);
    
    // MARCADOR ROJO - Cliente
    marcadorClienteAdmin = L.marker([clientLat, clientLng], {
        icon: L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        })
    }).addTo(mapa).bindPopup(`${nombreCliente}<br>${direccionCliente}`);
    marcadores.push(marcadorClienteAdmin);
    
    // Linea conectando
    polylineAdminAdmin = L.polyline([[adminLat, adminLng], [clientLat, clientLng]], {
        color: '#dbb42a',
        weight: 3,
        opacity: 0.8
    }).addTo(mapa);
    
    const distance = haversineDistance(adminLat, adminLng, clientLat, clientLng);
    
    // Enfocar en ambos puntos
    const group = new L.featureGroup(marcadores);
    try {
        mapa.fitBounds(group.getBounds().pad(0.15), { maxZoom: 15, animate: true });
    } catch (e) {
        console.error('Error fitBounds:', e);
        mapa.setView([adminLat, adminLng], 13);
    }
    
    mapaInfo.innerHTML = `
        <p><strong style="color: #3498db;">MI UBICACION (ADMIN/REPARTIDOR)</strong></p>
        <p>Coordenadas: ${adminLat.toFixed(4)}, ${adminLng.toFixed(4)}</p>
        <p style="font-size: 0.85rem; color: #666;">Precisión: ${accuracy.toFixed(0)}m</p>
        <hr>
        <p><strong style="color: #e74c3c;">UBICACION DEL CLIENTE</strong></p>
        <p>${nombreCliente}</p>
        <p>Direccion: ${direccionCliente}</p>
        <p>Coordenadas: ${clientLat.toFixed(4)}, ${clientLng.toFixed(4)}</p>
        <p><strong style="color: #27ae60;">Distancia: ${distance.toFixed(2)} km</strong></p>
        <p style="font-size: 0.9rem; color: #666; margin-top: 1rem;">🔵 Azul=Mi ubicacion | 🔴 Rojo=Cliente</p>
    `;
}

// Función para mostrar fallback
function mostrarFallback(clientLat, clientLng, direccionCliente, nombreCliente, mapContainer, mapaInfo) {
    const mapa = L.map('mapAdminContainer', {
        preferCanvas: true
    }).setView([clientLat, clientLng], 16);
    
    mapaInstanciaAdmin = mapa;
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(mapa);
    
    mapa.invalidateSize(false);
    
    marcadorClienteAdmin = L.marker([clientLat, clientLng], {
        icon: L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        })
    }).addTo(mapa).bindPopup(`${nombreCliente}<br>${direccionCliente}`);
    
    mapaInfo.innerHTML = `
        <p><strong style="color: #e74c3c;">UBICACION DEL CLIENTE</strong></p>
        <p>${nombreCliente}</p>
        <p>Direccion: ${direccionCliente}</p>
        <p>Coordenadas: ${clientLat.toFixed(4)}, ${clientLng.toFixed(4)}</p>
        <p style="color: #e74c3c; font-size: 0.9rem; margin-top: 1rem;">⚠️ No se pudo obtener tu ubicación GPS</p>
        <p style="color: #666; font-size: 0.85rem;">Habilita GPS y reinicia para ver tu ubicación</p>
    `;
}

function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

window.mostrarMapaAdmin = window.mostrarMapaAdminMejorado;
