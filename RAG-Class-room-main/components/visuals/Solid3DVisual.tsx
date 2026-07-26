"use client";
/**
 * Renders a rotatable 3D solid (cone/cylinder/sphere/cube) via Three.js —
 * the one justified 3D use case for a maths-focused app: CBSE/state
 * Class 9-10 mensuration (volume & surface area). Seeing a solid rotate
 * makes the "why" behind the formula visible, not just the formula.
 *
 * Deliberately isolated from the rest of the visual layer:
 *  - Lazy-loaded (dynamic import) — never in the main bundle, since most
 *    lessons never need 3D.
 *  - Device-capability checked before mounting — no WebGL2 → falls back
 *    to a static 2D net/cross-section instead of a frozen page. This
 *    matters because the offline path already asks the same device to
 *    hold a 3.1GB LLM in memory; concurrent WebGL adds real GPU/battery
 *    load on top of that, so it must degrade gracefully, not assume
 *    a capable device.
 *  - The classroom page is responsible for never mounting this while
 *    the AI is still generating — sequence, don't run concurrently.
 */
import { useEffect, useRef, useState } from "react";
import type { Solid3DVisual as Solid3DVisualType } from "@/lib/visual-schema";

function hasWebGL2(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return !!canvas.getContext("webgl2");
  } catch { return false; }
}

export function Solid3DVisual({ visual }: { visual: Solid3DVisualType }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [capable] = useState(hasWebGL2);

  useEffect(() => {
    if (!capable || !mountRef.current) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const THREE = await import("three");
      if (cancelled || !mountRef.current) return;

      const width = mountRef.current.clientWidth || 320;
      const height = 240;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
      camera.position.set(3.5, 2.5, 4.5);
      camera.lookAt(0, 0, 0);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(width, height);
      mountRef.current.appendChild(renderer.domElement);

      const light1 = new THREE.DirectionalLight(0xffffff, 1.2);
      light1.position.set(3, 5, 4);
      scene.add(light1);
      scene.add(new THREE.AmbientLight(0x404040, 1.5));

      let geometry: any;
      switch (visual.shape) {
        case "cone":     geometry = new THREE.ConeGeometry(visual.radius || 1, visual.height || 2, 32); break;
        case "cylinder": geometry = new THREE.CylinderGeometry(visual.radius || 1, visual.radius || 1, visual.height || 2, 32); break;
        case "sphere":   geometry = new THREE.SphereGeometry(visual.radius || 1, 32, 32); break;
        case "cube":     geometry = new THREE.BoxGeometry(visual.side || 1.5, visual.side || 1.5, visual.side || 1.5); break;
        default:         geometry = new THREE.SphereGeometry(1, 32, 32);
      }
      const material = new THREE.MeshStandardMaterial({ color: 0xe8a33d, metalness: 0.15, roughness: 0.55 });
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);

      const wireframe = new THREE.LineSegments(
        new THREE.WireframeGeometry(geometry),
        new THREE.LineBasicMaterial({ color: 0x16241d, transparent: true, opacity: 0.3 }),
      );
      mesh.add(wireframe);

      let frameId: number;
      function animate() {
        mesh.rotation.y += 0.008;
        mesh.rotation.x = Math.sin(Date.now() * 0.0003) * 0.15;
        renderer.render(scene, camera);
        frameId = requestAnimationFrame(animate);
      }
      animate();

      cleanup = () => {
        cancelAnimationFrame(frameId);
        renderer.dispose();
        geometry.dispose();
        material.dispose();
        mountRef.current?.removeChild(renderer.domElement);
      };
    })();

    return () => { cancelled = true; cleanup?.(); };
  }, [capable, visual.shape, visual.radius, visual.height, visual.side]);

  if (!capable) {
    return (
      <div className="rounded-lg border border-board3 bg-board p-4 text-center text-xs text-chalkdim">
        3D preview isn't supported on this device — imagine a {visual.shape}
        {visual.radius ? ` with radius ${visual.radius}` : ""}
        {visual.height ? ` and height ${visual.height}` : ""}.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-board3 bg-board overflow-hidden flex justify-center">
      <div ref={mountRef} style={{ width: "100%", maxWidth: 320, height: 240 }} />
    </div>
  );
}
