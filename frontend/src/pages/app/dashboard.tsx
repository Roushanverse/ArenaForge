import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2 } from 'lucide-react';

// Placeholder for TournamentCard, which we will create later
const TournamentCard = ({ tournament }: { tournament: any }) => (
    <Card className="mb-4">
        <CardHeader>
            <CardTitle>{tournament.title}</CardTitle>
        </CardHeader>
        <CardContent>
            <p>Starts at: {new Date(tournament.start_at).toLocaleString()}</p>
            <p>Entry Fee: ₹{tournament.entry_fee}</p>
        </CardContent>
    </Card>
);

const DashboardPage = () => {
    const { user } = useAuth();

    const fetchDashboardData = async () => {
        if (!user) return null;

        // A helper function to get player's ff_uid from auth_id
        const { data: player, error: playerError } = await supabase
            .from('players')
            .select('ff_uid')
            .eq('auth_id', user.id)
            .single();

        if (playerError || !player) throw new Error('Player profile not found.');
        const playerFfUid = player.ff_uid;

        // Fetch joined tournament IDs
        const { data: entries, error: entriesError } = await supabase
            .from('tournament_entries')
            .select('tournament_id, payment_status')
            .eq('player_ff_uid', playerFfUid);

        if (entriesError) throw entriesError;

        const joinedTournamentIds = entries
            .filter(e => e.payment_status === 'paid')
            .map(e => e.tournament_id);

        // Fetch details of joined tournaments
        const { data: joinedTournaments, error: joinedError } = await supabase
            .from('tournaments')
            .select('*')
            .in('tournament_id', joinedTournamentIds)
            .order('start_at', { ascending: true });

        if (joinedError) throw joinedError;

        const upcoming = joinedTournaments.filter(t => new Date(t.start_at) > new Date());
        const past = joinedTournaments.filter(t => new Date(t.start_at) <= new Date());

        // Fetch winnings
        const { data: winnings, error: winningsError } = await supabase
            .from('winnings')
            .select('*, tournaments(title)')
            .eq('player_ff_uid', playerFfUid)
            .order('created_at', { ascending: false });

        if (winningsError) throw winningsError;

        return { upcoming, past, winnings, playerFfUid };
    };

    const { data, isLoading, error } = useQuery({
        queryKey: ['dashboard', user?.id],
        queryFn: fetchDashboardData,
        enabled: !!user,
    });

    if (isLoading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (error) {
        return (
             <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error.message}</AlertDescription>
            </Alert>
        );
    }

    return (
        <div>
            <h1 className="text-3xl font-bold mb-2">Welcome, {user?.user_metadata.name || data?.playerFfUid || 'Player'}!</h1>
            <p className="text-muted-foreground mb-8">Here's a summary of your activity.</p>

            <Tabs defaultValue="upcoming" className="w-full">
                <TabsList>
                    <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
                    <TabsTrigger value="past">Past Matches</TabsTrigger>
                    <TabsTrigger value="wins">Winnings</TabsTrigger>
                    <TabsTrigger value="profile">Profile</TabsTrigger>
                </TabsList>
                <TabsContent value="upcoming" className="pt-4">
                    {data?.upcoming?.length ? data.upcoming.map(t => <TournamentCard key={t.tournament_id} tournament={t} />) : <p>You haven't joined any upcoming tournaments yet.</p>}
                </TabsContent>
                <TabsContent value="past" className="pt-4">
                    {data?.past?.length ? data.past.map(t => <TournamentCard key={t.tournament_id} tournament={t} />) : <p>No past tournaments.</p>}
                </TabsContent>
                <TabsContent value="wins" className="pt-4">
                    {data?.winnings?.length ? (
                        <Card>
                            <CardContent className="pt-6">
                                {data.winnings.map(w => (
                                    <div key={w.win_id} className="flex justify-between items-center p-2 border-b">
                                        <div>
                                            <p className="font-semibold">{w.tournaments.title}</p>
                                            <p className="text-sm text-muted-foreground">Position: {w.position || 'N/A'}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-lg text-green-400">₹{w.amount}</p>
                                            <p className={`text-sm font-medium ${w.payout_status === 'paid' ? 'text-green-500' : 'text-yellow-500'}`}>{w.payout_status}</p>
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    ) : <p>No winnings recorded yet. Keep playing!</p>}
                </TabsContent>
                 <TabsContent value="profile" className="pt-4">
                    <p>Profile management section coming soon.</p>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default DashboardPage;