import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ProblemResolution } from "@/components/workspace/problem-resolution";
import { DemoProvider } from "@/components/demo/demo-provider";

const account = { id: "test", email: "test@example.com", displayName: "Test", timezone: "UTC", language: "en" };
const render = (solved: boolean) => renderToStaticMarkup(createElement(DemoProvider, { account }, createElement(ProblemResolution, { id: "de305d54-75b4-431b-adb2-eb6b9e546014", solved, enabled: true, refresh: () => undefined })));

it("offers an explicit reversible problem lifecycle control", () => {
  const close = render(false);
  const reopen = render(true);
  expect(close).toContain("Mark solved"); expect(reopen).toContain("Reopen problem");
});
