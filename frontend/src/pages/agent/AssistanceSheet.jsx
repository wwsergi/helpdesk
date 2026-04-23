import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../lib/api';

const WINWORLD_LOGO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJ4AAAAcCAYAAACQ/QaoAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyZpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuNi1jMTM4IDc5LjE1OTgyNCwgMjAxNi8wOS8xNC0wMTowOTowMSAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENDIDIwMTcgKFdpbmRvd3MpIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOjZDNjE5NEUyMDQ4OTExRUE5QTFERjlCNDRDRkQ0MzBCIiB4bXBNTTpEb2N1bWVudElEPSJ4bXAuZGlkOjZDNjE5NEUzMDQ4OTExRUE5QTFERjlCNDRDRkQ0MzBCIj4gPHhtcE1NOkRlcml2ZWRGcm9tIHN0UmVmOmluc3RhbmNlSUQ9InhtcC5paWQ6NkM2MTk0RTAwNDg5MTFFQTlBMURGOUI0NENGRDQzMEIiIHN0UmVmOmRvY3VtZW50SUQ9InhtcC5kaWQ6NkM2MTk0RTEwNDg5MTFFQTlBMURGOUI0NENGRDQzMEIiLz4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+IDw/eHBhY2tldCBlbmQ9InIiPz4LkgoSAAAJKUlEQVR42uxc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";

const fmtMinutes = (min) => {
    if (!min) return '0h 0min';
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${m}min` : `${m}min`;
};

const fmtDate = (str) => {
    if (!str) return '—';
    const d = new Date(str + (str.includes('T') ? '' : 'T00:00:00'));
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const STATUS_LABELS = {
    NEW: 'Nuevo', OPEN: 'Abierto', IN_PROGRESS: 'En proceso',
    PENDING_CUSTOMER: 'Pendiente cliente', RESOLVED: 'Resuelto', CLOSED: 'Cerrado',
};

export default function AssistanceSheet() {
    const { id } = useParams();

    const { data, isLoading, isError } = useQuery({
        queryKey: ['assistance-sheet', id],
        queryFn: async () => {
            const res = await apiClient.get(`/tickets/${id}/assistance-sheet`);
            return res.data;
        },
    });

    if (isLoading) return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        </div>
    );

    if (isError || !data) return (
        <div className="min-h-screen flex items-center justify-center text-red-600">
            Error al cargar los datos del ticket.
        </div>
    );

    const { ticket, contact, agent, time_entries, total_minutes, hours_data } = data;
    const isContractActive = contact?.has_contract &&
        (!contact.contract_end_date || new Date(contact.contract_end_date) >= new Date());

    return (
        <>
            {/* Toolbar */}
            <div className="print:hidden bg-gray-100 border-b border-gray-200 px-6 py-3 flex items-center justify-between">
                <Link to={`/agent/tickets/${id}`} className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Volver al ticket
                </Link>
                <button
                    onClick={() => window.print()}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    Imprimir / Guardar PDF
                </button>
            </div>

            {/* Document */}
            <div id="sheet" className="max-w-3xl mx-auto px-8 py-6 bg-white min-h-screen">

                {/* Header */}
                <div className="flex justify-between items-center mb-4 pb-3 border-b-2 border-gray-800">
                    <div className="flex items-center gap-3">
                        <img src={WINWORLD_LOGO} alt="Winworld" className="h-8 object-contain" />
                        <div className="border-l border-gray-300 pl-3">
                            <h1 className="text-base font-bold text-gray-900 tracking-tight">HOJA DE ASISTENCIA TÉCNICA</h1>
                            <p className="text-xs text-gray-500">Ref: {ticket.uuid}</p>
                        </div>
                    </div>
                    <div className="text-right text-xs text-gray-600">
                        <p className="font-medium">Fecha</p>
                        <p>{fmtDate(new Date().toISOString())}</p>
                    </div>
                </div>

                {/* Two-column info */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-gray-50 rounded p-3 border border-gray-200">
                        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Cliente</h2>
                        <p className="font-semibold text-gray-900 text-sm">{contact?.name || '—'}</p>
                        {contact?.contact_person && <p className="text-xs text-gray-600">Contacto: {contact.contact_person}</p>}
                        {contact?.email && <p className="text-xs text-gray-500">{contact.email}</p>}
                        {contact?.phone && <p className="text-xs text-gray-500">{contact.phone}</p>}
                        {isContractActive && (
                            <div className="mt-2 pt-2 border-t border-gray-200">
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                                    {contact.contract_type === 'unlimited' ? 'Contrato ilimitado' : `Contrato ${contact.contract_hours_month}h/mes`}
                                </span>
                                {contact.contract_end_date && (
                                    <p className="text-xs text-gray-400 mt-0.5">Vigente hasta: {fmtDate(contact.contract_end_date)}</p>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="bg-gray-50 rounded p-3 border border-gray-200">
                        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Ticket</h2>
                        <p className="font-semibold text-gray-900 text-sm">{ticket.subject}</p>
                        <div className="flex gap-3 mt-1 flex-wrap">
                            <span className="text-xs text-gray-500">Estado: <span className="font-medium text-gray-700">{STATUS_LABELS[ticket.status] || ticket.status}</span></span>
                            <span className="text-xs text-gray-500">Prioridad: <span className="font-medium text-gray-700">{ticket.priority}</span></span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Creado: {fmtDate(ticket.created_at)}</p>
                        {agent && (
                            <p className="text-xs text-gray-500 mt-0.5">
                                Técnico: <span className="font-medium text-gray-700">{agent.name}{agent.level ? ` (L${agent.level})` : ''}</span>
                            </p>
                        )}
                    </div>
                </div>

                {/* Description */}
                {ticket.description && (
                    <div className="mb-3">
                        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Descripción del problema</h2>
                        <div className="bg-gray-50 rounded p-2 border border-gray-200 text-xs text-gray-700 whitespace-pre-wrap leading-snug">
                            {ticket.description}
                        </div>
                    </div>
                )}

                {/* Solution */}
                {ticket.solution && (
                    <div className="mb-3">
                        <h2 className="text-xs font-semibold uppercase tracking-wider text-green-600 mb-1">Solución</h2>
                        <div className="bg-green-50 rounded p-2 border border-green-200 text-xs text-gray-700 whitespace-pre-wrap leading-snug">
                            {ticket.solution}
                        </div>
                    </div>
                )}

                {/* Time entries */}
                <div className="mb-4">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Registro de acciones</h2>
                    {time_entries.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">Sin registros de tiempo.</p>
                    ) : (
                        <table className="w-full text-xs border-collapse">
                            <thead>
                                <tr className="bg-gray-800 text-white">
                                    <th className="text-left px-2 py-1.5 font-medium">Fecha</th>
                                    <th className="text-left px-2 py-1.5 font-medium">Técnico</th>
                                    <th className="text-left px-2 py-1.5 font-medium">Tipo</th>
                                    <th className="text-left px-2 py-1.5 font-medium">Descripción</th>
                                    <th className="text-right px-2 py-1.5 font-medium">Duración</th>
                                </tr>
                            </thead>
                            <tbody>
                                {time_entries.map((entry, i) => (
                                    <tr key={entry.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                        <td className="px-2 py-1 border-b border-gray-100 whitespace-nowrap">{fmtDate(entry.date)}</td>
                                        <td className="px-2 py-1 border-b border-gray-100 whitespace-nowrap">{entry.agent_name || '—'}</td>
                                        <td className="px-2 py-1 border-b border-gray-100 whitespace-nowrap">
                                            <span className={`px-1 py-0.5 rounded text-xs font-medium ${entry.assistance_type === 'remote' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>
                                                {entry.assistance_type === 'remote' ? 'Remoto' : 'Presencial'}
                                            </span>
                                        </td>
                                        <td className="px-2 py-1 border-b border-gray-100">{entry.description}</td>
                                        <td className="px-2 py-1 border-b border-gray-100 text-right font-medium whitespace-nowrap">{fmtMinutes(entry.duration_minutes)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-gray-800 text-white">
                                    <td colSpan={4} className="px-2 py-1.5 font-semibold">Total esta asistencia</td>
                                    <td className="px-2 py-1.5 text-right font-bold">{fmtMinutes(total_minutes)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    )}
                </div>

                {/* Contract hours summary */}
                {hours_data && (
                    <div className="mb-4 bg-blue-50 border border-blue-200 rounded p-3">
                        <h2 className="text-xs font-semibold uppercase tracking-wider text-blue-400 mb-2">
                            Horas contratadas — {new Date().toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
                        </h2>
                        <div className="grid grid-cols-3 gap-3 text-center">
                            <div>
                                <p className="text-xs text-blue-500">Contratadas</p>
                                <p className="text-base font-bold text-blue-900">{fmtMinutes(hours_data.contracted_minutes)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-blue-500">Consumidas este mes</p>
                                <p className="text-base font-bold text-blue-900">{fmtMinutes(hours_data.consumed_minutes)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-blue-500">Restantes</p>
                                <p className={`text-base font-bold ${hours_data.remaining_minutes <= 0 ? 'text-red-700' : 'text-green-700'}`}>
                                    {hours_data.remaining_minutes <= 0 ? 'Agotadas' : fmtMinutes(hours_data.remaining_minutes)}
                                </p>
                            </div>
                        </div>
                        {hours_data.remaining_minutes <= 0 && (
                            <p className="text-xs text-red-600 text-center mt-1 font-medium">
                                Horas agotadas. Las horas excedentes se facturarán aparte.
                            </p>
                        )}
                    </div>
                )}

                {/* Signature block */}
                <div className="mt-4 pt-3 border-t-2 border-gray-800">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Aceptación del cliente</h2>
                    <p className="text-xs text-gray-600 mb-4">
                        El abajo firmante confirma haber recibido y verificado la asistencia técnica descrita,
                        dando su conformidad con los trabajos realizados.
                    </p>
                    <div className="grid grid-cols-2 gap-10">
                        <div>
                            <div className="border-b border-gray-400 h-12 mb-1"></div>
                            <p className="text-xs text-gray-500">Firma y sello del cliente</p>
                            <p className="text-xs text-gray-400">{contact?.name}</p>
                        </div>
                        <div>
                            <div className="border-b border-gray-400 h-12 mb-1"></div>
                            <p className="text-xs text-gray-500">Firma del técnico</p>
                            <p className="text-xs text-gray-400">{agent?.name || '—'}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Print styles */}
            <style>{`
                @media print {
                    @page { margin: 6mm; size: A4; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    #sheet { zoom: 0.85; padding: 4mm !important; }
                }
            `}</style>
        </>
    );
}
