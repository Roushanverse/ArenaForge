import { useAuth } from '@/contexts/AuthContext';
import { Navigate, Outlet } from 'react-router-dom';

const AuthLayout = () => {
    const { session, loading } = useAuth();

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div>Loading...</div>
            </div>
        );
    }

    if (session) {
        return <Navigate to="/dashboard" replace />;
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-900 p-4">
            <div className="w-full max-w-md">
                <Outlet />
            </div>
        </div>
    );
};

export default AuthLayout;