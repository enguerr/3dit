function networkScene(mainDiv,$rootScope,$location,url,THREE) {

    //PROPS
    this.scene = null;
    this.scnList = [];
    this.camOrigPosition = {x: 0, y: 10, z: 30};
    this.camOrigTarget = {x: 0, y: 0, z: 0};
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
    this.typeObj = 'root';
    this.camera = null;

    this.initScene = function (mainDiv) {
        console.log('3D >> scene >> initScene');
        //initiliastion HTML
        this.container = document.createElement('div');
        this.parentDiv = document.getElementById(mainDiv);
        this.parentDiv.appendChild(this.container);
        this.sProperties.containers.push(this.container);

        //initilisation camera
        this.camera = new THREE.PerspectiveCamera(45, this.parentDiv.offsetWidth / this.parentDiv.offsetHeight, 1, 1000);
        this.camera.tweens = [];
        this.camera.target = this.camOrigTarget;
        this.sProperties.cameras.push(this.camera);

        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog( 0xCCCCCC, 50, 100 );

        //Initialisation des lumières
        var ambient = new THREE.AmbientLight( 0x444444 );
        this.scene.add(ambient);

        var dirLight = new THREE.DirectionalLight( 0xFFFFFF, 1 );
        dirLight.name = 'Dir. Light';
        dirLight.position.set( 3, 12, 17 );
        dirLight.castShadow = true;
        dirLight.shadow.camera.near = 0.1;
        dirLight.shadow.camera.far = 500;
        dirLight.shadow.camera.right = 17;
        dirLight.shadow.camera.left = - 17;
        dirLight.shadow.camera.top	= 17;
        dirLight.shadow.camera.bottom = - 17;
        dirLight.shadow.mapSize.width = 512;
        dirLight.shadow.mapSize.height = 512;
        dirLight.shadow.radius = 4;
        dirLight.shadow.bias = -0.0005;
        this.scene.add(dirLight);


        var spotLight = new THREE.SpotLight( 0x888888 );
        spotLight.name = 'Spot Light';
        spotLight.angle = Math.PI / 5;
        spotLight.penumbra = 0.3;
        spotLight.position.set( 8, 10, 5 );
        spotLight.castShadow = true;
        spotLight.shadow.camera.near = 8;
        spotLight.shadow.camera.far = 200;
        spotLight.shadow.mapSize.width = 256;
        spotLight.shadow.mapSize.height = 256;
        spotLight.shadow.bias = -0.002;
        spotLight.shadow.radius = 4;
        this.scene.add( spotLight );
        this.sProperties.lights.push(ambient, dirLight,spotLight);

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
        //this.renderer = new THREE.WebGLRenderer({alpha:true});
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(this.parentDiv.offsetWidth, this.parentDiv.offsetHeight);
        console.log('3D >> scene >> init ', this.parentDiv.offsetWidth, this.parentDiv.offsetHeight, this.parentDiv);
        //this.renderer.setClearColor(0xffffff, 0);
        this.renderer.setClearColor(0xcccccc, 1);

        //shadow
        this.renderer.shadowMap.Enabled = true;
        this.renderer.shadowMap.type = THREE.VSMShadowMap;

        //affectation
        this.sProperties.renderers.push(this.renderer);
        this.container.appendChild(this.renderer.domElement);
        this.scene.uProps = this.sProperties;

        //ground
        var ground = new THREE.Mesh( new THREE.PlaneBufferGeometry( 200, 200 ), new THREE.MeshPhongMaterial( {
            color: 0xff3300,
            shininess: 0,
            specular: 0xfdfdfd
        } ) );
        ground.rotation.x = -Math.PI/2;
        ground.scale.multiplyScalar( 3 );
        ground.castShadow = true;
        ground.receiveShadow = true;
        this.scene.add( ground );

        //Recalcule la scene toutes les x msecondes
        this.animate();
    };

    this.render = function (scnList) {
        //obj.renderer.setSize(this.parentDiv.offsetWidth, this.parentDiv.offsetHeight);
        /*for (var i in scnList) {
            var scn = scnList[i];
            if (scn.skip) continue;
            for (var n in scn.uProps.controls) {
                if (scn.uProps.controls[n].hasOwnProperty('update'))
                    scn.uProps.controls[n].update();
            }
            obj.renderer = scn.uProps.renderers[0];
            for (var m in scn.uProps.cameras) {
            }
        }*/
        obj.renderer.render(obj.scene, obj.camera);
    };

    this.animate = function () {
        requestAnimationFrame(obj.animate);
        TWEEN.update();
        obj.render(obj.scnList);
        console.log('3D >> scene >> animate',obj.camera.position,obj.camera.target);
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

    //this.props = {{ quickview | raw }};

    //Initialisation du bouzin
    //this.config = {{ config | raw }};

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
            var hoverTitle = document.getElementById('hoverTitle');
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
                'padding: 5px;');
        });
        this.piControls.addEventListener('hoveroff', function (event) {
            var hoverTitle = document.getElementById('hoverTitle');
            if (hoverTitle) {
                hoverTitle.outerHTML = "";
            }
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
        this.scene.add(obj.mainobj);
        this.children.push(obj);
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
        var cam = this.sProperties.cameras[0];
        var  scn = this.scene;

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
        var cam= this.sProperties.cameras[0];
        console.log('3D >> scene >> animateCamera',pos,target,'from',cam.position,cam.target);
        var camTween = new TWEEN.Tween(cam.position).to({
            x: pos.x,
            y: pos.y,
            z: pos.z
        }, 7000).onUpdate(function () {
            cam.lookAt(cam.target.x,cam.target.y,cam.target.z);
        });
        var camTweenBis = new TWEEN.Tween(cam.target).to({
            x: target.x,
            y: target.y,
            z: target.z
        }, 7000).onUpdate(function () {
            cam.lookAt(cam.target.x,cam.target.y,cam.target.z);
        });
        camTweenBis.start();
        camTween.start();
        cam.tweens = [camTween, camTweenBis];
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