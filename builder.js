import * as THREE from "three";
import * as ThreeMeshUI from "three-mesh-ui";
import { networkScene } from "./scene.js";
import { infra } from "./infra.js";

const HIERARCHY_RULES = {
    'site': [ { type: 'zone', label: 'Ajouter une Zone', array: 'zones' } ],
    'zone': [ { type: 'network', label: 'Ajouter un Réseau', array: 'networks' } ],
    'instance': [ 
        { type: 'interface', label: 'Ajouter une Interface', array: 'interfaces' },
        { type: 'service', label: 'Ajouter un Service', array: 'services' } 
    ],
    'firewall': [ 
        { type: 'interface', label: 'Ajouter une Interface', array: 'interfaces' }
    ],
    'interface': [ { type: 'ip', label: 'Ajouter une IP', array: 'ips' } ]
};

const ENUM_VALUES = {
    'class': ['site', 'zone', 'network', 'instance', 'firewall', 'interface', 'ip', 'service', 'vrrp', 'bgp'],
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
        
        // Start render loop
        this.scene.renderer.setAnimationLoop(() => {
            if(this.scene && this.scene.renderer && this.scene.scene && this.scene.camera) {
                this.scene.renderer.render(this.scene.scene, this.scene.camera);
                ThreeMeshUI.update(); // Update UI layout
            }
        });

        this.updateFromJSON(true); // Always animate on first init
        this.addToolbar();

        if (!this.interactionInitialized) {
            this.initInteraction();
            this.interactionInitialized = true;
        }
        
        this.initialized = true; 
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

    updateFromJSON(animate = false) {
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
            } else {
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

            if (this.scene.animateCamera && (animate || !this.initialized)) {
                 // Initial distant position for effect (zoom in)
                 // We offset the current position if it's too close to target to make the animation visible
                 // Or we start from a fixed offset if it's the very first load
                 if (!this.initialized) {
                     this.scene.camera.position.copy(targetPos).multiplyScalar(2);
                 }
                 this.scene.animateCamera(targetPos, targetLook, 2000); 
            } else {
                 this.scene.camera.position.copy(targetPos);
                 this.scene.camera.lookAt(targetLook);
            }

            // 2. Rebuild Scene
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

            // Instantiate Infra
            const newInfra = new infra(data, this.scene);
            this.scene.registerProject(newInfra);
            newInfra.init(false); // No nav panel
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
            
            console.log("Builder: Scene rebuilt.");

        } catch (e) {
            console.error("Builder Update Error:", e);
        }
    }

    addToolbar() {
        if (!this.scene || this.scene.builderToolbar) return;

        const container = new ThreeMeshUI.Block({
            justifyContent: 'center',
            contentDirection: 'row',
            fontFamily: 'https://unpkg.com/three-mesh-ui/examples/assets/Roboto-msdf.json',
            fontTexture: 'https://unpkg.com/three-mesh-ui/examples/assets/Roboto-msdf.png',
            fontSize: 0.7,
            padding: 0.2,
            borderRadius: 1.1,
            backgroundOpacity: 0.6
        });

        container.position.set(0, -3.5, -12);
        container.scale.set(0.2, 0.2, 0.2);
        container.rotation.x = -0.2;

        const refreshBtn = this.createUIButton('Rafraichir', () => {
            console.log("Builder: Force Refresh");
            this.updateFromJSON(true);
        });
        this.scene.addObjInteract(refreshBtn);
        container.add(refreshBtn);

        const resetBtn = this.createUIButton('Reset Camera', () => {
            const targetPos = new THREE.Vector3(0, 10, 20);
            const targetLook = new THREE.Vector3(0, 5, 10);
            if(this.scene.controls) {
                this.scene.controls.reset();
                this.scene.controls.target.copy(targetLook);
                this.scene.controls.update();
            }
            this.scene.camera.position.copy(targetPos);
            this.scene.camera.lookAt(targetLook);
        });

        this.scene.addObjInteract(resetBtn);
        container.add(resetBtn);
        this.scene.camera.add(container);
        this.scene.builderToolbar = container;
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
        if (!canvas) return;

        const mouse = new THREE.Vector2();
        const raycaster = new THREE.Raycaster();
        let mouseDownPos = new THREE.Vector2();
        let hoveredItem = null;

        // Highlight Box
        const highlightGeo = new THREE.BoxGeometry(1, 1, 1);
        const highlightMat = new THREE.MeshBasicMaterial({ color: 0xffff00, opacity: 0.3, transparent: true, depthTest: false });
        const highlightMesh = new THREE.Mesh(highlightGeo, highlightMat);
        highlightMesh.visible = false;
        highlightMesh.renderOrder = 999;
        if (this.scene && this.scene.scene) this.scene.scene.add(highlightMesh);

        canvas.addEventListener('pointermove', (event) => {
            const rect = canvas.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

            if (this.scene && this.scene.camera) {
                raycaster.setFromCamera(mouse, this.scene.camera);
                const intersects = raycaster.intersectObjects(this.scene.scene.children, true);
                
                let foundObj = null;
                if (intersects.length > 0) {
                    for (let i = 0; i < intersects.length; i++) {
                        let obj = intersects[i].object;
                        if (obj.type === 'LineSegments' || obj.type === 'GridHelper' || obj.isUI || obj === highlightMesh) continue;
                        while(obj) {
                            if (obj.item && obj.item.config) {
                                foundObj = obj;
                                hoveredItem = obj.item;
                                break;
                            }
                            obj = obj.parent;
                        }
                        if (foundObj) break;
                    }
                }

                if (foundObj) {
                    highlightMesh.visible = true;
                    const box = new THREE.Box3().setFromObject(foundObj);
                    const size = new THREE.Vector3(); box.getSize(size);
                    const center = new THREE.Vector3(); box.getCenter(center);
                    highlightMesh.position.copy(center);
                    highlightMesh.scale.copy(size).multiplyScalar(1.05);
                    if (highlightMesh.parent !== this.scene.scene) this.scene.scene.add(highlightMesh);
                } else {
                    highlightMesh.visible = false;
                    hoveredItem = null;
                }
            }
        });

        canvas.addEventListener('pointerdown', (event) => {
            mouseDownPos.x = event.clientX;
            mouseDownPos.y = event.clientY;
        });

        canvas.addEventListener('pointerup', (event) => {
            const dx = Math.abs(event.clientX - mouseDownPos.x);
            const dy = Math.abs(event.clientY - mouseDownPos.y);
            if (dx < 3 && dy < 3) {
                if (hoveredItem) this.selectObject(hoveredItem);
                else this.deselectObject();
            }
        });
    }

    selectObject(item) {
        // console.log("Selected:", item);
        this.selectedConfig = item.config;
        
        // Calculate and store path for persistence
        if (this.data) {
            let path = this.getPath(this.data, this.selectedConfig);
            
            // Fallback: If strict equality fails (stale reference), try to find by content
            if (!path) {
                console.warn("Builder: Strict path lookup failed, trying fallback...");
                path = this.findPathByContent(this.data, this.selectedConfig);
                if (path) {
                    // Update reference to the fresh object in data
                    this.selectedConfig = this.resolvePath(this.data, path);
                }
            }
            
            this.selectedPath = path;
        }

        // Update UI Visibility
        document.getElementById('palette_library').style.display = 'none';
        document.getElementById('palette_inspector').style.display = 'block';
        
        this.renderInspector(this.selectedConfig); // Use this.selectedConfig which might be refreshed
    }

    deselectObject() {
        this.selectedConfig = null;
        this.selectedPath = null;
        document.getElementById('palette_library').style.display = 'block';
        document.getElementById('palette_inspector').style.display = 'none';
    }

    renderInspector(config) {
        const container = document.getElementById('inspector_content');
        container.innerHTML = '';

        // Parent Navigation
        if (this.data) {
            let parent = null;
            
            // Priority 1: Use Path if available (more reliable)
            if (this.selectedPath && this.selectedPath.length >= 2) {
                // Remove last property/index and array name to get parent object
                // e.g. sites.0 -> sites (array) -> root? No. 
                // Structure: sites[0].zones[1] -> path ['sites', 0, 'zones', 1]
                // Parent is at path ['sites', 0]
                const parentPath = this.selectedPath.slice(0, -2);
                parent = this.resolvePath(this.data, parentPath);
            } 
            
            // Priority 2: Use Logical Search (Fallback)
            if (!parent) {
                parent = this.findLogicalParent(this.data, config);
            }

            if (parent) {
                const backBtn = document.createElement('button');
                backBtn.className = 'action-btn';
                backBtn.style.width = '100%';
                backBtn.style.marginBottom = '10px';
                backBtn.style.backgroundColor = '#444';
                
                let pName = parent.name || parent.title;
                let pType = parent.class;
                if (parent === this.data) { pName = "Racine du Projet"; pType = "Projet"; }
                else if (!pName) { pName = "Parent Indéfini"; pType = "Object"; }

                backBtn.innerHTML = `<i class="fas fa-arrow-up"></i> ${pName} <small>(${pType || ''})</small>`;
                backBtn.onclick = () => this.selectObject({ config: parent });
                container.appendChild(backBtn);
            }
        }

        this.generateFields(config, container);

        // Hierarchy Actions (if any)
        if (config.class && HIERARCHY_RULES[config.class]) {
            const hr = document.createElement('hr');
            hr.style.borderColor = '#444';
            hr.style.marginTop = '15px';
            container.appendChild(hr);

            const title = document.createElement('h5');
            title.style.margin = '5px 0 10px 0';
            title.innerText = 'Actions Hiérarchiques';
            container.appendChild(title);

            HIERARCHY_RULES[config.class].forEach(rule => {
                const btn = document.createElement('div');
                btn.className = 'palette-item';
                btn.innerHTML = `<i class="fas fa-plus"></i> ${rule.label}`;
                btn.onclick = () => this.addChildObject(rule.type, rule.array);
                container.appendChild(btn);
            });
        }
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
                                                 item.class === 'ip' ? 'map-marker-alt' : 'cube';
                                                 
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
             this.updateFromJSON();
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
        
        this.selectedConfig[arrayName].push(newObj);
        
        if (this.data) {
             const editor = document.getElementById(this.jsonEditorId);
             editor.value = JSON.stringify(this.data, null, 4);
             
             // Update path to point to the new object
             // Current path + arrayName + last index
             if (this.selectedPath) {
                 this.selectedPath = [...this.selectedPath, arrayName, this.selectedConfig[arrayName].length - 1];
             }
             
             // Clear selectedConfig to force restoration via the new Path (pointing to child)
             // instead of sticking to the current object (Parent) via UUID
             this.selectedConfig = null;

             this.updateFromJSON();
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
            
            this.updateFromJSON();
            
        } catch(e) {
            alert("Erreur JSON : " + e.message);
        }
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
}