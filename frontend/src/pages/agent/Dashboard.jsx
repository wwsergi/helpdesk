import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
    ResponsiveContainer, LineChart, Line, BarChart, Bar,
    CartesianGrid, XAxis, YAxis, Tooltip, Legend,
} from 'recharts';
import { useAuthStore } from '../../store/authStore';
import apiClient from '../../lib/api';
import AgentLayout from '../../components/agent/AgentLayout';
import CreateTicketModal from '../../components/CreateTicketModal';

const MONTHS = [
    'Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

const currentYear  = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;
const YEARS = Array.from({ length: 4 }, (_, i) => currentYear - i);

function pctBadge(val) {
    if (val === null || val === undefined) return null;
    const positive = val >= 0;
    return (
        <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${positive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {positive ? '+' : ''}{val}%
        </span>
    );
}

function KpiCard({ title, value, sub, color, badge, icon }) {
    const colors = {
        blue:   'border-blue-100 bg-blue-50 text-blue-700',
        green:  'border-green-100 bg-green-50 text-green-700',
        orange: 'border-orange-100 bg-orange-50 text-orange-700',
        red:    'border-red-100 bg-red-50 text-red-700',
        purple: 'border-purple-100 bg-purple-50 text-purple-700',
        yellow: 'border-yellow-100 bg-yellow-50 text-yellow-700',
    };
    return (
        <div className={`rounded-xl border p-5 ${colors[color]}`}>
            <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium opacity-80 leading-tight">{title}</p>
                {badge && <div className="shrink-0">{badge}</div>}
            </div>
            <p className="text-3xl font-bold mt-2">{value ?? '—'}</p>
            {sub && <p className="text-xs mt-1 opacity-60">{sub}</p>}
        </div>
    );
}

function Spinner() {
    return (
        <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
    );
}

function SectionTitle({ children }) {
    return <h2 className="text-base font-semibold text-gray-800 mb-4">{children}</h2>;
}

export default function AgentDashboard() {
    const { user } = useAuthStore();
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [year, setYear]   = useState(currentYear);
    const [month, setMonth] = useState(currentMonth);

    const { data: simpleStats } = useQuery({
        queryKey: ['dashboard-stats'],
        queryFn: async () => (await apiClient.get('/dashboard/stats')).data,
    });

    const { data: kpis, isLoading: kpisLoading } = useQuery({
        queryKey: ['dashboard-kpis', year, month],
        queryFn: async () => {
            const p = new URLSearchParams({ year });
            if (month) p.set('month', month);
            return (await apiClient.get(`/dashboard/kpis?${p}`)).data;
        },
    });

    const s = kpis?.summary ?? {};

    const periodLabel = month
        ? `${MONTHS[month - 1]} ${year}`
        : `Todo ${year}`;

    const prevLabel = month
        ? `${MONTHS[month - 1]} ${year - 1}`
        : `${year - 1}`;

    function fmtHours(h) {
        if (h === null || h === undefined) return '—';
        if (h < 1) return `${Math.round(h * 60)} min`;
        if (h < 48) return `${h}h`;
        return `${Math.round(h / 24)}d`;
    }

    const maxCategory = kpis?.by_category?.[0]?.count ?? 1;
    const maxClient   = kpis?.top_clients?.[0]?.count  ?? 1;

    return (
        <AgentLayout>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

                {/* ── Header ── */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                        <p className="text-sm text-gray-500 mt-0.5">Bienvenido, {user?.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <select value={year} onChange={e => setYear(+e.target.value)}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white shadow-sm">
                            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <select value={month ?? ''} onChange={e => setMonth(e.target.value ? +e.target.value : null)}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white shadow-sm">
                            <option value="">Todo el año</option>
                            {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                        </select>
                    </div>
                </div>

                {/* ── Snapshot cards (always current) ── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                        <p className="text-sm text-gray-500">Abiertos ahora</p>
                        <p className="text-3xl font-bold text-gray-900 mt-1">{simpleStats?.open_tickets ?? '—'}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                        <p className="text-sm text-gray-500">Mis tickets</p>
                        <p className="text-3xl font-bold text-primary-600 mt-1">{simpleStats?.my_tickets ?? '—'}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                        <p className="text-sm text-gray-500">SLA en riesgo</p>
                        <p className="text-3xl font-bold text-orange-600 mt-1">{simpleStats?.sla_at_risk ?? '—'}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                        <p className="text-sm text-gray-500">Resueltos hoy</p>
                        <p className="text-3xl font-bold text-green-600 mt-1">{simpleStats?.resolved_today ?? '—'}</p>
                    </div>
                </div>

                {/* ── Period KPIs ── */}
                {kpisLoading ? <Spinner /> : kpis && (
                    <>
                        <div>
                            <p className="text-xs text-gray-400 mb-3 uppercase tracking-wide font-medium">
                                KPIs — {periodLabel} · comparado con {prevLabel}
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                                <KpiCard
                                    title="Tickets nuevos"
                                    value={s.created}
                                    color="blue"
                                    badge={pctBadge(s.created_change)}
                                    sub={s.created_change !== null ? `vs ${prevLabel}` : undefined}
                                />
                                <KpiCard
                                    title="Resueltos"
                                    value={s.resolved}
                                    color="green"
                                    badge={pctBadge(s.resolved_change)}
                                    sub={s.resolved_change !== null ? `vs ${prevLabel}` : undefined}
                                />
                                <KpiCard
                                    title="En curso (ahora)"
                                    value={s.in_progress_now}
                                    color="yellow"
                                    sub="Estado actual"
                                />
                                <KpiCard
                                    title="T. medio resolución"
                                    value={fmtHours(s.avg_resolution_hours)}
                                    color="purple"
                                    sub="Desde creación"
                                />
                                <KpiCard
                                    title="1.ª respuesta"
                                    value={fmtHours(s.avg_first_response_hours)}
                                    color="orange"
                                    sub="Tiempo medio"
                                />
                                <KpiCard
                                    title="SLA incumplido"
                                    value={s.sla_breached}
                                    color="red"
                                    sub={`${s.sla_breach_rate}% de nuevos`}
                                />
                            </div>
                        </div>

                        {/* ── Evolution chart ── */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                            <SectionTitle>Evolución de tickets — {periodLabel}</SectionTitle>
                            {kpis.chart?.length > 0 ? (
                                <div style={{ height: 280 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={kpis.chart} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                                            <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} />
                                            <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} />
                                            <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '12px' }} />
                                            <Legend wrapperStyle={{ fontSize: '12px' }} />
                                            <Line type="monotone" dataKey="creados" name="Nuevos" stroke="#3B82F6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                                            <Line type="monotone" dataKey="resueltos" name="Resueltos" stroke="#22C55E" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <p className="text-sm text-gray-400 text-center py-10">Sin datos para el período</p>
                            )}
                        </div>

                        {/* ── Agents + Categories ── */}
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

                            {/* Agents table */}
                            <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                                <SectionTitle>Rendimiento por agente</SectionTitle>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-gray-100">
                                                <th className="text-left pb-2 font-medium text-gray-500">Agente</th>
                                                <th className="text-right pb-2 font-medium text-gray-500">Total</th>
                                                <th className="text-right pb-2 font-medium text-gray-500">Abiertos</th>
                                                <th className="text-right pb-2 font-medium text-gray-500">En curso</th>
                                                <th className="text-right pb-2 font-medium text-gray-500">Resueltos</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {kpis.by_agent?.length === 0 ? (
                                                <tr><td colSpan={5} className="py-6 text-center text-gray-400">Sin datos</td></tr>
                                            ) : kpis.by_agent?.map((a, i) => (
                                                <tr key={i} className="hover:bg-gray-50 transition">
                                                    <td className="py-2.5 pr-4">
                                                        <div className="flex items-center gap-2">
                                                            <span className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center shrink-0">
                                                                {a.agent?.charAt(0).toUpperCase()}
                                                            </span>
                                                            <span className="font-medium text-gray-800 truncate max-w-[140px]">{a.agent}</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-2.5 text-right font-semibold text-gray-900">{a.total}</td>
                                                    <td className="py-2.5 text-right">
                                                        <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700 font-medium">{a.open}</span>
                                                    </td>
                                                    <td className="py-2.5 text-right">
                                                        <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-yellow-50 text-yellow-700 font-medium">{a.in_progress}</span>
                                                    </td>
                                                    <td className="py-2.5 text-right">
                                                        <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-green-50 text-green-700 font-medium">{a.resolved}</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Categories chart */}
                            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                                <SectionTitle>Por categoría</SectionTitle>
                                {kpis.by_category?.length === 0 ? (
                                    <p className="text-sm text-gray-400 text-center py-10">Sin datos</p>
                                ) : (
                                    <div className="space-y-3">
                                        {kpis.by_category?.map((c, i) => (
                                            <div key={i}>
                                                <div className="flex justify-between text-xs mb-1">
                                                    <span className="text-gray-600 truncate max-w-[160px]">{c.name}</span>
                                                    <span className="font-semibold text-gray-800">{c.count}</span>
                                                </div>
                                                <div className="w-full bg-gray-100 rounded-full h-2">
                                                    <div
                                                        className="h-2 rounded-full bg-primary-500"
                                                        style={{ width: `${Math.round(c.count / maxCategory * 100)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── Top 15 clients ── */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                            <SectionTitle>Top 15 clientes por incidencias — {periodLabel}</SectionTitle>
                            {kpis.top_clients?.length === 0 ? (
                                <p className="text-sm text-gray-400 text-center py-10">Sin datos</p>
                            ) : (
                                <div style={{ height: Math.max(240, (kpis.top_clients?.length ?? 0) * 32) }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            layout="vertical"
                                            data={kpis.top_clients}
                                            margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
                                            <XAxis type="number" tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} />
                                            <YAxis
                                                type="category"
                                                dataKey="name"
                                                width={160}
                                                tick={{ fontSize: 11, fill: '#374151' }}
                                                tickLine={false}
                                                axisLine={false}
                                            />
                                            <Tooltip
                                                contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '12px' }}
                                                formatter={(v) => [v, 'Tickets']}
                                            />
                                            <Bar dataKey="count" name="Tickets" fill="#6366F1" radius={[0, 4, 4, 0]} maxBarSize={20} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* ── Quick Actions ── */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <h2 className="text-base font-semibold text-gray-900 mb-4">Acciones rápidas</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                        {[
                            { to: '/agent/inbox',      label: 'Bandeja',       sub: 'Todos los tickets' },
                            { to: '/agent/contacts',   label: 'Clientes',      sub: 'Gestionar contactos' },
                            { to: '/agent/agents',     label: 'Agentes',       sub: 'Gestionar equipo' },
                            { to: '/agent/kb',         label: 'KB',            sub: 'Base de conocimiento' },
                            { to: '/agent/categories', label: 'Categorías',    sub: 'Árbol 3 niveles' },
                            { to: '/agent/reports',    label: 'Informes',      sub: 'Ver analíticas' },
                            { to: '/crm/statistics',   label: 'Estadísticas',  sub: 'Panel CRM' },
                        ].map(({ to, label, sub }) => (
                            <Link key={to} to={to}
                                className="flex flex-col items-center p-3 border border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition text-center group">
                                <span className="text-sm font-semibold text-gray-800 group-hover:text-primary-700">{label}</span>
                                <span className="text-xs text-gray-400 mt-0.5 group-hover:text-primary-500">{sub}</span>
                            </Link>
                        ))}
                        <button onClick={() => setIsModalOpen(true)}
                            className="flex flex-col items-center p-3 border-2 border-primary-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition text-center group">
                            <span className="text-sm font-semibold text-primary-700">+ Ticket</span>
                            <span className="text-xs text-primary-400 mt-0.5">Nuevo</span>
                        </button>
                    </div>
                </div>

            </div>

            <CreateTicketModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </AgentLayout>
    );
}
