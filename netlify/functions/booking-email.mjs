export default {
  async formSubmitted(event) {
    const data = event.data;

    if (data["form-name"] !== "booking") {
      return;
    }

    const name = data["Full name"];
    const email = data["Email"];
    const pickupDate = data["Pick-up date"];
    const returnDate = data["Return date"];
    const category = data["Car category"];

    if (!email) {
      console.error("No email found in booking submission.");
      return;
    }

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "api-key": process.env.BREVO_API_KEY
      },
      body: JSON.stringify({
        sender: {
          name: "Meltemi Rentals",
          email: process.env.BREVO_SENDER_EMAIL
        },
        to: [
          {
            email: email,
            name: name
          }
        ],
        subject: "We received your booking request",
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
            <h2>Thanks for contacting Meltemi Rentals!</h2>

            <p>Hi ${name || "there"},</p>

            <p>
              We've received your booking request and we'll get back to you
              shortly to confirm availability.
            </p>

            <h3>Your request</h3>

            <p>
              <strong>Pick-up:</strong> ${pickupDate || "-"}<br>
              <strong>Return:</strong> ${returnDate || "-"}<br>
              <strong>Car:</strong> ${category || "-"}
            </p>

            <p>No payment is required until your booking is confirmed.</p>

            <p>
              See you in Kos!<br>
              <strong>Meltemi Rentals</strong>
            </p>
          </div>
        `
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Brevo error:", error);
      throw new Error("Brevo email failed");
    }

    console.log("Confirmation email sent to:", email);
  }
};