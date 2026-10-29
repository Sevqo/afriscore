const requiredVersions = ['001-workspaces','002-stage2','003-stage3','004-account-foundation','005-workspace-experiences','006-security-hardening','007-service-marketplace','008-financial-operations','009-connected-platform','010-business-apps','011-connected-business-operations'];
interface DatabasePreparation {
  isPostgres: boolean;
  migrate: () => Promise<void>;
  dbAll: (sql: string) => Promise<{ version: string }[]>;
}
/** Hosted starts verify a separately migrated database instead of rerunning DDL on every restart. */
export async function prepareDatabase(mode: string | undefined, db: DatabasePreparation) {
  if (!mode || mode === 'migrate') return db.migrate();
  if (mode !== 'verify') throw new Error('AFRICORE_MIGRATIONS_MODE must be migrate or verify');
  if (!db.isPostgres) throw new Error('Hosted schema verification requires PostgreSQL');
  const applied = new Set((await db.dbAll('SELECT version FROM platform_migrations')).map(row => row.version));
  if (requiredVersions.some(version => !applied.has(version)))
    throw new Error('Deployment schema is incomplete; run reviewed migrations separately');
  await db.dbAll('SELECT 1 FROM ac_users, ac_memberships, ac_workspaces, ac_identity_links, ac_personal_income, ac2_objects, ac3_objects, ac_services, ac_service_prices, ac_service_entitlements, ac_service_history, ac_usage_events, ac_usage_reservations, ac_service_limits, ac_usage_alerts, ac_billing_statements, ac_finance_operations, ac_payment_event_details, ac_allocation_changes, ac_credit_notes, ac_payment_attempts, ac_provider_connections, ac_obligation_occurrences, ac_payment_inbox, ac_assistant_conversations, ac_assistant_messages, ac_workflow_versions, ac_workflow_run_versions, ac_data_lineage, ac_intelligence_policies, ac_intelligence_alerts, ac_app_installations, ac_app_history, ac_service_activation_sources, ac_products, ac_warehouses, ac_stock_locations, ac_stock_movements, ac_stock_reservations, ac_stock_incoming, ac_crm_profiles, ac_crm_entries, ac_sales_quotes, ac_sales_order_lines, ac_sales_order_links, ac_business_policies, ac_business_event_receipts, ac_saved_reports WHERE FALSE');
}
