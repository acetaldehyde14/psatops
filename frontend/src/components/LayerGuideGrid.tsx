import { Line } from "@react-three/drei";

export const SCALE = 0.001;

interface Props {
  palletLengthMm: number;
  palletWidthMm: number;
  zMm: number;
  gridMm: number;
  edgeThresholdLengthMm: number;
  edgeThresholdWidthMm: number;
  visible: boolean;
}

function linePoints(
  a: [number, number, number],
  b: [number, number, number],
): [number, number, number][] {
  return [a, b];
}

export default function LayerGuideGrid({
  palletLengthMm,
  palletWidthMm,
  zMm,
  gridMm,
  edgeThresholdLengthMm,
  edgeThresholdWidthMm,
  visible,
}: Props) {
  if (!visible) return null;

  const z = Math.max(0, zMm - 2) * SCALE;
  const length = palletLengthMm * SCALE;
  const width = palletWidthMm * SCALE;
  const thresholdLength = edgeThresholdLengthMm * SCALE;
  const thresholdWidth = edgeThresholdWidthMm * SCALE;
  const usableMaxX = Math.max(thresholdLength, length - thresholdLength);
  const usableMaxY = Math.max(thresholdWidth, width - thresholdWidth);
  const step = Math.max(gridMm, 25) * SCALE;

  const gridLines: Array<[[number, number, number], [number, number, number]]> = [];
  for (let x = thresholdLength; x <= usableMaxX + 0.0001; x += step) {
    gridLines.push([[x, thresholdWidth, z], [x, usableMaxY, z]]);
  }
  for (let y = thresholdWidth; y <= usableMaxY + 0.0001; y += step) {
    gridLines.push([[thresholdLength, y, z], [usableMaxX, y, z]]);
  }

  const palletBoundary: [number, number, number][] = [
    [0, 0, z],
    [length, 0, z],
    [length, width, z],
    [0, width, z],
    [0, 0, z],
  ];
  const usableBoundary: [number, number, number][] = [
    [thresholdLength, thresholdWidth, z],
    [usableMaxX, thresholdWidth, z],
    [usableMaxX, usableMaxY, z],
    [thresholdLength, usableMaxY, z],
    [thresholdLength, thresholdWidth, z],
  ];

  return (
    <group>
      {gridLines.map(([a, b], index) => (
        <Line
          key={`${a[0]}-${a[1]}-${b[0]}-${b[1]}-${index}`}
          points={linePoints(a, b)}
          color="#cbd5e1"
          lineWidth={1}
          transparent
          opacity={0.45}
        />
      ))}
      <Line points={palletBoundary} color="#64748b" lineWidth={1.5} transparent opacity={0.75} />
      <Line points={usableBoundary} color="#f59e0b" lineWidth={2} dashed dashSize={0.02} gapSize={0.012} />
    </group>
  );
}
