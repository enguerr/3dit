import * as THREE from 'three';
import { defaultitem } from './defaultitem.js';
import { rack } from './rack.js';

const INNER_WIDTH = rack.RACK_WIDTH - 2 * rack.POST_SIZE - 0.02;
const INNER_DEPTH = rack.RACK_DEPTH * 0.85;
const U = rack.U_HEIGHT;

const EQUIPMENT_TYPES = {
    'dell-poweredge-1u': { sizeU: 1, bodyColor: 0x888888, bezelColor: 0x333333, brand: 'DELL', hasDrives: true, driveCount: 8 },
    'dell-poweredge-2u': { sizeU: 2, bodyColor: 0x888888, bezelColor: 0x333333, brand: 'DELL', hasDrives: true, driveCount: 12 },
    'hpe-apollo-4u':    { sizeU: 4, bodyColor: 0x7a7a7a, bezelColor: 0x1a1a1a, brand: 'HPE', hasDrives: true, driveCount: 24, hasFans: true },
    'patch-panel-1u':   { sizeU: 1, bodyColor: 0x222222, bezelColor: 0x111111, brand: '', isPatchPanel: true, portCount: 24 }
};

const PORT_RJ45_COLOR = 0x2244aa;
const PORT_SFP_COLOR = 0x22aa44;

class physicalserver extends defaultitem {
    constructor(scn, config, parent) {
        super(scn, config, parent);
        this.typeObj = 'physicalserver';
        this.squareoffset = 0;
        this.equipType = EQUIPMENT_TYPES[config.type] || EQUIPMENT_TYPES['dell-poweredge-1u'];
        this.startU = config.startU || 1;
        this.sizeU = config.sizeU || this.equipType.sizeU || 1;
        this.rearPorts = [];
    }

    createObject() {
        this.mainobj = new THREE.Group();
        this.mainobj.item = this;

        const w = INNER_WIDTH;
        const h = this.sizeU * U - 0.003;
        const d = INNER_DEPTH;
        const et = this.equipType;

        const bodyGeo = new THREE.BoxGeometry(w, h, d);
        bodyGeo.translate(w / 2, h / 2, d / 2);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: et.bodyColor, roughness: 0.5, metalness: 0.6
        });
        this.mainobj.add(new THREE.Mesh(bodyGeo, bodyMat));

        this._buildFrontFace(w, h, et);
        this._buildRearFace(w, h, d);

        this.mainobj.position.y = (this.startU - 1) * U;
        this.configObject();
        this.scn.addObjInteract(this.mainobj);
    }

    _buildFrontFace(w, h, et) {
        if (this.config.frontImage) {
            this._applyImageFace(w, h, -0.005, this.config.frontImage, false);
        } else {
            const bezelGeo = new THREE.BoxGeometry(w + 0.002, h + 0.002, 0.008);
            const bezelMat = new THREE.MeshStandardMaterial({ color: et.bezelColor, roughness: 0.4, metalness: 0.5 });
            const bezel = new THREE.Mesh(bezelGeo, bezelMat);
            bezel.position.set(w / 2, h / 2, -0.004);
            this.mainobj.add(bezel);

            if (et.isPatchPanel) {
                this._createPatchPanel(w, h, et);
            } else {
                this._createServerFront(w, h, et);
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
            (err) => console.warn(`[Equipment] Failed to load texture: ${imageUrl}`, err)
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

    _createServerFront(w, h, et) {
        const ledGeo = new THREE.SphereGeometry(0.004, 6, 6);
        const ledMat = new THREE.MeshStandardMaterial({
            color: 0x00ff00, emissive: 0x00ff00, emissiveIntensity: 3
        });
        const led = new THREE.Mesh(ledGeo, ledMat);
        led.position.set(0.01, h * 0.8, -0.008);
        this.mainobj.add(led);

        if (et.hasDrives) {
            const cols = Math.min(et.driveCount, 8);
            const rows = Math.ceil(et.driveCount / cols);
            const driveW = (w - 0.04) / cols;
            const driveH = (h - 0.01) / rows;
            const driveMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 });

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (r * cols + c >= et.driveCount) break;
                    const dw = driveW - 0.002;
                    const dh = driveH - 0.002;
                    const drive = new THREE.Mesh(new THREE.BoxGeometry(dw, dh, 0.004), driveMat);
                    drive.position.set(0.03 + c * driveW + dw / 2, 0.005 + r * driveH + dh / 2, -0.008);
                    this.mainobj.add(drive);
                }
            }
        }

        if (et.brand) {
            this.createText(w - 0.08, h * 0.5, -0.01, et.brand, this.mainobj, 0.012, 0xcccccc, 'right');
        }
    }

    _createPatchPanel(w, h, et) {
        const portCount = et.portCount || 24;
        const cols = Math.min(portCount, 24);
        const portW = (w - 0.02) / cols;
        const portMat = new THREE.MeshStandardMaterial({ color: 0x222266, roughness: 0.6 });

        for (let i = 0; i < cols; i++) {
            const port = new THREE.Mesh(
                new THREE.BoxGeometry(portW - 0.001, h * 0.5, 0.004),
                portMat
            );
            port.position.set(0.01 + i * portW + portW / 2, h / 2, -0.008);
            this.mainobj.add(port);
        }
    }

    compute() {}
}

physicalserver.INNER_WIDTH = INNER_WIDTH;
physicalserver.INNER_DEPTH = INNER_DEPTH;

export { physicalserver };
