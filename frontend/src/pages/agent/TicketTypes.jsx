import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../lib/api';
import AgentLayout from '../../components/agent/AgentLayout';

export default function TicketTypes() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingType, setEditingType] = useState(null);
    const [formData, setFormData] = useState({ name: '', description: '', is_active: true });

    const queryClient = useQueryClient();

    const { data: ticketTypes, isLoading } = useQuery({
        queryKey: ['ticket-types'],
        queryFn: async () => {
            const response = await apiClient.get('/ticket-types');
            return response.data;
        },
    });

    const createMutation = useMutation({
        mutationFn: async (data) => apiClient.post('/ticket-types', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ticket-types'] });
            handleCloseModal();
        },
        onError: (err) => alert(err.response?.data?.message || 'Failed to create ticket type'),
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }) => apiClient.patch(`/ticket-types/${id}`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ticket-types'] });
            handleCloseModal();
        },
        onError: (err) => alert(err.response?.data?.message || 'Failed to update ticket type'),
    });

    const deleteMutation = useMutation({
        mutationFn: async (id) => apiClient.delete(`/ticket-types/${id}`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ticket-types'] }),
        onError: (err) => alert(err.response?.data?.message || 'Failed to delete'),
    });

    const handleOpenModal = (editing = null) => {
        setEditingType(editing);
        setFormData({
            name: editing ? editing.name : '',
            description: editing ? (editing.description || '') : '',
            is_active: editing ? editing.is_active : true,
        });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingType(null);
        setFormData({ name: '', description: '', is_active: true });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (editingType) {
            updateMutation.mutate({ id: editingType.id, data: formData });
        } else {
            createMutation.mutate(formData);
        }
    };

    const handleDelete = (type) => {
        if (window.confirm(`Are you sure you want to delete "${type.name}"?`)) {
            deleteMutation.mutate(type.id);
        }
    };

    return (
        <AgentLayout>
            <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">Ticket Types</h1>
                    <button
                        onClick={() => handleOpenModal()}
                        className="px-4 py-2 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700 transition flex items-center"
                    >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Create Type
                    </button>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                    </div>
                ) : ticketTypes?.length === 0 ? (
                    <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
                        No ticket types defined yet. Start by creating one.
                    </div>
                ) : (
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className="px-6 py-4 text-sm font-semibold text-gray-700">Name</th>
                                    <th className="px-6 py-4 text-sm font-semibold text-gray-700">Description</th>
                                    <th className="px-6 py-4 text-sm font-semibold text-gray-700">Status</th>
                                    <th className="px-6 py-4 text-sm font-semibold text-gray-700">Tickets</th>
                                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {ticketTypes?.map((type) => (
                                    <tr key={type.id} className="hover:bg-gray-50 transition group">
                                        <td className="px-6 py-4">
                                            <span className="font-medium text-gray-900">{type.name}</span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            {type.description || '-'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${type.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                                {type.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                {type.tickets_count || 0}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition">
                                                <button
                                                    onClick={() => handleOpenModal(type)}
                                                    className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                                                    title="Edit"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(type)}
                                                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                                                    title="Delete"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </main>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
                        <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-900">
                                {editingType ? 'Edit Ticket Type' : 'Create Ticket Type'}
                            </h2>
                            <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                    placeholder="e.g. Bug Report"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                    placeholder="Brief description of this ticket type."
                                    rows="3"
                                />
                            </div>
                            <div className="flex items-center">
                                <label className="flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.is_active}
                                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                        className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                                    />
                                    <span className="ml-2 text-sm text-gray-700">Active and available for selection</span>
                                </label>
                            </div>
                            <div className="flex justify-end space-x-3 pt-6">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={createMutation.isPending || updateMutation.isPending}
                                    className="px-6 py-2 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
                                >
                                    {editingType ? 'Save Changes' : 'Create Type'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AgentLayout>
    );
}
