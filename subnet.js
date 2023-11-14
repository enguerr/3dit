/***********************
 * subnet
 ************************/
import { defaultitem } from './defaultitem.js';
class subnet extends defaultitem {
    constructor(scn,config) {
        super(scn,config);
        //SPECS
        this.cylinderobj = null;
        this.cylinder = null;
        this.square = null;
        this.squareobj = null;
        this.connectors = [];
        this.typeObj = 'subnet';

        //CONFIG
        this.margin = 2;                  //marge autour des serveurs
        this.innermargin = 1;                  //marge autour des serveurs
        this.cylinderoffset = 5;          //décalage en arrière du cylindre réseau
        this.squareoffset = 0.5;            //hauteur des serveurs

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
        this.cylinder = new THREE.CylinderGeometry( 0.5, 0.5, 5, 32 );
        this.cylinder.rotateZ(Math.PI/2);
        //this.cylinder.translate(-this.cylinderoffset/2,5,-this.cylinderoffset);
        var material = new THREE.MeshPhongMaterial( {
            color: 0x999999,
            shininess: 0,
            specular: 0x111111
        });
        this.cylinderobj = new THREE.Mesh(this.cylinder, material);
        this.cylinderobj.position.y = this.squareoffset;

        //square
        this.square = new THREE.BoxBufferGeometry( 10, 0.5, 10 );
        var squarematerial =new THREE.MeshPhongMaterial({
          color: 0xf30000,
          shininess: 0,
          specular: 0xfdfdfd
        });
        this.squareobj = new THREE.Mesh(this.square, squarematerial);

        //mainobj
        this.mainobj = new THREE.Group();
        this.mainobj.add(this.squareobj);
        this.mainobj.add(this.cylinderobj);
        //this.mainobj.translateZ(5);
        this.mainobj.item = this;

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

        //network cylinder
        this.cylinder = new THREE.CylinderGeometry( 0.5, 0.5, this.getInnerWidth(), 32 );
        //this.cylinder = new THREE.CylinderGeometry( 0.5, 0.5, (this.getInnerWidth()+2*this.margin ), 32 );
        this.cylinder.rotateZ(Math.PI/2);
        this.cylinder.translate(0,1,-this.cylinderoffset);
        this.cylinderobj.geometry = this.cylinder;

        //quare below
        var cylinderdepth = 5;
        this.square = new THREE.BoxBufferGeometry( this.getInnerWidth()+2*this.innermargin, 0.5, this.getInnerDepth()+this.cylinderoffset/2+2*this.innermargin);
        this.squareobj.geometry = this.square;
        //this.squareobj.position.x = -this.innermargin;
        this.squareobj.position.y = this.squareoffset/2;
        this.squareobj.position.z = -this.cylinderoffset/2 - this.innermargin + this.getInnerDepth()/2;

        //children container
        this.container.position.y = this.squareoffset;
        this.postInit();
    }
    enableDebug(norecursive) {
        console.log('3D >> '+this.typeObj+' >> enableDebug ',this);
        this.bbox = new THREE.BoxHelper( this.mainobj, 0xffff00 );
        this.scn.scene.add(  this.bbox );
        this.bbox2 = new THREE.BoxHelper( this.container, 0xff0000 );
        this.scn.scene.add(  this.bbox2 );
        const axesCylinder = new THREE.AxesHelper( 5 );
        this.cylinderobj.add(axesCylinder);
        const axesOuter = new THREE.AxesHelper( 5 );
        this.mainobj.add(axesOuter);
        if (!norecursive)
            for (var i in this.children)
                this.children[i].enableDebug();
    }
}
export{subnet};