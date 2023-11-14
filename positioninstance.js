/**
 * Classe de positionnement des instances
 */
import * as THREE from 'three';
class positioninstance  {
    constructor(base,list) {
        this.consoleprefix = '3D >> '+base+' >> positioninstance >> ';
        this.base = base;
        this.list = list;
    }
    compute(){
        //console.log( this.consoleprefix+'compute');
        for (var s in this.list) {
            //on calcule la moyenne des positions des objets ips dans les objets interfaces
            console.log( this.consoleprefix+'--> instance ',this.list[s].mainobj.position);
            var pos = new THREE.Vector3( );
            var nbip = 0;
            for (var i in this.list[s].interfaces){
                for (var j in this.list[s].interfaces[i].ips){
                    let temppos =this.list[s].interfaces[i].ips[j].mainobj.localToWorld(this.list[s].interfaces[i].ips[j].getCenterPoint());
                    pos.add(temppos);
                    nbip++;
                    console.log( this.consoleprefix+'------> ip ',temppos,pos);
                }
            }
            if (nbip>1) {
                pos.divideScalar(nbip);
                pos.y+=this.list[s].squareoffset;
            }else{
                pos.z+=2;
                pos.x-=this.list[s].interfaces[i].getCenterPoint().x+0.1;
            }
            pos.y+=this.list[s].squareoffset;
            this.base.mainobj.worldToLocal(pos);
            let newpos = new THREE.Vector3(pos.x,this.list[s].mainobj.position.y,pos.z);
            console.log( this.consoleprefix+'----> move ',newpos);
            this.list[s].move(newpos);
        }
    }
}
export{positioninstance};