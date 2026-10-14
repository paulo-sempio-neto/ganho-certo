import { describe, expect, it } from "vitest";

import { getLegalPage, legalDocuments } from "./legalContent";

describe("getLegalPage", () => {
  it("routes the privacy and terms paths, with or without a trailing slash", () => {
    expect(getLegalPage("/privacidade")).toBe("privacidade");
    expect(getLegalPage("/termos/")).toBe("termos");
  });

  it("ignores every other path", () => {
    expect(getLegalPage("/")).toBeNull();
    expect(getLegalPage("/reset-password")).toBeNull();
    expect(getLegalPage("/privacidade/extra")).toBeNull();
  });
});

describe("legal documents", () => {
  it("covers the LGPD rights and the data the app really stores", () => {
    const privacy = JSON.stringify(legalDocuments.privacidade);

    expect(privacy).toContain("Lei nº 13.709/2018");
    expect(privacy).toContain("art. 18");
    expect(privacy).toContain("hash");
    expect(privacy).toContain("localStorage");
    expect(privacy).toContain("exclusão da conta");
  });

  it("dates both documents and gives every section content", () => {
    for (const document of Object.values(legalDocuments)) {
      expect(document.updatedAt).not.toBe("");
      for (const section of document.sections) {
        expect((section.paragraphs?.length ?? 0) + (section.items?.length ?? 0)).toBeGreaterThan(0);
      }
    }
  });
});
