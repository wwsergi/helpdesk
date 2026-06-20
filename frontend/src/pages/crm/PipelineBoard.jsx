import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../lib/api';
import AgentLayout from '../../components/agent/AgentLayout';

const STAGES = [
    { key: 'lead',        label: 'Lead',        headerClass: 'bg-gray-100 border-gray-300 text-gray-700' },
    { key: 'contacted',   label: 'Contactado',  headerClass: 'bg-blue-50 border-blue-200 text-blue-700' },
    { key: 'proposal',    label: 'Propuesta',   headerClass: 'bg-purple-50 border-purple-200 text-purple-700' },
    { key: 'negotiation', label: 'Negociación', headerClass: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
    { key: 'won',         label: 'Ganado',      headerClass: 'bg-green-50 border-green-200 text-green-700' },
    { key: 'lost',        label: 'Perdido',     headerClass: 'bg-red-50 border-red-200 text-red-700' },
];

function formatAmount(amount) {
    if (!amount || amount == 0) return null;
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount);
}

function DealCard({ deal, onDragStart }) {
    return (
        <div
            draggable
            onDragStart={(e) => onDragStart(e, deal.id)}
            className="bg-white border border-gray-200 rounded-lg p-3 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-gray-300 transition-all select-none"
        >
            <p className="text-sm font-semibold text-gray-900 mb-2 leading-snug">{deal.title}</p>
            {deal.contact && (
                <Link
                    to={`/crm/contacts/${deal.contact.id}`}
                    onClick={e => e.stopPropagation()}
                    className="flex items-center gap-1.5 mb-2 group"
                >
                    <div className="w-5 h-5 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-primary-700 text-[9px] font-bold">{deal.contact.name?.[0]?.toUpperCase()}</span>
                    </div>
                    <span className="text-xs text-gray-500 group-hover:text-primary-600 transition-colors truncate">{deal.contact.name}</span>
                </Link>
            )}
            <div className="flex items-center justify-between">
                {formatAmount(deal.amount) ? (
                    <span className="text-sm font-bold text-green-700">{formatAmount(deal.amount)}</span>
                ) : <span />}
                {deal.expected_close_date && (
                    <span className="text-xs text-gray-400">
                        {new Date(deal.expected_close_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                    </span>
                )}
            </div>
            {deal.user && (
                <p className="text-xs text-gray-400 mt-1.5 pt-1.5 border-t border-gray-100">{deal.user.name}</p>
            )}
        </div>
    );
}

function Column({ stage, deals, onDragOver, onDrop, onDragStart, onAddDeal }) {
    const [isDragOver, setIsDragOver] = useState(false);
    const total = deals.reduce((sum, d) => sum + parseFloat(d.amount || 0), 0);

    return (
        <div className="flex flex-col min-w-[220px] w-56 flex-shrink-0">
            <div className={`border rounded-t-lg px-3 py-2.5 ${stage.headerClass}`}>
                <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{stage.label}</span>
                    <span className="text-xs font-medium bg-white bg-opacity-60 rounded-full px-2 py-0.5">{deals.length}</span>
                </div>
                {total > 0 && <p className="text-xs mt-0.5 opacity-70">{formatAmount(total)}</p>}
            </div>
            <div
                className={`flex-1 border border-t-0 rounded-b-lg p-2 min-h-[300px] flex flex-col gap-2 transition-colors ${isDragOver ? 'bg-primary-50 border-primary-300' : 'bg-gray-50 border-gray-200'}`}
                onDragOver={e => { e.preventDefault(); setIsDragOver(true); onDragOver(e); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={e => { setIsDragOver(false); onDrop(e, stage.key); }}
            >
                {deals.map(deal => (
                    <DealCard key={deal.id} deal={deal} onDragStart={onDragStart} />
                ))}
                <button
                    onClick={() => onAddDeal(stage.key)}
                    className="mt-auto w-full py-2 rounded-lg border border-dashed border-gray-300 text-gray-400 hover:text-primary-600 hover:border-primary-400 text-xs font-medium transition-colors"
                >
                    + Añadir deal
                </button>
            </div>
        </div>
    );
}

// Modal recibe contacts y agents como props (ya cargados en el padre)
function DealModal({ initialStage, onClose, onSave, isSaving, saveError, contacts, agents }) {
    const [form, setForm] = useState({
        title: '', contact_id: '', user_id: '', amount: '',
        stage: initialStage, expected_close_date: '',
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!form.contact_id) return;
        onSave(form);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">Nuevo Deal</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {saveError && (
                        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                            {saveError}
                        </div>
                    )}

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

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Cliente *{contacts.length === 0 && <span className="text-gray-400 font-normal"> (cargando...)</span>}
                        </label>
                        <select
                            value={form.contact_id}
                            onChange={e => setForm(f => ({ ...f, contact_id: e.target.value }))}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        >
                            <option value="">— Seleccionar cliente —</option>
                            {contacts.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                        {!form.contact_id && <p className="text-xs text-gray-400 mt-1">Debes seleccionar un cliente</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Importe (€)</label>
                            <input
                                type="number" min="0" step="0.01"
                                value={form.amount}
                                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                placeholder="0"
                            />
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
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Etapa</label>
                            <select
                                value={form.stage}
                                onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            >
                                {STAGES.map(s => (
                                    <option key={s.key} value={s.key}>{s.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Comercial</label>
                            <select
                                value={form.user_id}
                                onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            >
                                <option value="">Sin asignar</option>
                                {agents.map(a => (
                                    <option key={a.id} value={a.id}>{a.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving || !form.contact_id || !form.title}
                            className="flex-1 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSaving ? 'Guardando...' : 'Crear Deal'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function PipelineBoard() {
    const queryClient = useQueryClient();
    const dragDealId = useRef(null);
    const [modalStage, setModalStage] = useState(null);
    const [saveError, setSaveError] = useState(null);

    const { data: pipeline = {}, isLoading } = useQuery({
        queryKey: ['crm-pipeline'],
        queryFn: () => apiClient.get('/crm/pipeline').then(r => r.data),
    });

    // Cargados aquí para que estén listos cuando el modal abre
    const { data: contacts = [] } = useQuery({
        queryKey: ['contacts-all'],
        queryFn: () => apiClient.get('/contacts?all=true').then(r => r.data),
    });

    const { data: agentsRaw } = useQuery({
        queryKey: ['agents'],
        queryFn: () => apiClient.get('/agents').then(r => r.data),
    });
    const agents = Array.isArray(agentsRaw) ? agentsRaw : (agentsRaw?.data || []);

    const stageMutation = useMutation({
        mutationFn: ({ id, stage }) => apiClient.patch(`/deals/${id}`, { stage }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['crm-pipeline'] }),
    });

    const createMutation = useMutation({
        mutationFn: (data) => apiClient.post('/deals', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['crm-pipeline'] });
            setModalStage(null);
            setSaveError(null);
        },
        onError: (err) => {
            const msg = err?.response?.data?.message
                || Object.values(err?.response?.data?.errors || {}).flat().join(', ')
                || 'Error al crear el deal';
            setSaveError(msg);
        },
    });

    const handleDragStart = (e, dealId) => {
        dragDealId.current = dealId;
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDrop = (e, targetStage) => {
        e.preventDefault();
        if (dragDealId.current) {
            stageMutation.mutate({ id: dragDealId.current, stage: targetStage });
            dragDealId.current = null;
        }
    };

    const openModal = (stage) => {
        setSaveError(null);
        setModalStage(stage);
    };

    const allDeals = Object.values(pipeline).flat();
    const totalAmount = allDeals.reduce((acc, d) => acc + parseFloat(d?.amount || 0), 0);
    const wonDeals = pipeline['won'] || [];
    const wonAmount = wonDeals.reduce((acc, d) => acc + parseFloat(d?.amount || 0), 0);

    return (
        <AgentLayout>
            <div className="mb-6 flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Pipeline CRM</h1>
                    <p className="text-sm text-gray-600 mt-1">Gestión de oportunidades de venta</p>
                </div>
                <button
                    onClick={() => openModal('lead')}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Nuevo Deal
                </button>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                    <div className="text-sm font-medium text-gray-600 mb-1">Total Deals</div>
                    <div className="text-2xl font-bold text-gray-900">{allDeals.length}</div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                    <div className="text-sm font-medium text-gray-600 mb-1">Pipeline Total</div>
                    <div className="text-2xl font-bold text-gray-900">{formatAmount(totalAmount) || '0 €'}</div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                    <div className="text-sm font-medium text-gray-600 mb-1">Ganado</div>
                    <div className="text-2xl font-bold text-green-700">{formatAmount(wonAmount) || '0 €'}</div>
                    <div className="text-xs text-gray-500">{wonDeals.length} deals cerrados</div>
                </div>
            </div>

            {/* Kanban */}
            {isLoading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
                </div>
            ) : (
                <div className="flex gap-3 overflow-x-auto pb-6">
                    {STAGES.map(stage => (
                        <Column
                            key={stage.key}
                            stage={stage}
                            deals={pipeline[stage.key] || []}
                            onDragOver={e => e.preventDefault()}
                            onDrop={handleDrop}
                            onDragStart={handleDragStart}
                            onAddDeal={openModal}
                        />
                    ))}
                </div>
            )}

            {modalStage && (
                <DealModal
                    initialStage={modalStage}
                    onClose={() => { setModalStage(null); setSaveError(null); }}
                    onSave={data => createMutation.mutate(data)}
                    isSaving={createMutation.isPending}
                    saveError={saveError}
                    contacts={contacts}
                    agents={agents}
                />
            )}
        </AgentLayout>
    );
}
