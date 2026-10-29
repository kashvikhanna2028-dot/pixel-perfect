// Verifies the companion extension's free-plan limit-notice reader against
// structured DOM fixtures (jsdom has no layout engine, so innerText is
// approximated with textContent). These are synthetic fixtures: the exact
// free-plan notice wording and DOM are undocumented, so the reader is
// deliberately strict and its first real capture on a live account is the
// validation event.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

type FixtureNotice = {
  provider?: string;
  kind?: string;
  noticeText?: string;
  resetText?: string | null;
  confidence?: string;
  observedAt?: string;
};
type SentMessage = { type: string; notice?: FixtureNotice };

function loadParser(): SentMessage[] {
  const sent: SentMessage[] = [];
  vi.stubGlobal("chrome", {
    runtime: {
      sendMessage: (msg: SentMessage, cb?: () => void) => {
        sent.push(msg);
        cb?.();
      },
      lastError: null,
    },
  });
  // jsdom lacks innerText; approximate with textContent for the parser.
  Object.defineProperty(window.HTMLElement.prototype, "innerText", {
    get() {
      return this.textContent;
    },
    configurable: true,
  });
  const code = readFileSync(resolve(__dirname, "../../extension/content-notice.js"), "utf8");
  const run = new Function(
    "window",
    "document",
    "location",
    "chrome",
    "MutationObserver",
    "NodeFilter",
    code,
  );
  run(
    window,
    window.document,
    window.location,
    (window as unknown as { chrome: unknown }).chrome ??
      (globalThis as unknown as { chrome: unknown }).chrome,
    window.MutationObserver,
    window.NodeFilter,
  );
  return sent;
}

describe("content-notice parser (fixture DOM)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("captures an alert-style limit banner with its reset time as ui-banner", () => {
    document.body.innerHTML = `
      <main>
        <div class="message user-message">what is the free plan limit?</div>
        <div class="limit-banner">You've reached your usage limit. Your limit will reset at 3:00 PM.</div>
        <textarea placeholder="Reply to Claude..."></textarea>
      </main>`;
    const notice = loadParser().find((m) => m.type === "limit-notice")?.notice;
    expect(notice?.kind).toBe("limit-notice");
    expect(notice?.noticeText).toContain("reached your usage limit");
    expect(notice?.resetText).toMatch(/reset at 3:00 PM/i);
    expect(notice?.confidence).toBe("ui-banner");
  });

  it("never treats chat message text as a system notice", () => {
    document.body.innerHTML = `
      <main>
        <div class="chat">
          <div class="message user-message">You've reached your usage limit.</div>
          <div class="message assistant-message">You've reached your usage limit. Your limit will reset at 3:00 PM.</div>
        </div>
      </main>`;
    expect(loadParser().find((m) => m.type === "limit-notice")).toBeUndefined();
  });

  it("ignores questions and first-person chatter about limits", () => {
    document.body.innerHTML = `
      <main>
        <div class="message user-message">what is the usage limit on the free plan?</div>
        <div class="message user-message">i reached my limit lol</div>
        <div class="message assistant-message">Your free plan limit resets every five hours and varies with demand.</div>
      </main>`;
    expect(loadParser().find((m) => m.type === "limit-notice")).toBeUndefined();
  });

  it("labels a match outside alert-style UI as an unverified candidate", () => {
    document.body.innerHTML = `
      <main>
        <div class="some-random-div">You've reached your usage limit. Your limit will reset at 3:00 PM.</div>
      </main>`;
    const notice = loadParser().find((m) => m.type === "limit-notice")?.notice;
    expect(notice?.confidence).toBe("unverified-candidate");
  });

  it("captures a notice without a stated reset as resetText null", () => {
    document.body.innerHTML = `<div role="alert">Usage limit reached.</div>`;
    const notice = loadParser().find((m) => m.type === "limit-notice")?.notice;
    expect(notice?.resetText).toBeNull();
    expect(notice?.noticeText).toBe("Usage limit reached.");
  });

  it("ignores long prose that quotes the trigger wording", () => {
    document.body.innerHTML = `
      <main>
        <p>${"Some explanation. ".repeat(30)} you've reached your usage limit ${"more text. ".repeat(30)}</p>
      </main>`;
    expect(loadParser().find((m) => m.type === "limit-notice")).toBeUndefined();
  });

  it("sends nothing on an ordinary chat page", () => {
    document.body.innerHTML = `<main><p>Just a normal conversation.</p></main>`;
    expect(loadParser().find((m) => m.type === "limit-notice")).toBeUndefined();
  });
});
