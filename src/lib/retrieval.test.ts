import { describe, expect, it } from "vitest";
import { contextBlock, parseCitations, retrieve, tokens } from "./retrieval";

describe("document retrieval", () => {
  const pages = [
    { page: 1, text: "An introduction to ordinary language and meaning." },
    { page: 2, text: "The categorical imperative is a principle of practical reason." },
    { page: 3, text: "A short bibliography and acknowledgements." }
  ];

  it("ranks relevant pages", () => expect(retrieve("Explain the categorical imperative", pages)[0].page).toBe(2));
  it("removes common stop words", () => expect(tokens("what is the meaning of reason")).toEqual(["meaning", "reason"]));
  it("formats page boundaries", () => expect(contextBlock([pages[1]])).toContain("--- Page 2 ---"));
  it("extracts unique page citations", () => expect(parseCitations("See [p. 2], [page 7], and [p. 2].")).toEqual([2, 7]));
});
