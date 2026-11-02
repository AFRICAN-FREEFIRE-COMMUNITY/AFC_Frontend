"use client";

/**
 * app/(user)/awards/_kol/KolTrophy.tsx - the KOL Awards trophy in 3D, with a picture until it is ready.
 *
 * WHAT IT DOES
 *   Draws /kol/trophy.glb with three.js on a canvas. The page shows `poster` (a render of the same
 *   trophy) straight away, and the poster fades out only once the model has really been drawn, so a
 *   slow phone, a blocked WebGL context or a failed download all leave the picture, never a hole.
 *
 * THREE.JS IS LOADED ON THIS ROUTE ONLY. `three` is imported with a dynamic import() inside the effect,
 * so it is its own chunk that no other page downloads, and it starts after the page has painted.
 *
 * SWAPPING THE TROPHY. The model is ONE static file, public/kol/trophy.glb. Replace that file and the
 * page shows the new trophy; nothing in the code names a mesh. Two things in it ARE read by name, kept
 * from the mockup because the Blender node graph cannot export them: a material called "black marble"
 * is recoloured and the gold/copper materials (names starting "gold" or "copper") get a brighter
 * environment, and anisotropy is switched off on every material (the brushed-gold anisotropy needs
 * tangents the mesh does not carry and renders as grain). The posters (/kol/low-hero.webp,
 * /kol/three-quarter.webp) are renders of the CURRENT trophy and are replaced alongside it.
 *
 * COST CONTROL: renders on demand (only while something moves), only while on screen, pixel ratio
 * capped at 1.75. prefers-reduced-motion: no entrance, no scroll-driven turning, the trophy stands at
 * its resting angle and can still be dragged.
 *
 * USED BY KolLanding (hero: intro + drag; trophy section: turned by scroll via the `angle` prop).
 */
import { useEffect, useRef, useState } from "react";
import { animate } from "framer-motion";

import { useReduceMotion } from "./KolMotion";

const GLB_URL = "/kol/trophy.glb";
const REST_ANGLE = 0.35;

// One download shared by both canvases on the landing page.
let glbPromise: Promise<ArrayBuffer> | null = null;
const loadGlb = () => (glbPromise ??= fetch(GLB_URL).then((r) => {
  if (!r.ok) throw new Error(`trophy ${r.status}`);
  return r.arrayBuffer();
}));

export function KolTrophy({
  poster,
  alt,
  label,
  intro = false,
  drag = true,
  angle,
  className,
}: {
  poster: string;
  alt: string;
  /** aria-label of the canvas. */
  label: string;
  /** Rise and spin in once, when the model is ready. */
  intro?: boolean;
  drag?: boolean;
  /** Target rotation in radians, driven from outside (the trophy section turns with scroll). */
  angle?: number;
  className?: string;
}) {
  const reduce = useReduceMotion();
  // The renderer is built once; whether to play the entrance is read when the model is ready, from the
  // ref, so the switch from the server's `false` to a reduced-motion viewer's `true` after hydration
  // does not tear the WebGL context down and build it again.
  const reduceRef = useRef(reduce);
  reduceRef.current = reduce;
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const handle = useRef<{ setTarget: (v: number) => void } | null>(null);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      const el = canvas.current;
      if (!el) return;
      const [THREE, { GLTFLoader }, { MeshoptDecoder }, { RoomEnvironment }, buffer] = await Promise.all([
        import("three"),
        import("three/examples/jsm/loaders/GLTFLoader.js"),
        import("three/examples/jsm/libs/meshopt_decoder.module.js"),
        import("three/examples/jsm/environments/RoomEnvironment.js"),
        loadGlb(),
      ]);
      if (disposed) return;

      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({ canvas: el, antialias: true, alpha: true, powerPreference: "high-performance" });
      } catch {
        return; // no WebGL: the poster stays
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;

      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      const cam = new THREE.PerspectiveCamera(28, 1, 0.01, 50);
      const key = new THREE.DirectionalLight(0xfff0c8, 2.4);
      key.position.set(2.5, 3, 3);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0xff4f9a, 1.4);
      rim.position.set(-3, 1.5, -2.5);
      scene.add(rim);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x2c1049, 0.55));
      const pivot = new THREE.Group();
      scene.add(pivot);

      const st = { rot: REST_ANGLE, target: REST_ANGLE, vel: 0, y: 0, visible: true, raf: 0, dragging: false };
      let isReady = false;
      let fitH = 1;

      const frame = () => {
        st.raf = 0;
        if (!isReady || !st.visible) return;
        if (!st.dragging) {
          st.target += st.vel;
          st.vel *= 0.92;
        }
        st.rot += (st.target - st.rot) * 0.12;
        pivot.rotation.y = st.rot;
        pivot.position.y = st.y;
        renderer.render(scene, cam);
        if (Math.abs(st.target - st.rot) > 0.0005 || Math.abs(st.vel) > 0.0002 || st.dragging) kick();
      };
      const kick = () => {
        if (!st.raf) st.raf = requestAnimationFrame(frame);
      };
      const fit = () => {
        const d = (fitH / 2) / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * (cam.aspect < 0.8 ? 1.5 : 1.16);
        cam.position.set(0, fitH * 0.04, d);
        cam.lookAt(0, 0, 0);
      };
      const size = () => {
        const r = el.getBoundingClientRect();
        if (!r.width) return;
        renderer.setSize(r.width, r.height, false);
        cam.aspect = r.width / r.height;
        cam.updateProjectionMatrix();
        fit();
        kick();
      };

      const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
      loader.parse(
        buffer.slice(0),
        "",
        (gltf) => {
          if (disposed) return;
          // Older exports carried the relief HEIGHT map of "gold africa" as its colour texture (Blender fed it
          // through a colour ramp), which draws the Africa face silver-white on a GPU. Where a material by that
          // name still has a colour map, drop the map and take the colour of "gold polished"; its normal and
          // roughness maps stay. The newer models have no textures, so this does nothing for them.
          const mats: import("three").MeshPhysicalMaterial[] = [];
          gltf.scene.traverse((o) => {
            const mesh = o as import("three").Mesh;
            if (mesh.isMesh) for (const mt of ([] as import("three").Material[]).concat(mesh.material)) mats.push(mt as import("three").MeshPhysicalMaterial);
          });
          const polished = mats.find((m) => m.name === "gold polished");
          for (const m of mats) {
            if (m.name === "gold africa" && m.map && polished) {
              m.map = null;
              m.color.copy(polished.color);
              m.needsUpdate = true;
            }
          }
          gltf.scene.traverse((o) => {
            const mesh = o as import("three").Mesh;
            if (!mesh.isMesh) return;
            for (const mt of ([] as import("three").Material[]).concat(mesh.material)) {
              const m = mt as import("three").MeshPhysicalMaterial;
              if (m.name === "black marble") {
                m.color.set(0x0e0b12);
                m.roughness = 0.16;
              }
              if ("anisotropy" in m) m.anisotropy = 0;
              if (/^gold|copper/.test(m.name)) m.envMapIntensity = 1.25;
            }
          });
          const box = new THREE.Box3().setFromObject(gltf.scene);
          const centre = box.getCenter(new THREE.Vector3());
          fitH = box.getSize(new THREE.Vector3()).y;
          gltf.scene.position.sub(centre);
          pivot.add(gltf.scene);
          isReady = true;
          size();
          if (intro && !reduceRef.current) {
            st.y = -fitH * 0.5;
            st.rot = st.target = -Math.PI * 1.6;
            animate(st.y, 0, { duration: 1.4, ease: [0.22, 1, 0.36, 1], delay: 0.2, onUpdate: (v) => { st.y = v; kick(); } });
            animate(st.target, REST_ANGLE, { duration: 1.9, ease: [0.22, 1, 0.36, 1], delay: 0.2, onUpdate: (v) => { st.target = v; kick(); } });
          }
          kick();
          setReady(true);
        },
        () => {},
      );

      const ro = new ResizeObserver(size);
      ro.observe(el);
      const io = new IntersectionObserver((es) => {
        st.visible = es[0].isIntersecting;
        if (st.visible) kick();
      });
      io.observe(el);

      const cleanups: Array<() => void> = [];
      if (drag) {
        let lastX = 0;
        const down = (e: PointerEvent) => {
          st.dragging = true;
          lastX = e.clientX;
          st.vel = 0;
          el.setPointerCapture(e.pointerId);
          kick();
        };
        const move = (e: PointerEvent) => {
          if (!st.dragging) return;
          const dx = (e.clientX - lastX) * 0.012;
          lastX = e.clientX;
          st.target += dx;
          st.vel = dx;
          kick();
        };
        const up = () => {
          st.dragging = false;
          kick();
        };
        el.addEventListener("pointerdown", down);
        el.addEventListener("pointermove", move);
        el.addEventListener("pointerup", up);
        el.addEventListener("pointercancel", up);
        cleanups.push(() => {
          el.removeEventListener("pointerdown", down);
          el.removeEventListener("pointermove", move);
          el.removeEventListener("pointerup", up);
          el.removeEventListener("pointercancel", up);
        });
      }

      handle.current = { setTarget: (v: number) => { st.target = v; kick(); } };

      cleanup = () => {
        cancelAnimationFrame(st.raf);
        ro.disconnect();
        io.disconnect();
        cleanups.forEach((fn) => fn());
        handle.current = null;
        pivot.traverse((o) => {
          const mesh = o as import("three").Mesh;
          if (!mesh.isMesh) return;
          mesh.geometry?.dispose();
          for (const mt of ([] as import("three").Material[]).concat(mesh.material)) mt.dispose();
        });
        pmrem.dispose();
        renderer.dispose();
      };
    })().catch(() => {
      /* the poster stays */
    });

    return () => {
      disposed = true;
      cleanup();
    };
  }, [intro, drag]);

  // The section that turns the trophy with scroll hands its target in here.
  useEffect(() => {
    if (angle !== undefined && !reduce) handle.current?.setTarget(angle);
  }, [angle, reduce, ready]);

  return (
    <div ref={wrap} className={`${className ?? ""}${ready ? " gl-ready" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a static render in /public, drawn at its own size */}
      <img className="fallback" alt={alt} src={poster} />
      <canvas ref={canvas} aria-label={label} />
    </div>
  );
}
