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
        this.selectionHighlightMesh = null; // Persistent highlight mesh for selected object
        this.initialCameraPosition = null; // Store initial camera position
        this.initialCameraTarget = null; // Store initial camera target
        this.orbitalRotationTween = null; // Store orbital rotation tween
        this.currentFocusCenter = null; // Store current focus center for orbital rotation

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
                // Update TWEEN animations
                if (typeof TWEEN !== 'undefined') {
                    TWEEN.update();
                }
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

            // Store initial camera position and target
            if (!this.initialized || !this.initialCameraPosition) {
                this.initialCameraPosition = targetPos.clone();
                this.initialCameraTarget = targetLook.clone();
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
            
            // Restore selection highlight after scene rebuild
            if (this.selectedConfig) {
                const sceneItem = this.findItemInScene(this.selectedConfig);
                if (sceneItem) {
                    setTimeout(() => {
                        this.highlightObjectInScene(sceneItem);
                    }, 100);
                }
            }
            
            // Update navigator after scene rebuild (with small delay to ensure DOM is ready)
            setTimeout(() => this.updateNavigator(), 100);

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

        // Hover Highlight Box (for mouse hover, not selection)
        const highlightGeo = new THREE.BoxGeometry(1, 1, 1);
        const highlightMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, opacity: 0.2, transparent: true, depthTest: false });
        const highlightMesh = new THREE.Mesh(highlightGeo, highlightMat);
        highlightMesh.visible = false;
        highlightMesh.renderOrder = 998; // Lower than selection highlight
        highlightMesh.userData.isHoverHighlight = true;
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
                        if (obj.type === 'LineSegments' || obj.type === 'GridHelper' || obj.isUI || 
                            obj === highlightMesh || (obj.userData && obj.userData.isSelectionHighlight)) continue;
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

    selectObject(item, providedPath = null) {
        // Handle both item objects (from scene) and config objects (from navigator/form)
        let config = item.config || item;
        let path = providedPath;
        
        // If path was provided (from navigator), use it to get fresh config
        if (path && this.data) {
            const pathConfig = this.resolvePath(this.data, path);
            if (pathConfig) {
                config = pathConfig;
                console.log("Builder: Using config from provided path", path);
            } else {
                path = null; // Invalid path, recalculate
            }
        }
        
        this.selectedConfig = config;
        
        // Calculate and store path for persistence if not provided
        if (this.data && !path) {
            path = this.getPath(this.data, this.selectedConfig);
            
            // Fallback: If strict equality fails (stale reference), try to find by content
            if (!path) {
                console.warn("Builder: Strict path lookup failed, trying fallback...");
                path = this.findPathByContent(this.data, this.selectedConfig);
                if (path) {
                    // Update reference to the fresh object in data
                    this.selectedConfig = this.resolvePath(this.data, path);
                }
            }
        }
        
        this.selectedPath = path;

        // Highlight object in 3D scene
        // Always try to find the item in scene to ensure proper highlighting
        let sceneItem = null;
        if (item && item.mainobj) {
            // Item from scene click - already has 3D reference
            console.log("Builder: selectObject - item from scene click");
            sceneItem = item;
        } else {
            // Config from navigator/form - need to find item in scene
            console.log("Builder: selectObject - finding item in scene for config", config);
            sceneItem = this.findItemInScene(config);
        }
        
        if (sceneItem) {
            console.log("Builder: selectObject - found sceneItem, highlighting");
            // Small delay to ensure scene is ready
            setTimeout(() => {
                this.highlightObjectInScene(sceneItem);
                // Animate camera to focus on selected item
                this.focusCameraOnItem(sceneItem);
            }, 50);
        } else {
            console.warn("Builder: selectObject - sceneItem not found, cannot highlight");
        }

        // Update UI Visibility
        document.getElementById('palette_library').style.display = 'none';
        document.getElementById('palette_inspector').style.display = 'block';
        
        this.renderInspector(this.selectedConfig); // Use this.selectedConfig which might be refreshed
        this.updateNavigator(); // Update navigator to highlight selected item
    }

    highlightObjectInScene(item) {
        // Remove previous selection highlight box
        if (this.selectionHighlightMesh) {
            if (this.selectionHighlightMesh.parent) {
                this.selectionHighlightMesh.parent.remove(this.selectionHighlightMesh);
            }
            this.selectionHighlightMesh.geometry.dispose();
            this.selectionHighlightMesh.material.dispose();
            this.selectionHighlightMesh = null;
        }

        // Create new highlight box for selected object
        if (!item) return;

        // Find the main mesh to highlight
        let targetMesh = null;
        if (item.mainobj) {
            if (item.getMainMesh && typeof item.getMainMesh === 'function') {
                targetMesh = item.getMainMesh();
            } else {
                targetMesh = item.mainobj;
            }
        }

        if (targetMesh && this.scene && this.scene.scene) {
            try {
                // Create a bounding box highlight that includes all children
                const box = new THREE.Box3().setFromObject(targetMesh);
                const size = new THREE.Vector3();
                box.getSize(size);
                const center = new THREE.Vector3();
                box.getCenter(center);

                // Only create highlight if object has valid size
                if (size.x > 0 && size.y > 0 && size.z > 0 && 
                    size.x < 10000 && size.y < 10000 && size.z < 10000) { // Sanity check
                    const highlightGeo = new THREE.BoxGeometry(size.x, size.y, size.z);
                    const highlightMat = new THREE.MeshBasicMaterial({
                        color: 0xffff00,
                        opacity: 0.3,
                        transparent: true,
                        depthTest: false,
                        side: THREE.BackSide, // Render inside faces for better visibility
                        wireframe: false
                    });

                    this.selectionHighlightMesh = new THREE.Mesh(highlightGeo, highlightMat);
                    this.selectionHighlightMesh.position.copy(center);
                    this.selectionHighlightMesh.renderOrder = 999;
                    this.selectionHighlightMesh.userData.isSelectionHighlight = true;

                    // Add to scene
                    this.scene.scene.add(this.selectionHighlightMesh);
                }
            } catch (e) {
                console.warn("Builder: Error creating highlight:", e);
            }
        }
    }

    focusCameraOnItem(item) {
        if (!item || !this.scene || !this.scene.camera) {
            console.warn("Builder: focusCameraOnItem - missing item or scene");
            return;
        }

        try {
            // Stop any existing camera animation and orbital rotation
            this.stopCameraAnimations();

            // Get the center point of the item
            let centerPoint = null;
            if (item.getWorldCenterPoint && typeof item.getWorldCenterPoint === 'function') {
                centerPoint = item.getWorldCenterPoint();
            } else if (item.getCenterPoint && typeof item.getCenterPoint === 'function') {
                centerPoint = item.getCenterPoint();
                // Convert to world coordinates if needed
                if (item.mainobj) {
                    item.mainobj.localToWorld(centerPoint);
                }
            } else if (item.mainobj) {
                // Fallback: calculate bounding box center
                const box = new THREE.Box3().setFromObject(item.mainobj);
                centerPoint = new THREE.Vector3();
                box.getCenter(centerPoint);
            }

            if (!centerPoint) {
                console.warn("Builder: focusCameraOnItem - could not get center point");
                return;
            }

            // Store center point for orbital rotation
            this.currentFocusCenter = centerPoint.clone();

            // Calculate camera position with offset
            // The offset depends on the size of the object
            let objectSize = 10; // Default size
            if (item.mainobj) {
                const box = new THREE.Box3().setFromObject(item.mainobj);
                const size = new THREE.Vector3();
                box.getSize(size);
                // Use the largest dimension
                objectSize = Math.max(size.x, size.y, size.z);
            }

            // Calculate distance based on object size (with some padding)
            // Minimum distance of 15, scale with object size
            const distance = Math.max(objectSize * 1.5, 15);
            
            // Calculate camera position offset
            // Camera should always be 10 units above the ground (y=0)
            const groundLevel = 0;
            const cameraHeight = 10; // Always 10 units above ground
            const offsetX = 0;
            const offsetY = cameraHeight; // Fixed height above ground
            const offsetZ = distance; // Behind the object

            const cameraPosition = new THREE.Vector3(
                centerPoint.x + offsetX,
                groundLevel + offsetY, // Always 10 units above ground
                centerPoint.z + offsetZ
            );

            // Ensure camOrigTarget exists and is initialized
            if (!this.scene.camOrigTarget) {
                this.scene.camOrigTarget = new THREE.Vector3(0, 0, 0);
            }
            
            // Store initial target for interpolation
            const initialTarget = this.scene.camOrigTarget.clone();
            const finalTarget = centerPoint.clone();
            
            console.log("Builder: Animating camera to", cameraPosition, "focusing on", centerPoint);
            console.log("Builder: Target interpolation from", initialTarget, "to", finalTarget);
            
            // Create custom animation with smooth interpolation for both position and target
            const cam = this.scene.camera;
            const tar = this.scene.camOrigTarget; // Direct reference to the target vector
            
            // Store initial position for interpolation
            const initialPos = cam.position.clone();
            
            // Animation duration
            const animationDuration = 1000; // 1 second
            
            // Animate camera position with smooth easing
            const camTween = new TWEEN.Tween(cam.position)
            .to({
                x: cameraPosition.x,
                y: cameraPosition.y,
                z: cameraPosition.z
            }, animationDuration)
            .easing(TWEEN.Easing.Quadratic.InOut)
            .onUpdate(function () {
                // Make camera look at the target (which is being interpolated separately)
                cam.lookAt(tar);
            });
            
            // Animate camera target (smooth interpolation) - THIS IS THE KEY PART
            // Animate directly on the tar vector (like scene.js does)
            const targetTween = new TWEEN.Tween(tar)
            .to({
                x: finalTarget.x,
                y: finalTarget.y,
                z: finalTarget.z
            }, animationDuration)
            .easing(TWEEN.Easing.Quadratic.InOut)
            .onUpdate(function () {
                // Make camera look at the interpolated target
                cam.lookAt(tar);
            })
            .onComplete(() => {
                console.log("Builder: Camera animation complete, starting orbital rotation");
                // Ensure target is at final position
                tar.copy(finalTarget);
                // Start orbital rotation after animation completes
                this.startOrbitalRotation(finalTarget.clone(), distance);
            });
            
            // Start both animations simultaneously
            camTween.start();
            targetTween.start();
            
            // Store tweens for cleanup
            if (!cam.tweens) cam.tweens = [];
            cam.tweens.push(camTween, targetTween);
        } catch (e) {
            console.error("Builder: Error focusing camera on item:", e);
        }
    }

    stopCameraAnimations() {
        if (!this.scene || !this.scene.camera) return;
        
        // Stop orbital rotation
        if (this.orbitalRotationTween) {
            this.orbitalRotationTween.stop();
            if (typeof TWEEN !== 'undefined') {
                TWEEN.remove(this.orbitalRotationTween);
            }
            this.orbitalRotationTween = null;
        }
        
        // Stop camera tweens
        if (this.scene.stopCameraAnimation) {
            this.scene.stopCameraAnimation();
        } else if (this.scene.camera.tweens) {
            for (let n in this.scene.camera.tweens) {
                if (this.scene.camera.tweens[n]) {
                    this.scene.camera.tweens[n].stop();
                    if (typeof TWEEN !== 'undefined') {
                        TWEEN.remove(this.scene.camera.tweens[n]);
                    }
                }
            }
            this.scene.camera.tweens = [];
        }
    }

    startOrbitalRotation(center, initialRadius) {
        if (!this.scene || !this.scene.camera || !center) {
            console.warn("Builder: Cannot start orbital rotation - missing scene, camera or center");
            return;
        }
        
        // Stop any existing orbital rotation
        if (this.orbitalRotationTween) {
            this.orbitalRotationTween.stop();
            if (typeof TWEEN !== 'undefined') {
                TWEEN.remove(this.orbitalRotationTween);
            }
        }
        
        const cam = this.scene.camera;
        const tar = this.scene.camOrigTarget || center;
        
        // Calculate initial spherical coordinates from current camera position
        const currentPos = cam.position.clone();
        const groundLevel = 0;
        const cameraHeight = 10; // Always 10 units above ground
        
        // Project camera position to horizontal plane at ground level
        const horizontalPos = new THREE.Vector3(currentPos.x, groundLevel, currentPos.z);
        const direction = new THREE.Vector3().subVectors(horizontalPos, new THREE.Vector3(center.x, groundLevel, center.z));
        const currentRadius = direction.length();
        
        if (currentRadius < 0.1) {
            console.warn("Builder: Camera too close to center, cannot start orbital rotation");
            return;
        }
        
        direction.normalize();
        
        // Calculate azimuth (horizontal angle) - elevation is fixed at 0 (horizontal plane)
        let currentAzimuth = Math.atan2(direction.x, direction.z);
        let currentElevation = 0; // Always horizontal (camera at fixed height)
        
        // Create orbital rotation animation
        // Rotate around the center point slowly (one full rotation in 60 seconds for a movement très lent)
        const rotationDuration = 60000; // 60 seconds for full rotation (très lent et fluide)
        
        const orbitalState = {
            azimuth: currentAzimuth,
            elevation: currentElevation,
            radius: currentRadius
        };
        
        console.log("Builder: Starting orbital rotation - azimuth:", currentAzimuth, "elevation:", currentElevation, "radius:", currentRadius);
        
        // Store center and target for the rotation function
        this.orbitalCenter = center.clone();
        this.orbitalTarget = tar;
        this.orbitalState = orbitalState;
        
        // Create orbital rotation function that will be called in the animation loop
        const updateOrbitalRotation = () => {
            // Calculate new camera position in orbit using spherical coordinates
            // Camera always stays at 10 units above ground (y=10)
            const groundLevel = 0;
            const cameraHeight = 10;
            
            // Calculate horizontal position in orbit
            const x = this.orbitalCenter.x + orbitalState.radius * Math.sin(orbitalState.azimuth);
            const y = groundLevel + cameraHeight; // Always 10 units above ground
            const z = this.orbitalCenter.z + orbitalState.radius * Math.cos(orbitalState.azimuth);
            
            cam.position.set(x, y, z);
            // Always look at the center point
            cam.lookAt(this.orbitalTarget);
        };
        
        // Function to create and start a rotation cycle
        const createRotationCycle = () => {
            const startAzimuth = orbitalState.azimuth;
            const endAzimuth = startAzimuth + Math.PI * 2;
            
            // Stop previous tween if exists
            if (this.orbitalRotationTween) {
                this.orbitalRotationTween.stop();
                if (typeof TWEEN !== 'undefined') {
                    TWEEN.remove(this.orbitalRotationTween);
                }
            }
            
            const tween = new TWEEN.Tween(orbitalState)
                .to({ azimuth: endAzimuth }, rotationDuration)
                .easing(TWEEN.Easing.Linear.None) // Constant speed for smooth rotation
                .onUpdate(updateOrbitalRotation.bind(this))
                .onComplete(() => {
                    // Loop: create a new cycle (infinite loop)
                    createRotationCycle();
                });
            
            this.orbitalRotationTween = tween;
            tween.start();
        };
        
        // Start the first rotation cycle
        createRotationCycle();
        
        console.log("Builder: Orbital rotation started around", center, "radius:", currentRadius, "duration:", rotationDuration);
    }

    deselectObject() {
        this.selectedConfig = null;
        this.selectedPath = null;
        document.getElementById('palette_library').style.display = 'block';
        document.getElementById('palette_inspector').style.display = 'none';
        
        // Remove selection highlight
        if (this.selectionHighlightMesh) {
            if (this.selectionHighlightMesh.parent) {
                this.selectionHighlightMesh.parent.remove(this.selectionHighlightMesh);
            }
            this.selectionHighlightMesh.geometry.dispose();
            this.selectionHighlightMesh.material.dispose();
            this.selectionHighlightMesh = null;
        }
        
        // Reset camera to initial position
        this.resetCameraToInitial();
        
        this.updateNavigator(); // Update navigator to remove selection highlight
    }

    resetCameraToInitial() {
        if (!this.scene || !this.scene.camera) return;
        
        // Stop all camera animations
        this.stopCameraAnimations();
        
        // Reset focus center
        this.currentFocusCenter = null;
        
        // Reset to initial camera position if stored
        if (this.initialCameraPosition && this.initialCameraTarget) {
            console.log("Builder: Resetting camera to initial position");
            if (this.scene.animateCamera) {
                this.scene.animateCamera(this.initialCameraPosition, this.initialCameraTarget, 1000);
            } else {
                this.scene.camera.position.copy(this.initialCameraPosition);
                if (this.scene.camOrigTarget) {
                    this.scene.camOrigTarget.copy(this.initialCameraTarget);
                }
                this.scene.camera.lookAt(this.initialCameraTarget);
            }
        }
    }

    renderInspector(config) {
        const container = document.getElementById('inspector_content');
        container.innerHTML = '';

        // Action Buttons (Clone and Delete)
        if (config && config !== this.data) {
            const buttonContainer = document.createElement('div');
            buttonContainer.style.display = 'flex';
            buttonContainer.style.gap = '10px';
            buttonContainer.style.marginBottom = '10px';
            
            // Clone Button
            const cloneBtn = document.createElement('button');
            cloneBtn.className = 'action-btn';
            cloneBtn.style.flex = '1';
            cloneBtn.style.backgroundColor = '#0e639c';
            cloneBtn.innerHTML = `<i class="fas fa-copy"></i> Cloner`;
            cloneBtn.onclick = () => {
                this.cloneObject(config);
            };
            buttonContainer.appendChild(cloneBtn);
            
            // Delete Button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'action-btn';
            deleteBtn.style.flex = '1';
            deleteBtn.style.backgroundColor = '#c72525';
            deleteBtn.innerHTML = `<i class="fas fa-trash"></i> Supprimer`;
            deleteBtn.onclick = () => {
                if (confirm(`Êtes-vous sûr de vouloir supprimer "${config.name || config.ip || 'cet élément'}" ?`)) {
                    this.deleteObject(config);
                }
            };
            buttonContainer.appendChild(deleteBtn);
            
            container.appendChild(buttonContainer);
        }

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

    deleteObject(config) {
        if (!config || !this.data) return;
        
        // Find the object in the data structure and remove it
        const path = this.getPath(this.data, config);
        if (!path || path.length < 2) {
            console.error("Builder: Cannot delete root object or object not found");
            return;
        }
        
        // Get parent and array name
        const arrayName = path[path.length - 2];
        const index = path[path.length - 1];
        const parentPath = path.slice(0, -2);
        const parent = this.resolvePath(this.data, parentPath);
        
        if (!parent || !parent[arrayName] || !Array.isArray(parent[arrayName])) {
            console.error("Builder: Parent or array not found for deletion");
            return;
        }
        
        // Remove from array
        parent[arrayName].splice(index, 1);
        
        // Update JSON and scene
        const editor = document.getElementById(this.jsonEditorId);
        editor.value = JSON.stringify(this.data, null, 4);
        
        // Deselect current object
        this.deselectObject();
        
        // Remove selection highlight
        if (this.selectionHighlightMesh) {
            if (this.selectionHighlightMesh.parent) {
                this.selectionHighlightMesh.parent.remove(this.selectionHighlightMesh);
            }
            this.selectionHighlightMesh.geometry.dispose();
            this.selectionHighlightMesh.material.dispose();
            this.selectionHighlightMesh = null;
        }
        
        // Update scene
        this.updateFromJSON();
    }

    cloneObject(config) {
        if (!config || !this.data) return;
        
        // Find the object in the data structure
        const path = this.getPath(this.data, config);
        if (!path || path.length < 2) {
            console.error("Builder: Cannot clone root object or object not found");
            return;
        }
        
        // Get parent and array name
        const arrayName = path[path.length - 2];
        const index = path[path.length - 1];
        const parentPath = path.slice(0, -2);
        const parent = this.resolvePath(this.data, parentPath);
        
        if (!parent || !parent[arrayName] || !Array.isArray(parent[arrayName])) {
            console.error("Builder: Parent or array not found for cloning");
            return;
        }
        
        // Deep clone the object and all its children
        const clonedObject = this.deepCloneObject(config);
        
        // Add " (Copie)" to the name if it exists, or create a name
        if (clonedObject.name) {
            clonedObject.name = clonedObject.name + " (Copie)";
        } else if (clonedObject.class === 'ip') {
            // For IPs, we might want to increment the IP address
            // For now, just add a suffix
            if (clonedObject.ip) {
                clonedObject.ip = clonedObject.ip + "-copy";
            }
        }
        
        // Generate new UUID for the cloned object
        clonedObject.uuid = this.generateUUID();
        
        // Insert clone right after the original object
        parent[arrayName].splice(index + 1, 0, clonedObject);
        
        // Update JSON and scene
        const editor = document.getElementById(this.jsonEditorId);
        editor.value = JSON.stringify(this.data, null, 4);
        
        // Select the cloned object
        const clonedPath = [...path];
        clonedPath[clonedPath.length - 1] = index + 1; // New index
        this.selectedPath = clonedPath;
        this.selectedConfig = clonedObject;
        
        // Update scene
        this.updateFromJSON();
        
        // Update UI to show the cloned object
        setTimeout(() => {
            this.selectObject({ config: clonedObject });
        }, 100);
    }

    deepCloneObject(obj) {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }
        
        // Create a deep copy
        const cloned = JSON.parse(JSON.stringify(obj));
        
        // Recursively ensure all child objects have new UUIDs
        this.regenerateUUIDs(cloned);
        
        return cloned;
    }

    regenerateUUIDs(node) {
        if (!node || typeof node !== 'object') return;
        
        // Add UUID if it's a "class" object (our domain objects) and missing one
        if (node.class && !node.uuid) {
            node.uuid = this.generateUUID();
        } else if (node.class && node.uuid) {
            // Generate new UUID for cloned objects
            node.uuid = this.generateUUID();
        }

        if (Array.isArray(node)) {
            node.forEach(child => this.regenerateUUIDs(child));
        } else {
            Object.keys(node).forEach(key => {
                // Avoid recursing into some properties if needed, but usually safe
                this.regenerateUUIDs(node[key]);
            });
        }
    }

    updateNavigator() {
        const container = document.getElementById('navigator_content');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (!this.data) {
            container.innerHTML = '<div style="color: #888; padding: 10px;">Aucune donnée chargée</div>';
            return;
        }
        
        // Build tree structure
        this.renderNavigatorTree(this.data, container, 0);
        
        // Expand path to selected item if one is selected
        if (this.selectedPath && this.selectedPath.length > 0) {
            this.expandPathInNavigator(this.selectedPath);
        }
    }

    expandPathInNavigator(path) {
        // Find all parent items and expand them
        const container = document.getElementById('navigator_content');
        if (!container) return;
        
        const items = container.querySelectorAll('.navigator-item');
        let currentPath = [];
        
        // Build path step by step and expand each level
        for (let i = 0; i < path.length - 1; i += 2) {
            if (i + 1 < path.length) {
                currentPath.push(path[i], path[i + 1]);
                
                // Find the item at this path
                items.forEach((itemDiv) => {
                    const itemPath = itemDiv.dataset.path;
                    if (itemPath) {
                        const itemPathArray = JSON.parse(itemPath);
                        if (this.pathsEqual(itemPathArray, currentPath)) {
                            // Expand this item
                            const toggleBtn = itemDiv.querySelector('.navigator-toggle');
                            const childrenDiv = itemDiv.nextElementSibling;
                            if (toggleBtn && childrenDiv && childrenDiv.classList.contains('navigator-children')) {
                                if (childrenDiv.style.display === 'none') {
                                    childrenDiv.style.display = 'block';
                                    toggleBtn.style.transform = 'rotate(90deg)';
                                }
                            }
                        }
                    }
                });
            }
        }
    }

    renderNavigatorTree(obj, container, level = 0, path = []) {
        if (!obj || typeof obj !== 'object') return;
        
        // Arrays to process: sites, zones, networks, instances, networkdevices, interfaces, ips, services
        const arrayKeys = ['sites', 'zones', 'networks', 'instances', 'networkdevices', 'interfaces', 'ips', 'services'];
        
        for (const key of arrayKeys) {
            if (obj[key] && Array.isArray(obj[key])) {
                obj[key].forEach((item, index) => {
                    if (item && typeof item === 'object' && item.class) {
                        const itemPath = [...path, key, index];
                        this.renderNavigatorItem(item, container, level, itemPath);
                    }
                });
            }
        }
    }

    renderNavigatorItem(item, container, level, path) {
        if (!item || !item.class) return;
        
        const itemDiv = document.createElement('div');
        itemDiv.className = 'navigator-item';
        itemDiv.style.paddingLeft = `${10 + level * 20}px`;
        itemDiv.dataset.path = JSON.stringify(path); // Store path for expansion
        
        // Check if selected
        const isSelected = this.selectedConfig && 
                         ((this.selectedConfig.uuid && item.uuid && this.selectedConfig.uuid === item.uuid) ||
                          (this.selectedPath && this.pathsEqual(this.selectedPath, path)));
        
        if (isSelected) {
            itemDiv.classList.add('selected');
            // Scroll into view
            setTimeout(() => {
                itemDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 100);
        }
        
        // Get icon and label
        const iconMap = {
            'site': 'building',
            'zone': 'vector-square',
            'network': 'network-wired',
            'instance': 'server',
            'firewall': 'shield-alt',
            'interface': 'ethernet',
            'ip': 'map-marker-alt',
            'service': 'cogs'
        };
        
        const icon = iconMap[item.class] || 'cube';
        const label = item.name || item.ip || `${item.class} ${path[path.length - 1]}`;
        
        // Check if has children
        const hasChildren = this.hasNavigableChildren(item);
        
        // Toggle button for expandable items
        let toggleBtn = null;
        if (hasChildren) {
            itemDiv.classList.add('has-children');
            toggleBtn = document.createElement('span');
            toggleBtn.className = 'navigator-toggle';
            toggleBtn.innerHTML = '▶';
            toggleBtn.style.transform = 'rotate(0deg)';
            toggleBtn.onclick = (e) => {
                e.stopPropagation();
                const childrenDiv = itemDiv.nextElementSibling;
                if (childrenDiv && childrenDiv.classList.contains('navigator-children')) {
                    const isExpanded = childrenDiv.style.display !== 'none';
                    childrenDiv.style.display = isExpanded ? 'none' : 'block';
                    toggleBtn.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(90deg)';
                }
            };
            itemDiv.appendChild(toggleBtn);
        } else {
            const spacer = document.createElement('span');
            spacer.className = 'navigator-toggle';
            spacer.style.width = '16px';
            itemDiv.appendChild(spacer);
        }
        
        // Icon and label
        const iconSpan = document.createElement('i');
        iconSpan.className = `fas fa-${icon}`;
        itemDiv.appendChild(iconSpan);
        
        const labelSpan = document.createElement('span');
        labelSpan.textContent = label;
        itemDiv.appendChild(labelSpan);
        
        // Action buttons (Clone and Delete) - declare outside if to make them accessible in handleClick
        let cloneBtn = null;
        let deleteBtn = null;
        if (item !== this.data) {
            // Clone button
            cloneBtn = document.createElement('button');
            cloneBtn.className = 'navigator-clone-btn';
            cloneBtn.innerHTML = '<i class="fas fa-copy"></i>';
            cloneBtn.onclick = (e) => {
                e.stopPropagation();
                this.cloneObject(item);
            };
            itemDiv.appendChild(cloneBtn);
            
            // Delete button
            deleteBtn = document.createElement('button');
            deleteBtn.className = 'navigator-delete-btn';
            deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                if (confirm(`Êtes-vous sûr de vouloir supprimer "${label}" ?`)) {
                    this.deleteObject(item);
                }
            };
            itemDiv.appendChild(deleteBtn);
        }
        
        // Click handler for selection - use event delegation on the itemDiv
        itemDiv.style.cursor = 'pointer';
        itemDiv.style.userSelect = 'none'; // Prevent text selection
        
        // Store path and item reference on the element for easy access
        itemDiv.dataset.itemPath = JSON.stringify(path);
        itemDiv.dataset.itemLabel = label;
        
        // Create a bound function to handle the click
        const handleClick = (e) => {
            console.log("Navigator: Click event triggered on", label);
            
            // Check if click is on toggle or delete button
            const clickedElement = e.target;
            
            // Check if clicking on toggle button or its children
            if (toggleBtn) {
                if (clickedElement === toggleBtn || 
                    (clickedElement.closest && clickedElement.closest('.navigator-toggle') === toggleBtn) ||
                    (toggleBtn.contains && toggleBtn.contains(clickedElement))) {
                    console.log("Navigator: Click on toggle button, ignoring");
                    return; // Let toggle button handle it
                }
            }
            
            // Check if clicking on clone button or its children
            if (cloneBtn) {
                if (clickedElement === cloneBtn || 
                    (clickedElement.closest && clickedElement.closest('.navigator-clone-btn') === cloneBtn) ||
                    (cloneBtn.contains && cloneBtn.contains(clickedElement))) {
                    console.log("Navigator: Click on clone button, ignoring");
                    return; // Let clone button handle it
                }
            }
            
            // Check if clicking on delete button or its children
            if (deleteBtn) {
                if (clickedElement === deleteBtn || 
                    (clickedElement.closest && clickedElement.closest('.navigator-delete-btn') === deleteBtn) ||
                    (deleteBtn.contains && deleteBtn.contains(clickedElement))) {
                    console.log("Navigator: Click on delete button, ignoring");
                    return; // Let delete button handle it
                }
            }
            
            // Otherwise, select the item
            e.preventDefault();
            e.stopPropagation();
            
            console.log("Navigator: Click detected on", label, "path:", path);
            
            // Get fresh item from data using path
            let storedPath;
            try {
                storedPath = JSON.parse(itemDiv.dataset.itemPath);
            } catch (e) {
                storedPath = path;
            }
            
            const freshItem = this.resolvePath(this.data, storedPath);
            
            if (freshItem) {
                console.log("Navigator: Selecting item from path", storedPath, freshItem);
                // Pass the path directly to selectObject
                this.selectObject({ config: freshItem }, storedPath);
            } else {
                console.warn("Navigator: Could not resolve item from path, using fallback");
                // Fallback to the item we have
                this.selectObject({ config: item });
            }
        };
        
        // Add click listener with proper event handling
        itemDiv.addEventListener('click', handleClick, true); // Use capture phase
        
        container.appendChild(itemDiv);
        
        // Render children if item has navigable children
        if (hasChildren) {
            const childrenDiv = document.createElement('div');
            childrenDiv.className = 'navigator-children';
            childrenDiv.style.display = 'none';
            container.appendChild(childrenDiv);
            this.renderNavigatorTree(item, childrenDiv, level + 1, path);
        }
    }

    hasNavigableChildren(item) {
        if (!item || typeof item !== 'object') return false;
        const childArrays = ['zones', 'networks', 'interfaces', 'ips', 'services'];
        return childArrays.some(key => item[key] && Array.isArray(item[key]) && item[key].length > 0);
    }

    pathsEqual(path1, path2) {
        if (!path1 || !path2 || path1.length !== path2.length) return false;
        for (let i = 0; i < path1.length; i++) {
            if (path1[i] !== path2[i]) return false;
        }
        return true;
    }

    findItemInScene(config) {
        if (!this.scene || !this.scene.children) {
            console.warn("Builder: findItemInScene - scene or children not available");
            return null;
        }
        
        if (!config) {
            console.warn("Builder: findItemInScene - config is null");
            return null;
        }
        
        console.log("Builder: findItemInScene - searching for", config.name || config.ip, "UUID:", config.uuid);
        
        const findInChildren = (children) => {
            if (!children || !Array.isArray(children)) return null;
            
            for (const child of children) {
                if (!child) continue;
                
                // Check if this is the item we're looking for
                if (child.config) {
                    // Direct reference match (most reliable)
                    if (child.config === config) {
                        console.log("Builder: findItemInScene - found by direct reference");
                        return child;
                    }
                    
                    // UUID match (very reliable)
                    if (child.config.uuid && config.uuid && child.config.uuid === config.uuid) {
                        console.log("Builder: findItemInScene - found by UUID match", config.uuid);
                        return child;
                    }
                    
                    // Name/IP match for fallback (less reliable but useful)
                    if (config.class && child.config.class === config.class) {
                        if (config.name && child.config.name === config.name) {
                            console.log("Builder: findItemInScene - found by name match", config.name);
                            return child;
                        }
                        if (config.ip && child.config.ip === config.ip) {
                            console.log("Builder: findItemInScene - found by IP match", config.ip);
                            return child;
                        }
                    }
                }
                
                // Recursively search children
                if (child.children && Array.isArray(child.children) && child.children.length > 0) {
                    const found = findInChildren(child.children);
                    if (found) return found;
                }
            }
            return null;
        };
        
        const result = findInChildren(this.scene.children);
        if (!result) {
            console.warn("Builder: findItemInScene - item not found in scene", config);
        }
        return result;
    }
}