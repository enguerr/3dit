/***********************
 * connector
 *
 ************************/
import * as THREE from 'three';
class connector {

    constructor(from,to,style=undefined) {
        this.style = {
            color:  0x1155ff,
            decal:0,
            direction: 'front'
        };
        for (var i in this.style){
            this.style[i] = style[i];
        }
        this.from = from;
        this.to = to;
        this.parent = from.scn;
        this.typeObj = 'connector';
        //console.log('3D >> '+this.typeObj+' >> new >> from ',this.from,' to ',this.to);
        this.consoleprefix = '       +connector '+this.style.direction+' ';
        console.log(this.consoleprefix+' create element',this);
    }

    /**
     * destroy
     */
    destroy() {
        if (this.mainobj) {
            this.mainobj.removeFromParent();
            this.mainobj.remove();
        }
    }
    /**
     * configObject
     */
    configObject() {

    }
    /**
     * destroy the object anbd remove from scene
     */
    reset() {
       //console.log('3D >> '+this.typeObj+' >> remove ');
        this.mainobj.geometry.dispose();
        this.mainobj.material.dispose();
    }
    /**
     * createObject
     * Creatio nde l'objet 3d et affecttation des modeles et textures
     */
    createObject(){
        //console.log('3D >> '+this.typeObj+' >> compute ',this);
        //récupération des coordonnées et dimensions de la cible
        var posto = this.to.getWorldCenterPoint();
        var posfrom = this.from.getWorldCenterPoint();
        var width = this.to.getWidth();
        var depth = this.to.getDepth();
        // Create a sine-like wave
        switch (this.style.direction){
            case 'side':
                //recherche de la zone référente
                var largeur = this.parent.currentproject.getWidth();
                var curve = new THREE.CatmullRomCurve3( [
                    //start
                    new THREE.Vector3( posfrom.x, posfrom.y, posfrom.z ),
                    //devant de 0.5
                    new THREE.Vector3( posfrom.x, posfrom.y, posfrom.z+0.5+this.style.decal ),
                    //on descend
                    new THREE.Vector3( posfrom.x, posto.y+0.5+this.style.decal, posfrom.z+0.5+this.style.decal ),
                    //on decale sur le X zero
                    new THREE.Vector3( -(largeur/2)-this.style.decal, posto.y+0.5+this.style.decal, posfrom.z+0.5+this.style.decal ),
                    //on decale sur le côté
                    new THREE.Vector3( -(largeur/2)-this.style.decal, posto.y+0.5+this.style.decal, posto.z+this.style.decal ),
                    //on revient dans l'axe
                    new THREE.Vector3( posto.x, posto.y+0.5+this.style.decal, posto.z+this.style.decal ),
                    //on reemonte
                    new THREE.Vector3( posto.x, posto.y+0.5+this.style.decal, posto.z ),
                    //impact
                    new THREE.Vector3( posto.x, posto.y, posto.z ),
                ] ,false,'catmullrom',0.01);
                break;
            case 'back':
                var curve = new THREE.CatmullRomCurve3( [
                    //start
                    new THREE.Vector3( posfrom.x, posfrom.y, posfrom.z ),
                    //devant de 0.5
                    new THREE.Vector3( posfrom.x, posfrom.y, posfrom.z+0.5+this.style.decal ),
                    //on descend
                    new THREE.Vector3( posfrom.x, posto.y+0.5+this.style.decal, posfrom.z+0.5+this.style.decal ),
                    //on decale sur le côté
                    new THREE.Vector3( posto.x, posto.y+0.5+this.style.decal, posfrom.z+0.5+this.style.decal ),
                    //on va au dessus
                    new THREE.Vector3( posto.x, posto.y+0.5+this.style.decal, posto.z ),
                    //impact
                    new THREE.Vector3( posto.x, posto.y, posto.z ),
                ] ,false,'catmullrom',0.01);
                break;
            default:
            case 'direct':
                var curve = new THREE.CatmullRomCurve3( [
                    //start
                    new THREE.Vector3( posfrom.x, posfrom.y, posfrom.z ),
                    //devant de 0.5
                    new THREE.Vector3( posfrom.x, posfrom.y, posfrom.z-(0.5+this.style.decal) ),
                    //on va au dessus
                    new THREE.Vector3( posfrom.x, posto.y+0.5+this.style.decal, posfrom.z-(0.5+this.style.decal) ),
                    //on va au dessus
                    new THREE.Vector3( posto.x, posto.y+0.5+this.style.decal, posto.z ),
                    //impact
                    new THREE.Vector3( posto.x, posto.y, posto.z ),
                ] ,false,'catmullrom',0.01);
                break;
            case 'front':
                var curve = new THREE.CatmullRomCurve3( [
                    //start
                    new THREE.Vector3( posfrom.x, posfrom.y, posfrom.z ),
                    //devant de 0.5
                    new THREE.Vector3( posfrom.x, posfrom.y, posfrom.z-(0.5+this.style.decal) ),
                    //on descend
                    new THREE.Vector3( posfrom.x, posto.y+0.5+this.style.decal, posfrom.z-(0.5+this.style.decal) ),
                    //on decale sur le côté
                    new THREE.Vector3( posto.x, posto.y+0.5+this.style.decal, posfrom.z-(0.5+this.style.decal) ),
                    //on va au dessus
                    new THREE.Vector3( posto.x, posto.y+0.5+this.style.decal, posto.z ),
                    //impact
                    new THREE.Vector3( posto.x, posto.y, posto.z ),
                ] ,false,'catmullrom',0.01);
                break;
        }
        var params = {
            scale: 1,
            extrusionSegments: 100,
            radiusSegments: 100,
            closed: false,
            animationView: false,
            lookAhead: false,
            cameraHelper: false,
        };
        //var points = curve.getPoints( 50 );
        //var geometry = new THREE.BufferGeometry().setFromPoints( points );
        var geometry = new THREE.TubeGeometry( curve, params.extrusionSegments, 0.1, params.radiusSegments, params.closed );

        //var material = new THREE.LineBasicMaterial( { color : 0xff0000 } );
        //var material = new THREE.MeshBasicMaterial( { color: 0xff0000, opacity: 0.3, wireframe: false, transparent: false } );
        var material = new THREE.MeshPhongMaterial( {
            color: this.style.color,
            shininess: 70,
            reflectivity: 0.2,
            refractionRatio: 0.2,
            emissive: this.style.color,
            emissiveIntensity: 0.4,
            specular: 0xf4f4f4,
            opacity: 0.85,
            transparent: true
        });

        // Create the final object to add to the scene
        var splineObject = new THREE.Line( geometry, material );
        if (!this.mainobj)
            this.mainobj = splineObject;
        else this.mainobj.geometry = splineObject.geometry;
    }
    compute(){
        this.createObject();
    }
}

export {connector};