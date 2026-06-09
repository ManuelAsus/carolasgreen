// ============================================
// MAPAS MEJORADOS PARA ADMIN - INCLUYE REPARTIDOR
// ============================================

let mapaInstanciaAdmin = null;

// Para el admin (repartidor): mostrar su ubicación + ubicación del cliente
window.mostrarMapaAdminMejorado = function(pedidoId, direccionCliente, nombreCliente, lat = null, lng = null) {
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
            
            // Obtener ubicación del repartidor (admin) - buscar en el array global pedidos
            let repartidorUbicacion = null;
            if (window.pedidos && Array.isArray(window.pedidos)) {
                const pedidoData = window.pedidos.find(p => p.id === pedidoId);
                repartidorUbicacion = pedidoData?.repartidorUbicacion || null;
            }
            
            // Si tenemos coordenadas directas del cliente, usarlas
    if (lat !== null && lng !== null) {
        console.log('📍 Usando coordenadas directas del cliente:', lat, lng);
        
        // Marcar ubicación del cliente
        L.marker([lat, lng], {
            icon: L.icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            })
        }).addTo(mapa).bindPopup(`<strong>🔴 ${nombreCliente}</strong><br>${direccionCliente}`);
        
        // Si existe ubicación del repartidor, mostrarla
        if (repartidorUbicacion && repartidorUbicacion.lat && repartidorUbicacion.lng) {
            console.log('🚗 Ubicación del repartidor:', repartidorUbicacion);
            
            L.marker([repartidorUbicacion.lat, repartidorUbicacion.lng], {
                icon: L.icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowSize: [41, 41]
                })
            }).addTo(mapa).bindPopup(`<strong>🟢 Mi ubicación (Repartidor)</strong>`);
            
            // Dibujar línea entre ambos puntos
            const latlngs = [[lat, lng], [repartidorUbicacion.lat, repartidorUbicacion.lng]];
            L.polyline(latlngs, { color: '#dbb42a', weight: 3, opacity: 0.8 }).addTo(mapa);
            
            // Calcular distancia
            const distance = Math.sqrt(
                Math.pow(repartidorUbicacion.lat - lat, 2) + 
                Math.pow(repartidorUbicacion.lng - lng, 2)
            ) * 111; // Aproximado en km
            
            // Ajustar zoom para ver ambos puntos
            const group = new L.featureGroup([
                L.marker([lat, lng]),
                L.marker([repartidorUbicacion.lat, repartidorUbicacion.lng])
            ]);
            
            // Ajustar zoom para ver ambos puntos con manejo de errores
            try {
                mapa.fitBounds(group.getBounds().pad(0.15), { maxZoom: 15, animate: true });
            } catch (e) {
                console.error('Error en fitBounds:', e);
                mapa.setView([lat, lng], 13);
            }
            
            const timestamp = new Date(repartidorUbicacion.timestamp?.toDate?.() || repartidorUbicacion.timestamp);
            const horaActualización = timestamp.toLocaleTimeString('es-MX');
            
            mapaInfo.innerHTML = `
                <p><strong style="color: #e74c3c;">🔴 CLIENTE</strong></p>
                <p>📍 <strong>${nombreCliente}</strong></p>
                <p>📮 <strong>Dirección:</strong> ${direccionCliente}</p>
                <p>📌 <strong>Coordenadas:</strong> ${lat.toFixed(4)}, ${lng.toFixed(4)}</p>
                <hr style="border: 1px solid #ddd; margin: 0.5rem 0;">
                <p><strong style="color: #27ae60;">🟢 TU UBICACIÓN (REPARTIDOR)</strong></p>
                <p>📍 <strong>Coordenadas:</strong> ${repartidorUbicacion.lat.toFixed(4)}, ${repartidorUbicacion.lng.toFixed(4)}</p>
                <p>📏 <strong>Distancia:</strong> ${distance.toFixed(2)} km</p>
                <p style="font-size: 0.85rem; color: #666; margin-top: 0.5rem;">🕐 Última actualización: ${horaActualización}</p>
                <button class="btn-secondary" onclick="window.detenerCompartirUbicacion()" style="margin-top: 0.5rem; width: 100%;">⏹️ Detener compartición</button>
            `;
        } else {
            // Centrar mapa en la ubicación del cliente
            mapa.setView([lat, lng], 15);
            
            mapaInfo.innerHTML = `
                <p>📍 <strong>Cliente:</strong> ${nombreCliente}</p>
                <p>📮 <strong>Dirección:</strong> ${direccionCliente}</p>
                <p>📌 <strong>Coordenadas GPS:</strong> ${lat.toFixed(4)}, ${lng.toFixed(4)}</p>
                <p style="font-size: 0.9rem; color: #666; margin-top: 0.5rem;">🔴 Ubicación del cliente | 🚗 (Sin ubicación de repartidor)</p>
                <p style="font-size: 0.85rem; color: #999; margin-top: 0.5rem;">💡 Haz clic en "En Camino" para que el cliente comience a ver tu posición en tiempo real.</p>
            `;
        }
    } else {
        // Si no tenemos coordenadas, buscar la dirección
        console.log('🔍 Buscando dirección:', direccionCliente);
        
        fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(direccionCliente)}&format=json&limit=1`)
            .then(res => res.json())
            .then(data => {
                if (data.length > 0) {
                    const destLat = parseFloat(data[0].lat);
                    const destLng = parseFloat(data[0].lon);
                    
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
                    
                    // Si existe ubicación del repartidor, mostrarla
                    if (repartidorUbicacion && repartidorUbicacion.lat && repartidorUbicacion.lng) {
                        L.marker([repartidorUbicacion.lat, repartidorUbicacion.lng], {
                            icon: L.icon({
                                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
                                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                                iconSize: [25, 41],
                                iconAnchor: [12, 41],
                                popupAnchor: [1, -34],
                                shadowSize: [41, 41]
                            })
                        }).addTo(mapa).bindPopup(`<strong>🚗 Mi ubicación (Repartidor)</strong>`);
                        
                        // Dibujar línea
                        const latlngs = [[destLat, destLng], [repartidorUbicacion.lat, repartidorUbicacion.lng]];
                        L.polyline(latlngs, { color: '#dbb42a', weight: 3, opacity: 0.8 }).addTo(mapa);
                        
                        const group = new L.featureGroup([
                            L.marker([destLat, destLng]),
                            L.marker([repartidorUbicacion.lat, repartidorUbicacion.lng])
                        ]);
                        
                        try {
                            mapa.fitBounds(group.getBounds().pad(0.15), { maxZoom: 15, animate: true });
                        } catch (e) {
                            console.error('Error en fitBounds:', e);
                            mapa.setView([destLat, destLng], 13);
                        }
                    } else {
                        mapa.setView([destLat, destLng], 15);
                    }
                    
                    mapaInfo.innerHTML = `
                        <p>📍 <strong>Cliente:</strong> ${nombreCliente}</p>
                        <p>📮 <strong>Dirección:</strong> ${direccionCliente}</p>
                        <p style="font-size: 0.9rem; color: #666; margin-top: 0.5rem;">🔴 Ubicación del cliente (búsqueda de dirección)</p>
                    `;
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
        } catch (error) {
            console.error('Error creando mapa admin:', error);
            mapaInfo.innerHTML = `<p>❌ Error al crear el mapa. Por favor intenta nuevamente.</p>`;
        }
    }, 300);
};

// Override mostrarMapaAdmin para usar la versión mejorada
const mostrarMapaAdminOriginal = window.mostrarMapaAdmin;
window.mostrarMapaAdmin = window.mostrarMapaAdminMejorado;
