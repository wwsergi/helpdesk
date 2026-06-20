import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../lib/api';
import AgentLayout from '../../components/agent/AgentLayout';

const PRESET_COLORS = [
    '#ef4444', '#f97316', '#eab308', '#22c55e',
    '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#6b7280',
];

const emptyForm = { name: '', label: '', color: '#6b7280', sort_order: 0 };

export default function Priorities() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(emptyForm);

    const queryClient = useQueryClient();

    const { data: priorities, isLoading } = useQuery({
        queryKey: ['priorities'],
        queryFn: async () => (await apiClient.get('/priorities')).data,
    });

    const createMutation = useMutation({
        mutationFn: (data) => apiClient.post('/priorities', data),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['priorities'] }); closeModal(); },
        onError: (err) => alert(err.response?.data?.message || 'Error al crear'),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => apiClient.patch(`/priorities/${id}`, data),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['priorities'] }); closeModal(); },
        onError: (err) => alert(err.response?.data?.message || 'Error al guardar'),
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => apiClient.delete(`/priorities/${id}`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['priorities'] }),
        onError: (err) => alert(err.response?.data?.message || 'Error al eliminar'),
    });

    const openModal = (item = null) => {
        setEditing(item);
        setForm(item ? { name: item.name, label: item.label, color: item.color, sort_order: item.sort_order } : emptyForm);
        setIsModalOpen(true);
    };

    const closeModal = () => { setIsModalOpen(false); setEditing(null); setForm(emptyForm); };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (editing) {
            updateMutation.mutate({ id: editing.id, data: form });
        } else {
            createMutation.mutate(form);
        }
    };

    const handleDelete = (item) => {
        if (window.confirm(`¿Eliminar la prioridad "${item.label}"?`)) {
            deleteMutation.mutate(item.id);
        }
    };

    return (
        <AgentLayout>
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">Prioridades</h1>
                    <button
                        onClick={() => openModal()}
                        className="px-4 py-2 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700 transition flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Nueva prioridad
                    </button>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
                    </div>
                ) : priorities?.length === 0 ? (
                    <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
                        No hay prioridades definidas.
                    </div>
                ) : (
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className="px-6 py-4 text-sm font-semibold text-gray-700">Color</th>
                                    <th className="px-6 py-4 text-sm font-semibold text-gray-700">Valor</th>
                                    <th className="px-6 py-4 text-sm font-semibold text-gray-700">Etiqueta</th>
                                    <th className="px-6 py-4 text-sm font-semibold text-gray-700">Orden</th>
                                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {priorities?.map((p) => (
                                    <tr key={p.id} className="hover:bg-gray-50 transition group">
                                        <td className="px-6 py-4">
                                            <span
                                                className="inline-block w-6 h-6 rounded-full border border-white shadow"
                                                style={{ backgroundColor: p.color }}
                                            />
                                        </td>
                                        <td className="px-6 py-4">
                                            <span
                                                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                                                style={{ backgroundColor: p.color + '22', color: p.color, border: `1px solid ${p.color}55` }}
                                            >
                                                {p.name}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-medium text-gray-900">{p.label}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500">{p.sort_order}</td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition">
                                                <button
                                                    onClick={() => openModal(p)}
                                                    className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                                                    title="Editar"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(p)}
                                                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                                                    title="Eliminar"
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
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
                        <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-900">
                                {editing ? 'Editar prioridad' : 'Nueva prioridad'}
                            </h2>
                            <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Valor <span className="text-xs text-gray-400">(se guarda en el ticket, ej: P1)</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    maxLength={50}
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                    placeholder="P1"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Etiqueta</label>
                                <input
                                    type="text"
                                    required
                                    maxLength={100}
                                    value={form.label}
                                    onChange={(e) => setForm({ ...form, label: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                    placeholder="Crítica"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {PRESET_COLORS.map((c) => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => setForm({ ...form, color: c })}
                                            className="w-7 h-7 rounded-full transition"
                                            style={{
                                                backgroundColor: c,
                                                outline: form.color === c ? `3px solid ${c}` : 'none',
                                                outlineOffset: '2px',
                                            }}
                                        />
                                    ))}
                                </div>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="color"
                                        value={form.color}
                                        onChange={(e) => setForm({ ...form, color: e.target.value })}
                                        className="w-10 h-10 rounded cursor-pointer border border-gray-300"
                                    />
                                    <input
                                        type="text"
                                        value={form.color}
                                        onChange={(e) => setForm({ ...form, color: e.target.value })}
                                        className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-primary-500"
                                        placeholder="#ef4444"
                                    />
                                    <span
                                        className="px-3 py-1 rounded-full text-sm font-semibold"
                                        style={{ backgroundColor: form.color + '22', color: form.color, border: `1px solid ${form.color}55` }}
                                    >
                                        {form.name || 'P1'}
                                    </span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Orden</label>
                                <input
                                    type="number"
                                    min={0}
                                    value={form.sort_order}
                                    onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
                                    className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={createMutation.isPending || updateMutation.isPending}
                                    className="px-6 py-2 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
                                >
                                    {editing ? 'Guardar' : 'Crear'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AgentLayout>
    );
}
