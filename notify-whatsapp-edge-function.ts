// Supabase → Edge Functions → Create a new function → adını "notify-whatsapp" koy
// ve bu kodu yapıştır. Sonra Project Settings → Edge Functions → Secrets kısmına şunları ekle:
//   TWILIO_ACCOUNT_SID
//   TWILIO_AUTH_TOKEN
//   TWILIO_WHATSAPP_FROM   (örn: whatsapp:+14155238886)
//   OWNER_WHATSAPP_NUMBER  (senin numaran, örn: 905XXXXXXXXX — başında + yok)
// Kodun içine ASLA gerçek şifre/anahtar yazma, hepsi Secrets üzerinden okunuyor.
//
// Database → Webhooks kısmında bu fonksiyona bağlı TEK bir webhook oluştururken
// hem INSERT hem UPDATE olaylarını işaretle (ikisi de aynı fonksiyonu tetikleyecek).

function formatPhone(raw) {
  let phone = (raw || "").replace(/\s|\(|\)|-/g, "");
  if (phone.startsWith("0")) phone = "9" + phone;      // 05xx -> 905xx
  if (!phone.startsWith("90")) phone = "90" + phone;    // güvenlik için
  return phone;
}

async function sendWhatsapp(to, body) {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const fromNumber = Deno.env.get("TWILIO_WHATSAPP_FROM");

  const form = new URLSearchParams({
    To: `whatsapp:+${to}`,
    From: fromNumber ?? "",
    Body: body,
  });

  const res = await fetch(
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
  return { ok: res.ok, result: await res.json() };
}

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    // Database Webhook gönderir: { type: 'INSERT'|'UPDATE', table, record, old_record }
    const eventType = payload.type;
    const record = payload.record;
    const oldRecord = payload.old_record;

    // ---- YENİ REZERVASYON: sahibi bilgilendir ----
    if (eventType === "INSERT") {
      const ownerNumber = Deno.env.get("OWNER_WHATSAPP_NUMBER");
      const msg = `🐾 Yeni rezervasyon talebi!\nKod: ${record.code}\nSahip: ${record.owner_name} (${record.owner_phone})\nPet: ${record.pet_name} (${record.pet_type})\nGiriş: ${record.check_in}\nÇıkış: ${record.check_out}\nOda: ${record.room_name}\nTutar: ₺${record.total}\n\nOnaylamak için admin panelini kontrol et.`;
      const result = await sendWhatsapp(ownerNumber, msg);
      return new Response(JSON.stringify(result), { status: result.ok ? 200 : 500 });
    }

    // ---- DURUM DEĞİŞTİ: müşteriyi bilgilendir ----
    if (eventType === "UPDATE") {
      if (!record || record.status === oldRecord?.status) {
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

      const result = await sendWhatsapp(formatPhone(record.owner_phone), statusText);
      return new Response(JSON.stringify(result), { status: result.ok ? 200 : 500 });
    }

    return new Response(JSON.stringify({ skipped: true, reason: "unhandled event" }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});

