import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import apiClient from '../../lib/api';
import AgentLayout from '../../components/agent/AgentLayout';
import CompanyPicker from '../../components/common/CompanyPicker';
import HealthLight, { HealthLegend } from '../../components/common/HealthLight';
import { HEALTH } from '../../components/common/healthStatus';
import { useAuthStore } from '../../store/authStore';

const PLANS = ['Demo', 'Basic', 'Pro'];
const DISTRIBUTORS = [{ id: 1, label: 'Conversia' }, { id: 2, label: 'Winworld' }];
const nf = new Intl.NumberFormat('es-ES');

function defaultDates() {
    const to = new Date();
    const from = new Date();
    from.setMonth(from.getMonth() - 3);
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

const COLUMNS = [
    { key: 'name',     label: 'Cliente',            align: 'text-left' },
    { key: null,       label: 'Plan',               align: 'text-left' },
    { key: 'total',    label: 'Fichajes',           align: 'text-right' },
    { key: 'usage',    label: '% uso',              align: 'text-right', hint: 'Empleados que fichan sobre la plantilla activa' },
    { key: 'gap',      label: 'Descuadre',          align: 'text-right', hint: 'El peor de entrada/salida y pausa/regreso' },
    { key: 'per_user', label: 'Fich./empleado·día', align: 'text-right', hint: 'Una jornada completa son 2 como mínimo' },
    { key: 'status',   label: 'Estado',             align: 'text-center' },
];

/** Reparto del semáforo sobre el total filtrado, como barra apilada. */
function StatusBar({ summary }) {
    const evaluable = summary.good + summary.warning + summary.critical + summary.unknown;
    if (!evaluable) return null;
    const parts = [
        ['good', summary.good], ['warning', summary.warning],
        ['critical', summary.critical], ['unknown', summary.unknown],
    ].filter(([, n]) => n > 0);

    return (
        <div>
            <div className="flex h-3 w-full gap-[2px]">
                {parts.map(([k, n], i) => (
                    <div key={k}
                        title={`${HEALTH[k].label}: ${nf.format(n)} (${(n / evaluable * 100).toFixed(1)} %)`}
                        style={{
                            width: `${(n / evaluable) * 100}%`,
                            backgroundColor: HEALTH[k].color,
                            borderTopLeftRadius: i === 0 ? 4 : 0,
                            borderBottomLeftRadius: i === 0 ? 4 : 0,
                            borderTopRightRadius: i === parts.length - 1 ? 4 : 0,
                            borderBottomRightRadius: i === parts.length - 1 ? 4 : 0,
                        }} />
                ))}
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2">
                {parts.map(([k, n]) => (
                    <span key={k} className="text-xs text-gray-500">
                        <span className="inline-block w-2 h-2 rounded-full mr-1 align-middle" style={{ backgroundColor: HEALTH[k].color }} />
                        {HEALTH[k].label}: <span className="text-gray-800 font-medium">{nf.format(n)}</span> ({(n / evaluable * 100).toFixed(1)} %)
                    </span>
                ))}
            </div>
        </div>
    );
}

export default function ClockingQuality() {
    const { user } = useAuthStore();
    const isAdmin = user?.role === 'admin';

    const [dates, setDates] = useState(defaultDates);
    const [plan, setPlan] = useState('');
    const [distributor, setDistributor] = useState('');
    const [company, setCompany] = useState(null);
    const [status, setStatus] = useState('');
    const [sort, setSort] = useState('total');
    const [dir, setDir] = useState('desc');
    const [page, setPage] = useState(1);
    const [tip, setTip] = useState(null);

    const filters = { from: dates.from, to: dates.to, plan, distributor, companyId: company?.id ?? null, status };

    const { data, isFetching } = useQuery({
        queryKey: ['clocking_quality', filters, sort, dir, page],
        queryFn: async () => {
            const p = new URLSearchParams({
                date_from: dates.from, date_to: dates.to,
                sort, dir, page, per_page: 50,
            });
            if (plan) p.set('plan', plan);
            if (distributor) p.set('distributor_id', distributor);
            if (company) p.set('contact_id', company.id);
            if (status) p.set('status', status);
            return (await apiClient.get(`/statistics/fichajes-health?${p}`)).data;
        },
        enabled: isAdmin,
        placeholderData: keepPreviousData,
    });

    const onHover = (e, text) => setTip({ x: e.clientX, y: e.clientY, text });
    const onLeave = () => setTip(null);

    // Cambiar cualquier filtro devuelve a la página 1: quedarse en la 40 de un
    // listado que ahora tiene 3 páginas deja la pantalla en blanco.
    const resetting = fn => (...args) => { setPage(1); fn(...args); };

    const toggleSort = key => {
        if (!key) return;
        if (sort === key) setDir(d => (d === 'desc' ? 'asc' : 'desc'));
        else { setSort(key); setDir('desc'); }
        setPage(1);
    };

    if (!isAdmin) return <AgentLayout><div className="p-8 text-gray-500">Sin permisos.</div></AgentLayout>;

    const s = data?.summary;
    const evaluable = s ? s.good + s.warning + s.critical : 0;

    return (
        <AgentLayout>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Calidad de fichaje</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Todos los clientes con actividad en el rango. El semáforo cruza tres señales:
                        entradas contra salidas, pausas contra regresos, y fichajes por empleado y día.
                    </p>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                    <div className="flex flex-wrap items-end gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
                            <input type="date" value={dates.from} onChange={resetting(e => setDates(d => ({ ...d, from: e.target.value })))}
                                className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
                            <input type="date" value={dates.to} onChange={resetting(e => setDates(d => ({ ...d, to: e.target.value })))}
                                className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Plan</label>
                            <select value={plan} onChange={resetting(e => setPlan(e.target.value))}
                                className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
                                <option value="">Todos</option>
                                {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Distribuidor</label>
                            <select value={distributor} onChange={resetting(e => setDistributor(e.target.value))}
                                className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
                                <option value="">Todos</option>
                                {DISTRIBUTORS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Estado</label>
                            <select value={status} onChange={resetting(e => setStatus(e.target.value))}
                                className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
                                <option value="">Todos</option>
                                <option value="critical">Solo fichaje incorrecto</option>
                                <option value="warning">Solo a revisar</option>
                                <option value="good">Solo correctos</option>
                                <option value="unknown">Sin datos suficientes</option>
                            </select>
                        </div>
                        <div className="min-w-[240px]">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Cliente</label>
                            <CompanyPicker value={company} onChange={resetting(setCompany)} placeholder="Todos los clientes" />
                        </div>
                    </div>
                </div>

                {s && (
                    <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                ['Clientes con actividad', nf.format(s.clients)],
                                ['Fichando bien', evaluable ? `${(s.good / evaluable * 100).toFixed(1)} %` : '—'],
                                ['Requieren atención', nf.format(s.warning + s.critical)],
                                ['Uso medio de plantilla', s.usage_avg !== null ? `${s.usage_avg} %` : '—'],
                            ].map(([label, value]) => (
                                <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                                    <div className="text-xs text-gray-500">{label}</div>
                                    <div className="text-xl font-semibold text-gray-900 mt-1">{value}</div>
                                </div>
                            ))}
                        </div>

                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                            <h2 className="text-sm font-semibold text-gray-700 mb-3">Reparto de la cartera</h2>
                            <StatusBar summary={s} />
                            {s.usage_unknown > 0 && (
                                <p className="text-xs text-gray-400 mt-3">
                                    El % de uso no se puede calcular en {nf.format(s.usage_unknown)} clientes: Intratime no tiene
                                    registrada su plantilla activa. Quedan fuera de la media, no computan como 0.
                                </p>
                            )}
                        </div>
                    </>
                )}

                <div className="flex flex-wrap items-center gap-4">
                    <HealthLegend />
                </div>

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50 text-gray-500">
                                <tr>
                                    {COLUMNS.map(c => (
                                        <th key={c.label} title={c.hint}
                                            className={`px-4 py-2 font-medium ${c.align} ${c.key ? 'cursor-pointer select-none hover:text-gray-800' : ''}`}
                                            onClick={() => toggleSort(c.key)}>
                                            {c.label}
                                            {sort === c.key && <span className="ml-1">{dir === 'desc' ? '↓' : '↑'}</span>}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {(data?.data ?? []).map(r => (
                                    <tr key={r.company_external_id} className="hover:bg-gray-50">
                                        <td className="px-4 py-2 text-gray-800 max-w-xs truncate" title={r.name}>{r.name}</td>
                                        <td className="px-4 py-2 text-gray-500">{r.plan || '—'}</td>
                                        <td className="px-4 py-2 text-right tabular-nums text-gray-900">{nf.format(r.total)}</td>
                                        <td className="px-4 py-2 text-right tabular-nums text-gray-700">
                                            {r.usage_pct !== null ? `${r.usage_pct} %` : <span className="text-gray-300">—</span>}
                                        </td>
                                        <td className="px-4 py-2 text-right tabular-nums text-gray-700">
                                            {Math.max(r.gap_io ?? -1, r.gap_pr ?? -1) >= 0
                                                ? `${Math.max(r.gap_io ?? 0, r.gap_pr ?? 0).toFixed(1)} %`
                                                : <span className="text-gray-300">—</span>}
                                        </td>
                                        <td className="px-4 py-2 text-right tabular-nums text-gray-700">
                                            {r.per_user !== null ? r.per_user.toFixed(2) : <span className="text-gray-300">—</span>}
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                            <HealthLight status={r.status} reasons={r.reasons} onHover={onHover} onLeave={onLeave} />
                                        </td>
                                    </tr>
                                ))}
                                {!isFetching && (data?.data ?? []).length === 0 && (
                                    <tr><td colSpan={COLUMNS.length} className="px-4 py-10 text-center text-gray-400">
                                        No hay clientes que cumplan estos filtros.
                                    </td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {data && data.last_page > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                            <span className="text-xs text-gray-500">
                                {nf.format(data.total)} clientes · página {data.page} de {nf.format(data.last_page)}
                                {isFetching && ' · actualizando…'}
                            </span>
                            <div className="flex gap-2">
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={data.page <= 1}
                                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">Anterior</button>
                                <button onClick={() => setPage(p => Math.min(data.last_page, p + 1))} disabled={data.page >= data.last_page}
                                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">Siguiente</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {tip && (
                <div className="fixed z-50 pointer-events-none bg-gray-900 text-white text-xs rounded px-2 py-1 shadow-lg max-w-sm"
                    style={{ left: tip.x + 12, top: tip.y + 12 }}>
                    {tip.text}
                </div>
            )}
        </AgentLayout>
    );
}
