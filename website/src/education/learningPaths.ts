export const learningVersion = 1;
export type LearningPath = {
    title: string;
    audience: string;
    objective: string;
    lessons: string[];
};
export const learningPaths: Record<string, LearningPath> = {
    'freelancer-starter': { title: 'Freelancer starter', audience: 'Independent professionals', objective: 'Follow a client invoice, record costs and understand what is still owed. Invoicing and Expenses are eligible in Personal workspaces.', lessons: ['organize-business-records', 'receivables', 'cash-flow'] },
    'small-shop-starter': { title: 'Small shop starter', audience: 'Retailers and small teams', objective: 'Separate orders, invoices, payment evidence and recorded movement in a Business workspace.', lessons: ['organize-business-records', 'receivables', 'payment-links', 'reconciliation', 'cash-flow'] },
    'business-trust-starter': { title: 'Business trust starter', audience: 'Suppliers and counterparties', objective: 'Understand evidence review, private Passport sharing and independent credential checks before requesting access.', lessons: ['business-trust', 'business-passport', 'digital-credentials', 'private-sharing', 'blockchain-proof'] },
    'developer-starter': { title: 'Developer starter', audience: 'Software builders', objective: 'Understand test environments, scoped requests, safe retries and authorized source data before using the Developer Console.', lessons: ['sandbox', 'api-basics', 'connect-and-data', 'digital-credentials'] },
};
export const knowledgeChecks: Record<string, {
    question: string;
    choices: string[];
    answer: number;
    explanation: string;
}> = {
    receivables: { question: 'An issued KSh 50,000 invoice has KSh 30,000 allocated. What remains owed?', choices: ['KSh 50,000', 'KSh 20,000', 'Nothing: issuing confirms payment'], answer: 1, explanation: 'The remaining receivable is KSh 50,000 − KSh 30,000 = KSh 20,000. Issuing does not confirm receipt.' },
    reconciliation: { question: 'Two payments have the same amount. Is that enough to allocate one?', choices: ['Yes', 'No: check currency, reference and document context'], answer: 1, explanation: 'Equal amounts can belong to different customers. Ambiguity requires review.' },
    'cash-flow': { question: 'Does positive net recorded movement establish an available bank balance?', choices: ['Yes', 'No: opening position and complete verified activity are also needed'], answer: 1, explanation: 'Covered movement excludes missing activity and does not establish profit or available cash.' },
    'digital-credentials': { question: 'What does a valid signature alone establish?', choices: ['Every claim is true', 'Integrity of the signed claim under the checked key'], answer: 1, explanation: 'Issuer authority, expiry, status and underlying evidence need separate checks.' },
    'private-sharing': { question: 'Can revoking access erase a copy already received?', choices: ['Yes', 'No'], answer: 1, explanation: 'Revocation stops supported future access. Choose the recipient and minimum disclosure carefully.' },
    'payment-links': { question: 'When should a business treat a payment request as confirmed?', choices: ['When its link opens', 'After appropriate trusted provider confirmation'], answer: 1, explanation: 'Opening checkout and requesting payment do not establish receipt.' },
    automation: { question: 'Does a reminder workflow move money?', choices: ['Yes', 'No'], answer: 1, explanation: 'Supported in-app reminders notify people; they do not authorize or execute payments.' },
};
export function parseLearningProgress(raw: string | null): string[] {
    try {
        const value = JSON.parse(raw || 'null');
        return value?.version === learningVersion && Array.isArray(value.completed) ? [...new Set<string>(value.completed.filter((s: unknown): s is string => typeof s === 'string'))].slice(0, 100) : [];
    }
    catch {
        return [];
    }
}
