import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../lib/api';
import AgentLayout from '../../components/agent/AgentLayout';

const STAGES = {
    lead:        { label: 'Lead',        color: 'bg-gray-100 text-gray-700' },
    contacted:   { label: 'Contactado',  color: 'bg-blue-100 text-blue-700' },
    proposal:    { label: 'Propuesta',   color: 'bg-purple-100 text-purple-700' },
    negotiation: { label: 'Negociación', color: 'bg-yellow-100 text-yellow-700' },
    won:         { label: 'Ganado',      color: 'bg-green-100 text-green-700' },
    lost:        { label: 'Perdido',     color: 'bg-red-100 text-red-700' },
};

const ACTIVITY_ICONS = {
    call:    { icon: '📞', label: 'Llamada' },
    email:   { icon: '✉️', label: 'Email' },
    meeting: { icon: '🤝', label: 'Reunión' },
    note:    { icon: '📝', label: 'Nota' },
};

const TICKET_STATUS_COLOR = {
    open:        'bg-blue-100 text-blue-800',
    in_progress: 'bg-yellow-100 text-yellow-800',
    closed:      'bg-gray-100 text-gray-700',
    resolved:    'bg-green-100 text-green-800',
};

function formatAmount(amount) {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount || 0);
}

function StageBadge({ stage }) {
    const s = STAGES[stage] || STAGES.lead;
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${s.color}`}>
            {s.label}
        </span>
    );
}

function ActivityModal({ contactId, onClose, onSave }) {
    const [form, setForm] = useState({ type: 'note', description: '', due_date: '', deal_id: '' });

    const { data: deals = [] } = useQuery({
        queryKey: ['deals', contactId],
        queryFn: () => apiClient.get(`/deals?contact_id=${contactId}`).then(r => r.data),
    });

    const handleSubmit = (e) => { e.preventDefault(); onSave(form); };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">Nueva Actividad</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Tipo</label>
                        <div className="grid grid-cols-4 gap-2">
                            {Object.entries(ACTIVITY_ICONS).map(([key, { icon, label }]) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setForm(f => ({ ...f, type: key }))}
                                    className={`flex flex-col items-center gap-1 py-2.5 rounded-lg border text-xs font-medium transition-all ${form.type === key ? 'bg-primary-50 border-primary-500 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                                >
                                    <span className="text-lg">{icon}</span>
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Descripción *</label>
                        <textarea
                            required
                            rows={3}
                            value={form.description}
                            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                            placeholder="Describe la actividad..."
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha límite</label>
                            <input
                                type="datetime-local"
                                value={form.due_date}
                                onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Deal relacionado</label>
                            <select
                                value={form.deal_id}
                                onChange={e => setForm(f => ({ ...f, deal_id: e.target.value }))}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            >
                                <option value="">Ninguno</option>
                                {deals.map(d => (
                                    <option key={d.id} value={d.id}>{d.title}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors">Cancelar</button>
                        <button type="submit" className="flex-1 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors">Guardar</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function DealModal({ contactId, onClose, onSave }) {
    const [form, setForm] = useState({ title: '', amount: '', stage: 'lead', expected_close_date: '' });
    const handleSubmit = (e) => { e.preventDefault(); onSave({ ...form, contact_id: contactId }); };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">Nuevo Deal</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
                        <input
                            required
                            value={form.title}
                            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            placeholder="Nombre del deal"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Importe (€)</label>
                            <input
                                type="number" min="0"
                                value={form.amount}
                                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                placeholder="0"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Etapa</label>
                            <select
                                value={form.stage}
                                onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            >
                                {Object.entries(STAGES).map(([k, v]) => (
                                    <option key={k} value={k}>{v.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Cierre estimado</label>
                        <input
                            type="date"
                            value={form.expected_close_date}
                            onChange={e => setForm(f => ({ ...f, expected_close_date: e.target.value }))}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors">Cancelar</button>
                        <button type="submit" className="flex-1 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors">Crear Deal</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function ContactProfile() {
    const { id } = useParams();
    const [activeTab, setActiveTab] = useState('tickets');
    const [showActivityModal, setShowActivityModal] = useState(false);
    const [showDealModal, setShowDealModal] = useState(false);
    const queryClient = useQueryClient();

    const { data: contact, isLoading } = useQuery({
        queryKey: ['contact', id],
        queryFn: () => apiClient.get(`/contacts/${id}`).then(r => r.data),
    });

    const { data: tickets = [] } = useQuery({
        queryKey: ['contact-tickets', id],
        queryFn: () => apiClient.get(`/tickets?contact_id=${id}&per_page=100`).then(r => {
            const d = r.data;
            return Array.isArray(d) ? d : (d?.data || []);
        }),
        enabled: activeTab === 'tickets',
    });

    const { data: deals = [] } = useQuery({
        queryKey: ['contact-deals', id],
        queryFn: () => apiClient.get(`/deals?contact_id=${id}`).then(r => r.data),
        enabled: activeTab === 'deals',
    });

    const { data: activities = [] } = useQuery({
        queryKey: ['contact-activities', id],
        queryFn: () => apiClient.get(`/activities?contact_id=${id}`).then(r => r.data),
        enabled: activeTab === 'activities',
    });

    const createActivity = useMutation({
        mutationFn: (data) => apiClient.post('/activities', { ...data, contact_id: id }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['contact-activities', id] });
            setShowActivityModal(false);
        },
    });

    const createDeal = useMutation({
        mutationFn: (data) => apiClient.post('/deals', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['contact-deals', id] });
            setShowDealModal(false);
        },
    });

    const toggleActivity = useMutation({
        mutationFn: ({ actId, is_completed }) => apiClient.patch(`/activities/${actId}`, { is_completed }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contact-activities', id] }),
    });

    if (isLoading) {
        return (
            <AgentLayout>
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
                </div>
            </AgentLayout>
        );
    }

    if (!contact) {
        return (
            <AgentLayout>
                <div className="text-center py-20 text-gray-500">Cliente no encontrado</div>
            </AgentLayout>
        );
    }

    const openDeals = deals.filter(d => !['won', 'lost'].includes(d.stage));
    const dealsValue = deals.reduce((sum, d) => sum + parseFloat(d.amount || 0), 0);

    return (
        <AgentLayout>
            {/* Back */}
            <Link to="/crm/directory" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-600 transition-colors mb-6">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Volver al Directorio
            </Link>

            {/* Header card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-2xl font-bold text-primary-700">{contact.name?.[0]?.toUpperCase()}</span>
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">{contact.name}</h1>
                            <div className="flex flex-wrap items-center gap-3 mt-1">
                                {contact.contact_person && (
                                    <span className="text-sm text-gray-600">{contact.contact_person}</span>
                                )}
                                {contact.email && (
                                    <a href={`mailto:${contact.email}`} className="text-sm text-primary-600 hover:underline">{contact.email}</a>
                                )}
                                {contact.phone && (
                                    <span className="text-sm text-gray-600">{contact.phone}</span>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-2 mt-2">
                                {contact.subscription_plan && (
                                    <span className="px-2.5 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">{contact.subscription_plan}</span>
                                )}
                                <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${contact.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {contact.active ? 'Activo' : 'Inactivo'}
                                </span>
                                {contact.has_contract && (
                                    <span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">Con contrato</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* KPIs */}
                    <div className="flex gap-6 flex-shrink-0">
                        <div className="text-center">
                            <div className="text-2xl font-bold text-gray-900">{tickets.length || 0}</div>
                            <div className="text-xs text-gray-500">Tickets</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-gray-900">{openDeals.length}</div>
                            <div className="text-xs text-gray-500">Deals activos</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-gray-900">{formatAmount(dealsValue)}</div>
                            <div className="text-xs text-gray-500">Pipeline</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 mb-6 border-b border-gray-200">
                {[
                    { key: 'tickets', label: 'Tickets' },
                    { key: 'deals', label: 'Oportunidades (Deals)' },
                    { key: 'activities', label: 'Actividades' },
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === tab.key ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tickets tab */}
            {activeTab === 'tickets' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {tickets.length === 0 ? (
                        <div className="text-center py-12 text-gray-500 text-sm">No hay tickets para este cliente</div>
                    ) : (
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Asunto</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {tickets.map(ticket => (
                                    <tr key={ticket.id} className="hover:bg-gray-50 transition">
                                        <td className="px-4 py-3 text-sm text-gray-500 font-mono">#{ticket.id}</td>
                                        <td className="px-4 py-3">
                                            <Link to={`/agent/tickets/${ticket.id}`} className="text-sm font-medium text-gray-900 hover:text-primary-600 transition-colors">
                                                {ticket.subject}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${TICKET_STATUS_COLOR[ticket.status] || 'bg-gray-100 text-gray-700'}`}>
                                                {ticket.status?.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-500">
                                            {new Date(ticket.created_at).toLocaleDateString('es-ES')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* Deals tab */}
            {activeTab === 'deals' && (
                <div>
                    <div className="flex justify-end mb-4">
                        <button
                            onClick={() => setShowDealModal(true)}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            Nuevo Deal
                        </button>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        {deals.length === 0 ? (
                            <div className="text-center py-12 text-gray-500 text-sm">No hay deals para este cliente</div>
                        ) : (
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Título</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Etapa</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Importe</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cierre est.</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {deals.map(deal => (
                                        <tr key={deal.id} className="hover:bg-gray-50 transition">
                                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{deal.title}</td>
                                            <td className="px-4 py-3"><StageBadge stage={deal.stage} /></td>
                                            <td className="px-4 py-3 text-sm font-semibold text-green-700">{formatAmount(deal.amount)}</td>
                                            <td className="px-4 py-3 text-sm text-gray-500">
                                                {deal.expected_close_date ? new Date(deal.expected_close_date).toLocaleDateString('es-ES') : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* Activities tab */}
            {activeTab === 'activities' && (
                <div>
                    <div className="flex justify-end mb-4">
                        <button
                            onClick={() => setShowActivityModal(true)}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            Nueva Actividad
                        </button>
                    </div>
                    {activities.length === 0 ? (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 text-center py-12 text-gray-500 text-sm">
                            No hay actividades registradas
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {activities.map(act => {
                                const aType = ACTIVITY_ICONS[act.type] || ACTIVITY_ICONS.note;
                                return (
                                    <div key={act.id} className={`bg-white rounded-xl shadow-sm border border-gray-200 p-4 ${act.is_completed ? 'opacity-60' : ''}`}>
                                        <div className="flex items-start gap-3">
                                            <span className="text-xl mt-0.5 flex-shrink-0">{aType.icon}</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{aType.label}</span>
                                                    {act.deal && (
                                                        <span className="text-xs text-gray-500">· {act.deal.title}</span>
                                                    )}
                                                </div>
                                                <p className={`text-sm text-gray-800 ${act.is_completed ? 'line-through text-gray-400' : ''}`}>
                                                    {act.description}
                                                </p>
                                                <div className="flex items-center gap-3 mt-2">
                                                    <span className="text-xs text-gray-400">{act.user?.name}</span>
                                                    {act.due_date && (
                                                        <span className="text-xs text-gray-400">
                                                            · {new Date(act.due_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    )}
                                                    <span className="text-xs text-gray-400">
                                                        {new Date(act.created_at).toLocaleDateString('es-ES')}
                                                    </span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => toggleActivity.mutate({ actId: act.id, is_completed: !act.is_completed })}
                                                title={act.is_completed ? 'Marcar como pendiente' : 'Marcar como completada'}
                                                className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${act.is_completed ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-400'}`}
                                            >
                                                {act.is_completed && (
                                                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {showActivityModal && (
                <ActivityModal
                    contactId={id}
                    onClose={() => setShowActivityModal(false)}
                    onSave={(data) => createActivity.mutate(data)}
                />
            )}
            {showDealModal && (
                <DealModal
                    contactId={id}
                    onClose={() => setShowDealModal(false)}
                    onSave={(data) => createDeal.mutate(data)}
                />
            )}
        </AgentLayout>
    );
}
