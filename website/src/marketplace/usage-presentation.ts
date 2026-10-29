export const formatUnits = (value: number) => new Intl.NumberFormat('en-KE', {maximumFractionDigits: 2}).format(value);
export const planLabel = (line: {model: string}) => line.model === 'free' ? 'Free Evaluation' : 'Published estimate plan';
export function allowanceLabel(line: {model: string; included?: number; remaining_allowance?: number}) {
  if (line.included && line.included > 0) return `${formatUnits(line.remaining_allowance ?? 0)} of ${formatUnits(line.included)} remaining`;
  return line.model === 'free' ? 'Free · no usage limit configured' : 'No included allowance';
}
export function selectUsage(lines: any[], services: any[], search: string, category: string, sort: string) {
  const named = lines.map(line => ({...line, service: services.find(s => s.id === line.service_id)}));
  return named.filter(line => (!search || `${line.service?.name || line.service_id} ${line.unit}`.toLowerCase().includes(search.trim().toLowerCase())) && (category === 'all' || line.service?.category === category))
    .sort((a, b) => (sort === 'charges' ? b.estimated_minor - a.estimated_minor : sort === 'usage' ? b.quantity - a.quantity : 0) || (a.service?.name || a.service_id).localeCompare(b.service?.name || b.service_id) || a.price_id.localeCompare(b.price_id));
}
