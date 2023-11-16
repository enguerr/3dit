/***********************
 * network
 ************************/
import * as THREE from 'three';
import { defaultitem } from './defaultitem.js';
class network extends defaultitem {
    style = {
        minWidth:10,
        minDepth:6,
        decal:0,
        direction: 'front',
        minHeight:0,
        maxWidth:10,
        maxDepth:1000,
        maxHeight:1000,
        widthmargin: 1,
        heightmargin: 1,
        depthmargin: 1,
        widthpadding: 1,
        heightpadding: 1,
        depthpadding: 1,
        innermargin: 1,
        childPosition:'horizontal'              //horizontal,vertical,fill
    };
    constructor(scn,config,parent) {
        //STYLE
        //SPECS
        super(scn,config,parent);
        this.cylinderobj = null;
        this.cylinder = null;
        this.square = null;
        this.squareobj = null;
        this.connectors = [];
        this.typeObj = 'network';

        //CONFIG
        this.margin = 2;                  //marge autour des serveurs
        this.innermargin = 1;                  //marge autour des serveurs
        this.cylinderoffset = 0.5;          //décalage en arrière du cylindre réseau
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
      //cylinder
        /*this.cylinder = new THREE.CylinderGeometry( 0.5, 0.5, 5, 32 );
        this.cylinder.rotateZ(Math.PI/2);
        //this.cylinder.translate(-this.cylinderoffset/2,5,-this.cylinderoffset);
        var material = new THREE.MeshPhongMaterial( {
            color: 0x999999,
            shininess: 0,
            specular: 0x111111
        });
        this.cylinderobj = new THREE.Mesh(this.cylinder, material);
        this.cylinderobj.position.y = this.squareoffset;*/


        //square
        this.square = new THREE.BoxGeometry( 10, 0.2, 10 );
        var squarematerial =new THREE.MeshPhongMaterial({
          color: 0xbbbbbb,
          shininess: 0.5,
          opacity: 0.85,
          transparent: true,
          specular: 0xfdfdfd
        });
        this.squareobj = new THREE.Mesh(this.square, squarematerial);

        //mainobj
        this.mainobj = new THREE.Group();
        this.mainobj.add(this.squareobj);
        //this.mainobj.add(this.cylinderobj);
        //this.mainobj.translateZ(5);
        this.mainobj.item = this;

        //text
        this.text = this.createText(0.2, 0.21,0.5,this.config.name+"\n"+this.config.network,this.mainobj);

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

        //compute children
        for (var i in this.children)
            this.children[i].compute();
        this.position.compute();

        //dimensions compute
        let width = this.getInnerWidth()+2*this.innermargin;
        width = (this.style.minWidth>width)?this.style.minWidth:width;
        let depth = this.getInnerDepth()+2*this.innermargin;
        depth = (this.style.minDepth>depth)?this.style.minDepth:depth;

        //network cylinder
        /*this.cylinder = new THREE.CylinderGeometry( 0.5, 0.5, width, 32 );
        this.cylinder.rotateZ(Math.PI/2);
        this.cylinder.translate(0,0,0);
        this.cylinderobj.geometry = this.cylinder;
        this.cylinderobj.position.x = width/2;
        this.cylinderobj.position.y = this.cylinderoffset/2+this.squareoffset;
        this.cylinderobj.position.z = this.cylinderoffset/2;*/

        //square below
        this.square = new THREE.BoxGeometry( width, 0.2,depth);
        this.squareobj.geometry = this.square;
        this.squareobj.position.x = width/2;
        this.squareobj.position.y = this.squareoffset/2;
        this.squareobj.position.z = depth/2;

        //children container
        this.container.position.y = this.squareoffset;
        this.container.position.x = this.widthpadding;
        this.container.position.z = this.depthpadding+this.cylinderoffset;
        this.postInit();
    }
}
export {network};