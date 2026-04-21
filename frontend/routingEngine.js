// ===========================
// routingEngine.js – Practical Road-Based Risk-Aware Module
// ===========================

const RoutingEngine = (() => {

    /** Haversine distance helper */
    function haversine(a, b) {
        const R = 6371000;
        const toRad = d => d * Math.PI / 180;
        const dLat = toRad(b[0] - a[0]);
        const dLng = toRad(b[1] - a[1]);
        const lat1 = toRad(a[0]);
        const lat2 = toRad(b[0]);
        const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
        return 2 * R * Math.asin(Math.sqrt(h));
    }

    /**
     * Fetch real road path from OSRM.
     * Includes alternatives to allow risk-based selection.
     */
    async function fetchRoadRoute(start, end) {
        const url = `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson&alternatives=true`;
        try {
            const resp = await fetch(url);
            const data = await resp.json();
            if (data.code !== 'Ok') return null;
            return data.routes;
        } catch (e) {
            console.error("OSRM Fetch failed", e);
            return null;
        }
    }

    /** Calculate risk cost for a set of coordinates (path) */
    function calculatePathRisk(coordinates, riskZones) {
        let totalRiskCost = 0;
        let maxSegmentRisk = 0;

        for (let i = 0; i < coordinates.length; i++) {
            const pt = [coordinates[i][1], coordinates[i][0]]; // [lat, lng]
            
            for (const zone of riskZones) {
                const dist = haversine(pt, zone.center);
                if (dist < zone.dynamicRadius) {
                    let weight = 0;
                    if (zone.level === 'danger') weight = 50;
                    if (zone.level === 'warning') weight = 10;
                    
                    const penetration = 1 - (dist / zone.dynamicRadius);
                    const risk = weight * (1 + penetration);
                    totalRiskCost += risk;
                    if (risk > maxSegmentRisk) maxSegmentRisk = risk;
                }
            }
        }

        return { totalRiskCost, maxSegmentRisk };
    }

    /** Classify risk based on cost */
    function classifyRisk(cost) {
        if (cost > 40) return 'danger';
        if (cost > 5) return 'warning';
        return 'safe';
    }

    /**
     * MAIN API: Find the best road-based route.
     * Now async because it fetches real road data.
     */
    async function findBestRoadRoutes(userLoc, shelters, riskZones) {
        // Fetch routes for each shelter
        const results = await Promise.all(shelters.map(async shelter => {
            const roadRoutes = await fetchRoadRoute(userLoc, [shelter.lat, shelter.lng]);
            
            if (!roadRoutes || roadRoutes.length === 0) {
                // Fallback to straight line if OSRM fails
                return {
                    shelter,
                    path: [userLoc, [shelter.lat, shelter.lng]],
                    segments: [{ from: userLoc, to: [shelter.lat, shelter.lng], riskLevel: 'danger' }],
                    totalCost: 999999,
                    routeType: 'fallback'
                };
            }

            // Evaluate all alternatives and pick the one with lowest risk
            const evaluatedRoutes = roadRoutes.map(route => {
                const coords = route.geometry.coordinates; // [[lng, lat], ...]
                const riskData = calculatePathRisk(coords, riskZones);
                return {
                    route,
                    ...riskData,
                    totalScore: route.distance + (riskData.totalRiskCost * 20)
                };
            });

            // Pick the best one (lowest totalScore)
            evaluatedRoutes.sort((a, b) => a.totalScore - b.totalScore);
            const best = evaluatedRoutes[0];
            
            // Format segments for display
            const path = best.route.geometry.coordinates.map(c => [c[1], c[0]]);
            const segments = [];
            for (let i = 0; i < path.length - 1; i++) {
                // Check local risk for segment color
                const midPt = [ (path[i][0] + path[i+1][0])/2, (path[i][1] + path[i+1][1])/2 ];
                const segmentRisk = calculatePathRisk([[midPt[1], midPt[0]]], riskZones);
                segments.push({
                    from: path[i],
                    to: path[i+1],
                    riskLevel: classifyRisk(segmentRisk.maxSegmentRisk)
                });
            }

            const overallRisk = classifyRisk(best.maxSegmentRisk);

            return {
                shelter,
                path,
                segments,
                totalCost: best.totalScore,
                duration: Math.round(best.route.duration / 60), // minutes
                distance: (best.route.distance / 1000).toFixed(1), // km
                routeType: overallRisk === 'danger' ? 'risky' : (overallRisk === 'warning' ? 'cautious' : 'safe'),
                riskLevel: overallRisk
            };
        }));

        results.sort((a, b) => a.totalCost - b.totalCost);
        return results;
    }

    function routeExplanation(route) {
        if (route.routeType === 'safe') return `Safe road path found (${route.distance}km, ${route.duration}m).`;
        if (route.routeType === 'cautious') return `Caution: Route passes through mild risk zones (${route.distance}km).`;
        return `⚠️ Warning: High-risk road segments detected. Proceed with extreme caution.`;
    }

    function routeTypeLabel(routeType) {
        switch (routeType) {
            case 'safe':     return { text: 'Safe Road Route', icon: 'fa-road-circle-check', color: '#16a34a' };
            case 'cautious': return { text: 'Caution Route', icon: 'fa-road-circle-exclamation', color: '#d97706' };
            case 'risky':    return { text: 'Emergency Path', icon: 'fa-fire-extinguisher', color: '#ef4444' };
            default:         return { text: 'Road Access', icon: 'fa-road', color: '#3b82f6' };
        }
    }

    return {
        haversine,
        findBestRoadRoutes,
        routeExplanation,
        routeTypeLabel,
        segmentColor: (l) => l === 'danger' ? '#ef4444' : (l === 'warning' ? '#d97706' : '#16a34a')
    };
})();
