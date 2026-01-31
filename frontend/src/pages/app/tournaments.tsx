import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import TournamentCard from '@/components/app/TournamentCard';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const fetchTournaments = async () => {
    const { data, error } = await supabase
        .from('tournaments')
        .select(`
            *,
            tournament_entries(count)
        `)
        .eq('published', true)
        .gte('start_at', new Date().toISOString()) // Only show upcoming tournaments
        .order('start_at', { ascending: true });

    if (error) {
        throw new Error(error.message);
    }
    return data;
};

const TournamentsPage = () => {
    const { data: tournaments, isLoading, error } = useQuery({
        queryKey: ['tournaments'],
        queryFn: fetchTournaments,
    });

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-4xl font-bold tracking-tight">Open Tournaments</h1>
                <p className="text-lg text-muted-foreground">Find your next challenge. Join a tournament and fight for glory.</p>
            </div>

            {/* TODO: Add filtering options here */}
            {/* <div className="flex space-x-4 mb-8">
                ...filters...
            </div> */}

            {isLoading && (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                </div>
            )}

            {error && (
                <Alert variant="destructive">
                    <AlertTitle>Error Loading Tournaments</AlertTitle>
                    <AlertDescription>{error.message}</AlertDescription>
                </Alert>
            )}

            {tournaments && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {tournaments.map((tournament) => (
                        <TournamentCard key={tournament.tournament_id} tournament={tournament} />
                    ))}
                </div>
            )}

            {tournaments?.length === 0 && !isLoading && (
                 <div className="text-center py-16">
                    <h2 className="text-2xl font-semibold">No Tournaments Found</h2>
                    <p className="text-muted-foreground mt-2">Check back later for new tournaments!</p>
                </div>
            )}
        </div>
    );
};

export default TournamentsPage;