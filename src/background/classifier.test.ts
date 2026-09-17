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
  ).toBe("foo.github.io");
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

  it("distinguishes separate github.io sites", () => {
    expect(
      classifyRequest(
        "https://foo.github.io",
        "https://bar.github.io/script.js"
      )
    ).toBe("third-party");
  });
});

describe("getRegistrableDomain edge cases", () => {
  it("returns null for an invalid URL", () => {
    expect(getRegistrableDomain("not-a-url")).toBeNull();
  });

  it("returns null for non-HTTP(S) URLs", () => {
    expect(getRegistrableDomain("chrome://settings")).toBeNull();
    expect(getRegistrableDomain("file:///tmp/page.html")).toBeNull();
  });

  it("handles public suffixes such as co.uk", () => {
    expect(
      getRegistrableDomain("https://shop.example.co.uk")
    ).toBe("example.co.uk");
  });

  it("normalizes uppercase hostnames and trailing dots", () => {
    expect(
      getRegistrableDomain("https://WWW.Example.COM./")
    ).toBe("example.com");
  });
});

describe("classifyRequest edge cases", () => {
  it("returns unknown for invalid URLs", () => {
    expect(classifyRequest("not-a-url", "https://example.com"))
      .toBe("unknown");

    expect(classifyRequest("https://example.com", "not-a-url"))
      .toBe("unknown");
  });

  it("returns unknown for non-HTTP(S) URLs", () => {
    expect(classifyRequest("chrome://settings", "https://example.com"))
      .toBe("unknown");

    expect(classifyRequest("file:///tmp/page.html", "https://example.com"))
      .toBe("unknown");
  });

  it("treats the same IP address as first-party", () => {
    expect(
      classifyRequest("http://192.168.1.10/page", "http://192.168.1.10/api")
    ).toBe("first-party");
  });

  it("returns unknown for different IP addresses", () => {
    expect(
      classifyRequest("http://192.168.1.10", "http://192.168.1.11")
    ).toBe("unknown");
  });

  it("treats localhost on different ports as first-party", () => {
    expect(
      classifyRequest("http://localhost:3000", "http://localhost:5000/api")
    ).toBe("first-party");
  });

  it("returns unknown for localhost versus a different host", () => {
    expect(
      classifyRequest("http://localhost:3000", "http://127.0.0.1:5000")
    ).toBe("unknown");
  });

  it("compares registrable domains across public suffixes", () => {
    expect(
      classifyRequest(
        "https://shop.example.co.uk",
        "https://api.example.co.uk/data"
      )
    ).toBe("first-party");

    expect(
      classifyRequest(
        "https://shop.example.co.uk",
        "https://other.co.uk/data"
      )
    ).toBe("third-party");
  });

  it("normalizes hostnames before classification", () => {
    expect(
      classifyRequest(
        "https://WWW.Example.COM./",
        "https://api.example.com/data"
      )
    ).toBe("first-party");
  });
});
