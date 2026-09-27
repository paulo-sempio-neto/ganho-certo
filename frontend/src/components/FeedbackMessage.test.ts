import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FeedbackMessage } from "./FeedbackMessage";

describe("FeedbackMessage", () => {
  it.each([
    ["error", "alert", "form-message"],
    ["success", "status", "success-message"],
    ["info", "status", "form-message"],
    ["loading", "status", "loading-state"],
  ] as const)("gives %s feedback consistent semantics", (kind, role, className) => {
    const html = renderToStaticMarkup(createElement(FeedbackMessage, { kind, children: "Mensagem" }));

    expect(html).toContain(`role="${role}"`);
    expect(html).toContain(`class="${className}"`);
    expect(html).toContain('aria-atomic="true"');
    expect(html).toContain("Mensagem");
    expect(html).not.toContain("empty-state");
  });

  it("preserves content and escapes dynamic messages in the compact variant", () => {
    const html = renderToStaticMarkup(createElement(FeedbackMessage, {
      kind: "error", compact: true, children: "<script>message</script>",
    }));

    expect(html).toContain("form-message compact-message");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });
});
