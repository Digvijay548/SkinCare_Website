/* ═══════════════════════════════════════════════════════
   Wenni Skin Care Academy — admin.js
   Pure client-side Admin Panel controller with Supabase.
   ═══════════════════════════════════════════════════════ */

let supabaseClient = null;
let activeData = null; // Holds the currently active site JSON structure
let localBackupData = null; // Local copy of fallback data.json

// ── TOAST NOTIFICATIONS ─────────────────────────────────
function showToast(message, type = "info", duration = 4000) {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  
  let icon = "ℹ️";
  if (type === "success") icon = "✅";
  if (type === "error")   icon = "⚠️";
  
  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(50px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ── BOOT & AUTH CHECK ──────────────────────────────────
(async function init() {
  const cfg = window.SUPABASE_CONFIG;
  const hasConfig = cfg && cfg.url && cfg.anonKey;

  if (!hasConfig) {
    document.getElementById("loginStatusFallback").style.display = "block";
    showToast("Supabase is not configured. Please fill supabase-config.js credentials first.", "error");
    return;
  }

  try {
    const { createClient } = window.supabase;
    supabaseClient = createClient(cfg.url, cfg.anonKey);
    
    // Check initial authentication status
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (session) {
      onLoginSuccess();
    } else {
      setupAuthListener();
    }
  } catch(err) {
    console.error("Supabase initialization error:", err);
    showToast("Error connecting to Supabase: " + err.message, "error");
  }
})();

function setupAuthListener() {
  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (session) {
      onLoginSuccess();
    } else {
      onLogout();
    }
  });

  // Login form handler
  const form = document.getElementById("loginForm");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("adminEmail").value.trim();
    const password = document.getElementById("adminPassword").value;
    const btn = document.getElementById("loginBtn");
    
    btn.textContent = "Signing in...";
    btn.disabled = true;

    try {
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      showToast("Log in successful!", "success");
    } catch(err) {
      showToast(err.message, "error");
      btn.textContent = "Sign In";
      btn.disabled = false;
    }
  });
}

async function onLoginSuccess() {
  document.getElementById("loginWrapper").style.display = "none";
  document.getElementById("dashboardWrapper").style.display = "flex";
  
  showToast("Loading site configuration...", "info");
  await fetchConfig();
  initTabs();
}

function onLogout() {
  document.getElementById("loginWrapper").style.display = "flex";
  document.getElementById("dashboardWrapper").style.display = "none";
  document.getElementById("loginBtn").textContent = "Sign In";
  document.getElementById("loginBtn").disabled = false;
}

document.getElementById("logoutBtn").addEventListener("click", async () => {
  if (supabaseClient) {
    await supabaseClient.auth.signOut();
    showToast("Logged out successfully.", "info");
  }
});

// ── CONFIG LOADER ──────────────────────────────────────
async function fetchConfig() {
  try {
    // 1. Try to load from Supabase
    const { data, error } = await supabaseClient
      .from("site_settings")
      .select("content")
      .eq("id", 1)
      .maybeSingle();

    if (error) throw error;

    if (data && data.content) {
      activeData = data.content;
      
      // Auto-merge missing keys from local data.json if any are missing (like the new gallery)
      let needsSave = false;
      try {
        const res = await fetch("data.json", { cache: "no-store" });
        const defaultData = await res.json();
        
        for (const key in defaultData) {
          if (activeData[key] === undefined) {
            activeData[key] = defaultData[key];
            needsSave = true;
          }
        }
      } catch (mergeErr) {
        console.warn("Failed to fetch default data for merging:", mergeErr);
      }
      
      if (needsSave) {
        console.log("Database missing new section fields. Auto-merging and saving...");
        await supabaseClient
          .from("site_settings")
          .upsert({ id: 1, content: activeData, updated_at: new Date().toISOString() });
      }
      
      showToast("Configuration loaded from database.", "success");
    } else {
      // 2. Database table is empty! Let's bootstrap it with local data.json
      showToast("Database is empty. Bootstrapping with local data.json...", "info");
      const res = await fetch("data.json", { cache: "no-store" });
      const defaultData = await res.json();
      
      const { error: insertErr } = await supabaseClient
        .from("site_settings")
        .insert([{ id: 1, content: defaultData }]);
        
      if (insertErr) throw insertErr;
      
      activeData = defaultData;
      showToast("Database successfully initialized with default data!", "success");
    }
    
    renderCurrentTab();
  } catch(err) {
    console.error("Config fetch error:", err);
    showToast("Error loading configuration: " + err.message, "error");
  }
}

// ── TABS NAVIGATION ─────────────────────────────────────
let currentTab = "site-info";

function initTabs() {
  const items = document.querySelectorAll(".tab-item");
  items.forEach(item => {
    item.addEventListener("click", () => {
      items.forEach(i => i.classList.remove("active"));
      item.classList.add("active");
      
      // Hide all panels
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      
      currentTab = item.getAttribute("data-tab");
      const targetPanel = document.getElementById(`panel-${currentTab}`);
      if (targetPanel) {
        targetPanel.classList.add("active");
        renderCurrentTab();
      }
    });
  });

  // Global Save Changes button click handler
  document.getElementById("saveAllBtn").addEventListener("click", saveChanges);
}

function renderCurrentTab() {
  if (!activeData) return;
  
  const panel = document.getElementById(`panel-${currentTab}`);
  if (!panel) return;
  
  switch(currentTab) {
    case "site-info":
      renderSiteInfo(panel);
      break;
    case "hero":
      renderHeroTab(panel);
      break;
    case "about":
      renderAboutTab(panel);
      break;
    case "services":
      renderServicesTab(panel);
      break;
    case "why-us":
      renderWhyUsTab(panel);
      break;
    case "academy":
      renderAcademyTab(panel);
      break;
    case "doctor":
      renderDoctorTab(panel);
      break;
    case "testimonials":
      renderTestimonialsTab(panel);
      break;
    case "gallery":
      renderGalleryTab(panel);
      break;
    case "experience":
      renderExperienceTab(panel);
      break;
    case "json-editor":
      renderJsonEditorTab(panel);
      break;
  }
}

// Helper to escape HTML values inside input boxes
function val(str) {
  return String(str ?? "").replace(/"/g, "&quot;");
}

// Helper to create basic card structures
function getSectionHeader(title, subtitle) {
  return `
    <h2 class="panel-title">${title}</h2>
    <p class="panel-subtitle">${subtitle}</p>
  `;
}

// ── IMAGE UPLOAD HANDLER ────────────────────────────────
async function handleImageUpload(inputEl, previewId, dataPath) {
  const file = inputEl.files[0];
  if (!file) return;

  const previewEl = document.getElementById(previewId);
  const loadingText = document.createElement("div");
  loadingText.className = "image-preview-placeholder";
  loadingText.textContent = "Uploading...";
  
  const originalPreviewContent = previewEl.innerHTML;
  previewEl.innerHTML = "";
  previewEl.appendChild(loadingText);

  try {
    const oldUrl = getNestedValue(activeData, dataPath);
    if (oldUrl) {
      await deleteFileFromStorage(oldUrl);
    }

    const ext = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
    const filePath = `uploads/${fileName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabaseClient.storage
      .from("skincare-assets")
      .upload(filePath, file, { cacheControl: '3600', upsert: true });

    if (error) throw error;

    // Get public url
    const { data: urlData } = supabaseClient.storage
      .from("skincare-assets")
      .getPublicUrl(filePath);

    const publicUrl = urlData.publicUrl;

    // Update activeData
    updateNestedValue(activeData, dataPath, publicUrl);
    
    // Update preview
    previewEl.innerHTML = `<img src="${publicUrl}" alt="Preview" />`;
    showToast("Image uploaded successfully!", "success");
  } catch(err) {
    console.error("Upload error:", err);
    showToast("Upload failed: " + err.message, "error");
    previewEl.innerHTML = originalPreviewContent;
  }
}

// Sets values in deep nested objects (e.g. "hero.image")
function updateNestedValue(obj, path, value) {
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (part.includes('[') && part.includes(']')) {
      // Handles array accesses like "services[0]"
      const arrayName = part.split('[')[0];
      const index = parseInt(part.split('[')[1].replace(']', ''), 10);
      current = current[arrayName][index];
    } else {
      current = current[part];
    }
  }
  const lastPart = parts[parts.length - 1];
  current[lastPart] = value;
}

// Get deep nested value safely
function getNestedValue(obj, path) {
  try {
    const parts = path.split('.');
    let current = obj;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part.includes('[') && part.includes(']')) {
        const arrayName = part.split('[')[0];
        const index = parseInt(part.split('[')[1].replace(']', ''), 10);
        if (!current[arrayName] || !current[arrayName][index]) return undefined;
        current = current[arrayName][index];
      } else {
        if (!current || current[part] === undefined) return undefined;
        current = current[part];
      }
    }
    return current;
  } catch(e) {
    return undefined;
  }
}

// Get path for storage deletion from public URL
function getStoragePathFromUrl(url) {
  if (!url || !url.includes("supabase.co/storage/v1/object/public/skincare-assets/")) {
    return null;
  }
  const parts = url.split("/storage/v1/object/public/skincare-assets/");
  if (parts.length > 1) {
    return decodeURIComponent(parts[1]);
  }
  return null;
}

// Delete physical file from storage
async function deleteFileFromStorage(url) {
  const filePath = getStoragePathFromUrl(url);
  if (!filePath) return;
  
  try {
    const { data, error } = await supabaseClient.storage
      .from("skincare-assets")
      .remove([filePath]);
    if (error) throw error;
    console.log(`Deleted file from storage: ${filePath}`);
  } catch(err) {
    console.warn(`Failed to delete storage file ${filePath}:`, err.message);
  }
}

// Remove image from field, delete from storage, and auto-save
window.removeImageField = async function(dataPath, previewId) {
  if (confirm("Are you sure you want to delete this image?")) {
    const oldUrl = getNestedValue(activeData, dataPath);
    if (oldUrl) {
      showToast("Removing image file...", "info");
      await deleteFileFromStorage(oldUrl);
    }
    
    updateNestedValue(activeData, dataPath, "");
    
    const previewEl = document.getElementById(previewId);
    if (previewEl) {
      previewEl.innerHTML = `<div class="image-preview-placeholder">No Image</div>`;
    }
    
    showToast("Image removed. Saving database...", "info");
    await saveChanges();
    renderCurrentTab();
  }
};

// ── TAB RENDERING ──────────────────────────────────────

// 1. SITE INFO & CONTACT
function renderSiteInfo(panel) {
  panel.innerHTML = `
    ${getSectionHeader("Site Info & Contacts", "Manage basic site names, headers, contact email, WhatsApp, and Google Map details.")}
    
    <div class="form-section-card">
      <div class="form-section-title">Brand Info</div>
      <div class="form-group">
        <label>Website Name</label>
        <input type="text" value="${val(activeData.site.name)}" oninput="activeData.site.name = this.value">
      </div>
      <div class="form-row-2">
        <div class="form-group">
          <label>Sub-Header (e.g. Branch)</label>
          <input type="text" value="${val(activeData.site.branch)}" oninput="activeData.site.branch = this.value">
        </div>
        <div class="form-group">
          <label>Brand Tagline</label>
          <input type="text" value="${val(activeData.site.tagline)}" oninput="activeData.site.tagline = this.value">
        </div>
      </div>
    </div>

    <div class="form-section-card">
      <div class="form-section-title">WhatsApp & Contacts</div>
      <div class="form-row-3">
        <div class="form-group">
          <label>WhatsApp Number (With country code, no space)</label>
          <input type="text" value="${val(activeData.whatsapp.number)}" oninput="activeData.whatsapp.number = this.value">
        </div>
        <div class="form-group">
          <label>Display Phone Number</label>
          <input type="text" value="${val(activeData.whatsapp.display)}" oninput="activeData.whatsapp.display = this.value">
        </div>
        <div class="form-group">
          <label>Contact Email</label>
          <input type="email" value="${val(activeData.contact.email)}" oninput="activeData.contact.email = this.value">
        </div>
      </div>
      <div class="form-group">
        <label>WhatsApp Default Start Message</label>
        <input type="text" value="${val(activeData.whatsapp.message)}" oninput="activeData.whatsapp.message = this.value">
      </div>
      <div class="form-group">
        <label>Physical Address</label>
        <textarea oninput="activeData.contact.address = this.value">${activeData.contact.address}</textarea>
      </div>
      <div class="form-group">
        <label>Google Maps Embed URL</label>
        <input type="text" value="${val(activeData.contact.mapEmbed)}" oninput="activeData.contact.mapEmbed = this.value">
      </div>
    </div>

    <div class="form-section-card">
      <div class="form-section-title">Footer & Metadata</div>
      <div class="form-group">
        <label>SEO Meta Page Title</label>
        <input type="text" value="${val(activeData.site.pageTitle)}" oninput="activeData.site.pageTitle = this.value">
      </div>
      <div class="form-group">
        <label>SEO Meta Description</label>
        <textarea oninput="activeData.site.pageDescription = this.value">${activeData.site.pageDescription}</textarea>
      </div>
      <div class="form-group">
        <label>Footer Description Tagline</label>
        <textarea oninput="activeData.site.footerTagline = this.value">${activeData.site.footerTagline}</textarea>
      </div>
      <div class="form-row-2">
        <div class="form-group">
          <label>Copyright Text</label>
          <input type="text" value="${val(activeData.site.copyright)}" oninput="activeData.site.copyright = this.value">
        </div>
        <div class="form-group">
          <label>Credit Text</label>
          <input type="text" value="${val(activeData.site.credit)}" oninput="activeData.site.credit = this.value">
        </div>
      </div>
    </div>
  `;
}

// 2. HERO
function renderHeroTab(panel) {
  panel.innerHTML = `
    ${getSectionHeader("Hero Section Settings", "Change banner text, trust signals, main CTA buttons, and upload the landing page background image.")}

    <div class="form-section-card">
      <div class="form-section-title">Landing Image</div>
      <div class="image-upload-wrapper">
        <div class="image-preview" id="heroImagePreview">
          <img src="${activeData.hero.image}" alt="Hero Image">
        </div>
        <div class="image-upload-controls">
          <div style="display:flex; gap:10px; flex-wrap: wrap;">
            <div class="btn btn-outline btn-sm file-input-btn">
              📤 Upload New Image
              <input type="file" accept="image/*" onchange="handleImageUpload(this, 'heroImagePreview', 'hero.image')">
            </div>
            ${activeData.hero.image ? `<button type="button" class="btn btn-danger btn-sm" onclick="removeImageField('hero.image', 'heroImagePreview')">🗑️ Remove Image</button>` : ''}
          </div>
          <p>Recommended: 1920x1080px or higher, landscape ratio, premium aesthetic.</p>
          <div class="form-group" style="margin-top: 10px; width: 100%">
            <label>Image Alt Text (SEO)</label>
            <input type="text" value="${val(activeData.hero.imageAlt)}" oninput="activeData.hero.imageAlt = this.value">
          </div>
        </div>
      </div>
    </div>

    <div class="form-section-card">
      <div class="form-section-title">Hero Main Text</div>
      <div class="form-group">
        <label>Header Badge Label</label>
        <input type="text" value="${val(activeData.hero.badge)}" oninput="activeData.hero.badge = this.value">
      </div>
      <div class="form-group">
        <label>Title Lines (Line 1, Accent Line, Line 3)</label>
        <div class="form-row-3">
          <input type="text" placeholder="Line 1" value="${val(activeData.hero.titleLines[0]?.text)}" oninput="activeData.hero.titleLines[0].text = this.value">
          <input type="text" placeholder="Accent Line (Typewriter)" value="${val(activeData.hero.titleLines[1]?.text)}" oninput="activeData.hero.titleLines[1].text = this.value">
          <input type="text" placeholder="Line 3" value="${val(activeData.hero.titleLines[2]?.text)}" oninput="activeData.hero.titleLines[2].text = this.value">
        </div>
      </div>
      <div class="form-group">
        <label>Hero Subtitle</label>
        <textarea oninput="activeData.hero.subtitle = this.value">${activeData.hero.subtitle}</textarea>
      </div>
    </div>

    <div class="form-section-card">
      <div class="form-section-title">Buttons & CTAs</div>
      <div class="form-row-2">
        <div class="form-group">
          <label>Primary Button Label</label>
          <input type="text" value="${val(activeData.hero.btnPrimary.label)}" oninput="activeData.hero.btnPrimary.label = this.value">
        </div>
        <div class="form-group">
          <label>Secondary Button Label</label>
          <input type="text" value="${val(activeData.hero.btnSecondary.label)}" oninput="activeData.hero.btnSecondary.label = this.value">
        </div>
      </div>
    </div>

    <div class="form-section-card">
      <div class="form-section-title">Consultation Overlay Card</div>
      <div class="form-row-3">
        <div class="form-group">
          <label>Card Title</label>
          <input type="text" value="${val(activeData.hero.consultCard.title)}" oninput="activeData.hero.consultCard.title = this.value">
        </div>
        <div class="form-group">
          <label>Sublabel</label>
          <input type="text" value="${val(activeData.hero.consultCard.label)}" oninput="activeData.hero.consultCard.label = this.value">
        </div>
        <div class="form-group">
          <label>Card Icon Emoji</label>
          <input type="text" value="${val(activeData.hero.consultCard.icon)}" oninput="activeData.hero.consultCard.icon = this.value">
        </div>
      </div>
      <div class="form-group">
        <label>Card Description</label>
        <textarea oninput="activeData.hero.consultCard.desc = this.value">${activeData.hero.consultCard.desc}</textarea>
      </div>
      <div class="form-group">
        <label>Bullet Tags (comma-separated)</label>
        <input type="text" value="${val(activeData.hero.consultCard.tags.join(', '))}" oninput="activeData.hero.consultCard.tags = this.value.split(',').map(s=>s.trim()).filter(Boolean)">
      </div>
    </div>
  `;
}

// 3. ABOUT
function renderAboutTab(panel) {
  panel.innerHTML = `
    ${getSectionHeader("About Us Settings", "Update the introduction section, academy overview process, features, and experience badge.")}
    
    <div class="form-section-card">
      <div class="form-section-title">Intro Headers</div>
      <div class="form-row-3">
        <div class="form-group">
          <label>Section Eyebrow</label>
          <input type="text" value="${val(activeData.about.eyebrow)}" oninput="activeData.about.eyebrow = this.value">
        </div>
        <div class="form-group">
          <label>Title Header</label>
          <input type="text" value="${val(activeData.about.title)}" oninput="activeData.about.title = this.value">
        </div>
        <div class="form-group">
          <label>Title Accent (Highlighted)</label>
          <input type="text" value="${val(activeData.about.titleAccent)}" oninput="activeData.about.titleAccent = this.value">
        </div>
      </div>
      <div class="form-group">
        <label>Description Paragraph 1</label>
        <textarea oninput="activeData.about.desc[0] = this.value">${activeData.about.desc[0]}</textarea>
      </div>
      <div class="form-group">
        <label>Description Paragraph 2</label>
        <textarea oninput="activeData.about.desc[1] = this.value">${activeData.about.desc[1]}</textarea>
      </div>
    </div>

    <div class="form-section-card">
      <div class="form-section-title">Features Checklist</div>
      <div class="form-group">
        <label>Checklist Items (One per line)</label>
        <textarea style="min-height: 120px" oninput="activeData.about.features = this.value.split('\\n').map(s=>s.trim()).filter(Boolean)">${activeData.about.features.join('\n')}</textarea>
      </div>
      <div class="form-row-2">
        <div class="form-group">
          <label>Experience Value (Badge)</label>
          <input type="text" value="${val(activeData.about.expBadge.value)}" oninput="activeData.about.expBadge.value = this.value">
        </div>
        <div class="form-group">
          <label>Experience Label</label>
          <input type="text" value="${val(activeData.about.expBadge.label.replace('<br/>', ' '))}" oninput="activeData.about.expBadge.label = this.value.replace(/\\n/g, '<br/>')">
        </div>
      </div>
    </div>

    <div class="form-section-card">
      <div class="form-section-title">Step-by-Step Care Process</div>
      <div class="form-row-2">
        <div class="form-group">
          <label>Process Header Label</label>
          <input type="text" value="${val(activeData.about.process.headLabel)}" oninput="activeData.about.process.headLabel = this.value">
        </div>
        <div class="form-group">
          <label>Process Header Title</label>
          <input type="text" value="${val(activeData.about.process.headTitle)}" oninput="activeData.about.process.headTitle = this.value">
        </div>
      </div>

      <div class="items-list-grid">
        ${activeData.about.process.steps.map((step, i) => `
          <div class="item-card">
            <div class="item-card-header">
              <h4>Step ${step.num}</h4>
            </div>
            <div class="form-row-2">
              <div class="form-group">
                <label>Step Title</label>
                <input type="text" value="${val(step.title)}" oninput="activeData.about.process.steps[${i}].title = this.value">
              </div>
              <div class="form-group">
                <label>Step Number</label>
                <input type="text" value="${val(step.num)}" oninput="activeData.about.process.steps[${i}].num = this.value">
              </div>
            </div>
            <div class="form-group" style="margin: 0">
              <label>Description</label>
              <textarea oninput="activeData.about.process.steps[${i}].desc = this.value">${step.desc}</textarea>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

// 4. SERVICES
function renderServicesTab(panel) {
  let listHTML = activeData.services.map((svc, i) => `
    <div class="item-card">
      <div class="item-card-header">
        <h4>Service #${i + 1}: ${svc.name || "Untitled Service"}</h4>
        <button class="btn btn-danger btn-sm" onclick="deleteService(${i})">🗑️ Delete</button>
      </div>

      <div class="form-row-2">
        <div class="form-group">
          <label>Service Name</label>
          <input type="text" value="${val(svc.name)}" oninput="activeData.services[${i}].name = this.value; renderCurrentTab();">
        </div>
        <div class="form-group">
          <label>Card Highlight Color (Hex code)</label>
          <input type="text" value="${val(svc.color)}" oninput="activeData.services[${i}].color = this.value">
        </div>
      </div>

      <div class="form-group">
        <label>Service Description</label>
        <textarea oninput="activeData.services[${i}].desc = this.value">${svc.desc}</textarea>
      </div>

      <div class="form-group">
        <label>SVG Icon Markup (Lucide / custom SVG)</label>
        <div class="icon-input-group">
          <textarea style="min-height: 50px" oninput="activeData.services[${i}].icon = this.value; document.getElementById('svc-icon-prev-${i}').innerHTML = this.value;">${svc.icon}</textarea>
          <div class="icon-preview-box" id="svc-icon-prev-${i}">${svc.icon || ""}</div>
        </div>
      </div>

      <div class="form-group" style="margin: 0">
        <label>Service Image</label>
        <div class="image-upload-wrapper">
          <div class="image-preview" id="svcImagePrev-${i}">
            ${svc.image ? `<img src="${svc.image}" alt="Service Image">` : `<div class="image-preview-placeholder">No Image</div>`}
          </div>
          <div class="image-upload-controls">
            <div style="display:flex; gap:10px; flex-wrap: wrap;">
              <div class="btn btn-outline btn-sm file-input-btn">
                📤 Upload Image
                <input type="file" accept="image/*" onchange="handleImageUpload(this, 'svcImagePrev-${i}', 'services[${i}].image')">
              </div>
              ${svc.image ? `<button type="button" class="btn btn-danger btn-sm" onclick="removeImageField('services[${i}].image', 'svcImagePrev-${i}')">🗑️ Remove Image</button>` : ''}
            </div>
            <p>Recommended: Square ratio, clean cosmetology theme.</p>
          </div>
        </div>
      </div>
    </div>
  `).join("");

  panel.innerHTML = `
    ${getSectionHeader("Manage Services Offered", "Add, edit, or remove services that are dynamically displayed in the services list.")}
    
    <div class="form-section-card">
      <div class="form-section-title">Services Headers</div>
      <div class="form-row-2">
        <div class="form-group">
          <label>Services Eyebrow</label>
          <input type="text" value="${val(activeData.sections.services.eyebrow)}" oninput="activeData.sections.services.eyebrow = this.value">
        </div>
        <div class="form-group">
          <label>Services Section Title</label>
          <input type="text" value="${val(activeData.sections.services.title)}" oninput="activeData.sections.services.title = this.value">
        </div>
      </div>
      <div class="form-row-2">
        <div class="form-group">
          <label>Title Accent</label>
          <input type="text" value="${val(activeData.sections.services.titleAccent)}" oninput="activeData.sections.services.titleAccent = this.value">
        </div>
        <div class="form-group">
          <label>Subtitle Description</label>
          <input type="text" value="${val(activeData.sections.services.subtitle)}" oninput="activeData.sections.services.subtitle = this.value">
        </div>
      </div>
    </div>

    <div class="items-list-grid">
      ${listHTML}
      <div class="add-item-card" onclick="addService()">
        ➕ Add New Service
      </div>
    </div>
  `;
}

window.deleteService = async function(index) {
  if (confirm("Are you sure you want to delete this service?")) {
    const oldUrl = activeData.services[index].image;
    activeData.services.splice(index, 1);
    showToast("Service deleted. Saving to database...", "info");
    if (oldUrl) await deleteFileFromStorage(oldUrl);
    await saveChanges();
    renderCurrentTab();
  }
};

window.addService = function() {
  const defaultIcon = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`;
  activeData.services.push({
    name: "New Service",
    desc: "Description of the new beauty or skin care treatment.",
    color: "#00B4D8",
    image: "",
    icon: defaultIcon
  });
  showToast("Service added at the bottom. Fill details below.", "success");
  renderCurrentTab();
  
  // Scroll to bottom
  setTimeout(() => {
    const cards = document.querySelectorAll(".item-card");
    if(cards.length > 0) cards[cards.length - 1].scrollIntoView({ behavior: "smooth" });
  }, 100);
};

// 5. WHY US
function renderWhyUsTab(panel) {
  panel.innerHTML = `
    ${getSectionHeader("Why Choose Us Features", "Control the text credentials listed in the why choose us grid.")}
    
    <div class="form-section-card">
      <div class="form-section-title">Section Headers</div>
      <div class="form-row-2">
        <div class="form-group">
          <label>Section Eyebrow</label>
          <input type="text" value="${val(activeData.sections.whyUs.eyebrow)}" oninput="activeData.sections.whyUs.eyebrow = this.value">
        </div>
        <div class="form-group">
          <label>Section Title</label>
          <input type="text" value="${val(activeData.sections.whyUs.title)}" oninput="activeData.sections.whyUs.title = this.value">
        </div>
      </div>
      <div class="form-row-2">
        <div class="form-group">
          <label>Title Accent</label>
          <input type="text" value="${val(activeData.sections.whyUs.titleAccent)}" oninput="activeData.sections.whyUs.titleAccent = this.value">
        </div>
        <div class="form-group">
          <label>Section Subtitle</label>
          <input type="text" value="${val(activeData.sections.whyUs.subtitle)}" oninput="activeData.sections.whyUs.subtitle = this.value">
        </div>
      </div>
    </div>

    <div class="items-list-grid">
      ${activeData.whyUs.map((item, i) => `
        <div class="item-card">
          <div class="item-card-header">
            <h4>Point ${item.num}</h4>
          </div>
          <div class="form-row-2">
            <div class="form-group">
              <label>Point Title</label>
              <input type="text" value="${val(item.title)}" oninput="activeData.whyUs[${i}].title = this.value">
            </div>
            <div class="form-group">
              <label>Point Number</label>
              <input type="text" value="${val(item.num)}" oninput="activeData.whyUs[${i}].num = this.value">
            </div>
          </div>
          <div class="form-group" style="margin: 0">
            <label>Short Description</label>
            <textarea oninput="activeData.whyUs[${i}].desc = this.value">${item.desc}</textarea>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

// 6. ACADEMY
function renderAcademyTab(panel) {
  const acad = activeData.academic || { enabled: false, stats: [], features: [], courses: [], eyebrow: "", title: "", titleAccent: "", subtitle: "", image: "", imageAlt: "", desc: [] };
  
  // Safeguard array references
  if (!acad.stats) acad.stats = [];
  if (!acad.features) acad.features = [];
  if (!acad.courses) acad.courses = [];
  if (!acad.desc) acad.desc = [""];
  activeData.academic = acad;

  let coursesHTML = acad.courses.map((course, i) => `
    <div class="item-card">
      <div class="item-card-header">
        <h4>Course #${course.num || i+1}: ${course.title || "Untitled Course"}</h4>
        <button class="btn btn-danger btn-sm" onclick="deleteCourse(${i})">🗑️ Delete</button>
      </div>
      <div class="form-row-2">
        <div class="form-group">
          <label>Course Title</label>
          <input type="text" value="${val(course.title)}" oninput="activeData.academic.courses[${i}].title = this.value">
        </div>
        <div class="form-group">
          <label>Course Index Num</label>
          <input type="text" value="${val(course.num)}" oninput="activeData.academic.courses[${i}].num = this.value">
        </div>
      </div>
      <div class="form-row-2">
        <div class="form-group">
          <label>Duration (e.g. 3 Months)</label>
          <input type="text" value="${val(course.duration)}" oninput="activeData.academic.courses[${i}].duration = this.value">
        </div>
        <div class="form-group">
          <label>Skill Level (e.g. Intermediate)</label>
          <input type="text" value="${val(course.level)}" oninput="activeData.academic.courses[${i}].level = this.value">
        </div>
      </div>
      <div class="form-group" style="margin: 0">
        <label>Course Description Summary</label>
        <textarea oninput="activeData.academic.courses[${i}].desc = this.value">${course.desc}</textarea>
      </div>
    </div>
  `).join("");

  panel.innerHTML = `
    ${getSectionHeader("Cosmetology Academy Section", "Enable or disable your student training course lists, details, and enrollment image.")}
    
    <div class="toggle-group">
      <div class="toggle-label">
        <strong>Enable Academy Section</strong>
        <span>Show or hide the Academy courses section on the homepage.</span>
      </div>
      <label class="switch">
        <input type="checkbox" id="academyToggleCheck" ${acad.enabled !== false ? 'checked' : ''} onchange="activeData.academic.enabled = this.checked">
        <span class="slider"></span>
      </label>
    </div>

    <div class="form-section-card">
      <div class="form-section-title">Academy Image Banner</div>
      <div class="image-upload-wrapper">
        <div class="image-preview" id="acadImagePreview">
          ${acad.image ? `<img src="${acad.image}" alt="Academy Banner">` : `<div class="image-preview-placeholder">No Image</div>`}
        </div>
        <div class="image-upload-controls">
          <div style="display:flex; gap:10px; flex-wrap: wrap;">
            <div class="btn btn-outline btn-sm file-input-btn">
              📤 Upload New Image
              <input type="file" accept="image/*" onchange="handleImageUpload(this, 'acadImagePreview', 'academic.image')">
            </div>
            ${acad.image ? `<button type="button" class="btn btn-danger btn-sm" onclick="removeImageField('academic.image', 'acadImagePreview')">🗑️ Remove Image</button>` : ''}
          </div>
          <p>Recommended: Landscape image, cosmetology classroom or students in action.</p>
          <div class="form-group" style="margin-top: 10px; width: 100%">
            <label>Image Alt (SEO)</label>
            <input type="text" value="${val(acad.imageAlt)}" oninput="activeData.academic.imageAlt = this.value">
          </div>
        </div>
      </div>
    </div>

    <div class="form-section-card">
      <div class="form-section-title">Academy Copy Headers</div>
      <div class="form-row-3">
        <div class="form-group">
          <label>Academy Eyebrow</label>
          <input type="text" value="${val(acad.eyebrow)}" oninput="activeData.academic.eyebrow = this.value">
        </div>
        <div class="form-group">
          <label>Title Header</label>
          <input type="text" value="${val(acad.title)}" oninput="activeData.academic.title = this.value">
        </div>
        <div class="form-group">
          <label>Title Accent</label>
          <input type="text" value="${val(acad.titleAccent)}" oninput="activeData.academic.titleAccent = this.value">
        </div>
      </div>
      <div class="form-group">
        <label>Section Subtitle</label>
        <textarea oninput="activeData.academic.subtitle = this.value">${acad.subtitle}</textarea>
      </div>
      <div class="form-group">
        <label>Description Paragraph</label>
        <textarea oninput="activeData.academic.desc[0] = this.value">${acad.desc[0] || ""}</textarea>
      </div>
      <div class="form-group">
        <label>Features Checklist (One per line)</label>
        <textarea style="min-height: 100px" oninput="activeData.academic.features = this.value.split('\\n').map(s=>s.trim()).filter(Boolean)">${acad.features.join('\n')}</textarea>
      </div>
    </div>

    <div class="form-section-card">
      <div class="form-section-title">Academy Statistics (4 metrics)</div>
      <div class="form-row-2">
        ${acad.stats.map((st, idx) => `
          <div class="form-group" style="border: 1px solid var(--color-border); padding: 12px; border-radius: 8px; background: rgba(0,0,0,0.1)">
            <label>Stat Metric #${idx+1} (Value & Label)</label>
            <div class="form-row-2" style="gap: 10px">
              <input type="text" placeholder="Value (e.g. 100+)" value="${val(st.value)}" oninput="activeData.academic.stats[${idx}].value = this.value">
              <input type="text" placeholder="Label (e.g. Graduates)" value="${val(st.label)}" oninput="activeData.academic.stats[${idx}].label = this.value">
            </div>
          </div>
        `).join("")}
      </div>
    </div>

    <h3 style="font-size: 16px; margin-bottom: 12px; font-weight:600">Offered Courses List</h3>
    <div class="items-list-grid">
      ${coursesHTML}
      <div class="add-item-card" onclick="addCourse()">
        ➕ Add New Course
      </div>
    </div>
  `;
}

window.deleteCourse = async function(index) {
  if (confirm("Are you sure you want to delete this course?")) {
    activeData.academic.courses.splice(index, 1);
    showToast("Course deleted. Saving to database...", "info");
    await saveChanges();
    renderCurrentTab();
  }
};

window.addCourse = function() {
  activeData.academic.courses.push({
    num: String(activeData.academic.courses.length + 1).padStart(2, '0'),
    title: "New Cosmetology Course",
    desc: "Description details of what students learn and outcomes.",
    duration: "3 Months",
    level: "Beginner"
  });
  showToast("Course added at the bottom.", "success");
  renderCurrentTab();
};

// 7. DOCTOR / FOUNDER
function renderDoctorTab(panel) {
  const doc = activeData.doctor || {};
  if (!doc.bio) doc.bio = ["", ""];
  if (!doc.credentials) doc.credentials = [];
  if (!doc.expertise) doc.expertise = { title: "", points: [], note: "" };
  if (!doc.expertise.points) doc.expertise.points = [];
  activeData.doctor = doc;

  panel.innerHTML = `
    ${getSectionHeader("Founder / Trainer Profile", "Edit biological details, values, metrics, and training descriptions of the clinic head.")}
    
    <div class="form-section-card">
      <div class="form-section-title">Header & Profile Title</div>
      <div class="form-row-3">
        <div class="form-group">
          <label>Eyebrow Tag</label>
          <input type="text" value="${val(doc.eyebrow)}" oninput="activeData.doctor.eyebrow = this.value">
        </div>
        <div class="form-group">
          <label>Doctor's Full Name</label>
          <input type="text" value="${val(doc.name)}" oninput="activeData.doctor.name = this.value">
        </div>
        <div class="form-group">
          <label>Degree / Designation</label>
          <input type="text" value="${val(doc.degree)}" oninput="activeData.doctor.degree = this.value">
        </div>
      </div>
      <div class="form-group">
        <label>Bio Summary Paragraph 1</label>
        <textarea oninput="activeData.doctor.bio[0] = this.value">${doc.bio[0]}</textarea>
      </div>
      <div class="form-group">
        <label>Bio Summary Paragraph 2</label>
        <textarea oninput="activeData.doctor.bio[1] = this.value">${doc.bio[1]}</textarea>
      </div>
    </div>

    <div class="form-section-card">
      <div class="form-section-title">Credentials / Stats Counters</div>
      <div class="form-row-3">
        ${doc.credentials.map((cred, idx) => `
          <div class="form-group" style="border: 1px solid var(--color-border); padding: 10px; border-radius: 8px;">
            <label>Credential Counter #${idx+1}</label>
            <input type="text" placeholder="Value (e.g. 15+)" value="${val(cred.value)}" oninput="activeData.doctor.credentials[${idx}].value = this.value" style="margin-bottom: 6px">
            <input type="text" placeholder="Label (e.g. Experience)" value="${val(cred.label)}" oninput="activeData.doctor.credentials[${idx}].label = this.value">
          </div>
        `).join("")}
      </div>
    </div>

    <div class="form-section-card">
      <div class="form-section-title">Expertise Points</div>
      <div class="form-group">
        <label>Expertise Subsection Title</label>
        <input type="text" value="${val(doc.expertise.title)}" oninput="activeData.doctor.expertise.title = this.value">
      </div>
      <div class="form-group">
        <label>Expertise Bullet Points (One per line)</label>
        <textarea style="min-height: 100px" oninput="activeData.doctor.expertise.points = this.value.split('\\n').map(s=>s.trim()).filter(Boolean)">${doc.expertise.points.join('\n')}</textarea>
      </div>
      <div class="form-group">
        <label>Honest Code Note (Bottom highlighted text)</label>
        <input type="text" value="${val(doc.expertise.note)}" oninput="activeData.doctor.expertise.note = this.value">
      </div>
    </div>
  `;
}

// 8. TESTIMONIALS
function renderTestimonialsTab(panel) {
  let testiHTML = activeData.testimonials.map((test, i) => `
    <div class="item-card">
      <div class="item-card-header">
        <h4>Reviewer: ${test.name || "Anonymous"}</h4>
        <button class="btn btn-danger btn-sm" onclick="deleteTestimonial(${i})">🗑️ Delete</button>
      </div>
      <div class="form-row-3">
        <div class="form-group">
          <label>Reviewer Name</label>
          <input type="text" value="${val(test.name)}" oninput="activeData.testimonials[${i}].name = this.value">
        </div>
        <div class="form-group">
          <label>Reviewer Role (e.g. Acne Client)</label>
          <input type="text" value="${val(test.role)}" oninput="activeData.testimonials[${i}].role = this.value">
        </div>
        <div class="form-group">
          <label>Star Rating (1 to 5)</label>
          <select onchange="activeData.testimonials[${i}].stars = parseInt(this.value, 10)">
            <option value="5" ${test.stars === 5 ? 'selected' : ''}>5 Stars</option>
            <option value="4" ${test.stars === 4 ? 'selected' : ''}>4 Stars</option>
            <option value="3" ${test.stars === 3 ? 'selected' : ''}>3 Stars</option>
            <option value="2" ${test.stars === 2 ? 'selected' : ''}>2 Stars</option>
            <option value="1" ${test.stars === 1 ? 'selected' : ''}>1 Star</option>
          </select>
        </div>
      </div>
      <div class="form-group" style="margin: 0">
        <label>Reviewer Feedback Text</label>
        <textarea oninput="activeData.testimonials[${i}].text = this.value">${test.text}</textarea>
      </div>
    </div>
  `).join("");

  panel.innerHTML = `
    ${getSectionHeader("Manage Client Reviews", "Edit, add, or remove feedback reviews shown in the testimonials slider.")}
    
    <div class="form-section-card">
      <div class="form-section-title">Section Title Headers</div>
      <div class="form-row-2">
        <div class="form-group">
          <label>Section Eyebrow</label>
          <input type="text" value="${val(activeData.sections.testimonials.eyebrow)}" oninput="activeData.sections.testimonials.eyebrow = this.value">
        </div>
        <div class="form-group">
          <label>Section Main Title</label>
          <input type="text" value="${val(activeData.sections.testimonials.title)}" oninput="activeData.sections.testimonials.title = this.value">
        </div>
      </div>
    </div>

    <div class="items-list-grid">
      ${testiHTML}
      <div class="add-item-card" onclick="addTestimonial()">
        ➕ Add New Review
      </div>
    </div>
  `;
}

window.deleteTestimonial = async function(index) {
  if (confirm("Are you sure you want to delete this review?")) {
    activeData.testimonials.splice(index, 1);
    showToast("Review deleted. Saving to database...", "info");
    await saveChanges();
    renderCurrentTab();
  }
};

window.addTestimonial = function() {
  activeData.testimonials.push({
    stars: 5,
    name: "Client Name",
    role: "Treatment Client",
    text: "Review text goes here describing the results they felt.",
    avatar: "#C084FC",
    featured: false
  });
  showToast("Review added.", "success");
  renderCurrentTab();
};

// 9. CLIENT EXPERIENCE
function renderExperienceTab(panel) {
  let expHTML = activeData.experience.map((exp, i) => `
    <div class="item-card">
      <div class="item-card-header">
        <h4>Experience Item #${i + 1}: ${exp.title}</h4>
      </div>
      <div class="form-row-2">
        <div class="form-group">
          <label>Title</label>
          <input type="text" value="${val(exp.title)}" oninput="activeData.experience[${i}].title = this.value">
        </div>
        <div class="form-group">
          <label>Item Order Number</label>
          <input type="text" value="${val(exp.num)}" oninput="activeData.experience[${i}].num = this.value">
        </div>
      </div>
      <div class="form-group">
        <label>Detail Description Text</label>
        <textarea oninput="activeData.experience[${i}].desc = this.value">${exp.desc}</textarea>
      </div>

      <div class="form-group" style="margin: 0">
        <label>Grid Photo Image</label>
        <div class="image-upload-wrapper">
          <div class="image-preview" id="expImagePrev-${i}">
            ${exp.image ? `<img src="${exp.image}" alt="Experience Image">` : `<div class="image-preview-placeholder">No Image</div>`}
          </div>
          <div class="image-upload-controls">
            <div style="display:flex; gap:10px; flex-wrap: wrap;">
              <div class="btn btn-outline btn-sm file-input-btn">
                📤 Upload Image
                <input type="file" accept="image/*" onchange="handleImageUpload(this, 'expImagePrev-${i}', 'experience[${i}].image')">
              </div>
              ${exp.image ? `<button type="button" class="btn btn-danger btn-sm" onclick="removeImageField('experience[${i}].image', 'expImagePrev-${i}')">🗑️ Remove Image</button>` : ''}
            </div>
            <p>Recommended: Landscape spa theme.</p>
          </div>
        </div>
      </div>
    </div>
  `).join("");

  panel.innerHTML = `
    ${getSectionHeader("Premium Client Experiences", "Edit details and images that describe the clinic experience grids.")}
    
    <div class="form-section-card">
      <div class="form-section-title">Section Title Headers</div>
      <div class="form-row-3">
        <div class="form-group">
          <label>Eyebrow</label>
          <input type="text" value="${val(activeData.sections.experience.eyebrow)}" oninput="activeData.sections.experience.eyebrow = this.value">
        </div>
        <div class="form-group">
          <label>Title</label>
          <input type="text" value="${val(activeData.sections.experience.title)}" oninput="activeData.sections.experience.title = this.value">
        </div>
        <div class="form-group">
          <label>Accent</label>
          <input type="text" value="${val(activeData.sections.experience.titleAccent)}" oninput="activeData.sections.experience.titleAccent = this.value">
        </div>
      </div>
      <div class="form-group">
        <label>Subtitle Description</label>
        <input type="text" value="${val(activeData.sections.experience.subtitle)}" oninput="activeData.sections.experience.subtitle = this.value" style="width:100%">
      </div>
    </div>

    <div class="items-list-grid">
      ${expHTML}
    </div>
  `;
}

// 10. RAW JSON BACKUPS
function renderJsonEditorTab(panel) {
  panel.innerHTML = `
    ${getSectionHeader("Raw Configuration Backups", "Import, export, or edit the full JSON site model directly. Useful for copying configurations or restoring backups.")}
    
    <div class="form-section-card">
      <div class="form-section-title">
        <span>Raw JSON editor</span>
        <button class="btn btn-primary btn-sm" onclick="applyRawJson()">💻 Apply Changes</button>
      </div>
      <div class="form-group">
        <label>Site Data Model (Edit with caution)</label>
        <textarea id="rawJsonTextarea" class="json-textarea">${JSON.stringify(activeData, null, 2)}</textarea>
      </div>
      <div class="form-row-2">
        <button class="btn btn-outline" onclick="copyJsonToClipboard()">📋 Copy JSON to Clipboard</button>
        <button class="btn btn-outline" onclick="resetJsonToDefault()">🔄 Reset to local data.json defaults</button>
      </div>
    </div>
  `;
}

window.copyJsonToClipboard = function() {
  const txt = document.getElementById("rawJsonTextarea");
  txt.select();
  document.execCommand("copy");
  showToast("JSON copied to clipboard!", "success");
};

window.applyRawJson = function() {
  try {
    const rawVal = document.getElementById("rawJsonTextarea").value;
    const parsed = JSON.parse(rawVal);
    activeData = parsed;
    showToast("JSON applied successfully to browser active data. Click Save Changes to save to database.", "success");
  } catch(err) {
    showToast("Invalid JSON syntax: " + err.message, "error");
  }
};

window.resetJsonToDefault = async function() {
  if (confirm("Resetting will replace active workspace configurations with data.json values. Are you sure?")) {
    try {
      const res = await fetch("data.json", { cache: "no-store" });
      const defaultData = await res.json();
      activeData = defaultData;
      
      const txt = document.getElementById("rawJsonTextarea");
      if (txt) txt.value = JSON.stringify(activeData, null, 2);
      
      showToast("Reset successfully! Click Save Changes to commit to database.", "success");
    } catch(err) {
      showToast("Failed to fetch defaults: " + err.message, "error");
    }
  }
};

// ── SAVE CHANGES TO DATABASE ────────────────────────────
async function saveChanges() {
  if (!supabaseClient || !activeData) {
    showToast("Cannot save. Database connection not configured or data not loaded.", "error");
    return;
  }

  const btn = document.getElementById("saveAllBtn");
  const originalText = btn.innerHTML;
  btn.innerHTML = "⏳ Saving...";
  btn.disabled = true;

  try {
    const { error } = await supabaseClient
      .from("site_settings")
      .upsert({ 
        id: 1, 
        content: activeData, 
        updated_at: new Date().toISOString() 
      });

    if (error) throw error;
    
    showToast("All changes saved to database successfully!", "success");
  } catch(err) {
    console.error("Save error:", err);
    showToast("Failed to save changes: " + err.message, "error");
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

// ── MIGRATE LOCAL IMAGES TO SUPABASE ─────────────────────
window.migrateAllLocalImages = async function() {
  if (!supabaseClient || !activeData) {
    showToast("Database not connected or configurations not loaded.", "error");
    return;
  }
  
  const btn = document.getElementById("migrateImagesBtn");
  const originalText = btn.innerHTML;
  btn.innerHTML = "⏳ Migrating...";
  btn.disabled = true;
  
  try {
    showToast("Starting image migration...", "info");
    
    // Find all images in activeData
    const imageTargets = [];
    
    // 1. Hero image
    if (activeData.hero && activeData.hero.image) {
      imageTargets.push({ path: "hero.image", val: activeData.hero.image });
    }
    // 2. Academy image
    if (activeData.academic && activeData.academic.image) {
      imageTargets.push({ path: "academic.image", val: activeData.academic.image });
    }
    // 3. Services images
    if (activeData.services && Array.isArray(activeData.services)) {
      activeData.services.forEach((svc, i) => {
        if (svc.image) {
          imageTargets.push({ path: `services[${i}].image`, val: svc.image });
        }
      });
    }
    // 4. Experience images
    if (activeData.experience && Array.isArray(activeData.experience)) {
      activeData.experience.forEach((exp, i) => {
        if (exp.image) {
          imageTargets.push({ path: `experience[${i}].image`, val: exp.image });
        }
      });
    }
    // 5. Gallery images
    if (activeData.gallery && activeData.gallery.items && Array.isArray(activeData.gallery.items)) {
      activeData.gallery.items.forEach((item, i) => {
        if (item.image) {
          imageTargets.push({ path: `gallery.items[${i}].image`, val: item.image });
        }
      });
    }
    
    // Filter to keep only local images (e.g., starting with "images/")
    const locals = imageTargets.filter(t => t.val && !t.val.startsWith("http") && !t.val.startsWith("data:"));
    
    if (locals.length === 0) {
      showToast("No local images to migrate! All images are already stored in Supabase.", "success");
      return;
    }
    
    showToast(`Found ${locals.length} local images to migrate. Please wait...`, "info");
    
    let successCount = 0;
    for (let i = 0; i < locals.length; i++) {
      const target = locals[i];
      try {
        showToast(`Migrating (${i + 1}/${locals.length}): ${target.val}`, "info");
        
        // Fetch file over HTTP
        const res = await fetch(target.val);
        if (!res.ok) throw new Error(`HTTP status ${res.status}`);
        const blob = await res.blob();
        
        // Extract filename
        const filename = target.val.split('/').pop() || "image.jpg";
        const cleanName = `${Date.now()}_migrated_${filename}`;
        const filePath = `uploads/${cleanName}`;
        
        // Upload to Storage
        const { data, error } = await supabaseClient.storage
          .from("skincare-assets")
          .upload(filePath, blob, { contentType: blob.type, cacheControl: '3600', upsert: true });
          
        if (error) throw error;
        
        // Get public URL
        const { data: urlData } = supabaseClient.storage
          .from("skincare-assets")
          .getPublicUrl(filePath);
          
        const publicUrl = urlData.publicUrl;
        
        // Update local object
        updateNestedValue(activeData, target.path, publicUrl);
        successCount++;
      } catch (uploadErr) {
        console.error(`Failed to migrate image ${target.val}:`, uploadErr);
        showToast(`Failed to migrate ${target.val}: ${uploadErr.message}`, "error");
      }
    }
    
    // Auto-save changes to the database
    if (successCount > 0) {
      showToast(`Successfully migrated ${successCount} images. Saving changes to database...`, "info");
      await saveChanges();
      renderCurrentTab();
    }
  } catch(err) {
    showToast("Migration error: " + err.message, "error");
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
};

// ── RENDER: GALLERY TAB ──────────────────────────────────
function renderGalleryTab(panel) {
  const g = activeData.gallery || { eyebrow: "", title: "", titleAccent: "", subtitle: "", categories: [], items: [] };
  
  if (!g.categories) g.categories = ["All", "Treatments", "Academy", "Transformations"];
  if (!g.items) g.items = [];
  activeData.gallery = g;

  let criteriaHTML = g.categories.filter(c => c !== "All").map((cat, idx) => `
    <div style="display: flex; gap: 10px; margin-bottom: 8px; align-items: center;">
      <input type="text" value="${val(cat)}" onchange="updateCriteria(${idx}, this.value)" style="flex: 1; padding: 8px 12px; margin-bottom: 0;">
      <button class="btn btn-danger btn-sm" onclick="deleteCriteria(${idx})">🗑️ Delete</button>
    </div>
  `).join("");

  let itemsHTML = g.items.map((item, i) => `
    <div class="item-card">
      <div class="item-card-header">
        <h4>Showcase Photo #${i + 1}</h4>
        <button class="btn btn-danger btn-sm" onclick="deleteGalleryItem(${i})">🗑️ Delete</button>
      </div>

      <div class="form-row-2">
        <div class="form-group">
          <label>Photo Title / Caption</label>
          <input type="text" value="${val(item.title)}" oninput="activeData.gallery.items[${i}].title = this.value">
        </div>
        <div class="form-group">
          <label>Category Tag</label>
          <select onchange="activeData.gallery.items[${i}].category = this.value">
            ${g.categories.filter(c => c !== "All").map(cat => `
              <option value="${val(cat)}" ${item.category === cat ? 'selected' : ''}>${cat}</option>
            `).join("")}
          </select>
        </div>
      </div>

      <div class="form-group" style="margin: 0">
        <label>Showcase Image</label>
        <div class="image-upload-wrapper">
          <div class="image-preview" id="galleryImagePrev-${i}">
            ${item.image ? `<img src="${item.image}" alt="Gallery Image">` : `<div class="image-preview-placeholder">No Image</div>`}
          </div>
          <div class="image-upload-controls">
            <div style="display:flex; gap:10px; flex-wrap: wrap;">
              <div class="btn btn-outline btn-sm file-input-btn">
                📤 Upload Photo
                <input type="file" accept="image/*" onchange="handleImageUpload(this, 'galleryImagePrev-${i}', 'gallery.items[${i}].image')">
              </div>
              ${item.image ? `<button type="button" class="btn btn-danger btn-sm" onclick="removeImageField('gallery.items[${i}].image', 'galleryImagePrev-${i}')">🗑️ Remove Image</button>` : ''}
            </div>
            <p>Recommended: landscape aspect ratio.</p>
          </div>
        </div>
      </div>
    </div>
  `).join("");

  panel.innerHTML = `
    ${getSectionHeader("Showcase Gallery Settings", "Add, edit, or delete criteria and photos shown in the showcase gallery.")}
    
    <div class="toggle-group">
      <div class="toggle-label">
        <strong>Enable Gallery Section</strong>
        <span>Show or hide the showcase gallery grid on the homepage.</span>
      </div>
      <label class="switch">
        <input type="checkbox" id="galleryToggleCheck" ${g.enabled !== false ? 'checked' : ''} onchange="activeData.gallery.enabled = this.checked">
        <span class="slider"></span>
      </label>
    </div>

    <div class="form-section-card">
      <div class="form-section-title">Showcase Criteria / Categories</div>
      <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px;">
        ${criteriaHTML}
      </div>
      <button class="btn btn-outline btn-sm" onclick="addCriteria()">➕ Add New Criteria</button>
    </div>

    <h3 style="font-size: 16px; margin-bottom: 12px; font-weight:600">Gallery Items</h3>
    <div class="items-list-grid">
      ${itemsHTML}
      <div class="add-item-card" onclick="addGalleryItem()">
        ➕ Add New Gallery Photo
      </div>
    </div>
  `;
}

window.deleteGalleryItem = async function(index) {
  if (confirm("Are you sure you want to delete this gallery image?")) {
    const oldUrl = activeData.gallery.items[index].image;
    activeData.gallery.items.splice(index, 1);
    showToast("Photo deleted. Saving to database...", "info");
    if (oldUrl) await deleteFileFromStorage(oldUrl);
    await saveChanges();
    renderCurrentTab();
  }
};

window.addGalleryItem = function() {
  const g = activeData.gallery;
  const firstCat = g.categories.filter(c => c !== "All")[0] || "Treatments";
  g.items.push({
    image: "",
    title: "New Showcase Image",
    category: firstCat
  });
  showToast("Photo added at the bottom.", "success");
  renderCurrentTab();
  
  setTimeout(() => {
    const cards = document.querySelectorAll(".item-card");
    if(cards.length > 0) cards[cards.length - 1].scrollIntoView({ behavior: "smooth" });
  }, 100);
};

// Criteria managers
window.updateCriteria = function(idx, value) {
  const g = activeData.gallery;
  const cats = g.categories.filter(c => c !== "All");
  const oldVal = cats[idx];
  const newVal = value.trim();
  if (!newVal) return;
  
  cats[idx] = newVal;
  g.categories = ["All", ...cats];
  
  // Update gallery items utilizing this category
  if (g.items) {
    g.items.forEach(item => {
      if (item.category === oldVal) {
        item.category = newVal;
      }
    });
  }
  
  showToast("Criteria updated successfully.", "success");
  renderCurrentTab();
};

window.deleteCriteria = async function(idx) {
  const g = activeData.gallery;
  const cats = g.categories.filter(c => c !== "All");
  const catToDelete = cats[idx];
  
  if (confirm(`Are you sure you want to delete the criteria "${catToDelete}"? This will map existing photos under this criteria to another category.`)) {
    cats.splice(idx, 1);
    g.categories = ["All", ...cats];
    
    const firstCat = cats[0] || "Treatments";
    if (g.items) {
      g.items.forEach(item => {
        if (item.category === catToDelete) {
          item.category = firstCat;
        }
      });
    }
    
    showToast(`Criteria "${catToDelete}" removed. Saving to database...`, "info");
    await saveChanges();
    renderCurrentTab();
  }
};

window.addCriteria = function() {
  const g = activeData.gallery;
  const cats = g.categories.filter(c => c !== "All");
  cats.push("New Category");
  g.categories = ["All", ...cats];
  
  showToast("Criteria added.", "success");
  renderCurrentTab();
};
