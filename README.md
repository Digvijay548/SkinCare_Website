# Wenni Skin Care Academy — Client Website

An elegant, high-performance, fully data-driven single-page application (SPA) built for **Wenni Skin Care Academy**, branch Manjari Budruk, Pune. 

This website features custom scroll animations, micro-interactions, responsive grids, a 3D card tilt effect, and a direct-to-WhatsApp booking form.

---

## 🚀 Running Locally

The project runs on a simple static file server.

1. Open a terminal in the project directory.
2. Run the local development server:
   ```bash
   npx serve . --listen 3000
   ```
3. Open your browser and navigate to:
   **[http://localhost:3000](http://localhost:3000)**

---

## ⚙️ Configuration & Customization (`data.json`)

The entire website is data-driven. All text, services, ratings, testimonies, clinic hours, contact details, and images are managed directly inside **[`data.json`](file:///c:/GitHub/Clinic_website/data.json)**. No code changes are required to update content.

### 🎓 How to Toggle the Course / Academy Section
You can completely hide or show the cosmetology courses section dynamically. 

Open **[`data.json`](file:///c:/GitHub/Clinic_website/data.json)**, locate the `"academic"` object, and set the `"enabled"` flag:

```json
  "academic": {
    "enabled": true,   // Set to true to display the Courses section, false to hide it
    "eyebrow": "Wenni Skin Care Academy",
    "title": "Learn The Art Of",
    ...
  }
```

#### What happens automatically when `"enabled": false` is set:
* 🚫 **Hides Section**: The academy section (`#academic`) is set to `display: none` in the document body.
* 🧭 **Cleans Navigation**: The `"Academy"` link is automatically removed from the header navigation bar.
* 👣 **Cleans Footer**: The `"Our Academy"` link is dynamically removed from the footer quick links.
* ⚡ **Optimizes Animations**: The IntersectionObserver scroll triggers and scroll spy active links bypass the section entirely.

---

## 🎨 Visual System & Branding

* **Primary Colors**: Luxurious Plum base (`#1a0a2e`), Rose and Purple gradients (`#F472B6` to `#C084FC`), and Amber Gold accents (`#F59E0B`).
* **Typography**: Elegant **Cormorant Garamond** serif for display headers, and clean **Inter** sans-serif for body reading.

---

## ⚡ Supabase Setup (Serverless Admin Panel)

The website is integrated with **Supabase** for database, storage, and authentication. This enables a fully client-side (serverless) admin panel at `/admin.html` to manage texts, lists, and images.

Follow these step-by-step instructions to configure your Supabase backend:

### Step 1: Create a Supabase Project
1. Log in to [supabase.com](https://supabase.com) and click **New Project**.
2. Enter your project details (e.g. name, database password) and select a hosting region closest to your audience.
3. Wait for the project database to provision.

### Step 2: Initialize the Database Table
1. Go to the **SQL Editor** tab in the left-hand sidebar of the Supabase dashboard.
2. Click **New query**.
3. Paste the following SQL script to create the `site_settings` table, enable Row Level Security (RLS), and configure access control policies:

```sql
-- 1. Create the settings table
CREATE TABLE IF NOT EXISTS public.site_settings (
    id integer PRIMARY KEY DEFAULT 1,
    content jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT single_row CHECK (id = 1)
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Allow public read access to the website configurations
CREATE POLICY "Allow public read access" 
ON public.site_settings 
FOR SELECT 
USING (true);

-- 4. Policy: Allow logged-in authenticated users to create configurations
CREATE POLICY "Allow authenticated insert" 
ON public.site_settings 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- 5. Policy: Allow logged-in authenticated users to edit configurations
CREATE POLICY "Allow authenticated update" 
ON public.site_settings 
FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);
```
4. Click **Run** in the top right to execute.

### Step 3: Create the Storage Bucket for Images
1. Click **Storage** in the left sidebar.
2. Click **New bucket** and name it exactly: `skincare-assets`
3. Toggle the **Public bucket** switch to **ON** (so visitors can load the images you upload). Click **Save**.
4. Go to your `skincare-assets` bucket -> **Policies** (or **Policies** under the configuration sidebar):
   - Click **New policy** -> **For full customization** to create a **Read Policy**:
     * **Name**: `Allow public read`
     * **Allowed operations**: Select **SELECT** only.
     * **Target role**: `public` (anyone).
     * Save the policy.
   - Click **New policy** -> **For full customization** to create an **Upload Policy**:
     * **Name**: `Allow authenticated uploads`
     * **Allowed operations**: Select **INSERT**, **UPDATE**, and **DELETE** operations.
     * **Target role**: `authenticated` (logged-in admin).
     * Save the policy.

### Step 4: Create Admin Login Credentials
1. Click **Authentication** in the left sidebar.
2. Go to the **Users** tab.
3. Click **Add user** -> **Create user**.
4. Enter your admin email and password.
5. Make sure **Auto-confirm user** is checked **ON**. Click **Create user**. (This is your login account for `/admin.html`).
6. Next, go to **Authentication** -> **Providers** -> **Email**.
7. Ensure **Enable Email provider** is **ON**.
8. Ensure **Confirm email** toggle is **OFF** (this bypasses email link validation so you can log in immediately). Click **Save**.

### Step 5: Configure website connection keys
1. Go to **Project Settings** (gear icon at bottom left) -> **API**.
2. Copy the **Project URL** and the **anon / public** API Key.
3. Open [`supabase-config.js`](file:///c:/GitHub/SkinCare_Website/supabase-config.js) and paste them:
```javascript
window.SUPABASE_CONFIG = {
  url: "https://tvkagfntkhtyapyyecbc.supabase.co",      // Paste your project URL here
  anonKey: "sb_publishable_IaaruVvciVDiWtR9nK8Cqw_o95qpSWH"   // Paste your anon key here
};
```

### Step 6: Migrate existing images to Supabase
1. Run the website locally (e.g. click the localhost links or run your server).
2. Go to [http://localhost:8000/admin.html](http://localhost:8000/admin.html) and sign in.
3. Once logged in, click the blue **📤 Migrate Images** button in the top right header.
4. The system will automatically fetch all local assets, upload them to your Supabase Storage bucket, map the URLs, and update the database configuration. You are now 100% serverless!

