import { describe, expect, it } from "vitest";
import {
  classifyRequest,
  getRegistrableDomain
} from "./classifier";

describe("getRegistrableDomain", () => {
  it("extracts the registrable domain", () => {
    expect(
      getRegistrableDomain("https://www.example.com")
    ).toBe("example.com");
  });

  it("handles subdomains", () => {
    expect(
      getRegistrableDomain("https://api.example.com")
    ).toBe("example.com");
  });

it("handles github.io as separate sites", () => {
  expect(
    getRegistrableDomain("https://foo.github.io")
  ).toBe("github.io");
});
});

describe("classifyRequest", () => {
  it("classifies the same hostname as first-party", () => {
    expect(
      classifyRequest(
        "https://example.com",
        "https://example.com/script.js"
      )
    ).toBe("first-party");
  });

  it("classifies a subdomain as first-party", () => {
    expect(
      classifyRequest(
        "https://www.example.com",
        "https://api.example.com/data"
      )
    ).toBe("first-party");
  });

  it("classifies an external domain as third-party", () => {
    expect(
      classifyRequest(
        "https://example.com",
        "https://google.com/analytics.js"
      )
    ).toBe("third-party");
  });

});
