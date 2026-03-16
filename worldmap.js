import * as THREE from 'three';

const WORLD_URL = 'https://cdn.jsdelivr.net/npm/visionscarto-world-atlas@1/world/110m.json';

const GLOBE_RADIUS = 10;
const DC_SURFACE_OFFSET = 0.05;

export function latLngToSphere(lat, lng, radius) {
    const phi = (90 - lat) * Math.PI / 180;
    const theta = (lng + 180) * Math.PI / 180;
    return new THREE.Vector3(
        -radius * Math.sin(phi) * Math.cos(theta),
         radius * Math.cos(phi),
         radius * Math.sin(phi) * Math.sin(theta)
    );
}

export function orientOnSphere(obj, lat, lng, radius) {
    const pos = latLngToSphere(lat, lng, radius);
    obj.position.copy(pos);
    const up = pos.clone().normalize();
    const fwd = new THREE.Vector3(0, 1, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(fwd, up);
    obj.quaternion.copy(q);
}

function decodeArcs(topology) {
    const arcs = topology.arcs;
    const decoded = [];
    const sx = topology.transform ? topology.transform.scale[0] : 1;
    const sy = topology.transform ? topology.transform.scale[1] : 1;
    const tx = topology.transform ? topology.transform.translate[0] : 0;
    const ty = topology.transform ? topology.transform.translate[1] : 0;

    for (const arc of arcs) {
        let x = 0, y = 0;
        const coords = [];
        for (const [dx, dy] of arc) {
            x += dx;
            y += dy;
            coords.push([x * sx + tx, y * sy + ty]);
        }
        decoded.push(coords);
    }
    return decoded;
}

function ringFromArcs(arcIndices, decodedArcs) {
    const coords = [];
    for (const idx of arcIndices) {
        const arc = idx >= 0 ? decodedArcs[idx] : decodedArcs[~idx].slice().reverse();
        for (let i = coords.length > 0 ? 1 : 0; i < arc.length; i++) {
            coords.push(arc[i]);
        }
    }
    return coords;
}

function geometryToRings(geom, decodedArcs) {
    const rings = [];
    if (geom.type === 'Polygon') {
        for (const arcList of geom.arcs) rings.push(ringFromArcs(arcList, decodedArcs));
    } else if (geom.type === 'MultiPolygon') {
        for (const poly of geom.arcs) {
            for (const arcList of poly) rings.push(ringFromArcs(arcList, decodedArcs));
        }
    }
    return rings;
}

export async function createGlobe() {
    const group = new THREE.Group();
    group.name = '_globe';

    const sphereGeo = new THREE.SphereGeometry(GLOBE_RADIUS, 64, 64);
    const sphereMat = new THREE.MeshStandardMaterial({
        color: 0x0a0e1a,
        roughness: 0.9,
        metalness: 0.1,
        transparent: true,
        opacity: 0.92
    });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    sphere.name = '_globeSphere';
    sphere.raycast = () => {};
    group.add(sphere);

    const atmosphereGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.015, 64, 64);
    const atmosphereMat = new THREE.MeshBasicMaterial({
        color: 0x0044aa,
        transparent: true,
        opacity: 0.06,
        side: THREE.BackSide
    });
    const atmosphere = new THREE.Mesh(atmosphereGeo, atmosphereMat);
    atmosphere.name = '_globeAtmosphere';
    atmosphere.raycast = () => {};
    group.add(atmosphere);

    const R = GLOBE_RADIUS + 0.02;

    try {
        const resp = await fetch(WORLD_URL);
        if (!resp.ok) throw new Error(`Fetch failed: ${resp.status}`);
        const topology = await resp.json();

        const decodedArcs = decodeArcs(topology);
        const countries = topology.objects.countries || topology.objects.land;
        const geometries = countries.geometries || [countries];

        const coastMat = new THREE.LineBasicMaterial({
            color: 0x00e5ff,
            transparent: true,
            opacity: 0.4
        });

        const lineMat = new THREE.LineBasicMaterial({
            color: 0x00b8d4,
            transparent: true,
            opacity: 0.2
        });

        for (const geom of geometries) {
            const rings = geometryToRings(geom, decodedArcs);
            for (const ring of rings) {
                if (ring.length < 3) continue;
                const points = [];
                const step = ring.length > 300 ? 3 : ring.length > 100 ? 2 : 1;
                for (let i = 0; i < ring.length; i += step) {
                    const [lon, lat] = ring[i];
                    points.push(latLngToSphere(lat, lon, R));
                }
                points.push(points[0].clone());
                if (points.length < 2) continue;
                const geo = new THREE.BufferGeometry().setFromPoints(points);
                const mat = ring.length > 50 ? coastMat : lineMat;
                group.add(new THREE.Line(geo, mat));
            }
        }
    } catch (e) {
        console.error('[Globe] Failed to load country outlines:', e.message);
    }

    const gridMat = new THREE.LineBasicMaterial({
        color: 0x003355,
        transparent: true,
        opacity: 0.08
    });

    for (let lon = -180; lon < 180; lon += 30) {
        const pts = [];
        for (let lat = -80; lat <= 80; lat += 2) {
            pts.push(latLngToSphere(lat, lon, R));
        }
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMat));
    }
    for (let lat = -60; lat <= 60; lat += 20) {
        const pts = [];
        for (let lon = -180; lon <= 180; lon += 2) {
            pts.push(latLngToSphere(lat, lon, R));
        }
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMat));
    }

    console.log('[Globe] Created with', group.children.length, 'objects');
    return group;
}

export { GLOBE_RADIUS, DC_SURFACE_OFFSET };
