import test from "node:test";
import assert from "node:assert/strict";
import {lateralErrorMeters,illustrativeRoute,PORTALS} from "../model.mjs";
test("zero angular error gives zero lateral deviation",()=>assert.equal(lateralErrorMeters(38,0),0));
test("one arcsecond over 20 km yields about 0.097 metres",()=>assert.ok(Math.abs(lateralErrorMeters(20,1)-0.0969627)<0.00001));
test("negative bearing error changes the sign",()=>assert.ok(lateralErrorMeters(10,-2)<0));
test("invalid inputs are rejected",()=>{for(const args of [[-1,2],[10,NaN],[10,324000],[Infinity,1]])assert.throws(()=>lateralErrorMeters(...args),RangeError)});
test("the route begins at UK portal and ends at French portal",()=>{assert.deepEqual(illustrativeRoute(0)[0],PORTALS.uk);assert.deepEqual(illustrativeRoute(1)[1],PORTALS.fr)});
test("route progress is bounded",()=>{assert.deepEqual(illustrativeRoute(-1),illustrativeRoute(0));assert.deepEqual(illustrativeRoute(2),illustrativeRoute(1))});
