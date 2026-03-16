import * as THREE from "three";

class positionnetworkdevice {
    constructor(base, list, marge, style = undefined, maxcol = 4, maxwidth = 5, maxdepth = 5) {
        this.base = base;
        this.list = list;
    }

    compute() {
        if (!this.list || this.list.length === 0) return;

        const siteBox = new THREE.Box3();
        for (const site of (this.base.sites || [])) {
            if (site.mainobj) siteBox.expandByObject(site.mainobj);
        }

        const MARGIN_LEFT = 3;
        const SPACING_Z = 3;

        let anchorX = 0;
        let anchorZ = 0;
        if (!siteBox.isEmpty()) {
            const siteMin = siteBox.min.clone();
            this.base.mainobj.worldToLocal(siteMin);
            anchorX = siteMin.x;
            anchorZ = siteMin.z;
        }

        let startZ = anchorZ;
        for (let s = 0; s < this.list.length; s++) {
            const fw = this.list[s];
            if (!fw.mainobj) continue;
            const fwWidth = fw.getWidth() || 10;
            const fwDepth = fw.getDepth() || 3;
            const x = anchorX - fwWidth - MARGIN_LEFT;
            fw.move({ x, z: startZ, y: fw.mainobj.position.y });
            startZ += fwDepth + SPACING_Z;
        }
    }
}
export { positionnetworkdevice }
