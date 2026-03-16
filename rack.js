import * as THREE from 'three';
import { defaultitem } from './defaultitem.js';

const RACK_WIDTH = 0.6;
const RACK_DEPTH = 1.1;
const U_HEIGHT = 0.0445;
const POST_SIZE = 0.04;
const RAIL_WIDTH = 0.02;
const TOTAL_U = 42;
const RACK_HEIGHT = TOTAL_U * U_HEIGHT;
const RACK_MARGIN_BOTTOM = 0.1;
const RACK_MARGIN_TOP = 0.08;
const RACK_TOTAL_HEIGHT = RACK_HEIGHT + RACK_MARGIN_BOTTOM + RACK_MARGIN_TOP;

const METAL_DARK = 0x2a2a2a;
const METAL_MID = 0x444444;
const METAL_LIGHT = 0x666666;

class rack extends defaultitem {
    constructor(scn, config, parent) {
        super(scn, config, parent);
        this.typeObj = 'rack';
        this.squareoffset = 0;
        this.units = config.units || TOTAL_U;
        this.equipment = [];

        const rackH = this.units * U_HEIGHT;
        this.rackTotalHeight = rackH + RACK_MARGIN_BOTTOM + RACK_MARGIN_TOP;
    }

    createObject() {
        this.mainobj = new THREE.Group();
        this.mainobj.item = this;
        this.ghost = !!this.config.ghost;

        if (this.ghost) {
            this._buildGhost();
        } else {
            this._buildFull();
        }

        this.mainobj.add(this.container);
        this.container.position.set(POST_SIZE, RACK_MARGIN_BOTTOM, POST_SIZE);
        this.configObject();
        this.scn.addObjInteract(this.mainobj);
    }

    _buildGhost() {
        const rw = RACK_WIDTH, rd = RACK_DEPTH, rh = this.rackTotalHeight;
        const mat = new THREE.MeshStandardMaterial({
            color: 0x334455, emissive: 0x112233, emissiveIntensity: 0.15,
            transparent: true, opacity: 0.07, depthWrite: false, roughness: 0.8, metalness: 0.3
        });
        const box = new THREE.Mesh(new THREE.BoxGeometry(rw, rh, rd), mat);
        box.position.set(rw / 2, rh / 2, rd / 2);
        this.mainobj.add(box);

        const edgeMat = new THREE.LineBasicMaterial({ color: 0x446688, transparent: true, opacity: 0.12 });
        const edgeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(rw, rh, rd));
        const edges = new THREE.LineSegments(edgeGeo, edgeMat);
        edges.position.set(rw / 2, rh / 2, rd / 2);
        this.mainobj.add(edges);
    }

    _buildFull() {
        const rw = RACK_WIDTH;
        const rd = RACK_DEPTH;
        const rh = this.rackTotalHeight;
        const postMat = new THREE.MeshStandardMaterial({ color: METAL_DARK, roughness: 0.4, metalness: 0.8 });
        const railMat = new THREE.MeshStandardMaterial({ color: METAL_MID, roughness: 0.5, metalness: 0.6 });
        const panelMat = new THREE.MeshStandardMaterial({ color: METAL_LIGHT, roughness: 0.6, metalness: 0.4, opacity: 0.9, transparent: true });

        const postGeo = new THREE.BoxGeometry(POST_SIZE, rh, POST_SIZE);
        const postPositions = [
            [POST_SIZE / 2, rh / 2, POST_SIZE / 2],
            [rw - POST_SIZE / 2, rh / 2, POST_SIZE / 2],
            [POST_SIZE / 2, rh / 2, rd - POST_SIZE / 2],
            [rw - POST_SIZE / 2, rh / 2, rd - POST_SIZE / 2]
        ];
        postPositions.forEach(p => {
            const post = new THREE.Mesh(postGeo, postMat);
            post.position.set(p[0], p[1], p[2]);
            post.castShadow = true;
            this.mainobj.add(post);
        });

        const railGeo = new THREE.BoxGeometry(RAIL_WIDTH, rh - 0.05, RAIL_WIDTH);
        [POST_SIZE + RAIL_WIDTH, rw - POST_SIZE - RAIL_WIDTH].forEach(x => {
            const rail = new THREE.Mesh(railGeo, railMat);
            rail.position.set(x, rh / 2, POST_SIZE / 2 - 0.005);
            this.mainobj.add(rail);
        });

        const slotMat = new THREE.MeshBasicMaterial({ color: 0x555555 });
        for (let u = 0; u <= this.units; u += 3) {
            const y = RACK_MARGIN_BOTTOM + u * U_HEIGHT;
            const slotGeo = new THREE.BoxGeometry(rw - 2 * POST_SIZE, 0.002, 0.002);
            const slot = new THREE.Mesh(slotGeo, slotMat);
            slot.position.set(rw / 2, y, 0);
            this.mainobj.add(slot);
        }

        const baseGeo = new THREE.BoxGeometry(rw + 0.04, 0.03, rd + 0.04);
        const baseMat = new THREE.MeshStandardMaterial({ color: METAL_DARK, roughness: 0.3, metalness: 0.7 });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.set(rw / 2, 0.015, rd / 2);
        this.mainobj.add(base);

        const topGeo = new THREE.BoxGeometry(rw, 0.02, rd);
        const top = new THREE.Mesh(topGeo, panelMat);
        top.position.set(rw / 2, rh, rd / 2);
        this.mainobj.add(top);

        const sideMat = new THREE.MeshStandardMaterial({
            color: METAL_MID, opacity: 0.2, transparent: true,
            side: THREE.DoubleSide, depthWrite: false, roughness: 0.5, metalness: 0.5
        });
        const leftGeo = new THREE.PlaneGeometry(rd, rh);
        const leftPanel = new THREE.Mesh(leftGeo, sideMat);
        leftPanel.position.set(0, rh / 2, rd / 2);
        leftPanel.rotation.y = Math.PI / 2;
        this.mainobj.add(leftPanel);

        const rightPanel = new THREE.Mesh(leftGeo.clone(), sideMat);
        rightPanel.position.set(rw, rh / 2, rd / 2);
        rightPanel.rotation.y = Math.PI / 2;
        this.mainobj.add(rightPanel);

        const backMat = new THREE.MeshStandardMaterial({ color: METAL_DARK, opacity: 0.5, transparent: true, roughness: 0.6 });
        const backGeo = new THREE.PlaneGeometry(rw - 2 * POST_SIZE, rh - 0.1);
        const backPanel = new THREE.Mesh(backGeo, backMat);
        backPanel.position.set(rw / 2, rh / 2, rd);
        this.mainobj.add(backPanel);

        this.createText(-0.02, rh + 0.15, rd / 2, this.config.name, this.mainobj, 0.14, 0xaaddff);
    }

    add(mi) {
        mi.createObject();
        this.container.add(mi.mainobj);
        this.children.push(mi);
        this.equipment.push(mi);
    }

    compute() {
        for (let i in this.children) this.children[i].compute();
    }

    getUPositionY(startU) {
        return (startU - 1) * U_HEIGHT;
    }
}

rack.RACK_WIDTH = RACK_WIDTH;
rack.RACK_DEPTH = RACK_DEPTH;
rack.RACK_TOTAL_HEIGHT = RACK_TOTAL_HEIGHT;
rack.U_HEIGHT = U_HEIGHT;
rack.RACK_MARGIN_BOTTOM = RACK_MARGIN_BOTTOM;
rack.POST_SIZE = POST_SIZE;

export { rack };
