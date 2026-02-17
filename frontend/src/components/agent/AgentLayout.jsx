import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export default function AgentLayout({ children }) {
    const { user, logout } = useAuthStore();
    const location = useLocation();

    const isActive = (path) => location.pathname === path;
    const linkClass = (path) => `text-sm font-medium transition ${isActive(path) ? 'text-primary-600' : 'text-gray-700 hover:text-primary-600'}`;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-4">
                            {/* Intratime Logo & Branding */}
                            <div className="flex items-center gap-3">
                                <img
                                    src="https://it.winworldev.es/wp-content/uploads/2019/02/intratime_logo.png"
                                    alt="Intratime Logo"
                                    className="h-10 w-auto" // Adjust height as needed
                                    onError={(e) => {
                                        e.target.onerror = null;
                                        e.target.style.display = 'none'; // Fallback if image fails
                                        e.target.nextSibling.style.display = 'block'; // Show text fallback
                                    }}
                                />
                                <span className="text-xl font-bold text-gray-900 hidden" style={{ display: 'none' }}>Intratime</span> {/* Fallback text */}
                                <div className="hidden md:block h-6 w-px bg-gray-300 mx-2"></div>
                                <span className="text-sm text-gray-500 font-medium hidden md:inline-block">Customer support tool</span>
                            </div>
                        </div>

                        <div className="flex items-center space-x-6">
                            <nav className="hidden md:flex items-center space-x-6">
                                <Link to="/agent" className={linkClass('/agent')}>Dashboard</Link>
                                <Link to="/agent/inbox" className={linkClass('/agent/inbox')}>Inbox</Link>
                                <Link to="/agent/contacts" className={linkClass('/agent/contacts')}>Customers</Link>
                                {user?.role === 'admin' && (
                                    <Link to="/agent/agents" className={linkClass('/agent/agents')}>Agents</Link>
                                )}
                                {user?.role === 'admin' && (
                                    <Link to="/agent/reports" className={linkClass('/agent/reports')}>Reports</Link>
                                )}
                                <Link to="/agent/categories" className={linkClass('/agent/categories')}>Categories</Link>
                                <Link to="/agent/kb" className={linkClass('/agent/kb')}>Troubleshooting</Link>
                            </nav>

                            <div className="flex items-center gap-3 pl-6 border-l border-gray-200">
                                <div className="text-right hidden sm:block">
                                    <div className="text-sm font-medium text-gray-900">{user?.name}</div>
                                    <div className="text-xs text-gray-500 capitalize">{user?.role}</div>
                                </div>
                                <button
                                    onClick={logout}
                                    className="p-2 text-gray-400 hover:text-red-600 rounded-full hover:bg-gray-100 transition"
                                    title="Logout"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {children}
            </main>
        </div>
    );
}
