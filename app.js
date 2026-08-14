const supabaseClient = window.supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_ANON_KEY
);

const $ = (id) => document.getElementById(id);
const accessScreen = $("accessScreen");
const site = $("site");
const message = $("message");

function showMessage(text, good=false) {
  message.textContent = text;
  message.className = "message " + (good ? "good" : "");
}
function showPanel(name) {
  ["authForm","requestArea","statusArea"].forEach(id => $(id).classList.add("hidden"));
  $(name).classList.remove("hidden");
}
function setSiteVisible(visible) {
  accessScreen.classList.toggle("hidden", visible);
  site.classList.toggle("hidden", !visible);
}

async function currentUser() {
  const { data } = await supabaseClient.auth.getUser();
  return data.user;
}

async function checkAccess(user) {
  if (!user) return { status: "logged_out" };
  const { data, error } = await supabaseClient
    .from("access_requests")
    .select("status")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) {
    console.error(error);
    return { status: "error" };
  }
  return { status: data?.status || "none" };
}

async function refreshState() {
  const user = await currentUser();
  if (!user) {
    setSiteVisible(false);
    showPanel("authForm");
    return;
  }

  $("loggedInText").textContent = `Logged in as ${user.email}`;
  const result = await checkAccess(user);

  if (result.status === "approved") {
    setSiteVisible(true);
    buildMedia();
  } else if (result.status === "pending") {
    setSiteVisible(false);
    $("statusIcon").textContent = "⏳";
    $("statusTitle").textContent = "Access Pending";
    $("statusText").textContent = "Your request has been sent. Mudassar must approve it.";
    showPanel("statusArea");
  } else if (result.status === "rejected") {
    setSiteVisible(false);
    $("statusIcon").textContent = "❌";
    $("statusTitle").textContent = "Access Rejected";
    $("statusText").textContent = "Your access request was rejected. You can log out and try again later.";
    showPanel("statusArea");
  } else {
    setSiteVisible(false);
    showPanel("requestArea");
  }
}

$("signupBtn").addEventListener("click", async () => {
  const email = $("email").value.trim();
  const password = $("password").value;
  const fullName = $("fullName").value.trim();
  if (!email || password.length < 6 || !fullName) {
    showMessage("Enter your name, email and a password of at least 6 characters.");
    return;
  }
  const { data, error } = await supabaseClient.auth.signUp({
    email, password,
    options: { data: { full_name: fullName } }
  });
  if (error) return showMessage(error.message);
  if (!data.session) {
    showMessage("Account created. Check your email if email confirmation is enabled, then log in.", true);
  } else {
    showMessage("Account created.", true);
    await refreshState();
  }
});

$("loginBtn").addEventListener("click", async () => {
  const email = $("email").value.trim();
  const password = $("password").value;
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) return showMessage(error.message);
  showMessage("Login successful.", true);
  await refreshState();
});

$("requestBtn").addEventListener("click", async () => {
  const user = await currentUser();
  if (!user) return;
  const reason = $("reason").value.trim();
  const { error } = await supabaseClient.from("access_requests").upsert({
    user_id: user.id,
    email: user.email,
    full_name: user.user_metadata?.full_name || "Visitor",
    reason,
    status: "pending"
  }, { onConflict: "user_id" });
  if (error) return showMessage(error.message);
  showMessage("Access request sent.", true);
  await refreshState();
});

async function logout() {
  await supabaseClient.auth.signOut();
  $("email").value = "";
  $("password").value = "";
  setSiteVisible(false);
  showPanel("authForm");
}
["logoutBtn","logoutBtn2","siteLogout"].forEach(id => $(id).addEventListener("click", logout));
$("refreshBtn").addEventListener("click", refreshState);

function buildMedia() {
  const photos = $("photoGrid");
  const videos = $("videoGrid");
  if (!photos.children.length) {
    for (let i=1; i<=20; i++) {
      const card = document.createElement("button");
      card.className = "media-card";
      card.innerHTML = `<img src="images/photo${i}.jpg" alt="Mudassar photo ${i}" loading="lazy" onerror="this.parentElement.classList.add('missing')"><span>Photo ${i}</span>`;
      photos.appendChild(card);
    }
  }
  if (!videos.children.length) {
    for (let i=1; i<=20; i++) {
      const card = document.createElement("div");
      card.className = "video-card";
      card.innerHTML = `<video controls preload="metadata" poster="images/photo${i}.jpg"><source src="videos/video${i}.mp4" type="video/mp4">Your browser does not support video.</video><span>Video ${i}</span>`;
      videos.appendChild(card);
    }
  }
}

supabaseClient.auth.onAuthStateChange(() => setTimeout(refreshState, 0));
refreshState();