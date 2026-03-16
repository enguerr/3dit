import * as THREE from "three";
import * as ThreeMeshUI from "three-mesh-ui";
import { networkScene } from "./scene.js";
import { infra } from "./infra.js";
import { latLngToSphere, GLOBE_RADIUS } from './worldmap.js';

const HIERARCHY_RULES = {
    'site': [ { type: 'zone', label: 'Ajouter une Zone', array: 'zones' } ],
    'zone': [ { type: 'network', label: 'Ajouter un Réseau', array: 'networks' } ],
    'network': [ { type: 'instance', label: 'Ajouter une Instance', array: null, special: 'instanceOnNetwork' } ],
    'instance': [ 
        { type: 'interface', label: 'Ajouter une Interface', array: 'interfaces' },
        { type: 'service', label: 'Ajouter un Service', array: 'services' } 
    ],
    'firewall': [ 
        { type: 'interface', label: 'Ajouter une Interface', array: 'interfaces' }
    ],
    'interface': [ { type: 'ip', label: 'Ajouter une IP', array: 'ips' } ],
    'datacenter': [ { type: 'room', label: 'Ajouter une Salle', array: 'rooms' } ],
    'room': [ { type: 'row', label: 'Ajouter une Rangée', array: 'rows' } ],
    'row': [ { type: 'rack', label: 'Ajouter un Rack', array: 'racks' } ],
    'rack': [
        { type: 'physicalserver', label: 'Ajouter un Serveur', array: 'equipment' },
        { type: 'physicalswitch', label: 'Ajouter un Switch', array: 'equipment' }
    ]
};

const EQUIPMENT_TYPE_OPTIONS = [
    'dell-poweredge-1u', 'dell-poweredge-2u', 'hpe-apollo-4u',
    'patch-panel-1u', 'cisco-copper-48', 'cisco-fiber-24', 'paloalto-1u'
];

const PHYSICAL_CLASSES = new Set(['datacenter', 'room', 'row', 'rack', 'physicalserver', 'physicalswitch', 'rackcable']);
const LOGICAL_CLASSES = new Set(['site', 'zone', 'network', 'instance', 'firewall', 'interface', 'ip', 'service', 'vrrp', 'bgp']);

const ALL_CHILD_KEYS = ['sites', 'zones', 'networks', 'instances', 'networkdevices',
    'interfaces', 'ips', 'services', 'vrrps', 'bgps', 'rooms', 'rows', 'racks', 'equipment', 'rearCables'];

const ICONS = {
    'site': 'fas fa-building', 'zone': 'fas fa-vector-square',
    'network': 'fas fa-network-wired', 'instance': 'fas fa-server',
    'firewall': 'fas fa-shield-alt', 'interface': 'fas fa-ethernet',
    'ip': 'fas fa-map-marker-alt', 'service': 'fas fa-cogs',
    'datacenter': 'fas fa-warehouse', 'room': 'fas fa-door-open', 'row': 'fas fa-grip-lines',
    'rack': 'fas fa-th-large', 'physicalserver': 'fas fa-hdd',
    'physicalswitch': 'fas fa-exchange-alt', 'rackcable': 'fas fa-plug',
    'vrrp': 'fas fa-random', 'bgp': 'fas fa-random'
};

const ENUM_VALUES = {
    'class': ['site', 'zone', 'network', 'instance', 'firewall', 'interface', 'ip', 'service', 'vrrp', 'bgp',
              'datacenter', 'room', 'row', 'rack', 'physicalserver', 'physicalswitch'],
    'type': EQUIPMENT_TYPE_OPTIONS,
    'childPosition': ['horizontal', 'vertical'],
    'position': ['direct', 'back', 'side', 'front', 'direct-back']
};

export class Builder {
    constructor(canvasId, jsonEditorId) {
        this.canvasId = canvasId;
        this.jsonEditorId = jsonEditorId;
        this.scene = null; // builderScene
        this.data = null; // currentBuilderData
        this.selectedConfig = null; // selectedObjectConfig
        this.selectedPath = null; // Path to selected object
        this.initialized = false;
        this.interactionInitialized = false;
        this.contextualAddPanel = null;
        this.contextualAddButtons = [];
        this.dragType = null;
        this.emptyScenePrompt = null;
        this.emptyScenePromptBtn = null;
        this.currentView = 'logical';
        this._physicalViewLevel = 'globe';

        // Bindings for UI calls (since HTML onclick needs global functions, we might need a bridge or event listeners)
        // For now, we will expose the instance globally or specific methods if needed.
    }

    init(animate = false) {
        if (this.initialized) {
            this.updateFromJSON(animate);
            return;
        }

        const container = document.getElementById(this.canvasId);
        if (!container) return;

        console.log("Builder: Initializing Scene...");
        this.scene = new networkScene(this.canvasId, {}, {}, '');
        this.scene._externalRenderLoop = true;
        this.scene.freeCamera();
        console.log('[INIT] networkScene created. scene.scene type:', this.scene.scene?.type,
            'uuid:', this.scene.scene?.uuid, 'children:', this.scene.scene?.children?.length,
            'controls:', !!this.scene.controls);

        const canvasEl = this.scene.renderer.domElement;
        canvasEl.style.touchAction = 'none';
        setTimeout(() => canvasEl.focus(), 200);

        let _loopCount = 0;
        const builderRenderLoop = () => {
            this._rafId = requestAnimationFrame(builderRenderLoop);
            try {
                if (!this.scene || !this.scene.renderer || !this.scene.scene || !this.scene.camera) return;
                const pDiv = this.scene.parentDiv;
                if (pDiv) {
                    const w = pDiv.offsetWidth, h = pDiv.offsetHeight;
                    if (w > 0 && h > 0 && (this.scene.renderer.domElement.width !== w || this.scene.renderer.domElement.height !== h)) {
                        this.scene.renderer.setSize(w, h);
                        this.scene.camera.aspect = w / h;
                        this.scene.camera.updateProjectionMatrix();
                    }
                }
                TWEEN.update();
                if (this.scene.controls) this.scene.controls.update();
                this.scene.renderer.render(this.scene.scene, this.scene.camera);
                try { ThreeMeshUI.update(); } catch(_e) {}
                try { if (this.scene.updateButtons) this.scene.updateButtons(); } catch(_e) {}
                if (++_loopCount === 1) {
                    console.log('[LOOP] Render loop running. scene uuid:', this.scene.scene?.uuid,
                        'children:', this.scene.scene?.children?.length,
                        'children types:', this.scene.scene?.children?.map(c => c.type || c.constructor?.name));
                }
            } catch(e) {
                console.error('[LOOP] Render error:', e);
            }
        };
        requestAnimationFrame(builderRenderLoop);

        this.updateFromJSON(true); // Always animate on first init

        if (!this.interactionInitialized) {
            this.initInteraction();
            this.interactionInitialized = true;
        }

        const doResize = () => {
            const pDiv = this.scene?.parentDiv;
            if (pDiv && this.scene?.renderer && pDiv.offsetWidth > 0 && pDiv.offsetHeight > 0) {
                const w = pDiv.offsetWidth, h = pDiv.offsetHeight;
                if (this.scene.renderer.domElement.width !== w || this.scene.renderer.domElement.height !== h) {
                    this.scene.renderer.setSize(w, h);
                    this.scene.camera.aspect = w / h;
                    this.scene.camera.updateProjectionMatrix();
                }
            }
        };
        requestAnimationFrame(doResize);
        const resizeObs = new ResizeObserver(doResize);
        if (this.scene?.parentDiv) resizeObs.observe(this.scene.parentDiv);
        
        this.initPaletteDrag();
        this.initDragDrop();
        
        this.initialized = true; 
    }

    initPaletteDrag() {
        const builder = this;
        document.querySelectorAll('.palette-item[data-type]').forEach(el => {
            el.addEventListener('dragstart', (e) => {
                builder.dragType = el.dataset.type;
                e.dataTransfer.setData('text/plain', el.dataset.type);
                e.dataTransfer.effectAllowed = 'copy';
            });
        });
        document.addEventListener('dragend', () => {
            builder.dragType = null;
            const c = builder.scene?.renderer?.domElement;
            if (c) c.style.cursor = 'default';
        });
    }

    initDragDrop() {
        const canvas = this.scene ? this.scene.renderer.domElement : document.querySelector(`#${this.canvasId} canvas`);
        if (!canvas) return;

        canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });

        canvas.addEventListener('drop', (e) => {
            e.preventDefault();
            const type = e.dataTransfer.getData('text/plain');
            if (!type) return;

            const rect = canvas.getBoundingClientRect();
            const mouse = new THREE.Vector2(
                ((e.clientX - rect.left) / rect.width) * 2 - 1,
                -((e.clientY - rect.top) / rect.height) * 2 + 1
            );

            let targetItem = null;
            if (this.scene && this.scene.camera) {
                const raycaster = new THREE.Raycaster();
                raycaster.setFromCamera(mouse, this.scene.camera);
                const intersects = raycaster.intersectObjects(this.scene.scene.children, true);
                for (let i = 0; i < intersects.length; i++) {
                    let obj = intersects[i].object;
                    if (obj.type === 'LineSegments' || obj.type === 'GridHelper' || obj.isUI) continue;
                    while (obj) {
                        if (obj.item && obj.item.config) {
                            targetItem = obj.item.config;
                            break;
                        }
                        obj = obj.parent;
                    }
                    if (targetItem) break;
                }
            }

            this.handleDrop(type, targetItem);
        });
    }

    handleDrop(type, targetConfig) {
        let data = this.data;
        if (!data) {
            try {
                data = JSON.parse(document.getElementById(this.jsonEditorId)?.value || '{"sites":[]}');
            } catch (_) {
                data = { sites: [] };
            }
        }
        this.ensureUUIDs(data);
        if (!this.data) this.data = data;

        const validTarget = targetConfig && targetConfig.class;

        if (type === 'site') {
            this.addObjectToScene('site');
            return;
        }
        if (type === 'firewall') {
            this.addObjectToScene('firewall');
            return;
        }
        if (type === 'zone' && validTarget && targetConfig.class === 'site') {
            this.selectedConfig = this.findObjectByUUID(data, targetConfig.uuid) || targetConfig;
            this.selectedPath = this.getPath(data, this.selectedConfig);
            this.addChildObject('zone', 'zones');
            return;
        }
        if (type === 'network' && validTarget && targetConfig.class === 'zone') {
            this.selectedConfig = this.findObjectByUUID(data, targetConfig.uuid) || targetConfig;
            this.selectedPath = this.getPath(data, this.selectedConfig);
            this.addChildObject('network', 'networks');
            return;
        }
        if (type === 'instance' && validTarget && targetConfig.class === 'network') {
            this.addInstanceOnNetwork(this.findObjectByUUID(data, targetConfig.uuid) || targetConfig);
            return;
        }
        if (type === 'interface' && validTarget && (targetConfig.class === 'instance' || targetConfig.class === 'firewall')) {
            this.selectedConfig = this.findObjectByUUID(data, targetConfig.uuid) || targetConfig;
            this.selectedPath = this.getPath(data, this.selectedConfig);
            this.addChildObject('interface', 'interfaces');
            return;
        }
        if (type === 'ip' && validTarget && targetConfig.class === 'interface') {
            this.selectedConfig = this.findObjectByUUID(data, targetConfig.uuid) || targetConfig;
            this.selectedPath = this.getPath(data, this.selectedConfig);
            this.addChildObject('ip', 'ips');
            return;
        }
        if (type === 'service' && validTarget && targetConfig.class === 'instance') {
            this.selectedConfig = this.findObjectByUUID(data, targetConfig.uuid) || targetConfig;
            this.selectedPath = this.getPath(data, this.selectedConfig);
            this.addChildObject('service', 'services');
            return;
        }
        if (type === 'row' && validTarget && targetConfig.class === 'datacenter') {
            this.selectedConfig = this.findObjectByUUID(data, targetConfig.uuid) || targetConfig;
            this.selectedPath = this.getPath(data, this.selectedConfig);
            this.addChildObject('row', 'rows');
            return;
        }
        if (type === 'rack' && validTarget && targetConfig.class === 'row') {
            this.selectedConfig = this.findObjectByUUID(data, targetConfig.uuid) || targetConfig;
            this.selectedPath = this.getPath(data, this.selectedConfig);
            this.addChildObject('rack', 'racks');
            return;
        }
        if ((type === 'physicalserver' || type === 'physicalswitch') && validTarget && targetConfig.class === 'rack') {
            this.selectedConfig = this.findObjectByUUID(data, targetConfig.uuid) || targetConfig;
            this.selectedPath = this.getPath(data, this.selectedConfig);
            this.addChildObject(type, 'equipment');
            return;
        }

        this.addObjectToScene(type);
    }

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    ensureUUIDs(node) {
        if (!node || typeof node !== 'object') return;
        
        // Add UUID if it's a "class" object (our domain objects) and missing one
        if (node.class && !node.uuid) {
            node.uuid = this.generateUUID();
        }

        if (Array.isArray(node)) {
            node.forEach(child => this.ensureUUIDs(child));
        } else {
            Object.keys(node).forEach(key => {
                // Avoid recursing into some properties if needed, but usually safe
                this.ensureUUIDs(node[key]);
            });
        }
    }

    findObjectByUUID(root, uuid) {
        if (!root || typeof root !== 'object') return null;
        if (root.uuid === uuid) return root;

        if (Array.isArray(root)) {
            for (let child of root) {
                const found = this.findObjectByUUID(child, uuid);
                if (found) return found;
            }
        } else {
            for (let key in root) {
                if (Object.prototype.hasOwnProperty.call(root, key)) {
                    const found = this.findObjectByUUID(root[key], uuid);
                    if (found) return found;
                }
            }
        }
        return null;
    }

    migrateNetworkLinks(node, networks) {
        if (!node || typeof node !== 'object') return;

        if (node.class === 'interface' && node.net) {
            // Check if node.net is a name that matches a network
            const targetNet = networks.find(n => n.name === node.net && n.uuid !== node.net);
            if (targetNet && targetNet.uuid) {
                console.log(`Builder: Migrating interface net link from '${node.net}' to UUID '${targetNet.uuid}'`);
                node.net = targetNet.uuid;
            }
        }

        if (Array.isArray(node)) {
            node.forEach(child => this.migrateNetworkLinks(child, networks));
        } else {
            Object.keys(node).forEach(key => {
                this.migrateNetworkLinks(node[key], networks);
            });
        }
    }

    updateFromJSON(animate = false, skipCamera = false) {
        if (!this.scene) {
            console.warn("Builder: updateFromJSON called but scene is null");
            return;
        }

        try {
            // console.log("Builder: Updating from JSON...");
            const editor = document.getElementById(this.jsonEditorId);
            const content = editor.value;
            if (!content) return;

            const data = JSON.parse(content);
            
            // 0. Ensure UUIDs are present everywhere
            this.ensureUUIDs(data);
            
            // 0b. Migrate Network Links (Name -> UUID)
            const availableNetworks = this.collectNetworks(data);
            this.migrateNetworkLinks(data, availableNetworks);

            // Update editor value if we added UUIDs or migrated links so they are saved
            const contentWithUUIDs = JSON.stringify(data, null, 4);
            if (contentWithUUIDs !== content) {
                console.log("Builder: UUIDs added/normalized or Links migrated in JSON content.");
                editor.value = contentWithUUIDs;
            }
            
            this.data = data; // Store reference

            // Restore selection reference
            if (this.selectedConfig) {
                let freshObj = null;
                const currentUUID = this.selectedConfig.uuid;
                
                if (currentUUID) {
                    console.log("Builder: Attempting restore by UUID:", currentUUID);
                    freshObj = this.findObjectByUUID(this.data, currentUUID);
                }

                if (freshObj) {
                    console.log("Builder: Selection restored by UUID.");
                    this.selectedConfig = freshObj;
                    this.renderInspector(this.selectedConfig);
                } else {
                    // Fallback to path if UUID failed or missing
                    if (this.selectedPath) {
                        console.log("Builder: UUID restore failed. Trying path:", this.selectedPath);
                        freshObj = this.resolvePath(this.data, this.selectedPath);
                        if (freshObj) {
                             console.log("Builder: Selection restored by Path.");
                             this.selectedConfig = freshObj;
                             this.renderInspector(this.selectedConfig);
                        } else {
                            // Fallback Content
                             const fallbackPath = this.findPathByContent(this.data, this.selectedConfig);
                             if (fallbackPath) {
                                  console.log("Builder: Selection restored by Content match.");
                                  this.selectedPath = fallbackPath;
                                  this.selectedConfig = this.resolvePath(this.data, fallbackPath);
                                  this.renderInspector(this.selectedConfig);
                             } else {
                                 console.warn("Builder: All restore methods failed. Deselecting.");
                                 this.deselectObject();
                             }
                        }
                    } else {
                        console.warn("Builder: No UUID and no Path. Deselecting.");
                        this.deselectObject();
                    }
                }
            } else if (!this.selectedPath) {
                this.deselectObject();
            }

            // 1. Update Camera
            let targetPos = new THREE.Vector3(0, 10, 20);
            let targetLook = new THREE.Vector3(0, 5, 10);

            if (data.camera && data.camera.position) {
                // Priority 1: Explicit root camera config
                targetPos.set(data.camera.position.x, data.camera.position.y, data.camera.position.z);
                if (data.camera.target) {
                    targetLook.set(data.camera.target.x, data.camera.target.y, data.camera.target.z);
                }
            } else if (data.pois && data.pois.length > 0) {
                // Priority 2: First POI (like Viewer)
                const poi = data.pois[0];
                if (poi.camera) targetPos.set(poi.camera.x, poi.camera.y, poi.camera.z);
                if (poi.target) targetLook.set(poi.target.x, poi.target.y, poi.target.z);
            }

            if (!skipCamera) {
                if (this.scene.animateCamera && (animate || !this.initialized)) {
                     if (!this.initialized) {
                         this.scene.camera.position.copy(targetPos).multiplyScalar(2);
                     }
                     this.scene.animateCamera(targetPos, targetLook, 2000); 
                } else {
                     this.scene.camera.position.copy(targetPos);
                     this.scene.camera.lookAt(targetLook);
                }
            }

            // 2. Rebuild Scene
            this.hideContextualAddButtons();
            this.hideEmptyScenePrompt();
            // Clean up existing children (except camera attachments if any)
            // Note: networkScene structure attaches objects to 'scene' or 'children' array logic.
            // We follow the cleanup logic from before.
            
            if (this.scene.children && this.scene.children.length > 0) {
                for (let i = this.scene.children.length - 1; i >= 0; i--) {
                    const child = this.scene.children[i];
                    if (child.nav && this.scene.camera) this.scene.camera.remove(child.nav);
                    if (child.mainobj) this.scene.scene.remove(child.mainobj);
                    this.scene.children.splice(i, 1);
                }
            }

            if (this.scene.resetConnectors) this.scene.resetConnectors();
            else this.scene.connectors = [];

            const newInfra = new infra(data, this.scene);
            this.scene.registerProject(newInfra);
            this._currentInfra = newInfra;

            newInfra.init(false, 'logical');
            this._applyViewVisibility();
            newInfra.compute();

            const width = newInfra.getWidth();
            const depth = newInfra.getInnerDepth();
            newInfra.move({x: -width/2, z: -depth, y: 0});

            // Force matrix update so that connectors use the new world positions
            if (this.scene.scene) this.scene.scene.updateMatrixWorld(true);

            // Update connectors only (avoid calling scene.compute() which might double-apply layout offsets)
            if (this.scene.connectors) {
                for (let conn of this.scene.connectors) {
                    if (conn.compute) conn.compute();
                }
            }

            if (!data.sites || data.sites.length === 0) {
                this.showEmptyScenePrompt();
            } else {
                this.hideEmptyScenePrompt();
            }
            
            if (this.selectedPath) {
                const restored = this.resolvePath(this.data, this.selectedPath);
                if (restored && typeof restored === 'object' && restored.class) {
                    this.selectedConfig = restored;
                }
            }

            this.renderTree();
            this.updatePanelVisibility();
            this.updateBreadcrumb();
            if (this.selectedConfig) {
                this.renderInspector(this.selectedConfig);
            }

        } catch (e) {
            console.error("Builder Update Error:", e);
        }
    }

    async _applyViewVisibility() {
        if (!this._currentInfra) return;
        const inf = this._currentInfra;
        const isPhysical = this.currentView === 'physical';

        if (isPhysical && inf.ensurePhysical) {
            await inf.ensurePhysical();
        }

        if (inf.physicalContainer && inf.mainobj) {
            if (isPhysical) {
                if (!inf.physicalContainer.parent) inf.mainobj.add(inf.physicalContainer);
            } else {
                inf.physicalContainer.removeFromParent();
            }
        }
        if (inf.container) {
            if (isPhysical) {
                inf.container.removeFromParent();
            } else {
                if (!inf.container.parent && inf.mainobj) inf.mainobj.add(inf.container);
            }
        }
        if (this.scene && this.scene.connectorContainer) {
            this.scene.connectorContainer.visible = !isPhysical;
        }
    }

    switchView(view, skipReset = false) {
        this.currentView = view;

        document.getElementById('btn_logical_view')?.classList.toggle('active', view === 'logical');
        document.getElementById('btn_physical_view')?.classList.toggle('active', view === 'physical');

        if (view !== 'physical' || this._physicalViewLevel !== 'globe') {
            this._stopGlobeIdleAnimation();
        }

        if (view === 'physical') {
            this._physicalViewLevel = 'globe';
            if (this._currentInfra) this._currentInfra.showGlobeView();
        }

        if (!this.scene || !this.scene.camera) return;

        this._applyViewVisibility();
        if (this.scene.scene) this.scene.scene.updateMatrixWorld(true);

        if (skipReset) return;

        if (view === 'physical') {
            const gc = this._getGlobeWorldCenter();
            let targetPos = new THREE.Vector3(gc.x, gc.y + 18, gc.z + 32);
            let targetLook = gc.clone();
            if (this._currentInfra && this._currentInfra._globe) {
                this._animateCameraWithOrbit(targetPos, targetLook);
                this._applyGlobeControls(1600);
                this._startGlobeIdleAnimation();
                return;
            } else if (this._currentInfra && this._currentInfra.datacenters && this._currentInfra.datacenters.length > 0) {
                if (this.scene.scene) this.scene.scene.updateMatrixWorld(true);
                const box = new THREE.Box3();
                for (const dc of this._currentInfra.datacenters) {
                    if (dc.mainobj) box.expandByObject(dc.mainobj);
                }
                if (!box.isEmpty()) {
                    const center = new THREE.Vector3();
                    const size = new THREE.Vector3();
                    box.getCenter(center);
                    box.getSize(size);
                    const maxDim = Math.max(size.x, size.y, size.z, 2);
                    targetLook.copy(center);
                    targetPos.set(
                        center.x + maxDim * 0.6,
                        center.y + maxDim * 0.5,
                        center.z + maxDim * 0.7
                    );
                }
            }
            this._animateCameraWithOrbit(targetPos, targetLook);
        } else {
            const targetPos = new THREE.Vector3(0, 30, 40);
            const targetLook = new THREE.Vector3(0, 5, 0);
            if (this.data && this.data.pois && this.data.pois[0]) {
                const poi = this.data.pois[0];
                if (poi.camera) { targetPos.set(poi.camera.x, poi.camera.y, poi.camera.z); }
                if (poi.target) { targetLook.set(poi.target.x, poi.target.y, poi.target.z); }
            }
            this._animateCameraWithOrbit(targetPos, targetLook);
        }
    }

    _animateCameraWithOrbit(targetPos, targetLook, duration = 1500) {
        if (this.scene.animateCamera) {
            this.scene.animateCamera(targetPos, targetLook, duration);
        } else {
            this.scene.camera.position.copy(targetPos);
            this.scene.camera.lookAt(targetLook);
            if (this.scene.controls) {
                this.scene.controls.target.copy(targetLook);
                this.scene.controls.update();
            }
        }
    }

    _flyCameraAlongPath(points, lookTarget, duration = 2000) {
        return new Promise(resolve => {
            const cam = this.scene?.camera;
            const ctrl = this.scene?.controls;
            if (!cam || points.length < 2) { resolve(); return; }

            if (ctrl) ctrl.enabled = false;

            const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5);
            const startLook = ctrl ? ctrl.target.clone() : cam.getWorldDirection(new THREE.Vector3()).add(cam.position);
            const endLook = lookTarget.clone();
            const start = performance.now();

            const flyEase = (t) => {
                if (t < 0.3) return 0.5 * Math.pow(t / 0.3, 2) * 0.3;
                if (t < 0.7) return 0.15 + (t - 0.3) * (0.55 / 0.4);
                const tail = (t - 0.7) / 0.3;
                return 0.70 + 0.30 * (1 - Math.pow(1 - tail, 3));
            };

            const lookEase = (t) => {
                if (t < 0.2) return t * 0.1 / 0.2;
                if (t < 0.6) return 0.1 + (t - 0.2) * (0.4 / 0.4);
                return 0.5 + (t - 0.6) / 0.4 * 0.5;
            };

            const tick = () => {
                const elapsed = performance.now() - start;
                const t = Math.min(elapsed / duration, 1);

                const pathT = flyEase(t);
                const pos = curve.getPointAt(Math.min(pathT, 1));
                cam.position.copy(pos);

                const lt = lookEase(t);
                const look = startLook.clone().lerp(endLook, lt);
                cam.lookAt(look);

                if (t < 1) {
                    requestAnimationFrame(tick);
                } else {
                    if (ctrl) {
                        ctrl.target.copy(endLook);
                        ctrl.enabled = true;
                        ctrl.update();
                    }
                    resolve();
                }
            };
            requestAnimationFrame(tick);
        });
    }

    _fadeToBlack() {
        return new Promise(resolve => {
            const el = document.getElementById('scene_fade_overlay');
            if (!el) { resolve(); return; }
            el.classList.remove('fast');
            el.classList.add('active');
            setTimeout(resolve, 520);
        });
    }

    _fadeFromBlack(fast = false) {
        return new Promise(resolve => {
            const el = document.getElementById('scene_fade_overlay');
            if (!el) { resolve(); return; }
            if (fast) el.classList.add('fast');
            else el.classList.remove('fast');
            el.classList.remove('active');
            setTimeout(resolve, fast ? 320 : 520);
        });
    }

    resetCamera() {
        if (!this.scene) return;
        const targetPos = new THREE.Vector3(0, 10, 20);
        const targetLook = new THREE.Vector3(0, 5, 10);
        if (this.scene.controls) {
            this.scene.controls.reset();
            this.scene.controls.target.copy(targetLook);
            this.scene.controls.update();
        }
        this.scene.camera.position.copy(targetPos);
        this.scene.camera.lookAt(targetLook);
    }

    showEmptyScenePrompt() {
        this.hideEmptyScenePrompt();
        if (!this.scene || !this.scene.camera) return;
        const container = new ThreeMeshUI.Block({
            justifyContent: 'center',
            alignContent: 'center',
            fontFamily: 'https://unpkg.com/three-mesh-ui/examples/assets/Roboto-msdf.json',
            fontTexture: 'https://unpkg.com/three-mesh-ui/examples/assets/Roboto-msdf.png',
            fontSize: 0.8,
            padding: 0.3,
            borderRadius: 0.8,
            backgroundOpacity: 0.8
        });
        container.position.set(0, 0, -15);
        container.scale.set(0.25, 0.25, 0.25);
        const btn = this.createUIButton('Créer un premier site', () => this.addObjectToScene('site'));
        this.scene.addObjInteract(btn);
        container.add(btn);
        this.scene.camera.add(container);
        this.emptyScenePrompt = container;
        this.emptyScenePromptBtn = btn;
    }

    hideEmptyScenePrompt() {
        if (this.emptyScenePromptBtn && this.scene && this.scene.objInteracts) {
            const idx = this.scene.objInteracts.indexOf(this.emptyScenePromptBtn);
            if (idx >= 0) this.scene.objInteracts.splice(idx, 1);
        }
        if (this.emptyScenePrompt && this.scene && this.scene.camera) {
            this.scene.camera.remove(this.emptyScenePrompt);
        }
        this.emptyScenePrompt = null;
        this.emptyScenePromptBtn = null;
    }

    createUIButton(text, callback) {
        const button = new ThreeMeshUI.Block({
            width: 3.5, height: 1.5, padding: 0.05,
            justifyContent: 'center', alignContent: 'center',
            margin: 0.1, borderRadius: 0.3,
            backgroundColor: new THREE.Color(0x333333)
        });

        button.add(new ThreeMeshUI.Text({ content: text, fontSize: 0.5 }));

        button.setupState({
            state: 'selected',
            attributes: { offset: 0.02, backgroundColor: new THREE.Color(0x777777), fontColor: new THREE.Color(0x222222) },
            onSet: callback
        });
        button.setupState({
            state: 'hovered',
            attributes: { offset: 0.02, backgroundColor: new THREE.Color(0x999999), backgroundOpacity: 1, fontColor: new THREE.Color(0xffffff) }
        });
        button.setupState({
            state: 'idle',
            attributes: { offset: 0.035, backgroundColor: new THREE.Color(0x333333), backgroundOpacity: 0.8, fontColor: new THREE.Color(0xffffff) }
        });

        button.isUI = true;
        return button;
    }

    initInteraction() {
        const canvas = this.scene ? this.scene.renderer.domElement : document.querySelector(`#${this.canvasId} canvas`);
        if (!canvas) { console.error('Builder: NO CANVAS FOUND for interaction!'); return; }
        console.log('Builder: initInteraction on canvas', canvas.tagName, canvas.width, canvas.height, canvas.getBoundingClientRect());

        const mouse = new THREE.Vector2();
        const raycaster = new THREE.Raycaster();
        let mouseDownPos = new THREE.Vector2();
        let hoveredItem = null;
        let lastFoundObj = null;

        const highlightGeo = new THREE.BoxGeometry(1, 1, 1);
        const highlightMat = new THREE.MeshBasicMaterial({ color: 0xffff00, opacity: 0.3, transparent: true, depthTest: false });
        const highlightMesh = new THREE.Mesh(highlightGeo, highlightMat);
        highlightMesh.visible = false;
        highlightMesh.renderOrder = 999;
        if (this.scene && this.scene.scene) this.scene.scene.add(highlightMesh);

        const dropHighlightMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, opacity: 0.4, transparent: true, depthTest: false });
        const dropHighlightMesh = new THREE.Mesh(highlightGeo.clone(), dropHighlightMat);
        dropHighlightMesh.visible = false;
        dropHighlightMesh.renderOrder = 998;
        if (this.scene && this.scene.scene) this.scene.scene.add(dropHighlightMesh);

        const isDropTargetValid = (dragType, config) => {
            if (!config || !config.class) return false;
            if (dragType === 'zone' && config.class === 'site') return true;
            if (dragType === 'network' && config.class === 'zone') return true;
            if (dragType === 'instance' && config.class === 'network') return true;
            if (dragType === 'interface' && (config.class === 'instance' || config.class === 'firewall')) return true;
            if (dragType === 'ip' && config.class === 'interface') return true;
            if (dragType === 'service' && config.class === 'instance') return true;
            if (dragType === 'row' && config.class === 'datacenter') return true;
            if (dragType === 'rack' && config.class === 'row') return true;
            if ((dragType === 'physicalserver' || dragType === 'physicalswitch') && config.class === 'rack') return true;
            return false;
        };

        let _dbgN = 0;
        let _hoveredPort = null;
        canvas.addEventListener('pointermove', (event) => {
            const rect = canvas.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return;
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            if (this.scene && this.scene.mouse) {
                this.scene.mouse.x = mouse.x;
                this.scene.mouse.y = mouse.y;
            }

            if (this.scene && this.scene.camera && this.scene.scene) {
                raycaster.setFromCamera(mouse, this.scene.camera);
                const intersects = raycaster.intersectObjects(this.scene.scene.children, true);

                const PICK_PRIORITY = {
                    'physicalserver': 5, 'physicalswitch': 5,
                    'rack': 4, 'row': 3, 'datacenter': 1,
                    'instance': 4, 'firewall': 4, 'network': 3,
                    'interface': 5, 'ip': 5, 'service': 5,
                    'zone': 2, 'site': 1
                };

                const _isPickable = (cls) => {
                    if (this.currentView !== 'physical') return true;
                    const lvl = this._physicalViewLevel;
                    if (lvl === 'globe') return cls === 'datacenter';
                    if (lvl === 'datacenter') return cls === 'rack';
                    if (lvl === 'rack') return cls === 'physicalserver' || cls === 'physicalswitch' || cls === 'rack';
                    return true;
                };

                let portHit = null;
                if (this._physicalViewLevel === 'rack' && this._rackViewSide === 'back') {
                    for (let i = 0; i < intersects.length; i++) {
                        const obj = intersects[i].object;
                        if (obj.userData && obj.userData.isPort) {
                            portHit = obj;
                            break;
                        }
                    }
                }

                if (_hoveredPort && _hoveredPort !== portHit && _hoveredPort !== this._cableSourcePort) {
                    _hoveredPort.material = _hoveredPort.userData.defaultMat;
                }
                if (portHit && portHit !== this._cableSourcePort) {
                    portHit.material = portHit.userData.hoverMat;
                }
                _hoveredPort = portHit;

                let foundObj = null;
                let foundPriority = 0;
                if (intersects.length > 0) {
                    for (let i = 0; i < intersects.length; i++) {
                        let obj = intersects[i].object;
                        if (obj.type === 'LineSegments' || obj.type === 'GridHelper' || obj.isUI || obj === highlightMesh || obj === dropHighlightMesh) continue;
                        if (obj.name === '_globeSphere') continue;
                        let candidate = obj;
                        while (candidate) {
                            if (candidate.item && candidate.item.config) {
                                const cls = candidate.item.config.class;
                                if (!_isPickable(cls)) break;
                                if (candidate.item.config.ghost) break;
                                const pri = PICK_PRIORITY[cls] || 2;

                                if (this.selectedConfig && candidate.item.config !== this.selectedConfig) {
                                    if (!this.isDescendantOf(candidate.item.config, this.selectedConfig)) {
                                        break;
                                    }
                                }

                                if (pri > foundPriority) {
                                    foundObj = candidate;
                                    hoveredItem = candidate.item;
                                    foundPriority = pri;
                                }
                                break;
                            }
                            candidate = candidate.parent;
                        }
                    }
                }

                if (portHit) {
                    highlightMesh.visible = false;
                    dropHighlightMesh.visible = false;
                    canvas.style.cursor = 'crosshair';
                } else if (foundObj) {
                    lastFoundObj = foundObj;
                    const itemClass = hoveredItem?.config?.class;
                    const isContainer = (itemClass === 'datacenter' || itemClass === 'row' || itemClass === 'site');

                    if (isContainer) {
                        highlightMesh.visible = false;
                        dropHighlightMesh.visible = false;
                        canvas.style.cursor = 'pointer';
                    } else {
                        const box = new THREE.Box3().setFromObject(foundObj);
                        const size = new THREE.Vector3(); box.getSize(size);
                        const center = new THREE.Vector3(); box.getCenter(center);
                        const scaleVec = size.clone().multiplyScalar(1.05);

                        if (this.dragType && isDropTargetValid(this.dragType, hoveredItem?.config)) {
                            dropHighlightMesh.visible = true;
                            dropHighlightMesh.position.copy(center);
                            dropHighlightMesh.scale.copy(scaleVec);
                            highlightMesh.visible = false;
                            if (dropHighlightMesh.parent !== this.scene.scene) this.scene.scene.add(dropHighlightMesh);
                            canvas.style.cursor = 'copy';
                        } else {
                            highlightMesh.visible = !this.dragType;
                            highlightMesh.position.copy(center);
                            highlightMesh.scale.copy(scaleVec);
                            dropHighlightMesh.visible = false;
                            if (highlightMesh.parent !== this.scene.scene) this.scene.scene.add(highlightMesh);
                            canvas.style.cursor = this.dragType ? 'not-allowed' : 'pointer';
                        }
                    }
                } else {
                    lastFoundObj = null;
                    highlightMesh.visible = false;
                    dropHighlightMesh.visible = false;
                    hoveredItem = null;
                    canvas.style.cursor = this.dragType ? 'not-allowed' : 'default';
                }
            }
        });

        canvas.addEventListener('pointerleave', () => {
            if (this.scene && this.scene.mouse) {
                this.scene.mouse.x = null;
                this.scene.mouse.y = null;
            }
        });

        let _longPressTimer = null;
        let _equipDrag = null;
        let _dragPreview = null;

        const _cleanupDrag = () => {
            if (_longPressTimer) { clearTimeout(_longPressTimer); _longPressTimer = null; }
            if (_dragPreview) { _dragPreview.removeFromParent(); _dragPreview.geometry?.dispose(); _dragPreview.material?.dispose(); _dragPreview = null; }
            if (_equipDrag) {
                if (this.scene && this.scene.controls) this.scene.controls.enabled = true;
            }
            _equipDrag = null;
        };

        const _isEquipment = (item) => {
            const cls = item?.config?.class;
            return cls === 'physicalserver' || cls === 'physicalswitch';
        };

        const _findParentRack = (config) => {
            if (!this.data?.physical?.datacenters) return null;
            for (const dc of this.data.physical.datacenters) {
                for (const rm of (dc.rooms || [])) {
                    for (const row of (rm.rows || [])) {
                        if (!row.racks) continue;
                        for (const rk of row.racks) {
                            if (!rk.equipment) continue;
                            if (rk.equipment.includes(config)) return rk;
                        }
                    }
                }
            }
            return null;
        };

        canvas.addEventListener('pointerdown', (event) => {
            mouseDownPos.x = event.clientX;
            mouseDownPos.y = event.clientY;
            if (this.scene) this.scene.selectState = true;

            _cleanupDrag();
            if (hoveredItem && _isEquipment(hoveredItem)) {
                const dragItem = hoveredItem;
                const dragMesh = lastFoundObj;
                _longPressTimer = setTimeout(() => {
                    _longPressTimer = null;
                    const rackConfig = _findParentRack(dragItem.config);
                    if (!rackConfig) return;

                    const sizeU = dragItem.config.sizeU || 1;
                    const previewGeo = new THREE.BoxGeometry(0.52, sizeU * 0.0445, 0.05);
                    const previewMat = new THREE.MeshStandardMaterial({
                        color: 0x00ccff, emissive: 0x00ccff, emissiveIntensity: 0.4,
                        transparent: true, opacity: 0.4, depthWrite: false
                    });
                    _dragPreview = new THREE.Mesh(previewGeo, previewMat);
                    _dragPreview.renderOrder = 999;
                    if (dragMesh && dragMesh.parent) {
                        dragMesh.parent.add(_dragPreview);
                    } else {
                        this.scene.scene.add(_dragPreview);
                    }

                    _equipDrag = {
                        config: dragItem.config,
                        rackConfig: rackConfig,
                        mesh: dragMesh,
                        sizeU: sizeU,
                        originalStartU: dragItem.config.startU || 1,
                        targetU: dragItem.config.startU || 1
                    };

                    if (this.scene && this.scene.controls) this.scene.controls.enabled = false;
                    canvas.style.cursor = 'grabbing';
                }, 300);
            }
        });

        canvas.addEventListener('pointermove', (event) => {
            if (!_equipDrag || !_dragPreview || !this.scene) return;

            const rect = canvas.getBoundingClientRect();
            const mx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            const my = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            const tmpMouse = new THREE.Vector2(mx, my);
            const tmpRay = new THREE.Raycaster();
            tmpRay.setFromCamera(tmpMouse, this.scene.camera);

            const rackObj = _equipDrag.mesh;
            let rackGroup = rackObj;
            while (rackGroup && !(rackGroup.item?.config?.class === 'rack')) {
                rackGroup = rackGroup.parent;
            }
            if (!rackGroup) return;

            const localOrigin = new THREE.Vector3();
            const localDir = new THREE.Vector3();
            const inv = new THREE.Matrix4().copy(rackGroup.matrixWorld).invert();

            localOrigin.copy(tmpRay.ray.origin).applyMatrix4(inv);
            localDir.copy(tmpRay.ray.direction).transformDirection(inv);

            if (Math.abs(localDir.y) > 0.001) {
                const planes = [];
                const totalU = _equipDrag.rackConfig.units || 42;
                for (let u = 1; u <= totalU - _equipDrag.sizeU + 1; u++) {
                    const py = 0.1 + (u - 1) * 0.0445 + (_equipDrag.sizeU * 0.0445) / 2;
                    const t = (py - localOrigin.y) / localDir.y;
                    if (t > 0) planes.push({ u, dist: Math.abs(t), py });
                }
                planes.sort((a, b) => a.dist - b.dist);
                if (planes.length > 0) {
                    let targetU = planes[0].u;
                    if (targetU !== _equipDrag.config.startU) {
                        const occupied = new Set();
                        (_equipDrag.rackConfig.equipment || []).forEach(eq => {
                            if (eq === _equipDrag.config) return;
                            const s = eq.startU || 1;
                            const sz = eq.sizeU || 1;
                            for (let u = s; u < s + sz; u++) occupied.add(u);
                        });
                        occupied.add((_equipDrag.rackConfig.units || 42));

                        let fits = true;
                        for (let s = 0; s < _equipDrag.sizeU; s++) {
                            if (occupied.has(targetU + s)) { fits = false; break; }
                        }
                        _equipDrag.targetU = fits ? targetU : _equipDrag.originalStartU;
                        _dragPreview.material.color.setHex(fits ? 0x00ff88 : 0xff4444);
                        _dragPreview.material.emissive.setHex(fits ? 0x00ff88 : 0xff4444);
                    }
                    const py = 0.1 + (_equipDrag.targetU - 1) * 0.0445 + (_equipDrag.sizeU * 0.0445) / 2;
                    _dragPreview.position.set(0.26, py - 0.1, 0);
                }
            }
        }, { passive: true });

        canvas.addEventListener('pointerup', (event) => {
            if (this.scene) this.scene.selectState = false;

            if (_equipDrag) {
                if (_equipDrag.targetU !== _equipDrag.originalStartU) {
                    _equipDrag.config.startU = _equipDrag.targetU;
                    const editor = document.getElementById(this.jsonEditorId);
                    editor.value = JSON.stringify(this.data, null, 4);
                    this.updateFromJSON(false, true);
                }
                _cleanupDrag();
                canvas.style.cursor = 'default';
                return;
            }

            _cleanupDrag();

            const dx = Math.abs(event.clientX - mouseDownPos.x);
            const dy = Math.abs(event.clientY - mouseDownPos.y);
            if (dx < 3 && dy < 3) {
                if (hoveredItem) this.selectObject(hoveredItem, lastFoundObj);
                else this.deselectObject();
            }
        });

        canvas.addEventListener('dblclick', () => {
            if (_hoveredPort && this._physicalViewLevel === 'rack' && this._rackViewSide === 'back') {
                this._handlePortClick(_hoveredPort);
                return;
            }
            if (hoveredItem) this.selectObject(hoveredItem, lastFoundObj);
        });

        canvas.addEventListener('click', () => {
            if (_hoveredPort && this._physicalViewLevel === 'rack' && this._rackViewSide === 'back') {
                this._handlePortClick(_hoveredPort);
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                if (this._cableSourcePort) {
                    this._clearCableSource();
                } else {
                    this.deselectObject();
                }
            }
        });
    }

    selectObject(item, mesh = null) {
        this.selectedConfig = item.config;

        if (this.data) {
            let path = this.getPath(this.data, this.selectedConfig);
            if (!path) {
                path = this.findPathByContent(this.data, this.selectedConfig);
                if (path) {
                    this.selectedConfig = this.resolvePath(this.data, path);
                }
            }
            this.selectedPath = path;
        }

        const cls = this.selectedConfig?.class;
        if (cls) {
            const needPhysical = PHYSICAL_CLASSES.has(cls);
            const needLogical = LOGICAL_CLASSES.has(cls);
            if (needPhysical && this.currentView !== 'physical') {
                this.switchView('physical', true);
            } else if (needLogical && this.currentView !== 'logical') {
                this.switchView('logical', true);
            }
        }

        if (this.currentView === 'physical' && this._currentInfra) {
            if (cls === 'datacenter') {
                const dcObj = this._findDcObject(this.selectedConfig);
                const hasRooms = dcObj && dcObj.config && dcObj.config.rooms && dcObj.config.rooms.length > 0;
                if (dcObj && hasRooms) {
                    const isAlreadyActive = dcObj === this._currentInfra._activeDatacenter;
                    if (this._physicalViewLevel === 'globe') {
                        this._transitionGlobeToDC(dcObj);
                        return;
                    } else if (!isAlreadyActive && (this._physicalViewLevel === 'datacenter' || this._physicalViewLevel === 'rack' || this._physicalViewLevel === 'server')) {
                        this._transitionDCToDC(dcObj);
                        return;
                    }
                }
                if (this._physicalViewLevel !== 'globe') {
                    this.updatePanelVisibility();
                    this.renderInspector(this.selectedConfig);
                    this.renderTree();
                    this.updateBreadcrumb();
                    return;
                }
                return;
            } else if ((cls === 'room' || cls === 'row') && this._physicalViewLevel !== 'globe') {
                if (this._physicalViewLevel === 'server' || this._physicalViewLevel === 'rack') {
                    this._unwindPhysicalState(true);
                }
                this._physicalViewLevel = 'datacenter';
                const dc = this._currentInfra._activeDatacenter;
                if (dc) {
                    const interior = this._getInteriorCameraPositions(dc);
                    if (this.scene && this.scene.camera) {
                        this.scene.camera.position.copy(interior.camPos);
                        if (this.scene.controls) {
                            this.scene.controls.target.copy(interior.target);
                            this.scene.controls.enableRotate = true;
                            this.scene.controls.enablePan = true;
                            this.scene.controls.update();
                        }
                    }
                    this._applyInteriorControls();
                }
                this.updatePanelVisibility();
                this.renderInspector(this.selectedConfig);
                this.renderTree();
                this.updateBreadcrumb();
                return;
            } else if (cls === 'rack' && (this._physicalViewLevel === 'datacenter' || this._physicalViewLevel === 'rack' || this._physicalViewLevel === 'server')) {
                if (this._physicalViewLevel === 'server') {
                    this._exitServerViewInstant();
                }
                if (this._physicalViewLevel === 'rack' || this._physicalViewLevel === 'server') {
                    this._removeRackViewButtons();
                    this._currentInfra.backFromRackView();
                }
                this._physicalViewLevel = 'rack';
                const rackObj = this._findRackObject(this.selectedConfig);
                if (rackObj) {
                    this._currentInfra.showRackView(rackObj);
                    this._setupRackFrontalView(rackObj);
                }
                this.updatePanelVisibility();
                this.renderInspector(this.selectedConfig);
                this.renderTree();
                this.updateBreadcrumb();
                return;
            } else if ((cls === 'physicalserver' || cls === 'physicalswitch') && (this._physicalViewLevel === 'rack' || this._physicalViewLevel === 'server')) {
                if (this._physicalViewLevel === 'server') {
                    this._exitServerViewInstant();
                }
                this._physicalViewLevel = 'server';
                this._showServerExplodedView(this.selectedConfig, mesh);
                this.updatePanelVisibility();
                this.renderInspector(this.selectedConfig);
                this.renderTree();
                this.updateBreadcrumb();
                return;
            }
        }

        if (this.scene && this.scene.scene) this.scene.scene.updateMatrixWorld(true);

        this.updatePanelVisibility();
        this.renderInspector(this.selectedConfig);
        this.renderTree();
        this.updateBreadcrumb();

        if (mesh) {
            this.focusOnMesh(mesh);
        } else if (this.selectedConfig) {
            this.focusOnConfig(this.selectedConfig);
        }
    }

    _getExteriorDoorWorldPos(dcObj) {
        dcObj.mainobj.updateWorldMatrix(true, true);
        const doorLocal = new THREE.Vector3(0, 0.7, -2.01);
        return dcObj.mainobj.localToWorld(doorLocal);
    }

    _getInteriorCameraPositions(dcObj) {
        const dcWorld = new THREE.Vector3();
        dcObj.mainobj.updateWorldMatrix(true, true);
        dcObj.mainobj.getWorldPosition(dcWorld);

        const box = new THREE.Box3();
        for (const rm of dcObj.rooms) {
            if (rm.mainobj) box.expandByObject(rm.mainobj);
        }

        let fw, fd, wh, ox, oz;
        if (!box.isEmpty()) {
            const localMin = dcObj.mainobj.worldToLocal(box.min.clone());
            const localMax = dcObj.mainobj.worldToLocal(box.max.clone());
            fw = localMax.x - localMin.x;
            fd = localMax.z - localMin.z;
            wh = localMax.y - localMin.y;
            ox = localMin.x;
            oz = localMin.z;
        } else {
            fw = 30; fd = 20; wh = 3.5; ox = 0; oz = 0;
        }

        const camPos = new THREE.Vector3(
            dcWorld.x + ox + fw * 0.4,
            dcWorld.y + Math.max(wh * 0.6, 2),
            dcWorld.z + oz + fd * 0.35
        );
        const target = new THREE.Vector3(
            dcWorld.x + ox + fw * 0.5,
            dcWorld.y + wh * 0.25,
            dcWorld.z + oz + fd * 0.5
        );

        return { camPos, target, fw, fd, wh };
    }

    async _transitionGlobeToDC(dcObj) {
        this._stopGlobeIdleAnimation();
        const gc = this._getGlobeWorldCenter();

        await this._approachDCExterior(dcObj, gc);

        await this._fadeToBlack();

        this._physicalViewLevel = 'datacenter';
        this._currentInfra.showDatacenterView(dcObj);

        if (this.scene && this.scene.scene) this.scene.scene.updateMatrixWorld(true);

        this.updatePanelVisibility();
        this.renderInspector(this.selectedConfig);
        this.renderTree();
        this.updateBreadcrumb();

        const interior = this._getInteriorCameraPositions(dcObj);
        if (this.scene && this.scene.camera) {
            this.scene.camera.position.copy(interior.camPos);
            if (this.scene.controls) {
                this.scene.controls.target.copy(interior.target);
                this.scene.controls.update();
            }
        }

        await this._fadeFromBlack();
        this._applyInteriorControls();
    }

    async _approachDCExterior(dcObj, gc) {
        const lat = dcObj._globeLat || dcObj.config.lat || 0;
        const lng = dcObj._globeLng || dcObj.config.lng || 0;
        const dcLocalPos = latLngToSphere(lat, lng, GLOBE_RADIUS + 0.05);
        const normal = dcLocalPos.clone().normalize();

        const up = new THREE.Vector3(0, 1, 0);
        const tangent = up.clone().cross(normal).normalize();
        if (tangent.lengthSq() < 0.001) tangent.set(1, 0, 0);
        const binormal = normal.clone().cross(tangent).normalize();

        const doorWorld = this._getExteriorDoorWorldPos(dcObj);
        const camCurrent = this.scene.camera.position.clone();

        dcObj.mainobj.updateWorldMatrix(true, true);
        const insideDoor = new THREE.Vector3(0, 0.7, -1.0);
        dcObj.mainobj.localToWorld(insideDoor);

        const p1 = normal.clone().multiplyScalar(GLOBE_RADIUS + 8).add(gc)
            .add(tangent.clone().multiplyScalar(2.5))
            .add(binormal.clone().multiplyScalar(1.5));

        const p2 = normal.clone().multiplyScalar(GLOBE_RADIUS + 3).add(gc)
            .add(tangent.clone().multiplyScalar(1.0))
            .add(binormal.clone().multiplyScalar(0.6));

        const p3 = normal.clone().multiplyScalar(GLOBE_RADIUS + 1.2).add(gc)
            .add(tangent.clone().multiplyScalar(0.3))
            .add(binormal.clone().multiplyScalar(0.15));

        const p4 = normal.clone().multiplyScalar(GLOBE_RADIUS + 0.5).add(gc);

        const p5 = doorWorld.clone().lerp(p4, 0.3);

        const p6 = doorWorld.clone();

        const p7 = insideDoor.clone();

        await this._flyCameraAlongPath([camCurrent, p1, p2, p3, p4, p5, p6, p7], insideDoor, 3800);
    }

    _applyInteriorControls() {
        if (this.scene && this.scene.controls) {
            this.scene.controls.enablePan = true;
            this.scene.controls.minDistance = 1;
            this.scene.controls.maxDistance = 100;
            this.scene.controls.enableDamping = true;
            this.scene.controls.dampingFactor = 0.05;
            this.scene.controls.update();
        }
    }

    _setupRackFrontalView(rackObj, side = 'front') {
        const cam = this.scene?.camera;
        const ctrl = this.scene?.controls;
        if (!cam || !rackObj?.mainobj) return;

        rackObj.mainobj.updateWorldMatrix(true, true);
        const rw = 0.6;
        const rh = rackObj.rackTotalHeight || 2.0;
        const rd = 1.1;

        const center = new THREE.Vector3(rw / 2, rh / 2, rd / 2);
        rackObj.mainobj.localToWorld(center);

        let camLocal;
        if (side === 'back') {
            camLocal = new THREE.Vector3(rw / 2, rh / 2, rd + 1.5);
        } else {
            camLocal = new THREE.Vector3(rw / 2, rh / 2, -1.5);
        }
        const camWorld = camLocal.clone();
        rackObj.mainobj.localToWorld(camWorld);

        cam.position.copy(camWorld);
        if (ctrl) {
            ctrl.target.copy(center);
            ctrl.enableRotate = false;
            ctrl.enablePan = false;
            ctrl.enableZoom = true;
            ctrl.minDistance = 0.5;
            ctrl.maxDistance = 4;
            ctrl.update();
        }

        this._rackViewSide = side;
        this._rackViewObj = rackObj;
        this._createRackViewButtons();
    }

    _createRackViewButtons() {
        this._removeRackViewButtons();
        const container = document.getElementById('builder_canvas');
        if (!container) return;

        const wrap = document.createElement('div');
        wrap.id = '_rack_view_btns';
        wrap.style.cssText = 'position:absolute;bottom:12px;top:auto;left:50%;transform:translateX(-50%);display:flex;gap:3px;z-index:100;pointer-events:none;width:auto;height:auto;';

        const makBtn = (label, icon, side) => {
            const btn = document.createElement('button');
            btn.innerHTML = `<i class="fas fa-${icon}" style="margin-right:3px;font-size:8px;"></i>${label}`;
            btn.style.cssText = 'pointer-events:auto;background:rgba(15,20,30,0.8);border:1px solid rgba(0,170,255,0.2);color:#7aabda;padding:2px 7px;border-radius:3px;cursor:pointer;font-size:9px;font-family:inherit;backdrop-filter:blur(4px);transition:all 0.2s;line-height:1.3;';
            btn.onmouseenter = () => { btn.style.borderColor = '#00ccff'; btn.style.color = '#fff'; };
            btn.onmouseleave = () => { btn.style.borderColor = 'rgba(0,170,255,0.2)'; btn.style.color = '#7aabda'; };
            if (side === this._rackViewSide) {
                btn.style.borderColor = '#00aadd';
                btn.style.color = '#cceeff';
                btn.style.background = 'rgba(0,80,140,0.35)';
            }
            btn.onclick = (e) => {
                e.stopPropagation();
                if (this._rackViewObj && side !== this._rackViewSide) {
                    this._animateRackViewSwitch(side);
                }
            };
            return btn;
        };

        wrap.appendChild(makBtn('Avant', 'eye', 'front'));
        wrap.appendChild(makBtn('Arrière', 'exchange-alt', 'back'));
        container.appendChild(wrap);
    }

    _removeRackViewButtons() {
        const el = document.getElementById('_rack_view_btns');
        if (el) el.remove();
    }

    _animateRackViewSwitch(targetSide) {
        const rackObj = this._rackViewObj;
        if (!rackObj?.mainobj) return;
        const cam = this.scene?.camera;
        const ctrl = this.scene?.controls;
        if (!cam) return;

        rackObj.mainobj.updateWorldMatrix(true, true);
        const rw = 0.6;
        const rh = rackObj.rackTotalHeight || 2.0;
        const rd = 1.1;

        const center = new THREE.Vector3(rw / 2, rh / 2, rd / 2);
        rackObj.mainobj.localToWorld(center);

        let camLocal;
        if (targetSide === 'back') {
            camLocal = new THREE.Vector3(rw / 2, rh / 2, rd + 1.5);
        } else {
            camLocal = new THREE.Vector3(rw / 2, rh / 2, -1.5);
        }
        const targetPos = camLocal.clone();
        rackObj.mainobj.localToWorld(targetPos);

        const startPos = cam.position.clone();
        const startTarget = ctrl ? ctrl.target.clone() : center.clone();
        const dur = 600;
        const t0 = performance.now();

        if (ctrl) ctrl.enabled = false;

        const tick = () => {
            const t = Math.min((performance.now() - t0) / dur, 1);
            const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
            cam.position.lerpVectors(startPos, targetPos, e);
            const look = startTarget.clone().lerp(center, e);
            cam.lookAt(look);

            if (t < 1) {
                requestAnimationFrame(tick);
            } else {
                if (ctrl) {
                    ctrl.target.copy(center);
                    ctrl.enabled = true;
                    ctrl.enableRotate = false;
                    ctrl.enablePan = false;
                    ctrl.enableZoom = true;
                    ctrl.minDistance = 0.5;
                    ctrl.maxDistance = 4;
                    ctrl.update();
                }
                this._rackViewSide = targetSide;
                this._createRackViewButtons();
                if (targetSide === 'back') {
                    this._rebuildRearCables();
                } else {
                    this._cleanRearCables();
                }
                this._clearCableSource();
            }
        };
        requestAnimationFrame(tick);
    }

    _handlePortClick(portMesh) {
        const ud = portMesh.userData;
        if (!ud || !ud.isPort) return;

        if (!this._cableSourcePort) {
            this._cableSourcePort = portMesh;
            const selectedMat = new THREE.MeshStandardMaterial({
                color: 0xff8800, emissive: 0xff6600, emissiveIntensity: 1.2,
                roughness: 0.3, metalness: 0.5
            });
            portMesh.material = selectedMat;
            this._cableSourceSelectedMat = selectedMat;
            this._updateCablingStatus(`Port source : ${ud.equipmentName} / ${ud.portName}`);
        } else {
            const srcUd = this._cableSourcePort.userData;
            if (srcUd.equipmentConfig === ud.equipmentConfig) {
                this._updateCablingStatus('Sélectionnez un port sur un AUTRE équipement');
                return;
            }
            this._createPortCable(this._cableSourcePort, portMesh);
            this._clearCableSource();
        }
    }

    _clearCableSource() {
        if (this._cableSourcePort) {
            this._cableSourcePort.material = this._cableSourcePort.userData.defaultMat;
            this._cableSourcePort = null;
            this._cableSourceSelectedMat = null;
        }
        this._removeCablingStatus();
    }

    _updateCablingStatus(msg) {
        let panel = document.getElementById('_cabling_status');
        if (!panel) {
            const container = document.getElementById('builder_canvas');
            if (!container) return;
            panel = document.createElement('div');
            panel.id = '_cabling_status';
            panel.style.cssText = 'position:absolute;top:12px;left:50%;transform:translateX(-50%);z-index:110;pointer-events:none;width:auto;height:auto;top:auto;bottom:auto;';
            panel.style.top = '12px';
            container.appendChild(panel);
        }
        panel.innerHTML = `<div style="background:rgba(10,15,25,0.85);border:1px solid rgba(255,136,0,0.5);color:#ffcc66;padding:4px 12px;border-radius:4px;font-size:10px;font-family:inherit;backdrop-filter:blur(4px);white-space:nowrap;">
            <i class="fas fa-plug" style="margin-right:5px;color:#ff8800;"></i>${msg}
        </div>`;
    }

    _removeCablingStatus() {
        const el = document.getElementById('_cabling_status');
        if (el) el.remove();
    }

    _createPortCable(srcPort, dstPort) {
        const srcUd = srcPort.userData;
        const dstUd = dstPort.userData;

        const rackConfig = this._currentInfra?._activeRack?.config;
        if (!rackConfig) return;
        if (!rackConfig.rearCables) rackConfig.rearCables = [];

        const cableDef = {
            class: 'rackcable',
            type: 'copper',
            fromEquipment: srcUd.equipmentName,
            fromPort: srcUd.portName,
            fromPortIndex: srcUd.portIndex,
            toEquipment: dstUd.equipmentName,
            toPort: dstUd.portName,
            toPortIndex: dstUd.portIndex
        };
        rackConfig.rearCables.push(cableDef);

        this._renderRearCable(srcPort, dstPort, cableDef);
        this._markPortConnected(srcPort);
        this._markPortConnected(dstPort);

        this._updateCablingStatus(`Câble créé : ${srcUd.equipmentName}/${srcUd.portName} → ${dstUd.equipmentName}/${dstUd.portName}`);
        setTimeout(() => this._removeCablingStatus(), 2500);

        this.renderTree();
        this.updateJsonEditor();
    }

    _markPortConnected(portMesh) {
        const connectedMat = new THREE.MeshStandardMaterial({
            color: 0x22cc44, emissive: 0x11aa33, emissiveIntensity: 0.6,
            roughness: 0.3, metalness: 0.5
        });
        portMesh.material = connectedMat;
        portMesh.userData.defaultMat = connectedMat;
        portMesh.userData.connected = true;
    }

    _renderRearCable(srcPort, dstPort, cableDef) {
        const rackGroup = this._currentInfra?._rackIsolateGroup;
        if (!rackGroup) return;

        const srcWorld = new THREE.Vector3();
        srcPort.getWorldPosition(srcWorld);
        rackGroup.worldToLocal(srcWorld);

        const dstWorld = new THREE.Vector3();
        dstPort.getWorldPosition(dstWorld);
        rackGroup.worldToLocal(dstWorld);

        const midY = Math.max(srcWorld.y, dstWorld.y) + 0.06;
        const midX = (srcWorld.x + dstWorld.x) / 2;
        const z = Math.max(srcWorld.z, dstWorld.z) + 0.03;

        const points = [
            srcWorld.clone(),
            new THREE.Vector3(srcWorld.x, midY, z),
            new THREE.Vector3(midX, midY + 0.02, z + 0.02),
            new THREE.Vector3(dstWorld.x, midY, z),
            dstWorld.clone()
        ];
        const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.3);
        const tubeGeo = new THREE.TubeGeometry(curve, 48, 0.003, 6, false);

        const color = cableDef.type === 'fiber' ? 0xffdd22 : 0x44aaff;
        const tubeMat = new THREE.MeshStandardMaterial({
            color, emissive: color, emissiveIntensity: 0.5,
            roughness: 0.4, metalness: 0.5
        });
        const cable = new THREE.Mesh(tubeGeo, tubeMat);
        cable.name = '_rearCable';
        rackGroup.add(cable);

        if (!this._rearCableMeshes) this._rearCableMeshes = [];
        this._rearCableMeshes.push(cable);
    }

    _rebuildRearCables() {
        this._cleanRearCables();
        const rackObj = this._currentInfra?._activeRack;
        if (!rackObj?.config?.rearCables) return;

        const equipMap = {};
        for (const eq of rackObj.equipment) {
            equipMap[eq.config.name] = eq;
        }

        for (const cDef of rackObj.config.rearCables) {
            const srcEquip = equipMap[cDef.fromEquipment];
            const dstEquip = equipMap[cDef.toEquipment];
            if (!srcEquip || !dstEquip) continue;

            const srcPorts = srcEquip.rearPorts || [];
            const dstPorts = dstEquip.rearPorts || [];
            const srcPort = srcPorts[cDef.fromPortIndex];
            const dstPort = dstPorts[cDef.toPortIndex];
            if (!srcPort || !dstPort) continue;

            this._renderRearCable(srcPort, dstPort, cDef);
            this._markPortConnected(srcPort);
            this._markPortConnected(dstPort);
        }
    }

    _cleanRearCables() {
        if (this._rearCableMeshes) {
            for (const m of this._rearCableMeshes) {
                m.removeFromParent();
                m.geometry?.dispose();
                m.material?.dispose();
            }
        }
        this._rearCableMeshes = [];
    }

    _showServerExplodedView(config, mesh) {
        this._cleanExplodedView();
        this._explodedAnimId = null;

        const rackGroup = this._currentInfra?._rackIsolateGroup;
        if (!rackGroup) return;

        let serverObj = null;
        if (mesh) {
            let candidate = mesh;
            while (candidate) {
                if (candidate.item && candidate.item.config === config) { serverObj = candidate; break; }
                if (candidate.item && (candidate.item.config?.class === 'physicalserver' || candidate.item.config?.class === 'physicalswitch')) { serverObj = candidate; break; }
                candidate = candidate.parent;
            }
            if (!serverObj) serverObj = mesh.parent?.item?.mainobj || mesh;
        }
        if (!serverObj) {
            const rackObj = this._currentInfra._activeRack;
            if (rackObj) {
                for (const eq of rackObj.equipment) {
                    if (eq.config === config) { serverObj = eq.mainobj; break; }
                }
                if (!serverObj) {
                    for (const eq of rackObj.equipment) {
                        if (eq.config.name === config.name && eq.config.class === config.class) { serverObj = eq.mainobj; break; }
                    }
                }
            }
        }
        if (!serverObj) { console.warn('[ExplodedView] serverObj not found for', config.name); return; }

        this._explodedFadedMats = [];
        rackGroup.traverse(child => {
            if (!child.isMesh && !child.isLineSegments) return;
            if (this._isDescendantOf(child, serverObj)) return;
            if (child.material) {
                const mat = child.material;
                if (!mat._origOpacity) mat._origOpacity = mat.opacity ?? 1;
                if (!mat._origTransparent) mat._origTransparent = mat.transparent;
                mat.transparent = true;
                this._explodedFadedMats.push(mat);
            }
        });

        this._explodedGroup = new THREE.Group();
        this._explodedGroup.name = '_serverExploded';
        rackGroup.add(this._explodedGroup);

        const rW = 0.52, U = 0.0445;
        const sizeU = config.sizeU || 1;
        const sH = sizeU * U;
        const sD = 0.935;
        const baseY = ((config.startU || 1) - 1) * U;

        const slideZ = -(sD * 1.5);

        const coverGroup = new THREE.Group();
        const coverMat = new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.4, metalness: 0.6 });
        const coverMesh = new THREE.Mesh(new THREE.BoxGeometry(rW, 0.002, sD), coverMat);
        coverMesh.position.set(rW / 2, 0, -sD / 2);
        coverGroup.add(coverMesh);
        coverGroup.position.set(0, baseY + sH, sD);
        this._explodedGroup.add(coverGroup);

        const cpuCount = config.cpu || 2;
        const cpuType = config.cpuType || 'Intel Xeon Gold 6248R';
        const cpuCores = config.cpuCores || 24;
        const cpuFreq = config.cpuFreq || '3.0 GHz';
        const ramSlots = config.ramSlots || 12;
        const ramPerSlot = config.ramPerSlot || '32 Go DDR4';
        const ramTotal = config.ram || (ramSlots * 32) + ' Go';
        const nicCount = config.nicCount || 4;
        const nics = config.nics || [
            { port: 'eth0', vlan: 'VLAN 100', ip: '10.0.1.10' },
            { port: 'eth1', vlan: 'VLAN 200', ip: '10.0.2.10' },
            { port: 'eth2', vlan: 'MGMT', ip: '192.168.1.10' },
            { port: 'eth3', vlan: 'iSCSI', ip: '172.16.0.10' },
        ];
        const gpuCount = config.gpuCount || 0;
        const gpuModel = config.gpuModel || 'NVIDIA A100 40GB';

        const compScale = 8;
        const compCenterX = rW / 2;
        const compBaseY = baseY + sH + 0.15;
        const RISE = 0.25;
        const RISE_GAP = 0.15;
        let layerIdx = 0;

        const components = [];

        const cpuGrp = new THREE.Group();
        cpuGrp.name = 'cpu_layer';
        const cpuMat = new THREE.MeshStandardMaterial({ color: 0x228833, emissive: 0x115522, emissiveIntensity: 0.5, roughness: 0.3, metalness: 0.5 });
        for (let i = 0; i < cpuCount; i++) {
            const x = compCenterX + (i - (cpuCount - 1) / 2) * 0.12;
            const base = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.01, 0.08), cpuMat);
            base.position.set(x, 0, sD * 0.35);
            cpuGrp.add(base);
            const hs = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.04, 0.09),
                new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.25, metalness: 0.8 }));
            hs.position.set(x, 0.03, sD * 0.35);
            cpuGrp.add(hs);
            for (let fi = 0; fi < 6; fi++) {
                const fin = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.002, 0.006),
                    new THREE.MeshStandardMaterial({ color: 0xbbbbbb, metalness: 0.7, roughness: 0.3 }));
                fin.position.set(x, 0.015 + fi * 0.005, sD * 0.35);
                cpuGrp.add(fin);
            }
        }
        cpuGrp.position.set(0, compBaseY, 0);
        this._explodedGroup.add(cpuGrp);
        components.push({ grp: cpuGrp, targetY: compBaseY + RISE + layerIdx * RISE_GAP,
            label: `CPU: ${cpuCount}x ${cpuType}`, detail: `${cpuCores} cores, ${cpuFreq}` });
        layerIdx++;

        const ramGrp = new THREE.Group();
        ramGrp.name = 'ram_layer';
        const ramMat = new THREE.MeshStandardMaterial({ color: 0x2255aa, emissive: 0x112255, emissiveIntensity: 0.5, roughness: 0.3, metalness: 0.5 });
        const rSlotW = Math.min((rW - 0.04) / ramSlots, 0.04);
        for (let i = 0; i < ramSlots; i++) {
            const stick = new THREE.Mesh(new THREE.BoxGeometry(rSlotW * 0.6, 0.05, 0.008), ramMat);
            stick.position.set(0.02 + i * rSlotW + rSlotW / 2, 0.025, sD * 0.6);
            ramGrp.add(stick);
        }
        ramGrp.position.set(0, compBaseY, 0);
        this._explodedGroup.add(ramGrp);
        components.push({ grp: ramGrp, targetY: compBaseY + RISE + layerIdx * RISE_GAP,
            label: `RAM: ${ramSlots}x ${ramPerSlot}`, detail: `Total: ${ramTotal}` });
        layerIdx++;

        const nicGrp = new THREE.Group();
        nicGrp.name = 'nic_layer';
        const nicBaseMat = new THREE.MeshStandardMaterial({ color: 0x885522, emissive: 0x331100, emissiveIntensity: 0.3, roughness: 0.4, metalness: 0.5 });
        for (let i = 0; i < nicCount; i++) {
            const x = compCenterX + (i - (nicCount - 1) / 2) * 0.06;
            const card = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.015, 0.05), nicBaseMat);
            card.position.set(x, 0.008, sD * 0.15);
            nicGrp.add(card);
            const led = new THREE.Mesh(new THREE.SphereGeometry(0.003, 6, 6),
                new THREE.MeshStandardMaterial({ color: 0x00dd44, emissive: 0x00bb33, emissiveIntensity: 3 }));
            led.position.set(x + 0.015, 0.016, sD * 0.15);
            nicGrp.add(led);
        }
        nicGrp.position.set(0, compBaseY, 0);
        this._explodedGroup.add(nicGrp);
        const nicDetail = nics.slice(0, nicCount).map(n => `${n.port}: ${n.vlan} (${n.ip})`).join(' | ');
        components.push({ grp: nicGrp, targetY: compBaseY + RISE + layerIdx * RISE_GAP,
            label: `Réseau: ${nicCount} ports`, detail: nicDetail });
        layerIdx++;

        if (gpuCount > 0) {
            const gpuGrp = new THREE.Group();
            gpuGrp.name = 'gpu_layer';
            const gpuBoardMat = new THREE.MeshStandardMaterial({ color: 0x447711, emissive: 0x223300, emissiveIntensity: 0.4, roughness: 0.3, metalness: 0.6 });
            for (let i = 0; i < gpuCount; i++) {
                const x = compCenterX + (i - (gpuCount - 1) / 2) * 0.15;
                const board = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.01, 0.07), gpuBoardMat);
                board.position.set(x, 0, sD * 0.5);
                gpuGrp.add(board);
                const shroud = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.03, 0.06),
                    new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4, metalness: 0.7 }));
                shroud.position.set(x, 0.02, sD * 0.5);
                gpuGrp.add(shroud);
            }
            gpuGrp.position.set(0, compBaseY, 0);
            this._explodedGroup.add(gpuGrp);
            components.push({ grp: gpuGrp, targetY: compBaseY + RISE + layerIdx * RISE_GAP,
                label: `GPU: ${gpuCount}x ${gpuModel}`, detail: '' });
            layerIdx++;
        }

        const light1 = new THREE.PointLight(0xeef4ff, 4, 5);
        light1.position.set(rW / 2, compBaseY + 0.8, sD / 2 - 0.5);
        this._explodedGroup.add(light1);
        const amb = new THREE.AmbientLight(0xccddff, 0.6);
        this._explodedGroup.add(amb);

        this._explodedLabels = [];

        const ANIM_DUR = 1800;
        const startTime = performance.now();
        const serverStartZ = serverObj.position.z;

        const animTick = () => {
            const elapsed = performance.now() - startTime;
            const t = Math.min(elapsed / ANIM_DUR, 1);
            const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

            const fadeT = Math.min(t / 0.4, 1);
            const targetOpacity = 0.06;
            for (const mat of this._explodedFadedMats) {
                mat.opacity = mat._origOpacity * (1 - fadeT) + targetOpacity * fadeT;
            }

            const slideT = Math.max(0, Math.min((t - 0.1) / 0.4, 1));
            const slideEase = 1 - Math.pow(1 - slideT, 3);
            serverObj.position.z = serverStartZ + slideZ * slideEase;

            const coverT = Math.max(0, Math.min((t - 0.35) / 0.3, 1));
            const coverEase = 1 - Math.pow(1 - coverT, 3);
            coverGroup.rotation.x = coverEase * Math.PI * 0.55;
            coverGroup.position.z = sD + slideZ * slideEase;

            const riseT = Math.max(0, Math.min((t - 0.5) / 0.5, 1));
            const riseEase = 1 - Math.pow(1 - riseT, 3);
            for (let i = 0; i < components.length; i++) {
                const c = components[i];
                const delay = i * 0.12;
                const ct = Math.max(0, Math.min((riseT - delay) / (1 - delay), 1));
                const ce = 1 - Math.pow(1 - ct, 3);
                c.grp.position.y = compBaseY + (c.targetY - compBaseY) * ce;
                c.grp.position.z = slideZ * slideEase;
            }

            if (t >= 1 && this._explodedLabels.length === 0) {
                for (const c of components) {
                    const worldPos = new THREE.Vector3();
                    c.grp.getWorldPosition(worldPos);
                    this._addExplodedLabel(c.label, c.detail,
                        rW + 0.15, c.grp.position.y + 0.02, c.grp.position.z + sD * 0.4);
                }
                this._addExplodedLabel(config.name || 'Serveur', config.type || '',
                    rW / 2, baseY - 0.06, slideZ + sD / 2, true);
            }

            if (t < 1) {
                this._explodedAnimId = requestAnimationFrame(animTick);
            } else {
                this._explodedAnimId = null;
            }
        };

        this._explodedAnimId = requestAnimationFrame(animTick);

        this._explodedServerObj = serverObj;
        this._explodedServerStartZ = serverStartZ;
        this._explodedSlideZ = slideZ;
        this._explodedSD = sD;
        this._explodedCompBaseY = compBaseY;
        this._explodedComponents = components;
        this._explodedCoverGroup = coverGroup;

        const cam = this.scene?.camera;
        const ctrl = this.scene?.controls;
        if (cam && rackGroup) {
            rackGroup.updateWorldMatrix(true, true);
            const lookY = baseY + sH / 2 + 0.1;

            const camLocal = new THREE.Vector3(rW / 2, lookY + 0.3, slideZ - 0.6);
            const camWorld = camLocal.clone();
            rackGroup.localToWorld(camWorld);

            const targetLocal = new THREE.Vector3(rW / 2, lookY, sD * 0.3 + slideZ);
            const targetWorld = targetLocal.clone();
            rackGroup.localToWorld(targetWorld);

            cam.position.copy(camWorld);
            if (ctrl) {
                ctrl.target.copy(targetWorld);
                ctrl.enableRotate = true;
                ctrl.enablePan = true;
                ctrl.enableZoom = true;
                ctrl.minDistance = 0.2;
                ctrl.maxDistance = 3;
                ctrl.update();
            }
        }
    }

    _isDescendantOf(child, ancestor) {
        let p = child;
        while (p) {
            if (p === ancestor) return true;
            p = p.parent;
        }
        return false;
    }

    _addExplodedLabel(title, detail, x, y, z, isTitle = false) {
        if (!this._explodedGroup) return;
        const canvas = document.createElement('canvas');
        const cw = 1024, ch = isTitle ? 128 : 96;
        canvas.width = cw; canvas.height = ch;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, cw, ch);

        if (!isTitle) {
            ctx.fillStyle = 'rgba(0, 10, 30, 0.75)';
            const r = 12;
            ctx.beginPath();
            ctx.moveTo(r, 0); ctx.lineTo(cw - r, 0); ctx.quadraticCurveTo(cw, 0, cw, r);
            ctx.lineTo(cw, ch - r); ctx.quadraticCurveTo(cw, ch, cw - r, ch);
            ctx.lineTo(r, ch); ctx.quadraticCurveTo(0, ch, 0, ch - r);
            ctx.lineTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0);
            ctx.closePath(); ctx.fill();
            ctx.strokeStyle = 'rgba(0,170,255,0.5)';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        ctx.fillStyle = isTitle ? '#00ddff' : '#aaddff';
        ctx.font = isTitle ? 'bold 42px monospace' : 'bold 28px monospace';
        ctx.textAlign = isTitle ? 'center' : 'left';
        ctx.fillText(title, isTitle ? cw / 2 : 16, isTitle ? 50 : 34);

        if (detail) {
            ctx.fillStyle = '#7799bb';
            ctx.font = isTitle ? '24px monospace' : '18px monospace';
            const maxW = cw - 32;
            let txt = detail;
            if (ctx.measureText(txt).width > maxW) {
                while (txt.length > 3 && ctx.measureText(txt + '…').width > maxW) txt = txt.slice(0, -1);
                txt += '…';
            }
            ctx.fillText(txt, isTitle ? cw / 2 : 16, isTitle ? 85 : 68);
        }

        const tex = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
        const sprite = new THREE.Sprite(mat);
        const scaleW = isTitle ? 0.5 : 0.4;
        const scaleH = scaleW * ch / cw;
        sprite.scale.set(scaleW, scaleH, 1);
        sprite.position.set(x, y, z);
        this._explodedGroup.add(sprite);
        if (!this._explodedLabels) this._explodedLabels = [];
        this._explodedLabels.push(sprite);
    }

    _unwindPhysicalState(instant = true) {
        if (this._physicalViewLevel === 'server') {
            this._exitServerViewInstant();
            this._physicalViewLevel = 'rack';
        }
        if (this._physicalViewLevel === 'rack') {
            this._removeRackViewButtons();
            this._cleanRearCables();
            this._clearCableSource();
            if (this._currentInfra) this._currentInfra.backFromRackView();
            this._physicalViewLevel = 'datacenter';
        }
    }

    _exitServerViewInstant() {
        if (this._explodedAnimId) {
            cancelAnimationFrame(this._explodedAnimId);
            this._explodedAnimId = null;
        }
        if (this._explodedServerObj && this._explodedServerStartZ !== undefined) {
            this._explodedServerObj.position.z = this._explodedServerStartZ;
        }
        if (this._explodedFadedMats) {
            for (const mat of this._explodedFadedMats) {
                mat.opacity = mat._origOpacity ?? 1;
                mat.transparent = mat._origTransparent ?? false;
                delete mat._origOpacity;
                delete mat._origTransparent;
            }
            this._explodedFadedMats = null;
        }
        this._cleanExplodedView();
    }

    _exitServerView(instant = false) {
        if (instant) {
            this._exitServerViewInstant();
            return Promise.resolve();
        }

        return new Promise(resolve => {
            if (this._explodedAnimId) {
                cancelAnimationFrame(this._explodedAnimId);
                this._explodedAnimId = null;
            }

            const serverObj = this._explodedServerObj;
            const startZ = this._explodedServerStartZ;
            const slideZ = this._explodedSlideZ || 0;
            const sD = this._explodedSD || 0.935;
            const compBaseY = this._explodedCompBaseY || 0;
            const components = this._explodedComponents || [];
            const coverGroup = this._explodedCoverGroup;
            const fadedMats = this._explodedFadedMats || [];

            const currentServerZ = serverObj ? serverObj.position.z : 0;
            const currentCoverRot = coverGroup ? coverGroup.rotation.x : 0;
            const currentCoverZ = coverGroup ? coverGroup.position.z : sD;
            const compCurrentY = components.map(c => c.grp.position.y);
            const compCurrentZ = components.map(c => c.grp.position.z);
            const matCurrentOpacity = fadedMats.map(m => m.opacity);

            if (this._explodedLabels) {
                for (const lbl of this._explodedLabels) {
                    if (lbl.parent) lbl.parent.remove(lbl);
                    if (lbl.material) {
                        if (lbl.material.map) lbl.material.map.dispose();
                        lbl.material.dispose();
                    }
                }
                this._explodedLabels = [];
            }

            const ANIM_DUR = 800;
            const startTime = performance.now();

            const tick = () => {
                const elapsed = performance.now() - startTime;
                const t = Math.min(elapsed / ANIM_DUR, 1);
                const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

                const riseT = Math.min(t / 0.35, 1);
                for (let i = 0; i < components.length; i++) {
                    components[i].grp.position.y = compCurrentY[i] + (compBaseY - compCurrentY[i]) * riseT;
                    components[i].grp.position.z = compCurrentZ[i] + (0 - compCurrentZ[i]) * riseT;
                }

                const coverRT = Math.max(0, Math.min((t - 0.2) / 0.3, 1));
                if (coverGroup) {
                    coverGroup.rotation.x = currentCoverRot * (1 - coverRT);
                    coverGroup.position.z = currentCoverZ + (sD - currentCoverZ) * coverRT;
                }

                const slideRT = Math.max(0, Math.min((t - 0.4) / 0.35, 1));
                const slideRE = 1 - Math.pow(1 - slideRT, 3);
                if (serverObj && startZ !== undefined) {
                    serverObj.position.z = currentServerZ + (startZ - currentServerZ) * slideRE;
                }

                const fadeRT = Math.max(0, Math.min((t - 0.5) / 0.5, 1));
                for (let i = 0; i < fadedMats.length; i++) {
                    const orig = fadedMats[i]._origOpacity ?? 1;
                    fadedMats[i].opacity = matCurrentOpacity[i] + (orig - matCurrentOpacity[i]) * fadeRT;
                }

                if (t < 1) {
                    this._explodedAnimId = requestAnimationFrame(tick);
                } else {
                    this._explodedAnimId = null;
                    for (const mat of fadedMats) {
                        mat.opacity = mat._origOpacity ?? 1;
                        mat.transparent = mat._origTransparent ?? false;
                        delete mat._origOpacity;
                        delete mat._origTransparent;
                    }
                    this._explodedFadedMats = null;
                    if (serverObj && startZ !== undefined) {
                        serverObj.position.z = startZ;
                    }
                    this._cleanExplodedView();
                    resolve();
                }
            };
            this._explodedAnimId = requestAnimationFrame(tick);
        });
    }

    _cleanExplodedView() {
        if (this._explodedGroup) {
            this._explodedGroup.traverse(c => {
                if (c.geometry) c.geometry.dispose();
                if (c.material) {
                    if (c.material.map) c.material.map.dispose();
                    c.material.dispose();
                }
            });
            this._explodedGroup.removeFromParent();
            this._explodedGroup = null;
        }
        this._explodedLabels = [];
        this._explodedServerObj = null;
    }

    async _transitionDCToDC(dcObj) {
        this._unwindPhysicalState(true);

        const gc = this._getGlobeWorldCenter();
        const prevDC = this._currentInfra._activeDatacenter;
        const prevLat = prevDC ? (prevDC._globeLat || prevDC.config.lat || 0) : 0;
        const prevLng = prevDC ? (prevDC._globeLng || prevDC.config.lng || 0) : 0;

        await this._fadeToBlack();

        this._physicalViewLevel = 'globe';
        this._currentInfra.showGlobeView();

        if (this.scene && this.scene.scene) this.scene.scene.updateMatrixWorld(true);

        const prevLocalPos = latLngToSphere(prevLat, prevLng, GLOBE_RADIUS + 0.05);
        const prevNormal = prevLocalPos.clone().normalize();
        const prevCam = prevNormal.clone().multiplyScalar(GLOBE_RADIUS + 4).add(gc);

        if (this.scene && this.scene.camera) {
            this.scene.camera.position.copy(prevCam);
            if (this.scene.controls) {
                this.scene.controls.target.copy(gc);
                this.scene.controls.update();
            }
        }

        await this._fadeFromBlack();

        this.selectedConfig = dcObj.config;
        if (this.data) {
            this.selectedPath = this.getPath(this.data, this.selectedConfig);
        }

        await this._approachDCExterior(dcObj, gc);

        await this._fadeToBlack();

        this._physicalViewLevel = 'datacenter';
        this._currentInfra.showDatacenterView(dcObj);

        if (this.scene && this.scene.scene) this.scene.scene.updateMatrixWorld(true);

        this.updatePanelVisibility();
        this.renderInspector(this.selectedConfig);
        this.renderTree();
        this.updateBreadcrumb();

        const interior = this._getInteriorCameraPositions(dcObj);
        if (this.scene && this.scene.camera) {
            this.scene.camera.position.copy(interior.camPos);
            if (this.scene.controls) {
                this.scene.controls.target.copy(interior.target);
                this.scene.controls.update();
            }
        }

        await this._fadeFromBlack();
        this._applyInteriorControls();
    }

    _findDcObject(config) {
        if (!this._currentInfra) return null;
        for (const dc of this._currentInfra.datacenters) {
            if (dc.config === config) return dc;
        }
        return null;
    }

    _findRackObject(config) {
        if (!this._currentInfra) return null;
        const rk = this._currentInfra.rackIndex[config.name];
        if (rk) return rk;
        for (const dc of this._currentInfra.datacenters) {
            for (const rm of (dc.rooms || [])) {
                for (const row of (rm.rows || [])) {
                    for (const r of (row.rackList || [])) {
                        if (r.config === config) return r;
                    }
                }
            }
        }
        return null;
    }

    async deselectObject() {
        if (this.currentView === 'physical' && this._currentInfra) {
            if (this._physicalViewLevel === 'server') {
                await this._exitServerView(false);
                this._physicalViewLevel = 'rack';
                const rackConfig = this._currentInfra._activeRack?.config || null;
                this.selectedConfig = rackConfig;
                this.selectedPath = rackConfig ? this.getPath(this.data, rackConfig) : null;
                if (this._currentInfra._activeRack) {
                    this._setupRackFrontalView(this._currentInfra._activeRack);
                }
                this.updatePanelVisibility();
                this.renderInspector(this.selectedConfig);
                this.renderTree();
                this.updateBreadcrumb();
                return;
            }
            if (this._physicalViewLevel === 'rack') {
                this._physicalViewLevel = 'datacenter';
                this._removeRackViewButtons();
                this._cleanRearCables();
                this._clearCableSource();
                this._currentInfra.backFromRackView();
                this.selectedConfig = this._currentInfra._activeDatacenter?.config || null;
                this.selectedPath = this.selectedConfig ? this.getPath(this.data, this.selectedConfig) : null;
                this.updatePanelVisibility();
                this.renderInspector(this.selectedConfig);
                this.renderTree();
                this.updateBreadcrumb();
                const interior = this._getInteriorCameraPositions(this._currentInfra._activeDatacenter);
                if (this.scene && this.scene.camera) {
                    this.scene.camera.position.copy(interior.camPos);
                    if (this.scene.controls) {
                        this.scene.controls.target.copy(interior.target);
                        this.scene.controls.enableRotate = true;
                        this.scene.controls.enablePan = true;
                        this.scene.controls.update();
                    }
                }
                return;
            }
            if (this._physicalViewLevel === 'datacenter') {
                const gc = this._getGlobeWorldCenter();

                await this._fadeToBlack();

                this._physicalViewLevel = 'globe';
                this._currentInfra.showGlobeView();
                this.selectedConfig = null;
                this.selectedPath = null;
                this.updatePanelVisibility();
                this.renderTree();
                this.updateBreadcrumb();

                if (this.scene && this.scene.camera) {
                    this.scene.camera.position.set(gc.x, gc.y + 18, gc.z + 32);
                    if (this.scene.controls) {
                        this.scene.controls.target.copy(gc);
                        this.scene.controls.update();
                    }
                }

                await this._fadeFromBlack();
                this._applyGlobeControls(0);
                this._startGlobeIdleAnimation();
                return;
            }
        }

        this.selectedConfig = null;
        this.selectedPath = null;

        this.updatePanelVisibility();
        this.renderTree();
        this.updateBreadcrumb();
        this._resetControls();
    }

    _resetControls() {
        if (this.scene && this.scene.controls) {
            this.scene.controls.minDistance = 1;
            this.scene.controls.maxDistance = 200;
            this.scene.controls.minPolarAngle = 0;
            this.scene.controls.maxPolarAngle = Math.PI;
            this.scene.controls.enablePan = true;
        }
    }

    _getGlobeWorldCenter() {
        const inf = this._currentInfra;
        if (inf && inf.physicalContainer) {
            const pos = new THREE.Vector3();
            inf.physicalContainer.updateWorldMatrix(true, false);
            inf.physicalContainer.getWorldPosition(pos);
            return pos;
        }
        return new THREE.Vector3(0, 0, 0);
    }

    _applyGlobeControls(delay = 0) {
        const apply = () => {
            if (this.scene && this.scene.controls) {
                const center = this._getGlobeWorldCenter();
                this.scene.controls.target.copy(center);
                this.scene.controls.minDistance = 18;
                this.scene.controls.maxDistance = 60;
                this.scene.controls.enablePan = false;
                this.scene.controls.minPolarAngle = 0;
                this.scene.controls.maxPolarAngle = Math.PI;
                this.scene.controls.enableDamping = true;
                this.scene.controls.dampingFactor = 0.08;
                this.scene.controls.update();
            }
        };
        if (delay > 0) setTimeout(apply, delay);
        else apply();
    }

    focusOnMesh(mesh) {
        if (!this.scene || !mesh) return;
        const box = new THREE.Box3().setFromObject(mesh);
        if (box.isEmpty()) return;
        const center = new THREE.Vector3();
        const size = new THREE.Vector3();
        box.getCenter(center);
        box.getSize(size);

        const item = mesh.item;
        const itemClass = item?.config?.class;

        if (itemClass === 'rack') {
            const worldDir = new THREE.Vector3(0, 0, -1);
            mesh.getWorldDirection(worldDir);
            const frontOffset = Math.max(size.z * 1.8, 1.2);
            const camPos = new THREE.Vector3(
                center.x - worldDir.x * frontOffset,
                center.y,
                center.z - worldDir.z * frontOffset
            );
            const target = new THREE.Vector3(center.x, center.y, center.z);
            this.scene.animateCamera(camPos, target, 1000);
            this._selectedRackMesh = mesh;
            if (this.scene.controls) {
                setTimeout(() => {
                    if (this.scene.controls) {
                        this.scene.controls.minPolarAngle = 0;
                        this.scene.controls.maxPolarAngle = Math.PI;
                        this.scene.controls.minDistance = 0.5;
                        this.scene.controls.maxDistance = 10;
                        this.scene.controls.enablePan = true;
                    }
                }, 1100);
            }
        } else if (itemClass === 'physicalserver' || itemClass === 'physicalswitch') {
            const camPos = new THREE.Vector3(
                center.x,
                center.y,
                box.min.z - Math.max(size.z * 3, 0.8)
            );
            this.scene.animateCamera(camPos, center, 800);
        } else if (itemClass === 'datacenter') {
            if (this._physicalViewLevel === 'datacenter') {
                const fw = size.x || 30;
                const fd = size.z || 20;
                const wh = size.y || 3.5;
                const maxFloor = Math.max(fw, fd);
                const camPos = new THREE.Vector3(
                    center.x + maxFloor * 0.3,
                    wh + maxFloor * 0.4,
                    center.z + fd * 0.5 + maxFloor * 0.25
                );
                const target = new THREE.Vector3(center.x, wh * 0.3, center.z);
                this.scene.animateCamera(camPos, target, 1200);
            } else {
                const dir = center.clone().normalize();
                const camPos = center.clone().add(dir.multiplyScalar(3));
                this.scene.animateCamera(camPos, new THREE.Vector3(0, 0, 0), 1000);
            }
        } else if (itemClass === 'row') {
            const maxDim = Math.max(size.x, size.z, 2);
            const camPos = new THREE.Vector3(
                center.x,
                center.y + maxDim * 0.8,
                center.z + maxDim * 0.6
            );
            this.scene.animateCamera(camPos, center, 1000);
        } else {
            const maxDim = Math.max(size.x, size.y, size.z, 1);
            const dist = maxDim * 2.5;
            const camPos = new THREE.Vector3(
                center.x + dist * 0.7,
                center.y + dist * 0.6,
                center.z + dist * 0.7
            );
            this.scene.animateCamera(camPos, center, 1000);
        }
    }

    focusOnConfig(config) {
        if (!this.scene || !this.scene.children) return;
        for (const child of this.scene.children) {
            const found = child.find ? child.find(config.class, config.name) : false;
            if (found && found.mainobj) {
                this.focusOnMesh(found.mainobj);
                return;
            }
            if (child.datacenters) {
                for (const dc of child.datacenters) {
                    const r = this._findPhysicalItem(dc, config);
                    if (r && r.mainobj) {
                        this.focusOnMesh(r.mainobj);
                        return;
                    }
                }
            }
        }
    }

    _findPhysicalItem(obj, config) {
        if (obj.config && obj.config.name === config.name && obj.config.class === config.class) return obj;
        const lists = [obj.children, obj.rows, obj.rackList, obj.equipment];
        for (const list of lists) {
            if (!list) continue;
            for (const child of list) {
                const found = this._findPhysicalItem(child, config);
                if (found) return found;
            }
        }
        return null;
    }

    showContextualAddButtons() {}


    getContextualRules(config) {
        const rules = [];
        if (!config || !config.class) return rules;
        const baseRules = HIERARCHY_RULES[config.class];
        if (baseRules) {
            baseRules.forEach(r => {
                rules.push({
                    type: r.type,
                    array: r.array,
                    special: r.special,
                    shortLabel: r.label.replace(/^Ajouter (une?|un) /, '')
                });
            });
        }
        return rules;
    }

    hideContextualAddButtons() {
    }

    updatePanelVisibility() {
        const paletteLib = document.getElementById('palette_library');
        const paletteInsp = document.getElementById('palette_inspector');
        if (this.selectedConfig) {
            if (paletteLib) paletteLib.style.display = 'none';
            if (paletteInsp) paletteInsp.style.display = 'block';
        } else {
            if (paletteLib) paletteLib.style.display = 'block';
            if (paletteInsp) paletteInsp.style.display = 'none';
        }
    }

    updateBreadcrumb() {
        const bc = document.getElementById('breadcrumb');
        if (!bc) return;
        bc.innerHTML = '';

        if (!this.selectedConfig || !this.data) {
            bc.style.display = 'none';
            return;
        }

        const ancestors = this.getAncestors(this.data, this.selectedConfig);

        const projSpan = document.createElement('span');
        projSpan.className = 'bc-item';
        projSpan.textContent = 'Projet';
        projSpan.onclick = () => this.deselectObject();
        bc.appendChild(projSpan);

        for (const anc of ancestors) {
            const sep = document.createElement('span');
            sep.className = 'bc-sep';
            sep.textContent = '/';
            bc.appendChild(sep);

            if (anc === this.selectedConfig) {
                const cur = document.createElement('span');
                cur.className = 'bc-current';
                cur.textContent = anc.name || anc.class || '?';
                bc.appendChild(cur);
            } else {
                const item = document.createElement('span');
                item.className = 'bc-item';
                item.textContent = anc.name || anc.class || '?';
                item.onclick = () => this.selectObject({ config: anc });
                bc.appendChild(item);
            }
        }

        bc.style.display = 'flex';
    }

    getAncestors(root, target) {
        const result = [];
        const search = (obj, chain) => {
            if (!obj || typeof obj !== 'object') return false;
            if (obj === target) {
                result.push(...chain, obj);
                return true;
            }
            if (obj.class) {
                for (const key of ALL_CHILD_KEYS) {
                    if (Array.isArray(obj[key])) {
                        for (const child of obj[key]) {
                            if (search(child, [...chain, obj])) return true;
                        }
                    }
                }
            }
            if (!obj.class) {
                for (const key in obj) {
                    if (Object.prototype.hasOwnProperty.call(obj, key) && typeof obj[key] === 'object') {
                        if (search(obj[key], chain)) return true;
                    }
                }
            }
            return false;
        };

        const topLevelKeys = ['sites', 'networkdevices', 'instances'];
        for (const k of topLevelKeys) {
            if (Array.isArray(root[k])) {
                for (const item of root[k]) {
                    if (search(item, [])) return result;
                }
            }
        }
        if (root.physical && Array.isArray(root.physical.datacenters)) {
            for (const dc of root.physical.datacenters) {
                if (search(dc, [])) return result;
            }
        }
        if (target.class) {
            result.push(target);
        }
        return result;
    }

    isDescendantOf(candidateConfig, parentConfig) {
        if (!parentConfig || !candidateConfig) return false;
        const search = (obj) => {
            if (!obj || typeof obj !== 'object') return false;
            if (obj === candidateConfig) return true;
            for (const key of ALL_CHILD_KEYS) {
                if (Array.isArray(obj[key])) {
                    for (const child of obj[key]) {
                        if (search(child)) return true;
                    }
                }
            }
            return false;
        };
        for (const key of ALL_CHILD_KEYS) {
            if (Array.isArray(parentConfig[key])) {
                for (const child of parentConfig[key]) {
                    if (search(child)) return true;
                }
            }
        }
        return false;
    }

    addInstanceOnNetwork(networkConfig) {
        if (!this.data || !networkConfig || networkConfig.class !== 'network') return;
        this.ensureUUIDs(networkConfig);
        const netUuid = networkConfig.uuid;
        if (!netUuid) return;

        if (!this.data.instances) this.data.instances = [];
        const newInstance = {
            name: "VM-" + String(this.data.instances.length + 1).padStart(2, '0'),
            class: "instance",
            cpu: 2, ram: 4096, os: "linux", storage: 50,
            interfaces: [{
                name: "eth0",
                class: "interface",
                mac: "00:00:00:00:00:00",
                position: "front",
                net: netUuid,
                ips: [{ class: "ip", ip: "192.168.0.2" }],
                style: { color: "#cccccc" }
            }],
            services: [],
            style: { childPosition: "horizontal" }
        };
        this.data.instances.push(newInstance);

        const editor = document.getElementById(this.jsonEditorId);
        if (editor) editor.value = JSON.stringify(this.data, null, 4);
        this.updateFromJSON(false, true);
    }

    renderTree() {
        const container = document.getElementById('tree_content');
        if (!container) return;
        container.innerHTML = '';
        if (!this.data) return;

        const ancestorSet = new Set();
        if (this.selectedConfig && this.data) {
            const ancestors = this.getAncestors(this.data, this.selectedConfig);
            for (const a of ancestors) ancestorSet.add(a);
        }

        const buildNode = (obj, parentEl) => {
            if (!obj || typeof obj !== 'object') return;
            const cls = obj.class || '';
            const name = obj.name || obj.title || cls || '?';
            const icon = ICONS[cls] || 'fas fa-cube';
            const hasChildren = ALL_CHILD_KEYS.some(k => obj[k] && obj[k].length > 0);
            const isSelected = this.selectedConfig === obj;
            const isAncestorOfSelected = ancestorSet.has(obj) && !isSelected;

            const nodeDiv = document.createElement('div');

            const labelDiv = document.createElement('div');
            labelDiv.className = 'tree-node';
            if (isSelected) labelDiv.classList.add('selected');

            const toggle = document.createElement('span');
            toggle.className = 'tree-toggle';
            const defaultOpen = isAncestorOfSelected || isSelected;
            toggle.textContent = hasChildren ? (defaultOpen ? '▾' : '▸') : ' ';
            labelDiv.appendChild(toggle);

            const iconEl = document.createElement('i');
            iconEl.className = icon;
            labelDiv.appendChild(iconEl);

            const text = document.createTextNode(' ' + name);
            labelDiv.appendChild(text);

            labelDiv.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectObject({ config: obj });
            });
            nodeDiv.appendChild(labelDiv);

            if (hasChildren) {
                const childrenDiv = document.createElement('div');
                childrenDiv.className = 'tree-children';
                childrenDiv.style.display = defaultOpen ? 'block' : 'none';
                nodeDiv.appendChild(childrenDiv);

                toggle.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const open = childrenDiv.style.display !== 'none';
                    childrenDiv.style.display = open ? 'none' : 'block';
                    toggle.textContent = open ? '▸' : '▾';
                });

                for (const key of ALL_CHILD_KEYS) {
                    if (obj[key] && Array.isArray(obj[key])) {
                        for (const child of obj[key]) {
                            buildNode(child, childrenDiv);
                        }
                    }
                }
            }

            parentEl.appendChild(nodeDiv);

            if (isSelected) {
                setTimeout(() => labelDiv.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 50);
            }
        };

        const isPhysical = this.currentView === 'physical';
        const isLogical = this.currentView === 'logical' || !this.currentView;
        const hasPhysical = this.data.physical && this.data.physical.datacenters && this.data.physical.datacenters.length > 0;
        const hasLogical = !!(this.data.sites || this.data.networkdevices || this.data.instances);

        // Logical section
        if (hasLogical) {
            const logicalSection = document.createElement('div');
            logicalSection.className = 'tree-section';
            logicalSection.style.cursor = 'pointer';
            logicalSection.innerHTML = `<span class="tree-toggle" style="display:inline-block;width:12px;font-size:10px;color:#888;">${isLogical ? '▾' : '▸'}</span> <i class="fas fa-project-diagram"></i> Vue Logique`;
            container.appendChild(logicalSection);

            const logicalWrap = document.createElement('div');
            logicalWrap.style.display = isLogical ? 'block' : 'none';
            container.appendChild(logicalWrap);

            logicalSection.addEventListener('click', () => {
                const open = logicalWrap.style.display !== 'none';
                logicalWrap.style.display = open ? 'none' : 'block';
                logicalSection.querySelector('.tree-toggle').textContent = open ? '▸' : '▾';
            });

            if (this.data.sites) {
                for (const site of this.data.sites) buildNode(site, logicalWrap);
            }
            if (this.data.networkdevices) {
                for (const nd of this.data.networkdevices) buildNode(nd, logicalWrap);
            }
            if (this.data.instances) {
                for (const inst of this.data.instances) buildNode(inst, logicalWrap);
            }
        }

        // Physical section
        if (hasPhysical) {
            const physSection = document.createElement('div');
            physSection.className = 'tree-section';
            physSection.style.cursor = 'pointer';
            physSection.innerHTML = `<span class="tree-toggle" style="display:inline-block;width:12px;font-size:10px;color:#888;">${isPhysical ? '▾' : '▸'}</span> <i class="fas fa-warehouse"></i> Vue Physique`;
            container.appendChild(physSection);

            const physWrap = document.createElement('div');
            physWrap.style.display = isPhysical ? 'block' : 'none';
            container.appendChild(physWrap);

            physSection.addEventListener('click', () => {
                const open = physWrap.style.display !== 'none';
                physWrap.style.display = open ? 'none' : 'block';
                physSection.querySelector('.tree-toggle').textContent = open ? '▸' : '▾';
            });

            for (const dc of this.data.physical.datacenters) buildNode(dc, physWrap);
        }
    }

    updateJsonEditor() {
        if (!this.data) return;
        const editor = document.getElementById(this.jsonEditorId);
        if (!editor) return;
        editor.value = JSON.stringify(this.data, null, 4);
    }

    renderInspector(config) {
        const container = document.getElementById('inspector_content');
        if (!container) return;
        container.innerHTML = '';

        const bcDiv = document.getElementById('inspector_breadcrumb');
        if (bcDiv) {
            bcDiv.innerHTML = '';
            if (this.data) {
                const ancestors = this.getAncestors(this.data, config);
                ancestors.forEach((anc, idx) => {
                    if (idx > 0) {
                        const sep = document.createElement('span');
                        sep.textContent = ' > ';
                        sep.style.color = '#555';
                        sep.style.fontSize = '11px';
                        bcDiv.appendChild(sep);
                    }
                    if (anc === config) {
                        const cur = document.createElement('span');
                        cur.style.color = '#fff';
                        cur.style.fontWeight = '600';
                        cur.style.fontSize = '12px';
                        cur.textContent = anc.name || anc.class || '?';
                        bcDiv.appendChild(cur);
                    } else {
                        const link = document.createElement('span');
                        link.textContent = anc.name || anc.class || '?';
                        link.style.color = '#6db3f2';
                        link.style.cursor = 'pointer';
                        link.style.fontSize = '12px';
                        link.onclick = () => this.selectObject({ config: anc });
                        bcDiv.appendChild(link);
                    }
                });
            }
        }

        const header = document.createElement('div');
        header.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #3e3e42;';
        const iconEl = document.createElement('i');
        iconEl.className = ICONS[config.class] || 'fas fa-cube';
        iconEl.style.cssText = 'font-size:16px;color:#6db3f2;';
        header.appendChild(iconEl);
        const titleEl = document.createElement('div');
        titleEl.innerHTML = `<strong style="font-size:14px;">${config.name || config.class || '?'}</strong><br><small style="color:#888;">${config.class || ''}</small>`;
        header.appendChild(titleEl);
        container.appendChild(header);

        this.generateFields(config, container);

        if (config.class && HIERARCHY_RULES[config.class]) {
            const addSection = document.createElement('div');
            addSection.style.cssText = 'margin-top:12px;padding-top:10px;border-top:1px solid #3e3e42;';
            const addTitle = document.createElement('div');
            addTitle.style.cssText = 'font-size:12px;color:#888;margin-bottom:6px;font-weight:600;';
            addTitle.innerHTML = '<i class="fas fa-plus-circle" style="margin-right:4px;"></i>Ajouter';
            addSection.appendChild(addTitle);

            HIERARCHY_RULES[config.class].forEach(rule => {
                const btn = document.createElement('div');
                btn.className = 'palette-item';
                btn.style.cssText = 'padding:6px 10px;margin-bottom:4px;font-size:12px;';
                const rIcon = ICONS[rule.type] || 'fas fa-cube';
                btn.innerHTML = `<i class="${rIcon}" style="width:16px;text-align:center;"></i> ${rule.label}`;
                btn.onclick = () => {
                    if (rule.special === 'instanceOnNetwork') {
                        this.addInstanceOnNetwork(config);
                    } else {
                        this.addChildObject(rule.type, rule.array);
                    }
                };
                addSection.appendChild(btn);
            });
            container.appendChild(addSection);
        }

        const delSection = document.createElement('div');
        delSection.style.cssText = 'margin-top:12px;padding-top:10px;border-top:1px solid #3e3e42;';
        const delBtn = document.createElement('button');
        delBtn.className = 'action-btn';
        delBtn.style.cssText = 'width:100%;background-color:#a02020;font-size:12px;';
        delBtn.innerHTML = '<i class="fas fa-trash"></i> Supprimer cet élément';
        delBtn.onclick = () => this.deleteSelectedObject();
        delSection.appendChild(delBtn);
        container.appendChild(delSection);
    }

    generateFields(obj, parentElement, pathPrefix = '') {
        // Explicitly handle missing optional fields for specific classes
        if (obj.class === 'interface' && !obj.hasOwnProperty('net')) {
             this.createField('net', pathPrefix ? `${pathPrefix}.net` : 'net', "", 'text', parentElement);
        }

        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                const value = obj[key];
                const fullPath = pathPrefix ? `${pathPrefix}.${key}` : key;

                if (typeof value === 'object' && value !== null) {
                    if (Array.isArray(value)) {
                        // Array Handling
                        const details = document.createElement('details');
                        details.style.marginBottom = '10px';
                        details.open = false;
                        
                        const summary = document.createElement('summary');
                        summary.innerText = `${key} [${value.length}]`;
                        summary.style.cursor = 'pointer'; summary.style.color = '#ccc'; summary.style.fontSize = '13px'; summary.style.marginBottom = '5px';
                        details.appendChild(summary);

                        value.forEach((item, index) => {
                            const itemDiv = document.createElement('div');
                            itemDiv.style.marginLeft = '10px'; itemDiv.style.borderLeft = '1px solid #444'; itemDiv.style.paddingLeft = '5px'; itemDiv.style.marginBottom = '5px';

                            if (typeof item === 'object') {
                                // Check if selectable object
                                if (item.class && (HIERARCHY_RULES[item.class] || ENUM_VALUES['class'].includes(item.class))) {
                                    const selectBtn = document.createElement('button');
                                    selectBtn.className = 'action-btn';
                                    selectBtn.style.width = '100%'; selectBtn.style.textAlign = 'left'; selectBtn.style.marginTop = '5px'; selectBtn.style.backgroundColor = '#333';
                                    
                                    const icon = item.class === 'zone' ? 'vector-square' :
                                                 item.class === 'network' ? 'network-wired' :
                                                 item.class === 'instance' ? 'server' :
                                                 item.class === 'interface' ? 'ethernet' :
                                                 item.class === 'ip' ? 'map-marker-alt' :
                                                 item.class === 'datacenter' ? 'warehouse' :
                                                 item.class === 'row' ? 'grip-lines' :
                                                 item.class === 'rack' ? 'th-large' :
                                                 item.class === 'physicalserver' ? 'hdd' :
                                                 item.class === 'physicalswitch' ? 'exchange-alt' : 'cube';
                                                 
                                    const displayName = item.name || item.ip || `Item ${index}`;
                                    selectBtn.innerHTML = `<i class="fas fa-${icon}"></i> ${displayName} <i class="fas fa-chevron-right" style="float:right"></i>`;
                                    selectBtn.onclick = () => this.selectObject({ config: item });
                                    itemDiv.appendChild(selectBtn);
                                } else {
                                    const itemLabel = document.createElement('div');
                                    itemLabel.innerText = `Item ${index}`; itemLabel.style.fontSize = '12px'; itemLabel.style.color = '#888';
                                    itemDiv.appendChild(itemLabel);
                                    this.generateFields(item, itemDiv, `${fullPath}.${index}`);
                                }
                            } else {
                                this.createField(`Item ${index}`, `${fullPath}.${index}`, item, typeof item, itemDiv);
                            }
                            details.appendChild(itemDiv);
                        });
                        parentElement.appendChild(details);

                    } else {
                        // Object Handling
                        const details = document.createElement('details');
                        details.style.marginBottom = '5px'; details.open = false;
                        
                        const summary = document.createElement('summary');
                        summary.innerText = key;
                        summary.style.cursor = 'pointer'; summary.style.color = '#ddd'; summary.style.fontSize = '13px';
                        details.appendChild(summary);
                        
                        const contentDiv = document.createElement('div');
                        contentDiv.style.marginLeft = '10px';
                        details.appendChild(contentDiv);
                        
                        this.generateFields(value, contentDiv, fullPath);
                        parentElement.appendChild(details);
                    }
                } else {
                    const inputType = typeof value === 'number' ? 'number' : 'text';
                    this.createField(key, fullPath, value, inputType, parentElement);
                }
            }
        }
    }

    createField(label, key, val, type='text', parent) {
        const div = document.createElement('div');
        div.className = 'inspector-field';
        
        const lbl = document.createElement('label');
        lbl.className = 'inspector-label';
        lbl.innerText = label;
        
        const propName = key.split('.').pop();
        const enumOptions = ENUM_VALUES[propName];
        let input;

        if (propName === 'net') {
            input = document.createElement('select');
            input.className = 'inspector-input';
            const networks = this.collectNetworks(this.data);
            
            // Add current value if not in list (to avoid it disappearing)
            // Note: val could be a name (legacy) or a UUID (new)
            let found = networks.find(n => n.uuid === val || n.name === val);
            
            const emptyOpt = document.createElement('option');
            emptyOpt.value = ""; emptyOpt.innerText = "-- Sélectionner un Réseau --";
            input.appendChild(emptyOpt);
            
            networks.forEach(net => {
                const option = document.createElement('option');
                option.value = net.uuid; // Store UUID as value
                option.innerText = net.name; // Show Name as text
                if (val === net.uuid || val === net.name) option.selected = true;
                input.appendChild(option);
            });
            
            if (val && !found) {
                 const missingOpt = document.createElement('option');
                 missingOpt.value = val; missingOpt.innerText = val + " (Non trouvé)"; missingOpt.selected = true;
                 input.appendChild(missingOpt);
            }
            
            input.onchange = (e) => this.updateObjectProperty(key, e.target.value);
            
        } else if (enumOptions && typeof val !== 'object') {
            input = document.createElement('select');
            input.className = 'inspector-input';
            enumOptions.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt; option.innerText = opt;
                if (val === opt) option.selected = true;
                input.appendChild(option);
            });
            input.onchange = (e) => this.updateObjectProperty(key, e.target.value);
        } else {
            input = document.createElement('input');
            input.className = 'inspector-input';
            input.type = type;
            input.value = val !== undefined ? val : '';
            input.onchange = (e) => {
                let newVal = e.target.value;
                if (type === 'number') newVal = parseFloat(newVal);
                this.updateObjectProperty(key, newVal);
            };
        }
        
        div.appendChild(lbl);
        div.appendChild(input);
        parent.appendChild(div);
    }

    _findFreeU(rackConfig, sizeU) {
        const totalU = rackConfig.units || 42;
        const occupied = new Set();
        (rackConfig.equipment || []).forEach(eq => {
            const start = eq.startU || 1;
            const size = eq.sizeU || 1;
            for (let u = start; u < start + size; u++) occupied.add(u);
        });
        occupied.add(totalU);

        for (let u = 1; u <= totalU - sizeU; u++) {
            let fits = true;
            for (let s = 0; s < sizeU; s++) {
                if (occupied.has(u + s)) { fits = false; break; }
            }
            if (fits) return u;
        }
        return 1;
    }

    updateObjectProperty(path, value) {
        console.log(`Builder: updateObjectProperty path=${path} value=${value}`);
        
        let targetObj = this.selectedConfig;

        // CRITICAL FIX: Always try to resolve the object from the main data tree using UUID first, then path.
        if (this.data) {
             let resolvedObj = null;
             
             if (this.selectedConfig && this.selectedConfig.uuid) {
                 resolvedObj = this.findObjectByUUID(this.data, this.selectedConfig.uuid);
             }
             
             if (!resolvedObj && this.selectedPath) {
                 resolvedObj = this.resolvePath(this.data, this.selectedPath);
             }

             if (resolvedObj) {
                 targetObj = resolvedObj;
                 this.selectedConfig = resolvedObj; 
             } else {
                 console.warn("Builder: Could not resolve selected object for update. Using cached config (risky).");
             }
        }

        if (!targetObj) {
            console.error("Builder: No targetObj to update!");
            return;
        }

        if (path.includes('.')) {
            const parts = path.split('.');
            let obj = targetObj;
            for(let i=0; i<parts.length-1; i++) {
                if(!obj[parts[i]]) obj[parts[i]] = {};
                obj = obj[parts[i]];
            }
            obj[parts[parts.length-1]] = value;
        } else {
            targetObj[path] = value;
        }

        if (this.data) {
             const editor = document.getElementById(this.jsonEditorId);
             editor.value = JSON.stringify(this.data, null, 4);
             console.log("Builder: JSON updated in editor, triggering scene update...");
             this.updateFromJSON(false, true);
        }
    }

    addChildObject(type, arrayName) {
        if (!this.selectedConfig) return;
        if (!this.selectedConfig[arrayName]) this.selectedConfig[arrayName] = [];
        
        let newObj = {
            name: "Nouveau " + type,
            class: type,
            style: { childPosition: "horizontal" }
        };
        
        if (type === 'network') { newObj.network = "192.168.0.0/24"; newObj.style.color = "#ffffff"; newObj.style.minWidth = 20; }
        else if (type === 'interface') { newObj.mac = "00:00:00:00:00:00"; newObj.net = ""; newObj.position = "front"; newObj.style = { color: "#cccccc" }; newObj.ips = []; }
        else if (type === 'ip') { newObj.ip = "127.0.0.1"; }
        else if (type === 'service') { newObj.name = "Nouveau Service"; }
        else if (type === 'row') { newObj.name = "Nouvelle Rangée"; newObj.racks = []; delete newObj.style; }
        else if (type === 'rack') { newObj.name = "Nouveau Rack"; newObj.units = 43; newObj.equipment = []; delete newObj.style; }
        else if (type === 'physicalserver') { newObj.name = "SRV-NEW"; newObj.type = "dell-poweredge-1u"; newObj.startU = 1; newObj.sizeU = 1; newObj.hosts = []; delete newObj.style; }
        else if (type === 'physicalswitch') { newObj.name = "SW-NEW"; newObj.type = "cisco-copper-48"; newObj.startU = 1; newObj.sizeU = 1; delete newObj.style; }

        if ((type === 'physicalserver' || type === 'physicalswitch') && this.selectedConfig.equipment) {
            const freeU = this._findFreeU(this.selectedConfig, newObj.sizeU || 1);
            if (freeU > 0) newObj.startU = freeU;
        }
        
        this.selectedConfig[arrayName].push(newObj);
        
        if (this.data) {
             const editor = document.getElementById(this.jsonEditorId);
             editor.value = JSON.stringify(this.data, null, 4);
             this.updateFromJSON(false, true);
             this.renderInspector(this.selectedConfig);
             this.renderTree();
             this.updateBreadcrumb();
        }
    }

    addObjectToScene(type) {
        if (this.selectedConfig && this.selectedConfig.class && HIERARCHY_RULES[this.selectedConfig.class]) {
            const rules = HIERARCHY_RULES[this.selectedConfig.class];
            const match = rules.find(r => r.type === type);
            if (match) {
                this.addChildObject(type, match.array);
                return;
            }
        }

        const jsonEditor = document.getElementById(this.jsonEditorId);
        try {
            let data = JSON.parse(jsonEditor.value || '{"sites":[]}');
            let newObj = null;
            let newPath = null;

            if(type === 'site') {
                if(!data.sites) data.sites = [];
                newObj = { "name": "New Site " + (data.sites.length + 1), "class": "site", "style": { "childPosition": "horizontal", "minWidth": 10 }, "zones": [] };
                data.sites.push(newObj);
                newPath = ['sites', data.sites.length - 1];
            } else if (type === 'zone') {
                 if(data.sites && data.sites.length > 0) {
                     if(!data.sites[0].zones) data.sites[0].zones = [];
                     newObj = { "name": "New Zone", "class": "zone", "style": { "childPosition": "horizontal", "minWidth": 5 }, "networks": [] };
                     data.sites[0].zones.push(newObj);
                     newPath = ['sites', 0, 'zones', data.sites[0].zones.length - 1];
                 } else { alert("Il faut d'abord créer un site !"); return; }
            } else if (type === 'network') {
                 if(data.sites && data.sites[0].zones && data.sites[0].zones.length > 0) {
                     if(!data.sites[0].zones[0].networks) data.sites[0].zones[0].networks = [];
                     newObj = { "name": "New Network", "class": "network", "network": "192.168.1.0/24", "style": { "childPosition": "horizontal", "color": "#ffffff", "minWidth": 20 } };
                     data.sites[0].zones[0].networks.push(newObj);
                     newPath = ['sites', 0, 'zones', 0, 'networks', data.sites[0].zones[0].networks.length - 1];
                 } else { alert("Il faut d'abord créer une zone !"); return; }
            } else if (type === 'instance') {
                 if(!data.instances) data.instances = [];
                 newObj = { "name": "VM-0" + (data.instances.length + 1), "class": "instance", "cpu": 2, "ram": 4096, "os": "linux", "storage": 50, "interfaces": [], "services": [] };
                 data.instances.push(newObj);
                 newPath = ['instances', data.instances.length - 1];
            } else if (type === 'firewall') {
                 if(!data.networkdevices) data.networkdevices = [];
                 newObj = { "name": "FW-0" + (data.networkdevices.length + 1), "class": "firewall", "interfaces": [], "style": { "position": { "type": "absolute", "x": 0, "y": 0, "z": 0 } } };
                 data.networkdevices.push(newObj);
                 newPath = ['networkdevices', data.networkdevices.length - 1];
            } else if (type === 'datacenter') {
                 if (!data.physical) data.physical = { datacenters: [] };
                 if (!data.physical.datacenters) data.physical.datacenters = [];
                 const dcCount = data.physical.datacenters.length;
                 newObj = { "name": "DC-" + (dcCount + 1), "class": "datacenter", "rooms": [], "cables": [] };
                 data.physical.datacenters.push(newObj);
                 newPath = ['physical', 'datacenters', dcCount];
            } else if (type === 'room') {
                 if (data.physical && data.physical.datacenters && data.physical.datacenters.length > 0) {
                     const dc = data.physical.datacenters[0];
                     if (!dc.rooms) dc.rooms = [];
                     newObj = { "name": "Salle " + (dc.rooms.length + 1), "class": "room", "rows": [] };
                     dc.rooms.push(newObj);
                     newPath = ['physical', 'datacenters', 0, 'rooms', dc.rooms.length - 1];
                 } else { alert("Il faut d'abord créer un datacenter !"); return; }
            } else if (type === 'row') {
                 if (data.physical?.datacenters?.[0]?.rooms?.[0]) {
                     const rm = data.physical.datacenters[0].rooms[0];
                     if (!rm.rows) rm.rows = [];
                     newObj = { "name": "Row " + String.fromCharCode(65 + rm.rows.length), "class": "row", "racks": [] };
                     rm.rows.push(newObj);
                     newPath = ['physical', 'datacenters', 0, 'rooms', 0, 'rows', rm.rows.length - 1];
                 } else { alert("Il faut d'abord créer une salle !"); return; }
            } else if (type === 'rack') {
                 if (data.physical?.datacenters?.[0]?.rooms?.[0]?.rows?.[0]) {
                     const row = data.physical.datacenters[0].rooms[0].rows[0];
                     if (!row.racks) row.racks = [];
                     newObj = { "name": "Rack A" + (row.racks.length + 1), "class": "rack", "units": 43, "equipment": [] };
                     row.racks.push(newObj);
                     newPath = ['physical', 'datacenters', 0, 'rooms', 0, 'rows', 0, 'racks', row.racks.length - 1];
                 } else { alert("Il faut d'abord créer une rangée !"); return; }
            } else if (type === 'physicalserver') {
                 alert("Sélectionnez un rack pour ajouter un serveur."); return;
            } else if (type === 'physicalswitch') {
                 alert("Sélectionnez un rack pour ajouter un switch."); return;
            } else if (['interface', 'ip', 'service'].includes(type)) {
                alert("Sélectionnez d'abord un parent compatible pour ajouter cet objet.");
                return;
            }
            
            jsonEditor.value = JSON.stringify(data, null, 4);
            
            // Set path for next update
            if(newPath) {
                this.selectedPath = newPath;
                // Force Path usage by clearing config
                this.selectedConfig = null;
            }
            
            this.updateFromJSON(false, true);
            
        } catch(e) {
            alert("Erreur JSON : " + e.message);
        }
    }

    deleteSelectedObject() {
        if (!this.selectedConfig || !this.data) return;
        if (!confirm(`Supprimer "${this.selectedConfig.name || this.selectedConfig.class}" ?`)) return;

        const parent = this.findLogicalParent(this.data, this.selectedConfig);
        if (!parent) {
            alert("Impossible de trouver le parent de cet élément.");
            return;
        }

        for (const key of ALL_CHILD_KEYS) {
            if (Array.isArray(parent[key])) {
                const idx = parent[key].indexOf(this.selectedConfig);
                if (idx >= 0) {
                    parent[key].splice(idx, 1);
                    break;
                }
            }
        }

        this.deselectObject();
        const editor = document.getElementById(this.jsonEditorId);
        if (editor) editor.value = JSON.stringify(this.data, null, 4);
        this.updateFromJSON(false, true);
    }

    collectNetworks(root, networks = []) {
        if (!root || typeof root !== 'object') return networks;
        
        if (root.class === 'network' && root.name) {
            // Push object with name and uuid instead of just name string
            networks.push({ name: root.name, uuid: root.uuid || root.name }); 
        }
        
        for (let key in root) {
            if (typeof root[key] === 'object') this.collectNetworks(root[key], networks);
        }
        return networks;
    }

    findLogicalParent(root, target) {
        if (!root || typeof root !== 'object') return null;
        for (let key in root) {
            if (Array.isArray(root[key])) {
                if (root[key].includes(target)) return root;
                for (let item of root[key]) {
                    const res = this.findLogicalParent(item, target);
                    if (res) return res;
                }
            } else if (typeof root[key] === 'object' && root[key] !== null) {
                if (root[key] === target) return root;
                const res = this.findLogicalParent(root[key], target);
                if (res) return res;
            }
        }
        return null;
    }

    getPath(root, target, path = []) {
        if (root === target) return path;
        if (typeof root !== 'object' || root === null) return null;

        if (Array.isArray(root)) {
            for (let i = 0; i < root.length; i++) {
                const res = this.getPath(root[i], target, [...path, i]);
                if (res) return res;
            }
        } else {
            for (const key in root) {
                if (Object.prototype.hasOwnProperty.call(root, key)) {
                    const res = this.getPath(root[key], target, [...path, key]);
                    if (res) return res;
                }
            }
        }
        return null;
    }

    findPathByContent(root, target, path = []) {
        if (typeof root !== 'object' || root === null) return null;
        
        // Simple heuristic: compare stringified content (ignoring children arrays to avoid recursion loops/perf issues?)
        // Better: Compare key properties like Name/IP/Class if they exist
        if (root.class === target.class && (root.name === target.name || root.ip === target.ip)) {
            // Potential match, but check if it's the right level?
            // This is loose matching, might return wrong object if duplicates exist.
            // But better than nothing.
            // Let's rely on JSON stringify for exact content match of properties
            const rootStr = JSON.stringify({ ...root, sites: undefined, zones: undefined, networks: undefined, instances: undefined }); // shallow compare?
            const targetStr = JSON.stringify({ ...target, sites: undefined, zones: undefined, networks: undefined, instances: undefined });
            if (rootStr === targetStr) return path;
        }

        if (Array.isArray(root)) {
            for (let i = 0; i < root.length; i++) {
                const res = this.findPathByContent(root[i], target, [...path, i]);
                if (res) return res;
            }
        } else {
            for (const key in root) {
                if (Object.prototype.hasOwnProperty.call(root, key) && typeof root[key] === 'object') {
                    const res = this.findPathByContent(root[key], target, [...path, key]);
                    if (res) return res;
                }
            }
        }
        return null;
    }

    resolvePath(root, path) {
        if (!path || path.length === 0) return root;
        let current = root;
        for (const key of path) {
            if (current && typeof current === 'object' && (key in current)) {
                current = current[key];
            } else {
                return null;
            }
        }
        return current;
    }

    createNewScene() {
        const name = prompt("Nom du nouveau fichier (ex: mon-projet.json):");
        if(!name) return;
        
        let filename = name;
        if(!filename.endsWith('.json')) filename += '.json';
        
        const template = {
            "camera": { "position": { "x": 0, "y": 10, "z": 20 }, "target": { "x": 0, "y": 5, "z": 10 } },
            "sites": [
                { "name": "Nouveau Site", "class": "site", "style": { "childPosition": "horizontal" }, "zones": [] }
            ]
        };
        
        document.getElementById(this.jsonEditorId).value = JSON.stringify(template, null, 4);
        
        const selector = document.getElementById('file_selector');
        const option = document.createElement('option');
        option.value = filename; option.text = filename;
        selector.add(option);
        selector.value = filename;
        
        // Trigger save globally defined? Or we need to pass a save callback.
        // Assuming global saveFile() exists for now as it uses API.
        if(window.saveFile) window.saveFile();
    }

    // ── Globe DC labels: billboard panels with name/address + pointer line ──

    _createDCLabels() {
        this._removeDCLabels();
        this._dcLabelsGroup = new THREE.Group();
        this._dcLabelsGroup.name = '_dcLabels';

        const inf = this._currentInfra;
        if (!inf || !inf._globe) return;
        inf._globe.add(this._dcLabelsGroup);

        const LABEL_ALTITUDE = 6.0;
        const LABEL_MIN_DIST = 3.5;
        const LABEL_SCALE_W = 3.5;
        const LABEL_SCALE_H = 1.1;

        const labelEntries = [];
        for (const dc of inf.datacenters) {
            if (!dc.mainobj || !dc._globeLat) continue;
            const dcPos = dc.mainobj.position.clone();
            const normal = dcPos.clone().normalize();
            const labelPos = normal.clone().multiplyScalar(dcPos.length() + LABEL_ALTITUDE);
            labelEntries.push({ dc, dcPos, normal, labelPos });
        }

        for (let pass = 0; pass < 10; pass++) {
            let moved = false;
            for (let i = 0; i < labelEntries.length; i++) {
                for (let j = i + 1; j < labelEntries.length; j++) {
                    const a = labelEntries[i], b = labelEntries[j];
                    const diff = a.labelPos.clone().sub(b.labelPos);
                    const dist = diff.length();
                    if (dist < LABEL_MIN_DIST && dist > 0.01) {
                        const push = (LABEL_MIN_DIST - dist) * 0.55;
                        const dir = diff.normalize();
                        a.labelPos.addScaledVector(dir, push);
                        b.labelPos.addScaledVector(dir, -push);
                        const rA = a.dcPos.length() + LABEL_ALTITUDE;
                        a.labelPos.normalize().multiplyScalar(rA);
                        const rB = b.dcPos.length() + LABEL_ALTITUDE;
                        b.labelPos.normalize().multiplyScalar(rB);
                        moved = true;
                    }
                }
            }
            if (!moved) break;
        }

        for (const entry of labelEntries) {
            const { dc, dcPos, labelPos } = entry;
            const name = dc.config.name || 'DC';
            const addr = dc.config.address || '';
            const configRooms = dc.config && dc.config.rooms ? dc.config.rooms.length : 0;
            const roomCount = configRooms;
            const sprite = this._makeLabelSprite(name, addr, roomCount);
            sprite.item = { config: dc.config };
            sprite.position.copy(labelPos);
            sprite.scale.set(LABEL_SCALE_W, LABEL_SCALE_H, 1);
            sprite._baseScaleX = LABEL_SCALE_W;
            sprite._baseScaleY = LABEL_SCALE_H;
            sprite._baseLabelPos = labelPos.clone();
            sprite._dcPos = dcPos.clone();
            this._dcLabelsGroup.add(sprite);

            const midPoint = dcPos.clone().lerp(labelPos, 0.5);
            const midNormal = midPoint.clone().normalize();
            const midAlt = (dcPos.length() + labelPos.length()) / 2 + 0.5;
            midPoint.copy(midNormal.multiplyScalar(midAlt));

            const curve = new THREE.QuadraticBezierCurve3(dcPos, midPoint, labelPos);
            const curvePoints = curve.getPoints(20);
            const lineGeo = new THREE.BufferGeometry().setFromPoints(curvePoints);
            const lineMat = new THREE.LineBasicMaterial({
                color: 0x00aaff,
                transparent: true,
                opacity: 0.35,
            });
            const line = new THREE.Line(lineGeo, lineMat);
            line._linkedSprite = sprite;
            this._dcLabelsGroup.add(line);
        }
    }

    _makeLabelSprite(name, address, roomCount = 0) {
        const canvas = document.createElement('canvas');
        const w = 512, h = 180;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, w, h);

        const borderColor = roomCount > 0 ? 'rgba(0, 170, 255, 0.6)' : 'rgba(255, 120, 0, 0.6)';

        ctx.fillStyle = 'rgba(0, 10, 30, 0.75)';
        const r = 10;
        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.lineTo(w - r, 0);
        ctx.quadraticCurveTo(w, 0, w, r);
        ctx.lineTo(w, h - r);
        ctx.quadraticCurveTo(w, h, w - r, h);
        ctx.lineTo(r, h);
        ctx.quadraticCurveTo(0, h, 0, h - r);
        ctx.lineTo(0, r);
        ctx.quadraticCurveTo(0, 0, r, 0);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = roomCount > 0 ? '#00ddff' : '#ff8800';
        ctx.font = 'bold 36px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(name, w / 2, 48);

        if (address) {
            ctx.fillStyle = '#8899bb';
            ctx.font = '22px monospace';
            const maxW = w - 40;
            let displayAddr = address;
            if (ctx.measureText(displayAddr).width > maxW) {
                while (displayAddr.length > 3 && ctx.measureText(displayAddr + '…').width > maxW) {
                    displayAddr = displayAddr.slice(0, -1);
                }
                displayAddr += '…';
            }
            ctx.fillText(displayAddr, w / 2, 88);
        }

        const badgeText = roomCount > 0
            ? `${roomCount} salle${roomCount > 1 ? 's' : ''}`
            : 'Pas de salle';
        ctx.fillStyle = roomCount > 0 ? 'rgba(0, 180, 255, 0.8)' : 'rgba(255, 120, 0, 0.8)';
        ctx.font = '18px monospace';
        ctx.fillText(badgeText, w / 2, 120);

        ctx.fillStyle = roomCount > 0 ? 'rgba(0, 170, 255, 0.4)' : 'rgba(255, 120, 0, 0.4)';
        ctx.beginPath();
        ctx.arc(w / 2, h - 15, 5, 0, Math.PI * 2);
        ctx.fill();

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false,
            sizeAttenuation: true,
        });
        return new THREE.Sprite(material);
    }

    _removeDCLabels() {
        if (this._dcLabelsGroup) {
            this._dcLabelsGroup.traverse(c => {
                if (c.geometry) c.geometry.dispose();
                if (c.material) {
                    if (c.material.map) c.material.map.dispose();
                    c.material.dispose();
                }
            });
            this._dcLabelsGroup.removeFromParent();
            this._dcLabelsGroup = null;
        }
    }

    // ── Globe idle animation: slow rotation + parabolic network arcs ──

    _startGlobeIdleAnimation() {
        if (this._globeIdleRunning) return;
        this._globeIdleRunning = true;
        this._globeArcsGroup = new THREE.Group();
        this._globeArcsGroup.name = '_globeArcs';
        this._globeArcs = [];
        this._globeArcSpawnTimer = 0;

        const inf = this._currentInfra;
        if (inf && inf._globe) {
            inf._globe.add(this._globeArcsGroup);
        }

        this._createDCLabels();

        this._globeIdleTick = this._globeIdleAnimate.bind(this);
        this._globeIdleClock = performance.now();
        this._globeIdleRaf = requestAnimationFrame(this._globeIdleTick);
    }

    _stopGlobeIdleAnimation() {
        this._globeIdleRunning = false;
        if (this._globeIdleRaf) cancelAnimationFrame(this._globeIdleRaf);
        if (this._globeArcsGroup) {
            this._globeArcsGroup.removeFromParent();
            this._globeArcsGroup.traverse(c => {
                if (c.geometry) c.geometry.dispose();
                if (c.material) c.material.dispose();
            });
            this._globeArcsGroup = null;
        }
        this._globeArcs = [];
        this._removeDCLabels();
        const inf = this._currentInfra;
        if (inf && inf.physicalContainer) {
            inf.physicalContainer.rotation.y = 0;
        }
    }

    _globeIdleAnimate() {
        if (!this._globeIdleRunning) return;
        this._globeIdleRaf = requestAnimationFrame(this._globeIdleTick);

        const now = performance.now();
        const dt = (now - this._globeIdleClock) / 1000;
        this._globeIdleClock = now;

        const inf = this._currentInfra;
        if (!inf || !inf._globe || this._physicalViewLevel !== 'globe') return;

        inf.physicalContainer.rotation.y += dt * 0.03;

        this._globeArcSpawnTimer += dt;
        const spawnInterval = 0.12;
        const maxArcs = 60;
        if (this._globeArcSpawnTimer > spawnInterval && this._globeArcs.length < maxArcs) {
            this._globeArcSpawnTimer = 0;
            this._spawnNetworkArc();
        }

        for (let i = this._globeArcs.length - 1; i >= 0; i--) {
            const arc = this._globeArcs[i];
            arc.progress += dt * arc.speed;
            if (arc.progress >= 1.2) {
                arc.line.removeFromParent();
                arc.line.geometry.dispose();
                arc.line.material.dispose();
                if (arc.dot) {
                    arc.dot.removeFromParent();
                    arc.dot.geometry?.dispose();
                    arc.dot.material?.dispose();
                }
                this._globeArcs.splice(i, 1);
                continue;
            }
            this._updateArcGeometry(arc);
        }

        this._updateLabelScales();
    }

    _updateLabelScales() {
        if (!this._dcLabelsGroup || !this.scene?.camera) return;
        const cam = this.scene.camera;
        const gc = this._getGlobeWorldCenter();
        const dist = cam.position.distanceTo(gc);
        const refDist = GLOBE_RADIUS + 30;
        const raw = dist / refDist;
        const scaleFactor = Math.max(0.06, Math.min(1.2, raw * raw));
        const altLerp = Math.max(0, Math.min(1, (dist - GLOBE_RADIUS - 2) / (refDist - GLOBE_RADIUS)));

        this._dcLabelsGroup.traverse(c => {
            if (c.isSprite && c._baseScaleX != null) {
                c.scale.set(c._baseScaleX * scaleFactor, c._baseScaleY * scaleFactor, 1);
                if (c._baseLabelPos && c._dcPos) {
                    const nearPos = c._dcPos.clone().normalize().multiplyScalar(c._dcPos.length() + 0.8);
                    c.position.lerpVectors(nearPos, c._baseLabelPos, altLerp);
                }
            }
        });

        this._dcLabelsGroup.traverse(c => {
            if (c.isLine && c.material && c._linkedSprite) {
                const sp = c._linkedSprite;
                c.material.opacity = Math.max(0.02, 0.35 * altLerp);
                if (sp._dcPos && c.geometry) {
                    const start = sp._dcPos;
                    const end = sp.position;
                    const mid = start.clone().lerp(end, 0.5);
                    const midN = mid.clone().normalize();
                    const midAlt = (start.length() + end.length()) / 2 + 0.5 * altLerp;
                    mid.copy(midN.multiplyScalar(midAlt));
                    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
                    const pts = curve.getPoints(20);
                    c.geometry.setFromPoints(pts);
                }
            }
        });
    }

    _spawnNetworkArc() {
        if (!this._globeArcsGroup || !this._currentInfra) return;
        const dcs = this._currentInfra.datacenters;
        if (dcs.length === 0) return;

        const METROPOLES = [
            [48.86, 2.35],[40.71,-74.01],[35.68,139.69],[51.51,-0.13],
            [55.76,37.62],[39.91,116.40],[-33.87,151.21],[19.43,-99.13],
            [28.61,77.21],[-23.55,-46.63],[37.57,126.98],[34.05,-118.24],
            [41.88,12.50],[1.35,103.82],[35.69,51.39],[30.04,31.24],
            [13.76,100.50],[6.52,3.38],[-1.29,36.82],[52.52,13.41],
            [43.65,-79.38],[37.77,-122.42],[25.20,55.27],[22.30,114.17],
            [-34.60,-58.38],[59.33,18.07],[41.01,28.98],[14.60,120.98],
            [33.59,130.40],[47.50,19.04],[50.08,14.44],[45.46,9.19],
            [53.55,-2.25],[38.72,-9.14],[60.17,24.94],[42.70,23.32],
            [44.43,26.10],[40.43,-3.70],[48.21,16.37],[46.95,7.45],
            [-6.21,106.85],[3.14,101.69],[31.23,121.47],[23.13,113.26],
            [36.07,-95.93],[29.76,-95.37],[33.75,-84.39],[47.61,-122.33],
            [-26.20,28.05],[5.55,-0.20],[9.02,38.75],[12.97,77.59],
            [17.38,78.49],[23.02,72.57],[18.52,73.86],[21.17,72.83],
        ];

        const dc = dcs[Math.floor(Math.random() * dcs.length)];
        const lat = dc._globeLat || dc.config.lat || 0;
        const lng = dc._globeLng || dc.config.lng || 0;
        const endPos = latLngToSphere(lat, lng, GLOBE_RADIUS + 0.05);

        const city = METROPOLES[Math.floor(Math.random() * METROPOLES.length)];
        const jitter = 1.5;
        const srcLat = city[0] + (Math.random() - 0.5) * jitter;
        const srcLng = city[1] + (Math.random() - 0.5) * jitter;
        const startPos = latLngToSphere(srcLat, srcLng, GLOBE_RADIUS + 0.05);

        const mid = startPos.clone().add(endPos).multiplyScalar(0.5);
        const dist = startPos.distanceTo(endPos);
        const altitude = GLOBE_RADIUS + 0.3 + dist * 0.3;
        mid.normalize().multiplyScalar(altitude);

        const curve = new THREE.QuadraticBezierCurve3(startPos, mid, endPos);

        const colors = [
            [0x00ffcc, 0x00aaff], [0x00ddff, 0x00ffee],
            [0xff6644, 0xffaa00], [0xaa44ff, 0xff44aa],
            [0x44ff66, 0x00ddff], [0x88ccff, 0xaaeeff],
            [0xffcc00, 0xff8800], [0x66ffaa, 0x00cc88],
        ];
        const colorPair = colors[Math.floor(Math.random() * colors.length)];

        const mat = new THREE.LineBasicMaterial({
            color: colorPair[0],
            transparent: true,
            opacity: 0.45,
        });

        const geo = new THREE.BufferGeometry();
        const line = new THREE.Line(geo, mat);
        this._globeArcsGroup.add(line);

        const dotGeo = new THREE.SphereGeometry(0.04, 5, 5);
        const dotMat = new THREE.MeshBasicMaterial({
            color: colorPair[1],
            transparent: true,
            opacity: 0.85,
        });
        const dot = new THREE.Mesh(dotGeo, dotMat);
        this._globeArcsGroup.add(dot);

        this._globeArcs.push({
            curve,
            line,
            dot,
            progress: 0,
            speed: 0.3 + Math.random() * 0.6,
            mat,
        });
    }

    _updateArcGeometry(arc) {
        const drawEnd = Math.min(arc.progress, 1.0);
        const drawStart = Math.max(0, arc.progress - 0.5);
        if (drawEnd <= drawStart) {
            arc.line.visible = false;
            arc.dot.visible = false;
            return;
        }
        arc.line.visible = true;

        const segments = 40;
        const points = [];
        for (let i = 0; i <= segments; i++) {
            const t = drawStart + (i / segments) * (drawEnd - drawStart);
            points.push(arc.curve.getPoint(t));
        }
        arc.line.geometry.dispose();
        arc.line.geometry = new THREE.BufferGeometry().setFromPoints(points);

        const fadeOut = arc.progress > 1.0 ? 1.0 - (arc.progress - 1.0) / 0.2 : 1.0;
        arc.mat.opacity = Math.max(0, 0.6 * fadeOut);

        if (arc.dot) {
            const dotT = Math.min(drawEnd, 1.0);
            const dotPos = arc.curve.getPoint(dotT);
            arc.dot.position.copy(dotPos);
            arc.dot.visible = arc.progress <= 1.05;
            if (arc.dot.material) arc.dot.material.opacity = Math.max(0, 0.9 * fadeOut);
        }
    }
}