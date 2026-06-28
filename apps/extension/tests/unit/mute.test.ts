import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import { muteThreads } from "../../lib/mute";
import { DEFAULT_SETTINGS } from "../../lib/settings";
import commentsHtml from "../fixtures/html/comments.html?raw";
// Real captured thread: https://lobste.rs/c/jm2ivd (the "Oxide Rack 3D Explorer"
// story). See the comment tree in the describe block below.
import oxideThreadHtml from "../fixtures/html/oxide-rack-thread.html?raw";

const doc = (): Document => new JSDOM(commentsHtml).window.document;
const oxideDoc = (): Document => new JSDOM(oxideThreadHtml).window.document;
const has = (d: Document, shortid: string): boolean =>
  d.querySelector(`#c_${shortid}`) !== null;
const labels = (d: Document): string[] =>
  [...d.querySelectorAll(".vibesters-muted")].map((el) => el.textContent ?? "");

describe("muteThreads — whole thread (default)", () => {
  it("replaces a matching comment and all its replies with one placeholder", () => {
    const d = doc();
    const muted = muteThreads(d, {
      muteWords: ["vibecoding"],
      muteWholeThread: true,
    });

    // A matches (subtree A+B); D matches (subtree D). C and E untouched.
    expect(muted).toBe(2);
    expect(d.querySelectorAll(".vibesters-muted").length).toBe(2);

    expect(d.querySelector("#c_aaa")).toBeNull(); // matched comment gone
    expect(d.querySelector("#c_bbb")).toBeNull(); // its reply gone too
    expect(d.querySelector("#c_ddd")).toBeNull(); // nested match gone
    expect(d.querySelector("#c_ccc")).not.toBeNull(); // its clean parent stays
    expect(d.querySelector("#c_eee")).not.toBeNull(); // non-match stays

    expect(labels(d)).toEqual(
      expect.arrayContaining([
        "muted conversation thread (2 comments)",
        "muted conversation thread (1 comment)",
      ]),
    );
  });

  it("restores the thread when the placeholder is clicked", () => {
    const d = doc();
    muteThreads(d, { muteWords: ["vibecoding"], muteWholeThread: true });

    d.querySelector<HTMLElement>(".vibesters-muted")!.click();

    expect(d.querySelector("#c_aaa")).not.toBeNull();
    expect(d.querySelector("#c_bbb")).not.toBeNull();
    expect(d.querySelectorAll(".vibesters-muted").length).toBe(1); // D's still muted
  });

  it("does not re-mute a thread the user explicitly revealed", () => {
    const d = doc();
    const opts = { muteWords: ["vibecoding"], muteWholeThread: true };
    muteThreads(d, opts);
    d.querySelector<HTMLElement>(".vibesters-muted")!.click();

    muteThreads(d, opts); // e.g. settings changed → re-applied

    expect(d.querySelector("#c_aaa")).not.toBeNull();
  });
});

describe("muteThreads — comment only", () => {
  it("mutes just the matching comment, leaving its replies visible", () => {
    const d = doc();
    const muted = muteThreads(d, {
      muteWords: ["vibecoding"],
      muteWholeThread: false,
    });

    expect(muted).toBe(2); // A and D
    expect(d.querySelector("#c_aaa")).toBeNull(); // comment muted
    expect(d.querySelector("#c_bbb")).not.toBeNull(); // reply stays visible
    expect(new Set(labels(d))).toEqual(new Set(["muted comment"]));
  });
});

describe("muteThreads — matching rules", () => {
  it('is whole-word and case-insensitive ("ai" must not match "email")', () => {
    expect(
      muteThreads(doc(), { muteWords: ["ai"], muteWholeThread: true }),
    ).toBe(0);
  });

  it("does nothing when there are no mute words", () => {
    expect(muteThreads(doc(), { muteWords: [], muteWholeThread: true })).toBe(
      0,
    );
    expect(
      muteThreads(doc(), { muteWords: ["  "], muteWholeThread: true }),
    ).toBe(0);
  });

  it("is idempotent across repeated runs", () => {
    const d = doc();
    const opts = { muteWords: ["vibecoding"], muteWholeThread: true };
    expect(muteThreads(d, opts)).toBe(2);
    expect(muteThreads(d, opts)).toBe(0); // nothing left to mute
    expect(d.querySelectorAll(".vibesters-muted").length).toBe(2);
  });
});

describe("default mute words cover variants & misspellings", () => {
  // Wrap a snippet of comment text in minimal lobste.rs comment markup.
  const commentWith = (text: string): string =>
    `<ol class="comments"><li class="comments_subtree">` +
    `<div class="comment" data-shortid="x"><div class="comment_text"><p>${text}</p></div></div>` +
    `</li></ol>`;
  const matchesDefault = (text: string): boolean =>
    muteThreads(new JSDOM(commentWith(text)).window.document, {
      muteWords: DEFAULT_SETTINGS.muteWords,
      muteWholeThread: false,
    }) > 0;

  it.each([
    "This whole thing is vibecoding",
    "I VibeCoded this in an afternoon", // case-insensitive inflection
    "pure vibecode, no thought",
    "speaking as a vibecoder",
    "just some vibe coding", // two-word spelling
    "a vibe-coded prototype", // hyphenated
    "how long until tagged as videcoding", // observed misspelling (/c/jm2ivd)
    "lots of vibcoding in here", // misspelling
  ])("mutes %j", (text) => expect(matchesDefault(text)).toBe(true));

  it.each([
    "I love coding",
    "video coding standards like H.264", // must not match "videcoding"
    "just a vibe check",
    "this is about encoding",
  ])("leaves %j alone", (text) => expect(matchesDefault(text)).toBe(false));
});

// A real lobste.rs thread, captured from https://lobste.rs/c/jm2ivd. Tree:
//
//   jm2ivd  "…tagged as videcoding…"   (typo: "videcoding" ≠ "vibecoding")
//   ├─ z9b9ca  [vibecoding]            (no replies)
//   └─ djfqh3
//      ├─ ajbeva  [vibecoding]         (no replies)
//      ├─ xswghd  [vibecoding]         ← matches AND has replies
//      │  ├─ twp4bl [vibecoding]
//      │  │  └─ v5cgxa
//      │  └─ flsolf
//      └─ hzu6m0
//         └─ nwn3oa
//
// Only z9b9ca, ajbeva, xswghd, twp4bl contain the word "vibecoding".
describe("muteThreads — real thread /c/jm2ivd (Oxide Rack 3D Explorer)", () => {
  const opts = (muteWholeThread: boolean) => ({
    muteWords: ["vibecoding"],
    muteWholeThread,
  });

  it("whole thread: collapses each matching comment with all its replies", () => {
    const d = oxideDoc();
    const muted = muteThreads(d, opts(true));

    // z9b9ca (1) + ajbeva (1) + xswghd-and-its-whole-subtree (1) = 3 placeholders.
    expect(muted).toBe(3);
    expect(d.querySelectorAll(".vibesters-muted").length).toBe(3);

    // xswghd matched and absorbed its entire subtree — including the nested
    // match twp4bl — into a single placeholder.
    for (const id of ["xswghd", "twp4bl", "v5cgxa", "flsolf"]) {
      expect(has(d, id)).toBe(false);
    }
    expect(has(d, "z9b9ca")).toBe(false);
    expect(has(d, "ajbeva")).toBe(false);

    // The label reports the subtree size (xswghd + twp4bl + v5cgxa + flsolf).
    const labels = [...d.querySelectorAll(".vibesters-muted")].map(
      (e) => e.textContent,
    );
    expect(labels).toContain("muted conversation thread (4 comments)");
    expect(
      labels.filter((l) => l === "muted conversation thread (1 comment)"),
    ).toHaveLength(2);

    // Non-matching comments survive — including jm2ivd, whose "videcoding" typo
    // must NOT match "vibecoding" (whole-word, exact).
    for (const id of ["jm2ivd", "djfqh3", "hzu6m0", "nwn3oa", "bpkgjb"]) {
      expect(has(d, id)).toBe(true);
    }
  });

  it("comment only: mutes the top matching comment and leaves matching descendants alone", () => {
    const d = oxideDoc();
    const muted = muteThreads(d, opts(false));

    // z9b9ca, ajbeva and xswghd are muted individually — but twp4bl is NOT, even
    // though it matches, because its ancestor xswghd already matched. Filter at
    // the top comment that has it; nothing below it is filtered.
    expect(muted).toBe(3);
    const labels = [...d.querySelectorAll(".vibesters-muted")].map(
      (e) => e.textContent,
    );
    expect(new Set(labels)).toEqual(new Set(["muted comment"]));

    for (const id of ["z9b9ca", "ajbeva", "xswghd"]) {
      expect(has(d, id)).toBe(false);
    }
    // The nested match twp4bl stays in place, and so do the surrounding replies.
    expect(has(d, "twp4bl")).toBe(true);
    expect(has(d, "flsolf")).toBe(true); // xswghd's other reply
    expect(has(d, "v5cgxa")).toBe(true); // twp4bl's reply
    expect(has(d, "jm2ivd")).toBe(true); // typo, never matched
  });
});
