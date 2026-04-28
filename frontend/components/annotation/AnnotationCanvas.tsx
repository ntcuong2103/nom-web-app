"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Image as KonvaImage, Layer, Rect, Stage, Transformer } from "react-konva";
import type Konva from "konva";
import { Hand, MousePointer2, ZoomIn, ZoomOut } from "lucide-react";
import { Annotation, AnnotationDraft, ImageRecord } from "@/lib/types";
import { imageFileUrl } from "@/lib/api";

type Props = {
  image: ImageRecord;
  annotations: Annotation[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onCreate: (draft: AnnotationDraft) => void;
  onChange: (id: number, changes: Partial<AnnotationDraft>) => void;
};

export function AnnotationCanvas({ image, annotations, selectedId, onSelect, onCreate, onChange }: Props) {
  const [bitmap, setBitmap] = useState<HTMLImageElement | null>(null);
  const [draft, setDraft] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const [panOrigin, setPanOrigin] = useState<{ x: number; y: number } | null>(null);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [tool, setTool] = useState<"draw" | "pan">("draw");
  const [zoom, setZoom] = useState(1);
  const selectedShape = useRef<Konva.Rect>(null);
  const transformer = useRef<Konva.Transformer>(null);
  const scale = useMemo(() => Math.min(960 / image.width, 640 / image.height, 1), [image.height, image.width]);
  const displayScale = scale * zoom;
  const stageWidth = Math.max(320, Math.round(image.width * scale));
  const stageHeight = Math.max(240, Math.round(image.height * scale));
  const imageDisplayWidth = image.width * displayScale;
  const imageDisplayHeight = image.height * displayScale;

  useEffect(() => {
    const next = new window.Image();
    next.src = imageFileUrl(image.id);
    next.onload = () => setBitmap(next);
  }, [image.id]);

  useEffect(() => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
    setPanOrigin(null);
  }, [image.id]);

  useEffect(() => {
    setPanOffset((current) => clampPanOffset(current));
  }, [displayScale, stageHeight, stageWidth]);

  useEffect(() => {
    if (selectedShape.current && transformer.current) {
      transformer.current.nodes([selectedShape.current]);
      transformer.current.getLayer()?.batchDraw();
    }
  }, [selectedId]);

  function pointer(stage: Konva.Stage) {
    const position = stage.getPointerPosition();
    if (!position) return null;
    const point = { x: (position.x - panOffset.x) / displayScale, y: (position.y - panOffset.y) / displayScale };
    if (point.x < 0 || point.y < 0 || point.x > image.width || point.y > image.height) return null;
    return point;
  }

  function clampPanOffset(next: { x: number; y: number }) {
    const minX = Math.min(0, stageWidth - imageDisplayWidth);
    const minY = Math.min(0, stageHeight - imageDisplayHeight);
    const maxX = Math.max(0, (stageWidth - imageDisplayWidth) / 2);
    const maxY = Math.max(0, (stageHeight - imageDisplayHeight) / 2);
    const x = imageDisplayWidth <= stageWidth ? maxX : Math.min(0, Math.max(minX, next.x));
    const y = imageDisplayHeight <= stageHeight ? maxY : Math.min(0, Math.max(minY, next.y));
    return { x, y };
  }

  return (
    <div className="rounded-md border border-line bg-white p-3">
      <div className="mb-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setTool("draw")}
          className={`rounded border p-2 ${tool === "draw" ? "border-clay bg-field text-ink" : "border-line text-ink"}`}
          aria-label="Draw annotations"
          title="Draw annotations"
        >
          <MousePointer2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setTool("pan")}
          className={`rounded border p-2 ${tool === "pan" ? "border-clay bg-field text-ink" : "border-line text-ink"}`}
          aria-label="Pan image"
          title="Pan image"
        >
          <Hand className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setZoom((current) => Math.max(0.25, current - 0.25))}
          disabled={zoom <= 0.25}
          className="rounded border border-line p-2 text-ink disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Zoom out"
          title="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <span className="min-w-14 text-center text-sm text-moss">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          onClick={() => setZoom((current) => Math.min(4, current + 0.25))}
          disabled={zoom >= 4}
          className="rounded border border-line p-2 text-ink disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Zoom in"
          title="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
      </div>
      <div className="overflow-auto">
        <Stage
          width={stageWidth}
          height={stageHeight}
          className="bg-field"
          onMouseDown={(event) => {
            if (event.target !== event.target.getStage()) return;
            const stage = event.target.getStage()!;
            if (tool === "pan") {
              const position = stage.getPointerPosition();
              if (position) setPanOrigin(position);
              return;
            }
            onSelect(null);
            const point = pointer(stage);
            if (!point) return;
            setOrigin(point);
            setDraft({ x: point.x, y: point.y, w: 0, h: 0 });
          }}
          onMouseMove={(event) => {
            const stage = event.target.getStage()!;
            if (panOrigin) {
              const position = stage.getPointerPosition();
              if (!position) return;
              setPanOffset((current) =>
                clampPanOffset({ x: current.x + position.x - panOrigin.x, y: current.y + position.y - panOrigin.y })
              );
              setPanOrigin(position);
              return;
            }
            if (!origin) return;
            const point = pointer(stage);
            if (!point) return;
            setDraft({
              x: Math.min(origin.x, point.x),
              y: Math.min(origin.y, point.y),
              w: Math.abs(point.x - origin.x),
              h: Math.abs(point.y - origin.y)
            });
          }}
          onMouseUp={() => {
            setPanOrigin(null);
            if (draft && draft.w > 4 && draft.h > 4) onCreate({ ...draft, label: "unlabeled", status: "active" });
            setDraft(null);
            setOrigin(null);
          }}
          onMouseLeave={() => {
            setPanOrigin(null);
            setDraft(null);
            setOrigin(null);
          }}
          onWheel={(event) => {
            event.evt.preventDefault();
            setPanOffset((current) => clampPanOffset({ x: current.x - event.evt.deltaX, y: current.y - event.evt.deltaY }));
          }}
        >
          <Layer x={panOffset.x} y={panOffset.y} scaleX={displayScale} scaleY={displayScale}>
            {bitmap ? <KonvaImage image={bitmap} width={image.width} height={image.height} listening={false} /> : null}
            {annotations.filter((annotation) => annotation.status !== "deleted").map((annotation) => (
              <Rect
                key={annotation.id}
                ref={annotation.id === selectedId ? selectedShape : undefined}
                x={annotation.x}
                y={annotation.y}
                width={annotation.w}
                height={annotation.h}
                stroke={annotation.id === selectedId ? "#b85f42" : "#4d6857"}
                strokeWidth={2 / displayScale}
                draggable={tool === "draw"}
                listening={tool === "draw"}
                onClick={() => onSelect(annotation.id)}
                onTap={() => onSelect(annotation.id)}
                onDragEnd={(event) => onChange(annotation.id, { x: event.target.x(), y: event.target.y() })}
                onTransformEnd={(event) => {
                  const node = event.target;
                  const next = {
                    x: node.x(),
                    y: node.y(),
                    w: Math.max(4, node.width() * node.scaleX()),
                    h: Math.max(4, node.height() * node.scaleY())
                  };
                  node.scaleX(1);
                  node.scaleY(1);
                  onChange(annotation.id, next);
                }}
              />
            ))}
            {draft ? <Rect {...draft} stroke="#b85f42" dash={[6, 4]} strokeWidth={2 / displayScale} listening={false} /> : null}
            {selectedId && tool === "draw" ? <Transformer ref={transformer} rotateEnabled={false} /> : null}
          </Layer>
        </Stage>
      </div>
    </div>
  );
}
