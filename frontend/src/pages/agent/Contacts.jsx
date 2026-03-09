import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../lib/api';
import AgentLayout from '../../components/agent/AgentLayout';

export default function Contacts() {
    const { user, logout } = useAuthStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(50);
    const [filterPlan, setFilterPlan] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterDistributor, setFilterDistributor] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingContact, setEditingContact] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        external_id: '',
        password: '',
        password_confirmation: '',
        cif: '',
        subscription_plan: '',
        max_users: '',
        billing_mode: '',
        rate: '',
        registration_date: '',
    });
    const [showPassword, setShowPassword] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importFile, setImportFile] = useState(null);
    const [importLoading, setImportLoading] = useState(false);
    const [importResult, setImportResult] = useState(null);
    const [isSyncing, setIsSyncing] = useState(false);

    const queryClient = useQueryClient();

    const { data: contacts, isLoading } = useQuery({
        queryKey: ['contacts', searchQuery, page, perPage, filterPlan, filterStatus, filterDistributor],
        queryFn: async () => {
            let url = `/contacts?search=${searchQuery}&page=${page}&per_page=${perPage}`;
            if (filterPlan) url += `&plan=${filterPlan}`;
            if (filterStatus) url += `&active=${filterStatus}`;
            if (filterDistributor) url += `&distributor=${filterDistributor}`;
            const response = await apiClient.get(url);
            return response.data;
        },
    });

    const contactList = Array.isArray(contacts) ? contacts : (Array.isArray(contacts?.data) ? contacts.data : []);
    const paginationData = contacts && !Array.isArray(contacts) && contacts.data ? contacts : null;

    const createMutation = useMutation({
        mutationFn: async (data) => {
            return await apiClient.post('/contacts', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['contacts'] });
            setIsModalOpen(false);
            resetForm();
        },
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }) => {
            return await apiClient.patch(`/contacts/${id}`, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['contacts'] });
            setIsModalOpen(false);
            resetForm();
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id) => {
            return await apiClient.delete(`/contacts/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['contacts'] });
        },
        onError: (error) => {
            alert(error.response?.data?.message || 'Failed to delete customer');
        },
    });

    const resetForm = () => {
        setFormData({
            name: '',
            email: '',
            phone: '',
            external_id: '',
            password: '',
            password_confirmation: '',
            cif: '',
            subscription_plan: '',
            max_users: '',
            billing_mode: '',
            rate: '',
            registration_date: '',
        });
        setShowPassword(false);
        setEditingContact(null);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (editingContact) {
            updateMutation.mutate({ id: editingContact.id, data: formData });
        } else {
            createMutation.mutate(formData);
        }
    };

    const handleEdit = (contact) => {
        setEditingContact(contact);
        setFormData({
            name: contact.name,
            email: contact.email,
            phone: contact.phone || '',
            external_id: contact.external_id || '',
            password: '',
            password_confirmation: '',
            cif: contact.cif || '',
            subscription_plan: contact.subscription_plan || '',
            max_users: contact.max_users || '',
            billing_mode: contact.billing_mode || '',
            rate: contact.rate || '',
            registration_date: contact.registration_date || '',
        });
        setShowPassword(false);
        setIsModalOpen(true);
    };

    const handleDelete = (id) => {
        if (window.confirm('Are you sure you want to delete this customer?')) {
            deleteMutation.mutate(id);
        }
    };

    const handleImport = async () => {
        if (!importFile) {
            alert('Please select a file to import');
            return;
        }

        setImportLoading(true);
        setImportResult(null);

        try {
            const formData = new FormData();
            formData.append('file', importFile);

            const response = await apiClient.post('/contacts/import', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            setImportResult(response.data);
            setImportFile(null);

            // Refresh contacts list
            queryClient.invalidateQueries({ queryKey: ['contacts'] });

            // Close modal after 3 seconds if successful
            if (!response.data.errors || response.data.errors.length === 0) {
                setTimeout(() => {
                    setIsImportModalOpen(false);
                    setImportResult(null);
                }, 3000);
            }
        } catch (error) {
            setImportResult({
                message: error.response?.data?.message || 'Import failed. Please try again.',
                errors: [error.message],
            });
        } finally {
            setImportLoading(false);
        }
    };

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            const response = await apiClient.post('/contacts/sync');
            queryClient.invalidateQueries({ queryKey: ['contacts'] });
            alert(`Sync Complete:\nImported: ${response.data.imported}\nUpdated: ${response.data.updated}\nSkipped: ${response.data.skipped}`);
        } catch (error) {
            alert('Sync failed: ' + (error.response?.data?.message || 'Unknown error'));
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <AgentLayout>
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Search */}
                <div className="flex justify-between items-center mb-6">
                    <div className="relative max-w-md flex-1">
                        <input
                            type="text"
                            placeholder="Search by name or email..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setPage(1);
                            }}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
                        />
                        <svg className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>

                    <div className="flex space-x-2 ml-4 flex-1">
                        <select
                            value={filterPlan}
                            onChange={(e) => { setFilterPlan(e.target.value); setPage(1); }}
                            className="bg-white border border-gray-300 text-gray-700 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 shadow-sm transition"
                        >
                            <option value="">All Plans</option>
                            <option value="Basic">Basic</option>
                            <option value="Pro">Pro</option>
                        </select>
                        <select
                            value={filterStatus}
                            onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                            className="bg-white border border-gray-300 text-gray-700 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 shadow-sm transition"
                        >
                            <option value="">All Statuses</option>
                            <option value="1">Active</option>
                            <option value="0">Inactive</option>
                        </select>
                        <select
                            value={filterDistributor}
                            onChange={(e) => { setFilterDistributor(e.target.value); setPage(1); }}
                            className="bg-white border border-gray-300 text-gray-700 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 shadow-sm transition"
                        >
                            <option value="">All Distributors</option>
                            <option value="1">Conversia</option>
                            <option value="2">Winworld</option>
                        </select>
                    </div>

                    <div className="flex space-x-3 ml-4">
                        {user?.role === 'admin' && (
                            <button
                                onClick={() => {
                                    setIsImportModalOpen(true);
                                    setImportFile(null);
                                    setImportResult(null);
                                }}
                                className="px-4 py-2 text-primary-600 bg-white border border-primary-200 font-semibold rounded-lg hover:bg-primary-50 hover:border-primary-300 transition flex items-center"
                            >
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                                Import
                            </button>
                        )}
                        {user?.role === 'admin' && (
                            <button
                                onClick={handleSync}
                                disabled={isSyncing}
                                className="px-4 py-2 text-primary-600 bg-white border border-primary-200 font-semibold rounded-lg hover:bg-primary-50 hover:border-primary-300 transition flex items-center disabled:opacity-50"
                            >
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                {isSyncing ? 'Syncing...' : 'Sync from Intratime'}
                            </button>
                        )}
                        <button
                            onClick={() => {
                                setEditingContact(null);
                                resetForm();
                                setIsModalOpen(true);
                            }}
                            className="px-4 py-2 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700 transition flex items-center"
                        >
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add Customer
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Phone</th>
                                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">Plan</th>
                                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden xl:table-cell">Users (Max)</th>
                                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden xl:table-cell">Billing</th>
                                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">Distributor</th>
                                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">Ext. ID</th>
                                <th className="px-2 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="10" className="px-2 py-4 text-center">
                                        <div className="flex justify-center">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                                        </div>
                                    </td>
                                </tr>
                            ) : contactList.length === 0 ? (
                                <tr>
                                    <td colSpan="10" className="px-2 py-12 text-center text-gray-500">
                                        No customers found
                                    </td>
                                </tr>
                            ) : (
                                contactList.map((contact) => (
                                    <tr key={contact.id} className="hover:bg-gray-50 transition">
                                        <td className="px-2 py-4">
                                            <div className="text-sm font-medium text-gray-900 truncate max-w-[200px]">{contact.name}</div>
                                        </td>
                                        <td className="px-2 py-4">
                                            <div className="text-sm text-gray-600 truncate max-w-[180px]">{contact.email}</div>
                                        </td>
                                        <td className="px-2 py-4 whitespace-nowrap hidden md:table-cell">
                                            <div className="text-sm text-gray-600">{contact.phone || '—'}</div>
                                        </td>
                                        <td className="px-2 py-4 whitespace-nowrap hidden lg:table-cell">
                                            <div className="text-sm text-gray-600 font-medium">{contact.subscription_plan || '—'}</div>
                                        </td>
                                        <td className="px-2 py-4 whitespace-nowrap hidden xl:table-cell">
                                            <div className="text-sm text-gray-600">{contact.max_users || '—'}</div>
                                        </td>
                                        <td className="px-2 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${contact.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                {contact.active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-2 py-4 whitespace-nowrap hidden xl:table-cell">
                                            <div className="text-sm text-gray-600">{contact.billing_mode == 30 ? 'Mensual' : (contact.billing_mode == 365 ? 'Anual' : (contact.billing_mode || '—'))}</div>
                                        </td>
                                        <td className="px-2 py-4 whitespace-nowrap hidden lg:table-cell">
                                            <div className="text-sm text-gray-600">
                                                {contact.distributor_id == 1 ? 'Conversia' : 'Winworld'}
                                            </div>
                                        </td>
                                        <td className="px-2 py-4 whitespace-nowrap hidden lg:table-cell">
                                            <div className="text-sm text-gray-500">{contact.external_id || '—'}</div>
                                        </td>
                                        <td className="px-2 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => handleEdit(contact)}
                                                className="text-primary-600 hover:text-primary-900 mr-4"
                                            >
                                                Edit
                                            </button>
                                            {user?.role === 'admin' && (
                                                <button
                                                    onClick={() => handleDelete(contact.id)}
                                                    className="text-red-600 hover:text-red-900"
                                                >
                                                    Delete
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>

                    {/* Pagination Controls */}
                    {paginationData && (
                        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                            <div className="flex-1 flex justify-between sm:hidden">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => setPage(p => (!paginationData.last_page || p < paginationData.last_page) ? p + 1 : p)}
                                    disabled={page === paginationData?.last_page}
                                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                                >
                                    Next
                                </button>
                            </div>
                            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                                <div className="flex items-center">
                                    <span className="text-sm text-gray-700 mr-2">Show:</span>
                                    <select
                                        value={perPage}
                                        onChange={(e) => {
                                            setPerPage(Number(e.target.value));
                                            setPage(1);
                                        }}
                                        className="border border-gray-300 rounded-md text-sm focus:ring-primary-500 py-1 pl-2 pr-6"
                                    >
                                        <option value={10}>10</option>
                                        <option value={25}>25</option>
                                        <option value={50}>50</option>
                                        <option value={100}>100</option>
                                    </select>
                                    <span className="text-sm text-gray-700 ml-4">
                                        Showing <span className="font-medium">{paginationData.from || 0}</span> to <span className="font-medium">{paginationData.to || 0}</span> of{' '}
                                        <span className="font-medium">{paginationData.total || 0}</span> results
                                    </span>
                                </div>
                                <div>
                                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                                        <button
                                            onClick={() => setPage(p => Math.max(1, p - 1))}
                                            disabled={page === 1}
                                            className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                                        >
                                            <span className="sr-only">Previous</span>
                                            <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                        {/* Simple page numbers */}
                                        <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                                            Page {page} of {paginationData.last_page || 1}
                                        </span>
                                        <button
                                            onClick={() => setPage(p => (!paginationData.last_page || p < paginationData.last_page) ? p + 1 : p)}
                                            disabled={page === paginationData?.last_page || (paginationData.last_page === 0 && page === 1)}
                                            className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                                        >
                                            <span className="sr-only">Next</span>
                                            <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                    </nav>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
                        {/* Fixed Header */}
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
                            <h2 className="text-xl font-bold text-gray-900">
                                {editingContact ? 'Edit Customer' : 'Add New Customer'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                            {/* Scrollable Content */}
                            <div className="p-6 space-y-4 overflow-y-auto flex-1">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        readOnly={!!editingContact}
                                        className={`w-full px-4 py-2 border border-gray-300 rounded-lg ${editingContact ? 'bg-gray-50 cursor-not-allowed' : 'focus:ring-2 focus:ring-primary-500'}`}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                                    <input
                                        type="email"
                                        required
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        readOnly={!!editingContact}
                                        className={`w-full px-4 py-2 border border-gray-300 rounded-lg ${editingContact ? 'bg-gray-50 cursor-not-allowed' : 'focus:ring-2 focus:ring-primary-500'}`}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                                    <input
                                        type="text"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        readOnly={!!editingContact}
                                        className={`w-full px-4 py-2 border border-gray-300 rounded-lg ${editingContact ? 'bg-gray-50 cursor-not-allowed' : 'focus:ring-2 focus:ring-primary-500'}`}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">External ID</label>
                                    <input
                                        type="text"
                                        value={formData.external_id}
                                        onChange={(e) => setFormData({ ...formData, external_id: e.target.value })}
                                        readOnly={!!editingContact}
                                        className={`w-full px-4 py-2 border border-gray-300 rounded-lg ${editingContact ? 'bg-gray-50 cursor-not-allowed' : 'focus:ring-2 focus:ring-primary-500'}`}
                                    />
                                </div>

                                <div className="border-t border-gray-200 pt-4 mt-4">
                                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Business Information</h3>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">CIF / Tax ID</label>
                                    <input
                                        type="text"
                                        value={formData.cif}
                                        onChange={(e) => setFormData({ ...formData, cif: e.target.value })}
                                        readOnly={!!editingContact}
                                        className={`w-full px-4 py-2 border border-gray-300 rounded-lg ${editingContact ? 'bg-gray-50 cursor-not-allowed' : 'focus:ring-2 focus:ring-primary-500'}`}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Subscription Plan</label>
                                    <input
                                        type="text"
                                        value={formData.subscription_plan}
                                        onChange={(e) => setFormData({ ...formData, subscription_plan: e.target.value })}
                                        readOnly={!!editingContact}
                                        className={`w-full px-4 py-2 border border-gray-300 rounded-lg ${editingContact ? 'bg-gray-50 cursor-not-allowed' : 'focus:ring-2 focus:ring-primary-500'}`}
                                        placeholder="e.g., Basic, Premium, Enterprise"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Users</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={formData.max_users}
                                        onChange={(e) => setFormData({ ...formData, max_users: e.target.value })}
                                        readOnly={!!editingContact}
                                        className={`w-full px-4 py-2 border border-gray-300 rounded-lg ${editingContact ? 'bg-gray-50 cursor-not-allowed' : 'focus:ring-2 focus:ring-primary-500'}`}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Billing Mode</label>
                                    <input
                                        type="text"
                                        value={formData.billing_mode}
                                        onChange={(e) => setFormData({ ...formData, billing_mode: e.target.value })}
                                        readOnly={!!editingContact}
                                        className={`w-full px-4 py-2 border border-gray-300 rounded-lg ${editingContact ? 'bg-gray-50 cursor-not-allowed' : 'focus:ring-2 focus:ring-primary-500'}`}
                                        placeholder="e.g., Monthly, Annual"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Rate</label>
                                    <input
                                        type="text"
                                        value={formData.rate}
                                        onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                                        readOnly={!!editingContact}
                                        className={`w-full px-4 py-2 border border-gray-300 rounded-lg ${editingContact ? 'bg-gray-50 cursor-not-allowed' : 'focus:ring-2 focus:ring-primary-500'}`}
                                        placeholder="e.g., $99/mo"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Registration Date</label>
                                    <input
                                        type="date"
                                        value={formData.registration_date}
                                        onChange={(e) => setFormData({ ...formData, registration_date: e.target.value })}
                                        readOnly={!!editingContact}
                                        className={`w-full px-4 py-2 border border-gray-300 rounded-lg ${editingContact ? 'bg-gray-50 cursor-not-allowed' : 'focus:ring-2 focus:ring-primary-500'}`}
                                    />
                                </div>

                                <div className="pt-2">
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={showPassword}
                                            onChange={(e) => setShowPassword(e.target.checked)}
                                            className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500 border-gray-300"
                                        />
                                        <span className="text-sm font-medium text-gray-700">Enable Portal Access / Set Password</span>
                                    </label>
                                </div>

                                {showPassword && (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                {editingContact ? 'New Password' : 'Password'}
                                            </label>
                                            <input
                                                type="password"
                                                required={showPassword}
                                                value={formData.password}
                                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                                minLength={8}
                                                placeholder={editingContact ? "Leave blank to keep current" : ""}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                                            <input
                                                type="password"
                                                required={showPassword && !!formData.password}
                                                value={formData.password_confirmation}
                                                onChange={(e) => setFormData({ ...formData, password_confirmation: e.target.value })}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                            />
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Fixed Footer with Buttons */}
                            <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3 flex-shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={createMutation.isPending || updateMutation.isPending}
                                    className="px-6 py-2 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
                                >
                                    {editingContact ? 'Save Changes' : 'Create Customer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Import Modal */}
            {isImportModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-gray-900">Import Customers</h2>
                            <button
                                onClick={() => {
                                    setIsImportModalOpen(false);
                                    setImportFile(null);
                                    setImportResult(null);
                                }}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Select Excel File (.xlsx)
                                </label>
                                <input
                                    type="file"
                                    accept=".xlsx,.xls"
                                    onChange={(e) => setImportFile(e.target.files[0])}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                />
                                {importFile && (
                                    <p className="mt-2 text-sm text-gray-600">
                                        Selected: {importFile.name}
                                    </p>
                                )}
                            </div>

                            {importResult && (
                                <div className={`p-4 rounded-lg ${importResult.errors && importResult.errors.length > 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}>
                                    <p className="font-semibold text-sm mb-2">{importResult.message}</p>
                                    {importResult.imported !== undefined && (
                                        <p className="text-sm">
                                            ✓ Imported: {importResult.imported} | Updated: {importResult.updated} | Skipped: {importResult.skipped || 0}
                                        </p>
                                    )}
                                    {importResult.errors && importResult.errors.length > 0 && (
                                        <div className="mt-2">
                                            <p className="text-sm font-medium">Errors:</p>
                                            <ul className="text-xs mt-1 space-y-1">
                                                {importResult.errors.slice(0, 5).map((error, idx) => (
                                                    <li key={idx}>• {error}</li>
                                                ))}
                                                {importResult.errors.length > 5 && (
                                                    <li>... and {importResult.errors.length - 5} more</li>
                                                )}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex justify-end space-x-3">
                                <button
                                    onClick={() => {
                                        setIsImportModalOpen(false);
                                        setImportFile(null);
                                        setImportResult(null);
                                    }}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleImport}
                                    disabled={!importFile || importLoading}
                                    className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {importLoading ? 'Importing...' : 'Import'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </AgentLayout>
    );
}
