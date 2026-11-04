import * as THREE from 'three';
import type { Finish } from '../gen/types';

/**
 * Per-character material factory. Dedups identical materials inside one character and
 * disposes everything it created in one call, so re-rolling never leaks GPU memory.
 */
export class MaterialKit {
  private cache = new Map<string, THREE.Material>();
  private textures: THREE.Texture[] = [];

  constructor(private readonly quality: 'low' | 'medium' | 'high' = 'high') {}

  /** Vinyl skin in the character's finish. */
  vinyl(color: string, finish: Finish): THREE.MeshPhysicalMaterial {
    return this.get(`vinyl:${color}:${finish}`, () => {
      const c = new THREE.Color(color);
      const m = new THREE.MeshPhysicalMaterial({ color: c });
      switch (finish) {
        case 'glossy':
          m.roughness = 0.42;
          m.clearcoat = 1;
          m.clearcoatRoughness = 0.08;
          break;
        case 'matte':
          m.roughness = 0.78;
          m.clearcoat = 0.15;
          m.clearcoatRoughness = 0.6;
          m.sheen = 0.4;
          m.sheenRoughness = 0.8;
          m.sheenColor = c.clone().lerp(new THREE.Color('#ffffff'), 0.5);
          break;
        case 'pearl':
          m.roughness = 0.3;
          m.clearcoat = 1;
          m.clearcoatRoughness = 0.1;
          m.iridescence = 1;
          m.iridescenceIOR = 1.35;
          m.iridescenceThicknessRange = [180, 520];
          break;
        case 'glitter':
          m.roughness = 0.35;
          m.metalness = 0.25;
          m.clearcoat = 1;
          m.clearcoatRoughness = 0.05;
          m.normalMap = this.glitterNormal();
          m.normalScale = new THREE.Vector2(0.35, 0.35);
          break;
        case 'metallic':
          m.roughness = 0.22;
          m.metalness = 0.85;
          m.clearcoat = 0.6;
          m.clearcoatRoughness = 0.1;
          break;
        case 'galaxy':
          m.color = new THREE.Color('#ffffff');
          m.map = this.galaxyTexture(color);
          m.roughness = 0.25;
          m.clearcoat = 1;
          m.clearcoatRoughness = 0.05;
          m.emissive = new THREE.Color('#ffffff');
          m.emissiveMap = m.map;
          m.emissiveIntensity = 0.35;
          break;
      }
      return m;
    }) as THREE.MeshPhysicalMaterial;
  }

  /** Soft fabric (outfits, hats). */
  fabric(color: string): THREE.MeshPhysicalMaterial {
    return this.get(`fabric:${color}`, () => {
      const c = new THREE.Color(color);
      return new THREE.MeshPhysicalMaterial({
        color: c,
        roughness: 0.82,
        sheen: 1,
        sheenRoughness: 0.55,
        sheenColor: c.clone().lerp(new THREE.Color('#ffffff'), 0.45),
      });
    }) as THREE.MeshPhysicalMaterial;
  }

  /** Painted hard plastic (accessories, buttons, props on the toy). */
  plastic(color: string, rough = 0.38): THREE.MeshPhysicalMaterial {
    return this.get(`plastic:${color}:${rough}`, () => {
      return new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(color),
        roughness: rough,
        clearcoat: 0.7,
        clearcoatRoughness: 0.15,
      });
    }) as THREE.MeshPhysicalMaterial;
  }

  metal(color: string): THREE.MeshPhysicalMaterial {
    return this.get(`metal:${color}`, () => {
      return new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(color),
        roughness: 0.2,
        metalness: 1,
        clearcoat: 0.5,
      });
    }) as THREE.MeshPhysicalMaterial;
  }

  glass(tint = '#dff4ff'): THREE.MeshPhysicalMaterial {
    return this.get(`glass:${tint}`, () => {
      return new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(tint),
        roughness: 0.05,
        transmission: this.quality === 'low' ? 0 : 0.9,
        transparent: true,
        opacity: this.quality === 'low' ? 0.35 : 1,
        thickness: 0.05,
        ior: 1.3,
        clearcoat: 1,
        depthWrite: false,
      });
    }) as THREE.MeshPhysicalMaterial;
  }

  glow(color: string, intensity = 1.5): THREE.MeshStandardMaterial {
    return this.get(`glow:${color}:${intensity}`, () => {
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        emissive: new THREE.Color(color),
        emissiveIntensity: intensity,
        roughness: 0.4,
      });
    }) as THREE.MeshStandardMaterial;
  }

  /** Flat low-poly prop material for scenes. */
  prop(color: string, flat = true): THREE.MeshStandardMaterial {
    return this.get(`prop:${color}:${flat}`, () => {
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        roughness: 0.85,
        flatShading: flat,
      });
    }) as THREE.MeshStandardMaterial;
  }

  basic(color: string, opts: THREE.MeshBasicMaterialParameters = {}): THREE.MeshBasicMaterial {
    return this.get(`basic:${color}:${JSON.stringify(opts)}`, () => {
      return new THREE.MeshBasicMaterial({ color: new THREE.Color(color), ...opts });
    }) as THREE.MeshBasicMaterial;
  }

  /** Register a material created elsewhere so it is disposed with the kit. */
  own<T extends THREE.Material>(m: T): T {
    this.cache.set(`own:${m.uuid}`, m);
    return m;
  }

  ownTexture<T extends THREE.Texture>(t: T): T {
    this.textures.push(t);
    return t;
  }

  dispose(): void {
    for (const m of this.cache.values()) m.dispose();
    for (const t of this.textures) t.dispose();
    this.cache.clear();
    this.textures = [];
  }

  private get(key: string, make: () => THREE.Material): THREE.Material {
    let m = this.cache.get(key);
    if (!m) {
      m = make();
      this.cache.set(key, m);
    }
    return m;
  }

  private glitterTex?: THREE.Texture;
  private glitterNormal(): THREE.Texture {
    if (this.glitterTex) return this.glitterTex;
    const size = 128;
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const ctx = cv.getContext('2d')!;
    ctx.fillStyle = 'rgb(128,128,255)';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 900; i++) {
      const x = (i * 73.13) % size;
      const y = (i * 41.7 + (i % 7) * 13) % size;
      ctx.fillStyle = `rgb(${(i * 97) % 255},${(i * 53) % 255},255)`;
      ctx.fillRect(x, y, 2, 2);
    }
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(6, 6);
    this.glitterTex = this.ownTexture(t);
    return t;
  }

  private galaxyTexture(base: string): THREE.Texture {
    const w = 512,
      h = 256;
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext('2d')!;
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#1b1046');
    g.addColorStop(0.5, new THREE.Color(base).lerp(new THREE.Color('#2a0f5c'), 0.6).getStyle());
    g.addColorStop(1, '#0b1b4d');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // Nebula puffs.
    const neb = ['#ff5fd2', '#5fd0ff', '#a36bff', '#ffd36b'];
    for (let i = 0; i < 18; i++) {
      const x = (i * 131) % w,
        y = (i * 71) % h,
        r = 30 + ((i * 37) % 60);
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, neb[i % neb.length]! + '66');
      rg.addColorStop(1, '#00000000');
      ctx.fillStyle = rg;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 260; i++) {
      const x = (i * 97.3) % w,
        y = (i * 57.9 + i * i * 0.01) % h;
      const s = i % 17 === 0 ? 2.2 : 1;
      ctx.fillStyle = i % 5 === 0 ? '#fff6c8' : '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, s, 0, Math.PI * 2);
      ctx.fill();
    }
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return this.ownTexture(t);
  }
}
