export const discoveryPages: Record<string, {
    title: string;
    description: string;
    services: string[];
    kind: 'personal' | 'business' | 'developer';
}> = {
    '/products': { title: 'Choose services for the work you do', description: 'Browse individual capabilities, inspect their current limits and choose only the tools you need.', services: [], kind: 'business' },
    '/how-it-works': { title: 'Start with your work. Add the tools you need.', description: 'One identity can access separate Personal, Business and Developer workspaces. Each service has its own eligibility, setup and usage measure.', services: [], kind: 'business' },
    '/solutions/freelancers': { title: 'From client work to an invoice you can follow', description: 'Keep client details, issued invoices, manual income and recorded expenses in a Personal workspace without creating a company.', services: ['customers', 'invoicing', 'income', 'expenses', 'cash_flow'], kind: 'personal' },
    '/solutions/retail': { title: 'Follow a shop sale from agreement to delivery', description: 'Keep the customer, order, invoice, payment evidence and recorded costs separate but connected.', services: ['customers', 'orders', 'invoicing', 'payments', 'expenses', 'cash_flow'], kind: 'business' },
    '/solutions/suppliers': { title: 'Track goods owed, money owed and evidence shared', description: 'Use orders and receivables for the commercial work. Share selected Passport claims when a counterparty needs evidence.', services: ['orders', 'invoicing', 'fulfillment', 'passport', 'verification'], kind: 'business' },
    '/solutions/service-businesses': { title: 'Follow agreed work and the amount still owed', description: 'A service team can issue invoices, record operating costs and configure supported in-app follow-up.', services: ['customers', 'invoicing', 'expenses', 'automations'], kind: 'business' },
};
