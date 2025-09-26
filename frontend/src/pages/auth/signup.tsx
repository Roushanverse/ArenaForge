import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link, useNavigate } from 'react-router-dom';

const phoneRegex = new RegExp(/^(\+91)?[6-9]\d{9}$/);

const signUpSchema = z.object({
  ff_uid: z.string().min(8, 'Free Fire UID must be at least 8 digits').max(16, 'Free Fire UID is too long'),
  name: z.string().min(2, 'Name is too short'),
  mobile: z.string().regex(phoneRegex, 'Please enter a valid Indian mobile number'),
  role: z.enum(['rusher', 'sniper', 'igl', 'grenader']),
  ff_level: z.coerce.number().min(1, 'Level must be at least 1').max(100, 'Level seems too high'),
  years_experience: z.coerce.number().min(0, 'Experience cannot be negative'),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
});

const otpSchema = z.object({
  token: z.string().min(6, 'OTP must be 6 digits').max(6, 'OTP must be 6 digits'),
});

const SignUpPage = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<z.infer<typeof signUpSchema> | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const form = useForm<z.infer<typeof signUpSchema>>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      role: 'rusher',
      ff_level: 1,
      years_experience: 0,
    },
  });

  const otpForm = useForm<z.infer<typeof otpSchema>>({
    resolver: zodResolver(otpSchema),
  });

  const handleSignUp = async (data: z.infer<typeof signUpSchema>) => {
    try {
      setFormData(data);
      const { error } = await supabase.auth.signInWithOtp({
        phone: data.mobile.startsWith('+91') ? data.mobile : `+91${data.mobile}`,
      });
      if (error) throw error;
      toast({ title: 'OTP Sent!', description: 'Please check your mobile for the verification code.' });
      setStep(2);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleVerifyOtp = async (data: z.infer<typeof otpSchema>) => {
    if (!formData) return;
    try {
      const { data: { session }, error: verifyError } = await supabase.auth.verifyOtp({
        phone: formData.mobile.startsWith('+91') ? formData.mobile : `+91${formData.mobile}`,
        token: data.token,
        type: 'sms',
      });

      if (verifyError) throw verifyError;
      if (!session || !session.user) throw new Error('Could not verify OTP. Please try again.');

      // OTP is verified, now create the player profile
      const { error: playerError } = await supabase.from('players').insert({
        ff_uid: formData.ff_uid,
        auth_id: session.user.id,
        name: formData.name,
        mobile: session.user.phone,
        role: formData.role,
        ff_level: formData.ff_level,
        years_experience: formData.years_experience,
      });

      if (playerError) throw playerError;

      // Optionally update password if provided
      if (formData.password) {
        await supabase.auth.updateUser({ password: formData.password });
      }

      toast({ title: 'Success!', description: 'Your account has been created.' });
      navigate('/dashboard');
    } catch (error: any) {
      toast({ title: 'Verification Failed', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{step === 1 ? 'Create Your ArenaForge Account' : 'Verify Your Mobile'}</CardTitle>
      </CardHeader>
      <CardContent>
        {step === 1 ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSignUp)} className="space-y-4">
              <FormField name="ff_uid" control={form.control} render={({ field }) => (
                <FormItem><FormLabel>Free Fire UID</FormLabel><FormControl><Input placeholder="1234567890" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField name="name" control={form.control} render={({ field }) => (
                <FormItem><FormLabel>Your Name</FormLabel><FormControl><Input placeholder="John Doe" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField name="mobile" control={form.control} render={({ field }) => (
                <FormItem><FormLabel>Mobile Number</FormLabel><FormControl><Input placeholder="+919876543210" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField name="role" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>Primary Role</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="rusher">Rusher</SelectItem>
                      <SelectItem value="sniper">Sniper</SelectItem>
                      <SelectItem value="igl">IGL (In-Game Leader)</SelectItem>
                      <SelectItem value="grenader">Grenader</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
               <FormField name="ff_level" control={form.control} render={({ field }) => (
                <FormItem><FormLabel>Free Fire Level</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
               <FormField name="years_experience" control={form.control} render={({ field }) => (
                <FormItem><FormLabel>Years of Experience</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField name="password" control={form.control} render={({ field }) => (
                <FormItem><FormLabel>Password (Optional)</FormLabel><FormControl><Input type="password" placeholder="Leave blank for OTP-only login" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Sending OTP...' : 'Sign Up'}
              </Button>
            </form>
          </Form>
        ) : (
          <Form {...otpForm}>
            <form onSubmit={otpForm.handleSubmit(handleVerifyOtp)} className="space-y-4">
              <FormField name="token" control={otpForm.control} render={({ field }) => (
                <FormItem><FormLabel>Enter OTP</FormLabel><FormControl><Input placeholder="123456" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={otpForm.formState.isSubmitting}>
                {otpForm.formState.isSubmitting ? 'Verifying...' : 'Verify & Create Account'}
              </Button>
            </form>
          </Form>
        )}
        <p className="text-center text-sm text-gray-400 mt-4">
            Already have an account?{' '}
            <Link to="/auth/login" className="font-medium text-primary hover:underline">
                Log In
            </Link>
        </p>
      </CardContent>
    </Card>
  );
};

export default SignUpPage;