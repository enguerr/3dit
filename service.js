/***********************
 * networkinterface
 ************************/
import * as THREE from 'three';
import { defaultitem } from './defaultitem.js';
import { connector } from './connector.js';
class service extends defaultitem {
  constructor(scn,config,parent) {
    super(scn,config,parent);
    this.ips = [];
    this.typeObj = 'service';
    this.style.color = 0x11ff55;
    switch (this.config.name) {
      case "HAPROXY":
        this.style.color = 0xcc6702;
        break;
      case "IIS":
        this.style.color = 0x0c5182;
        break;
      case "NGINX":
        this.style.color = 0x12c41b;
        break;
      case "CEPH":
        this.style.color = 0x9d1800;
        break;
      case "ETCD":
        this.style.color = 0xbb8801;
        break;
      case "METALLB":
        this.style.color = 0x56009d;
        break;
      case "KEEPALIVED":
        this.style.color = 0x009d56;
        break;
    }
    this.consoleprefix = '     +'+config.class+' '+config.name+' ';
    console.log(this.consoleprefix+'create element',this);
  }
  /**
   * create
   * create children
   */
  create (el) {
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
    }
  }
  /**
   * createObject
   * Creatio nde l'objet 3d et affecttation des modeles et textures
   */
  createObject(){
    let width = 2;
    let height = 0.5
    var geometry = new THREE.BoxGeometry( width, height, width );
    geometry.translate(width/2,height/2,width/2);
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
    //text
    this.text = this.createText(-0.01, 0.15,0.1,this.config.name,this.mainobj,0.2,0xffffff,'left');
    this.text = this.createText(2.01, 0.15,1.9,this.config.name,this.mainobj,0.2,0xffffff,'right');
    this.text = this.createText(0.2, 0.51,0.35,this.config.name,this.mainobj,0.2,0xffffff,'top');

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
export{service};