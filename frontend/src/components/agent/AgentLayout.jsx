import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useState, useRef, useEffect } from 'react';
// Cache bust: 2026-02-27

export default function AgentLayout({ children }) {
    const { user, logout } = useAuthStore();
    const location = useLocation();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const settingsRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (settingsRef.current && !settingsRef.current.contains(event.target)) {
                setIsSettingsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

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
                                <Link to="/agent/kb" className={linkClass('/agent/kb')}>Troubleshooting</Link>
                                {user?.role === 'admin' && (
                                    <Link to="/agent/reports" className={linkClass('/agent/reports')}>Reports</Link>
                                )}

                                {/* Settings Dropdown */}
                                <div className="relative" ref={settingsRef}>
                                    <button
                                        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                                        className={`flex items-center text-sm font-medium transition hover:text-primary-600 focus:outline-none ${isSettingsOpen ? 'text-primary-600' : 'text-gray-700'}`}
                                    >
                                        Settings
                                        <svg className={`ml-1 w-4 h-4 transition-transform ${isSettingsOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>

                                    {isSettingsOpen && (
                                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 ring-1 ring-black ring-opacity-5">
                                            <Link onClick={() => setIsSettingsOpen(false)} to="/agent/contacts" className={`block px-4 py-2 text-sm ${isActive('/agent/contacts') ? 'bg-gray-100 text-primary-600' : 'text-gray-700 hover:bg-gray-100'}`}>Customers</Link>
                                            <Link onClick={() => setIsSettingsOpen(false)} to="/agent/categories" className={`block px-4 py-2 text-sm ${isActive('/agent/categories') ? 'bg-gray-100 text-primary-600' : 'text-gray-700 hover:bg-gray-100'}`}>Categories</Link>
                                            <Link onClick={() => setIsSettingsOpen(false)} to="/agent/ticket-types" className={`block px-4 py-2 text-sm ${isActive('/agent/ticket-types') ? 'bg-gray-100 text-primary-600' : 'text-gray-700 hover:bg-gray-100'}`}>Type Ticket</Link>
                                            {user?.role === 'admin' && (
                                                <Link onClick={() => setIsSettingsOpen(false)} to="/agent/agents" className={`block px-4 py-2 text-sm ${isActive('/agent/agents') ? 'bg-gray-100 text-primary-600' : 'text-gray-700 hover:bg-gray-100'}`}>Agents</Link>
                                            )}
                                        </div>
                                    )}
                                </div>
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
