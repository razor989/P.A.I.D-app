import { describe, expect, it, vi } from "vitest";
import { CHECKPOINT_KEY, createNativeShell } from "./native-shell";
import type { NativeHost } from "./native-shell";

function fakeHost() {
  const values = new Map<string, string>();
  const listeners = new Set<() => void>();
  let resolveRegistration: (() => void) | null = null;
  const remove = vi.fn(() => Promise.resolve());
  const minimizeApp = vi.fn(() => Promise.resolve());
  let deferRegistration = false;
  const host: NativeHost = {
    preferences: {
      get: ({ key }) => Promise.resolve({ value: values.get(key) ?? null }),
      set: ({ key, value }) => {
        values.set(key, value);
        return Promise.resolve();
      },
      remove: ({ key }) => {
        values.delete(key);
        return Promise.resolve();
      },
    },
    addBackButtonListener(handler) {
      listeners.add(handler);
      const handle = {
        remove: () => {
          listeners.delete(handler);
          return remove();
        },
      };
      if (!deferRegistration) return Promise.resolve(handle);
      return new Promise((resolve) => {
        resolveRegistration = () => resolve(handle);
      });
    },
    minimizeApp,
  };
  return {
    host,
    values,
    remove,
    minimizeApp,
    press: () => [...listeners].forEach((listener) => listener()),
    listenerCount: () => listeners.size,
    deferNextRegistration: () => {
      deferRegistration = true;
    },
    completeRegistration: () => resolveRegistration?.(),
  };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("native checkpoint store", () => {
  it("round-trips the Recovery envelope under the browser store's key", async () => {
    const fake = fakeHost();
    const { checkpointStore } = createNativeShell(fake.host);
    await expect(checkpointStore.load()).resolves.toBeNull();
    await checkpointStore.replace('{"schemaVersion":1}');
    expect(fake.values.get(CHECKPOINT_KEY)).toBe('{"schemaVersion":1}');
    expect(CHECKPOINT_KEY).toBe("paid.recovery.checkpoint.v1");
    await expect(checkpointStore.load()).resolves.toBe('{"schemaVersion":1}');
    await checkpointStore.clear();
    await expect(checkpointStore.load()).resolves.toBeNull();
  });

  it("surfaces storage failures to the Recovery queue instead of hiding them", async () => {
    const fake = fakeHost();
    const failure = new Error("storage unavailable");
    const shell = createNativeShell({
      ...fake.host,
      preferences: {
        ...fake.host.preferences,
        set: () => Promise.reject(failure),
      },
    });
    await expect(shell.checkpointStore.replace("x")).rejects.toBe(failure);
  });
});

describe("hardware Back", () => {
  it("delivers presses until released, then removes the native listener", async () => {
    const fake = fakeHost();
    const shell = createNativeShell(fake.host);
    const handler = vi.fn();
    const release = shell.onHardwareBack(handler);
    await settle();
    fake.press();
    fake.press();
    expect(handler).toHaveBeenCalledTimes(2);
    release();
    release();
    await settle();
    expect(fake.remove).toHaveBeenCalledTimes(1);
    expect(fake.listenerCount()).toBe(0);
    fake.press();
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("removes a listener whose registration completes after release", async () => {
    const fake = fakeHost();
    fake.deferNextRegistration();
    const shell = createNativeShell(fake.host);
    const handler = vi.fn();
    const release = shell.onHardwareBack(handler);
    release();
    fake.press();
    expect(handler).not.toHaveBeenCalled();
    fake.completeRegistration();
    await settle();
    expect(fake.remove).toHaveBeenCalledTimes(1);
    expect(fake.listenerCount()).toBe(0);
  });

  it("minimizes without surfacing a native failure", async () => {
    const fake = fakeHost();
    fake.minimizeApp.mockImplementationOnce(() =>
      Promise.reject(new Error("unavailable")),
    );
    const shell = createNativeShell(fake.host);
    shell.minimize();
    await settle();
    expect(fake.minimizeApp).toHaveBeenCalledTimes(1);
  });
});
