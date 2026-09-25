import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../lib/api';
import AgentLayout from '../../components/agent/AgentLayout';

function flattenCategories(cats, level = 0) {
    const result = [];
    for (const cat of (cats || [])) {
        result.push({ id: cat.id, label: '  '.repeat(level) + cat.name });
        if (cat.children?.length) result.push(...flattenCategories(cat.children, level + 1));
    }
    return result;
}

const STATUS_COLORS = {
    active: 'bg-green-100 text-green-700',
    inactive: 'bg-gray-100 text-gray-500',
};

export default function Contacts() {
    const { user, logout } = useAuthStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(50);
    const [filterPlan, setFilterPlan] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterDistributor, setFilterDistributor] = useState('');
    const [filterSyncSource, setFilterSyncSource] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingContact, setEditingContact] = useState(null);
    const [activeTab, setActiveTab] = useState('info');
    const [formData, setFormData] = useState({
        name: '',
        contact_person: '',
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
        distributor_id: '',
        has_contract: false,
        contract_type: 'none',
        contract_hours_month: '',
        contract_start_date: '',
        contract_end_date: '',
        contract_notes: '',
    });
    const [showPassword, setShowPassword] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importFile, setImportFile] = useState(null);
    const [importLoading, setImportLoading] = useState(false);
    const [importResult, setImportResult] = useState(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncToast, setSyncToast] = useState(null);

    // Projects state
    const [showNewProjectForm, setShowNewProjectForm] = useState(false);
    const [newProjectData, setNewProjectData] = useState({ name: '', category_id: '', status: 'active' });
    const [editingProjectId, setEditingProjectId] = useState(null);
    const [editingProjectData, setEditingProjectData] = useState({});

    const queryClient = useQueryClient();

    const { data: contacts, isLoading } = useQuery({
        queryKey: ['contacts', searchQuery, page, perPage, filterPlan, filterStatus, filterDistributor, filterSyncSource],
        queryFn: async () => {
            let url = `/contacts?search=${searchQuery}&page=${page}&per_page=${perPage}`;
            if (filterPlan) url += `&plan=${filterPlan}`;
            if (filterStatus) url += `&active=${filterStatus}`;
            if (filterDistributor) url += `&distributor=${filterDistributor}`;
            if (filterSyncSource) url += `&sync_source=${filterSyncSource}`;
            const response = await apiClient.get(url);
            return response.data;
        },
    });

    const { data: categories } = useQuery({
        queryKey: ['categories'],
        queryFn: async () => {
            const response = await apiClient.get('/categories');
            return response.data;
        },
    });

    const { data: contactProjects = [], isLoading: projectsLoading } = useQuery({
        queryKey: ['contact-projects', editingContact?.id],
        queryFn: async () => {
            const response = await apiClient.get(`/contacts/${editingContact.id}/projects`);
            return response.data;
        },
        enabled: !!editingContact?.id,
    });

    const flatCategories = useMemo(() => flattenCategories(categories || []), [categories]);

    const contactList = Array.isArray(contacts) ? contacts : (Array.isArray(contacts?.data) ? contacts.data : []);
    const paginationData = contacts && !Array.isArray(contacts) && contacts.data ? contacts : null;

    const createMutation = useMutation({
        mutationFn: async (data) => await apiClient.post('/contacts', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['contacts'] });
            setIsModalOpen(false);
            resetForm();
        },
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }) => await apiClient.patch(`/contacts/${id}`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['contacts'] });
            setIsModalOpen(false);
            resetForm();
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id) => await apiClient.delete(`/contacts/${id}`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contacts'] }),
        onError: (error) => alert(error.response?.data?.message || 'Failed to delete customer'),
    });

    const createProjectMutation = useMutation({
        mutationFn: async (data) => apiClient.post(`/contacts/${editingContact.id}/projects`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['contact-projects', editingContact.id] });
            setShowNewProjectForm(false);
            setNewProjectData({ name: '', category_id: '', status: 'active' });
        },
    });

    const updateProjectMutation = useMutation({
        mutationFn: async ({ id, data }) => apiClient.patch(`/contacts/${editingContact.id}/projects/${id}`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['contact-projects', editingContact.id] });
            setEditingProjectId(null);
        },
    });

    const deleteProjectMutation = useMutation({
        mutationFn: async (id) => apiClient.delete(`/contacts/${editingContact.id}/projects/${id}`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contact-projects', editingContact.id] }),
    });

    const resetForm = () => {
        setFormData({
            name: '', contact_person: '', email: '', phone: '', external_id: '',
            password: '', password_confirmation: '', cif: '', subscription_plan: '',
            max_users: '', billing_mode: '', rate: '', registration_date: '',
            distributor_id: '', has_contract: false, contract_type: 'none',
            contract_hours_month: '', contract_start_date: '', contract_end_date: '', contract_notes: '',
        });
        setShowPassword(false);
        setEditingContact(null);
        setActiveTab('info');
        setShowNewProjectForm(false);
        setNewProjectData({ name: '', category_id: '', status: 'active' });
        setEditingProjectId(null);
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
            contact_person: contact.contact_person || '',
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
            distributor_id: contact.distributor_id || '',
            has_contract: contact.has_contract || false,
            contract_type: contact.contract_type || 'none',
            contract_hours_month: contact.contract_hours_month || '',
            contract_start_date: contact.contract_start_date || '',
            contract_end_date: contact.contract_end_date || '',
            contract_notes: contact.contract_notes || '',
        });
        setShowPassword(false);
        setActiveTab('info');
        setShowNewProjectForm(false);
        setEditingProjectId(null);
        setIsModalOpen(true);
    };

    const handleDelete = (id) => {
        if (window.confirm('Are you sure you want to delete this customer?')) {
            deleteMutation.mutate(id);
        }
    };

    const handleAddProject = () => {
        if (!newProjectData.name.trim()) return;
        createProjectMutation.mutate({
            name: newProjectData.name.trim(),
            category_id: newProjectData.category_id || null,
            status: newProjectData.status,
        });
    };

    const handleImport = async () => {
        if (!importFile) { alert('Please select a file to import'); return; }
        setImportLoading(true);
        setImportResult(null);
        try {
            const fd = new FormData();
            fd.append('file', importFile);
            const response = await apiClient.post('/contacts/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            setImportResult(response.data);
            setImportFile(null);
            queryClient.invalidateQueries({ queryKey: ['contacts'] });
            if (!response.data.errors || response.data.errors.length === 0) {
                setTimeout(() => { setIsImportModalOpen(false); setImportResult(null); }, 3000);
            }
        } catch (error) {
            setImportResult({ message: error.response?.data?.message || 'Import failed. Please try again.', errors: [error.message] });
        } finally {
            setImportLoading(false);
        }
    };

    const handleSync = async () => {
        setIsSyncing(true);
        setSyncToast(null);
        try {
            const response = await apiClient.post('/contacts/sync');
            setSyncToast({ type: 'success', message: response.data.message });
            setTimeout(() => queryClient.invalidateQueries({ queryKey: ['contacts'] }), 70000);
        } catch (error) {
            setSyncToast({ type: 'error', message: error.response?.data?.message || 'Sync failed' });
        } finally {
            setIsSyncing(false);
            setTimeout(() => setSyncToast(null), 8000);
        }
    };

    return (
        <AgentLayout>
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Search & Filters */}
                <div className="flex justify-between items-center mb-6">
                    <div className="relative max-w-md flex-1">
                        <input
                            type="text"
                            placeholder="Buscar por nombre, email o NIF..."
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
                        />
                        <svg className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>

                    <div className="flex space-x-2 ml-4 flex-1">
                        <select value={filterPlan} onChange={(e) => { setFilterPlan(e.target.value); setPage(1); }} className="bg-white border border-gray-300 text-gray-700 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 shadow-sm transition">
                            <option value="">All Plans</option>
                            <option value="Basic">Basic</option>
                            <option value="Pro">Pro</option>
                        </select>
                        <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }} className="bg-white border border-gray-300 text-gray-700 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 shadow-sm transition">
                            <option value="">All Statuses</option>
                            <option value="1">Active</option>
                            <option value="0">Inactive</option>
                        </select>
                        <select value={filterDistributor} onChange={(e) => { setFilterDistributor(e.target.value); setPage(1); }} className="bg-white border border-gray-300 text-gray-700 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 shadow-sm transition">
                            <option value="">All Distributors</option>
                            <option value="1">Conversia</option>
                            <option value="2">Winworld</option>
                        </select>
                        <select value={filterSyncSource} onChange={(e) => { setFilterSyncSource(e.target.value); setPage(1); }} className="bg-white border border-gray-300 text-gray-700 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 shadow-sm transition">
                            <option value="">Todos los orígenes</option>
                            <option value="intratime">Sync Intratime</option>
                            <option value="import">Importado</option>
                            <option value="manual">Manual</option>
                        </select>
                    </div>

                    <div className="flex space-x-3 ml-4">
                        {user?.role === 'admin' && (
                            <button onClick={() => { setIsImportModalOpen(true); setImportFile(null); setImportResult(null); }} className="px-4 py-2 text-primary-600 bg-white border border-primary-200 font-semibold rounded-lg hover:bg-primary-50 hover:border-primary-300 transition flex items-center">
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                                Import
                            </button>
                        )}
                        {user?.role === 'admin' && (
                            <button onClick={handleSync} disabled={isSyncing} className="px-4 py-2 text-primary-600 bg-white border border-primary-200 font-semibold rounded-lg hover:bg-primary-50 hover:border-primary-300 transition flex items-center disabled:opacity-50">
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                {isSyncing ? 'Syncing...' : 'Sync from Intratime'}
                            </button>
                        )}
                        <button onClick={() => { setEditingContact(null); resetForm(); setIsModalOpen(true); }} className="px-4 py-2 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700 transition flex items-center">
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            Add Customer
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Contact Person</th>
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
                                    <tr><td colSpan="11" className="px-2 py-4 text-center"><div className="flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div></td></tr>
                                ) : contactList.length === 0 ? (
                                    <tr><td colSpan="11" className="px-2 py-12 text-center text-gray-500">No customers found</td></tr>
                                ) : (
                                    contactList.map((contact) => (
                                        <tr key={contact.id} className="hover:bg-gray-50 transition">
                                            <td className="px-2 py-4">
                                                <div className="flex items-center gap-1.5">
                                                    <Link to={`/crm/contacts/${contact.id}`} className="text-sm font-medium text-gray-900 hover:text-primary-600 transition truncate max-w-[180px]">{contact.name}</Link>
                                                    {contact.sync_source === 'intratime' && <span className="flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700" title="Sincronizado desde Intratime">Sync</span>}
                                                    {contact.sync_source === 'import' && <span className="flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700" title="Importado desde Excel">Import</span>}
                                                </div>
                                            </td>
                                            <td className="px-2 py-4 hidden md:table-cell"><div className="text-sm text-gray-600 truncate max-w-[150px]">{contact.contact_person || '—'}</div></td>
                                            <td className="px-2 py-4"><div className="text-sm text-gray-600 truncate max-w-[180px]">{contact.email}</div></td>
                                            <td className="px-2 py-4 whitespace-nowrap hidden md:table-cell"><div className="text-sm text-gray-600">{contact.phone || '—'}</div></td>
                                            <td className="px-2 py-4 whitespace-nowrap hidden lg:table-cell"><div className="text-sm text-gray-600 font-medium">{contact.subscription_plan || '—'}</div></td>
                                            <td className="px-2 py-4 whitespace-nowrap hidden xl:table-cell"><div className="text-sm text-gray-600">{contact.max_users || '—'}</div></td>
                                            <td className="px-2 py-4 whitespace-nowrap">
                                                <div className="flex flex-col gap-1">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${contact.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{contact.active ? 'Active' : 'Inactive'}</span>
                                                    {contact.has_contract && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Contrato</span>}
                                                </div>
                                            </td>
                                            <td className="px-2 py-4 whitespace-nowrap hidden xl:table-cell"><div className="text-sm text-gray-600">{contact.billing_mode == 30 ? 'Mensual' : (contact.billing_mode == 365 ? 'Anual' : (contact.billing_mode || '—'))}</div></td>
                                            <td className="px-2 py-4 whitespace-nowrap hidden lg:table-cell"><div className="text-sm text-gray-600">{contact.distributor_id == 1 ? 'Conversia' : 'Winworld'}</div></td>
                                            <td className="px-2 py-4 whitespace-nowrap hidden lg:table-cell"><div className="text-sm text-gray-500">{contact.external_id || '—'}</div></td>
                                            <td className="px-2 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <Link to={`/crm/contacts/${contact.id}`} className="text-gray-500 hover:text-primary-600 mr-4 inline-flex items-center gap-1 transition-colors" title="Ver ficha 360°">
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                    Ficha
                                                </Link>
                                                <button onClick={() => handleEdit(contact)} className="text-primary-600 hover:text-primary-900 mr-4">Edit</button>
                                                {user?.role === 'admin' && (
                                                    <button onClick={() => handleDelete(contact.id)} className="text-red-600 hover:text-red-900">Delete</button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {paginationData && (
                        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                            <div className="flex-1 flex justify-between sm:hidden">
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">Previous</button>
                                <button onClick={() => setPage(p => (!paginationData.last_page || p < paginationData.last_page) ? p + 1 : p)} disabled={page === paginationData?.last_page} className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">Next</button>
                            </div>
                            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                                <div className="flex items-center">
                                    <span className="text-sm text-gray-700 mr-2">Show:</span>
                                    <select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }} className="border border-gray-300 rounded-md text-sm focus:ring-primary-500 py-1 pl-2 pr-6">
                                        <option value={10}>10</option>
                                        <option value={25}>25</option>
                                        <option value={50}>50</option>
                                        <option value={100}>100</option>
                                    </select>
                                    <span className="text-sm text-gray-700 ml-4">Showing <span className="font-medium">{paginationData.from || 0}</span> to <span className="font-medium">{paginationData.to || 0}</span> of <span className="font-medium">{paginationData.total || 0}</span> results</span>
                                </div>
                                <div>
                                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50">
                                            <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                        </button>
                                        <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">Page {page} of {paginationData.last_page || 1}</span>
                                        <button onClick={() => setPage(p => (!paginationData.last_page || p < paginationData.last_page) ? p + 1 : p)} disabled={page === paginationData?.last_page || (paginationData.last_page === 0 && page === 1)} className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50">
                                            <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                                        </button>
                                    </nav>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Edit / Create Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-xl w-full max-h-[90vh] flex flex-col" style={{ maxWidth: editingContact ? '820px' : '520px' }}>

                        {/* Header */}
                        <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">
                                    {editingContact ? `Editar cliente` : 'Nuevo cliente'}
                                </h2>
                                {editingContact && (
                                    <p className="text-sm text-gray-400 mt-0.5">{editingContact.name}</p>
                                )}
                            </div>
                            <button type="button" onClick={() => { setIsModalOpen(false); resetForm(); }} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        {/* Tabs — only when editing */}
                        {editingContact && (
                            <div className="flex border-b border-gray-100 px-6 flex-shrink-0 bg-gray-50">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('info')}
                                    className={`py-3 px-1 mr-6 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === 'info' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                >
                                    Información
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('projects')}
                                    className={`py-3 px-1 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2 ${activeTab === 'projects' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                >
                                    Proyectos
                                    {contactProjects.length > 0 && (
                                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${activeTab === 'projects' ? 'bg-primary-100 text-primary-700' : 'bg-gray-200 text-gray-600'}`}>
                                            {contactProjects.length}
                                        </span>
                                    )}
                                </button>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                            {/* Scrollable Content */}
                            <div className="flex-1 overflow-y-auto">

                                {/* ── INFO TAB ── */}
                                {(activeTab === 'info' || !editingContact) && (
                                    <div className={`p-6 ${editingContact ? 'grid grid-cols-2 gap-x-8 gap-y-0' : ''}`}>

                                        {/* LEFT / SINGLE column */}
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Datos de contacto</label>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Empresa
                                                    {editingContact?.sync_source && (
                                                        <span className="ml-2 text-xs font-normal text-gray-400">(gestionado por {editingContact.sync_source === 'intratime' ? 'Intratime' : 'importación'})</span>
                                                    )}
                                                </label>
                                                <input
                                                    type="text"
                                                    required
                                                    value={formData.name}
                                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                    readOnly={!!(editingContact?.sync_source)}
                                                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm ${editingContact?.sync_source ? 'bg-gray-50 cursor-not-allowed' : 'focus:ring-2 focus:ring-primary-500 focus:border-transparent'}`}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Persona de contacto</label>
                                                <input type="text" value={formData.contact_person} onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" placeholder="Nombre del interlocutor principal" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Distribuidor</label>
                                                <select value={formData.distributor_id} onChange={(e) => setFormData({ ...formData, distributor_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent">
                                                    <option value="">Seleccionar...</option>
                                                    <option value="1">Conversia</option>
                                                    <option value="2">Winworld</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                                <input type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} readOnly={!!editingContact} className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm ${editingContact ? 'bg-gray-50 cursor-not-allowed' : 'focus:ring-2 focus:ring-primary-500 focus:border-transparent'}`} />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                                                <input type="text" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} readOnly={!!editingContact} className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm ${editingContact ? 'bg-gray-50 cursor-not-allowed' : 'focus:ring-2 focus:ring-primary-500 focus:border-transparent'}`} />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">ID Externo</label>
                                                <input type="text" value={formData.external_id} onChange={(e) => setFormData({ ...formData, external_id: e.target.value })} readOnly={!!editingContact} className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm ${editingContact ? 'bg-gray-50 cursor-not-allowed' : 'focus:ring-2 focus:ring-primary-500 focus:border-transparent'}`} />
                                            </div>

                                            <div className="pt-1">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500 border-gray-300" />
                                                    <span className="text-sm font-medium text-gray-700">Acceso al portal / Contraseña</span>
                                                </label>
                                            </div>
                                            {showPassword && (
                                                <>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">{editingContact ? 'Nueva contraseña' : 'Contraseña'}</label>
                                                        <input type="password" required={showPassword} value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" minLength={8} placeholder={editingContact ? 'Dejar en blanco para no cambiar' : ''} />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar contraseña</label>
                                                        <input type="password" required={showPassword && !!formData.password} value={formData.password_confirmation} onChange={(e) => setFormData({ ...formData, password_confirmation: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        {/* RIGHT column (only when editing — two-column layout) */}
                                        {editingContact && (
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Datos de negocio</label>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">CIF / NIF</label>
                                                    <input type="text" value={formData.cif} onChange={(e) => setFormData({ ...formData, cif: e.target.value })} readOnly className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 cursor-not-allowed" />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Plan de suscripción</label>
                                                    <input type="text" value={formData.subscription_plan} onChange={(e) => setFormData({ ...formData, subscription_plan: e.target.value })} readOnly className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 cursor-not-allowed" placeholder="Basic, Premium, Enterprise..." />
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Usuarios máx.</label>
                                                        <input type="number" min="1" value={formData.max_users} onChange={(e) => setFormData({ ...formData, max_users: e.target.value })} readOnly className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 cursor-not-allowed" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Tarifa</label>
                                                        <input type="text" value={formData.rate} onChange={(e) => setFormData({ ...formData, rate: e.target.value })} readOnly className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 cursor-not-allowed" />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Facturación</label>
                                                        <input type="text" value={formData.billing_mode == 30 ? 'Mensual' : formData.billing_mode == 365 ? 'Anual' : formData.billing_mode} onChange={(e) => setFormData({ ...formData, billing_mode: e.target.value })} readOnly className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 cursor-not-allowed" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Alta</label>
                                                        <input type="date" value={formData.registration_date} onChange={(e) => setFormData({ ...formData, registration_date: e.target.value })} readOnly className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 cursor-not-allowed" />
                                                    </div>
                                                </div>

                                                {/* Contract section */}
                                                <div className="border-t border-gray-100 pt-4 mt-2">
                                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Contrato de mantenimiento</label>
                                                </div>
                                                <div>
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input type="checkbox" checked={formData.has_contract} onChange={(e) => setFormData({ ...formData, has_contract: e.target.checked, contract_type: e.target.checked ? (formData.contract_type === 'none' ? 'hours' : formData.contract_type) : 'none' })} className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500 border-gray-300" />
                                                        <span className="text-sm font-medium text-gray-700">Tiene contrato de mantenimiento</span>
                                                    </label>
                                                </div>
                                                {formData.has_contract && (
                                                    <>
                                                        <div>
                                                            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de contrato</label>
                                                            <select value={formData.contract_type} onChange={(e) => setFormData({ ...formData, contract_type: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500">
                                                                <option value="hours">Bolsa de horas</option>
                                                                <option value="unlimited">Contrato de Mantenimiento</option>
                                                            </select>
                                                        </div>
                                                        {formData.contract_type === 'hours' && (
                                                            <div>
                                                                <label className="block text-sm font-medium text-gray-700 mb-1">Horas / mes</label>
                                                                <input type="number" min="1" value={formData.contract_hours_month} onChange={(e) => setFormData({ ...formData, contract_hours_month: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" placeholder="ej. 10" />
                                                            </div>
                                                        )}
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div>
                                                                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha inicio</label>
                                                                <input type="date" value={formData.contract_start_date} onChange={(e) => setFormData({ ...formData, contract_start_date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
                                                            </div>
                                                            <div>
                                                                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha fin</label>
                                                                <input type="date" value={formData.contract_end_date} onChange={(e) => setFormData({ ...formData, contract_end_date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm font-medium text-gray-700 mb-1">Notas del contrato</label>
                                                            <textarea rows={2} value={formData.contract_notes} onChange={(e) => setFormData({ ...formData, contract_notes: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" placeholder="Condiciones especiales, SLA, etc." />
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        )}

                                        {/* Single-column business info (when creating) */}
                                        {!editingContact && (
                                            <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
                                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">Datos de negocio</label>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">CIF / NIF</label>
                                                    <input type="text" value={formData.cif} onChange={(e) => setFormData({ ...formData, cif: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Plan de suscripción</label>
                                                    <input type="text" value={formData.subscription_plan} onChange={(e) => setFormData({ ...formData, subscription_plan: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" placeholder="Basic, Premium, Enterprise..." />
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Usuarios máx.</label>
                                                        <input type="number" min="1" value={formData.max_users} onChange={(e) => setFormData({ ...formData, max_users: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Modo de facturación</label>
                                                        <input type="text" value={formData.billing_mode} onChange={(e) => setFormData({ ...formData, billing_mode: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" placeholder="Monthly, Annual..." />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Tarifa</label>
                                                        <input type="text" value={formData.rate} onChange={(e) => setFormData({ ...formData, rate: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" placeholder="€99/mes" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de alta</label>
                                                        <input type="date" value={formData.registration_date} onChange={(e) => setFormData({ ...formData, registration_date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
                                                    </div>
                                                </div>
                                                <div className="pt-1">
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input type="checkbox" checked={formData.has_contract} onChange={(e) => setFormData({ ...formData, has_contract: e.target.checked, contract_type: e.target.checked ? 'hours' : 'none' })} className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500 border-gray-300" />
                                                        <span className="text-sm font-medium text-gray-700">Tiene contrato de mantenimiento</span>
                                                    </label>
                                                </div>
                                                {formData.has_contract && (
                                                    <>
                                                        <div>
                                                            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de contrato</label>
                                                            <select value={formData.contract_type} onChange={(e) => setFormData({ ...formData, contract_type: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500">
                                                                <option value="hours">Bolsa de horas</option>
                                                                <option value="unlimited">Contrato de Mantenimiento</option>
                                                            </select>
                                                        </div>
                                                        {formData.contract_type === 'hours' && (
                                                            <div>
                                                                <label className="block text-sm font-medium text-gray-700 mb-1">Horas / mes</label>
                                                                <input type="number" min="1" value={formData.contract_hours_month} onChange={(e) => setFormData({ ...formData, contract_hours_month: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" placeholder="ej. 10" />
                                                            </div>
                                                        )}
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div>
                                                                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha inicio</label>
                                                                <input type="date" value={formData.contract_start_date} onChange={(e) => setFormData({ ...formData, contract_start_date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
                                                            </div>
                                                            <div>
                                                                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha fin</label>
                                                                <input type="date" value={formData.contract_end_date} onChange={(e) => setFormData({ ...formData, contract_end_date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm font-medium text-gray-700 mb-1">Notas del contrato</label>
                                                            <textarea rows={2} value={formData.contract_notes} onChange={(e) => setFormData({ ...formData, contract_notes: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" placeholder="Condiciones especiales, SLA, etc." />
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* ── PROJECTS TAB ── */}
                                {activeTab === 'projects' && editingContact && (
                                    <div className="p-6">
                                        {projectsLoading ? (
                                            <div className="flex justify-center py-12">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                                            </div>
                                        ) : (
                                            <>
                                                {/* Empty state */}
                                                {contactProjects.length === 0 && !showNewProjectForm && (
                                                    <div className="text-center py-10">
                                                        <div className="w-12 h-12 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-3">
                                                            <svg className="w-6 h-6 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                                                        </div>
                                                        <p className="text-sm text-gray-500 mb-4">Este cliente no tiene proyectos todavía.</p>
                                                        <button type="button" onClick={() => setShowNewProjectForm(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition">
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                                            Crear primer proyecto
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Project cards grid */}
                                                {contactProjects.length > 0 && (
                                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                                        {contactProjects.map((project) => (
                                                            <div key={project.id} className="border border-gray-200 rounded-xl p-4 group hover:border-primary-200 hover:shadow-sm transition-all">
                                                                {editingProjectId === project.id ? (
                                                                    /* Inline edit */
                                                                    <div className="space-y-2">
                                                                        <input
                                                                            autoFocus
                                                                            type="text"
                                                                            value={editingProjectData.name}
                                                                            onChange={(e) => setEditingProjectData({ ...editingProjectData, name: e.target.value })}
                                                                            onKeyDown={(e) => { if (e.key === 'Escape') setEditingProjectId(null); if (e.key === 'Enter') { e.preventDefault(); updateProjectMutation.mutate({ id: project.id, data: editingProjectData }); } }}
                                                                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                                                        />
                                                                        <select value={editingProjectData.category_id || ''} onChange={(e) => setEditingProjectData({ ...editingProjectData, category_id: e.target.value || null })} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500">
                                                                            <option value="">Sin categoría</option>
                                                                            {flatCategories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                                                        </select>
                                                                        <div className="flex items-center justify-between gap-2">
                                                                            <select value={editingProjectData.status} onChange={(e) => setEditingProjectData({ ...editingProjectData, status: e.target.value })} className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-primary-500 flex-1">
                                                                                <option value="active">Activo</option>
                                                                                <option value="inactive">Inactivo</option>
                                                                            </select>
                                                                            <button type="button" onClick={() => updateProjectMutation.mutate({ id: project.id, data: editingProjectData })} disabled={updateProjectMutation.isPending} className="px-3 py-1.5 bg-primary-600 text-white text-xs font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition">
                                                                                Guardar
                                                                            </button>
                                                                            <button type="button" onClick={() => setEditingProjectId(null)} className="px-2 py-1.5 text-gray-600 text-xs rounded-lg hover:bg-gray-100 border border-gray-200 transition">
                                                                                ✕
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    /* Display mode */
                                                                    <div>
                                                                        <div className="flex items-start justify-between mb-2">
                                                                            <p className="text-sm font-semibold text-gray-900 leading-snug pr-2">{project.name}</p>
                                                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => { setEditingProjectId(project.id); setEditingProjectData({ name: project.name, category_id: project.category_id || '', status: project.status }); }}
                                                                                    className="p-1 text-gray-400 hover:text-primary-600 rounded hover:bg-primary-50 transition"
                                                                                    title="Editar"
                                                                                >
                                                                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => { if (window.confirm('¿Eliminar este proyecto?')) deleteProjectMutation.mutate(project.id); }}
                                                                                    className="p-1 text-gray-400 hover:text-red-500 rounded hover:bg-red-50 transition"
                                                                                    title="Eliminar"
                                                                                >
                                                                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-2 flex-wrap">
                                                                            {project.category ? (
                                                                                <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium">{project.category.name}</span>
                                                                            ) : (
                                                                                <span className="text-xs text-gray-400">Sin categoría</span>
                                                                            )}
                                                                            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[project.status]}`}>
                                                                                <span className={`w-1.5 h-1.5 rounded-full ${project.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                                                                                {project.status === 'active' ? 'Activo' : 'Inactivo'}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* New project form */}
                                                {showNewProjectForm ? (
                                                    <div className="border border-primary-200 rounded-xl p-4 bg-primary-50/40">
                                                        <p className="text-xs font-semibold text-primary-700 uppercase tracking-wide mb-3">Nuevo proyecto</p>
                                                        <div className="space-y-3">
                                                            <input
                                                                autoFocus
                                                                type="text"
                                                                value={newProjectData.name}
                                                                onChange={(e) => setNewProjectData({ ...newProjectData, name: e.target.value })}
                                                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddProject(); } if (e.key === 'Escape') setShowNewProjectForm(false); }}
                                                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                                                                placeholder="Nombre del proyecto"
                                                            />
                                                            <div className="flex gap-3">
                                                                <select value={newProjectData.category_id} onChange={(e) => setNewProjectData({ ...newProjectData, category_id: e.target.value })} className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white">
                                                                    <option value="">Sin categoría</option>
                                                                    {flatCategories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                                                </select>
                                                                <select value={newProjectData.status} onChange={(e) => setNewProjectData({ ...newProjectData, status: e.target.value })} className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white">
                                                                    <option value="active">Activo</option>
                                                                    <option value="inactive">Inactivo</option>
                                                                </select>
                                                            </div>
                                                            <div className="flex justify-end gap-2">
                                                                <button type="button" onClick={() => { setShowNewProjectForm(false); setNewProjectData({ name: '', category_id: '', status: 'active' }); }} className="px-3 py-2 text-sm text-gray-600 rounded-lg hover:bg-white border border-gray-200 transition">Cancelar</button>
                                                                <button type="button" onClick={handleAddProject} disabled={!newProjectData.name.trim() || createProjectMutation.isPending} className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition">
                                                                    {createProjectMutation.isPending ? 'Guardando...' : 'Añadir proyecto'}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : contactProjects.length > 0 && (
                                                    <button type="button" onClick={() => setShowNewProjectForm(true)} className="w-full border-2 border-dashed border-gray-200 rounded-xl py-3 text-sm text-gray-400 hover:border-primary-300 hover:text-primary-500 hover:bg-primary-50/20 transition-all flex items-center justify-center gap-2">
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                                        Añadir proyecto
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 flex-shrink-0">
                                <button type="button" onClick={() => { setIsModalOpen(false); resetForm(); }} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition">
                                    {activeTab === 'projects' ? 'Cerrar' : 'Cancelar'}
                                </button>
                                {(activeTab === 'info' || !editingContact) && (
                                    <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="px-5 py-2 bg-primary-600 text-white text-sm font-semibold rounded-lg hover:bg-primary-700 transition disabled:opacity-50">
                                        {editingContact ? 'Guardar cambios' : 'Crear cliente'}
                                    </button>
                                )}
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
                            <button onClick={() => { setIsImportModalOpen(false); setImportFile(null); setImportResult(null); }} className="text-gray-400 hover:text-gray-600">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Select Excel File (.xlsx)</label>
                                <input type="file" accept=".xlsx,.xls" onChange={(e) => setImportFile(e.target.files[0])} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500" />
                                {importFile && <p className="mt-2 text-sm text-gray-600">Selected: {importFile.name}</p>}
                            </div>
                            {importResult && (
                                <div className={`p-4 rounded-lg ${importResult.errors && importResult.errors.length > 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}>
                                    <p className="font-semibold text-sm mb-2">{importResult.message}</p>
                                    {importResult.imported !== undefined && <p className="text-sm">✓ Imported: {importResult.imported} | Updated: {importResult.updated} | Skipped: {importResult.skipped || 0}</p>}
                                    {importResult.errors && importResult.errors.length > 0 && (
                                        <div className="mt-2">
                                            <p className="text-sm font-medium">Errors:</p>
                                            <ul className="text-xs mt-1 space-y-1">
                                                {importResult.errors.slice(0, 5).map((error, idx) => <li key={idx}>• {error}</li>)}
                                                {importResult.errors.length > 5 && <li>... and {importResult.errors.length - 5} more</li>}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}
                            <div className="flex justify-end space-x-3">
                                <button onClick={() => { setIsImportModalOpen(false); setImportFile(null); setImportResult(null); }} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                                <button onClick={handleImport} disabled={!importFile || importLoading} className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed">
                                    {importLoading ? 'Importing...' : 'Import'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Sync Toast */}
            {syncToast && (
                <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-lg text-sm font-medium ${syncToast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                    {syncToast.type === 'success' ? (
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    ) : (
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    )}
                    {syncToast.message}
                </div>
            )}
        </AgentLayout>
    );
}
