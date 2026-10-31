// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createBrowserCheckpointStore } from "./browser-checkpoint-store";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});
describe("browser checkpoint storage adapter", () => {
  it("acknowledges replacement, survives adapter recreation and clears one owned slot", async () => {
    const store = createBrowserCheckpointStore();
    expect(await store.load()).toBeNull();
    localStorage.setItem("unrelated", "retained");
    await store.replace("serialized checkpoint");
    const reloaded = createBrowserCheckpointStore();
    expect(await reloaded.load()).toBe("serialized checkpoint");
    await reloaded.clear();
    expect(await store.load()).toBeNull();
    expect(localStorage.getItem("unrelated")).toBe("retained");
  });
  it("rejects unavailable storage rather than claiming durability", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });
    await expect(
      createBrowserCheckpointStore().replace("checkpoint"),
    ).rejects.toThrow("Quota exceeded");
  });
  it("supports an explicit retry after a failed replacement without clearing old work", async () => {
    const store = createBrowserCheckpointStore();
    await store.replace("previous");
    const write = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementationOnce(() => {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      });
    await expect(store.replace("new")).rejects.toThrow("Quota exceeded");
    expect(await store.load()).toBe("previous");
    await store.replace("new");
    expect(await store.load()).toBe("new");
    expect(write).toHaveBeenCalledTimes(2);
  });
  it("propagates read and clear failures for existing Recovery policy", async () => {
    const store = createBrowserCheckpointStore();
    await store.replace("retained");
    vi.spyOn(Storage.prototype, "getItem").mockImplementationOnce(() => {
      throw new Error("read denied");
    });
    await expect(store.load()).rejects.toThrow("read denied");
    vi.spyOn(Storage.prototype, "removeItem").mockImplementationOnce(() => {
      throw new Error("clear denied");
    });
    await expect(store.clear()).rejects.toThrow("clear denied");
    expect(await store.load()).toBe("retained");
    await store.clear();
    expect(await store.load()).toBeNull();
  });
});
