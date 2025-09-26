import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Users, Calendar, Tag, Swords } from 'lucide-react';
import { useEffect, useState } from 'react';

const calculateTimeLeft = (startDate: string) => {
    const difference = +new Date(startDate) - +new Date();
    let timeLeft = {};

    if (difference > 0) {
        timeLeft = {
            days: Math.floor(difference / (1000 * 60 * 60 * 24)),
            hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
            minutes: Math.floor((difference / 1000 / 60) % 60),
            seconds: Math.floor((difference / 1000) % 60),
        };
    }

    return timeLeft;
};


const TournamentCard = ({ tournament }: { tournament: any }) => {
    const [timeLeft, setTimeLeft] = useState(calculateTimeLeft(tournament.start_at));

    useEffect(() => {
        const timer = setTimeout(() => {
            setTimeLeft(calculateTimeLeft(tournament.start_at));
        }, 1000);

        return () => clearTimeout(timer);
    });

    const timerComponents = Object.entries(timeLeft).map(([interval, value]) => {
        if (value > 0) {
             return (
                <span key={interval} className="text-xs font-semibold">
                    {value} {interval}{" "}
                </span>
            );
        }
        return null;
    });

    return (
        <Card className="flex flex-col">
            <CardHeader className="p-0">
                <img src={tournament.thumbnail_path || 'https://via.placeholder.com/400x200'} alt={tournament.title} className="rounded-t-lg object-cover w-full h-40" />
                <div className="p-4">
                    <CardTitle className="text-lg">{tournament.title}</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="flex-grow grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center"><Users className="w-4 h-4 mr-2 text-muted-foreground" /> <span>{tournament.max_players} Players</span></div>
                <div className="flex items-center"><Tag className="w-4 h-4 mr-2 text-muted-foreground" /> <span>₹{tournament.entry_fee}</span></div>
                <div className="flex items-center"><Swords className="w-4 h-4 mr-2 text-muted-foreground" /> <span>{tournament.mode} / {tournament.type}</span></div>
                <div className="flex items-center"><Calendar className="w-4 h-4 mr-2 text-muted-foreground" /> <span>{new Date(tournament.start_at).toLocaleDateString()}</span></div>
            </CardContent>
            <CardFooter className="flex flex-col items-start">
                 <div className="w-full text-center mb-4 p-2 bg-secondary rounded-md">
                    <p className="text-xs text-muted-foreground">Starts In</p>
                    <p className="font-bold text-lg">
                        {timerComponents.length ? timerComponents : <span className="text-red-500">Started</span>}
                    </p>
                </div>
                <Link to={`/tournaments/${tournament.tournament_id}`} className="w-full">
                    <Button className="w-full">View Details</Button>
                </Link>
            </CardFooter>
        </Card>
    );
};

export default TournamentCard;