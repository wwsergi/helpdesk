import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../lib/api';
import AgentLayout from '../../components/agent/AgentLayout';

export default function KnowledgeBase() {
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState([]);
    const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
    const categoryRef = useRef(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingArticle, setEditingArticle] = useState(null);
    const [formData, setFormData] = useState({
        title: '',
        content: '',
        solution: '',
        category_id: '',
        is_published: true,
    });

    const queryClient = useQueryClient();

    // Close dropdown on outside click — same as Inbox
    useEffect(() => {
        const handler = (e) => {
            if (categoryRef.current && !categoryRef.current.contains(e.target)) setCategoryDropdownOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const { data: allArticles, isLoading } = useQuery({
        queryKey: ['kb', searchQuery],
        queryFn: async () => {
            const params = searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : '';
            const response = await apiClient.get(`/kb${params}`);
            return response.data;
        },
    });

    const articles = categoryFilter.length > 0
        ? allArticles?.filter(a => categoryFilter.includes(a.category_id))
        : allArticles;

    const { data: flatCategories } = useQuery({
        queryKey: ['categories-flat'],
        queryFn: async () => {
            const response = await apiClient.get('/categories');
            const flatten = (items, depth = 0) => {
                let flat = [];
                items.forEach(item => {
                    flat.push({ ...item, depth });
                    if (item.children) flat = [...flat, ...flatten(item.children, depth + 1)];
                });
                return flat;
            };
            return flatten(response.data);
        },
    });

    const createMutation = useMutation({
        mutationFn: async (data) => apiClient.post('/kb', data),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['kb'] }); handleCloseModal(); },
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }) => apiClient.patch(`/kb/${id}`, data),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['kb'] }); handleCloseModal(); },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id) => apiClient.delete(`/kb/${id}`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['kb'] }),
    });

    const handleOpenModal = (article = null) => {
        if (article) {
            setEditingArticle(article);
            setFormData({
                title: article.title,
                content: article.content,
                solution: article.solution || '',
                category_id: article.category_id || '',
                is_published: article.is_published,
            });
        } else {
            setEditingArticle(null);
            setFormData({ title: '', content: '', solution: '', category_id: '', is_published: true });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => { setIsModalOpen(false); setEditingArticle(null); };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (editingArticle) {
            updateMutation.mutate({ id: editingArticle.id, data: formData });
        } else {
            createMutation.mutate(formData);
        }
    };

    const handleDelete = (id) => {
        if (window.confirm('¿Seguro que quieres eliminar este artículo?')) {
            deleteMutation.mutate(id);
        }
    };

    return (
        <AgentLayout>
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-6 flex justify-between items-center flex-wrap gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Knowledge Base</h1>
                        <p className="text-sm text-gray-500 mt-1">Artículos de resolución de incidencias</p>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        {/* Search */}
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Buscar artículos..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 transition w-64"
                            />
                            <svg className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>

                        {/* Category filter — exact Inbox pattern */}
                        <div className="flex flex-wrap gap-2 items-center">
                            <div className="relative" ref={categoryRef}>
                                <button
                                    type="button"
                                    onClick={() => setCategoryDropdownOpen(o => !o)}
                                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                >
                                    {categoryFilter.length === 0 ? 'Todas las categorías' : `${categoryFilter.length} seleccionada${categoryFilter.length > 1 ? 's' : ''}`}
                                    <svg className={`w-4 h-4 text-gray-400 transition-transform ${categoryDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>
                                {categoryDropdownOpen && (
                                    <ul className="absolute z-50 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                                        {flatCategories?.map(cat => (
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
                                    {flatCategories?.filter(c => categoryFilter.includes(c.id)).map(cat => (
                                        <span key={cat.id} className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 text-primary-800 text-xs font-medium rounded-full">
                                            {cat.name}
                                            <button onClick={() => setCategoryFilter(prev => prev.filter(x => x !== cat.id))} className="ml-0.5 font-bold hover:text-primary-900">×</button>
                                        </span>
                                    ))}
                                    <button onClick={() => setCategoryFilter([])} className="text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 px-2 py-1 rounded transition">
                                        Limpiar
                                    </button>
                                </>
                            )}
                        </div>

                        <button
                            onClick={() => handleOpenModal(null)}
                            className="px-4 py-2 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700 transition flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Nuevo artículo
                        </button>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                    </div>
                ) : articles?.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">
                        <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                        <p className="font-medium">No hay artículos todavía</p>
                        <p className="text-sm mt-1">Los tickets resueltos con solución se añaden automáticamente</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {articles?.map(article => (
                            <div key={article.id} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition flex flex-col">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="px-2 py-0.5 bg-primary-50 text-primary-700 text-xs font-medium rounded">
                                        {article.category?.name || 'Sin categoría'}
                                    </span>
                                    <div className="flex space-x-1">
                                        <button onClick={() => handleOpenModal(article)} className="p-1 text-gray-400 hover:text-primary-600 rounded">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                        </button>
                                        <button onClick={() => handleDelete(article.id)} className="p-1 text-gray-400 hover:text-red-600 rounded">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </div>
                                </div>
                                <h3 className="text-base font-bold text-gray-900 mb-2 line-clamp-2">{article.title}</h3>
                                <p className="text-sm text-gray-600 line-clamp-2 mb-2">{article.content}</p>
                                {article.solution && (
                                    <div className="mt-auto pt-3 border-t border-green-100">
                                        <p className="text-xs font-semibold text-green-700 mb-1">Solución</p>
                                        <p className="text-xs text-gray-600 line-clamp-2">{article.solution}</p>
                                    </div>
                                )}
                                {!article.is_published && (
                                    <span className="text-xs text-orange-500 font-medium italic mt-2">Borrador</span>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center flex-shrink-0">
                            <h2 className="text-xl font-bold text-gray-900">
                                {editingArticle ? 'Editar artículo' : 'Nuevo artículo'}
                            </h2>
                            <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                                <select
                                    value={formData.category_id}
                                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                >
                                    <option value="">Sin categoría</option>
                                    {flatCategories?.map(cat => (
                                        <option key={cat.id} value={cat.id}>
                                            {' '.repeat(cat.depth * 4)}{cat.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción del problema</label>
                                <textarea
                                    required
                                    rows={4}
                                    value={formData.content}
                                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                    placeholder="Describe el problema o la incidencia..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Solución
                                    <span className="ml-1 text-xs text-gray-400 font-normal">(se rellena automáticamente al marcar como Solución en un ticket)</span>
                                </label>
                                <textarea
                                    rows={4}
                                    value={formData.solution}
                                    onChange={(e) => setFormData({ ...formData, solution: e.target.value })}
                                    className="w-full px-4 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-400 bg-green-50"
                                    placeholder="Describe cómo se resolvió el problema..."
                                />
                            </div>
                            <div className="flex items-center">
                                <label className="flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.is_published}
                                        onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                                        className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                                    />
                                    <span className="ml-2 text-sm text-gray-700">Publicado</span>
                                </label>
                            </div>
                            <div className="flex justify-end space-x-3 pt-2">
                                <button type="button" onClick={handleCloseModal}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition">
                                    Cancelar
                                </button>
                                <button type="submit"
                                    className="px-6 py-2 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700 transition">
                                    {editingArticle ? 'Guardar cambios' : 'Crear artículo'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AgentLayout>
    );
}
