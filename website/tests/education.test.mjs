import test from "node:test";
import assert from "node:assert/strict";

test("sparse chart selection follows elapsed calendar time rather than record spacing", () => {
  const dates = ["2026-01-01", "2026-01-02", "2026-01-31"];
  assert.equal(nearestPoint(84 + 790 * 0.1, 0, 900, dates.length, dates), 1);
  assert.equal(nearestPoint(874, 0, 900, dates.length, dates), 2);
});
import fs from "node:fs";
import path from "node:path";
import {
  selectRange,
  rangeAvailable,
  chartDomain,
  nearestPoint,
  groupDatedAmounts,
} from "../src/charts/model.ts";
import { guides } from "../src/education/guides.ts";
test("ranges use loaded dates, include boundaries and do not invent history", () => {
  const p = Array.from({ length: 40 }, (_, i) => ({
    date: new Date(Date.UTC(2026, 0, i + 1)).toISOString().slice(0, 10),
    value: i,
  }));
  assert.equal(selectRange(p, "7D").length, 7);
  assert.equal(selectRange(p, "30D").length, 30);
  assert.equal(selectRange(p, "ALL").length, 40);
  assert.equal(selectRange(p, "7D", true)[0].date, p[0].date);
  assert.equal(selectRange(p, "7D")[0].date, p[33].date);
  assert.equal(selectRange(p, "YTD").length, 40);
  assert.equal(selectRange([], "1Y").length, 0);
  assert.deepEqual(p[0], { date: "2026-01-01", value: 0 });
});
test("domains preserve negative cash movement and make constant/empty data drawable", () => {
  const [min, max] = chartDomain(
    [
      { date: "2026-01-01", v: -500 },
      { date: "2026-01-02", v: 1000 },
    ],
    ["v"],
  );
  assert.ok(min < -500);
  assert.ok(max > 1000);
  const constant = chartDomain([{ date: "2026-01-01", v: 0 }], ["v"]);
  assert.ok(constant[0] < constant[1]);
  assert.deepEqual(chartDomain([], []), [0, 1]);
});
test("pointer selection respects chart plot margins and clamps both edges", () => {
  assert.equal(nearestPoint(0, 0, 900, 10), 0);
  assert.equal(nearestPoint(84, 0, 900, 10), 0);
  assert.equal(nearestPoint(874, 0, 900, 10), 9);
  assert.equal(nearestPoint(1000, 0, 900, 10), 9);
  assert.equal(nearestPoint(500, 0, 0, 1), 0);
});
test("dated totals group records without inserting fictional observations", () => {
  assert.deepEqual(
    groupDatedAmounts(
      [
        { created: "2026-01-02T08:00:00Z", amount: 100 },
        { created: "2026-01-02T09:00:00Z", amount: 200 },
        { created: "2026-01-04", amount: 50 },
        { created: "invalid", amount: 10 },
        { created: "2026-02-31", amount: 40 },
      ],
      "created",
      "amount",
    ),
    [
      { date: "2026-01-02", value: 300 },
      { date: "2026-01-04", value: 50 },
    ],
  );
});
test("every product guide has a complete explanation and reachable learning destination", () => {
  assert.ok(Object.keys(guides).length >= 23);
  for (const [route, guide] of Object.entries(guides)) {
    for (const key of [
      "name",
      "summary",
      "audience",
      "problem",
      "example",
      "outcome",
      "limit",
      "lesson",
    ])
      assert.ok(guide[key]?.length, route + " missing " + key);
    assert.ok(guide.steps.length >= 3, route);
    assert.ok(guide.faqs.length >= 2, route);
    assert.ok(
      fs.existsSync(path.join("dist", "learn", guide.lesson, "index.html")),
      route + " broken lesson",
    );
  }
});
test("public educational HTML exists before JavaScript and carries its own metadata", () => {
  for (const route of [
    "products/reconciliation",
    "products/business-passport",
    "products/cash-flow",
    "learn",
    "learn/cash-flow",
    "learn/digital-credentials",
    "learn/glossary",
  ]) {
    const html = fs.readFileSync(
      path.join("dist", route, "index.html"),
      "utf8",
    );
    assert.match(html, /<h1/);
    assert.match(html, /rel="canonical"/);
    assert.ok(!html.includes('<div id="root"></div>'));
    assert.ok(html.includes('data-route="/' + route + '"'));
    assert.ok(html.length > 10000);
  }
  const recon = fs.readFileSync(
    "dist/products/reconciliation/index.html",
    "utf8",
  );
  assert.ok(recon.includes("KSh 1,000"));
  assert.ok(recon.includes("Learning simulation only"));
  assert.ok(
    recon.includes(
      "<title>Payment reconciliation — How it works | AfriCore</title>",
    ),
  );
  assert.ok(
    !recon.includes("<title>What payment reconciliation actually means"),
  );
  const cash = fs.readFileSync("dist/learn/cash-flow/index.html", "utf8");
  assert.ok(cash.includes("not automatically profit"));
});
test("all rendered internal educational links point at pages or supported application entry points", () => {
  const files = [];
  function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === "index.html") files.push(p);
    }
  }
  walk("dist");
  for (const file of files) {
    const html = fs.readFileSync(file, "utf8");
    for (const match of html.matchAll(/href="(\/[^"?#]*)/g)) {
      const href = match[1];
      if (href.startsWith("/api/")) {
        assert.equal(href, "/api/openapi.json");
        continue;
      }
      if (
        /^\/(api|demo|app|signin|signup|recover|reset|verify|checkout|buyer|trust)($|\/)/.test(
          href,
        ) ||
        href === "/verify-credential"
      )
        continue;
      assert.ok(
        fs.existsSync(path.join("dist", href.slice(1), "index.html")) ||
          fs.existsSync(path.join("dist", href.slice(1))),
        file + " broken link " + href,
      );
    }
  }
});
test("record creation dates use the business display timezone at a UTC day boundary", () => {
  assert.deepEqual(
    groupDatedAmounts(
      [{ at: "2026-01-02T22:00:00Z", amount: 100 }],
      "at",
      "amount",
    ),
    [{ date: "2026-01-03", value: 100 }],
  );
});

test("controls do not advertise an unloaded year or forecast horizon", () => {
  const p = Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.UTC(2026, 0, i + 1)).toISOString().slice(0, 10),
    v: i,
  }));
  assert.equal(rangeAvailable(p, "30D"), true);
  assert.equal(rangeAvailable(p, "1Y"), false);
  assert.equal(rangeAvailable(p, "90D", true), false);
  assert.equal(rangeAvailable(p, "ALL"), true);
});
