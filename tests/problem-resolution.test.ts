import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ProblemResolution } from "@/components/workspace/problem-resolution";

it("offers an explicit reversible problem lifecycle control", () => {
  const close = renderToStaticMarkup(createElement(ProblemResolution, { id: "de305d54-75b4-431b-adb2-eb6b9e546014", solved: false, enabled: true, refresh: () => undefined }));
  const reopen = renderToStaticMarkup(createElement(ProblemResolution, { id: "de305d54-75b4-431b-adb2-eb6b9e546014", solved: true, enabled: true, refresh: () => undefined }));
  expect(close).toContain("Mark solved"); expect(reopen).toContain("Reopen problem");
});
