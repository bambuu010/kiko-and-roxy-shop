# Kiko and Roxy Shop

No-payment online shopping site for Kiko and Roxy in Mongolia.

## What It Does

- Customer storefront
- Product catalog
- Cart
- Order request checkout
- Shipping, pickup, and local delivery options
- Mongolian tugrug pricing
- Admin login
- Add/delete products
- Upload product images
- View orders
- Mark orders Confirmed, Ready, or Completed
- Stores products and orders in `data/store.json`

## Admin Login

- Username: `admin`
- Password: `admin`

Change these for real use with environment variables:

```powershell
$env:ADMIN_USER="yourname"
$env:ADMIN_PASSWORD="your-strong-password"
```

## Run Locally

```powershell
C:\Users\bambu\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe server.js
```

Open:

```text
http://127.0.0.1:8000
```

## What It Still Needs To Be Truly Online

- A domain name
- Hosting for the Node server
- A real database for production, such as PostgreSQL or Supabase
- Real email/SMS notification service
- A stronger admin login system before public launch
- Business pages: privacy policy, refund policy, shipping policy
- Optional payment setup later
