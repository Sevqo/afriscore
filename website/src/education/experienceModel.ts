// Local teaching arithmetic; never a substitute for the server allocation engine.
export function matchingExample(inspected: boolean, event: string) {
  const applied = inspected && event === "matched";
  const allocated = 1500 + (applied ? 1000 : 0);
  const messages: Record<string, [string, string]> = {
    matched: [
      "Invoice fully paid in this example",
      "Receipt B adds KSh 1,000 once. The two independent receipts total KSh 2,500.",
    ],
    unmatched: [
      "Unmatched: manual review",
      "The reference does not identify this invoice. Nothing further is allocated.",
    ],
    duplicate: [
      "Duplicate ignored",
      "Receipt A was already allocated. Replaying it does not add money.",
    ],
    mismatch: [
      "Amount mismatch: review",
      "KSh 3,000 exceeds the KSh 1,000 remainder. No automatic allocation.",
    ],
    currency: [
      "Currency mismatch: review",
      "A different currency cannot reduce this KES balance.",
    ],
  };
  const [status, detail] = inspected
    ? messages[event] || messages.unmatched
    : [
        "Partially paid",
        "Receipt A covers KSh 1,500. Inspect a second event to see what changes.",
      ];
  return { allocated, remaining: 2500 - allocated, status, detail };
}
