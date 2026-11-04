import * as THREE from 'three';
import type { CharacterSpec } from '../gen/types';
import type { BlobParams } from './geometry';
import { blobAnchor, blobPoint } from './geometry';
import type { MaterialKit } from './materials';

/** Everything a part builder needs to attach meshes to the character. */
export interface BuildCtx {
  spec: CharacterSpec;
  kit: MaterialKit;
  /** Skin material (character finish). */
  skin: THREE.Material;
  skinAlt: THREE.Material;
  head: {
    group: THREE.Group;
    params: BlobParams;
    /** Surface point + normal in head-local space; azimuth from +z (front), elevation from equator. */
    anchor(azDeg: number, elDeg: number): { pos: THREE.Vector3; normal: THREE.Vector3 };
    /** Height of the head's top above head centre. */
    top: number;
  };
  body: {
    group: THREE.Group;
    params: BlobParams;
    /** Body centre y in character space. */
    cy: number;
    anchor(azDeg: number, elDeg: number): { pos: THREE.Vector3; normal: THREE.Vector3 };
    arms: THREE.Mesh[];
    legs: THREE.Mesh[];
    feet: THREE.Mesh[];
    /** Right hand position in body-local space (for held accessories). */
    hand: THREE.Vector3;
    handL: THREE.Vector3;
  };
  /** Character-space group (for things like balloons that float beside). */
  root: THREE.Group;
  /** Tracks geometries for disposal. */
  geo<T extends THREE.BufferGeometry>(g: T): T;
  mesh(g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D): THREE.Mesh;
}

export function makeAnchorFn(p: BlobParams, offsetY = 0) {
  return (az: number, el: number) => {
    const a = blobAnchor(p, az, el);
    a.pos.y += offsetY;
    return a;
  };
}

export function topOf(p: BlobParams): number {
  return blobPoint(p, new THREE.Vector3(0, 1, 0)).y;
}

/** Orients an object so its +Y axis points along `normal`. */
export function alignY(obj: THREE.Object3D, normal: THREE.Vector3): void {
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal.clone().normalize());
}
