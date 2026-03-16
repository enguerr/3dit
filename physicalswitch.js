import * as THREE from 'three';
import { defaultitem } from './defaultitem.js';
import { rack } from './rack.js';

const INNER_WIDTH = rack.RACK_WIDTH - 2 * rack.POST_SIZE - 0.02;
const INNER_DEPTH = rack.RACK_DEPTH * 0.85;
const U = rack.U_HEIGHT;

const SWITCH_TYPES = {
    'cisco-copper-48': { sizeU: 1, bodyColor: 0x1a1a1a, portColor: 0xcc8833, portCount: 48, uplinkCount: 4, uplinkColor: 0x33cc33, brand: 'CISCO' },
    'cisco-fiber-24':  { sizeU: 1, bodyColor: 0x1a1a2a, portColor: 0x33cc33, portCount: 24, uplinkCount: 2, uplinkColor: 0x33cc33, brand: 'CISCO' },
    'paloalto-1u':     { sizeU: 1, bodyColor: 0x2a1a0a, portColor: 0xcc4400, portCount: 8,  uplinkCount: 2, uplinkColor: 0x33cc33, brand: 'PA', accentColor: 0xcc4400 }
};

const PORT_RJ45_COLOR = 0x2244aa;

class physicalswitch extends defaultitem {
    constructor(scn, config, parent) {
        super(scn, config, parent);
        this.typeObj = 'physicalswitch';
        this.squareoffset = 0;
        this.switchType = SWITCH_TYPES[config.type] || SWITCH_TYPES['cisco-copper-48'];
        this.startU = config.startU || 1;
        this.sizeU = config.sizeU || this.switchType.sizeU || 1;
        this.rearPorts = [];
    }

    createObject() {
        this.mainobj = new THREE.Group();
        this.mainobj.item = this;

        const w = INNER_WIDTH;
        const h = this.sizeU * U - 0.003;
        const d = INNER_DEPTH;
        const st = this.switchType;

        const bodyGeo = new THREE.BoxGeometry(w, h, d);
        bodyGeo.translate(w / 2, h / 2, d / 2);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: st.bodyColor, roughness: 0.5, metalness: 0.5
        });
        this.mainobj.add(new THREE.Mesh(bodyGeo, bodyMat));

        this._buildFrontFace(w, h, st);
        this._buildRearFace(w, h, d);

        this.mainobj.position.y = (this.startU - 1) * U;
        this.configObject();
        this.scn.addObjInteract(this.mainobj);
    }

    _buildFrontFace(w, h, st) {
        if (this.config.frontImage) {
            this._applyImageFace(w, h, -0.005, this.config.frontImage, false);
        } else {
            const panelGeo = new THREE.BoxGeometry(w + 0.002, h + 0.002, 0.006);
            const panelColor = st.accentColor || st.bodyColor;
            const panelMat = new THREE.MeshStandardMaterial({ color: panelColor, roughness: 0.4 });
            const panel = new THREE.Mesh(panelGeo, panelMat);
            panel.position.set(w / 2, h / 2, -0.003);
            this.mainobj.add(panel);

            if (st.accentColor) {
                const stripeMat = new THREE.MeshStandardMaterial({
                    color: st.accentColor, emissive: st.accentColor, emissiveIntensity: 0.3
                });
                const stripe = new THREE.Mesh(new THREE.BoxGeometry(w + 0.003, h * 0.15, 0.007), stripeMat);
                stripe.position.set(w / 2, h * 0.85, -0.004);
                this.mainobj.add(stripe);
            }

            const ledGeo = new THREE.SphereGeometry(0.003, 6, 6);
            const led = new THREE.Mesh(ledGeo, new THREE.MeshStandardMaterial({
                color: 0x00ff00, emissive: 0x00ff00, emissiveIntensity: 3
            }));
            led.position.set(0.01, h * 0.75, -0.008);
            this.mainobj.add(led);

            const totalPorts = st.portCount;
            const rows = totalPorts > 24 ? 2 : 1;
            const cols = Math.ceil(totalPorts / rows);
            const portAreaW = w - 0.04;
            const portW = portAreaW / cols;
            const portH = (h - 0.01) / (rows + 1);
            const portMat = new THREE.MeshStandardMaterial({ color: st.portColor, roughness: 0.6 });

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (r * cols + c >= totalPorts) break;
                    const pw = portW - 0.001;
                    const ph = portH - 0.001;
                    const port = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, 0.003), portMat);
                    port.position.set(0.025 + c * portW + pw / 2, 0.005 + r * (portH + 0.002) + ph / 2, -0.008);
                    this.mainobj.add(port);
                }
            }

            if (st.uplinkCount > 0) {
                const uplinkMat = new THREE.MeshStandardMaterial({
                    color: st.uplinkColor, emissive: st.uplinkColor, emissiveIntensity: 0.3
                });
                const uplinkW = 0.01;
                const startX = w - 0.02 - st.uplinkCount * (uplinkW + 0.002);
                for (let i = 0; i < st.uplinkCount; i++) {
                    const uPort = new THREE.Mesh(new THREE.BoxGeometry(uplinkW, h * 0.4, 0.004), uplinkMat);
                    uPort.position.set(startX + i * (uplinkW + 0.002), h * 0.7, -0.008);
                    this.mainobj.add(uPort);
                }
            }

            if (st.brand) {
                this.createText(w - 0.06, h * 0.15, -0.01, st.brand, this.mainobj, 0.012, 0xcccccc, 'right');
            }
        }
    }

    _buildRearFace(w, h, d) {
        const portCount = this.config.networkPorts || 0;

        if (this.config.rearImage) {
            this._applyImageFace(w, h, d + 0.005, this.config.rearImage, true);
        } else {
            const rearPanelGeo = new THREE.BoxGeometry(w + 0.002, h + 0.002, 0.004);
            const rearPanelMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6, metalness: 0.4 });
            const rearPanel = new THREE.Mesh(rearPanelGeo, rearPanelMat);
            rearPanel.position.set(w / 2, h / 2, d + 0.002);
            this.mainobj.add(rearPanel);
        }

        if (portCount > 0) {
            this._createRearPorts(w, h, d, portCount);
        }
    }

    _applyImageFace(w, h, z, imageUrl, isRear) {
        const loader = new THREE.TextureLoader();
        const planeGeo = new THREE.PlaneGeometry(w, h);
        const placeholderMat = new THREE.MeshStandardMaterial({
            color: 0x333333, roughness: 0.5, metalness: 0.4
        });
        const plane = new THREE.Mesh(planeGeo, placeholderMat);
        plane.position.set(w / 2, h / 2, z);
        if (isRear) plane.rotation.y = Math.PI;
        this.mainobj.add(plane);

        loader.load(imageUrl,
            (texture) => {
                texture.colorSpace = THREE.SRGBColorSpace;
                plane.material.dispose();
                plane.material = new THREE.MeshStandardMaterial({
                    map: texture, roughness: 0.4, metalness: 0.3
                });
            },
            undefined,
            (err) => console.warn(`[Switch] Failed to load texture: ${imageUrl}`, err)
        );
    }

    _createRearPorts(w, h, d, portCount) {
        this.rearPorts = [];
        const margin = 0.02;
        const areaW = w - 2 * margin;
        const rows = portCount > 16 ? 2 : 1;
        const cols = Math.ceil(portCount / rows);
        const portW = Math.min(areaW / cols, 0.022);
        const portH = Math.min((h - 0.008) / (rows + 0.5), 0.018);
        const totalPortsW = cols * portW;
        const startX = margin + (areaW - totalPortsW) / 2;
        const baseY = (h - rows * portH - (rows - 1) * 0.002) / 2;

        const portMat = new THREE.MeshStandardMaterial({
            color: PORT_RJ45_COLOR, roughness: 0.5, metalness: 0.4,
            emissive: PORT_RJ45_COLOR, emissiveIntensity: 0.15
        });
        const portHoverMat = new THREE.MeshStandardMaterial({
            color: 0x44aaff, emissive: 0x44aaff, emissiveIntensity: 0.8,
            roughness: 0.3, metalness: 0.5
        });

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const idx = r * cols + c;
                if (idx >= portCount) break;
                const pw = portW - 0.002;
                const ph = portH - 0.002;
                const portGeo = new THREE.BoxGeometry(pw, ph, 0.006);
                const port = new THREE.Mesh(portGeo, portMat.clone());
                port.position.set(
                    startX + c * portW + pw / 2,
                    baseY + r * (portH + 0.002) + ph / 2,
                    d + 0.006
                );
                port.userData = {
                    isPort: true,
                    portIndex: idx,
                    portName: `eth${idx}`,
                    equipmentName: this.config.name,
                    equipmentConfig: this.config,
                    defaultMat: port.material,
                    hoverMat: portHoverMat
                };
                this.mainobj.add(port);
                this.rearPorts.push(port);
            }
        }
    }

    compute() {}
}

export { physicalswitch };
