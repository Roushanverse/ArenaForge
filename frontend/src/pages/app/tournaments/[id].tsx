import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Users, Calendar, Tag, Swords, Shield, Info, Trophy, MessageSquare } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import JoinModal from '@/components/app/JoinModal';
import ChatRoom from '@/components/app/ChatRoom';
import { Badge } from '@/components/ui/badge';

const fetchTournamentDetails = async (id: string, user_id: string | undefined) => {
    const { data: tournament, error } = await supabase
        .from('tournaments')
        .select('*')
        .eq('tournament_id', id)
        .single();

    if (error) throw new Error(error.message);

    const { data: entries, error: entriesError } = await supabase
        .from('tournament_entries')
        .select('*, players(name, ff_uid, profile_photo_path)')
        .eq('tournament_id', id)
        .eq('payment_status', 'paid')
        .order('seat_number', { ascending: true });

    if (entriesError) throw new Error(entriesError.message);

    let playerFfUid = null;
    if (user_id) {
        const { data: player } = await supabase.from('players').select('ff_uid').eq('auth_id', user_id).single();
        if(player) playerFfUid = player.ff_uid;
    }

    const isJoined = entries.some(entry => entry.player_ff_uid === playerFfUid);
    const userEntry = entries.find(entry => entry.player_ff_uid === playerFfUid);

    return { ...tournament, entries, isJoined, userEntry };
};


const TournamentDetailPage = () => {
    const { id } = useParams<{ id: string }>();
    const { user, loading: authLoading } = useAuth();
    const queryClient = useQueryClient();
    const [isJoinModalOpen, setJoinModalOpen] = useState(false);

    const { data: tournament, isLoading, error } = useQuery({
        queryKey: ['tournament', id, user?.id],
        queryFn: () => fetchTournamentDetails(id!, user?.id),
        enabled: !authLoading && !!id,
    });

    // Listen to realtime updates for new entries
    useEffect(() => {
        if (!id) return;
        const channel = supabase
            .channel(`tournament-entries:${id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'tournament_entries',
                filter: `tournament_id=eq.${id}`,
            },
            () => {
                // Invalidate query to refetch data
                queryClient.invalidateQueries({ queryKey: ['tournament', id, user?.id] });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [id, user?.id, queryClient]);


    if (isLoading || authLoading) {
        return <div className="flex justify-center items-center h-96"><Loader2 className="h-16 w-16 animate-spin" /></div>;
    }

    if (error) {
        return <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error.message}</AlertDescription></Alert>;
    }

    if (!tournament) {
        return <Alert><AlertTitle>Not Found</AlertTitle><AlertDescription>This tournament could not be found.</AlertDescription></Alert>;
    }

    const spotsLeft = tournament.max_players - tournament.entries.length;

    return (
        <div className="space-y-8">
            <Card className="overflow-hidden">
                <img src={tournament.thumbnail_path || '/placeholder.jpg'} alt={tournament.title} className="w-full h-64 object-cover"/>
                <CardHeader className="border-b">
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-4xl font-extrabold tracking-tight">{tournament.title}</h1>
                            <p className="text-muted-foreground">{tournament.type} - {tournament.mode}</p>
                        </div>
                         <div className="text-right">
                            {tournament.isJoined ? (
                                <Badge variant="secondary" className="text-green-400 border-green-400">Joined</Badge>
                            ) : (
                                <Badge variant="outline">{spotsLeft > 0 ? `${spotsLeft} spots left` : 'Full'}</Badge>
                            )}
                         </div>
                    </div>
                </CardHeader>
                <CardContent className="p-6 grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="flex items-center"><Calendar className="w-5 h-5 mr-3 text-primary" /> <span>{new Date(tournament.start_at).toLocaleString()}</span></div>
                    <div className="flex items-center"><Tag className="w-5 h-5 mr-3 text-primary" /> <span className="font-bold text-lg">₹{tournament.entry_fee}</span></div>
                    <div className="flex items-center"><Users className="w-5 h-5 mr-3 text-primary" /> <span>{tournament.entries.length} / {tournament.max_players} Joined</span></div>
                    <div className="flex items-center"><Swords className="w-5 h-5 mr-3 text-primary" /> <span>{tournament.mode} / {tournament.type}</span></div>
                </CardContent>
                <CardContent className="p-6">
                    {!tournament.isJoined ? (
                        <Button size="lg" className="w-full text-lg" onClick={() => setJoinModalOpen(true)} disabled={spotsLeft <= 0}>
                            {spotsLeft > 0 ? 'Join Tournament' : 'Tournament Full'}
                        </Button>
                    ) : (
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Card className="bg-secondary">
                                <CardHeader><CardTitle>Your Ticket</CardTitle></CardHeader>
                                <CardContent><p className="font-mono text-xl">{tournament.userEntry?.ticket_id}</p></CardContent>
                            </Card>
                             <Card className="bg-secondary">
                                <CardHeader><CardTitle>Room Credentials</CardTitle></CardHeader>
                                <CardContent><p>Room ID and Password will be revealed here 15 minutes before the match starts.</p></CardContent>
                            </Card>
                         </div>
                    )}
                </CardContent>
            </Card>

            <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <Card>
                        <CardHeader><CardTitle className="flex items-center"><Info className="mr-2"/>Rules & Regulations</CardTitle></CardHeader>
                        <CardContent className="prose dark:prose-invert max-w-none">
                            <p>{tournament.rules || "No special rules provided."}</p>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader><CardTitle className="flex items-center"><Trophy className="mr-2"/>Prize Pool</CardTitle></CardHeader>
                        <CardContent>
                            <ul className="space-y-2">
                                {tournament.prize_distribution?.map((prize: any) => (
                                    <li key={prize.position} className="flex justify-between items-center p-2 bg-secondary rounded-md">
                                        <span className="font-semibold">Position #{prize.position}</span>
                                        <span className="font-bold text-lg text-green-400">₹{prize.amount}</span>
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>
                </div>
                <div className="space-y-8">
                    <Card>
                        <CardHeader><CardTitle className="flex items-center"><Users className="mr-2"/>Joined Players ({tournament.entries.length})</CardTitle></CardHeader>
                        <CardContent>
                            <ul className="space-y-3 max-h-96 overflow-y-auto">
                               {tournament.entries.map((entry: any) => (
                                   <li key={entry.entry_id} className="flex items-center">
                                       <span className="font-mono text-muted-foreground mr-3 w-8">#{entry.seat_number}</span>
                                       <img src={entry.players.profile_photo_path || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${entry.players.ff_uid}`} alt={entry.players.name} className="w-8 h-8 rounded-full mr-3"/>
                                       <span>{entry.players.name}</span>
                                   </li>
                               ))}
                            </ul>
                        </CardContent>
                    </Card>
                    {tournament.isJoined && (
                        <Card>
                             <CardHeader><CardTitle className="flex items-center"><MessageSquare className="mr-2"/>Chat Room</CardTitle></CardHeader>
                             <CardContent>
                                <ChatRoom tournamentId={id!} />
                             </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            <JoinModal tournament={tournament} open={isJoinModalOpen} onOpenChange={setJoinModalOpen} />
        </div>
    );
};

export default TournamentDetailPage;