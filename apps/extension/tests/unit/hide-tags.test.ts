import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import { buildHideTagsCss, hideTagSelectors } from "../../lib/hide-tags";
import homeHtml from "../fixtures/html/home.html?raw";
import filtersHtml from "../fixtures/html/filters.html?raw";

describe("buildHideTagsCss", () => {
  it("returns an empty string when there is nothing to hide", () => {
    expect(buildHideTagsCss([])).toBe("");
    expect(buildHideTagsCss(["  ", ""])).toBe("");
  });

  it("builds a scoped, !important rule per tag", () => {
    const css = buildHideTagsCss(["vibecoding"]);
    expect(css).toContain("span.tags > a.tag_vibecoding");
    expect(css).toContain("display: none !important");
  });

  it("lowercases, trims and de-duplicates slugs", () => {
    expect(hideTagSelectors([" Vibecoding ", "vibecoding"])).toEqual([
      "span.tags > a.tag_vibecoding",
    ]);
  });

  it("escapes special characters so the selector is valid", () => {
    const [selector] = hideTagSelectors(["c++"]);
    const { document } = new JSDOM(
      '<span class="tags"><a class="tag tag_c++"></a></span>',
    ).window;
    expect(document.querySelectorAll(selector!).length).toBe(1);
  });
});

describe("hide-tags discriminator against real lobste.rs HTML", () => {
  const [selector] = hideTagSelectors(["vibecoding"]);

  it("matches the vibecoding tag where it annotates a story (home page)", () => {
    const { document } = new JSDOM(homeHtml).window;
    expect(document.querySelectorAll(selector!).length).toBeGreaterThan(0);
  });

  it("never matches on the Filtered Tags page, despite a vibecoding tag existing there", () => {
    const { document } = new JSDOM(filtersHtml).window;
    // The /filters page wraps tags in <td>, not <span class="tags">.
    expect(document.querySelector("a.tag_vibecoding")).not.toBeNull();
    expect(document.querySelectorAll(selector!).length).toBe(0);
  });
});
