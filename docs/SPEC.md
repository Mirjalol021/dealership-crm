# DEALERSHIP CRM V2
## MASTER PRODUCT & BUILD SPECIFICATION
## 1. PROJECT GOAL
Build a brand-new dealership CRM from scratch.
This CRM must be intentionally SIMPLE.
The previous CRM became too complicated. This new version must focus on:
- fast daily usage by staff
- minimal clicks
- easy lead processing
- clear management visibility
- simple inventory
- simple sales
- simple finance
- simple AfterSales
- basic anti-theft inventory controls
- Meta + Telegram lead integrations
- multi-dealership support
- UZ / RU / EN
- useful exports and reports
### Core philosophy
If a feature does not directly help:
1. sell a car,
2. control inventory,
3. understand basic profitability,
4. manage customers,
5. or bring customers back for service,
DO NOT BUILD IT.
Do not add complexity just because a feature may be useful someday.
---
# 2. BRANDS
Initial brands:
- Geely
- Dongfeng
- MG
Brands must exist as configurable database records.
Do not hardcode brand logic everywhere.
Brand fields:
- id
- name
- code
- active
- optional logo
- sortOrder
---
# 3. MULTI-DEALERSHIP SUPPORT
The CRM must support multiple dealerships from day one.
Super Admin should be able to go to:
Settings → Dealerships → Add Dealership
Dealership fields:
- id
- dealershipName
- city / region
- address optional
- brands available
- active / inactive
- createdAt
- updatedAt
Example:
Fergana Motor City
- Geely
- Dongfeng
- MG
Later we might add:
Namangan Geely
Andijan Motor City
etc.
Adding a dealership must NOT require code changes.
Important records should include dealershipId where relevant:
- Leads
- Inventory
- Reservations
- Sales
- Expenses
- Service Visits
- AfterSales Inventory
- Users
---
# 4. LANGUAGES
Full CRM interface in:
- Uzbek
- Russian
- English
Each user chooses preferred language.
Do not translate user-entered information such as:
- Customer name
- Comments
- Notes
- VIN
- Phone
- Free text
---
# 5. USER ROLES
Keep roles simple.
## 5.1 SUPER ADMIN
Full access to everything.
Can access:
- Dashboard
- All Dealerships
- All Brands
- Lead Pool
- All Leads
- Head of Sales
- Sales Managers
- Call Center
- Inventory
- Reservations
- Sales
- Finance
- AfterSales
- AfterSales Inventory
- Reports
- Users
- Settings
- Integrations
- Imports / Exports
Can:
- assign any lead
- reassign leads
- assign leads directly to Head of Sales
- assign priority leads
- add dealerships
- add users
- see costs
- see profit
- see all finance information
---
## 5.2 HEAD OF SALES
Can access all SALES-related areas.
Can see:
- all Leads
- Lead Pool
- Sales Managers
- Sales Manager statistics
- Pipeline analytics
- Lead Result analytics
- Appointments
- Inventory
- Sales
- Sales Reports
Can:
- assign leads
- reassign leads
- review each manager individually
- receive priority leads directly from Super Admin
Cannot access:
- Finance
- AfterSales
---
## 5.3 SALES MANAGER
The Sales Manager interface must be extremely simple.
Main navigation:
- Today
- Lead Pool
- My Leads
- Appointments
- Inventory
Can:
- take leads from Lead Pool
- create Organic / Manual leads
- call customers
- select contact result
- schedule follow-up
- add comments
- plan showroom visits
- mark Test Drive Completed
- complete sale
- view basic inventory
Cannot see:
- Finance
- company profit
- service cost
- user administration
- integration settings
- complicated management reports
---
## 5.4 CALL CENTER
Call Center role must exist even though Call Center staff is not hired yet.
There are two Lead Distribution Modes.
### CURRENT MODE
Manager Self-Pick
Flow:
Meta / Telegram Lead
→ Lead Pool
→ Sales Manager clicks Take Lead
→ Lead becomes assigned to manager
### FUTURE MODE
Call Center Qualification
Flow:
Meta / Telegram Lead
→ Call Center
→ First Call
→ Interested / Potential Customer
→ Assign to Sales Manager
Call Center result buttons:
- No Answer
- Call Later
- Interested / Potential Client
- Not Interested
- Wrong Number
- Left Info by Mistake
- Another Region
If Interested:
Call Center selects Sales Manager and assigns lead.
Call Center cannot see:
- Finance
- AfterSales
- management profit
---
## 5.5 SERVICE STAFF
Access:
- Sold Cars
- Service Customers
- Service Visits
- Customers to Call
- AfterSales Inventory
Can see:
- inventory item name
- available quantity
- selling price
MUST NOT see:
- purchase cost
- inventory cost
- service gross profit
- Finance
---
## 5.6 FINANCE / ACCOUNTANT
Access:
- Finance
- Expenses
- Sold Cars financial information
- Distributor Bonuses
- KPI Bonuses
- Service revenue/cost
- Finance reports
May have Sold Cars read-only access.
---
# 6. LEAD DISTRIBUTION MODE
Create one simple setting:
Lead Distribution Mode
Options:
1. Manager Self-Pick
2. Call Center Qualification
Current default:
Manager Self-Pick
Switching later to Call Center must NOT require rebuilding the CRM.
---
# 7. LEAD POOL
All unassigned leads appear in Lead Pool.
Lead card should show only:
Customer Name
Brand / Model
Source
Dealership / Region
Received Time
Button:
TAKE LEAD
When Manager clicks Take Lead:
- assignedUserId = Manager
- assignedAt recorded
- lead removed from Lead Pool
- lead appears in My Leads
- another manager cannot take same lead
Assignment must be atomic.
Super Admin and Head of Sales can manually assign Lead Pool leads.
---
# 8. LEAD SOURCES
Supported sources:
- Meta / Facebook
- Telegram
- Instagram Organic
- Telegram Organic
- Walk-in
- Phone Call
- Referral
- Existing Customer
- Manual
- Other
Do NOT create separate CRM pipelines for each source.
Use one sales pipeline.
Allow filters/views by Source and Campaign.
---
# 9. MANUAL / ORGANIC LEADS
Sales Manager can press:
+ Add Lead
Minimal form:
- Phone — required
- Name
- Brand — required
- Model
- Dealership
- Source — required
- Note optional
Lead automatically belongs to the Sales Manager who created it.
---
# 10. LEAD CORE DATA
Each Lead should contain:
## Customer
- customerName
- primaryPhone
- additionalPhones optional
## Context
- dealershipId
- brandId
- modelInterest
- source
- campaign
- formId
- externalLeadId
## Ownership
- assignedUserId
- assignedAt
- priority
Priority:
- Normal
- Priority
## Sales State
- pipelineStatus
- lastResult
- nextFollowUpAt
- expectedVisitAt
## Timestamps
- createdAt
- firstContactAt
- lastContactAt
- visitedAt
- soldAt
- lostAt
---
# 11. SIMPLE SALES PIPELINE
Pipeline Status means:
WHERE IS THIS CUSTOMER IN THE SALES JOURNEY?
Use only:
1. New
2. Working
3. Visit Planned
4. Visited / Test Drive
5. Sold
6. Lost
Do NOT create 9–15 pipeline stages.
---
# 12. LEAD RESULT
Lead Result means:
WHAT HAPPENED DURING THE LATEST CONTACT?
Required results:
- No Answer
- Client Busy / Call Back Later
- Wrong Number
- Info Given — Visit Expected
- Info Given — Thinking
- Interested
- Not Interested
- Left Info by Mistake
- Another Region
- Visit Planned
- Test Drive Completed
- Sold
Pipeline Status and Lead Result are separate.
Example:
Pipeline:
Working
Last Result:
Info Given — Thinking
Next Follow-Up:
26 September
---
# 13. SALES MANAGER QUICK BUTTONS
Do NOT make Sales Manager fill long forms.
Primary buttons:
- No Answer
- Busy / Call Later
- Interested
- Info Given
- Visit Planned
- Not Interested
Secondary / Other:
- Wrong Number
- Mistake
- Another Region
- Test Drive Completed
- Sold
---
# 14. SMART FOLLOW-UP
Only ask more information when required.
## No Answer
Ask:
- Later Today
- Tomorrow
- Custom Date
## Busy / Call Later
Require callback date.
Optional callback time.
## Info Given — Thinking
Options:
- 2 Days
- 3 Days
- 1 Week
- Custom
## Info Given — Visit Expected
Options:
- Soon
- This Week
- Next Week
- Specific Date
## Visit Planned
Require:
- Expected Visit Date
Time optional.
---
# 15. VISIT EXPECTED VS VISIT PLANNED
These are different.
## Visit Expected
Customer says:
"I may come this week."
"I will probably come next week."
No exact appointment.
## Visit Planned
Customer agreed on a specific date.
Example:
Thursday September 26.
---
# 16. TODAY / LEAD PROCESSING PAGE
This should be the default Sales Manager page.
Show:
- New Leads
- Need First Call
- Callbacks Today
- Overdue Follow-Ups
- Visit Expected
- Visits Planned Today
Then display leads requiring action.
Main workflow:
Open Lead
→ Call
→ Select Result
→ Set Follow-Up if required
→ SAVE & NEXT
This workflow should take seconds.
---
# 17. MY LEADS
Quick filters:
- New
- Call Today
- Overdue
- No Answer
- Thinking
- Interested
- Visit Expected
- Visit Planned
- Test Drive
- Sold
- Lost
Additional filters:
- Brand
- Model
- Source
- Date
No complicated filter builder.
---
# 18. KANBAN
Columns:
New
Working
Visit Planned
Visited / Test Drive
Sold
Lost
Card shows only:
- Customer Name
- Phone
- Brand / Model
- Last Result
- Next Action
Example:
Akmal Karimov
Geely EX5
No Answer — Attempt 2
Call Today 15:00
---
# 19. LEAD COMMENTS
Every Lead needs a Comments section.
Fields:
- text
- author
- timestamp
Newest first.
Example comments:
"Only wants white car."
"Customer abroad until next week."
"Brother makes final decision."
"VIP customer."
"Already negotiating with competitor."
Comments DO NOT automatically change Pipeline Status.
---
# 20. CONTACT ATTEMPTS
CRM records attempts automatically.
Example:
Attempt 1
No Answer
10:31
Attempt 2
No Answer
15:42
Attempt 3
Client Busy
18:05
Sales Manager should not manually create Attempt numbers.
---
# 21. LEAD ACTIVITY HISTORY
Keep a simple activity timeline.
Events:
- Lead Created
- Lead Entered Pool
- Lead Taken
- Lead Assigned
- Lead Reassigned
- Result Updated
- Follow-Up Scheduled
- Pipeline Changed
- Comment Added
- Visit Planned
- Test Drive Completed
- Sold
- Lost
Record:
- timestamp
- user
- event
- old value optional
- new value optional
---
# 22. LEAD ASSIGNMENT HISTORY
Track:
- From
- To
- Assigned By
- Timestamp
- Assignment Type
Assignment Types:
- Self-Pick
- Call Center
- Head of Sales
- Super Admin
- Reassignment
---
# 23. PRIORITY LEADS
Simple:
Normal
Priority
Super Admin can assign Priority leads directly to:
- Head of Sales
- specific Manager
Do NOT build lead scoring.
---
# 24. APPOINTMENTS / SHOWROOM VISITS
Keep simple.
Fields:
- Lead
- Customer
- Dealership
- Brand
- Manager
- Date
- Time optional
- Status
- Note optional
Statuses:
- Planned
- Arrived
- No Show
Visit Planned result should create appointment automatically.
---
# 25. MANAGEMENT LEAD ANALYTICS
Super Admin and Head of Sales need TWO DIFFERENT views.
## PIPELINE STATUS TABLE
Example:
Manager | New | Working | Visit Planned | Visited | Sold | Lost
Every number clickable.
Clicking opens those exact Leads.
## LEAD RESULT TABLE
Example columns:
- Manager
- No Answer
- Call Back
- Thinking
- Interested
- Visit Expected
- Visit Planned
- Not Interested
- Wrong Number
- Mistake
- Another Region
- Test Drive
- Sold
Filters:
- Today
- 7 Days
- This Month
- Custom Range
- Dealership
- Brand
- Manager
- Source
- Campaign
Sales Manager can see own statistics only.
Head of Sales can select one Sales Manager and analyze that person's leads.
---
# 26. SOURCE / CAMPAIGN REPORTING
Simple reporting:
Source | Leads | Visits | Sold
Sources:
- Meta
- Telegram
- Organic
- Walk-In
- Referral etc.
Allow drill-down by:
- Campaign
- Form
No Meta ad-spend analysis initially.
No CPL / ROAS initially.
---
# 27. VEHICLE INVENTORY
Fields:
- Dealership
- Brand
- Model
- Trim
- Color
- VIN
- Arrival Date
- Selling Price optional
- Status
- Notes
Statuses:
- Available
- Reserved
- Sold
No complex inventory state machine.
---
# 28. RESERVATIONS / BRON / ZALOG
Fields:
- Vehicle
- Customer
- Phone
- Lead optional
- Sales Manager
- Reservation Date
- Deposit / Zalog Amount
- Deposit Payment Method optional
- Expiration Date optional
- Comment
When sold:
Inventory Vehicle → Sold
---
# 29. SOLD CARS / SALES
Sold Car becomes the connection between:
Sales
Finance
AfterSales
Fields:
- Sale Date
- Dealership
- Brand
- Model
- VIN
- Customer
- Phone
- Sales Manager
- Sale Price
- Payment Type
- Finance Product / Bank text optional
- Manual Margin
- Discounted Sale
- Discount Amount optional
- Discount Comment optional
Payment Type:
- Cash
- Credit
- Other
No finance calculator.
---
# 30. MANUAL VEHICLE MARGIN
Finance enters the actual margin manually for each sold VIN.
Example:
15,000,000 UZS
Manual Margin should represent the actual deal.
If Manual Margin already reflects the discount, DO NOT subtract the discount again.
---
# 31. DISCOUNTED CARS
Checkbox:
Discounted Sale
If checked:
- Discount Amount
- Comment / Reason
Allow report/filter:
Discounted Cars
---
# 32. CUSTOMER BONUSES FOR SOLD CAR
Each sold car may have multiple customer bonuses.
Examples:
- Tonirovka
- Polik
- Registration
- Fuel
- Gift
- Other
Fields:
- Sold VIN
- Bonus Type
- Amount
- Date
- Paid From
- Comment
Paid From:
- LLC Account
- Cash
- Card
These reduce Vehicle Contribution.
---
# 33. EXTRA DISTRIBUTOR BONUS PER VIN
Some vehicles may receive additional margin/bonus from distributor.
Example:
Cash sale gets extra distributor bonus.
Fields:
- Sold VIN
- Amount
- Accounting Month
- Status
- Received Date optional
- Received Via optional
- Comment
Statuses:
- Expected
- Confirmed
- Paid
Make this visually obvious.
Suggested UI:
Yellow = Expected
Blue = Confirmed
Green = Paid
Example comment:
"Cash sale — distributor will pay additional VIN bonus."
---
# 34. DISTRIBUTOR KPI BONUS
Separate from VIN bonus.
Fields:
- Month
- Dealership optional
- Brand
- Amount
- Status
- Received Date
- Received Via
- Comment
Status:
Expected
Confirmed
Paid
Example:
September
Geely
50,000,000 UZS
Confirmed
---
# 35. FINANCE PRINCIPLE
Finance must answer:
WHAT?
HOW MUCH?
WHICH MONTH DOES IT BELONG TO?
WHEN DID MONEY ACTUALLY MOVE?
HOW WAS IT PAID / RECEIVED?
---
# 36. EXPENSE ENTRY
Fields:
- Accounting Month
- Payment Date
- Dealership
- Brand or Corporate
- Category
- Expense Type
- Amount
- Payment Method
- Status
- Comment
Expense Type:
- Fixed
- Variable
Payment Method:
- LLC Account
- Cash
- Card
Status:
- Pending
- Paid
---
# 37. EXPENSE CATEGORIES
Examples:
- Rent
- Salaries
- Electricity
- Water
- Utilities
- Internet
- Marketing
- Office
- Security
- Software
- Repairs
- Other
Suggested:
Fixed:
- Rent
- Salaries
- Internet
- Security
- Software
Variable:
- Utilities
- Electricity
- Marketing
- Repairs
- Miscellaneous
Allow Super Admin to manage categories later if easy.
---
# 38. ACCOUNTING MONTH VS PAYMENT DATE
This is VERY IMPORTANT.
Example:
August Salary
Paid:
8 September
Transaction:
Accounting Month:
August 2026
Payment Date:
8 September 2026
Amount:
80,000,000
Paid Via:
LLC Account
Therefore:
August Profit View includes the salary.
September Cash Flow shows the cash payment.
---
# 39. PROFIT VIEW AND CASH FLOW VIEW
Finance must have two views.
## PROFIT VIEW
Uses Accounting Month.
Answers:
"How much profit did this month economically make?"
## CASH FLOW VIEW
Uses actual payment / receipt date.
Answers:
"When did money actually move?"
Simple toggle:
PROFIT VIEW | CASH FLOW VIEW
---
# 40. VAT / TAX
Create configurable Finance Tax Settings.
Initial/default setting:
Tax Name:
VAT
Tax Rate:
12%
Tax Base:
Vehicle Margin
Do not permanently hardcode tax logic.
Show:
Margin Before VAT
VAT Provision
Margin After VAT
Super Admin must be able to change Tax Rate / method later if accountant requires it.
---
# 41. VEHICLE CONTRIBUTION
Suggested simple formula:
Manual Margin
+ Confirmed/Paid Extra Distributor Bonus
− Customer Bonuses
− VAT Provision
=
Vehicle Contribution
Expected but unconfirmed distributor bonus should be shown separately.
Do not count expected/unconfirmed money as realized profit by default.
---
# 42. AFTERSALES SOLD CARS DATABASE
Every sold car becomes available to AfterSales.
Fields:
- Customer
- Phone
- Dealership
- Brand
- Model
- VIN
- Purchase Date
- Sales Manager
- Payment Type
- Finance Product / Bank text
- Current Mileage
- Last Service Date
- Next Service Mileage
- Next Service Date
- Notes
---
# 43. SERVICE VISITS
One car can have many Service Visits.
Fields:
- Sold Car / VIN
- Service Date
- Mileage
- Service Staff
- Work Performed
- Extra Work Performed
- Comment
- Next Service Mileage
- Next Service Date
- Service Revenue
- Payment Method
- Payment Date
Payment Method:
- LLC Account
- Cash
- Card
No Work Order system.
No complicated service workflow.
---
# 44. CUSTOMERS TO CALL — AFTERSALES
Service Staff page:
Customers to Call
Filters:
- Service Due Soon
- Service Overdue
- Mileage Due
- Never Serviced
- Brand
- Dealership
Service Staff can:
- view customer
- call
- add comment
- create Service Visit
- update Next Service
---
# 45. AFTERSALES INVENTORY
Separate small inventory for service parts and consumables.
Categories:
- Engine Oil
- Oil Filter
- Air Filter
- Cabin Filter
- Fuel Filter
- Brake Fluid
- Coolant
- Spark Plug
- Brake Pads
- Other Parts
- Other Consumables
Item fields:
- Dealership
- Category
- Item Name
- Compatible Brand / Model optional
- Part Number optional
- Unit
- Quantity On Hand
- Selling Price
- Purchase Cost
- Minimum Stock optional
- Notes
- Active
Units:
- Piece
- Liter
- Set
- Other
---
# 46. AFTERSALES COST SECURITY
Service Staff sees:
- Item Name
- Available Quantity
- Selling Price
Service Staff MUST NOT receive:
- Purchase Cost
- Margin
- Service Profit
Cost restriction must be enforced on backend/server.
Not just hidden in frontend.
---
# 47. STOCK RECEIVING
When parts/oil arrives:
Record:
- Item
- Quantity Received
- Unit Cost
- Date
- Supplier optional
- Payment Method optional
- Comment
Quantity On Hand automatically increases.
---
# 48. STOCK USAGE ON SERVICE VISIT
When customer vehicle is serviced, Service Staff chooses inventory used.
Example:
Mobil 5W-30 × 5 liters
Oil Filter × 1
Air Filter × 1
CRM automatically deducts stock.
Usage record must link to:
- Service Visit
- VIN
- Customer
- Service Employee
- Inventory Item
- Quantity
- Selling Price Snapshot
- Cost Snapshot
- Timestamp
Cost Snapshot hidden from Service Staff.
This is required to prevent AfterSales theft.
---
# 49. STOCK ADJUSTMENTS
Manual stock adjustment requires reason.
Examples:
- Damaged
- Physical Inventory Correction
- Returned
- Other
Log:
- Item
- Quantity Before
- Quantity Change
- Quantity After
- User
- Date
- Reason
---
# 50. AFTERSALES STOCK MOVEMENT REPORT
For each item show:
Opening Quantity
+ Received
− Used
+/− Adjustments
= Expected Closing Quantity
This should allow comparison against physical inventory.
No warehouse ERP.
---
# 51. SERVICE REVENUE
Completed Service Visit creates Service Revenue automatically.
Do not make Finance manually enter same revenue again.
Record:
- Service Revenue
- Payment Method
- Payment Date
Finance/Super Admin can see:
Service Revenue
Inventory Cost
Service Contribution
Service Staff cannot see cost/profit.
---
# 52. SERVICE CONTRIBUTION
Simple:
Service Revenue
− Cost of Inventory Items Used
=
Service Contribution
Do not build labor-cost accounting now.
Other service company costs can be recorded as normal Finance expenses.
---
# 53. FINANCE DASHBOARD
Filters:
- Month
- Custom Date Range
- Dealership
- Brand / All Brands
Top cards:
- Total Sales Turnover
- Vehicle Margin
- Service Revenue
- Distributor VIN Bonuses
- Distributor KPI Bonuses
- Total Expenses
- VAT Provision
- Net Result
Keep separate:
Sales Revenue / Turnover
and
Margin
They are not the same thing.
---
# 54. FINANCE CHARTS
Only simple graphs.
## Graph 1
Revenue vs Expenses by Month
## Graph 2
Expense Composition
Categories:
- Fixed Expenses
- Salaries
- Utilities
- Marketing
- Customer Car Bonuses
- Other
No Sankey.
No complicated BI.
---
# 55. MONTHLY NET RESULT
Profit View should calculate something conceptually like:
Vehicle Contribution
+ Confirmed KPI Bonus
+ Service Contribution
− Fixed Expenses
− Variable Expenses
=
NET RESULT
Do not double-count VAT or Customer Bonuses.
---
# 56. META LEAD INTEGRATION
Meta Lead Ads leads should automatically enter CRM.
Store:
- Meta Lead ID
- Campaign ID / Name
- Ad Set ID / Name optional
- Ad ID / Name optional
- Form ID / Name
- Received Timestamp
- Brand
- Dealership
- Dynamic Form Answers
Deduplicate:
1. Meta Lead ID
2. Normalized Phone for customer matching
Do NOT build Meta Ads Manager functionality.
---
# 57. TELEGRAM LEAD INTEGRATION
Telegram campaigns must also send leads automatically into CRM.
Depending on campaign implementation, integration may use:
- Telegram Bot
- Telegram API
- Webhook
Store:
- Telegram External Lead/Reference ID if available
- Campaign
- Source = Telegram
- Received Timestamp
- Brand
- Dealership
- Dynamic Answers
Use the SAME lead system as Meta.
Do not create separate Telegram lead architecture.
---
# 58. FLEXIBLE META / TELEGRAM FORMS
Forms may have different numbers of questions.
Example:
Form A:
Name
Phone
Model
Form B:
Name
Phone
Model
Payment Type
Down Payment
CRM must handle both automatically.
Use:
FIXED CRM FIELDS
+
DYNAMIC FORM ANSWERS
---
# 59. FIXED CRM FIELDS
Standard fields:
- Name
- Phone
- Brand
- Model
- Dealership
- Source
- Campaign
- Form ID
- Created Timestamp
---
# 60. DYNAMIC FORM ANSWERS
Store each received answer:
- External Field Key
- Question Label Snapshot
- Answer
- Display Order
Only display information that was actually received.
DO NOT show empty fields.
---
# 61. FORM CONFIGURATION
Super Admin page:
Settings → Lead Forms
When creating/adding new Meta or Telegram form:
Configure:
- Source
- Form ID
- Form Name
- Brand
- Dealership
- Active
- Field Mapping
Example:
full_name → Customer Name
phone_number → Phone
which_model → Model
payment_type → Custom Answer
down_payment → Custom Answer
IMPORTANT:
Unmapped fields must still be stored and displayed.
No lead information should be lost because field mapping was not configured.
---
# 62. MANAGER VIEW OF FORM ANSWERS
Lead example:
CUSTOMER
Aziz Karimov
+998...
Geely EX5
SOURCE
Meta
EX5 September Campaign
FORM ANSWERS
Payment Type: Credit
Down Payment: 30%
Purchase Timing: This Month
Then immediately show:
CONTACT RESULT BUTTONS
Do not make manager care whether the form had 3 questions or 8.
---
# 63. CUSTOMER / PHONE DEDUPLICATION
Normalize phone numbers.
If same phone exists:
Existing Customer Found
Do not create duplicate customer unnecessarily.
Create/link new Lead to existing Customer.
Do not build complicated duplicate management unless real conflict exists.
---
# 64. BULK UPLOAD
Support CSV/XLSX upload for:
- Leads
- Customer Database
- Vehicle Inventory
- Historical Sold Cars
- AfterSales Inventory Opening Stock
Flow:
Upload
→ Preview
→ Duplicate Check
→ Confirm
Do not silently import invalid rows.
---
# 65. EXPORT
Support:
Excel
CSV
Main lists/reports should export current filtered result.
Examples:
Leads
Sales
Inventory
Finance
AfterSales
Stock Movements
Management Reports
Date options:
- Today
- This Week
- This Month
- Last Month
- Custom Range
---
# 66. LEAD EXPORT
Include:
- Created Date/Time
- Customer
- Phone
- Dealership
- Brand
- Model
- Source
- Campaign
- Form
- Assigned Manager
- Pipeline Status
- Last Result
- Next Follow-Up
- Visit Date
- Sold / Lost
- Comments if appropriate
---
# 67. BASIC REPORTS ONLY
Do not create dozens of reports.
## SALES REPORT
- Leads
- Contacted
- Visits
- Sold
- Conversion
- Sales by Manager
- Sales by Brand
- Pipeline Status by Manager
- Lead Result by Manager
## MARKETING REPORT
- Leads by Source
- Meta Leads
- Telegram Leads
- Organic Leads
- Visits by Source
- Sold by Source
- Campaign / Form results
## INVENTORY REPORT
- Available
- Reserved
- Sold
## FINANCE REPORT
- Sales Turnover
- Vehicle Margin
- Distributor VIN Bonuses
- KPI Bonuses
- Customer Bonuses
- Fixed Expenses
- Variable Expenses
- Service Revenue
- Service Contribution
- VAT Provision
- Net Result
- Cash Flow
## AFTERSALES REPORT
- Customers Due
- Customers Overdue
- Service Visits
- Service Revenue
- Inventory Usage
- Stock Movements
---
# 68. CONSISTENT REPORT FILTER BAR
Use the same filter style everywhere.
Possible filters:
- Date Range
- Dealership
- Brand
- Manager
- Source
- Campaign
Do not create a new filter system for each report.
---
# 69. SUPER ADMIN DASHBOARD
Show:
- New Leads Today
- Working Leads
- Visit Planned
- Sold This Month
- Lead Pool Count
- Pipeline Status Table by Manager
- Lead Result Table by Manager
- Sales by Brand
- Inventory Summary
- Finance Summary
- Service Due Customers
Keep charts minimal.
---
# 70. HEAD OF SALES DASHBOARD
Show:
- New Leads
- Unassigned Pool
- Overdue Leads
- Visits
- Sold
- Pipeline Table by Manager
- Lead Result Table by Manager
Manager selector:
All Managers
or
Individual Manager
No Finance.
No AfterSales.
---
# 71. SALES MANAGER DASHBOARD
Show only:
- New
- First Call Needed
- Callbacks Today
- Overdue
- Visit Expected
- Visits Planned Today
And own simple statistics.
---
# 72. USERS MANAGEMENT
User fields:
- Name
- Email / Login
- Phone optional
- Role
- Dealership Access
- Brand Access
- Preferred Language
- Active / Inactive
Super Admin manages users.
---
# 73. SECURITY
Enforce permissions on backend/server.
Do NOT rely only on hiding frontend UI.
Especially protect:
- Finance
- Margin
- AfterSales purchase cost
- Service contribution
- Company profit
Service Staff should never receive purchase cost in API response.
---
# 74. TIMESTAMPS
Lead:
- createdAt
- assignedAt
- firstContactAt
- lastContactAt
- nextFollowUpAt
- expectedVisitAt
- visitedAt
- soldAt
- lostAt
Inventory:
- arrivalDate
- reservedAt
- soldAt
Finance:
- accountingMonth
- paymentDate
- receivedDate
- createdAt
Service:
- serviceDate
- nextServiceDate
---
# 75. SIMPLE AUDIT / HISTORY
Do not build a huge audit module.
Track important events:
- Lead assignment
- Pipeline change
- Lead Result change
- Comments
- Sale creation/edit
- Expense creation/edit
- Distributor bonus change
- Inventory reservation
- Vehicle sold
- AfterSales stock receipt
- Inventory usage
- Stock adjustment
- User/admin changes
Store:
- actor
- timestamp
- entity
- action
- old/new value if useful
---
# 76. SUGGESTED LOGICAL DATABASE ENTITIES
Gemini should map these to the selected technology.
CORE
Brands
Dealerships
Users
UserDealershipAccess
UserBrandAccess
LEADS
Customers
CustomerPhones
Leads
LeadComments
LeadContactAttempts
LeadActivities
LeadAssignments
Appointments
ExternalLeadForms
LeadFormAnswers
VEHICLE SALES
InventoryVehicles
VehicleReservations
SoldCars
VehicleCustomerBonuses
VinDistributorBonuses
KpiBonuses
FINANCE
Expenses
FinanceSettings
AFTERSALES
ServiceVisits
AfterSalesInventoryItems
AfterSalesStockReceipts
AfterSalesInventoryUsage
AfterSalesStockAdjustments
INTEGRATIONS
MetaConnectorSettings
TelegramConnectorSettings
ExternalLeadReferences
IMPORTS
ImportBatches
---
# 77. NAVIGATION
SUPER ADMIN:
Dashboard
Leads
Appointments
Inventory
Sales
AfterSales
AfterSales Inventory
Finance
Reports
Users
Settings
SALES MANAGER:
Today
Lead Pool
My Leads
Appointments
Inventory
CALL CENTER:
New Leads
Follow-Ups
Qualified / Assigned
SERVICE STAFF:
Customers to Call
Sold Cars
Service Visits
AfterSales Inventory
FINANCE:
Finance Overview
Expenses
Sold Cars Finance
Distributor Bonuses
Reports
---
# 78. UI DESIGN REQUIREMENTS
The CRM must be:
- clean
- modern
- professional
- simple
- fast
- mobile friendly
- desktop friendly
Use:
- large action buttons
- short forms
- clear hierarchy
- simple cards
- clear status colors
- Save & Next workflow
Avoid:
- excessive badges
- crowded cards
- deep navigation
- complicated modals
- technical IDs
- too many tabs
- large forms
- charts everywhere
---
# 79. THINGS NOT TO BUILD
DO NOT BUILD:
- old complex 9-stage pipeline
- finance product calculator
- bank products
- complicated margin rules
- complicated VIN profitability engine
- complex inventory lifecycle
- service work orders
- labor management
- CSI system
- warranty system
- Sankey
- native AI
- AI agents
- RAG
- advanced workflow builder
- complex connector dashboard
- ad campaign manager
- Meta Ads Manager clone
- advanced attribution
- full accounting software
- payroll system
- warehouse ERP
- procurement ERP
- complicated permissions hierarchy
- separate report page for every database table
---
# 80. BUILD STRATEGY
DO NOT BUILD THE WHOLE CRM AT ONCE.
First read the entire specification.
Then propose architecture and phases.
Suggested phases:
## PHASE 1 — FOUNDATION
- Authentication
- Brands
- Dealerships
- Languages
- Users
- Roles
- Permissions
- Navigation
## PHASE 2 — LEADS
- Customers
- Lead Pool
- Lead Distribution Mode
- My Leads
- Today
- Simple Pipeline
- Lead Result buttons
- Follow-ups
- Comments
- Contact Attempts
- Activity History
- Assignment History
- Appointments
- Kanban
- Management Pipeline / Lead Result tables
## PHASE 3 — INVENTORY + SALES
- Vehicle Inventory
- Reservations / Zalog
- Sold Cars
- Customer Bonuses
- Discounts
- VIN Distributor Bonus
## PHASE 4 — FINANCE
- Expenses
- Accounting Month
- Payment Date
- Fixed / Variable
- Payment Method
- KPI Bonus
- VAT Settings
- Profit View
- Cash Flow View
- Simple Finance Dashboard
## PHASE 5 — AFTERSALES
- Sold Cars AfterSales Database
- Customers to Call
- Service Visits
- Next Service
- AfterSales Inventory
- Stock Receipts
- Service Usage
- Stock Adjustments
- Service Revenue
- Anti-theft Stock Report
## PHASE 6 — INTEGRATIONS + REPORTS
- Meta Lead Ads
- Telegram Leads
- Dynamic Form Answers
- Form Mapping
- Phone Dedup
- Bulk Upload
- Excel / CSV Export
- Sales Reports
- Marketing Reports
- Inventory Reports
- Finance Reports
- AfterSales Reports
Do one phase at a time.
Test before continuing.
---
# 81. ACCEPTANCE CRITERIA
The CRM is successful if:
1. Sales Manager can process a lead in seconds.
2. Sales Manager can take lead from Lead Pool with one click.
3. CRM can later switch to Call Center workflow without rebuilding.
4. Super Admin sees all dealerships.
5. New dealership can be added without code changes.
6. Head of Sales can inspect each manager individually.
7. Pipeline Status and Lead Result are separate.
8. Every lead has contact/result/status history.
9. Every lead has timestamps.
10. Comments are available on every lead.
11. Meta leads enter automatically.
12. Telegram campaign leads enter automatically.
13. Different Meta/Telegram forms with different questions work automatically.
14. Unmapped form answers are never lost.
15. Managers can create Organic leads.
16. Phone deduplication works.
17. Inventory clearly shows Available / Reserved / Sold.
18. Zalog / Reservation is tracked.
19. Every sold VIN has manual margin.
20. Customer bonuses are tracked by payment source.
21. Extra VIN distributor bonuses support Expected / Confirmed / Paid.
22. KPI bonuses are tracked separately.
23. Finance separates Accounting Month from Payment Date.
24. Finance separates Profit View from Cash Flow View.
25. VAT is configurable.
26. Service Staff does not see cost.
27. Service Staff selects actual parts/oil used from inventory.
28. Stock automatically decreases when item is used.
29. Every AfterSales inventory use links to VIN + Service Visit + Employee.
30. Manual stock adjustment requires reason.
31. Service revenue automatically flows into Finance.
32. Monthly and custom-date exports work.
33. UZ / RU / EN work throughout.
34. Staff interface stays simple.
---
# 82. FINAL INSTRUCTION TO GEMINI
Build the SIMPLEST correct implementation of this CRM.
Do not interpret:
"Professional"
as:
"Complex."
When choosing between two solutions, prefer the solution with:
- fewer clicks
- fewer screens
- fewer fields
- fewer statuses
- fewer tables
- lower maintenance
- clearer employee workflow
Management can receive more visibility.
Staff should only see what they need to perform their job.
DO NOT START CODING IMMEDIATELY.
FIRST RETURN:
1. Proposed technical architecture
2. Database/entity schema
3. User-role permission matrix
4. Screen/page map
5. Phase-by-phase implementation plan
6. Estimated Gemini development effort for each phase
7. Any genuine blocking questions
8. Features you believe can be simplified further
Do not add features that are not in this document.
Stop and wait for approval before implementation.

---

# APPENDIX — Implementation compliance notes

This appendix records how the codebase satisfies the master spec above, and any
intentional deviations. Section numbers in the code (`§NN`) map to this document.

## Where each domain lives

| Spec domain | Code |
|-------------|------|
| §2–3 Brands & Dealerships | `server/src/routes/brands.routes.ts`, `dealerships.routes.ts` |
| §4 Languages (uz/ru/en) | `client/src/locales/*.json`, `client/src/i18n` |
| §5 Roles & permissions | `server/src/auth/permissions.ts` |
| §6 Lead Distribution Mode | `AppSettings.leadDistributionMode`, `settings.routes.ts` |
| §7–23 Leads | `server/src/routes/leads.routes.ts`, `client/src/pages/*Lead*` |
| §24 Appointments | `appointments.routes.ts` |
| §25–26 Analytics / Source | `leads.routes.ts` (`/analytics/*`), `reports.routes.ts` |
| §27–34 Inventory / Sales / Bonuses | `inventory.routes.ts`, `reservations.routes.ts`, `sales.routes.ts` |
| §35–41, §53–55 Finance | `finance.routes.ts`, `lib/finance.ts` |
| §42–52 AfterSales | `aftersales.routes.ts` |
| §56–63 Integrations | `integrations.routes.ts`, `lib/leadIngest.ts`, `lib/webhookSignature.ts` |
| §64–66 Import/Export | `importExport.routes.ts`, `lib/csv.ts` |
| §67–68 Reports & filters | `reports.routes.ts`, `lib/dateRange.ts` |
| §69–71 Dashboards | `dashboard.routes.ts` |
| §72 Users | `users.routes.ts` |
| §73–75 Security / Audit | `auth/*`, `lib/audit.ts`, `lib/errorHandler.ts` |
| §76 Entities | `server/prisma/schema.prisma` |
| §77 Navigation | `client/src/lib/navigation.ts` |
| §79 NOT to build | verified absent (no work orders, CSI, payroll, AI, Sankey, …) |

## Compliance summary

- §76 entity coverage: **complete** (naming normalised, e.g. `CustomerPhones` →
  `LeadPhone`, `InventoryVehicles` → `InventoryVehicle`; extra `Session`,
  `AuditLog`, `AppSettings` added for auth/hardening).
- §13 quick buttons, §14 smart follow-up (with one-tap presets), §17 quick filters,
  §18 kanban, §19–22 lead history: implemented.
- §33 Expected/Confirmed/Paid colour coding: Yellow / Blue / Green.
- §46 & §73 cost security: purchase cost, margin and service cost gated by
  `costs.view` on the **backend**; Service Staff never receives them.
- §54 charts: Graph 1 (Revenue vs Expenses) + Graph 2 (Expense composition),
  hand-rolled SVG (no BI library).

## Intentional deviations / additions

- **Hardening (not in original spec):** login throttling, CSRF origin checks,
  request body limit, import row cap, CSV formula-injection guard, SPA fallback
  with path-traversal guard, centralised error handler.
- **Audit (§75):** extended to lead create/take/assign/result beyond the minimum.
- **Tests:** unit tests (finance, scope, dateRange, phone, webhook signature, csv,
  login throttle) + API integration suites.
