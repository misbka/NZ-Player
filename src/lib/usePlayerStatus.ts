import { useEffect, useState } from "react";
import { Channel, invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { PlayerStatus } from "../types";
import { DEFAULT_STATUS } from "../types";
import { getStatus } from "./api";

/**
 * Subscribes to the backend status stream.
 *
 * The Rust side opens a `Channel<PlayerStatus>` and pushes a snapshot every
 * ~200 ms: that is what drives the progress bar and the lyric sync.
 */
export function usePlayerStatus() {
  const [status, setStatus] = useState<PlayerStatus>(DEFAULT_STATUS);
  const [connected, setConnected] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let unlisten: UnlistenFn | undefined;

    const channel = new Channel<PlayerStatus>();
    channel.onmessage = (message) => {
      if (!disposed) setStatus(message);
    };

    // Initial snapshot so the UI never renders stale data.
    getStatus()
      .then((s) => {
        if (!disposed) setStatus(s);
      })
      .catch(() => undefined);

    invoke("watch_status", { channel })
      .then(() => {
        if (!disposed) setConnected(true);
      })
      .catch((err) => {
        if (!disposed) setLastError(String(err));
      });

    listen<string>("player-error", (event) => {
      if (!disposed) setLastError(event.payload);
    })
      .then((fn) => {
        if (disposed) fn();
        else unlisten = fn;
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  return { status, setStatus, connected, lastError, setLastError };
}
