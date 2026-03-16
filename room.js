import * as THREE from 'three';
import { defaultitem } from './defaultitem.js';

const PADDING = 0.6;

class room extends defaultitem {
    constructor(scn, config, parent) {
        super(scn, config, parent);
        this.typeObj = 'room';
        this.squareoffset = 0;
        this.rows = [];
        this.cables = [];
        this.wallHeight = (config.style && config.style.wallHeight) || 3.5;
        this._shellGroup = null;
    }

    createObject() {
        this.mainobj = new THREE.Group();
        this.mainobj.item = this;
        this.mainobj.add(this.container);
        this.container.position.set(0, 0, 0);

        this._shellGroup = new THREE.Group();
        this._shellGroup.name = '_roomShell';
        this.mainobj.add(this._shellGroup);

        this.configObject();
        this.scn.addObjInteract(this.mainobj);
    }

    showInterior() {
        if (this._shellGroup) this._shellGroup.visible = true;
        if (this.container) this.container.visible = true;
    }

    hideInterior() {
        if (this._shellGroup) this._shellGroup.visible = false;
        if (this.container) this.container.visible = false;
    }

    refit() {
        while (this._shellGroup.children.length > 0) {
            const child = this._shellGroup.children[0];
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (child.material.map) child.material.map.dispose();
                child.material.dispose();
            }
            this._shellGroup.remove(child);
        }

        const box = new THREE.Box3();
        this.container.updateWorldMatrix(true, true);
        this.container.traverse(child => {
            if (child.isMesh) box.expandByObject(child);
        });

        if (box.isEmpty()) {
            this._buildShell(4, 4, this.wallHeight);
            return;
        }

        const localMin = this.mainobj.worldToLocal(box.min.clone());
        const localMax = this.mainobj.worldToLocal(box.max.clone());

        const fw = (localMax.x - localMin.x) + PADDING * 2;
        const fd = (localMax.z - localMin.z) + PADDING * 2;
        const wh = Math.max(this.wallHeight, localMax.y + 0.5);

        const offsetX = localMin.x - PADDING;
        const offsetZ = localMin.z - PADDING;

        this._buildShell(fw, fd, wh, offsetX, offsetZ);
    }

    _buildShell(fw, fd, wh, ox = 0, oz = 0) {
        this.floorWidth = fw;
        this.floorDepth = fd;
        const sg = this._shellGroup;

        const floorCanvas = document.createElement('canvas');
        floorCanvas.width = 256;
        floorCanvas.height = 256;
        const ctx = floorCanvas.getContext('2d');
        ctx.fillStyle = '#484848';
        ctx.fillRect(0, 0, 256, 256);
        ctx.strokeStyle = '#606060';
        ctx.lineWidth = 1;
        const tileCount = 16;
        for (let i = 0; i <= tileCount; i++) {
            const p = (i / tileCount) * 256;
            ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, 256); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(256, p); ctx.stroke();
        }
        const floorTex = new THREE.CanvasTexture(floorCanvas);
        floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
        floorTex.repeat.set(fw / 1.5, fd / 1.5);

        const floor = new THREE.Mesh(
            new THREE.BoxGeometry(fw, 0.05, fd),
            new THREE.MeshStandardMaterial({ map: floorTex, color: 0x888888, roughness: 0.6, metalness: 0.15 })
        );
        floor.position.set(ox + fw / 2, -0.025, oz + fd / 2);
        floor.receiveShadow = true;
        sg.add(floor);

        const edgeMat = new THREE.MeshStandardMaterial({
            color: 0x5599bb, emissive: 0x224466, emissiveIntensity: 0.3,
            opacity: 0.7, transparent: true, roughness: 0.3, metalness: 0.6
        });
        const es = 0.03;
        const edges = [
            { w: fw, h: es, d: es, x: ox + fw/2, y: 0, z: oz },
            { w: fw, h: es, d: es, x: ox + fw/2, y: 0, z: oz + fd },
            { w: es, h: es, d: fd, x: ox, y: 0, z: oz + fd/2 },
            { w: es, h: es, d: fd, x: ox + fw, y: 0, z: oz + fd/2 },
            { w: fw, h: es, d: es, x: ox + fw/2, y: wh, z: oz },
            { w: fw, h: es, d: es, x: ox + fw/2, y: wh, z: oz + fd },
            { w: es, h: es, d: fd, x: ox, y: wh, z: oz + fd/2 },
            { w: es, h: es, d: fd, x: ox + fw, y: wh, z: oz + fd/2 },
            { w: es, h: wh, d: es, x: ox, y: wh/2, z: oz },
            { w: es, h: wh, d: es, x: ox + fw, y: wh/2, z: oz },
            { w: es, h: wh, d: es, x: ox, y: wh/2, z: oz + fd },
            { w: es, h: wh, d: es, x: ox + fw, y: wh/2, z: oz + fd }
        ];
        edges.forEach(e => {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(e.w, e.h, e.d), edgeMat);
            mesh.position.set(e.x, e.y, e.z);
            sg.add(mesh);
        });

        const wallMat = new THREE.MeshStandardMaterial({
            color: 0x446688, opacity: 0.04, transparent: true,
            side: THREE.DoubleSide, depthWrite: false
        });
        [
            { w: fw, h: wh, px: ox + fw/2, pz: oz, ry: 0 },
            { w: fw, h: wh, px: ox + fw/2, pz: oz + fd, ry: 0 },
            { w: fd, h: wh, px: ox, pz: oz + fd/2, ry: Math.PI/2 },
            { w: fd, h: wh, px: ox + fw, pz: oz + fd/2, ry: Math.PI/2 }
        ].forEach(wc => {
            const wall = new THREE.Mesh(new THREE.PlaneGeometry(wc.w, wc.h), wallMat);
            wall.position.set(wc.px, wc.h/2, wc.pz);
            wall.rotation.y = wc.ry;
            sg.add(wall);
        });

        const ceilMat = new THREE.MeshStandardMaterial({
            color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.02,
            opacity: 0.05, transparent: true, side: THREE.DoubleSide, depthWrite: false
        });
        const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(fw, fd), ceilMat);
        ceiling.rotation.x = -Math.PI / 2;
        ceiling.position.set(ox + fw/2, wh, oz + fd/2);
        sg.add(ceiling);

        const lightStripCount = Math.max(2, Math.floor(fd / 2));
        for (let i = 0; i < lightStripCount; i++) {
            const lightGeo = new THREE.BoxGeometry(fw * 0.6, 0.015, 0.06);
            const lightMat = new THREE.MeshStandardMaterial({
                color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.5
            });
            const strip = new THREE.Mesh(lightGeo, lightMat);
            const z = oz + 0.5 + i * ((fd - 1) / Math.max(lightStripCount - 1, 1));
            strip.position.set(ox + fw/2, wh - 0.02, z);
            sg.add(strip);
        }

        const lightIntensity = Math.max(5, fw * fd * 0.6);
        const lightRange = Math.max(fw, fd) * 4;
        [0.25, 0.5, 0.75].forEach(frac => {
            const light = new THREE.PointLight(0xeef4ff, lightIntensity, lightRange);
            light.position.set(ox + fw / 2, wh - 0.2, oz + fd * frac);
            sg.add(light);
        });
        const ambientDC = new THREE.PointLight(0xbbddff, lightIntensity * 0.4, lightRange * 2);
        ambientDC.position.set(ox + fw / 2, wh * 0.4, oz + fd / 2);
        sg.add(ambientDC);

        const doorW = 1.0;
        const doorH = Math.min(2.2, wh - 0.1);
        const doorEdgeMat = new THREE.MeshStandardMaterial({
            color: 0x66aacc, emissive: 0x3388aa, emissiveIntensity: 0.3,
            opacity: 0.7, transparent: true
        });
        const des = es * 2;
        [
            { w: doorW, h: des, d: es, x: ox + fw/2, y: doorH, z: oz - 0.02 },
            { w: des, h: doorH, d: es, x: ox + fw/2 - doorW/2, y: doorH/2, z: oz - 0.02 },
            { w: des, h: doorH, d: es, x: ox + fw/2 + doorW/2, y: doorH/2, z: oz - 0.02 }
        ].forEach(e => {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(e.w, e.h, e.d), doorEdgeMat);
            mesh.position.set(e.x, e.y, e.z);
            sg.add(mesh);
        });

        this.createText(ox + fw / 2, wh * 0.85, oz - 0.05, this.config.name, sg, 0.35, 0xaaddff);

        if (this.config.description) {
            this.createText(ox + fw / 2, wh * 0.72, oz - 0.05, this.config.description, sg, 0.18, 0x7799bb);
        }
    }

    add(mi) {
        mi.createObject();
        this.container.add(mi.mainobj);
        this.children.push(mi);
        if (mi.typeObj === 'row') this.rows.push(mi);
    }

    compute() {
        for (let i in this.children) this.children[i].compute();
    }
}

export { room };
