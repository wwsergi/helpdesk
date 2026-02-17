import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import apiClient from '../../lib/api';
import AgentLayout from '../../components/agent/AgentLayout';
import CreateTicketModal from '../../components/CreateTicketModal';


export default function AgentDashboard() {
    const { user } = useAuthStore();
    const [isModalOpen, setIsModalOpen] = useState(false);

    const { data: stats, isLoading } = useQuery({
        queryKey: ['dashboard-stats'],
        queryFn: async () => {
            const response = await apiClient.get('/dashboard/stats');
            return response.data;
        },
    });

    return (
        <AgentLayout>
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Agent Dashboard</h1>
                <p className="text-sm text-gray-600 mt-1">Welcome back, {user?.name}</p>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <div className="text-sm font-medium text-gray-600 mb-1">Open Tickets</div>
                    <div className="text-3xl font-bold text-gray-900">
                        {isLoading ? '...' : stats?.open_tickets ?? 0}
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <div className="text-sm font-medium text-gray-600 mb-1">My Tickets</div>
                    <div className="text-3xl font-bold text-primary-600">
                        {isLoading ? '...' : stats?.my_tickets ?? 0}
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <div className="text-sm font-medium text-gray-600 mb-1">SLA at Risk</div>
                    <div className="text-3xl font-bold text-orange-600">
                        {isLoading ? '...' : stats?.sla_at_risk ?? 0}
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <div className="text-sm font-medium text-gray-600 mb-1">Resolved Today</div>
                    <div className="text-3xl font-bold text-green-600">
                        {isLoading ? '...' : stats?.resolved_today ?? 0}
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    <Link
                        to="/agent/inbox"
                        className="flex items-center p-4 border-2 border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition group"
                    >
                        <div className="flex-1">
                            <div className="font-semibold text-gray-900 group-hover:text-primary-700">Inbox</div>
                            <div className="text-sm text-gray-600">View all tickets</div>
                        </div>
                        <svg className="w-5 h-5 text-gray-400 group-hover:text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </Link>

                    <Link
                        to="/agent/contacts"
                        className="flex items-center p-4 border-2 border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition group"
                    >
                        <div className="flex-1">
                            <div className="font-semibold text-gray-900 group-hover:text-primary-700">Customers</div>
                            <div className="text-sm text-gray-600">Manage contacts</div>
                        </div>
                        <svg className="w-5 h-5 text-gray-400 group-hover:text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                    </Link>

                    <Link
                        to="/agent/agents"
                        className="flex items-center p-4 border-2 border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition group"
                    >
                        <div className="flex-1">
                            <div className="font-semibold text-gray-900 group-hover:text-primary-700">Agents</div>
                            <div className="text-sm text-gray-600">Manage team</div>
                        </div>
                        <svg className="w-5 h-5 text-gray-400 group-hover:text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                    </Link>

                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center p-4 border-2 border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition group"
                    >
                        <div className="flex-1">
                            <div className="font-semibold text-gray-900 group-hover:text-primary-700">Create Ticket</div>
                            <div className="text-sm text-gray-600">New support request</div>
                        </div>
                        <svg className="w-5 h-5 text-gray-400 group-hover:text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                    </button>

                    <Link to="/agent/kb" className="flex items-center p-4 border-2 border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition group">
                        <div className="flex-1">
                            <div className="font-semibold text-gray-900 group-hover:text-primary-700">Troubleshooting</div>
                            <div className="text-sm text-gray-600">Solve common issues</div>
                        </div>
                        <svg className="w-5 h-5 text-gray-400 group-hover:text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                    </Link>

                    <Link to="/agent/categories" className="flex items-center p-4 border-2 border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition group">
                        <div className="flex-1">
                            <div className="font-semibold text-gray-900 group-hover:text-primary-700">Categories</div>
                            <div className="text-sm text-gray-600">Manage 3-level tree</div>
                        </div>
                        <svg className="w-5 h-5 text-gray-400 group-hover:text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 11h.01M7 15h.01M13 7h.01M13 11h.01M13 15h.01M17 7h.01M17 11h.01M17 15h.01" />
                        </svg>
                    </Link>

                    <Link to="/agent/reports" className="flex items-center p-4 border-2 border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition group">
                        <div className="flex-1">
                            <div className="font-semibold text-gray-900 group-hover:text-primary-700">Reports</div>
                            <div className="text-sm text-gray-600">View analytics</div>
                        </div>
                        <svg className="w-5 h-5 text-gray-400 group-hover:text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                    </Link>
                </div>
            </div>
            {/* Create Ticket Modal */}
            <CreateTicketModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            />
        </AgentLayout>
    );
}
