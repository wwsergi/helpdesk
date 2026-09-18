import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../lib/api';
import AgentLayout from '../../components/agent/AgentLayout';
import CompanyPicker from '../../components/common/CompanyPicker';
import { useAuthStore } from '../../store/authStore';

// Orden fijo, el mismo que define Intratime en clocking_types.order:
// entrada → pausa → regreso → salida. Nunca se cicla ni se reordena: el color
// identifica al tipo, no a su posición en el ranking.
const SERIES = [
    { key: 'entrada', label: 'Entrada', color: '#2a78d6' },
    { key: 'pausa',   label: 'Pausa',   color: '#eb6834' },
    { key: 'regreso', label: 'Regreso', color: '#1baf7a' },
    { key: 'salida',  label: 'Salida',  color: '#eda100' },
];

const PLANS = ['Demo', 'Basic', 'Pro'];
const DISTRIBUTORS = [{ id: 1, label: 'Conversia' }, { id: 2, label: 'Winworld' }];

const nf = new Intl.NumberFormat('es-ES');

// Paleta de estado del sistema de diseño: fija, nunca se reutiliza para series.
const HEALTH = {
    good:     { color: '#0ca30c', glyph: '✓', label: 'Correcto' },
    warning:  { color: '#fab219', glyph: '!', label: 'Revisar' },
    critical: { color: '#d03b3b', glyph: '✕', label: 'Fichaje incorrecto' },
    unknown:  { color: '#9ca3af', glyph: '–', label: 'Sin datos suficientes' },
};

// Umbrales sacados de la distribución real de la cartera, no a ojo: el 88% de
// las empresas queda por debajo del 5% de descuadre, así que 5% y 10% dejan en
// rojo al ~3% — pocas y accionables.
const WARN_AT = 5;
const CRIT_AT = 10;
const MIN_VOLUME = 20; // por debajo, el porcentaje es puro ruido

// Fichajes por empleado y día. Una jornada bien fichada son 2 como mínimo
// (entrada + salida); con pausas, 4. La moda real de la cartera cae en 2-2,5,
// así que por debajo de 2 hay jornadas sin cerrar y por debajo de 1,5 el
// fichaje está roto (solo el 0,2% de las empresas llega a ese extremo).
const PER_USER_WARN = 2;
const PER_USER_CRIT = 1.5;

/**
 * Cada entrada debería tener su salida, y cada pausa su regreso. Cuando no
 * cuadran, o la gente se olvida de fichar o lo hace mal.
 */
function clockingHealth(row) {
    const total = (row.entrada || 0) + (row.salida || 0) + (row.pausa || 0) + (row.regreso || 0);
    if (total < MIN_VOLUME) {
        return { level: 'unknown', reasons: [`Solo ${nf.format(total)} fichajes en el rango: muy pocos para valorar el descuadre.`] };
    }

    const gap = (a, b) => {
        const max = Math.max(a, b);
        return max ? (Math.abs(a - b) / max) * 100 : null;
    };

    const io = gap(row.entrada || 0, row.salida || 0);
    const pr = gap(row.pausa || 0, row.regreso || 0);

    const reasons = [];
    if (io !== null && io >= WARN_AT) {
        const falta = (row.entrada || 0) > (row.salida || 0) ? 'salidas' : 'entradas';
        reasons.push(`Entradas ${nf.format(row.entrada || 0)} frente a salidas ${nf.format(row.salida || 0)}: ${io.toFixed(1)} % de diferencia. Faltan ${falta}.`);
    }
    if (pr !== null && pr >= WARN_AT) {
        const falta = (row.pausa || 0) > (row.regreso || 0) ? 'regresos' : 'pausas';
        reasons.push(`Pausas ${nf.format(row.pausa || 0)} frente a regresos ${nf.format(row.regreso || 0)}: ${pr.toFixed(1)} % de diferencia. Faltan ${falta}.`);
    }

    // Tercera señal: intensidad de fichaje por empleado. Detecta el caso que los
    // descuadres no ven — plantilla que ficha la entrada y ya no vuelve a tocar
    // el reloj, con entradas y salidas igual de bajas y por tanto "cuadradas".
    let perUserLevel = 'good';
    const perUser = row.user_days ? total / row.user_days : null;
    if (perUser !== null && perUser < PER_USER_WARN) {
        perUserLevel = perUser < PER_USER_CRIT ? 'critical' : 'warning';
        reasons.push(`${perUser.toFixed(2)} fichajes por empleado y día, cuando una jornada completa son 2 como mínimo (entrada y salida). Hay jornadas sin cerrar.`);
    }

    const gapWorst = Math.max(io ?? 0, pr ?? 0);
    const gapLevel = gapWorst >= CRIT_AT ? 'critical' : gapWorst >= WARN_AT ? 'warning' : 'good';

    // Manda la peor de las señales.
    const rank = { good: 0, warning: 1, critical: 2 };
    const level = rank[perUserLevel] > rank[gapLevel] ? perUserLevel : gapLevel;

    if (level === 'good') reasons.push('Entradas y salidas cuadran, las pausas se cierran y cada empleado ficha su jornada completa.');

    return { level, reasons };
}

/** Semáforo. Color + glifo + etiqueta accesible: nunca solo el color. */
function HealthLight({ row, onHover, onLeave }) {
    const { level, reasons } = clockingHealth(row);
    const cfg = HEALTH[level];
    const text = `${cfg.label}. ${reasons.join(' ')}`;
    return (
        <span
            role="img"
            aria-label={text}
            tabIndex={0}
            onMouseEnter={e => onHover(e, text)}
            onMouseMove={e => onHover(e, text)}
            onMouseLeave={onLeave}
            onFocus={e => onHover(e, text)}
            onBlur={onLeave}
            className="inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-[11px] font-bold cursor-help shrink-0"
            style={{ backgroundColor: cfg.color }}
        >{cfg.glyph}</span>
    );
}


function defaultDates() {
    const to = new Date();
    const from = new Date();
    from.setMonth(from.getMonth() - 3);
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
    const [view, setView] = useState('bars');
    const [tip, setTip] = useState(null);

    const { data, isLoading } = useQuery({
        queryKey: ['fichajes_by_company', dates.from, dates.to, plan, distributor, company?.id ?? null],
        queryFn: async () => {
            const p = new URLSearchParams({ date_from: dates.from, date_to: dates.to, limit: 50 });
            if (plan) p.set('plan', plan);
            if (distributor) p.set('distributor_id', distributor);
            if (company) p.set('contact_id', company.id);
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
    const showConcentration = !company
        && (data?.company_count ?? 0) > (data?.companies?.length ?? 0);

    return (
        <AgentLayout>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Fichajes por Empresa</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Top 50 clientes por volumen. Cada barra mide lo mismo para comparar el reparto por tipo;
                        el volumen real está en la cifra de la derecha.
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
                    {['good', 'warning', 'critical'].map(k => (
                        <div key={k} className="flex items-center gap-2">
                            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-white text-[10px] font-bold"
                                style={{ backgroundColor: HEALTH[k].color }}>{HEALTH[k].glyph}</span>
                            <span className="text-sm text-gray-600">{HEALTH[k].label}</span>
                        </div>
                    ))}
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
                                        {!r.isRest && r.plan && (
                                            <span className="text-xs text-gray-400">{r.plan}</span>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-[120px]">
                                        <SplitBar row={r} onHover={onHover} onLeave={onLeave} />
                                    </div>
                                    <span className="w-24 text-right text-sm font-medium text-gray-900 tabular-nums">
                                        {nf.format(r.total)}
                                    </span>
                                    <span className="w-5 flex justify-center">
                                        {!r.isRest && <HealthLight row={r} onHover={onHover} onLeave={onLeave} />}
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
                                                {!r.isRest && <HealthLight row={r} onHover={onHover} onLeave={onLeave} />}
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
