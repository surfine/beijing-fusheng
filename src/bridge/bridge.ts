// The app's one connection to its host. Inside the desk the kit talks to the
// desk over a MessagePort; on the app's own page (npm run dev, or dist/ opened
// on its own) the kit's standalone adapter answers state and files itself.
// Everything the app needs from outside its frame goes through here.

import type { Language } from "../strings/index.ts";
import type { Appearance, BridgeClient, MenuState, SuspendCause } from "./types.ts";

/** The window's app and name in app.manifest.json: the desk checks the hello against them. */
export const APP_ID = "beijingFusheng";
export const WINDOW_NAME = "beijingFusheng";
/** Must equal the manifest's and package.json's version, or the desk refuses the connection. */
export const APP_VERSION = "1.1.0";

export type { BridgeClient } from "./types.ts";

/** Connects through the kit the page loaded before this module. */
export async function connect(): Promise<BridgeClient> {
  const kit = window.AIS6Bridge;
  if (!kit) throw new Error("ais6-bridge.js did not load");
  return kit.connect({ appId: APP_ID, window: WINDOW_NAME, version: APP_VERSION });
}

export async function readState(client: BridgeClient, key: string): Promise<unknown> {
  try {
    return (await client.call("state.get", { key })).value;
  } catch {
    return null;
  }
}

export async function writeState(client: BridgeClient, key: string, value: unknown): Promise<boolean> {
  try {
    await client.call("state.set", { key, value });
    return true;
  } catch {
    return false;
  }
}

/** Hands a file to the host to save (the desk's Save dialog, or a download on the app's own page). */
export async function exportFile(client: BridgeClient, name: string, mime: string, blob: Blob): Promise<boolean> {
  try {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    await client.call("files.export", { name, mime, bytes });
    return true;
  } catch {
    return false;
  }
}

export function pushMenuState(client: BridgeClient, state: MenuState): void {
  client.menuState(state);
}

export function onMenuCommand(client: BridgeClient, run: (action: string) => boolean): void {
  client.handle("menu.command", ({ action }) => ({ handled: run(action) }));
}

/** Suspend, resume and dispose; each handler runs before the reply goes back, so save in suspend. */
export function onLifecycle(
  client: BridgeClient,
  handlers: { suspend: (cause: SuspendCause) => void | Promise<void>; resume: () => void; dispose: () => void },
): void {
  client.handle("lifecycle.suspend", async ({ cause }) => {
    await handlers.suspend(cause ?? "away");
    return {};
  });
  client.handle("lifecycle.resume", () => {
    handlers.resume();
    return {};
  });
  client.handle("lifecycle.dispose", () => {
    handlers.dispose();
    return {};
  });
}

export function onAppearance(client: BridgeClient, listener: (appearance: Appearance) => void): () => void {
  return client.on("appearance.changed", listener);
}

export function onLanguage(client: BridgeClient, listener: (language: Language) => void): () => void {
  return client.on("language.changed", ({ language }) => listener(language));
}

export function setTitle(client: BridgeClient, title: string): void {
  client.setTitle(title);
}
