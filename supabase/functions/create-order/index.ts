import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Razorpay from "https://esm.sh/razorpay@2.8.6";

const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");

if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
  throw new Error("Razorpay credentials are not set in environment variables.");
}

const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET,
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } });
  }

  try {
    const { tournament_id, player_ff_uid } = await req.json();

    if (!tournament_id || !player_ff_uid) {
      return new Response(JSON.stringify({ error: "tournament_id and player_ff_uid are required." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    // 1. Validate tournament exists and is not full
    const { data: tournament, error: tournamentError } = await supabase
      .from("tournaments")
      .select("entry_fee, max_players, start_at, published")
      .eq("tournament_id", tournament_id)
      .single();

    if (tournamentError || !tournament) {
      return new Response(JSON.stringify({ error: "Tournament not found." }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!tournament.published) {
        return new Response(JSON.stringify({ error: "This tournament is not published yet." }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
        });
    }

    if (new Date(tournament.start_at) < new Date()) {
        return new Response(JSON.stringify({ error: "This tournament has already started." }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
        });
    }

    const { count: entryCount, error: countError } = await supabase
      .from("tournament_entries")
      .select("*", { count: "exact", head: true })
      .eq("tournament_id", tournament_id)
      .eq("payment_status", "paid");

    if (countError) throw countError;

    if (entryCount >= tournament.max_players) {
      return new Response(JSON.stringify({ error: "Tournament is full." }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Check if player is already registered
    const { data: existingEntry, error: existingEntryError } = await supabase
        .from('tournament_entries')
        .select('entry_id')
        .eq('tournament_id', tournament_id)
        .eq('player_ff_uid', player_ff_uid)
        .maybeSingle();

    if (existingEntryError) throw existingEntryError;

    if(existingEntry) {
         return new Response(JSON.stringify({ error: "Player already registered for this tournament." }), {
            status: 409,
            headers: { "Content-Type": "application/json" },
        });
    }


    // 2. Create Razorpay Order
    const options = {
      amount: tournament.entry_fee * 100, // amount in paise
      currency: "INR",
      receipt: `receipt_${tournament_id}_${player_ff_uid}_${Date.now()}`,
      notes: {
        tournament_id,
        player_ff_uid,
      },
    };

    const order = await razorpay.orders.create(options);

    // 3. Insert a pending entry into tournament_entries
    const { data: newEntry, error: insertError } = await supabase
      .from("tournament_entries")
      .insert({
        tournament_id,
        player_ff_uid,
        payment_status: "pending",
        payment_tx_ref: order.id, // Store Razorpay order ID
      })
      .select()
      .single();

    if (insertError) {
      // Handle potential race condition if a user tries to join twice quickly
      if (insertError.code === '23505') { // unique_violation
           return new Response(JSON.stringify({ error: "Player already registered for this tournament." }), {
            status: 409,
            headers: { "Content-Type": "application/json" },
        });
      }
      throw insertError;
    }

    return new Response(JSON.stringify({ order, entry: newEntry }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" },
    });
  } catch (error) {
    console.error("Error creating order:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" },
    });
  }
});