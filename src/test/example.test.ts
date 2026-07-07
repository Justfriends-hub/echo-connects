import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn utility", () => {
  it("should merge class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("should handle conditional classes", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible");
  });

  it("should merge tailwind conflicts", () => {
    // twMerge should resolve conflicting tailwind classes
    expect(cn("p-4", "p-2")).toBe("p-2");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("should handle undefined and null", () => {
    expect(cn("base", undefined, null, "end")).toBe("base end");
  });

  it("should handle empty inputs", () => {
    expect(cn()).toBe("");
  });
});

describe("date formatting", () => {
  it("should format a valid ISO date", () => {
    const date = new Date("2026-01-15T10:30:00Z");
    const formatted = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    expect(formatted).toBeTruthy();
    expect(typeof formatted).toBe("string");
  });
});
