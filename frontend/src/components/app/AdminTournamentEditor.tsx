import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Loader2, Trash } from 'lucide-react';

const prizeSchema = z.object({
    position: z.coerce.number().int().min(1),
    amount: z.coerce.number().min(0),
});

const tournamentSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  mode: z.enum(['BR', 'CS']),
  type: z.string().min(1, 'Type is required (e.g., Solo, Duo)'),
  max_players: z.coerce.number().int().positive(),
  entry_fee: z.coerce.number().min(0),
  start_at: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Invalid date" }),
  rules: z.string().optional(),
  prize_distribution: z.array(prizeSchema).optional(),
  published: z.boolean().default(false),
});

const AdminTournamentEditor = ({ isOpen, setIsOpen, tournament }: { isOpen: boolean, setIsOpen: (open: boolean) => void, tournament: any | null }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof tournamentSchema>>({
    resolver: zodResolver(tournamentSchema),
    defaultValues: {
        published: false,
        prize_distribution: [{ position: 1, amount: 0 }]
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "prize_distribution",
  });

  useEffect(() => {
    if (tournament) {
        form.reset({
            ...tournament,
            start_at: new Date(tournament.start_at).toISOString().substring(0, 16), // Format for datetime-local input
        });
    } else {
        form.reset({
            title: '',
            mode: 'BR',
            type: 'Solo',
            max_players: 100,
            entry_fee: 10,
            start_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().substring(0, 16),
            rules: '',
            prize_distribution: [{ position: 1, amount: 500 }],
            published: false,
        });
    }
  }, [tournament, form]);

  const mutation = useMutation({
    mutationFn: async (data: z.infer<typeof tournamentSchema>) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const adminId = sessionData.session?.user.id;
      if(!adminId) throw new Error("Admin not authenticated");

      const payload = { ...data, start_at: new Date(data.start_at).toISOString() };

      if (tournament) {
        // Update existing tournament
        const { error } = await supabase.from('tournaments').update(payload).eq('tournament_id', tournament.tournament_id);
        if (error) throw error;
      } else {
        // Create new tournament
        const { error } = await supabase.from('tournaments').insert({...payload, created_by: adminId}); // This needs to get the admin's ID from the admins table, not auth.users.id
        if (error) throw error;
      }
    },
    onSuccess: () => {
        toast({ title: `Tournament ${tournament ? 'updated' : 'created'} successfully!` });
        queryClient.invalidateQueries({ queryKey: ['all-tournaments'] });
        setIsOpen(false);
    },
    onError: (error: any) => {
        toast({ title: 'Error saving tournament', description: error.message, variant: 'destructive' });
    }
  });

  const onSubmit = (data: z.infer<typeof tournamentSchema>) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{tournament ? 'Edit Tournament' : 'Create New Tournament'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-h-[80vh] overflow-y-auto p-4">
            <FormField name="title" control={form.control} render={({ field }) => (
              <FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
             <div className="grid grid-cols-2 gap-4">
                <FormField name="mode" control={form.control} render={({ field }) => (
                    <FormItem><FormLabel>Mode</FormLabel><FormControl><Input {...field} placeholder="BR or CS" /></FormControl><FormMessage /></FormItem>
                )} />
                 <FormField name="type" control={form.control} render={({ field }) => (
                    <FormItem><FormLabel>Type</FormLabel><FormControl><Input {...field} placeholder="Solo, Duo, Squad" /></FormControl><FormMessage /></FormItem>
                )} />
            </div>
             <div className="grid grid-cols-2 gap-4">
                <FormField name="max_players" control={form.control} render={({ field }) => (
                    <FormItem><FormLabel>Max Players</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                 <FormField name="entry_fee" control={form.control} render={({ field }) => (
                    <FormItem><FormLabel>Entry Fee (₹)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
            </div>
             <FormField name="start_at" control={form.control} render={({ field }) => (
                <FormItem><FormLabel>Start Time</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField name="rules" control={form.control} render={({ field }) => (
              <FormItem><FormLabel>Rules</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
            )} />

            <div>
                <FormLabel>Prize Distribution</FormLabel>
                <div className="space-y-2 mt-2">
                    {fields.map((field, index) => (
                        <div key={field.id} className="flex items-center space-x-2">
                            <FormField control={form.control} name={`prize_distribution.${index}.position`} render={({ field }) => (
                                <Input type="number" placeholder="Position" {...field} className="w-1/3"/>
                            )}/>
                            <FormField control={form.control} name={`prize_distribution.${index}.amount`} render={({ field }) => (
                                <Input type="number" placeholder="Amount" {...field} className="w-1/3"/>
                            )}/>
                            <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}>
                                <Trash className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                </div>
                 <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => append({ position: fields.length + 1, amount: 0 })}>
                    Add Prize
                </Button>
            </div>

            <FormField control={form.control} name="published" render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    <div className="space-y-1 leading-none">
                        <FormLabel>Publish Tournament</FormLabel>
                        <FormDescription>Once published, players will be able to see and join this tournament.</FormDescription>
                    </div>
                </FormItem>
            )} />

            <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={mutation.isLoading}>
                    {mutation.isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {tournament ? 'Save Changes' : 'Create Tournament'}
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default AdminTournamentEditor;