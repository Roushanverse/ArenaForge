import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Send } from 'lucide-react';
import { format } from 'date-fns';

const fetchMessages = async (roomId: string) => {
    const { data, error } = await supabase
        .from('messages')
        .select(`
            *,
            players ( name, ff_uid )
        `)
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
};

const ChatRoom = ({ tournamentId }: { tournamentId: string }) => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef<null | HTMLDivElement>(null);

    // First, find the chat room ID for this tournament
    const { data: chatRoom, isLoading: roomLoading } = useQuery({
        queryKey: ['chatRoom', tournamentId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('chat_rooms')
                .select('room_id')
                .eq('tournament_id', tournamentId)
                .single();
            if (error) throw new Error("Chat room not found for this tournament.");
            return data;
        },
    });

    const roomId = chatRoom?.room_id;

    const { data: messages, isLoading: messagesLoading } = useQuery({
        queryKey: ['messages', roomId],
        queryFn: () => fetchMessages(roomId!),
        enabled: !!roomId,
    });

    const sendMessageMutation = useMutation({
        mutationFn: async (messageText: string) => {
            if (!roomId || !user) return;

             const { data: player } = await supabase
                .from('players')
                .select('ff_uid')
                .eq('auth_id', user.id)
                .single();

            if (!player) throw new Error("Player not found");

            const { error } = await supabase.from('messages').insert({
                room_id: roomId,
                sender_ff_uid: player.ff_uid,
                message_text: messageText,
            });
            if (error) throw error;
        },
        onSuccess: () => {
            setNewMessage('');
            // No need to invalidate, realtime will update
        },
        onError: (err: any) => {
            console.error("Send message error:", err);
        }
    });

    useEffect(() => {
        if (!roomId) return;

        const channel = supabase
            .channel(`room:${roomId}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
            (payload) => {
                // Manually refetch or update the cache
                queryClient.invalidateQueries({ queryKey: ['messages', roomId] });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [roomId, queryClient]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);


    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (newMessage.trim()) {
            sendMessageMutation.mutate(newMessage.trim());
        }
    };

    if (roomLoading || messagesLoading) {
        return <div className="flex justify-center items-center h-40"><Loader2 className="animate-spin" /></div>;
    }

    if (!roomId) {
        return <p>Chat is not available for this tournament.</p>;
    }

    return (
        <div className="border rounded-lg p-4 h-[500px] flex flex-col">
            <h3 className="text-lg font-semibold mb-4 border-b pb-2">Tournament Chat</h3>
            <div className="flex-grow overflow-y-auto pr-2">
                {messages?.map(msg => (
                    <div key={msg.message_id} className={`flex mb-3 ${msg.players.ff_uid === user?.id ? 'justify-end' : 'justify-start'}`}>
                        <div className={`p-3 rounded-lg max-w-xs ${msg.players.ff_uid === user?.id ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
                            <p className="font-bold text-sm">{msg.players.name}</p>
                            <p className="text-md">{msg.message_text}</p>
                            <p className="text-xs text-right text-muted-foreground mt-1">{format(new Date(msg.created_at), 'p')}</p>
                        </div>
                    </div>
                ))}
                 <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSendMessage} className="mt-4 flex space-x-2">
                <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your message..."
                    disabled={sendMessageMutation.isLoading}
                />
                <Button type="submit" disabled={sendMessageMutation.isLoading}>
                    <Send className="w-4 h-4"/>
                </Button>
            </form>
        </div>
    );
};

export default ChatRoom;