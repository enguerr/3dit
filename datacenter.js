import * as THREE from 'three';
import { defaultitem } from './defaultitem.js';

class datacenter extends defaultitem {
    constructor(scn, config, parent) {
        super(scn, config, parent);
        this.typeObj = 'datacenter';
        this.squareoffset = 0;
        this.rooms = [];
        this.cables = [];
        this._exteriorGroup = null;
    }

    createObject() {
        this.mainobj = new THREE.Group();
        this.mainobj.item = this;
        this.mainobj.add(this.container);
        this.container.position.set(0, 0, 0);

        this._exteriorGroup = new THREE.Group();
        this._exteriorGroup.name = '_dcExterior';
        this.mainobj.add(this._exteriorGroup);
        this._buildExterior();

        this.configObject();
        this.scn.addObjInteract(this.mainobj);
    }

    _buildExterior() {
        const eg = this._exteriorGroup;
        const bw = 3.0, bh = 2.0, bd = 4.0;

        const wallMat = new THREE.MeshStandardMaterial({
            color: 0x1a1a2e, emissive: 0x050510, emissiveIntensity: 0.3,
            roughness: 0.7, metalness: 0.5
        });
        const body = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), wallMat);
        body.position.set(0, bh / 2, 0);
        body.castShadow = true;
        eg.add(body);

        const neonEdgeMat = new THREE.MeshStandardMaterial({
            color: 0x00ccff, emissive: 0x00aaff, emissiveIntensity: 4.0,
            roughness: 0.2, metalness: 0.5
        });
        const es = 0.025;
        const neonEdges = [
            { w: bw, h: es, d: es, x: 0, y: 0, z: -bd / 2 },
            { w: bw, h: es, d: es, x: 0, y: 0, z: bd / 2 },
            { w: bw, h: es, d: es, x: 0, y: bh, z: -bd / 2 },
            { w: bw, h: es, d: es, x: 0, y: bh, z: bd / 2 },
            { w: es, h: bh, d: es, x: -bw / 2, y: bh / 2, z: -bd / 2 },
            { w: es, h: bh, d: es, x: bw / 2, y: bh / 2, z: -bd / 2 },
            { w: es, h: bh, d: es, x: -bw / 2, y: bh / 2, z: bd / 2 },
            { w: es, h: bh, d: es, x: bw / 2, y: bh / 2, z: bd / 2 },
            { w: es, h: es, d: bd, x: -bw / 2, y: 0, z: 0 },
            { w: es, h: es, d: bd, x: bw / 2, y: 0, z: 0 },
            { w: es, h: es, d: bd, x: -bw / 2, y: bh, z: 0 },
            { w: es, h: es, d: bd, x: bw / 2, y: bh, z: 0 },
        ];
        neonEdges.forEach(e => {
            const m = new THREE.Mesh(new THREE.BoxGeometry(e.w, e.h, e.d), neonEdgeMat);
            m.position.set(e.x, e.y, e.z);
            eg.add(m);
        });

        const roofMat = new THREE.MeshStandardMaterial({
            color: 0x222233, emissive: 0x050510, emissiveIntensity: 0.2,
            roughness: 0.5, metalness: 0.5
        });
        const roof = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.1, 0.08, bd + 0.1), roofMat);
        roof.position.set(0, bh + 0.04, 0);
        eg.add(roof);

        const acMat = new THREE.MeshStandardMaterial({
            color: 0x444455, emissive: 0x111122, emissiveIntensity: 0.3,
            roughness: 0.5, metalness: 0.6
        });
        for (let i = 0; i < 3; i++) {
            const ac = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.5), acMat);
            ac.position.set(-bw / 2 + 0.5 + i * 1.0, bh + 0.08 + 0.15, bd * 0.2);
            eg.add(ac);
            const fan = new THREE.Mesh(
                new THREE.CylinderGeometry(0.15, 0.15, 0.02, 12),
                new THREE.MeshStandardMaterial({ color: 0x00ddff, emissive: 0x00bbdd, emissiveIntensity: 1.0, roughness: 0.3, metalness: 0.7 })
            );
            fan.position.set(ac.position.x, ac.position.y + 0.16, ac.position.z);
            eg.add(fan);
        }

        const doorGlowMat = new THREE.MeshStandardMaterial({
            color: 0x00ccff, emissive: 0x00aaff, emissiveIntensity: 2.5,
            roughness: 0.2, metalness: 0.4
        });
        const doorW = 0.6, doorH = 1.4;
        const dz = -bd / 2 - 0.01;
        [
            { w: doorW + 0.06, h: 0.04, d: 0.02, x: 0, y: doorH, z: dz },
            { w: 0.04, h: doorH, d: 0.02, x: -doorW / 2 - 0.01, y: doorH / 2, z: dz },
            { w: 0.04, h: doorH, d: 0.02, x: doorW / 2 + 0.01, y: doorH / 2, z: dz }
        ].forEach(e => {
            eg.add(new THREE.Mesh(new THREE.BoxGeometry(e.w, e.h, e.d), doorGlowMat)
                .translateX(e.x).translateY(e.y).translateZ(e.z));
        });

        const doorMat = new THREE.MeshStandardMaterial({
            color: 0x111122, emissive: 0x001133, emissiveIntensity: 0.3,
            roughness: 0.5, metalness: 0.6
        });
        const door = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, 0.03), doorMat);
        door.position.set(0, doorH / 2, dz);
        eg.add(door);

        const stripeMat = new THREE.MeshStandardMaterial({
            color: 0x00bbff, emissive: 0x0088ff, emissiveIntensity: 2.0
        });
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.02, 0.05, 0.02), stripeMat);
        stripe.position.set(0, bh * 0.75, -bd / 2 - 0.01);
        eg.add(stripe);

        const stripe2 = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.02, 0.03, 0.02), stripeMat);
        stripe2.position.set(0, bh * 0.25, -bd / 2 - 0.01);
        eg.add(stripe2);

        const antennaMat = new THREE.MeshStandardMaterial({
            color: 0x888899, emissive: 0x222233, emissiveIntensity: 0.3,
            roughness: 0.3, metalness: 0.8
        });
        const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.8, 6), antennaMat);
        antenna.position.set(bw / 2 - 0.15, bh + 0.08 + 0.4, -bd / 2 + 0.3);
        eg.add(antenna);
        const antennaTop = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6),
            new THREE.MeshStandardMaterial({ color: 0xff2200, emissive: 0xff0000, emissiveIntensity: 3.0 }));
        antennaTop.position.set(antenna.position.x, antenna.position.y + 0.4, antenna.position.z);
        eg.add(antennaTop);

        const haloLight = new THREE.PointLight(0x00ccff, 12, 8);
        haloLight.position.set(0, bh + 0.5, 0);
        eg.add(haloLight);

        const frontLight = new THREE.PointLight(0x0088ff, 6, 6);
        frontLight.position.set(0, bh * 0.5, -bd / 2 - 0.5);
        eg.add(frontLight);

        const bottomLight = new THREE.PointLight(0x0066ff, 8, 6);
        bottomLight.position.set(0, -0.3, 0);
        eg.add(bottomLight);

        if (this.config.name) {
            this.createText(0, bh * 0.55, -bd / 2 - 0.03, this.config.name, eg, 0.15, 0x00ddff);
        }
    }

    showExterior() {
        if (this._exteriorGroup) this._exteriorGroup.visible = true;
        if (this.container) this.container.visible = false;
    }

    showInterior() {
        if (this._exteriorGroup) this._exteriorGroup.visible = false;
        if (this.container) this.container.visible = true;
        for (const rm of this.rooms) {
            rm.showInterior();
        }
    }

    add(mi) {
        mi.createObject();
        this.container.add(mi.mainobj);
        this.children.push(mi);
        if (mi.typeObj === 'room') this.rooms.push(mi);
    }

    compute() {
        for (let i in this.children) this.children[i].compute();
    }
}

export { datacenter };
