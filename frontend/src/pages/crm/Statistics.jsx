import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
    ResponsiveContainer, LineChart, Line,
    CartesianGrid, XAxis, YAxis, Tooltip, Legend,
} from 'recharts';
import apiClient from '../../lib/api';
import AgentLayout from '../../components/agent/AgentLayout';
import { useAuthStore } from '../../store/authStore';

const CONTRACT_LABELS = {
    winworld:      'Winworld',
    conversia:     'Conversia',
    conversia22:   'Conversia 22',
    leads:         'Leads',
    sin_categoria: 'Sin categoría',
};

const SERIES = [
    { key: 'total',       label: 'Total',        color: '#6B7280' },
    { key: 'winworld',    label: 'Winworld',      color: '#3B82F6' },
    { key: 'conversia',   label: 'Conversia',     color: '#F97316' },
    { key: 'conversia22', label: 'Conversia 22',  color: '#8B5CF6' },
    { key: 'leads',       label: 'Leads',         color: '#EAB308' },
];

const FICHAJES_SERIES = [
    { key: 'total',   label: 'Total',   color: '#6B7280' },
    { key: 'entrada', label: 'Entrada', color: '#22C55E' },
    { key: 'salida',  label: 'Salida',  color: '#EF4444' },
    { key: 'pausa',   label: 'Pausa',   color: '#F59E0B' },
    { key: 'regreso', label: 'Regreso', color: '#3B82F6' },
];

function defaultFichajeDates() {
    const to = new Date();
    const from = new Date();
    from.setFullYear(from.getFullYear() - 1);
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function defaultRegDates() {
    const to = new Date();
    const from = new Date();
    from.setFullYear(from.getFullYear() - 2);
    return {
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
    };
}

function Spinner() {
    return (
        <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
    );
}

export default function Statistics() {
    const { user } = useAuthStore();
    const isAdmin = user?.level === 'admin' || user?.role === 'admin';

    const [activeTab, setActiveTab] = useState('overview');

    // Overview
    const [selectedCard, setSelectedCard] = useState(null);
    const [cardPage, setCardPage] = useState(1);
    const [contractFilters, setContractFilters] = useState([]);

    const handleCardClick = (card) => {
        setSelectedCard(s => { if (s === card) { setContractFilters([]); return null; } return card; });
        setContractFilters([]);
        setCardPage(1);
    };

    const toggleContractFilter = (category, active) => {
        setContractFilters(prev => {
            const idx = prev.findIndex(f => f.category === category && f.active === active);
            if (idx >= 0) return prev.filter((_, i) => i !== idx);
            return [...prev, { category, active }];
        });
        setCardPage(1);
    };

    // Registrations
    const [granularity, setGranularity] = useState('month');
    const [regDates, setRegDates] = useState(defaultRegDates);
    const [activeSeries, setActiveSeries] = useState(['total', 'winworld', 'conversia', 'conversia22', 'leads']);

    // Fichajes
    const [fichajeGranularity, setFichajeGranularity] = useState('month');
    const [fichajeDates, setFichajeDates] = useState(defaultFichajeDates);
    const [fichajeSource, setFichajeSource] = useState('');
    const [fichajeSeries, setFichajeSeries] = useState(['total', 'entrada', 'salida', 'pausa', 'regreso']);

    // Directory
    const [dirPage, setDirPage] = useState(1);
    const [dirFilters, setDirFilters] = useState({ distributor: '', date_from: '', date_to: '', client_type: '' });
    const [appliedDirFilters, setAppliedDirFilters] = useState({ distributor: '', date_from: '', date_to: '', client_type: '' });

    const { data: stats, isLoading: statsLoading } = useQuery({
        queryKey: ['crm_statistics'],
        queryFn: async () => (await apiClient.get('/statistics/totals')).data,
        enabled: isAdmin,
    });

    const { data: regData, isLoading: regLoading } = useQuery({
        queryKey: ['crm_registrations', granularity, regDates.from, regDates.to],
        queryFn: async () => {
            const p = new URLSearchParams({ granularity, date_from: regDates.from, date_to: regDates.to });
            return (await apiClient.get(`/statistics/registrations?${p}`)).data;
        },
        enabled: isAdmin && activeTab === 'registrations',
    });

    const { data: fichajeData, isLoading: fichajeLoading } = useQuery({
        queryKey: ['crm_fichajes', fichajeGranularity, fichajeDates.from, fichajeDates.to, fichajeSource],
        queryFn: async () => {
            const p = new URLSearchParams({ granularity: fichajeGranularity, date_from: fichajeDates.from, date_to: fichajeDates.to });
            if (fichajeSource) p.set('source', fichajeSource);
            return (await apiClient.get(`/statistics/fichajes?${p}`)).data;
        },
        enabled: isAdmin && activeTab === 'fichajes',
    });

    const { data: cardContacts, isLoading: cardLoading } = useQuery({
        queryKey: ['stats_card', selectedCard, cardPage, contractFilters],
        queryFn: async () => {
            const p = new URLSearchParams({ per_page: 50, page: cardPage });

            if (contractFilters.length > 0) {
                contractFilters.forEach(f => p.append('contract_category[]', f.category));
                const allActive   = contractFilters.every(f => f.active === true);
                const allInactive = contractFilters.every(f => f.active === false);
                if (allActive)   p.set('active', '1');
                if (allInactive) p.set('active', '0');
            } else {
                if (selectedCard === 'active')         { p.set('active', '1'); p.set('is_lead', '0'); }
                if (selectedCard === 'inactive')       { p.set('active', '0'); p.set('is_lead', '0'); }
                if (selectedCard === 'leads_active')   { p.set('active', '1'); p.set('is_lead', '1'); }
                if (selectedCard === 'leads_inactive') { p.set('active', '0'); p.set('is_lead', '1'); }
            }

            return (await apiClient.get(`/contacts?${p}`)).data;
        },
        enabled: isAdmin && !!selectedCard,
    });

    const { data: dirContacts, isLoading: dirLoading } = useQuery({
        queryKey: ['stats_dir', appliedDirFilters, dirPage],
        queryFn: async () => {
            const p = new URLSearchParams({ per_page: 50, page: dirPage });
            if (appliedDirFilters.distributor) p.set('distributor', appliedDirFilters.distributor);
            if (appliedDirFilters.date_from)   p.set('date_from', appliedDirFilters.date_from);
            if (appliedDirFilters.date_to)     p.set('date_to', appliedDirFilters.date_to);
            if (appliedDirFilters.client_type === 'leads') {
                p.set('contract_category', 'lead');
            } else if (appliedDirFilters.client_type !== '') {
                p.set('active', appliedDirFilters.client_type);
            }
            return (await apiClient.get(`/contacts?${p}`)).data;
        },
        enabled: isAdmin && activeTab === 'directory',
    });

    if (!isAdmin) {
        return (
            <AgentLayout>
                <div className="flex flex-col items-center justify-center h-64 text-center">
                    <h2 className="text-2xl font-bold text-gray-800">Acceso Denegado</h2>
                    <p className="text-gray-500 mt-2">No tienes permisos para ver las estadísticas.</p>
                </div>
            </AgentLayout>
        );
    }

    const TABS = [
        { key: 'overview',       label: 'Visión General' },
        { key: 'registrations',  label: 'Altas' },
        { key: 'fichajes',       label: 'Fichajes' },
        { key: 'directory',      label: 'Directorio' },
    ];

    const tabClass = (key) =>
        `px-6 py-4 font-semibold transition whitespace-nowrap text-sm ${activeTab === key
            ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`;

    return (
        <AgentLayout>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Panel Estadístico</h1>
                    <p className="text-sm text-gray-500 mt-1">Resumen general de clientes y contratos</p>
                </div>

                {/* Tabs */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="flex border-b border-gray-200 overflow-x-auto">
                        {TABS.map(t => (
                            <button key={t.key} onClick={() => setActiveTab(t.key)} className={tabClass(t.key)}>
                                {t.label}
                            </button>
                        ))}
                    </div>

                    <div className="p-6">
                        {/* ── TAB: Visión General ── */}
                        {activeTab === 'overview' && (
                            statsLoading ? <Spinner /> : stats ? (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                                        <StatCard title="Total" value={stats.totals.clients} color="blue" />
                                        <StatCard title="Clientes Activos" value={stats.totals.clients_active} color="green"
                                            selected={selectedCard === 'active'}
                                            onClick={() => handleCardClick('active')} />
                                        <StatCard title="Clientes Inactivos" value={stats.totals.clients_inactive} color="red"
                                            selected={selectedCard === 'inactive'}
                                            onClick={() => handleCardClick('inactive')} />
                                        <StatCard title="Leads Activos" value={stats.totals.leads_active} color="yellow"
                                            selected={selectedCard === 'leads_active'}
                                            onClick={() => handleCardClick('leads_active')} />
                                        <StatCard title="Leads Inactivos" value={stats.totals.leads_inactive} color="orange"
                                            selected={selectedCard === 'leads_inactive'}
                                            onClick={() => handleCardClick('leads_inactive')} />
                                    </div>

                                    <div>
                                        <h3 className="text-sm font-semibold text-gray-700 mb-1">Distribución por tipo de contrato</h3>
                                        {selectedCard && (
                                            <p className="text-xs text-gray-400 mb-4">
                                                Haz clic en Activos / Inactivos de cada categoría para filtrar el listado. Multiselección disponible.
                                            </p>
                                        )}
                                        {!selectedCard && <div className="mb-4" />}
                                        <div className="space-y-5">
                                            {Object.entries(stats.by_contract || {}).map(([contract, data]) => {
                                                const total    = data.total ?? 0;
                                                const active   = data.active ?? 0;
                                                const inactive = data.inactive ?? 0;
                                                const pct       = Math.min(100, (total / (stats.totals.clients || 1)) * 100);
                                                const activePct = total > 0 ? (active / total) * 100 : 0;
                                                const selActive   = contractFilters.some(f => f.category === contract && f.active === true);
                                                const selInactive = contractFilters.some(f => f.category === contract && f.active === false);
                                                return (
                                                    <div key={contract}>
                                                        <div className="flex items-center justify-between mb-1.5">
                                                            <span className="text-sm font-semibold text-gray-700">{CONTRACT_LABELS[contract] ?? contract}</span>
                                                            <span className="text-sm font-bold text-gray-900">{total}</span>
                                                        </div>
                                                        <div className="w-full bg-gray-100 rounded-full h-2.5 mb-2">
                                                            <div className="h-2.5 rounded-full overflow-hidden flex" style={{ width: `${pct}%`, backgroundColor: '#E0E7FF' }}>
                                                                <div className="bg-green-500 h-full" style={{ width: `${activePct}%` }} />
                                                                <div className="bg-red-400 h-full flex-1" />
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-3 text-xs">
                                                            {selectedCard ? (
                                                                <>
                                                                    <button
                                                                        onClick={() => toggleContractFilter(contract, true)}
                                                                        className={`flex items-center gap-1 px-2 py-0.5 rounded-full border transition ${
                                                                            selActive
                                                                                ? 'bg-green-500 text-white border-green-500 font-semibold'
                                                                                : 'border-gray-200 text-gray-500 hover:border-green-400 hover:text-green-700'
                                                                        }`}
                                                                    >
                                                                        <span className={`inline-block w-2 h-2 rounded-full ${selActive ? 'bg-white' : 'bg-green-500'}`} />
                                                                        Activos: <strong className="ml-0.5">{active}</strong>
                                                                    </button>
                                                                    <button
                                                                        onClick={() => toggleContractFilter(contract, false)}
                                                                        className={`flex items-center gap-1 px-2 py-0.5 rounded-full border transition ${
                                                                            selInactive
                                                                                ? 'bg-red-400 text-white border-red-400 font-semibold'
                                                                                : 'border-gray-200 text-gray-500 hover:border-red-400 hover:text-red-600'
                                                                        }`}
                                                                    >
                                                                        <span className={`inline-block w-2 h-2 rounded-full ${selInactive ? 'bg-white' : 'bg-red-400'}`} />
                                                                        Inactivos: <strong className="ml-0.5">{inactive}</strong>
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <span className="flex items-center gap-1 text-gray-500">
                                                                        <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                                                                        Activos: <strong className="text-gray-700 ml-0.5">{active}</strong>
                                                                    </span>
                                                                    <span className="flex items-center gap-1 text-gray-500">
                                                                        <span className="inline-block w-2 h-2 rounded-full bg-red-400" />
                                                                        Inactivos: <strong className="text-gray-700 ml-0.5">{inactive}</strong>
                                                                    </span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {selectedCard && (
                                        <ContactListPanel
                                            title={
                                                contractFilters.length > 0
                                                    ? contractFilters.map(f => `${CONTRACT_LABELS[f.category] ?? f.category} (${f.active ? 'activos' : 'inactivos'})`).join(' + ')
                                                    : { active: 'Clientes Activos', inactive: 'Clientes Inactivos', leads_active: 'Leads Activos', leads_inactive: 'Leads Inactivos' }[selectedCard]
                                            }
                                            data={cardContacts}
                                            loading={cardLoading}
                                            page={cardPage}
                                            onPage={setCardPage}
                                            onClose={() => { setSelectedCard(null); setContractFilters([]); }}
                                            extraAction={contractFilters.length > 0 ? (
                                                <button onClick={() => { setContractFilters([]); setCardPage(1); }}
                                                    className="text-xs text-primary-600 hover:text-primary-800 underline">
                                                    Limpiar sub-filtros
                                                </button>
                                            ) : null}
                                        />
                                    )}
                                </div>
                            ) : null
                        )}

                        {/* ── TAB: Altas ── */}
                        {activeTab === 'registrations' && (
                            <div className="space-y-5">
                                {/* Controls */}
                                <div className="flex flex-wrap items-end gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Granularidad</label>
                                        <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                                            {['month', 'day'].map(g => (
                                                <button
                                                    key={g}
                                                    onClick={() => setGranularity(g)}
                                                    className={`px-4 py-2 text-sm font-medium transition ${granularity === g ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                                                >
                                                    {g === 'month' ? 'Mensual' : 'Diaria'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
                                        <input type="date" value={regDates.from}
                                            onChange={e => setRegDates(d => ({ ...d, from: e.target.value }))}
                                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
                                        <input type="date" value={regDates.to}
                                            onChange={e => setRegDates(d => ({ ...d, to: e.target.value }))}
                                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                                    </div>
                                </div>

                                {/* Series toggles */}
                                <div className="flex flex-wrap gap-2">
                                    {SERIES.map(s => {
                                        const on = activeSeries.includes(s.key);
                                        return (
                                            <button
                                                key={s.key}
                                                onClick={() => setActiveSeries(prev =>
                                                    prev.includes(s.key) ? prev.filter(k => k !== s.key) : [...prev, s.key]
                                                )}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition ${on ? 'border-transparent text-white' : 'border-gray-300 text-gray-500 bg-white'}`}
                                                style={on ? { backgroundColor: s.color, borderColor: s.color } : {}}
                                            >
                                                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: on ? 'white' : s.color }} />
                                                {s.label}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Chart */}
                                {regLoading ? <Spinner /> : (
                                    regData && regData.length > 0 ? (
                                        <div style={{ height: 380 }}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={regData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                                                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} />
                                                    <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} />
                                                    <Tooltip
                                                        contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '12px' }}
                                                        labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                                                    />
                                                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                                                    {SERIES.filter(s => activeSeries.includes(s.key)).map(s => (
                                                        <Line
                                                            key={s.key}
                                                            type="monotone"
                                                            dataKey={s.key}
                                                            name={s.label}
                                                            stroke={s.color}
                                                            strokeWidth={2}
                                                            dot={false}
                                                            activeDot={{ r: 4 }}
                                                        />
                                                    ))}
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    ) : (
                                        <div className="text-center py-16 text-gray-400">
                                            <p className="text-sm">No hay datos para el período seleccionado</p>
                                        </div>
                                    )
                                )}
                            </div>
                        )}

                        {/* ── TAB: Fichajes ── */}
                        {activeTab === 'fichajes' && (
                            <div className="space-y-5">
                                {/* Controls */}
                                <div className="flex flex-wrap items-end gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Granularidad</label>
                                        <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                                            {['month', 'day'].map(g => (
                                                <button key={g} onClick={() => setFichajeGranularity(g)}
                                                    className={`px-4 py-2 text-sm font-medium transition ${fichajeGranularity === g ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                                                    {g === 'month' ? 'Mensual' : 'Diaria'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
                                        <input type="date" value={fichajeDates.from}
                                            onChange={e => setFichajeDates(d => ({ ...d, from: e.target.value }))}
                                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
                                        <input type="date" value={fichajeDates.to}
                                            onChange={e => setFichajeDates(d => ({ ...d, to: e.target.value }))}
                                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Origen</label>
                                        <select value={fichajeSource} onChange={e => setFichajeSource(e.target.value)}
                                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
                                            <option value="">Todos</option>
                                            <option value="manual">Solo manuales</option>
                                            <option value="employee">Solo empleados</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Series toggles */}
                                <div className="flex flex-wrap gap-2">
                                    {FICHAJES_SERIES.map(s => {
                                        const on = fichajeSeries.includes(s.key);
                                        return (
                                            <button key={s.key}
                                                onClick={() => setFichajeSeries(prev =>
                                                    prev.includes(s.key) ? prev.filter(k => k !== s.key) : [...prev, s.key]
                                                )}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition ${on ? 'border-transparent text-white' : 'border-gray-300 text-gray-500 bg-white'}`}
                                                style={on ? { backgroundColor: s.color, borderColor: s.color } : {}}>
                                                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: on ? 'white' : s.color }} />
                                                {s.label}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Chart */}
                                {fichajeLoading ? <Spinner /> : (
                                    fichajeData && fichajeData.length > 0 ? (
                                        <div style={{ height: 380 }}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={fichajeData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                                                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} />
                                                    <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} />
                                                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '12px' }}
                                                        labelStyle={{ fontWeight: 600, marginBottom: 4 }} />
                                                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                                                    {FICHAJES_SERIES.filter(s => fichajeSeries.includes(s.key)).map(s => (
                                                        <Line key={s.key} type="monotone" dataKey={s.key} name={s.label}
                                                            stroke={s.color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                                                    ))}
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    ) : (
                                        <div className="text-center py-16 text-gray-400">
                                            <p className="text-sm">No hay datos para el período seleccionado</p>
                                        </div>
                                    )
                                )}
                            </div>
                        )}

                        {/* ── TAB: Directorio ── */}
                        {activeTab === 'directory' && (
                            <div className="space-y-5">
                                {/* Filters */}
                                <div className="flex flex-wrap items-end gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Distribuidor</label>
                                        <select
                                            value={dirFilters.distributor}
                                            onChange={e => setDirFilters(f => ({ ...f, distributor: e.target.value }))}
                                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                                        >
                                            <option value="">Todos</option>
                                            <option value="1">Conversia</option>
                                            <option value="2">Winworld</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Fecha alta desde</label>
                                        <input type="date" value={dirFilters.date_from}
                                            onChange={e => setDirFilters(f => ({ ...f, date_from: e.target.value }))}
                                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
                                        <input type="date" value={dirFilters.date_to}
                                            onChange={e => setDirFilters(f => ({ ...f, date_to: e.target.value }))}
                                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Estado / Tipo</label>
                                        <select
                                            value={dirFilters.client_type}
                                            onChange={e => setDirFilters(f => ({ ...f, client_type: e.target.value }))}
                                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                                        >
                                            <option value="">Todos</option>
                                            <option value="1">Activos</option>
                                            <option value="0">Inactivos</option>
                                            <option value="leads">Leads</option>
                                        </select>
                                    </div>
                                    <button
                                        onClick={() => { setAppliedDirFilters({ ...dirFilters }); setDirPage(1); }}
                                        className="px-4 py-2 bg-primary-600 text-white text-sm font-semibold rounded-lg hover:bg-primary-700 transition"
                                    >
                                        Aplicar
                                    </button>
                                    <button
                                        onClick={() => {
                                            const empty = { distributor: '', date_from: '', date_to: '', client_type: '' };
                                            setDirFilters(empty);
                                            setAppliedDirFilters(empty);
                                            setDirPage(1);
                                        }}
                                        className="px-4 py-2 border border-gray-300 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition"
                                    >
                                        Limpiar
                                    </button>
                                </div>

                                {dirLoading ? <Spinner /> : (
                                    <ContactListPanel
                                        data={dirContacts}
                                        loading={dirLoading}
                                        page={dirPage}
                                        onPage={setDirPage}
                                        showExtra
                                    />
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AgentLayout>
    );
}

function StatCard({ title, value, sub, color, selected = false, onClick }) {
    const cm = {
        blue:   'bg-blue-50 border-blue-100 text-blue-700',
        green:  'bg-green-50 border-green-100 text-green-700',
        red:    'bg-red-50 border-red-100 text-red-700',
        yellow: 'bg-yellow-50 border-yellow-100 text-yellow-700',
        orange: 'bg-orange-50 border-orange-100 text-orange-700',
    };
    const hover = onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : '';
    const ring  = selected ? 'ring-2 ring-offset-1 ring-current' : '';

    return (
        <div onClick={onClick} className={`rounded-xl border p-5 select-none ${cm[color]} ${hover} ${ring}`}>
            <h3 className="text-sm font-medium opacity-80">{title}</h3>
            <p className="text-3xl font-bold mt-2">{value ?? '—'}</p>
            {sub && <p className="text-xs mt-1.5 opacity-60">{sub}</p>}
            {onClick && <p className="text-xs mt-1 opacity-40">{selected ? 'Haz clic para cerrar' : 'Ver listado'}</p>}
        </div>
    );
}

function ContactListPanel({ title, data, loading, page, onPage, onClose, showExtra = false, extraAction = null }) {
    const rows = data?.data ?? [];
    const pagination = data && data.data ? data : null;

    if (loading) return <div className="py-8"><Spinner /></div>;

    return (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
            {(title || onClose) && (
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-gray-700 truncate">
                        {title}
                        {pagination && <span className="ml-2 font-normal text-gray-400">({pagination.total})</span>}
                    </span>
                    <div className="flex items-center gap-3 shrink-0">
                        {extraAction}
                        {onClose && (
                            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>
            )}
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Empresa</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Email</th>
                            {showExtra && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">Distribuidor</th>}
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">Plan</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha alta</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                        {rows.length === 0 ? (
                            <tr><td colSpan="6" className="px-4 py-10 text-center text-sm text-gray-400">No hay registros</td></tr>
                        ) : rows.map(c => (
                            <tr key={c.id} className="hover:bg-gray-50 transition">
                                <td className="px-4 py-3">
                                    <Link to={`/crm/contacts/${c.id}`} className="text-sm font-medium text-gray-900 hover:text-primary-600 transition">
                                        {c.name}
                                    </Link>
                                </td>
                                <td className="px-4 py-3 hidden md:table-cell">
                                    <span className="text-sm text-gray-500 truncate block max-w-[200px]">{c.email || '—'}</span>
                                </td>
                                {showExtra && (
                                    <td className="px-4 py-3 hidden lg:table-cell">
                                        <span className="text-sm text-gray-600">{c.distributor_id == 1 ? 'Conversia' : 'Winworld'}</span>
                                    </td>
                                )}
                                <td className="px-4 py-3 hidden lg:table-cell">
                                    <span className="text-sm text-gray-600">{c.subscription_plan || '—'}</span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                    <span className="text-sm text-gray-600">
                                        {c.registration_date ? new Date(c.registration_date).toLocaleDateString('es-ES') : '—'}
                                    </span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        {c.active ? 'Activo' : 'Inactivo'}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {pagination && pagination.last_page > 1 && (
                <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between bg-white">
                    <span className="text-xs text-gray-500">Página {page} de {pagination.last_page} · {pagination.total} registros</span>
                    <div className="flex gap-2">
                        <button onClick={() => onPage(p => Math.max(1, p - 1))} disabled={page === 1}
                            className="px-3 py-1.5 text-xs border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40">
                            Anterior
                        </button>
                        <button onClick={() => onPage(p => Math.min(pagination.last_page, p + 1))} disabled={page === pagination.last_page}
                            className="px-3 py-1.5 text-xs border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40">
                            Siguiente
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
