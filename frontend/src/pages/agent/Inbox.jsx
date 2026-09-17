import { useEffect, useRef, useState } from 'react';
import AgentLayout from '../../components/agent/AgentLayout';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../lib/api';
import CreateTicketModal from '../../components/CreateTicketModal';
import { usePriorities, getPriorityBadgeStyle } from '../../hooks/usePriorities';

function flattenCategories(categories, depth = 0) {
    const result = [];
    for (const cat of categories) {
        result.push({ id: cat.id, name: cat.name, depth });
        if (cat.children?.length) result.push(...flattenCategories(cat.children, depth + 1));
    }
    return result;
}

const STATUS_COLORS = {
    NEW: 'bg-blue-100 text-blue-800',
    OPEN: 'bg-green-100 text-green-800',
    IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
    PENDING_CUSTOMER: 'bg-purple-100 text-purple-800',
    RESOLVED: 'bg-green-100 text-green-800',
    CLOSED: 'bg-red-100 text-red-800',
    DELETED: 'bg-gray-100 text-gray-600',
};


function loadFilter(key, defaultValue) {
    try {
        const stored = sessionStorage.getItem('inbox_' + key);
        return stored !== null ? JSON.parse(stored) : defaultValue;
    } catch {
        return defaultValue;
    }
}

export default function AgentInbox() {
    const { user, logout } = useAuthStore();
    const [filter, setFilter] = useState(() => loadFilter('filter', 'all'));
    const [searchQuery, setSearchQuery] = useState(() => loadFilter('searchQuery', ''));
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { data: priorities = [] } = usePriorities();

    // New filter states with sessionStorage persistence
    const [statusFilter, setStatusFilter] = useState(() => loadFilter('statusFilter', []));
    const [priorityFilter, setPriorityFilter] = useState(() => loadFilter('priorityFilter', []));
    const [assignedFilter, setAssignedFilter] = useState(() => loadFilter('assignedFilter', 'all'));
    const [categoryFilter, setCategoryFilter] = useState(() => loadFilter('categoryFilter', []));
    const [dateFrom, setDateFrom] = useState(() => loadFilter('dateFrom', ''));
    const [dateTo, setDateTo] = useState(() => loadFilter('dateTo', ''));
    const [clientFilter, setClientFilter] = useState(() => loadFilter('clientFilter', ''));
    const [clientSearch, setClientSearch] = useState('');
    const [sortBy, setSortBy] = useState(() => loadFilter('sortBy', 'created_desc'));
    const [showTotalHours, setShowTotalHours] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [page, setPage] = useState(1);
    const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
    const categoryRef = useRef(null);

    // Persist filters to sessionStorage on change
    useEffect(() => { sessionStorage.setItem('inbox_filter', JSON.stringify(filter)); setPage(1); }, [filter]);
    useEffect(() => { sessionStorage.setItem('inbox_searchQuery', JSON.stringify(searchQuery)); setPage(1); }, [searchQuery]);
    useEffect(() => { sessionStorage.setItem('inbox_statusFilter', JSON.stringify(statusFilter)); setPage(1); }, [statusFilter]);
    useEffect(() => { sessionStorage.setItem('inbox_priorityFilter', JSON.stringify(priorityFilter)); setPage(1); }, [priorityFilter]);
    useEffect(() => { sessionStorage.setItem('inbox_assignedFilter', JSON.stringify(assignedFilter)); setPage(1); }, [assignedFilter]);
    useEffect(() => { sessionStorage.setItem('inbox_categoryFilter', JSON.stringify(categoryFilter)); setPage(1); }, [categoryFilter]);
    useEffect(() => { sessionStorage.setItem('inbox_dateFrom', JSON.stringify(dateFrom)); setPage(1); }, [dateFrom]);
    useEffect(() => { sessionStorage.setItem('inbox_dateTo', JSON.stringify(dateTo)); setPage(1); }, [dateTo]);
    useEffect(() => { sessionStorage.setItem('inbox_clientFilter', JSON.stringify(clientFilter)); setPage(1); }, [clientFilter]);
    useEffect(() => { sessionStorage.setItem('inbox_sortBy', JSON.stringify(sortBy)); setPage(1); }, [sortBy]);

    // Close category dropdown on outside click
    useEffect(() => {
        const handler = (e) => {
            if (categoryRef.current && !categoryRef.current.contains(e.target)) setCategoryDropdownOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const queryClient = useQueryClient();
    const navigate = useNavigate();

    // Fetch agents list for assigned filter
    const { data: agents } = useQuery({
        queryKey: ['agents'],
        queryFn: async () => (await apiClient.get('/agents')).data,
    });

    // Fetch categories for filter
    const { data: categoriesData } = useQuery({
        queryKey: ['categories-all'],
        queryFn: async () => (await apiClient.get('/categories')).data,
    });
    const flatCategories = flattenCategories(Array.isArray(categoriesData) ? categoriesData : []);

    // Fetch contacts for client filter (search-as-you-type)
    const { data: clientContacts = [] } = useQuery({
        queryKey: ['contacts-search-inbox', clientSearch],
        queryFn: async () => {
            const params = new URLSearchParams({ per_page: 50 });
            if (clientSearch) params.set('search', clientSearch);
            const res = await apiClient.get(`/contacts?${params}`);
            return res.data?.data ?? res.data;
        },
        enabled: clientSearch.length > 0,
    });

    // Build the shared filter/sort params (everything except pagination), so the
    // list query and the Excel export stay perfectly in sync.
    const buildFilterParams = () => {
        const params = new URLSearchParams();
        if (filter === 'my-tickets') params.append('assigned_to_me', 'true');
        if (filter === 'unassigned') params.append('unassigned', 'true');
        if (searchQuery) params.append('search', searchQuery);
        if (statusFilter.length > 0) params.append('status', statusFilter.join(','));
        if (priorityFilter.length > 0) params.append('priority', priorityFilter.join(','));
        if (categoryFilter.length > 0) params.append('category_id', categoryFilter.join(','));
        if (assignedFilter && assignedFilter !== 'all') params.append('assigned_to', assignedFilter);
        if (dateFrom) params.append('date_from', dateFrom);
        if (dateTo) params.append('date_to', dateTo);
        if (clientFilter) params.append('client_id', clientFilter);
        if (sortBy && sortBy !== 'created_desc') params.append('sort', sortBy);
        return params;
    };

    const { data: ticketsData, isLoading } = useQuery({
        queryKey: ['tickets', filter, searchQuery, statusFilter, priorityFilter, categoryFilter, assignedFilter, dateFrom, dateTo, clientFilter, sortBy, page],
        queryFn: async () => {
            const params = buildFilterParams();
            params.append('page', page);

            const response = await apiClient.get(`/tickets?${params.toString()}`);
            return response.data;
        },
    });

    const handleExport = async () => {
        setExporting(true);
        try {
            const params = buildFilterParams();
            const response = await apiClient.get(`/tickets/export?${params.toString()}`, {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.download = `asistencias-${new Date().toISOString().slice(0, 10)}.xlsx`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Export failed', err);
            alert('No se pudo generar el Excel. Inténtalo de nuevo.');
        } finally {
            setExporting(false);
        }
    };


    const tickets = ticketsData?.data || [];
    const lastPage = ticketsData?.last_page || 1;
    const total = ticketsData?.total || 0;

    const formatMinutes = (mins) => {
        if (!mins) return null;
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };

    const totalAllMinutes = parseInt(ticketsData?.total_minutes_all) || 0;
    const ticketsWithTimeCount = parseInt(ticketsData?.tickets_with_time_count) || 0;

    return (
        <AgentLayout>
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Inbox</h1>
                    <p className="text-sm text-gray-600">{total} tickets</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleExport}
                        disabled={exporting}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition disabled:opacity-60 disabled:cursor-not-allowed"
                        title="Exportar a Excel los tickets filtrados"
                    >
                        {exporting ? (
                            <svg className="w-4 h-4 animate-spin text-gray-500" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                        ) : (
                            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                            </svg>
                        )}
                        {exporting ? 'Generando…' : 'Exportar Excel'}
                    </button>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="px-4 py-2 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700 transition"
                    >
                        Create Ticket
                    </button>
                </div>
            </div>

            {/* Filters & Search */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    {/* Filter Tabs */}
                    <div className="flex space-x-2">
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-4 py-2 rounded-lg font-medium transition ${filter === 'all'
                                ? 'bg-primary-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            All
                        </button>
                        <button
                            onClick={() => setFilter('my-tickets')}
                            className={`px-4 py-2 rounded-lg font-medium transition ${filter === 'my-tickets'
                                ? 'bg-primary-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            My Tickets
                        </button>
                        <button
                            onClick={() => setFilter('unassigned')}
                            className={`px-4 py-2 rounded-lg font-medium transition ${filter === 'unassigned'
                                ? 'bg-primary-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            Unassigned
                        </button>
                    </div>

                    {/* Sort + Search */}
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5">
                            <label className="text-xs font-medium text-gray-500 whitespace-nowrap">Ordenar por</label>
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm bg-white"
                            >
                                <option value="created_desc">Fecha (más reciente)</option>
                                <option value="created_asc">Fecha (más antigua)</option>
                                <option value="client_asc">Cliente (A → Z)</option>
                                <option value="client_desc">Cliente (Z → A)</option>
                            </select>
                        </div>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search tickets..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full md:w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                            <svg className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Status Filter Tabs */}
                <div className="mt-4">
                    <label className="block text-xs font-medium text-gray-700 mb-2">Status</label>
                    <div className="flex flex-wrap gap-2">
                        {[
                            { value: 'NEW', label: 'New' },
                            { value: 'IN_PROGRESS', label: 'In Progress' },
                            { value: 'PENDING_CUSTOMER', label: 'Pending Customer' },
                            { value: 'RESOLVED', label: 'Resolved' },
                            { value: 'DELETED', label: 'Deleted' },
                        ].map(({ value, label }) => {
                            const active = statusFilter.includes(value);
                            return (
                                <button
                                    key={value}
                                    onClick={() =>
                                        setStatusFilter(prev =>
                                            active ? prev.filter(s => s !== value) : [...prev, value]
                                        )
                                    }
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                                        active
                                            ? 'bg-primary-600 text-white'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                >
                                    {label}
                                </button>
                            );
                        })}
                        {statusFilter.length > 0 && (
                            <button
                                onClick={() => setStatusFilter([])}
                                className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                </div>

                {/* Priority Filter */}
                <div className="mt-4">
                    <label className="block text-xs font-medium text-gray-700 mb-2">Prioridad</label>
                    <div className="flex flex-wrap gap-2">
                        {priorities.map((p) => {
                            const active = priorityFilter.includes(p.name);
                            return (
                                <button
                                    key={p.name}
                                    onClick={() => setPriorityFilter(prev => active ? prev.filter(v => v !== p.name) : [...prev, p.name])}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${active ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                                >
                                    <span
                                        className="inline-block w-2 h-2 rounded-full"
                                        style={{ backgroundColor: active ? 'white' : p.color }}
                                    />
                                    {p.name} — {p.label}
                                </button>
                            );
                        })}
                        {priorityFilter.length > 0 && (
                            <button onClick={() => setPriorityFilter([])} className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition">
                                Clear
                            </button>
                        )}
                    </div>
                </div>

                {/* Category Filter */}
                <div className="mt-4">
                    <label className="block text-xs font-medium text-gray-700 mb-2">Categoría</label>
                    <div className="flex flex-wrap gap-2 items-center">
                        <div className="relative" ref={categoryRef}>
                            <button
                                type="button"
                                onClick={() => setCategoryDropdownOpen(o => !o)}
                                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                                {categoryFilter.length === 0 ? 'Todas las categorías' : `${categoryFilter.length} seleccionada${categoryFilter.length > 1 ? 's' : ''}`}
                                <svg className={`w-4 h-4 text-gray-400 transition-transform ${categoryDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            {categoryDropdownOpen && (
                                <ul className="absolute z-50 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                                    {flatCategories.map(cat => (
                                        <li key={cat.id}
                                            className="flex items-center gap-2 py-2 text-sm cursor-pointer hover:bg-gray-50"
                                            style={{ paddingLeft: `${(cat.depth + 1) * 12}px`, paddingRight: '12px' }}
                                            onMouseDown={e => { e.preventDefault(); setCategoryFilter(prev => prev.includes(cat.id) ? prev.filter(x => x !== cat.id) : [...prev, cat.id]); }}>
                                            <input type="checkbox" readOnly checked={categoryFilter.includes(cat.id)}
                                                className="rounded border-gray-300 text-primary-600 pointer-events-none" />
                                            <span className={categoryFilter.includes(cat.id) ? 'text-primary-700 font-medium' : 'text-gray-800'}>{cat.name}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        {categoryFilter.length > 0 && (
                            <>
                                {flatCategories.filter(c => categoryFilter.includes(c.id)).map(cat => (
                                    <span key={cat.id} className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-800 text-xs font-medium rounded-full">
                                        {cat.name}
                                        <button onClick={() => setCategoryFilter(prev => prev.filter(x => x !== cat.id))} className="ml-0.5 font-bold hover:text-indigo-900">×</button>
                                    </span>
                                ))}
                                <button onClick={() => setCategoryFilter([])} className="text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 px-2 py-1 rounded transition">
                                    Clear
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Advanced Filters */}
                <div className="flex flex-col md:flex-row gap-4 mt-4">
                    {/* Assigned Filter */}
                    <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Assigned To</label>
                        <select
                            value={assignedFilter}
                            onChange={(e) => setAssignedFilter(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                        >
                            <option value="all">All Agents</option>
                            <option value="unassigned">Unassigned</option>
                            {agents?.map((agent) => (
                                <option key={agent.id} value={agent.id}>
                                    {agent.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Client Filter */}
                    <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Cliente</label>
                        {clientFilter ? (
                            <div className="flex items-center gap-2">
                                <span className="flex-1 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg text-sm text-indigo-800 font-medium truncate">
                                    {clientContacts.find(c => String(c.id) === String(clientFilter))?.name
                                        || tickets.find(t => String(t.contact?.id) === String(clientFilter))?.contact?.name
                                        || 'Cliente seleccionado'}
                                </span>
                                <button onClick={() => { setClientFilter(''); setClientSearch(''); }} className="text-gray-400 hover:text-red-500 transition text-lg leading-none">×</button>
                            </div>
                        ) : (
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Buscar cliente..."
                                    value={clientSearch}
                                    onChange={(e) => setClientSearch(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                                />
                                {clientSearch.length > 0 && clientContacts.length > 0 && (
                                    <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                        {clientContacts.map(c => (
                                            <li
                                                key={c.id}
                                                onMouseDown={() => { setClientFilter(String(c.id)); setClientSearch(''); }}
                                                className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-50"
                                            >
                                                <span className="font-medium text-gray-900">{c.name}</span>
                                                {c.email && <span className="text-gray-400 ml-1">({c.email})</span>}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Date From */}
                    <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-700 mb-1">From Date</label>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                        />
                    </div>

                    {/* Date To */}
                    <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-700 mb-1">To Date</label>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                        />
                    </div>
                </div>

                {/* Mostrar total horas */}
                <div className="mt-4 flex items-center gap-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={showTotalHours}
                            onChange={(e) => setShowTotalHours(e.target.checked)}
                            className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                        />
                        <span className="text-xs font-medium text-gray-700">Mostrar total horas</span>
                    </label>
                </div>
            </div>

            {/* Barra de total horas */}
            {showTotalHours && totalAllMinutes > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 mb-4 flex items-center gap-3">
                    <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm text-blue-700">
                        Total horas (todos los tickets filtrados): <span className="font-bold">{formatMinutes(totalAllMinutes)}</span>
                        <span className="text-blue-500 ml-1">({ticketsWithTimeCount} tickets con tiempo registrado)</span>
                    </span>
                </div>
            )}

            {/* Ticket List */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                {isLoading ? (
                    <div className="text-center py-12 text-gray-500">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                        <p>Loading tickets...</p>
                    </div>
                ) : tickets.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                        <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                        <p className="font-medium">No tickets found</p>
                        <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200">
                        {tickets.map((ticket) => (
                            <Link
                                key={ticket.id}
                                to={`/agent/tickets/${ticket.id}`}
                                className="block p-4 hover:bg-gray-50 transition"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-sm font-mono text-gray-500">{ticket.uuid}</span>
                                            {ticket.parent_ticket_id && (
                                                <span className="px-2 py-1 text-xs font-medium rounded bg-indigo-100 text-indigo-700">
                                                    Delegated
                                                </span>
                                            )}
                                            <span className={`px-2 py-1 text-xs font-medium rounded ${STATUS_COLORS[ticket.status]}`}>
                                                {ticket.status.replace('_', ' ')}
                                            </span>
                                            {ticket.priority && (() => {
                                                const p = priorities.find(x => x.name === ticket.priority);
                                                return (
                                                    <span
                                                        className="px-2 py-1 text-xs font-medium rounded"
                                                        style={p ? getPriorityBadgeStyle(p.color) : {}}
                                                    >
                                                        {p ? `${p.name} — ${p.label}` : ticket.priority}
                                                    </span>
                                                );
                                            })()}
                                            {ticket.time_entries_sum_duration_minutes > 0 && (
                                                <span className="px-2 py-1 text-xs font-medium rounded bg-blue-50 text-blue-700 flex items-center gap-1">
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    {formatMinutes(ticket.time_entries_sum_duration_minutes)}
                                                </span>
                                            )}
                                            {(ticket.sla_first_response_breached || ticket.sla_resolution_breached) && (
                                                <span className="px-2 py-1 text-xs font-medium rounded bg-red-100 text-red-800">
                                                    SLA BREACH
                                                </span>
                                            )}
                                            {ticket.children_count > 0 && (
                                                <span className="relative group/delegado" onClick={e => e.preventDefault()}>
                                                    <span className="px-2 py-1 text-xs font-medium rounded bg-orange-100 text-orange-700 cursor-default select-none">
                                                        Delegado
                                                    </span>
                                                    <div className="pointer-events-none absolute hidden group-hover/delegado:block z-50 top-full left-0 mt-1.5 w-60 bg-gray-900 text-white text-xs rounded-lg p-2.5 shadow-xl">
                                                        <div className="font-semibold text-gray-300 mb-2">Historial de asignación</div>
                                                        {/* Origen */}
                                                        <div className="flex items-start gap-2 pb-1.5">
                                                            <span className="mt-0.5 w-2 h-2 rounded-full bg-blue-400 flex-shrink-0"></span>
                                                            <div>
                                                                <div className="text-gray-400">Creado por</div>
                                                                <div className="text-white font-medium">{ticket.creator?.name || '—'}</div>
                                                            </div>
                                                        </div>
                                                        {/* Delegaciones */}
                                                        {ticket.children?.map((child, i) => (
                                                            <div key={child.id} className="flex items-start gap-2 pt-1.5 border-t border-gray-700">
                                                                <span className="mt-0.5 w-2 h-2 rounded-full bg-orange-400 flex-shrink-0"></span>
                                                                <div>
                                                                    <div className="text-gray-400">Delegado por {child.creator?.name || '—'}</div>
                                                                    <div className="text-white font-medium">{child.user?.name || 'Sin asignar'}</div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {/* Asignación actual en el padre */}
                                                        <div className="flex items-start gap-2 pt-1.5 border-t border-gray-700">
                                                            <span className="mt-0.5 w-2 h-2 rounded-full bg-green-400 flex-shrink-0"></span>
                                                            <div>
                                                                <div className="text-gray-400">Asignado ahora</div>
                                                                <div className="text-white font-medium">{ticket.user?.name || 'Sin asignar'}</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="text-base font-semibold text-gray-900 mb-1">{ticket.subject}</h3>
                                        <p className="text-sm text-gray-600">
                                            From: <span className="font-medium">{ticket.contact?.name || 'Unknown'}</span>
                                            {ticket.contact?.email && ` (${ticket.contact.email})`}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            Created {new Date(ticket.created_at).toLocaleString()}
                                            {ticket.creator && <span className="ml-2">by <span className="font-medium">{ticket.creator.name}</span></span>}
                                            {ticket.user
                                                ? <span className="ml-2">· Assigned: <span className="font-medium">{ticket.user.name}</span></span>
                                                : <span className="ml-2">· <span className="text-gray-400">Unassigned</span></span>
                                            }
                                        </p>
                                    </div>
                                    <svg className="w-5 h-5 text-gray-400 ml-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            {/* Pagination */}
            {lastPage > 1 && (
                <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-gray-600">
                        Page {page} of {lastPage}
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                        >
                            Previous
                        </button>
                        {Array.from({ length: lastPage }, (_, i) => i + 1)
                            .filter(p => p === 1 || p === lastPage || Math.abs(p - page) <= 2)
                            .reduce((acc, p, idx, arr) => {
                                if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
                                acc.push(p);
                                return acc;
                            }, [])
                            .map((p, idx) =>
                                p === '...' ? (
                                    <span key={`ellipsis-${idx}`} className="px-3 py-2 text-sm text-gray-500">…</span>
                                ) : (
                                    <button
                                        key={p}
                                        onClick={() => setPage(p)}
                                        className={`px-3 py-2 text-sm font-medium rounded-lg border transition ${
                                            p === page
                                                ? 'bg-primary-600 text-white border-primary-600'
                                                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                                        }`}
                                    >
                                        {p}
                                    </button>
                                )
                            )
                        }
                        <button
                            onClick={() => setPage(p => Math.min(lastPage, p + 1))}
                            disabled={page === lastPage}
                            className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}

            {/* Create Ticket Modal */}
            <CreateTicketModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            />
        </AgentLayout>
    );
}
