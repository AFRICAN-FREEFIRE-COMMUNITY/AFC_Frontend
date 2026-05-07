import type { PoolUpdate } from "./types";

export type PubsubMessage =
  | ({ type: "pool:updated" } & PoolUpdate)
  | { type: "market:locked"; market_id: string }
  | { type: "market:settled"; market_id: string; settlement_id: string }
  | { type: "wallet:credited"; user_id: string; amount_kobo: number }
  | { type: "wallet:debited"; user_id: string; amount_kobo: number }
  | { type: "user:switched"; user_id: string };

const CHANNEL_NAME = "afc-wager-mock";
type Listener = (msg: PubsubMessage) => void;

const localListeners = new Map<PubsubMessage["type"] | "*", Set<Listener>>();
let bc: BroadcastChannel | null = null;

function getBC(): BroadcastChannel | null {
  if (typeof window === "undefined") return null;
  if (typeof BroadcastChannel === "undefined") return null;
  if (!bc) {
    bc = new BroadcastChannel(CHANNEL_NAME);
    bc.onmessage = (ev) => deliverLocal(ev.data as PubsubMessage);
  }
  return bc;
}

function deliverLocal(msg: PubsubMessage): void {
  const exact = localListeners.get(msg.type);
  if (exact) for (const fn of exact) fn(msg);
  const wildcard = localListeners.get("*");
  if (wildcard) for (const fn of wildcard) fn(msg);
}

export function publish(msg: PubsubMessage): void {
  deliverLocal(msg);
  getBC()?.postMessage(msg);
}

export function subscribe<T extends PubsubMessage["type"] | "*">(
  type: T,
  listener: Listener,
): () => void {
  getBC(); // init
  if (!localListeners.has(type)) localListeners.set(type, new Set());
  localListeners.get(type)!.add(listener);
  return () => localListeners.get(type)?.delete(listener);
}

export function teardownPubsub(): void {
  bc?.close();
  bc = null;
  localListeners.clear();
}
