# Personal workspace

Personal setup collects display/workspace name, country, currency and timezone. Company registration and merchant onboarding are absent. /app/personal offers Overview, Income, Expenses, Invoices, Clients, Payment Records, Cash Flow, Reports, Learn and Settings.

Clients and invoices reuse validated persistent records. Draft invoices can be issued; the existing transition/payment rules remain. Expenses reuse append/correction finance services. Manual income is a separate normalized table, explicitly never provider evidence. Amounts are integer minor units with explicit currency.

The summary filters recorded income/expenses by currency and optional dates. Recorded net is their difference, not profit, a bank balance or custody. Outstanding invoices cover all current open dates and are labelled separately. Provider records stay separate. Sandbox and personal production records use separate environments; production access requires verified email.

Empty history is shown as empty, with quick actions. Lists show up to 100 records while summary aggregates all matching records; pagination/export beyond that is future UI work. Financial rows are not merged when adding Business or Developer workspaces. Optional recurring invoices, projects and annual exports are not implemented by this change.
