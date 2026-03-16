import * as THREE from 'three';
import { defaultitem } from './defaultitem.js';

class dcrow extends defaultitem {
    constructor(scn, config, parent) {
        super(scn, config, parent);
        this.typeObj = 'row';
        this.squareoffset = 0;
        this.rackList = [];
    }

    createObject() {
        this.mainobj = new THREE.Group();
        this.mainobj.item = this;
        this.mainobj.add(this.container);
        this.configObject();
        this.scn.addObjInteract(this.mainobj);
    }

    add(mi) {
        mi.createObject();
        this.container.add(mi.mainobj);
        this.children.push(mi);
        if (mi.typeObj === 'rack') this.rackList.push(mi);
    }

    compute() {
        for (let i in this.children) this.children[i].compute();
    }
}

export { dcrow };
