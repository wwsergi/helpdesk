import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../lib/api';
import AgentLayout from '../../components/agent/AgentLayout';

const fmtDateTime = (str) => {
    if (!str) return '—';
    return new Date(str).toLocaleString('es-ES', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
};

// Light user-agent summary (browser + OS) for readability; full string on hover.
const summarizeUA = (ua) => {
    if (!ua) return 'Desconocido';
    let browser = 'Navegador';
    if (/edg/i.test(ua)) browser = 'Edge';
    else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
    else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
    else if (/safari/i.test(ua)) browser = 'Safari';

    let os = '';
    if (/windows/i.test(ua)) os = 'Windows';
    else if (/iphone|ipad|ios/i.test(ua)) os = 'iOS';
    else if (/mac os/i.test(ua)) os = 'macOS';
    else if (/android/i.test(ua)) os = 'Android';
    else if (/linux/i.test(ua)) os = 'Linux';

    return os ? `${browser} · ${os}` : browser;
};

export default function Agents() {
    const { user: currentUser, logout } = useAuthStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAgent, setEditingAgent] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
        role: 'agent',
        level: '',
    });
    const [error, setError] = useState(null);
    const [loginsAgent, setLoginsAgent] = useState(null);
    const [loginsPage, setLoginsPage] = useState(1);

    const queryClient = useQueryClient();

    const { data: loginsData, isLoading: loginsLoading } = useQuery({
        queryKey: ['agent-logins', loginsAgent?.id, loginsPage],
        queryFn: async () => {
            const response = await apiClient.get(`/agents/${loginsAgent.id}/logins?page=${loginsPage}`);
            return response.data;
        },
        enabled: !!loginsAgent,
    });

    const openLogins = (agent) => {
        setLoginsAgent(agent);
        setLoginsPage(1);
    };

    const { data: agents, isLoading } = useQuery({
        queryKey: ['agents', searchQuery],
        queryFn: async () => {
            const response = await apiClient.get(`/agents?search=${searchQuery}`);
            return response.data;
        },
    });

    const createMutation = useMutation({
        mutationFn: async (data) => {
            return await apiClient.post('/agents', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['agents'] });
            setIsModalOpen(false);
            resetForm();
        },
        onError: (err) => {
            setError(err.response?.data?.message || 'Failed to create agent');
        },
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }) => {
            return await apiClient.patch(`/agents/${id}`, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['agents'] });
            setIsModalOpen(false);
            resetForm();
        },
        onError: (err) => {
            setError(err.response?.data?.message || 'Failed to update agent');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id) => {
            return await apiClient.delete(`/agents/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['agents'] });
        },
        onError: (err) => {
            alert(err.response?.data?.message || 'Failed to delete agent');
        },
    });

    const resetForm = () => {
        setFormData({
            name: '',
            email: '',
            password: '',
            password_confirmation: '',
            role: 'agent',
            level: '',
        });
        setEditingAgent(null);
        setError(null);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setError(null);

        if (!editingAgent && !formData.password) {
            setError('Password is required for new agents');
            return;
        }

        if (formData.password !== formData.password_confirmation) {
            setError('Passwords do not match');
            return;
        }

        if (editingAgent) {
            // Remove empty password fields for update
            const data = { ...formData };
            if (!data.password) {
                delete data.password;
                delete data.password_confirmation;
            }
            updateMutation.mutate({ id: editingAgent.id, data });
        } else {
            createMutation.mutate(formData);
        }
    };

    const handleEdit = (agent) => {
        setEditingAgent(agent);
        setFormData({
            name: agent.name,
            email: agent.email,
            password: '',
            password_confirmation: '',
            role: agent.role,
            level: agent.level ?? '',
        });
        setIsModalOpen(true);
    };

    const handleDelete = (id) => {
        if (id === currentUser.id) {
            alert('You cannot delete your own account.');
            return;
        }
        if (window.confirm('Are you sure you want to delete this agent?')) {
            deleteMutation.mutate(id);
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
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
                        />
                        <svg className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <button
                        onClick={() => {
                            setEditingAgent(null);
                            resetForm();
                            setIsModalOpen(true);
                        }}
                        className="ml-4 px-4 py-2 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700 transition flex items-center"
                    >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add Agent
                    </button>
                </div>

                {/* Table */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Level</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-4 text-center">
                                        <div className="flex justify-center">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                                        </div>
                                    </td>
                                </tr>
                            ) : agents?.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                                        No agents found
                                    </td>
                                </tr>
                            ) : (
                                agents.map((agent) => (
                                    <tr key={agent.id} className="hover:bg-gray-50 transition">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="h-8 w-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xs mr-3">
                                                    {agent.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="text-sm font-medium text-gray-900">{agent.name} {agent.id === currentUser.id && <span className="text-xs text-gray-400 font-normal ml-1">(You)</span>}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-600">{agent.email}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${agent.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'}`}>
                                                {agent.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {agent.level ? (
                                                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">L{agent.level}</span>
                                            ) : (
                                                <span className="text-gray-400 text-xs">—</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => openLogins(agent)}
                                                className="text-gray-600 hover:text-gray-900 mr-4"
                                            >
                                                Accesos
                                            </button>
                                            <button
                                                onClick={() => handleEdit(agent)}
                                                className="text-primary-600 hover:text-primary-900 mr-4"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDelete(agent.id)}
                                                className={`text-red-600 hover:text-red-900 ${agent.id === currentUser.id ? 'opacity-30 cursor-not-allowed' : ''}`}
                                                disabled={agent.id === currentUser.id}
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </main>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 flex-shrink-0">
                            <h2 className="text-xl font-bold text-gray-900">
                                {editingAgent ? 'Edit Agent' : 'Add New Agent'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
                            {error && (
                                <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm border border-red-200">
                                    {error}
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                                <input
                                    type="email"
                                    required
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                                <select
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                >
                                    <option value="agent">Agent</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Support Level</label>
                                <select
                                    value={formData.level}
                                    onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                >
                                    <option value="">No level</option>
                                    <option value="1">L1 — First line</option>
                                    <option value="2">L2 — Second line</option>
                                    <option value="3">L3 — Specialist</option>
                                </select>
                            </div>

                            <hr className="my-4 border-gray-100" />

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {editingAgent ? 'New Password (leave blank for no change)' : 'Password'}
                                </label>
                                <input
                                    type="password"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                                <input
                                    type="password"
                                    value={formData.password_confirmation}
                                    onChange={(e) => setFormData({ ...formData, password_confirmation: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                />
                            </div>

                            <div className="flex justify-end space-x-3 pt-6">
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
                                    {editingAgent ? 'Save Changes' : 'Create Agent'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Login history modal */}
            {loginsAgent && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 flex-shrink-0">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Registro de accesos</h2>
                                <p className="text-sm text-gray-500">{loginsAgent.name} · {loginsAgent.email}</p>
                            </div>
                            <button onClick={() => setLoginsAgent(null)} className="text-gray-400 hover:text-gray-600">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1">
                            {loginsLoading ? (
                                <div className="flex justify-center py-10">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                                </div>
                            ) : (loginsData?.data?.length ?? 0) === 0 ? (
                                <p className="text-center text-gray-500 py-10">Sin registros de acceso.</p>
                            ) : (
                                <table className="min-w-full divide-y divide-gray-200 text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha y hora</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dispositivo</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {loginsData.data.map((log) => (
                                            <tr key={log.id} className="hover:bg-gray-50">
                                                <td className="px-3 py-2 whitespace-nowrap text-gray-700">{fmtDateTime(log.created_at)}</td>
                                                <td className="px-3 py-2 whitespace-nowrap">
                                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${log.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                        {log.status === 'success' ? 'Correcto' : 'Fallido'}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap text-gray-500 font-mono text-xs">{log.ip_address || '—'}</td>
                                                <td className="px-3 py-2 text-gray-500" title={log.user_agent || ''}>{summarizeUA(log.user_agent)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                        {loginsData && loginsData.last_page > 1 && (
                            <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
                                <p className="text-sm text-gray-500">Página {loginsData.current_page} de {loginsData.last_page}</p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setLoginsPage((p) => Math.max(1, p - 1))}
                                        disabled={loginsPage === 1}
                                        className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        Anterior
                                    </button>
                                    <button
                                        onClick={() => setLoginsPage((p) => Math.min(loginsData.last_page, p + 1))}
                                        disabled={loginsPage === loginsData.last_page}
                                        className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        Siguiente
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </AgentLayout>
    );
}
