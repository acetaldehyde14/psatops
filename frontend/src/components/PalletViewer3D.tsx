"use client";
import { useRef, useState, useCallback } from "react";
import { Canvas, ThreeEvent, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { BoxResult, PalletResult } from "@/lib/types";
import { getSkuColor } from "@/lib/mockData";
import BoxInspectorPanel from "./BoxInspectorPanel";
import * as THREE from "three";

interface Props {
  pallet: PalletResult;
  palletSpec: { length_mm: number; width_mm: number; max_height_mm: number };
  layerFilter?: number | null;
  editMode?: boolean;
  invalidBoxIds?: Set<string>;
  onBoxSelect?: (box: BoxResult) => void;
  onBoxMove?: (boxId: string, x: number, y: number, z: number) => void;
  selectedBoxId?: string | null;
  snapGrid?: number;
}

const S = 1000; // mm → Three.js units

function PalletBase({ l, w }: { l: number; w: number }) {
  return (
    <mesh position={[l / S / 2, w / S / 2, -0.02]} receiveShadow>
      <boxGeometry args={[l / S, w / S, 0.04]} />
      <meshStandardMaterial color="#a3a3a3" />
    </mesh>
  );
}

// Invisible horizontal plane used for drag hit-testing
function DragPlane({
  z,
  onPointerMove,
  onPointerUp,
}: {
  z: number;
  onPointerMove: (e: ThreeEvent<PointerEvent>) => void;
  onPointerUp: (e: ThreeEvent<PointerEvent>) => void;
}) {
  return (
    <mesh
      position={[0, 0, z]}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <planeGeometry args={[1000, 1000]} />
      <meshBasicMaterial visible={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

function BoxMesh({
  box,
  selected,
  invalid,
  editMode,
  snapGrid,
  palletSpec,
  onClick,
  onDragEnd,
}: {
  box: BoxResult;
  selected: boolean;
  invalid: boolean;
  editMode: boolean;
  snapGrid: number;
  palletSpec: { length_mm: number; width_mm: number; max_height_mm: number };
  onClick: () => void;
  onDragEnd: (boxId: string, x: number, y: number) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ px: number; py: number; bx: number; by: number } | null>(null);
  const { gl } = useThree();

  const color = invalid ? "#ef4444" : getSkuColor(box.sku);

  const snap = (v: number) => Math.round(v / (snapGrid / S)) * (snapGrid / S);

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (!editMode) return;
    e.stopPropagation();
    setDragging(true);
    dragStart.current = {
      px: e.point.x,
      py: e.point.y,
      bx: box.x_mm / S,
      by: box.y_mm / S,
    };
    gl.domElement.style.cursor = "grabbing";
  };

  const handleDragMove = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging || !dragStart.current) return;
    e.stopPropagation();
    const dx = e.point.x - dragStart.current.px;
    const dy = e.point.y - dragStart.current.py;
    const rawX = dragStart.current.bx + dx;
    const rawY = dragStart.current.by + dy;
    // Clamp to pallet bounds
    const maxX = (palletSpec.length_mm - box.length_mm) / S;
    const maxY = (palletSpec.width_mm - box.width_mm) / S;
    const clampedX = Math.max(0, Math.min(snap(rawX), maxX));
    const clampedY = Math.max(0, Math.min(snap(rawY), maxY));
    onDragEnd(box.box_id, clampedX * S, clampedY * S);
  };

  const handleDragEnd = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging) return;
    e.stopPropagation();
    setDragging(false);
    dragStart.current = null;
    gl.domElement.style.cursor = editMode ? "pointer" : "auto";
  };

  return (
    <>
      {dragging && (
        <DragPlane
          z={box.z_mm / S}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
        />
      )}
      <mesh
        position={[
          (box.x_mm + box.length_mm / 2) / S,
          (box.y_mm + box.width_mm / 2) / S,
          (box.z_mm + box.height_mm / 2) / S,
        ]}
        onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onClick(); }}
        onPointerDown={handlePointerDown}
        onPointerOver={() => { setHovered(true); if (editMode) gl.domElement.style.cursor = "pointer"; }}
        onPointerOut={() => { setHovered(false); if (!dragging) gl.domElement.style.cursor = "auto"; }}
        castShadow
      >
        <boxGeometry args={[box.length_mm / S, box.width_mm / S, box.height_mm / S]} />
        <meshStandardMaterial
          color={color}
          opacity={hovered || selected ? 1.0 : 0.82}
          transparent
          emissive={selected ? new THREE.Color(color) : invalid ? new THREE.Color("#ef4444") : undefined}
          emissiveIntensity={selected ? 0.35 : invalid ? 0.25 : 0}
        />
      </mesh>
      {selected && (
        <lineSegments
          position={[
            (box.x_mm + box.length_mm / 2) / S,
            (box.y_mm + box.width_mm / 2) / S,
            (box.z_mm + box.height_mm / 2) / S,
          ]}
        >
          <edgesGeometry args={[new THREE.BoxGeometry(
            (box.length_mm + 6) / S,
            (box.width_mm + 6) / S,
            (box.height_mm + 6) / S,
          )]} />
          <lineBasicMaterial color="#2563eb" linewidth={2} />
        </lineSegments>
      )}
    </>
  );
}

export default function PalletViewer3D({
  pallet, palletSpec, layerFilter,
  editMode = false, invalidBoxIds = new Set(),
  onBoxSelect, onBoxMove,
  selectedBoxId = null,
  snapGrid = 10,
}: Props) {
  const [viewSelected, setViewSelected] = useState<BoxResult | null>(null);
  const controlsRef = useRef<any>(null);

  const visibleBoxes = layerFilter
    ? pallet.boxes.filter((b) => b.layer === layerFilter)
    : pallet.boxes;

  const L = palletSpec.length_mm / S;
  const W = palletSpec.width_mm / S;
  const H = palletSpec.max_height_mm / S;
  const cx = L / 2, cy = W / 2, cz = H / 2;
  const dist = Math.max(L, H) * 2.8;

  const handleBoxClick = useCallback((box: BoxResult) => {
    if (editMode && onBoxSelect) {
      onBoxSelect(box);
    } else {
      setViewSelected((prev) => prev?.box_id === box.box_id ? null : box);
    }
  }, [editMode, onBoxSelect]);

  const handleDragEnd = useCallback((boxId: string, x: number, y: number) => {
    onBoxMove?.(boxId, x, y, pallet.boxes.find(b => b.box_id === boxId)?.z_mm ?? 0);
  }, [onBoxMove, pallet.boxes]);

  return (
    <div className="relative w-full h-full">
      <Canvas
        camera={{ position: [cx, cy - dist, cz], fov: 40, up: [0, 0, 1] }}
        shadows
        style={{ background: "#f8fafc" }}
        onClick={() => {
          if (!editMode) setViewSelected(null);
        }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, -3, 5]} intensity={0.8} castShadow />
        <PalletBase l={palletSpec.length_mm} w={palletSpec.width_mm} />
        <lineSegments position={[cx, cy, cz]}>
          <edgesGeometry args={[new THREE.BoxGeometry(L, W, H)]} />
          <lineBasicMaterial color="#94a3b8" transparent opacity={0.35} />
        </lineSegments>
        {visibleBoxes.map((box) => (
          <BoxMesh
            key={box.box_id}
            box={box}
            selected={editMode ? selectedBoxId === box.box_id : viewSelected?.box_id === box.box_id}
            invalid={invalidBoxIds.has(box.box_id)}
            editMode={editMode}
            snapGrid={snapGrid}
            palletSpec={palletSpec}
            onClick={() => handleBoxClick(box)}
            onDragEnd={handleDragEnd}
          />
        ))}
        <OrbitControls
          ref={controlsRef}
          makeDefault
          target={[cx, cy, cz]}
          enabled={!editMode}
          enableDamping
          dampingFactor={0.08}
        />
        <gridHelper
          args={[Math.max(L, W) * 1.5, 12, "#e2e8f0", "#e2e8f0"]}
          position={[cx, cy, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        />
      </Canvas>

      {editMode && (
        <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs px-2 py-1 rounded font-medium pointer-events-none">
          Edit Mode — drag boxes or use panel
        </div>
      )}

      <button
        className="absolute bottom-3 left-3 bg-white border border-gray-300 text-xs px-3 py-1.5 rounded shadow hover:bg-gray-50"
        onClick={() => {
          if (controlsRef.current) {
            controlsRef.current.object.position.set(cx, cy - dist, cz);
            controlsRef.current.target.set(cx, cy, cz);
            controlsRef.current.update();
          }
        }}
      >
        Reset Camera
      </button>

      {!editMode && (
        <BoxInspectorPanel
          box={viewSelected}
          onClose={() => setViewSelected(null)}
        />
      )}
    </div>
  );
}
