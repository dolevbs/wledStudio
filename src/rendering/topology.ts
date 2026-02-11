import type { GapRange, StudioTopology } from "@/types/studio";

function sortedGaps(gaps: GapRange[]): GapRange[] {
  return [...gaps].sort((a, b) => a.start - b.start);
}

export function buildPhysicalIndexMap(ledCount: number, gaps: GapRange[]): number[] {
  const map: number[] = [];
  const normalizedGaps = sortedGaps(gaps);
  let gapCursor = 0;
  let gapOffset = 0;

  for (let logicalIndex = 0; logicalIndex < ledCount; logicalIndex += 1) {
    while (gapCursor < normalizedGaps.length && normalizedGaps[gapCursor].start <= logicalIndex) {
      gapOffset += normalizedGaps[gapCursor].length;
      gapCursor += 1;
    }
    map.push(logicalIndex + gapOffset);
  }

  return map;
}

export function buildLedPositions(topology: StudioTopology): Array<[number, number, number]> {
  const physicalIndexMap = topology.physicalIndexMap ?? buildPhysicalIndexMap(topology.ledCount, topology.gaps);

  if (topology.mode === "strip") {
    const totalSlots = Math.max(1, topology.ledCount + topology.gaps.reduce((sum, gap) => sum + gap.length, 0));
    const center = (totalSlots - 1) / 2;
    return physicalIndexMap.map((physicalIndex) => [physicalIndex - center, 0, 0]);
  }

  return physicalIndexMap.map((physicalIndex, logicalIndex) => {
    const row = Math.floor(physicalIndex / topology.width);
    let column = physicalIndex % topology.width;

    if (topology.serpentine && row % 2 === 1) {
      column = topology.width - 1 - column;
    }

    const centeredX = column - (topology.width - 1) / 2;
    const centeredY = (topology.height - 1) / 2 - row;

    if (logicalIndex >= topology.width * topology.height) {
      return [centeredX, centeredY - Math.floor(logicalIndex / topology.width), 0] as [number, number, number];
    }

    return [centeredX, centeredY, 0] as [number, number, number];
  });
}
