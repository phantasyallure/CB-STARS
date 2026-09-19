# CB Stars

Clothing store — storefront + back-office, built with React, Vite and Supabase, deployed on Vercel.
Storefront languages: French, English, Arabic. Admin: French / English.

## What's inside

**Storefront (`/`)**
- CB Stars signature wordmark in the header, burgundy & ivory theme. The homepage hero is a full-screen photo: `public/images/hero-desktop.jpg` (16:9, screens wider than 768px) and `public/images/hero-mobile.jpg` (9:16, phones). Replace either file to change the image.
- Clothing categories (jackets, coats, T-shirts, shirts, sweaters, pants, jeans, dresses, skirts, sets, shoes, accessories).
- Colour dots under the price on every product card; on the product page the customer picks a colour (and a size) before ordering.
- Facebook Pixel: `PageView` on every page, `ViewContent` on a product page, `Purchase` when an order is sent.

**Admin (`/admin`)** — sidebar with Products, Orders, Stock, Analytics, Messages, Team, Settings
- **Products:** "Add product" opens a form (photos, name, price, category, colours, sizes, stock). Edit and delete too.
- **Use AI** on each photo removes its background (Gemini → OpenAI → remove.bg → Clipdrop; next one takes over when one hits its limit).
- **Stock:** low-stock highlighting at a threshold you choose, "only 1 left" warnings, live badge in the sidebar, +/- editing.
- **Orders:** Accept / Refuse buttons, filters, search, colour + size shown.
- **Analytics:** accepted vs refused vs pending (7 / 30 / 90 days), daily chart, status donut, top products, top wilayas, accepted revenue.
- **Team:** the owner creates accounts and ticks what each person may open (products, stock, orders, analytics, messages, settings).
- **Settings:** Facebook Pixel ID and AI API keys.

## Setup

### 1. Supabase
1. Open **SQL Editor** and run `supabase/schema.sql`. It is safe on your existing database (products, orders and chat are kept) and can be re-run.
2. **Project Settings > API**: copy the Project URL, the `anon` key and the `service_role` key.

### 2. Environment variables
Copy `.env.example` to `.env` for local work, and add the same variables in **Vercel > Project Settings > Environment Variables**:

| Variable | Where it is used |
|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | browser |
| `SUPABASE_SERVICE_ROLE_KEY` | server functions only (never prefix with `VITE_`) |
| `ADMIN_OWNER_EMAILS` | server, comma-separated allowlist of the only emails that can ever create the owner account |

### 3. Deploy
Push to GitHub and import in Vercel (Vite preset). The `api/` folder deploys as serverless functions automatically.
Locally, use `npx vercel dev` (plain `npm run dev` serves the storefront but not `/api`, so Team, AI and owner setup won't work).

### 4. First login
Open `/admin`. On a fresh install it shows **Create the owner account**: enter your email and password. This only works if that email is listed in `ADMIN_OWNER_EMAILS` on the server — anyone else hitting `/admin` gets a generic "not available" error, so the page can't be used to create unauthorized accounts. After the owner exists it is a normal login screen. The old PIN screen no longer exists.

### 5. Facebook Pixel and AI
- **Settings > Facebook Pixel:** paste the numeric pixel ID. It goes live on the storefront immediately.
- **Settings > AI background removal:** paste one or more API keys. Free Gemini key: https://aistudio.google.com/apikey. Keys are stored server-side and never sent back to the browser. You can also set `GEMINI_API_KEY`, `OPENAI_API_KEY`, `REMOVEBG_API_KEY`, `CLIPDROP_API_KEY` as Vercel environment variables instead.

## Roles and permissions
- The **owner** can do everything and is the only one who sees **Team**.
- Staff accounts only see the sidebar entries they were given, and the database enforces it (row-level security), not just the interface.
- Someone with only **Stock** can change quantities but not prices or names.
- Suspending a member blocks them immediately; deleting removes their login.

## Things worth knowing
- **Statuses:** database values are unchanged (`new`, `contacted`, `confirmed`, `cancelled`). *Confirmed* is shown as **Accepted**, *cancelled* as **Refused**.
- **Stock and orders:** accepting an order takes 1 piece out of stock and un-accepting puts it back (turn it off in Stock > toggle). Existing stock numbers are not touched.
- **Old jewellery products** keep working; they show under "Other" until you edit their category.
- **AI background removal:** OpenAI, remove.bg and Clipdrop return a transparent PNG. Gemini returns the product on a plain white background (Gemini image output has no transparency). Image quotas and pricing are set by each provider; a key with no image quota simply falls through to the next one.
- **Support chat:** conversations are still readable by anyone holding the public anon key (unchanged from before). Worth tightening later with a proper session-scoped policy.
- Fonts are bundled (no Google Fonts request). Signature font: Mr De Haviland.
