# Petrol Pump Manager: server

Node.js + SQLite backend with logins (owner, manager, worker), shared business data, and a worker screen that posts credit sales straight into the customer ledger.

- `server.js`: the whole backend (one file)
- `public/index.html`: the app (ledger, invoices, stock, suppliers, book, reports, backup, team, worker screen)
- `data.db`: created on first run; this is all your data

## Roles

| Role | Can do |
|---|---|
| Owner | Everything: Pump setup, Salary, Team (managers and workers), approving the business day |
| Manager | Assigns duties, reviews and closes them, closes the business day, daily summary, ledger, invoices, stock, suppliers, tanks, reports. Can add and manage workers in Team. No Pump setup, no Salary |
| Worker | Their assigned duty, credit sales, tank dips, and their own pay. Can open the full detail of their past duties |

Worker credit sales appear in the customer ledger immediately. If a sale is over the customer's available credit, it is held as "waiting for approval" instead. Managers and the owner see it at the top of the Ledger tab and can approve it (it then posts to the ledger) or reject it. The worker sees the status on their screen.

## Duty flow

1. **Owner, one time: Pump setup.** Add nozzles (fuel, tank, active or inactive), each nozzle's opening reading for its first duty, fuel rates with a start date, expense categories, and payment modes (turn off the ones you do not use). Credit customers can be made inactive here too.
2. **Manager: Duty tab, Assign duty.** Pick the worker, shift and nozzles. A nozzle already with another worker is locked until that duty is closed. The opening reading is filled from the nozzle's last closing and the rate from the fuel rate table.
3. **Worker:** opens the assigned duty and enters closing readings and testing litres, any lube or shop items sold (picked from Stock), expenses paid from the till, and the money collected by payment mode. Opening and rate are locked. Credit sales saved during the duty are counted automatically. The screen shows expected collection and whether it is short, in excess, or tallies, then the worker submits.
4. **Manager:** reviews the submitted duty, corrects anything, and closes it. Closing a duty reduces lube and shop stock. Then **Close day** when all duties are closed.
5. **Owner:** **Approve day** (or reopen it). The **Day report** shows a summary and a worker-wise detail, for closed duties only. Print it from there.

Expected collection = fuel sales + lube and shop sales, minus credit sales, minus expenses paid from the till. The business day runs from 6 AM to 6 AM, so a night shift past midnight belongs to the previous day.

## Tank stock and dip readings

1. Owner or manager: **Tanks** tab, then **Tanks setup**. Add each tank with its capacity and, optionally, its dip chart (one line per reading, as `dip, litres`). Then, in **Duty**, edit each nozzle and link it to its tank.
2. **Fuel delivery** records a tanker: bill number, and for each tank (up to 3) the litres and the bill amount for that fuel. The total is added to the oil company account in Suppliers automatically. The per-fuel amounts give the cost per litre used in the margin report.
3. **Add dip reading** (managers) or the **Tank dip** tab (workers) records a dip, either as litres or as a dip converted through the tank's chart.
4. Each new dip is checked against the previous one: opening dip + deliveries in between, minus fuel sold on that tank's nozzles (from submitted duties), equals the expected stock. The difference is shown in red when it is more than 0.5% of the fuel sold (and at least 5 L).

## Worker salary

Workers are paid per duty. In the owner-only **Salary** tab:

1. **Set rates** for each worker and shift (Morning, Evening, Night).
2. Each month shows closed duties × rate, plus **bonus**, minus **advances** and **cash shortages** from those duties.
3. **Waive shortage** removes some or all of the shortage deduction. **Record payment** reduces the balance still to pay.
4. Duties still open or waiting for the manager to close are not counted until they are closed.
5. Each worker can see their own month under **My pay**. Managers cannot see the Salary tab.

## Daily summary on WhatsApp

In the **Duty** tab, pick a date and tap **Daily summary**. It builds a message with fuel sold by fuel, collections and shortages, credit sales and total outstanding, tank stock and low-stock items. Tap **Open WhatsApp** and the message is ready to send (to the owner's number by default, or any number you type). You press send yourself. Sending it automatically each night needs the official WhatsApp Business API from Meta and is not included yet.

## Payment reminders

On the **Ledger** tab, tap **Send reminders to everyone with dues**. You see every customer who owes money (largest first) and an editable message. WhatsApp can only open one chat at a time, so tap **Send** beside each customer, or **Open next** to go down the list. Each customer shows when they were last reminded.

## Excel and PDF export

**Excel** and **PDF** buttons are on four screens:

- **Day report** (Duty tab): the summary or the worker-wise detail, whichever you are viewing.
- **Reports** tab: profit and loss, GST, expenses by category, customer outstanding and stock valuation (one Excel sheet each).
- **Customer ledger**: the customer's statement for the date range you picked, with a balance brought forward and ageing.
- **Salary** (owner): the month's pay for every worker, plus the pay entries.

The files are built on your phone or computer, so nothing is sent anywhere. PDFs use a plain fixed-width layout and show the rupee sign as "Rs.".

On a customer, **Send PDF on WhatsApp** opens your phone's share sheet with the PDF attached; pick WhatsApp and then the customer's chat. (WhatsApp does not let an app choose the chat for you.) If your browser cannot share files, the PDF is saved and WhatsApp opens with a short message, and you attach the PDF yourself.

## Vehicle-wise credit report

On the **Ledger** tab, tap **Vehicle-wise credit report**. Pick a month and, if you like, one customer. It shows:

- **Per vehicle:** fills, litres, amount, average and largest fill, how many were flagged, and who served it.
- **Served by:** each vehicle broken down by worker.
- **Monthly litres per vehicle:** the last six months.
- **Unusual fill-ups:** with the reason. A fill is flagged when it is above the vehicle's tank size, or, if no tank size is entered, more than twice that vehicle's average (after at least 3 earlier fills). Fills with no vehicle number, or a vehicle not on the customer's list, are flagged too.

It uses credit sales that workers save, so the worker's credit sale form now has a **Fuel** and **Litres** field. Add each customer's vehicles one per line in the customer form, with the tank size in litres after a comma if you know it (for example `MH12 AB 1234, 200`). Manual ledger entries have no vehicle or litres, so they are not included. Excel and PDF buttons are on this report too.

## Shortage report

In the **Duty** tab, tap **Shortage report**. Pick the period, how many shortages in a month count as "repeat" (3 by default), and whether the trend is by week or month. It shows, for closed duties only:

- **Shortages per worker:** duties, times short, total short, average short, excess and net difference.
- **Repeat shortages:** workers with that many shortages in a single month.
- **Shortage as a percentage of sales:** and the share of their duties that were short.
- **Trend by week or month:** with a column for each worker.

A duty counts as short when the money handed in is ₹1 or more below what was expected. Excel and PDF buttons are on this report too.

## Book, bank deposits and profit margin

- **Duty money in the Book:** when the manager closes a business day, the money handed in by the workers appears in the **Book**. Cash goes to the Cash account, UPI to UPI / wallet, and card and other payment modes to Bank. Money a worker spent from the till is already deducted from what they hand in.
- **Bank deposits:** in the Book, tap **Bank deposit** (date, amount, slip number, deposited by). It moves cash from Cash to Bank. The Book shows **Cash waiting to be banked**, the oldest unbanked day, and a table of recent days with cash handed in, banked and still to bank. Deposits are matched to the oldest days first.
- **Reports tab:** the profit and loss now includes fuel sales and lube and shop sales from closed days, and duty expenses are included in expenses by category. If you also invoice a lube sale that was entered in a duty, it is counted twice, so invoice only sales that are not in a duty.
- **Profit and margin:** the Reports tab also shows fuel margin per fuel (sales less the cost of the litres sold, from your delivery bills), shop and invoice margin (from each item's purchase price), and a net profit before worker pay. Cost per litre is the average of the deliveries in the period, or the latest earlier delivery. A fuel with no delivery cost shows "no cost" and is left out of the profit.

The business date (the 6 AM to 6 AM day) comes from the server, so every phone agrees on the day.

## Fuel products and density checks

**Fuel products (Pump setup, Fuel products):** the owner can add, rename or switch off the fuels sold, for example XP95 or CNG. Each has a unit: litre, kg (for example CNG) or kWh (for example EV charging). Renaming a fuel updates your nozzles, tanks and rates. Duty forms, the day report and the daily WhatsApp summary show the right unit, and liquid-fuel litres are totalled separately from kg and kWh. Tanks, dip readings and the tank stock check apply to liquid fuels only.

**Density checks:** both a **fuel delivery** (for each tank) and a **dip reading** (managers on the Tanks tab, workers on the Tank dip tab) can record:
- the density stated on the supplier's invoice (deliveries only),
- the density you measured with the hydrometer,
- the temperature, and
- the density corrected to 15 °C.

The Tanks tab lists recent readings and flags a reading when it is **outside the allowed range** for that fuel, or when it **differs from the invoice density by more than the tolerance**. The reading at 15 °C is used when it is entered, otherwise the measured one. Set the lowest, highest and tolerance for each fuel under Pump setup, Fuel products. The defaults shown there (for example 0.720 to 0.775 for petrol, 0.820 to 0.860 for diesel, tolerance 0.003) are common figures and are only a starting point: confirm them with your oil company's guidelines.

## Shop products: categories, GST and Excel import

- **Categories:** in the **Stock** tab, tap **Categories** to add or remove them, or type a new one when you add an item. The list is grouped by category and can be filtered.
- **GST and HSN per product:** every product has a GST rate (0, 5, 12, 18 or 28 per cent) and an optional HSN code. On an invoice, picking a stock item fills in its GST rate and HSN, and each line can be changed. Items that are not in stock can be given any of the rates. The invoice shows HSN and GST per line and the CGST and SGST (or IGST) for each rate. The Reports tab shows a **GST by rate** table.
- **Import from Excel:** in the Stock tab, tap **Import from Excel**. Download the template if you like. Your file (.xlsx or .csv) needs a heading row with at least **Name** and **Selling price**; other columns are Category, Unit, Purchase price, Opening stock, Low stock level, GST % and HSN. You see a preview of every row before anything is saved: new products can be added or skipped, products already in stock can be updated or skipped (you choose for each, or for all at once), and rows with a problem are shown with the reason. Updating an existing product changes only the columns that have a value in your file, and never its stock quantity. Categories in the file are created automatically.

The HSN codes in the template are examples only. Use the codes that apply to your products.

## Marathi and Hindi for workers

Workers see a language picker (English, Marathi, Hindi) at the top of their screens. Their choice is saved with their login, so it is the same next time and on any phone. The worker screens are translated: Duty (including the details of past duties), Credit sale, Tank dip, My pay, and the messages and confirmations on them.

- Names you enter yourself stay as you typed them: customers, fuels, expense categories, items and nozzles.
- Owner and manager screens are in English.
- The login screen is in English.
- The translations are in one place in `public/index.html` (the `I18N` list near the top of the script), so any wording can be changed there. Please have someone who reads Marathi and Hindi check the wording, in particular the pay and shortage terms.

## Try it on your computer

```bash
npm install
node server.js
# open http://127.0.0.1:3000 and create the owner account
```

## Put it on Oracle Cloud (Always Free VM)

1. **Create the VM.** Ubuntu 22.04 or 24.04. Note its public IP.
2. **Open web ports.** In the VM's subnet security list, allow ingress TCP 80 and 443. Then on the VM:
   ```bash
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
   sudo netfilter-persistent save
   ```
3. **Install Node 22.**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```
4. **Copy this folder** to `/opt/petrol-app` (for example with `scp -r`), then:
   ```bash
   cd /opt/petrol-app && npm install --omit=dev
   ```
5. **Run it as a service.** Create `/etc/systemd/system/petrol.service`:
   ```ini
   [Unit]
   Description=Petrol pump server
   After=network.target

   [Service]
   WorkingDirectory=/opt/petrol-app
   ExecStart=/usr/bin/node server.js
   Environment=PORT=3000
   Restart=always
   User=ubuntu

   [Install]
   WantedBy=multi-user.target
   ```
   ```bash
   sudo systemctl daemon-reload && sudo systemctl enable --now petrol
   ```
6. **Add HTTPS (required).** Logins send passwords, so never use plain HTTP. You need a domain name (a free one from duckdns.org works) pointing at the VM's IP. Then:
   ```bash
   sudo apt-get install -y caddy
   ```
   Put this in `/etc/caddy/Caddyfile` and run `sudo systemctl reload caddy`:
   ```
   yourname.duckdns.org {
       reverse_proxy 127.0.0.1:3000
   }
   ```
7. **Open your address** in a browser, create the owner account, then add managers and workers in the Team tab. On phones, use "Add to Home screen".

## Backups (do this)

The server now saves a full copy of the database every night after 2 AM into the `backups` folder (the latest 30 are kept). The owner sees them in the **Backup** tab: **Back up now**, **Download**, and **Restore**. A restore first saves a safety copy of the current data, replaces everything with the chosen backup, and logs everyone out.

Still copy the backups off the VM now and then (your computer or Google Drive), because a backup on the same machine does not protect you if the machine is lost. You can also copy the database file itself:

```bash
sudo apt-get install -y sqlite3
sqlite3 /opt/petrol-app/data.db ".backup ~/data-$(date +%F).db"
```

## Audit log

The owner sees **Pump setup, then Audit log**: every change with who made it and when. It covers edits to customers, invoices, stock, suppliers, rates and other business data (for example "Customers changed: Shree (entries 3 to 4)"), plus duty assignment, closing, reopening and corrections (with the before and after figures), day close and approval, credit approvals, pay entries, dips, user changes, logins, backups and restores.

## Good to know

- Business data is stored in separate sections (customers, invoices, stock, suppliers, book, business details, tanks, setup). Two people only clash if they change the same section at the same moment, and then the second person is told which section and asked to reload.
- Worker credit sales are separate again, so they never clash.
- After 5 wrong passwords, that mobile number is locked for 15 minutes.
- Forgot the owner password? Stop the server, then run:
  ```bash
  node -e "const D=require('better-sqlite3'),b=require('bcryptjs');new D('data.db').prepare('update users set hash=? where role=\'owner\'').run(b.hashSync('NewPass123',10))"
  ```
  and log in with `NewPass123`, then change it.
