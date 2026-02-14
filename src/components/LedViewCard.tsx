"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent,
  type PointerEvent,
  type RefObject
} from "react";

import { projectSceneToViewport, screenToScenePoint } from "@/rendering/visualizerViewport";
import type { StudioState } from "@/state/studioStore";
import type { StripSegmentAllocation, VisualizationProject } from "@/types/studio";

interface LedViewCardProps {
  canvasRef: RefObject<HTMLCanvasElement>;
  ledCount: number;
  simulatedMillis: number;
  simTickRate: number;
  lastError: string;
  visualization: VisualizationProject;
  segmentCount: number;
  ledViewHeightPx: number;
  setLedViewHeight: StudioState["setLedViewHeight"];
  addSegment: StudioState["addSegment"];
  setVisualizationEnabled: StudioState["setVisualizationEnabled"];
  setVisualizationLedOpacity: StudioState["setVisualizationLedOpacity"];
  setVisualizationBackground: StudioState["setVisualizationBackground"];
  setVisualizationViewport: StudioState["setVisualizationViewport"];
  resetVisualizationViewport: StudioState["resetVisualizationViewport"];
  startVisualizationStrip: StudioState["startVisualizationStrip"];
  addVisualizationPoint: StudioState["addVisualizationPoint"];
  finishVisualizationStrip: StudioState["finishVisualizationStrip"];
  cancelVisualizationStrip: StudioState["cancelVisualizationStrip"];
  removeVisualizationStrip: StudioState["removeVisualizationStrip"];
  setStripSegmentAllocations: StudioState["setStripSegmentAllocations"];
  updateVisualizationStripLedCount: StudioState["updateVisualizationStripLedCount"];
  importVisualizationProject: StudioState["importVisualizationProject"];
  exportVisualizationProject: StudioState["exportVisualizationProject"];
  onViewportMetrics?: (metrics: { width: number; height: number }) => void;
}

function downloadJson(filename: string, payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

interface PanState {
  startX: number;
  startY: number;
  panX: number;
  panY: number;
}

interface ResizeState {
  startY: number;
  startHeight: number;
}

export function LedViewCard({
  canvasRef,
  ledCount,
  simulatedMillis,
  simTickRate,
  lastError,
  visualization,
  segmentCount,
  ledViewHeightPx,
  setLedViewHeight,
  addSegment,
  setVisualizationEnabled,
  setVisualizationLedOpacity,
  setVisualizationBackground,
  setVisualizationViewport,
  resetVisualizationViewport,
  startVisualizationStrip,
  addVisualizationPoint,
  finishVisualizationStrip,
  cancelVisualizationStrip,
  removeVisualizationStrip,
  setStripSegmentAllocations,
  updateVisualizationStripLedCount,
  importVisualizationProject,
  exportVisualizationProject,
  onViewportMetrics
}: LedViewCardProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [overlaySize, setOverlaySize] = useState({ width: 1, height: 1 });
  const [panState, setPanState] = useState<PanState | null>(null);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const [stripConfigCollapsed, setStripConfigCollapsed] = useState(false);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    const updateSize = () => {
      const width = Math.max(1, overlay.clientWidth);
      const height = Math.max(1, overlay.clientHeight);
      setOverlaySize({
        width,
        height
      });
      onViewportMetrics?.({ width, height });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(overlay);
    return () => observer.disconnect();
  }, [onViewportMetrics]);

  const visualSvgLines = useMemo(
    () => (visualization.draftPoints.length >= 2 ? [{ id: "draft", points: visualization.draftPoints }] : []),
    [visualization.draftPoints]
  );

  const onOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!visualization.drawing) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const [sceneX, sceneY] = screenToScenePoint(
      event.clientX - rect.left,
      event.clientY - rect.top,
      visualization.viewport,
      rect.width,
      rect.height
    );
    addVisualizationPoint(sceneX, sceneY);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (visualization.drawing) return;
    if (event.button !== 0) return;
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    setPanState({
      startX: event.clientX,
      startY: event.clientY,
      panX: visualization.viewport.panX,
      panY: visualization.viewport.panY
    });
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!panState) return;
    const width = Math.max(1, overlaySize.width);
    const height = Math.max(1, overlaySize.height);
    const deltaX = (event.clientX - panState.startX) / width;
    const deltaY = (event.clientY - panState.startY) / height;
    setVisualizationViewport(visualization.viewport.zoom, panState.panX + deltaX, panState.panY + deltaY);
  };

  const stopPanning = () => {
    setPanState(null);
  };

  const onResizeDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    setResizeState({
      startY: event.clientY,
      startHeight: ledViewHeightPx
    });
  };

  const onResizeMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!resizeState) return;
    const nextHeight = resizeState.startHeight + (event.clientY - resizeState.startY);
    setLedViewHeight(nextHeight);
  };

  const stopResize = () => setResizeState(null);

  const updateAllocations = (stripId: string, allocations: StripSegmentAllocation[]) => {
    setStripSegmentAllocations(
      stripId,
      allocations.map((entry) => ({
        segmentIndex: Math.max(0, Math.round(entry.segmentIndex)),
        share: Math.max(0.0001, Number(entry.share) || 0)
      }))
    );
  };

  return (
    <section className="panelShell cardSection">
      <div className="sectionHeaderRow">
        <h2 className="sectionLabel">LEDs View</h2>
        <div className="viewMeta">
          <span>{ledCount} LEDs</span>
          <span>{simulatedMillis}ms</span>
          <span>{simTickRate} TPS</span>
          <span className={lastError ? "errorText" : "okText"}>{lastError ? "Engine Error" : "Healthy"}</span>
        </div>
      </div>

      <div className="ledViewToolbar actions">
        <label className="segmentCheckRow">
          <input type="checkbox" checked={visualization.enabled} onChange={(event) => setVisualizationEnabled(event.target.checked)} />
          <span>Enable mapped view</span>
        </label>
        <label className="fieldLabel ledOpacityField">
          LED opacity
          <select value={Math.round(visualization.ledOpacity * 100)} onChange={(event) => setVisualizationLedOpacity(Number(event.target.value) / 100)}>
            <option value={80}>80%</option>
            <option value={100}>100%</option>
          </select>
        </label>

        <label className="pillButton ledUploadButton">
          Upload image
          <input
            type="file"
            accept="image/*"
            onChange={async (event: ChangeEvent<HTMLInputElement>) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result));
                reader.onerror = reject;
                reader.readAsDataURL(file);
              });
              const image = new Image();
              image.src = dataUrl;
              image.onload = () => {
                setVisualizationBackground({
                  name: file.name,
                  dataUrl,
                  width: image.naturalWidth,
                  height: image.naturalHeight
                });
              };
              event.target.value = "";
            }}
          />
        </label>

        <button type="button" className="pillButton" onClick={startVisualizationStrip}>
          Start strip
        </button>
        <button type="button" className="pillButton" onClick={finishVisualizationStrip}>
          Finish strip
        </button>
        <button type="button" className="pillButton" onClick={cancelVisualizationStrip}>
          Cancel strip
        </button>
        <button
          type="button"
          className="pillButton"
          onClick={() => setVisualizationViewport(visualization.viewport.zoom * 1.2, visualization.viewport.panX, visualization.viewport.panY)}
        >
          Zoom +
        </button>
        <button
          type="button"
          className="pillButton"
          onClick={() => setVisualizationViewport(visualization.viewport.zoom / 1.2, visualization.viewport.panX, visualization.viewport.panY)}
        >
          Zoom -
        </button>
        <button type="button" className="pillButton" onClick={resetVisualizationViewport}>
          Reset view
        </button>
        <button type="button" className="pillButton" onClick={() => downloadJson("visualization.json", JSON.parse(exportVisualizationProject()))}>
          Export
        </button>
        <label className="pillButton ledUploadButton">
          Import
          <input
            type="file"
            accept="application/json,.json"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              try {
                const text = await file.text();
                const parsed = JSON.parse(text) as Partial<VisualizationProject>;
                importVisualizationProject(parsed);
              } catch {
                importVisualizationProject({});
              }
              event.target.value = "";
            }}
          />
        </label>
      </div>

      <div
        ref={overlayRef}
        className="ledViewViewport ledViewInteractive"
        onClick={onOverlayClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stopPanning}
        onPointerCancel={stopPanning}
        style={{ height: `${ledViewHeightPx}px`, cursor: visualization.drawing ? "crosshair" : panState ? "grabbing" : "grab" }}
      >
        <canvas ref={canvasRef} className="studioCanvas" style={{ height: "100%" }} />
        {visualization.background ? (
          <img
            src={visualization.background.dataUrl}
            alt={visualization.background.name}
            className="ledOverlayImage"
            style={{
              transform: `translate(${visualization.viewport.panX * 100}%, ${visualization.viewport.panY * 100}%) scale(${visualization.viewport.zoom})`
            }}
          />
        ) : null}
        <svg className="ledOverlaySvg" width="100%" height="100%">
          {visualSvgLines.map((line) => (
            <polyline
              key={line.id}
              points={line.points
                .map(([x, y]) => projectSceneToViewport([x, y], visualization.viewport, overlaySize.width, overlaySize.height))
                .map(([sx, sy]) => `${sx},${sy}`)
                .join(" ")}
              stroke={line.id === "draft" ? "#ffe082" : "#7ad887"}
              strokeWidth={3}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </svg>
      </div>

      <div
        className="ledResizeHandle"
        onPointerDown={onResizeDown}
        onPointerMove={onResizeMove}
        onPointerUp={stopResize}
        onPointerCancel={stopResize}
        role="separator"
        aria-label="Resize LEDs view"
      />
      <div className="sectionHeaderRow ledStripConfigHeader">
        <h3 className="columnTitle">LED Strip Configuration</h3>
        <button type="button" className="pillButton" onClick={() => setStripConfigCollapsed((prev) => !prev)} aria-expanded={!stripConfigCollapsed}>
          {stripConfigCollapsed ? "Expand" : "Collapse"}
        </button>
      </div>

      {!stripConfigCollapsed ? <div className="segmentCardsList ledVisualizerList">
        {visualization.strips.map((strip) => {
          const link = visualization.links.find((entry) => entry.stripId === strip.id);
          const allocations = link?.allocations ?? [{ segmentIndex: 0, share: 1 }];
          return (
            <section key={strip.id} className="segmentPanel">
              <div className="segmentHeaderBar">
                <button type="button" className="segmentHeaderButton" onClick={() => removeVisualizationStrip(strip.id)}>
                  {strip.id}
                </button>
                <button type="button" className="segmentIconButton" onClick={() => removeVisualizationStrip(strip.id)}>
                  -
                </button>
              </div>

              <label className="fieldLabel">
                LED count
                <input
                  type="number"
                  min={1}
                  value={strip.ledCount || 1}
                  onChange={(event) => updateVisualizationStripLedCount(strip.id, Number(event.target.value))}
                />
              </label>

              <div className="allocationList">
                {allocations.map((allocation, idx) => (
                  <div key={`${strip.id}-${idx}`} className="allocationRow">
                    <label className="fieldLabel">
                      Segment
                      <select
                        value={allocation.segmentIndex}
                        onChange={(event) => {
                          const next = allocations.slice();
                          next[idx] = { ...next[idx]!, segmentIndex: Number(event.target.value) };
                          updateAllocations(strip.id, next);
                        }}
                      >
                        {new Array(segmentCount).fill(0).map((_, index) => (
                          <option key={index} value={index}>
                            Segment {index}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="fieldLabel">
                      Share %
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={Math.max(1, Math.round(allocation.share * 100))}
                        onChange={(event) => {
                          const next = allocations.slice();
                          next[idx] = { ...next[idx]!, share: (Number(event.target.value) || 1) / 100 };
                          updateAllocations(strip.id, next);
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className="segmentIconButton"
                      onClick={() => {
                        if (allocations.length <= 1) return;
                        const next = allocations.filter((_, allocIdx) => allocIdx !== idx);
                        updateAllocations(strip.id, next);
                      }}
                      disabled={allocations.length <= 1}
                    >
                      -
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="pillButton"
                onClick={() => {
                  const needsNewSegment = allocations.length >= segmentCount;
                  const targetSegmentIndex = needsNewSegment ? segmentCount : allocations.length;
                  if (needsNewSegment) {
                    addSegment();
                  }
                  updateAllocations(strip.id, [...allocations, { segmentIndex: targetSegmentIndex, share: 1 / (allocations.length + 1) }]);
                }}
              >
                + Allocation
              </button>
            </section>
          );
        })}
      </div> : null}
    </section>
  );
}
