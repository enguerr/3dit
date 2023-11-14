/***********************
 * instance
 ************************/
import * as THREE from 'three';
import { defaultitem } from './defaultitem.js';
import { position } from './position.js';
import { networkinterface } from './networkinterface.js';
import { service } from './service.js';

class instance extends defaultitem {
    constructor(scn,config,parent) {
        super(scn,config,parent);
        this.typeObj = 'instance';
        this.infra = parent;
        this.interfaces = [];
        this.services = [];
        this.squareoffset = 2;
        this.interfacesFrontContainer = new THREE.Group;
        this.interfacesBackContainer = new THREE.Group;
        this.servicesContainer = new THREE.Group;
        this.positionInterfaceStyle = {
            minWidth:0.2,
            minDepth:0.2,
            minHeight:0.2,
            maxWidth:1000,
            maxDepth:1000,
            maxHeight:1000,
            widthmargin: 0.2,
            heightmargin: 1,
            depthmargin: 1,
            widthpadding: 1,
            heightpadding: 1,
            depthpadding: 1,
            innermargin: 1,
            childPosition:'horizontal'              //horizontal,vertical,fill
        };
        this.positionFrontInterface = new position(this.interfacesContainer,this.interfaces,0.1,this.positionInterfaceStyle,5,5,1);
        this.positionBackInterface = new position(this.interfacesContainer,this.interfaces,0.1,this.positionInterfaceStyle,5,5,1);
        this.positionService = new position(this.servicesContainer,this.services,0.1,{
            minWidth:0.2,
            minDepth:0.2,
            minHeight:0.2,
            maxWidth:1000,
            maxDepth:1000,
            maxHeight:1000,
            widthmargin: 0.2,
            heightmargin: 0.1,
            depthmargin: 0.1,
            widthpadding: 1,
            heightpadding: 1,
            depthpadding: 1,
            innermargin: 1,
            childPosition:'fill'              //horizontal,vertical,fill
        },1,1,5);
        //console.log('3D >> '+this.typeObj+' >> new ');
    }
    /**
     * create
     * create children
     */
    create (el) {
        if (el.interfaces) {
            for (var i = 0; i < el.interfaces.length; i++) {
                if (!el.interfaces[i].style)el.interfaces[i].style={};
                if (!el.interfaces[i].style.color)el.interfaces[i].style.color = this.style.color;
                if (!el.interfaces[i].style.decal)el.interfaces[i].style.decal = i*0.2;
                var nif = new networkinterface(this.scn, el.interfaces[i],this,(i%2==0)?'front':'back');
                this.add(nif);
            }
        }
        if (el.services) {
            for (var i = 0; i < el.services.length; i++) {
                var ser = new service(this.scn, el.services[i],this);
                this.add(ser);
            }
        }
    }
    /**
     * add
     * Ajoute un sous objet
     * @param mi
     */
    add (mi,index='') {
        mi.createObject();
        switch (mi.typeObj) {
            case 'networkinterface':
                this.interfaces.push(mi);
                //register connector
                if (mi.direction=='front')
                    this.interfacesFrontContainer.add(mi.mainobj);
                else
                    this.interfacesBackContainer.add(mi.mainobj);
                break;
            case 'service':
                this.services.push(mi);
                //register connector
                this.servicesContainer.add(mi.mainobj);
                break;
            default:
                this.container.add(mi.mainobj);
                this.children.push(mi);
                //call global position update
                //this.scn.compute();
                break;
        }
    }

    /**
     * createObject
     * Creatio nde l'objet 3d et affecttation des modeles et textures
     */
    createObject(){
        let width = 2;
        var geometry = new THREE.BoxGeometry( width, width, width );
        geometry.translate(width/2,width/2,width/2);
        //var geometry = new THREE.SphereBufferGeometry( 3.14, 64, 16 );

        /**Test material classic**/
        var material = new THREE.MeshPhongMaterial( {
            color: 0x2194ce,
            shininess: 100,
            reflectivity: 1,
            refractionRatio: 0.2,
            emissive: 0x2194ce,
            emissiveIntensity: 0.8,
            specular: 0xf4f4f4,
            opacity: 0.85,
            transparent: true
        });

        var cube = new THREE.Mesh(geometry, material);

        cube.item = this;
        this.mainobj = new THREE.Group();
        this.mainobj.add(cube);
        //hauteur
        this.mainobj.position.y = this.squareoffset;

        //interfaces front
        this.mainobj.add(this.interfacesFrontContainer);
        this.interfacesFrontContainer.position.x = 0.1;
        this.interfacesFrontContainer.position.y = 1;
        this.interfacesFrontContainer.position.z = -0.5;
        //interfaces back
        this.mainobj.add(this.interfacesBackContainer);
        this.interfacesBackContainer.position.x = 0.1;
        this.interfacesBackContainer.position.y = 1;
        this.interfacesBackContainer.position.z = 2;

        //services
        this.mainobj.add(this.servicesContainer);
        this.servicesContainer.position.y = 2.1;

        this.configObject();

        //children
        this.create(this.config);
    }
    /**
     * compute
     * calcule des dimensions en traversant les enfants
     */
    compute () {
        //POSITION
        this.position.compute();
        this.positionFrontInterface.compute();
        this.positionBackInterface.compute();
        this.positionService.compute();
        for (var i in this.children)
            this.children[i].compute();
        for (var i in this.interfaces)
            this.interfaces[i].compute();

    }

    /**
     * getDefaultInterface
     * Return the defaultt interface
     */
    getDefaultInterfaceNetwork () {
        if (!this.config.interfaces.length) throw new Error('Interface missing from config');
        return this.config.interfaces[0].net;
    }

}
export{instance};