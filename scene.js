import * as THREE from 'three';
import * as dat from 'dat.gui';
import { OrbitControls } from './node_modules/three/examples/jsm/controls/OrbitControls.js';
import { position } from './position.js';
import {BoxLineGeometry} from "./node_modules/three/examples/jsm/geometries/BoxLineGeometry.js";
import * as ThreeMeshUI from "three-mesh-ui";
import {infra} from "./infra.js";
import {positionhome} from "./positionhome.js";
function networkScene(mainDiv,$rootScope,$location,url) {
    //PROPS
    this.scene = null;
    this.scnList = [];
    this.camOrigPosition = {x: 0, y: 10, z: 20};
    this.camOrigTarget = {x: 0, y: 10, z: 0};
    this.sProperties = {
        containers: [],
        cameras: [],
        renderers: [],
        controls: [],
        managers: [],
        lights: [],
        items: []
    };
    this.renderer = null;
    this.children = [];
    this.parentDiv = null;
    var obj = this;
    this.container = null;

    //connectors
    this.connectors = [];
    this.connectorContainer = new THREE.Group();
    this.typeObj = 'scene';

    this.camera = null;
    this.position = new positionhome(this,this.children);
    this.controls = null;
    this.frame = 0;

    //controls
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.mouse.x = this.mouse.y = null;
    this.selectState = false;
    this.vrControl = null;
    this.objInteracts = [];

    //lights
    this.spotlight = null;
    this.OrigSpotlightPosition = null;

    //infra management
    this.projects = [];
    this.currentproject = null;

    //nav
    this.home = null;

    //debug interface
    this.gui = null;


    this.initScene = function (mainDiv) {
        //init events
        this.initWindowEvent();
        console.log('3D >> scene >> initScene');
        //initiliastion HTML
        this.container = document.createElement('div');
        this.parentDiv = document.getElementById(mainDiv);
        this.parentDiv.appendChild(this.container);
        this.sProperties.containers.push(this.container);

        //orhtographic
        /*const frustumSize = 500;
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.OrthographicCamera( frustumSize * aspect / - 2, frustumSize * aspect / 2, frustumSize / 2, frustumSize / - 2, 1, 1000 );*/

        //initilisation camera
        this.camera = new THREE.PerspectiveCamera(45, this.parentDiv.offsetWidth / this.parentDiv.offsetHeight, 1, 1000);
        this.camera.tweens = [];
        this.camera.target = this.camOrigTarget;

        this.sProperties.cameras.push(this.camera);

        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog( 0xCCCCCC, 5, 1000 );
        this.scene.background = new THREE.Color( 0x121212 );

        //Initialisation des lumières
        var ambient = new THREE.AmbientLight( 0x444444 );
        ambient.intensity = 0.1;
        this.scene.add(ambient);

        var dirLight = new THREE.DirectionalLight( 0xFFFFFF, 1 );
        dirLight.name = 'Dir. Light';
        dirLight.intensity = 0.1;
        dirLight.position.set( 3, 12, 17 );
        this.scene.add(dirLight);


        this.spotlight = new THREE.SpotLight( 0x888888);
        this.spotlight.name = 'Camera Spot Light';
        this.spotlight.angle = Math.PI / 4;
        this.spotlight.penumbra = 1;
        this.spotlight.intensity = 1;
        this.spotlight.decay = 0;
        this.spotlight.ambientColor = 0xfff;
        this.camera.add(this.spotlight);
        this.camera.add(this.spotlight.target);
        this.spotlight.position.set( 0, 9, -15);
        this.OrigSpotlightPosition = new THREE.Vector3().copy(this.spotlight.position);
        this.spotlight.target.position.set( 0, 0, -20);
        this.sProperties.lights.push(ambient, dirLight,this.spotlight);
        this.scene.add( this.camera );

        /*var cameraLightHelper = new THREE.PointLightHelper( this.spotlight, 5, 0x00ff00 );
        this.scene.add( cameraLightHelper );*/

        //init GUI DEBUG
        this.initGuiDebug(ambient,dirLight,this.spotlight);

        //Initilisation du gestionnaire de chargement
        var manager = new THREE.LoadingManager();
        manager.onProgress = function (item, loaded, total) {
            if (loaded == total) {
                $rootScope.$broadcast('objLoadComplete');
                obj.loadComplete = true;
                var regex = new RegExp(url+'/([0-9]+)');
                var temp;
                if (temp == $location.path().match(regex)) {
                    var servId = temp[1];
                    var focus = obj.searchItemById(servId, obj.scene);
                    focus.spotlight(true);
                    obj.focusItem(focus, obj.scene.uProps.cameras[0]);
                }
                obj.display = true;
            }
        };
        this.sProperties.managers.push(manager);

        //Initilisation du moteur de rendu
        this.renderer = new THREE.WebGLRenderer({antialias: true});
        this.renderer.xr.enabled = true;
        //this.renderer = new THREE.WebGLRenderer({alpha:true});
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(this.parentDiv.offsetWidth, this.parentDiv.offsetHeight);
        console.log('3D >> scene >> init ', this.parentDiv.offsetWidth, this.parentDiv.offsetHeight, this.parentDiv);
        //this.renderer.setClearColor(0xffffff, 0);
        this.renderer.setClearColor(0xcccccc, 1);

        //shadow
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.VSMShadowMap;

        //affectation
        this.sProperties.renderers.push(this.renderer);
        this.container.appendChild(this.renderer.domElement);
        this.scene.uProps = this.sProperties;

        //ground
        var ground = new THREE.Mesh( new THREE.PlaneGeometry( 200, 200 ), new THREE.MeshPhongMaterial( {
            color: 0x191919,
            shininess: 0,
            specular: 0xfdfdfd
        } ) );
        ground.rotation.x = -Math.PI/2;
        ground.scale.multiplyScalar( 3 );
        ground.castShadow = false;
        ground.receiveShadow = true;
        this.scene.add( ground );
        var room = new THREE.LineSegments(
            new BoxLineGeometry( 80, 60, 100, 100, 100, 100 ).translate( 0, 30, -20 ),
            new THREE.LineBasicMaterial( { color: 0x343434 } )
        );
        this.scene.add(room);
        this.scene.add(this.connectorContainer);

        //Recalcule la scene toutes les x msecondes
        this.animate();
    };

    this.initWindowEvent = function () {
        window.addEventListener( 'pointermove', ( event ) => {
            this.mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
            this.mouse.y = -( event.clientY / window.innerHeight ) * 2 + 1;
        } );

        window.addEventListener( 'pointerdown', () => {
            this.selectState = true;
        } );

        window.addEventListener( 'pointerup', () => {
            this.selectState = false;
        } );

        window.addEventListener( 'touchstart', ( event ) => {
            this.selectState = true;
            this.mouse.x = ( event.touches[ 0 ].clientX / window.innerWidth ) * 2 - 1;
            this.mouse.y = -( event.touches[ 0 ].clientY / window.innerHeight ) * 2 + 1;
        } );

        window.addEventListener( 'touchend', () => {
            this.selectState = false;
            this.mouse.x = null;
            this.mouse.y = null;
        } );
    };

    this.initGuiDebug = function(ambient,dirLight,spotLight) {
        //initialisation interface
        this.gui = new dat.GUI({name: 'DEBUG LIGHTS'});
        var folder1 = this.gui.addFolder('Global light');
        var folder2 = this.gui.addFolder('Directional light');
        var folder3 = this.gui.addFolder('Spot light');
        //ambiant
        folder1.add(ambient, 'intensity', 0, 1);
        //directional
        folder2.add(dirLight, 'intensity', 0, 1);
        //spot
        folder3.add(spotLight, 'intensity', 0, 10);
        folder3.add(spotLight, 'distance', 0, 100);
        folder3.add(spotLight, 'angle', -1, 1);
        folder3.add(spotLight, 'penumbra', 0, 1);
        folder3.add(spotLight, 'decay', 0, 10);
        folder3.add(spotLight.target.position, 'x', -20, 20);
        folder3.add(spotLight.target.position, 'y', -20, 20);
        folder3.add(spotLight.target.position, 'z', -100, 20);
        folder3.add(spotLight.position, 'x', -20, 20);
        folder3.add(spotLight.position, 'y', -20, 20);
        folder3.add(spotLight.position, 'z', -100, 100);
        //var folder4 = this.gui.addFolder('Actions');
        var scnobj = this;
        this.gui.add({ Compute:function (){scnobj.compute()}},'Compute');
        this.gui.add({ DebugSite:function (){document.infra.enableDebug('site')}},'DebugSite');
        this.gui.add({ DebugScene:function (){scnobj.enableDebug()}},'DebugScene');
        this.gui.add({ ComputePosition:function (){scnobj.position.compute()}},'ComputePosition');

    };

    this.render = function (scnList) {
        //on lance un compute toutes les 60 frames
        /*if (this.frame%60 == 0) this.compute();*/

        //moteur de rendu
        obj.renderer.setSize(this.parentDiv.offsetWidth, this.parentDiv.offsetHeight);
        for (var i in scnList) {
            var scn = scnList[i];
            if (scn.skip) continue;
            for (var n in scn.uProps.controls) {
                if (scn.uProps.controls[n].hasOwnProperty('update'))
                    scn.uProps.controls[n].update();
            }
            obj.renderer = scn.uProps.renderers[0];
            for (var m in scn.uProps.cameras) {
                obj.renderer.render(scn, scn.uProps.cameras[m]);
            }
        }
        this.frame++;
    };
    /***************************
     * PROJECT MANAGEMENT
     */
    /**
     * addInfra
     */
    this.destroyCurrentProject = function (){
        this.children.pop();
        this.currentproject.destroy();
        this.resetConnectors();
    }
    this.registerProject = function (p){
        console.log('REGISTER >> ',p);
        this.currentproject= p;
    };
    this.registerHome = function (home){
      this.home= home;
    };
    this.goHome = function (obj,title) {
        if (this.currentproject){
            this.destroyCurrentProject();
        }
        this.home.show();
    };
    this.addProject = function (obj,title) {
        this.projects[title] = obj;
    };
    this.getProjects = function () {
        return this.projects;
    };
    this.loadProject = function (title) {
        if (this.currentproject){
            this.destroyCurrentProject();
        }
        //on cache le home
        this.home.hide();
        fetch(this.projects[title])
            .then((response) => response.json())
            .then((json) => {
                console.log(json);
                let inf  = new infra(json,document.scene);
                inf.init();
                document.scene.registerProject(inf);
                document.scene.compute();
            });
    };

    /***************************
     * RAYCAST INTERACTION
     */
    /**
     * addObjInteract
     */
    this.addObjInteract = function (obj) {
        this.objInteracts.push(obj);
    };
    /**
     * updateButtons
     */
    this.updateButtons = function() {
        // Find closest intersecting object
        let intersect;
        if ( this.renderer.xr.isPresenting ) {
            this.vrControl.setFromController( 0, this.raycaster.ray );
            intersect = this.raycast();
            // Position the little white dot at the end of the controller pointing ray
            if ( intersect ) this.vrControl.setPointerAt( 0, intersect.point );
        } else if ( this.mouse.x !== null && this.mouse.y !== null ) {
            this.raycaster.setFromCamera( this.mouse, this.camera );
            intersect = this.raycast();
        }

        // Update targeted button state (if any)
        if ( intersect && intersect.object.isUI ) {
            if ( this.selectState ) {
                // Component.setState internally call component.set with the options you defined in component.setupState
                intersect.object.setState( 'selected' );
            } else {
                // Component.setState internally call component.set with the options you defined in component.setupState
                intersect.object.setState( 'hovered' );
            }
        }

        // Update non-targeted buttons state
        this.objInteracts.forEach( ( obj ) => {
            if ( ( !intersect || obj !== intersect.object ) && obj.isUI ) {
                // Component.setState internally call component.set with the options you defined in component.setupState
                obj.setState( 'idle' );
            }
        });
    }

    /**
     * raycast
     */
    this.raycast = function() {
        return this.objInteracts.reduce( ( closestIntersection, obj ) => {
            const intersection = this.raycaster.intersectObject( obj, true );
            if ( !intersection[ 0 ] ) return closestIntersection;
            if ( !closestIntersection || intersection[ 0 ].distance < closestIntersection.distance ) {
                intersection[ 0 ].object = obj;
                return intersection[ 0 ];
            }
            return closestIntersection;
        }, null );
    }

    /***************************
     * LOOP ANIMATION
     */
    this.spotAnimation = function (time) {
        const t = time * 0.001;
        this.spotlight.position.x = this.OrigSpotlightPosition.x + Math.sin(t) * 0.25;
        this.spotlight.position.y = this.OrigSpotlightPosition.y +Math.cos(t) * 0.25;
    }
    /**
     * animate
     */
    this.animate = function (time) {
        requestAnimationFrame(obj.animate);
        //spot animation
        //obj.spotAnimation(time);
        //this.renderer.setAnimationLoop(obj.animate);
        TWEEN.update();
        if (obj.controls) {obj.controls.update();}
        obj.render(obj.scnList);
        //animate children
        if (obj.children)
            for (var i in obj.children)
                obj.children[i].animate();
        //animate interface ui
        ThreeMeshUI.update();
        //update buttons by rautracing
        obj.updateButtons();
        //console.log('3D >> scene >> animate',obj.camera.position,obj.camera.target);
    };

    this.buildFromConfig = function (config, base, scene) {
        console.log('3D >> scene >> config', config);
        //routeur
        for (var f in config.devices) {
            //console.log('devices',config.devices[f]);
            var dev = new MapItem(config.devices[f], scene);
            base.add(dev);
            //switch
            for (var n in config.devices[f].networks) {
                var sw = new MapItem({type: 'switch'}, scene);
                dev.add(sw);
                this.buildFromConfig(config.devices[f].networks[n], sw);
            }
        }
        return true;
    };

    this.searchItemById = function (id, scn) {
        var items = scn.uProps.items;
        for (var n in items) {
            if (items[n].id == id)
                return items[n];
        }
        return false;
    };

    this.getItemFromMesh = function (uuid, scn) {
        var items = scn.uProps.items;
        for (var n in items) {
            for (var m in items[n].uuids) {
                if (items[n].uuids[m] == uuid)
                    return items[n];
            }
        }
        return false;
    };

    this.getAllMeshes = function (items,meshes) {
        for (var n in items) {
            var item = items[n];
            //console.log('3D >> scene >> enableClick item',item);
            if ( item instanceof THREE.Mesh ) {
                var mesh = new THREE.Mesh(new THREE.Box3().setFromObject(item),new THREE.MeshLambertMaterial({color: 0xB0F2B6}));
                //this.scene.add(mesh);
                meshes.push(item);
                //console.log('3D >> scene >> enableClick add meshes ', item);
                //meshes = this.getAllMeshes(item.children, meshes);
            } else if (item instanceof THREE.Object3D ) {
                //meshes = this.getAllMeshes(item.children,meshes);
            } else if (item instanceof THREE.Group) {
                //console.log('aaaaaaaaaaaa');
                /*for (var p in child.children) {
                    if (child.children[p] instanceof THREE.Mesh) {
                        meshes.push(child.children[p]);
                        //console.log('bbbbbbbbbbb');
                    }
                }*/
            } else {
                //console.log('cccccccccc',child);
            }
        }
        return meshes;
    };
    /***************************
     * CONNECTORS
     */
    this.resetConnectors = function (){
        for (let i in this.connectors){
            this.connectors[i].destroy();
        }
        this.connectors = [];
    };

    this.addConnector = function (conn){
        this.connectorContainer.add(conn.mainobj);
        this.connectors.push(conn);
        conn.compute();
    };
    /***************************
     * POSITION AND SHAPE UPDATE
     */
    this.compute = function () {
        console.log('3D >> scene >> compute',this);
        for (var i in this.children)
            this.children[i].compute();
        this.position.compute();
        for (var i in this.connectors)
            this.connectors[i].compute();
    };
    /***************************
     * EVENTS
     */
    /**
     * enableClick
     * Enable click events on a particular context given with parameters
     * @param object item context to enable click
     */
    this.enableClick = function (item) {
        if (this.piControls){
            //destruction de l'existant
            this.piControls.removeEventListener('hoveron');
            this.piControls.removeEventListener('hoveroff');
            this.piControls.removeEventListener('objFocus');
            this.piControls.dispose();
            this.piControls = null;
        }
        var cam = this.sProperties.cameras[0];
        var rend = this.sProperties.renderers[0];
        var scn = this.scene;
        if (!item) item = scn;
        var meshes = this.getAllMeshes(item.children,[]);
        console.log('3D >> scene >> enable click ',meshes);
        this.piControls = new THREE.ParcInfraControls(meshes, cam, rend.domElement);
        scn.uProps.controls.push(this.piControls);
        this.piControls.activate();
        this.piControls.addEventListener('hoveron', function (event) {
            //console.log('3D >> scene >> hover >> item ',event);
            var hoveredItem = obj.getItemFromMesh(event.object.uuid, scn);
            //console.log(hoveredItem,event);
            /*var hoverTitle = document.getElementById('hoverTitle');
            if (!hoverTitle) {
                hoverTitle = document.createElement('div');
                hoverTitle.id = 'hoverTitle';
                document.body.appendChild(hoverTitle);
            }
            hoverTitle.innerHTML = (hoveredItem.label || 'Inconnu');
            if (hoveredItem.id)
                hoverTitle.innerHTML += " (" + hoveredItem.id + ") ";

            hoverTitle.setAttribute("style",
                'position: absolute;' +
                'top:' + (event.oEvent.y + 15) + 'px;' +
                'left:' + (event.oEvent.x + 15) + 'px;' +
                'z-index: 3000;' +
                'background-color: #fff;' +
                'border: 1px solid #000;' +
                'padding: 5px;');*/
        });
        this.piControls.addEventListener('hoveroff', function (event) {
            /*var hoverTitle = document.getElementById('hoverTitle');
            if (hoverTitle) {
                hoverTitle.outerHTML = "";
            }*/
        });
        this.piControls.addEventListener('objFocus', function (event) {
            console.log('3D >> scene >> focusObject',event.object.item);
            var clickedItem = event.object.item;
            if(!clickedItem){
                console.log('3D >> scene >> focusObject >> no item to select',event);
                return;
            }
            $rootScope.$broadcast('objFocus',clickedItem);
        });
    };

    /**
     * add
     * Ajout un objet sur la scene
     * @params Object(DefualtItem)
     */
    this.add = function (obj){
        console.log('3D >> scene >> add obj',obj);
        obj.createObject();
        this.scene.add(obj.mainobj);
        this.children.push(obj);
        //call position
        //this.compute();
    };
    /*************************
     * UTILS
     ***********************/
    /**
     * getBoudingBox
     * return a cube geometry
     */
    this.getCenterPoint = function () {
        return this.getCenterBoundingBox();
    };

    this.getBoundingBox = function () {
        this.scene.updateMatrix();
        var bb = new THREE.BoxHelper( this.scene, 0xffff00 );
        bb.geometry.computeBoundingBox();
        //this.scene.add(bb);
        return bb.geometry.boundingBox;
    };
    this.getCenterBoundingBox = function () {
        var avVect = new THREE.Vector3(0, 0, 0);
        var ceVect = new THREE.Vector3(0, 0, 0);
        var bb = this.getBoundingBox();

        bb.getCenter(ceVect);
        avVect.add(ceVect);
        console.log('3D >> scene >> getCenterBoundingBox',bb, avVect);
        return avVect;
    };

    this.getWidth = function () {
        var bb = this.getBoundingBox();
        var dims = bb.getSize();
        return dims.x;
    };
    /**
     * enableDebug
     * Recursively enable debug on all objects
     */
    this.enableDebug = function () {
        for (var i in this.children)
            this.children[i].enableDebug();
    }


    /**************************
     * CAMERAS
     **************************/
    /**
     * focusItem
     * deplace la camera sur l'item.
     * @param item
     * @param cam
     */
    this.focusItem = function (item) {
        //on stoppe les animations de camera
        this.stopCameraAnimation();
        //on récupère le point central de l'élément
        var pos = item.getCenterPoint();
        var mainMesh = item.getMainMesh();
        mainMesh.worldToLocal(pos);

        //mode spotlight pou rl'objet
        item.spotlight();

        var posx = pos.x;
        var posy = pos.y +20;
        var posz = pos.z +15;
        var camPos = new THREE.Vector3(posx, posy, posz);

        mainMesh.localToWorld(pos);
        mainMesh.localToWorld(camPos);

        this.animateCamera(camPos,pos);
    };
    //Stop camera animations
    this.stopCameraAnimation = function (cam) {
        //Gestion Camera
        if (!cam) cam  = this.sProperties.cameras[0];
        for (var n in cam.tweens) {
            cam.tweens[n].stop();
            TWEEN.remove(cam.tweens[n]);
        }
    };

    /**
     * resetCamera
     * recentre la camera sur la vue globale
     * doit obligatoirement calculer le point central
     * TODO: distance en fonction de la largeur de l'objet
     * @param obj
     * @param scn
     * @param cam
     */
    this.resetCamera = function () {
        console.log('3D >> scene >> resetCamera',this.scene);
        //dans un premier temps on positionne la cible de la camera sur le centre du réseau
        var objCenter = this.getCenterBoundingBox();
        this.camOrigPosition.x = objCenter.x;
        this.animateCamera(this.camOrigPosition,objCenter);
    };

    /**
     * animateCamera
     * anime la camera position et target vers les cibles fournis en parametre
     * @param cam
     * @returns {boolean}
     */
    this.animateCamera = function (pos,target) {
        var cam= this.camera;
        console.log('3D >> scene >> animateCamera',pos,target,'from',cam.position,cam.target);
        var camTween = new TWEEN.Tween(cam.position).to({
            x: pos.x,
            y: pos.y,
            z: pos.z
        }, 700).onUpdate(function () {
            cam.lookAt(cam.target.x,cam.target.y,cam.target.z);
        });
        var camTweenBis = new TWEEN.Tween(cam.target).to({
            x: target.x,
            y: target.y,
            z: target.z
        }, 700).onUpdate(function () {
            cam.lookAt(cam.target.x,cam.target.y,cam.target.z);
        });
        camTweenBis.start();
        camTween.start();
        cam.tweens = [camTween, camTweenBis];
    };

    /**
     * freeCamera
     * enable free camera controls
     */
    this.freeCamera = function () {
        this.controls = new OrbitControls( this.camera, this.renderer.domElement );
        this.controls.listenToKeyEvents( window ); // optional

        //controls.addEventListener( 'change', render ); // call this only in static scenes (i.e., if there is no animation loop)

        this.controls.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
        this.controls.dampingFactor = 0.05;

        this.controls.screenSpacePanning = false;

        this.controls.minDistance = 10;
        this.controls.maxDistance = 50;

        this.controls.maxPolarAngle = Math.PI / 2;
        //this.controls = new MapControls( this.camera, this.renderer.domElement );
    };

    console.log('3D >> scene >> init');
    //initialisation scene threejs
    this.initScene(mainDiv);
    this.scnList.push(this.scene);

    //this.base = new MapItem({type:'container',rotateAxis:'x',colors:[0x888888],name:''},this);
    //this.scene.add(this.base.threeObj);
    this.resetCamera();

}
export {networkScene};