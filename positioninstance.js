import * as THREE from 'three';

class positioninstance {
    constructor(base, list) {
        this.base = base;
        this.list = list;
    }

    compute() {
        const INSTANCE_Y_OFFSET = 3;
        const INSTANCE_Z_OFFSET = -1.5;
        const MIN_SPACING = 3;
        const placed = [];

        for (var s in this.list) {
            const inst = this.list[s];
            if (!inst.interfaces || !inst.interfaces[0] || !inst.interfaces[0].ips || !inst.interfaces[0].ips[0]) continue;

            let ip = inst.interfaces[0].ips[0];
            let temppos = ip.mainobj.localToWorld(ip.getCenterPoint());
            this.base.mainobj.worldToLocal(temppos);

            let newpos = new THREE.Vector3(
                temppos.x,
                inst.mainobj.position.y + INSTANCE_Y_OFFSET,
                temppos.z + INSTANCE_Z_OFFSET
            );
            newpos.sub(inst.getCenterPoint());

            let shifted = true;
            while (shifted) {
                shifted = false;
                for (const prev of placed) {
                    if (Math.abs(newpos.x - prev.x) < MIN_SPACING && Math.abs(newpos.z - prev.z) < MIN_SPACING) {
                        newpos.z -= MIN_SPACING;
                        shifted = true;
                        break;
                    }
                }
            }

            placed.push(newpos.clone());
            inst.move(newpos);
        }
    }
}
export { positioninstance };
