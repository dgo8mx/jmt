// ================================
// GEOTOOL FORESTAL TVH - APP.JS
// Sistema MRV con gestión multi-capa
// ================================

class GeoToolApp {
    constructor() {
        this.map = null;
        this.baseLayers = {};
        this.currentBasemap = 'satellite';
        this.layers = [];
        this.captures = [];
        this.gpsActive = false;
        this.gpsWatch = null;
        this.userMarker = null;
        this.accuracyCircle = null;
        this.gpsTrack = [];
        this.captureMode = null;
        this.tempMarkers = [];
        this.currentPolygon = null;
        
        this.init();
    }
    
    init() {
        this.initMap();
        this.initBasemaps();
        this.setupEventListeners();
        this.updateStats();
        this.loadFromLocalStorage();
    }
    
    // ================================
    // MAPA
    // ================================
    
    initMap() {
        this.map = L.map('map', {
            center: [24.0277, -104.6532], // Durango, México
            zoom: 13,
            zoomControl: false,
            attributionControl: false
        });
        
        L.control.zoom({ position: 'bottomright' }).addTo(this.map);
        
        L.control.scale({
            position: 'bottomleft',
            metric: true,
            imperial: false
        }).addTo(this.map);
        
        // Click en mapa para capturar
        this.map.on('click', (e) => this.handleMapClick(e));
    }
    
    initBasemaps() {
        this.baseLayers = {
            satellite: L.tileLayer('https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
                subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
                maxZoom: 20,
                attribution: 'Google Satellite'
            }),
            streets: L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
                subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
                maxZoom: 20,
                attribution: 'Google Maps'
            }),
            terrain: L.tileLayer('https://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', {
                subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
                maxZoom: 20,
                attribution: 'Google Terrain'
            }),
            osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: 'OpenStreetMap'
            })
        };
        
        this.baseLayers[this.currentBasemap].addTo(this.map);
    }
    
    switchBasemap(basemapName) {
        if (this.baseLayers[this.currentBasemap]) {
            this.map.removeLayer(this.baseLayers[this.currentBasemap]);
        }
        
        this.currentBasemap = basemapName;
        this.baseLayers[basemapName].addTo(this.map);
        
        document.querySelectorAll('.basemap-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.basemap === basemapName);
        });
    }
    
    // ================================
    // GPS
    // ================================
    
    toggleGPS() {
        if (this.gpsActive) {
            this.stopGPS();
        } else {
            this.startGPS();
        }
    }
    
    startGPS() {
        const btn = document.getElementById('gps-toggle');
        const indicator = document.getElementById('gps-indicator');
        
        if (!navigator.geolocation) {
            alert('GPS no disponible en este dispositivo');
            return;
        }
        
        this.gpsActive = true;
        btn.classList.add('active');
        btn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="10" r="3"/><path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z"/>
            </svg>
            <span>Detener GPS</span>
        `;
        indicator.classList.add('active');
        
        const options = {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
        };
        
        this.gpsWatch = navigator.geolocation.watchPosition(
            (position) => this.handleGPSPosition(position),
            (error) => this.handleGPSError(error),
            options
        );
    }
    
    stopGPS() {
        if (this.gpsWatch !== null) {
            navigator.geolocation.clearWatch(this.gpsWatch);
            this.gpsWatch = null;
        }
        
        this.gpsActive = false;
        
        const btn = document.getElementById('gps-toggle');
        const indicator = document.getElementById('gps-indicator');
        
        btn.classList.remove('active');
        btn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="10" r="3"/><path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z"/>
            </svg>
            <span>Iniciar GPS</span>
        `;
        indicator.classList.remove('active');
        indicator.querySelector('.status-text').textContent = 'GPS Inactivo';
    }
    
    handleGPSPosition(position) {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        const accuracy = position.coords.accuracy;
        const altitude = position.coords.altitude || 0;
        
        // Actualizar display
        this.updateGPSDisplay(lat, lon, accuracy, altitude);
        
        // Actualizar marcador
        const latlng = L.latLng(lat, lon);
        
        if (!this.userMarker) {
            this.userMarker = L.marker(latlng, {
                icon: L.divIcon({
                    className: 'gps-marker',
                    html: `
                        <div style="
                            width: 20px;
                            height: 20px;
                            background: #4a9d5f;
                            border: 3px solid white;
                            border-radius: 50%;
                            box-shadow: 0 2px 8px rgba(0,0,0,0.4);
                        "></div>
                    `,
                    iconSize: [20, 20],
                    iconAnchor: [10, 10]
                })
            }).addTo(this.map);
            
            this.accuracyCircle = L.circle(latlng, {
                radius: accuracy,
                color: '#4a9d5f',
                fillColor: '#7bc96f',
                fillOpacity: 0.15,
                weight: 2
            }).addTo(this.map);
            
            this.map.setView(latlng, 16);
        } else {
            this.userMarker.setLatLng(latlng);
            this.accuracyCircle.setLatLng(latlng).setRadius(accuracy);
        }
        
        // Guardar traza
        this.gpsTrack.push({
            lat,
            lon,
            altitude,
            accuracy,
            timestamp: new Date().toISOString()
        });
        
        // Actualizar indicador
        const indicator = document.getElementById('gps-indicator');
        indicator.classList.add('active');
        indicator.querySelector('.status-text').textContent = 'GPS Activo';
    }
    
    handleGPSError(error) {
        console.error('GPS Error:', error);
        const messages = {
            1: 'Permiso de ubicación denegado',
            2: 'Ubicación no disponible',
            3: 'Tiempo de espera agotado'
        };
        alert(messages[error.code] || 'Error GPS desconocido');
        this.stopGPS();
    }
    
    updateGPSDisplay(lat, lon, accuracy, altitude) {
        document.getElementById('coord-latlon').textContent = 
            `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
        
        document.getElementById('coord-accuracy').textContent = 
            `${accuracy.toFixed(1)} m`;
        
        document.getElementById('coord-altitude').textContent = 
            `${altitude.toFixed(0)} m`;
        
        // Calcular UTM
        const zone = Math.floor((lon + 180) / 6) + 1;
        const hemisphere = lat >= 0 ? 'N' : 'S';
        
        try {
            const utmProj = `+proj=utm +zone=${zone} +${hemisphere === 'S' ? 'south' : ''} +datum=WGS84 +units=m +no_defs`;
            const utm = proj4(proj4.WGS84, utmProj, [lon, lat]);
            
            document.getElementById('coord-utm-label').textContent = 
                `UTM ZONA ${zone}${hemisphere}`;
            document.getElementById('coord-utm').textContent = 
                `${utm[0].toFixed(2)} E, ${utm[1].toFixed(2)} N`;
        } catch (e) {
            console.error('Error calculando UTM:', e);
        }
    }
    
    // ================================
    // CAPTURA DE DATOS
    // ================================
    
    setCaptureTool(tool) {
        this.captureMode = tool;
        
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const activeBtn = document.getElementById(`tool-${tool}`);
        if (activeBtn) activeBtn.classList.add('active');
        
        this.clearTempMarkers();
    }
    
    handleMapClick(e) {
        if (!this.captureMode) return;
        
        const { lat, lng } = e.latlng;
        
        switch (this.captureMode) {
            case 'point':
                this.capturePoint(lat, lng);
                break;
            case 'line':
                this.captureLinePoint(lat, lng);
                break;
            case 'polygon':
            case 'area':
                this.capturePolygonPoint(lat, lng);
                break;
        }
    }
    
    capturePoint(lat, lng) {
        const name = prompt('Nombre del punto:');
        if (!name) return;
        
        const description = prompt('Descripción (opcional):') || '';
        
        const marker = L.marker([lat, lng], {
            icon: L.divIcon({
                className: 'capture-marker',
                html: `
                    <div style="
                        width: 12px;
                        height: 12px;
                        background: #f59e0b;
                        border: 2px solid white;
                        border-radius: 50%;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.4);
                    "></div>
                `,
                iconSize: [12, 12],
                iconAnchor: [6, 6]
            })
        }).addTo(this.map);
        
        marker.bindPopup(`<b>${name}</b><br>${description}`);
        
        this.captures.push({
            id: Date.now(),
            type: 'point',
            name,
            description,
            coordinates: [lat, lng],
            timestamp: new Date().toISOString(),
            layer: marker
        });
        
        this.updateCapturesList();
        this.updateStats();
        this.saveToLocalStorage();
    }
    
    captureLinePoint(lat, lng) {
        const marker = L.circleMarker([lat, lng], {
            radius: 5,
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.8
        }).addTo(this.map);
        
        this.tempMarkers.push({ lat, lng, marker });
        
        if (this.tempMarkers.length >= 2) {
            const coords = this.tempMarkers.map(m => [m.lat, m.lng]);
            
            if (this.currentPolygon) {
                this.map.removeLayer(this.currentPolygon);
            }
            
            this.currentPolygon = L.polyline(coords, {
                color: '#3b82f6',
                weight: 3
            }).addTo(this.map);
        }
        
        if (this.tempMarkers.length >= 2 && 
            confirm(`Finalizar línea con ${this.tempMarkers.length} puntos?`)) {
            this.finalizeLine();
        }
    }
    
    finalizeLine() {
        const name = prompt('Nombre de la línea:');
        if (!name) {
            this.clearTempMarkers();
            return;
        }
        
        const coords = this.tempMarkers.map(m => [m.lat, m.lng]);
        const distance = this.calculateDistance(coords);
        
        this.captures.push({
            id: Date.now(),
            type: 'line',
            name,
            coordinates: coords,
            distance: distance,
            timestamp: new Date().toISOString(),
            layer: this.currentPolygon
        });
        
        this.clearTempMarkers();
        this.currentPolygon = null;
        this.captureMode = null;
        
        this.updateCapturesList();
        this.updateStats();
        this.saveToLocalStorage();
        
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    }
    
    capturePolygonPoint(lat, lng) {
        const marker = L.circleMarker([lat, lng], {
            radius: 5,
            color: '#7bc96f',
            fillColor: '#7bc96f',
            fillOpacity: 0.8
        }).addTo(this.map);
        
        this.tempMarkers.push({ lat, lng, marker });
        
        if (this.tempMarkers.length >= 3) {
            const coords = this.tempMarkers.map(m => [m.lat, m.lng]);
            
            if (this.currentPolygon) {
                this.map.removeLayer(this.currentPolygon);
            }
            
            this.currentPolygon = L.polygon(coords, {
                color: '#7bc96f',
                fillColor: '#7bc96f',
                fillOpacity: 0.3,
                weight: 2
            }).addTo(this.map);
        }
        
        if (this.tempMarkers.length >= 3 && 
            confirm(`Finalizar polígono con ${this.tempMarkers.length} puntos?`)) {
            this.finalizePolygon();
        }
    }
    
    finalizePolygon() {
        const name = prompt('Nombre del polígono:');
        if (!name) {
            this.clearTempMarkers();
            return;
        }
        
        const coords = this.tempMarkers.map(m => [m.lat, m.lng]);
        const area = this.calculateArea(coords);
        
        this.captures.push({
            id: Date.now(),
            type: 'polygon',
            name,
            coordinates: coords,
            area: area,
            timestamp: new Date().toISOString(),
            layer: this.currentPolygon
        });
        
        this.clearTempMarkers();
        this.currentPolygon = null;
        this.captureMode = null;
        
        this.updateCapturesList();
        this.updateStats();
        this.saveToLocalStorage();
        
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    }
    
    clearTempMarkers() {
        this.tempMarkers.forEach(m => this.map.removeLayer(m.marker));
        this.tempMarkers = [];
        
        if (this.currentPolygon) {
            this.map.removeLayer(this.currentPolygon);
            this.currentPolygon = null;
        }
    }
    
    // ================================
    // CÁLCULOS GEOMÉTRICOS
    // ================================
    
    calculateDistance(coords) {
        let distance = 0;
        for (let i = 0; i < coords.length - 1; i++) {
            const from = L.latLng(coords[i]);
            const to = L.latLng(coords[i + 1]);
            distance += from.distanceTo(to);
        }
        return distance;
    }
    
    calculateArea(coords) {
        const polygon = L.polygon(coords);
        const area = L.GeometryUtil.geodesicArea(polygon.getLatLngs()[0]);
        return area;
    }
    
    // ================================
    // CARGA DE ARCHIVOS
    // ================================
    
    async handleFileUpload(file) {
        this.showLoading(true);
        
        try {
            const fileName = file.name.toLowerCase();
            
            if (fileName.endsWith('.geojson') || fileName.endsWith('.json')) {
                await this.loadGeoJSON(file);
            } else if (fileName.endsWith('.kml')) {
                await this.loadKML(file);
            } else if (fileName.endsWith('.zip')) {
                await this.loadShapefile(file);
            } else if (fileName.endsWith('.mbtiles')) {
                await this.loadMBTiles(file);
            } else {
                throw new Error('Formato no soportado. Use: GeoJSON, KML, Shapefile (ZIP) o MBTiles');
            }
        } catch (error) {
            console.error('Error cargando archivo:', error);
            alert('Error al cargar el archivo: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }
    
    async loadGeoJSON(file) {
        const text = await file.text();
        const geojson = JSON.parse(text);
        
        const layer = L.geoJSON(geojson, {
            style: () => ({
                color: '#' + Math.floor(Math.random()*16777215).toString(16),
                weight: 2,
                fillOpacity: 0.4
            }),
            onEachFeature: (feature, layer) => {
                if (feature.properties) {
                    let popupContent = '<div style="max-height:200px;overflow:auto;">';
                    for (let key in feature.properties) {
                        popupContent += `<b>${key}:</b> ${feature.properties[key]}<br>`;
                    }
                    popupContent += '</div>';
                    layer.bindPopup(popupContent);
                }
            }
        }).addTo(this.map);
        
        this.addLayer({
            name: file.name,
            type: 'geojson',
            layer: layer,
            visible: true
        });
        
        this.map.fitBounds(layer.getBounds());
    }
    
	
    async loadKML(file) {
    // ✅ Verificación agregada
    if (typeof toGeoJSON === 'undefined') {
        throw new Error('La librería toGeoJSON no está cargada. Recarga la página.');
    }
    
    const text = await file.text();
    const parser = new DOMParser();
    const kml = parser.parseFromString(text, 'text/xml');
    
    // ✅ Validación de XML
    const parseError = kml.querySelector('parsererror');
    if (parseError) {
        throw new Error('El archivo KML tiene errores de formato');
    }
    
    const geojson = toGeoJSON.kml(kml);
    // ... resto del código
        
        const layer = L.geoJSON(geojson, {
            style: () => ({
                color: '#' + Math.floor(Math.random()*16777215).toString(16),
                weight: 2,
                fillOpacity: 0.4
            }),
            onEachFeature: (feature, layer) => {
                if (feature.properties && feature.properties.name) {
                    layer.bindPopup(`<b>${feature.properties.name}</b>`);
                }
            }
        }).addTo(this.map);
        
        this.addLayer({
            name: file.name,
            type: 'kml',
            layer: layer,
            visible: true
        });
        
        this.map.fitBounds(layer.getBounds());
    }
    
    async loadShapefile(file) {
        const arrayBuffer = await file.arrayBuffer();
        const geojson = await shp(arrayBuffer);
        
        const layer = L.geoJSON(geojson, {
            style: () => ({
                color: '#' + Math.floor(Math.random()*16777215).toString(16),
                weight: 2,
                fillOpacity: 0.4
            }),
            onEachFeature: (feature, layer) => {
                if (feature.properties) {
                    let popupContent = '<div style="max-height:200px;overflow:auto;">';
                    for (let key in feature.properties) {
                        popupContent += `<b>${key}:</b> ${feature.properties[key]}<br>`;
                    }
                    popupContent += '</div>';
                    layer.bindPopup(popupContent);
                }
            }
        }).addTo(this.map);
        
        this.addLayer({
            name: file.name,
            type: 'shapefile',
            layer: layer,
            visible: true
        });
        
        this.map.fitBounds(layer.getBounds());
    }
    
    async loadMBTiles(file) {
        try {
            // Cargar SQL.js si no está disponible
            if (typeof initSqlJs === 'undefined') {
                throw new Error('SQL.js no está cargado. Agregue el script a su HTML.');
            }
            
            const SQL = await initSqlJs({
                locateFile: filename => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${filename}`
            });
            
            // Leer el archivo MBTiles
            const arrayBuffer = await file.arrayBuffer();
            const db = new SQL.Database(new Uint8Array(arrayBuffer));
            
            // Obtener metadatos
            const metadata = {};
            const metadataRows = db.exec("SELECT name, value FROM metadata");
            if (metadataRows.length > 0) {
                metadataRows[0].values.forEach(([name, value]) => {
                    metadata[name] = value;
                });
            }
            
            // Obtener el rango de zoom y bounds
            const boundsResult = db.exec("SELECT MIN(zoom_level) as minzoom, MAX(zoom_level) as maxzoom FROM tiles");
            const minZoom = boundsResult[0]?.values[0]?.[0] || 0;
            const maxZoom = boundsResult[0]?.values[0]?.[1] || 18;
            
            // Crear capa de teselas MBTiles
            const mbtilesLayer = L.tileLayer('', {
                minZoom: minZoom,
                maxZoom: maxZoom,
                tms: true, // MBTiles usa TMS (y invertido)
                attribution: metadata.attribution || 'MBTiles'
            });
            
            // Override del método getTileUrl para cargar desde la base de datos
            mbtilesLayer.getTileUrl = function(coords) {
                const z = coords.z;
                const x = coords.x;
                // TMS: invertir Y
                const y = (Math.pow(2, z) - 1) - coords.y;
                
                try {
                    const result = db.exec(
                        "SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?",
                        [z, x, y]
                    );
                    
                    if (result.length > 0 && result[0].values.length > 0) {
                        const tileData = result[0].values[0][0];
                        // Convertir blob a base64 data URL
                        const base64 = btoa(
                            new Uint8Array(tileData).reduce((data, byte) => data + String.fromCharCode(byte), '')
                        );
                        
                        // Detectar tipo de imagen (PNG o JPG)
                        const isPNG = tileData[0] === 0x89 && tileData[1] === 0x50;
                        const mimeType = isPNG ? 'image/png' : 'image/jpeg';
                        
                        return `data:${mimeType};base64,${base64}`;
                    }
                } catch (e) {
                    console.error('Error loading tile:', e);
                }
                
                // Retornar tile transparente si no existe
                return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIAAAUAAeImBZsAAAAASUVORK5CYII=';
            };
            
            mbtilesLayer.addTo(this.map);
            
            this.addLayer({
                name: file.name,
                type: 'mbtiles',
                layer: mbtilesLayer,
                visible: true,
                metadata: metadata,
                database: db // Guardar referencia a la base de datos
            });
            
            // Intentar hacer zoom a los bounds si están disponibles
            if (metadata.bounds) {
                const bounds = metadata.bounds.split(',').map(parseFloat);
                this.map.fitBounds([
                    [bounds[1], bounds[0]], // SW
                    [bounds[3], bounds[2]]  // NE
                ]);
            }
            
            console.log('MBTiles cargado:', metadata);
            
        } catch (error) {
            console.error('Error cargando MBTiles:', error);
            throw new Error('No se pudo cargar el archivo MBTiles: ' + error.message);
        }
    }
    
    // ================================
    // GESTIÓN DE CAPAS
    // ================================
    
    addLayer(layerData) {
        const id = Date.now();
        this.layers.push({ id, ...layerData });
        this.updateLayersList();
        this.updateStats();
    }
    
    removeLayer(id) {
        const layer = this.layers.find(l => l.id === id);
        if (layer) {
            this.map.removeLayer(layer.layer);
            this.layers = this.layers.filter(l => l.id !== id);
            this.updateLayersList();
            this.updateStats();
        }
    }
    
    toggleLayerVisibility(id) {
        const layer = this.layers.find(l => l.id === id);
        if (layer) {
            if (layer.visible) {
                this.map.removeLayer(layer.layer);
                layer.visible = false;
            } else {
                this.map.addLayer(layer.layer);
                layer.visible = true;
            }
            this.updateLayersList();
        }
    }
    
    zoomToLayer(id) {
        const layer = this.layers.find(l => l.id === id);
        if (layer && layer.layer.getBounds) {
            this.map.fitBounds(layer.layer.getBounds());
        }
    }
    
    updateLayersList() {
        const list = document.getElementById('layer-list');
        const count = document.getElementById('layer-count');
        const indicator = document.getElementById('layer-indicator');
        
        count.textContent = this.layers.length;
        indicator.querySelector('.status-text').textContent = `${this.layers.length} Capas`;
        
        if (this.layers.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                        <polygon points="12 2 2 7 12 12 22 7 12 2" opacity="0.3"/>
                    </svg>
                    <p>Sin capas cargadas</p>
                </div>
            `;
            return;
        }
        
        list.innerHTML = this.layers.map(layer => `
            <div class="layer-item">
                <div class="layer-icon">🗺️</div>
                <div class="layer-info">
                    <div class="layer-name">${layer.name}</div>
                    <div class="layer-meta">${layer.type.toUpperCase()}</div>
                </div>
                <div class="layer-actions">
                    <button class="layer-btn" onclick="app.toggleLayerVisibility(${layer.id})" title="Mostrar/Ocultar">
                        ${layer.visible ? '👁️' : '👁️‍🗨️'}
                    </button>
                    <button class="layer-btn" onclick="app.zoomToLayer(${layer.id})" title="Zoom">
                        🔍
                    </button>
                    <button class="layer-btn" onclick="app.removeLayer(${layer.id})" title="Eliminar">
                        🗑️
                    </button>
                </div>
            </div>
        `).join('');
    }
    
    updateCapturesList() {
        const list = document.getElementById('capture-list');
        const count = document.getElementById('capture-count');
        
        count.textContent = this.captures.length;
        
        if (this.captures.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" opacity="0.3"/>
                    </svg>
                    <p>Sin capturas</p>
                </div>
            `;
            return;
        }
        
        list.innerHTML = this.captures.map(capture => {
            const icon = {
                point: '📍',
                line: '📏',
                polygon: '🗺️'
            }[capture.type] || '📌';
            
            let info = '';
            if (capture.distance) info = `${(capture.distance / 1000).toFixed(2)} km`;
            if (capture.area) info = `${(capture.area / 10000).toFixed(2)} ha`;
            
            return `
                <div class="layer-item">
                    <div class="layer-icon">${icon}</div>
                    <div class="layer-info">
                        <div class="layer-name">${capture.name}</div>
                        <div class="layer-meta">${capture.type.toUpperCase()} ${info}</div>
                    </div>
                    <div class="layer-actions">
                        <button class="layer-btn" onclick="app.zoomToCapture(${capture.id})" title="Zoom">
                            🔍
                        </button>
                        <button class="layer-btn" onclick="app.removeCapture(${capture.id})" title="Eliminar">
                            🗑️
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    zoomToCapture(id) {
        const capture = this.captures.find(c => c.id === id);
        if (!capture) return;
        
        if (capture.type === 'point') {
            this.map.setView(capture.coordinates, 16);
        } else if (capture.layer && capture.layer.getBounds) {
            this.map.fitBounds(capture.layer.getBounds());
        }
    }
    
    removeCapture(id) {
        const capture = this.captures.find(c => c.id === id);
        if (capture && capture.layer) {
            this.map.removeLayer(capture.layer);
        }
        
        this.captures = this.captures.filter(c => c.id !== id);
        this.updateCapturesList();
        this.updateStats();
        this.saveToLocalStorage();
    }
    
    // ================================
    // ESTADÍSTICAS
    // ================================
    
    updateStats() {
        const points = this.captures.filter(c => c.type === 'point').length;
        const totalDistance = this.captures
            .filter(c => c.distance)
            .reduce((sum, c) => sum + c.distance, 0);
        const totalArea = this.captures
            .filter(c => c.area)
            .reduce((sum, c) => sum + c.area, 0);
        
        document.getElementById('stat-points').textContent = points;
        document.getElementById('stat-distance').textContent = 
            `${(totalDistance / 1000).toFixed(2)} km`;
        document.getElementById('stat-area').textContent = 
            `${(totalArea / 10000).toFixed(2)} ha`;
        
        // Calcular tiempo GPS
        if (this.gpsTrack.length > 0) {
            const first = new Date(this.gpsTrack[0].timestamp);
            const last = new Date(this.gpsTrack[this.gpsTrack.length - 1].timestamp);
            const hours = (last - first) / (1000 * 60 * 60);
            document.getElementById('stat-time').textContent = `${hours.toFixed(1)}h`;
        }
    }
    
    // ================================
    // EXPORTACIÓN
    // ================================
    
    exportData() {
        if (this.captures.length === 0) {
            alert('No hay datos para exportar');
            return;
        }
        
        const format = prompt('Formato de exportación:\n1. CSV\n2. GeoJSON\n3. KML\n\nEscribe el número:');
        
        switch (format) {
            case '1':
                this.exportCSV();
                break;
            case '2':
                this.exportGeoJSON();
                break;
            case '3':
                this.exportKML();
                break;
            default:
                alert('Formato no válido');
        }
    }
    
    exportCSV() {
        let csv = 'Tipo,Nombre,Descripción,Latitud,Longitud,Distancia(m),Área(m²),Fecha\n';
        
        this.captures.forEach(capture => {
            const coords = capture.type === 'point' 
                ? [capture.coordinates]
                : capture.coordinates;
            
            coords.forEach((coord, i) => {
                csv += `${capture.type},`;
                csv += `${capture.name},`;
                csv += `${capture.description || ''},`;
                csv += `${coord[0]},`;
                csv += `${coord[1]},`;
                csv += `${capture.distance || ''},`;
                csv += `${capture.area || ''},`;
                csv += `${capture.timestamp}\n`;
            });
        });
        
        this.downloadFile(csv, 'geotool_export.csv', 'text/csv');
    }
    
    exportGeoJSON() {
        const features = this.captures.map(capture => {
            let geometry;
            
            if (capture.type === 'point') {
                geometry = {
                    type: 'Point',
                    coordinates: [capture.coordinates[1], capture.coordinates[0]]
                };
            } else if (capture.type === 'line') {
                geometry = {
                    type: 'LineString',
                    coordinates: capture.coordinates.map(c => [c[1], c[0]])
                };
            } else {
                geometry = {
                    type: 'Polygon',
                    coordinates: [capture.coordinates.map(c => [c[1], c[0]])]
                };
            }
            
            return {
                type: 'Feature',
                properties: {
                    name: capture.name,
                    description: capture.description,
                    type: capture.type,
                    distance: capture.distance,
                    area: capture.area,
                    timestamp: capture.timestamp
                },
                geometry
            };
        });
        
        const geojson = {
            type: 'FeatureCollection',
            features
        };
        
        this.downloadFile(
            JSON.stringify(geojson, null, 2),
            'geotool_export.geojson',
            'application/json'
        );
    }
    
    exportKML() {
        let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
    <name>GeoTool Export</name>
`;
        
        this.captures.forEach(capture => {
            kml += `    <Placemark>
        <name>${capture.name}</name>
        <description>${capture.description || ''}</description>
`;
            
            if (capture.type === 'point') {
                kml += `        <Point>
            <coordinates>${capture.coordinates[1]},${capture.coordinates[0]},0</coordinates>
        </Point>
`;
            } else if (capture.type === 'line') {
                kml += `        <LineString>
            <coordinates>
`;
                capture.coordinates.forEach(c => {
                    kml += `                ${c[1]},${c[0]},0\n`;
                });
                kml += `            </coordinates>
        </LineString>
`;
            } else {
                kml += `        <Polygon>
            <outerBoundaryIs>
                <LinearRing>
                    <coordinates>
`;
                capture.coordinates.forEach(c => {
                    kml += `                        ${c[1]},${c[0]},0\n`;
                });
                kml += `                    </coordinates>
                </LinearRing>
            </outerBoundaryIs>
        </Polygon>
`;
            }
            
            kml += `    </Placemark>
`;
        });
        
        kml += `</Document>
</kml>`;
        
        this.downloadFile(kml, 'geotool_export.kml', 'application/vnd.google-earth.kml+xml');
    }
    
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    // ================================
    // PERSISTENCIA
    // ================================
    
    saveToLocalStorage() {
        const data = {
            captures: this.captures.map(c => ({
                ...c,
                layer: null // No guardar objetos Leaflet
            })),
            gpsTrack: this.gpsTrack
        };
        
        try {
            localStorage.setItem('geotool_data', JSON.stringify(data));
        } catch (e) {
            console.error('Error guardando en localStorage:', e);
        }
    }
    
    loadFromLocalStorage() {
        try {
            const data = JSON.parse(localStorage.getItem('geotool_data'));
            if (data) {
                // Restaurar capturas (sin capas de Leaflet)
                if (data.gpsTrack) {
                    this.gpsTrack = data.gpsTrack;
                }
                
                this.updateStats();
            }
        } catch (e) {
            console.error('Error cargando desde localStorage:', e);
        }
    }
    
    clearAllData() {
        if (!confirm('¿Eliminar todos los datos? Esta acción no se puede deshacer.')) {
            return;
        }
        
        // Limpiar capas
        this.layers.forEach(layer => {
            if (layer.layer) this.map.removeLayer(layer.layer);
        });
        this.layers = [];
        
        // Limpiar capturas
        this.captures.forEach(capture => {
            if (capture.layer) this.map.removeLayer(capture.layer);
        });
        this.captures = [];
        
        // Limpiar GPS
        this.gpsTrack = [];
        if (this.userMarker) {
            this.map.removeLayer(this.userMarker);
            this.userMarker = null;
        }
        if (this.accuracyCircle) {
            this.map.removeLayer(this.accuracyCircle);
            this.accuracyCircle = null;
        }
        
        localStorage.removeItem('geotool_data');
        
        this.updateLayersList();
        this.updateCapturesList();
        this.updateStats();
    }
    
    // ================================
    // UI
    // ================================
    
    toggleSidePanel() {
        document.getElementById('side-panel').classList.toggle('hidden');
    }
    
    toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        const newTheme = current === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    }
    
    showLoading(show) {
        const overlay = document.getElementById('loading-overlay');
        if (show) {
            overlay.classList.add('active');
        } else {
            overlay.classList.remove('active');
        }
    }
    
    setupEventListeners() {
        // Tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                
                btn.classList.add('active');
                document.getElementById(`tab-${tab}`).classList.add('active');
            });
        });
        
        // GPS
        document.getElementById('gps-toggle').addEventListener('click', () => {
            this.toggleGPS();
        });
        
        // Basemaps
        document.querySelectorAll('.basemap-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchBasemap(btn.dataset.basemap);
            });
        });
        
        // Tools
        document.getElementById('tool-point').addEventListener('click', () => {
            this.setCaptureTool('point');
        });
        
        document.getElementById('tool-line').addEventListener('click', () => {
            this.setCaptureTool('line');
        });
        
        document.getElementById('tool-polygon').addEventListener('click', () => {
            this.setCaptureTool('polygon');
        });
        
        document.getElementById('tool-area').addEventListener('click', () => {
            this.setCaptureTool('area');
        });
        
        // File Upload
        const fileInput = document.getElementById('file-input');
        const uploadZone = document.getElementById('upload-zone');
        
        document.getElementById('browse-btn').addEventListener('click', () => {
            fileInput.click();
        });
        
        fileInput.addEventListener('change', (e) => {
            Array.from(e.target.files).forEach(file => {
                this.handleFileUpload(file);
            });
        });
        
        // Drag & Drop
        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('drag-over');
        });
        
        uploadZone.addEventListener('dragleave', () => {
            uploadZone.classList.remove('drag-over');
        });
        
        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('drag-over');
            
            Array.from(e.dataTransfer.files).forEach(file => {
                this.handleFileUpload(file);
            });
        });
        
        // Export
        document.getElementById('export-captures').addEventListener('click', () => {
            this.exportData();
        });
        
        // Clear
        document.getElementById('clear-all').addEventListener('click', () => {
            this.clearAllData();
        });
        
        // Menu Toggle
        document.getElementById('menu-toggle').addEventListener('click', () => {
            this.toggleSidePanel();
        });
        
        // Theme Toggle
        document.getElementById('theme-toggle').addEventListener('click', () => {
            this.toggleTheme();
        });
        
        // Cargar tema guardado
        const savedTheme = localStorage.getItem('theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
    }
}

// Función auxiliar para cálculo de área (Leaflet GeometryUtil simplificado)
if (!L.GeometryUtil) {
    L.GeometryUtil = {
        geodesicArea: function(latLngs) {
            let area = 0;
            const len = latLngs.length;
            
            if (len < 3) return 0;
            
            for (let i = 0; i < len; i++) {
                const j = (i + 1) % len;
                const xi = latLngs[i].lng * Math.PI / 180;
                const yi = latLngs[i].lat * Math.PI / 180;
                const xj = latLngs[j].lng * Math.PI / 180;
                const yj = latLngs[j].lat * Math.PI / 180;
                
                area += (xj - xi) * (2 + Math.sin(yi) + Math.sin(yj));
            }
            
            area = Math.abs(area * 6378137 * 6378137 / 2);
            return area;
        }
    };
}

// Inicializar aplicación
const app = new GeoToolApp();

// Service Worker para PWA
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => {
        console.log('Service Worker registration failed:', err);
    });
}
