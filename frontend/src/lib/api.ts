import type { Stems, SeparationStage } from "@/types";

export interface UploadResponse {
  job_id:   string;
  filename: string;
  size:     number;
}

export async function uploadAudio(file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch("/api/upload", { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Upload failed (${res.status})`);
  }
  return res.json();
}

export interface SSEProgressEvent {
  type:     "status" | "progress" | "log" | "done" | "error";
  stage?:   SeparationStage;
  progress: number;
  message:  string;
  stems?:   Stems;
  job_id?:  string;
}

/**
 * Connect to the SSE separation stream for a given job_id.
 * Calls onEvent for each parsed event, calls onDone when stream closes.
 * Returns an abort function.
 */
export function startSeparation(
  jobId: string,
  onEvent: (ev: SSEProgressEvent) => void,
  onDone:  () => void,
): () => void {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(`/api/separate/${jobId}`, {
        signal: controller.signal,
      });
      if (!res.body) throw new Error("No response body");

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   buffer  = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";

        for (const block of blocks) {
          if (!block.trim()) continue;
          const lines     = block.split("\n");
          const eventLine = lines.find(l => l.startsWith("event:"));
          const dataLine  = lines.find(l => l.startsWith("data:"));
          if (!dataLine) continue;

          const eventType = eventLine?.slice(7).trim() ?? "message";
          const data      = JSON.parse(dataLine.slice(5).trim());

          onEvent({ type: eventType as SSEProgressEvent["type"], ...data });
        }
      }
      onDone();
    } catch (err: unknown) {
      if ((err as Error).name !== "AbortError") {
        onEvent({ type: "error", progress: 0, message: String(err) });
      }
      onDone();
    }
  })();

  return () => controller.abort();
}
