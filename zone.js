/***********************
 * zone
 ************************/
import * as THREE from 'three';
import { defaultitem } from './defaultitem.js';
class zone extends defaultitem {
    constructor(scn,config,parent) {
        super(scn,config,parent);
        //SPECS
        this.cylinderobj = null;
        this.cylinder = null;
        this.square = null;
        this.squareobj = null;
        this.connectors = [];
        this.typeObj = 'zone';

        //CONFIG
        this.margin = 1;                  //marge autour des serveurs
        this.innermargin = 1;                  //marge autour des serveurs
        this.cylinderoffset = 5;          //décalage en arrière du cylindre réseau
        this.squareoffset = 0.2;            //hauteur des serveurs

        //console.log('3D >> '+this.typeObj+' >> new ');
    }

    /**********************************************************************************
     *  FIRST PASS
     */
    /**
     * createObject
     * Creatio nde l'objet 3d et affecttation des modeles et textures
     */
    createObject(){
        //square
        this.square = new THREE.BoxGeometry( 10, 0.2, 10 );
        var squarematerial =new THREE.MeshPhongMaterial({
          color: 0xdedede,
          shininess: 0.5,
          opacity: 0.85,
          transparent: true,
          specular: 0xfdfdfd
        });
        this.squareobj = new THREE.Mesh(this.square, squarematerial);


        //mainobj
        this.mainobj = new THREE.Group();
        this.mainobj.add(this.squareobj);
        //this.mainobj.translateZ(5);
        this.mainobj.item = this;

        this.text = this.createText(0.2, this.squareoffset+0.1,0.5,this.config.name,this.mainobj);

        //container
        this.container.position.y = 1;

        this.configObject();
        //console.log('create subnet >> create objects '+this.key+' '+this.cylinderobj,this);

    }

    /**********************************************************************************
     *  SECOND PASS
     */

}
export{zone};