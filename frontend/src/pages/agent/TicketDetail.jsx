import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../lib/api';
import FileUpload from '../../components/FileUpload';

export default function AgentTicketDetail() {
    const { id } = useParams();
    const { logout } = useAuthStore();
    const [replyText, setReplyText] = useState('');
    const [isInternal, setIsInternal] = useState(false);
    const [files, setFiles] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState('');
    const queryClient = useQueryClient();

    const { data: ticket, isLoading } = useQuery({
        queryKey: ['ticket', id],
        queryFn: async () => {
            const response = await apiClient.get(`/tickets/${id}`);
            setSelectedStatus(response.data.status);
            return response.data;
        },
    });

    const { data: agents } = useQuery({
        queryKey: ['agents'],
        queryFn: async () => {
            const response = await apiClient.get('/agents');
            return response.data;
        },
    });

    const replyMutation = useMutation({
        mutationFn: async (data) => {
            return await apiClient.post(`/tickets/${id}/messages`, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['ticket', id]);
            setReplyText('');
            setFiles([]);
            setIsInternal(false);
        },
    });

    const updateTicketMutation = useMutation({
        mutationFn: async (data) => {
            return await apiClient.patch(`/tickets/${id}`, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['ticket', id]);
        },
    });

    const deleteTicketMutation = useMutation({
        mutationFn: async () => {
            return await apiClient.delete(`/tickets/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['tickets']);
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
        const userId = e.target.value || null;
        updateTicketMutation.mutate({ user_id: userId });
    };

    const handleCategoryChange = (e) => {
        const categoryId = e.target.value || null;
        updateTicketMutation.mutate({ category_id: categoryId });
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
                        {/* Messages Timeline */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">Conversation</h2>
                            <div className="space-y-4">
                                {ticket.messages && ticket.messages.length > 0 ? (
                                    ticket.messages.map((message) => (
                                        <div
                                            key={message.id}
                                            className={`p-4 rounded-lg ${message.is_internal
                                                ? 'bg-yellow-50 border border-yellow-200'
                                                : 'bg-gray-50 border border-gray-200'
                                                }`}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <span className="font-semibold text-gray-900">
                                                        {message.author?.name || 'Unknown'}
                                                    </span>
                                                    {message.is_internal && (
                                                        <span className="ml-2 px-2 py-0.5 bg-yellow-200 text-yellow-800 text-xs font-medium rounded">
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
                                                                    // Use API to download with auth token if needed, or open in new tab
                                                                    // For now, let's open in new tab but we might need a token param or header
                                                                    // Since it's an API route protected by Sanctum, direct link won't work easily in browser without token
                                                                    // Better to trigger a download via fetchBlob
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
                                    ))
                                ) : (
                                    <p className="text-gray-500 text-center py-8">No messages yet</p>
                                )}
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
                                    <label className="flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={isInternal}
                                            onChange={(e) => setIsInternal(e.target.checked)}
                                            className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                                        />
                                        <span className="ml-2 text-sm text-gray-700">Internal note (not visible to customer)</span>
                                    </label>
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
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
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
                                        <option value="OPEN">Open</option>
                                        <option value="IN_PROGRESS">In Progress</option>
                                        <option value="PENDING_CUSTOMER">Pending Customer</option>
                                        <option value="RESOLVED">Resolved</option>
                                        <option value="CLOSED">Closed</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-gray-600 mb-1">Priority</label>
                                    <div className="font-medium text-gray-900">{ticket.priority}</div>
                                </div>

                                <div>
                                    <label className="block text-gray-600 mb-1">Type</label>
                                    <div className="font-medium text-gray-900">{ticket.type || 'N/A'}</div>
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
        </div>
    );
}
