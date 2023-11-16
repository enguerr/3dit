/***********************
 * ip
 ************************/
import * as THREE from 'three';
import { defaultitem } from './defaultitem.js';
import {connector} from "./connector.js";
import {vrrp} from "./vrrp.js";
class ip extends defaultitem {
    constructor(scn,config,parent) {
        if (!config.style) config.style = {};
        if (!config.style.color)
            config.style.color = 0x1155ff;
        super(scn,config,parent);
        this.typeObj = 'ip';
        this.widthmargin = 2;
        this.heightmargin = 2;
        this.depthmargin = 2;
        this.widthpadding = 2;
        this.heightpadding = 2;
        this.depthpadding = 2;
        //console.log('3D >> '+this.typeObj+' >> new ');
        this.consoleprefix = '     +'+config.class+' '+config.ip+' ';
        console.log(this.consoleprefix+'create element',this);
    }

    /**
     * createChildren
     * @param el
     */
    create(el) {
        if (el.vips) {
            //find parent network
            var net = this.getInfra().find('network',this.parents[0].config.net);
            for (var i = 0; i < el.vips.length; i++) {
                if (el.vips[i].net){
                    net = this.getInfra().find('network',el.vips[i].net);
                }
                //ip object
                if (!el.vips[i].style) el.vips[i].style = {};
                if (!el.vips[i].style.color) el.vips[i].style.color = 0x0ea287;
                if (!el.vips[i].style.direction) el.vips[i].style.direction = 'direct';
                switch (el.vips[i].class){
                    case "vrrp":
                    default:
                        var ipo = new vrrp(this.scn, el.vips[i],this);
                        break;
                }
                //this.add(ipo);
                net.add(ipo);
                //ipo.addParent(net);
                //ip connector
                var conn = new connector(this,ipo,{direction:'direct',color:el.vips[i].style.color,visible:this.config.style.visible,decal:this.config.style.decal+(i*0.2)});
                this.add(conn);
                ipo.add(conn);
            }
        }
    }
    /**
     * createObject
     * Creatio nde l'objet 3d et affecttation des modeles et textures
     */
    createObject(){
        let width = 3;
        let height = 0.2;
        let depth = 3;
        var geometry = new THREE.BoxGeometry( width, height, depth );
        geometry.translate(width/2,height/2,depth/2);
        //var geometry = new THREE.SphereBufferGeometry( 3.14, 64, 16 );

        /**Test material classic**/
        var material = new THREE.MeshPhongMaterial( {
            color: this.style.color,
            shininess: 100,
            reflectivity: 0.2,
            refractionRatio: 0.2,
            emissive: this.style.color,
            emissiveIntensity: 0.8,
            specular: 0xf4f4f4,
            opacity: 0.85,
            transparent: true
        });

        var cube = new THREE.Mesh(geometry, material);

        cube.item = this;
        this.mainobj = new THREE.Group();
        this.mainobj.add(cube);

        //text
        this.text = this.createText(0.2, 0.21,0.3,this.config.ip,this.mainobj,0.2,0xffffff,'top');

        this.configObject();
        this.create(this.config);
    }
    /**
     * compute
     * calcule des dimensions en traversant les enfants
     */
    compute () {
        //POSITION
        this.position.compute();
    }

}
export{ip};