import { useAuth } from '@/contexts/AuthContext';
import { Navigate, Outlet, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { LayoutDashboard, Swords, User, LogOut, Sun, Moon } from 'lucide-react';

// A simple theme toggle - in a real app, this would be more robust.
const toggleTheme = () => {
    document.documentElement.classList.toggle('dark');
}

const AppLayout = () => {
    const { session, loading, isAdmin } = useAuth();
    const { toast } = useToast();

    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            toast({ title: "Error logging out", description: error.message, variant: "destructive" });
        } else {
            toast({ title: "Logged out" });
            // Navigate is handled by the protected route logic below
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div>Loading...</div>
            </div>
        );
    }

    if (!session) {
        return <Navigate to="/auth/login" replace />;
    }

    return (
        <div className="min-h-screen flex flex-col">
            <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container flex h-14 max-w-screen-2xl items-center justify-between">
                    <Link to="/dashboard" className="flex items-center space-x-2">
                        <Swords className="h-6 w-6" />
                        <span className="font-bold">ArenaForge</span>
                    </Link>
                    <nav className="flex items-center space-x-4">
                        <Link to="/dashboard"><Button variant="ghost" size="sm"><LayoutDashboard className="mr-2 h-4 w-4"/>Dashboard</Button></Link>
                        <Link to="/tournaments"><Button variant="ghost" size="sm"><Swords className="mr-2 h-4 w-4"/>Tournaments</Button></Link>
                        {isAdmin && <Link to="/admin"><Button variant="ghost" size="sm">Admin Panel</Button></Link>}
                        <Button variant="ghost" size="icon" onClick={toggleTheme}>
                            <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                            <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                            <span className="sr-only">Toggle theme</span>
                        </Button>
                        <Button onClick={handleLogout} variant="destructive" size="sm"><LogOut className="mr-2 h-4 w-4"/>Logout</Button>
                    </nav>
                </div>
            </header>
            <main className="flex-1 container max-w-screen-2xl py-8">
                <Outlet />
            </main>
        </div>
    );
};

export default AppLayout;