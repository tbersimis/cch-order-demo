# Coca-Cola HBC order line demo (Live Hub)

| Path | What it is |
|---|---|
| `/` | Order line website with the web-call card, portfolio and demo customer numbers |
| `/backoffice/` | Order desk board: live orders, line items, totals, confirm / dispatch / deliver, clear board |
| `POST /api/customers/lookup` | Tool `CCH_lookup_customer` |
| `POST /api/products/search` | Tool `CCH_search_products` |
| `POST /api/orders` | Tool `CCH_place_order` |
| `POST /api/orders/status` | Tool `CCH_order_status` |

The Live Hub agent **CCH_Order_AIBot** and its four tools already exist in your account and point at
`https://cch-order-demo.onrender.com`. If Render gives your service a different address, send it to
Claude to update the tools, or change the URL of each of the four tools in Live Hub.

Customers, SKUs and prices are fictitious demo data (see `catalog.js`).

## 1. GitHub

1. github.com > **+** > **New repository**, name `cch-order-demo` > **Create repository**.
2. Click **uploading an existing file**, drag in everything inside the unzipped `cch-order-demo` folder, **Commit changes**.
3. Check that `server.js`, `catalog.js` and `package.json` are at the top level.

## 2. Render (free)

1. render.com > **New** > **Web Service** > pick `cch-order-demo`.
2. Name: `cch-order-demo`, Region: Frankfurt, Language: Node, Build: `npm install`, Start: `npm start`, Instance: **Free**.
3. Optional environment variable `ADMIN_TOKEN` (protects Clear board and status changes).
4. **Deploy Web Service** and wait for "Your service is live".

The address should be `https://cch-order-demo.onrender.com`. If Render shows a different one, update the tools (see above).

Free-plan reminders: it sleeps after 15 minutes idle (open `/backoffice/` a minute before the demo,
its 3-second refresh keeps it awake) and the board empties when it sleeps. Render's 750 free hours a
month are shared by all your free services, so keep-awake pinging is only realistic for one of them.

## 3. Logo

Put the official Coca-Cola HBC logo in `public/brand/` as `logo.svg` (or `logo.png`) using GitHub
**Add file > Upload files**. Until then the header shows the text "Coca-Cola HBC".

## 4. Web calling (Click-to-Call)

Use a **new** Click-to-Call SIP connection so these calls go to the order agent and the hotel demo keeps working.

1. Live Hub: *Voice channels > SIP Connections > Add new SIP connection*, Provider Type **Client Applications**,
   Provider **Click-to-Call (WebRTC)**. On the Incoming tab tick **Credentials** and set a username and password.
2. Add a routing rule from this SIP connection to the **CCH_Order_AIBot** bot connection.
3. Download the widget files from the SIP connection card.
4. In GitHub, `public/c2c/` > **Add file** > **Upload files**:
   - `click-to-call-widget.js` from the download, unchanged
   - `c2c-config.js`: copy `c2c-config.example.js`, fill in username, password, domain and wss address from your
     downloaded `basic.js`. `CALL_NUMBER` is already set to `C2C-Order-Call`.
5. Commit; Render redeploys in a minute or two.

## 5. Demo script

1. Open `/backoffice/`, wait for "Live", click **Clear board**.
2. Open the website, scroll to **Call the order line**, click the call icon.
3. "My customer number is 100422." The agent greets Taverna Thalassa.
4. "Five cases of Coca-Cola Zero cans, ten cases of AVRA one and a half litre and two of Three Cents tonic."
5. Change something ("make the Zero ones 500 ml bottles"), confirm, hear the order number and delivery day.
6. Show the order arriving on the board, then the call's logs and the post-call summary in Live Hub.
7. Optional: call again and ask "Where is my order?" or ask about invoices to show the transfer.
