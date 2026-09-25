import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import apiClient from '../../lib/api';
import AgentLayout from '../../components/agent/AgentLayout';

function formatDuration(minutes) {
    if (!minutes) return '—';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
}

function flattenCategories(categories, depth = 0) {
    const result = [];
    for (const cat of categories) {
        result.push({ id: cat.id, name: cat.name, depth });
        if (cat.children?.length) result.push(...flattenCategories(cat.children, depth + 1));
    }
    return result;
}

function Spinner() {
    return (
        <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-gray-500">Cargando...</p>
        </div>
    );
}

function Empty({ text }) {
    return <div className="text-center py-12 text-gray-500"><p>{text}</p></div>;
}

const STATUS_COLS = [['New', 'text-blue-600'], ['Open', 'text-green-600'], ['In Progress', 'text-yellow-600'], ['Pending', 'text-purple-600'], ['Resolved', 'text-gray-600'], ['Closed', 'text-gray-500']];
const STATUS_KEYS = ['new', 'open', 'in_progress', 'pending_customer', 'resolved', 'closed'];

export default function Reports() {
    const [dateRange, setDateRange] = useState({ from: '', to: '' });
    const [appliedDateRange, setAppliedDateRange] = useState({ from: '', to: '' });

    const [contactId, setContactId] = useState('');
    const [appliedContactId, setAppliedContactId] = useState('');
    const [contactSearch, setContactSearch] = useState('');
    const [contactDropdownOpen, setContactDropdownOpen] = useState(false);
    const contactRef = useRef(null);

    const [categoryIds, setCategoryIds] = useState([]);
    const [appliedCategoryIds, setAppliedCategoryIds] = useState([]);
    const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
    const categoryRef = useRef(null);

    const [activeTab, setActiveTab] = useState('agents');

    useEffect(() => {
        const handler = (e) => {
            if (contactRef.current && !contactRef.current.contains(e.target)) setContactDropdownOpen(false);
            if (categoryRef.current && !categoryRef.current.contains(e.target)) setCategoryDropdownOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const { data: contactsData } = useQuery({
        queryKey: ['contacts-all'],
        queryFn: async () => (await apiClient.get('/contacts?all=1')).data,
    });
    const allContacts = Array.isArray(contactsData) ? contactsData : (contactsData?.data || []);
    const filteredContacts = contactSearch
        ? allContacts.filter(c => c.name.toLowerCase().includes(contactSearch.toLowerCase()))
        : allContacts;

    const { data: categoriesData } = useQuery({
        queryKey: ['categories-all'],
        queryFn: async () => (await apiClient.get('/categories')).data,
    });
    const flatCategories = flattenCategories(Array.isArray(categoriesData) ? categoriesData : []);

    const toggleCategory = (id) =>
        setCategoryIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

    const buildParams = () => {
        const params = new URLSearchParams();
        if (appliedDateRange.from) params.append('from', appliedDateRange.from);
        if (appliedDateRange.to) params.append('to', appliedDateRange.to);
        if (appliedContactId) params.append('contact_id', appliedContactId);
        appliedCategoryIds.forEach(id => params.append('category_ids[]', id));
        return params;
    };

    const qk = [appliedDateRange, appliedContactId, appliedCategoryIds];

    const { data: statsData, isLoading: statsLoading } = useQuery({
        queryKey: ['reports-stats', ...qk],
        queryFn: async () => (await apiClient.get(`/reports/stats?${buildParams()}`)).data,
    });
    const { data: agentData, isLoading: agentLoading } = useQuery({
        queryKey: ['reports-agents', ...qk],
        queryFn: async () => (await apiClient.get(`/reports/agents?${buildParams()}`)).data,
    });
    const { data: customerData, isLoading: customerLoading } = useQuery({
        queryKey: ['reports-customers', ...qk],
        queryFn: async () => (await apiClient.get(`/reports/customers?${buildParams()}`)).data,
    });
    const { data: distributorData, isLoading: distributorLoading } = useQuery({
        queryKey: ['reports-distributors', ...qk],
        queryFn: async () => (await apiClient.get(`/reports/distributors?${buildParams()}`)).data,
    });

    const overview = statsData?.overview || {};
    const agentStats = agentData?.by_agent || [];
    const customerStats = customerData?.by_customer || [];
    const distributorStats = distributorData?.by_distributor || [];

    const selectedContactName = allContacts.find(c => String(c.id) === String(contactId))?.name || '';
    const selectedCategoryNames = flatCategories.filter(c => appliedCategoryIds.includes(c.id)).map(c => c.name);

    const handleApplyFilter = () => {
        setAppliedDateRange(dateRange);
        setAppliedContactId(contactId);
        setAppliedCategoryIds([...categoryIds]);
    };

    const handleResetFilter = () => {
        setDateRange({ from: '', to: '' }); setAppliedDateRange({ from: '', to: '' });
        setContactId(''); setAppliedContactId(''); setContactSearch('');
        setCategoryIds([]); setAppliedCategoryIds([]);
    };

    const setQuickFilter = (days) => {
        const to = new Date().toISOString().split('T')[0];
        const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        setDateRange({ from, to }); setAppliedDateRange({ from, to });
    };

    const tabClass = (tab) =>
        `px-6 py-4 font-semibold transition whitespace-nowrap ${activeTab === tab
            ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`;

    const StatsTable = ({ nameKey, nameLabel, rows, loading, emptyText }) => {
        if (loading) return <Spinner />;
        if (!rows.length) return <Empty text={emptyText} />;
        const totalMinutes = rows.reduce((s, r) => s + (r.total_minutes || 0), 0);
        const totalTickets = rows.reduce((s, r) => s + (r.total || 0), 0);
        return (
            <table className="min-w-full divide-y divide-gray-200">
                <thead>
                    <tr className="bg-gray-50">
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{nameLabel}</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                        {STATUS_COLS.map(([label]) => (
                            <th key={label} className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</th>
                        ))}
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Tiempo</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {rows.map((row, i) => (
                        <tr key={row[nameKey] ?? i} className="hover:bg-gray-50">
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">{row[nameKey === 'agent_id' ? 'agent_name' : nameKey === 'customer_id' ? 'customer_name' : 'distributor_name']}</td>
                            <td className="px-6 py-4 text-sm text-center font-bold text-gray-900">{row.total}</td>
                            {STATUS_KEYS.map((k, j) => (
                                <td key={k} className={`px-6 py-4 text-sm text-center ${STATUS_COLS[j][1]}`}>{row[k]}</td>
                            ))}
                            <td className="px-6 py-4 text-sm text-right font-medium text-indigo-700">{formatDuration(row.total_minutes)}</td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr className="bg-gray-50 border-t-2 border-gray-300">
                        <td className="px-6 py-3 text-sm font-bold text-gray-700">Total</td>
                        <td className="px-6 py-3 text-sm text-center font-bold text-gray-900">{totalTickets}</td>
                        {STATUS_KEYS.map(k => (
                            <td key={k} className="px-6 py-3 text-sm text-center text-gray-500">
                                {rows.reduce((s, r) => s + (r[k] || 0), 0)}
                            </td>
                        ))}
                        <td className="px-6 py-3 text-sm text-right font-bold text-indigo-700">{formatDuration(totalMinutes)}</td>
                    </tr>
                </tfoot>
            </table>
        );
    };

    return (
        <AgentLayout>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
                    <p className="text-sm text-gray-600 mt-1">View ticket statistics and performance metrics</p>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                    <div className="flex flex-wrap items-end gap-4">
                        <div className="flex-1 min-w-[150px]">
                            <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
                            <input type="date" value={dateRange.from}
                                onChange={e => setDateRange({ ...dateRange, from: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                        </div>
                        <div className="flex-1 min-w-[150px]">
                            <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
                            <input type="date" value={dateRange.to}
                                onChange={e => setDateRange({ ...dateRange, to: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                        </div>

                        {/* Contact combobox */}
                        <div className="flex-1 min-w-[200px] relative" ref={contactRef}>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Cliente</label>
                            <div className="relative">
                                <input type="text" placeholder="Buscar cliente..."
                                    value={contactSearch}
                                    onChange={e => { setContactSearch(e.target.value); setContactId(''); setContactDropdownOpen(true); }}
                                    onFocus={() => setContactDropdownOpen(true)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent pr-8" />
                                {contactSearch && (
                                    <button onClick={() => { setContactSearch(''); setContactId(''); setContactDropdownOpen(false); }}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">×</button>
                                )}
                            </div>
                            {contactDropdownOpen && filteredContacts.length > 0 && (
                                <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                                    <li className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 cursor-pointer"
                                        onMouseDown={() => { setContactId(''); setContactSearch(''); setContactDropdownOpen(false); }}>
                                        Todos los clientes
                                    </li>
                                    {filteredContacts.map(c => (
                                        <li key={c.id}
                                            className={`px-4 py-2 text-sm cursor-pointer hover:bg-primary-50 hover:text-primary-700 ${String(contactId) === String(c.id) ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-900'}`}
                                            onMouseDown={() => { setContactId(c.id); setContactSearch(c.name); setContactDropdownOpen(false); }}>
                                            {c.name}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        {/* Category multiselect */}
                        <div className="flex-1 min-w-[200px] relative" ref={categoryRef}>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Categoría</label>
                            <button type="button" onClick={() => setCategoryDropdownOpen(o => !o)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-left text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent flex items-center justify-between bg-white">
                                <span className={categoryIds.length === 0 ? 'text-gray-400' : 'text-gray-900'}>
                                    {categoryIds.length === 0 ? 'Todas las categorías' : `${categoryIds.length} seleccionada${categoryIds.length > 1 ? 's' : ''}`}
                                </span>
                                <svg className={`w-4 h-4 text-gray-400 transition-transform ${categoryDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            {categoryDropdownOpen && (
                                <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                                    {flatCategories.map(cat => (
                                        <li key={cat.id}
                                            className="flex items-center gap-2 py-2 text-sm cursor-pointer hover:bg-gray-50"
                                            style={{ paddingLeft: `${(cat.depth + 1) * 16}px`, paddingRight: '16px' }}
                                            onMouseDown={e => { e.preventDefault(); toggleCategory(cat.id); }}>
                                            <input type="checkbox" readOnly checked={categoryIds.includes(cat.id)}
                                                className="rounded border-gray-300 text-primary-600 pointer-events-none" />
                                            <span className={categoryIds.includes(cat.id) ? 'text-primary-700 font-medium' : 'text-gray-800'}>{cat.name}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div className="flex gap-2">
                            <button onClick={handleApplyFilter}
                                className="px-6 py-2 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700 transition">
                                Apply
                            </button>
                            <button onClick={handleResetFilter}
                                className="px-6 py-2 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition">
                                Reset
                            </button>
                        </div>
                    </div>

                    {(appliedContactId || appliedCategoryIds.length > 0) && (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span className="text-sm text-gray-500">Filtros activos:</span>
                            {appliedContactId && selectedContactName && (
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-primary-100 text-primary-800 text-sm font-medium rounded-full">
                                    {selectedContactName}
                                    <button onClick={() => { setContactId(''); setAppliedContactId(''); setContactSearch(''); }} className="ml-1 font-bold hover:text-primary-900">×</button>
                                </span>
                            )}
                            {selectedCategoryNames.map((name, i) => (
                                <span key={i} className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 text-indigo-800 text-sm font-medium rounded-full">
                                    {name}
                                    <button onClick={() => {
                                        const id = flatCategories.find(c => c.name === name)?.id;
                                        if (id) { setCategoryIds(p => p.filter(x => x !== id)); setAppliedCategoryIds(p => p.filter(x => x !== id)); }
                                    }} className="ml-1 font-bold hover:text-indigo-900">×</button>
                                </span>
                            ))}
                        </div>
                    )}

                    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-200">
                        <span className="text-sm font-medium text-gray-700 mr-2">Quick Filters:</span>
                        {[['Today', 1], ['Last 7 Days', 7], ['Last 30 Days', 30], ['Last 90 Days', 90]].map(([label, days]) => (
                            <button key={days} onClick={() => setQuickFilter(days)}
                                className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition">
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
                    {[['Total Tickets', overview.total_tickets, 'text-gray-900'], ['New', overview.new, 'text-blue-600'], ['Open', overview.open, 'text-green-600'],
                        ['In Progress', overview.in_progress, 'text-yellow-600'], ['Pending', overview.pending_customer, 'text-purple-600'],
                        ['Resolved', overview.resolved, 'text-gray-600'], ['Closed', overview.closed, 'text-gray-500']].map(([label, val, color]) => (
                        <div key={label} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                            <div className="text-sm font-medium text-gray-600 mb-1">{label}</div>
                            <div className={`text-3xl font-bold ${color}`}>{statsLoading ? '...' : (val || 0)}</div>
                        </div>
                    ))}
                </div>

                {/* Tabs */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="border-b border-gray-200">
                        <div className="flex overflow-x-auto">
                            <button onClick={() => setActiveTab('agents')} className={tabClass('agents')}>By Agent</button>
                            <button onClick={() => setActiveTab('customers')} className={tabClass('customers')}>By Customer</button>
                            <button onClick={() => setActiveTab('distributors')} className={tabClass('distributors')}>By Distributor</button>
                        </div>
                    </div>
                    <div className="p-6 overflow-x-auto">
                        {activeTab === 'agents' && (
                            <StatsTable nameKey="agent_id" nameLabel="Agent" rows={agentStats} loading={agentLoading} emptyText="No agent data" />
                        )}
                        {activeTab === 'customers' && (
                            <StatsTable nameKey="customer_id" nameLabel="Customer" rows={customerStats} loading={customerLoading} emptyText="No customer data" />
                        )}
                        {activeTab === 'distributors' && (
                            <StatsTable nameKey="distributor_name" nameLabel="Distributor" rows={distributorStats} loading={distributorLoading} emptyText="No distributor data" />
                        )}
                    </div>
                </div>
            </div>
        </AgentLayout>
    );
}
