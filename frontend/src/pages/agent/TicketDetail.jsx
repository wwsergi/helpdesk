import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../lib/api';
import FileUpload from '../../components/FileUpload';
import { usePriorities, getPriorityBadgeStyle } from '../../hooks/usePriorities';

function ImageThumb({ att, onClick }) {
    const [blobUrl, setBlobUrl] = useState(null);

    useEffect(() => {
        let revoked = false;
        let createdUrl = null;
        apiClient.get(`/attachments/${att.id}`, { responseType: 'blob' })
            .then(response => {
                if (revoked) return;
                createdUrl = window.URL.createObjectURL(response.data);
                setBlobUrl(createdUrl);
            })
            .catch(err => console.error('Image load failed', err));
        return () => {
            revoked = true;
            if (createdUrl) window.URL.revokeObjectURL(createdUrl);
        };
    }, [att.id]);

    if (!blobUrl) {
        return (
            <div className="w-24 h-24 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            </div>
        );
    }

    return (
        <img
            src={blobUrl}
            alt={att.name}
            onClick={() => onClick(blobUrl, att.name)}
            className="w-24 h-24 object-cover rounded-lg cursor-pointer hover:opacity-80 transition border border-gray-200"
        />
    );
}

function downloadAttachment(att) {
    apiClient.get(`/attachments/${att.id}`, { responseType: 'blob' })
        .then(response => {
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', att.name);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        })
        .catch(err => console.error('Download failed', err));
}

export default function AgentTicketDetail() {
    const { id } = useParams();
    const { logout, user: currentUser } = useAuthStore();
    const navigate = useNavigate();
    const isL2Agent = currentUser?.level == 2;
    const [replyText, setReplyText] = useState('');
    const [isInternal, setIsInternal] = useState(true);
    const [isSolution, setIsSolution] = useState(false);
    const [files, setFiles] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState('');
    const { data: priorities = [] } = usePriorities();
    const [jiraValue, setJiraValue] = useState('');
    const [isDelegateModalOpen, setIsDelegateModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('conversation');
    const [lightboxImage, setLightboxImage] = useState(null);
    const [isTimeEntryModalOpen, setIsTimeEntryModalOpen] = useState(false);
    const [editingTimeEntry, setEditingTimeEntry] = useState(null);
    const [timeEntryForm, setTimeEntryForm] = useState({
        description: '',
        assistance_type: 'remote',
        date: new Date().toLocaleDateString('en-CA'),
        hours: '0',
        minutes: '0',
    });
    const [timeEntryError, setTimeEntryError] = useState('');
    const [delegateForm, setDelegateForm] = useState({
        user_id: '',
        priority: 'P4',
        comment: ''
    });
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [editingMessageBody, setEditingMessageBody] = useState('');
    const [editingTitle, setEditingTitle] = useState(false);
    const [titleValue, setTitleValue] = useState('');
    const [isEditingContact, setIsEditingContact] = useState(false);
    const [contactSearch, setContactSearch] = useState('');
    const queryClient = useQueryClient();

    const { data: ticket, isLoading } = useQuery({
        queryKey: ['ticket', id],
        queryFn: async () => {
            const response = await apiClient.get(`/tickets/${id}`);
            setSelectedStatus(response.data.status);
            if (response.data.parent_ticket_id) setIsInternal(true);
            return response.data;
        },
    });

    useEffect(() => {
        if (ticket) setJiraValue(ticket.jira_issue_link || '');
    }, [ticket?.jira_issue_link]);

    // When viewing a subticket, fetch the parent ticket directly so its
    // conversation is always fresh and independent of the nested response.
    const { data: parentTicket } = useQuery({
        queryKey: ['ticket', ticket?.parent_ticket_id],
        queryFn: async () => {
            const response = await apiClient.get(`/tickets/${ticket.parent_ticket_id}`);
            return response.data;
        },
        enabled: !!ticket?.parent_ticket_id,
    });

    const { data: agents } = useQuery({
        queryKey: ['agents'],
        queryFn: async () => {
            const response = await apiClient.get('/agents');
            return response.data;
        },
    });

    const { data: contacts } = useQuery({
        queryKey: ['contacts-search', contactSearch],
        queryFn: async () => {
            const params = new URLSearchParams({ per_page: 50 });
            if (contactSearch) params.set('search', contactSearch);
            const response = await apiClient.get(`/contacts?${params}`);
            return response.data?.data ?? response.data;
        },
        enabled: isEditingContact,
    });

    const { data: ticketTypes } = useQuery({
        queryKey: ['ticket-types'],
        queryFn: async () => {
            const response = await apiClient.get('/ticket-types');
            return response.data;
        },
    });

    const replyMutation = useMutation({
        mutationFn: async (data) => {
            return await apiClient.post(`/tickets/${id}/messages`, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ticket', id] });
            if (ticket?.parent_ticket_id) {
                queryClient.invalidateQueries({ queryKey: ['ticket', ticket.parent_ticket_id] });
            }
            setReplyText('');
            setFiles([]);
            setIsSolution(false);
            if (!ticket?.parent_ticket_id && !isL2Agent) setIsInternal(true);
        },
    });

    const updateTicketMutation = useMutation({
        mutationFn: async (data) => {
            return await apiClient.patch(`/tickets/${id}`, data);
        },
        onSuccess: (response, variables) => {
            const updatedTicket = response.data;
            if ('contact_id' in variables || 'delegation_comment' in variables) {
                queryClient.invalidateQueries({ queryKey: ['ticket', id] });
            } else {
                queryClient.setQueryData(['ticket', id], (old) => ({
                    ...old,
                    ...updatedTicket,
                    messages: old?.messages ?? updatedTicket.messages,
                    children: old?.children ?? updatedTicket.children,
                }));
            }
            if (updatedTicket.status) {
                setSelectedStatus(updatedTicket.status);
            }
        },
        onError: (err) => alert('Error al guardar: ' + (err.response?.data?.message || err.message)),
    });

    const createChildTicketMutation = useMutation({
        mutationFn: async (data) => {
            return await apiClient.post('/tickets', {
                ...data,
                parent_ticket_id: id,
                type: 'OTHER',
                contact_id: ticket.contact_id,
            });
        },
        onSuccess: async (_, variables) => {
            if (variables.user_id) {
                await apiClient.patch(`/tickets/${id}`, { user_id: variables.user_id });
            }
            queryClient.invalidateQueries({ queryKey: ['ticket', id] });
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            setIsDelegateModalOpen(false);
            setDelegateForm({ user_id: '', priority: 'P4', comment: '' });
        },
    });

    const deleteTicketMutation = useMutation({
        mutationFn: async () => {
            return await apiClient.delete(`/tickets/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            navigate('/agent/inbox');
        },
    });

    const editMessageMutation = useMutation({
        mutationFn: async ({ messageId, body }) => {
            return await apiClient.patch(`/tickets/messages/${messageId}`, { body });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ticket', id] });
            if (ticket?.parent_ticket_id) {
                queryClient.invalidateQueries({ queryKey: ['ticket', ticket.parent_ticket_id] });
            }
            setEditingMessageId(null);
            setEditingMessageBody('');
        },
        onError: (error) => {
            alert('Error editing message: ' + (error.response?.data?.message || error.message));
        },
    });

    const handleReply = async (e) => {
        e.preventDefault();

        try {
            // Upload files first if any
            let uploadedAttachments = [];
            if (files.length > 0) {
                setIsUploading(true);
                const uploadPromises = files.map(async (file) => {
                    const formData = new FormData();
                    formData.append('file', file);
                    const response = await apiClient.post('/attachments/upload', formData, {
                        headers: {
                            'Content-Type': 'multipart/form-data',
                        },
                    });
                    return response.data;
                });
                uploadedAttachments = await Promise.all(uploadPromises);
                setIsUploading(false);
            }

            replyMutation.mutate({
                body: replyText,
                is_internal: isInternal,
                is_solution: isSolution,
                attachments: uploadedAttachments
            });
        } catch (error) {
            setIsUploading(false);
            alert('Error uploading files: ' + (error.response?.data?.message || error.message));
        }
    };

    const handleDelegateSubmit = (e) => {
        e.preventDefault();
        createChildTicketMutation.mutate(delegateForm);
    };

    const { data: timeEntriesData, refetch: refetchTimeEntries } = useQuery({
        queryKey: ['ticket-time-entries', id],
        queryFn: async () => {
            const response = await apiClient.get(`/tickets/${id}/time-entries`);
            return response.data;
        },
        enabled: activeTab === 'tiempos',
    });

    const createTimeEntryMutation = useMutation({
        mutationFn: async (data) => apiClient.post(`/tickets/${id}/time-entries`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ticket-time-entries', id] });
            setIsTimeEntryModalOpen(false);
            setTimeEntryError('');
            resetTimeEntryForm();
        },
        onError: (error) => {
            const msg = error.response?.data?.message || Object.values(error.response?.data?.errors || {})[0]?.[0] || 'Error al guardar';
            setTimeEntryError(msg);
        },
    });

    const updateTimeEntryMutation = useMutation({
        mutationFn: async ({ entryId, data }) => apiClient.patch(`/tickets/${id}/time-entries/${entryId}`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ticket-time-entries', id] });
            setIsTimeEntryModalOpen(false);
            setTimeEntryError('');
            resetTimeEntryForm();
        },
        onError: (error) => {
            const msg = error.response?.data?.message || Object.values(error.response?.data?.errors || {})[0]?.[0] || 'Error al guardar';
            setTimeEntryError(msg);
        },
    });

    const deleteTimeEntryMutation = useMutation({
        mutationFn: async (entryId) => apiClient.delete(`/tickets/${id}/time-entries/${entryId}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ticket-time-entries', id] });
        },
    });

    const resetTimeEntryForm = () => {
        setTimeEntryForm({ description: '', assistance_type: 'remote', date: new Date().toLocaleDateString('en-CA'), hours: '0', minutes: '0' });
        setTimeEntryError('');
        setEditingTimeEntry(null);
    };

    const handleTimeEntrySubmit = (e) => {
        e.preventDefault();
        const totalMinutes = (parseInt(timeEntryForm.hours, 10) * 60) + parseInt(timeEntryForm.minutes, 10);
        if (totalMinutes < 1) {
            setTimeEntryError('La duración debe ser al menos 1 minuto.');
            return;
        }
        const data = {
            description: timeEntryForm.description,
            assistance_type: timeEntryForm.assistance_type,
            date: timeEntryForm.date,
            duration_minutes: totalMinutes,
        };
        if (editingTimeEntry) {
            updateTimeEntryMutation.mutate({ entryId: editingTimeEntry.id, data });
        } else {
            createTimeEntryMutation.mutate(data);
        }
    };

    const handleEditTimeEntry = (entry) => {
        setEditingTimeEntry(entry);
        setTimeEntryForm({
            description: entry.description,
            assistance_type: entry.assistance_type,
            date: entry.date ? entry.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
            hours: String(Math.floor((entry.duration_minutes || 0) / 60)),
            minutes: String((entry.duration_minutes || 0) % 60),
        });
        setIsTimeEntryModalOpen(true);
    };

    const formatDuration = (minutes) => {
        if (!minutes) return '—';
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };

    const { data: flatCategories } = useQuery({
        queryKey: ['categories-flat'],
        queryFn: async () => {
            const response = await apiClient.get('/categories');
            const flatten = (items, depth = 0) => {
                let flat = [];
                items.forEach(item => {
                    flat.push({ id: item.id, name: item.name, depth });
                    if (item.children) {
                        flat = [...flat, ...flatten(item.children, depth + 1)];
                    }
                });
                return flat;
            };
            return flatten(response.data);
        },
    });

    const handleStatusChange = (e) => {
        const newStatus = e.target.value;
        setSelectedStatus(newStatus);
        updateTicketMutation.mutate({ status: newStatus });
    };

    const handleAssignmentChange = (e) => {
        const userId = e.target.value === '' ? null : e.target.value;
        updateTicketMutation.mutate({ user_id: userId });
    };

    const handleCategoryChange = (e) => {
        const categoryId = e.target.value || null;
        updateTicketMutation.mutate({ category_id: categoryId });
    };

    const handleTypeChange = (e) => {
        const typeId = e.target.value || null;
        updateTicketMutation.mutate({ ticket_type_id: typeId });
    };

    const handleDelete = () => {
        if (window.confirm('Are you sure you want to delete this ticket? This action cannot be undone.')) {
            deleteTicketMutation.mutate();
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    if (!ticket) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <p className="text-gray-500">Ticket not found</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-4">
                            <Link to="/agent/inbox" className="text-gray-600 hover:text-gray-900">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                            </Link>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">{ticket.uuid}</h1>
                                {editingTitle ? (
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <input
                                            autoFocus
                                            value={titleValue}
                                            onChange={(e) => setTitleValue(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    updateTicketMutation.mutate({ subject: titleValue });
                                                    setEditingTitle(false);
                                                } else if (e.key === 'Escape') {
                                                    setEditingTitle(false);
                                                }
                                            }}
                                            className="text-sm text-gray-900 border border-gray-300 rounded px-2 py-0.5 focus:ring-2 focus:ring-primary-500 focus:outline-none w-72"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => { updateTicketMutation.mutate({ subject: titleValue }); setEditingTitle(false); }}
                                            className="text-xs text-white bg-primary-600 hover:bg-primary-700 px-2 py-0.5 rounded transition"
                                        >Save</button>
                                        <button
                                            type="button"
                                            onClick={() => setEditingTitle(false)}
                                            className="text-xs text-gray-600 hover:text-gray-900 border border-gray-300 px-2 py-0.5 rounded transition"
                                        >Cancel</button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <p className="text-sm text-gray-600">{ticket.subject}</p>
                                        {ticket.status !== 'CLOSED' && (
                                            <button
                                                type="button"
                                                onClick={() => { setTitleValue(ticket.subject); setEditingTitle(true); }}
                                                className="text-gray-400 hover:text-primary-600 transition"
                                                title="Edit title"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-1a2 2 0 01.586-1.414z" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center space-x-4">
                            <Link to="/agent" className="text-sm font-medium text-gray-700 hover:text-primary-600">Dashboard</Link>
                            <Link to="/agent/contacts" className="text-sm font-medium text-gray-700 hover:text-primary-600">Customers</Link>
                            <Link to="/agent/agents" className="text-sm font-medium text-gray-700 hover:text-primary-600">Agents</Link>
                            <Link to="/agent/categories" className="text-sm font-medium text-gray-700 hover:text-primary-600">Categories</Link>
                            <Link to="/agent/kb" className="text-sm font-medium text-gray-700 hover:text-primary-600">Troubleshooting</Link>
                            <button
                                onClick={logout}
                                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </header>


            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Tabs */}
                        <div className="border-b border-gray-200">
                            <nav className="-mb-px flex space-x-8">
                                <button
                                    onClick={() => setActiveTab('conversation')}
                                    className={`${activeTab === 'conversation'
                                        ? 'border-primary-500 text-primary-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                        } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                                >
                                    Conversation
                                </button>
                                <button
                                    onClick={() => setActiveTab('tiempos')}
                                    className={`${activeTab === 'tiempos'
                                        ? 'border-primary-500 text-primary-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                        } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                                >
                                    Tiempos
                                </button>
                            </nav>
                        </div>

                        {/* Tab Content */}
                        {activeTab === 'conversation' && (
                            <>
                                {/* Messages Timeline — parent + all subticket messages merged */}
                                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Conversation</h2>
                                    <div className="space-y-4">
                                        {(() => {
                                            // Single source of truth: all messages live on the parent ticket.
                                            // Subticket view uses its own direct query for the parent.
                                            const messages = ticket.parent_ticket_id
                                                ? (parentTicket?.messages || [])
                                                : (ticket.messages || []);
                                            const sorted = [...messages].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
                                            return sorted.length > 0 ? sorted.map((message) => (
                                                <div
                                                    key={message.id}
                                                    className={`p-4 rounded-lg ${message.is_solution
                                                        ? 'bg-green-50 border border-green-300'
                                                        : message.is_internal
                                                            ? 'bg-yellow-50 border border-yellow-200'
                                                            : 'bg-gray-50 border border-gray-200'
                                                        }`}
                                                >
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-semibold text-gray-900">
                                                                {message.user?.name || message.contact?.name || 'Unknown'}
                                                            </span>
                                                            {message.is_solution && (
                                                                <span className="px-2 py-0.5 bg-green-200 text-green-800 text-xs font-semibold rounded flex items-center gap-1">
                                                                    ✓ Solución
                                                                </span>
                                                            )}
                                                            {message.is_internal && (
                                                                <span className="px-2 py-0.5 bg-yellow-200 text-yellow-800 text-xs font-medium rounded">
                                                                    Internal Note
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs text-gray-500">
                                                                {new Date(message.created_at).toLocaleString()}
                                                            </span>
                                                            {message.user_id == currentUser?.id && ticket.status !== 'CLOSED' && editingMessageId !== message.id && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setEditingMessageId(message.id);
                                                                        setEditingMessageBody(message.body);
                                                                    }}
                                                                    className="text-xs text-gray-400 hover:text-primary-600 transition"
                                                                >
                                                                    Edit
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {editingMessageId === message.id ? (
                                                        <div className="space-y-2">
                                                            <textarea
                                                                value={editingMessageBody}
                                                                onChange={(e) => setEditingMessageBody(e.target.value)}
                                                                rows={4}
                                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                                                            />
                                                            <div className="flex gap-2">
                                                                <button
                                                                    type="button"
                                                                    disabled={editMessageMutation.isPending}
                                                                    onClick={() => editMessageMutation.mutate({ messageId: message.id, body: editingMessageBody })}
                                                                    className="px-3 py-1.5 bg-primary-600 text-white text-xs font-medium rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
                                                                >
                                                                    {editMessageMutation.isPending ? 'Saving...' : 'Save'}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => { setEditingMessageId(null); setEditingMessageBody(''); }}
                                                                    className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <p className="text-gray-700 whitespace-pre-wrap">{message.body}</p>
                                                    )}

                                                    {/* Attachments */}
                                                    {message.attachments && message.attachments.length > 0 && (
                                                        <div className="mt-3 pt-3 border-t border-gray-200/50 space-y-2">
                                                            {/* Image thumbnails */}
                                                            {message.attachments.filter(a => a.mime_type?.startsWith('image/')).length > 0 && (
                                                                <div className="flex flex-wrap gap-2">
                                                                    {message.attachments.filter(a => a.mime_type?.startsWith('image/')).map(att => (
                                                                        <ImageThumb key={att.id} att={att} onClick={(url, name) => setLightboxImage({ url, name })} />
                                                                    ))}
                                                                </div>
                                                            )}
                                                            {/* Other files */}
                                                            {message.attachments.filter(a => !a.mime_type?.startsWith('image/')).length > 0 && (
                                                                <div className="flex flex-wrap gap-2">
                                                                    {message.attachments.filter(a => !a.mime_type?.startsWith('image/')).map(att => (
                                                                        <button
                                                                            key={att.id}
                                                                            type="button"
                                                                            onClick={() => downloadAttachment(att)}
                                                                            className="flex items-center px-3 py-1.5 bg-white border border-gray-200 rounded text-sm text-primary-600 hover:text-primary-700 hover:border-primary-300 transition"
                                                                        >
                                                                            <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                                                            </svg>
                                                                            {att.name} <span className="text-gray-400 ml-1">({(att.size / 1024).toFixed(0)}KB)</span>
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )) : (
                                            <p className="text-gray-500 text-center py-8">No messages yet</p>
                                        );
                                        })()}
                                    </div>
                                </div>

                                {/* Reply Form */}
                                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Reply</h2>
                                    <form onSubmit={handleReply} className="space-y-4">
                                        <div>
                                            <textarea
                                                value={replyText}
                                                onChange={(e) => setReplyText(e.target.value)}
                                                rows={6}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                                placeholder="Escribe un mensaje..."
                                                required
                                            />
                                        </div>

                                        <div>
                                            <FileUpload files={files} onFilesChange={setFiles} maxSizeBytes={10 * 1024 * 1024} />
                                        </div>

                                        <div className="flex items-center justify-between gap-4 flex-wrap">
                                            <div className="flex items-center gap-4 flex-wrap">
                                                {(ticket.parent_ticket_id || isL2Agent) ? (
                                                    <span className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 px-2 py-1 rounded">
                                                        {ticket.parent_ticket_id
                                                            ? 'All replies in sub-tickets are internal notes'
                                                            : 'L2 agent — all replies are internal notes'}
                                                    </span>
                                                ) : (
                                                    <label className="flex items-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={!isInternal}
                                                            onChange={(e) => setIsInternal(!e.target.checked)}
                                                            className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                                                        />
                                                        <span className="ml-2 text-sm text-gray-700">Visible para cliente</span>
                                                    </label>
                                                )}
                                                <label className="flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSolution}
                                                        onChange={(e) => setIsSolution(e.target.checked)}
                                                        className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                                                    />
                                                    <span className="ml-2 text-sm text-green-700 font-medium">Marcar como Solución</span>
                                                </label>
                                            </div>
                                            <button
                                                type="submit"
                                                disabled={replyMutation.isPending || isUploading}
                                                className="px-6 py-2 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
                                            >
                                                {isUploading ? 'Uploading...' : replyMutation.isPending ? 'Sending...' : 'Send Reply'}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </>
                        )}

                        {activeTab === 'tiempos' && (
                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-lg font-semibold text-gray-900">Registro de Tiempo</h2>
                                    <button
                                        onClick={() => { resetTimeEntryForm(); setIsTimeEntryModalOpen(true); }}
                                        className="text-sm bg-primary-600 text-white px-3 py-1.5 rounded-lg hover:bg-primary-700 font-medium transition"
                                    >
                                        + Nueva acción
                                    </button>
                                </div>

                                {/* Summary */}
                                {timeEntriesData?.summary && timeEntriesData.summary.total_minutes > 0 && (
                                    <div className="grid grid-cols-3 gap-3 mb-5">
                                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-center">
                                            <div className="text-xs text-blue-600 font-medium mb-1">Total</div>
                                            <div className="text-lg font-bold text-blue-800">{formatDuration(timeEntriesData.summary.total_minutes)}</div>
                                        </div>
                                        <div className="bg-purple-50 border border-purple-100 rounded-lg p-3 text-center">
                                            <div className="text-xs text-purple-600 font-medium mb-1">Remoto</div>
                                            <div className="text-lg font-bold text-purple-800">{formatDuration(timeEntriesData.summary.remote_minutes)}</div>
                                        </div>
                                        <div className="bg-orange-50 border border-orange-100 rounded-lg p-3 text-center">
                                            <div className="text-xs text-orange-600 font-medium mb-1">Presencial</div>
                                            <div className="text-lg font-bold text-orange-800">{formatDuration(timeEntriesData.summary.onsite_minutes)}</div>
                                        </div>
                                    </div>
                                )}

                                {/* Entries list */}
                                {!timeEntriesData || timeEntriesData.entries?.length === 0 ? (
                                    <div className="text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                                        <svg className="w-10 h-10 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <p className="text-gray-500 mb-2 font-medium">Sin registros de tiempo</p>
                                        <button
                                            onClick={() => { resetTimeEntryForm(); setIsTimeEntryModalOpen(true); }}
                                            className="text-primary-600 hover:text-primary-800 text-sm font-medium border border-primary-300 px-4 py-1.5 rounded-lg hover:bg-primary-50 transition"
                                        >
                                            + Registrar primera acción
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {timeEntriesData.entries.map((entry) => (
                                            <div key={entry.id} className="p-4 bg-gray-50 rounded-lg border border-gray-100 flex items-start justify-between gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${entry.assistance_type === 'remote' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>
                                                            {entry.assistance_type === 'remote' ? 'Remoto' : 'Presencial'}
                                                        </span>
                                                        <span className="text-xs text-gray-500">{entry.agent?.name}</span>
                                                        <span className="text-xs text-gray-400">{entry.date ? new Date(entry.date + 'T00:00:00').toLocaleDateString('es-ES') : ''}</span>
                                                    </div>
                                                    <p className="text-sm text-gray-700">{entry.description}</p>
                                                </div>
                                                <div className="flex items-center gap-3 flex-shrink-0">
                                                    <span className="text-sm font-semibold text-gray-800 whitespace-nowrap">
                                                        {formatDuration(entry.duration_minutes)}
                                                    </span>
                                                    {(entry.agent_id === currentUser?.id || currentUser?.role === 'admin') && (
                                                        <div className="flex gap-2">
                                                            <button onClick={() => handleEditTimeEntry(entry)} className="text-xs text-gray-400 hover:text-primary-600 transition">Editar</button>
                                                            <button
                                                                onClick={() => { if (window.confirm('¿Eliminar este registro?')) deleteTimeEntryMutation.mutate(entry.id); }}
                                                                className="text-xs text-gray-400 hover:text-red-600 transition"
                                                            >Eliminar</button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Customer Info */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold text-gray-900">Customer</h2>
                                {ticket.status !== 'CLOSED' && !isEditingContact && (
                                    <button
                                        type="button"
                                        onClick={() => { setIsEditingContact(true); setContactSearch(''); }}
                                        className="text-xs text-gray-400 hover:text-primary-600 transition flex items-center gap-1"
                                        title="Cambiar cliente"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-1a2 2 0 01.586-1.414z" />
                                        </svg>
                                        Cambiar cliente
                                    </button>
                                )}
                            </div>

                            {isEditingContact ? (
                                <div className="space-y-2">
                                    <input
                                        autoFocus
                                        type="text"
                                        placeholder="Buscar cliente..."
                                        value={contactSearch}
                                        onChange={(e) => setContactSearch(e.target.value)}
                                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                                    />
                                    <select
                                        size={5}
                                        className="w-full border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                                        value={ticket.contact_id || ''}
                                        onChange={(e) => {
                                            updateTicketMutation.mutate({ contact_id: e.target.value || null });
                                            setIsEditingContact(false);
                                        }}
                                    >
                                        <option value="">— Sin cliente —</option>
                                        {(contacts || []).map(c => (
                                            <option key={c.id} value={c.id}>
                                                {c.name}{c.email ? ` (${c.email})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={() => setIsEditingContact(false)}
                                        className="text-xs text-gray-500 hover:text-gray-700 transition"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-2 text-sm">
                                    <div>
                                        <div className="font-medium text-gray-900">{ticket.contact?.name || 'Unknown'}</div>
                                        <div className="text-gray-600">{ticket.contact?.email}</div>
                                        {ticket.contact?.phone && <div className="text-gray-600">{ticket.contact.phone}</div>}
                                    </div>
                                    {ticket.contact?.has_contract && (
                                        <div className="pt-2 border-t border-gray-100">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${new Date(ticket.contact.contract_end_date) >= new Date() || !ticket.contact.contract_end_date ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                Contrato: {ticket.contact.contract_type === 'unlimited' ? 'Mantenimiento' : ticket.contact.contract_type === 'hours' ? `${ticket.contact.contract_hours_month}h/mes` : 'Activo'}
                                            </span>
                                            {ticket.contact.contract_end_date && (
                                                <div className="text-xs text-gray-400 mt-1">Vence: {new Date(ticket.contact.contract_end_date).toLocaleDateString('es-ES')}</div>
                                            )}
                                        </div>
                                    )}
                                    {(ticket.contact_name || ticket.contact_phone) && (
                                        <div className="pt-2 border-t border-gray-100">
                                            <div className="text-xs font-medium text-gray-500 mb-1">Caller Info</div>
                                            {ticket.contact_name && <div className="font-medium text-gray-800">{ticket.contact_name}</div>}
                                            {ticket.contact_phone && <div className="text-gray-600">{ticket.contact_phone}</div>}
                                        </div>
                                    )}
                                    {ticket.creator && (
                                        <div className="pt-2 border-t border-gray-100">
                                            <div className="text-xs font-medium text-gray-500 mb-1">Created by</div>
                                            <div className="font-medium text-gray-800">{ticket.creator.name}</div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {!ticket.parent_ticket_id && (
                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions</h2>
                                <div className="space-y-3">
                                    <button
                                        onClick={() => setIsDelegateModalOpen(true)}
                                        className="w-full bg-white border border-gray-300 text-gray-700 font-medium py-2 px-4 rounded-lg hover:bg-gray-50 transition flex items-center justify-center"
                                    >
                                        <svg className="w-5 h-5 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                        </svg>
                                        Delegate
                                    </button>
                                    <Link
                                        to={`/agent/tickets/${id}/assistance-sheet`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full bg-white border border-blue-300 text-blue-700 font-medium py-2 px-4 rounded-lg hover:bg-blue-50 transition flex items-center justify-center"
                                    >
                                        <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                        </svg>
                                        Hoja de Asistencia PDF
                                    </Link>
                                </div>
                            </div>
                        )}

                        {/* Ticket Info */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">Ticket Details</h2>
                            <div className="space-y-3 text-sm">
                                <div>
                                    <label className="block text-gray-600 mb-1">Status</label>
                                    <select
                                        value={selectedStatus}
                                        onChange={handleStatusChange}
                                        disabled={updateTicketMutation.isPending}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    >
                                        <option value="NEW">New</option>
                                        <option value="IN_PROGRESS">In Progress</option>
                                        <option value="PENDING_CUSTOMER">Pending Customer</option>
                                        <option value="RESOLVED">Resolved</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-gray-600 mb-1">Priority</label>
                                    <select
                                        value={ticket.priority || ''}
                                        onChange={(e) => updateTicketMutation.mutate({ priority: e.target.value })}
                                        disabled={updateTicketMutation.isPending}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    >
                                        <option value="">Sin prioridad</option>
                                        {priorities.map((p) => (
                                            <option key={p.name} value={p.name}>
                                                {p.name} — {p.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-gray-600 mb-1">Type</label>
                                    <select
                                        value={ticket.ticket_type_id || ''}
                                        onChange={handleTypeChange}
                                        disabled={updateTicketMutation.isPending}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    >
                                        <option value="">Select a type...</option>
                                        {ticketTypes?.filter(t => t.is_active || t.id === ticket.ticket_type_id).map((type) => (
                                            <option key={type.id} value={type.id}>
                                                {type.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-gray-600 mb-1">Queue</label>
                                    <div className="font-medium text-gray-900">{ticket.queue?.name || 'Unassigned'}</div>
                                </div>

                                <div>
                                    <label className="block text-gray-600 mb-1">Category (3-Level)</label>
                                    <select
                                        value={ticket.category_id || ''}
                                        onChange={handleCategoryChange}
                                        disabled={updateTicketMutation.isPending}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    >
                                        <option value="">Uncategorized</option>
                                        {flatCategories?.map(cat => (
                                            <option key={cat.id} value={cat.id}>
                                                {'\u00A0'.repeat(cat.depth * 4)}{cat.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-gray-600 mb-1">Assigned To</label>
                                    <select
                                        value={ticket.user_id || ''}
                                        onChange={handleAssignmentChange}
                                        disabled={updateTicketMutation.isPending}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    >
                                        <option value="">Unassigned</option>
                                        {agents?.map((agent) => (
                                            <option key={agent.id} value={agent.id}>
                                                {agent.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-gray-600 mb-1">Jira Issue</label>
                                    <input
                                        type="text"
                                        placeholder="https://jira.example.com/browse/TKT-123"
                                        value={jiraValue}
                                        onChange={(e) => setJiraValue(e.target.value)}
                                        onBlur={() => {
                                            if (jiraValue !== (ticket.jira_issue_link || '')) {
                                                updateTicketMutation.mutate({ jira_issue_link: jiraValue });
                                            }
                                        }}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                                    />
                                    {ticket.jira_issue_link && (
                                        <a
                                            href={ticket.jira_issue_link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-primary-600 hover:text-primary-800 mt-1 inline-block"
                                        >
                                            Open in Jira ↗
                                        </a>
                                    )}
                                </div>

                                <div className="pt-4 border-t border-gray-100">
                                    <button
                                        onClick={handleDelete}
                                        disabled={deleteTicketMutation.isPending}
                                        className="w-full px-4 py-2 text-sm font-semibold text-red-600 hover:text-white border border-red-600 hover:bg-red-600 rounded-lg transition disabled:opacity-50"
                                    >
                                        {deleteTicketMutation.isPending ? 'Deleting...' : 'Delete Ticket'}
                                    </button>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </main>

            {/* Time Entry Modal */}
            {isTimeEntryModalOpen && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                            <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={() => { setIsTimeEntryModalOpen(false); resetTimeEntryForm(); }}></div>
                        </div>
                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                            <form onSubmit={handleTimeEntrySubmit}>
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
                                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                                        {editingTimeEntry ? 'Editar acción' : 'Registrar acción'}
                                    </h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de asistencia <span className="text-red-500">*</span></label>
                                            <select
                                                required
                                                value={timeEntryForm.assistance_type}
                                                onChange={(e) => setTimeEntryForm({ ...timeEntryForm, assistance_type: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                                            >
                                                <option value="remote">Remoto</option>
                                                <option value="onsite">Presencial</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción de la acción <span className="text-red-500">*</span></label>
                                            <textarea
                                                required
                                                rows={3}
                                                value={timeEntryForm.description}
                                                onChange={(e) => setTimeEntryForm({ ...timeEntryForm, description: e.target.value })}
                                                placeholder="Describe la acción realizada..."
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha <span className="text-red-500">*</span></label>
                                            <input
                                                type="date"
                                                required
                                                value={timeEntryForm.date}
                                                onChange={(e) => setTimeEntryForm({ ...timeEntryForm, date: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Duración <span className="text-red-500">*</span></label>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    placeholder="0"
                                                    value={timeEntryForm.hours}
                                                    onChange={(e) => setTimeEntryForm({ ...timeEntryForm, hours: e.target.value })}
                                                    className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-sm text-center"
                                                />
                                                <span className="text-sm text-gray-500">h</span>
                                                <select
                                                    value={timeEntryForm.minutes}
                                                    onChange={(e) => setTimeEntryForm({ ...timeEntryForm, minutes: e.target.value })}
                                                    className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-sm"
                                                >
                                                    {[0, 15, 30, 45].map(m => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}
                                                </select>
                                                <span className="text-sm text-gray-500">min</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-gray-50 px-4 py-3 sm:px-6 space-y-2">
                                    {timeEntryError && (
                                        <p className="text-sm text-red-600 text-center">{timeEntryError}</p>
                                    )}
                                    <div className="sm:flex sm:flex-row-reverse">
                                        <button
                                            type="submit"
                                            disabled={createTimeEntryMutation.isPending || updateTimeEntryMutation.isPending}
                                            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                                        >
                                            {editingTimeEntry ? 'Guardar cambios' : 'Registrar'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setIsTimeEntryModalOpen(false); resetTimeEntryForm(); }}
                                            className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Delegate/Child Ticket Modal */}
            {isDelegateModalOpen && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                            <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={() => setIsDelegateModalOpen(false)}></div>
                        </div>

                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                            <form onSubmit={handleDelegateSubmit}>
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-1">
                                        Delegar ticket
                                    </h3>
                                    <p className="text-sm text-gray-500 mb-4">Reasigna este ticket a otro agente. Se registrará una nota interna con el historial de asignación.</p>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Asignar a <span className="text-red-500">*</span></label>
                                            <select
                                                required
                                                value={delegateForm.user_id}
                                                onChange={(e) => setDelegateForm({ ...delegateForm, user_id: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                                            >
                                                <option value="">Seleccionar agente...</option>
                                                {agents?.map(agent => (
                                                    <option key={agent.id} value={agent.id}>
                                                        {agent.name}{agent.level ? ` (L${agent.level})` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad <span className="text-red-500">*</span></label>
                                            <select
                                                value={delegateForm.priority}
                                                onChange={(e) => setDelegateForm({ ...delegateForm, priority: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                                            >
                                                {priorities.map(p => (
                                                    <option key={p.name} value={p.name}>{p.name} — {p.label}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Comentario <span className="text-gray-400 font-normal">(visible en la conversación)</span></label>
                                            <textarea
                                                rows={3}
                                                value={delegateForm.comment}
                                                onChange={(e) => setDelegateForm({ ...delegateForm, comment: e.target.value })}
                                                placeholder="Instrucciones o contexto opcional para el agente asignado..."
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                    <button
                                        type="submit"
                                        disabled={createChildTicketMutation.isPending}
                                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm"
                                    >
                                        {createChildTicketMutation.isPending ? 'Delegando...' : 'Delegar'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsDelegateModalOpen(false)}
                                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Image lightbox */}
            {lightboxImage && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
                    onClick={() => setLightboxImage(null)}
                >
                    <div className="relative max-w-5xl max-h-[90vh] p-2" onClick={e => e.stopPropagation()}>
                        <img
                            src={lightboxImage.url}
                            alt={lightboxImage.name}
                            className="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain"
                        />
                        <div className="absolute top-4 right-4 flex gap-2">
                            <a
                                href={lightboxImage.url}
                                download={lightboxImage.name}
                                className="flex items-center gap-1 px-3 py-1.5 bg-white/90 text-gray-800 text-sm font-medium rounded-lg hover:bg-white transition"
                                onClick={e => e.stopPropagation()}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Descargar
                            </a>
                            <button
                                onClick={() => setLightboxImage(null)}
                                className="px-3 py-1.5 bg-white/90 text-gray-800 text-sm font-medium rounded-lg hover:bg-white transition"
                            >
                                ✕
                            </button>
                        </div>
                        <p className="text-white/70 text-sm text-center mt-2">{lightboxImage.name}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
