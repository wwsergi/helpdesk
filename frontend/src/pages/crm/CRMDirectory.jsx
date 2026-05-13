import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../lib/api';
import AgentLayout from '../../components/agent/AgentLayout';

export default function CRMDirectory() {
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(1);

    const { data: contacts, isLoading } = useQuery({
        queryKey: ['contacts', searchQuery, page],
        queryFn: async () => {
            const response = await apiClient.get(`/contacts?search=${searchQuery}&page=${page}&per_page=25`);
            return response.data;
        },
    });

    const contactList = Array.isArray(contacts) ? contacts : (contacts?.data || []);
    const paginationData = contacts && !Array.isArray(contacts) && contacts.data ? contacts : null;

    return (
        <AgentLayout>
            <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Directorio de Clientes</h1>
                    <p className="text-sm text-gray-600 mt-1">Accede a la ficha 360° de cada cliente</p>
                </div>
            </div>

            {/* Search */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
                <div className="relative max-w-md">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                        placeholder="Buscar por nombre o email..."
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                </div>
            </div>

            {/* Contact cards */}
            {isLoading ? (
                <div className="flex items-center justify-center h-48">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
                </div>
            ) : contactList.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 text-center py-12 text-gray-500 text-sm">
                    No se encontraron clientes
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {contactList.map(contact => (
                        <Link
                            key={contact.id}
                            to={`/crm/contacts/${contact.id}`}
                            className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md hover:border-primary-200 transition-all group"
                        >
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0 group-hover:bg-primary-200 transition-colors">
                                    <span className="text-base font-bold text-primary-700">{contact.name?.[0]?.toUpperCase()}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-900 group-hover:text-primary-600 transition-colors truncate">{contact.name}</p>
                                    {contact.contact_person && (
                                        <p className="text-xs text-gray-500 truncate">{contact.contact_person}</p>
                                    )}
                                    {contact.email && (
                                        <p className="text-xs text-gray-400 truncate mt-0.5">{contact.email}</p>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-1.5 mt-3">
                                {contact.subscription_plan && (
                                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">{contact.subscription_plan}</span>
                                )}
                                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${contact.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {contact.active ? 'Activo' : 'Inactivo'}
                                </span>
                                {contact.has_contract && (
                                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">Contrato</span>
                                )}
                            </div>

                            <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
                                <span className="text-xs text-gray-400">{contact.phone || '—'}</span>
                                <span className="text-xs text-primary-600 font-medium group-hover:underline">Ver ficha →</span>
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {paginationData && paginationData.last_page > 1 && (
                <div className="flex items-center justify-between mt-6">
                    <p className="text-sm text-gray-500">
                        {paginationData.from}–{paginationData.to} de {paginationData.total} clientes
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            Anterior
                        </button>
                        <button
                            onClick={() => setPage(p => p + 1)}
                            disabled={page >= paginationData.last_page}
                            className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            Siguiente
                        </button>
                    </div>
                </div>
            )}
        </AgentLayout>
    );
}
