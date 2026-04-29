"use client";
import { useRef, useState } from "react";
import { Canvas, ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Box as DreiBox, Line } from "@react-three/drei";
import type { BoxResult, PalletResult } from "@/lib/types";
import { getSkuColor } from "@/lib/mockData";
import BoxInspectorPanel from "./BoxInspectorPanel";
import * as THREE from "three";

interface Props {
  pallet: PalletResult;
  palletSpec: { length_mm: number; width_mm: number; max_height_mm: number };
  layerFilter?: number | null;
}

function PalletBase({ l, w }: { l: number; w: number }) {
  const s = 1000;
  return (
    <mesh position={[l / s / 2, w / s / 2, -0.02]} receiveShadow>
      <boxGeometry args={[l / s, w / s, 0.04]} />
      <meshStandardMaterial color="#a3a3a3" />
    </mesh>
  );
}

function BoxMesh({
  box,
  onClick,
  selected,
}: {
  box: BoxResult;
  onClick: () => void;
  selected: boolean;
}) {
  const S = 1000;
  const color = getSkuColor(box.sku);
  const [hovered, setHovered] = useState(false);

  return (
    <mesh
      position={[
        (box.x_mm + box.length_mm / 2) / S,
        (box.y_mm + box.width_mm / 2) / S,
        (box.z_mm + box.height_mm / 2) / S,
      ]}
      onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onClick(); }}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      castShadow
    >
      <boxGeometry args={[box.length_mm / S, box.width_mm / S, box.height_mm / S]} />
      <meshStandardMaterial
        color={color}
        opacity={hovered || selected ? 1.0 : 0.82}
        transparent
        emissive={selected ? new THREE.Color(color) : undefined}
        emissiveIntensity={selected ? 0.4 : 0}
        wireframe={false}
      />
    </mesh>
  );
}

export default function PalletViewer3D({ pallet, palletSpec, layerFilter }: Props) {
  const [selected, setSelected] = useState<BoxResult | null>(null);
  const controlsRef = useRef<any>(null);

  const visibleBoxes = layerFilter
    ? pallet.boxes.filter((b) => b.layer === layerFilter)
    : pallet.boxes;

  const S = 1000;
  const L = palletSpec.length_mm / S;
  const W = palletSpec.width_mm / S;
  const H = palletSpec.max_height_mm / S;

  return (
    <div className="relative w-full h-full">
      <Canvas
        camera={{ position: [L * 2, W * 2, H * 2], fov: 45 }}
        shadows
        style={{ background: "#f8fafc" }}
        onClick={() => setSelected(null)}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 3, 5]} intensity={0.8} castShadow />
        <PalletBase l={palletSpec.length_mm} w={palletSpec.width_mm} />
        {/* Pallet border */}
        <lineSegments>
          <edgesGeometry args={[new THREE.BoxGeometry(L, W, H)]} />
          <lineBasicMaterial color="#94a3b8" transparent opacity={0.4} />
        </lineSegments>
        <group position={[L / 2, W / 2, H / 2]}>
          {/* phantom to anchor edges */}
        </group>
        {visibleBoxes.map((box) => (
          <BoxMesh
            key={box.box_id}
            box={box}
            onClick={() => setSelected(selected?.box_id === box.box_id ? null : box)}
            selected={selected?.box_id === box.box_id}
          />
        ))}
        <OrbitControls ref={controlsRef} makeDefault />
        <gridHelper args={[2, 10, "#e2e8f0", "#e2e8f0"]} position={[L / 2, W / 2, 0]} rotation={[Math.PI / 2, 0, 0]} />
      </Canvas>

      <button
        className="absolute bottom-3 left-3 bg-white border border-gray-300 text-xs px-3 py-1.5 rounded shadow hover:bg-gray-50"
        onClick={() => controlsRef.current?.reset()}
      >
        Reset Camera
      </button>

      <BoxInspectorPanel box={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
