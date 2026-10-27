import { type ReactNode } from "react";
export const types = [
  {
    kind: "personal",
    title: "Personal",
    icon: "user",
    description:
      "Manage your own work, invoices, income and expenses without setting up a company.",
  },
  {
    kind: "business",
    title: "Business",
    icon: "grid",
    description:
      "Run your business with connected customers, invoices, payments, team tools and financial insights.",
  },
  {
    kind: "developer",
    title: "Developer",
    icon: "code",
    description:
      "Build applications with AfriCore APIs, sandbox testing, webhooks and developer tools.",
  },
];
export const url = (w: any) =>
  w.kind === "business" ? "/app/business/" + w.id : "/app/" + w.kind;
export const money = (n: number, currency = "KES") =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency }).format(
    Number(n || 0) / (["UGX", "RWF"].includes(currency) ? 1 : 100),
  );
export const amount = (v: FormDataEntryValue | null, currency: string) => {
  const scaled = Number(v) * (["UGX", "RWF"].includes(currency) ? 1 : 100);
  if (
    !Number.isSafeInteger(Math.round(scaled)) ||
    scaled <= 0 ||
    Math.abs(scaled - Math.round(scaled)) > 0.000001
  )
    throw new Error(
      "Enter a positive amount using the currency’s supported decimal places.",
    );
  return Math.round(scaled);
};
export const today = (timezone = "Africa/Nairobi") =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Alert({ error }: { error: string }) {
  return error ? (
    <p className="alert error" role="alert">
      {error}
    </p>
  ) : null;
}
export function Currency(props: any) {
  return (
    <select
      {...props}
      {...(props.value === undefined
        ? { defaultValue: props.defaultValue || "KES" }
        : {})}
    >
      {["KES", "USD", "EUR", "GBP", "UGX", "TZS", "RWF"].map((c) => (
        <option key={c}>{c}</option>
      ))}
    </select>
  );
}
