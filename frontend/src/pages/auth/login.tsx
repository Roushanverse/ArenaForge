import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Link, useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const phoneRegex = new RegExp(/^(\+91)?[6-9]\d{9}$/);

const passwordLoginSchema = z.object({
  mobile: z.string().regex(phoneRegex, 'Please enter a valid Indian mobile number'),
  password: z.string().min(1, 'Password is required'),
});

const otpLoginSchema = z.object({
    mobile: z.string().regex(phoneRegex, 'Please enter a valid Indian mobile number'),
});

const otpVerifySchema = z.object({
  token: z.string().min(6, 'OTP must be 6 digits').max(6, 'OTP must be 6 digits'),
});


const LoginPage = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loginStep, setLoginStep] = useState(1); // 1 for form, 2 for OTP verify
  const [mobileForOtp, setMobileForOtp] = useState('');

  const passwordForm = useForm<z.infer<typeof passwordLoginSchema>>({
    resolver: zodResolver(passwordLoginSchema),
  });

  const otpForm = useForm<z.infer<typeof otpLoginSchema>>({
    resolver: zodResolver(otpLoginSchema),
  });

  const otpVerifyForm = useForm<z.infer<typeof otpVerifySchema>>({
    resolver: zodResolver(otpVerifySchema),
  });

  const handlePasswordLogin = async (data: z.infer<typeof passwordLoginSchema>) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        phone: data.mobile.startsWith('+91') ? data.mobile : `+91${data.mobile}`,
        password: data.password,
      });
      if (error) throw error;
      toast({ title: 'Logged In!', description: 'Welcome back.' });
      navigate('/dashboard');
    } catch (error: any) {
      toast({ title: 'Login Failed', description: error.message, variant: 'destructive' });
    }
  };

  const handleOtpRequest = async (data: z.infer<typeof otpLoginSchema>) => {
    try {
        const fullMobile = data.mobile.startsWith('+91') ? data.mobile : `+91${data.mobile}`;
        setMobileForOtp(fullMobile);
        const { error } = await supabase.auth.signInWithOtp({
            phone: fullMobile,
        });
        if (error) throw error;
        toast({ title: 'OTP Sent!', description: 'Please check your mobile for the code.' });
        setLoginStep(2);
    } catch (error: any) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  }

  const handleOtpVerify = async (data: z.infer<typeof otpVerifySchema>) => {
    try {
        const { data: { session }, error } = await supabase.auth.verifyOtp({
            phone: mobileForOtp,
            token: data.token,
            type: 'sms',
        });
        if (error) throw error;
        if (!session) throw new Error('Could not log you in. Please try again.');
        toast({ title: 'Logged In!', description: 'Welcome back.' });
        navigate('/dashboard');
    } catch (error: any) {
         toast({ title: 'Verification Failed', description: error.message, variant: 'destructive' });
    }
  }

  if (loginStep === 2) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Verify OTP</CardTitle>
                <CardDescription>Enter the code sent to {mobileForOtp}</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...otpVerifyForm}>
                    <form onSubmit={otpVerifyForm.handleSubmit(handleOtpVerify)} className="space-y-6">
                        <FormField name="token" control={otpVerifyForm.control} render={({ field }) => (
                            <FormItem><FormLabel>OTP Code</FormLabel><FormControl><Input placeholder="123456" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <Button type="submit" className="w-full" disabled={otpVerifyForm.formState.isSubmitting}>
                            {otpVerifyForm.formState.isSubmitting ? 'Verifying...' : 'Log In'}
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome Back!</CardTitle>
        <CardDescription>Log in to your ArenaForge account.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="password" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="password">Password</TabsTrigger>
                <TabsTrigger value="otp">OTP</TabsTrigger>
            </TabsList>
            <TabsContent value="password">
                <Form {...passwordForm}>
                    <form onSubmit={passwordForm.handleSubmit(handlePasswordLogin)} className="space-y-6 pt-4">
                    <FormField name="mobile" control={passwordForm.control} render={({ field }) => (
                        <FormItem><FormLabel>Mobile Number</FormLabel><FormControl><Input placeholder="+919876543210" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField name="password" control={passwordForm.control} render={({ field }) => (
                        <FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <Button type="submit" className="w-full" disabled={passwordForm.formState.isSubmitting}>
                        {passwordForm.formSate.isSubmitting ? 'Logging In...' : 'Log In'}
                    </Button>
                    </form>
                </Form>
            </TabsContent>
            <TabsContent value="otp">
                 <Form {...otpForm}>
                    <form onSubmit={otpForm.handleSubmit(handleOtpRequest)} className="space-y-6 pt-4">
                    <FormField name="mobile" control={otpForm.control} render={({ field }) => (
                        <FormItem><FormLabel>Mobile Number</FormLabel><FormControl><Input placeholder="+919876543210" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <Button type="submit" className="w-full" disabled={otpForm.formState.isSubmitting}>
                        {otpForm.formState.isSubmitting ? 'Sending OTP...' : 'Send OTP'}
                    </Button>
                    </form>
                </Form>
            </TabsContent>
        </Tabs>

        <p className="text-center text-sm text-gray-400 mt-6">
            Don't have an account?{' '}
            <Link to="/auth/signup" className="font-medium text-primary hover:underline">
                Sign Up
            </Link>
        </p>
      </CardContent>
    </Card>
  );
};

export default LoginPage;