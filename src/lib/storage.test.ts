import { beforeEach, describe, expect, it } from "vitest";
import { loadPosition, savePosition } from "./storage";

const values = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", { value: {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => values.set(key, value),
  removeItem: (key: string) => values.delete(key)
} });

describe("reading positions", () => {
  beforeEach(() => values.clear());
  it("defaults new documents to page one", () => expect(loadPosition("new-book")).toBe(1));
  it("restores each document independently", () => {
    savePosition("priest", 51); savePosition("kant", 23);
    expect(loadPosition("priest")).toBe(51);
    expect(loadPosition("kant")).toBe(23);
  });
});
