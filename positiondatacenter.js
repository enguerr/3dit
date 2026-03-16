import { rack } from './rack.js';
import { orientOnSphere, latLngToSphere, GLOBE_RADIUS, DC_SURFACE_OFFSET } from './worldmap.js';

const PHYSICAL_Y_OFFSET = 0;
const DC_SPACING = 5;
const DC_GLOBE_SCALE = 0.08;
const MIN_ANGULAR_DIST_DEG = 3;

class positiondatacenter {
    constructor(base, list) {
        this.base = base;
        this.list = list;
    }

    compute() {
        let hasGeo = false;
        for (const dc of this.list) {
            if (dc.config && dc.config.lat != null && dc.config.lng != null) {
                hasGeo = true;
                break;
            }
        }

        if (hasGeo) {
            const coords = this.list
                .filter(dc => dc.mainobj && dc.config.lat != null)
                .map(dc => ({
                    dc,
                    lat: dc.config.lat || 0,
                    lng: dc.config.lng || 0,
                    origLat: dc.config.lat || 0,
                    origLng: dc.config.lng || 0,
                }));

            for (let pass = 0; pass < 6; pass++) {
                let moved = false;
                for (let i = 0; i < coords.length; i++) {
                    for (let j = i + 1; j < coords.length; j++) {
                        const a = coords[i], b = coords[j];
                        const dLat = a.lat - b.lat;
                        const dLng = a.lng - b.lng;
                        const dist = Math.sqrt(dLat * dLat + dLng * dLng);
                        if (dist < MIN_ANGULAR_DIST_DEG && dist > 0.001) {
                            const push = (MIN_ANGULAR_DIST_DEG - dist) * 0.55;
                            const nx = dLat / dist, ny = dLng / dist;
                            a.lat += nx * push; a.lng += ny * push;
                            b.lat -= nx * push; b.lng -= ny * push;
                            a.lat = Math.max(-85, Math.min(85, a.lat));
                            b.lat = Math.max(-85, Math.min(85, b.lat));
                            moved = true;
                        }
                    }
                }
                if (!moved) break;
            }

            for (const { dc, lat, lng } of coords) {
                orientOnSphere(dc.mainobj, lat, lng, GLOBE_RADIUS + DC_SURFACE_OFFSET);
                dc.mainobj.scale.setScalar(DC_GLOBE_SCALE);
                dc._globeScale = DC_GLOBE_SCALE;
                dc._globeLat = lat;
                dc._globeLng = lng;
            }
        } else {
            let startX = 0;
            for (let i = 0; i < this.list.length; i++) {
                const dc = this.list[i];
                if (!dc.mainobj) continue;
                dc.move({ x: startX, y: PHYSICAL_Y_OFFSET, z: 0 });
                let dcWidth = 10;
                for (const rm of (dc.rooms || [])) {
                    dcWidth += (rm.floorWidth || 10) + 3;
                }
                startX += dcWidth + DC_SPACING;
            }
        }
    }
}

positiondatacenter.PHYSICAL_Y_OFFSET = PHYSICAL_Y_OFFSET;
positiondatacenter.DC_GLOBE_SCALE = DC_GLOBE_SCALE;
export { positiondatacenter };
