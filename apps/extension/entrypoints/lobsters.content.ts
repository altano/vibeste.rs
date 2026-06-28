import { defineContentScript } from "#imports";
import { settings, type Settings } from "@/lib/settings";
import { buildHideTagsCss } from "@/lib/hide-tags";
import { muteThreads } from "@/lib/mute";

// Presentation for the "muted" placeholder links. Kept here (the content layer)
// rather than in the pure logic so mute.ts stays DOM-only and easily testable.
const PLACEHOLDER_CSS = `
.vibeste-muted {
  display: inline-block;
  margin: 0.3em 0;
  padding: 0.1em 0.5em;
  font-size: 0.85em;
  font-style: italic;
  color: #888;
  border: 1px dashed currentColor;
  border-radius: 4px;
  cursor: pointer;
  text-decoration: none;
}
.vibeste-muted::before { content: "▸ "; font-style: normal; }
.vibeste-muted:hover { color: #555; }
`;

export default defineContentScript({
  matches: ["*://lobste.rs/*", "*://lobsters.dev/*"],
  // document_start so the hide-tags CSS is in place before first paint (no flash
  // of the vibecoding tag).
  runAt: "document_start",
  async main(ctx) {
    let current: Settings = await settings.getValue();

    // (a) Hide tags via an injected stylesheet — declarative, so it also covers
    // any tags added to the DOM later without re-running JavaScript.
    const style = document.createElement("style");
    style.dataset.vibeste = "styles";
    const renderStyle = () => {
      style.textContent =
        buildHideTagsCss(current.hiddenTags) + PLACEHOLDER_CSS;
    };
    renderStyle();
    (document.head ?? document.documentElement).append(style);

    // (b) Mute comment threads once the comments are in the DOM.
    const runMute = () => muteThreads(document, current);
    if (document.readyState === "loading") {
      ctx.addEventListener(document, "DOMContentLoaded", runMute);
    } else {
      runMute();
    }

    // Live-update both behaviours when the user changes options.
    const unwatch = settings.watch((next) => {
      current = next;
      renderStyle();
      runMute();
    });
    ctx.onInvalidated(unwatch);
  },
});
