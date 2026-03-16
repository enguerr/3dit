import { rack } from './rack.js';

class positionequipment {
    constructor(base, list) {
        this.base = base;
        this.list = list;
    }

    compute() {
        for (let i = 0; i < this.list.length; i++) {
            const equip = this.list[i];
            const startU = equip.startU || 1;
            equip.move({ y: (startU - 1) * rack.U_HEIGHT });
        }
    }
}

export { positionequipment };
