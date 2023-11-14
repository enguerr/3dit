/*import {
	FileLoader,
	Loader,
	ShapePath
} from 'three';*/
const loading = {};
class Curve {
	constructor() {
		this.type = 'Curve';
		this.arcLengthDivisions = 200;
	} // Virtual base class method to overwrite and implement in subclasses
	//	- t [0 .. 1]


	getPoint() {
		console.warn('THREE.Curve: .getPoint() not implemented.');
		return null;
	} // Get point at relative position in curve according to arc length
	// - u [0 .. 1]


	getPointAt(u, optionalTarget) {
		const t = this.getUtoTmapping(u);
		return this.getPoint(t, optionalTarget);
	} // Get sequence of points using getPoint( t )


	getPoints(divisions = 5) {
		const points = [];

		for (let d = 0; d <= divisions; d++) {
			points.push(this.getPoint(d / divisions));
		}

		return points;
	} // Get sequence of points using getPointAt( u )


	getSpacedPoints(divisions = 5) {
		const points = [];

		for (let d = 0; d <= divisions; d++) {
			points.push(this.getPointAt(d / divisions));
		}

		return points;
	} // Get total curve arc length


	getLength() {
		const lengths = this.getLengths();
		return lengths[lengths.length - 1];
	} // Get list of cumulative segment lengths


	getLengths(divisions = this.arcLengthDivisions) {
		if (this.cacheArcLengths && this.cacheArcLengths.length === divisions + 1 && !this.needsUpdate) {
			return this.cacheArcLengths;
		}

		this.needsUpdate = false;
		const cache = [];
		let current,
			last = this.getPoint(0);
		let sum = 0;
		cache.push(0);

		for (let p = 1; p <= divisions; p++) {
			current = this.getPoint(p / divisions);
			sum += current.distanceTo(last);
			cache.push(sum);
			last = current;
		}

		this.cacheArcLengths = cache;
		return cache; // { sums: cache, sum: sum }; Sum is in the last element.
	}

	updateArcLengths() {
		this.needsUpdate = true;
		this.getLengths();
	} // Given u ( 0 .. 1 ), get a t to find p. This gives you points which are equidistant


	getUtoTmapping(u, distance) {
		const arcLengths = this.getLengths();
		let i = 0;
		const il = arcLengths.length;
		let targetArcLength; // The targeted u distance value to get

		if (distance) {
			targetArcLength = distance;
		} else {
			targetArcLength = u * arcLengths[il - 1];
		} // binary search for the index with largest value smaller than target u distance


		let low = 0,
			high = il - 1,
			comparison;

		while (low <= high) {
			i = Math.floor(low + (high - low) / 2); // less likely to overflow, though probably not issue here, JS doesn't really have integers, all numbers are floats

			comparison = arcLengths[i] - targetArcLength;

			if (comparison < 0) {
				low = i + 1;
			} else if (comparison > 0) {
				high = i - 1;
			} else {
				high = i;
				break; // DONE
			}
		}

		i = high;

		if (arcLengths[i] === targetArcLength) {
			return i / (il - 1);
		} // we could get finer grain at lengths, or use simple interpolation between two points


		const lengthBefore = arcLengths[i];
		const lengthAfter = arcLengths[i + 1];
		const segmentLength = lengthAfter - lengthBefore; // determine where we are between the 'before' and 'after' points

		const segmentFraction = (targetArcLength - lengthBefore) / segmentLength; // add that fractional amount to t

		const t = (i + segmentFraction) / (il - 1);
		return t;
	} // Returns a unit vector tangent at t
	// In case any sub curve does not implement its tangent derivation,
	// 2 points a small delta apart will be used to find its gradient
	// which seems to give a reasonable approximation


	getTangent(t, optionalTarget) {
		const delta = 0.0001;
		let t1 = t - delta;
		let t2 = t + delta; // Capping in case of danger

		if (t1 < 0) t1 = 0;
		if (t2 > 1) t2 = 1;
		const pt1 = this.getPoint(t1);
		const pt2 = this.getPoint(t2);
		const tangent = optionalTarget || (pt1.isVector2 ? new Vector2() : new Vector3());
		tangent.copy(pt2).sub(pt1).normalize();
		return tangent;
	}

	getTangentAt(u, optionalTarget) {
		const t = this.getUtoTmapping(u);
		return this.getTangent(t, optionalTarget);
	}

	computeFrenetFrames(segments, closed) {
		// see http://www.cs.indiana.edu/pub/techreports/TR425.pdf
		const normal = new Vector3();
		const tangents = [];
		const normals = [];
		const binormals = [];
		const vec = new Vector3();
		const mat = new Matrix4(); // compute the tangent vectors for each segment on the curve

		for (let i = 0; i <= segments; i++) {
			const u = i / segments;
			tangents[i] = this.getTangentAt(u, new Vector3());
		} // select an initial normal vector perpendicular to the first tangent vector,
		// and in the direction of the minimum tangent xyz component


		normals[0] = new Vector3();
		binormals[0] = new Vector3();
		let min = Number.MAX_VALUE;
		const tx = Math.abs(tangents[0].x);
		const ty = Math.abs(tangents[0].y);
		const tz = Math.abs(tangents[0].z);

		if (tx <= min) {
			min = tx;
			normal.set(1, 0, 0);
		}

		if (ty <= min) {
			min = ty;
			normal.set(0, 1, 0);
		}

		if (tz <= min) {
			normal.set(0, 0, 1);
		}

		vec.crossVectors(tangents[0], normal).normalize();
		normals[0].crossVectors(tangents[0], vec);
		binormals[0].crossVectors(tangents[0], normals[0]); // compute the slowly-varying normal and binormal vectors for each segment on the curve

		for (let i = 1; i <= segments; i++) {
			normals[i] = normals[i - 1].clone();
			binormals[i] = binormals[i - 1].clone();
			vec.crossVectors(tangents[i - 1], tangents[i]);

			if (vec.length() > Number.EPSILON) {
				vec.normalize();
				const theta = Math.acos(clamp(tangents[i - 1].dot(tangents[i]), -1, 1)); // clamp for floating pt errors

				normals[i].applyMatrix4(mat.makeRotationAxis(vec, theta));
			}

			binormals[i].crossVectors(tangents[i], normals[i]);
		} // if the curve is closed, postprocess the vectors so the first and last normal vectors are the same


		if (closed === true) {
			let theta = Math.acos(clamp(normals[0].dot(normals[segments]), -1, 1));
			theta /= segments;

			if (tangents[0].dot(vec.crossVectors(normals[0], normals[segments])) > 0) {
				theta = -theta;
			}

			for (let i = 1; i <= segments; i++) {
				// twist a little...
				normals[i].applyMatrix4(mat.makeRotationAxis(tangents[i], theta * i));
				binormals[i].crossVectors(tangents[i], normals[i]);
			}
		}

		return {
			tangents: tangents,
			normals: normals,
			binormals: binormals
		};
	}

	clone() {
		return new this.constructor().copy(this);
	}

	copy(source) {
		this.arcLengthDivisions = source.arcLengthDivisions;
		return this;
	}

	toJSON() {
		const data = {
			metadata: {
				version: 4.5,
				type: 'Curve',
				generator: 'Curve.toJSON'
			}
		};
		data.arcLengthDivisions = this.arcLengthDivisions;
		data.type = this.type;
		return data;
	}

	fromJSON(json) {
		this.arcLengthDivisions = json.arcLengthDivisions;
		return this;
	}

}
class LineCurve extends Curve {
	constructor(v1 = new Vector2(), v2 = new Vector2()) {
		super();
		this.isLineCurve = true;
		this.type = 'LineCurve';
		this.v1 = v1;
		this.v2 = v2;
	}

	getPoint(t, optionalTarget = new Vector2()) {
		const point = optionalTarget;

		if (t === 1) {
			point.copy(this.v2);
		} else {
			point.copy(this.v2).sub(this.v1);
			point.multiplyScalar(t).add(this.v1);
		}

		return point;
	} // Line curve is linear, so we can overwrite default getPointAt


	getPointAt(u, optionalTarget) {
		return this.getPoint(u, optionalTarget);
	}

	getTangent(t, optionalTarget) {
		const tangent = optionalTarget || new Vector2();
		tangent.copy(this.v2).sub(this.v1).normalize();
		return tangent;
	}

	copy(source) {
		super.copy(source);
		this.v1.copy(source.v1);
		this.v2.copy(source.v2);
		return this;
	}

	toJSON() {
		const data = super.toJSON();
		data.v1 = this.v1.toArray();
		data.v2 = this.v2.toArray();
		return data;
	}

	fromJSON(json) {
		super.fromJSON(json);
		this.v1.fromArray(json.v1);
		this.v2.fromArray(json.v2);
		return this;
	}

}
class Vector2 {
	constructor(x = 0, y = 0) {
		Vector2.prototype.isVector2 = true;
		this.x = x;
		this.y = y;
	}

	get width() {
		return this.x;
	}

	set width(value) {
		this.x = value;
	}

	get height() {
		return this.y;
	}

	set height(value) {
		this.y = value;
	}

	set(x, y) {
		this.x = x;
		this.y = y;
		return this;
	}

	setScalar(scalar) {
		this.x = scalar;
		this.y = scalar;
		return this;
	}

	setX(x) {
		this.x = x;
		return this;
	}

	setY(y) {
		this.y = y;
		return this;
	}

	setComponent(index, value) {
		switch (index) {
			case 0:
				this.x = value;
				break;

			case 1:
				this.y = value;
				break;

			default:
				throw new Error('index is out of range: ' + index);
		}

		return this;
	}

	getComponent(index) {
		switch (index) {
			case 0:
				return this.x;

			case 1:
				return this.y;

			default:
				throw new Error('index is out of range: ' + index);
		}
	}

	clone() {
		return new this.constructor(this.x, this.y);
	}

	copy(v) {
		this.x = v.x;
		this.y = v.y;
		return this;
	}

	add(v, w) {
		if (w !== undefined) {
			console.warn('THREE.Vector2: .add() now only accepts one argument. Use .addVectors( a, b ) instead.');
			return this.addVectors(v, w);
		}

		this.x += v.x;
		this.y += v.y;
		return this;
	}

	addScalar(s) {
		this.x += s;
		this.y += s;
		return this;
	}

	addVectors(a, b) {
		this.x = a.x + b.x;
		this.y = a.y + b.y;
		return this;
	}

	addScaledVector(v, s) {
		this.x += v.x * s;
		this.y += v.y * s;
		return this;
	}

	sub(v, w) {
		if (w !== undefined) {
			console.warn('THREE.Vector2: .sub() now only accepts one argument. Use .subVectors( a, b ) instead.');
			return this.subVectors(v, w);
		}

		this.x -= v.x;
		this.y -= v.y;
		return this;
	}

	subScalar(s) {
		this.x -= s;
		this.y -= s;
		return this;
	}

	subVectors(a, b) {
		this.x = a.x - b.x;
		this.y = a.y - b.y;
		return this;
	}

	multiply(v) {
		this.x *= v.x;
		this.y *= v.y;
		return this;
	}

	multiplyScalar(scalar) {
		this.x *= scalar;
		this.y *= scalar;
		return this;
	}

	divide(v) {
		this.x /= v.x;
		this.y /= v.y;
		return this;
	}

	divideScalar(scalar) {
		return this.multiplyScalar(1 / scalar);
	}

	applyMatrix3(m) {
		const x = this.x,
			y = this.y;
		const e = m.elements;
		this.x = e[0] * x + e[3] * y + e[6];
		this.y = e[1] * x + e[4] * y + e[7];
		return this;
	}

	min(v) {
		this.x = Math.min(this.x, v.x);
		this.y = Math.min(this.y, v.y);
		return this;
	}

	max(v) {
		this.x = Math.max(this.x, v.x);
		this.y = Math.max(this.y, v.y);
		return this;
	}

	clamp(min, max) {
		// assumes min < max, componentwise
		this.x = Math.max(min.x, Math.min(max.x, this.x));
		this.y = Math.max(min.y, Math.min(max.y, this.y));
		return this;
	}

	clampScalar(minVal, maxVal) {
		this.x = Math.max(minVal, Math.min(maxVal, this.x));
		this.y = Math.max(minVal, Math.min(maxVal, this.y));
		return this;
	}

	clampLength(min, max) {
		const length = this.length();
		return this.divideScalar(length || 1).multiplyScalar(Math.max(min, Math.min(max, length)));
	}

	floor() {
		this.x = Math.floor(this.x);
		this.y = Math.floor(this.y);
		return this;
	}

	ceil() {
		this.x = Math.ceil(this.x);
		this.y = Math.ceil(this.y);
		return this;
	}

	round() {
		this.x = Math.round(this.x);
		this.y = Math.round(this.y);
		return this;
	}

	roundToZero() {
		this.x = this.x < 0 ? Math.ceil(this.x) : Math.floor(this.x);
		this.y = this.y < 0 ? Math.ceil(this.y) : Math.floor(this.y);
		return this;
	}

	negate() {
		this.x = -this.x;
		this.y = -this.y;
		return this;
	}

	dot(v) {
		return this.x * v.x + this.y * v.y;
	}

	cross(v) {
		return this.x * v.y - this.y * v.x;
	}

	lengthSq() {
		return this.x * this.x + this.y * this.y;
	}

	length() {
		return Math.sqrt(this.x * this.x + this.y * this.y);
	}

	manhattanLength() {
		return Math.abs(this.x) + Math.abs(this.y);
	}

	normalize() {
		return this.divideScalar(this.length() || 1);
	}

	angle() {
		// computes the angle in radians with respect to the positive x-axis
		const angle = Math.atan2(-this.y, -this.x) + Math.PI;
		return angle;
	}

	distanceTo(v) {
		return Math.sqrt(this.distanceToSquared(v));
	}

	distanceToSquared(v) {
		const dx = this.x - v.x,
			dy = this.y - v.y;
		return dx * dx + dy * dy;
	}

	manhattanDistanceTo(v) {
		return Math.abs(this.x - v.x) + Math.abs(this.y - v.y);
	}

	setLength(length) {
		return this.normalize().multiplyScalar(length);
	}

	lerp(v, alpha) {
		this.x += (v.x - this.x) * alpha;
		this.y += (v.y - this.y) * alpha;
		return this;
	}

	lerpVectors(v1, v2, alpha) {
		this.x = v1.x + (v2.x - v1.x) * alpha;
		this.y = v1.y + (v2.y - v1.y) * alpha;
		return this;
	}

	equals(v) {
		return v.x === this.x && v.y === this.y;
	}

	fromArray(array, offset = 0) {
		this.x = array[offset];
		this.y = array[offset + 1];
		return this;
	}

	toArray(array = [], offset = 0) {
		array[offset] = this.x;
		array[offset + 1] = this.y;
		return array;
	}

	fromBufferAttribute(attribute, index, offset) {
		if (offset !== undefined) {
			console.warn('THREE.Vector2: offset has been removed from .fromBufferAttribute().');
		}

		this.x = attribute.getX(index);
		this.y = attribute.getY(index);
		return this;
	}

	rotateAround(center, angle) {
		const c = Math.cos(angle),
			s = Math.sin(angle);
		const x = this.x - center.x;
		const y = this.y - center.y;
		this.x = x * c - y * s + center.x;
		this.y = x * s + y * c + center.y;
		return this;
	}

	random() {
		this.x = Math.random();
		this.y = Math.random();
		return this;
	}

	*[Symbol.iterator]() {
		yield this.x;
		yield this.y;
	}

}


class CurvePath extends Curve {
	constructor() {
		super();
		this.type = 'CurvePath';
		this.curves = [];
		this.autoClose = false; // Automatically closes the path
	}

	add(curve) {
		this.curves.push(curve);
	}

	closePath() {
		// Add a line curve if start and end of lines are not connected
		const startPoint = this.curves[0].getPoint(0);
		const endPoint = this.curves[this.curves.length - 1].getPoint(1);

		if (!startPoint.equals(endPoint)) {
			this.curves.push(new LineCurve(endPoint, startPoint));
		}
	} // To get accurate point with reference to
	// entire path distance at time t,
	// following has to be done:
	// 1. Length of each sub path have to be known
	// 2. Locate and identify type of curve
	// 3. Get t for the curve
	// 4. Return curve.getPointAt(t')


	getPoint(t, optionalTarget) {
		const d = t * this.getLength();
		const curveLengths = this.getCurveLengths();
		let i = 0; // To think about boundaries points.

		while (i < curveLengths.length) {
			if (curveLengths[i] >= d) {
				const diff = curveLengths[i] - d;
				const curve = this.curves[i];
				const segmentLength = curve.getLength();
				const u = segmentLength === 0 ? 0 : 1 - diff / segmentLength;
				return curve.getPointAt(u, optionalTarget);
			}

			i++;
		}

		return null; // loop where sum != 0, sum > d , sum+1 <d
	} // We cannot use the default THREE.Curve getPoint() with getLength() because in
	// THREE.Curve, getLength() depends on getPoint() but in THREE.CurvePath
	// getPoint() depends on getLength


	getLength() {
		const lens = this.getCurveLengths();
		return lens[lens.length - 1];
	} // cacheLengths must be recalculated.


	updateArcLengths() {
		this.needsUpdate = true;
		this.cacheLengths = null;
		this.getCurveLengths();
	} // Compute lengths and cache them
	// We cannot overwrite getLengths() because UtoT mapping uses it.


	getCurveLengths() {
		// We use cache values if curves and cache array are same length
		if (this.cacheLengths && this.cacheLengths.length === this.curves.length) {
			return this.cacheLengths;
		} // Get length of sub-curve
		// Push sums into cached array


		const lengths = [];
		let sums = 0;

		for (let i = 0, l = this.curves.length; i < l; i++) {
			sums += this.curves[i].getLength();
			lengths.push(sums);
		}

		this.cacheLengths = lengths;
		return lengths;
	}

	getSpacedPoints(divisions = 40) {
		const points = [];

		for (let i = 0; i <= divisions; i++) {
			points.push(this.getPoint(i / divisions));
		}

		if (this.autoClose) {
			points.push(points[0]);
		}

		return points;
	}

	getPoints(divisions = 12) {
		const points = [];
		let last;

		for (let i = 0, curves = this.curves; i < curves.length; i++) {
			const curve = curves[i];
			const resolution = curve.isEllipseCurve ? divisions * 2 : curve.isLineCurve || curve.isLineCurve3 ? 1 : curve.isSplineCurve ? divisions * curve.points.length : divisions;
			const pts = curve.getPoints(resolution);

			for (let j = 0; j < pts.length; j++) {
				const point = pts[j];
				if (last && last.equals(point)) continue; // ensures no consecutive points are duplicates

				points.push(point);
				last = point;
			}
		}

		if (this.autoClose && points.length > 1 && !points[points.length - 1].equals(points[0])) {
			points.push(points[0]);
		}

		return points;
	}

	copy(source) {
		super.copy(source);
		this.curves = [];

		for (let i = 0, l = source.curves.length; i < l; i++) {
			const curve = source.curves[i];
			this.curves.push(curve.clone());
		}

		this.autoClose = source.autoClose;
		return this;
	}

	toJSON() {
		const data = super.toJSON();
		data.autoClose = this.autoClose;
		data.curves = [];

		for (let i = 0, l = this.curves.length; i < l; i++) {
			const curve = this.curves[i];
			data.curves.push(curve.toJSON());
		}

		return data;
	}

	fromJSON(json) {
		super.fromJSON(json);
		this.autoClose = json.autoClose;
		this.curves = [];

		for (let i = 0, l = json.curves.length; i < l; i++) {
			const curve = json.curves[i];
			this.curves.push(new Curves[curve.type]().fromJSON(curve));
		}

		return this;
	}

}

class Path extends CurvePath {
	constructor(points) {
		super();
		this.type = 'Path';
		this.currentPoint = new Vector2();

		if (points) {
			this.setFromPoints(points);
		}
	}

	setFromPoints(points) {
		this.moveTo(points[0].x, points[0].y);

		for (let i = 1, l = points.length; i < l; i++) {
			this.lineTo(points[i].x, points[i].y);
		}

		return this;
	}

	moveTo(x, y) {
		this.currentPoint.set(x, y); // TODO consider referencing vectors instead of copying?

		return this;
	}

	lineTo(x, y) {
		const curve = new LineCurve(this.currentPoint.clone(), new Vector2(x, y));
		this.curves.push(curve);
		this.currentPoint.set(x, y);
		return this;
	}

	quadraticCurveTo(aCPx, aCPy, aX, aY) {
		const curve = new QuadraticBezierCurve(this.currentPoint.clone(), new Vector2(aCPx, aCPy), new Vector2(aX, aY));
		this.curves.push(curve);
		this.currentPoint.set(aX, aY);
		return this;
	}

	bezierCurveTo(aCP1x, aCP1y, aCP2x, aCP2y, aX, aY) {
		const curve = new CubicBezierCurve(this.currentPoint.clone(), new Vector2(aCP1x, aCP1y), new Vector2(aCP2x, aCP2y), new Vector2(aX, aY));
		this.curves.push(curve);
		this.currentPoint.set(aX, aY);
		return this;
	}

	splineThru(pts
						 /*Array of Vector*/
	) {
		const npts = [this.currentPoint.clone()].concat(pts);
		const curve = new SplineCurve(npts);
		this.curves.push(curve);
		this.currentPoint.copy(pts[pts.length - 1]);
		return this;
	}

	arc(aX, aY, aRadius, aStartAngle, aEndAngle, aClockwise) {
		const x0 = this.currentPoint.x;
		const y0 = this.currentPoint.y;
		this.absarc(aX + x0, aY + y0, aRadius, aStartAngle, aEndAngle, aClockwise);
		return this;
	}

	absarc(aX, aY, aRadius, aStartAngle, aEndAngle, aClockwise) {
		this.absellipse(aX, aY, aRadius, aRadius, aStartAngle, aEndAngle, aClockwise);
		return this;
	}

	ellipse(aX, aY, xRadius, yRadius, aStartAngle, aEndAngle, aClockwise, aRotation) {
		const x0 = this.currentPoint.x;
		const y0 = this.currentPoint.y;
		this.absellipse(aX + x0, aY + y0, xRadius, yRadius, aStartAngle, aEndAngle, aClockwise, aRotation);
		return this;
	}

	absellipse(aX, aY, xRadius, yRadius, aStartAngle, aEndAngle, aClockwise, aRotation) {
		const curve = new EllipseCurve(aX, aY, xRadius, yRadius, aStartAngle, aEndAngle, aClockwise, aRotation);

		if (this.curves.length > 0) {
			// if a previous curve is present, attempt to join
			const firstPoint = curve.getPoint(0);

			if (!firstPoint.equals(this.currentPoint)) {
				this.lineTo(firstPoint.x, firstPoint.y);
			}
		}

		this.curves.push(curve);
		const lastPoint = curve.getPoint(1);
		this.currentPoint.copy(lastPoint);
		return this;
	}

	copy(source) {
		super.copy(source);
		this.currentPoint.copy(source.currentPoint);
		return this;
	}

	toJSON() {
		const data = super.toJSON();
		data.currentPoint = this.currentPoint.toArray();
		return data;
	}

	fromJSON(json) {
		super.fromJSON(json);
		this.currentPoint.fromArray(json.currentPoint);
		return this;
	}

}
class Color {
	constructor(r, g, b) {
		this.isColor = true;
		this.r = 1;
		this.g = 1;
		this.b = 1;

		if (g === undefined && b === undefined) {
			// r is THREE.Color, hex or string
			return this.set(r);
		}

		return this.setRGB(r, g, b);
	}

	set(value) {
		if (value && value.isColor) {
			this.copy(value);
		} else if (typeof value === 'number') {
			this.setHex(value);
		} else if (typeof value === 'string') {
			this.setStyle(value);
		}

		return this;
	}

	setScalar(scalar) {
		this.r = scalar;
		this.g = scalar;
		this.b = scalar;
		return this;
	}

	setHex(hex, colorSpace = SRGBColorSpace) {
		hex = Math.floor(hex);
		this.r = (hex >> 16 & 255) / 255;
		this.g = (hex >> 8 & 255) / 255;
		this.b = (hex & 255) / 255;
		ColorManagement.toWorkingColorSpace(this, colorSpace);
		return this;
	}

	setRGB(r, g, b, colorSpace = LinearSRGBColorSpace) {
		this.r = r;
		this.g = g;
		this.b = b;
		ColorManagement.toWorkingColorSpace(this, colorSpace);
		return this;
	}

	setHSL(h, s, l, colorSpace = LinearSRGBColorSpace) {
		// h,s,l ranges are in 0.0 - 1.0
		h = euclideanModulo(h, 1);
		s = clamp(s, 0, 1);
		l = clamp(l, 0, 1);

		if (s === 0) {
			this.r = this.g = this.b = l;
		} else {
			const p = l <= 0.5 ? l * (1 + s) : l + s - l * s;
			const q = 2 * l - p;
			this.r = hue2rgb(q, p, h + 1 / 3);
			this.g = hue2rgb(q, p, h);
			this.b = hue2rgb(q, p, h - 1 / 3);
		}

		ColorManagement.toWorkingColorSpace(this, colorSpace);
		return this;
	}

	setStyle(style, colorSpace = SRGBColorSpace) {
		function handleAlpha(string) {
			if (string === undefined) return;

			if (parseFloat(string) < 1) {
				console.warn('THREE.Color: Alpha component of ' + style + ' will be ignored.');
			}
		}

		let m;

		if (m = /^((?:rgb|hsl)a?)\(([^\)]*)\)/.exec(style)) {
			// rgb / hsl
			let color;
			const name = m[1];
			const components = m[2];

			switch (name) {
				case 'rgb':
				case 'rgba':
					if (color = /^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(components)) {
						// rgb(255,0,0) rgba(255,0,0,0.5)
						this.r = Math.min(255, parseInt(color[1], 10)) / 255;
						this.g = Math.min(255, parseInt(color[2], 10)) / 255;
						this.b = Math.min(255, parseInt(color[3], 10)) / 255;
						ColorManagement.toWorkingColorSpace(this, colorSpace);
						handleAlpha(color[4]);
						return this;
					}

					if (color = /^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(components)) {
						// rgb(100%,0%,0%) rgba(100%,0%,0%,0.5)
						this.r = Math.min(100, parseInt(color[1], 10)) / 100;
						this.g = Math.min(100, parseInt(color[2], 10)) / 100;
						this.b = Math.min(100, parseInt(color[3], 10)) / 100;
						ColorManagement.toWorkingColorSpace(this, colorSpace);
						handleAlpha(color[4]);
						return this;
					}

					break;

				case 'hsl':
				case 'hsla':
					if (color = /^\s*(\d*\.?\d+)\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(components)) {
						// hsl(120,50%,50%) hsla(120,50%,50%,0.5)
						const h = parseFloat(color[1]) / 360;
						const s = parseInt(color[2], 10) / 100;
						const l = parseInt(color[3], 10) / 100;
						handleAlpha(color[4]);
						return this.setHSL(h, s, l, colorSpace);
					}

					break;
			}
		} else if (m = /^\#([A-Fa-f\d]+)$/.exec(style)) {
			// hex color
			const hex = m[1];
			const size = hex.length;

			if (size === 3) {
				// #ff0
				this.r = parseInt(hex.charAt(0) + hex.charAt(0), 16) / 255;
				this.g = parseInt(hex.charAt(1) + hex.charAt(1), 16) / 255;
				this.b = parseInt(hex.charAt(2) + hex.charAt(2), 16) / 255;
				ColorManagement.toWorkingColorSpace(this, colorSpace);
				return this;
			} else if (size === 6) {
				// #ff0000
				this.r = parseInt(hex.charAt(0) + hex.charAt(1), 16) / 255;
				this.g = parseInt(hex.charAt(2) + hex.charAt(3), 16) / 255;
				this.b = parseInt(hex.charAt(4) + hex.charAt(5), 16) / 255;
				ColorManagement.toWorkingColorSpace(this, colorSpace);
				return this;
			}
		}

		if (style && style.length > 0) {
			return this.setColorName(style, colorSpace);
		}

		return this;
	}

	setColorName(style, colorSpace = SRGBColorSpace) {
		// color keywords
		const hex = _colorKeywords[style.toLowerCase()];

		if (hex !== undefined) {
			// red
			this.setHex(hex, colorSpace);
		} else {
			// unknown color
			console.warn('THREE.Color: Unknown color ' + style);
		}

		return this;
	}

	clone() {
		return new this.constructor(this.r, this.g, this.b);
	}

	copy(color) {
		this.r = color.r;
		this.g = color.g;
		this.b = color.b;
		return this;
	}

	copySRGBToLinear(color) {
		this.r = SRGBToLinear(color.r);
		this.g = SRGBToLinear(color.g);
		this.b = SRGBToLinear(color.b);
		return this;
	}

	copyLinearToSRGB(color) {
		this.r = LinearToSRGB(color.r);
		this.g = LinearToSRGB(color.g);
		this.b = LinearToSRGB(color.b);
		return this;
	}

	convertSRGBToLinear() {
		this.copySRGBToLinear(this);
		return this;
	}

	convertLinearToSRGB() {
		this.copyLinearToSRGB(this);
		return this;
	}

	getHex(colorSpace = SRGBColorSpace) {
		ColorManagement.fromWorkingColorSpace(toComponents(this, _rgb), colorSpace);
		return clamp(_rgb.r * 255, 0, 255) << 16 ^ clamp(_rgb.g * 255, 0, 255) << 8 ^ clamp(_rgb.b * 255, 0, 255) << 0;
	}

	getHexString(colorSpace = SRGBColorSpace) {
		return ('000000' + this.getHex(colorSpace).toString(16)).slice(-6);
	}

	getHSL(target, colorSpace = LinearSRGBColorSpace) {
		// h,s,l ranges are in 0.0 - 1.0
		ColorManagement.fromWorkingColorSpace(toComponents(this, _rgb), colorSpace);
		const r = _rgb.r,
			g = _rgb.g,
			b = _rgb.b;
		const max = Math.max(r, g, b);
		const min = Math.min(r, g, b);
		let hue, saturation;
		const lightness = (min + max) / 2.0;

		if (min === max) {
			hue = 0;
			saturation = 0;
		} else {
			const delta = max - min;
			saturation = lightness <= 0.5 ? delta / (max + min) : delta / (2 - max - min);

			switch (max) {
				case r:
					hue = (g - b) / delta + (g < b ? 6 : 0);
					break;

				case g:
					hue = (b - r) / delta + 2;
					break;

				case b:
					hue = (r - g) / delta + 4;
					break;
			}

			hue /= 6;
		}

		target.h = hue;
		target.s = saturation;
		target.l = lightness;
		return target;
	}

	getRGB(target, colorSpace = LinearSRGBColorSpace) {
		ColorManagement.fromWorkingColorSpace(toComponents(this, _rgb), colorSpace);
		target.r = _rgb.r;
		target.g = _rgb.g;
		target.b = _rgb.b;
		return target;
	}

	getStyle(colorSpace = SRGBColorSpace) {
		ColorManagement.fromWorkingColorSpace(toComponents(this, _rgb), colorSpace);

		if (colorSpace !== SRGBColorSpace) {
			// Requires CSS Color Module Level 4 (https://www.w3.org/TR/css-color-4/).
			return `color(${colorSpace} ${_rgb.r} ${_rgb.g} ${_rgb.b})`;
		}

		return `rgb(${_rgb.r * 255 | 0},${_rgb.g * 255 | 0},${_rgb.b * 255 | 0})`;
	}

	offsetHSL(h, s, l) {
		this.getHSL(_hslA);
		_hslA.h += h;
		_hslA.s += s;
		_hslA.l += l;
		this.setHSL(_hslA.h, _hslA.s, _hslA.l);
		return this;
	}

	add(color) {
		this.r += color.r;
		this.g += color.g;
		this.b += color.b;
		return this;
	}

	addColors(color1, color2) {
		this.r = color1.r + color2.r;
		this.g = color1.g + color2.g;
		this.b = color1.b + color2.b;
		return this;
	}

	addScalar(s) {
		this.r += s;
		this.g += s;
		this.b += s;
		return this;
	}

	sub(color) {
		this.r = Math.max(0, this.r - color.r);
		this.g = Math.max(0, this.g - color.g);
		this.b = Math.max(0, this.b - color.b);
		return this;
	}

	multiply(color) {
		this.r *= color.r;
		this.g *= color.g;
		this.b *= color.b;
		return this;
	}

	multiplyScalar(s) {
		this.r *= s;
		this.g *= s;
		this.b *= s;
		return this;
	}

	lerp(color, alpha) {
		this.r += (color.r - this.r) * alpha;
		this.g += (color.g - this.g) * alpha;
		this.b += (color.b - this.b) * alpha;
		return this;
	}

	lerpColors(color1, color2, alpha) {
		this.r = color1.r + (color2.r - color1.r) * alpha;
		this.g = color1.g + (color2.g - color1.g) * alpha;
		this.b = color1.b + (color2.b - color1.b) * alpha;
		return this;
	}

	lerpHSL(color, alpha) {
		this.getHSL(_hslA);
		color.getHSL(_hslB);
		const h = lerp(_hslA.h, _hslB.h, alpha);
		const s = lerp(_hslA.s, _hslB.s, alpha);
		const l = lerp(_hslA.l, _hslB.l, alpha);
		this.setHSL(h, s, l);
		return this;
	}

	equals(c) {
		return c.r === this.r && c.g === this.g && c.b === this.b;
	}

	fromArray(array, offset = 0) {
		this.r = array[offset];
		this.g = array[offset + 1];
		this.b = array[offset + 2];
		return this;
	}

	toArray(array = [], offset = 0) {
		array[offset] = this.r;
		array[offset + 1] = this.g;
		array[offset + 2] = this.b;
		return array;
	}

	fromBufferAttribute(attribute, index) {
		this.r = attribute.getX(index);
		this.g = attribute.getY(index);
		this.b = attribute.getZ(index);

		if (attribute.normalized === true) {
			// assuming Uint8Array
			this.r /= 255;
			this.g /= 255;
			this.b /= 255;
		}

		return this;
	}

	toJSON() {
		return this.getHex();
	}

	*[Symbol.iterator]() {
		yield this.r;
		yield this.g;
		yield this.b;
	}

}

class ShapePath {
	constructor() {
		this.type = 'ShapePath';
		this.color = new Color();
		this.subPaths = [];
		this.currentPath = null;
	}

	moveTo(x, y) {
		this.currentPath = new Path();
		this.subPaths.push(this.currentPath);
		this.currentPath.moveTo(x, y);
		return this;
	}

	lineTo(x, y) {
		this.currentPath.lineTo(x, y);
		return this;
	}

	quadraticCurveTo(aCPx, aCPy, aX, aY) {
		this.currentPath.quadraticCurveTo(aCPx, aCPy, aX, aY);
		return this;
	}

	bezierCurveTo(aCP1x, aCP1y, aCP2x, aCP2y, aX, aY) {
		this.currentPath.bezierCurveTo(aCP1x, aCP1y, aCP2x, aCP2y, aX, aY);
		return this;
	}

	splineThru(pts) {
		this.currentPath.splineThru(pts);
		return this;
	}

	toShapes(isCCW, noHoles) {
		function toShapesNoHoles(inSubpaths) {
			const shapes = [];

			for (let i = 0, l = inSubpaths.length; i < l; i++) {
				const tmpPath = inSubpaths[i];
				const tmpShape = new Shape();
				tmpShape.curves = tmpPath.curves;
				shapes.push(tmpShape);
			}

			return shapes;
		}

		function isPointInsidePolygon(inPt, inPolygon) {
			const polyLen = inPolygon.length; // inPt on polygon contour => immediate success		or
			// toggling of inside/outside at every single! intersection point of an edge
			//	with the horizontal line through inPt, left of inPt
			//	not counting lowerY endpoints of edges and whole edges on that line

			let inside = false;

			for (let p = polyLen - 1, q = 0; q < polyLen; p = q++) {
				let edgeLowPt = inPolygon[p];
				let edgeHighPt = inPolygon[q];
				let edgeDx = edgeHighPt.x - edgeLowPt.x;
				let edgeDy = edgeHighPt.y - edgeLowPt.y;

				if (Math.abs(edgeDy) > Number.EPSILON) {
					// not parallel
					if (edgeDy < 0) {
						edgeLowPt = inPolygon[q];
						edgeDx = -edgeDx;
						edgeHighPt = inPolygon[p];
						edgeDy = -edgeDy;
					}

					if (inPt.y < edgeLowPt.y || inPt.y > edgeHighPt.y) continue;

					if (inPt.y === edgeLowPt.y) {
						if (inPt.x === edgeLowPt.x) return true; // inPt is on contour ?
						// continue;				// no intersection or edgeLowPt => doesn't count !!!
					} else {
						const perpEdge = edgeDy * (inPt.x - edgeLowPt.x) - edgeDx * (inPt.y - edgeLowPt.y);
						if (perpEdge === 0) return true; // inPt is on contour ?

						if (perpEdge < 0) continue;
						inside = !inside; // true intersection left of inPt
					}
				} else {
					// parallel or collinear
					if (inPt.y !== edgeLowPt.y) continue; // parallel
					// edge lies on the same horizontal line as inPt

					if (edgeHighPt.x <= inPt.x && inPt.x <= edgeLowPt.x || edgeLowPt.x <= inPt.x && inPt.x <= edgeHighPt.x) return true; // inPt: Point on contour !
					// continue;
				}
			}

			return inside;
		}

		const isClockWise = ShapeUtils.isClockWise;
		const subPaths = this.subPaths;
		if (subPaths.length === 0) return [];
		if (noHoles === true) return toShapesNoHoles(subPaths);
		let solid, tmpPath, tmpShape;
		const shapes = [];

		if (subPaths.length === 1) {
			tmpPath = subPaths[0];
			tmpShape = new Shape();
			tmpShape.curves = tmpPath.curves;
			shapes.push(tmpShape);
			return shapes;
		}

		let holesFirst = !isClockWise(subPaths[0].getPoints());
		holesFirst = isCCW ? !holesFirst : holesFirst; // console.log("Holes first", holesFirst);

		const betterShapeHoles = [];
		const newShapes = [];
		let newShapeHoles = [];
		let mainIdx = 0;
		let tmpPoints;
		newShapes[mainIdx] = undefined;
		newShapeHoles[mainIdx] = [];

		for (let i = 0, l = subPaths.length; i < l; i++) {
			tmpPath = subPaths[i];
			tmpPoints = tmpPath.getPoints();
			solid = isClockWise(tmpPoints);
			solid = isCCW ? !solid : solid;

			if (solid) {
				if (!holesFirst && newShapes[mainIdx]) mainIdx++;
				newShapes[mainIdx] = {
					s: new Shape(),
					p: tmpPoints
				};
				newShapes[mainIdx].s.curves = tmpPath.curves;
				if (holesFirst) mainIdx++;
				newShapeHoles[mainIdx] = []; //console.log('cw', i);
			} else {
				newShapeHoles[mainIdx].push({
					h: tmpPath,
					p: tmpPoints[0]
				}); //console.log('ccw', i);
			}
		} // only Holes? -> probably all Shapes with wrong orientation


		if (!newShapes[0]) return toShapesNoHoles(subPaths);

		if (newShapes.length > 1) {
			let ambiguous = false;
			let toChange = 0;

			for (let sIdx = 0, sLen = newShapes.length; sIdx < sLen; sIdx++) {
				betterShapeHoles[sIdx] = [];
			}

			for (let sIdx = 0, sLen = newShapes.length; sIdx < sLen; sIdx++) {
				const sho = newShapeHoles[sIdx];

				for (let hIdx = 0; hIdx < sho.length; hIdx++) {
					const ho = sho[hIdx];
					let hole_unassigned = true;

					for (let s2Idx = 0; s2Idx < newShapes.length; s2Idx++) {
						if (isPointInsidePolygon(ho.p, newShapes[s2Idx].p)) {
							if (sIdx !== s2Idx) toChange++;

							if (hole_unassigned) {
								hole_unassigned = false;
								betterShapeHoles[s2Idx].push(ho);
							} else {
								ambiguous = true;
							}
						}
					}

					if (hole_unassigned) {
						betterShapeHoles[sIdx].push(ho);
					}
				}
			}

			if (toChange > 0 && ambiguous === false) {
				newShapeHoles = betterShapeHoles;
			}
		}

		let tmpHoles;

		for (let i = 0, il = newShapes.length; i < il; i++) {
			tmpShape = newShapes[i].s;
			shapes.push(tmpShape);
			tmpHoles = newShapeHoles[i];

			for (let j = 0, jl = tmpHoles.length; j < jl; j++) {
				tmpShape.holes.push(tmpHoles[j].h);
			}
		} //console.log("shape", shapes);


		return shapes;
	}

}
const Cache = {

	enabled: false,

	files: {},

	add: function ( key, file ) {

		if ( this.enabled === false ) return;

		// console.log( 'THREE.Cache', 'Adding key:', key );

		this.files[ key ] = file;

	},

	get: function ( key ) {

		if ( this.enabled === false ) return;

		// console.log( 'THREE.Cache', 'Checking key:', key );

		return this.files[ key ];

	},

	remove: function ( key ) {

		delete this.files[ key ];

	},

	clear: function () {

		this.files = {};

	}

};

class LoadingManager {
	constructor(onLoad, onProgress, onError) {
		const scope = this;
		let isLoading = false;
		let itemsLoaded = 0;
		let itemsTotal = 0;
		let urlModifier = undefined;
		const handlers = []; // Refer to #5689 for the reason why we don't set .onStart
		// in the constructor

		this.onStart = undefined;
		this.onLoad = onLoad;
		this.onProgress = onProgress;
		this.onError = onError;

		this.itemStart = function (url) {
			itemsTotal++;

			if (isLoading === false) {
				if (scope.onStart !== undefined) {
					scope.onStart(url, itemsLoaded, itemsTotal);
				}
			}

			isLoading = true;
		};

		this.itemEnd = function (url) {
			itemsLoaded++;

			if (scope.onProgress !== undefined) {
				scope.onProgress(url, itemsLoaded, itemsTotal);
			}

			if (itemsLoaded === itemsTotal) {
				isLoading = false;

				if (scope.onLoad !== undefined) {
					scope.onLoad();
				}
			}
		};

		this.itemError = function (url) {
			if (scope.onError !== undefined) {
				scope.onError(url);
			}
		};

		this.resolveURL = function (url) {
			if (urlModifier) {
				return urlModifier(url);
			}

			return url;
		};

		this.setURLModifier = function (transform) {
			urlModifier = transform;
			return this;
		};

		this.addHandler = function (regex, loader) {
			handlers.push(regex, loader);
			return this;
		};

		this.removeHandler = function (regex) {
			const index = handlers.indexOf(regex);

			if (index !== -1) {
				handlers.splice(index, 2);
			}

			return this;
		};

		this.getHandler = function (file) {
			for (let i = 0, l = handlers.length; i < l; i += 2) {
				const regex = handlers[i];
				const loader = handlers[i + 1];
				if (regex.global) regex.lastIndex = 0; // see #17920

				if (regex.test(file)) {
					return loader;
				}
			}

			return null;
		};
	}

}
const DefaultLoadingManager = new LoadingManager();
class Loader {
	constructor(manager) {
		this.manager = manager !== undefined ? manager : DefaultLoadingManager;
		this.crossOrigin = 'anonymous';
		this.withCredentials = false;
		this.path = '';
		this.resourcePath = '';
		this.requestHeader = {};
	}

	load() {}

	loadAsync(url, onProgress) {
		const scope = this;
		return new Promise(function (resolve, reject) {
			scope.load(url, resolve, onProgress, reject);
		});
	}

	parse() {}

	setCrossOrigin(crossOrigin) {
		this.crossOrigin = crossOrigin;
		return this;
	}

	setWithCredentials(value) {
		this.withCredentials = value;
		return this;
	}

	setPath(path) {
		this.path = path;
		return this;
	}

	setResourcePath(resourcePath) {
		this.resourcePath = resourcePath;
		return this;
	}

	setRequestHeader(requestHeader) {
		this.requestHeader = requestHeader;
		return this;
	}

}
class FileLoader extends Loader {
	constructor(manager) {
		super(manager);
	}

	load(url, onLoad, onProgress, onError) {
		if (url === undefined) url = '';
		if (this.path !== undefined) url = this.path + url;
		url = this.manager.resolveURL(url);
		const cached = Cache.get(url);

		if (cached !== undefined) {
			this.manager.itemStart(url);
			setTimeout(() => {
				if (onLoad) onLoad(cached);
				this.manager.itemEnd(url);
			}, 0);
			return cached;
		} // Check if request is duplicate


		if (loading[url] !== undefined) {
			loading[url].push({
				onLoad: onLoad,
				onProgress: onProgress,
				onError: onError
			});
			return;
		} // Initialise array for duplicate requests


		loading[url] = [];
		loading[url].push({
			onLoad: onLoad,
			onProgress: onProgress,
			onError: onError
		}); // create request

		const req = new Request(url, {
			headers: new Headers(this.requestHeader),
			credentials: this.withCredentials ? 'include' : 'same-origin' // An abort controller could be added within a future PR

		}); // record states ( avoid data race )

		const mimeType = this.mimeType;
		const responseType = this.responseType; // start the fetch

		fetch(req).then(response => {
			if (response.status === 200 || response.status === 0) {
				// Some browsers return HTTP Status 0 when using non-http protocol
				// e.g. 'file://' or 'data://'. Handle as success.
				if (response.status === 0) {
					console.warn('THREE.FileLoader: HTTP Status 0 received.');
				} // Workaround: Checking if response.body === undefined for Alipay browser #23548


				if (typeof ReadableStream === 'undefined' || response.body === undefined || response.body.getReader === undefined) {
					return response;
				}

				const callbacks = loading[url];
				const reader = response.body.getReader();
				const contentLength = response.headers.get('Content-Length');
				const total = contentLength ? parseInt(contentLength) : 0;
				const lengthComputable = total !== 0;
				let loaded = 0; // periodically read data into the new stream tracking while download progress

				const stream = new ReadableStream({
					start(controller) {
						readData();

						function readData() {
							reader.read().then(({
																		done,
																		value
																	}) => {
								if (done) {
									controller.close();
								} else {
									loaded += value.byteLength;
									const event = new ProgressEvent('progress', {
										lengthComputable,
										loaded,
										total
									});

									for (let i = 0, il = callbacks.length; i < il; i++) {
										const callback = callbacks[i];
										if (callback.onProgress) callback.onProgress(event);
									}

									controller.enqueue(value);
									readData();
								}
							});
						}
					}

				});
				return new Response(stream);
			} else {
				throw Error(`fetch for "${response.url}" responded with ${response.status}: ${response.statusText}`);
			}
		}).then(response => {
			switch (responseType) {
				case 'arraybuffer':
					return response.arrayBuffer();

				case 'blob':
					return response.blob();

				case 'document':
					return response.text().then(text => {
						const parser = new DOMParser();
						return parser.parseFromString(text, mimeType);
					});

				case 'json':
					return response.json();

				default:
					if (mimeType === undefined) {
						return response.text();
					} else {
						// sniff encoding
						const re = /charset="?([^;"\s]*)"?/i;
						const exec = re.exec(mimeType);
						const label = exec && exec[1] ? exec[1].toLowerCase() : undefined;
						const decoder = new TextDecoder(label);
						return response.arrayBuffer().then(ab => decoder.decode(ab));
					}

			}
		}).then(data => {
			// Add to cache only on HTTP success, so that we do not cache
			// error response bodies as proper responses to requests.
			Cache.add(url, data);
			const callbacks = loading[url];
			delete loading[url];

			for (let i = 0, il = callbacks.length; i < il; i++) {
				const callback = callbacks[i];
				if (callback.onLoad) callback.onLoad(data);
			}
		}).catch(err => {
			// Abort errors and other errors are handled the same
			const callbacks = loading[url];

			if (callbacks === undefined) {
				// When onLoad was called and url was deleted in `loading`
				this.manager.itemError(url);
				throw err;
			}

			delete loading[url];

			for (let i = 0, il = callbacks.length; i < il; i++) {
				const callback = callbacks[i];
				if (callback.onError) callback.onError(err);
			}

			this.manager.itemError(url);
		}).finally(() => {
			this.manager.itemEnd(url);
		});
		this.manager.itemStart(url);
	}

	setResponseType(value) {
		this.responseType = value;
		return this;
	}

	setMimeType(value) {
		this.mimeType = value;
		return this;
	}

}
class FontLoader extends Loader {

	constructor( manager ) {

		super( manager );

	}

	load( url, onLoad, onProgress, onError ) {

		const scope = this;

		const loader = new FileLoader( this.manager );
		loader.setPath( this.path );
		loader.setRequestHeader( this.requestHeader );
		loader.setWithCredentials( scope.withCredentials );
		loader.load( url, function ( text ) {

			let json;

			try {

				json = JSON.parse( text );

			} catch ( e ) {

				console.warn( 'THREE.FontLoader: typeface.js support is being deprecated. Use typeface.json instead.' );
				json = JSON.parse( text.substring( 65, text.length - 2 ) );

			}

			const font = scope.parse( json );

			if ( onLoad ) onLoad( font );

		}, onProgress, onError );

	}

	parse( json ) {

		return new Font( json );

	}

}

//

class Font {

	constructor( data ) {

		this.isFont = true;

		this.type = 'Font';

		this.data = data;

	}

	generateShapes( text, size = 100 ) {

		const shapes = [];
		const paths = createPaths( text, size, this.data );

		for ( let p = 0, pl = paths.length; p < pl; p ++ ) {

			shapes.push( ...paths[ p ].toShapes() );

		}

		return shapes;

	}

}

function createPaths( text, size, data ) {

	const chars = Array.from( text );
	const scale = size / data.resolution;
	const line_height = ( data.boundingBox.yMax - data.boundingBox.yMin + data.underlineThickness ) * scale;

	const paths = [];

	let offsetX = 0, offsetY = 0;

	for ( let i = 0; i < chars.length; i ++ ) {

		const char = chars[ i ];

		if ( char === '\n' ) {

			offsetX = 0;
			offsetY -= line_height;

		} else {

			const ret = createPath( char, scale, offsetX, offsetY, data );
			offsetX += ret.offsetX;
			paths.push( ret.path );

		}

	}

	return paths;

}

function createPath( char, scale, offsetX, offsetY, data ) {

	const glyph = data.glyphs[ char ] || data.glyphs[ '?' ];

	if ( ! glyph ) {

		console.error( 'THREE.Font: character "' + char + '" does not exists in font family ' + data.familyName + '.' );

		return;

	}

	const path = new ShapePath();

	let x, y, cpx, cpy, cpx1, cpy1, cpx2, cpy2;

	if ( glyph.o ) {

		const outline = glyph._cachedOutline || ( glyph._cachedOutline = glyph.o.split( ' ' ) );

		for ( let i = 0, l = outline.length; i < l; ) {

			const action = outline[ i ++ ];

			switch ( action ) {

				case 'm': // moveTo

					x = outline[ i ++ ] * scale + offsetX;
					y = outline[ i ++ ] * scale + offsetY;

					path.moveTo( x, y );

					break;

				case 'l': // lineTo

					x = outline[ i ++ ] * scale + offsetX;
					y = outline[ i ++ ] * scale + offsetY;

					path.lineTo( x, y );

					break;

				case 'q': // quadraticCurveTo

					cpx = outline[ i ++ ] * scale + offsetX;
					cpy = outline[ i ++ ] * scale + offsetY;
					cpx1 = outline[ i ++ ] * scale + offsetX;
					cpy1 = outline[ i ++ ] * scale + offsetY;

					path.quadraticCurveTo( cpx1, cpy1, cpx, cpy );

					break;

				case 'b': // bezierCurveTo

					cpx = outline[ i ++ ] * scale + offsetX;
					cpy = outline[ i ++ ] * scale + offsetY;
					cpx1 = outline[ i ++ ] * scale + offsetX;
					cpy1 = outline[ i ++ ] * scale + offsetY;
					cpx2 = outline[ i ++ ] * scale + offsetX;
					cpy2 = outline[ i ++ ] * scale + offsetY;

					path.bezierCurveTo( cpx1, cpy1, cpx2, cpy2, cpx, cpy );

					break;

			}

		}

	}

	return { offsetX: glyph.ha * scale, path: path };

}

//export { FontLoader, Font };
