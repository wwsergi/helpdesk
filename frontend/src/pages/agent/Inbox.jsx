import { useEffect, useState } from 'react';
import AgentLayout from '../../components/agent/AgentLayout';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../lib/api';
import CreateTicketModal from '../../components/CreateTicketModal';

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

export default function AgentInbox() {
    const { user, logout } = useAuthStore();
    const [filter, setFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);

    // New filter states
    const [statusFilter, setStatusFilter] = useState('all');
    const [assignedFilter, setAssignedFilter] = useState('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const queryClient = useQueryClient();
    const navigate = useNavigate();

    // Fetch agents list for assigned filter
    const { data: agents } = useQuery({
        queryKey: ['agents'],
        queryFn: async () => {
            const response = await apiClient.get('/agents');
            return response.data;
        },
    });

    const { data: ticketsData, isLoading } = useQuery({
        queryKey: ['tickets', filter, searchQuery, statusFilter, assignedFilter, dateFrom, dateTo],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (filter === 'my-tickets') params.append('assigned_to_me', 'true');
            if (filter === 'unassigned') params.append('unassigned', 'true');
            if (searchQuery) params.append('search', searchQuery);

            // New filters
            if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);
            if (assignedFilter && assignedFilter !== 'all') params.append('assigned_to', assignedFilter);
            if (dateFrom) params.append('date_from', dateFrom);
            if (dateTo) params.append('date_to', dateTo);

            const response = await apiClient.get(`/tickets?${params.toString()}`);
            return response.data;
        },
    });


    const tickets = ticketsData?.data || [];

    return (
        <AgentLayout>
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Inbox</h1>
                    <p className="text-sm text-gray-600">{tickets.length} tickets</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="px-4 py-2 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700 transition"
                >
                    Create Ticket
                </button>
            </div>

            {/* Filters & Search */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    {/* Filter Tabs */}
                    <div className="flex space-x-2">
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-4 py-2 rounded-lg font-medium transition ${filter === 'all'
                                ? 'bg-primary-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            All
                        </button>
                        <button
                            onClick={() => setFilter('my-tickets')}
                            className={`px-4 py-2 rounded-lg font-medium transition ${filter === 'my-tickets'
                                ? 'bg-primary-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            My Tickets
                        </button>
                        <button
                            onClick={() => setFilter('unassigned')}
                            className={`px-4 py-2 rounded-lg font-medium transition ${filter === 'unassigned'
                                ? 'bg-primary-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            Unassigned
                        </button>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search tickets..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full md:w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                        <svg className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                </div>

                {/* Advanced Filters */}
                <div className="flex flex-col md:flex-row gap-4 mt-4">
                    {/* Status Filter */}
                    <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                        >
                            <option value="all">All Status</option>
                            <option value="NEW">New</option>
                            <option value="OPEN">Open</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="PENDING_CUSTOMER">Pending Customer</option>
                            <option value="RESOLVED">Resolved</option>
                            <option value="CLOSED">Closed</option>
                        </select>
                    </div>

                    {/* Assigned Filter */}
                    <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Assigned To</label>
                        <select
                            value={assignedFilter}
                            onChange={(e) => setAssignedFilter(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                        >
                            <option value="all">All Agents</option>
                            <option value="unassigned">Unassigned</option>
                            {agents?.map((agent) => (
                                <option key={agent.id} value={agent.id}>
                                    {agent.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Date From */}
                    <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-700 mb-1">From Date</label>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                        />
                    </div>

                    {/* Date To */}
                    <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-700 mb-1">To Date</label>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                        />
                    </div>
                </div>
            </div>

            {/* Ticket List */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                {isLoading ? (
                    <div className="text-center py-12 text-gray-500">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                        <p>Loading tickets...</p>
                    </div>
                ) : tickets.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                        <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                        <p className="font-medium">No tickets found</p>
                        <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200">
                        {tickets.map((ticket) => (
                            <Link
                                key={ticket.id}
                                to={`/agent/tickets/${ticket.id}`}
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
                                            {(ticket.sla_first_response_breached || ticket.sla_resolution_breached) && (
                                                <span className="px-2 py-1 text-xs font-medium rounded bg-red-100 text-red-800">
                                                    SLA BREACH
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="text-base font-semibold text-gray-900 mb-1">{ticket.subject}</h3>
                                        <p className="text-sm text-gray-600">
                                            From: <span className="font-medium">{ticket.contact?.name || 'Unknown'}</span>
                                            {ticket.contact?.email && ` (${ticket.contact.email})`}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            Created {new Date(ticket.created_at).toLocaleString()}
                                        </p>
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

            {/* Create Ticket Modal */}
            <CreateTicketModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            />
        </AgentLayout>
    );
}
