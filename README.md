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
