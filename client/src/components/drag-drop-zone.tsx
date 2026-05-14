import { useState, useEffect, useRef } from "react";
import { Link2 } from "lucide-react";

const URL_RE = /https?:\/\/[^\s]+/gi;

interface DragDropZoneProps {
  onUrlsDetected: (urls: string[]) => void;
}

export function DragDropZone({ onUrlsDetected }: DragDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isOver, setIsOver] = useState(false);
  const dragCounter = useRef(0);

  useEffect(() => {
    const onDragEnter = (e: DragEvent) => {
      dragCounter.current++;
      if (dragCounter.current === 1) setIsDragging(true);
    };
    const onDragLeave = (e: DragEvent) => {
      dragCounter.current--;
      if (dragCounter.current === 0) {
        setIsDragging(false);
        setIsOver(false);
      }
    };
    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current = 0;
      setIsDragging(false);
      setIsOver(false);

      const text =
        e.dataTransfer?.getData("text/uri-list") ||
        e.dataTransfer?.getData("text/plain") ||
        "";

      const urls = Array.from(new Set(text.match(URL_RE) ?? []));
      if (urls.length > 0) onUrlsDetected(urls);
    };

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [onUrlsDetected]);

  if (!isDragging) return null;

  return (
    <div
      id="drag-drop-overlay"
      onDragOver={(e) => { e.preventDefault(); setIsOver(true); }}
      onDragLeave={() => setIsOver(false)}
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{
        background: isOver
          ? "rgba(10,10,20,0.80)"
          : "rgba(10,10,20,0.65)",
        backdropFilter: "blur(20px) saturate(180%) url(#liquid-glass-filter)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        transition: "background 0.2s ease",
      }}
    >
      <div
        className="flex flex-col items-center gap-5 p-12 rounded-3xl"
        style={{
          background: isOver ? "rgba(29,185,84,0.12)" : "rgba(255,255,255,0.06)",
          border: `2px dashed ${isOver ? "rgba(29,185,84,0.7)" : "rgba(255,255,255,0.25)"}`,
          backdropFilter: "blur(32px) saturate(200%)",
          boxShadow: isOver
            ? "0 0 60px rgba(29,185,84,0.25), inset 0 1px 0 rgba(255,255,255,0.2)"
            : "inset 0 1px 0 rgba(255,255,255,0.1)",
          transition: "all 0.25s cubic-bezier(0.32, 0.72, 0, 1)",
          transform: isOver ? "scale(1.04)" : "scale(1)",
        }}
      >
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center"
          style={{
            background: isOver ? "rgba(29,185,84,0.25)" : "rgba(255,255,255,0.08)",
            border: `1px solid ${isOver ? "rgba(29,185,84,0.5)" : "rgba(255,255,255,0.14)"}`,
            boxShadow: isOver ? "0 0 30px rgba(29,185,84,0.3)" : "none",
            transition: "all 0.25s cubic-bezier(0.32, 0.72, 0, 1)",
          }}
        >
          <Link2
            size={36}
            style={{
              color: isOver ? "#FFD200" : "rgba(255,255,255,0.5)",
              transition: "color 0.2s ease",
            }}
          />
        </div>
        <div className="text-center">
          <p
            className="text-xl font-bold text-white mb-1.5"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {isOver ? "Drop to add URL" : "Drop a URL here"}
          </p>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
            Drag any video link from your browser
          </p>
        </div>
      </div>
    </div>
  );
}
