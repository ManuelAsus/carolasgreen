// ============================================
// MAPAS MEJORADOS - INCLUYE REPARTIDOR
// ============================================

let mapaInstanciaCliente = null;
let unsubscribeRepartidorUbicacion = null;
let marcadorRepartidor = null;
let polylineRepartidor = null;

// Para el cliente: mostrar su ubicación + ubicación del repartidor
window.mostrarMapaMejorado = function(direccionCliente, nombreCliente, lat = null, lng = null, pedidoId = null) {
    const mapaModal = document.getElementById('mapaModal');
    const mapContainer = document.getElementById('mapContainer');
    const mapaInfo = document.getElementById('mapaInfo');
    
    // Destruir mapa anterior si existe
    if (mapaInstanciaCliente) {
        try {
            // Detener listener del repartidor
            if (unsubscribeRepartidorUbicacion) {
                unsubscribeRepartidorUbicacion();
                unsubscribeRepartidorUbicacion = null;
            }
            mapaInstanciaCliente.off();
            mapaInstanciaCliente.remove();
            mapaInstanciaCliente = null;
        } catch (e) {
            console.warn('Error removiendo mapa anterior:', e);
        }
    }
    
    // Limpiar contenedor
    mapContainer.innerHTML = '';
    
    // Mostrar modal PRIMERO para que el contenedor tenga dimensiones
    window.abrirModal('mapaModal');
    
    mapaInfo.innerHTML = `<p>📍 <strong>Tu ubicación:</strong></p><p>⏳ Cargando...</p>`;
    
    // Dar tiempo a que el modal aparezca y el contenedor tenga dimensiones
    setTimeout(() => {
        try {
            // Crear mapa
            const mapa = L.map('mapContainer', {
                preferCanvas: true
            }).setView([18.4241, -69.9267], 13);
            
            mapaInstanciaCliente = mapa;
    
            // Agregar tiles de OpenStreetMap
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '© OpenStreetMap contributors'
            }).addTo(mapa);
            
            // Forzar que Leaflet recalcule el tamaño del mapa
            mapa.invalidateSize(false);
    
    // Obtener ubicación actual del usuario (cliente)
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
                    // Marcar ubicación del destino (cliente)
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
                    
                    // Crear featureGroup para ambos puntos
                    const markers = [
                        L.marker([userLat, userLng]),
                        L.marker([destLat, destLng])
                    ];
                    
                    // Agregar marcador del repartidor si existe
                    if (pedidoId) {
                        const misPedidos = JSON.parse(localStorage.getItem('misPedidos')) || [];
                        const pedido = misPedidos.find(p => p.id === pedidoId);
                        if (pedido && pedido.repartidorUbicacion && pedido.repartidorUbicacion.lat && pedido.repartidorUbicacion.lng) {
                            const repLat = pedido.repartidorUbicacion.lat;
                            const repLng = pedido.repartidorUbicacion.lng;
                            marcadorRepartidor = L.marker([repLat, repLng], {
                                icon: L.icon({
                                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
                                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                                    iconSize: [25, 41],
                                    iconAnchor: [12, 41],
                                    popupAnchor: [1, -34],
                                    shadowSize: [41, 41]
                                })
                            }).addTo(mapa).bindPopup(`<strong>🚗 Repartidor en camino</strong>`);
                            
                            // Dibujar línea al repartidor
                            polylineRepartidor = L.polyline([[destLat, destLng], [repLat, repLng]], {
                                color: '#0066ff',
                                weight: 2,
                                opacity: 0.7,
                                dashArray: '5, 5'
                            }).addTo(mapa);
                            
                            markers.push(L.marker([repLat, repLng]));
                        }
                    }
                    
                    const group = new L.featureGroup(markers);
                    
                    // Ajustar zoom para ver todos los puntos
                    try {
                        mapa.fitBounds(group.getBounds().pad(0.15), { maxZoom: 15, animate: true });
                    } catch (e) {
                        console.error('Error en fitBounds:', e);
                        mapa.setView([userLat, userLng], 13);
                    }
                    
                    // Calcular distancia (aproximada)
                    const distance = Math.sqrt(
                        Math.pow(destLat - userLat, 2) + Math.pow(destLng - userLng, 2)
                    ) * 111; // Aproximado en km
                    
                    const tipoUbicacion = esGPS ? '(GPS en tiempo real)' : '(búsqueda de dirección)';
                    
                    // Buscar ubicación del repartidor si existe pedidoId
                    let infoRepartidor = '';
                    if (pedidoId) {
                        const misPedidos = JSON.parse(localStorage.getItem('misPedidos')) || [];
                        const pedido = misPedidos.find(p => p.id === pedidoId);
                        if (pedido && pedido.repartidorUbicacion && pedido.repartidorUbicacion.lat && pedido.repartidorUbicacion.lng) {
                            const repartidorUbicacion = pedido.repartidorUbicacion;
                            console.log('🚗 Ubicación del repartidor encontrada:', repartidorUbicacion);
                            
                            const distanceRepartidor = Math.sqrt(
                                Math.pow(destLat - repartidorUbicacion.lat, 2) + 
                                Math.pow(destLng - repartidorUbicacion.lng, 2)
                            ) * 111;
                            
                            const timestamp = new Date(repartidorUbicacion.timestamp);
                            const horaActualización = timestamp.toLocaleTimeString('es-MX');
                            
                            infoRepartidor = `
                                <p><strong style="color: #27ae60;">🚗 El repartidor está en camino</strong></p>
                                <p>📍 Ubicación: ${repartidorUbicacion.lat.toFixed(4)}, ${repartidorUbicacion.lng.toFixed(4)}</p>
                                <p>📏 A ${distanceRepartidor.toFixed(2)} km de ti</p>
                                <p style="font-size: 0.85rem; color: #666;">🕐 Actualizado: ${horaActualización}</p>
                            `;
                            
                            // Iniciar monitoreo en tiempo real del repartidor
                            if (pedidoId && mapaInstanciaCliente) {
                                monitorearRepartidorEnMapa(pedidoId, destLat, destLng, mapaInfo);
                            }
                        }
                    }
                    
                    mapaInfo.innerHTML = `
                        <p><strong style="color: #3498db;">📍 Tu ubicación actual</strong></p>
                        <p>📮 <strong>Destino:</strong> ${nombreCliente}</p>
                        <p>📌 <strong>Dirección:</strong> ${direccionCliente}</p>
                        <p>📏 <strong>Distancia a tu destino:</strong> ${distance.toFixed(2)} km</p>
                        ${infoRepartidor}
                        <p style="font-size: 0.9rem; color: #666; margin-top: 0.5rem;">🔵 Azul = Tu ubicación | 🔴 Rojo = Tu destino | 🟢 Verde = Repartidor viniendo</p>
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
                        <p>📍 <strong>Tu dirección de entrega</strong></p>
                        <p>📮 <strong>Destino:</strong> ${nombreCliente}</p>
                        <p>📌 <strong>Coordenadas:</strong> ${destLat.toFixed(4)}, ${destLng.toFixed(4)}</p>
                        <p style="font-size: 0.9rem; color: #999; margin-top: 0.5rem;">ℹ️ No se pudo obtener tu ubicación actual, mostrando ubicación de entrega</p>
                    `;
                }
            }
        );
    } else {
        mapaInfo.innerHTML = `<p>❌ Tu navegador no soporta geolocalización.</p>`;
    }
        } catch (error) {
            console.error('Error creando mapa:', error);
            mapaInfo.innerHTML = `<p>❌ Error al crear el mapa. Por favor intenta nuevamente.</p>`;
        }
    }, 300);
};

// Monitorear cambios en tiempo real de la ubicación del repartidor
function monitorearRepartidorEnMapa(pedidoId, destLat, destLng, mapaInfo) {
    // Usar setInterval para verificar cambios cada 2 segundos
    const intervaloMonitoreo = setInterval(() => {
        if (!mapaInstanciaCliente) {
            clearInterval(intervaloMonitoreo);
            return;
        }
        
        try {
            const misPedidos = JSON.parse(localStorage.getItem('misPedidos')) || [];
            const pedido = misPedidos.find(p => p.id === pedidoId);
            
            if (pedido && pedido.repartidorUbicacion && pedido.repartidorUbicacion.lat && pedido.repartidorUbicacion.lng) {
                const newLat = pedido.repartidorUbicacion.lat;
                const newLng = pedido.repartidorUbicacion.lng;
                
                // Si el marcador del repartidor existe y cambió de posición, actualizar
                if (marcadorRepartidor) {
                    const posAnterior = marcadorRepartidor.getLatLng();
                    
                    // Si cambió la posición, actualizar
                    if (posAnterior.lat !== newLat || posAnterior.lng !== newLng) {
                        console.log('🚗 Actualizando ubicación del repartidor en el mapa:', newLat, newLng);
                        marcadorRepartidor.setLatLng([newLat, newLng]);
                        
                        // Actualizar polyline
                        if (polylineRepartidor) {
                            polylineRepartidor.setLatLngs([[destLat, destLng], [newLat, newLng]]);
                        }
                        
                        // Recalcular distancia
                        const distanceRepartidor = Math.sqrt(
                            Math.pow(destLat - newLat, 2) + 
                            Math.pow(destLng - newLng, 2)
                        ) * 111;
                        
                        const timestamp = new Date(pedido.repartidorUbicacion.timestamp);
                        const horaActualización = timestamp.toLocaleTimeString('es-MX');
                        
                        // Actualizar panel de información
                        const infoRepartidorActualizado = `
                            <p><strong style="color: #27ae60;">🚗 El repartidor está en camino</strong></p>
                            <p>📍 Ubicación: ${newLat.toFixed(4)}, ${newLng.toFixed(4)}</p>
                            <p>📏 A ${distanceRepartidor.toFixed(2)} km de ti</p>
                            <p style="font-size: 0.85rem; color: #666;">🕐 Actualizado: ${horaActualización}</p>
                        `;
                        
                        const htmlActual = mapaInfo.innerHTML;
                        const parteAntes = htmlActual.substring(0, htmlActual.indexOf('<p><strong style="color: #27ae60;">'));
                        const parteDespues = htmlActual.substring(htmlActual.lastIndexOf('<p style="font-size: 0.9rem;'));
                        
                        if (parteAntes && parteDespues) {
                            mapaInfo.innerHTML = parteAntes + infoRepartidorActualizado + '\n' + parteDespues;
                        }
                    }
                } else if (!marcadorRepartidor) {
                    // Si no existe el marcador pero ahora hay ubicación, crearlo
                    console.log('🚗 Creando marcador del repartidor en el mapa');
                    marcadorRepartidor = L.marker([newLat, newLng], {
                        icon: L.icon({
                            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
                            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                            iconSize: [25, 41],
                            iconAnchor: [12, 41],
                            popupAnchor: [1, -34],
                            shadowSize: [41, 41]
                        })
                    }).addTo(mapaInstanciaCliente).bindPopup(`<strong>🚗 Repartidor en camino</strong>`);
                    
                    // Dibujar polyline
                    polylineRepartidor = L.polyline([[destLat, destLng], [newLat, newLng]], {
                        color: '#0066ff',
                        weight: 2,
                        opacity: 0.7,
                        dashArray: '5, 5'
                    }).addTo(mapaInstanciaCliente);
                    
                    console.log('✅ Marcador del repartidor agregado');
                }
            }
        } catch (error) {
            console.error('Error en monitorearRepartidorEnMapa:', error);
        }
    }, 2000); // Verificar cada 2 segundos
}

// Alias para mantener compatibilidad
window.mostrarMapaMejoradoAdmin = window.mostrarMapaAdmin;
