import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import apiClient from '../lib/api';
import FileUpload from './FileUpload';

export default function CreateTicketModal({ isOpen, onClose }) {
    const [contactSearch, setContactSearch] = useState('');
    const [selectedContact, setSelectedContact] = useState(null);
    const [files, setFiles] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [newTicket, setNewTicket] = useState({
        subject: '',
        description: '',
        priority: 'P3',
        type: 'QUESTION',
        category_id: '',
    });

    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const { data: contacts, isLoading: isLoadingContacts } = useQuery({
        queryKey: ['contacts-search', contactSearch],
        queryFn: async () => {
            if (contactSearch.length < 2) return [];
            const response = await apiClient.get(`/contacts?search=${contactSearch}`);
            return response.data;
        },
        enabled: contactSearch.length >= 2,
    });

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

    const createTicketMutation = useMutation({
        mutationFn: async (data) => {
            return await apiClient.post('/tickets', data);
        },
        onSuccess: (response) => {
            queryClient.invalidateQueries(['tickets']);
            queryClient.invalidateQueries(['dashboard-stats']);
            onClose();
            resetForm();
            navigate(`/agent/tickets/${response.data.id}`);
        },
    });

    const resetForm = () => {
        setNewTicket({
            subject: '',
            description: '',
            priority: 'P3',
            type: 'QUESTION',
            category_id: '',
        });
        setSelectedContact(null);
        setContactSearch('');
        setFiles([]);
    };

    const handleCreateTicket = async (e) => {
        e.preventDefault();
        if (!selectedContact) {
            alert('Please select a contact');
            return;
        }

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

            // Create ticket with attachment objects
            createTicketMutation.mutate({
                ...newTicket,
                contact_id: selectedContact.id,
                attachments: uploadedAttachments,
            });
        } catch (error) {
            setIsUploading(false);
            alert('Error uploading files: ' + (error.response?.data?.message || error.message));
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-900">Create New Ticket</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleCreateTicket} className="p-6 space-y-6">
                    {/* Contact Selector */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Customer / Contact</label>
                        {selectedContact ? (
                            <div className="flex items-center justify-between p-3 bg-primary-50 border border-primary-200 rounded-lg text-primary-900">
                                <div>
                                    <div className="font-semibold">{selectedContact.name}</div>
                                    <div className="text-xs text-primary-700">{selectedContact.email}</div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSelectedContact(null)}
                                    className="text-primary-600 hover:text-primary-800 text-sm font-medium"
                                >
                                    Change
                                </button>
                            </div>
                        ) : (
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Search contact by name or email..."
                                    value={contactSearch}
                                    onChange={(e) => setContactSearch(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                />
                                {isLoadingContacts && (
                                    <div className="absolute right-3 top-2.5">
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600"></div>
                                    </div>
                                )}
                                {contacts && contacts.length > 0 && (
                                    <div className="absolute mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                                        {contacts.map((contact) => (
                                            <button
                                                key={contact.id}
                                                type="button"
                                                onClick={() => setSelectedContact(contact)}
                                                className="w-full text-left p-3 hover:bg-gray-50 transition border-b border-gray-50 last:border-0"
                                            >
                                                <div className="font-medium text-gray-900">{contact.name}</div>
                                                <div className="text-xs text-gray-500">{contact.email}</div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {contactSearch.length >= 2 && contacts?.length === 0 && !isLoadingContacts && (
                                    <div className="absolute mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-10 p-4 text-center text-sm text-gray-500">
                                        No existing contacts found. Search again or enter full details below.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                            <select
                                value={newTicket.priority}
                                onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                            >
                                <option value="P1">P1 - Critical</option>
                                <option value="P2">P2 - High</option>
                                <option value="P3">P3 - Medium</option>
                                <option value="P4">P4 - Low</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                            <select
                                value={newTicket.type}
                                onChange={(e) => setNewTicket({ ...newTicket, type: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                            >
                                <option value="QUESTION">Question</option>
                                <option value="INCIDENCE">Incidence</option>
                                <option value="BUG">Bug</option>
                                <option value="BILLING">Billing</option>
                                <option value="FEATURE_REQUEST">Feature Request</option>
                                <option value="OTHER">Other</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Category (3-Level)</label>
                        <select
                            value={newTicket.category_id}
                            onChange={(e) => setNewTicket({ ...newTicket, category_id: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        >
                            <option value="">Select a category...</option>
                            {flatCategories?.map(cat => (
                                <option key={cat.id} value={cat.id}>
                                    {'\u00A0'.repeat(cat.depth * 4)}{cat.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                        <input
                            type="text"
                            required
                            value={newTicket.subject}
                            onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                            placeholder="Brief summary of the issue"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                        <textarea
                            required
                            rows={5}
                            value={newTicket.description}
                            onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                            placeholder="Detailed information..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Attachments (Optional)</label>
                        <FileUpload files={files} onFilesChange={setFiles} />
                    </div>

                    <div className="flex justify-end space-x-4 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={createTicketMutation.isPending || isUploading}
                            className="px-6 py-2 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
                        >
                            {isUploading ? 'Uploading files...' : createTicketMutation.isPending ? 'Creating...' : 'Create Ticket'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
