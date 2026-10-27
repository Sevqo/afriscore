import { useEffect } from "react";
import { pages } from "../content";
import { guides } from "./guides";
import { lessons } from "./Learn";
export function pageMetadata(path: string) {
  if(path==='/get-started'||path==='/signup'||path.startsWith('/sign-up/')||path==='/login'||path==='/signin'||path.startsWith('/app')||path==='/auth/callback') {
    return {title:path==='/get-started'||path==='/signup'?'Choose your AfriCore experience':path.startsWith('/sign-up/')?'Create your AfriCore '+path.split('/')[2]+' account':path==='/login'||path==='/signin'?'Sign in to AfriCore':path.startsWith('/app/personal')?'AfriCore Personal':path.startsWith('/app/developer')?'AfriCore Developer Console':'Your AfriCore workspaces',description:'One identity for your Personal, Business and Developer workspaces. Access follows your current memberships.'};
  }
  const lesson = path.startsWith("/learn/")
      ? lessons[path.split("/")[2]]
      : undefined,
    guide = guides[path];
  return {
    title:
      path === "/verify-credential"
        ? "Verify a business credential | AfriCore"
        : path === "/signin"
          ? "Sign in to AfriCore Business"
          : path === "/signup"
            ? "Create your AfriCore workspace"
            : path === "/"
              ? "AfriCore — Customers, invoices, payments and business proof"
              : path === "/learn"
                ? "AfriCore Learn — Practical business and finance guides"
                : path === "/learn/glossary"
                  ? "Financial and business glossary | AfriCore"
                  : lesson
                    ? lesson.title + " | AfriCore Learn"
                    : guide
                      ? guide.name + " — How it works | AfriCore"
                      : pages[path]
                        ? pages[path].category + " | AfriCore"
                        : "AfriCore Business workspace",
    description:
      lesson?.definition ||
      guide?.summary ||
      pages[path]?.description ||
      "Organize business records, follow payment evidence and understand what is still owed. Find the workspace that fits your work.",
  };
}
export function usePageMetadata(path: string) {
  useEffect(() => {
    const meta = pageMetadata(path);
    document.title = meta.title;
    let description = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );
    if (!description) {
      description = document.createElement("meta");
      description.name = "description";
      document.head.append(description);
    }
    description.content = meta.description;
    let canonical = document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.append(canonical);
    }
    canonical.href = location.origin + path;
  }, [path]);
}
