/***********************
 * networkinterface
 ************************/
import * as THREE from 'three';
import { defaultitem } from './defaultitem.js';
import { ip } from './ip.js';
import { connector } from './connector.js';
class networkinterface extends defaultitem {
    constructor(scn,config,parent,direction='front') {
        if (!config.style) config.style = {};
        if (!config.style.color)
            config.style.color = 0x1155ff;
        super(scn,config,parent);
        this.ips = [];
        this.direction = direction;
        this.typeObj = 'networkinterface';
        this.consoleprefix = '   +'+config.class+' '+config.name;
        console.log(this.consoleprefix+'create element',this);
    }
    /**
     * create
     * create children
     */
    create (el) {
        if (el.ips) {
            //find parent network
            var net = this.getInfra().find('network', el.net);
            if (net)for (var i = 0; i < el.ips.length; i++) {
                //ip object
                if (!el.ips[i].style) el.ips[i].style = {};
                if (!el.ips[i].style.color) el.ips[i].style.color = this.config.style.color;
                var ipo = new ip(this.scn, el.ips[i],this);
                this.add(ipo);
                net.add(ipo);
                ipo.addParent(net);
                //ip connector
                var conn = new connector(this,ipo,{direction:this.direction,color:this.config.style.color,decal:this.config.style.decal+(i*0.2)});
                this.add(conn);
                ipo.add(conn);
            } else console.error('cant find network ',el.net);
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
            case 'connector':
                this.connectors[index]=mi;
                //console.log('3D >> '+this.typeObj+' >> add connector ',mi);
                //register connector
                this.scn.addConnector(mi);
                break;
            case 'ip':
                this.ips.push(mi);
                break;
        }
    }
    /**
     * createObject
     * Creatio nde l'objet 3d et affecttation des modeles et textures
     */
    createObject(){
        let width = 0.5;
        var geometry = new THREE.BoxGeometry( width, width, width );
        geometry.translate(width/2,width/2,width/2);
        //var geometry = new THREE.SphereBufferGeometry( 3.14, 64, 16 );

        /**Test material classic**/
        var material = new THREE.MeshPhongMaterial( {
            color: this.style.color,
            shininess: 100,
            reflectivity: 1,
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

        this.configObject();

        //création des enfants
        this.create(this.config);

    }
    /**
     * compute
     * calcule des dimensions en traversant les enfants
     */
    compute () {
        //super.compute();
        for (var i in this.children)
            this.children[i].compute();

        //POSITION
        this.position.compute();
    }

}
export{networkinterface};