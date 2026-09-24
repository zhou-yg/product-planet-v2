"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

interface Props {
  /** Raw file URL (/api/file/raw?path=...&ws=...) */
  src: string;
  /** Used to rebuild the viewer when the file changes */
  fileKey: string;
}

/**
 * Read-only glb/gltf previewer based on three.js.
 * Supports rotate / zoom / pan via OrbitControls.
 */
export default function GlbViewer({ src, fileKey }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    setError("");
    setLoading(true);

    // Scene basics
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf4f4f5);

    const camera = new THREE.PerspectiveCamera(
      50,
      mount.clientWidth / Math.max(mount.clientHeight, 1),
      0.1,
      2000,
    );
    camera.position.set(3, 2, 5);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, Math.max(mount.clientHeight, 1));
    renderer.setPixelRatio(window.devicePixelRatio);
    mount.appendChild(renderer.domElement);

    // Rotate / zoom / pan controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(5, 10, 7);
    scene.add(dir);
    const dir2 = new THREE.DirectionalLight(0xffffff, 0.5);
    dir2.position.set(-5, -5, -5);
    scene.add(dir2);

    // Load the model
    let model: THREE.Object3D | null = null;
    const loader = new GLTFLoader();
    loader.load(
      src,
      (gltf) => {
        model = gltf.scene;

        // Frame the model: center it and scale camera distance to its size
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        camera.position.set(
          maxDim * 1.2,
          maxDim * 0.8,
          maxDim * 1.6,
        );
        controls.update();

        scene.add(model);
        setLoading(false);
      },
      undefined,
      (err) => {
        const msg =
          err instanceof Error
            ? err.message
            : typeof err === "object" && err !== null && "message" in err
              ? String((err as { message: unknown }).message)
              : String(err);
        setError(`模型加载失败：${msg}`);
        setLoading(false);
      },
    );

    // Render loop
    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize handling
    const onResize = () => {
      const w = mount.clientWidth;
      const h = Math.max(mount.clientHeight, 1);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const observer = new ResizeObserver(onResize);
    observer.observe(mount);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      controls.dispose();
      renderer.dispose();
      if (model) {
        scene.remove(model);
        model.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (mesh.geometry) mesh.geometry.dispose();
        });
      }
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [src, fileKey]);

  return (
    <div className="relative h-full w-full">
      <div ref={mountRef} className="h-full w-full" aria-label="3D 模型预览" />
      {loading ? (
        <p className="absolute left-1/2 top-4 -translate-x-1/2 rounded-md bg-white/90 px-3 py-1 text-xs text-zinc-500 shadow-sm">
          模型加载中…
        </p>
      ) : null}
      {error ? (
        <p className="absolute left-1/2 top-4 -translate-x-1/2 rounded-md bg-red-50 px-3 py-1.5 text-xs text-red-600 shadow-sm">
          {error}
        </p>
      ) : null}
      <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-md bg-white/80 px-2 py-1 text-xs text-zinc-400">
        旋转：拖拽 · 缩放：滚轮 · 平移：右键拖拽（只读预览）
      </p>
    </div>
  );
}
