// ============================================
// MAPAS MEJORADOS - INCLUYE REPARTIDOR
// ============================================

let mapaInstanciaCliente = null;
let intervaloMonitoreoRepartidor = null;
let marcadorRepartidor = null;
let polylineRepartidor = null;
let marcadorUsuario = null;

// Para el cliente: mostrar su ubicación + ubicación del repartidor
window.mostrarMapaMejorado = function(direccionCliente, nombreCliente, lat = null, lng = null, pedidoId = null) {
    const mapaModal = document.getElementById('mapaModal');
    const mapContainer = document.getElementById('mapContainer');
    const mapaInfo = document.getElementById('mapaInfo');
    
    // Destruir mapa anterior si existe
    if (mapaInstanciaCliente) {
        try {
            // Detener monitoreo
            if (intervaloMonitoreoRepartidor) {
                clearInterval(intervaloMonitoreoRepartidor);
                intervaloMonitoreoRepartidor = null;
            }
            mapaInstanciaCliente.off();
            mapaInstanciaCliente.remove();
            mapaInstanciaCliente = null;
            marcadorRepartidor = null;
            polylineRepartidor = null;
            marcadorUsuario = null;
        } catch (e) {
            console.warn('Error removiendo mapa anterior:', e);
        }
    }
    
    // Limpiar contenedor
    mapContainer.innerHTML = '';
    
    // Mostrar modal PRIMERO
    window.abrirModal('mapaModal');
    
    // Convertir coordenadas destino
    const destLat = lat !== null ? parseFloat(lat) : null;
    const destLng = lng !== null ? parseFloat(lng) : null;
    
    // Mostrar botón inicial para solicitar permiso de ubicación
    mapaInfo.innerHTML = `
        <div style="text-align: center; padding: 2rem; background: #f8f9fa; border-radius: 8px;">
            <p style="color: #2980b9; font-weight: bold; font-size: 1.1rem; margin-bottom: 1rem;">🗺️ Acceso a tu Ubicación</p>
            <p style="margin: 1rem 0; color: #333;">Para ver el mapa con tu ubicación actual, necesitamos acceso a tu GPS.</p>
            <button id="btnPermitirUbicacion" style="
                padding: 12px 24px;
                background: #3498db;
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 1rem;
                cursor: pointer;
                margin: 1rem 0;
                font-weight: bold;
                transition: background 0.3s;
            " onmouseover="this.style.background='#2980b9'" onmouseout="this.style.background='#3498db'">
                ✅ Permitir Acceso a mi Ubicación
            </button>
            <p style="color: #666; font-size: 0.9rem; margin-top: 1.5rem;">
                <strong>📍 Qué pasará:</strong><br>
                1. Se mostrará un prompt del navegador<br>
                2. Selecciona "Permitir"<br>
                3. Verás tu ubicación en el mapa
            </p>
        </div>
    `;
    
    // Función auxiliar para solicitar geolocalización
    const solicitarGeolocalización = () => {
        mapaInfo.innerHTML = `
            <p style="color: #2980b9; font-weight: bold;">🗺️ Obteniendo tu Ubicación...</p>
            <ul style="margin: 0.5rem 0; padding-left: 1.5rem; font-size: 0.95rem;">
                <li>✅ Verifica que el GPS esté habilitado</li>
                <li>✅ <strong>Selecciona "Permitir" en el prompt del navegador</strong></li>
                <li>✅ Espera mientras se obtiene tu ubicación (puede tomar unos segundos)</li>
            </ul>
            <p style="color: #666; font-size: 0.9rem; margin-top: 1rem;">⏳ Cargando mapa...</p>
        `;
        
        try {
            if (navigator.geolocation) {
                const opcionesGeoloc = {
                    enableHighAccuracy: true,  // Solicitar GPS con máxima precisión
                    timeout: 10000,             // Esperar 10 segundos máximo
                    maximumAge: 0               // No usar datos en caché
                };
                
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const userLat = position.coords.latitude;
                        const userLng = position.coords.longitude;
                        const accuracy = position.coords.accuracy;
                        
                        console.log('Tu ubicacion:', userLat, userLng);
                        console.log('Precisión (metros):', accuracy);
                        
                        // CREAR MAPA CENTRADO EN USUARIO CON ZOOM MÁS ALTO PARA PRECISIÓN
                        const mapa = L.map('mapContainer', {
                            preferCanvas: true
                        }).setView([userLat, userLng], 16);
                        
                        mapaInstanciaCliente = mapa;
                        
                        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                            maxZoom: 19,
                            attribution: '© OpenStreetMap'
                        }).addTo(mapa);
                        
                        mapa.invalidateSize(false);
                        
                        const marcadores = [];
                        
                        // MARCADOR AZUL - Tu ubicacion actual
                        marcadorUsuario = L.marker([userLat, userLng], {
                            icon: L.icon({
                                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
                                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                                iconSize: [25, 41],
                                iconAnchor: [12, 41],
                                popupAnchor: [1, -34],
                                shadowSize: [41, 41]
                            })
                        }).addTo(mapa).bindPopup('Tu ubicacion actual');
                        marcadores.push(marcadorUsuario);
                        
                        let infoHtml = `
                            <p><strong style="color: #3498db;">Tu ubicacion actual</strong></p>
                            <p>Coordenadas: ${userLat.toFixed(4)}, ${userLng.toFixed(4)}</p>
                            <p style="font-size: 0.85rem; color: #666;">Precisión: ${accuracy.toFixed(0)}m</p>
                        `;
                        
                        // Si hay coordenadas del destino, agregar marcador rojo
                        if (destLat !== null && destLng !== null) {
                            const marcadorDestino = L.marker([destLat, destLng], {
                                icon: L.icon({
                                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                                    iconSize: [25, 41],
                                    iconAnchor: [12, 41],
                                    popupAnchor: [1, -34],
                                    shadowSize: [41, 41]
                                })
                            }).addTo(mapa).bindPopup(`${nombreCliente}<br>${direccionCliente}`);
                            marcadores.push(marcadorDestino);
                            
                            // Linea a destino
                            L.polyline([[userLat, userLng], [destLat, destLng]], {
                                color: '#dbb42a',
                                weight: 3,
                                opacity: 0.8
                            }).addTo(mapa);
                            
                            // Calcular distancia
                            const distance = Math.sqrt(
                                Math.pow(destLat - userLat, 2) + Math.pow(destLng - userLng, 2)
                            ) * 111;
                            
                            infoHtml += `
                                <hr>
                                <p><strong style="color: #e74c3c;">Destino de entrega</strong></p>
                                <p>${nombreCliente}</p>
                                <p>Direccion: ${direccionCliente}</p>
                                <p>Coordenadas: ${destLat.toFixed(4)}, ${destLng.toFixed(4)}</p>
                                <p>Distancia: ${distance.toFixed(2)} km</p>
                            `;
                        } else {
                            infoHtml += `<p style="color: #e74c3c;">ℹ️ No se tienen coordenadas GPS del destino</p>`;
                        }
                        
                        // Agregar repartidor si existe
                        if (pedidoId) {
                            const misPedidos = JSON.parse(localStorage.getItem('misPedidos')) || [];
                            const pedido = misPedidos.find(p => p.id === pedidoId);
                            if (pedido && pedido.repartidorUbicacion && pedido.repartidorUbicacion.lat && pedido.repartidorUbicacion.lng) {
                                const repartidorUbicacion = pedido.repartidorUbicacion;
                                
                                // MARCADOR VERDE - Repartidor
                                marcadorRepartidor = L.marker([repartidorUbicacion.lat, repartidorUbicacion.lng], {
                                    icon: L.icon({
                                        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
                                        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                                        iconSize: [25, 41],
                                        iconAnchor: [12, 41],
                                        popupAnchor: [1, -34],
                                        shadowSize: [41, 41]
                                    })
                                }).addTo(mapa).bindPopup('Repartidor en camino');
                                marcadores.push(marcadorRepartidor);
                                
                                // Linea al repartidor
                                if (destLat !== null && destLng !== null) {
                                    polylineRepartidor = L.polyline([[destLat, destLng], [repartidorUbicacion.lat, repartidorUbicacion.lng]], {
                                        color: '#0066ff',
                                        weight: 2,
                                        opacity: 0.7,
                                        dashArray: '5, 5'
                                    }).addTo(mapa);
                                }
                                
                                const distanceRepartidor = Math.sqrt(
                                    Math.pow(destLat - repartidorUbicacion.lat, 2) + 
                                    Math.pow(destLng - repartidorUbicacion.lng, 2)
                                ) * 111;
                                
                                const timestamp = new Date(repartidorUbicacion.timestamp);
                                const horaActualización = timestamp.toLocaleTimeString('es-MX');
                                
                                infoHtml += `
                                    <hr>
                                    <p><strong style="color: #27ae60;">Repartidor en camino</strong></p>
                                    <p>Ubicacion: ${repartidorUbicacion.lat.toFixed(4)}, ${repartidorUbicacion.lng.toFixed(4)}</p>
                                    <p>Distancia: ${distanceRepartidor.toFixed(2)} km</p>
                                    <p style="font-size: 0.85rem;">Actualizado: ${horaActualización}</p>
                                `;
                                
                                // Iniciar monitoreo en tiempo real
                                if (mapaInstanciaCliente && pedidoId) {
                                    iniciarMonitoreoRepartidor(pedidoId, destLat, destLng, mapaInfo);
                                }
                            } else {
                                // Repartidor NO existe aún, pero iniciar monitoreo por si aparece después
                                if (mapaInstanciaCliente && pedidoId) {
                                    console.log('⏳ Repartidor no disponible aún, iniciando monitoreo para detectar cuando llegue');
                                    iniciarMonitoreoRepartidor(pedidoId, destLat, destLng, mapaInfo);
                                }
                            }
                        }
                        
                        // Enfocar en TODOS los puntos
                        if (marcadores.length > 1) {
                            const group = new L.featureGroup(marcadores);
                            try {
                                mapa.fitBounds(group.getBounds().pad(0.15), { maxZoom: 15, animate: true });
                            } catch (e) {
                                console.error('Error en fitBounds:', e);
                                mapa.setView([userLat, userLng], 13);
                            }
                        }
                        
                        infoHtml += `<p style="font-size: 0.9rem; color: #666; margin-top: 1rem;">🔵 Azul=Tu ubicacion | 🔴 Rojo=Destino | 🟢 Verde=Repartidor</p>`;
                        mapaInfo.innerHTML = infoHtml;
                    },
                    (error) => {
                        console.error('Error geolocalización:', error);
                        console.error('Código error:', error.code, 'Mensaje:', error.message);
                        
                        // Fallback: Si hay destino, mostrar el destino + repartidor
                        if (destLat !== null && destLng !== null) {
                            const mapa = L.map('mapContainer', {
                                preferCanvas: true
                            }).setView([destLat, destLng], 16);
                            
                            mapaInstanciaCliente = mapa;
                            
                            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                                maxZoom: 19,
                                attribution: '© OpenStreetMap'
                            }).addTo(mapa);
                            
                            mapa.invalidateSize(false);
                            
                            const marcadores = [];
                            
                            // Marcador rojo - Destino
                            const marcadorDestino = L.marker([destLat, destLng], {
                                icon: L.icon({
                                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                                    iconSize: [25, 41],
                                    iconAnchor: [12, 41],
                                    popupAnchor: [1, -34],
                                    shadowSize: [41, 41]
                                })
                            }).addTo(mapa).bindPopup(`${nombreCliente}<br>${direccionCliente}`);
                            marcadores.push(marcadorDestino);
                            
                            let infoFallback = `
                                <p>📍 Tu dirección de entrega</p>
                                <p><strong>${nombreCliente}</strong></p>
                                <p>Dirección: ${direccionCliente}</p>
                                <p>Coordenadas: ${destLat.toFixed(4)}, ${destLng.toFixed(4)}</p>
                                <p style="color: #e74c3c; font-size: 0.9rem;">⚠️ No se pudo obtener tu ubicación GPS actual</p>
                                <p style="color: #666; font-size: 0.85rem;">Habilita GPS y reinicia para ver tu ubicación en tiempo real</p>
                            `;
                            
                            // Agregar repartidor si existe
                            if (pedidoId) {
                                const misPedidos = JSON.parse(localStorage.getItem('misPedidos')) || [];
                                const pedido = misPedidos.find(p => p.id === pedidoId);
                                if (pedido && pedido.repartidorUbicacion && pedido.repartidorUbicacion.lat && pedido.repartidorUbicacion.lng) {
                                    const repartidorUbicacion = pedido.repartidorUbicacion;
                                    
                                    // Marcador verde - Repartidor
                                    marcadorRepartidor = L.marker([repartidorUbicacion.lat, repartidorUbicacion.lng], {
                                        icon: L.icon({
                                            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
                                            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                                            iconSize: [25, 41],
                                            iconAnchor: [12, 41],
                                            popupAnchor: [1, -34],
                                            shadowSize: [41, 41]
                                        })
                                    }).addTo(mapa).bindPopup('Repartidor en camino');
                                    marcadores.push(marcadorRepartidor);
                                    
                                    // Polyline al repartidor
                                    polylineRepartidor = L.polyline([[destLat, destLng], [repartidorUbicacion.lat, repartidorUbicacion.lng]], {
                                        color: '#0066ff',
                                        weight: 2,
                                        opacity: 0.7,
                                        dashArray: '5, 5'
                                    }).addTo(mapa);
                                    
                                    const distanceRepartidor = Math.sqrt(
                                        Math.pow(destLat - repartidorUbicacion.lat, 2) + 
                                        Math.pow(destLng - repartidorUbicacion.lng, 2)
                                    ) * 111;
                                    
                                    const timestamp = new Date(repartidorUbicacion.timestamp);
                                    const horaActualización = timestamp.toLocaleTimeString('es-MX');
                                    
                                    infoFallback += `
                                        <hr>
                                        <p><strong style="color: #27ae60;">🚗 Repartidor en camino</strong></p>
                                        <p>Ubicacion: ${repartidorUbicacion.lat.toFixed(4)}, ${repartidorUbicacion.lng.toFixed(4)}</p>
                                        <p>Distancia: ${distanceRepartidor.toFixed(2)} km</p>
                                        <p style="font-size: 0.85rem;">Actualizado: ${horaActualización}</p>
                                    `;
                                    
                                    // Enfocar en ambos puntos
                                    if (marcadores.length > 1) {
                                        const group = new L.featureGroup(marcadores);
                                        try {
                                            mapa.fitBounds(group.getBounds().pad(0.15), { maxZoom: 15, animate: true });
                                        } catch (e) {
                                            console.error('Error en fitBounds:', e);
                                        }
                                    }
                                    
                                    // Iniciar monitoreo
                                    if (mapaInstanciaCliente && pedidoId) {
                                        iniciarMonitoreoRepartidor(pedidoId, destLat, destLng, mapaInfo);
                                    }
                                } else {
                                    // Repartidor NO existe aún en fallback, pero iniciar monitoreo por si aparece después
                                    if (mapaInstanciaCliente && pedidoId) {
                                        console.log('⏳ Repartidor no disponible en fallback, iniciando monitoreo para detectar cuando llegue');
                                        iniciarMonitoreoRepartidor(pedidoId, destLat, destLng, mapaInfo);
                                    }
                                }
                            }
                            
                            infoFallback += `<p style="font-size: 0.9rem; color: #666; margin-top: 1rem;">🔴 Rojo=Destino | 🟢 Verde=Repartidor</p>`;
                            mapaInfo.innerHTML = infoFallback;
                        } else {
                            mapaInfo.innerHTML = `
                                <p style="color: #e74c3c;">⚠️ No se pudo obtener tu ubicación</p>
                                <p>Por favor:</p>
                                <ul style="padding-left: 1.5rem;">
                                    <li>Asegúrate de permitir acceso a la ubicación</li>
                                    <li>Habilita el GPS en tu dispositivo</li>
                                    <li>Intenta nuevamente</li>
                                </ul>
                            `;
                        }
                    },
                    opcionesGeoloc
                );
            } else {
                mapaInfo.innerHTML = `<p style="color: #e74c3c;">❌ Tu navegador no soporta geolocalización</p>`;
            }
        } catch (error) {
            console.error('Error en geolocalización:', error);
            mapaInfo.innerHTML = `<p style="color: #e74c3c;">❌ Error al obtener ubicación</p>`;
        }
    };
    
    // Agregar event listener al botón para solicitar geolocalización
    setTimeout(() => {
        const btnPermitir = document.getElementById('btnPermitirUbicacion');
        if (btnPermitir) {
            btnPermitir.addEventListener('click', solicitarGeolocalización);
        }
    }, 100);
};

// Monitorear cambios en tiempo real del repartidor desde localStorage
function iniciarMonitoreoRepartidor(pedidoId, destLat, destLng, mapaInfo) {
    console.log('Iniciando monitoreo de repartidor:', pedidoId);
    
    // Detener monitoreo anterior si existe
    if (intervaloMonitoreoRepartidor) {
        clearInterval(intervaloMonitoreoRepartidor);
    }
    
    // Monitorear cada segundo
    intervaloMonitoreoRepartidor = setInterval(() => {
        if (!mapaInstanciaCliente) {
            clearInterval(intervaloMonitoreoRepartidor);
            return;
        }
        
        try {
            const misPedidos = JSON.parse(localStorage.getItem('misPedidos')) || [];
            const pedido = misPedidos.find(p => p.id === pedidoId);
            
            if (pedido && pedido.repartidorUbicacion && pedido.repartidorUbicacion.lat && pedido.repartidorUbicacion.lng) {
                const repLat = pedido.repartidorUbicacion.lat;
                const repLng = pedido.repartidorUbicacion.lng;
                
                // Si el marcador NO existe, crearlo
                if (!marcadorRepartidor) {
                    console.log('📍 Creando marcador del repartidor:', repLat, repLng);
                    
                    marcadorRepartidor = L.marker([repLat, repLng], {
                        icon: L.icon({
                            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
                            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                            iconSize: [25, 41],
                            iconAnchor: [12, 41],
                            popupAnchor: [1, -34],
                            shadowSize: [41, 41]
                        })
                    }).addTo(mapaInstanciaCliente).bindPopup('Repartidor en camino');
                    
                    // Crear polyline si destino existe
                    if (destLat !== null && destLng !== null) {
                        polylineRepartidor = L.polyline([[destLat, destLng], [repLat, repLng]], {
                            color: '#0066ff',
                            weight: 2,
                            opacity: 0.7,
                            dashArray: '5, 5'
                        }).addTo(mapaInstanciaCliente);
                    }
                }
                
                // Actualizar posición si el marcador existe
                if (marcadorRepartidor) {
                    const posAnterior = marcadorRepartidor.getLatLng();
                    
                    // Solo actualizar si la posición cambió
                    if (posAnterior.lat !== repLat || posAnterior.lng !== repLng) {
                        console.log('📍 Marcador repartidor movido:', repLat, repLng);
                        marcadorRepartidor.setLatLng([repLat, repLng]);
                        
                        // Actualizar polyline
                        if (polylineRepartidor && destLat !== null && destLng !== null) {
                            polylineRepartidor.setLatLngs([[destLat, destLng], [repLat, repLng]]);
                        }
                    }
                }
                
                // Actualizar información
                if (destLat !== null && destLng !== null) {
                    const distanceRepartidor = Math.sqrt(
                        Math.pow(destLat - repLat, 2) + Math.pow(destLng - repLng, 2)
                    ) * 111;
                    
                    const timestamp = new Date(pedido.repartidorUbicacion.timestamp);
                    const horaActualización = timestamp.toLocaleTimeString('es-MX');
                    
                    const infoRepartidorActualizado = `
                        <p><strong style="color: #27ae60;">🚗 Repartidor en camino</strong></p>
                        <p>Ubicacion: ${repLat.toFixed(4)}, ${repLng.toFixed(4)}</p>
                        <p>Distancia: ${distanceRepartidor.toFixed(2)} km</p>
                        <p style="font-size: 0.85rem;">Actualizado: ${horaActualización}</p>
                    `;
                    
                    const htmlActual = mapaInfo.innerHTML;
                    const inicioRepartidor = htmlActual.indexOf('<p><strong style="color: #27ae60;">');
                    
                    if (inicioRepartidor > -1) {
                        // Reemplazar información existente del repartidor
                        const finRepartidor = htmlActual.indexOf('<p style="font-size: 0.9rem;', inicioRepartidor);
                        if (finRepartidor > -1) {
                            const parteAntes = htmlActual.substring(0, inicioRepartidor);
                            const parteDespues = htmlActual.substring(finRepartidor);
                            mapaInfo.innerHTML = parteAntes + infoRepartidorActualizado + '\n' + parteDespues;
                        }
                    } else if (!htmlActual.includes('🚗 Repartidor')) {
                        // Si no existe la sección del repartidor, agregarla antes de la leyenda
                        const finInfo = htmlActual.lastIndexOf('<p style="font-size: 0.9rem;');
                        if (finInfo > -1) {
                            const parteAntes = htmlActual.substring(0, finInfo);
                            const parteDespues = htmlActual.substring(finInfo);
                            mapaInfo.innerHTML = parteAntes + '<hr>' + infoRepartidorActualizado + '\n' + parteDespues;
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error en monitoreo:', error);
        }
    }, 1000); // Verificar cada segundo
}

window.mostrarMapaMejoradoAdmin = window.mostrarMapaAdmin;
