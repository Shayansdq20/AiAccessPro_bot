import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { getDict } from '@/lib/i18n';
import { dateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface AuditRow {
  id: string;
  adminId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  meta?: Record<string, unknown> | null;
  createdAt: string;
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page = '1' } = await searchParams;
  const { t, lang } = await getDict();
  const data = await apiFetch<{ items: AuditRow[]; total: number; page: number; pageSize: number }>(
    `/admin/audit?page=${page}`,
  );
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">🕵️ {t.audit} ({data.total})</h1>
      <div className="card overflow-x-auto !p-0">
        <table className="table-base">
          <thead>
            <tr><th>{t.action}</th><th>{t.entity}</th><th>{t.admin}</th><th>{t.details}</th><th>{t.date}</th></tr>
          </thead>
          <tbody>
            {data.items.map((row) => (
              <tr key={row.id}>
                <td><span className="badge badge-blue">{row.action}</span></td>
                <td className="text-xs" dir="ltr">{row.entityType ? `${row.entityType}:${row.entityId ?? ''}` : '—'}</td>
                <td className="text-xs" dir="ltr">{row.adminId ?? '—'}</td>
                <td className="max-w-72 truncate text-xs text-slate-500" dir="ltr">{row.meta ? JSON.stringify(row.meta) : '—'}</td>
                <td className="text-xs text-slate-500">{dateTime(row.createdAt, lang)}</td>
              </tr>
            ))}
            {data.items.length === 0 && <tr><td colSpan={5} className="text-slate-400">{t.noData}</td></tr>}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex gap-2">
          {Array.from({ length: Math.min(pages, 20) }, (_, i) => (
            <Link key={i} className={`btn btn-secondary ${data.page === i + 1 ? '!bg-slate-900 !text-white' : ''}`} href={`/audit?page=${i + 1}`}>{i + 1}</Link>
          ))}
        </div>
      )}
    </div>
  );
}
