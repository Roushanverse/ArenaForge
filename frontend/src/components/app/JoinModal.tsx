import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";

// This is a placeholder for the Razorpay script loader
const useRazorpay = (scriptSrc = "https://checkout.razorpay.com/v1/checkout.js") => {
    // In a real app, you'd want to load this script dynamically
    // and handle loading/error states.
    return (window as any).Razorpay;
};

const JoinModal = ({ tournament, open, onOpenChange }: { tournament: any, open: boolean, onOpenChange: (open: boolean) => void }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const Razorpay = useRazorpay();

  const createOrderMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("You must be logged in to join.");

      const { data: player, error: playerError } = await supabase
        .from('players')
        .select('ff_uid')
        .eq('auth_id', user.id)
        .single();

      if (playerError || !player) throw new Error("Player profile not found.");

      const token = (await supabase.auth.getSession()).data.session?.access_token;

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-order`, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
              tournament_id: tournament.tournament_id,
              player_ff_uid: player.ff_uid
          })
      });

      const result = await response.json();
      if (!response.ok) {
          throw new Error(result.error || 'Failed to create order.');
      }
      return result;
    },
    onSuccess: (data) => {
        const { order } = data;
        const options = {
            key: import.meta.env.VITE_RAZORPAY_KEY_ID,
            amount: order.amount,
            currency: order.currency,
            name: "ArenaForge",
            description: `Payment for ${tournament.title}`,
            order_id: order.id,
            handler: function (response: any) {
                // The webhook will handle the success case.
                // You can show a pending message here.
                toast({ title: "Payment Submitted", description: "Waiting for server confirmation. Your ticket will appear soon." });
                queryClient.invalidateQueries({ queryKey: ['tournament', tournament.tournament_id] });
                onOpenChange(false);
            },
            prefill: {
                name: user?.user_metadata.name,
                email: user?.email,
                contact: user?.phone,
            },
            notes: {
                address: "ArenaForge Esports"
            },
            theme: {
                color: "#F59E0B" // Amber color
            }
        };
        const rzp = new Razorpay(options);
        rzp.open();
    },
    onError: (error: any) => {
        toast({
            title: "Could not initiate payment",
            description: error.message,
            variant: "destructive"
        });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Join Tournament: {tournament.title}</DialogTitle>
          <DialogDescription>
            Confirm your entry. You will be redirected to Razorpay to complete the payment.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
            <div className="flex justify-between items-center text-lg">
                <span>Entry Fee:</span>
                <span className="font-bold">₹{tournament.entry_fee}</span>
            </div>
             <p className="text-sm text-muted-foreground mt-2">
                By clicking "Pay & Join", you agree to the tournament rules and our terms of service.
             </p>
        </div>
        <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={createOrderMutation.isLoading}>Cancel</Button>
            <Button onClick={() => createOrderMutation.mutate()} disabled={createOrderMutation.isLoading}>
                {createOrderMutation.isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Pay & Join
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default JoinModal;