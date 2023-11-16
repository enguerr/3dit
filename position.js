/**
 * Classe de positionnement des objets
 */
class position  {
    constructor(base,list,marge,style= undefined,maxcol=4,maxwidth=5,maxdepth = 5) {
        this.consoleprefix = "    -> position ";
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
        this.maxcol = this.style.maxcol?this.style.maxcol:maxcol;
        this.maxwidth = maxwidth;
        this.maxdepth = maxdepth;
        //console.log(this.consoleprefix+'new ');
    }
    compute(){
        var nb = this.list.length;
        //config
        var lartot = 0;
        var hauttot = 0;
        var depthtot = 0;
        var margewidth = this.style.widthmargin;
        var margeheight = this.style.heightmargin;
        var margedepth = this.style.depthmargin;
        var startx = 0;
        var starty = 0;
        var startz = 0;
        if (nb>1) {
            switch (this.style.childPosition){
                case 'vertical':
                    //calculs profondeur
                    for (var s in this.list) {
                        //profondeur
                        var depth = this.list[s].getDepth();
                        console.log(this.consoleprefix + 'move >> scene >> subnet '+s+' getWidth '+lar,this.list[s]);
                        if (depth > 0 && depth !== Infinity) {
                            depthtot += depth;
                        }
                    }
                    //marge
                    depthtot += (nb - 1) * margedepth;

                    //on positionnne les éléments vertcialement
                    for (var s in this.list) {
                        let curwidth = this.list[s].getWidth();
                        let mainlargeur = this.base.getInnerWidth();
                        lartot = (lartot>curwidth)?lartot:curwidth;
                        this.list[s].move({x: (mainlargeur-curwidth)/2, z: startz, y: this.list[s].y});
                        startz += this.list[s].getDepth() + margedepth;
                    }

                    //on applique la même largeur à tous les enfaats et on centre
                    for (var s in this.list) {
                        if (this.list[s].style.minWidth != lartot) {
                            this.list[s].style.minWidth = lartot;
                            //this.list[s].compute();
                        }
                    }
                    break;
                default:
                case 'horizontal':
                    //calculs largeurs
                    var nb = 0;
                    for (var s in this.list) {
                        //largeur
                        var lar = this.list[s].getWidth();
                        //console.log(this.consoleprefix + 'move >> scene >> subnet '+s+' getWidth '+lar+" type: horizontal posx: "+startx+" marge: "+marge+" largeur totale: "+lartot,this.list[s]);
                        if (lar > 0 && lar !== Infinity&&lartot<this.maxwidth&&nb<this.maxcol-1) {
                            lartot += lar;
                        }
                        nb++;
                    }
                    var maxnb = (this.maxcol-1>nb)?nb:this.maxcol;
                    //marge
                    lartot += (maxnb - 1) * margewidth;

                    //on positionnne les éléments
                    var it = 0;
                    for (var s in this.list) {
                        if (it > this.maxcol-1){
                            it = 0;
                            startx = 0;
                            startz += this.list[s].getDepth() + margedepth;
                        }
                        this.list[s].move({x: startx, z: startz, y: this.list[s].y});
                        startx += this.list[s].getWidth() + margewidth;
                        it++;
                    }
                    break;
                case 'fill':
                    //calculs hauteur
                    for (var s in this.list) {
                        //hauteur
                        var haut = this.list[s].getHeight();
                        //console.log(this.consoleprefix + 'move >> scene >> subnet '+s+' getWidth '+lar+" type: horizontal posx: "+startx+" marge: "+marge+" largeur totale: "+lartot,this.list[s]);
                        if (haut > 0 && haut !== Infinity) {
                            hauttot += haut;
                        }
                    }
                    //marge
                    hauttot += (nb - 1) * margeheight;

                    //on positionnne les éléments
                    for (var s in this.list) {
                        this.list[s].move({x: startx, z: startz, y: starty});
                        starty += this.list[s].getHeight() + margeheight;
                    }
                    break;
            }

        }else if (nb==1) {
            lartot += this.list[0].getWidth();
            //this.list[0].move({x: startx, z: posZ, y: posY});
        }
        //déplacement du container d'enfants
        /*if (this.base.container && this.base.container.position)
            this.base.position.x= -lartot/2;*/
    }
}
export{position}