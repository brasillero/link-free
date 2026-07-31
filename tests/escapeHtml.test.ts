import { describe, expect, it } from "vitest";
import { escapeHtml } from "../src/escapeHtml.js";

describe("escapeHtml", () => {
  it("escapes all five special characters", () => {
    expect(escapeHtml(`<script>"x"&'y'`)).toBe(
      "&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;",
    );
  });

  it("leaves plain text untouched", () => {
    expect(escapeHtml("Jane Doe")).toBe("Jane Doe");
  });
});
