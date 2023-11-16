/***********************
 * ip
 ************************/
import * as THREE from 'three';
import { defaultitem } from './defaultitem.js';
class vrrp extends defaultitem {
    constructor(scn,config,parent) {
        if (!config.style) config.style = {};
        if (!config.style.color)
            config.style.color = 0x009c55;
        super(scn,config,parent);
        this.typeObj = 'vrrp';
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
export{vrrp};