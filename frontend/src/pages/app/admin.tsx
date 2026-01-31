import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Navigate } from 'react-router-dom';
import { Loader2, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import AdminTournamentEditor from '@/components/app/AdminTournamentEditor';
import { useState } from 'react';

const fetchAllTournaments = async () => {
    const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
};

const AdminPage = () => {
    const { isAdmin, loading } = useAuth();
    const [isEditorOpen, setEditorOpen] = useState(false);
    const [selectedTournament, setSelectedTournament] = useState<any | null>(null);

    const { data: tournaments, isLoading, error } = useQuery({
        queryKey: ['all-tournaments'],
        queryFn: fetchAllTournaments,
        enabled: isAdmin,
    });

    if (loading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (!isAdmin) {
        return <Navigate to="/dashboard" replace />;
    }

    const handleEdit = (tournament: any) => {
        setSelectedTournament(tournament);
        setEditorOpen(true);
    }

    const handleCreateNew = () => {
        setSelectedTournament(null);
        setEditorOpen(true);
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold">Admin Panel</h1>
                    <p className="text-muted-foreground">Manage all tournaments.</p>
                </div>
                <Button onClick={handleCreateNew}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create New Tournament
                </Button>
            </div>

            {isLoading && <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>}
            {error && <p className="text-red-500">{error.message}</p>}

            <Card>
                <CardHeader>
                    <CardTitle>All Tournaments</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {tournaments?.map(t => (
                            <div key={t.tournament_id} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                                <div>
                                    <h3 className="font-semibold">{t.title}</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Starts: {new Date(t.start_at).toLocaleString()} | Fee: ₹{t.entry_fee}
                                    </p>
                                </div>
                                <div className="flex items-center space-x-4">
                                     <Badge variant={t.published ? 'default' : 'outline'}>
                                        {t.published ? 'Published' : 'Draft'}
                                    </Badge>
                                    <Button variant="outline" size="sm" onClick={() => handleEdit(t)}>
                                        Edit
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <AdminTournamentEditor
                isOpen={isEditorOpen}
                setIsOpen={setEditorOpen}
                tournament={selectedTournament}
            />

        </div>
    );
};

export default AdminPage;