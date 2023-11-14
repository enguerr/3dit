import * as THREE from "three";

/**
 * Classe de positionnement des objets
 */
class positionnetworkdevice  {
    constructor(base,list,marge,style= undefined,maxcol=4,maxwidth=5,maxdepth = 5) {
        this.consoleprefix = "    -> positionnetworkdevice ";
        this.style={
            minWidth:5,
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
        };
        this.base = base;
        if (style) {
            //update style
            for (var i in style) {
                this.style[i] = style[i];
            }
        }
        this.list = list;
        this.marge = marge;
        this.maxcol = maxcol;
        this.maxwidth = maxwidth;
        this.maxdepth = maxdepth;
        //console.log(this.consoleprefix+'new ');
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
export{positionnetworkdevice}