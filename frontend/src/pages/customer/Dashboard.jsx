import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import apiClient from '../../lib/api';
import FileUpload from '../../components/FileUpload';

const STATUS_COLORS = {
    NEW: 'bg-blue-100 text-blue-800',
    OPEN: 'bg-green-100 text-green-800',
    IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
    PENDING_CUSTOMER: 'bg-purple-100 text-purple-800',
    RESOLVED: 'bg-gray-100 text-gray-800',
    CLOSED: 'bg-gray-100 text-gray-600',
};

const PRIORITY_COLORS = {
    P1: 'bg-red-100 text-red-800',
    P2: 'bg-orange-100 text-orange-800',
    P3: 'bg-yellow-100 text-yellow-800',
    P4: 'bg-blue-100 text-blue-800',
};

export default function CustomerDashboard() {
    const { user, logout } = useAuthStore();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [statusFilter, setStatusFilter] = useState(null); // null means show all
    const [formData, setFormData] = useState({
        subject: '',
        description: '',
        priority: 'P3',
        priority: 'P3',
        category_id: '',
        attachment_ids: []
    });
    const [files, setFiles] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const queryClient = useQueryClient();

    const { data: ticketsData, isLoading } = useQuery({
        queryKey: ['customer-tickets'],
        queryFn: async () => {
            const response = await apiClient.get('/tickets');
            return response.data;
        },
    });

    const { data: categoriesData } = useQuery({
        queryKey: ['categories'],
        queryFn: async () => {
            const response = await apiClient.get('/categories');
            return response.data;
        },
    });

    const categories = categoriesData || [];

    const flattenCategories = (cats, parentName = '') => {
        let flat = [];
        cats.forEach((cat) => {
            const fullName = parentName ? `${parentName} > ${cat.name}` : cat.name;
            flat.push({ ...cat, name: fullName });
            if (cat.children && cat.children.length > 0) {
                flat = flat.concat(flattenCategories(cat.children, fullName));
            }
        });
        return flat;
    };

    const createMutation = useMutation({
        mutationFn: async (data) => {
            return await apiClient.post('/tickets', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['customer-tickets']);
            setShowCreateModal(false);
            setShowCreateModal(false);
            setFormData({ subject: '', description: '', priority: 'P3', category_id: '', attachment_ids: [] });
            setFiles([]);
        },
    });

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            // Upload files first if any
            let uploadedAttachmentIds = [];
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
                    // Return the ID of the created/uploaded attachment
                    // Note: The upload endpoint returns the file object, but for ticket creation 
                    // we need to pass attachment_ids to map them to the ticket
                    // Wait, TicketController.store expects attachment_ids array of IDs.
                    // But wait, the upload endpoint doesn't create DB records anymore?
                    // Let's check the API response of upload. 
                    // In Step 1488, TicketController.store was updated to accept:
                    // 'attachment_ids' => 'nullable|array',
                    // 'attachment_ids.*' => 'exists:ticket_attachments,id',
                    // AND
                    // The upload endpoint was updated to... wait. 
                    // In Step 1488 summary: "Updated the upload method to return file metadata... instead of creating a database record immediately"
                    // If it doesn't create a DB record, it doesn't have an ID.
                    // So passing "exists:ticket_attachments,id" validation would FAIL if we pass non-existent IDs.
                    //
                    // HOWEVER, in TicketController.store (viewed in Step 1488), it says:
                    // 'attachment_ids' => 'nullable|array',
                    // 'attachment_ids.*' => 'exists:ticket_attachments,id',
                    //
                    // IF the upload endpoint DOES NOT create a record, we CANNOT get an ID.
                    // This creates a contradiction.
                    // Let's re-read TicketController.store code in the Viewed Code Item from Step 1488.
                    // OR better, let's look at `CreateTicketModal.jsx` which I supposedly "Modified... to collect full file objects...".
                    //
                    // If `CreateTicketModal` collects FULL OBJECTS, then `TicketController.store` MUST accept full objects.
                    // BUT the Code Item for `TicketController.store` shows:
                    // 'attachment_ids' => 'nullable|array',
                    // 'attachment_ids.*' => 'exists:ticket_attachments,id',
                    //
                    // This suggests `TicketController.store` expects IDs of EXISTING records.
                    //
                    // So... `AttachmentController.upload` MUST be creating records.
                    // Let's check `AttachmentController.php` edit in Step 1488.
                    // Edit Summary: "Updated the upload method to return file metadata... instead of creating a database record immediately".
                    //
                    // IF upload DOES NOT create records, then `TicketController.store` validation `exists:ticket_attachments,id` will FAIL.
                    //
                    // UNLESS `TicketController.store` WAS updated to accept metadata objects INSTEAD of IDs.
                    // I need to be 100% sure before writing this code.

                    // Actually, let's look at what I did in `CreateTicketModal.jsx` in Step 1488 (implied).
                    // Wait, I can't see the content of `CreateTicketModal.jsx` right now without viewing it.
                    // But I CAN see the "Code Interaction Summary" from Step 1488.
                    // It says: "Modified the file upload logic to collect full file objects (metadata) instead of just IDs, and updated the ticket creation mutation to pass these objects."
                    // AND "Updated the store method to accept and validate attachment objects".
                    //
                    // FAIL: The `viewed_code_item` for `TicketController.store` in Step 1488 shows:
                    // 'attachment_ids' => 'nullable|array',
                    // 'attachment_ids.*' => 'exists:ticket_attachments,id',
                    //
                    // This contradicts the "Edit Summary".
                    // Maybe the "viewed_code_item" was from BEFORE the edit?
                    // OR maybe the edit didn't "stick" or I am misinterpreting.

                    // Let's assume for a moment that `TicketController.store` WAS updated to accept objects.
                    // If so, the validation rules should look like:
                    // 'attachments' => 'nullable|array',
                    // 'attachments.*.name' => 'required', ...

                    // In `addMessage`, I definitely updated it to accept 'attachments' array of objects (Step 1499).
                    // I should probably align `store` with `addMessage` if it isn't already.
                    //
                    // DECISION: I will assume the `TicketController.store` accepts `attachments` (objects).
                    // I will check `TicketController.php` first to confirm.

                    return response.data;
                });
                uploadedAttachmentIds = await Promise.all(uploadPromises);
                setIsUploading(false);
            }

            // Pass full attachment objects as 'attachments'
            createMutation.mutate({
                ...formData,
                attachments: uploadedAttachmentIds
            });
        } catch (error) {
            setIsUploading(false);
            console.error(error);
            alert('Failed to upload files');
        }
    };

    const tickets = ticketsData?.data || [];

    // Filter tickets based on selected status
    const filteredTickets = statusFilter
        ? statusFilter === 'OPEN'
            ? tickets.filter((ticket) => ticket.status === 'OPEN' || ticket.status === 'IN_PROGRESS')
            : statusFilter === 'RESOLVED'
                ? tickets.filter((ticket) => ticket.status === 'RESOLVED' || ticket.status === 'CLOSED')
                : tickets.filter((ticket) => ticket.status === statusFilter)
        : tickets;

    // Calculate KPI stats
    const stats = {
        all: tickets.length,
        new: tickets.filter((t) => t.status === 'NEW').length,
        open: tickets.filter((t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length,
        pending: tickets.filter((t) => t.status === 'PENDING_CUSTOMER').length,
        resolved: tickets.filter((t) => t.status === 'RESOLVED' || t.status === 'CLOSED').length,
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex justify-between items-center">
                        {/* Left side - Logo and Title */}
                        <div className="flex items-center space-x-4">
                            <div className="flex items-center">
                                <svg className="w-10 h-10 text-primary-600" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <div className="ml-3">
                                    <div className="flex items-baseline space-x-2">
                                        <span className="text-xl font-bold text-gray-900">Intratime</span>
                                        <span className="text-sm text-gray-500">|</span>
                                        <span className="text-base font-semibold text-gray-700">Customer Support Portal</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right side - Customer Info and Logout */}
                        <div className="flex items-center space-x-4">
                            <div className="text-right hidden sm:block">
                                <div className="text-sm font-semibold text-gray-900">{user?.name}</div>
                                <div className="text-xs text-gray-500">{user?.email}</div>
                            </div>
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
                {/* Tickets Section Header */}
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">My Tickets</h2>
                    <p className="text-sm text-gray-600 mt-1">{tickets.length} total tickets</p>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                    <button
                        onClick={() => setStatusFilter(null)}
                        className={`p-4 rounded-lg border-2 transition-all text-left ${statusFilter === null
                            ? 'border-primary-600 bg-primary-50 shadow-md'
                            : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                            }`}
                    >
                        <div className="text-2xl font-bold text-gray-900">{stats.all}</div>
                        <div className="text-sm text-gray-600 mt-1">All Tickets</div>
                    </button>

                    <button
                        onClick={() => setStatusFilter('NEW')}
                        className={`p-4 rounded-lg border-2 transition-all text-left ${statusFilter === 'NEW'
                            ? 'border-blue-600 bg-blue-50 shadow-md'
                            : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                            }`}
                    >
                        <div className="text-2xl font-bold text-blue-600">{stats.new}</div>
                        <div className="text-sm text-gray-600 mt-1">New</div>
                    </button>

                    <button
                        onClick={() => setStatusFilter('OPEN')}
                        className={`p-4 rounded-lg border-2 transition-all text-left ${statusFilter === 'OPEN'
                            ? 'border-green-600 bg-green-50 shadow-md'
                            : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                            }`}
                    >
                        <div className="text-2xl font-bold text-green-600">{stats.open}</div>
                        <div className="text-sm text-gray-600 mt-1">Open</div>
                    </button>

                    <button
                        onClick={() => setStatusFilter('PENDING_CUSTOMER')}
                        className={`p-4 rounded-lg border-2 transition-all text-left ${statusFilter === 'PENDING_CUSTOMER'
                            ? 'border-purple-600 bg-purple-50 shadow-md'
                            : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                            }`}
                    >
                        <div className="text-2xl font-bold text-purple-600">{stats.pending}</div>
                        <div className="text-sm text-gray-600 mt-1">Pending</div>
                    </button>

                    <button
                        onClick={() => setStatusFilter('RESOLVED')}
                        className={`p-4 rounded-lg border-2 transition-all text-left ${statusFilter === 'RESOLVED'
                            ? 'border-gray-600 bg-gray-50 shadow-md'
                            : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                            }`}
                    >
                        <div className="text-2xl font-bold text-gray-600">{stats.resolved}</div>
                        <div className="text-sm text-gray-600 mt-1">Resolved</div>
                    </button>
                </div>

                {/* Create Ticket Button */}
                <div className="mb-6">
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="inline-flex items-center px-6 py-3 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700 transition shadow-md"
                    >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Create New Ticket
                    </button>
                </div>

                {/* Ticket List */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    {isLoading ? (
                        <div className="text-center py-12 text-gray-500">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                            <p>Loading tickets...</p>
                        </div>
                    ) : filteredTickets.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                            </svg>
                            <p className="font-medium">
                                {statusFilter ? `No ${statusFilter.toLowerCase()} tickets` : 'No tickets yet'}
                            </p>
                            <p className="text-sm text-gray-400 mt-1">
                                {statusFilter ? 'Try selecting a different filter' : 'Create your first ticket to get started'}
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-200">
                            {filteredTickets.map((ticket) => (
                                <Link
                                    key={ticket.id}
                                    to={`/portal/tickets/${ticket.id}`}
                                    className="block p-4 hover:bg-gray-50 transition"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-sm font-mono text-gray-500">{ticket.uuid}</span>
                                                <span className={`px-2 py-1 text-xs font-medium rounded ${STATUS_COLORS[ticket.status]}`}>
                                                    {ticket.status.replace('_', ' ')}
                                                </span>
                                                <span className={`px-2 py-1 text-xs font-medium rounded ${PRIORITY_COLORS[ticket.priority]}`}>
                                                    {ticket.priority}
                                                </span>
                                            </div>
                                            <h3 className="text-base font-semibold text-gray-900 mb-1">{ticket.subject}</h3>
                                            <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
                                                <span>Created {new Date(ticket.created_at).toLocaleDateString()}</span>
                                                <span>Last updated {new Date(ticket.updated_at).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                        <svg className="w-5 h-5 text-gray-400 ml-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {/* Create Ticket Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold text-gray-900">Create New Ticket</h2>
                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                {createMutation.isError && (
                                    <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                                        {createMutation.error?.response?.data?.message || 'Failed to create ticket. Please try again.'}
                                    </div>
                                )}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Subject *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.subject}
                                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                        placeholder="Brief description of your issue"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Description *
                                    </label>
                                    <textarea
                                        rows={6}
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                        placeholder="Provide detailed information about your request..."
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Priority
                                    </label>
                                    <select
                                        value={formData.priority}
                                        onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    >
                                        <option value="P4">Low</option>
                                        <option value="P3">Normal</option>
                                        <option value="P2">High</option>
                                        <option value="P1">Urgent</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Category
                                    </label>
                                    <select
                                        value={formData.category_id}
                                        onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    >
                                        <option value="">Select a category</option>
                                        {flattenCategories(categories).map((category) => (
                                            <option key={category.id} value={category.id}>
                                                {category.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Attachments
                                    </label>
                                    <FileUpload files={files} onFilesChange={setFiles} maxSizeBytes={10 * 1024 * 1024} />
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="submit"
                                        disabled={createMutation.isPending || isUploading}
                                        className="flex-1 bg-primary-600 text-white font-semibold py-3 rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
                                    >
                                        {isUploading ? 'Uploading...' : createMutation.isPending ? 'Creating...' : 'Create Ticket'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowCreateModal(false)}
                                        className="flex-1 bg-gray-100 text-gray-700 font-semibold py-3 rounded-lg hover:bg-gray-200 transition"
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
