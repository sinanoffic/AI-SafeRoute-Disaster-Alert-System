// ===========================
// AI SafeRoute V2 – Main App Logic
// ===========================

// ---- State ----
const AppState = {
    currentPage: 'dashboard',
    riskLevel: 'safe',
    rainfall: 0,
    alerts: [
        { id: 1, type: 'info', icon: 'fa-info-circle', title: 'System Intelligence Activated', desc: 'AI SafeRoute V2 monitoring active. Dynamic risk engine online.', time: 'Just now' }
    ],
    sosRequests: [],
    sosActive: false,
    userLocation: [12.9716, 77.5946], // Bangalore default
    map: null,
    routeLayers: [],
    userMarker: null,
    zoneLayers: [],       // Leaflet circle layers for risk zones
    shelterMarkers: [],   // Leaflet markers for shelters
    computedZones: [],    // Latest risk engine output
    maxRiskScore: 0,
    zoneCounts: { danger: 0, warning: 0, safe: 0 },
    activeShelterId: null, // Currently routed shelter ID
    routeExplanation: '',
    shelterFilter: 'All',  // Default filter
    timeHorizon: 0,        // V3: Future prediction window (0-6 hours)
    moisture: 0.5,         // MCFRI-V2: Soil Moisture (0-1)
    drainage: 0.5,         // MCFRI-V2: Drainage Quality (0-1, 0=poor, 1=excellent)
    permeability: 0.5,     // MCFRI-V2: Land Permeability (0-1, 0=impervious, 1=permeable)
    handExposure: 0.5,     // MCFRI-V2: Topographic Exposure (0-1, 0=exposed, 1=safe)
    previousRainfall: 0,   // For ΔR/Δt calculation
};

// ---- Shelter Database ----
// ---- Shelter Database ----
const shelters = [
    { id: 1, name: 'Government High School', type: 'School',         lat: 12.9780, lng: 77.5900, capacity: 200 },
    { id: 2, name: 'City Community Hall',    type: 'Hall',           lat: 12.9650, lng: 77.6010, capacity: 350 },
    { id: 3, name: 'District General Hospital', type: 'Hospital',    lat: 12.9690, lng: 77.5850, capacity: 800 },
    { id: 4, name: 'Public Library Center',  type: 'Public',         lat: 12.9750, lng: 77.6050, capacity: 120 },
    { id: 5, name: 'Municipal Sports Complex', type: 'Hall',         lat: 12.9820, lng: 77.5980, capacity: 600 },
    { id: 6, name: 'St. Mary’s College',     type: 'School',         lat: 12.9850, lng: 77.5880, capacity: 450 },
    { id: 7, name: 'Metro Health Center',    type: 'Hospital',       lat: 12.9580, lng: 77.5950, capacity: 150 },
    { id: 8, name: 'Heritage Town Hall',     type: 'Hall',           lat: 12.9720, lng: 77.6150, capacity: 500 },
    { id: 9, name: 'State Primary School',   type: 'School',         lat: 12.9920, lng: 77.6020, capacity: 180 },
    { id: 10, name: 'Civic Plaza Hall',      type: 'Hall',           lat: 12.9620, lng: 77.5750, capacity: 400 },
    { id: 11, name: 'Central Hospital (ER)', type: 'Hospital',       lat: 12.9890, lng: 77.5780, capacity: 900 },
    { id: 12, name: 'Unity Hall Center',     type: 'Hall',           lat: 12.9750, lng: 77.5700, capacity: 250 },
];


// ===========================
// NAVIGATION / ROUTING
// ===========================
function navigateTo(pageId) {
    document.querySelectorAll('.page').forEach(p => {
        p.classList.remove('active');
        p.classList.add('hidden');
    });

    const target = document.getElementById('page-' + pageId);
    if (target) {
        target.classList.remove('hidden');
        requestAnimationFrame(() => target.classList.add('active'));
    }

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navItem = document.querySelector(`.nav-item[data-target="${pageId}"]`);
    if (navItem) navItem.classList.add('active');

    AppState.currentPage = pageId;

    if (pageId === 'map') {
        initMap();
    }

    document.getElementById('main-content').scrollTop = 0;
}

document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
        e.preventDefault();
        navigateTo(item.dataset.target);
    });
});


// ===========================
// LEAFLET MAP (V2 – Dynamic Layers)
// ===========================
let mapInitialized = false;

function initMap() {
    if (mapInitialized) {
        AppState.map.invalidateSize();
        return;
    }

    const map = L.map('risk-map', { zoomControl: false })
        .setView(AppState.userLocation, 14);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
    }).addTo(map);

    // User marker
    const userIcon = L.divIcon({
        className: 'user-marker-icon',
        html: '<div class="user-marker-dot"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
    });
    AppState.userMarker = L.marker(AppState.userLocation, { icon: userIcon }).addTo(map);
    AppState.userMarker.bindPopup('<b>You are here</b>').openPopup();

    // Shelter markers
    shelters.forEach(s => {
        const dist = RoutingEngine.haversine(AppState.userLocation, [s.lat, s.lng]);
        const distStr = dist < 1000 ? `${Math.round(dist)}m` : `${(dist / 1000).toFixed(1)}km`;
        const shelterIcon = L.divIcon({
            className: 'shelter-marker-icon',
            html: '<div class="shelter-marker-dot"></div>',
            iconSize: [14, 14],
            iconAnchor: [7, 7],
        });
        const marker = L.marker([s.lat, s.lng], { icon: shelterIcon })
            .addTo(map)
            .bindPopup(`<b>${s.name}</b><br>${s.type}<br>Capacity: ${s.capacity}<br>Distance: ${distStr}`);
        AppState.shelterMarkers.push(marker);
    });

    L.control.zoom({ position: 'topright' }).addTo(map);
    AppState.map = map;
    mapInitialized = true;

    // Draw initial zones
    if (AppState.computedZones.length > 0) {
        updateMapZones(AppState.computedZones);
    }
}

/**
 * Update map zone circles dynamically (no full re-init).
 */
function updateMapZones(zones) {
    if (!AppState.map) return;

    // Remove old zone layers
    AppState.zoneLayers.forEach(l => AppState.map.removeLayer(l));
    AppState.zoneLayers = [];

    zones.forEach(zone => {
        // --- Layer 2 (behind): Future prediction ring ---
        if (zone.futureRadius && zone.futureRadius > zone.dynamicRadius && AppState.timeHorizon > 0) {
            const futureRing = L.circle(zone.center, {
                radius: zone.futureRadius,
                color: zone.futureColor || zone.color,
                fillColor: zone.futureFillColor || zone.fillColor,
                fillOpacity: zone.futureFillOpacity || 0.08,
                weight: 2,
                dashArray: '6, 8',
                className: 'zone-future-ring',
            }).addTo(AppState.map);
            AppState.zoneLayers.push(futureRing);
        }

        // --- Layer 1 (front): Current risk circle ---
        const circle = L.circle(zone.center, {
            radius: zone.dynamicRadius,
            color: zone.color,
            fillColor: zone.fillColor,
            fillOpacity: zone.fillOpacity,
            weight: 2,
            className: zone.level === 'danger' ? 'zone-pulse' : '',
        }).addTo(AppState.map);

        // V3: Enhanced popup with current + future prediction
        const spilloverInfo = zone.spilloverReceived ? `<br>Spillover: +${zone.spilloverReceived}` : '';
        const futureInfo = (zone.futureRiskScore && AppState.timeHorizon > 0)
            ? `<br><b>Predicted (${AppState.timeHorizon}h):</b> ${zone.futureRiskScore} (${zone.futureLevel.toUpperCase()})`
            : '';
        circle.bindPopup(
            `<b>${zone.label}</b><br>Risk: ${zone.level.toUpperCase()}<br>Score: ${zone.riskScore}${spilloverInfo}${futureInfo}`
        );

        AppState.zoneLayers.push(circle);
    });

    // Update legend counts
    updateLegendInfo(zones);
}

/**
 * Update legend with live counts.
 */
function updateLegendInfo(zones) {
    const counts = RiskEngine.getZoneCounts(zones);
    const el = document.getElementById('legend-counts');
    if (el) {
        el.innerHTML = `<span class="legend-live">Score: ${AppState.maxRiskScore} | D:${counts.danger} W:${counts.warning} S:${counts.safe}</span>`;
    }
}


// ===========================
// RISK SIMULATOR (V2 – Triggers StateManager)
// ===========================
const rainfallSlider = document.getElementById('rainfall-slider');
const rainfallVal = document.getElementById('rainfall-val');
const flashFloodVal = document.getElementById('flash-flood-val');

rainfallSlider.addEventListener('input', () => {
    const val = parseInt(rainfallSlider.value);
    AppState.previousRainfall = AppState.rainfall;
    AppState.rainfall = val;
    rainfallVal.textContent = val;
    
    const deltaR = AppState.rainfall - AppState.previousRainfall;
    if (flashFloodVal) flashFloodVal.textContent = deltaR > 0 ? `+${deltaR}` : deltaR;

    StateManager.updateSystemState();
});

// MCFRI: Moisture Slider
const moistureSlider = document.getElementById('moisture-slider');
const moistureVal = document.getElementById('moisture-val');
if (moistureSlider) {
    moistureSlider.addEventListener('input', () => {
        const val = parseFloat(moistureSlider.value);
        AppState.moisture = val;
        moistureVal.textContent = val;
        StateManager.updateSystemState();
    });
}

// MCFRI-V2: Drainage Slider (0-1)
const drainageSlider = document.getElementById('drainage-slider');
const drainageVal = document.getElementById('drainage-val');
if (drainageSlider) {
    drainageSlider.addEventListener('input', () => {
        const val = parseFloat(drainageSlider.value);
        AppState.drainage = val;
        drainageVal.textContent = val;
        StateManager.updateSystemState();
    });
}

// MCFRI-V2: Topographic Exposure (HAND) Slider (0-1) — NEW
const handSlider = document.getElementById('hand-slider');
const handVal = document.getElementById('hand-val');
if (handSlider) {
    handSlider.addEventListener('input', () => {
        const val = parseFloat(handSlider.value);
        AppState.handExposure = val;
        handVal.textContent = val;
        StateManager.updateSystemState();
    });
}

// MCFRI-V2: Permeability Slider (0-1)
const permeabilitySlider = document.getElementById('permeability-slider');
const permeabilityVal = document.getElementById('permeability-val');
if (permeabilitySlider) {
    permeabilitySlider.addEventListener('input', () => {
        const val = parseFloat(permeabilitySlider.value);
        AppState.permeability = val;
        permeabilityVal.textContent = val;
        StateManager.updateSystemState();
    });
}

// V2: Toggle Risk Breakdown panel
function toggleBreakdown() {
    const panel = document.getElementById('breakdown-panel');
    const chevron = document.getElementById('breakdown-chevron');
    if (panel) {
        panel.classList.toggle('hidden');
        if (chevron) {
            chevron.style.transform = panel.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
        }
    }
}

// V3: Time Horizon Slider
const timeHorizonSlider = document.getElementById('time-horizon-slider');
const timeHorizonVal = document.getElementById('time-horizon-val');

timeHorizonSlider.addEventListener('input', () => {
    const val = parseInt(timeHorizonSlider.value);
    AppState.timeHorizon = val;
    timeHorizonVal.textContent = val;
    StateManager.updateSystemState();
});


// ===========================
// RISK LEVEL / DASHBOARD STATUS
// ===========================
function setRiskLevel(level) {
    const prev = AppState.riskLevel;
    AppState.riskLevel = level;

    const card = document.getElementById('overall-status-card');
    const icon = document.getElementById('status-icon-el');
    const text = document.getElementById('status-text');
    const desc = document.getElementById('status-desc');

    card.className = 'status-card ' + level;

    if (level === 'danger') {
        icon.className = 'fa-solid fa-triangle-exclamation';
        text.textContent = 'High Risk Alert';
        desc.textContent = 'Flood risk detected. Move to higher ground immediately.';
        if (prev !== 'danger') {
            addAlert('danger', 'fa-triangle-exclamation', 'Flood Risk Detected',
                `Risk score ${AppState.maxRiskScore} – Evacuate to nearest shelter.`);
            showToast('danger', 'Flood Risk Detected!',
                'Flood risk detected near your location. Move to higher ground.');
        }
    } else if (level === 'warning') {
        icon.className = 'fa-solid fa-exclamation-circle';
        text.textContent = 'Warning Active';
        desc.textContent = 'Moderate conditions. Stay alert and prepare for possible evacuation.';
        if (prev === 'safe') {
            addAlert('warning', 'fa-exclamation-circle', 'Weather Warning',
                `Risk score rising (${AppState.maxRiskScore}). Monitor conditions.`);
        }
    } else {
        icon.className = 'fa-solid fa-shield-check';
        text.textContent = 'Area is Safe';
        desc.textContent = 'No immediate threats detected in your vicinity.';
    }
}


// ===========================
// ALERT SYSTEM
// ===========================
function addAlert(type, icon, title, desc) {
    const alert = {
        id: Date.now(),
        type,
        icon,
        title,
        desc,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    AppState.alerts.unshift(alert);
    renderAlerts();
}

function renderAlerts() {
    const miniList = document.getElementById('dashboard-recent-alerts');
    miniList.innerHTML = AppState.alerts.slice(0, 3).map(a => `
        <li class="alert-item ${a.type}">
            <i class="fa-solid ${a.icon}"></i>
            <div class="alert-content">
                <h4>${a.title}</h4>
                <p>${a.desc || ''}</p>
                <span class="time">${a.time}</span>
            </div>
        </li>
    `).join('');

    const fullList = document.getElementById('full-alerts-list');
    fullList.innerHTML = AppState.alerts.map(a => `
        <li class="alert-item ${a.type}">
            <i class="fa-solid ${a.icon}"></i>
            <div class="alert-content">
                <h4>${a.title}</h4>
                <p>${a.desc || ''}</p>
                <span class="time">${a.time}</span>
            </div>
        </li>
    `).join('');
}

// Toast Notifications (V2 - Prevent Spam)
const activeToasts = new Map();

function showToast(type, title, message, uniqueId = null) {
    // If a toast with this uniqueId is already active, don't spam it
    if (uniqueId && activeToasts.has(uniqueId)) {
        const existing = activeToasts.get(uniqueId);
        // Just update the timer/content if it's already there
        clearTimeout(existing.timeout);
        existing.timeout = setTimeout(() => {
            existing.el.style.animation = 'fadeOut 0.3s forwards';
            setTimeout(() => {
                existing.el.remove();
                activeToasts.delete(uniqueId);
            }, 300);
        }, 3000);
        return;
    }

    const container = document.getElementById('toast-container');
    
    // Limit to 3 toasts at most (V2 - Organized UI)
    if (container.children.length >= 3) {
        const oldest = container.children[0];
        oldest.style.animation = 'fadeOut 0.3s forwards';
        setTimeout(() => oldest.remove(), 300);
    }

    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    const iconClass = type === 'danger' ? 'fa-triangle-exclamation' : 'fa-circle-check';
    toast.innerHTML = `
        <i class="fa-solid ${iconClass}"></i>
        <div class="toast-content">
            <h4>${title}</h4>
            <p>${message}</p>
        </div>
    `;
    container.appendChild(toast);

    const timeout = setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s forwards';
        setTimeout(() => {
            toast.remove();
            if (uniqueId) activeToasts.delete(uniqueId);
        }, 300);
    }, 5000);

    if (uniqueId) {
        activeToasts.set(uniqueId, { el: toast, timeout });
    }
}


// ===========================
// SHELTER LIST (V2 – Live Distance)
// ===========================
// ---- Shelter Rendering & Filtering ----
function filterShelters(type) {
    AppState.shelterFilter = type;
    
    // UI: Update active chip
    document.querySelectorAll('.filter-chip').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.toLowerCase() === type.toLowerCase() || (type === 'All' && btn.textContent === 'All'));
    });

    renderShelters();
}

function renderShelters() {
    const list = document.getElementById('shelter-list-ul');
    if (!list) return;
    list.innerHTML = '';

    // Calculate distances and find nearest
    const sheltersWithDist = shelters.map(s => ({
        ...s,
        dist: RoutingEngine.haversine(AppState.userLocation, [s.lat, s.lng]) / 1000
    })).sort((a, b) => a.dist - b.dist);

    const nearestId = sheltersWithDist[0]?.id;

    // Apply Filter
    const filtered = AppState.shelterFilter === 'All' 
        ? sheltersWithDist 
        : sheltersWithDist.filter(s => s.type.toLowerCase().includes(AppState.shelterFilter.toLowerCase()));

    // Find the nearest among the FILTERED set for tab-specific recommendations
    const nearestInFilteredId = filtered[0]?.id;

    filtered.forEach(s => {
        const isNearest = s.id === nearestInFilteredId;
        const iconMap = {
            'School': 'fa-school',
            'Hospital': 'fa-hospital',
            'Hall': 'fa-city',
            'Public': 'fa-building'
        };
        const icon = iconMap[s.type] || 'fa-building-circle-check';

        const li = document.createElement('li');
        li.className = `shelter-card ${isNearest ? 'nearest' : ''}`;
        li.innerHTML = `
            <div class="shelter-info">
                <h3>${s.name}</h3>
                <p><i class="fa-solid ${icon}"></i> ${s.type} · Capacity: ${s.capacity}</p>
            </div>
            <div class="shelter-action">
                <span class="shelter-dist">${s.dist.toFixed(1)}km</span>
                <button class="route-btn" onclick="showSmartRoute(${s.id})">
                    <i class="fa-solid fa-route"></i> Route
                </button>
            </div>
        `;
        list.appendChild(li);
    });
}


// ===========================
// SMART ROUTE (V2 – Risk-Aware)
// ===========================
function showSmartRoute(shelterId) {
    AppState.activeShelterId = shelterId;
    navigateTo('map');

    // Parallelize: invalidate map size and start fetching immediately
    if (AppState.map) {
        AppState.map.invalidateSize();
    }
    recalculateActiveRoute(false);
}

async function recalculateActiveRoute(silent = true) {
    if (!AppState.map || AppState.activeShelterId === null) return;
    
    // Core fix: Map needs to know its now visible
    AppState.map.invalidateSize();

    // Clear old route layers
    AppState.routeLayers.forEach(l => AppState.map.removeLayer(l));
    AppState.routeLayers = [];

    const zones = AppState.computedZones.length > 0
        ? AppState.computedZones
        : RiskEngine.calculateZoneRisks(AppState.rainfall);

    // Call async road-based routing
    const routes = await RoutingEngine.findBestRoadRoutes(AppState.userLocation, shelters, zones);

    const targetRoute = routes.find(r => r.shelter.id === AppState.activeShelterId);
    if (!targetRoute) return;

    // Draw road-based color segments
    targetRoute.path.forEach((pt, idx) => {
        if (idx === 0) return;
        const prevPt = targetRoute.path[idx - 1];
        
        // Detect risk for the specific segment to color it
        const segRisk = targetRoute.segments[idx - 1]?.riskLevel || 'safe';
        
        const polyline = L.polyline([prevPt, pt], {
            color: RoutingEngine.segmentColor(segRisk),
            weight: 6, opacity: 0.9,
            dashArray: segRisk === 'danger' ? '1, 10' : null,
            lineCap: 'round', lineJoin: 'round'
        }).addTo(AppState.map);
        AppState.routeLayers.push(polyline);
    });

    // Fit bounds with snappy zoom (0.6s)
    AppState.map.flyToBounds(L.latLngBounds(targetRoute.path), { 
        padding: [80, 80], 
        duration: 0.6, 
        easeLinearity: 0.25 
    });

    // Minimal Guidance UI
    const typeInfo = RoutingEngine.routeTypeLabel(targetRoute.routeType);
    const explanation = RoutingEngine.routeExplanation(targetRoute);
    
    const infoCard = document.getElementById('route-info-card');
    const infoHeader = document.getElementById('route-info-header');
    const infoText = document.getElementById('route-info-text');

    if (infoCard) {
        infoCard.classList.remove('hidden');
        infoCard.style.borderLeftColor = typeInfo.color;
        if (infoHeader) {
            infoHeader.innerHTML = `
                <div style="display:flex; align-items:center; gap:8px;">
                    <i class="fa-solid ${typeInfo.icon}" style="color:${typeInfo.color}"></i>
                    <span>${typeInfo.text} (${targetRoute.distance}km, ${targetRoute.duration}m)</span>
                </div>`;
        }
        if (infoText) infoText.textContent = explanation;
    }

    // Hide debug panel as per 'minimal' request
    const debugPanel = document.getElementById('route-debug-panel');
    if (debugPanel) debugPanel.classList.add('hidden');

    if (!silent) {
        showToast(targetRoute.riskLevel === 'danger' ? 'danger' : 'success', 
                  'Road Path Calculated', 
                  `Safe navigation to ${targetRoute.shelter.name}`, 'route-toast');
    }
}


// ===========================
// SOS SYSTEM (V2 – Priority Intelligence)
// ===========================
const sosBtn = document.getElementById('sos-trigger-btn');
const sosStatusText = document.getElementById('sos-status-text');

sosBtn.addEventListener('click', () => {
    if (AppState.sosActive) {
        AppState.sosActive = false;
        sosBtn.classList.remove('active');
        sosBtn.innerHTML = '<span>SOS</span>';
        sosStatusText.textContent = 'Tap to send emergency signal';
        showToast('success', 'SOS Cancelled', 'Your emergency signal has been cancelled.');
        return;
    }

    AppState.sosActive = true;
    sosBtn.classList.add('active');
    sosBtn.innerHTML = '<i class="fa-solid fa-check" style="font-size:48px"></i>';
    sosStatusText.textContent = '🔴 Emergency signal sent! Help is on the way.';

    // V2: Create enriched SOS request
    const request = SOSEngine.createRequest(AppState.userLocation, AppState.riskLevel);
    AppState.sosRequests.push(request);

    addAlert('danger', 'fa-bell', 'SOS Signal Sent',
        `Emergency signal from your location. Priority: ${request.priorityLabel}`);
    showToast('danger', 'SOS Activated!', 'Your location has been shared with rescue teams.');

    // Trigger full system update (recalculates SOS priorities)
    StateManager.updateSystemState();
});


// ===========================
// ADMIN DASHBOARD (V2 – Priority Sorted)
// ===========================
function renderAdminSOS() {
    const list = document.getElementById('admin-sos-list');
    if (AppState.sosRequests.length === 0) {
        list.innerHTML = '<li class="empty-state" style="color:var(--text-muted);text-align:center;padding:20px;">No active SOS requests</li>';
        return;
    }

    list.innerHTML = AppState.sosRequests.map(r => {
        const badgeClass = SOSEngine.priorityBadgeClass(r.priorityLabel);
        const emoji = SOSEngine.priorityEmoji(r.priorityLabel);
        return `
            <li class="sos-req-item">
                <div class="sos-req-info">
                    <h4><i class="fa-solid fa-user"></i> ${r.user}
                        <span class="priority-badge ${badgeClass}">${emoji} ${r.priorityLabel}</span>
                    </h4>
                    <p><i class="fa-solid fa-location-dot"></i> ${r.locationStr} &middot; ${r.time}</p>
                    <p class="priority-detail">Score: ${r.priorityScore} | ${r.isStatic ? 'Stationary' : 'Moving'} | Risk: ${r.riskLevel}/3</p>
                </div>
                <button class="route-btn" onclick="showSmartRoute(${shelters[0].id})">
                    <i class="fa-solid fa-location-arrow"></i>
                </button>
            </li>
        `;
    }).join('');
}

function updateAdminStats() {
    const dangerAlerts = AppState.alerts.filter(a => a.type === 'danger').length;
    document.getElementById('admin-active-alerts').textContent = dangerAlerts;
    document.getElementById('admin-sos-requests').textContent = AppState.sosRequests.length;

    // V2: Mini analytics
    const hpEl = document.getElementById('admin-high-priority');
    const dzEl = document.getElementById('admin-danger-zones');
    if (hpEl) {
        const counts = SOSEngine.getPriorityCounts(AppState.sosRequests);
        hpEl.textContent = counts.high;
    }
    if (dzEl) {
        dzEl.textContent = AppState.zoneCounts ? AppState.zoneCounts.danger : 0;
    }
}


// ===========================
// GEOLOCATION
// ===========================
function detectUserLocation() {
    if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
            pos => {
                AppState.userLocation = [pos.coords.latitude, pos.coords.longitude];
                if (AppState.userMarker) {
                    AppState.userMarker.setLatLng(AppState.userLocation);
                    AppState.map.setView(AppState.userLocation, 14);
                }
                // V2: Recalculate on location change
                StateManager.updateSystemState();
                renderShelters();
            },
            () => { console.log('Geolocation denied. Using default (Bangalore).'); },
            { enableHighAccuracy: true, timeout: 5000 }
        );
    }
}


// ===========================
// INIT
// ===========================
function init() {
    detectUserLocation();

    // V2: Initial risk calculation
    AppState.computedZones = RiskEngine.calculateZoneRisks(0);
    AppState.maxRiskScore = RiskEngine.getMaxRiskScore(AppState.computedZones);
    AppState.zoneCounts = RiskEngine.getZoneCounts(AppState.computedZones);

    renderAlerts();
    renderShelters();
    renderAdminSOS();
    updateAdminStats();

    // Set initial risk score display
    const scoreEl = document.getElementById('live-risk-score');
    if (scoreEl) scoreEl.textContent = AppState.maxRiskScore;
}

init();
