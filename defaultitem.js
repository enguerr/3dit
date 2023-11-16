import { FontLoader } from './node_modules/three/examples/jsm/loaders/FontLoader.js';
import { SVGLoader } from './node_modules/three/examples/jsm/loaders/SVGLoader.js';
import { position } from './position.js';
import * as THREE from 'three';
import * as ThreeMeshUI from "three-mesh-ui";


/***********************
 * Defaultitem
 * class mere portant les foncitonnalités objet principales
 * - init
 * - container avec rollover
 * - positionnement
 * - dimensionnement
 ************************/
class defaultitem {
    style = {
        minWidth:5,
        decal:0,
        direction: 'front',
        minDepth:5,
        minHeight:0,
        maxWidth:1000,
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
    }
    constructor(scn,config,parent) {
        //console.log('3D >> '+this.typeObj+' >> new ');
        //this.coords = {dimensions:{x:10,y:10,z:10},positions:{x:0,y:0,z:0}};
        this.consoleprefix = ' +'+config.class+' '+config.name;
        this.children = [];
        this.parents = [parent];
        this.connectors = [];
        this.tweens = [];
        this.colors = [];
        this.key = this.generateHexString(10);
        this.mainobj = null;
        this.rolloverobj = null;
        this.typeObj = 'default';
        this.scn = scn;
        this.config = config;
        if (!this.config.style)this.config.style = this.style;
        else {
            //update style
            for (var i in this.config.style){
               this.style[i] = this.config.style[i];
            }
            this.config.style = this.style;
        }
        this.position = new position(this,this.children,2,this.config.style,2,10,10);
        this.container = new THREE.Group();
        this.square =null;
        this.squareobj =null;
        this.squareoffset = 0;
        //move to style
        this.widthmargin = 1;
        this.heightmargin = 1;
        this.depthmargin = 1;
        this.widthpadding = 1;
        this.heightpadding = 1;
        this.depthpadding = 1;
        this.innermargin = 1;

        this.pois = config.pois;
        this.currentPoi = 0;

        //override style
        if (config.style) this.style = { ...this.style, ...config.style};
        this.key=this.makeid();
        this.setColors();

        //children creation
        //this.create(config);
        //console.log('3D >> '+this.typeObj+' >> new ',this.style);
    }
    addParent(item){
        this.parents.push(item);
    }
    /**
     * create
     * create children
     */
    create (config) {

    }

    /**
     * setColors
     * Selection des couleurs de textures / rollover ect
     */
    setColors() {
        this.colors[0] = (this.colors && this.colors[0]) ? this.colors[0] : 0xcccccc;
        this.colors[1] = (this.colors && this.colors[1]) ? this.colors[1] : 0xff0000;
        this.colors[2] = (this.colors && this.colors[2]) ? this.colors[2] : 0x00ff00;
    }
    /**
     * createObject
     * Creatio nde l'objet 3d et affecttation des modeles et textures
     */
    createObject(){
        this.square = new THREE.BoxGeometry( 15, 1, 15 );
        //geometry.translate(0,5,0);
        //var material = new THREE.MeshLambertMaterial( {color: this.colors[0],opacity: 1} );
        /**Test material classic**/
        var material = new THREE.MeshPhongMaterial( {
            color: 0x9194ce,
            shininess: 100,
            reflectivity: 1,
            refractionRatio: 0.2,
            emissive: 0x2194ce,
            emissiveIntensity: 0.3,
            specular: 0xf4f4f4,
            opacity: 0.35,
            transparent: true
        });

        this.mainobj = new THREE.Group();
        this.squareobj = new THREE.Mesh(this.square, material);
        this.mainobj.add(this.squareobj);

        this.mainobj.item = this;

        //call createObject recursive
        this.configObject();
    }

    /**
     * compute
     * calcule des dimensions en traversant les enfants
     */
    compute () {
        for (var i in this.children)
            this.children[i].compute();
        this.position.compute();

        //dimensions compute
        let width = this.getInnerWidth()+2*this.innermargin;
        width = (this.style.minWidth>width)?this.style.minWidth:width;
        let depth = this.getInnerDepth()+2*this.innermargin;
        depth = (this.style.minDepth>depth)?this.style.minDepth:depth;
//console.log('DEBUG compute',width,depth,this.style);
        //square;
        this.square = new THREE.BoxGeometry(width, this.squareoffset, depth);
        this.squareobj.geometry = this.square;
        this.squareobj.position.y = this.squareoffset/2;
        this.squareobj.position.x = width/2;
        this.squareobj.position.z = depth/2;

        //container
        this.container.position.y = this.squareoffset;
        this.container.position.x = this.widthpadding;
        this.container.position.z = this.depthpadding;
    }

    /**
     * configObject
     * Coinfigure l'objet ombres / lumière etc
     */
    configObject() {
        this.mainobj.add(this.container);
        this.mainobj.castShadow = true;
        this.mainobj.receiveShadow = true;
    }

    /**
     * postInit
     * Post initialisation , s'execute après les positions
     * Pour les connecteurs par exemple
     */
    postInit() {

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
            default:
                this.container.add(mi.mainobj);
                this.children.push(mi);
                //call global position update
                //this.scn.compute();
                break;
        }
    }
    /**
     * find object
     * find the network by name
     */
    find(type,name){
//console.log('DEBUG find >> test name ',name,' type ',type,this.config);
        let found = false;
        //recherche locale
        if (this.config.class == type && this.config.name == name) return this;
        //recherche enfants
        if (this.children) for (let i in this.children) {
            found = this.children[i].find(type,name);
            if (found) return found;
        }
        return false;
    }

    /**
     * select
     * Selectionne l'objet et modifie le contexte à l'intérieur
     */
    select() {
        var mainMesh = this.getMainMesh();
        //console.log('3D >> '+this.typeObj+' >> spotlight ',mainMesh);
        this.stopAnimation();
    }

    /**
     * getMainMesh
     * Retourne u mesh représentant les dimensions englobantes
     * @returns {null|*}
     */
    getMainMesh(){
        var mainMesh = null;
        if(this.mainobj instanceof THREE.Mesh || this.mainobj instanceof THREE.Group){
            mainMesh = this.mainobj;
            return mainMesh;
        }
        for (var n in this.mainobj.children){
            if(this.mainobj.children[n] instanceof THREE.Mesh || this.mainobj.children[n] instanceof THREE.Group){
                mainMesh = this.mainobj.children[n];
                break;
            }
        }

        return mainMesh;
    }

    /**
     * move
     * Deplacemenent de l'objet
     */
    move(coords){
        if (!isNaN(coords['x']) && coords['x'] !== Infinity) this.mainobj.position.x= coords['x'];
        if (!isNaN(coords['y']) && coords['y'] !== Infinity) this.mainobj.position.y= coords['y'];
        if (!isNaN(coords['z']) && coords['z'] !== Infinity) this.mainobj.position.z= coords['z'];
    }
    /*************************
     * NAV
     */
    /**
     * getNextPoi
     * @returns {*}
     */
    getNextPoi() {
        this.currentPoi++;
        if (this.currentPoi >= this.pois.length)
            this.currentPoi = 0;
        return this.pois[this.currentPoi];
    }
    /**
     * getPreviousPoi
     * @returns {*}
     */
    getPreviousPoi() {
        this.currentPoi--;
        if (this.currentPoi < 0)
            this.currentPoi = this.pois.length-1;
        return this.pois[this.currentPoi];
    }
    /**
     * getFirstPoi
     * @returns {*}
     */
    getFirstPoi() {
        this.currentPoi=0;
        return this.pois[this.currentPoi];
    }
    /*************************
     * UTILS
     */

    /**
     * generate id
     *
     */
    makeid(length=10) {
        var result           = '';
        var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        var charactersLength = characters.length;
        for ( var i = 0; i < length; i++ ) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result;
    }
    /**
     *
     */
    generateHexString(length) {
        var ret = "";
        while (ret.length < length) {
            ret += Math.random().toString(16).substring(2);
        }
        return ret.substring(0,length);
    }
    /**
     * getBoudingBox
     * return a cube geometry
     */
    getCenterPoint () {
        var v = this.getWorldCenterPoint();
        this.mainobj.worldToLocal(v);
        return v;
    }

    getBoundingBox () {
        this.mainobj.updateMatrix();
        var aabb = new THREE.Box3();
        aabb.setFromObject( this.mainobj );
        return aabb;
    }
    getWorldCenterPoint () {
        var bb = this.getBoundingBox();
        var center = new THREE.Vector3();
        return bb.getCenter(center);
    }
    getInnerWidth () {
        var box3 = new THREE.Box3();
        var size = new THREE.Vector3();
        box3.setFromObject( this.container );
        size = box3.getSize(size);
        return size.x;
    }
    getInnerDepth () {
      var box3 = new THREE.Box3();
      var size = new THREE.Vector3();
      box3.setFromObject( this.container );
      size = box3.getSize(size);
      return size.z;
    }
    getInnerHeight () {
        var box3 = new THREE.Box3();
        var size = new THREE.Vector3();
        box3.setFromObject( this.container );
        size = box3.getSize(size);
        return size.y;
    }
    getWidth () {
        var box3 = new THREE.Box3();
        var size = new THREE.Vector3();
        box3.setFromObject( this.mainobj );
        size = box3.getSize(size);
        return size.x ;
    }
    getDepth() {
      var box3 = new THREE.Box3();
      var size = new THREE.Vector3();
      box3.setFromObject( this.mainobj );
      size = box3.getSize(size);
      return size.z ;
    }
    getHeight () {
        var box3 = new THREE.Box3();
        var size = new THREE.Vector3();
        box3.setFromObject( this.mainobj );
        size = box3.getSize(size);
        return size.y;
    }
    getPosition() {
        return this.mainobj.position;
    }
    getInfra(){
        if (this.typeObj == 'infra')
            return this;
        else return this.parents[0].getInfra();
    }

    /**
     * destroy the object anbd remove from scene
     */
    remove() {
        this.scn.remove(this.mainobj);
        this.mainobj.dispose();
    }
    update(){
        this.status = obj.status || this.status;
        this.setColors();
        for (var n in this.mainobj.children){
            if(this.mainobj.children[n] instanceof THREE.Mesh){
                this.mainobj.children[n].material.color.setHex(colors[0]);
                this.mainobj.children[n].needsUpdate = true;
            }
        }
    }

    spotlight (){
        var mainMesh = this.getMainMesh();
        //console.log('3D >> '+this.typeObj+' >> spotlight ',mainMesh);
        this.stopAnimation();

    }
    stopAnimation () {
        for(var n in this.tweens){
            this.tweens[n].stop();
            TWEEN.remove(this.tweens[n]);
        }
        this.tweens = [];
    }
    /**
     * animate
     */
    animate() {
    }
    /**
     * createButton
     * @param titre
     * @returns {Block}
     */
    createButton(titre,clickcallback) {
        const buttonOptions = {
            width: 5,
            height: 1.5,
            justifyContent: 'center',
            offset: 0.5,
            margin: 0.2,
            borderRadius: 0.75
        };
        const hoveredStateAttributes = {
            state: 'hovered',
            attributes: {
                offset: 0.35,
                backgroundColor: new THREE.Color( 0xd6d6d6 ),
                backgroundOpacity: 0.8,
                fontColor: new THREE.Color( 0xffffff )
            },
        };

        const idleStateAttributes = {
            state: 'idle',
            attributes: {
                offset: 0.35,
                backgroundColor: new THREE.Color( 0xd6d6d6 ),
                backgroundOpacity: 0.3,
                fontColor: new THREE.Color( 0xffffff )
            },
        };
        const button = new ThreeMeshUI.Block( buttonOptions );

        // Add text to buttons
        button.add(
            new ThreeMeshUI.Text( { content: titre,
                fontSize: 0.55} )
        );

        const selectedAttributes = {
            offset: 0.2,
            backgroundColor: new THREE.Color( 0x777777 ),
            fontColor: new THREE.Color( 0x222222 )
        };
        button.setupState( {
            state: 'selected',
            attributes: selectedAttributes,
            onSet: clickcallback
        } );
        button.setupState( hoveredStateAttributes );
        button.setupState( idleStateAttributes );

        return button;
    }
    /***********************
     * UTILS
     */
    /**
     * destroy
     */
    destroy() {
        console.log('DISPOSE ',this);
        if (this.mainobj) {
            this.mainobj.removeFromParent();
            this.mainobj.remove();
        }
    }
    /**
     * hide
     */
    hide() {
        new TWEEN.Tween(this.mainobj.position)
            .to(
                {
                    y: 100
                },
                2000
            )
            .easing(TWEEN.Easing.Cubic.In)
            .start()
    }
    /**
     * hide
     */
    show() {
        new TWEEN.Tween(this.mainobj.position)
            .to(
                {
                    y: 0
                },
                2000
            )
            .easing(TWEEN.Easing.Cubic.Out)
            .start()
    }
    /**
     * highlight
     */
    hightlight() {
        if (this.squareobj)
            new TWEEN.Tween(this.squareobj.material)
                .to(
                    {
                        emissiveIntensity: 10,
                        shininess: 1000
                    },
                    2000
                )
                .easing(TWEEN.Easing.Cubic.Out)
                .start()
    }
    /**
     * enableDebug
     * Enable debug and display bouding box
     */
    enableDebug(norecursive) {
        console.log('3D >> '+this.typeObj+' >> enableDebug ',this);
        if (this.bbox)this.bbox.dispose();
        if (this.bbox2)this.bbox2.dispose();
        this.bbox = new THREE.BoxHelper( this.mainobj, 0xffff00 );
        this.scn.scene.add(  this.bbox );
        this.bbox2 = new THREE.BoxHelper( this.container, 0xff0000 );
        this.scn.scene.add(  this.bbox2 );
        const axesOuter = new THREE.AxesHelper( 5 );
        this.mainobj.add(axesOuter);
        const axesInner = new THREE.AxesHelper( 5 );
        this.container.add(axesInner);
        if (!norecursive)
            for (var i in this.children)
                this.children[i].enableDebug();
    }

    /**
     * createText
     */
    createText(x,y,z,message,obj,textsize=0.3,textcolor=0xf2f2f2,textrotate='top'){
        const loader = new FontLoader();
        return loader.load( 'fonts/helvetiker_regular.typeface.json', function ( font ) {
            const color = new THREE.Color(textcolor);
            const matDark = new THREE.MeshBasicMaterial({
                color: color,
                side: THREE.DoubleSide
            });
            const shapes = font.generateShapes(message, textsize);
            const geometry = new THREE.ShapeGeometry(shapes);
            switch (textrotate){
                case 'top':
                    geometry.rotateX(-Math.PI/2);
                    break;
                case 'left':
                    geometry.rotateX(Math.PI/2);
                    geometry.rotateZ(-Math.PI/2);
                    geometry.rotateX(-Math.PI/2);
                    break;
                case 'right':
                    geometry.rotateX(Math.PI/2);
                    geometry.rotateZ(Math.PI/2);
                    geometry.rotateX(-Math.PI/2);
                    break;
            }
            geometry.computeBoundingBox();
            const xMid = 0.5 * (geometry.boundingBox.max.x - geometry.boundingBox.min.x);
            // make shape ( N.B. edge view not visible )
            const text = new THREE.Mesh(geometry, matDark);
            obj.add(text);
            text.position.z = z;
            text.position.y = y;
            text.position.x = x;
            return text;
        });
    }
}
export{defaultitem};