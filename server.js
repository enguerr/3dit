/***********************
 * server
 ************************/
import { defaultitem } from './defaultitem.js';
class server extends defaultitem {
    constructor(scn,config) {
        super(scn,config);
        this.typeObj = 'server';
        this.interfaces = [];
        this.interfacesContainer = new THREE.Group;
        this.positionInterface = new position(this.interfacesContainer,this.interfaces,0.5,5,0.5,1);
        //console.log('3D >> '+this.typeObj+' >> new ');
    }
    /**
     * add
     * Ajoute un sous objet
     * @param mi
     */
    add (mi,index='') {
        mi.createObject();
        switch (mi.typeObj) {
            case 'connectors':
                this.connectors[index]=mi;
                //console.log('3D >> '+this.typeObj+' >> add connector ',mi);
                //register connector
                this.scn.addConnector(mi);
                break;
            case 'networkinterface':
                this.interfaces.push(mi);
                //console.log('3D >> '+this.typeObj+' >> add interface ',mi);
                //register connector
                this.interfacesContainer.add(mi.mainobj);
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
        var geometry = new THREE.BoxBufferGeometry( 5, 5, 5 );
        geometry.translate(2.5,2.5,0);
        //var geometry = new THREE.SphereBufferGeometry( 3.14, 64, 16 );

        /**Test material classic**/
        var material = new THREE.MeshPhongMaterial( {
            color: 0x2194ce,
            shininess: 100,
            reflectivity: 1,
            refractionRatio: 0.2,
            emissive: 0x2194ce,
            emissiveIntensity: 0.3,
            specular: 0xf4f4f4,
            opacity: 0.75,
            transparent: true
        });

        var cube = new THREE.Mesh(geometry, material);

        cube.item = this;
        this.mainobj = new THREE.Group();
        this.mainobj.add(cube);

        //interfaces
        this.mainobj.add(this.interfacesContainer);
        this.interfacesContainer.position.x = 2.25;
        this.interfacesContainer.position.y = 5;
        this.interfacesContainer.position.z = -2;

        this.configObject();
    }
    /**
     * compute
     * calcule des dimensions en traversant les enfants
     */
    compute () {
        //POSITION
        this.position.compute();
        this.positionInterface.compute();
    }

}
export{server};