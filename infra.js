/***********************
 * infra
 * parse config and generate elements
 ************************/
import * as THREE from 'three';
import { site } from './site.js';
import { zone } from './zone.js';
import { network } from './network.js';
import { subnet } from './subnet.js';
import { instance } from './instance.js';
import { position } from './position.js';
import { positioninstance } from './positioninstance.js';
import { defaultitem } from './defaultitem.js';
import { firewall } from './firewall.js';
import * as ThreeMeshUI from "three-mesh-ui";
import { positionnetworkdevice } from "./positionnetworkdevice.js";
import { datacenter } from './datacenter.js';
import { room } from './room.js';
import { dcrow } from './dcrow.js';
import { rack } from './rack.js';
import { physicalserver } from './physicalserver.js';
import { physicalswitch } from './physicalswitch.js';
import { physicalcable } from './physicalcable.js';
import { positiondatacenter } from './positiondatacenter.js';
import { positionrow } from './positionrow.js';
import { createGlobe, GLOBE_RADIUS } from './worldmap.js';
class infra extends defaultitem{
    constructor(config,scn) {
        super(scn,config);
        this.typeObj = 'infra';
        this.children = [];
        this.scn = scn;
        this.nav=  null;
        this.config = config;
        this.sites = [];
        this.zones = [];
        this.networks = [];
        this.subnets = [];
        this.instances = [];
        this.networkdevices = [];
        this.datacenters = [];
        this.physicalCables = [];
        this.rackIndex = {};
        this.position = new position(this,this.children,2,{},4,5,5);
        this.positionSite = new position(this,this.sites,10,{childPosition:'vertical',depthmargin:10,widthmargin:2},4,5,5);
        this.positionInstance = new positioninstance(this,this.instances);
        this.positionNetworkDevices = new positionnetworkdevice(this,this.networkdevices);
        this.positionDatacenters = new positiondatacenter(this, this.datacenters);
        this.container = new THREE.Group();
        this.physicalContainer = new THREE.Group();
        this.mainobj = null;
        this.cameraPosition = new THREE.Vector3(-22.9,27.3,-134.4);
        this.cameraTarget = new THREE.Vector3(-18.12,21.9,-127.6);
        //console.log('3D >> '+this.typeObj+' >> new ');

    }
    /**
     * init
     * Analyze config and create objects
     * @param {boolean} withNav - Enable navigation panel (default true)
     */
    init(withNav = true, layers = 'all'){
        if (withNav) {
            this.nav = this.makeNavPanel();
            this.scn.camera.add(this.nav);
        }
        this.scn.add(this);

        if (layers === 'all' || layers === 'logical') {
            this.initLogical();
        }
        if (layers === 'all' || layers === 'physical') {
            this.initPhysical();
        }
    }

    initLogical() {
        if (this._logicalInitialized) return;
        this._logicalInitialized = true;
        var consoleprefix = ' ** ';
        console.warn(consoleprefix+'NETWORK PROCESS'+consoleprefix);
        if (this.config.sites) {
            for (var i = 0;i < this.config.sites.length;i++) {
                this.create(this.config.sites[i], this);
            }
        }
        console.warn(consoleprefix+'NETWORK DEVICE PROCESS'+consoleprefix);
        if (this.config.networkdevices) {
            for (var i = 0;i < this.config.networkdevices.length;i++) {
                this.create(this.config.networkdevices[i], this);
            }
        }
        console.warn(consoleprefix+'INSTANCE PROCESS'+consoleprefix);
        if (this.config.instances) {
            for (var i = 0;i < this.config.instances.length;i++) {
                this.create(this.config.instances[i], this);
            }
        }
    }

    async ensurePhysical() {
        if (this._physicalInitialized) return;
        await this.initPhysical();
        this.computePhysical();
    }

    async initPhysical() {
        if (this._physicalInitialized) return;
        this._physicalInitialized = true;
        console.warn(' ** PHYSICAL LAYER PROCESS ** ');
        if (this.config.physical && this.config.physical.datacenters) {
            this.mainobj.add(this.physicalContainer);

            const physLight = new THREE.HemisphereLight(0x8899bb, 0x222233, 1.2);
            physLight.position.set(0, 10, 0);
            this.physicalContainer.add(physLight);

            try {
                this._globe = await createGlobe();
                this.physicalContainer.add(this._globe);
            } catch (e) {
                console.warn('[Infra] Globe failed:', e.message);
            }

            for (var i = 0; i < this.config.physical.datacenters.length; i++) {
                this.createPhysical(this.config.physical.datacenters[i], this);
            }

            for (const dc of this.datacenters) {
                dc.showExterior();
            }
        }
    }

    _addPhysicalGround() {
        if (this._groundAdded || this.datacenters.length === 0) return;
        if (this._globe) return;
        this._groundAdded = true;

        const box = new THREE.Box3().setFromObject(this.physicalContainer);
        if (box.isEmpty()) return;
        const center = new THREE.Vector3();
        const size = new THREE.Vector3();
        box.getCenter(center);
        box.getSize(size);

        const padX = Math.max(size.x * 0.3, 3);
        const padZ = Math.max(size.z * 0.3, 3);
        const gw = size.x + padX * 2;
        const gd = size.z + padZ * 2;

        const groundGeo = new THREE.PlaneGeometry(gw, gd);
        const groundCanvas = document.createElement('canvas');
        groundCanvas.width = 512; groundCanvas.height = 512;
        const gCtx = groundCanvas.getContext('2d');
        gCtx.fillStyle = '#222222';
        gCtx.fillRect(0, 0, 512, 512);
        gCtx.strokeStyle = '#333333';
        gCtx.lineWidth = 1;
        for (let i = 0; i <= 32; i++) {
            const p = (i / 32) * 512;
            gCtx.beginPath(); gCtx.moveTo(p, 0); gCtx.lineTo(p, 512); gCtx.stroke();
            gCtx.beginPath(); gCtx.moveTo(0, p); gCtx.lineTo(512, p); gCtx.stroke();
        }
        const groundTex = new THREE.CanvasTexture(groundCanvas);
        groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
        groundTex.repeat.set(Math.ceil(gw / 2), Math.ceil(gd / 2));
        const groundMat = new THREE.MeshStandardMaterial({
            map: groundTex, color: 0x333333, roughness: 0.8, metalness: 0.0
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.set(center.x, box.min.y - 0.05, center.z);
        ground.receiveShadow = true;
        ground.name = '_physicalGround';
        this.physicalContainer.add(ground);
    }

    /**
     * makeNavPanel
     */
    makeNavPanel() {
        const container = new ThreeMeshUI.Block({
            justifyContent: 'center',
            contentDirection: 'row-reverse',
            fontFamily: 'https://unpkg.com/three-mesh-ui/examples/assets/Roboto-msdf.json',
            fontTexture: 'https://unpkg.com/three-mesh-ui/examples/assets/Roboto-msdf.png',
            fontSize: 0.7,
            padding: 0.2,
            borderRadius: 1.1
        });
        container.position.set( 0, -2, -9 );
        container.scale.set( 0.2, 0.2, 0.2 );
        container.rotation.x = -0.3;
        let infra = this;
        let scn = this.scn;
        let buttonNext = this.createButton('Suivant',function() {
            console.log('infra >> nav Suivant');
            scn.go(infra.getNextPoi());
        });
        let buttonPrevious = this.createButton('Precedent',function() {
            console.log('infra >> nav Précédent');
            scn.go(infra.getPreviousPoi());
        });
        let buttonHome = this.createButton('Accueil',function() {
            console.log('infra >> nav Accueil');
            scn.goHome();
        });

        this.scn.addObjInteract(buttonNext);
        this.scn.addObjInteract(buttonPrevious);
        this.scn.addObjInteract(buttonHome);
        container.add( buttonNext, buttonPrevious,buttonHome );
        return container;
    };
    /**
     * destroy
     */
    destroy() {
        let obj = this;
        new TWEEN.Tween(this.mainobj.position)
            .to(
                {
                    y: -20
                },
                2000
            )
            .easing(TWEEN.Easing.Cubic.Out)
            .start()
            .onComplete(() => {
                obj.mainobj.removeFromParent();
                obj.mainobj.remove();
            });
        new TWEEN.Tween(this.nav)
            .to(
                {
                    y: -1
                },
                1000
            )
            .easing(TWEEN.Easing.Cubic.Out)
            .start()
            .onComplete(() => {
                obj.nav.removeFromParent();
                obj.nav.remove();
            });
    }
    /**
     * add
     * Ajoute un sous objet
     * @param mi
     */
    add (mi) {
        mi.createObject();
        this.container.add(mi.mainobj);
        this.children.push(mi);
    }
    createObject(){
        //TODO
        this.mainobj = new THREE.Object3D();
        this.mainobj.add(this.container);
    }
    compute() {
        for (var i in this.children)
            this.children[i].compute();
        this.positionSite.compute();
        this.positionInstance.compute();
        this.positionNetworkDevices.compute();
        this.computePhysical();
    }

    computePhysical() {
        this.positionDatacenters.compute();
        if (this.physicalContainer) this.physicalContainer.updateMatrixWorld(true);
        for (const dc of this.datacenters) {
            dc.showExterior();
        }
    }

    showGlobeView() {
        if (this._globe) this._globe.visible = true;

        this.positionDatacenters.compute();

        for (const dc of this.datacenters) {
            dc.mainobj.visible = true;
            dc.showExterior();
        }
        for (const cable of this.physicalCables) {
            if (cable.mainobj) cable.mainobj.visible = false;
        }
        if (this.physicalContainer) this.physicalContainer.updateMatrixWorld(true);
        this._activeDatacenter = null;
        this._activeRack = null;
    }

    showDatacenterView(dc) {
        if (this._globe) this._globe.visible = false;
        for (const otherDc of this.datacenters) {
            otherDc.mainobj.visible = (otherDc === dc);
        }

        this._ensureDCInterior(dc);

        dc.showInterior();

        dc.mainobj.position.set(0, 0, 0);
        dc.mainobj.quaternion.identity();
        dc.mainobj.scale.setScalar(1);

        for (const rm of dc.rooms) {
            if (rm.rows && rm.rows.length > 0) {
                const pr = new positionrow(rm, rm.rows);
                pr.compute();
            }
            rm.compute();
            if (rm.refit) rm.refit();
        }

        this._positionRooms(dc);
        dc.compute();

        this.physicalContainer.updateMatrixWorld(true);
        this._buildCablesForDC(dc);

        this._activeDatacenter = dc;
        this._activeRack = null;
    }

    _positionRooms(dc) {
        const ROOM_SPACING = 3;
        let offsetX = 0;
        for (const rm of dc.rooms) {
            if (!rm.mainobj) continue;
            rm.mainobj.position.set(offsetX, 0, 0);
            const fw = rm.floorWidth || 10;
            offsetX += fw + ROOM_SPACING;
        }
    }

    showRackView(rackObj) {
        this._activeRack = rackObj;
        this._rackIsolateGroup = new THREE.Group();
        this._rackIsolateGroup.name = '_rackIsolate';

        if (this._activeDatacenter) {
            this._activeDatacenter.mainobj.visible = false;
        }
        for (const cable of this.physicalCables) {
            if (cable.mainobj) cable.mainobj.visible = false;
        }

        rackObj.mainobj.updateWorldMatrix(true, true);
        this._rackOrigParent = rackObj.mainobj.parent;
        this._rackOrigPos = rackObj.mainobj.position.clone();
        this._rackOrigRot = rackObj.mainobj.quaternion.clone();

        this.physicalContainer.add(this._rackIsolateGroup);
        this._rackIsolateGroup.add(rackObj.mainobj);
        rackObj.mainobj.position.set(0, 0, 0);
        rackObj.mainobj.quaternion.identity();

        const rackLight = new THREE.PointLight(0xeef4ff, 8, 20);
        rackLight.position.set(0, 2, -2);
        this._rackIsolateGroup.add(rackLight);
        const ambLight = new THREE.AmbientLight(0xbbddff, 0.6);
        this._rackIsolateGroup.add(ambLight);
    }

    backFromRackView() {
        if (this._activeRack && this._rackOrigParent) {
            this._rackOrigParent.add(this._activeRack.mainobj);
            this._activeRack.mainobj.position.copy(this._rackOrigPos);
            this._activeRack.mainobj.quaternion.copy(this._rackOrigRot);
        }
        if (this._rackIsolateGroup) {
            this._rackIsolateGroup.traverse(c => {
                if (c.isLight) { /* will be removed with group */ }
            });
            this._rackIsolateGroup.removeFromParent();
            this._rackIsolateGroup = null;
        }
        if (this._activeDatacenter) {
            this._activeDatacenter.mainobj.visible = true;
            this._activeDatacenter.showInterior();
        }
        for (const cable of this.physicalCables) {
            if (cable.mainobj) cable.mainobj.visible = true;
        }
        this._activeRack = null;
    }

    _buildCablesForDC(dc) {
        for (const cable of this.physicalCables) {
            if (cable.mainobj) {
                cable.mainobj.removeFromParent();
                cable.mainobj.geometry?.dispose();
                cable.mainobj.material?.dispose();
            }
        }
        this.physicalCables = [];

        const dcConfig = dc.config;
        if (dcConfig && dcConfig.cables) {
            for (const cableConf of dcConfig.cables) {
                const fromRack = this.rackIndex[cableConf.from];
                const toRack = this.rackIndex[cableConf.to];
                if (fromRack && toRack) {
                    const cable = new physicalcable(fromRack, toRack, cableConf);
                    cable.createObject(this.physicalContainer);
                    if (cable.mainobj) {
                        this.physicalContainer.add(cable.mainobj);
                        this.physicalCables.push(cable);
                    }
                }
            }
        }
    }

    createPhysical(el, parent) {
        switch (el.class) {
            case 'datacenter': {
                const dc = new datacenter(this.scn, el, parent);
                dc.createObject();
                this.physicalContainer.add(dc.mainobj);
                this.datacenters.push(dc);
                dc._interiorLoaded = false;
                break;
            }
        }
    }

    _ensureDCInterior(dc) {
        if (dc._interiorLoaded) return;
        dc._interiorLoaded = true;
        const el = dc.config;
        if (el.rooms) {
            for (let i = 0; i < el.rooms.length; i++) {
                this.createPhysicalRoom(el.rooms[i], dc);
            }
        }
        console.log(`[Infra] Lazy-loaded interior for "${el.name}": ${dc.rooms.length} rooms`);
    }

    createPhysicalRoom(el, parentDC) {
        const rm = new room(this.scn, el, parentDC);
        parentDC.add(rm);
        if (el.rows) {
            for (let i = 0; i < el.rows.length; i++) {
                this.createPhysicalRow(el.rows[i], rm);
            }
        }
    }

    createPhysicalRow(el, parentRoom) {
        const row = new dcrow(this.scn, el, parentRoom);
        parentRoom.add(row);
        parentRoom.rows.push(row);
        if (el.racks) {
            for (let i = 0; i < el.racks.length; i++) {
                this.createPhysicalRack(el.racks[i], row);
            }
        }
    }

    createPhysicalRack(el, parentRow) {
        const rk = new rack(this.scn, el, parentRow);
        parentRow.add(rk);
        this.rackIndex[el.name] = rk;
        if (el.equipment) {
            for (let i = 0; i < el.equipment.length; i++) {
                this.createPhysicalEquipment(el.equipment[i], rk);
            }
        }
    }

    createPhysicalEquipment(el, parentRack) {
        let equip;
        switch (el.class) {
            case 'physicalserver':
                equip = new physicalserver(this.scn, el, parentRack);
                break;
            case 'physicalswitch':
                equip = new physicalswitch(this.scn, el, parentRack);
                break;
            default:
                console.warn('Unknown physical equipment class:', el.class);
                return;
        }
        parentRack.add(equip);
    }
    /**
     * create
     * recursiv function to create elements
     * @param el
     * @param parent
     */
    create(el,parent,consoleprefix) {
        if (!consoleprefix)consoleprefix = "+";
        else consoleprefix="  "+consoleprefix;
        console.log(consoleprefix+'-> create element '+el.class,el,parent);
        switch (el.class) {
            case "site":
                var sit = new site(this.scn,el,parent);
                parent.add(sit);
                //process zones
                for (var i = 0;i < el.zones.length;i++)
                    this.create(el.zones[i],sit,consoleprefix);
                this.sites.push(sit);
                break;
            case "zone":
                var zon = new zone(this.scn,el,parent);
                parent.add(zon);
                //process network
                for (var i = 0;i < el.networks.length;i++)
                    this.create(el.networks[i],zon,consoleprefix);
                this.zones.push(zon);
                break;
            case "network":
                var neto = new network(this.scn,el,parent);
                parent.add(neto);
                this.networks.push(neto);
                break;
            case "subnet":
                var sub = new subnet(this.scn,el,parent);
                parent.add(sub);
                this.subnets.push(sub);
                break;
            case "instance":
                var inst = new instance(this.scn,el,parent);
                parent.add(inst);
                this.instances.push(inst);
                break;
            case "firewall":
                var fw = new firewall(this.scn,el,parent);
                parent.add(fw);
                this.networkdevices.push(fw);
                break;
            case "datacenter":
            case "row":
            case "rack":
            case "physicalserver":
            case "physicalswitch":
                break;
        }
    }
    /***********************
     * UTILS
     */
    /**
     * find object
     * find the network by name
     */
    find(type,name){
        //console.log('DEBUG find  INFRA >> test name ',name,' type ',type,this.config);
        let found = false;
        //recherche locale
        // Match by Name OR UUID (if name param looks like a UUID or matches config.uuid)
        if (this.config.class == type) {
            if (this.config.name == name) return this;
            if (this.config.uuid == name) return this;
        }

        // Optimization: Search directly in flat lists if available
        if (type === 'network' && this.networks) {
            for (let i in this.networks) {
                if (this.networks[i].config.name === name || (this.networks[i].config.uuid && this.networks[i].config.uuid === name)) {
                    return this.networks[i];
                }
            }
        }

        //recherche enfants
        if (this.instances) for (let i in this.instances) {
            found = this.instances[i].find(type,name);
            if (found) return found;
        }
        if (this.sites) for (let i in this.sites) {
            found = this.sites[i].find(type,name);
            if (found) return found;
        }
        if (this.networkdevices) for (let i in this.networkdevices) {
             if(this.networkdevices[i].find) {
                found = this.networkdevices[i].find(type,name);
                if (found) return found;
             }
        }
        // Search physical layer
        if (this.datacenters) {
            for (let dc of this.datacenters) {
                found = this._findPhysical(dc, type, name);
                if (found) return found;
            }
        }
        return false;
    }
    _findPhysical(obj, type, name) {
        if (obj.config && obj.config.class === type) {
            if (obj.config.name === name || (obj.config.uuid && obj.config.uuid === name)) return obj;
        }
        const lists = [obj.children, obj.rooms, obj.rows, obj.rackList, obj.equipment];
        for (const list of lists) {
            if (!list) continue;
            for (const child of list) {
                const found = this._findPhysical(child, type, name);
                if (found) return found;
            }
        }
        return false;
    }

    /**
     * enableDebug
     * Enable debug and display bouding box
     */
    enableDebug(type) {
        switch (type){
            case 'site':
                for (var i in this.sites)
                    this.sites[i].enableDebug(true);
                break;
            case 'zone':
                for (var i in this.zones)
                    this.zones[i].enableDebug(true);
                break;
            case 'network':
                for (var i in this.networks)
                    this.networks[i].enableDebug(true);
                break;
            case 'subnet':
                for (var i in this.subnets)
                    this.subnets[i].enableDebug(true);
                break;
            case 'instance':
                for (var i in this.instances)
                    this.instances[i].enableDebug(true);
                break;
            default:
                super.enableDebug(this);
                break;
        }
    }


}
export{infra}