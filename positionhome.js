/**
 * Classe de positionnement des objets
 */
class positionhome  {
    constructor(base,list,marge,style= undefined,maxcol=4,maxwidth=5,maxdepth = 5) {
        this.consoleprefix = "    -> positionHome ";
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
            //calculs profondeur
            var lartot = this.list[1].getWidth();
            lartot += (nb - 1) * margewidth;
            var depthtot = this.list[1].getInnerDepth();
            depthtot += (nb - 1) * margedepth;

            //on positionnne la sceene en profondeur
            this.list[1].move({x: -lartot/2, z: -depthtot, y: starty});
            console.log('homlePOsition >> profondeur '+this.list[1].getInnerDepth()+'  largeur '+this.list[1].getWidth(),{x: 0, z: -depthtot, y: starty});
            let curwidth = lartot;

            //on applique la même largeur à tous les enfaats
            this.list[1].style.minWidth = lartot;
        }else console.log('homlePOsition >> profondeur ');
    }
}
export{positionhome}