import { Link, useParams } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../lib/api';
import FileUpload from '../../components/FileUpload';

export default function CustomerTicketDetail() {
    const { id } = useParams();
    const { logout } = useAuthStore();
    const [replyText, setReplyText] = useState('');
    const [files, setFiles] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const queryClient = useQueryClient();

    const { data: ticket, isLoading } = useQuery({
        queryKey: ['customer-ticket', id],
        queryFn: async () => {
            const response = await apiClient.get(`/tickets/${id}`);
            return response.data;
        },
    });

    const replyMutation = useMutation({
        mutationFn: async (data) => {
            return await apiClient.post(`/tickets/${id}/messages`, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['customer-ticket', id]);
            setReplyText('');
            setFiles([]);
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
                attachments: uploadedAttachments
            });
        } catch (error) {
            setIsUploading(false);
            alert('Error uploading files: ' + (error.response?.data?.message || error.message));
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
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-4">
                            <Link to="/portal" className="text-gray-600 hover:text-gray-900">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                            </Link>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">{ticket.uuid}</h1>
                                <p className="text-sm text-gray-600">{ticket.subject}</p>
                            </div>
                        </div>
                        <button
                            onClick={logout}
                            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Status Banner */}
                        <div className="bg-gradient-to-r from-primary-500 to-primary-600 rounded-lg p-6 text-white">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-sm font-medium opacity-90">Status</div>
                                    <div className="text-2xl font-bold mt-1">{ticket.status.replace('_', ' ')}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-medium opacity-90">Priority</div>
                                    <div className="text-2xl font-bold mt-1">{ticket.priority}</div>
                                </div>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">Messages</h2>
                            <div className="space-y-4">
                                {ticket.messages && ticket.messages.length > 0 ? (
                                    ticket.messages
                                        .filter(message => !message.is_internal)
                                        .map((message) => (
                                            <div
                                                key={message.id}
                                                className={`p-4 rounded-lg ${message.author_type === 'contact'
                                                    ? 'bg-primary-50 border border-primary-200'
                                                    : 'bg-gray-50 border border-gray-200'
                                                    }`}
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="font-semibold text-gray-900">{message.author?.name || 'You'}</span>
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
                                        ))
                                ) : (
                                    <p className="text-gray-500 text-center py-8">No messages yet</p>
                                )}
                            </div>
                        </div>

                        {/* Reply Form */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Reply</h2>
                            <form onSubmit={handleReply} className="space-y-4">
                                <div>
                                    <textarea
                                        value={replyText}
                                        onChange={(e) => setReplyText(e.target.value)}
                                        rows={5}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                        placeholder="Type your message..."
                                        required
                                    />
                                </div>

                                <div>
                                    <FileUpload files={files} onFilesChange={setFiles} maxSizeBytes={10 * 1024 * 1024} />
                                </div>

                                <div className="flex justify-end">
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
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">Ticket Info</h2>
                            <div className="space-y-3 text-sm">
                                <div>
                                    <div className="text-gray-600 mb-1">Ticket ID</div>
                                    <div className="font-medium text-gray-900 font-mono">{ticket.uuid}</div>
                                </div>
                                <div>
                                    <div className="text-gray-600 mb-1">Created</div>
                                    <div className="font-medium text-gray-900">
                                        {new Date(ticket.created_at).toLocaleString()}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-gray-600 mb-1">Last Updated</div>
                                    <div className="font-medium text-gray-900">
                                        {new Date(ticket.updated_at).toLocaleString()}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Help Card */}
                        <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
                            <h3 className="font-semibold text-blue-900 mb-2">Need Help?</h3>
                            <p className="text-sm text-blue-700">
                                Our support team typically responds within 2-4 hours during business hours (Mon-Fri, 9AM-6PM).
                            </p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
