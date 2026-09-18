// @vitest-environment jsdom
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";


class MockGeolocation {
  getCurrentPosition(): void {
    // Mock original browser method.
  }

  watchPosition(): number {
    return 123;
  }
}

type GeolocationEventDetail = {
  kind: string;
  api: string;
  action: string;
  timestamp: number;
};

describe("Geolocation detector", () => {
  let events: GeolocationEventDetail[] = [];

  beforeAll(async () => {
    vi.stubGlobal("Geolocation", MockGeolocation);

    window.addEventListener("webtrace:geolocation", (event) => {
      events.push(
        (event as CustomEvent<GeolocationEventDetail>).detail
      );
    });

    await import("../detectors/geolocation");
  });

  beforeEach(() => {
    events = [];
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("detects getCurrentPosition", () => {
    const geo = new MockGeolocation();

    geo.getCurrentPosition();

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: "geolocation",
      api: "navigator.geolocation",
      action: "getCurrentPosition",
    });
  });

  it("detects watchPosition", () => {
    const geo = new MockGeolocation();

    const result = geo.watchPosition();

    expect(result).toBe(123);
    expect(events).toHaveLength(1);
    expect(events[0].action).toBe("watchPosition");
  });

it("preserves the original method behavior", () => {
  const original = vi.spyOn(
    MockGeolocation.prototype,
    "getCurrentPosition"
  );

  const geo = new MockGeolocation();
  geo.getCurrentPosition();

  expect(original).toHaveBeenCalledOnce();
});
});
