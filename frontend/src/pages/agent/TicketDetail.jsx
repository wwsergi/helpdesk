import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../lib/api';
import FileUpload from '../../components/FileUpload';

export default function AgentTicketDetail() {
    const { id } = useParams();
    const { logout, user: currentUser } = useAuthStore();
    const navigate = useNavigate();
    const isL2Agent = currentUser?.level == 2;
    const [replyText, setReplyText] = useState('');
    const [isInternal, setIsInternal] = useState(isL2Agent);
    const [files, setFiles] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState('');
    const [isDelegateModalOpen, setIsDelegateModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('conversation');
    const [delegateForm, setDelegateForm] = useState({
        user_id: '',
        priority: 'P2',
        comment: ''
    });
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
            if (!ticket?.parent_ticket_id && !isL2Agent) setIsInternal(false);
        },
    });

    const updateTicketMutation = useMutation({
        mutationFn: async (data) => {
            return await apiClient.patch(`/tickets/${id}`, data);
        },
        onSuccess: (response) => {
            const updatedTicket = response.data;
            queryClient.setQueryData(['ticket', id], updatedTicket);
            // If the status changed in the backend, update local state
            if (updatedTicket.status) {
                setSelectedStatus(updatedTicket.status);
            }
        },
    });

    const createChildTicketMutation = useMutation({
        mutationFn: async (data) => {
            return await apiClient.post('/tickets', {
                ...data,
                parent_ticket_id: id,
                type: 'OTHER',
                contact_id: ticket.contact_id
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ticket', id] });
            setIsDelegateModalOpen(false);
            setDelegateForm({ user_id: '', priority: 'P2', comment: '' });
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
                                <p className="text-sm text-gray-600">{ticket.subject}</p>
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
                                {!ticket.parent_ticket_id && (
                                    <button
                                        onClick={() => setActiveTab('subtickets')}
                                        className={`${activeTab === 'subtickets'
                                            ? 'border-primary-500 text-primary-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
                                    >
                                        Sub-tickets
                                        {ticket.children?.length > 0 && (
                                            <span className="ml-2 bg-amber-100 text-amber-800 py-0.5 px-2 rounded-full text-xs font-semibold">
                                                {ticket.children.length}
                                            </span>
                                        )}
                                    </button>
                                )}
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
                                                    className={`p-4 rounded-lg ${message.is_internal
                                                        ? 'bg-yellow-50 border border-yellow-200'
                                                        : 'bg-gray-50 border border-gray-200'
                                                        }`}
                                                >
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-semibold text-gray-900">
                                                                {message.user?.name || message.contact?.name || 'Unknown'}
                                                            </span>
                                                            {message.is_internal && (
                                                                <span className="px-2 py-0.5 bg-yellow-200 text-yellow-800 text-xs font-medium rounded">
                                                                    Internal Note
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="text-xs text-gray-500">
                                                            {new Date(message.created_at).toLocaleString()}
                                                        </span>
                                                    </div>
                                                    <p className="text-gray-700">{message.body}</p>

                                                    {/* Attachments */}
                                                    {message.attachments && message.attachments.length > 0 && (
                                                        <div className="mt-3 pt-3 border-t border-gray-200/50">
                                                            <p className="text-xs font-medium text-gray-500 mb-2">Attachments:</p>
                                                            <div className="flex flex-wrap gap-2">
                                                                {message.attachments.map(att => (
                                                                    <a
                                                                        key={att.id}
                                                                        href={att.url}
                                                                        onClick={(e) => {
                                                                            e.preventDefault();
                                                                            apiClient.get(att.url, { responseType: 'blob' })
                                                                                .then(response => {
                                                                                    const url = window.URL.createObjectURL(new Blob([response.data]));
                                                                                    const link = document.createElement('a');
                                                                                    link.href = url;
                                                                                    link.setAttribute('download', att.name);
                                                                                    document.body.appendChild(link);
                                                                                    link.click();
                                                                                    link.remove();
                                                                                })
                                                                                .catch(err => console.error('Download failed', err));
                                                                        }}
                                                                        className="flex items-center px-3 py-1.5 bg-white border border-gray-200 rounded text-sm text-primary-600 hover:text-primary-700 hover:border-primary-300 transition"
                                                                    >
                                                                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                                                        </svg>
                                                                        {att.name} <span className="text-gray-400 ml-1">({(att.size / 1024).toFixed(0)}KB)</span>
                                                                    </a>
                                                                ))}
                                                            </div>
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
                                                placeholder="Type your reply..."
                                                required
                                            />
                                        </div>

                                        <div>
                                            <FileUpload files={files} onFilesChange={setFiles} maxSizeBytes={10 * 1024 * 1024} />
                                        </div>

                                        <div className="flex items-center justify-between">
                                            {(ticket.parent_ticket_id || isL2Agent) ? (
                                                <span className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 px-2 py-1 rounded">
                                                    {ticket.parent_ticket_id
                                                        ? 'All replies in sub-tickets are internal notes'
                                                        : 'L2 agent — all replies are internal notes'}
                                                </span>
                                            ) : (
                                                <label className="flex items-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={isInternal}
                                                        onChange={(e) => setIsInternal(e.target.checked)}
                                                        className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                                                    />
                                                    <span className="ml-2 text-sm text-gray-700">Internal note (not visible to customer)</span>
                                                </label>
                                            )}
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

                        {activeTab === 'subtickets' && (
                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-lg font-semibold text-gray-900">Sub-Tickets <span className="text-gray-400 font-normal text-base">(Delegated work)</span></h2>
                                    <button
                                        onClick={() => setIsDelegateModalOpen(true)}
                                        className="text-sm bg-primary-600 text-white px-3 py-1.5 rounded-lg hover:bg-primary-700 font-medium transition"
                                    >
                                        + Create Sub-Ticket
                                    </button>
                                </div>

                                {ticket.children && ticket.children.length > 0 ? (
                                    <div className="space-y-3">
                                        {ticket.children.map(child => {
                                            const isResolved = child.status === 'RESOLVED';
                                            const statusBorderColor = isResolved ? 'border-l-green-400' : 'border-l-yellow-400';
                                            const statusBadge = isResolved ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800';
                                            return (
                                                <div key={child.id} className={`p-4 bg-gray-50 rounded-lg border border-gray-100 border-l-4 ${statusBorderColor}`}>
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            {child.user?.level && (
                                                                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">
                                                                    L{child.user.level}
                                                                </span>
                                                            )}
                                                            <span className="font-medium text-gray-900">
                                                                {child.user?.name || 'Unassigned'}
                                                            </span>
                                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge}`}>
                                                                {child.status.replace('_', ' ')}
                                                            </span>
                                                            {child.priority && (
                                                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                                                    {child.priority}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="text-xs font-mono text-gray-400">{child.uuid}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                                        <svg className="w-10 h-10 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                        </svg>
                                        <p className="text-gray-500 mb-2 font-medium">No sub-tickets yet</p>
                                        <p className="text-sm text-gray-400 mb-4">Delegate part of this ticket to another agent</p>
                                        <button
                                            onClick={() => setIsDelegateModalOpen(true)}
                                            className="text-primary-600 hover:text-primary-800 text-sm font-medium border border-primary-300 px-4 py-1.5 rounded-lg hover:bg-primary-50 transition"
                                        >
                                            + Create Sub-Ticket
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
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
                                        Delegate / Create Sub-Ticket
                                    </button>
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
                                    <div className="font-medium text-gray-900">{ticket.priority}</div>
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
                                        type="url"
                                        placeholder="https://jira.example.com/browse/TKT-123"
                                        value={ticket.jira_issue_link || ''}
                                        onChange={(e) => updateTicketMutation.mutate({ jira_issue_link: e.target.value })}
                                        disabled={updateTicketMutation.isPending}
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

                        {/* Customer Info */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">Customer</h2>
                            <div className="space-y-2 text-sm">
                                <div>
                                    <div className="font-medium text-gray-900">{ticket.contact?.name || 'Unknown'}</div>
                                    <div className="text-gray-600">{ticket.contact?.email}</div>
                                    {ticket.contact?.phone && <div className="text-gray-600">{ticket.contact.phone}</div>}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

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
                                        Assign Secondary Agent
                                    </h3>
                                    <p className="text-sm text-gray-500 mb-4">Delegate support for this ticket to another agent. A note will be added to the conversation.</p>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Assign To <span className="text-red-500">*</span></label>
                                            <select
                                                required
                                                value={delegateForm.user_id}
                                                onChange={(e) => setDelegateForm({ ...delegateForm, user_id: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                                            >
                                                <option value="">Select Agent...</option>
                                                {agents?.map(agent => (
                                                    <option key={agent.id} value={agent.id}>
                                                        {agent.name}{agent.level ? ` (L${agent.level})` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Priority <span className="text-red-500">*</span></label>
                                            <select
                                                value={delegateForm.priority}
                                                onChange={(e) => setDelegateForm({ ...delegateForm, priority: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                                            >
                                                <option value="P1">P1 - Critical</option>
                                                <option value="P2">P2 - High</option>
                                                <option value="P3">P3 - Normal</option>
                                                <option value="P4">P4 - Low</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Comment <span className="text-gray-400 font-normal">(visible in conversation)</span></label>
                                            <textarea
                                                rows={3}
                                                value={delegateForm.comment}
                                                onChange={(e) => setDelegateForm({ ...delegateForm, comment: e.target.value })}
                                                placeholder="Optional instructions or context for the assigned agent..."
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
                                        {createChildTicketMutation.isPending ? 'Creating...' : 'Create Sub-Ticket'}
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
        </div>
    );
}
