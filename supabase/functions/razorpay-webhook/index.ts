import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import crypto from "https://deno.land/std@0.168.0/node/crypto.ts";

const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");
const WEBHOOK_SECRET = Deno.env.get("RAZORPAY_WEBHOOK_SECRET"); // This should be configured in your Razorpay dashboard

if (!RAZORPAY_KEY_SECRET || !WEBHOOK_SECRET) {
  throw new Error("Razorpay secrets are not set in environment variables.");
}

// Supabase client for admin actions
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const signature = req.headers.get("x-razorpay-signature");
    const body = await req.text();

    if (!signature) {
      return new Response(JSON.stringify({ error: "Signature missing." }), { status: 400 });
    }

    // 1. Verify the webhook signature
    const expectedSignature = crypto
      .createHmac("sha256", WEBHOOK_SECRET)
      .update(body)
      .digest("hex");

    if (signature !== expectedSignature) {
      return new Response(JSON.stringify({ error: "Invalid signature." }), { status: 401 });
    }

    const payload = JSON.parse(body);
    const event = payload.event;
    const orderId = payload.payload.payment.entity.order_id;
    const paymentId = payload.payload.payment.entity.id;
    const paymentStatus = payload.payload.payment.entity.status; // "captured", "failed", etc.

    if (event !== "payment.captured") {
        // We are only interested in successful payments.
        // You might want to handle 'payment.failed' as well.
        if (event === 'payment.failed') {
            const { error: updateError } = await supabaseAdmin
                .from('tournament_entries')
                .update({ payment_status: 'failed' })
                .eq('payment_tx_ref', orderId);

            if(updateError) console.error(`Failed to mark order ${orderId} as failed:`, updateError);
        }
        return new Response("Webhook received, but event is not 'payment.captured'.", { status: 200 });
    }

    // 2. Payment is captured, now update the database
    const { data: entry, error: entryError } = await supabaseAdmin
      .from("tournament_entries")
      .select("tournament_id, player_ff_uid")
      .eq("payment_tx_ref", orderId)
      .eq("payment_status", "pending")
      .single();

    if (entryError || !entry) {
      console.error("No matching pending entry found for order:", orderId);
      // This could happen if the webhook is received twice.
      // It's safe to ignore, but good to log.
      return new Response("Entry not found or not in pending state.", { status: 404 });
    }

    // 3. Assign a seat number. This should be atomic.
    // We can create a postgres function to make this transaction safe
    const { data: seatData, error: seatError } = await supabaseAdmin.rpc('assign_seat_number', {
        p_tournament_id: entry.tournament_id
    });

    if (seatError || !seatData) {
        console.error("Error assigning seat number:", seatError);
        // If we can't assign a seat, we should probably refund the payment.
        // For now, we'll mark as failed.
         await supabaseAdmin
            .from("tournament_entries")
            .update({ payment_status: "failed", notes: "Seat assignment failed" })
            .eq("payment_tx_ref", orderId);
        return new Response("Failed to assign seat number.", { status: 500 });
    }

    const newSeatNumber = seatData;

    // 4. Update the entry to 'paid'
    const { error: updateError } = await supabaseAdmin
      .from("tournament_entries")
      .update({
        payment_status: "paid",
        ticket_id: `TICKET-${entry.tournament_id.substring(0,4)}-${orderId.substring(orderId.length - 6)}`,
        seat_number: newSeatNumber,
        joined_at: new Date().toISOString(),
        payment_tx_ref: paymentId, // Update with the actual payment ID
      })
      .eq("payment_tx_ref", orderId);

    if (updateError) {
      console.error("Failed to update tournament entry:", updateError);
      // At this point, payment is captured but DB update failed.
      // This requires manual intervention. Log it critically.
      // TODO: Add to a retry queue or alert system.
      return new Response("Failed to update database.", { status: 500 });
    }

    // TODO: Send a notification to the user (e.g., via Supabase Realtime or another push service)

    return new Response(JSON.stringify({ status: "success" }), { status: 200 });

  } catch (error) {
    console.error("Error processing Razorpay webhook:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
});

/*
-- Add this SQL function to your migrations to handle atomic seat assignment.

create or replace function assign_seat_number(p_tournament_id uuid)
returns int
language plpgsql
as $$
declare
  max_seat int;
  next_seat int;
begin
  -- Lock the table to prevent race conditions
  lock table public.tournament_entries in exclusive mode;

  -- Find the highest current seat number for the given tournament
  select coalesce(max(seat_number), 0)
  into max_seat
  from public.tournament_entries
  where tournament_id = p_tournament_id;

  next_seat := max_seat + 1;

  -- Check if the tournament is full
  if next_seat > (select max_players from public.tournaments where tournament_id = p_tournament_id) then
    return null; -- Or raise an exception
  end if;

  return next_seat;
end;
$$;

*/