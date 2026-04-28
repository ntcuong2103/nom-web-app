"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Image as KonvaImage, Layer, Rect, Stage, Transformer } from "react-konva";
import type Konva from "konva";
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
  const selectedShape = useRef<Konva.Rect>(null);
  const transformer = useRef<Konva.Transformer>(null);
  const scale = useMemo(() => Math.min(960 / image.width, 640 / image.height, 1), [image.height, image.width]);
  const stageWidth = Math.max(320, Math.round(image.width * scale));
  const stageHeight = Math.max(240, Math.round(image.height * scale));

  useEffect(() => {
    const next = new window.Image();
    next.src = imageFileUrl(image.id);
    next.onload = () => setBitmap(next);
  }, [image.id]);

  useEffect(() => {
    if (selectedShape.current && transformer.current) {
      transformer.current.nodes([selectedShape.current]);
      transformer.current.getLayer()?.batchDraw();
    }
  }, [selectedId]);

  function pointer(stage: Konva.Stage) {
    const position = stage.getPointerPosition();
    if (!position) return null;
    return { x: position.x / scale, y: position.y / scale };
  }

  return (
    <div className="overflow-auto rounded-md border border-line bg-white p-3">
      <Stage
        width={stageWidth}
        height={stageHeight}
        className="bg-field"
        onMouseDown={(event) => {
          if (event.target !== event.target.getStage()) return;
          onSelect(null);
          const point = pointer(event.target.getStage()!);
          if (!point) return;
          setOrigin(point);
          setDraft({ x: point.x, y: point.y, w: 0, h: 0 });
        }}
        onMouseMove={(event) => {
          if (!origin) return;
          const point = pointer(event.target.getStage()!);
          if (!point) return;
          setDraft({
            x: Math.min(origin.x, point.x),
            y: Math.min(origin.y, point.y),
            w: Math.abs(point.x - origin.x),
            h: Math.abs(point.y - origin.y)
          });
        }}
        onMouseUp={() => {
          if (draft && draft.w > 4 && draft.h > 4) onCreate({ ...draft, label: "unlabeled", status: "active" });
          setDraft(null);
          setOrigin(null);
        }}
      >
        <Layer scaleX={scale} scaleY={scale}>
          {bitmap ? <KonvaImage image={bitmap} width={image.width} height={image.height} /> : null}
          {annotations.filter((annotation) => annotation.status !== "deleted").map((annotation) => (
            <Rect
              key={annotation.id}
              ref={annotation.id === selectedId ? selectedShape : undefined}
              x={annotation.x}
              y={annotation.y}
              width={annotation.w}
              height={annotation.h}
              stroke={annotation.id === selectedId ? "#b85f42" : "#4d6857"}
              strokeWidth={2 / scale}
              draggable
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
          {draft ? <Rect {...draft} stroke="#b85f42" dash={[6, 4]} strokeWidth={2 / scale} /> : null}
          {selectedId ? <Transformer ref={transformer} rotateEnabled={false} /> : null}
        </Layer>
      </Stage>
    </div>
  );
}

