const sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
const msg = document.getElementById("adminMsg");
const requests = document.getElementById("requests");

function say(t, good=false){ msg.textContent=t; msg.className="message "+(good?"good":""); }

async function loadRequests(){
  const { data: { user } } = await sb.auth.getUser();
  if(!user){ say("Please log in with the admin account."); return; }

  const { data, error } = await sb.from("access_requests")
    .select("*").order("created_at", {ascending:false});
  if(error){ say(error.message); return; }

  requests.innerHTML = "";
  if(!data.length){ requests.innerHTML = "<p>No requests yet.</p>"; return; }

  data.forEach(r => {
    const row = document.createElement("div");
    row.className = "request-row";
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(r.full_name || "Visitor")}</strong>
        <div>${escapeHtml(r.email || "")}</div>
        <small>${escapeHtml(r.reason || "No reason provided")}</small>
        <div class="status ${r.status}">${r.status.toUpperCase()}</div>
      </div>
      <div class="actions">
        <button class="btn primary" data-id="${r.id}" data-status="approved">✅ Accept</button>
        <button class="btn danger" data-id="${r.id}" data-status="rejected">❌ Reject</button>
      </div>`;
    requests.appendChild(row);
  });

  requests.querySelectorAll("button").forEach(btn => btn.addEventListener("click", () => updateStatus(btn.dataset.id, btn.dataset.status)));
}

async function updateStatus(id, status){
  const { error } = await sb.from("access_requests").update({status, reviewed_at:new Date().toISOString()}).eq("id", id);
  if(error) return say(error.message);
  say(`Request ${status}.`, true);
  loadRequests();
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

document.getElementById("adminLogin").addEventListener("click", async ()=>{
  const email = prompt("Admin email:");
  const password = prompt("Admin password:");
  if(!email || !password) return;
  const {error} = await sb.auth.signInWithPassword({email,password});
  if(error) return say(error.message);
  loadRequests();
});
document.getElementById("adminLogout").addEventListener("click", async ()=>{
  await sb.auth.signOut(); say("Logged out.");
  requests.innerHTML="";
});
loadRequests();