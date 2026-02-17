import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import apiClient from '../../lib/api';
import AgentLayout from '../../components/agent/AgentLayout';

const STATUS_COLORS = {
    NEW: 'bg-blue-100 text-blue-800',
    OPEN: 'bg-green-100 text-green-800',
    IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
    PENDING_CUSTOMER: 'bg-purple-100 text-purple-800',
    RESOLVED: 'bg-gray-100 text-gray-800',
    CLOSED: 'bg-gray-100 text-gray-600',
};

export default function Reports() {
    const { user, logout } = useAuthStore();
    const [dateRange, setDateRange] = useState({ from: '', to: '' });
    const [appliedDateRange, setAppliedDateRange] = useState({ from: '', to: '' });
    const [activeTab, setActiveTab] = useState('agents'); // 'agents' or 'customers'

    // Fetch overall stats
    const { data: statsData, isLoading: statsLoading } = useQuery({
        queryKey: ['reports-stats', appliedDateRange],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (appliedDateRange.from) params.append('from', appliedDateRange.from);
            if (appliedDateRange.to) params.append('to', appliedDateRange.to);
            const response = await apiClient.get(`/reports/stats?${params}`);
            return response.data;
        },
    });

    // Fetch agent stats
    const { data: agentData, isLoading: agentLoading } = useQuery({
        queryKey: ['reports-agents', appliedDateRange],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (appliedDateRange.from) params.append('from', appliedDateRange.from);
            if (appliedDateRange.to) params.append('to', appliedDateRange.to);
            const response = await apiClient.get(`/reports/agents?${params}`);
            return response.data;
        },
    });

    // Fetch customer stats
    const { data: customerData, isLoading: customerLoading } = useQuery({
        queryKey: ['reports-customers', appliedDateRange],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (appliedDateRange.from) params.append('from', appliedDateRange.from);
            if (appliedDateRange.to) params.append('to', appliedDateRange.to);
            const response = await apiClient.get(`/reports/customers?${params}`);
            return response.data;
        },
    });

    const overview = statsData?.overview || {};
    const agentStats = agentData?.by_agent || [];
    const customerStats = customerData?.by_customer || [];

    const handleApplyFilter = () => {
        setAppliedDateRange(dateRange);
    };

    const handleResetFilter = () => {
        setDateRange({ from: '', to: '' });
        setAppliedDateRange({ from: '', to: '' });
    };

    const setQuickFilter = (days) => {
        const to = new Date().toISOString().split('T')[0];
        const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        setDateRange({ from, to });
        setAppliedDateRange({ from, to });
    };

    return (
        <AgentLayout>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Page Title */}
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
                    <p className="text-sm text-gray-600 mt-1">View ticket statistics and performance metrics</p>
                </div>

                {/* Date Range Filter */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                    <div className="flex flex-wrap items-end gap-4">
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
                            <input
                                type="date"
                                value={dateRange.from}
                                onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                        </div>
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
                            <input
                                type="date"
                                value={dateRange.to}
                                onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleApplyFilter}
                                className="px-6 py-2 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700 transition"
                            >
                                Apply
                            </button>
                            <button
                                onClick={handleResetFilter}
                                className="px-6 py-2 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition"
                            >
                                Reset
                            </button>
                        </div>
                    </div>

                    {/* Quick Filters */}
                    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-200">
                        <span className="text-sm font-medium text-gray-700 mr-2">Quick Filters:</span>
                        <button
                            onClick={() => setQuickFilter(1)}
                            className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                        >
                            Today
                        </button>
                        <button
                            onClick={() => setQuickFilter(7)}
                            className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                        >
                            Last 7 Days
                        </button>
                        <button
                            onClick={() => setQuickFilter(30)}
                            className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                        >
                            Last 30 Days
                        </button>
                        <button
                            onClick={() => setQuickFilter(90)}
                            className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                        >
                            Last 90 Days
                        </button>
                    </div>
                </div>

                {/* Overview KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <div className="text-sm font-medium text-gray-600 mb-1">Total Tickets</div>
                        <div className="text-3xl font-bold text-gray-900">
                            {statsLoading ? '...' : overview.total_tickets || 0}
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <div className="text-sm font-medium text-gray-600 mb-1">New</div>
                        <div className="text-3xl font-bold text-blue-600">
                            {statsLoading ? '...' : overview.new || 0}
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <div className="text-sm font-medium text-gray-600 mb-1">Open</div>
                        <div className="text-3xl font-bold text-green-600">
                            {statsLoading ? '...' : overview.open || 0}
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <div className="text-sm font-medium text-gray-600 mb-1">In Progress</div>
                        <div className="text-3xl font-bold text-yellow-600">
                            {statsLoading ? '...' : overview.in_progress || 0}
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <div className="text-sm font-medium text-gray-600 mb-1">Pending</div>
                        <div className="text-3xl font-bold text-purple-600">
                            {statsLoading ? '...' : overview.pending_customer || 0}
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <div className="text-sm font-medium text-gray-600 mb-1">Resolved</div>
                        <div className="text-3xl font-bold text-gray-600">
                            {statsLoading ? '...' : overview.resolved || 0}
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <div className="text-sm font-medium text-gray-600 mb-1">Closed</div>
                        <div className="text-3xl font-bold text-gray-500">
                            {statsLoading ? '...' : overview.closed || 0}
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="border-b border-gray-200">
                        <div className="flex">
                            <button
                                onClick={() => setActiveTab('agents')}
                                className={`px-6 py-4 font-semibold transition ${activeTab === 'agents'
                                    ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                    }`}
                            >
                                By Agent
                            </button>
                            <button
                                onClick={() => setActiveTab('customers')}
                                className={`px-6 py-4 font-semibold transition ${activeTab === 'customers'
                                    ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                    }`}
                            >
                                By Customer
                            </button>
                        </div>
                    </div>

                    {/* Tab Content */}
                    <div className="p-6">
                        {activeTab === 'agents' && (
                            <div className="overflow-x-auto">
                                {agentLoading ? (
                                    <div className="text-center py-12">
                                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                                        <p className="text-gray-500">Loading agent statistics...</p>
                                    </div>
                                ) : agentStats.length === 0 ? (
                                    <div className="text-center py-12 text-gray-500">
                                        <p>No agent data available for the selected date range</p>
                                    </div>
                                ) : (
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead>
                                            <tr className="bg-gray-50">
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Agent
                                                </th>
                                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Total
                                                </th>
                                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    New
                                                </th>
                                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Open
                                                </th>
                                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    In Progress
                                                </th>
                                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Pending
                                                </th>
                                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Resolved
                                                </th>
                                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Closed
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {agentStats.map((agent, index) => (
                                                <tr key={agent.agent_id || index} className="hover:bg-gray-50">
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                        {agent.agent_name}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-bold text-gray-900">
                                                        {agent.total}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-blue-600">
                                                        {agent.new}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-green-600">
                                                        {agent.open}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-yellow-600">
                                                        {agent.in_progress}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-purple-600">
                                                        {agent.pending_customer}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-600">
                                                        {agent.resolved}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500">
                                                        {agent.closed}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        )}

                        {activeTab === 'customers' && (
                            <div className="overflow-x-auto">
                                {customerLoading ? (
                                    <div className="text-center py-12">
                                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                                        <p className="text-gray-500">Loading customer statistics...</p>
                                    </div>
                                ) : customerStats.length === 0 ? (
                                    <div className="text-center py-12 text-gray-500">
                                        <p>No customer data available for the selected date range</p>
                                    </div>
                                ) : (
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead>
                                            <tr className="bg-gray-50">
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Customer
                                                </th>
                                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Total
                                                </th>
                                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    New
                                                </th>
                                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Open
                                                </th>
                                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    In Progress
                                                </th>
                                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Pending
                                                </th>
                                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Resolved
                                                </th>
                                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Closed
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {customerStats.map((customer, index) => (
                                                <tr key={customer.customer_id || index} className="hover:bg-gray-50">
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                        {customer.customer_name}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-bold text-gray-900">
                                                        {customer.total}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-blue-600">
                                                        {customer.new}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-green-600">
                                                        {customer.open}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-yellow-600">
                                                        {customer.in_progress}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-purple-600">
                                                        {customer.pending_customer}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-600">
                                                        {customer.resolved}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500">
                                                        {customer.closed}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AgentLayout>
    );
}
