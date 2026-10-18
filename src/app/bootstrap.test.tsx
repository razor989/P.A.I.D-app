// @vitest-environment jsdom
import { act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as sessionApi from "@/session/app-machine/public";
import * as composition from "./composition-root";
import { bootstrap } from "./bootstrap";

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});
describe("T035 actual bootstrap lifetime", () => {
  it("StrictMode owns one live actor after replay and stops every issued actor on unmount", () => {
    const create = vi.spyOn(sessionApi, "createAppSessionActor");
    const container = document.createElement("div");
    document.body.append(container);
    let dispose!: () => void;
    act(() => {
      dispose = bootstrap(container);
    });
    const actors = create.mock.results.map(
      (result) => result.value as sessionApi.AppSessionActor,
    );
    expect(actors).toHaveLength(2);
    expect(actors[0]).not.toBe(actors[1]);
    expect(actors.map((a) => a.getSnapshot().status)).toEqual([
      "stopped",
      "active",
    ]);
    expect(actors[0]!.getSnapshot().context.queue).not.toBe(
      actors[1]!.getSnapshot().context.queue,
    );
    expect(document.title).toBe("P.A.I.D. — Startup");
    expect(container.querySelector("main h1")?.textContent).toBe("P.A.I.D.");
    act(() => dispose());
    expect(actors.every((a) => a.getSnapshot().status === "stopped")).toBe(
      true,
    );
    expect(container.childElementCount).toBe(0);
    act(() => {
      dispose = bootstrap(container);
    });
    expect(create).toHaveBeenCalledTimes(4);
    act(() => dispose());
    expect(
      create.mock.results.every(
        (r) =>
          (r.value as sessionApi.AppSessionActor).getSnapshot().status ===
          "stopped",
      ),
    ).toBe(true);
  });
  it("cleans an already started Session when lifetime setup fails", () => {
    const root = composition.createApplicationRoot();
    const start = root.session.start.bind(root.session);
    vi.spyOn(root.session, "start").mockImplementation(() => {
      start();
      throw new Error("Controlled setup failure");
    });
    expect(() => root.start()).toThrow("Controlled setup failure");
    expect(root.session.getSnapshot().status).toBe("stopped");
    root.stop();
    expect(() => root.start()).toThrow("disposed");
  });
});
