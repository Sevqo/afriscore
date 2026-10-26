import { renderToString } from "react-dom/server";
import { App } from "./App";
import { pages } from "./content";
import { lessons } from "./education/Learn";
import { pageMetadata } from "./education/metadata";
export const publicPaths = [
  "/",
  "/docs",
  ...Object.keys(pages),
  "/learn",
  "/learn/glossary",
  ...Object.keys(lessons).map((slug) => "/learn/" + slug),
];
export function renderPublic(path: string) {
  (globalThis as any).window = { location: { pathname: path, search: "" } };
  (globalThis as any).location = { pathname: path, search: "" };
  return { html: renderToString(<App />), ...pageMetadata(path) };
}
