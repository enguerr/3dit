import * as THREE from 'three';
import { defaultitem } from './defaultitem.js';
/***********************
 * site
 ************************/
class site extends defaultitem {
    constructor(scn,config,parent) {
        super(scn,config,parent);
        //SPECS
        this.cylinderobj = null;
        this.cylinder = null;
        this.square = null;
        this.squareobj = null;
        this.connectors = [];
        this.typeObj = 'site';

        //CONFIG
        this.margin = 2;                  //marge autour des enfants
        this.innermargin = 1;                  //marge autour des enfants
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
          color: 0xfefefe,
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

    /**
     * compute
     * second pass
     */
    compute () {

        for (var i in this.children)
            this.children[i].compute();

        this.position.compute();

        //quare below
        this.square = new THREE.BoxGeometry( this.getInnerWidth()+2*this.innermargin, this.squareoffset, this.getInnerDepth()+2*this.innermargin);
        this.squareobj.geometry = this.square;
        //square;
        this.squareobj.position.y = this.squareoffset/2;
        this.squareobj.position.x = (this.getInnerWidth()+2*this.widthpadding)/2;
        this.squareobj.position.z = (this.getInnerDepth()+2*this.depthpadding)/2;
        //container
        this.container.position.y = this.squareoffset;
        this.container.position.x = this.widthpadding;
        this.container.position.z = this.depthpadding;

        this.postInit();
    }
    /**
     * postInit
     * Initialisation des connecteurs
     */
    postInit() {
        /*for (var i in  this.children){
            if (!this.connectors[this.children[i].key]) {
                //console.log('3D >> ' + this.typeObj + ' >> compute connector ' + i, this.children[i]);
                this.connectors[this.children[i].key] = new connector(this, this.children[i]);
                this.add(this.connectors[this.children[i].key],this.children[i].key);
            }
        }*/
    }
}
export { site};