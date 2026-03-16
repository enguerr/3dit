import { rack } from './rack.js';

const RACK_SPACING = 0.08;
const AISLE_WIDTH = 1.2;
const MARGIN = 1.5;

class positionrow {
    constructor(base, list) {
        this.base = base;
        this.list = list;
    }

    compute() {
        let currentZ = MARGIN;

        for (let i = 0; i < this.list.length; i++) {
            const row = this.list[i];

            let currentX = MARGIN;
            const rowIndex = row.config && row.config.rowIndex != null ? row.config.rowIndex : i;
            const flipped = rowIndex % 2 === 1;

            if (row.rackList) {
                for (let r = 0; r < row.rackList.length; r++) {
                    const rk = row.rackList[r];
                    if (!rk.mainobj) continue;
                    rk.move({ x: currentX, z: currentZ, y: 0 });
                    if (flipped) {
                        rk.mainobj.rotation.y = Math.PI;
                        rk.mainobj.position.x += rack.RACK_WIDTH;
                        rk.mainobj.position.z += rack.RACK_DEPTH;
                    }
                    currentX += rack.RACK_WIDTH + RACK_SPACING;
                }
            }

            currentZ += rack.RACK_DEPTH + AISLE_WIDTH;
        }
    }
}

export { positionrow };
