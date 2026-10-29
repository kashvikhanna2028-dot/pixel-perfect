// Verifies the companion extension's Claude usage-page parser against
// structured DOM fixtures (jsdom has no layout engine, so innerText is
// approximated with textContent). These are synthetic fixtures: the parser
// still needs one live check on a signed-in claude.ai/settings/usage page.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

type FixtureReading = {
  provider?: string;
  sessionPercent?: number | null;
  weeklyPercent?: number | null;
  sessionReset?: string | null;
  weeklyReset?: string | null;
  observedAt?: string;
};
type SentMessage = { type: string; reading?: FixtureReading };

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
  const code = readFileSync(resolve(__dirname, "../../extension/content-claude.js"), "utf8");
  // Inject the DOM globals explicitly so the parser's MutationObserver
  // callbacks stay bound to this fixture's window even after later tests
  // replace document.body.
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

describe("content-claude parser (fixture DOM)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("reads aria progressbars for session and weekly", () => {
    document.body.innerHTML = `
      <div><h3>Current session</h3>
        <div role="progressbar" aria-valuenow="42" aria-valuemin="0" aria-valuemax="100"></div>
        <p>Resets in 2 hr 14 min</p></div>
      <div><h3>Weekly limits</h3>
        <div role="progressbar" aria-valuenow="18" aria-valuemin="0" aria-valuemax="100"></div>
        <p>Resets Nov 3 at 9:00 AM</p></div>`;
    const reading = loadParser().find((m) => m.type === "usage-reading")?.reading;
    expect(reading?.sessionPercent).toBe(42);
    expect(reading?.weeklyPercent).toBe(18);
    expect(String(reading?.sessionReset)).toMatch(/Resets in 2 hr/i);
  });

  it("falls back to percent text when no progressbar exists", () => {
    document.body.innerHTML = `
      <div><span>Current session</span><span>67% used</span><span>Resets in 1 hr</span></div>
      <div><span>Weekly</span><span>23%</span><span>Resets Monday</span></div>`;
    const reading = loadParser().find((m) => m.type === "usage-reading")?.reading;
    expect(reading?.sessionPercent).toBe(67);
    expect(reading?.weeklyPercent).toBe(23);
  });

  it("matches the real Settings > Usage layout (labels from a live screenshot)", () => {
    // Mirrors the observed page: banner prose mentioning "weekly", a
    // "Current session" row, a "This week" row, and unrelated credit
    // sections that must not leak into the session reading.
    document.body.innerHTML = `
      <main>
        <h2>Your usage</h2>
        <p>Fresh week. 9% of your weekly limit used.</p>
        <section>
          <div><span>Current session</span>
            <div role="progressbar" aria-valuenow="13" aria-valuemin="0" aria-valuemax="100"></div>
            <span>13% used</span><p>Resets at 2:00 PM</p></div>
          <div><span>This week</span>
            <div role="progressbar" aria-valuenow="9" aria-valuemin="0" aria-valuemax="100"></div>
            <span>9% used</span><p>Resets Friday 10:30 PM</p></div>
        </section>
        <section><h3>Cloud session credits</h3>
          <div><span>Included credit</span><span>$100 of $100 left</span></div></section>
        <section><h3>Usage credits</h3><span>$0</span></section>
      </main>`;
    const reading = loadParser().find((m) => m.type === "usage-reading")?.reading;
    expect(reading?.sessionPercent).toBe(13);
    expect(reading?.weeklyPercent).toBe(9);
    expect(String(reading?.sessionReset)).toMatch(/Resets at 2:00 PM/i);
    expect(String(reading?.weeklyReset)).toMatch(/Resets Friday 10:30 PM/i);
  });

  it("ignores the banner prose when no labelled rows exist yet", () => {
    // Banner mentions "weekly" and a percent but is not a labelled row; with
    // nothing else on the page the loose fallback may read it, so this test
    // pins the opposite case: labelled rows win over the banner.
    document.body.innerHTML = `
      <p>Fresh week. 55% of your weekly limit used.</p>
      <div><span>This week</span><span>9% used</span><p>Resets Friday</p></div>`;
    const reading = loadParser().find((m) => m.type === "usage-reading")?.reading;
    expect(reading?.weeklyPercent).toBe(9);
  });

  it("sends nothing on a page without usage data", () => {
    document.body.innerHTML = `<main><p>Nothing here</p></main>`;
    expect(loadParser().find((m) => m.type === "usage-reading")).toBeUndefined();
  });
});
