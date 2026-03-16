import * as THREE from 'three';
import { rack } from './rack.js';

const CABLE_COLORS = {
    'fiber': 0xffdd22,
    'copper': 0x44aaff,
    'power': 0xff4444,
    'rocade': 0xffaa00
};
const CABLE_RADIUS = 0.015;
const ROCADE_RADIUS = 0.02;
const OVERHEAD_HEIGHT_OFFSET = 0.5;
const FLOOR_CABLE_Y = 0.06;
const CEILING_OFFSET = 0.15;

class physicalcable {
    constructor(fromRack, toRack, cableConfig) {
        this.from = fromRack;
        this.to = toRack;
        this.config = cableConfig;
        this.type = cableConfig.type || 'copper';
        this.path = cableConfig.path || 'overhead';
        this.mainobj = null;
        this.parentGroup = null;
    }

    createObject(parentGroup) {
        if (!this.from || !this.to) return;
        if (!this.from.mainobj || !this.to.mainobj) return;
        if (parentGroup) this.parentGroup = parentGroup;

        this.from.mainobj.updateWorldMatrix(true, false);
        this.to.mainobj.updateWorldMatrix(true, false);

        const fromPos = new THREE.Vector3();
        const toPos = new THREE.Vector3();
        this.from.mainobj.getWorldPosition(fromPos);
        this.to.mainobj.getWorldPosition(toPos);

        if (this.parentGroup) {
            this.parentGroup.updateWorldMatrix(true, false);
            this.parentGroup.worldToLocal(fromPos);
            this.parentGroup.worldToLocal(toPos);
        }

        const rh = rack.RACK_TOTAL_HEIGHT;
        const rw = rack.RACK_WIDTH;
        const rd = rack.RACK_DEPTH;

        if (this.type === 'rocade') {
            this._createRocade(fromPos, toPos, rh, rw, rd);
            return;
        }

        fromPos.x += rw / 2;
        fromPos.z += rd;
        toPos.x += rw / 2;
        toPos.z += rd;

        let points;
        if (this.path === 'underfloor') {
            const floorY = Math.min(fromPos.y, toPos.y) + FLOOR_CABLE_Y;
            const midX = (fromPos.x + toPos.x) / 2;
            const midZ = (fromPos.z + toPos.z) / 2;
            points = [
                new THREE.Vector3(fromPos.x, fromPos.y + 0.1, fromPos.z),
                new THREE.Vector3(fromPos.x, floorY, fromPos.z),
                new THREE.Vector3(midX, floorY, midZ),
                new THREE.Vector3(toPos.x, floorY, toPos.z),
                new THREE.Vector3(toPos.x, toPos.y + 0.1, toPos.z)
            ];
        } else {
            const topY = Math.max(fromPos.y, toPos.y) + rh + OVERHEAD_HEIGHT_OFFSET;
            const midX = (fromPos.x + toPos.x) / 2;
            const midZ = (fromPos.z + toPos.z) / 2;
            points = [
                new THREE.Vector3(fromPos.x, fromPos.y + rh, fromPos.z),
                new THREE.Vector3(fromPos.x, topY, fromPos.z),
                new THREE.Vector3(midX, topY, midZ),
                new THREE.Vector3(toPos.x, topY, toPos.z),
                new THREE.Vector3(toPos.x, toPos.y + rh, toPos.z)
            ];
        }

        const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.3);
        const geometry = new THREE.TubeGeometry(curve, 64, CABLE_RADIUS, 8, false);
        const color = CABLE_COLORS[this.type] || 0x44aaff;
        const emissiveBoost = this.path === 'underfloor' ? 0.3 : 0.6;
        const material = new THREE.MeshStandardMaterial({
            color: color, emissive: color, emissiveIntensity: emissiveBoost,
            roughness: 0.4, metalness: 0.5
        });

        this.mainobj = new THREE.Mesh(geometry, material);
    }

    _createRocade(fromPos, toPos, rh, rw, rd) {
        const topU_Y = rh;
        const ceilingY = topU_Y + OVERHEAD_HEIGHT_OFFSET;

        const fromTop = new THREE.Vector3(fromPos.x + rw / 2, fromPos.y + topU_Y, fromPos.z + rd / 2);
        const fromCeiling = new THREE.Vector3(fromPos.x + rw / 2, fromPos.y + ceilingY, fromPos.z + rd / 2);

        const toTop = new THREE.Vector3(toPos.x + rw / 2, toPos.y + topU_Y, toPos.z + rd / 2);
        const toCeiling = new THREE.Vector3(toPos.x + rw / 2, toPos.y + ceilingY, toPos.z + rd / 2);

        const sameRow = Math.abs(fromPos.z - toPos.z) < 0.5;
        let points;

        if (sameRow) {
            points = [fromTop, fromCeiling, toCeiling, toTop];
        } else {
            const midX = (fromPos.x + toPos.x) / 2 + rw / 2;
            const midZ = (fromPos.z + toPos.z) / 2 + rd / 2;
            points = [
                fromTop,
                fromCeiling,
                new THREE.Vector3(fromCeiling.x, ceilingY + CEILING_OFFSET, fromCeiling.z),
                new THREE.Vector3(midX, ceilingY + CEILING_OFFSET, midZ),
                new THREE.Vector3(toCeiling.x, ceilingY + CEILING_OFFSET, toCeiling.z),
                toCeiling,
                toTop
            ];
        }

        const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.3);
        const geometry = new THREE.TubeGeometry(curve, 64, ROCADE_RADIUS, 8, false);
        const color = CABLE_COLORS['rocade'];
        const material = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.7,
            roughness: 0.3,
            metalness: 0.6,
            transparent: true,
            opacity: 0.85
        });

        this.mainobj = new THREE.Mesh(geometry, material);
    }

    compute() {
        const parent = this.mainobj?.parent || this.parentGroup;
        if (this.mainobj) {
            this.mainobj.geometry.dispose();
            this.mainobj.material.dispose();
            this.mainobj.removeFromParent();
        }
        this.createObject(this.parentGroup);
        if (parent && this.mainobj) parent.add(this.mainobj);
    }

    destroy() {
        if (this.mainobj) {
            this.mainobj.removeFromParent();
            this.mainobj.geometry?.dispose();
            this.mainobj.material?.dispose();
        }
    }
}

export { physicalcable };
