// Supabase → Edge Functions → Create a new function → adını "notify-whatsapp" koy
// ve bu kodu yapıştır. Sonra Project Settings → Edge Functions → Secrets kısmına şunları ekle:
//   TWILIO_ACCOUNT_SID
//   TWILIO_AUTH_TOKEN
//   TWILIO_WHATSAPP_FROM   (örn: whatsapp:+14155238886)
// Kodun içine ASLA gerçek şifre/anahtar yazma, hepsi Secrets üzerinden okunuyor.

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    // Database Webhook, satır değiştiğinde { type, table, record, old_record } gönderir
    const record = payload.record;
    const oldRecord = payload.old_record;

    if (!record || record.status === oldRecord?.status) {
      // Durum gerçekten değişmediyse mesaj gönderme (ör. başka bir alan güncellendiyse)
      return new Response(JSON.stringify({ skipped: true }), { status: 200 });
    }

    const statusText = {
      onaylandi: `Rezervasyonunuz onaylandı! 🐾 Kod: ${record.code}, Giriş: ${record.check_in}, Çıkış: ${record.check_out}. Sizi ${record.pet_name} ile ağırlamak için sabırsızlanıyoruz.`,
      reddedildi: `Üzgünüz, ${record.code} kodlu rezervasyon talebiniz bu tarihler için onaylanamadı. Detaylar için bizi arayabilirsiniz.`,
      iptal: `${record.code} kodlu rezervasyonunuz iptal edildi. Sorularınız için bize ulaşabilirsiniz.`,
    }[record.status];

    if (!statusText || !record.owner_phone) {
      return new Response(JSON.stringify({ skipped: true, reason: "no message or phone" }), { status: 200 });
    }

    // Türkiye telefon formatını (05xx...) WhatsApp'ın beklediği uluslararası formata çevir
    let phone = record.owner_phone.replace(/\s|\(|\)|-/g, "");
    if (phone.startsWith("0")) phone = "9" + phone;      // 05xx -> 905xx
    if (!phone.startsWith("90")) phone = "90" + phone;    // güvenlik için

    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const fromNumber = Deno.env.get("TWILIO_WHATSAPP_FROM");

    const form = new URLSearchParams({
      To: `whatsapp:+${phone}`,
      From: fromNumber ?? "",
      Body: statusText,
    });

    const twilioRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + btoa(`${accountSid}:${authToken}`),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form,
      }
    );

    const result = await twilioRes.json();
    return new Response(JSON.stringify({ sent: twilioRes.ok, result }), {
      status: twilioRes.ok ? 200 : 500,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
