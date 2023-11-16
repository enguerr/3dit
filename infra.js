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
import {positionnetworkdevice} from "./positionnetworkdevice.js";
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
        this.position = new position(this,this.children,2,{},4,5,5);
        this.positionSite = new position(this,this.sites,10,{childPosition:'vertical',depthmargin:8},4,5,5);
        this.positionInstance = new positioninstance(this,this.instances);
        this.positionNetworkDevices = new positionnetworkdevice(this,this.networkdevices);
        this.container = new THREE.Group();
        this.mainobj = null;
        this.cameraPosition = new THREE.Vector3(-22.9,27.3,-134.4);
        this.cameraTarget = new THREE.Vector3(-18.12,21.9,-127.6);
        //console.log('3D >> '+this.typeObj+' >> new ');

    }
    /**
     * init
     * Analyze config and create objects
     */
    init(){
        this.nav = this.makeNavPanel();
        this.scn.camera.add(this.nav);
        this.scn.add(this);
        //process network
        var consoleprefix = ' ** ';
        console.warn(consoleprefix+'NETWORK PROCESS'+consoleprefix);
        for (var i = 0;i < this.config.sites.length;i++) {
            this.create(this.config.sites[i], this);
        }
        //process networkdevice
        console.warn(consoleprefix+'NETWORK DEVICE PROCESS'+consoleprefix);
        for (var i = 0;i < this.config.networkdevices.length;i++) {
            this.create(this.config.networkdevices[i], this);
        }
        //process instances
        console.warn(consoleprefix+'INSTANCE PROCESS'+consoleprefix);
        for (var i = 0;i < this.config.instances.length;i++) {
            this.create(this.config.instances[i], this);
        }
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
        if (this.config.class == type && this.config.name == name) return this;
        //recherche enfants
        if (this.instances) for (let i in this.instances) {
            found = this.instances[i].find(type,name);
            if (found) return found;
        }
        if (this.sites) for (let i in this.sites) {
            found = this.sites[i].find(type,name);
            if (found) return found;
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