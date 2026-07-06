      const $ = (s) => document.querySelector(s);
      const token = new URLSearchParams(location.search).get("token");
      if (!token) { $("#hint").textContent = "This reset link is missing its token."; $("#form").style.display = "none"; }
      $("#form").addEventListener("submit", async (e) => {
        e.preventDefault();
        $("#msg").textContent = "";
        const password = $("#pw").value;
        const r = await fetch("/api/auth/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) { $("#msg").textContent = data.error || "Could not reset password."; return; }
        $("#form").style.display = "none";
        $("#hint").innerHTML = '<span class="ok">✓ Password updated.</span> You can now <a href="/app">sign in</a>.';
      });

