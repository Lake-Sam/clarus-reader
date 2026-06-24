import { describe, expect, it } from "vitest";
import { contextBlock, parseCitations, parseGroundedAnswer, retrieve, retrieveLibrary, tokens } from "./retrieval";

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
  it("retrieves and identifies evidence across documents", () => {
    const document = { id: "kant", name: "Groundwork.pdf", size: 1, importedAt: 0, pageCount: 3, indexed: true };
    const result = retrieveLibrary("categorical imperative", [{ document, pages }]);
    expect(result[0].citation).toMatchObject({ documentId: "kant", page: 2 });
    expect(result[0].citation.passage).toContain("categorical imperative");
  });
  it("rejects citations the model was not supplied", () => {
    const evidence = [{ score: 1, text: pages[1].text, citation: { documentId: "kant", documentName: "Groundwork.pdf", page: 2, passage: pages[1].text } }];
    const answer = parseGroundedAnswer('{"answer":"Claim","basis":"direct","support":[{"documentId":"kant","page":99}]}', evidence);
    expect(answer.citations[0].page).toBe(2);
  });
});
