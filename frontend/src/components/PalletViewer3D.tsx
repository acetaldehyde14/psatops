"use client";
import { memo, useRef, useState, useCallback, useEffect, useMemo } from "react";
import { Canvas, ThreeEvent, useThree } from "@react-three/fiber";
import { OrbitControls, Line } from "@react-three/drei";
import type { BoxResult, PalletResult, ManualAdjustmentSettings } from "@/lib/types";
import { getSkuColor } from "@/lib/mockData";
import BoxInspectorPanel from "./BoxInspectorPanel";
import LayerGuideGrid, { SCALE } from "./LayerGuideGrid";
import { applySnappingDetailed, applyMagneticSnap, snapToHorizontalGap, type SnapGuide } from "@/lib/snapping";
import { isBoxInLockedRow, getMovableSelection, type LockedRow } from "@/lib/rowLocking";
import { validateBoxesLightweight, validateLayout } from "@/lib/layoutValidation";
import * as THREE from "three";

interface Props {
  pallet: PalletResult;
  palletSpec: { length_mm: number; width_mm: number; max_height_mm: number; max_weight_kg?: number };
  layerFilter?: number | null;
  editMode?: boolean;
  settings?: ManualAdjustmentSettings;
  invalidBoxIds?: Set<string>;
  selectedBoxIds?: Set<string>;
  highlightedSku?: string;
  colorBySku?: Record<string, string>;
  snapToBoxEdges?: boolean;
  snapToThreshold?: boolean;
  unlockedMode?: boolean;
  magneticSnapEnabled?: boolean;
  magneticSnapStrength?: number;
  lockedRows?: LockedRow[];
  onBoxClick?: (box: BoxResult, multi: boolean) => void;
  onBoxDragEnd?: (moves: Array<{ box_id: string; x: number; y: number }>) => void;
}

type PreviewStatus = "valid" | "invalid" | "snapped";
type PreviewPosition = { x: number; y: number; status: PreviewStatus };

interface BoxPreviewController {
  setPreview: (preview: PreviewPosition) => void;
  clearPreview: () => void;
}

interface DragSession {
  ids: string[];
  clickedBoxId: string;
  planeZMm: number;
  dragStartPalletPoint: { x: number; y: number };
  startPositions: Map<string, { x: number; y: number }>;
  lastValid: Map<string, { x: number; y: number }>;
  previewIds: Set<string>;
  latestPointMm: { x: number; y: number } | null;
}

function intersectPlanePoint(
  event: ThreeEvent<PointerEvent>,
  zMm: number,
): { x: number; y: number } | null {
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -zMm * SCALE);
  const hit = new THREE.Vector3();
  if (!event.ray.intersectPlane(plane, hit)) return null;
  return { x: hit.x / SCALE, y: hit.y / SCALE };
}

function boxesOverlapMm(a: BoxResult, b: BoxResult, eps = 0.5): boolean {
  return (
    a.x_mm < b.x_mm + b.length_mm - eps && a.x_mm + a.length_mm > b.x_mm + eps &&
    a.y_mm < b.y_mm + b.width_mm - eps && a.y_mm + a.width_mm > b.y_mm + eps &&
    a.z_mm < b.z_mm + b.height_mm - eps && a.z_mm + a.height_mm > b.z_mm + eps
  );
}

// ── Pallet base + ghost outline ───────────────────────────────────────────────
function PalletBase({ l, w }: { l: number; w: number }) {
  return (
    <mesh position={[l * SCALE / 2, w * SCALE / 2, -0.02]} receiveShadow>
      <boxGeometry args={[l * SCALE, w * SCALE, 0.04]} />
      <meshStandardMaterial color="#a3a3a3" />
    </mesh>
  );
}

// ── Edge threshold rectangle ──────────────────────────────────────────────────
function ThresholdRect({
  palletL, palletW, tl, tw,
}: { palletL: number; palletW: number; tl: number; tw: number }) {
  if (tl <= 0 && tw <= 0) return null;
  const x1 = tl * SCALE, y1 = tw * SCALE;
  const x2 = (palletL - tl) * SCALE, y2 = (palletW - tw) * SCALE;
  const z = 0.005;
  const pts: [number, number, number][] = [
    [x1, y1, z], [x2, y1, z], [x2, y2, z], [x1, y2, z], [x1, y1, z],
  ];
  return <Line points={pts} color="#f59e0b" lineWidth={2} dashed dashSize={0.02} gapSize={0.015} />;
}

// ── Drag capture plane ────────────────────────────────────────────────────────
function DragPlane({
  z, onMove, onUp,
}: {
  z: number;
  onMove: (e: ThreeEvent<PointerEvent>) => void;
  onUp: (e: ThreeEvent<PointerEvent>) => void;
}) {
  return (
    <mesh position={[0, 0, z]} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      <planeGeometry args={[1000, 1000]} />
      <meshBasicMaterial visible={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ── Single box mesh ───────────────────────────────────────────────────────────
interface BoxMeshProps {
  box: BoxResult;
  selected: boolean;
  hovered: boolean;
  invalid: boolean;
  legendHighlighted: boolean;
  editMode: boolean;
  orbitActive: boolean;
  colorBySku?: Record<string, string>;
  isLockedRow: boolean;
  registerController: (boxId: string, controller: BoxPreviewController | null) => void;
  onHoverChange: (boxId: string | null) => void;
  onPointerDown: (e: ThreeEvent<PointerEvent>, box: BoxResult) => void;
  onDragMove: (e: ThreeEvent<PointerEvent>) => void;
  onDragUp: (e: ThreeEvent<PointerEvent>) => void;
  onClick: (e: ThreeEvent<MouseEvent>, box: BoxResult) => void;
}

const BoxMesh = memo(function BoxMesh({
  box, selected, hovered, invalid, legendHighlighted, editMode, orbitActive, colorBySku,
  isLockedRow, registerController,
  onHoverChange,
  onPointerDown, onDragMove, onDragUp, onClick,
}: BoxMeshProps) {
  const { gl } = useThree();
  const meshRef = useRef<THREE.Mesh>(null);
  const outlineRef = useRef<THREE.LineSegments>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const skuColor = useMemo(() => colorBySku?.[box.sku] ?? getSkuColor(box.sku), [box.sku, colorBySku]);
  const baseColor = invalid ? "#ef4444" : skuColor;
  const showOutline = invalid || selected || hovered || legendHighlighted || isLockedRow;
  const outlineColor = invalid ? "#ef4444" : selected ? "#2563eb" : isLockedRow ? "#9333ea" : "#f59e0b";

  const px = (box.x_mm + box.length_mm / 2) * SCALE;
  const py = (box.y_mm + box.width_mm / 2) * SCALE;
  const pz = (box.z_mm + box.height_mm / 2) * SCALE;
  const geometry = useMemo(
    () => new THREE.BoxGeometry(box.length_mm * SCALE, box.width_mm * SCALE, box.height_mm * SCALE),
    [box.height_mm, box.length_mm, box.width_mm],
  );
  const outlineGeometry = useMemo(
    () => new THREE.EdgesGeometry(new THREE.BoxGeometry(
      (box.length_mm + 8) * SCALE,
      (box.width_mm + 8) * SCALE,
      (box.height_mm + 8) * SCALE,
    )),
    [box.height_mm, box.length_mm, box.width_mm],
  );

  const applyMaterial = useCallback((previewStatus?: PreviewStatus) => {
    const material = materialRef.current;
    if (!material) return;
    const isPreviewInvalid = previewStatus === "invalid";
    const color = previewStatus === "snapped" ? "#2563eb" : previewStatus === "valid" ? "#22c55e" : isPreviewInvalid ? "#ef4444" : baseColor;
    material.color.set(color);
    material.opacity = previewStatus === undefined ? (hovered || selected ? 1.0 : 0.82) : 0.54;
    material.transparent = material.opacity < 1;
    material.emissive.set(
      isPreviewInvalid || invalid ? "#ef4444" : selected ? color : legendHighlighted || hovered ? "#f59e0b" : "#000000",
    );
    material.emissiveIntensity = isPreviewInvalid ? 0.3 : selected ? 0.35 : legendHighlighted || hovered ? 0.16 : 0;
    material.needsUpdate = true;
  }, [baseColor, hovered, invalid, legendHighlighted, selected]);

  const setRenderedPosition = useCallback((xMm: number, yMm: number) => {
    const x = (xMm + box.length_mm / 2) * SCALE;
    const y = (yMm + box.width_mm / 2) * SCALE;
    meshRef.current?.position.set(x, y, pz);
    outlineRef.current?.position.set(x, y, pz);
  }, [box.length_mm, box.width_mm, pz]);

  useEffect(() => {
    setRenderedPosition(box.x_mm, box.y_mm);
  }, [box.x_mm, box.y_mm, setRenderedPosition]);

  useEffect(() => {
    applyMaterial();
  }, [applyMaterial]);

  useEffect(() => {
    const controller: BoxPreviewController = {
      setPreview: (preview) => {
        setRenderedPosition(preview.x, preview.y);
        applyMaterial(preview.status);
      },
      clearPreview: () => {
        setRenderedPosition(box.x_mm, box.y_mm);
        applyMaterial();
      },
    };
    registerController(box.box_id, controller);
    return () => registerController(box.box_id, null);
  }, [applyMaterial, box.box_id, box.x_mm, box.y_mm, registerController, setRenderedPosition]);

  useEffect(() => () => {
    geometry.dispose();
    outlineGeometry.dispose();
  }, [geometry, outlineGeometry]);

  const isExactHit = useCallback((e: ThreeEvent<PointerEvent | MouseEvent>) => {
    return e.intersections[0]?.object === meshRef.current;
  }, []);

  return (
    <>
      <mesh
        ref={meshRef}
        position={[px, py, pz]}
        geometry={geometry}
        onClick={(e) => {
          if (!isExactHit(e)) return;
          e.stopPropagation();
          onClick(e, box);
        }}
        onPointerDown={(e) => {
          if (!isExactHit(e)) return;
          e.stopPropagation();
          if (editMode && !orbitActive) onPointerDown(e, box);
        }}
        onPointerMove={onDragMove}
        onPointerUp={onDragUp}
        onPointerCancel={onDragUp}
        onPointerOver={(e) => {
          if (!isExactHit(e)) return;
          e.stopPropagation();
          onHoverChange(box.box_id);
          if (editMode && !orbitActive) gl.domElement.style.cursor = "grab";
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          onHoverChange(null);
          gl.domElement.style.cursor = "auto";
        }}
        castShadow
      >
        <meshStandardMaterial
          ref={materialRef}
          color={baseColor}
          opacity={hovered || selected || legendHighlighted ? 1.0 : 0.82}
          transparent
          emissive={invalid ? "#ef4444" : selected ? baseColor : hovered || legendHighlighted ? "#f59e0b" : "#000000"}
          emissiveIntensity={invalid ? 0.3 : selected ? 0.35 : hovered || legendHighlighted ? 0.16 : 0}
        />
      </mesh>
      {showOutline && (
        <lineSegments ref={outlineRef} position={[px, py, pz]} geometry={outlineGeometry}>
          <lineBasicMaterial color={outlineColor} linewidth={3} transparent opacity={hovered && !selected && !invalid ? 0.78 : 1} />
        </lineSegments>
      )}
    </>
  );
});

// ── Orbit control with spacebar toggle ───────────────────────────────────────
function SpacebarOrbit({
  orbitActive, controlsRef,
  target,
}: {
  orbitActive: boolean;
  controlsRef: React.RefObject<any>;
  target: [number, number, number];
}) {
  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enabled={orbitActive}
      target={target}
      enableDamping
      dampingFactor={0.08}
    />
  );
}

// ── Main viewer ───────────────────────────────────────────────────────────────
export default function PalletViewer3D({
  pallet, palletSpec, layerFilter,
  editMode = false,
  settings = { edge_threshold_length_mm: 0, edge_threshold_width_mm: 0, snap_grid_mm: 50, drag_sensitivity: 0.35 },
  invalidBoxIds = new Set(),
  selectedBoxIds = new Set(),
  highlightedSku,
  colorBySku,
  snapToBoxEdges = false,
  snapToThreshold = false,
  unlockedMode = false,
  magneticSnapEnabled = false,
  magneticSnapStrength = 0.65,
  lockedRows = [],
  onBoxClick,
  onBoxDragEnd,
}: Props) {
  const [viewSelected, setViewSelected] = useState<BoxResult | null>(null);
  const [orbitActive, setOrbitActive] = useState(false);
  const [altUnlocked, setAltUnlocked] = useState(false);
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
  const [hoveredBoxId, setHoveredBoxId] = useState<string | null>(null);
  const controlsRef = useRef<any>(null);
  const boxControllers = useRef(new Map<string, BoxPreviewController>());

  // Drag state (refs to avoid re-renders during drag)
  const dragSession = useRef<DragSession | null>(null);
  const dragFrame = useRef<number | null>(null);
  const [dragPlaneZ, setDragPlaneZ] = useState<number | null>(null);

  const boxById = useMemo(() => new Map(pallet.boxes.map((box) => [box.box_id, box])), [pallet.boxes]);
  const visibleBoxes = useMemo(
    () => layerFilter ? pallet.boxes.filter((b) => b.layer === layerFilter) : pallet.boxes,
    [layerFilter, pallet.boxes],
  );
  const registerBoxController = useCallback((boxId: string, controller: BoxPreviewController | null) => {
    if (controller) boxControllers.current.set(boxId, controller);
    else boxControllers.current.delete(boxId);
  }, []);
  const handleHoverChange = useCallback((boxId: string | null) => {
    setHoveredBoxId((prev) => prev === boxId ? prev : boxId);
  }, []);

  const L = palletSpec.length_mm * SCALE;
  const W = palletSpec.width_mm * SCALE;
  const H = palletSpec.max_height_mm * SCALE;
  const cx = L / 2, cy = W / 2, cz = H / 2;
  const dist = Math.max(L, H) * 2.8;
  const layerGuideZ = useMemo(() => {
    if (!layerFilter || !editMode) return 0;
    if (layerFilter <= 1) return 0;
    const layerBoxes = pallet.boxes.filter((box) => box.layer === layerFilter);
    if (layerBoxes.length > 0) return Math.min(...layerBoxes.map((box) => box.z_mm));
    return 0;
  }, [editMode, layerFilter, pallet.boxes]);
  const effectiveUnlocked = unlockedMode || altUnlocked;

  const resetCamera = useCallback((view: "top" | "front" | "right" | "iso" = "iso") => {
    if (!controlsRef.current) return;
    const camera = controlsRef.current.object;
    const target = controlsRef.current.target;
    target.set(cx, cy, cz);
    if (view === "top") camera.position.set(cx, cy, Math.max(L, W, H) * 2.3);
    if (view === "front") camera.position.set(cx, cy - dist, cz);
    if (view === "right") camera.position.set(cx + dist, cy, cz);
    if (view === "iso") camera.position.set(cx + dist * 0.65, cy - dist * 0.85, cz + dist * 0.55);
    camera.up.set(0, 0, 1);
    controlsRef.current.update();
  }, [cx, cy, cz, dist, H, L, W]);

  // Spacebar listeners
  useEffect(() => {
    if (!editMode) return;
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        setOrbitActive(true);
      }
      if (e.altKey) setAltUnlocked(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setOrbitActive(false);
      }
      if (e.key === "Alt") setAltUnlocked(false);
    };
    const blur = () => setAltUnlocked(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [editMode]);

  const handleBoxClick = useCallback((e: ThreeEvent<MouseEvent>, box: BoxResult) => {
    e.stopPropagation();
    if (editMode && onBoxClick) {
      onBoxClick(box, e.ctrlKey || e.metaKey || e.shiftKey);
    } else {
      setViewSelected((prev) => prev?.box_id === box.box_id ? null : box);
    }
  }, [editMode, onBoxClick]);

  const buildCandidate = useCallback((session: DragSession, pointMm: { x: number; y: number }) => {
    const sensitivity = settings.drag_sensitivity ?? 0.35;
    const dx = (pointMm.x - session.dragStartPalletPoint.x) * sensitivity;
    const dy = (pointMm.y - session.dragStartPalletPoint.y) * sensitivity;
    const selectedBoxes = session.ids
      .map((id) => boxById.get(id))
      .filter((box): box is BoxResult => Boolean(box));

    if (selectedBoxes.length === 0) return null;

    const candidateBoxes = selectedBoxes.map((box) => {
      const start = session.startPositions.get(box.box_id) ?? { x: box.x_mm, y: box.y_mm };
      const x = start.x + dx;
      const y = start.y + dy;
      return {
        ...box,
        x_mm: effectiveUnlocked ? x : Math.round(x),
        y_mm: effectiveUnlocked ? y : Math.round(y),
      };
    });

    const minX = Math.min(...candidateBoxes.map((box) => box.x_mm));
    const minY = Math.min(...candidateBoxes.map((box) => box.y_mm));
    const maxX = Math.max(...candidateBoxes.map((box) => box.x_mm + box.length_mm));
    const maxY = Math.max(...candidateBoxes.map((box) => box.y_mm + box.width_mm));
    const nonSelected = pallet.boxes.filter((box) => !session.startPositions.has(box.box_id));
    const movingRect = { x: minX, y: minY, l: maxX - minX, w: maxY - minY };

    if (effectiveUnlocked) {
      const validation = validateBoxesLightweight(
        candidateBoxes,
        nonSelected,
        {
          length_mm: palletSpec.length_mm,
          width_mm: palletSpec.width_mm,
          max_height_mm: palletSpec.max_height_mm,
        },
        settings,
        { overlapToleranceMm: 2 },
      );
      return { boxes: candidateBoxes, validation, guides: [], status: validation.isValid ? "valid" as const : "invalid" as const };
    }

    const otherRects = nonSelected.map((box) => ({ x: box.x_mm, y: box.y_mm, l: box.length_mm, w: box.width_mm }));
    const snapped = magneticSnapEnabled
      ? applyMagneticSnap(
          { x: minX, y: minY },
          movingRect,
          otherRects,
          palletSpec,
          {
            magneticSnapEnabled: true,
            magneticSnapRadiusMm: 60,
            magneticSnapStrength,
            hardSnapRadiusMm: 8,
            snapGrid: settings.snap_grid_mm,
            snapToBoxEdges,
            snapToThreshold,
            thresholds: { length_mm: settings.edge_threshold_length_mm, width_mm: settings.edge_threshold_width_mm },
          },
        )
      : applySnappingDetailed(
          { x: minX, y: minY },
          movingRect,
          otherRects,
          palletSpec,
          { length_mm: settings.edge_threshold_length_mm, width_mm: settings.edge_threshold_width_mm },
          {
            snapGrid: settings.snap_grid_mm,
            snapToBoxEdges,
            snapToThreshold,
            tolerance: 25,
          },
        );
    const gapSnapped = snapToHorizontalGap(
      { x: snapped.x, y: snapped.y },
      { ...movingRect, x: snapped.x, y: snapped.y },
      nonSelected
        .filter((box) => Math.abs(box.z_mm - selectedBoxes[0].z_mm) < 1)
        .map((box) => ({ x: box.x_mm, y: box.y_mm, l: box.length_mm, w: box.width_mm })),
      palletSpec,
      { length_mm: settings.edge_threshold_length_mm, width_mm: settings.edge_threshold_width_mm },
      40,
    );
    const finalSnap = gapSnapped.snappedToGap ? gapSnapped : snapped;
    const snapDx = finalSnap.x - minX;
    const snapDy = finalSnap.y - minY;
    let snappedBoxes = candidateBoxes.map((box) => ({
      ...box,
      x_mm: Math.round(box.x_mm + snapDx),
      y_mm: Math.round(box.y_mm + snapDy),
    }));
    let validation = validateBoxesLightweight(
      snappedBoxes,
      nonSelected,
      {
        length_mm: palletSpec.length_mm,
        width_mm: palletSpec.width_mm,
        max_height_mm: palletSpec.max_height_mm,
      },
      settings,
      { overlapToleranceMm: 2 },
    );

    const overlapNeighbours = nonSelected.filter((box) => (
      Math.abs(box.z_mm - snappedBoxes[0].z_mm) < 1 &&
      snappedBoxes.some((moving) => boxesOverlapMm(moving, box, 2))
    ));
    if (!validation.isValid && snappedBoxes.length === 1 && overlapNeighbours.length === 1) {
      const moving = snappedBoxes[0];
      const neighbour = overlapNeighbours[0];
      const shiftDirection = moving.x_mm + moving.length_mm / 2 <= neighbour.x_mm + neighbour.length_mm / 2 ? 1 : -1;
      const shiftedNeighbour = {
        ...neighbour,
        x_mm: neighbour.x_mm + shiftDirection * moving.length_mm,
      };
      const rest = nonSelected.filter((box) => box.box_id !== neighbour.box_id);
      const shiftedValidation = validateBoxesLightweight(
        [moving, shiftedNeighbour],
        rest,
        {
          length_mm: palletSpec.length_mm,
          width_mm: palletSpec.width_mm,
          max_height_mm: palletSpec.max_height_mm,
        },
        settings,
        { overlapToleranceMm: 2 },
      );
      if (shiftedValidation.isValid) {
        snappedBoxes = [moving, shiftedNeighbour];
        validation = shiftedValidation;
      }
    }

    return {
      boxes: snappedBoxes,
      validation,
      guides: [...snapped.guides, ...gapSnapped.guides],
      status: !validation.isValid ? "invalid" as const : snapped.guides.length > 0 || gapSnapped.guides.length > 0 ? "snapped" as const : "valid" as const,
    };
  }, [boxById, effectiveUnlocked, pallet.boxes, palletSpec, settings, snapToBoxEdges, snapToThreshold]);

  const flushDragPreview = useCallback(() => {
    dragFrame.current = null;
    const session = dragSession.current;
    if (!session || !session.latestPointMm) return;

    const candidate = buildCandidate(session, session.latestPointMm);
    if (!candidate) return;

    for (const id of Array.from(session.previewIds)) {
      if (!candidate.boxes.some((box) => box.box_id === id)) {
        boxControllers.current.get(id)?.clearPreview();
      }
    }
    session.previewIds = new Set(candidate.boxes.map((box) => box.box_id));

    for (const box of candidate.boxes) {
      boxControllers.current.get(box.box_id)?.setPreview({
        x: box.x_mm,
        y: box.y_mm,
        status: candidate.status,
      });
    }
    setSnapGuides(candidate.guides);

    if (candidate.validation.isValid) {
      session.lastValid = new Map(candidate.boxes.map((box) => [
        box.box_id,
        { x: box.x_mm, y: box.y_mm },
      ]));
    }
  }, [buildCandidate]);

  const scheduleDragPreview = useCallback((pointMm: { x: number; y: number }) => {
    const session = dragSession.current;
    if (!session) return;
    session.latestPointMm = pointMm;
    if (dragFrame.current !== null) return;
    dragFrame.current = window.requestAnimationFrame(flushDragPreview);
  }, [flushDragPreview]);

  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>, box: BoxResult) => {
    if (!editMode || orbitActive) return;
    e.stopPropagation();
    (e.target as Element | null)?.setPointerCapture?.(e.pointerId);
    onBoxClick?.(box, e.ctrlKey || e.metaKey || e.shiftKey);
    const hit = intersectPlanePoint(e, box.z_mm);
    if (!hit) return;

    let ids = selectedBoxIds.has(box.box_id)
      ? Array.from(selectedBoxIds)
      : [box.box_id];

    // Expand selection to entire locked row so the row moves as a unit
    if (lockedRows.length > 0) {
      const { boxIds: expandedIds } = getMovableSelection(box.box_id, ids, lockedRows);
      ids = expandedIds.filter((id) => pallet.boxes.some((b) => b.box_id === id));
    }

    const startMap = new Map<string, { x: number; y: number }>();
    for (const id of ids) {
      const b = pallet.boxes.find((b) => b.box_id === id);
      if (b) startMap.set(id, { x: b.x_mm, y: b.y_mm });
    }
    dragSession.current = {
      ids,
      clickedBoxId: box.box_id,
      planeZMm: box.z_mm,
      dragStartPalletPoint: hit,
      startPositions: startMap,
      lastValid: new Map(startMap),
      previewIds: new Set(),
      latestPointMm: hit,
    };
    setDragPlaneZ(box.z_mm * SCALE);
    setSnapGuides([]);
    scheduleDragPreview(hit);
  }, [editMode, orbitActive, onBoxClick, pallet.boxes, scheduleDragPreview, selectedBoxIds]);

  const handleDragMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    const session = dragSession.current;
    if (!session) return;
    e.stopPropagation();
    const hit = intersectPlanePoint(e, session.planeZMm);
    if (hit) scheduleDragPreview(hit);
  }, [scheduleDragPreview]);

  const handleDragUp = useCallback((e: ThreeEvent<PointerEvent>) => {
    const session = dragSession.current;
    if (!session) return;
    e.stopPropagation();
    if (dragFrame.current !== null) {
      window.cancelAnimationFrame(dragFrame.current);
      dragFrame.current = null;
    }

    let commitPositions = session.lastValid;
    if (session.latestPointMm) {
      const candidate = buildCandidate(session, session.latestPointMm);
      if (candidate && candidate.validation.isValid) {
        const candidatePallet: PalletResult = {
          ...pallet,
          boxes: pallet.boxes.map((box) => {
            const moved = candidate.boxes.find((candidateBox) => candidateBox.box_id === box.box_id);
            return moved ?? box;
          }),
        };
        const fullValidation = validateLayout(
          [candidatePallet],
          {
            length_mm: palletSpec.length_mm,
            width_mm: palletSpec.width_mm,
            max_height_mm: palletSpec.max_height_mm,
            max_weight_kg: palletSpec.max_weight_kg ?? Number.POSITIVE_INFINITY,
          },
          settings,
        );
        if (fullValidation.isValid) {
          commitPositions = new Map(candidate.boxes.map((box) => [
            box.box_id,
            { x: box.x_mm, y: box.y_mm },
          ]));
        }
      }
    }

    const moves = Array.from(commitPositions.entries())
      .filter(([box_id, pos]) => {
        const start = session.startPositions.get(box_id);
        return !start || start.x !== pos.x || start.y !== pos.y;
      })
      .map(([box_id, pos]) => ({
        box_id,
        x: pos.x,
        y: pos.y,
      }));

    dragSession.current = null;
    setDragPlaneZ(null);
    for (const id of Array.from(session.previewIds)) boxControllers.current.get(id)?.clearPreview();
    setSnapGuides([]);

    if (moves.length > 0) {
      onBoxDragEnd?.(moves);
    }
  }, [buildCandidate, onBoxDragEnd, pallet, palletSpec, settings]);

  useEffect(() => () => {
    if (dragFrame.current !== null) window.cancelAnimationFrame(dragFrame.current);
  }, []);

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

        {/* Pallet envelope */}
        <lineSegments position={[cx, cy, cz]}>
          <edgesGeometry args={[new THREE.BoxGeometry(L, W, H)]} />
          <lineBasicMaterial color="#94a3b8" transparent opacity={0.3} />
        </lineSegments>

        {/* Edge threshold rectangle */}
        <ThresholdRect
          palletL={palletSpec.length_mm}
          palletW={palletSpec.width_mm}
          tl={settings.edge_threshold_length_mm}
          tw={settings.edge_threshold_width_mm}
        />

        <LayerGuideGrid
          palletLengthMm={palletSpec.length_mm}
          palletWidthMm={palletSpec.width_mm}
          zMm={layerGuideZ}
          gridMm={settings.snap_grid_mm}
          edgeThresholdLengthMm={settings.edge_threshold_length_mm}
          edgeThresholdWidthMm={settings.edge_threshold_width_mm}
          visible={editMode && layerFilter !== null && layerFilter !== undefined}
        />

        {snapGuides.map((guide, index) => {
          const z = Math.max(0, layerGuideZ + 3) * SCALE;
          const points: [number, number, number][] = guide.axis === "x"
            ? [[guide.value * SCALE, 0, z], [guide.value * SCALE, palletSpec.width_mm * SCALE, z]]
            : [[0, guide.value * SCALE, z], [palletSpec.length_mm * SCALE, guide.value * SCALE, z]];
          return (
            <Line
              key={`${guide.axis}-${guide.value}-${guide.source}-${index}`}
              points={points}
              color={
                guide.source === "gap"
                  ? (guide.magnetic ? "#86efac" : "#22c55e")
                  : guide.source === "box"
                  ? (guide.magnetic ? "#93c5fd" : "#2563eb")
                  : (guide.magnetic ? "#94a3b8" : "#f59e0b")
              }
              lineWidth={2}
              transparent
              opacity={0.8}
            />
          );
        })}

        {/* Drag capture plane */}
        {dragPlaneZ !== null && (
          <DragPlane
            z={dragPlaneZ}
            onMove={handleDragMove}
            onUp={handleDragUp}
          />
        )}

        {/* Box meshes */}
        {visibleBoxes.map((box) => (
          <BoxMesh
            key={box.box_id}
            box={box}
            selected={editMode ? selectedBoxIds.has(box.box_id) : viewSelected?.box_id === box.box_id}
            hovered={hoveredBoxId === box.box_id}
            invalid={invalidBoxIds.has(box.box_id)}
            legendHighlighted={highlightedSku === box.sku}
            isLockedRow={isBoxInLockedRow(box.box_id, lockedRows)}
            editMode={editMode}
            orbitActive={orbitActive}
            colorBySku={colorBySku}
            registerController={registerBoxController}
            onHoverChange={handleHoverChange}
            onPointerDown={handlePointerDown}
            onDragMove={handleDragMove}
            onDragUp={handleDragUp}
            onClick={handleBoxClick}
          />
        ))}

        <SpacebarOrbit
          orbitActive={!editMode || orbitActive}
          controlsRef={controlsRef}
          target={[cx, cy, cz]}
        />

        <gridHelper
          args={[Math.max(L, W) * 1.5, 12, "#e2e8f0", "#e2e8f0"]}
          position={[cx, cy, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        />
      </Canvas>

      {editMode && (
        <div className={`absolute top-2 left-2 text-xs px-2 py-1 rounded font-medium pointer-events-none ${orbitActive ? "bg-amber-400 text-amber-900" : "bg-blue-600 text-white"}`}>
          {orbitActive ? "Orbit: release Space to drag" : effectiveUnlocked ? "Unlocked Mode: free move" : "Locked Mode: snap + gap insert"}
        </div>
      )}

      {editMode && (
        <div className="absolute top-2 right-2 flex gap-1 rounded bg-white/90 p-1 shadow border border-gray-200">
          {(["top", "front", "right", "iso"] as const).map((view) => (
            <button
              key={view}
              type="button"
              onClick={() => resetCamera(view)}
              className="px-2 py-1 text-xs font-medium text-gray-700 rounded hover:bg-gray-100 capitalize"
            >
              {view === "iso" ? "Isometric" : view}
            </button>
          ))}
        </div>
      )}

      <button
        className="absolute bottom-3 left-3 bg-white border border-gray-300 text-xs px-3 py-1.5 rounded shadow hover:bg-gray-50"
        onClick={() => resetCamera("iso")}
      >
        Reset Camera
      </button>

      {!editMode && (
        <BoxInspectorPanel box={viewSelected} onClose={() => setViewSelected(null)} />
      )}
    </div>
  );
}
