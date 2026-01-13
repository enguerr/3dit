/***********************
 * homee
 ************************/
import * as THREE from 'three';
import {defaultitem} from "./defaultitem.js";
import * as ThreeMeshUI from "three-mesh-ui";
class home extends defaultitem{
    constructor(config,scn) {
        super(scn,config);
        //SPECS
        this.scn = scn;
        this.connectors = [];
        this.typeObj = 'home';
        this.container = new THREE.Group();
        this.mainobj = null;

        //CONFIG
        this.margin = 1;                  //marge autour des serveurs
        this.innermargin = 1;                  //marge autour des serveurs
        this.cylinderoffset = 5;          //décalage en arrière du cylindre réseau
        this.squareoffset = 0.2;            //hauteur des serveurs

        //console.log('3D >> '+this.typeObj+' >> new ');
        this.cameraPosition = new THREE.Vector3(0,10,20);
        this.cameraTarget = new THREE.Vector3(0,5,10);
    }

    /**
     * createObject
      */
    createObject(){
        //TODO
        this.mainobj = new THREE.Object3D();
        this.mainobj.item = this;
        this.mainobj.add(this.container);
    }
    /**
     * init
     */
    init(){
        //mainobj
        this.container.add(this.makeWelcomeTextPanel());
        this.container.add(this.makeNavPanel());
        this.scn.add(this);
        //container
        this.container.position.y = 1;
        this.mainobj.position.y = 100;
        console.log('create home >> create objects '+' '+this.container,this);
    }
    /**
     * compute
     */
    compute() {
        console.log('home >> compute');
        for (var i in this.children)
            this.children[i].compute();
        //this.position.compute();
    }
    /**
     * makeWelcomeTextPanel
     */
    makeWelcomeTextPanel() {
        const container = new ThreeMeshUI.Block({
            width: 12,
            height: 2,
            padding: 0.5,
            justifyContent: 'center',
            alignContent: 'left',
            fontFamily: 'https://unpkg.com/three-mesh-ui/examples/assets/Roboto-msdf.json',
            fontTexture: 'https://unpkg.com/three-mesh-ui/examples/assets/Roboto-msdf.png'
        });

        container.position.set( 0, 7, 5 );
        container.rotation.x = -0.3;

        container.add(
            new ThreeMeshUI.Text({
                content: "IT shaping - Create your own infrastructure ",
                fontSize: 0.55
            })
        );
        return container;
    };
    /**
     * makeNavPanel
     */
    makeNavPanel() {
        const container = new ThreeMeshUI.Block({
            justifyContent: 'center',
            contentDirection: 'column',
            fontFamily: 'https://unpkg.com/three-mesh-ui/examples/assets/Roboto-msdf.json',
            fontTexture: 'https://unpkg.com/three-mesh-ui/examples/assets/Roboto-msdf.png',
            fontSize: 0.7,
            padding: 0.2,
            backgroundOpacity: 0.5,
            borderRadius: 1.1
        });

        container.position.set( 0, 2, 7 );
        container.rotation.x = -0.3;
        let infras = this.scn.getProjects();
        let home =this;
        for (let i  in infras){
            console.log('home >> create button '+i);
            let button = this.createButton(i,function () {
                console.log('home >> click on '+i);
                home.scn.loadProject(i);
            });
            this.scn.addObjInteract(button);
            container.add( button);
        }
        return container;
    };

 }
export{home};