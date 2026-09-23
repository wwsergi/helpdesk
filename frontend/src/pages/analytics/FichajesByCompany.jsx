import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../lib/api';
import AgentLayout from '../../components/agent/AgentLayout';
import CompanyPicker from '../../components/common/CompanyPicker';
import { useAuthStore } from '../../store/authStore';
import HealthLight, { HealthLegend } from '../../components/common/HealthLight';

// Orden fijo, el mismo que define Intratime en clocking_types.order:
// entrada → pausa → regreso → salida. Nunca se cicla ni se reordena: el color
// identifica al tipo, no a su posición en el ranking.
const SERIES = [
    { key: 'entrada', label: 'Entrada', color: '#2a78d6' },
    { key: 'pausa',   label: 'Pausa',   color: '#eb6834' },
    { key: 'regreso', label: 'Regreso', color: '#1baf7a' },
    { key: 'salida',  label: 'Salida',  color: '#eda100' },
];

// Tramos de plan por usuarios contratados. Reflejan PLAN_TIERS del
// StatisticsController: 142 valores distintos de max_users no caben en un
// desplegable, y estos tramos salen del reparto real de la cartera.
const PLAN_TIERS = [
    { key: '1', label: '1 usuario' },
    { key: '2-5', label: '2-5 usuarios' },
    { key: '6-10', label: '6-10 usuarios' },
    { key: '11-25', label: '11-25 usuarios' },
    { key: '26-50', label: '26-50 usuarios' },
    { key: '51-100', label: '51-100 usuarios' },
    { key: '100+', label: 'Más de 100' },
    { key: 'none', label: 'Sin plan' },
];

const PLANS = ['Demo', 'Basic', 'Pro'];
// Convención de la aplicación: 1 es Conversia y 2 significa "Winworld", que
// agrupa todo lo que no es Conversia, incluidos los contactos sin distribuidor.
const DISTRIBUTORS = [{ id: 1, label: 'Conversia' }, { id: 2, label: 'Winworld' }];

const nf = new Intl.NumberFormat('es-ES');

// Los selectores de fecha arrancan en una semana: con 5,2 M de filas agregadas,
// abrir una pantalla y pedir un año por defecto es lento y casi nunca es lo que
// se quiere mirar primero. Ampliar el rango es un clic.
function defaultDates() {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 7);
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

/** Barra apilada normalizada: todas miden lo mismo, solo cambia el reparto. */
function SplitBar({ row, onHover, onLeave }) {
    const total = SERIES.reduce((a, s) => a + (row[s.key] || 0), 0);
    if (!total) return <div className="h-3 rounded bg-gray-100" />;

    const visible = SERIES.filter(s => (row[s.key] || 0) > 0);

    return (
        <div className="flex h-3 w-full gap-[2px]">
            {visible.map((s, i) => {
                const pct = (row[s.key] / total) * 100;
                const first = i === 0;
                const last = i === visible.length - 1;
                return (
                    <div
                        key={s.key}
                        style={{
                            width: `${pct}%`,
                            backgroundColor: s.color,
                            borderTopLeftRadius: first ? 4 : 0,
                            borderBottomLeftRadius: first ? 4 : 0,
                            borderTopRightRadius: last ? 4 : 0,
                            borderBottomRightRadius: last ? 4 : 0,
                        }}
                        onMouseEnter={e => onHover(e, `${s.label}: ${nf.format(row[s.key])} (${pct.toFixed(1)} %)`)}
                        onMouseMove={e => onHover(e, `${s.label}: ${nf.format(row[s.key])} (${pct.toFixed(1)} %)`)}
                        onMouseLeave={onLeave}
                    />
                );
            })}
        </div>
    );
}

export default function FichajesByCompany() {
    const { user } = useAuthStore();
    const isAdmin = user?.role === 'admin';

    const [dates, setDates] = useState(defaultDates);
    const [plan, setPlan] = useState('');
    const [distributor, setDistributor] = useState('');
    const [company, setCompany] = useState(null);
    const [planTier, setPlanTier] = useState('');
    const [groupBy, setGroupBy] = useState('company');
    const [view, setView] = useState('bars');
    const [tip, setTip] = useState(null);

    const { data, isLoading } = useQuery({
        queryKey: ['fichajes_by_company', dates.from, dates.to, plan, distributor, planTier, groupBy, company?.id ?? null],
        queryFn: async () => {
            const p = new URLSearchParams({ date_from: dates.from, date_to: dates.to, limit: 50 });
            if (plan) p.set('plan', plan);
            if (distributor) p.set('distributor', distributor);
            if (company) p.set('contact_id', company.id);
            if (planTier) p.set('plan_tier', planTier);
            if (groupBy === 'plan') p.set('group_by', 'plan');
            return (await apiClient.get(`/statistics/fichajes-by-company?${p}`)).data;
        },
        enabled: isAdmin,
    });

    const rows = useMemo(() => {
        if (!data) return [];
        const list = [...(data.companies || [])];
        // "Resto" siempre al final: no compite en el ranking, lo cierra.
        if (data.rest) list.push({ ...data.rest, name: `Resto de clientes`, isRest: true });
        return list;
    }, [data]);

    const onHover = (e, text) => setTip({ x: e.clientX, y: e.clientY, text });
    const onLeave = () => setTip(null);

    if (!isAdmin) {
        return <AgentLayout><div className="p-8 text-gray-500">Sin permisos.</div></AgentLayout>;
    }

    const totals = data?.totals;
    const pctManual = totals?.total ? (totals.manuales / totals.total) * 100 : 0;

    // Qué parte del volumen total acumula el top N. Con la cola larga que tiene
    // esta cartera suele rondar el 17%, y saberlo evita leer el ranking como si
    // fuera el grueso del negocio.
    const topTotal = (data?.companies || []).reduce((a, c) => a + c.total, 0);
    const concentration = totals?.total ? (topTotal / totals.total) * 100 : 0;
    const showConcentration = !company && groupBy === 'company'
        && (data?.company_count ?? 0) > (data?.companies?.length ?? 0);

    return (
        <AgentLayout>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Fichajes por Empresa</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {groupBy === 'plan'
                            ? 'Agrupado por tramo de plan. Cada barra mide lo mismo para comparar el reparto por tipo; el volumen real está en la cifra de la derecha.'
                            : 'Top 50 clientes por volumen. Cada barra mide lo mismo para comparar el reparto por tipo; el volumen real está en la cifra de la derecha.'}
                    </p>
                </div>

                {/* Filtros, en una sola fila sobre el gráfico */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                    <div className="flex flex-wrap items-end gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
                            <input type="date" value={dates.from} onChange={e => setDates(d => ({ ...d, from: e.target.value }))}
                                className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
                            <input type="date" value={dates.to} onChange={e => setDates(d => ({ ...d, to: e.target.value }))}
                                className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Plan</label>
                            <select value={plan} onChange={e => setPlan(e.target.value)}
                                className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
                                <option value="">Todos</option>
                                {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Distribuidor</label>
                            <select value={distributor} onChange={e => setDistributor(e.target.value)}
                                className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
                                <option value="">Todos</option>
                                {DISTRIBUTORS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                            </select>
                        </div>
                        <div className="min-w-[240px]">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Cliente</label>
                            <CompanyPicker value={company} onChange={setCompany} placeholder="Todos los clientes" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Plan (usuarios)</label>
                            <select value={planTier} onChange={e => setPlanTier(e.target.value)}
                                className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
                                <option value="">Todos</option>
                                {PLAN_TIERS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Agrupar por</label>
                            <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                                {[['company', 'Empresa'], ['plan', 'Plan']].map(([v, l]) => (
                                    <button key={v} onClick={() => { setGroupBy(v); }}
                                        className={`px-4 py-2 text-sm font-medium transition ${groupBy === v ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                                        {l}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="ml-auto">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Vista</label>
                            <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                                {[['bars', 'Barras'], ['table', 'Tabla']].map(([v, l]) => (
                                    <button key={v} onClick={() => setView(v)}
                                        className={`px-4 py-2 text-sm font-medium transition ${view === v ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                                        {l}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Resumen */}
                {totals && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            {
                                label: 'Fichajes en el rango',
                                value: nf.format(totals.total),
                            },
                            {
                                label: 'Clientes con actividad',
                                value: nf.format(data.company_count ?? 0),
                            },
                            // El dato que más sorprende: el ranking pesa mucho menos de
                            // lo que aparenta. Se oculta cuando no hay cola que medir
                            // (un solo cliente filtrado, o menos clientes que el top N).
                            ...(showConcentration ? [{
                                label: `Concentración del top ${data.limit}`,
                                value: `${concentration.toFixed(1)} %`,
                                hint: `el ${(100 - concentration).toFixed(1)} % restante se reparte entre ${nf.format((data.company_count ?? 0) - (data.companies?.length ?? 0))} clientes`,
                            }] : []),
                            {
                                label: 'Introducidos a mano',
                                value: `${pctManual.toFixed(1)} %`,
                            },
                        ].map(({ label, value, hint }) => (
                            <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                                <div className="text-xs text-gray-500">{label}</div>
                                <div className="text-xl font-semibold text-gray-900 mt-1">{value}</div>
                                {hint && <div className="text-xs text-gray-400 mt-1 leading-snug">{hint}</div>}
                            </div>
                        ))}
                    </div>
                )}

                {/* Leyenda: la identidad nunca queda solo en el color */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    {SERIES.map(s => (
                        <div key={s.key} className="flex items-center gap-2">
                            <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: s.color }} />
                            <span className="text-sm text-gray-600">{s.label}</span>
                        </div>
                    ))}
                    <span className="hidden md:inline-block h-4 w-px bg-gray-300 mx-1" />
                    <HealthLegend />
                </div>

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    {isLoading ? (
                        <div className="p-10 text-center text-gray-400">Cargando…</div>
                    ) : rows.length === 0 ? (
                        <div className="p-10 text-center text-gray-400">No hay fichajes en este rango con estos filtros.</div>
                    ) : view === 'bars' ? (
                        <div className="divide-y divide-gray-100">
                            {rows.map((r, i) => (
                                <div key={r.company_external_id || `rest-${i}`}
                                    className={`flex items-center gap-4 px-5 py-3 ${r.isRest ? 'bg-gray-50' : ''}`}>
                                    <span className="w-7 text-xs text-gray-400 tabular-nums">{r.isRest ? '' : i + 1}</span>
                                    <div className="w-64 shrink-0">
                                        <div className={`text-sm truncate ${r.isRest ? 'italic text-gray-600' : 'text-gray-800'}`} title={r.name}>
                                            {r.name}
                                        </div>
                                        {!r.isRest && (groupBy === 'plan'
                                            ? <span className="text-xs text-gray-400">{nf.format(r.companies ?? 0)} empresas</span>
                                            : r.plan && <span className="text-xs text-gray-400">{r.plan}</span>)}
                                    </div>
                                    <div className="flex-1 min-w-[120px]">
                                        <SplitBar row={r} onHover={onHover} onLeave={onLeave} />
                                    </div>
                                    <span className="w-24 text-right text-sm font-medium text-gray-900 tabular-nums">
                                        {nf.format(r.total)}
                                    </span>
                                    <span className="w-5 flex justify-center">
                                        {!r.isRest && <HealthLight status={r.status} reasons={r.reasons} onHover={onHover} onLeave={onLeave} />}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="bg-gray-50 text-gray-500">
                                    <tr>
                                        <th className="px-4 py-2 text-left font-medium">#</th>
                                        <th className="px-4 py-2 text-left font-medium">Cliente</th>
                                        <th className="px-4 py-2 text-left font-medium">Plan</th>
                                        {SERIES.map(s => (
                                            <th key={s.key} className="px-4 py-2 text-right font-medium">{s.label}</th>
                                        ))}
                                        <th className="px-4 py-2 text-right font-medium">Manuales</th>
                                        <th className="px-4 py-2 text-right font-medium">Total</th>
                                        <th className="px-4 py-2 text-center font-medium">Estado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {rows.map((r, i) => (
                                        <tr key={r.company_external_id || `rest-${i}`} className={r.isRest ? 'bg-gray-50 italic' : ''}>
                                            <td className="px-4 py-2 text-gray-400 tabular-nums">{r.isRest ? '' : i + 1}</td>
                                            <td className="px-4 py-2 text-gray-800">{r.name}</td>
                                            <td className="px-4 py-2 text-gray-500">{r.plan || '—'}</td>
                                            {SERIES.map(s => (
                                                <td key={s.key} className="px-4 py-2 text-right tabular-nums text-gray-700">{nf.format(r[s.key] || 0)}</td>
                                            ))}
                                            <td className="px-4 py-2 text-right tabular-nums text-gray-500">{nf.format(r.manuales || 0)}</td>
                                            <td className="px-4 py-2 text-right tabular-nums font-medium text-gray-900">{nf.format(r.total)}</td>
                                            <td className="px-4 py-2 text-center">
                                                {!r.isRest && <HealthLight status={r.status} reasons={r.reasons} onHover={onHover} onLeave={onLeave} />}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {tip && (
                <div className="fixed z-50 pointer-events-none bg-gray-900 text-white text-xs rounded px-2 py-1 shadow-lg"
                    style={{ left: tip.x + 12, top: tip.y + 12 }}>
                    {tip.text}
                </div>
            )}
        </AgentLayout>
    );
}
